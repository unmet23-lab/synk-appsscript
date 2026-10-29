// 싱크타운 「마을 준비 확인」과 첫 장면 배치 — docs/디자인/싱크타운_학습개인화다리_설계_20261022.md §4-2·§4-3.
// 판정(town-entry-r1)은 서버(SYNK-talk synk-town check)가 한다. 여기는 화면 쪽 순수 계산만 둔다: 준비 확인에 낼 문항 고르기,
// 서버에 그때 한 번 보낼 답 묶음 고르기, 첫 장면 수준 제안. 화면 글은 없고(문자열은 화면 쪽), 계정 묶음(world-account.bundle.mjs)으로 싣는다.
import trail from '../../atlas/trail.js';
import {selectDiagnostic} from './world-position.mjs';
import {freshBySet} from './world-exam-form.mjs';

const SCOPE=Object.freeze({domain:'LAB',workspace:'learning',subject:'device'}),DAY=86400000;
export const TOWN_CHECK_POLICY=Object.freeze({version:'town-ready-check-1',
 // 판정 창을 새로 채울 만큼: 읽기 6·듣기 4, 소리를 쓰지 않으면 읽기 10(서버 town-entry-r1과 같은 수).
 reading:6,listening:4,readingOnly:10,minChoices:4,windowDays:90,
 // 그때 한 번 보내는 답의 영역별 상한 — 서버 판정 창보다 넉넉히(도움 받은 답처럼 서버가 빼는 답이 섞여도 창이 찬다).
 send:Object.freeze({reading:14,listening:8,topik2:10}),maxEvents:200});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const counted=item=>record(item)&&Array.isArray(item.choices)&&item.choices.length>=TOWN_CHECK_POLICY.minChoices&&item.choices.some(choice=>choice?.id===item.correctId);

// 준비 확인에 낼 문항: 서버가 알려 준 모자란 영역(missing)만, 공개 은행(타운 맥락 판본 포함)의 보기 넷 이상 TOPIK I 문항에서.
// 고르는 순서는 「내 위치」 진단과 같다 — 능력마다 처음 보는 계열 하나, 아직 혼자 해내지 않은 가장 쉬운 난도부터(selectDiagnostic).
// 능력 순서는 아직 혼자 해내지 않은 능력 먼저, 같으면 지도 순서. 소리를 쓰지 않으면 읽기 10문항 — 읽기 능력이 여덟이라 모자란 둘은
// 지도 순서대로 능력마다 처음 보는 둘째 계열로 채운다(같은 계열·같은 세트는 다시 내지 않는다).
export function selectTownCheck({summary,items=[],seen,audioAvailable=true,missing=['reading','listening']}={}){
 const sound=audioAvailable!==false,pool=(Array.isArray(items)?items:[]).filter(item=>item?.exam==='topik-i'&&counted(item));
 const plan=selectDiagnostic({summary,items:pool,seen,audioAvailable:sound,exam:'topik1'});
 if(plan.status!=='ready')return {policy:TOWN_CHECK_POLICY.version,status:'unavailable',reason:plan.reason||'diagnostic.none',items:[]};
 const status=new Map(summary.skills.map(skill=>[skill.id,skill.status])),order=new Map(summary.skills.map((skill,index)=>[skill.id,index]));
 const rank=row=>(status.get(row.skillId)==='recent-independent'?1:0)*1000+(order.get(row.skillId)??999);
 const area=name=>plan.items.filter(row=>row.item.modality===name).sort((a,b)=>rank(a)-rank(b));
 const want=sound?{reading:missing.includes('reading')?TOWN_CHECK_POLICY.reading:0,listening:missing.includes('listening')?TOWN_CHECK_POLICY.listening:0}
  :{reading:missing.includes('reading')?TOWN_CHECK_POLICY.readingOnly:0,listening:0};
 const reading=area('reading').slice(0,want.reading),listening=area('listening').slice(0,want.listening);
 if(reading.length<want.reading){
  // 둘째 계열: 이미 고른 문항의 계열·세트를 뺀 처음 보는 문항에서, 능력 지도 순서대로.
  const families=new Set(reading.map(row=>row.item.familyKey||row.item.itemKey)),sets=new Set(reading.map(row=>row.item.setId).filter(Boolean));
  const rest=pool.filter(item=>item.modality==='reading'&&!families.has(item.familyKey||item.itemKey)&&!(item.setId&&sets.has(item.setId)));
  const fresh=new Set(freshBySet(rest,item=>{let value=null;try{value=seen(item);}catch{value=null;}return value;}).map(item=>item.id));
  for(const row of area('reading').sort((a,b)=>(order.get(a.skillId)??999)-(order.get(b.skillId)??999))){
   if(reading.length>=want.reading)break;
   const next=rest.filter(item=>item.skillId===row.skillId&&fresh.has(item.id)&&!families.has(item.familyKey||item.itemKey)&&!(item.setId&&sets.has(item.setId)))
    .sort((a,b)=>Math.abs(a.difficulty-row.target)-Math.abs(b.difficulty-row.target)||a.difficulty-b.difficulty||a.id.localeCompare(b.id))[0];
   if(!next)continue;
   families.add(next.familyKey||next.itemKey);if(next.setId)sets.add(next.setId);reading.push({skillId:next.skillId,target:row.target,item:next});
  }
 }
 const chosen=[...reading,...listening];
 return {policy:TOWN_CHECK_POLICY.version,status:chosen.length?'ready':'unavailable',reason:chosen.length?null:'diagnostic.none',
  short:reading.length<want.reading||listening.length<want.listening,items:chosen.map(row=>row.item)};
}

// 확인 끝 화면의 갈래(설계 §4-2·§5): 열림(passed) · 확인은 마쳤고 체험·이용권이 없음(access — 학습 미통과로 보이지 않는다)
// · 통과했지만 입장이 열리지 않음(held — 운영에서 회수한 통과, 같은 확인을 다시 권하지 않는다) · 서버의 확인 문제 판이 낡아 미룸(deferred)
// · 끊김(later) · 새 문항이 창보다 적었는데 아직(short) · 아직(not-yet). result는 서버 town/check 응답(끊기면 {outcome:'later'}).
export function townOutcome({result=null,short=false}={}){
 if(result?.allowed===true)return 'passed';
 if(result?.reason==='access')return 'access';
 if(['held','deferred','later'].includes(result?.outcome))return result.outcome;
 return short?'short':'not-yet';
}

// 그때 한 번 보내는 답(설계 §5-2 「판정에 쓸 답만」): 보기 넷 이상인 아는 문항(은행·진단 풀)에 낸 첫 답 가운데 최근 90일 것을
// 영역마다 상한까지(가장 최근부터), 그 제시·소리 전달·도움·빼기 사건과 함께. 글·이름은 없다 — Trail 연습 사건 그대로다.
// 기기에서 접힌(learning-ledger) 오래된 답은 보낼 수 없다 — 그래서 이 묶음은 최선이고, 준비 확인이 확실한 길이다.
export function townCheckAnswers({events=[],items,now=Date.now()}={}){
 const know=itemKey=>{const item=typeof items?.get==='function'?items.get(itemKey):null;return counted(item)?item:null;};
 const list=(Array.isArray(events)?events:[]).filter(event=>record(event)&&record(event.scope)&&event.scope.domain===SCOPE.domain&&event.scope.workspace===SCOPE.workspace&&event.scope.subject===SCOPE.subject);
 const shown=new Map(),children=new Map(),exclusions=[];
 for(const event of list){
  if(event.type==='practice.presented')shown.set(event.id,event);
  else if(['practice.delivery','practice.helped','practice.attempted'].includes(event.type)){if(!children.has(event.presentationId))children.set(event.presentationId,[]);children.get(event.presentationId).push(event);}
  else if(event.type==='record.excluded')exclusions.push(event);
 }
 const since=now-TOWN_CHECK_POLICY.windowDays*DAY,groups={reading:[],listening:[],topik2:[]};
 for(const [pid,rows] of children){
  const first=rows.find(row=>row.type==='practice.attempted'&&row.attemptNo===1),presented=shown.get(pid);
  if(!first||!presented||!record(first.choice))continue;
  const at=Date.parse(first.at);if(!(at>=since&&at<=now))continue;
  const item=know(presented.itemKey);if(!item)continue;
  groups[String(presented.measure?.skillId||item.skillId).startsWith('ko2.')?'topik2':item.modality]?.push({at,presented,rows});
 }
 const picked=Object.entries(groups).flatMap(([name,rows])=>rows.sort((a,b)=>b.at-a.at||b.presented.id.localeCompare(a.presented.id)).slice(0,TOWN_CHECK_POLICY.send[name]));
 const out=[],ids=new Set();
 const add=event=>{if(!ids.has(event.id)&&out.length<TOWN_CHECK_POLICY.maxEvents){ids.add(event.id);out.push(event);}};
 for(const {presented,rows} of picked.sort((a,b)=>Date.parse(a.presented.at)-Date.parse(b.presented.at))){
  const targets=new Set([presented.id,presented.decisionId,...rows.map(row=>row.id)]);
  const evidence=[presented,...rows,...exclusions.filter(exclusion=>targets.has(exclusion.targetId))];
  // An answer and its withdrawals form one evidence group. A size limit must
  // never keep the answer while dropping only the record that excludes it.
  if(out.length+new Set(evidence.filter(event=>!ids.has(event.id)).map(event=>event.id)).size>TOWN_CHECK_POLICY.maxEvents)continue;
  for(const event of evidence)add(event);
 }
 return out;
}

// 첫 장면 수준 제안(설계 §4-3) — 자리(읽기·듣기)마다 처음 보는 계열에 혼자 낸 첫 답(최근 90일)으로:
//   L4 = L3 조건 + TOPIK II 난도 2 이상에서 3개 이상을 2/3 이상 · L3 = 그 자리의 TOPIK II에서 3개 이상을 2/3 이상
//   L2 = TOPIK I 난도 2 이상에서 3개 이상을 2/3 이상, 또는 그 자리의 TOPIK I에서 6개 이상을 5/6 이상 · 나머지 L1.
// 학습 기록이 다 읽히지 않았으면(evidenceComplete가 참이 아니면) 제안 없이 L1. 목표 급·시험일은 쓰지 않는다(능력이 아니다).
// 독립 여부는 Trail 색인 그대로다(처음 보는 계열·도움 없음·소리 전달·빼기 — 서버 판정과 같은 규칙). 맞고 틀림은 기기 기록대로 본다(제안일 뿐이다).
export const PLACEMENT_LEVELS=Object.freeze(['L1','L2','L3','L4']);
export function placeTownLevels({events=[],evidenceComplete=false,now=Date.now()}={}){
 const flat={reading:'L1',listening:'L1'};
 if(evidenceComplete!==true)return {...flat,basis:'history.incomplete'};
 const index=trail.createIndex({scope:SCOPE}),rows=[],since=now-TOWN_CHECK_POLICY.windowDays*DAY;
 const ordered=(Array.isArray(events)?events:[]).map((event,order)=>({event,order,at:Date.parse(event?.at)})).filter(row=>record(row.event)&&Number.isFinite(row.at)).sort((a,b)=>a.at-b.at||a.order-b.order);
 for(const {event} of ordered){let row=null;try{row=index.add(event);}catch{row=null;}if(row)rows.push(row);}
 const used=rows.filter(row=>!row.omitted&&row.independent===true&&row.attemptNo===1&&row.measure&&Date.parse(row.at)>=since&&Date.parse(row.at)<=now);
 const share=(list,n,ratio)=>list.length>=n&&list.filter(row=>row.verdict==='correct').length*ratio[1]>=list.length*ratio[0];
 const level=channel=>{
  const mine=used.filter(row=>row.measure.modality===channel),two=mine.filter(row=>row.measure.skillId.startsWith('ko2.')),one=mine.filter(row=>row.measure.skillId.startsWith('ko.'));
  if(share(two,3,[2,3]))return share(two.filter(row=>row.measure.difficulty>=2),3,[2,3])?'L4':'L3';
  return share(one.filter(row=>row.measure.difficulty>=2),3,[2,3])||share(one,6,[5,6])?'L2':'L1';
 };
 return {reading:level('reading'),listening:level('listening'),basis:'first-answers'};
}
// 마스코트가 묻는 때와 고른 값(설계 §4-3): 아직 고른 값이 없고 제안에 L1보다 높은 자리가 있을 때만 묻는다.
// 「이대로」는 제안 그대로, 「더 쉬운 말로」는 두 자리 모두 한 단계 아래(L1 아래로는 가지 않는다).
export const PLACEMENT_COPY=Object.freeze({ask:'처음 이야기는 이 말로 해 볼까요?',keep:'이대로',easier:'더 쉬운 말로'});
export const placementAsk=({suggested,chosen}={})=>!chosen&&record(suggested)&&['reading','listening'].some(channel=>PLACEMENT_LEVELS.indexOf(suggested[channel])>0);
export function placementChoice(suggested,answer){
 if(!record(suggested)||!['keep','easier'].includes(answer))throw new TypeError('town placement: suggestion and answer required');
 const step=channel=>{const at=PLACEMENT_LEVELS.indexOf(suggested[channel]);if(at<0)throw new TypeError('town placement: unknown level');return PLACEMENT_LEVELS[answer==='easier'?Math.max(0,at-1):at];};
 return {reading:step('reading'),listening:step('listening')};
}
