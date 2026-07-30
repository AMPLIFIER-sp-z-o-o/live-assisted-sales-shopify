// AMPER Live Assisted Sales - Web Pixel.
//
// Maps Shopify's standard analytics events onto the LAS GA4 event taxonomy and posts
// them (batched) to the public-key ingest endpoint. The write key never appears here:
// this code runs in every shopper's browser, so it authenticates with the NON-secret
// public key and the backend hard-rejects anything money-authoritative from this path -
// purchase and the payment/shipping steps come from the orders/create webhook instead
// (which is also why checkout_completed is deliberately not subscribed).
//
// Identity: the theme embed owns the las_visitor_id / las_session_id cookies; the pixel
// reads them through the sandbox cookie API so both surfaces tell one story. On pages
// where the embed never ran (e.g. a direct checkout link) the pixel mints its own.
//
// Division of labour with the theme embed: the embed tracks the storefront first-party
// through the app proxy (ad-blocker-proof) and refreshes the las_fp_ts heartbeat cookie
// on every page load. While that heartbeat is fresh the pixel suppresses its storefront
// events - otherwise every view would land twice. The pixel still owns checkout pages
// (where theme code cannot run) and every store whose merchant never enabled the embed,
// and checkout_started carries the deterministic bc-{token} id so the checkouts/create
// webhook collapses into it instead of double-counting.

import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, settings }) => {
  const apiBase = (settings.api_base || "").replace(/\/+$/, "");
  const publicKey = settings.public_key || "";
  if (!apiBase || !publicKey) {
    return;
  }
  const endpoint = `${apiBase}/api/widget/v1/pixel-events/`;

  const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
  const FLUSH_INTERVAL_MS = 5000;
  const MAX_BATCH = 20;
  // The embed rewrites las_fp_ts on every page load with a 120s max-age; 90s of slack
  // keeps one long-lived storefront tab from flapping between the two sources.
  const EMBED_FRESH_MS = 90 * 1000;

  async function embedActive() {
    const stamp = parseInt((await browser.cookie.get("las_fp_ts")) || "0", 10);
    return Boolean(stamp) && Date.now() - stamp < EMBED_FRESH_MS;
  }

  let queue = [];
  let flushTimer = null;
  let sessionStartSent = false;

  const randomId = (prefix) =>
    prefix +
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  async function ids() {
    let visitorId = await browser.cookie.get("las_visitor_id");
    if (!visitorId) {
      visitorId = randomId("v-");
      await browser.cookie.set(`las_visitor_id=${visitorId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`);
    }
    let sessionId = await browser.cookie.get("las_session_id");
    if (!sessionId) {
      sessionId = randomId("s-");
      await browser.cookie.set(`las_session_id=${sessionId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`);
    }
    return { visitorId, sessionId };
  }

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!queue.length) {
      return;
    }
    const events = queue.splice(0, MAX_BATCH);
    // keepalive lets the last batch of a page survive navigation, same job sendBeacon
    // does for the WordPress tracker.
    fetch(endpoint, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey, events }),
    }).catch(() => {
      /* telemetry is best-effort */
    });
    if (queue.length) {
      flushTimer = setTimeout(flush, 0);
    }
  }

  async function emit(eventType, event, fields, { storefront = true } = {}) {
    // Storefront events belong to the embed's first-party tracker whenever it is alive;
    // checkout events always pass (the embed cannot run on checkout pages).
    if (storefront && (await embedActive())) {
      return;
    }
    const { visitorId, sessionId } = await ids();
    const context = event.context || {};
    const page = context.document || {};
    const base = {
      event_type: eventType,
      event_id: `px-${event.id || randomId("e-")}`,
      visitor_id: visitorId,
      session_id: sessionId,
      occurred_at: event.timestamp || new Date().toISOString(),
      url: (page.location && page.location.href) || "",
      page: { title: page.title || "" },
      metadata: {
        source: "shopify_pixel",
        user_agent: (context.navigator && context.navigator.userAgent) || "",
      },
    };
    if (!sessionStartSent) {
      // Exactly one session_start per page load, whatever event happens to arrive first;
      // the backend dedupes across page loads by the session-scoped event_id.
      sessionStartSent = true;
      if (eventType !== "session_start") {
        queue.push({ ...base, event_type: "session_start", event_id: `px-session-${sessionId}` });
      } else {
        base.event_id = `px-session-${sessionId}`;
      }
    }
    queue.push({ ...base, ...fields });
    if (queue.length >= MAX_BATCH) {
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    }
  }

  const productPayload = (variant) => {
    const product = (variant && variant.product) || {};
    const price = (variant && variant.price) || {};
    return {
      id: String(product.id || ""),
      sku: variant && variant.sku ? String(variant.sku) : "",
      name: [product.title, variant && variant.title].filter(Boolean).join(" - "),
      url: product.url || "",
      price: price.amount != null ? String(price.amount) : "",
      currency: price.currencyCode || "",
    };
  };

  const cartPayload = (cart) => {
    if (!cart) {
      return {};
    }
    const cost = (cart.cost && cart.cost.totalAmount) || {};
    return {
      items_count: cart.totalQuantity || 0,
      total: cost.amount != null ? String(cost.amount) : "",
      currency: cost.currencyCode || "",
      items: (cart.lines || []).map((line) => {
        const merch = line.merchandise || {};
        const merchProduct = merch.product || {};
        return {
          product_id: String(merchProduct.id || ""),
          name: merchProduct.title || "",
          sku: merch.sku ? String(merch.sku) : "",
          quantity: line.quantity || 0,
          price: merch.price && merch.price.amount != null ? String(merch.price.amount) : "",
          currency: (merch.price && merch.price.currencyCode) || "",
        };
      }),
    };
  };

  analytics.subscribe("product_viewed", (event) => {
    const variant = event.data && event.data.productVariant;
    emit("view_item", event, { product: productPayload(variant) });
  });

  analytics.subscribe("collection_viewed", (event) => {
    const collection = (event.data && event.data.collection) || {};
    emit("view_item_list", event, { category: { id: String(collection.id || ""), name: collection.title || "" } });
  });

  analytics.subscribe("search_submitted", (event) => {
    const search = (event.data && event.data.searchResult) || {};
    emit("search", event, {
      search: {
        query: search.query || "",
        results_count: Array.isArray(search.productVariants) ? search.productVariants.length : null,
      },
    });
  });

  analytics.subscribe("product_added_to_cart", (event) => {
    const line = (event.data && event.data.cartLine) || {};
    emit("add_to_cart", event, { product: productPayload(line.merchandise) });
  });

  analytics.subscribe("product_removed_from_cart", (event) => {
    const line = (event.data && event.data.cartLine) || {};
    emit("remove_from_cart", event, { product: productPayload(line.merchandise) });
  });

  analytics.subscribe("cart_viewed", (event) => {
    emit("view_cart", event, { cart: cartPayload(event.data && event.data.cart) });
  });

  analytics.subscribe("checkout_started", (event) => {
    const checkout = (event.data && event.data.checkout) || {};
    const total = checkout.totalPrice || {};
    const fields = {
      cart: {
        items_count: (checkout.lineItems || []).reduce((sum, item) => sum + (item.quantity || 0), 0),
        total: total.amount != null ? String(total.amount) : "",
        currency: total.currencyCode || "",
      },
    };
    if (checkout.token) {
      // Same deterministic id the checkouts/create webhook stamps - whichever source
      // reports this checkout first wins, the other collapses as a duplicate.
      fields.event_id = `bc-${checkout.token}`;
    }
    emit("begin_checkout", event, fields, { storefront: false });
  });

  analytics.subscribe("page_viewed", (event) => {
    // Subscribed only to guarantee session_start fires even on a landing page with no
    // commerce event; emit() handles the once-per-load bookkeeping.
    if (!sessionStartSent) {
      emit("session_start", event, {});
    }
  });
});
