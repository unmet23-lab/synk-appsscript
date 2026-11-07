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

// 위 로그를 낸 작업(로그 첫 칸이 check)
const 기본jobs = [{ name: 'check', databaseId: 1, conclusion: 'failure', steps: [{ name: 'run SYNK safety tests', conclusion: 'failure' }] }];

/** 가짜 실행기 — 부른 명령을 적고, 준비한 답을 돌려준다. 로그글·jobs는 run 번호를 받는 함수여도 된다(jobs가 null이면 그 run은 못 읽음). */
function 가짜({ runs = [], 로그글 = 로그, jobs = 기본jobs, 원격 = 'https://github.com/o/r.git', 공용 = os.tmpdir(), gh막힘 = false, 부를때 = null } = {}) {
  const 부름 = [];
  const sh = (cmd, args) => {
    부름.push([cmd, ...args].join(' '));
    if (부를때) 부를때(cmd, args);
    if (cmd === 'git' && args[0] === 'remote') return { ok: true, out: `${원격}\n` };
    if (cmd === 'git' && args[0] === 'rev-parse') return { ok: true, out: `${공용}\n` };
    if (gh막힘) return { ok: false, 사유: 'gh 실행 불가 (ENOENT)' };
    if (cmd === 'gh' && args[1] === 'list') return { ok: true, out: JSON.stringify(runs) };
    const id = Number(args[2]);
    if (cmd === 'gh' && args.includes('--log-failed')) return { ok: true, out: typeof 로그글 === 'function' ? 로그글(id) : 로그글 };
    if (cmd === 'gh' && args.includes('jobs')) {
      const j = typeof jobs === 'function' ? jobs(id) : jobs;
      return j ? { ok: true, out: JSON.stringify({ jobs: j }) } : { ok: false, 사유: 'HTTP 502: Server Error' };
    }
    return { ok: false, 사유: `모르는 명령 ${cmd} ${args.join(' ')}` };
  };
  return { sh, 부름 };
}

// 11-08 conditional-qa 꼴 — run마다 깨진 작업이 다르다. 작업 이름은 로그 첫 칸과 같다.
const 윈도 = 'hosted (windows-latest, windows)', 리눅스 = 'hosted (ubuntu-24.04, linux)', 로컬 = 'local-coverage';
const 윈도단계 = 'verify exact registered cases, with no skips', 로컬단계 = "check the exact commit's complete local result";
const 작업 = (name, 결론, 단계 = []) => ({ name, conclusion: 결론, steps: 결론 === 'skipped' ? [] : [{ name: 'set up job', conclusion: 'success' }, ...단계.map((s) => ({ name: s, conclusion: 'failure' }))] });
const 조건부jobs = (깨진) => [
  작업(윈도, 깨진.includes(윈도) ? 'failure' : 'success', 깨진.includes(윈도) ? [윈도단계] : []),
  작업(리눅스, 깨진.includes(리눅스) ? 'failure' : 'success', 깨진.includes(리눅스) ? ['run tests'] : []),
  작업(로컬, 깨진.includes(로컬) ? 'failure' : 깨진.includes(윈도) ? 'skipped' : 'success', 깨진.includes(로컬) ? [로컬단계] : []),
];
const 조건부로그 = (깨진, { 로컬시험 = false } = {}) => [
  ...(깨진.includes(윈도) ? [`${윈도}\t${윈도단계}\t2026-11-07T18:40:00.0000000Z default: 27/28`] : []),
  ...(깨진.includes(리눅스) ? [`${리눅스}\trun tests\t2026-11-07T17:20:00.0000000Z not ok 1 - 리눅스에서만 깨진 시험`,
    `${리눅스}\trun tests\t2026-11-07T17:20:00.0000000Z   ---`, `${리눅스}\trun tests\t2026-11-07T17:20:00.0000000Z   location: '/home/runner/work/a/a/SYNK-appsscript/tests/리눅스.test.js:7:1'`,
    `${리눅스}\trun tests\t2026-11-07T17:20:00.0000000Z   ...`] : []),
  ...(깨진.includes(로컬) ? [`${로컬}\t${로컬단계}\t2026-11-07T18:04:36.3196017Z Local QA has not passed: FAIL 75/79: S063 S064 S065 S067`] : []),
  ...(로컬시험 ? [`${로컬}\t${로컬단계}\t2026-11-07T17:20:00.0000000Z not ok 9 - 로컬 작업 줄의 시험`] : []),
].join('\n');
const 조건부run = (id, 결론, 시각) => run(id, 결론, 시각, { workflowName: 'conditional-qa' });

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
  assert.deepEqual(syntax.빨강들.map((r) => r.run), [5, 3], '연속 구간의 빨강 run만(취소는 뺀다)');
  assert.equal(syntax.뒤셈밖, 0, '취소 4는 최신 빨강 5보다 앞이다');
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

test('알림계획 — 새 실패와 복구만 한 통, 같은 실패는 시간이 지나도 다시 알리지 않는다', () => {
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
  assert.equal(세시간.글, null);
  assert.equal(세시간.새상태.워크플로['syntax-check'].다시알린수, 0);
  assert.equal(ci.알림계획(세시간.새상태, 빨강(10), t0 + 14 * 3600e3).글, null);
  assert.equal(ci.알림계획(세시간.새상태, 빨강(10), t0 + 48 * 3600e3).글, null);

  const 추가 = 빨강(10);
  추가.워크플로[0].자세히 = { 시험: [{ 이름: '새 오류', 위치: 'tests/new.js:20', 안내: [] }], 시험수: 1 };
  const 바뀜 = ci.알림계획(세시간.새상태, 추가, t0 + 4 * 3600e3);
  assert.match(바뀜.글, /새 실패/);
  assert.equal(ci.알림계획(바뀜.새상태, 추가, t0 + 5 * 3600e3).글, null);
  assert.equal(ci.알림계획(바뀜.새상태, 빨강(10), t0 + 6 * 3600e3).글, null, 'an already announced failure returning within the same incident is quiet');

  const 새줄 = ci.알림계획(곧.새상태, 빨강(20, '2026-10-21T09:00:00Z'), t0 + 3600e3);
  assert.match(새줄.글, /빨개졌습니다/, '초록을 거치지 않았어도 첫 빨강 run이 바뀌면 새 빨강이다');

  const 초록 = { 상태: '초록', 확인시각: '', 워크플로: [{ 워크플로: 'syntax-check', 상태: '초록', 최신: { run: 30, 시각: '2026-10-21T14:16:16Z' } }] };
  const 풀림 = ci.알림계획(곧.새상태, 초록, t0 + 6 * 3600e3);
  assert.match(풀림.글, /다시 초록 — 빨간 시간 6시간 11분/);
  assert.equal(풀림.새상태.워크플로['syntax-check'].상태, '초록');
  assert.equal(ci.알림계획(풀림.새상태, 초록, t0 + 7 * 3600e3).글, null);
  assert.equal(ci.알림계획(null, 초록, t0).글, null, '처음 본 초록은 알리지 않는다');
});

test('다시 초록의 빨간 시간은 초록 줄의 맨 처음 run까지다 — 보내기가 밀려 늦게 알려도 늘어나지 않는다(10-23)', () => {
  const 판 = ci.판정하기([run(5, 'success', '2026-10-23T08:14:00Z'), run(4, 'success', '2026-10-23T07:30:00Z'),
    run(3, 'success', '2026-10-23T07:25:00Z'), run(2, 'failure', '2026-10-23T07:10:00Z'), run(1, 'failure', '2026-10-23T05:28:00Z')]);
  assert.equal(판[0].상태, '초록');
  assert.equal(판[0].최신.run, 5);
  assert.equal(판[0].첫초록.run, 3, '빨강 바로 뒤의 초록');
  const 앞 = { 판: 1, 확인시각: '2026-10-23T06:39:00Z', 워크플로: { 'syntax-check': { 상태: '빨강', 첫빨강run: 1, 첫빨강시각: '2026-10-23T05:28:00Z', 회수: 2 } } };
  const 풀림 = ci.알림계획(앞, { 상태: '초록', 확인시각: '', 워크플로: 판 }, Date.parse('2026-10-23T08:19:00Z'));
  assert.match(풀림.글, /다시 초록 — 빨간 시간 1시간 57분/);
  assert.doesNotMatch(풀림.글, /2시간 46분/);
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
  assert.match(m.ps, /-Priority 5/, '우선순위 7이면 CPU가 꽉 찰 때 5분 한도에 잘려 알림이 빠진다');
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

test('창이 밀려 첫 빨강이 바뀌어 보여도 처음 기록은 보존하고 재알림하지 않는다', () => {
  const t0 = Date.parse('2026-10-21T08:10:00Z');
  const 빨강 = (첫run, 시각, sha, 확실 = true) => ({ 상태: '빨강', 확인시각: '', 워크플로: [{ 워크플로: 'syntax-check', 상태: '빨강', 회수: 100, 첫빨강확실: 확실,
    첫빨강: { run: 첫run, sha, 제목: `커밋 ${첫run}`, 시각 }, 최신: { run: 999, 시각, url: 'u' }, 자세히: { 시험: [], 시험수: 0, 단계: [] } }] });
  const 처음 = ci.알림계획(null, 빨강(10, '2026-10-21T08:05:00Z', 'aaaaaaaaa1'), t0);
  const 칸 = 처음.새상태.워크플로['syntax-check'];
  assert.deepEqual([칸.첫빨강sha, 칸.첫빨강제목, 칸.회수, 칸.첫빨강확실], ['aaaaaaaaa1', '커밋 10', 100, true]);
  // 3시간 뒤 — 창이 밀려 창 맨 끝 run(70)이 첫 빨강처럼 보인다(확실 아님)
  const 뒤 = ci.알림계획(처음.새상태, 빨강(70, '2026-10-21T10:30:00Z', 'bbbbbbbbb7', false), t0 + 3 * 3600e3);
  assert.equal(뒤.글, null);
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

test('과거 검사의 복구로 첫 빨강 경계가 이동해도 같은 원인은 다시 알리지 않는다', () => {
  const t0 = Date.parse('2026-10-21T08:10:00Z');
  const 빨강 = (첫run, 확실) => ({ 상태: '빨강', 확인시각: '', 워크플로: [{ 워크플로: 'syntax-check', 상태: '빨강', 회수: 50, 첫빨강확실: 확실,
    첫빨강: { run: 첫run, sha: 'aaaaaaaaa1', 제목: '첫', 시각: '2026-10-21T08:05:00Z' }, 최신: { run: 999, 시각: '2026-10-21T08:05:00Z', url: 'u' }, 자세히: { 시험: [], 시험수: 0, 단계: [] } }] });
  const 처음 = ci.알림계획(null, 빨강(10, true), t0);
  const 뒤 = ci.알림계획(처음.새상태, 빨강(60, false), t0 + 3 * 3600e3);
  assert.equal(뒤.글, null);
  const 경계이동 = ci.알림계획(뒤.새상태, 빨강(70, true), t0 + 4 * 3600e3);
  assert.equal(경계이동.글, null);
});

test('기존 빨강 상태는 재전송 없이 이관하고 로그 위치 줄 이동도 같은 시험으로 본다', () => {
  const now = Date.parse('2026-11-02T00:00:00Z');
  const current = ci.판정하기([run(10, 'failure', '2026-11-01T23:00:00Z')]);
  current[0].자세히 = ci.실패읽기(로그);
  const old = { 워크플로: { 'syntax-check': { 상태: '빨강', 첫빨강run: 1, 첫빨강시각: '2026-11-01T20:00:00Z', 최신run: 9 } } };
  const migrated = ci.알림계획(old, { 워크플로: current }, now);
  assert.equal(migrated.글, null);
  current[0].자세히 = ci.실패읽기(로그.replaceAll('test.js:356', 'test.js:999'));
  assert.equal(ci.알림계획(migrated.새상태, { 워크플로: current }, now + 86400000).글, null);
  current[0].자세히 = { 로그못읽음: 'network', 시험: [], 단계: [] };
  const unreadable = ci.알림계획(migrated.새상태, { 워크플로: current }, now + 2 * 86400000);
  assert.equal(unreadable.글, null);
  assert.deepEqual(unreadable.새상태.워크플로['syntax-check'].알린실패, migrated.새상태.워크플로['syntax-check'].알린실패);
});

test('본문에 다섯 개만 표시해도 여섯 번째 새 실패를 감지하고 같은 묶음은 다시 보내지 않는다', () => {
  const logs = tail => [...Array.from({ length: 5 }, (_, i) => `known-${i}`), tail]
    .map((name, i) => `not ok ${i + 1} - ${name}\n  ---\n  location: '/repo/SYNK-appsscript/tests/a.js:${i + 1}:1'\n  ...`).join('\n');
  const current = tail => ({ 워크플로: [{ 워크플로: 'syntax-check', 상태: '빨강', 회수: 2, 첫빨강확실: true,
    첫빨강: { run: 1, 시각: '2026-11-01T20:00:00Z' }, 최신: { run: 2, 시각: '2026-11-01T21:00:00Z' }, 자세히: ci.실패읽기(logs(tail)) }] });
  const first = ci.알림계획(null, current('old-sixth'));
  const changed = ci.알림계획(first.새상태, current('new-sixth'));
  assert.match(changed.글, /새 실패/);
  assert.equal(ci.알림계획(changed.새상태, current('new-sixth')).글, null);
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

// ── 연속 구간의 작업별 읽기(11-08) ─────────────────────────────────────────────
// conditional-qa 「적어도 14회 연속」 아래에 최신 빨강 run 하나의 Windows 단계만 보여 「Windows 14회 연속」으로 읽혔다.
// 실제로는 13회가 local-coverage였고 Windows는 한 번이었다.
const 단계식별자 = (s) => require('node:crypto').createHash('sha256').update(`step:${s}`).digest('hex');
const 섞인표 = { 6: [윈도], 5: [로컬], 4: [로컬], 3: [로컬, 리눅스] };
const 섞인runs = [조건부run(6, 'failure', '2026-11-07T18:15:21Z'), 조건부run(5, 'failure', '2026-11-07T17:35:55Z'),
  조건부run(4, 'failure', '2026-11-07T17:27:15Z'), 조건부run(3, 'failure', '2026-11-07T17:09:57Z'), 조건부run(2, 'success', '2026-11-07T16:00:00Z')];
const 섞인가짜 = (덧 = {}) => 가짜({ runs: 섞인runs, jobs: (id) => 조건부jobs(섞인표[id] || []),
  로그글: (id) => 조건부로그(섞인표[id] || [], { 로컬시험: id === 3 }), ...덧 });
const 본run = (부름) => 부름.filter((c) => c.startsWith('gh run view')).map((c) => Number(c.split(' ')[3]));

test('연속 구간 안에서 run마다 깨진 작업이 다르면 작업별 횟수 · 최근 빨강 run을 보이고, 깨진 시험 · 단계는 작업마다 그 run에서 읽는다(11-08)', () => {
  const r = ci.지금읽기({ sh: 섞인가짜().sh, 파일들: [] });
  const [w] = r.워크플로;
  assert.deepEqual([w.워크플로, w.회수, w.최신.run], ['conditional-qa', 4, 6]);
  assert.deepEqual(w.작업별.작업.map((x) => [x.이름, x.회수, x.최신.run]), [[로컬, 3, 5], [윈도, 1, 6], [리눅스, 1, 3]],
    '횟수가 많은 작업부터, 같으면 최근 것부터');
  assert.equal(w.작업별.모름, 0);
  const 자세히 = Object.fromEntries(w.작업별.작업.map((x) => [x.이름, x.자세히]));
  assert.deepEqual(자세히[로컬].단계, [로컬단계], 'local-coverage는 자기 최근 빨강 run 5의 단계');
  assert.deepEqual(자세히[윈도].단계, [윈도단계]);
  assert.deepEqual(자세히[리눅스].시험.map((t) => [t.이름, t.위치]), [['리눅스에서만 깨진 시험', 'tests/리눅스.test.js:7']],
    '같은 run 3 로그의 local-coverage 줄(로컬 작업 줄의 시험)은 리눅스 작업에 섞지 않는다');

  const 글 = ci.상태글(r);
  assert.match(글, /conditional-qa: 4회 연속 빨강/);
  assert.match(글, /깨진 작업\(빨강 run 4개를 run마다 셈\): local-coverage 3회\(최근 0005aaaaa\) · hosted \(windows-latest, windows\) 1회\(0006aaaaa\) · hosted \(ubuntu-24\.04, linux\) 1회\(0003aaaaa\)/);
  assert.match(글, /▸ local-coverage — 최근 빨강 11-08 02:35 0005aaaaa 「커밋 5」\n {4}깨진 단계: check the exact commit's complete local result\n {4}run: https:\/\/github\.com\/o\/r\/actions\/runs\/5/);
  assert.match(글, /▸ hosted \(windows-latest, windows\) — 최근 빨강 11-08 03:15 0006aaaaa 「커밋 6」\n {4}깨진 단계: verify exact registered cases, with no skips/);
  assert.match(글, /▸ hosted \(ubuntu-24\.04, linux\) — .*\n {4}깨진 시험: tests\/리눅스\.test\.js:7 — 리눅스에서만 깨진 시험/);
  assert.doesNotMatch(글, /로컬 작업 줄의 시험/);

  // 알림 식별자는 그대로 최신 빨강 run 하나(run 6)의 것이다 — 작업별 읽기로 새 실패 알림이 늘지 않는다
  assert.deepEqual(w.자세히.단계, [윈도단계]);
  assert.deepEqual(ci.알림계획(null, r).새상태.워크플로['conditional-qa'].알린실패, [단계식별자(윈도단계)]);
});

test('최신 빨강 뒤 run이 모두 취소면 그 수를 밝히고, 취소 run은 읽지 않으며, 작업마다 자기 최근 빨강 run에서 읽는다(11-08)', () => {
  const 표 = { 6: [윈도], 5: [로컬], 4: [로컬] };
  const runs = [조건부run(10, null, '2026-11-07T20:43:00Z'), 조건부run(9, 'cancelled', '2026-11-07T20:38:10Z'), 조건부run(8, 'cancelled', '2026-11-07T20:31:58Z'),
    조건부run(7, 'cancelled', '2026-11-07T20:25:33Z'), 조건부run(6, 'failure', '2026-11-07T18:15:21Z'), 조건부run(5, 'failure', '2026-11-07T17:35:55Z'),
    조건부run(4, 'failure', '2026-11-07T17:27:15Z'), 조건부run(2, 'success', '2026-11-07T16:00:00Z')];
  const { sh, 부름 } = 가짜({ runs, jobs: (id) => 조건부jobs(표[id] || []), 로그글: (id) => 조건부로그(표[id] || []) });
  const r = ci.지금읽기({ sh, 파일들: [] });
  const [w] = r.워크플로;
  assert.deepEqual([w.최신.run, w.회수, w.뒤셈밖, w.도는중], [6, 3, 3, 1]);
  assert.deepEqual(본run(부름).filter((id) => id >= 7), [], '취소 · 도는 run은 작업을 읽지 않는다');
  assert.deepEqual(w.작업별.작업.map((x) => [x.이름, x.회수, x.최신.run]), [[로컬, 2, 5], [윈도, 1, 6]]);
  const 글 = ci.상태글(r);
  assert.match(글, /최신 빨강\(11-08 03:15 0006aaaaa\) 뒤 run 3개는 취소·건너뜀이라 셈에서 뺐다/);
  assert.match(글, /local-coverage 2회\(최근 0005aaaaa\) · hosted \(windows-latest, windows\) 1회\(0006aaaaa\)/);
  assert.match(글, /▸ local-coverage — .*\n {4}깨진 단계: check the exact commit's complete local result\n {4}run: \S+\/runs\/5\n/,
    'local-coverage의 깨진 단계는 최신 빨강 run 6이 아니라 그 작업의 최근 빨강 run 5에서');
  assert.match(글, /\(지금 도는·기다리는 run 1개/);
});

test('알림은 보낼 글이 있을 때만 작업별로 읽는다 — 글에는 작업별 횟수를 싣고, 바뀐 것 없는 회차는 최신 빨강 run만 읽는다(11-08)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_TG_DRYRUN_DIR: path.join(방, 'tg'), SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    const 지금ms = Date.parse('2026-11-07T18:50:00Z');
    assert.equal(ci.알림({ sh: 섞인가짜().sh, 파일들: [], 환경, 지금ms }).결과, '보냄');
    const 보낸글 = () => fs.readdirSync(환경.SYNK_TG_DRYRUN_DIR).sort().map((n) => fs.readFileSync(path.join(환경.SYNK_TG_DRYRUN_DIR, n), 'utf8'));
    assert.match(보낸글()[0], /깨진 작업\(빨강 run 4개를 run마다 셈\): local-coverage 3회\(최근 0005aaaaa\) · hosted \(windows-latest, windows\) 1회\(0006aaaaa\)/);
    assert.match(보낸글()[0], /▸ hosted \(windows-latest, windows\) — .*\n {4}깨진 단계: verify exact registered cases, with no skips/);
    const 상태 = JSON.parse(fs.readFileSync(환경.SYNK_CI빨간불_상태, 'utf8'));
    assert.deepEqual(상태.워크플로['conditional-qa'].알린실패, [단계식별자(윈도단계)], '상태 · 식별자는 작업별 읽기와 상관없다');
    assert.equal(상태.워크플로['conditional-qa'].작업별, undefined);

    const 둘째 = 섞인가짜();
    assert.equal(ci.알림({ sh: 둘째.sh, 파일들: [], 환경, 지금ms: 지금ms + 600e3 }).결과, '바뀐 것 없음');
    assert.deepEqual(본run(둘째.부름), [6, 6], '최신 빨강 run의 로그 · 작업 목록만');
    assert.equal(보낸글().length, 1);

    // 이미 알린 conditional-qa는 그대로이고 syntax-check만 새로 빨개지면, 작업별로는 syntax-check만 읽는다
    const 문법runs = [run(23, 'failure', '2026-11-07T19:30:00Z'), run(22, 'failure', '2026-11-07T19:20:00Z'), run(21, 'success', '2026-11-07T19:00:00Z')];
    const 셋째 = 가짜({ runs: [...섞인runs, ...문법runs], jobs: (id) => (id >= 20 ? 기본jobs : 조건부jobs(섞인표[id] || [])),
      로그글: (id) => (id >= 20 ? 로그 : 조건부로그(섞인표[id] || [], { 로컬시험: id === 3 })) });
    const r = ci.알림({ sh: 셋째.sh, 파일들: [], 환경, 지금ms: 지금ms + 3600e3 });
    assert.equal(r.결과, '보냄');
    assert.match(r.글, /syntax-check: 2회 연속 빨강[^]*깨진 작업\(빨강 run 2개를 run마다 셈\): check 2회\(최근 0023aaaaa\)/);
    assert.doesNotMatch(r.글, /conditional-qa/);
    assert.deepEqual(본run(셋째.부름).filter((id) => id < 20), [6, 6], 'conditional-qa는 알림 식별자용 최신 빨강 run만 — 옛 run 5 · 4 · 3은 안 읽는다');
    assert.deepEqual(본run(셋째.부름).filter((id) => id >= 20).sort(), [22, 23, 23], 'run 23은 로그 · 작업 목록, run 22는 작업 목록');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('알림 — 회차 시작 140초가 지나 작업을 더 못 읽어도 받아 둔 것으로 보내고 나머지는 「모름」(보내기 몫을 남긴다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci빨간불-'));
  try {
    const 환경 = { SYNK_TG_DRYRUN_DIR: path.join(방, 'tg'), SYNK_CI빨간불_상태: path.join(방, '상태.json') };
    let t = 0;
    const { sh, 부름 } = 섞인가짜({ 부를때: (cmd, args) => { if (args[1] === 'list') t += 200000; } }); // run 목록 읽기에 200초가 걸린 바쁜 PC
    const r = ci.알림({ sh, 파일들: [], 환경, 지금ms: Date.parse('2026-11-07T18:50:00Z'), 시계: () => t });
    assert.equal(r.결과, '보냄');
    assert.match(r.글, /hosted \(windows-latest, windows\) 1회\(0006aaaaa\) · 모름 3회\(시간 한도\)/, '최신 빨강 run의 작업 목록은 알림 식별자를 읽을 때 받아 두었다');
    assert.deepEqual(본run(부름), [6, 6]);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('작업 읽기는 최신부터 상한까지 · 시간 한도 안에서만 하고, 못 읽은 run은 까닭과 함께 「모름」으로 센다(11-08)', () => {
  const runs = [6, 5, 4, 3, 2].map((id, i) => run(id, 'failure', `2026-11-07T1${8 - i}:00:00Z`)).concat(run(1, 'success', '2026-11-07T12:00:00Z'));
  const 상한 = 가짜({ runs, jobs: (id) => (id === 4 ? null : 기본jobs) });
  const r = ci.지금읽기({ sh: 상한.sh, 파일들: [], 작업한도: { 상한: 3 } });
  assert.deepEqual([r.워크플로[0].작업별.모름, r.워크플로[0].작업별.모름까닭], [3, ['최신 3회까지만 읽음', 'HTTP 502: Server Error']]);
  assert.match(ci.상태글(r), /깨진 작업\(빨강 run 5개를 run마다 셈\): check 2회\(최근 0006aaaaa\) · 모름 3회\(최신 3회까지만 읽음 · HTTP 502: Server Error\)/);
  assert.match(ci.상태글(r), /▸ check — .*\n {4}깨진 시험: tests\/지면폰트\.test\.js:356 — ⑦ SUIT/, '깨진 시험은 그 작업의 로그 줄에서');
  assert.ok(!본run(상한.부름).some((id) => id <= 3), '상한 밖 run은 부르지 않는다');

  let t = 0;
  const 느림 = 가짜({ runs, 부를때: (cmd, args) => { if (args.includes('jobs')) t += 20000; } }); // 작업 목록 하나에 20초
  const r2 = ci.지금읽기({ sh: 느림.sh, 파일들: [], 시계: () => t, 작업한도: { ms: 30000 } });
  const 작업별 = r2.워크플로[0].작업별;
  assert.deepEqual([작업별.작업[0].회수, 작업별.모름, 작업별.모름까닭], [2, 3, ['시간 한도']]);
  assert.equal(느림.부름.filter((c) => c.includes('--json jobs')).length, 2, '마감이 지나면 더 부르지 않는다');
});

test('실행기.여럿 — 명령 여럿을 동시에 돌려 sh와 같은 꼴로 돌려준다(성공 · 종료 코드 · 없는 명령 · 명령 한도 · 전체 한도)', () => {
  const sh = ci.실행기(os.tmpdir());
  const node = process.execPath;
  const t0 = Date.now();
  const rs = sh.여럿([
    [node, ['-e', 'setTimeout(() => process.stdout.write("하나"), 400)']],
    [node, ['-e', 'setTimeout(() => process.stdout.write("둘"), 400)']],
    [node, ['-e', 'process.stderr.write("망가짐\\n둘째 줄"); process.exit(3)']],
    ['synk-없는-명령-xyz', []],
    [node, ['-e', 'setTimeout(() => {}, 8000)']],
  ], { timeout: 1500, 전체ms: 20000 });
  assert.deepEqual(rs.slice(0, 3), [{ ok: true, out: '하나' }, { ok: true, out: '둘' }, { ok: false, 사유: '망가짐' }]);
  assert.match(rs[3].사유, /^synk-없는-명령-xyz 실행 불가 \(ENOENT\)$/);
  assert.match(rs[4].사유, /실행 불가 \(ETIMEDOUT\)$/);
  assert.ok(Date.now() - t0 < 7000, '명령 한도에서 끊는다(8초 잠을 기다리지 않는다 — 바쁜 PC를 생각해 넉넉히)');
  assert.deepEqual(sh.여럿([[node, ['-e', 'setTimeout(() => {}, 3000)']]], { timeout: 20000, 전체ms: 500 }), [{ ok: false, 사유: '시간 한도' }]);
});
