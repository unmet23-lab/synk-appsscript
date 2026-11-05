// 한글 음절 획 모형(서울행 이름 손글씨, 설계 이름손글씨.md 4-1): 음절 하나를 쓰는 차례대로 획(가운데 선 · 쓰는 방향)으로 푼다.
// 좌표는 칸 [0,1]², y는 아래로. 초성 → 중성 → 종성, 자모 안에서는 교과서 쓰기 차례(ㄹ ①ㄱ ②ㅡ ③ㄴ · ㅈ 2획 · ㅎ 3획 · ㅇ은 위에서 왼쪽으로 · ㅓ는 짧은 선 먼저).
// 흐린 글씨 · 시범 길 · 판정이 모두 이 모형을 쓴다 — 글꼴 획은 자동으로 나눌 수 없어서다(책상 「가」는 글자 하나라 글꼴에서 손으로 맞췄다).
const L_LIST=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const V_LIST=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const T_LIST=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
export function decompose(ch){const c=String(ch).codePointAt(0)-0xAC00;if(!(c>=0&&c<=11171))return null;return {L:L_LIST[Math.floor(c/588)],V:V_LIST[Math.floor((c%588)/28)],T:T_LIST[c%28]};}
export const isSyllable=ch=>!!decompose(ch);

// 곡선 · 원을 점으로
const qb=(a,c,b,n=10)=>Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;return [u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]];});
// 원: 위에서 시작해 왼쪽으로(화면에서 시계 반대 방향) 한 바퀴 — 끝을 시작점 조금 지나 닫는다
const ring=(cx,cy,rx,ry,n=28)=>Array.from({length:n+1},(_,i)=>{const t=i/n*Math.PI*2*1.02;return [cx-rx*Math.sin(t),cy-ry*Math.cos(t)];});
const S=(k,p)=>({k,p});
// 겹자음 · 겹받침: 두 자모를 나란히
const PAIR={'ㄲ':['ㄱ','ㄱ'],'ㄸ':['ㄷ','ㄷ'],'ㅃ':['ㅂ','ㅂ'],'ㅆ':['ㅅ','ㅅ'],'ㅉ':['ㅈ','ㅈ'],'ㄳ':['ㄱ','ㅅ'],'ㄵ':['ㄴ','ㅈ'],'ㄶ':['ㄴ','ㅎ'],'ㄺ':['ㄹ','ㄱ'],'ㄻ':['ㄹ','ㅁ'],'ㄼ':['ㄹ','ㅂ'],'ㄽ':['ㄹ','ㅅ'],'ㄾ':['ㄹ','ㅌ'],'ㄿ':['ㄹ','ㅍ'],'ㅀ':['ㄹ','ㅎ'],'ㅄ':['ㅂ','ㅅ']};

// 자음 꼴. ctx: 'v'(세로 모음 왼쪽) · 'h'(가로 모음 위) · 't'(받침). 획마다 j(어느 자모의 획인지)를 단다
function consonant(j,ctx){
 const V=ctx==='v',tag=list=>list.map(s=>({...s,j}));
 switch(j){
  case 'ㄱ':return tag(V?[S('hv',[[.06,.16],[.86,.16],...qb([.86,.16],[.86,.62],[.58,.94]).slice(1)])]:[S('hv',[[.06,.18],[.9,.18],[.9,.9]])]);
  case 'ㄴ':return tag([S('vh',[[.12,.08],[.12,.86],[.94,.86]])]);
  case 'ㄷ':return tag([S('h',[[.1,.14],[.88,.14]]),S('vh',[[.12,.14],[.12,.86],[.92,.86]])]);
  case 'ㄹ':return tag([S('hv',[[.1,.1],[.86,.1],[.86,.48]]),S('h',[[.12,.48],[.86,.48]]),S('vh',[[.12,.48],[.12,.9],[.92,.9]])]);
  case 'ㅁ':return tag([S('v',[[.12,.1],[.12,.9]]),S('hv',[[.12,.1],[.88,.1],[.88,.9]]),S('h',[[.12,.9],[.88,.9]])]);
  case 'ㅂ':return tag([S('v',[[.14,.06],[.14,.92]]),S('v',[[.86,.06],[.86,.92]]),S('h',[[.14,.48],[.86,.48]]),S('h',[[.14,.92],[.86,.92]])]);
  case 'ㅅ':return tag(V?[S('dl',qb([.52,.06],[.42,.62],[.04,.94])),S('dr',qb([.44,.5],[.62,.78],[.96,.92]))]:[S('dl',qb([.5,.06],[.4,.6],[.02,.92])),S('dr',qb([.46,.46],[.62,.78],[.98,.9]))]);
  // 받침 칸은 가로로 넓어서 원이 납작해지지 않게 가로 반지름을 줄인다(설계 검토 F2-2)
  case 'ㅇ':return tag([S('o',ctx==='t'?ring(.5,.5,.3,.44):ring(.5,.5,.42,.42))]);
  case 'ㅈ':return tag([S('hdl',[[.08,.12],[.84,.12],...qb([.84,.12],[.48,.5],[.04,.94]).slice(1)]),S('dr',qb([.46,.52],[.64,.8],[.96,.92]))]);
  case 'ㅊ':return [{...S('tick',[[.5,-.02],[.5,.16]]),j},...consonant('ㅈ',ctx).map(s=>({...s,j,p:s.p.map(([x,y])=>[x,.28+y*.72])}))];
  case 'ㅋ':return [...consonant('ㄱ',ctx).map(s=>({...s,j})),{...S('h',V?[[.08,.5],[.8,.5]]:[[.08,.52],[.9,.52]]),j}];
  case 'ㅌ':return tag([S('h',[[.12,.1],[.88,.1]]),S('h',[[.12,.48],[.86,.48]]),S('vh',[[.12,.1],[.12,.88],[.92,.88]])]);
  case 'ㅍ':return tag([S('h',[[.06,.1],[.94,.1]]),S('v',[[.32,.1],[.3,.88]]),S('v',[[.68,.1],[.7,.88]]),S('h',[[.02,.88],[.98,.88]])]);
  case 'ㅎ':return tag([S('tick',[[.5,-.04],[.5,.14]]),S('h',[[.08,.26],[.92,.26]]),S('o',ctx==='t'?ring(.5,.64,.22,.3):ring(.5,.64,.3,.28))]);
 }
 const pair=PAIR[j];
 if(pair){const [a,b]=pair;return [...place(consonant(a,'t'),[0,0,.47,1]),...place(consonant(b,'t'),[.53,0,1,1])];}
 throw Error('모르는 자음 '+j);
}
// 모음 꼴: 세로 모음은 세로 칸(좁고 김) 안, 가로 모음은 가로 칸(넓고 낮음) 안
function vowelV(j){
 const I=x=>S('v',[[x,.02],[x,.98]]),R=(x0,x1,y)=>S('h',[[x0,y],[x1,y]]);
 const m={'ㅣ':[I(.45)],'ㅏ':[I(.3),R(.3,.92,.5)],'ㅑ':[I(.3),R(.3,.92,.38),R(.3,.92,.62)],'ㅓ':[R(.04,.66,.5),I(.66)],'ㅕ':[R(.04,.66,.38),R(.04,.66,.62),I(.66)],
  'ㅐ':[I(.2),R(.2,.62,.5),I(.84)],'ㅒ':[I(.2),R(.2,.62,.38),R(.2,.62,.62),I(.84)],'ㅔ':[R(0,.46,.5),I(.46),I(.88)],'ㅖ':[R(0,.46,.38),R(0,.46,.62),I(.46),I(.88)]}[j];
 return m.map(s=>({...s,j}));
}
function vowelH(j){
 const B=y=>S('h',[[.02,y],[.98,y]]),T=(x,y0,y1)=>S('v',[[x,y0],[x,y1]]);
 const m={'ㅡ':[B(.5)],'ㅗ':[T(.5,.06,.6),B(.6)],'ㅛ':[T(.34,.06,.6),T(.66,.06,.6),B(.6)],'ㅜ':[B(.34),T(.5,.34,.96)],'ㅠ':[B(.34),T(.34,.34,.96),T(.66,.34,.96)]}[j];
 return m.map(s=>({...s,j}));
}
const VERT=new Set([...'ㅏㅐㅑㅒㅓㅔㅕㅖㅣ']),HORZ=new Set([...'ㅗㅛㅜㅠㅡ']);
const MIX={'ㅘ':['ㅗ','ㅏ'],'ㅙ':['ㅗ','ㅐ'],'ㅚ':['ㅗ','ㅣ'],'ㅝ':['ㅜ','ㅓ'],'ㅞ':['ㅜ','ㅔ'],'ㅟ':['ㅜ','ㅣ'],'ㅢ':['ㅡ','ㅣ']};
// 획을 칸 [x0,y0,x1,y1]에 넣는다
function place(strokes,[x0,y0,x1,y1]){return strokes.map(s=>({...s,p:s.p.map(([x,y])=>[x0+x*(x1-x0),y0+y*(y1-y0)])}));}
// 자음은 가로세로 비를 지킨다(너무 길쭉해지지 않게): 칸 안에서 비 lo~hi로 줄이고 가운데에 둔다
function fit(box,lo=.8,hi=1.25){let [x0,y0,x1,y1]=box;const w=x1-x0,h=y1-y0,r=w/h;
 if(r<lo){const nh=w/lo;y0+=(h-nh)/2;y1=y0+nh;}else if(r>hi){const nw=h*hi;x0+=(w-nw)/2;x1=x0+nw;}return [x0,y0,x1,y1];}

// 여섯 배치: 세로 · 가로 · 섞인 모음 × 받침 없음 · 있음
export const LAYOUT={
 v:{L:[.06,.2,.52,.8],V:[.56,.04,.94,.96]},
 vT:{L:[.08,.06,.52,.48],V:[.56,.02,.94,.58],T:[.16,.62,.84,.94]},
 h:{L:[.22,.04,.78,.46],V:[.04,.48,.96,.94]},
 hT:{L:[.26,.02,.74,.32],V:[.04,.32,.96,.6],T:[.18,.64,.82,.96]},
 m:{L:[.08,.06,.54,.44],Vh:[.02,.44,.66,.92],Vv:[.62,.02,.94,.98]},
 mT:{L:[.1,.02,.52,.3],Vh:[.02,.3,.66,.6],Vv:[.62,0,.94,.62],T:[.16,.66,.84,.96]},
};
// 칸 가장자리에 펜이 닿지 않게 둘레를 비운다
const M=.1;
// 음절 → [{k 갈래, j 자모, p 점 목록}] 쓰는 차례대로. 한글 음절이 아니면 null
export function syllableStrokes(ch){
 const d=decompose(ch);if(!d)return null;const fin=!!d.T;let out;
 const tail=Lb=>fin?place(consonant(d.T,'t'),fit(Lb.T,.9,1.6)):[];
 if(VERT.has(d.V)){const Lb=LAYOUT[fin?'vT':'v'];out=[...place(consonant(d.L,'v'),fit(Lb.L)),...place(vowelV(d.V),Lb.V),...tail(Lb)];}
 else if(HORZ.has(d.V)){const Lb=LAYOUT[fin?'hT':'h'];out=[...place(consonant(d.L,'h'),fit(Lb.L,.9,1.6)),...place(vowelH(d.V),Lb.V),...tail(Lb)];}
 else{const [hv,vv]=MIX[d.V],Lb=LAYOUT[fin?'mT':'m'];out=[...place(consonant(d.L,'v'),fit(Lb.L)),...place(vowelH(hv),Lb.Vh),...place(vowelV(vv),Lb.Vv),...tail(Lb)];}
 return out.map(s=>({k:s.k,j:s.j,p:s.p.map(([x,y])=>[M+x*(1-2*M),M+y*(1-2*M)])}));
}
// 자모 하나의 획 수(시험 · 안내용) — 초성 꼴 기준
export const strokeCount=j=>(V_LIST.includes(j)?(MIX[j]?MIX[j].reduce((a,x)=>a+(VERT.has(x)?vowelV(x):vowelH(x)).length,0):(VERT.has(j)?vowelV(j):vowelH(j)).length):consonant(j,'v').length);
