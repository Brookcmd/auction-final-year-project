'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import {
  Gavel,
  Trophy,
  Heart,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function BuyerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'bids' | 'won' | 'watchlist' | 'transactions'>('bids');
  const [bids, setBids] = useState<any[]>([]);
  const [wonAuctions, setWonAuctions] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Payment simulation state
  const [payingTxId, setPayingTxId] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'TELEBIRR' | 'CBE_BIRR'>('TELEBIRR');
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      Promise.all([
        apiRequest('/auctions/buyer/my-bids').catch(() => []),
        apiRequest('/auctions/buyer/won-auctions').catch(() => []),
        apiRequest('/auctions/buyer/watchlist').catch(() => []),
        apiRequest('/transactions').catch(() => []),
      ]).then(([bidsRes, wonRes, watchRes, txRes]) => {
        setBids(bidsRes || []);
        setWonAuctions(wonRes || []);
        setWatchlist(watchRes || []);
        setTransactions(txRes || []);
        setLoadingData(false);
      });
    }
  }, [user, isLoading, router]);

  const handleSimulatePayment = async (txId: string) => {
    try {
      await apiRequest(`/transactions/${txId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ provider: paymentProvider }),
      });
      setPaymentSuccess(`Payment simulated via ${paymentProvider}! Funds are safely held in Escrow.`);
      // Refresh transactions
      const updated = await apiRequest('/transactions');
      setTransactions(updated || []);
      setPayingTxId(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleConfirmDelivery = async (txId: string) => {
    try {
      await apiRequest(`/transactions/${txId}/confirm-delivery`, { method: 'PUT' });
      alert('Goods inspection confirmed! Funds released from Escrow to the Seller.');
      const updated = await apiRequest('/transactions');
      setTransactions(updated || []);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (isLoading || loadingData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Buyer Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track your live bids, winning auction transactions, and escrow payments.
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            ETB
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Escrow Balance</span>
            <span className="text-sm font-bold text-navy-900 font-mono">
              {formatETB(user?.profile?.escrowBalanceETB || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab('bids')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'bids'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Gavel className="w-4 h-4" /> My Active Bids ({bids.length})
        </button>
        <button
          onClick={() => setActiveTab('won')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'won'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" /> Won Auctions ({wonAuctions.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-600" /> Escrow Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'watchlist'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-500" /> Watchlist ({watchlist.length})
        </button>
      </div>

      {paymentSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {/* Tab 1: Active Bids */}
      {activeTab === 'bids' && (
        <div className="space-y-4">
          {bids.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Gavel className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-600 font-medium">You haven't placed any bids yet.</p>
              <Link href="/auctions" className="text-xs font-semibold text-blue-600 hover:underline">
                Explore active auctions
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bids.map((b) => (
                <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {b.auction?.category?.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-navy-900 bg-slate-100 px-2 py-0.5 rounded">
                      {b.auction?.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 line-clamp-1">
                    <Link href={`/auctions/${b.auction?.id}`}>{b.auction?.title}</Link>
                  </h4>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Your Latest Bid</span>
                      <span className="font-bold font-mono text-blue-600">{formatETB(b.amount)}</span>
                    </div>
                    <Link
                      href={`/auctions/${b.auction?.id}`}
                      className="bg-navy-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      View Live Room
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Won Auctions */}
      {activeTab === 'won' && (
        <div className="space-y-4">
          {wonAuctions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No won auctions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {wonAuctions.map((w) => (
                <div
                  key={w.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        WINNER
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">{w.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Final winning bid:{' '}
                      <strong className="text-navy-900 font-mono">{formatETB(w.currentHighestBid)}</strong>
                    </p>
                  </div>
                  <Link
                    href={`/auctions/${w.id}`}
                    className="bg-navy-900 text-white text-xs font-semibold px-4 py-2 rounded-xl text-center"
                  >
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Transactions & Escrow Settlement */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400">TX #{tx.id.substring(0, 8).toUpperCase()}</span>
                      <h4 className="font-bold text-sm text-navy-900">{tx.auction?.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          tx.paymentStatus === 'IN_ESCROW'
                            ? 'bg-blue-100 text-blue-700'
                            : tx.paymentStatus === 'RELEASED_TO_SELLER'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {tx.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block">Total Amount</span>
                      <span className="font-bold font-mono text-navy-900">{formatETB(tx.finalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Payment Provider</span>
                      <span className="font-medium text-slate-800">{tx.paymentProvider}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Delivery Status</span>
                      <span className="font-medium text-slate-800">{tx.deliveryStatus}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Reference</span>
                      <span className="font-mono text-[11px] text-slate-600">{tx.paymentReference || 'None'}</span>
                    </div>
                  </div>

                  {/* Escrow Actions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    {tx.paymentStatus === 'PENDING' && (
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select
                          value={paymentProvider}
                          onChange={(e: any) => setPaymentProvider(e.target.value)}
                          className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
                        >
                          <option value="TELEBIRR">Telebirr (Simulated)</option>
                          <option value="CBE_BIRR">CBE Birr (Simulated)</option>
                        </select>
                        <button
                          onClick={() => handleSimulatePayment(tx.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm"
                        >
                          Pay into Escrow
                        </button>
                      </div>
                    )}

                    {tx.paymentStatus === 'IN_ESCROW' && (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Funds safely locked in Escrow. Inspect goods before releasing.
                        </span>
                        <button
                          onClick={() => handleConfirmDelivery(tx.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm"
                        >
                          Confirm & Release Funds to Seller
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Watchlist */}
      {activeTab === 'watchlist' && (
        <div className="space-y-4">
          {watchlist.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Heart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Your watchlist is empty.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {watchlist.map((w) => (
                <div key={w.id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-xs line-clamp-1">{w.title}</h4>
                  <p className="text-xs font-mono font-bold text-navy-900">{formatETB(w.currentHighestBid)}</p>
                  <Link
                    href={`/auctions/${w.id}`}
                    className="block text-center text-xs font-semibold text-blue-600 hover:underline pt-2"
                  >
                    View Listing
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
