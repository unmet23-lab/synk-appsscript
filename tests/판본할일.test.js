'use strict';
// 판본 할 일(tools/판본할일.js) — 돌림표 미리 보기에서 「판본이 없어 비는 이야기 칸」을 채울 (원본, 키)를 줄 세우는 셈.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 할일, 갈래, 한국시각, 원본읽기 } = require('../tools/판본할일.js');

const TOOL = path.join(__dirname, '..', 'tools', '판본할일.js');
const 못듦 = (key, n) => `안 받은 이야기 원본 ${n}편이 아직 못 나간다 — ${key} 판본이 아직 못 듦 ${n}편(판본 없음 · 뜻 검수 전)`;
const 첫판 = '첫 판 확인 전 — 건 첫 판을 예약 목록에서 확인하고 postRouteVerified를 true로 바꾸면 다음 칸을 받는다';
const 다올림 = '이 계정이 이야기 원본을 다 올림';
const cell = (account, time, why, more = {}) => ({ account, day: time.slice(0, 10), slot: '13:00', format: '이야기', time, original: null, why, ...more });

const 원장 = {
  accounts: {
    'lab-br-youtube': { countryCode: 'BR', language: 'pt-BR' },
    'lab-my-youtube': { countryCode: 'MY', language: 'ms' },
    'lab-kg-youtube': { countryCode: 'KG', language: 'ky' },
    'lab-au-youtube': { countryCode: 'AU', language: 'en-AU' },
    'lab-youtube': { rotationVersion: 'EN', language: 'en' },
    'lab-br-tiktok': { countryCode: 'BR', language: 'pt-BR' },
    'lab-instagram': { countryCode: 'MN', language: 'mn', rotationSeed: true },
    'lab-xx-youtube': { language: 'xx' },
  },
};
const 원본들 = new Map([
  ['LAB_가_mn_20261031', { 형식: '이야기', 쓸날: '2026-11-11', 멈춤: false, 예비: false }],
  ['LAB_나_mn_20261101', { 형식: '이야기', 쓸날: '2026-11-12', 멈춤: false, 예비: false }],
  ['LAB_다_mn_20261102', { 형식: '이야기', 쓸날: '2026-11-14', 멈춤: false, 예비: false }],
  ['LAB_노래_라_20261111', { 형식: '노래', 쓸날: '2026-12-31', 멈춤: false, 예비: false }],
  ['LAB_멈춘_mn_20261103', { 형식: '이야기', 쓸날: '2026-11-12', 멈춤: true, 예비: false }],
  ['LAB_예비_mn_20261104', { 형식: '이야기', 쓸날: '2026-11-12', 멈춤: false, 예비: true }],
  ['LAB_미정_mn_20261105', { 형식: '이야기', 쓸날: '미정', 멈춤: false, 예비: false }],
]);
const versions = {
  'LAB_가_mn_20261031': { BR: { ready: true, why: null }, MY: { ready: true, why: null }, KG: { ready: true, why: null }, AU: { ready: true, why: null } },
  'LAB_나_mn_20261101': { BR: { ready: false, why: '뜻 검수 전' }, MY: { ready: false, why: '뜻 검수 전' }, KG: { ready: false, why: '뜻 검수 전' }, AU: { ready: true, why: null } },
  'LAB_다_mn_20261102': { AU: { ready: true, why: null } },
  'LAB_노래_라_20261111': { BR: { ready: false, why: '뜻 검수 전' } },
  'LAB_멈춘_mn_20261103': {},
  'LAB_예비_mn_20261104': {},
  'LAB_미정_mn_20261105': {},
};
const 표 = {
  from: '2026-11-14',
  days: 5,
  versions,
  cells: [
    cell('lab-my-youtube', '2026-11-14T13:00:00+08:00', 못듦('MY', 2)),
    cell('lab-br-youtube', '2026-11-14T13:00:00-03:00', 못듦('BR', 2)),
    cell('lab-br-youtube', '2026-11-15T13:00:00-03:00', 못듦('BR', 2)),
    cell('lab-kg-youtube', '2026-11-14T13:00:00+06:00', 첫판),
    cell('lab-au-youtube', '2026-11-14T13:00:00+11:00', '이미 찬 칸', { taken: true }),
    cell('lab-au-youtube', '2026-11-17T13:00:00+11:00', 다올림),
    cell('lab-instagram', '2026-11-16T12:00:00+08:00', 다올림),
    cell('lab-br-tiktok', '2026-11-16T13:00:00-03:00', 못듦('BR', 2)),
    cell('lab-xx-youtube', '2026-11-14T13:00:00+00:00', 못듦('XX', 2)),
    { account: 'lab-br-youtube', day: '2026-11-14', slot: '21:00', format: '노래', time: '2026-11-14T21:00:00-03:00', original: null, why: 'BR 판본이 검수를 넘긴 노래 원본 없음' },
    cell('lab-youtube', '2026-11-14T13:00:00+09:00', null, { original: 'LAB_가_mn_20261031', version: 'EN' }),
  ],
};

test('갈래 · 한국 시각', () => {
  assert.equal(갈래(못듦('BR', 4)), '판본');
  assert.equal(갈래(첫판), '첫판');
  assert.equal(갈래(다올림), '원본');
  assert.equal(갈래('이미 찬 칸'), '그밖');
  assert.equal(갈래(null), '그밖');
  assert.equal(한국시각('2026-11-14T13:00:00-03:00'), '11-15 01:00');
  assert.equal(한국시각('2026-11-14T13:00:00+08:00'), '11-14 14:00');
  assert.equal(한국시각('엉뚱한 값'), '?');
});

test('빈 칸이 이른 계정부터 · 계정 차례로 하나씩 · 검수만 남은 판본을 앞에', () => {
  const out = 할일({ 표, 원장, 원본들, 상한: 10 });
  const got = out.줄.map((r) => `${r.편.split('_')[1]}/${r.키}`);
  // 말레이시아 칸(한국 11-14 14:00)이 브라질 칸(한국 11-15 01:00)보다 이르다. 첫 판 확인 전인 키르기스는 판본 계정들 뒤.
  assert.deepEqual(got, ['나/MY', '나/BR', '나/KG', '다/MY', '다/BR', '다/KG']);
  assert.equal(out.줄[0].상태, '뜻 검수 전');
  assert.match(out.줄[0].다음, /^확인부터/);
  assert.equal(out.줄[3].상태, '판본 없음');
  assert.match(out.줄[3].다음, /^글부터/);
  assert.equal(out.줄[0].한국, '11-14 14:00');
  assert.equal(out.줄[0].언어, 'ms');
  assert.equal(out.줄[2].갈래, '첫판');
  assert.equal(out.남은, 0);
});

test('같은 (원본, 키)는 한 번만 — 그 판본을 기다리는 계정을 함께 적는다', () => {
  const out = 할일({ 표, 원장, 원본들, 상한: 10 });
  const br = out.줄.filter((r) => r.키 === 'BR');
  assert.equal(br.length, 2);
  for (const r of br) assert.deepEqual(r.계정들, ['lab-br-youtube', 'lab-br-tiktok']);
});

test('이야기 원본만 — 노래 · 멈춘 편 · 예비 · 쓸날이 날짜가 아닌 편은 후보가 아니다', () => {
  const out = 할일({ 표, 원장, 원본들, 상한: 50 });
  const pieces = new Set(out.줄.map((r) => r.편));
  assert.deepEqual([...pieces].sort(), ['LAB_나_mn_20261101', 'LAB_다_mn_20261102']);
});

test('돌 원본이 없는 계정은 따로 알리고, 씨앗 계정 · 찬 칸 · 판을 받는 칸은 세지 않는다', () => {
  const out = 할일({ 표, 원장, 원본들, 상한: 10 });
  assert.deepEqual(out.원본없음.map((r) => r.계정), ['lab-au-youtube']);
  assert.equal(out.원본없음[0].한국, '11-17 11:00');
  assert.deepEqual(out.첫판전, ['lab-kg-youtube']);
  assert.deepEqual(out.키없음, ['lab-xx-youtube']);
  assert.ok(!out.줄.some((r) => r.계정들.includes('lab-instagram') || r.계정들.includes('lab-youtube') || r.계정들.includes('lab-au-youtube')));
});

test('상한 — 앞에서부터 자르고 남은 줄 수를 알린다', () => {
  const out = 할일({ 표, 원장, 원본들, 상한: 4 });
  assert.equal(out.줄.length, 4);
  assert.equal(out.남은, 2);
  assert.deepEqual(out.줄.map((r) => r.키), ['MY', 'BR', 'KG', 'MY']);
  const none = 할일({ 표: { ...표, cells: [] }, 원장, 원본들, 상한: 4 });
  assert.deepEqual(none.줄, []);
  assert.equal(none.남은, 0);
});

test('명령줄 — --표 · --원장 · --폴더로 돌림표를 부르지 않고 셈한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '판본할일-'));
  try {
    for (const [piece, r] of 원본들) {
      fs.mkdirSync(path.join(dir, piece, '게시'), { recursive: true });
      fs.writeFileSync(path.join(dir, piece, '게시', '준비.json'), JSON.stringify({ 돌림: { 형식: r.형식, 쓸날: r.쓸날, 멈춤: r.멈춤 ? { 날: '2026-11-12', 까닭: '시험' } : null, 예비: r.예비 } }));
    }
    fs.mkdirSync(path.join(dir, 'LAB_깨진_mn_20261106', '게시'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'LAB_깨진_mn_20261106', '게시', '준비.json'), '{ 깨진 JSON');
    const read = 원본읽기(dir, [...원본들.keys(), 'LAB_깨진_mn_20261106', 'LAB_없는_mn_20261107']);
    assert.equal(read.size, 원본들.size);
    assert.equal(read.get('LAB_멈춘_mn_20261103').멈춤, true);

    const 표파일 = path.join(dir, '표.json');
    const 원장파일 = path.join(dir, '원장.json');
    fs.writeFileSync(표파일, JSON.stringify(표));
    fs.writeFileSync(원장파일, JSON.stringify(원장));
    const run = (...more) => spawnSync(process.execPath, [TOOL, '--표', 표파일, '--원장', 원장파일, '--폴더', dir, ...more], { encoding: 'utf8' });

    const json = run('--상한', '3', '--json');
    assert.equal(json.status, 0, json.stderr);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.상한, 3);
    assert.deepEqual(parsed.줄.map((r) => `${r.편}|${r.키}`), ['LAB_나_mn_20261101|MY', 'LAB_나_mn_20261101|BR', 'LAB_나_mn_20261101|KG']);
    assert.equal(parsed.남은, 3);

    const text = run();
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /^LAB 판본 할 일 · 2026-11-14부터 5일 · 상한 6/);
    assert.match(text.stdout, /1\. LAB_나_mn_20261101 {2}MY\(ms\) {2}lab-my-youtube {2}빈 칸 11-14 14:00\(한국\) {2}뜻 검수 전/);
    assert.match(text.stdout, /돌 원본이 없는 계정 1.*lab-au-youtube 11-17 11:00/);
    assert.match(text.stdout, /첫 판 확인 전 계정 1.*lab-kg-youtube/);

    const bad = run('--상한', '0');
    assert.equal(bad.status, 2);
    const missing = spawnSync(process.execPath, [TOOL, '--표', path.join(dir, '없는표.json'), '--원장', 원장파일, '--폴더', dir], { encoding: 'utf8' });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /판본 할 일을 셈하지 못했다/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 11-15 Fable 5.2 판본 회차 검수 지적 4 · 5 · 6 — 까닭 코드 · 뒤 칸 · 받은 원본
test('갈래 — 칸의 까닭 코드로 가르고, 코드가 없을 때만 까닭 글로 가른다', () => {
  assert.equal(갈래({ whyCode: 'version', why: '글이 바뀌어도' }), '판본');
  assert.equal(갈래({ whyCode: 'trial' }), '첫판');
  assert.equal(갈래({ whyCode: 'exhausted' }), '원본');
  assert.equal(갈래({ whyCode: 'overlap', why: 못듦('BR', 2) }), '그밖', '코드가 글보다 앞선다');
  assert.equal(갈래({ whyCode: 'seed' }), '그밖');
  assert.equal(갈래({ why: 첫판 }), '첫판');
  assert.equal(갈래({}), '그밖');
});

test('가장 이른 빈 칸이 겹침 · 씨앗 대기여도 뒤 칸의 판본 까닭을 본다 — 판본과 상관없는 계정은 기다림으로', () => {
  const 겹침 = '같은 플랫폼 20시간(같은 언어 묶음은 24시간) 겹침';
  const t = {
    ...표,
    cells: [
      cell('lab-my-youtube', '2026-11-14T13:00:00+08:00', 겹침, { whyCode: 'overlap' }),
      cell('lab-my-youtube', '2026-11-16T13:00:00+08:00', 못듦('MY', 2), { whyCode: 'version' }),
      cell('lab-br-youtube', '2026-11-14T13:00:00-03:00', '씨앗 계정이 아직 안 올렸거나 14시 점검 전', { whyCode: 'seed' }),
      cell('lab-br-youtube', '2026-11-15T13:00:00-03:00', 겹침, { whyCode: 'overlap' }),
    ],
  };
  const out = 할일({ 표: t, 원장, 원본들, 상한: 10 });
  assert.deepEqual([...new Set(out.줄.map((r) => r.키))], ['MY']);
  assert.equal(out.줄[0].한국, '11-16 14:00', '줄의 빈 칸은 판본 까닭이 있는 칸이다');
  assert.deepEqual(out.기다림.map((r) => `${r.계정} ${r.한국}`), ['lab-br-youtube 11-15 01:00']);
  assert.match(out.기다림[0].까닭, /씨앗/);
});

test('그 줄 계정이 모두 받은 원본은 후보에서 뺀다 — 한 계정이라도 안 받았으면 남긴다', () => {
  const t = { ...표, received: { 'lab-br-youtube': ['LAB_나_mn_20261101', 'LAB_다_mn_20261102'], 'lab-br-tiktok': ['LAB_다_mn_20261102'], 'lab-my-youtube': ['LAB_나_mn_20261101'] } };
  const out = 할일({ 표: t, 원장, 원본들, 상한: 50 });
  const of = (key) => out.줄.filter((r) => r.키 === key).map((r) => r.편.split('_')[1]);
  assert.deepEqual(of('BR'), ['나'], 'BR 줄: 나는 틱톡이 안 받았다, 다는 둘 다 받았다');
  assert.deepEqual(of('MY'), ['다'], 'MY 줄: 나는 이미 받았다');
  assert.deepEqual(of('KG'), ['나', '다'], 'received에 없는 계정은 아무것도 안 받은 것으로 본다');
});

test('실제 돌림.plan 출력 — whyCode · received를 그대로 읽어 받은 원본의 낡은 판본을 후보로 내지 않는다', () => {
  const 돌림 = require('../tools/lib/돌림.js');
  const accounts = {
    'seed-ig': { platform: 'instagram', language: 'mn', versionKey: 'MN', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['13:00'], dailyFormats: ['이야기'], seed: true, dailyFrom: '2099-01-01' },
    'yt-br': { platform: 'youtube', language: 'pt-BR', versionKey: 'BR', timeZone: 'America/Sao_Paulo', dailyTimes: ['13:00'], dailyFormats: ['이야기'] },
  };
  const originals = [
    { id: 'LAB_가_mn_20261031', format: '이야기', versions: { BR: { ready: true } } },
    { id: 'LAB_나_mn_20261101', format: '이야기', versions: { BR: { ready: false, why: '뜻 검수 전' } } },
    { id: 'LAB_다_mn_20261102', format: '이야기', versions: { BR: { ready: false, why: '뜻 검수 전' } } },
  ];
  const existing = [
    ...originals.map((o, i) => ({ original: o.id, account: 'seed-ig', time: `2026-10-1${i}T13:00:00+08:00` })),
    { original: 'LAB_가_mn_20261031', account: 'yt-br', time: '2026-11-01T13:00:00-03:00' },
    { original: 'LAB_다_mn_20261102', account: 'yt-br', time: '2026-11-02T13:00:00-03:00' }, // 받은 뒤 판본이 낡았다
  ];
  const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 2 });
  const empty = r.cells.filter((c) => c.account === 'yt-br' && !c.original);
  assert.equal(empty.length, 2);
  for (const c of empty) assert.equal(c.whyCode, 돌림.WHY_CODES.VERSION, c.why);
  assert.deepEqual(r.received['yt-br'], ['LAB_가_mn_20261031', 'LAB_다_mn_20261102']);

  const versions = Object.fromEntries(originals.map((o) => [o.id, o.versions]));
  const 원장2 = { accounts: { 'seed-ig': { countryCode: 'MN', rotationSeed: true }, 'yt-br': { countryCode: 'BR', language: 'pt-BR' } } };
  const out = 할일({ 표: { from: '2026-11-20', days: 2, versions, cells: r.cells, received: r.received }, 원장: 원장2, 원본들, 상한: 10 });
  assert.deepEqual(out.줄.map((x) => `${x.편}|${x.키}`), ['LAB_나_mn_20261101|BR']);
  assert.equal(out.줄[0].갈래, '판본');
});

test('판본 까닭이 없어도 — 판본이 못 든 안 받은 원본이 있으면 「판본」 줄로, 다 들었으면 기다림으로(11-15 Opus 5.5 대체 검수 P2-1)', () => {
  const 겹침 = '같은 플랫폼 20시간(같은 언어 묶음은 24시간) 겹침';
  const t = {
    ...표,
    received: { 'lab-my-youtube': ['LAB_가_mn_20261031'], 'lab-br-youtube': ['LAB_나_mn_20261101', 'LAB_다_mn_20261102'] },
    cells: [
      cell('lab-my-youtube', '2026-11-14T13:00:00+08:00', 겹침, { whyCode: 'overlap' }),
      cell('lab-br-youtube', '2026-11-14T13:00:00-03:00', '씨앗 계정이 아직 안 올렸거나 14시 점검 전', { whyCode: 'seed' }),
    ],
  };
  const out = 할일({ 표: t, 원장, 원본들, 상한: 10 });
  assert.deepEqual(out.줄.map((r) => `${r.편.split('_')[1]}/${r.키}`), ['나/MY', '다/MY'], '나 · 다의 MY 판본이 못 들었다 — 만들면 칸이 찰 수 있다');
  assert.equal(out.줄[0].갈래, '판본');
  assert.deepEqual(out.기다림.map((r) => r.계정), ['lab-br-youtube'], 'BR은 안 받은 가의 BR 판본이 들었다 — 판본으로 못 푼다');
  // 받은 원본을 모르는 옛 출력에서는 이 셈을 하지 않는다
  const 옛 = 할일({ 표: { ...t, received: undefined }, 원장, 원본들, 상한: 10 });
  assert.deepEqual(옛.줄, []);
  assert.equal(옛.기다림.length, 2);
});

test('돌림 received — 걸지 않은 돌림 판의 원본은 받은 원본에서 뺀다(--다시가 뺄 수 있다), 걸린 판 · 사람이 단 판은 넣는다(11-15 P3-4)', () => {
  const 돌림 = require('../tools/lib/돌림.js');
  const accounts = {
    'seed-ig': { platform: 'instagram', language: 'mn', versionKey: 'MN', timeZone: 'Asia/Ulaanbaatar', dailyTimes: ['13:00'], dailyFormats: ['이야기'], seed: true, dailyFrom: '2099-01-01' },
    'yt-br': { platform: 'youtube', language: 'pt-BR', versionKey: 'BR', timeZone: 'America/Sao_Paulo', dailyTimes: ['13:00'], dailyFormats: ['이야기'] },
  };
  const originals = ['LAB_가_mn_20261031', 'LAB_나_mn_20261101', 'LAB_다_mn_20261102'].map((id) => ({ id, format: '이야기', versions: { BR: { ready: true } } }));
  const existing = [
    ...originals.map((o, i) => ({ original: o.id, account: 'seed-ig', time: `2026-10-1${i}T13:00:00+08:00`, booked: true })),
    { original: 'LAB_가_mn_20261031', account: 'yt-br', time: '2026-11-21T13:00:00-03:00', generated: true, booked: true },
    { original: 'LAB_나_mn_20261101', account: 'yt-br', time: '2026-11-22T13:00:00-03:00', generated: true, booked: false },
    { original: 'LAB_다_mn_20261102', account: 'yt-br', time: '2026-11-01T13:00:00-03:00', generated: false, booked: false },
  ];
  const r = 돌림.plan({ accounts, originals, existing, from: '2026-11-20', days: 3 });
  assert.deepEqual(r.received['yt-br'], ['LAB_가_mn_20261031', 'LAB_다_mn_20261102']);
});

test('새 원본이 필요한 계정(11-23) — 「고칠 것」에서 멈춘 판본은 재고로 세지 않고, 재고가 세 편 아래인 나라 계정만 낸다', () => {
  const 표 = {
    cells: [],
    versions: {
      'LAB_가_mn_20261031': { BR: { ready: false, why: '뜻 검수 고칠 것' }, MY: { ready: true, why: null } },
      'LAB_나_mn_20261101': { BR: { ready: false, why: '뜻 검수 전' }, MY: { ready: false, why: '글자 검수 고칠 것' } },
      'LAB_다_mn_20261102': { MY: { ready: true, why: null } },
    },
    received: { 'lab-br-youtube': [], 'lab-my-youtube': [], 'lab-instagram': [] },
  };
  const out = 할일({ 표, 원장, 원본들 });
  // BR: 안 받은 셋 가운데 가(고칠 것)를 빼면 둘 — 모자람. MY: 나(글자 고칠 것)를 빼면 둘 — 모자람. 씨앗(lab-instagram)은 세지 않는다
  assert.deepEqual(out.재고모자람.map((r) => [r.계정, r.재고, r.멈춤]), [
    ['lab-br-youtube', 2, ['LAB_가_mn_20261031']],
    ['lab-my-youtube', 2, ['LAB_나_mn_20261101']],
  ]);
  // 멈춘 판본이 없고 셋이 남으면 낼 것이 없다
  const 넉넉 = 할일({ 표: { ...표, versions: { 'LAB_가_mn_20261031': {}, 'LAB_나_mn_20261101': {}, 'LAB_다_mn_20261102': {} } }, 원장, 원본들 });
  assert.deepEqual(넉넉.재고모자람.filter((r) => r.계정 === 'lab-br-youtube'), []);
  // received를 모르는 옛 출력에서는 세지 않는다
  assert.deepEqual(할일({ 표: { cells: [], versions: 표.versions }, 원장, 원본들 }).재고모자람, []);
});
