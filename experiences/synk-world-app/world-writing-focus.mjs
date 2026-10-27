// 쓰기 「한 가지 고치기」(2026-10-27 · qa/writing-focus-20261027/설계.md): TOPIK II 53번 글의 끝맺음(「-습니다/-아요」 대신 「-다」).
// 화면 없는 순수 함수만 둔다 — 쓰기 연습(world-writing-practice.mjs)이 그리고, 시험이 직접 부른다.
// · 약점: 규칙 점검(world-writing-check.mjs)의 style 지적. AI를 부르지 않고 이 기기에서만 잰다. 감점·실력 확정이 아니다.
// · 연습 카드: 검수를 통과한 51·52 문항의 지문(문제 글) 문장만 쓴다 — 51은 그 글의 문체, 52는 「-다」. 새 한국어 문장을 만들지 않고,
//   예시답(답 문장)은 쓰지 않는다 — 학생이 혼자 다시 쓸 53번의 답을 미리 보여 주지 않게.
// · 결과: found(처음 잡힘) · retry(다시 잡힘) · helped(도움 받고 고침) · independent(다른 문항에서 도움 없이 해냄).
//   「혼자 해냄」은 그 글의 문장 끝 꼴에 대한 사실일 뿐 쓰기 능력 판정이 아니다. Trail 능력 근거로 올리지 않고,
//   Core에는 호스트 사실(practiceNeed)로만 넘긴다(atlas/learning.js recommendActivities — Core는 저장·능력 연결을 하지 않는다).
import {sentencesOf,endingOf} from './world-writing-check.mjs';

export const FOCUS_ID='ending-53',FOCUS_TYPE=53,FOCUS_LOG_MAX=20,DRILL_SIZE=6,MIN_PLAIN=3,MY_MAX=3,NEED_DAYS=7;
const BINS=Object.freeze(['formal','polite','plain']);
const KINDS=Object.freeze(['found','retry','helped','independent']);
const DAY=86400000;
const validAt=at=>typeof at==='string'&&Number.isFinite(Date.parse(at));
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const cardKey=card=>card.key||`${card.itemId}:${card.text}`;

// 지문 한 줄([글, {blank}, 글…])에서 빈칸이 없는 완성 문장만. 빈칸 자리는 \u0000으로 막아 그 문장을 뺀다.
function passageSentences(item){
 const out=[];
 for(const line of item.passage||[]){const text=line.map(part=>typeof part==='string'?part:'\u0000').join('');
  for(const s of sentencesOf(text))if(!s.text.includes('\u0000'))out.push(s.text);}
 return out;
}
/** 연습 카드 풀: 열린(검수 통과) 51·52 문항 지문의 완성 문장 가운데 문장 끝이 그 글의 문체와 같은 것만(「올림」 같은 줄은 빠진다). */
export function drillPool(open=[]){
 const pool=[];
 for(const item of open){
  if(item?.review?.status!=='passed'||![51,52].includes(item.type)||!BINS.includes(item.style))continue;
  for(const [i,text] of passageSentences(item).entries())if(endingOf(text)===item.style&&[...text].length>=8)pool.push({key:`${item.id}:${i}`,text,bin:item.style,itemId:item.id});
 }
 return pool;
}
// 씨앗으로 섞기(같은 씨앗 = 같은 판). Math.random을 쓰지 않아 시험이 판을 다시 만든다.
const mix=(list,seed)=>{let s=(Number(seed)>>>0)||1;const out=[...list];for(let i=out.length-1;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;};
/** 유형별 우선순위: 최근 글에서 섞어 쓴 문체 → 그 뒤 카드에서 실제 헷갈린 유형. 최근 정답은 비중을 낮춘다. 능력 점수가 아니다. */
export function drillWeights(focus,{now=Date.now()}={}){
 const f=readFocus(focus),latest=f.events.filter(e=>Date.parse(e.at)<=now&&['found','retry'].includes(e.kind)).at(-1);
 return Object.fromEntries(BINS.map(bin=>{
  const picks=f.practice[bin].filter(p=>Date.parse(p.at)<=now&&(!latest||Date.parse(p.at)>=Date.parse(latest.at)));
  if(picks.length){let wrong=0,total=0;picks.forEach((p,i)=>{const weight=i+1;total+=weight;if(!p.correct)wrong+=weight;});return [bin,wrong/total];}
  const off=latest?.errors||{},sum=(off.formal||0)+(off.polite||0);
  return [bin,sum?(off[bin]||0)/sum:0];
 }));
}
/** 유형마다 대조 카드 한 장을 남기고, 나머지는 헷갈리는 유형에 더 배정한다. 근거가 없으면 2·2·2.
 * 같은 판의 문장은 중복하지 않고, 최근 12장 밖의 문장을 먼저 뽑는다. 새 문장을 생성하지 않는다. */
export function drillDeck(pool,{seed=1,size=DRILL_SIZE,focus=null,now=Date.now()}={}){
 const f=readFocus(focus),weights=drillWeights(f,{now}),recent=new Set(f.recentCards),seen=new Set();
 const unique=pool.filter(c=>BINS.includes(c.bin)&&!seen.has(c.text)&&seen.add(c.text));
 const by=Object.fromEntries(BINS.map((bin,i)=>{const shuffled=mix(unique.filter(c=>c.bin===bin),seed+i+1);return [bin,[...shuffled.filter(c=>!recent.has(cardKey(c))),...shuffled.filter(c=>recent.has(cardKey(c)))]];}));
 const priority=[...BINS].sort((a,b)=>weights[b]-weights[a]),extra=Object.fromEntries(BINS.map(bin=>[bin,0])),deck=[];
 for(const bin of priority){if(deck.length>=size)break;const card=by[bin].shift();if(card)deck.push(card);}
 while(deck.length<size){
  const available=priority.filter(bin=>by[bin].length);if(!available.length)break;
  const bin=available.sort((a,b)=>(weights[b]/(extra[b]+1)-weights[a]/(extra[a]+1))||(extra[a]-extra[b]))[0];
  deck.push(by[bin].shift());extra[bin]++;
 }
 if(!priority.some(bin=>weights[bin]>0))return mix(deck,seed);
 const first=deck.shift();return first?[first,...mix(deck,seed)]:[];
}

// 최대 20개 안에 진행 중인 차례의 시작·완료·최근 도움 근거를 남긴다. 반복 점검이 시작 사건을 밀어내면 안 된다.
function compactEvents(events){
 if(events.length<=FOCUS_LOG_MAX)return events;
 const kinds=events.map(e=>e.kind),lastAlone=kinds.lastIndexOf('independent'),prevAlone=lastAlone>0?kinds.lastIndexOf('independent',lastAlone-1):-1;
 const keep=new Set([lastAlone,prevAlone].filter(i=>i>=0));
 for(const [start,end] of [[prevAlone+1,lastAlone],[lastAlone+1,events.length]]){
  const ids=events.map((e,i)=>i>=start&&i<end&&['found','retry'].includes(e.kind)?i:-1).filter(i=>i>=0);
  if(ids.length){keep.add(ids[0]);keep.add(ids.at(-1));}
  for(let i=end-1;i>=start;i--)if(events[i].kind==='helped'){keep.add(i);break;}
 }
 for(let i=events.length-1;i>=0&&keep.size<FOCUS_LOG_MAX;i--)keep.add(i);
 return [...keep].sort((a,b)=>a-b).map(i=>events[i]);
}
// exposed는 피드백을 본 문항 ID와 시각만 별도 보존한다. 최근 사건 20개가 줄어도 「혼자 해냄」으로 바뀌지 않는다.
// practice는 유형별 최근 6회 정오, recentCards는 카드 ID 12개. 학생 문장 원문·정답은 이 기록에 두지 않는다.
export function readFocus(value,{history=[]}={}){
 const v=value&&typeof value==='object'&&value.id===FOCUS_ID?value:{};
 const all=(Array.isArray(v.events)?v.events:[]).filter(e=>e&&KINDS.includes(e.kind)&&validId(e.itemId)&&validAt(e.at)).map(e=>({
  at:e.at,itemId:e.itemId,kind:e.kind,...Object.fromEntries(['plain','off','total'].map(k=>[k,Number.isInteger(e[k])&&e[k]>=0?e[k]:0])),
  ...(e.errors?{errors:Object.fromEntries(['formal','polite'].map(bin=>[bin,Number.isInteger(e.errors[bin])&&e.errors[bin]>=0?e.errors[bin]:0]))}:{})}));
 const exposed=new Map(Object.entries(v.exposed&&typeof v.exposed==='object'?v.exposed:{}).filter(([id,at])=>validId(id)&&validAt(at)));
 const expose=(id,at)=>{if(validId(id)&&validAt(at)&&(!exposed.has(id)||Date.parse(at)<Date.parse(exposed.get(id))))exposed.set(id,at);};
 for(const e of all)if(e.kind!=='independent')expose(e.itemId,e.at);
 // 이전 기록 이관: 기존 규칙 점검 log에 남은 style 지적도 회수한다. 원문은 옮기지 않는다.
 for(const e of Array.isArray(history)?history:[])if(e?.source==='rule-check'&&e.type===FOCUS_TYPE&&Array.isArray(e.checks)&&e.checks.includes('style'))expose(e.itemId,e.at);
 const practice=Object.fromEntries(BINS.map(bin=>[bin,(Array.isArray(v.practice?.[bin])?v.practice[bin]:[]).filter(p=>validAt(p?.at)&&typeof p.correct==='boolean').slice(-6).map(p=>({at:p.at,correct:p.correct}))]));
 const recentCards=(Array.isArray(v.recentCards)?v.recentCards:[]).filter(k=>typeof k==='string'&&/^[a-zA-Z0-9_-]{1,100}:\d+$/.test(k)).slice(-12);
 const drill=v.drill&&validAt(v.drill.at)&&Number.isInteger(v.drill.right)&&Number.isInteger(v.drill.total)&&v.drill.right>=0&&v.drill.total>0&&v.drill.right<=v.drill.total?{at:v.drill.at,right:v.drill.right,total:v.drill.total}:null;
 return {id:FOCUS_ID,events:compactEvents(all),drill,exposed:Object.fromEntries(exposed),practice,recentCards};
}
/** 바로 앞의 동일 결과는 최신 시각으로 합친다. helped → retry → helped는 두 번째 고침도 반드시 남긴다. */
export function recordFocusOutcome(focus,event){
 const f=readFocus(focus),last=f.events.at(-1);
 if(last&&last.itemId===event?.itemId&&last.kind===event.kind&&['plain','off','total'].every(k=>last[k]===event[k])&&JSON.stringify(last.errors)===JSON.stringify(event.errors))return readFocus({...f,events:[...f.events.slice(0,-1),event]});
 return readFocus({...f,events:[...f.events,event]});
}
export function recordDrillPick(focus,card,picked,{now=Date.now()}={}){
 const f=readFocus(focus);if(!BINS.includes(card?.bin)||!BINS.includes(picked))return f;
 return readFocus({...f,practice:{...f.practice,[card.bin]:[...f.practice[card.bin],{at:new Date(now).toISOString(),correct:card.bin===picked}]},recentCards:[...f.recentCards,cardKey(card)]});
}
/** 지금 고치는 중인가: 마지막 「잡힘」(found·retry)이 마지막 「혼자 해냄」보다 뒤면 열려 있다. 차례는 「혼자 해냄」을 경계로 센다 —
 *  혼자 해낸 뒤 그 차례의 원래 글을 고친 helped는 닫힌 차례에 붙고 차례를 다시 열지 않는다.
 *  이번 차례에 잡힌 문항(found·retry)은 「도움 받은 문항」이다. now보다 늦은 사건(기기 시계가 뒤로 간 경우)은 보지 않는다. */
export function focusState(focus,{now=Date.now()}={}){
 const f=readFocus(focus),events=f.events.filter(e=>Date.parse(e.at)<=now),kinds=events.map(e=>e.kind);
 // 열린 차례는 마지막 「혼자 해냄」 뒤의 첫 잡힘부터다 — 그 사이의 helped는 닫힌 차례에 늦게 붙은 것이라 새 차례에 넣지 않는다.
 const lastAlone=kinds.lastIndexOf('independent'),firstFind=kinds.findIndex((k,i)=>i>lastAlone&&(k==='found'||k==='retry'));
 const open=firstFind>=0,prevAlone=lastAlone>0?kinds.lastIndexOf('independent',lastAlone-1):-1;
 const round=open?events.slice(firstFind):[];
 const closedRound=lastAlone>=0?events.slice(prevAlone+1,open?firstFind:events.length):[];
 const finds=list=>new Set(list.filter(e=>e.kind==='found'||e.kind==='retry').map(e=>e.itemId));
 return {open,last:open?round.at(-1):null,round,closedRound,
  // everFound: 지금까지 잡혔던 문항 전부 — 카드·연습을 본 뒤 그 글을 고친 것은 어느 차례에서든 「혼자」가 아니다.
  found:finds(round),closedFound:finds(closedRound),everFound:new Set(Object.entries(f.exposed).filter(([,at])=>Date.parse(at)<=now).map(([id])=>id)),
  helped:(open?round:closedRound).filter(e=>e.kind==='helped').at(-1)||null,
  independent:open?null:events[lastAlone]||null,
  drill:open&&f.drill&&Date.parse(f.drill.at)<=now&&f.drill.at>=round[0].at?f.drill:null};
}
/** 53번 글 하나를 규칙 점검한 결과를 분류한다. 판정할 수 없으면 null(기록하지 않는다).
 *  assisted: 그 문항에서 예시답을 열었거나 자동 피드백을 받은 적이 있다(기기에 남은 기록 — 새로 고침·지우기 뒤에도). */
export function focusOutcome({item,text,result,state,assisted=false}){
 if(item?.type!==FOCUS_TYPE||!result||!Array.isArray(result.items))return null;
 const sentences=sentencesOf(text),ends=sentences.map(s=>endingOf(s.text)),plain=sentences.filter(s=>endsPlain(s.text)).length,off=ends.filter(e=>e==='formal'||e==='polite').length,total=ends.length;
 const errors=Object.fromEntries(['formal','polite'].map(bin=>[bin,ends.filter(e=>e===bin).length]));
 const style=result.items.some(entry=>entry.id==='style'&&entry.level==='check');
 if(style)return {kind:state?.open?'retry':'found',plain,off,total,errors};
 // 의문·청유·미완성 꼴과 같은 문장 반복은 설명문을 혼자 쓴 근거가 아니다. 전체 문법·내용 채점은 하지 않는다.
 const distinct=new Set(sentences.filter(s=>s.text.trim().split(/\s+/).length>=2).map(s=>s.text.replace(/[\s.!?。！？]+/g,'')));
 if(plain<MIN_PLAIN||plain!==total||distinct.size<MIN_PLAIN)return null;
 // 닫힌 차례: 그 차례에 잡힌 원래 글을 이제 고쳤으면 「도움 받고 고침」으로 그 차례에 붙인다(한 번만).
 if(!state?.open)return state?.closedFound?.has(item.id)&&!state.helped?{kind:'helped',plain,off,total}:null;
 return {kind:assisted||state.found.has(item.id)||state.everFound?.has(item.id)?'helped':'independent',plain,off,total};
}
/** 다음 학습(Core activity의 practiceNeed): 열린 동안, 마지막 사건이 7일 안일 때만. 잡힘·다시면 retry, 도움 받고 고침이면 assisted.
 *  7일이 지나면 넘기지 않는다 — 53번이 Core의 급한 줄을 오래 차지해 다른 복습을 굶기지 않게. 목록 카드는 남는다. */
export function focusNeed(focus,{now=Date.now()}={}){
 const state=focusState(focus,{now});if(!state.open)return null;
 const at=Date.parse(state.last.at);/* 열린 차례의 마지막 사건 */if(now-at>NEED_DAYS*DAY)return null;
 return {kind:state.last.kind==='helped'?'assisted':'retry',at:new Date(at).toISOString(),evidenceRefs:[`writing.${FOCUS_ID}.${state.last.itemId}`.replace(/[^a-zA-Z0-9_.:-]/g,'-').slice(0,120)]};
}
/** 혼자 다시 쓸 53번: 이번 차례에 잡힌 문항도, 도움(예시답·자동 피드백)을 받은 문항도 아닌 것 가운데 아직 점검하지 않은 것 → 가장 오래전에 쓴 것.
 *  모두 도움을 받았으면 null(혼자 다시 쓸 문항이 없다고 말한다). */
export function retryItem(open=[],{state,drafts={},helped={}}={}){
 const pool=open.filter(item=>item.type===FOCUS_TYPE&&!(state?.everFound||state?.found)?.has(item.id)&&!helped[item.id]);
 const fresh=pool.find(item=>!drafts[item.id]?.checkedAt);if(fresh)return fresh;
 return [...pool].sort((a,b)=>String(drafts[a.id]?.updatedAt||'').localeCompare(String(drafts[b.id]?.updatedAt||'')))[0]||null;
}
/** 「내 문장 바꿔 보기」: 방금 글에서 「-습니다/-아요」로 끝난 문장(최대 3). */
export function mySentences(text){return sentencesOf(text).filter(s=>['formal','polite'].includes(endingOf(s.text))).slice(0,MY_MAX).map(s=>s.text);}
/** 바꿔 쓴 문장의 끝이 「-다」 꼴인가(끝 꼴만 — 문법 전체가 맞다는 뜻이 아니다). */
export const endsPlain=text=>{const value=String(text||'').trim(),sentences=sentencesOf(value);return sentences.length===1&&!/[?？]/.test(value)&&endingOf(value)==='plain'&&/[가-힣]다[.!。！\s"'”’」』)]*$/.test(value);};
/** 「지난 53번 글에서도 같았어요」: 이 글 앞의 53번 규칙 점검 기록에 style 지적이 있었는가(기존 log[].checks). */
export const sameBefore=(log=[],itemId)=>log.some(entry=>entry?.source==='rule-check'&&entry.type===FOCUS_TYPE&&entry.itemId!==itemId&&Array.isArray(entry.checks)&&entry.checks.includes('style'));
