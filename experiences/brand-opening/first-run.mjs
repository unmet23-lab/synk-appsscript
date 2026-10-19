import {motionOn} from './world-motion.mjs';
// WORLD 첫 실행 단계. 10-19 결정(「WORLD 화면 언어 · 도움 언어 방식」, 공개판 설계 §6): 언어 고르기 → 「한글을 읽을 수 있어요?」 → 튜터 고르기.
// 단계마다 needed()가 참일 때만 열고, 고르면 다음 단계로 간다. 언어 고르기는 다음 작업에서 FIRST_RUN_ORDER의 자리로 들어온다
// (그 전에는 등록된 단계가 없어 건너뛴다). 마지막 단계(튜터 고르기)가 처음 부른 곳의 이어 할 일(then)을 넘겨받는다.
export const FIRST_RUN_ORDER=Object.freeze(['language','hangul','tutor']);
// 첫 실행 화면의 글은 여기 한곳에 둔다(언어 고르기가 생기면 문자열 표로 옮긴다). 화면은 그림·소리·글자 시범에 기대고 글은 짧게.
export const FIRST_RUN_TEXT=Object.freeze({
 hangul:Object.freeze({title:'한글',eyebrow:'HANGUL',word:'안녕',listen:'「안녕」 소리 듣기',ask:'한글을 읽을 수 있어요?',no:'아직 못 읽어요',yes:'읽을 수 있어요',
  saving:'고른 것을 저장하고 있어요.',failed:'저장하지 못했어요. 다시 골라 주세요.'}),
});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createFirstRun({steps={}}={}){
 let running=null;
 async function needed(step){try{return !!await step.needed();}catch{return false;}}
 // 한 번에 한 흐름만 돈다. 도는 동안 다시 부르면 이어 할 일만 새것으로 바꾼다(튜터 고르기의 open과 같은 규칙).
 async function run({then=null}={}){
  if(running){if(then)running.then=then;return false;}
  const job={then};running=job;
  try{
   for(const id of FIRST_RUN_ORDER){
    const step=steps[id];if(!step||!await needed(step))continue;
    if(running!==job)return false;
    if(id===FIRST_RUN_ORDER[FIRST_RUN_ORDER.length-1]){running=null;step.open(job.then);return true;}
    // 답하면 true, 판을 닫으면 false(그 흐름은 멈추고, 입장 관문이 처음 화면으로 돌린다).
    if(!await step.open()||running!==job)return false;
   }
   running=null;job.then?.();return true;
  }finally{if(running===job)running=null;}
 }
 return Object.freeze({run,order:FIRST_RUN_ORDER,active:()=>!!running,cancel(){running=null;}});
}

// 「한글을 읽을 수 있어요?」 한 장. read()는 저장된 답(없으면 null), save(answer)는 'new'|'reads'를 저장한다(계정이면 계정, 손님이면 기기).
// 그림은 몽글 시범 두 칸이다(10-19, 이 화면에 맞게 GPT 이미지 2.5로 장면과 한 장으로 구워 나눔 — 원판·지시문은 저장소 밖
// Documents/synk-vendor/world-first-hangul-20261019): ① 펠트 「안녕」 단추에서 나는 소리를 몽글이 눈 감고 듣고 ② 올라타 누르면 글자가 켜진다.
// 소리는 한글 만나기의 실제 녹음 「안녕」, 시범은 소리가 실제로 나기 시작할 때 글자를 하나씩 켜고 ① → ② 칸을 차례로 또렷하게 하는 것.
const DEMO_FRAMES=Object.freeze([['listen','assets/world-felt/hangul-demo-listen.webp'],['press','assets/world-felt/hangul-demo-press.webp']]);
export function createHangulStep({home,asset,read,save}){
 const T=FIRST_RUN_TEXT.hangul,glyphs=[...T.word];
 const icon=kind=>kind==='new'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.2 9.1a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.9v.6"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>'
  :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.6l4.2 4.1 8.8-9.4"/></svg>';
 const frame=([id,path])=>`<span class="first-hangul-frame" data-frame="${id}"><img src="${asset(path)}" alt="" width="520" height="590" decoding="async"></span>`;
 const next='<i class="first-hangul-next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"/></svg></i>';
 // 사진 속 펠트 단추를 눌러도 같은 시범이 난다(글을 못 읽는 사람은 사진부터 누른다). 읽어 주는 기기에는 아래 「안녕」 단추 하나만 보인다.
 const markup=()=>`<div class="first-hangul"><div class="first-hangul-card"><div class="first-hangul-demo" data-first-hangul-listen aria-hidden="true">${frame(DEMO_FRAMES[0])}${next}${frame(DEMO_FRAMES[1])}</div><button type="button" class="first-hangul-word" data-first-hangul-listen aria-label="${escape(T.listen)}">${glyphs.map(g=>`<span class="first-hangul-glyph">${escape(g)}</span>`).join('')}<i class="first-hangul-speaker" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.6a7.6 7.6 0 0 1 0 10.8"/></svg></i></button></div><p class="first-hangul-ask" id="first-hangul-ask">${escape(T.ask)}</p><div class="first-hangul-choices" role="group" aria-labelledby="first-hangul-ask"><button type="button" data-first-hangul="new">${icon('new')}<span>${escape(T.no)}</span></button><button type="button" data-first-hangul="reads">${icon('reads')}<span>${escape(T.yes)}</span></button></div><p class="first-hangul-status" role="status" aria-live="polite"></p></div>`;
 let clips=null;
 const voice=()=>clips||(clips=fetch(asset('../hangul-stage/assets/voice/voices.json')).then(r=>r.ok?r.json():null).then(v=>v?.approved&&v.clips?.[T.word]?asset('../hangul-stage/assets/voice/'+v.clips[T.word]):null).catch(()=>null));
 function open(){
  return new Promise(resolve=>{
   let settled=false,busy=false,audio=null,run=null;const timers=new Set();
   const stop=()=>{run=null;timers.forEach(clearTimeout);timers.clear();audio?.pause();audio=null;document.querySelectorAll('.first-hangul-glyph.is-lit').forEach(el=>el.classList.remove('is-lit'));document.querySelector('.first-hangul-demo')?.removeAttribute('data-step');};
   const finish=value=>{if(settled)return;settled=true;stop();document.removeEventListener('click',click);resolve(value);};
   // 시범: 소리를 들려주며 글자를 하나씩 켜고, 그동안 ① 듣기 칸 → 끝나면 ② 누르기 칸을 잠깐 또렷하게 한 뒤 두 칸을 같게 되돌린다
   // (움직임 줄이기에서는 소리만, 두 칸은 그대로). 글자는 소리가 실제로 나기 시작할 때(playing) 켠다 — 10-19 실측에서 미리 정한 시각으로
   // 켜면 처음 열 때 「안」이 소리보다 0.2초(망 지연 150ms 흉내에서는 0.27초) 먼저 켜졌다.
   async function demo(){
    stop();const root=document.querySelector('.first-hangul');if(!root)return;
    const token=run={},lit=[...root.querySelectorAll('.first-hangul-glyph')],scene=root.querySelector('.first-hangul-demo'),light=!home.state?.reduced&&motionOn();
    const later=(ms,fn)=>{const timer=setTimeout(()=>{timers.delete(timer);if(run===token)fn();},ms);timers.add(timer);};
    // ② 칸(글자가 켜진 그림)을 또렷하게 하는 동안에는 큰 단추의 글자도 켜 두었다가 함께 되돌린다.
    const show=slot=>{
     if(light&&scene)scene.dataset.step='listen';
     if(light)lit.forEach((el,i)=>later(40+i*slot,()=>el.classList.add('is-lit')));
     const end=40+lit.length*slot+500;
     if(light&&scene)later(end,()=>{scene.dataset.step='press';});
     later(light?end+1400:end,()=>{lit.forEach(el=>el.classList.remove('is-lit'));scene?.removeAttribute('data-step');});
    };
    const src=await voice();if(settled||run!==token)return;
    if(!src){show(360);return;}
    // 녹음은 앞뒤 무음을 걷은 파일이라 음절이 길이를 고르게 나눈다(「안녕」 0.70초 실측: 안 0.04초 · 녕 0.27초에 시작).
    // 재생이 막히거나(거절·오류) 1.5초 안에 소리가 안 나면 글자 시범만 먼저 하고, 그 뒤에 소리가 나면 그때 다시 맞춘다.
    const clip=new Audio(src);audio=clip;let shown=null;
    const begin=kind=>{
     if(run!==token||shown==='sound'||(shown&&kind!=='sound'))return;
     if(shown){timers.forEach(clearTimeout);timers.clear();lit.forEach(el=>el.classList.remove('is-lit'));}
     shown=kind;show(kind==='sound'&&Number.isFinite(clip.duration)&&clip.duration>0?Math.max(200,(clip.duration*1000-160)/lit.length):360);
    };
    clip.addEventListener('playing',()=>begin('sound'),{once:true});
    clip.addEventListener('error',()=>begin('fallback'),{once:true});
    later(1500,()=>begin('fallback'));
    clip.play().catch(()=>{if(audio===clip)audio=null;begin('fallback');});
   }
   async function choose(answer){
    if(busy)return;busy=true;const root=document.querySelector('.first-hangul'),status=root?.querySelector('.first-hangul-status');
    root?.querySelectorAll('button').forEach(b=>b.disabled=true);if(status)status.textContent=T.saving;
    try{await save(answer);finish(true);}
    catch(error){busy=false;if(settled)return;root?.querySelectorAll('button').forEach(b=>b.disabled=false);if(status)status.textContent=error?.message||T.failed;}
   }
   function click(event){
    const button=event.target.closest('[data-first-hangul],[data-first-hangul-listen]');if(!button||!document.querySelector('#panel-content')?.contains(button))return;
    event.preventDefault();
    if(button.hasAttribute('data-first-hangul-listen'))void demo();else void choose(button.dataset.firstHangul);
   }
   // 튜터 고르기와 같은 첫 실행 판(복숭아 판, 틀 전체)에 띄운다. 다음 단계가 판을 바꾸면 이미 답했으니 그대로 끝난다.
   home.showPanel(T.title,markup(),{type:'tutor',eyebrow:T.eyebrow});
   document.querySelector('#world-panel').dataset.reduced=String(!!home.state?.reduced);
   home.attachPanelResource({dispose(){finish(false);}});
   document.addEventListener('click',click);
   void demo();
  });
 }
 return Object.freeze({id:'hangul',needed:async()=>!(await read()),open});
}
