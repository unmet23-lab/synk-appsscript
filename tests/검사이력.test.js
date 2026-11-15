'use strict';
// 검사 이력(tools/lib/검사이력.js · .py) — 검사가 돌 때마다 편 폴더 게시/검사이력.jsonl에 한 줄(흠 장부 설계 1단계, 2026-11-15).
// 가장 중요한 약속: 이력 쓰기는 검사의 출력과 끝 코드를 바꾸지 않는다. 쓰기가 실패해도(검사이력.jsonl 자리에 폴더가 있어 덧붙일 수 없음)
// 검사는 이력을 끈 실행(SYNK_검사이력=끔)과 똑같이 끝나야 한다 — 도구마다 세 실행(켬 · 끔 · 쓰기 실패)의 출력과 끝 코드를 맞댄다.
// 최종본검사.py는 OpenCV · ffmpeg가 드는 도구라 여기서 돌리지 않는다(CI에 없다) — 실제 편으로 돌린 고치기 전후 대조는 트랙 줄에 있다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 이력 = require('../tools/lib/검사이력.js');

const REPO = path.join(__dirname, '..');
const py = process.env.SYNK_PYTHON || 'python';
const 파이썬 = spawnSync(py, ['--version'], { encoding: 'utf8' }).status === 0;
const 임시 = (t, 이름 = 'synk-hist-') => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 이름)); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const 쓰기 = (p, 글) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 글); return p; };
const 이력줄 = (편) => 이력.줄들읽기(path.join(편, '게시', 이력.HISTORY));
const 끈환경 = { ...process.env, SYNK_검사이력: '끔' };
const 켠환경 = (() => { const e = { ...process.env }; delete e.SYNK_검사이력; delete e.SYNK_검사단계; delete e.SYNK_검사편; return e; })();

test('남기기: 걸림이 없어도 한 줄, 같은 판 · 결과 · 걸림이면 덧붙이지 않고, 달라지면 덧붙인다 — 길 · 엔진 · 판 · 단계 · 눈 칸', (t) => {
  const 편 = path.join(임시(t), 'synkbrief_시험_20261115');
  쓰기(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'synkbrief' }));
  쓰기(path.join(편, '컷표.json'), JSON.stringify({ 틀: 2, 엔진: { 그림: '나노바나나 2.1', 영상: 'Seedance 2.5 720p' } }));
  const 통과 = 이력.남기기({ 편, 눈: '올리기전검사', 단계: '올리기 전', 결과: '통과', 끝코드: 0, 판: 'aaa111bbb222', 걸림: [] });
  assert.equal(통과.남김, true, 통과.까닭);
  assert.equal(이력.남기기({ 편, 눈: '올리기전검사', 단계: '올리기 전', 결과: '통과', 끝코드: 0, 판: 'aaa111bbb222', 걸림: [] }).까닭, '바로 앞 줄과 같음');
  const 걸림 = [{ 규칙: 'still', 등급: '걸림', 글: `${REPO}${path.sep}docs${path.sep}x.mp4 · 2.1초 멈춤` }, { 규칙: 'ocr-failed', 등급: '확인', 글: '글자 인식 못 함' }];
  assert.equal(이력.남기기({ 편, 눈: '올리기전검사', 단계: '올리기 전', 결과: '걸림', 끝코드: 1, 판: 'ccc333ddd444', 걸림 }).남김, true);
  // 다른 눈의 줄이 끼어도 같은 눈 · 단계의 바로 앞 줄과 견준다
  assert.equal(이력.남기기({ 편, 눈: '최종본검사', 단계: '편집', 결과: '통과', 판: 'ccc333ddd444' }).남김, true);
  assert.equal(이력.남기기({ 편, 눈: '올리기전검사', 단계: '올리기 전', 결과: '걸림', 끝코드: 1, 판: 'ccc333ddd444', 걸림 }).까닭, '바로 앞 줄과 같음');
  const 줄 = 이력줄(편);
  assert.equal(줄.length, 3);
  assert.deepEqual(Object.keys(줄[0]), ['때', '길', '엔진', '판', '단계', '눈', '결과', '끝코드', '걸림']);
  assert.deepEqual([줄[0].길, 줄[0].엔진.영상, 줄[0].걸림.length], ['컷표영상', 'Seedance 2.5 720p', 0]);
  assert.deepEqual(줄[1].걸림.map((x) => [x.규칙, x.등급]), [['still', '걸림'], ['ocr-failed', '확인']]);
  assert.ok(!줄[1].걸림[0].글.includes(REPO), '공개 저장소 — 절대 경로를 걷어 낸다');
  assert.match(줄[1].걸림[0].글, /^docs[\\/]x\.mp4/);
});

test('남기기: 흠갈래.json 「올린검사」 규칙에는 점검표 번호를 단다 · 단계는 부른 도구가 넘긴 SYNK_검사단계가 먼저다', (t) => {
  const 편 = path.join(임시(t), 'yuhobuilds_시험_20261115');
  쓰기(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'yuhobuilds' }));
  const 앞 = process.env.SYNK_검사단계;
  process.env.SYNK_검사단계 = '최종 확인';
  try { 이력.남기기({ 편, 눈: '최종본검사', 단계: '편집', 결과: '걸림', 끝코드: 1, 걸림: [{ 규칙: '굳음', 글: '4.4~5.5초 굳음' }, { 규칙: '같은판', 글: '9.7초' }, { 규칙: '새규칙', 글: '?' }] }); }
  finally { if (앞 === undefined) delete process.env.SYNK_검사단계; else process.env.SYNK_검사단계 = 앞; }
  const [줄] = 이력줄(편);
  assert.equal(줄.단계, '최종 확인');
  assert.equal(줄.길, '그래픽');
  assert.deepEqual(줄.걸림.map((x) => x.번호 ?? null), [26, 50, null]);
});

test('글 다듬기 — 대소문자 · 구분 기호(\\ · / · JSON의 \\\\)가 섞인 저장소 · 홈 경로와 다른 사용자 폴더도 걷어 낸다(GPT 검수 GA1), 파이썬 판도 같다', (t) => {
  const 홈 = os.homedir();
  const 소문자 = (p) => p.replace(/^([A-Z]):/, (m, d) => `${d.toLowerCase()}:`);
  const 글들 = [
    `${소문자(REPO)}\\docs\\x.mp4 멈춤`,
    `${REPO.replace(/\\/g, '/').toUpperCase()}/docs/x.mp4`,
    `${REPO.replace(/\\/g, '\\\\')}\\\\docs\\\\x.mp4`,
    `${소문자(홈)}\\Downloads\\a.mp4`,
    'C:\\Users\\someone\\Desktop\\b.mp4',
  ];
  const 노드 = 글들.map(이력.글다듬기);
  for (const s of 노드) assert.ok(!/users[\\/]+[^\\/~]/i.test(s) && !s.toLowerCase().includes(path.basename(홈).toLowerCase()), `사용자 이름이 남았다: ${s}`);
  assert.equal(노드[0], 'docs\\x.mp4 멈춤');
  assert.equal(노드[1], 'docs/x.mp4');
  if (!파이썬) return;
  const 코드 = `import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("검사이력", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps([m.글다듬기(x) for x in json.loads(sys.stdin.read())], ensure_ascii=False))`;
  const r = spawnSync(py, ['-I', '-X', 'utf8', '-c', 코드, path.join(REPO, 'tools', 'lib', '검사이력.py')], { encoding: 'utf8', input: JSON.stringify(글들), env: 켠환경 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), 노드);
});

test('글 다듬기 — 다른 운영체제의 경로 꼴: POSIX 저장소 경로는 맨 앞 구분 기호까지 걷고, 홈 이름과 앞이 같은 낱말(rootDir · /rootfs)이나 다른 경로 속 같은 이름(/var/root)은 건드리지 않는다(GPT 다시 검수 GA1), 파이썬 판도 같다', (t) => {
  const 묶음 = [
    { 자리: { 저장소: '/home/runner/work/SYNK-appsscript', 홈: '/root' }, 글과바람: [
      ['/home/runner/work/SYNK-appsscript/docs/x.mp4 멈춤', 'docs/x.mp4 멈춤'],
      ['/HOME/RUNNER/work/synk-appsscript\\docs\\x.mp4', 'docs\\x.mp4'],
      ['영상 "/home/runner/work/SYNK-appsscript" 를 못 읽음', '영상 "." 를 못 읽음'],
      ['rootDir 과 /root/a.mp4 와 /var/root/b.mp4 와 /rootfs', 'rootDir 과 ~/a.mp4 와 /var/root/b.mp4 와 /rootfs'],
      ['/home/runner/work/SYNK-appsscript-old/docs/y.mp4', '/home/runner/work/SYNK-appsscript-old/docs/y.mp4'],
    ] },
    { 자리: { 저장소: 'C:\\Users\\tester\\Documents\\SYNK-appsscript', 홈: 'C:\\Users\\tester' }, 글과바람: [
      ['c:/users/tester/documents/synk-appsscript/docs/x.mp4', 'docs/x.mp4'],
      ['C:\\\\Users\\\\tester\\\\Documents\\\\SYNK-appsscript\\\\docs\\\\x.mp4', 'docs\\\\x.mp4'],
      ['C:\\Users\\tester\\Downloads\\a.mp4', '~\\Downloads\\a.mp4'],
      ['C:\\Users\\tester2\\Desktop\\b.mp4', '~\\Desktop\\b.mp4'],
    ] },
  ];
  for (const { 자리, 글과바람 } of 묶음) {
    for (const [글, 바람] of 글과바람) assert.equal(이력.글다듬기(글, 자리), 바람, `노드 판: ${글}`);
  }
  if (!파이썬) return;
  const 코드 = `import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("검사이력", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps([[m.글다듬기(x, g["자리"]["저장소"], g["자리"]["홈"]) for x, _ in g["글과바람"]] for g in json.loads(sys.stdin.read())], ensure_ascii=False))`;
  const r = spawnSync(py, ['-I', '-X', 'utf8', '-c', 코드, path.join(REPO, 'tools', 'lib', '검사이력.py')], { encoding: 'utf8', input: JSON.stringify(묶음), env: 켠환경 });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), 묶음.map((g) => g.글과바람.map(([, 바람]) => 바람)));
});

test('남기기는 던지지 않는다 — 편을 못 찾음 · 시험 픽스처 · 끔 · 덧붙일 수 없는 자리(폴더)는 조용히 건너뛰고 까닭만 돌려준다', (t) => {
  const 뿌리 = 임시(t);
  assert.equal(이력.남기기({ 시작: path.join(뿌리, '없는', '영상.mp4'), 눈: 'x', 결과: '통과' }).남김, false);
  const 픽스처 = path.join(뿌리, 'tests', 'fixtures', '편');
  쓰기(path.join(픽스처, '컷순서.json'), '{}');
  assert.deepEqual(이력.남기기({ 시작: path.join(픽스처, '컷순서.json'), 눈: 'x', 결과: '통과' }), { 남김: false, 까닭: '편 폴더를 못 찾음' });
  assert.ok(!fs.existsSync(path.join(픽스처, '게시')), '픽스처에는 게시 폴더도 만들지 않는다');
  const 편 = path.join(뿌리, 'LAB_시험');
  쓰기(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB' }));
  fs.mkdirSync(path.join(편, '게시', 이력.HISTORY));   // 파일 자리에 폴더 — 덧붙이기가 실패한다
  const r = 이력.남기기({ 편, 눈: 'x', 결과: '걸림', 걸림: [{ 규칙: 'a', 글: 'b' }] });
  assert.equal(r.남김, false);
  assert.ok(r.까닭);
  const 앞 = process.env.SYNK_검사이력;
  process.env.SYNK_검사이력 = '끔';
  try { assert.equal(이력.남기기({ 편, 눈: 'x', 결과: '통과' }).까닭, 'SYNK_검사이력=끔'); } finally { if (앞 === undefined) delete process.env.SYNK_검사이력; else process.env.SYNK_검사이력 = 앞; }
  assert.equal(이력.길of(편), 'LAB');
});

test('CRLF로 체크아웃된 이력에는 CRLF로, 끝 줄바꿈이 없는 이력에는 줄을 띄우고 덧붙인다', (t) => {
  const 편 = path.join(임시(t), 'synkbrief_줄끝');
  쓰기(path.join(편, '게시', '준비.json'), '{}');
  const 파일 = 쓰기(path.join(편, '게시', 이력.HISTORY), '{"눈":"옛","단계":"옛","결과":"통과","걸림":[]}\r\n');
  이력.남기기({ 편, 눈: 'x', 단계: 'y', 결과: '통과' });
  assert.match(fs.readFileSync(파일, 'utf8'), /^\{[^\n]*\}\r\n\{[^\n]*\}\r\n$/);
  fs.writeFileSync(파일, '{"눈":"옛","단계":"옛","결과":"통과","걸림":[]}');
  이력.남기기({ 편, 눈: 'x', 단계: 'y', 결과: '통과' });
  assert.equal(이력줄(편).length, 2);
});

test('파이썬 판과 노드 판이 같은 줄을 만든다(때 말고) — 칸 차례 · 번호 · 글 다듬기 · 길', { skip: !파이썬 && '파이썬 없음' }, (t) => {
  const 편 = path.join(임시(t), 'synkbrief_두판');
  쓰기(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'synkbrief' }));
  쓰기(path.join(편, '컷순서.json'), '{}');
  const 걸림 = [{ 규칙: '소품', 등급: '걸림', 글: '  C3:\n봉투가   갑자기 생김 ' }, { 규칙: '틀', 등급: '확인', 글: 'x'.repeat(300) }];
  const 입력 = { 눈: '컷연속성검사', 단계: '콘티', 결과: '걸림', 끝코드: 1, 판: 'abc', 걸림 };
  const 노드 = 이력.줄만들기({ ...입력, 편 });
  const 코드 = `import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("검사이력", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
a = json.loads(sys.argv[3])
print(json.dumps(m.줄만들기(sys.argv[2], a["눈"], a["단계"], a["결과"], a["끝코드"], a["판"], a["걸림"]), ensure_ascii=False))`;
  const r = spawnSync(py, ['-I', '-X', 'utf8', '-c', 코드, path.join(REPO, 'tools', 'lib', '검사이력.py'), 편, JSON.stringify(입력)], { encoding: 'utf8', env: 켠환경 });
  assert.equal(r.status, 0, r.stderr);
  const 파이 = JSON.parse(r.stdout);
  delete 노드.때; delete 파이.때;
  assert.deepEqual(JSON.stringify(파이), JSON.stringify(노드));
  assert.equal(노드.걸림[0].번호, 41);
  assert.equal(노드.걸림[1].글.length, 200);
});

// ── 도구마다: 켬 · 끔 · 쓰기 실패의 출력과 끝 코드가 같다 ──
function 세번(t, 만들기, 돌리기) {
  const 결과 = {};
  for (const 판 of ['켬', '끔', '실패']) {
    const 뿌리 = 임시(t, `synk-hist-${판}-`);
    const 편 = 만들기(뿌리);
    if (판 === '실패') fs.mkdirSync(path.join(편, '게시', 이력.HISTORY), { recursive: true });
    const r = 돌리기(편, 판 === '끔' ? 끈환경 : 켠환경);
    결과[판] = { 코드: r.status, 출력: String(r.stdout).split(뿌리).join('<뿌리>'), 편 };
  }
  assert.equal(결과.켬.코드, 결과.끔.코드);
  assert.equal(결과.실패.코드, 결과.끔.코드);
  assert.equal(결과.켬.출력, 결과.끔.출력);
  assert.equal(결과.실패.출력, 결과.끔.출력);
  assert.ok(fs.statSync(path.join(결과.실패.편, '게시', 이력.HISTORY)).isDirectory(), '실패 판은 그대로 폴더다');
  assert.equal(이력줄(결과.끔.편).length, 0, '끈 실행은 줄을 쓰지 않는다');
  return 결과;
}

const 문앞 = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '컷연속성검사', '문앞_컷순서.json'), 'utf8');
const 쪽지지도 = fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '컷연속성검사', '쪽지지도.json'), 'utf8');

test('컷연속성검사.py — 이력을 켜도 · 꺼도 · 못 써도 출력과 끝 코드가 같고, 켠 실행은 콘티 단계 한 줄을 남긴다', { skip: !파이썬 && '파이썬 없음' }, (t) => {
  const 도구 = path.join(REPO, 'tools', '컷연속성검사.py');
  const 만들기 = (뿌리) => { const 편 = path.join(뿌리, 'synkbrief_문앞'); 쓰기(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'synkbrief' })); 쓰기(path.join(편, '컷순서.json'), 문앞); 쓰기(path.join(편, '쪽지지도.json'), 쪽지지도); return 편; };
  for (const 꼴 of [[], ['--json']]) {
    const r = 세번(t, 만들기, (편, env) => spawnSync(py, ['-I', '-X', 'utf8', 도구, path.join(편, '컷순서.json'), ...꼴], { encoding: 'utf8', env }));
    assert.equal(r.켬.코드, 0);
    const 줄 = 이력줄(r.켬.편);
    assert.equal(줄.length, 1);
    assert.deepEqual([줄[0].눈, 줄[0].단계, 줄[0].결과, 줄[0].끝코드, 줄[0].길], ['컷연속성검사', '콘티', '통과', 0, '컷표영상']);
    assert.match(줄[0].판, /^[0-9a-f]{12}$/);
  }
  // 지시문 하위 명령 — 지시문 파일에서 위로 편을 찾는다. 실내 눈 낱말은 걸림(끝 코드 1)
  const 만들기2 = (뿌리) => { const 편 = 만들기(뿌리); 쓰기(path.join(편, '꾸러미', 'A1.txt'), 'ACTION: 0-2s she breathes. Snowflakes drift in the room.\n'); return 편; };
  const r2 = 세번(t, 만들기2, (편, env) => spawnSync(py, ['-I', '-X', 'utf8', 도구, '지시문', path.join(편, '꾸러미', 'A1.txt'), '--실내', 'A1'], { encoding: 'utf8', env }));
  const [줄2] = 이력줄(r2.켬.편);
  assert.equal(줄2.단계, '지시문');
  assert.equal(줄2.끝코드, r2.켬.코드);
  assert.equal(줄2.결과, { 0: '통과', 1: '걸림', 2: '확인' }[r2.켬.코드]);
});

test('받은뒤검사.py — 이력을 켜도 · 꺼도 · 못 써도 출력과 끝 코드가 같고, 켠 실행은 받은 뒤 단계 한 줄을 남긴다', { skip: !파이썬 && '파이썬 없음' }, (t) => {
  const 도구 = path.join(REPO, 'tools', '받은뒤검사.py');
  const 만들기 = (뿌리) => {
    const 편 = path.join(뿌리, 'synkbrief_받음');
    쓰기(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'synkbrief' }));
    쓰기(path.join(편, '컷표.json'), JSON.stringify({ 틀: 2, 편: { 비율: '9:16' }, detail: [{ cut: 'C1', t: 0, dur: 2, in: 0, out: 2, 인물: [] }] }));
    return 편;
  };
  const r = 세번(t, 만들기, (편, env) => spawnSync(py, ['-X', 'utf8', 도구, 편, '--연속성안함'], { encoding: 'utf8', env }));
  const [줄] = 이력줄(r.켬.편);
  assert.deepEqual([줄.눈, 줄.단계, 줄.끝코드], ['받은뒤검사', '받은 뒤', r.켬.코드]);
});

test('올리기전검사.js — 이력을 켜도 · 꺼도 · 못 써도 출력과 끝 코드가 같고, 켠 실행은 올리기 전 단계 한 줄(걸린 규칙 이름과 등급)을 남긴다', (t) => {
  const 도구 = path.join(REPO, 'tools', '올리기전검사.js');
  const 만들기 = (뿌리) => {
    fs.mkdirSync(path.join(뿌리, 'tools'), { recursive: true });
    const 편 = path.join(뿌리, 'docs', '마케팅', 'yuhobuilds_올리기_20261115');
    쓰기(path.join(편, '게시', '준비.json'), JSON.stringify({ 브랜드: 'yuhobuilds', 슬롯: '2026-11-20', 판: [] }));
    return 편;
  };
  const r = 세번(t, 만들기, (편, env) => spawnSync(process.execPath, [도구, 편, '--링크건너뛰기', '--글자인식건너뛰기'], { encoding: 'utf8', env, timeout: 120000 }));
  const 줄 = 이력줄(r.켬.편);
  assert.equal(줄.length, 1);
  assert.deepEqual([줄[0].눈, 줄[0].단계, 줄[0].길], ['올리기전검사', '올리기 전', '그래픽']);
  assert.equal(줄[0].끝코드, r.켬.코드);
  assert.ok(줄[0].걸림.every((x) => x.규칙 && ['걸림', '확인'].includes(x.등급)));
  assert.equal(줄[0].결과 === '걸림', r.켬.코드 === 1);
});
