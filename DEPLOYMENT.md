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

## Going live: domain and QPay

Two things are needed from outside the code — the public domains and the QPay
merchant credentials. Everything else is already wired.

### 0. The short version

Given a backend URL, one command wires it up and proves it works:

```bash
npm run connect -- --api https://api.example.mn --shop https://shop.example.mn
```

It writes the address into both `.env` files **and** into the storefront's
`index.html`, then calls the API the way each client does — health, catalog,
recipes, the Odoo bridge, the payment mode — and checks the storefront's origin
is allowed through CORS. A backend running outside production is called out
rather than passed, because its CORS handler allows every origin and a green
result there would mean nothing.

No rebuild is needed. The storefront reads the backend address from a
`<meta name="zity-chef-api">` tag in `index.html` before its bundled `VITE_*`
value, so moving the backend is an edit to a static file rather than a new
build and deploy of the whole app. An empty or unsubstituted tag falls back to
`VITE_ZITY_CHEF_API_URL`, so existing deploys keep working untouched.

Use `--verify-only` to check an address without writing anything.

### 1. Point every setting at the real domains

Eight settings across the two repos carry a host. Set them together, because one
left on `localhost` fails quietly: QPay never calls back, or the browser is
refused by CORS, or Google sign-in returns to the wrong site.

```bash
npm run domain:set -- --api https://api.example.mn --shop https://shop.example.mn
npm run domain:set -- --api … --shop … --dry-run     # preview first
```

`--api` is where `/api/*` is served (QPay calls back here), `--shop` is the
storefront, and `--app` is Chef's own web app when it lives on a third host.
The command rewrites both `.env` files, keeps a timestamped backup of each, and
prints the two dashboard changes it cannot make for you: the Supabase redirect
URLs and the QPay callback registration.

### 2. Fill in the QPay credentials

`QPAY_USERNAME`, `QPAY_PASSWORD` and `QPAY_INVOICE_CODE` come from QPay. Then:

```bash
npm run qpay:check                    # full preflight
npm run qpay:check -- --no-invoice    # stop after authentication
```

It walks the same path production does — configuration, `/auth/token`, callback
reachability, `/invoice`, `/payment/check` — and says what to fix at each step.
It creates one small real invoice (10₮ by default, `--amount` to change) to
prove the `invoice_code` is accepted; nobody pays it and an unpaid QPay invoice
expires by itself.

### What changes the moment QPay is live

- `POST /api/payments/qpay/create` stops returning `503 PAYMENTS_UNAVAILABLE`
  and issues real invoices, so the storefront can take orders in production.
- The payment sheet drops its "ДЕМО ТӨЛБӨР" banner on its own — it keys off the
  `simulated` flag the server returns, not off a build-time constant.
- Cancellations refund automatically instead of queuing as `manual`. Orders paid
  *before* the switch have no QPay payment id recorded and stay manual; check
  `GET /api/payments/refunds/outstanding` after going live.

### Odoo product master

Odoo owns the products. Order lines are resolved there by `odoo_product_id`,
then `odoo_product_sku`, then `sku`, so an Odoo database without the catalog
fails every order sync with `Odoo product not found` no matter how healthy the
connection is — `/api/odoo/status` still reports `connected: true`.

```bash
npm run db:push                    # gives every catalog row its SKU
npm run odoo:seed                  # dry run: prints what would be created
npm run odoo:seed -- --confirm     # creates one Odoo product per SKU
```

The seed is idempotent — a `default_code` that already exists in Odoo is linked
to the catalog row rather than duplicated — and it also creates the service
product behind `ODOO_DELIVERY_PRODUCT_SKU` that delivery-fee lines need. Add
`--stock N` to apply an opening on-hand quantity.

New products have no stock in Odoo, and `/api/odoo/products?sync=true` copies
Odoo's `qty_available` into the catalog's `stock_quantity`. Checkout rejects any
line whose stock is below the requested quantity, so syncing an Odoo database
with no inventory loaded would make every basket unbuyable.

The sync guards against exactly that: when Odoo reports zero on hand for *every*
inventory-tracked product, the stock column is left untouched and a warning is
written to the Odoo sync log. Prices and Odoo ids still sync. A genuine partial
stockout — at least one product with stock left — syncs through as normal.

The guard keeps a fresh database from taking the shop offline; it does not make
stock sync work. Until real inventory is loaded in Odoo, `stock_quantity` stays
at whatever the catalog already held and the storefront is not stock-accurate.
Load opening quantities in Odoo (Inventory → Physical Inventory, or
`npm run odoo:seed -- --confirm --stock N` at seed time), then run the sync.

### What reaches Odoo, and when

| Chef event | Odoo |
| --- | --- |
| Order paid (`POST /api/orders`) | sale order created, confirmed, invoiced, payment registered |
| Order cancelled (`POST /api/orders/:id/cancel`) | invoice reversed into a credit note, sale order cancelled |
| Operator moves packing → shipping → delivered | nothing: `sale.order` has no fulfilment stages |
| Admin retry (`POST /api/odoo/orders/:id/retry`) | re-syncs, and invoices an order whose invoice is missing |

`ODOO_AUTO_SYNC_ORDERS=false` stops the first two; `ODOO_AUTO_INVOICE_ORDERS=false`
keeps the sale order but leaves invoicing to whoever invoices on delivery.

Journal and company ids for the accounting steps come from the Odoo database
itself (Accounting → Configuration → Journals): `ODOO_PAYMENT_JOURNAL_ID` is the
bank/cash journal used to register invoice payments, `ODOO_CREDIT_NOTE_JOURNAL_ID`
the sales journal used to reverse them. `ODOO_PRICELIST_ID` is only meaningful
when pricelists are enabled in that database; leave it empty otherwise.

### Refunds on cancellation

Cancelling an order raises a credit note in Odoo *and* returns the payment.
Those are two different things: the credit note balances the ledger, the refund
moves money. Both cancel entry points — the customer's
`POST /api/orders/:id/cancel` and an admin's `POST /api/odoo/orders/status`
with `status: cancelled` — go through the same refund, which claims the payment
with a conditional update so a payment is refunded at most once.

A refund is only automatic when QPay is fully configured (`QPAY_USERNAME`,
`QPAY_PASSWORD`, `QPAY_INVOICE_CODE`) **and** the payment carries a QPay payment
id. That id is captured when the payment is verified, so orders paid before this
was added, and every order taken in simulated mode, cannot be refunded through
the API.

Nothing is ever reported as refunded unless QPay confirmed it. When it cannot be
done automatically the payment is marked `manual` with the reason — that is
money the business still owes a customer:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://YOUR_DOMAIN/api/payments/refunds/outstanding      # chef admin only
```

`manual` rows need a human in the QPay merchant console. `failed` rows are
gateway errors and are retryable:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://YOUR_DOMAIN/api/payments/refunds/INVOICE_ID/retry
```

Check this list after any cancellation while QPay is in simulated mode — every
cancelled order will land there, because no money was collected to return.

### Odoo bridge smoke test

After Odoo admin data and production env vars are set, run:

```bash
SMOKE_API_URL=https://YOUR_DOMAIN \
SMOKE_ACCESS_TOKEN=SUPABASE_USER_ACCESS_TOKEN \
SMOKE_ORDER_ID=ZITY-123456 \
npm run odoo:smoke
```

Without `SMOKE_ORDER_ID`, the script checks bridge health, products, logs, and
reconciliation only. With `SMOKE_ORDER_ID`, it also verifies sale order sync,
duplicate guarding, invoice creation, status pull, and status push.

Locally, `npm run odoo:credentials` fills both values in `.env` for you: it
issues a session for the first address in `CHEF_ADMIN_EMAILS` through the service
role key and picks that user's newest syncable order. It needs the service role
key, so it is a local operator tool — never run it in CI or against a shell you
do not control.

Getting `SMOKE_ACCESS_TOKEN` by hand: every check except `status` sits behind
`requireSignedIn`, and `logs` and `reconcile` additionally require the caller's
email to be listed in `CHEF_ADMIN_EMAILS`. Sign in to the Chef UI as that admin,
then copy the token from DevTools → Application → Local Storage → the
`sb-<project-ref>-auth-token` entry → `access_token`. It is valid for one hour;
`TOKEN_EXPIRED` in the smoke output means fetch a fresh one. Leaving it unset is
not a failure — the script prints `SKIP <check>: SMOKE_ACCESS_TOKEN not set` and
exits 0, so a green run with skips has verified far less than it appears to.

`SMOKE_ORDER_ID` must reference an order already in `paid`, `packing`,
`shipping`, or `delivered`; anything earlier is rejected with `Only paid orders
can be synced to Odoo`. Note the lifecycle checks are **not read-only** — they
create a real sale order and a real invoice in the target Odoo database, so
point them at a staging DB unless you intend those records to exist.
