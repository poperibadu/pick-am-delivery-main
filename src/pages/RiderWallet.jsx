import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Wallet as WalletIcon, ArrowUp, ArrowDown,
  Motorcycle
} from '@phosphor-icons/react';

export default function RiderWallet() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: profile, error: pError } = await supabase
          .from('profiles')
          .select('wallet_balance, pending_balance')
          .single();
        
        if (pError) throw pError;
        setBalance(profile.wallet_balance);
        setPendingBalance(profile.pending_balance);

        const { data: txs, error: tError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (tError) throw tError;
        setTransactions(txs);
      } catch (err) {
        console.error('Error fetching rider wallet:', err);
      }
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#0A0A0A] text-white sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button data-testid="back-from-rider-wallet" onClick={() => navigate('/rider')} className="text-white/60 hover:text-white">
            <ArrowLeft size={20} weight="bold" />
          </button>
          <span className="text-sm font-semibold">Earnings & Wallet</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Balance */}
        <div className="bg-[#0A0A0A] text-white p-8 mb-4">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-white/60 mb-2">Available Balance</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-medium text-white/60">₦</span>
            <span data-testid="rider-wallet-balance" className="text-5xl font-black tracking-tight">
              {Number(balance).toLocaleString()}
            </span>
          </div>
        </div>

        {pendingBalance > 0 && (
          <div data-testid="pending-balance-card" className="bg-[#F4F4F5] border-2 border-dashed border-[#0A0A0A] p-6 mb-8 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#52525B] mb-1">Pending Approval (Escrow)</p>
            <p className="text-3xl font-black text-[#0A0A0A]">₦{Number(pendingBalance).toLocaleString()}</p>
            <p className="text-[10px] text-[#52525B] mt-2">Funds move to Available Balance after 24 hours.</p>
          </div>
        )}

        {/* Transactions */}
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#52525B] mb-4">Transaction History</p>
        {transactions.length === 0 ? (
          <div className="border border-[#E4E4E7] p-8 text-center">
            <WalletIcon size={36} weight="light" className="text-[#E4E4E7] mx-auto mb-3" />
            <p className="text-sm text-[#52525B]">No transactions yet</p>
            <p className="text-xs text-[#52525B] mt-1">Complete deliveries to earn.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                data-testid={`rider-transaction-${tx.id}`}
                className="border border-[#E4E4E7] p-4 flex items-center justify-between hover:border-[#0A0A0A] transition-colors"
              >
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
                    <p className="text-xs text-[#52525B]">
                      {new Date(tx.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
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
  );
}

