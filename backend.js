// backend.js — the ONE swap point between the UI and storage.
// Static/GitHub Pages build: everything lives in this browser's localStorage.
// To bring back a real server, replace each method with a fetch() to your API; signatures stay the same.
(function(){
const DBK='nw_db';const load=()=>JSON.parse(localStorage.getItem(DBK)||'{"users":{},"session":null,"orders":[]}');const save=d=>localStorage.setItem(DBK,JSON.stringify(d));
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(p,salt){salt=salt||hex(crypto.getRandomValues(new Uint8Array(16)));return salt+':'+hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+p)))}
const pub=u=>({user:{name:u.name,email:u.email,created:u.created},state:u.state||{}});
const ok=j=>({ok:true,j}),err=e=>({ok:false,j:{error:e}});const KEYS=['body','consent','cart','avatarMeta'];
const me=d=>d.session&&d.users[d.session];
async function signup({name,email,password}){const d=load(),e=String(email||'').trim().toLowerCase();
 if(!/^\S+@\S+\.\S+$/.test(e)||String(password||'').length<8)return err('Enter a valid email and a password of 8+ characters');
 if(d.users[e])return err('That email already has an account on this device. Sign in instead.');
 d.users[e]={email:e,name:String(name||'').slice(0,60),pw:await hash(password),created:new Date().toISOString(),state:{}};d.session=e;save(d);return ok(pub(d.users[e]))}
async function login({email,password}){const d=load(),e=String(email||'').trim().toLowerCase(),u=d.users[e];
 if(!u||(await hash(String(password||''),u.pw.split(':')[0]))!==u.pw)return err('Email or password is wrong');d.session=e;save(d);return ok(pub(u))}
async function logout(){const d=load();d.session=null;save(d);return ok({ok:1})}
async function getMe(){const d=load(),u=me(d);return u?ok(pub(u)):err('Not signed in')}
async function setState({key,value}){const d=load(),u=me(d);if(!u)return err('Not signed in');if(!KEYS.includes(key))return err('bad key');
 if(value==null)delete u.state[key];else u.state[key]=value;save(d);return ok({ok:1})}
async function order(){const d=load(),u=me(d);if(!u)return err('Not signed in');const items=u.state.cart||[];if(!items.length)return err('Bag is empty');
 const o={id:'NW-'+Date.now().toString(36).toUpperCase(),email:u.email,items,body:u.state.body||null,at:new Date().toISOString(),payment:'none (prototype)'};
 d.orders.push(o);u.state.cart=[];save(d);return ok(o)}
async function deleteAccount(){const d=load(),u=me(d);if(u){delete d.users[u.email];d.orders=d.orders.filter(o=>o.email!==u.email)}d.session=null;save(d);return ok({ok:1})}
async function chat(msg,CAT){const m=String(msg).toLowerCase();let pick=CAT.filter(g=>g.tags.some(t=>m.includes(t)));pick=[...pick,...CAT.filter(g=>!pick.includes(g))].slice(0,3);
 return {reply:`Here are 3 directions for "${String(msg).replace(/</g,'&lt;')}". Tap one to refine, or ask for a change (colour, length, warmth).`,options:pick.map((g,i)=>({label:String.fromCharCode(65+i),id:g.id,name:g.name,note:g.note,img:g.img})),source:'offline'}}
window.Backend={signup,login,logout,me:getMe,setState,order,deleteAccount,chat};
})();
