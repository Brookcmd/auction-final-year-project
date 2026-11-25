'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { FileCheck, ShieldCheck, Eye, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function VerificationOfficerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<any[]>([]);
  const [inspectedDoc, setInspectedDoc] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadQueue = () => {
    apiRequest('/users/admin/verifications')
      .then((res) => setApplications(res || []))
      .catch(() => {});
  };

  useEffect(() => {
    if (
      !isLoading &&
      (!user ||
        (user.role !== 'VERIFICATION_OFFICER' &&
          user.role !== 'SUPER_ADMIN' &&
          user.role !== 'ADMIN'))
    ) {
      router.push('/login');
      return;
    }
    if (user) loadQueue();
  }, [user, isLoading, router]);

  const handleInspectDocs = async (id: string) => {
    const res = await apiRequest(`/users/admin/verification/${id}/documents`);
    setInspectedDoc(res);
  };

  const handleReview = async (id: string, status: 'VERIFIED' | 'REJECTED' | 'ADDITIONAL_INFO_REQUIRED') => {
    let notes = '';
    if (status !== 'VERIFIED') {
      notes = prompt(`Enter required reviewer note for ${status}:`) || '';
      if (!notes.trim()) return;
    }
    await apiRequest(`/users/admin/verification/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, reviewerNotes: notes || 'Verified by Verification Officer' }),
    });
    setMsg(`Application updated to ${status}.`);
    setInspectedDoc(null);
    loadQueue();
  };

  if (isLoading || !user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          Verification Officer Console
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Inspect confidential buyer & seller identity submissions (all document views are logged).
        </p>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {msg}
        </div>
      )}

      {inspectedDoc && (
        <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-md space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-navy-900 text-sm">
              Document Inspection (Access Logged) — {inspectedDoc.legalName || inspectedDoc.user?.email}
            </h3>
            <button onClick={() => setInspectedDoc(null)} className="text-slate-400 hover:text-slate-700">
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><span className="text-slate-400 block">Applicant Type</span><strong>{inspectedDoc.applicantType}</strong></div>
            <div><span className="text-slate-400 block">ID Type</span><strong>{inspectedDoc.idType}</strong></div>
            <div><span className="text-slate-400 block">ID Number</span><strong className="font-mono">{inspectedDoc.idNumber || 'N/A'}</strong></div>
            {inspectedDoc.businessName && (
              <div><span className="text-slate-400 block">Business Name</span><strong>{inspectedDoc.businessName}</strong></div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={inspectedDoc.documentFrontUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">
              View Identity Document Front
            </a>
            {inspectedDoc.documentBackUrl && (
              <a href={inspectedDoc.documentBackUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">
                View Identity Document Back
              </a>
            )}
            {inspectedDoc.businessDocUrl && (
              <a href={inspectedDoc.businessDocUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">
                View Business Registration
              </a>
            )}
          </div>
          <p className="text-[11px] text-slate-400 italic">{inspectedDoc.retentionPolicy}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-navy-900 text-sm">Identity Verification Applications ({applications.length})</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {applications.map((app) => (
            <div key={app.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy-900 text-sm">
                    {app.legalName || app.user?.profile?.fullName || app.user?.email}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px]">{app.applicantType}</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px]">
                    {app.status}
                  </span>
                </div>
                <p className="text-slate-500">
                  {app.user?.email} • {app.idType} • Submitted {new Date(app.submittedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleInspectDocs(app.id)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Inspect Docs
                </button>
                <button
                  onClick={() => handleReview(app.id, 'VERIFIED')}
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  onClick={() => handleReview(app.id, 'ADDITIONAL_INFO_REQUIRED')}
                  className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Request Info
                </button>
                <button
                  onClick={() => handleReview(app.id, 'REJECTED')}
                  className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
