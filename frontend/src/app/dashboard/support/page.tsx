'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { AlertTriangle, MessageSquare, CheckCircle2, Flag } from 'lucide-react';

export default function SupportOfficerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [disputes, setDisputes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [msgMap, setMsgMap] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const loadData = () => {
    apiRequest('/disputes/admin/all').then((res) => setDisputes(res || [])).catch(() => {});
    apiRequest('/analytics/admin/reports').then((res) => setReports(res || [])).catch(() => {});
  };

  useEffect(() => {
    if (
      !isLoading &&
      (!user ||
        (user.role !== 'SUPPORT_OFFICER' &&
          user.role !== 'SUPER_ADMIN' &&
          user.role !== 'ADMIN'))
    ) {
      router.push('/login');
      return;
    }
    if (user) loadData();
  }, [user, isLoading, router]);

  const handleAssignSelf = async (id: string) => {
    await apiRequest(`/disputes/${id}/assign`, { method: 'PUT', body: JSON.stringify({}) });
    setBanner('Dispute assigned to you and moved to UNDER_REVIEW.');
    loadData();
  };

  const handleDecision = async (id: string, status: 'RESOLVED' | 'ESCALATED' | 'REJECTED') => {
    const decision = prompt(`Enter documented decision for ${status}:`) || '';
    if (!decision.trim()) return;
    await apiRequest(`/disputes/${id}/decision`, {
      method: 'PUT',
      body: JSON.stringify({ status, decision }),
    });
    setBanner(`Dispute decision (${status}) recorded in Audit Log.`);
    loadData();
  };

  const handleSendMsg = async (id: string) => {
    const message = msgMap[id];
    if (!message?.trim()) return;
    await apiRequest(`/disputes/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    setMsgMap({ ...msgMap, [id]: '' });
    loadData();
  };

  const handleResolveReport = async (id: string, status: string) => {
    await apiRequest(`/analytics/admin/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    loadData();
  };

  if (isLoading || !user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          Support Officer & Dispute Resolution Console
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Coordinate active buyer/seller disputes, inspect evidence, record decisions, and handle appeals.
        </p>
      </div>

      {banner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {banner}
        </div>
      )}

      {/* Disputes Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="font-bold text-navy-900 text-sm">Active Disputes & Appeals ({disputes.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {disputes.map((d) => (
            <div key={d.id} className="p-5 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-navy-900 mr-2">{d.disputeCode}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px] mr-2">{d.category}</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                    {d.status}
                  </span>
                  <h4 className="font-bold text-sm text-navy-900 mt-1">{d.reason}</h4>
                  <p className="text-slate-500">
                    Opened by: {d.openedBy?.profile?.fullName || d.openedBy?.email} • Lot: {d.auction?.title || 'N/A'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.status === 'OPEN' && (
                    <button onClick={() => handleAssignSelf(d.id)} className="bg-navy-900 text-white px-3 py-1.5 rounded-lg font-semibold">
                      Assign to Me
                    </button>
                  )}
                  <button onClick={() => handleDecision(d.id, 'RESOLVED')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                  </button>
                  <button onClick={() => handleDecision(d.id, 'ESCALATED')} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold">
                    Escalate
                  </button>
                </div>
              </div>

              {d.appealReason && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
                  <strong>Appeal Reason:</strong> {d.appealReason}
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                {(d.messages || []).length === 0 ? (
                  <span className="text-slate-400">No messages yet.</span>
                ) : (
                  d.messages.map((m: any) => (
                    <div key={m.id}>
                      <strong>{m.sender?.profile?.fullName || m.sender?.email}:</strong> {m.message}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={msgMap[d.id] || ''}
                  onChange={(e) => setMsgMap({ ...msgMap, [d.id]: e.target.value })}
                  placeholder="Write official support response..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
                <button onClick={() => handleSendMsg(d.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Listing Reports */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <Flag className="w-4 h-4 text-rose-600" />
          <h3 className="font-bold text-navy-900 text-sm">Listing Reports ({reports.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {reports.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between text-xs">
              <div>
                <strong>{r.reason}</strong> — {r.auction?.title} ({r.status})
              </div>
              {r.status === 'OPEN' && (
                <div className="flex gap-2">
                  <button onClick={() => handleResolveReport(r.id, 'RESOLVED')} className="bg-navy-900 text-white px-3 py-1 rounded-lg">Resolve</button>
                  <button onClick={() => handleResolveReport(r.id, 'DISMISSED')} className="bg-slate-100 px-3 py-1 rounded-lg">Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
