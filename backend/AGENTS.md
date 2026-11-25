# Backend (NestJS API & Real Time Bidding Engine)

## Overview

The `backend/` application runs a modular NestJS 10 server on port `4000` with a REST API (`/api/v1`), Swagger docs (`/api/docs`), and a Socket.IO WebSocket gateway. It owns authentication, auction lifecycle management, atomic bid processing, proxy bidding, escrow transactions, notifications, and fraud analytics against Neon Lakebase Postgres.

## Key files

| File | Owns |
|---|---|
| `src/main.ts` | Nest bootstrap, global `/api/v1` prefix, `ValidationPipe`, CORS, Swagger on `/api/docs` |
| `src/app.module.ts` | Root module wiring `ConfigModule` (reads `.env`, `../.env.local`, `../.env`), `ScheduleModule`, and feature modules |
| `prisma/schema.prisma` | PostgreSQL schema with `url` (`DATABASE_URL`) and `directUrl` (`DATABASE_URL_UNPOOLED`) |
| `prisma/seed.ts` | Demonstration seed script with `ETB` auctions and dev accounts (`BidoraDev2026!`) |
| `src/redis/redis.service.ts` | Distributed locks (`acquireLock`, `releaseLock` Lua script), cached auction state, and thread safe memory fallback |
| `src/modules/bidding/bidding.service.ts` | Atomic bid validation, 30s anti sniping soft close, audit logging, and outbid notifications |
| `src/modules/bidding/proxy-bidding.service.ts` | Deterministic automatic counter bidding up to private `ProxyBid.maxAmount` |
| `src/modules/bidding/bidding.gateway.ts` | Socket.IO rooms (`auction:<id>`, `user:<id>`), live viewer counts, clock sync, and bid broadcasts |
| `src/modules/auctions/auction-timer.service.ts` | 10 second `@Cron` job closing expired auctions and creating escrow `Transaction` rows |
| `src/modules/analytics/analytics.service.ts` | Platform counts and explainable heuristic fraud scans (rapid velocity, shill alternation) |

## Commands

```bash
# Generate Prisma client and push schema (uses directUrl DATABASE_URL_UNPOOLED)
npx prisma generate
npx prisma db push

# Seed demo accounts and Ethiopian auction lots
npm run prisma:seed

# Build and start production bundle (emits dist/main.js)
npm run build
npm run start:prod

# Run Jest unit tests
npm test
```

## Conventions

- Use `bcryptjs` (pure JavaScript) rather than native `bcrypt` for password and refresh token hashing.
- Wrap all bid mutations in `RedisService.acquireLock('auction:' + auctionId)` with a `finally` release block.
- Protect routes with `JwtAuthGuard` and `RolesGuard` (`@Roles(...)`), or `OptionalJwtAuthGuard` when a route serves both guests and logged in users (`GET /auctions/:id`).
- Keep `tsconfig.build.json` excluding `prisma` so `nest build` outputs `dist/main.js` (required by `start:prod` and `Dockerfile`).
- Use `where.AND` when combining multiple `OR` filter groups in Prisma queries (as in `AuctionsService.findAll`).

## Gotchas

- `RedisService` and `PrismaService` intentionally catch startup connection errors so the process boots without crashing if local Redis is offline; `AuctionTimerService` wraps cron DB checks in `try/catch`.
- Running `npx prisma db push` while a Node backend process is active on Windows can log an `EPERM` rename warning on `query_engine-windows.dll.node`; stop the running server before regenerating the client if schema models changed.
- Neon computes may scale to zero when idle; the first connection after idle can take a few seconds.

## Agent skills

- [neon-postgres](C:/Users/user/.gemini/config/skills/neon-postgres/) (`neondatabase/agent-skills`, pooled vs direct connections and Prisma migrations on Neon)
