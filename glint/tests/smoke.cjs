// Smoke test: node glint/tests/smoke.cjs  (needs a static server on :8765 at repo root)
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8765/glint/'); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/1-capture.png' });
  const count = await p.textContent('#count'); console.log('inbox count (seeded example):', count);
  await p.click('#sampleBtn'); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/2-compose.png' });
  // drop a pin and type a note
  const box = await p.locator('#stage').boundingBox();
  await p.mouse.click(box.x + box.width * .5, box.y + box.height * .2); await p.waitForTimeout(200);
  await p.fill('#note', 'Swap this hero photo for latte art'); 
  const pins = await p.evaluate(() => Glint.cap.pins.length); console.log('pins:', pins);
  const prompt = await p.evaluate(() => Glint.promptText(Glint.cap)); console.log('---prompt---\n' + prompt);
  await p.click('#sendBtn'); await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/3-send.png' });
  const dests = await p.$$eval('.dest b', els => els.map(e => e.textContent)); console.log('dests:', dests.join(', '));
  await p.click('#closePanel');
  for (const d of ['paper','signal']) { await p.click('#dirBtn'); await p.waitForTimeout(400); await p.screenshot({ path: out + `/4-${d}.png` }); }
  await p.click('#inboxBtn'); await p.waitForTimeout(400); await p.screenshot({ path: out + '/5-inbox.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
