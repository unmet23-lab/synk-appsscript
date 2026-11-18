// 솔리오 안쪽 방(2단계 둘째 조각)의 상태와 동작 시험. 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 4절 · 8절 · 12.1절.
// 가짜 구독 다리로 부른 것을 적고, 두 번 누르기의 막이(0.6초 · 10초), 묶음과 초점 요청, 저장, 로그인 단계, 계정이 바뀐 뒤 늦은 답 버리기를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbRooms, ROOM_TIMING, ASIDE_ROOMS } from '../renderer/orb-rooms.mjs';
import { CODE_SAY } from '../renderer/solio-rooms.mjs';

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
  assert.deepEqual(ASIDE_ROOMS, ['manage', 'account']);
  assert.deepEqual(ROOM_TIMING, { armGuard: 600, armExpire: 10000, account: 15000, tokLive: 60000, tokPaint: 1000 });
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

/* ── 둘째 묶음: 모델별 토큰 줄(설계 3.4, 설계 검토 D8)과 내 계정 방(설계 5.4, 8.3) ── */
function tokHarness({ state = { ok: true, enabled: false, epoch: 1, seq: 1 }, answers = {} } = {}) {
  let clock = NOW, tok = state, listen = null, unsubs = 0;
  const calls = [], ticks = [], cleared = [];
  const answer = (name, fallback) => (...args) => { calls.push([name, ...args]); const a = answers[name]; return Promise.resolve(typeof a === 'function' ? a(...args) : a ?? fallback(...args)); };
  const bump = patch => (tok = { ...tok, seq: tok.seq + 1, ...patch });
  const subs = {
    tokens: answer('tokens', () => tok),
    tokensScan: answer('tokensScan', options => (options?.force ? bump({ scanning: true }) : tok)),
    tokensEnable: answer('tokensEnable', on => bump(on ? { enabled: true, scanning: true, scannedAt: null } : { enabled: false, scanning: false })),
    tokensLive: answer('tokensLive', on => bump({ live: on })),
    onTokens: fn => { listen = fn; return () => { unsubs++; listen = null; }; },
  };
  let changes = 0;
  const rooms = createOrbRooms({ subs, now: () => clock, setTimer: () => 0, clearTimer: () => {}, setTick: (fn, ms) => { ticks.push(ms); return ticks.length; }, clearTick: id => { cleared.push(id); }, changed: () => { changes++; } });
  const press = (act, arg = '') => rooms.handle({ room: 'solio', key: 'tok', act, arg });
  const row = () => rooms.tokRow();
  const acts = () => row().more.filter(x => x[0] === 'acts').flatMap(x => x[1]);
  return { rooms, calls, ticks, cleared, press, row, acts, names: () => calls.map(c => c[0]), push: v => listen?.(v), advance: ms => { clock += ms; }, get unsubs() { return unsubs; }, get changes() { return changes; }, get state() { return tok; } };
}
const settle = async (n = 6) => { for (let i = 0; i < n; i++) await tick(); };

test('tokens are read once after entering, notifications are taken in order, and a reset stops listening', async () => {
  const h = tokHarness();
  assert.equal(h.row(), null, 'no line before anything is read');
  h.rooms.tokStart(); h.rooms.tokStart();
  h.rooms.tokLoad(); h.rooms.tokLoad();
  await settle();
  assert.deepEqual(h.names(), ['tokens'], 'read once');
  assert.equal(h.row().mid, '꺼져 있습니다');
  h.push({ ok: true, enabled: true, epoch: 1, seq: 9, scannedAt: NOW - 60e3, cells: [] });
  assert.equal(h.row().mid, '지난 7일 동안 센 응답이 없습니다');
  h.push({ ok: true, enabled: false, epoch: 1, seq: 3 });
  assert.equal(h.row().mid, '지난 7일 동안 센 응답이 없습니다', 'an older state does not cover a newer one');
  h.rooms.reset();
  assert.equal(h.unsubs, 1);
  assert.equal(h.row(), null);
  h.rooms.tokLoad();
  await settle();
  assert.equal(h.names().filter(n => n === 'tokens').length, 2, 'the next account reads again');
});

test('a refused first read is not counted, so the next chance reads again', async () => {
  let refuse = true;
  const h = tokHarness({ answers: { tokens: () => (refuse ? { ok: false, code: 'SIGN_IN_REQUIRED' } : { ok: true, enabled: false, epoch: 1, seq: 1 }) } });
  h.rooms.tokLoad(); await settle();
  assert.equal(h.row(), null);
  refuse = false;
  h.rooms.tokLoad(); await settle();
  assert.equal(h.row().mid, '꺼져 있습니다');
});

test('live counting is asked only while the line is open and the room is seen, renewed each minute, and dropped when folded (설계 검토 D8)', async () => {
  const h = tokHarness({ state: { ok: true, enabled: true, epoch: 1, seq: 1, scannedAt: NOW - 60e3, cells: [] } });
  h.rooms.tokLoad(); await settle();
  h.rooms.syncLive(true);
  assert.ok(!h.names().includes('tokensLive'), 'a closed line does not ask');
  await h.press('row-open');
  h.rooms.syncLive(true);
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] !== 'tokens').map(c => [c[0], c[1]]), [['tokensScan', { force: false }], ['tokensLive', true]]);
  assert.deepEqual(h.ticks, [ROOM_TIMING.tokLive]);
  h.rooms.syncLive(true);
  assert.equal(h.names().filter(n => n === 'tokensLive').length, 1, 'the same state asks nothing more');
  h.rooms.syncLive(false);
  await settle();
  assert.deepEqual(h.calls.at(-1).slice(0, 2), ['tokensLive', false]);
  assert.deepEqual(h.cleared, [1]);
  h.rooms.syncLive(true); await settle();
  await h.press('row-fold');
  h.rooms.syncLive(true); await settle();
  assert.deepEqual(h.calls.at(-1).slice(0, 2), ['tokensLive', false], 'folding the line stops it');
  const off = tokHarness();
  off.rooms.tokLoad(); await settle();
  await off.press('row-open');
  off.rooms.syncLive(true);
  assert.ok(!off.names().includes('tokensLive'), 'a switched-off count asks nothing');
});

test('switching tokens on says it may take minutes; the range and 「모두 보기」 stay in memory', async () => {
  const h = tokHarness();
  h.rooms.tokStart(); h.rooms.tokLoad(); await settle();
  await h.press('tok-on');
  assert.deepEqual(h.calls.find(c => c[0] === 'tokensEnable').slice(1), [true]);
  assert.equal(h.row().mid, '처음 세는 중입니다');
  assert.equal(h.row().more.at(-1)[1], '켰습니다. 기록이 많으면 처음 세는 데 몇 분 걸립니다.');
  h.push({ ...h.state, seq: 50, scanning: false, scannedAt: NOW, cells: [] });
  await h.press('tok-range', 'today');
  assert.equal(h.row().more.find(x => x[0] === 'pick')[3], 'today');
  await h.press('tok-range', 'year');
  assert.equal(h.row().more.find(x => x[0] === 'pick')[3], 'today', 'an unknown range is ignored');
  h.rooms.close();
  assert.equal(h.row().more.find(x => x[0] === 'pick')[3], 'today', 'closing a room keeps the range while the app runs');
  await h.press('tok-scan');
  assert.deepEqual(h.calls.find(c => c[0] === 'tokensScan').slice(1), [{ force: true }]);
  assert.equal(h.row().more.at(-1)[1], '기록 파일을 다시 세고 있습니다.');
});

test('switching tokens off asks twice with the guard, and a failed delete keeps it on with the reason', async () => {
  const h = tokHarness({ state: { ok: true, enabled: true, epoch: 1, seq: 1, scannedAt: NOW - 60e3, cells: [] } });
  h.rooms.tokLoad(); await settle();
  await h.press('tok-off');
  assert.equal(h.acts().find(a => a[1] === 'tok-off')[0], '한 번 더 누르면 끄고 지웁니다');
  h.advance(200);
  await h.press('tok-off');
  assert.ok(!h.names().includes('tokensEnable'), 'a double click does not switch off');
  h.advance(500);
  await h.press('tok-off');
  assert.deepEqual(h.calls.find(c => c[0] === 'tokensEnable').slice(1), [false]);
  assert.equal(h.row().mid, '꺼져 있습니다');
  assert.equal(h.row().more.at(-1)[1], '모델별 토큰을 끄고 모은 숫자를 지웠습니다.');
  const bad = tokHarness({ state: { ok: true, enabled: true, epoch: 1, seq: 1, scannedAt: NOW - 60e3, cells: [] }, answers: { tokensEnable: { ok: false, code: 'DELETE_FAILED' } } });
  bad.rooms.tokLoad(); await settle();
  await bad.press('tok-off'); bad.advance(700); await bad.press('tok-off');
  assert.notEqual(bad.row().mid, '꺼져 있습니다');
  assert.equal(bad.row().more.at(-1)[1], CODE_SAY.DELETE_FAILED);
});

const AID = '11111111-1111-4111-8111-111111111111';
const accView = (extra = {}) => ({ ok: true, account: { synk_user_id: AID, status: 'active', profile: { display_name: '합성 회원', locale: 'ko', time_zone: 'Asia/Seoul' }, profile_revision: 3 },
  memberships: [], learning: { enabled: false, revision: 2 }, capabilities: { learningSync: true },
  sessions: [{ id: 's-now', product: 'platform', current: true, last_seen: new Date(NOW).toISOString() }, { id: 's-phone', product: 'world', label: '휴대폰', last_seen: new Date(NOW - 864e5).toISOString() }], dataRequests: [], ...extra });
const accWho = () => ({ ok: true, email: 'member@example.com', createdAt: '2026-03-02T00:00:00Z', identities: [{ provider: 'email' }] });
function accHarness({ answers = {}, leave = true } = {}) {
  let clock = NOW, data = accView();
  const calls = [], hooks = { opened: 0, changed: 0, old: 0, out: 0, leave: 0, all: 0 };
  const reply = (op, params) => { calls.push([op, params]); const a = answers[op]; return Promise.resolve(typeof a === 'function' ? a(params) : a ?? (op === 'accountView' ? data : op === 'identity' ? accWho() : { ok: true })); };
  const account = {
    request: reply,
    identity: () => reply('identity'),
    security: section => { calls.push(['security', section]); return Promise.resolve(answers.security ?? { ok: true }); },
    securityOpened: () => { hooks.opened++; },
    changed: () => { hooks.changed++; },
    signedOutAll: () => { hooks.all++; },
  };
  let changes = 0;
  const rooms = createOrbRooms({ account, now: () => clock, setTimer: () => 0, clearTimer: () => {}, setTick: () => 0, clearTick: () => {}, changed: () => { changes++; },
    confirmLeave: () => { hooks.leave++; return Promise.resolve(leave); }, signOut: () => { hooks.out++; }, openOld: () => { hooks.old++; }, randomId: () => 'req-1' });
  const room = () => rooms.scene({ aside: 'account', name: '', accountKey: AID }).account;
  const line = key => room().rows.find(r => r.key === key);
  const live = key => line(key).more.at(-1)[1];
  const press = (key, act, arg = '', fields = {}) => rooms.handle({ room: 'account', key, act, arg, fields });
  return { rooms, calls, hooks, room, line, live, press, ops: () => calls.map(c => c[0]), setData: v => { data = v; }, advance: ms => { clock += ms; }, get changes() { return changes; } };
}

test('opening 내 계정 reads the account and the identity together, and shows the number while it waits', async () => {
  let release;
  const h = accHarness({ answers: { accountView: () => new Promise(r => { release = r; }) } });
  h.rooms.open('account');
  assert.equal(h.room().say, '계정 정보를 불러오고 있습니다.');
  assert.equal(h.room().foot, '문의할 때 쓰는 계정 번호 ' + AID);
  await settle();
  release(accView());
  await settle();
  assert.deepEqual(h.ops().sort(), ['accountView', 'identity']);
  assert.equal(h.room().say, '합성 회원 님으로 로그인했습니다.');
  assert.equal(h.line('login').when, 'member@example.com');
});

test('a failed read says why and 「다시 불러오기」 reads again', async () => {
  let fail = true;
  const h = accHarness({ answers: { accountView: () => (fail ? { ok: false, error: { code: 'SERVICE_UNAVAILABLE', retryable: true } } : accView()) } });
  h.rooms.open('account'); await settle();
  assert.deepEqual([h.room().say, h.room().then, h.room().act[1]], ['계정 정보를 불러오지 못했습니다.', '계정 서버에 닿지 못했습니다. 인터넷 연결을 확인한 뒤 다시 해 주세요.', 'retry']);
  fail = false;
  await h.press('', 'retry'); await settle();
  assert.equal(h.room().say, '합성 회원 님으로 로그인했습니다.');
});

test('the name is checked by the old rules, saved with the profile it keeps, and a conflict reads again and says so', async () => {
  const h = accHarness();
  h.rooms.open('account'); await settle();
  await h.press('name', 'name-save', '', { name: '  ' });
  assert.equal(h.live('name'), '이름을 넣어 주세요.');
  await h.press('name', 'name-save', '', { name: '가'.repeat(61) });
  assert.equal(h.live('name'), '이름은 60자 안으로 적어 주세요.');
  await h.press('name', 'name-save', '', { name: '합성 회원' });
  assert.equal(h.live('name'), '지금 이름과 같습니다.');
  await h.press('name', 'name-save', '', { name: '새 이름' }); await settle();
  assert.deepEqual(h.calls.find(c => c[0] === 'updateProfile')[1], { profile: { display_name: '새 이름', locale: 'ko', time_zone: 'Asia/Seoul' }, expected_profile_revision: 3 });
  assert.equal(h.live('name'), '이름을 바꿨습니다. SYNK 앱마다 다음에 열 때 새 이름이 보입니다.');
  assert.equal(h.ops().filter(o => o === 'accountView').length, 2, 'a change reads the account again quietly');
  const c = accHarness({ answers: { updateProfile: { ok: false, error: { code: 'PROFILE_CONFLICT' } } } });
  c.rooms.open('account'); await settle();
  await c.press('name', 'name-save', '', { name: '다른 이름' }); await settle();
  assert.equal(c.live('name'), '다른 곳에서 먼저 이름을 바꿨습니다. 지금 이름을 확인한 뒤 다시 저장해 주세요.');
  assert.equal(c.ops().filter(o => o === 'accountView').length, 2, 'a conflict reads again');
  const old = accHarness();
  old.setData(accView({ account: { ...accView().account, profile_revision: undefined } }));
  old.rooms.open('account'); await settle();
  await old.press('name', 'name-save', '', { name: '새 이름' });
  assert.equal(old.live('name'), '이 계정 서버 판에서는 여기서 이름을 바꿀 수 없습니다.');
  assert.ok(!old.ops().includes('updateProfile'));
});

test('「로그인과 보안」 opens in the browser and is remembered for the sign-in hint; a failure says where to go', async () => {
  const h = accHarness();
  h.rooms.open('account'); await settle();
  await h.press('login', 'security', 'password'); await settle();
  assert.deepEqual(h.calls.find(c => c[0] === 'security'), ['security', 'password']);
  assert.equal(h.hooks.opened, 1);
  assert.equal(h.live('login'), '기본 브라우저에서 SYNK ID의 「로그인과 보안」을 열었습니다. 비밀번호를 바꾸면 이 PC 앱도 로그아웃됩니다.');
  const bad = accHarness({ answers: { security: { ok: false } } });
  bad.rooms.open('account'); await settle();
  await bad.press('login', 'security', 'email'); await settle();
  assert.equal(bad.live('login'), '브라우저를 열지 못했습니다. synk.im/id에서 로그인한 뒤 「로그인과 보안」을 열어 주세요.');
  assert.equal(bad.hooks.opened, 0);
});

test('one place is signed out at once; signing out everywhere asks twice and then checks unsaved writing (설계 검토 D1)', async () => {
  const h = accHarness();
  h.rooms.open('account'); await settle();
  await h.press('places', 'revoke', 's-phone'); await settle();
  assert.deepEqual(h.calls.find(c => c[0] === 'revokeSession')[1], { session_id: 's-phone' });
  assert.equal(h.live('places'), '그 기기의 로그인을 끝냈습니다.');
  await h.press('places', 'revoke-all');
  assert.equal(h.line('places').more.filter(x => x[0] === 'acts').flatMap(x => x[1]).find(a => a[1] === 'revoke-all')[0], '한 번 더 누르면 모두 로그아웃합니다');
  h.advance(300); await h.press('places', 'revoke-all'); await settle();
  assert.equal(h.hooks.leave, 0, 'a press inside 0.6 s is not taken');
  h.advance(400); await h.press('places', 'revoke-all'); await settle();
  assert.equal(h.hooks.leave, 1, 'the second press checks unsaved writing first');
  assert.ok(h.ops().includes('revokeAll'));
  assert.equal(h.hooks.all, 1);
  const kept = accHarness({ leave: false });
  kept.rooms.open('account'); await settle();
  await kept.press('places', 'revoke-all'); kept.advance(700); await kept.press('places', 'revoke-all'); await settle();
  assert.equal(kept.hooks.leave, 1);
  assert.ok(!kept.ops().includes('revokeAll'), 'going back to save sends nothing');
});

test('learning, the old screen for records, and the room’s sign-out', async () => {
  const h = accHarness();
  h.rooms.open('account'); await settle();
  await h.press('data', 'learning'); await settle();
  assert.deepEqual(h.calls.find(c => c[0] === 'setLearning')[1], { enabled: true, expected_revision: 2 });
  assert.equal(h.live('data'), '학습 기록 연결을 켰습니다.');
  assert.equal(h.hooks.changed, 1, 'the launcher reads the account again');
  await h.press('data', 'export');
  await h.press('data', 'town');
  assert.equal(h.hooks.old, 2, 'both open the old account screen (설계 검토 D4)');
  await h.press('', 'sign-out');
  assert.equal(h.hooks.out, 1);
  const locked = accHarness();
  locked.setData(accView({ capabilities: {} }));
  locked.rooms.open('account'); await settle();
  await locked.press('data', 'learning');
  assert.ok(!locked.ops().includes('setLearning'), 'a switch that cannot be turned on sends nothing');
});

test('the deletion request opens a confirm group: focus goes to the question, a press within 0.6 s is ignored, and a retry keeps the same request id (설계 8.3)', async () => {
  let fails = 1;
  const h = accHarness({ answers: { requestDeletion: () => (fails-- > 0 ? { ok: false, error: { code: 'NETWORK' } } : { ok: true, request: { due_at: new Date(2026, 10, 25, 10, 0).toISOString() } }) } });
  h.rooms.open('account'); await settle();
  await h.press('del', 'delete-send');
  assert.ok(!h.ops().includes('requestDeletion'), 'nothing is sent before the group is open');
  await h.press('del', 'delete-ask');
  assert.ok(h.line('del').more.some(x => x[0] === 'confirm'));
  assert.deepEqual([h.room().focus.key, h.room().focus.ask], ['del', true]);
  h.advance(300); await h.press('del', 'delete-send');
  assert.ok(!h.ops().includes('requestDeletion'), 'a double click right after opening sends nothing');
  h.advance(400); await h.press('del', 'delete-send'); await settle();
  assert.equal(h.live('del'), '계정 서버에 닿지 못했습니다. 인터넷 연결을 확인한 뒤 다시 해 주세요.');
  assert.ok(h.line('del').more.some(x => x[0] === 'confirm'), 'a failure keeps the group open');
  await h.press('del', 'delete-send'); await settle();
  const ids = h.calls.filter(c => c[0] === 'requestDeletion').map(c => c[1].request_id);
  assert.deepEqual(ids, ['req-1', 'req-1'], 'the same request id is sent again');
  assert.equal(h.live('del'), '삭제 요청을 받았습니다. 11월 25일 10:00까지는 이 자리에서 취소할 수 있습니다.');
  assert.equal(h.hooks.changed, 1);
});

test('「그만두기」, folding the line and closing the room fold the confirm group; a cancelled request says learning stays off', async () => {
  const h = accHarness();
  h.rooms.open('account'); await settle();
  await h.press('del', 'delete-ask');
  await h.press('del', 'delete-keep');
  assert.ok(!h.line('del').more.some(x => x[0] === 'confirm'));
  assert.deepEqual([h.room().focus.key, h.room().focus.act], ['del', 'delete-ask']);
  await h.press('del', 'delete-ask');
  await h.press('del', 'row-fold');
  assert.ok(!h.line('del').more.some(x => x[0] === 'confirm'), 'folding the row folds the group');
  await h.press('del', 'delete-ask');
  h.rooms.close(); h.rooms.open('account'); await settle();
  assert.ok(!h.line('del').more.some(x => x[0] === 'confirm'), 'closing the room folds it');
  h.setData(accView({ account: { ...accView().account, status: 'deletion-requested' }, dataRequests: [{ kind: 'delete', status: 'pending', request_id: 'r9', due_at: new Date(NOW + 7 * 864e5).toISOString() }] }));
  h.rooms.close(); h.rooms.open('account'); await settle();
  await h.press('del', 'delete-cancel'); await settle();
  assert.deepEqual(h.calls.find(c => c[0] === 'cancelDeletion')[1], { request_id: 'r9' });
  assert.equal(h.live('del'), '삭제 요청을 취소했습니다. 학습 기록 연결은 꺼 둔 채입니다.');
});

test('when the launcher says the account changed, a late answer for the old account is dropped and an open room reads again', async () => {
  let release;
  const h = accHarness({ answers: { accountView: () => new Promise(r => { release = r; }) } });
  h.rooms.open('account');
  await settle();
  const first = release;
  h.rooms.accountChanged();
  await settle();
  first(accView({ account: { ...accView().account, profile: { display_name: '옛 계정 이름' } } }));
  await settle();
  assert.notEqual(h.room().say, '옛 계정 이름 님으로 로그인했습니다.');
  release(accView()); await settle();
  assert.equal(h.room().say, '합성 회원 님으로 로그인했습니다.', 'the open room read the new account');
  h.rooms.reset();
  assert.equal(h.room().say, '계정 정보를 불러오고 있습니다.', 'a reset drops what was shown');
});
