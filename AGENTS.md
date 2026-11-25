# BIDORA

## Stack

- **Language / Runtime**: TypeScript, Node.js
- **Framework**: NestJS 10 backend (`backend/`) and Next.js 14 App Router frontend (`frontend/`)
- **Key dependencies**: Prisma 5, PostgreSQL (Neon Lakebase Postgres), Socket.IO, Redis (`ioredis`), Tailwind CSS
- **Package manager**: npm

## Build approach

<TBD, set by /scope>

## Commands

```bash
# Install dependencies (each app separately)
cd backend && npm install
cd frontend && npm install

# Dev servers (backend on :4000, frontend on :3000)
cd backend && npm run start:dev
cd frontend && npm run dev

# Build both apps
cd backend && npm run build
cd frontend && npm run build

# Run backend unit tests
cd backend && npm test
```

## ADRs

Stored in `docs/adr/`. Format: `docs/adr/NNNN-title.md`.

## Rules

- Keep `backend/` and `frontend/` strictly decoupled; communicate only over REST (`/api/v1`) and Socket.IO.
- Never trust client clocks or client bid amounts; validate all bids, increments, and timers on the server.
- Never expose private proxy ceilings (`ProxyBid.maxAmount`), password hashes, or secret tokens in responses or logs.
- Use `ETB` (Ethiopian Birr) as the primary currency; keep payment integrations clearly marked as simulated until live credentials exist.
- Never commit `.env`, `.env.local`, or `backend/.env` credentials to version control.

## Agent skills

- [neon](C:/Users/user/.gemini/config/skills/neon/) (`neondatabase/agent-skills`, Neon project config in `neon.ts`, branching, and primitives)
- [neon-postgres](C:/Users/user/.gemini/config/skills/neon-postgres/) (`neondatabase/agent-skills`, Lakebase Postgres pooled vs direct URLs and migrations)
Declined: nestjs-best-practices, vercel-react-best-practices, nextjs-app-router, prisma-nestjs-patterns, database-migrations, context7-mcp
MCP servers: neon (connected)

## Context files

- [backend/AGENTS.md](backend/AGENTS.md) (NestJS API, Prisma schema, Neon Postgres, Redis locks, and real time bidding engine)
- [frontend/AGENTS.md](frontend/AGENTS.md) (Next.js 14 App Router, Tailwind CSS, Socket.IO client, and role dashboards)
