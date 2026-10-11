import {TUTOR_GAME_EVENT,TUTOR_GAME_COMMAND} from './game-tutor-contract.mjs';
import {TUTOR_IDS} from './tutor-choice.mjs';

// Optional, same-origin frame companion. Existing games remain playable alone.
export function connectGameTutor(game,{onHelp=()=>{},onHelpClose=()=>{},onPracticeComplete=()=>{},onResumeAfterHelp=()=>{}}={}){
 if(window.parent===window)return null;
 const emit=(kind,detail={})=>window.parent.postMessage({type:TUTOR_GAME_EVENT,version:1,game,kind,...detail},location.origin);
 const message=event=>{
  const data=event.data;
  if(event.source!==window.parent||event.origin!==location.origin||data?.type!==TUTOR_GAME_COMMAND||data.version!==1||data.game!==game)return;
  if(data.action==='help')onHelp();
  if(data.action==='help-close')onHelpClose();
  if(data.action==='practice-complete'&&TUTOR_IDS.includes(data.tutor)&&document.body.dataset.gameTutor===data.tutor)onPracticeComplete();
  if(data.action==='help-resume'&&TUTOR_IDS.includes(data.tutor)&&document.body.dataset.gameTutor===data.tutor)onResumeAfterHelp();
  if(data.action==='configure'&&TUTOR_IDS.includes(data.tutor)){
   document.body.dataset.gameTutor=data.tutor;
   // These images were the old generic guide; the selected companion now owns it.
   document.querySelectorAll('#stage-mongle,#r-mongle,.reason>.mongle,.prompt>.mini').forEach(img=>img.hidden=true);
   if(!document.querySelector('[data-game-tutor-style]')){
    const style=document.createElement('style');style.dataset.gameTutorStyle='';
    style.textContent='body[data-game-tutor] #stage-mongle,body[data-game-tutor] #r-mongle,body[data-game-tutor] .reason>.mongle,body[data-game-tutor] .prompt>.mini{display:none!important}';
    document.head.append(style);
   }
  }
 };
 window.addEventListener('message',message);
 window.addEventListener('pagehide',()=>window.removeEventListener('message',message),{once:true});
 emit('ready');
 return {emit};
}
