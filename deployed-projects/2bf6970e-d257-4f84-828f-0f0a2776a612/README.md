# Art Creation

Full-stack app (Express + React) to create simple vector artworks stored as JSON and rendered as SVG.

## Prereqs
- Node.js >= 20
- PostgreSQL

## Setup
1) Start Postgres (example):
```bash
docker run --name artdb -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=art_creation -p 5432:5432 -d postgres:16
```

2) Configure env:
```bash
cp .env.example .env
cp client/.env.example client/.env
```

3) Install and run:
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
