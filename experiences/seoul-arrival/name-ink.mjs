// 서울행 이름 손글씨 · 잉크와 흐린 글씨 그리기(11-14 겉 다시 짓기, 설계 이름손글씨.md 「겉 v2」). 판정 · 저장은 점만 보므로 이 파일은 겉만 맡는다.
// 펜 압력이 없어도 손이 움직인 빠르기로 굵기를 정하고(느리면 굵게 · 빠르면 가늘게) 획 끝을 가늘게 뺀다 —
// 웹 손글씨 라이브러리들이 쓰는 「속도 기반 굵기」를 작게 다시 쓴 것이다(라이브러리 코드는 싣지 않았다).
// 넓적 촉(nib)은 촉을 비스듬히 쥔 펜처럼 가로획은 가늘고 세로획은 굵게 쓴다 — 명조 · 궁체의 굵기 대비.

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export function arcLen(p){const a=[0];for(let i=1;i<p.length;i++)a.push(a[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));return a;}

// 점 목록을 간격 step(px)으로 다시 찍는다
export function resample(p,step=2){
 if(p.length<2)return p.map(q=>q.slice(0,2));
 const arc=arcLen(p),L=arc[arc.length-1];if(!L)return [p[0].slice(0,2)];
 const n=Math.max(1,Math.round(L/step)),out=[];let i=1;
 for(let k=0;k<=n;k++){const target=L*k/n;while(i<p.length-1&&arc[i]<target)i++;const a=arc[i-1],b=arc[i],t=b>a?(target-a)/(b-a):0;
  out.push([p[i-1][0]+(p[i][0]-p[i-1][0])*t,p[i-1][1]+(p[i][1]-p[i-1][1])*t]);}
 return out;
}

// 손떨림 고르기(그리기에만 — 판정은 날 점을 본다): 앞뒤 win개 평균, 끝점은 그대로, 시각은 원래 점의 것
export function smooth(p,win=3){
 if(p.length<3)return p;
 return p.map((q,i)=>{if(i===0||i===p.length-1)return q;const w=Math.min(win,i,p.length-1-i);let x=0,y=0;for(let j=i-w;j<=i+w;j++){x+=p[j][0];y+=p[j][1];}const n=2*w+1;return [x/n,y/n,q[2]];});
}

// 손 잉크의 굵기 배수(점마다). p=[[x,y,t]…](px · ms, 시각이 없으면 고른 빠르기로 본다). vref: 이 빠르기(px/ms)에서 가장 가늘다. fin이면 끝을 뺀다
export function inkScale(p,{thin=.3,lo=.62,hi=1,vref=.9,taperIn=0,inFrom=.5,taperOut=0,outTo=.22,fin=true}={}){
 const n=p.length,out=new Array(n),arc=arcLen(p),L=arc[n-1]||0;let f=hi,v=0;
 for(let i=0;i<n;i++){
  if(i){const d=arc[i]-arc[i-1],dt=p[i][2]!=null&&p[i-1][2]!=null?Math.max(6,p[i][2]-p[i-1][2]):d/(vref*.6)||6,s=d/dt;v=i===1?s:v*.75+s*.25;}
  const tgt=clamp(hi-thin*Math.min(v/vref,1.4),lo,hi);f=i?f*.75+tgt*.25:hi;
  let m=1;if(taperIn)m*=inFrom+(1-inFrom)*ease(arc[i]/taperIn);if(taperOut&&fin)m*=outTo+(1-outTo)*ease((L-arc[i])/taperOut);
  out[i]=f*m;
 }
 return out;
}

// 둥근 촉: 원을 촘촘히 찍는다(반지름 R[i])
export function stamp(ctx,p,R){
 if(!p.length)return;ctx.beginPath();
 const dot=(x,y,r)=>{if(r<=.05)return;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2);};
 dot(p[0][0],p[0][1],R[0]);
 for(let i=1;i<p.length;i++){
  const [ax,ay]=p[i-1],[bx,by]=p[i],ra=R[i-1],rb=R[i],d=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.ceil(d/Math.max(.5,Math.min(ra,rb)*.28)));
  for(let j=1;j<=n;j++){const t=j/n;dot(ax+(bx-ax)*t,ay+(by-ay)*t,ra+(rb-ra)*t);}
 }
 ctx.fill();
}
// 넓적 촉이 쓸고 간 사각형들(점마다 배수 K) — 캔버스와 SVG가 같은 모양을 쓴다. 모두 같은 감김 방향으로 돌려 겹쳐도 구멍이 나지 않게
export function nibQuads(p,K,{h,a=.42}){
 const cx=Math.cos(a)*h,cy=Math.sin(a)*h,out=[];
 for(let i=1;i<p.length;i++){const [ax,ay]=p[i-1],[bx,by]=p[i],ka=K[i-1],kb=K[i];
  const v=[[ax-cx*ka,ay-cy*ka],[ax+cx*ka,ay+cy*ka],[bx+cx*kb,by+cy*kb],[bx-cx*kb,by-cy*kb]];
  let s=0;for(let j=0;j<4;j++){const [x1,y1]=v[j],[x2,y2]=v[(j+1)%4];s+=x1*y2-x2*y1;}if(s<0)v.reverse();out.push(v);}
 // 점 하나짜리 획(톡 찍은 점 · 줄글을 되읽어 한 점이 된 짧은 획): 촉 크기에 비례한 작은 평행사변형 — 픽셀 칸과 [0,1] 학생증 SVG에서 같은 크기로 보이게(카본 A1 · B1)
 if(p.length===1){const [x,y]=p[0],k=K[0],ex=-cy*k*.6,ey=cx*k*.6;out.push([[x-cx*k-ex/2,y-cy*k-ey/2],[x+cx*k-ex/2,y+cy*k-ey/2],[x+cx*k+ex/2,y+cy*k+ey/2],[x-cx*k+ex/2,y-cy*k+ey/2]]);}
 return out;
}
// 넓적 촉: 반폭 h인 촉(각 a)을 길 따라 쓸고, 가장 얇은 데도 h*m은 남긴다
export function nib(ctx,p,K,{h,a=.42,m=.26}){
 if(!p.length)return;
 ctx.beginPath();for(const v of nibQuads(p,K,{h,a})){ctx.moveTo(v[0][0],v[0][1]);for(let j=1;j<4;j++)ctx.lineTo(v[j][0],v[j][1]);ctx.closePath();}ctx.fill();
 stamp(ctx,p,K.map(k=>h*m*k));
}

// 획 갈래마다 붓의 굵기 변화(s: 획 안 자리 0~1) — 들어갈 때 누르고 · 삐침은 빼고 · 오른내림은 눌러 내린다
export function profile(k,s){
 switch(k){
  case 'h':return s<.08?1.06-.2*ease(s/.08):s>.84?.86+.17*ease((s-.84)/.16):.86;
  case 'v':return s<.07?1.06-.18*ease(s/.07):s>.78?.88-.22*ease((s-.78)/.22):.88;
  case 'dl':return s<.1?1.04-.12*ease(s/.1):.92-.66*ease((s-.1)/.9);
  case 'hdl':return s<.06?1.05-.17*ease(s/.06):s<.46?.88:.88-.62*ease((s-.46)/.54);
  case 'dr':return .48+.6*ease(s/.84)-(s>.9?.22*ease((s-.9)/.1):0);
  case 'tick':return 1.04-.34*ease(s);
  case 'o':return .8+.14*Math.abs(Math.sin(s*Math.PI*2));
  default:return s<.07?1.05-.17*ease(s/.07):s>.9?.88-.08*ease((s-.9)/.1):.88;   // hv · vh
 }
}
// 모형 획(px 점) → 다시 찍은 점과 획 갈래 굵기 배수
export function shapeOf(k,p){const q=resample(p,1.6),arc=arcLen(q),L=arc[arc.length-1]||1;return {p:q,K:arc.map(a=>profile(k,a/L))};}

// 흐린 글씨: paint(ctx)로 그린 모양을 채우거나(fill) 겉선만(outline — 서예 교본의 쌍구) 남긴다. 겉선은 모양을 여덟 쪽으로 ow만큼 밀어 부풀린 테두리
export function drawGuide(ctx,paint,{fill=null,outline=null,ow=1}={}){
 const {width:w,height:h}=ctx.canvas,T=ctx.getTransform(),mk=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const mask=mk(),m=mask.getContext('2d');m.setTransform(T);m.fillStyle='#000';paint(m);
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 if(outline){const ring=mk(),r=ring.getContext('2d'),o=ow*T.a;
  for(let k=0;k<8;k++){const t=k/8*Math.PI*2;r.drawImage(mask,Math.cos(t)*o,Math.sin(t)*o);}
  r.globalCompositeOperation='source-in';r.fillStyle=outline;r.fillRect(0,0,w,h);
  r.globalCompositeOperation='destination-out';r.drawImage(mask,0,0);ctx.drawImage(ring,0,0);}
 if(fill){const f=mk(),x=f.getContext('2d');x.drawImage(mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle=fill;x.fillRect(0,0,w,h);ctx.drawImage(f,0,0);}
 ctx.restore();
}
