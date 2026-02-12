# VN Buyer's Guide — Backend

B2B directory platform connecting Chinese-speaking businesses with Vietnam.

## Tech Stack

- NestJS 11 / TypeScript
- PostgreSQL 17
- TypeORM
- JWT Authentication
- Swagger API Docs

## Getting Started

```bash
# Copy env and fill in your values
cp .env.example .env
```

### Production

```bash
docker compose up --build
```

### Development (with hot reload)

```bash
docker compose --profile dev up --build
```

Both modes run entirely in Docker — no need to install Node.js or pnpm locally.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

## API

- Base URL: `http://localhost:3000/api/v1`
- Swagger Docs: `http://localhost:3000/api/docs`
