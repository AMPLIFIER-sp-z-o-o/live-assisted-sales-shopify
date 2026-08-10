# Development

This document describes the development workflow, architecture and release process for the Shopify app. To install the app on a store, see [README.md](README.md).

The app mirrors the amper-b2c reference integration contract 1:1, same as the WordPress plugin: GA4 storefront events, chat widget with signed customer identity, ad-blocker-proof money events and buy-from-chat.

## Architecture

This repo is config-and-extensions only: the app's backend is `las-backend` (Django) - OAuth, webhooks, the app proxy and event ingest all live there. This repo holds what Shopify itself versions and distributes to shops.

```
shopper's browser                       Shopify platform                    las-backend (Django)
┌──────────────────────┐
│ theme embed          │── first-party ─▶ App Proxy /apps/las/* ─────────▶ /api/shopify/proxy/track|identity
│ (chat widget +       │    (shop's own domain - invisible to ad blockers)
│  funnel tracker)     │
├──────────────────────┤
│ web pixel            │── direct POST ──────────────────────────────────▶ /api/widget/v1/pixel-events/
│ (checkout + fallback)│
└──────────────────────┘
                          orders/create, checkouts/create ── webhooks ───▶ /api/integrations/shopify/webhooks/
                          (durable, non-forgeable money events)
```

A merchant installs the app (OAuth) and confirms on the LAS console login wall, which creates the platform-neutral `TrackedSite` + a `ShopifyShopLink` row. las-backend then registers webhooks, writes the store's public key into app-owned metafields (the embed block reads them via `app.metafields.las.*` - the merchant copies nothing) and activates the Web Pixel with the same settings. The merchant's only manual step is switching the app embed on in the theme editor (the connect success page deep-links there).

Event sources are split by what each transport is good at, and duplicates collapse on deterministic `event_id`s at ingest:

- **Theme embed** (`extensions/las-theme-embed`) - chat widget loader, first-party `las_visitor_id`/`las_session_id` cookies, cart-attribute purchase attribution, signed customer identity, and the first-party funnel tracker posting through the App Proxy. Honours Shopify's Customer Privacy consent API. The embed's "Show the chat bubble" setting (default on) hides only the widget loader - tracking keeps running.
- **Web Pixel** (`extensions/las-web-pixel`) - browser funnel in Shopify's strict sandbox; the only source that runs on checkout pages and on stores where the embed is off. Watches the embed's `las_fp_ts` heartbeat cookie and stays silent while the embed is alive, so the two never double-report.
- **Webhooks** - `orders/create` is the ONLY source of purchases (ad-blocker-proof, non-forgeable), `checkouts/create` backs up begin_checkout (same `bc-{token}` event_id as the pixel's checkout_started, so whichever arrives first wins), `app/uninstalled` flips the store's kill switch (history stays; reconnect restores).

The browser-side endpoints accept the NON-secret public key plus a hard allowlist: everything money-authoritative (purchase, payment/shipping steps) is webhook-only, so a shopper with devtools cannot forge revenue.

Backend component map (in las-backend, not this repo):

- `apps/live/shopify.py` - platform primitives: OAuth, the three signature schemes (webhook body HMAC, OAuth callback query HMAC, app proxy signature - all keyed with the app client secret), Admin GraphQL calls (webhook registration, metafields, webPixelCreate).
- `apps/live/shopify_views.py` - install entry, OAuth callback, login-walled connect confirm, the webhook receiver, the pixel ingest endpoint and the app-proxy track/identity endpoints.
- `templates/live/shopify_connect.html` - the confirm/success/error page.
- `apps/tenants` - the `ShopifyShopLink` model (shop domain -> TrackedSite + access token).

## Repository layout

- `shopify.app.toml` - production app config: URLs, scopes, declarative webhook subscriptions, the three mandatory GDPR endpoints, the app proxy. `shopify app deploy` ships this; server code deploys separately with las-backend.
- `shopify.app.qa.toml` - the QA twin (separate app "AMPER LAS (QA)", every URL on qa.live-assisted-sales.com). Deploy with `npx shopify app deploy --config qa`.
- `extensions/las-theme-embed/` - theme app extension (app embed block), one Liquid file.
- `extensions/las-web-pixel/` - Web Pixel extension. Keeps its OWN `package.json` - see the release traps below.
- `.github/workflows/deploy.yml` - CI deploy on push to main.

## Environment / credentials

las-backend `.env` needs (per environment - prod and QA are separate Shopify apps with separate keys):

- `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` - from the app's settings page in the company Partner account's Dev Dashboard (Reveal next to the secret).
- `SHOPIFY_PUBLIC_BASE_URL` - the public host Shopify calls back to (prod: `https://live-assisted-sales.com`; dev: your tunnel host).

The owner-side setup (Partner account, creating the apps, dev store, CI token) is documented in the owner instruction in the main repo (`instrukcja-shopify-wlasciciel-2026-07-29.md`).

## Dev loop

```
npm install
npm run dev        # shopify app dev: pick the company dev store, tunnel, hot reload
```

`shopify app dev` needs the app's `client_id` (run `shopify app config link` once, signed in to the company Partner account). Set `SHOPIFY_PUBLIC_BASE_URL` in las-backend's `.env` to the tunnel host so OAuth callbacks and webhooks reach your local :8001.

Verify after changes: install on the dev store, activate the embed in the theme editor, then browse / add to cart / order and watch events arrive in the LAS console (Live tab).

### Company dev store

| Resource | Value |
|---|---|
| Storefront | https://las-shop-demo.myshopify.com (storefront password: `bausao`) |
| Shopify admin | via the company Partner account (asynowiecki@amplifier.pl) |
| LAS console | https://live-assisted-sales.com, workspace `tenant1@example.com` |

Dev-store limitation, do not re-debug: development stores force storefront password protection, and Shopify does not serve app proxies on password-protected stores - `/apps/las/*` 404s exactly like a nonexistent path. The embed detects this and falls back to the direct widget endpoint for funnel events, but the signed chat identity and first-party tracking only work on a real (password-off) store. Our half is proven by `test_shopify_proxy.py`.

### Tests

The integration's tests live in las-backend (Django runner, not pytest):

```
make test ARGS='apps.live.tests.test_shopify_connect apps.live.tests.test_shopify_webhooks apps.live.tests.test_shopify_pixel_events apps.live.tests.test_shopify_proxy --keepdb'
```

## Releasing

**Push to `main`.** `.github/workflows/deploy.yml` runs `shopify app deploy`, which creates and releases a new app version (config + both extensions atomically) whenever the push touches `extensions/**` or `shopify.app.toml`. Propagation to shops takes minutes; there is nothing to install on the merchant side. Server-side changes in las-backend deploy independently and are instant.

Traps (each one cost a debugging round - do not rediscover them):

- **The deploy is repo-wide**: an extension missing from the checkout would be REMOVED from the released version.
- The CI secret is `SHOPIFY_APP_AUTOMATION_TOKEN` (Dev Dashboard → the app → Settings → "Create automation token"; it expires and needs re-issuing - current one expires 2027-01-27). It is NOT `SHOPIFY_CLI_PARTNERS_TOKEN`.
- `--allow-updates` is required with an automation token, or the CLI stops to ask about app-config changes and the job hangs until the runner times out.
- The web pixel needs its own `npm install --prefix extensions/las-web-pixel`, or the CLI HANGS instead of failing (bundler cannot resolve `@shopify/web-pixels-extension`).
- In the workflow YAML, never put `": "` inside an unquoted `run:` scalar - YAML reads it as a mapping and the whole workflow file silently invalidates (runs fail with zero jobs).

## Connect handshake

The flow rhymes with the WordPress plugin's PKCE connect, but the handshake is Shopify's own OAuth - Shopify holds the secret and hands US the token, so the piece that needs care is different:

1. The merchant starts at `{LAS}/integrations/shopify/install/?shop=X.myshopify.com` (the console's add-store row, the README's direct link, or Shopify opening the app). The view normalizes the shop domain, parks a `state` in cache and redirects to Shopify's OAuth authorize page.
2. Shopify redirects back to `/integrations/shopify/oauth/callback/` with an HMAC-signed query. The backend verifies it, redeems the code for an offline access token, and parks the token server-side under a one-time code - the browser only ever carries that code, never the token.
3. The merchant lands on the login-walled `/integrations/shopify/connect/?code=...` and confirms. That binds the shop to their LAS account: `TrackedSite` (created or reused - reinstalling never creates a second store), `ShopifyShopLink` with the token, then best-effort side setup (webhook registration, metafields, pixel activation - failures log but never lose the token; reconnecting retries them).

Guards mirror WordPress: a shop already linked to a different account is refused (409), only owners within their plan's store limit can create new stores, and the pending code is burned only on successful confirm, so a login round-trip does not kill the attempt.

## Platform gotchas (decided/diagnosed - trust these)

- `webPixelCreate` needs the `write_pixels` AND `read_customer_events` scopes.
- PII webhook topics (`orders/create`) need the Protected Customer Data declaration in the Partner Dashboard (self-serve for dev stores; App Store review only for a listing). Without it, TOML webhook subscriptions fail to deploy and API-created ones never deliver.
- Shopify strips trailing slashes from webhook URIs and refuses 301s - Django's APPEND_SLASH redirect reads as "Invalid webhook URL" in delivery logs. Slashless URL aliases exist in `apps/live/urls.py`; keep them.
- Admin API versions sunset after 12 months; the pinned version lives in `apps/live/shopify.py` (`ADMIN_API_VERSION`) and in both extension TOMLs. Bump them together.
- App-data metafields must be owned by the APP INSTALLATION (`currentAppInstallation`, plain `las` namespace) - writing them onto the shop succeeds silently but stays invisible to Liquid.

## Event taxonomy (GA4, same as b2c)

- **Webhook events** (accurate, durable): `purchase` (with `metadata.order`, from `orders/create`; cart attributes `las_visitor_id`/`las_session_id` attribute it to the browsing session, missing attributes degrade to a synthetic identity - an unattributed sale is still a sale), `begin_checkout` (from `checkouts/create`, event_id `bc-{token}`).
- **Browser events** via the theme embed (App Proxy, source `shopify_embed`) and the Web Pixel (source `shopify_pixel`): `view_item_list`, `view_item`, `search`, `view_cart`, `add_to_cart`, `remove_from_cart`, `select_item`, `session_start`, `session_end`, `scroll_depth`, `page_ping`. Money-authoritative types are rejected from the browser.
- **Identity**: only platform-asserted claims are stamped - `logged_in_customer_id` on app-proxy requests (browser payload identity claims are stripped), the customer on the order webhook, and the HMAC-signed `window.LAS_CUSTOMER` chat identity fetched from `/apps/las/identity/`.

## Not in phase 1 (decided, not forgotten)

- Embedded admin UI (App Bridge/Polaris) and Built for Shopify - only needed for an App Store listing; the LAS console is the app's UI until then.
- Shopify Billing API - unlisted/custom distribution keeps billing on LAS's own Stripe; an App Store listing requires moving merchant billing to Shopify App Pricing (0% revenue share up to 1M USD lifetime) or a written external-billing exception.
- `checkouts/carts` webhooks - the Web Pixel already covers the funnel; doubling up would double-count.
