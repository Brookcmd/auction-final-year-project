'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { formatETB } from '@/lib/utils';
import {
  Gavel,
  PlusCircle,
  TrendingUp,
  PackageCheck,
  Clock,
  Eye,
  FileCheck,
  Send,
} from 'lucide-react';

export default function SellerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const loadListings = () => {
    apiRequest('/auctions/seller/my-listings')
      .then((res) => {
        setAuctions(res || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'SELLER' && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'))) {
      router.push('/login');
      return;
    }

    if (user) loadListings();
  }, [user, isLoading, router]);

  const handleSubmitForApproval = async (id: string) => {
    await apiRequest(`/auctions/${id}/submit`, { method: 'POST' });
    setMsg('Listing submitted for Auction Manager governance review.');
    loadListings();
  };

  const handleRequestInspection = async (auction: any) => {
    await apiRequest(`/inspections/requests/${auction.id}`, {
      method: 'POST',
      body: JSON.stringify({
        categoryType: 'VEHICLES',
        locationAddress: auction.locationCity,
        notes: 'Seller requested physical inspection prior to approval.',
      }),
    });
    setMsg('Inspection request created and queued for Auction Manager assignment.');
    loadListings();
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeCount = auctions.filter((a) => a.status === 'ACTIVE' || a.status === 'EXTENDED').length;
  const completedCount = auctions.filter((a) => a.status === 'ENDED' || a.status === 'COMPLETED').length;
  const totalBidsReceived = auctions.reduce((acc, a) => acc + (a._count?.bids || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Seller Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Submit listings for approval, track independent inspections, and monitor live auctions.
          </p>
        </div>
        <Link
          href="/dashboard/seller/create"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Listing
        </Link>
      </div>

      {msg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-medium">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Active Auctions</span>
            <span className="text-2xl font-bold font-mono text-navy-900 block">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Completed Auctions</span>
            <span className="text-2xl font-bold font-mono text-navy-900 block">{completedCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Total Bids Received</span>
            <span className="text-2xl font-bold font-mono text-navy-900 block">{totalBidsReceived}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-navy-900 text-sm">Your Auction Listings ({auctions.length})</h3>
        </div>

        {auctions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Gavel className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">No listings posted yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {auctions.map((a) => (
              <div
                key={a.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    <img
                      src={
                        a.images?.[0]?.url ||
                        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80'
                      }
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {a.category?.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800">
                        {a.status}
                      </span>
                      {a.itemCode && (
                        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded">
                          {a.itemCode}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-navy-900 mt-0.5">{a.title}</h4>
                    <span className="text-[11px] text-slate-400">
                      Ends: {new Date(a.endTime).toLocaleDateString()} • Bids: {a._count?.bids || 0}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  {(a.status === 'DRAFT' || a.status === 'ADDITIONAL_INFO_REQUIRED') && (
                    <button
                      onClick={() => handleSubmitForApproval(a.id)}
                      className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit for Review
                    </button>
                  )}
                  {(!a.inspectionRequests || a.inspectionRequests.length === 0) &&
                    a.status !== 'ENDED' &&
                    a.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleRequestInspection(a)}
                        className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        <FileCheck className="w-3.5 h-3.5" /> Request Inspection
                      </button>
                    )}
                  <div className="text-right px-2">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Current</span>
                    <span className="text-sm font-bold font-mono text-navy-900">{formatETB(a.currentHighestBid)}</span>
                  </div>
                  <Link
                    href={`/auctions/${a.id}`}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                    title="View auction"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
