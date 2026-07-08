import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ArrowLeft, Wallet as WalletIcon, ArrowUp, ArrowDown,
  Plus, WarningCircle
} from '@phosphor-icons/react';

export default function WalletPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTopup, setShowTopup] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .single();
      
      if (pError) throw pError;
      setBalance(profile.wallet_balance);

      const { data: txs, error: tError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (tError) throw tError;
      setTransactions(txs);
    } catch (err) {
      console.error('Error fetching wallet:', err);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handlePaystackTopup = () => {
    alert('Payment integration is currently disabled. Paystack will be re-enabled soon.');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[#E4E4E7] sticky top-0 bg-white z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-from-wallet" onClick={() => navigate('/dashboard')} className="text-[#52525B] hover:text-[#0A0A0A]">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <span className="text-sm font-semibold text-[#0A0A0A]">Wallet</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <div className="bg-[#0A0A0A] text-white p-8 mb-8">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-white/60 mb-2">Available Balance</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-medium text-white/60">₦</span>
            <span data-testid="wallet-balance" className="text-5xl font-black tracking-tight">
              {Number(balance).toLocaleString()}
            </span>
          </div>
          <Button
            data-testid="show-topup-btn"
            onClick={() => setShowTopup(!showTopup)}
            className="mt-6 bg-white text-[#0A0A0A] rounded-sm h-12 px-6 font-semibold hover:bg-white/90"
          >
            <Plus size={16} weight="bold" className="mr-2" />
            Add Funds
          </Button>
        </div>

        {/* Top-up Form - DISABLED FOR NOW */}
        {showTopup && (
          <div className="border border-[#FF5B22] bg-[#FF5B22]/5 p-6 mb-8">
            <div className="flex gap-3 items-start">
              <WarningCircle size={20} weight="bold" className="text-[#FF5B22] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#0A0A0A] mb-1">Payment Disabled</p>
                <p className="text-xs text-[#52525B] mb-4">
                  Paystack integration is temporarily disabled while we focus on the booking logic. Real payments will be re-enabled soon.
                </p>
                <Button
                  onClick={() => setShowTopup(false)}
                  className="text-xs h-8 px-3 bg-[#FF5B22] text-white rounded-sm font-medium hover:bg-[#FF5B22]/90"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-4">Transactions</p>
          {transactions.length === 0 ? (
            <div className="border border-[#E4E4E7] p-8 text-center">
              <WalletIcon size={36} weight="light" className="text-[#E4E4E7] mx-auto mb-3" />
              <p className="text-sm text-[#52525B]">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} data-testid={`transaction-${tx.id}`} className="border border-[#E4E4E7] p-4 flex items-center justify-between hover:border-[#0A0A0A] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 flex items-center justify-center ${tx.amount > 0 ? 'bg-[#00A859]/10' : 'bg-[#FF5B22]/10'}`}>
                      {tx.amount > 0 ? (
                        <ArrowDown size={14} weight="bold" className="text-[#00A859]" />
                      ) : (
                        <ArrowUp size={14} weight="bold" className="text-[#FF5B22]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#0A0A0A]">{tx.description}</p>
                      <p className="text-xs text-[#52525B]">{new Date(tx.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-[#00A859]' : 'text-[#FF5B22]'}`}>
                    {tx.amount > 0 ? '+' : ''}₦{Math.abs(tx.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

