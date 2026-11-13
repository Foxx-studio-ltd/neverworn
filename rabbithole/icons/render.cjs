// Renders the PNG icons, the OG image and the logo sheet from icon.svg.
// Run from the repo root: node rabbithole/icons/render.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = __dirname, svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const mark = svg.replace(/<rect[^>]*\/>\s*<circle[^>]*\/>/, '').replace('viewBox="0 0 512 512"', 'viewBox="100 58 312 396"');
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Inter+Tight:wght@500;600&display=swap">';
const RINGS = '<svg class="o" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="#efe3c4"/><circle cx="40" cy="40" r="30" fill="#13101c"/><g fill="none" stroke="#efe3c4" stroke-width="2.4"><circle cx="40" cy="43" r="23" opacity=".55"/><circle cx="40" cy="46" r="16" opacity=".42"/><circle cx="40" cy="48.5" r="10" opacity=".3"/></g><circle cx="40" cy="50.5" r="3.4" fill="#f2e14c"/></svg>';
const page = (w, h, body) => `<!doctype html><html><head>${FONT}<style>
html,body{margin:0;width:${w}px;height:${h}px;background:#13101c;color:#efe3c4;font-family:"Inter Tight",sans-serif;overflow:hidden}
.wm{font-family:"Big Shoulders Display",Impact,sans-serif;font-weight:900;text-transform:uppercase;line-height:.82;margin:0}
.wm .o{display:inline-block;width:.74em;height:.74em;vertical-align:-.02em;margin:0 .02em}
mark{background:#f2e14c;color:#13101c;padding:0 .1em}
</style></head><body>${body}</body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const shot = async (html, w, h, file) => { await p.setViewportSize({ width: w, height: h }); await p.setContent(html); await p.waitForTimeout(700); await p.screenshot({ path: path.join(dir, file) }); };
  for (const s of [180, 192, 512]) await shot(page(s, s, svg.replace('<svg ', `<svg width="${s}" height="${s}" `)), s, s, `icon-${s}.png`);
  // maskable: full-bleed background, mark inside the 80% safe zone
  await shot(page(512, 512, `<div style="width:512px;height:512px;display:grid;place-items:center;background:radial-gradient(circle at 50% 58%,#2a2140,#13101c 70%)">${mark.replace('<svg ', '<svg height="330" ')}</div>`), 512, 512, 'icon-maskable-512.png');
  await shot(page(1200, 630, `<div style="display:flex;align-items:center;gap:70px;height:630px;padding:0 90px;background:radial-gradient(60% 90% at 20% 60%,#2a2140,#13101c 70%)">
    ${mark.replace('<svg ', '<svg height="420" ')}<div><h1 class="wm" style="font-size:150px">Rabbit<br>H${RINGS}le</h1>
    <p class="wm" style="font-size:52px;margin-top:26px;font-weight:800">Some of it was <mark>true.</mark></p></div></div>`), 1200, 630, 'og.png');
  // logo sheet: app icon, primary lockup, horizontal lockup, mono
  await shot(page(1600, 1000, `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#2b2638;height:1000px">
    <div style="background:#221c30;display:grid;place-items:center;align-content:center;gap:24px">${svg.replace('<svg ', '<svg width="300" height="300" ')}<small style="color:#a59fb3;letter-spacing:.14em;text-transform:uppercase;font-weight:600">App icon</small></div>
    <div style="background:#13101c;display:grid;place-items:center;align-content:center;gap:22px">${mark.replace('<svg ', '<svg height="230" ')}<h1 class="wm" style="font-size:120px;text-align:center">Rabbit<br>H${RINGS}le</h1></div>
    <div style="background:#efe3c4;display:flex;align-items:center;justify-content:center;gap:26px;color:#13101c">${svg.replace('<svg ', '<svg width="140" height="140" ')}<h1 class="wm" style="font-size:110px;color:#13101c">Rabbit Hole</h1></div>
    <div style="background:#f2e14c;display:grid;place-items:center;color:#13101c"><p class="wm" style="font-size:96px;line-height:.92;text-align:center">Some of it<br>was true.</p></div></div>`), 1600, 1000, '../docs/logo-sheet.png');
  await b.close(); console.log('rendered icons');
})();
