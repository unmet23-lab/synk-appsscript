import {esc,stamp} from './api.mjs';
import {t,k} from './i18n.mjs';
import {CASTING_MODELS,modelLooks} from './casting-catalog.mjs';
import {MODEL_LINES,MODEL_PICKS,sceneSet} from './request-data.mjs';
import {ROOM_STAGES,ROOM_COPY,CONFIRM_OF,modelCard,roomTab,lookOf,lookLine} from './room-view.mjs';
import {FINISHED_FILMS,filmNote,filmTitle} from './films-view.mjs';
import {revealWords,riseAll,rise,play,reduced} from './motion.mjs';
import {arrow} from './film-home.mjs';
import {holdPoster} from './film-review.mjs';
import {personaCopy,personaCard,personaLine,personaScreen,personaKeep,personaReuseLine,personaRemovedLine} from './persona-view.mjs';
export {entryView,mountEntry} from './film-home.mjs';

// 시사실 판의 고객 화면(2026-11-05): 고객 방, 1차안. 자료 모양은 room-view.mjs가 프로젝트에서 옮겨 준다. 판단은 거기 있고 여기는 그리기만 한다.
const ASSET='./assets/request/';
const pad=(value,size=2)=>String(value).padStart(size,'0');
const secs=value=>t('{sec}초',{sec:Number(value).toFixed(value%1?2:0)});
const cutName=(index,cut,react='',photo=false)=>{const vars={n:index+1,sec:cut.seconds.toFixed(1)};if(photo)return react==='ok'?t('{n}번째 장, 좋아요',vars):react==='fix'?t('{n}번째 장, 고칠 곳 있음',vars):t('{n}번째 장',vars);return react==='ok'?t('{n}번 컷, {sec}초, 좋아요',vars):react==='fix'?t('{n}번 컷, {sec}초, 고칠 곳 있음',vars):t('{n}번 컷, {sec}초',vars);};
const modelScene=id=>`${ASSET}model-scene-${String(id).toLowerCase()}.webp`;
// 고객 방 큰 스크린의 장면 사진(11-13): 화소비가 높은 큰 화면만 큰 판(폭 1600)을 받는다. sizes = cover로 그려지는 폭 ÷ 1.47 —
// 넓은 창은 스크린 폭(창의 54%)과 창 높이 × 0.805(사진 비율) 가운데 큰 쪽, 세로 창(820px 이하 · 정사각보다 좁음)은 창 폭과 32vh × 0.805 가운데 큰 쪽.
// 큰 판으로도 모자란 화면(5K 같은)과 스크린의 다른 그림(예시 그림 · 받은 자료 · 소식 그림)은 data-cap이 칸을 실제 화소의 1.47배 안으로 줄인다(api.mjs capPixels).
export const ROOM_SCENE_SIZES='(max-width:820px) max(68.1vw,17.6vh), (max-aspect-ratio:1/1) max(68.1vw,17.6vh), max(36.8vw,54.8vh)';
const roomScene=src=>{const set=sceneSet(src);return `<img class="sx-q-fill" src="${esc(src)}"${set?` srcset="${esc(set)}" sizes="${ROOM_SCENE_SIZES}"`:''} data-cap alt="">`;};
const sceneOf=item=>item.photos?.find(photo=>photo.kind==='scene')?.src||item.image;
// 모델 이름 · 한 줄은 카탈로그 한국어를 그리는 자리에서 번역한다.
const nameOf=name=>t(name,null,'model');
// 단계 이름(단계 문맥 — 의뢰서 칸 이름 「확인」과 영어가 갈린다).
const stageName=(id,photo=false)=>({request:t('의뢰서',null,'stage'),check:t('확인',null,'stage'),draft:t('1차안',null,'stage'),make:t('제작',null,'stage'),review:photo?t('사진 · 납품',null,'stage'):t('영상 · 납품',null,'stage')})[id]||'';
// 번역문 안의 자리표에 마크업을 넣는다: 번역문 전체를 먼저 이스케이프하고 자리표만 바꾼다(마크업은 자리표 밖 — 글은 늘 이스케이프된다).
const withMarks=(text,marks)=>Object.entries(marks).reduce((html,[name,mark])=>html.split(`{${name}}`).join(mark),esc(text));

// ── 고객 방 ──
// 단계 낱말 줄(판 3, 11-08): 앱 머리에 하나만 둔다. 지금 단계까지만 열리고, 완성 광고는 줄 끝에.
export function roomRail(p,{tab='overview'}={}){
  const at=ROOM_STAGES.findIndex(item=>item.id===p.stage),view=roomTab(tab),now=['draft','review','films'].includes(view)?view:p.stage,away=view==='films';
  // 판이 오기 전의 1차안 칸은 지금 단계여도 열지 않는다(모델을 정하기 전에 글 콘티로 넘어가지 않게).
  const locked=(item,i)=>item.id==='draft'&&!p.hasRound||item.id!==now&&i>at;
  return `<nav class="sx-steps sx-head-steps" aria-label="${esc(t('단계'))}"><div class="sx-steps-run">${ROOM_STAGES.map((item,i)=>`<button type="button" class="sx-step ${item.id===now?'is-now':i<at?'is-done':''}" ${item.id===now&&!away?'aria-current="page"':''} ${locked(item,i)?'disabled':''} data-room-go="${item.id}">${esc(stageName(item.id,p.photo))}</button>`).join('')}</div>${p.films?`<div class="sx-steps-foot sx-small"><button type="button" class="${view==='films'?'is-now':''}" ${view==='films'?'aria-current="page"':''} data-room-go="films">${esc(t('완성 광고'))}</button></div>`:''}</nav>`;
}
// 머리 하나: 프로젝트 이름(누르면 고객 방) · 접수 번호 · 단계 줄. 앱에서는 앱 머리 칸에, 예시에서는 화면 안 머리에 같은 마크업을 그린다.
// 언어 메뉴(다국어 판 2)는 이 가운데 칸에 두지 않는다 — 앱 머리 오른쪽 끝(views.mjs header)에 하나만 선다(같은 머리에 둘이 서지 않게).
// 가운데 칸은 넓이가 모자라면 끝이 잘리는 칸이라(overflow hidden) 821~1000 영어에서 메뉴가 잘렸다. 예시 머리(exampleHead)에는 메뉴가 없다(체험은 한국어로만).
export function roomHead(p,{tab='overview'}={}){
  return `<button type="button" class="sx-head-title" data-room-go="room" title="${esc(t('고객 방으로'))}"><b class="crumb-title">${esc(p.title)}</b></button>${p.number?`<span class="crumb-no mono">${esc(p.number)}</span>`:''}<i class="sx-head-break" aria-hidden="true"></i>${roomRail(p,{tab})}`;
}
export const exampleHead=(p,{tab='overview'}={})=>`<header class="sx-room-bar is-head"><a class="sx-logo" href="./" aria-label="${esc(t('SYNK PULSE 처음으로'))}"><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="164" height="44"></a><div class="header-crumb">${roomHead(p,{tab})}</div><div class="header-actions"><button type="button" class="sx-head-ask" data-room-do="journal" aria-controls="room-journal">${esc(t('나눈 말'))}</button></div></header>`;
// ── 일지(판 3b) ──
// 한 화면에 하나만 그린다. 자리는 data-place와 CSS가 정한다: column(방 — 늘 흐름 안), side(1차안 · 영상 — 넓은 화면은 왼쪽 단, 휴대폰은 아래 시트),
// drawer(방향 · 완성 광고 — 넓은 화면은 오른쪽 서랍, 휴대폰은 아래 시트). 열고 닫기 · 「봤다」는 app.mjs가 맡는다.
export const JOURNAL_SHOWN=5;
const askForm=ask=>`<form class="sx-ask-reply" data-form="ask" data-id="${esc(ask.id||'')}"><textarea name="text" rows="1" maxlength="1000" placeholder="${esc(t('글로 답하거나 파일을 보내 주세요'))}" aria-label="${esc(t('{label} 답',{label:ask.label}))}"></textarea><div class="sx-ask-tools"><label class="sx-quiet"><input type="file" class="sr" name="file" data-ask-file><span data-ask-name>${esc(t('파일 고르기'))}</span></label><button type="submit" class="sx-go" data-mutate><span>${esc(t('보내기',null,'send'))}</span>${arrow}</button></div></form>`;
// talk(「말만 보기」 — 운영 조각 4 · 설계 S1): 켜면 말 줄(문의 · 답 · 담당자 글)만 보인다 — 사건 · 소식 줄이 늘어도 문답이 묻히지 않게. 말 줄과 다른 줄이 함께 있을 때만 단추를 둔다.
export function journalView(j,{place='column',here=null,video=false,photo=false,open=false,all=false,talk=false,owner=t('담당자')}={}){
  const overlay=place!=='column',isHere=go=>!!go&&!!here&&go.tab===here.tab&&(!go.versionId||go.versionId===here.versionId||!!go.final&&!!here.finals);
  const when=at=>at&&stamp(at)?` · <time datetime="${esc(at)}">${esc(stamp(at))}</time>`:'';
  // 「열기」 · 「이 화면」은 머리 줄 끝에. 지금 화면의 일감을 가리키는 인용은 그 글이 바로 옆에 있으니 머리 줄만 둔다(같은 말이 한 화면에 두 번 서지 않게).
  // 최종본을 볼 때는 납품 칸이 최종본 모두와 안내를 보이므로 최종본 줄은 모두 「지금 화면」. 서랍은 일감을 덮으므로 인용 글을 그대로 둔다.
  const row=item=>{
    const here=isHere(item.go),tail=item.go?(here?`<span class="sx-j-here">${esc(t('지금 화면'))}</span>`:`<button type="button" class="sx-quiet" data-journal-go="${esc(item.go.tab)}"${item.go.versionId?` data-version="${esc(item.go.versionId)}"`:''}>${esc(t('열기',null,'open'))}</button>`):'';
    const meta=`<p class="sx-j-meta"><b>${esc(item.name)}</b>${item.what?` ${esc(item.what)}`:''}${item.kind==='progress'&&stageName(item.stage)?` · ${esc(stageName(item.stage,j.photo))}`:''}${when(item.at)}</p>`;
    // 작업 소식(운영 조각 4): 글 전문 + 그림 넷까지, 그림 아래 「작업 중인 화면이에요 · 완성본이 아니에요」.
    const shots=item.kind==='progress'&&item.pictures?.length?`<figure class="sx-j-shots" data-count="${item.pictures.length}"><div>${item.pictures.map(src=>`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`).join('')}</div><figcaption class="sx-small sx-j-wip">${esc(t('작업 중인 화면이에요 · 완성본이 아니에요'))}</figcaption></figure>`:'';
    const body=(item.kind==='talk'||item.kind==='progress')&&item.text?`<p class="sx-body sx-j-text">${esc(item.text)}</p>${shots}`:item.kind==='quote'&&(!here||place==='drawer')?`<p class="sx-j-quote">${esc(item.text)}</p>`:shots;
    return `<li class="sx-j-row is-${esc(item.kind)}${tail?' has-tail':''}" data-who="${esc(item.who)}" data-journal-id="${esc(item.id)}" tabindex="-1">${meta}${tail}${body}</li>`;
  };
  const asks=j.pinned.asks.map(ask=>`<section class="sx-j-ask" data-journal-id="a:${esc(ask.id)}" tabindex="-1"><p class="sx-j-meta"><b>${esc(owner)}</b> ${esc(t('물어봐요'))}${when(ask.at)}</p><h3 class="sx-serif">${esc(ask.label)}</h3>${ask.why?`<p class="sx-j-why">${esc(ask.why)}</p>`:''}${askForm(ask)}</section>`).join('');
  const talks=j.items.filter(item=>item.kind==='talk'),filter=talk||talks.length>0&&talks.length<j.items.length,items=talk?talks:j.items;
  const shown=all?items:items.slice(0,JOURNAL_SHOWN),rest=items.length-JOURNAL_SHOWN;
  return `${overlay?`<div class="sx-j-scrim" data-journal-do="close" data-place="${esc(place)}"${open?'':' hidden'}></div>`:''}<aside class="sx-journal${open?' is-open':''}" id="room-journal" data-journal data-place="${esc(place)}" aria-labelledby="room-journal-title"${place==='drawer'?' role="dialog"':''}>
    <header class="sx-j-head"><h2 class="sx-serif" id="room-journal-title">${esc(t('담당자와 나눈 말'))}</h2>${overlay?`<button type="button" class="sx-quiet sx-j-close" data-journal-do="close">${esc(t('닫기'))}</button>`:''}</header>
    ${asks?`<div class="sx-j-pin" aria-label="${esc(t('답해 주실 것'))}">${asks}</div>`:''}
    ${j.pinned.next?`<p class="sx-j-next"><span>${esc(t('지금 담당자 안내'))}</span>${esc(j.pinned.next)}</p>`:''}
    <form class="sx-j-say" data-form="support"><textarea name="text" rows="1" maxlength="3000" required placeholder="${esc(t('담당자에게 물어보세요'))}" aria-label="${esc(t('담당자에게 물어보기'))}" data-grow></textarea><button type="submit" class="sx-go" data-mutate><span>${esc(t('보내기',null,'send'))}</span>${arrow}</button>${video?`<p class="sx-j-hint" data-when="typing">${photo?withMarks(t('사진에서 고칠 곳은 {where} 의견 칸에 남겨 주세요.'),{where:`<span class="is-wide">${esc(t('오른쪽',null,'where'))}</span><span class="is-phone">${esc(t('사진 아래',null,'where'))}</span>`}):withMarks(t('영상에서 고칠 곳은 {where} 의견 칸에, 그 장면에서 남겨 주세요.'),{where:`<span class="is-wide">${esc(t('오른쪽',null,'where'))}</span><span class="is-phone">${esc(t('영상 아래',null,'where'))}</span>`})}</p>`:''}</form>
    ${filter?`<p class="sx-j-tools"><button type="button" class="sx-quiet sx-j-filter" data-journal-do="talk" aria-pressed="${talk?'true':'false'}">${esc(t('말만 보기'))}</button></p>`:''}
    ${items.length?`<ol class="sx-j-list" aria-label="${esc(t('지난 말'))}">${shown.map(row).join('')}</ol>`:talk?`<p class="sx-small sx-j-empty">${esc(t('나눈 말이 아직 없어요'))}</p>`:''}
    ${rest>0?`<button type="button" class="sx-quiet sx-j-more" data-journal-do="more" aria-expanded="${all?'true':'false'}">${esc(all?t('최근 말만 보기'):t('이전 말 {count}개 더 보기',{count:rest}))}</button>`:''}
  </aside>`;
}
// 서랍 · 시트로 뜨는가: 방향 · 완성 광고는 늘, 1차안 · 영상은 휴대폰 · 세로 화면에서만. 방은 늘 흐름 안.
export const JOURNAL_SHEET='(max-width: 820px), (max-aspect-ratio: 1/1)';
export const journalOverlay=box=>!!box&&(box.dataset.place==='drawer'||box.dataset.place==='side'&&!!globalThis.matchMedia?.(JOURNAL_SHEET)?.matches);
// 연 상태를 그린다(가림막 · 문서 잠금 · 여는 단추의 aria-expanded). 열 때 초점은 일지 제목으로 — 묻기 칸에 바로 두면 휴대폰 자판이 줄기를 덮고, 영상 화면에서는 멈춘 그림이 풀린다.
export function journalSetOpen(root,on){
  const box=root.querySelector('[data-journal]'),overlay=journalOverlay(box),modal=!!on&&overlay;
  box?.classList.toggle('is-open',!!on);root.querySelectorAll('.sx-j-scrim').forEach(node=>{node.hidden=!on;});
  document.documentElement.classList.toggle('has-journal-open',modal);
  document.querySelectorAll('[data-room-do="journal"][aria-controls]').forEach(button=>{if(overlay)button.setAttribute('aria-expanded',on?'true':'false');else button.removeAttribute('aria-expanded');});
  // 떠 있는 동안은 대화상자다: 뒤 내용(머리 · 고르기 단추 …)에는 초점 · 화면 읽기가 닿지 않게 inert(의뢰서 덮개와 같은 방식), 닫으면 푼다.
  // 가림막(누르면 닫힘) · 알림 토스트 · 대화상자(<dialog>는 열릴 때 스스로 뒤를 잠근다)는 남긴다.
  journalRelease();
  if(box){
    if(modal){box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');for(let at=box;at?.parentElement&&at!==document.body;at=at.parentElement)for(const node of at.parentElement.children)if(node!==at&&!node.inert&&!node.matches('.sx-j-scrim,.notice,#notice,dialog,script,style,link')){node.inert=true;node.setAttribute('data-journal-inert','');}}
    else{box.removeAttribute('aria-modal');if(box.dataset.place!=='drawer')box.removeAttribute('role');}
  }
  return box;
}
export function journalRelease(){for(const node of document.querySelectorAll('[data-journal-inert]')){node.inert=false;node.removeAttribute('data-journal-inert');}}
export const journalFocus=box=>{const title=box?.querySelector('#room-journal-title');if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}};
// 휴대폰에서만 보이는 「담당자에게 묻기」(넓은 화면은 같은 화면 왼쪽에 일지가 있다). 시트를 연다.
export const journalAsk=(cls='')=>`<button type="button" class="sx-quiet sx-j-ask-open ${cls}" data-room-do="journal">${esc(t('담당자에게 묻기'))}</button>`;
// 오른쪽 스크린: 그 상태에 가장 알맞은 실제 자료. 손님 자료가 없을 때만 예시를 놓고 예시라고 쓴다.
// news: 맞춤 인물 카드가 「지금 차례」인 방(머리 「내 차례」)에서는 인물 그림이 없을 때 이리 떨어져도 소식 그림을 띄우지 않는다(운영 조각 4 화면 검수 F2).
function roomScreen(p,{news=true}={}){
  // 저희 차례에 담당자가 올린 작업 소식 그림(운영 조각 4): 예시 · 지난 판 그림보다 앞에, 완성본이 아니라는 말과 함께. 「소식 보기」는 일지의 그 줄로.
  if(news&&p.news?.pictures?.length){const pics=p.news.pictures;return `${pics.length===1?`<img class="sx-q-fill" src="${esc(pics[0])}" data-cap alt="" decoding="async">`:`<div class="sx-room-files" data-count="${pics.length}">${pics.map(src=>`<img src="${esc(src)}" data-cap alt="" decoding="async">`).join('')}</div>`}<p class="sx-small sx-room-cap"><b>${esc(t('작업 중인 화면이에요 · 완성본이 아니에요'))}</b> <button type="button" class="sx-link" data-room-do="journal" data-journal-target="n:${esc(p.news.id)}">${esc(t('소식 보기'))}</button></p>`;}
  if(p.state==='prepare'&&p.direction?.chosen?.src)return `<img class="sx-q-fill" src="${esc(p.direction.chosen.src)}" data-cap alt="" decoding="async"><p class="sx-small sx-room-cap">${esc(t('고르신 방향'))} <b>${esc(p.direction.chosen.name)}</b></p>`;
  if(p.state==='model'&&p.proposal)return `${roomScene(modelScene(p.proposal.id))}<p class="sx-small sx-room-cap"><b>${esc(nameOf(p.proposal.name))}</b> ${esc(t(p.proposal.line))}</p><div class="sx-room-others" data-model-others hidden>${otherModels(p.proposal)}</div>`;
  if(p.film)return `<video class="sx-q-fill" src="${esc(p.film.src)}" muted loop playsinline preload="metadata" data-room-film aria-label="${esc(p.film.label)}"></video><button type="button" class="sx-room-play" data-room-go="${esc(p.film.go)}"><span class="sr">${esc(t('{label} 보기',{label:p.film.label}))}</span></button><p class="sx-small sx-room-cap">${esc(p.film.label)}</p>`;
  // 사진 상품(2026-11-12): 도착한 사진 · 완성 사진을 그대로 건다(영상 상품이 도착한 영상을 트는 자리) — 저희 작품의 예시 대신 손님 사진. 누르면 사진 확인 화면으로.
  if(p.shots?.length)return `<div class="sx-room-files is-shots" data-count="${Math.min(p.shots.length,6)}">${p.shots.slice(0,6).map(shot=>`<img src="${esc(shot.src)}" data-cap alt="${esc(shot.label)}" decoding="async">`).join('')}</div><button type="button" class="sx-room-play" data-room-go="review"><span class="sr">${esc(t('사진 보기'))}</span></button><p class="sx-small sx-room-cap">${esc(p.shots.length>1?t('완성 사진 {count}장',{count:p.shots.length}):p.shots[0].label)}</p>`;
  const cuts=p.draft?.cuts||[];
  const pictured=cuts.filter(cut=>cut.src);
  if(pictured.length)return `<div class="sx-room-cuts" data-count="${Math.min(pictured.length,12)}">${pictured.slice(0,12).map(cut=>`<img src="${esc(cut.src)}" alt="" loading="lazy" decoding="async">`).join('')}</div><p class="sx-small sx-room-cap">${esc(p.photo?t('첫 장 {round}판 · {count}장',{round:String(p.draft.round),count:cuts.length}):t('{round}판 · {count}컷. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.',{round:String(p.draft.round),count:cuts.length}))}</p>`;
  if(cuts.length)return `<div class="sx-room-word"><p class="sx-serif">${esc(p.draft.oneLine)}</p><ol>${cuts.slice(0,4).map((cut,i)=>`<li><span class="sx-no">${pad(i+1)}</span><span class="sx-small">${esc(cut.what)}</span></li>`).join('')}</ol></div>`;
  if(p.files.length)return `<div class="sx-room-files" data-count="${Math.min(p.files.length,6)}">${p.files.slice(0,6).map(file=>`<img src="${esc(file.src)}" data-cap alt="" decoding="async">`).join('')}</div>`;
  // 사진 상품에는 영상 · 장면 이미지를 받는다고 말하지 않는다 — 같은 그림을 저희 작품의 한 장면으로만 소개한다.
  const own=k('저희가 만든 광고의 한 장면이에요. 「霜の肌理」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품');
  const next=['make','review','deliver','done'].includes(p.state)?['w-gift',p.photo?own:k('완성 영상의 예시예요. 「霜の肌理」 홀리데이 기프트 · 가상 브랜드로 만든 자체 작품')]:['w-gift-snow',p.photo?own:k('다음에 받으실 장면 이미지의 예시예요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.')];
  return `<img class="sx-q-fill" src="${ASSET}${next[0]}.webp" data-cap alt=""><p class="sx-small sx-room-cap">${esc(t(next[1]))}</p>`;
}
// ── 방향과 모델(영상 전 확인 1/3, 2026-11-07) ──
// 시안 docs/마케팅/PULSE_방향제안_20261106/시안 그대로: 그림 둘이 양쪽 끝까지, 가운데 설명 한 장, 고른 쪽만 색. 휴대폰은 안내 → 두 그림 나란히 → 설명.
// 고객 방 틀(.sx-room) 안에 두고 아래 인화지 쪽은 고객 방과 같다. 비교 중인 안 · 모델 · 펼친 칸은 부른 쪽의 ui(실시간 다시 그리기에도 남는다)에 둔다.
// 조사 도우미(한국어 문장에만 — 다른 언어 사전은 그 자리표를 쓰지 않는다).
const withRo=name=>{const last=String(name).trim().replace(/[^0-9A-Za-z가-힣]+$/,'').slice(-1),code=last.charCodeAt(0);const batchim=code>=0xAC00&&code<=0xD7A3?(code-0xAC00)%28:/[0-9]/.test(last)?('013678'.includes(last)?1:0):1;return batchim&&batchim!==8?'으로':'로';}; // i18n-skip
// 고르는 단추 글: 「아니, 잠깐」으로 정하고 글 콘티 받기.
const goLabel=name=>t('「{name}」{ro} 정하고 글 콘티 받기',{name,ro:withRo(name)});
// 값 · 받으실 날 · 수정(방향 화면과 고른 방향 칸이 같이 쓴다).
const termsOf=d=>`<dl class="sx-dp-kv${d.queued?' is-queued':''}"><div><dt class="sx-small">${esc(t('값'))}</dt><dd class="sx-serif">${esc(d.price)}</dd></div><div><dt class="sx-small">${esc(t('받으실 날'))}</dt><dd class="sx-serif">${esc(d.due)}</dd></div><div><dt class="sx-small">${esc(t('수정'))}</dt><dd class="sx-serif">${esc(t('{count}회',{count:d.revisions},'revisions'))}</dd></div></dl>${d.seatNote?`<p class="sx-small sx-dp-seat">${esc(t('제작 자리가 차 있어 결제 안내는 자리가 나는 대로 드려요.'))}</p>`:''}`;
const PLAY_MARK='<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0.5 9.5 5 2 9.5z"/></svg>',STOP_MARK='<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8"/></svg>';
function dpDetail(o,on){
  return `<div class="sx-dp-detail" data-dp-detail="${esc(o.id)}" ${on?'':'hidden'}><h1 class="sx-serif sx-dp-title" tabindex="-1">${esc(o.name)}</h1><p class="sx-serif sx-dp-sentence">${esc(o.sentence)}</p><ol class="sx-dp-flow">${o.flow.map(line=>`<li><span class="sx-no">${esc(line.at)}</span><span class="sx-body">${esc(line.text)}</span></li>`).join('')}</ol>${o.why?`<p class="sx-small sx-dp-why">${esc(o.why)}</p>`:''}${o.film?`<button type="button" class="sx-dp-taste" data-dp-film="taste" aria-pressed="false"><span class="sx-dp-taste-mark">${PLAY_MARK}</span><span><b data-dp-taste-label>${esc(t('미리 움직여 보기'))}</b><span class="sx-small">${esc(t('{note} · 소리 있음',{note:o.filmNote||t('이 방향의 첫 판')}))}</span></span></button>`:''}</div>`;
}
function dpModel(d,ui){
  // 모델 없는 의뢰(제품만)도 「비슷한 작품 보기」 자리는 둔다(11-07 검수).
  if(d.noModel)return '<div class="sx-dp-model sx-small"><span data-dp-work-slot></span></div>';
  const picks=[...new Set([d.model?.id,...(MODEL_PICKS[d.kind]||[])].filter(Boolean))].slice(0,4).map(id=>modelCard(id)).filter(Boolean);
  const now=modelCard(ui.modelId)||d.model;
  // 얼굴 줄(판 3): 후보 넷을 작은 얼굴로 늘 보이고, 큰 사진은 「크게 보기」로 접어 둔다. 단추 값은 큰 사진과 같다.
  const face=m=>`<button type="button" class="sx-dp-face ${m.id===now?.id?'is-on':''}" aria-pressed="${m.id===now?.id?'true':'false'}" data-dp-model="${esc(m.id)}" aria-label="${esc(nameOf(m.name))}"><img src="${esc(m.image)}" alt="" width="44" height="44" loading="lazy" decoding="async"></button>`;
  return `<div class="sx-dp-model sx-small"><p><span class="sx-dp-label">${esc(t('AI 모델'))}</span><b data-dp-model-name>${esc(now?.name?nameOf(now.name):'')}</b></p>${picks.length>1?`<div class="sx-dp-faces" role="group" aria-label="${esc(t('모델 고르기'))}"><span class="sx-dp-label">${esc(t('다른 모델'))}</span>${picks.map(face).join('')}<button type="button" class="sx-quiet sx-dp-model-open" data-dp-do="casting" aria-expanded="${ui.casting?'true':'false'}">${esc(ui.casting?t('접기'):t('크게 보기'))}</button></div>`:''}<span data-dp-work-slot></span></div><div class="sx-dp-casts" role="group" aria-label="${esc(t('다른 모델 고르기'))}" data-dp-casts ${ui.casting?'':'hidden'}>${picks.map(m=>`<button type="button" class="sx-dp-cast ${m.id===now?.id?'is-on':''}" aria-pressed="${m.id===now?.id?'true':'false'}" data-dp-model="${esc(m.id)}"><img src="${esc(modelScene(m.id))}" alt="" width="538" height="720" loading="lazy" decoding="async"><span class="sx-small">${esc(nameOf(m.name))}</span></button>`).join('')}<p class="sx-small sx-dp-cast-note" data-dp-cast-note ${now?.id&&now.id!==d.model?.id?'':'hidden'}>${esc(t('이 모델로 바꿔 장면 이미지에서 보여 드려요.'))}</p></div>${d.looks?dpLooks(d,ui):''}`;
}
// ── 옷 · 머리(2026-11-10, 설계 4-1) ──
// 모델마다 이미 있는 사진(옷 세 벌 · 머리 세 가지) 가운데 고른다. 기본은 「담당자에게 맡기기」(값 없음), 「직접 고르기」로 펼친다.
// 칸을 누르면 고르고 다시 누르면 풀린다(그 줄은 맡김). 처음 값은 같은 모델로 앞서 고른 값(d.look). 모델을 바꾸면 옛 모델의 고름은
// 그 모델 몫(ui.picks)으로 접어 두고, 바뀐 모델은 그 모델에서 고르던 값(처음이면 맡김)으로 그린다 — 한 모델의 값이 다른 모델로 넘어가지 않는다.
// 펼친 칸은 모델 큰 사진(「크게 보기」)과 함께 펼치지 않는다 — 방향을 고르는 화면이 주인공이라 높이를 지킨다.
const seedLook=(d,ui)=>{if(ui.outfit===undefined)ui.outfit=d.look?.outfit||'';if(ui.hair===undefined)ui.hair=d.look?.hair||'';};
const lookModel=(d,ui)=>(modelCard(ui.modelId)||d.model)?.id||'';
// 요약 줄: 고른 것이 있으면 「옷 … · 머리 …」(길면 둘째 줄까지 꺾여 이름이 다 보인다), 없으면 「담당자에게 맡기기」 + 뒤 설명(한 줄에 들 때만 보인다 — film.css .sx-dp-look-say).
const lookSum=look=>look.outfit||look.hair?lookLine(look):t('담당자에게 맡기기');
// 방향 화면과 사진 상품의 모델 제안 카드(11-12)가 같은 줄을 쓴다 — 자리마다 다른 것(속성 이름 · 뒤 설명 · 안내 한 줄)만 at으로 받는다.
function lookBox(id,ui,at){
  const looks=modelLooks(id);if(!looks)return '';
  const now=lookOf(id,ui);
  // 이름은 칸 폭에 맞춰 줄여 보이므로 전체 이름을 title(마우스를 올리면)과 단추 이름에 둔다.
  const cell=(key,item)=>{const on=now[key]===item.id,name=t(item.label);return `<button type="button" class="sx-dp-pic${on?' is-on':''}" aria-pressed="${on?'true':'false'}" aria-label="${esc(name)}" title="${esc(name)}" ${at.pick}="${key}" data-value="${esc(item.id)}"><img src="${esc(item.src)}" alt="" loading="lazy" decoding="async"><span class="sx-small">${esc(name)}</span></button>`;};
  const set=(key,label,items)=>`<div class="sx-dp-look-set is-${key}" role="group" aria-label="${esc(label)}"><span class="sx-dp-label">${esc(label)}</span><div class="sx-dp-pics">${items.map(item=>cell(key,item)).join('')}</div></div>`;
  return `<div class="sx-dp-look sx-small" ${at.box} data-model="${esc(id)}"><p class="sx-dp-look-row"><span class="sx-dp-label">${esc(t('옷 · 머리'))}</span><span class="sx-dp-look-say${now.outfit||now.hair?' is-picked':''}"><b ${at.sum} title="${esc(lookSum(now))}">${esc(lookSum(now))}</b><span class="sx-dp-look-hint" ${at.hint} ${now.outfit||now.hair?'hidden':''}> · ${esc(at.say)}</span></span><button type="button" class="sx-quiet sx-dp-look-open" ${at.toggle} aria-expanded="${ui.looks?'true':'false'}" aria-controls="${at.id}">${esc(ui.looks?t('접기'):t('직접 고르기'))}</button></p><div class="sx-dp-looks" id="${at.id}" ${at.panel} ${ui.looks?'':'hidden'}>${set('outfit',t('옷'),looks.outfits)}${set('hair',t('머리'),looks.hairs)}<p class="sx-dp-look-note">${esc(at.note)}</p></div></div>`;
}
const dpLooks=(d,ui)=>lookBox(lookModel(d,ui),ui,{box:'data-dp-look',pick:'data-dp-look-pick',sum:'data-dp-look-sum',hint:'data-dp-look-hint',toggle:'data-dp-do="looks"',panel:'data-dp-looks',id:'dp-looks',say:t('방향에 맞춰 골라 드려요'),note:t('고른 옷 · 머리는 장면 이미지에서 이 사진 그대로 맞춰요.')});
// 사진 상품의 모델 제안 카드: 방향 화면이 없어 여기서 고른다(기본은 맡김). ui는 app.mjs s.proposeUi — 실시간으로 다시 그려도 고르던 값 · 펼침이 남는다.
const seedPropose=(m,ui)=>{if(ui.outfit===undefined)ui.outfit=m.look?.outfit||'';if(ui.hair===undefined)ui.hair=m.look?.hair||'';};
const proposeLooks=(m,ui)=>lookBox(m.id,ui,{box:`data-room-look data-key="${esc(m.key||'')}"`,pick:'data-room-look-pick',sum:'data-room-look-sum',hint:'data-room-look-hint',toggle:'data-room-do="looks"',panel:'data-room-looks',id:'room-looks',say:t('제품에 맞춰 골라 드려요'),note:t('고른 옷 · 머리는 사진에서 이 모습 그대로 맞춰요.')});
// 「이 방향으로 갈게요」 양식의 숨은 칸: 줄을 그릴 때만 두고, 그때는 빈 값(맡김)이라도 늘 보낸다(서버 규칙 — 칸이 없으면 건드리지 않음).
const lookFields=(d,ui)=>{if(!d.looks)return '';const now=lookOf(lookModel(d,ui),ui);return `<input type="hidden" name="outfit" value="${esc(now.outfit)}"><input type="hidden" name="hair" value="${esc(now.hair)}">`;};
export function directionView(p,{top='',ui={},journal=''}={}){
  const d=p.direction,focus=d.options.some(o=>o.id===ui.focus)?ui.focus:(d.chosen&&d.options.find(o=>o.id===d.chosen.id)||d.options.find(o=>o.recommended)||d.options[0]).id,keep=d.status==='chosen'&&d.note?d.note:'',noteOpen=!!ui.note,view=ui.view==='neither'?'neither':'choose',item=d.options.find(o=>o.id===focus);
  const terms=termsOf(d);if(d.looks)seedLook(d,ui);
  return `<div class="sx-room is-direction" data-state="direction">
    <section class="sx-dp" data-count="${d.options.length}" data-view="${view}" data-dp>
      <div class="sx-dp-reel">${d.options.map((o,i)=>`<button type="button" class="sx-dp-frame" data-dp-frame="${esc(o.id)}" data-at="${i}" aria-pressed="${o.id===focus?'true':'false'}" aria-label="${esc(t('{no} {name} 보기',{no:o.no,name:o.name}))}"><img src="${esc(o.src)}" alt="" decoding="async"><span class="sx-dp-frame-no sx-small"><span class="sx-no">${esc(o.no)}</span> ${esc(o.name)}</span></button>`).join('')}</div>
      <div class="sx-dp-sheet" aria-live="polite">
        ${top}
        <div class="sx-dp-top"><p class="sx-small"><span class="sx-dp-name"><b>${esc(d.title)}</b>${d.line?' · ':''}</span>${d.line?esc(d.line):''}<span class="sx-dp-step">${esc(t('영상 전 확인'))} <b class="sx-no">1/3</b>${d.round>1?` · ${esc(t('다시 보내 드린 안'))}`:''}</span></p>${d.lead?`<p class="sx-body sx-dp-lead">${esc(d.lead)}</p>`:''}</div>
        <div class="sx-dp-choose" ${view==='choose'?'':'hidden'}>
          <div class="sx-dp-tabs" role="group" aria-label="${esc(t('방향 고르기'))}">${d.options.map(o=>`<button type="button" class="sx-dp-tab sx-small ${o.id===focus?'is-on':''}" aria-pressed="${o.id===focus?'true':'false'}" data-dp-pick="${esc(o.id)}"><span class="sx-no">${esc(o.no)}</span> ${esc(o.name)}${o.recommended?`<span class="sx-dp-rec"> · ${esc(t('추천'))}</span>`:''}</button>`).join('')}</div>
          ${d.options.map(o=>dpDetail(o,o.id===focus)).join('')}
          ${dpModel(d,ui)}
          <div class="sx-dp-terms">${terms}
            <p class="sx-small sx-dp-incl">${esc(t('어느 방향이든 값은 같고, 모델 · 목소리 · 음악 · 자막이 모두 들어 있어요. 결제는 글 콘티를 보신 뒤 크몽에서 해요.'))} <button type="button" class="sx-link" data-dp-do="more" aria-expanded="${ui.more?'true':'false'}">${esc(ui.more?t('접기'):t('자세히'))}</button></p>
            <dl class="sx-dp-more sx-small" data-dp-more ${ui.more?'':'hidden'}><div><dt>${esc(t('만드는 법'))}</dt><dd>${esc(t('사람과 목소리는 모두 AI로 만들어요. 제품 · 로고 · 글자는 보내 주신 파일을 그대로 얹어요. 지금 그림은 방향을 보여 드리는 첫 그림이에요'))}</dd></div>${d.gets?`<div><dt>${esc(t('받으시는 것'))}</dt><dd>${esc(t(d.gets))}</dd></div>`:''}<div><dt>${esc(t('쓸 수 있는 곳'))}</dt><dd>${esc(t('온라인 광고 · SNS · 자사몰 · 상세페이지(음악 · 목소리 포함). TV · 옥외 · 극장 · 인쇄는 따로 여쭤 주세요'))}</dd></div><div><dt>${esc(t('받으실 날'))}</dt><dd>${esc(t('사진 · 로고 · 꼭 넣을 말이 다 모였을 때 기준이에요. 주말과 공휴일을 포함한 날이고, 확인이 늦어지면 그만큼 함께 미뤄요'))}</dd></div><div><dt>${esc(t('수정'))}</dt><dd>${esc(d.photo?t('사진이 나온 뒤 {count}번. 글 콘티와 장면 이미지의 의견은 횟수에 세지 않아요',{count:d.revisions}):t('영상이 나온 뒤 {count}번. 글 콘티와 장면 이미지의 의견은 횟수에 세지 않아요',{count:d.revisions}))}</dd></div><div><dt>${esc(t('결제'))}</dt><dd>${esc(t('글 콘티를 보신 뒤 장면 이미지 전에 크몽에서 해요. 크몽 상품에서 「문의하기」로 접수 번호를 보내 주시면 같은 값 · 기간 · 수정 횟수의 결제 요청을 보내 드려요. 글 콘티까지는 값을 받지 않아요'))}</dd></div><div><dt>${esc(t('취소 · 환불'))}</dt><dd>${esc(t('결제 뒤 장면 이미지를 확정하시기 전에 그만두시면 전액 돌려드려요. 제작을 시작한 뒤에는 맞춤 제작이라 수정 횟수 안에서 고쳐 드려요'))}</dd></div><div><dt>${esc(t('작품 소개'))}</dt><dd>${esc(t('완성한 광고는 공개하신 뒤에 SYNK PULSE 작품으로 소개할 수 있어요. 원하지 않으시면 담당자에게 알려 주세요'))}</dd></div>${p.mail?`<div><dt>${esc(t('알림'))}</dt><dd>${esc(t('글 콘티가 오면 메일({mail})로도 알려 드려요',{mail:p.mail}))}</dd></div>`:''}</dl>
            <form class="sx-dp-answer" data-form="direction-pick"><input type="hidden" name="optionId" value="${esc(focus)}"><input type="hidden" name="modelId" value="${esc(ui.modelId||'')}">${lookFields(d,ui)}<label class="sx-dp-note" data-dp-note ${noteOpen?'':'hidden'}><span class="sr">${esc(t('덧붙일 말'))}</span><input type="text" name="note" maxlength="200" placeholder="${esc(t('예) 「쌉쌀」은 빼 주세요'))}" value="${esc(keep)}"></label><button type="submit" class="sx-go is-solid sx-dp-go" data-mutate><span data-dp-go>${esc(goLabel(item.name))}</span>${arrow}</button></form>
            ${keep?`<p class="sx-small sx-dp-kept" ${noteOpen?'hidden':''}>${esc(t('덧붙이신 말 · {note}',{note:keep}))}</p>`:''}<p class="sx-dp-foot"><button type="button" class="sx-quiet" data-dp-do="note" aria-expanded="${noteOpen?'true':'false'}">${esc(keep?t('덧붙인 말 고치기'):t('한마디 덧붙이기'))}</button><button type="button" class="sx-quiet" data-dp-do="neither">${esc(d.options.length>2?t('모두 아니에요'):t('둘 다 아니에요'))}</button></p>
          </div>
        </div>
        <form class="sx-dp-neither" data-form="direction-neither" ${view==='neither'?'':'hidden'}><h1 class="sx-serif sx-dp-title" tabindex="-1">${esc(t('어떤 점이 아쉬웠나요?'))}</h1><label class="sx-field sx-dp-say"><span class="sx-small">${esc(d.last?t('한 줄이면 돼요. 담당자가 직접 연락드려 함께 정해요.'):t('한 줄이면 돼요. 같은 값으로 한 번 더 제안해 드려요.'))}</span><textarea name="note" rows="3" maxlength="300" required placeholder="${esc(t('예) 더 고급스러웠으면 좋겠어요'))}"></textarea></label><button type="submit" class="sx-go is-solid sx-dp-go" data-mutate><span>${esc(d.last?t('담당자와 이야기하기'):t('다시 제안받기'))}</span>${arrow}</button><p class="sx-dp-foot"><button type="button" class="sx-quiet" data-dp-do="back">${esc(d.options.length>2?t('안 다시 보기'):t('두 방향 다시 보기'))}</button></p></form>
      </div>
    </section>
    ${roomPaper(p)}
    ${journal}
  </div>`;
}
export function mountDirection(root,d,{ui={},animate=true}={}){
  const host=root.querySelector('[data-dp]');if(!host)return {unmount(){}};
  const $=selector=>host.querySelector(selector),works=Object.fromEntries(FINISHED_FILMS.map(film=>[film.id,film]));
  let playing=null;
  if(!ui.focus||!d.options.some(o=>o.id===ui.focus))ui.focus=(d.chosen&&d.options.find(o=>o.id===d.chosen.id)||d.options.find(o=>o.recommended)||d.options[0]).id;
  if(d.looks)seedLook(d,ui);
  // 넘칠 때만 접기: 넓은 화면의 설명 칸은 고정 높이라, 고르기 칸의 내용이 넘치면 넘치지 않을 때까지만 한 단계씩 접는다(단계의 모양은 film.css .is-fit-1~5).
  // 창 크기 · 안 수(두 안 · 세 안) · 글 길이를 가정하지 않고 실제 넘침을 잰다. 「자세히」를 편 동안은 긴 글이라 굴려 읽는 칸이므로 접은 채로 잰 단계를 그대로 둔다.
  // 고르기 칸(.sx-dp-choose)의 안쪽 높이로 재서, 들어올 때의 움직임(칸 자체가 옮겨지는 변형)에 흔들리지 않는다 — 내용이 칸을 넘는 몫이
  // 설명 칸의 아래 여백보다 클 때가 설명 칸이 굴러가는 때다(여백 안에 드는 몫은 굴러가지 않는다). 휴대폰 · 세로 화면은 칸이 흐름이라 단계를 쓰지 않는다.
  // 단계는 화면 하나로 정한다: 안(방향)마다 설명 길이가 달라도 모든 안을 한 번씩 보여 재서 가장 많이 접어야 하는 안에 맞춘다 — 안을 넘길 때 윗부분이 오르내리지 않게.
  // 안을 넘길 때(keep)는 단계를 내리지 않고, 창 크기 · 펼침이 바뀔 때만 처음부터 다시 센다. 재는 동안 숨긴 것은 그 자리에서 되돌리고 굴린 자리도 되살린다.
  const FIT=['is-fit-1','is-fit-2','is-fit-3','is-fit-4','is-fit-5'];
  function fit({keep=false}={}){
    const box=$('.sx-dp-choose'),sheet=box?.parentElement;
    if(!box||box.hidden||matchMedia?.(JOURNAL_SHEET).matches){host.classList.remove(...FIT);return;}
    const top=sheet.scrollTop;
    let level=keep?FIT.filter(step=>host.classList.contains(step)).length:0;
    host.classList.remove(...FIT.slice(level));
    const more=$('[data-dp-more]'),open=!!more&&!more.hidden;if(open)more.hidden=true;
    const details=[...host.querySelectorAll('[data-dp-detail]')],shown=details.map(el=>el.hidden);
    const over=()=>box.scrollHeight-box.clientHeight-(parseFloat(getComputedStyle(sheet).paddingBottom)||0)>1;
    for(const detail of details){details.forEach(el=>{el.hidden=el!==detail;});while(level<FIT.length&&over())host.classList.add(FIT[level++]);}
    details.forEach((el,i)=>{el.hidden=shown[i];});
    if(open)more.hidden=false;
    if(sheet.scrollTop!==top)sheet.scrollTop=top;
  }
  let fitFrame=0;const refit=()=>{cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fit);};
  window.addEventListener('resize',refit);
  // 옷 · 머리 사진을 못 받으면 사진만 숨기고 이름은 남긴다(글로는 늘 고를 수 있게).
  const bindPics=()=>host.querySelectorAll('.sx-dp-pic img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;fit();},{once:true}));
  function syncLooks(){
    const box=$('[data-dp-look]');if(!box)return;
    const now=lookOf(lookModel(d,ui),ui);ui.outfit=now.outfit;ui.hair=now.hair;
    box.querySelectorAll('[data-dp-look-pick]').forEach(button=>{const on=now[button.dataset.dpLookPick]===button.dataset.value;button.classList.toggle('is-on',on);button.setAttribute('aria-pressed',on?'true':'false');});
    const sum=box.querySelector('[data-dp-look-sum]'),hint=box.querySelector('[data-dp-look-hint]');if(sum){sum.textContent=lookSum(now);sum.title=lookSum(now);}if(hint)hint.hidden=!!(now.outfit||now.hair);box.querySelector('.sx-dp-look-say')?.classList.toggle('is-picked',!!(now.outfit||now.hair));
    const form=$('[data-form="direction-pick"]');if(form?.elements.outfit){form.elements.outfit.value=now.outfit;form.elements.hair.value=now.hair;}
  }
  // 모델 큰 사진과 옷 · 머리는 한 번에 하나만 펼친다.
  function fold(key){
    if(!ui[key])return;ui[key]=false;
    const [box,button,label]=key==='casting'?[$('[data-dp-casts]'),$('[data-dp-do="casting"]'),t('크게 보기')]:[$('[data-dp-looks]'),$('[data-dp-do="looks"]'),t('직접 고르기')];
    if(box)box.hidden=true;if(button){button.setAttribute('aria-expanded','false');button.textContent=label;}
  }
  bindPics();
  const workOf=o=>{const film=works[o.workId];return film?{src:film.excerpt?.src||film.full?.src||'',poster:film.poster||'',title:filmTitle(film),note:filmNote(film)}:null;};
  function stopFilm(){if(!playing)return;playing.video.pause?.();playing.video.remove();playing.cap.remove();const was=playing;playing=null;syncFilmButtons();return was;}
  function playFilm(kind){
    const o=d.options.find(item=>item.id===ui.focus),frame=host.querySelector(`[data-dp-frame="${CSS.escape(o.id)}"]`),work=workOf(o),taste=kind==='taste',src=taste?o.film:work?.src;if(!frame||!src)return;
    stopFilm();
    // 올라오는 동안 빈 검정 대신 그 안의 그림(같은 출처)을 둔다. 미리 받기는 손님이 누른 견본에만.
    const video=document.createElement('video');video.className=`sx-dp-film${taste?' is-taste':''}`;const poster=taste?o.src:work?.poster;if(poster)video.poster=poster;video.preload=taste?'auto':'metadata';video.src=src;video.playsInline=true;
    // 미리 움직여 보기는 손님이 누른 순간이라 소리를 켜고 한 번만, 끝나면 그림으로. 비슷한 작품은 소리 없이 되풀이.
    video.muted=!taste;video.loop=!taste;
    if(taste)video.addEventListener('ended',()=>{if(playing?.video===video)stopFilm();},{once:true});
    const cap=document.createElement('span');cap.className='sx-dp-film-cap sx-small';cap.textContent=taste?t('미리 움직여 본 첫 판 · {note} · 소리 있음',{note:o.filmNote||''}).replace(' ·  ·',' ·'):`${t('「{name}」',{name:work.title})}${work.note?` · ${work.note}`:''}`;
    frame.append(video,cap);playing={video,cap,kind};
    video.play?.().catch(()=>{video.muted=true;video.play?.().catch(()=>{});});
    syncFilmButtons();
  }
  function syncFilmButtons(){
    host.querySelectorAll('[data-dp-film]').forEach(button=>{const on=playing?.kind===button.dataset.dpFilm;button.setAttribute('aria-pressed',on?'true':'false');const mark=button.querySelector('.sx-dp-taste-mark');if(mark)mark.innerHTML=on?STOP_MARK:PLAY_MARK;const label=button.querySelector('[data-dp-taste-label]');if(label)label.textContent=on?t('그림으로 돌아가기'):t('미리 움직여 보기');if(button.dataset.dpFilm==='work')button.textContent=on?t('그림으로'):t('비슷한 작품 보기');});
  }
  function drawWork(){const o=d.options.find(item=>item.id===ui.focus),slot=$('[data-dp-work-slot]');if(slot)slot.innerHTML=workOf(o)?`<button type="button" class="sx-quiet" data-dp-film="work" aria-pressed="false">${esc(t('비슷한 작품 보기'))}</button>`:'';}
  function setFocus(id,{quiet=false}={}){
    if(!d.options.some(o=>o.id===id))return;
    stopFilm();ui.focus=id;const o=d.options.find(item=>item.id===id);
    host.querySelectorAll('[data-dp-frame]').forEach(frame=>frame.setAttribute('aria-pressed',frame.dataset.dpFrame===id?'true':'false'));
    host.querySelectorAll('[data-dp-pick]').forEach(tab=>{const on=tab.dataset.dpPick===id;tab.classList.toggle('is-on',on);tab.setAttribute('aria-pressed',on?'true':'false');});
    host.querySelectorAll('[data-dp-detail]').forEach(box=>{box.hidden=box.dataset.dpDetail!==id;});
    const form=$('[data-form="direction-pick"]');if(form){form.elements.optionId.value=id;$('[data-dp-go]').textContent=goLabel(o.name);}
    drawWork();fit({keep:true});
    const box=host.querySelector(`[data-dp-detail="${CSS.escape(id)}"]`);
    if(!quiet&&box&&!reduced())[...box.children].forEach((child,i)=>play(child,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:460,delay:i*36,fill:'backwards'}));
  }
  function setView(view){
    stopFilm();ui.view=view;host.dataset.view=view;$('.sx-dp-choose').hidden=view!=='choose';$('[data-form="direction-neither"]').hidden=view!=='neither';fit();
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
    if(model){
      const was=lookModel(d,ui);
      ui.modelId=model===d.model?.id?'':model;const card=modelCard(model);$('[data-dp-model-name]').textContent=card?.name?nameOf(card.name):'';host.querySelectorAll('[data-dp-model]').forEach(button=>{const on=button.dataset.dpModel===model;button.classList.toggle('is-on',on);button.setAttribute('aria-pressed',on?'true':'false');});const note=$('[data-dp-cast-note]');if(note)note.hidden=!ui.modelId;$('[data-form="direction-pick"]').elements.modelId.value=ui.modelId;
      // 모델이 바뀌면 옛 모델의 옷 · 머리는 그 모델 몫으로 접어 두고, 바뀐 모델은 그 모델에서 고르던 값(처음이면 맡김 —
      // 방향의 모델로 돌아오면 앞서 고른 값)으로 사진째 다시 그린다(펼친 상태는 그대로). 다른 모델의 값이 넘어가지 않는다.
      const box=$('[data-dp-look]'),now=lookModel(d,ui);
      if(box&&now!==was){ui.picks={...ui.picks,[was]:{outfit:ui.outfit,hair:ui.hair}};const back=ui.picks[now]||(now===d.model?.id?d.look:null);ui.outfit=back?.outfit||'';ui.hair=back?.hair||'';box.outerHTML=dpLooks(d,ui);bindPics();syncLooks();}
      fit();return;
    }
    const look=event.target.closest('[data-dp-look-pick]');
    if(look){const key=look.dataset.dpLookPick;ui[key]=ui[key]===look.dataset.value?'':look.dataset.value;syncLooks();fit();return;}
    const film=event.target.closest('[data-dp-film]')?.dataset.dpFilm;if(film){if(playing?.kind===film)stopFilm();else playFilm(film);return;}
    const what=event.target.closest('[data-dp-do]'),act=what?.dataset.dpDo;if(!act)return;
    if(act==='more')toggle('more',$('[data-dp-more]'),what,[t('접기'),t('자세히')]);
    if(act==='note'){toggle('note',$('[data-dp-note]'),what,[]);const kept=$('.sx-dp-kept');if(kept)kept.hidden=!!ui.note;if(ui.note)$('[data-dp-note] input').focus({preventScroll:true});}
    if(act==='casting'){toggle('casting',$('[data-dp-casts]'),what,[t('접기'),t('크게 보기')]);if(ui.casting)fold('looks');}
    if(act==='looks'){toggle('looks',$('[data-dp-looks]'),what,[t('접기'),t('직접 고르기')]);if(ui.looks)fold('casting');}
    if(act==='neither')setView('neither');
    if(act==='back')setView('choose');
    if(['more','note','casting','looks'].includes(act))fit();
  });
  setFocus(ui.focus,{quiet:true});
  // 글꼴이 늦게 오면 줄 수가 달라질 수 있어 한 번 더 잰다.
  document.fonts?.ready?.then(()=>{if(host.isConnected)fit();});
  if(animate)riseAll(host.querySelectorAll('.sx-dp-frame,.sx-dp-top,.sx-dp-choose'),{start:120,gap:60});
  return {unmount(){stopFilm();window.removeEventListener('resize',refit);cancelAnimationFrame(fitFrame);}};
}
const otherModels=m=>`<div class="sx-wall is-plain">${CASTING_MODELS.filter(item=>item.id!==m.id).map(item=>`<button type="button" class="sx-cast" data-room-model="${item.id}" aria-label="${esc([nameOf(item.name),t(MODEL_LINES[item.id]?.line||item.description),t('이 모델로 정하기')].join(' · '))}"><img src="${esc(sceneOf(item))}" alt="" loading="lazy" decoding="async" width="538" height="720"><span class="sx-cast-name sx-small">${esc(nameOf(item.name))}</span></button>`).join('')}</div>`;
// 고객 전용 인물(판 3, persona-view.mjs): 인물이 손님 차례이고 영상 쪽이 손님 차례가 아니면 인물이 「지금 차례」(머리 글 · 카드 · 스크린)가 되고,
// 영상 쪽도 손님 차례면 인물 카드는 그 아래 제 머리를 단 카드로, 인물이 저희 차례 · 끝이면 작은 한 줄로 선다. 인물이 없으면 판 3 전과 바이트가 같다(기존 줄 안에만 이어 붙인다).
// 되묻기 차례는 답할 칸이 일지 맨 위에 있어(「아래 칸만 채워 주시면」) 인물 칸을 일지 뒤로 보낸다 — 되묻기 글과 답 칸 사이에 끼지 않게.
export function roomView(p,{bar=true,top='',after='',foot='',prep='',journal='',tail='',ui={}}={}){
  const room=copyOf(p),pc=p.persona?.card?personaCopy(p.persona):null,main=!!pc&&room.turn!=='you',copy=main?pc:room,confirm=main||p.photo?'':CONFIRM_OF[p.state];
  // 판 4: 인물 칸 바로 아래 「내 모델로 모아 두기」(앱이 회원 상태를 읽어 넘긴 p.keep이 있을 때만 — 없으면 판 4 전과 같다).
  const keep=p.persona&&p.keep?personaKeep(p.persona,p.keep):'';
  // 내 모델로 맡긴 의뢰인데 서버가 인물을 싣지 않은 다시 쓰기 방(연결 확인 전 · 지금 쓸 수 없는 모델 — 켜기 전 후속 11-11)은 내 모델로 가는 한 줄만 둔다.
  // 90일 시계로 지운 인물(판 4 설계 11-6)은 지운 날 한 줄만(p.personaRemoved — 살아 있는 인물이 있으면 서버가 싣지 않는다).
  const below=!main&&p.persona?(p.persona.card?personaCard(p.persona):personaLine(p.persona))+keep:!p.persona&&p.keep?.state==='reuse'?personaReuseLine():!p.persona&&p.personaRemoved?personaRemovedLine(p.personaRemoved):'',late=p.state==='ask'&&!!journal;
  return `<div class="sx-room" data-state="${esc(p.state)}">
    ${bar?exampleHead(p):''}
    <section class="sx-room-hero">
      <div class="sx-room-left">
        ${top}
        <p class="sx-kicker sx-turn"><i class="${copy.turn==='you'?'is-you':copy.turn==='done'?'is-done':''}" aria-hidden="true"></i>${esc(copy.turn==='you'?t('내 차례'):copy.turn==='done'?t('마쳤어요'):t('저희 차례'))}${confirm?`<span>${esc(t('영상 전 확인'))} <b class="sx-no">${confirm}</b></span>`:''}${main&&pc.confirm?`<span>${esc(t('맞춤 인물 확인'))} <b class="sx-no">${pc.confirm}</b></span>`:''}</p>
        <h1 class="sx-display" data-room-title>${esc(t(copy.title))}</h1>
        <p class="sx-body sx-room-lead" data-room-in>${esc(copy.text)}</p>
        ${copy.action?`<div data-room-in><button type="button" class="sx-go is-solid" data-room-go="${esc(copy.action.go)}"><span>${esc(t(copy.action.label))}</span>${arrow}</button></div>`:''}${main?personaCard(p.persona,{main:true})+keep:''}
        ${p.state==='pay'?payCard(p):''}
        ${p.state==='done'?doneCard(p):''}
        ${p.state==='model'&&p.proposal?proposeCard(p.proposal,ui):''}
        ${p.state==='prepare'&&p.direction?.chosen?chosenCard(p.direction):''}
        ${p.state==='ask'&&!journal?askList(p):''}${late?'':below}
        ${after}
        ${journal}${late?below:''}
      </div>
      <div class="sx-room-screen">${main&&personaScreen(p.persona)||roomScreen(p,{news:!main})}</div>
    </section>
    ${foot?`<div class="sx-room-foot">${foot}</div>`:''}
    ${roomPaper(p)}
    ${prep}
    ${tail?`<div class="sx-room-foot is-tail">${tail}</div>`:''}
    ${p.films?`<p class="sx-room-films"><button type="button" class="sx-small sx-link" data-room-go="films">${esc(t('SYNK가 끝까지 만든 완성 광고 보기'))}</button></p>`:''}
  </div>`;
}
// 아래 인화지 쪽: 보내 주신 의뢰서 · 받은 자료. 고객 방과 방향 화면이 같이 쓴다.
function roomPaper(p){
  return `<section class="sx-room-paper" data-room-in data-room-brief>
      <div class="sx-room-doc"><h2 class="sx-serif">${esc(t('보내 주신 의뢰서'))}</h2><dl class="sx-kv">${p.brief.map(([key,value])=>`<div><dt>${esc(t(key))}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${p.canEdit?`<button type="button" class="sx-quiet" data-room-do="edit">${esc(t('고치기'))}</button>`:''}</div>
      <div class="sx-room-doc"><h2 class="sx-serif">${esc(t('받은 자료'))} <span class="sx-no">${p.files.length+(p.others?.length||0)}</span></h2><div class="sx-contact">${p.files.map(file=>`<figure><img src="${esc(file.src)}" alt="" loading="lazy" decoding="async"><figcaption class="sx-small">${esc(t(file.label))}</figcaption></figure>`).join('')}</div>${p.others?.length?`<ul class="sx-room-others-list">${p.others.map(name=>`<li class="sx-small">${esc(name)}</li>`).join('')}</ul>`:''}<label class="sx-quiet sx-room-more"><input type="file" class="sr" multiple data-room-file>${esc(t('자료 더 보내기'))}</label></div>
    </section>`;
}
// 그 상태의 왼쪽 글. 방향을 고른 뒤 · 두 번째 제안도 거절한 뒤는 글이 다르다.
// 저희 차례인 글에는, 다음 손님 차례가 실제로 메일이 나가는 순간일 때만 그 이름과 함께 한 줄을 붙인다
// (장면 이미지 둘째 판부터 · 되묻기는 메일이 없다 — 서버 pulseMailMoment와 같은 약속).
// 조사 도우미(한국어 문장에만).
const josa=word=>{const c=word.charCodeAt(word.length-1)-0xac00;return c>=0&&c<=11171&&c%28?'이':'가';}; // i18n-skip
// 다음에 메일로 알릴 것의 이름(메일 문맥 — 「사진」 · 「영상」이 다른 화면의 같은 낱말과 영어가 갈린다). 조사는 이 한국어 낱말에서 고른다.
function mailNext(p){
  // 장면 이미지 판 메일은 판 4부터(서버가 알린 순간 목록 moments에 images_ready가 있을 때만 약속한다).
  const images=(p.moments||[]).includes('images_ready');
  if(p.state==='check')return p.photo?t('첫 장',null,'mail'):t('방향 제안',null,'mail');
  if(p.state==='redirect')return p.direction?.last?t('글 콘티',null,'mail'):t('새 방향',null,'mail');
  if(p.state==='prepare')return p.photo?t('첫 장',null,'mail'):t('글 콘티',null,'mail');
  if(p.state==='prepare-images')return images&&!p.photo?t('장면 이미지',null,'mail'):'';
  if(p.state==='revise')return p.lastKind==='script'?t('고친 글 콘티',null,'mail'):images?(p.photo?t('고친 첫 장',null,'mail'):t('고친 장면 이미지',null,'mail')):'';
  if(p.state==='make')return p.photo?t('사진',null,'mail'):t('영상',null,'mail');
  return '';
}
// 글은 여기서 그 언어로 옮긴다(제목 · 단추는 그리는 자리에서). 메일 한 줄은 문장 하나 — 조사는 한국어 낱말에서 고른다(다른 언어 사전은 조사 자리표를 쓰지 않는다).
function copyOf(p){const base=copyBase(p),next=p.mail&&base.turn==='us'?mailNext(p):'',text=t(base.text);return next?{...base,text:`${text} ${t('{next}{josa} 오면 메일({mail})로도 알려 드려요.',{next,josa:josa(next),mail:p.mail})}`}:{...base,text};}
// 상태마다 다른 글(변수로 들어가는 문장도 원문을 k로 표시한다 — 번역은 copyOf · roomView).
function copyBase(p){
  // 결제 차례(판 4): 서버가 결제 상태를 알면 그 상태를, 모르면(앞 판 서버) 「글 콘티를 확인해 주셨어요」를 보인다.
  if(p.state==='pay'){
    const pay=p.pay||{};
    if(pay.status==='cancelled')return {turn:'you',title:k('결제가 취소됐어요'),text:p.photo?k('다시 진행하시려면 담당자에게 알려 주세요. 보내 주신 자료는 그대로 있어요.'):k('다시 진행하시려면 담당자에게 알려 주세요. 보내 주신 자료와 글 콘티는 그대로 있어요.')};
    if(pay.status==='requested')return {turn:'you',title:k('크몽에서 결제해 주세요'),text:p.photo?k('크몽 메시지로 결제 요청을 보내 드렸어요. 결제가 확인되면 나머지 장을 만들어요.'):k('크몽 메시지로 결제 요청을 보내 드렸어요. 결제가 확인되면 장면 이미지를 만들기 시작해요.')};
    // 제작 자리 차례를 기다리는 건(운영 조각 6-B · 서버가 실은 project.seat): 「이제 결제해 주세요」 대신 결제 요청이 자리가 나는 대로 온다는 말(결제 카드 한 줄과 같은 뜻).
    if(pay.seat)return {turn:'you',title:p.photo?k('첫 장을 확인해 주셨어요'):k('글 콘티를 확인해 주셨어요'),text:k('지금은 제작 자리가 차 있어 결제 요청은 자리가 나는 대로 보내 드려요. 그 전에 크몽에서 「문의하기」로 접수 번호를 보내 두시면 바로 이어져요.')};
    if(p.photo)return {turn:'you',title:k('첫 장을 확인해 주셨어요'),text:k('이제 크몽에서 결제해 주세요. 결제가 확인되면 나머지 장을 만들어요.')};
  }
  if(p.state==='prepare-images'&&p.pay?.status==='confirmed')return {turn:'us',title:k('결제를 확인했어요'),text:k('확인하신 글 콘티대로 컷마다 장면 이미지를 만들어요. 다 되면 알려 드려요.')};
  if(p.state==='prepare'&&p.direction?.chosen)return {turn:'us',title:k('이 방향으로 정했어요'),text:k('광고가 남길 한 문장과 글 콘티를 만들어 보내 드려요. 보시고 마음에 드시면 그때 크몽 결제를 안내해 드려요.')};
  if(p.state==='redirect'&&p.direction?.last)return {turn:'us',title:k('담당자가 직접 연락드려요'),text:k('주신 말씀을 들고 담당자가 연락드려 함께 정해요. 정해지면 글 콘티를 보내 드려요.')};
  // 사진 상품의 모델 제안: 장면이 아니라 첫 장을 만들기 전이다.
  if(p.state==='model'&&p.photo)return {...ROOM_COPY.model,text:k('첫 장을 만들기 전에 모델부터 정해요. 마음에 들면 그대로, 아니면 다른 모델을 골라 주세요.')};
  if(p.state==='images'&&p.photo)return {...ROOM_COPY.images,title:k('첫 장이 도착했어요'),text:k('첫 장을 보고 의견을 남겨 주세요. 방향이 맞으면 나머지 장을 만들어요.'),action:{label:k('첫 장 보기'),go:'draft'}};
  if(p.state==='review'&&p.photo)return {...ROOM_COPY.review,title:k('사진이 도착했어요'),text:k('사진을 보고 고칠 곳에 의견을 남겨 주세요.'),action:{label:k('사진 보기'),go:'review'}};
  if(p.state==='prepare'&&p.photo)return {turn:'us',title:k('첫 장을 만들고 있어요'),text:k('보내 주신 사진과 의뢰서대로 첫 장을 먼저 보내 드려요. 방향이 맞으면 나머지 장을 만들어요.')};
  if(p.state==='make'&&p.photo)return {turn:'us',title:k('확인하신 첫 장대로 만들고 있어요'),text:k('나머지 장을 같은 결로 만들고 있어요. 다음에 받으실 것은 완성 사진이에요.')};
  if(p.state==='check'&&p.photo)return {...ROOM_COPY.check,text:k('보내 주신 의뢰서를 확인하고 있어요. 평일 10~19시에 보고, 빠진 게 있으면 그 칸만 다시 여쭤요. 확인이 끝나면 첫 장을 먼저 보내 드려요.')};
  if(p.state==='direction'&&p.options>2)return {...ROOM_COPY.direction,title:k('세 방향 중 하나를 골라 주세요')};
  return ROOM_COPY[p.state]||ROOM_COPY.check;
}
// 결제 안내 카드(판 4): 값 · 받으실 날 · 수정, 세 걸음(크몽 문의 → 결제 요청 → 결제), 크몽 상품 단추, 결제 · 취소 · 증빙.
// 문장은 원문 다섯 줄(docs/마케팅/PULSE_의뢰흐름_20261104/결제_환불_다섯줄.md) ① ② ③과 같다. 크몽 상품은 영상 상품(심사 뒤 공개) — 사진 손님도 같은 상품에서 문의한다.
const KMONG_GIG='https://kmong.com/gig/854445';
function payCard(p){
  const pay=p.pay||{};if(pay.status==='cancelled')return '';
  const requested=pay.status==='requested',when=requested?pay.requestedDay:'';
  const terms=[pay.price&&[t('값'),pay.price],pay.days&&[t('기간'),t('{count}일',{count:pay.days})],Number.isFinite(pay.revisions)&&[t('수정'),t('{count}회',{count:pay.revisions})]].filter(Boolean);
  return `<section class="sx-pay" data-room-in aria-label="${esc(t('결제 안내'))}">
    ${terms.length?`<dl class="sx-pay-terms">${terms.map(([key,value])=>`<div><dt class="sx-small">${esc(key)}</dt><dd class="sx-serif">${esc(value)}</dd></div>`).join('')}</dl>`:''}
    <p class="sx-small sx-pay-fee">${esc(pay.days?t('기간은 결제한 날부터 세요. 크몽 결제 때 크몽 구매 수수료가 더해지고, 부가세는 따로 받지 않아요.'):t('크몽 결제 때 크몽 구매 수수료가 더해지고, 부가세는 따로 받지 않아요.'))}</p>
    ${pay.seat&&!requested&&pay.status!=='confirmed'?`<p class="sx-small sx-pay-seat" data-seat>${esc(pay.seat.noticeDay?t('지금은 제작 자리가 차 있어요. 결제 안내는 {date}쯤 드려요.',{date:pay.seat.noticeDay}):t('지금은 제작 자리가 차 있어요. 결제 안내는 자리가 나는 대로 드려요.'))}</p>`:''}
    <ol class="sx-pay-steps sx-body">
      <li class="${requested?'is-done':''}"><span>${esc(t('크몽 상품에서 「문의하기」로 접수 번호를 보내 주세요'))}</span>${pay.number?` <b class="sx-no">${esc(pay.number)}</b> <button type="button" class="sx-quiet" data-room-do="copy-number" data-number="${esc(pay.number)}">${esc(t('번호 복사'))}</button>`:''}</li>
      <li class="${requested?'is-done':''}"><span>${esc(requested&&when?t('담당자가 결제 요청을 보냈어요 · {day}',{day:when}):t('담당자가 같은 값 · 기간 · 수정 횟수로 결제 요청을 보내 드려요'))}</span></li>
      <li><span>${esc(p.photo?t('결제하시면 확인한 뒤 나머지 장을 만들어요'):t('결제하시면 확인한 뒤 장면 이미지를 만들기 시작해요'))}</span></li>
    </ol>
    <div class="sx-pay-act"><a class="sx-go is-solid" href="${KMONG_GIG}" target="_blank" rel="noopener noreferrer"><span>${esc(t('크몽 상품 열기'))}</span>${arrow}</a></div>
    <details class="sx-pay-more"><summary class="sx-small sx-link">${esc(t('결제 · 취소 · 증빙'))}</summary><dl class="sx-small"><div><dt>${esc(t('결제'))}</dt><dd>${esc(t('결제는 크몽에서 해요. 글 콘티를 보시고 승인하신 뒤 크몽 상품에서 「문의하기」로 접수 번호를 보내 주시면, 담당자가 같은 값 · 기간 · 수정 횟수의 결제 요청을 보내 드려요. 결제가 확인되면 장면 이미지를 만들기 시작해요. 글 콘티까지는 값을 받지 않아요.'))}</dd></div><div><dt>${esc(t('취소 · 환불'))}</dt><dd>${esc(t('글 콘티까지는 값을 받지 않아 그만두셔도 비용이 없어요. 결제하신 뒤 장면 이미지를 확정하시기 전에 그만두시면 전액 돌려드려요. 장면 이미지를 확정해 제작을 시작한 뒤에는 맞춤 제작이라 환불 대신 패키지 수정 횟수 안에서 고쳐 드리고, 합의와 다르게 만든 부분은 횟수와 상관없이 바로잡아요.'))}</dd></div><div><dt>${esc(t('증빙'))}</dt><dd>${esc(t('개인 전문가라 서비스 금액의 세금계산서는 발행하지 못해요. 크몽에서 카드 전표 · 현금영수증을 결제 증빙으로 받으실 수 있고(부가세 매입 공제용 증빙은 아니에요), 구매 수수료의 세금계산서는 크몽에 신청하실 수 있어요.'))}</dd></div></dl></details>
  </section>`;
}
// 끝맺음(판 4 B4): 수령 확인 뒤. 크몽 구매확정 · 후기 · 같은 모델로 다음 편, 방이 닫히기 전에 파일을 따로 두라는 말.
function doneCard(p){
  return `<section class="sx-done" data-room-in><ol class="sx-pay-steps sx-body"><li><span>${esc(t('크몽에서 작업물을 확인하시고 「구매확정」을 눌러 주세요'))}</span></li><li><span>${esc(t('마음에 드셨다면 크몽 후기 한 줄이 다음 손님께 큰 도움이 돼요'))}</span></li><li><span>${esc(p?.photo?t('같은 모델로 다음 사진을 이어 만들 수 있어요. 담당자에게 알려 주세요'):t('같은 모델 · 같은 자막 규격으로 다음 편을 이어 만들 수 있어요. 담당자에게 알려 주세요'))}</span></li></ol><p class="sx-small">${esc(t('프로젝트를 마치면 이 방이 닫혀요. 받은 파일은 따로 보관해 주세요.'))}</p></section>`;
}
// 고른 방향: 이름 · 한 문장 · 값 · 받으실 날 · 수정 · 다음 길. 판이 오기 전까지 다시 고를 수 있다.
function chosenCard(d){
  const o=d.chosen;
  // 옷 · 머리(11-10): 그때 고른 모델 · 옷 · 머리 한 줄(서버가 기록을 남긴 판만 — 없으면 전처럼).
  const look=d.picked&&d.model?`<p class="sx-small sx-dp-chosen-look">${esc(t('모델 {name} · {look}',{name:nameOf(d.model.name),look:lookLine(d.picked)}))}</p>`:'';
  return `<section class="sx-dp-chosen" data-room-in><p class="sx-small">${esc(t('고르신 방향'))}${d.status==='settled'?` · ${esc(t('담당자와 정함'))}`:''}</p><h2 class="sx-serif">${esc(o.name)}</h2><p class="sx-body">${esc(o.sentence)}</p>${look}${d.note?`<p class="sx-small">${esc(d.status==='settled'?t('담당자와 정한 내용: {note}',{note:d.note}):t('덧붙이신 말: {note}',{note:d.note}))}</p>`:''}${termsOf(d)}<ol class="sx-dp-road sx-small"><li class="is-done">${esc(t('방향'))}</li><li class="is-now">${esc(t('글 콘티'))}</li><li>${esc(t('장면 이미지'))}</li><li>${esc(t('영상'))}</li></ol>${d.canPick?`<button type="button" class="sx-quiet" data-room-go="pick">${esc(t('다시 고르기'))}</button>`:''}</section>`;
}
// 되묻기: 칸마다 글로 답하거나 파일을 보낸다. 파일만, 글만 보내도 된다.
function askList(p){return `<ul class="sx-asks" data-room-in>${p.asks.map(item=>`<li><div class="sx-ask-head"><b class="sx-serif">${esc(item.label)}</b>${item.why?`<p class="sx-small">${esc(item.why)}</p>`:''}</div><form class="sx-ask-reply" data-form="ask" data-id="${esc(item.id||'')}"><textarea name="text" rows="1" maxlength="1000" placeholder="${esc(t('글로 답하거나 파일을 보내 주세요'))}" aria-label="${esc(t('{label} 답',{label:item.label}))}"></textarea><div class="sx-ask-tools"><label class="sx-small sx-link"><input type="file" class="sr" name="file" data-ask-file><span data-ask-name>${esc(t('파일 고르기'))}</span></label><button type="submit" class="sx-go" data-mutate><span>${esc(t('보내기',null,'send'))}</span>${arrow}</button></div></form></li>`).join('')}${(p.answered||[]).map(item=>`<li class="is-answered"><div class="sx-ask-head"><b>${esc(item.label)}</b><p class="sx-small">${esc(item.answer||item.fileName||t('파일을 보내 주셨어요.'))}</p></div><span class="sx-small">${esc(t('보냈어요'))}</span></li>`).join('')}</ul>`;}
// 영상 전 첫 확인: 모델을 맡긴 손님에게 저희가 고른 모델을 보여 드린다. 다른 모델은 그 자리에서 고르거나 글로 말할 수 있다.
function proposeCard(m,ui={}){
  if(m.looks)seedPropose(m,ui);
  return `<section class="sx-propose" data-room-in><h2 class="sx-serif">${esc(nameOf(m.name))}</h2><p class="sx-body sx-propose-line">${esc(t(m.line))}</p>${m.note?`<p class="sx-small">${esc(m.note)}</p>`:''}${m.looks?proposeLooks(m,ui):''}<div class="sx-propose-actions"><button type="button" class="sx-go is-solid" data-room-do="model-accept"><span>${esc(t('이 모델로 할게요'))}</span>${arrow}</button><button type="button" class="sx-quiet" data-room-do="model-others">${esc(t('다른 모델 보기'))}</button></div>
    <form class="sx-propose-say" data-form="model-say" data-model-say hidden><label class="sx-field"><span class="sx-small">${esc(t('딱 맞는 모델이 없으면 말로 알려 주세요'))}</span><textarea name="note" rows="2" maxlength="300" required placeholder="${esc(t('예) 조금 더 어린 느낌이면 좋겠어요'))}"></textarea></label><button type="submit" class="sx-go" data-mutate><span>${esc(t('이대로 보내기'))}</span>${arrow}</button></form></section>`;
}
// 고객 방과, 영상 확인 · 납품의 단계 낱말 줄에 같이 쓴다.
// onPersona({decision,button}) · onPersonaFiles(purpose,files): 고객 전용 인물 카드(판 3)의 승인 단추와 사진 보내기 — 부른 쪽(app.mjs)이 서버에 보낸다.
// onKeep() · onMyModels(): 판 4 「내 모델로 모아 두기」와 「내 모델 열기」(persona-view personaKeep).
export function mountRoom(root,{animate=true,onGo,onEdit,onContact,onModel,onFiles,onForm,onPaper,onPersona,onPersonaFiles,onKeep,onMyModels,ui={}}={}){
  const host=root.querySelector('.sx-room,.sx-shell,.sx-draft');if(!host)return {unmount(){}};
  // 휴대폰 단계 띠: 지금 단계가 화면 안에 오게 띠만 민다.
  const steps=host.querySelector('.sx-steps-run'),current=steps?.querySelector('.is-now');
  if(current&&steps.scrollWidth>steps.clientWidth)steps.scrollLeft=current.offsetLeft-(steps.clientWidth-current.offsetWidth)/2;
  if(animate&&host.matches('.sx-room')){
    const title=host.querySelector('[data-room-title]');if(title)revealWords(title,{delay:60});
    riseAll(host.querySelectorAll('[data-room-in]'),{start:140});
  }
  const film=host.querySelector('[data-room-film]');if(film&&!reduced())film.play?.().catch(()=>{});else if(film)holdPoster(film);
  host.querySelectorAll('video[data-hold]').forEach(video=>holdPoster(video));
  // 모델 제안 카드의 옷 · 머리(사진 상품): 누르면 고르고 다시 누르면 맡김. 사진을 못 받으면 사진만 숨기고 이름은 남긴다(글로는 늘 고를 수 있게).
  // 처음 값: 그릴 때 누른 채로 그린 칸(앞서 정한 값)을 읽는다 — 다시 그릴 때는 ui에 이미 고르던 값이 있다.
  const lookBoxEl=host.querySelector('[data-room-look]'),lookNow=()=>lookOf(lookBoxEl.dataset.model,ui);
  if(lookBoxEl)for(const key of ['outfit','hair'])if(ui[key]===undefined)ui[key]=lookBoxEl.querySelector(`[data-room-look-pick="${key}"][aria-pressed="true"]`)?.dataset.value||'';
  function syncRoomLooks(){
    const now=lookNow(),any=!!(now.outfit||now.hair),text=lookSum(now);ui.outfit=now.outfit;ui.hair=now.hair;
    lookBoxEl.querySelectorAll('[data-room-look-pick]').forEach(button=>{const on=now[button.dataset.roomLookPick]===button.dataset.value;button.classList.toggle('is-on',on);button.setAttribute('aria-pressed',on?'true':'false');});
    const sum=lookBoxEl.querySelector('[data-room-look-sum]'),hint=lookBoxEl.querySelector('[data-room-look-hint]');if(sum){sum.textContent=text;sum.title=text;}if(hint)hint.hidden=any;lookBoxEl.querySelector('.sx-dp-look-say')?.classList.toggle('is-picked',any);
  }
  lookBoxEl?.querySelectorAll('.sx-dp-pic img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;},{once:true}));
  host.addEventListener('click',event=>{
    if(event.target.closest('[data-journal],.sx-j-scrim'))return;
    const go=event.target.closest('[data-room-go]');if(go){if(!go.disabled)onGo?.(go.dataset.roomGo);return;}
    const lookPick=lookBoxEl&&event.target.closest('[data-room-look-pick]');
    if(lookPick){const key=lookPick.dataset.roomLookPick;ui[key]=ui[key]===lookPick.dataset.value?'':lookPick.dataset.value;syncRoomLooks();return;}
    const model=event.target.closest('[data-room-model]')?.dataset.roomModel;if(model){onModel?.({modelId:model});return;}
    const button=event.target.closest('[data-room-do]'),what=button?.dataset.roomDo;if(!what)return;
    if(what==='persona-approve'){onPersona?.({decision:'approve',button});return;}
    if(what==='keep'){if(!button.disabled)onKeep?.();return;}
    if(what==='my-models'){onMyModels?.();return;}
    if(what==='edit')onEdit?.();
    // 결제 안내 카드의 접수 번호 복사(판 4) — 크몽 「문의하기」에 붙여 넣는다.
    if(what==='copy-number'){const number=button.dataset.number||'';const done=()=>{button.textContent=t('복사했어요');};navigator.clipboard?.writeText(number).then(done,()=>{});return;}
    if(what==='contact')onContact?.();
    // 준비 칸(바뀐 내용 · 준비 자료 · 납품 규격): 같은 화면에 있으면 그리로, 아니면(영상 화면) 부른 쪽이 방으로 옮겨 보인다.
    if(what==='paper'){const box=host.querySelector(`[data-paper-for="${CSS.escape(button.dataset.paper||'')}"]`);if(box){box.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});}else onPaper?.(button.dataset.paper||'');}
    // 옷 · 머리 줄을 그린 카드에서는 두 칸을 늘(빈 값 = 맡김이라도) 함께 보낸다 — 줄이 없으면(영상 상품 · 옛 서버) 칸을 보내지 않는다.
    if(what==='model-accept')onModel?.({accept:true,...(lookBoxEl?(now=>({outfit:now.outfit,hair:now.hair}))(lookNow()):{})});
    if(what==='looks'&&lookBoxEl){const panel=lookBoxEl.querySelector('[data-room-looks]');ui.looks=!ui.looks;panel.hidden=!ui.looks;button.setAttribute('aria-expanded',ui.looks?'true':'false');button.textContent=ui.looks?t('접기'):t('직접 고르기');if(ui.looks)play(panel,[{opacity:0},{opacity:1}],{duration:320});}
    if(what==='model-others'){const box=host.querySelector('[data-model-others]'),say=host.querySelector('[data-model-say]');box.hidden=!box.hidden;if(say)say.hidden=box.hidden;button.textContent=box.hidden?t('다른 모델 보기'):t('이 모델 다시 보기');if(!box.hidden){play(box,[{opacity:0},{opacity:1}],{duration:420});
      // 휴대폰에서는 벽이 화면 위쪽 큰 사진 칸에 뜨고 그 칸 높이로 잘린다 — 옷 · 머리를 편 채 아래에서 누르면 벽이 화면 밖이거나 띠만 보인다.
      // 벽 상자가 아니라 벽이 실제로 보이는 그 칸으로 재서, 칸이 창에 온전히 보이지 않으면 칸째 보이게 굴린다(넓은 화면은 칸이 늘 창에 붙어 있어 굴리지 않는다).
      const frame=box.closest('.sx-room-screen')||box,at=frame.getBoundingClientRect(),seen=Math.min(at.bottom,innerHeight)-Math.max(at.top,0);if(seen<Math.min(at.height,innerHeight)-1)frame.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});}}
  });
  // 예시(앱 밖)에서만 쓴다. 실제 앱은 문서 전체의 폼 처리기가 받는다.
  if(onForm)host.addEventListener('submit',event=>{event.preventDefault();onForm(event.target);});
  const fileName=input=>{input.closest('label').querySelector('[data-ask-name]').textContent=input.files[0]?.name||t('파일 고르기');};
  host.querySelectorAll('[data-ask-file]').forEach(fileName);
  host.addEventListener('change',event=>{
    if(event.target.matches('[data-ask-file]'))fileName(event.target);
    if(event.target.matches('[data-room-file]')&&event.target.files.length){const list=[...event.target.files];event.target.value='';onFiles?.(list);}
    if(event.target.matches('[data-persona-file]')&&event.target.files.length){const list=[...event.target.files],purpose=event.target.dataset.personaFile;event.target.value='';onPersonaFiles?.(purpose,list);}
  });
  // 인물 카드의 고칠 점 칸에 글이 있으면 승인 단추 위에 「먼저 보내 주세요」를 보인다(다시 그린 뒤 되살린 글에도 — app.mjs restore가 그린 뒤 채운다).
  // 막힌 동안 승인 단추는 흐리게(aria-disabled) 두되 누를 수는 있다 — 누르면 왜 막혔는지 알리고 그 칸으로 데려간다(app.mjs personaDecide).
  const holdSync=()=>{const area=host.querySelector('form[data-form="persona-changes"] textarea'),hold=host.querySelector('[data-persona-hold]'),held=!!area?.value.trim(),go=host.querySelector('[data-room-do="persona-approve"]');if(hold)hold.hidden=!held;if(go){go.classList.toggle('is-held',held);if(held)go.setAttribute('aria-disabled','true');else go.removeAttribute('aria-disabled');}};
  holdSync();host.addEventListener('input',event=>{if(event.target.closest?.('form[data-form="persona-changes"]'))holdSync();});
  return {unmount(){}};
}

// ── 1차안 ──
// 영상 전에 세 번 확인(공개 약속): 모델 · 한 문장과 글 콘티 → 컷마다 장면 이미지. 글 콘티 판은 그림 없이 먼저 보내 장면을 굽기 전에 방향을 맞춘다.
// 어두운 방 하나에 가운데 화면, 왼쪽 크레딧, 오른쪽 기둥(컷 내용 · 의견 · 결정), 아래 초 길이만큼 넓은 컷 띠.
// 글 콘티 판은 그림이 없으니 가운데에 불 켠 대본 한 장을 놓고 컷을 다 읽게 한다. 줄을 누르면 그 컷에 의견을 남긴다.
const moment=value=>`${Math.floor(value/60)}:${pad(Math.floor(value%60))}`;
function scriptSheet(d,total){
  let from=0;
  const rows=d.cuts.map((cut,i)=>{const at=from;from+=cut.seconds;return `<button type="button" class="sx-strip-cut sx-sheet-row ${i===0?'is-on':''}" role="option" aria-selected="${i===0?'true':'false'}" aria-label="${esc(cutName(i,cut))}" data-cut="${i}" data-w="${cut.seconds}"><span class="sx-no sx-sheet-at"><b>${pad(i+1)}</b>${moment(at)}</span><span class="sx-sheet-what"><span class="sx-serif">${esc(cut.what)}</span>${cut.say?`<span class="sx-sheet-line"><b>${esc(t('말',null,'cut'))}</b> ${esc(cut.say)}</span>`:''}${cut.text?`<span class="sx-sheet-line"><b>${esc(t('화면 글자'))}</b> ${esc(cut.text)}</span>`:''}</span><i class="sx-strip-state" aria-hidden="true"></i></button>`;}).join('');
  // 숫자는 고정폭 글자(.sx-no)로 — 문장은 하나로 옮기고 숫자 자리에만 마크업을 넣는다(수는 복수형을 고를 때만 쓴다).
  const facts=withMarks(t('{cuts}컷 · {sec}초 · {ratio}',{count:d.cuts.length}),{cuts:`<span class="sx-no">${d.cuts.length}</span>`,sec:`<span class="sx-no">${total.toFixed(1)}</span>`,ratio:`<span class="sx-no">${esc(d.ratio||'9:16')}</span>`});
  return `<figure class="sx-dr-films sx-sheet-room"><div class="sx-sheet"><header class="sx-sheet-head"><span class="sx-small">${esc(t('글 콘티 {round}판',{round:String(d.round)}))}</span><span class="sx-small">${facts}</span></header><div class="sx-sheet-rows" data-strip role="listbox" aria-label="${esc(t('컷 목록'))}">${rows}<i class="sx-strip-head" data-head hidden></i></div><footer class="sx-sheet-foot"><p class="sx-small sx-strip-tc"><span class="sx-strip-at"><span data-tc-no>${esc(t('컷 {n}',{n:'01'}))}</span> · <span data-tc>0:00</span></span></p></footer></div></figure>`;
}
export function draftView(d,{top='',head='',journal=''}={}){
  const total=d.cuts.reduce((sum,cut)=>sum+cut.seconds,0),script=d.cuts.every(cut=>!cut.src),locked=d.approved?t('이 판은 확인을 마쳤어요.'):d.feedbackAt?t('보내 주신 의견을 반영하고 있어요. 새 판이 오면 알려 드려요.'):'';
  // 크레딧 한 줄: 문장 하나로 옮기고 「영상 전 확인 2/3」의 숫자 자리에만 마크업을 넣는다.
  const facts={round:String(d.round),count:d.cuts.length,sec:total.toFixed(1)},step=`<b class="sx-no">${script?'2':'3'}/3</b>`;
  // 사진 상품의 첫 장(2026-11-12 — 그림이 붙은 판, d.photo): 첫 장으로 방향을 맞추는 판이라 초 · 「영상 전 확인」 · 움직임 안내가 없다 — 크레딧 · 의견 칸 · 안내 · 결정 글 · 단추를 「첫 장 · 장」 말로.
  // 글만 든 판은 사진 상품이어도 방 · 일지 · 대본 장과 같이 「글 콘티」 말 그대로다(같은 판을 두 이름으로 부르지 않는다).
  const photo=!!d.photo&&!script;
  const credit=photo?withMarks(t('첫 장 · {round}판 · {count}장',facts),{}):withMarks(script?t('글 콘티 · {round}판 · {count}컷 · {sec}초 · 영상 전 확인 {step}',facts):t('장면 이미지 · {round}판 · {count}컷 · {sec}초 · 영상 전 확인 {step}',facts),{step});
  return `<div class="sx-draft sx-dr ${script?'is-script':''}${photo?' is-photo':''}" data-draft data-ratio="${esc(d.ratio||'9:16')}">
    ${head}
    ${script?scriptSheet(d,total):`<figure class="sx-dr-films"><div class="sx-dr-box" data-frame-box><img data-frame ${d.cuts[0].src?`src="${esc(d.cuts[0].src)}"`:'hidden'} alt=""></div></figure>`}
    <header class="sx-dr-left">
      ${top}
      <div class="sx-dr-credit"><p class="sx-small">${credit}</p><p class="sx-small sx-dr-oneline-label">${esc(t('광고가 남길 한 문장'))}</p><h1 class="sx-serif" data-draft-title>${esc(d.oneLine)}</h1>${d.note?`<p class="sx-small sx-draft-note">${esc(d.note)}</p>`:''}</div>
      ${journal}
      ${d.model?`<div class="sx-draft-cast"><img src="${esc(d.look?.outfitSrc||modelScene(d.model.id))}" alt=""${d.look?.outfitSrc?' class="is-outfit"':''}><span class="sx-small"><b>${esc(nameOf(d.model.name))}</b> ${esc(t(d.model.line))}${d.look?`<span class="sx-draft-look">${esc(lookLine(d.look))}</span>`:''}${script&&!locked?` <button type="button" class="sx-quiet" data-draft-do="recast">${esc(t('다른 모델로 바꾸기'))}</button>`:''}</span></div>`:d.persona?`<div class="sx-draft-cast">${d.persona.image?`<img src="${esc(d.persona.image)}" alt="">`:''}<span class="sx-small"><b>${esc(d.persona.name)}</b> ${esc(t('이번 광고에 쓰기로 하신 맞춤 인물'))}</span></div>`:''}
    </header>
    <aside class="sx-dr-right">
      <p class="sx-no sx-draft-cut"><b data-cut-no>01</b> / ${pad(d.cuts.length)} <span class="sx-small" data-cut-sec>${photo?'':esc(secs(d.cuts[0].seconds))}</span></p>
      <h2 class="sx-serif sx-draft-what" data-cut-what>${esc(d.cuts[0].what)}</h2>
      <dl class="sx-kv is-tight"><div><dt>${esc(t('말',null,'cut'))}</dt><dd data-cut-say>${esc(d.cuts[0].say||t('없음'))}</dd></div><div><dt>${esc(t('화면 글자'))}</dt><dd data-cut-text>${esc(d.cuts[0].text||t('없음'))}</dd></div></dl>
      ${locked?'':`<div class="sx-draft-react"><button type="button" class="sx-chip sx-react" data-draft-do="ok" aria-pressed="false">${esc(t('좋아요'))}</button><button type="button" class="sx-chip sx-react" data-draft-do="fix" aria-pressed="false">${esc(t('고칠 곳이 있어요'))}</button></div>
      <label class="sx-field sx-draft-comment" data-comment hidden><span class="sx-small">${esc(photo?t('이 장에서 무엇을 바꾸면 좋을까요?'):t('이 컷에서 무엇을 바꾸면 좋을까요?'))}</span><textarea rows="2" maxlength="1000" placeholder="${esc(t('예) 강아지가 조금 더 크게 보이면 좋겠어요'))}" data-comment-input></textarea></label>`}
      <p class="sx-small sx-draft-warn">${esc(photo?t('첫 장으로 방향을 맞춰요. 의견을 주시면 그 결로 나머지 장을 만들어요.'):script?t('글이 맞으면 컷마다 장면 이미지를 만들어 보여 드려요. 장면 이미지는 그 컷의 첫 화면이라 움직이는 동안 작은 부분은 달라질 수 있어요.'):t('장면 이미지는 그 컷의 첫 화면이에요. 움직이는 동안 작은 부분은 달라질 수 있어요. 제품 · 로고 · 글자는 실제 파일을 얹고, 글자를 또렷이 읽어야 하는 컷은 멈춘 컷으로 잡아요.'))}</p>
      <div class="sx-draft-decide"><p class="sx-small" data-decide-note>${esc(locked||(photo?t('첫 장을 보고 의견을 남겨 주세요.'):t('컷을 하나씩 보고 의견을 남겨 주세요.')))}</p>${locked?'':`<button type="button" class="sx-go is-solid" data-draft-do="send" hidden><span>${withMarks(t('의견 보내기 {n}'),{n:'<b class="sx-no" data-count>0</b>'})}</span>${arrow}</button><button type="button" class="sx-go is-solid" data-draft-do="approve"><span>${esc(photo?t('이 첫 장대로 진행'):script?t('이대로 장면 이미지 만들기'):t('이대로 제작 시작'))}</span>${arrow}</button>`}</div>
    </aside>
    ${script?'':`<div class="sx-dr-bottom sx-draft-strip"><div class="sx-strip-run" data-strip role="listbox" aria-label="${esc(photo?t('사진 목록'):t('컷 목록'))}">${d.cuts.map((cut,i)=>`<button type="button" class="sx-strip-cut ${i===0?'is-on':''}" role="option" aria-selected="${i===0?'true':'false'}" aria-label="${esc(cutName(i,cut,'',photo))}" data-cut="${i}" data-w="${cut.seconds}">${cut.src?`<img src="${esc(cut.src)}" alt="" loading="lazy" decoding="async">`:''}<span class="sx-no sx-strip-no">${pad(i+1)}</span><i class="sx-strip-state" aria-hidden="true"></i></button>`).join('')}<i class="sx-strip-head" data-head aria-hidden="true"></i></div><p class="sx-small sx-strip-tc"><button type="button" class="sx-dr-play" data-draft-do="play"><i aria-hidden="true"></i><span data-play-label>${esc(t('차례로 보기'))}</span></button><span class="sx-strip-at"><span data-tc-no>${esc(t('컷 {n}',{n:'01'}))}</span> · <span data-tc>0:00</span></span></p></div>`}
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
  function moveHead(seconds){const head=$('[data-head]');head.style.setProperty('--x',String(seconds/total));}
  function show(index,{quick=false}={}){
    clearTimeout(nextTimer);at=index;const cut=d.cuts[index];
    const image=$('[data-frame]');if(image){image.hidden=!cut.src;if(cut.src)image.src=cut.src;}$('[data-cut-no]').textContent=pad(index+1);$('[data-cut-sec]').textContent=d.photo?'':secs(cut.seconds);$('[data-cut-what]').textContent=cut.what;$('[data-cut-say]').textContent=cut.say||t('없음');$('[data-cut-text]').textContent=cut.text||t('없음');$('[data-tc-no]').textContent=t('컷 {n}',{n:pad(index+1)});$('[data-tc]').textContent=moment(startOf(index));
    if(!quick&&image)play(image,[{opacity:.35},{opacity:1}],{duration:240});
    cuts.forEach((el,i)=>{el.classList.toggle('is-on',i===index);el.setAttribute('aria-selected',i===index?'true':'false');});
    // 페이지가 아니라 필름 띠만 옮긴다.
    const el=cuts[index],run=$('[data-strip]'),moveBy=reduced()||quick?'auto':'smooth';if(run.scrollWidth>run.clientWidth)run.scrollTo?.({left:el.offsetLeft-(run.clientWidth-el.offsetWidth)/2,behavior:moveBy});else if(run.scrollHeight>run.clientHeight)run.scrollTo?.({top:el.offsetTop-(run.clientHeight-el.offsetHeight)/2,behavior:moveBy});
    if(!playing)moveHead(startOf(index));
    syncReact();
  }
  // 고칠 곳을 적어 두면 주 단추가 「의견 보내기」로 바뀐다. 의견을 적어 둔 채 제작이 시작되는 일이 없게 한다.
  function syncReact(){
    cuts.forEach((el,i)=>{el.dataset.state=state[i].react;el.setAttribute('aria-label',cutName(i,d.cuts[i],state[i].react,d.photo));});
    onChange?.(state,at);
    if(!$('.sx-react'))return;
    const s=state[at],script=d.cuts.every(cut=>!cut.src);
    host.querySelectorAll('.sx-react').forEach(el=>{const on=el.dataset.draftDo===s.react;el.classList.toggle('is-on',on);el.setAttribute('aria-pressed',on?'true':'false');});
    const box=$('[data-comment]'),input=$('[data-comment-input]');box.hidden=s.react!=='fix';if(input.value!==s.note)input.value=s.note;
    const fixes=state.filter(item=>item.react==='fix'),blank=fixes.filter(item=>!item.note.trim()).length,seen=state.filter(item=>item.react).length;
    $('[data-count]').textContent=fixes.length;$('[data-draft-do="send"]').hidden=!fixes.length;$('[data-draft-do="approve"]').hidden=!!fixes.length;
    $('[data-decide-note]').textContent=blank?t('고칠 곳 {total}개 중 {count}개가 비어 있어요. 무엇을 바꾸면 좋을지 적어 주세요.',{total:fixes.length,count:blank}):fixes.length?t('고칠 곳 {count}개를 모았어요. 보내 주시면 반영한 판을 다시 보여 드려요.',{count:fixes.length}):seen===d.cuts.length?(d.photo?t('다 확인하셨어요. 이대로 괜찮으면 이 첫 장대로 진행해요.'):script?t('모든 컷을 확인하셨어요. 이대로 괜찮으면 장면 이미지를 만들어요.'):t('모든 컷을 확인하셨어요. 이대로 괜찮으면 제작을 시작해요.')):seen?(d.photo?t('{total}장 중 {count}장을 확인하셨어요.',{total:d.cuts.length,count:seen}):t('{total}컷 중 {count}컷을 확인하셨어요.',{total:d.cuts.length,count:seen})):d.photo?t('첫 장을 보고 의견을 남겨 주세요.'):t('컷을 하나씩 보고 의견을 남겨 주세요.');
  }
  const playLabel=on=>{const label=$('[data-play-label]');if(label)label.textContent=on?t('멈춤'):t('차례로 보기');};
  function stop(){clearTimeout(nextTimer);playing=false;delete host.dataset.playing;cancelAnimationFrame(timer);$('.sx-dr-play')?.classList.remove('is-playing');playLabel(false);}
  function playAll(){
    if(playing){stop();return;}
    if(!$('.sx-dr-play'))return;
    playing=true;host.dataset.playing='true';$('.sx-dr-play').classList.add('is-playing');playLabel(true);
    startTime=performance.now()-startOf(at)*1000;
    const tick=now=>{const t=(now-startTime)/1000;if(t>=total){stop();show(0);return;}moveHead(t);$('[data-tc]').textContent=moment(t);let index=d.cuts.length-1;for(let i=0;i<d.cuts.length;i++){if(t<startOf(i+1)){index=i;break;}}if(index!==at)show(index,{quick:true});timer=requestAnimationFrame(tick);};
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
