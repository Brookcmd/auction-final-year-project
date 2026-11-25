'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import { Gavel, CheckCircle2, PauseCircle, XCircle, FileCheck, UserPlus } from 'lucide-react';

export default function AuctionManagerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [queue, setQueue] = useState<any[]>([]);
  const [inspectionRequests, setInspectionRequests] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = () => {
    apiRequest('/auctions/governance/queue').then((res) => setQueue(res || [])).catch(() => {});
    apiRequest('/inspections/requests').then((res) => setInspectionRequests(res || [])).catch(() => {});
    apiRequest('/inspections/partners?status=APPROVED')
      .then((res) => {
        setPartners(res || []);
        if (res && res.length > 0) setSelectedPartner(res[0].id);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (
      !isLoading &&
      (!user || (user.role !== 'AUCTION_MANAGER' && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'))
    ) {
      router.push('/login');
      return;
    }
    if (user) loadData();
  }, [user, isLoading, router]);

  const handleGovernanceAction = async (auctionId: string, status: string) => {
    let reason = '';
    if (status === 'REJECTED' || status === 'PAUSED' || status === 'CANCELLED' || status === 'ADDITIONAL_INFO_REQUIRED') {
      reason = prompt(`Enter mandatory governance reason for ${status}:`) || '';
      if (!reason.trim()) return;
    }
    await apiRequest(`/auctions/governance/${auctionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, reason: reason || `Approved/updated to ${status}` }),
    });
    setMsg(`Auction updated to ${status} and logged in Audit Trail.`);
    loadData();
  };

  const handleAssignInspector = async (requestId: string) => {
    if (!selectedPartner) {
      alert('No approved inspection partners available.');
      return;
    }
    await apiRequest(`/inspections/requests/${requestId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: selectedPartner }),
    });
    setMsg('Approved inspection partner assigned.');
    loadData();
  };

  const handleReviewReport = async (reportId: string, decision: 'APPROVED' | 'REJECTED') => {
    await apiRequest(`/inspections/reports/${reportId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ decision, reviewNotes: `Reviewed by Auction Manager (${decision})` }),
    });
    setMsg(`Inspection report ${decision}.`);
    loadData();
  };

  if (isLoading || !user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          Auction Manager Governance Console
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review submitted listings, assign independent inspectors, approve inspection reports, and schedule auctions.
        </p>
      </div>

      {msg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-medium">
          {msg}
        </div>
      )}

      {/* Inspection Requests & Reports */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" /> Inspection Requests & Report Reviews ({inspectionRequests.length})
          </h3>
          {partners.length > 0 && (
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>Assign: {p.companyName}</option>
              ))}
            </select>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {inspectionRequests.map((req) => (
            <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-navy-900">{req.auction?.title}</span>
                <p className="text-slate-500">
                  Category: {req.categoryType} • Status: <strong>{req.status}</strong> • Location: {req.locationAddress}
                </p>
                {req.report && (
                  <p className="text-emerald-700 font-semibold mt-0.5">
                    Report {req.report.reportCode}: Grade {req.report.conditionGrade} ({req.report.adminReviewStatus})
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {req.status === 'REQUESTED' && (
                  <button
                    onClick={() => handleAssignInspector(req.id)}
                    className="bg-navy-900 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Assign Inspector
                  </button>
                )}
                {req.report && req.report.adminReviewStatus === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleReviewReport(req.report.id, 'APPROVED')}
                      className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Approve Report
                    </button>
                    <button
                      onClick={() => handleReviewReport(req.report.id, 'REJECTED')}
                      className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold"
                    >
                      Reject Report
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auction Listing Governance Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-navy-900 text-sm flex items-center gap-2">
            <Gavel className="w-4 h-4 text-blue-600" /> Auction Governance Queue ({queue.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {queue.map((a) => (
            <div key={a.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-navy-900">{a.title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                    {a.status}
                  </span>
                  {a.itemCode && (
                    <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded">{a.itemCode}</span>
                  )}
                </div>
                <p className="text-slate-500">
                  Seller: {a.seller?.profile?.fullName} ({a.seller?.profile?.isKycVerified ? 'KYC Verified' : 'Unverified'}) • Start: {formatETB(a.startingPrice)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleGovernanceAction(a.id, 'ACTIVE')}
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                </button>
                <button
                  onClick={() => handleGovernanceAction(a.id, 'PAUSED')}
                  className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <PauseCircle className="w-3.5 h-3.5" /> Pause
                </button>
                <button
                  onClick={() => handleGovernanceAction(a.id, 'REJECTED')}
                  className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <Link href={`/auctions/${a.id}`} className="bg-slate-100 px-3 py-1.5 rounded-lg font-semibold">
                  Inspect
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
