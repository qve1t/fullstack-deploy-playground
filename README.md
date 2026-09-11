# fullstack-deploy-playground — a CI/CD pipeline, with a notes app attached

A learning project. The goal is a complete deployment pipeline — from `git push`
to production — built and understood end to end.

**The application itself is deliberately boring.** It is a simple CRUD resource and it is
not the point. The point is everything around it: containerisation, CI gates, automated
deploys, database migrations, health checks, rollback and observability.

## Architecture

The same two images run locally and in production. Only the values they read at startup
change.

### Locally, with Compose

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

### In production, on Railway

Three services in one Railway project, and the same shape as above. Only the client has a
public URL. The API is private.

```
  browser
     │  :443  public URL
     ▼
┌──────────────┐   /api/   ┌──────────────┐        ┌──────────────┐
│    client    │──────────▶│     api      │───────▶│   postgres   │
│    nginx     │  private  │ Fastify :3000│private │              │
│  SPA + proxy │  network  │  no public   │network │  public TCP  │
└──────────────┘           └──────────────┘        └──────▲───────┘
                                                          │
                                                   ┌──────┴───────┐
                                                   │  db-migrate  │
                                                   │  from CI     │
                                                   └──────────────┘
```

There is no `migrate` service here. The schema is applied by the `db-migrate` job in the
deployment pipeline, from a GitHub runner, reaching Postgres through its public TCP
endpoint. Keeping that endpoint open is what this choice costs, and the reasoning for
taking it anyway is written down under *Decisions*.

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

`test-api` runs `pnpm db:generate` before the other steps. The Prisma client is
generated code and is not committed, so a fresh checkout does not have it yet. Every
developer machine has it lying around from an earlier `pnpm dev`, which is exactly why
it is easy to forget: the typecheck passes locally and fails in CI.

### Proving the gate works

A gate that has never failed is not a gate — it might be passing because it checks
nothing. So it was tested from the other side.

A pull request changed the API error handler to answer `200` where it used to answer
`404`, `409` and `400`. The code still compiled, and lint and typecheck stayed green.
The tests caught it, the build was skipped, and GitHub blocked the merge.

That order matters more than the fix. A type error would only have proved that the
compiler runs. Breaking the behaviour proved that the tests are actually load-bearing.

## Continuous deployment

A merge into `main` puts the change in production. There is no manual step in between.

`.github/workflows/build-docker.yaml` runs on every push to `main`. In practice that only
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

Nothing is rebuilt along the way. The image that gets deployed is the image that was built
once, from that commit - *build once, promote*.

`deploys` declares `needs: [builds, db-migrate]`. Without that, the jobs would all start at
the same time, the redeploy would usually win the race, and Railway would pull the
**previous** image. The pipeline would be green and production would be stale. That is the
worst kind of failure, because nothing looks broken.

### The migration runs between the build and the deploy

`db-migrate` runs `prisma migrate deploy` once. It is a single job and never a matrix: two
runners applying the same migrations to the same database at the same time is the failure
this shape avoids.

Its position in the chain is deliberate in both directions.

It runs **after** `builds`, so a failed image build never touches the production database.
Nothing is migrated for an artifact that does not exist.

It runs **before** `deploys`, which means that for the couple of minutes between the two
jobs, the old code is talking to the new schema. That window is not an accident. It is the
reason every migration has to be backward compatible with the version already running — a
change that only the new code can survive would break the site before the new code ever
ships. The pipeline makes that rule structural instead of something to remember.

If the migration fails, `deploys` is skipped. The images sit in ghcr.io, production keeps
serving the old code, and nothing ends up half-deployed.

The Prisma CLI version comes out of the lockfile: the job runs `pnpm install
--frozen-lockfile` and then `pnpm db:deploy`, the same script the Compose `migrate` service
runs. `npx prisma` would instead have downloaded whatever was newest on npm that morning
and pointed it at the production database. Prisma scopes its config filename to the major
version (`prisma7.config.ts`), so a silent jump to 8 would not even find the datasource
URL.

### Knowing what is running

The build passes the commit SHA in as a build argument. The API keeps it in an environment
variable and returns it from `/health`:

```bash
curl https://<api-url>/health
{"status":"ok","dateTime":"2026-09-10T12:00:00.000Z","gitSha":"a1b2c3d…"}
```

### Secrets

| Secret          | Used for | Scope                                             |
| --------------- | -------- | ------------------------------------------------- |
| `GITHUB_TOKEN`  | ghcr.io  | Created by GitHub, lives for one run              |
| `RAILWAY_TOKEN` | Railway  | Project token — one project, one environment      |
| `DATABASE_URL`  | Postgres | Connection string for the production database     |

`GITHUB_TOKEN` is not stored anywhere. GitHub creates it for each run, and the workflow asks
for the one permission it actually needs:

```yaml
permissions:
  contents: read
  packages: write
```

`RAILWAY_TOKEN` is a real stored secret, because Railway knows nothing about this
repository. It is a project token and not an account token, so if it leaked it would reach
one environment instead of everything on the account.

`DATABASE_URL` is the one worth worrying about. The other two are scoped API tokens; this
one is direct write access to production data. It reaches the job through the step's `env:`
block rather than being written inline into the `run:` line, because `${{ }}` is substituted
into the script text before any shell sees it — an inline secret becomes part of the command
line itself.

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
before `FROM`, so it has to repeat the version — and the `check-node-version` job fails
the build if the copy ever drifts from the original.

### Migrations run as their own job, never at app startup

Locally the `migrate` Compose service runs once and must finish before the API starts. In
production the `db-migrate` job does the same thing, one step earlier in the pipeline.

Running migrations on boot would cause two problems. With several replicas, they would all
migrate at the same time. And a failed migration would restart the app forever instead of
stopping the deploy.

Both paths run the same `pnpm db:deploy` script on the same pinned Prisma version, so what
gets exercised on a laptop is what runs against production.

### The pipeline migrates from CI, not from inside the project

The alternative was Railway's per-service pre-deploy command: the same image, run inside the
project, on the private network, before the new version starts. That route would have let
Postgres drop its public TCP endpoint entirely.

The CI job won for one reason — it is in the repository. The ordering, the failure
behaviour and the pinned CLI version are all readable in
`.github/workflows/build-docker.yaml`. A pre-deploy command is a text field in a dashboard,
invisible to anyone who clones this repo and invisible in its history.

The cost is real and is not hidden: Postgres keeps a public TCP endpoint so that a GitHub
runner can reach it, and a production connection string lives in a GitHub secret. For a
project this size that is an acceptable trade. For a database with real data in it, the
pre-deploy route is the better answer.

### The browser only talks to nginx

The frontend calls `/api`, a relative path. nginx forwards it to the API over the internal
network.

This keeps one image for every environment. Vite writes environment variables into the
bundle at build time, so an absolute API URL would need a separate image per environment,
which breaks *build once, promote*.

It also means the page and the API share an origin, so there is no CORS setup at all.

Both environments put a proxy in front of the API, and both strip the prefix the same way:

| Environment | Proxy           | Mapping                 |
| ----------- | --------------- | ----------------------- |
| dev         | Vite dev server | `/api/notes` → `/notes` |
| production  | nginx           | `/api/notes` → `/notes` |

### The container builds its own config when it starts

nginx cannot read environment variables. Its config is a static file.

But one value has to differ per environment: where the API is. Under Compose it is
`http://api:3000`, on Railway it is e.g. `http://api.railway.internal:3000`.

The official nginx image already solves this. At container start, before nginx runs,
anything in `/etc/nginx/templates/*.template` is passed through `envsubst` and written into
`/etc/nginx/conf.d/`. So the repo holds `nginx.conf.template` with `${API_UPSTREAM}` and
`${DNS_RESOLVER}` in it, and the real config is produced when the container boots.

### nginx looks the API up on every request

The upstream address goes into a variable first:

```nginx
resolver ${DNS_RESOLVER} ipv6=on valid=10s;

location /api/ {
    set $upstream ${API_UPSTREAM};
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass $upstream;
}
```

This looks like a detour and it is not. When `proxy_pass` holds a literal hostname, nginx
resolves it **once, at startup**, and caches that address for the life of the process. On
Railway the private address of a service changes every time it is redeployed. So every
deploy of the API would break the frontend until nginx was restarted — with both health
checks still green, which makes it very hard to find.

A variable in `proxy_pass` changes the behaviour: nginx resolves the name per request, using
the `resolver` directive and its short `valid=` window. The frontend recovers by itself
within ten seconds of an API deploy.

The `rewrite` line is what that costs. The trailing slash in `proxy_pass http://api:3000/`
used to strip the `/api` prefix on its own, and that stops happening once a variable is
involved, so the prefix is now stripped explicitly.

### Every image gets two tags

Each build pushes `:<commit sha>` and `:main`.

The SHA tag is the real one. It never changes, and it says exactly which commit produced the
image — which is what makes an investigation or a rollback possible at all.

`:main` exists for one reason: the Railway CLI cannot change which image a service points
at, only their GraphQL API can. So the service is pinned to a tag that moves, and `railway
redeploy` pulls whatever that tag means now.

### Only the frontend is published

The API listens on port 3000 inside the Compose network and has no host port. Postgres has
one, but only so that local development can reach it.

Production is almost the same. Only the client service has a generated domain, and the API
is reachable on the private network only, so the one way in from the internet is through
nginx.

Postgres is the exception. Railway also gives it a public TCP endpoint, and the
`db-migrate` job reaches the database through it. That endpoint stays open on purpose — see
*The pipeline migrates from CI* above — and it is the one way into an otherwise private
network that does not go through nginx.
