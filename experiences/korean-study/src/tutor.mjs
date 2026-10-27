// 한국어 공부 · AI 튜터의 판단(README §2). 화면 없는 순수 함수 — app.mjs가 그리고 시험이 직접 부른다.
// · 근거: 이 기기의 관측(obs)뿐이다. 쓰기의 문장 끝 꼴 · 카드 첫 선택 · 형태 문항 첫 입력 · 끝 찾기 첫 선택. AI 호출 없음(규칙).
// · 가설(구별 · 형태 · 적용 · 도움 뒤에만)은 저장하지 않고 매번 근거에서 다시 계산한다. 한 답은 그 문항의 근거일 뿐이고
//   (atlas/education.js) 능력·실력·성향으로 올리지 않는다.
// · 근거가 모자라면 Atlas Core ask.choose()가 「방법 결정을 바꾸는 확인 하나」를 고른다(새 엔진·선택기 없음).
import Ask from '../../../atlas/ask.js';
import {sentencesOf,endingOf} from '../../synk-world-app/world-writing-check.mjs';
import {drillDeck,endsPlain} from '../../synk-world-app/world-writing-focus.mjs';

export const VERSION=1,OBS_MAX=80,STALE_DAYS=14,MIN_SENTENCES=3,PROBE_CARDS=3,PROBE_FORMS=2,LEARN_FORMS=4,MINE_MAX=3;
const DAY=86400000,BINS=['formal','polite','plain'],AXES=['verb','adj','noun','past'],METHODS=['apply','forms','contrast'];
const KINDS=['write','sort','form','find','change','method','probe'];
export const storeKey=owner=>`synk.study.v1:${typeof owner==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(owner)?owner:'guest'}`;
const validAt=(at,now)=>typeof at==='string'&&Number.isFinite(Date.parse(at))&&Date.parse(at)<=now;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_:-]{1,120}$/.test(v);
const nat=v=>Number.isInteger(v)&&v>=0&&v<=500;

// ── 기록 읽기: 깨진 값·모르는 종류·미래 시각은 버린다. 학생 글 원문은 drafts에만 있다.
function cleanObs(o,now){
 if(!o||typeof o!=='object'||!KINDS.includes(o.kind)||!validAt(o.at,now))return null;
 const base={at:o.at,kind:o.kind};
 if(o.kind==='write')return id(o.itemId)&&[0,1,2].includes(o.support)&&['plain','off','total','formal','polite'].every(k=>nat(o[k]))?{...base,itemId:o.itemId,support:o.support,same:o.same===true,plain:o.plain,off:o.off,total:o.total,formal:o.formal,polite:o.polite,flags:nat(o.flags)?o.flags:0,axes:Array.isArray(o.axes)?AXES.filter(a=>o.axes.includes(a)):[]}:null;
 if(o.kind==='sort')return id(o.card)&&BINS.includes(o.bin)&&typeof o.ok==='boolean'?{...base,card:o.card,bin:o.bin,ok:o.ok,use:o.use==='check'?'check':'learn'}:null;
 if(o.kind==='form')return id(o.id)&&AXES.includes(o.axis)&&['learn','check'].includes(o.use)&&typeof o.ok==='boolean'?{...base,id:o.id,axis:o.axis,use:o.use,ok:o.ok}:null;
 if(o.kind==='find')return id(o.id)&&typeof o.ok==='boolean'?{...base,id:o.id,ok:o.ok}:null;
 if(o.kind==='change')return typeof o.ok==='boolean'?{...base,ok:o.ok}:null;
 if(o.kind==='method')return METHODS.includes(o.method)?{...base,method:o.method}:null;
 if(o.kind==='probe')return ['distinguish','form'].includes(o.probe)?{...base,probe:o.probe}:null;
 return null;
}
export function readState(raw,{now=Date.now()}={}){
 const v=raw&&typeof raw==='object'&&raw.v===VERSION?raw:{};
 const obs=(Array.isArray(v.obs)?v.obs:[]).map(o=>cleanObs(o,now)).filter(Boolean).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-OBS_MAX);
 const drafts=Object.fromEntries(Object.entries(v.drafts&&typeof v.drafts==='object'?v.drafts:{}).filter(([k,d])=>id(k)&&d&&typeof d.text==='string'&&d.text.length<=4000).map(([k,d])=>[k,{text:d.text,updatedAt:validAt(d.updatedAt,now)?d.updatedAt:null,checkedAt:validAt(d.checkedAt,now)?d.checkedAt:null}]));
 const seen=Object.fromEntries(Object.entries(v.seen&&typeof v.seen==='object'?v.seen:{}).filter(([k,at])=>id(k)&&validAt(at,now)));
 const recentCards=(Array.isArray(v.recentCards)?v.recentCards:[]).filter(id).slice(-12);
 const scene=v.scene&&typeof v.scene==='object'&&typeof v.scene.id==='string'?v.scene:null;
 return {v:VERSION,obs,drafts,seen,recentCards,scene};
}
export const addObs=(state,o,{now=Date.now()}={})=>{const c=cleanObs({...o,at:o.at||new Date(now).toISOString()},now);return c?{...state,obs:[...state.obs,c].slice(-OBS_MAX)}:state;};
export const markSeen=(state,ids,{now=Date.now()}={})=>({...state,seen:{...Object.fromEntries(ids.filter(id).map(i=>[i,new Date(now).toISOString()])),...state.seen}});

// ── 쓰기 한 편 관측. 판정할 수 없으면 null(기록하지 않는다): 세 문장 미만 · 같은 문장 반복 · 의문/청유/미완성 끝이 섞여 「-다」 셈이 흔들림.
export function observeWrite(text){
 const sentences=sentencesOf(String(text||'')).filter(s=>s.text.replace(/[\s.!?]/g,''));
 if(sentences.length<MIN_SENTENCES)return null;
 const distinct=new Set(sentences.filter(s=>s.text.trim().split(/\s+/).length>=2).map(s=>s.text.replace(/[\s.!?。！？]+/g,'')));
 if(distinct.size<MIN_SENTENCES)return null;
 const ends=sentences.map(s=>endingOf(s.text));
 const formal=ends.filter(e=>e==='formal').length,polite=ends.filter(e=>e==='polite').length,plain=sentences.filter(s=>endsPlain(s.text)).length;
 // 「-다」도 「-습니다/-아요」도 아닌 끝(의문·청유·미완성)이 있으면 섞인 정도를 말할 수 없다.
 if(plain+formal+polite<sentences.length)return null;
 const offSentences=sentences.filter((s,i)=>ends[i]==='formal'||ends[i]==='polite').map(s=>s.text);
 // 끝은 「-다」지만 규칙으로 확인되는 틀린 꼴(「많는다」·「증가하다.」). 끝 꼴만 「-다」라고 성공으로 남기지 않는다(루트 R1).
 const flagged=sentences.filter(s=>endsPlain(s.text)&&checkChange(s.text)?.ok===false).map(s=>s.text);
 return {plain,off:formal+polite,total:sentences.length,formal,polite,flags:flagged.length,axes:offAxes(offSentences),offSentences,flagged};
}
// 섞인 문장의 끝에서 형태 축을 짐작한다(형태 확인 문항을 고를 때만 — 능력 판정이 아니다). 움직임/상태는 끝만으로 못 가른다.
export function offAxes(sentences=[]){
 const out=new Set();
 for(const s of sentences){const t=s.replace(/[\s.!?"'」』)]+$/,'');
  if(/(았|었|였|했)(습니다|어요)$/.test(t))out.add('past');else if(/(입니다|이에요|예요)$/.test(t))out.add('noun');else{out.add('verb');out.add('adj');}}
 return AXES.filter(a=>out.has(a));
}
// 「내 문장 바꿔 보기」의 확인: 끝 꼴(endsPlain)과 흔한 틀린 꼴. 맞은 꼴이 곧 활용을 익혔다는 뜻은 아니다 — 근거(obs)로는 쓰지 않는다.
const ADJ_NEUN=/(많|높|낮|좋|싫|작|넓|좁|짧)는다[.!]?\s*$/; // 「적는다」(적다=쓰다)는 바른 동사 꼴이라 뺀다(Fable F2)
// 자료 설명 글에 자주 나오는 움직임만(형용사 「필요하다·중요하다」 같은 바른 끝을 잡지 않게 목록으로 둔다).
const DICT_VERB=/(증가|감소|차지|변화|사용|이용|참가|참여|발생|선택|조사|응답|공부|생활|운동|이동|거주|방문|구입|구매|판매|생각|준비|시작|노력|설명|진행|결정|활동|성장|확대|상승|하락)하다[.!]?\s*$|(늘어나|줄어들|오르|내리|떨어지)다[.!]?\s*$|(?<![가-힣])(늘|줄)다[.!]?\s*$/; // 「가늘다」 오탐 방지(Fable F2)
export function checkChange(text){
 const value=String(text||'').trim();if(!value)return null;
 if(!endsPlain(value))return {ok:false,why:'ending'};
 if(ADJ_NEUN.test(value))return {ok:false,why:'adj-neun'};
 if(DICT_VERB.test(value))return {ok:false,why:'dict'};
 return {ok:true,why:null};
}

// ── 형태 문항 채점: 검수된 인정 범위와 정확히 같을 때만 맞음(앞뒤 빈칸·끝 마침표만 무시).
const norm=s=>String(s||'').normalize('NFC').trim().replace(/[.。!]+$/,'').replace(/\s+/g,' ');
export const gradeForm=(item,input)=>{const v=norm(input);return v?item.accept.some(a=>norm(a)===v):null;};
export const gradeFind=(item,picks)=>{const a=[...new Set(picks)].sort(),b=[...item.off].sort();return a.length===b.length&&a.every((x,i)=>x===b[i]);};

// ── 근거 모으기
// 근거 창: 마지막 근거가 14일을 넘었으면 비운다(다시 본다). 아니면 14일 안의 관측만.
function window(state,now){const obs=state.obs.filter(o=>Date.parse(o.at)<=now);const last=obs.at(-1);if(!last||now-Date.parse(last.at)>STALE_DAYS*DAY)return {obs:[],stale:!!last};return {obs:obs.filter(o=>now-Date.parse(o.at)<=STALE_DAYS*DAY),stale:false};}
const after=(obs,o)=>o?obs.filter(x=>Date.parse(x.at)>Date.parse(o.at)||(x.at===o.at&&obs.indexOf(x)>obs.indexOf(o))):obs;
export function evidence(state,{now=Date.now()}={}){
 const {obs,stale}=window(state,now),writes=obs.filter(o=>o.kind==='write');
 const unaided=w=>w.support===0&&!w.same;
 const ok=w=>w.off===0&&!w.flags,alone=writes.filter(w=>unaided(w)&&ok(w));
 const lastAlone=alone.at(-1)||null,round=after(obs,lastAlone);
 // 가설 근거는 확인(C)의 첫 선택만 — 설명을 본 뒤 고른 연습 카드(D1)·형태 연습(D2)은 학습 노출이지 원인 근거가 아니다.
 const sorts=round.filter(o=>o.kind==='sort'&&o.use==='check'),checks=round.filter(o=>o.kind==='form'&&o.use==='check');
 const distinguish=sorts.length>=PROBE_CARDS?(sorts.filter(o=>o.ok).length/sorts.length>=2/3?'ok':'miss'):null;
 // 틀린 확인이 하나라도 있으면 흔들림(첫 오답 뒤 둘째 확인은 건너뛴다 — Fable F3). 됨은 확인 2문항 이상이 모두 맞을 때만.
 const form=checks.some(o=>!o.ok)?'miss':checks.length>=PROBE_FORMS?'ok':null;
 const wrongAxes=AXES.filter(a=>round.some(o=>o.kind==='form'&&o.axis===a&&!o.ok));
 const methods=round.filter(o=>o.kind==='method');
 return {obs,stale,writes,lastWrite:writes.at(-1)||null,alone,lastAlone,round,distinguish,form,wrongAxes,methods,
  aloneItems:[...new Set(alone.map(w=>w.itemId))]};
}

// 방법 결정(ask.choose의 decide): 알려진 답이 먼저, 모르면 글에서 본 사전 기대. 구별이 흔들리면 그것부터, 형태가 틀리면 형태, 아니면 적용.
export function decideMethod(answers,prior){const d=answers.distinguish??prior.distinguish,f=answers.form??prior.form;return d==='miss'?'contrast':f==='miss'?'forms':'apply';}
export function priorOf(write){return write&&write.plain>0?{distinguish:'ok',form:'ok'}:{distinguish:'miss',form:'ok'};}

/** 다음 장면 하나. bank: {open53:[문항], pool:[카드], forms:[형태 문항], finds:[끝 찾기]} — 모두 검수 통과분.
 *  돌려주는 꼴: {scene, why, …장면에 필요한 값}. why는 시험·기록용(학생에게 가설 이름을 보이지 않는다). */
export function next(state,bank,{now=Date.now(),seed=1}={}){
 const s=readState(state,{now}),e=evidence(s,{now});
 const fresh=bank.open53.filter(it=>!s.drafts[it.id]?.checkedAt&&!e.writes.some(w=>w.itemId===it.id)&&!s.obs.some(o=>o.kind==='write'&&o.itemId===it.id));
 const write=(support,why)=>fresh[0]?{scene:'write',itemId:fresh[0].id,support,why}:{scene:'rest',why:'no-items'};
 if(!e.lastWrite)return write(0,e.stale?'stale':'start');
 const lw=e.lastWrite;
 // 혼자 성공(처음 보는 자료 · 도움 없음 · 끝이 모두 -다)
 if(lw.support===0&&!lw.same&&lw.off===0&&!lw.flags){
  const days=e.alone.map(w=>Date.parse(w.at));
  if(e.aloneItems.length>=2&&Math.max(...days)-Math.min(...days)>=DAY)return {scene:'rest',why:'done'};
  if(now-Date.parse(lw.at)>=DAY)return write(0,'recheck');
  return {scene:'rest',why:'alone-once'};
 }
 const methods=e.methods,lastMethod=methods.at(-1)||null;
 const writesAfterMethod=lastMethod?after(e.writes,lastMethod):[];
 // 도움 뒤 성공: 지원을 한 단 낮춰 처음 보는 자료로
 if(lw.off===0&&!lw.flags)return write(Math.max(0,(lw.same?2:lw.support)-1),'fade');
 // 방법 뒤 실패: 1번이면 도움을 한 단 올려 다시, 2번이면 다른 방법(셋 다 썼으면 쉼)
 if(lastMethod){
  const fails=writesAfterMethod.filter(w=>w.off>0||w.flags>0).length;
  if(fails===0)return write(lastMethod.method==='apply'?1:2,'after-method');
  if(fails===1)return write(Math.min(2,lw.support+1),'retry-more-help');
  const tried=new Set(methods.map(m=>m.method)),order=['apply','forms','contrast','apply','forms'];
  const nextMethod=order.slice(order.indexOf(lastMethod.method)+1).find(m=>!tried.has(m));
  return nextMethod?methodScene(nextMethod,'switch',s,bank,e,{seed}):{scene:'rest',why:'tried-all'};
 }
 // 원인 확인: 이번 실패 뒤 확인을 한 번 했으면 더 묻지 않고 결정한다(한 실패에 확인 하나).
 const prior=priorOf(lw),answers={...(e.distinguish?{distinguish:e.distinguish}:{}),...(lw.flags?{form:'miss'}:e.form?{form:e.form}:{})};
 // 한 실패에 확인은 최대 둘(구별·형태). 이미 답한 축은 answers에 들어가 ask.rank가 건너뛴다.
 const probes=after(e.obs,lw).filter(o=>o.kind==='probe').length;
 const checksLeft=bank.forms.filter(f=>f.use==='check'&&!s.seen[f.id]);
 const questions=[{id:'distinguish',kind:'follow_up',options:[{id:'ok'},{id:'miss'}]},...(checksLeft.length>=PROBE_FORMS?[{id:'form',kind:'follow_up',options:[{id:'ok'},{id:'miss'}]}]:[])];
 // 글에 「-다」가 섞여 있으면 구별보다 형태·적용을 먼저 의심한다 — 질문 순서가 같은 값일 때의 차례다.
 if(lw.plain>0)questions.reverse();
 {
  // 확인에서 이미 흔들림(miss)을 찾았으면 그것부터 연습한다 — 더 묻지 않는다.
  const found=Object.values(answers).includes('miss');
  const choice=Ask.choose({questions,decide:a=>decideMethod(a,prior),answers,budget:2,usedToday:found?2:probes});
  if(choice.status==='ask')return probeScene(choice.question.id,s,bank,lw,{seed});
 }
 return methodScene(decideMethod(answers,prior),'decided',s,bank,e,{seed});
}
function probeScene(probe,s,bank,lw,{seed}){
 if(probe==='distinguish'){
  const deck=drillDeck(bank.pool,{seed,size:PROBE_CARDS,focus:{id:'ending-53',recentCards:s.recentCards}});
  return {scene:'probe',probe,cards:deck.map(c=>c.key),why:'unknown-cause'};
 }
 const axes=lw.axes||[],left=bank.forms.filter(f=>f.use==='check'&&!s.seen[f.id]);
 const pick=[...left.filter(f=>axes.includes(f.axis)),...left.filter(f=>!axes.includes(f.axis))];
 const chosen=[];for(const f of pick){if(chosen.length>=PROBE_FORMS)break;if(!chosen.some(c=>c.axis===f.axis)||pick.length<=PROBE_FORMS)chosen.push(f);}
 for(const f of pick){if(chosen.length>=PROBE_FORMS)break;if(!chosen.includes(f))chosen.push(f);}
 return {scene:'probe',probe,forms:chosen.map(f=>f.id),why:'unknown-cause'};
}
// 그 방법을 할 검수 재료가 있는가(아르곤 A1). 적용은 내 문장 바꾸기만으로도 할 수 있다.
const canDo=(m,bank)=>m==='contrast'?bank.pool.length>=6:m==='forms'?bank.forms.some(f=>f.use==='learn'):true;
function methodScene(want,why,s,bank,e,{seed}){
 const method=canDo(want,bank)?want:['apply','forms','contrast'].find(m=>canDo(m,bank));
 if(method==='contrast')return {scene:'method',method,why,cards:drillDeck(bank.pool,{seed,size:6,focus:{id:'ending-53',recentCards:s.recentCards,practice:practiceOf(e)}}).map(c=>c.key)};
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
