'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import QrCodeBadge from '@/components/QrCodeBadge';
import { ShieldCheck, FileCheck, MapPin, Gavel, AlertCircle, ArrowRight } from 'lucide-react';

export default function QrItemVerificationPage() {
  const { code } = useParams();
  const itemCode = code as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/auctions/verify/${encodeURIComponent(itemCode)}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Item verification record not found');
        setLoading(false);
      });
  }, [itemCode]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-navy-900">Item Record Not Found</h1>
        <p className="text-xs text-slate-500">{error}</p>
        <Link href="/auctions" className="text-xs font-semibold text-blue-600 hover:underline">
          Browse Active Auctions
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
        <div className="bg-navy-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-blue-800/70 text-blue-200 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> Public QR Asset Verification
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{data.title}</h1>
            <p className="text-xs text-slate-300 font-mono">
              Item Code: <strong>{data.itemCode}</strong> • Auction Ref: {data.auctionId.substring(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="flex-shrink-0 bg-white p-2 rounded-xl self-start sm:self-center">
            <QrCodeBadge itemCode={data.itemCode} size={105} />
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block">Category</span>
              <span className="font-bold text-navy-900">{data.category}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block">Auction Status</span>
              <span className="font-bold text-blue-700">{data.status}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block">Current Highest Bid</span>
              <span className="font-bold font-mono text-navy-900">{formatETB(data.currentHighestBid)}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block">Location</span>
              <span className="font-bold text-navy-900 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" /> {data.locationCity}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Seller Verification</span>
              <span className="text-sm font-bold text-navy-900">{data.sellerVerification.displayName}</span>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                data.sellerVerification.isKycVerified
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {data.sellerVerification.isKycVerified ? 'Verified Seller' : 'Pending Verification'}
            </span>
          </div>

          {/* Inspection Report Card */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-navy-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" /> Independent Technical Inspection
              </span>
              {data.approvedInspection ? (
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  Grade: {data.approvedInspection.conditionGrade}
                </span>
              ) : (
                <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
                  No Approved Report Published
                </span>
              )}
            </div>

            {data.approvedInspection && (
              <div className="space-y-2 text-xs text-slate-700">
                <p>
                  <strong>Report Code:</strong> <span className="font-mono">{data.approvedInspection.reportCode}</span> •{' '}
                  <strong>Inspector:</strong> {data.approvedInspection.partner?.companyName}
                </p>
                <p>{data.approvedInspection.observations}</p>
                <p className="text-[11px] text-slate-500 italic">{data.approvedInspection.disclaimer}</p>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Link
              href={`/auctions/${data.auctionId}`}
              className="inline-flex items-center gap-2 bg-navy-900 hover:bg-blue-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors"
            >
              <Gavel className="w-4 h-4" />
              Open Live Auction Page
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
