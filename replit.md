# Sentinel AI

Sentinel AI classifies social media text, monitors sentiment signals, benchmarks NLP models, and explores keyword analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sentinel-ai` — responsive React/Vite application with dashboard, analyzer, dataset upload, benchmarks, analytics, and architecture views
- `artifacts/api-server/src/routes/intelligence.ts` — sentiment classification and intelligence endpoints
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `artifacts/sentinel-ai/src/index.css` — Sentinel AI theme and shared visual tokens

## Architecture decisions

- The first build uses deterministic hybrid-style lexical scoring so the analysis flow is functional without requiring an external model or API key.
- Dashboard and benchmark values are seeded research fixtures exposed through typed read endpoints, while ad hoc analysis and uploads are processed live.
- Uploads use a JSON envelope so the typed client can handle CSV, JSON, and XLSX content through the shared API route; CSV and JSON are parsed server-side and XLSX is accepted with a preview fallback.

## Product

- Overview dashboard with sentiment health, analyzed volume, positive share, seven-day movement, platform mix, and recent signal feed
- Interactive classification with five selectable model families, confidence, polarity, keyword evidence, and explanation
- Dataset preview and batch classification for CSV, JSON, and XLSX uploads up to the configured request limit
- Model benchmark comparison, keyword landscape, NLP pipeline architecture, and project metadata

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
