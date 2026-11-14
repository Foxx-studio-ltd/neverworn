// Builds the installable PWA (index.html) from the single source src/app.html.
// The same src/app.html is published as-is as the Claude artifact.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url);
// Case library lives in data/cases.json; media manifest (photos, reels) in data/media.json.
const data = JSON.parse(readFileSync(new URL("data/cases.json", dir), "utf8"));
let media = {}; try { media = JSON.parse(readFileSync(new URL("data/media.json", dir), "utf8")); } catch {}
const inline = d => JSON.stringify(d).replace(/</g, "\\u003c");
const anim = readFileSync(new URL("reels/anim.js", dir), "utf8");
const fill = (m) => readFileSync(new URL("src/app.html", dir), "utf8").replace("/*ANIM*/", () => anim).replace(/\/\*DATA\*\/[\s\S]*?\/\*END\*\//, "/*DATA*/" + inline({ ...data, media: m }) + "/*END*/");
const src = fill(media);
const head = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#13101c">
<meta name="description" content="Declassified files, cover-ups and famous hoaxes. Swipe, call it real or fake, then go deeper.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Rabbit Hole">
<meta property="og:title" content="Rabbit Hole">
<meta property="og:description" content="Some of it was true.">
<meta property="og:image" content="icons/og.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box;height:100%}[hidden]{display:none!important}img{max-width:100%}</style>
</head><body>
`;
const tail = `
<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});</script>
</body></html>
`;
writeFileSync(new URL("index.html", dir), head + src + tail);
// Artifact copy: same page; the artifact only carries the reels listed in media.artifactReels.
const am = { ...media, reels: Object.fromEntries(Object.entries(media.reels || {}).filter(([k]) => (media.artifactReels || []).includes(k))) };
writeFileSync(new URL("artifact.html", dir), fill(am));
// schedule for the service worker's daily alert
writeFileSync(new URL("drops.json", dir), JSON.stringify({ ...data.drops, order: data.drops.order.map(id => { const c = data.cases.find(x => x.id === id); return { id, title: c.title, tease: c.tease }; }) }));
console.log("built rabbithole/index.html and rabbithole/artifact.html");
