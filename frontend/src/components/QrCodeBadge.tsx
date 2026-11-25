'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCodeBadge({ itemCode, size = 110 }: { itemCode: string; size?: number }) {
  const [svgDataUrl, setSvgDataUrl] = useState<string>('');

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const targetUrl = `${origin}/verify/${itemCode}`;
    QRCode.toDataURL(targetUrl, { width: size, margin: 1, color: { dark: '#0A192F', light: '#FFFFFF' } })
      .then((url) => setSvgDataUrl(url))
      .catch(() => {});
  }, [itemCode, size]);

  if (!svgDataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-slate-100 rounded-lg animate-pulse flex items-center justify-center text-[10px] text-slate-400"
      >
        QR
      </div>
    );
  }

  return (
    <img
      src={svgDataUrl}
      alt={`QR verification code for ${itemCode}`}
      width={size}
      height={size}
      className="rounded-lg border border-slate-200 bg-white p-1"
    />
  );
}
