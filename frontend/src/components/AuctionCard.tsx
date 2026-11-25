'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatETB } from '@/lib/utils';
import CountdownTimer from './CountdownTimer';
import { MapPin, Users, ShieldCheck } from 'lucide-react';

interface AuctionCardProps {
  auction: {
    id: string;
    title: string;
    condition: string;
    locationCity: string;
    currentHighestBid: number | string;
    bidIncrement: number | string;
    endTime: string;
    totalBidsCount: number;
    status: string;
    images?: { url: string; isCover?: boolean }[];
    category?: { name: string };
    seller?: { profile?: { isKycVerified?: boolean } };
  };
}

export default function AuctionCard({ auction }: AuctionCardProps) {
  const coverImage =
    auction.images?.find((img) => img.isCover)?.url ||
    auction.images?.[0]?.url ||
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80';

  const isExtended = auction.status === 'EXTENDED';

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
      {/* Image with Badges */}
      <div className="relative h-52 w-full overflow-hidden bg-slate-100">
        <img
          src={coverImage}
          alt={auction.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          <span className="bg-navy-950/80 backdrop-blur-md text-white text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-md">
            {auction.category?.name || 'General'}
          </span>
          {isExtended && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md animate-pulse">
              SOFT-CLOSE EXTENDED
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-white/90 backdrop-blur-md text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
            {auction.condition.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Location & Seller Badge */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {auction.locationCity}
            </span>
            {auction.seller?.profile?.isKycVerified && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Seller
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 text-sm leading-snug mb-3">
            <Link href={`/auctions/${auction.id}`}>{auction.title}</Link>
          </h3>
        </div>

        {/* Pricing & Countdown Footer */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-end justify-between mb-2.5">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
                Current Bid
              </span>
              <span className="text-base font-bold text-navy-900 font-mono">
                {formatETB(auction.currentHighestBid)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span>{auction.totalBidsCount} bids</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
            <CountdownTimer endTime={auction.endTime} compact={true} />
            <Link
              href={`/auctions/${auction.id}`}
              className="bg-navy-900 group-hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              Bid Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
