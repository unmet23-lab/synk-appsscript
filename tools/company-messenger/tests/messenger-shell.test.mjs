// 메신저 틀(2026-11-06 새 판): 목록 하나(대화방 · 사람) + 대화 머리 한 줄 + 오른쪽 칸 하나. 위 막대 · 칸 탭 · 대화/파일/고정 탭은 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, shellHtml } from '../public/messenger-shell.js';

const helpers = {
  icon: name => `<svg data-icon="${name}"></svg>`,
  esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  avatar: user => `<span class="avatar">${user.name.slice(0, 1)}</span>`,
  initials: name => [...(name || '?')].slice(0, 2).join(''),
};
const view = overrides => ({ embedded: false, workspaceName: 'SYNK <검수>', user: { name: '유호 & 팀', role: 'owner' }, platformEntry: '<a class="platform-entry" href="https://synk.im/">SYNK 플랫폼</a>', uploadDestination: '새 파일은 이 PC에 저장', fileLimit: '100.0 MB', ...overrides });
const between = (html, start, end) => { const from = html.indexOf(start); assert.ok(from >= 0, start); return html.slice(from, html.indexOf(end, from)); };
// Elements app.js wires or fills after the shell is drawn.
const WIRED = ['sidebar', 'room-filter', 'clear-room-filter', 'mobile-menu', 'create-channel', 'new-dm', 'new-conversation', 'new-menu', 'deleted-projects', 'personal-bell', 'personal-unread', 'room-info', 'global-search', 'workspace-settings', 'employee-search', 'directory-team', 'employee-directory', 'directory-back', 'directory-count', 'directory-list', 'composer-form', 'composer-input', 'mention-picker', 'compose-extras', 'attach-file', 'file-input', 'composer-emoji', 'composer-mention', 'reply-context', 'upload-queue', 'message-list', 'message-scroll', 'pins-view', 'files-view', 'jump-latest', 'chat-area', 'drop-overlay', 'send-message', 'composer-status', 'channel-title', 'channel-sub', 'connection', 'dm-nav', 'channel-nav', 'unread-empty', 'room-filter-empty', 'nav-unread-count', 'channel-write-notice', 'drawer', 'conversation-panel', 'message-menu', 'message-sheet'];
const RETIRED = ['chat-category-tabs', 'mobile-scrim', 'channel-members', 'channel-notifications', 'tab-chat', 'tab-files', 'tab-pins', 'composer-storage', 'channel-about', 'breadcrumb-type', 'member-number', 'self-nav', 'team-nav', 'project-participation', 'channel-search'];

for (const embedded of [false, true]) {
  test(`${embedded ? 'the workspace-embedded' : 'the standalone'} shell has each wired element exactly once and no retired control`, () => {
    const html = shellHtml(view({ embedded }), helpers);
    for (const id of WIRED) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
    for (const id of RETIRED) assert.ok(!html.includes(`id="${id}"`), id);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
    for (const [, target] of html.matchAll(/aria-controls="([^"]+)"/g)) assert.ok(ids.includes(target), `aria-controls ${target} points at a real element`);
    assert.ok(!html.includes('messenger-topbar') && !html.includes('data-chat-category'), 'no top bar and no category tabs');
  });
}

test('one list: the rooms group comes before people, and deleted rooms are the last row of the rooms group', () => {
  const html = shellHtml(view(), helpers), list = between(html, '<aside class="sidebar"', '</aside>');
  assert.deepEqual(NAV_GROUPS.map(([key]) => key), ['rooms', 'people']);
  assert.ok(list.indexOf('data-nav-group="rooms"') < list.indexOf('data-nav-group="people"'));
  const rooms = between(list, 'data-nav-group="rooms"', 'data-nav-group="people"');
  assert.ok(rooms.indexOf('id="channel-nav"') < rooms.indexOf('id="deleted-projects"'));
  assert.match(rooms, /id="create-channel"/);assert.match(between(list, 'data-nav-group="people"', '</section>'), /id="new-dm"/);
  assert.ok(list.indexOf('id="room-filter"') < list.indexOf('data-nav-filter="all"'), 'finder above the 전체 · 안 읽음 filter');
});

test('the standalone page keeps its platform link in the list head; inside the company workspace the rail already has it', () => {
  const standalone = shellHtml(view(), helpers), embedded = shellHtml(view({ embedded: true }), helpers);
  const tools = between(standalone, 'class="list-tools"', '</div>');
  assert.ok(tools.includes('class="platform-entry"') && tools.includes('id="global-search"'), 'both live in the list head tools');
  assert.ok(tools.indexOf('class="platform-entry"') < tools.indexOf('id="global-search"'));
  assert.ok(!embedded.includes('platform-entry'));
});

test('the conversation head is one line: title, scope, then the bell and room info', () => {
  const html = shellHtml(view({ embedded: true }), helpers), head = between(html, '<header class="main-header"', '</header>');
  assert.ok(head.indexOf('id="channel-title"') < head.indexOf('id="channel-sub"'));
  const actions = between(head, 'class="header-actions"', '</div>');
  assert.ok(actions.indexOf('id="personal-bell"') < actions.indexOf('id="room-info"'));
  assert.match(actions, /id="personal-bell"[^>]*aria-label="알림 · 나중에 보기 · 결정"/);
  assert.ok(!head.includes('header-breadcrumb') && !head.includes('channel-bar'));
});

test('the composer starts as one accessible, locked line with no Enter or storage hint lines', () => {
  const html = shellHtml(view({ user: { name: '<b>크루</b>', role: 'member' } }), helpers);
  assert.match(html, /<textarea id="composer-input"[^>]* rows="1"[^>]* aria-controls="mention-picker" aria-autocomplete="list" aria-expanded="false" aria-describedby="composer-status">/);
  assert.match(html, /<button class="send-button" type="submit" id="send-message" aria-label="보내기" disabled>/);
  const box = between(html, 'class="composer-box"', '</div>');
  assert.ok(box.indexOf('id="attach-file"') < box.indexOf('id="composer-input"') && box.indexOf('id="composer-emoji"') < box.indexOf('id="send-message"'));
  assert.ok(!html.includes('Enter로 전송') && !html.includes('composer-footnote'));
  assert.match(html, /<p class="composer-status" id="composer-status" aria-live="polite">/);
  assert.ok(html.includes('파일당 최대 100.0 MB · 새 파일은 이 PC에 저장'), 'the storage note only appears while dragging files');
});
