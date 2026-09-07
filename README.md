# fullstack-deploy-playground — a CI/CD pipeline, with a notes app attached

A learning project. The goal is a complete deployment pipeline — from `git push`
to production — built and understood end to end.

**The application itself is deliberately boring.** It is a simple CRUD resource and it is
not the point. The point is everything around it: containerisation, CI gates, automated
deploys, database migrations, health checks, rollback and observability.

## Architecture

The whole stack starts with a single `docker compose up`. The browser only talks to
nginx; everything else stays on the internal Compose network.

```
  browser
     │  :8000
     ▼
┌──────────────┐   /api/   ┌──────────────┐        ┌──────────────┐
│    client    │──────────▶│     api      │───────▶│   postgres   │
│  nginx 1.31  │           │ Fastify :3000│        │     :5432    │
│  SPA + proxy │           │ not published│        └──────▲───────┘
└──────────────┘           └──────────────┘               │
                                                   ┌──────┴───────┐
                                                   │   migrate    │
                                                   │ one-shot job │
                                                   └──────────────┘
```

Startup is ordered by health:

1. `postgres` starts and must report **healthy** (`pg_isready`).
2. `migrate` runs `prisma migrate deploy` and must **exit 0**.
3. `api` starts only then (`condition: service_completed_successfully`), verifies its
   database connection, and refuses to start if that fails.
4. `client` starts once the API reports healthy.

A failed migration therefore stops the stack, instead of leaving a running application
pointed at an unmigrated database.

## Stack

| Layer           | Choice                                                    |
| --------------- | --------------------------------------------------------- |
| Backend         | Node 26.5.0 + TypeScript + Fastify 5                      |
| Frontend        | React 19 + Vite 8, served by nginx                        |
| Database        | PostgreSQL 18, Prisma 7 (`@prisma/adapter-pg`)            |
| Package manager | pnpm 11                                                    |
| Lint / format   | Biome                                                      |
| Base images     | `node:26.5.0-alpine`, `nginx:1.31.5-alpine`               |
| CI/CD           | not built yet                                              |

## Running the whole thing

```bash
cp .env.example .env          # Postgres credentials, read by Compose
docker compose up --build
```

Then open <http://localhost:8000>.

Starting from an empty volume works — the `migrate` job creates the schema before the API
comes up.

## Local development

For a fast edit loop, run only the database in Docker and the apps natively:

```bash
docker compose up postgres -d

cd apps/api    && cp .env.example .env && pnpm install && pnpm dev
cd apps/client && pnpm install && pnpm dev
```

Natively the API reaches Postgres at `localhost:5432` through the published port; inside
Compose it uses the `postgres` service name, which Docker's embedded DNS resolves on the
project network.

## Tests

Each app has four small tests that run without PostgreSQL, Docker or a running API.
The API uses Node's test runner with the existing `tsx` dependency and Fastify's
`inject` to check health, user creation, validation and a missing user. The client
uses Vitest with a mocked `fetch` to check URL encoding, note creation, API errors
and empty responses after deletion.

## Decisions

### The apps are separate projects, not a pnpm workspace

`apps/api` and `apps/client` each have their own lockfile, Biome config and `node_modules`.

A workspace would give CI one `pnpm install` instead of two. But building a container for
a single app would then need `pnpm deploy --filter` to pull that app out of a shared
lockfile. The two apps share no code, so that trade is not worth making yet.

### The Node version is written down in one place

The exact version lives in `.nvmrc` at the repo root. It sits at the root because it
describes the development environment, not one app.

Three tools need that version and none of them share config: nvm, GitHub Actions and
Docker. The rule is **derive it where a tool can read the file, verify it where a tool
cannot.** `actions/setup-node` reads `.nvmrc` directly. A Dockerfile cannot read a file
before `FROM`, so it repeats the version, and CI checks that the two still match.

### Migrations run as their own job, never at app startup

The `migrate` service runs once and must finish before the API starts.

Running migrations on boot would cause two problems. With several replicas, they would all
migrate at the same time. And a failed migration would restart the app forever instead of
stopping the deploy.

The same `migrate` build target will later become the release command on the hosting
platform.

### The browser only talks to nginx

The frontend calls `/api`, a relative path. nginx forwards it to the API over the internal
network.

This keeps one image for every environment. Vite writes environment variables into the
bundle at build time, so an absolute API URL would need a separate image per environment,
which breaks *build once, promote*.

It also means the page and the API share an origin, so there is no CORS setup at all.

### Only the frontend is published

The API listens on port 3000 inside the Compose network and has no host port. Postgres has
one, but only so that local development can reach it.

## Next

Continuous integration — lint, typecheck, test and build as required checks on every
pull request.
