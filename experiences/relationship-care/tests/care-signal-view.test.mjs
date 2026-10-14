import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, makePerson, importBackup, recordCareAction } from '../model.mjs';
import { todayCards } from '../care-today.mjs';
import { createCareSignal } from '../care-signal-view.mjs';

// 시그널 판 새 화면 모듈: 그리기와 단추만 맡고, 상태는 commit으로만 바꾼다.
function element() {
  return { innerHTML: '', textContent: '', hidden: false, dataset: {}, value: '', checked: false, options: [{}], insertAdjacentHTML(_, html) { this.inserted = (this.inserted || '') + html; }, showModal() { this.open = true; }, close() { this.open = false; }, focus() {} };
}
function harness(state, { view = 'home', selected = null } = {}) {
  const els = new Map(), $ = id => { if (!els.has(id)) els.set(id, element()); return els.get(id); };
  const calls = { commits: [], notices: [], downloads: [], chosen: [] };
  let current = state, activeView = view;
  const signal = createCareSignal({
    $, getState: () => current, getSelectedId: () => selected, getActiveView: () => activeView, setActiveView: next => { activeView = next; },
    commit: next => { current = next; calls.commits.push(next); }, notify: text => calls.notices.push(text), choosePerson: async (id, tab) => calls.chosen.push([id, tab]),
    download: (text, name, type) => calls.downloads.push({ text, name, type }),
  });
  const click = dataset => signal.onClick({ target: { closest: () => ({ dataset, id: dataset.id || '' }) } });
  return { signal, $, calls, click, state: () => current, view: () => activeView };
}
const people = (...rows) => importBackup({ ...emptyState(), people: rows.map(([id, name]) => makePerson({ id, name })) });

test('오늘 챙길 사람 카드는 이름을 이스케이프하고, 누른 방법으로 기록하면 그 사람이 오늘 목록에서 빠진다', async () => {
  const h = harness(people(['a', '<img src=x onerror=alert(1)>'], ['b', '지민']));
  h.signal.render();
  const html = h.$('today-cards').innerHTML;
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  const first = JSON.parse(h.$('today-cards').dataset.cards)[0];
  assert.equal(await h.click({ todayDone: first.key, how: 'call' }), true);
  assert.equal(h.calls.commits.length, 1);
  assert.ok(!todayCards({ state: h.state() }).cards.some(card => card.personId === first.personId), '챙긴 사람은 바로 빠진다');
  assert.match(h.calls.notices[0], /안부 주기/);
});

test('「문구 준비」는 그 사람의 마음 전하기 탭을 열고 상태를 바꾸지 않는다', async () => {
  const h = harness(people(['a', '서연']));
  h.signal.render();
  await h.click({ todayDraft: 'a' });
  assert.deepEqual(h.calls.chosen, [['a', 'message']]);
  assert.equal(h.calls.commits.length, 0);
});

test('장부는 장부 탭에서만 그리고, 이름을 이스케이프하며 CSV는 한글이 깨지지 않게 내보낸다', async () => {
  let state = people(['a', '<b>민수</b>']);
  state = recordCareAction(state, { personId: 'a', kind: 'money', direction: 'sent', occurredOn: '2026-05-01', amountWon: 100000, note: '', occasion: 'wedding' }, new Date('2026-05-02T00:00:00Z'));
  const home = harness(state);
  home.signal.render();
  assert.equal(home.$('ledger-view').hidden, true);
  assert.equal(home.$('ledger-view').innerHTML, '');
  const ledger = harness(state, { view: 'ledger' });
  ledger.signal.render();
  const html = ledger.$('ledger-view').innerHTML;
  assert.equal(ledger.$('ledger-view').hidden, false);
  assert.match(html, /100,000원/);
  assert.match(html, /&lt;b&gt;민수&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>민수<\/b>/);
  await ledger.click({ ledgerExport: '' });
  assert.equal(ledger.calls.downloads[0].name, 'synk-care-ledger.csv');
  assert.ok(ledger.calls.downloads[0].text.startsWith('﻿'), 'BOM');
});

test('갖고 싶다고 한 것 메모는 선택한 사람에게 저장되고, 사람이 없으면 아무것도 그리지 않는다', async () => {
  const h = harness(people(['a', '할머니']), { selected: 'a' });
  h.$('wish-text').value = '따뜻한 무릎 담요';
  const handled = await h.signal.onSubmit({ target: { id: 'wish-form' }, preventDefault() {} });
  assert.equal(handled, true);
  assert.equal(h.state().people[0].wishes[0].text, '따뜻한 무릎 담요');
  assert.equal(h.$('wish-text').value, '');
  h.signal.render();
  assert.match(h.$('gift-notes').innerHTML, /따뜻한 무릎 담요/);
  const none = harness(people(['a', '할머니']));
  none.signal.render();
  assert.equal(none.$('gift-notes').innerHTML, '');
});

test('행사 고르기 목록은 한 번만 채운다', () => {
  const h = harness(people(['a', '지민']));
  h.signal.render(); h.$('care-log-occasion').options = [{}, {}]; h.signal.render();
  assert.equal((h.$('care-log-occasion').inserted.match(/<option/g) || []).length > 3, true);
  const once = h.$('care-log-occasion').inserted;
  h.signal.render();
  assert.equal(h.$('care-log-occasion').inserted, once);
});
