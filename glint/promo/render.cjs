// Renders ad.html frame by frame. Usage: node render.cjs <outdir> [fps] [t1,t2,... for stills]
const { chromium } = require('playwright');
const [,, out, fpsArg, stills] = process.argv; const fps = +(fpsArg || 30);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('http://localhost:8765/glint/promo/ad.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const times = stills ? stills.split(',').map(Number) : null;
  const D = await p.evaluate(() => window.DURATION); const n = times ? times.length : Math.round(D * fps);
  const el = await p.$('#f');
  for (let i = 0; i < n; i++) { const t = times ? times[i] : i / fps; await p.evaluate(t => render(t), t);
    await el.screenshot({ path: `${out}/${times ? 's' + t : String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 }); }
  await b.close();
})();
