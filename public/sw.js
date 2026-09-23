// Minimal service worker — only exists to satisfy PWA installability
// criteria (Chrome/Android requires a registered SW with a fetch handler).
// Deliberately does no caching: booking data must always come from the
// network, never a stale cache.
self.addEventListener("fetch", () => {});
