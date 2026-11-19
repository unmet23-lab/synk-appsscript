// 첫날 끝 · 맞춤 앞면(1차)의 앱 쪽 다리. 구현 계획 docs/WORLD_첫날끝_1차_구현계획_20261119.md, 틀과의 약속 experiences/world-front/HOST.md.
// 서울행을 끝낸 학생(arrival.stage==='left')은 튜터 고르기 · 펠트 우리 동네 대신 이 틀을 홈으로 쓴다(결정 11-19 「심사 전으로 당겨」).
// 틀은 기록을 직접 읽거나 쓰지 않는다 — 이 다리가 서울행 기록 · 학습 계획 · 한글 답을 읽어 state를 짓고, 틀의 요청을 지금 앱 함수로 잇는다.
// 판별이 실패하거나 틀을 못 불러오면 조용히 물러나 지금 길(관문 · 튜터 · 동네)로 넘긴다 — 앞면이 앱 입구를 막으면 안 된다.
import {currentLang,onLang} from '../brand-opening/world-lang.mjs';
import {LOOK_FACES} from '../seoul-arrival/data.mjs';
import {lessonById} from './life-content.mjs';

// 스위치: 참이면 서울행을 끝낸 학생에게 앞면을 연다. 거짓이면 지금 길 그대로(로컬 확인은 ?frontAuto=1). 켜는 것도 끄는 것도 공개 한 번이다.
export const FRONT_AUTO=false;
const autoOn=(search=location.search)=>FRONT_AUTO||(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(search).get('frontAuto')==='1');
export const FRONT_MARK_KEY='synk.world.front.v1:';
const FRAME_WAIT_MS=15000;

/* ── 순수 함수(시험이 표로 본다) ── */
// 주소의 바로가기는 그 길 그대로 간다 — 서울행 seoulMode의 bypass와 같은 목록.
export function frontMode(search=''){
 const q=new URLSearchParams(search);
 if(q.get('seoul')==='1'||q.get('drama')==='1'||q.get('me2')==='1'||q.get('cafe')==='1'||q.get('wardrobe')==='1'||q.has('exam')||q.has('tutor')||q.get('opening')==='off')return 'bypass';
 return null;
}
// Atlas 새 엔진(atlasNext)을 켠 주인은 계획이 새 엔진에서 나온다 — 앞면은 옛 계획을 읽으므로 그 주인은 새 엔진 입구로 보낸다(두 길 합치기는 Atlas 설계와 정한다).
export function frontEligible({auto=false,search='',arrival=null,blocked=false,newEngine=false}={}){
 if(!auto||blocked||newEngine||frontMode(search)==='bypass')return false;
 return arrival?.stage==='left';
}
// 하루는 새벽 4시에 바뀐다(밤늦게 1화를 끝낸 학생의 「오늘」이 자정에 끊기지 않게).
export const dayKey=at=>{const d=new Date(at-4*3600e3);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
export function firstDayAt(arrival){
 const scenes=Array.isArray(arrival?.scenes)?arrival.scenes:[];
 const wrap=scenes.find(s=>s.id==='s1e01.wrap')||scenes.find(s=>s.id==='day1.end');
 return wrap?.at||arrival?.updatedAt||null;
}
// 어느 화면으로 여나: 첫날은 끝 화면(끝을 본 뒤 다시 오면 첫날 맞춤), 둘째 날부터는 아침 한 번(목표) 뒤 맞춤.
// PC 창은 이야기가 없어 끝 화면 · 아침을 건너뛴다(첫날은 첫날 맞춤, 다음 날부터 맞춤).
export function frontView({arrival=null,mark={},now=Date.now(),native=false}={}){
 const first=firstDayAt(arrival),sameDay=!first||dayKey(first)===dayKey(now);
 if(native)return sameDay?'more':'front';
 if(sameDay)return mark.ended?'more':'end';
 return mark.day2?'front':'day2';
}
export function recordOf(arrival,{guest=false}={}){
 const b=guest?null:arrival?.best?.s1e01||null,n=Math.min(3,b?.n||0),t2=!!b?.t2,tr=!!b?.tr;
 const scenes=Array.isArray(arrival?.scenes)?arrival.scenes:[];
 const mom=!guest&&!!arrival?.momAnswer&&arrival.momAnswer!=='later';
 return {spoke:n+(t2?1:0)+(tr?1:0),n,t2,tr,mom,momAnswer:mom?(arrival.momAnswer==='ok'?'ok':'fix'):null,wrap:!guest&&scenes.some(s=>s.id==='s1e01.wrap')};
}
export function studentOf(arrival){
 const look=arrival?.look||null,crop=look?LOOK_FACES[look]:null;
 return {name:arrival?.name||'',nameEn:arrival?.nameEn||'',nameCy:'',call:arrival?.call||'',from:arrival?.from||'',
  face:look?`../seoul-arrival/assets/img/look-${look.replace('_','-')}.webp`:null,faceCrop:crop?{fx:crop.fx,fy:crop.fy,fw:crop.fw}:null,card:null};
}
// 할 일 하나 → 틀의 Item. 사진 · 다루는 것은 시안 10z6의 표(그 레슨이 실제로 가르치는 말), 표에 없는 것은 비워 둔다.
const PACK_PHOTO={greetings:'ph9-greet',cafe:'ph8-cafe',store:'ph6-store',directions:'ph3-way',plans:'ph3-plan',transit:'ph9-travel'};
const TOPIC={'greetings-expressions':'만남 · 감사 · 소개 · {m}분','cafe-expressions':'주문 · 매장 이용 · 포장 · {m}분','store-expressions':'가격 · 봉투 · 카드 결제 · {m}분',
 'directions-expressions':'위치 묻기 · 방향 · 주변 장소 · {m}분','plans-expressions':'약속 시간 · 장소 · 늦는 연락 · {m}분'};
const GAME={hangul:{photo:'ph9-hangul',topic:'소리 듣기 · 글자 고르기 · 따라 쓰기',kind:'한글 · {m}분',line:'한글부터 해요',lineTomorrow:'내일은 한글부터 해요'},
 rhythm:{photo:'ph3-rhythm',topic:'박자 맞춰 읽기'},runner:{photo:'ph3-rhythm',topic:'짧은 지시 듣기'}};
// 앞면에는 마스코트 이름이 든 말을 보이지 않는다(생활 원고의 마스코트 대사는 2단에서 고친다 — 구현 계획 7절).
const MASCOT=/몽글|까몽|마린/;
export function itemOf(entry,{label=e=>e?.label||''}={}){
 if(!entry)return null;
 const route=entry.route||'lesson',lesson=entry.lessonId?lessonById(entry.lessonId):null,game=route==='game'?GAME[entry.gameId]||null:null;
 const raw=String(entry.label||lesson?.title||'').trim(),title=route==='lesson'||route==='review'?raw:raw.split(' · ')[0];
 const kind=route==='game'?(game?.kind||'놀이 · {m}분'):route==='position'?'짧은 진단 · {m}분':route==='practice'?'짧은 연습 · {m}분':route==='mock'?'시험 형식 연습 · {m}분':'생활 한국어 · {m}분';
 const photo=lesson?PACK_PHOTO[lesson.packId]:route==='review'?PACK_PHOTO[entry.packId]:game?game.photo:route==='practice'?'ph3-read':['position','mock'].includes(route)?'ph6-exam':'ph3-read';
 const topic=TOPIC[entry.lessonId]||game?.topic||(route==='position'?'시작점 확인':route==='practice'?'짧은 글 읽기':null);
 let says=null;
 if(lesson&&route==='lesson'){const list=(lesson.expressions||[]).map(e=>e?.korean).filter(s=>typeof s==='string'&&s&&!MASCOT.test(s)).slice(0,3);says=list.length===3?list:null;}
 let ui='';try{ui=label(entry)||'';}catch{ui='';}
 return {token:entry.id||null,title,titleUi:ui&&ui!==raw?ui.split(' · ')[0]:title,kind,min:Number(entry.minutes)||null,reason:null,
  line:route==='position'?'처음 보는 문제로 짧게 확인해요.':game?.line||null,lineTomorrow:game?.lineTomorrow||null,photo,topic,says};
}
// 계획의 이유 코드 → 앞면 문장(시안 10z6과 같은 말). 표에 없는 코드는 엔진 문장 그대로.
const REASON_ORDER=[['plan.recheck','시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.'],['progress.prerequisite','한글부터 만나요. 소리를 듣고 글자를 고르며 읽는 법을 익혀요.'],
 ['progress.next','마친 레슨 바로 다음이에요. 처음 보는 표현이 나와요.'],['goal.declared','직접 고른 목표와 이어지는 활동이에요. 짧게 시작해 봐요.'],['practice.unseen','아직 안 해 본 것부터 해요.']];
export function reasonOf(plan){
 const codes=new Set(Array.isArray(plan?.reasons)?plan.reasons:[]);
 for(const [code,text] of REASON_ORDER)if(codes.has(code))return text;
 return typeof plan?.reason==='string'?plan.reason:'';
}
export function planState(plan,{label}={}){
 if(!plan?.selected)return {plan:null,alts:[]};
 const main=itemOf(plan.selected,{label});if(main)main.reason=reasonOf(plan);
 const alts=(Array.isArray(plan.alternatives)?plan.alternatives:[]).filter(e=>e&&e.id!==plan.selected.id).slice(0,2).map(e=>itemOf(e,{label}));
 return {plan:main,alts};
}
// 둘째 날 목표 → 학습 목표의 이유 값(학습 목표 창과 같은 값, world-learning-plan REASON_BROAD_GOAL 열쇠).
export const GOAL_REASONS=Object.freeze({travel:'travel',people:'people',life:'life',work:'work',culture:'culture',exam:'exam'});

/* ── 다리 ── */
export function createFrontEntry({client,life,home,worldUrl,launchGame,openLife,signIn,openStory,profile,storage=globalThis.localStorage,
 native=()=>false,guestArrival=()=>null,blocked=()=>false,newEngine=()=>false,hangulReading,setHangulReading,goalConsent=()=>({needed:true,label:'',note:''})}){
 const owner=()=>client().snapshot?.accountId||'guest';
 let session=null;
 const accountArrival=()=>{try{return life.progress?.arrival?.()??null;}catch{return null;}};
 const arrivalOf=who=>who==='guest'?guestArrival():accountArrival();
 const markKey=who=>`${FRONT_MARK_KEY}${who}`;
 function readMark(who){try{const v=JSON.parse(storage.getItem(markKey(who))||'null');return v&&typeof v==='object'?v:{};}catch{return {};}}
 function writeMark(who,patch){try{storage.setItem(markKey(who),JSON.stringify({...readMark(who),...patch}));}catch{/* 사생활 창: 이번에는 화면만 넘어간다 */}}
 const on=()=>autoOn();
 // 서울행 도중(아직 stage가 left가 아님)에 「끝나면 앞면으로 가나」 — 서울행 끝 단추 글을 고를 때 쓴다(자격에서 서울행 단계만 뺀 것).
 function soon(){
  try{return frontEligible({auto:on(),search:location.search,arrival:{stage:'left'},blocked:!!blocked(),newEngine:!!newEngine(owner())});}catch{return false;}
 }
 function free(){
  try{return frontEligible({auto:on(),search:location.search,arrival:arrivalOf(owner()),blocked:!!blocked(),newEngine:!!newEngine(owner())});}catch{return false;}
 }
 const education=()=>life.education||null;
 function profileOf(){try{return life.progress?.learningProfile?.()?.profile||null;}catch{return null;}}
 // 계정에 저장된 목표(다른 기기나 학습 목표 창에서 고른 것) → 앞면 목표 열쇠. 기기 표에 목표가 없을 때 쓴다.
 function accountGoal(){
  const p=profileOf();if(!p?.consent)return '';
  const r=p.primaryReason||(Array.isArray(p.reasons)&&p.reasons.length===1?p.reasons[0]:null);
  return Object.keys(GOAL_REASONS).find(k=>GOAL_REASONS[k]===r)||'';
 }
 function currentPlan(){try{education()?.refresh?.();return education()?.metrics?.().plan||null;}catch{return null;}}
 async function stateOf(view){
  const who=owner(),arrival=arrivalOf(who),guest=who==='guest',pc=!!native();
  let hangul='ask';try{const answer=await hangulReading(who);hangul=answer?.answer==='new'?'new':answer?.answer==='reads'?'reads':'ask';}catch{hangul='ask';}
  const mark=readMark(who);
  const {plan,alts}=planState(currentPlan(),{label:entry=>home.planLabel?.(entry)||entry?.label||''});
  let consent={needed:true,label:'',note:''};try{consent={...consent,...(goalConsent()||{})};}catch{}
  // 이미 학습 목표 저장에 동의한 학생에게는 체크 상자를 다시 그리지 않는다(학습 목표 창과 같다).
  if(profileOf()?.consent)consent={...consent,needed:false};
  return {view,lang:currentLang(),who:pc?'pc':guest?'guest':'login',dream:arrival?.dream||'idol',student:studentOf(arrival),record:recordOf(arrival,{guest}),
   hangul,after:!!mark.after,goal:view==='front'?(mark.goal||accountGoal()):'',step:'',plan,alts,today:todayOf(arrival,mark,{guest,pc,view}),position:null,consent,reduced:!!home.state?.reduced};
 }
 // 「오늘 한 것」: 있는 사실만. card · lines · heard · mom은 틀이 세 언어 글로 쓰고, practice는 그 활동의 화면 언어 이름을 그대로 쓴다.
 function todayOf(arrival,mark,{guest,pc,view}){
  const rows=[];
  if(arrival?.name&&!pc)rows.push({key:'card',label:'학생증'});
  const r=recordOf(arrival,{guest});
  if(r.spoke>0)rows.push({key:'lines',label:`1화 · ${r.spoke}줄`});
  else if(r.wrap)rows.push({key:'heard',label:'1화 끝까지 들음'});
  if(r.mom)rows.push({key:'mom',label:'엄마에게 답장'});
  if(mark.after&&mark.afterEntry&&view!=='front'){let label='';try{label=home.planLabel?.(mark.afterEntry)||'';}catch{}rows.push({key:'practice',label:(label||mark.afterEntry.label||'').split(' · ')[0]});}
  return rows;
 }
 // 첫 연습을 「마쳤나」: 레슨은 연 뒤에 끝낸 기록이 있어야 하고, 그 밖의 활동은 엔진이 다음 추천으로 넘어갔어야 한다(연 것만으로는 적지 않는다).
 function finished(pending){
  const {entry,at}=pending;
  if(entry.route==='lesson'&&entry.lessonId){try{const done=life.progress?.lessonState?.(entry.lessonId)?.completedAt,t=typeof done==='number'?done:Date.parse(done);return Number.isFinite(t)&&t>=at-1000;}catch{return false;}}
  // 레슨이 아닌 활동(놀이 · 짧은 연습 · 진단 · 복습 · 시험 형식)은 끝낸 기록을 따로 읽지 못한다 — 연 뒤에 엔진의 추천이 바뀌었을 때만 마친 것으로 본다.
  const now=currentPlan()?.selected?.id||null;
  return !!pending.before&&!!now&&now!==pending.before;
 }
 async function show(view){
  const s=session;if(!s?.api)return;
  const who=owner();s.view=view;
  try{const next=await stateOf(view);if(session===s&&s.view===view&&owner()===who&&s.owner===who)s.api.show(next);}catch(error){console.warn('Front state failed',error);}
 }

 /* ── 틀 ── 서울행과 같은 전체 화면 dialog. 레슨 · 게임 시트(#world-panel)는 그 위에 모달로 뜨고, 닫히면 앞면을 다시 그린다 */
 function mount(){
  if(session?.dialog)return session;
  const dialog=document.createElement('dialog');dialog.id='front-layer';dialog.className='seoul-layer front-layer';
  const frame=document.createElement('iframe');frame.title='SYNK WORLD';frame.setAttribute('allow','autoplay');frame.className='seoul-frame';frame.src=worldUrl('world-front/');
  dialog.append(frame);document.body.append(dialog);
  const s={dialog,frame,api:null,owner:owner(),view:null,closing:false};session=s;
  s.ready=new Promise(res=>{s.markReady=res;});
  dialog.addEventListener('cancel',event=>event.preventDefault());
  dialog.addEventListener('close',()=>{if(!s.closing&&dialog.isConnected)try{dialog.showModal();}catch{}});
  try{dialog.showModal();}catch{dialog.show();}
  window.SYNKFrontHost=host;
  const panel=document.querySelector('#world-panel');
  s.onPanelClose=()=>setTimeout(()=>{
   if(session!==s||panel?.open)return;
   const pending=s.pending;s.pending=null;
   if(pending&&pending.view==='more'&&s.owner===owner()&&!readMark(s.owner).after&&finished(pending))
    writeMark(s.owner,{after:true,afterEntry:{id:pending.entry.id,label:pending.entry.label||'',route:pending.entry.route,lessonId:pending.entry.lessonId||null,gameId:pending.entry.gameId||null,skillId:pending.entry.skillId||null}});
   // 앞면에서 연 활동을 닫고 왔을 때만 첫날 끝 → 첫날 맞춤, 둘째 날 아침 → 맞춤으로 넘긴다. 다른 시트(기록 옮기기 · 로그인 · 알림)가 닫히면 같은 화면을 다시 그린다.
   void show(pending?(s.view==='end'||s.view==='off'?'more':s.view==='day2'?'front':s.view):s.view);
  },0);
  panel?.addEventListener('close',s.onPanelClose);
  return s;
 }
 function drop(){
  const s=session;if(!s)return;session=null;s.closing=true;
  document.querySelector('#world-panel')?.removeEventListener('close',s.onPanelClose);
  try{s.dialog.close();}catch{}s.dialog.remove();
  if(window.SYNKFrontHost===host)delete window.SYNKFrontHost;
 }
 // 관문을 지난 뒤(onEnter) 부른다. 앞면 학생이면 틀을 올리고 참을 돌려준다.
 async function enter(){
  if(!free())return false;
  const who=owner(),mark=readMark(who);
  let view=frontView({arrival:arrivalOf(who),mark,native:!!native()});
  // 다른 기기에서 이미 목표를 골랐으면 둘째 날 아침의 목표 질문을 다시 하지 않는다.
  if(view==='day2'&&!mark.goal&&accountGoal())view='front';
  const s=mount();
  const api=await Promise.race([s.ready,new Promise(res=>setTimeout(()=>res(null),FRAME_WAIT_MS))]);
  if(!api||session!==s||owner()!==who){if(session===s)drop();return false;}
  await show(view);
  return true;
 }
 function onIdentity(){if(session&&session.owner!==owner())drop();}
 onLang(code=>{try{session?.api?.setLang(code);}catch{}});

 /* ── 부모 통로 ── 틀(같은 출처)이 부른다. 요청한 때의 주인이 지금 주인일 때만 쓴다 */
 const same=()=>!!session&&session.owner===owner();
 const host=Object.freeze({
  ready(api){const s=session;if(!s)return;s.api=api;try{api.setLang(currentLang());}catch{}s.markReady(api);},
  async answerHangul(value){
   // 관문의 한글 질문과 같은 질문이라 출처 값도 'question'이다(학습 기록이 받는 값만 쓴다).
   if(!same()||!['reads','new'].includes(value))return null;
   const s=session,who=owner();
   try{await setHangulReading(value,who,{via:'question'});}catch(error){home.toast?.(error?.message||'');return null;}
   if(session!==s||!same()||owner()!==who)return null;
   return stateOf(s.view);
  },
  async chooseGoal(goal,{consent=false}={}){
   if(!same())return null;
   const who=owner();
   if(goal==='later_'){writeMark(who,{day2:true,goal:'later_'});session.view='front';return stateOf('front');}
   const reason=GOAL_REASONS[goal];if(!reason)return null;
   const progress=life.progress;
   let profile=null;try{profile=progress?.learningProfile?.()?.profile||null;}catch{profile=null;}
   if(!consent&&!profile?.consent)return {error:'needConsent'};
   try{progress.updateLearningProfile({consent:true,expectedRevision:profile?.revision,values:{reasons:[reason],primaryReason:reason,goal:null}});}
   catch(error){home.toast?.(error?.message||'');return null;}
   writeMark(who,{day2:true,goal});session.view='front';
   return stateOf('front');
  },
  async bye(){if(!same())return null;writeMark(owner(),{ended:true});session.view='off';return null;},
  async more(){if(!same())return null;writeMark(owner(),{ended:true});session.view='more';return stateOf('more');},
  async seen(key){if(!same())return null;if(key==='day2')writeMark(owner(),{day2:true});return null;},
  async open(token){
   if(!same())return null;
   const plan=currentPlan(),entry=[plan?.selected,...(plan?.alternatives||[])].find(e=>e?.id===token);
   if(!entry)return null;
   const s=session;s.pending={entry,at:Date.now(),view:s.view,before:plan?.selected?.id||null};
   try{await launch(entry);}catch(error){if(s.pending?.entry===entry)s.pending=null;throw error;}
   // 시트가 뜨지 않았으면(준비 실패 · 취소) 남긴 기록을 지운다 — 다른 시트가 닫힐 때 첫날 끝을 넘기지 않게.
   if(s.pending?.entry===entry&&!document.querySelector('#world-panel')?.open)s.pending=null;
   return null;
  },
  // 「이야기」는 서울행 자기 창을 띄운다(#world-panel이 아니다) — 닫히면 1화 기록 · 엄마 답이 바뀌었을 수 있어 새 state를 돌려준다.
  async openStory(){
   if(!same()||native())return null;
   const s=session,who=owner();s.pending=null;
   try{await openStory?.();}catch{}
   if(session!==s||owner()!==who)return null;
   return stateOf(s.view);
  },
  async openTab(tab){if(!same())return null;session.pending=null;if(tab==='learn')return openLife('packs');if(tab==='play')return home.showPlay?.();return null;},
  async openAll(){if(!same())return null;session.pending=null;try{return education()?.position?.();}catch{return null;}},
  async openMe(){if(!same())return null;session.pending=null;return profile?.();},
  async signIn(){if(session)session.pending=null;return signIn?.();}
 });
 // 고른 활동 열기 — 학습 화면 launch(world-learning-ui.mjs)와 같은 갈래. 첫날에는 목표 창을 거치지 않는다(네 갈래 검토 12절 ③).
 function launch(entry){
  const ed=education();
  if(entry.route==='game')return launchGame(entry.gameId);
  if(entry.route==='review')return openLife('reviewStart',entry.lessonId,entry.reviewIds);
  if(entry.route==='practice')return ed?.practice?.(entry.skillId);
  if(entry.route==='position')return ed?.position?.({start:true});
  if(entry.route==='mock')return ed?.mock?.();
  return openLife('start',entry.lessonId);
 }
 return Object.freeze({on,soon,free,enter,drop,onIdentity,active:()=>!!session,host});
}
