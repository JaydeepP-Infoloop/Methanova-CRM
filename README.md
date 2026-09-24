# methanova-crm

CRM, Compliance & Billing platform for Methanova Pvt Ltd (BioCNG/CBG EPC).

The living product and engineering reference is **[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)**. Re-read it before any new feature.

## Prerequisites

- Node.js 20+
- pnpm 9
- Docker (MongoDB replica set)

## Local setup

```bash
pnpm install
docker compose up -d
# If the replica set is not yet initiated:
docker exec methanova-mongo mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
cp .env.example apps/api/.env
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
