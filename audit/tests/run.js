#!/usr/bin/env node
// Neverworn end-to-end + unit test suite (Playwright, no npm install needed beyond `playwright`).
//
//   node audit/tests/run.js            # tests the app at the repo root
//   node audit/tests/run.js live B08   # only tests whose name matches B08
//
// Two kinds of test:
//   [F] feature tests — every user-facing function. Must pass on BOTH versions.
//   [B] bug regression tests — each reproduces one bug from AUDIT.md. Expected to FAIL on original, PASS on improved.
// Camera: Chromium's fake device. Pose model: audit/tests/fakepose.js stands in for the jsDelivr bundles.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const TARGET = process.argv[2] || 'live';
const ONLY = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
const REPO = path.resolve(__dirname, '../..');
const FAKE = fs.readFileSync(path.join(__dirname, 'fakepose.js'), 'utf8');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.png': 'image/png' };
const W = ms => new Promise(r => setTimeout(r, ms));
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(REPO, p); if (!f.startsWith(REPO) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
      const st = fs.statSync(f), type = TYPES[path.extname(f)] || 'application/octet-stream', range = q.headers.range;
      if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const start = +a, end = b ? +b : st.size - 1;
        r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 }); return fs.createReadStream(f, { start, end }).pipe(r); }
      r.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

const tests = [];
const F = (name, fn) => tests.push({ kind: 'F', name, fn });
const B = (name, fn) => tests.push({ kind: 'B', name, fn });
function assert(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'expected equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

let browser, BASE;
async function fresh(opts = {}) {
  const ctx = await browser.newContext({ permissions: ['camera'], acceptDownloads: true, ...opts });
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ body: FAKE, contentType: 'text/javascript' }));
  await ctx.addInitScript(() => {
    window.__errs = []; addEventListener('error', e => __errs.push(e.message)); addEventListener('unhandledrejection', e => __errs.push(String(e.reason)));
    window.__toasts = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList && n.classList.contains('toast') && __toasts.push(n.textContent)))).observe(document, { childList: true, subtree: true });
    window.__tracks = []; if (navigator.mediaDevices) { const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async c => { const s = await gum(c); __tracks.push(...s.getTracks()); return s; }; }
  });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  p.pageErrors = []; p.on('pageerror', e => p.pageErrors.push(e.message));
  await p.goto(BASE); await p.waitForSelector('.card');
  return p;
}
const nav = async (p, h) => { await p.evaluate(h => { location.hash = h; }, h); await W(250); };
const hash = p => p.evaluate(() => location.hash);
const toasts = p => p.evaluate(() => window.__toasts);
async function signup(p, email = 'ann@example.com', pw = 'password1') {
  await nav(p, '#/signup'); await p.fill('[name=n]', 'Ann'); await p.fill('[name=e]', email); await p.fill('[name=p]', pw); await p.check('[name=a]'); await p.click('#sgo'); await W(500);
}
async function signin(p, email = 'ann@example.com', pw = 'password1') {
  await nav(p, '#/signup'); await p.click('#m-in'); await p.fill('[name=e]', email); await p.fill('[name=p]', pw); await p.click('#sgo'); await W(500);
}
// If sign-out destroys the page (bug B02 in the original), reload so later steps test their OWN behaviour, not that bug's fallout.
async function signout(p) { await nav(p, '#/privacy'); await p.click('text=Sign out'); await W(500); if (!(await p.locator('#app').count())) { await p.goto('about:blank'); await p.goto(BASE); await p.waitForSelector('.card'); } }
const setAvatar = p => p.evaluate(g => S.set('avatar', { frames: [g], created: new Date().toISOString(), version: 1 }), GIF);
const BODY = { height: 170, shoulder: 40, chest: 96, waist: 80, hips: 100, inseam: 80, arm: 66, torso: 58 };
async function enterBody(p, m = BODY) {
  await nav(p, '#/measure?manual=1');
  for (const [k, v] of Object.entries(m)) await p.fill(`#mf [name=${k}]`, String(v));
  await p.click('text=Save to my account'); await W(400);
}
const addToBag = async (p, id) => { await nav(p, '#/p/' + id); await p.click('text=Make mine'); await W(150); };
const bagCount = p => p.evaluate(() => (S.get('cart') || []).reduce((s, l) => s + (typeof l === 'string' ? 1 : l.qty || 1), 0));

// ===================================================================== FEATURE TESTS
F('Home renders all 20 pieces with no JS errors', async () => {
  const p = await fresh(); eq(await p.locator('.card').count(), 20, 'card count');
  assert(/designed by AI/.test(await p.textContent('h1')), 'hero heading'); eq(p.pageErrors, [], 'page errors');
});
F('Tier filter: counts per tier and persists across reload', async () => {
  const p = await fresh(); const counts = {};
  for (const [label, n] of [['Everyday', 4], ['In-between', 4], ['Futuristic', 12], ['All', 20]]) {
    await p.click(`#tiers button:has-text("${label}")`); await W(100); counts[label] = await p.locator('.card').count(); eq(counts[label], n, label);
  }
  await p.click('#tiers button:has-text("Everyday")'); await p.reload(); await p.waitForSelector('.card'); eq(await p.locator('.card').count(), 4, 'persisted');
});
F('Product cards link to product pages; every product page renders', async () => {
  const p = await fresh(); const ids = await p.$$eval('.card', a => a.map(x => x.getAttribute('href').split('/').pop()));
  eq(ids.length, 20);
  for (const id of ids) { await nav(p, '#/p/' + id); assert(await p.locator('.pp h1').count() === 1, 'no product page for ' + id); assert(/£\d+/.test(await p.textContent('.price')), 'price ' + id); }
  eq(p.pageErrors, [], 'page errors');
});
F('Product media tabs switch panels and the video tab plays', async () => {
  const p = await fresh(); await nav(p, '#/p/alloy-bomber');
  const vis = () => p.$$eval('.mp', ps => ps.filter(x => !x.hidden).map(x => x.dataset.m));
  eq(await vis(), ['views'], 'default views');
  await p.click('#mt button[data-m="3d"]'); eq(await vis(), ['3d']);
  await p.click('#mt button[data-m="video"]'); eq(await vis(), ['video']); await W(800);
  assert(await p.evaluate(() => !document.querySelector('#svv').paused), 'video should play');
  await p.click('#mt button[data-m="views"]'); assert(await p.evaluate(() => document.querySelector('#svv').paused), 'video paused on leave');
});
F('Gallery thumbnails scroll to the chosen angle', async () => {
  const p = await fresh(); await nav(p, '#/p/arc-jeans'); await p.click('#th button[data-i="3"]'); await W(900);
  const r = await p.evaluate(() => Math.round(gal.scrollLeft / gal.clientWidth)); eq(r, 3, 'gallery index');
  assert(await p.evaluate(() => document.querySelectorAll('#th button')[3].classList.contains('on')), 'thumb active');
});
F('3D turntable rotates on drag', async () => {
  const p = await fresh(); await nav(p, '#/p/arc-jeans'); await p.click('#mt button[data-m="3d"]'); await W(200);
  const bx = await p.locator('#tt').boundingBox(); await p.mouse.move(bx.x + bx.width * .8, bx.y + 100); await p.mouse.down(); await p.mouse.move(bx.x + bx.width * .3, bx.y + 100, { steps: 8 }); await p.mouse.up(); await W(600);
  const f = await p.evaluate(() => +document.querySelector('#tt').dataset.f); assert(f > 0, 'frame changed, got ' + f);
  assert((await p.getAttribute('#tti', 'src')).match(/t\d\d\.webp$/), 'frame image');
});
F('Try-on hold without an avatar sends you to create one', async () => {
  const p = await fresh(); await nav(p, '#/p/halo-puffer'); await p.locator('#hv').dispatchEvent('pointerdown'); await W(400);
  assert((await hash(p)).startsWith('#/signup'), 'goes to signup, got ' + await hash(p));
});
F('Bag: add, count badge, total, remove', async () => {
  const p = await fresh(); await addToBag(p, 'arc-jeans'); await addToBag(p, 'fold-shirt');
  assert((await p.textContent('#cc')).includes('2'), 'badge 2'); await nav(p, '#/cart');
  assert((await p.textContent('#app')).includes('£195'), 'total 110+85');
  await p.locator('#app .list li').first().locator('text=✕').click(); await W(300); eq(await bagCount(p), 1, 'after remove');
});
F('Sign-up validation, duplicate email, wrong password, sign-in', async () => {
  const p = await fresh();
  await nav(p, '#/signup'); await p.fill('[name=n]', 'A'); await p.fill('[name=e]', 'a@example.com'); await p.fill('[name=p]', 'short'); await p.check('[name=a]'); await p.click('#sgo'); await W(300);
  assert(!(await p.evaluate(() => S.get('user'))), 'short password must not create account');
  await signup(p, 'a@example.com'); assert(await p.evaluate(() => S.get('user')?.email) === 'a@example.com', 'signed up');
  await signout(p); await signup(p, 'a@example.com'); assert(!(await p.evaluate(() => S.get('user'))), 'duplicate rejected');
  await signin(p, 'a@example.com', 'wrongpass1'); assert(!(await p.evaluate(() => S.get('user'))), 'wrong pw rejected');
  await signin(p, 'a@example.com', 'password1'); assert(await p.evaluate(() => S.get('user')?.email) === 'a@example.com', 'signed in');
  const pw = await p.evaluate(() => JSON.parse(localStorage.nw_db).users['a@example.com'].pw); assert(!pw.includes('password1'), 'password not stored in clear');
});
F('Avatar: consent is required before recording', async () => {
  const p = await fresh(); await signup(p); await nav(p, '#/avatar'); await p.click('text=I agree, start recording'); await W(200);
  assert((await hash(p)).startsWith('#/avatar'), 'stays without consent'); assert((await toasts(p)).some(t => /consent/i.test(t)), 'toast');
  await p.check('#c1'); await p.click('text=I agree, start recording'); await W(300);
  assert((await hash(p)).startsWith('#/capture'), 'to capture'); assert(await p.evaluate(() => !!S.get('consent').biometric), 'consent stored');
});
F('Avatar: guided camera recording saves frames and continues to height', async () => {
  const p = await fresh(); await signup(p); await nav(p, '#/avatar'); await p.check('#c1'); await p.click('text=I agree, start recording');
  await p.waitForSelector('#rec:not([disabled])', { timeout: 8000 }); await p.click('#rec'); await p.waitForFunction(() => location.hash.startsWith('#/height'), null, { timeout: 15000 });
  const n = await p.evaluate(() => S.get('avatar').frames.length); eq(n, 4, 'frames');
  eq(await p.evaluate(() => __tracks.filter(t => t.readyState === 'live').length), 0, 'camera released');
});
F('Avatar: photo upload works instead of the camera', async () => {
  const p = await fresh(); await signup(p); await p.evaluate(() => S.set('consent', { biometric: new Date().toISOString() })); await nav(p, '#/capture');
  await p.setInputFiles('input[type=file]', path.join(REPO, 'assets/p/01/front.webp')); await p.waitForFunction(() => location.hash.startsWith('#/height'), null, { timeout: 8000 });
  assert(await p.evaluate(() => S.get('avatar').frames[0].startsWith('data:image/jpeg')), 'frame saved');
});
F('Height: validates range, accepts cm and ft/in', async () => {
  const p = await fresh(); await signup(p); await nav(p, '#/height'); await p.fill('#hcm', '90'); await p.click('#hgo'); await W(200);
  assert((await hash(p)).startsWith('#/height'), 'rejects 90cm');
  await p.click('.seg button:has-text("ft")'); await W(200); await p.fill('#hft', '5'); await p.fill('#hin', '9'); await p.click('#hgo'); await W(300);
  eq(await p.evaluate(() => S.get('h')), 175, '5ft9 = 175cm'); assert((await hash(p)).startsWith('#/scan'), 'to scan');
});
F('Body scan (fake pose model) produces a draft and the measure page', async () => {
  const p = await fresh(); await signup(p); await nav(p, '#/height'); await p.fill('#hcm', '170'); await p.click('#hgo');
  await p.waitForSelector('#bgo:not([disabled])', { timeout: 8000 }); await p.click('#bgo'); await p.waitForFunction(() => location.hash === '#/measure', null, { timeout: 15000 }); await W(200);
  const d = await p.evaluate(() => S.get('draft')); eq(d.source, 'scan'); assert(d.chest > 0 && d.hips > 0, 'measurements');
  eq(await p.inputValue('#mf [name=height]'), '170', 'height prefilled');
  await p.click('text=Save to my account'); await W(400); const b = await p.evaluate(() => S.get('body')); eq(b.source, 'scan'); assert(b.shape, 'shape');
  eq(await p.evaluate(() => __tracks.filter(t => t.readyState === 'live').length), 0, 'camera released');
});
F('Manual measurements save, classify and show on the account page', async () => {
  const p = await fresh(); await signup(p); await enterBody(p);
  const b = await p.evaluate(() => S.get('body')); eq(b.shape, 'rectangle'); eq(b.source, 'manual'); eq(b.build, 'Average');
  await nav(p, '#/privacy'); await W(200); assert((await p.textContent('#bp')).includes('96 cm'), 'body panel');
});
F('Product page shows a size once measured; hold shows the body-matched variant', async () => {
  const p = await fresh(); await signup(p); await enterBody(p); await setAvatar(p); await nav(p, '#/p/halo-puffer'); await W(200);
  eq((await p.textContent('.fit .sz')).trim(), 'M', 'size'); assert(await p.locator('.fitv img[src*="halo-rectangle"]').count() === 1, 'variant');
  await p.locator('#hv').dispatchEvent('pointerdown'); assert(await p.evaluate(() => document.querySelector('#hv').classList.contains('holding')), 'holding');
  await p.locator('#hv').dispatchEvent('pointerup'); assert(!(await p.evaluate(() => document.querySelector('#hv').classList.contains('holding'))), 'released');
});
F('Account: consent toggles persist; download my data; delete body; delete avatar', async () => {
  const p = await fresh(); await signup(p); await enterBody(p); await setAvatar(p); await nav(p, '#/privacy');
  await p.locator('.toggle input').first().check(); await W(150); eq(await p.evaluate(() => S.get('consent').training), true, 'training opt-in');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Download my data')]);
  const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); eq(data.user.email, 'ann@example.com'); assert(data.body && data.avatar, 'export complete');
  await p.click('#bp >> text=Delete body data'); await W(200); assert(!(await p.evaluate(() => S.get('body'))), 'body deleted');
  await p.click('text=Delete avatar and all try-ons'); await W(200); assert(!(await p.evaluate(() => S.get('avatar'))), 'avatar deleted');
  assert(await p.evaluate(() => !!S.get('consent').withdrawn), 'withdrawal recorded');
});
F('Design with AI: chips, free text, keyword matching, remix', async () => {
  const p = await fresh(); await nav(p, '#/design'); await p.click('.chips button >> nth=0'); await W(300);
  eq(await p.locator('.opts a').count(), 3, '3 options'); const names = await p.$$eval('.opts a b', b => b.map(x => x.textContent));
  assert(names.some(n => /Trench|Parka/.test(n)), 'rain → trench/parka, got ' + names);
  await p.fill('.prompt input', 'a silver gown'); await p.press('.prompt input', 'Enter'); await W(300); eq(await p.locator('.opts').count(), 2, 'second reply');
  await nav(p, '#/p/arc-jeans'); await p.click('text=Remix with AI'); await W(400); assert((await p.textContent('.msg.me')).includes('Like the Arc Jeans'), 'remix prompt');
});
F('Hero prompt opens Design with the text', async () => {
  const p = await fresh(); await p.fill('.hero input', 'a coat for snow'); await p.press('.hero input', 'Enter'); await W(400);
  assert((await hash(p)).startsWith('#/design'), 'design'); assert((await p.textContent('.msg.me')).includes('a coat for snow'), 'sent');
});
F('Checkout (signed in) places an order and empties the bag', async () => {
  const p = await fresh(); await signup(p); await addToBag(p, 'arc-jeans'); await nav(p, '#/checkout');
  const addr = p.locator('#app textarea, #app input.f:not([disabled])').first(); await addr.fill('1 Test Street, London');
  await p.click('text=Place order'); await W(500);
  assert(/Order NW-/.test(await p.textContent('h1')), 'confirmation'); eq(await bagCount(p), 0, 'bag emptied');
  eq(await p.evaluate(() => JSON.parse(localStorage.nw_db).orders.length), 1, 'order stored');
});
F('Fit engine unit checks (classify / build / variant / ellipse)', async () => {
  const p = await fresh(); const r = await p.evaluate(() => ({
    hour: classify({ chest: 96, waist: 70, hips: 98 }), pear: classify({ chest: 90, waist: 75, hips: 104 }), inv: classify({ chest: 110, waist: 88, hips: 98 }),
    oval: classify({ chest: 100, waist: 104, hips: 102 }), rect: classify({ chest: 96, waist: 82, hips: 98 }),
    build: build({ waist: 80, height: 170 }), v: variant({ shape: 'pear', height: 162 }).id, circle: Math.round(ell(10, 10) * 100) / 100,
    sizeS: recommend({ ...{ height: 165, chest: 90, waist: 72, hips: 94, arm: 59, torso: 50, inseam: 77 }, shape: 'rectangle' }, 'seam-hoodie').size,
    sizeXXL: recommend({ height: 180, chest: 140, waist: 120, hips: 130, arm: 65, torso: 50, inseam: 80, shape: 'oval' }, 'seam-hoodie').size }));
  eq(r, { hour: 'hourglass', pear: 'pear', inv: 'inverted', oval: 'oval', rect: 'rectangle', build: 'Average', v: 'pear', circle: 31.42, sizeS: 'S', sizeXXL: 'XXL' });
});
F('Mobile (390px): no horizontal scroll on main pages', async () => {
  const p = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const bad = [];
  for (const h of ['#/', '#/p/halo-puffer', '#/design', '#/cart', '#/signup']) { await nav(p, h); if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('header a, header button')].some(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }))) bad.push(h); }
  eq(bad, [], 'pages overflowing');
});
F('All catalogue assets exist (images, 24 turntable frames, video)', async () => {
  const cat = JSON.parse(fs.readFileSync(path.join(REPO, 'catalog.json'))); const miss = [];
  for (const x of cat) for (const f of [x.img, ...['front', '3q', 'side', 'back', 'detail'].map(k => `${x.dir}/${k}.webp`), `${x.dir}/show.mp4`, `${x.dir}/show.jpg`, ...Array.from({ length: x.frames }, (_, i) => `${x.dir}/t${String(i + 1).padStart(2, '0')}.webp`)])
    if (!fs.existsSync(path.join(REPO, f))) miss.push(f);
  eq(miss, [], 'missing');
});

F('Existing data from the live site still works (legacy password hash + legacy bag)', async () => {
  const p = await fresh();
  await p.evaluate(async () => { // exactly the shape the original backend.js writes
    const salt = 'abcd1234', hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    const pw = salt + ':' + hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':password1')));
    localStorage.nw_db = JSON.stringify({ users: { 'old@example.com': { email: 'old@example.com', name: 'Old', pw, created: '2026-01-01T00:00:00Z', state: { cart: ['arc-jeans', 'arc-jeans', 'fold-shirt'] } } }, session: null, orders: [] });
  });
  await p.reload(); await p.waitForSelector('.card'); await signin(p, 'old@example.com');
  eq(await p.evaluate(() => S.get('user')?.email), 'old@example.com', 'legacy login'); eq(await bagCount(p), 3, 'legacy bag');
  await nav(p, '#/cart'); assert((await p.textContent('#app')).includes('£305'), 'legacy bag total');
});

// ===================================================================== BUG REGRESSION TESTS
B('B01 XSS: ?next= on the sign-up URL must not execute script', async () => {
  const p = await fresh(); await nav(p, '#/signup?next=' + encodeURIComponent('"><img src=x onerror="window.__xss=1">')); await W(300);
  assert(!(await p.evaluate(() => window.__xss)), 'injected script ran');
});
B('B02 Sign out keeps the app working (original replaced the page with "#/")', async () => {
  const p = await fresh(); await signup(p); await nav(p, '#/privacy'); await p.click('text=Sign out'); await W(500); assert(await p.locator('#app').count() === 1, 'app destroyed: ' + (await p.textContent('body')).slice(0, 30));
});
B('B03 Sign out clears the bag from this browser', async () => {
  const p = await fresh(); await signup(p); await addToBag(p, 'arc-jeans'); await signout(p); await p.goto(BASE + '#/cart'); await W(300); eq(await bagCount(p), 0, 'bag left for next person');
});
B('B04 Guest bag is kept when signing in to an existing account', async () => {
  const p = await fresh(); await signup(p); await signout(p); await p.goto(BASE + '#/'); await W(300);
  await addToBag(p, 'arc-jeans'); await signin(p); eq(await bagCount(p), 1, 'bag after sign-in');
});
B('B05 Avatar survives sign out and sign back in', async () => {
  const p = await fresh(); await signup(p); await setAvatar(p); await signout(p); await p.goto(BASE + '#/'); await W(200); await signin(p);
  assert(await p.evaluate(() => !!S.get('avatar')), 'avatar lost');
});
B('B06 Mobile: home hero video does not block page scrolling', async () => {
  const p = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const ta = await p.evaluate(() => getComputedStyle(document.querySelector('.hero .vid')).touchAction); assert(ta !== 'none', 'touch-action:none on hero');
});
B('B07 Jeans size advice does not mention sleeves or chest', async () => {
  const p = await fresh(); const r = await p.evaluate(() => recommend({ height: 170, chest: 96, waist: 80, hips: 100, arm: 66, torso: 58, inseam: 80, shape: 'rectangle' }, 'arc-jeans'));
  assert(!r.notes.some(n => /sleeve|chest/.test(n)), 'notes: ' + r.notes.join('; '));
});
B('B08 Leaving the page mid-scan does not yank you back to #/measure', async () => {
  const p = await fresh(); await signup(p); await nav(p, '#/height'); await p.fill('#hcm', '170'); await p.click('#hgo');
  await p.waitForSelector('#bgo:not([disabled])', { timeout: 8000 }); await p.click('#bgo'); await W(400); await nav(p, '#/cart'); await W(7000);
  eq(await hash(p), '#/cart', 'hash');
});
B('B09 Leaving mid-recording does not create an avatar or redirect', async () => {
  const p = await fresh(); await signup(p); await p.evaluate(() => S.set('consent', { biometric: new Date().toISOString() })); await nav(p, '#/capture');
  await p.waitForSelector('#rec:not([disabled])', { timeout: 8000 }); await p.click('#rec'); await W(400); await nav(p, '#/'); await W(8500);
  eq(await hash(p), '#/', 'hash'); assert(!(await p.evaluate(() => S.get('avatar'))), 'avatar created after leaving');
});
B('B10 Guest checkout offers a way to sign in (keeps the bag)', async () => {
  const p = await fresh(); await addToBag(p, 'arc-jeans'); await nav(p, '#/checkout');
  const link = await p.locator('#app a[href*="signup"]').count(); assert(link > 0, 'no sign-in route from checkout'); eq(await bagCount(p), 1);
});
B('B11 Reloading #/cart while signed in has no JS errors (catalogue race)', async () => {
  const p = await fresh(); await signup(p); await addToBag(p, 'arc-jeans'); await p.goto(BASE + '#/cart'); await p.reload(); await W(800);
  eq(await p.evaluate(() => __errs), [], 'errors');
});
B('B12 Camera is released after leaving a directly-loaded capture page', async () => {
  const p = await fresh(); await signup(p); await p.evaluate(() => S.set('consent', { biometric: new Date().toISOString() })); await p.goto(BASE + '#/capture'); await p.reload(); await W(1500);
  await nav(p, '#/'); await W(500); eq(await p.evaluate(() => __tracks.filter(t => t.readyState === 'live').length), 0, 'live camera tracks');
});
B('B13 Impossible measurements (chest 5 cm, waist 900 cm) are rejected', async () => {
  const p = await fresh(); await signup(p); await enterBody(p, { height: 170, shoulder: 1, chest: 5, waist: 900, hips: 1, inseam: 1, arm: 1, torso: 1 });
  assert(!(await p.evaluate(() => S.get('body'))), 'saved: ' + JSON.stringify(await p.evaluate(() => S.get('body'))));
});
B('B14 ft/in never shows "12 in" (182 cm = 6ft 0in)', async () => {
  const p = await fresh(); await signup(p); await p.evaluate(() => { S.set('h', 182); S.set('unit', 'ft'); S.set('body', { height: 182, shoulder: 40, chest: 96, waist: 80, hips: 100, inseam: 80, arm: 66, torso: 58, shape: 'rectangle', build: 'Average', source: 'manual', updated: new Date().toISOString() }); });
  await nav(p, '#/height'); eq([await p.inputValue('#hft'), await p.inputValue('#hin')], ['6', '0'], 'prefill');
  eq(await p.evaluate(() => ftin(182)), '6ft 0in', 'label');
});
B('B15 You can delete your account from the account page', async () => {
  const p = await fresh(); await signup(p); await nav(p, '#/privacy'); const btn = p.locator('text=/delete my account/i'); assert(await btn.count() > 0, 'no delete-account control');
  await btn.click(); await W(500); eq(await p.evaluate(() => Object.keys(JSON.parse(localStorage.nw_db).users)), [], 'users');
});
B('B16 Mobile: "Design with AI" is reachable from the nav', async () => {
  const p = await fresh({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  assert(await p.locator('nav a[data-r=design]').isVisible(), 'hidden on mobile');
});
B('B17 Page title reflects the current page', async () => {
  const p = await fresh(); await nav(p, '#/p/arc-jeans'); assert((await p.title()).includes('Arc Jeans'), 'title: ' + await p.title());
});
B('B18 Unknown product shows a proper not-found page with a way back', async () => {
  const p = await fresh(); await nav(p, '#/p/does-not-exist'); assert(await p.locator('#app h1').count() === 1 && await p.locator('#app a[href="#/"]').count() > 0, 'bare "Not found" text');
});
B('B19 Secondary text meets WCAG AA contrast (4.5:1)', async () => {
  const p = await fresh(); const ratio = await p.evaluate(() => {
    const rgb = s => s.match(/\d+/g).slice(0, 3).map(Number), L = c => { c = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
    const a = L(rgb(getComputedStyle(document.querySelector('p.mut')).color)), b = L(rgb(getComputedStyle(document.body).backgroundColor)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
  assert(ratio >= 4.5, 'contrast ' + ratio.toFixed(2));
});
B('B20 Keyboard: holding Space on the try-on button shows you', async () => {
  const p = await fresh(); await signup(p); await setAvatar(p); await nav(p, '#/p/halo-puffer'); await p.focus('#pyi'); await p.keyboard.down('Space'); await W(100);
  const on = await p.evaluate(() => document.querySelector('#hv').classList.contains('holding')); await p.keyboard.up('Space'); assert(on, 'not holding');
});
B('B21 Toasts are announced to screen readers (aria-live)', async () => {
  const p = await fresh(); await addToBag(p, 'arc-jeans'); const live = await p.evaluate(() => !!document.querySelector('.toast')?.closest('[aria-live]')); assert(live, 'toast not in a live region');
});
B('B22 Adding the same item twice shows quantity 2, not two rows', async () => {
  const p = await fresh(); await addToBag(p, 'arc-jeans'); await addToBag(p, 'arc-jeans'); await nav(p, '#/cart'); eq(await p.locator('#app .list li').count(), 2, 'rows (1 item + total)');
});
B('B23 Address is required to place an order', async () => {
  const p = await fresh(); await signup(p); await addToBag(p, 'arc-jeans'); await nav(p, '#/checkout'); await p.click('text=Place order'); await W(400);
  eq(await p.evaluate(() => JSON.parse(localStorage.nw_db).orders.length), 0, 'order placed with no address');
});
B('B24 Passwords use a slow KDF (PBKDF2), not one SHA-256 round', async () => {
  const p = await fresh(); await signup(p); const pw = await p.evaluate(() => JSON.parse(localStorage.nw_db).users['ann@example.com'].pw); assert(pw.startsWith('pbkdf2$'), 'hash format ' + pw.slice(0, 12));
});
B('B25 Product page does not preload the 1.9 MB try-on video for visitors', async () => {
  const p = await fresh(); await nav(p, '#/p/halo-puffer'); eq(await p.getAttribute('#hv video.you', 'preload'), 'none');
});

// ===================================================================== runner
(async () => {
  const srv = await serve(); BASE = `http://127.0.0.1:${srv.address().port}/`; // the improved version is now the root app
  browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const results = [];
  for (const t of tests) {
    if (ONLY && !ONLY.test(t.name)) continue;
    const t0 = Date.now(); let err = null;
    try { await Promise.race([t.fn(), W(60000).then(() => { throw new Error('timeout'); })]); } catch (e) { err = e.message.split('\n')[0]; }
    for (const c of browser.contexts()) await c.close();
    results.push({ kind: t.kind, name: t.name, pass: !err, err, ms: Date.now() - t0 });
    console.log(`${err ? '✗' : '✓'} [${t.kind}] ${t.name}${err ? '\n      ' + err : ''}`);
  }
  await browser.close(); srv.close();
  const f = results.filter(r => r.kind === 'F'), b = results.filter(r => r.kind === 'B');
  console.log(`\n${TARGET}: features ${f.filter(r => r.pass).length}/${f.length} pass · bug regressions ${b.filter(r => r.pass).length}/${b.length} pass`);
  if (!ONLY) fs.writeFileSync(path.join(__dirname, `results-${TARGET}.json`), JSON.stringify({ target: TARGET, ran: new Date().toISOString(), results }, null, 1));
  const ok = f.every(r => r.pass) && b.every(r => r.pass);
  process.exit(ok ? 0 : 1);
})();
