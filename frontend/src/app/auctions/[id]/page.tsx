'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { formatETB } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
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
  Lock,
  ArrowRight,
} from 'lucide-react';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const auctionId = id as string;
  const { user } = useAuth();

  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');

  // Bid form state
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  // Proxy bid state
  const [proxyMaxAmount, setProxyMaxAmount] = useState<number>(0);
  const [proxySuccess, setProxySuccess] = useState<string | null>(null);
  const [showProxyModal, setShowProxyModal] = useState(false);

  // Anti-sniping notification toast state
  const [snipingAlert, setSnipingAlert] = useState(false);

  // Load initial auction data
  useEffect(() => {
    apiRequest(`/auctions/${auctionId}`)
      .then((data) => {
        setAuction(data);
        setBids(data.bids || []);
        const cover =
          data.images?.find((img: any) => img.isCover)?.url ||
          data.images?.[0]?.url ||
          'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80';
        setSelectedImage(cover);

        // Prepopulate next valid bid amount
        const current = Number(data.currentHighestBid);
        const inc = Number(data.bidIncrement);
        setBidAmount(current + inc);
        setProxyMaxAmount(current + inc * 2);

        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [auctionId]);

  // Connect to WebSocket Room for Real-Time Live Bidding
  useEffect(() => {
    if (!auctionId) return;
    const socket = getSocket();

    // 1. Join auction room
    socket.emit('join_auction', { auctionId });

    // 2. Listen for incoming verified bids
    const handleBidUpdated = (event: any) => {
      if (event.auctionId !== auctionId) return;

      setAuction((prev: any) => {
        if (!prev) return prev;
        const newHighest = Number(event.amount);
        const inc = Number(prev.bidIncrement);

        // Update default input bid amount for user
        setBidAmount(newHighest + inc);

        return {
          ...prev,
          currentHighestBid: newHighest,
          endTime: event.newEndTime || prev.endTime,
          status: event.antiSnipingExtended ? 'EXTENDED' : prev.status,
          totalBidsCount: prev.totalBidsCount + 1,
        };
      });

      // Add to bid stream
      setBids((prevBids) => [
        {
          id: 'temp-' + Date.now(),
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

    socket.on('bid_updated', handleBidUpdated);

    // 3. Listen for auction ended
    socket.on('auction_ended', (event: any) => {
      if (event.auctionId !== auctionId) return;
      setAuction((prev: any) => ({ ...prev, status: 'ENDED' }));
    });

    return () => {
      socket.emit('leave_auction', { auctionId });
      socket.off('bid_updated', handleBidUpdated);
      socket.off('auction_ended');
    };
  }, [auctionId]);

  // Handle Manual Bid Submission
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
      const socket = getSocket();
      const token = localStorage.getItem('bidora_token');

      // Emit through WebSocket for sub-100ms processing
      socket.emit('place_bid', {
        auctionId,
        amount: Number(bidAmount),
        token,
      });

      // Also listen for immediate acknowledgment or fallback error
      const onBidSuccess = (res: any) => {
        if (res.auctionId === auctionId) {
          setBidSuccess(`Success! Your bid of ${formatETB(bidAmount)} was accepted.`);
          setSubmittingBid(false);
          socket.off('bid_success', onBidSuccess);
          socket.off('bid_error', onBidError);
        }
      };

      const onBidError = (err: any) => {
        if (err.auctionId === auctionId) {
          setBidError(err.message || 'Bid rejected by server.');
          setSubmittingBid(false);
          socket.off('bid_success', onBidSuccess);
          socket.off('bid_error', onBidError);
        }
      };

      socket.once('bid_success', onBidSuccess);
      socket.once('bid_error', onBidError);

      // Fallback timeout
      setTimeout(() => {
        setSubmittingBid(false);
      }, 3000);
    } catch (err: any) {
      setBidError(err.message || 'Failed to submit bid.');
      setSubmittingBid(false);
    }
  };

  // Handle Proxy Bid Submission
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

      setProxySuccess(`Proxy activated! We will automatically bid up to ${formatETB(proxyMaxAmount)} for you.`);
      setShowProxyModal(false);
    } catch (err: any) {
      setBidError(err.message);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
          {/* Main Selected Image */}
          <div className="relative h-80 sm:h-[420px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-sm">
            <img
              src={selectedImage}
              alt={auction.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="bg-navy-950/80 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-md">
                {auction.category?.name}
              </span>
              <span className="bg-white/90 backdrop-blur-md text-slate-900 text-xs font-bold px-2.5 py-1 rounded-md">
                {auction.condition?.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Image Thumbnail Strip */}
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
            <h3 className="font-bold text-navy-900 text-base">Item Description & Specifications</h3>
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

          {/* Seller Card */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold text-base">
                {auction.seller?.profile?.fullName?.[0] || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-bold text-navy-900">
                    {auction.seller?.profile?.fullName || auction.seller?.email}
                  </h4>
                  {auction.seller?.profile?.isKycVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> Verified Seller
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Registered seller based in {auction.seller?.profile?.city || 'Ethiopia'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Bidding Control Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-6 sticky top-24">
            {/* Header Title & Status */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono">LOT #{auction.id.substring(0, 8).toUpperCase()}</span>
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  WebSocket Synchronized
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-navy-900 leading-snug">
                {auction.title}
              </h1>
            </div>

            {/* Countdown Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Time Remaining
              </span>
              <CountdownTimer endTime={auction.endTime} />
            </div>

            {/* Current Price Box */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
              <div className="flex justify-between items-baseline mb-1">
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
              <p className="text-[11px] text-slate-500 mt-1">
                Next minimum required bid: <strong className="text-navy-900 font-mono">{formatETB(minValidBid)}</strong>
              </p>
            </div>

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

            {/* Bidding Actions */}
            {!isEnded ? (
              <div className="space-y-4">
                <form onSubmit={handlePlaceBid} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Your Bid Amount (ETB)
                    </label>
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
                    Set Proxy Ceiling
                  </button>
                </div>

                {/* Inline Proxy Config Modal / Form */}
                {showProxyModal && (
                  <form onSubmit={handleSetProxyBid} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <span className="text-xs font-bold text-navy-900 block">Automatic Proxy Bidding</span>
                      <p className="text-[11px] text-slate-500">
                        Enter your maximum ceiling. The system will automatically place the minimum necessary
                        counter-bids on your behalf.
                      </p>
                    </div>
                    <input
                      type="number"
                      min={minValidBid}
                      step={increment}
                      value={proxyMaxAmount}
                      onChange={(e) => setProxyMaxAmount(Number(e.target.value))}
                      placeholder="e.g. 5,000,000"
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
                  bids.map((b, index) => (
                    <div
                      key={b.id || index}
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
                          {new Date(b.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
