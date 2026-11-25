'use client';

import React, { useState, useEffect } from 'react';
import { formatTimeLeft } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  endTime: string | Date | number;
  onExpire?: () => void;
  compact?: boolean;
}

export default function CountdownTimer({ endTime, onExpire, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(formatTimeLeft(endTime));

  useEffect(() => {
    const timer = setInterval(() => {
      const calculated = formatTimeLeft(endTime);
      setTimeLeft(calculated);

      if (calculated.isExpired) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onExpire]);

  if (timeLeft.isExpired) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-rose-600"></span>
        Auction Ended
      </div>
    );
  }

  const isUrgent = timeLeft.totalSeconds <= 300; // Less than 5 minutes
  const isAntiSnipingActive = timeLeft.totalSeconds <= 30; // Final 30 seconds

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium ${
          isUrgent
            ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
            : 'bg-slate-100 text-slate-800'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>
          {timeLeft.days > 0 && `${timeLeft.days}d `}
          {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {isAntiSnipingActive && (
        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Anti-Sniping Active: Bids in last 30s extend auction!</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {timeLeft.days > 0 && (
          <div className="bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-center min-w-[45px]">
            <span className="text-base font-bold font-mono">{timeLeft.days}</span>
            <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans">Days</span>
          </div>
        )}
        <div className="bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-center min-w-[45px]">
          <span className="text-base font-bold font-mono">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans">Hrs</span>
        </div>
        <div className="bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-center min-w-[45px]">
          <span className="text-base font-bold font-mono">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans">Min</span>
        </div>
        <div
          className={`rounded-lg px-2.5 py-1.5 text-center min-w-[45px] ${
            isUrgent ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-900 text-white'
          }`}
        >
          <span className="text-base font-bold font-mono">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="block text-[9px] uppercase tracking-wider text-slate-200 font-sans">Sec</span>
        </div>
      </div>
    </div>
  );
}
