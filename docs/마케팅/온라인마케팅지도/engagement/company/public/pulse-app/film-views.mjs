import {esc} from './api.mjs';
import {CASTING_MODELS} from './casting-catalog.mjs';
import {MODEL_LINES,MODEL_PICKS} from './request-data.mjs';
import {ROOM_STAGES,ROOM_COPY,CONFIRM_OF,modelCard} from './room-view.mjs';
import {FINISHED_FILMS} from './films-view.mjs';
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
  // tab 'contact'는 문의 화면(영상이 오기 전): 단계 줄은 지금 단계를, 아래 「담당자에게 묻기」를 지금 자리로 보인다.
  const at=ROOM_STAGES.findIndex(item=>item.id===p.stage),now=['draft','review','history','films'].includes(tab)?tab:p.stage,asking=tab==='contact';
  // 판이 오기 전의 1차안 칸은 지금 단계여도 열지 않는다(모델을 정하기 전에 글 콘티로 넘어가지 않게).
  const locked=(item,i)=>item.id==='draft'&&!p.hasRound||item.id!==now&&i>at;
  return `<nav class="sx-steps" aria-label="단계"><div class="sx-steps-run">${ROOM_STAGES.map((item,i)=>`<button type="button" class="sx-step ${item.id===now?'is-now':i<at?'is-done':''}" ${item.id===now&&!asking?'aria-current="page"':''} ${locked(item,i)?'disabled':''} data-room-go="${item.id}">${esc(item.name)}</button>`).join('')}</div><div class="sx-steps-foot sx-small">${p.films?`<button type="button" class="${tab==='films'?'is-now':''}" ${tab==='films'?'aria-current="page"':''} data-room-go="films">완성 광고</button>`:''}<button type="button" class="${asking?'is-now':''}" ${asking?'aria-current="page"':''} data-room-do="contact">담당자에게 묻기</button></div></nav>`;
}
// 오른쪽 스크린: 그 상태에 가장 알맞은 실제 자료. 손님 자료가 없을 때만 예시를 놓고 예시라고 쓴다.
function roomScreen(p){
  if(p.state==='prepare'&&p.direction?.chosen?.src)return `<img class="sx-q-fill" src="${esc(p.direction.chosen.src)}" alt="" decoding="async"><p class="sx-small sx-room-cap">고르신 방향 <b>${esc(p.direction.chosen.name)}</b></p>`;
  if(p.state==='model'&&p.proposal)return `<img class="sx-q-fill" src="${esc(modelScene(p.proposal.id))}" alt=""><p class="sx-small sx-room-cap"><b>${esc(p.proposal.name)}</b> ${esc(p.proposal.line)}</p><div class="sx-room-others" data-model-others hidden>${otherModels(p.proposal)}</div>`;
  if(p.film)return `<video class="sx-q-fill" src="${esc(p.film.src)}" muted loop playsinline preload="metadata" data-room-film aria-label="${esc(p.film.label)}"></video><button type="button" class="sx-room-play" data-room-go="${esc(p.film.go)}"><span class="sr">${esc(p.film.label)} 보기</span></button><p class="sx-small sx-room-cap">${esc(p.film.label)}</p>`;
  const cuts=p.draft?.cuts||[];
  const pictured=cuts.filter(cut=>cut.src);
  if(pictured.length)return `<div class="sx-room-cuts" data-count="${Math.min(pictured.length,12)}">${pictured.slice(0,12).map(cut=>`<img src="${esc(cut.src)}" alt="" loading="lazy" decoding="async">`).join('')}</div><p class="sx-small sx-room-cap">${esc(p.draft.round)}판 · ${cuts.length}컷. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.</p>`;
  if(cuts.length)return `<div class="sx-room-word"><p class="sx-serif">${esc(p.draft.oneLine)}</p><ol>${cuts.slice(0,4).map((cut,i)=>`<li><span class="sx-no">${pad(i+1)}</span><span class="sx-small">${esc(cut.what)}</span></li>`).join('')}</ol></div>`;
  if(p.files.length)return `<div class="sx-room-files" data-count="${Math.min(p.files.length,6)}">${p.files.slice(0,6).map(file=>`<img src="${esc(file.src)}" alt="" decoding="async">`).join('')}</div>`;
  const next=p.state==='make'?['w-gift','완성 영상의 예시예요. 「霜の肌理」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품']:['w-gift-snow','다음에 받으실 장면 이미지의 예시예요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.'];
  return `<img class="sx-q-fill" src="${ASSET}${next[0]}.webp" alt=""><p class="sx-small sx-room-cap">${esc(next[1])}</p>`;
}
// ── 방향과 모델(영상 전 확인 1/3, 2026-11-07) ──
// 시안 docs/마케팅/PULSE_방향제안_20261106/시안 그대로: 그림 둘이 양쪽 끝까지, 가운데 설명 한 장, 고른 쪽만 색. 휴대폰은 안내 → 두 그림 나란히 → 설명.
// 고객 방 틀(.sx-room) 안에 두고 아래 인화지 쪽은 고객 방과 같다. 비교 중인 안 · 모델 · 펼친 칸은 부른 쪽의 ui(실시간 다시 그리기에도 남는다)에 둔다.
const withRo=name=>{const last=String(name).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);const batchim=code>=0xAC00&&code<=0xD7A3?(code-0xAC00)%28:/[0-9]/.test(last)?('013678'.includes(last)?1:0):1;return batchim&&batchim!==8?'으로':'로';};
const PLAY_MARK='<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0.5 9.5 5 2 9.5z"/></svg>',STOP_MARK='<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8"/></svg>';
function dpDetail(o,on){
  return `<div class="sx-dp-detail" data-dp-detail="${esc(o.id)}" ${on?'':'hidden'}><h1 class="sx-serif sx-dp-title" tabindex="-1">${esc(o.name)}</h1><p class="sx-serif sx-dp-sentence">${esc(o.sentence)}</p><ol class="sx-dp-flow">${o.flow.map(line=>`<li><span class="sx-no">${esc(line.at)}</span><span class="sx-body">${esc(line.text)}</span></li>`).join('')}</ol>${o.why?`<p class="sx-small sx-dp-why">${esc(o.why)}</p>`:''}${o.film?`<button type="button" class="sx-dp-taste" data-dp-film="taste" aria-pressed="false"><span class="sx-dp-taste-mark">${PLAY_MARK}</span><span><b data-dp-taste-label>미리 움직여 보기</b><span class="sx-small">${esc(o.filmNote||'이 방향의 첫 판')} · 소리 있음</span></span></button>`:''}</div>`;
}
function dpModel(d,ui){
  // 모델 없는 의뢰(제품만)도 「비슷한 작품 보기」 자리는 둔다(11-07 검수).
  if(d.noModel)return '<div class="sx-dp-model sx-small"><span data-dp-work-slot></span></div>';
  const picks=[...new Set([d.model?.id,...(MODEL_PICKS[d.kind]||[])].filter(Boolean))].slice(0,4).map(id=>modelCard(id)).filter(Boolean);
  const now=modelCard(ui.modelId)||d.model;
  return `<div class="sx-dp-model sx-small"><p><span class="sx-dp-label">AI 모델</span><b data-dp-model-name>${esc(now?.name||'')}</b><button type="button" class="sx-link sx-dp-model-open" data-dp-do="casting" aria-expanded="${ui.casting?'true':'false'}">${ui.casting?'닫기':'다른 모델로'}</button></p><span data-dp-work-slot></span></div><div class="sx-dp-casts" role="group" aria-label="다른 모델 고르기" data-dp-casts ${ui.casting?'':'hidden'}>${picks.map(m=>`<button type="button" class="sx-dp-cast ${m.id===now?.id?'is-on':''}" aria-pressed="${m.id===now?.id?'true':'false'}" data-dp-model="${esc(m.id)}"><img src="${esc(modelScene(m.id))}" alt="" width="538" height="720" loading="lazy" decoding="async"><span class="sx-small">${esc(m.name)}</span></button>`).join('')}<p class="sx-small sx-dp-cast-note" data-dp-cast-note ${now?.id&&now.id!==d.model?.id?'':'hidden'}>이 모델로 바꿔 장면 이미지에서 보여 드려요.</p></div>`;
}
export function directionView(p,{top='',ui={}}={}){
  const d=p.direction,focus=d.options.some(o=>o.id===ui.focus)?ui.focus:(d.options.find(o=>o.recommended)||d.options[0]).id,view=ui.view==='neither'?'neither':'choose',item=d.options.find(o=>o.id===focus);
  const terms=`<dl class="sx-dp-kv"><div><dt class="sx-small">값</dt><dd class="sx-serif">${esc(d.price)}</dd></div><div><dt class="sx-small">받으실 날</dt><dd class="sx-serif">${esc(d.due)}</dd></div><div><dt class="sx-small">수정</dt><dd class="sx-serif">${esc(d.revisions)}회</dd></div></dl>`;
  return `<div class="sx-room is-direction" data-state="direction">
    <section class="sx-dp" data-count="${d.options.length}" data-view="${view}" data-dp>
      <div class="sx-dp-reel">${d.options.map((o,i)=>`<button type="button" class="sx-dp-frame" data-dp-frame="${esc(o.id)}" data-at="${i}" aria-pressed="${o.id===focus?'true':'false'}" aria-label="${esc(o.no)} ${esc(o.name)} 보기"><img src="${esc(o.src)}" alt="" decoding="async"><span class="sx-dp-frame-no sx-small"><span class="sx-no">${esc(o.no)}</span> ${esc(o.name)}</span></button>`).join('')}</div>
      <div class="sx-dp-sheet" aria-live="polite">
        ${top}
        <div class="sx-dp-top"><p class="sx-small"><b>${esc(d.title)}</b>${d.line?` · ${esc(d.line)}`:''}<span class="sx-dp-step">영상 전 확인 <b class="sx-no">1/3</b>${d.round>1?` · 다시 보내 드린 안`:''}</span></p>${d.lead?`<p class="sx-body sx-dp-lead">${esc(d.lead)}</p>`:''}</div>
        <div class="sx-dp-choose" ${view==='choose'?'':'hidden'}>
          <div class="sx-dp-tabs" role="group" aria-label="방향 고르기">${d.options.map(o=>`<button type="button" class="sx-dp-tab sx-small ${o.id===focus?'is-on':''}" aria-pressed="${o.id===focus?'true':'false'}" data-dp-pick="${esc(o.id)}"><span class="sx-no">${esc(o.no)}</span> ${esc(o.name)}${o.recommended?'<span class="sx-dp-rec"> · 추천</span>':''}</button>`).join('')}</div>
          ${d.options.map(o=>dpDetail(o,o.id===focus)).join('')}
          ${dpModel(d,ui)}
          <div class="sx-dp-terms">${terms}
            <p class="sx-small sx-dp-incl">어느 방향이든 값은 같고, 모델 · 목소리 · 음악 · 자막이 모두 들어 있어요. 결제는 글 콘티를 보신 뒤에 해요. <button type="button" class="sx-link" data-dp-do="more" aria-expanded="${ui.more?'true':'false'}">${ui.more?'접기':'자세히'}</button></p>
            <dl class="sx-dp-more sx-small" data-dp-more ${ui.more?'':'hidden'}><div><dt>만드는 법</dt><dd>사람과 목소리는 모두 AI로 만들어요. 제품 · 로고 · 글자는 보내 주신 파일을 그대로 얹어요. 지금 그림은 방향을 보여 드리는 첫 그림이에요</dd></div>${d.gets?`<div><dt>받으시는 것</dt><dd>${esc(d.gets)}</dd></div>`:''}<div><dt>쓸 수 있는 곳</dt><dd>온라인 광고 · SNS · 자사몰 · 상세페이지(음악 · 목소리 포함). TV · 옥외 · 극장 · 인쇄는 따로 여쭤 주세요</dd></div><div><dt>받으실 날</dt><dd>사진 · 로고 · 꼭 넣을 말이 다 모였을 때 기준이에요. 주말과 공휴일을 포함한 날이고, 확인이 늦어지면 그만큼 함께 미뤄요</dd></div><div><dt>수정</dt><dd>${d.photo?'사진':'영상'}이 나온 뒤 ${esc(d.revisions)}번. 글 콘티와 장면 이미지의 의견은 횟수에 세지 않아요</dd></div><div><dt>결제</dt><dd>글 콘티를 보신 뒤, 장면 이미지 전에 해요. 글 콘티까지는 값을 받지 않아요. 결제 방법은 그때 담당자가 안내해 드려요</dd></div></dl>
            <form class="sx-dp-answer" data-form="direction-pick"><input type="hidden" name="optionId" value="${esc(focus)}"><input type="hidden" name="modelId" value="${esc(ui.modelId||'')}"><label class="sx-dp-note" data-dp-note ${ui.note?'':'hidden'}><span class="sr">덧붙일 말</span><input type="text" name="note" maxlength="200" placeholder="예) 「쌉쌀」은 빼 주세요"></label><button type="submit" class="sx-go is-solid sx-dp-go" data-mutate><span data-dp-go>「${esc(item.name)}」${withRo(item.name)} 정하고 글 콘티 받기</span>${arrow}</button></form>
            <p class="sx-small sx-dp-foot"><button type="button" class="sx-link" data-dp-do="note" aria-expanded="${ui.note?'true':'false'}">한마디 덧붙이기</button><button type="button" class="sx-link" data-dp-do="neither">${d.options.length>2?'모두 아니에요':'둘 다 아니에요'}</button></p>
          </div>
        </div>
        <form class="sx-dp-neither" data-form="direction-neither" ${view==='neither'?'':'hidden'}><h1 class="sx-serif sx-dp-title" tabindex="-1">어떤 점이 아쉬웠나요?</h1><label class="sx-field sx-dp-say"><span class="sx-small">${d.last?'한 줄이면 돼요. 담당자가 직접 연락드려 함께 정해요.':'한 줄이면 돼요. 같은 값으로 한 번 더 제안해 드려요.'}</span><textarea name="note" rows="3" maxlength="300" required placeholder="예) 더 고급스러웠으면 좋겠어요"></textarea></label><button type="submit" class="sx-go is-solid sx-dp-go" data-mutate><span>${d.last?'담당자와 이야기하기':'다시 제안받기'}</span>${arrow}</button><p class="sx-small sx-dp-foot"><button type="button" class="sx-link" data-dp-do="back">${d.options.length>2?'안 다시 보기':'두 방향 다시 보기'}</button></p></form>
      </div>
    </section>
    <div class="sx-dp-rail">${roomRail(p)}</div>
    ${roomPaper(p)}
  </div>`;
}
export function mountDirection(root,d,{ui={},animate=true}={}){
  const host=root.querySelector('[data-dp]');if(!host)return {unmount(){}};
  const $=selector=>host.querySelector(selector),works=Object.fromEntries(FINISHED_FILMS.map(film=>[film.id,film]));
  let playing=null;
  if(!ui.focus||!d.options.some(o=>o.id===ui.focus))ui.focus=(d.options.find(o=>o.recommended)||d.options[0]).id;
  const workOf=o=>{const film=works[o.workId];return film?{src:film.excerpt?.src||film.full?.src||'',title:film.title}:null;};
  function stopFilm(){if(!playing)return;playing.video.pause?.();playing.video.remove();playing.cap.remove();const was=playing;playing=null;syncFilmButtons();return was;}
  function playFilm(kind){
    const o=d.options.find(item=>item.id===ui.focus),frame=host.querySelector(`[data-dp-frame="${CSS.escape(o.id)}"]`),work=workOf(o),taste=kind==='taste',src=taste?o.film:work?.src;if(!frame||!src)return;
    stopFilm();
    const video=document.createElement('video');video.className=`sx-dp-film${taste?' is-taste':''}`;video.src=src;video.playsInline=true;
    // 미리 움직여 보기는 손님이 누른 순간이라 소리를 켜고 한 번만, 끝나면 그림으로. 비슷한 작품은 소리 없이 되풀이.
    video.muted=!taste;video.loop=!taste;
    if(taste)video.addEventListener('ended',()=>{if(playing?.video===video)stopFilm();},{once:true});
    const cap=document.createElement('span');cap.className='sx-dp-film-cap sx-small';cap.textContent=taste?`미리 움직여 본 첫 판 · ${o.filmNote||''} · 소리 있음`.replace(' ·  ·',' ·'):`「${work.title}」 · 가상 브랜드로 만든 자체 작품`;
    frame.append(video,cap);playing={video,cap,kind};
    video.play?.().catch(()=>{video.muted=true;video.play?.().catch(()=>{});});
    syncFilmButtons();
  }
  function syncFilmButtons(){
    host.querySelectorAll('[data-dp-film]').forEach(button=>{const on=playing?.kind===button.dataset.dpFilm;button.setAttribute('aria-pressed',on?'true':'false');const mark=button.querySelector('.sx-dp-taste-mark');if(mark)mark.innerHTML=on?STOP_MARK:PLAY_MARK;const label=button.querySelector('[data-dp-taste-label]');if(label)label.textContent=on?'그림으로 돌아가기':'미리 움직여 보기';if(button.dataset.dpFilm==='work')button.textContent=on?'그림으로':'비슷한 작품 보기';});
  }
  function drawWork(){const o=d.options.find(item=>item.id===ui.focus),slot=$('[data-dp-work-slot]');if(slot)slot.innerHTML=workOf(o)?'<button type="button" class="sx-link" data-dp-film="work" aria-pressed="false">비슷한 작품 보기</button>':'';}
  function setFocus(id,{quiet=false}={}){
    if(!d.options.some(o=>o.id===id))return;
    stopFilm();ui.focus=id;const o=d.options.find(item=>item.id===id);
    host.querySelectorAll('[data-dp-frame]').forEach(frame=>frame.setAttribute('aria-pressed',frame.dataset.dpFrame===id?'true':'false'));
    host.querySelectorAll('[data-dp-pick]').forEach(tab=>{const on=tab.dataset.dpPick===id;tab.classList.toggle('is-on',on);tab.setAttribute('aria-pressed',on?'true':'false');});
    host.querySelectorAll('[data-dp-detail]').forEach(box=>{box.hidden=box.dataset.dpDetail!==id;});
    const form=$('[data-form="direction-pick"]');if(form){form.elements.optionId.value=id;$('[data-dp-go]').textContent=`「${o.name}」${withRo(o.name)} 정하고 글 콘티 받기`;}
    drawWork();
    const box=host.querySelector(`[data-dp-detail="${CSS.escape(id)}"]`);
    if(!quiet&&box&&!reduced())[...box.children].forEach((child,i)=>play(child,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:460,delay:i*36,fill:'backwards'}));
  }
  function setView(view){
    stopFilm();ui.view=view;host.dataset.view=view;$('.sx-dp-choose').hidden=view!=='choose';$('[data-form="direction-neither"]').hidden=view!=='neither';
    const target=view==='neither'?$('[data-form="direction-neither"] textarea'):host.querySelector(`[data-dp-detail="${CSS.escape(ui.focus)}"] .sx-dp-title`);
    target?.focus({preventScroll:true});
    // 휴대폰 · 세로 화면은 .sx-dp-sheet가 display:contents라 상자가 없다 — 지금 보이는 쪽(고르기 · 둘 다 아니에요)으로 간다(11-07 검수, film.css와 같은 조건).
    if(matchMedia?.('(max-width: 820px), (max-aspect-ratio: 1/1)').matches)(view==='neither'?$('[data-form="direction-neither"]'):$('.sx-dp-choose'))?.scrollIntoView?.({behavior:reduced()?'auto':'smooth',block:'start'});
  }
  const toggle=(key,box,button,[on,off])=>{ui[key]=!ui[key];box.hidden=!ui[key];button.setAttribute('aria-expanded',ui[key]?'true':'false');if(on)button.textContent=ui[key]?on:off;};
  host.addEventListener('click',event=>{
    const frame=event.target.closest('[data-dp-frame]');if(frame&&ui.view!=='neither'){setFocus(frame.dataset.dpFrame);return;}
    const pick=event.target.closest('[data-dp-pick]');if(pick){setFocus(pick.dataset.dpPick);return;}
    const model=event.target.closest('[data-dp-model]')?.dataset.dpModel;
    if(model){ui.modelId=model===d.model?.id?'':model;const card=modelCard(model);$('[data-dp-model-name]').textContent=card?.name||'';host.querySelectorAll('[data-dp-model]').forEach(button=>{const on=button.dataset.dpModel===model;button.classList.toggle('is-on',on);button.setAttribute('aria-pressed',on?'true':'false');});const note=$('[data-dp-cast-note]');if(note)note.hidden=!ui.modelId;$('[data-form="direction-pick"]').elements.modelId.value=ui.modelId;return;}
    const film=event.target.closest('[data-dp-film]')?.dataset.dpFilm;if(film){if(playing?.kind===film)stopFilm();else playFilm(film);return;}
    const what=event.target.closest('[data-dp-do]'),act=what?.dataset.dpDo;if(!act)return;
    if(act==='more')toggle('more',$('[data-dp-more]'),what,['접기','자세히']);
    if(act==='note'){toggle('note',$('[data-dp-note]'),what,[]);if(ui.note)$('[data-dp-note] input').focus({preventScroll:true});}
    if(act==='casting')toggle('casting',$('[data-dp-casts]'),what,['닫기','다른 모델로']);
    if(act==='neither')setView('neither');
    if(act==='back')setView('choose');
  });
  setFocus(ui.focus,{quiet:true});
  if(animate)riseAll(host.querySelectorAll('.sx-dp-frame,.sx-dp-top,.sx-dp-choose'),{start:120,gap:60});
  return {unmount(){stopFilm();}};
}
const otherModels=m=>`<div class="sx-wall is-plain">${CASTING_MODELS.filter(item=>item.id!==m.id).map(item=>`<button type="button" class="sx-cast" data-room-model="${item.id}" aria-label="${esc(item.name)} · ${esc(MODEL_LINES[item.id]?.line||item.description)} · 이 모델로 정하기"><img src="${esc(sceneOf(item))}" alt="" loading="lazy" decoding="async" width="538" height="720"><span class="sx-cast-name sx-small">${esc(item.name)}</span></button>`).join('')}</div>`;
export function roomView(p,{bar=true,top='',after='',foot=''}={}){
  const copy=copyOf(p),confirm=CONFIRM_OF[p.state];
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
        ${p.state==='prepare'&&p.direction?.chosen?chosenCard(p.direction):''}
        ${p.state==='ask'?askList(p):''}
        ${after}
        ${roomRail(p)}
      </div>
      <div class="sx-room-screen">${roomScreen(p)}</div>
    </section>
    ${foot?`<div class="sx-room-foot">${foot}</div>`:''}
    ${roomPaper(p)}
  </div>`;
}
// 아래 인화지 쪽: 보내 주신 의뢰서 · 받은 자료. 고객 방과 방향 화면이 같이 쓴다.
function roomPaper(p){
  return `<section class="sx-room-paper" data-room-in data-room-brief>
      <div class="sx-room-doc"><h2 class="sx-serif">보내 주신 의뢰서</h2><dl class="sx-kv">${p.brief.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${p.canEdit?'<button type="button" class="sx-small sx-link" data-room-do="edit">고치기</button>':''}</div>
      <div class="sx-room-doc"><h2 class="sx-serif">받은 자료 <span class="sx-no">${p.files.length+(p.others?.length||0)}</span></h2><div class="sx-contact">${p.files.map(file=>`<figure><img src="${esc(file.src)}" alt="" loading="lazy" decoding="async"><figcaption class="sx-small">${esc(file.label)}</figcaption></figure>`).join('')}</div>${p.others?.length?`<ul class="sx-room-others-list">${p.others.map(name=>`<li class="sx-small">${esc(name)}</li>`).join('')}</ul>`:''}<label class="sx-small sx-link sx-room-more"><input type="file" class="sr" multiple data-room-file>자료 더 보내기</label></div>
    </section>`;
}
// 그 상태의 왼쪽 글. 방향을 고른 뒤 · 두 번째 제안도 거절한 뒤는 글이 다르다.
function copyOf(p){
  if(p.state==='prepare'&&p.direction?.chosen)return {turn:'us',title:'이 방향으로 정했어요',text:'광고가 남길 한 문장과 글 콘티를 만들어 보내 드려요. 보시고 마음에 드시면 그때 결제를 안내해 드려요.'};
  if(p.state==='redirect'&&p.direction?.last)return {turn:'us',title:'담당자가 직접 연락드려요',text:'주신 말씀을 들고 담당자가 연락드려 함께 정해요. 정해지면 글 콘티를 보내 드려요.'};
  return ROOM_COPY[p.state]||ROOM_COPY.check;
}
// 고른 방향: 이름 · 한 문장 · 값 · 받으실 날 · 수정 · 다음 길. 판이 오기 전까지 다시 고를 수 있다.
function chosenCard(d){
  const o=d.chosen;
  return `<section class="sx-dp-chosen" data-room-in><p class="sx-small">고르신 방향${d.status==='settled'?' · 담당자와 정함':''}</p><h2 class="sx-serif">${esc(o.name)}</h2><p class="sx-body">${esc(o.sentence)}</p>${d.note?`<p class="sx-small">덧붙이신 말: ${esc(d.note)}</p>`:''}<dl class="sx-dp-kv"><div><dt class="sx-small">값</dt><dd class="sx-serif">${esc(d.price)}</dd></div><div><dt class="sx-small">받으실 날</dt><dd class="sx-serif">${esc(d.due)}</dd></div><div><dt class="sx-small">수정</dt><dd class="sx-serif">${esc(d.revisions)}회</dd></div></dl><ol class="sx-dp-road sx-small"><li class="is-done">방향</li><li class="is-now">글 콘티</li><li>장면 이미지</li><li>영상</li></ol>${d.canPick?'<button type="button" class="sx-small sx-link" data-room-go="pick">다시 고르기</button>':''}</section>`;
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
  return `<figure class="sx-dr-films sx-sheet-room"><div class="sx-sheet"><header class="sx-sheet-head"><span class="sx-small">글 콘티 ${esc(d.round)}판</span><span class="sx-small"><span class="sx-no">${d.cuts.length}</span>컷 · <span class="sx-no">${total.toFixed(1)}</span>초 · <span class="sx-no">${esc(d.ratio||'9:16')}</span></span></header><div class="sx-sheet-rows" data-strip role="listbox" aria-label="컷 목록">${rows}<i class="sx-strip-head" data-head hidden></i></div><footer class="sx-sheet-foot"><p class="sx-no sx-strip-tc"><span data-tc>00:00.00</span> <span class="sx-small" data-tc-no>컷 01</span></p></footer></div></figure>`;
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
      <p class="sx-small sx-draft-warn">${script?'글이 맞으면 컷마다 장면 이미지를 만들어 보여 드려요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.':'장면 이미지는 그 컷의 첫 화면이에요. 움직이는 동안 작은 부분은 달라질 수 있어요. 제품 · 로고 · 글자는 실제 파일을 얹고, 글자를 또렷이 읽어야 하는 컷은 멈춘 컷으로 잡아요.'}</p>
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
  function stop(){clearTimeout(nextTimer);playing=false;delete host.dataset.playing;cancelAnimationFrame(timer);$('.sx-dr-play')?.classList.remove('is-playing');}
  function playAll(){
    if(playing){stop();return;}
    if(!$('.sx-dr-play'))return;
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
