// Rabbit Hole smoke test. Serve the repo root on :8765 first, then: node rabbithole/tests/smoke.cjs <outdir>
// Covers onboarding, the feed, redaction bars, real/fake calls, depth, go deeper, pinning, the case board,
// the paywall unlocking Top Secret files, holes, the depth page and persistence across reloads.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.';
const URL0 = 'http://localhost:8765/rabbithole/';
const errs = [];
const ok = (c, l) => { console.log((c ? 'PASS ' : 'FAIL ') + l); if (!c) errs.push(l); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fonts/.test(m.text())) errs.push('console ' + m.text()); });
  const shot = async n => p.screenshot({ path: `${out}/${n}.png` });
  await p.goto(URL0); await p.waitForTimeout(1200);
  ok(await p.isVisible('#onb .wordmark'), 'onboarding shows the wordmark');
  await shot('1-splash');
  await p.click('#go1'); await p.waitForTimeout(300);
  ok(await p.isDisabled('#go2'), 'enter is disabled until a hole is picked');
  await p.click('.pick[data-k="mind"]'); await p.click('.pick[data-k="sky"]');
  await shot('2-picks');
  await p.click('#go2'); await p.waitForTimeout(1300);
  ok(await p.isHidden('#onb'), 'onboarding closes');
  const first = p.locator('.card').first();
  ok(await first.locator('.chip.daily').count() === 1, "first card is Today's file");
  ok(/\d\d:\d\d:\d\d/.test(await first.locator('.countdown').textContent()), 'countdown to the next file runs');
  await shot('3-feed');
  // Lift one bar, then call it
  await first.locator('.rx').first().click();
  ok(await first.locator('.rx.open').count() === 1, 'tapping a bar lifts it');
  const d0 = await p.evaluate(() => RabbitHole.state.depth);
  await first.locator('[data-g="real"]').click(); await p.waitForTimeout(700);
  ok(await first.locator('.truth').isVisible(), 'calling it reveals the truth panel');
  ok(await first.locator('.doc.stamped').count() === 1, 'verdict stamp lands');
  ok(await p.evaluate(() => RabbitHole.state.depth) > d0, 'depth increases after a call');
  await shot('4-verdict');
  // Pin + share
  await first.locator('[data-act="save"]').click();
  ok((await p.evaluate(() => RabbitHole.state.saved.length)) === 1, 'pin saves the file');
  await first.locator('.rail [data-act="share"]').click(); await p.waitForTimeout(300);
  ok(await p.isVisible('#toast'), 'share gives feedback');
  // Go deeper
  const firstId = await first.getAttribute('data-id');
  await first.locator('.truth [data-act="deeper"]').click(); await p.waitForTimeout(1200);
  const second = p.locator('.card').nth(1);
  const exp = await p.evaluate(id => { const c = RabbitHole.CASES.find(x => x.id === id), ids = RabbitHole.HOLES[c.hole].ids; return ids[(ids.indexOf(id) + 1) % ids.length]; }, firstId);
  ok(await second.getAttribute('data-id') === exp, 'go deeper inserts the next file in the same hole');
  await shot('5-deeper');
  // Swipe through a few, pin a second file from the same hole if open
  for (let i = 0; i < 4; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(450); }
  ok((await p.locator('.card').count()) >= 6, 'feed keeps loading more files');
  // Locked card + paywall
  await p.evaluate(() => { const c = RabbitHole.CASES.find(x => x.ts); RabbitHole.startFeed([c]); });
  await p.waitForTimeout(400);
  ok(await p.locator('.card.locked').count() >= 1, 'top secret file is locked for free users');
  await shot('6-locked');
  await p.locator('.card.locked [data-act="unlock"]').first().click(); await p.waitForTimeout(400);
  ok(await p.isVisible('.sheet'), 'paywall opens');
  ok(/7 days free/.test(await p.textContent('#fine')), 'paywall states trial terms');
  await shot('7-paywall');
  await p.click('#planWeek'); ok(/\$4\.99 a week/.test(await p.textContent('#fine')), 'terms follow the chosen plan');
  await p.click('#planYear');
  await p.click('[data-go]'); await p.waitForTimeout(400);
  ok(await p.locator('.card.locked').count() === 0, 'clearance unlocks files in place');
  // Pin the unlocked file so the board has a string
  await p.locator('.card').first().locator('[data-act="save"]').click();
  // Holes
  await p.click('[data-tab="holes"]'); await p.waitForTimeout(300);
  ok(await p.locator('.hole').count() === 10, 'ten holes listed');
  await shot('8-holes');
  // Board
  await p.evaluate(() => { const s = RabbitHole.state; ['mkultra', 'stargate', 'acoustickitty', 'paperclip', 'moon'].forEach(id => s.saved.includes(id) || s.saved.push(id)); });
  await p.click('[data-tab="board"]'); await p.waitForTimeout(300);
  ok(await p.locator('.bcard').count() >= 5, 'case board shows pinned files');
  ok(await p.locator('.board svg.strings path').count() >= 2, 'red string connects related files');
  await shot('9-board');
  await p.click('[data-tab="me"]'); await p.waitForTimeout(300);
  ok(/Clearance active/.test(await p.textContent('#me')), 'depth page shows clearance');
  await shot('10-depth');
  // Persistence
  await p.reload(); await p.waitForTimeout(900);
  ok(await p.isHidden('#onb'), 'returning users skip onboarding');
  ok((await p.evaluate(() => RabbitHole.state.depth)) > 0, 'depth persists');
  // Overflow check
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok(!wide, 'no horizontal overflow');
  // Small phone
  const sp = await b.newPage({ viewport: { width: 360, height: 640 } });
  await sp.goto(URL0); await sp.evaluate(() => localStorage.setItem('rabbithole:v1', JSON.stringify({ onboarded: true, picks: ['flags'] }))); await sp.reload(); await sp.waitForTimeout(900);
  const fit = await sp.evaluate(() => { const c = document.querySelector('.card'), btn = c.querySelector('.btn-call'); return btn && btn.getBoundingClientRect().bottom <= c.getBoundingClientRect().bottom + 1; });
  ok(fit, 'call buttons fit on a 360x640 phone');
  await sp.screenshot({ path: `${out}/11-small.png` });
  // Debate, this-device mode
  await p.click('[data-tab="feed"]'); await p.evaluate(() => RabbitHole.startFeed([RabbitHole.CASES.find(c => c.id === 'northwoods')])); await p.waitForTimeout(300);
  await p.locator('.card').first().locator('[data-act="debate"]').click(); await p.waitForTimeout(300);
  ok(await p.isVisible('.debate'), 'debate sheet opens from the feed');
  ok(await p.isDisabled('.debate .post'), 'posting needs a side and text');
  await p.click('.pick-side .real'); await p.fill('#argText', 'The memo is on the National Archives site. Read it.');
  await p.click('.debate .post'); await p.waitForTimeout(300);
  ok(await p.locator('.thread .cmt').count() === 1, 'argument appears in the thread');
  ok(/1 vote/.test(await p.textContent('.tally')), 'picking a side counts in the tally');
  await p.click('.thread [data-reply]'); await p.click('.pick-side .fake'); await p.fill('#argText', 'A memo is not a crime. It was rejected.');
  await p.click('.debate .post'); await p.waitForTimeout(300);
  ok(await p.locator('.thread ol .badge.reb').count() === 1, 'a reply from the other side is marked as a rebuttal');
  await p.locator('.thread [data-like]').first().click(); await p.waitForTimeout(200);
  ok(/Convincing · 1/.test(await p.locator('.thread [data-like]').first().textContent()), 'convincing votes count');
  await shot('12-debate');
  await p.click('.debate [data-x]');
  ok((await p.locator('.card').first().locator('[data-count]').textContent()).trim() === '2', 'rail shows the argument count');
  // Watch tab
  await p.click('[data-tab="watch"]'); await p.waitForTimeout(800);
  const reels = await p.locator('.reel video').count();
  ok(reels > 0 || await p.isVisible('.watch-empty'), 'watch tab shows reels or an empty state');
  if (reels) { await p.locator('.reel').first().click(); await p.waitForTimeout(1200); ok(await p.evaluate(() => { const v = document.querySelector('.reel video'); return !v.paused && !v.muted; }), 'first reel plays with sound after a tap'); }
  await shot('13-watch');
  // Debate, shared mode on a fake Claude host (two people)
  const ctx2 = await b.newContext({ ...devices['iPhone 13'] });
  await ctx2.addInitScript(() => {
    const docs = new Map([['posts/u2', { items: [{ id: 'a1', caseId: 'moon', side: 'fake', text: 'The shadows are wrong.', at: Date.now() - 6e5, parent: null }], likes: [], sides: { moon: 'fake' } }]]);
    const subs = new Set(); const snap = () => ({ docs: [...docs].filter(([k]) => k.startsWith('posts/')).map(([k, v]) => ({ id: k.split('/')[1], exists: true, data: () => v })) });
    const db = { collection: () => ({ onSnapshot(n) { subs.add(n); setTimeout(() => n(snap()), 0); return () => subs.delete(n); } }),
      doc: path => ({ set: async d => { docs.set(path, d); window.__writes = (window.__writes || 0) + 1; subs.forEach(n => n(snap())); } }) };
    const user = { id: async () => 'u1', isOwner: () => false, profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: i === 'u2' ? 'Sam Rivera' : 'Ada' }])) };
    window.claude = { use: async n => ({ db, user }[n] || null) };
    localStorage.setItem('rabbithole:v1', JSON.stringify({ onboarded: true, picks: ['hoax'] }));
  });
  const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('B pageerror ' + e.message));
  await q.goto(URL0); await q.waitForTimeout(1500);
  await q.evaluate(() => RabbitHole.startFeed([RabbitHole.CASES.find(c => c.id === 'moon')])); await q.waitForTimeout(300);
  await q.locator('.card').first().locator('[data-act="debate"]').click(); await q.waitForTimeout(600);
  ok(/Sam Rivera/.test(await q.textContent('.thread')), "shared mode shows other people's arguments with their names");
  await q.click('.pick-side .real'); await q.click('.thread [data-reply]'); await q.fill('#argText', 'Shadows look odd on uneven ground. Lasers still bounce off the mirrors.');
  await q.click('.debate .post'); await q.waitForTimeout(400);
  ok(await q.evaluate(() => window.__writes >= 2), 'shared mode writes to the store');
  ok(await q.locator('.thread ol .badge.reb').count() === 1, 'shared rebuttal threads under the other person');
  await q.screenshot({ path: `${out}/14-debate-shared.png` });
  await b.close();
  console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\nAll good.');
  process.exit(errs.length ? 1 : 0);
})();
