# Game Art Generator

Full-stack app (Express + React) that generates game art.

- Default mode: deterministic placeholder SVG images (no external API keys required).
- Optional: real image generation using OpenAI Images API when `OPENAI_API_KEY` is set on the server.
- Persists generations to Postgres.

## Prerequisites

- Node.js 20+
- Postgres 14+

## Setup

1) Copy env files:

```bash
cp .env.example .env
cp client/.env.example client/.env
```

2) Start Postgres and create a database, then set `DATABASE_URL` in `.env`.

Example:

```bash
createdb game_art
```

3) Install & run:

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:4000/api/health

## Build

```bash
npm run build
npm run start
```
