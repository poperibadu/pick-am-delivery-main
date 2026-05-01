import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import supabase from '../lib/supabase';
import { usePackageWebSocket } from '../hooks/useWebSocket';
import RatingModal from '../components/RatingModal';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, Phone, MapPin, CheckCircle, Star,
  Package as PackageIcon, ArrowsClockwise, WifiHigh, WifiSlash,
  HandCoins
} from '@phosphor-icons/react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const riderIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const STATUS_FLOW = ['pending_receiver', 'searching_rider', 'rider_assigned', 'picked_up', 'in_transit', 'delivered'];
const STATUS_LABELS = {
  pending_receiver: 'Waiting for Receiver',
  searching_rider: 'Searching for Rider',
  rider_assigned: 'Rider Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  rejected: 'Rejected',
  insufficient_funds: 'Insufficient Funds',
};
const STATUS_DESCRIPTIONS = {
  pending_receiver: 'The receiver needs to accept this package before we can dispatch.',
  searching_rider: 'Payment verified. Looking for a nearby rider...',
  rider_assigned: 'A rider has been assigned and is heading to the pickup location.',
  picked_up: 'The rider has picked up the package.',
  in_transit: 'Package is on its way to the receiver.',
  delivered: 'Package has been delivered successfully!',
  rejected: 'The receiver has rejected this package.',
  insufficient_funds: 'Insufficient wallet balance. Please top up.',
};

// Component to update map center when tracking changes
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function TrackingPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const hasShownRating = useRef(false);

  const fetchPackage = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*, rider:profiles!rider_id(id, name, phone, rider_rating)')
        .eq('id', packageId)
        .single();
      
      if (error) throw error;
      setPkg(data);
    } catch (err) {
      console.error('Error fetching package:', err);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [packageId, navigate]);

  // WebSocket for real-time updates
  const handleWsUpdate = useCallback((data) => {
    setPkg(prev => {
      if (!prev) return prev;
      // If it's just a location update, merge it
      if (data.tracking_lat && !data.receiver_name) {
        return { ...prev, tracking_lat: data.tracking_lat, tracking_lng: data.tracking_lng, status: data.status || prev.status };
      }
      return { ...prev, ...data };
    });
  }, []);

  const { connected } = usePackageWebSocket(packageId, handleWsUpdate);

  useEffect(() => {
    fetchPackage();
    const interval = setInterval(fetchPackage, connected ? 60000 : 10000);
    return () => clearInterval(interval);
  }, [fetchPackage, connected]);

  // Auto-show rating modal when delivered and not yet rated
  useEffect(() => {
    if (pkg?.status === 'delivered' && pkg?.rider && !pkg?.rider_rated && !hasShownRating.current) {
      hasShownRating.current = true;
      setTimeout(() => setShowRating(true), 1000);
    }
  }, [pkg?.status, pkg?.rider, pkg?.rider_rated]);

  const handleReleaseFunds = async () => {
    if (!window.confirm('Release funds to rider now? Only do this if you have received the package and are satisfied.')) return;
    try {
      const { data, error } = await supabase.rpc('release_escrow_now', { p_package_id: packageId });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      alert('Funds released successfully!');
      fetchPackage();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleDispute = async () => {
    const reason = window.prompt('Why are you disputing this delivery? (e.g. Item damaged, incomplete delivery)');
    if (!reason) return;
    
    try {
      const { data, error } = await supabase.rpc('dispute_package', { 
        p_package_id: packageId,
        p_reason: reason
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      alert('Dispute filed. Our team will review this shortly.');
      fetchPackage();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  if (loading || !pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <ArrowsClockwise size={32} className="animate-spin text-[#52525B]" />
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(pkg.status);
  const showMap = ['rider_assigned', 'picked_up', 'in_transit', 'delivered'].includes(pkg.status);
  const mapCenter = pkg.tracking_lat ? [pkg.tracking_lat, pkg.tracking_lng] : [6.5244, 3.3792];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-[#E4E4E7] sticky top-0 bg-white z-[1000]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-from-tracking" onClick={() => navigate('/dashboard')} className="text-[#52525B] hover:text-[#0A0A0A]">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <span className="text-sm font-semibold text-[#0A0A0A]">Track Package</span>
          <span className="ml-auto">
            {connected ? (
              <span data-testid="ws-connected" className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#00A859] font-medium">
                <WifiHigh size={12} weight="bold" /> Live
              </span>
            ) : (
              <span data-testid="ws-disconnected" className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#52525B] font-medium">
                <WifiSlash size={12} weight="bold" /> Polling
              </span>
            )}
          </span>
        </div>
      </header>

      {showMap && pkg.tracking_lat && (
        <div className="h-[40vh] w-full relative z-0">
          <MapContainer center={mapCenter} zoom={14} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[pkg.tracking_lat, pkg.tracking_lng]} icon={riderIcon}>
              <Popup>Rider Location</Popup>
            </Marker>
            <MapUpdater center={mapCenter} />
          </MapContainer>
        </div>
      )}

      <div className={`flex-1 bg-white ${showMap ? 'border-t-2 border-[#0A0A0A] -mt-2 relative z-10' : ''}`}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Status Progress */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {STATUS_FLOW.map((s, i) => {
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              const isRejected = pkg.status === 'rejected' || pkg.status === 'insufficient_funds';
              return (
                <div key={s} className="flex items-center gap-2 flex-shrink-0">
                  <div
                    data-testid={`status-step-${s}`}
                    className={`w-3 h-3 rounded-full ${isRejected ? 'bg-red-400' : isDone ? 'bg-[#00A859]' : isActive ? 'bg-[#FF5B22]' : 'bg-[#E4E4E7]'}`}
                  />
                  {i < STATUS_FLOW.length - 1 && <div className={`w-6 h-0.5 ${isDone ? 'bg-[#00A859]' : 'bg-[#E4E4E7]'}`} />}
                </div>
              );
            })}
          </div>

          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-1">Current Status</p>
            <h2 data-testid="tracking-status" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A] mb-2">
              {STATUS_LABELS[pkg.status] || pkg.status}
            </h2>
            <p className="text-sm text-[#52525B] leading-relaxed">{STATUS_DESCRIPTIONS[pkg.status]}</p>
          </div>

          {pkg.delivery_otp && pkg.status !== 'delivered' && pkg.status !== 'rejected' && (
            <div data-testid="delivery-pin-section" className="bg-[#F4F4F5] border-2 border-dashed border-[#0A0A0A] p-6 mb-6 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Delivery PIN</p>
              <p className="text-4xl font-black tracking-[0.4em] text-[#0A0A0A] ml-[0.4em]">{pkg.delivery_otp}</p>
              <p className="text-xs text-[#52525B] mt-4 font-medium px-4">
                Share this PIN with the rider <span className="text-[#0A0A0A] font-bold underline">only</span> after you have inspected and received the package.
              </p>
            </div>
          )}

          {pkg.rider && (
            <div className="border border-[#E4E4E7] p-4 mb-6">
              <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-3">Rider</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#0A0A0A]">{pkg.rider.name}</p>
                  <div className="flex items-center gap-1 text-sm text-[#52525B]">
                    <Star size={12} weight="fill" className="text-[#FF5B22]" />
                    <span>{pkg.rider.rating}/5</span>
                  </div>
                </div>
                <a href={`tel:${pkg.rider.phone}`} data-testid="call-rider-btn" className="flex items-center gap-2 bg-[#00A859] text-white px-4 py-2 text-sm font-medium hover:bg-[#00A859]/90 transition-colors">
                  <Phone size={16} weight="bold" /> Call
                </a>
              </div>
            </div>
          )}

          <div className="border border-[#E4E4E7] p-4 mb-6">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-3">Package Details</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <PackageIcon size={16} weight="bold" className="text-[#52525B] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">{pkg.item_description}</p>
                  <p className="text-xs text-[#52525B]">{pkg.package_size} — ₦{Number(pkg.price).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} weight="bold" className="text-[#00A859] mt-0.5" />
                <div>
                  <p className="text-xs text-[#52525B]">Pickup</p>
                  <p className="text-sm font-medium text-[#0A0A0A]">{pkg.pickup_landmark}</p>
                  <p className="text-xs text-[#52525B]">{pkg.pickup_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} weight="bold" className="text-[#FF5B22] mt-0.5" />
                <div>
                  <p className="text-xs text-[#52525B]">Drop-off</p>
                  <p className="text-sm font-medium text-[#0A0A0A]">{pkg.dropoff_landmark}</p>
                  <p className="text-xs text-[#52525B]">{pkg.dropoff_address}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[#E4E4E7] p-4 mb-6">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-3">Receiver</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#0A0A0A]">{pkg.receiver_name}</p>
                <p className="text-sm text-[#52525B]">{pkg.receiver_phone}</p>
              </div>
              <a href={`tel:${pkg.receiver_phone}`} data-testid="call-receiver-btn" className="flex items-center gap-2 border border-[#E4E4E7] text-[#0A0A0A] px-4 py-2 text-sm font-medium hover:border-[#0A0A0A] transition-colors">
                <Phone size={16} weight="bold" /> Call
              </a>
            </div>
          </div>

          {pkg.status === 'delivered' && (
            <div className="text-center py-6">
              <CheckCircle size={48} weight="fill" className="text-[#00A859] mx-auto mb-3" />
              <p className="text-xl font-bold text-[#0A0A0A]">Delivery Complete</p>
              <p className="text-sm text-[#52525B] mt-1">Package delivered successfully</p>
              
              {!pkg.is_disputed ? (
                <div className="mt-4 flex flex-col gap-2 max-w-[200px] mx-auto">
                  <Button
                    data-testid="release-funds-now-btn"
                    onClick={handleReleaseFunds}
                    className="bg-[#00A859] text-white rounded-sm h-11 font-semibold hover:bg-[#00A859]/90"
                  >
                    <HandCoins size={18} weight="bold" className="mr-2" /> Release Funds Now
                  </Button>
                  <button
                    data-testid="dispute-delivery-btn"
                    onClick={handleDispute}
                    className="text-[11px] uppercase tracking-wider font-bold text-[#FF5B22] hover:underline"
                  >
                    Flag/Dispute Delivery
                  </button>
                  <p className="text-[10px] text-[#52525B]">Skip the 24h wait for the rider or report an issue.</p>
                </div>
              ) : (
                <div className="mt-4 p-4 border border-[#FF5B22] bg-[#FF5B22]/5">
                  <p className="text-xs uppercase tracking-widest font-bold text-[#FF5B22] mb-1">Dispute Active</p>
                  <p className="text-sm text-[#0A0A0A] font-medium">Escrow funds are locked until resolution.</p>
                  <p className="text-[11px] text-[#52525B] mt-2 italic">"{pkg.dispute_reason}"</p>
                </div>
              )}

              {pkg.rider && !pkg.rider_rated && (
                <Button
                  data-testid="open-rating-btn"
                  onClick={() => setShowRating(true)}
                  className="mt-6 bg-[#FF5B22] text-white rounded-sm px-6 h-10 font-semibold hover:bg-[#FF5B22]/90 w-full"
                >
                  <Star size={16} weight="fill" className="mr-2" /> Rate Rider
                </Button>
              )}
              {pkg.rider_rated && (
                <div className="mt-3 flex items-center justify-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={18} weight="fill" className={s <= (pkg.rider_rating_given || 0) ? 'text-[#FF5B22]' : 'text-[#E4E4E7]'} />
                  ))}
                  <span className="text-xs text-[#52525B] ml-1">Rated</span>
                </div>
              )}
              <Link to="/dashboard" data-testid="back-to-dashboard-delivered" className="inline-block mt-4 text-sm font-semibold text-[#0A0A0A] underline underline-offset-4">
                Back to Dashboard
              </Link>
            </div>
          )}

          {pkg.status === 'insufficient_funds' && (
            <Link to="/wallet" data-testid="topup-from-tracking" className="block w-full">
              <Button className="w-full h-12 bg-[#FF5B22] text-white rounded-sm font-medium hover:bg-[#FF5B22]/90">
                Top Up Wallet
              </Button>
            </Link>
          )}
        </div>
      </div>

      {showRating && pkg.rider && (
        <RatingModal
          packageId={packageId}
          riderName={pkg.rider.name}
          onClose={() => setShowRating(false)}
          onRated={() => fetchPackage()}
        />
      )}
    </div>
  );
}

