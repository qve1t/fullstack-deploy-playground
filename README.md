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
                                                    migrate by hand
```

There is no `migrate` service here yet. The schema is applied by hand, through
the database's public endpoint. That is a known shortcut, and closing it is the next step.

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
     ├─▶  builds     matrix: api, client
     │               docker build → push to ghcr.io
     │               tagged twice:  :<commit sha>  and  :main
     │
     └─▶  deploys    matrix: api, client          (needs: builds)
                     railway redeploy → pulls :main
```

Nothing is rebuilt along the way. The image that gets deployed is the image that was built
once, from that commit - *build once, promote*.

`deploys` declares `needs: builds`. Without that line both jobs would start at the same
time, the redeploy would usually win the race, and Railway would pull the **previous**
image. The pipeline would be green and production would be stale. That is the worst kind of
failure, because nothing looks broken.

### Knowing what is running

The build passes the commit SHA in as a build argument. The API keeps it in an environment
variable and returns it from `/health`:

```bash
curl https://<api-url>/health
{"status":"ok","dateTime":"2026-09-10T12:00:00.000Z","gitSha":"a1b2c3d…"}
```

### Secrets

| Secret          | Used for | Scope                                        |
| --------------- | -------- | -------------------------------------------- |
| `GITHUB_TOKEN`  | ghcr.io  | Created by GitHub, lives for one run          |
| `RAILWAY_TOKEN` | Railway  | Project token — one project, one environment  |

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

Postgres is the exception. Railway also gives it a public TCP endpoint, and that is what
migrations are currently run through from a laptop. It should be switched off once the
pipeline applies migrations from inside the project.
