# Commercial advertising — Backend

B2B directory platform connecting Chinese-speaking businesses with Vietnam.

## Architecture Overview

Sketch-style overview of how the backend fits together (API, auth, data, news pipeline, and Docker).

![Architecture Overview](docs/architecture-overview.png)

## Tech Stack

- NestJS 11 / TypeScript
- PostgreSQL 17
- Prisma 7 ORM
- JWT Authentication
- Swagger API Docs

## Getting Started

```bash
# Copy env and fill in your values
cp .env.example .env
```

### Development (Docker, hot reload)

```bash
docker compose up --build
```

### Production (Docker)

```bash
docker compose --profile prod up --build
```

Both modes run entirely in Docker — no need to install Node.js or pnpm locally.

### Local Development (without Docker for the app)

```bash
# Install dependencies (also runs prisma generate via postinstall)
pnpm install

# Start PostgreSQL
docker compose up -d postgres

# Apply database migrations
pnpm prisma migrate dev

# Seed categories and subcategories
pnpm prisma db seed

# Run dev server
pnpm start:dev
```

## Prisma (Database Schema)

After PostgreSQL is running:

```bash
# Apply migrations (development)
pnpm prisma migrate dev

# Push schema without a migration file (quick prototyping only)
pnpm prisma db push

# Seed the database
pnpm prisma db seed

# Browse and edit data in a web UI (http://localhost:5555)
pnpm prisma studio
```

Notes:

- `pnpm install` automatically runs `prisma generate` via the `postinstall` hook.
- `pnpm build` automatically runs `prisma generate` before compiling.
- After editing `schema.prisma` without migrating, run `pnpm prisma generate` manually — `postinstall` only fires on install, not on file changes.
- `pnpm prisma migrate dev` runs `prisma generate` automatically after applying the migration.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

| Variable                    | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`              | PostgreSQL connection string for Prisma                      |
| `APP_PORT`                  | Server port (default: `3000`)                                |
| `JWT_SECRET`                | Secret key for JWT signing                                   |
| `INTERNAL_API_KEY`          | API key for internal/service-to-service endpoints            |
| `OPENAI_API_KEY`            | OpenAI key used by the news translator                       |
| `OPENAI_MODEL`              | Model name (default: `gpt-4o-mini`)                          |
| `NEWS_SCHEDULE_ENABLED`     | Enable/disable the cron pipeline (default: `true`)           |
| `NEWS_CRON`                 | Cron expression for the pipeline (default: `0 */15 * * * *`) |
| `NEWS_TRANSLATE_BATCH_SIZE` | Articles translated per run (default: `5`)                   |
| `NEWS_MAX_CONTENT_CHARS`    | Max chars sent to OpenAI per article (default: `4000`)       |
| `RSS_SOURCES`               | Optional JSON array to override the built-in feed list       |
| `FRONTEND_URL`              | Allowed CORS origin for the frontend                         |

## API

- Base URL: `http://localhost:3000/api/v1`
- Swagger Docs: `http://localhost:3000/api/docs`

---

## News Module

Fetches Vietnamese RSS feeds, stores articles, and translates them into Traditional Chinese via OpenAI.

### How it works

1. A cron job runs every 15 minutes (configurable via `NEWS_CRON`)
2. It crawls all configured RSS feeds and upserts articles into the database with status `DRAFT`
3. The translator picks up `DRAFT` articles that have a Vietnamese summary, calls OpenAI, and writes back the Chinese/English translations + sets status to `PUBLISHED`
4. Only `PUBLISHED` articles are returned by the public API

### Setup

The news module requires categories and subcategories to be seeded before the crawler runs:

```bash
pnpm prisma db seed
```

This seeds 5 categories (`NEWS`, `BUSINESS`, `TECH`, `ENTERTAINMENT`, `LIFESTYLE`) and their subcategories.

### Required env vars

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini        # optional, this is the default
NEWS_SCHEDULE_ENABLED=true      # set false to disable the cron
```

### Disabling the scheduler (development)

To prevent the pipeline from running automatically during local dev:

```env
NEWS_SCHEDULE_ENABLED=false
```

Then trigger it manually via the internal endpoint when needed.

---

## Quick Smoke Tests

### Dev (Docker)

```bash
docker compose up --build
```

Then verify:

- `GET http://localhost:${APP_PORT:-3000}/${API_PREFIX:-api/v1}/health`
- `GET http://localhost:${APP_PORT:-3000}/api/docs`
- `GET http://localhost:${APP_PORT:-3000}/api/v1/news/categories`

### Prod (Docker)

```bash
docker compose --profile prod up --build
```

Then verify the same endpoints.
