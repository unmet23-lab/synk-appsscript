'use strict';

// CI 빨간불 — gh·git은 가짜 실행기로만 부른다. 텔레그램은 보내지 않고(SYNK_TG_DRYRUN_DIR), 상태 파일은 임시 폴더에 쓴다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ci = require('../tools/ci빨간불.js');

const run = (id, 결론, 시각, 덧 = {}) => ({
  databaseId: id, workflowName: 'syntax-check', status: 결론 ? 'completed' : 'in_progress', conclusion: 결론 || '',
  createdAt: 시각, headSha: `${String(id).padStart(4, '0')}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, displayTitle: `커밋 ${id}`, event: 'push',
  url: `https://github.com/o/r/actions/runs/${id}`, ...덧,
});

// 10-21 실제 --log-failed 꼴(잡\t단계\t시각 글). 같은 not ok가 요약에서 한 번 더 나온다.
const 로그 = [
  'check\trun SYNK safety tests\t\uFEFF2026-10-21T12:22:31.1794310Z ##[group]Run set -o pipefail',
  'check\trun SYNK safety tests\t2026-10-21T12:22:31.7617017Z ok 44 - wrong, hint and retry keep distinct choices',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5361635Z not ok 2094 - ⑦ SUIT 를 «이름으로 부르는» 지면은 그 서체를 반드시 싣는다',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5362127Z   ---',
  "check\trun SYNK safety tests\t2026-10-21T12:23:33.5363005Z   location: '/home/runner/work/synk-appsscript/synk-appsscript/SYNK-appsscript/tests/지면폰트.test.js:356:1'",
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5363889Z     이름만 적고 안 싣는 지면 1벌 (부르는 지면 160벌 중).',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5364496Z        → 심는다: node tools/lib/브랜드폰트.js --심기 "docs/모션.html"',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5364924Z        → 폴더째 렌더하는 키트 지면이면 키트 사본을 다시 넣는다',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5527906Z # tests 2252',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5528693Z # fail 1',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5531054Z --- not ok ---',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5531301Z not ok 2094 - ⑦ SUIT 를 «이름으로 부르는» 지면은 그 서체를 반드시 싣는다',
  'check\trun SYNK safety tests\t2026-10-21T12:23:33.5539344Z ##[error]Process completed with exit code 1.',
].join('\n');

/** 가짜 실행기 — 부른 명령을 적고, 준비한 답을 돌려준다. */
function 가짜({ runs = [], 로그글 = 로그, jobs = null, 원격 = 'https://github.com/o/r.git', 공용 = os.tmpdir(), gh막힘 = false } = {}) {
  const 부름 = [];
  const sh = (cmd, args) => {
    부름.push([cmd, ...args].join(' '));
    if (cmd === 'git' && args[0] === 'remote') return { ok: true, out: `${원격}\n` };
    if (cmd === 'git' && args[0] === 'rev-parse') return { ok: true, out: `${공용}\n` };
    if (gh막힘) return { ok: false, 사유: 'gh 실행 불가 (ENOENT)' };
    if (cmd === 'gh' && args[1] === 'list') return { ok: true, out: JSON.stringify(runs) };
    if (cmd === 'gh' && args.includes('--log-failed')) return { ok: true, out: 로그글 };
    if (cmd === 'gh' && args.includes('jobs')) return { ok: true, out: JSON.stringify({ jobs: jobs || [] }) };
    return { ok: false, 사유: `모르는 명령 ${cmd} ${args.join(' ')}` };
  };
  return { sh, 부름 };
}

test('판정하기 — 마지막 초록 바로 뒤가 첫 빨강이고, 취소·PR run은 셈에서 뺀다', () => {
  const runs = [
    run(6, null, '2026-10-21T14:00:00Z'),
    run(5, 'failure', '2026-10-21T13:00:00Z'),
    run(4, 'cancelled', '2026-10-21T12:30:00Z'),
    run(3, 'failure', '2026-10-21T12:00:00Z'),
    run(9, 'failure', '2026-10-21T11:30:00Z', { event: 'pull_request' }),
    run(2, 'success', '2026-10-21T11:00:00Z'),
    run(1, 'failure', '2026-10-21T10:00:00Z'),
    run(7, 'success', '2026-10-21T13:30:00Z', { workflowName: 'records-check' }),
  ];
  const [syntax, records] = ci.판정하기(runs);
  assert.equal(syntax.워크플로, 'syntax-check');
  assert.equal(syntax.상태, '빨강');
  assert.equal(syntax.회수, 2);
  assert.equal(syntax.첫빨강.run, 3);
  assert.equal(syntax.첫빨강확실, true);
  assert.equal(syntax.최신.run, 5);
  assert.equal(syntax.도는중, 1);
  assert.equal(records.상태, '초록');
});

test('판정하기 — 창 안에 초록이 없으면 첫 빨강을 «적어도»로 남긴다', () => {
  const [w] = ci.판정하기([run(2, 'failure', '2026-10-21T12:00:00Z'), run(1, 'timed_out', '2026-10-21T11:00:00Z')]);
  assert.equal(w.상태, '빨강');
  assert.equal(w.회수, 2);
  assert.equal(w.첫빨강확실, false);
  assert.match(ci.상태글({ 상태: '빨강', 워크플로: [w] }), /적어도 2회 연속 빨강/);
});

test('실패읽기 — 깨진 시험 이름·위치·「→」 안내를 뽑고, 요약에 다시 나온 not ok는 한 번만 센다', () => {
  const r = ci.실패읽기(로그);
  assert.equal(r.시험수, 1);
  assert.deepEqual(r.시험[0], {
    이름: '⑦ SUIT 를 «이름으로 부르는» 지면은 그 서체를 반드시 싣는다',
    위치: 'tests/지면폰트.test.js:356',
    안내: ['심는다: node tools/lib/브랜드폰트.js --심기 "docs/모션.html"', '폴더째 렌더하는 키트 지면이면 키트 사본을 다시 넣는다'],
  });
});

test('알림계획 — 빨개질 때 한 통, 같은 줄은 3시간·12시간 뒤에만 다시, 초록이 되면 한 통', () => {
  const t0 = Date.parse('2026-10-21T08:10:00Z');
  const 빨강 = (첫run, 시각 = '2026-10-21T08:05:00Z') => ({
    상태: '빨강', 확인시각: '', 워크플로: [{ 워크플로: 'syntax-check', 상태: '빨강', 회수: 3, 첫빨강확실: true,
      첫빨강: { run: 첫run, sha: 'abc123def', 제목: '지유 v7', 시각 }, 최신: { run: 99, 시각, url: 'u' }, 자세히: ci.실패읽기(로그) }],
  });
  const 처음 = ci.알림계획(null, 빨강(10), t0);
  assert.match(처음.글, /빨개졌습니다/);
  assert.match(처음.글, /tests\/지면폰트\.test\.js:356/);
  assert.match(처음.글, /→ 심는다/);
  assert.equal(처음.새상태.워크플로['syntax-check'].상태, '빨강');

  const 곧 = ci.알림계획(처음.새상태, 빨강(10), t0 + 2 * 3600e3);
  assert.equal(곧.글, null);
  const 세시간 = ci.알림계획(곧.새상태, 빨강(10), t0 + 3 * 3600e3);
  assert.match(세시간.글, /아직 빨갛습니다/);
  assert.match(세시간.글, /빨간 지 3시간 5분/);
  assert.equal(세시간.새상태.워크플로['syntax-check'].다시알린수, 1);
  assert.equal(ci.알림계획(세시간.새상태, 빨강(10), t0 + 14 * 3600e3).글, null);
  assert.match(ci.알림계획(세시간.새상태, 빨강(10), t0 + 15 * 3600e3).글, /아직 빨갛습니다/);

  const 새줄 = ci.알림계획(곧.새상태, 빨강(20, '2026-10-21T09:00:00Z'), t0 + 3600e3);
  assert.match(새줄.글, /빨개졌습니다/, '초록을 거치지 않았어도 첫 빨강 run이 바뀌면 새 빨강이다');

  const 초록 = { 상태: '초록', 확인시각: '', 워크플로: [{ 워크플로: 'syntax-check', 상태: '초록', 최신: { run: 30, 시각: '2026-10-21T14:16:16Z' } }] };
  const 풀림 = ci.알림계획(곧.새상태, 초록, t0 + 6 * 3600e3);
  assert.match(풀림.글, /다시 초록 — 빨간 시간 6시간 11분/);
  assert.equal(풀림.새상태.워크플로['syntax-check'].상태, '초록');
  assert.equal(ci.알림계획(풀림.새상태, 초록, t0 + 7 * 3600e3).글, null);
  assert.equal(ci.알림계획(null, 초록, t0).글, null, '처음 본 초록은 알리지 않는다');
});

test('알림 — 텔레그램 대신 시험 폴더에 쓰고, 보내기가 실패하면 상태를 안 바꿔 다음 회차에 다시 보낸다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_TG_DRYRUN_DIR: path.join(방, 'tg'), SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    const runs = [run(3, 'failure', '2026-10-21T09:00:00Z'), run(2, 'failure', '2026-10-21T08:05:00Z'), run(1, 'success', '2026-10-21T07:53:00Z')];
    const { sh } = 가짜({ runs });
    const 실패 = ci.알림({ sh, 파일들: [], 환경, 보내는일: () => ({ ok: false, error: '게이트웨이 꺼짐' }) });
    assert.equal(실패.결과, '못 보냄');
    assert.equal(fs.existsSync(환경.SYNK_CI빨간불_상태), false);

    const 첫 = ci.알림({ sh, 파일들: [], 환경, 지금ms: Date.parse('2026-10-21T09:10:00Z') });
    assert.equal(첫.결과, '보냄');
    assert.equal(첫.방법, 'dryrun');
    const 보낸글 = fs.readdirSync(환경.SYNK_TG_DRYRUN_DIR).map((n) => fs.readFileSync(path.join(환경.SYNK_TG_DRYRUN_DIR, n), 'utf8'));
    assert.equal(보낸글.length, 1);
    assert.match(보낸글[0], /syntax-check: 2회 연속 빨강 — 첫 빨강 10-21 17:05/);
    assert.equal(ci.알림({ sh, 파일들: [], 환경, 지금ms: Date.parse('2026-10-21T09:20:00Z') }).결과, '바뀐 것 없음');
    assert.equal(fs.readdirSync(환경.SYNK_TG_DRYRUN_DIR).length, 1);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('알림 — 텔레그램 보내기는 바쁜 PC를 생각해 120초 한도로 부른다(10-23 기본 45초에 끊겨 한 시간 못 보냄)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    const { sh } = 가짜({ runs: [run(3, 'failure', '2026-10-21T09:00:00Z'), run(1, 'success', '2026-10-21T08:00:00Z')] });
    const 옵션들 = [];
    const r = ci.알림({ sh, 파일들: [], 환경, 보내는일: (글, env, 옵션) => { 옵션들.push(옵션); return { ok: true, method: 'test' }; } });
    assert.equal(r.결과, '보냄');
    assert.deepEqual(옵션들, [{ 한도ms: 120000 }]);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('알림 — gh를 못 읽으면 「모름」이고 상태 파일을 건드리지 않는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_TG_DRYRUN_DIR: path.join(방, 'tg'), SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    fs.writeFileSync(환경.SYNK_CI빨간불_상태, '{"판":1,"워크플로":{"syntax-check":{"상태":"빨강"}}}');
    const r = ci.알림({ sh: 가짜({ gh막힘: true }).sh, 파일들: [], 환경 });
    assert.equal(r.결과, '모름');
    assert.equal(fs.readFileSync(환경.SYNK_CI빨간불_상태, 'utf8'), '{"판":1,"워크플로":{"syntax-check":{"상태":"빨강"}}}');
    assert.equal(fs.existsSync(환경.SYNK_TG_DRYRUN_DIR), false);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('잡이 시작도 못 한 run은 시험이 아니라 미기동으로 알린다', () => {
  const { sh } = 가짜({ runs: [run(2, 'failure', '2026-10-21T09:00:00Z'), run(1, 'success', '2026-10-21T08:00:00Z')], 로그글: '', jobs: [{ name: 'check', steps: [] }] });
  const r = ci.지금읽기({ sh, 파일들: [] });
  assert.equal(r.상태, '빨강');
  assert.equal(r.워크플로[0].자세히.미기동, true);
  assert.match(ci.상태글(r), /잡이 시작도 못 했다/);
});

test('빠른상태 — 10분 안의 상태 파일이면 gh를 부르지 않고, 오래됐으면 run 목록 한 번만 읽는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    const 지금ms = Date.parse('2026-10-21T10:00:00Z');
    fs.writeFileSync(환경.SYNK_CI빨간불_상태, JSON.stringify({ 판: 1, 확인시각: '2026-10-21T09:55:00Z',
      워크플로: { 'syntax-check': { 상태: '빨강', 첫빨강run: 3, 첫빨강시각: '2026-10-21T08:05:00Z' }, 'records-check': { 상태: '초록' } } }));
    const 신선 = 가짜();
    const s = ci.빠른상태({ sh: 신선.sh, 환경, 지금ms });
    assert.equal(s.출처, '상태 파일');
    assert.deepEqual(s.빨강.map((w) => w.워크플로), ['syntax-check']);
    assert.ok(!신선.부름.some((c) => c.startsWith('gh')));
    assert.match(ci.빠른경고글(s), /⚠ master CI 빨강 — syntax-check 10-21 17:05부터/);

    const 낡은 = 가짜({ runs: [run(2, 'failure', '2026-10-21T09:00:00Z'), run(1, 'success', '2026-10-21T08:00:00Z')] });
    const s2 = ci.빠른상태({ sh: 낡은.sh, 환경, 지금ms: 지금ms + 3600e3 });
    assert.equal(s2.출처, 'gh');
    assert.equal(s2.빨강[0].첫빨강run, 2);
    assert.equal(낡은.부름.filter((c) => c.startsWith('gh')).length, 1, '로그는 받지 않는다');
    assert.equal(ci.빠른경고글({ 빨강: [] }), null);
    assert.equal(ci.빠른상태({ sh: 가짜({ 원격: 'C:/repo/remote.git' }).sh, 환경: {}, 지금ms }), null, 'GitHub가 아닌 원격은 묻지 않는다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('저장소이름 — https·ssh 주소를 읽고, GitHub가 아니면 null', () => {
  const 이름 = (원격) => ci.저장소이름(가짜({ 원격 }).sh);
  assert.equal(이름('https://github.com/unmet23-lab/synk-appsscript.git'), 'unmet23-lab/synk-appsscript');
  assert.equal(이름('git@github.com:unmet23-lab/SYNK-talk.git'), 'unmet23-lab/SYNK-talk');
  assert.equal(이름('C:/Users/x/remote.git'), null);
});

test('예약명령 — 공용 작업본 경로의 숨김 실행기로 10분마다 --알림을 건다', () => {
  const 공용git = path.join(os.tmpdir(), '공용작업본', '.git');
  const m = ci.예약명령({ sh: 가짜({ 공용: 공용git }).sh });
  assert.equal(m.공용, path.dirname(공용git));
  assert.match(m.인자, /숨김실행\.py" ".*ci빨간불\.js" --알림$/);
  assert.ok(m.인자.includes(path.join(m.공용, 'tools', 'ci빨간불.js')));
  assert.match(m.ps, /-RepetitionInterval \(New-TimeSpan -Minutes 10\)/);
  assert.match(m.ps, /-TaskName 'SYNK CI 빨간불 알림'/);
});

test('예약명령 — 운영 사본이 있으면(공용 git 폴더의 synk-ops-path) 그 경로의 도구로 건다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-운영-'));
  try {
    const 공용git = path.join(방, '공용', '.git');
    const 운영 = path.join(방, '운영');
    fs.mkdirSync(공용git, { recursive: true });
    fs.mkdirSync(운영);
    fs.writeFileSync(path.join(공용git, 'synk-ops-path'), `${운영}\n`);
    const m = ci.예약명령({ sh: 가짜({ 공용: 공용git }).sh });
    assert.equal(m.공용, 운영);
    assert.ok(m.인자.includes(path.join(운영, 'tools', '숨김실행.py')));
    assert.ok(m.ps.includes(`-WorkingDirectory '${운영}'`));
    fs.rmSync(운영, { recursive: true });
    assert.equal(ci.예약명령({ sh: 가짜({ 공용: 공용git }).sh }).공용, path.dirname(공용git), '가리킨 폴더가 없으면 공용 작업본');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('재알림 — 창이 밀려 첫 빨강이 바뀌어 보여도 처음 적어 둔 첫 빨강 커밋·시각을 쓰고, 상태에 커밋·제목·횟수를 남긴다(아르곤 10-22 P2)', () => {
  const t0 = Date.parse('2026-10-21T08:10:00Z');
  const 빨강 = (첫run, 시각, sha, 확실 = true) => ({ 상태: '빨강', 확인시각: '', 워크플로: [{ 워크플로: 'syntax-check', 상태: '빨강', 회수: 100, 첫빨강확실: 확실,
    첫빨강: { run: 첫run, sha, 제목: `커밋 ${첫run}`, 시각 }, 최신: { run: 999, 시각, url: 'u' }, 자세히: { 시험: [], 시험수: 0, 단계: [] } }] });
  const 처음 = ci.알림계획(null, 빨강(10, '2026-10-21T08:05:00Z', 'aaaaaaaaa1'), t0);
  const 칸 = 처음.새상태.워크플로['syntax-check'];
  assert.deepEqual([칸.첫빨강sha, 칸.첫빨강제목, 칸.회수, 칸.첫빨강확실], ['aaaaaaaaa1', '커밋 10', 100, true]);
  // 3시간 뒤 — 창이 밀려 창 맨 끝 run(70)이 첫 빨강처럼 보인다(확실 아님)
  const 뒤 = ci.알림계획(처음.새상태, 빨강(70, '2026-10-21T10:30:00Z', 'bbbbbbbbb7', false), t0 + 3 * 3600e3);
  assert.match(뒤.글, /아직 빨갛습니다/);
  assert.match(뒤.글, /첫 빨강 10-21 17:05 aaaaaaaaa 「커밋 10」/, '창 끝이 아니라 처음 적은 첫 빨강');
  assert.match(뒤.글, /빨간 지 3시간 5분/);
  assert.equal(뒤.새상태.워크플로['syntax-check'].첫빨강run, 10);
});

test('빠른상태 — 상태 파일에서도 첫 빨강 커밋·제목·횟수를 경고에 싣는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    fs.writeFileSync(환경.SYNK_CI빨간불_상태, JSON.stringify({ 판: 1, 확인시각: '2026-10-21T09:55:00Z', 워크플로: { 'syntax-check': {
      상태: '빨강', 첫빨강run: 3, 첫빨강시각: '2026-10-21T08:05:00Z', 첫빨강sha: '1eb18efdb0000', 첫빨강제목: '지유 v7', 회수: 7, 첫빨강확실: true } } }));
    const s = ci.빠른상태({ sh: 가짜().sh, 환경, 지금ms: Date.parse('2026-10-21T10:00:00Z') });
    assert.match(ci.빠른경고글(s), /syntax-check 10-21 17:05부터 7회 · 첫 빨강 1eb18efdb 「지유 v7」/);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('실패읽기 — CI 로그의 describe 안 하위 시험은 잎으로 읽고 부모는 세지 않는다', () => {
  const 줄 = (글) => `check\trun SYNK safety tests\t2026-10-21T12:23:33.5361635Z ${글}`;
  const 로그 = ['# Subtest: 묶음', '    # Subtest: 잎', '    not ok 1 - 잎', '      ---', "      location: '/home/runner/work/a/a/SYNK-appsscript/tests/x.test.js:9:1'",
    "      failureType: 'testCodeFailure'", '      ...', 'not ok 1 - 묶음', '  ---', "  failureType: 'subtestsFailed'", '  ...'].map(줄).join('\n');
  const r = ci.실패읽기(로그);
  assert.deepEqual(r.시험.map((x) => [x.이름, x.위치]), [['묶음 › 잎', 'tests/x.test.js:9']]);
});

test('재알림 — 창보다 길어진 빨강은 회수를 「적어도」로 쓴다', () => {
  const t0 = Date.parse('2026-10-21T08:10:00Z');
  const 빨강 = (첫run, 확실) => ({ 상태: '빨강', 확인시각: '', 워크플로: [{ 워크플로: 'syntax-check', 상태: '빨강', 회수: 50, 첫빨강확실: 확실,
    첫빨강: { run: 첫run, sha: 'aaaaaaaaa1', 제목: '첫', 시각: '2026-10-21T08:05:00Z' }, 최신: { run: 999, 시각: '2026-10-21T08:05:00Z', url: 'u' }, 자세히: { 시험: [], 시험수: 0, 단계: [] } }] });
  const 처음 = ci.알림계획(null, 빨강(10, true), t0);
  const 뒤 = ci.알림계획(처음.새상태, 빨강(60, false), t0 + 3 * 3600e3);
  assert.match(뒤.글, /적어도 50회 연속 빨강 — 첫 빨강 10-21 17:05 aaaaaaaaa/);
});

test('공용git폴더 — git이 답을 못 해도 도구가 든 작업본의 .git 폴더를 쓰고, .git이 파일(워크트리)이면 null(10-22 회차 실패)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 막힘 = () => ({ ok: false, 사유: 'git 실행 불가 (ETIMEDOUT)' });
    fs.mkdirSync(path.join(방, '공용', '.git'), { recursive: true });
    assert.equal(ci.공용git폴더(막힘, path.join(방, '공용')), path.join(방, '공용', '.git'));
    fs.mkdirSync(path.join(방, '워크트리'));
    fs.writeFileSync(path.join(방, '워크트리', '.git'), 'gitdir: ../공용/.git/worktrees/x\n');
    assert.equal(ci.공용git폴더(막힘, path.join(방, '워크트리')), null);
    assert.equal(ci.공용git폴더(() => ({ ok: true, out: 'C:/x/.git\n' }), path.join(방, '워크트리')), 'C:/x/.git');
    // 운영 사본처럼 제대로 이어진 워크트리는 commondir를 따라 공용 git 폴더를 찾는다(10-22)
    fs.mkdirSync(path.join(방, '공용', '.git', 'worktrees', 'ops'), { recursive: true });
    fs.writeFileSync(path.join(방, '공용', '.git', 'worktrees', 'ops', 'commondir'), '../..\n');
    fs.mkdirSync(path.join(방, '운영'));
    fs.writeFileSync(path.join(방, '운영', '.git'), `gitdir: ${path.join(방, '공용', '.git', 'worktrees', 'ops')}\n`);
    assert.equal(ci.공용git폴더(막힘, path.join(방, '운영')), path.join(방, '공용', '.git'));
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('알림 — 6회(약 1시간) 내리 못 읽으면 「감시가 멈췄다」를 한 번만 보내고, 다시 읽히면 「다시 읽는다」를 붙이고 셈을 지운다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_TG_DRYRUN_DIR: path.join(방, 'tg'), SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    const 보낸글 = () => (fs.existsSync(환경.SYNK_TG_DRYRUN_DIR) ? fs.readdirSync(환경.SYNK_TG_DRYRUN_DIR).sort().map((n) => fs.readFileSync(path.join(환경.SYNK_TG_DRYRUN_DIR, n), 'utf8')) : []);
    const 막힘 = 가짜({ gh막힘: true }).sh;
    const t0 = Date.parse('2026-10-22T03:40:00Z');
    for (let k = 0; k < 5; k++) assert.equal(ci.알림({ sh: 막힘, 파일들: [], 환경, 지금ms: t0 + k * 600e3 }).결과, '모름');
    assert.equal(보낸글().length, 0, '5회까지는 조용하다');
    const 여섯 = ci.알림({ sh: 막힘, 파일들: [], 환경, 지금ms: t0 + 5 * 600e3 });
    assert.deepEqual([여섯.못읽음.회수, 여섯.못읽음.알림], [6, true]);
    assert.match(보낸글()[0], /6회\(50분\) 내리 master CI 상태를 못 읽었습니다 — gh로 run을 못 읽었다/);
    ci.알림({ sh: 막힘, 파일들: [], 환경, 지금ms: t0 + 6 * 600e3 });
    assert.equal(보낸글().length, 1, '한 번만 보낸다');
    const 초록 = 가짜({ runs: [run(2, 'success', '2026-10-22T04:00:00Z')] }).sh;
    const 다시 = ci.알림({ sh: 초록, 파일들: [], 환경, 지금ms: t0 + 7 * 600e3 });
    assert.equal(다시.결과, '보냄');
    assert.match(보낸글()[1], /다시 master CI 상태를 읽습니다\(7회 못 읽은 뒤\)/);
    assert.equal(fs.existsSync(path.join(방, '못읽음.json')), false, '셈을 지운다');
    assert.equal(ci.알림({ sh: 초록, 파일들: [], 환경, 지금ms: t0 + 8 * 600e3 }).결과, '바뀐 것 없음');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('알림 — 못 읽던 사이에 한 번 읽히면 그 회차의 보내기가 실패해도 「내리」 셈은 끊긴다(아르곤 10-22 P2)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_TG_DRYRUN_DIR: path.join(방, 'tg'), SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    const 막힘 = 가짜({ gh막힘: true }).sh;
    const 빨강 = 가짜({ runs: [run(3, 'failure', '2026-10-22T04:20:00Z'), run(1, 'success', '2026-10-22T04:00:00Z')] }).sh;
    const t0 = Date.parse('2026-10-22T03:40:00Z');
    for (let k = 0; k < 5; k++) ci.알림({ sh: 막힘, 파일들: [], 환경, 지금ms: t0 + k * 600e3 });
    const 못보냄 = ci.알림({ sh: 빨강, 파일들: [], 환경, 지금ms: t0 + 5 * 600e3, 보내는일: () => ({ ok: false, error: '게이트웨이 꺼짐' }) });
    assert.equal(못보냄.결과, '못 보냄');
    assert.equal(fs.existsSync(path.join(방, '못읽음.json')), false, '읽혔으니 셈을 지운다');
    const 한번 = ci.알림({ sh: 막힘, 파일들: [], 환경, 지금ms: t0 + 6 * 600e3 });
    assert.deepEqual([한번.못읽음.회수, 한번.못읽음.알림], [1, false], '1회부터 다시 센다');
    assert.equal(fs.existsSync(환경.SYNK_TG_DRYRUN_DIR), false, '「멈췄다」를 잘못 보내지 않는다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});
