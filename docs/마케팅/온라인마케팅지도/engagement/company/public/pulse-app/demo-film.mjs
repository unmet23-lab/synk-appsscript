import {mountRequestFlow} from './request-flow.mjs';
import {emptyAnswers} from './request-data.mjs';
import {roomView,mountRoom,draftView,mountDraft} from './film-views.mjs';
import {modelCard} from './room-view.mjs';
import {esc} from './api.mjs';
import {rise} from './motion.mjs';

// 예시 프로젝트(2026-11-04): 서버 없이 도는 둘러보기. 오미톡 · 첨벙댕은 모두 가상 브랜드이고, 첨벙댕 장면은 실제로 만든 자체 작품의 콘티다.
const S='./assets/request/';
export const DEMO_FILES=[{src:S+'demo-can-front.webp',label:'제품 정면',size:'3024 × 4032'},{src:S+'demo-can-side.webp',label:'옆면',size:'3024 × 4032'},{src:S+'demo-can-back.webp',label:'뒷면',size:'3024 × 4032'}];
export const DEMO_BRIEF=[['광고할 것','오미톡 오미자 스파클링 · 음료 · 식품'],['올릴 곳','릴스 · 쇼츠 · 틱톡'],['길이 · 구성','15초 · 한 편 · 39만원부터'],['보는 사람','운동 끝나고 목마른 20대'],['남길 것','한 캔에 맛이 다섯 번 바뀐다'],['화면 글자','다섯 가지 맛, 톡.\n11월 편의점 출시'],['피할 말','갈증 해소, 피로 회복, 다이어트'],['무엇으로','한 장면의 임팩트로'],['모델','한결'],['받고 싶은 날','11월 21일 (토)'],['최종 확인','의뢰하신 분']];
const ROOM={title:'오미톡 오미자 스파클링 15초',number:'P-1104-7F3A',manager:'유호',brief:DEMO_BRIEF.slice(0,6),files:DEMO_FILES,others:[],answered:[],canEdit:true,asks:[{id:'demo-logo',label:'로고 파일',why:'끝 화면에 그대로 얹어요. AI · SVG가 가장 좋고, 배경이 없는 PNG도 괜찮아요.'},{id:'demo-side',label:'캔 옆면 사진을 더 크게',why:'지금 사진은 작아서 접사 컷에서 라벨이 흐릴 수 있어요. 원본이 있으면 보내 주세요.'}],proposal:{...modelCard('M06'),note:'운동 끝난 얼굴이 제품과 잘 어울려요. 음료와 러닝 쪽 쓰임도 맞아요.'}};
const CUTS=[
  {seconds:2.17,what:'동해 모래사장, 외계의 옆얼굴 접사. 바람에 은빛 정수리 털이 날리고 눈을 가늘게 떠요.',say:'제 개 이름은 외계예요.',text:'제 개 이름은 / 외계예요'},
  {seconds:1.63,what:'같은 해변, 등을 보이고 오른쪽으로 걸어 나가요. 발자국만 남아요.',say:'뛰어노는 걸 제일 좋아해요.',text:'뛰어노는 걸 / 제일 좋아해요'},
  {seconds:2.70,what:'모래사장 멀리 두 사람. 외계가 달려가자 두 사람이 한 걸음 물러서요.',say:'근데 다들 놀라요.',text:'다들 놀라요'},
  {seconds:4.73,what:'민재의 원룸. 침대 위 택배 상자를 웃으며 열고 레몬색 구명조끼를 꺼내 들어 보여요.',say:'특별한 걸 하나 샀어요.',text:'특별한 걸 / 하나 샀어요'},
  {seconds:1.60,what:'창가 의자 위 외계에게 조끼를 입혀요.',say:'튼튼해요. 등에 손잡이가 두 개라',text:'튼튼해요 / 등에 손잡이가 두 개라'},
  {seconds:0.63,what:'조끼 등의 남색 손잡이 둘을 잡는 두 손.',say:'물에서도',text:'물에서도'},
  {seconds:1.43,what:'유리 중문 앞, 파란 미러 선글라스를 쓴 민재가 손잡이 둘로 외계를 가방처럼 번쩍 들어요.',say:'번쩍 건져요.',text:'번쩍 / 건져요'},
  {seconds:1.37,what:'무릎 높이. 손잡이에 들린 외계가 무표정으로 오른쪽을 봐요.',say:'올해는 진짜 멋있을 거예요.',text:'올해는 진짜 / 멋있을 거예요'},
  {seconds:3.07,what:'의자 위 외계 접사. 파란 미러 선글라스와 레몬색 조끼, 정면 무표정.',say:'',text:''},
  {seconds:2.73,what:'선글라스 쓴 민재 전신. 외계 머리를 쓰다듬고 카메라를 보며 엄지척.',say:'물놀이 가는 날엔, 첨벙댕.',text:'물놀이 가는 날엔, 첨벙댕'},
].map((cut,i)=>({...cut,src:`${S}cut-${String(i+1).padStart(2,'0')}.webp`}));
const MODEL=modelCard('M04');
const DRAFT={round:2,oneLine:'산책만 나가면 사람들이 놀라던 우리 개, 구명조끼 하나 입혔더니 해변의 멋쟁이.',cuts:CUTS,model:MODEL,ratio:'9:16'};
const SCRIPT={round:1,oneLine:DRAFT.oneLine,cuts:CUTS.map(({src,...cut})=>cut),model:MODEL,ratio:'9:16'};
const demoBackend=()=>({answers:emptyAnswers(),step:'',save:async()=>{},later:()=>{},
  upload:(slot,file,onProgress)=>new Promise(resolve=>{let p=0;const timer=setInterval(()=>{p+=.2;onProgress(Math.min(1,p));if(p>=1){clearInterval(timer);resolve({id:String(Date.now())});}},140);}),
  submit:async()=>({number:'P-1104-7F3A',at:new Date().toISOString(),link:location.href})});
const SCENES=[['request','의뢰서 쓰기'],['room','저희 차례일 때'],['ask','더 여쭐 때'],['model','모델 확인'],['script','글 콘티'],['draft','장면 이미지']];
// 둘러보기. 시안은 extra로 첫 화면 · 내부 확인 같은 장면을 앞에 더한다. 손님 예시에는 내부 화면을 싣지 않는다.
export function mountFilmDemo(host,{internal=false,start='',onLeave,extra=[]}={}){
  const scenes=[...extra.map(item=>[item.id,item.label]),...SCENES],nav=document.createElement('nav');nav.className='demo-nav';nav.setAttribute('aria-label','예시 둘러보기');
  nav.innerHTML=`<span class="demo-label">${internal?'시안':'예시'}</span>${scenes.map(([id,label])=>`<button type="button" data-scene="${esc(id)}">${esc(label)}</button>`).join('')}${onLeave?'<button type="button" data-proto-leave>나가기</button>':''}`;
  document.body.append(nav);
  // 예시라 실제로 보내지 않는 단추는 그 자리에서 그렇게 말한다.
  let noteTimer=0;
  const say=text=>{let box=document.querySelector('.demo-note');if(!box){box=document.createElement('p');box.className='demo-note';box.setAttribute('role','status');document.body.append(box);}box.textContent=text;box.hidden=false;rise(box,{y:6,blur:0,duration:220});clearTimeout(noteTimer);noteTimer=setTimeout(()=>{box.hidden=true;},3600);};
  let handle=null;
  function clear(){handle?.unmount?.();handle=null;const next=host.cloneNode(false);host.replaceWith(next);host=next;return next;}
  function go(id){
    const root=clear();window.scrollTo(0,0);if(root.parentElement)root.parentElement.scrollTop=0;
    nav.querySelectorAll('[data-scene]').forEach(button=>button.classList.toggle('is-on',button.dataset.scene===id));
    const custom=extra.find(item=>item.id===id);if(custom){custom.render(root,go);return;}
    if(id==='request'){handle=mountRequestFlow(root,{backend:demoBackend(),onRoom:()=>go('room'),onExit:()=>go('room')});return;}
    if(['room','ask','model'].includes(id)){
      const state={room:'check',ask:'ask',model:'model'}[id],stage=id==='model'?'draft':'check';
      root.innerHTML=roomView({...ROOM,state,stage});
      mountRoom(root,{onGo:to=>{if(to==='request')go('request');else if(to==='check')go('room');else if(to==='draft')go('script');},onModel:()=>go('script'),onEdit:()=>go('request'),onForm:()=>go('room'),onContact:()=>say('예시라 보내지 않아요. 실제 의뢰에서는 담당자에게 바로 전해져요.'),onFiles:()=>say('예시라 올리지 않아요. 실제 의뢰에서는 여기서 자료를 더 보내실 수 있어요.')});return;
    }
    if(id==='script'){root.innerHTML=draftView(SCRIPT);handle=mountDraft(root,SCRIPT,{onBack:()=>go('room'),onApprove:()=>go('draft'),onSend:()=>go('room'),onRecast:()=>go('model')});return;}
    if(id==='draft'){root.innerHTML=draftView(DRAFT);handle=mountDraft(root,DRAFT,{onBack:()=>go('room'),onApprove:()=>go('room'),onSend:()=>go('room')});}
  }
  nav.addEventListener('click',event=>{if(event.target.dataset?.protoLeave!==undefined){onLeave?.();return;}const id=event.target.dataset?.scene;if(id){nav.classList.remove('is-open');go(id);}});
  addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(scenes.some(scene=>scene[0]===id))go(id);});
  go(scenes.some(scene=>scene[0]===start)?start:scenes[0][0]);
}
