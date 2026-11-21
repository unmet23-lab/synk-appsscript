'use strict';
// 솔리오 「사무실」을 볼 계정 도구(tools/사무실/보는계정.js). 임시 폴더를 SYNK_OFFICE_VIEWERS로 넘겨 돌린다. node --test tests/사무실_보는계정.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { defaultViewersFile } = require('../desktop/src/office.cjs');

const 도구 = path.join(__dirname, '..', 'tools', '사무실', '보는계정.js');
const 유호 = { synk_user_id: 'owner-1234567890', display_name: '유호', asked_at: '2026-11-20T01:00:00.000Z' };
const 시연 = { synk_user_id: 'demo-12345678901', display_name: '유호(시연)', asked_at: '2026-11-20T01:05:00.000Z' };

function 자리() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '사무실-보는계정-'));
  const 목록자리 = path.join(d, 'viewers.json'), 물음자리 = path.join(d, 'viewer-pending.json');
  return {
    목록자리, 물음자리,
    물음: (asked) => fs.writeFileSync(물음자리, JSON.stringify({ asked })),
    목록: () => JSON.parse(fs.readFileSync(목록자리, 'utf8')),
    부르기: (...args) => {
      const r = spawnSync(process.execPath, [도구, ...args], { encoding: 'utf8', env: { ...process.env, SYNK_OFFICE_VIEWERS: 목록자리 } });
      return { code: r.status, out: r.stdout, err: r.stderr };
    },
  };
}

test('보는계정 — PC 앱과 같은 자리를 쓴다(SYNK_OFFICE_VIEWERS가 이기고, 대기 파일은 같은 폴더)', () => {
  assert.equal(defaultViewersFile({ SYNK_OFFICE_VIEWERS: 'X:\\시험\\viewers.json', LOCALAPPDATA: 'C:\\L' }, 'win32'), 'X:\\시험\\viewers.json');
  const s = 자리();
  s.물음([유호]);
  const r = s.부르기();
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /사무실을 볼 수 있는 계정: 없음/);
  assert.match(r.out, /2026-11-20T01:00:00\.000Z · 이름 「유호」 · 번호 owner-1234567890/, '물은 줄의 번호 · 이름 · 시각을 보인다');
  assert.match(r.out, /유호님께 이름과 시각을 보여/, '주인에게 확인하라는 말이 있다');
  assert.ok(!fs.existsSync(s.목록자리), '번호 없이 부르면 보기만 한다');
  assert.ok(fs.existsSync(s.물음자리));
});

test('보는계정 --받기 — 본 줄의 번호로만 받고, 있던 계정은 그대로 둔다. 다른 계정의 대기 줄은 지우지 않는다', () => {
  const s = 자리();
  s.물음([유호, 시연]);
  assert.equal(s.부르기('--받기', 'someone-else-123').code, 1, '목록에 없는 번호는 받지 않는다');
  assert.equal(s.부르기('--받기', '../owner').code, 1, '번호 꼴이 아니면 받지 않는다');
  assert.equal(s.부르기('--받기').code, 1, '번호 없는 --받기');
  assert.ok(!fs.existsSync(s.목록자리));
  const r = s.부르기('--받기', 유호.synk_user_id);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /옮겼다 — 「유호」\(owner-…\)/);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id], '본 줄의 계정만 들어간다');
  assert.ok(fs.existsSync(s.물음자리), '옛 한 파일과 다른 계정(시연)의 대기 줄은 그대로 둔다(11-21)');
  assert.deepEqual(fs.readdirSync(path.dirname(s.목록자리)).sort(), ['viewer-pending.json', 'viewers.json'], '임시 파일과 잠금이 남지 않는다');

  s.물음([시연]);
  assert.equal(s.부르기('--받기', 시연.synk_user_id).code, 0);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id, 시연.synk_user_id], '있던 계정은 그대로 두고 더한다');
  const 지금 = s.부르기();
  assert.equal(지금.code, 0);
  assert.match(지금.out, /사무실을 볼 수 있는 계정: owner-…, demo-1…/, '인자 없이 부르면 지금 볼 계정을 보인다');
  assert.match(지금.out, /물은 계정이 없다/);
  assert.equal(s.부르기('--받기', 유호.synk_user_id).code, 1, '대기 줄이 없으면 받을 것도 없다');
});

test('보는계정 — 깨진 viewers.json은 덮지 않고 멈춘다. 명령은 목록 보기와 --받기 둘뿐이다', () => {
  const s = 자리();
  fs.writeFileSync(s.목록자리, '{ broken');
  s.물음([시연]);
  const r = s.부르기('--받기', 시연.synk_user_id);
  assert.equal(r.code, 1);
  assert.match(r.err, /덮어쓰지 않고 멈춘다/);
  assert.equal(fs.readFileSync(s.목록자리, 'utf8'), '{ broken');
  fs.writeFileSync(s.목록자리, JSON.stringify({ synk_user_ids: ['bad id!'] }));
  assert.equal(s.부르기().code, 1, '꼴이 다른 번호가 있어도 멈춘다');
  for (const 옛명령 of ['--버리기', '--잠금풀기', '--모르는값']) assert.equal(s.부르기(옛명령).code, 1, `${옛명령}: 쓰는 법을 보인다`);
  assert.ok(fs.existsSync(s.물음자리), '없앤 명령은 아무것도 지우지 않는다');
  assert.equal(s.부르기('--받기', 유호.synk_user_id, '--받기', 시연.synk_user_id).code, 1, '--받기는 한 번만');
});

test('보는계정 — 받기는 잠금 하나로 차례를 지키고, 남은 잠금은 치우지 않고 손으로 지우라고 알린다(GPT 검수 GB5 · be3 GA8 · be5 GB1)', () => {
  const s = 자리();
  const 잠금자리 = s.목록자리 + '.lock';
  s.물음([유호, 시연]);
  fs.writeFileSync(잠금자리, '1');
  const r = s.부르기('--받기', 유호.synk_user_id);
  assert.equal(r.code, 1);
  assert.match(r.err, /다른 받기가 viewers\.json을 고치는 중이거나 멈춘 받기가 잠금을 남겼다/);
  assert.match(r.err, /그 파일을 지운 뒤 다시 부른다/);
  assert.ok(!fs.existsSync(s.목록자리), '잠겨 있으면 쓰지 않는다');
  assert.ok(fs.existsSync(잠금자리), '남의 잠금은 그대로 둔다');
  const 보기만 = s.부르기();
  assert.equal(보기만.code, 0, '보기만 하는 부름은 잠금을 쓰지 않는다');
  assert.match(보기만.err, /잠금이 있다/, '보기만 해도 남은 잠금을 알린다');
  const 옛때 = new Date(Date.now() - 5 * 60e3);
  fs.utimesSync(잠금자리, 옛때, 옛때);
  assert.equal(s.부르기('--받기', 유호.synk_user_id).code, 1, '오래된 잠금도 저절로 치우지 않는다');
  assert.ok(fs.existsSync(잠금자리));
  fs.rmSync(잠금자리); // 사람이 다른 받기가 없는 것을 보고 지운다
  const 다시 = s.부르기('--받기', 유호.synk_user_id);
  assert.equal(다시.code, 0, 다시.err);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id]);
  assert.ok(!fs.existsSync(잠금자리), '받기가 끝나면 잠금을 푼다');
  // 이어서 다른 받기: 앞 받기를 덮지 않고 더한다
  s.물음([시연]);
  assert.equal(s.부르기('--받기', 시연.synk_user_id).code, 0);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id, 시연.synk_user_id]);
});

test('보는계정 — 계정마다의 대기 파일과 옛 한 파일을 함께 읽고, 받으면 받은 계정의 대기 파일 하나만 지운다', () => {
  const s = 자리();
  const 폴더 = path.join(path.dirname(s.목록자리), 'viewer-pending');
  fs.mkdirSync(폴더, { recursive: true });
  fs.writeFileSync(path.join(폴더, 시연.synk_user_id + '.json'), JSON.stringify(시연));
  fs.writeFileSync(path.join(폴더, 'bad-name.json'), JSON.stringify(유호)); // 파일 이름과 번호가 다르면 버린다
  s.물음([유호]);
  const r = s.부르기();
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /번호 owner-1234567890/);
  assert.match(r.out, /번호 demo-12345678901/);
  assert.equal(r.out.match(/번호 owner-1234567890/g).length, 1, '같은 계정은 한 줄');
  assert.equal(s.부르기('--받기', 시연.synk_user_id).code, 0);
  assert.deepEqual(s.목록().synk_user_ids, [시연.synk_user_id]);
  assert.deepEqual(fs.readdirSync(폴더), ['bad-name.json'], '받은 계정의 파일만 지웠다');
  assert.ok(fs.existsSync(s.물음자리), '옛 한 파일의 다른 계정 줄은 그대로다');
  assert.doesNotMatch(s.부르기().out, /번호 demo-12345678901/, '받은 계정은 목록에 다시 보이지 않는다');
});

test('be6 GA1: granting an account asked only in the old single pending file removes its line there; the other lines stay, and an emptied file goes', () => {
  const s = 자리();
  s.물음([유호, 시연]);
  assert.equal(s.부르기('--받기', 유호.synk_user_id).code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(s.물음자리, 'utf8')).asked.map(x => x.synk_user_id), [시연.synk_user_id], 'only the granted line is gone');
  assert.equal(s.부르기('--받기', 시연.synk_user_id).code, 0);
  assert.equal(fs.existsSync(s.물음자리), false, 'the emptied old file is removed');
  // 줄 하나만 적던 더 옛 꼴
  fs.writeFileSync(s.목록자리, JSON.stringify({ synk_user_ids: [] }));
  fs.writeFileSync(s.물음자리, JSON.stringify(유호));
  assert.equal(s.부르기('--받기', 유호.synk_user_id).code, 0);
  assert.equal(fs.existsSync(s.물음자리), false);
});

/* ── GPT 검수 solio-office-be4 · be5 묶음 B ── 같은 프로세스에서 부르고 fs 한 곳을 잠깐 바꾼다 */
const { 보는계정 } = require('../tools/사무실/보는계정.js');
function 안에서(목록자리, 옵션, 바꿈 = {}) {
  const 옛 = {}, 말 = { out: '', err: '' };
  for (const [k, fn] of Object.entries(바꿈)) { 옛[k] = fs[k]; fs[k] = fn(옛[k]); }
  const log = console.log, error = console.error;
  console.log = (...a) => { 말.out += a.join(' ') + '\n'; };
  console.error = (...a) => { 말.err += a.join(' ') + '\n'; };
  try { return { code: 보는계정(옵션, 목록자리), ...말 }; } finally { console.log = log; console.error = error; for (const k of Object.keys(옛)) fs[k] = 옛[k]; }
}
const 대기폴더 = s => path.join(path.dirname(s.목록자리), 'viewer-pending');
const 대기두기 = (s, ...xs) => { fs.mkdirSync(대기폴더(s), { recursive: true }); for (const x of xs) fs.writeFileSync(path.join(대기폴더(s), x.synk_user_id + '.json'), JSON.stringify(x)); };

test('be4 GB1: a viewers list named viewers.lock is never taken for the lock; a list named like the pending file is refused', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '사무실-보는계정-'));
  const 목록자리 = path.join(d, 'viewers.lock');
  fs.writeFileSync(목록자리, JSON.stringify({ synk_user_ids: [유호.synk_user_id] }));
  fs.mkdirSync(path.join(d, 'viewer-pending'));
  fs.writeFileSync(path.join(d, 'viewer-pending', 시연.synk_user_id + '.json'), JSON.stringify(시연));
  const 부름 = (...args) => spawnSync(process.execPath, [도구, ...args], { encoding: 'utf8', env: { ...process.env, SYNK_OFFICE_VIEWERS: 목록자리 } });
  const 받기 = 부름('--받기', 시연.synk_user_id);
  assert.equal(받기.status, 0, 받기.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(목록자리, 'utf8')).synk_user_ids, [유호.synk_user_id, 시연.synk_user_id]);
  const 겹침 = spawnSync(process.execPath, [도구, '--받기', 시연.synk_user_id], { encoding: 'utf8', env: { ...process.env, SYNK_OFFICE_VIEWERS: path.join(d, 'viewer-pending.json') } });
  assert.equal(겹침.status, 1);
  assert.match(겹침.stderr, /대기 파일의 이름과 겹친다/);
});

test('be5 GB3: granting removes only the granted account\'s own pending file; a settings.json or another account\'s file in that folder stays', () => {
  const s = 자리();
  대기두기(s, 유호, 시연);
  fs.writeFileSync(path.join(대기폴더(s), 'settings.json'), '{"keep":true}');
  const r = 안에서(s.목록자리, { 받기: 유호.synk_user_id });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(fs.readdirSync(대기폴더(s)).sort(), [시연.synk_user_id + '.json', 'settings.json'].sort());
  // 받은 계정의 이름이지만 안의 번호가 다른 파일은 지우지 않는다
  fs.writeFileSync(path.join(대기폴더(s), 시연.synk_user_id + '.json'), JSON.stringify({ ...유호 }));
  fs.writeFileSync(s.목록자리, JSON.stringify({ synk_user_ids: [] }));
  s.물음([시연]);
  assert.equal(안에서(s.목록자리, { 받기: 시연.synk_user_id }).code, 0);
  assert.ok(fs.existsSync(path.join(대기폴더(s), 시연.synk_user_id + '.json')), 'a file whose content is another account is kept');
});

test('be4 GB3: a pending file that cannot be removed after granting leaves the grant done (exit 0) and says so', () => {
  const s = 자리();
  대기두기(s, 유호);
  const busy = 옛 => (p, ...a) => { if (String(p).endsWith(유호.synk_user_id + '.json')) { const e = new Error('busy'); e.code = 'EBUSY'; throw e; } return 옛(p, ...a); };
  const r = 안에서(s.목록자리, { 받기: 유호.synk_user_id }, { rmSync: busy });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id], 'granted');
  assert.match(r.err, /받은 계정의 대기 줄을 지우지 못했다/);
  assert.doesNotMatch(s.부르기().out, /번호 owner-1234567890/, 'the granted account is not listed again');
});

test('be4 GB4: a lock that was made but could not be written is removed, so the next grant is not blocked', () => {
  const s = 자리();
  대기두기(s, 유호);
  const 잠금자리 = s.목록자리 + '.lock';
  let once = true;
  const full = 옛 => (fd, ...a) => { if (once) { once = false; const e = new Error('no space'); e.code = 'ENOSPC'; throw e; } return 옛(fd, ...a); };
  const r = 안에서(s.목록자리, { 받기: 유호.synk_user_id }, { writeSync: full });
  assert.equal(r.code, 1);
  assert.match(r.err, /잠금을 만들지 못했다\(ENOSPC\)/);
  assert.equal(fs.existsSync(잠금자리), false, 'no lock is left');
  assert.equal(fs.existsSync(s.목록자리), false, 'nothing was granted');
  assert.equal(s.부르기('--받기', 유호.synk_user_id).code, 0, 'the next grant goes through');
});

test('be5 GB5: a lock that cannot be removed after the grant does not turn the grant into a failure; it says which file to remove', () => {
  const s = 자리();
  대기두기(s, 유호);
  const 잠금자리 = s.목록자리 + '.lock';
  const stuck = 옛 => (p, ...a) => { if (path.resolve(String(p)) === path.resolve(잠금자리)) { const e = new Error('busy'); e.code = 'EBUSY'; throw e; } return 옛(p, ...a); };
  const r = 안에서(s.목록자리, { 받기: 유호.synk_user_id }, { rmSync: stuck });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id]);
  assert.match(r.err, /잠금을 지우지 못했다\(EBUSY\)/);
  assert.ok(r.err.includes(잠금자리));
});

test('be4 GB5 · be5 GB6: a pending folder or a pending file that cannot be read is reported, not taken as nobody asking', () => {
  const s = 자리();
  대기두기(s, 유호, 시연);
  const denied = 옛 => (p, ...a) => { if (path.resolve(String(p)) === path.resolve(대기폴더(s))) { const e = new Error('denied'); e.code = 'EACCES'; throw e; } return 옛(p, ...a); };
  const 보기 = 안에서(s.목록자리, {}, { readdirSync: denied });
  assert.equal(보기.code, 1);
  assert.match(보기.err, /대기 폴더를 읽지 못했다\(EACCES\)/);
  assert.doesNotMatch(보기.out, /물은 계정이 없다/);
  const 받기 = 안에서(s.목록자리, { 받기: 유호.synk_user_id }, { readdirSync: denied });
  assert.equal(받기.code, 1);
  assert.equal(fs.existsSync(s.목록자리), false);
  // 파일 하나만 읽지 못한다
  const one = 옛 => (p, ...a) => { if (String(p).endsWith(시연.synk_user_id + '.json')) { const e = new Error('denied'); e.code = 'EACCES'; throw e; } return 옛(p, ...a); };
  const 하나 = 안에서(s.목록자리, {}, { readFileSync: one });
  assert.equal(하나.code, 1);
  assert.match(하나.err, /대기 파일 1개를 읽지 못했다/);
  assert.match(하나.out, /번호 owner-1234567890/, 'the readable one is still listed');
});

test('보는계정 — 이미 받은 계정은 대기 목록에 다시 보이지 않는다(GPT 검수 GB6)', () => {
  const s = 자리();
  fs.writeFileSync(s.목록자리, JSON.stringify({ synk_user_ids: [유호.synk_user_id] }));
  s.물음([유호, 시연]); // 앱이 받기 직전에 쓰기 시작한 대기 줄이 받은 뒤에 남은 꼴
  const r = s.부르기();
  assert.equal(r.code, 0, r.err);
  assert.doesNotMatch(r.out, /번호 owner-1234567890/, '받은 계정은 묻지 않는다');
  assert.match(r.out, /번호 demo-12345678901/);
  assert.equal(s.부르기('--받기', 유호.synk_user_id).code, 1, '목록에 없는 번호다');
});
