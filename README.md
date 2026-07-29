# amper-las-shopify

Shopify app for AMPER Live Assisted Sales (LAS). Config-and-extensions only: the app's
backend is `las-backend` (Django) - OAuth, webhooks, the app proxy and event ingest all
live there (`apps/live/shopify.py` + `apps/live/shopify_views.py`). This repo holds what
Shopify itself versions and distributes:

- `shopify.app.toml` - app URLs, scopes, GDPR webhook endpoints, app proxy.
- `extensions/las-theme-embed` - theme app extension (app embed block): chat widget
  loader, visitor/session cookies, cart-attribute purchase attribution, signed customer
  identity via the app proxy.
- `extensions/las-web-pixel` - Web Pixel: browser funnel events (view_item, add_to_cart,
  begin_checkout, ...) posted to the public-key ingest endpoint. Purchases deliberately
  come from the `orders/create` webhook instead (ad-blocker-proof, non-forgeable).

## Architecture in one paragraph

A merchant installs the app (OAuth) and confirms on the LAS console login wall, which
creates the platform-neutral `TrackedSite` + a `ShopifyShopLink` row. las-backend then
registers webhooks, writes the store's public key into app-owned metafields (the embed
block reads them - the merchant copies nothing) and activates the Web Pixel with the same
settings. The merchant's only manual step is switching the app embed on in the theme
editor (the connect success page deep-links there).

## Dev loop

```
npm install
npm run dev        # shopify app dev: pick the company dev store, tunnel, hot reload
```

`shopify app dev` needs the app's `client_id` (run `shopify app config link` once, signed
in to the company Partner account). Set `SHOPIFY_PUBLIC_BASE_URL` in las-backend's `.env`
to the tunnel host so OAuth callbacks and webhooks reach your local :8001.

Verify after changes: install on the dev store, activate the embed in the theme editor,
then browse / add to cart / order and watch events arrive in the LAS console (Live tab).

## Release

Push to `main` -> `.github/workflows/deploy.yml` runs `shopify app deploy`, which creates
and releases a new app version (config + both extensions atomically). Propagation to
shops takes minutes; server-side changes in las-backend are instant and independent.
Note the deploy is repo-wide: an extension missing from the checkout would be REMOVED
from the released version.

## Not in phase 1 (decided, not forgotten)

- Embedded admin UI (App Bridge/Polaris) and Built for Shopify - only needed for an App
  Store listing; the LAS console is the app's UI until then.
- Shopify Billing API - unlisted/custom distribution keeps billing on LAS's own Stripe;
  an App Store listing requires moving merchant billing to Shopify App Pricing (0%
  revenue share up to 1M USD lifetime) or a written external-billing exception.
- checkouts/carts webhooks - the Web Pixel already covers the funnel; doubling up would
  double-count.
