// 서울행 부스 · 이름 손글씨 칸(설계 이름손글씨.md 4-2 · 「겉 v2」). 펜 처리는 책상 「가」 칸(app.mjs traceGa, 13판)과 같고,
// 흐린 글씨 · 시범 길 · 판정은 모두 획 모형(hangul-strokes.mjs)에서 나온다 — 셋이 늘 꼭 맞게.
// 겉 v2(11-14 유호님 「AI 티」 → 시안 A 「명부 한 장」): 신입생 명부 카드 위 원고지 칸, 흐린 글씨는 넓적 촉 글씨의 겉선(쌍구),
// 잉크는 손 빠르기로 굵기가 바뀌는 넓적 촉(name-ink.mjs), 번호는 동그라미 없는 작은 숫자, 다 쓴 음절은 위 원고지 줄로 작아져 들어가고 다 쓰면 (인) 자리에 직인.
// 순서를 어겨도 막지 않는다(쓴 획은 쓴 것으로 치고 안내는 아직 안 쓴 가장 앞 획으로). 못 넘겨도 「이대로 쓸게요」로 지나간다(엄격한 관문은 스트레스).
// 펜으로 쓰는 동안(마지막 펜 닿음에서 2.5초 안)은 손바닥 · 손가락 닿음을 잉크로 치지 않는다 — 13판과 같다.
import {syllableStrokes,isSyllable} from './hangul-strokes.mjs';
import {score,which,fitsStroke,strokeStats,likeness,encodeSign,decodeSign} from './name-hand.mjs';
import {inkScale,nib,nibQuads,smooth,resample,shapeOf,drawGuide} from './name-ink.mjs';
import {createCoach,finalLine,VO,weakTag,tier} from './name-coach.mjs';

const NS='http://www.w3.org/2000/svg';
const dstr=pts=>pts.map(([a,b],i)=>(i?'L':'M')+a.toFixed(1)+' '+b.toFixed(1)).join('');
const TIP={h:'획 안내 가로',v:'획 안내 세로',hv:'획 안내 ㄱ꼴',vh:'획 안내 ㄴ꼴',dl:'획 안내 왼삐침',dr:'획 안내 오른내림',o:'획 안내 동그라미',hdl:'획 안내 ㅈ꼴',tick:'획 안내 꼭지'};
// 겉: 잉크(만년필 남흑) · 흐린 글씨(겉선 + 아주 옅은 면) · 지금 쓸 획의 붉은 엷은 면. 촉 각 · 굵기는 칸 굵기 lw에 비례
const LOOK={ink:'#141B2B',guide:{fill:'rgba(20,27,43,.09)'},cur:'rgba(194,74,55,.14)',a:.42,h:.5,gh:.56,m:.26,gm:.3};
const penK=(p,w,fin)=>inkScale(p,{thin:.22,lo:.7,hi:1,vref:.9,taperIn:w*.45,inFrom:.72,taperOut:w*1.5,outTo:.4,fin});
// 잉크 한 획을 칠한다(p: [x,y,t] px, w: 칸 굵기 lw)
function paintInk(x,p,w,fin=true){if(!p.length)return;const q=smooth(p);x.fillStyle=LOOK.ink;nib(x,q,penK(q,w,fin),{h:w*LOOK.h,a:LOOK.a,m:LOOK.m});}

// 이름 글자 → 쓸 음절과 그 앞 띄어쓰기 자리. 다섯 음절이 넘으면 부르는 이름 하나(called)만 쓴다(설계 검토 F1-5)
export function nameSyllables(word,called){
 const use=[...word].filter(isSyllable).length>5&&called?called:word;
 const out=[];let gap=false;for(const ch of use){if(ch===' '){gap=true;continue;}if(isSyllable(ch)){out.push({ch,gap:gap&&out.length>0});gap=false;}}
 return {word:use,syl:out};
}

// 학생증 · 음절 줄의 잉크 그림(서명 줄글 또는 음절별 잉크 → SVG). 칸과 같은 넓적 촉으로 그린다(시각이 없어 빠르기는 고르게 본다).
// tight면 음절마다 잉크 폭만큼만 차지하고 조금씩 띄워 이어 쓴 손글씨처럼 붙인다(학생증), 아니면 칸 하나 = 1 × 1(음절 줄). 띄어쓰기는 반 칸.
// width는 칸 굵기(lw/칸)와 같은 뜻이다
export function inkSvg(syllables,{gaps=[],stroke='#1d2333',width=.075,tight=false}={}){
 let x=0;const quads=[],lines=[];
 syllables.forEach((st,i)=>{
  if(gaps[i])x+=.4;
  let x0=0,x1=1;
  if(tight){const xs=st.flat().map(p=>p[0]);if(xs.length){x0=Math.min(...xs);x1=Math.max(...xs);}if(x1-x0<.3){const c=(x0+x1)/2;x0=c-.15;x1=c+.15;}}
  for(const pts of st){
   const q=resample(pts.map(([u,v])=>[x+u-x0,v]),.012),K=penK(q,width,true);
   for(const v of nibQuads(q,K,{h:width*LOOK.h,a:LOOK.a}))quads.push('M'+v.map(([a,b])=>`${a.toFixed(3)} ${b.toFixed(3)}`).join('L')+'Z');
   lines.push(`<polyline fill="none" points="${q.map(([a,b])=>`${a.toFixed(3)},${b.toFixed(3)}`).join(' ')}"/>`);
  }
  x+=(x1-x0)+(tight?.1:0);
 });
 if(tight)x-=.1;
 return `<svg viewBox="0 0 ${Math.max(.3,x).toFixed(2)} 1" preserveAspectRatio="xMinYMid meet" aria-hidden="true"><g fill="${stroke}" stroke="${stroke}" stroke-width="${(width*LOOK.h*LOOK.m*2).toFixed(4)}" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="${quads.join('')}"/>${lines.join('')}</g></svg>`;
}
export function signSvg(sign,opt){const syl=decodeSign(sign?.s);return syl?inkSvg(syl,{...opt,gaps:nameSyllables(sign.w).syl.map(s=>s.gap)}):'';}

export function createNameTrace({$,L,SND,reduce,sleep}){
 let active=null;
 const api={
  // word: 학생증 한글 이름 · called: 긴 이름일 때 쓸 부르는 이름 · knows: 한글을 아는 학생(흐린 글씨 · 시범 없이 빈 칸에)
  run(word,{knows=false,called=null}={}){
   if(active)active.cancel();
   return new Promise(resolve=>{const me=session(word,{knows,called},res=>{if(active===me)active=null;resolve(res);});active=me;});
  },
  cancel(){active?.cancel();},
  get open(){return !!active;},
  // 시험용: 지금 음절의 모형 획(화면 px) · 상태
  paths(){return active?.paths()||[];},
  state(){return active?.state()||null;},
 };

 function session(fullWord,{knows,called},done){
  const box=$('#nameTrace'),pad=$('#ntPad'),cv=$('#ntInk'),x=cv.getContext('2d'),dry=$('#ntDry'),xd=dry.getContext('2d'),guide=$('#ntGuide'),xg=guide.getContext('2d'),so=$('#ntOrder'),hint=$('#ntHint'),row=$('#ntRow');
  const btnOrder=$('#ntOrderBtn'),btnClear=$('#ntClear'),btnAccept=$('#ntAccept'),btnSkip=$('#ntSkip'),btnRetry=$('#ntRetry'),btnKeep=$('#ntKeep'),cmp=$('#ntCmp');
  const {word,syl}=nameSyllables(fullWord,called);
  const HINT=L(knows?'이름 쓰기 안내 아는 학생':'이름 쓰기 안내',{w:word});
  const d=devicePixelRatio||1;
  let W=0,lw=10,i=0,model=[],shapes=[],strokes=[],wet=[],last=null,pid=null,ptype='',penT=-1e9,lastT=0,timer=0,acceptT=0,finished=false,switching=false,swT=0,swT2=0;
  let soLen=[],soDone=[],soCur=0,soFoc=-1,soRaf=0,demoRun=0,demoing=false,guideOn=!knows,live=null;
  // 다 쓴 뒤 비교(11-14 유호님 「제대로 쓴 글씨 · 직접 쓴 글씨 비교 … 다시하기」): 음절마다 획 순서 · 방향을 센 값과 마지막 판정, 시도 · 점수
  let phase='write',attempt=1,best=null,lastScore=null,cmpRaf=0,idleT=0,idled=false;
  // 서하 선배 목소리(name-coach.mjs): 바로잡기 · 칭찬 · 끝 점수 줄. 소리를 끄면 글만 남는다
  const coach=createCoach({SND});coach.warm();
  const inks=[];   // 음절마다 다 쓴 잉크(칸 [0,1]²)
  const stats=[];  // 음절마다 {n 모형 획을 따라간 획 수, ord 차례대로 쓴 수, dir 바른 방향 수, r 마지막 판정}
  const showAccept=on=>{btnAccept.classList.toggle('off',!on);btnAccept.disabled=!on;};
  box.classList.remove('done','cmp');box.classList.toggle('knows',knows);cv.setAttribute('aria-label',L('이름 쓰는 칸',{w:word}));cmp.hidden=true;
  // 음절 줄(원고지 칸): 쓴 음절은 내 잉크, 지금 음절은 엷은 붉은 면
  row.innerHTML=syl.map((s,k)=>`<i class="nt-cell${s.gap?' gap':''}" data-k="${k}"></i>`).join('');
  const cell=k=>row.querySelector(`[data-k="${k}"]`);
  function paintRow(){row.querySelectorAll('.nt-cell').forEach((c,k)=>{c.classList.toggle('cur',k===i&&!finished);c.classList.toggle('done',k<i||finished);});}

  const clr=c=>{c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,W,W);};
  // 마른 잉크(다 그은 획) · 젖은 잉크(지금 긋는 획)는 다른 캔버스 — 긋는 동안 지금 획만 다시 그려 손을 바로 따라온다
  function redraw(){clr(xd);for(const p of wet)paintInk(xd,p,lw);}
  function paintLive(){clr(x);if(live)paintInk(x,live,lw,false);}
  const paintGuide=(m,only=-1)=>shapes.forEach((s,k)=>{if(only<0||k===only)nib(m,s.p,s.K,{h:lw*LOOK.gh,a:LOOK.a,m:LOOK.gm});});
  function drawGuides(){
   clr(xg);guide.classList.toggle('on',guideOn);if(!guideOn)return;
   drawGuide(xg,m=>paintGuide(m),LOOK.guide);
   if(soCur>=0&&!demoing)drawGuide(xg,m=>paintGuide(m,soCur),{fill:LOOK.cur});
  }
  // 번호: 획 시작점 둘레의 자리 가운데 다른 획 · 앞 번호에서 가장 먼 곳(획 안쪽이나 이웃 획 위에 찍히지 않게, 11-14 맹검)
  const badges=pxs=>{const all=pxs.map(p=>resample(p,3)),put=[],cl=v=>Math.min(W-9,Math.max(9,v));
   return pxs.map((pts,k)=>{const [ax,ay]=pts[0];let j=1;while(j<pts.length-1&&Math.hypot(pts[j][0]-ax,pts[j][1]-ay)<lw)j++;const [bx,by]=pts[j]||pts[0],t=Math.atan2(by-ay,bx-ax),r=lw*1.05+8;
    // 차례대로 보고(획 뒤 → 비스듬히 뒤 → 옆) 넉넉히 비어 있는 첫 자리를 쓴다. 다 막혔으면 가장 빈 자리
    const need=lw*.85+6;let best=null,bs=-1;
    for(const da of [Math.PI,Math.PI*.75,-Math.PI*.75,Math.PI/2,-Math.PI/2]){const c=[cl(ax+Math.cos(t+da)*r),cl(ay+Math.sin(t+da)*r)];
     let m=1e9;all.forEach((q,o)=>{if(o===k)return;for(const p of q){const dd=Math.hypot(p[0]-c[0],p[1]-c[1]);if(dd<m)m=dd;}});for(const p of put)m=Math.min(m,Math.hypot(p[0]-c[0],p[1]-c[1])*.8);
     if(m>=need){best=c;break;}if(m>bs){bs=m;best=c;}}
    put.push(best);return best;});};
  function arrowD(pts){const [ex,ey]=pts[pts.length-1];let j=pts.length-2;while(j>0&&Math.hypot(ex-pts[j][0],ey-pts[j][1])<8)j--;const [px,py]=pts[Math.max(0,j)],t=Math.atan2(ey-py,ex-px),a=5.5;
   const tx=ex+Math.cos(t)*2,ty=ey+Math.sin(t)*2;return `M${(tx-a*Math.cos(t-.6)).toFixed(1)} ${(ty-a*Math.sin(t-.6)).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}L${(tx-a*Math.cos(t+.6)).toFixed(1)} ${(ty-a*Math.sin(t+.6)).toFixed(1)}`;}
  function soBuild(){
   so.setAttribute('viewBox',`0 0 ${W} ${W}`);so.innerHTML='';
   const pxs=model.map(s=>s.p.map(([u,v])=>[u*W,v*W])),at=badges(pxs);
   pxs.forEach((pts,k)=>{const g=document.createElementNS(NS,'g');g.setAttribute('class','nto-s');const [bx,by]=at[k];
    g.innerHTML=`<path class="nto-route" d="${dstr(pts)}"/><path class="nto-arrow" d="${arrowD(pts)}"/><path class="nto-run" d="${dstr(pts)}"/><text class="nto-n" x="${bx.toFixed(1)}" y="${by.toFixed(1)}">${k+1}</text><path class="nto-ok" d="M${(bx-4.5).toFixed(1)} ${(by+.5).toFixed(1)}l3 3 6-7"/>`;so.appendChild(g);});
   const n=document.createElementNS(NS,'circle');n.setAttribute('class','nto-nib');n.setAttribute('r','3.6');so.appendChild(n);
   soLen=[...so.querySelectorAll('.nto-run')].map(p=>p.getTotalLength());
  }
  // 지금 쓸 획: 점선 길 + 끝 화살 + 처음부터 끝까지 가는 펜촉(13판과 같은 1.1초 쓰고 0.65초 쉼). 아는 학생 칸은 「획순 보기」 전에는 길을 보이지 않는다
  function soLoop(k){
   cancelAnimationFrame(soRaf);soFoc=k;const nibEl=so.querySelector('.nto-nib');if(!nibEl)return;
   so.querySelectorAll('.nto-run').forEach(p=>{p.style.opacity=0;});nibEl.style.opacity=0;
   if(reduce||finished||demoing||k<0||!guideOn)return;
   const run=so.querySelectorAll('.nto-run')[k],Lk=soLen[k],T=1100,P=650,t0=performance.now();run.style.strokeDasharray=`${Lk} ${Lk}`;
   (function f(t){if(finished||demoing||soFoc!==k||live)return;const q=(t-t0)%(T+P),u=Math.min(1,q/T),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2,pt=run.getPointAtLength(e*Lk),fade=q>T?1-(q-T)/P:1;
    nibEl.setAttribute('cx',pt.x.toFixed(1));nibEl.setAttribute('cy',pt.y.toFixed(1));nibEl.style.opacity=fade;run.style.strokeDashoffset=(Lk*(1-e)).toFixed(1);run.style.opacity=(.85*fade).toFixed(3);
    soRaf=requestAnimationFrame(f);})(t0);
  }
  function soShow(quiet){
   soCur=soDone.indexOf(false);
   so.classList.toggle('on',guideOn);
   so.querySelectorAll('.nto-s').forEach((g,k)=>{g.classList.add('shown');g.classList.toggle('cur',k===soCur);g.classList.toggle('done',!!soDone[k]);});
   drawGuides();
   if(!quiet)tip();
   soLoop(soCur);
  }
  const tip=()=>{if(soCur<0||!guideOn){hint.textContent=HINT;return;}const s=model[soCur];hint.innerHTML=`<span class="nt-cnt"><b>${soCur+1}</b>/${model.length}</span><span>${L(TIP[s.k],{j:s.j})}</span>`;};
  // 붉은 펜 시범: 지금 음절을 획마다 0.38초로 써 보인다(첫 음절은 저절로, 그다음은 「획순 보기」로). 번호가 하나씩 켜진다
  async function demo(){
   const my=++demoRun;demoing=true;cancelAnimationFrame(soRaf);guideOn=true;so.classList.add('on','demo');drawGuides();
   const runs=[...so.querySelectorAll('.nto-run')],gs=[...so.querySelectorAll('.nto-s')],nibEl=so.querySelector('.nto-nib');nibEl.style.opacity=0;
   gs.forEach(g=>g.classList.remove('cur','done','shown'));
   runs.forEach((p,k)=>{p.getAnimations().forEach(a=>a.cancel());p.style.strokeDasharray=`${soLen[k]} ${soLen[k]}`;p.style.strokeDashoffset=soLen[k];p.style.opacity=.95;});
   hint.textContent=L('이 순서로 써요');
   await sleep(reduce?0:240);
   for(let k=0;k<runs.length;k++){
    if(my!==demoRun)return;
    gs[k].classList.add('shown','cur');
    if(reduce){runs[k].style.strokeDashoffset=0;continue;}
    const an=runs[k].animate([{strokeDashoffset:soLen[k]},{strokeDashoffset:0}],{duration:380,easing:'cubic-bezier(.45,0,.25,1)',fill:'forwards'});
    for(let q=0;q<4;q++)setTimeout(()=>{if(my===demoRun)SND.felt('pencil');},q*90);
    try{await an.finished;}catch{return;}
    if(my!==demoRun)return;gs[k].classList.remove('cur');await sleep(100);
   }
   await sleep(reduce?700:380);if(my!==demoRun)return;
   if(!reduce){const fades=runs.map(p=>p.animate([{opacity:.95},{opacity:0}],{duration:300,fill:'forwards'}));try{await Promise.all(fades.map(a=>a.finished));}catch{return;}}
   if(my!==demoRun)return;demoStop();
  }
  function demoStop(){if(!demoing)return;demoRun++;demoing=false;so.classList.remove('demo');so.querySelectorAll('.nto-run').forEach(p=>{p.getAnimations().forEach(a=>a.cancel());p.style.opacity=0;});soShow(false);}

  function openSyllable(auto){
   switching=false;last=null;pid=null;live=null;
   model=syllableStrokes(syl[i].ch);strokes=[];wet=[];soDone=model.map(()=>false);clearTimeout(timer);clearTimeout(acceptT);showAccept(false);
   guideOn=!knows;pad.getAnimations().forEach(a=>a.cancel());fit();paintRow();coach.syllable();armIdle(auto&&!knows?13000:9000);
   if(i&&!reduce)pad.animate([{opacity:0},{opacity:1}],{duration:320,easing:'ease-out'});
   if(auto&&!knows)setTimeout(()=>{if(!finished&&!strokes.length&&active===self)demo();},420);
   else soShow(false);
  }
  // 한 번도 안 쓰고 오래 머물면 한 번만 「괜찮아요. 천천히 해도 돼요.」(시범 중이면 조금 더 기다린다)
  function armIdle(ms){clearTimeout(idleT);if(idled)return;idleT=setTimeout(()=>{if(finished||phase!=='write'||strokes.length)return;if(demoing||switching){armIdle(4000);return;}if(coach.idle())idled=true;},ms);}
  function fit(){
   W=pad.offsetWidth;lw=Math.max(9,W*.05);   // 배치 크기로 잰다(13판과 같다)
   for(const c of [cv,dry,guide]){c.width=Math.round(W*d);c.height=Math.round(W*d);}
   shapes=model.map(s=>shapeOf(s.k,s.p.map(([u,v])=>[u*W,v*W])));
   soBuild();redraw();paintLive();if(!demoing)soShow(true);else drawGuides();
  }
  // 음절 끝: 잉크가 위 원고지 칸으로 작아져 들어가고 다음 음절로(움직임 줄이기는 바로 바꿈)
  function nextSyllable(clean=false){
   if(switching||finished)return;clearTimeout(idleT);
   switching=true;clearTimeout(timer);clearTimeout(acceptT);showAccept(false);last=null;pid=null;live=null;paintLive();
   cancelAnimationFrame(soRaf);so.querySelectorAll('.nto-s').forEach(g=>g.classList.remove('cur','shown'));
   inks[i]=strokes.map(s=>s.slice());
   const k=i,c=cell(k),st=stats[k];
   SND.sfx('pix_whoosh_short',.22);
   if(clean&&k<syl.length-1&&(!st||(st.ord===st.n&&st.dir===st.n)))setTimeout(()=>{if(!finished)coach.praise();},reduce?0:260);
   const land=()=>{SND.felt('ok');if(c)c.innerHTML=inkSvg([inks[k]],{width:lw/W*1.2});c?.animate?.([{transform:'scale(1.12)'},{transform:'none'}],{duration:reduce?0:320,easing:'cubic-bezier(.2,1.4,.4,1)'});};
   if(reduce||!c){land();clr(xd);clr(xg);}
   else{
    const a=pad.getBoundingClientRect(),b=c.getBoundingClientRect(),base=box.getBoundingClientRect(),z=a.width/(pad.offsetWidth||1);
    const g=document.createElement('canvas');g.className='nt-fly';g.width=dry.width;g.height=dry.height;g.getContext('2d').drawImage(dry,0,0);
    Object.assign(g.style,{left:((a.left-base.left)/z)+'px',top:((a.top-base.top)/z)+'px',width:pad.offsetWidth+'px',height:pad.offsetWidth+'px'});box.appendChild(g);
    clr(xd);pad.animate([{opacity:1},{opacity:0}],{duration:240,fill:'forwards'});
    g.animate([{transform:'none'},{transform:`translate(${(b.left-a.left)/z}px,${(b.top-a.top)/z}px) scale(${b.width/a.width})`}],{duration:520,easing:'cubic-bezier(.3,.7,.1,1)',fill:'forwards'}).finished.then(()=>{land();g.remove();},()=>g.remove());
   }
   i++;
   if(i>=syl.length){swT=setTimeout(compare,reduce?0:560);return;}
   swT=setTimeout(()=>{if(finished)return;openSyllable(false);hint.textContent=L('좋아요! 다음 글자');swT2=setTimeout(()=>{if(!finished&&!strokes.length&&!demoing)soShow(false);},900);},reduce?0:560);
  }
  const pos=e=>{const b=cv.getBoundingClientRect(),k=W/(b.width||W);return {x:(e.clientX-b.left)*k,y:(e.clientY-b.top)*k};};
  const down=e=>{
   if(switching||finished||phase!=='write')return;
   if(e.pointerType==='pen')penT=performance.now();else if(e.pointerType==='touch'&&performance.now()-penT<2500)return;
   if(last){if(e.pointerType==='pen'&&ptype!=='pen'){strokes.pop();live=null;paintLive();last=null;pid=null;}else return;}
   e.preventDefault();clearTimeout(timer);clearTimeout(idleT);if(demoing)demoStop();
   pid=e.pointerId;ptype=e.pointerType;last=pos(e);const cur=[[last.x/W,last.y/W]];strokes.push(cur);try{cv.setPointerCapture(e.pointerId);}catch{}
   cancelAnimationFrame(soRaf);so.querySelector('.nto-nib')?.style.setProperty('opacity',0);so.querySelectorAll('.nto-run').forEach(p=>{p.style.opacity=0;});
   live=[[last.x,last.y,performance.now()]];paintLive();};
  const move=e=>{if(!last||e.pointerId!==pid||!strokes.length)return;if(ptype==='pen')penT=performance.now();if(e.pointerType==='mouse'&&!e.buttons){up();return;}const p=pos(e),dist=Math.hypot(p.x-last.x,p.y-last.y);if(dist<1.5)return;
   const cur=strokes[strokes.length-1];for(let k=1,n=Math.ceil(dist/3);k<=n;k++)cur.push([(last.x+(p.x-last.x)*k/n)/W,(last.y+(p.y-last.y)*k/n)/W]);
   live?.push([p.x,p.y,performance.now()]);paintLive();
   last=p;const now=performance.now();if(now-lastT>45){SND.felt('pencil');lastT=now;}};
  // 펜을 떼면 판정: 다 쓰면 0.7초 뒤 다음 음절, 못 넘기면 안내 + 잠시 뒤 「이대로 쓸게요」
  const up=e=>{if(!last||(e&&e.pointerId!=null&&e.pointerId!==pid))return;if(ptype==='pen')penT=performance.now();last=null;pid=null;
   if(live){wet.push(live);live=null;paintLive();redraw();}
   // 순서 · 방향 확인: 방금 획이 어느 모형 획을 따라갔나(which) — 막지 않고 셈하고 알려 주기만 한다
   // 기대한 획 = 아직 긋지도 · 덮지도 않은 가장 앞 획(덜 덮인 획 하나 때문에 뒤 획이 모두 「순서 틀림」이 되지 않게). 조금 비켜 써도 기대한 획과 꼴 · 방향이 같으면 그 획으로 본다(fitsStroke)
   const st=stats[i]||(stats[i]={n:0,ord:0,dir:0,r:null,tried:new Set()}),stk=strokes[strokes.length-1],expect=model.findIndex((_,k)=>!soDone[k]&&!st.tried.has(k));
   let w=which(model,stk,lw/W);if(expect>=0&&w.k!==expect){const m=fitsStroke(model[expect],stk,lw/W);if(m)w={k:expect,rev:m.rev};}
   const fresh=w.k>=0&&!soDone[w.k]&&!st.tried.has(w.k);if(fresh){st.tried.add(w.k);st.n++;if(w.k===expect)st.ord++;if(!w.rev)st.dir++;}
   const r=score(model,strokes,lw/W);api.last=r;st.r=r;
   const before=soDone.filter(Boolean).length;soDone=model.map((_,k)=>soDone[k]||r.done[k]);soShow(true);
   const got=soDone.filter(Boolean).length;if(got>before)SND.felt('step',got-1);
   clearTimeout(acceptT);
   if(r.ok){hint.textContent=L('좋아요, 다 썼어요!');showAccept(false);timer=setTimeout(()=>nextSyllable(true),700);return;}
   if(fresh&&w.rev&&guideOn){hint.textContent=L('획 방향 안내');SND.felt('nudge');coach.fix('dir');}
   else if(fresh&&w.k!==expect&&expect>=0&&guideOn){hint.textContent=L('획 순서 안내',{n:expect+1});SND.felt('nudge');coach.fix('order');}
   else if(r.inside<.75||r.stray){hint.textContent=L(knows&&!guideOn?'칸 안에 또박또박 써 보세요':'흐린 글자 위를 따라 써 보세요');if(guideOn)coach.fix('stray');}
   else if(soCur>=0&&guideOn)tip();
   else hint.textContent=L('조금만 더 써 보세요');
   acceptT=setTimeout(()=>{if(!finished&&strokes.length)showAccept(true);},2500);};
  const cancelPt=e=>{if(e.pointerId===pid){last=null;pid=null;if(live){wet.push(live);live=null;paintLive();redraw();}}};
  const clear=e=>{e?.stopPropagation();if(switching||phase!=='write')return;clearTimeout(timer);clearTimeout(acceptT);if(demoing)demoStop();strokes=[];wet=[];live=null;last=null;pid=null;stats[i]=null;redraw();paintLive();soDone=model.map(()=>false);showAccept(false);soShow(false);SND.felt('page');};
  const order=e=>{e.stopPropagation();if(switching||phase!=='write')return;clearTimeout(timer);clearTimeout(swT2);demo();};
  const accept=e=>{e.stopPropagation();if(!strokes.length||switching||btnAccept.disabled)return;nextSyllable();};
  const skip=e=>{e.stopPropagation();finish(false);};

  // ── 다 쓴 뒤 비교: 바른 글씨(모형) · 내 글씨(쓴 자리 · 크기 그대로) · 닮은 정도. 막지 않는다 — 「다시 써 보기」 또는 「학생증에 넣을게요」 ──
  // 음절 점수: 닮은 정도(모형 가운데 선과의 거리) · 획 덮음 · 획 순서 · 방향(엉뚱한 획은 깎는다). 흐린 글씨 위를 바르게 따라 쓰면 90점대, 비뚤면 70점대
  // 비교판의 순서 · 방향은 쓰는 동안 센 값과 상자를 맞춰 다시 센 값(strokeStats) 가운데 나은 쪽 — 빈 칸에 치우쳐 쓴 학생이 잘못 깎이지 않게(카본 A3)
  function sylParts(k){const s=stats[k],m=syllableStrokes(syl[k].ch),r=strokeStats(m,inks[k]||[],lw/W),f=(a,n)=>n?a/n:1;
   return {ord:Math.max(f(s?.ord,s?.n),f(r.ord,r.n)),dir:Math.max(f(s?.dir,s?.n),f(r.dir,r.n)),like:inks[k]?.length?likeness(m,inks[k],lw/W,{fit:knows}):0};}
  function sylScore(k){const s=stats[k],r=s?.r;if(!r||!inks[k]?.length)return 0;const {ord,dir,like}=sylParts(k);
   return Math.max(0,Math.min(100,Math.round(100*(.55*like+.2*r.all+.15*ord+.1*dir)-6*(r.stray||0))));}
  function compare(){
   if(finished)return;
   phase='compare';switching=false;cancelAnimationFrame(soRaf);clr(xd);clr(xg);so.innerHTML='';pad.getAnimations().forEach(a=>a.cancel());
   const per=syl.map((_,k)=>sylScore(k)),total=Math.round(per.reduce((a,b)=>a+b,0)/per.length),prev=best;
   lastScore=total;best=Math.max(best??0,total);clearTimeout(idleT);SND.felt('open');
   cmp.querySelector('.nt-cmp-model').innerHTML=cmp.querySelector('.nt-cmp-mine').innerHTML='';
   const addCell=sel=>{const c=document.createElement('i');c.className='nt-cg';c.innerHTML='<canvas></canvas>';cmp.querySelector(sel).appendChild(c);return c;};
   cmp.hidden=false;box.classList.add('cmp');paintRow();
   const cells=syl.map(s=>({s,m:addCell('.nt-cmp-model'),y:addCell('.nt-cmp-mine')}));
   // 음절 점수: 90점 넘으면 초록, 가장 낮은 음절이 90점 아래면 붉게 + 가장 많이 잃은 곳(순서 · 방향 · 모양) 꼬리표 — 다시 쓸 때 볼 곳
   const low=per.indexOf(Math.min(...per));
   cells.forEach(({y},k)=>{const tag=k===low&&per[k]<90&&syl.length<5?weakTag(sylParts(k)):null;y.insertAdjacentHTML('beforeend',`<b class="nt-cs${per[k]>=90?' good':k===low&&per[k]<90?' low':''}">${per[k]}${tag?`<em>${L(tag)}</em>`:''}</b>`);});
   const rec=$('#ntRec'),newBest=prev!=null&&total>prev;rec.textContent=prev!=null&&!newBest?L('지난 최고',{p:prev}):'';$('#ntTry').textContent=attempt>1?L('도전 횟수',{n:attempt}):'';
   const sc=$('#ntScore');sc.classList.remove('land');
   const sz=cells[0].m.offsetWidth||60,c=sz*d,lwc=sz*.05;
   const prep=cvs=>{cvs.width=cvs.height=Math.round(c);const g=cvs.getContext('2d');g.setTransform(d,0,0,d,0,0);return g;};
   // 바른 글씨: 모형 획을 넓적 촉으로(흐린 글씨와 같은 모양, 진하게)
   cells.forEach(({s,m})=>{const g=prep(m.querySelector('canvas'));g.fillStyle='#3A404C';for(const st of syllableStrokes(s.ch)){const sh=shapeOf(st.k,st.p.map(([u,v])=>[u*sz,v*sz]));nib(g,sh.p,sh.K,{h:lwc*LOOK.gh,a:LOOK.a,m:LOOK.gm});}});
   // 내 글씨: 칸에 쓴 자리 · 크기 그대로. 뒤에 바른 글씨를 엷게 깔아 어디가 다른지 보이게. 획을 차례로 다시 쓰며 나타난다
   const mine=cells.map(({s,y},k)=>{const g=prep(y.querySelector('canvas'));return {g,ghost:syllableStrokes(s.ch),list:(inks[k]||[]).filter(p=>p.length).map(p=>p.map(([u,v])=>[u*sz,v*sz]))};});
   const total2=mine.reduce((a,o)=>a+o.list.reduce((b,p)=>b+p.length,0),0),dur=reduce?0:Math.min(1100,260+total2*1.6),t0=performance.now();
   cancelAnimationFrame(cmpRaf);let tickAt=0;
   // 점수가 다 오르면: 숫자가 한 번 튀고, 층마다 다른 소리, 새 최고면 「최고 기록」 표, 서하가 점수에 맞는 한마디(목소리 · 말풍선)
   const landed=()=>{if(finished||phase!=='compare')return;sc.classList.add('land');const tr=tier(total);
    if(tr==='full'){SND.felt('done');SND.sfx('pix_sparkle',.5);}else if(tr==='top')SND.felt('done');else if(tr==='hi')SND.felt('reward');else SND.felt('ok');
    if(newBest){rec.innerHTML=`<b class="nt-best">${L('최고 기록')}</b>`;if(tr!=='full')SND.sfx('pix_sparkle',.35);}
    const info={score:total,attempt,prev},r=coach.final(info);say(finalLine(info),r?.dur||0);};
   const delta=$('#ntDelta');delta.textContent=prev!=null&&total>prev?`+${total-prev}`:'';hint.textContent='';
   (function f(t){const u=dur?Math.min(1,(t-t0)/dur):1;let left=u*total2;
    for(const o of mine){o.g.clearRect(0,0,sz,sz);drawGuide(o.g,m=>{for(const st of o.ghost){const sh=shapeOf(st.k,st.p.map(([a,b])=>[a*sz,b*sz]));nib(m,sh.p,sh.K,{h:lwc*LOOK.gh,a:LOOK.a,m:LOOK.gm});}},{fill:'rgba(194,74,55,.13)'});
     for(const p of o.list){if(left<=0)break;const n=Math.min(p.length,Math.ceil(left));paintInk(o.g,p.slice(0,n),lwc,n===p.length);left-=p.length;}}
    const v=Math.round(total*u);sc.textContent=String(v);if(v-tickAt>=9&&u<1){tickAt=v;SND.felt('tick');}
    if(u<1)cmpRaf=requestAnimationFrame(f);else landed();})(t0);
  }
  // 서하 말풍선(점수 바로 아래): 한국어 줄 + 학생 언어 번역, 목소리가 도는 동안 이름 옆 물결
  function say(id,dur){const ko=VO[id];if(!ko)return;const tr=L(ko);
   hint.innerHTML=`<span class="nt-say"><b class="nt-who${dur?' talk':''}">${L('서하')}<i aria-hidden="true"></i></b><span class="nt-line"><span lang="ko">${ko}</span>${tr!==ko?`<small>${tr}</small>`:''}</span></span>`;
   if(dur)setTimeout(()=>hint.querySelector('.nt-who')?.classList.remove('talk'),dur*1000);}
  // 다시 써 보기: 이름 처음 음절부터(시범은 저절로 보이지 않는다 — 「획순 보기」로), 점수는 이번 판과 견준다
  const retry=e=>{e?.stopPropagation();if(phase!=='compare'||finished)return;
   phase='write';attempt++;coach.hush();cancelAnimationFrame(cmpRaf);cmp.hidden=true;box.classList.remove('cmp');inks.length=0;stats.length=0;i=0;
   row.querySelectorAll('.nt-cell').forEach(c=>{c.innerHTML='';});SND.felt('page');openSyllable(false);};
  const keep=e=>{e?.stopPropagation();if(phase!=='compare'||finished)return;finish(true);};
  function cleanup(){cancelAnimationFrame(soRaf);cancelAnimationFrame(cmpRaf);demoRun++;clearTimeout(idleT);coach.hush();clearTimeout(timer);clearTimeout(acceptT);clearTimeout(swT);clearTimeout(swT2);
   cv.removeEventListener('pointerdown',down);cv.removeEventListener('pointermove',move);removeEventListener('pointerup',up);cv.removeEventListener('pointercancel',cancelPt);removeEventListener('resize',onResize);
   btnOrder.removeEventListener('click',order);btnClear.removeEventListener('click',clear);btnAccept.removeEventListener('click',accept);btnSkip.removeEventListener('click',skip);btnRetry.removeEventListener('click',retry);btnKeep.removeEventListener('click',keep);}
  function finish(ok,quiet){
   if(finished)return;finished=true;cleanup();paintRow();
   let sign=null;
   if(ok){const s=encodeSign(inks);if(s)sign={w:word,s};box.classList.add('done');hint.textContent=L('잘 썼어요!');
    // 직인이 찍히는 순간(style.css nt-stamp: .2s 뒤 60%)에 도장 소리
    setTimeout(()=>{SND.felt('stamp');SND.sfx('sfx_stamp',.5);},reduce?0:400);
    // 다 쓰면 칸에 이름 전체를 내 글씨로 한 줄 다시 쓰고(서명이 완성되는 순간 — 칸이 빈 채로 끝나지 않게, 11-14 맹검) (인) 자리에 직인(style.css .nt.done .nt-seal)
    if(phase!=='compare'){clr(xg);clr(xd);live=null;paintLive();so.innerHTML='';pad.getAnimations().forEach(a=>a.cancel());signLine();}}
   // 칸 · 줄 DOM은 세션끼리 같이 쓴다 — 닫는 사이에 새 세션이 열렸으면(다시 열기) 옛 세션의 늦은 정리는 손대지 않는다(화면 검수 A5)
   const mine=()=>!active||active===self;
   setTimeout(()=>{if(mine())box.classList.remove('on');setTimeout(()=>{if(!mine())return;strokes=[];wet=[];clr(x);clr(xd);clr(xg);cmp.hidden=true;box.classList.remove('done','knows','cmp');so.innerHTML='';row.innerHTML='';hint.textContent='';box.querySelectorAll('.nt-fly').forEach(g=>g.remove());},500);done({sign,skipped:!ok&&!quiet,cancelled:!!quiet});},quiet?0:ok?1500:200);
  }
  function signLine(){
   const n=inks.length,gaps=syl.slice(0,n).filter(s=>s.gap).length;if(!n||!W)return;
   const s=Math.min(W*.98/(n+gaps*.4),W*.5),x0=(W-s*(n+gaps*.4))/2,y0=(W-s)/2,list=[];let gx=x0;
   inks.forEach((st,k)=>{if(syl[k]?.gap)gx+=s*.4;for(const pts of st)if(pts.length)list.push(pts.map(([u,v])=>[gx+u*s,y0+v*s]));gx+=s;});
   const w=lw*s/W,len=list.map(p=>p.length),total=len.reduce((a,b)=>a+b,0),dur=reduce?0:Math.min(900,180+total*2.2),t0=performance.now();
   (function f(t){const c=dur?Math.min(1,(t-t0)/dur)*total:total;clr(xd);let left=c;
    for(let k=0;k<list.length&&left>0;k++){const m=Math.min(list[k].length,Math.ceil(left));paintInk(xd,list[k].slice(0,m),w,m===list[k].length);left-=list[k].length;}
    if(c<total)requestAnimationFrame(f);})(t0);
  }
  const onResize=()=>{if(!finished&&!last&&phase==='write'&&!switching){fit();}};
  cv.addEventListener('pointerdown',down);cv.addEventListener('pointermove',move);addEventListener('pointerup',up);cv.addEventListener('pointercancel',cancelPt);addEventListener('resize',onResize);
  btnOrder.addEventListener('click',order);btnClear.addEventListener('click',clear);btnAccept.addEventListener('click',accept);btnSkip.addEventListener('click',skip);btnRetry.addEventListener('click',retry);btnKeep.addEventListener('click',keep);
  const self={
   cancel(){finish(false,true);},
   paths(){const b=cv.getBoundingClientRect(),k=b.width/W;return model.map(s=>s.p.map(([u,v])=>[b.left+u*W*k,b.top+v*W*k]));},
   state(){return {i,n:syl.length,word,knows,done:soDone.slice(),hint:hint.textContent,accept:!btnAccept.classList.contains('off'),demo:demoing,phase,attempt,score:lastScore,best,said:coach.said,stats:stats.map(x=>x&&{n:x.n,ord:x.ord,dir:x.dir})};},
  };
  hint.textContent=HINT;box.classList.add('on');
  requestAnimationFrame(()=>{if(!finished)openSyllable(true);});
  return self;
 }
 return api;
}
