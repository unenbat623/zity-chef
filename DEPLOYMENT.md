# 🚀 Zity Chef — Production Deployment

This guide takes Zity Chef from the local dev stack to a live, multi-user
platform. Everything the app needs degrades gracefully, so you can go live
incrementally.

## 0. Architecture at a glance

```
[ PWA / browser ]  →  [ CDN ]  →  [ Web host: SPA + API ]  →  [ Supabase ]
                                        │  (stateless)          Postgres + Auth
                                        │                       + Storage + Realtime
                                        ├─ Gemini (AI proxy)
                                        ├─ QPay (payments)
                                        └─ Upstash Redis (cache / rate-limit)
```

The API is **stateless** — scale it horizontally behind a load balancer; the
database is the shared source of truth.

## 1. Supabase (auth + database + storage + realtime)

1. Create a project at [supabase.com](https://supabase.com).
2. Put `DIRECT_URL` (Project Settings → Database → Connection string) in `.env`
   and run:
   ```bash
   npm run db:push
   ```
   [`supabase/migrations/`](supabase/migrations/) is the single source of truth:
   every table, RLS policy, trigger, the `uploads` storage bucket, the realtime
   publication, **and the recipe + store catalog itself**. Re-runnable — each
   migration is idempotent.
3. **Authentication → Providers**: enable **Anonymous**, **Email**, **Google**
   (add OAuth credentials). For phone OTP, configure an SMS provider under Phone.
4. Copy from **Project Settings → API**: `URL`, `anon key`, `service_role key`,
   and **JWT secret** (Settings → API → JWT).

> The app has no bundled catalog to fall back on. If step 2 is skipped, the
> recipe and store tabs report that the catalog is unavailable rather than
> quietly serving demo content.

## 2. Environment variables

Set these on your host (see [`.env.example`](.env.example) for the full list):

| Var | Where | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | server | from step 1.5 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | build | same project |
| `GEMINI_API_KEY` | server | [aistudio.google.com](https://aistudio.google.com) — AI + OCR |
| `ALLOWED_ORIGINS` | server | comma-separated prod domains |
| `VITE_API_URL` | build | leave empty if API is same-origin |
| `UPSTASH_REDIS_REST_URL/_TOKEN` | server | optional — shared cache/rate-limit at scale |
| `QPAY_USERNAME/PASSWORD/INVOICE_CODE/CALLBACK_URL` | server | optional — real payments |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` | server | optional — web push |
| `VITE_SENTRY_DSN` | build | optional — error tracking |

## 3. Deploy the app

The Express server serves both the built SPA (`dist/`) and the API when
`NODE_ENV=production`.

### Option A — Render / Railway / Fly (single service)
```
Build:  npm ci && npm run build
Start:  npm start        # NODE_ENV=production tsx server/index.ts
```
Point the host's env at step 2. Add a health check on `GET /api/health`
(and readiness on `GET /api/ready`).

### Option B — Docker
```bash
docker build -t zity-chef .
docker run -p 3002:3002 --env-file .env zity-chef
```

### Option C — Vercel (serverless API + static)
`vercel.json` is already configured: static `dist/` + `api/index.ts` serverless
function (same `createApp()` as the server). Set the env vars in the Vercel
dashboard. Note: use Upstash Redis in serverless (in-memory cache is per-cold-start).

## 4. CDN & caching

Front the host with **Cloudflare** (good Asia PoPs for Mongolia). Hashed assets
under `/assets/*` are already `immutable` cached a year; `/api/*` is `no-store`
(see `vercel.json`). Enable Brotli.

## 5. Scale checklist (→ ~1M users)

- [ ] Upstash Redis set (shared cache + per-IP rate-limit across instances)
- [ ] Supabase connection pooling (Supavisor) + a read replica for heavy reads
- [ ] Autoscale the stateless API (2+ instances) behind the LB
- [ ] Run the load test: `k6 run loadtest/store.k6.js` from multiple regions
- [ ] Sentry DSN + uptime monitoring on `/api/health`
- [ ] Nightly DB backups (Supabase has PITR on paid tiers)
- [ ] CI green (`.github/workflows/ci.yml`) before every deploy

## 6. Post-deploy smoke test

```bash
curl https://YOUR_DOMAIN/api/health      # {"status":"ok",...}
curl https://YOUR_DOMAIN/api/ready        # {"ready":true,"db":"ok"}
curl https://YOUR_DOMAIN/api/store/products
```
Then open the site: an anonymous session should be created automatically, the
fridge should load (empty for a new user), and switching MN/EN should translate
the whole UI.
