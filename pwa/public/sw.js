const CACHE_NAME = "aas-pwa-phase17-prod-v2-runtime-v10-axia-icon";
const APP_SHELL = [
  "/offline.html",
  "/favicon.svg",
];
const FRESH_BRANDING_ASSETS = new Set([
  "/manifest.webmanifest",
  "/aas-axia-icon-512.png",
  "/aas-login-hero-hq.svg",
  "/aas-login-tile-1.svg",
  "/aas-login-tile-2.svg",
  "/aas-login-tile-3.svg",
  "/aas-login-tile-4.svg",
]);

function freshRequest(request) {
  return new Request(request, { cache: "no-store" });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(freshRequest(request));
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "AAS_ACTIVATE_RELEASE") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/auth/callback") ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("code") ||
    url.searchParams.has("access_token") ||
    url.searchParams.has("refresh_token")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(freshRequest(request)).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("/offline.html")) || Response.error();
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (FRESH_BRANDING_ASSETS.has(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(freshRequest(request)).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});


function notificationPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")
    || /[\\\u0000-\u0020\u007f]/.test(value)) return "/notifications";
  return value;
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
    if (!payload || typeof payload !== "object") payload = {};
  } catch {
    payload = { title: "AI Action Studio", body: event.data ? event.data.text() : "" };
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "AI Action Studio";
  const body = typeof payload.body === "string" ? payload.body : "";
  const href = notificationPath(payload.href);
  const notificationId = Number(payload.notificationId || 0);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/aas-axia-icon-512.png?v=20260928-axia-v1",
      badge: "/aas-axia-icon-512.png?v=20260928-axia-v1",
      tag: notificationId > 0 ? "aas-notification-" + notificationId : undefined,
      renotify: false,
      data: { href, notificationId },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = notificationPath(event.notification?.data?.href);
  const targetUrl = new URL(href, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if ("navigate" in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});
