'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  FileCheck,
  ScrollText,
  Flag,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<any>({});
  const [fraudFlags, setFraudFlags] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'kyc' | 'logs'>('overview');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const loadAdminData = () => {
    apiRequest('/analytics/overview').then((res) => setStats(res || {})).catch(() => {});
    apiRequest('/analytics/admin/fraud-flags').then((res) => setFraudFlags(res || [])).catch(() => {});
    apiRequest('/users/admin/all').then((res) => setUsersList(res.users || [])).catch(() => {});
    apiRequest('/users/admin/verifications').then((res) => setVerifications(res || [])).catch(() => {});
    apiRequest('/analytics/admin/audit-logs').then((res) => setAuditLogs(res || [])).catch(() => {});
    apiRequest('/analytics/admin/reports').then((res) => setReports(res || [])).catch(() => {});
  };

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login');
      return;
    }

    if (user && user.role === 'ADMIN') {
      loadAdminData();
    }
  }, [user, isLoading, router]);

  const handleRunFraudScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await apiRequest('/analytics/admin/run-scan', { method: 'POST' });
      setScanResult(`AI Scan Complete: Scanned ${res.scannedAuctions} auctions, flagged ${res.flagsGenerated} anomalies for review.`);
      const updatedFlags = await apiRequest('/analytics/admin/fraud-flags');
      setFraudFlags(updatedFlags || []);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleDismissFlag = async (id: string) => {
    await apiRequest(`/analytics/admin/flags/${id}/review`, { method: 'PUT' });
    const updated = await apiRequest('/analytics/admin/fraud-flags');
    setFraudFlags(updated || []);
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await apiRequest(`/users/admin/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    const updatedUsers = await apiRequest('/users/admin/all');
    setUsersList(updatedUsers.users || []);
  };

  const handleReviewKyc = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    await apiRequest(`/users/admin/verification/${requestId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    const updated = await apiRequest('/users/admin/verifications');
    setVerifications(updated || []);
  };

  const handleResolveReport = async (reportId: string, status: string) => {
    await apiRequest(`/analytics/admin/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    const updated = await apiRequest('/analytics/admin/reports');
    setReports(updated || []);
  };

  if (isLoading || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> High Privileges Admin
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Platform Administration & AI Oversight
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor real-time auctions, KYC verification requests, immutable audit logs, and AI fraud detection.
          </p>
        </div>

        <button
          onClick={handleRunFraudScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 bg-navy-900 hover:bg-blue-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5" />
          {scanning ? 'Running AI Scan...' : 'Trigger AI Fraud Detection Scan'}
        </button>
      </div>

      {scanResult && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{scanResult}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Total Registered Users</span>
          <span className="text-2xl font-bold font-mono text-navy-900 block mt-1">{stats.totalUsers || 0}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Active Auctions</span>
          <span className="text-2xl font-bold font-mono text-blue-600 block mt-1">{stats.activeAuctions || 0}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Total Bids Processed</span>
          <span className="text-2xl font-bold font-mono text-navy-900 block mt-1">{stats.totalBids || 0}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Settled Escrow Volume</span>
          <span className="text-xl font-bold font-mono text-emerald-600 block mt-1">{formatETB(stats.settledVolumeETB || 0)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 border-b-2 transition-colors ${
            activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          AI Fraud Flags ({fraudFlags.filter((f) => !f.reviewedByAdmin).length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 border-b-2 transition-colors ${
            activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          User Accounts ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('kyc')}
          className={`pb-3 px-3 border-b-2 transition-colors ${
            activeTab === 'kyc' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          KYC Requests ({verifications.filter((v) => v.status === 'PENDING').length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-3 border-b-2 transition-colors ${
            activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          Audit Logs & Reports ({reports.filter((r) => r.status === 'OPEN').length})
        </button>
      </div>

      {/* Tab: Fraud Flags */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-navy-900 text-sm">AI Bidding Anomaly Alerts</h3>
            <p className="text-[11px] text-slate-500">
              Flags potential rapid bid scripts or alternating pair collusion for administrative inspection.
            </p>
          </div>

          {fraudFlags.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No suspicious activity detected. Platform integrity is clean.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {fraudFlags.map((flag) => (
                <div key={flag.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        {flag.flagType}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Confidence: {(flag.confidenceScore * 100).toFixed(0)}%
                      </span>
                      {flag.reviewedByAdmin && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Reviewed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 font-medium">{flag.explanation}</p>
                    <span className="text-[11px] text-slate-400 block">
                      Target Lot: <strong>{flag.auction?.title}</strong>
                    </span>
                  </div>

                  {!flag.reviewedByAdmin && (
                    <button
                      onClick={() => handleDismissFlag(flag.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg self-start sm:self-auto"
                    >
                      Dismiss / Acknowledge
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {usersList.map((u) => (
              <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{u.profile?.fullName || 'User'}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                      {u.role}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{u.email} • {u.profile?.city}</span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleToggleUserStatus(u.id, u.status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      u.status === 'ACTIVE'
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {u.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: KYC Requests */}
      {activeTab === 'kyc' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-navy-900 text-sm">Identity Verification Queue</h3>
          </div>
          {verifications.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">No KYC verification requests yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {verifications.map((req) => (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy-900">{req.user?.profile?.fullName || req.user?.email}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">
                        {req.idType}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        {req.status}
                      </span>
                    </div>
                    <a
                      href={req.documentFrontUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline text-[11px] block"
                    >
                      Inspect Submitted Document
                    </a>
                  </div>
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReviewKyc(req.id, 'APPROVED')}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReviewKyc(req.id, 'REJECTED')}
                        className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit Logs & Reports */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-navy-900 text-sm">Listing Reports</h3>
            </div>
            {reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No listing reports submitted.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-navy-900">{r.reason}</span>
                      <p className="text-slate-600 text-[11px]">{r.details || 'No extra details'}</p>
                      <span className="text-[10px] text-slate-400">
                        Listing: {r.auction?.title} • Reported by {r.reporter?.email} • Status: {r.status}
                      </span>
                    </div>
                    {r.status === 'OPEN' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveReport(r.id, 'RESOLVED')}
                          className="bg-navy-900 text-white px-3 py-1.5 rounded-lg font-semibold"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleResolveReport(r.id, 'DISMISSED')}
                          className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-semibold"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-navy-900 text-sm">Immutable Audit Trail (Latest 50)</h3>
            </div>
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No audit entries recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-navy-900 bg-slate-100 px-2 py-0.5 rounded mr-2">
                        {log.action}
                      </span>
                      <span className="text-slate-600">
                        {log.entityType} ({log.entityId.substring(0, 8)}) • {log.user?.email || 'System'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
