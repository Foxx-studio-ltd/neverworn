// Neverworn body-fit module — improved mirror. All pose processing runs in this browser; no video or frames are uploaded.
'use strict';
const VARIANTS = [ // pre-rendered Halo Puffer body-type variants
  { id: 'pear', shape: 'Pear (triangle)', h: 160, img: ROOT + 'assets/halo-pear.jpg' },
  { id: 'hourglass', shape: 'Hourglass', h: 168, img: ROOT + 'assets/halo-hourglass.jpg' },
  { id: 'rectangle', shape: 'Rectangle', h: 175, img: ROOT + 'assets/halo-rectangle.jpg' },
  { id: 'oval', shape: 'Oval (apple)', h: 178, img: ROOT + 'assets/halo-oval.jpg' },
  { id: 'inverted', shape: 'Inverted triangle', h: 190, img: ROOT + 'assets/halo-inverted.jpg' }];
const SIZES = [['XS', 84], ['S', 92], ['M', 100], ['L', 108], ['XL', 116], ['XXL', 124]]; // garment body chest (cm)
// NEW: bottoms are sized on waist + hips, not chest (garment body measurements, cm)
const BOTTOM = { XS: [66, 88], S: [72, 94], M: [78, 100], L: [86, 106], XL: [94, 112], XXL: [102, 118] };
const STD_ARM = { XS: 57, S: 59, M: 61, L: 63, XL: 64, XXL: 65 }, STD_INSEAM = { XS: 76, S: 77, M: 78, L: 79, XL: 80, XXL: 80 };
const body = () => S.get('body');
const ell = (w, d) => { const a = w / 2, b = d / 2; return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); }; // Ramanujan perimeter
const r1 = x => Math.round(x);
function classify(m) {
  const { chest: c, waist: w, hips: h } = m;
  if (w >= c * .96 && w >= h * .96) return 'oval';
  if (Math.abs(c - h) / Math.max(c, h) <= .05 && w <= Math.min(c, h) * .78) return 'hourglass';
  if (h > c * 1.05) return 'pear'; if (c > h * 1.05) return 'inverted'; return 'rectangle';
}
const SHAPE = { pear: 'Pear (triangle)', hourglass: 'Hourglass', rectangle: 'Rectangle', oval: 'Oval (apple)', inverted: 'Inverted triangle' };
function build(m) { const r = m.waist / m.height; return r < .42 ? 'Slim' : r < .5 ? 'Average' : r < .58 ? 'Solid' : 'Full'; }
function finish(m, src, conf) { m.shape = classify(m); m.build = build(m); return { ...m, source: src, confidence: conf, updated: new Date().toISOString(), onDevice: true }; }
// NEW: plausible ranges — catches typos (e.g. 5 instead of 95) before a garment is cut from them.
const RANGE = { height: [120, 220], shoulder: [28, 60], chest: [60, 170], waist: [45, 170], hips: [60, 180], inseam: [50, 105], arm: [40, 85], torso: [35, 80] };

// --- pose model (MoveNet via TF.js CDN), lazy loaded
let detP = null;
function loadScript(u) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = no; document.head.append(s); }); }
function detector() {
  if (!detP) detP = (async () => {
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.20.0/dist/tf-core.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.20.0/dist/tf-converter.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.20.0/dist/tf-backend-webgl.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js');
    try { await tf.setBackend('webgl'); } catch {} await tf.ready();
    return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER });
  })().catch(e => { detP = null; throw e; }); // NEW: a failed CDN load can be retried instead of being cached forever
  return detP;
}
async function pose(src) { const d = await detector(); const p = await d.estimatePoses(src); if (!p[0]) return null; const k = {}; p[0].keypoints.forEach(q => k[q.name] = q); return k; }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
// NOTE (AUDIT.md §Fit-accuracy): coefficients unchanged from the original. They over-estimate hips relative to chest
// for typical proportions, so most scans classify as "pear". Calibrate against tape-measured ground truth before launch.
function fromPose(k, side, hcm) {
  const need = ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle', 'left_wrist', 'right_wrist'];
  const score = Math.min(...need.map(n => k[n]?.score || 0)); if (score < .2) return null;
  const ank = mid(k.left_ankle, k.right_ankle); const pxH = (ank.y - k.nose.y) / .89; if (!(pxH > 0)) return null; const s = hcm / pxH;
  const sh = dist(k.left_shoulder, k.right_shoulder) * s * 1.3, hipW = dist(k.left_hip, k.right_hip) * s * 2.6;
  let chestD = sh * .82 * .72, hipD = hipW * .78;
  if (side) { const sh2 = side.left_shoulder && side.right_shoulder ? dist(side.left_shoulder, side.right_shoulder) * s : 0;
    if (sh2 > 4 && sh2 < 40) chestD = Math.max(chestD * .85, Math.min(chestD * 1.25, sh2 * 1.6)); }
  const chestW = sh * .82, waistW = (chestW + hipW) / 2 * .82, waistD = (chestD + hipD) / 2 * .95;
  const leg = (dist(k.left_hip, k.left_ankle) + dist(k.right_hip, k.right_ankle)) / 2 * s;
  const arm = (dist(k.left_shoulder, k.left_elbow || k.left_wrist) + dist(k.left_elbow || k.left_wrist, k.left_wrist) + dist(k.right_shoulder, k.right_elbow || k.right_wrist) + dist(k.right_elbow || k.right_wrist, k.right_wrist)) / 2 * s * 1.04;
  const torso = dist(mid(k.left_shoulder, k.right_shoulder), mid(k.left_hip, k.right_hip)) * s;
  return { m: { height: hcm, shoulder: r1(sh), chest: r1(ell(chestW, chestD)), waist: r1(ell(waistW, waistD)), hips: r1(ell(hipW, hipD)), inseam: r1(leg * .93), arm: r1(arm), torso: r1(torso) }, score };
}

// --- size + variant matching. NEW: depends on garment kind (top / bottom / dress / full).
function recommend(m, id) {
  const g = CAT.find(x => x.id === id) || {}; const kind = g.kind || 'top'; const notes = [];
  const idx = n => SIZES.findIndex(([s]) => s === n);
  let name;
  if (kind === 'bottom') {
    const wi = Object.entries(BOTTOM).findIndex(([, [w]]) => w + 2 >= m.waist), hi = Object.entries(BOTTOM).findIndex(([, [, h]]) => h + 2 >= m.hips);
    name = SIZES[Math.max(wi < 0 ? 5 : wi, hi < 0 ? 5 : hi)][0];
    const [bw, bh] = BOTTOM[name], wE = bw + 2 - m.waist, hE = bh + 4 - m.hips;
    notes.push(wE > 8 ? 'waist taken in ' + r1(wE - 2) + 'cm' : 'waist fits as cut');
    notes.push(hE > 10 ? 'relaxed through the hips' : hE < 2 ? 'close through the hips' : 'easy through the hips');
    const leg = r1(m.inseam - STD_INSEAM[name]); if (Math.abs(leg) >= 2) notes.push('leg length ' + (leg > 0 ? '+' : '') + leg + 'cm');
    if (m.shape === 'pear') notes.push('seat eased, waist kept close');
  } else {
    let sz = SIZES.find(([, c]) => c + 2 >= m.chest) || SIZES[SIZES.length - 1];
    if (m.shape === 'oval' && m.waist > sz[1] - 2) sz = SIZES[Math.min(idx(sz[0]) + 1, SIZES.length - 1)];
    if (kind === 'dress' || kind === 'full') { const hs = SIZES.findIndex(([, c]) => c + 2 >= m.hips); if (hs > idx(sz[0])) sz = SIZES[hs]; }
    name = sz[0]; const ease = sz[1] + 12 - m.chest, wEase = sz[1] + 8 - m.waist;
    notes.push(ease > 14 ? 'relaxed through the chest' : ease > 8 ? 'easy fit through the chest' : 'close fit through the chest');
    notes.push(wEase > 18 ? 'roomy at the waist (we can take it in ~' + r1(wEase - 12) + 'cm)' : wEase < 6 ? 'waist let out ' + r1(8 - wEase) + 'cm' : 'balanced at the waist');
    if (kind === 'top' || kind === 'full') { const sl = m.arm - STD_ARM[name]; if (Math.abs(sl) >= 1.5) notes.push('sleeves ' + (sl > 0 ? '+' : '') + r1(sl) + 'cm'); }
    const ln = r1((m.torso - 50) * .6); if (Math.abs(ln) >= 2) notes.push((kind === 'dress' ? 'bodice length ' : 'body length ') + (ln > 0 ? '+' : '') + ln + 'cm');
    if (kind === 'full') { const leg = r1(m.inseam - STD_INSEAM[name]); if (Math.abs(leg) >= 2) notes.push('leg length ' + (leg > 0 ? '+' : '') + leg + 'cm'); }
    if (m.shape === 'pear') notes.push(kind === 'top' ? 'A-line hem eased over hips' : 'skirt/seat eased over hips');
    if (m.shape === 'inverted') notes.push('shoulder seam widened');
  }
  return { size: name, kind, notes, adj: notes.filter(n => /cm/.test(n)).length };
}
function variant(m) { return VARIANTS.map(v => ({ v, d: (v.id === m.shape ? 0 : 30) + Math.abs(v.h - m.height) })).sort((a, b) => a.d - b.d)[0].v; }

// --- UI
const unit = () => S.get('unit') || 'cm';
// FIX: round total inches first, then split — the original could render "5ft 12in" for 182 cm.
const toFtIn = cm => { const t = Math.round(cm / 2.54); return [Math.floor(t / 12), t % 12]; };
const ftin = cm => { const [f, i] = toFtIn(cm); return f + 'ft ' + i + 'in'; };
const FIELDS = [['height', 'Height'], ['shoulder', 'Shoulder width'], ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'], ['inseam', 'Inseam / leg'], ['arm', 'Arm length'], ['torso', 'Torso length']];
const PRIV = '<div class="ondev">🔒 Pose processing runs on this device. No video or photos leave your browser; only the measurement numbers are saved to your account.</div>';
Object.assign(R, {
height: () => { TITLE = 'Your height'; if (!user()) return redirect('#/signup?next=height'); const h = S.get('h') || body()?.height, u = unit(); const [f, i] = h ? toFtIn(h) : ['', ''];
  return `<div class="narrow">${steps(3, 'Height')}
 <h1 tabindex="-1">How tall are you?</h1><p class="mut">Your height is the ruler. We use it to turn your scan into real centimetres, so it's the one number to get right.</p>
 <div class="seg" role="group" aria-label="Units"><button class="${u === 'cm' ? 'on' : ''}" aria-pressed="${u === 'cm'}" data-u="cm">cm</button><button class="${u === 'ft' ? 'on' : ''}" aria-pressed="${u === 'ft'}" data-u="ft">ft / in</button></div>
 ${u === 'cm' ? `<label class="sr" for="hcm">Height in centimetres</label><input class="f big" id="hcm" type="number" inputmode="numeric" min="120" max="220" value="${h || ''}" placeholder="e.g. 172">` : `<div class="row nowrap"><label class="sr" for="hft">Feet</label><input class="f big" id="hft" type="number" inputmode="numeric" min="4" max="7" placeholder="ft" value="${f}"><label class="sr" for="hin">Inches</label><input class="f big" id="hin" type="number" inputmode="numeric" min="0" max="11" placeholder="in" value="${i}"></div>`}
 <button class="btn wide" id="hgo">Continue to body scan</button>
 <p style="text-align:center"><button class="linkb mut" id="hman">No camera? Enter measurements by hand</button></p>${PRIV}</div>`; },
scan: () => { TITLE = 'Body scan'; if (!user()) return redirect('#/signup?next=height');
  return `<div class="narrow">${steps(4, 'Scan')} <span class="demo">On-device pose model</span>
 <h1 tabindex="-1" style="font-size:32px">Full-body scan</h1><p class="mut">Stand 2–3 m back so your whole body, head to feet, is in frame. Tight-ish clothes help. We take a front view, then a side view.</p>
 <div class="cam body"><video id="bv" autoplay muted playsinline aria-label="Your camera"></video><canvas id="bc" aria-hidden="true"></canvas><div class="sil"></div><div class="say" id="bsay" role="status">Starting camera…</div></div>
 <div class="row" style="justify-content:center"><button class="btn" id="bgo" disabled>Start scan</button><a class="btn ghost" href="#/measure?manual=1">Enter by hand instead</a></div>${PRIV}</div>`; },
measure: q => { TITLE = 'Your measurements'; if (!user()) return redirect('#/signup?next=height');
  const man = q.get('manual') === '1'; const draft = man ? null : S.get('draft');
  const m = draft || body() || { height: S.get('h') || '' }; const conf = (draft || {}).confidence || m.confidence || {}; const u = unit();
  return `<div class="narrow">${steps(5, 'Check')}<h1 tabindex="-1" style="font-size:34px">${man && !body() ? 'Enter your measurements' : 'Your measurements'}</h1>
 <p class="mut">${man ? 'Use a soft tape measure. Chest and hips at the fullest point, waist at the narrowest.' : 'Check these and change anything that looks off. Your clothes are cut from these numbers.'}</p>
 ${m.source === 'scan' && draft ? `<p class="note">Scanned with on-device pose model · pose confidence ${r1((m.score || 0) * 100)}%. Widths come from your joints; circumferences are estimated from front and side views and are the least certain.</p>` : ''}
 <form id="mf" class="mgrid" novalidate>${FIELDS.map(([k, l]) => `<label><span>${l} <small class="mut">cm</small></span><input class="f" name="${k}" type="number" inputmode="decimal" step="0.5" min="${RANGE[k][0]}" max="${RANGE[k][1]}" value="${esc(m[k] ?? '')}" placeholder="${RANGE[k][0]}–${RANGE[k][1]}" required aria-describedby="c-${k}"><small id="c-${k}" class="c ${conf[k] || ''}">${k === 'height' ? (u === 'ft' && m.height ? ftin(m.height) + ' · ' : '') + 'your input' : { high: '±1–2 cm', med: '±2–4 cm', low: '±4–8 cm, tape-check advised', user: 'by you' }[conf[k]] || 'by hand'}</small></label>`).join('')}
 <p class="err" id="merr" role="alert" style="grid-column:1/-1"></p><button class="btn wide" style="grid-column:1/-1">Save to my account</button></form>
 ${m.shape ? `<p class="mut" style="font-size:13px">Detected: <b>${SHAPE[m.shape]}</b> shape · ${esc(m.build)} build. Recalculated when you save.</p>` : ''}${PRIV}</div>`; },
});
function readHeight() {
  if (unit() === 'cm') return +$('#hcm').value;
  const f = $('#hft').value, i = $('#hin').value; if (f === '') return NaN; return +f * 30.48 + (+i || 0) * 2.54;
}
after('height', () => {
  app.querySelector('.seg').onclick = e => { const b = e.target.closest('button[data-u]'); if (!b) return; const h = readHeight(); if (h >= 120 && h <= 220) S.set('h', r1(h)); S.set('unit', b.dataset.u); route(); }; // FIX: keeps what you typed
  $('#hgo').onclick = () => saveH(); $('#hman').onclick = () => saveH('manual');
  $$('#hcm,#hft,#hin').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') saveH(); }));
});
window.saveH = mode => {
  const h = readHeight(); if (!(h >= 120 && h <= 220)) { toast('Enter a height between 120 and 220 cm (3ft 11in – 7ft 2in)'); return ($('#hcm') || $('#hft')).focus(); }
  S.set('h', r1(h)); S.del('draft'); const b = body(); if (b) { b.height = r1(h); S.set('body', b); }
  go(mode ? '#/measure?manual=1' : '#/scan');
};
after('measure', () => { $('#mf').onsubmit = e => { e.preventDefault(); saveM(); }; });
window.saveM = () => {
  const f = new FormData($('#mf')), m = {}; FIELDS.forEach(([k]) => m[k] = +f.get(k));
  const bad = FIELDS.filter(([k]) => !(m[k] >= RANGE[k][0] && m[k] <= RANGE[k][1]));
  $$('#mf input').forEach(i => i.removeAttribute('aria-invalid')); bad.forEach(([k]) => $(`#mf [name=${k}]`).setAttribute('aria-invalid', 'true'));
  if (bad.length) { const msg = bad.map(([k, l]) => `${l} should be ${RANGE[k][0]}–${RANGE[k][1]} cm`).join(' · '); $('#merr').textContent = msg; $(`#mf [name=${bad[0][0]}]`).focus(); return; }
  if (m.waist > m.chest * 1.6 || m.hips < m.waist * .6) { $('#merr').textContent = 'These numbers look unusual together. Please double-check chest, waist and hips.'; if (!$('#mf').dataset.warned) { $('#mf').dataset.warned = 1; return; } }
  const base = S.get('draft') || body() || {}; const conf = { ...(base.confidence || {}) }; let ed = 0;
  FIELDS.forEach(([k]) => { if (base[k] !== m[k]) { conf[k] = 'user'; ed++; } });
  const wasScan = /^scan/.test(base.source || '');
  const out = finish(m, wasScan ? (ed || base.source !== 'scan' ? 'scan, edited by you' : 'scan') : 'manual', conf); if (base.score) out.score = base.score;
  S.set('body', out); S.set('h', out.height); S.del('draft'); toast('Saved: ' + SHAPE[out.shape] + ' · ' + out.build); go('#/privacy');
};
let bstream = null;
const stopBody = () => { if (bstream) { bstream.getTracks().forEach(t => t.stop()); bstream = null; } };
after('scan', (a, q, t) => { scanCam(t); $('#bgo').onclick = () => bodyScan(t); });
async function scanCam(t) {
  try {
    if (!bstream || !bstream.active) bstream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 960 } });
    if (!alive(t) || !$('#bv')) return stopBody();
    $('#bv').srcObject = bstream; $('#bsay').textContent = 'Loading pose model…';
    await detector(); if (!alive(t) || !$('#bv')) return;
    $('#bsay').textContent = 'Step back until your whole body fits the outline'; $('#bgo').disabled = false;
  } catch (e) { console.warn(e); if (alive(t) && $('#bsay')) $('#bsay').textContent = 'No camera (or pose model unavailable). Enter measurements by hand.'; }
}
addEventListener('hashchange', () => { if (!location.hash.startsWith('#/scan')) stopBody(); });
function drawK(k) {
  const c = $('#bc'), v = $('#bv'); if (!c || !k) return; c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext('2d'); x.fillStyle = '#6b5cff'; x.strokeStyle = '#fff';
  Object.values(k).forEach(p => { if (p.score > .3) { x.beginPath(); x.arc(p.x, p.y, 7, 0, 7); x.fill(); x.stroke(); } });
}
window.bodyScan = async (t = routeToken) => {
  const v = $('#bv'), say = $('#bsay'), w = ms => new Promise(r => setTimeout(r, ms)); $('#bgo').disabled = true; const h = S.get('h') || 170;
  const gone = () => !alive(t); // FIX: user left the page → stop silently, never redirect them
  say.textContent = 'Front: arms slightly away from your sides'; await w(1500); if (gone()) return; let best = null;
  for (let i = 0; i < 5; i++) { const k = await pose(v); if (gone()) return; drawK(k); if (k) { const r = fromPose(k, null, h); if (r && (!best || r.score > best.score)) best = { ...r, k }; } await w(250); }
  if (gone()) return;
  if (!best) { say.textContent = 'Couldn\'t see your whole body. Step back, or enter by hand.'; $('#bgo').disabled = false; return; }
  say.textContent = 'Now turn 90° to your side'; await w(2200); if (gone()) return; const side = await pose(v); if (gone()) return; drawK(side);
  const r = fromPose(best.k, side, h); const sc = r.score, hi = sc > .6 ? 'high' : sc > .4 ? 'med' : 'low', lo = sc > .6 ? 'med' : 'low';
  const conf = { height: 'user', shoulder: hi, arm: hi, inseam: hi, torso: hi, chest: lo, waist: 'low', hips: lo };
  S.set('draft', { ...r.m, source: 'scan', score: sc, confidence: conf }); say.textContent = 'Scan done ✓ (nothing uploaded)'; stopBody(); await w(600); if (gone()) return; go('#/measure');
};
// --- render-time panels used by app.js (replaces the original MutationObserver "decorate" pass)
window.fitPanel = x => {
  const b = body();
  if (!b) return user() ? { html: `<div class="fit"><div>Add your measurements to get your size and see this on your body type. <a class="btn sm" href="#/height">Measure me</a></div></div>` } : null;
  const rec = recommend(b, x.id);
  return { size: rec.size, html: `<div class="fit"><div><span class="tag">Your size</span><b class="sz">${rec.size}</b></div><div><b>Cut to you:</b> ${esc(rec.notes.join('; '))}.<br><small class="mut">From your ${SHAPE[b.shape].toLowerCase()} profile, ${b.height}cm · ${rec.adj ? rec.adj + ' made-to-order adjustment' + (rec.adj > 1 ? 's' : '') + ', free' : 'no adjustments needed'} · <a href="#/measure"><u>edit measurements</u></a></small></div></div>` };
};
after('p', id => {
  const hv = $('#hv'), b = body(); if (!hv || !b) return; const v = variant(b);
  hv.querySelector('.you').replaceWith(Object.assign(document.createElement('div'), { className: 'you fitv', innerHTML: `<img src="${esc(v.img)}" alt="${esc(v.shape)} body-type variant">` }));
  hv.insertAdjacentHTML('beforeend', `<div class="match">Matched to you: <b>${v.shape}</b> · ${v.h}cm variant<br><span>Prototype: pre-rendered body-type variant. Production renders you individually.</span></div>`);
});
window.bodyPanel = () => {
  const b = body();
  return `<div class="panel" id="bp"><b>Body profile</b> ${b ? `<span class="demo">${SHAPE[b.shape]} · ${esc(b.build)}</span><div class="mgrid ro">${FIELDS.map(([k, l]) => `<div><small class="mut">${l}</small><br><b>${esc(b[k])} cm</b>${k === 'height' ? ` <small class="mut">${ftin(b[k])}</small>` : ''}</div>`).join('')}</div>
   <small class="mut">Source: ${esc(b.source)} · updated ${new Date(b.updated).toLocaleString('en-GB')} · saved to your account on this device only (measurements only, no images). Garments are cut to these numbers.</small>
   <div class="row" style="margin-top:10px"><a class="btn ghost sm" href="#/measure">Edit measurements</a><a class="btn ghost sm" href="#/height">Re-scan</a><button class="btn danger sm" id="delbody">Delete body data</button></div>` : `<p class="mut">No measurements yet. <a href="#/height"><b>Measure me</b></a> to get sizes and body-matched try-ons.</p>`}</div>`;
};
after('privacy', () => { $('#delbody') && ($('#delbody').onclick = delBody); });
window.delBody = () => { if (!confirm('Delete your body measurements? Sizes and body-matched previews will stop.')) return; S.del('body'); S.del('draft'); S.del('h'); toast('Body data deleted'); route(); };
