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
// 그림은 한글 만나기의 펠트 사진, 소리는 한글 만나기의 실제 녹음 「안녕」, 시범은 소리에 맞춰 글자가 하나씩 켜지는 것.
export function createHangulStep({home,asset,read,save}){
 const T=FIRST_RUN_TEXT.hangul,glyphs=[...T.word];
 const icon=kind=>kind==='new'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.2 9.1a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.9v.6"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>'
  :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.6l4.2 4.1 8.8-9.4"/></svg>';
 const markup=()=>`<div class="first-hangul"><div class="first-hangul-card"><span class="w-print first-hangul-print" aria-hidden="true"><img src="${asset('assets/world-felt/hangul.webp')}" alt="" width="640" height="640" decoding="async"></span><button type="button" class="first-hangul-word" data-first-hangul-listen aria-label="${escape(T.listen)}">${glyphs.map(g=>`<span class="first-hangul-glyph">${escape(g)}</span>`).join('')}<i class="first-hangul-speaker" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.6a7.6 7.6 0 0 1 0 10.8"/></svg></i></button></div><p class="first-hangul-ask" id="first-hangul-ask">${escape(T.ask)}</p><div class="first-hangul-choices" role="group" aria-labelledby="first-hangul-ask"><button type="button" data-first-hangul="new">${icon('new')}<span>${escape(T.no)}</span></button><button type="button" data-first-hangul="reads">${icon('reads')}<span>${escape(T.yes)}</span></button></div><p class="first-hangul-status" role="status" aria-live="polite"></p></div>`;
 let clips=null;
 const voice=()=>clips||(clips=fetch(asset('../hangul-stage/assets/voice/voices.json')).then(r=>r.ok?r.json():null).then(v=>v?.approved&&v.clips?.[T.word]?asset('../hangul-stage/assets/voice/'+v.clips[T.word]):null).catch(()=>null));
 function open(){
  return new Promise(resolve=>{
   let settled=false,busy=false,audio=null;const timers=new Set();
   const stop=()=>{timers.forEach(clearTimeout);timers.clear();audio?.pause();audio=null;document.querySelectorAll('.first-hangul-glyph.is-lit').forEach(el=>el.classList.remove('is-lit'));};
   const finish=value=>{if(settled)return;settled=true;stop();document.removeEventListener('click',click);resolve(value);};
   // 시범: 소리를 들려주며 글자를 하나씩 켠다(움직임 줄이기에서는 소리만).
   async function demo(){
    stop();const root=document.querySelector('.first-hangul');if(!root)return;
    const lit=[...root.querySelectorAll('.first-hangul-glyph')],light=!home.state?.reduced&&motionOn();
    if(light)lit.forEach((el,i)=>{const timer=setTimeout(()=>{timers.delete(timer);el.classList.add('is-lit');},120+i*360);timers.add(timer);});
    const end=setTimeout(()=>{timers.delete(end);lit.forEach(el=>el.classList.remove('is-lit'));},260+lit.length*360+600);timers.add(end);
    const src=await voice();if(settled||!src)return;
    const clip=new Audio(src);audio=clip;clip.play().catch(()=>{if(audio===clip)audio=null;});
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
