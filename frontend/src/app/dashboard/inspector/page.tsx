'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import { FileCheck, CheckCircle2, XCircle, Calendar, ClipboardCheck } from 'lucide-react';

export default function InspectorDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  // Partner registration form
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceLocations, setServiceLocations] = useState('Addis Ababa, Adama');
  const [supportedCategories, setSupportedCategories] = useState('VEHICLES,MACHINERY,ELECTRONICS');
  const [qualifications, setQualifications] = useState('');

  // Report submission form
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [templateFields, setTemplateFields] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<Record<string, string>>({});
  const [conditionGrade, setConditionGrade] = useState('GOOD');
  const [observations, setObservations] = useState('');
  const [defects, setDefects] = useState('');

  const loadDashboard = () => {
    apiRequest('/inspections/partner/dashboard')
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'INSPECTION_PARTNER' && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'))) {
      router.push('/login');
      return;
    }
    if (user) loadDashboard();
  }, [user, isLoading, router]);

  const handleApplyPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/inspections/partners/apply', {
      method: 'POST',
      body: JSON.stringify({
        companyName,
        contactName,
        phone,
        email: user?.email,
        serviceLocations,
        supportedCategories,
        qualifications,
      }),
    });
    setBanner('Inspection partner registration submitted for Super Admin approval.');
    loadDashboard();
  };

  const handleRespond = async (assignmentId: string, accept: boolean) => {
    const scheduledAt = accept ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : undefined;
    await apiRequest(`/inspections/assignments/${assignmentId}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ accept, scheduledAt }),
    });
    setBanner(accept ? 'Assignment accepted and appointment scheduled.' : 'Assignment declined.');
    loadDashboard();
  };

  const openReportForm = async (req: any) => {
    setActiveRequestId(req.id);
    const tpl = await apiRequest(`/inspections/templates/${req.categoryType}`);
    setTemplateFields(tpl.fields || []);
    const initial: Record<string, string> = {};
    (tpl.fields || []).forEach((f: string) => {
      initial[f] = 'Pass — Verified satisfactory';
    });
    setChecklist(initial);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequestId) return;
    await apiRequest(`/inspections/requests/${activeRequestId}/report`, {
      method: 'POST',
      body: JSON.stringify({
        conditionGrade,
        checklist,
        observations,
        defectsAndLimitations: defects,
      }),
    });
    setBanner('Standardized inspection report submitted for Auction Manager approval.');
    setActiveRequestId(null);
    setObservations('');
    setDefects('');
    loadDashboard();
  };

  if (isLoading || loading) {
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
            Inspection Partner Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage assignments, schedule physical inspections, and submit standardized reports.
          </p>
        </div>
        {data?.partner && (
          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              data.partner.approvalStatus === 'APPROVED'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            Partner Status: {data.partner.approvalStatus}
          </span>
        )}
      </div>

      {banner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {banner}
        </div>
      )}

      {!data?.registered ? (
        <form onSubmit={handleApplyPartner} className="bg-white p-6 rounded-2xl border border-slate-200 max-w-2xl space-y-4">
          <h2 className="font-bold text-navy-900 text-base">Register as an Independent Inspection Partner</h2>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company / Individual Inspector Name"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Primary Contact Name"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (+251...)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <input
            type="text"
            required
            value={serviceLocations}
            onChange={(e) => setServiceLocations(e.target.value)}
            placeholder="Service Cities"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <textarea
            required
            rows={3}
            value={qualifications}
            onChange={(e) => setQualifications(e.target.value)}
            placeholder="Qualifications, licenses, and years of experience..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
          />
          <button type="submit" className="bg-navy-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl">
            Submit Partner Application
          </button>
        </form>
      ) : (
        <div className="space-y-8">
          {/* Assignments */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-navy-900 text-sm">Assigned Inspections ({data.assignments.length})</h3>
            </div>
            {data.assignments.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">No assignments yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.assignments.map((a: any) => (
                  <div key={a.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-900 text-sm">{a.request?.auction?.title}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px]">
                          {a.status}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        Location: {a.request?.locationAddress} • Category: {a.request?.categoryType} • Fee: {formatETB(a.feeETB)} ({a.paymentStatus})
                      </p>
                      <p className="text-slate-400">
                        Seller: {a.request?.auction?.seller?.profile?.fullName} ({a.request?.auction?.seller?.profile?.phoneNumber || a.request?.auction?.seller?.email})
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {a.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleRespond(a.id, true)}
                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Schedule
                          </button>
                          <button
                            onClick={() => handleRespond(a.id, false)}
                            className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Decline
                          </button>
                        </>
                      )}
                      {a.status === 'ACCEPTED' && !a.request?.report && (
                        <button
                          onClick={() => openReportForm(a.request)}
                          className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Submit Inspection Report
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Report Submission Form */}
          {activeRequestId && (
            <form onSubmit={handleSubmitReport} className="bg-white p-6 rounded-2xl border border-blue-200 shadow-md space-y-4">
              <h3 className="font-bold text-navy-900 text-base">Standardized Inspection Report</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Overall Condition Grade</label>
                <select
                  value={conditionGrade}
                  onChange={(e) => setConditionGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="NON_FUNCTIONAL">Non-functional</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Category Checklist Findings</label>
                {templateFields.map((field) => (
                  <div key={field} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center text-xs">
                    <span className="font-medium text-slate-700">{field}</span>
                    <input
                      type="text"
                      value={checklist[field] || ''}
                      onChange={(e) => setChecklist({ ...checklist, [field]: e.target.value })}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Observations</label>
                <textarea
                  required
                  rows={3}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Defects & Limitations</label>
                <textarea
                  rows={2}
                  value={defects}
                  onChange={(e) => setDefects(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white font-semibold px-5 py-2 rounded-xl text-xs">
                  Submit Report
                </button>
                <button type="button" onClick={() => setActiveRequestId(null)} className="text-xs text-slate-500 px-3">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Completed Reports */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-navy-900 text-sm">Submitted Reports History ({data.reports.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {data.reports.map((r: any) => (
                <div key={r.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-navy-900">{r.reportCode}</span> — {r.auction?.title}
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">{r.conditionGrade}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold">{r.adminReviewStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
