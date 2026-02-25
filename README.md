# VN Buyer's Guide — Backend

B2B directory platform connecting Chinese-speaking businesses with Vietnam.

## Tech Stack

- NestJS 11 / TypeScript
- PostgreSQL 17
- Prisma ORM
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
# Install dependencies + generate Prisma client
pnpm install
pnpm prisma generate

# Start PostgreSQL
docker compose up -d postgres

# Apply database schema
pnpm prisma migrate dev

# Run dev server
pnpm start:dev
```

## Prisma (Database Schema)

After PostgreSQL is running, apply the schema:

```bash
# Create/apply migrations (development)
pnpm prisma migrate dev

# Push schema without migrations (quick prototyping)
pnpm prisma db push
```

```bash
# Browse and edit data in a web UI (http://localhost:5555)
pnpm prisma studio
```

Note: `pnpm build` automatically runs `prisma generate` before compiling.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string for Prisma |
| `APP_PORT` | Server port (default: 3000) |
| `JWT_SECRET` | Secret key for JWT signing |
| `INTERNAL_API_KEY` | API key for internal services (RSS poller, AI) |

## API

- Base URL: `http://localhost:3000/api/v1`
- Swagger Docs: `http://localhost:3000/api/docs`

## Quick Smoke Tests

### Dev (Docker)

```bash
docker compose up --build
```

Then verify:

- `GET http://localhost:${APP_PORT:-3000}/${API_PREFIX:-api/v1}/health`
- `GET http://localhost:${APP_PORT:-3000}/api/docs`

### Prod (Docker)

```bash
docker compose --profile prod up --build
```

Then verify the same endpoints.
