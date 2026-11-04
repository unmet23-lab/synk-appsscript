'use strict';
// tools/버려진화면스크립트.js의 판정(2026-11-04). 실제 프로세스는 건드리지 않는다 — 실제 브라우저로 재는 것은 tests/버려진화면스크립트실측.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const 도구모듈 = require('../tools/버려진화면스크립트.js');
const { 기본, 예약이름, 표만들기, 브라우저메인인가, 진짜부모, 후손들, 보호됨, 후보찾기, 코어재기, 끄기, 돌리기, 설치계획, 인자읽기 } = 도구모듈;

const 지금 = Date.parse('2026-11-04T12:00:00Z');
const 분전 = (분) => new Date(지금 - 분 * 60000).toISOString();
const 프로필 = '--user-data-dir=C:\\Temp\\playwright_chromiumdev_profile-abc --headless';
const 셸 = (p, q, 분, cpu = 0, 더 = '') => ({ p, q, n: 'chrome-headless-shell.exe', s: 분전(분), c: `C:\\x\\chrome-headless-shell.exe ${프로필} ${더}`, k: cpu * 1e7, u: 0 });
const 렌더러 = (p, q, 분, cpu = 0) => ({ p, q, n: 'chrome-headless-shell.exe', s: 분전(분), c: `C:\\x\\chrome-headless-shell.exe --type=renderer ${프로필}`, k: 0, u: cpu * 1e7 });
const 노드 = (p, q, 분, 글 = 'node 앱화면.cjs', cpu = 0) => ({ p, q, n: 'node.exe', s: 분전(분), c: 글, k: cpu * 1e7, u: 0 });
const 표 = (...줄들) => 표만들기(줄들);

test('브라우저메인인가: Playwright 임시 프로필의 헤드리스 메인만 맞다', () => {
  const 맞나 = (n, c) => 브라우저메인인가({ 이름: n, 명령: c });
  assert.equal(맞나('chrome-headless-shell.exe', `x --user-data-dir=C:\\T\\playwright_chromiumdev_profile-kx`), true);
  assert.equal(맞나('msedge.exe', 'x --user-data-dir="C:\\T\\playwright_chromiumdev_profile-kx" --headless=new --no-sandbox'), true);
  assert.equal(맞나('chrome.exe', 'x --headless --user-data-dir=C:\\T\\playwright_chromiumdev_profile-kx'), true);
  assert.equal(맞나('MSEDGE.EXE', 'x --user-data-dir=C:\\T\\playwright_chromiumdev_profile-kx --headless'), true, '대소문자');
  assert.equal(맞나('chrome-headless-shell.exe', 'x --type=renderer --user-data-dir=C:\\T\\playwright_chromiumdev_profile-kx'), false, '렌더러');
  assert.equal(맞나('chrome.exe', 'x --user-data-dir=C:\\T\\playwright_chromiumdev_profile-kx'), false, '창이 있는 브라우저는 사람이 보고 있을 수 있다');
  assert.equal(맞나('chrome.exe', 'x --profile-directory=유호'), false, '유호님 크롬');
  assert.equal(맞나('chrome-headless-shell.exe', 'x --user-data-dir=C:\\T\\puppeteer_dev_chrome_profile-FG'), false, 'Remotion');
  assert.equal(맞나('msedgewebview2.exe', 'x --headless --user-data-dir=C:\\T\\playwright_chromiumdev_profile-kx'), false, '다른 실행 파일');
  assert.equal(맞나('ego.exe', ''), false);
  assert.equal(맞나('chrome.exe', 'x --user-data-dir=C:\\T\\my-playwright-headless\\keep'), false, '자기 프로필(launchPersistentContext)');
});

test('진짜부모 · 후손들: 죽은 부모의 번호를 물려받은 프로세스는 잇지 않는다', () => {
  const t = 표(노드(100, 1, 300), 셸(200, 100, 290), 렌더러(201, 200, 289), 노드(300, 100, 400, '옛 부모의 번호를 100이 물려받은 남'), 노드(301, 300, 350, '그 남의 자식'));
  assert.equal(진짜부모(t.get(200), t).pid, 100);
  assert.equal(진짜부모(t.get(300), t), null, '100보다 먼저 떴으니 100의 자식이 아니다');
  assert.deepEqual(후손들(t.get(100), t).map((p) => p.pid).sort(), [200, 201]);
});

test('보호됨: 조건부 시험 일꾼 아래와 그 전용 임시 폴더의 프로필은 건드리지 않는다', () => {
  const t = 표(
    노드(10, 1, 300, 'node C:\\ops\\tools\\conditional-qa\\worker.cjs --state C:\\s'), 노드(11, 10, 299, 'node --test x.test.mjs'), 셸(12, 11, 298),
    노드(20, 1, 300), { ...셸(21, 20, 299), c: `x --headless --user-data-dir=C:\\Users\\u\\security-audit-skill\\SYNK-conditional-qa\\runs\\t\\playwright_chromiumdev_profile-a` },
    노드(30, 1, 300), 셸(31, 30, 299),
  );
  assert.equal(보호됨(t.get(12), t), true);
  assert.equal(보호됨(t.get(21), t), true);
  assert.equal(보호됨(t.get(31), t), false);
  assert.deepEqual(후보찾기(t, 지금).map((x) => x.뿌리.pid), [30]);
});

test('후보찾기: 3시간 문턱 · 주인 node는 브라우저가 모두 오래됐을 때만 끈다', () => {
  assert.deepEqual(후보찾기(표(노드(1, 9, 200), 셸(2, 1, 179)), 지금), [], '179분은 아니다');
  const 넘음 = 후보찾기(표(노드(1, 9, 200), 셸(2, 1, 180)), 지금);
  assert.equal(넘음[0].뿌리.pid, 1, '주인 node가 뿌리');
  // 레이싱 · 리듬처럼 한 node가 브라우저 둘을 남겼으면 뿌리는 하나
  const 둘 = 후보찾기(표(노드(1, 9, 600), 셸(2, 1, 599), 셸(3, 1, 598)), 지금);
  assert.equal(둘.length, 1);
  assert.deepEqual(둘[0].메인들.map((m) => m.pid), [2, 3]);
  assert.equal(Math.round(둘[0].나이분), 599);
  // 오래된 것과 지금 일하는 것을 함께 쥐었으면 오래된 브라우저만
  const 섞임 = 후보찾기(표(노드(1, 9, 600), 셸(2, 1, 599), 셸(3, 1, 5)), 지금);
  assert.deepEqual(섞임.map((x) => x.뿌리.pid), [2]);
  // 주인이 죽었거나 node가 아니면 브라우저 트리만
  assert.deepEqual(후보찾기(표(셸(2, 77, 599)), 지금).map((x) => x.뿌리.pid), [2]);
  assert.deepEqual(후보찾기(표({ p: 1, q: 9, n: 'python.exe', s: 분전(600), c: 'python x.py', k: 0, u: 0 }, 셸(2, 1, 599)), 지금).map((x) => x.뿌리.pid), [2]);
  // 죽은 주인의 번호를 다른 node가 물려받았으면 그 node를 끄지 않는다
  assert.deepEqual(후보찾기(표(노드(1, 9, 100, '남의 서버'), 셸(2, 1, 599)), 지금).map((x) => x.뿌리.pid), [2]);
  // 주인 node 아래에 다른 일이 있으면 오래된 브라우저만 끈다(GPT GA1)
  const 오래된것만 = (...줄들) => 후보찾기(표(...줄들), 지금).map((x) => x.뿌리.pid);
  assert.deepEqual(오래된것만(노드(1, 9, 600), 셸(2, 1, 599), 노드(40, 1, 590, 'node C:\\o\\tools\\conditional-qa\\worker.cjs'), 셸(41, 40, 589)), [2], '조건부 시험 일꾼');
  assert.deepEqual(오래된것만(노드(1, 9, 600), 셸(2, 1, 599), 노드(40, 1, 10, 'node 자식.cjs'), 셸(41, 40, 5)), [2], '하위 node의 새 브라우저');
  assert.deepEqual(오래된것만(노드(1, 9, 600), 셸(2, 1, 599), { p: 41, q: 1, n: 'chrome-headless-shell.exe', s: 분전(598), c: 'x --user-data-dir=C:\\T\\puppeteer_dev_chrome_profile-a', k: 0, u: 0 }), [2], '다른 프로필의 브라우저');
  assert.deepEqual(오래된것만(노드(1, 9, 600), 셸(2, 1, 599), 노드(40, 1, 590, 'node 시범서버.mjs'), 노드(60, 40, 580, 'node 그 아래')), [1], '브라우저가 아닌 자식은 스크립트와 함께 끈다');
  // Edge가 메인 아래에 띄우는, 명령 줄을 못 읽는 보조 프로세스는 다른 브라우저로 세지 않는다(11-04 실측)
  const 빈명령 = (p, q, 분) => ({ p, q, n: 'msedge.exe', s: 분전(분), c: '', k: 0, u: 0 });
  assert.deepEqual(오래된것만(노드(1, 9, 600), { ...셸(2, 1, 599), n: 'msedge.exe' }, 빈명령(3, 2, 1)), [1], '브라우저 안의 보조 프로세스');
  assert.deepEqual(오래된것만(노드(1, 9, 600), 셸(2, 1, 599), 빈명령(3, 1, 1)), [2], 'node가 막 띄운 브라우저는 명령 줄을 못 읽어도 일하는 중으로 본다');
  // 대상을 정하면 그것만
  assert.deepEqual(후보찾기(표(노드(1, 9, 600), 셸(2, 1, 599), 노드(5, 9, 600), 셸(6, 5, 599)), 지금, { 대상: new Set([5]) }).map((x) => x.뿌리.pid), [5]);
});

test('코어재기: 사이에 뜬 프로세스는 전부 세고, 번호만 같은 다른 프로세스의 앞 값은 빼지 않는다', () => {
  const 앞 = 표(노드(1, 9, 300, 'n', 100), 셸(2, 1, 299, 1000), 렌더러(3, 2, 298, 500), 렌더러(4, 2, 200, 70));
  const 뒤 = 표(노드(1, 9, 300, 'n', 110), 셸(2, 1, 299, 1100), 렌더러(3, 2, 298, 900), 렌더러(5, 2, 1, 30), { ...렌더러(4, 2, 2, 20) });
  assert.equal(코어재기(뒤.get(1), 앞, 뒤, 600), (10 + 100 + 400 + 30 + 20) / 600);
});

function 가짜도구(표들) {
  const 부름 = { 끈것: [], 끈대상: [], 잰시간: [], 적음: [] };
  let i = 0, 시각 = 지금;
  return {
    부름,
    읽기: async () => { const t = 표들[Math.min(i, 표들.length - 1)]; i += 1; return t; },
    끄기명령: async (대상들) => { 부름.끈것.push(대상들.map((x) => x.pid)); 부름.끈대상.push(대상들); },
    기다리기: async (ms) => { 부름.잰시간.push(ms); 시각 += ms; },
    지금: () => 시각,
    적기: (줄) => 부름.적음.push(줄),
  };
}
const 버려진판 = (cpu) => 표(노드(1, 9, 600, 'node 앱화면.cjs', 0), 셸(2, 1, 599, cpu), 렌더러(3, 2, 598, cpu * 2), 노드(50, 9, 600, '남의 node'), 노드(51, 50, 500, '남의 자식'));

test('돌리기: 후보가 없으면 재지도 끄지도 않고 바로 끝난다', async () => {
  const d = 가짜도구([표(노드(1, 9, 100), 셸(2, 1, 99), 노드(5, 9, 700))]);
  assert.deepEqual(await 돌리기({}, d), { 후보: 0, 결과: [] });
  assert.deepEqual(d.부름, { 끈것: [], 끈대상: [], 잰시간: [], 적음: [] });
});

test('돌리기: 코어 0.5개 이상이면 그 트리만 뿌리부터 끄고, 남이 들지 않는다', async () => {
  const 빈 = 표(노드(50, 9, 610, '남의 node'), 노드(51, 50, 510, '남의 자식'));
  const d = 가짜도구([버려진판(100), 버려진판(200), 빈]);   // 트리 코어 (100 + 200) / 600 = 0.5
  const r = await 돌리기({}, d);
  assert.deepEqual(d.부름.잰시간[0], 기본.창초 * 1000, '10분을 잰다');
  assert.equal(d.부름.끈것.length, 1);
  assert.equal(d.부름.끈것[0][0], 1, '뿌리가 먼저');
  assert.deepEqual([...d.부름.끈것[0]].sort(), [1, 2, 3], '남의 50 · 51은 없다');
  assert.equal(r.결과[0].결과, '끔');
  assert.equal(r.결과[0].개수, 3);
  assert.equal(r.결과[0].코어, 0.5);
  assert.equal(d.부름.적음.length, 1);
});

test('돌리기: 코어가 0.5개 아래면 남기고 기록한다', async () => {
  const d = 가짜도구([버려진판(100), 버려진판(190)]);   // (90 + 180) / 600 = 0.45
  const r = await 돌리기({}, d);
  assert.equal(r.결과[0].결과, '남김');
  assert.deepEqual(d.부름.끈것, []);
  assert.equal(d.부름.적음[0].코어, 0.45);
});

test('돌리기: 반올림 전 값으로 비교한다 — 0.495코어는 0.5로 통과하지 못한다(GPT GA4)', async () => {
  const d = 가짜도구([버려진판(100), 표(노드(1, 9, 600, 'node 앱화면.cjs', 0), 셸(2, 1, 599, 397), 렌더러(3, 2, 598, 200))]);   // (297 + 0) / 600
  const r = await 돌리기({}, d);
  assert.equal(r.결과[0].결과, '남김');
  assert.equal(r.결과[0].코어, 0.5, '적는 값만 반올림');
  assert.deepEqual(d.부름.끈것, []);
});

test('돌리기: 둘째 후보는 표를 새로 읽어 보고, 그사이 번호를 남이 물려받았으면 끄지 않는다(GPT GA3)', async () => {
  const 둘 = (cpu) => 표(노드(1, 9, 600), 셸(2, 1, 599, cpu), 노드(5, 9, 600), 셸(6, 5, 599, cpu));
  const 하나끔 = 표(노드(5, 9, 600), 셸(6, 5, 599, 400));
  const 남이씀 = 표(노드(5, 9, 1, '번호를 물려받은 남'), 셸(6, 5, 1));
  const d = 가짜도구([둘(100), 둘(400), 하나끔, 남이씀]);
  const r = await 돌리기({}, d);
  assert.deepEqual(r.결과.map((x) => x.결과), ['끔', '사라짐']);
  assert.deepEqual(d.부름.끈것, [[1, 2]]);
  assert.ok(d.부름.끈대상[0].every((x) => Number.isFinite(x.시작)), '끄는 쪽에 시작 시각을 넘긴다');
});

test('돌리기: 재는 동안 그 프로세스가 끝났거나 번호를 남이 물려받았으면 끄지 않는다', async () => {
  const 끝남 = 가짜도구([버려진판(100), 표(노드(50, 9, 610, '남의 node'))]);
  assert.equal((await 돌리기({}, 끝남)).결과[0].결과, '사라짐');
  assert.deepEqual(끝남.부름.끈것, []);
  const 물려받음 = 가짜도구([버려진판(100), 표(노드(1, 9, 3, '번호를 물려받은 남의 node'), 셸(2, 1, 2, 999))]);
  assert.equal((await 돌리기({}, 물려받음)).결과[0].결과, '사라짐');
  assert.deepEqual(물려받음.부름.끈것, []);
});

test('끄기: 남은 것은 다시 끄고, 끝내 안 꺼지면 못 껐다고 적는다 — 번호를 물려받은 남은 끄지 않는다', async () => {
  const 판 = 버려진판(100);
  const 남음 = 표(셸(2, 1, 599, 100));
  const d = 가짜도구([남음, 남음, 남음]);
  const r = await 끄기(판.get(1), 판, d);
  assert.equal(r.꺼짐, false);
  assert.deepEqual(r.남음, ['chrome-headless-shell.exe#2(메인)']);
  assert.deepEqual(d.부름.끈것[1], [2], '둘째부터 남은 것만');
  const 물려받음 = 표(노드(1, 9, 1, '새 프로세스'), 셸(2, 1, 1), 렌더러(3, 2, 1));
  const e = 가짜도구([물려받음]);
  const q = await 끄기(판.get(1), 판, e);
  assert.equal(q.꺼짐, true);
  assert.equal(e.부름.끈것.length, 1, '처음 한 번 뒤에는 시작 시각이 다르니 끄지 않는다');
});

test('끄기: 죽은 부모의 번호를 물려받은 새 프로세스의 자식은 끄지 않는다(GPT GA2)', async () => {
  const 판 = 버려진판(100);
  const 물려받음 = 표(노드(1, 9, 1, '번호를 물려받은 새 프로세스'), 노드(777, 1, 0.5, '그 자식'));
  const d = 가짜도구([물려받음]);
  const r = await 끄기(판.get(1), 판, d);
  assert.equal(r.꺼짐, true);
  assert.equal(d.부름.끈것.length, 1, '처음 한 번뿐');
  assert.ok(!d.부름.끈것.flat().includes(777));
});

test('끄기: 끄는 사이 그 트리가 띄운 자식은 따라가 끈다', async () => {
  const 판 = 버려진판(100);
  const 다음 = 표(노드(1, 9, 600, 'node 앱화면.cjs', 0), 렌더러(7, 1, 0.1));
  const 끝 = 표(노드(50, 9, 610, '남의 node'));
  const d = 가짜도구([다음, 끝]);
  const r = await 끄기(판.get(1), 판, d);
  assert.equal(r.꺼짐, true);
  assert.ok(d.부름.끈것[1].includes(7), '새로 뜬 7도 끈다');
  assert.ok(!d.부름.끈것.flat().includes(50));
});

test('인자읽기: 기준을 바꾼 실행은 --대상과 함께만 — 다른 세션의 브라우저를 끄지 않게', () => {
  assert.deepEqual(인자읽기([]), { 명령: null, 실행: false, json: false, 대상: null });
  assert.equal(인자읽기(['--실행']).실행, true);
  for (const 나쁨 of [['--실행', '--문턱분', '0'], ['--실행', '--코어', '0'], ['--창초', '1'], ['--대상', 'abc'], ['--대상', '0'], ['--문턱분', '-1', '--대상', '5'], ['--모르는것'], ['지우기']]) {
    assert.throws(() => 인자읽기(나쁨), undefined, 나쁨.join(' '));
  }
  const 시험 = 인자읽기(['--실행', '--대상', '5,6', '--문턱분', '0', '--창초', '3', '--코어', '0.01']);
  assert.deepEqual([...시험.대상], [5, 6]);
  assert.deepEqual([시험.문턱분, 시험.창초, 시험.코어], [0, 3, 0.01]);
  assert.equal(인자읽기(['설치', '--실행']).명령, '설치');
});

test('설치계획: 운영 사본의 코드를 30분마다 창 없이 돌린다', (t) => {
  const 폴더 = fs.mkdtempSync(path.join(require('node:os').tmpdir(), '버려진-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  fs.mkdirSync(path.join(폴더, '.git'));
  fs.writeFileSync(path.join(폴더, '.git', 'synk-ops-path'), 'C:\\ops\\SYNK-appsscript\n');
  const m = 설치계획({ 뿌리: 폴더, 파이썬: 'C:\\py\\pythonw.exe' });
  assert.equal(m.운영, 'C:\\ops\\SYNK-appsscript');
  assert.match(m.인자, /-X utf8 -B "C:\\ops\\SYNK-appsscript\\tools\\숨김실행\.py" --한도 1200 "C:\\ops\\SYNK-appsscript\\tools\\버려진화면스크립트\.js" --실행/);
  assert.ok(m.ps.includes(`-TaskName '${예약이름}'`));
  assert.match(m.ps, /-Minutes 30\)/);
  assert.match(m.ps, /-MultipleInstances IgnoreNew/);
  assert.match(m.ps, /-ExecutionTimeLimit \(New-TimeSpan -Minutes 25\)/);
  assert.match(m.ps, /-Execute 'C:\\py\\pythonw\.exe'/);
});

test('관문 표에 예약이 적혀 있다', () => {
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'docs', '_ops', '관문_자동화.md'), 'utf8');
  assert.ok(글.includes(`| ${예약이름} | 30분 |`));
});
