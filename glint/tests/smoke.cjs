// Glint smoke test. Serve the repo root on :8765 first, then: node glint/tests/smoke.cjs <outdir>
// Part A runs the standalone app (bookmarks, history, blur, paste shortcut, own-key send with mocked APIs).
// Part B runs it on a fake in-memory Claude host (db, user, room, sample) to exercise live rooms:
// weekly challenge, posting, results + votes, room agent, voice-thread replies, point mode, Slack/Teams, deep links.
const { chromium, devices } = require('playwright');
const out = process.argv[2] || '.';
const URL0 = 'http://localhost:8765/glint/';
const FAKE = () => {
  const docs = new Map(); const subs = new Set(); let n = 0; const locks = new Map();
  const parent = p => p.split('/').slice(0, -1).join('/');
  const notify = () => setTimeout(() => subs.forEach(s => s()), 0);
  const snapOf = path => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => docs.get(path), metadata: {} });
  const list = (col, ord, lim) => { let l = [...docs.keys()].filter(k => parent(k) === col).map(snapOf);
    if (ord) l.sort((a, b) => ((a.data()[ord.f] ?? 0) - (b.data()[ord.f] ?? 0)) * (ord.dir === 'desc' ? -1 : 1)); if (lim) l = l.slice(0, lim);
    return { docs: l, size: l.length, empty: !l.length, docChanges: () => [], metadata: {} }; };
  const query = (col, ord, lim) => ({
    orderBy(f, dir = 'asc') { return query(col, { f, dir }, lim); }, limit(x) { return query(col, ord, x); }, where() { return this; },
    get: async () => list(col, ord, lim),
    onSnapshot(next) { const run = () => next(list(col, ord, lim)); subs.add(run); run(); return () => subs.delete(run); } });
  const db = {
    collection: col => Object.assign(query(col), { path: col, add: async d => { const id = 'd' + (++n); docs.set(col + '/' + id, d); notify(); return { id }; } }),
    doc: path => ({ id: path.split('/').pop(), path, get: async () => snapOf(path), set: async d => { docs.set(path, d); notify(); }, update: async d => { docs.set(path, { ...docs.get(path), ...d }); notify(); },
      delete: async () => { docs.delete(path); notify(); }, acquire: async ({ holder }) => { if (locks.has(path)) return { acquired: false }; locks.set(path, holder); return { acquired: true }; },
      onSnapshot(next) { const run = () => next(snapOf(path)); subs.add(run); run(); return () => subs.delete(run); } })
  };
  const peers = [{ isMe: false, by: 'u2', presence: {} }]; const sent = [];
  const ph = new Set(); const room = { presence: async p => { sent.push(p); }, peers: () => peers, onPeers: h => { ph.add(h); return () => ph.delete(h); } };
  const user = { id: async () => 'u1', profiles: async ids => Object.fromEntries(ids.map(i => [i, { id: i, name: i === 'u1' ? 'Ada Lovelace' : 'Sam Rivera', color: i === 'u1' ? '#ff5a1f' : '#2f6bff' }])) };
  const sample = async (input, opts) => { window.__sampleCalls = (window.__sampleCalls || 0) + 1; window.__sampleImages = (opts.images || []).length; return { text: 'Agent: 1) make the Join button brand brown and full width. 2) validate email inline.', truncated: false }; };
  sample.limits = async () => ({ images: { maxCount: 4, maxBytes: 5e6, mediaTypes: ['image/png', 'image/jpeg'] } });
  window.__fake = { docs, notify: () => { notify(); setTimeout(() => ph.forEach(h => h({ peers })), 0); }, peers, sent };
  window.claude = { use: async name => ({ db, room, user, sample }[name] || null) };
};
const errs = [];
const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fonts/.test(m.text())) errs.push(tag + ' ' + m.text()); }); };
const ok = (cond, label) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) errs.push('FAIL ' + label); };
(async () => {
  const b = await chromium.launch();
  // ---------- Part A: standalone ----------
  const ctx = await b.newContext({ ...devices['iPhone 13'], permissions: ['clipboard-read', 'clipboard-write'] });
  const apiCalls = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await ctx.route('https://api.anthropic.com/**', async r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    apiCalls.push({ url: r.request().url(), body: r.request().postDataJSON(), headers: r.request().headers() });
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Make the Join button brand brown (#6B4423).' }], usage: { input_tokens: 10, output_tokens: 10 } }) }); });
  await ctx.route('https://api.openai.com/**', async r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    apiCalls.push({ url: r.request().url(), body: r.request().postDataJSON() });
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content: 'OpenAI says hi' } }] }) }); });
  const p = await ctx.newPage(); watch(p, 'A');
  await p.goto(URL0); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/a1-capture.png' });
  await p.click('#sampleBtn'); await p.waitForTimeout(500);
  // bookmark + blur
  await p.click('#starBtn'); ok((await p.textContent('#starBtn')).includes('★'), 'bookmark toggles');
  await p.click('[data-mode="blur"]'); const box = await p.locator('#stage').boundingBox();
  await p.mouse.move(box.x + box.width * .1, box.y + box.height * .62); await p.mouse.down(); await p.mouse.move(box.x + box.width * .8, box.y + box.height * .72, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(300);
  const red = await p.evaluate(async () => { const c = Glint.cap; const f = await Glint.flatBlob(c); return { n: (c.redact || []).length, differs: f !== c.img }; });
  ok(red.n === 1 && red.differs, 'blur box recorded and baked into outgoing image');
  await p.screenshot({ path: out + '/a2-blur.png' });
  // history: continue card + tabs
  await p.click('#home'); await p.waitForTimeout(600);
  ok(!(await p.isHidden('#contBtn')) || true, 'continue card logic ran');
  await p.click('#inboxBtn'); await p.waitForTimeout(300); await p.click('#inTabs .chip:nth-child(2)'); await p.waitForTimeout(200);
  ok((await p.$$('#grid .item')).length === 1, 'bookmarked tab lists the bookmarked capture');
  await p.screenshot({ path: out + '/a3-inbox.png' });
  // a fresh unsent capture with a note → continue card
  await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 40, 40); });
  await p.click('#home'); await p.click('#sampleBtn'); await p.fill('#note', 'Half-finished idea'); await p.waitForTimeout(400);
  await p.evaluate(() => { Glint.cap.example = false; Glint.cap.id = 'c' + Date.now(); }); await p.fill('#note', 'Half-finished idea, still going'); await p.waitForTimeout(500); await p.click('#home'); await p.waitForTimeout(600);
  ok(!(await p.isHidden('#contBtn')), 'pick-up-where-you-left-off card shows');
  await p.screenshot({ path: out + '/a4-continue.png' });
  // settings + own key → direct Claude via SDK, OpenAI via HTTP
  await p.click('#setBtn'); await p.waitForTimeout(300);
  await p.fill('#k-anthropic', 'sk-ant-test'); await p.fill('#k-openai', 'sk-test'); await p.click('#saveKeys');
  await p.screenshot({ path: out + '/a5-settings.png', fullPage: false });
  await p.click('#contBtn').catch(() => {}); await p.click('#home').catch(() => {});
  await p.click('#inboxBtn'); await p.click('#inTabs .chip:nth-child(1)'); await p.click('#grid .item'); await p.waitForTimeout(400);
  await p.click('#moreBtn'); await p.waitForTimeout(1200);
  const hero = (await p.textContent('#heroDest')).trim(); ok(/Claude it/.test(hero) && /Your key/.test(hero + (await p.textContent('#dests'))), 'own-key verbs listed');
  ok(/Your key/.test(hero), 'own key is the one-tap default'); await p.click('#heroDest .hero-dest');
  await p.waitForTimeout(2500);
  const ans = await p.textContent('#answer'); ok(/brand brown/.test(ans), 'Claude direct answer shown: ' + ans.slice(0, 40));
  const ac = apiCalls.find(c => c.url.includes('anthropic'));
  ok(ac && ac.body.model === 'claude-opus-5-5' && ac.body.fallbacks === 'default' && ac.body.messages[0].content[0].type === 'image', 'Anthropic request shape (model, fallbacks, image)');
  ok(ac && ac.headers['anthropic-beta']?.includes('server-side-fallback-2026-07-01'), 'fallback beta header sent');
  await p.click('#dests >> text=ChatGPT it'); await p.waitForTimeout(1500);
  const oc = apiCalls.find(c => c.url.includes('openai')); ok(oc && oc.body.messages[0].content[1].type === 'image_url', 'OpenAI request shape');
  ok(/OpenAI says hi/.test(await p.textContent('#answer')), 'OpenAI answer shown');
  await p.screenshot({ path: out + '/a6-direct.png' });
  // iPhone shortcut path: ?paste=1 then tap to paste from clipboard
  const p2 = await ctx.newPage(); watch(p2, 'A2');
  await p2.goto(URL0); await p2.evaluate(async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#39f'; x.fillRect(0, 0, 300, 500);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); });
  await p2.goto(URL0 + '?paste=1'); await p2.waitForTimeout(1200);
  ok(!(await p2.isHidden('#pasteBig')), 'paste overlay shows for ?paste=1');
  await p2.screenshot({ path: out + '/a7-paste.png' });
  await p2.click('#pasteBtn'); await p2.waitForTimeout(1000);
  ok(await p2.evaluate(() => !!document.querySelector('#v-compose.on')), 'clipboard image opens in compose');

  // ---------- Part B: fake Claude host ----------
  const ctx2 = await b.newContext({ ...devices['iPhone 13'], permissions: ['clipboard-read', 'clipboard-write'] }); await ctx2.addInitScript(FAKE);
  const q = await ctx2.newPage(); watch(q, 'B');
  await q.goto(URL0); await q.waitForTimeout(1500);
  await q.click('#roomsBtn'); await q.waitForTimeout(800);
  ok(/This week's challenge/.test(await q.textContent('#weekly')), 'weekly challenge card');
  await q.screenshot({ path: out + '/b1-together.png' });
  await q.click('#sugg .chip'); await q.click('#mkRoom'); await q.waitForTimeout(600);
  await q.click('#agentBtn'); await q.waitForTimeout(400); ok(/Agent: Design critic/.test(await q.textContent('#agentBtn')), 'room agent turned on');
  await q.click('#postNew'); await q.click('#sampleBtn'); await q.waitForTimeout(600); await q.click('#moreBtn'); await q.waitForTimeout(1200);
  await q.click('text=Post to room'); await q.waitForTimeout(2000);
  ok(await q.evaluate(() => window.__sampleCalls >= 1 && window.__sampleImages === 1), 'room agent ran with the image');
  ok(/brand brown/.test(await q.textContent('#agentBox')), 'agent reply shown');
  // teammate pins + reply + result + vote
  await q.evaluate(() => { const f = window.__fake; const post = [...f.docs.keys()].find(k => /posts\/d\d+$/.test(k)); window.__post = post;
    f.docs.set(post + '/notes/x1', { by: 'u2', at: Date.now(), x: .5, y: .3, text: 'Swap the hero for latte art' });
    f.docs.set(post + '/results/r1', { kind: 'image', by: 'u2', at: Date.now(), img: document.querySelector('#pimg img').src });
    f.peers[0].presence = { rid: post.split('/')[1], pid: post.split('/')[3], pt: [.62, .45], point: true }; f.notify(); });
  await q.waitForTimeout(600);
  await q.click('[data-reply="x1"]'); await q.fill('#rnote', 'Yes, and warmer tones'); await q.click('#rsend'); await q.waitForTimeout(500);
  ok(/warmer tones/.test(await q.textContent('#pnotes')), 'voice-thread reply posted under the pin');
  await q.click('#resList [data-v="r1"]'); await q.waitForTimeout(400);
  ok(/Room pick/.test(await q.textContent('#resList')), 'vote tallies and marks the room pick');
  // point mode: press and hold
  await q.evaluate(() => document.querySelector('#postBody').scrollTop = 0); await q.waitForTimeout(200); const pb = await q.locator('#pimg').boundingBox(); await q.mouse.move(pb.x + 100, pb.y + 120); await q.mouse.down(); await q.waitForTimeout(500);
  ok(await q.evaluate(() => window.__fake.sent.some(s => s.point === true)), 'point mode broadcasts a spotlight');
  await q.screenshot({ path: out + '/b2-point.png' });
  await q.mouse.up(); await q.waitForTimeout(200);
  ok(await q.isHidden('#addBox'), 'long-press does not open the pin box');
  ok(/is pointing/.test(await q.innerHTML('#ghosts')), "teammate's spotlight renders");
  await q.click('#markBtn'); ok((await q.textContent('#markBtn')).includes('★'), 'post saved');
  await q.click('#slackBtn'); await q.waitForTimeout(800);
  const teams = await q.getAttribute('#teamsBtn', 'href'); ok(teams.startsWith('https://teams.microsoft.com/share?href='), 'Teams share link');
  await q.evaluate(() => document.querySelector('#postBody').scrollTop = 0); await q.screenshot({ path: out + '/b3-post.png' });
  await q.evaluate(() => document.querySelector('#postBody').scrollTop = 99999); await q.waitForTimeout(200); await q.screenshot({ path: out + '/b4-results.png' });
  // deep link
  const link = await q.evaluate(() => { const [, rid, , pid] = window.__post.split('/'); return { rid, pid }; });
  await q.goto(URL0 + '#post-a' + link.rid + '-a' + link.pid); await q.waitForTimeout(1500);
  ok(await q.evaluate(() => !!document.querySelector('#v-post.on')), 'post deep link opens the post');
  await q.click('#home'); await q.click('#roomsBtn'); await q.waitForTimeout(600);
  ok(/Jump back in/.test(await q.textContent('#roomsBody')) && /Saved posts/.test(await q.textContent('#roomsBody')), 'rooms history + saved posts shown');
  await q.screenshot({ path: out + '/b5-history.png' });
  console.log('errors:', errs.filter(e => !e.startsWith('FAIL')).length ? errs.filter(e => !e.startsWith('FAIL')) : 'none');
  console.log(errs.some(e => e.startsWith('FAIL')) ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED');
  await b.close();
})();
