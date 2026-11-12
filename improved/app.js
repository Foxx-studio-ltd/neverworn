// Neverworn — improved mirror of app.js. Same routes and look; see AUDIT.md for every change and why.
'use strict';
const ROOT = document.documentElement.dataset.root || ''; // lets this mirror reuse ../assets without copying 30 MB
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let CAT = [], ready = false, routeToken = 0, curRoute = '';
const alive = t => t === routeToken; // async work (camera, scans, chat) checks this before touching the page or navigating

// Storage that never throws (Safari private mode, quota, corrupt JSON).
const S = {
  get: k => { try { return JSON.parse(localStorage.getItem('nw_' + k) || 'null'); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('nw_' + k, JSON.stringify(v)); } catch { toast('Your browser storage is full or blocked'); } },
  del: k => { try { localStorage.removeItem('nw_' + k); } catch {} },
};
const user = () => S.get('user'), avatar = () => S.get('avatar');
// Cart lines are {id,size,qty}. Legacy carts (plain id strings) are upgraded; unknown ids are dropped instead of crashing.
function cart() {
  const raw = S.get('cart') || [], out = [];
  for (const it of raw) {
    const l = typeof it === 'string' ? { id: it, size: null, qty: 1 } : { id: it.id, size: it.size || null, qty: Math.max(1, it.qty | 0 || 1) };
    if (!g(l.id)) continue;
    const same = out.find(o => o.id === l.id && o.size === l.size);
    same ? same.qty += l.qty : out.push(l);
  }
  return out;
}
const cartCount = () => cart().reduce((s, l) => s + l.qty, 0);
const cartTotal = c => c.reduce((s, l) => s + g(l.id).price * l.qty, 0);
const g = id => CAT.find(x => x.id === id);
const TIERS = [['everyday', 'Everyday'], ['inbetween', 'In-between'], ['futuristic', 'Futuristic'], ['all', 'All']];
const TL = { everyday: 'Everyday', inbetween: 'In-between', futuristic: 'Futuristic' };
const SORTS = [['featured', 'Featured'], ['low', 'Price: low to high'], ['high', 'Price: high to low']];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let stream = null;

function toast(t) {
  const box = $('#toasts'); if (!box) return;
  box.replaceChildren(); // one toast at a time: newest replaces older ones instead of stacking over the page
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; box.append(d);
  setTimeout(() => d.remove(), 2600);
}
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function redirect(hash) { location.replace(location.pathname + location.search + hash); return null; } // no back-button loop

function chrome(r) {
  $$('nav a[data-r]').forEach(a => { const on = a.dataset.r === r; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  const n = cartCount(); $('#cc').textContent = n ? '· ' + n : ''; $('#bag').setAttribute('aria-label', n ? `Bag, ${n} item${n > 1 ? 's' : ''}` : 'Bag, empty');
  $('#acct').innerHTML = user()
    ? `<a href="#/privacy" class="btn ghost sm">${avatar() ? 'Your avatar' : 'Account'}</a>`
    : `<a href="#/signup" class="hide-m">Sign in</a> <a href="#/signup?next=avatar" class="btn sm"><span class="hide-xs">Create your </span>Avatar</a>`;
}
function stopCam() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
const steps = (i, label) => `<div class="steps" role="progressbar" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${i}" aria-label="Step ${i} of 5: ${label}">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</div><span class="tag">Step ${i} of 5 · ${label}</span>`;

let TITLE = '';
const R = {
'': () => { TITLE = 'The range';
  const hv = g('mercury-gown') || CAT[0];
  return `<section class="hero"><div><span class="tag">The range · November 2026</span><h1 tabindex="-1">Every garment here was designed by AI this year.</h1>
 <p class="mut">Browse and watch everything free. Create an avatar once to see yourself in any of it. Made to order in the UK.</p>
 <form class="prompt" id="heroq" role="search"><label class="sr" for="hq">Describe a garment</label><input id="hq" name="q" placeholder="Describe something that doesn't exist yet, e.g. a jacket for London rain"><button class="btn sm">Design</button></form></div>
 <a href="#/p/${esc(hv.id)}" class="vid hero-v" style="max-height:560px" aria-label="${esc(hv.name)}, £${hv.price}. Open product"><video class="model" src="${esc(hv.dir)}/show.mp4" poster="${esc(hv.dir)}/show.jpg" ${reduceMotion ? '' : 'autoplay'} muted loop playsinline preload="metadata" aria-hidden="true"></video><span class="lbl">New · showcase video</span><div class="ov"><b style="font-size:20px">${esc(hv.name)} · £${hv.price}</b><br><span style="opacity:.85">Everyday to futuristic · ${CAT.length} pieces · drag any piece in 3D</span></div></a></section>
 <h2>The range</h2><p class="mut">${CAT.length} pieces, from clothes you'd wear on Monday to full-on futures. Each is made only once you order it.</p>
 <div class="filters"><div class="seg tiers" id="tiers" role="group" aria-label="Filter by style">${TIERS.map(([k, l]) => `<button aria-pressed="${(S.get('tier') || 'all') === k}" class="${(S.get('tier') || 'all') === k ? 'on' : ''}" data-tier="${k}">${l} <small>${k === 'all' ? CAT.length : CAT.filter(x => x.tier === k).length}</small></button>`).join('')}</div>
 <label class="sortl"><span class="sr">Sort</span><select id="sort">${SORTS.map(([k, l]) => `<option value="${k}" ${(S.get('sort') || 'featured') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
 <div class="grid" id="grid" aria-live="polite">${gridHtml()}</div>`; },

p: id => { const x = g(id); if (!x) return R['404'](); TITLE = x.name; const av = avatar();
 const tryon = x.video ? `<div class="vid hold" id="hv">${x.hero === 'image' ? `<img class="model kb" src="${esc(x.img)}" alt="${esc(x.name)} on the model">` : `<video class="model" src="${ROOT}assets/hero-model-v2.mp4" poster="${ROOT}assets/hero-poster.jpg" autoplay muted loop playsinline></video>`}<video class="you" src="${ROOT}assets/you-in-it-v2.mp4" muted loop playsinline preload="none" aria-hidden="true"></video>
  <span class="lbl" id="hl">${av ? 'Press and hold to see yourself' : 'Model view'}</span><span class="ill">Illustration, real try-on in beta</span>
  <div class="ov"><button class="btn ghost wide" id="pyi" aria-describedby="hl">◉ ${av ? 'Hold to put yourself in this' : 'Put yourself in this'}</button><small style="opacity:.85;display:block;text-align:center;margin-top:6px">${av ? 'Release to see the model again · keyboard: hold Space' : 'Free account · record once, try on everything'}</small></div></div>` : '';
 const A = esc(x.dir), ang = [['front', 'Front'], ['3q', '¾'], ['side', 'Side'], ['back', 'Back'], ['detail', 'Detail']];
 const tab = (m, l, on) => `<button role="tab" id="tab-${m}" data-m="${m}" aria-selected="${!!on}" aria-controls="mp-${m}" class="${on ? 'on' : ''}" tabindex="${on ? 0 : -1}">${l}</button>`;
 const media = `<div class="mtabs seg" id="mt" role="tablist" aria-label="Product media">${tryon ? tab('try', 'Try on', 1) : ''}${tab('views', 'Views', !tryon)}${tab('3d', '3D')}${tab('video', 'Video')}</div>
 ${tryon ? `<div class="mp" role="tabpanel" id="mp-try" aria-labelledby="tab-try" data-m="try">${tryon}</div>` : ''}
 <div class="mp" role="tabpanel" id="mp-views" aria-labelledby="tab-views" data-m="views" ${tryon ? 'hidden' : ''}><div class="gal" id="gal" tabindex="0" aria-label="Photo gallery, scroll sideways">${ang.map(([k, l], i) => `<figure><img src="${A}/${k}.webp" alt="${esc(x.name)}, ${l} view" ${i ? 'loading="lazy"' : ''}><figcaption>${l}</figcaption></figure>`).join('')}</div>
  <div class="thumbs" id="th">${ang.map(([k, l], i) => `<button class="${i ? '' : 'on'}" aria-pressed="${!i}" data-i="${i}" aria-label="${l} view"><img src="${A}/${k}.webp" loading="lazy" alt=""></button>`).join('')}</div></div>
 <div class="mp" role="tabpanel" id="mp-3d" aria-labelledby="tab-3d" data-m="3d" hidden><div class="tt" id="tt" data-dir="${A}" data-n="${x.frames | 0}" tabindex="0" role="slider" aria-label="Rotate ${esc(x.name)}" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0" aria-valuetext="Front"><img id="tti" src="${A}/t01.webp" alt="${esc(x.name)} 360 view" draggable="false"><span class="lbl">3D · drag to spin</span><div class="tthint">⟲ Drag, swipe or use ← →</div></div><small class="mut">360° turntable from ${x.frames | 0} frames. Not a true 3D model yet.</small></div>
 <div class="mp" role="tabpanel" id="mp-video" aria-labelledby="tab-video" data-m="video" hidden><div class="vid sv"><video id="svv" src="${A}/show.mp4" poster="${A}/show.jpg" muted loop playsinline preload="none" controls></video><span class="lbl">Showcase · AI-generated model</span></div></div>`;
 const fit = window.fitPanel ? window.fitPanel(x) : null;
 return `<a href="#/" class="mut">← The range</a><div class="pp" style="margin-top:14px"><div>${media}</div><div><span class="tag">${TL[x.tier]} · designed by AI, edited by our studio</span><h1 tabindex="-1">${esc(x.name)}</h1><p class="price">£${x.price}</p>${fit ? fit.html : ''}<p class="mut">${esc(x.note)}. Made to your avatar's measurements, ready in about ${x.days | 0} days.</p>
 <div class="row"><button class="btn" id="addb" data-id="${esc(x.id)}" data-size="${esc(fit?.size || '')}">Make mine${fit?.size ? ' · size ' + esc(fit.size) : ''} · £${x.price}</button><a class="btn ghost" href="#/design?q=${encodeURIComponent('Like the ' + x.name + ' but')}">Remix with AI</a></div>
 <div class="panel"><b>Still try-on</b> <span class="demo">Placeholder</span><p class="mut" style="margin:4px 0 12px">Instant photo of you in it. Ready in a few seconds once live.</p>
 ${av ? `<div class="still" style="max-width:260px"><img class="g" src="${esc(x.img)}" alt="${esc(x.name)}"><img class="me" src="${esc(av.frames[0])}" alt="Your capture"></div><small class="mut">Demo: your capture shown beside the garment, not a real render.</small>` : `<a class="btn ghost sm" href="#/signup?next=avatar">Create your avatar to try it on</a>`}</div>
 <div class="panel"><b>How it's made</b><ul class="tl" style="margin-bottom:0"><li>Pattern cut to your avatar's measurements</li><li>Made in a partner workshop in the UK</li><li>One free remake if it doesn't fit</li></ul></div></div></div>`; },

signup: (q) => { TITLE = 'Sign in or create account'; const next = safeNext(q.get('next'));
 if (user()) return redirect('#/' + (next || 'privacy'));
 const why = next === 'checkout' ? 'Sign in to place your order. Your bag is kept.' : 'Browsing is free. An account lets you create your private avatar.';
 return `<div class="narrow"><span class="demo">Prototype: your account is saved on this device only (password hashed)</span><h1 tabindex="-1" style="margin-top:12px" id="sh">Create your account</h1><p class="mut">${why}</p>
 <form id="sf" data-next="${esc(next)}" data-mode="up" novalidate><div class="seg" role="group" aria-label="Account mode"><button type="button" class="on" aria-pressed="true" id="m-up">Create account</button><button type="button" aria-pressed="false" id="m-in">Sign in</button></div>
 <label class="fl" id="nl">First name<input class="f" name="n" autocomplete="given-name" required maxlength="60"></label>
 <label class="fl">Email<input class="f" name="e" type="email" autocomplete="email" required></label>
 <label class="fl">Password <small class="mut" id="pwh">8+ characters</small><span class="pw"><input class="f" name="p" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="show" id="pwt" aria-label="Show password">Show</button></span></label>
 <label class="mut" id="age" style="display:block;margin-bottom:14px"><input type="checkbox" name="a" required> I'm 18 or over</label><p class="err" id="ferr" role="alert"></p><button class="btn wide" id="sgo">Create account</button></form></div>`; },

avatar: () => { TITLE = 'Create your avatar'; if (!user()) return redirect('#/signup?next=avatar');
 return `<div class="narrow">${steps(1, 'Consent')}<h1 tabindex="-1">Create your avatar once.</h1><p class="mut">A 20-second video of you turning slowly. After that, press and hold any garment to see yourself in it.</p>
 <ul class="list"><li>Used only to show you in our clothes<span aria-hidden="true">✓</span></li><li>Kept on this device in this prototype<span aria-hidden="true">✓</span></li><li>Never used to train AI unless you opt in<span aria-hidden="true">✓</span></li><li>Delete it any time, in one tap<span aria-hidden="true">✓</span></li></ul>
 <div class="panel"><label><input type="checkbox" id="c1"> <b>I agree</b> to Neverworn processing my face and body (biometric data) to create my private avatar.</label><br><br>
 <label><input type="checkbox" id="c2"> Use my avatar to improve Neverworn's AI <span class="mut">(optional, off by default)</span></label><br><br><label><input type="checkbox" id="c3" checked> Auto-delete if unused for 12 months</label></div>
 <button class="btn wide" style="margin-top:16px" id="cgo">I agree, start recording</button>
 <p style="text-align:center"><a href="#/" class="mut">Not now, keep browsing</a></p></div>`; },

capture: () => { TITLE = 'Record your avatar'; if (!user()) return redirect('#/signup?next=avatar'); if (!S.get('consent')?.biometric) return redirect('#/avatar');
 return `<div class="narrow">${steps(2, 'Record')} <span class="demo">Demo: stays on this device</span>
 <div class="cam"><video id="cv" autoplay muted playsinline aria-label="Your camera"></video><div class="oval"></div><div class="say" id="say" role="status">Starting camera…</div></div>
 <div class="row" style="justify-content:center"><button class="btn" id="rec" disabled>Start guided recording</button>
 <label class="btn ghost" tabindex="0" id="upl">Upload a video or photo instead<input type="file" accept="image/*,video/*" hidden id="upf"></label></div>
 <p class="mut" style="text-align:center;font-size:13px">You'll be asked to look ahead, turn left, turn right, then blink twice.</p></div>`; },

design: () => { TITLE = 'Design with AI';
 return `<div class="narrow" style="max-width:760px"><span class="tag">Design with AI</span><h1 tabindex="-1">Describe it. We'll design it.</h1><p class="mut">Options appear as images you can open, try on and order. <span class="demo" id="src">Offline demo replies</span></p>
 <div class="chat" id="chat" role="log" aria-live="polite"></div><div class="chips row" style="margin:12px 0">${['A jacket for London rain', 'Something warm for winter', 'A smart work blazer, but futuristic', 'An evening dress with colour'].map(t => `<button data-say="${esc(t)}">${esc(t)}</button>`).join('')}</div>
 <form class="prompt" id="cf"><label class="sr" for="cm">Message</label><input id="cm" name="m" placeholder="e.g. a gilet that looks like cells, in sage" autocomplete="off"><button class="btn sm">Send</button></form></div>`; },

cart: () => { TITLE = 'Your bag'; const c = cart();
 return `<div class="narrow"><h1 tabindex="-1">Your bag</h1>${c.length ? `<ul class="list bag">${c.map(l => { const x = g(l.id); return `<li><a href="#/p/${esc(x.id)}" class="bi"><img src="${esc(x.img)}" alt=""><span><b>${esc(x.name)}</b><br><small class="mut">${l.size ? 'Size ' + esc(l.size) + ' · cut to you' : 'Cut to your measurements'}</small></span></a>
  <span class="qty"><button class="q" data-q="-1" data-id="${esc(l.id)}" data-size="${esc(l.size || '')}" aria-label="One fewer ${esc(x.name)}">−</button><span aria-label="Quantity">${l.qty}</span><button class="q" data-q="1" data-id="${esc(l.id)}" data-size="${esc(l.size || '')}" aria-label="One more ${esc(x.name)}">+</button></span>
  <span>£${x.price * l.qty} <button class="x" data-q="rm" data-id="${esc(l.id)}" data-size="${esc(l.size || '')}" aria-label="Remove ${esc(x.name)}">✕</button></span></li>`; }).join('')}<li><b>Total</b><b>£${cartTotal(c)}</b></li></ul>
 <a class="btn wide" href="#/checkout">Checkout · prototype, no payment taken</a>` : `<p class="mut">Nothing yet.</p><a class="btn" href="#/">Browse the range</a>`}</div>`; },

checkout: () => { TITLE = 'Checkout'; const c = cart(); if (!c.length) return redirect('#/cart');
 if (!user()) return `<div class="narrow"><h1 tabindex="-1">Almost there</h1><p class="mut">Sign in or create a free account to place your order. Your bag (${cartCount()} item${cartCount() > 1 ? 's' : ''}) is kept.</p><a class="btn wide" href="#/signup?next=checkout">Sign in to check out</a></div>`;
 const days = Math.max(...c.map(l => g(l.id).days)); const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
 const hasBody = !!S.get('body');
 return `<div class="narrow"><span class="demo">Prototype checkout: no payment taken</span><h1 tabindex="-1" style="margin-top:12px">Made to order, just for you</h1><p class="mut">Nothing is made until you order, so nothing is wasted.</p>
 ${hasBody ? '' : `<p class="note">We don't have your measurements yet, so items will be cut to standard sizes. <a href="#/height"><u>Add measurements</u></a> for a made-to-measure fit.</p>`}
 <ul class="tl"><li><b>Today</b> · Pattern cut to ${hasBody ? 'your measurements' : 'standard sizes'}</li><li><b>${d(2)}</b> · Fabric printed and cut in a UK workshop</li><li><b>${d(Math.max(3, days - 3))}</b> · Sewn, checked and photographed</li><li><b>${d(days)}</b> · Arrives at your door</li></ul>
 <form id="of" novalidate><label class="fl">Delivery address (demo)<textarea class="f" name="addr" rows="2" autocomplete="street-address" required></textarea></label><label class="fl">Card number<input class="f" placeholder="Demo: no payment taken" disabled></label>
 <p class="err" id="oerr" role="alert"></p><button class="btn wide" id="ogo">Place order · £${cartTotal(c)} · prototype, no payment taken</button></form></div>`; },

privacy: () => { TITLE = 'Your account'; const u = user(); if (!u) return redirect('#/signup'); const a = avatar(), c = S.get('consent') || {};
 return `<div class="narrow"><span class="tag">Account · ${esc(u.email)}</span><h1 tabindex="-1">Your avatar</h1>
 ${window.bodyPanel ? window.bodyPanel() : ''}
 ${a ? `<div class="row" style="margin:12px 0">${(a.frames || []).map(f => `<img src="${esc(f)}" alt="Avatar capture" style="width:72px;height:96px;object-fit:cover;border-radius:10px">`).join('')}<div><b>Active</b><br><small class="mut">Recorded ${new Date(a.created).toLocaleString('en-GB')} · stored in this browser only (demo)</small></div></div>` : `<p class="mut">No avatar yet. <a href="#/avatar"><b>Create one</b></a></p>`}
 <div class="panel" id="consent"><label class="toggle"><span>Use to improve Neverworn's AI<br><small class="mut">Off unless you opt in</small></span><input type="checkbox" data-c="training" ${c.training ? 'checked' : ''}></label>
 <label class="toggle"><span>Auto-delete if unused for 12 months</span><input type="checkbox" data-c="autodelete" ${c.autodelete !== false ? 'checked' : ''}></label>
 <label class="toggle"><span>Pre-render new drops for me</span><input type="checkbox" data-c="prerender" ${c.prerender !== false ? 'checked' : ''}></label>
 <div class="toggle" style="border:0"><span>Consent record<br><small class="mut">${c.withdrawn ? 'Biometric consent withdrawn ' + new Date(c.withdrawn).toLocaleString('en-GB') : c.biometric ? 'Biometric consent given ' + new Date(c.biometric).toLocaleString('en-GB') : 'No consent given'}</small></span></div></div>
 <div class="row" style="margin-top:16px"><a class="btn ghost" href="#/avatar">${a ? 'Re-record' : 'Record avatar'}</a><button class="btn ghost" id="dlb">Download my data</button>${a ? '<button class="btn danger" id="delav">Delete avatar and all try-ons</button>' : ''}</div>
 <h2 style="margin-top:28px;font-size:20px">Your orders</h2><div id="orders"><p class="mut">Loading…</p></div>
 <p class="mut" style="font-size:13px;margin-top:18px">Your avatar can't be shared or used on anyone else's account. Try-on videos carry an invisible watermark and Content Credentials (in the real product).</p>
 <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="signout">Sign out</button><button class="btn danger sm" id="delacct">Delete my account</button></div></div>`; },

'404': () => { TITLE = 'Not found'; return `<div class="narrow" style="text-align:center"><h1 tabindex="-1">We couldn't find that</h1><p class="mut">The page or piece may have moved.</p><a class="btn" href="#/">Back to the range</a></div>`; },
};
const NEXT_OK = /^(avatar|height|checkout|cart|privacy|design|p\/[a-z0-9-]{1,60})$/;
function safeNext(n) { n = String(n || ''); return NEXT_OK.test(n) ? n : ''; }
const AFTER = {}; // per-route hooks run after render: (arg, q, token)

function route() {
  if (!ready) return;
  const t = ++routeToken; stopCam();
  const [p, qs] = location.hash.slice(2).split('?'); const parts = (p || '').split('/'); const q = new URLSearchParams(qs || '');
  const name = parts[0] || '', fn = R[name] || R['404'];
  const arg = name === 'p' ? decodeURIComponent(parts.slice(1).join('/')) : q;
  TITLE = '';
  const html = fn(arg, q);
  if (html === null || !alive(t)) return; // redirected; the hashchange will render the target
  app.innerHTML = html; curRoute = R[name] ? name : '404'; chrome(name);
  document.title = (TITLE ? TITLE + ' · ' : '') + 'Neverworn (provisional name)';
  scrollTo(0, 0);
  (AFTER[name] || []).forEach(f => f(arg, q, t));
  // Move focus to the page heading for screen readers, but not on first load.
  if (route.n++) { const h = app.querySelector('h1'); h && h.focus({ preventScroll: true }); }
}
route.n = 0;
const after = (name, f) => (AFTER[name] = AFTER[name] || []).push(f);

function sorted(list) {
  const s = S.get('sort') || 'featured';
  return s === 'low' ? [...list].sort((a, b) => a.price - b.price) : s === 'high' ? [...list].sort((a, b) => b.price - a.price) : list;
}
function gridHtml() {
  const t = S.get('tier') || 'all';
  return sorted(CAT.filter(x => t === 'all' || x.tier === t)).map((x, i) => `<a class="card" href="#/p/${esc(x.id)}"><img src="${esc(x.dir)}/front.webp" alt="" loading="${i < 4 ? 'eager' : 'lazy'}"><div class="b"><small class="tier t-${esc(x.tier)}">${TL[x.tier]}</small><br><b>${esc(x.name)}</b> <span class="mut">£${x.price}</span><br><small class="mut">${esc(x.note.split('. ')[0])}</small><br><small>${x.video ? '◉ Try-on · ' : ''}5 views · 3D · ▶ Video</small></div></a>`).join('');
}
window.setTier = t => {
  S.set('tier', t); $('#grid').innerHTML = gridHtml();
  $$('#tiers button').forEach(b => { const on = b.dataset.tier === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
};
after('', () => {
  $('#tiers').onclick = e => { const b = e.target.closest('button'); if (b) setTier(b.dataset.tier); };
  $('#sort').onchange = e => { S.set('sort', e.target.value); $('#grid').innerHTML = gridHtml(); };
  $('#heroq').onsubmit = e => { e.preventDefault(); const v = e.target.q.value.trim(); if (!v) { toast('Describe something first, e.g. a jacket for London rain'); return e.target.q.focus(); } go('#/design?q=' + encodeURIComponent(v)); };
});

// ---------- product page ----------
after('p', (id, q, t) => {
  if (!g(id)) return;
  $('#addb').onclick = e => add(e.currentTarget.dataset.id, e.currentTarget.dataset.size || null);
  wireMedia(); wireHold();
});
function wireMedia() {
  const mt = $('#mt'); if (!mt) return;
  const select = b => {
    const m = b.dataset.m;
    mt.querySelectorAll('button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
    $$('.mp').forEach(p => p.hidden = p.dataset.m !== m);
    const v = $('#svv'); if (m === 'video') v.play().catch(() => {}); else v.pause();
    if (m === '3d') loadTT();
  };
  mt.onclick = e => { const b = e.target.closest('button'); if (b) select(b); };
  mt.onkeydown = e => { // WAI-ARIA tabs: arrow keys move between tabs
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const bs = [...mt.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length;
    e.preventDefault(); bs[n].focus(); select(bs[n]);
  };
  const gal = $('#gal'), th = $('#th');
  th.onclick = e => { const b = e.target.closest('button'); if (b) gal.scrollTo({ left: gal.clientWidth * b.dataset.i, behavior: reduceMotion ? 'auto' : 'smooth' }); };
  gal.addEventListener('scroll', () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); th.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('on', i === j); b.setAttribute('aria-pressed', i === j); }); }, { passive: true });
  const tt = $('#tt'), img = $('#tti'), n = +tt.dataset.n || 1, src = i => `${tt.dataset.dir}/t${String(i + 1).padStart(2, '0')}.webp`;
  let pos = 0, vel = 0, drag = false, lx = 0, lt = 0, raf = 0; const cache = [];
  function loadTT() { if (cache.length) return; for (let i = 0; i < n; i++) { const im = new Image(); im.src = src(i); cache.push(im); } }
  const NAMES = ['Front', 'Right side', 'Back', 'Left side'];
  const show = () => {
    const i = ((Math.round(pos) % n) + n) % n; const s = src(i); if (!img.src.endsWith(s)) img.src = s; tt.dataset.f = i;
    const deg = Math.round(i * 360 / n); tt.setAttribute('aria-valuenow', deg); tt.setAttribute('aria-valuetext', `${NAMES[Math.round(deg / 90) % 4]}, ${deg}°`);
  };
  const step = () => { if (drag || !tt.isConnected) return; vel *= .94; pos += vel; show(); if (Math.abs(vel) > .02) raf = requestAnimationFrame(step); };
  tt.addEventListener('pointerdown', e => { loadTT(); drag = true; tt.setPointerCapture(e.pointerId); lx = e.clientX; lt = performance.now(); vel = 0; cancelAnimationFrame(raf); tt.classList.add('dragging'); });
  tt.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - lx, now = performance.now(), d = -dx * n / tt.clientWidth * 1.2; pos += d; vel = d / Math.max(1, now - lt) * 16; lx = e.clientX; lt = now; show(); });
  const up = () => { if (!drag) return; drag = false; tt.classList.remove('dragging'); raf = requestAnimationFrame(step); };
  ['pointerup', 'pointercancel'].forEach(t => tt.addEventListener(t, up));
  tt.addEventListener('keydown', e => { const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!k) return; e.preventDefault(); loadTT(); cancelAnimationFrame(raf); vel = 0; pos += k; show(); });
}
function wireHold() {
  const v = $('#hv'); if (!v) return; const btn = $('#pyi');
  const live = () => v.querySelector('.you'); // re-queried: body.js may swap it for a body-matched still
  const on = e => {
    if (e) e.preventDefault();
    if (!avatar()) { go(user() ? '#/avatar' : '#/signup?next=avatar'); return; }
    if (v.classList.contains('holding')) return;
    const you = live(), m = v.querySelector('.model');
    if (you.tagName === 'VIDEO') { you.preload = 'auto'; try { you.currentTime = (m.currentTime || 0) % (you.duration || 1) || 0; } catch {} you.play().catch(() => {}); }
    v.classList.add('holding'); btn.setAttribute('aria-pressed', 'true'); $('#hl').textContent = 'Holding · release to see the model';
  };
  const off = () => {
    if (!v.classList.contains('holding')) return; v.classList.remove('holding'); btn.setAttribute('aria-pressed', 'false');
    const you = live(); if (you.tagName === 'VIDEO') you.pause(); $('#hl').textContent = 'Press and hold to see yourself';
  };
  v.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => v.addEventListener(t, off));
  v.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) on(e); });
  btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') off(); });
  btn.addEventListener('blur', off);
}

// ---------- bag ----------
window.add = (id, size = null) => {
  const x = g(id); if (!x) return;
  const c = cart(), l = c.find(o => o.id === id && o.size === size); l ? l.qty++ : c.push({ id, size, qty: 1 });
  S.set('cart', c); toast(x.name + (size ? ' (' + size + ')' : '') + ' added to your bag'); chrome(curRoute);
};
function changeQty(id, size, d) {
  const c = cart(), i = c.findIndex(o => o.id === id && (o.size || '') === (size || ''));
  if (i < 0) return;
  if (d === 'rm' || c[i].qty + d <= 0) c.splice(i, 1); else c[i].qty += d;
  S.set('cart', c); route();
}
after('cart', () => { app.querySelector('.bag')?.addEventListener('click', e => { const b = e.target.closest('button[data-q]'); if (b) changeQty(b.dataset.id, b.dataset.size, b.dataset.q === 'rm' ? 'rm' : +b.dataset.q); }); });

// ---------- account / privacy ----------
window.setC = (k, v) => { const c = S.get('consent') || {}; c[k] = v; S.set('consent', c); toast('Saved'); };
window.delAv = () => {
  if (!confirm('Delete your avatar and all try-on videos? This cannot be undone.')) return;
  S.del('avatar'); S.del('body'); S.del('draft');
  const c = S.get('consent') || {}; c.withdrawn = new Date().toISOString(); delete c.biometric; S.set('consent', c);
  toast('Avatar deleted'); route();
};
window.dl = () => {
  const b = new Blob([JSON.stringify({ exported: new Date().toISOString(), user: user(), consent: S.get('consent'), avatar: avatar(), body: S.get('body'), bag: cart() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'neverworn-my-data.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
after('privacy', async (a, q, t) => {
  $("#consent").addEventListener("change", e => { const i = e.target.closest('input[data-c]'); if (i) setC(i.dataset.c, i.checked); });
  $('#dlb').onclick = dl; $('#delav') && ($('#delav').onclick = delAv);
  $('#signout').onclick = () => window.signOut(); $('#delacct').onclick = () => window.deleteAccount();
  const r = await Backend.orders(); if (!alive(t)) return;
  $('#orders').innerHTML = r.ok && r.j.length ? `<ul class="list">${r.j.map(o => `<li><span><b>${esc(o.id)}</b><br><small class="mut">${new Date(o.at).toLocaleDateString('en-GB')} · ${o.items.map(l => { const x = g(typeof l === 'string' ? l : l.id); return esc((x ? x.name : 'Item') + (l.size ? ' (' + l.size + ')' : '') + (l.qty > 1 ? ' ×' + l.qty : '')); }).join(', ')}</small></span><span class="demo">Prototype</span></li>`).join('')}</ul>` : '<p class="mut">No orders yet.</p>';
});

// ---------- avatar capture ----------
after('avatar', () => {
  $('#cgo').onclick = () => {
    if (!$('#c1').checked) { toast('Please tick the consent box to continue'); return $('#c1').focus(); }
    S.set('consent', { ...(S.get('consent') || {}), biometric: new Date().toISOString(), withdrawn: undefined, training: $('#c2').checked, autodelete: $('#c3').checked, version: 'demo-1' });
    go('#/capture');
  };
});
after('capture', (a, q, t) => {
  startCam(t); $('#rec').onclick = () => guided(t); $('#upf').onchange = e => upload(e.target, t);
  $('#upl').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#upf').click(); } };
});
async function startCam(t) {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    if (!alive(t) || !$('#cv')) { st.getTracks().forEach(x => x.stop()); return; } // user left: never leak the camera
    stopCam(); stream = st; $('#cv').srcObject = st; $('#say').textContent = 'Fit your face in the oval'; $('#rec').disabled = false;
  } catch (e) {
    if (alive(t) && $('#say')) $('#say').textContent = e && e.name === 'NotAllowedError' ? 'Camera blocked. Allow it in your browser, or upload instead.' : 'No camera found. Upload a video or photo instead.';
  }
}
function grab(src) {
  const c = document.createElement('canvas'); const w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight;
  if (!w || !h) return null; const s = 240 / Math.max(w, h); c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .8);
}
window.guided = async (t = routeToken) => {
  const v = $('#cv'), say = $('#say'), fr = []; $('#rec').disabled = true; const w = ms => new Promise(r => setTimeout(r, ms));
  for (const [txt, ms] of [['Look straight ahead', 1800], ['Slowly turn to your left', 2200], ['Now slowly to your right', 2200], ['Blink twice', 1500]]) {
    if (!alive(t)) return; say.textContent = txt; await w(ms); if (!alive(t)) return; const f = grab(v); f && fr.push(f);
  }
  if (!fr.length) { say.textContent = 'Camera not ready. Try again or upload.'; $('#rec').disabled = false; return; }
  say.textContent = 'Got it ✓'; saveAvatar(fr, t);
};
window.upload = (inp, t = routeToken) => {
  const f = inp.files[0]; if (!f) return; const url = URL.createObjectURL(f); const done = fr => { URL.revokeObjectURL(url); fr = fr.filter(Boolean); fr.length ? saveAvatar(fr, t) : toast("Couldn't read that file. Try a photo."); };
  if (f.type.startsWith('video')) {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url; v.onerror = () => done([]);
    v.onloadeddata = async () => { const fr = [], dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 3;
      for (const k of [.1, .4, .7]) { v.currentTime = dur * k; await new Promise(r => { v.onseeked = r; setTimeout(r, 1500); }); fr.push(grab(v)); } done(fr); };
  } else if (f.type.startsWith('image')) { const i = new Image(); i.onload = () => done([grab(i)]); i.onerror = () => done([]); i.src = url; }
  else done([]);
};
function saveAvatar(frames, t) {
  if (!alive(t)) return; stopCam();
  S.set('avatar', { frames, created: new Date().toISOString(), version: (avatar()?.version || 0) + 1, note: 'Demo: frames kept on this device only' });
  toast('Avatar saved'); go('#/height');
}

// ---------- design chat ----------
after('design', (a, q, t) => {
  $('#cf').onsubmit = e => { e.preventDefault(); const v = e.target.m.value.trim(); e.target.m.value = ''; send(v, t); };
  app.querySelector('.chips').onclick = e => { const b = e.target.closest('button[data-say]'); if (b) send(b.dataset.say, t); };
  const v = q.get('q'); if (v) send(v, t);
});
window.send = async (txt, t = routeToken) => {
  txt = String(txt || '').trim(); if (!txt) return; const ch = $('#chat'); if (!ch) return;
  ch.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(txt)}</div>`);
  const r = await Backend.chat(txt, CAT); if (!alive(t)) return;
  $('#src').textContent = r.source === 'llm' ? 'Live AI replies' : 'Offline demo replies';
  ch.insertAdjacentHTML('beforeend', `<div class="msg">Here are 3 directions for “${esc(r.prompt)}”. ${esc(r.reply)}<div class="opts">${r.options.map(o => `<a href="#/p/${esc(o.id)}"><img src="${esc(o.img)}" alt=""><div><b>${esc(o.label)}. ${esc(o.name)}</b><br><span class="mut">${esc(o.note)}</span></div></a>`).join('')}</div></div>`);
  ch.lastElementChild.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
};

// ---------- boot: render only once catalogue AND session are known (fixes first-paint crash) ----------
addEventListener('storage', e => { if (/^nw_(cart|user|avatar)$/.test(e.key || '')) { if (ready) route(); } }); // keep tabs in sync
(async () => {
  try {
    const c = await (await fetch('catalog.json')).json();
    CAT = c.map(x => ({ ...x, img: ROOT + x.img, dir: ROOT + x.dir }));
  } catch { app.innerHTML = '<div class="narrow"><h1>Couldn\'t load the range</h1><p class="mut">Check your connection and refresh.</p></div>'; return; }
  if (window.beforeFirstRoute) await window.beforeFirstRoute();
  ready = true; addEventListener('hashchange', route); route();
})();
