// 서울행 부스 · 이름 손글씨 칸(설계 이름손글씨.md 4-2). 겉 · 펜 처리는 책상 「가」 칸(app.mjs traceGa, 13판)과 같고,
// 흐린 글씨 · 시범 길 · 판정은 모두 획 모형(hangul-strokes.mjs)에서 나온다 — 셋이 늘 꼭 맞게.
// 순서를 어겨도 막지 않는다(쓴 획은 쓴 것으로 치고 안내는 아직 안 쓴 가장 앞 획으로). 못 넘겨도 「이대로 쓸게요」로 지나간다(엄격한 관문은 스트레스).
// 펜으로 쓰는 동안(마지막 펜 닿음에서 2.5초 안)은 손바닥 · 손가락 닿음을 잉크로 치지 않는다 — 13판과 같다.
import {syllableStrokes,isSyllable} from './hangul-strokes.mjs';
import {score,encodeSign,decodeSign} from './name-hand.mjs';

const NS='http://www.w3.org/2000/svg';
const dstr=pts=>pts.map(([a,b],i)=>(i?'L':'M')+a.toFixed(1)+' '+b.toFixed(1)).join('');
const TIP={h:'획 안내 가로',v:'획 안내 세로',hv:'획 안내 ㄱ꼴',vh:'획 안내 ㄴ꼴',dl:'획 안내 왼삐침',dr:'획 안내 오른내림',o:'획 안내 동그라미',hdl:'획 안내 ㅈ꼴',tick:'획 안내 꼭지'};

// 이름 글자 → 쓸 음절과 그 앞 띄어쓰기 자리. 다섯 음절이 넘으면 부르는 이름 하나(called)만 쓴다(설계 검토 F1-5)
export function nameSyllables(word,called){
 const use=[...word].filter(isSyllable).length>5&&called?called:word;
 const out=[];let gap=false;for(const ch of use){if(ch===' '){gap=true;continue;}if(isSyllable(ch)){out.push({ch,gap:gap&&out.length>0});gap=false;}}
 return {word:use,syl:out};
}

// 학생증 · 음절 줄의 잉크 그림(서명 줄글 또는 음절별 잉크 → SVG 선). tight면 음절마다 잉크 폭만큼만 차지하고 조금씩 띄워
// 이어 쓴 손글씨처럼 붙인다(학생증), 아니면 칸 하나 = 1 × 1(음절 줄). 띄어쓰기는 반 칸
export function inkSvg(syllables,{gaps=[],stroke='#1d2333',width=.075,tight=false}={}){
 let x=0;const parts=[];
 syllables.forEach((st,i)=>{
  if(gaps[i])x+=.4;
  let x0=0,x1=1;
  if(tight){const xs=st.flat().map(p=>p[0]);if(xs.length){x0=Math.min(...xs);x1=Math.max(...xs);}if(x1-x0<.3){const c=(x0+x1)/2;x0=c-.15;x1=c+.15;}}
  for(const pts of st)parts.push(`<polyline points="${pts.map(([u,v])=>`${(x+u-x0).toFixed(3)},${v.toFixed(3)}`).join(' ')}"/>`);
  x+=(x1-x0)+(tight?.1:0);
 });
 if(tight)x-=.1;
 return `<svg viewBox="0 0 ${Math.max(.3,x).toFixed(2)} 1" preserveAspectRatio="xMinYMid meet" aria-hidden="true"><g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g></svg>`;
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
  const box=$('#nameTrace'),pad=$('#ntPad'),cv=$('#ntInk'),x=cv.getContext('2d'),guide=$('#ntGuide'),so=$('#ntOrder'),hint=$('#ntHint'),row=$('#ntRow');
  const btnOrder=$('#ntOrderBtn'),btnClear=$('#ntClear'),btnAccept=$('#ntAccept'),btnSkip=$('#ntSkip');
  const {word,syl}=nameSyllables(fullWord,called);
  const HINT=L(knows?'이름 쓰기 안내 아는 학생':'이름 쓰기 안내',{w:word});
  const d=devicePixelRatio||1;
  let W=0,lw=10,i=0,model=[],strokes=[],last=null,pid=null,ptype='',penT=-1e9,lastT=0,timer=0,acceptT=0,finished=false,switching=false,swT=0,swT2=0;
  let soLen=[],soDone=[],soCur=0,soFoc=-1,soRaf=0,demoRun=0,demoing=false,guideOn=!knows;
  const inks=[];   // 음절마다 다 쓴 잉크(칸 [0,1]²)
  const showAccept=on=>{btnAccept.classList.toggle('off',!on);btnAccept.disabled=!on;};
  box.classList.remove('done');box.classList.toggle('knows',knows);cv.setAttribute('aria-label',L('이름 쓰는 칸',{w:word}));
  // 음절 줄: 쓴 음절은 내 잉크, 지금 음절은 테두리
  row.innerHTML=syl.map((s,k)=>`<i class="nt-cell${s.gap?' gap':''}" data-k="${k}"></i>`).join('');
  const cell=k=>row.querySelector(`[data-k="${k}"]`);
  function paintRow(){row.querySelectorAll('.nt-cell').forEach((c,k)=>{c.classList.toggle('cur',k===i&&!finished);c.classList.toggle('done',k<i||finished);});}

  function redraw(){x.setTransform(d,0,0,d,0,0);x.lineCap='round';x.lineJoin='round';x.lineWidth=lw;x.strokeStyle='#1d2333';x.clearRect(0,0,W,W);
   for(const s of strokes){x.beginPath();s.forEach(([u,v],k)=>k?x.lineTo(u*W,v*W):x.moveTo(u*W,v*W));if(s.length===1)x.lineTo(s[0][0]*W+.1,s[0][1]*W);x.stroke();}}
  function drawGuide(){
   guide.setAttribute('viewBox',`0 0 ${W} ${W}`);
   guide.innerHTML=`<g fill="none" stroke="#3a3f4c" stroke-width="${(lw*1.05).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round">${model.map(s=>`<path d="${dstr(s.p.map(([u,v])=>[u*W,v*W]))}"/>`).join('')}</g>`;
   guide.classList.toggle('on',guideOn);
  }
  // 번호: 획 시작점에서 획이 나아가는 반대쪽으로 조금 떼어(획을 가리지 않게)
  const badgeAt=pts=>{const [ax,ay]=pts[0];let j=1;while(j<pts.length-1&&Math.hypot(pts[j][0]-ax,pts[j][1]-ay)<lw)j++;const [bx,by]=pts[j]||pts[0],t=Math.atan2(by-ay,bx-ax),r=lw*.9+9,cl=v=>Math.min(W-11,Math.max(11,v));return [cl(ax-Math.cos(t)*r),cl(ay-Math.sin(t)*r)];};
  function arrowD(pts){const [ex,ey]=pts[pts.length-1];let j=pts.length-2;while(j>0&&Math.hypot(ex-pts[j][0],ey-pts[j][1])<8)j--;const [px,py]=pts[Math.max(0,j)],t=Math.atan2(ey-py,ex-px),a=7;
   const tx=ex+Math.cos(t)*3,ty=ey+Math.sin(t)*3;return `M${(tx-a*Math.cos(t-.55)).toFixed(1)} ${(ty-a*Math.sin(t-.55)).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}L${(tx-a*Math.cos(t+.55)).toFixed(1)} ${(ty-a*Math.sin(t+.55)).toFixed(1)}`;}
  function soBuild(){
   so.setAttribute('viewBox',`0 0 ${W} ${W}`);so.innerHTML='';
   const px=model.map(s=>s.p.map(([u,v])=>[u*W,v*W]));
   px.forEach(pts=>{const g=document.createElementNS(NS,'g');g.setAttribute('class','so-s');
    g.innerHTML=`<path class="so-route" d="${dstr(pts)}"/><path class="so-run" d="${dstr(pts)}" style="stroke-width:${(lw*.42).toFixed(1)}px"/><path class="so-arrow" d="${arrowD(pts)}"/>`;so.appendChild(g);});
   const nib=document.createElementNS(NS,'circle');nib.setAttribute('class','so-nib');nib.setAttribute('r','5.5');so.appendChild(nib);
   px.forEach((pts,k)=>{const [bx,by]=badgeAt(pts),o=document.createElementNS(NS,'g');o.setAttribute('transform',`translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
    o.innerHTML=`<g class="so-badge"><circle r="9.5"/><text y=".6">${k+1}</text></g>`;so.appendChild(o);});
   soLen=[...so.querySelectorAll('.so-run')].map(p=>p.getTotalLength());
  }
  // 지금 쓸 획: 점선 길 + 끝 화살 + 처음부터 끝까지 가는 펜촉(13판과 같은 1.1초 쓰고 0.65초 쉼). 아는 학생 칸은 「획순 보기」 전에는 길을 보이지 않는다
  function soLoop(k){
   cancelAnimationFrame(soRaf);soFoc=k;const nib=so.querySelector('.so-nib');if(!nib)return;
   so.querySelectorAll('.so-run').forEach(p=>{p.style.opacity=0;});nib.style.opacity=0;
   if(reduce||finished||demoing||k<0||!guideOn)return;
   const run=so.querySelectorAll('.so-run')[k],Lk=soLen[k],T=1100,P=650,t0=performance.now();run.style.strokeDasharray=`${Lk} ${Lk}`;
   (function f(t){if(finished||demoing||soFoc!==k)return;const q=(t-t0)%(T+P),u=Math.min(1,q/T),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2,pt=run.getPointAtLength(e*Lk),fade=q>T?1-(q-T)/P:1;
    nib.setAttribute('cx',pt.x.toFixed(1));nib.setAttribute('cy',pt.y.toFixed(1));nib.style.opacity=fade;run.style.strokeDashoffset=(Lk*(1-e)).toFixed(1);run.style.opacity=(.75*fade).toFixed(3);
    soRaf=requestAnimationFrame(f);})(t0);
  }
  function soShow(quiet){
   soCur=soDone.indexOf(false);
   so.classList.toggle('on',guideOn);
   so.querySelectorAll('.so-s').forEach((g,k)=>g.classList.toggle('cur',k===soCur));
   so.querySelectorAll('.so-badge').forEach((b,k)=>{b.classList.add('show');b.classList.toggle('cur',k===soCur);b.classList.toggle('done',!!soDone[k]);});
   if(!quiet)tip();
   soLoop(soCur);
  }
  const tip=()=>{if(soCur<0||!guideOn){hint.textContent=HINT;return;}const s=model[soCur];hint.innerHTML=`<b class="so-n">${soCur+1}</b>${L(TIP[s.k],{j:s.j})}`;};
  // 붉은 펜 시범: 지금 음절을 획마다 0.4초로 써 보인다(첫 음절은 저절로, 그다음은 「획순 보기」로)
  async function demo(){
   const my=++demoRun;demoing=true;cancelAnimationFrame(soRaf);guideOn=true;guide.classList.add('on');so.classList.add('on');
   const runs=[...so.querySelectorAll('.so-run')],badges=[...so.querySelectorAll('.so-badge')],nib=so.querySelector('.so-nib');nib.style.opacity=0;
   so.querySelectorAll('.so-s').forEach(g=>g.classList.remove('cur'));badges.forEach(b=>b.classList.remove('show','cur','done'));
   runs.forEach((p,k)=>{p.getAnimations().forEach(a=>a.cancel());p.style.strokeDasharray=`${soLen[k]} ${soLen[k]}`;p.style.strokeDashoffset=soLen[k];p.style.opacity=.9;});
   hint.textContent=L('이 순서로 써요');
   await sleep(reduce?0:240);
   for(let k=0;k<runs.length;k++){
    if(my!==demoRun)return;
    badges[k].classList.add('show','cur');
    if(reduce){runs[k].style.strokeDashoffset=0;continue;}
    const an=runs[k].animate([{strokeDashoffset:soLen[k]},{strokeDashoffset:0}],{duration:400,easing:'cubic-bezier(.45,0,.25,1)',fill:'forwards'});
    for(let q=0;q<4;q++)setTimeout(()=>{if(my===demoRun)SND.felt('pencil');},q*90);
    try{await an.finished;}catch{return;}
    if(my!==demoRun)return;badges[k].classList.remove('cur');await sleep(110);
   }
   await sleep(reduce?700:380);if(my!==demoRun)return;
   if(!reduce){const fades=runs.map(p=>p.animate([{opacity:.9},{opacity:0}],{duration:300,fill:'forwards'}));try{await Promise.all(fades.map(a=>a.finished));}catch{return;}}
   if(my!==demoRun)return;demoStop();
  }
  function demoStop(){if(!demoing)return;demoRun++;demoing=false;so.querySelectorAll('.so-run').forEach(p=>{p.getAnimations().forEach(a=>a.cancel());p.style.opacity=0;});soShow(false);}

  function openSyllable(auto){
   switching=false;last=null;pid=null;
   model=syllableStrokes(syl[i].ch);strokes=[];soDone=model.map(()=>false);clearTimeout(timer);clearTimeout(acceptT);showAccept(false);
   guideOn=!knows;fit();paintRow();
   if(auto&&!knows)setTimeout(()=>{if(!finished&&!strokes.length&&active===self)demo();},420);
   else soShow(false);
  }
  function fit(){
   W=pad.offsetWidth;lw=Math.max(9,W*.05);   // 배치 크기로 잰다(13판과 같다)
   cv.width=Math.round(W*d);cv.height=Math.round(W*d);
   drawGuide();soBuild();redraw();if(!demoing)soShow(true);
  }
  // 음절 끝: 잉크를 음절 줄 칸으로 옮겨 그리고 다음 음절로
  // 「획순 보기」 시범 중이면 전환 안내 타이머가 시범 선을 지우지 않는다(화면 검수 C2)
  function nextSyllable(){
   if(switching||finished)return;
   switching=true;clearTimeout(timer);clearTimeout(acceptT);showAccept(false);last=null;pid=null;
   inks[i]=strokes.map(s=>s.slice());
   const c=cell(i);if(c)c.innerHTML=inkSvg([inks[i]],{width:.09});
   SND.felt('ok');
   i++;
   if(i>=syl.length){finish(true);return;}
   if(!reduce){pad.animate([{opacity:1},{opacity:.0,offset:.45},{opacity:1}],{duration:520,easing:'ease-in-out'});}
   swT=setTimeout(()=>{if(finished)return;openSyllable(false);hint.textContent=L('좋아요! 다음 글자');swT2=setTimeout(()=>{if(!finished&&!strokes.length&&!demoing)soShow(false);},900);},reduce?0:240);
  }
  const pos=e=>{const b=cv.getBoundingClientRect(),k=W/(b.width||W);return {x:(e.clientX-b.left)*k,y:(e.clientY-b.top)*k};};
  const down=e=>{
   if(switching||finished)return;
   if(e.pointerType==='pen')penT=performance.now();else if(e.pointerType==='touch'&&performance.now()-penT<2500)return;
   if(last){if(e.pointerType==='pen'&&ptype!=='pen'){strokes.pop();redraw();last=null;pid=null;}else return;}
   e.preventDefault();clearTimeout(timer);if(demoing)demoStop();
   pid=e.pointerId;ptype=e.pointerType;last=pos(e);const cur=[[last.x/W,last.y/W]];strokes.push(cur);try{cv.setPointerCapture(e.pointerId);}catch{}
   x.beginPath();x.moveTo(last.x,last.y);x.lineTo(last.x+.1,last.y);x.stroke();};
  const move=e=>{if(!last||e.pointerId!==pid||!strokes.length)return;if(ptype==='pen')penT=performance.now();if(e.pointerType==='mouse'&&!e.buttons){up();return;}const p=pos(e),dist=Math.hypot(p.x-last.x,p.y-last.y);if(dist<1.5)return;
   x.beginPath();x.moveTo(last.x,last.y);x.lineTo(p.x,p.y);x.stroke();
   const cur=strokes[strokes.length-1];for(let k=1,n=Math.ceil(dist/3);k<=n;k++)cur.push([(last.x+(p.x-last.x)*k/n)/W,(last.y+(p.y-last.y)*k/n)/W]);
   last=p;const now=performance.now();if(now-lastT>45){SND.felt('pencil');lastT=now;}};
  // 펜을 떼면 판정: 다 쓰면 0.7초 뒤 다음 음절, 못 넘기면 안내 + 잠시 뒤 「이대로 쓸게요」
  const up=e=>{if(!last||(e&&e.pointerId!=null&&e.pointerId!==pid))return;if(ptype==='pen')penT=performance.now();last=null;pid=null;
   const r=score(model,strokes,lw/W);api.last=r;
   soDone=model.map((_,k)=>soDone[k]||r.done[k]);soShow(true);
   clearTimeout(acceptT);
   if(r.ok){hint.textContent=L('좋아요, 다 썼어요!');showAccept(false);timer=setTimeout(nextSyllable,700);return;}
   if(r.inside<.75||r.stray)hint.textContent=L(knows&&!guideOn?'칸 안에 또박또박 써 보세요':'흐린 글자 위를 따라 써 보세요');
   else if(soCur>=0&&guideOn)tip();
   else hint.textContent=L('조금만 더 써 보세요');
   acceptT=setTimeout(()=>{if(!finished&&strokes.length)showAccept(true);},2500);};
  const cancelPt=e=>{if(e.pointerId===pid){last=null;pid=null;}};
  const clear=e=>{e?.stopPropagation();if(switching)return;clearTimeout(timer);clearTimeout(acceptT);if(demoing)demoStop();strokes=[];last=null;pid=null;redraw();soDone=model.map(()=>false);showAccept(false);soShow(false);SND.felt('page');};
  const order=e=>{e.stopPropagation();if(switching)return;clearTimeout(timer);clearTimeout(swT2);demo();};
  const accept=e=>{e.stopPropagation();if(!strokes.length||switching||btnAccept.disabled)return;nextSyllable();};
  const skip=e=>{e.stopPropagation();finish(false);};
  function cleanup(){cancelAnimationFrame(soRaf);demoRun++;clearTimeout(timer);clearTimeout(acceptT);clearTimeout(swT);clearTimeout(swT2);
   cv.removeEventListener('pointerdown',down);cv.removeEventListener('pointermove',move);removeEventListener('pointerup',up);cv.removeEventListener('pointercancel',cancelPt);removeEventListener('resize',onResize);
   btnOrder.removeEventListener('click',order);btnClear.removeEventListener('click',clear);btnAccept.removeEventListener('click',accept);btnSkip.removeEventListener('click',skip);}
  function finish(ok,quiet){
   if(finished)return;finished=true;cleanup();paintRow();
   let sign=null;
   if(ok){const s=encodeSign(inks);if(s)sign={w:word,s};box.classList.add('done');hint.textContent=L('잘 썼어요!');}
   // 칸 · 줄 DOM은 세션끼리 같이 쓴다 — 닫는 사이에 새 세션이 열렸으면(다시 열기) 옛 세션의 늦은 정리는 손대지 않는다(화면 검수 A5)
   const mine=()=>!active||active===self;
   setTimeout(()=>{if(mine())box.classList.remove('on');setTimeout(()=>{if(!mine())return;strokes=[];x.clearRect(0,0,W,W);box.classList.remove('done','knows');so.innerHTML='';guide.innerHTML='';row.innerHTML='';hint.textContent='';},500);done({sign,skipped:!ok&&!quiet,cancelled:!!quiet});},quiet?0:ok?1100:200);
  }
  const onResize=()=>{if(!finished&&!last){fit();}};
  cv.addEventListener('pointerdown',down);cv.addEventListener('pointermove',move);addEventListener('pointerup',up);cv.addEventListener('pointercancel',cancelPt);addEventListener('resize',onResize);
  btnOrder.addEventListener('click',order);btnClear.addEventListener('click',clear);btnAccept.addEventListener('click',accept);btnSkip.addEventListener('click',skip);
  const self={
   cancel(){finish(false,true);},
   paths(){const b=cv.getBoundingClientRect(),k=b.width/W;return model.map(s=>s.p.map(([u,v])=>[b.left+u*W*k,b.top+v*W*k]));},
   state(){return {i,n:syl.length,word,knows,done:soDone.slice(),hint:hint.textContent,accept:!btnAccept.classList.contains('off'),demo:demoing};},
  };
  hint.textContent=HINT;box.classList.add('on');
  requestAnimationFrame(()=>{if(!finished)openSyllable(true);});
  return self;
 }
 return api;
}
