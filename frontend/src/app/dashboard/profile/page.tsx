'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import {
  ShieldCheck,
  User,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export default function ProfileKycPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  const [idType, setIdType] = useState('Ethiopian National ID (Fayda)');
  const [documentFrontUrl, setDocumentFrontUrl] = useState('');
  const [documentBackUrl, setDocumentBackUrl] = useState('');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      apiRequest('/users/profile')
        .then((res) => {
          setProfileData(res);
          setFullName(res.profile?.fullName || '');
          setPhoneNumber(res.profile?.phoneNumber || '');
          setCity(res.profile?.city || 'Addis Ababa');
          setAddress(res.profile?.address || '');
        })
        .catch(() => {});
    }
  }, [user, isLoading, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      await apiRequest('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, phoneNumber, city, address }),
      });
      setStatusMsg('Profile details updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      await apiRequest('/users/verification-request', {
        method: 'POST',
        body: JSON.stringify({
          idType,
          documentFrontUrl,
          documentBackUrl: documentBackUrl || undefined,
        }),
      });
      setStatusMsg('KYC verification request submitted for administrator review.');
      setDocumentFrontUrl('');
      setDocumentBackUrl('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit verification.');
    }
  };

  if (isLoading || !profileData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isVerified = profileData.profile?.isKycVerified;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            Profile & Identity Verification
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your contact information and verified status on BIDORA.
          </p>
        </div>
        <div>
          {isVerified ? (
            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold px-3.5 py-1.5 rounded-full">
              <ShieldCheck className="w-4 h-4" /> KYC Verified Account
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-3.5 py-1.5 rounded-full">
              <AlertCircle className="w-4 h-4" /> Pending KYC Verification
            </span>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" /> Personal Details
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-navy-900 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* KYC Submission Form */}
        <form onSubmit={handleSubmitKyc} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" /> KYC Document Verification
          </h2>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Submit a National ID or business license link to earn the Verified badge and build buyer/seller trust.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none"
            >
              <option value="Ethiopian National ID (Fayda)">Ethiopian National ID (Fayda)</option>
              <option value="Passport">Passport</option>
              <option value="Trade License">Commercial Trade License</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Document Front URL</label>
            <input
              type="url"
              required
              value={documentFrontUrl}
              onChange={(e) => setDocumentFrontUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Document Back URL (Optional)</label>
            <input
              type="url"
              value={documentBackUrl}
              onChange={(e) => setDocumentBackUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors"
          >
            Submit Verification Request
          </button>
        </form>
      </div>
    </div>
  );
}
