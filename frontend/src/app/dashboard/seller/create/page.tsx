'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { PlusCircle, AlertCircle } from 'lucide-react';

export default function CreateAuctionPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('USED');
  const [locationCity, setLocationCity] = useState('Addis Ababa');
  const [startingPrice, setStartingPrice] = useState<number>(50000);
  const [reservePrice, setReservePrice] = useState<number | undefined>();
  const [bidIncrement, setBidIncrement] = useState<number>(1000);
  const [durationHours, setDurationHours] = useState<number>(48);
  const [imageUrl, setImageUrl] = useState(
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
  );
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [requiresInspection, setRequiresInspection] = useState(true);
  const [requiresBidSecurity, setRequiresBidSecurity] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !isLoading &&
      (!user || (user.role !== 'SELLER' && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN'))
    ) {
      router.push('/login');
      return;
    }

    apiRequest('/categories').then((res) => {
      setCategories(res || []);
      if (res && res.length > 0) setCategoryId(res[0].id);
    });
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      await apiRequest('/auctions', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          categoryId,
          condition,
          locationCity,
          startingPrice: Number(startingPrice),
          reservePrice: reservePrice ? Number(reservePrice) : undefined,
          bidIncrement: Number(bidIncrement),
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
          imageUrls: [imageUrl],
          saveAsDraft,
          requiresInspection,
          requiresBidSecurity,
          isRestricted,
        }),
      });

      router.push('/dashboard/seller');
    } catch (err: any) {
      setError(err.message || 'Failed to create auction');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          Submit Auction Listing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Listings enter BIDORA’s centralized approval and inspection pipeline before going live.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 2021 Toyota Hilux Double Cab D-4D 4x4"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none"
            >
              <option value="BRAND_NEW">Brand New / In Box</option>
              <option value="LIKE_NEW">Like New / Pristine</option>
              <option value="REFURBISHED">Certified Refurbished</option>
              <option value="USED">Used / Functional</option>
              <option value="FOR_PARTS">For Parts / Salvage</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description & Specifications</label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide technical specifications, service history, inspection notes, and terms..."
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Starting Price (ETB)</label>
            <input
              type="number"
              min={1}
              required
              value={startingPrice}
              onChange={(e) => setStartingPrice(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Min Bid Increment (ETB)</label>
            <input
              type="number"
              min={1}
              required
              value={bidIncrement}
              onChange={(e) => setBidIncrement(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reserve Price (Optional ETB)</label>
            <input
              type="number"
              min={1}
              value={reservePrice || ''}
              onChange={(e) => setReservePrice(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Duration</label>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none"
            >
              <option value={1}>1 Hour (Quick Test)</option>
              <option value={24}>24 Hours</option>
              <option value={48}>48 Hours</option>
              <option value={72}>72 Hours</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location City</label>
            <input
              type="text"
              required
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cover Image URL</label>
          <input
            type="url"
            required
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none"
          />
        </div>

        {/* Governance & Safeguard Flags */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={requiresInspection} onChange={(e) => setRequiresInspection(e.target.checked)} />
            <span>Require Independent Inspection Report</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={requiresBidSecurity} onChange={(e) => setRequiresBidSecurity(e.target.checked)} />
            <span>Require Buyer Bid Security Deposit</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isRestricted} onChange={(e) => setIsRestricted(e.target.checked)} />
            <span>Restricted Auction (KYC Approved Bidders Only)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={saveAsDraft} onChange={(e) => setSaveAsDraft(e.target.checked)} />
            <span>Save as Draft (Submit Later)</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          {submitting ? 'Submitting...' : saveAsDraft ? 'Save Draft Listing' : 'Submit Listing for Governance Review'}
        </button>
      </form>
    </div>
  );
}
