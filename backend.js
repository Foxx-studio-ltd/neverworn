// backend.js — the ONE swap point between the UI and storage.
// Static build: everything lives in this browser's localStorage. Replace each method with a fetch() to a real API;
// signatures and return shapes ({ok, j}) are unchanged from the original.
//
// Changes vs original (see AUDIT.md):
//  - PBKDF2-SHA256 (210k iterations) instead of a single SHA-256 round; legacy hashes still verify and are upgraded on login.
//  - Corrupt/blocked localStorage no longer crashes the app (safe load/save).
//  - Avatar frames are stored against the account (still on this device only), so signing out no longer destroys them.
//  - orders() lists the signed-in user's orders; order() stores sizes with each line.
//  - Email validation is stricter and HTML-unsafe characters are rejected (defence in depth; the UI also escapes).
(function () {
  'use strict';
  const DBK = 'nw_db';
  const EMPTY = () => ({ users: {}, session: null, orders: [] });
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(DBK) || 'null');
      return d && typeof d === 'object' && d.users ? { ...EMPTY(), ...d } : EMPTY();
    } catch { return EMPTY(); }
  }
  function save(d) {
    try { localStorage.setItem(DBK, JSON.stringify(d)); return true; } catch { return false; }
  }
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const ITER = 210000;
  async function pbkdf2(p, salt, iter) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: iter }, k, 256));
  }
  async function hash(p) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return `pbkdf2$${ITER}$${salt}$${await pbkdf2(p, salt, ITER)}`;
  }
  // Verifies both the new format and the original "salt:sha256(salt:pw)" format.
  async function verify(p, stored) {
    if (stored.startsWith('pbkdf2$')) {
      const [, iter, salt, h] = stored.split('$');
      return (await pbkdf2(p, salt, +iter)) === h;
    }
    const salt = stored.split(':')[0];
    return salt + ':' + hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + p))) === stored;
  }
  const pub = u => ({ user: { name: u.name, email: u.email, created: u.created }, state: u.state || {} });
  const ok = j => ({ ok: true, j }), err = e => ({ ok: false, j: { error: e } });
  const KEYS = ['body', 'consent', 'cart', 'avatar', 'avatarMeta'];
  const me = d => d.session && d.users[d.session];
  const EMAIL = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]{2,}$/;

  async function signup({ name, email, password }) {
    const d = load(), e = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(e) || String(password || '').length < 8) return err('Enter a valid email and a password of 8+ characters');
    if (d.users[e]) return err('That email already has an account on this device. Sign in instead.');
    d.users[e] = { email: e, name: String(name || '').trim().slice(0, 60), pw: await hash(password), created: new Date().toISOString(), state: {} };
    d.session = e;
    if (!save(d)) return err('Your browser blocked storage, so the account could not be saved');
    return ok(pub(d.users[e]));
  }
  async function login({ email, password }) {
    const d = load(), e = String(email || '').trim().toLowerCase(), u = d.users[e];
    if (!u || !(await verify(String(password || ''), u.pw))) return err('Email or password is wrong');
    if (!u.pw.startsWith('pbkdf2$')) u.pw = await hash(String(password)); // transparent upgrade of legacy hashes
    d.session = e; save(d); return ok(pub(u));
  }
  async function logout() { const d = load(); d.session = null; save(d); return ok({ ok: 1 }); }
  async function getMe() { const d = load(), u = me(d); return u ? ok(pub(u)) : err('Not signed in'); }
  async function setState({ key, value }) {
    const d = load(), u = me(d);
    if (!u) return err('Not signed in');
    if (!KEYS.includes(key)) return err('bad key');
    u.state = u.state || {};
    if (value == null) delete u.state[key]; else u.state[key] = value;
    return save(d) ? ok({ ok: 1 }) : err('Storage is full or blocked');
  }
  async function order({ address } = {}) {
    const d = load(), u = me(d);
    if (!u) return err('Not signed in');
    const items = (u.state && u.state.cart) || [];
    if (!items.length) return err('Bag is empty');
    const o = { id: 'NW-' + Date.now().toString(36).toUpperCase(), email: u.email, items, body: u.state.body || null,
      address: String(address || '').slice(0, 300), at: new Date().toISOString(), payment: 'none (prototype)' };
    d.orders.push(o); u.state.cart = []; save(d); return ok(o);
  }
  async function orders() { const d = load(), u = me(d); return u ? ok(d.orders.filter(o => o.email === u.email).reverse()) : err('Not signed in'); }
  async function deleteAccount() {
    const d = load(), u = me(d);
    if (u) { delete d.users[u.email]; d.orders = d.orders.filter(o => o.email !== u.email); }
    d.session = null; save(d); return ok({ ok: 1 });
  }
  // Offline "AI": keyword match on tags; returns plain data. The UI is responsible for escaping.
  async function chat(msg, CAT) {
    const m = String(msg).toLowerCase();
    let pick = CAT.filter(g => g.tags.some(t => m.includes(t)));
    pick = [...pick, ...CAT.filter(g => !pick.includes(g))].slice(0, 3);
    return { prompt: String(msg), reply: 'Tap one to refine, or ask for a change (colour, length, warmth).',
      options: pick.map((g, i) => ({ label: String.fromCharCode(65 + i), id: g.id, name: g.name, note: g.note, img: g.img })), source: 'offline' };
  }
  window.Backend = { signup, login, logout, me: getMe, setState, order, orders, deleteAccount, chat };
})();
