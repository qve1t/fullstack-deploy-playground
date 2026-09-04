FROM node:26.5.0-alpine AS base
WORKDIR /app

FROM base AS pnpm-base
RUN npm i -g pnpm@11.13.0

FROM pnpm-base AS build
COPY  pnpm-lock.yaml pnpm-workspace.yaml /app/
RUN pnpm fetch
COPY . /app/
RUN pnpm install --frozen-lockfile --offline
RUN pnpm run build

FROM build AS migrate
CMD ["pnpm", "run", "db:deploy"]

FROM pnpm-base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --prod && pnpm install --prod --frozen-lockfile --offline

FROM base AS prod
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
USER node
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "dist/main.js"]
