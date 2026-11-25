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
  ShieldCheck,
  FileText,
  Truck,
  AlertTriangle,
  Star,
  Lock,
} from 'lucide-react';

export default function BuyerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'bids' | 'won' | 'deposits' | 'transactions' | 'disputes' | 'watchlist'>('bids');
  const [bids, setBids] = useState<any[]>([]);
  const [wonAuctions, setWonAuctions] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [paymentProvider, setPaymentProvider] = useState<'TELEBIRR' | 'CBE_BIRR'>('TELEBIRR');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Digital Agreement Modal
  const [agreementData, setAgreementData] = useState<any>(null);

  // Delivery Modal
  const [schedulingTxId, setSchedulingTxId] = useState<string | null>(null);
  const [deliveryOption, setDeliveryOption] = useState<'BUYER_COLLECTION' | 'DELIVERY_PARTNER'>('BUYER_COLLECTION');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedDeliveryPartner, setSelectedDeliveryPartner] = useState('');

  // Open Dispute Form
  const [disputeCategory, setDisputeCategory] = useState('ITEM_DIFFERS_FROM_DESCRIPTION');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState('');
  const [disputeTxId, setDisputeTxId] = useState('');
  const [disputeMsgMap, setDisputeMsgMap] = useState<Record<string, string>>({});

  // Rating Form
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({});

  const loadAll = () => {
    Promise.all([
      apiRequest('/auctions/buyer/my-bids').catch(() => []),
      apiRequest('/auctions/buyer/won-auctions').catch(() => []),
      apiRequest('/bid-security/my-deposits').catch(() => []),
      apiRequest('/auctions/buyer/watchlist').catch(() => []),
      apiRequest('/transactions').catch(() => []),
      apiRequest('/disputes/my').catch(() => []),
      apiRequest('/transactions/delivery-partners').catch(() => []),
    ]).then(([bidsRes, wonRes, depRes, watchRes, txRes, dispRes, dpRes]) => {
      setBids(bidsRes || []);
      setWonAuctions(wonRes || []);
      setDeposits(depRes || []);
      setWatchlist(watchRes || []);
      setTransactions(txRes || []);
      setDisputes(dispRes || []);
      setDeliveryPartners(dpRes || []);
      if (dpRes && dpRes.length > 0) setSelectedDeliveryPartner(dpRes[0].id);
      setLoadingData(false);
    });
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) loadAll();
  }, [user, isLoading, router]);

  const handleSimulatePayment = async (txId: string) => {
    try {
      await apiRequest(`/transactions/${txId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ provider: paymentProvider }),
      });
      setStatusBanner(`Simulated payment submitted via ${paymentProvider}.`);
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleViewAgreement = async (txId: string) => {
    try {
      const data = await apiRequest(`/transactions/${txId}/agreement`);
      setAgreementData(data);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleScheduleDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingTxId) return;
    try {
      await apiRequest(`/transactions/${schedulingTxId}/delivery`, {
        method: 'POST',
        body: JSON.stringify({
          deliveryOption,
          partnerId: deliveryOption === 'DELIVERY_PARTNER' ? selectedDeliveryPartner : undefined,
          deliveryAddress: deliveryOption === 'DELIVERY_PARTNER' ? deliveryAddress : undefined,
        }),
      });
      setStatusBanner('Delivery / Collection schedule saved.');
      setSchedulingTxId(null);
      loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmDelivery = async (txId: string) => {
    try {
      await apiRequest(`/transactions/${txId}/confirm-delivery`, { method: 'PUT' });
      setStatusBanner('Receipt confirmed and transaction closed.');
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRate = async (txId: string) => {
    const stars = ratingMap[txId] || 5;
    try {
      await apiRequest(`/transactions/${txId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating: stars }),
      });
      setStatusBanner('Thank you for rating this transaction.');
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/disputes', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: disputeTxId || undefined,
          category: disputeCategory,
          reason: disputeReason,
          evidenceUrl: disputeEvidenceUrl || undefined,
        }),
      });
      setStatusBanner('Dispute opened and queued for Support Officer review.');
      setDisputeReason('');
      setDisputeEvidenceUrl('');
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSendDisputeMessage = async (disputeId: string) => {
    const msg = disputeMsgMap[disputeId];
    if (!msg?.trim()) return;
    await apiRequest(`/disputes/${disputeId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: msg }),
    });
    setDisputeMsgMap((prev) => ({ ...prev, [disputeId]: '' }));
    loadAll();
  };

  const handleAppeal = async (disputeId: string) => {
    const reason = prompt('Enter your appeal justification:');
    if (!reason) return;
    await apiRequest(`/disputes/${disputeId}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ appealReason: reason }),
    });
    loadAll();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Buyer Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage live bids, simulated bid security deposits, digital agreements, delivery, and disputes.
          </p>
        </div>
        <Link
          href="/dashboard/profile"
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-navy-900 hover:bg-slate-50 flex items-center gap-2 self-start"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          KYC & Notification Preferences
        </Link>
      </div>

      {statusBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 text-xs sm:text-sm font-semibold">
        {[
          { id: 'bids', label: `Active Bids (${bids.length})`, icon: Gavel },
          { id: 'won', label: `Won (${wonAuctions.length})`, icon: Trophy },
          { id: 'deposits', label: `Bid Security (${deposits.length})`, icon: Lock },
          { id: 'transactions', label: `Transactions (${transactions.length})`, icon: CreditCard },
          { id: 'disputes', label: `Disputes (${disputes.length})`, icon: AlertTriangle },
          { id: 'watchlist', label: `Watchlist (${watchlist.length})`, icon: Heart },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Active Bids */}
      {activeTab === 'bids' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bids.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No active bids yet. <Link href="/auctions" className="text-blue-600 font-semibold">Explore Auctions</Link>
            </div>
          ) : (
            bids.map((b) => (
              <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{b.auction?.category?.name}</span>
                  <span className="text-[10px] font-mono font-bold text-navy-900 bg-slate-100 px-2 py-0.5 rounded">
                    {b.auction?.status}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{b.auction?.title}</h4>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Your Bid</span>
                    <span className="font-bold font-mono text-blue-600">{formatETB(b.amount)}</span>
                  </div>
                  <Link
                    href={`/auctions/${b.auction?.id}`}
                    className="bg-navy-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    Live Room
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Won Auctions */}
      {activeTab === 'won' && (
        <div className="space-y-4">
          {wonAuctions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No won auctions yet.
            </div>
          ) : (
            wonAuctions.map((w) => (
              <div key={w.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">WINNER</span>
                  <h4 className="font-bold text-sm text-slate-900 mt-1">{w.title}</h4>
                  <p className="text-xs text-slate-500 font-mono">Winning Bid: {formatETB(w.currentHighestBid)}</p>
                </div>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Manage Settlement
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Bid Security Deposits */}
      {activeTab === 'deposits' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-amber-50/50 text-xs text-amber-900">
            Simulated Academic Environment: All deposits and refunds shown below are simulated prototype records.
          </div>
          {deposits.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">No bid security deposits recorded.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {deposits.map((d) => (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-navy-900 block">{d.auction?.title}</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Ref: {d.paymentReference || d.id.substring(0, 8)} • Provider: {d.paymentProvider}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-navy-900">{formatETB(d.amount)}</span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Transactions, Agreements, Delivery & Ratings */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No post-auction transactions yet.
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {tx.agreementNumber || tx.id.substring(0, 8).toUpperCase()} • SIMULATED PROTOTYPE
                    </span>
                    <h4 className="font-bold text-sm text-navy-900">{tx.auction?.title}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                      {tx.workflowStatus}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      Delivery: {tx.deliveryStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Winning Amount</span>
                    <span className="font-bold font-mono text-navy-900">{formatETB(tx.finalAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Applied Bid Bond</span>
                    <span className="font-bold font-mono text-emerald-700">{formatETB(tx.appliedDepositETB || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Payment Deadline</span>
                    <span className="font-medium text-slate-700">
                      {tx.paymentDeadline ? new Date(tx.paymentDeadline).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tracking Code</span>
                    <span className="font-mono text-slate-700">{tx.delivery?.trackingCode || 'Not scheduled'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleViewAgreement(tx.id)}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    <FileText className="w-3.5 h-3.5" /> View Digital Agreement
                  </button>

                  {tx.paymentStatus === 'PENDING' && (
                    <>
                      <select
                        value={paymentProvider}
                        onChange={(e: any) => setPaymentProvider(e.target.value)}
                        className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5"
                      >
                        <option value="TELEBIRR">Telebirr (Simulated)</option>
                        <option value="CBE_BIRR">CBE Birr (Simulated)</option>
                      </select>
                      <button
                        onClick={() => handleSimulatePayment(tx.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg"
                      >
                        Submit Simulated Payment
                      </button>
                    </>
                  )}

                  {tx.paymentStatus === 'IN_ESCROW' && !tx.delivery && (
                    <button
                      onClick={() => setSchedulingTxId(tx.id)}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      <Truck className="w-3.5 h-3.5" /> Schedule Collection / Delivery
                    </button>
                  )}

                  {tx.paymentStatus === 'IN_ESCROW' && (
                    <button
                      onClick={() => handleConfirmDelivery(tx.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg"
                    >
                      Confirm Receipt & Complete
                    </button>
                  )}

                  {tx.workflowStatus === 'COMPLETED' && !tx.buyerRating && (
                    <div className="flex items-center gap-2 ml-auto">
                      <select
                        value={ratingMap[tx.id] || 5}
                        onChange={(e) => setRatingMap({ ...ratingMap, [tx.id]: Number(e.target.value) })}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                      >
                        {[5, 4, 3, 2, 1].map((s) => (
                          <option key={s} value={s}>{s} Stars</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRate(tx.id)}
                        className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        <Star className="w-3.5 h-3.5" /> Rate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Disputes */}
      {activeTab === 'disputes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleOpenDispute} className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 self-start">
            <h3 className="font-bold text-navy-900 text-sm">Open New Dispute</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Related Transaction (Optional)</label>
              <select
                value={disputeTxId}
                onChange={(e) => setDisputeTxId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              >
                <option value="">General / Auction Dispute</option>
                {transactions.map((tx) => (
                  <option key={tx.id} value={tx.id}>{tx.agreementNumber || tx.auction?.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={disputeCategory}
                onChange={(e) => setDisputeCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              >
                <option value="ITEM_DIFFERS_FROM_DESCRIPTION">Item differs from description</option>
                <option value="INSPECTION_DISAGREEMENT">Inspection report disagreement</option>
                <option value="SELLER_REFUSES_DELIVERY">Seller refuses delivery</option>
                <option value="PAYMENT_DISAGREEMENT">Payment disagreement</option>
                <option value="DELIVERY_DAMAGE">Delivery damage</option>
                <option value="OTHER">Other complaint</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason & Description</label>
              <textarea
                required
                rows={3}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                placeholder="Describe the issue clearly..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Evidence URL (Optional)</label>
              <input
                type="url"
                value={disputeEvidenceUrl}
                onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                placeholder="https://..."
              />
            </div>
            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs">
              Submit Dispute Case
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {disputes.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
                No disputes filed.
              </div>
            ) : (
              disputes.map((d) => (
                <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-navy-900">{d.disputeCode}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      {d.status}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800">{d.reason}</p>
                  {d.decision && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                      <strong>Officer Decision:</strong> {d.decision}
                    </div>
                  )}
                  <div className="space-y-1 max-h-32 overflow-y-auto bg-slate-50 p-2 rounded-lg">
                    {(d.messages || []).map((m: any) => (
                      <div key={m.id} className="text-[11px]">
                        <strong>{m.sender?.profile?.fullName || m.sender?.email}:</strong> {m.message}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={disputeMsgMap[d.id] || ''}
                      onChange={(e) => setDisputeMsgMap({ ...disputeMsgMap, [d.id]: e.target.value })}
                      placeholder="Reply on timeline..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button
                      onClick={() => handleSendDisputeMessage(d.id)}
                      className="bg-navy-900 text-white px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Send
                    </button>
                    {(d.status === 'RESOLVED' || d.status === 'REJECTED') && (
                      <button
                        onClick={() => handleAppeal(d.id)}
                        className="bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                      >
                        Appeal
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Watchlist */}
      {activeTab === 'watchlist' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {watchlist.map((w) => (
            <div key={w.id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-xs line-clamp-1">{w.title}</h4>
              <p className="text-xs font-mono font-bold text-navy-900">{formatETB(w.currentHighestBid)}</p>
              <Link href={`/auctions/${w.id}`} className="block text-center text-xs font-semibold text-blue-600 hover:underline pt-2">
                View Listing
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Delivery Scheduler Modal */}
      {schedulingTxId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form onSubmit={handleScheduleDelivery} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-navy-900 text-base">Schedule Collection or Delivery</h3>
            <select
              value={deliveryOption}
              onChange={(e: any) => setDeliveryOption(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            >
              <option value="BUYER_COLLECTION">Direct Buyer Collection (ETB 0)</option>
              <option value="DELIVERY_PARTNER">Assigned Delivery Partner (Est. ETB 1,500)</option>
            </select>
            {deliveryOption === 'DELIVERY_PARTNER' && (
              <>
                <select
                  value={selectedDeliveryPartner}
                  onChange={(e) => setSelectedDeliveryPartner(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                >
                  {deliveryPartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.serviceCities})</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery street address..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSchedulingTxId(null)} className="px-4 py-2 text-xs text-slate-500">
                Cancel
              </button>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold">
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Digital Agreement Modal */}
      {agreementData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-navy-900 text-lg">BIDORA Digital Transaction Agreement</h3>
                <span className="text-xs font-mono text-slate-500">{agreementData.agreementNumber}</span>
              </div>
              <button onClick={() => window.print()} className="bg-navy-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                Print / Save PDF
              </button>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium">
              {agreementData.prototypeNotice}
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Buyer</span>
                <strong>{agreementData.buyer.name}</strong> ({agreementData.buyer.email})
              </div>
              <div>
                <span className="text-slate-400 block">Seller</span>
                <strong>{agreementData.seller.name}</strong> ({agreementData.seller.email})
              </div>
              <div>
                <span className="text-slate-400 block">Auction Item</span>
                <strong>{agreementData.auctionTitle}</strong> ({agreementData.itemCode})
              </div>
              <div>
                <span className="text-slate-400 block">Winning Amount (Simulated ETB)</span>
                <strong className="font-mono">{formatETB(agreementData.financials.winningAmount)}</strong>
              </div>
            </div>
            <div className="text-xs space-y-1 border-t border-slate-100 pt-3">
              <strong>Terms & Conditions:</strong>
              <ul className="list-disc pl-5 text-slate-600 space-y-1">
                {agreementData.conditions.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setAgreementData(null)} className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
