'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import AuctionCard from '@/components/AuctionCard';
import {
  Gavel,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  TrendingUp,
  Clock,
  Car,
  Laptop,
  Wheat,
  Cog,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  const [featuredAuctions, setFeaturedAuctions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    activeAuctions: 0,
    totalBids: 0,
    totalUsers: 0,
    settledVolumeETB: 0,
  });

  useEffect(() => {
    // Load active auctions
    apiRequest('/auctions?limit=6&sortBy=endingSoon')
      .then((res) => setFeaturedAuctions(res.items || []))
      .catch(() => {});

    // Load categories
    apiRequest('/categories')
      .then((res) => setCategories(res || []))
      .catch(() => {});

    // Load live platform statistics
    apiRequest('/analytics/overview')
      .then((res) => setStats(res))
      .catch(() => {});

    const socket = getSocket();
    const onMarketplaceBid = (payload: any) => {
      if (!payload?.auctionId) return;
      setFeaturedAuctions((prev) =>
        prev.map((a) =>
          a.id === payload.auctionId
            ? {
                ...a,
                currentHighestBid: payload.currentHighestBid,
                endTime: payload.newEndTime || a.endTime,
                totalBidsCount: Number(a.totalBidsCount || 0) + 1,
                status: payload.antiSnipingExtended ? 'EXTENDED' : a.status,
              }
            : a,
        ),
      );
      setStats((prev: any) => ({
        ...prev,
        totalBids: Number(prev.totalBids || 0) + 1,
      }));
    };

    const onMarketplaceEnded = (payload: any) => {
      if (!payload?.auctionId) return;
      setFeaturedAuctions((prev) =>
        prev.map((a) => (a.id === payload.auctionId ? { ...a, status: payload.status || 'ENDED' } : a)),
      );
    };

    socket.on('marketplace_bid_update', onMarketplaceBid);
    socket.on('marketplace_auction_ended', onMarketplaceEnded);

    return () => {
      socket.off('marketplace_bid_update', onMarketplaceBid);
      socket.off('marketplace_auction_ended', onMarketplaceEnded);
    };
  }, []);

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-navy-900 text-white pt-20 pb-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.18),transparent_50%)]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl space-y-6"
          >
            <div className="inline-flex items-center gap-2 bg-blue-900/60 border border-blue-700/50 px-3.5 py-1.5 rounded-full text-blue-300 text-xs font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Live Synchronized Bidding Platform
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
              Every Bid Opens a <span className="text-blue-400">New Opportunity</span>.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              BIDORA connects verified buyers and sellers across Ethiopia. Participate in real-time
              competitive auctions, automate counter-bids with proxy bidding, and trade with guaranteed
              escrow security.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href="/auctions"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all text-sm"
              >
                Explore Active Auctions
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard/seller/create"
                className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-6 py-3.5 rounded-xl transition-all text-sm"
              >
                Start Selling
              </Link>
            </div>
          </motion.div>

          {/* Real Database Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-10 border-t border-slate-800/80">
            <div>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white block">
                {stats.activeAuctions ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">Active Live Auctions</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-400 block">
                {stats.totalBids ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">Verified Bids Placed</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 block">
                {stats.totalUsers ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">Registered Participants</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400 block">
                {stats.totalTransactions ?? 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">Escrow Settlements</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Live Auctions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-600 font-semibold text-xs tracking-wider uppercase mb-1">
              <Clock className="w-4 h-4" />
              Ending Soon
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight">
              Featured Live Auctions
            </h2>
          </div>
          <Link
            href="/auctions"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            View all auctions
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {featuredAuctions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <Gavel className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium text-sm">Loading active auctions from database...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredAuctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}
      </section>

      {/* Popular Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-blue-600 font-semibold text-xs tracking-wider uppercase">
            Browse By Industry
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight mt-1">
            Explore Verified Categories
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {[
            { name: 'Vehicles', slug: 'vehicles', icon: Car, count: 'Cars, Trucks' },
            { name: 'Agriculture', slug: 'agriculture', icon: Wheat, count: 'Coffee, Grain' },
            { name: 'Electronics', slug: 'electronics', icon: Laptop, count: 'IT, Hardware' },
            { name: 'Machinery', slug: 'machinery', icon: Cog, count: 'Industrial' },
            { name: 'Real Estate', slug: 'real-estate', icon: Building, count: 'Commercial' },
            { name: 'Surplus', slug: 'business-assets', icon: TrendingUp, count: 'Business Assets' },
          ].map((cat, i) => {
            const Icon = cat.icon;
            return (
              <Link
                key={i}
                href={`/auctions?category=${cat.slug}`}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all text-center group flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-700 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors mb-3">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-navy-900 group-hover:text-blue-600 transition-colors">
                  {cat.name}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">{cat.count}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How Bidora Works */}
      <section className="bg-slate-100/70 py-16 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-blue-600 font-semibold text-xs tracking-wider uppercase">
              Algorithmic Transparency
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900 tracking-tight mt-1">
              How BIDORA Protects Your Bids
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                1
              </div>
              <h3 className="font-bold text-navy-900 text-base">Sub-Second WebSocket Engine</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bids are broadcast to all connected devices in under 100 milliseconds. Redis distributed
                locking ensures absolute bid serialization and prevents race conditions.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                2
              </div>
              <h3 className="font-bold text-navy-900 text-base">Soft-Close Anti-Sniping</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                If a bid is received in the final 30 seconds, the server clock automatically extends
                the countdown by 30 seconds, preventing unfair last-second bot sniping.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
                3
              </div>
              <h3 className="font-bold text-navy-900 text-base">Automatic Proxy Bidding</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Set your secret ceiling. The engine automatically places the lowest necessary counter-bid
                on your behalf without ever revealing your maximum to competitors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-navy-900 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1 rounded-full">
              <ShieldCheck className="w-4 h-4" />
              Verified Accounts & Escrow Protection
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Trade with Confidence Across Ethiopia
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every seller undergoes national ID verification. When you win an auction, funds are
              held in an auditable escrow state until you inspect and accept the items.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-300">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Telebirr & CBE Birr Mock Workflow</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Tamper-Proof Audit Logging</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
