// 동아리장 알림 → 튜터 고르기 → 실력 파악 → 맞춤(2026-11-24, 유호님 11-23 말씀 · 11-24 「추천대로 지어」)의 앱 쪽 다리.
// 화면은 experiences/world-front/club.mjs가 그린다. 이 다리는 앞면 다리(world-front-entry.mjs)의 host에 club* 함수를 더하고,
// 기록은 지금 있는 길만 쓴다: 튜터 스타일 → 학습 설정(도움 방식 · 설명 길이, 동의한 학생만), 한글 답 → 한글 답 저장,
// 문항 넷 → 「내 위치」 짧은 진단과 같은 문항 · 세션 · 끝 기록(education().clubCheck — world-learning-ui.mjs).
// 기기 표(synk.world.front.v1:<주인>)의 club에는 고른 튜터 · 결과 줄 · 알림을 연 날만 둔다. 학습 기록의 정본은 Trail이다.
import {t,hasString} from '../brand-opening/world-lang.mjs';
// 하루는 새벽 4시에 바뀐다(world-front-entry.mjs dayKey와 같은 셈 — 서로 import하지 않으려고 둘 다 둔다).
const dayKey=at=>{const d=new Date(at-4*3600e3);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};

export const CLUB_TUTORS=Object.freeze(['seoha','taeo','yuna']);
// 튜터 스타일 = 학습 설정 셋(club.mjs의 시안 문구와 같은 값). 하루 분량은 화면에만 보인다(오늘 할 일의 분은 엔진이 정한다).
export const TUTOR_SETTINGS=Object.freeze({
 seoha:Object.freeze({support:'choose',explanation:'detailed',minutes:10}),
 taeo:Object.freeze({support:'independent',explanation:'brief',minutes:5}),
 yuna:Object.freeze({support:'step',explanation:'standard',minutes:5}),
});
const NAME={seoha:'서하',taeo:'태오',yuna:'유나'};

/* ── 순수 함수(시험이 표로 본다) ── */
// 대화 카드로 낼 수 있는 문항: 글 보기(그림 · 그림 문자 보기 아님), 입장 카드 · 그림이 없는 것. 나머지는 「내 위치」 판이 낸다.
const PICTO=/\p{Extended_Pictographic}/u;
export function cardable(item){
 return !!item&&!item.card&&!item.image&&item.ask!=='picture'&&Array.isArray(item.choices)&&item.choices.length>=2
  &&item.choices.every(choice=>typeof choice?.label==='string'&&choice.label&&choice.label.length<=60&&!PICTO.test(choice.label));
}
// 짧은 진단 후보(항목마다 하나)에서 넷: 읽기 · 듣기를 번갈아 둘씩, 쉬운 난도부터. 한쪽이 모자라면 다른 쪽으로 채운다.
export function pickClubRows(rows,max=4){
 const ok=(Array.isArray(rows)?rows:[]).filter(row=>cardable(row?.item));
 const by=modality=>ok.filter(row=>row.item.modality===modality).sort((a,b)=>(a.item.difficulty||1)-(b.item.difficulty||1));
 const read=by('reading'),hear=by('listening'),out=[];
 while(out.length<max&&(read.length||hear.length)){
  const want=out.length%2?hear:read,other=out.length%2?read:hear;
  out.push((want.length?want:other).shift());
 }
 return out;
}
export function explainOf(item,lang='ko'){
 const v=item?.explanation;
 if(typeof v==='string')return v;
 if(v&&typeof v==='object')return v[lang]||v.ko||'';
 return '';
}
// 진단 지도 → 틀에 줄 줄인 지도(첫날 결과 카드와 사흘째 내 위치 카드가 같이 쓴다, 설계 검토 11-25 「고친 A」).
// 칸은 지도 그대로 셋(혼자 해냄 · 연습 중 · 아직)이고 「내 위치」 판과 같다. 이번 대화의 답은 칸에 덧씌우지 않는다 — 맞힘 · 연습할 곳은
// 틀의 목록이 따로 보인다(한 번 맞힌 항목은 지도에서 연습 중이다). 시도 기록(eventId 등)은 넘기지 않는다. 듣기 먼저, 읽기 다음.
export const MAP_CELLS=Object.freeze(['independent','practicing','notyet']);
export function mapView(map,{lang='ko'}={}){
 const skills=(Array.isArray(map?.skills)?map.skills:[]).filter(skill=>skill&&skill.id);
 if(!skills.length)return null;
 const lis=skills.filter(skill=>skill.domain==='listening'||String(skill.id).split('.')[1]==='listening'),rea=skills.filter(skill=>!lis.includes(skill));
 const cells=[...lis,...rea].map(skill=>({id:String(skill.id),domain:lis.includes(skill)?'listening':'reading',cell:MAP_CELLS.includes(skill.cell)?skill.cell:'notyet'}));
 const counts=Object.fromEntries(MAP_CELLS.map(c=>[c,cells.filter(x=>x.cell===c).length]));
 const names=Object.fromEntries(MAP_CELLS.map(c=>{const key=`position.cell.${c}`;let v='';try{v=hasString(key)?t(key,{},lang):'';}catch{v='';}return [c,v];}));
 return {exam:map?.exam==='topik2'?'topik2':'topik1',total:cells.length,listening:lis.length,counts,cells,names};
}
// 오늘 튜터가 알림으로 건넬 한 가지(하루 한 번 · 근거가 없으면 조용히).
// 처음 만남 전: 동아리장 알림. 처음 만난 날: 없음. 그 뒤 하루에 하나 — 놓친 항목 복습 → 셋째 날마다 내 위치 → 오늘 할 일.
// hangulFirst: 지금 계획이 한글 먼저인가(다리가 계획 값 route · gameId로 가려 넘긴다 — 화면 문장으로 가리지 않는다)
export function clubNote({club=null,plan=null,hangul='ask',hangulFirst=false,now=Date.now()}={}){
 if(!club?.tutor||!club.done)return {from:'club',who:'head',kind:'club',code:'club.hello',slots:{}};
 const today=dayKey(now);
 if(!club.at||dayKey(club.at)===today)return null;
 if(club.last?.day===today&&club.last.opened)return null;
 const days=Math.max(1,Math.round((new Date(today.replace(/-/g,'/')).getTime()-new Date(dayKey(club.at).replace(/-/g,'/')).getTime())/864e5));
 const reviewed=new Set(Array.isArray(club.reviewed)?club.reviewed:[]);
 const missed=(Array.isArray(club.results)?club.results:[]).find(row=>row&&!row.ok&&row.skillId&&row.skillId!=='hangul'&&!reviewed.has(row.skillId));
 const who=club.tutor,base={from:'tutor',who};
 // 「한글 이어 하기」는 지금 계획을 연다 — 계획이 한글 먼저일 때만 건넨다(계획이 다른 활동으로 넘어갔으면 다른 알림으로)
 if(days===1&&hangul==='new'&&hangulFirst)return {...base,kind:'review',code:'tutor.review.hangul',slots:{}};
 if(missed&&days%3!==0)return {...base,kind:'review',code:'tutor.review.skill',slots:{skill:missed.labelKo||missed.label||missed.skillId,skillUi:missed.label||missed.skillId,skillId:missed.skillId}};
 // 내 위치: 사흘째 날마다. 한글을 처음 배우는 학생은 「내 위치」가 한글 판이라 뺀다. 글에는 숫자 · 지난 일을 넣지 않고, 칸은 대화를 연 뒤 지도로 받는다(clubMap)
 if(days%3===0&&hangul!=='new')return {...base,kind:'level',code:'tutor.level',slots:{}};
 if(plan?.token)return {...base,kind:'today',code:'tutor.today',slots:{title:plan.title||'',m:plan.min||0,token:plan.token,photo:plan.photo||null}};
 if(missed)return {...base,kind:'review',code:'tutor.review.skill',slots:{skill:missed.labelKo||missed.label||missed.skillId,skillUi:missed.label||missed.skillId,skillId:missed.skillId}};
 return null;
}

/* ── 다리 ── 앞면 다리가 부른다. same()은 요청한 때의 주인이 지금 주인인지, done(view)는 앞면 다음 화면 state */
export function createFrontClub({same,owner,readMark,writeMark,education,progress,lang,plan,openPlan,stateOf,baseUrl=()=>location.href}){
 let run=null,item=null;
 const clubOf=who=>{const v=readMark(who).club;return v&&typeof v==='object'?v:{};};
 const setClub=(who,patch)=>writeMark(who,{club:{...clubOf(who),...patch}});
 const abs=path=>{try{return new URL(path,baseUrl()).href;}catch{return path;}};
 // 항목 이름: 화면 언어(카드 머리 · 결과 줄)와 한국어(튜터 말풍선) 둘 다
 const skillLabel=(id,code)=>{const key=`position.skill.${id}`;try{if(hasString(key))return t(key,{},code);}catch{}return run?.skillName?.(id)||id;};
 const viewOf=now=>now&&{index:now.index,total:now.total,skillId:now.item.skillId,label:skillLabel(now.item.skillId,lang()),labelKo:skillLabel(now.item.skillId,'ko'),modality:now.item.modality,
  audio:now.item.audio?abs(run.audioUrl(now.item.audio)):null,prompt:now.item.prompt||null,question:now.item.question||null,
  choices:now.item.choices.map(choice=>({id:choice.id,label:choice.label}))};
 const close=()=>{try{run?.stop?.();}catch{}run=null;item=null;};
 // 알림 기록(팬 세션과 맞춘 꼴 — { from, who, kind, code, slots, at, read }). 동아리 · 튜터 알림만 갈아 끼우고 다른 알림은 둔다.
 function inbox(who,note){
  const list=(Array.isArray(readMark(who).inbox)?readMark(who).inbox:[]).filter(row=>row&&row.from!=='club'&&row.from!=='tutor');
  if(note)list.push({from:note.from,who:note.who,kind:note.kind,code:note.code,slots:note.slots||{},at:Date.now(),read:false});
  writeMark(who,{inbox:list});
 }
 function noteOf(who,planNow,hangul){
  let raw=null;try{raw=plan();}catch{raw=null;}
  const club=clubOf(who),note=clubNote({club,plan:planNow,hangul,hangulFirst:raw?.route==='game'&&raw?.gameId==='hangul'});
  // 항목 이름은 저장한 글이 아니라 지금 화면 언어로 다시 찾는다(첫날 뒤 언어를 바꿔도 섞이지 않게)
  if(note?.slots?.skillId){const id=note.slots.skillId,ko=skillLabel(id,'ko'),ui=skillLabel(id,lang());if(ko!==id)note.slots.skill=ko;if(ui!==id)note.slots.skillUi=ui;}
  const was=(readMark(who).inbox||[]).find?.(row=>row?.from==='club'||row?.from==='tutor');
  if(!note){if(was)inbox(who,null);return null;}
  // 날이 바뀌면 같은 꼴의 알림이라도 새 알림이다(어제 읽은 표시를 이어 쓰지 않는다)
  if(!was||was.code!==note.code||was.slots?.token!==note.slots?.token||was.slots?.skillId!==note.slots?.skillId||dayKey(was.at||0)!==dayKey(Date.now()))inbox(who,note);
  const row=(readMark(who).inbox||[]).find(r=>r?.from===note.from&&r.code===note.code);
  return {...note,read:!!row?.read,drop:!row?.read&&club.last?.dropped!==dayKey(Date.now())};
 }
 const host={
  // 튜터를 고르면 스타일을 학습 설정에 저장한다(이미 학습 목표 저장에 동의한 학생만 — 동의는 앞면이 따로 묻지 않는다). 아니면 이 기기 표에만.
  // change: 다음 날 튜터 대화의 「튜터 바꾸기」 — 동아리장에게 한 답은 그대로 두고, 바꾼 튜터로 다시 그릴 state를 함께 준다.
  async clubTutor(tutor,{answer=null,change=false}={}){
   if(!same()||!CLUB_TUTORS.includes(tutor))return null;
   const who=owner(),set=TUTOR_SETTINGS[tutor],had=clubOf(who).answer??null;
   setClub(who,{tutor,answer:['some','none','good'].includes(answer)?answer:change?had:null,pickedAt:Date.now()});
   let saved=false;
   try{
    const p=progress()?.learningProfile?.()?.profile||null;
    if(p?.consent){progress().updateLearningProfile({consent:true,expectedRevision:p.revision,values:{...(p.values||{}),support:set.support,explanation:set.explanation}});saved=true;}
   }catch{saved=false;}
   try{education()?.applyPreferences?.();}catch{}
   if(change){let state=null;try{state=same()?await stateOf():null;}catch{state=null;}return {tutor,saved,state};}
   return {tutor,saved};
  },
  // 문항 넷을 고르고 첫 문항을 낸다. 새 길(엔진 판)이거나 대화로 낼 문항이 없으면 판으로 연다(status board · none).
  async clubDiag(){
   if(!same())return null;
   close();
   const ed=education();
   if(typeof ed?.clubCheck!=='function')return {status:typeof ed?.position==='function'?'board':'none'};
   let got;try{got=await ed.clubCheck({pick:rows=>pickClubRows(rows)});}catch{got=null;}
   if(!same())return null;
   if(!got||got.status!=='ready')return {status:got?.status==='board'?'board':'none',reason:got?.reason||null};
   run=got;
   const now=run.session.next();item=now?.item||null;
   return {status:'ready',total:run.total,item:viewOf(now)};
  },
  // 사흘째 내 위치 카드: 대화를 연 뒤 그날의 지도를 받는다(4초 안 · 기다리는 사이 주인이 바뀌면 버림 · 새 길이면 없음)
  async clubMap(){
   if(!same())return null;
   const who=owner();let map=null;
   try{map=await Promise.race([Promise.resolve(education()?.clubMap?.()),new Promise(r=>setTimeout(()=>r(null),4000))]);}catch{map=null;}
   if(!same()||owner()!==who)return null;
   return mapView(map,{lang:lang()});
  },
  async clubReplay(){if(!same()||!run)return null;try{return run.session.replay();}catch{return null;}},
  async clubAudio(status){if(!same()||!run)return null;try{return run.session.delivery(status);}catch{return null;}},
  // 소리를 끝내 못 틀면 그 문항은 건너뛴 것으로 남긴다(엔진 skip — 답하지 않은 문항을 틀렸다고 하지 않는다)
  async clubSkip(){if(!same()||!run)return null;try{return run.session.skip();}catch{return null;}},
  async clubAnswer(choiceId){
   if(!same()||!run||!item)return null;
   const now=item;let row=null;try{row=run.session.answer(choiceId);}catch{row=null;}
   if(!row)return {error:'notReady'};
   return {correct:row.verdict==='correct',correctId:now.correctId,explanation:explainOf(now,lang())};
  },
  async clubNext(){
   if(!same()||!run)return null;
   let now=null;try{now=run.session.next();}catch{now=null;}
   item=now?.item||null;return viewOf(now);
  },
  // 결과: 진단을 마치면(끝 기록 'diagnostic') 바뀐 지도의 칸 · 대화로 본 줄을 기기 표에 남긴다. 문항을 못 냈으면(한글만) 한글 줄만.
  async clubFinish(rows=[]){
   if(!same())return null;
   const who=owner();let out=null;
   if(run){try{out=run.finish();}catch{out=null;}run=null;item=null;}
   const map=mapView(out?.map,{lang:lang()});
   const results=(Array.isArray(rows)?rows:[]).filter(r=>r&&typeof r.skillId==='string').slice(0,8).map(r=>({skillId:r.skillId,label:String(r.label||'').slice(0,60),labelKo:String(r.labelKo||r.label||'').slice(0,40),ok:!!r.ok}));
   setClub(who,{results,finishedAt:Date.now()});
   // 놓친 항목이 있으면 그 항목 짧은 연습으로 잇고(분은 연습 길이가 정한다), 다 맞혔거나 한글부터면 오늘 할 일(분은 계획)로
   const p=plan(),missed=results.find(r=>!r.ok&&r.skillId!=='hangul');
   return {map,minutes:missed||!p?.token||p.route==='position'?null:p.min||null};
  },
  // 「맞춤 연습 시작」: 처음 만남을 마치고 오늘 할 일을 연다(짧은 진단이면 방금 봤으니 열지 않고 맞춤 화면만).
  async clubDone(){
   if(!same())return null;
   const who=owner(),p=plan(),club=clubOf(who),missed=(club.results||[]).find(r=>r&&!r.ok&&r.skillId&&r.skillId!=='hangul');
   setClub(who,{done:true,at:Date.now(),...(missed?{reviewed:[...new Set([...(club.reviewed||[]),missed.skillId])]}:{})});writeMark(who,{ended:true});
   const next=await stateOf();
   // 대화 판이 걷힌 뒤(0.42초) 연다 — 튜터가 말한 대로 놓친 항목의 짧은 연습, 없으면 오늘 할 일(방금 진단을 봤으니 짧은 진단은 열지 않는다)
   const go=missed&&typeof education()?.practice==='function'?()=>education().practice(missed.skillId):p?.token&&p.route!=='position'?()=>openPlan(p.token):null;
   if(go)setTimeout(()=>{if(same())Promise.resolve().then(go).catch(()=>{});},450);
   return next;
  },
  // 판으로 여는 진단(새 길 · 대화 문항 없음). 판이 닫히면 앞면 다리가 다시 그린다.
  async clubBoard(){
   if(!same())return null;
   const who=owner();setClub(who,{done:true,at:Date.now()});writeMark(who,{ended:true});
   const next=await stateOf();
   setTimeout(()=>{if(same())Promise.resolve(education()?.position?.({start:true})).catch(()=>{});},450);
   return next;
  },
  // 알림을 열었다(하루 한 번). 내려오는 알림을 그날 이미 보였으면 다음부터는 작은 얼굴로만.
  async clubSeen({dropped=false,opened=false}={}){
   if(!same())return null;
   const who=owner(),today=dayKey(Date.now()),club=clubOf(who);
   if(dropped)setClub(who,{last:{...(club.last||{}),dropped:today}});
   if(opened){
    const list=(readMark(who).inbox||[]).map(row=>row&&(row.from==='club'||row.from==='tutor')?{...row,read:true}:row);
    writeMark(who,{inbox:list});
    if(club.done)setClub(who,{last:{...(clubOf(who).last||{}),day:today,opened:true}});
   }
   return null;
  },
  // 다음 날 알림의 단추: 복습은 그 항목 짧은 연습, 오늘은 그 할 일, 내 위치는 「내 위치」 판.
  async clubAct(kind,slots={}){
   if(!same())return null;
   const who=owner(),ed=education();
   if(kind==='review'&&slots.skillId){const club=clubOf(who);setClub(who,{reviewed:[...new Set([...(club.reviewed||[]),slots.skillId])]});try{await ed?.practice?.(slots.skillId);}catch{}return null;}
   if(kind==='review'||kind==='today'){const p=plan();const token=slots.token||p?.token;if(token){try{await openPlan(token);}catch{}}return null;}
   if(kind==='level'){try{await ed?.position?.();}catch{}return null;}
   return null;
  },
  // 그만두기(틀이 닫힘 · 주인이 바뀜): 보이던 문항은 건너뛴 것으로 남긴다(짧은 진단과 같다).
  clubStop(){close();},
 };
 // 동의 전에 고른 튜터의 스타일: 앞면 목표 질문에서 처음 동의할 때 함께 저장한다(world-front-entry.mjs chooseGoal)
 const valuesOf=who=>{const set=TUTOR_SETTINGS[clubOf(who).tutor];return set?{support:set.support,explanation:set.explanation}:{};};
 return {host,noteOf,valuesOf,tutorOf:who=>CLUB_TUTORS.includes(clubOf(who).tutor)?clubOf(who).tutor:null,doneOf:who=>!!clubOf(who).done,stop:close,name:t=>NAME[t]||''};
}
