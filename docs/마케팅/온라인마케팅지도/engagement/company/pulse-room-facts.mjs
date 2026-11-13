// 고객 방이 지금 보이는 차례 · 글 · 받으실 날 · 정한 수정 횟수를 서버에서 같은 규칙으로(운영 조각 5 — 자동 안내 사실 보강, 2026-11-12).
// 화면의 정본은 public/pulse-app/room-view.mjs(roomState · ROOM_COPY · roomBrief의 받으실 날) · film-views.mjs(왼쪽 글 copyBase) · request-data.mjs(PACKAGES)다.
// 서버는 그 파일을 가져오지 않는다 — 그 파일은 화면만 따로 바꿔 올리는 정적 묶음(deploy/static/policy.json)에 들어 서버 동작이 화면 교체로 바뀌면 안 된다
// (deploy-static-swap.test.mjs 「no server module imports … the static set would carry」). 대신 pulse-auto-reply-facts.test.mjs 「고객 방 일치」가 화면 함수와 글자까지 같은지 견준다 —
// 화면 글 · 차례 규칙을 바꾸면 이 파일도 함께 고친다(시험이 떨어진다). 재료는 손님 보기(customerSnapshot)뿐이다.

// 패키지(request-data.mjs PACKAGES의 서버 쪽 — 이름 · 기간 · 수정 횟수만). 기업은 기간 · 횟수가 협의라 없다.
export const ROOM_PACKAGES=Object.freeze({
  s15:{label:'15초',title:'한 편',days:10,revisions:2},
  s30:{label:'30초',title:'30초 + 15초 · 6초 편집본',days:14,revisions:3},
  s60:{label:'60초',title:'브랜드 필름, 또는 같은 모델 시리즈 3편',days:21,revisions:3},
  corp:{label:'기업',title:'기업 캠페인'},
  photo:{label:'사진',title:'모델이 제품을 든 사진 5장',days:3,revisions:2,photo:true},
});
// 단계 다섯(room-view.mjs ROOM_STAGES · STAGE_OF, 머리 단계 줄 이름은 film-views.mjs stageName — 사진 상품의 다섯째는 「사진 · 납품」).
export const ROOM_STAGE_NAMES=Object.freeze({request:'01 의뢰서',check:'02 확인',draft:'03 1차안',make:'04 제작',review:'05 영상 · 납품'});
const PHOTO_STAGE_NAMES=Object.freeze({...ROOM_STAGE_NAMES,review:'05 사진 · 납품'});
export const roomStageName=(id,photo=false)=>Object.hasOwn(ROOM_STAGE_NAMES,id)?(photo?PHOTO_STAGE_NAMES:ROOM_STAGE_NAMES)[id]:'';
const STAGE_OF={write:'request',check:'check',ask:'check',direction:'draft',redirect:'draft',model:'draft',prepare:'draft','prepare-images':'draft',script:'draft',images:'draft',revise:'draft',pay:'draft',make:'make',review:'review',deliver:'review',done:'review'};
// 상태마다 고객 방 왼쪽 글(room-view.mjs ROOM_COPY — 단추는 뺐다).
const COPY={
  write:{turn:'you',title:'의뢰서를 써 주세요',text:'제품 이름, 올릴 곳, 사진 몇 장이면 시작할 수 있어요. 모르는 칸은 저희가 제안해요.'},
  check:{turn:'us',title:'지금은 저희 차례예요',text:'보내 주신 의뢰서를 확인하고 있어요. 평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요. 확인이 끝나면 방향 두 안을 보내 드려요.'},
  ask:{turn:'you',title:'이것만 더 알려 주세요',text:'아래 칸만 채워 주시면 바로 1차안을 만들어요.'},
  direction:{turn:'you',title:'두 방향 중 하나를 골라 주세요',text:'요청하신 내용은 그대로 두고, 무엇으로 기억에 남길지만 나눠 봤어요. 고르시면 글 콘티를 보내 드려요.'},
  redirect:{turn:'us',title:'새 방향을 준비하고 있어요',text:'주신 말씀으로 같은 값에 한 번 더 제안해 드려요.'},
  model:{turn:'you',title:'이 모델로 갈까요?',text:'장면을 만들기 전에 모델부터 정해요. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요.'},
  prepare:{turn:'us',title:'1차안을 만들고 있어요',text:'광고가 남길 한 문장과 글 콘티를 먼저 보내 드려요.'},
  'prepare-images':{turn:'us',title:'장면 이미지를 만들고 있어요',text:'확인하신 글 콘티대로 컷마다 장면 이미지를 만들어요. 다 되면 알려 드려요.'},
  script:{turn:'you',title:'글 콘티가 도착했어요',text:'한 문장과 컷마다 들어갈 내용을 봐 주세요. 맞으면 장면 이미지를 만들어요.'},
  images:{turn:'you',title:'장면 이미지가 도착했어요',text:'컷마다 보고 의견을 남겨 주세요. 괜찮으면 그대로 제작을 시작해요.'},
  revise:{turn:'us',title:'의견을 반영하고 있어요',text:'보내 주신 의견대로 고쳐서 새 판을 보내 드려요.'},
  make:{turn:'us',title:'확인하신 컷으로 만들고 있어요',text:'목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 다음에 받으실 것은 소리까지 들어간 영상이에요.'},
  review:{turn:'you',title:'영상이 도착했어요',text:'영상을 보면서 고칠 시점에 의견을 남겨 주세요.'},
  deliver:{turn:'you',title:'완성본을 받으세요',text:'올릴 곳에 맞는 파일을 내려받으실 수 있어요.'},
  pay:{turn:'you',title:'글 콘티를 확인해 주셨어요',text:'이제 크몽에서 결제해 주세요. 결제가 확인되면 장면 이미지를 만들기 시작해요.'},
  done:{turn:'done',title:'완성본을 받으셨어요',text:'함께 만들어 주셔서 고마워요. 크몽에서 작업물을 확인하시고 구매확정을 눌러 주시면 이 의뢰가 끝나요.'},
};
const requestOf=p=>p?.studio?.request&&typeof p.studio.request==='object'?p.studio.request:null;
const versionsOf=(p,kind)=>(Array.isArray(p?.versions)?p.versions:[]).filter(v=>v?.kind===kind);
const lastRound=r=>(Array.isArray(r?.rounds)?r.rounds:[]).at(-1)||null;
// 결제 차례(room-view.mjs payState).
export function roomPayState(r){
  if(!r||r.payment?.status==='confirmed')return false;
  if(r.payment?.status==='requested'||r.payment?.status==='cancelled')return true;
  if(r.answers?.package==='photo')return (r.rounds||[]).some(round=>round.kind==='images'&&round.approvedAt);
  return !!r.scriptApprovedAt&&!(r.rounds||[]).some(round=>round.kind==='images');
}
// 고객 방의 지금 상태(room-view.mjs roomState).
export function roomStateOf(p){
  const r=requestOf(p),round=lastRound(r);
  if(p?.stage==='delivered'||versionsOf(p,'final').length)return p?.closeout?.receipt?'done':'deliver';
  if(versionsOf(p,'preview').length)return 'review';
  if(r?.approvedAt||p?.stage==='producing')return 'make';
  if(!r||r.status==='writing')return 'write';
  if(r.asks?.some(ask=>ask.status==='open'))return 'ask';
  if(roomPayState(r))return 'pay';
  if(!round&&r.directionProposal?.status==='open')return 'direction';
  if(!round&&r.directionProposal?.status==='declined')return 'redirect';
  if(r.modelProposal?.status==='open')return 'model';
  if(round&&!round.approvedAt&&!round.feedbackAt)return round.kind==='script'?'script':'images';
  if(round&&!round.approvedAt)return 'revise';
  if(round?.kind==='script'&&round.approvedAt)return 'prepare-images';
  if(r.status==='confirmed')return 'prepare';
  return 'check';
}
// 그 상태의 왼쪽 글(film-views.mjs copyBase — 방향을 고른 뒤 · 두 번째 제안도 거절한 뒤 · 사진 상품 · 결제 상태로 글이 갈린다). 메일 꼬리 · 맞춤 인물 카드는 넣지 않는다.
function copyOf(state,r,photo){
  const pay=r.payment?.status||'',d=r.directionProposal;
  const chosen=!!d&&Array.isArray(d.options)&&d.options.some(option=>option?.id===d.chosenId),last=!!d&&d.round>=2,options=Array.isArray(d?.options)?d.options.length:0;
  if(state==='pay'){
    if(pay==='cancelled')return {turn:'you',title:'결제가 취소됐어요',text:'다시 진행하시려면 담당자에게 알려 주세요. 보내 주신 자료와 글 콘티는 그대로 있어요.'};
    if(pay==='requested')return {turn:'you',title:'크몽에서 결제해 주세요',text:photo?'크몽 메시지로 결제 요청을 보내 드렸어요. 결제가 확인되면 나머지 장을 만들어요.':'크몽 메시지로 결제 요청을 보내 드렸어요. 결제가 확인되면 장면 이미지를 만들기 시작해요.'};
    if(photo)return {turn:'you',title:'첫 장을 확인해 주셨어요',text:'이제 크몽에서 결제해 주세요. 결제가 확인되면 나머지 장을 만들어요.'};
  }
  if(state==='prepare-images'&&pay==='confirmed')return {turn:'us',title:'결제를 확인했어요',text:'확인하신 글 콘티대로 컷마다 장면 이미지를 만들어요. 다 되면 알려 드려요.'};
  if(state==='prepare'&&chosen)return {turn:'us',title:'이 방향으로 정했어요',text:'광고가 남길 한 문장과 글 콘티를 만들어 보내 드려요. 보시고 마음에 드시면 그때 크몽 결제를 안내해 드려요.'};
  if(state==='redirect'&&last)return {turn:'us',title:'담당자가 직접 연락드려요',text:'주신 말씀을 들고 담당자가 연락드려 함께 정해요. 정해지면 글 콘티를 보내 드려요.'};
  if(state==='model'&&photo)return {...COPY.model,text:'첫 장을 만들기 전에 모델부터 정해요. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요.'};
  if(state==='images'&&photo)return {...COPY.images,title:'첫 장이 도착했어요',text:'첫 장을 보고 의견을 남겨 주세요. 방향이 맞으면 나머지 장을 만들어요.'};
  if(state==='review'&&photo)return {...COPY.review,title:'사진이 도착했어요',text:'사진을 보고 고칠 곳에 의견을 남겨 주세요.'};
  if(state==='prepare'&&photo)return {turn:'us',title:'첫 장을 만들고 있어요',text:'보내 주신 사진과 의뢰서대로 첫 장을 먼저 보내 드려요. 방향이 맞으면 나머지 장을 만들어요.'};
  if(state==='make'&&photo)return {turn:'us',title:'확인하신 첫 장대로 만들고 있어요',text:'나머지 장을 같은 결로 만들고 있어요. 다음에 받으실 것은 완성 사진이에요.'};
  if(state==='check'&&photo)return {...COPY.check,text:'보내 주신 의뢰서를 확인하고 있어요. 평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요. 확인이 끝나면 첫 장을 먼저 보내 드려요.'};
  if(state==='direction'&&options>2)return {...COPY.direction,title:'세 방향 중 하나를 골라 주세요'};
  return COPY[state]||COPY.check;
}
// 「11월 17일」(room-view.mjs longDay의 한국어 꼴).
const longDay=day=>{const [y,m,d]=String(day||'').split('-').map(Number);return y?`${m}월 ${d}일`:'';};
// 받으실 날(room-view.mjs roomBrief의 「받으실 날」 줄): 결제를 확인했으면 그때 정한 날, 결제 차례면 「결제한 날부터 N일」, 방향 제안이 오면 거기 적힌 날, 그 밖에는 패키지 기간.
// 고객 방은 보낸 의뢰서에 「길이 · 구성」 줄이 있을 때(패키지를 골랐을 때)만 이 줄을 세운다.
function dueOf(r,pkg){
  if(!r.submittedAt||!r.answers?.package)return '';
  const due=r.directionProposal?.dueDate,paidDue=r.payment?.status==='confirmed'?r.payment.dueDate||'':'',paying=roomPayState(r)&&pkg?.days;
  if(paidDue)return r.payment.dueChangedAt?`${longDay(paidDue)} · 담당자가 다시 정한 날`:`${longDay(paidDue)} · 결제 확인 때 정한 날`;
  if(paying)return `결제한 날부터 ${pkg.days}일`;
  if(due)return `${longDay(due)} · 방향 제안에 적힌 날`;
  if(pkg?.days)return pkg.photo?`자료가 다 모인 날부터 ${pkg.days}일`:`자료가 다 모인 날부터 ${pkg.days}일 · 날짜는 방향을 보내 드릴 때 알려 드려요`;
  return '구성에 맞춰 함께 정해요';
}
// 결제하는 법(결제 카드 film-views.mjs payCard): 영상은 「결제 · 취소 · 증빙」의 결제 글 그대로, 사진은 결제 카드의 세 걸음(사진 글)을 이은 것.
export function roomPayHow(photo){
  return photo?'결제는 크몽에서 해요. 크몽 상품에서 「문의하기」로 접수 번호를 보내 주시면, 담당자가 같은 값 · 기간 · 수정 횟수로 결제 요청을 보내 드려요. 결제하시면 확인한 뒤 나머지 장을 만들어요.'
    :'결제는 크몽에서 해요. 글 콘티를 보시고 승인하신 뒤 크몽 상품에서 「문의하기」로 접수 번호를 보내 주시면, 담당자가 같은 값 · 기간 · 수정 횟수의 결제 요청을 보내 드려요. 결제가 확인되면 장면 이미지를 만들기 시작해요. 글 콘티까지는 값을 받지 않아요.';
}
// 손님 보기 하나에서 고객 방이 보이는 것. 의뢰서가 없는 프로젝트면 null.
export function customerRoomFacts(p){
  const r=requestOf(p);if(!r)return null;
  const state=roomStateOf(p),pkg=Object.hasOwn(ROOM_PACKAGES,r.answers?.package??'')?ROOM_PACKAGES[r.answers.package]:null,photo=r.answers?.package==='photo',copy=copyOf(state,r,photo);
  // 정한 수정 횟수: 방향 제안에 적힌 것, 없으면 패키지 것(feedback-rounds-view.mjs · room-view.mjs payModel과 같은 값).
  const proposed=r.directionProposal?.revisions,revisions=Number.isSafeInteger(proposed)?proposed:pkg?.revisions??null;
  // 접수 번호: 고객 방 머리 · 결제 카드에 보이는 번호(크몽 「문의하기」에 손님이 보낸다).
  const number=typeof r.number==='string'&&/^P-[0-9A-Z-]{4,20}$/.test(r.number)?r.number:'';
  return {state,stage:(photo?PHOTO_STAGE_NAMES:ROOM_STAGE_NAMES)[STAGE_OF[state]||'check'],turn:copy.turn,title:copy.title,text:copy.text,photo,pkg,due:dueOf(r,pkg),revisions,number};
}
