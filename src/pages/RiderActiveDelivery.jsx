import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import { useGeolocation } from '../hooks/useGeolocation';
import { usePackageWebSocket } from '../hooks/useWebSocket';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, Phone, MapPin, CheckCircle, Motorcycle,
  Package as PackageIcon, ArrowsClockwise, WifiHigh, WifiSlash,
  Crosshair, NavigationArrow
} from '@phosphor-icons/react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const RIDER_STEPS = {
  rider_assigned: { title: 'Head to Pickup', description: 'Navigate to the pickup location.', action: 'I have Arrived', actionEndpoint: 'arrived', color: '#002FA7' },
  arrived_at_pickup: { title: 'Arrived at Pickup', description: 'Collect the package from the sender.', action: 'Confirm Pickup', actionEndpoint: 'confirm-pickup', color: '#002FA7' },
  picked_up: { title: 'Package Collected', description: 'Start transit to the drop-off location.', action: 'Start Transit', actionEndpoint: 'start-transit', color: '#FF5B22' },
  in_transit: { title: 'In Transit', description: 'Deliver to the receiver at the drop-off landmark.', action: 'Confirm Delivery', actionEndpoint: 'confirm-delivery', color: '#FF5B22' },
  delivered: { title: 'Delivery Complete', description: 'Successfully delivered. Earnings pending escrow.', action: null, color: '#00A859' },
};

function MapUpdater({ center }) {
  const map = useMap();
  const firstUpdate = useRef(true);
  useEffect(() => {
    if (center && firstUpdate.current) {
      map.setView(center, 15);
      firstUpdate.current = false;
    }
  }, [center, map]);
  return null;
}

export default function RiderActiveDelivery() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [otp, setOtp] = useState('');

  // Real geolocation
  const isActive = pkg && ['rider_assigned', 'picked_up', 'in_transit'].includes(pkg.status);
  const { position: geoPos, error: geoError } = useGeolocation(isActive);

  const fetchPackage = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*, sender:profiles!sender_id(name, phone)')
        .eq('id', packageId)
        .single();
      
      if (error) throw error;
      setPkg(data);
    } catch (err) {
      console.error('Error fetching package:', err);
      navigate('/rider');
    } finally {
      setLoading(false);
    }
  }, [packageId, navigate]);

  // WebSocket for real-time updates
  const handleWsUpdate = useCallback((data) => {
    setPkg(prev => prev ? { ...prev, ...data } : prev);
  }, []);
  const { connected } = usePackageWebSocket(packageId, handleWsUpdate);

  useEffect(() => {
    fetchPackage();
    const interval = setInterval(fetchPackage, connected ? 60000 : 10000);
    return () => clearInterval(interval);
  }, [fetchPackage, connected]);

  // Send real GPS location to backend
  const lastSentRef = useRef(0);
  useEffect(() => {
    if (!geoPos || !isActive) return;
    const now = Date.now();
    if (now - lastSentRef.current < 10000) return; // Throttle to 10s
    lastSentRef.current = now;

    supabase.rpc('update_delivery_status', {
      p_package_id: packageId,
      p_status: pkg.status,
      p_lat: geoPos.lat,
      p_lng: geoPos.lng
    }).catch(err => console.error('Location update failed:', err));
  }, [geoPos, isActive, packageId, pkg?.status]);

  const handleAction = async () => {
    const statusMap = {
      'rider_assigned': 'arrived_at_pickup',
      'arrived_at_pickup': 'picked_up',
      'picked_up': 'in_transit',
      'in_transit': 'delivered'
    };
    const nextStatus = statusMap[pkg.status];
    if (!nextStatus) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('update_delivery_status', {
        p_package_id: packageId,
        p_status: nextStatus,
        p_lat: geoPos?.lat,
        p_lng: geoPos?.lng,
        p_otp: nextStatus === 'delivered' ? otp : null
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      fetchPackage();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <ArrowsClockwise size={32} className="animate-spin text-[#52525B]" />
      </div>
    );
  }

  const step = RIDER_STEPS[pkg.status];
  const progressSteps = ['rider_assigned', 'arrived_at_pickup', 'picked_up', 'in_transit', 'delivered'];
  const currentIdx = progressSteps.indexOf(pkg.status);
  const mapCenter = geoPos ? [geoPos.lat, geoPos.lng] : (pkg.tracking ? [pkg.tracking.lat, pkg.tracking.lng] : [6.5244, 3.3792]);
  const markerPos = geoPos ? [geoPos.lat, geoPos.lng] : (pkg.tracking ? [pkg.tracking.lat, pkg.tracking.lng] : [6.5244, 3.3792]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#0A0A0A] text-white sticky top-0 z-[1000]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-from-rider-delivery" onClick={() => navigate('/rider')} className="text-white/60 hover:text-white">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <Motorcycle size={20} weight="bold" />
          <span className="text-sm font-semibold">Active Delivery</span>
          <div className="ml-auto flex items-center gap-2">
            {geoPos && !geoError && (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#00A859] font-medium">
                <Crosshair size={10} weight="bold" /> GPS
              </span>
            )}
            {connected ? (
              <span data-testid="rider-ws-connected" className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#00A859] font-medium">
                <WifiHigh size={10} weight="bold" /> Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40 font-medium">
                <WifiSlash size={10} weight="bold" />
              </span>
            )}
            <span className="text-xs font-bold px-2 py-0.5" style={{ backgroundColor: step?.color || '#52525B' }}>
              {step?.title || pkg.status}
            </span>
          </div>
        </div>
        <div className="flex">
          {progressSteps.map((s, i) => (
            <div key={s} className="flex-1 h-1" style={{ backgroundColor: i <= currentIdx ? (step?.color || '#00A859') : '#333' }} />
          ))}
        </div>
      </header>

      <div className="h-[45vh] w-full relative z-0">
        <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={markerPos}>
            <Popup>{geoPos ? 'Your GPS Location' : 'Estimated Location'}</Popup>
          </Marker>
          <MapUpdater center={mapCenter} />
        </MapContainer>
        {geoError && (
          <div className="absolute bottom-2 left-2 right-2 z-[500] bg-[#FF5B22]/90 text-white text-xs p-2 text-center">
            GPS: {geoError} — Using estimated location
          </div>
        )}
      </div>

      <div className="flex-1 border-t-2 border-[#0A0A0A] relative z-10 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: step?.color || '#52525B' }} />
              <h2 data-testid="rider-step-title" className="text-xl font-bold tracking-tight text-[#0A0A0A]">{step?.title || pkg.status}</h2>
            </div>
            <p className="text-sm text-[#52525B]">{step?.description}</p>
          </div>

          <div className="space-y-3 mb-5">
            <div className={`border p-4 ${['rider_assigned'].includes(pkg.status) ? 'border-[#0A0A0A] border-2' : 'border-[#E4E4E7]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#00A859] rounded-full mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#52525B]">Pickup</p>
                    <p className="text-sm font-semibold text-[#0A0A0A]">{pkg.pickup_landmark}</p>
                    <p className="text-xs text-[#52525B]">{pkg.pickup_address}</p>
                    <p className="text-xs text-[#52525B] mt-1">Sender: {pkg.sender?.name || 'Unknown'}</p>
                  </div>
                </div>
                <a href={`tel:${pkg.sender_phone}`} data-testid="call-sender-btn" className="flex items-center justify-center w-10 h-10 border border-[#E4E4E7] hover:border-[#0A0A0A] transition-colors flex-shrink-0">
                  <Phone size={16} weight="bold" />
                </a>
              </div>
            </div>

            <div className={`border p-4 ${['picked_up', 'in_transit'].includes(pkg.status) ? 'border-[#0A0A0A] border-2' : 'border-[#E4E4E7]'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#FF5B22] rounded-full mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#52525B]">Drop-off</p>
                    <p className="text-sm font-semibold text-[#0A0A0A]">{pkg.dropoff_landmark}</p>
                    <p className="text-xs text-[#52525B]">{pkg.dropoff_address}</p>
                    <p className="text-xs text-[#52525B] mt-1">Receiver: {pkg.receiver_name}</p>
                  </div>
                </div>
                <a href={`tel:${pkg.receiver_phone}`} data-testid="call-receiver-from-rider" className="flex items-center justify-center w-10 h-10 border border-[#E4E4E7] hover:border-[#0A0A0A] transition-colors flex-shrink-0">
                  <Phone size={16} weight="bold" />
                </a>
              </div>
            </div>
          </div>

          <div className="border border-[#E4E4E7] p-4 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PackageIcon size={18} weight="bold" className="text-[#52525B]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">{pkg.item_description}</p>
                  <p className="text-xs text-[#52525B]">{pkg.package_size} package {pkg.insurance_fee > 0 ? '(Insured)' : ''}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-[#00A859]">₦{Number(pkg.price * 0.7).toLocaleString()}</p>
            </div>
            {pkg.notes && <p className="text-xs text-[#52525B] mt-2 italic border-t border-[#E4E4E7] pt-2">Note: {pkg.notes}</p>}
          </div>

          {pkg.status === 'in_transit' && (
            <div className="mb-4 bg-[#F4F4F5] p-4 border border-[#E4E4E7]">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Delivery Verification</p>
              <input
                data-testid="delivery-otp-input"
                type="text"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 4-digit PIN from receiver"
                className="w-full h-12 bg-white border border-[#E4E4E7] text-center text-xl font-bold tracking-[0.5em] focus:outline-none focus:border-[#0A0A0A]"
              />
              <p className="text-[10px] text-[#52525B] mt-2 italic text-center">Ask the receiver for the PIN displayed on their tracking screen.</p>
            </div>
          )}

          {step?.action && (
            <Button
              data-testid="rider-action-btn"
              onClick={handleAction}
              disabled={actionLoading || (pkg.status === 'in_transit' && otp.length !== 4)}
              className="w-full h-14 rounded-sm text-base font-bold text-white shadow-[0_4px_0_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none transition-all"
              style={{ backgroundColor: step.color }}
            >
              {actionLoading ? 'Processing...' : step.action}
            </Button>
          )}

          {pkg.status === 'delivered' && (
            <div className="text-center py-6">
              <CheckCircle size={56} weight="fill" className="text-[#00A859] mx-auto mb-3" />
              <p className="text-2xl font-black tracking-tight text-[#0A0A0A]">Delivery Complete!</p>
              <p className="text-sm text-[#52525B] mt-1 mb-1">Earnings credited to your wallet</p>
              <p className="text-xl font-black text-[#00A859]">+₦{Number(pkg.price * 0.7).toLocaleString()}</p>
              <button data-testid="rider-back-to-dashboard" onClick={() => navigate('/rider')} className="mt-6 text-sm font-semibold text-[#0A0A0A] underline underline-offset-4">
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

