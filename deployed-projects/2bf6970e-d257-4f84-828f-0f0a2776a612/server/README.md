# Art Creation (Server)

## Environment
- Copy `../.env.example` to `../.env` and set `DATABASE_URL` and `CLIENT_URL`.

## Database
This app expects PostgreSQL.

Example (Docker):
```bash
docker run --name artdb -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=art_creation -p 5432:5432 -d postgres:16
```

## Run
```bash
npm install
npm run dev
```

On startup, the server runs idempotent SQL migrations to create required tables.
