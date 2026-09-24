# Methanova CRM

## Overview

CRM, Compliance & Billing platform for Methanova Pvt Ltd (BioCNG/CBG EPC). It runs the full lifecycle
from a sales lead through Quotation, MOU, and into an active Project — with compliance licence
tracking, billing/invoicing, and payment schedules feeding off that same pipeline.

The living product and engineering reference is **[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)** —
read it before any new feature. **[MODULE_MAP.md](./MODULE_MAP.md)** tracks what is actually built
and verified vs. scaffolded. **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** documents the UI patterns.

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **API:** Node.js, Express, TypeScript, Mongoose (MongoDB, replica-set transactions), Zod validation, JWT auth (access + rotating refresh tokens)
- **Web:** React 18, Vite, TypeScript, TanStack Query, TanStack Table, React Hook Form, React Router, Tailwind CSS
- **Shared:** `@methanova/shared-types` — DTOs, lifecycle/state-machine definitions, and permission matrix shared between API and web
- **Database:** MongoDB 7 (replica set, required for transactions), run via Docker Compose

## Features

- **Auth & RBAC** — login/session, refresh-token rotation, server-enforced permission matrix
- **CRM** — lead inbox & intake, assignment, activity timeline, qualification scoring, stage transitions, park/mark-dead
- **Quotations** — price lines, payment-terms templates, revision workflow with required revision reasons, approval status workflow
- **MOU** — mapped from an accepted quotation, contract-value-based Director-approval gate, signing creates the Project, payment schedule, and licence checklist in one transaction
- **Projects** — auto-created from a signed MOU, inherits client/geography/capacity/feedstock/civil-scope data
- **Compliance** — per-project licence checklist seeded from configurable licence-type master data
- **Billing** — GST-aware invoices, payment schedules instantiated from the quotation's payment-terms template
- **Admin master data** — geography, feedstock types, lead sources, licence types, qualification criteria, MOU approval threshold, org letterhead

See [MODULE_MAP.md](./MODULE_MAP.md) for the authoritative, checkbox-tracked list of what is built and verified vs. still scaffolded.

## Project Structure

```
apps/
  api/            Express + Mongoose backend (apps/api/src/modules/** — one folder per domain module)
  web/            React + Vite frontend (apps/web/src/modules/** mirrors the API's module boundaries)
packages/
  shared-types/   DTOs, lifecycle/state-machine, permission matrix — shared by api and web
  config/         Shared ESLint/Tailwind/TypeScript base configs
scripts/          Dev tooling (module scaffolding, Mongo replica-set init)
```

## Requirements

- Node.js 20+
- pnpm 9
- Docker (for the MongoDB replica set)

## Environment Setup

Copy the template and fill in real values for local development:

```bash
cp .env.example apps/api/.env
```

See [.env.example](./.env.example) for the full list of variables (Mongo connection, JWT secret, token TTLs, web origin, optional seed-admin credentials).

## Installation

```bash
pnpm install
```

## Development

```bash
docker compose up -d
# If the replica set is not yet initiated:
docker exec methanova-mongo mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4000

## Build

```bash
pnpm build
```

Other workspace-wide scripts: `pnpm lint`, `pnpm typecheck`.

## Deployment

No deployment pipeline is set up yet — the project currently runs from local development only.

## Important Notes

- MongoDB **must** run as a replica set — the API relies on multi-document transactions for every write that touches more than one collection (e.g. signing an MOU creates the Project, payment schedule, and licence checklist atomically).
- `docker-compose.yml` provisions Mongo only; there is no bundled email/SMTP, object storage, or external API integration configured yet.
