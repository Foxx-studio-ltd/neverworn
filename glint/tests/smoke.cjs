// Smoke test. Serve the repo root on :8765 first, then: node glint/tests/smoke.cjs <outdir>
// Part 1 runs the standalone app. Part 2 runs it with a fake in-memory Claude host (db, user, room)
// to exercise live rooms, which otherwise only run inside Claude.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.';
const FAKE = () => {
  const docs = new Map(); const subs = new Set(); let n = 0;
  const parent = p => p.split('/').slice(0, -1).join('/');
  const notify = () => setTimeout(() => subs.forEach(s => s()), 0);
  const snapOf = (path) => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} });
  const query = (col, ord) => ({
    orderBy(f, dir = 'asc') { return query(col, { f, dir }); }, limit() { return this; }, where() { return this; },
    onSnapshot(next) { const run = () => { let list = [...docs.keys()].filter(k => parent(k) === col).map(snapOf);
        if (ord) list.sort((a, b) => (a.data()[ord.f] - b.data()[ord.f]) * (ord.dir === 'desc' ? -1 : 1));
        next({ docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: {} }); };
      subs.add(run); run(); return () => subs.delete(run); }
  });
  const db = {
    collection: col => Object.assign(query(col), { path: col, add: async d => { const id = 'd' + (++n); docs.set(col + '/' + id, d); notify(); return { id }; } }),
    doc: path => ({ id: path.split('/').pop(), path, set: async d => { docs.set(path, d); notify(); }, delete: async () => { docs.delete(path); notify(); },
      onSnapshot(next) { const run = () => next(snapOf(path)); subs.add(run); run(); return () => subs.delete(run); } })
  };
  const peers = [{ isMe: false, by: 'u2', presence: {} }];
  const room = { presence: async () => {}, peers: () => peers, onPeers: () => () => {} };
  const user = { id: async () => 'u1', profiles: async ids => Object.fromEntries(ids.map(i => [i, { id: i, name: i === 'u1' ? 'Ada Lovelace' : 'Sam Rivera', color: i === 'u1' ? '#ff5a1f' : '#2f6bff' }])) };
  window.__fake = { docs, notify, peers };
  window.claude = { use: async name => ({ db, room, user }[name] || null) };
};
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push('A ' + e.message));
  await p.goto('http://localhost:8765/glint/'); await p.waitForTimeout(1600);
  await p.screenshot({ path: out + '/1-capture.png' });
  await p.click('#sampleBtn'); await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/2-compose.png' });
  console.log('send label:', (await p.textContent('#sendBtn')).trim());
  await p.click('#sendBtn'); await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/3-send.png' });
  console.log('hero:', (await p.textContent('#heroDest')).trim(), '| dests:', (await p.$$eval('.dest', e => e.map(x => x.childNodes[1]?.textContent))).join(', '));
  // before/after with a text result
  await p.evaluate(async () => { Glint.cap.result = { text: 'Done: button is now #6b4423, full width, with inline email validation.' }; });
  await p.click('#closePanel'); await p.click('#sendBtn'); await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/4-ba.png' });
  // remix round trip
  const rt = await p.evaluate(async () => { const s = await Glint.packTemplate(Glint.cap); const t = await Glint.unpackTemplate(s); return { len: s.length, ok: /^[0-9a-v]+$/.test(s), pins: t.pins.length, note: t.note.slice(0, 20) }; });
  console.log('remix:', JSON.stringify(rt));
  const code = await p.evaluate(() => Glint.packTemplate(Glint.cap));
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push('B ' + e.message));
  await p2.goto('http://localhost:8765/glint/#remix-' + code); await p2.waitForTimeout(1200);
  await p2.screenshot({ path: out + '/5-remix.png' });
  console.log('remix banner:', (await p2.textContent('#remixBanner')).trim().slice(0, 80));
  await p.click('#closePanel'); await p.click('#home'); await p.click('#roomsBtn'); await p.waitForTimeout(300);
  console.log('rooms (standalone):', (await p.textContent('#roomsBody')).trim().slice(0, 60));
  // Part 2: fake Claude host
  const ctx2 = await b.newContext({ ...devices['iPhone 13'] }); await ctx2.addInitScript(FAKE);
  const q = await ctx2.newPage(); q.on('pageerror', e => errs.push('C ' + e.message)); q.on('console', m => m.type() === 'error' && errs.push('C ' + m.text()));
  await q.goto('http://localhost:8765/glint/'); await q.waitForTimeout(1500);
  await q.click('#roomsBtn'); await q.waitForTimeout(300); await q.click('#sugg .chip'); await q.click('#mkRoom'); await q.waitForTimeout(600);
  await q.click('#postNew'); await q.click('#sampleBtn'); await q.waitForTimeout(600); await q.click('#sendBtn'); await q.waitForTimeout(1200);
  await q.click('text=Post to room'); await q.waitForTimeout(1200);
  // teammate pins live
  await q.evaluate(() => { const f = window.__fake; const post = [...f.docs.keys()].find(k => /posts\/d\d+$/.test(k)); f.docs.set(post + '/notes/x1', { by: 'u2', at: Date.now(), x: .5, y: .3, text: 'Swap the hero for latte art' }); f.peers[0].presence = { rid: post.split('/')[1], pid: post.split('/')[3], pt: [.6, .45] }; f.notify(); });
  await q.waitForTimeout(800); await q.click('#glintBtn'); await q.waitForTimeout(300);
  await q.screenshot({ path: out + '/6-post.png', fullPage: true });
  console.log('post notes:', await q.$$eval('#pnotes .nt', e => e.length), '| glint:', await q.textContent('#glintBtn'));
  await q.click('#teamSend'); await q.waitForTimeout(1200);
  const tp = await q.evaluate(() => Glint.promptText(Glint.cap)); console.log('team prompt tail:', tp.split('\n').slice(-2).join(' | '));
  await q.screenshot({ path: out + '/7-teamsend.png' });
  await q.click('#closePanel'); await q.click('#backRoom'); await q.waitForTimeout(500); await q.screenshot({ path: out + '/8-room.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
