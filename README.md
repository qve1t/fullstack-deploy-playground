# fullstack-deploy-playground - a CI/CD pipeline, with a notes app attached

A learning project. The goal is a complete deployment pipeline - from `git push`
to production - built and understood end to end.

**The application itself is deliberately boring.** It is a simple CRUD resource and it is
not the point. The point is everything around it: containerisation, CI gates, automated
deploys, database migrations, health checks, rollback and observability.

## Architecture

The application has the same core runtime topology and frontend request path locally and in
production. nginx serves the React SPA and proxies its `/api/` requests to the Fastify API,
which talks to PostgreSQL. On Railway, both the client and the API have public URLs; the demo
API is intentionally unauthenticated because authentication is outside this project's scope.

```
  browser
     │  client URL
     ▼
┌──────────────┐    /api/    ┌──────────────┐     SQL     ┌──────────────┐
│    client    │────────────▶│     API      │────────────▶│  PostgreSQL  │
│ React + nginx│             │ Fastify :3000│             │    :5432     │
└──────────────┘             └──────────────┘             └──────────────┘
```

|                     | Local                                                   | Production                                                     |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Orchestration       | Docker Compose                                          | Railway                                                        |
| HTTP access         | Client on `localhost:8000`; API internal to Compose     | Public client and API URLs                                     |
| Migrations          | One-shot `migrate` service before the API starts        | `db-migrate` CI job between the image build and deployment     |
| Database exposure   | Port published for running the API natively during dev  | Public TCP endpoint used by the GitHub Actions migration job   |

Both migration paths must succeed before the application starts or is deployed.

### Frontend routing

The frontend calls the relative `/api` path. Vite proxies it during native development;
nginx serves the SPA and proxies it in containers. This keeps one browser origin, avoids
CORS and allows one client image to be configured at runtime for each environment. Direct
API clients can use the separate public API URL.

At startup, nginx renders
[`nginx.conf.template`](apps/client/nginx.conf.template) with the API address and DNS
resolver. Runtime DNS resolution lets the client recover when Railway changes the API's
private address after a redeploy.

## Stack

| Layer           | Choice                                                    |
| --------------- | --------------------------------------------------------- |
| Backend         | Node 26.5.0 + TypeScript + Fastify 5                      |
| Frontend        | React 19 + Vite 8, served by nginx                        |
| Database        | PostgreSQL 18, Prisma 7 (`@prisma/adapter-pg`)            |
| Package manager | pnpm 11                                                    |
| Lint / format   | Biome                                                      |
| Base images     | `node:26.5.0-alpine`, `nginx:1.31.5-alpine`               |
| CI              | GitHub Actions, required checks on every pull request      |
| CD              | GitHub Actions → ghcr.io → Railway, on every merge to main |

Both Dockerfiles use multi-stage builds, keeping build tools out of the final API and nginx
images.

## Running locally

For the complete stack, use Compose:

```bash
cp .env.example .env          # Postgres credentials, read by Compose
docker compose up --build
```

Then open <http://localhost:8000>.

Starting from an empty volume works - the `migrate` job creates the schema before the API
comes up.

For a faster edit loop, run only PostgreSQL in Docker:

```bash
docker compose up postgres -d
```

Then start the applications in separate terminals:

```bash
# API
cd apps/api
cp .env.example .env
pnpm install
pnpm dev
```

```bash
# Client
cd apps/client
pnpm install
pnpm dev
```

The native API connects to the published database port at `localhost:5432`; in Compose it
connects to `postgres:5432` on the project network.

## Tests

The test suite is intentionally small. Its main purpose in this project is to provide a
real CI gate: every pull request runs it, and a failing test blocks the merge. All ten
tests run without PostgreSQL, Docker or a running API.

Six API tests use Node's test runner and Fastify's `inject`; four client tests use Vitest
with a mocked `fetch`. They cover enough behaviour to prove that the gate can catch a
regression while staying fast and deterministic.

These isolated tests do not verify the integration between the client, API and a real
database. That limitation is acceptable here because the pipeline, rather than test
coverage, is the focus of the project.

## Continuous integration

Every pull request against `main` runs `.github/workflows/test.yaml`. `main` is a
protected branch and those checks are required, so a red pipeline disables the merge
button.

Three jobs run in parallel:

| Job                  | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `check-node-version` | Compares `.nvmrc` with the `FROM node:` lines             |
| `test-api`           | lint → typecheck → test → build, inside `apps/api`        |
| `test-client`        | lint → typecheck → test → build, inside `apps/client`     |

Each app gets its own job, so a red pipeline says which app broke.

Inside a job the cheap steps run first. Lint and typecheck finish in seconds and the
build takes longest, so a broken type never reaches a build. The first failing step
ends the job and everything after it is skipped.

`test-api` generates the Prisma client before its quality checks because generated code is
not committed. This makes the job work from a clean checkout.

## Continuous deployment

A merge into `main` puts the change in production. There is no manual step in between.

`.github/workflows/build-docker.yaml` runs on every push to `main`. That only
happens through a pull request, because `main` is protected and the CI checks are required.

```
merge to main
     │
     ▼
  builds        matrix: api, client
     │          docker build → push to ghcr.io
     │          tagged twice:  :<commit sha>  and  :main
     ▼
  db-migrate    prisma migrate deploy      (needs: builds)
     │          one job, never a matrix
     ▼
  deploys       matrix: api, client        (needs: builds, db-migrate)
                railway redeploy → pulls :main
```

The immutable SHA tag identifies the exact artifact for traceability and rollback; the
moving `:main` tag is the reference Railway redeploys. Nothing is rebuilt along the way.

### Migrations gate the deploy

`db-migrate` is a single job, never a matrix, so CI starts only one migration runner
against the production database. It runs the lockfile-pinned `pnpm db:deploy` command
instead of migrating at application startup, where multiple replicas could run it at once.

Its position provides two guards: a failed build never touches the database, and a failed
migration prevents the new application version from being deployed. Production continues
running the previous version.

Because the schema changes before the application does, the old code briefly runs against
the new schema. Every migration must therefore be backward compatible with the version
already in production.

### Knowing what is running

The build passes the commit SHA in as a build argument. The API keeps it in an environment
variable and returns it from `/health/live`:

```bash
curl https://<api-url>/health/live
{"status":"ok","dateTime":"2026-09-10T12:00:00.000Z","gitSha":"a1b2c3d…"}
```

### Secrets

| Secret          | Used for | Scope                                             |
| --------------- | -------- | ------------------------------------------------- |
| `GITHUB_TOKEN`  | ghcr.io  | Created by GitHub, lives for one run              |
| `RAILWAY_TOKEN` | Railway  | Project token - one project, one environment      |
| `DATABASE_URL`  | Postgres | Connection string for the production database     |

GitHub creates `GITHUB_TOKEN` for each run and grants it only repository read and package
write access. `RAILWAY_TOKEN` is scoped to one project, while `DATABASE_URL` is exposed only
to the migration step through its environment.

## Backward-compatible migrations

Because migrations run before new images are deployed, schema changes follow the
expand-and-contract pattern:

1. **Expand:** add the new nullable structure while the old code remains valid.
2. **Transition:** dual-write, backfill existing rows and switch reads to the new structure.
3. **Contract:** tighten constraints and remove the old structure only after no deployed
   version depends on it.

The rename from `Note.title` to `Note.heading` exercised the full sequence. Its database
steps remain visible in the [Prisma migration history](apps/api/prisma/migrations).

## Health checks and shutdown

| Endpoint        | Returns 200 when                          |
| --------------- | ----------------------------------------- |
| `/health/live`  | The API process is running                |
| `/health/ready` | A `SELECT 1` query against Postgres works |

Compose uses `/health/live` to check the API. `/health/ready` answers **503** when the
database is unavailable and is ready to be wired into a routing or deployment check.

On `SIGTERM`, the API closes Fastify, disconnects from Postgres and allows five seconds for
a graceful shutdown before forcing the process to exit.

## Observability

The API uses Pino for structured application and request logs. Production emits JSON with
the deployed commit SHA in every record, while local development enables `pino-pretty`.
Railway collects the production logs and provides service-level infrastructure metrics.

## Rolling back

The manually triggered `.github/workflows/rollback.yaml` takes a commit SHA and reuses the
API and client images already stored in ghcr.io:

```
workflow_dispatch(sha)
     │
     ▼
  verify       both :<sha> images exist
     │
     ▼
  retag        point both :main tags at them
     │
     ▼
  deploy       redeploy both Railway services
```

Retagging changes registry manifests without rebuilding the images. This follows Railway's
[mutable-tag deployment pattern](https://docs.railway.com/guides/private-container-registry):
both workflows share the `deploy-main` concurrency group so they cannot move `:main` at the
same time.

Rollback changes only the application images; it does not reverse database migrations.
The earlier version therefore still depends on backward-compatible schema changes.
