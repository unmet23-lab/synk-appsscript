// 배우기 · 놀이 「준비 중」 안내(유호님 11-24 「여기 지금 게임들 클릭하면 전부 준비중입니다! 27년 2월에 봐요 라고 띄워줘
// 전부 갈아 엎어야할것같아 엉망진창이야」). 배우기 판(생활 팩 판 · 팩 한 장 · 이야기 모음)과 놀이 판에서 레슨 · 게임 · 연습으로
// 들어가는 단추를 누르면, 들어가는 대신 「준비 중 · 2027년 2월」 판과 사전예약 단추를 띄운다.
// 우리 동네 홈 카드의 「복습」 · 「내 위치 보기」 · 「이번 주 계획」과, 홈의 「학습 목표」 판 안 「내 위치 보기」 줄도 막는다
// (11-24 유호님 「홈도 막기」 · 11-25 Fable 검수 P2: 학습 목표 판을 거쳐 내 위치 판으로 돌아가는 길). 서울행 이야기 · 내 길 · 1화 · 맞춤 앞면 ·
// 홈의 「맞춤 연습 시작」(튜터 세션 몫) · 아래 메뉴 · 닫기 · 학습 알림 묻기는 지나간다.
// 다시 짠 배우기가 준비되면 아래 한 줄을 false로 바꾼다. 판은 그대로 보이고, 누르면 예전처럼 열린다.
// 로컬 시험 서버(server.mjs)는 기존 레슨 · 게임 시험이 돌도록 <html data-learn-soon="off">로 연다. 그 문서에서는 막지 않는다. 공개본에는 이 표시가 없다.
export const LEARN_SOON=true;

// 배우기 · 놀이 판의 표시: 패널 내용이 이 가운데 하나를 품으면 막는 판이다.
// .life-hub 배우기 판 · .life-pack-head 팩 한 장 · .life-stories-poster 이야기 모음 · .play-list · .play-more 놀이 판 · .ws-songs-head 노래 목록
export const SOON_SCREENS='.life-hub,.life-pack-head,.life-stories-poster,.play-list,.play-more,.ws-songs-head';
// 들어가는 단추: 팩 · 레슨 · 다음 할 일 · 복습 · 이야기 · 내 위치 · 이번 주 계획 · 놀이 · 노래 · 쓰기 · 말하기.
// 팩 목록으로 돌아가기(data-life-packs) · 닫기(data-close) · 학습 알림 묻기(data-world="reminder-…")는 막지 않는다.
export const SOON_ENTRIES='[data-life-pack],[data-life-lesson],[data-life-next],[data-life-review],[data-life-stories],[data-view],[data-game],[data-world-game],[data-world-song],[data-world]:not([data-world^="reminder-"])';
// 우리 동네 홈 카드(패널 밖): 판을 거치지 않고 바로 열리는 「복습」 줄임 단추 · 「내 위치 보기」 · 「이번 주 계획」(시험을 고른 사람만)을 막는다.
// 「맞춤 연습 시작」(#life-next-button[data-view="learn"])은 지나간다. 카페 · 생활 팩 · 이야기 줄임 단추는 막는 판을 열어 그 안에서 막힌다.
export const SOON_HOME='.life-home-board';
export const SOON_HOME_ENTRIES='[data-view="review"],[data-life-review],[data-view="position"],[data-view="plan"]';
// 어느 판 안에서든 막는 단추: 학습 목표 · 도움 방식 판(홈 「학습 목표」가 연다)의 「내 위치 보기」 줄. 그 판의 다른 설정은 그대로 쓴다.
export const SOON_PANEL_ENTRIES='.study-position-row';

export const RESERVE_URL='https://synk.im/reserve/';
const RESERVE_FROM='world-learn';

export const SOON_TEXT={
 ko:{title:'준비 중이에요',lead:'2027년 2월에 만나요.',note:'사전예약하면 문을 여는 날 알려 드려요.',reserve:'사전예약하기',close:'닫기'},
 en:{title:'Coming soon',lead:'See you in February 2027.',note:'Pre-register and we’ll let you know the day it opens.',reserve:'Pre-register',close:'Close'},
 mn:{title:'Удахгүй нээгдэнэ',lead:'2027 оны 2-р сард уулзъя.',note:'Урьдчилан бүртгүүлбэл нээгдэх өдөр бид танд мэдэгдэнэ.',reserve:'Урьдчилан бүртгүүлэх',close:'Хаах'},
};

const pickLang=value=>Object.hasOwn(SOON_TEXT,value)?value:'ko';
export const reserveHref=lang=>`${RESERVE_URL}?from=${RESERVE_FROM}&lang=${pickLang(lang)}`;

/** 누른 곳이 막을 단추면 그 단추를, 아니면 null. 패널 내용(#panel-content) 안이면 배우기 · 놀이 판의 들어가는 단추와 학습 목표 판의 내 위치 줄, 패널 밖이면 홈 카드의 복습 · 내 위치 · 이번 주 계획. */
export function soonTarget(target,{on=LEARN_SOON}={}){
 if(!on||!target?.closest)return null;
 const button=target.closest('button,a[href]');if(!button)return null;
 const content=button.closest('#panel-content');
 if(!content)return button.closest(SOON_HOME)&&button.matches(SOON_HOME_ENTRIES)?button:null;
 if(button.matches(SOON_PANEL_ENTRIES))return button;
 if(!content.querySelector(SOON_SCREENS))return null;
 return button.matches(SOON_ENTRIES)?button:null;
}

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** 안내 판 속. 데스크톱 앱 창은 /reserve/로 가지 못해(출시 안내 띠와 같다) 사전예약 단추를 빼고 「닫기」를 채운 단추로 둔다. */
export function soonMarkup(lang,{art='',desktop=false}={}){
 const l=pickLang(lang),s=SOON_TEXT[l];
 return `<div class="learn-soon-sheet" lang="${l}">${art?`<img class="learn-soon-art" src="${esc(art)}" alt="" width="640" height="640" decoding="async">`:''}<h2 id="learn-soon-title" class="learn-soon-title">${esc(s.title)}</h2><p class="learn-soon-lead">${esc(s.lead)}</p>${desktop?'':`<p class="learn-soon-note">${esc(s.note)}</p>`}<div class="learn-soon-actions">${desktop?'':`<a class="learn-soon-reserve" href="${esc(reserveHref(l))}">${esc(s.reserve)} <span aria-hidden="true">→</span></a>`}<button type="button" class="learn-soon-close${desktop?' is-only':''}" data-learn-soon-close>${esc(s.close)}</button></div></div>`;
}

const STYLE=`
dialog.learn-soon{--soon-paper:#F3EEE6;--soon-ink:#161513;--soon-ink-2:#4C4842;--soon-btn:#2A2420;--soon-line:rgba(42,36,32,.32);
 width:min(360px,calc(100vw - 32px));max-height:calc(100dvh - 32px);margin:auto;padding:0;border:0;border-radius:28px;background:var(--soon-paper);color:var(--soon-ink);
 box-shadow:0 28px 80px rgba(30,20,10,.32);overflow:auto;color-scheme:light}
dialog.learn-soon::backdrop{background:rgba(12,10,8,.46)}
dialog.learn-soon[open]{animation:learn-soon-in .22s cubic-bezier(.2,.8,.2,1)}
@keyframes learn-soon-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){dialog.learn-soon[open]{animation:none}}
.learn-soon-sheet{display:flex;flex-direction:column;align-items:center;gap:8px;padding:28px 24px 24px;text-align:center;font-family:var(--w-sans,system-ui,sans-serif);word-break:keep-all;overflow-wrap:anywhere}
.learn-soon-sheet :is(h2,p){text-wrap:balance}
.learn-soon-art{display:block;width:112px;height:112px;margin:0 0 6px;object-fit:contain;mix-blend-mode:multiply}
.learn-soon-title{margin:0;font-size:24px;font-weight:800;line-height:1.25;letter-spacing:-.02em;color:var(--soon-ink)}
.learn-soon-lead{margin:0;font-size:18px;font-weight:650;line-height:1.45;color:var(--soon-ink)}
.learn-soon-note{margin:4px 0 0;font-size:14px;font-weight:450;line-height:1.5;color:var(--soon-ink-2)}
.learn-soon-actions{display:flex;flex-direction:column;align-self:stretch;gap:8px;margin-top:16px}
.learn-soon-reserve,.learn-soon-close{display:flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 20px;border-radius:999px;
 font:inherit;font-size:16px;font-weight:700;line-height:1.2;text-decoration:none;cursor:pointer}
.learn-soon-reserve{background:var(--soon-btn);color:#fff;box-shadow:0 10px 24px rgba(30,20,10,.14)}
.learn-soon-close{border:0;background:transparent;color:var(--soon-ink);box-shadow:inset 0 0 0 1.5px var(--soon-line)}
.learn-soon-close.is-only{background:var(--soon-btn);color:#fff;box-shadow:0 10px 24px rgba(30,20,10,.14)}
.learn-soon-reserve:focus-visible,.learn-soon-close:focus-visible{outline:2px solid var(--soon-btn);outline-offset:3px}
@media (hover:hover){.learn-soon-reserve:hover,.learn-soon-close.is-only:hover{box-shadow:0 0 0 4px rgba(42,36,32,.12),0 10px 24px rgba(30,20,10,.14)}.learn-soon-close:not(.is-only):hover{background:rgba(22,21,19,.06)}}
`;

/**
 * 배우기 · 놀이 판의 막을 단추를 가로채 안내 판을 띄운다. window 캡처 단계에서 듣기 때문에 셸 · 홈 · 생활 화면의 click보다 먼저다.
 * lang: 화면 언어(ko · en · mn)를 돌려주는 함수 · art: 펠트 그림 주소 · desktop: 데스크톱 앱 창인지(사전예약 단추를 뺀다).
 * 돌려주는 값: {open, close, dispose}. LEARN_SOON이 꺼져 있으면 아무것도 듣지 않는다.
 */
export function installLearnSoon({win=globalThis.window,lang=()=>'ko',art='',desktop=()=>{try{return !!(win.synkDesktop||win.synkProduct);}catch{return false;}},on=LEARN_SOON}={}){
 if(!on||!win?.document)return {open(){},close(){},dispose(){}};
 const doc=win.document;let dialog=null,returnTo=null;
 function ensure(){
  if(dialog?.isConnected)return dialog;
  if(!doc.getElementById('learn-soon-style')){const style=doc.createElement('style');style.id='learn-soon-style';style.textContent=STYLE;doc.head.append(style);}
  dialog=doc.createElement('dialog');dialog.className='learn-soon';dialog.setAttribute('aria-labelledby','learn-soon-title');
  dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest?.('[data-learn-soon-close]'))close();});
  dialog.addEventListener('close',()=>{const back=returnTo;returnTo=null;if(back?.isConnected)back.focus?.({preventScroll:true});});
  doc.body.append(dialog);return dialog;
 }
 function open(from=null){
  const box=ensure();returnTo=from;
  box.innerHTML=soonMarkup(lang(),{art,desktop:desktop()});
  if(!box.open)box.showModal();
  box.querySelector('.learn-soon-reserve,.learn-soon-close')?.focus({preventScroll:true});
 }
 function close(){if(dialog?.open)dialog.close();}
 function click(event){
  if(doc.documentElement?.dataset?.learnSoon==='off')return;
  const button=soonTarget(event.target,{on});if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();open(button);
 }
 win.addEventListener('click',click,true);
 return {open,close,dispose(){win.removeEventListener('click',click,true);close();dialog?.remove();dialog=null;}};
}
