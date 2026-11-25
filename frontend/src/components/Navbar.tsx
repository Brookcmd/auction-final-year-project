'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import {
  Gavel,
  Bell,
  PlusCircle,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Compass,
  UserCheck,
  CheckCheck,
} from 'lucide-react';

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !token) {
      setNotifications([]);
      return;
    }

    apiRequest('/notifications')
      .then((res) => setNotifications(Array.isArray(res) ? res : []))
      .catch(() => { });

    const socket = getSocket();
    socket.emit('register_user', { token });

    const handleNotification = (notif: any) => {
      setNotifications((prev) => [{ ...notif, isRead: false }, ...prev]);
    };

    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user, token]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (notif: any) => {
    if (!notif.isRead) {
      await apiRequest(`/notifications/${notif.id}/read`, { method: 'PUT' }).catch(() => { });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
    }
    setNotifOpen(false);
    if (notif.linkUrl) {
      router.push(notif.linkUrl);
    }
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/notifications/read-all', { method: 'PUT' }).catch(() => { });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center text-white shadow-md group-hover:bg-blue-600 transition-colors">
              <Gavel className="w-5 h-5 text-blue-400 group-hover:text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-navy-900">
                BID<span className="text-blue-600">ORA</span>
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                Ethiopia
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/auctions"
              className="text-sm font-medium text-slate-700 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
            >
              <Compass className="w-4 h-4" />
              Explore Auctions
            </Link>
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              How It Works
            </Link>
            {user?.role === 'ADMIN' && (
              <Link
                href="/dashboard/admin"
                className="text-sm font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Console
              </Link>
            )}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                {/* Seller Create Auction CTA */}
                {(user.role === 'SELLER' || user.role === 'ADMIN') && (
                  <Link
                    href="/dashboard/seller/create"
                    className="hidden sm:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    New Listing
                  </Link>
                )}

                {/* Dashboard Shortcut */}
                <Link
                  href={
                    user.role === 'ADMIN'
                      ? '/dashboard/admin'
                      : user.role === 'SELLER'
                        ? '/dashboard/seller'
                        : '/dashboard/buyer'
                  }
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-600" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>

                {/* Live Notification Bell */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifOpen(!notifOpen);
                      setDropdownOpen(false);
                    }}
                    className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-navy-900">
                          Notifications ({unreadCount} unread)
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[11px] text-blue-600 hover:underline font-medium flex items-center gap-1"
                          >
                            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">
                            No notifications yet.
                          </p>
                        ) : (
                          notifications.slice(0, 10).map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleMarkRead(n)}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''
                                }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-semibold text-navy-900">{n.title}</span>
                                {!n.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                {new Date(n.createdAt).toLocaleString()}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setDropdownOpen(!dropdownOpen);
                      setNotifOpen(false);
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold">
                      {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                    </div>
                    <span className="text-xs font-medium text-slate-800 hidden sm:inline max-w-[100px] truncate">
                      {user.fullName || user.email}
                    </span>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs text-slate-500 font-medium">Signed in as</p>
                        <p className="text-xs font-semibold text-slate-900 truncate">{user.email}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {user.role}
                        </span>
                      </div>
                      <Link
                        href="/dashboard/buyer"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Buyer Bids & Won Lots
                      </Link>
                      {(user.role === 'SELLER' || user.role === 'ADMIN') && (
                        <Link
                          href="/dashboard/seller"
                          onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Seller Management
                        </Link>
                      )}
                      <Link
                        href="/dashboard/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Profile & KYC Verification
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm font-semibold text-slate-700 hover:text-navy-900 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="bg-navy-900 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
