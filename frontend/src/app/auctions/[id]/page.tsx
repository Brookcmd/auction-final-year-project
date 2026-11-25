'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { formatETB } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import AuctionCard from '@/components/AuctionCard';
import QrCodeBadge from '@/components/QrCodeBadge';
import {
  Gavel,
  ShieldCheck,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Zap,
  TrendingUp,
  Heart,
  Share2,
  Eye,
  Flag,
  FileCheck,
  Lock,
  QrCode,
} from 'lucide-react';

function BidSparkline({ bids, startingPrice }: { bids: any[]; startingPrice: number }) {
  const points = useMemo(() => {
    const ordered = [...bids]
      .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime())
      .map((b) => Number(b.amount));
    const series = ordered.length > 0 ? [startingPrice, ...ordered] : [startingPrice];
    if (series.length < 2) return null;

    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const width = 280;
    const height = 56;
    const pad = 6;

    const coords = series.map((val, idx) => {
      const x = pad + (idx / (series.length - 1)) * (width - pad * 2);
      const y = height - pad - ((val - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    });

    return { polyline: coords.join(' '), width, height, min, max };
  }, [bids, startingPrice]);

  if (!points) return null;

  return (
    <div className="pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span className="font-semibold uppercase tracking-wider">Bid Price Momentum</span>
        <span className="font-mono">
          {formatETB(points.min)} → {formatETB(points.max)}
        </span>
      </div>
      <svg viewBox={`0 0 ${points.width} ${points.height}`} className="w-full h-14 overflow-visible">
        <polyline
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.polyline}
        />
      </svg>
    </div>
  );
}

export default function AuctionDetailPage() {
  const { id } = useParams();
  const auctionId = id as string;
  const { user } = useAuth();

  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [liveViewers, setLiveViewers] = useState<number>(1);
  const [isWatching, setIsWatching] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Bid form state
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  // Proxy bid state
  const [proxyMaxAmount, setProxyMaxAmount] = useState<number>(0);
  const [activeProxyLimit, setActiveProxyLimit] = useState<number | null>(null);
  const [proxySuccess, setProxySuccess] = useState<string | null>(null);
  const [showProxyModal, setShowProxyModal] = useState(false);

  // Report listing state
  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState('Suspicious / Misleading Listing');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);

  // Anti-sniping notification toast state
  const [snipingAlert, setSnipingAlert] = useState(false);

  // Bid security & restricted participation state
  const [securityReq, setSecurityReq] = useState<any>(null);
  const [depositProvider, setDepositProvider] = useState<'TELEBIRR' | 'CBE_BIRR'>('TELEBIRR');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [applyingRestricted, setApplyingRestricted] = useState(false);

  const loadAuction = () => {
    apiRequest(`/auctions/${auctionId}`)
      .then((data) => {
        setAuction(data);
        setBids(data.bids || []);
        setIsWatching(!!data.isWatching);
        if (data.userProxyBid?.isActive) {
          setActiveProxyLimit(Number(data.userProxyBid.maxAmount));
        }
        const cover =
          data.images?.find((img: any) => img.isCover)?.url ||
          data.images?.[0]?.url ||
          'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80';
        setSelectedImage(cover);

        const current = Number(data.currentHighestBid);
        const inc = Number(data.bidIncrement);
        setBidAmount(current + inc);
        setProxyMaxAmount(current + inc * 2);

        if (data.requiresBidSecurity) {
          apiRequest(`/bid-security/auction/${auctionId}/requirement`)
            .then((req) => setSecurityReq(req))
            .catch(() => {});
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  // Load initial auction data (re-runs when user signs in/out so userDeposit & proxy state stay accurate)
  useEffect(() => {
    loadAuction();
  }, [auctionId, user?.id]);

  // Connect to WebSocket Room for Real-Time Live Bidding & Viewer Presence
  useEffect(() => {
    if (!auctionId) return;
    const socket = getSocket();

    socket.emit('join_auction', { auctionId });

    const handleBidUpdated = (event: any) => {
      if (event.auctionId !== auctionId) return;

      setAuction((prev: any) => {
        if (!prev) return prev;
        const newHighest = Number(event.amount);
        const inc = Number(prev.bidIncrement);

        setBidAmount(newHighest + inc);

        return {
          ...prev,
          currentHighestBid: newHighest,
          endTime: event.newEndTime || prev.endTime,
          status: event.antiSnipingExtended ? 'EXTENDED' : prev.status,
          antiSnipingExtensions: event.antiSnipingExtended
            ? (prev.antiSnipingExtensions || 0) + 1
            : prev.antiSnipingExtensions,
          totalBidsCount: prev.totalBidsCount + 1,
        };
      });

      setBids((prevBids) => [
        {
          id: 'live-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          amount: event.amount,
          bidderAlias: event.bidderAlias,
          isProxyBid: event.proxyCounterTriggered || false,
          placedAt: event.placedAt || new Date().toISOString(),
        },
        ...prevBids,
      ]);

      if (event.antiSnipingExtended) {
        setSnipingAlert(true);
        setTimeout(() => setSnipingAlert(false), 8000);
      }
    };

    const handleRoomViewers = (event: any) => {
      if (event.auctionId === auctionId) {
        setLiveViewers(Math.max(1, event.viewersCount || 1));
      }
    };

    const handleAuctionEnded = (event: any) => {
      if (event.auctionId !== auctionId) return;
      setAuction((prev: any) => ({ ...prev, status: 'ENDED' }));
    };

    socket.on('bid_updated', handleBidUpdated);
    socket.on('room_viewers', handleRoomViewers);
    socket.on('auction_ended', handleAuctionEnded);

    return () => {
      socket.emit('leave_auction', { auctionId });
      socket.off('bid_updated', handleBidUpdated);
      socket.off('room_viewers', handleRoomViewers);
      socket.off('auction_ended', handleAuctionEnded);
    };
  }, [auctionId]);

  const handleToggleWatchlist = async () => {
    if (!user) {
      setBidError('Please sign in to save auctions to your watchlist.');
      return;
    }
    try {
      const res = await apiRequest(`/auctions/${auctionId}/watchlist`, { method: 'POST' });
      setIsWatching(!!res.watching);
    } catch (err: any) {
      setBidError(err.message);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidError(null);
    setBidSuccess(null);

    if (!user) {
      setBidError('Please sign in to place a bid on this listing.');
      return;
    }

    if (auction?.sellerId === user.id) {
      setBidError('Sellers are not allowed to bid on their own auctions.');
      return;
    }

    setSubmittingBid(true);
    try {
      const result = await apiRequest('/bidding/bid', {
        method: 'POST',
        body: JSON.stringify({
          auctionId,
          amount: Number(bidAmount),
        }),
      });

      setBidSuccess(`Success! Your bid of ${formatETB(result.amount)} was accepted.`);
      setAuction((prev: any) =>
        prev
          ? {
              ...prev,
              winningBidderId: user.id,
              currentHighestBid: result.amount,
              endTime: result.newEndTime || prev.endTime,
            }
          : prev,
      );
      setBidAmount(Number(result.amount) + Number(auction?.bidIncrement || 100));
    } catch (err: any) {
      setBidError(err.message || 'Bid rejected by server.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleSetProxyBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setProxySuccess(null);
    setBidError(null);

    if (!user) {
      setBidError('Please sign in to configure automatic proxy bidding.');
      return;
    }

    try {
      await apiRequest('/bidding/proxy', {
        method: 'POST',
        body: JSON.stringify({
          auctionId,
          maxAmount: Number(proxyMaxAmount),
        }),
      });

      setActiveProxyLimit(Number(proxyMaxAmount));
      setProxySuccess(`Proxy activated! We will automatically bid up to ${formatETB(proxyMaxAmount)} for you.`);
      setShowProxyModal(false);
    } catch (err: any) {
      setBidError(err.message);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setBidError('Please sign in to report a listing.');
      return;
    }
    try {
      await apiRequest(`/auctions/${auctionId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      setReportSent(true);
      setShowReportBox(false);
    } catch (err: any) {
      setBidError(err.message);
    }
  };

  const handlePayBidSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidError(null);
    if (!user) {
      setBidError('Please sign in first to submit a bid security deposit.');
      return;
    }
    if (!termsAccepted) {
      setBidError('Please accept the bid security refund & forfeiture terms.');
      return;
    }
    setSubmittingDeposit(true);
    try {
      await apiRequest(`/bid-security/auction/${auctionId}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ provider: depositProvider, termsAccepted: true }),
      });
      setBidSuccess('Simulated bid security deposit confirmed! Bidding is now unlocked.');
      loadAuction();
    } catch (err: any) {
      setBidError(err.message);
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleApplyRestricted = async () => {
    setBidError(null);
    if (!user) {
      setBidError('Please sign in first to apply.');
      return;
    }
    setApplyingRestricted(true);
    try {
      await apiRequest(`/auctions/${auctionId}/apply`, { method: 'POST' });
      setBidSuccess('Application submitted for Auction Manager approval.');
      loadAuction();
    } catch (err: any) {
      setBidError(err.message);
    } finally {
      setApplyingRestricted(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Entering live bidding room...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <Gavel className="w-12 h-12 text-slate-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Auction Listing Not Found</h2>
        <Link href="/auctions" className="text-sm font-semibold text-blue-600 hover:underline">
          Return to explore auctions
        </Link>
      </div>
    );
  }

  const currentHighest = Number(auction.currentHighestBid);
  const increment = Number(auction.bidIncrement);
  const minValidBid = currentHighest + increment;
  const isEnded = auction.status === 'ENDED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Anti-Sniping Live Alert Toast */}
      {snipingAlert && (
        <div className="bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <Clock className="w-5 h-5" />
            <span>ANTI-SNIPING TRIGGERED: A bid in the final 30 seconds extended the timer by 30s!</span>
          </div>
          <span className="text-xs uppercase tracking-wider font-semibold bg-white/20 px-2 py-0.5 rounded">
            Fair Play Enforced
          </span>
        </div>
      )}

      {/* Main Grid: Gallery on Left, Live Bidding Engine on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Media Gallery & Specs (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative h-80 sm:h-[420px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-sm">
            <img src={selectedImage} alt={auction.title} className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="bg-navy-950/80 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-md">
                {auction.category?.name}
              </span>
              <span className="bg-white/90 backdrop-blur-md text-slate-900 text-xs font-bold px-2.5 py-1 rounded-md">
                {auction.condition?.replace('_', ' ')}
              </span>
            </div>

            {/* Watchlist & Share Floating Actions */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                type="button"
                onClick={handleToggleWatchlist}
                className={`p-2 rounded-xl backdrop-blur-md shadow-sm transition-colors flex items-center gap-1 text-xs font-semibold ${
                  isWatching
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/90 text-slate-800 hover:bg-white'
                }`}
                title="Toggle Watchlist"
              >
                <Heart className={`w-4 h-4 ${isWatching ? 'fill-white' : ''}`} />
                <span className="hidden sm:inline">{isWatching ? 'Watching' : 'Watch'}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 backdrop-blur-md shadow-sm transition-colors flex items-center gap-1 text-xs font-semibold"
                title="Copy auction link"
              >
                <Share2 className="w-4 h-4" />
                {copiedLink && <span className="text-emerald-700">Copied!</span>}
              </button>
            </div>
          </div>

          {auction.images && auction.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {auction.images.map((img: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(img.url)}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                    selectedImage === img.url ? 'border-blue-600 scale-105' : 'border-transparent opacity-70'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Description & Verification */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900 text-base">Item Description & Specifications</h3>
              <button
                type="button"
                onClick={() => setShowReportBox(!showReportBox)}
                className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" /> Report Listing
              </button>
            </div>

            {reportSent && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                Thank you. Your report has been queued for administrator review.
              </div>
            )}

            {showReportBox && (
              <form onSubmit={handleReportSubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                >
                  <option value="Suspicious / Misleading Listing">Suspicious / Misleading Listing</option>
                  <option value="Prohibited Item">Prohibited Item</option>
                  <option value="Suspected Shill Bidding">Suspected Shill Bidding</option>
                </select>
                <textarea
                  rows={2}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Optional details for administrators..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <div className="flex gap-2">
                  <button type="submit" className="bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                    Submit Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportBox(false)}
                    className="text-xs text-slate-500 px-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
              {auction.description}
            </p>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Physical Location</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  {auction.locationCity}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Minimum Increment</span>
                <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                  +{formatETB(auction.bidIncrement)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Anti-Sniping Extensions</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {auction.antiSnipingExtensions || 0} times
                </span>
              </div>
            </div>
          </div>

          {/* Seller Card & QR Verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold text-base flex-shrink-0">
                {auction.seller?.profile?.fullName?.[0] || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-navy-900">
                    {auction.seller?.profile?.fullName || 'Verified Merchant'}
                  </h4>
                  {auction.seller?.profile?.isKycVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> Verified Seller
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Based in {auction.seller?.profile?.city || 'Ethiopia'}
                </p>
              </div>
            </div>

            {auction.itemCode && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-blue-600" /> Item Verification QR
                  </span>
                  <span className="text-xs font-mono font-bold text-navy-900 block">
                    {auction.itemCode}
                  </span>
                  <Link
                    href={`/verify/${auction.itemCode}`}
                    className="text-[11px] font-semibold text-blue-600 hover:underline inline-block"
                  >
                    Open Public Verification Page
                  </Link>
                </div>
                <QrCodeBadge itemCode={auction.itemCode} size={70} />
              </div>
            )}
          </div>

          {/* Approved Independent Inspection Report */}
          {auction.inspectionReports && auction.inspectionReports.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-navy-900 text-sm">
                    Approved Independent Inspection Report ({auction.inspectionReports[0].reportCode})
                  </h3>
                </div>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  Condition Grade: {auction.inspectionReports[0].conditionGrade}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  <strong>Partner:</strong> {auction.inspectionReports[0].partner?.companyName} •{' '}
                  <strong>Location:</strong> {auction.inspectionReports[0].inspectionLocation}
                </p>
                <p className="text-slate-700">{auction.inspectionReports[0].observations}</p>
                {auction.inspectionReports[0].defectsAndLimitations && (
                  <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    <strong>Defects / Limitations:</strong> {auction.inspectionReports[0].defectsAndLimitations}
                  </p>
                )}
              </div>

              {(() => {
                try {
                  const checklist = JSON.parse(auction.inspectionReports[0].checklistJson || '{}');
                  const entries = Object.entries(checklist);
                  if (entries.length === 0) return null;
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                      {entries.map(([k, v]) => (
                        <div key={k} className="bg-slate-50 p-2 rounded-lg">
                          <span className="font-semibold text-navy-900 block">{k}</span>
                          <span className="text-slate-600">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}

              <p className="text-[10px] text-slate-400 italic pt-1">
                {auction.inspectionReports[0].disclaimer}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Real-Time Bidding Control Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-5 sticky top-24">
            {/* Header Title & Live Presence */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span className="font-mono">LOT #{auction.id.substring(0, 8).toUpperCase()}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                    <Eye className="w-3.5 h-3.5 text-blue-600" /> {liveViewers} watching
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Sync
                  </span>
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-navy-900 leading-snug">
                {auction.title}
              </h1>
            </div>

            {/* Countdown Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Time Remaining (Server-Controlled)
              </span>
              <CountdownTimer endTime={auction.endTime} />
            </div>

            {/* Current Price Box + Sparkline */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider">
                  Current Highest Bid
                </span>
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {auction.totalBidsCount} total bids
                </span>
              </div>
              <div className="text-3xl font-extrabold font-mono text-navy-900">
                {formatETB(currentHighest)}
              </div>
              <p className="text-[11px] text-slate-500">
                Next minimum required bid: <strong className="text-navy-900 font-mono">{formatETB(minValidBid)}</strong>
              </p>

              <BidSparkline bids={bids} startingPrice={Number(auction.startingPrice)} />
            </div>

            {/* Active Private Proxy Banner */}
            {activeProxyLimit && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  Proxy Active (Private Ceiling)
                </span>
                <span className="font-mono font-bold">{formatETB(activeProxyLimit)}</span>
              </div>
            )}

            {/* Alerts */}
            {bidError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{bidError}</span>
              </div>
            )}
            {bidSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{bidSuccess}</span>
              </div>
            )}
            {proxySuccess && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs flex items-center gap-2">
                <Zap className="w-4 h-4 flex-shrink-0" />
                <span>{proxySuccess}</span>
              </div>
            )}

            {/* Bidding Actions (with Bid Security & Restricted Participation Gates) */}
            {!isEnded ? (
              <div className="space-y-4">
                {auction.isRestricted && auction.participationStatus !== 'APPROVED' ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <Lock className="w-4 h-4" />
                      <span>Restricted Auction Participation</span>
                    </div>
                    <p className="text-amber-800">
                      {auction.participationStatus === 'PENDING'
                        ? 'Your participation application is pending Auction Manager approval.'
                        : 'Only KYC-verified and approved buyers may bid in this auction.'}
                    </p>
                    {auction.participationStatus !== 'PENDING' && (
                      <button
                        type="button"
                        onClick={handleApplyRestricted}
                        disabled={applyingRestricted}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl"
                      >
                        {applyingRestricted ? 'Submitting...' : 'Apply to Participate'}
                      </button>
                    )}
                  </div>
                ) : auction.requiresBidSecurity &&
                  (!auction.userDeposit ||
                    (auction.userDeposit.status !== 'CONFIRMED' &&
                      auction.userDeposit.status !== 'RESERVED')) ? (
                  <form
                    onSubmit={handlePayBidSecurity}
                    className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Lock className="w-4 h-4" /> Bid Security Required
                      </span>
                      <span className="font-mono font-extrabold text-navy-900">
                        {formatETB(securityReq?.amountETB || 25000)}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {securityReq?.refundPolicy ||
                        'A simulated bid bond is required to place bids. Refunded to non-winners after auction close.'}
                    </p>
                    <select
                      value={depositProvider}
                      onChange={(e: any) => setDepositProvider(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-medium"
                    >
                      <option value="TELEBIRR">Telebirr (Simulated Deposit)</option>
                      <option value="CBE_BIRR">CBE Birr (Simulated Deposit)</option>
                    </select>
                    <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        I accept the simulated bid security terms and forfeiture review policy.
                      </span>
                    </label>
                    <button
                      type="submit"
                      disabled={submittingDeposit}
                      className="w-full bg-navy-900 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl transition-colors"
                    >
                      {submittingDeposit
                        ? 'Confirming Simulated Deposit...'
                        : `Pay Simulated Deposit (${formatETB(securityReq?.amountETB || 25000)})`}
                    </button>
                  </form>
                ) : (
                  <>
                    {auction.requiresBidSecurity && auction.userDeposit && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Bid Security Confirmed (Simulated)
                        </span>
                        <span className="font-mono font-bold">{formatETB(auction.userDeposit.amount)}</span>
                      </div>
                    )}
                    {user && auction.winningBidderId === user.id && (
                      <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        You are currently the highest bidder on this auction.
                      </div>
                    )}
                    <form onSubmit={handlePlaceBid} className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Your Bid Amount (ETB)
                      </label>
                      {/* Quick-Bid Increment Chips */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 5].map((mult) => (
                          <button
                            key={mult}
                            type="button"
                            onClick={() => setBidAmount(currentHighest + increment * mult)}
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 transition-colors"
                          >
                            +{mult}x
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-xs font-mono font-bold text-slate-500">
                        ETB
                      </span>
                      <input
                        type="number"
                        min={minValidBid}
                        step={increment}
                        value={bidAmount}
                        onChange={(e) => setBidAmount(Number(e.target.value))}
                        className="w-full pl-14 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingBid}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Gavel className="w-4 h-4" />
                    {submittingBid ? 'Validating Bid...' : `Place Bid for ${formatETB(bidAmount)}`}
                  </button>
                </form>

                {/* Proxy Bidding Setup Trigger */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Want automatic bidding?</span>
                  <button
                    type="button"
                    onClick={() => setShowProxyModal(!showProxyModal)}
                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {activeProxyLimit ? 'Update Proxy Ceiling' : 'Set Proxy Ceiling'}
                  </button>
                </div>

                    {showProxyModal && (
                      <form onSubmit={handleSetProxyBid} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div>
                          <span className="text-xs font-bold text-navy-900 block">Automatic Proxy Bidding</span>
                          <p className="text-[11px] text-slate-500">
                            Enter your maximum ceiling. The system will automatically place the minimum necessary
                            counter-bids on your behalf without exposing your limit.
                          </p>
                        </div>
                        <input
                          type="number"
                          min={minValidBid}
                          step={increment}
                          value={proxyMaxAmount}
                          onChange={(e) => setProxyMaxAmount(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="bg-navy-900 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                          >
                            Activate Proxy
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowProxyModal(false)}
                            className="text-xs text-slate-500 px-3 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-100 text-center space-y-2">
                <span className="text-sm font-bold text-slate-800 block">This auction has concluded</span>
                <p className="text-xs text-slate-500">
                  Winning Bid: <strong className="text-navy-900 font-mono">{formatETB(currentHighest)}</strong>
                </p>
              </div>
            )}

            {/* Live Bidding History Stream */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Live Bidding Stream
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Auto-updates</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {bids.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">No bids placed yet. Be the first!</p>
                ) : (
                  <AnimatePresence initial={false}>
                    {bids.map((b, index) => (
                      <motion.div
                        key={b.id || index}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-center justify-between p-2.5 rounded-lg text-xs ${
                          index === 0
                            ? 'bg-blue-50/70 border border-blue-200/60 font-semibold'
                            : 'bg-slate-50 border border-slate-100 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-navy-900">{b.bidderAlias || 'Anonymous'}</span>
                          {b.isProxyBid && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                              AUTO PROXY
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-navy-900 block">
                            {formatETB(b.amount)}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {new Date(b.placedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Auctions */}
      {auction.similarAuctions && auction.similarAuctions.length > 0 && (
        <section className="pt-8 border-t border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">Similar Live Auctions</h2>
            <Link href="/auctions" className="text-xs font-semibold text-blue-600 hover:underline">
              Browse all
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {auction.similarAuctions.map((sim: any) => (
              <AuctionCard key={sim.id} auction={sim} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
