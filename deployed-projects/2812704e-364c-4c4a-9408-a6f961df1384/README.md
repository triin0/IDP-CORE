# Bookmark Manager (REST API + React)

## Prerequisites
- Node.js 18+
- Postgres 14+

## Setup
1. Create a database and apply migrations:

```sql
-- Run the SQL in: server/src/schema/migrations.sql
```

2. Configure environment variables:
- Copy `.env.example` to `.env` at repo root and fill values.
- Optionally copy `client/.env.example` to `client/.env`.

3. Install dependencies:

```bash
npm install
```

## Development

```bash
npm run dev
```

- API: `http://localhost:4000/api`
- Client: `http://localhost:5173`

## Build

```bash
npm run build
npm start
```

## API Endpoints
- `GET /api/bookmarks`
- `GET /api/bookmarks/:id`
- `POST /api/bookmarks`
- `PUT /api/bookmarks/:id`
- `DELETE /api/bookmarks/:id`
