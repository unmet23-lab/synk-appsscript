// 서울행 앱 쪽(설계 experiences/seoul-arrival/설계.md 3 · 5 · 6절). 새 학생 판별 · 전체 화면 틀 · 부모 통로 · 손님 사본 옮기기 · 1화 잇기.
// 판별이 실패하거나 틀을 못 불러오면 조용히 물러나 지금의 입장 관문으로 넘긴다 — 서울행이 앱 입구를 막으면 안 된다.
import {readArrival} from './seoul-record.mjs';
import {watchEpisode,EPISODE} from './seoul-watch.mjs';
import {currentLang,hasChosenLang,setLang,suggestedLang,onLang} from '../brand-opening/world-lang.mjs';
import {openLangPicker} from '../brand-opening/lang-picker.mjs';

// 스위치: 참이면 새 학생에게 저절로 연다. 거짓이면 ?seoul=1과 이 기기에서 시작한 손님만 열린다 — 로그인한 채 시작한 학생은 우리 동네의 「내 길」 문으로 돌아온다(설계 11절 공개 순서).
// 설정값(features)은 계정 묶음 안 operating-mode가 걸러 묶음을 다시 만들어야 해서, 이 파일의 상수로 둔다. 켜는 것도 공개 한 번이다.
// 11-06 켬(유호님 「synk.im 서울행 스위치 켜기」 — 끈 채 공개한 라이브 ?seoul=1을 보신 뒤). 튜터를 고른 학생 · PC 앱 창은 그대로다(seoulDecision).
export const SEOUL_AUTO=true;
const autoOn=()=>SEOUL_AUTO||(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('seoulAuto')==='1');
export const GUEST_ARRIVAL_KEY='synk.world.arrival.v1:guest';
const FRAME_WAIT_MS=15000;
// 앱 쪽 글(화면 언어). world-strings.mjs에 넣으면 드라마 시범판 학습 묶음까지 다시 만들어야 해서 여기 둔다. 틀 안 글은 seoul-arrival/strings.mjs.
const TEXT={
 road:{ko:'내 길',en:'My road',mn:'Миний зам'},
 toCrowd:{ko:'내 객석으로',en:'To my audience',mn:'Үзэгчид рүүгээ'},
 signIn:{ko:'학생증을 계정에 저장하고 1화를 시작해요',en:'Save your student ID to your account and start Episode 1',mn:'Оюутны үнэмлэхээ бүртгэлдээ хадгалаад 1-р ангийг эхлүүлээрэй'},
 dramaTitle:{ko:'1화 · 개강 첫날',en:'Episode 1 · First day of class',mn:'1-р анги · Хичээлийн эхний өдөр'},
 moveTitle:{ko:'학생증 저장',en:'Save student ID',mn:'Оюутны үнэмлэх хадгалах'},
 moveLead:{ko:'이 기기에서 만든 학생증이 있어요. 이 계정에 저장할까요?',en:'There’s a student ID made on this device. Save it to this account?',mn:'Энэ төхөөрөмж дээр хийсэн оюутны үнэмлэх байна. Энэ бүртгэлд хадгалах уу?'},
 moveBody:{ko:'내가 만든 학생증이 아니면 「아니요」를 눌러 주세요.',en:'If you didn’t make this one, choose “No.”',mn:'Хэрэв өөрөө хийгээгүй бол «Үгүй»-г дараарай.'},
 moveYes:{ko:'저장하고 이어 가기',en:'Save and continue',mn:'Хадгалаад үргэлжлүүлэх'},
 moveNo:{ko:'아니요, 저장 안 할게요',en:'No, don’t save it',mn:'Үгүй, хадгалахгүй'},
 dreamIdol:{ko:'아이돌의 꿈',en:'An idol’s dream',mn:'Айдолын мөрөөдөл'},
 dreamActor:{ko:'배우의 꿈',en:'An actor’s dream',mn:'Жүжигчний мөрөөдөл'},
 failed:{ko:'잠시 뒤 다시 열어 주세요.',en:'Please try again in a moment.',mn:'Түр хүлээгээд дахин нээнэ үү.'},
 backRoad:{ko:'내 길로 돌아가기',en:'Back to my road',mn:'Зам руугаа буцах'},
 unsaved:{ko:'이번 이야기는 계정에 저장하지 못했어요.',en:'We couldn’t save this story to your account.',mn:'Энэ түүхийг бүртгэлдээ хадгалж чадсангүй.'},
};
export const seoulText=(key,lang=currentLang())=>TEXT[key]?.[lang]??TEXT[key]?.ko??key;
const t=key=>seoulText(key);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 주소의 바로가기는 그 길 그대로 간다(bypass — 손님 사본이 있어도 서울행 · 저장 묻기로 가로채지 않는다). ?seoul=1은 스위치와 상관없이 연다.
export function seoulMode({search='',feature=false,dramaPending=false}={}){
 const q=new URLSearchParams(search);
 if(q.get('seoul')==='1')return 'force';
 if(dramaPending||q.get('drama')==='1'||q.get('me2')==='1'||q.get('cafe')==='1'||q.get('wardrobe')==='1'||q.has('exam')||q.has('tutor')||q.get('opening')==='off')return 'bypass';
 return feature?'auto':null;
}
// 무엇을 할지 — 순수 함수(시험이 표로 본다). at: 'title'(틀의 시작 화면) | 'road'(내 길)
export function seoulDecision({mode=null,owner='guest',arrival=null,guest=null,tutor=false,blocked=false,native=false}={}){
 if(native||blocked||mode==='bypass')return {run:false};
 if(owner!=='guest'&&!arrival&&guest)return {run:true,ask:true};
 const own=owner==='guest'?guest:arrival;
 if(own){
  // ?seoul=1이 처음부터 다시 보여 주는 것은 끝낸 기록뿐이다. 가는 중이면 이어 간다 — 1화 앞 로그인으로 다시 불린 ?seoul=1이 내 길 대신 타이틀로 돌려보내면 안 된다.
  if(own.stage==='left')return mode==='force'?{run:true,at:'title',replay:true}:{run:false};
  return {run:true,at:own.stage==='card'?'road':'title'};
 }
 if(!mode||(mode==='auto'&&tutor))return {run:false};
 return {run:true,at:'title',fresh:true};
}

export function createSeoulEntry({dramaPending,restored,operating,client,life,home,worldUrl,launchGame,signIn,show,close,selectLanguage,tutorStatus,native}){
 const owner=()=>client().snapshot?.accountId||'guest';
 const mode=()=>seoulMode({search:location.search,feature:autoOn(),dramaPending:dramaPending()});
 let session=null,decision=null,moveAnswer=null;
 function readGuest(){try{return readArrival(JSON.parse(localStorage.getItem(GUEST_ARRIVAL_KEY)||'null'));}catch{return null;}}
 function writeGuest(value){try{localStorage.setItem(GUEST_ARRIVAL_KEY,JSON.stringify(value));}catch{/* 사생활 창: 지금 값으로 이야기는 이어 간다 */}}
 function dropGuest(){try{localStorage.removeItem(GUEST_ARRIVAL_KEY);}catch{}}
 const accountArrival=()=>{try{return life.progress?.arrival?.()??null;}catch{return null;}};
 const mine=who=>who==='guest'?readGuest():accountArrival();
 const hasLocalTutor=()=>{try{for(let i=0;i<localStorage.length;i++)if(localStorage.key(i)?.startsWith('synk.world.tutor.v1:'))return true;}catch{}return false;};
 const languageReady=()=>hasChosenLang()||suggestedLang()==='ko';
 // 서울행을 살펴볼 까닭이 있는가(없으면 입구 길은 지금 코드 그대로다).
 function active(){const m=mode();return m!=='bypass'&&(!!m||!!readGuest());}

 /* ── 판별 ── 복원 → 생활 기록 → 표 */
 async function decide(){
  const first=await restored;
  const who=owner(),generation=client().generation;
  if(native())return {run:false};
  // 저장된 로그인을 서버 · 네트워크 오류로 못 되살렸으면 손님으로 보지 않고 물러난다 — 기존 학생이 서울행에 들어가지 않고 지금의 복구 창을 본다
  if(first?.failed&&!client().snapshot)return {run:false};
  await life.ensure();
  if(who!==owner()||generation!==client().generation)return {run:false};
  // 계정인데 계정 진도를 못 열어 이 기기 기록으로 섰으면 튜터를 읽을 수 없다 — 물러나 관문의 복구 창에 맡긴다(app-shell prepareWorldTutor와 같은 조건)
  if(who!=='guest'&&!life.progress?.status?.()?.scoped)return {run:false};
  let blocked=false;try{blocked=!!tutorStatus(who)?.blocked;}catch{blocked=true;}
  const guest=readGuest(),arrival=who==='guest'?null:accountArrival();
  // 계정에 이미 있으면 계정이 이기고, 이 기기 손님 사본은 다음 사람에게 남기지 않는다
  if(who!=='guest'&&arrival&&guest)dropGuest();
  let tutor=false;try{tutor=!!home.tutor?.()?.tutor||!!life.progress?.selectedTutor?.();}catch{}
  return {...seoulDecision({mode:mode(),owner:who,arrival,guest:who==='guest'||!arrival?guest:null,tutor,blocked,native:false}),owner:who};
 }
 const decided=()=>decision||(decision=decide().catch(error=>{console.warn('Seoul entry skipped',error);return {run:false};}));

 /* ── 틀 ── 타이틀 아래에 비모달로 미리 받아 두고, 타이틀이 닫히면 같은 틀을 모달로 올린다(다시 받지 않는다) */
 function mountFrame(){
  if(session?.dialog)return session;
  const dialog=document.createElement('dialog');dialog.id='seoul-layer';dialog.className='seoul-layer';
  const frame=document.createElement('iframe');frame.title='SYNK WORLD';frame.setAttribute('allow','autoplay; fullscreen');frame.className='seoul-frame';frame.src=worldUrl('seoul-arrival/');
  dialog.append(frame);document.body.append(dialog);dialog.inert=true;dialog.classList.add('is-waiting');dialog.show();
  const s=session||{};Object.assign(s,{dialog,frame,api:null,closing:false,tapped:false,begun:false,owner:owner(),pending:{}});session=s;
  s.ready=new Promise(res=>{s.markReady=res;});
  dialog.addEventListener('cancel',event=>event.preventDefault());
  // 안드로이드 뒤로 가기 등으로 닫히면 다시 올린다. 페이지를 떠나면 저장된 자리에서 이어진다.
  dialog.addEventListener('close',()=>{if(!s.closing&&dialog.isConnected)try{dialog.showModal();}catch{}});
  installHost();
  return s;
 }
 function flushPending(){
  const s=session;if(!s||s.owner==='guest'||!Object.keys(s.pending||{}).length||owner()!==s.owner)return;
  let saved=false;try{saved=!!life.progress?.setArrival?.(s.pending);}catch{}
  if(saved)s.pending={};else home.toast?.(t('unsaved'));
 }
 function dropFrame(){
  if(!session)return;const s=session;session=null;s.closing=true;
  try{s.dialog?.close();}catch{}s.dialog?.remove();
  if(window.SYNKSeoulHost===host)delete window.SYNKSeoulHost;
 }
 function reveal(d){d.inert=false;d.classList.remove('is-waiting');}
 function raise(){const d=session?.dialog;if(!d)return;session.raised=true;reveal(d);try{if(d.open)d.close();d.showModal();}catch{/* 이미 모달 */}}
 const insets=()=>{const probe=document.createElement('div');probe.style.cssText='position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';document.body.append(probe);const c=getComputedStyle(probe),out={sat:parseFloat(c.paddingTop)||0,sab:parseFloat(c.paddingBottom)||0};probe.remove();return out;};
 onLang(code=>{try{session?.api?.setLang(code);}catch{}const door=document.querySelector('#my-road-button');if(door)door.textContent=seoulText('road',code);});

 /* ── 부모 통로 ── 틀(같은 출처)이 부른다. 저장은 그때의 주인에게만 쓴다. 다시 보기 중에는 틀이 부르지 않는다(app.mjs save · state.replayOf) */
 function save(patch){
  const s=session;if(!s||!patch||typeof patch!=='object'||Array.isArray(patch))return;
  const who=owner();if(who!==s.owner)return;
  // 틀에서 온 값은 다른 창의 객체라 이 창의 검사(프로토타입 비교)를 못 지난다 — 글자로 옮겨 받는다
  const merged={...s.pending,...JSON.parse(JSON.stringify(patch))};
  if(who==='guest'){const value=readArrival({...(readGuest()||{}),...merged,version:1,updatedAt:Date.now()});if(value)writeGuest(value);s.pending={};return;}
  try{if(!life.progress?.setArrival?.(merged)){s.pending=merged;return;}s.pending={};}catch{s.pending=merged;/* 끊김 · 불러오는 중 · 기록을 다시 세우는 중: 다음 저장이 함께 쓴다. 충돌은 관문의 복구 창이 맡는다 */}
 }
 function prepareEpisode(){
  if(operating&&!client().snapshot){signIn(undefined,t('signIn'),t('backRoad'));return {status:'signin'};}
  return {status:'ok'};
 }
 async function openEpisode({onScene=()=>{}}={}){
  const panel=document.querySelector('#world-panel');
  return new Promise(resolve=>{
   let lines=null,watcher=null,finished=false;
   const done=()=>{if(finished)return;finished=true;panel.removeEventListener('close',onClose);watcher?.dispose();document.querySelector('.seoul-cta')?.remove();resolve(lines?{status:'wrap',lines}:{status:'closed'});};
   // 패널 내용만 바뀔 때는 닫히지 않는다(불러오는 중 → 게임). 다음 틱에도 닫혀 있으면 끝.
   const onClose=()=>setTimeout(()=>{if(!panel.open)done();},0);
   panel.addEventListener('close',onClose);
   Promise.resolve(launchGame('drama',{seoul:true})).then(()=>{
    const frame=document.querySelector('#panel-content .game-frame');
    if(!panel.open){done();return;}
    if(!frame)return;   // 로그인 · 오류 판: 닫히면 내 길로
    watcher=watchEpisode(frame,{onScene,onWrap(read){lines=read;try{onScene({id:`${EPISODE}.wrap`,lines:read.n});}catch{}showBand();}});
   }).catch(()=>{if(!panel.open)done();});
  });
 }
 // 오늘 기록 아래 띠. 시범판 단추를 가리지 않게 틀 높이를 그만큼 줄인다
 function showBand(){
  const content=document.querySelector('#panel-content');if(!content||content.querySelector('.seoul-cta'))return;
  const band=document.createElement('div');band.className='seoul-cta';band.innerHTML=`<button type="button" class="felt-button">${escape(t('toCrowd'))}</button>`;
  band.querySelector('button').addEventListener('click',()=>{try{session?.api?.wake();}catch{}close();});
  content.append(band);
 }
 let finish=()=>{};
 const host=Object.freeze({
  ready(api){const s=session;if(!s)return;s.api=api;try{api.setLang(currentLang());}catch{}s.markReady?.(api);},
  reduced:()=>!!home.state?.reduced,insets,save,prepareEpisode,openEpisode,
  leave(){finish();},
 });
 function installHost(){window.SYNKSeoulHost=host;}

 /* ── 타이틀 ── 타이틀을 누른 바로 그 순간(opening.mjs onTap, 동기). 참이면 타이틀이 꽃가루 없이 바로 닫힌다 */
 function beforeTitle(){
  if(!active()||native())return;
  const guest=readGuest();
  // 돌아온 학생 · 끝낸 손님에게 틀을 괜히 받지 않는다(저장 묻기 뒤 필요해지면 run이 그때 받는다)
  if(mode()!=='force'&&(guest?guest.stage==='left':hasLocalTutor()))return;
  mountFrame();
  void decided().then(d=>{note(d);if(!d.run&&session&&!session.begun&&!session.tapped)dropFrame();});
 }
 function tap(){
  const s=session;if(!s?.api)return false;
  try{s.api.unlock();}catch{}
  s.tapped=true;
  const d=s.decision;
  if(d?.run&&d.fresh&&languageReady()){
   if(!hasChosenLang()){setLang('ko');try{selectLanguage?.('ko');}catch{}}
   reveal(s.dialog);
   try{s.api.start({at:'title',handoff:true});s.begun=true;s.api.begin();}catch{s.begun=false;s.dialog.inert=true;s.dialog.classList.add('is-waiting');return false;}
   return true;
  }
  return false;
 }
 // 판별이 먼저 끝나면 탭에서 쓸 수 있게 적어 둔다
 function note(d){if(session){session.decision=d;if(d.owner)session.owner=d.owner;}return d;}

 /* ── 손님 사본 옮기기: 저절로 옮기지 않고 한 번 묻는다 ── */
 function askMove(guest){
  const D=guest.dream==='actor'?t('dreamActor'):t('dreamIdol');
  return new Promise(resolve=>{
   moveAnswer=value=>{moveAnswer=null;panel.removeEventListener('close',closed);close();resolve(value);};
   const panel=document.querySelector('#world-panel'),closed=()=>setTimeout(()=>{if(moveAnswer&&!panel.open){moveAnswer=null;panel.removeEventListener('close',closed);resolve('later');}},0);
   show(t('moveTitle'),`<div class="ws-signin"><p class="ws-lead">${escape(t('moveLead'))}</p><div class="world-notice" data-tone="ok" data-label="ID"><strong>${escape([guest.name,D].filter(Boolean).join(' · '))}</strong><span>${escape(t('moveBody'))}</span></div><div class="world-actions"><button class="felt-button" data-world="seoul-move" data-choice="yes">${escape(t('moveYes'))}</button><button class="plain-button" data-world="seoul-move" data-choice="no">${escape(t('moveNo'))}</button></div></div>`,'world-seoul-move');
   panel.addEventListener('close',closed);
  });
 }

 /* ── 언어: 고른 언어가 없고 기기가 한국어가 아니면 지금의 언어 판을 먼저 ── */
 async function language(){
  if(hasChosenLang())return;
  const suggested=suggestedLang();
  if(suggested==='ko'){setLang('ko');try{selectLanguage?.('ko');}catch{}return;}
  await new Promise(resolve=>{let settled=false;const end=()=>{if(!settled){settled=true;resolve();}};
   try{openLangPicker({home,onChoose:lang=>{try{selectLanguage?.(lang);}catch{}},then:()=>{try{session?.api?.unlock();}catch{}end();},onClose:end});}catch{end();}});
  if(!hasChosenLang())setLang(suggested||'en');
 }

 /* ── 돌리기 ── 끝나면 돌아온다. 그 뒤는 앱 셸이 관문으로 넘긴다 */
 async function run(){
  let d=note(await decided());decision=null;
  if(d.ask){
   const guest=readGuest();
   const answer=guest?await askMove(guest):'no';
   if(answer==='later'){dropFrame();return 'later';}
   if(answer==='yes'&&guest){
    // 계정에 실제로 저장됐을 때만 기기 사본을 지운다. 막히면(쓰기 막힘 · 아직 준비 전 · 그새 계정이 바뀜) 유일한 원본을 남기고 다음에 다시 묻는다.
    let saved=false;try{saved=owner()===d.owner&&!!life.progress?.setArrival?.({...guest,updatedAt:Date.now()});}catch{}
    if(!saved){home.toast?.(t('failed'));dropFrame();return 'later';}
   }
   dropGuest();
   d=note(await decided());decision=null;
  }
  if(!d.run){dropFrame();return 'skipped';}
  if(!session?.dialog)mountFrame();
  session.owner=d.owner;note(d);
  if(!session.begun)await language();
  const api=await Promise.race([session.ready,new Promise(res=>setTimeout(()=>res(null),FRAME_WAIT_MS))]);
  if(!api){dropFrame();return 'failed';}
  raise();
  if(!session.begun){
   // 처음 온 학생이 타이틀을 눌렀으면 그 누름으로 깨운 소리로 바로 잇는다. 이어 오는 학생은 틀의 시작 화면(한 번 누름 · 정문부터)이나 내 길로.
   const auto=d.at==='title'&&d.fresh&&session.tapped;
   api.start({at:d.at,arrival:mine(d.owner),replay:!!d.replay,handoff:auto});
   if(auto){session.begun=true;api.begin();}
  }
  await new Promise(res=>{finish=res;});
  finish=()=>{};
  flushPending();
  dropFrame();
  syncDoor();
  return 'done';
 }
 // 우리 동네의 「내 길」 문. 서울행 기록이 있는 학생에게만 보인다
 function syncDoor(){
  const has=!!mine(owner());let door=document.querySelector('#my-road-button');
  if(!door&&has){const bar=document.querySelector('.world-topbar'),settings=document.querySelector('#settings-open');if(!bar)return;door=document.createElement('button');door.className='road-door';door.id='my-road-button';door.dataset.homeHost='road';bar.insertBefore(door,settings);}
  if(door){door.textContent=t('road');door.hidden=!has;}
 }
 async function openRoad(){
  if(session?.dialog)return;
  const arrival=mine(owner());if(!arrival)return;
  mountFrame();session.owner=owner();
  const api=await Promise.race([session.ready,new Promise(res=>setTimeout(()=>res(null),FRAME_WAIT_MS))]);
  if(!api){dropFrame();home.toast?.(t('failed'));return;}
  // 학생증 전에 멈춘 학생(로그인한 채 시작하고 스위치가 꺼져 문으로 돌아온 경우)은 내 길이 아니라 틀의 시작 화면으로
  raise();api.start({at:['card','left'].includes(arrival.stage)?'road':'title',arrival});
  await new Promise(res=>{finish=res;});
  finish=()=>{};flushPending();dropFrame();syncDoor();
 }
 // 서울행 중 주인이 바뀌면(다른 탭 로그인 · PC 창 연결) 다시 불러 판별부터 한다. 저장은 걸음마다 되어 있다.
 // 서울행 밖이면 「내 길」 문만 새 주인에게 맞춘다(새 계정의 생활 기록이 아직이면 숨고, 관문의 onEnter가 다시 맞춘다).
 function onIdentity(){const s=session;if(s?.raised&&s.owner!==owner())location.reload();else if(!s)syncDoor();}
 return Object.freeze({active,beforeTitle,tap,run,openRoad,syncDoor,onIdentity,moveChoice:value=>moveAnswer?.(value==='yes'?'yes':'no'),get open(){return !!session?.dialog;}});
}
