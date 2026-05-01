# 🚀 Pick-Am — On-Demand Delivery Platform (Nigeria)

Pick-Am is a full-stack, production-ready on-demand delivery platform built for the Nigerian market. It connects **senders** with **riders** for fast, secure, and trackable package deliveries across Lagos and beyond.

---

## ✨ Features

### For Senders
- 📦 **Smart Delivery Wizard** — Conversational step-by-step package creation flow
- 💰 **Real-Time Pricing** — Distance-based pricing using the Haversine formula
- 🔐 **OTP Delivery Verification** — A 4-digit PIN sent to the receiver ensures only the right person gets the package
- 🗺️ **Live Package Tracking** — Track your rider's location in real time
- 🛡️ **Item Insurance** — Optional 1% insurance on declared item value
- ⚡ **Instant Payment** — Wallet-based payments powered by **Paystack**
- 🚫 **Dispute Filing** — File a dispute which automatically freezes rider earnings

### For Riders
- 📋 **Job Board** — Browse and accept available deliveries
- 📍 **Geofence-Enforced Delivery** — Must be within 1.5km of drop-off to mark as delivered
- 💼 **24-Hour Escrow Earnings** — Earnings are held for 24h before being released to the wallet
- 📊 **Earnings Dashboard** — Track total earnings, pending balance, and delivery history

### Platform
- 🔔 **Automated SMS Notifications** — Via **Twilio** (integrated as Supabase Edge Functions)
- 📱 **Progressive Web App (PWA)** — Installable on Android & iOS
- 🔒 **Row Level Security (RLS)** — Granular, role-based data access at the database level
- 💳 **Fraud-Proof Payments** — Server-side Paystack verification via Edge Functions

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, React Router v7, Tailwind CSS, Shadcn UI |
| **Backend** | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| **Payments** | Paystack (server-side verified) |
| **SMS** | Twilio (via Supabase Edge Functions) |
| **Maps** | Leaflet / OpenStreetMap + Nominatim (reverse geocoding) |
| **Icons** | Phosphor Icons |
| **Build Tool** | Create React App + CRACO |
| **Deployment** | Vercel + Supabase |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js v18+
- A Supabase project
- A Paystack account

### 1. Clone the repository
```bash
git clone https://github.com/poperibadu/Pick-am-ngn.git
cd Pick-am-ngn
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root directory:
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```
> ⚠️ **Never commit your `.env` file.** It is already in `.gitignore`.

### 4. Set up the database
- Open your [Supabase SQL Editor](https://supabase.com/dashboard)
- Run the full contents of `supabase_schema.sql`

### 5. Start the development server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 🏗️ Project Structure

```
src/
├── components/     # Reusable UI components (Shadcn UI)
├── contexts/       # React Contexts (Auth)
├── hooks/          # Custom React hooks
├── lib/            # Supabase client, API helpers, utilities
├── pages/          # All app pages (Dashboard, Wallet, Tracking, etc.)
supabase/
├── functions/      # Supabase Edge Functions (Paystack, Twilio SMS)
plugins/
├── health-check/   # Custom Webpack health check plugin
```

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm start` | Run the app in development mode |
| `npm run build` | Build the app for production |
| `npm test` | Launch the test runner |

---

## 🔐 Security Architecture

- All **sensitive keys** (Paystack Secret, Twilio) live exclusively in Supabase Edge Function Secrets — never in the frontend bundle.
- **RLS policies** prevent users from reading or modifying other users' data.
- A **database trigger** (`protect_secure_profile_fields`) ensures the frontend API can never directly modify `wallet_balance`, `role`, or `rider_rating`.
- **Idempotency checks** on all wallet transactions prevent double-crediting.

---

##  License
📄
This project is private and proprietary.

---

Built with ❤️ for Nigeria 🇳🇬
