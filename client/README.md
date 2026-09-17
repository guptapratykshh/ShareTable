# ShareTable web

Vite + React frontend for ShareTable. It talks to the ShareTable API over `/api` in local dev, or `VITE_API_URL` in production builds.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

The local Vite server proxies `/api` to `http://localhost:3001`. Start the API from the backend repository first.

## Production

Set `VITE_API_URL` to the public API origin (no trailing slash), then:

```bash
npm run build
```
