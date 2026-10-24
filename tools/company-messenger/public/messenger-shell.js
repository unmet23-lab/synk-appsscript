// The messenger workspace shell, assembled in one place. Standalone pages put
// the brand, chat tabs and my-work tools in a top bar; inside the company
// workspace the tabs live in the sidebar and my-work joins the header actions.
// Permission-dependent chrome (viewer mode, company sidebar heading, storage
// settings) stays with app.js applyIntegratedUI because it can change at run time.

export const CHAT_CATEGORIES = Object.freeze([['personal', '개인채팅', 'chat'], ['team', '팀채팅', 'users'], ['all', '전체채팅', 'globe']]);

export function chatCategoryTabsHtml(chatCategory, { icon }, categories = CHAT_CATEGORIES) {
  return `<div class="chat-categories" id="chat-category-tabs" role="tablist" aria-label="채팅 종류">${categories.map(([key, label, iconName]) => `<button type="button" role="tab" id="chat-category-${key}" data-chat-category="${key}" aria-controls="conversation-panel" aria-selected="${key === chatCategory}" tabindex="${key === chatCategory ? 0 : -1}">${icon(iconName)}<span>${label}</span><span class="category-unread hidden"></span></button>`).join('')}</div>`;
}

function quickToolsHtml(platformEntry, { icon }) {
  return `<div class="messenger-quick-tools" aria-label="내 업무 바로가기">${platformEntry}<button type="button" class="personal-bell quick-tool" id="personal-bell" aria-label="내 업무 · 할 일, 알림, 저장" title="내 업무 · 할 일, 알림, 저장">${icon('bell')}<span id="personal-unread" hidden></span><span>내 업무</span></button></div>`;
}

function sidebarHtml(view, tabs, { icon, esc, avatar, initials }) {
  const { workspaceName, user } = view;
  return `<aside class="sidebar" id="sidebar"><div class="sidebar-brand"><img class="brand-logo" src="assets/synk-ko.svg" alt="싱ㅋ"><span class="brand-context">팀 메신저</span></div>`
    + `<div class="workspace-card"><span class="workspace-symbol">${esc(initials(workspaceName).slice(0, 1))}</span><div class="workspace-info"><strong>${esc(workspaceName)}</strong><span>워크스페이스</span></div>${icon('lock')}</div>`
    + (view.embedded ? tabs : '')
    + `<button class="sidebar-search" id="global-search">${icon('search')}<span>메시지 검색</span><kbd>Ctrl K</kbd></button>`
    + `<label class="room-filter-label">${icon('search')}<input type="search" id="room-filter" aria-label="대화방 찾기" placeholder="대화방 찾기" autocomplete="off"><button type="button" id="clear-room-filter" class="icon-button small hidden" aria-label="찾는 말 지우기">${icon('close')}</button></label>`
    + `<div class="conversation-filters" role="group" aria-label="대화 필터"><button class="active" data-nav-filter="all" aria-pressed="true">전체</button><button data-nav-filter="unread" aria-pressed="false">안 읽음 <span id="nav-unread-count" class="filter-count hidden"></span></button></div>`
    + `<nav class="sidebar-scroll" aria-label="대화 목록"><div id="unread-empty" class="unread-empty hidden">${icon('check')}<strong>다 읽었어요</strong><span>새 메시지가 오면 여기에 모여요.</span></div>`
    + `<section class="nav-section" data-chat-section="personal" aria-label="개인 대화방"><div id="self-nav"></div><div id="dm-nav"></div></section>`
    + `<section class="nav-section hidden" data-chat-section="team" aria-label="우리 팀 대화방"><div id="team-nav"></div></section>`
    + `<section class="nav-section hidden" data-chat-section="all" aria-label="공용·프로젝트 대화방"><div class="section-label"><button class="create-project-link" id="create-channel" type="button" aria-label="새 대화방 만들기">새 대화방 ${icon('plus')}</button></div><div id="channel-nav"></div><button class="deleted-projects-link" id="deleted-projects">${icon('trash')}삭제된 대화방</button></section>`
    + `<p class="sidebar-hint hidden" id="room-filter-empty" role="status">맞는 대화방이 없어요.<br>다른 이름이나 팀으로 찾아보세요.</p></nav>`
    + `<div class="sidebar-bottom"><div id="connection" class="connection offline"><span class="dot"></span><span>연결하는 중</span></div><button class="profile-button" id="workspace-settings">${avatar(user)}<span><strong>${esc(user.name)}</strong><small>${user.role === 'owner' ? '워크스페이스 관리자' : '팀원'}</small></span>${icon('settings')}</button></div></aside>`;
}

function composerHtml(view, { icon }) {
  return `<div class="composer-wrap"><p class="channel-write-notice hidden" id="channel-write-notice" role="status"></p><form class="composer" id="composer-form"><div class="reply-context hidden" id="reply-context"></div><div class="upload-queue hidden" id="upload-queue"></div><div id="compose-extras" class="compose-extras hidden"></div><div id="mention-picker" class="mention-picker hidden" role="listbox" aria-label="멘션할 크루"></div>`
    + `<textarea id="composer-input" aria-label="메시지 입력" rows="2" maxlength="8000" placeholder="메시지를 남겨 보세요" aria-controls="mention-picker" aria-autocomplete="list" aria-expanded="false"></textarea>`
    + `<div class="composer-bottom"><button class="icon-button composer-tool" type="button" id="attach-file" aria-label="파일 첨부">${icon('attach')}<span>파일</span></button><button class="icon-button composer-tool" type="button" id="composer-emoji" aria-label="이모지 넣기" title="이모지 넣기">${icon('smile')}</button><button class="composer-tool" type="button" id="composer-mention" aria-label="크루 멘션 넣기" title="크루 멘션 넣기"><span aria-hidden="true">@</span></button><span class="composer-hint">Enter로 전송 · Shift + Enter로 줄바꿈</span><button class="send-button" type="submit" id="send-message" aria-label="메시지 보내기" disabled><span>보내기</span>${icon('send')}</button></div>`
    + `<input id="file-input" class="hidden" type="file" multiple></form><div class="composer-footnote"><span id="composer-status">파일을 끌어다 놓아도 돼요.</span><span id="composer-storage">${view.uploadDestination} · 파일당 최대 ${view.fileLimit}</span></div></div>`;
}

function mainHtml(view, quickTools, helpers) {
  const { icon, esc } = helpers;
  return `<main class="main" id="conversation-panel" role="tabpanel"><header class="main-header"><button class="icon-button mobile-menu" id="mobile-menu" aria-label="대화 목록 열기">${icon('menu')}</button><div class="header-title"><div class="header-breadcrumb"><span>${esc(view.workspaceName)}</span>${icon('chevron')}<span id="breadcrumb-type">채널</span></div><h1 id="channel-title"></h1><span class="channel-about" id="channel-about"></span></div>`
    + `<div class="header-actions">${view.embedded ? quickTools : ''}<button class="member-count" id="channel-members" aria-label="크루 목록 보기">${icon('users')}<span id="member-number"></span><span class="member-button-label">크루</span></button><button type="button" class="icon-button" id="channel-notifications" aria-label="대화방 설정" title="대화방 설정">${icon('settings')}</button></div></header>`
    + `<div class="channel-bar"><button class="tab-button active" id="tab-chat">${icon('chat')}대화</button><button class="tab-button" id="tab-files">${icon('folder')}공유한 파일</button><button class="tab-button" id="tab-pins" aria-pressed="false">${icon('pin')}고정 메시지</button></div>`
    + `<div class="project-participation hidden" id="project-participation" aria-label="프로젝트 참여 크루"></div>`
    + `<div class="content-body"><section class="chat-area" id="chat-area" aria-label="대화"><div class="message-scroll" id="message-scroll"><div id="message-list"></div></div><button class="jump-latest hidden" id="jump-latest">${icon('down')}최신 메시지로</button>${composerHtml(view, helpers)}<div class="drop-overlay hidden" id="drop-overlay">${icon('upload')}<strong>여기에 놓으면 첨부돼요</strong><span>한 번에 5개 · 파일당 최대 ${view.fileLimit}</span></div></section>`
    + `<section class="files-view hidden" id="files-view" aria-label="공유한 파일"></section><section class="pins-view hidden" id="pins-view" aria-label="고정 메시지"></section><aside class="drawer hidden" id="drawer"></aside></div></main>`;
}

function directoryHtml({ icon }) {
  return `<aside class="employee-directory" id="employee-directory" aria-label="회사 크루 목록"><div class="directory-heading"><div><span class="directory-eyebrow">PEOPLE</span><h2>크루 목록 <span id="directory-count"></span></h2></div>${icon('users')}<button class="icon-button directory-back" id="directory-back" aria-label="대화 목록으로 돌아가기" title="대화 목록으로 돌아가기">${icon('arrow')}</button></div>`
    + `<label class="directory-search">${icon('search')}<input id="employee-search" type="search" placeholder="이름이나 팀으로 찾기" aria-label="크루 검색" autocomplete="off"></label><label class="directory-team-select"><span class="sr-only">팀별 크루 보기</span><select id="directory-team" aria-label="팀별 크루 보기"></select></label>`
    + `<div class="directory-list" id="directory-list"></div><p class="directory-footnote">${icon('chat')}<span>크루를 누르면<br>개인 대화가 바로 열려요.</span></p></aside>`;
}

// view: { embedded, workspaceName, user: {name, role}, chatCategory, platformEntry, uploadDestination, fileLimit }
// helpers: { icon, esc, avatar, initials } from app.js.
export function shellHtml(view, helpers) {
  const tabs = chatCategoryTabsHtml(view.chatCategory, helpers);
  const quickTools = quickToolsHtml(view.embedded ? '' : view.platformEntry || '', helpers);
  const topbar = view.embedded ? '' : `<div class="messenger-topbar"><div class="messenger-brand"><img src="assets/synk-ko.svg" alt="싱ㅋ" width="560" height="328"><strong>메신저</strong></div>${tabs}${quickTools}</div>`;
  return `<div class="shell">${topbar}<button class="mobile-scrim" id="mobile-scrim" aria-label="메뉴 닫기"></button>${sidebarHtml(view, tabs, helpers)}${mainHtml(view, quickTools, helpers)}${directoryHtml(helpers)}</div>`;
}

export const SynkMessengerShell = Object.freeze({ CHAT_CATEGORIES, chatCategoryTabsHtml, shellHtml });
// Exposed for app.js, which tests also evaluate as a classic script.
if (typeof window !== 'undefined') window.SynkMessengerShell = SynkMessengerShell;
