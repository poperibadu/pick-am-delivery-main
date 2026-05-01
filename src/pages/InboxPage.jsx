import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, Check, X, MapPin, Package as PackageIcon,
  Phone, Tray
} from '@phosphor-icons/react';

export default function InboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchReceived = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*, sender:profiles!sender_id(name)')
        .eq('receiver_phone', user.phone)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPackages(data);
    } catch (err) {
      console.error('Error fetching received packages:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.phone]);

  useEffect(() => {
    fetchReceived();
  }, [fetchReceived]);

  const handleAction = async (packageId, action) => {
    setActionLoading(packageId);
    try {
      const { data, error } = await supabase.rpc('respond_to_package', {
        p_package_id: packageId,
        p_action: action
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      if (action === 'accept') {
        navigate(`/track/${packageId}`);
      } else {
        fetchReceived();
      }
    } catch (err) {
      alert(err.message || 'Action failed');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPackages = packages.filter(p => p.status === 'pending_receiver');
  const otherPackages = packages.filter(p => p.status !== 'pending_receiver');

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#E4E4E7] sticky top-0 bg-white z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-from-inbox" onClick={() => navigate('/dashboard')} className="text-[#52525B] hover:text-[#0A0A0A]">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <span className="text-sm font-semibold text-[#0A0A0A]">Inbox</span>
          {pendingPackages.length > 0 && (
            <span className="bg-[#FF5B22] text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingPackages.length}</span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Pending Section */}
        {pendingPackages.length > 0 && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#FF5B22] mb-4">Pending Confirmation</p>
            <div className="space-y-3">
              {pendingPackages.map(pkg => (
                <div key={pkg.id} data-testid={`inbox-package-${pkg.id}`} className="border-2 border-[#FF5B22] p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0A0A0A]">{pkg.item_description}</p>
                      <p className="text-xs text-[#52525B] mt-1">From: {pkg.sender?.name || 'Unknown Sender'}</p>
                    </div>
                    <span className="text-sm font-bold text-[#0A0A0A]">₦{Number(pkg.price).toLocaleString()}</span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} weight="bold" className="text-[#00A859]" />
                      <span className="text-xs text-[#52525B]">From: {pkg.pickup_landmark}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} weight="bold" className="text-[#FF5B22]" />
                      <span className="text-xs text-[#52525B]">To: {pkg.dropoff_landmark}</span>
                    </div>
                    {pkg.notes && (
                      <p className="text-xs text-[#52525B] italic">Note: {pkg.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      data-testid={`accept-package-${pkg.id}`}
                      onClick={() => handleAction(pkg.id, 'accept')}
                      disabled={actionLoading === pkg.id}
                      className="flex-1 h-11 bg-[#00A859] text-white rounded-sm font-semibold hover:bg-[#00A859]/90"
                    >
                      <Check size={16} weight="bold" className="mr-2" />
                      Accept
                    </Button>
                    <Button
                      data-testid={`reject-package-${pkg.id}`}
                      onClick={() => handleAction(pkg.id, 'reject')}
                      disabled={actionLoading === pkg.id}
                      className="flex-1 h-11 bg-[#0A0A0A] text-white rounded-sm font-semibold hover:bg-[#0A0A0A]/90"
                    >
                      <X size={16} weight="bold" className="mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Packages */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-4">All Received</p>
          {packages.length === 0 ? (
            <div className="border border-[#E4E4E7] p-12 text-center">
              <Tray size={48} weight="light" className="text-[#E4E4E7] mx-auto mb-4" />
              <p className="text-sm text-[#52525B]">No packages received yet</p>
              <p className="text-xs text-[#52525B] mt-1">When someone sends you a package, it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {otherPackages.map(pkg => (
                <Link
                  key={pkg.id}
                  to={`/track/${pkg.id}`}
                  data-testid={`received-package-${pkg.id}`}
                  className="border border-[#E4E4E7] p-4 flex items-center justify-between hover:border-[#0A0A0A] transition-colors block"
                >
                  <div>
                    <p className="text-sm font-medium text-[#0A0A0A]">{pkg.item_description}</p>
                    <p className="text-xs text-[#52525B]">From: {pkg.sender?.name || 'Unknown Sender'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 ${
                    pkg.status === 'delivered' ? 'bg-[#00A859]/10 text-[#00A859]' :
                    pkg.status === 'rejected' ? 'bg-red-50 text-red-600' :
                    'bg-[#FF5B22]/10 text-[#FF5B22]'
                  }`}>
                    {pkg.status.replace(/_/g, ' ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

