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
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';

export default function SellerDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN'))) {
      router.push('/login');
      return;
    }

    if (user) {
      apiRequest('/auctions/seller/my-listings')
        .then((res) => {
          setAuctions(res || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user, isLoading, router]);

  if (isLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeCount = auctions.filter((a) => a.status === 'ACTIVE' || a.status === 'EXTENDED').length;
  const completedCount = auctions.filter((a) => a.status === 'ENDED').length;
  const totalBidsReceived = auctions.reduce((acc, a) => acc + (a._count?.bids || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Seller Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your catalog, review active competitive bids, and track completed sales.
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

      {/* Metrics Row */}
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
            <span className="text-xs text-slate-400 font-medium">Completed Sales</span>
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

      {/* Listings Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-navy-900 text-sm">Your Auction Listings ({auctions.length})</h3>
        </div>

        {auctions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Gavel className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">No listings posted yet.</p>
            <Link
              href="/dashboard/seller/create"
              className="inline-block text-xs font-semibold text-blue-600 hover:underline"
            >
              List your first product or asset
            </Link>
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {a.category?.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : a.status === 'EXTENDED'
                            ? 'bg-amber-100 text-amber-700 animate-pulse'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-navy-900 mt-0.5">{a.title}</h4>
                    <span className="text-[11px] text-slate-400">
                      Ends: {new Date(a.endTime).toLocaleDateString()} at {new Date(a.endTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                      Highest Bid
                    </span>
                    <span className="text-base font-bold font-mono text-navy-900">
                      {formatETB(a.currentHighestBid)}
                    </span>
                  </div>
                  <Link
                    href={`/auctions/${a.id}`}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    title="View live room"
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
