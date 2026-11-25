# Frontend (Next.js 14 App Router UI)

## Overview

The `frontend/` application is a Next.js 14 App Router web client built with React 18, TypeScript, Tailwind CSS, Lucide icons, Framer Motion, and `socket.io-client`. It serves public auction discovery, the real time bidding room, and role dashboards for buyers, sellers, and administrators.

## Key files

| File | Owns |
|---|---|
| `src/app/layout.tsx` | Root layout wrapping pages in `AuthProvider`, `Navbar`, and `Footer` using local `font-sans` |
| `src/context/AuthContext.tsx` | Client auth state backed by `localStorage` (`bidora_token`, `bidora_refresh_token`, `bidora_user`) |
| `src/lib/api.ts` | `apiRequest` fetch wrapper targeting `NEXT_PUBLIC_API_URL` (`http://localhost:4000/api/v1`) with Bearer token |
| `src/lib/socket.ts` | Singleton `getSocket()` Socket.IO client targeting `NEXT_PUBLIC_SOCKET_URL` (`http://localhost:4000`) |
| `src/lib/utils.ts` | `formatETB` currency formatting, `formatTimeLeft` countdown helper, and `cn` class helper |
| `src/components/Navbar.tsx` | Navigation bar, live notification bell dropdown (`notification` socket listener), and user menu |
| `src/components/CountdownTimer.tsx` | Live countdown display highlighting final 5 minutes and final 30 second anti sniping window |
| `src/app/auctions/[id]/page.tsx` | Live auction room (gallery, quick bid chips, proxy setup, SVG price sparkline, watchlist, report form) |
| `src/app/dashboard/buyer/page.tsx` | Active bids, won auctions, watchlist, and simulated Telebirr / CBE Birr escrow workflow |
| `src/app/dashboard/seller/page.tsx` | Seller listing table, metrics, and link to `/dashboard/seller/create` |
| `src/app/dashboard/admin/page.tsx` | Fraud flag review, user suspension controls, KYC review queue, audit logs, and listing reports |
| `src/app/dashboard/profile/page.tsx` | Profile editor and KYC verification document submission |

## Commands

```bash
# Development server (port 3000)
npm run dev

# Production build and server
npm run build
npm start

# Lint
npm run lint
```

## Conventions

- Keep system `font-sans` configured in `tailwind.config.js` and `layout.tsx` instead of `next/font/google` so offline and sandboxed builds succeed without fetching Google Fonts.
- Wrap components calling `useSearchParams()` (such as `src/app/auctions/page.tsx`) in a `<Suspense>` boundary so `next build` static generation succeeds.
- Keep visual design aligned with the deep navy palette (`navy-900`, `navy-950`, slate surfaces, blue accents) and Lucide icons (avoid emojis as UI icons).
- Display real database counts on landing statistics rather than hardcoded fallback numbers.

## Gotchas

- `AuthContext` reads tokens from `localStorage` inside a client `useEffect`; dashboard pages should guard redirects on `!isLoading` before pushing unauthenticated users to `/login`.
- Socket.IO client connections in `getSocket()` authenticate via handshake `auth.token`; after login, `Navbar` also emits `register_user` so personal outbid notifications arrive without reconnecting.
