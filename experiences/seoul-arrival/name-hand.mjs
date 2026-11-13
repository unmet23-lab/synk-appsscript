// 서울행 이름 손글씨의 판정 · 서명 줄글(설계 이름손글씨.md 4-2 · 6, 순수 함수 — 화면 없이 시험한다). 좌표는 칸 [0,1]², 굵기 lw도 칸 비율(펜 굵기 = 칸의 .05).
// 판정은 13판 「가」(책상)의 기준을 획 단위로 넓힌 것: 획마다 가운데 선을 잉크가 덮었는지 · 잉크가 글자 근처에 있는지.

// 획 가운데 선을 간격 step마다 점으로
export function samples(pts,step=.012){const out=[pts[0]];for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],d=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.ceil(d/step));for(let k=1;k<=n;k++)out.push([ax+(bx-ax)*k/n,ay+(by-ay)*k/n]);}return out;}
const segDist=(p,pts)=>{let b=1e9;for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((p[0]-ax)*dx+(p[1]-ay)*dy)/(dx*dx+dy*dy||1)));b=Math.min(b,Math.hypot(p[0]-ax-t*dx,p[1]-ay-t*dy));}return b;};
const bbox=pts=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const [x,y] of pts){if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;}return {x0,y0,x1,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};};

// 획마다 쓴 것으로 치는 덮음(ㅇ · 꼭지는 조금 낮게) — 「가」는 ㄱ .5 · ㅣ .55 · 짧은 선 .45
const NEED={o:.5,tick:.45};
export const PASS={cover:.55,inside:.75,all:.6};

// 잉크(획 목록, 각 획은 점 목록) → 모형 strokes([{k,p}])에 대한 판정
function scoreRaw(model,ink,lw){
 const R=lw*1.05,O=lw*1.15;const pts=ink.flat();
 if(!pts.length)return {cov:model.map(()=>0),done:model.map(()=>false),inside:1,all:0,stray:0,ok:false};
 // 덮음은 획의 「제 몫」 점만 본다: 다른 획에서 R 넘게 떨어진 가운데 선 점. 작은 자모가 붙은 음절(볼 · 꽝)에서
 // 이웃 획 잉크가 끝자리를 덮어 빠진 획이 통과하지 않게. 제 몫이 셋보다 적은 짧은 획은 전부를 본다.
 const sp=model.map((s,k)=>{const all=samples(s.p),mine=all.filter(q=>model.every((o,j)=>j===k||segDist(q,o.p)>R*1.1));return mine.length>=3?mine:all;});
 const cov=sp.map(list=>{let c=0;for(const q of list){for(const p of pts){if(Math.hypot(p[0]-q[0],p[1]-q[1])<=R){c++;break;}}}return c/list.length;});
 const near=p=>model.some(s=>segDist(p,s.p)<=O);
 let inn=0;for(const p of pts)if(near(p))inn++;
 // 엉뚱한 획: 절반 넘게 글자 밖인 획(점 하나 같은 짧은 획은 빼고) — ㄴ 자리에 ㅌ처럼 획을 더 그은 글자가 통과하지 않게
 const len=st=>st.reduce((a,p,i)=>i?a+Math.hypot(p[0]-st[i-1][0],p[1]-st[i-1][1]):0,0);
 const stray=ink.filter(st=>len(st)>=.06&&st.filter(p=>!near(p)).length/st.length>.5).length;
 const inside=inn/pts.length,done=cov.map((c,i)=>c>=(NEED[model[i].k]??PASS.cover));
 const total=sp.reduce((a,x)=>a+x.length,0),all=sp.reduce((a,x,i)=>a+cov[i]*x.length,0)/total;
 return {cov,done,inside,all,stray,ok:done.every(Boolean)&&inside>=PASS.inside&&all>=PASS.all&&!stray};
}
// 칸 안 자리 · 크기를 넉넉히: 잉크 상자를 모형 상자에 맞춘(옮기고 0.7~1.4배) 판정과 그대로의 판정 가운데 나은 쪽
export function score(model,ink,lw=.05,{align=true}={}){
 const a=scoreRaw(model,ink,lw);if(!align||!ink.flat().length)return a;
 const mb=bbox(model.flatMap(s=>s.p)),ib=bbox(ink.flat());
 if(ib.w+ib.h<(mb.w+mb.h)*.35)return a;   // 너무 작은 끄적임은 맞추지 않는다
 const k=Math.max(.7,Math.min(1.4,(mb.w+mb.h)/((ib.w+ib.h)||1)));
 const moved=ink.map(s=>s.map(([x,y])=>[mb.cx+(x-ib.cx)*k,mb.cy+(y-ib.cy)*k]));
 const b=scoreRaw(model,moved,lw);
 const rank=r=>(r.ok?10:0)+r.done.filter(Boolean).length+r.all-r.stray;
 return rank(b)>rank(a)?{...b,aligned:true}:a;
}
// 닮은 정도(0~1, 다 쓴 뒤 비교 화면 · 겉 v2 11-14): 모형 가운데 선과 잉크의 양쪽 평균 거리 — 모형에서 잉크까지(빠진 곳) · 잉크에서 모형까지(삐친 곳).
// 판정(score)은 넉넉히 받아 주고, 이 값은 「얼마나 바르게」를 잰다. 흐린 글씨 없이 쓴 학생(fit)은 잉크 상자를 모형 상자에 맞춘 뒤 잰다(자리 대신 꼴)
export function likeness(model,ink,lw=.05,{fit=false}={}){
 let pts=ink.flat();if(!pts.length)return 0;
 const mp=model.flatMap(s=>samples(s.p));
 if(fit){const mb=bbox(model.flatMap(s=>s.p)),ib=bbox(pts),k=Math.max(.6,Math.min(1.6,(mb.w+mb.h)/((ib.w+ib.h)||1)));pts=pts.map(([x,y])=>[mb.cx+(x-ib.cx)*k,mb.cy+(y-ib.cy)*k]);}
 const near=(p,list)=>{let b=1e9;for(const q of list){const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<b)b=d;}return b;};
 const step=Math.max(1,Math.floor(pts.length/400)),ip=pts.filter((_,i)=>i%step===0);
 const a=mp.reduce((s,p)=>s+Math.max(0,near(p,ip)-lw*.35),0)/mp.length,b=ip.reduce((s,p)=>s+Math.max(0,near(p,mp)-lw*.35),0)/ip.length;
 return Math.max(0,Math.min(1,1-(a+b)/2/(lw*1.4)));
}
// 방금 그은 획이 어느 모형 획을 따라갔고 거꾸로였는지(ㅇ은 돈 방향)
export function which(model,stroke,lw=.05){
 if(stroke.length<4)return {k:-1};
 const fr=model.map(s=>stroke.filter(p=>segDist(p,s.p)<lw*1.6).length/stroke.length);
 const k=fr.indexOf(Math.max(...fr));if(fr[k]<.6)return {k:-1};
 const P=model[k].p,a=stroke[0],z=stroke[stroke.length-1],D=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
 if(model[k].k==='o'){let s=0;for(let i=1;i<stroke.length;i++)s+=(stroke[i][0]-stroke[i-1][0])*(stroke[i][1]+stroke[i-1][1]);return {k,rev:s<0};}
 return {k,rev:D(a,P[P.length-1])+D(z,P[0])<D(a,P[0])+D(z,P[P.length-1])};
}

// 방금 그은 획을 「기대한 획」으로 봐도 되나(겉 v2 · 11-14 실측): 칸에서 조금 비켜(자리 · 크기) 쓰면 which는 나란한 이웃 가로획을 고를 수 있다.
// 기대한 획 둘레(lw×2.2)에 점의 60%가 있고, 처음 → 끝 방향이 같은 줄(코사인 .8 넘게) · 길이가 0.5~1.7배면 그 획으로 본다. 돌려준 rev는 거꾸로 썼는지
export function fitsStroke(ms,stroke,lw=.05){
 if(!ms||stroke.length<4)return null;const P=ms.p;
 if(stroke.filter(p=>segDist(p,P)<lw*2.2).length/stroke.length<.6)return null;
 if(ms.k==='o'){let s=0;for(let i=1;i<stroke.length;i++)s+=(stroke[i][0]-stroke[i-1][0])*(stroke[i][1]+stroke[i-1][1]);return {rev:s<0};}
 const a=stroke[0],z=stroke[stroke.length-1],A=P[0],Z=P[P.length-1],vx=z[0]-a[0],vy=z[1]-a[1],Vx=Z[0]-A[0],Vy=Z[1]-A[1],l=Math.hypot(vx,vy),L=Math.hypot(Vx,Vy);
 if(!l||!L||l/L<.5||l/L>1.7)return null;
 const cos=(vx*Vx+vy*Vy)/(l*L);return Math.abs(cos)<.8?null:{rev:cos<0};
}

// ── 서명 줄글: 음절 | 획 , 점 두 글자(0~63) ──
const AB='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function simplify(pts,eps){if(pts.length<3)return pts;let i0=0,dm=0;const [a,b]=[pts[0],pts[pts.length-1]];
 for(let i=1;i<pts.length-1;i++){const d=segDist(pts[i],[a,b]);if(d>dm){dm=d;i0=i;}}
 if(dm<=eps)return [a,b];return [...simplify(pts.slice(0,i0+1),eps).slice(0,-1),...simplify(pts.slice(i0),eps)];}
const q=v=>AB[Math.max(0,Math.min(63,Math.round(v*63)))];
// 저장 검증(seoul-record.mjs readSign)과 같은 상한: 음절당 획 40개 · 획당 점 200개 · 전체 3,000자.
// 판정이 통과시킨 글씨가 저장에서만 조용히 버려지지 않게, 솎아서라도 이 상한 안으로 맞춘다(화면 검수 F2)
export const SIGN_LIMIT={strokes:40,points:200,chars:3000};
const thin=(pts,n)=>pts.length<=n?pts:Array.from({length:n},(_,i)=>pts[Math.round(i*(pts.length-1)/(n-1))]);
export function encodeSign(syllables,max=SIGN_LIMIT.chars){
 const fit=syllables.map(st=>{const keep=st.filter(p=>p.length).slice();
  if(keep.length>SIGN_LIMIT.strokes){const len=p=>p.reduce((a,q,i)=>i?a+Math.hypot(q[0]-p[i-1][0],q[1]-p[i-1][1]):0,0);keep.sort((a,b)=>len(b)-len(a));keep.length=SIGN_LIMIT.strokes;}
  return keep;});
 for(const eps of [.006,.012,.02,.035,.06]){
  const s=fit.map(st=>st.map(pts=>thin(simplify(pts,eps),SIGN_LIMIT.points).map(([x,y])=>q(x)+q(y)).join('')).filter(Boolean).join(',')).join('|');
  if(s.length<=max)return s;
 }
 return null;
}
export function decodeSign(s){
 if(typeof s!=='string'||!s||s.length>3000||!/^[A-Za-z0-9_\-,|]+$/.test(s))return null;
 const out=s.split('|').map(syl=>syl?syl.split(',').map(st=>{if(st.length%2)return null;const p=[];for(let i=0;i<st.length;i+=2)p.push([AB.indexOf(st[i])/63,AB.indexOf(st[i+1])/63]);return p;}):[]);
 if(out.some(syl=>syl.some(st=>!st)))return null;
 return out;
}
