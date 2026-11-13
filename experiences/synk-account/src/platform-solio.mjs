// 웹 플랫폼의 SYNK SOLIO(2026-11-13): 솔리오(#solio · #solio/backup · #solio/subscriptions), 내 계정(#account, 맞춤 정보는 #account/insight),
// 옛 회원 혜택 주소 이음, 내 홈 솔리오 칸, 둘러보기 「솔리오와 회원 혜택」 묶음. 글은 PC와 같은 원천(desktop/renderer/solio.mjs)이다.
// 웹은 이 PC의 AI 구독 사용량을 읽지 않는다 — AI 구독 관리는 소개와 PC 앱 여는 길만 둔다.
// 공개본 묶음은 바뀐 조각만 얹으므로(qa/solio-20261113) 이 파일의 최상위 이름은 모두 solio로 시작한다.
import { SOLIO, SOLIO_SECTIONS, SOLIO_SUBSCRIPTIONS, SOLIO_BACKUP, SOLIO_LEGACY_BENEFITS, solioSearch, solioSection } from '../../../desktop/renderer/solio.mjs';
import { shelfItem, shelfColumns } from './platform-shelf.mjs';
import { benefitItem } from './member-benefits.mjs';

const solioEsc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const solioArt = name => `./assets/member/${name}`;
const solioArrow = '<span aria-hidden="true">→</span>';
const solioDot = tone => `<span class="dot solio-dot" data-tone="${tone}" aria-hidden="true"></span>`;

// 옛 주소: #benefits/insight → #account/insight, #benefits/subscriptions → #solio/subscriptions(뒤에 붙은 ?… 는 버린다).
export function solioLegacyHash(hash = '') {
  const match = /^#benefits\/([^/?#]+)/.exec(String(hash));
  return match && Object.hasOwn(SOLIO_LEGACY_BENEFITS, match[1]) ? SOLIO_LEGACY_BENEFITS[match[1]].hash : null;
}

// 머리: 회색 한 줄 「SYNK SOLIO」 → 밑줄 글자 탭 셋(지금 탭 aria-current).
function solioTabs(section) {
  return `<header class="solio-head"><p class="solio-kicker">${SOLIO.name}</p><nav class="tabs lined solio-tabs" aria-label="솔리오 메뉴">${SOLIO_SECTIONS.map(([id, label]) => `<a class="tab" href="#solio${id === 'home' ? '' : '/' + id}"${section === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></header>`;
}

function solioHome() {
  const rows = `<ul class="rows solio-rows">`
    + `<li class="row"><a class="row-main" href="#solio/subscriptions">${SOLIO_SUBSCRIPTIONS.name}</a><span class="solio-state">${solioDot('ok')}지금 써요 · PC 앱</span><p class="solio-row-text">${SOLIO_SUBSCRIPTIONS.headline}</p></li>`
    + `<li class="row"><a class="row-main" href="#solio/backup">${SOLIO_BACKUP.name}</a><span class="solio-state">${solioDot('planned')}${SOLIO_BACKUP.statusLabel}</span><p class="solio-row-text">${SOLIO_BACKUP.headline}</p></li></ul>`;
  return `<div class="detail solio-detail"><div class="detail-art"><div class="detail-stage"><img src="${solioArt(SOLIO.asset)}" alt="${solioEsc(SOLIO.alt)}"></div></div>`
    + `<div class="detail-text"><p class="aud">${SOLIO.tagline}</p><h1 id="solio-title">${SOLIO.menu}</h1><p class="sum">${SOLIO.summary}</p>`
    + `<div class="acts"><a class="sb-btn" href="#solio/subscriptions">AI 구독 관리 보기 ${solioArrow}</a></div>`
    + `<p class="state">${solioDot('ok')}AI 구독 관리 · PC 앱에서 써요 · 회원 무료</p>`
    + `<section class="info solio-contents" aria-labelledby="solio-contents-title"><h2 id="solio-contents-title">들어 있는 것</h2>${rows}</section></div></div>`;
}

// 백업·복구: 준비 중 안내만 — 설치 · 다운로드 · 신청 · 결제 단추를 두지 않는다.
function solioBackup() {
  return `<section class="solio-backup" aria-labelledby="solio-title"><header class="page-heading"><h1 id="solio-title">${SOLIO_BACKUP.name}</h1><p><span class="solio-state">${solioDot('planned')}${SOLIO_BACKUP.statusLabel}</span> ${SOLIO_BACKUP.headline}</p></header>`
    + `<dl class="solio-facts">${SOLIO_BACKUP.rows.map(([title, body]) => `<div><dt>${title}</dt><dd>${body}</dd></div>`).join('')}</dl></section>`;
}

// AI 구독 관리(웹): 소개와 PC 앱 여는 길. 사용량 · 계정 수는 보이지 않는다.
function solioSubscriptions() {
  const item = SOLIO_SUBSCRIPTIONS;
  return `<div class="detail solio-detail solio-subscriptions"><div class="detail-art"><div class="detail-stage"><img src="${solioArt(item.asset)}" alt="${solioEsc(item.alt)}"></div></div>`
    + `<div class="detail-text"><p class="aud">솔리오 · ${item.kicker}</p><h1 id="solio-title">${item.name}</h1><p class="sub">${item.headline}</p><p class="sum">${item.description}</p>`
    + `<div class="acts"><a class="sb-btn" href="#downloads">PC 앱 받기 ${solioArrow}</a></div>`
    + `<p class="state">${solioDot('ok')}${item.statusLabel}</p><p class="benefit-availability">${item.availability}</p><p class="solio-pc-entry">${item.pcEntry}</p>`
    + `<section class="info benefit-how"><h2>이렇게 써요</h2><ol class="steps">${item.steps.map((step, index) => `<li><span class="step-number">0${index + 1}</span><div><h3>${step.title}</h3><p>${step.body}</p></div></li>`).join('')}</ol></section></div></div>`;
}

export function solioPage(id) {
  const section = solioSection(id);
  return solioTabs(section) + (section === 'backup' ? solioBackup() : section === 'subscriptions' ? solioSubscriptions() : solioHome());
}

// 내 홈 선반의 솔리오 칸(늘 하나). 처음 온 사람에게는 큰 첫 칸이다.
export function solioHomeItem(big = false) {
  return shelfItem({ href: '#solio', image: solioArt(SOLIO.asset), alt: '', name: SOLIO.menu, heading: 'h2', desc: SOLIO.homeLine, meta: SOLIO.tagline, dot: true, big, cls: 'home-item solio-item', attrs: 'data-shortcut="solio"',
    after: `<div class="go"><a class="go-link" href="#solio">솔리오 보기 ${solioArrow}</a></div>` });
}

// 둘러보기: 검색어가 없으면 솔리오 · 플레저 두 칸, 있으면 솔리오 · 맞춤 정보 · 회원 혜택에서 찾은 곳(옛 이름으로 찾아도 새 자리).
export function solioDiscoverSection(query = '', { signedIn = false, care = null } = {}) {
  const head = `<div class="block-head"><h2 id="discover-solio-title">${query ? '솔리오와 회원 혜택에서 찾은 것' : '솔리오와 회원 혜택'}</h2><a class="link" href="#benefits">회원 혜택 모두 보기 →</a></div>`;
  let body;
  if (query) {
    const found = solioSearch(query);
    body = found.length ? `<ul class="rows solio-found">${found.map(item => `<li class="row"><a class="row-main" href="${item.hash}">${solioEsc(item.title)}</a><span class="tag">${solioEsc(item.where)}</span></li>`).join('')}</ul>` : '<p class="benefit-empty">검색어에 맞는 솔리오 · 회원 혜택이 없어요.</p>';
  } else {
    const cells = [solioHomeItem(false), care ? benefitItem(care, { signedIn }) : ''].filter(Boolean);
    body = `<ul class="shelf benefit-grid${shelfColumns(cells.length)}" aria-label="솔리오와 회원 혜택">${cells.join('')}</ul>`;
  }
  return `<section class="block benefit-home-collection solio-discover" aria-labelledby="discover-solio-title">${head}${body}</section>`;
}

// 내 계정(#account): 이름 한 줄 → 맞춤 정보(내 성향) → SYNK ID 관리. 로그인 전이면 로그인 안내와 회원 혜택 길.
export function solioAccountPage({ status = 'loading', name = '' } = {}) {
  const head = '<header class="page-heading"><h1 id="account-title">내 계정</h1><p>SYNK ID 하나로 쓰는 SYNK 앱의 내 정보예요.</p></header>';
  if (status !== 'signed-in') {
    const lead = status === 'loading' ? '로그인 상태를 확인하고 있어요.' : '로그인하면 맞춤 정보를 볼 수 있어요.';
    return head + `<section class="content-panel solio-account"><p role="status">${lead}</p><div class="actions"><a class="sb-btn" href="./client.html?product=platform">SYNK ID로 로그인 ↗</a><a class="link" href="#benefits">회원 혜택 보기 →</a></div></section>`;
  }
  return head + `<p class="solio-account-name">${solioEsc(name ? `${name} 님` : 'SYNK ID로 로그인했어요')}</p>`
    + `<section class="content-panel solio-account" aria-labelledby="account-personal"><h2 id="account-personal">맞춤 정보</h2><div class="rows-wrap"><div class="line-row"><div><strong>내 성향</strong><p>직접 고른 관심사 · 도움 방식과 WORLD 학습 기록을 나눠 봐요.</p></div><a class="sb-btn soft" href="#account/insight">보기 ${solioArrow}</a></div></div></section>`
    + `<section class="content-panel solio-account" aria-labelledby="account-id"><h2 id="account-id">SYNK ID</h2><div class="rows-wrap"><div class="line-row"><div><strong>계정 관리</strong><p>이름 · 로그인 방법 · 비밀번호 · 로그인한 곳 · 계정 지우기는 SYNK ID 관리에서 해요.</p></div><a class="sb-btn soft" href="./client.html?product=platform">SYNK ID 관리 ↗</a></div></div></section>`;
}

// 맞춤 정보(#account/insight)는 member-benefits.mjs의 solioInsightPage가 그린다(웹 묶음의 모듈 차례를 앞 판과 같게 지키려고 그 모듈에 둔다).
export { solioInsightPage } from './member-benefits.mjs';
