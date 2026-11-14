// Rabbit Hole service worker: offline shell, and the daily drop alert ("Today's Rabbit Hole: the Dyatlov Pass").
// Alerts use Periodic Background Sync where the browser supports it (installed app on Android Chrome).
// Guaranteed delivery at the exact time on every platform needs Web Push from a server; see README.
const SHELL = "rabbithole-shell-v2";
const FILES = ["./", "index.html", "manifest.webmanifest", "drops.json", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== "rabbithole-state").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith(".mp4")) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
async function dropToday() {
  const s = await (await fetch("drops.json", { cache: "no-store" }).catch(() => caches.match("drops.json"))).json();
  const now = new Date(), day = new Date(now); if (now.getHours() < s.hour) day.setDate(day.getDate() - 1);
  const [y, m, d] = s.launch.split("-").map(Number);
  const idx = Math.max(0, Math.round((Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) - Date.UTC(y, m - 1, d)) / 864e5));
  return { idx, file: s.order[idx % s.order.length] };
}
async function maybeNotify() {
  const st = await caches.open("rabbithole-state"), on = await st.match("alerts-on"); if (!on) return;
  const { idx, file } = await dropToday(), last = await st.match("last-alert"), lastIdx = last ? +(await last.text()) : -1;
  if (lastIdx === idx) return;
  await st.put("last-alert", new Response(String(idx)));
  await self.registration.showNotification(`Today's Rabbit Hole: ${file.title}`, { body: file.tease.charAt(0).toUpperCase() + file.tease.slice(1) + ".", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "daily-drop", data: { url: "./" } });
}
self.addEventListener("periodicsync", e => { if (e.tag === "rabbithole-drop") e.waitUntil(maybeNotify()); });
self.addEventListener("message", e => { if (e.data && e.data.type === "drop-alerts") e.waitUntil(caches.open("rabbithole-state").then(c => e.data.on ? c.put("alerts-on", new Response("1")) : c.delete("alerts-on"))); });
self.addEventListener("push", e => { e.waitUntil(maybeNotify()); });
self.addEventListener("notificationclick", e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: "window" }).then(ws => ws.length ? ws[0].focus() : self.clients.openWindow("./"))); });
