import {mountRequestFlow} from './request-flow.mjs';
import {emptyAnswers} from './request-data.mjs';
import {roomView,mountRoom,draftView,mountDraft} from './film-views.mjs';
import {modelCard} from './room-view.mjs';
import {projectView} from './views.mjs';
import {mountReview,mountFinal} from './film-review.mjs';
import {esc} from './api.mjs';
import {play} from './motion.mjs';

// 예시 프로젝트(2026-11-05 시사실 판): 서버 없이 도는 둘러보기. 대표작 「유리결」 한 편이 의뢰서에서 납품까지 어떻게 흘렀는지 보여 준다. 유리결은 가상 브랜드로 만든 자체 작품이다.
const S='./assets/request/';
const still=name=>`${S}${name}.webp`;
export const DEMO_FILES=[{src:still('file-gift-set'),label:'세트 정면',size:'3024 × 4032'},{src:still('file-gift-ampoule'),label:'앰플',size:'3024 × 4032'},{src:still('file-gift-jar'),label:'크림',size:'3024 × 4032'}];
export const DEMO_BRIEF=[['광고할 것','유리결 홀리데이 세트 · 화장품 · 뷰티'],['올릴 곳','릴스 · 쇼츠 · 틱톡'],['길이 · 구성','15초 · 한 편 · 39만원부터'],['보는 사람','연말 선물로 화장품 세트를 고르는 사람'],['남길 것','서리꽃이 피는 순간'],['화면 글자','유리결\n서리꽃 앰플 · 크림 홀리데이 세트'],['피할 말','재생, 치료, 주름 제거'],['무엇으로','한 장면의 임팩트로'],['모델','사람 없이 제품만'],['받고 싶은 날','11월 21일 (토)'],['최종 확인','의뢰하신 분']];
const ROOM={title:'유리결 홀리데이 세트 15초 광고',number:'P-1104-7F3A',manager:'김하늘',brief:DEMO_BRIEF.slice(0,6),files:DEMO_FILES,others:[],answered:[],canEdit:true,asks:[{id:'demo-logo',label:'로고 파일',why:'끝 화면에 그대로 얹어요. AI · SVG가 가장 좋고, 배경이 없는 PNG도 괜찮아요.'},{id:'demo-top',label:'크림 뚜껑을 위에서 찍은 사진',why:'결정이 내려앉는 컷의 기준이에요. 원본이 있으면 보내 주세요.'}],proposal:{...modelCard('F01'),note:'세트를 손에 든 컷을 더한다면 이 모델이 어울려요.'}};
const CUTS=[
  {seconds:1.5,what:'깜깜한 유리 위에서 눈 결정 하나가 자라요. 얼음에 금이 가는 작은 소리로 시작해요.',say:'',text:'',shot:'sheet-gift-01'},
  {seconds:1.5,what:'결정이 화면을 채울 만큼 자라요. 뒤에는 빛망울만 남아요.',say:'',text:'',shot:'sheet-gift-03'},
  {seconds:1.5,what:'카메라가 물러나면 결정은 유리구슬 겉에 붙어 있어요.',say:'',text:'',shot:'sheet-gift-04'},
  {seconds:1.5,what:'서리가 번지고 구슬 안에 앰플과 크림이 보여요.',say:'',text:'',shot:'sheet-gift-05'},
  {seconds:2.5,what:'구슬이 깨지는 순간 소리가 사라지고 조각과 두 제품이 허공에 멈춰요.',say:'',text:'',shot:'sheet-gift-06'},
  {seconds:2.5,what:'카메라만 멈춘 조각 사이를 지나가요.',say:'',text:'',shot:'sheet-gift-07'},
  {seconds:2,what:'시간이 다시 흐르고 떨어진 결정이 크림 뚜껑에 앉아 피어나요.',say:'',text:'',shot:'sheet-gift-11'},
  {seconds:2,what:'두 제품이 나란히 서고 이름이 떠요.',say:'',text:'유리결 / 서리꽃 앰플 · 크림 홀리데이 세트',shot:'sheet-gift-12'},
].map(({shot,...cut})=>({...cut,src:still(shot)}));
const ONE_LINE='서리꽃이 피는 순간을 담은 홀리데이 세트';
const DRAFT={round:2,oneLine:ONE_LINE,cuts:CUTS,model:null,ratio:'9:16'};
const SCRIPT={round:1,oneLine:ONE_LINE,cuts:CUTS.map(({src,...cut})=>cut),model:null,ratio:'9:16'};
const demoBackend=()=>({answers:emptyAnswers(),step:'',save:async()=>{},later:()=>{},
  upload:(slot,file,onProgress)=>new Promise(resolve=>{let p=0;const timer=setInterval(()=>{p+=.2;onProgress(Math.min(1,p));if(p>=1){clearInterval(timer);resolve({id:String(Date.now())});}},140);}),
  submit:async()=>({number:'P-1104-7F3A',at:new Date().toISOString(),link:location.href})});
const SCENES=[['request','의뢰서 쓰기'],['room','저희 차례일 때'],['ask','더 여쭐 때'],['model','모델 확인'],['script','글 콘티'],['draft','장면 이미지'],['review','영상 확인'],['history','납품']];
const NOT_REAL='예시라 보내지 않아요. 실제 의뢰에서는 담당자에게 바로 전해져요.';
// 영상 확인 · 납품은 실제 화면을 그대로 그린다. 자료만 가짜이고 서버로 가지 않는다.
const BASE='/pulse-app/demo-assets/';
const AT='2026-11-04T05:00:00.000Z';
function exampleState(){
  const v1={id:'demo-v1',kind:'preview',label:'1차 시안',guide:'제품이 떠 있는 시간과 끝 장면을 중심으로 봐 주세요.',createdAt:AT,media:{url:BASE+'preview-v1.mp4',mimeType:'video/mp4',fileName:'유리결_1차.mp4'}};
  const v2={id:'demo-v2',kind:'preview',label:'2차 시안',guide:'제품이 떠 있는 시간을 줄이고, 결정이 뚜껑에 피어나는 순간을 접사로 크게 보여 드려요.',createdAt:AT,media:{url:BASE+'preview-v2.mp4',mimeType:'video/mp4',fileName:'유리결_2차.mp4'}};
  const asked={id:'demo-m1',author:'customer',authorName:'예시 고객',action:'feedback',versionId:'demo-v1',seconds:8,text:'떠 있는 시간이 길어요. 뚜껑 위 결정을 더 크게 보여 주세요.',resolved:true,at:AT};
  const scenes=[['결정이 자라요',3],['서리가 구슬을 덮어요',3],['깨지고, 멈춰요',5],['이름을 남겨요',4]].map(([title,duration],i)=>({id:`demo-s${i}`,title,duration,visibility:'customer'}));
  return {mode:'customer',demo:false,example:true,tab:'review',versionId:'',compare:false,reviewPanel:'note',error:'',rememberOffer:false,project:{id:'demo-film',title:ROOM.title,ownerName:'김하늘',stage:'review',revision:1,requestFlow:true,versions:[v1,v2],messages:[asked],
    closeout:{deliveryKey:'demo',canConfirm:true,files:[{id:'demo-final',label:'15초 광고 최종본'}]},
    studio:{scenes,assets:[],comments:[],sceneReviews:[],request:{status:'confirmed',number:ROOM.number,answers:{name:'유리결 홀리데이 세트',kind:'beauty',channels:['shorts'],package:'s15'},files:[],asks:[],rounds:[{round:1,kind:'images',oneLine:ONE_LINE,scenes:[],approvedAt:AT}],approvedAt:AT},
      feedbackRounds:{latestVersionId:'demo-v2',latestVersionLabel:'2차 시안',canDraft:true,maxItems:30,nextNumber:2,drafts:[],rounds:[{id:'demo-r1',number:1,versionId:'demo-v1',versionLabel:'1차 시안',representativeName:'예시 고객',submittedAt:AT,items:[{id:'demo-i1',messageId:'demo-m1',seconds:8,text:asked.text,resolved:true,classification:{label:'합의한 범위 안의 수정',scopeNote:'제품이 떠 있는 시간과 끝 컷',scheduleNote:'2차 시안에 반영'}}]}]}}}};
}
const asFinal=state=>{const v2=state.project.versions[1];state.project.stage='delivered';state.project.versions=[...state.project.versions.map(v=>({...v,approvedAt:AT})),{id:'demo-final',kind:'final',label:'15초 광고 최종본',guide:'릴스 · 쇼츠 · 틱톡에 그대로 올릴 수 있는 9:16 파일이에요.',createdAt:AT,media:{...v2.media,fileName:'유리결_15초.mp4'}}];return state;};

// 둘러보기. 시안은 extra로 첫 화면 · 내부 확인 같은 장면을 앞에 더한다. 손님 예시에는 내부 화면을 싣지 않는다.
export function mountFilmDemo(host,{internal=false,start='',onLeave,extra=[]}={}){
  const scenes=[...extra.map(item=>[item.id,item.label]),...SCENES],nav=document.createElement('nav');nav.className='sx-demo-nav';nav.setAttribute('aria-label','예시 둘러보기');
  nav.innerHTML=`<span class="sx-small">${internal?'시안':'예시'} · 가상 브랜드로 만든 자체 작품</span>${scenes.map(([id,label])=>`<button type="button" class="sx-small" data-scene="${esc(id)}">${esc(label)}</button>`).join('')}${onLeave?'<button type="button" class="sx-small sx-link" data-proto-leave>나가기</button>':''}`;
  document.body.append(nav);
  // 예시라 실제로 보내지 않는 단추는 그 자리에서 그렇게 말한다.
  let noteTimer=0;
  const say=text=>{let box=document.querySelector('.sx-demo-note');if(!box){box=document.createElement('p');box.className='sx-demo-note sx-small';box.setAttribute('role','status');document.body.append(box);}box.textContent=text;box.hidden=false;play(box,[{opacity:0},{opacity:1}],{duration:220});clearTimeout(noteTimer);noteTimer=setTimeout(()=>{box.hidden=true;},3600);};
  let handle=null,state=exampleState(),nextPanel='';
  function clear(){handle?.unmount?.();handle=null;const next=host.cloneNode(false);host.replaceWith(next);host=next;document.documentElement.classList.remove('view-dr');return next;}
  // 실제 화면을 그리고, 앱이 하던 일(시안 고르기 · 의견 넣기 · 나란히 보기)을 여기서 가짜로 한다.
  function drawProject(root,tab){
    state.tab=tab;
    const old=root.querySelector('#review-video'),kept=old?{node:old,t:old.dataset.holding?0:old.currentTime,playing:!old.paused}:null;
    handle?.unmount?.();
    root.innerHTML=projectView(state);
    if(tab==='review'){
      document.documentElement.classList.add('view-dr');
      const fresh=root.querySelector('#review-video');
      if(kept&&fresh&&kept.node.dataset.version===fresh.dataset.version){fresh.replaceWith(kept.node);if(kept.playing)kept.node.play().catch(()=>{});}
      else if(kept&&fresh&&kept.t){fresh.addEventListener('loadedmetadata',()=>{fresh.currentTime=Math.min(kept.t,fresh.duration||kept.t);if(kept.playing)fresh.play().catch(()=>{});},{once:true});}
      const current=state.versionId||state.project.versions.filter(v=>v.kind==='preview').at(-1)?.id,prior=current==='demo-v2'?{id:'demo-v1',src:BASE+'preview-v1.mp4'}:null;
      handle=mountReview(root,{previous:prior});
    }else{document.documentElement.classList.remove('view-dr');handle=mountFinal(root);}
    mountRoom(root,{animate:false,onGo:to=>{if(to==='request')go('request');else if(to==='check')go('room');else if(to==='draft')go('draft');else if(to==='review')go('review');else if(to==='history')go('history');},onContact:()=>{nextPanel='ask';go('review');}});
  }
  function bindProject(root){
    root.addEventListener('click',event=>{
      const button=event.target.closest('[data-action]');if(!button)return;
      event.stopPropagation();
      const action=button.dataset.action,id=button.dataset.id,draft=state.project.studio.feedbackRounds.drafts[0];
      if(action==='version-pick'){state.versionId=id;state.compare=false;drawProject(root,'review');}
      if(action==='compare'){state.compare=!state.compare;drawProject(root,'review');}
      if(action==='review-panel'){state.reviewPanel=button.dataset.panel;drawProject(root,'review');if(state.reviewPanel==='ask')root.querySelector('.review-form textarea')?.focus({preventScroll:true});}
      if(action==='latest-version'){state.versionId='';drawProject(root,'review');}
      if(action==='seek'){
        // 그 의견이 달린 판으로 옮긴 뒤 그 순간에 선다(지난 판 의견을 지금 판 위에 잘못 보이지 않게).
        const at=Number(button.dataset.seconds)||0,want=button.dataset.version,now=state.versionId||state.project.versions.filter(v=>v.kind==='preview').at(-1)?.id;
        if(want&&want!==now){state.versionId=want;state.compare=false;drawProject(root,'review');const video=root.querySelector('#review-video');video?.addEventListener('loadedmetadata',()=>{video.currentTime=at;},{once:true});}
        else{const video=root.querySelector('#review-video');if(video){video.currentTime=at;video.pause();}}
      }
      if(action==='round-remove-item'&&draft){draft.items=draft.items.filter(item=>item.id!==button.dataset.id);if(!draft.items.length)state.project.studio.feedbackRounds.drafts=[];drawProject(root,'review');}
      if(action==='open-round-submit'){const box=root.querySelector('.round-submit');if(box){box.open=true;box.querySelector('[name=representativeName]')?.focus({preventScroll:true});}}
      if(action==='approve'){say('예시라 승인으로 이어지지 않아요. 실제 프로젝트에서는 이 시안으로 최종본을 만들어요.');}
      if(action==='confirm-delivery'||action==='tab')say(NOT_REAL);
      if(action==='refresh')say('예시 자료예요.');
    });
    root.addEventListener('submit',event=>{
      const form=event.target;if(!form.dataset?.form)return;
      event.preventDefault();event.stopPropagation();
      const rounds=state.project.studio.feedbackRounds;
      if(form.dataset.form==='round-draft'){
        const text=form.elements.text.value.trim();if(!text)return;
        const seconds=form.elements.seconds.value===''?null:Number(form.elements.seconds.value);
        if(!rounds.drafts.length)rounds.drafts=[{id:'demo-d1',current:true,versionId:rounds.latestVersionId,versionLabel:rounds.latestVersionLabel,items:[]}];
        const items=rounds.drafts[0].items;
        if(form.dataset.itemId){const item=items.find(row=>row.id===form.dataset.itemId);if(item)item.text=text;}else items.push({id:`demo-n${Date.now()}`,seconds,text});
        items.sort((a,b)=>(a.seconds??1e9)-(b.seconds??1e9));
        drawProject(root,'review');return;
      }
      if(form.dataset.form==='round-submit'){rounds.drafts=[];say(NOT_REAL);drawProject(root,'review');return;}
      say(NOT_REAL);form.reset?.();
    });
  }
  function go(id){
    const root=clear();window.scrollTo(0,0);if(root.parentElement)root.parentElement.scrollTop=0;
    nav.querySelectorAll('[data-scene]').forEach(button=>{const on=button.dataset.scene===id;button.classList.toggle('is-on',on);if(on){button.setAttribute('aria-current','true');if(nav.scrollWidth>nav.clientWidth)nav.scrollLeft=button.offsetLeft-(nav.clientWidth-button.offsetWidth)/2;}else button.removeAttribute('aria-current');});
    const custom=extra.find(item=>item.id===id);if(custom){custom.render(root,go);return;}
    if(id==='request'){handle=mountRequestFlow(root,{backend:demoBackend(),onRoom:()=>go('room'),onExit:()=>go('room')});return;}
    if(['room','ask','model'].includes(id)){
      const stateName={room:'check',ask:'ask',model:'model'}[id],stage=id==='model'?'draft':'check';
      root.innerHTML=roomView({...ROOM,state:stateName,stage});
      root.querySelector('.sx-room').classList.add('is-example');
      root.addEventListener('submit',event=>event.stopPropagation());
      mountRoom(root,{onGo:to=>{if(to==='request')go('request');else if(to==='check')go('room');else if(to==='draft')go('script');},onModel:()=>go('script'),onEdit:()=>go('request'),onForm:()=>go('room'),onContact:()=>say(NOT_REAL),onFiles:()=>say('예시라 올리지 않아요. 실제 의뢰에서는 여기서 자료를 더 보내실 수 있어요.')});return;
    }
    if(id==='script'){root.innerHTML=draftView(SCRIPT);document.documentElement.classList.add('view-dr');handle=mountDraft(root,SCRIPT,{onBack:()=>go('room'),onApprove:()=>go('draft'),onSend:()=>go('room'),onRecast:()=>go('model')});return;}
    if(id==='draft'){root.innerHTML=draftView(DRAFT);document.documentElement.classList.add('view-dr');handle=mountDraft(root,DRAFT,{onBack:()=>go('room'),onApprove:()=>go('review'),onSend:()=>go('room')});return;}
    if(id==='review'){state=exampleState();if(nextPanel){state.reviewPanel=nextPanel;nextPanel='';}bindProject(root);drawProject(root,'review');return;}
    if(id==='history'){state=asFinal(exampleState());bindProject(root);drawProject(root,'history');}
  }
  nav.addEventListener('click',event=>{if(event.target.dataset?.protoLeave!==undefined){onLeave?.();return;}const id=event.target.dataset?.scene;if(id)go(id);});
  addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(scenes.some(scene=>scene[0]===id))go(id);});
  go(scenes.some(scene=>scene[0]===(start||location.hash.slice(1)))?(start||location.hash.slice(1)):scenes[0][0]);
}
