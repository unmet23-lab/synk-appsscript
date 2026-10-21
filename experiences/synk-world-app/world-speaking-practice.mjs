// WORLD 「말하기 연습」 시범(2026-10-21, 기능 플래그 꺼짐) — TOPIK 말하기 평가 6유형 연습과 「카페에서 말로 주문하기」 역할극.
// 설계: qa/speaking-pilot-20261021/설계.md. 시범이라 공개 빌드 목록에 넣지 않았다. 주소의 ?speaking=preview나 이 기기 설정
// (localStorage synk.world.speaking.preview=1)이 있을 때만 app-shell이 이 모듈을 불러 배우기 판에 줄 하나를 더한다.
// · 준비·대답 시간은 공식 시험과 같다(topik.go.kr 문항 구성, 10-21 확인). 문항은 자체 창작 초안(검수 전). 점수·급수·합격을 만들지 않는다.
// · 녹음: 첫 녹음 전에 이 기기에서 한 번 동의를 받고(계정·손님마다 따로), 브라우저 마이크 권한은 그다음에 묻는다. 녹음은 메모리에만
//   두어 이 화면에서 다시 듣고, 기기·서버 어디에도 저장하지 않는다. 문항을 떠나거나 시트를 닫으면 버리고 마이크를 끈다.
// · 자동 피드백: 「자동 피드백 받기」를 누를 때만 그 녹음을 서버로 보낸다(send-once). 서버가 공식 세 요소의 「참고」를 돌려준다.
//   통로는 app-shell이 준다 — 계정 모드는 SYNK-talk world-speaking 함수(웹만), 리허설은 로컬 개발 서버의 /api/world/speaking.
//   말이 없거나 한국어가 아니거나 잘 안 들린 녹음은 다시 녹음을 권하고 기록에 세지 않는다(소리 문제는 학생의 약점이 아니다).
//   말소리가 거의 없는 녹음은 이 기기에서 먼저 걸러 보내지 않는다(빈 녹음에 돈을 쓰지 않는다).
// · 역할극: 직원 말은 미리 구운 카페 직원 목소리(승인본)를 다시 쓰고, 튜터(마스코트)는 목소리 없이 말풍선으로만 돕는다.
//   학생이 한 말에서 주문 칸(음료·온도·수량·마실 곳)을 서버가 고르고, 다음 직원 말은 정해진 소리 가운데서 고른다(새 음성 없음).
// · 학습 기록: 기기 기록(시도·출처 'self'·'ai-reference')만 남긴다. 호스트가 코치를 주고 코치가 말하기 항목을 알면 Trail에
//   「채점 안 함」 시도(assessable:false)로 남긴다 — 지금 Strata에는 말하기 항목이 없어 코치가 거절하고 기기 기록만 남는다.
// · 한 자리 한 언어: 화면 글은 st()(화면 언어), 문제·대화·자료·예시 답·받아 적은 말·튜터 대사는 lang="ko" 칸.
import {currentLang,onLang,t,hasString} from '../brand-opening/world-lang.mjs';
import {tutorPhoto} from '../brand-opening/tutor-photos.mjs';
// 화면 글은 공용 글 표(brand-opening/world-strings.mjs)의 speaking.* 줄이다(10-21 운영 통로와 함께 시범 글 표에서 옮김).
const st=(key,vars)=>t(`speaking.${key}`,vars);
if(globalThis.document&&!document.querySelector('[data-speaking-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./world-speaking.css',import.meta.url).href;style.dataset.speakingStyle='true';document.head.append(style);}

export const SPEAKING_FLAG_KEY='synk.world.speaking.preview';
/** 시범 플래그: 주소 ?speaking=preview 또는 이 기기 설정. 기본은 꺼짐. */
export function speakingPreviewOn({location=globalThis.location,storage=globalThis.localStorage}={}){
 try{if(new URLSearchParams(location?.search||'').get('speaking')==='preview')return true;}catch{}
 try{return storage?.getItem(SPEAKING_FLAG_KEY)==='1';}catch{return false;}
}
// TOPIK 말하기 유형 → 말하기 항목(제안, Strata에 아직 없다 · 설계.md §6).
export const SPEAKING_SKILLS=Object.freeze({1:'ko.speaking.answer',2:'ko.speaking.roleplay',3:'ko.speaking.narrate',4:'ko.speaking.respond',5:'ko.speaking.interpret',6:'ko.speaking.opinion'});
// 계획 엔진(세션 ①)에 넘길 후보(제안): 유형마다 준비+대답+피드백 읽기 어림 분.
export const SPEAKING_CANDIDATES=Object.freeze([1,2,3,4,5,6].map(type=>Object.freeze({id:`topik-speaking-${type}`,route:`speaking:${type}`,minutes:{1:3,2:3,3:4,4:4,5:5,6:5}[type],targets:Object.freeze([SPEAKING_SKILLS[type]]),area:'speaking',exam:'speaking'}))
 .concat(Object.freeze({id:'life-speaking-cafe',route:'speaking:rp-cafe-tea',minutes:4,targets:Object.freeze([SPEAKING_SKILLS[2]]),area:'speaking',exam:null})));

const MIMES=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm'];
const LOG_MAX=200,VOICED_RMS=.018,MIN_VOICED_MS=700,SEND_MAX_BYTES=1400000;
const storeKey=owner=>`synk.world.speaking.v1:${owner||'guest'}`;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uuid=()=>globalThis.crypto?.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^globalThis.crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
const secs=ms=>Math.max(0,Math.ceil(ms/1000));
// 소리 문제(학생의 약점이 아니다)와 서버 사정(한도·꺼짐·오류)을 가른다 — 서버 사정이면 스스로 확인으로 남길 수 있다(10-21 Fable 검수).
const AUDIO_FAIL=new Set(['no_speech','not_korean','unclear']);
const statusKey=s=>hasString(`speaking.fb.status.${s}`)?`fb.status.${s}`:'fb.status.unavailable';

// 튜터 대사(한국어 · 튜터마다 말투). 마스코트는 목소리를 합성하지 않는다 — 말풍선 글만.
const TUTOR_LINES={
 marin:{intro:'수칙. 준비 시간에 말할 순서를 정한다. 삐 소리 뒤에 말한다.',rec:'녹음 중. …끝까지 말한다.',review:'기록 완료. 다시 들어 보는 것도 연습이다.',feedback:'참고 확인. …다음 임무에 쓴다.',retry:'소리 확인 실패. 네 탓이 아니다. …한 번 더.',
  mission:'임무. 따뜻한 차 두 잔. 내 컵 하나, 네 컵 하나. …카페 안에서 마신다.',drink:'목표 음료, 따뜻한 차.',temperature:'온도 확인. 따뜻한 것.',count:'수량 확인. 두 잔.',place:'마실 곳, 카페 안.',answer:'주문 내용이 맞으면 「네」.',polite:'직원에게는 높임말. 「주세요」.',turnOk:'전달 완료.',done:'임무 완료. …따뜻하다.'},
 kkamong:{intro:'이 몸도 시험장에선 준비 시간에 순서부터 정하지. 삐 소리 뒤에 시작!',rec:'이 몸이 듣고 있어. 끝까지 말해 봐.',review:'훗, 다 말했군. 다시 들어 볼래?',feedback:'참고만 하라고. 다음엔 하나만 더 해 보자.',retry:'이 몸 귀에도 잘 안 들렸어. 다시 한번.',
  mission:'이 몸은 따뜻한 차가 마시고 싶군. …네 컵도 같이, 두 잔. 여기서 마시자.',drink:'이 몸이 원하는 건 차야. 차.',temperature:'차가운 거 말고. 따뜻한 걸로.',count:'이 몸 한 잔, 네 한 잔. 두 잔이지.',place:'가져가지 말고. 여기서 마시자고.',answer:'맞으면 「네, 맞아요」라고 해.',polite:'직원한테는 「주세요」라고 해야지.',turnOk:'훗, 잘 들렸지.',done:'이 몸 취향을 잘 기억했군. …같이 앉지.'},
 mongle:{intro:'준비 시간에 생각하고, 삐 소리가 나면 같이 시작하자!',rec:'듣고 있어! 천천히 말해도 괜찮아!',review:'다 말했어! 같이 들어 볼까?',feedback:'하나씩 같이 고쳐 보자!',retry:'어? 잘 안 들렸어! 한 번 더 해 보자!',
  mission:'오! 따뜻한 차 두 잔! 하나는 내 거, 하나는 네 거! 카페 안에서 같이 마시자!',drink:'우리는 차를 마시기로 했어!',temperature:'따뜻한 차! 온도도 말해 보자!',count:'하나, 둘! 두 잔이야!',place:'우리는 여기 앉아서 마실 거야!',answer:'맞으면 「네, 맞아요」!',polite:'직원에게는 「주세요」라고 말해 보자!',turnOk:'우와, 잘 전했어!',done:'우와! 따뜻한 차 두 잔이야! 같이 앉자!'}
};
// 마무리 문장의 「○○과」: 세 튜터 이름 모두 받침으로 끝난다. 튜터가 없으면 「친구와」.
const FRIEND={marin:'마린과',kkamong:'까몽과',mongle:'몽글과'};
const TUTOR_FACE={intro:'기본',rec:'집중',review:'기쁨',feedback:'기쁨',retry:'민망',mission:'기쁨',turnOk:'기쁨',done:'기쁨'};

function readStore(storage,owner){try{const v=JSON.parse(storage?.getItem(storeKey(owner))||'null');if(v&&typeof v==='object')return {consent:v.consent||null,log:Array.isArray(v.log)?v.log:[]};}catch{}return {consent:null,log:[]};}
function writeStore(storage,owner,state){try{storage?.setItem(storeKey(owner),JSON.stringify({consent:state.consent,log:state.log.slice(-LOG_MAX)}));return true;}catch{return false;}}
/** 계획 엔진·내 위치가 읽을 연습 요약(이 기기 기록). 소리 문제로 세지 않은 녹음은 빠진다. times: 센 시도 시각(ISO). */
export function readSpeakingSummary({storage=globalThis.localStorage,owner='guest'}={}){
 const state=readStore(storage,owner),attempts={1:0,2:0,3:0,4:0,5:0,6:0},feedback={1:0,2:0,3:0,4:0,5:0,6:0},times=[];let roleplays=0,lastAt=null;
 for(const e of state.log){if(!e||e.counted===false)continue;if(e.mode==='exam'&&attempts[e.type]!=null){attempts[e.type]++;if(e.source==='ai-reference')feedback[e.type]++;times.push(e.at);}if(e.mode==='roleplay'&&e.done){roleplays++;times.push(e.at);}if(!lastAt||e.at>lastAt)lastAt=e.at;}
 return {attempts,feedback,roleplays,lastAt,times};
}

let bankPromise=null,bankReady=false;
export function loadSpeakingBank(fetcher=(...args)=>globalThis.fetch(...args),url=new URL('./world-speaking-items.json',import.meta.url)){
 bankPromise||=Promise.resolve(fetcher(url,{cache:'no-cache'})).then(r=>{if(!r.ok)throw Error('SPEAKING_BANK');return r.json();}).then(bank=>{
  if(!bank||!Array.isArray(bank.items)||!bank.types)throw Error('SPEAKING_BANK');bankReady=true;return bank;
 }).catch(error=>{bankPromise=null;throw error;});
 return bankPromise;
}
export const speakingReady=()=>bankReady;
/** 배우기 판(life-ui.mjs)의 「내 위치」 아래 한 줄. print는 life-ui의 펠트 인화지 함수다. 은행을 못 읽었으면 줄이 없다. */
export function speakingRow(print=()=>''){
 if(!bankReady){if(!bankPromise)void loadSpeakingBank().then(()=>globalThis.dispatchEvent?.(new Event('synk-speaking-ready'))).catch(()=>{});return '';}
 return `<button class="life-row" data-world="speaking">${print('greetings','life-row-print')}<span class="life-row-copy"><strong>${esc(st('row.title'))}</strong><small>${esc(st('row.sub'))}</small></span></button>`;
}

/** 마이크·녹음 지원. 녹음은 MediaRecorder(webm/opus · 사파리는 mp4). */
export function recordingSupport(win=globalThis){return !!(win?.navigator?.mediaDevices?.getUserMedia&&win.MediaRecorder);}
function pickMime(win){const R=win.MediaRecorder;for(const m of MIMES)try{if(R.isTypeSupported?.(m))return m;}catch{}return '';}
function blobToBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}

/**
 * show(title, html): 호스트가 시트를 연다(type 'world-speaking'). home: attachPanelResource로 시트가 닫힐 때 정리를 맡긴다.
 * getOwner(): 지금 계정 id 또는 'guest'. tutor(): 고른 튜터 id(marin·kkamong·mongle) 또는 null.
 * feedback: 자동 피드백 통로 {status():Promise<{enabled,dailyLimit,remaining}>, request(payload):Promise<result>} 또는 null(없으면 단추가 없다).
 * coach(): 이 활동의 Atlas 코치(없거나 말하기 항목을 모르면 null/예외 — 그때는 기기 기록만 남긴다).
 */
export function createSpeakingPractice({show,home,getOwner=()=>'guest',tutor=()=>null,storage=globalThis.localStorage,feedback=null,coach=null,now=Date.now,doc=globalThis.document,win=globalThis,lang=currentLang,fetcher,privacyUrl='/privacy/'}={}){
 let openSeq=0,bank=null,view={kind:'list'},owner=getOwner(),state=readStore(storage,owner),stage=null,offLang=null,status=null,stopped=false;
 let run=null,mic=null,player=null,clip=null,ticker=null,pids={},tries={},audioCtx=null,liveTimer=null;
 // 오디오 처리기는 하나를 누르는 순간(준비 시작·말하기) 깨워 같이 쓴다. 타이머 안에서 새로 만들면 아이폰 사파리에서 멈춘 채라
 // 소리 크기가 늘 0으로 읽혀 정상 녹음이 「말소리 없음」이 된다(10-21 아르곤 검수).
 function sharedCtx(){const AC=win.AudioContext||win.webkitAudioContext;if(!AC)return null;try{if(!audioCtx||audioCtx.state==='closed')audioCtx=new AC();if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});}catch{return null;}return audioCtx;}
 const save=()=>writeStore(storage,owner,state);
 const item=id=>bank?.items.find(i=>i.id===id)||null,roleplay=id=>bank?.roleplays?.find(r=>r.id===id)||null;
 const asset=src=>new URL(src,new URL('./world-speaking-items.json',import.meta.url)).href;
 function syncOwner(){const next=getOwner();if(next!==owner){teardown();owner=next;state=readStore(storage,owner);pids={};tries={};status=null;view={kind:'list'};}}
 function log(entry){state.log.push({...entry,at:new Date(now()).toISOString()});save();}
 // 서버가 다른 문항 사본을 보고 있으면(판 지문이 다르면) 자동 피드백 없이 스스로 확인만 연다(쓰기 연습과 같은 선).
 const aiAvailable=()=>!!(feedback&&status?.enabled&&status.itemsVersion===bank?.contentHash);
 const remaining=()=>Number.isInteger(status?.remaining)?status.remaining:status?.dailyLimit??0;

 // ── 튜터 말풍선 ──
 function tutorHtml(kind){
  const id=tutor();const lines=TUTOR_LINES[id];if(!lines)return '';
  const photo=tutorPhoto(id,'life',TUTOR_FACE[kind]||'기본');
  return `<div class="wsp-tutor" data-tutor="${esc(id)}">${photo?`<img src="${esc(photo)}" alt="" width="64" height="64" loading="lazy">`:''}<p class="wsp-bubble" lang="ko" data-wsp-bubble>${esc(lines[kind]||lines.intro)}</p></div>`;
 }
 function say(kind){const id=tutor(),line=TUTOR_LINES[id]?.[kind];const bubble=stage?.querySelector('[data-wsp-bubble]');if(!bubble||!line)return;bubble.textContent=line;const img=bubble.previousElementSibling;if(img?.tagName==='IMG'){const photo=tutorPhoto(id,'life',TUTOR_FACE[kind]||'기본');if(photo)img.src=photo;}}

 // ── 마이크·녹음 ──
 async function openMic(){
  if(!recordingSupport(win))throw Object.assign(Error('mic'),{code:'unsupported'});
  try{return await win.navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
  catch(error){throw Object.assign(Error('mic'),{code:error?.name==='NotFoundError'||error?.name==='OverconstrainedError'?'none':error?.name==='NotAllowedError'||error?.name==='SecurityError'?'denied':'denied'});}
 }
 function closeMic(){if(!mic)return;try{mic.recorder?.state==='recording'&&mic.recorder.stop();}catch{}cancelAnimationFrame(mic.raf);try{mic.source?.disconnect();}catch{}for(const track of mic.stream?.getTracks?.()||[])try{track.stop();}catch{}mic=null;}
 function startRecorder(stream,onLevel){
  const mime=pickMime(win),recorder=new win.MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000}),chunks=[];
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
  const m={stream,recorder,chunks,mime:recorder.mimeType||mime||'audio/webm',voicedMs:0,unknown:false,startedAt:now(),raf:0,ctx:null,source:null};
  try{m.ctx=sharedCtx();if(!m.ctx)throw Error('no audio');const source=m.ctx.createMediaStreamSource(stream),analyser=m.ctx.createAnalyser();analyser.fftSize=1024;source.connect(analyser);m.source=source;
   const data=new Float32Array(analyser.fftSize);let last=now();
   const tick=()=>{if(m.ctx.state!=='running')m.unknown=true;analyser.getFloatTimeDomainData(data);let sum=0;for(const v of data)sum+=v*v;const rms=Math.sqrt(sum/data.length),t=now();if(rms>VOICED_RMS)m.voicedMs+=Math.min(200,t-last);last=t;onLevel?.(Math.min(1,rms*9));m.raf=requestAnimationFrame(tick);};
   m.raf=requestAnimationFrame(tick);}catch{m.voicedMs=null;}
  recorder.start(250);return m;
 }
 function stopRecorder(m){return new Promise(resolve=>{if(!m||m.recorder.state==='inactive'){resolve(null);return;}m.recorder.onstop=()=>resolve(new Blob(m.chunks,{type:m.mime.split(';')[0]}));try{m.recorder.stop();}catch{resolve(null);}});}
 // 시험의 삐 소리는 효과음이 아니라 말하기 시작 신호라 소리 설정과 상관없이 울린다(안내 글이 삐 소리를 약속한다 — 10-21 Fable 검수).
 function beep(){
  try{const ctx=sharedCtx();if(!ctx)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=1000;gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.16,ctx.currentTime+.01);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.32);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.34);}catch{}
 }
 function stopPlayback(){try{player?.pause();}catch{}try{clip?.pause();}catch{}clip=null;}
 // 자동 피드백의 코치 기록은 「제가 한 말과 달라요」를 누를 틈을 두고, 이 녹음을 떠날 때 남긴다(잘못 들은 피드백은 세지 않는다 — 10-21 Fable 검수).
 function flushRecord(){const pending=run?.pendingRecord;if(!pending||run.misheard)return;run.pendingRecord=null;const it=item(run.itemId);if(it)record(it,pending);}
 function teardown(){clearInterval(ticker);ticker=null;closeMic();stopPlayback();flushRecord();if(run?.url)try{URL.revokeObjectURL(run.url);}catch{}run=null;}

 // ── 기록 ──
 function record(it,{assisted}){
  const c=typeof coach==='function'?(()=>{try{return coach();}catch{return null;}})():null;if(!c)return;
  try{
   pids[it.id]??=c.present({id:`speaking-${it.id}`,itemKey:`speaking.${it.id}`,familyKey:`speaking.${it.id}`,skillId:SPEAKING_SKILLS[it.type],modality:'speaking',difficulty:{beginner:1,intermediate:2,advanced:3}[bank.types[it.type]?.band]||2,responseFormat:'unknown',audioRequired:false});
   if(assisted)c.help(pids[it.id],'hint');
   tries[it.id]=(tries[it.id]||0)+1;c.answer(pids[it.id],{correct:null,assessable:false,attemptNo:tries[it.id]});
  }catch{/* 코치 지도에 말하기 항목이 없으면 기기 기록만 남는다 */}
 }

 // ── 목록 ──
 function listHtml(){
  const tried=type=>state.log.some(e=>e.mode==='exam'&&e.type===type&&e.counted!==false);
  const rows=[1,2,3,4,5,6].map(type=>{const it=bank.items.find(i=>i.type===type);if(!it)return '';const tp=bank.types[type];
   return `<button class="wsp-row" data-wsp-open="${esc(it.id)}"><span class="wsp-num" aria-hidden="true">${type}</span><span class="wsp-row-copy"><strong>${esc(st(`type.${type}`))}</strong><small>${esc(st(`band.${tp.band}`))} · ${esc(st('type.meta',{prep:tp.prepSec,answer:tp.answerSec}))}${tried(type)?` · ${esc(st('state.tried'))}`:''}</small></span><span class="wsp-row-label" lang="ko">${esc(it.label)}</span></button>`;}).join('');
  const rp=(bank.roleplays||[]).map(r=>`<button class="wsp-row" data-wsp-roleplay="${esc(r.id)}"><img class="wsp-num wsp-num-print" src="${esc(asset('../brand-opening/assets/world-felt/cafe.webp'))}" alt="" width="40" height="40" loading="lazy"><span class="wsp-row-copy"><strong>${esc(st('rp.title'))}</strong><small>${esc(st('rp.sub'))}</small></span></button>`).join('');
  return `<div class="wsp wsp-list" data-wsp-stage><p class="wsp-lead" tabindex="-1">${esc(st('lead'))}</p><p class="wsp-note">${esc(st('basis'))} <span class="wsp-chip">${esc(st('draft'))}</span></p>`
   +`<section class="wsp-group"><h3 class="wsp-section-title">${esc(st('group.exam'))}</h3>${rows}</section>`
   +(rp?`<section class="wsp-group"><h3 class="wsp-section-title">${esc(st('group.roleplay'))}</h3>${rp}</section>`:'')
   +(state.consent?`<p class="wsp-note"><button class="quiet-button" data-wsp-revoke>${esc(st('consent.revoke'))}</button></p>`:'')
   +`<p class="wsp-note">${esc(st('mic.notCounted'))}</p></div>`;
 }

 // ── 문항(6유형) ──
 function questionHtml(it){
  const out=[];
  if(it.situation)out.push(`<p class="wsp-situation">${esc(it.situation)}</p>`);
  if(it.picture)out.push(`<figure class="wsp-picture"><img src="${esc(asset(it.picture.src))}" alt="${esc(it.picture.alt)}" loading="lazy" decoding="async"></figure>`);
  if(it.panels)out.push(`<ol class="wsp-panels">${it.panels.map((p,i)=>`<li><img src="${esc(asset(p.src))}" alt="${esc(p.alt)}" loading="lazy" decoding="async" width="360" height="360"><span class="wsp-panel-num" aria-hidden="true">${i+1}</span></li>`).join('')}</ol>`);
  if(it.dialogue)out.push(`<div class="wsp-dialogue">${it.dialogue.map(d=>`<p><b>${esc(d.speaker)}</b> ${esc(d.line)}</p>`).join('')}</div>`);
  if(it.news)out.push(`<p class="wsp-news">${esc(it.news)}</p>`);
  if(it.data){const d=it.data,max=Math.max(...d.series.map(s=>s.value));
   out.push(`<figure class="wsp-data"><figcaption><strong>${esc(d.title)}</strong> <small>(${esc(d.unit)} · ${esc(d.source)})</small></figcaption><ul class="wsp-bars">${d.series.map(s=>`<li><span>${esc(s.label)}</span><span class="wsp-barfill" style="--v:${(s.value/max).toFixed(3)}"></span><b>${esc(s.value)}</b></li>`).join('')}</ul>`
    +(d.reasons?`<p class="wsp-data-sub">${esc(d.reasons.title)}</p><ul class="wsp-reasons">${d.reasons.rows.map(r=>`<li><span>${esc(r.label)}</span><b>${esc(r.value)}</b></li>`).join('')}</ul>`:'')+`</figure>`);}
  if(it.prompt)out.push(`<p class="wsp-prompt">${esc(it.prompt)}</p>`);
  return out.join('');
 }
 function partnerHtml(it){
  if(!it.partner)return '';
  return `<div class="wsp-partner"><button class="plain-button" data-wsp-partner>${esc(st(`task.partner.${it.partner.role}`))}</button><p class="wsp-partner-line" lang="ko">${esc(it.partner.role)}: ${esc(it.partner.line)}</p></div>`;
 }
 function coversHtml(it,{self=false}={}){
  const picked=new Set(run?.selfPicked||[]),saved=!!run?.selfSaved;
  return `<section class="wsp-covers"><h4>${esc(st(self?'task.selfCheck':'task.covers'))}</h4>${self?`<p class="wsp-note">${esc(st('task.selfLead'))}</p>`:''}<ul>${it.covers.map((c,i)=>self?`<li><label><input type="checkbox" data-wsp-self="${i}" ${picked.has(i)?'checked':''} ${saved?'disabled':''}><span lang="ko">${esc(c)}</span></label></li>`:`<li lang="ko">${esc(c)}</li>`).join('')}</ul>${self?`<button class="plain-button" data-wsp-self-save ${saved?'disabled':''}>${esc(st('task.selfSave'))}</button>`:''}</section>`;
 }
 function modelHtml(it){
  return `<section class="wsp-model" ${run?.modelOpen?'':'hidden'}><p class="wsp-note">${esc(st('task.modelNote'))}</p><p class="wsp-model-text" lang="ko">${esc(it.model)}</p>${it.watch?`<p class="wsp-label">${esc(st('task.watch'))}</p><p lang="ko">${esc(it.watch)}</p>`:''}</section>`;
 }
 function stageHtml(it){
  const tp=bank.types[it.type],r=run||{},practice=r.timing==='practice';
  if(r.phase==='prep')return `<div class="wsp-meter" data-phase="prep"><p class="wsp-big" data-wsp-clock>${practice?esc(st('task.prepFree')):`${esc(st('task.prep'))} · ${esc(st('task.left',{s:secs(r.until-now())}))}`}</p></div><div class="wsp-actions"><button class="felt-button" data-wsp-skip>${esc(st('task.skipPrep'))}</button></div>`;
  if(r.phase==='rec')return `<div class="wsp-meter" data-phase="rec"><p class="wsp-rec"><span class="wsp-dot" aria-hidden="true"></span>${esc(st('task.recording'))}</p><span class="wsp-level" aria-label="${esc(st('mic.level'))}" role="img"><span data-wsp-level></span></span><p class="wsp-big" data-wsp-clock>${esc(st('task.left',{s:secs(r.until-now())}))}</p></div><div class="wsp-actions"><button class="felt-button" data-wsp-stop>${esc(st('task.stop'))}</button></div>`;
  if(r.phase==='review'||r.phase==='sending'||r.phase==='feedback'){
   // 자동 피드백을 쓸 수 없을 때(손님·꺼짐·오늘 몫을 다 씀·서버 사정)와 「제가 한 말과 달라요」 뒤에는 스스로 확인으로 남길 수 있다.
   // 소리 문제(말 없음·한국어 아님·잘 안 들림)는 다시 녹음을 권할 뿐 남기지 않는다(10-21 Fable 검수).
   const sending=r.phase==='sending',code=r.result?.status,audioFail=AUDIO_FAIL.has(code),fresh=r.voiced!==false&&!r.result&&!r.selfSaved;
   const canSend=aiAvailable()&&fresh&&remaining()>0,usedUp=aiAvailable()&&fresh&&remaining()<=0;
   const selfCheck=r.voiced!==false&&!canSend&&!sending&&!audioFail&&(code!=='ok'||r.misheard);
   return `<div class="wsp-review"><p class="wsp-label">${esc(st('task.review',{s:r.seconds}))}</p><div class="wsp-actions">`
    +`<button class="plain-button" data-wsp-play aria-pressed="${r.playing?'true':'false'}">${esc(st(r.playing?'task.pause':'task.play'))}</button>`
    +(canSend?`<button class="felt-button" data-wsp-send ${sending?'disabled':''}>${esc(st('task.feedback'))}</button>`:'')
    +`<button class="quiet-button" data-wsp-retry ${sending?'disabled':''}>${esc(st('task.retry'))}</button></div>`
    +(canSend?`<p class="wsp-note">${esc(st('task.feedbackNote',{n:remaining()}))}</p>`:'')
    +(usedUp?`<p class="wsp-note" role="status">${esc(st('fb.status.limit'))}</p>`:'')
    +(r.voiced===false?`<p class="wsp-note" role="status">${esc(st('task.silent'))}</p>`:'')+`</div>`
    +`<section class="wsp-feedback" data-wsp-feedback aria-live="polite">${feedbackHtml(it)}</section>`
    +(selfCheck?coversHtml(it,{self:true}):'');
  }
  if(r.phase==='opening')return `<p class="wsp-note" role="status">${esc(st('mic.opening'))}</p>`;
  // 마이크 오류 뒤에도 시작 단추를 둔다 — 브라우저에서 권한을 허용한 뒤 바로 다시 해 볼 수 있다(10-21 Fable 검수).
  const note=r.error?`<p class="wsp-note" role="alert">${esc(st(`mic.${r.error}`))}</p>`:`<p class="wsp-note">${esc(st(practice?'task.startNotePractice':'task.startNote',{prep:tp.prepSec,answer:tp.answerSec}))}</p>`;
  return `${note}<div class="wsp-actions"><button class="felt-button" data-wsp-start>${esc(st('task.start'))}</button></div>${coversHtml(it)}`;
 }
 function feedbackHtml(it){
  const r=run;if(!r)return '';
  if(r.phase==='sending')return `<p class="wsp-note" role="status">${esc(st('fb.sending'))}</p>`;
  const res=r.result;if(!res)return '';
  if(res.status!=='ok')return `<p class="wsp-note" role="status">${esc(st(statusKey(res.status)))}</p>`;
  const f=res.feedback,el=f.elements,cell=(id,body)=>`<li class="wsp-el" data-el="${id}"><h4>${esc(st(`fb.el.${id}`))}</h4>${body}</li>`;
  const gt=e=>e.withheld?`<p class="wsp-note">${esc(st(`fb.withheld.${e.withheld}`))}</p>`:`${e.good?`<p><small>${esc(st('fb.good'))}</small> ${explain(e.good)}</p>`:''}${e.try?`<p><small>${esc(st('fb.try'))}</small> ${explain(e.try)}</p>`:''}`;
  const covers=`<ul class="wsp-covered">${it.covers.map((c,i)=>`<li data-done="${f.covered.includes(i)}"><span class="wsp-tag">${esc(st(f.covered.includes(i)?'fb.covered':'fb.missing'))}</span> <span lang="ko">${esc(c)}</span></li>`).join('')}</ul>`;
  const lang=el.language.withheld?gt(el.language):`${gt(el.language)}${el.language.quote?`<p class="wsp-quote" lang="ko"><mark>${esc(el.language.quote)}</mark> → ${esc(el.language.better)}</p>`:''}`;
  return `<h3 class="wsp-section-title">${esc(st('fb.title'))}</h3><p class="wsp-note">${esc(st('fb.reference'))}</p>`
   +(f.partlyUnclear?`<p class="wsp-note">${esc(st('fb.partly'))}</p>`:'')
   +`<div class="wsp-heard"><p class="wsp-label">${esc(st('fb.heard'))}</p><p lang="ko">${esc(f.heard.transcript)}</p>${r.misheard?`<p class="wsp-note" role="status">${esc(st('fb.misheardDone'))}</p>`:`<button class="quiet-button" data-wsp-misheard>${esc(st('fb.misheard'))}</button>`}</div>`
   +(r.misheard?'':`<ul class="wsp-els">${cell('task',covers+gt(el.task))}${cell('language',lang)}${cell('delivery',gt(el.delivery))}</ul>`
   +(f.modelLine?`<p class="wsp-label">${esc(st('fb.modelLine'))}</p><p class="wsp-model-text" lang="ko">${esc(f.modelLine)}</p>`:'')
   +(f.note?`<p class="wsp-note">${explain(f.note)}</p>`:''));
 }
 // 설명 칸(화면 언어)에 섞인 짧은 한국어 인용(「…」)은 lang="ko" 칸으로 감싼다 — 한 자리 한 언어.
 const KO_RUN=/(「[^」]*」|[-~(]*[0-9]*[가-힣ㄱ-ㅎㅏ-ㅣ]+(?:[\s\-~·()/.,?!0-9]*[가-힣ㄱ-ㅎㅏ-ㅣ]+)*[)]?)/g;
 const explain=value=>lang()==='ko'?esc(value):String(value??'').split(KO_RUN).map((part,i)=>i%2?`<span lang="ko">${esc(part)}</span>`:esc(part)).join('');
 function taskHtml(it){
  const tp=bank.types[it.type],r=run||{},locked=['opening','prep','rec','stopping','sending'].includes(r.phase);
  return `<div class="wsp wsp-task" data-wsp-stage data-type="${it.type}">`
   +`<div class="wsp-bar"><button class="quiet-button" data-wsp-back ${locked?'disabled':''}>← ${esc(st('task.back'))}</button><span class="wsp-type">${esc(st('type.number',{n:it.type}))} · ${esc(st(`type.${it.type}`))} · ${esc(st('type.meta',{prep:tp.prepSec,answer:tp.answerSec}))}</span>`
   +`<span class="wsp-toggle" role="group" aria-label="${esc(st('task.mode'))}"><button class="quiet-button" data-wsp-timing="exam" aria-pressed="${r.timing!=='practice'}" ${locked?'disabled':''}>${esc(st('task.mode.exam'))}</button><button class="quiet-button" data-wsp-timing="practice" aria-pressed="${r.timing==='practice'}" ${locked?'disabled':''}>${esc(st('task.mode.practice'))}</button></span></div>`
   +(r.timing==='practice'?`<p class="wsp-note">${esc(st('task.mode.note'))}</p>`:'')
   +tutorHtml(r.phase==='rec'?'rec':r.phase==='review'||r.phase==='sending'?'review':r.result?.status==='ok'&&!r.misheard?'feedback':AUDIO_FAIL.has(r.result?.status)||r.misheard?'retry':r.result?'review':'intro')
   +`<section class="wsp-question" lang="ko" aria-label="${esc(st('task.question'))}">${questionHtml(it)}${partnerHtml(it)}</section>`
   +`<section class="wsp-stage" data-wsp-zone aria-live="off">${stageHtml(it)}</section>`
   +`<p class="wsp-sr" aria-live="polite" data-wsp-live></p>`
   +`<div class="wsp-actions"><button class="plain-button" data-wsp-model aria-expanded="${r.modelOpen?'true':'false'}">${esc(st(r.modelOpen?'task.modelHide':'task.model'))}</button></div>${modelHtml(it)}</div>`;
 }
 // 알림 칸은 그리기마다 새로 생기므로, 새 칸이 자리 잡은 뒤에 글을 넣어야 화면 읽기가 읽는다.
 function announce(text){clearTimeout(liveTimer);liveTimer=setTimeout(()=>{const live=stage?.querySelector('[data-wsp-live]');if(live)live.textContent=text;},150);}
 function paintZone(it){const zone=stage?.querySelector('[data-wsp-zone]'),had=!!zone&&(zone.contains(doc.activeElement)||doc.activeElement===doc.body);if(zone){zone.innerHTML=stageHtml(it);if(had)zone.querySelector('button:not([disabled])')?.focus({preventScroll:true});}for(const b of stage?.querySelectorAll('[data-wsp-back],[data-wsp-timing]')||[])b.disabled=['opening','prep','rec','stopping','sending'].includes(run?.phase);}

 async function begin(it){
  if(['opening','prep','rec','stopping','sending'].includes(run?.phase))return;
  if(!state.consent){view={...view,consent:true};render('[data-wsp-consent]');return;}
  sharedCtx();
  run={...(run||{}),itemId:it.id,phase:'opening',error:null,timing:run?.timing||'exam',modelOpen:run?.modelOpen||false};paintZone(it);
  // 권한 창을 기다리는 사이 목록으로 나갔다가 같은 문항을 다시 열면 run이 바뀐다 — 그때 열린 마이크는 쓰지 않고 끈다.
  const token=run;
  let stream;try{stream=await openMic();}catch(error){if(stopped||view.id!==it.id||run!==token)return;run={...run,phase:'idle',error:error.code};paintZone(it);return;}
  if(stopped||view.id!==it.id||run!==token){for(const tr of stream.getTracks())tr.stop();return;}
  mic={stream};
  if(run.timing==='practice'){run.phase='prep';paintZone(it);announce(st('task.prepFree'));return;}
  run.phase='prep';run.until=now()+bank.types[it.type].prepSec*1000;paintZone(it);announce(st('task.prep'));
  clearInterval(ticker);ticker=setInterval(()=>{if(run?.phase!=='prep')return;const left=run.until-now();const el=stage?.querySelector('[data-wsp-clock]');if(el)el.textContent=`${st('task.prep')} · ${st('task.left',{s:secs(left)})}`;if(left<=0)startAnswer(it);},250);
 }
 function startAnswer(it){
  if(!mic?.stream||run?.phase!=='prep')return;clearInterval(ticker);beep();
  const level=v=>{const bar=stage?.querySelector('[data-wsp-level]');if(bar)bar.style.setProperty('--level',v.toFixed(3));};
  mic=startRecorder(mic.stream,level);run.phase='rec';run.until=now()+bank.types[it.type].answerSec*1000;run.startedAt=now();paintZone(it);announce(st('task.beep'));say('rec');
  ticker=setInterval(()=>{if(run?.phase!=='rec')return;const left=run.until-now();const el=stage?.querySelector('[data-wsp-clock]');if(el)el.textContent=st('task.left',{s:secs(left)});if(left<=10000&&!run.warned){run.warned=true;announce(st('task.left',{s:10}));}if(left<=0){announce(st('task.timeUp'));void finishAnswer(it);}},250);
 }
 async function finishAnswer(it){
  if(run?.phase!=='rec')return;clearInterval(ticker);ticker=null;run.phase='stopping';
  const m=mic,blob=await stopRecorder(m),voicedMs=m?.unknown?null:m?.voicedMs;closeMic();
  if(stopped||!run||run.itemId!==it.id)return;
  const seconds=Math.max(1,Math.round((now()-run.startedAt)/1000));
  if(run.url)try{URL.revokeObjectURL(run.url);}catch{}
  run={...run,phase:'review',blob,url:blob?URL.createObjectURL(blob):null,seconds,mime:blob?.type||m?.mime,voiced:voicedMs==null?null:voicedMs>=MIN_VOICED_MS,result:null,misheard:false,playing:false,requestId:uuid()};
  if(run.voiced===false){log({mode:'exam',itemId:it.id,type:it.type,source:'self',status:'no_speech',counted:false,seconds,timing:run.timing});say('retry');}
  else say('review');
  paintZone(it);announce(st('task.review',{s:seconds}));
 }
 async function send(it){
  if(!run?.blob||run.phase!=='review'||!aiAvailable())return;
  if(run.blob.size>SEND_MAX_BYTES){run.result={status:'too_big'};paintZone(it);return;}
  const expected=owner,requestId=run.requestId;run.phase='sending';paintZone(it);announce(st('fb.sending'));
  let result;
  try{const data=await blobToBase64(run.blob);result=await feedback.request({action:'feedback',request_id:requestId,consent:'send-once',mode:'exam',item_id:it.id,items_version:bank.contentHash,lang:['ko','en','mn'].includes(lang())?lang():'ko',audio:{mime:run.mime||'audio/webm',data},seconds:run.seconds});}
  catch{result={status:'unavailable'};}
  if(stopped||expected!==getOwner()||!run||run.requestId!==requestId)return;
  run.phase='feedback';run.result=result?.status==='ok'&&result.feedback?.status==='ok'?{status:'ok',feedback:result.feedback}:{status:result?.feedback?.status||result?.status||'unavailable'};
  if(Number.isInteger(result?.remaining))status={...status,remaining:result.remaining};
  const counted=run.result.status==='ok',audioFail=AUDIO_FAIL.has(run.result.status);
  log({mode:'exam',itemId:it.id,type:it.type,source:counted?'ai-reference':audioFail?'ai-unclear':'ai-unavailable',status:run.result.status,counted,requestId,seconds:run.seconds,timing:run.timing,helped:!!run.modelSeen,...(counted?{covered:run.result.feedback.covered}:{})});
  if(counted)run.pendingRecord={assisted:!!run.modelSeen};
  say(counted?'feedback':audioFail?'retry':'review');paintZone(it);
  stage?.querySelector('[data-wsp-feedback] h3')?.setAttribute('tabindex','-1');stage?.querySelector('[data-wsp-feedback] h3')?.focus({preventScroll:false});
 }

 // ── 역할극 ──
 function rpLine(kind){return TUTOR_LINES[tutor()]?.[kind]||'';}
 function roleplayHtml(rp){
  const r=run||{},step=rp.steps.find(s=>s.id===r.step),offline=!aiAvailable();
  const lastStaff=(r.turns||[]).map(t=>t.who).lastIndexOf('staff');
  // 지금 차례의 직원 말만 글을 숨긴다(듣기 연습). 지난 차례와, 말해 본 뒤 예시 문장과 견주는 따라 말하기 단계에서는 글로 둔다.
  const turns=(r.turns||[]).map((t,i)=>t.who==='staff'?`<li class="wsp-say" data-who="staff"><span class="wsp-who">${esc(st('rp.staff'))}</span>${t.shown||i<lastStaff||r.phase==='self'||r.phase==='done'?`<p lang="ko">${esc(t.line)}</p>`:`<p class="wsp-hidden-line">${esc(st('rp.hidden'))}</p>`}</li>`
   :`<li class="wsp-say" data-who="me"><span class="wsp-who">${esc(st('rp.me'))}</span>${t.heard?`<p lang="ko">${esc(t.heard)}</p>`:`<p class="wsp-note">${esc(t.note||'')}</p>`}${t.tip?`<p class="wsp-tip">${explain(t.tip)}</p>`:''}${t.better?`<p class="wsp-better"><small>${esc(st('rp.model'))}</small> <span lang="ko">${esc(t.better)}</span></p>`:''}</li>`).join('');
  let action='';
  if(r.phase==='intro')action=`<div class="wsp-actions"><button class="felt-button" data-wsp-rp-start>${esc(st('rp.start'))}</button></div>`;
  else if(r.phase==='staff')action=`<p class="wsp-note" role="status">${esc(st('rp.wait'))}</p>`;
  else if(r.phase==='turn')action=`<p class="wsp-note">${esc(st('rp.yourTurn',{s:rp.answerSec}))}</p><div class="wsp-actions"><button class="felt-button wsp-mic" data-wsp-rp-speak>${esc(st('rp.speak'))}</button><button class="plain-button" data-wsp-rp-listen>${esc(st('rp.listen'))}</button><button class="quiet-button" data-wsp-rp-text aria-pressed="${r.textShown?'true':'false'}">${esc(st('rp.text'))}</button></div>${r.misses>=2&&step?`<p class="wsp-better"><small>${esc(st('rp.model'))}</small> <span lang="ko">${esc(step.model)}</span></p>`:''}`;
  else if(r.phase==='rec')action=`<div class="wsp-meter" data-phase="rec"><p class="wsp-rec"><span class="wsp-dot" aria-hidden="true"></span>${esc(st('task.recording'))}</p><span class="wsp-level" role="img" aria-label="${esc(st('mic.level'))}"><span data-wsp-level></span></span><p class="wsp-big" data-wsp-clock>${esc(st('task.left',{s:secs(r.until-now())}))}</p></div><div class="wsp-actions"><button class="felt-button" data-wsp-rp-stop>${esc(st('task.stop'))}</button></div>`;
  else if(r.phase==='thinking')action=`<p class="wsp-note" role="status">${esc(st('rp.thinking'))}</p>`;
  else if(r.phase==='opening')action=`<p class="wsp-note" role="status">${esc(st('mic.opening'))}</p>`;
  else if(r.phase==='self')action=`<div class="wsp-actions"><button class="felt-button" data-wsp-rp-next>${esc(st('rp.next'))}</button><button class="quiet-button" data-wsp-rp-again>${esc(st('rp.again'))}</button></div>`;
  else if(r.phase==='done')action=`<p class="wsp-done" lang="ko">${esc(rp.ending.replace('{friend}',FRIEND[tutor()]||'친구와'))}</p><div class="wsp-actions"><button class="plain-button" data-wsp-rp-restart>${esc(st('rp.restart'))}</button></div>`;
  if(r.error)action=`<p class="wsp-note" role="alert">${esc(st(`mic.${r.error}`))}</p>${action}`;
  const goal=rp.goal;
  return `<div class="wsp wsp-roleplay" data-wsp-stage><div class="wsp-bar"><button class="quiet-button" data-wsp-back ${['opening','rec','stopping','thinking'].includes(r.phase)?'disabled':''}>← ${esc(st('task.back'))}</button><span class="wsp-type">${esc(st('rp.title'))}</span></div>`
   +tutorHtml(r.phase==='done'?'done':r.bubble||'mission')
   +`<section class="wsp-mission"><p class="wsp-label">${esc(st('rp.mission'))}</p><p class="wsp-order" lang="ko"><span>${goal.temperature==='warm'?'따뜻한':'차가운'} ${goal.drink==='tea'?'차':'주스'}</span><span>${goal.count===2?'두':goal.count} 잔</span><span>${goal.place==='here'?'카페 안에서':'포장'}</span></p>${lang()!=='ko'&&rp.missionGloss?.[lang()]?`<p class="wsp-note">${esc(rp.missionGloss[lang()])}</p>`:''}</section>`
   +(offline&&r.phase!=='done'?`<p class="wsp-note">${esc(st('rp.offline'))}</p>`:'')
   +`<ol class="wsp-chat">${turns}</ol><section class="wsp-stage" data-wsp-zone>${action}</section><p class="wsp-sr" aria-live="polite" data-wsp-live></p></div>`;
 }
 function playStaff(rp,stepId,{again=false}={}){
  const step=rp.steps.find(s=>s.id===stepId);if(!step)return;
  stopPlayback();
  if(!again){run.turns=[...(run.turns||[]),{who:'staff',line:step.line,shown:!!run.textShown}];}
  run.step=stepId;run.phase='staff';render();
  const audio=new win.Audio(asset(step.clip));clip=audio;audio.volume=.9;
  // 소리가 끝나지 않고 멈추는 기기(블루투스 전환·출력 장치 없음 등 — README 10-13 음성 후속)도 있어, 9초 안에 끝나지 않으면
  // 직원 말을 글로 보이고 말할 차례로 넘어간다(소리를 못 들은 것을 학생 탓으로 만들지 않는다).
  const showText=()=>{if(run?.turns?.length)run.turns[run.turns.length-1].shown=true;};
  const guard=setTimeout(()=>{if(clip===audio&&run?.phase==='staff'){showText();try{audio.pause();}catch{}done();}},9000);
  const done=()=>{clearTimeout(guard);if(clip!==audio||!run||run.phase!=='staff')return;clip=null;run.phase='turn';
   const lost=!doc.activeElement||doc.activeElement===doc.body||!!stage?.contains(doc.activeElement);render(lost?'[data-wsp-rp-speak]':null);announce(st('rp.yourTurn',{s:rp.answerSec}));};
  audio.addEventListener('ended',done,{once:true});audio.addEventListener('error',()=>{showText();done();},{once:true});
  audio.play().catch(()=>{showText();done();});
 }
 async function rpSpeak(rp){
  if(run?.phase!=='turn')return;
  if(!state.consent){view={...view,consent:true};render('[data-wsp-consent]');return;}
  stopPlayback();sharedCtx();run.phase='opening';run.error=null;const token=run;render();
  let stream;try{stream=await openMic();}catch(error){if(!stopped&&view.kind==='roleplay'&&run===token){run.phase='turn';run.error=error.code;render('[data-wsp-rp-speak]');}return;}
  if(stopped||view.kind!=='roleplay'||run!==token||run.phase!=='opening'){for(const tr of stream.getTracks())tr.stop();return;}
  beep();const level=v=>{const bar=stage?.querySelector('[data-wsp-level]');if(bar)bar.style.setProperty('--level',v.toFixed(3));};
  mic=startRecorder(stream,level);run.phase='rec';run.until=now()+rp.answerSec*1000;run.startedAt=now();render();announce(st('task.beep'));
  clearInterval(ticker);ticker=setInterval(()=>{if(run?.phase!=='rec')return;const left=run.until-now();const el=stage?.querySelector('[data-wsp-clock]');if(el)el.textContent=st('task.left',{s:secs(left)});if(left<=0)void rpStop(rp);},250);
 }
 async function rpStop(rp){
  if(run?.phase!=='rec')return;clearInterval(ticker);ticker=null;run.phase='stopping';
  const m=mic,blob=await stopRecorder(m),voicedMs=m?.unknown?null:m?.voicedMs;closeMic();
  if(stopped||view.kind!=='roleplay'||!run)return;
  const step=rp.steps.find(s=>s.id===run.step),seconds=Math.max(1,Math.round((now()-run.startedAt)/1000));
  if(!blob||voicedMs!=null&&voicedMs<MIN_VOICED_MS){const note=st('rp.silent');run.phase='turn';run.bubble='retry';run.turns=[...run.turns,{who:'me',note}];render('[data-wsp-rp-speak]');announce(note);return;}
  if(!aiAvailable()){run.phase='self';run.turns=[...run.turns,{who:'me',note:st('task.review',{s:seconds}),better:step.model}];render();return;}
  run.phase='thinking';render();
  const expected=owner;let result;
  try{const data=await blobToBase64(blob);result=await feedback.request({action:'turn',request_id:uuid(),consent:'send-once',mode:'roleplay',roleplay_id:rp.id,step_id:step.id,items_version:bank.contentHash,lang:['ko','en','mn'].includes(lang())?lang():'ko',audio:{mime:blob.type||'audio/webm',data},seconds});}
  catch{result={status:'unavailable'};}
  if(stopped||expected!==getOwner()||view.kind!=='roleplay'||!run)return;
  const turn=result?.status==='ok'?result.turn:null,code=turn?turn.status:result?.status||'unavailable';
  if(!turn||turn.status!=='ok'){
   if(AUDIO_FAIL.has(code)){const note=st(code==='not_korean'?'rp.notKorean':'rp.silent');run.misses=(run.misses||0)+1;run.phase='turn';run.bubble='retry';run.turns=[...run.turns,{who:'me',note}];render('[data-wsp-rp-speak]');announce(note);return;}
   // 서버 사정(한도·꺼짐·오류)은 학생 탓이 아니다 — 따라 말하기로 넘겨 예시 문장과 「다음 말 듣기」를 연다(10-21 Fable 검수).
   const note=st('rp.selfNow');run.phase='self';run.turns=[...run.turns,{who:'me',note,better:step.model}];render('[data-wsp-rp-next]');announce(note);return;
  }
  const next=turn.next||{step:'done'},hint=next.hint||(turn.polite==='no'?'polite':null);
  run.turns=[...run.turns,{who:'me',heard:turn.heard,tip:hint||turn.polite==='no'?turn.tip:'',better:hint?turn.better:''}];announce(`${st('rp.heard')}: ${turn.heard}`);
  if(next.step===run.step){run.misses=(run.misses||0)+1;run.phase='turn';run.bubble=hint||'retry';render();return;}
  run.misses=0;run.bubble=hint==='polite'?'polite':'turnOk';
  if(next.step==='done'){run.phase='done';announce(st('rp.done'));log({mode:'roleplay',itemId:rp.id,done:true,counted:true,source:'ai-reference',helped:!!run.helped,turns:run.turns.filter(t=>t.who==='me').length});render();return;}
  playStaff(rp,next.step);
 }
 function rpSelfNext(rp){
  // 자동 대답이 꺼져 있을 때: 정해진 길(주문 → 확인 → 마실 곳)대로 다음 직원 말로 간다. 스스로 연습으로만 남긴다.
  // 수량 되묻기·품절처럼 정해진 길 밖의 차례에서 넘어오면 「확인」으로 간다.
  const order=['order','confirm','place'],at=Math.max(0,order.indexOf(run.step));
  if(at<0||at===order.length-1){run.phase='done';log({mode:'roleplay',itemId:rp.id,done:true,counted:true,source:'self',helped:!!run.helped});render();return;}
  playStaff(rp,order[at+1]);
 }

 // ── 동의 시트(시트 안 단계) ──
 function consentHtml(){
  return `<div class="wsp wsp-consent" data-wsp-stage><h3 class="wsp-section-title">${esc(st('consent.title'))}</h3><ul class="wsp-consent-list"><li>${esc(st('consent.record'))}</li><li>${esc(st('consent.send'))}</li><li>${esc(st('consent.where'))}</li></ul><a class="quiet-button wsp-policy" href="${esc(privacyUrl)}" target="_blank" rel="noopener">${esc(st('consent.policy'))}</a>`
   +`<div class="wsp-actions"><button class="felt-button" data-wsp-consent>${esc(st('consent.agree'))}</button><button class="quiet-button" data-wsp-consent-later>${esc(st('consent.later'))}</button></div></div>`;
 }

 // ── 그리기 ──
 function render(focus=null,{top=false}={}){
  if(stopped)return;syncOwner();
  const root=doc.querySelector('#panel-content [data-wsp-stage]')?.parentElement;if(!root)return;
  const it=view.kind==='task'?item(view.id):null,rp=view.kind==='roleplay'?roleplay(view.id):null;
  if(view.kind==='task'&&!it||view.kind==='roleplay'&&!rp)view={kind:'list'};
  root.innerHTML=view.consent?consentHtml():view.kind==='task'?taskHtml(it):view.kind==='roleplay'?roleplayHtml(rp):listHtml();stage=root.firstElementChild;
  // 새 문항·역할극을 열 때는 시트를 맨 위로 두고 포커스만 옮긴다 — 긴 문제에서 단추까지 내려가 제목·문제 첫 줄이 가려지지 않게(10-21 Fable 검수).
  if(top){const sheet=root.closest('dialog,.world-panel');if(sheet)sheet.scrollTop=0;}
  (focus?stage.querySelector(focus):null)?.focus({preventScroll:top});
 }
 function openTask(id){teardown();view={kind:'task',id};run={itemId:id,phase:'idle',timing:'exam'};render('[data-wsp-start]',{top:true});}
 function openRoleplay(id){teardown();view={kind:'roleplay',id};run={phase:'intro',turns:[],bubble:'mission'};render('[data-wsp-rp-start]',{top:true});}

 // ── 단추(시트 안 위임) ──
 function onClick(event){
  const button=event.target.closest('button');if(!button||!stage?.contains(button))return;
  const d=button.dataset;
  if(button.hasAttribute('data-wsp-consent')){state.consent={at:new Date(now()).toISOString(),version:1};save();const back=view;view={...back,consent:false};render();
   if(back.kind==='task'){const it=item(back.id);if(it)void begin(it);}else if(back.kind==='roleplay'){const rp=roleplay(back.id);if(rp&&run?.phase==='turn')void rpSpeak(rp);}return;}
  if(button.hasAttribute('data-wsp-consent-later')){view={...view,consent:false};render('[data-wsp-start],[data-wsp-rp-speak]');return;}
  if(button.hasAttribute('data-wsp-revoke')){teardown();state.consent=null;save();render('.wsp-lead');announce(st('consent.revoked'));home?.toast?.(st('consent.revoked'));return;}
  if(d.wspOpen){openTask(d.wspOpen);return;}
  if(d.wspRoleplay){openRoleplay(d.wspRoleplay);return;}
  if(button.hasAttribute('data-wsp-back')){const from=view;teardown();view={kind:'list'};render(from.kind==='task'?`[data-wsp-open="${from.id}"]`:from.kind==='roleplay'?`[data-wsp-roleplay="${from.id}"]`:null);return;}
  const it=view.kind==='task'?item(view.id):null,rp=view.kind==='roleplay'?roleplay(view.id):null;
  if(it){
   // 다시 하기·시간 바꾸기에도 「예시 답을 봤다」는 남긴다 — 본 뒤의 녹음은 도움을 받은 것이다(10-21 Fable 검수).
   if(d.wspTiming){if(['opening','prep','rec','stopping','sending'].includes(run?.phase))return;const seen=!!run?.modelSeen;teardown();run={itemId:it.id,phase:'idle',timing:d.wspTiming,modelSeen:seen};render(`[data-wsp-timing="${d.wspTiming}"]`);return;}
   if(button.hasAttribute('data-wsp-start'))void begin(it);
   else if(button.hasAttribute('data-wsp-skip')){if(run?.phase==='prep')startAnswer(it);}
   else if(button.hasAttribute('data-wsp-stop'))void finishAnswer(it);
   else if(button.hasAttribute('data-wsp-retry')){const timing=run?.timing||'exam',seen=!!run?.modelSeen;teardown();run={itemId:it.id,phase:'idle',timing,modelOpen:false,modelSeen:seen};render('[data-wsp-start]');}
   else if(button.hasAttribute('data-wsp-send'))void send(it);
   else if(button.hasAttribute('data-wsp-play')){
    if(!run?.url)return;if(run.playing){player?.pause();return;}
    stopPlayback();player=new win.Audio(run.url);run.playing=true;paintZone(it);
    const end=()=>{if(run){run.playing=false;paintZone(it);}};player.addEventListener('ended',end,{once:true});player.addEventListener('pause',end,{once:true});player.play().catch(end);
   }
   else if(button.hasAttribute('data-wsp-misheard')){
    // 잘못 들은 피드백은 세지 않는다: 이 녹음의 기록을 「세지 않음」으로 바꾸고 코치 기록도 남기지 않는다(10-21 Fable 검수).
    if(!run?.result||run.misheard)return;run.misheard=true;run.pendingRecord=null;
    const entry=[...state.log].reverse().find(e=>e?.requestId&&e.requestId===run.requestId);
    if(entry){entry.counted=false;entry.status='misheard';save();}else log({mode:'exam',itemId:it.id,type:it.type,source:'misheard',counted:false,status:'misheard'});
    say('retry');paintZone(it);}
   else if(button.hasAttribute('data-wsp-self-save')){if(run?.selfSaved)return;if(run)run.selfSaved=true;button.disabled=true;const picked=[...stage.querySelectorAll('[data-wsp-self]:checked')].map(b=>Number(b.dataset.wspSelf));if(run)run.selfPicked=picked;log({mode:'exam',itemId:it.id,type:it.type,source:'self',status:'self',counted:run?.voiced!==false,seconds:run?.seconds,timing:run?.timing,covered:picked,helped:!!run?.modelSeen});if(run?.voiced!==false)record(it,{assisted:!!run?.modelSeen});announce(st('task.selfSaved'));home?.toast?.(st('task.selfSaved'));}
   else if(button.hasAttribute('data-wsp-partner')){stopPlayback();clip=new win.Audio(asset(it.partner.clip));clip.play().catch(()=>{});}
   else if(button.hasAttribute('data-wsp-model')){
    // run을 새 객체로 바꾸지 않는다 — 권한 창을 기다리는 begin()이 run이 그대로인지(token)로 이어 갈지 정한다(10-21 Fable 재확인).
    if(run)run.modelOpen=!run.modelOpen;else run={itemId:it.id,phase:'idle',modelOpen:true};if(run.modelOpen&&!['review','feedback','sending'].includes(run.phase))run.modelSeen=true;const box=stage.querySelector('.wsp-model');if(box){box.hidden=!run.modelOpen;}button.setAttribute('aria-expanded',String(run.modelOpen));button.textContent=st(run.modelOpen?'task.modelHide':'task.model');}
   return;
  }
  if(rp){
   if(button.hasAttribute('data-wsp-rp-start'))playStaff(rp,'order');
   else if(button.hasAttribute('data-wsp-rp-speak'))void rpSpeak(rp);
   else if(button.hasAttribute('data-wsp-rp-stop'))void rpStop(rp);
   else if(button.hasAttribute('data-wsp-rp-listen')){if(run?.phase==='turn')playStaff(rp,run.step,{again:true});}
   else if(button.hasAttribute('data-wsp-rp-text')){run.textShown=!run.textShown;run.helped=run.helped||run.textShown;const last=[...(run.turns||[])].reverse().find(t=>t.who==='staff');if(last)last.shown=run.textShown||last.shown;render('[data-wsp-rp-text]');announce(st('rp.textHelp'));}
   else if(button.hasAttribute('data-wsp-rp-next'))rpSelfNext(rp);
   else if(button.hasAttribute('data-wsp-rp-again')){run.phase='turn';render('[data-wsp-rp-speak]');}
   else if(button.hasAttribute('data-wsp-rp-restart'))openRoleplay(rp.id);
  }
 }
 function mount(){
  const root=doc.querySelector('#panel-content [data-wsp-stage]')?.parentElement;if(!root)return false;
  root.addEventListener('click',onClick);offLang=onLang(()=>render());
  home?.attachPanelResource?.({dispose:()=>{teardown();offLang?.();offLang=null;root.removeEventListener('click',onClick);stage=null;}});
  return true;
 }
 async function open(route='speaking'){
  stopped=false;syncOwner();const seq=++openSeq,current=()=>!stopped&&seq===openSeq;
  show(st('title'),`<div class="wsp" data-wsp-stage><p class="wsp-note" role="status">${esc(st('loading'))}</p></div>`);
  if(!mount())return;
  try{const loaded=await loadSpeakingBank(fetcher);if(!current())return;bank=loaded;}catch{if(!current())return;const root=doc.querySelector('#panel-content [data-wsp-stage]');if(root)root.innerHTML=`<p class="wsp-note" role="alert">${esc(st('loadError'))}</p>`;return;}
  if(feedback&&!status)Promise.resolve().then(()=>feedback.status()).then(next=>next,()=>({enabled:false})).then(next=>{if(!current())return;status=next||{enabled:false};if(view.kind!=='list')render();});
  const [,which]=String(route).split(':');
  if(roleplay(which)){openRoleplay(which);return;}
  const type=Number(which),pick=bank.items.find(i=>i.type===type)||item(which);
  if(pick){openTask(pick.id);return;}
  view={kind:'list'};render();
 }
 return {open,dispose(){stopped=true;teardown();clearTimeout(liveTimer);try{audioCtx?.close?.();}catch{}audioCtx=null;offLang?.();offLang=null;},metrics:()=>({view:{...view},phase:run?.phase||null,consent:!!state.consent,log:state.log.length,status})};
}
