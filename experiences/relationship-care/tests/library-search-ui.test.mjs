import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { emptyState, makePerson, makeEvent, listSavedMessages, toggleMessageFavorite, removeSavedMessage, CHECKIN_INTENTS, EVENT_TYPES } from '../model.mjs';

const source = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, `Missing shipped function: ${name}`);
  const next = source.slice(start + 1).search(/^(?:async )?function /m);
  assert.ok(next >= 0, `Missing function boundary: ${name}`);
  return source.slice(start, start + next + 1);
}
function handlerSource(id) {
  const start = source.indexOf(`on('${id}',`);
  assert.ok(start >= 0, `Missing shipped handler: ${id}`);
  const rest = source.slice(start), next = rest.search(/\r?\n(?=on\()/u);
  assert.ok(next >= 0, `Missing handler boundary: ${id}`);
  return rest.slice(0, next);
}

const row = (id, text, extra = {}) => ({ id, type: 'checkin', checkinIntent: 'everyday', text, savedAt: '2026-10-08T00:00:00.000Z', favorite: false, ...extra });
const person = (id, messageLibrary = []) => makePerson({ id, name: `사람 ${id}`, messageLibrary });
const owner = () => person('a', [
  row('favorite', '같이 간 CAFÉ [A.*]에서 가을 안부를 전해요.', { favorite: true }),
  row('long', '앞부분에는 찾는 말이 없어요. '.repeat(5) + '마지막에 숨긴 KEYWORD'),
  row('plain', '산책하며 생각났어. 좋은 하루 보내.'),
  row('legacy', '예전에 기억한 안부', { checkinIntent: 'unspecified' }),
  row('thanks', 'CAFÉ에서 도와줘서 고마워요.', { favorite: true, checkinIntent: 'thanks' }),
  { id: 'birthday', type: 'birthday', text: 'CAFÉ에서 생일 축하해요.', savedAt: '2026-10-07T00:00:00.000Z', favorite: true },
]);
const event = makeEvent({ id: 'birthday-a', personId: 'a', type: 'birthday', date: '2030-10-10' });

function harness(people = [owner()]) {
  const elements = new Map(), handlers = new Map(), writes = [], notices = [], generated = [];
  const element = id => {
    if (!elements.has(id)) {
      const attributes = new Map();
      const node = {
        value: id === 'draft-intent' ? 'everyday' : id === 'library-scope' ? 'context' : '',
        checked: false, hidden: false, disabled: false, textContent: '', dataset: {},
        focus() { this.focused = true; }, setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
      };
      if (id === 'saved-message-select') {
        Object.defineProperty(node, 'innerHTML', { set(html) {
          this.options = [...html.matchAll(/<option value="([^"]*)"/gu)].map(match => match[1]);
          this.value = this.options[0] || '';
        } });
      }
      elements.set(id, node);
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    state: { ...emptyState(), people, events: [event] }, selectedId: people[0]?.id || null,
    currentDraft: { originalText: '원래 초안', savedMessageId: 'favorite' }, authEpoch: 0, saveFailed: false,
    $: element, listSavedMessages, toggleMessageFavorite, removeSavedMessage, CHECKIN_INTENTS, EVENT_TYPES,
    escapeHTML: text => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    on: (id, name, handler) => handlers.set(`${id}:${name}`, handler),
    save: () => { writes.push(JSON.stringify(context.state)); return true; }, renderHistory() {},
    notify: text => notices.push(text), notebookView: () => ({ locked: false }),
    confirmDelete: async () => false, resetPersonalMemory() {}, stashDraft() {},
    generateDraft: options => generated.push(options),
  });
  context.person = () => context.state.people.find(item => item.id === context.selectedId);
  vm.runInContext([
    'renderSavedDraft', 'libraryType', 'librarySearchText', 'libraryFilterState', 'libraryContextItems',
    'libraryItems', 'libraryLabel', 'renderLibrarySelection', 'loadSavedMessage', 'deleteSavedMessage',
  ].map(functionSource).join('\n'), context);
  vm.runInContext([
    'library-scope', 'library-search', 'library-favorites-only', 'library-reset', 'saved-message-select',
    'load-saved-message', 'favorite-saved-message', 'delete-saved-message',
  ].map(handlerSource).join('\n'), context);
  element('draft-text').value = '직접 편집 중인 초안';
  element('draft-confirm').checked = true;
  context.renderSavedDraft();
  const search = text => { element('library-search').value = text; handlers.get('library-search:input')(); };
  const favorites = checked => { element('library-favorites-only').checked = checked; handlers.get('library-favorites-only:change')(); };
  const ids = () => Array.from(context.libraryItems(), item => item.id);
  return { context, element, handlers, writes, notices, generated, search, favorites, ids };
}

test('full-text search uses NFC, case-insensitive trimmed literal matching, including text beyond the preview', () => {
  const { search, ids, element } = harness();
  search('  cafe\u0301  ');
  assert.deepEqual(ids(), ['favorite']);
  search('가을');
  assert.deepEqual(ids(), ['favorite']);
  search('[a.*]');
  assert.deepEqual(ids(), ['favorite'], 'regex punctuation remains literal text');
  search('a.*x');
  assert.deepEqual(ids(), []);
  search('keyword');
  assert.deepEqual(ids(), ['long'], 'search the entire message, not its 32-character option label');
  assert.equal(element('library-result-count').textContent, '이 범위의 4개 중 1개');
});

test('search and favorites intersect with the existing purpose and event-type scopes', () => {
  const { context, element, handlers, search, favorites, ids } = harness();
  search('CAFÉ'); favorites(true);
  assert.deepEqual(ids(), ['favorite']);
  element('library-scope').value = 'type'; handlers.get('library-scope:change')();
  assert.deepEqual(new Set(ids()), new Set(['favorite', 'thanks']));
  assert.equal(element('library-search').value, 'CAFÉ', 'widening the search scope keeps the search');
  assert.equal(element('library-result-count').textContent, '이 범위의 5개 중 2개');
  element('draft-event').value = event.id; context.renderSavedDraft();
  assert.deepEqual(ids(), ['birthday']);
  assert.equal(element('library-scope-wrap').hidden, true);
  assert.equal(element('library-result-count').textContent, '이 범위의 1개 중 1개');
});

test('search, favorites, scope and reset never save or change the draft, confirmation or durable state', () => {
  const { context, element, handlers, writes, search, favorites, ids } = harness();
  const originalState = context.state, serialized = JSON.stringify(originalState), draft = context.currentDraft;
  search('CAFÉ'); favorites(true);
  element('library-scope').value = 'type'; handlers.get('library-scope:change')();
  handlers.get('library-reset:click')();
  assert.equal(context.state, originalState);
  assert.equal(JSON.stringify(context.state), serialized, 'stored text, favorites, timestamps and records remain untouched');
  assert.equal(context.currentDraft, draft);
  assert.equal(element('draft-text').value, '직접 편집 중인 초안');
  assert.equal(element('draft-confirm').checked, true);
  assert.equal(element('library-search').value, '');
  assert.equal(element('library-favorites-only').checked, false);
  assert.equal(element('library-scope').value, 'type');
  assert.equal(element('library-reset').disabled, true);
  assert.equal(element('library-search').focused, true);
  assert.equal(ids().length, 5);
  assert.equal(writes.length, 0);
});

test('empty results distinguish no library, no purpose entries, search misses and missing favorites', () => {
  const { element, search, favorites } = harness();
  search('없는 단어');
  assert.match(element('library-empty').textContent, /검색어와 맞는 문구가 없어요/u);
  assert.equal(element('library-empty').hidden, false);
  assert.equal(element('saved-message-select').disabled, true);
  assert.equal(element('library-actions').hidden, true);
  assert.equal(element('saved-draft-text').textContent, '');
  assert.equal(element('library-meta').textContent, '');
  favorites(true);
  assert.match(element('library-empty').textContent, /즐겨찾기한 문구 중 검색어/u);
  const plain = harness([person('a', [row('plain', '아직 별을 붙이지 않은 문구')])]);
  plain.favorites(true);
  assert.match(plain.element('library-empty').textContent, /이 범위에 즐겨찾기한 문구가 없어요/u);
  const empty = harness([person('a')]);
  empty.search('무엇이든');
  assert.match(empty.element('library-empty').textContent, /다듬은 문구를 기억하면/u);
  const thanksOnly = harness([person('a', [row('thanks', '고마워요', { checkinIntent: 'thanks' })])]);
  thanksOnly.search('고마워요');
  assert.match(thanksOnly.element('library-empty').textContent, /이 목적에 보관한 문구가 없어요/u);
});

test('changing person, account, event type or intent clears filters before rendering the new context', () => {
  for (const change of [
    h => { h.context.selectedId = 'b'; },
    h => { h.context.authEpoch++; },
    h => { h.element('draft-event').value = event.id; },
    h => { h.element('draft-intent').value = 'thanks'; },
  ]) {
    const h = harness([owner(), person('b', [row('b-own', '다른 사람의 문구')])]);
    h.search('가을'); h.favorites(true);
    change(h); h.context.renderSavedDraft();
    assert.equal(h.element('library-search').value, '');
    assert.equal(h.element('library-favorites-only').checked, false);
    assert.equal(h.element('library-reset').disabled, true);
    assert.ok(h.ids().length > 0);
    assert.equal(h.element('draft-text').value, '직접 편집 중인 초안');
    assert.equal(h.writes.length, 0);
    if (h.context.selectedId === 'b') assert.deepEqual(h.ids(), ['b-own']);
  }
});

test('returning to a person or rendering without an owner cannot restore the previous search or preview', () => {
  const h = harness([owner(), person('b')]);
  h.search('가을'); h.favorites(true);
  h.context.selectedId = 'b'; h.context.renderSavedDraft();
  h.context.selectedId = 'a'; h.context.renderSavedDraft();
  assert.equal(h.element('library-search').value, '');
  assert.equal(h.element('library-favorites-only').checked, false);
  h.search('CAFÉ'); h.context.selectedId = null; h.context.renderSavedDraft();
  assert.equal(h.element('saved-draft-preview').hidden, true);
  assert.equal(h.element('saved-draft-text').textContent, '');
  assert.equal(h.element('library-search').value, '');
  assert.deepEqual(h.ids(), []);
});

test('a selected matching message remains selected and a search miss leaves no stale actions', () => {
  const h = harness();
  h.element('saved-message-select').value = 'plain'; h.handlers.get('saved-message-select:change')();
  h.search('산책');
  assert.equal(h.element('saved-message-select').value, 'plain');
  assert.equal(h.element('saved-draft-text').textContent, '산책하며 생각났어. 좋은 하루 보내.');
  h.search('없는 단어');
  assert.equal(h.element('saved-message-select').value, '');
  assert.equal(h.element('library-actions').hidden, true);
  h.handlers.get('library-reset:click')();
  assert.ok(h.ids().includes(h.element('saved-message-select').value));
  assert.equal(h.element('library-actions').hidden, false);
});

test('removing a favorite immediately refreshes the filtered list without changing the editor or saved time', () => {
  const h = harness(), originalDraft = h.context.currentDraft;
  const original = listSavedMessages(h.context.state.people[0]).find(item => item.id === 'favorite');
  h.favorites(true);
  assert.deepEqual(h.ids(), ['favorite']);
  h.handlers.get('favorite-saved-message:click')();
  const updated = listSavedMessages(h.context.state.people[0]).find(item => item.id === 'favorite');
  assert.equal(updated.favorite, false);
  assert.equal(updated.text, original.text);
  assert.equal(updated.savedAt, original.savedAt);
  assert.deepEqual(h.ids(), []);
  assert.equal(h.element('library-result-count').textContent, '이 범위의 4개 중 0개');
  assert.equal(h.element('library-actions').hidden, true);
  assert.equal(h.context.currentDraft, originalDraft);
  assert.equal(h.element('draft-text').value, '직접 편집 중인 초안');
  assert.equal(h.element('draft-confirm').checked, true);
  assert.equal(h.context.state.drafts.length, 0);
  assert.equal(h.context.state.activities.length, 0);
  assert.equal(h.writes.length, 1, 'only the explicit favorite change saves');
});

test('filtered loading honors cancel and rejects a selection removed by a changed search during confirmation', async () => {
  const h = harness();
  h.search('CAFÉ');
  await h.handlers.get('load-saved-message:click')();
  assert.equal(h.generated.length, 0);
  assert.equal(h.element('draft-text').value, '직접 편집 중인 초안');
  h.context.confirmDelete = async () => { h.search('KEYWORD'); return true; };
  await assert.rejects(h.handlers.get('load-saved-message:click')(), /보관한 문구가 바뀌었어요/u);
  assert.equal(h.generated.length, 0);
  assert.equal(h.writes.length, 0);
});

test('filtered deletion honors cancel and an old account confirmation cannot delete the new account message', async () => {
  const h = harness();
  h.search('CAFÉ');
  const original = JSON.stringify(h.context.state);
  await h.handlers.get('delete-saved-message:click')();
  assert.equal(JSON.stringify(h.context.state), original);
  h.context.confirmDelete = async () => { h.context.authEpoch++; return true; };
  await h.handlers.get('delete-saved-message:click')();
  assert.equal(JSON.stringify(h.context.state), original);
  assert.equal(h.writes.length, 0);
  assert.equal(h.element('draft-text').value, '직접 편집 중인 초안');
});
