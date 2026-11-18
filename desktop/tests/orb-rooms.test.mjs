// 솔리오 안쪽 방(2단계 둘째 조각)의 상태와 동작 시험. 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 4절 · 8절 · 12.1절.
// 가짜 구독 다리로 부른 것을 적고, 두 번 누르기의 막이(0.6초 · 10초), 묶음과 초점 요청, 저장, 로그인 단계, 계정이 바뀐 뒤 늦은 답 버리기를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbRooms, ROOM_TIMING, ASIDE_ROOMS } from '../renderer/orb-rooms.mjs';

const NOW = new Date(2026, 10, 18, 10, 0).getTime(), D = 864e5;
const weekly = (id, service, extra = {}) => ({ id, service, source: 'auto', label: service, kind: 'weekly', state: 'ok', plan: 'pro', email: id + '@example.com', folder: true, live: { readAt: NOW - 60e3, weekly: { usedPercent: 20, resetsAt: NOW + D } }, ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({ rows = [weekly('c', 'claude', { price: 290000, billDay: 9 }), weekly('t', 'typecast', { kind: 'credit', keyHint: 'a41c', email: null })], answers = {} } = {}) {
  let clock = NOW, snap = { ok: true, seq: 1, rows, check: { at: NOW - 60e3 }, tools: { claude: { installed: true } }, login: null, usage: { accounts: {} }, settings: {} };
  const calls = [], timers = [];
  const answer = (name, fallback) => (...args) => { calls.push([name, ...args]); const a = answers[name]; return typeof a === 'function' ? a(...args) : a ?? fallback(...args); };
  const next = mutate => { snap = { ...snap, seq: snap.seq + 1 }; mutate?.(snap); return snap; };
  const subs = {
    save: answer('save', patch => next(s => { if (patch.remove) s.rows = s.rows.filter(r => r.id !== patch.remove); if (patch.row) s.rows = s.rows.map(r => (r.id === patch.row.id ? { ...r, ...patch.row } : r)); if (patch.add) s.rows = [...s.rows, { id: 'm1', source: 'manual', ...patch.add }]; })),
    check: answer('check', () => next()),
    snapshot: answer('snapshot', () => next()),
    login: answer('login', () => ({ ok: true, id: 'l1' })),
    cancel: answer('cancel', () => ({ ok: true })),
    useExisting: answer('useExisting', () => ({ ok: true, snapshot: next() })),
    install: answer('install', () => ({ ok: true })),
    help: answer('help', () => ({ ok: true })),
    connectKey: answer('connectKey', () => ({ ok: true, snapshot: next() })),
    submitCode: answer('submitCode', () => ({ ok: true })),
    openLoginUrl: answer('openLoginUrl', () => ({ ok: true })),
  };
  let changes = 0, accepted = 0, rereads = 0;
  const copied = [];
  const rooms = createOrbRooms({
    subs,
    now: () => clock,
    setTimer: (fn, ms) => { timers.push(ms); return timers.length; },
    clearTimer: () => {},
    snapshot: () => snap,
    accept: value => { accepted++; snap = value; rooms.observe(value); },
    reread: () => { rereads++; },
    copyText: text => { copied.push(text); return Promise.resolve(true); },
    changed: () => { changes++; },
  });
  rooms.observe(snap);
  const room = () => rooms.scene({ aside: 'manage' }).manage;
  const line = key => room().rows.find(r => r.key === key);
  const live = key => line(key).more.at(-1)[1];
  const press = (key, act, arg = '', fields = {}) => rooms.handle({ room: 'manage', key, act, arg, fields });
  return { rooms, calls, timers, copied, room, line, live, press, advance: ms => { clock += ms; }, setSnap: fn => { snap = fn(snap); }, get snap() { return snap; }, get changes() { return changes; }, get accepted() { return accepted; }, get rereads() { return rereads; } };
}
const removeLabel = (h, key) => h.line(key).more.filter(x => x[0] === 'acts').flatMap(x => x[1]).find(a => a[1] === 'remove');

test('the rooms opened from the fan are listed, and the guard values are the reviewed ones (설계 검토 D1)', () => {
  assert.deepEqual(ASIDE_ROOMS, ['manage']);
  assert.deepEqual(ROOM_TIMING, { armGuard: 600, armExpire: 10000 });
});

test('「지우기」 asks first; a second press within 0.6 s is ignored, after that it removes', async () => {
  const h = harness();
  await h.press('a:c', 'remove');
  assert.deepEqual(removeLabel(h, 'a:c').slice(0, 1), ['한 번 더 누르면 지웁니다']);
  assert.match(h.live('a:c'), /되돌릴 수 없습니다/);
  assert.ok(h.timers.includes(ROOM_TIMING.armExpire), 'a timer takes the question back');
  h.advance(300);
  await h.press('a:c', 'remove');
  assert.ok(!h.calls.some(c => c[0] === 'save'), 'a double click does not remove');
  assert.equal(removeLabel(h, 'a:c')[0], '한 번 더 누르면 지웁니다', 'and the question stays');
  h.advance(400);
  await h.press('a:c', 'remove');
  assert.deepEqual(h.calls.find(c => c[0] === 'save')[1], { remove: 'c' });
  assert.equal(h.line('a:c'), undefined);
  assert.equal(h.room().foot, 'Claude c 계정 줄을 지웠습니다.');
  assert.equal(h.room().focus.say, true, 'focus goes to the first sentence, which now counts one fewer');
});

test('the question goes after 10 s, when the hand or focus leaves, on another button, and on close', async () => {
  const h = harness();
  await h.press('a:c', 'remove');
  h.advance(ROOM_TIMING.armExpire);
  assert.equal(removeLabel(h, 'a:c')[0], '지우기', 'ten seconds later the question is gone');
  await h.press('a:c', 'remove');
  h.advance(ROOM_TIMING.armExpire);
  await h.press('a:c', 'remove');
  assert.ok(!h.calls.some(c => c[0] === 'save'), 'a press after the question expired only asks again');
  await h.press('a:c', 'disarm');
  assert.equal(removeLabel(h, 'a:c')[0], '지우기');
  await h.press('a:c', 'remove');
  await h.press('a:c', 'grp', 'cost');
  assert.equal(removeLabel(h, 'a:c')[0], '지우기', 'another button takes the question back');
  await h.press('a:c', 'remove');
  h.rooms.close();
  assert.equal(removeLabel(h, 'a:c')[0], '지우기');
});

test('the question survives a fresh scene, because it lives in the room state and not in the view', async () => {
  const h = harness();
  await h.press('a:c', 'remove');
  h.setSnap(s => ({ ...s, seq: s.seq + 1, rows: s.rows.map(r => ({ ...r, live: { ...r.live, weekly: { ...r.live.weekly, usedPercent: 40 } } })) }));
  h.advance(1000);
  assert.equal(removeLabel(h, 'a:c')[0], '한 번 더 누르면 지웁니다');
  assert.match(h.line('a:c').mid, /한도 60% 남음/, 'the scene itself was new');
});

test('a group opens and closes from its button; saving closes it, notes 「저장했습니다.」 and asks for focus on that button', async () => {
  const h = harness();
  await h.press('a:c', 'grp', 'cost');
  assert.equal(h.line('a:c').more.find(x => x[0] === 'grp' && x[1] === 'cost')[3], false);
  assert.deepEqual([h.room().focus.key, h.room().focus.grp], ['a:c', 'cost'], 'opening asks to focus the first field');
  await h.press('a:c', 'save-cost', '', { price: '300,000', currency: 'KRW', billDay: '40', cycle: '' });
  assert.equal(h.live('a:c'), '결제일은 1부터 31 사이로 넣어 주세요.');
  assert.ok(!h.calls.some(c => c[0] === 'save'));
  await h.press('a:c', 'save-cost', '', { price: '300,000', currency: 'KRW', billDay: '7', cycle: '', note: '' });
  assert.deepEqual(h.calls.find(c => c[0] === 'save')[1], { row: { id: 'c', price: 300000, currency: 'KRW', billDay: 7, note: '', cycle: null } });
  assert.equal(h.live('a:c'), '저장했습니다.');
  assert.equal(h.line('a:c').more.find(x => x[0] === 'grp' && x[1] === 'cost')[3], true);
  assert.deepEqual([h.room().focus.act, h.room().focus.arg], ['grp', 'cost']);
  assert.equal(h.line('a:c').val, '월 300,000원');
});

test('a refused save keeps the group open and says the reason in words', async () => {
  const h = harness({ answers: { save: () => ({ ok: false, code: 'BOARD_BUSY' }) } });
  await h.press('a:c', 'grp', 'cost');
  await h.press('a:c', 'save-cost', '', { price: '1' });
  assert.equal(h.live('a:c'), '다른 프로그램이 구독 관리 파일을 잠깐 쓰고 있습니다. 잠시 뒤 다시 해 주세요.');
  assert.equal(h.line('a:c').more.find(x => x[0] === 'grp' && x[1] === 'cost')[3], false);
});

test('one thing at a time: a second action while one is out is not sent', async () => {
  let release;
  const h = harness({ answers: { check: () => new Promise(resolve => { release = resolve; }) } });
  h.setSnap(s => ({ ...s, rows: s.rows.map(r => (r.id === 'c' ? { ...r, state: 'error' } : r)) }));
  const first = h.press('a:c', 'reread-one');
  assert.match(h.line('a:c').more.filter(x => x[0] === 'acts').flatMap(x => x[1]).find(a => a[1] === 'reread-one')[3], /off/);
  await h.press('a:c', 'reread-one');
  assert.equal(h.calls.filter(c => c[0] === 'check').length, 1);
  release({ ...h.snap, seq: 9 });
  await first;
  assert.equal(h.accepted, 1);
});

test('「1장 썼습니다」 saves one fewer pass, then reads that account alone again', async () => {
  const h = harness({ rows: [weekly('c', 'claude', { passCount: 2, passUntil: NOW + 3 * D })] });
  await h.press('a:c', 'pass-used');
  assert.deepEqual(h.calls.map(c => [c[0], c[1]]), [['save', { row: { id: 'c', passCount: 1 } }], ['check', ['c']]]);
  assert.equal(h.live('a:c'), '초기화권을 1장 줄였습니다. 1장 남았습니다.');
});

test('adding Claude: the e-mail is checked, the login starts, and a finished login folds the add line', async () => {
  const h = harness();
  await h.press('add', 'add-pick', 'claude');
  await h.press('add', 'login', 'claude', { email: 'qa@' });
  assert.equal(h.live('add'), '이메일 형식을 확인해 주세요.');
  await h.press('add', 'login', 'claude', { email: 'qa@example.com' });
  assert.deepEqual(h.calls.at(-1), ['login', 'claude', { email: 'qa@example.com' }]);
  h.rooms.observe({ ...h.snap, login: { id: 'l1', service: 'claude', stage: 'browser', needsCode: true, url: 'https://example.com/a' } });
  h.setSnap(s => ({ ...s, login: { id: 'l1', service: 'claude', stage: 'browser', needsCode: true, url: 'https://example.com/a' } }));
  await h.press('add', 'code', '', { code: 'short' });
  assert.equal(h.live('add'), '코드를 끝까지 붙여 넣어 주세요.');
  await h.press('add', 'code', '', { code: 'QACODE1234' });
  assert.deepEqual(h.calls.at(-1), ['submitCode', 'l1', 'QACODE1234']);
  await h.press('add', 'console-login', 'claude');
  assert.deepEqual(h.calls.at(-1), ['login', 'claude', { email: 'qa@example.com', console: true }], 'the black window keeps the e-mail');
  await h.press('add', 'copy-url');
  assert.deepEqual(h.copied, ['https://example.com/a']);
  h.setSnap(s => ({ ...s, login: { id: 'l1', service: 'claude', stage: 'done' } }));
  h.rooms.observe(h.snap);
  assert.equal(h.room().closing.key, 'add');
  assert.equal(h.room().foot, 'Claude 새 계정 줄을 더했습니다. 요금과 결제일은 그 줄을 열어 고칩니다.');
  assert.equal(h.line('add').more[0][3], '', 'the add line is back to choosing');
});

test('a cancelled login says so in the line that started it; a login that ended before the room was seen says nothing', () => {
  const h = harness();
  h.rooms.reset();
  h.rooms.observe({ ...h.snap, login: { id: 'old', service: 'gpt', stage: 'done' } });
  assert.equal(h.room().foot, '로그인 정보와 사용량은 이 PC 밖으로 나가지 않습니다.');
  h.rooms.observe({ ...h.snap, login: { id: 'l2', service: 'gpt', stage: 'browser' } });
  h.rooms.observe({ ...h.snap, login: { id: 'l2', service: 'gpt', stage: 'cancelled' } });
  assert.equal(h.live('add'), '로그인을 취소했습니다.');
});

test('「다시 로그인」 runs the login inside that account line with its own e-mail; Typecast asks for a new key there', async () => {
  const h = harness();
  await h.press('a:c', 'relogin');
  assert.deepEqual(h.calls.at(-1), ['login', 'claude', { email: 'c@example.com' }]);
  h.setSnap(s => ({ ...s, login: { id: 'l1', service: 'claude', stage: 'browser', url: 'https://example.com/a' } }));
  h.rooms.observe(h.snap);
  assert.ok(h.line('a:c').more.some(x => x[0] === 'row' && x[1] === '로그인' && /브라우저에서 로그인을 마쳐 주세요/.test(x[2])));
  h.setSnap(s => ({ ...s, login: { ...s.login, stage: 'done' } }));
  h.rooms.observe(h.snap);
  assert.equal(h.live('a:c'), '다시 연결했습니다. 바로 한 번 읽습니다.');
  await h.press('a:t', 'relogin');
  assert.equal(h.calls.filter(c => c[0] === 'login').length, 1, 'Typecast does not start a login');
  assert.deepEqual([h.room().focus.key, h.room().focus.field], ['a:t', 'key']);
  await h.press('a:t', 'key', 'typecast', { key: 'tc-key' });
  assert.deepEqual(h.calls.at(-1), ['connectKey', 'typecast', 'tc-key', { replace: 't' }]);
});

test('install, recheck, copy and help', async () => {
  const h = harness({ answers: { help: () => ({ ok: false, code: 'OPEN_FAILED' }) } });
  await h.press('add', 'add-pick', 'gpt');
  await h.press('add', 'install', 'gpt');
  assert.equal(h.live('add'), 'Codex 설치 창을 열었습니다. 창을 닫지 말고 끝날 때까지 기다려 주세요.');
  assert.ok(h.line('add').more.some(x => x[0] === 'acts' && x[1].some(a => a[1] === 'recheck-tools')));
  await h.press('add', 'recheck-tools', 'gpt');
  assert.deepEqual(h.calls.at(-1), ['snapshot', { refreshTools: true }]);
  assert.equal(h.live('add'), '아직 설치를 찾지 못했습니다. 설치 창이 끝난 뒤 다시 확인해 주세요.');
  await h.press('add', 'tool-copy', 'gpt');
  assert.match(h.copied.at(-1), /chatgpt\.com\/codex\/install\.ps1/);
  assert.equal(h.live('add'), '명령을 복사했습니다. PowerShell에 붙여 넣어 주세요.');
  await h.press('add', 'help', 'claude-plans');
  assert.equal(h.live('add'), '브라우저를 열지 못했습니다. 잠시 뒤 다시 해 주세요.');
});

test('another subscription is added with the picked kind, or the kind its name suggests', async () => {
  const h = harness();
  await h.press('add', 'add-pick', 'other');
  await h.press('add', 'manual-add', '', { label: '' });
  assert.equal(h.live('add'), '서비스 이름을 넣어 주세요.');
  await h.press('add', 'manual-add', '', { label: 'Suno', price: '10', currency: 'USD', billDay: '3' });
  assert.equal(h.calls.at(-1)[1].add.kind, 'credit');
  assert.equal(h.room().foot, 'Suno를 넣었습니다. 요금과 결제일은 그 줄을 열어 고칩니다.');
  await h.press('add', 'add-pick', 'other');
  await h.press('add', 'kind-pick', 'weekly');
  await h.press('add', 'manual-add', '', { label: 'Suno', resetDay: '1', resetTime: '09:00' });
  assert.deepEqual([h.calls.at(-1)[1].add.kind, h.calls.at(-1)[1].add.resetDay], ['weekly', 1]);
});

test('the cost line saves the dollar rate and the tip reaction, and 「모두 다시 읽기」 asks the controller to read', async () => {
  const h = harness();
  await h.rooms.handle({ room: 'solio', key: 'cost', act: 'rate-save', fields: { usdKrw: '0' } });
  assert.equal(h.rooms.costRow().more.at(-1)[1], '1달러가 몇 원인지 숫자로 넣어 주세요.');
  await h.rooms.handle({ room: 'solio', key: 'cost', act: 'rate-save', fields: { usdKrw: '1,450' } });
  assert.deepEqual(h.calls.at(-1), ['save', { settings: { usdKrw: 1450 } }]);
  await h.rooms.handle({ room: 'solio', key: 'cost', act: 'tip', arg: 'annual:claude|stop' });
  assert.deepEqual(h.calls.at(-1), ['save', { tip: { key: 'annual:claude', action: 'stop' } }]);
  await h.press('', 'reread-all');
  assert.equal(h.rereads, 1);
});

test('opening the room asks to open the account to fix, a subscription’s first account, or 「계정 더하기」', () => {
  const h = harness({ rows: [weekly('a', 'claude'), weekly('b', 'gpt')] });
  h.rooms.open('manage', { svc: 'gpt' });
  assert.equal(h.room().opening.key, 'a:b');
  h.rooms.open('manage');
  assert.equal(h.room().opening, null);
  const empty = harness({ rows: [] });
  empty.rooms.open('manage');
  assert.equal(empty.room().opening.key, 'add');
  assert.equal(h.rooms.scene({ aside: null }), null);
});

test('after the account changes (reset), a late answer is dropped', async () => {
  let release;
  const h = harness({ answers: { save: () => new Promise(resolve => { release = resolve; }) } });
  await h.press('a:c', 'grp', 'cost');
  const pending = h.press('a:c', 'save-cost', '', { price: '1' });
  h.rooms.reset();
  release({ ok: true, rows: [] });
  await pending;
  await tick();
  assert.equal(h.accepted, 0);
  assert.equal(h.line('a:c').more.find(x => x[0] === 'grp' && x[1] === 'cost')[3], true, 'the reset also closed the group');
});
