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
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = () => {
    apiRequest('/bid-security/admin/deposits').then((res) => setDeposits(res || [])).catch(() => {});
    apiRequest('/transactions/admin/all').then((res) => setTransactions(res || [])).catch(() => {});
    apiRequest('/bid-security/admin/ledger').then((res) => setLedger(res || [])).catch(() => {});
    apiRequest('/bid-security/policies').then((res) => setPolicies(res || [])).catch(() => {});
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
        Prototype Constraint: All figures below reflect simulated ETB deposits and payments for academic evaluation. No real funds are held.
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
          <h3 className="font-bold text-navy-900 text-sm">Active Bid Security Policies ({policies.length})</h3>
          {policies.map((p) => (
            <div key={p.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <strong className="text-navy-900">{p.name}</strong>
              <p className="text-slate-500">{p.depositType} • {formatETB(p.fixedAmountETB)} • Deadline: {p.paymentDeadlineHours}h</p>
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
