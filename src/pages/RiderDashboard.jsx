import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useRiderWebSocket } from '../hooks/useWebSocket';
import { Button } from '../components/ui/button';
import {
  Motorcycle, SignOut, MapPin, Package as PackageIcon,
  ArrowRight, Lightning, Star, Wallet,
  Circle, WifiHigh
} from '@phosphor-icons/react';

export default function RiderDashboard() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [accepting, setAccepting] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch stats
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('wallet_balance, pending_balance, total_deliveries, total_earnings, rider_rating')
        .eq('id', user.id)
        .single();
      
      if (pError) throw pError;
      setStats({
        wallet_balance: profile.wallet_balance,
        pending_balance: profile.pending_balance,
        total_deliveries: profile.total_deliveries,
        total_earnings: profile.total_earnings,
        rating: profile.rider_rating
      });

      // Fetch available jobs
      const { data: jobs, error: jError } = await supabase
        .from('packages')
        .select('*, sender:profiles!sender_id(name)')
        .eq('status', 'searching_rider')
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false });
      
      if (jError) throw jError;
      setAvailableJobs(jobs);

      // Fetch active job
      const { data: active, error: aError } = await supabase
        .from('packages')
        .select('*')
        .eq('rider_id', user.id)
        .in('status', ['rider_assigned', 'picked_up', 'in_transit'])
        .single();
      
      if (aError && aError.code !== 'PGRST116') throw aError; // PGRST116 is 'no rows found'
      setActiveJob(active);
    } catch (err) {
      console.error('Error fetching rider data:', err);
    }
  }, [user]);

  // WebSocket for real-time job updates
  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'package_update' && msg.data) {
      const pkg = msg.data;
      if (pkg.status === 'searching_rider') {
        setAvailableJobs(prev => {
          const exists = prev.some(j => j.id === pkg.id);
          return exists ? prev.map(j => j.id === pkg.id ? pkg : j) : [pkg, ...prev];
        });
      } else {
        setAvailableJobs(prev => prev.filter(j => j.id !== pkg.id));
      }
    }
  }, []);
  const { connected: wsConnected } = useRiderWebSocket(handleWsMessage);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, wsConnected ? 60000 : 10000);
    return () => clearInterval(interval);
  }, [fetchData, wsConnected]);

  const handleAcceptJob = async (packageId) => {
    setAccepting(packageId);
    try {
      const { data, error } = await supabase.rpc('accept_job', { p_package_id: packageId });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      navigate(`/rider/delivery/${packageId}`);
    } catch (err) {
      alert(err.message || 'Failed to accept job');
    } finally {
      setAccepting(null);
    }
  };

  const handleToggleAvailability = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_available: !user.is_available })
        .eq('id', user.id);
      
      if (error) throw error;
      refreshUser();
    } catch (err) {
      console.error('Failed to toggle availability:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      {/* Header */}
      <header className="bg-[#0A0A0A] text-white sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Motorcycle size={28} weight="bold" />
            <span className="text-xl font-black tracking-tighter">Pick-Am Rider</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/rider/wallet" data-testid="rider-nav-wallet" className="flex items-center gap-2 px-3 py-1.5 border border-white/20 hover:border-white/50 transition-colors text-sm">
              <Wallet size={16} weight="bold" />
              <span className="font-semibold">{Number(stats ? (stats.wallet_balance + stats.pending_balance) : 0).toLocaleString()}</span>
            </Link>
            <Button
              data-testid="rider-logout-button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/60 hover:text-white"
            >
              <SignOut size={18} weight="bold" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Greeting + Online Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B]">Rider Mode</p>
            <h1 data-testid="rider-dashboard-heading" className="text-2xl sm:text-3xl font-black tracking-tighter text-[#0A0A0A]">
              {user?.name?.split(' ')[0] || 'Rider'}
            </h1>
          </div>
          <button
            data-testid="toggle-availability-btn"
            onClick={handleToggleAvailability}
            className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm transition-all ${
              user?.is_available !== false
                ? 'bg-[#00A859] text-white'
                : 'bg-[#E4E4E7] text-[#52525B]'
            }`}
          >
            <Circle size={10} weight="fill" className={user?.is_available !== false ? 'text-white' : 'text-[#52525B]'} />
            {user?.is_available !== false ? 'Online' : 'Offline'}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-[#E4E4E7] p-4">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-1">Deliveries</p>
            <p data-testid="rider-total-deliveries" className="text-2xl font-black text-[#0A0A0A]">{stats?.total_deliveries || 0}</p>
          </div>
          <div className="bg-white border border-[#E4E4E7] p-4">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-1">Earnings</p>
            <p data-testid="rider-total-earnings" className="text-2xl font-black text-[#00A859]">{Number(stats?.total_earnings || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white border border-[#E4E4E7] p-4">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-1">Rating</p>
            <p className="text-2xl font-black text-[#FF5B22] flex items-center gap-1">
              {stats?.rating || 5.0}
              <Star size={16} weight="fill" className="text-[#FF5B22]" />
            </p>
          </div>
        </div>

        {/* Active Job Alert */}
        {activeJob && (
          <Link
            to={`/rider/delivery/${activeJob.id}`}
            data-testid="active-job-card"
            className="block bg-[#002FA7] text-white p-5 mb-6 hover:bg-[#002FA7]/90 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-[0.2em] font-medium text-white/70">Active Delivery</span>
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5">{activeJob.status.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <p className="font-semibold mb-1">{activeJob.item_description}</p>
            <div className="flex items-center gap-1 text-sm text-white/70">
              <MapPin size={14} weight="bold" />
              <span>{activeJob.pickup_landmark} → {activeJob.dropoff_landmark}</span>
            </div>
            <div className="flex items-center gap-2 mt-3 text-sm font-medium">
              <span>Continue delivery</span>
              <ArrowRight size={16} weight="bold" />
            </div>
          </Link>
        )}

        {/* Available Jobs */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B]">
            Available Jobs ({availableJobs.length})
          </p>
          {availableJobs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#00A859] font-medium">
              {wsConnected ? <WifiHigh size={12} weight="bold" /> : <Lightning size={12} weight="fill" />}
              {wsConnected ? 'Real-time' : 'Live'}
            </span>
          )}
        </div>

        {availableJobs.length === 0 ? (
          <div className="bg-white border border-[#E4E4E7] p-12 text-center">
            <Motorcycle size={48} weight="light" className="text-[#E4E4E7] mx-auto mb-4" />
            <p className="text-sm text-[#52525B] font-medium">No available deliveries</p>
            <p className="text-xs text-[#52525B] mt-1">Stay online. New requests appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableJobs.map((job) => (
              <div
                key={job.id}
                data-testid={`available-job-${job.id}`}
                className="bg-white border border-[#E4E4E7] hover:border-[#0A0A0A] transition-colors"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0A0A0A]">{job.item_description}</p>
                      <p className="text-xs text-[#52525B] mt-0.5">{job.package_size} package</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-[#0A0A0A]">₦{Number(job.price * 0.7).toLocaleString()}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Your Earning</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#00A859] rounded-full flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-[#52525B]">Pickup</p>
                        <p className="text-sm font-medium text-[#0A0A0A]">{job.pickup_landmark}</p>
                        <p className="text-xs text-[#52525B]">{job.pickup_address}</p>
                      </div>
                    </div>
                    <div className="ml-[3px] w-0.5 h-3 bg-[#E4E4E7]" />
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#FF5B22] rounded-full flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-[#52525B]">Drop-off</p>
                        <p className="text-sm font-medium text-[#0A0A0A]">{job.dropoff_landmark}</p>
                        <p className="text-xs text-[#52525B]">{job.dropoff_address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#52525B] mb-4">
                    <span>From: {job.sender?.name || 'Unknown'}</span>
                    <span>•</span>
                    <span>To: {job.receiver_name}</span>
                  </div>

                  <Button
                    data-testid={`accept-job-btn-${job.id}`}
                    onClick={() => handleAcceptJob(job.id)}
                    disabled={accepting === job.id || !!activeJob}
                    className="w-full h-12 bg-[#00A859] text-white rounded-sm font-semibold text-base hover:bg-[#00A859]/90 disabled:opacity-50"
                  >
                    {accepting === job.id ? 'Accepting...' : activeJob ? 'Complete current delivery first' : 'Accept Delivery'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link
            to="/rider/history"
            data-testid="rider-history-link"
            className="bg-white border border-[#E4E4E7] p-4 flex items-center gap-3 hover:border-[#0A0A0A] transition-colors"
          >
            <PackageIcon size={20} weight="bold" className="text-[#52525B]" />
            <span className="text-sm font-medium">History</span>
          </Link>
          <Link
            to="/rider/wallet"
            data-testid="rider-wallet-link"
            className="bg-white border border-[#E4E4E7] p-4 flex items-center gap-3 hover:border-[#0A0A0A] transition-colors"
          >
            <Wallet size={20} weight="bold" className="text-[#52525B]" />
            <span className="text-sm font-medium">Earnings</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

