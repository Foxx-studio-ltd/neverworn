// Builds the installable PWA (index.html) from the single source src/app.html.
// The same src/app.html is published as-is as the Claude artifact.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url);
const src = readFileSync(new URL("src/app.html", dir), "utf8");
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
console.log("built rabbithole/index.html");
