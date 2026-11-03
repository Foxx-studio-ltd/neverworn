const $=s=>document.querySelector(s),app=$('#app');let CAT=[];
const S={get:k=>JSON.parse(localStorage.getItem('nw_'+k)||'null'),set:(k,v)=>localStorage.setItem('nw_'+k,JSON.stringify(v)),del:k=>localStorage.removeItem('nw_'+k)};
const user=()=>S.get('user'),avatar=()=>S.get('avatar'),cart=()=>S.get('cart')||[];
const g=id=>CAT.find(x=>x.id===id);const TIERS=[['everyday','Everyday'],['inbetween','In-between'],['futuristic','Futuristic'],['all','All']],TL={everyday:'Everyday',inbetween:'In-between',futuristic:'Futuristic'};let stream=null;
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),2200)}
function chrome(r){document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===r));
 $('#cc').textContent=cart().length?'· '+cart().length:'';
 $('#acct').innerHTML=user()?`<a href="#/privacy" class="btn ghost sm">${avatar()?'Your avatar':'Account'}</a>`:`<a href="#/signup" class="hide-m">Sign in</a> <a href="#/signup?next=avatar" class="btn sm">Create your avatar</a>`;}
function stopCam(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
const R={
'':()=>`<section class="hero"><div><span class="tag">The range · November 2026</span><h1>Every garment here was designed by AI this year.</h1>
 <p class="mut">Browse and watch everything free. Create an avatar once to see yourself in any of it. Made to order in the UK.</p>
 <form class="prompt" onsubmit="event.preventDefault();location.hash='#/design?q='+encodeURIComponent(this.q.value)"><input name="q" placeholder="Describe something that doesn't exist yet, e.g. a jacket for London rain"><button class="btn sm">Design</button></form></div>
 <a href="#/p/mercury-gown" class="vid" style="max-height:560px"><video class="model" src="assets/p/19/show.mp4" poster="assets/p/19/show.jpg" autoplay muted loop playsinline preload="metadata"></video><span class="lbl">New · showcase video</span><div class="ov"><b style="font-size:20px">Mercury Gown · £950</b><br><span style="opacity:.8">Everyday to futuristic · 20 pieces · drag any piece in 3D</span></div></a></section>
 <h2>The range</h2><p class="mut">${CAT.length} pieces, from clothes you'd wear on Monday to full-on futures. Each is made only once you order it.</p>
 <div class="seg tiers" id="tiers">${TIERS.map(([k,l])=>`<button class="${(S.get('tier')||'all')===k?'on':''}" onclick="setTier('${k}')">${l} <small>${k==='all'?CAT.length:CAT.filter(x=>x.tier===k).length}</small></button>`).join('')}</div>
 <div class="grid" id="grid">${gridHtml()}</div>`,
p:(id)=>{const x=g(id);if(!x)return'Not found';const av=avatar();
 const tryon=x.video?`<div class="vid" id="hv">${x.hero==='image'?`<img class="model kb" src="${x.img}" alt="${x.name}">`:`<video class="model" src="assets/hero-model-v2.mp4" poster="assets/hero-poster.jpg" autoplay muted loop playsinline></video>`}<video class="you" src="assets/you-in-it-v2.mp4" muted loop playsinline preload="auto"></video>
  <span class="lbl" id="hl">${av?'Press and hold to see yourself':'Model video'}</span><span class="ill">Illustration, real try-on in beta</span>
  <div class="ov"><button class="btn ghost wide" id="pyi">◉ ${av?'Hold to put yourself in this video':'Put yourself in this video'}</button><small style="opacity:.8;display:block;text-align:center;margin-top:6px">${av?'Release to see the model again':'Free account · record once, try on everything'}</small></div></div>`
  :'';
 const A=x.dir,ang=[['front','Front'],['3q','¾'],['side','Side'],['back','Back'],['detail','Detail']];
 const media=`<div class="mtabs seg" id="mt">${tryon?'<button data-m="try" class="on">Try on</button>':''}<button data-m="views" ${tryon?'':'class="on"'}>Views</button><button data-m="3d">3D</button><button data-m="video">Video</button></div>
 ${tryon?`<div class="mp" data-m="try">${tryon}</div>`:''}
 <div class="mp" data-m="views" ${tryon?'hidden':''}><div class="gal" id="gal">${ang.map(([k,l],i)=>`<figure><img src="${A}/${k}.webp" alt="${x.name}, ${l} view" ${i?'loading="lazy"':''}><figcaption>${l}</figcaption></figure>`).join('')}</div>
  <div class="thumbs" id="th">${ang.map(([k,l],i)=>`<button class="${i?'':'on'}" data-i="${i}" aria-label="${l} view"><img src="${A}/${k}.webp" loading="lazy" alt=""></button>`).join('')}</div></div>
 <div class="mp" data-m="3d" hidden><div class="tt" id="tt" data-dir="${A}" data-n="${x.frames}"><img id="tti" src="${A}/t01.webp" alt="${x.name} 360 view" draggable="false"><span class="lbl">3D · drag to spin</span><div class="tthint">⟲ Drag or swipe</div></div><small class="mut">360° turntable from ${x.frames} frames. Not a true 3D model yet.</small></div>
 <div class="mp" data-m="video" hidden><div class="vid sv"><video id="svv" src="${A}/show.mp4" poster="${A}/show.jpg" muted loop playsinline preload="none" controls></video><span class="lbl">Showcase · AI-generated model</span></div></div>`;
 return `<a href="#/" class="mut">← The range</a><div class="pp" style="margin-top:14px"><div>${media}</div><div><span class="tag">${TL[x.tier]} · designed by AI, edited by our studio</span><h1>${x.name}</h1><p class="price">£${x.price}</p><p class="mut">${x.note}. Made to your avatar's measurements, ready in about ${x.days} days.</p>
 <div class="row"><button class="btn" onclick="add('${x.id}')">Make mine · £${x.price}</button><a class="btn ghost" href="#/design?q=${encodeURIComponent('Like the '+x.name+' but')}">Remix with AI</a></div>
 <div class="panel"><b>Still try-on</b> <span class="demo">Placeholder</span><p class="mut" style="margin:4px 0 12px">Instant photo of you in it. Ready in a few seconds once live.</p>
 ${av?`<div class="still" style="max-width:260px"><img class="g" src="${x.img}"><img class="me" src="${av.frames[0]}"></div><small class="mut">Demo: your capture shown beside the garment, not a real render.</small>`:`<a class="btn ghost sm" href="#/signup?next=avatar">Create your avatar to try it on</a>`}</div>
 <div class="panel"><b>How it's made</b><ul class="tl" style="margin-bottom:0"><li>Pattern cut to your avatar's measurements</li><li>Made in a partner workshop in the UK</li><li>One free remake if it doesn't fit</li></ul></div></div></div>`},
signup:(q)=>user()?(location.hash='#/'+(q.get('next')||'privacy'),''):`<div class="narrow"><span class="demo">Prototype: your account is saved on this device only (password hashed)</span><h1 style="margin-top:12px">Create your account</h1><p class="mut">Browsing is free. An account lets you create your private avatar.</p>
 <form id="sf" onsubmit="event.preventDefault();auth(this,'${q.get('next')||''}')"><div class="seg"><button type="button" class="on" id="m-up" onclick="authMode('up')">Create account</button><button type="button" id="m-in" onclick="authMode('in')">Sign in</button></div>
 <input class="f" name="n" placeholder="First name" required><input class="f" name="e" type="email" placeholder="Email" required><input class="f" name="p" type="password" placeholder="Password (8+ characters)" minlength="8" required>
 <label class="mut" id="age" style="display:block;margin-bottom:14px"><input type="checkbox" name="a" required> I'm 18 or over</label><button class="btn wide" id="sgo">Create account</button></form></div>`,
avatar:()=>{if(!user()){location.hash='#/signup?next=avatar';return''}return `<div class="narrow"><div class="steps"><i class="on"></i><i></i><i></i></div><span class="tag">Step 1 of 3</span><h1>Create your avatar once.</h1><p class="mut">A 20-second video of you turning slowly. After that, press and hold any garment to see yourself in it.</p>
 <ul class="list"><li>Used only to show you in our clothes<span>✓</span></li><li>Encrypted, locked to your account<span>✓</span></li><li>Never used to train AI unless you opt in<span>✓</span></li><li>Delete it any time, in one tap<span>✓</span></li></ul>
 <div class="panel"><label><input type="checkbox" id="c1"> <b>I agree</b> to Neverworn processing my face and body (biometric data) to create my private avatar.</label><br><br>
 <label><input type="checkbox" id="c2"> Use my avatar to improve Neverworn's AI <span class="mut">(optional, off by default)</span></label><br><br><label><input type="checkbox" id="c3" checked> Auto-delete if unused for 12 months</label></div>
 <button class="btn wide" style="margin-top:16px" onclick="if(!$('#c1').checked)return toast('Please tick the consent box to continue');S.set('consent',{biometric:new Date().toISOString(),training:$('#c2').checked,autodelete:$('#c3').checked,version:'demo-1'});location.hash='#/capture'">I agree, start recording</button>
 <p style="text-align:center"><a href="#/" class="mut">Not now, keep browsing</a></p></div>`},
capture:()=>{setTimeout(startCam,50);return `<div class="narrow"><div class="steps"><i class="on"></i><i class="on"></i><i></i></div><span class="tag">Step 2 of 3 · </span><span class="demo">Demo: stays on this device</span>
 <div class="cam"><video id="cv" autoplay muted playsinline></video><div class="oval"></div><div class="say" id="say">Starting camera…</div></div>
 <div class="row" style="justify-content:center"><button class="btn" id="rec" onclick="guided()" disabled>Start guided recording</button>
 <label class="btn ghost">Upload a video or photo instead<input type="file" accept="image/*,video/*" hidden onchange="upload(this)"></label></div>
 <p class="mut" style="text-align:center;font-size:13px">Liveness check: you'll be asked to turn left, turn right, then blink twice. Real-system only: we check it's really you, live.</p></div>`},
done:()=>`<div class="narrow" style="text-align:center"><div class="steps"><i class="on"></i><i class="on"></i><i class="on"></i></div><h1>Your avatar is ready.</h1><p class="mut">Demo: in the real product a private model of you would be built in the cloud, then new drops pre-rendered for you.</p>
 <div class="row" style="justify-content:center;margin:18px 0">${(avatar()?.frames||[]).map(f=>`<img src="${f}" style="width:90px;height:120px;object-fit:cover;border-radius:12px">`).join('')}</div>
 <a class="btn" href="#/p/halo-puffer">Try it: hold the Pearl Shell video</a> <a class="btn ghost" href="#/privacy">Avatar privacy</a></div>`,
design:(q)=>{setTimeout(()=>{const v=q.get('q');if(v)send(v)},50);return `<div class="narrow" style="max-width:760px"><span class="tag">Design with AI</span><h1>Describe it. We'll design it.</h1><p class="mut">Options appear as images you can open, try on and order. <span class="demo" id="src">Offline demo replies</span></p>
 <div class="chat" id="chat"></div><div class="chips row" style="margin:12px 0"><button onclick="send('A jacket for London rain')">A jacket for London rain</button><button onclick="send('Something warm for winter')">Something warm for winter</button><button onclick="send('A smart work blazer, but futuristic')">Futuristic work blazer</button><button onclick="send('An evening dress with colour')">Evening dress</button></div>
 <form class="prompt" onsubmit="event.preventDefault();send(this.m.value);this.m.value=''"><input name="m" placeholder="e.g. a gilet that looks like cells, in sage"><button class="btn sm">Send</button></form></div>`},
cart:()=>{const c=cart();const t=c.reduce((s,id)=>s+g(id).price,0);return `<div class="narrow"><h1>Your bag</h1>${c.length?`<ul class="list">${c.map((id,i)=>`<li><span><img src="${g(id).img}" style="width:44px;height:56px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-right:10px">${g(id).name}</span><span>£${g(id).price} <a href="javascript:rm(${i})" class="mut">✕</a></span></li>`).join('')}<li><b>Total</b><b>£${t}</b></li></ul>
 <a class="btn wide" href="#/checkout">Checkout · prototype, no payment taken</a>`:`<p class="mut">Nothing yet.</p><a class="btn" href="#/">Browse drops</a>`}</div>`},
checkout:()=>{const c=cart();if(!c.length){location.hash='#/cart';return''}const days=Math.max(...c.map(id=>g(id).days));const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})};
 return `<div class="narrow"><span class="demo">Prototype checkout: no payment taken</span><h1 style="margin-top:12px">Made to order, just for you</h1><p class="mut">Nothing is made until you order, so nothing is wasted.</p>
 <ul class="tl"><li><b>Today</b> · Pattern cut to your avatar's measurements</li><li><b>${d(2)}</b> · Fabric printed and cut in a UK workshop</li><li><b>${d(days-3)}</b> · Sewn, checked and photographed</li><li><b>${d(days)}</b> · Arrives at your door</li></ul>
 <input class="f" placeholder="Delivery address (demo)"><input class="f" placeholder="Card number (demo: not processed)" disabled>
 <button class="btn wide" onclick="placeOrder()">Place order · £${c.reduce((s,id)=>s+g(id).price,0)} · prototype, no payment taken</button></div>`},
privacy:()=>{const u=user();if(!u){location.hash='#/signup';return''}const a=avatar(),c=S.get('consent')||{};return `<div class="narrow"><span class="tag">Account · ${u.email}</span><h1>Your avatar</h1>
 ${a?`<div class="row" style="margin:12px 0">${a.frames.map(f=>`<img src="${f}" style="width:72px;height:96px;object-fit:cover;border-radius:10px">`).join('')}<div><b>Active</b><br><small class="mut">Recorded ${new Date(a.created).toLocaleString('en-GB')} · stored in this browser only (demo)</small></div></div>`:`<p class="mut">No avatar yet. <a href="#/avatar"><b>Create one</b></a></p>`}
 <div class="panel"><div class="toggle"><span>Use to improve Neverworn's AI<br><small class="mut">Off unless you opt in</small></span><input type="checkbox" ${c.training?'checked':''} onchange="setC('training',this.checked)"></div>
 <div class="toggle"><span>Auto-delete if unused for 12 months</span><input type="checkbox" ${c.autodelete!==false?'checked':''} onchange="setC('autodelete',this.checked)"></div>
 <div class="toggle"><span>Pre-render new drops for me</span><input type="checkbox" ${c.prerender!==false?'checked':''} onchange="setC('prerender',this.checked)"></div>
 <div class="toggle" style="border:0"><span>Consent record<br><small class="mut">${c.biometric?'Biometric consent given '+new Date(c.biometric).toLocaleString('en-GB'):'No consent given'}</small></span></div></div>
 <div class="row" style="margin-top:16px"><a class="btn ghost" href="#/avatar">Re-record</a><button class="btn ghost" onclick="dl()">Download my data</button>${a?'<button class="btn danger" onclick="delAv()">Delete avatar and all try-ons</button>':''}</div>
 <p class="mut" style="font-size:13px;margin-top:18px">Your avatar can't be shared or used on anyone else's account. Try-on videos carry an invisible watermark and Content Credentials (in the real product).</p>
 <p><a href="javascript:logout();S.del('user');S.del('avatar');S.del('consent');S.del('body');S.del('h');S.del('draft');location.hash='#/'" class="mut">Sign out</a></p></div>`}};
function route(){stopCam();const [p,qs]=location.hash.slice(2).split('?');const parts=(p||'').split('/');const q=new URLSearchParams(qs||'');
 const fn=R[parts[0]]||R[''];app.innerHTML=fn(parts[1]||q,q);chrome(parts[0]);scrollTo(0,0);if(parts[0]==='p'){wireHold();wireMedia()}}
function gridHtml(){const t=S.get('tier')||'all';return CAT.filter(x=>t==='all'||x.tier===t).map((x,i)=>`<a class="card" href="#/p/${x.id}"><img src="${x.dir}/front.webp" alt="${x.name}" loading="${i<4?'eager':'lazy'}"><div class="b"><small class="tier t-${x.tier}">${TL[x.tier]}</small><br><b>${x.name}</b> <span class="mut">£${x.price}</span><br><small class="mut">${x.note.split('. ')[0]}</small><br><small>${x.video?'◉ Try-on · ':''}5 views · 3D · ▶ Video</small></div></a>`).join('')}
window.setTier=t=>{S.set('tier',t);$('#grid').innerHTML=gridHtml();document.querySelectorAll('#tiers button').forEach((b,i)=>b.classList.toggle('on',TIERS[i][0]===t))};
function wireMedia(){const mt=$('#mt');if(!mt)return;
 mt.onclick=e=>{const b=e.target.closest('button');if(!b)return;const m=b.dataset.m;mt.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.mp').forEach(p=>p.hidden=p.dataset.m!==m);const v=$('#svv');if(m==='video'){v.play().catch(()=>{})}else v.pause();if(m==='3d')loadTT()};
 const gal=$('#gal'),th=$('#th');th.onclick=e=>{const b=e.target.closest('button');if(b)gal.scrollTo({left:gal.clientWidth*b.dataset.i,behavior:'smooth'})};
 gal.addEventListener('scroll',()=>{const i=Math.round(gal.scrollLeft/gal.clientWidth);th.querySelectorAll('button').forEach((b,j)=>b.classList.toggle('on',i===j))},{passive:true});
 const tt=$('#tt'),img=$('#tti'),n=+tt.dataset.n,src=i=>`${tt.dataset.dir}/t${String(i+1).padStart(2,'0')}.webp`;let pos=0,vel=0,drag=false,lx=0,lt=0,raf=0,cache=[];
 function loadTT(){if(cache.length)return;for(let i=0;i<n;i++){const im=new Image();im.src=src(i);cache.push(im)}}
 const show=()=>{const i=((Math.round(pos)%n)+n)%n;const s=src(i);if(!img.src.endsWith(s))img.src=s;tt.dataset.f=i};
 const step=()=>{if(drag)return;vel*=.94;pos+=vel;show();if(Math.abs(vel)>.02)raf=requestAnimationFrame(step)};
 tt.addEventListener('pointerdown',e=>{drag=true;tt.setPointerCapture(e.pointerId);lx=e.clientX;lt=performance.now();vel=0;cancelAnimationFrame(raf);tt.classList.add('dragging')});
 tt.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-lx,now=performance.now(),d=-dx*n/tt.clientWidth*1.2;pos+=d;vel=d/Math.max(1,now-lt)*16;lx=e.clientX;lt=now;show()});
 const up=()=>{if(!drag)return;drag=false;tt.classList.remove('dragging');raf=requestAnimationFrame(step)};['pointerup','pointercancel'].forEach(t=>tt.addEventListener(t,up));
 window._tt={get pos(){return pos},get frame(){return +tt.dataset.f||0}};}
function wireHold(){const v=$('#hv');if(!v)return;const you=v.querySelector('.you'),m=v.querySelector('.model');
 const on=e=>{e.preventDefault();if(!avatar()){location.hash=user()?'#/avatar':'#/signup?next=avatar';return}you.currentTime=m.currentTime%you.duration||0;you.play();v.classList.add('holding');$('#hl').textContent='Holding · release to see the model'};
 const off=()=>{if(!v.classList.contains('holding'))return;v.classList.remove('holding');you.pause();$('#hl').textContent='Press and hold to see yourself'};
 v.addEventListener('pointerdown',on);['pointerup','pointerleave','pointercancel'].forEach(t=>v.addEventListener(t,off));v.addEventListener('contextmenu',e=>e.preventDefault());}
window.add=id=>{S.set('cart',[...cart(),id]);toast(g(id).name+' added to your bag');chrome('p')};window.rm=i=>{const c=cart();c.splice(i,1);S.set('cart',c);route()};
window.setC=(k,v)=>{const c=S.get('consent')||{};c[k]=v;S.set('consent',c);toast('Saved')};
window.delAv=()=>{if(!confirm('Delete your avatar and all try-on videos? This cannot be undone.'))return;S.del('avatar');S.del('body');S.del('draft');const c=S.get('consent')||{};c.withdrawn=new Date().toISOString();S.set('consent',c);toast('Avatar deleted');route()};
window.dl=()=>{const b=new Blob([JSON.stringify({user:user(),consent:S.get('consent'),avatar:avatar(),body:S.get('body')},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='neverworn-my-data.json';a.click()};
async function startCam(){try{const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});if(!$('#cv')){st.getTracks().forEach(t=>t.stop());return}stream=st;$('#cv').srcObject=st;$('#say').textContent='Fit your face in the oval';$('#rec').disabled=false}
 catch(e){if($('#say'))$('#say').textContent='No camera found. Upload a video or photo instead.'}}
function grab(src){const c=document.createElement('canvas');const w=src.videoWidth||src.naturalWidth,h=src.videoHeight||src.naturalHeight,s=240/Math.max(w,h);c.width=w*s;c.height=h*s;c.getContext('2d').drawImage(src,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8)}
window.guided=async()=>{const v=$('#cv'),say=$('#say'),fr=[];$('#rec').disabled=true;const w=ms=>new Promise(r=>setTimeout(r,ms));
 for(const [t,ms] of [['Look straight ahead',1800],['Slowly turn to your left',2200],['Now slowly to your right',2200],['Blink twice',1500]]){say.textContent=t;await w(ms);fr.push(grab(v))}
 say.textContent='Got it ✓';save(fr)};
window.upload=inp=>{const f=inp.files[0];if(!f)return;const url=URL.createObjectURL(f);
 if(f.type.startsWith('video')){const v=document.createElement('video');v.muted=true;v.src=url;v.onloadeddata=async()=>{const fr=[];for(const t of [.1,.4,.7]){v.currentTime=v.duration*t;await new Promise(r=>v.onseeked=r);fr.push(grab(v))}save(fr)}}
 else{const i=new Image();i.onload=()=>save([grab(i)]);i.src=url}};
function save(frames){stopCam();S.set('avatar',{frames,created:new Date().toISOString(),version:(avatar()?.version||0)+1,note:'Demo: frames kept in localStorage only'});location.hash='#/height'}
window.send=async t=>{if(!t)return;const ch=$('#chat');ch.insertAdjacentHTML('beforeend',`<div class="msg me">${t.replace(/</g,'&lt;')}</div>`);
 const r=await Backend.chat(t,CAT);
 $('#src').textContent=r.source==='llm'?'Live AI replies':'Offline demo replies';
 ch.insertAdjacentHTML('beforeend',`<div class="msg">${r.reply}<div class="opts">${r.options.map(o=>`<a href="#/p/${o.id}"><img src="${o.img}"><div><b>${o.label}. ${o.name}</b><br><span class="mut">${o.note}</span></div></a>`).join('')}</div></div>`);ch.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'})};
fetch('catalog.json').then(r=>r.json()).then(c=>{CAT=c;addEventListener('hashchange',route);route()});
