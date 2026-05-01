import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import {
  ArrowLeft, Package as PackageIcon, MapPin, CheckCircle,
  Motorcycle, ArrowRight
} from '@phosphor-icons/react';

export default function RiderHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('packages')
          .select('*')
          .eq('rider_id', user.id)
          .eq('status', 'delivered')
          .order('delivered_at', { ascending: false });
        
        if (error) throw error;
        setDeliveries(data);
      } catch (err) {
        console.error('Error fetching rider history:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#0A0A0A] text-white sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-from-rider-history" onClick={() => navigate('/rider')} className="text-white/60 hover:text-white">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <span className="text-sm font-semibold">Delivery History</span>
          <span className="ml-auto text-xs text-white/60">{deliveries.length} completed</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <Motorcycle size={32} className="animate-pulse text-[#52525B] mx-auto" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="border border-[#E4E4E7] p-12 text-center">
            <PackageIcon size={48} weight="light" className="text-[#E4E4E7] mx-auto mb-4" />
            <p className="text-sm text-[#52525B] font-medium">No completed deliveries yet</p>
            <p className="text-xs text-[#52525B] mt-1">Accept your first delivery to get started.</p>
            <Link
              to="/rider"
              className="inline-block mt-4 text-sm font-semibold text-[#0A0A0A] underline underline-offset-4"
            >
              View available jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {deliveries.map((d) => (
              <div
                key={d.id}
                data-testid={`history-delivery-${d.id}`}
                className="border border-[#E4E4E7] p-5 hover:border-[#0A0A0A] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={14} weight="fill" className="text-[#00A859]" />
                      <span className="text-xs font-medium text-[#00A859]">Delivered</span>
                    </div>
                    <p className="text-sm font-semibold text-[#0A0A0A]">{d.item_description}</p>
                  </div>
                  <p className="text-sm font-bold text-[#00A859]">+₦{Number(d.price * 0.7).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#52525B]">
                  <MapPin size={12} weight="bold" />
                  <span>{d.pickup_landmark} → {d.dropoff_landmark}</span>
                </div>
                {d.delivered_at && (
                  <p className="text-xs text-[#52525B] mt-2">
                    {new Date(d.delivered_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

