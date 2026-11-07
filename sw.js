// Quizzes Marco : garde l’app et les photos sur le téléphone pour jouer sans connexion.
const SHELL = "shell-v2";
const PHOTOS = "photos-v1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("shell-") && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Photos : d’abord le cache, sinon internet (et on garde une copie).
  if (url.hostname === "upload.wikimedia.org") {
    e.respondWith(caches.open(PHOTOS).then(async c => {
      const hit = await c.match(req.url, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req.url, { mode: "cors" });
      if (res.ok) { const blob = await res.clone().blob(); c.put(req.url, new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg" } })); }
      return res;
    }));
    return;
  }

  // Recherche Wikipédia : toujours en ligne.
  if (url.hostname.endsWith("wikipedia.org")) return;

  // Polices : cache, mis à jour en arrière-plan.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(SHELL).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // L’app elle-même : réseau si possible (pour les mises à jour), sinon cache.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) caches.open(SHELL).then(c => c.put(req, res.clone()));
        return res;
      }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match("./index.html")) || (await caches.match("./")))
    );
  }
});
