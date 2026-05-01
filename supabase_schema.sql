-- Pick-Am Pure Supabase Schema
-- Run this in the Supabase SQL Editor

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'rider', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE package_status AS ENUM (
        'pending_receiver', 
        'searching_rider', 
        'rider_assigned', 
        'arrived_at_pickup',
        'picked_up', 
        'in_transit', 
        'delivered', 
        'rejected', 
        'insufficient_funds',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE package_size AS ENUM ('small', 'medium', 'large', 'extra_large');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    role user_role DEFAULT 'user',
    wallet_balance NUMERIC DEFAULT 0,
    
    -- Rider specific
    rider_rating NUMERIC DEFAULT 5.0,
    total_deliveries INT DEFAULT 0,
    total_earnings NUMERIC DEFAULT 0,
    pending_balance NUMERIC DEFAULT 0, -- Stays here for 24h before moving to wallet_balance
    is_available BOOLEAN DEFAULT TRUE,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for phone lookups (used in Inbox)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);


-- 4. Packages
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id),
    
    receiver_name TEXT NOT NULL,
    receiver_phone TEXT NOT NULL,
    
    pickup_landmark TEXT NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_landmark TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    
    item_description TEXT NOT NULL,
    package_size package_size DEFAULT 'small',
    notes TEXT,
    
    status package_status DEFAULT 'pending_receiver',
    price NUMERIC DEFAULT 0,
    distance_km NUMERIC DEFAULT 0,
    
    rider_id UUID REFERENCES public.profiles(id),
    
    tracking_lat NUMERIC,
    tracking_lng NUMERIC,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,

    -- Rating cache for frontend
    rider_rated BOOLEAN DEFAULT FALSE,
    rider_rating_given INT,
    
    -- Security & Verification
    delivery_otp TEXT, -- Generated on payment
    
    -- Premium Features
    item_value NUMERIC DEFAULT 0,
    insurance_fee NUMERIC DEFAULT 0,
    pickup_image_url TEXT,
    delivery_image_url TEXT,
    is_disputed BOOLEAN DEFAULT FALSE,
    dispute_reason TEXT
);


-- 5. Wallet Transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'topup', 'delivery_payment', 'delivery_earning'
    description TEXT,
    package_id UUID REFERENCES public.packages(id),
    reference TEXT UNIQUE,
    status TEXT DEFAULT 'success',
    metadata JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Ratings
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    package_id UUID REFERENCES public.packages(id) UNIQUE,
    rider_id UUID REFERENCES public.profiles(id),
    sender_id UUID REFERENCES public.profiles(id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    metadata JSONB, -- For carrier response
    type TEXT, -- 'otp', 'tracking', etc
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Log Policies: Extremely tight as it contains OTPs
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only access to sms_logs" ON public.sms_logs;
CREATE POLICY "Service role only access to sms_logs" 
ON public.sms_logs 
FOR ALL 
USING (false) 
WITH CHECK (false); -- Only service_role can bypass RLS via Edge Functions

-- Trigger to update rider rating and package status on new rating
CREATE OR REPLACE FUNCTION public.update_rider_rating()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the rider's average rating and total deliveries (if not already counted)
    UPDATE public.profiles
    SET rider_rating = (
        SELECT ROUND(AVG(rating)::NUMERIC, 1)
        FROM public.ratings
        WHERE rider_id = NEW.rider_id
    )
    WHERE id = NEW.rider_id;

    -- Mark the package as rated
    UPDATE public.packages
    SET 
        rider_rated = TRUE,
        rider_rating_given = NEW.rating
    WHERE id = NEW.package_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_rating_created
    AFTER INSERT ON public.ratings
    FOR EACH ROW EXECUTE FUNCTION public.update_rider_rating();


-- 7. Functions & Triggers

-- Handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, phone, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'phone',
        COALESCE((new.raw_user_meta_data->>'role')::user_role, 'user')
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Distance Calculation (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance(lat1 NUMERIC, lng1 NUMERIC, lat2 NUMERIC, lng2 NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    R NUMERIC := 6371; -- Earth radius in km
    dlat NUMERIC;
    dlng NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
    c := 2 * asin(sqrt(a));
    RETURN round((R * c)::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql;

-- Landmarks for coordinate lookup
CREATE TABLE IF NOT EXISTS public.landmarks (
    name TEXT PRIMARY KEY,
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL
);

-- Seed landmarks (abbreviated list)
INSERT INTO public.landmarks (name, lat, lng) VALUES
('shoprite ikeja', 6.6018, 3.3515),
('computer village', 6.6050, 3.3468),
('lekki phase 1', 6.4474, 3.4733),
('victoria island', 6.4281, 3.4219),
('ikoyi', 6.4500, 3.4350),
('surulere', 6.4920, 3.3509),
('yaba', 6.5073, 3.3755),
('unilag', 6.5158, 3.3899),
('maryland', 6.5702, 3.3600),
('ojota', 6.5862, 3.3804),
('berger', 6.6136, 3.3400),
('oshodi', 6.5488, 3.3412),
('ajah', 6.4700, 3.5800),
('ikorodu', 6.6194, 3.5105),
('festac', 6.4667, 3.2833),
('apapa', 6.4483, 3.3592),
('mushin', 6.5317, 3.3558),
('agege', 6.6192, 3.3253),
('palmgrove', 6.5371, 3.3732),
('anthony', 6.5637, 3.3686),
('gbagada', 6.5529, 3.3931),
('ogudu', 6.5709, 3.3987),
('bariga', 6.5344, 3.3911),
('sangotedo', 6.4590, 3.5491),
('ogba', 6.6283, 3.3356),
('allen avenue', 6.5998, 3.3574),
('admiralty way', 6.4474, 3.4733),
('lagos island', 6.4550, 3.3841)
ON CONFLICT (name) DO NOTHING;

-- Comprehensive Pricing RPC
CREATE OR REPLACE FUNCTION get_delivery_quote(
    p_pickup_landmark TEXT,
    p_dropoff_landmark TEXT,
    p_package_size TEXT,
    p_item_value NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    lat1 NUMERIC; lng1 NUMERIC;
    lat2 NUMERIC; lng2 NUMERIC;
    dist NUMERIC;
    price NUMERIC;
    base_price NUMERIC;
    dist_charge NUMERIC;
    per_km NUMERIC;
    ins_fee NUMERIC;
BEGIN
    -- Lookup coordinates
    SELECT lat, lng INTO lat1, lng1 FROM public.landmarks WHERE name = LOWER(p_pickup_landmark);
    SELECT lat, lng INTO lat2, lng2 FROM public.landmarks WHERE name = LOWER(p_dropoff_landmark);
    
    -- Fallback to default if not found
    IF lat1 IS NULL THEN lat1 := 6.5244; lng1 := 3.3792; END IF;
    IF lat2 IS NULL THEN lat2 := 6.5244; lng2 := 3.3792; END IF;
    
    -- Calculate distance
    dist := calculate_distance(lat1, lng1, lat2, lng2);
    
    -- Calculate price
    CASE p_package_size
        WHEN 'small' THEN base_price := 300; per_km := 50;
        WHEN 'medium' THEN base_price := 500; per_km := 80;
        WHEN 'large' THEN base_price := 800; per_km := 120;
        WHEN 'extra_large' THEN base_price := 1200; per_km := 180;
        ELSE base_price := 300; per_km := 50;
    END CASE;
    
    dist_charge := per_km * dist;
    price := GREATEST(base_price + dist_charge, base_price);

    -- Insurance Calculation (1% of item value)
    ins_fee := p_item_value * 0.01;
    
    RETURN jsonb_build_object(
        'price', price,
        'insurance_fee', ins_fee,
        'total_price', price + ins_fee,
        'distance_km', dist,
        'pickup_coords', jsonb_build_array(lat1, lng1),
        'dropoff_coords', jsonb_build_array(lat2, lng2),
        'breakdown', jsonb_build_object(
            'base_price', base_price,
            'distance_charge', dist_charge,
            'insurance_fee', ins_fee
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 8. RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landmarks ENABLE ROW LEVEL SECURITY;

-- Profile Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Secure lookup: Only see profiles of people you are transacting with
DROP POLICY IF EXISTS "View associated profiles on active packages" ON public.profiles;
CREATE POLICY "View associated profiles on active packages" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.packages 
            WHERE (sender_id = auth.uid() AND rider_id = public.profiles.id) -- Sender seeing Rider
            OR (rider_id = auth.uid() AND sender_id = public.profiles.id)  -- Rider seeing Sender
            OR (receiver_phone = public.profiles.phone AND (sender_id = auth.uid() OR rider_id = auth.uid())) -- Parties seeing registered Receiver
        )
    );

-- Trigger to prevent users from escalating privileges or falsifying money via API
CREATE OR REPLACE FUNCTION public.protect_secure_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Forces these fields to remain unchanged during direct API updates
    NEW.role = OLD.role;
    NEW.wallet_balance = OLD.wallet_balance;
    NEW.pending_balance = OLD.pending_balance;
    NEW.rider_rating = OLD.rider_rating;
    NEW.total_deliveries = OLD.total_deliveries;
    NEW.total_earnings = OLD.total_earnings;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS secure_profile_update ON public.profiles;
CREATE TRIGGER secure_profile_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    -- Only restrict direct frontend API updates. Internal RPCs (SECURITY DEFINER) run as postgres and bypass this.
    WHEN (current_user IN ('authenticated', 'anon'))
    EXECUTE FUNCTION public.protect_secure_profile_fields();

DROP POLICY IF EXISTS "Riders can see available packages" ON public.packages;
CREATE POLICY "Riders can see available packages" ON public.packages
    FOR SELECT USING (status = 'searching_rider' OR sender_id = auth.uid() OR rider_id = auth.uid());

DROP POLICY IF EXISTS "Senders can create packages" ON public.packages;
CREATE POLICY "Senders can create packages" ON public.packages
    FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own packages" ON public.packages;
CREATE POLICY "Users can view their own packages" ON public.packages
    FOR SELECT USING (sender_id = auth.uid() OR rider_id = auth.uid());

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can only view their own transactions" 
ON public.wallet_transactions 
FOR SELECT 
USING (user_id = auth.uid());

-- Hard Block direct DML from frontend
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM anon;

DROP POLICY IF EXISTS "Deny inserts" ON public.wallet_transactions;
CREATE POLICY "Deny inserts" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Deny updates" ON public.wallet_transactions;
CREATE POLICY "Deny updates" ON public.wallet_transactions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Deny deletes" ON public.wallet_transactions;
CREATE POLICY "Deny deletes" ON public.wallet_transactions FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "Allow public read-access to landmarks" ON public.landmarks;
CREATE POLICY "Allow public read-access to landmarks" ON public.landmarks
    FOR SELECT USING (true);

-- External topup removed for security (Use initialize-payment + verify-paystack)

-- Internal topup (To be called by Edge Functions only)
CREATE OR REPLACE FUNCTION topup_user_wallet_internal(p_user_id UUID, p_amount NUMERIC, p_reference TEXT)
RETURNS NUMERIC AS $$
DECLARE
    new_balance NUMERIC;
BEGIN
    -- Idempotency check: don't credit the same reference twice
    IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE reference = p_reference) THEN
        SELECT wallet_balance INTO new_balance FROM public.profiles WHERE id = p_user_id;
        RETURN new_balance;
    END IF;

    UPDATE public.profiles
    SET wallet_balance = wallet_balance + p_amount
    WHERE id = p_user_id
    RETURNING wallet_balance INTO new_balance;
    
    INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference, status)
    VALUES (p_user_id, p_amount, 'topup', 'Paystack Top-up', p_reference, 'success')
    ON CONFLICT (reference) DO NOTHING;
    
    RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NEW: Sender-Authorized Payment (Moves status to searching_rider immediately)
CREATE OR REPLACE FUNCTION pay_for_package(p_package_id UUID)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
    sender RECORD;
    otp TEXT;
BEGIN
    -- Fetch package
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;
    
    -- Verify ownership
    IF pkg.sender_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF pkg.status != 'pending_receiver' AND pkg.status != 'insufficient_funds' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package already paid or in progress');
    END IF;
    
    -- Fetch sender profile
    SELECT * INTO sender FROM public.profiles WHERE id = pkg.sender_id;
    IF sender.wallet_balance < pkg.price THEN
        UPDATE public.packages SET status = 'insufficient_funds' WHERE id = p_package_id;
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;
    
    -- Generate OTP (4 digits)
    otp := (floor(random() * 9000) + 1000)::text;

    -- Deduct from sender
    UPDATE public.profiles SET wallet_balance = wallet_balance - pkg.price WHERE id = pkg.sender_id;
    
    -- Record transaction
    INSERT INTO public.wallet_transactions (user_id, amount, type, description, package_id)
    VALUES (pkg.sender_id, -pkg.price, 'delivery_payment', 'Payment for package delivery', p_package_id);
    
    -- Update package
    UPDATE public.packages SET 
        status = 'searching_rider', 
        delivery_otp = otp,
        updated_at = NOW() 
    WHERE id = p_package_id;

    -- MOCK SMS: Log a message to the receiver
    INSERT INTO public.sms_logs (phone, message)
    VALUES (pkg.receiver_phone, 'Pick-Am: A package is coming for you! Tracking ID: ' || (p_package_id::text) || '. Give this PIN to the rider on delivery: ' || otp);
    
    RETURN jsonb_build_object('success', true, 'otp', otp);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION respond_to_package(p_package_id UUID, p_action TEXT)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
    sender RECORD;
    new_status package_status;
BEGIN
    -- Fetch package
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;
    
    IF pkg.status != 'pending_receiver' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package is not pending receiver confirmation');
    END IF;
    
    IF p_action = 'accept' THEN
        -- Fetch sender profile
        SELECT * INTO sender FROM public.profiles WHERE id = pkg.sender_id;
        IF sender.wallet_balance < pkg.price THEN
            UPDATE public.packages SET status = 'insufficient_funds', updated_at = NOW() WHERE id = p_package_id;
            RETURN jsonb_build_object('success', false, 'error', 'Sender has insufficient funds');
        END IF;
        
        -- Deduct from sender
        UPDATE public.profiles SET wallet_balance = wallet_balance - pkg.price WHERE id = pkg.sender_id;
        
        -- Record transaction
        INSERT INTO public.wallet_transactions (user_id, amount, type, description, package_id)
        VALUES (pkg.sender_id, -pkg.price, 'delivery_payment', 'Payment for package delivery', p_package_id);
        
        new_status := 'searching_rider';
    ELSIF p_action = 'reject' THEN
        new_status := 'rejected';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
    END IF;
    
    -- Update package
    UPDATE public.packages SET status = new_status, updated_at = NOW() WHERE id = p_package_id;
    
    RETURN jsonb_build_object('success', true, 'status', new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_package(p_package_id UUID)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
BEGIN
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;

    IF pkg.sender_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    -- Can only cancel if no rider is assigned yet
    IF pkg.status NOT IN ('pending_receiver', 'searching_rider', 'insufficient_funds') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel after a rider has been assigned');
    END IF;

    -- If a payment was made (searching_rider), refund the sender
    IF pkg.status = 'searching_rider' THEN
        UPDATE public.profiles SET wallet_balance = wallet_balance + pkg.price WHERE id = pkg.sender_id;
        
        INSERT INTO public.wallet_transactions (user_id, amount, type, description, package_id)
        VALUES (pkg.sender_id, pkg.price, 'topup', 'Refund for cancelled delivery', p_package_id);
    END IF;

    UPDATE public.packages SET status = 'cancelled', updated_at = NOW() WHERE id = p_package_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION accept_job(p_package_id UUID)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
    active_count INT;
BEGIN
    -- Check if rider is already busy
    SELECT COUNT(*) INTO active_count FROM public.packages 
    WHERE rider_id = auth.uid() 
    AND status IN ('rider_assigned', 'picked_up', 'in_transit');
    
    IF active_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already have an active delivery');
    END IF;

    -- Fetch and lock package
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;
    
    IF pkg.status != 'searching_rider' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package is no longer available');
    END IF;
    
    -- Assign rider
    UPDATE public.packages 
    SET 
        rider_id = auth.uid(), 
        status = 'rider_assigned', 
        updated_at = NOW() 
    WHERE id = p_package_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_delivery_status(
    p_package_id UUID, 
    p_status package_status,
    p_lat NUMERIC DEFAULT NULL,
    p_lng NUMERIC DEFAULT NULL,
    p_otp TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
    landmark RECORD;
    dist_to_dropoff NUMERIC;
    earning NUMERIC;
BEGIN
    -- Fetch package
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;
    
    -- Verify rider
    IF pkg.rider_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not the assigned rider');
    END IF;

    -- SECURITY: Delivery PIN & Geofence Check
    IF p_status = 'delivered' THEN
        -- 1. Check OTP
        IF pkg.delivery_otp IS NULL OR p_otp IS NULL OR pkg.delivery_otp != p_otp THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid Delivery PIN. Meet the receiver to get the PIN.');
        END IF;

        -- 2. Check Geofence (Must be within 1km of dropoff landmark)
        SELECT * INTO landmark FROM public.landmarks WHERE name = LOWER(pkg.dropoff_landmark);
        IF landmark IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
            dist_to_dropoff := calculate_distance(p_lat, p_lng, landmark.lat, landmark.lng);
            IF dist_to_dropoff > 1.5 THEN -- allowing 1.5km margin for landmark-based addressing
                RETURN jsonb_build_object('success', false, 'error', 'You are too far from the drop-off location (' || dist_to_dropoff || 'km).');
            END IF;
        END IF;
    END IF;

    -- Update package
    UPDATE public.packages 
    SET 
        status = p_status,
        tracking_lat = COALESCE(p_lat, tracking_lat),
        tracking_lng = COALESCE(p_lng, tracking_lng),
        updated_at = NOW(),
        delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END
    WHERE id = p_package_id;

    -- Handle earnings on delivery (Escrow: move to pending_balance first)
    IF p_status = 'delivered' AND pkg.status != 'delivered' THEN
        earning := pkg.price * 0.7; -- Rider gets 70%
        
        -- Update rider profile (Move to pending, NOT wallet balance yet)
        UPDATE public.profiles 
        SET 
            pending_balance = pending_balance + earning,
            total_earnings = total_earnings + earning,
            total_deliveries = total_deliveries + 1
        WHERE id = auth.uid();
        
        -- Record transaction as escrowed (pending for 24h)
        INSERT INTO public.wallet_transactions (user_id, amount, type, description, package_id, status)
        VALUES (auth.uid(), earning, 'delivery_earning', 'Pending earning from delivery (24h escrow)', p_package_id, 'escrow');

        -- MOCK SMS: Log a message to the receiver
        INSERT INTO public.sms_logs (phone, message)
        VALUES (pkg.receiver_phone, 'Pick-Am: Your package (' || pkg.item_description || ') has been delivered successfully. Thank you for using Pick-Am!');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NEW: Release Escrow Funds (Can be run by a cron job or manual trigger)
CREATE OR REPLACE FUNCTION release_escrow_funds()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    -- Look for transactions in escrow that are older than 24 hours
    FOR r IN 
        SELECT id, user_id, amount 
        FROM public.wallet_transactions 
        WHERE status = 'escrow' 
        AND created_at < NOW() - INTERVAL '24 hours'
    LOOP
        -- Move funds to wallet balance
        UPDATE public.profiles 
        SET 
            wallet_balance = wallet_balance + r.amount,
            pending_balance = pending_balance - r.amount
        WHERE id = r.user_id;

        -- Mark transaction as success
        UPDATE public.wallet_transactions 
        SET status = 'success' 
        WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NEW: Manual Escrow Release (Sender/Receiver can clear funds early)
CREATE OR REPLACE FUNCTION release_escrow_now(p_package_id UUID)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
    earning NUMERIC;
BEGIN
    -- Fetch package and lock for update
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;

    -- Only sender can release funds early (or receiver if we want)
    IF pkg.sender_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to release funds');
    END IF;

    IF pkg.status != 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package must be delivered to release funds');
    END IF;

    IF pkg.is_disputed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot release funds for a disputed package. Please resolve the dispute first.');
    END IF;

    -- Find the escrow transaction
    -- Note: We look for 'escrow' status
    IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE package_id = p_package_id AND status = 'escrow') THEN
        RETURN jsonb_build_object('success', false, 'error', 'No funds in escrow or already released');
    END IF;

    -- Calculate earning (same as in update_delivery_status)
    earning := pkg.price * 0.7;

    -- Move money
    UPDATE public.profiles 
    SET 
        wallet_balance = wallet_balance + earning,
        pending_balance = pending_balance - earning
    WHERE id = pkg.rider_id;

    -- Finalize transaction status
    UPDATE public.wallet_transactions 
    SET status = 'success' 
    WHERE package_id = p_package_id AND status = 'escrow';

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NEW: File a Dispute
CREATE OR REPLACE FUNCTION dispute_package(p_package_id UUID, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
BEGIN
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;

    -- Only sender can dispute (or receiver)
    IF pkg.sender_id != auth.uid() AND pkg.receiver_phone != (SELECT phone FROM public.profiles WHERE id = auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to dispute this package');
    END IF;

    IF pkg.status != 'delivered' AND pkg.status != 'picked_up' AND pkg.status != 'in_transit' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Can only dispute packages that are in progress or delivered');
    END IF;

    UPDATE public.packages 
    SET 
        is_disputed = TRUE,
        dispute_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_package_id;

    -- Record in transactions if we want, or just let the flag block the release
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION rate_rider(p_package_id UUID, p_rating INT, p_comment TEXT)
RETURNS JSONB AS $$
DECLARE
    pkg RECORD;
BEGIN
    -- Fetch package to get rider and sender info
    SELECT * INTO pkg FROM public.packages WHERE id = p_package_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found');
    END IF;
    
    -- Verify authority (Only sender or receiver if we want, but usually sender rates rider)
    -- The frontend uses it on TrackingPage which is mainly for sender
    IF pkg.sender_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the sender can rate the rider');
    END IF;
    
    IF pkg.status != 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot rate a rider before delivery');
    END IF;

    -- Insert rating (Trigger on_rating_created will handle profile and package updates)
    INSERT INTO public.ratings (package_id, rider_id, sender_id, rating, comment)
    VALUES (p_package_id, pkg.rider_id, pkg.sender_id, p_rating, p_comment)
    ON CONFLICT (package_id) DO UPDATE SET 
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Realtime Activation
-- Enable realtime for packages and profiles to support live tracking and updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.packages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;


