// Account sync via Backend (backend.js). Avatar face frames stay in this browser only.
const SYNC={body:'body',consent:'consent',cart:'cart'};const _set=S.set,_del=S.del;
S.set=(k,v)=>{_set(k,v);if(SYNC[k]&&user())Backend.setState({key:k,value:v});if(k==='avatar'&&user())Backend.setState({key:'avatarMeta',value:{created:v.created,version:v.version,frames:'kept on device'}})};
S.del=k=>{_del(k);if(SYNC[k]&&user())Backend.setState({key:k,value:null})};
function hydrate(r){localStorage.setItem('nw_user',JSON.stringify(r.user));['body','consent','cart'].forEach(k=>r.state[k]!=null?_set(k,r.state[k]):_del(k))}
window.authMode=m=>{$('#m-up').classList.toggle('on',m==='up');$('#m-in').classList.toggle('on',m==='in');const f=$('#sf');f.dataset.mode=m;f.n.style.display=m==='in'?'none':'';f.n.required=m!=='in';$('#age').style.display=m==='in'?'none':'';f.a.required=m!=='in';$('#sgo').textContent=m==='in'?'Sign in':'Create account'};
window.auth=async(f,next)=>{const inMode=f.dataset.mode==='in';const d={name:f.n.value,email:f.e.value,password:f.p.value};const r=await (inMode?Backend.login(d):Backend.signup(d));
 if(!r.ok)return toast(r.j.error||'Something went wrong');const localCart=S.get('cart')||[];hydrate(r.j);if(!inMode&&localCart.length)S.set('cart',localCart);
 toast(inMode?'Welcome back':'Account created');location.hash='#/'+(next||(inMode?'':'privacy'));route()};
window.logout=()=>Backend.logout();
window.placeOrder=async()=>{const r=await Backend.order();if(!r.ok)return toast(r.j.error);_del('cart');app.innerHTML=`<div class="narrow" style="text-align:center"><span class="demo">Prototype, no payment taken</span><h1 style="margin-top:12px">Order ${r.j.id} received</h1><p class="mut">Saved to your account on this device with your measurements. Nothing was charged and nothing will be made: this is a prototype.</p><a class="btn" href="#/">Back to Drop 01</a></div>`;chrome('')};
Backend.me().then(r=>{if(r.ok){hydrate(r.j);route()}else if(user()){_del('user');route()}});
