// 솔리오 안쪽 방(2단계 둘째 조각)의 상태와 동작 시험. 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 4절 · 8절 · 12.1절.
// 가짜 구독 다리로 부른 것을 적고, 두 번 누르기의 막이(0.6초 · 10초), 묶음과 초점 요청, 저장, 로그인 단계, 계정이 바뀐 뒤 늦은 답 버리기를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbRooms, ROOM_TIMING, ASIDE_ROOMS, ROOM_BUSY_SAY } from '../renderer/orb-rooms.mjs';
import { CODE_SAY } from '../renderer/solio-rooms.mjs';
import { tokenDay } from '../renderer/subscriptions-tokens.mjs';

const NOW = new Date(2026, 10, 18, 10, 0).getTime(), D = 864e5;
const weekly = (id, service, extra = {}) => ({ id, service, source: 'auto', label: service, kind: 'weekly', state: 'ok', plan: 'pro', email: id + '@example.com', folder: true, live: { readAt: NOW - 60e3, weekly: { usedPercent: 20, resetsAt: NOW + D } }, ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({ rows = [weekly('c', 'claude', { price: 290000, billDay: 9 }), weekly('t', 'typecast', { kind: 'credit', keyHint: 'a41c', email: null })], answers = {}, open = true } = {}) {
  let clock = NOW, snap = { ok: true, seq: 1, rows, check: { at: NOW - 60e3 }, tools: { claude: { installed: true } }, login: null, usage: { accounts: {} }, settings: {} };
  const calls = [], timers = [], pending = new Map();
  let timerId = 0;
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
    // 타이머는 콜백을 맡아 두고, 시계를 넘기면(advance) 닿은 것을 돌린다. 지우면 돌지 않는다(화면 검수 E1)
    setTimer: (fn, ms) => { timers.push(ms); const id = ++timerId; pending.set(id, { fn, at: clock + ms }); return id; },
    clearTimer: id => { pending.delete(id); },
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
  // 컨트롤러처럼 방을 연 채로 시험한다(로그인 끝 알림은 계정 관리 방이 열려 있을 때만 쓴다, 검수 B)
  if (open) rooms.open('manage');
  const advance = ms => {
    clock += ms;
    for (const [id, t] of [...pending].sort((a, b) => a[1].at - b[1].at)) if (t.at <= clock && pending.has(id)) { pending.delete(id); t.fn(); }
  };
  return { rooms, calls, timers, copied, room, line, live, press, advance, setSnap: fn => { snap = fn(snap); }, get snap() { return snap; }, get pending() { return pending.size; }, get changes() { return changes; }, get accepted() { return accepted; }, get rereads() { return rereads; } };
}
const removeLabel = (h, key) => h.line(key).more.filter(x => x[0] === 'acts').flatMap(x => x[1]).find(a => a[1] === 'remove');

test('official credit buttons send the account printed on the button and keep a failed read separate from a manual confirmation', async () => {
  const row=weekly('studio','gemini'), h=harness({rows:[row],answers:{save:{ok:false,code:'CREDIT_WRONG_ACCOUNT'}}});
  const key='a:'+row.id, arg=JSON.stringify([row.email,row.plan]);
  const actions=h.line(key).more.filter(part=>part[0]==='acts').flatMap(part=>part[1]);
  const read=actions.find(button=>button[1]==='read-credit-flow');
  assert.equal(read[2],arg);
  await h.press(key,read[1],read[2]);
  assert.deepEqual(h.calls.filter(c=>c[0]==='save'),[['save',{creditRead:{kind:'flow',id:row.id,email:row.email,plan:row.plan}}]]);
  assert.match(h.live(key),/계정|이메일/);
  await h.press(key,'save-flow-usage',arg,{flowFrom:'2026-11-01',flowTo:'2026-11-18',flowUsed:'0'});
  assert.deepEqual(h.calls.filter(c=>c[0]==='save').at(-1),['save',{creditCheck:{kind:'flow',id:row.id,email:row.email,plan:row.plan,from:'2026-11-01',to:'2026-11-18',used:0}}]);
});

test('the rooms opened from the fan are listed, and the guard values are the reviewed ones (설계 검토 D1)', () => {
  assert.deepEqual(ASIDE_ROOMS, ['manage', 'account', 'settings']);
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

test('the question’s timer itself takes it back after 10 s and asks for a redraw; every other way out cancels that timer (화면 검수 E1)', async () => {
  const h = harness();
  await h.press('a:c', 'remove');
  assert.equal(h.pending, 1);
  const before = h.changes;
  h.advance(ROOM_TIMING.armExpire);
  assert.equal(h.pending, 0, 'the timer ran');
  assert.equal(h.changes, before + 1, 'and asked for a redraw while nothing else happened');
  assert.equal(removeLabel(h, 'a:c')[0], '지우기');
  const ways = { disarm: () => h.press('a:c', 'disarm'), 'another button': () => h.press('a:c', 'grp', 'cost'), close: () => h.rooms.close(), reset: () => h.rooms.reset() };
  for (const [name, leave] of Object.entries(ways)) {
    h.rooms.open('manage');
    await h.press('a:c', 'remove');
    assert.equal(h.pending, 1, name + ': asked');
    await leave();
    assert.equal(h.pending, 0, name + ': the earlier timer is cancelled');
  }
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

test('a cancelled login says so in the line that started it; a login that ended before the room was seen says nothing', async () => {
  const h = harness();
  h.rooms.reset();
  h.rooms.open('manage');
  h.rooms.observe({ ...h.snap, login: { id: 'old', service: 'gpt', stage: 'done' } });
  assert.equal(h.room().foot, '로그인 정보와 사용량은 이 PC 밖으로 나가지 않습니다.');
  h.rooms.observe({ ...h.snap, login: { id: 'l2', service: 'gpt', stage: 'browser' } });
  h.rooms.observe({ ...h.snap, login: { id: 'l2', service: 'gpt', stage: 'cancelled' } });
  assert.equal(h.live('add'), '로그인을 취소했습니다.');
  // 계정 줄의 「다시 로그인」에서 시작한 로그인이 취소되면 그 계정 줄에 쓴다. 「계정 더하기」에는 쓰지 않는다(화면 검수 E5)
  const r = harness();
  await r.press('a:c', 'relogin');
  r.setSnap(s => ({ ...s, login: { id: 'l3', service: 'claude', stage: 'browser' } }));
  r.rooms.observe(r.snap);
  r.setSnap(s => ({ ...s, login: { ...s.login, stage: 'cancelled' } }));
  r.rooms.observe(r.snap);
  assert.deepEqual([r.live('a:c'), r.live('add')], ['로그인을 취소했습니다.', '']);
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
  assert.equal(h.live('add'), 'Codex 설치 창을 열었습니다. 끝날 때까지 창을 닫지 말고 기다린 뒤 「다시 확인」을 눌러 주세요.');
  assert.ok(h.line('add').more.some(x => x[0] === 'acts' && x[1].some(a => a[1] === 'recheck-tools')));
  await h.press('add', 'recheck-tools', 'gpt');
  assert.deepEqual(h.calls.at(-1), ['snapshot', { refreshTools: true }]);
  assert.equal(h.live('add'), '아직 설치를 찾지 못했습니다. 설치가 끝난 뒤 다시 확인해 주세요.');
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
  // 읽지 못한 계정이 있으면 그 줄을 먼저 연다. 다른 구독 줄에서 열어도 그렇다(화면 검수 E6)
  const fix = harness({ rows: [weekly('a', 'claude'), weekly('b', 'gpt', { state: 'error' })] });
  fix.rooms.open('manage');
  assert.equal(fix.room().opening.key, 'a:b', 'the account to fix opens first');
  fix.rooms.open('manage', { svc: 'claude' });
  assert.equal(fix.room().opening.key, 'a:b', 'even from another subscription’s line');
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
  // 1분 틱은 콜백을 맡아 두고 beat()로 한 번 돌린다. 지운 틱은 돌지 않는다(화면 검수 E2)
  const beating = new Map();
  const rooms = createOrbRooms({ subs, now: () => clock, setTimer: () => 0, clearTimer: () => {}, setTick: (fn, ms) => { ticks.push(ms); beating.set(ticks.length, fn); return ticks.length; }, clearTick: id => { cleared.push(id); beating.delete(id); }, changed: () => { changes++; } });
  const press = (act, arg = '') => rooms.handle({ room: 'solio', key: 'tok', act, arg });
  const row = () => rooms.tokRow();
  const acts = () => row().more.filter(x => x[0] === 'acts').flatMap(x => x[1]);
  return { rooms, calls, ticks, cleared, press, row, acts, names: () => calls.map(c => c[0]), push: v => listen?.(v), beat: () => { for (const fn of [...beating.values()]) fn(); }, advance: ms => { clock += ms; }, get unsubs() { return unsubs; }, get changes() { return changes; }, get state() { return tok; } };
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

// 11-20부터 구독 방 맨 위 「지금 출력」이 늘 보이므로 줄이 열렸는지와 상관없이 방이 보이는 동안 부탁한다(솔리오 구독 비서 설계 3.3)
test('live counting is asked while the room is seen, renewed each minute, and dropped when the room goes; the last ten minutes start over each time (솔리오 구독 비서 3.3 · D8)', async () => {
  const h = tokHarness({ state: { ok: true, enabled: true, epoch: 1, seq: 1, scannedAt: NOW - 60e3, cells: [] } });
  h.rooms.tokLoad(); await settle();
  // 「지금 출력」이 보이지 않으면(구독이 없거나 자료를 읽기 전) 토큰 줄이 닫힌 동안 부탁하지 않는다(화면 검수 A10)
  h.rooms.syncLive(true, false);
  assert.ok(!h.names().includes('tokensLive'), 'nothing shows the count, nothing is asked');
  h.rooms.syncLive(true, true);
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] !== 'tokens').map(c => [c[0], c[1]]), [['tokensScan', { force: false }], ['tokensLive', true]], 'a room showing 「지금 출력」 asks at once, the token line closed or not');
  assert.deepEqual(h.ticks, [ROOM_TIMING.tokLive]);
  assert.equal(h.rooms.tokLive().state, 'on');
  h.rooms.syncLive(true, true);
  assert.equal(h.names().filter(n => n === 'tokensLive').length, 1, 'the same state asks nothing more');
  // 1분 틱을 실제로 돌리면 오래된 셈을 다시 세 달라고 하고 실시간 부탁을 잇는다(화면 검수 E2)
  let n0 = h.calls.length;
  h.beat(); await settle();
  assert.deepEqual(h.calls.slice(n0).map(c => [c[0], c[1]]), [['tokensScan', { force: false }], ['tokensLive', true]], 'each minute renews the live request');
  h.rooms.syncLive(false);
  await settle();
  assert.deepEqual(h.calls.at(-1).slice(0, 2), ['tokensLive', false]);
  assert.deepEqual(h.cleared, [1]);
  n0 = h.calls.length;
  h.beat(); await settle();
  assert.equal(h.calls.length, n0, 'a cleared tick does not run');
  const off = tokHarness();
  off.rooms.tokLoad(); await settle();
  off.rooms.syncLive(true, true);
  assert.ok(!off.names().includes('tokensLive'), 'a switched-off count asks nothing');
  assert.equal(off.rooms.tokLive()?.state, 'off');
  // 맨 위 「켜기」의 결과 글은 접힌 토큰 줄만이 아니라 지금 출력 줄에도 나온다(Fable 최종 F6)
  await off.press('tok-on');
  assert.match(off.rooms.tokLive().small, /켰습니다/);
});

test('switching tokens on says it may take minutes; the range and 「모두 보기」 stay in memory', async () => {
  const h = tokHarness();
  h.rooms.tokStart(); h.rooms.tokLoad(); await settle();
  await h.press('tok-on');
  assert.deepEqual(h.calls.find(c => c[0] === 'tokensEnable').slice(1), [true]);
  assert.equal(h.row().mid, '처음 세는 중입니다');
  assert.equal(h.row().more.at(-1)[1], '켰습니다. 기록이 많으면 처음 세는 데 몇 분 걸립니다.');
  // 오늘 쓴 모델 여덟 개. 처음에는 여섯 개만 보이고 「모두 보기」가 선다(화면 검수 E7)
  const cells = Array.from({ length: 8 }, (_, i) => [tokenDay(NOW), 'gpt', 'gpt-6.' + i, 10, 9 + i, 0, 0, 0, 1]);
  h.push({ ...h.state, seq: 50, scanning: false, scannedAt: NOW, cells });
  const gauges = () => h.row().more.filter(x => x[0] === 'gauge').length;
  await h.press('tok-range', 'today');
  assert.equal(h.row().more.find(x => x[0] === 'pick')[3], 'today');
  await h.press('tok-range', 'year');
  assert.equal(h.row().more.find(x => x[0] === 'pick')[3], 'today', 'an unknown range is ignored');
  assert.equal(gauges(), 6);
  assert.ok(h.acts().some(a => a[1] === 'tok-all' && a[0] === '모델 8개 모두 보기'));
  await h.press('tok-all');
  assert.equal(gauges(), 8, '「모두 보기」 shows every model');
  h.rooms.close();
  assert.equal(h.row().more.find(x => x[0] === 'pick')[3], 'today', 'closing a room keeps the range while the app runs');
  assert.deepEqual([gauges(), h.acts().find(a => a[1] === 'tok-all')[0]], [8, '여섯 개만 보기'], 'and keeps 「모두 보기」');
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

/* ── 셋째 묶음: 설정 방(설계 6.4, 설계 검토 D7 · D9)과 구독 줄의 팁(D7) ── */
function setHarness({ desktop = { ok: true, preferences: { closeToTray: true, launchAtLogin: false, startHidden: false, globalShortcut: '', zoomFactor: 1 }, capabilities: { launchAtLogin: true, globalShortcut: true, tray: true } }, drafts = { ok: true, available: true, enabled: false }, update = { state: 'current', currentVersion: '0.4.97' }, answers = {}, confirm = true, rows = [weekly('c', 'claude', { passCount: 1, passUntil: NOW + 2 * D })], member = true, care = null } = {}) {
  let careNow = care, clock = NOW, desk = desktop, draft = drafts, up = update, notices = { banners: true, mutedUntil: 0, schedule: false, start: '22:00', end: '08:00', weekdays: false };
  let snap = { ok: true, seq: 1, rows, check: { at: NOW - 60e3 }, usage: { accounts: {} }, settings: {}, tools: {}, login: null };
  const calls = [], listeners = { desktop: null, drafts: null, updates: null }, offs = [];
  const answer = (name, fallback) => (...args) => { calls.push([name, ...args]); const a = answers[name]; return Promise.resolve(typeof a === 'function' ? a(...args) : a ?? fallback(...args)); };
  const listen = name => fn => { listeners[name] = fn; return () => { offs.push(name); listeners[name] = null; }; };
  const pc = {
    desktop: { get: answer('desktop.get', () => desk), update: answer('desktop.update', patch => (desk = { ...desk, preferences: { ...desk.preferences, ...patch } })), onChange: listen('desktop') },
    drafts: { status: answer('drafts.status', () => draft), set: answer('drafts.set', on => (draft = { ...draft, enabled: on })), onChange: listen('drafts') },
    notices: { get: () => ({ ...notices }), set: patch => { calls.push(['notices.set', patch]); notices = { ...notices, ...patch }; return { ...notices }; } },
    updates: { status: answer('updates.status', () => up), check: answer('updates.check', () => (up = { ...up, state: 'checking' })), download: answer('updates.download', () => (up = { ...up, state: 'downloading', progress: 0 })), install: answer('updates.install', () => (up = { ...up, state: 'opening' })), confirmInstall: answer('confirmInstall', () => confirm), onChange: listen('updates') },
    environment: () => ({ platform: 'win32', version: '0.4.97', mode: 'development' }),
    copyDiagnostics: answer('copyDiagnostics', () => true),
    ...(care ? { care: { status: answer('care.status', () => careNow), configure: answer('care.configure', ({ enabled }) => (careNow = { ...careNow, enabled })) } } : {}),
  };
  const subs = { save: answer('save', patch => (snap = { ...snap, seq: snap.seq + 1, settings: { ...snap.settings, ...(patch.settings || {}), ...(patch.tip ? { tips: { [patch.tip.key]: { until: clock + 28 * D, stops: 1 } } } : {}) } })) };
  let changes = 0;
  const rooms = createOrbRooms({ subs, pc, now: () => clock, setTimer: () => 0, clearTimer: () => {}, snapshot: () => snap, accept: v => { snap = v; }, changed: () => { changes++; } });
  const room = () => rooms.scene({ aside: 'settings', member }).settings;
  const line = key => room().rows.find(r => r.key === key);
  const live = key => line(key).more.find(x => x[0] === 'live')[1];
  const press = (key, act, arg = '', fields = {}) => rooms.handle({ room: 'settings', key, act, arg, fields });
  return { rooms, calls, offs, listeners, room, line, live, press, names: () => calls.map(c => c[0]), setUp: v => { up = v; }, setDesk: v => { desk = v; }, setDraft: v => { draft = v; }, get notices() { return notices; }, get snap() { return snap; }, advance: ms => { clock += ms; } };
}

test('the settings room reads its bridges when it opens, follows their notices while open, and stops listening when it closes (설계 6.4)', async () => {
  const h = setHarness();
  assert.equal(h.rooms.scene({ aside: null }), null);
  h.rooms.open('settings');
  await settle();
  assert.deepEqual(h.names().sort(), ['desktop.get', 'drafts.status', 'updates.status']);
  assert.equal(h.room().say, '이 PC의 SYNK는 최신 판입니다.');
  assert.deepEqual(h.room().rows.map(r => r.key), ['update', 'start', 'key', 'view', 'notice', 'draft']);
  h.listeners.updates({ state: 'available', currentVersion: '0.4.97', latestVersion: '0.4.98' });
  assert.equal(h.room().say, '새 판(v0.4.98)이 나왔습니다.');
  h.listeners.desktop({ ok: true, preferences: { closeToTray: false, launchAtLogin: true, startHidden: false, globalShortcut: '', zoomFactor: 1.5 }, capabilities: { launchAtLogin: true, globalShortcut: true, tray: true } });
  assert.deepEqual([h.room().then, h.line('view').mid], ['컴퓨터를 켜면 창과 함께 켜집니다.', '크기 150%'], 'a change made elsewhere (keyboard zoom, the tray) shows at once');
  h.setDraft({ ok: true, available: true, enabled: true });
  h.listeners.drafts();
  await settle();
  assert.equal(h.line('draft').val, '켜짐', 'a draft change notice reads the state again');
  h.rooms.close();
  assert.deepEqual(h.offs.sort(), ['desktop', 'drafts', 'updates']);
  assert.equal(h.rooms.scene({ aside: 'settings', member: true }).settings.say, '설정을 불러오고 있습니다.', 'closed, the room forgets what it read and says it is reading until the update state comes (화면 검수)');
});

test('pressing a start-up switch sends the flipped value; 트레이로 시작 is refused while 자동 시작 is off; a failure says so in the line', async () => {
  const h = setHarness({ answers: { 'desktop.update': patch => (patch.launchAtLogin === true ? { ok: false, code: 'STARTUP_UNAVAILABLE' } : { ok: true, preferences: { closeToTray: true, launchAtLogin: false, startHidden: false, globalShortcut: '', zoomFactor: 1, ...patch }, capabilities: { launchAtLogin: true, globalShortcut: true, tray: true } }) } });
  h.rooms.open('settings'); await settle();
  await h.press('start', 'pref', 'startHidden');
  assert.ok(!h.names().includes('desktop.update'), '트레이로 시작 waits for 자동 시작');
  await h.press('start', 'pref', 'closeToTray');
  assert.deepEqual(h.calls.find(c => c[0] === 'desktop.update')[1], { closeToTray: false });
  assert.equal(h.line('start').mid, '자동 시작 안 함 · 닫으면 끔');
  await h.press('start', 'pref', 'launchAtLogin');
  assert.equal(h.live('start'), '설정을 적용하지 못했습니다. 잠시 뒤 다시 해 주세요.');
  await h.press('start', 'pref', 'nope');
  assert.equal(h.calls.filter(c => c[0] === 'desktop.update').length, 2, 'an unknown field is not sent');
});

test('the anywhere shortcut is checked before it is sent, a taken one is named, and switching it off clears it (설계 검토 D9)', async () => {
  const h = setHarness({ answers: { 'desktop.update': patch => (patch.globalShortcut === 'Ctrl+Alt+K' ? { ok: false, code: 'SHORTCUT_UNAVAILABLE' } : { ok: true, preferences: { closeToTray: true, launchAtLogin: false, startHidden: false, zoomFactor: 1, globalShortcut: patch.globalShortcut }, capabilities: { launchAtLogin: true, globalShortcut: true, tray: true } }) } });
  h.rooms.open('settings'); await settle();
  await h.press('key', 'shortcut-apply', '', { shortcut: 'Shift+S' });
  assert.equal(h.live('key'), '단축키 모양을 알아보지 못했습니다. 예: Ctrl+Alt+S');
  await h.press('key', 'shortcut-apply', '', { shortcut: 'ctrl+alt+k' });
  assert.equal(h.live('key'), '다른 앱이 쓰는 단축키입니다. 다른 조합을 골라 주세요.');
  await h.press('key', 'shortcut-apply', '', { shortcut: 'Ctrl+Alt+S' });
  assert.deepEqual([h.calls.filter(c => c[0] === 'desktop.update').at(-1)[1], h.live('key'), h.line('key').val], [{ globalShortcut: 'Ctrl+Alt+S' }, '단축키를 바꿨습니다.', 'Ctrl+Alt+S']);
  await h.press('key', 'shortcut-apply', '', { shortcut: 'Ctrl+Alt+S' });
  assert.equal(h.live('key'), '지금 쓰는 단축키와 같습니다.');
  await h.press('key', 'shortcut-off');
  assert.deepEqual([h.calls.filter(c => c[0] === 'desktop.update').at(-1)[1], h.live('key')], [{ globalShortcut: '' }, '단축키를 껐습니다.']);
  await h.press('view', 'zoom', '1.25');
  await h.press('view', 'zoom', '3');
  assert.deepEqual(h.calls.filter(c => c[0] === 'desktop.update').slice(-1)[0][1], { zoomFactor: 1.25 }, 'only the listed sizes are sent');
});

test('updates follow the old rules: a check, a download, and an install that asks about unsaved writing first (설계 6.3)', async () => {
  const h = setHarness({ update: { state: 'available', currentVersion: '0.4.97', latestVersion: '0.4.98' } });
  h.rooms.open('settings'); await settle();
  await h.press('update', 'update-install');
  assert.ok(!h.names().includes('updates.install'), 'nothing to install before it is ready');
  await h.press('update', 'update-download');
  assert.deepEqual([h.names().includes('updates.download'), h.room().say], [true, '새 판을 받고 있습니다.']);
  await h.press('update', 'update-check');
  assert.ok(!h.names().includes('updates.check'), 'no check while downloading');
  h.listeners.updates({ state: 'ready', currentVersion: '0.4.97', latestVersion: '0.4.98' });
  await h.press('update', 'update-install');
  assert.deepEqual(h.names().filter(n => n === 'confirmInstall' || n === 'updates.install'), ['confirmInstall', 'updates.install']);
  assert.equal(h.room().say, '업데이트를 준비하고 있습니다.');
  const kept = setHarness({ update: { state: 'ready', latestVersion: '0.4.98' }, confirm: false });
  kept.rooms.open('settings'); await settle();
  await kept.press('update', 'update-install');
  assert.deepEqual(kept.names().filter(n => n === 'confirmInstall' || n === 'updates.install'), ['confirmInstall'], 'going back to save installs nothing');
  let release;
  const moved = setHarness({ update: { state: 'ready', latestVersion: '0.4.98' }, answers: { confirmInstall: () => new Promise(r => { release = r; }) } });
  moved.rooms.open('settings'); await settle();
  const pending = moved.press('update', 'update-install');
  await settle();
  moved.listeners.updates({ state: 'available', latestVersion: '0.4.99' });
  release(true);
  await pending;
  assert.ok(!moved.names().includes('updates.install'), 'a new state during the question cancels the install');
  // 묻는 사이 더 새 판(0.4.99)까지 받아 준비됐어도, 묻지 않은 판은 설치하지 않는다(화면 검수 E4)
  let release2;
  const newer = setHarness({ update: { state: 'ready', latestVersion: '0.4.98' }, answers: { confirmInstall: () => new Promise(r => { release2 = r; }) } });
  newer.rooms.open('settings'); await settle();
  const asking = newer.press('update', 'update-install');
  await settle();
  newer.listeners.updates({ state: 'ready', latestVersion: '0.4.99' });
  release2(true);
  await asking;
  assert.deepEqual(newer.names().filter(n => n === 'confirmInstall' || n === 'updates.install'), ['confirmInstall'], 'a newer ready version is not installed on the old answer');
  // 자동 업데이트 판은 본체가 설치한다. 방은 묻지도 설치하지도 않고, 설치 단추도 두지 않는다(화면 검수 E3)
  const auto = setHarness({ update: { state: 'ready', automatic: true, latestVersion: '0.4.98' } });
  auto.rooms.open('settings'); await settle();
  await auto.press('update', 'update-install');
  assert.deepEqual(auto.names().filter(n => n === 'confirmInstall' || n === 'updates.install'), [], 'an automatic install is the main process’s job');
  assert.ok(!auto.line('update').more.some(x => x[0] === 'acts' && x[1].some(a => a[1] === 'update-install')), 'and there is no install button');
  const failed = setHarness({ answers: { 'updates.check': () => ({ ok: false, code: 'UPDATE_NETWORK_FAILED' }) } });
  failed.rooms.open('settings'); await settle();
  await failed.press('update', 'update-check');
  assert.equal(failed.room().say, '새 판을 받지 못했습니다.');
});

test('notices go through the convenience channel: banner and quiet switches, quiet hours, and a rest that says until when (설계 6.4)', async () => {
  const h = setHarness();
  h.rooms.open('settings'); await settle();
  await h.press('notice', 'notice', 'banners');
  assert.deepEqual(h.calls.filter(c => c[0] === 'notices.set').at(-1)[1], { banners: false });
  // 조용한 시간 스위치도 같은 통로로 켜고 끈다(화면 검수 E8)
  const quiet = () => h.line('notice').more.find(x => x[0] === 'tog' && x[6] === 'schedule')[3];
  await h.press('notice', 'notice', 'schedule');
  assert.deepEqual([h.calls.filter(c => c[0] === 'notices.set').at(-1)[1], quiet()], [{ schedule: true }, true]);
  await h.press('notice', 'notice', 'schedule');
  assert.deepEqual([h.calls.filter(c => c[0] === 'notices.set').at(-1)[1], quiet()], [{ schedule: false }, false]);
  await h.press('notice', 'grp', 'quiet');
  await h.press('notice', 'quiet-save', '', { quietStart: '7시', quietEnd: '08:00' });
  assert.equal(h.live('notice'), '시각은 22:00처럼 넣어 주세요.');
  await h.press('notice', 'quiet-save', '', { quietStart: '23:30', quietEnd: '7:00', quietDays: 'weekdays' });
  assert.deepEqual(h.calls.filter(c => c[0] === 'notices.set').at(-1)[1], { start: '23:30', end: '07:00', weekdays: true });
  assert.equal(h.live('notice'), '저장했습니다. 조용한 시간을 켜면 이 시각에 배너를 띄우지 않습니다.');
  assert.equal(h.line('notice').more.find(x => x[0] === 'grp')[3], true, 'saving folds the fields');
  assert.deepEqual(h.room().focus.act, 'grp', 'and focus goes back to 「시각 고치기」');
  await h.press('notice', 'rest', '30');
  assert.deepEqual([h.notices.mutedUntil, h.live('notice'), h.line('notice').mid], [NOW + 30 * 60e3, '10:30까지 배너를 띄우지 않습니다.', '10:30까지 배너를 띄우지 않습니다']);
  assert.equal(h.line('notice').more.find(x => x[1] === '잠시 쉬기')[3], '30');
  await h.press('notice', 'rest', '0');
  assert.deepEqual([h.notices.mutedUntil, h.live('notice')], [0, '배너를 다시 띄웁니다.']);
  await h.press('notice', 'rest', 'toString');
  assert.equal(h.calls.filter(c => c[0] === 'notices.set').length, 6, 'an unknown rest is not saved');
});

test('the tip switch saves settings.tipsOff like the old board, and a member’s draft switch goes through the bridge (설계 검토 D7)', async () => {
  const h = setHarness();
  h.rooms.open('settings'); await settle();
  assert.equal(h.line('notice').more.find(x => x[0] === 'tog' && x[4] === 'tips')[3], true, 'the room is drawn before anything is pressed');
  await h.press('notice', 'tips');
  assert.deepEqual(h.calls.find(c => c[0] === 'save')[1], { settings: { tipsOff: true } });
  assert.equal(h.live('notice'), '구독 팁을 껐습니다. 구독 줄과 요금 줄에 팁을 띄우지 않습니다.');
  assert.equal(h.rooms.subTips().size, 0, 'and the subscription rows lose their tips');
  await h.press('notice', 'tips');
  assert.deepEqual([h.calls.filter(c => c[0] === 'save').at(-1)[1], h.live('notice')], [{ settings: { tipsOff: false } }, '구독 팁을 켰습니다.']);
  await h.press('draft', 'draft');
  assert.deepEqual([h.calls.find(c => c[0] === 'drafts.set')[1], h.line('draft').val], [true, '켜짐']);
  const fail = setHarness({ answers: { 'drafts.set': () => ({ ok: false }) } });
  fail.rooms.open('settings'); await settle(); fail.room();
  await fail.press('draft', 'draft');
  assert.equal(fail.live('draft'), '쓰던 글 되살리기를 바꾸지 못했습니다. 로그인 상태와 PC 저장 공간을 봐 주세요.');
  const guest = setHarness({ member: false });
  guest.rooms.open('settings'); await settle(); guest.room();
  await guest.press('draft', 'draft');
  await guest.press('notice', 'tips');
  assert.ok(!guest.names().includes('drafts.set') && !guest.names().includes('save'), 'a guest’s locked switches send nothing, even with encrypted storage on this PC');
  assert.ok(!guest.line('notice').more.some(x => x[0] === 'tog' && x[4] === 'tips'), 'a guest has no tip switch');
});

test('the problem report copies through the bridge and the bottom line says what was copied, or that it failed', async () => {
  const h = setHarness();
  h.rooms.open('settings'); await settle();
  assert.equal(h.room().foot, 'SYNK Platform 0.4.97 · 시험판 · Windows');
  await h.press('', 'diag-copy');
  assert.equal(h.room().foot, '버전과 연결 상태만 복사했습니다. 이름, 글, 파일 경로는 넣지 않았습니다.');
  const fail = setHarness({ answers: { copyDiagnostics: () => false } });
  fail.rooms.open('settings'); await settle();
  await fail.press('', 'diag-copy');
  assert.equal(fail.room().foot, '복사하지 못했습니다. 앱 창을 한 번 누른 뒤 다시 해 주세요.');
  h.rooms.close(); h.rooms.open('settings');
  assert.equal(h.room().foot, 'SYNK Platform 0.4.97 · 시험판 · Windows', 'the note goes when the room closes');
});

test('a tip reaction in a subscription row saves like the old board and keeps the tip with the line after it', async () => {
  const h = setHarness();
  const tip = h.rooms.subTips().get('claude');
  assert.equal(tip.key, 'pass:claude');
  await h.rooms.handle({ room: 'solio', key: 'svc:claude', act: 'tip', arg: 'pass:claude|stop' });
  assert.deepEqual(h.calls.find(c => c[0] === 'save')[1], { tip: { key: 'pass:claude', action: 'stop' } });
  const after = h.rooms.subTips().get('claude');
  assert.deepEqual([after.done, after.live], [true, '이 종류의 팁은 4주 동안 쉽니다.']);
  h.rooms.open('settings'); h.rooms.close();
  assert.equal(h.rooms.subTips().get('claude').live, '이 종류의 팁은 4주 동안 쉽니다.', 'opening and closing a room keeps the line of the subscription row');
  h.rooms.reset();
  assert.equal(h.rooms.subTips().size, 0, 'another account forgets the answer, so the resting tip is gone');
});

/* ── 2단계 둘째 조각 화면 검수 B의 고침 ── */
test('a Typecast key put in 「계정 더하기」 adds a new account even after 「다시 로그인」 was pressed on another Typecast line', async () => {
  const h = harness();
  await h.press('a:t', 'relogin');
  await h.press('add', 'add-pick', 'typecast');
  await h.press('add', 'key', 'typecast', { key: 'tc-new' });
  assert.deepEqual(h.calls.at(-1), ['connectKey', 'typecast', 'tc-new', {}], 'no replace from the earlier relogin');
  await h.press('a:t', 'key', 'typecast', { key: 'tc-old' });
  assert.deepEqual(h.calls.at(-1), ['connectKey', 'typecast', 'tc-old', { replace: 't' }], 'a key put in a line replaces that line');
});

test('a reset while live counting is on does not let the old account refill the token line', async () => {
  const h = tokHarness({ state: { ok: true, enabled: true, epoch: 1, seq: 1, scannedAt: NOW - 60e3, cells: [] } });
  h.rooms.tokLoad(); await settle();
  await h.press('row-open'); h.rooms.syncLive(true); await settle();
  const fresh = tokHarness().rooms.tokRow();
  h.rooms.reset(); await settle();
  assert.equal(h.names().filter(n => n === 'tokensLive').length, 2, 'the live request is still dropped');
  assert.deepEqual(h.rooms.tokRow(), fresh, 'the line is back to the state before any read');
});

test('a pass used just before the account changes does not accept the old account’s reread', async () => {
  let release;
  const h = harness({ rows: [weekly('c', 'claude', { passCount: 2, passUntil: NOW + 3 * D })], answers: { check: () => new Promise(r => { release = r; }) } });
  const pressing = h.press('a:c', 'pass-used');
  await tick(); await tick();
  const before = h.accepted;
  h.rooms.reset();
  release({ ...h.snap, seq: 99 });
  await pressing;
  assert.equal(h.accepted, before);
});

test('signing out everywhere while the account is being read again says to wait instead of asking (검수 B)', async () => {
  let release = null;
  const h = accHarness({ answers: { accountView: () => (release ? new Promise(r => { const go = release; release = null; go(r); }) : accView()) } });
  h.rooms.open('account'); await settle();
  h.rooms.close();
  let finish;
  release = r => { finish = r; };
  h.rooms.open('account'); await tick();
  await h.press('places', 'revoke-all');
  assert.equal(h.live('places'), ROOM_BUSY_SAY);
  assert.equal(h.rooms.armed(), null, 'no question while it cannot be sent');
  finish(accView()); await settle();
  await h.press('places', 'revoke-all'); h.advance(700); await h.press('places', 'revoke-all'); await settle();
  assert.ok(h.ops().includes('revokeAll'));
});

test('the unsaved-writing check holds the room busy, so nothing else starts while it is open', async () => {
  let release;
  const h = accHarness({ leave: new Promise(r => { release = r; }) });
  h.rooms.open('account'); await settle();
  await h.press('places', 'revoke-all'); h.advance(700);
  const going = h.press('places', 'revoke-all');
  await tick();
  await h.press('name', 'name-save', '', { name: '새 이름' });
  assert.ok(!h.ops().includes('updateProfile'), 'the name is not saved while the check is open');
  release(true);
  await going; await settle();
  assert.ok(h.ops().includes('revokeAll'));
});

test('an account change during the draft switch keeps the old failure out of the new settings room', async () => {
  let release;
  const h = setHarness({ answers: { 'drafts.set': () => new Promise(r => { release = r; }) } });
  h.rooms.open('settings'); await settle();
  h.rooms.scene({ aside: 'settings', member: true });
  const pressing = h.press('draft', 'draft');
  await tick();
  h.rooms.accountChanged();
  release({ ok: false });
  await pressing; await settle();
  assert.equal(h.live('draft'), '');
});

test('an account change takes the PLEASURE notice word away and keeps the banner word', async () => {
  // 카본 검수 C1: 계정이 바뀐 뒤에도 앞 계정의 플레저 PC 알림 말이 알림 줄에 남았다
  const care = { ok: true, available: true, signedIn: true, enabled: false };
  const h = setHarness({ care, answers: { 'care.configure': ({ enabled }) => ({ ...care, enabled }) } });
  h.rooms.open('settings'); await settle();
  h.rooms.scene({ aside: 'settings', member: true });
  await h.press('notice', 'care'); await settle();
  assert.equal(h.live('notice'), '플레저 PC 알림을 켰습니다.');
  h.rooms.accountChanged(); await settle();
  assert.equal(h.live('notice'), '', 'the old account’s word is gone');
  await h.press('notice', 'notice', 'banners'); await settle();
  const banner = h.live('notice');
  h.rooms.accountChanged(); await settle();
  assert.equal(h.live('notice'), banner, 'a PC setting word stays');
});

test('a login that ends while another room is open does not write into that room’s foot', () => {
  const h = harness();
  h.rooms.observe({ ...h.snap, login: { id: 'l9', service: 'gpt', stage: 'browser' } });
  h.rooms.open('settings');
  h.rooms.observe({ ...h.snap, login: { id: 'l9', service: 'gpt', stage: 'done' } });
  h.rooms.open('manage');
  assert.equal(h.room().foot, '로그인 정보와 사용량은 이 PC 밖으로 나가지 않습니다.');
});

/* ── 2단계 둘째 조각 최종 검수의 고침 ── */
test('a press refused because another job is out says so in its own line, but not in the line whose own job is out', async () => {
  let release;
  const h = harness({ rows: [weekly('c', 'claude', { state: 'error' }), weekly('g', 'gpt')], answers: { check: () => new Promise(r => { release = r; }) } });
  const first = h.press('a:c', 'reread-one');
  await h.press('a:g', 'grp', 'cost');
  await h.press('a:g', 'save-cost', '', { price: '1' });
  assert.ok(!h.calls.some(c => c[0] === 'save'), 'nothing is sent while another job is out');
  assert.equal(h.live('a:g'), ROOM_BUSY_SAY);
  await h.press('a:c', 'reread-one');
  assert.notEqual(h.live('a:c'), ROOM_BUSY_SAY, 'the line whose own job is out stays quiet');
  release({ ...h.snap, seq: 9 });
  await first;
});

test('the settings room says it is reading until the update state comes, then says the state', async () => {
  let release;
  const h = setHarness({ answers: { 'updates.status': () => new Promise(r => { release = r; }) } });
  h.rooms.open('settings'); await tick();
  assert.equal(h.room().say, '설정을 불러오고 있습니다.');
  assert.ok(!h.room().rows.some(r => r.key === 'update'), 'no update line claims anything yet');
  release({ state: 'current', currentVersion: '0.4.97' }); await settle();
  assert.equal(h.room().say, '이 PC의 SYNK는 최신 판입니다.');
});

test('coming back to 내 계정 from the old screen reads the account again quietly', async () => {
  const h = accHarness();
  h.rooms.open('account'); await settle();
  const reads = h.ops().filter(o => o === 'accountView').length;
  h.rooms.reloadAccount(); await settle();
  assert.equal(h.ops().filter(o => o === 'accountView').length, reads + 1);
  assert.ok(h.room().rows.length > 0, 'the shown account stays while it reads');
  h.rooms.close(); h.rooms.reloadAccount(); await settle();
  assert.equal(h.ops().filter(o => o === 'accountView').length, reads + 1, 'nothing is read when the room is not open');
});

/* ── 다시 검수(FA1 · FA3)의 고침 ── */
test('a Typecast key put in 「계정 더하기」 while another line’s browser login runs keeps that line’s login steps', async () => {
  const h = harness();
  await h.press('a:c', 'relogin');
  h.setSnap(s => ({ ...s, login: { id: 'l1', service: 'claude', stage: 'browser', url: 'https://example.com/a' } }));
  h.rooms.observe(h.snap);
  await h.press('add', 'add-pick', 'typecast');
  await h.press('add', 'key', 'typecast', { key: 'tc-new' });
  assert.ok(h.line('a:c').more.some(x => x[0] === 'row' && x[1] === '로그인'), 'the Claude line still shows its login steps');
  h.setSnap(s => ({ ...s, login: { ...s.login, stage: 'done' } }));
  h.rooms.observe(h.snap);
  assert.equal(h.live('a:c'), '다시 연결했습니다. 바로 한 번 읽습니다.', 'the finished login is told in the line that started it');
});

test('a late draft answer from the account before does not lift the new account’s draft request', async () => {
  const pending = [];
  const h = setHarness({ answers: { 'drafts.set': () => new Promise(r => { pending.push(r); }) } });
  h.rooms.open('settings'); await settle();
  h.rooms.scene({ aside: 'settings', member: true });
  const first = h.press('draft', 'draft'); await tick();
  h.rooms.accountChanged(); await settle();
  h.rooms.scene({ aside: 'settings', member: true });
  const second = h.press('draft', 'draft'); await tick();
  pending[0]({ ok: true, available: true, enabled: true }); await first; await settle();
  await h.press('notice', 'quiet-save', '', { start: '23:00', end: '07:00' });
  assert.ok(h.rooms.scene({ aside: 'settings', member: true }).settings.rows.find(r => r.key === 'draft').more.some(x => x[0] === 'tog' && String(x[5] || '').includes('off')), 'the new request still holds its switch');
  pending.at(-1)?.({ ok: true, available: true, enabled: true }); await second;
});
