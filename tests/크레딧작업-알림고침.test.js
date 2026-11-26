'use strict';
// 크레딧 작업 「알림고침」 — 후보 고르기, 사후의 갈래(모델 · 관문 · GPT · 격리 시험 · 올리기), 인자, 되돌림 멈춤, 올리기 lib.
// 공용 저장소 · 헤르메스 집은 임시 폴더다. 모델 · GPT · 바로올리기는 대역이고, 격리 시험은 실제로 돈다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const 알림고침 = require('../tools/크레딧작업/알림고침.js');
const 관문 = require('../tools/lib/알림고침관문.js');
const { 올리기 } = require('../tools/lib/알림고침올리기.js');
const { spawnSync } = require('node:child_process');

const 지금 = new Date('2026-11-27T00:30:00Z');   // KST 11-27 09:30
const 묶음 = 'event-' + 'a'.repeat(24);
const 원천 = ["const 파이썬 = 'p';", 'const 판단언제 = {};', 'const 설정 = {', '  permissions: { allow: [], deny: [] },', '};', 'function 줄(x) { return x.trim(); }',
  'module.exports = {', "  모델: 'claude-opus-5-5',", '  줄,', '  async 사전확인() { return { 할일: false }; },', '  인자() {', "    return ['-p'];", '  },', '};', ''].join('\n');
const 고친원천 = 원천.replace('return x.trim();', "return String(x ?? '').trim();");
const 새시험 = 'tests/알림고침-팁빈값.test.js';
const 새시험글 = "const test = require('node:test');\nconst assert = require('node:assert/strict');\ntest('빈 값도 넘긴다', () => assert.equal(require('../tools/크레딧작업/팁적용안.js').줄(undefined), ''));\n";
const 답 = (더 = {}) => ({ 글: JSON.stringify({ 결과: '고침', 원인: '빈 값에서 멈춘다', 전: '팁 적용안이 빈 값에서 멈췄어요', 후: '빈 값도 넘겨요', 무엇: '빈 값을 거르는 줄을 더함', 시험: '빈 값을 넣어 본다', ...더 }), 비용: 1.5 });

/** GPT 대역이 검수 폴더에 남기는 지적표(실제 검수묶음처럼). */
function 검수글(a) { fs.mkdirSync(a.폴더, { recursive: true }); fs.writeFileSync(path.join(a.폴더, '지적표.json'), JSON.stringify({ 지적: [] })); }
function g(cwd, ...a) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...a], { cwd, encoding: 'utf8' });
}
function 판(t, { 진단 = {}, 상태 = {} } = {}) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alertfix-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 공용 = path.join(뿌리, '공용');
  const 쓰기 = (곳, p, s) => { fs.mkdirSync(path.dirname(path.join(곳, p)), { recursive: true }); fs.writeFileSync(path.join(곳, p), s); };
  fs.mkdirSync(공용);
  g(공용, 'init', '-q', '-b', 'master');
  g(공용, 'config', 'core.autocrlf', 'false');
  쓰기(공용, 'tools/크레딧작업/팁적용안.js', 원천);
  쓰기(공용, 'tools/크레딧작업/팁판단자료.js', 'module.exports = {};\n');
  쓰기(공용, 'tests/팁적용안.test.js', "require('node:test')('불러진다', () => require('../tools/크레딧작업/팁적용안.js'));\n");
  쓰기(공용, 'tests/크레딧실행.test.js', "require('node:test')('있다', () => {});\n");
  쓰기(공용, 'docs/현장노트/README.md', '# 현장 노트\n');
  g(공용, 'add', '-A');
  g(공용, 'commit', '-qm', 'base');
  g(공용, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
  const 집 = path.join(뿌리, 'hermes'), 자동 = path.join(집, 'runtime/synk-automation');
  fs.mkdirSync(path.join(자동, 'diagnosis'), { recursive: true });
  fs.writeFileSync(path.join(자동, 'state.json'), JSON.stringify({ checkedAt: new Date(+지금 - 5 * 60000).toISOString(),
    attentionObserved: { 'tip-worker': 'inc1' }, attentionIncidents: { 'tip-worker': { id: 'inc1', fingerprint: 'f' } },
    observed: { 'tip-worker': { title: '팁 적용안 처리 · 실패', detail: '최근 실행 실패 · 현재 인증 미조회' } }, ...상태 }));
  fs.writeFileSync(path.join(자동, 'diagnosis', 묶음 + '.json'), JSON.stringify({ version: 1, id: 묶음,
    items: [{ id: 'tip-worker', 사건: 'inc1', 원인: '빈 값에서 멈춘다', 해결: '빈 값을 거른다', 상태: '확인 필요', 고칠수있음: true, ...진단 }] }));
  const 고침방 = path.join(자동, 'fixes');
  const 부름 = { gpt: [], 올리기: [], 자리: 0, 놓기: 0 };
  const 만들기 = (옵션 = {}) => 알림고침.만들기({ 집고정: 집, 지금고정: 지금, 공용고정: 공용, 뿌리고정: path.join(뿌리, '시도'), 받기: false,
    GPT고정: (a) => { 부름.gpt.push(a); 검수글(a); return { 받음: true, P0P1: 0, 셈: { P0: 0, P1: 0, P2: 1, P3: 0 }, 이름: a.이름, 지적: [] }; },
    올리기고정: (a) => { 부름.올리기.push(a); return { 결과: '올림', 커밋: 'c'.repeat(40), 바이트같음: true }; },
    자리고정: () => { 부름.자리++; return { 번호: 0, 수: 2, 놓기: () => { 부름.놓기++; } }; }, ...옵션 });
  const 기록 = () => 알림고침.기록들(고침방);
  return { 뿌리, 공용, 집, 자동, 고침방, 쓰기, 부름, 만들기, 기록 };
}
const 고르기 = (f, 때 = 지금) => 알림고침.후보고르기({ 집: f.집, 지금: 때, 고침방: f.고침방, 공용: f.공용 });

test('후보: 진단이 고칠 수 있다고 했고 종류 표에 있고 지금도 같은 사건이 열린 것 하나', (t) => {
  const f = 판(t);
  const r = 고르기(f);
  assert.equal(r.후보?.종류id, 'tip-worker', r.이유);
  assert.equal(r.후보.사건, 'inc1');
  assert.match(r.후보.제목, /팁 적용안 처리 · 실패/);
});

for (const [이름, 바꾸기, 까닭] of [
  ['꺼둠', (f) => { fs.mkdirSync(f.고침방, { recursive: true }); fs.writeFileSync(path.join(f.고침방, '꺼둠'), ''); }, /꺼둠/],
  ['멈춤', (f) => { fs.mkdirSync(f.고침방, { recursive: true }); fs.writeFileSync(path.join(f.고침방, '멈춤.json'), '{}'); }, /멈춤/],
  ['오래된 감시 상태', (f) => { const s = JSON.parse(fs.readFileSync(path.join(f.자동, 'state.json'), 'utf8')); s.checkedAt = new Date(+지금 - 3600000).toISOString(); fs.writeFileSync(path.join(f.자동, 'state.json'), JSON.stringify(s)); }, /오래됐다/],
  ['고칠 수 없다는 진단', (f) => { const p = path.join(f.자동, 'diagnosis', 묶음 + '.json'); const v = JSON.parse(fs.readFileSync(p, 'utf8')); v.items[0].고칠수있음 = false; fs.writeFileSync(p, JSON.stringify(v)); }, /후보 없음/],
  ['종류 표에 없는 사건', (f) => { const p = path.join(f.자동, 'diagnosis', 묶음 + '.json'); const v = JSON.parse(fs.readFileSync(p, 'utf8')); v.items[0].id = 'ops-copy-task'; fs.writeFileSync(p, JSON.stringify(v)); }, /후보 없음/],
  ['그사이 새 사건', (f) => { const s = JSON.parse(fs.readFileSync(path.join(f.자동, 'state.json'), 'utf8')); s.attentionIncidents['tip-worker'].id = 'inc2'; fs.writeFileSync(path.join(f.자동, 'state.json'), JSON.stringify(s)); }, /후보 없음/],
  ['이미 풀림', (f) => { const s = JSON.parse(fs.readFileSync(path.join(f.자동, 'state.json'), 'utf8')); delete s.attentionObserved['tip-worker']; fs.writeFileSync(path.join(f.자동, 'state.json'), JSON.stringify(s)); }, /후보 없음/],
  ['같은 사건을 이미 해 봄', (f) => { fs.mkdirSync(path.join(f.고침방, '202611250930-aaaaaa'), { recursive: true }); fs.writeFileSync(path.join(f.고침방, '202611250930-aaaaaa', '기록.json'), JSON.stringify({ version: 1, 종류: 'tip-worker', 사건: 'inc1', 시작: '2026-11-25T00:30:00Z', 상태: '못 고침', 끝: '2026-11-25T01:00:00Z' })); }, /후보 없음/],
  ['오늘 이미 함', (f) => { fs.mkdirSync(path.join(f.고침방, '202611270800-bbbbbb'), { recursive: true }); fs.writeFileSync(path.join(f.고침방, '202611270800-bbbbbb', '기록.json'), JSON.stringify({ version: 1, 종류: 'x', 사건: 'z', 시작: '2026-11-26T23:00:00Z', 상태: '못 고침', 끝: '2026-11-26T23:30:00Z' })); }, /오늘은 이미/],
  ['올린 종류는 7일 쉰다', (f) => { fs.mkdirSync(path.join(f.고침방, '202611230930-cccccc'), { recursive: true }); fs.writeFileSync(path.join(f.고침방, '202611230930-cccccc', '기록.json'), JSON.stringify({ version: 1, 종류: 'tip-worker', 사건: 'inc0', 시작: '2026-11-23T00:30:00Z', 상태: '올림', 끝: '2026-11-23T01:30:00Z' })); }, /후보 없음/],
  ['누가 그 파일을 고치는 중', (f) => f.쓰기(f.공용, 'tools/크레딧작업/팁적용안.js', 원천 + '// 고치는 중\n'), /고치는 중이거나/],
]) {
  test(`후보: ${이름}이면 고르지 않는다`, (t) => {
    const f = 판(t);
    바꾸기(f);
    const r = 고르기(f);
    assert.equal(r.후보, undefined);
    assert.match(r.이유, 까닭);
  });
}

test('인자: 파일 도구만, 고치기는 그 종류의 원천과 새 시험 자리만, 명령 · 웹 · 설정 · MCP 없음, 크레딧 상한', () => {
  const 작업 = 알림고침.만들기();
  const 인자 = 작업.인자({ 자료: { 사본: 'C:\\x\\시도\\repo', 후보: { 종류id: 'tip-worker' } } });
  const 값 = (k) => 인자[인자.indexOf(k) + 1];
  assert.ok(인자.includes('--restricted') && 인자.includes('--safe-mode') && 인자.includes('--strict-mcp-config') && 인자.includes('--disable-slash-commands'));
  assert.equal(값('--tools'), 'Read,Glob,Grep,Edit,Write');
  assert.equal(값('--permission-mode'), 'dontAsk');
  assert.equal(값('--setting-sources'), '');
  assert.equal(값('--max-budget-usd'), '6');
  assert.equal(값('--model'), 'claude-opus-5-5');
  const 설정 = JSON.parse(값('--settings'));
  assert.deepEqual(설정.permissions.allow, ['Edit(//c/x/시도/repo/tools/크레딧작업/팁적용안.js)', 'Edit(//c/x/시도/repo/tools/크레딧작업/팁판단자료.js)',
    'Edit(//c/x/시도/repo/tests/알림고침-팁*.test.js)', 'Write(//c/x/시도/repo/tests/알림고침-팁*.test.js)']);
  for (const 막을 of ['Bash', 'PowerShell', 'WebFetch', 'WebSearch', 'Task', 'Agent']) assert.ok(설정.permissions.deny.includes(막을), 막을);
  assert.equal(작업.구독대체, false, '구독으로 새지 않는다');
});

test('사후: 고치고 GPT가 먼저 읽고 격리 시험(고치기 전 깨짐 → 고친 뒤 통과)을 지나면 올린다', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기();
  const 자료 = await 작업.사전확인({});
  assert.ok(자료.사본 && fs.existsSync(path.join(자료.사본, 'tools/크레딧작업/팁적용안.js')), 자료.이유);
  assert.equal(자료.작업폴더, 자료.사본, '모델은 사본에서 돈다');
  assert.equal(g(자료.사본, 'remote').trim(), '', '사본에는 remote가 없다');
  assert.equal(f.기록()[0].상태, '도는 중', '띄우기 전에 적는다');
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.equal(r.상태, '올림', r.까닭);
  const 기록 = f.기록()[0];
  assert.deepEqual([기록.전새.시험, 기록.전새.실패 > 0, 기록.후시험.통과, 기록.후시험.실패], [1, true, 기록.후시험.시험, 0]);
  assert.equal(기록.전시험.통과함, true, '고치기 전 그 종류의 시험은 통과한다');
  assert.deepEqual([기록.커밋, 기록.바이트같음, 기록.셈.파일], ['c'.repeat(40), true, 2]);
  assert.match(기록.전, /빈 값에서 멈췄어요/);
  assert.equal(f.부름.gpt.length, 1);
  assert.deepEqual(f.부름.gpt[0].경로들.sort(), ['tools/크레딧작업/팁적용안.js', 새시험].sort());
  assert.deepEqual([f.부름.자리, f.부름.놓기], [1, 1], '시험 자리를 잡고 놓는다');
  const 올 = f.부름.올리기[0];
  assert.deepEqual([올.원천, 올.새시험], [['tools/크레딧작업/팁적용안.js'], [새시험]]);
  assert.match(올.메시지, /^알림 고침\(무인\): 팁 적용안 처리 · 실패 — 빈 값을 거르는 줄을 더함/);
  assert.match(올.메시지, /새 시험 1개가 고치기 전 1개 실패 → 고친 뒤 \d+\/\d+ 통과/);
  assert.match(올.메시지, /Co-Authored-By: Claude Opus 5\.5/);
  assert.ok(fs.existsSync(path.join(f.고침방, 기록.id, 'patch.diff')), '고침안이 남는다');
  assert.equal(fs.existsSync(자료.사본), false, '사본은 지운다');
});

test('사후: GPT 검수를 받지 못하면(한도 생략 · 막힘) 모델이 쓴 코드를 돌리지 않고 올리지 않는다', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기({ GPT고정: () => ({ 받음: false, 이유: 'GPT 검수 A 묶음을 받지 못했다(생략)' }) });
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.equal(r.상태, '못 고침');
  assert.match(r.까닭, /검수: GPT 검수 A 묶음을 받지 못했다/);
  assert.deepEqual([f.부름.자리, f.부름.올리기.length, f.기록()[0].전시험], [0, 0, undefined], '시험도 올리기도 없다');
});

test('사후: GPT P0·P1이면 올리지 않고 그 지적을 남긴다', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기({ GPT고정: (a) => { 검수글(a); return { 받음: true, P0P1: 1, 셈: { P0: 0, P1: 1, P2: 0, P3: 0 }, 이름: a.이름, 지적: ['P1 tools/크레딧작업/팁적용안.js:1 빈 값이 아닌 것도 삼킨다'] }; } });
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.match(r.까닭, /GPT 검수 P0·P1 1건 — P1 tools/);
  assert.deepEqual([f.부름.자리, f.부름.올리기.length], [0, 0]);
});

test('사후: 새 시험이 고치기 전에도 통과하면(헛시험) 올리지 않는다', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기();
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, "const test = require('node:test');\ntest('늘 통과', () => {});\n");
  const r = await 작업.사후(답(), 자료);
  assert.match(r.까닭, /새 시험이 고치기 전 코드에서도 통과한다/);
  assert.deepEqual([f.부름.놓기, f.부름.올리기.length], [1, 0]);
});

test('사후: 관문에 걸리거나 모델이 못 고쳤다고 하면 GPT도 부르지 않는다', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기();
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 'tests/팁적용안.test.js', "require('node:test')('바꿈', () => {});\n");
  f.쓰기(자료.사본, 새시험, 새시험글);
  assert.match((await 작업.사후(답(), 자료)).까닭, /관문: 고칠 수 없는 파일이다: tests\/팁적용안\.test\.js/);
  const g2 = 판(t), 작업2 = g2.만들기(), 자료2 = await 작업2.사전확인({});
  const r2 = await 작업2.사후(답({ 결과: '유호님 차례' }), 자료2);
  assert.match(r2.까닭, /유호님 차례/);
  assert.deepEqual([f.부름.gpt.length, g2.부름.gpt.length], [0, 0]);
});

test('사전확인: 올린 고침이 되돌려졌으면 멈추고, 오래 도는 중인 기록은 끊김으로 닫는다', async (t) => {
  const f = 판(t);
  f.쓰기(f.공용, 'tools/크레딧작업/팁적용안.js', 고친원천);
  g(f.공용, 'commit', '-qam', '알림 고침(무인): x');
  const 커밋 = g(f.공용, 'rev-parse', 'HEAD').trim();
  g(f.공용, 'revert', '--no-edit', 'HEAD');
  g(f.공용, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
  for (const [id, 값] of [['202611200930-dddddd', { 상태: '올림', 커밋, 끝: '2026-11-20T01:00:00Z' }], ['202611270100-eeeeee', { 상태: '도는 중', 종류: 'x', 사건: 'y', 시작: '2026-11-26T15:00:00Z' }]]) {
    fs.mkdirSync(path.join(f.고침방, id), { recursive: true });
    fs.writeFileSync(path.join(f.고침방, id, '기록.json'), JSON.stringify({ version: 1, 종류: 'tip-worker', 사건: 'old', 시작: '2026-11-20T00:30:00Z', ...값 }));
  }
  const r = await f.만들기().사전확인({});
  assert.equal(r.할일, false);
  assert.match(r.이유, /되돌려져 멈췄다/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.고침방, '멈춤.json'), 'utf8')).커밋, 커밋);
  assert.equal(f.기록().find((x) => x.id === '202611270100-eeeeee').상태, '끊김');
});

/** 올리기 판 — 공용(가짜 origin ref)과 고친 사본, 바로올리기 미리 보기 대역, push 대역. */
function 올리기판(t) {
  const f = 판(t);
  const 시도 = path.join(f.뿌리, '시도-올리기'), 사본 = path.join(시도, 'repo');
  fs.mkdirSync(시도, { recursive: true });
  g(시도, 'clone', '-q', '--shared', f.공용, 사본);
  g(사본, 'config', 'core.autocrlf', 'false');
  const 바탕 = g(사본, 'rev-parse', 'HEAD').trim();
  f.쓰기(사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(사본, 새시험, 새시험글);
  관문.바뀐것(사본, 바탕);
  const 후blob = 관문.blob들(사본, ['tools/크레딧작업/팁적용안.js', 새시험]);
  const 바탕blob = { 'tools/크레딧작업/팁적용안.js': g(사본, 'rev-parse', `${바탕}:tools/크레딧작업/팁적용안.js`).trim() };
  const 원격 = () => g(f.공용, 'rev-parse', 'refs/remotes/origin/master').trim();
  // 남이 origin에 올린다(공용의 작업본과 별개로 커밋만 짓는다)
  const 남이올림 = (경로, 내용) => {
    const 임시 = path.join(f.뿌리, `남-${Math.random().toString(16).slice(2)}`);
    g(f.공용, 'worktree', 'add', '-q', '--detach', 임시, 원격());   // 공용 저장소의 작업본
    f.쓰기(임시, 경로, 내용);
    g(임시, 'add', '-A');
    g(임시, 'commit', '-qm', '남의 커밋');
    g(f.공용, 'update-ref', 'refs/remotes/origin/master', g(임시, 'rev-parse', 'HEAD').trim());
    g(f.공용, 'worktree', 'remove', '--force', 임시);
  };
  const 부름 = { 미리: 0, 밀기: 0 };
  // 바로올리기 미리 보기 대역 — 작업본의 바뀐 경로를 커밋 글로 커밋해 머리를 돌려준다(더: 판에 덧붙일 칸 또는 차례 → 칸, 앞일: 먼저 할 일)
  const 미리대역 = (더판 = {}, 앞일 = null) => (cmd, args) => {
    부름.미리++;
    if (앞일) 앞일(부름.미리);
    const 더 = typeof 더판 === 'function' ? 더판(부름.미리) : 더판;
    const 작업본 = args[args.indexOf('--저장소') + 1], 글파일 = args[args.indexOf('-F') + 1];
    const O = g(작업본, 'rev-parse', 'HEAD').trim();
    if (더.덧파일) f.쓰기(작업본, 더.덧파일, 'x\n');
    g(작업본, 'add', '-A', '--', 'tools', 'tests');
    g(작업본, 'commit', '-q', '-F', 글파일);
    const 머리 = g(작업본, 'rev-parse', 'HEAD').trim();
    const 판 = { 결과: '미리 보기', 바탕: O, 원격머리: 원격(), 머리, 공개: { 켜짐: true, 걸림: [] }, 용량: { 통과: true }, ...더 };
    delete 판.덧파일;
    for (const [k, v] of Object.entries(더)) if (v === undefined) delete 판[k];
    return { status: 0, stdout: JSON.stringify(판) };
  };
  // push 대역 — 빨리감기만 받는다(git push --porcelain의 출력 꼴). 먼저: 첫 push 앞에 남이 올린다(거절). 끝: 받은 뒤의 답을 바꾼다.
  const 밀기대역 = ({ 먼저 = null, 끝 = null } = {}) => (cwd, C) => {
    부름.밀기++;
    const 거절 = (왜) => ({ status: 1, 글: `To origin\n!\t${C}:refs/heads/master\t[rejected] (${왜})\nDone\n` });
    if (먼저 && 부름.밀기 === 1) { 먼저(); return 거절('fetch first'); }
    if (spawnSync('git', ['merge-base', '--is-ancestor', 원격(), C], { cwd: f.공용 }).status !== 0) return 거절('non-fast-forward');
    g(f.공용, 'update-ref', 'refs/remotes/origin/master', C);
    return 끝 || { status: 0, 글: `To origin\n \t${C}:refs/heads/master\tabc1234..def5678\nDone\n` };
  };
  const 기본 = { 공용: f.공용, 루트: f.공용, 사본, 시도폴더: 시도, 종류: 관문.종류표['tip-worker'], 원천: ['tools/크레딧작업/팁적용안.js'], 새시험: [새시험], 새시험자리: [`${새시험}:3:1`],
    바탕blob, 후blob, 메시지: '알림 고침(무인): x\n\n알림고침-id: 202611270930-abcdef\n', 받기: false,
    고르기: () => ({ 시험: ['tests/팁적용안.test.js'], 지도: 1 }) };
  return { f, 바탕, 원격, 남이올림, 부름, 미리대역, 밀기대역, 기본 };
}
const 부모 = (cwd, C) => g(cwd, 'rev-list', '--parents', '-n', '1', C).trim().split(/\s+/).slice(1);

test('올리기: 미리 보기가 지은 커밋을 그 판에서 시험하고 빨리감기로 민다 — 부모는 받은 origin 하나, 바뀐 경로는 우리 것뿐', (t) => {
  const o = 올리기판(t);
  const r = 올리기({ ...o.기본, 실행: o.미리대역(), 밀기: o.밀기대역() });
  assert.deepEqual([r.결과, r.바이트같음, r.차례], ['올림', true, 1], JSON.stringify(r));
  assert.equal(o.원격(), r.커밋);
  assert.deepEqual(부모(o.f.공용, r.커밋), [o.바탕]);
  assert.deepEqual(g(o.f.공용, '-c', 'core.quotepath=false', 'diff', '--name-only', o.바탕, r.커밋).trim().split('\n').sort(), ['tools/크레딧작업/팁적용안.js', 새시험].sort());
  assert.match(g(o.f.공용, 'log', '-1', '--format=%B', r.커밋), /알림고침-id: 202611270930-abcdef/, '커밋 글은 미리 보기가 검사한 그 글');
  assert.deepEqual([r.앞시험.파일, r.앞시험.시험 === r.앞시험.통과, r.앞시험.새시험, r.앞시험.새통과], [2, true, 1, 1], '종류 시험까지 · 새 시험은 따로');
  assert.doesNotMatch(g(o.f.공용, 'worktree', 'list'), /올리기/, '작업본을 치운다');
});

test('올리기: 원격이 움직여 거절되면 합치지 않고 같은 blob으로 새 바탕에서 다시 한다, 원천이 바뀌었으면 바탕 바뀜', (t) => {
  const o = 올리기판(t);
  const r = 올리기({ ...o.기본, 실행: o.미리대역(), 밀기: o.밀기대역({ 먼저: () => o.남이올림('docs/남.md', '남\n') }) });
  assert.deepEqual([r.결과, r.차례], ['올림', 2], JSON.stringify(r));
  const 새바탕 = 부모(o.f.공용, r.커밋)[0];
  assert.notEqual(새바탕, o.바탕);
  assert.equal(g(o.f.공용, 'show', `${r.커밋}:${새시험}`), 새시험글, '같은 바이트');
  const o2 = 올리기판(t);
  const 바뀜 = 올리기({ ...o2.기본, 실행: o2.미리대역(), 밀기: o2.밀기대역({ 먼저: () => o2.남이올림('tools/크레딧작업/팁적용안.js', 원천 + '// 남의 고침\n') }) });
  assert.deepEqual([바뀜.결과, 바뀜.다시], ['바탕 바뀜', true], JSON.stringify(바뀜));
  // 미리 보기가 받은 origin이 그새 움직였어도 다시 한다
  const o3 = 올리기판(t);
  const 그새 = 올리기({ ...o3.기본, 실행: o3.미리대역({}, (n) => { if (n === 1) o3.남이올림('docs/그새.md', 'x\n'); }), 밀기: o3.밀기대역() });
  assert.deepEqual([그새.결과, 그새.차례], ['올림', 2], JSON.stringify(그새));
});

test('올리기: push가 실패로 끝나도 origin이 그 커밋을 품으면 올림이다(GA12 · Fable v4 P1-4)', (t) => {
  const o = 올리기판(t);
  const r = 올리기({ ...o.기본, 실행: o.미리대역(), 밀기: o.밀기대역({ 끝: { status: 128, 글: 'fatal: the remote end hung up unexpectedly' } }) });
  assert.deepEqual([r.결과, r.커밋], ['올림', o.원격()], JSON.stringify(r));
});

test('올리기: 미리 보기가 조용히 넘긴 검사 · 다른 경로 · 지도 없음 · 깨진 관련 시험 · 도중의 꺼둠이면 밀지 않는다(Fable v4 P1-3 · P2-2 · r2 GA11)', (t) => {
  for (const [더, 까닭] of [[{ 공개: undefined }, /공개 검사/], [{ 용량: { 통과: false } }, /용량/], [{ 짝검사: { 수: 1, 못고름: 'x' } }, /짝 검사/],
    [{ 낡은곳: ['(낡은 곳을 보지 못했다: x)'] }, /낡은 곳/], [{ 주의: '관련 시험이 시간을 넘겼다' }, /주의/], [{ 덧파일: 'tools/덧.js' }, /다른 경로/]]) {
    const o = 올리기판(t);
    const r = 올리기({ ...o.기본, 실행: o.미리대역(더), 밀기: o.밀기대역() });
    assert.equal(r.결과, '못 올림', JSON.stringify(더));
    assert.match(r.이유, 까닭);
    assert.equal(o.부름.밀기, 0);
  }
  const o = 올리기판(t);
  assert.match(올리기({ ...o.기본, 고르기: () => ({ 시험: ['tests/팁적용안.test.js'], 지도: null }), 실행: o.미리대역(), 밀기: o.밀기대역() }).이유, /지도를 받지 못했다/);
  o.남이올림('tests/깨짐.test.js', "require('node:test')('깨짐', () => { throw new Error('x'); });\n");
  const 깨짐 = 올리기({ ...o.기본, 고르기: () => ({ 시험: ['tests/깨짐.test.js'], 지도: 1 }), 실행: o.미리대역(), 밀기: o.밀기대역() });
  assert.match(깨짐.이유, /올릴 판의 관련 시험 \d+\/\d+ · 깨짐/);
  assert.match(올리기({ ...o.기본, 멈출까: () => '꺼둠', 실행: o.미리대역(), 밀기: o.밀기대역() }).이유, /도중에 꺼둠/);
  assert.equal(o.부름.밀기, 0, '셋 모두 밀지 않았다');
});

test('올리기: 미리 보기의 줄끝 「변환됨」은 막지 않는다 — 바이트는 blob 대조가 본다(r3 GA1)', (t) => {
  const o = 올리기판(t);
  const r = 올리기({ ...o.기본, 실행: o.미리대역({ 수: [{ 경로: 'tools/크레딧작업/팁적용안.js', 더함: 1, 뺌: 1, 변환됨: true }], 줄끝고침: ['tools/크레딧작업/팁적용안.js'] }), 밀기: o.밀기대역() });
  assert.equal(r.결과, '올림', JSON.stringify(r));
});

test('올리기: 미리 보기가 새 origin과 겹쳐 멈춰도 새 바탕에서 다시 하고, 그 판에서 멈춘 검사는 고침 탓이다(r3 GA2 · Fable v4.1 P2-3)', (t) => {
  const o = 올리기판(t);
  const 겹침 = (n) => (n === 1 ? { 결과: '멈춤', 이유: 'origin 위에 얹지 못한 경로가 있다', 문제: ['겹침'] } : {});
  const r = 올리기({ ...o.기본, 실행: o.미리대역(겹침, (n) => { if (n === 1) o.남이올림('docs/겹침.md', 'x\n'); }), 밀기: o.밀기대역() });
  assert.deepEqual([r.결과, r.차례], ['올림', 2], JSON.stringify(r));
  const o2 = 올리기판(t);
  const 걸림 = 올리기({ ...o2.기본, 실행: o2.미리대역({ 결과: '멈춤', 이유: '공개 검사에 걸렸다', 문제: ['비밀값'] }), 밀기: o2.밀기대역() });
  assert.deepEqual([걸림.결과, 걸림.다시], ['못 올림', undefined], '고침 탓은 다시 하지 않는다');
  const o3 = 올리기판(t);
  const 무응답 = 올리기({ ...o3.기본, 실행: () => ({ status: null, stdout: '', error: { code: 'ETIMEDOUT' } }), 밀기: o3.밀기대역() });
  assert.deepEqual([무응답.결과, 무응답.다시], ['못 올림', true], '미리 보기가 답하지 않으면 다음 날 다시');
  assert.match(무응답.이유, /답하지 않았다\(종료 ETIMEDOUT\)/);
  assert.equal(o.부름.밀기 + o2.부름.밀기 + o3.부름.밀기, 1);
});

test('올리기: 종류 시험이든 고른 시험이든 그 판에 없으면 시험하지 않고 다시로 끝낸다(r3 GA3 · GA7)', (t) => {
  const o = 올리기판(t);
  const r = 올리기({ ...o.기본, 고르기: () => ({ 시험: ['tests/지워짐.test.js'], 지도: 1 }), 실행: o.미리대역(), 밀기: o.밀기대역() });
  assert.deepEqual([r.결과, r.다시], ['못 올림', true]);
  assert.match(r.이유, /시험 파일이 없다: tests\/지워짐\.test\.js/);
  const 종류 = { ...관문.종류표['tip-worker'], 시험: ['tests/팁적용안.test.js', 'tests/이름바뀜.test.js'] };
  assert.match(올리기({ ...o.기본, 종류, 실행: o.미리대역(), 밀기: o.밀기대역() }).이유, /시험 파일이 없다: tests\/이름바뀜\.test\.js/);
  assert.equal(o.부름.밀기, 0);
});

test('올리기: 기록에 C를 적은 뒤에만 밀고, push가 C를 받았다고 답하면 확인 받기가 안 돼도 올림이다(r3 GA4 · GA10)', (t) => {
  const o = 올리기판(t);
  const 순서 = [];
  const r = 올리기({ ...o.기본, 실행: o.미리대역(), 밀기전: (C) => { 순서.push(`적기 ${C.slice(0, 7)}`); },
    밀기: (cwd, C) => { 순서.push(`밀기 ${C.slice(0, 7)}`); return { status: 0, 글: `To origin\n \t${C}:refs/heads/master\tabc1234..def5678\nDone\n` }; } });
  assert.deepEqual([r.결과, 순서.length, 순서[0].replace('적기', '밀기') === 순서[1]], ['올림', 2, true], JSON.stringify({ r, 순서 }));
  assert.notEqual(o.원격(), r.커밋, '추적 ref는 그대로인데도');
  const o2 = 올리기판(t);
  const 못적음 = 올리기({ ...o2.기본, 실행: o2.미리대역(), 밀기전: () => { throw new Error('디스크'); }, 밀기: o2.밀기대역() });
  assert.deepEqual([못적음.결과, 못적음.다시, o2.부름.밀기], ['못 올림', true, 0]);
  assert.match(못적음.이유, /기록에 적지 못해 밀지 않았다/);
});

test('올리기: 서버가 거절한 push는 원격이 움직인 것이 아니라 되풀지 않는다(Fable v4.1 P3-3)', (t) => {
  const o = 올리기판(t);
  let n = 0;
  const r = 올리기({ ...o.기본, 실행: o.미리대역(), 밀기: (cwd, C) => { n++; return { status: 1, 글: `To origin\n!\t${C}:refs/heads/master\t[remote rejected] (pre-receive hook declined)\nDone\n` }; } });
  assert.deepEqual([r.결과, r.다시, n], ['못 올림', true, 1], JSON.stringify(r));
  assert.match(r.이유, /push가 실패했다\(종료 1\)/);
});

test('올리기: 작업 마감이 지나면 시험을 통과했어도 밀지 않는다, 75분은 새 차례에만 쓴다(r3 GA6 · Fable v4.1 P2-2)', (t) => {
  const o = 올리기판(t);
  let 늦음 = false;
  const r = 올리기({ ...o.기본, 실행: o.미리대역(), 밀기: o.밀기대역(), 마감: 1e12, 시계: () => (늦음 ? 1e15 : 0),
    자리잡기: () => ({ 번호: 0, 놓기: () => { 늦음 = true; } }) });
  assert.deepEqual([r.결과, r.다시, o.부름.밀기], ['못 올림', true, 0], JSON.stringify(r));
  assert.match(r.이유, /작업 마감을 넘겨 밀지 않았다/);
  // 첫 차례가 전체 한도를 넘겨도 원격이 가만하면 민다
  const o2 = 올리기판(t);
  let 지금ms = 0;
  const 느림 = 올리기({ ...o2.기본, 실행: o2.미리대역(), 밀기: o2.밀기대역(), 전체한도ms: 60000, 시계: () => (지금ms += 50000) });
  assert.equal(느림.결과, '올림', JSON.stringify(느림));
  const o3 = 올리기판(t);
  assert.match(올리기({ ...o3.기본, 실행: o3.미리대역(), 밀기: o3.밀기대역(), 마감: 30000, 시계: () => 0 }).이유, /마감이 가까워 시험을 시작하지 않았다/);
});

test('올리기: 올릴 판에서 돈 새 시험의 자리가 격리 사본에서 돈 자리와 다르면 밀지 않는다(r4 GA8)', (t) => {
  const o = 올리기판(t);
  const r = 올리기({ ...o.기본, 새시험자리: [`${새시험}:9:9`], 실행: o.미리대역(), 밀기: o.밀기대역() });
  assert.deepEqual([r.결과, r.다시, o.부름.밀기], ['못 올림', undefined, 0]);
  assert.match(r.이유, /자리가 격리 사본에서 돈 자리와 다르다/);
});

test('올리기: 시험 경로가 디렉터리면 없는 것으로 보고, 기록을 쓰는 사이 마감이 지나면 밀지 않고, 시험 자리를 기다린 뒤 남은 시간을 다시 잰다(r4 GA5 · GA7 · GA2 · GA3)', (t) => {
  const o = 올리기판(t);
  o.남이올림('tests/디렉터리.test.js/안.md', 'x\n');
  const 폴더 = 올리기({ ...o.기본, 고르기: () => ({ 시험: ['tests/디렉터리.test.js'], 지도: 1 }), 실행: o.미리대역(), 밀기: o.밀기대역() });
  assert.deepEqual([폴더.결과, 폴더.다시], ['못 올림', true], JSON.stringify(폴더));
  assert.match(폴더.이유, /시험 파일이 없다: tests\/디렉터리\.test\.js/);
  const o2 = 올리기판(t);
  let 늦음 = false;
  const 마감 = 올리기({ ...o2.기본, 실행: o2.미리대역(), 밀기: o2.밀기대역(), 마감: 1e12, 시계: () => (늦음 ? 1e15 : 0), 밀기전: () => { 늦음 = true; } });
  assert.deepEqual([마감.결과, 마감.다시, o2.부름.밀기], ['못 올림', true, 0], JSON.stringify(마감));
  assert.match(마감.이유, /작업 마감을 넘겨 밀지 않았다/);
  const o3 = 올리기판(t);
  let 받음 = false;
  const 자리늦음 = 올리기({ ...o3.기본, 실행: o3.미리대역(), 밀기: o3.밀기대역(), 마감: 1e12, 시계: () => (받음 ? 1e12 - 30000 : 0),
    자리잡기: () => { 받음 = true; return { 번호: 0, 놓기: () => {} }; } });
  assert.deepEqual([자리늦음.결과, 자리늦음.다시, o3.부름.밀기], ['못 올림', true, 0], JSON.stringify(자리늦음));
  assert.match(자리늦음.이유, /마감이 가까워 시험을 시작하지 않았다/);
  assert.equal(o.부름.밀기, 0);
});

test('올리기: 관련 시험이 도는 사이 마감이 다가오면 새 시험을 시작하지 않고, 앞시험에는 그 차례의 셈만 적는다(r5 GA4 · GA3)', (t) => {
  // 관련 시험이 돌면 표시 파일을 남긴다 — 시계 대역이 그 뒤로 마감 30초 앞을 낸다
  const o = 올리기판(t);
  const 표시 = path.join(o.f.뿌리, '표시.txt');
  o.남이올림('tests/표시.test.js', `require('node:test')('표시', () => require('fs').writeFileSync(${JSON.stringify(표시)}, 'x'));\n`);
  const r = 올리기({ ...o.기본, 고르기: () => ({ 시험: ['tests/표시.test.js'], 지도: 1 }), 실행: o.미리대역(), 밀기: o.밀기대역(), 마감: 1e12, 시계: () => (fs.existsSync(표시) ? 1e12 - 30000 : 0) });
  assert.deepEqual([r.결과, r.다시, o.부름.밀기, r.앞시험?.새시험], ['못 올림', true, 0, null], JSON.stringify(r));
  assert.match(r.이유, /마감이 가까워 새 시험을 시작하지 않았다/);
  // 첫 차례가 시험을 통과하고 거절된 뒤, 둘째 차례의 관련 시험이 시간을 넘기면 앞시험은 둘째 차례의 것이다
  const o2 = 올리기판(t);
  let n = 0;
  const 느림 = "require('node:test')('느림', async () => { await new Promise((r) => setTimeout(r, 30000)); });\n";
  const r2 = 올리기({ ...o2.기본, 시험한도ms: 8000, 실행: o2.미리대역(), 고르기: () => (++n === 1 ? { 시험: ['tests/팁적용안.test.js'], 지도: 1 } : { 시험: ['tests/느림.test.js'], 지도: 1 }),
    밀기: o2.밀기대역({ 먼저: () => o2.남이올림('tests/느림.test.js', 느림) }) });
  assert.deepEqual([r2.결과, r2.차례, r2.다시, r2.앞시험?.파일, r2.앞시험?.새시험], ['못 올림', 2, true, 3, null], JSON.stringify(r2));
  assert.match(r2.이유, /관련 시험이 시간을 넘겼다/);
});

test('사후: 도중에 꺼둠이 생기면 시험 · 올리기로 가지 않고, GPT 답 파일 · 지적표는 고침 기록 곁에 남는다(GA11 · 검수 남기기)', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기({ GPT고정: (a) => {
    fs.mkdirSync(a.폴더, { recursive: true });
    fs.writeFileSync(path.join(a.폴더, '지적표.json'), JSON.stringify({ 지적: [] }));
    fs.writeFileSync(path.join(f.고침방, '꺼둠'), '');
    return { 받음: true, P0P1: 0, 셈: { P0: 0, P1: 0, P2: 0, P3: 0 }, 이름: a.이름, 지적: [] };
  } });
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.equal(r.상태, '못 고침');
  assert.match(r.까닭, /도중에 꺼둠/);
  assert.deepEqual([f.부름.자리, f.부름.올리기.length], [0, 0]);
  assert.ok(fs.existsSync(path.join(f.고침방, 자료.id, '검수', '지적표.json')), '검수 기록을 남긴다');
});

test('사후: 올라간 판이 검수한 판과 다르면 올림으로 적고 멈춘다, 메시지에는 표식 줄이 있다(GA2 · GA12)', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기({ 올리기고정: (a) => { f.부름.올리기.push(a); return { 결과: '올림', 커밋: 'd'.repeat(40), 바이트같음: false }; } });
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.equal(r.상태, '올림', r.까닭);
  assert.match(JSON.parse(fs.readFileSync(path.join(f.고침방, '멈춤.json'), 'utf8')).까닭, /검수한 판과 달라/);
  const 올 = f.부름.올리기[0];
  assert.ok(올.메시지.includes(`\n알림고침-id: ${자료.id}\n`), '메시지에 표식 줄');
  assert.equal(올.종류, 관문.종류표['tip-worker'], '종류 시험 · 작업본꼴은 종류 표에서');
  assert.equal(typeof 올.자리잡기, 'function', '올릴 판 시험도 공용 자리를 잡는다');
  assert.deepEqual(올.새시험자리, [`${새시험}:3:1`], '격리 사본의 고친 판에서 새 시험이 돈 자리');
  assert.equal(typeof 올.밀기전, 'function');
  assert.ok(Number.isFinite(올.마감) && 올.마감 > Date.now() + 5 * 3600000, '마감은 잠금 끝(6시간)에서 20분 앞');
  assert.match(알림고침.후보고르기({ 집: f.집, 지금, 고침방: f.고침방, 공용: f.공용 }).이유, /멈춤 — 올라간 판이 검수한 판과 달라/);
});

test('GPT검수: GPT가 끝까지 돌지 않았거나 답이 이 묶음의 것이 아니면 받지 못한 것이고, 지적은 답 파일에서 센다(GA1)', (t) => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alertfix-gpt-'));
  t.after(() => fs.rmSync(방, { recursive: true, force: true }));
  const 폴더 = path.join(방, '검수', 'x');
  const 묶음글 = { 묶음: [{ 이름: 'A', sha256: 'a'.repeat(64) }] };
  const 답글 = (더 = {}) => ({ 상태: '읽음', 표식맞음: true, 입력sha256: 'a'.repeat(64), 빠진항목: [], 검증오류: [], 답: { findings: [{ grade: 'P1', location: 'tools/x.js:1', problem: '깨진다' }, { grade: 'P2', location: 'y', problem: 'z' }] }, ...더 });
  const 대역 = (GPT종료, 답 = 답글()) => (cmd, args) => {
    if (args[1] === '준비') { fs.mkdirSync(폴더, { recursive: true }); fs.writeFileSync(path.join(폴더, '묶음.json'), JSON.stringify(묶음글)); fs.writeFileSync(path.join(폴더, '지적표.json'), JSON.stringify({ 지적: [] })); return { status: 0 }; }
    fs.writeFileSync(path.join(폴더, 'GPT-A.json'), JSON.stringify(답));
    return { status: GPT종료 };
  };
  const 부르기 = (실행) => 알림고침.GPT검수({ 사본: 방, 바탕: 'b', 경로들: ['x'], 이름: 'x', 폴더, 배경: '#', 실행 });
  assert.match(부르기(대역(null)).이유, /끝까지 돌지 않았다/);
  const 받음 = 부르기(대역(0));
  assert.deepEqual([받음.받음, 받음.P0P1, 받음.셈.P2], [true, 1, 1], '지적표가 비어도 답 파일의 P1을 센다');
  assert.match(받음.지적[0], /^P1 tools\/x\.js:1 깨진다/);
  assert.match(부르기(대역(0, 답글({ 입력sha256: 'b'.repeat(64) }))).이유, /이 묶음의 것이 아니다/);
  assert.match(부르기(대역(0, 답글({ 빠진항목: ['A3'] }))).이유, /온전하지 않다/);
});

test('사전확인: 오늘 날 표가 있으면 넘기고(두 실행이 함께 골라도 하나만), 본 되돌림으로는 다시 멈추지 않는다(r2 GA13 · GA3 · GA14)', async (t) => {
  const f = 판(t);
  fs.mkdirSync(path.join(f.고침방, '.표'), { recursive: true });
  fs.writeFileSync(path.join(f.고침방, '.표', '날-2026-11-27'), '1\n');
  assert.match((await f.만들기().사전확인({})).이유, /오늘은 다른 실행이 맡았다/);
  assert.equal(f.기록().length, 0, '기록을 쓰지 않았다');
  const f1 = 판(t);
  const 자료 = await f1.만들기().사전확인({});
  assert.ok(자료.사본 && fs.existsSync(path.join(f1.고침방, '.표', '날-2026-11-27')), '고른 실행이 날 표를 잡는다');
  fs.rmSync(자료.시도폴더, { recursive: true, force: true });
  // 되돌림: 멈춤을 먼저 쓰고 기록에 적는다. 멈춤.json을 지우면 같은 되돌림으로 다시 멈추지 않는다
  const f2 = 판(t);
  f2.쓰기(f2.공용, 'tools/크레딧작업/팁적용안.js', 고친원천);
  g(f2.공용, 'commit', '-qam', '알림 고침(무인): x');
  const 커밋 = g(f2.공용, 'rev-parse', 'HEAD').trim();
  g(f2.공용, 'revert', '--no-edit', 'HEAD');
  g(f2.공용, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
  fs.mkdirSync(path.join(f2.고침방, '202611200930-dddddd'), { recursive: true });
  // 8일 전에 올린 기록 — 7일 쉼이 끝났다
  fs.writeFileSync(path.join(f2.고침방, '202611200930-dddddd', '기록.json'), JSON.stringify({ version: 1, 종류: 'tip-worker', 사건: 'old', 시작: '2026-11-19T00:30:00Z', 상태: '올림', 커밋, 끝: '2026-11-19T01:00:00Z' }));
  assert.match((await f2.만들기().사전확인({})).이유, /되돌려져 멈췄다/);
  assert.ok(f2.기록().find((x) => x.id === '202611200930-dddddd').되돌림?.커밋, '본 되돌림을 그 기록에 적는다');
  fs.rmSync(path.join(f2.고침방, '멈춤.json'));
  const 다시 = await f2.만들기().사전확인({});
  assert.ok(다시.사본, 다시.이유);
});

test('사후: 실행 설정 지문이 바뀌면 올리지 않는다, 고친 뒤 등록이 빠지는 새 시험은 통과로 치지 않는다(Fable v4 P1-5 · r2 GA8)', async (t) => {
  const f = 판(t);
  let n = 0;
  const 작업 = f.만들기({ 지문재기: () => ({ 글: String(n++) }) });
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.match(r.까닭, /실행 설정이 바뀌었다/);
  assert.equal(f.부름.올리기.length, 0);
  const f2 = 판(t);
  const 작업2 = f2.만들기();
  const 자료2 = await 작업2.사전확인({});
  f2.쓰기(자료2.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f2.쓰기(자료2.사본, 새시험, "const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst 줄 = require('../tools/크레딧작업/팁적용안.js').줄;\nconst 고쳐짐 = (() => { try { return 줄(undefined) === ''; } catch { return false; } })();\nif (!고쳐짐) test('빈 값도 넘긴다', () => assert.equal(줄(undefined), ''));\n");
  const r2 = await 작업2.사후(답(), 자료2);
  assert.match(r2.까닭, /고치기 전에 깨진 새 시험의 자리들이 고친 뒤 그대로 돌아 통과하지 않았다/);
  assert.equal(f2.부름.올리기.length, 0);
});

test('사후: 조건 · 변수 이름 · 반복으로 고치기 전후에 다른 시험을 세우는 새 시험은 통과로 치지 않는다 — 이름이 같아도 자리가 다르다(r3 GA8 · r4 GA8)', async (t) => {
  const 머리 = "const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst 줄 = require('../tools/크레딧작업/팁적용안.js').줄;\nconst 고쳐짐 = (() => { try { return 줄(undefined) === ''; } catch { return false; } })();\n";
  for (const [시험글, 까닭] of [
    // 고치기 전에는 깨지는 시험, 고친 뒤에는 같은 이름의 헛시험
    [머리 + "if (!고쳐짐) test('빈 값도 넘긴다', () => assert.equal(줄(undefined), ''));\nelse test('빈 값도 넘긴다', () => {});\n", /깨진 새 시험의 자리들이 고친 뒤 그대로 돌아 통과하지 않았다/],
    // 고친 뒤의 헛시험을 변수 이름으로 세운다(r4 GA8)
    [머리 + "const 이름 = '빈 값도 넘긴다';\nif (!고쳐짐) test('빈 값도 넘긴다', () => assert.equal(줄(undefined), ''));\nelse test(이름, () => {});\n", /깨진 새 시험의 자리들이 고친 뒤 그대로 돌아 통과하지 않았다/],
    // 반복으로 세운 시험 — 한 자리에 둘
    [머리 + "test('고정', () => assert.equal(줄(undefined), ''));\nfor (const n of ['가', '나']) test(n, () => {});\n", /정의 자리를 믿을 수 없다/],
    // test로 등록하지 않고 맨 위에서 원천을 부르는 파일 — 파일째 결과 하나(r5 GA1 · GA5)
    [머리 + "assert.equal(줄(undefined), '');\n", /정의 자리를 믿을 수 없다/],
  ]) {
    const f = 판(t);
    const 작업 = f.만들기();
    const 자료 = await 작업.사전확인({});
    f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
    f.쓰기(자료.사본, 새시험, 시험글);
    const r = await 작업.사후(답(), 자료);
    assert.equal(r.상태, '못 고침');
    assert.match(r.까닭, 까닭);
    assert.equal(f.부름.올리기.length, 0);
    assert.equal(f.기록()[0].다시, undefined, '고침 탓이라 다시 고르지 않는다');
  }
});

test('사후: 원격이 움직여 못 올린 시도는 「다시」로 적고 다음 날 같은 사건을 다시 고른다(Fable v4 P1-1)', async (t) => {
  const f = 판(t);
  const 작업 = f.만들기({ 올리기고정: (a) => { f.부름.올리기.push(a); return { 결과: '못 올림', 이유: '원격이 계속 움직여 8번 모두 올리지 못했다', 다시: true, 차례: 8 }; } });
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.equal(r.상태, '못 고침');
  assert.equal(f.기록()[0].다시, true);
  assert.equal(typeof f.부름.올리기[0].멈출까, 'function');
  const 다음날 = new Date(+지금 + 24 * 3600000);
  const s = JSON.parse(fs.readFileSync(path.join(f.자동, 'state.json'), 'utf8'));
  s.checkedAt = new Date(+다음날 - 60000).toISOString();
  fs.writeFileSync(path.join(f.자동, 'state.json'), JSON.stringify(s));
  assert.equal(고르기(f, 다음날).후보?.사건, 'inc1', '같은 사건을 다시 고른다');
  assert.equal(고르기(f, 다음날).후보.차례, 2);
  // 다음 날의 실행은 두 번째 사건 표를 잡는다
  const 이튿날 = await f.만들기({ 지금고정: 다음날 }).사전확인({});
  assert.ok(이튿날.사본, 이튿날.이유);
  assert.equal(이튿날.기록.차례, 2);
  assert.ok(fs.existsSync(path.join(f.고침방, '.표', '사건-inc1-2')), '사건 표');
  fs.rmSync(이튿날.시도폴더, { recursive: true, force: true });
});

test('후보: 한 사건은 「다시」까지 세 번이다(Fable v4.1 P2-2), 사건 id 꼴이 아니면 고르지 않는다', (t) => {
  const f = 판(t);
  for (const [i, id] of ['202611240930-aaaaaa', '202611250930-bbbbbb', '202611260930-cccccc'].entries()) {
    fs.mkdirSync(path.join(f.고침방, id), { recursive: true });
    fs.writeFileSync(path.join(f.고침방, id, '기록.json'), JSON.stringify({ version: 1, 종류: 'tip-worker', 사건: 'inc1', 차례: i + 1, 시작: `2026-11-2${4 + i}T00:30:00Z`, 끝: `2026-11-2${4 + i}T01:00:00Z`, 상태: '못 고침', 다시: true }));
  }
  assert.match(고르기(f).이유, /고칠 후보 없음/);
  fs.rmSync(path.join(f.고침방, '202611260930-cccccc'), { recursive: true });
  assert.equal(고르기(f).후보?.차례, 3);
  const f2 = 판(t, { 진단: { 사건: '../밖' }, 상태: { attentionIncidents: { 'tip-worker': { id: '../밖', fingerprint: 'f' } } } });
  assert.match(고르기(f2).이유, /고칠 후보 없음/);
});

test('사전확인: 사건 표를 다른 실행이 잡았으면 넘기고 잡은 날 표를 놓는다 — 자정을 사이에 둔 두 실행(r3 GA5 · GA11)', async (t) => {
  const f = 판(t);
  assert.equal(알림고침.사건표잡기(f.고침방, 'inc1', 1), true);
  assert.equal(알림고침.사건표잡기(f.고침방, 'inc1', 1), false, '같은 차례는 한 번만');
  assert.equal(알림고침.사건표잡기(f.고침방, '../밖', 1), false, '사건 id 꼴이 아니면 잡지 않는다');
  // 그 차례의 표가 이미 있으면 후보고르기가 읽기만 하고 넘긴다 — 날 표를 태우지 않고, 표만 남은 사건은 이유 글에 보인다(Fable v4.2 P2-2)
  const r = await f.만들기().사전확인({});
  assert.equal(r.할일, false);
  assert.match(r.이유, /표만 남음 — 기록 없는 fixes\/\.표\/사건-inc1-1을 지우면 다시 고른다/);
  assert.equal(fs.existsSync(path.join(f.고침방, '.표', '날-2026-11-27')), false, '날 표를 잡지 않는다');
  assert.equal(f.기록().length, 0, '기록을 쓰지 않았다');
  // 사건 표는 지우지 않는다 — 오래돼도 남는다(지우기와 새로 잡기가 겹치면 두 실행이 같은 차례를 잡는다, r4 GA6 · GA11)
  const 옛 = new Date(Date.now() - 8 * 3600000);
  fs.utimesSync(path.join(f.고침방, '.표', '사건-inc1-1'), 옛, 옛);
  assert.match((await f.만들기().사전확인({})).이유, /표만 남음/);
  assert.ok(fs.existsSync(path.join(f.고침방, '.표', '사건-inc1-1')));
  // 사람이 표를 지우면 다시 고른다
  fs.rmSync(path.join(f.고침방, '.표', '사건-inc1-1'), { recursive: true });
  const 다시 = await f.만들기().사전확인({});
  assert.ok(다시.사본, 다시.이유);
  fs.rmSync(다시.시도폴더, { recursive: true, force: true });
  // 날 표는 만든 실행만 놓는다
  const f2 = 판(t);
  assert.deepEqual([알림고침.날표잡기(f2.고침방, '2026-11-30'), 알림고침.날표잡기(f2.고침방, '2026-11-30')], [true, false]);
  알림고침.날표놓기(f2.고침방, '2026-11-30');
  assert.equal(알림고침.날표잡기(f2.고침방, '2026-11-30'), true);
});

test('사전확인: 올림맞추기가 git 오류로 판정하지 못하면 「안 올라감」으로 닫지 않고 그 회차는 고르지 않는다(r4 GA10 · Fable v4.2 P1-1)', (t) => {
  const f = 판(t);
  const C = g(f.공용, 'rev-parse', 'HEAD').trim();
  fs.mkdirSync(path.join(f.고침방, '202611260930-aaaaaa'), { recursive: true });
  fs.writeFileSync(path.join(f.고침방, '202611260930-aaaaaa', '기록.json'), JSON.stringify({ version: 1, 종류: 'tip-worker', 사건: 'a1', 시작: '2026-11-26T00:30:00Z', 끝: '2026-11-26T01:00:00Z', 상태: '못 고침', 다시: true, 올릴커밋들: [{ 커밋: C }] }));
  const 비저장소 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alertfix-norepo-'));
  t.after(() => fs.rmSync(비저장소, { recursive: true, force: true }));
  const r = 알림고침.올림맞추기({ 고침방: f.고침방, 공용: 비저장소, 지금, 받기: false });
  assert.deepEqual([r.됨, /git 오류/.test(r.이유 || '')], [false, true], JSON.stringify(r));
  const 그대로 = f.기록()[0];
  assert.deepEqual([그대로.상태, 그대로.올림확인, 그대로.다시], ['못 고침', undefined, true], '닫지 않았다');
});

test('사후: push 바로 앞에 올릴 커밋을 기록 자체에 적어, 뒤의 끝내기가 기록을 다시 써도 남는다(Fable v4.1 P1-1 · r3 GA10)', async (t) => {
  const f = 판(t);
  let 그때 = null;
  const 작업 = f.만들기({ 올리기고정: (a) => {
    a.밀기전('e'.repeat(40));
    그때 = JSON.parse(fs.readFileSync(path.join(f.고침방, f.기록()[0].id, '기록.json'), 'utf8'));
    return { 결과: '못 올림', 이유: 'push가 실패했다(종료 128)', 다시: true, 차례: 1 };
  } });
  const 자료 = await 작업.사전확인({});
  f.쓰기(자료.사본, 'tools/크레딧작업/팁적용안.js', 고친원천);
  f.쓰기(자료.사본, 새시험, 새시험글);
  const r = await 작업.사후(답(), 자료);
  assert.equal(r.상태, '못 고침');
  assert.deepEqual([그때.상태, 그때.올릴커밋들[0].커밋, 그때.전새.실패], ['도는 중', 'e'.repeat(40), 1], '밀기 앞의 기록');
  const 끝 = f.기록()[0];
  assert.deepEqual([끝.올릴커밋들.length, 끝.올릴커밋들[0].커밋, 끝.다시], [1, 'e'.repeat(40), true]);
});

test('사전확인: 올릴 커밋을 적고 닫히지 않은 시도를 origin과 맞춘다 — 품으면 올림, 아니면 안 올라감, 받지 못하면 고르지 않는다(Fable v4.1 P2-1)', async (t) => {
  const f = 판(t);
  f.쓰기(f.공용, 'docs/올라감.md', 'x\n');
  g(f.공용, 'add', '-A');
  g(f.공용, 'commit', '-qm', '알림 고침(무인): 올라간 것');
  const 올라감 = g(f.공용, 'rev-parse', 'HEAD').trim();
  g(f.공용, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
  const 죽은pid = spawnSync(process.execPath, ['-e', '0']).pid;
  const 적기 = (id, 값) => {
    fs.mkdirSync(path.join(f.고침방, id), { recursive: true });
    fs.writeFileSync(path.join(f.고침방, id, '기록.json'), JSON.stringify({ version: 1, 종류: 'tip-worker', 제목: '팁 적용안 처리 · 실패', 시작: '2026-11-26T00:30:00Z', ...값 }));
  };
  적기('202611260930-aaaaaa', { 사건: 'a1', 상태: '못 고침', 끝: '2026-11-26T02:00:00Z', 다시: true, 올릴커밋들: [{ 커밋: 'f'.repeat(40) }, { 커밋: 올라감 }] });
  적기('202611260931-bbbbbb', { 사건: 'b1', 상태: '끊김', 끝: '2026-11-26T08:00:00Z', 다시: true, 올릴커밋들: [{ 커밋: 'f'.repeat(40) }] });
  // 도는 중인 둘은 7시간 안에 시작했다(끊김으로 닫히기 전)
  적기('202611270900-cccccc', { 사건: 'c1', 상태: '도는 중', 시작: '2026-11-27T00:00:00Z', pid: 죽은pid, 올릴커밋들: [{ 커밋: 'e'.repeat(40) }] });
  적기('202611270901-dddddd', { 사건: 'd1', 상태: '도는 중', 시작: '2026-11-27T00:00:00Z', pid: process.pid, 올릴커밋들: [{ 커밋: 'e'.repeat(40) }] });
  // 받지 못하면(여기서는 origin이 없다) 그 회차는 고르지 않는다
  const 못받음 = await f.만들기({ 받기: true }).사전확인({});
  assert.deepEqual([못받음.할일, /origin을 받지 못했다/.test(못받음.이유)], [false, true], 못받음.이유);
  assert.equal(f.기록().find((x) => x.id === '202611260930-aaaaaa').상태, '못 고침', '받지 못하면 고치지 않는다');
  await f.만들기().사전확인({});
  const 본 = Object.fromEntries(f.기록().map((x) => [x.id, x]));
  const 가 = 본['202611260930-aaaaaa'];
  assert.deepEqual([가.상태, 가.커밋, 가.바이트같음, 가.다시, 가.끝, 가.맞춤?.앞상태], ['올림', 올라감, true, undefined, '2026-11-26T02:00:00Z', '못 고침']);
  assert.deepEqual([본['202611260931-bbbbbb'].상태, 본['202611260931-bbbbbb'].올림확인?.결과], ['끊김', '안 올라감']);
  assert.deepEqual([본['202611270900-cccccc'].상태, 본['202611270900-cccccc'].다시, 본['202611270900-cccccc'].올림확인?.결과], ['끊김', true, '안 올라감'], '죽은 실행');
  assert.deepEqual([본['202611270901-dddddd'].상태, 본['202611270901-dddddd'].올림확인], ['도는 중', undefined], '살아 있는 실행은 건드리지 않는다');
  // 맞춘 올림은 7일 쉼과 되돌림 감시에 든다(오늘 시도한 두 기록은 치우고 본다)
  for (const id of ['202611270900-cccccc', '202611270901-dddddd']) fs.rmSync(path.join(f.고침방, id), { recursive: true });
  assert.match(고르기(f).이유, /고칠 후보 없음/);
  g(f.공용, 'revert', '--no-edit', 올라감);
  g(f.공용, 'update-ref', 'refs/remotes/origin/master', 'HEAD');
  assert.equal(알림고침.되돌림보기({ 고침방: f.고침방, 공용: f.공용 }), true);
});

test('후보: 다른 사건의 새 진단이 아직 열린 팁 사건의 앞 진단을 가리지 않는다(GA15), 증거의 PC 경로는 가린다(GA10)', (t) => {
  const f = 판(t);
  const 옛 = path.join(f.자동, 'diagnosis', 묶음 + '.json');
  const 옛때 = new Date(+지금 - 2 * 24 * 3600000);
  fs.utimesSync(옛, 옛때, 옛때);
  fs.writeFileSync(path.join(f.자동, 'diagnosis', 'event-' + 'b'.repeat(24) + '.json'), JSON.stringify({ version: 1, id: 'event-' + 'b'.repeat(24),
    items: [{ id: 'backup-x', 사건: 'z', 원인: 'a', 해결: 'b', 상태: '유호님 차례', 고칠수있음: false }] }));
  const r = 고르기(f);
  assert.equal(r.후보?.종류id, 'tip-worker', r.이유);
  assert.equal(r.후보.진단id, 묶음);
  assert.equal(알림고침.다듬기('at f (C:\\Users\\someone\\SYNK\\tools\\x.js:1:2) /c/Users/someone/y', 200), 'at f (<집>\\SYNK\\tools\\x.js:1:2) <집>/y');
  // 다른 계정의 이름에 빈칸이 있어도 다음 빗금까지 가린다(r3 GA9 · Fable v4.1 P3-2)
  assert.equal(알림고침.다듬기('at f (C:\\Users\\Sample Person\\x.js:1:2)', 200), 'at f (<집>\\x.js:1:2)');
  assert.equal(알림고침.다듬기('/home/alice smith/x · /c/Users/Sample Person/y', 200), '<집>/x · <집>/y');
  assert.equal(알림고침.다듬기('C:\\Users\\Sample Person\n다음 줄', 200), '<집> 다음 줄', '줄바꿈에서 멈춘다');
  // 한 줄의 두 경로는 따로 가리고, 이름 안의 작은따옴표에서 멈추지 않는다(r4 GA1 · GA9)
  assert.equal(알림고침.다듬기('C:\\Users\\Alpha · D:\\Users\\Beta\\input.js', 200), '<집> <집>\\input.js');
  assert.equal(알림고침.다듬기("C:\\Users\\O'Connor\\x.js", 200), '<집>\\x.js');
  assert.equal(알림고침.다듬기('C:\\Users\\bob: error ENOENT', 200), '<집>: error ENOENT');
  // POSIX 이름에는 빗금 말고 무엇이든 든다(: · C:\ · 따옴표 · 빈칸, r5 GA2 · r6 GA4 · r7 GA1 · GA3) — 빗금 · 줄바꿈에서만 멈춘다
  assert.equal(알림고침.다듬기('at f (/home/Acme:Jane Doe/app.js:1:2)', 200), 'at f (<집>/app.js:1:2)');
  assert.equal(알림고침.다듬기('at f (/home/Acme:C:\\Jane Doe/app.js:1:2)', 200), 'at f (<집>/app.js:1:2)');
  assert.equal(알림고침.다듬기('at f (/home/Acme: C:\\Jane Doe/app.js:1:2)', 200), 'at f (<집>/app.js:1:2)');
  assert.equal(알림고침.다듬기('at f (/home/Acme"Jane Doe/app.js:1:22)', 200), 'at f (<집>/app.js:1:22)');
  // 빗금 없이 끝나는 경로는 뒤의 글까지 가린다 — 개인정보를 진단 글보다 앞에 둔다(r6 GA2를 되돌림)
  assert.equal(알림고침.다듬기('Error: stat "/home/ci-bot" failed with ENOENT', 200), 'Error: stat "<집>');
  assert.equal(알림고침.다듬기('C:\\Users\\Alpha·D:\\Users\\Beta\\y', 200), '<집><집>\\y');
  // UNC 경로는 통째로 가린다 — 공유 배치로는 어느 폴더가 사용자 폴더인지 알 수 없다(r8 GA2 · r9 GA3)
  for (const 공유 of ['\\\\fileserver\\share\\Users\\Jane Doe\\x.js', '\\\\fileserver\\Users\\Backup\\Users\\Jane Doe\\app.js',
    '\\\\fileserver\\Users\\Users\\Jane Doe\\app.js', '\\\\fileserver\\Users\\Profiles\\Jane Doe\\app.js', '\\\\srv\\home\\Jane Doe\\x']) {
    assert.equal(알림고침.다듬기(`at f (${공유}:1:2)`, 200), 'at f (<집>:1:2)', 공유);
  }
  assert.equal(알림고침.다듬기('{"u":"\\\\\\\\fileserver\\\\Users\\\\Users\\\\Jane Doe\\\\x"}', 200), '{"u":"<집>"}', 'JSON에 겹쳐 쓴 UNC');
  assert.equal(알림고침.다듬기("rename '\\\\fileserver\\share\\pending' -> 'C:\\Users\\Jane Doe\\archive\\pending'", 200), "rename '<집>> '<집>\\archive\\pending'");
  // JSON에 겹쳐 쓴 보통 경로는 UNC로 보지 않는다 — 폴더 이름이 )로 끝나도 뒤의 경로가 남는다(r10 GA2)
  assert.equal(알림고침.다듬기('{"p":"C:\\\\Users\\\\bob\\\\SYNK\\\\x.js","q":"src\\\\tools\\\\y.js"}', 200), '{"p":"<집>\\\\SYNK\\\\x.js","q":"src\\\\tools\\\\y.js"}');
  assert.equal(알림고침.다듬기('{"path":"C:\\\\Users\\\\bob\\\\OneDrive (Work)\\\\scripts\\\\deploy.js"}', 200), '{"path":"<집>\\\\OneDrive (Work)\\\\scripts\\\\deploy.js"}');
  // 빗금이 섞여도 가린다. 드라이브 뒤의 /Users/는 POSIX 이름일 수도 있어 줄 끝까지 함께 가린다(닫힌 쪽 — r9 GA2의 뒤 글 보존을 되돌림)
  assert.equal(알림고침.다듬기('C:\\Users/Jane Doe/x.js · C:/Users\\Bob Lee\\y.js', 200), '<집>/x.js · <집>\\y.js');
  assert.equal(알림고침.다듬기("Error: stat 'C:/Users/Jane Doe\\workspace\\deploy.js' failed with ENOENT", 200), "Error: stat '<집>");
  // 모든 꼴의 자리를 원문에서 찾아 합친다 — 앞 꼴이 다른 꼴의 표지를 먹어 이름이 남지 않는다(r10 GA1)
  assert.equal(알림고침.다듬기("Error: copy '\\\\fileserver\\share\\pending' to '/home/Acme:Jane Doe/app.js' failed with ENOENT", 200), "Error: copy '<집>/app.js' failed with ENOENT");
  assert.equal(알림고침.다듬기('C:\\msys64\\home\\Jane Doe\\x', 200), 'C:\\msys64<집>\\x');
  // 열쇠 꼴은 표식부터 그 줄 끝까지 가린다 — 표식을 경로 가리기가 먹거나(r8 GA1) 빈칸 든 값의 꼬리가 남지 않는다(r9 GA1)
  const 열쇠 = 알림고침.다듬기('Error: stat "/home/ci-bot" failed with ENOENT; password=/review-dummy', 200);
  assert.ok(!열쇠.includes('review-dummy'), 열쇠);
  assert.equal(알림고침.다듬기('C:\\Users\\bob\\x api_key=C:\\Users\\Jane Doe\\sk_live_abc', 200), '<집>\\x [인증값]');
  assert.equal(알림고침.다듬기('password:\n  hunter2 secret\n다음 줄', 200), '[인증값] 다음 줄');
  // 앞 표식의 자리 안에 든 표식도 따로 센다 — 뒤 표식의 값이 다음 줄에 있어도 남지 않는다(r11 GA1)
  assert.equal(알림고침.다듬기('api_key=sample-one password:\n sample-two', 200), '[인증값]');
  // 메일 끝의 password:가 메일 일부를 남기지 않고(r12 GA1), 메일 바로 뒤에 글자가 붙어도 메일을 놓치지 않는다(r13 GA1)
  assert.equal(알림고침.다듬기('회신 주소 my.name@example.password: 확인 필요', 200), '회신 주소 [인증값]');
  assert.equal(알림고침.다듬기('회신 주소 my.name@example.comapi_key=sample', 200), '회신 주소 [인증값]');
  // 찾은 자리를 지운 글에서 다시 찾는다 — 메일 끝 글자에 붙은 드라이브 경로도 가린다
  assert.equal(알림고침.다듬기('bob@x.comC:\\Users\\Jane\\y', 200), '[계정]:<집>\\y');
  // 표식 · 빈칸이 아주 많아도 글 길이에 비례한다(r12 GA2)
  const 시작 = Date.now();
  알림고침.다듬기('password=x '.repeat(200000), 100);
  알림고침.다듬기('C:\\Users\\' + ' '.repeat(200000) + 'x', 100);
  assert.ok(Date.now() - 시작 < 3000, `${Date.now() - 시작}ms`);
  // 폴더 이름 끝 글자 뒤라도 「\\이름\이름」(홑빗금)이면 날 UNC다(r11 GA2). JSON의 \"는 경로를 잇지 않는다
  assert.equal(알림고침.다듬기('Error: Command failed: tsc "@\\\\fileserver\\share\\Jane Doe\\deploy.rsp"', 200), 'Error: Command failed: tsc "@<집>"');
  assert.equal(알림고침.다듬기('x\\\\srv\\share\\Jane Doe\\y', 200), 'x<집>');
  assert.equal(알림고침.다듬기('{"cmd":"tsc \\"C:\\\\Users\\\\bob\\\\x.js\\""}', 200), '{"cmd":"tsc \\"<집>\\\\x.js\\""}');
  // 진단이 감시 clean으로 먼저 가려 저장한 글도 꼬리가 없다 — clean이 같은 꼴로 줄 끝까지 가린다(r10 GA3)
  const 저장 = require('../tools/hermes-synk/monitor.cjs').clean('원인 api_key=C:\\Users\\Jane Doe\\sk_live_abc 끝\n다음', 200);
  assert.equal(저장, '원인 [인증값]\n다음');
  assert.equal(알림고침.다듬기(저장, 200), '원인 [인증값] 다음');
});
