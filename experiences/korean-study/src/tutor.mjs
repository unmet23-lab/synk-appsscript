// 한국어 공부 · AI 튜터의 판단(README §2). 화면 없는 순수 함수 — app.mjs가 그리고 시험이 직접 부른다.
// · 근거 원장: Atlas Trail 사건(`trail`) — 장면마다 decision.made(가설·방법·이유), 답마다 practice.presented →(helped)→ attempted.
//   「혼자 해냄(독립)」은 Trail.summarize()의 independent 하나만 읽는다(첫 노출 · 첫 시도 · 도움 전 · correct|incorrect). 제품 안에 따로 두던 판정은 없앴다.
// · 제품 사실(obs): 쓰기의 끝 꼴 수 · 확인/방법 표시. 원인 가설 계산과 화면 사실에만 쓰고, 독립 여부는 obs의 사건 id(ev)로 Trail에서 읽는다.
//   사건이 없거나 잘린 obs는 근거가 아니다(추론으로 되살리지 않음).
// · 가설(구별 · 형태 · 적용)은 저장하지 않고 매번 근거에서 다시 계산한다. 한 답은 그 문항의 근거일 뿐이고 능력·실력·성향으로 올리지 않는다.
// · 근거가 모자라면 Atlas Core ask.choose()가 「방법 결정을 바꾸는 확인 하나」를 고른다(새 엔진·선택기 없음). AI 호출 없음(규칙).
import Ask from '../../../atlas/ask.js';
import Trail from '../../../atlas/trail.js';
import {cleanSemanticDetail} from './semantic-history.mjs';
import {sentencesOf,endingOf} from '../../synk-world-app/world-writing-check.mjs';
import {drillDeck,endsPlain} from '../../synk-world-app/world-writing-focus.mjs';

export const VERSION=2,OBS_MAX=240,TRAIL_MAX=1200,STALE_DAYS=14,HISTORY_DAYS=60,MIN_SENTENCES=3,PROBE_CARDS=3,PROBE_FORMS=2,LEARN_FORMS=4,MINE_MAX=3;
export const KC='study.ko2.ending-plain',SCOPE=Object.freeze({domain:'LAB',workspace:'study',subject:'device'});
// 앉은 자리: 관측 사이가 2시간 넘게 비면 새 자리. 한 자리에서 점검한 쓰기는 셋까지, 그중 새 자료는 둘까지(끝없이 쓰게 하지 않는다).
// 끝 뒤 지연 확인 간격 7·14·30일은 운영 가정이다(같은 간격과 늘리는 간격의 효과 차이는 확인되지 않음 — 루트 설계 검토 4). FSRS가 아니다.
export const SITTING_GAP=2*3600000,SITTING_WRITES=3,SITTING_FRESH=2,RECHECK_DAYS=[7,14,30];
const DAY=86400000,BINS=['formal','polite','plain'],AXES=['verb','adj','noun','past'],METHODS=['apply','forms','contrast'];
const KINDS=['write','sort','form','find','change','method','probe','cycle','semantic'],VERDICTS=['correct','incorrect','unassessed'];
const slot=owner=>typeof owner==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(owner)?owner:'guest';
export const storeKey=owner=>`synk.study.v2:${slot(owner)}`;
// 옛 판(v1) 칸. 읽어서 옮기기만 하고 지우거나 덮지 않는다(배포 중 열린 옛 탭이 계속 v1에 써도 v2 기록이 지워지지 않게).
export const legacyKey=owner=>`synk.study.v1:${slot(owner)}`;
const okAt=at=>typeof at==='string'&&Number.isFinite(Date.parse(at));
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_:-]{1,120}$/.test(v);
const nat=v=>Number.isInteger(v)&&v>=0&&v<=500;
const iso=now=>new Date(now).toISOString();

// ── 기록 읽기: 깨진 값·모르는 종류는 버린다. 기기 시계가 뒤로 간 기록(미래 시각)은 지우지 않고 근거에서만 뺀다. 학생 글 원문은 drafts에만.
function cleanObs(o){
 if(!o||typeof o!=='object'||!KINDS.includes(o.kind)||!okAt(o.at))return null;
 const base={at:o.at,kind:o.kind,n:Number.isInteger(o.n)&&o.n>0?o.n:0,...(id(o.ev)?{ev:o.ev}:{})};
 if(o.kind==='write')return id(o.itemId)&&[0,1,2].includes(o.support)&&['plain','off','total','formal','polite'].every(k=>nat(o[k]))?{...base,itemId:o.itemId,support:o.support,same:o.same===true,plain:o.plain,off:o.off,total:o.total,formal:o.formal,polite:o.polite,flags:nat(o.flags)?o.flags:0,axes:Array.isArray(o.axes)?AXES.filter(a=>o.axes.includes(a)):[],
  verdict:VERDICTS.includes(o.verdict)?o.verdict:'unassessed',unknown:nat(o.unknown)?o.unknown:0,linked:o.linked!==false,first:o.first===true,mode:o.mode==='revise'?'revise':'new',pasted:o.pasted===true,...(o.source==='legacy'?{source:'legacy'}:{})}:null;
 if(o.kind==='sort')return id(o.card)&&BINS.includes(o.bin)&&typeof o.ok==='boolean'?{...base,card:o.card,bin:o.bin,ok:o.ok,use:o.use==='check'?'check':'learn'}:null;
 if(o.kind==='form')return id(o.id)&&AXES.includes(o.axis)&&['learn','check'].includes(o.use)&&(typeof o.ok==='boolean'||o.ok===null)?{...base,id:o.id,axis:o.axis,use:o.use,ok:o.ok}:null;
 if(o.kind==='find')return id(o.id)&&typeof o.ok==='boolean'?{...base,id:o.id,ok:o.ok}:null;
 if(o.kind==='change')return typeof o.ok==='boolean'?{...base,ok:o.ok}:null;
 if(o.kind==='method')return METHODS.includes(o.method)?{...base,method:o.method}:null;
 if(o.kind==='probe')return ['distinguish','form'].includes(o.probe)?{...base,probe:o.probe}:null;
 if(o.kind==='cycle')return base;
 if(o.kind==='semantic')return ['analysis','check','practice'].includes(o.stage)&&typeof o.skill==='string'&&o.skill.length<50
  ?{...base,stage:o.stage,skill:o.skill,source:'ai-reference',result:['focus','clear','insufficient','selected-right','selected-other'].includes(o.result)?o.result:'insufficient',...(cleanSemanticDetail(o.detail)?{detail:cleanSemanticDetail(o.detail)}:{})}:null;
 return null;
}
const cleanDrafts=v=>Object.fromEntries(Object.entries(v&&typeof v==='object'?v:{}).filter(([k,d])=>id(k)&&d&&typeof d.text==='string'&&d.text.length<=4000).map(([k,d])=>[k,{text:d.text,updatedAt:okAt(d.updatedAt)?d.updatedAt:null,checkedAt:okAt(d.checkedAt)?d.checkedAt:null,...(Number.isInteger(d.pasted)&&d.pasted>0&&d.pasted<=100000?{pasted:d.pasted}:{})}]));
const cleanSeen=v=>Object.fromEntries(Object.entries(v&&typeof v==='object'?v:{}).filter(([k,at])=>id(k)&&okAt(at)));
// 순서는 기록한 차례(n)다 — 같은 시각·시계 되감기에도 앞뒤가 바뀌지 않는다(예전 after()는 같은 ms에서 방법 앞의 쓰기를 뒤로 셌다).
const ordered=obs=>{let n=0;return obs.map(o=>{n=Math.max(n+1,o.n||0);return {...o,n};});};
const seqOf=e=>Number(/(\d+)(-\d+)?$/.exec(e.id)?.[1]||0);
export function readState(raw,{now=Date.now()}={}){
 const v=raw&&typeof raw==='object'&&raw.v===VERSION?raw:{};
 const obs=capObs(ordered((Array.isArray(v.obs)?v.obs:[]).map(cleanObs).filter(Boolean)));
 const trail=cleanTrail(v.trail);
 const seq=Math.max(Number.isInteger(v.seq)?v.seq:0,obs.at(-1)?.n||0,...trail.map(seqOf));
 const recentCards=(Array.isArray(v.recentCards)?v.recentCards:[]).filter(id).slice(-12);
 const scene=v.scene&&typeof v.scene==='object'&&typeof v.scene.id==='string'?v.scene:null;
 return {v:VERSION,seq,obs,trail,drafts:cleanDrafts(v.drafts),seen:cleanSeen(v.seen),recentCards,scene};
}
// 원장 읽기: 결정 묶음마다 Trail 계약(필드·부모·시각 순서·첫 시도)을 확인하고 깨진 묶음은 통째로 버린다 — 한 건이 깨져 요약 전체가 던지지 않게(Fable 설계 P1-2).
function cleanTrail(list){
 const groups=[];for(const e of Array.isArray(list)?list:[]){if(!e||typeof e!=='object')continue;if(e.type==='decision.made'||!groups.length)groups.push([e]);else groups.at(-1).push(e);}
 const ids=new Set(),out=[];
 for(const g of groups){
  const d=g[0],pres=new Map();let last=Date.parse(d.at),ok=d.type==='decision.made'&&id(d.id)&&okAt(d.at)&&d.scope?.domain===SCOPE.domain&&d.scope?.workspace===SCOPE.workspace&&d.scope?.subject===SCOPE.subject&&!ids.has(d.id);
  for(const e of g.slice(1)){if(!ok)break;try{Trail.validate(e);}catch{ok=false;break;}
   const t=Date.parse(e.at);if(t<last||ids.has(e.id)||e.scope.subject!==SCOPE.subject||e.scope.workspace!==SCOPE.workspace){ok=false;break;}last=t;
   if(e.type==='practice.presented'){if(e.decisionId!==d.id){ok=false;break;}pres.set(e.id,0);}
   else{if(!pres.has(e.presentationId)){ok=false;break;}if(e.type==='practice.attempted'){const n=pres.get(e.presentationId)+1;if(e.attemptNo!==n){ok=false;break;}pres.set(e.presentationId,n);}}}
  if(ok){g.forEach(e=>ids.add(e.id));out.push(...g);}
 }
 return out;
}
const bump=state=>{const seq=state.seq+1;return [{...state,seq},seq];};
// 상한을 넘으면 카드·형태 관측부터 앞에서 던다(「끝」·지연 확인을 받치는 쓰기 관측은 오래 남긴다).
const capObs=obs=>{if(obs.length<=OBS_MAX)return obs;const out=[...obs];while(out.length>OBS_MAX){const i=out.findIndex(o=>o.kind!=='write');out.splice(i>=0&&i<out.length-1?i:0,1);}return out;};
export const addObs=(state,o,{now=Date.now()}={})=>{const [s,n]=bump(state),c=cleanObs({...o,n,at:o.at||iso(now)});return c?{...s,obs:capObs([...s.obs,c])}:state;};
export const markSeen=(state,ids,{now=Date.now()}={})=>({...state,seen:{...Object.fromEntries(ids.filter(id).map(i=>[i,iso(now)])),...state.seen}});

// ── Trail 원장 쓰기. 장면 하나 = decision.made 하나(plan에 가설·방법·이유). 답 하나 = presented →(helped)→ attempted →(정답 공개 helped).
// firstExposure는 그 문항을 이 기기에서 처음 보는지(seen — 처음 본 시각을 지우지 않는 평생 표식)로 정하고, 표식은 사건을 만든 뒤에 단다.
// 원장을 잘라도 「본 적 있음」은 seen에 남는다. 시계가 뒤로 가도 자식이 부모보다 앞서지 않게 시각을 맞춘다(Trail 부모 규칙).
const event=(type,eid,at,fields)=>({...(type.startsWith('practice.')?{schema:1}:{}),id:eid,type,scope:{...SCOPE},at,recordedAt:at,...fields});
export function recordDecision(state,plan,{now=Date.now()}={}){
 const [s,n]=bump(state),did=`d${n}`,at=iso(Math.max(now,...s.trail.slice(-1).map(e=>Date.parse(e.at))));
 const clean=Object.fromEntries(Object.entries(plan||{}).filter(([,v])=>typeof v==='string'&&v.length<=80||Number.isFinite(v)));
 return {state:trim({...s,trail:[...s.trail,event('decision.made',did,at,{plan:clean})]}),did};
}
export function recordAnswer(state,{did,itemKey,concept,helps=[],verdict,errorTags=[],choice=null,reveal=null,taskId='study-ending'},{now=Date.now()}={}){
 let s=state;
 if(!did||!s.trail.some(e=>e.id===did&&e.type==='decision.made')){const r=recordDecision(s,{scene:'resume'},{now});s=r.state;did=r.did;}
 const at=iso(Math.max(now,...s.trail.slice(-1).map(e=>Date.parse(e.at)))),first=!s.seen[itemKey];
 const [s1,n]=bump(s),pid=`p${n}`,ev=`a${n}`;
 const out=[event('practice.presented',pid,at,{decisionId:did,taskId,taskVersion:'1',itemKey,conceptIds:[concept],firstExposure:first})];
 helps.forEach((h,i)=>out.push(event('practice.helped',`h${n}-${i}`,at,{presentationId:pid,helpId:h.id,level:h.level,contentRef:h.id})));
 out.push(event('practice.attempted',ev,at,{presentationId:pid,attemptNo:1,verdict,errorTags:[...new Set(errorTags)].slice(0,24),...(choice?{choice}:{})}));
 if(reveal)out.push(event('practice.helped',`r${n}`,at,{presentationId:pid,helpId:reveal,level:'answer',contentRef:reveal}));
 try{out.forEach(e=>Trail.validate(e));}catch{return {state:markSeen(s1,[itemKey],{now}),ev:null,first};}
 return {state:trim(markSeen({...s1,trail:[...s1.trail,...out]},[itemKey],{now})),ev,first};
}
// 답 한 번을 원장(사건)과 제품 사실(obs)에 함께 남긴다 — 화면과 시험이 같은 길을 쓴다.
// 쓰기: L2 바꾸는 꼴 표·L1 끝 다시 읽기는 cue 도움. 붙여 넣은 글은 점검·연습은 그대로 하되 끝맺음 근거는 unassessed(출처를 모름 — 루트 설계 검토 1).
export function recordWrite(state,{did,item=null,itemId=item?.id,text,support=0,mode='new',pasted=false},{now=Date.now()}={}){
 const o=observeWrite(text,item);if(!o)return {state,o:null};
 const verdict=pasted?'unassessed':o.verdict;
 const helps=support===2?[{id:'forms-table',level:'cue'}]:support===1?[{id:'self-check',level:'cue'}]:[];
 const r=recordAnswer(state,{did,itemKey:itemId,concept:KC,helps,verdict,errorTags:[...o.errorTags,...(pasted?['input.pasted']:[])]},{now});
 // obs에는 글에서 본 사실(o.verdict)을 그대로 — 다음 장면(원인 확인 등)은 그대로 이어지고, 독립 여부만 Trail(붙여넣기 = unassessed)에서 빠진다(아르곤 B5).
 const next=addObs(r.state,{kind:'write',itemId,support,plain:o.plain,off:o.off,total:o.total,formal:o.formal,polite:o.polite,flags:o.flags,axes:o.axes,verdict:o.verdict,unknown:o.unknown.length,linked:o.linked,first:r.first,mode,pasted,ev:r.ev},{now});
 return {state:next,o,ev:r.ev,first:r.first,verdict};
}
// 카드·형태: 연습(방법 장면)은 설명이 먼저 화면에 나온 뒤라 explanation 도움, 연습 형태는 첫 시도 뒤 정답 공개(answer).
export function recordSort(state,{did,card,pick,learn=false},{now=Date.now()}={}){
 const ok=card.bin===pick;
 const r=recordAnswer(state,{did,itemKey:`card:${card.key}`,concept:`${KC}.distinguish`,helps:learn?[{id:'method-contrast',level:'explanation'}]:[],verdict:ok?'correct':'incorrect',errorTags:ok?[]:[`bin.${pick}`],choice:{selectedId:pick,correctId:card.bin}},{now});
 return {state:addObs(r.state,{kind:'sort',card:card.key,bin:card.bin,ok,use:learn?'learn':'check',ev:r.ev},{now}),ok};
}
export function recordForm(state,{did,form,grade,learn=form.use==='learn'},{now=Date.now()}={}){
 const verdict=grade===true?'correct':grade===false?'incorrect':'unassessed';
 const r=recordAnswer(state,{did,itemKey:form.id,concept:`${KC}.${form.axis}`,helps:learn?[{id:'method-forms',level:'explanation'}]:[],verdict,errorTags:grade==='typo'?['input.typo']:[],reveal:learn?`answer-${form.id}`:null},{now});
 return {state:addObs(r.state,{kind:'form',id:form.id,axis:form.axis,use:form.use,ok:grade===true?true:grade===false?false:null,ev:r.ev},{now}),verdict};
}
// 원장 자르기: 60일 넘은 결정 묶음과 상한을 넘는 앞 묶음을 통째로(부모 없는 자식이 남지 않게).
function trim(state){
 const groups=[];for(const e of state.trail){if(e.type==='decision.made'||!groups.length)groups.push([e]);else groups.at(-1).push(e);}
 const latest=Date.parse(state.trail.at(-1)?.at||0);let keep=groups.filter(g=>latest-Date.parse(g[0].at)<=HISTORY_DAYS*DAY),count=keep.flat().length;
 // 상한을 넘으면 카드·형태 묶음부터 앞에서 덜고, 그래도 넘으면 쓰기 묶음도(「끝」·지연 확인은 쓰기 묶음이 받친다 — Fable 설계 P2-5).
 while(count>TRAIL_MAX&&keep.length>1){const i=keep.findIndex(g=>g[0].plan?.scene!=='write'&&!g.some(e=>e.conceptIds?.[0]===KC));const at=i>=0&&i<keep.length-1?i:0;count-=keep[at].length;keep=keep.filter((_,j)=>j!==at);}
 return keep.length===groups.length?state:{...state,trail:keep.flat()};
}
// Trail 요약 → 사건 id별 독립 여부·판정. 원장이 깨졌으면 근거 없음으로 읽는다(근거를 지어내지 않는다).
export function trailRows(state,now){
 try{return new Map(Trail.summarize(state.trail,{scope:SCOPE,asOf:iso(now)}).attempts.map(a=>[a.eventId,a]));}catch{return new Map();}
}

// ── v1 → v2 옮기기. 옛 관측은 원본 그대로(source:'legacy') 두고, 새 판정 범위로 다시 채점하지 않는다(루트 설계 검토 2 —
// 최신 초안이 앞선 여러 쓰기의 본문과 같다는 증거가 없다). 옛 쓰기의 「-습니다/-아요」·목록 틀린 꼴은 실제로 본 틀린 끝이라 incorrect,
// 나머지 옛 성공은 unassessed(새 독립 성공으로 올리지 않음). 옛 카드·형태 답은 확인용만 첫 노출로, 연습은 설명 뒤로.
// 옛 D1 소개 예시(바구니마다 풀의 첫 카드)와 최근 카드는 본 것으로 둔다.
export function migrate(raw,{now=Date.now(),pool=[]}={}){
 if(!raw||typeof raw!=='object'||raw.v!==1)return readState(null,{now});
 let s=readState({v:VERSION,drafts:raw.drafts,recentCards:raw.recentCards},{now});
 const old=(Array.isArray(raw.obs)?raw.obs:[]).map(cleanObs).filter(Boolean).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 // 옛 D1 소개 예시는 옮기는 사건보다 먼저 본 것으로 둔다 — 그 카드가 뒤에 확인으로 나왔어도 첫 노출로 세지 않게(아르곤 B4).
 const shown=old.some(o=>o.kind==='method'&&o.method==='contrast')?BINS.flatMap(b=>pool.filter(c=>c.bin===b).slice(0,2).map(c=>`card:${c.key}`)):[];
 if(old.length)s=markSeen(s,shown,{now:Date.parse(old[0].at)});
 for(const o of old){
  const t=Date.parse(o.at),write=o.kind==='write',legacyVerdict=write?(o.off>0||o.flags>0?'incorrect':'unassessed'):null;let ev=null;
  if(write||o.kind==='sort'||o.kind==='form'){
   const d=recordDecision(s,{scene:'legacy'},{now:t});s=d.state;
   const itemKey=write?o.itemId:o.kind==='sort'?`card:${o.card}`:o.id;
   if(write?o.same:o.use!=='check')s=markSeen(s,[itemKey],{now:t});
   const verdict=write?legacyVerdict:o.ok===true?'correct':o.ok===false?'incorrect':'unassessed';
   const helps=write?(o.support>0?[{id:'legacy-support',level:'cue'}]:[]):o.use==='learn'?[{id:'legacy-method',level:'explanation'}]:[];
   const r=recordAnswer(s,{did:d.did,itemKey,concept:write?KC:o.kind==='sort'?`${KC}.distinguish`:`${KC}.${o.axis}`,helps,verdict,errorTags:['source.legacy']},{now:t});s=r.state;ev=r.ev;
  }
  s=addObs(s,{...o,...(ev?{ev}:{}),...(write?{verdict:legacyVerdict,source:'legacy',first:!o.same}:{})},{now:t});
 }
 return markSeen({...s,seen:{...s.seen,...cleanSeen(raw.seen)}},[...shown,...(raw.recentCards||[]).filter(id).map(k=>`card:${k}`)],{now});
}

// ── 쓰기 한 편 관측. 판정할 수 없으면 null(기록하지 않는다): 세 문장 미만 · 같은 문장 반복 · 의문/청유/미완성 끝이 섞여 「-다」 셈이 흔들림.
// 판정하는 것은 끝맺음 한 KC의 근거(verdict)뿐이다. 자료 설명 과제의 이행은 규칙으로 채점하지 않는다(task:'unassessed').
// · correct: 틀린 끝 0 · 확인된 끝 ≥ 3 · 확인 못 한 끝 ≤ 1 · 자료와 이어짐. incorrect: 틀린 끝이 하나라도. 그 밖은 unassessed(성공도 실패도 아님).
// · 오타 한 문장은 그 문장만 unknown이다(예전에는 글 전체가 「판정 안 함」이 되어 「세 문장 이상」이라는 틀린 안내가 나왔다).
export function observeWrite(text,item=null){
 const sentences=sentencesOf(String(text||'')).filter(s=>s.text.replace(/[\s.!?]/g,''));
 if(sentences.length<MIN_SENTENCES)return null;
 const distinct=new Set(sentences.filter(s=>s.text.trim().split(/\s+/).length>=2).map(s=>s.text.replace(/[\s.!?。！？]+/g,'')));
 if(distinct.size<MIN_SENTENCES)return null;
 // 문제·지문·자료 글을 옮겨 쓴 문장(띄어쓰기·문장부호 빼고 열 글자가 겹침)은 학생이 만든 끝이 아니라 unknown(Fable 설계 P1-4 — 54 지문은 「-다」 문장이다).
 const source=item?compact([item.instruction,item.prompt,...(item.questions||[]),item.label].filter(v=>typeof v==='string').join('')):'';
 const copied=t=>{const c=compact(t);if(!source||c.length<10)return false;for(let i=0;i+10<=c.length;i++)if(source.includes(c.slice(i,i+10)))return true;return false;};
 const ends=sentences.map(s=>endingOf(s.text)),checks=sentences.map(s=>copied(s.text)?{v:'unknown',why:'copied'}:endCheck(s.text));
 const formal=ends.filter(e=>e==='formal').length,polite=ends.filter(e=>e==='polite').length,plain=sentences.filter(s=>endsPlain(s.text)).length;
 const offSentences=sentences.filter((s,i)=>ends[i]==='formal'||ends[i]==='polite').map(s=>s.text);
 // 끝은 「-다」지만 형태 규칙으로 확인되는 틀린 꼴(「많는다」·「증가하다.」·「높아지다.」·「빠르는다」). 끝 꼴만 「-다」라고 성공으로 남기지 않는다(루트 R1).
 const flagged=sentences.filter((s,i)=>checks[i].v==='wrong'&&checks[i].why!=='ending').map(s=>s.text);
 const unknown=sentences.filter((s,i)=>checks[i].v==='unknown').map(s=>s.text),ok=checks.filter(c=>c.v==='ok').length;
 const linked=item?linkedTo(item,text):true,wrong=formal+polite+flagged.length;
 const verdict=wrong?'incorrect':ok>=MIN_SENTENCES&&unknown.length<=1&&linked?'correct':'unassessed';
 const errorTags=[...new Set(checks.filter(c=>c.v==='wrong').map(c=>c.why==='ending'?'ending.off':`form.${c.why}`)),...(linked?[]:['task.unlinked'])];
 return {plain,off:formal+polite,total:sentences.length,formal,polite,flags:flagged.length,axes:offAxes(offSentences),offSentences,flagged,unknown,ok,linked,verdict,errorTags:[...errorTags,...(checks.some(c=>c.why==='copied')?['input.copied']:[])],task:'unassessed'};
}
const compact=t=>String(t||'').replace(/[\s.,!?·「」『』"'()\-~]/g,'');
// 자료와 이어졌는가 — **차단 보조일 뿐 과제 채점이 아니다**(루트 C2). 자료 낱말 하나 + (자료 숫자 하나 또는 자료 낱말 하나 더)가 없으면
// 끝맺음 근거로도 쓰지 않는다. 이어졌다고 과제를 해냈다고 말하지 않는다.
const STOP=new Set(['단위','조사','기관','대상','결과','다음','내용','자료','관한','대한','있는','없는','하는','위한','그리고']);
export function linkedTo(item,text){
 const src=[item.label,...(item.data?.tables||[]).flatMap(t=>[t.caption,...(t.columns||[]),...(t.rows||[]).flat()]),...(item.data?.lists||[]).flatMap(l=>[l.caption,...(l.items||[])]),item.prompt,...(item.questions||[])].filter(v=>typeof v==='string').join(' ');
 const body=String(text||'').replace(/,/g,''),nums=new Set(src.replace(/,/g,'').match(/\d{2,}/g)||[]);
 const words=[...new Set((src.match(/[가-힣]{2,}/g)||[]).filter(w=>!STOP.has(w)))].filter(w=>body.includes(w)||(w.length>=3&&body.includes(w.slice(0,-1))));
 return words.length>=1&&(words.length>=2||[...nums].some(n=>body.includes(n)));
}
// 섞인 문장의 끝에서 형태 축을 짐작한다(형태 확인 문항을 고를 때만 — 능력 판정이 아니다). 움직임/상태는 끝만으로 못 가른다.
export function offAxes(sentences=[]){
 const out=new Set();
 for(const s of sentences){const t=s.replace(/[\s.!?"'」』)]+$/,'');
  if(/(았|었|였|했)(습니다|어요)$/.test(t))out.add('past');else if(/(입니다|이에요|예요)$/.test(t))out.add('noun');else{out.add('verb');out.add('adj');}}
 return AXES.filter(a=>out.has(a));
}
// ── 문장 끝 하나의 판정 범위(10-28 관측 타당도). 목록을 늘리는 대신 형태 규칙으로 확실한 것만 ok·wrong으로 가르고,
// 품사를 알아야만 갈리는 「-다」(「급증하다」)·알아볼 수 없는 끝(오타·의문·「-음」)은 unknown — 성공으로도 실패로도 세지 않는다.
// ok는 「끝이 「-다」 꼴로 확인됨」까지다. 목록 밖 하다 형용사 + 「ㄴ다」(「편리한다」 따위)는 ok로 잘못 셀 수 있어 활용이 맞았다고 말하지 않는다.
const jong=ch=>{const c=(ch||'').charCodeAt(0)-0xAC00;return c>=0&&c<11172?c%28:-1;},jung=ch=>{const c=(ch||'').charCodeAt(0)-0xAC00;return c>=0&&c<11172?Math.floor(c/28)%21:-1;};
const ADJ_NEUN=/(많|높|낮|좋|싫|작|넓|좁|짧|같|깊|괜찮)는다$/; // 「적는다」(적다=쓰다)는 바른 동사 꼴이라 뺀다(Fable F2)
const ADJ_N=/((중요|필요|간단|다양|편리|복잡|충분|부족|가능|유명|일정|분명|확실|적당|위험|안전|건강|행복|불편|비슷|깨끗|조용|유사|동일|심각|활발|풍부|저렴)한|(비싼|빠른|느린|다른|예쁜|바쁜|아픈|기쁜|나쁜|슬픈)|(쉬|어려|가까|무거|가벼|즐거|새로|귀여)운)다$/;
// 자료 설명 글에 자주 나오는 움직임만(형용사 「필요하다·중요하다」 같은 바른 끝을 잡지 않게 목록으로 둔다).
const DICT_VERB=/(증가|감소|차지|변화|사용|이용|참가|참여|발생|선택|조사|응답|공부|생활|운동|이동|거주|방문|구입|구매|판매|생각|준비|시작|노력|설명|진행|결정|활동|성장|확대|상승|하락)하다$|(늘어나|줄어들|오르|내리|떨어지)다$|(?<![가-힣])(늘|줄)다$/; // 「가늘다」 오탐 방지(Fable F2)
const ADJ_OK=/((중요|필요|간단|다양|편리|복잡|충분|부족|가능|유명|일정|분명|확실|적당|위험|안전|건강|행복|불편|편|비슷|깨끗|조용|유사|동일|심각|활발|풍부|저렴)하|많|적|높|낮|크|작|좋|싫|넓|좁|짧|길|같|다르|빠르|느리|비싸|싸|쉽|어렵|가깝|멀|새롭|힘들|즐겁|귀엽|예쁘|바쁘|아프|나쁘|기쁘|슬프)다$/;
const VERB_IDA=/(줄|높|보|늘|붙|먹|속|녹|끓|숙)이다$/; // 「-이다」로 끝나는 움직임 사전형(「줄이다」) — 「두 가지이다」와 못 가른다
export function endCheck(sentence){
 const raw=String(sentence||'').trim();if(!raw)return null;
 const e=endingOf(raw);
 if(e==='formal'||e==='polite')return {v:'wrong',why:'ending'};
 if(!endsPlain(raw))return {v:'unknown',why:'shape'};
 const t=raw.replace(/[\s.!。！"'”’」』)]+$/,''),pre=t.at(-2)||'',before=t.at(-3)||'';
 // 과거·「-겠-」 뒤 「는다」(「증가했는다」)와 「없는다」는 형태만으로 틀림, 「있는다」는 움직임 용법이 있어 판정 못 함(Fable 설계 P1-1).
 if(t.endsWith('는다')){if(/(았|었|였|했|겠|없)는다$/.test(t))return {v:'wrong',why:'past-neun'};if(t.endsWith('있는다'))return {v:'unknown',why:'pos'};
  return jong(before)<=0||jong(before)===8?{v:'wrong',why:'neun-vowel'}:ADJ_NEUN.test(t)?{v:'wrong',why:'adj-neun'}:{v:'ok',why:'verb'};}
 if(t.endsWith('은다'))return {v:'wrong',why:'adj-neun'}; // 「많은다」 — 「-은다」로 끝나는 바른 꼴은 없다
 if(jong(pre)===4)return ADJ_N.test(t)?{v:'wrong',why:'adj-neun'}:{v:'ok',why:'verb'};
 if(jong(pre)===20||jong(pre)===18)return {v:'ok',why:'past'}; // ㅆ(「-었다」·「있다」)·ㅄ(「없다」)
 if(DICT_VERB.test(t)||/[가-힣]되다$/.test(t))return {v:'wrong',why:'dict'}; // 끝의 「-되다」는 피동 움직임(「예상되다」) — 53·54 글에 「안되다」류 형용사는 나오지 않는다
 // 「-아/어지다」 사전형: 「지다」 보조 움직임은 언제나 「-진다」(「멋지다」처럼 앞 음절에 받침이 있는 형용사는 빼고)
 if(pre==='지'&&jong(before)===0&&[0,1,4,6,9,14].includes(jung(before)))return {v:'wrong',why:'aux-dict'};
 if(t.endsWith('이다')&&!VERB_IDA.test(t))return {v:'ok',why:'copula'};
 if(ADJ_OK.test(t))return {v:'ok',why:'adj'};
 return {v:'unknown',why:'pos'};
}
// 「내 문장 바꿔 보기」의 확인: 같은 판정 범위. 맞은 꼴이 곧 활용을 익혔다는 뜻은 아니다 — 근거로는 쓰지 않는다.
export function checkChange(text){
 const c=endCheck(text);if(!c)return null;
 return c.v==='ok'?{ok:true,why:null}:c.v==='wrong'?{ok:false,why:c.why==='ending'?'ending':c.why==='dict'||c.why==='aux-dict'?'dict':c.why==='past-neun'||c.why==='neun-vowel'?'neun':'adj-neun'}:c.why==='shape'?{ok:false,why:'ending'}:{ok:null,why:'unsure'};
}

// ── 형태 문항 채점: 검수된 인정 범위와 정확히 같을 때만 맞음(앞뒤 빈칸·끝 마침표만 무시).
// 다르면 입력의 끝을 같은 판정 범위로 본다. 알아볼 수 있는 꼴(바르든 틀리든 — 「증가했다」·「증가하다」)이면 틀림,
// 알아볼 수 없는 꼴인데 인정 답과 자모 두 개 안쪽이거나 띄어쓰기만 다르면 'typo'(확인 못 함 — 형태 흔들림으로 세지 않는다).
const norm=s=>String(s||'').normalize('NFC').trim().replace(/[.。!]+$/,'').replace(/\s+/g,' ');
const jamo=s=>[...s].flatMap(ch=>{const c=ch.charCodeAt(0)-0xAC00;return c>=0&&c<11172?[`a${Math.floor(c/588)}`,`b${Math.floor(c/28)%21}`,...(c%28?[`c${c%28}`]:[])]:[ch];});
function jamoDistance(a,b){const x=jamo(a),y=jamo(b);let row=y.map((_,j)=>j+1);row.unshift(0);
 for(let i=1;i<=x.length;i++){const next=[i];for(let j=1;j<=y.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(x[i-1]===y[j-1]?0:1));row=next;}return row[y.length];}
export function gradeForm(item,input){
 const v=norm(input);if(!v)return null;
 const accept=item.accept.map(norm);if(accept.includes(v))return true;
 if(accept.some(a=>a.replace(/\s/g,'')===v.replace(/\s/g,'')))return true; // 띄어쓰기만 다르면 끝맺음은 맞다(Fable 설계 P3-14)
 // 끝 두 글자가 인정 답과 같고 앞부분만 조금 다르면(「증거한다」) 끝맺음이 아니라 낱말 오타다.
 const near=accept.filter(a=>jamoDistance(a,v)<=2),c=endCheck(v);
 return near.some(a=>a.slice(-2)===v.slice(-2))||(near.length&&c?.v==='unknown')?'typo':false;
}
export const gradeFind=(item,picks)=>{const a=[...new Set(picks)].sort(),b=[...item.off].sort();return a.length===b.length&&a.every((x,i)=>x===b[i]);};

// ── 근거 모으기
// 원인 근거 창: 마지막 관측이 14일을 넘었으면 비운다(다시 본다). 「끝」과 지연 확인은 60일 기록에서 본다.
// 확인 카드는 풀에서 키로 고정한 몫(약 1/3)만 쓰고, 연습·소개 예시는 나머지에서만 쓴다(확인 근거가 연습 노출에 섞이지 않게).
const hash=s=>[...String(s)].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
export const checkCard=c=>hash(c.key)%3===0;
const after=(obs,o)=>o?obs.filter(x=>x.n>o.n):obs;
export function evidence(state,{now=Date.now()}={}){
 const rows=trailRows(state,now),row=o=>o.ev?rows.get(o.ev):null;
 const past=state.obs.filter(o=>Date.parse(o.at)<=now),last=past.at(-1);
 const stale=!!last&&now-Date.parse(last.at)>STALE_DAYS*DAY,obs=!last||stale?[]:past.filter(o=>now-Date.parse(o.at)<=STALE_DAYS*DAY);
 const history=past.filter(o=>now-Date.parse(o.at)<=HISTORY_DAYS*DAY);
 // 독립 = Trail이 독립이라 한 답. 판정은 Trail 사건의 verdict(끝맺음 KC 근거). 과제 이행은 언제나 미판정이다.
 // 붙여 넣은 바른 글은 흐름에서도 맞음으로 세지 않는다(고쳐 쓰기 통과·새 자료 소비 없음 — 아르곤 s4 B3). 붙여 넣은 틀린 끝은 원인 확인으로 그대로 간다.
 const indep=o=>row(o)?.independent===true,verdict=o=>o.pasted&&o.verdict==='correct'?'unassessed':o.verdict??'unassessed';
 const writesAll=history.filter(o=>o.kind==='write').map(w=>({...w,indep:indep(w),verdict:verdict(w)}));
 const independent=writesAll.filter(w=>w.indep),alone=independent.filter(w=>w.verdict==='correct');
 const lastAlone=alone.at(-1)||null,writes=writesAll.filter(w=>obs.includes(history.find(o=>o.n===w.n)));
 // 차례: 마지막 혼자 성공 또는 「방법을 다 써 본 뒤 다른 날 새로 시작(cycle)」 뒤의 관측.
 const cycle=obs.filter(o=>o.kind==='cycle').at(-1),start=[lastAlone,cycle].filter(Boolean).sort((a,b)=>a.n-b.n).at(-1)||null,round=after(obs,start);
 // 원인 근거는 Trail이 독립이라 한 확인 답만(설명 뒤 연습 카드·형태 연습·본 적 있는 카드는 Trail이 도움 뒤·반복으로 뺀다). 미판정(오타)은 세지 않는다.
 const sorts=round.filter(o=>o.kind==='sort'&&indep(o)),checks=round.filter(o=>o.kind==='form'&&indep(o)&&o.ok!==null);
 const distinguish=sorts.length>=PROBE_CARDS?(sorts.filter(o=>o.ok).length/sorts.length>=2/3?'ok':'miss'):null;
 // 틀린 확인이 하나라도 있으면 흔들림(첫 오답 뒤 둘째 확인은 건너뛴다 — Fable F3). 됨은 확인 2문항 이상이 모두 맞을 때만.
 const form=checks.some(o=>!o.ok)?'miss':checks.length>=PROBE_FORMS?'ok':null;
 const wrongAxes=AXES.filter(a=>round.some(o=>o.kind==='form'&&o.axis===a&&o.ok===false));
 const methods=round.filter(o=>o.kind==='method');
 // 「끝」: 서로 다른 처음 보는 자료 두 편 이상에서 도움 없이 맞음 · 처음과 끝이 하루 이상 · 마지막 독립 시도도 맞음 ·
 // 그중 하나는 마지막 방법·도움보다 하루 이상 뒤(설명 직후 성공만으로 끝내지 않는다).
 // 도움 = 방법 표시 · 도움 단계·고쳐 쓰기 쓰기 · 방법 장면 안의 연습 답(방법을 끝내기 전에 떠났어도 — 아르곤 s4 C1).
 const isHelp=o=>o.kind==='semantic'&&(o.stage!=='analysis'||o.result==='focus')||o.kind==='method'||(o.kind==='write'&&(o.support>0||o.mode==='revise'))||((o.kind==='sort'||o.kind==='form')&&o.use==='learn');
 const helpAt=history.filter(isHelp).map(o=>Date.parse(o.at));
 // 「하루 뒤」는 마지막 방법·도움 전체에 견준다 — 끝난 뒤 새 도움을 받았으면 하루 뒤 성공으로 다시 확인한다(아르곤 B1).
 const lastHelp=helpAt.length?Math.max(...helpAt):null,delayed=w=>lastHelp==null||Date.parse(w.at)-lastHelp>=DAY;
 // 독립 시도가 한 번 틀리면(지연 확인 실패 등) 그 앞의 성공으로 끝을 되살리지 않는다 — 그 뒤의 성공만 센다(루트 반례 retention).
 // 마지막 독립 실패와 마지막 방법·도움 가운데 늦은 것 뒤의 성공만 센다 — 도움 앞의 옛 성공을 합치지 않는다(아르곤 s4 B1).
 const lastMiss=[...independent].reverse().find(w=>w.verdict==='incorrect'),helpObs=history.filter(isHelp).at(-1);
 const cut=Math.max(lastMiss?.n||0,helpObs?.n||0),since=alone.filter(w=>w.n>cut);
 const days=since.map(w=>Date.parse(w.at)),items=[...new Set(since.map(w=>w.itemId))];
 const done=items.length>=2&&Math.max(...days)-Math.min(...days)>=DAY&&independent.at(-1)?.verdict==='correct'&&since.some(delayed);
 const lastFresh=writesAll.filter(w=>w.first).at(-1)||null;
 return {obs,stale,writes,writesAll,lastWrite:writes.at(-1)||null,independent,alone,lastAlone,lastFresh,round,distinguish,form,wrongAxes,methods,done,aloneItems:items};
}

// 방법 결정(ask.choose의 decide): 알려진 답이 먼저, 모르면 글에서 본 사전 기대. 구별이 흔들리면 그것부터, 형태가 틀리면 형태, 아니면 적용.
export function decideMethod(answers,prior){const d=answers.distinguish??prior.distinguish,f=answers.form??prior.form;return d==='miss'?'contrast':f==='miss'?'forms':'apply';}
export function priorOf(write){return write&&write.plain>0?{distinguish:'ok',form:'ok'}:{distinguish:'miss',form:'ok'};}
// 그 방법을 할 검수 재료가 있는가(아르곤 A1). 적용은 내 문장 바꾸기만으로도 할 수 있다.
const canDo=(m,bank)=>m==='contrast'?bank.pool.filter(c=>!checkCard(c)).length>=6:m==='forms'?bank.forms.some(f=>f.use==='learn'):true;

/** 다음 장면 하나. bank: {open53:[문항], open54?:[문항], pool:[카드], forms:[형태 문항], finds:[끝 찾기]} — 모두 검수 통과분.
 *  돌려주는 꼴: {scene, why, …장면에 필요한 값}. why는 시험·기록용(학생에게 가설 이름을 보이지 않는다). */
export function next(state,bank,{now=Date.now(),seed=1}={}){
 const s=readState(state,{now}),e=evidence(s,{now});
 // 처음 보는 자료 = 이 기기에서 한 번도 보이지 않은 것(53 다섯 → 54 다섯). 혼자 해냈는지 새로 확인할 때만 쓴다.
 const fresh=[...bank.open53,...(bank.open54||[])].filter(it=>!s.seen[it.id]&&!s.drafts[it.id]?.checkedAt);
 // 지금 앉은 자리의 쓰기(관측 사이 2시간 넘는 틈으로 나눔)
 const past=s.obs.filter(o=>Date.parse(o.at)<=now);let k=past.length;
 while(k>0&&(k===past.length?now:Date.parse(past[k].at))-Date.parse(past[k-1].at)<=SITTING_GAP)k--;
 const here=past.slice(k),sitting=here.filter(o=>o.kind==='write'),sitFresh=sitting.filter(o=>o.first).length;
 const enough=sitting.length>=SITTING_WRITES;
 const check=why=>enough?{scene:'rest',why:'enough'}:sitFresh>=SITTING_FRESH?{scene:'rest',why:'later'}:fresh[0]?{scene:'write',itemId:fresh[0].id,support:0,mode:'new',why}:{scene:'rest',why:'no-items'};
 const lw=e.lastWrite;
 // 끝난 학생: 마지막 쓰기가 무엇이든(지연 확인이 미판정·고쳐 쓰기였어도) 지연 확인 간격을 따른다. 새 자료가 없으면 약속 대신 자료 없음(아르곤 B3·루트 반례).
 if(e.done)return !fresh.length?{scene:'rest',why:'no-items'}:due(e,now)?check('delayed'):{scene:'rest',why:'done'};
 if(!lw)return check(e.stale?'stale':'start');
 // 마지막 쓰기가 혼자 성공(처음 보는 자료 · 도움 없음 · 끝맺음 KC correct)
 if(lw.indep&&lw.verdict==='correct'){
  if(now-Date.parse(lw.at)>=DAY)return check('recheck');
  return {scene:'rest',why:'alone-once'};
 }
 const lastMethod=e.methods.at(-1)||null,writesAfterMethod=lastMethod?after(e.writes,lastMethod):[];
 // 고쳐 쓸 글: 이번 차례에 마지막으로 틀린 쓰기의 자료(같은 자료라 Trail상 반복 — 새 근거가 아니다).
 // 이번 차례에서 마지막으로 맞지 않은 쓰기(틀림·확인 못 함). 다른 날 이미 고친 글로 돌아가지 않게 차례 안에서만 찾는다(Fable 최종 F1).
 const roundWrites=e.writes.filter(w=>e.round.some(o=>o.n===w.n)),failed=[...roundWrites].reverse().find(w=>w.verdict!=='correct')||lw;
 const revise=(support,why)=>enough?{scene:'rest',why:'enough'}:{scene:'write',itemId:failed.itemId,support,mode:'revise',why};
 // 도움 받고 맞음(고쳐 쓰기·도움 단계): 이 자리에서 처음 보는 자료로 혼자 한 번 확인, 자리 상한이면 다음에
 if(lw.verdict==='correct')return check('check-now');
 // 방법 뒤: 고쳐 쓰기 → 실패 1번이면 도움을 한 단 올려 다시, 2번이면 다른 방법(재료가 있는 것만, 셋 다 썼으면 쉼)
 if(lastMethod){
  // 방법 뒤에 맞지 않은 쓰기(틀림·확인 못 함)를 센다 — 확인 못 한 고쳐 쓰기만 되풀이하며 자리를 채우지 않게(아르곤 B2).
  const fails=writesAfterMethod.filter(w=>w.verdict!=='correct');
  if(!fails.length)return revise(lastMethod.method==='apply'?1:2,'after-method');
  if(fails.length===1)return revise(Math.min(2,fails[0].support+1),'retry-more-help');
  const tried=new Set(e.methods.map(m=>m.method));
  const want=[e.distinguish==='miss'?'contrast':null,e.form==='miss'?'forms':null,'apply','forms','contrast'].filter(Boolean);
  const nextMethod=want.find(m=>!tried.has(m)&&canDo(m,bank));
  if(nextMethod)return methodScene(nextMethod,'switch',s,bank,e,{seed});
  // 셋 다 써도 안 되면 오늘은 쉬고, 다른 자리에서 처음 보는 자료로 고리를 다시 시작한다(같은 설명을 끝없이 되풀이하지 않음).
  return here.includes(lastMethod)?{scene:'rest',why:'tried-all'}:check('restart');
 }
 const checksLeft=bank.forms.filter(f=>f.use==='check'&&!s.seen[f.id]);
 const cardsLeft=bank.pool.filter(c=>checkCard(c)&&!s.seen[`card:${c.key}`]);
 const probes=after(e.obs,lw).filter(o=>o.kind==='probe');
 // 끝을 확인하지 못한 글(틀린 끝 없음): 같은 글을 다시 쓰게 하지 않고, 검수된 짧은 형태 확인으로 잇는다. 확인할 것이 없으면 다음에.
 if(lw.verdict==='unassessed'){
  // 끝은 모두 확인됐는데 과제와 이어지는지만 모르는 글은 끝 꼴 확인·고쳐 쓰기를 시키지 않는다 — 이 자리는 쉬고 다른 자리에 새 자료(아르곤 s4 B2).
  if(lw.linked===false&&lw.unknown<=1&&!lw.pasted)return here.some(o=>o.n===lw.n)?{scene:'rest',why:'later'}:check('again');
  if(e.form==='miss')return methodScene('forms','decided',s,bank,e,{seed});
  if(!e.form&&!probes.length&&checksLeft.length>=PROBE_FORMS)return probeScene('form',s,bank,lw,{seed});
  // 같은 자리: 한 번은 같은 자료를 고쳐 써 보게 하고(확인 못 한 문장을 보임 — 반복이라 근거 아님), 그다음은 쉼. 다른 자리면 새 자료 하나.
  if(!here.some(o=>o.n===lw.n))return check('again');
  return lw.mode==='revise'?{scene:'rest',why:'later'}:revise(1,'unassessed');
 }
 // 원인 확인: 이번 실패 뒤 확인은 최대 둘(구별·형태). 이미 답한 축은 answers에 들어가 ask.rank가 건너뛴다.
 const prior=priorOf(lw),answers={...(e.distinguish?{distinguish:e.distinguish}:{}),...(lw.flags?{form:'miss'}:e.form?{form:e.form}:{})};
 const questions=[...(cardsLeft.length>=PROBE_CARDS?[{id:'distinguish',kind:'follow_up',options:[{id:'ok'},{id:'miss'}]}]:[]),...(checksLeft.length>=PROBE_FORMS?[{id:'form',kind:'follow_up',options:[{id:'ok'},{id:'miss'}]}]:[])];
 // 글에 「-다」가 섞여 있으면 구별보다 형태·적용을 먼저 의심한다 — 질문 순서가 같은 값일 때의 차례다.
 if(lw.plain>0)questions.reverse();
 {
  // 확인에서 이미 흔들림(miss)을 찾았으면 그것부터 연습한다 — 더 묻지 않는다.
  const found=Object.values(answers).includes('miss');
  const choice=Ask.choose({questions,decide:a=>decideMethod(a,prior),answers,budget:2,usedToday:found?2:probes.length});
  if(choice.status==='ask')return probeScene(choice.question.id,s,bank,lw,{seed});
 }
 const want=decideMethod(answers,prior);
 return methodScene(canDo(want,bank)?want:METHODS.find(m=>canDo(m,bank)),'decided',s,bank,e,{seed});
}
// 끝 뒤 지연 확인: 마지막 혼자 성공 + 7·14·30일(끝 뒤 성공이 늘수록 길게 — 운영 가정).
// 간격은 마지막으로 새 자료를 쓴 때부터 잰다(미판정으로 끝난 지연 확인 뒤 바로 또 새 자료를 내지 않게 — 아르곤 B3).
function due(e,now){const k=Math.max(0,e.alone.length-2),from=Math.max(Date.parse(e.lastAlone.at),e.lastFresh?Date.parse(e.lastFresh.at):0);return now-from>=RECHECK_DAYS[Math.min(k,RECHECK_DAYS.length-1)]*DAY;}
function probeScene(probe,s,bank,lw,{seed}){
 if(probe==='distinguish'){
  const left=bank.pool.filter(c=>checkCard(c)&&!s.seen[`card:${c.key}`]);
  const deck=drillDeck(left,{seed,size:PROBE_CARDS,focus:{id:'ending-53',recentCards:s.recentCards}});
  return {scene:'probe',probe,cards:deck.map(c=>c.key),why:'unknown-cause'};
 }
 const axes=lw.axes||[],left=bank.forms.filter(f=>f.use==='check'&&!s.seen[f.id]);
 const pick=[...left.filter(f=>axes.includes(f.axis)),...left.filter(f=>!axes.includes(f.axis))];
 const chosen=[];for(const f of pick){if(chosen.length>=PROBE_FORMS)break;if(!chosen.some(c=>c.axis===f.axis)||pick.length<=PROBE_FORMS)chosen.push(f);}
 for(const f of pick){if(chosen.length>=PROBE_FORMS)break;if(!chosen.includes(f))chosen.push(f);}
 return {scene:'probe',probe,forms:chosen.map(f=>f.id),why:lw.verdict==='unassessed'?'unassessed':'unknown-cause'};
}
function methodScene(method,why,s,bank,e,{seed}){
 if(method==='contrast'){const learn=bank.pool.filter(c=>!checkCard(c));return {scene:'method',method,why,cards:drillDeck(learn,{seed,size:6,focus:{id:'ending-53',recentCards:s.recentCards,practice:practiceOf(e)}}).map(c=>c.key)};}
 if(method==='forms'){
  const learn=bank.forms.filter(f=>f.use==='learn'),weak=e.wrongAxes.length?e.wrongAxes:AXES;
  const order=[...learn].sort((a,b)=>(weak.includes(b.axis)-weak.includes(a.axis))||((s.seen[a.id]?1:0)-(s.seen[b.id]?1:0)));
  // 헷갈린 축마다 몫(4 ÷ 축 수, 올림)만큼 먼저 배정하고, 남는 자리는 순서대로 채운다(아르곤 A5).
  const chosen=[],quota=Math.ceil(LEARN_FORMS/weak.length);for(const ax of weak)for(const f of order){if(chosen.filter(c=>c.axis===ax).length>=quota)break;if(f.axis===ax&&!chosen.includes(f))chosen.push(f);}
  for(const f of order){if(chosen.length>=LEARN_FORMS)break;if(!chosen.includes(f))chosen.push(f);}
  return {scene:'method',method,why,forms:chosen.slice(0,LEARN_FORMS).map(f=>f.id),axes:weak};
 }
 const finds=bank.finds.filter(f=>f.use==='learn'),find=finds.find(f=>!s.seen[f.id])||finds[0]||null;
 return {scene:'method',method,why,find:find?.id||null,mineFrom:e.lastWrite?.itemId||null};
}
// drillDeck의 가중치 입력(유형별 최근 정오)을 이번 차례의 카드 첫 선택으로 만든다.
function practiceOf(e){return Object.fromEntries(BINS.map(bin=>[bin,e.round.filter(o=>o.kind==='sort'&&o.bin===bin).slice(-6).map(o=>({at:o.at,correct:o.ok}))]));}
/** 장면에서 학생이 보는 사실 한 줄의 숫자(B 장면). 가설 이름은 넣지 않는다. */
export const factsOf=w=>({total:w.total,off:w.off,formal:w.formal,polite:w.polite});
export {sentencesOf,endingOf};
