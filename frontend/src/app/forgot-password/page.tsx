'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Gavel, Mail, KeyRound, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [mode, setMode] = useState<'request' | 'reset'>(initialToken ? 'reset' : 'request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setMode('reset');
    }
  }, [initialToken]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(
        res.message ||
          'If an account matches that email address, password reset instructions have been issued.',
      );
    } catch (err: any) {
      setError(err.message || 'Unable to process password reset request.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(res.message || 'Password updated successfully. You may now sign in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-navy-900 text-white flex items-center justify-center mx-auto shadow-md">
          <Gavel className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-navy-900 tracking-tight">Account Recovery</h2>
        <p className="text-xs text-slate-500">
          Request a password reset or enter your recovery token to set a new password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-200/80 space-y-5">
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('request');
                setError(null);
                setMessage(null);
              }}
              className={`py-2 rounded-lg transition-colors ${
                mode === 'request' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Request Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setError(null);
                setMessage(null);
              }}
              className={`py-2 rounded-lg transition-colors ${
                mode === 'reset' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Have Reset Token
            </button>
          </div>

          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          {mode === 'request' ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@bidora.et"
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-navy-900 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {loading ? 'Submitting Request...' : 'Send Reset Instructions'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleCompleteReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recovery Token
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste recovery token"
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-navy-900 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {loading ? 'Updating Password...' : 'Reset Password'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
            Remembered your credentials?{' '}
            <Link href="/login" className="font-semibold text-blue-600 hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-500">
          Loading account recovery...
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
