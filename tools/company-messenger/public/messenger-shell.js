// 메신저 틀(2026-11-06 새 판 · B안) — 한 곳에서 짓는다.
// 목록 하나(대화방 · 사람 묶음) + 대화 + 오른쪽 칸 하나(스레드 · 알림/나중에 보기/결정 · 방 정보 · 검색).
// 회사 워크스페이스 안(embedded)에서는 회사 레일이 주요 공간을 맡고, 단독(PC 설치본, embedded=false)에서는
// 목록 머리에 플랫폼 링크가 붙는다. 권한에 따라 바뀌는 틀(보기 전용 · 저장소 설정)은 app.js applyIntegratedUI가 맡는다.
// 설계: docs/디자인/워크스페이스_시그널/새판_설계_20261106.md

export const NAV_GROUPS = Object.freeze([['rooms', '대화방'], ['people', '사람']]);

function groupHtml(key, label, body, tool, { icon }) {
  return `<section class="nav-group" data-nav-group="${key}" aria-label="${label}"><div class="group-head"><button type="button" class="group-toggle" data-group-toggle="${key}" aria-expanded="true" aria-controls="nav-group-${key}">${icon('down')}<span>${label}</span></button>${tool}</div><div class="group-body" id="nav-group-${key}">${body}</div></section>`;
}

function listHtml(view, helpers) {
  const { icon } = helpers;
  return `<aside class="sidebar" id="sidebar" aria-label="대화 목록">`
    + `<div class="list-head"><h1 class="list-title">메신저</h1><div class="list-tools">${view.embedded ? '' : view.platformEntry || ''}<button type="button" class="icon-button" id="global-search" aria-label="메시지 검색" title="메시지 검색 · Ctrl K" aria-keyshortcuts="Control+K">${icon('search')}</button><button type="button" class="icon-button" id="workspace-settings" aria-label="메신저 설정 — 연결 · 파일 저장소" title="메신저 설정">${icon('settings')}</button><button type="button" class="icon-button" id="new-conversation" aria-label="새 대화 — 1:1 · 새 대화방 · 팀 대화방 열기" aria-haspopup="menu" aria-expanded="false" aria-controls="new-menu">${icon('compose')}</button></div><div class="pop-menu new-menu hidden" id="new-menu" role="menu" aria-label="새 대화"></div></div>`
    + `<div id="connection" class="connection offline" role="status"><span class="dot"></span><span>연결하는 중</span></div>`
    + `<label class="room-filter-label">${icon('search')}<input type="search" id="room-filter" aria-label="대화방 · 사람 찾기" placeholder="대화방 · 사람 찾기" autocomplete="off"><button type="button" id="clear-room-filter" class="icon-button small hidden" aria-label="찾는 말 지우기">${icon('close')}</button></label>`
    + `<div class="conversation-filters" role="group" aria-label="대화 걸러보기"><button type="button" class="active" data-nav-filter="all" aria-pressed="true">전체</button><button type="button" data-nav-filter="unread" aria-pressed="false">안 읽음 <span id="nav-unread-count" class="filter-count hidden"></span></button></div>`
    + `<nav class="sidebar-scroll" aria-label="대화 목록"><div id="unread-empty" class="unread-empty hidden">${icon('check')}<strong>다 읽었어요</strong><span>새 메시지가 오면 여기에 모여요.</span></div>`
    + groupHtml('rooms', '대화방', `<div id="channel-nav"></div><button type="button" class="nav-item deleted-projects-link" id="deleted-projects"><span class="room-symbol">${icon('trash')}</span><span class="nav-name">삭제된 대화방</span></button>`, `<button type="button" class="icon-button small" id="create-channel" aria-label="새 대화방 만들기">${icon('plus')}</button>`, helpers)
    + groupHtml('people', '사람', `<div id="dm-nav"></div>`, `<button type="button" class="icon-button small" id="new-dm" aria-label="1:1 대화 시작 — 크루 목록">${icon('plus')}</button>`, helpers)
    + `<p class="sidebar-hint hidden" id="room-filter-empty" role="status">맞는 대화가 없어요.<br>다른 이름이나 팀으로 찾아보세요.</p></nav></aside>`;
}

function composerHtml(view, { icon }) {
  return `<div class="composer-wrap"><p class="channel-write-notice hidden" id="channel-write-notice" role="status"></p><form class="composer" id="composer-form"><div class="reply-context hidden" id="reply-context"></div><div class="upload-queue hidden" id="upload-queue"></div><div id="compose-extras" class="compose-extras hidden"></div><div id="mention-picker" class="mention-picker hidden" role="listbox" aria-label="멘션할 크루"></div>`
    + `<div class="composer-box"><button class="icon-button composer-tool" type="button" id="attach-file" aria-label="파일 올리기">${icon('plus')}</button><textarea id="composer-input" aria-label="메시지 입력" rows="1" maxlength="8000" placeholder="메시지를 남겨 보세요" aria-controls="mention-picker" aria-autocomplete="list" aria-expanded="false" aria-describedby="composer-status"></textarea><button class="icon-button composer-tool composer-extra" type="button" id="composer-mention" aria-label="크루 부르기(@)" title="크루 부르기">${icon('at')}</button><button class="icon-button composer-tool composer-extra" type="button" id="composer-emoji" aria-label="이모지 넣기" title="이모지 넣기">${icon('smile')}</button><button class="send-button" type="submit" id="send-message" aria-label="보내기" disabled>${icon('arrowup')}</button></div>`
    + `<input id="file-input" class="hidden" type="file" multiple></form><p class="composer-status" id="composer-status" aria-live="polite"></p></div>`;
}

function mainHtml(view, helpers) {
  const { icon } = helpers;
  return `<main class="main" id="conversation-panel" aria-labelledby="channel-title"><header class="main-header"><button type="button" class="icon-button mobile-menu" id="mobile-menu" aria-label="대화 목록">${icon('back')}</button><div class="header-title"><h2 id="channel-title"></h2><span class="channel-sub" id="channel-sub"></span></div>`
    + `<div class="header-actions"><button type="button" class="icon-button personal-bell" id="personal-bell" aria-label="알림 · 나중에 보기 · 결정" aria-pressed="false">${icon('bell')}<span id="personal-unread" class="bell-count" hidden></span></button><button type="button" class="icon-button" id="room-info" aria-label="방 정보 — 참여 크루 · 알림 · 파일 · 고정 메시지" aria-pressed="false">${icon('info')}</button></div></header>`
    + `<div class="content-body"><section class="chat-area" id="chat-area" aria-label="대화"><div class="message-scroll" id="message-scroll"><div id="message-list"></div></div><button type="button" class="jump-latest hidden" id="jump-latest">${icon('down')}최신 메시지로</button>${composerHtml(view, helpers)}<div class="drop-overlay hidden" id="drop-overlay">${icon('upload')}<strong>여기에 놓으면 올라가요</strong><span>한 번에 5개 · 파일당 최대 ${view.fileLimit} · ${view.uploadDestination}</span></div></section>`
    + `<section class="files-view hidden" id="files-view" aria-label="공유한 파일"></section><section class="pins-view hidden" id="pins-view" aria-label="고정 메시지"></section><aside class="drawer hidden" id="drawer"></aside></div></main>`;
}

function directoryHtml({ icon }) {
  return `<aside class="employee-directory" id="employee-directory" aria-label="크루 목록"><div class="directory-heading"><button class="icon-button directory-back" id="directory-back" type="button" aria-label="대화 목록으로">${icon('back')}</button><h2>크루 목록 <span id="directory-count"></span></h2></div>`
    + `<label class="directory-search">${icon('search')}<input id="employee-search" type="search" placeholder="이름이나 팀으로 찾기" aria-label="크루 찾기" autocomplete="off"></label><label class="directory-team-select"><span class="sr-only">팀별 크루 보기</span><select id="directory-team" aria-label="팀별 크루 보기"></select></label>`
    + `<div class="directory-list" id="directory-list"></div></aside>`;
}

// view: { embedded, workspaceName, user: {name, role}, platformEntry, uploadDestination, fileLimit }
// helpers: { icon, esc, avatar, initials } from app.js.
export function shellHtml(view, helpers) {
  return `<div class="shell${view.embedded ? ' is-embedded' : ' is-standalone'}">${listHtml(view, helpers)}${mainHtml(view, helpers)}${directoryHtml(helpers)}<div class="pop-menu message-menu hidden" id="message-menu" role="menu" aria-label="메시지 동작"></div><div class="message-sheet hidden" id="message-sheet"></div></div>`;
}

export const SynkMessengerShell = Object.freeze({ NAV_GROUPS, shellHtml });
// Exposed for app.js, which tests also evaluate as a classic script.
if (typeof window !== 'undefined') window.SynkMessengerShell = SynkMessengerShell;
