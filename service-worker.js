"use strict";

const scope = self.registration.scope;
const cachePrefix = "cfpc-quiz:" + scope + ":";
const cacheName = cachePrefix + "4ac71bf7b9535806";

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
  "atelier-cas.js?v=9261d3d33d7a": "sha256-kmHT0z16qyaOKVsu6rcDv/iTklni+1QRh3+h7JWXNdk=",
  "atelier.css?v=3d701f1d4dab": "sha256-PXAfHU2ruq/atng1QipfQ0PjrCz5XMh5P/T+89idXSY=",
  "carnet-cas.js?v=7d90af204936": "sha256-fZCvIEk2vzvYpBMCAjgqBfT+JgZYe+GoPoFD4ApbIvQ=",
  "carnet.css?v=c74860e0a6de": "sha256-x0hg4KbedOJhAnFhR6fIC/1EVppAucBtbIR9nnYq+L0=",
  "experience.css?v=ebf142ebf452": "sha256-6/FC6/RS2hd4vhyTKK9x+vZ3FKaRvhFUpiov9zbz0rE=",
  "experience.js?v=c9d0be609b79": "sha256-ydC+YJt507Fb3WKFZoV1OnlJ1Xwd8GiJycnYPpp5jWU=",
  "histoires.js?v=a52646a95c1b": "sha256-pSZGqVwbkOLxh6Y1UEDBTQtBgJ9xgt3CMoPBQ0qa0cA=",
  "index.html": "sha256-48q3Hq/g4xTfom6Nni8Acxr+I+BxhnYLOw6LjZ8k0Ww=",
  "installation.js?v=b9ed36b9fb32": "sha256-ue02ufsyl1jD8thAPuwvr8FxDaUnh3nbhhalA/6K6Y8=",
  "jeu.css?v=5a93a15d42f5": "sha256-WpOhXUL1vCicxH9k4n0i4Pd60Ib8nAsE8gCGsdrp/jo=",
  "manifest.webmanifest": "sha256-9vdtJ0uShf4J5tHizu8495bxrFer/ryNT9X/tGxmzbk=",
  "missions.js?v=1985e5ce2592": "sha256-GYXlziWS3wtbT0x5n0n1E2wZRwbUB5xbAFYqrcmFG4g=",
  "parcours.css?v=d037b6d45264": "sha256-0De21FJkn2ykhi5KfDM4KLZ3F9/JXGtwrC29ko2HA68=",
  "pictos.js?v=034c9591f1ce": "sha256-A0yVkfHOGXcwqSanKyhA+JycSpKp7RXnQIakjecotVQ=",
  "questions.js?v=2816850df785": "sha256-KBaFDfeFXB0giXlwH5PgaXkeRionW4LzxJ1OYR2X8P4=",
  "quiz-jeu.js?v=4affa242b62c": "sha256-Sv+iQrYsoxHe2UoDnv+55iDTsc8JmLNYOWflihXUNLs=",
  "styles.css?v=5b145468afda": "sha256-WxRUaK/aLdbAicJUbmnuehfc5ZKn9EpTbcyZDb37/nI=",
  "terrain.js?v=f3f33cabd76c": "sha256-8/M8q9dsLELyyTLALWyg802LBnbKzHj1vIeiOA71lrM="
};
const urls = new Map(Object.entries(assets).map(([path, integrity]) =>
  [new URL(path, scope).href, integrity]));
const entry = new URL("index.html", scope).href;

async function previousCaches() {
  const keys = await caches.keys();
  return keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName &&
    /^[a-f0-9]{16}$/.test(key.slice(cachePrefix.length)));
}

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
    const entries = await Promise.all(Array.from(urls, async ([url, integrity]) =>
      [url, await fetchVerified(url, integrity)]));
    try {
      const cache = await caches.open(cacheName);
      for (const [url, response] of entries) await cache.put(url, response);
    } catch (error) {
      await caches.delete(cacheName).catch(() => {});
      throw error;
    }
    // The next launch can use the verified version even if the network is already gone.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Keep the active predecessor and any version that was already waiting in an older client.
    const keys = await previousCaches();
    await Promise.allSettled(keys.slice(0, -2).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function previousAsset(url) {
  for (const name of (await previousCaches()).reverse()) {
    const response = await caches.match(url, {cacheName: name});
    if (response) return response;
  }
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  const isEntry = request.mode === "navigate" && (path === scope || path === entry);
  const key = isEntry ? entry : url.href;
  const integrity = urls.get(key);
  if (!integrity) {
    // A tab opened under the previous worker may still ask for an exact versioned asset.
    if (url.href.startsWith(scope) && /\.(?:css|js)$/.test(url.pathname) &&
        /^\?v=[a-f0-9]{12}$/.test(url.search)) {
      event.respondWith(previousAsset(url.href));
    }
    return;
  }

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
