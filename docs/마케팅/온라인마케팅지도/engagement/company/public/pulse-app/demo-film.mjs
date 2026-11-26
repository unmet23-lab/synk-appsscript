import {mountRequestFlow} from './request-flow.mjs';
import {emptyAnswers} from './request-data.mjs';
import {roomView,mountRoom,draftView,mountDraft,directionView,mountDirection,exampleHead,journalView,journalOverlay,journalSetOpen,journalFocus,journalRelease,JOURNAL_SHEET,briefView,briefSetOpen,briefRelease,briefFocus} from './film-views.mjs';
import {journalModel,directionModel} from './room-view.mjs';
import {projectView} from './views.mjs';
import {mountReview} from './film-review.mjs';
import {esc} from './api.mjs';
import {play} from './motion.mjs';

// 예시 프로젝트(2026-11-05 시사실 판): 서버 없이 도는 둘러보기. 「첨벙댕」 반려견 구명조끼 광고 한 편이 의뢰서에서 납품까지 어떻게 흘렀는지 보여 준다(2026-11-26 작품을 바꿈). 첨벙댕은 가상 브랜드로 만든 자체 작품이다.
const S='./assets/request/';
const still=name=>`${S}${name}.webp`;
export const DEMO_FILES=[{src:still('file-vest-worn'),label:'입은 모습',size:'1792 × 2400'},{src:still('file-vest-top'),label:'조끼 등쪽',size:'1792 × 2400'},{src:still('file-vest-dog'),label:'주인공이 될 개',size:'1792 × 2400'}];
export const DEMO_BRIEF=[['광고할 것','첨벙댕 반려견 구명조끼 · 생활용품 · 가전'],['올릴 곳','릴스 · 쇼츠 · 틱톡'],['길이 · 구성','30초 · 30초 + 15초 · 6초 편집본 · 59만원부터 · 14일 · 수정 3회'],['보는 사람','개와 물놀이를 가려는 보호자'],['남길 것','등에 손잡이가 두 개라 물에서도 번쩍 건져요'],['화면 글자','첨벙댕\n반려견 구명조끼'],['피할 말','절대 안전, 사고 예방, 인증 완료'],['무엇으로','웃음으로 퍼지게'],['모델','추천해 주세요'],['받고 싶은 날','11월 21일 (토)'],['최종 확인','의뢰하신 분']];
const ROOM={title:'첨벙댕 반려견 구명조끼 30초 광고',number:'P-1104-7F3A',manager:'김하늘',brief:DEMO_BRIEF.slice(0,6),files:DEMO_FILES,others:[],answered:[],canEdit:true,asks:[{id:'demo-logo',label:'로고 파일',why:'끝 화면에 그대로 얹어요. AI · SVG가 가장 좋고, 배경이 없는 PNG도 괜찮아요.'},{id:'demo-grip',label:'손잡이를 쥔 사진',why:'번쩍 드는 컷의 기준이에요. 손으로 잡은 모습을 찍어 보내 주세요.'}]};
const CUTS=[
  {seconds:2.2,what:'해변에서 털 없는 개가 정색하고 쳐다봐요. 두 귀가 레이더처럼 따로 돌아요.',say:'외계인 닮은 우리 개는 바닷가에서',text:'외계인',shot:'sheet-vest-01'},
  {seconds:1.6,what:'달에서 뛰듯 너무 오래 떠 있어요. 글자도 느리게 떠요.',say:'뛰어노는 걸 제일 좋아해요',text:'뛰어노는 걸',shot:'sheet-vest-02'},
  {seconds:3,what:'개가 막대기처럼 솟아 공중에 서요. 두 사람이 놀라 달아나요.',say:'근데 사람들이 보면 깜짝 놀라요',text:'당황 98%',shot:'sheet-vest-03'},
  {seconds:.9,what:'개의 눈이 초록으로 켜지고 상자 속 조끼가 떠올라요.',say:'그래서 올해는',text:'',shot:'sheet-vest-04'},
  {seconds:1.3,what:'조끼가 날아와 철썩 붙고 끈이 촉수처럼 꿀렁여요.',say:'특별한 걸 준비했어요',text:'',shot:'sheet-vest-05'},
  {seconds:2.7,what:'아무 일 없다는 듯 조끼를 입고 앉아 있어요. 이름 딱지가 쿵 붙어요.',say:'첨벙댕 구명조끼! 값도 착하고',text:'첨벙댕 구명조끼!',shot:'sheet-vest-06'},
  {seconds:2.1,what:'두 손이 등 손잡이를 쥐고, 고개가 빙글빙글 돌다 뚝 멈춰요.',say:'튼튼해요. 등에 손잡이가 두 개라',text:'튼튼',shot:'sheet-vest-07'},
  {seconds:1.7,what:'오락실 뽑기 집게가 내려와 손잡이를 물고 번쩍 들어요.',say:'물에서도 번쩍 건져요',text:'번쩍!',shot:'sheet-vest-08'},
  {seconds:1.9,what:'향수 광고처럼 검은 띠 사이에 고글 쓴 개가 앉아 있어요.',say:'올해는 진짜 멋있을 거예요',text:'멋있게\n※ 고글 별매',shot:'sheet-vest-09'},
  {seconds:2.8,what:'천장에서 초록 빛이 내려와 개가 떠오르고 방에 물이 차요.',say:'아무도 외계인인 줄 모를걸요? 물놀이 가는 날엔',text:'외계인?',shot:'sheet-vest-10'},
  {seconds:3.7,what:'빛이 뚝 끊겨 첨벙 떨어져요. 조끼 덕에 도로 떠올라 정색해요.',say:'첨벙댕',text:'첨벙댕\n반려견 구명조끼\n※ 우주에서도 뜹니다',shot:'sheet-vest-11'},
].map(({shot,...cut})=>({...cut,src:still(shot)}));
const ONE_LINE='외계인 닮은 우리 개도 물에 뜨는 구명조끼';
const DRAFT={round:2,oneLine:ONE_LINE,cuts:CUTS,model:null,ratio:'9:16'};
const SCRIPT={round:1,oneLine:ONE_LINE,cuts:CUTS.map(({src,...cut})=>cut),model:null,ratio:'9:16'};
// 판 4 B5: 영상 전 확인 1/3은 「방향과 모델」이다(11-07부터 실제 앱). 첨벙댕은 개가 주인공이라 모델 칸 없이 두 갈래 — 그림은 실제로 만들어 본 두 판의 장면이다.
const DIRECTION_SHOTS={'demo-alien':still('w-vest-alien'),'demo-water':still('w-vest-water')};
const DIRECTION={round:1,lead:'「물에서도 번쩍 건져요」를 두 갈래로 나눴어요. 둘 다 개가 주인공이라 모델은 따로 고르지 않았어요.',modelId:'',price:590000,dueDate:'2026-11-21',revisions:3,options:[
  {id:'demo-alien',name:'외계인 개',sentence:'목소리는 끝까지 진지한데 개는 말이 안 되는 일만 해요.',flow:[{at:'0:00',text:'해변에서 개가 너무 오래 떠 있어 사람들이 달아나요'},{at:'0:13',text:'뽑기 집게가 손잡이를 물고 번쩍 들어요'},{at:'0:20',text:'방에 물이 차고, 조끼 덕에 개가 떠올라요'}],why:'「웃음으로 퍼지게」를 고르셨어요. 손잡이와 뜨는 힘을 우스운 장면으로 한 번씩 보여 드려요.',recommended:true},
  {id:'demo-water',name:'물이 차는 방',sentence:'조끼를 입고 앉은 개의 방에 물이 차오르고, 개가 그대로 떠올라요.',flow:[{at:'0:00',text:'보호자가 상자에서 조끼를 꺼내 입혀요'},{at:'0:13',text:'손잡이 둘을 잡아 가방처럼 들어요'},{at:'0:20',text:'방에 물이 차고 화면이 물 위와 물속으로 갈려요'}],why:'제품이 하는 일을 한 장면으로 차분하게 보여 드려요. 웃음은 덜해요.',recommended:false}]};
// 결제 차례(판 4 B5): 글 콘티를 승인한 뒤 크몽에서 결제하는 카드 — 실제 방과 같은 payCard. 오른쪽에는 승인한 글 콘티가 선다.
const PAY={status:'',requestedDay:'',price:'59만원',days:14,revisions:3,number:ROOM.number,photo:false};
const demoBackend=()=>({answers:emptyAnswers(),step:'',save:async()=>{},later:()=>{},
  upload:(slot,file,onProgress)=>new Promise(resolve=>{let p=0;const timer=setInterval(()=>{p+=.2;onProgress(Math.min(1,p));if(p>=1){clearInterval(timer);resolve({id:String(Date.now())});}},140);}),
  submit:async()=>({number:'P-1104-7F3A',at:new Date().toISOString(),link:location.href})});
const SCENES=[['request','의뢰서 쓰기'],['room','저희 차례일 때'],['ask','더 여쭐 때'],['direction','방향 고르기'],['script','글 콘티'],['pay','결제'],['draft','장면 이미지'],['review','영상 확인'],['history','납품']];
const NOT_REAL='예시라 보내지 않아요. 실제 의뢰에서는 담당자에게 바로 전해져요.';
// 예시 일지(판 3b): 장면마다 그 시점까지 담당자와 나눈 말 · 한 일. 실제 앱과 같은 journalModel로 만든다.
const KST=(day,hm)=>`2026-11-0${day}T${hm}:00+09:00`;
const EXAMPLE_ORDER=['room','ask','direction','script','pay','draft','review','history'];
function exampleRequest(scene){
  const upto=EXAMPLE_ORDER.indexOf(scene),has=id=>upto>=EXAMPLE_ORDER.indexOf(id);
  // castingLooks: 실제 서버와 같은 표식(옷 · 머리 고르기). 이 작품은 개가 주인공이라 방향 화면에 옷 · 머리 줄은 서지 않는다.
  const request={status:'submitted',number:ROOM.number,submittedAt:KST(1,'10:12'),answers:{name:'첨벙댕 반려견 구명조끼',kind:'living',channels:['shorts'],package:'s30'},files:[],asks:[],rounds:[],castingLooks:true};
  if(scene==='ask')request.asks=ROOM.asks.map(ask=>({...ask,status:'open',at:KST(1,'15:20')}));
  if(has('direction')){
    request.asks=ROOM.asks.map((ask,i)=>({...ask,status:'answered',at:KST(1,'15:20'),answer:i?'쥔 사진 두 장 함께 보내요.':'배경 없는 PNG로 보냈어요.',answeredAt:KST(1,'16:05')}));
    Object.assign(request,{status:'confirmed',confirmedAt:KST(1,'17:40'),confirmedBy:'김하늘'});
    request.directionProposal={...DIRECTION,status:scene==='direction'?'open':'chosen',at:KST(2,'10:10'),by:'김하늘',...(scene==='direction'?{}:{chosenId:'demo-alien',answeredAt:KST(2,'11:02')})};
  }
  if(has('script'))request.rounds.push({round:1,kind:'script',oneLine:ONE_LINE,note:'내레이션은 끝까지 진지하게 읽어요. 우스운 건 그림이 맡아요.',sentAt:KST(2,'16:30'),by:'김하늘',scenes:[],...(has('pay')?{approvedAt:KST(2,'18:05')}:{})});
  if(has('pay'))request.scriptApprovedAt=KST(2,'18:05');
  if(has('draft'))request.payment={status:'confirmed',amount:590000,requestedAt:KST(2,'18:40'),confirmedAt:KST(2,'19:20'),dueDate:'2026-11-21'};
  if(has('draft'))request.rounds.push({round:2,kind:'images',oneLine:ONE_LINE,note:'',sentAt:KST(3,'11:20'),by:'김하늘',scenes:[],...(has('review')?{approvedAt:KST(3,'14:10')}:{})});
  if(has('review'))request.approvedAt=KST(3,'14:10');
  return request;
}
const exampleJournal=(scene,opts)=>journalView(journalModel({id:'demo-film',title:ROOM.title,ownerName:'김하늘',requestFlow:true,versions:[],messages:[],studio:{request:exampleRequest(scene)}}),{owner:'김하늘',...opts});
// 예시 일지 열고 닫기: 앱과 같은 규칙(film-views의 journalOverlay · journalSetOpen · journalFocus). 보내기는 예시라 하지 않는다.
let exampleOpener=null;
function bindExampleJournal(root,say,redraw){
  const box=()=>root.querySelector('[data-journal]');
  const close=()=>{journalSetOpen(root,false);const back=exampleOpener;exampleOpener=null;back?.isConnected&&back.focus({preventScroll:true});};
  root.addEventListener('click',event=>{
    const el=box();if(!el)return;
    const opener=event.target.closest('[data-room-do="journal"]');
    if(opener){if(journalOverlay(el)){if(el.classList.contains('is-open')){close();return;}if(root.querySelector('[data-brief].is-open'))briefSetOpen(root,false);exampleOpener=opener;journalSetOpen(root,true);}else el.scrollIntoView?.({block:'start'});journalFocus(el);return;}
    const act=event.target.closest('[data-journal-do]')?.dataset.journalDo;
    if(act==='close'){close();return;}
    // 다시 그리면 새 일지는 닫힌 채라, 연 시트 · 서랍이었으면 그대로 다시 연다(가림막만 남거나 문서가 잠긴 채 남지 않게).
    // more(이전 말 더 보기) · talk(「말만 보기」 — 운영 조각 4 화면 검수 F1)를 부른 쪽이 상태로 들고 다시 그린다.
    if(act==='more'||act==='talk'){const wasOpen=el.classList.contains('is-open');redraw?.(act);if(wasOpen)journalSetOpen(root,true);box()?.querySelector(`[data-journal-do="${act}"]`)?.focus({preventScroll:true});return;}
    if(event.target.closest('[data-journal-go]')){close();say('예시예요. 실제 프로젝트에서는 그 화면으로 옮겨 가요.');}
  });
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&box()?.classList.contains('is-open')&&!document.querySelector('.sx-round-sheet[open],dialog[open]'))close();});
  root.addEventListener('submit',event=>{if(!event.target.closest?.('[data-journal]')||event.target.dataset?.form==='ask')return;event.preventDefault();event.stopPropagation();say(NOT_REAL);event.target.reset?.();},true);
}
// 예시의 의뢰서 서랍(2판 ①): 앱 머리 듣개(app.mjs)는 예시에 닿지 않으므로 같은 열고 닫기를 여기서 단다(서랍은 화면 안 — 머리 「의뢰서」 · 단계 막대 첫 칸 · 지난 결정 줄의 의뢰서 칩).
// 닫으면 연 단추로 초점이 돌아가고, 나눈 말과 함께 열리지 않는다. 안의 고치기 · 자료 더 보내기는 예시라 보내지 않는다고 말한다.
const exampleBrief=()=>briefView(ROOM);
let briefBack=null;
function openExampleBrief(root,opener=null){
  const journal=root.querySelector('[data-journal].is-open');if(journal){journalSetOpen(root,false);exampleOpener=null;}
  const box=briefSetOpen(root,true);if(!box)return;briefBack=opener||document.activeElement;briefFocus(box);
}
function closeExampleBrief(root){if(!root.querySelector('[data-brief].is-open'))return;briefSetOpen(root,false);const back=briefBack;briefBack=null;if(back?.isConnected)back.focus({preventScroll:true});}
function bindExampleBrief(root,say){
  root.addEventListener('click',event=>{
    const opener=event.target.closest('[data-room-do="brief"]');if(opener){event.stopPropagation();if(root.querySelector('[data-brief].is-open'))closeExampleBrief(root);else openExampleBrief(root,opener);return;}
    if(event.target.closest('[data-brief-do="close"]')){closeExampleBrief(root);return;}
    const inside=event.target.closest('[data-brief] [data-room-do]');if(!inside)return;
    if(inside.dataset.roomDo==='edit')say('예시라 고치지 않아요. 실제 의뢰에서는 여기서 의뢰서를 고치실 수 있어요.');
    if(inside.dataset.roomDo==='copy-number')navigator.clipboard?.writeText(inside.dataset.number||'').then(()=>{inside.textContent='복사했어요';},()=>{});
  });
  root.addEventListener('change',event=>{if(event.target.closest?.('[data-brief]')&&event.target.matches('[data-room-file]')){event.target.value='';say('예시라 올리지 않아요. 실제 의뢰에서는 여기서 자료를 더 보내실 수 있어요.');}});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.querySelector('[data-brief].is-open')&&!document.querySelector('.sx-round-sheet[open],dialog[open]'))closeExampleBrief(root);});
}
// 영상 확인 · 납품은 실제 화면을 그대로 그린다. 자료만 가짜이고 서버로 가지 않는다.
// 판마다 영상이 오기 전에 깔 한 장(poster)은 멈춰 서는 자리(끝 컷 쪽)와 같은 구도의 장면 이미지다 — 실제 손님은 승인한 장면 이미지에서 고른다(views.mjs filmStill).
const BASE='/pulse-app/demo-assets/';
const AT='2026-11-04T05:00:00.000Z';
// 영상 상자의 한 장은 views.mjs가 safeUrl로 원점 기준에 풀므로 영상처럼 절대 경로로 둔다.
const POSTER=name=>`/pulse-app/assets/request/${name}.webp`;
function exampleState(){
  const v1={id:'demo-v1',kind:'preview',label:'1차 시안',guide:'말과 그림이 맞는지, 끝 장면이 어떤지 중심으로 봐 주세요.',createdAt:KST(3,'19:00'),poster:POSTER('sheet-vest-11'),media:{url:BASE+'preview-v1.mp4',mimeType:'video/mp4',fileName:'첨벙댕_1차.mp4'}};
  const v2={id:'demo-v2',kind:'preview',label:'2차 시안',guide:'「우주에서도 뜹니다」를 목소리로도 말하고, 끝에 우주에 뜬 장면을 더했어요.',createdAt:AT,poster:POSTER('still-vest-float'),media:{url:BASE+'preview-v2.mp4',mimeType:'video/mp4',fileName:'첨벙댕_2차.mp4'}};
  const asked={id:'demo-m1',author:'customer',authorName:'예시 고객',action:'feedback',versionId:'demo-v1',seconds:22.5,text:'「우주에서도 뜹니다」가 글자로만 지나가서 아쉬워요. 우주에서 떠다니는 장면이 있으면 좋겠어요.',resolved:true,at:AT};
  const scenes=[['바닷가의 외계인',7],['조끼가 날아와요',5],['번쩍 들어요',4],['첨벙, 떠올라요',8],['우주에서도 떠요',2]].map(([title,duration],i)=>({id:`demo-s${i}`,title,duration,visibility:'customer'}));
  const talk=[{id:'demo-q1',author:'customer',authorName:'예시 고객',action:'support',text:'반려동물 박람회 전에 받을 수 있을까요?',at:KST(4,'10:02')},{id:'demo-q2',author:'staff',authorName:'김하늘',text:'네, 11월 21일에 맞춰 드려요. 2차 시안은 오늘 오후에 올려요.',at:KST(4,'10:30')}];
  return {mode:'customer',demo:false,example:true,tab:'review',versionId:'',compare:false,reviewPanel:'note',error:'',rememberOffer:false,journalAll:false,journalTalk:false,project:{id:'demo-film',title:ROOM.title,ownerName:'김하늘',stage:'review',revision:1,requestFlow:true,versions:[v1,v2],messages:[asked,...talk],
    closeout:{deliveryKey:'demo',canConfirm:true,files:[{id:'demo-final',label:'26초 광고 최종본'}]},
    studio:{scenes,assets:[],comments:[],sceneReviews:[],request:exampleRequest('review'),
      feedbackRounds:{latestVersionId:'demo-v2',latestVersionLabel:'2차 시안',canDraft:true,maxItems:30,nextNumber:2,drafts:[],rounds:[{id:'demo-r1',number:1,versionId:'demo-v1',versionLabel:'1차 시안',representativeName:'예시 고객',submittedAt:KST(4,'09:40'),items:[{id:'demo-i1',messageId:'demo-m1',seconds:22.5,text:asked.text,resolved:true,classification:{label:'합의한 범위 안의 수정',scopeNote:'끝에 한 컷 더하기(12컷 안)',scheduleNote:'2차 시안에 반영'}}]}]}}}};
}
const asFinal=state=>{const v2=state.project.versions[1];state.project.stage='delivered';state.project.versions=[...state.project.versions.map(v=>({...v,approvedAt:v.id==='demo-v2'?KST(4,'16:00'):undefined})),{id:'demo-final',kind:'final',label:'26초 광고 최종본',guide:'릴스 · 쇼츠 · 틱톡에 그대로 올릴 수 있는 9:16 파일이에요. 예시에는 본편만 실었고, 실제로는 15초 · 6초 편집본과 자막 없는 판도 함께 드려요.',createdAt:KST(4,'18:20'),poster:v2.poster,media:{...v2.media,fileName:'첨벙댕_26초.mp4'}}];return state;};

// 둘러보기. 시안은 extra로 첫 화면 · 내부 확인 같은 장면을 앞에 더한다. 손님 예시에는 내부 화면을 싣지 않는다.
export function mountFilmDemo(host,{internal=false,start='',onLeave,extra=[]}={}){
  const scenes=[...extra.map(item=>[item.id,item.label]),...SCENES],nav=document.createElement('nav');nav.className='sx-demo-nav';nav.setAttribute('aria-label','예시 둘러보기');
  nav.innerHTML=`<span class="sx-small">${internal?'시안':'예시'} · 가상 브랜드로 만든 자체 작품</span>${scenes.map(([id,label])=>`<button type="button" class="sx-small" data-scene="${esc(id)}">${esc(label)}</button>`).join('')}${onLeave?'<button type="button" class="sx-small sx-link" data-proto-leave>나가기</button>':''}`;
  document.body.append(nav);
  // 예시라 실제로 보내지 않는 단추는 그 자리에서 그렇게 말한다.
  let noteTimer=0;
  const say=text=>{let box=document.querySelector('.sx-demo-note');if(!box){box=document.createElement('p');box.className='sx-demo-note sx-small';box.setAttribute('role','status');document.body.append(box);}box.textContent=text;box.hidden=false;play(box,[{opacity:0},{opacity:1}],{duration:220});clearTimeout(noteTimer);noteTimer=setTimeout(()=>{box.hidden=true;},3600);};
  let handle=null,state=exampleState(),nextPanel='',scene='';
  function clear(){handle?.unmount?.();handle=null;const next=host.cloneNode(false);host.replaceWith(next);host=next;document.documentElement.classList.remove('view-dr','has-journal-open','has-brief-open');journalRelease();briefRelease();exampleOpener=null;briefBack=null;return next;}
  // 실제 화면을 그리고, 앱이 하던 일(시안 고르기 · 의견 넣기 · 나란히 보기)을 여기서 가짜로 한다.
  function drawProject(root,tab){
    state.tab=tab;
    const old=root.querySelector('#review-video'),kept=old?{node:old,t:old.dataset.holding?0:old.currentTime,playing:!old.paused}:null;
    handle?.unmount?.();
    const briefOpen=!!root.querySelector('[data-brief].is-open');
    root.innerHTML=projectView(state)+exampleBrief();if(briefOpen)briefSetOpen(root,true);
    // 영상 확인과 납품은 의뢰 흐름 손님과 같은 화면 하나다(판 3). 납품은 최종본이 고른 채로 열린다.
    {
      document.documentElement.classList.add('view-dr');
      const fresh=root.querySelector('#review-video');
      if(kept&&fresh&&kept.node.dataset.version===fresh.dataset.version){fresh.replaceWith(kept.node);if(kept.playing)kept.node.play().catch(()=>{});}
      else if(kept&&fresh&&kept.t){fresh.addEventListener('loadedmetadata',()=>{fresh.currentTime=Math.min(kept.t,fresh.duration||kept.t);if(kept.playing)fresh.play().catch(()=>{});},{once:true});}
      const versions=state.project.versions,current=state.versionId||versions.filter(v=>v.kind==='final').at(-1)?.id||versions.filter(v=>v.kind==='preview').at(-1)?.id,prior=current==='demo-v2'?{id:'demo-v1',src:BASE+'preview-v1.mp4'}:null;
      handle=mountReview(root,{previous:prior});
    }
    mountRoom(root,{animate:false,onGo:to=>{if(to==='request')openExampleBrief(root);else if(to==='check'||to==='room')go('room');else if(to==='draft')go('draft');else if(to==='review')go(state.project.stage==='delivered'?'history':'review');},onContact:()=>say(NOT_REAL),onPaper:()=>say('예시 자료예요.')});
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
    scene=id;const root=clear();window.scrollTo(0,0);if(root.parentElement)root.parentElement.scrollTop=0;
    nav.querySelectorAll('[data-scene]').forEach(button=>{const on=button.dataset.scene===id;button.classList.toggle('is-on',on);if(on){button.setAttribute('aria-current','true');if(nav.scrollWidth>nav.clientWidth)nav.scrollLeft=button.offsetLeft-(nav.clientWidth-button.offsetWidth)/2;}else button.removeAttribute('aria-current');});
    const custom=extra.find(item=>item.id===id);if(custom){custom.render(root,go);return;}
    if(id==='request'){handle=mountRequestFlow(root,{backend:demoBackend(),onRoom:()=>go('room'),onExit:()=>go('room')});return;}
    if(id==='direction'){
      const info=directionModel({title:ROOM.title,studio:{request:exampleRequest('direction')}});info.options=info.options.map(o=>({...o,src:DIRECTION_SHOTS[o.id]||''}));
      root.innerHTML=directionView({...ROOM,state:'direction',stage:'draft',direction:info});root.querySelector('.sx-room')?.classList.add('is-example');
      root.addEventListener('submit',event=>{const kind=event.target.dataset?.form;if(kind!=='direction-pick'&&kind!=='direction-neither')return;event.preventDefault();event.stopPropagation();if(kind==='direction-pick')go('script');else say(NOT_REAL);});
      handle=mountDirection(root,info,{ui:{}});
      mountRoom(root,{animate:false,onGo:to=>{if(to==='request')go('request');else if(to==='check'||to==='room')go('room');},onContact:()=>say(NOT_REAL),onPaper:()=>say('예시 자료예요.')});return;
    }
    if(['room','ask','pay'].includes(id)){
      const stateName={room:'check',ask:'ask',pay:'pay'}[id],stage=id==='pay'?'draft':'check',more=id==='pay'?{pay:PAY,draft:SCRIPT,hasRound:true}:{};
      let all=false,talk=false;const draw=()=>{root.innerHTML=roomView({...ROOM,...more,state:stateName,stage},{journal:exampleJournal(id,{place:'drawer',here:{tab:'overview'},all,talk,pin:stateName!=='ask'})})+exampleBrief();root.querySelector('.sx-room').classList.add('is-example');};draw();
      bindExampleJournal(root,say,act=>{if(act==='talk')talk=!talk;else all=!all;const old=root.querySelector('[data-journal]'),box=document.createElement('div');box.innerHTML=exampleJournal(id,{place:'drawer',here:{tab:'overview'},all,talk,pin:stateName!=='ask'});old?.replaceWith(...[...box.children].filter(node=>node.matches('[data-journal]')));});
      bindExampleBrief(root,say);
      root.addEventListener('submit',event=>event.stopPropagation());
      mountRoom(root,{onGo:to=>{if(to==='request')openExampleBrief(root);else if(to==='check'||to==='room')go('room');else if(to==='draft')go('script');},onEdit:()=>go('request'),onForm:()=>go('room'),onContact:()=>say(NOT_REAL),onFiles:()=>say('예시라 올리지 않아요. 실제 의뢰에서는 여기서 자료를 더 보내실 수 있어요.')});return;
    }
    // 글 콘티 · 장면 이미지도 다른 장면과 같은 머리(이름 · 단계 · 묻기)를 단다 — 손님 앱의 「← 현황」은 머리가 대신한다.
    const draftHead=exampleHead({...ROOM,stage:'draft',hasRound:true},{tab:'draft'});let headGo=to=>{if(to==='check'||to==='room')go('room');};
    const sideJournal=(scene,all=false,talk=false)=>exampleJournal(scene,{place:'side',here:{tab:'draft'},all,talk}),bindDraftJournal=(root,scene)=>{let all=false,talk=false;bindExampleJournal(root,say,act=>{if(act==='talk')talk=!talk;else all=!all;const old=root.querySelector('[data-journal]'),box=document.createElement('div');box.innerHTML=sideJournal(scene,all,talk);old?.replaceWith(...[...box.children].filter(node=>node.matches('[data-journal]')));});};
    if(id==='script'||id==='draft'){bindExampleBrief(root,say);const plain=headGo;headGo=to=>{if(to==='request')openExampleBrief(root);else plain(to);};}
    if(id==='script'){root.innerHTML=draftView(SCRIPT,{head:draftHead,journal:sideJournal('script')})+exampleBrief();bindDraftJournal(root,'script');mountRoom(root,{animate:false,onGo:headGo,onContact:()=>say(NOT_REAL)});document.documentElement.classList.add('view-dr');handle=mountDraft(root,SCRIPT,{onBack:()=>go('room'),onApprove:()=>go('pay'),onSend:()=>go('room'),onRecast:()=>go('direction')});return;}
    if(id==='draft'){root.innerHTML=draftView(DRAFT,{head:draftHead,journal:sideJournal('draft')})+exampleBrief();bindDraftJournal(root,'draft');mountRoom(root,{animate:false,onGo:headGo,onContact:()=>say(NOT_REAL)});document.documentElement.classList.add('view-dr');handle=mountDraft(root,DRAFT,{onBack:()=>go('room'),onApprove:()=>go('review'),onSend:()=>go('room')});return;}
    if(id==='review'){state=exampleState();if(nextPanel){state.reviewPanel=nextPanel;nextPanel='';}bindProject(root);bindExampleBrief(root,say);bindExampleJournal(root,say,act=>{if(act==='talk')state.journalTalk=!state.journalTalk;else state.journalAll=!state.journalAll;drawProject(root,'review');});drawProject(root,'review');return;}
    if(id==='history'){state=asFinal(exampleState());bindProject(root);bindExampleBrief(root,say);bindExampleJournal(root,say,act=>{if(act==='talk')state.journalTalk=!state.journalTalk;else state.journalAll=!state.journalAll;drawProject(root,'history');});drawProject(root,'history');}
  }
  nav.addEventListener('click',event=>{if(event.target.dataset?.protoLeave!==undefined){onLeave?.();return;}const id=event.target.dataset?.scene;if(id)go(id);});
  // 장면 꼬리(#room)는 첫 로드든 주소줄에 직접 친 것이든 읽은 뒤 그 장면을 열기 전에 지운다 — 옮겨 다녀도 주소가 낡은 장면을 가리키지 않고, 의뢰서의 뒤로 가기 덫 칸도 꼬리 없는 같은 주소로 쌓인다.
  const tailed=!internal&&!start&&/[?&]demo=film(?:&|$)/.test(location.search),untail=()=>{if(tailed&&location.hash)history.replaceState(history.state,'',location.pathname+location.search);};
  addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(!scenes.some(item=>item[0]===id))return;untail();go(id);});
  // 장면은 기록에 남기지 않으므로 예시 안의 뒤로 가기는 늘 예시 밖으로 간다. 의뢰서 장면이 쌓은 덫 칸 · 친 꼬리 칸처럼 같은 문서 안의 칸에 내려앉으면 한 번 더 물러나 그 칸을 함께 지나간다(첫 뒤로 가기가 헛돌지 않게).
  // 의뢰서 장면에서는 의뢰서가 뒤로 가기를 맡는다(앞 질문으로). 꼬리가 있는 칸은 방금 친 주소라 지나가지 않는다.
  if(!internal)addEventListener('popstate',()=>{if(scene!=='request'&&!location.hash)history.back();});
  // 창 폭이 바뀌어 시트 · 서랍이 흐름 안 자리가 되면 연 상태를 푼다(앱 app.mjs와 같은 규칙 — 가림막 · 잠금이 남지 않게).
  globalThis.matchMedia?.(JOURNAL_SHEET)?.addEventListener?.('change',()=>{const box=host.querySelector('[data-journal]');if(box?.classList.contains('is-open')&&!journalOverlay(box)){exampleOpener=null;journalSetOpen(host,false);}});
  const first=start||location.hash.slice(1);
  untail();
  go(scenes.some(item=>item[0]===first)?first:scenes[0][0]);
}
