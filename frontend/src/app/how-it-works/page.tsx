import React from 'react';
import Link from 'next/link';
import {
  Gavel,
  Zap,
  Clock,
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">
      {/* Page Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          Platform Rules & Architecture
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-navy-900 tracking-tight">
          How BIDORA Operates
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Learn how our real-time bidding engine, anti-sniping protection, and escrow settlements work together to ensure complete fairness.
        </p>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pillar 1 */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Gavel className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-navy-900 text-lg">1. Real-Time WebSocket Bidding</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Every bid placed in BIDORA travels through a high-speed WebSocket pipeline. A distributed
            lock in Redis ensures that even if thousands of bidders click "Place Bid" at the exact same
            millisecond, every bid is validated and executed atomically in microsecond order.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-navy-900 text-lg">2. Soft-Close Anti-Sniping</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            To prevent unfair bots from placing a bid in the final second before human bidders can react,
            BIDORA implements the <strong>30-second rule</strong>: any valid bid placed within the final
            30 seconds of an auction automatically extends the countdown timer by 30 seconds.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-navy-900 text-lg">3. Automatic Proxy Bidding</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Don't have time to watch the countdown? Set your secret maximum ceiling. Whenever a competitor
            bids, BIDORA automatically places the smallest necessary counter-bid (current + increment)
            to keep you in the lead, without ever revealing your maximum ceiling to other participants.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-navy-900 text-lg">4. Escrow & Verified Settlement</h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            When an auction concludes, the winner pays into an auditable Escrow account (simulated
            for Telebirr and CBE Birr). Funds are not released to the seller until the buyer confirms
            reception and physical inspection of the assets.
          </p>
        </div>
      </div>

      {/* CTA Box */}
      <div className="bg-navy-900 text-white rounded-3xl p-8 sm:p-12 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Ready to experience the marketplace?
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
          Sign up now, browse current vehicle lots, agricultural coffee shipments, and electronics.
        </p>
        <div className="pt-2">
          <Link
            href="/auctions"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-lg transition-all"
          >
            Explore Active Auctions
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
