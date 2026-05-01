import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  ArrowLeft, Package as PackageIcon, MapPin, CheckCircle,
  Clock, Funnel, CalendarBlank, ArrowRight, X
} from '@phosphor-icons/react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_receiver', label: 'Awaiting Receiver' },
  { value: 'searching_rider', label: 'Searching Rider' },
  { value: 'rider_assigned', label: 'Rider Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_COLORS = {
  pending_receiver: 'bg-[#FF5B22]/10 text-[#FF5B22]',
  searching_rider: 'bg-[#FF5B22]/10 text-[#FF5B22]',
  rider_assigned: 'bg-[#002FA7]/10 text-[#002FA7]',
  picked_up: 'bg-[#002FA7]/10 text-[#002FA7]',
  in_transit: 'bg-[#FF5B22]/10 text-[#FF5B22]',
  delivered: 'bg-[#00A859]/10 text-[#00A859]',
  rejected: 'bg-red-50 text-red-600',
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const limit = 15;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('packages')
        .select('*', { count: 'exact' });

      // Role based filtering
      if (user.role === 'rider') {
        query = query.eq('rider_id', user.id);
      } else {
        query = query.or(`sender_id.eq.${user.id},receiver_phone.eq.${user.phone}`);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setPackages(data);
      setTotal(count || 0);
      setTotalPages(Math.ceil((count || 0) / limit));
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, [user, page, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const clearFilters = () => {
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = statusFilter !== 'all' || dateFrom || dateTo;
  const isRider = user?.role === 'rider';
  const backPath = isRider ? '/rider' : '/dashboard';

  return (
    <div className="min-h-screen bg-white">
      <header className={`${isRider ? 'bg-[#0A0A0A] text-white' : 'bg-white text-[#0A0A0A]'} border-b border-[#E4E4E7] sticky top-0 z-50`}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-from-history" onClick={() => navigate(backPath)} className={`${isRider ? 'text-white/60 hover:text-white' : 'text-[#52525B] hover:text-[#0A0A0A]'}`}>
            <ArrowLeft size={20} weight="bold" />
          </button>
          <span className="text-sm font-semibold">Delivery History</span>
          <span className="ml-auto text-xs opacity-60">{total} total</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Filter Toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B]">
            {hasFilters ? 'Filtered Results' : 'All Deliveries'}
          </p>
          <button
            data-testid="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 border transition-colors ${
              showFilters ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-[#E4E4E7] text-[#52525B] hover:border-[#0A0A0A]'
            }`}
          >
            <Funnel size={12} weight="bold" />
            Filters
            {hasFilters && <span className="ml-1 w-1.5 h-1.5 bg-[#FF5B22] rounded-full" />}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div data-testid="filters-panel" className="border border-[#E4E4E7] p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">Status</label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger data-testid="status-filter-select" className="h-10 rounded-none border-[#E4E4E7]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">From Date</label>
                <Input
                  data-testid="date-from-input"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-10 rounded-none border-[#E4E4E7]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#52525B] block mb-1">To Date</label>
                <Input
                  data-testid="date-to-input"
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-10 rounded-none border-[#E4E4E7]"
                />
              </div>
            </div>
            {hasFilters && (
              <button
                data-testid="clear-filters-btn"
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-[#FF5B22] font-medium hover:underline"
              >
                <X size={12} weight="bold" /> Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Package List */}
        {loading ? (
          <div className="py-12 text-center">
            <Clock size={32} className="animate-pulse text-[#52525B] mx-auto" />
          </div>
        ) : packages.length === 0 ? (
          <div className="border border-[#E4E4E7] p-12 text-center">
            <PackageIcon size={48} weight="light" className="text-[#E4E4E7] mx-auto mb-4" />
            <p className="text-sm text-[#52525B] font-medium">{hasFilters ? 'No deliveries match your filters' : 'No delivery history yet'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                data-testid={`history-package-${pkg.id}`}
                onClick={() => navigate(isRider ? `/rider/delivery/${pkg.id}` : `/track/${pkg.id}`)}
                className="w-full text-left border border-[#E4E4E7] p-4 flex items-center justify-between hover:border-[#0A0A0A] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-medium px-2 py-0.5 ${STATUS_COLORS[pkg.status] || 'bg-gray-50 text-gray-600'}`}>
                      {pkg.status?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    {pkg.distance_km > 0 && (
                      <span className="text-[10px] text-[#52525B]">{pkg.distance_km} km</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#0A0A0A] truncate">{pkg.item_description}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={10} weight="bold" className="text-[#52525B]" />
                    <p className="text-xs text-[#52525B] truncate">{pkg.pickup_landmark} → {pkg.dropoff_landmark}</p>
                  </div>
                  <p className="text-xs text-[#52525B] mt-1">
                    {new Date(pkg.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-bold text-[#0A0A0A]">₦{Number(pkg.price).toLocaleString()}</span>
                  <ArrowRight size={14} weight="bold" className="text-[#52525B]" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E4E4E7]">
            <button
              data-testid="prev-page-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="text-sm font-medium text-[#0A0A0A] disabled:opacity-30 hover:underline"
            >
              Previous
            </button>
            <span className="text-xs text-[#52525B]">Page {page} of {totalPages}</span>
            <button
              data-testid="next-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="text-sm font-medium text-[#0A0A0A] disabled:opacity-30 hover:underline"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

