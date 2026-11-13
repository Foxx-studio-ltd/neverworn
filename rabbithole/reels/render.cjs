// Renders a reel frame by frame. Serve the repo root on :8765, then:
//   node render.cjs <reel> <outdir> [fps] [t1,t2,... for stills]
// Also writes <outdir>/events.json (stamp hits and scene starts) for the soundtrack.
const { chromium } = require('playwright');
const fs = require('fs');
const [,, reel, out, fpsArg, stills] = process.argv; const fps = +(fpsArg || 30);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.error('pageerror', e.message));
  await p.goto(`http://localhost:8765/rabbithole/reels/reel.html?r=${reel}`);
  await p.evaluate(async () => { await window.ready; await document.fonts.ready; });
  await p.waitForTimeout(800);
  const ev = await p.evaluate(() => ({ duration: window.DURATION, hits: window.SLAMS, scenes: window.SCENESTARTS }));
  fs.writeFileSync(`${out}/events.json`, JSON.stringify(ev));
  const times = stills ? stills.split(',').map(Number) : null;
  const n = times ? times.length : Math.round(ev.duration * fps);
  const el = await p.$('#f');
  for (let i = 0; i < n; i++) { const t = times ? times[i] : i / fps; await p.evaluate(t => render(t), t);
    await el.screenshot({ path: `${out}/${times ? 's' + String(i).padStart(2, '0') : String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 }); }
  await b.close(); console.log('rendered', n, 'frames');
})();
