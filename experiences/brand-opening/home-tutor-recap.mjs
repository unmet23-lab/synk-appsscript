import {createLifeTutor} from './life-tutor.mjs';
import {homeTutorDayLine} from './home-tutor-days.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createHomeTutorRecap({container,tutorId,days,status,onFinish,onClose,reduced=()=>false}){
 let closed=false,signature='';
 const dialog=document.createElement('dialog');dialog.className='game-tutor-guide home-day-recap';dialog.setAttribute('aria-labelledby','home-day-title');
 dialog.innerHTML='<header class="home-day-header"><div><small class="home-day-date"></small><h3 id="home-day-title">오늘의 한국어, 함께 돌아보기</h3></div></header><div class="home-day-tutor"></div><div class="home-day-content"></div><p class="home-day-save" role="status"></p><div class="game-tutor-guide-footer"><button type="button" class="game-tutor-continue home-day-finish">오늘은 여기까지</button><button type="button" class="game-tutor-sound home-day-close">마루로 돌아가기</button><small>하던 수업과 카페는 그대로 이어갈 수 있어요.</small></div>';
 container.append(dialog);
 const tutor=createLifeTutor({tutorId,container:dialog.querySelector('.home-day-tutor'),state:{scope:'home'},reduced,lineForState:()=>homeTutorDayLine(tutorId,days.today,{finished:days.today.closed})});
 tutor.element.querySelector('.game-tutor-help').hidden=true;
 function render(){
  if(closed)return;
  const day=days.today,blocked=['loading','unavailable','unreadable','conflict'].includes(status?.phase)||status?.rejected;
  dialog.querySelector('.home-day-date').textContent=`${day.date.replaceAll('-','.')} · 한국 시간 기준`;
  tutor.update({scope:'home',practiceCompleted:day.closed});
  const key=JSON.stringify(day);
  if(key!==signature){signature=key;
   dialog.querySelector('.home-day-content').innerHTML=day.count?`<p class="home-day-overview">오늘 만난 표현 <b>${day.count}개</b></p>${[
    ['혼자 맞힌 말',day.independent,'다음에도 다른 상황에서 확인해 봐요.'],
    ['함께 확인한 말',day.together,'도움과 함께 연습했어요. 다음에는 스스로 확인해 봐요.'],
    ['다시 볼 말',day.retry,'서두르지 않고 다시 만나요.']
   ].filter(([,items])=>items.length).map(([title,items,note])=>`<section class="home-day-group"><h4>${title} <span>${items.length}</span></h4><ul>${items.map(item=>`<li>${esc(item.title)}</li>`).join('')}</ul><p>${note}</p></section>`).join('')}`:'<p class="home-day-empty">오늘 첫 표현을 만나면 여기에 기록이 모여요.</p>';
  }
  const button=dialog.querySelector('.home-day-finish');button.disabled=blocked||!day.count||day.closed;button.textContent=day.closed?'오늘의 마무리 완료':'오늘은 여기까지';
  dialog.dataset.finished=String(day.closed);dialog.querySelector('.home-day-save').textContent=status?.message||'이 기기에 기록해요.';
 }
 const close=()=>{if(!closed)onClose();};
 dialog.querySelector('.home-day-close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelector('.home-day-finish').addEventListener('click',()=>{try{onFinish();}catch{dialog.querySelector('.home-day-save').textContent='마무리를 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.';}});
 render();const heading=dialog.querySelector('#home-day-title');heading.tabIndex=-1;heading.autofocus=true;dialog.showModal();heading.focus({preventScroll:true});dialog.scrollTop=0;
 return {update(next,nextStatus){days=next;status=nextStatus;render();},dispose(){if(closed)return;closed=true;tutor.dispose();if(dialog.open)dialog.close();dialog.remove();}};
}
