import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePaystackPayment } from 'react-paystack';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ArrowLeft, Wallet as WalletIcon, ArrowUp, ArrowDown,
  Plus, CurrencyNgn
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

  const config = useMemo(() => ({
    reference: (new Date()).getTime().toString(),
    email: user?.email || 'user@example.com',
    amount: (parseFloat(topupAmount) || 0) * 100, // in kobo
    publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
  }), [user?.email, topupAmount]);

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference) => {
    try {
      setLoading(true);
      // Use internal RPC directly for rapid local testing without edge functions
      const { data, error } = await supabase.rpc('topup_user_wallet_internal', {
        p_user_id: user.id,
        p_amount: parseFloat(topupAmount),
        p_reference: reference.reference
      });

      if (error) {
        throw new Error(error.message);
      }

      await fetchWallet();
      setShowTopup(false);
      setTopupAmount('');
    } catch (err) {
      console.error('Verification failed:', err);
      alert('Payment added but verification failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const onClose = () => {
    setLoading(false);
    console.log('Payment modal closed');
  };

  const handlePaystackTopup = () => {
    const amt = parseFloat(topupAmount);
    if (!amt || amt < 500) {
      alert('Minimum top-up is ₦500');
      return;
    }

    try {
      setLoading(true);
      initializePayment(onSuccess, onClose);
    } catch (err) {
      console.error('Paystack initialization failed:', err);
      setLoading(false);
      alert('Could not open payment gateway. Please check your internet connection.');
    }
  };

  const quickAmounts = [1000, 2000, 5000, 10000];

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

        {/* Top-up Form */}
        {showTopup && (
          <div className="border border-[#E4E4E7] p-6 mb-8">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-4">Add Funds</p>
            
            {/* Quick Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  data-testid={`quick-amount-${amt}`}
                  onClick={() => setTopupAmount(String(amt))}
                  className={`border py-3 text-sm font-medium transition-colors ${
                    topupAmount === String(amt)
                      ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                      : 'border-[#E4E4E7] hover:border-[#0A0A0A]'
                  }`}
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                data-testid="topup-amount-input"
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1 border border-[#E4E4E7] rounded-none h-12"
              />
              <Button
                data-testid="confirm-topup-btn"
                onClick={handlePaystackTopup}
                disabled={loading || !topupAmount}
                className="h-12 px-6 bg-[#00A859] text-white rounded-sm font-medium hover:bg-[#00A859]/90"
              >
                {loading ? 'Processing...' : 'Pay with Paystack'}
              </Button>
            </div>
            <p className="text-xs text-[#52525B] mt-2">Secure payments via Paystack. Minimum ₦500.</p>
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

