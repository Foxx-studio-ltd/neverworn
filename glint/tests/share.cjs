// Share-path test: phone (share sheet gets image + prompt) and desktop (link + image on clipboard).
// Serve the repo root on :8765, then: node glint/tests/share.cjs <outdir>
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  // phone with a share sheet
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { navigator.canShare = () => true; navigator.share = async d => { window.__shared = { files: d.files.map(f => f.type + ':' + f.size), text: d.text }; }; });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/glint/'); await p.waitForTimeout(1200);
  await p.click('#sampleBtn'); await p.waitForTimeout(400); await p.click('#moreBtn'); await p.waitForTimeout(1200);
  console.log('phone hero:', (await p.textContent('#heroDest')).trim());
  await p.click('#dests >> text=Grok it'); await p.waitForTimeout(500);
  const sh = await p.evaluate(() => window.__shared); console.log('phone share payload:', JSON.stringify(sh).slice(0, 160));
  await p.screenshot({ path: process.argv[2] + '/share-phone.png' });
  // desktop: link + clipboard
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const q = await ctx2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto('http://localhost:8765/glint/'); await q.waitForTimeout(1200);
  await q.click('#sampleBtn'); await q.waitForTimeout(400); await q.click('#moreBtn'); await q.waitForTimeout(1200);
  const href = await q.getAttribute('#dests >> text=Grok it >> xpath=..', 'href').catch(() => null);
  const [pop] = await Promise.all([ctx2.waitForEvent('page', { timeout: 5000 }).catch(() => null), q.click('#dests >> text=Grok it')]);
  await q.waitForTimeout(800);
  const types = await q.evaluate(async () => { const it = await navigator.clipboard.read(); return it.flatMap(i => i.types); });
  console.log('desktop opened:', pop ? pop.url().slice(0, 40) : 'none', '| clipboard:', types.join(','), '| toast:', await q.textContent('#toast'));
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})();
// One-tap send: on a phone, the compose screen's main button fires the default AI straight into the share sheet.
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { navigator.canShare = () => true; navigator.share = async d => { window.__shared = { files: d.files.length, text: d.text.slice(0, 30) }; }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/glint/'); await p.waitForTimeout(1200);
  await p.click('#sampleBtn'); await p.waitForTimeout(1200); // card pre-builds while you review
  await p.click('#sendBtn'); await p.waitForTimeout(500);
  const sh = await p.evaluate(() => window.__shared); const panel = await p.evaluate(() => document.querySelector('#scrim').classList.contains('on'));
  console.log((sh && sh.files === 1 && !panel ? 'PASS' : 'FAIL') + ' one tap sends picture + prompt to the share sheet, no extra panel', JSON.stringify(sh));
  console.log('errors:', errs.length ? errs : 'none'); await b.close();
})();
