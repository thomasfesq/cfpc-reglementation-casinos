"use strict";

const scope = self.registration.scope;
const cachePrefix = "cfpc-quiz:" + scope + ":";
const cacheName = cachePrefix + "694a39979c9bb62c";

// Each install verifies the exact bytes of the whole version before activation.
const assets = {
  "assets/carte-salle.webp": "sha256-zsanPv96DW5p3RmsxiiJxAIzo5PCXIRzJQIYrEU6ARo=",
  "assets/cfpc-192.png": "sha256-1EuJdvvVodefsLW68ECZibN8G2Zssqhw0c7C3XwhBAg=",
  "assets/cfpc-512.png": "sha256-72J9mnPo7UEomQD4iZwjplgjJV464ULf0z8mU4BEEUo=",
  "assets/cfpc-maskable-512.png": "sha256-3XzOAgxlLJk2ZNWTo1z6dC9zEELGIHzsqiZmUtPu1f0=",
  "assets/hero-learning.webp": "sha256-t4Js9txrm3ZqidvXcbD4fGxaprunuQpvGvXY+UtbhnM=",
  "assets/roulette-formation.webp": "sha256-fwCf023pK/2GwJDPjL2OUu6RPXtisowOOA9cd5DP6nA=",
  "assets/scenes-a.webp": "sha256-Q3TwzEblMWff1sTkc+8J8SGRfKaL7CkD6wIOvJbp9sc=",
  "assets/scenes-b.webp": "sha256-KbZhQZi/AKUPkVYlK318R9IQ7nm6xHXtZ61ofACrJ3E=",
  "assets/themes.png": "sha256-JnrgiiMZwmdp++qtxiTTOK81v/qNacMPws68/ALp9n0=",
  "assets/work-sans-bold.ttf": "sha256-6DmLIiJaH5cd+bsS+o+53Ux26Aqk1n1FveYOu8bFrYE=",
  "assets/work-sans-regular.ttf": "sha256-oTHnAis07xlQqda92hb11FCcwf4a9ZkaRVL+vSpAJ+U=",
  "experience.css?v=7a678c91e47c": "sha256-emeMkeR8n1e6lRRdczCjVTYEPUtYy1vaKJLfS5sWZ1I=",
  "experience.js?v=f9f7646ed188": "sha256-+fdkbtGI4fv3GquK3H1gj0BGhQK+CczTQ95QH7xVF0M=",
  "histoires.js?v=a52646a95c1b": "sha256-pSZGqVwbkOLxh6Y1UEDBTQtBgJ9xgt3CMoPBQ0qa0cA=",
  "index.html": "sha256-Yw8QL4LWwKsoCdLIl9acQkiZLv01lNN4RUo7rQcBkFQ=",
  "installation.js?v=214fdf706634": "sha256-IU/fcGY0bf/c13FyJx8/4BD51uHQZI1Xvrj6q9LHtT0=",
  "jeu.css?v=ef26f8592002": "sha256-7yb4WSACox2iw6BVzfrpK4DYEfnQUe7D4oVjjFw4FsA=",
  "manifest.webmanifest": "sha256-9vdtJ0uShf4J5tHizu8495bxrFer/ryNT9X/tGxmzbk=",
  "parcours.css?v=d037b6d45264": "sha256-0De21FJkn2ykhi5KfDM4KLZ3F9/JXGtwrC29ko2HA68=",
  "pictos.js?v=88bcad14018c": "sha256-iLytFAGMDCduDW/6tS78+V5Wq3Q2P+0zO0ZQch/UFHk=",
  "questions.js?v=2816850df785": "sha256-KBaFDfeFXB0giXlwH5PgaXkeRionW4LzxJ1OYR2X8P4=",
  "quiz-jeu.js?v=d6c03d1819e5": "sha256-1sA9GBnl/ilgYME+dycINiqNraIEU9rTYD/uYFXPVdA=",
  "styles.css?v=5b145468afda": "sha256-WxRUaK/aLdbAicJUbmnuehfc5ZKn9EpTbcyZDb37/nI="
};
const urls = new Map(Object.entries(assets).map(([path, integrity]) =>
  [new URL(path, scope).href, integrity]));
const entry = new URL("index.html", scope).href;

async function fetchVerified(url, integrity) {
  const response = await fetch(url, { integrity, cache: "no-store", mode: "same-origin" });
  if (!response.ok) throw new Error("Ressource CFPC indisponible : " + url);
  const digest = await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer());
  const actual = "sha256-" + btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (actual !== integrity) throw new Error("Empreinte CFPC différente : " + url);
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const entries = await Promise.all(Array.from(urls, async ([url, integrity]) =>
      [url, await fetchVerified(url, integrity)]));
    await Promise.all(entries.map(([url, response]) => cache.put(url, response)));
  })());
});

self.addEventListener("activate", (event) => {
  // An update waits for older tabs to close before their offline files are retired.
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  const isEntry = request.mode === "navigate" && (path === scope || path === entry);
  const key = isEntry ? entry : url.href;
  const integrity = urls.get(key);
  if (!integrity) return;

  event.respondWith((async () => {
    let stored;
    try {
      const cache = await caches.open(cacheName);
      stored = await cache.match(key);
    } catch {
      // The same integrity check also applies when Cache Storage is unavailable.
    }
    return stored ?? fetchVerified(key, integrity);
  })());
});
