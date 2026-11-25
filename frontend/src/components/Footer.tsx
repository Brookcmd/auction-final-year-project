import React from 'react';
import Link from 'next/link';
import { Gavel, ShieldCheck, Lock, Award, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-slate-400 text-xs border-t border-navy-900 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand & Purpose */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Gavel className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                BID<span className="text-blue-500">ORA</span>
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed text-xs">
              Ethiopia’s premier real-time auction marketplace. Built on verifiable, cryptographic
              integrity, anti-sniping fairness, and automated escrow settlements.
            </p>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>All bidding synchronized in real time</span>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Marketplace</h4>
            <ul className="space-y-2">
              <li><Link href="/auctions?category=vehicles" className="hover:text-white transition-colors">Vehicles & Automotive</Link></li>
              <li><Link href="/auctions?category=agriculture" className="hover:text-white transition-colors">Agricultural Lots & Coffee</Link></li>
              <li><Link href="/auctions?category=electronics" className="hover:text-white transition-colors">IT & Enterprise Electronics</Link></li>
              <li><Link href="/auctions?category=machinery" className="hover:text-white transition-colors">Industrial Machinery</Link></li>
              <li><Link href="/auctions?category=real-estate" className="hover:text-white transition-colors">Commercial Real Estate</Link></li>
            </ul>
          </div>

          {/* Platform Trust & Transparency */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Integrity & Platform Rules</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Soft-Close Anti-Sniping</li>
              <li className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-400" /> Redis Concurrency Locks</li>
              <li className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-amber-400" /> Automatic Proxy Bidding</li>
              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How Bidding Works</Link></li>
            </ul>
          </div>

          {/* Trust Note */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Ethiopian Market Ready</h4>
            <p className="text-slate-400 mb-3 leading-relaxed">
              Designed with direct integration architecture for Telebirr, CBE Birr, and digital escrow protection.
            </p>
            <div className="p-3 rounded-lg bg-navy-900/60 border border-navy-800 text-[11px] text-slate-300">
              <span className="font-semibold text-white">Primary Currency:</span> ETB (Ethiopian Birr). All timers enforced on server clock.
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-navy-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
          <p>© {new Date().getFullYear()} BIDORA Platform. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="w-3 h-3 text-rose-500" /> for transparent commerce
          </p>
        </div>
      </div>
    </footer>
  );
}
