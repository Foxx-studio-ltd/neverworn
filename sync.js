// Account sync via Backend (backend.js) (see AUDIT.md for changes).
// FIX: avatar frames now sync to the account record (still on this device), so signing out no longer destroys them.
'use strict';
const SYNC = { body: 'body', consent: 'consent', cart: 'cart', avatar: 'avatar' };
const _set = S.set, _del = S.del;
S.set = (k, v) => { _set(k, v); if (SYNC[k] && user()) Backend.setState({ key: k, value: v }); };
S.del = k => { _del(k); if (SYNC[k] && user()) Backend.setState({ key: k, value: null }); };
const LOCAL_ACCOUNT_KEYS = ['user', 'avatar', 'consent', 'body', 'h', 'draft', 'cart'];
function clearLocal() { LOCAL_ACCOUNT_KEYS.forEach(_del); }
function hydrate(r) { _set('user', r.user); Object.keys(SYNC).forEach(k => r.state[k] != null ? _set(k, r.state[k]) : _del(k)); }
// Union of two carts (lines {id,size,qty} or legacy id strings).
function mergeCarts(a, b) {
  const out = [];
  for (const it of [...(a || []), ...(b || [])]) {
    const l = typeof it === 'string' ? { id: it, size: null, qty: 1 } : { ...it };
    const same = out.find(o => o.id === l.id && (o.size || null) === (l.size || null));
    same ? same.qty = Math.max(same.qty, l.qty || 1) : out.push(l);
  }
  return out;
}

function authMode(m) {
  const f = $('#sf'); f.dataset.mode = m;
  $('#m-up').classList.toggle('on', m === 'up'); $('#m-in').classList.toggle('on', m === 'in');
  $('#m-up').setAttribute('aria-pressed', m === 'up'); $('#m-in').setAttribute('aria-pressed', m === 'in');
  $('#nl').hidden = m === 'in'; f.n.required = m !== 'in'; $('#age').hidden = m === 'in'; f.a.required = m !== 'in';
  f.p.autocomplete = m === 'in' ? 'current-password' : 'new-password'; $('#pwh').hidden = m === 'in';
  $('#sgo').textContent = m === 'in' ? 'Sign in' : 'Create account'; $('#sh').textContent = m === 'in' ? 'Welcome back' : 'Create your account'; $('#ferr').textContent = '';
}
window.authMode = authMode;
after('signup', () => {
  const f = $('#sf');
  $('#m-up').onclick = () => authMode('up'); $('#m-in').onclick = () => authMode('in');
  $('#pwt').onclick = () => { const s = f.p.type === 'password'; f.p.type = s ? 'text' : 'password'; $('#pwt').textContent = s ? 'Hide' : 'Show'; $('#pwt').setAttribute('aria-label', s ? 'Hide password' : 'Show password'); };
  f.onsubmit = e => { e.preventDefault(); auth(f, f.dataset.next); };
});
let authBusy = false;
async function auth(f, next) {
  if (authBusy) return; const inMode = f.dataset.mode === 'in';
  // Inline validation with a visible message (the original relied on native bubbles, which skip the 18+ checkbox wording)
  const errs = [];
  if (!inMode && !f.n.value.trim()) errs.push('Enter your first name');
  if (!/^\S+@\S+\.\S{2,}$/.test(f.e.value.trim())) errs.push('Enter a valid email');
  if (f.p.value.length < 8) errs.push(inMode ? 'Enter your password' : 'Use a password of 8+ characters');
  if (!inMode && !f.a.checked) errs.push('Confirm you are 18 or over');
  if (errs.length) { $('#ferr').textContent = errs.join(' · '); return; }
  authBusy = true; $('#sgo').disabled = true;
  try {
    const d = { name: f.n.value, email: f.e.value, password: f.p.value };
    const r = await (inMode ? Backend.login(d) : Backend.signup(d));
    if (!r.ok) { $('#ferr').textContent = r.j.error || 'Something went wrong'; return; }
    const localCart = S.get('cart') || [];
    hydrate(r.j);
    // FIX: the original only kept a guest bag on sign-up; signing in to an existing account silently emptied it.
    if (localCart.length) S.set('cart', mergeCarts(r.j.state.cart, localCart));
    toast(inMode ? 'Welcome back' + (r.j.user.name ? ', ' + r.j.user.name : '') : 'Account created');
    go('#/' + (safeNext(next) || (inMode ? '' : 'privacy'))); // single navigation (original routed twice)
  } finally { authBusy = false; const b = $('#sgo'); if (b) b.disabled = false; }
}
window.auth = auth;
// FIX: was a javascript: URL whose last expression returned "#/", replacing the whole page with the text "#/".
// Also clears the bag and all account data from this browser so the next person doesn't see it.
window.signOut = async () => { await Backend.logout(); clearLocal(); toast('Signed out'); go('#/'); };
window.logout = window.signOut;
window.deleteAccount = async () => {
  if (!confirm('Delete your account, avatar, measurements and order history from this device? This cannot be undone.')) return;
  await Backend.deleteAccount(); clearLocal(); toast('Account deleted'); go('#/');
};
let ordering = false;
after('checkout', () => { const f = $('#of'); if (f) f.onsubmit = e => { e.preventDefault(); placeOrder(); }; });
window.placeOrder = async () => {
  if (ordering) return; const f = $('#of');
  const addr = f ? f.addr.value.trim() : '';
  if (f && addr.length < 8) { $('#oerr').textContent = 'Enter a delivery address'; return f.addr.focus(); }
  ordering = true; $('#ogo') && ($('#ogo').disabled = true);
  try {
    const r = await Backend.order({ address: addr });
    if (!r.ok) { toast(r.j.error); if (r.j.error === 'Not signed in') go('#/signup?next=checkout'); return; }
    _del('cart');
    app.innerHTML = `<div class="narrow" style="text-align:center"><span class="demo">Prototype, no payment taken</span><h1 tabindex="-1" style="margin-top:12px">Order ${esc(r.j.id)} received</h1><p class="mut">Saved to your account on this device${r.j.body ? ' with your measurements' : ''}. Nothing was charged and nothing will be made: this is a prototype.</p><a class="btn" href="#/">Back to the range</a> <a class="btn ghost" href="#/privacy">View orders</a></div>`;
    document.title = 'Order received · Neverworn (provisional name)'; chrome(''); app.querySelector('h1').focus();
  } finally { ordering = false; }
};
// Runs once before the first render (app.js boot), so pages never render against a half-loaded session.
window.beforeFirstRoute = async () => {
  const r = await Backend.me();
  if (r.ok) { const localCart = S.get('cart') || []; hydrate(r.j); if (localCart.length && !(r.j.state.cart || []).length) S.set('cart', localCart); }
  else if (user()) clearLocal();
};
