import {supportLine} from './game-tutor-support.mjs';
import {tutorFace} from './game-tutor-lines.mjs';
import {verdict,play as playSound,haptic,getPref} from './world-sound.mjs';
const asset=path=>new URL(path,import.meta.url).href;
// 다시 풀기(어려웠던 곳 한 문항): 문제 → 고르기 → 판정은 world-sound의 verdict 하나(소리·진동·튜터 자세 한 번).
// 맞히면 같은 창이 결과 한 장으로 바뀐다(조사 ⑦): 코랄 포스터(부메랑 인화지 + 큰 한글 한 줄 + 맞힌 표현과 다시 듣기) + 흰 알약 「놀이로 돌아가기」.
// 연출은 200ms 페이드 + 소리 한 번이고, 설정의 「보상 연출」이 꺼져 있으면 결과만 보인다.
export function createTutorReview({tutor,game,entry,container,reduced=()=>false,onComplete=()=>{},onCancel=()=>{}}){
 const r=entry.review;if(!r)return null;
 let disposed=false,voice=null,epoch=0,heard=!r.audio&&!r.glyph,correct=false,selected=null;
 const dialog=document.createElement('dialog');dialog.className='tutor-review';dialog.dataset.tutor=tutor.id;dialog.dataset.supportType=entry.type;dialog.setAttribute('aria-label',`${tutor.name}과 어려웠던 내용 다시 연습`);
 dialog.innerHTML=`<header><div><small></small><h3>다시 풀기</h3></div><button type="button" class="tutor-review-exit" aria-label="다시 연습을 닫고 힌트로 돌아가기">×</button></header><div class="tutor-review-speech"><span class="game-tutor-portrait" data-character="${tutor.id}"><img class="game-tutor-body" width="480" height="480" alt=""><img class="game-tutor-face" width="480" height="480" alt="" aria-hidden="true"></span><div><p class="tutor-review-line" role="status" aria-live="polite"></p></div></div><div class="tutor-review-question"><p class="tutor-review-prompt"></p><button type="button" class="tutor-review-listen">소리 듣기</button><p class="tutor-review-status" role="status"></p><div class="tutor-review-options" role="group" aria-label="다시 골라 보기"></div><p class="tutor-review-hint" hidden></p></div><section class="tutor-review-result" hidden aria-label="다시 풀기 결과"><div class="tutor-review-poster"><span class="tutor-review-print" aria-hidden="true"><img alt="" width="640" height="640" decoding="async"></span><p class="tutor-review-tag" aria-hidden="true">REVIEW · DONE</p><p class="tutor-review-word">다시 풀기, 끝!</p><div class="tutor-review-answer"><span class="tutor-review-answer-text"></span><button type="button" class="tutor-review-again" hidden>다시 듣기</button></div></div></section><button type="button" class="tutor-review-return" hidden>놀이로 돌아가기</button>`;
 container.append(dialog);const $=s=>dialog.querySelector(s);
 $('header small').textContent=tutor.name+'과 · '+entry.title;
 $('.game-tutor-body').src=asset('assets/tutors/'+tutor.images.기본);$('.game-tutor-body').alt=tutor.name;
 $('.tutor-review-print img').src=asset('assets/world-felt/review.webp');
 const face=kind=>{$('.game-tutor-face').src=asset('assets/tutors/'+tutor.images[tutorFace(tutor.id,kind)]);dialog.dataset.face=tutorFace(tutor.id,kind);};
 const stop=()=>{epoch++;voice?.pause();voice=null;};
 const status=text=>$('.tutor-review-status').textContent=text;
 const options=r.options.map((text,index)=>{const b=document.createElement('button');b.type='button';b.className='tutor-review-option';b.textContent=text;b.dataset.option=String(index);b.disabled=!heard;b.addEventListener('click',()=>choose(index));$('.tutor-review-options').append(b);return b;});
 // 글자·O/X처럼 짧은 보기는 칸으로, 문장 보기는 한 줄씩 읽히게 줄로 놓는다.
 $('.tutor-review-options').dataset.layout=r.options.every(text=>[...text].length<=4)?'grid':'rows';
 $('.tutor-review-prompt').textContent=heard||r.glyph?r.prompt:'소리를 먼저 끝까지 들어요.';
 $('.tutor-review-line').textContent=supportLine(tutor.id,entry);
 $('.tutor-review-listen').hidden=!r.audio&&!r.glyph;
 status(heard?'다시 골라 보세요.':'소리가 끝나면 보기를 고를 수 있어요.');face('retry');
 async function play(){
  stop();const mine=epoch;voice=null;$('.tutor-review-listen').disabled=true;$('.tutor-review-again').disabled=true;status('소리를 듣고 있어요.');
  try{
   let url=r.audio&&asset('../'+r.audio);
   if(r.glyph){const response=await fetch(asset('../hangul-stage/assets/voice/voices.json'));if(!response.ok)throw Error();const manifest=await response.json(),file=manifest.approved===true&&manifest.clips?.[r.glyph];if(typeof file!=='string'||!/^[-a-zA-Z0-9]+\.mp3$/.test(file))throw Error();url=asset('../hangul-stage/assets/voice/'+file);}
   if(disposed||mine!==epoch||document.hidden)return;
   const clip=new Audio(url);voice=clip;clip.volume=.8;
   clip.onended=()=>{if(disposed||mine!==epoch)return;voice=null;heard=true;$('.tutor-review-prompt').textContent=r.prompt;options.forEach(b=>b.disabled=correct);$('.tutor-review-listen').disabled=false;$('.tutor-review-again').disabled=false;$('.tutor-review-listen').textContent='다시 듣기';status(correct?'다시 풀기를 마쳤어요.':'보기를 골라요.');};
   clip.onerror=()=>failed(mine);await clip.play();
  }catch{failed(mine);}
 }
 function failed(mine){if(disposed||mine!==epoch)return;stop();$('.tutor-review-listen').disabled=false;$('.tutor-review-again').disabled=false;status('소리를 불러오지 못했어요. 다시 듣기를 눌러 주세요.');if(!heard)options.forEach(b=>b.disabled=true);}
 function showResult(){
  // 결과 한 장: 맞힌 표현(짧으면 크게)과 다시 듣기, 흰 알약 하나. 문제 영역은 접는다.
  const answer=r.options[r.correct]??'';
  $('.tutor-review-answer-text').textContent=answer;$('.tutor-review-answer').dataset.size=[...answer].length<=6?'glyph':'sentence';
  $('.tutor-review-again').hidden=!r.audio&&!r.glyph;
  $('.tutor-review-question').hidden=true;$('.tutor-review-result').hidden=false;
  const celebrate=getPref('celebrate')&&!reduced()&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  dialog.dataset.result=celebrate?'enter':'done';
  if(getPref('celebrate')){playSound('done');haptic('done');}
 }
 function choose(index){
  if(disposed||!heard||correct)return;selected=index;correct=index===r.correct;
  options.forEach((b,i)=>{b.classList.toggle('selected',i===index);b.setAttribute('aria-pressed',String(i===index));b.disabled=correct;});
  // 판정 하나: 소리 + 진동 + (설정의 「친구들의 반응」이 켜져 있을 때만) 튜터 자세 한 번.
  verdict(correct,{react:ok=>face(ok?'success':'retry')});
  $('.tutor-review-line').textContent=correct?({marin:'재확인 완료. …네가 다시 해냈다.',kkamong:'훗. 내가 짚어 줬지. …다시 해냈네.',mongle:'우와! 다시 찾았어! 우리 같이 해냈어!'})[tutor.id]:supportLine(tutor.id,entry);
  $('.tutor-review-hint').hidden=correct;$('.tutor-review-hint').textContent=entry.hint;
  status(correct?'다시 풀기를 마쳤어요.':'힌트를 보고 한 번 더 골라요.');
  $('.tutor-review-return').hidden=!correct;if(correct){stop();showResult();$('.tutor-review-return').focus({preventScroll:true});}
 }
 const cancel=event=>{event?.preventDefault();event?.stopPropagation();onCancel();};
 $('.tutor-review-listen').addEventListener('click',()=>void play());$('.tutor-review-again').addEventListener('click',()=>void play());$('.tutor-review-exit').addEventListener('click',cancel);dialog.addEventListener('cancel',cancel);
 $('.tutor-review-return').addEventListener('click',()=>{if(correct)onComplete();});
 const visibility=()=>{if(document.hidden){stop();$('.tutor-review-listen').disabled=false;$('.tutor-review-again').disabled=false;if(!heard)status('소리가 멈췄어요. 다시 끝까지 듣고 골라 보세요.');}};
 document.addEventListener('visibilitychange',visibility);dialog.dataset.reduced=String(reduced());dialog.showModal();(heard?options[0]:$('.tutor-review-listen')).focus({preventScroll:true});
 return {element:dialog,metrics:()=>({type:entry.type,id:entry.id,heard,correct,selected,voicePlaying:voice?.paused===false}),dispose(){if(disposed)return;disposed=true;stop();document.removeEventListener('visibilitychange',visibility);if(dialog.open)dialog.close();dialog.remove();}};
}
