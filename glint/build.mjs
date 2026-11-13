// Builds the standalone PWA (index.html) from the single source src/app.html.
// The same src/app.html is published as-is as the Claude artifact.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url);
const src = readFileSync(new URL("src/app.html", dir), "utf8");
const head = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#141413">
<meta name="description" content="See it. Say it. Send it. Snap anything, say what you want, send it to your AI.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Glint">
<meta property="og:title" content="Glint">
<meta property="og:description" content="See it. Say it. Send it.">
<meta property="og:image" content="icons/og.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
</head><body>
`;
const tail = `
<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});</script>
</body></html>
`;
writeFileSync(new URL("index.html", dir), head + src + tail);
console.log("built glint/index.html");
