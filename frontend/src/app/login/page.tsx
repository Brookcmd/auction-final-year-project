'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, getDashboardPathForRole } from '@/context/AuthContext';
import { Gavel, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      router.push(getDashboardPathForRole(loggedUser.role));
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('BidoraDev2026!');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-navy-900 text-white flex items-center justify-center mx-auto shadow-md">
          <Gavel className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-navy-900 tracking-tight">Sign In to BIDORA</h2>
        <p className="text-xs text-slate-500">
          Role-based portals for Buyers, Sellers, Inspectors, and Governance Officers.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-200/80 space-y-6">
          {/* Quick Demo Credentials Box */}
          <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs space-y-2">
            <span className="font-bold text-blue-900 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-600" /> Evaluation Accounts (Password: <code>BidoraDev2026!</code>)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {[
                { label: 'Super Admin', email: 'admin@bidora.et' },
                { label: 'Auction Mgr', email: 'manager.auction@bidora.et' },
                { label: 'Verify Officer', email: 'officer.verify@bidora.et' },
                { label: 'Finance Officer', email: 'officer.finance@bidora.et' },
                { label: 'Support Officer', email: 'officer.support@bidora.et' },
                { label: 'Inspector', email: 'inspector.ethio@bidora.et' },
                { label: 'Seller (Fleet)', email: 'seller.motors@bidora.et' },
                { label: 'Buyer (Solomon)', email: 'buyer.solomon@bidora.et' },
                { label: 'Buyer (Helen)', email: 'buyer.helen@bidora.et' },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleDemoFill(acc.email)}
                  className="px-2 py-1.5 bg-white border border-blue-200 hover:bg-blue-100/60 rounded text-[11px] font-semibold text-slate-800 text-left truncate"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy-900 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
            Need a new account?{' '}
            <Link href="/register" className="font-semibold text-blue-600 hover:underline">
              Register as Buyer, Seller, or Inspector
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
