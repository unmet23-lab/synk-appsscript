// WORLD 시험 형식(2026-10-21 ④ · 최종 제안 §2-2 #8·#12, 3차 검수 「미니 모의·근거 집계·급수 추정 검증은 세 작업」).
// (1) 시험형 듣기 재생 규칙: 공식 유형의 허용 재생 수(PBT — TOPIK I 전 문항 두 번, TOPIK II 1~20번 한 번·21~50번 두 번)까지는
//     시험 조건이라 혼자 들은 것이고, 그 뒤에 더 들은 것만 도움(다시 듣기)으로 남긴다. 학습 게임과 게임 원고에서 온 문항은
//     그 게임 규칙(다 들은 뒤 다시 듣기는 도움)을 그대로 쓴다. IBT 재생 규칙은 확인 전이라 쓰지 않는다 — 시험형은 모두 PBT 판이다.
//     허용 횟수와 실제 재생은 기록에 남긴다: 허용 횟수는 문항을 낼 때의 결정 기록(flow 칸 — 그 문항을 낼 때의 설정을 나중에 볼 수
//     있게 남기는 자리, atlas/game-flow.js와 같은 쓰임)에, 실제 재생은 끝까지 들은 재생마다 소리 전달 사건(practice.delivery
//     completed)으로. Trail 사건 모양은 바꾸지 않는다(서버도 같은 검사기를 쓴다).
// (2) 시험 형식 연습(미니 모의): 실제 구성(공식 유형을 번호 순서·비율대로 줄인 판) · 시간 제한(실제 시험의 문항당 시간) ·
//     처음 보는 문항. 세트는 통째로 낸다. 실제 구성의 줄인 판이라 공식 점수 환산·합격 판정은 하지 않는다.
// (3) 근거 집계: 시험 형식 연습에서 처음 본 문항에 혼자 낸 첫 답을 예상 급수 문턱(world-position.mjs estimateGate)에 넘길 줄로 바꾼다.
//     급수 추정은 여기에도 어디에도 없다 — 추정 방법이 검증되기 전까지 예상 급수 범위는 만들지 않는다.
// 문항·실제 구성은 공개 TOPIK 은행(world-topik-items.json, tools/build-world-topik-items.mjs)에서 온다. 화면 글은 없다.
import Trail from '../../atlas/trail.js';

const efRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const efTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const efToken=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
// 늘 같은 순서: 문항 열쇠로 섞은 순서(정답 자리·출처가 한쪽으로 몰리지 않게 — world-reading-practice.mjs와 같은 셈).
function efOrder(key){let h=2166136261;for(const c of String(key))h=Math.imul(h^c.codePointAt(0),16777619)>>>0;return h;}

// ── (1) 재생 규칙 ──
export const PLAY_POLICY=Object.freeze({version:'world-exam-plays-1',mode:'pbt'});
// 시험형 문항(문항 묶음의 듣기)만 허용 재생 수가 있다. 없으면 null(그 게임 규칙).
export function allowedPlays(item){
 if(!efRecord(item)||item.source!=='topik-items'||item.modality!=='listening')return null;
 return Number.isInteger(item.plays)&&item.plays>0&&item.plays<=3?item.plays:null;
}
// 문항을 낼 때 결정 기록에 남길 조건. extra: 시험 형식 연습의 조건(구성·시간·영역).
export function presentCondition(item,{content='world-exam',extra=null}={}){
 const plays=allowedPlays(item);
 if(plays===null&&!extra)return undefined;
 return {flow:{content,policy:extra?MOCK_POLICY.version:PLAY_POLICY.version,arm:null,mode:PLAY_POLICY.mode,level:null,
  values:{...(plays!==null?{plays}:{}),...(extra||{})}}};
}
// 한 문항의 재생 셈: 끝까지 들은 재생(completed)으로 허용 횟수를 센다(실패한 재생은 들은 것이 아니다).
// 다음 재생이 무엇인지: 'first'(아직 끝까지 못 들음) · 'allowed'(허용 안 · 도움 아님) · 'extra'(허용 넘음 · 도움) · 'closed'(시험 형식 연습은 허용까지만).
export function nextPlay(plays,{heard,exam=false}={}){
 if(!heard)return 'first';
 if(Number.isInteger(plays?.allowed)&&plays.completed<plays.allowed)return 'allowed';
 return exam?'closed':'extra';
}

// ── (2) 시험 형식 연습 ──
export const MOCK_POLICY=Object.freeze({version:'world-mock-1',mode:'pbt',gameId:'world-mock',composition:'mini-blueprint',
 // 영역마다 낼 문항 수. 시간은 실제 시험의 문항당 시간(공식 시간 ÷ 공식 문항 수)으로 정한다 — TOPIK I 듣기 10문항 13분 · 읽기 10문항 15분.
 size:Object.freeze({listening:10,reading:10}),
 // 한 영역에서 실제 구성의 이만큼을 못 채우면 그 영역 연습은 열지 않는다(줄인 판이라도 실제 구성이라 부를 수 없다).
 minShare:.6,
 sections:Object.freeze(['listening','reading']),
 exams:Object.freeze({topik1:'topik-i',topik2:'topik-ii'})});

// 공식 유형을 번호 순서대로 한 덩이씩: 홑 유형(번호 몇 개) 또는 세트(같은 지문의 문항들). weight는 실제 시험에서 차지하는 문항 수.
function efUnits(types,section){
 const out=[],sets=new Map();
 for(const row of types.filter(type=>type.section===section).sort((a,b)=>a.from-b.from)){
  const weight=Math.max(1,row.to-row.from+1);
  if(row.set){if(!sets.has(row.set)){const unit={kind:'set',id:row.set,types:[],weight:0,from:row.from};sets.set(row.set,unit);out.push(unit);}
   const unit=sets.get(row.set);unit.types.push(row.id);unit.weight+=weight;}
  else out.push({kind:'single',id:row.id,types:[row.id],weight,from:row.from,to:row.to});
 }
 return out;
}
// 줄인 판의 자리: 세트는 통째로, 나머지는 실제 비율대로(큰 나머지 순). 세트 몇 개를 넣을지는 세트들이 실제 시험에서 차지하는 몫으로 정한다.
// 어느 세트를 넣을지는 고를 때 정한다(처음 보는 완전한 세트가 있는 것 중 덜 본 것부터).
export function mockSlots({forms,exam,section,size=MOCK_POLICY.size[section]}={}){
 const form=forms?.[exam],official=form?.pbt?.[section];
 if(!efRecord(form)||!efRecord(official)||!Array.isArray(form.types)||!Number.isInteger(size)||size<1)return null;
 const units=efUnits(form.types,section),total=units.reduce((n,unit)=>n+unit.weight,0);
 if(!total)return null;
 const sets=units.filter(unit=>unit.kind==='set'),singles=units.filter(unit=>unit.kind==='single');
 const setShare=sets.reduce((n,unit)=>n+size*unit.weight/total,0),setSize=sets.length?sets.reduce((n,unit)=>n+unit.weight,0)/sets.length:0;
 // 세트 몫이 딱 반이면 아래로(홑 유형을 하나라도 더 넣는다 — TOPIK I 읽기 10문항은 세트 2개 + 홑 유형 6자리).
 const setCount=sets.length?Math.min(sets.length,Math.max(0,Math.ceil(setShare/setSize-.5))):0;
 const left=Math.max(0,size-Math.round(setCount*setSize)),singleWeight=singles.reduce((n,unit)=>n+unit.weight,0);
 const exact=singles.map(unit=>({unit,share:singleWeight?left*unit.weight/singleWeight:0}));
 for(const row of exact)row.count=Math.floor(row.share);
 let rest=left-exact.reduce((n,row)=>n+row.count,0);
 for(const row of [...exact].sort((a,b)=>(b.share-b.count)-(a.share-a.count)||a.unit.from-b.unit.from)){if(rest<=0)break;row.count+=1;rest-=1;}
 return {exam,section,size,official:{items:official.items,minutes:official.minutes},setCount,
  singles:exact.filter(row=>row.count>0).map(row=>({type:row.unit.id,from:row.unit.from,to:row.unit.to,count:row.count})),
  sets:sets.map(unit=>({id:unit.id,types:[...unit.types],from:unit.from,weight:unit.weight}))};
}

// 세트까지 본 문항인지: 같은 세트의 다른 문항을 이미 봤으면 그 문항도 「처음 보는 문항」이 아니다(지문을 이미 읽었다).
// seen(item)은 노출(true)·처음(false)·모름(null). 모름은 처음이 아니다.
export function freshBySet(pool,seen){
 const read=new Map();
 for(const item of pool){let value=null;try{value=seen(item);}catch{value=null;}read.set(item.id,value);}
 const touched=new Set(pool.filter(item=>item.setId&&read.get(item.id)!==false).map(item=>item.setId));
 return pool.filter(item=>read.get(item.id)===false&&!(item.setId&&touched.has(item.setId)));
}

// 시험 형식 연습 고르기. pool: 은행 문항(world-topik-items.mjs bankItems) · seen: 노출 읽기 · sections: 낼 영역.
// 영역마다: 실제 구성의 자리를 처음 보는 문항으로 채운다. 세트는 세트의 문항이 모두 은행에 있고 모두 처음일 때만.
// 채운 문항이 minShare보다 적으면 그 영역은 'short'로 빼고, 빠진 유형은 missing에 적는다(화면이 「아직 문항이 없는 유형」으로 알린다).
export function selectMock({forms,exam,pool=[],seen,sections=MOCK_POLICY.sections,audioAvailable=true}={}){
 if(typeof seen!=='function'||!Array.isArray(pool))throw TypeError('WORLD mock needs a pool and an exposure reader');
 const examId=MOCK_POLICY.exams[exam]||exam,fresh=freshBySet(pool.filter(item=>item.exam===examId),seen);
 const common={policy:MOCK_POLICY.version,exam:examId,mode:MOCK_POLICY.mode,composition:MOCK_POLICY.composition,learningEffectClaim:false,grade:null,passClaim:false};
 const out=[];
 for(const section of sections){
  if(section==='listening'&&!audioAvailable){out.push({section,status:'audio-off',items:[],missing:[],minutes:0});continue;}
  const plan=mockSlots({forms,exam:examId,section});
  if(!plan){out.push({section,status:'no-form',items:[],missing:[],minutes:0});continue;}
  const mine=fresh.filter(item=>item.modality===section),used=new Set(),items=[],missing=[];
  const byType=type=>mine.filter(item=>item.officialType===type&&!item.setId&&!used.has(item.id))
   .sort((a,b)=>a.difficulty-b.difficulty||efOrder(a.itemKey)-efOrder(b.itemKey)||a.id.localeCompare(b.id));
  const picks=[];
  for(const slot of plan.singles){
   const rows=byType(slot.type),chosen=[];
   // 한 유형에서 여럿이면 서로 다른 항목부터(17~21번처럼 한 유형이 여러 항목을 다룬다).
   for(const item of rows){if(chosen.length>=slot.count)break;if(!chosen.some(row=>row.skillId===item.skillId))chosen.push(item);}
   for(const item of rows){if(chosen.length>=slot.count)break;if(!chosen.includes(item))chosen.push(item);}
   for(const item of chosen)used.add(item.id);
   picks.push({from:slot.from,items:chosen});
   if(chosen.length<slot.count)missing.push({type:slot.type,from:slot.from,to:slot.to,count:slot.count-chosen.length});
  }
  // 세트: 은행에 문항이 모두 있고 모두 처음인 세트(세트 이름은 묶음마다 다르므로 유형 짝으로 찾는다). 덜 본 세트 유형부터.
  const complete=new Map();
  for(const item of mine.filter(item=>item.setId)){if(!complete.has(item.setId))complete.set(item.setId,[]);complete.get(item.setId).push(item);}
  const ready=[...complete.values()].filter(rows=>rows.length===rows[0].setSize).map(rows=>rows.sort((a,b)=>a.setOrder-b.setOrder));
  const unitOf=rows=>plan.sets.find(unit=>rows.every(item=>unit.types.includes(item.officialType)));
  const seenCount=unit=>pool.filter(item=>item.exam===examId&&unit.types.includes(item.officialType)).length-mine.filter(item=>unit.types.includes(item.officialType)).length;
  const units=[...plan.sets].sort((a,b)=>seenCount(a)-seenCount(b)||a.from-b.from);
  let sets=0;
  for(const unit of units){
   if(sets>=plan.setCount)break;
   const rows=ready.filter(group=>unitOf(group)===unit).sort((a,b)=>a[0].difficulty-b[0].difficulty||efOrder(a[0].setId)-efOrder(b[0].setId))[0];
   if(!rows)continue;sets+=1;picks.push({from:unit.from,items:rows});
  }
  if(sets<plan.setCount)missing.push({type:'set',count:plan.setCount-sets});
  for(const pick of picks.sort((a,b)=>a.from-b.from))items.push(...pick.items);
  const minutes=items.length?Math.max(1,Math.round(items.length*plan.official.minutes/plan.official.items)):0;
  const status=items.length>=Math.ceil(plan.size*MOCK_POLICY.minShare)?'ready':items.length?'short':'none';
  out.push({section,status,items:status==='ready'?items:[],missing,minutes:status==='ready'?minutes:0,size:plan.size,official:plan.official,available:items.length});
 }
 const ready=out.filter(row=>row.status==='ready');
 // numbers: 공식 유형 id → [첫 번호, 끝 번호](끝 화면이 「7~10번형」처럼 쓴다).
 const numbers=Object.fromEntries((forms?.[examId]?.types||[]).map(row=>[row.id,[row.from,row.to]]));
 return {...common,status:ready.length?'ready':'unavailable',sections:out,minutes:ready.reduce((n,row)=>n+row.minutes,0),total:ready.reduce((n,row)=>n+row.items.length,0),numbers};
}

const efMeasure=item=>({id:item.id,itemKey:item.itemKey,familyKey:item.familyKey||item.itemKey,skillId:item.skillId,modality:item.modality,
 difficulty:item.difficulty,responseFormat:item.responseFormat??'single-choice',audioRequired:item.modality==='listening',confounded:false,
 ...(Array.isArray(item.conceptIds)?{conceptIds:[...item.conceptIds]}:{})});

// 시험 형식 연습 한 번. sections: selectMock의 'ready' 영역들(듣기 먼저 — 실제 시험 순서). clock(): 지금(ms).
// - 영역마다 시간 제한(실제 시험의 문항당 시간). 영역을 시작할 때 시계가 돈다. 시간이 다 되면 그 영역은 끝나고 다음 영역으로 간다.
// - 문항은 화면에 처음 보일 때 기록(제시)한다. 고른 답은 바로 첫 답으로 기록되고 바꾸지 않는다(혼자 낸 첫 답만 근거다).
//   답하지 않고 넘긴 문항은 그 영역 안에서 다시 열 수 있다. 영역이 끝날 때 열어 본 문항 가운데 답하지 않은 것은 「답하지 않음」
//   (평가할 수 없는 답)으로 남기고, 열어 보지 않은 문항은 기록하지 않는다(본 적 없는 문항은 다음에 처음 보는 문항으로 남는다).
// - 듣기: 허용 재생 수(시험 조건)까지만 들을 수 있다. 실제 재생은 끝까지 들은 재생마다 기록한다. 정답·해설은 끝난 뒤에만 보인다.
//   세트 듣기(25~26번 등)는 실제 시험처럼 대본 하나를 세트 문항이 함께 쓴다: 재생 셈·들음은 세트에 하나(track)이고,
//   끝까지 들은 재생은 열어 둔 세트 문항 모두에 남긴다. 다 들은 뒤에 여는 세트 문항에는 그 전달을 한 번 남긴다(대본은 이미 들었다).
//   재생은 시작한 문항의 대본에 남긴다 — 실제 시험처럼 듣는 동안 다른 문항으로 옮기거나 답해도 소리는 이어지고(화면이 끊지 않는다),
//   끝난 재생은 그때 보고 있는 문항이 아니라 시작한 대본의 셈이 된다.
export function createMockSession({coach,sections=[],exam,clock=()=>Date.now()}={}){
 if(!coach||['present','delivery','answer'].some(name=>typeof coach[name]!=='function')||!Array.isArray(sections)||!sections.length)throw TypeError('WORLD mock needs the learning coach and its sections');
 const parts=sections.map(row=>{
  if(!MOCK_POLICY.sections.includes(row?.section)||!Array.isArray(row.items)||!row.items.length||!Number.isFinite(row.minutes)||row.minutes<=0)throw TypeError('WORLD mock: invalid section');
  for(const item of row.items)if(item?.modality!==row.section||!Array.isArray(item.choices)||!item.choices.some(choice=>choice?.id===item.correctId))throw TypeError('WORLD mock: an item needs its section, choices and answer');
  const tracks=new Map();
  const trackOf=item=>{const key=item.setId?`set:${item.setId}`:`item:${item.id}`;
   if(!tracks.has(key))tracks.set(key,{heard:item.modality!=='listening',audio:'none',plays:{allowed:allowedPlays(item),completed:0}});return tracks.get(key);};
  return {section:row.section,items:row.items,minutes:row.minutes,startedAt:null,endedAt:null,ended:null,
   cells:row.items.map(item=>({item,pid:null,track:trackOf(item),choiceId:null,result:null,shownAt:null}))};
 });
 const examId=MOCK_POLICY.exams[exam]||exam;
 let partIndex=0,cursor=0,finished=false,sounding=null;
 const part=()=>parts[partIndex]||null;
 const deadline=row=>row.startedAt===null?null:row.startedAt+row.minutes*60000;
 const condition=(row,item)=>presentCondition(item,{content:MOCK_POLICY.gameId,extra:{form:examId,composition:MOCK_POLICY.composition,section:row.section,minutes:row.minutes,timed:true}});
 function show(row,index){
  const cell=row.cells[index];
  if(!cell.pid){
   cell.pid=coach.present(efMeasure(cell.item),condition(row,cell.item));cell.shownAt=clock();
   if(cell.item.modality==='listening'){if(cell.track.heard)coach.delivery(cell.pid,{audio:'completed'});else if(cell.track.audio==='none')cell.track.audio='pending';}
  }
  return cell;
 }
 // 지금 문항이 든 세트의 자리(이 영역 안 1부터): 화면이 「n~m번은 같은 내용」으로 알린다.
 const setRange=(row,cell)=>{
  if(!cell.item.setId)return null;
  const at=row.cells.map((entry,index)=>entry.item.setId===cell.item.setId?index:-1).filter(index=>index>=0);
  return at.length>1?{first:at[0]+1,last:at[at.length-1]+1}:null;
 };
 // 시간을 넘겼으면 그 영역을 닫는다(호출하는 쪽이 시계를 따로 돌리지 않아도 답·이동 때마다 확인한다).
 function expire(){const row=part();if(row&&row.startedAt!==null&&row.ended===null&&clock()>=deadline(row))close(row,'time');}
 function close(row,reason){
  if(row.ended!==null)return;
  for(const cell of row.cells)if(cell.pid&&!cell.result){
   cell.result=coach.answer(cell.pid,{correct:null,assessable:false,reason:cell.track.heard?'unanswered':'audio'});
  }
  row.ended=reason;row.endedAt=clock();
 }
 const view=()=>{
  expire();
  const row=part();if(!row||finished)return null;
  // 영역 사이: 아직 시작하지 않은 영역(시계가 돌기 전 — 문항을 보이지 않는다) 또는 시간이 다 돼 닫힌 영역.
  if(row.startedAt===null)return {section:row.section,partIndex,parts:parts.length,between:true,started:false,ended:null,total:row.cells.length,minutes:row.minutes};
  if(row.ended!==null)return {section:row.section,ended:row.ended,partIndex,parts:parts.length,between:true,started:true};
  const cell=row.cells[cursor];
  return {section:row.section,partIndex,parts:parts.length,index:cursor,total:row.cells.length,item:cell.item,heard:cell.track.heard,audio:cell.track.audio,
   plays:{...cell.track.plays},answered:!!cell.result,choiceId:cell.choiceId,started:row.startedAt!==null,deadline:deadline(row),
   remainingMs:row.startedAt===null?row.minutes*60000:Math.max(0,deadline(row)-clock()),set:setRange(row,cell),
   // sounding: 지금 소리가 나는 문항(이 영역 안 0부터, 없으면 null) — 다른 문항을 보고 있을 때 화면이 「n번 소리」로 알린다.
   sounding:sounding&&sounding.row===row?row.cells.indexOf(sounding.cell):null,
   marks:row.cells.map(entry=>entry.result?'answered':entry.pid?'opened':'new')};
 };
 return Object.freeze({
  get parts(){return parts.map(row=>({section:row.section,total:row.cells.length,minutes:row.minutes,ended:row.ended}));},
  get current(){return view();},
  // 영역 시작: 시계를 켜고 첫 문항을 연다.
  start(){
   if(finished)return null;const row=part();if(!row||row.startedAt!==null)return view();
   row.startedAt=clock();cursor=0;show(row,0);return view();
  },
  // 같은 영역 안에서 다른 문항으로(번호). 처음 여는 문항은 그때 기록한다.
  go(index){
   expire();const row=part();if(!row||row.startedAt===null||row.ended!==null||!Number.isInteger(index)||index<0||index>=row.cells.length)return view();
   cursor=index;show(row,index);return view();
  },
  // 실제 재생기의 결과만 받는다(재생을 눌렀다는 것만으로 들었다고 하지 않는다). 허용 횟수를 넘긴 재생은 받지 않는다.
  play(){
   expire();const row=part(),cell=row?.cells[cursor];
   // 한 번에 소리 하나: 다른 재생이 끝나기 전에는 시작하지 않는다(끝난 재생이 엉뚱한 대본의 셈이 되지 않게).
   if(!cell||row.ended!==null||cell.result||cell.item.modality!=='listening'||sounding)return false;
   const kind=nextPlay(cell.track.plays,{heard:cell.track.heard,exam:true});
   if(kind==='closed')return false;
   if(kind==='first'){cell.track.audio='pending';coach.delivery(cell.pid,{audio:'pending'});}
   sounding={row,cell};
   return kind;
  },
  // 재생기의 끝(completed)·실패(failed): 시작한 문항의 대본(track)에 남긴다. 영역이 닫힌 뒤에 끝난 재생은 세지 않는다.
  delivery(status){
   if(!['completed','failed'].includes(status))throw TypeError('WORLD mock: invalid audio state');
   expire();
   const now=sounding;sounding=null;
   if(!now||now.row.ended!==null)return false;
   const {row,cell}=now,track=cell.track;
   if(status==='completed'){
    track.plays.completed+=1;track.heard=true;track.audio='completed';
    for(const entry of row.cells)if(entry.track===track&&entry.pid&&!entry.result)coach.delivery(entry.pid,{audio:'completed'});
   }
   else if(!track.heard){track.audio='failed';if(!cell.result)coach.delivery(cell.pid,{audio:'failed'});}
   return true;
  },
  answer(choiceId){
   expire();const row=part(),cell=row?.cells[cursor];
   if(!cell||row.ended!==null||cell.result||!cell.track.heard)return null;
   if(!cell.item.choices.some(choice=>choice.id===choiceId))throw TypeError('WORLD mock: unknown choice');
   cell.choiceId=choiceId;
   cell.result=coach.answer(cell.pid,{correct:choiceId===cell.item.correctId,assessable:true,choice:{selectedId:choiceId,correctId:cell.item.correctId}});
   return {verdict:cell.result.verdict,independent:cell.result.independent===true};
  },
  // 영역을 마친다(학생이 「제출」했거나 시간이 다 됐을 때). 다음 영역이 있으면 그 영역은 학생이 시작할 때 시계가 돈다.
  finishSection(){
   const row=part();if(!row||finished)return null;
   if(row.startedAt===null)row.startedAt=clock();
   close(row,row.ended??'submitted');sounding=null;
   partIndex+=1;cursor=0;if(partIndex>=parts.length)finished=true;
   return view();
  },
  // 그만두기: 지금 영역을 닫고(열어 본 문항은 답하지 않음) 남은 영역은 시작하지 않는다.
  stop(){if(finished)return;const row=part();if(row&&row.startedAt!==null)close(row,'stopped');sounding=null;finished=true;},
  results(){
   return parts.map(row=>({section:row.section,minutes:row.minutes,ended:row.ended,startedAt:row.startedAt,endedAt:row.endedAt,
    items:row.cells.map(cell=>({itemId:cell.item.id,itemKey:cell.item.itemKey,officialType:cell.item.officialType,skillId:cell.item.skillId,opened:!!cell.pid,
     choiceId:cell.choiceId,verdict:cell.result?.verdict??null,independent:cell.result?.independent===true,eventId:cell.result?.eventId??null,
     plays:{...cell.track.plays}}))}));
  },
  get finished(){return finished;},
 });
}

// ── (3) 근거 집계 ──
// 학습 기록(Trail)에서 시험 형식 연습(결정 기록의 조건이 world-mock)의 첫 답만 꺼내 예상 급수 문턱이 읽는 줄로 바꾼다.
// 처음 본 문항인지·도움 없이 혼자인지·소리가 끝까지 나갔는지는 Trail이 이미 판정한다(independent). 여기서 새로 판정하지 않는다.
export function mockEvidence({events=[],asOf=new Date().toISOString()}={}){
 const list=Array.isArray(events)?events:[];
 const conditions=new Map();
 for(const event of list){
  if(event?.type!=='decision.made'||event.experienceId!==MOCK_POLICY.gameId)continue;
  const flow=Array.isArray(event.candidateSnapshot)?event.candidateSnapshot[0]?.flow:null;
  if(efRecord(flow)&&flow.content===MOCK_POLICY.gameId&&efRecord(flow.values))conditions.set(event.id,flow.values);
 }
 if(!conditions.size||!efTime(asOf))return [];
 const scope=list.find(event=>efRecord(event?.scope))?.scope;
 let summary;
 try{summary=Trail.summarize(list,{scope,asOf,decisions:[...conditions.keys()]});}catch{return [];}
 return summary.attempts.filter(row=>row.attemptNo===1&&efToken(row.eventId)).map(row=>{
  const values=conditions.get(row.decisionId)||{};
  return {eventId:row.eventId,at:row.at,domain:row.measure?.modality||null,skillId:row.measure?.skillId||null,firstExposure:row.exposure==='new',
   independent:row.independent===true,timed:values.timed===true,verdict:row.verdict,form:values.form||null,composition:values.composition||null,mode:MOCK_POLICY.mode,
   plays:Number.isInteger(values.plays)?values.plays:null};
 });
}
