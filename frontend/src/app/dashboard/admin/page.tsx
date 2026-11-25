'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  ScrollText,
  Users,
  ClipboardCheck,
  Download,
  UserPlus,
  Settings,
} from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<any>({});
  const [detailed, setDetailed] = useState<any>(null);
  const [fraudFlags, setFraudFlags] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'risk' | 'users' | 'inspectors' | 'staff' | 'logs'>('risk');
  const [scanning, setScanning] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Staff creation form
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('AUCTION_MANAGER');

  const loadAdminData = () => {
    apiRequest('/analytics/overview').then((res) => setStats(res || {})).catch(() => {});
    apiRequest('/analytics/admin/detailed').then((res) => setDetailed(res)).catch(() => {});
    apiRequest('/analytics/admin/fraud-flags').then((res) => setFraudFlags(res || [])).catch(() => {});
    apiRequest('/users/admin/all').then((res) => setUsersList(res.users || [])).catch(() => {});
    apiRequest('/inspections/partners').then((res) => setPartners(res || [])).catch(() => {});
    apiRequest('/analytics/admin/audit-logs').then((res) => setAuditLogs(res || [])).catch(() => {});
    apiRequest('/analytics/admin/settings').then((res) => setSettings(res || [])).catch(() => {});
  };

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'))) {
      router.push('/login');
      return;
    }

    if (user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) {
      loadAdminData();
    }
  }, [user, isLoading, router]);

  const handleRunFraudScan = async () => {
    setScanning(true);
    try {
      const res = await apiRequest('/analytics/admin/run-scan', { method: 'POST' });
      setBanner(`AI Risk Scan Complete: Scanned ${res.scannedAuctions} auctions, flagged ${res.flagsGenerated} anomalies for manual review.`);
      loadAdminData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleDismissFlag = async (id: string) => {
    await apiRequest(`/analytics/admin/flags/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ decision: 'REVIEWED_BY_SUPER_ADMIN' }),
    });
    loadAdminData();
  };

  const handleUserStatus = async (userId: string, status: string) => {
    const reason =
      status === 'ACTIVE'
        ? 'Reactivated by Super Admin'
        : prompt(`Enter mandatory audit reason to ${status} this account:`) || '';
    if (!reason.trim()) return;
    await apiRequest(`/users/admin/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
    setBanner(`Account updated to ${status} and recorded in Audit Log.`);
    loadAdminData();
  };

  const handleReviewPartner = async (partnerId: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    await apiRequest(`/inspections/partners/${partnerId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason: `Partner ${status} by Super Admin` }),
    });
    setBanner(`Inspection partner marked ${status}.`);
    loadAdminData();
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/users/admin/staff', {
      method: 'POST',
      body: JSON.stringify({
        email: staffEmail,
        fullName: staffName,
        password: staffPassword,
        role: staffRole,
      }),
    });
    setBanner(`Staff role ${staffRole} assigned to ${staffEmail}.`);
    setStaffEmail('');
    setStaffName('');
    setStaffPassword('');
    loadAdminData();
  };

  const handleUpdateSetting = async (key: string, currentVal: string) => {
    const value = prompt(`Update setting ${key}:`, currentVal);
    if (value === null) return;
    await apiRequest(`/analytics/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
    loadAdminData();
  };

  if (isLoading || !user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Super Administrator Command Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Centralized Ecosystem Governance & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Oversee users, specialized officers, inspection partners, simulated finances, and audit trails.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRunFraudScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 bg-navy-900 hover:bg-blue-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            {scanning ? 'Scanning...' : 'Run AI Risk Scan'}
          </button>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/analytics/admin/export-csv`}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {/* Specialized Officer Portals Shortcut Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/dashboard/auction-manager" className="p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-xs font-bold text-navy-900">
          Auction Manager Console
        </Link>
        <Link href="/dashboard/verification-officer" className="p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-xs font-bold text-navy-900">
          Verification Officer Console
        </Link>
        <Link href="/dashboard/finance" className="p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-xs font-bold text-navy-900">
          Finance Officer Console
        </Link>
        <Link href="/dashboard/support" className="p-3 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-xs font-bold text-navy-900">
          Support & Disputes Console
        </Link>
      </div>

      {banner && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{banner}</span>
        </div>
      )}

      {/* 12 Platform KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Users', val: stats.totalUsers ?? 0 },
          { label: 'Verified Buyers', val: stats.verifiedBuyers ?? 0 },
          { label: 'Verified Sellers', val: stats.verifiedSellers ?? 0 },
          { label: 'Pending KYC', val: stats.pendingVerifications ?? 0 },
          { label: 'Active Auctions', val: stats.activeAuctions ?? 0 },
          { label: 'Pending Approvals', val: stats.pendingAuctionApprovals ?? 0 },
          { label: 'Completed Auctions', val: stats.completedAuctions ?? 0 },
          { label: 'Simulated Tx Volume', val: formatETB(stats.simulatedTransactionVolumeETB ?? 0) },
          { label: 'Simulated Deposits', val: formatETB(stats.simulatedDepositsTotalETB ?? 0) },
          { label: 'Pending Refunds', val: stats.pendingRefunds ?? 0 },
          { label: 'Active Disputes', val: stats.activeDisputes ?? 0 },
          { label: 'Approved Inspectors', val: stats.approvedInspectors ?? 0 },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] text-slate-400 font-medium block">{kpi.label}</span>
            <span className="text-lg font-bold font-mono text-navy-900 mt-1 block">{kpi.val}</span>
          </div>
        ))}
      </div>

      {/* Category Analytics Bar Chart */}
      {detailed?.byCategory && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-navy-900 text-sm">
              Auctions by Category (Success Rate: {detailed.auctionSuccessRatePercent}%)
            </h3>
            <span className="text-[11px] text-amber-700 font-semibold">Simulated ETB Averages</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {detailed.byCategory.map((c: any) => (
              <div key={c.slug} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="font-bold text-navy-900 block">{c.category}</span>
                <span className="text-slate-500 block">
                  Listings: {c.totalAuctions} • Completed: {c.completedAuctions}
                </span>
                <span className="font-mono font-semibold text-blue-700 block">
                  Avg Win: {formatETB(c.avgWinningPriceETB)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 text-xs sm:text-sm font-semibold">
        {[
          { id: 'risk', label: `AI Risk Flags (${fraudFlags.filter((f) => !f.reviewedByAdmin).length})` },
          { id: 'users', label: `Users & Suspensions (${usersList.length})` },
          { id: 'inspectors', label: `Inspection Partners (${partners.length})` },
          { id: 'staff', label: 'Staff Roles & Settings' },
          { id: 'logs', label: `Immutable Audit Logs (${auditLogs.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`pb-3 px-3 border-b-2 transition-colors ${
              activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Risk Flags */}
      {activeTab === 'risk' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-blue-50/50 border-b border-slate-100 text-[11px] text-slate-600">
            Rule-based AI Risk Engine assists administrators only. Flags never auto-ban accounts and preserve full evidence for human review.
          </div>
          {fraudFlags.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">No risk flags recorded.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {fraudFlags.map((flag) => (
                <div key={flag.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        {flag.flagType} ({flag.severity})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Score: {(flag.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="font-medium text-slate-800">{flag.explanation}</p>
                    <span className="text-[11px] text-slate-400">Lot: {flag.auction?.title}</span>
                  </div>
                  {!flag.reviewedByAdmin && (
                    <button
                      onClick={() => handleDismissFlag(flag.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Mark Reviewed
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {usersList.map((u) => (
            <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{u.profile?.fullName || 'User'}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">{u.role}</span>
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
              <div className="flex gap-2">
                {u.status === 'ACTIVE' ? (
                  <>
                    <button
                      onClick={() => handleUserStatus(u.id, 'SUSPENDED')}
                      className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Suspend
                    </button>
                    <button
                      onClick={() => handleUserStatus(u.id, 'BANNED')}
                      className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Ban
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleUserStatus(u.id, 'ACTIVE')}
                    className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Inspection Partners */}
      {activeTab === 'inspectors' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {partners.map((p) => (
            <div key={p.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-navy-900 text-sm">{p.companyName}</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px]">
                    {p.approvalStatus}
                  </span>
                </div>
                <p className="text-slate-500 mt-0.5">
                  {p.contactName} • {p.serviceLocations} • Categories: {p.supportedCategories}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReviewPartner(p.id, 'APPROVED')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold">
                  Approve
                </button>
                <button onClick={() => handleReviewPartner(p.id, 'SUSPENDED')} className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold">
                  Suspend
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Staff & Settings */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleCreateStaff} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" /> Provision Specialized Staff Role
            </h3>
            <input type="text" required value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Full Name" className="w-full px-3 py-2 rounded-xl border border-slate-300" />
            <input type="email" required value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="Email Address" className="w-full px-3 py-2 rounded-xl border border-slate-300" />
            <input type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="Password (required for new user)" className="w-full px-3 py-2 rounded-xl border border-slate-300" />
            <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300">
              <option value="AUCTION_MANAGER">Auction Manager</option>
              <option value="VERIFICATION_OFFICER">Verification Officer</option>
              <option value="FINANCE_OFFICER">Finance Officer</option>
              <option value="SUPPORT_OFFICER">Support Officer</option>
              <option value="SUPER_ADMIN">Super Administrator</option>
            </select>
            <button type="submit" className="bg-navy-900 text-white font-semibold px-4 py-2 rounded-xl">
              Assign Staff Role
            </button>
          </form>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3 text-xs">
            <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-600" /> Platform Settings
            </h3>
            {settings.map((s) => (
              <div key={s.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-navy-900 block">{s.key}</span>
                  <span className="text-slate-500">{s.description}</span>
                </div>
                <button
                  onClick={() => handleUpdateSetting(s.key, s.value)}
                  className="bg-white border border-slate-200 px-3 py-1 rounded-lg font-mono font-bold text-blue-700"
                >
                  {s.value}
                </button>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            <ChangePasswordCard />
          </div>
        </div>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-navy-900 text-sm">Immutable Audit Trail (Latest 100 Actions)</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-mono font-bold text-navy-900 bg-slate-100 px-2 py-0.5 rounded mr-2">
                    {log.action}
                  </span>
                  <span className="text-slate-700">
                    {log.entityType} ({log.entityId.substring(0, 8)}) • {log.user?.email || 'System'}
                  </span>
                  {log.reason && <span className="block text-[11px] text-slate-500 mt-0.5">Reason: {log.reason}</span>}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
