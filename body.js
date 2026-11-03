// Neverworn body-fit module (prototype). All pose processing runs in this browser; no video or frames are uploaded.
const VARIANTS=[ // pre-rendered Halo Puffer body-type variants
 {id:'pear',shape:'Pear (triangle)',h:160,img:'assets/halo-pear.jpg'},
 {id:'hourglass',shape:'Hourglass',h:168,img:'assets/halo-hourglass.jpg'},
 {id:'rectangle',shape:'Rectangle',h:175,img:'assets/halo-rectangle.jpg'},
 {id:'oval',shape:'Oval (apple)',h:178,img:'assets/halo-oval.jpg'},
 {id:'inverted',shape:'Inverted triangle',h:190,img:'assets/halo-inverted.jpg'}];
const SIZES=[['XS',84],['S',92],['M',100],['L',108],['XL',116],['XXL',124]]; // garment body chest (cm)
const STD_ARM={XS:57,S:59,M:61,L:63,XL:64,XXL:65},STD_LEN={XS:66,S:68,M:70,L:72,XL:73,XXL:74};
const body=()=>S.get('body');
const ell=(w,d)=>{const a=w/2,b=d/2;return Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)))};
const r1=x=>Math.round(x);
function classify(m){const {chest:c,waist:w,hips:h}=m;
 if(w>=c*.96&&w>=h*.96)return'oval';
 if(Math.abs(c-h)/Math.max(c,h)<=.05&&w<=Math.min(c,h)*.78)return'hourglass';
 if(h>c*1.05)return'pear'; if(c>h*1.05)return'inverted'; return'rectangle';}
const SHAPE={pear:'Pear (triangle)',hourglass:'Hourglass',rectangle:'Rectangle',oval:'Oval (apple)',inverted:'Inverted triangle'};
function build(m){const bmiish=m.waist/m.height;return bmiish<.42?'Slim':bmiish<.5?'Average':bmiish<.58?'Solid':'Full'}
function finish(m,src,conf){m.shape=classify(m);m.build=build(m);return {...m,source:src,confidence:conf,updated:new Date().toISOString(),onDevice:true}}
// --- pose model (MoveNet via TF.js CDN), lazy loaded
let detP=null;
function loadScript(u){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=no;document.head.append(s)})}
function detector(){if(!detP)detP=(async()=>{await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.20.0/dist/tf-core.min.js');
 await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.20.0/dist/tf-converter.min.js');
 await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.20.0/dist/tf-backend-webgl.min.js');
 await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js');
 try{await tf.setBackend('webgl')}catch{} await tf.ready();
 return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,{modelType:poseDetection.movenet.modelType.SINGLEPOSE_THUNDER})})();return detP}
async function pose(src){const d=await detector();const p=await d.estimatePoses(src);if(!p[0])return null;const k={};p[0].keypoints.forEach(q=>k[q.name]=q);return k}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function fromPose(k,side,hcm){const need=['nose','left_shoulder','right_shoulder','left_hip','right_hip','left_ankle','right_ankle','left_wrist','right_wrist'];
 const score=Math.min(...need.map(n=>k[n]?.score||0));if(score<.2)return null;
 const ank=mid(k.left_ankle,k.right_ankle);const pxH=(ank.y-k.nose.y)/.89;const s=hcm/pxH; // cm per px, height as scale reference
 const sh=dist(k.left_shoulder,k.right_shoulder)*s*1.3, hipW=dist(k.left_hip,k.right_hip)*s*2.6;
 let chestD=sh*.82*.72,hipD=hipW*.78,waistD=null;
 if(side){const sh2=side.left_shoulder&&side.right_shoulder?dist(side.left_shoulder,side.right_shoulder)*s:0; // in profile, joints overlap: small residual = depth proxy
  if(sh2>4&&sh2<40){chestD=Math.max(chestD*.85,Math.min(chestD*1.25,sh2*1.6))}}
 const chestW=sh*.82,waistW=(chestW+hipW)/2*.82;waistD=(chestD+hipD)/2*.95;
 const leg=(dist(k.left_hip,k.left_ankle)+dist(k.right_hip,k.right_ankle))/2*s;
 const arm=(dist(k.left_shoulder,k.left_elbow||k.left_wrist)+dist(k.left_elbow||k.left_wrist,k.left_wrist)+dist(k.right_shoulder,k.right_elbow||k.right_wrist)+dist(k.right_elbow||k.right_wrist,k.right_wrist))/2*s*1.04;
 const torso=dist(mid(k.left_shoulder,k.right_shoulder),mid(k.left_hip,k.right_hip))*s;
 return {m:{height:hcm,shoulder:r1(sh),chest:r1(ell(chestW,chestD)),waist:r1(ell(waistW,waistD)),hips:r1(ell(hipW,hipD)),inseam:r1(leg*.93),arm:r1(arm),torso:r1(torso)},score}}
// --- size + variant matching
function recommend(m,id){const g=CAT.find(x=>x.id===id)||{};let sz=SIZES.find(([,c])=>c+2>=m.chest)||SIZES[SIZES.length-1];
 if(m.shape==='oval'&&m.waist>sz[1]-2){sz=SIZES[Math.min(SIZES.indexOf(sz)+1,SIZES.length-1)]}
 const name=sz[0],ease=sz[1]+12-m.chest,wEase=sz[1]+8-m.waist,notes=[];
 notes.push(ease>14?'relaxed through the chest':ease>8?'easy fit through the chest':'close fit through the chest');
 notes.push(wEase>18?'roomy at the waist (we can take it in ~'+r1(wEase-12)+'cm)':wEase<6?'waist let out '+r1(8-wEase)+'cm':'balanced at the waist');
 const sl=m.arm-STD_ARM[name];if(Math.abs(sl)>=1.5)notes.push('sleeves '+(sl>0?'+':'')+r1(sl)+'cm');
 const ln=r1((m.torso-50)*.6);if(Math.abs(ln)>=2)notes.push('body length '+(ln>0?'+':'')+ln+'cm');
 if(m.shape==='pear')notes.push('A-line hem eased over hips');if(m.shape==='inverted')notes.push('shoulder seam widened');
 return {size:name,notes,adj:notes.filter(n=>/cm/.test(n)).length}}
function variant(m){return VARIANTS.map(v=>({v,d:(v.id===m.shape?0:30)+Math.abs(v.h-m.height)})).sort((a,b)=>a.d-b.d)[0].v}
// --- UI
const unit=()=>S.get('unit')||'cm';
const ftin=cm=>{const i=cm/2.54;return Math.floor(i/12)+'ft '+r1(i%12)+'in'};
const FIELDS=[['height','Height'],['shoulder','Shoulder width'],['chest','Chest'],['waist','Waist'],['hips','Hips'],['inseam','Inseam / leg'],['arm','Arm length'],['torso','Torso length']];
const PRIV='<div class="ondev">🔒 Pose processing runs on this device. No video or photos leave your browser; only the measurement numbers are saved to your account.</div>';
Object.assign(R,{
height:()=>{if(!user()){location.hash='#/signup?next=height';return''}const b=body(),u=unit();return `<div class="narrow"><div class="steps"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div><span class="tag">Body fit · step 1 of 3</span>
 <h1>How tall are you?</h1><p class="mut">Your height is the ruler. We use it to turn your scan into real centimetres, so it's the one number to get right.</p>
 <div class="seg"><button class="${u==='cm'?'on':''}" onclick="S.set('unit','cm');route()">cm</button><button class="${u==='ft'?'on':''}" onclick="S.set('unit','ft');route()">ft / in</button></div>
 ${u==='cm'?`<input class="f big" id="hcm" type="number" min="120" max="220" value="${b?.height||''}" placeholder="e.g. 172">`:`<div class="row"><input class="f big" id="hft" type="number" min="4" max="7" placeholder="ft" value="${b?Math.floor(b.height/30.48):''}"><input class="f big" id="hin" type="number" min="0" max="11" placeholder="in" value="${b?r1((b.height/2.54)%12):''}"></div>`}
 <button class="btn wide" id="hgo" onclick="saveH()">Continue to body scan</button>
 <p style="text-align:center"><a href="javascript:saveH('manual')" class="mut" id="hman">No camera? Enter measurements by hand</a></p>${PRIV}</div>`},
scan:()=>{setTimeout(scanCam,50);return `<div class="narrow"><div class="steps"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></div><span class="tag">Body fit · step 2 of 3</span> <span class="demo">On-device pose model</span>
 <h1 style="font-size:32px">Full-body scan</h1><p class="mut">Stand 2–3 m back so your whole body, head to feet, is in frame. Tight-ish clothes help. We take a front view, then a side view.</p>
 <div class="cam body"><video id="bv" autoplay muted playsinline></video><canvas id="bc"></canvas><div class="sil"></div><div class="say" id="bsay">Starting camera…</div></div>
 <div class="row" style="justify-content:center"><button class="btn" id="bgo" onclick="bodyScan()" disabled>Start scan</button><a class="btn ghost" href="#/measure?manual=1">Enter by hand instead</a></div>${PRIV}</div>`},
measure:(q)=>{const t=S.get('draft')||body(),man=q.get&&q.get('manual')&&!S.get('draft');const m=t||{height:S.get('h')||170};
 const conf=m.confidence||{};const u=unit();
 return `<div class="narrow"><span class="tag">Body fit · step 3 of 3</span><h1 style="font-size:34px">${man?'Enter your measurements':'Your measurements'}</h1>
 <p class="mut">${man?'Use a soft tape measure. Chest and hips at the fullest point, waist at the narrowest.':'Check these and change anything that looks off. Your clothes are cut from these numbers.'}</p>
 ${m.source==='scan'?`<p class="note">Scanned with on-device pose model · pose confidence ${r1((m.score||0)*100)}%. Widths come from your joints; circumferences are estimated from front and side views and are the least certain.</p>`:''}
 <form id="mf" class="mgrid" onsubmit="event.preventDefault();saveM()">${FIELDS.map(([k,l])=>`<label><span>${l}</span><input class="f" name="${k}" type="number" step="0.5" value="${m[k]??''}" ${man&&k!=='height'?'placeholder="cm"':''} required><small class="c ${conf[k]||''}">${k==='height'?(u==='ft'&&m.height?ftin(m.height)+' · ':'')+'your input':{high:'±1–2 cm',med:'±2–4 cm',low:'±4–8 cm, tape-check advised'}[conf[k]]||'by hand'}</small></label>`).join('')}
 <button class="btn wide" style="grid-column:1/-1">Save to my account</button></form>
 ${m.shape?`<p class="mut" style="font-size:13px">Detected: <b>${SHAPE[m.shape]}</b> shape · ${m.build} build. Recalculated when you save.</p>`:''}${PRIV}</div>`},
});
window.saveH=mode=>{let h=unit()==='cm'?+$('#hcm').value:(+$('#hft').value*30.48+(+$('#hin').value||0)*2.54);if(!(h>=120&&h<=220))return toast('Enter a height between 120 and 220 cm (4ft–7ft2)');
 S.set('h',r1(h));S.del('draft');const b=body();if(b){b.height=r1(h);S.set('body',b)}location.hash=mode?'#/measure?manual=1':'#/scan'};
window.saveM=()=>{const f=new FormData($('#mf')),m={};FIELDS.forEach(([k])=>m[k]=+f.get(k));if(FIELDS.some(([k])=>!(m[k]>0)))return toast('Fill in every measurement');
 const d=S.get('draft')||{};const conf=d.confidence||{};let ed=0;FIELDS.forEach(([k])=>{if(d[k]!==m[k]){conf[k]='user';ed++}});
 const out=finish(m,d.source==='scan'?(ed?'scan, edited by you':'scan'):'manual',conf);if(d.score)out.score=d.score;S.set('body',out);S.del('draft');toast('Saved: '+SHAPE[out.shape]+' · '+out.build);location.hash='#/privacy'};
let bstream=null;
async function scanCam(){const tok=Symbol();scanCam.tok=tok;try{if(!bstream||!bstream.active)bstream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:960}});
 if(scanCam.tok!==tok||!$('#bv'))return;$('#bv').srcObject=bstream;$('#bsay').textContent='Loading pose model…';
 await detector();if(!$('#bv'))return;$('#bv').srcObject=bstream;$('#bsay').textContent='Step back until your whole body fits the outline';$('#bgo').disabled=false}
 catch(e){console.warn(e);if($('#bsay'))$('#bsay').textContent='No camera (or pose model unavailable). Enter measurements by hand.'}}
addEventListener('hashchange',()=>{if(!location.hash.startsWith('#/scan')&&bstream){bstream.getTracks().forEach(t=>t.stop());bstream=null}});
function drawK(k){const c=$('#bc'),v=$('#bv');if(!c||!k)return;c.width=v.videoWidth;c.height=v.videoHeight;const x=c.getContext('2d');x.fillStyle='#6b5cff';x.strokeStyle='#fff';
 Object.values(k).forEach(p=>{if(p.score>.3){x.beginPath();x.arc(p.x,p.y,7,0,7);x.fill();x.stroke()}})}
window.bodyScan=async()=>{const v=$('#bv'),say=$('#bsay'),w=ms=>new Promise(r=>setTimeout(r,ms));$('#bgo').disabled=true;const h=S.get('h')||170;
 say.textContent='Front: arms slightly away from your sides';await w(1500);let best=null;
 for(let i=0;i<5;i++){const k=await pose(v);drawK(k);if(k){const r=fromPose(k,null,h);if(r&&(!best||r.score>best.score))best={...r,k}}await w(250)}
 if(!best){say.textContent='Couldn\'t see your whole body. Step back, or enter by hand.';$('#bgo').disabled=false;return}
 say.textContent='Now turn 90° to your side';await w(2200);const side=await pose(v);drawK(side);
 const r=fromPose(best.k,side,h);const sc=r.score,hi=sc>.6?'high':sc>.4?'med':'low',lo=sc>.6?'med':'low';
 const conf={height:'user',shoulder:hi,arm:hi,inseam:hi,torso:hi,chest:lo,waist:'low',hips:lo};
 S.set('draft',{...r.m,source:'scan',score:sc,confidence:conf});say.textContent='Scan done ✓ (nothing uploaded)';bstream&&bstream.getTracks().forEach(t=>t.stop());await w(600);location.hash='#/measure'};
// --- decorate existing pages after each render
function decorate(){const h=location.hash;
 if(h.startsWith('#/p/')){const id=h.slice(4).split('?')[0],x=CAT.find(c=>c.id===id),b=body(),pp=$('.pp>div:nth-child(2)');if(!x||!pp)return;
  if(b){const rec=recommend(b,id);pp.querySelector('.price').insertAdjacentHTML('afterend',`<div class="fit"><div><span class="tag">Your size</span><b class="sz">${rec.size}</b></div><div><b>Cut to you:</b> ${rec.notes.join('; ')}.<br><small class="mut">From your ${SHAPE[b.shape].toLowerCase()} profile, ${b.height}cm · ${rec.adj?rec.adj+' made-to-order adjustment'+(rec.adj>1?'s':'')+', free':'no adjustments needed'} · <a href="#/measure"><u>edit measurements</u></a></small></div></div>`)}
  else if(user())pp.querySelector('.price').insertAdjacentHTML('afterend',`<div class="fit"><div>Add your measurements to get your size and see this on your body type. <a class="btn sm" href="#/height">Measure me</a></div></div>`);
  const hv=$('#hv');if(hv&&b){const v=variant(b);hv.querySelector('.you').replaceWith(Object.assign(document.createElement('div'),{className:'you fitv',innerHTML:`<img src="${v.img}" alt="${v.shape} variant">`}));
   hv.insertAdjacentHTML('beforeend',`<div class="match">Matched to you: <b>${v.shape}</b> · ${v.h}cm variant<br><span>Prototype: pre-rendered body-type variant. Production renders you individually.</span></div>`);
   const m=hv.querySelector('.you');m.play=()=>{};m.pause=()=>{};m.duration=1}}
 if(h.startsWith('#/privacy')&&user()){const b=body(),n=$('.narrow');if(!n||$('#bp'))return;const first=n.querySelector('h1');
  first.insertAdjacentHTML('afterend',`<div class="panel" id="bp"><b>Body profile</b> ${b?`<span class="demo">${SHAPE[b.shape]} · ${b.build}</span><div class="mgrid ro">${FIELDS.map(([k,l])=>`<div><small class="mut">${l}</small><br><b>${b[k]} cm</b>${k==='height'?` <small class="mut">${ftin(b[k])}</small>`:''}</div>`).join('')}</div>
   <small class="mut">Source: ${b.source} · updated ${new Date(b.updated).toLocaleString('en-GB')} · saved to your account on this device only (measurements only, no images). Garments are cut to these numbers.</small>
   <div class="row" style="margin-top:10px"><a class="btn ghost sm" href="#/measure" onclick="S.set('draft',body())">Edit measurements</a><a class="btn ghost sm" href="#/height">Re-scan</a><button class="btn danger sm" onclick="delBody()">Delete body data</button></div>`:`<p class="mut">No measurements yet. <a href="#/height"><b>Measure me</b></a> to get sizes and body-matched try-ons.</p>`}</div>`)}}
new MutationObserver(decorate).observe(document.getElementById('app'),{childList:true});
window.delBody=()=>{if(!confirm('Delete your body measurements? Sizes and body-matched previews will stop.'))return;S.del('body');S.del('draft');S.del('h');toast('Body data deleted');route()};
