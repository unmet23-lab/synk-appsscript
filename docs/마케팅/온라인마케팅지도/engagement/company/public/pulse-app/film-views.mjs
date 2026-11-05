import {esc} from './api.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {MODEL_LINES} from './request-data.mjs';
import {ROOM_STAGES,ROOM_COPY,CONFIRM_OF} from './room-view.mjs';
import {revealWords,riseAll,rise,play,reduced} from './motion.mjs';
import {arrow} from './film-home.mjs';
import {holdPoster} from './film-review.mjs';
export {entryView,mountEntry} from './film-home.mjs';

// 시사실 판의 고객 화면(2026-11-05): 고객 방, 1차안. 자료 모양은 room-view.mjs가 프로젝트에서 옮겨 준다. 판단은 거기 있고 여기는 그리기만 한다.
const ASSET='./assets/request/';
const pad=(value,size=2)=>String(value).padStart(size,'0');
const secs=value=>`${Number(value).toFixed(value%1?2:0)}초`;
const cutName=(index,cut,react='')=>`${index+1}번 컷, ${cut.seconds.toFixed(1)}초${react==='ok'?', 좋아요':react==='fix'?', 고칠 곳 있음':''}`;
const modelScene=id=>`${ASSET}model-scene-${String(id).toLowerCase()}.webp`;
const sceneOf=item=>item.photos?.find(photo=>photo.kind==='scene')?.src||item.image;

// ── 고객 방 ──
// 단계 낱말 줄: 지금 단계까지만 열린다. 영상 확인 · 납품도 이 줄을 함께 쓴다.
export function roomRail(p,{tab='overview'}={}){
  const at=ROOM_STAGES.findIndex(item=>item.id===p.stage),now=['draft','review','history','films'].includes(tab)?tab:p.stage;
  // 판이 오기 전의 1차안 칸은 지금 단계여도 열지 않는다(모델을 정하기 전에 글 콘티로 넘어가지 않게).
  const locked=(item,i)=>item.id==='draft'&&!p.hasRound||item.id!==now&&i>at;
  return `<nav class="sx-steps" aria-label="단계"><div class="sx-steps-run">${ROOM_STAGES.map((item,i)=>`<button type="button" class="sx-step ${item.id===now?'is-now':i<at?'is-done':''}" ${item.id===now?'aria-current="page"':''} ${locked(item,i)?'disabled':''} data-room-go="${item.id}">${esc(item.name)}</button>`).join('')}</div><div class="sx-steps-foot sx-small">${p.films?`<button type="button" class="${tab==='films'?'is-now':''}" ${tab==='films'?'aria-current="page"':''} data-room-go="films">완성 광고</button>`:''}<button type="button" data-room-do="contact">담당자에게 묻기</button></div></nav>`;
}
// 오른쪽 스크린: 그 상태에 가장 알맞은 실제 자료. 손님 자료가 없을 때만 예시를 놓고 예시라고 쓴다.
function roomScreen(p){
  if(p.state==='model'&&p.proposal)return `<img class="sx-q-fill" src="${esc(modelScene(p.proposal.id))}" alt=""><p class="sx-small sx-room-cap"><b>${esc(p.proposal.name)}</b> ${esc(p.proposal.line)}</p><div class="sx-room-others" data-model-others hidden>${otherModels(p.proposal)}</div>`;
  if(p.film)return `<video class="sx-q-fill" src="${esc(p.film.src)}" muted loop playsinline preload="metadata" data-room-film aria-label="${esc(p.film.label)}"></video><button type="button" class="sx-room-play" data-room-go="${esc(p.film.go)}"><span class="sr">${esc(p.film.label)} 보기</span></button><p class="sx-small sx-room-cap">${esc(p.film.label)}</p>`;
  const cuts=p.draft?.cuts||[];
  const pictured=cuts.filter(cut=>cut.src);
  if(pictured.length)return `<div class="sx-room-cuts" data-count="${Math.min(pictured.length,12)}">${pictured.slice(0,12).map(cut=>`<img src="${esc(cut.src)}" alt="" loading="lazy" decoding="async">`).join('')}</div><p class="sx-small sx-room-cap">${esc(p.draft.round)}판 · ${cuts.length}컷. 장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있어요.</p>`;
  if(cuts.length)return `<div class="sx-room-word"><p class="sx-serif">${esc(p.draft.oneLine)}</p><ol>${cuts.slice(0,4).map((cut,i)=>`<li><span class="sx-no">${pad(i+1)}</span><span class="sx-small">${esc(cut.what)}</span></li>`).join('')}</ol></div>`;
  if(p.files.length)return `<div class="sx-room-files" data-count="${Math.min(p.files.length,6)}">${p.files.slice(0,6).map(file=>`<img src="${esc(file.src)}" alt="" decoding="async">`).join('')}</div>`;
  const next=p.state==='make'?['w-gift','완성 영상의 예시예요. 「유리결」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품']:['w-gift-snow','다음에 받으실 장면 이미지의 예시예요. 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있어요.'];
  return `<img class="sx-q-fill" src="${ASSET}${next[0]}.webp" alt=""><p class="sx-small sx-room-cap">${esc(next[1])}</p>`;
}
const otherModels=m=>`<div class="sx-wall is-plain">${CASTING_MODELS.filter(item=>item.id!==m.id).map(item=>`<button type="button" class="sx-cast" data-room-model="${item.id}" aria-label="${esc(item.name)} · ${esc(MODEL_LINES[item.id]?.line||item.description)} · 이 모델로 정하기"><img src="${esc(sceneOf(item))}" alt="" loading="lazy" decoding="async" width="538" height="720"><span class="sx-cast-name sx-small">${esc(item.name)}</span></button>`).join('')}</div>`;
export function roomView(p,{bar=true,top='',after=''}={}){
  const copy=ROOM_COPY[p.state]||ROOM_COPY.check,confirm=CONFIRM_OF[p.state];
  return `<div class="sx-room" data-state="${esc(p.state)}">
    ${bar?`<header class="sx-room-bar"><a class="sx-logo" href="./" aria-label="SYNK PULSE 처음으로"><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="164" height="44"></a><span class="sx-small sx-room-bar-title"><b>${esc(p.title)}</b> <span class="sx-no">${esc(p.number)}</span></span><span class="sx-small sx-room-bar-who">담당 ${esc(p.manager)}</span></header>`:''}
    <section class="sx-room-hero">
      <div class="sx-room-left">
        ${top}
        <p class="sx-serif sx-room-project">${esc(p.title)}</p>
        <p class="sx-kicker sx-turn"><i class="${copy.turn==='you'?'is-you':''}" aria-hidden="true"></i>${copy.turn==='you'?'내 차례':'저희 차례'}${confirm?`<span>영상 전 확인 <b class="sx-no">${confirm}</b></span>`:''}</p>
        <h1 class="sx-display" data-room-title>${esc(copy.title)}</h1>
        <p class="sx-body sx-room-lead" data-room-in>${esc(copy.text)}</p>
        ${copy.action?`<div data-room-in><button type="button" class="sx-go is-solid" data-room-go="${esc(copy.action.go)}"><span>${esc(copy.action.label)}</span>${arrow}</button></div>`:''}
        ${p.state==='model'&&p.proposal?proposeCard(p.proposal):''}
        ${p.state==='ask'?askList(p):''}
        ${after}
        ${roomRail(p)}
      </div>
      <div class="sx-room-screen">${roomScreen(p)}</div>
    </section>
    <section class="sx-room-paper" data-room-in data-room-brief>
      <div class="sx-room-doc"><h2 class="sx-serif">보내 주신 의뢰서</h2><dl class="sx-kv">${p.brief.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${p.canEdit?'<button type="button" class="sx-small sx-link" data-room-do="edit">고치기</button>':''}</div>
      <div class="sx-room-doc"><h2 class="sx-serif">받은 자료 <span class="sx-no">${p.files.length+(p.others?.length||0)}</span></h2><div class="sx-contact">${p.files.map(file=>`<figure><img src="${esc(file.src)}" alt="" loading="lazy" decoding="async"><figcaption class="sx-small">${esc(file.label)}</figcaption></figure>`).join('')}</div>${p.others?.length?`<ul class="sx-room-others-list">${p.others.map(name=>`<li class="sx-small">${esc(name)}</li>`).join('')}</ul>`:''}<label class="sx-small sx-link sx-room-more"><input type="file" class="sr" multiple data-room-file>자료 더 보내기</label></div>
    </section>
  </div>`;
}
// 되묻기: 칸마다 글로 답하거나 파일을 보낸다. 파일만, 글만 보내도 된다.
function askList(p){return `<ul class="sx-asks" data-room-in>${p.asks.map(item=>`<li><div class="sx-ask-head"><b class="sx-serif">${esc(item.label)}</b>${item.why?`<p class="sx-small">${esc(item.why)}</p>`:''}</div><form class="sx-ask-reply" data-form="ask" data-id="${esc(item.id||'')}"><textarea name="text" rows="1" maxlength="1000" placeholder="글로 답하거나 파일을 보내 주세요" aria-label="${esc(item.label)} 답"></textarea><div class="sx-ask-tools"><label class="sx-small sx-link"><input type="file" class="sr" name="file" data-ask-file><span data-ask-name>파일 고르기</span></label><button type="submit" class="sx-go" data-mutate><span>보내기</span>${arrow}</button></div></form></li>`).join('')}${(p.answered||[]).map(item=>`<li class="is-answered"><div class="sx-ask-head"><b>${esc(item.label)}</b><p class="sx-small">${esc(item.answer||item.fileName||'파일을 보내 주셨어요.')}</p></div><span class="sx-small">보냈어요</span></li>`).join('')}</ul>`;}
// 영상 전 첫 확인: 모델을 맡긴 손님에게 저희가 고른 모델을 보여 드린다. 다른 모델은 그 자리에서 고르거나 글로 말할 수 있다.
function proposeCard(m){
  return `<section class="sx-propose" data-room-in><h2 class="sx-serif">${esc(m.name)}</h2><p class="sx-body sx-propose-line">${esc(m.line)}</p>${m.note?`<p class="sx-small">${esc(m.note)}</p>`:''}<div class="sx-propose-actions"><button type="button" class="sx-go is-solid" data-room-do="model-accept"><span>이 모델로 할게요</span>${arrow}</button><button type="button" class="sx-small sx-link" data-room-do="model-others">다른 모델 보기</button></div>
    <form class="sx-propose-say" data-form="model-say" data-model-say hidden><label class="sx-field"><span class="sx-small">딱 맞는 모델이 없으면 말로 알려 주세요</span><textarea name="note" rows="2" maxlength="300" required placeholder="예) 조금 더 어린 느낌이면 좋겠어요"></textarea></label><button type="submit" class="sx-go" data-mutate><span>이대로 보내기</span>${arrow}</button></form></section>`;
}
// 고객 방과, 영상 확인 · 납품의 단계 낱말 줄에 같이 쓴다.
export function mountRoom(root,{animate=true,onGo,onEdit,onContact,onModel,onFiles,onForm}={}){
  const host=root.querySelector('.sx-room,.sx-shell');if(!host)return {unmount(){}};
  // 휴대폰 단계 띠: 지금 단계가 화면 안에 오게 띠만 민다.
  const steps=host.querySelector('.sx-steps-run'),current=steps?.querySelector('.is-now');
  if(current&&steps.scrollWidth>steps.clientWidth)steps.scrollLeft=current.offsetLeft-(steps.clientWidth-current.offsetWidth)/2;
  if(animate&&host.matches('.sx-room')){
    const title=host.querySelector('[data-room-title]');if(title)revealWords(title,{delay:60});
    riseAll(host.querySelectorAll('[data-room-in]'),{start:140});
  }
  const film=host.querySelector('[data-room-film]');if(film&&!reduced())film.play?.().catch(()=>{});else if(film)holdPoster(film);
  host.querySelectorAll('video[data-hold]').forEach(video=>holdPoster(video));
  host.addEventListener('click',event=>{
    const go=event.target.closest('[data-room-go]');if(go){if(!go.disabled)onGo?.(go.dataset.roomGo);return;}
    const model=event.target.closest('[data-room-model]')?.dataset.roomModel;if(model){onModel?.({modelId:model});return;}
    const button=event.target.closest('[data-room-do]'),what=button?.dataset.roomDo;if(!what)return;
    if(what==='edit')onEdit?.();
    if(what==='contact')onContact?.();
    if(what==='model-accept')onModel?.({accept:true});
    if(what==='model-others'){const box=host.querySelector('[data-model-others]'),say=host.querySelector('[data-model-say]');box.hidden=!box.hidden;if(say)say.hidden=box.hidden;button.textContent=box.hidden?'다른 모델 보기':'이 모델 다시 보기';if(!box.hidden)play(box,[{opacity:0},{opacity:1}],{duration:420});}
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
// 어두운 방 하나에 가운데 화면, 왼쪽 크레딧, 오른쪽 기둥(컷 내용 · 의견 · 결정), 아래 초 길이만큼 넓은 컷 띠.
// 글 콘티 판은 그림이 없으니 가운데에 불 켠 대본 한 장을 놓고 컷을 다 읽게 한다. 줄을 누르면 그 컷에 의견을 남긴다.
const moment=value=>`${Math.floor(value/60)}:${pad(Math.floor(value%60))}`;
function scriptSheet(d,total){
  let from=0;
  const rows=d.cuts.map((cut,i)=>{const at=from;from+=cut.seconds;return `<button type="button" class="sx-strip-cut sx-sheet-row ${i===0?'is-on':''}" role="option" aria-selected="${i===0?'true':'false'}" aria-label="${esc(cutName(i,cut))}" data-cut="${i}" data-w="${cut.seconds}"><span class="sx-no sx-sheet-at"><b>${pad(i+1)}</b>${moment(at)}</span><span class="sx-sheet-what"><span class="sx-serif">${esc(cut.what)}</span>${cut.say?`<span class="sx-sheet-line"><b>말</b> ${esc(cut.say)}</span>`:''}${cut.text?`<span class="sx-sheet-line"><b>화면 글자</b> ${esc(cut.text)}</span>`:''}</span><i class="sx-strip-state" aria-hidden="true"></i></button>`;}).join('');
  return `<figure class="sx-dr-films sx-sheet-room"><div class="sx-sheet"><header class="sx-sheet-head"><span class="sx-small">글 콘티 ${esc(d.round)}판</span><span class="sx-small"><span class="sx-no">${d.cuts.length}</span>컷 · <span class="sx-no">${total.toFixed(1)}</span>초 · <span class="sx-no">${esc(d.ratio||'9:16')}</span></span></header><div class="sx-sheet-rows" data-strip role="listbox" aria-label="컷 목록">${rows}<i class="sx-strip-head" data-head hidden></i></div><footer class="sx-sheet-foot"><button type="button" class="sx-dr-play" data-draft-do="play" aria-label="이어서 보기"><i aria-hidden="true"></i><span>이어서 보기</span></button><p class="sx-no sx-strip-tc"><span data-tc>00:00.00</span> <span class="sx-small" data-tc-no>컷 01</span></p></footer></div></figure>`;
}
export function draftView(d,{top=''}={}){
  const total=d.cuts.reduce((sum,cut)=>sum+cut.seconds,0),script=d.cuts.every(cut=>!cut.src),locked=d.approved?'이 판은 확인을 마쳤어요.':d.feedbackAt?'보내 주신 의견을 반영하고 있어요. 새 판이 오면 알려 드려요.':'';
  return `<div class="sx-draft sx-dr ${script?'is-script':''}" data-draft data-ratio="${esc(d.ratio||'9:16')}">
    ${script?scriptSheet(d,total):`<figure class="sx-dr-films"><div class="sx-dr-box" data-frame-box><img data-frame ${d.cuts[0].src?`src="${esc(d.cuts[0].src)}"`:'hidden'} alt=""><button type="button" class="sx-dr-play" data-draft-do="play" aria-label="이어서 보기"><i aria-hidden="true"></i><span>이어서 보기</span></button></div></figure>`}
    <header class="sx-dr-left">
      <button type="button" class="sx-small sx-link sx-dr-back" data-draft-do="back">← 현황</button>
      ${top}
      <div class="sx-dr-credit"><p class="sx-small">${script?'글 콘티':'장면 이미지'} · ${esc(d.round)}판 · ${d.cuts.length}컷 · ${total.toFixed(1)}초 · 영상 전 확인 <b class="sx-no">${script?'2':'3'}/3</b></p><p class="sx-small sx-dr-oneline-label">광고가 남길 한 문장</p><h1 class="sx-serif" data-draft-title>${esc(d.oneLine)}</h1>${d.note?`<p class="sx-small sx-draft-note">${esc(d.note)}</p>`:''}</div>
      ${d.model?`<div class="sx-draft-cast"><img src="${esc(modelScene(d.model.id))}" alt=""><span class="sx-small"><b>${esc(d.model.name)}</b> ${esc(d.model.line)}${script&&!locked?' <button type="button" class="sx-link" data-draft-do="recast">다른 모델로 바꾸기</button>':''}</span></div>`:''}
    </header>
    <aside class="sx-dr-right">
      <p class="sx-no sx-draft-cut"><b data-cut-no>01</b> / ${pad(d.cuts.length)} <span class="sx-small" data-cut-sec>${secs(d.cuts[0].seconds)}</span></p>
      <h2 class="sx-serif sx-draft-what" data-cut-what>${esc(d.cuts[0].what)}</h2>
      <dl class="sx-kv is-tight"><div><dt>말</dt><dd data-cut-say>${esc(d.cuts[0].say||'없음')}</dd></div><div><dt>화면 글자</dt><dd data-cut-text>${esc(d.cuts[0].text||'없음')}</dd></div></dl>
      ${locked?'':`<div class="sx-draft-react"><button type="button" class="sx-chip sx-react" data-draft-do="ok" aria-pressed="false">좋아요</button><button type="button" class="sx-chip sx-react" data-draft-do="fix" aria-pressed="false">고칠 곳이 있어요</button></div>
      <label class="sx-field sx-draft-comment" data-comment hidden><span class="sx-small">이 컷에서 무엇을 바꾸면 좋을까요?</span><textarea rows="2" maxlength="1000" placeholder="예) 강아지가 조금 더 크게 보이면 좋겠어요" data-comment-input></textarea></label>`}
      <p class="sx-small sx-draft-warn">${script?'글이 맞으면 컷마다 장면 이미지를 만들어 보여 드려요. 장면 이미지는 영상의 첫 장면이라 움직이는 동안 작은 부분은 달라질 수 있어요.':'장면 이미지는 영상의 첫 장면이에요. 움직이는 동안 작은 부분은 달라질 수 있어요. 제품 · 로고 · 글자는 실제 파일을 얹고, 글자를 또렷이 읽어야 하는 컷은 멈춘 컷으로 잡아요.'}</p>
      <div class="sx-draft-decide"><p class="sx-small" data-decide-note>${esc(locked||'컷을 하나씩 보고 의견을 남겨 주세요.')}</p>${locked?'':`<button type="button" class="sx-go is-solid" data-draft-do="send" hidden><span>의견 보내기 <b class="sx-no" data-count>0</b></span>${arrow}</button><button type="button" class="sx-go is-solid" data-draft-do="approve"><span>${script?'이대로 장면 이미지 만들기':'이대로 제작 시작'}</span>${arrow}</button>`}</div>
    </aside>
    ${script?'':`<div class="sx-dr-bottom sx-draft-strip"><div class="sx-strip-run" data-strip role="listbox" aria-label="컷 목록">${d.cuts.map((cut,i)=>`<button type="button" class="sx-strip-cut ${i===0?'is-on':''}" role="option" aria-selected="${i===0?'true':'false'}" aria-label="${esc(cutName(i,cut))}" data-cut="${i}" data-w="${cut.seconds}">${cut.src?`<img src="${esc(cut.src)}" alt="" loading="lazy" decoding="async">`:''}<span class="sx-no sx-strip-no">${pad(i+1)}</span><i class="sx-strip-state" aria-hidden="true"></i></button>`).join('')}<i class="sx-strip-head" data-head aria-hidden="true"></i></div><p class="sx-no sx-strip-tc"><span data-tc>00:00.00</span> <span class="sx-small" data-tc-no>컷 01</span></p></div>`}
  </div>`;
}
// 컷마다 남긴 의견은 부른 쪽이 쥘 수 있게 state로 받는다(실시간 갱신으로 화면을 다시 그려도 잃지 않게).
export function mountDraft(root,d,{animate=true,state:kept,at:startAt=0,onChange,onBack,onApprove,onSend,onRecast}={}){
  const host=root.querySelector('.sx-draft'),$=selector=>host.querySelector(selector);
  const state=kept?.length===d.cuts.length?kept:d.cuts.map(()=>({react:'',note:''}));let at=Math.min(startAt,d.cuts.length-1),timer=0,nextTimer=0,playing=false,startTime=0;
  const cuts=[...host.querySelectorAll('.sx-strip-cut')],total=d.cuts.reduce((sum,cut)=>sum+cut.seconds,0),strip=$('.sx-draft-strip');
  cuts.forEach((el,i)=>{el.style.setProperty('--w',String(d.cuts[i].seconds));});
  if(animate){
    revealWords($('[data-draft-title]'),{delay:80,gap:36});
    riseAll(host.querySelectorAll('.sx-dr-box,.sx-sheet,.sx-dr-right'),{start:180,gap:60});
    riseAll(cuts,{start:240,gap:30,y:10});
  }
  const startOf=index=>d.cuts.slice(0,index).reduce((sum,cut)=>sum+cut.seconds,0);
  const fmt=value=>`${pad(Math.floor(value/60))}:${pad(Math.floor(value%60))}.${pad(Math.floor(value%1*100))}`;
  function moveHead(seconds){const head=$('[data-head]');head.style.setProperty('--x',String(seconds/total));}
  function show(index,{quick=false}={}){
    clearTimeout(nextTimer);at=index;const cut=d.cuts[index];
    const image=$('[data-frame]');if(image){image.hidden=!cut.src;if(cut.src)image.src=cut.src;}$('[data-cut-no]').textContent=pad(index+1);$('[data-cut-sec]').textContent=secs(cut.seconds);$('[data-cut-what]').textContent=cut.what;$('[data-cut-say]').textContent=cut.say||'없음';$('[data-cut-text]').textContent=cut.text||'없음';$('[data-tc-no]').textContent=`컷 ${pad(index+1)}`;$('[data-tc]').textContent=fmt(startOf(index));
    if(!quick&&image)play(image,[{opacity:.35},{opacity:1}],{duration:240});
    cuts.forEach((el,i)=>{el.classList.toggle('is-on',i===index);el.setAttribute('aria-selected',i===index?'true':'false');});
    // 페이지가 아니라 필름 띠만 옮긴다.
    const el=cuts[index],run=$('[data-strip]'),moveBy=reduced()||quick?'auto':'smooth';if(run.scrollWidth>run.clientWidth)run.scrollTo?.({left:el.offsetLeft-(run.clientWidth-el.offsetWidth)/2,behavior:moveBy});else if(run.scrollHeight>run.clientHeight)run.scrollTo?.({top:el.offsetTop-(run.clientHeight-el.offsetHeight)/2,behavior:moveBy});
    if(!playing)moveHead(startOf(index));
    syncReact();
  }
  // 고칠 곳을 적어 두면 주 단추가 「의견 보내기」로 바뀐다. 의견을 적어 둔 채 제작이 시작되는 일이 없게 한다.
  function syncReact(){
    cuts.forEach((el,i)=>{el.dataset.state=state[i].react;el.setAttribute('aria-label',cutName(i,d.cuts[i],state[i].react));});
    onChange?.(state,at);
    if(!$('.sx-react'))return;
    const s=state[at],script=d.cuts.every(cut=>!cut.src);
    host.querySelectorAll('.sx-react').forEach(el=>{const on=el.dataset.draftDo===s.react;el.classList.toggle('is-on',on);el.setAttribute('aria-pressed',on?'true':'false');});
    const box=$('[data-comment]'),input=$('[data-comment-input]');box.hidden=s.react!=='fix';if(input.value!==s.note)input.value=s.note;
    const fixes=state.filter(item=>item.react==='fix'),blank=fixes.filter(item=>!item.note.trim()).length,seen=state.filter(item=>item.react).length;
    $('[data-count]').textContent=fixes.length;$('[data-draft-do="send"]').hidden=!fixes.length;$('[data-draft-do="approve"]').hidden=!!fixes.length;
    $('[data-decide-note]').textContent=blank?`고칠 곳 ${fixes.length}개 중 ${blank}개가 비어 있어요. 무엇을 바꾸면 좋을지 적어 주세요.`:fixes.length?`고칠 곳 ${fixes.length}개를 모았어요. 보내 주시면 반영한 판을 다시 보여 드려요.`:seen===d.cuts.length?(script?'모든 컷을 확인하셨어요. 이대로 괜찮으면 장면 이미지를 만들어요.':'모든 컷을 확인하셨어요. 이대로 괜찮으면 제작을 시작해요.'):seen?`${d.cuts.length}컷 중 ${seen}컷을 확인하셨어요.`:'컷을 하나씩 보고 의견을 남겨 주세요.';
  }
  function stop(){clearTimeout(nextTimer);playing=false;delete host.dataset.playing;cancelAnimationFrame(timer);$('.sx-dr-play').classList.remove('is-playing');}
  function playAll(){
    if(playing){stop();return;}
    playing=true;host.dataset.playing='true';$('.sx-dr-play').classList.add('is-playing');
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
