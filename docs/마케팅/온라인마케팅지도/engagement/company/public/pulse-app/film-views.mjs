import {esc} from './api.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {MODEL_LINES} from './request-data.mjs';
import {ROOM_STAGES,ROOM_COPY,CONFIRM_OF} from './room-view.mjs';
import {revealWords,riseAll,rise,play,reduced,onView} from './motion.mjs';
import {featuredFilmsView,hasFinishedFilms} from './films-view.mjs';
import {CASTING_BOOK_URL} from './casting-view.mjs';

// 슬레이트 판의 큰 화면들(2026-11-04): 첫 화면, 고객 방, 1차안. 자료 모양은 room-view.mjs가 프로젝트에서 옮겨 준다.
const ASSET='./assets/request/';
const arrow='<span class="arw" aria-hidden="true">→</span>';
const pad=(value,size=2)=>String(value).padStart(size,'0');
const secs=value=>`${Number(value).toFixed(value%1?2:0)}s`;
const cutName=(index,cut,react='')=>`${index+1}번 컷, ${cut.seconds.toFixed(1)}초${react==='ok'?', 좋아요':react==='fix'?', 고칠 곳 있음':''}`;

// ── 첫 화면 ──
// 벽: 맡은 역할을 연기하는 모델 장면(캐스팅북과 같은 판)과 대표작 컷. 자막이 구워진 판은 쓰지 않는다.
const shot=code=>`./assets/casting/photos/${code}-context.webp`,film=name=>`${ASSET}${name}.webp`;
const WALL=[
  [shot('f04'),film('w-gift-sphere'),shot('m02'),shot('f02'),film('w-gift-snow')],
  [film('w-gift'),shot('f09'),shot('m06'),shot('f01'),shot('m09')],
  [shot('f11'),shot('m01'),film('w-maejin'),shot('f07'),shot('f03')],
];
const STAGES=[
  {no:'01',title:'의뢰서를 써요',text:'제품 이름, 올릴 곳, 사진 몇 장이면 돼요. 쓰는 동안 화면에서 어떻게 보일지 바로 보여 드려요.',img:film('demo-can-front')},
  {no:'02',title:'저희가 먼저 확인해요',text:'빠진 게 있으면 그 칸만 다시 여쭤요. 같은 말을 두 번 묻지 않아요. 진행과 값도 이때 안내해 드려요.',img:film('demo-can-side')},
  {no:'03',title:'1차안을 받아요',text:'모델, 광고가 남길 한 문장과 글 콘티, 모든 컷의 장면 이미지를 영상 전에 차례로 보여 드려요. 컷마다 의견을 남기세요.',note:'장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.',img:film('how-conti-S05')},
  {no:'04',title:'확인하신 컷으로 만들어요',text:'목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 제품 · 로고 · 글자는 실제 파일을 그대로 얹어요.',img:film('how-final-S05')},
  {no:'05',title:'파일을 받아요',text:'올릴 곳에 맞는 파일로 받아요. 다음 편도 같은 모델과 같은 자막 규격으로 이어요.',img:film('w-gift')},
];
// PULSE 소개글(2026-11-04 유호님 「원고대로 올려」): 원고 docs/마케팅/PULSE_소개글_20261103/README.md 1절 · 5절을 해요체로, 사실과 낱말은 그대로 옮겼다. 처음 들어온 사람이 읽는 첫 화면에만 두고, 작업 중인 손님의 고객 방에는 넣지 않는다. 모델 수가 늘면 시험(pulse-client-review-fixes)이 알린다.
const INTRO_PROMISES=[
  ['컷마다 장면 먼저','대표 그림 한두 장이 아니라 들어갈 모든 컷을 완성 화질로 먼저 보여 드려요. 장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있고, 제품·로고·글자는 합성이라 달라지지 않아요.'],
  ['출연자는 캐스팅','이름과 얼굴이 정해진 AI 모델 21명 가운데 골라요. 다음 편도 같은 모델과 같은 자막 규격으로 이어요.',`<a class="btn-text" href="${CASTING_BOOK_URL}" target="_blank" rel="noopener noreferrer">캐스팅북 보기 <span aria-hidden="true">↗</span><span class="sr"> (새 탭)</span></a>`],
  ['제품·로고·화면 위 글자는 진짜로','다시 그리지 않고 보내 주신 사진과 파일로 합성해, 글자가 뭉개지거나 로고가 바뀌지 않아요.'],
  ['무엇으로 남길지 먼저','이야기로 여운을 남길지, 한 장면의 임팩트로 남길지 기획 첫 줄에 정해요.'],
  ['소리부터','목소리와 음악을 먼저 만들고 그 박자에 컷을 맞춰요. 못 나온 컷은 보정으로 덮지 않고 다시 만들어요.'],
];
const MAKER_CREDITS=['넷플릭스 공개 「보라! 데보라」 1화 오프닝 시퀀스 출연','tvN 「코미디빅리그」 코너 출연','부활 「너의 모습」 뮤직비디오 주연'];
// 값은 정가의 「부터」만 둔다(결정 10-29). 부가세 · 세금계산서 · 기간 표기는 사업자 결정 뒤에.
const INTRO_PRICES=[['15초 광고','39만원부터'],['30초 광고와 편집본','89만원부터'],['기업 캠페인','250만원부터']];
const sectionHead=(kicker,title,text,id)=>`<header class="entry-sec-head"><p class="entry-sec-kicker">${esc(kicker)}</p><h2 id="${id}" data-view-title>${esc(title)}</h2>${text?`<p class="entry-sec-text" data-view-in>${esc(text)}</p>`:''}</header>`;
export function entryView({demoHref='?demo=film',entryError=null,resume=false}={}){
  const start=resume?'쓰던 의뢰서 이어 쓰기':'광고 의뢰하기';
  return `<div class="entry${entryError?' has-entry-error':''}">
    <section class="entry-hero">
      <div class="entry-wall" aria-hidden="true">${WALL.map((column,i)=>`<div class="wall-col wall-col-${i}"><div class="wall-run">${[...column,...column].map((src,k)=>`<figure><img src="${src}" alt="" loading="${k<5?'eager':'lazy'}"><figcaption class="mono">${pad(k%5+1)}</figcaption></figure>`).join('')}</div></div>`).join('')}</div>
      <header class="entry-top"><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="164" height="44"><a class="entry-top-link" href="${esc(demoHref)}" data-entry-demo>예시 프로젝트</a></header>
      <div class="entry-copy">
        <p class="entry-kicker">SYNK PULSE · AI 광고 제작</p>
        <h1 class="entry-title" data-entry-title>모든 컷을
먼저 보여 드리는
AI 광고</h1>
        <p class="entry-lead" data-entry-in>영상에 들어갈 모든 컷을 장면 이미지로 먼저 보여 드려요. AI 모델 21명 캐스팅, 제품·로고는 실제 파일로 합성해요.</p>
        <div class="entry-actions" data-entry-in><button type="button" class="btn-main is-paper is-large" data-entry="start"><span>${esc(start)}</span>${arrow}</button><button type="button" class="btn-text entry-open" data-entry="open">받은 링크로 내 프로젝트 열기</button></div>
        <p class="entry-note" data-entry-in>상담은 제품 사진 한 장과 올릴 곳만으로 시작해요.</p>
        <form class="entry-invite" data-form="invite" data-entry-invite ${entryError?'':'hidden'}>${entryError?`<div class="entry-alert" role="alert"><strong>${esc(entryError.title)}</strong><p>${esc(entryError.text)}</p></div>`:''}<label><span>담당자에게 받은 링크</span><input name="invite" type="text" maxlength="3000" required placeholder="https://workspace.synk.im/pulse-app/#invite=…" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url"></label><button type="submit" class="btn-main is-paper" data-mutate><span>열기</span>${arrow}</button><p class="entry-invite-note">가입이나 비밀번호 없이 열려요. 연결하면 이 프로젝트의 자료와 대화만 볼 수 있어요.</p><button type="button" class="btn-text entry-retry" data-action="retry">이 기기에서 다시 확인</button></form>
      </div>
      <p class="entry-credit">SYNK AI 모델과, 가상 브랜드로 만든 자체 작품의 장면이에요.</p>
    </section>
    ${hasFinishedFilms()?`<section class="entry-works" aria-labelledby="entry-works-title">${sectionHead('완성 광고','SYNK가 끝까지 만든 광고예요','가상 브랜드로 만든 자체 작품이에요. 새 작품은 완성되는 대로 더해요.','entry-works-title')}${featuredFilmsView()}</section>`:''}
    <section class="entry-promise" aria-labelledby="entry-promise-title">${sectionHead('이렇게 만들어요','영상 전에 세 번 확인해요','모델 고르기, 광고가 남길 한 문장과 글 콘티, 컷마다 장면 이미지.','entry-promise-title')}<ol class="entry-promises">${INTRO_PROMISES.map(([title,text,link],i)=>`<li data-view-in><span class="mono" aria-hidden="true">${pad(i+1)}</span><div><h3>${esc(title)}</h3><p>${esc(text)}</p>${link||''}</div></li>`).join('')}</ol></section>
    <section class="entry-how" aria-labelledby="entry-how-title">
      <header class="entry-sec-head"><p class="mono entry-sec-kicker">HOW IT WORKS</p><h2 id="entry-how-title" data-view-title>맡기면 이렇게 진행돼요</h2></header>
      <div class="sheets">${STAGES.map((stage,i)=>`<article class="sheet sheet-${i}"><header class="sheet-tab"><span class="mono">${stage.no}</span><h3>${esc(stage.title)}</h3></header><div class="sheet-body"><div><p>${esc(stage.text)}</p>${stage.note?`<small>${esc(stage.note)}</small>`:''}</div><img src="${stage.img}" alt="" loading="lazy"></div></article>`).join('')}</div>
      <div class="entry-how-end"><p>맡기신 뒤에는 초대 링크 하나로 시안을 보고 의견을 남기고, 최종 파일까지 한곳에서 받아요.</p><a class="btn-line" href="${esc(demoHref)}" data-entry-demo>예시 프로젝트 체험하기 ${arrow}</a></div>
    </section>
    <section class="entry-maker" aria-labelledby="entry-maker-title">${sectionHead('만드는 사람','카메라 앞에 서 본 사람이 AI 모델의 연기를 연출해요','AI 광고가 어색해지는 곳은 대개 표정과 호흡, 말이 끝나는 타이밍이에요. SYNK PULSE는 배우로 활동한 대표 유호가 연출해요.','entry-maker-title')}<ul class="entry-credits">${MAKER_CREDITS.map(line=>`<li data-view-in>${esc(line)}</li>`).join('')}</ul></section>
    <section class="entry-price" aria-labelledby="entry-price-title"><h2 class="entry-sec-kicker" id="entry-price-title">값</h2><ul class="entry-prices">${INTRO_PRICES.map(([label,price])=>`<li data-view-in><span>${esc(label)}</span> <strong>${esc(price)}</strong></li>`).join('')}</ul><div class="entry-price-end"><p>상담은 제품 사진 한 장과 올릴 곳만으로 시작해요.</p><button type="button" class="btn-main is-large" data-entry="start"><span>${esc(start)}</span>${arrow}</button></div></section>
    <footer class="entry-foot"><p>앱을 설치하지 않아도 휴대폰과 컴퓨터에서 열려요. 영상 속 사람과 목소리는 모두 AI로 만들어요. 실존 인물을 닮게 만드는 요청은 받지 않아요.</p><a class="entry-creator" href="?mode=staff">제작자 공간</a></footer>
  </div>`;
}
// 듣개는 화면과 함께 사라지는 래퍼에 건다(root는 앱이 다시 쓰는 칸이라 다시 그릴 때마다 겹친다).
export function mountEntry(root,{onStart,onInvite,onDemo,animate=true}={}){
  const host=root.querySelector('.entry');
  if(animate){
    revealWords(host.querySelector('[data-entry-title]'),{delay:120,gap:64,duration:760});
    riseAll(host.querySelectorAll('[data-entry-in]'),{start:520,gap:70,y:14,duration:420});
    host.querySelectorAll('.wall-col').forEach((col,i)=>play(col,[{opacity:0},{opacity:1}],{duration:1100,delay:120+i*160}));
    onView(host.querySelectorAll('[data-view-title]'),title=>revealWords(title,{gap:44,duration:620}));
    onView(host.querySelectorAll('[data-view-in]'),node=>rise(node,{y:14,duration:420}));
  }
  host.addEventListener('click',event=>{if(onDemo&&event.target.closest('[data-entry-demo]')){event.preventDefault();onDemo();return;}const what=event.target.closest('[data-entry]')?.dataset.entry;if(what==='start')onStart?.();if(what==='open'){const form=host.querySelector('[data-entry-invite]');form.hidden=!form.hidden;if(!form.hidden){rise(form);form.querySelector('input').focus();}}});
  if(onInvite)host.querySelector('[data-entry-invite]').addEventListener('submit',event=>{event.preventDefault();onInvite(event.target.invite.value);});
  return {unmount(){}};
}

// ── 고객 방 ──
// 왼쪽 레일: 지금 단계까지만 열린다. 영상 확인 · 납품은 옛 화면을 이 레일 안에 둔다(views.mjs projectView).
export function roomRail(p,{tab='overview'}={}){
  const at=ROOM_STAGES.findIndex(item=>item.id===p.stage),now=['draft','review','history','films'].includes(tab)?tab:p.stage;
  // 판이 오기 전의 1차안 칸은 지금 단계여도 열지 않는다(모델을 정하기 전에 글 콘티로 넘어가지 않게).
  const locked=(item,i)=>item.id==='draft'&&!p.hasRound||item.id!==now&&i>at;
  return `<nav class="room-rail" aria-label="단계"><div class="rail-steps">${ROOM_STAGES.map((item,i)=>`<button type="button" class="rail-item ${item.id===now?'is-now':i<at?'is-done':''}" ${item.id===now?'aria-current="page"':''} ${locked(item,i)?'disabled':''} data-room-go="${item.id}"><span class="mono">${item.no}</span>${esc(item.name)}</button>`).join('')}</div><div class="rail-foot">${p.films?`<button type="button" class="btn-text${tab==='films'?' is-now':''}" ${tab==='films'?'aria-current="page"':''} data-room-go="films">완성 광고</button>`:''}<button type="button" class="btn-text" data-room-do="contact">담당자에게 묻기</button></div></nav>`;
}
export function roomView(p,{bar=true,top='',after=''}={}){
  const copy=ROOM_COPY[p.state]||ROOM_COPY.check,confirm=CONFIRM_OF[p.state];
  return `<div class="room">
    ${bar?`<header class="room-bar"><img src="./assets/brand-pulse.webp" alt="SYNK PULSE" width="154" height="41"><span class="room-bar-title"><b>${esc(p.title)}</b><span class="mono">${esc(p.number)}</span></span><span class="room-bar-who">담당 ${esc(p.manager)}</span></header>`:''}
    <div class="room-grid">
      ${roomRail(p)}
      <div class="room-main">
        ${top}
        <p class="room-kicker"><i class="turn turn-${copy.turn}" aria-hidden="true"></i>${copy.turn==='you'?'내 차례':'저희 차례'}${confirm?`<span class="room-confirm">영상 전 확인 <b class="mono">${confirm}</b></span>`:''}</p>
        <h1 class="room-title" data-room-title>${esc(copy.title)}</h1>
        <p class="room-lead" data-room-in>${esc(copy.text)}</p>
        ${copy.action?`<div data-room-in><button type="button" class="btn-main is-large" data-room-go="${esc(copy.action.go)}"><span>${esc(copy.action.label)}</span>${arrow}</button></div>`:''}
        ${p.state==='model'&&p.proposal?proposeCard(p.proposal):''}
        ${p.state==='ask'?askList(p):''}
        ${after}
        <div class="room-cols" data-room-in data-room-brief>
          <section class="room-card"><h2>보내 주신 의뢰서</h2><dl class="kv">${p.brief.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${p.canEdit?'<button type="button" class="btn-text" data-room-do="edit">고치기</button>':''}</section>
          <section class="room-card"><h2>받은 자료 <span class="mono">${p.files.length+(p.others?.length||0)}</span></h2><div class="contact">${p.files.map(file=>`<figure><img src="${esc(file.src)}" alt=""><figcaption>${esc(file.label)}</figcaption></figure>`).join('')}</div>${p.others?.length?`<ul class="room-others">${p.others.map(name=>`<li>${esc(name)}</li>`).join('')}</ul>`:''}<label class="btn-text room-more"><input type="file" class="sr" multiple data-room-file>자료 더 보내기</label></section>
        </div>
      </div>
    </div>
  </div>`;
}
// 되묻기: 칸마다 글로 답하거나 파일을 보낸다. 파일만, 글만 보내도 된다.
function askList(p){return `<ul class="ask-list" data-room-in>${p.asks.map(item=>`<li><div class="ask-head"><b>${esc(item.label)}</b>${item.why?`<p>${esc(item.why)}</p>`:''}</div><form class="ask-reply" data-form="ask" data-id="${esc(item.id||'')}"><textarea name="text" rows="2" maxlength="1000" placeholder="글로 답해 주세요. 파일이면 아래에서 골라 주세요." aria-label="${esc(item.label)} 답"></textarea><div class="ask-tools"><label class="btn-line"><input type="file" class="sr" name="file" data-ask-file><span data-ask-name>파일 고르기</span></label><button type="submit" class="btn-main" data-mutate><span>보내기</span>${arrow}</button></div></form></li>`).join('')}${(p.answered||[]).map(item=>`<li class="is-answered"><div class="ask-head"><b>${esc(item.label)}</b><p>${esc(item.answer||item.fileName||'파일을 보내 주셨어요.')}</p></div><span class="ask-done">보냈어요</span></li>`).join('')}</ul>`;}
// 영상 전 첫 확인: 모델을 맡긴 손님에게 저희가 고른 모델을 보여 드린다. 다른 모델은 그 자리에서 고르거나 글로 말할 수 있다.
function proposeCard(m){
  const others=CASTING_MODELS.filter(item=>item.id!==m.id).map(item=>`<button type="button" class="cast" data-room-model="${item.id}"><img src="${esc(item.image)}" alt="" loading="lazy" width="300" height="400"><span class="cast-name"><b>${esc(item.name)}</b><small>${esc(MODEL_LINES[item.id]?.line||item.description)}</small></span></button>`).join('');
  return `<section class="propose" data-room-in><img class="propose-img" src="${esc(m.image)}" alt=""><div class="propose-text"><h2>${esc(m.name)}</h2><p class="propose-line">${esc(m.line)}</p>${m.note?`<p class="propose-note">${esc(m.note)}</p>`:''}<div class="propose-actions"><button type="button" class="btn-main is-berry" data-room-do="model-accept"><span>이 모델로 할게요</span>${arrow}</button><button type="button" class="btn-line" data-room-do="model-others">다른 모델 보기</button></div></div>
    <div class="propose-others" data-model-others hidden><div class="casts">${others}</div><form data-form="model-say"><label class="propose-say"><span>딱 맞는 모델이 없으면 말로 알려 주세요</span><textarea name="note" rows="2" maxlength="300" required placeholder="예) 조금 더 어린 느낌이면 좋겠어요"></textarea></label><button type="submit" class="btn-line" data-mutate>이대로 보내기</button></form></div></section>`;
}
// 고객 방과, 옛 화면을 품은 새 레일(.project-shell.is-room)에 같이 쓴다.
export function mountRoom(root,{animate=true,onGo,onEdit,onContact,onModel,onFiles,onForm}={}){
  const host=root.querySelector('.room,.project-shell.is-room');if(!host)return {unmount(){}};
  // 휴대폰 단계 띠: 지금 단계가 화면 안에 오게 띠만 민다.
  const steps=host.querySelector('.rail-steps'),current=steps?.querySelector('.is-now');
  if(current&&steps.scrollWidth>steps.clientWidth)steps.scrollLeft=current.offsetLeft-(steps.clientWidth-current.offsetWidth)/2;
  if(animate&&host.matches('.room')){
    const title=host.querySelector('[data-room-title]');if(title)revealWords(title,{delay:60});
    riseAll(host.querySelectorAll('[data-room-in]'),{start:140});
  }
  host.addEventListener('click',event=>{
    const go=event.target.closest('[data-room-go]');if(go){if(!go.disabled)onGo?.(go.dataset.roomGo);return;}
    const model=event.target.closest('[data-room-model]')?.dataset.roomModel;if(model){onModel?.({modelId:model});return;}
    const button=event.target.closest('[data-room-do]'),what=button?.dataset.roomDo;if(!what)return;
    if(what==='edit')onEdit?.();
    if(what==='contact')onContact?.();
    if(what==='model-accept')onModel?.({accept:true});
    if(what==='model-others'){const box=host.querySelector('[data-model-others]');box.hidden=!box.hidden;if(!box.hidden)rise(box);}
  });
  // 예시(앱 밖)에서만 쓴다. 실제 앱은 문서 전체의 폼 처리기가 받는다.
  if(onForm)host.addEventListener('submit',event=>{event.preventDefault();onForm(event.target);});
  const fileName=input=>{input.closest('label').querySelector('[data-ask-name]').textContent=input.files[0]?.name||'파일 고르기';};
  host.querySelectorAll('[data-ask-file]').forEach(fileName);
  host.addEventListener('change',event=>{
    if(event.target.matches('[data-ask-file]'))fileName(event.target);
    if(event.target.matches('[data-room-file]')&&event.target.files.length){const list=[...event.target.files];event.target.value='';onFiles?.(list);}
  });
  return {unmount(){}};
}

// ── 1차안 ──
// 영상 전에 세 번 확인(공개 약속): 모델 · 한 문장과 글 콘티 → 컷마다 장면 이미지. 글 콘티 판은 그림 없이 먼저 보내 장면을 굽기 전에 방향을 맞춘다.
export function draftView(d,{top=''}={}){
  const total=d.cuts.reduce((sum,cut)=>sum+cut.seconds,0),script=d.cuts.every(cut=>!cut.src),locked=d.approved?'이 판은 확인을 마쳤어요.':d.feedbackAt?'보내 주신 의견을 반영하고 있어요. 새 판이 오면 알려 드려요.':'';
  return `<div class="draft ${script?'is-script':''}" data-draft>
    <header class="draft-bar"><button type="button" class="btn-text" data-draft-do="back">← 현황</button><span class="draft-bar-title"><b>${script?'글 콘티':'장면 이미지'}</b><span class="draft-bar-meta">${esc(d.round)}판 · ${d.cuts.length}컷 · ${total.toFixed(1)}초</span></span><span class="draft-bar-note">영상 전 확인 <b class="mono">${script?'2':'3'}/3</b>${locked?'':' · 의견을 모아 한 번에 보내 주세요'}</span></header>
    <section class="draft-line"><div>${top}<p>광고가 남길 한 문장</p><h1 data-draft-title>${esc(d.oneLine)}</h1>${d.note?`<p class="draft-note">${esc(d.note)}</p>`:''}</div>${d.model?`<div class="draft-cast"><img src="${esc(d.model.image)}" alt=""><span><b>${esc(d.model.name)}</b><small>${esc(d.model.line)}</small>${script&&!locked?'<button type="button" class="btn-text" data-draft-do="recast">다른 모델로 바꾸기</button>':''}</span></div>`:''}</section>
    <div class="draft-stage">
      <figure class="draft-frame" data-ratio="${esc(d.ratio||'9:16')}" data-frame-box>${d.cuts[0].src?`<img data-frame src="${esc(d.cuts[0].src)}" alt="">`:'<div class="draft-blank" data-blank></div>'}<button type="button" class="draft-play" data-draft-do="play" aria-label="이어서 보기"><span aria-hidden="true">▶</span></button><figcaption><span class="mono" data-tc>00:00.00</span><span data-tc-no>컷 01</span></figcaption></figure>
      <aside class="draft-notes">
        <p class="draft-cut mono"><b data-cut-no>01</b> / ${pad(d.cuts.length)} <span data-cut-sec>${secs(d.cuts[0].seconds)}</span></p>
        <h2 data-cut-what>${esc(d.cuts[0].what)}</h2>
        <dl class="kv is-night"><div><dt>말</dt><dd data-cut-say>${esc(d.cuts[0].say||'없음')}</dd></div><div><dt>화면 글자</dt><dd data-cut-text>${esc(d.cuts[0].text||'없음')}</dd></div></dl>
        ${locked?'':`<div class="draft-react"><button type="button" class="react" data-draft-do="ok" aria-pressed="false">좋아요</button><button type="button" class="react" data-draft-do="fix" aria-pressed="false">고칠 곳이 있어요</button></div>
        <label class="draft-comment" data-comment hidden><span>이 컷에서 무엇을 바꾸면 좋을까요?</span><textarea rows="3" maxlength="1000" placeholder="예) 강아지가 조금 더 크게 보이면 좋겠어요" data-comment-input></textarea></label>`}
        <p class="draft-warn">${script?'글이 맞으면 컷마다 장면 이미지를 만들어 보여 드려요.':'장면 이미지는 영상의 첫 장면이에요. 움직이는 동안 작은 부분은 달라질 수 있어요. 제품 · 로고 · 글자는 실제 파일을 얹고, 글자를 또렷이 읽어야 하는 컷은 멈춘 컷으로 잡아요.'}</p>
      </aside>
    </div>
    <div class="draft-strip" role="listbox" aria-label="컷 목록"><div class="strip-run" data-strip>${d.cuts.map((cut,i)=>`<button type="button" class="strip-cut ${i===0?'is-on':''}" role="option" aria-selected="${i===0?'true':'false'}" aria-label="${esc(cutName(i,cut))}" data-cut="${i}" data-w="${cut.seconds}">${cut.src?`<img src="${esc(cut.src)}" alt="" loading="lazy">`:'<span class="strip-text"></span>'}<span class="strip-hatch" aria-hidden="true"></span><span class="strip-meta mono"><b>${pad(i+1)}</b>${cut.seconds.toFixed(1)}</span><i class="strip-state" aria-hidden="true"></i></button>`).join('')}<i class="strip-head" data-head aria-hidden="true"></i></div></div>
    <footer class="draft-decide"><p data-decide-note>${esc(locked||'컷을 하나씩 보고 의견을 남겨 주세요.')}</p>${locked?'':`<div class="draft-decide-actions"><button type="button" class="btn-main is-berry" data-draft-do="send" hidden><span>의견 보내기 <b class="mono" data-count>0</b></span>${arrow}</button><button type="button" class="btn-main is-berry" data-draft-do="approve"><span>${script?'이대로 장면 이미지 만들기':'이대로 제작 시작'}</span>${arrow}</button></div>`}</footer>
  </div>`;
}
// 컷마다 남긴 의견은 부른 쪽이 쥘 수 있게 state로 받는다(실시간 갱신으로 화면을 다시 그려도 잃지 않게).
export function mountDraft(root,d,{animate=true,state:kept,at:startAt=0,onChange,onBack,onApprove,onSend,onRecast}={}){
  const host=root.querySelector('.draft'),$=selector=>host.querySelector(selector);
  const state=kept?.length===d.cuts.length?kept:d.cuts.map(()=>({react:'',note:''}));let at=Math.min(startAt,d.cuts.length-1),timer=0,nextTimer=0,playing=false,startTime=0;
  const cuts=[...host.querySelectorAll('.strip-cut')],total=d.cuts.reduce((sum,cut)=>sum+cut.seconds,0),strip=$('.draft-strip');
  cuts.forEach((el,i)=>{el.style.setProperty('--w',String(d.cuts[i].seconds));});
  if(animate){
    revealWords($('[data-draft-title]'),{delay:80,gap:36});
    riseAll(host.querySelectorAll('.draft-frame,.draft-notes'),{start:180,gap:60});
    riseAll(cuts,{start:240,gap:30,y:10});
  }
  const startOf=index=>d.cuts.slice(0,index).reduce((sum,cut)=>sum+cut.seconds,0);
  const fmt=value=>`${pad(Math.floor(value/60))}:${pad(Math.floor(value%60))}.${pad(Math.floor(value%1*100))}`;
  function moveHead(seconds){const head=$('[data-head]');head.style.setProperty('--x',String(seconds/total));}
  function show(index,{quick=false}={}){
    clearTimeout(nextTimer);at=index;const cut=d.cuts[index];
    const image=$('[data-frame]');if(image&&cut.src)image.src=cut.src;const blank=$('[data-blank]');if(blank)blank.textContent=cut.what;$('[data-cut-no]').textContent=pad(index+1);$('[data-cut-sec]').textContent=secs(cut.seconds);$('[data-cut-what]').textContent=cut.what;$('[data-cut-say]').textContent=cut.say||'없음';$('[data-cut-text]').textContent=cut.text||'없음';$('[data-tc-no]').textContent=`컷 ${pad(index+1)}`;$('[data-tc]').textContent=fmt(startOf(index));
    if(!quick)play(image||blank,[{opacity:.35,transform:'scale(1.02)'},{opacity:1,transform:'scale(1)'}],{duration:240});
    cuts.forEach((el,i)=>{el.classList.toggle('is-on',i===index);el.setAttribute('aria-selected',i===index?'true':'false');});
    // 페이지가 아니라 필름 띠만 옮긴다.
    const el=cuts[index];strip.scrollTo?.({left:el.offsetLeft-(strip.clientWidth-el.offsetWidth)/2,behavior:reduced()||quick?'auto':'smooth'});
    if(!playing)moveHead(startOf(index));
    syncReact();
  }
  // 고칠 곳을 적어 두면 주 단추가 「의견 보내기」로 바뀐다. 의견을 적어 둔 채 제작이 시작되는 일이 없게 한다.
  function syncReact(){
    cuts.forEach((el,i)=>{el.dataset.state=state[i].react;el.setAttribute('aria-label',cutName(i,d.cuts[i],state[i].react));});
    onChange?.(state,at);
    if(!$('.react'))return;
    const s=state[at],script=d.cuts.every(cut=>!cut.src);
    host.querySelectorAll('.react').forEach(el=>{const on=el.dataset.draftDo===s.react;el.classList.toggle('is-on',on);el.setAttribute('aria-pressed',on?'true':'false');});
    const box=$('[data-comment]'),input=$('[data-comment-input]');box.hidden=s.react!=='fix';if(input.value!==s.note)input.value=s.note;
    const fixes=state.filter(item=>item.react==='fix'),blank=fixes.filter(item=>!item.note.trim()).length,seen=state.filter(item=>item.react).length;
    $('[data-count]').textContent=fixes.length;$('[data-draft-do="send"]').hidden=!fixes.length;$('[data-draft-do="approve"]').hidden=!!fixes.length;
    $('[data-decide-note]').textContent=blank?`고칠 곳 ${fixes.length}개 중 ${blank}개가 비어 있어요. 무엇을 바꾸면 좋을지 적어 주세요.`:fixes.length?`고칠 곳 ${fixes.length}개를 모았어요. 보내 주시면 반영한 판을 다시 보여 드려요.`:seen===d.cuts.length?(script?'모든 컷을 확인하셨어요. 이대로 괜찮으면 장면 이미지를 만들어요.':'모든 컷을 확인하셨어요. 이대로 괜찮으면 제작을 시작해요.'):seen?`${d.cuts.length}컷 중 ${seen}컷을 확인하셨어요.`:'컷을 하나씩 보고 의견을 남겨 주세요.';
  }
  function stop(){clearTimeout(nextTimer);playing=false;delete host.dataset.playing;cancelAnimationFrame(timer);$('.draft-play').classList.remove('is-playing');}
  function playAll(){
    if(playing){stop();return;}
    playing=true;host.dataset.playing='true';$('.draft-play').classList.add('is-playing');
    startTime=performance.now()-startOf(at)*1000;
    const tick=now=>{const t=(now-startTime)/1000;if(t>=total){stop();show(0);return;}moveHead(t);$('[data-tc]').textContent=fmt(t);let index=d.cuts.length-1;for(let i=0;i<d.cuts.length;i++){if(t<startOf(i+1)){index=i;break;}}if(index!==at)show(index,{quick:true});timer=requestAnimationFrame(tick);};
    timer=requestAnimationFrame(tick);
  }
  host.addEventListener('click',event=>{
    const cut=event.target.closest('[data-cut]');if(cut){stop();show(Number(cut.dataset.cut));return;}
    const what=event.target.closest('[data-draft-do]')?.dataset.draftDo;if(!what)return;
    if(what==='play')playAll();
    if(what==='back')onBack?.();
    if(what==='ok'){state[at].react=state[at].react==='ok'?'':'ok';syncReact();if(state[at].react==='ok'&&at<d.cuts.length-1){const from=at;clearTimeout(nextTimer);nextTimer=setTimeout(()=>{if(host.isConnected)show(from+1);},220);}}
    if(what==='fix'){state[at].react=state[at].react==='fix'?'':'fix';syncReact();if(state[at].react==='fix')$('[data-comment-input]').focus();}
    if(what==='recast')onRecast?.();
    if(what==='send'){
      const blank=state.findIndex(item=>item.react==='fix'&&!item.note.trim());
      if(blank>=0){stop();show(blank,{quick:true});$('[data-comment-input]').focus();return;}
      onSend?.(state);
    }
    if(what==='approve')onApprove?.(state);
  });
  host.addEventListener('input',event=>{if(event.target.matches('[data-comment-input]')){state[at].note=event.target.value;syncReact();}});
  host.addEventListener('keydown',event=>{if(event.target.tagName==='TEXTAREA')return;if(event.key==='ArrowRight'&&at<d.cuts.length-1){stop();show(at+1,{quick:true});}if(event.key==='ArrowLeft'&&at>0){stop();show(at-1,{quick:true});}});
  show(at,{quick:true});
  return {stop,unmount:stop};
}
