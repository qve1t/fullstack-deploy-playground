# Notes client

React client for the users and notes API. Styling is provided by Pico CSS.

## Run locally

Start the API on port `3000`, then run:

```sh
pnpm install
pnpm dev
```

During development, Vite proxies `/api` requests to `http://localhost:3000`.
Set `VITE_API_URL` to use a different API base URL.

## Structure

- `src/api.ts` — API types and requests
- `src/UserPage.tsx` — user selection and creation
- `src/NotePage.tsx` — notes CRUD
- `src/components` — presentational forms, lists and note cards
- `src/App.tsx` — switches between both views
- `src/main.tsx` — application entry point

## Quality checks

```sh
pnpm lint
pnpm build
```

Apply safe Biome fixes and formatting with `pnpm lint:fix`.
