// 서울행 「내 팬」 1차(팬설계.md 12-2): 누가 무엇을 말하나. 순수 함수만 둔다 — 시험(tests/seoul-arrival.test.mjs)이 모든 조합을 표로 본다.
// 문장은 Vellum이 짓고(fan-lines.mjs, 생성 파일) 여기서는 이유 { code, slots }만 고른다. 판단기 · 모델 실행 · 선택기가 아니라
// 기록 값을 정해진 이유로 옮기는 제품 배선이다(설계 검토 7번).

// 꿈마다 팬 셋 — 1화 끝 객석의 사람 자리 0 · 1 · 2번(app.mjs seatOrder의 people 차례)에 실제로 앉은 사람이다(설계 7절).
// face: 객석 합성 그림(자리표 w×h, data.mjs ARENA · THEATER) 안의 얼굴 네모 [x, y, 한 변]. 그림에서 잰 값이다.
// 친구 자리(마린 · 몽글 · 까몽)에는 사람 이름을 붙이지 않고, 친구는 말하지 않는다.
export const FANS=Object.freeze({
 idol:Object.freeze([
  Object.freeze({name:'나랑',role:'최애 팬',face:Object.freeze([155,938,193])}),
  Object.freeze({name:'하린',role:'팬 역할',face:Object.freeze([387,758,162])}),
  Object.freeze({name:'도윤',role:'팬 역할',face:Object.freeze([637,748,152])}),
 ]),
 actor:Object.freeze([
  Object.freeze({name:'다은',role:'최애 팬',face:Object.freeze([620,1100,100])}),
  Object.freeze({name:'서진',role:'팬 역할',face:Object.freeze([470,1030,60])}),
  Object.freeze({name:'민지',role:'팬 역할',face:Object.freeze([412,962,52])}),
 ]),
});
export const FAN_SEATS=3;

const int=v=>Number.isSafeInteger(v)&&v>0?v:0;
const lines=n=>({code:'scene.lines',slots:{n}});
// 단계 사실 둘. 차례는 「한 것 먼저」, 같으면 한 번 더 → 처음 보는 말(설계 12-2).
function steps(t2,tr,onlyDone){
 const all=[{step:'take2',done:!!t2},{step:'transfer',done:!!tr}];
 const list=onlyDone?all.filter(s=>s.done):all;
 return [...list.filter(s=>s.done),...list.filter(s=>!s.done)].map(s=>({code:'scene.step',slots:{step:s.step,state:s.done?'done':'wait'}}));
}

// 커튼콜(1화 끝): was = 이번 판 앞의 best(없으면 null — 첫 판), run = 이번 판 값, next = 이번 판 뒤의 best.
// → [{ fan: 사람 자리 번호, why }] (자리 번호 차례). 이번 판이 0줄이면 아무도 말하지 않는다. 다시 한 판은 새로 참이 된 사실만.
export function curtainSay({was=null,run,next}){
 const n=int(run?.n);if(!n)return [];
 const lit=Math.min(FAN_SEATS,int(next?.n));
 if(!was){
  const facts=[lines(n),...steps(run.t2,run.tr,false)];
  return facts.slice(0,lit).map((why,fan)=>({fan,why}));
 }
 const out=[],used=new Set();
 // 줄 수가 늘었으면 새로 켜진 사람 자리 가운데 번호가 가장 작은 자리가 말한다
 if(int(next?.n)>int(was.n)){const seat=int(was.n);if(seat<lit){out.push({fan:seat,why:lines(n)});used.add(seat);}}
 // 새로 한 단계는 그 자리를 뺀 켜진 사람 자리가 번호 순으로. 자리가 모자라면 남은 사실은 말하지 않는다
 let seat=0;
 for(const why of steps(!!next?.t2&&!was.t2,!!next?.tr&&!was.tr,true)){
  while(seat<lit&&used.has(seat))seat++;
  if(seat>=lit)break;
  out.push({fan:seat,why});used.add(seat);seat++;
 }
 return out.sort((a,b)=>a.fan-b.fan);
}

// 내 팬 화면: best 값으로 켜진 사람 자리(최대 3)가 첫 판과 같은 차례로 말한다. 「오늘」 · 「이번에」가 든 문장은 쓰지 않는다.
export function bestSay(best){
 const n=int(best?.n);if(!n)return [];
 const facts=[lines(n),...steps(best.t2,best.tr,false)];
 return facts.slice(0,Math.min(FAN_SEATS,n)).map((why,fan)=>({fan,why}));
}

// 머리의 얼굴 수
export const faceCount=best=>Math.min(FAN_SEATS,int(best?.n));
