import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_CATEGORIES, shellHtml } from '../public/messenger-shell.js';

const helpers = {
  icon: name => `<svg data-icon="${name}"></svg>`,
  esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  avatar: user => `<span class="avatar">${user.name.slice(0, 1)}</span>`,
  initials: name => [...(name || '?')].slice(0, 2).join(''),
};
const view = overrides => ({ embedded: false, workspaceName: 'SYNK <검수>', user: { name: '유호 & 팀', role: 'owner' }, chatCategory: 'personal', platformEntry: '<a class="platform-entry" href="https://synk.im/">SYNK 플랫폼</a>', uploadDestination: '새 파일은 이 PC에 저장', fileLimit: '100.0 MB', ...overrides });
const between = (html, start, end) => { const from = html.indexOf(start); assert.ok(from >= 0, start); return html.slice(from, html.indexOf(end, from)); };
// Elements app.js wires or fills after the shell is drawn.
const WIRED = ['chat-category-tabs', 'room-filter', 'clear-room-filter', 'sidebar', 'mobile-menu', 'mobile-scrim', 'create-channel', 'deleted-projects', 'channel-members', 'personal-bell', 'personal-unread', 'channel-notifications', 'global-search', 'workspace-settings', 'tab-chat', 'tab-files', 'tab-pins', 'employee-search', 'directory-team', 'employee-directory', 'directory-back', 'directory-count', 'directory-list', 'composer-form', 'composer-input', 'mention-picker', 'compose-extras', 'attach-file', 'file-input', 'composer-emoji', 'composer-mention', 'reply-context', 'upload-queue', 'message-list', 'message-scroll', 'pins-view', 'files-view', 'jump-latest', 'chat-area', 'drop-overlay', 'send-message', 'composer-status', 'composer-storage', 'channel-title', 'channel-about', 'breadcrumb-type', 'member-number', 'connection', 'self-nav', 'dm-nav', 'team-nav', 'channel-nav', 'unread-empty', 'room-filter-empty', 'nav-unread-count', 'project-participation', 'channel-write-notice', 'drawer', 'conversation-panel'];

for (const embedded of [false, true]) {
  test(`${embedded ? 'the workspace-embedded' : 'the standalone'} shell has each wired element exactly once`, () => {
    const html = shellHtml(view({ embedded }), helpers);
    for (const id of WIRED) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
    assert.ok(!html.includes('id="channel-search"') && !html.includes('id="new-dm"'), 'retired controls stay out');
  });
}

test('the standalone page puts brand, chat tabs and my-work tools in the top bar', () => {
  const html = shellHtml(view(), helpers);
  const topbar = between(html, '<div class="messenger-topbar">', '<button class="mobile-scrim"');
  assert.ok(topbar.indexOf('class="messenger-brand"') < topbar.indexOf('id="chat-category-tabs"'));
  assert.ok(topbar.indexOf('id="chat-category-tabs"') < topbar.indexOf('class="messenger-quick-tools"'));
  assert.ok(topbar.indexOf('class="platform-entry"') < topbar.indexOf('id="personal-bell"'), 'the platform link comes before my work');
  assert.ok(!between(html, '<aside class="sidebar"', '</aside>').includes('chat-category-tabs'));
  assert.ok(!between(html, 'class="header-actions"', '</header>').includes('personal-bell'));
});

test('inside the company workspace the tabs move to the sidebar and my work joins the header actions', () => {
  const html = shellHtml(view({ embedded: true }), helpers);
  assert.ok(!html.includes('messenger-topbar'));
  assert.ok(!html.includes('platform-entry'), 'the workspace already shows the platform');
  const sidebar = between(html, '<aside class="sidebar"', '</aside>');
  assert.ok(sidebar.indexOf('id="chat-category-tabs"') < sidebar.indexOf('id="global-search"'));
  const actions = between(html, 'class="header-actions"', '</header>');
  assert.ok(actions.indexOf('class="messenger-quick-tools"') < actions.indexOf('id="channel-members"'));
  assert.ok(actions.indexOf('id="channel-members"') < actions.indexOf('id="channel-notifications"'));
});

test('the selected chat category is the focusable selected tab and every tab controls the conversation panel', () => {
  for (const [selected] of CHAT_CATEGORIES) {
    const tabs = between(shellHtml(view({ chatCategory: selected }), helpers), 'id="chat-category-tabs"', '</div>');
    for (const [key, label, icon] of CHAT_CATEGORIES) {
      const button = between(tabs, `id="chat-category-${key}"`, '</button>');
      assert.match(button, new RegExp(`aria-selected="${key === selected}" tabindex="${key === selected ? 0 : -1}"`));
      assert.match(button, /aria-controls="conversation-panel"/);
      assert.ok(button.includes(`data-icon="${icon}"`) && button.includes(`<span>${label}</span>`));
    }
  }
});

test('names are escaped and the composer starts accessible and locked', () => {
  const html = shellHtml(view({ user: { name: '<b>크루</b>', role: 'member' } }), helpers);
  assert.ok(html.includes('SYNK &lt;검수&gt;') && !html.includes('SYNK <검수>'));
  assert.ok(html.includes('&lt;b&gt;크루&lt;/b&gt;') && html.includes('<small>팀원</small>'));
  assert.match(html, /<textarea id="composer-input"[^>]* aria-controls="mention-picker" aria-autocomplete="list" aria-expanded="false">/);
  assert.match(html, /<button class="send-button" type="submit" id="send-message" aria-label="메시지 보내기" disabled>/);
  assert.ok(html.includes('새 파일은 이 PC에 저장 · 파일당 최대 100.0 MB'));
  assert.ok(html.includes('<small>워크스페이스 관리자</small>') === false);
  assert.ok(shellHtml(view(), helpers).includes('<small>워크스페이스 관리자</small>'));
});
