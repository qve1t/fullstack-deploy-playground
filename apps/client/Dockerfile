FROM node:26.5.0-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@11.13.0
COPY  pnpm-lock.yaml /app/
RUN pnpm fetch
COPY . /app/
RUN pnpm install --frozen-lockfile --offline
RUN pnpm run build

FROM nginx:1.31.5-alpine AS prod
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
