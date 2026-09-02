# fullstack-playground-demo — a CI/CD pipeline, with a notes app attached

A learning project. The goal is a complete deployment pipeline — from `git push`
to production — built and understood end to end.

**The application itself is deliberately boring.** It is a simple CRUD resource and it is not the point. The point is everything around it:
containerisation, CI gates, automated deploys, database migrations, health checks, rollback and observability.

## Stack

| Layer            | Choice                                          |
| ---------------- | ----------------------------------------------- |
| Backend          | Node + TypeScript (framework TBD)               |
| Frontend         | React + Vite *(not built yet)*                  |
| Database         | PostgreSQL *(not wired up yet)*                 |
| Package manager  | pnpm                                            |
| Lint / format    | Biome                                           |
| CI/CD            | GitHub Actions → ghcr.io → Fly.io *(planned)*   |

## Running API locally

```bash
cd apps/api
nvm use        # picks up .nvmrc from the repo root
pnpm install
pnpm dev
```
