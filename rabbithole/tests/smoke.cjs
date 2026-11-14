// Rabbit Hole smoke test. Serve the repo root on :8765 first, then: node rabbithole/tests/smoke.cjs <outdir>
// Part A: onboarding, daily drop, light streak, the free chain and its end card, clearance, holes, board, depth, persistence.
// Part B: moderated community on a fake Claude host (db, user): off for members, mod console, filters, pre-moderation,
//         approve/reject, reports, bans, the audit log and settings.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.';
const URL0 = 'http://localhost:8765/rabbithole/';
const errs = [];
const ok = (c, l) => { console.log((c ? 'PASS ' : 'FAIL ') + l); if (!c) errs.push(l); };
const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + ' pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fonts|net::/.test(m.text())) errs.push(tag + ' console ' + m.text()); }); };
const FAKE = (opts) => {
  const docs = new Map(Object.entries(opts.seed || {})); const subs = new Set();
  const snapDoc = path => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => docs.get(path), metadata: { fromCache: false, hasPendingWrites: false } });
  const snapCol = col => { const ds = [...docs.keys()].filter(k => k.split('/').length === 2 && k.startsWith(col + '/')).map(snapDoc); return { docs: ds, size: ds.length, empty: !ds.length, docChanges: () => [], metadata: {} }; };
  const fire = () => setTimeout(() => subs.forEach(f => f()), 0);
  const db = {
    collection: col => ({ onSnapshot(n) { const f = () => n(snapCol(col)); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); } }),
    doc: path => ({ set: async d => { docs.set(path, JSON.parse(JSON.stringify(d))); window.__writes = (window.__writes || []).concat(path); fire(); },
      onSnapshot(n) { const f = () => n(snapDoc(path)); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); } })
  };
  const user = { id: async () => opts.me, isOwner: () => !!opts.owner, canEdit: () => !!opts.owner,
    profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: { u2: 'Sam Rivera', u3: 'Troll Account', mod1: 'Ada (owner)' }[i] || '' }])) };
  const sample = Object.assign(async () => ({ text: '' }), { json: async (input) => { const keys = [...input.matchAll(/"key":"([^"]+)"/g)].map(m => m[1]); return { items: keys.map(k => ({ key: k, action: /u3/.test(k) ? 'reject' : 'approve', reason: 'test suggestion' })) }; } });
  window.__fake = { docs, set: (k, v) => { docs.set(k, v); fire(); } };
  window.claude = { use: async n => ({ db, user, sample }[n] || null) };
  localStorage.setItem('rabbithole:v1', JSON.stringify({ onboarded: true, picks: ['hoax'], rulesOk: false, cleared: !!opts.owner }));
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); watch(p, 'A');
  const shot = async n => p.screenshot({ path: `${out}/${n}.png` });
  await p.goto(URL0); await p.waitForTimeout(1200);
  ok(await p.isVisible('#onb .wordmark'), 'onboarding shows the wordmark');
  ok(/every day at/.test(await p.textContent('#onb')), 'onboarding promises the daily drop');
  await shot('1-splash');
  await p.click('#go1'); await p.waitForTimeout(300);
  await p.click('.pick[data-k="mind"]'); await p.click('#go2'); await p.waitForTimeout(1300);
  const drop = await p.evaluate(() => { const d = RabbitHole.dropNow(); return { id: d.c.id, free: RabbitHole.freeToday() }; });
  const first = p.locator('.card').first();
  ok(await first.getAttribute('data-id') === drop.id, "feed opens on today's drop");
  ok(/Today's Rabbit Hole/.test(await first.locator('.meta').textContent()), "today's drop is labelled");
  ok(/\d\d:\d\d:\d\d/.test(await first.locator('.countdown').textContent()), 'countdown to the next drop runs');
  ok(await p.evaluate(() => RabbitHole.state.streak) === 1, 'opening the drop starts the streak');
  ok(await p.evaluate(() => !!document.querySelector('.card canvas.art')), 'drop card has its animated illustration');
  await shot('2-drop');
  await first.locator('[data-g="real"]').click(); await p.waitForTimeout(600);
  ok(await first.locator('.truth').isVisible(), 'calling it reveals the truth');
  ok(/Next file/.test(await first.locator('.truth .deeper').textContent()), 'verdict ends on a cliffhanger link');
  await shot('3-verdict');
  await first.locator('.truth [data-act="deeper"]').click(); await p.waitForTimeout(1000);
  ok(await p.locator('.card').nth(1).getAttribute('data-id') === drop.free[1], 'cliffhanger opens the next file in the chain');
  for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(350); }
  ok(await p.locator('.card.locked').count() === 1 && await p.locator('.endcard').count() === 1, 'free chain stops after the drop and two links');
  ok(/\d\d:\d\d:\d\d/.test(await p.locator('.endcard .countdown').textContent()), 'end card counts down to the next drop');
  await shot('4-endcard');
  ok(await p.locator('[data-act="debate"]:visible').count() === 0, 'community is hidden when there is no moderated backend');
  await p.locator('.card.locked [data-act="unlock"]').click(); await p.waitForTimeout(300);
  ok(/Unlock the full chain/.test(await p.textContent('.sheet')), 'paywall sells the full chain');
  await shot('5-paywall');
  await p.click('[data-go]'); await p.waitForTimeout(500);
  ok(await p.locator('.card.locked').count() === 0 && await p.locator('.endcard').count() === 0, 'clearance unlocks the chain in place');
  ok(await p.locator('.card').count() > 5, 'the chain keeps going after clearance');
  await p.click('[data-tab="holes"]'); await p.waitForTimeout(300);
  ok(await p.locator('.hole').count() === 10, 'ten holes listed');
  await p.evaluate(() => { const s = RabbitHole.state; ['mkultra', 'stargate', 'acoustickitty', 'paperclip', 'moon'].forEach(id => s.saved.includes(id) || s.saved.push(id)); });
  await p.click('[data-tab="board"]'); await p.waitForTimeout(300);
  ok(await p.locator('.board svg.strings path').count() >= 2, 'case board strings connect related files');
  await p.click('[data-tab="me"]'); await p.waitForTimeout(300);
  ok(/Daily drop at/.test(await p.textContent('#me')), 'depth page offers the drop reminder');
  ok(await p.isHidden('[data-tab="mod"]'), 'no mod tab without a moderated backend');
  await shot('6-depth');
  await p.click('[data-tab="watch"]'); await p.waitForTimeout(800);
  ok(await p.locator('.reel video').count() > 0 || await p.isVisible('.watch-empty'), 'watch tab shows episodes or an empty state');
  await shot('7-watch');
  // light streak: one missed day is forgiven, two are not
  await p.evaluate(() => { const s = RabbitHole.state, i = RabbitHole.dropNow().idx; s.lastDrop = i - 2; s.streak = 5; s.skips = 1; RabbitHole.tab('feed'); RabbitHole.startFeed(); });
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => RabbitHole.state.streak) === 6, 'a missed day is forgiven by the weekly skip');
  await p.evaluate(() => { const s = RabbitHole.state, i = RabbitHole.dropNow().idx; s.lastDrop = i - 3; s.streak = 5; s.skips = 1; RabbitHole.startFeed(); });
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => RabbitHole.state.streak) === 1, 'two missed days reset the streak');
  await p.reload(); await p.waitForTimeout(900);
  ok(await p.isHidden('#onb'), 'returning users skip onboarding');
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal overflow');
  // filters
  const f = await p.evaluate(() => [RabbitHole.Filter('see www.proof.com'), RabbitHole.Filter('call me on 07700 900123'), RabbitHole.Filter('he lives at 12 Oak Street'), RabbitHole.Filter('the vaccine causes it'), RabbitHole.Filter('kys'), RabbitHole.Filter('Lasers still bounce off the mirrors.')]);
  ok(f[0].block.includes('Link') && f[1].block.includes('Phone number') && f[2].block.length && f[4].block.includes('Harassment'), 'filters block links, phone numbers, addresses and harassment');
  ok(!f[3].block.length && f[3].flag.includes('Health claim'), 'health claims are flagged for a moderator, not silently blocked');
  ok(!f[5].block.length && !f[5].flag.length, 'ordinary arguments pass the filters');

  // ---------- Part B: member on a moderated backend, community switched off ----------
  const cm = await b.newContext({ ...devices['iPhone 13'] });
  await cm.addInitScript(FAKE, { me: 'u2', owner: false, seed: {} });
  const m = await cm.newPage(); watch(m, 'B-member');
  await m.goto(URL0); await m.waitForTimeout(1500);
  ok(await m.locator('.card').first().locator('[data-act="debate"]').isHidden(), 'members see no discussion while community is off');
  ok(await m.isHidden('[data-tab="mod"]'), 'members get no mod tab');

  // ---------- Part C: owner moderates ----------
  const co = await b.newContext({ ...devices['iPhone 13'] });
  await co.addInitScript(FAKE, { me: 'mod1', owner: true, seed: {
    'posts/u2': { items: [{ id: 'a1', caseId: 'moon', side: 'fake', text: 'The shadows are wrong.', at: Date.now() - 6e5, parent: null, status: 'pending', flags: [] }] },
    'posts/u3': { items: [{ id: 'b1', caseId: 'moon', side: 'fake', text: 'NASA LIES AND THE VACCINE IS NEXT', at: Date.now() - 3e5, parent: null, status: 'pending', flags: ['Health claim', 'Shouting'] }] } } });
  const o = await co.newPage(); watch(o, 'C-owner');
  await o.goto(URL0); await o.waitForTimeout(1500);
  ok(await o.isVisible('[data-tab="mod"]'), 'owner gets the mod tab');
  ok(/2/.test(await o.textContent('[data-tab="mod"]')), 'mod tab shows the queue size');
  await o.click('[data-tab="mod"]'); await o.waitForTimeout(600);
  ok(await o.locator('.mq').count() === 2, 'queue holds both pending posts');
  ok(/Health claim/.test(await o.textContent('#mod')), 'auto-flags are shown to the moderator');
  await o.click('[data-triage]'); await o.waitForTimeout(500);
  ok(await o.locator('.tri').count() === 2, 'Claude triage suggests an action for each post');
  await o.screenshot({ path: `${out}/8-modqueue.png` });
  await o.locator('[data-approve="u2:a1"]').click(); await o.waitForTimeout(300);
  await o.locator('[data-reject="u3:b1"]').click(); await o.waitForTimeout(300);
  ok(await o.evaluate(() => (window.__fake.docs.get('approved/moon') || { items: [] }).items.length) === 1, 'approve publishes into the public thread');
  ok(await o.evaluate(() => window.__fake.docs.get('posts/u3').items[0].status) === 'rejected', 'reject marks the post as not published');
  await o.locator('[data-mv="log"]').click(); await o.waitForTimeout(200);
  ok(await o.locator('.mq').count() === 2, 'both decisions are in the audit log');
  // settings: switch community on
  await o.locator('[data-mv="settings"]').click(); await o.waitForTimeout(200);
  await o.check('#mEnabled'); await o.fill('#mWords', 'sheeple'); await o.click('[data-savesettings]'); await o.waitForTimeout(300);
  ok(await o.evaluate(() => window.__fake.docs.get('mod/settings').enabled === true), 'settings switch community on');
  // the public thread
  await o.click('[data-tab="feed"]'); await o.evaluate(() => RabbitHole.startFeed([RabbitHole.CASES.find(c => c.id === 'moon')])); await o.waitForTimeout(400);
  await o.locator('.card').first().locator('[data-act="debate"]').click(); await o.waitForTimeout(500);
  const th = await o.textContent('.debate .thread'); if (!/Sam Rivera/.test(th)) console.log('THREAD WAS:', JSON.stringify(th), await o.evaluate(() => JSON.stringify(window.__fake.docs.get('approved/moon'))));
  ok(/Sam Rivera/.test(await o.textContent('.debate .thread')) && /shadows/.test(await o.textContent('.debate .thread')), 'approved post shows in the discussion with its author');
  ok(!/NASA LIES/.test(await o.textContent('.debate .thread')), 'rejected post never appears');
  ok(await o.isVisible('.rules'), 'house rules come before the first post');
  await o.click('[data-agree]'); await o.click('.pick-side .real');
  await o.fill('#argText', 'Proof here: www.example.com'); await o.click('.debate .post'); await o.waitForTimeout(200);
  ok(/Link/.test(await o.textContent('#toast')), 'a post with a link is refused with the reason');
  await o.fill('#argText', 'Only sheeple believe that'); await o.click('.debate .post'); await o.waitForTimeout(200);
  ok(/Blocked word/.test(await o.textContent('#toast')), 'moderator-added blocked words apply');
  await o.fill('#argText', 'Laser ranging still bounces off the mirrors they left.'); await o.click('.debate .post'); await o.waitForTimeout(300);
  ok(/Waiting for a moderator/.test(await o.textContent('.debate .thread')), 'your own post waits for review before anyone sees it');
  await o.screenshot({ path: `${out}/9-discussion.png` });
  await o.click('.debate [data-x]');
  // a report from another member, then a ban
  await o.evaluate(() => { window.__fake.set('reports/u9', { items: [{ key: 'u2:a1', caseId: 'moon', reason: 'Spam', at: Date.now() }] }); });
  await o.click('[data-tab="mod"]'); await o.evaluate(() => RabbitHole.Community.render()); await o.waitForTimeout(100);
  await o.waitForTimeout(400);
  await o.locator('[data-mv="reported"]').click(); await o.waitForTimeout(200);
  ok(/Spam × 1/.test(await o.textContent('#mod')), 'reports reach the moderator with their reason');
  const bn = o.locator('#mod [data-ban="u2"]'); await bn.click(); await bn.click(); await o.waitForTimeout(300);
  ok(await o.evaluate(() => window.__fake.docs.get('mod/bans').ids.some(x => x.id === 'u2')), 'ban is recorded');
  ok(await o.evaluate(() => (window.__fake.docs.get('approved/moon') || { items: [] }).items.length) === 0, 'ban and remove takes their posts down');
  await o.screenshot({ path: `${out}/10-modreported.png` });
  await b.close();
  console.log(errs.length ? '\nERRORS:\n' + errs.join('\n') : '\nAll good.');
  process.exit(errs.length ? 1 : 0);
})();
