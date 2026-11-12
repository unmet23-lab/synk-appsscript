import {request as send,esc,day} from './api.mjs';
import {t,k,locale} from './i18n.mjs';
import {localeMenu,LOCALE_EVENT} from './locale-menu.mjs';

// 「내 모델」(판 4, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_설계_20261110.md 5-2 · 5-3 · 5-6 · 6절): 고객 SYNK ID 회원 경로(/api/customer/pulse/*)만 부른다.
// 초대 세션(/pulse 쿠키)과 따로 돈다 — 여기의 401은 「SYNK ID로 로그인」이지 프로젝트 연결이 끝난 것이 아니다(app.mjs mutate를 거치지 않는다).
// 화면은 의뢰서처럼 #request-root 덮개에서 돈다. 스위치 myModels가 꺼져 있으면 앱이 이 모듈을 부르지 않는다(입구가 없다).
// 카드: 대표 그림 · 이름 · 상태 한 줄(쓸 수 없으면 회색 카드와 까닭) · 보관 끝 · 마지막 사용 · 「이 모델로 의뢰」. 브랜드 관리자(admin)는 보관 대기 · 보관 동의(처음 · 연장 · 다시 켜기) ·
// 다시 쓰기 끄기 · 사용 멈추기 · 삭제 요청을 더 본다. 동의 조건은 서버가 계산한 terms 그대로 문장으로 그리고, 해시(viewedHash)도 서버 값만 보낸다.
// 그리기는 순수 함수 myModelsView(상태)이고(서버 응답 그대로 시험한다), mountMyModels가 상태 · 듣개 · 요청을 쥔다.

const arrow='<svg class="sx-arw" viewBox="0 0 40 16" aria-hidden="true"><path d="M0 8h38M31 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const BASE='/api/customer/pulse';
// 까닭 한 줄(서버 personaUsability의 reason · 계산한 상태). 모르는 값은 「지금은 쓸 수 없어요」.
export const MODEL_REASON=Object.freeze({expired:k('다시 쓰기 기한이 지났어요'),paused:k('사용을 멈췄어요'),retired:k('사용을 마쳤어요'),withdrawn:k('사용을 마쳤어요'),deleting:k('지우는 중이에요'),deleted:k('지운 모델이에요'),reuse_off:k('다시 쓰기가 꺼져 있어요'),revision:k('새 판을 준비하고 있어요'),closed:k('지금은 쓸 수 없어요'),workspace:k('지금은 쓸 수 없어요'),status:k('지금은 쓸 수 없어요')});
// 보관 자료 이름(서버 reuseTerms materials).
const MATERIAL=Object.freeze({reference:k('기준 얼굴'),motion:k('동작 시안'),'model-files':k('이 모델을 다시 만드는 데 필요한 파일')});
// 관리자 확인 화면(다시 쓰기 끄기 · 사용 멈추기 · 삭제 요청): 제목 · 무슨 일이 생기는지 · 단추 · 보낼 주소 · 끝난 뒤 알림.
// keep(11-11 화면 최종 검수 F3): 끄거나 멈춰도 지우는 날은 그대로다(서버 brandDeleteAt — 철회 · 중지 · 기한 지남 모두 같은 시계). 그날이 아직 남았을 때만 한 줄 더 보인다.
export const MODEL_ASK=Object.freeze({
  withdraw:{title:k('다시 쓰기를 끌까요?'),text:k('끄면 이 모델로 새 의뢰를 할 수 없어요. 진행 중인 광고는 담당자가 확인해 연락드려요. 다시 켜려면 보관 동의를 새로 해 주세요.'),go:k('다시 쓰기 끄기'),path:'/reuse/withdraw',done:k('다시 쓰기를 껐어요.'),keep:k('끄더라도 그림과 파일은 {date}까지 두고, 그날 전에 다시 동의하지 않으면 지워요.')},
  stop:{title:k('이 모델의 사용을 멈출까요?'),text:k('멈추면 바로 이 모델로 새 의뢰 · 사용 확인 · 제작 시작을 할 수 없어요. 이미 만들고 있는 광고는 저절로 멈추지 않아요 — 담당자가 확인해요. 이미 공개한 광고를 내리는 일은 담당자와 따로 정해요. 다시 쓰려면 담당자가 멈춤을 푼 뒤 보관 동의를 새로 해 주세요.'),go:k('사용 멈추기'),path:'/stop',done:k('이 모델의 사용을 멈췄어요. 담당자가 진행 중인 광고를 확인해요.'),keep:k('멈추더라도 그림과 파일은 {date}까지 두고, 그날 전에 담당자가 멈춤을 푼 뒤 다시 동의하지 않으면 지워요.')},
  delete:{title:k('이 모델의 삭제를 요청할까요?'),text:k('담당자가 확인한 뒤 이 모델의 그림과 파일을 지워요. 이 모델을 쓰는 진행 중인 광고가 있으면 그 일을 먼저 정리해요. 지운 뒤에는 되돌릴 수 없어요.'),go:k('삭제 요청 보내기'),path:'/delete-request',done:k('삭제 요청을 보냈어요. 담당자가 확인한 뒤 지워요.')},
});
// 한국 날짜(YYYY-MM-DD)로 — 보관 끝은 그날 한국 시각 끝 순간(ISO)이라 그 날짜를 그대로 보인다.
const kstDay=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Date(at+9*3600000).toISOString().slice(0,10):'';};
const dateOf=value=>{const d=kstDay(value);return d?day(d):'';};
const freshKey=()=>globalThis.crypto?.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
const nameOf=card=>card?.name||t('이름 없는 모델');
const face=card=>card?.image?`<img src="${esc(card.image)}" alt="" loading="lazy" decoding="async">`:'';
const alertOf=st=>st.error?`<div class="sx-invite-alert sx-mm-alert" role="alert"><p>${esc(st.error)}</p></div>`:'';

function gate(st){
  const off=st.session&&st.session.loginAvailable===false;
  return `<section class="sx-mm-gate"><p class="sx-kicker">${esc(t('내 모델'))}</p><h1 class="sx-display" tabindex="-1" data-mm-title>${esc(t('브랜드에 보관한 모델로 다음 광고를 맡겨요'))}</h1>
    <p class="sx-body">${esc(t('SYNK ID로 로그인하면 브랜드에 보관한 모델을 보고, 사진을 다시 보내지 않고 다음 광고를 맡길 수 있어요.'))}</p>
    ${st.failed?`<div class="sx-invite-alert" role="alert"><strong>${esc(t('로그인을 마치지 못했어요'))}</strong><p>${esc(t('다시 시도해 주세요. 계속 안 되면 담당자에게 알려 주세요.'))}</p></div>`:''}${alertOf(st)}
    <div class="sx-mm-gate-act"><button type="button" class="sx-go is-solid" data-mm-do="login" ${off||st.busy?'disabled':''}><span>${esc(t('SYNK ID로 로그인'))}</span>${arrow}</button></div>
    <p class="sx-small">${esc(off?t('지금은 SYNK ID 로그인을 쓸 수 없어요. 잠시 뒤 다시 열어 주세요.'):t('브랜드 회원만 볼 수 있어요. 이미 회원이면 위에서 로그인해 주세요. 아직이면 맞춤 인물이 있는 의뢰의 고객 방에서 「내 모델로 모아 두기」를 눌러 주세요 — 담당자가 확인하고 브랜드에 연결해 드려요.'))}</p></section>`;
}
function stateLine(card){
  // 삭제 요청은 쓰기를 막지 않는다(서버가 쓸 수 있는지를 따로 정하고, 담당자가 지우기 시작하면 그때 막힌다) — 쓸 수 있는 동안은 「쓸 수 있어요」와 요청 줄을 따로 두지 않고 상태 한 줄로.
  if(card.deletionRequested&&card.usable)return `<p class="sx-small sx-mm-state"><i class="sx-led is-wait" aria-hidden="true"></i>${esc(t('삭제 요청됨 — 담당자가 지우기 전까지는 새 광고에 쓸 수 있어요'))}</p>`;
  const ok=card.usable,text=ok?t('새 광고에 쓸 수 있어요'):t(MODEL_REASON[card.reason]||MODEL_REASON[card.status]||MODEL_REASON.status);
  return `<p class="sx-small sx-mm-state"><i class="sx-led ${ok?'is-ok':'is-wait'}" aria-hidden="true"></i>${esc(text)}</p>${card.deletionRequested?`<p class="sx-small sx-mm-state">${esc(t('삭제 요청을 받았어요. 담당자가 확인하고 있어요.'))}</p>`:''}`;
}
function meta(card){
  // 지우는 날(11-11 판 4 설계 11-3)은 지금 새 광고에 쓸 수 없는 모델(기한 지남 · 다시 쓰기 꺼짐 · 사용 멈춤)에만 — 그날 전에 다시 동의하면 계속 쓴다.
  const rows=[card.until&&[t('다시 쓰기 기한'),dateOf(card.until)],!card.usable&&card.deleteAt&&[t('지우는 날'),dateOf(card.deleteAt)],card.lastUsedAt&&[t('마지막 사용'),dateOf(card.lastUsedAt)]].filter(row=>row&&row[1]);
  return rows.length?`<dl class="sx-mm-meta sx-small">${rows.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:'';
}
// 관리자 일: 보관(연장 · 다시 켜기 — 서버가 지금 동의를 받을 수 있을 때만 consent를 준다) · 다시 쓰기 끄기 · 사용 멈추기(저장 상태가 ready일 때 — 기간이 끝난 모델도) · 삭제 요청.
function manage(ws,card){
  const at=`data-ws="${esc(ws.id)}" data-id="${esc(card.id)}"`,list=[];
  if(card.consent)list.push(`<button type="button" class="sx-quiet" data-mm-do="consent" ${at}>${esc(card.reuse?t('기한 연장'):t('다시 쓰기 켜기'))}</button>`);
  if(card.reuse&&card.status!=='deleting')list.push(`<button type="button" class="sx-quiet" data-mm-do="ask" data-ask="withdraw" ${at}>${esc(t('다시 쓰기 끄기'))}</button>`);
  if(['ready','expired'].includes(card.status))list.push(`<button type="button" class="sx-quiet" data-mm-do="ask" data-ask="stop" ${at}>${esc(t('사용 멈추기'))}</button>`);
  if(!card.deletionRequested&&card.status!=='deleting')list.push(`<button type="button" class="sx-quiet" data-mm-do="ask" data-ask="delete" ${at}>${esc(t('삭제 요청'))}</button>`);
  return list.length?`<div class="sx-mm-manage">${list.join('')}</div>`:'';
}
function modelCard(ws,card){
  return `<li class="sx-mm-card ${card.usable?'':'is-off'}"><figure class="sx-mm-face ${card.image?'':'is-empty'}">${face(card)}</figure><div class="sx-mm-info"><h3 class="sx-serif">${esc(nameOf(card))}</h3>${stateLine(card)}${meta(card)}
    ${card.usable?`<button type="button" class="sx-go" data-mm-do="request" data-ws="${esc(ws.id)}" data-id="${esc(card.id)}"><span>${esc(t('이 모델로 의뢰'))}</span>${arrow}</button>`:''}${ws.role==='admin'?manage(ws,card):''}</div></li>`;
}
// 보관 대기(관리자만): 원 프로젝트가 이 브랜드에 연결됐고 준비가 끝난 인물. 보관을 정하면 이 브랜드의 내 모델로 들어온다.
function pendingCard(ws,card){
  // 90일 시계(판 4 설계 11-6): 그 광고가 제작으로 이어지지 않은 채 멈춰 있으면 서버가 지우는 날을 싣는다 — 보관에 동의하면 브랜드 시계로 옮겨 가고,
  // 원래 광고가 다시 움직이거나 제작으로 이어져도 날이 옮겨 가거나 사라진다(그래서 「보관하지 않으면 지운다」가 아니라 「원래 광고에 진행이 없으면」 — 화면 검수 A2).
  const clock=dateOf(card.deleteAt);
  return `<li class="sx-mm-card is-pending"><figure class="sx-mm-face ${card.image?'':'is-empty'}">${face(card)}</figure><div class="sx-mm-info"><h3 class="sx-serif">${esc(nameOf(card))}</h3><p class="sx-small sx-mm-state">${esc(t('광고 하나를 위해 만든 모델이에요. 보관을 정하면 이 브랜드 회원들이 다음 광고에도 쓸 수 있어요.'))}</p>${clock?`<p class="sx-small sx-mm-state sx-mm-clock">${esc(t('원래 광고에 진행이 없으면 {date}에 지워요. 그 전에 보관을 정하면 남겨 둬요.',{date:clock}))}</p>`:''}
    ${card.consent?`<button type="button" class="sx-go" data-mm-do="consent" data-ws="${esc(ws.id)}" data-id="${esc(card.id)}" data-pending="1"><span>${esc(t('다음 광고에도 쓰기'))}</span>${arrow}</button>`:''}</div></li>`;
}
function list(st){
  const brands=st.data?.workspaces||[];
  if(!brands.length)return `<section class="sx-mm-gate"><p class="sx-kicker">${esc(t('내 모델'))}</p><h1 class="sx-display" tabindex="-1" data-mm-title>${esc(t('아직 연결된 브랜드가 없어요'))}</h1>${alertOf(st)}<p class="sx-body">${esc(t('맞춤 인물이 있는 의뢰의 고객 방에서 「내 모델로 모아 두기」를 누르면, 담당자가 확인하고 브랜드에 연결해 드려요. 연결되면 여기에서 그 브랜드의 모델을 볼 수 있어요.'))}</p></section>`;
  return `<header class="sx-mm-head"><p class="sx-kicker">${esc(t('내 모델'))}</p><h1 class="sx-display" tabindex="-1" data-mm-title>${esc(t('브랜드에 보관한 모델'))}</h1><p class="sx-body">${esc(t('고르면 사진을 다시 보내지 않고 다음 광고를 맡길 수 있어요. 광고마다 쓸 범위는 담당자가 정리해 따로 확인받아요.'))}</p>${alertOf(st)}</header>
    ${brands.map(ws=>`<section class="sx-mm-brand" aria-label="${esc(ws.name)}"><header class="sx-mm-brand-head"><h2 class="sx-serif">${esc(ws.name)}</h2><span class="sx-small">${esc(ws.role==='admin'?t('브랜드 관리자'):t('브랜드 회원'))}</span></header>
      ${ws.models.length?`<ol class="sx-mm-cards">${ws.models.map(card=>modelCard(ws,card)).join('')}</ol>`:`<p class="sx-small sx-mm-none">${esc(t('아직 보관한 모델이 없어요.'))}</p>`}
      ${ws.pending?.length?`<div class="sx-mm-pending"><h3 class="sx-small">${esc(t('보관 동의를 기다리는 모델'))} <b class="sx-no">${ws.pending.length}</b></h3><ol class="sx-mm-cards">${ws.pending.map(card=>pendingCard(ws,card)).join('')}</ol></div>`:''}</section>`).join('')}`;
}
// 보관 동의 화면(설계 5-2): 서버가 준 terms를 문장으로 — 쓰는 곳 · 보관하는 것 · 쓸 수 있는 사람 · 보관 끝 · 그만두기 · 백업.
function consent(st){
  const {ws,card}=st.pick,terms=card.consent?.terms||{},first=!card.reuse;
  const materials=(terms.materials||[]).map(id=>MATERIAL[id]?t(MATERIAL[id]):'').filter(Boolean).join(' · ');
  // 11-11 결정 표 ① · ④ · ⑥(판 4 설계 11-4): 12개월 · 기한 뒤 30일에 지움 · 지운 뒤 백업 최대 13개월 · 오래 두는 보관 사본(금고) 제외 — 서버 terms v2 값 그대로.
  const rows=[[t('쓰는 곳'),t('브랜드 「{brand}」의 다음 광고예요. 광고마다 쓸 범위를 따로 확인받아요.',{brand:terms.workspaceName||ws.name})],[t('보관하는 것'),materials],[t('쓸 수 있는 사람'),t('이 브랜드의 회원 모두 — 내 모델에서 이 모델로 의뢰할 수 있어요.')],
    [t('다시 쓰기 기한'),t('오늘부터 {months}개월, {date}까지예요. 그 뒤에 새 광고에 쓰려면 보관 동의를 새로 해 주세요.',{date:dateOf(terms.until),months:Number(terms.months)||12})],
    [t('기한이 끝나면'),terms.deleteAt?t('기한 30일 뒤인 {date}에 보내 주신 사진을 포함해 이 모델의 그림과 파일을 지워요. 그날 전에 다시 동의하면 계속 쓸 수 있어요. 그날 이 모델로 만들고 있는 광고가 있으면 그 광고를 다 만든 뒤에 지워요. 이미 받으신 광고 영상은 지우지 않아요.',{date:dateOf(terms.deleteAt)}):''],
    [t('그만두는 법'),t('내 모델에서 언제든 다시 쓰기를 끄거나 삭제를 요청할 수 있어요.')],
    [t('백업'),t('지운 뒤에도 서버 백업 사본에는 최대 {months}개월 남았다가 차례로 지워져요. 오래 두는 별도 보관 사본에는 처음부터 넣지 않아요.',{months:Number(terms.backup?.maxMonths)||13})]].filter(([,value])=>value);
  return `<article class="sx-mm-paper"><p class="sx-kicker">${esc(first?t('보관 동의'):t('기한 연장'))} · ${esc(ws.name)}</p><h1 class="sx-display" tabindex="-1" data-mm-title>${esc(t('다음 광고에도 이 모델을 쓸까요?'))}</h1>
    <div class="sx-mm-paper-main"><figure class="sx-mm-face ${card.image?'':'is-empty'}">${face(card)}<figcaption class="sx-small">${esc(nameOf(card))}</figcaption></figure>
    <dl class="sx-mm-terms">${rows.map(([key,value])=>`<div><dt class="sx-small">${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></div>${alertOf(st)}
    <div class="sx-mm-paper-act"><button type="button" class="sx-go is-solid" data-mm-do="consent-go" ${st.busy?'disabled':''}><span>${esc(first?t('동의하고 보관'):t('동의하고 연장'))}</span>${arrow}</button><button type="button" class="sx-quiet" data-mm-do="back">${esc(t('내 모델로 돌아가기'))}</button></div></article>`;
}
function ask(st){
  const {ws,card,kind}=st.pick,a=MODEL_ASK[kind],keep=a.keep&&Date.parse(card.deleteAt)>Date.now();
  return `<article class="sx-mm-paper is-ask"><p class="sx-kicker">${esc(nameOf(card))} · ${esc(ws.name)}</p><h1 class="sx-display" tabindex="-1" data-mm-title>${esc(t(a.title))}</h1><p class="sx-body">${esc(t(a.text))}</p>${keep?`<p class="sx-body" data-mm-keep>${esc(t(a.keep,{date:dateOf(card.deleteAt)}))}</p>`:''}
    <label class="sx-field"><span class="sx-small">${esc(t('까닭 · 선택'))}</span><textarea data-mm-note rows="2" maxlength="300" placeholder="${esc(t('예) 이번 시즌 캠페인이 끝났어요'))}">${esc(st.note||'')}</textarea></label>${alertOf(st)}
    <div class="sx-mm-paper-act"><button type="button" class="sx-go is-solid" data-mm-do="ask-go" ${st.busy?'disabled':''}><span>${esc(t(a.go))}</span>${arrow}</button><button type="button" class="sx-quiet" data-mm-do="back">${esc(t('내 모델로 돌아가기'))}</button></div></article>`;
}
// st: {view:'loading'|'login'|'list'|'consent'|'ask', session(/session 응답), data(/models 응답), pick:{ws,card,kind?}, note, error, failed(로그인 실패로 돌아옴), busy}.
export function myModelsView(st){
  return st.view==='loading'?`<p class="sx-small sx-mm-loading" role="status">${esc(t('내 모델을 불러오고 있어요.'))}</p>`:st.view==='login'?gate(st):st.view==='consent'&&st.pick?consent(st):st.view==='ask'&&st.pick?ask(st):list(st);
}
// 머리 오른쪽(언어 메뉴 · 로그인한 이름 · 로그아웃 · 닫기).
export function myModelsChrome(st){
  return `${localeMenu()}${st.session?.authenticated?`<span class="sx-mm-who">${esc(st.session.user?.name||'')}</span><button type="button" data-mm-do="logout">${esc(t('로그아웃'))}</button>`:''}<button type="button" data-mm-do="exit">${esc(t('닫기'))}</button>`;
}

// 다시 쓰기 붙이기(설계 4-1 · 5-4): 공개 의뢰서 초안(없으면 만든다) → 초안 증표 → 회원 경로로 붙인다. 성공하면 의뢰서를 그 초안으로 연다.
export async function attachToDraft({workspaceId,personaId,revisionId,csrf}){
  let {draft}=await send('/pulse/api/request');
  if(!draft||draft.status!=='draft')({draft}=await send('/pulse/api/request/start',{body:{}}));
  const {proof}=await send('/pulse/api/request/persona-proof',{csrf:draft.csrf,body:{}});
  return send(BASE+'/draft-persona',{member:true,csrf,body:{proof,workspaceId,personaId,revisionId}});
}

// onRequest({workspace,card,csrf,fail}): 「이 모델로 의뢰」 — 부른 쪽(app.mjs)이 붙이고 의뢰서를 연다(실패하면 fail(문장)으로 이 화면에 보인다).
// onLogin(): 로그인으로 떠나기 전에 돌아올 곳을 적는다. onNotice(문장): 끝난 일 알림(앱 알림 칸).
export function mountMyModels(root,{onExit,onRequest,onLogin,onNotice,loginFailed=false}){
  root.innerHTML=`<div class="sx-mm">
    <header class="sx-mm-top"><a class="sx-logo" href="./" data-mm-do="exit" aria-label="${esc(t('SYNK PULSE 처음으로'))}"><img src="./assets/request/logo-paper.webp" alt="SYNK PULSE" width="164" height="44"></a>
      <div class="sx-mm-top-right sx-small" data-mm-chrome></div></header>
    <main class="sx-mm-body" data-mm-body tabindex="-1"></main>
    <p class="sr" role="status" aria-live="polite" data-mm-live></p>
  </div>`;
  const host=root.querySelector('.sx-mm'),$=selector=>host.querySelector(selector),body=$('[data-mm-body]');
  const st={view:'loading',session:null,data:null,pick:null,note:'',error:'',failed:!!loginFailed,busy:false};
  let closed=false;
  const say=text=>{$('[data-mm-live]').textContent=text;};
  const memberCsrf=()=>st.session?.csrfToken||'';
  function paint({focus=true}={}){
    if(closed)return;
    $('.sx-logo')?.setAttribute('aria-label',t('SYNK PULSE 처음으로'));
    $('[data-mm-chrome]').innerHTML=myModelsChrome(st);host.dataset.view=st.view;
    body.innerHTML=myModelsView(st);
    if(focus)(body.querySelector('[data-mm-title]')||body).focus({preventScroll:true});
    body.scrollTop=0;
  }
  const brandOf=id=>(st.data?.workspaces||[]).find(ws=>ws.id===id)||null;
  const cardOf=(ws,id,pending)=>(pending?ws?.pending:ws?.models)?.find(card=>card.id===id)||null;
  const signedOut=()=>{st.session={...(st.session||{}),authenticated:false};st.view='login';};
  // 회원 경로의 401(로그인이 끝남 · 바뀜)은 로그인 화면으로. 그 밖의 오류는 지금 화면 위에 한 줄로.
  async function load(){
    try{
      st.session=await send(BASE+'/session');
      if(!st.session.authenticated){st.view='login';paint();return;}
      st.data=await send(BASE+'/models');st.failed=false;st.view='list';paint();
    }catch(err){if(err.status===401)signedOut();else{st.error=err.message;st.view=st.data?'list':'login';}paint();}
  }
  // 다른 탭에서 다시 로그인하면 이 화면이 쥔 보안 값(csrfToken)이 낡아 쓰기마다 403이 된다(같은 기기의 로그인 쿠키는 하나다).
  // 403이면 세션을 다시 읽어 새 값 · 지금 이름으로 바꾸고 서버 글을 보인다 — 다음 누름이 통한다. 다시 읽은 세션이 로그인 전이면 로그인 화면으로(판 4 다시 검수 P3).
  // 403은 다시 로그인한 때다 — 다시 읽은 세션이 로그인 상태면 이름과 상관없이 목록도 다시 읽는다(이름 없는 계정은 모두 「고객」이라 이름으로는 계정이 바뀐 줄 모른다, 최종 검수 F6 · 다시 검수 P3).
  // 계정이 바뀐 듯하면(보안 값이 달라짐) 고르던 카드를 놓고 목록으로. 목록을 못 읽으면 앞 목록을 비우지 않는다(「브랜드가 없어요」로 섞이지 않게) — 까닭은 부른 쪽이 보이는 서버 글.
  async function resync(){try{const before=st.session?.csrfToken||'',next=await send(BASE+'/session');st.session=next;if(next.authenticated){if(next.csrfToken!==before){st.pick=null;st.view='list';}try{st.data=await send(BASE+'/models');}catch{}}return !!next.authenticated;}catch{return true;}}
  async function act(run,{done=''}={}){
    if(st.busy)return;st.busy=true;st.error='';
    body.querySelectorAll('button[data-mm-do$="-go"]').forEach(button=>{button.disabled=true;});
    try{await run();st.busy=false;st.pick=null;st.view='list';await load();if(done){say(done);onNotice?.(done);}}
    catch(err){if(err.status===403&&!(await resync()))err={status:401};st.busy=false;if(err.status===401){signedOut();st.error='';}else st.error=err.message;paint({focus:false});}
  }
  const handlers={
    exit(event){event?.preventDefault?.();onExit?.();},
    async login(){
      if(st.busy)return;st.busy=true;st.error='';
      try{const {authorizationUrl}=await send(BASE+'/login',{body:{}}),url=new URL(authorizationUrl);if(url.protocol!=='https:'||url.username||url.password)throw new Error(t('로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.'));onLogin?.();location.assign(url.href);}
      catch(err){st.busy=false;st.error=err.message||t('로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.');paint({focus:false});}
    },
    // 로그아웃이 실패하면 로그아웃된 척하지 않는다 — 세션이 살아 있으니 지금 화면에 까닭을 보인다(401은 이미 나간 것). 판 4 화면 최종 검수 F3.
    // 403(다른 탭에서 다시 로그인해 보안 값이 낡음)은 세션을 다시 읽고 서버 글을 보인다 — 다음 누름은 새 값으로 간다. 다시 읽은 세션이 이미 나간 상태면 나간 것으로 본다.
    async logout(){if(st.busy)return;st.busy=true;st.error='';try{await send('/api/customer/logout',{member:true,csrf:memberCsrf(),body:{}});}catch(err){const gone=err.status===401||err.status===403&&!(await resync());if(!gone){st.busy=false;st.error=err.status===403?err.message:t('로그아웃하지 못했어요. 다시 시도해 주세요.');paint({focus:false});return;}}st.busy=false;st.session={authenticated:false,loginAvailable:st.session?.loginAvailable};st.data=null;st.view='login';paint();},
    request(el){const ws=brandOf(el.dataset.ws),card=cardOf(ws,el.dataset.id);if(!ws||!card)return;onRequest?.({workspace:ws,card,csrf:memberCsrf(),fail:message=>{st.error=message;paint({focus:false});}});},
    consent(el){const ws=brandOf(el.dataset.ws),card=cardOf(ws,el.dataset.id,!!el.dataset.pending);if(!ws||!card?.consent)return;st.pick={ws,card,key:freshKey()};st.error='';st.view='consent';paint();},
    ask(el){const ws=brandOf(el.dataset.ws),card=cardOf(ws,el.dataset.id);if(!ws||!card||!MODEL_ASK[el.dataset.ask])return;st.pick={ws,card,kind:el.dataset.ask};st.note='';st.error='';st.view='ask';paint();},
    back(){st.pick=null;st.error='';st.view='list';paint();},
    // 같은 화면에서 두 번 눌러도 같은 요청 키(서버가 「이미 받음」). 조건이 그사이 바뀌었으면(409) 새 조건으로 다시 그리고 다시 확인받는다.
    'consent-go'(){const {ws,card,key}=st.pick;return act(async()=>{
      try{await send(BASE+'/reuse',{member:true,csrf:memberCsrf(),body:{workspaceId:ws.id,personaId:card.id,revisionId:card.consent.revisionId,viewedHash:card.consent.viewedHash,idempotencyKey:key}});}
      catch(err){if(err.code==='SYNK_PULSE_REUSE_STALE'&&err.offer)st.pick={ws,card:{...card,consent:err.offer},key:freshKey()};throw err;}
    },{done:card.reuse?t('다시 쓰기 기한을 늘렸어요.'):t('이 모델을 내 모델에 보관했어요. 이 브랜드 회원들이 다음 광고에 쓸 수 있어요.')});},
    'ask-go'(){const {ws,card,kind}=st.pick,a=MODEL_ASK[kind];st.note=String(body.querySelector('[data-mm-note]')?.value||'').trim();return act(()=>send(BASE+a.path,{member:true,csrf:memberCsrf(),body:{workspaceId:ws.id,personaId:card.id,note:st.note}}),{done:t(a.done)});},
  };
  host.addEventListener('click',event=>{const el=event.target.closest('[data-mm-do]');if(!el||el.disabled)return;const what=el.dataset.mmDo;if(handlers[what]){if(what==='exit'){handlers.exit(event);return;}handlers[what](el);}});
  host.addEventListener('input',event=>{if(event.target.matches?.('[data-mm-note]'))st.note=event.target.value;});
  host.addEventListener('keydown',event=>{if(event.key==='Escape'&&!st.busy){if(['consent','ask'].includes(st.view))handlers.back();else onExit?.();}});
  // 언어를 바꾸면 지금 화면을 그 자리에서 다시 그린다(고른 카드 · 적던 까닭은 그대로).
  const onLocale=()=>{if(closed)return;const fromMenu=!!document.activeElement?.closest?.('.locale-menu');paint({focus:!fromMenu});if(fromMenu)host.querySelector(`.locale-menu [data-set-locale="${locale()}"]`)?.focus({preventScroll:true});};
  addEventListener(LOCALE_EVENT,onLocale);
  paint();void load();
  return {
    reload:()=>load(),
    unmount(){closed=true;removeEventListener(LOCALE_EVENT,onLocale);},
  };
}
