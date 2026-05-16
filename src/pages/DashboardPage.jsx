import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useUserWebSocket } from '../hooks/useWebSocket';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Package, PaperPlaneTilt, Wallet, SignOut, Plus,
  ArrowRight, Clock, CheckCircle, MapPin, Tray, WifiHigh, ClockCounterClockwise,
  UserCircle
} from '@phosphor-icons/react';

const STATUS_LABELS = {
  pending_receiver: 'Awaiting Receiver',
  searching_rider: 'Searching Rider',
  rider_assigned: 'Rider Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  rejected: 'Rejected',
  insufficient_funds: 'Low Balance',
};

const STATUS_COLORS = {
  pending_receiver: 'bg-[#FF5B22]/10 text-[#FF5B22] border-[#FF5B22]/20',
  searching_rider: 'bg-[#FF5B22]/10 text-[#FF5B22] border-[#FF5B22]/20',
  rider_assigned: 'bg-[#002FA7]/10 text-[#002FA7] border-[#002FA7]/20',
  picked_up: 'bg-[#002FA7]/10 text-[#002FA7] border-[#002FA7]/20',
  in_transit: 'bg-[#FF5B22]/10 text-[#FF5B22] border-[#FF5B22]/20',
  delivered: 'bg-[#00A859]/10 text-[#00A859] border-[#00A859]/20',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  insufficient_funds: 'bg-red-50 text-red-600 border-red-200',
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [packages, setPackages] = useState([]);
  const [receivedPkgs, setReceivedPkgs] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeTab, setActiveTab] = useState('sent');

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [pkgRes, recvRes, profileRes] = await Promise.all([
        supabase.from('packages').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }),
        supabase.from('packages').select('*').eq('receiver_phone', user.phone).order('created_at', { ascending: false }),
        supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
      ]);

      if (pkgRes.error) throw pkgRes.error;
      if (recvRes.error) throw recvRes.error;
      if (profileRes.error) throw profileRes.error;

      const sentPkgs = pkgRes.data;
      const rcvPkgs = recvRes.data;
      
      setPackages(sentPkgs);
      setReceivedPkgs(rcvPkgs);
      setWalletBalance(profileRes.data.wallet_balance);

      // Calculate stats locally
      setStats({
        total_sent: sentPkgs.length,
        delivered: sentPkgs.filter(p => p.status === 'delivered').length,
        active: sentPkgs.filter(p => !['delivered', 'rejected', 'insufficient_funds'].includes(p.status)).length,
        total_received: rcvPkgs.length,
        pending_received: rcvPkgs.filter(p => p.status === 'pending_receiver').length
      });
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, [user]);

  // WebSocket for real-time package updates
  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'package_update' && msg.data) {
      const updated = msg.data;
      setPackages(prev => {
        const exists = prev.some(p => p.id === updated.id);
        if (exists) return prev.map(p => p.id === updated.id ? { ...p, ...updated } : p);
        if (updated.sender_id === user?.id) return [updated, ...prev];
        return prev;
      });
      setReceivedPkgs(prev => {
        const exists = prev.some(p => p.id === updated.id);
        if (exists) return prev.map(p => p.id === updated.id ? { ...p, ...updated } : p);
        if (updated.receiver_phone === user?.phone) return [updated, ...prev];
        return prev;
      });
    } else if (msg.type === 'profile_update' && msg.data) {
      setWalletBalance(msg.data.wallet_balance);
    }
  }, [user]);
  const { connected: wsConnected } = useUserWebSocket(user?.id, handleWsMessage);

  useEffect(() => {
    fetchData();
    // Reduce polling frequency if WS is connected
    const interval = setInterval(fetchData, wsConnected ? 60000 : 15000);
    return () => clearInterval(interval);
  }, [fetchData, wsConnected]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const pendingReceived = receivedPkgs.filter(p => p.status === 'pending_receiver');
  const displayPackages = activeTab === 'sent' ? packages : receivedPkgs;

  return (
    <div className="min-h-screen bg-[#F4F4F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#E4E4E7] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package size={28} weight="bold" className="text-[#0A0A0A]" />
            <span className="text-xl font-black tracking-tighter text-[#0A0A0A]">Pick-Am</span>
          </div>
          <div className="flex items-center gap-3">
            {wsConnected && (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#00A859] font-medium">
                <WifiHigh size={12} weight="bold" /> Live
              </span>
            )}
            <Link to="/wallet" data-testid="nav-wallet" className="flex items-center gap-2 px-3 py-2 border border-[#E4E4E7] hover:border-[#0A0A0A] transition-colors">
              <Wallet size={18} weight="bold" />
              <span className="text-sm font-semibold">{Number(walletBalance).toLocaleString()}</span>
            </Link>
            <Link to="/profile" data-testid="nav-profile" className="p-2 text-[#52525B] hover:text-[#0A0A0A] transition-colors">
              <UserCircle size={24} weight="bold" />
            </Link>
            <Button
              data-testid="logout-button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-[#52525B] hover:text-[#0A0A0A]"
            >
              <SignOut size={18} weight="bold" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome + Stats */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-1">Logistics Dashboard</p>
          <h1 data-testid="dashboard-heading" className="text-3xl sm:text-4xl font-black tracking-tighter text-[#0A0A0A]">
            Pick-Am Delivery Management
          </h1>
          <p className="text-lg font-bold text-[#52525B] mt-1">Hello, {user?.name?.split(' ')[0] || 'User'}</p>
        </div>

        {/* Quick Stats Grid - Technical Skeleton Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 bg-[#E4E4E7] gap-[1px] border border-[#E4E4E7] mb-8">
          <div className="bg-white p-6 hover:bg-[#F4F4F5] transition-colors">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2 text-blue-800">Sent Tracking</p>
            <p className="text-4xl font-black text-[#0A0A0A] tracking-tighter tabular-nums">{stats?.active || 0}</p>
            <p className="text-[10px] text-[#52525B] mt-1">In progress</p>
          </div>
          <div className="bg-white p-6 hover:bg-[#F4F4F5] transition-colors">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2 text-green-700">Delivered</p>
            <p className="text-4xl font-black text-[#00A859] tracking-tighter tabular-nums">{stats?.delivered || 0}</p>
            <p className="text-[10px] text-[#52525B] mt-1">Successfully completed</p>
          </div>
          <div className="bg-white p-6 hover:bg-[#F4F4F5] transition-colors">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Wallet</p>
            <p className="text-4xl font-black text-[#0A0A0A] tracking-tighter tabular-nums">₦{Math.floor(walletBalance).toLocaleString()}</p>
            <p className="text-[10px] text-[#52525B] mt-1">Available balance</p>
          </div>
          <div className="bg-white p-6 hover:bg-[#F4F4F5] transition-colors relative">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2 text-orange-600">Inbox</p>
            <p className="text-4xl font-black text-[#FF5B22] tracking-tighter tabular-nums">{pendingReceived.length}</p>
            <p className="text-[10px] text-[#52525B] mt-1">Awaiting your response</p>
            {pendingReceived.length > 0 && (
              <span className="absolute top-4 right-4 w-2 h-2 bg-[#FF5B22] rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#E4E4E7] gap-[1px] border border-[#E4E4E7] mb-8">
          <Link
            to="/create-package"
            data-testid="create-package-btn"
            className="bg-[#0A0A0A] text-white p-6 flex flex-col justify-between aspect-square hover:bg-black/90 transition-colors"
          >
            <Plus size={24} weight="bold" />
            <div>
              <span className="text-lg font-black tracking-tighter block">Send Now</span>
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">New Delivery</span>
            </div>
          </Link>
          <Link
            to="/inbox"
            data-testid="inbox-btn"
            className="bg-white p-6 flex flex-col justify-between aspect-square hover:bg-[#F4F4F5] transition-colors"
          >
            <div className="flex justify-between items-start">
              <Tray size={24} weight="bold" />
              {pendingReceived.length > 0 && (
                <span className="bg-[#FF5B22] text-white text-[10px] font-black px-2 py-0.5 rounded-none">{pendingReceived.length}</span>
              )}
            </div>
            <div>
              <span className="text-lg font-black tracking-tighter block text-[#0A0A0A]">Receiver Inbox</span>
              <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold">Pending Approval</span>
            </div>
          </Link>
          <Link
            to="/history"
            data-testid="history-btn"
            className="bg-white p-6 flex flex-col justify-between aspect-square hover:bg-[#F4F4F5] transition-colors"
          >
            <ClockCounterClockwise size={24} weight="bold" />
            <div>
              <span className="text-lg font-black tracking-tighter block text-[#0A0A0A]">History</span>
              <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold">All Deliveries</span>
            </div>
          </Link>
          <Link
            to="/wallet"
            data-testid="topup-wallet-btn"
            className="bg-white p-6 flex flex-col justify-between aspect-square hover:bg-[#F4F4F5] transition-colors"
          >
            <Wallet size={24} weight="bold" />
            <div>
              <span className="text-lg font-black tracking-tighter block text-[#0A0A0A]">Wallet balance</span>
              <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold">Management</span>
            </div>
          </Link>
        </div>

        {/* Package Tabs */}
        <div className="mb-4 flex gap-0 border-b border-[#E4E4E7]">
          <button
            data-testid="tab-sent"
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sent' ? 'border-[#0A0A0A] text-[#0A0A0A]' : 'border-transparent text-[#52525B] hover:text-[#0A0A0A]'
            }`}
          >
            <PaperPlaneTilt size={16} weight="bold" className="inline mr-2" />
            Sent ({packages.length})
          </button>
          <button
            data-testid="tab-received"
            onClick={() => setActiveTab('received')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'received' ? 'border-[#0A0A0A] text-[#0A0A0A]' : 'border-transparent text-[#52525B] hover:text-[#0A0A0A]'
            }`}
          >
            <Tray size={16} weight="bold" className="inline mr-2" />
            Received ({receivedPkgs.length})
          </button>
        </div>

        {/* Package List */}
        <div className="space-y-3">
          {displayPackages.length === 0 ? (
            <div className="bg-white border border-[#E4E4E7] p-12 text-center">
              <Package size={48} weight="light" className="text-[#E4E4E7] mx-auto mb-4" />
              <p className="text-[#52525B] text-sm">No packages yet</p>
            </div>
          ) : (
            displayPackages.map((pkg) => (
              <Link
                key={pkg.id}
                to={`/track/${pkg.id}`}
                data-testid={`package-card-${pkg.id}`}
                className="bg-white border border-[#E4E4E7] p-5 flex items-center justify-between hover:border-[#0A0A0A] hover:-translate-y-0.5 transition-all block"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-medium px-2 py-1 border ${STATUS_COLORS[pkg.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {STATUS_LABELS[pkg.status] || pkg.status}
                    </span>
                    <span className="text-xs text-[#52525B]">{pkg.package_size}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#0A0A0A] truncate">{pkg.item_description}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin size={12} weight="bold" className="text-[#52525B]" />
                    <p className="text-xs text-[#52525B] truncate">
                      {pkg.pickup_landmark} → {pkg.dropoff_landmark}
                      {pkg.distance_km > 0 && <span className="ml-1 text-[#002FA7]">({pkg.distance_km} km)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-sm font-bold text-[#0A0A0A]">{Number(pkg.price).toLocaleString()}</span>
                  <ArrowRight size={16} weight="bold" className="text-[#52525B]" />
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

