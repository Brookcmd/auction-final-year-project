'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import { Lock, CreditCard, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function FinanceOfficerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [deposits, setDeposits] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Create Bid Security Policy Form
  const [policyName, setPolicyName] = useState('');
  const [policyCategoryId, setPolicyCategoryId] = useState('');
  const [depositType, setDepositType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [fixedAmountETB, setFixedAmountETB] = useState(10000);
  const [percentageRate, setPercentageRate] = useState(5);
  const [paymentDeadlineHours, setPaymentDeadlineHours] = useState(72);

  const loadData = () => {
    apiRequest('/bid-security/admin/deposits').then((res) => setDeposits(res || [])).catch(() => {});
    apiRequest('/transactions/admin/all').then((res) => setTransactions(res || [])).catch(() => {});
    apiRequest('/bid-security/admin/ledger').then((res) => setLedger(res || [])).catch(() => {});
    apiRequest('/bid-security/policies').then((res) => setPolicies(res || [])).catch(() => {});
    apiRequest('/categories').then((res) => setCategories(res || [])).catch(() => {});
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/bid-security/policies', {
      method: 'POST',
      body: JSON.stringify({
        name: policyName,
        categoryId: policyCategoryId || undefined,
        depositType,
        fixedAmountETB: Number(fixedAmountETB),
        percentageRate: Number(percentageRate),
        paymentDeadlineHours: Number(paymentDeadlineHours),
      }),
    });
    setMsg(`Created Bid Security Policy "${policyName}".`);
    setPolicyName('');
    loadData();
  };

  useEffect(() => {
    if (
      !isLoading &&
      (!user ||
        (user.role !== 'FINANCE_OFFICER' &&
          user.role !== 'SUPER_ADMIN' &&
          user.role !== 'ADMIN'))
    ) {
      router.push('/login');
      return;
    }
    if (user) loadData();
  }, [user, isLoading, router]);

  const handleRefund = async (depositId: string) => {
    const reason = prompt('Enter authorized refund reason:') || 'Auction closed — non-winner refund';
    await apiRequest(`/bid-security/admin/deposits/${depositId}/refund`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
    setMsg('Simulated refund authorized and recorded in financial ledger.');
    loadData();
  };

  const handleForfeitureDecision = async (depositId: string, decision: 'FORFEITED' | 'REFUNDED') => {
    const reason = prompt(`Enter documented policy reason for ${decision}:`) || '';
    if (!reason.trim()) return;
    await apiRequest(`/bid-security/admin/deposits/${depositId}/forfeiture-decision`, {
      method: 'PUT',
      body: JSON.stringify({ decision, reason }),
    });
    setMsg(`Forfeiture decision (${decision}) recorded in financial ledger.`);
    loadData();
  };

  const handleConfirmTxPayment = async (txId: string) => {
    await apiRequest(`/transactions/${txId}/confirm-payment`, {
      method: 'PUT',
      body: JSON.stringify({ notes: 'Simulated payment verified by Finance Officer' }),
    });
    setMsg('Simulated payment confirmed.');
    loadData();
  };

  if (isLoading || !user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          Finance Officer Console
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Simulated Bid Security Deposits, Refund Authorizations, Forfeiture Reviews, and Transaction Ledger.
        </p>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium">
        Simulated Payment Environment: Deposit and payment figures reflect simulated ETB ledger records until live payment gateway credentials are configured.
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {msg}
        </div>
      )}

      {/* Bid Security Deposits */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-navy-900 text-sm">Bid Security Deposits ({deposits.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {deposits.map((d) => (
            <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-navy-900">{d.buyer?.profile?.fullName || d.buyer?.email}</span> — {d.auction?.title}
                <p className="text-slate-500 font-mono text-[11px]">
                  {formatETB(d.amount)} • {d.paymentProvider} • Ref: {d.paymentReference || 'N/A'} • Status: <strong>{d.status}</strong>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(d.status === 'CONFIRMED' || d.status === 'RESERVED' || d.status === 'REFUND_PENDING') && (
                  <>
                    <button
                      onClick={() => handleRefund(d.id)}
                      className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Process Refund
                    </button>
                    <button
                      onClick={() => handleForfeitureDecision(d.id, 'FORFEITED')}
                      className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Decide Forfeiture
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulated Transactions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-navy-900 text-sm">Simulated Post-Auction Transactions ({transactions.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-mono font-bold text-navy-900">{tx.agreementNumber || tx.id.substring(0, 8)}</span> — {tx.auction?.title}
                <p className="text-slate-500">
                  Buyer: {tx.buyer?.profile?.fullName} • {formatETB(tx.finalAmount)} • Workflow: <strong>{tx.workflowStatus}</strong>
                </p>
              </div>
              {tx.workflowStatus === 'PAYMENT_SUBMITTED' && (
                <button
                  onClick={() => handleConfirmTxPayment(tx.id)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Simulated Payment
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Policies & Ledger Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-navy-900 text-sm">Bid Security Policies ({policies.length})</h3>
          <form onSubmit={handleCreatePolicy} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
            <span className="font-bold text-navy-900 block">Configure New Bid Bond Policy</span>
            <input
              type="text"
              required
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              placeholder="Policy name (e.g. Machinery 5% Bond)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={policyCategoryId}
                onChange={(e) => setPolicyCategoryId(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={depositType}
                onChange={(e: any) => setDepositType(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="FIXED">Fixed ETB</option>
                <option value="PERCENTAGE">Percentage (%)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {depositType === 'FIXED' ? (
                <input
                  type="number"
                  min={100}
                  value={fixedAmountETB}
                  onChange={(e) => setFixedAmountETB(Number(e.target.value))}
                  placeholder="Amount (ETB)"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                />
              ) : (
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={percentageRate}
                  onChange={(e) => setPercentageRate(Number(e.target.value))}
                  placeholder="Rate (%)"
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                />
              )}
              <input
                type="number"
                min={12}
                value={paymentDeadlineHours}
                onChange={(e) => setPaymentDeadlineHours(Number(e.target.value))}
                placeholder="Deadline (Hours)"
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>
            <button type="submit" className="bg-navy-900 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg">
              Create Policy
            </button>
          </form>

          {policies.map((p) => (
            <div key={p.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <strong className="text-navy-900">{p.name}</strong>
              <p className="text-slate-500">
                {p.depositType === 'PERCENTAGE' ? `${p.percentageRate}% (min ${formatETB(p.minDepositETB)})` : formatETB(p.fixedAmountETB)} • Deadline: {p.paymentDeadlineHours}h
              </p>
            </div>
          ))}
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
          <h3 className="font-bold text-navy-900 text-sm">Recent Financial Ledger Entries ({ledger.length})</h3>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
            {ledger.map((l) => (
              <div key={l.id} className="py-2 flex justify-between">
                <div>
                  <span className="font-bold text-navy-900">{l.entryType}</span>
                  <span className="text-slate-400 block text-[10px] font-mono">{l.reference}</span>
                </div>
                <span className="font-mono font-bold text-navy-900">{formatETB(l.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
