/* 그림굽기 — 편마다 복사하던 굽기 사본을 대신하는 공용 도구(tools/그림굽기.js, 2026-11-11).
 *
 * ① 옛 사본(tests/fixtures/그림굽기/옛사본_굽기.cjs — 11-11 origin의 가장 흔한 판)과 새 도구를 같은 가짜 codex계정으로 돌려
 *    넘긴 인자 · 표준입력 · 구운 판 · 기록이 같은지 본다.
 * ② 새 도구만의 것: 계정이 바뀌면 마지막 thread, --판, 덮지 않기(그림 · 답 · 사건이 같은 줄기), 연결 폴더 계정, 참고 다섯 장 한도,
 *    편 폴더 기준 경로, 부르기 전에 멈춤, 종료 코드 그대로, 실패해도 사건 기록은 끝까지.
 * 새 사본을 막는 시험은 tests/굽기사본금지.test.js에 따로 있다.
 * 진짜 Codex · ~/.codex · ~/.codex-bake는 건드리지 않는다 — 홈 폴더(USERPROFILE · HOME)를 임시 폴더로 돌리고 가짜 codex계정만 부른다.
 */
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구 = path.join(REPO, 'tools', '그림굽기.js');
const 자료 = path.join(__dirname, 'fixtures', '그림굽기');
const 옛사본 = path.join(자료, '옛사본_굽기.cjs');
const 그림 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/* 이 시험이 만든 임시 폴더는 끝에 치운다(무대 뿌리 · 옛 사본이 남기는 빈 일터). 남의 폴더는 건드리지 않는다. */
const 치울것 = new Set();
after(() => {
  for (const d of 치울것) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 열려 있으면 둔다 */ } }
});

/* 가짜 codex계정 — 받은 인자 · 표준입력 · 일한 폴더를 FAKE_LOG에 적고, FAKE_MODE대로 사건 줄과 그림을 낸다.
 *   ok      thread t-1(FAKE_THREAD로 바꾼다 — 진짜 Codex는 굽기마다 다르다), 그림 한 장(FAKE_HOME_DIR/generated_images/<thread>/ig_1.png).
 *           FAKE_BODY가 있으면 그 글자가 그림 바이트다
 *   바뀜    thread t-old(다른 그림) 뒤에 t-new(진짜 그림) — 한도에 걸려 계정이 바뀐 꼴
 *   둘      thread t-1에 그림 두 장
 *   끝줄    thread 줄을 줄바꿈 없이 끝낸다
 *   실없음  thread 줄이 없다
 *   밖실    thread_id가 폴더 밖을 가리키는 꼴
 *   큰실패  사건을 2MB쯤 쏟고 종료 7
 *   없음    굽기 계정이 없을 때처럼 종료 3 */
const 가짜글 = `
const fs = require('fs'); const path = require('path');
const a = process.argv.slice(2); const 값 = (f) => a[a.indexOf(f) + 1];
let 입력 = ''; process.stdin.on('data', (d) => { 입력 += d; });
process.stdin.on('end', () => {
  fs.writeFileSync(process.env.FAKE_LOG, JSON.stringify({ 인자: a, 입력, cwd: process.cwd(), 일터있음: fs.existsSync(값('-C')) }));
  const 모드 = process.env.FAKE_MODE; const 집 = process.env.FAKE_HOME_DIR;
  const png = process.env.FAKE_BODY ? Buffer.from(process.env.FAKE_BODY) : Buffer.from(process.env.FAKE_PNG, 'base64');
  const 두기 = (실, 이름, 몸) => { const d = path.join(집, 'generated_images', 실); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 이름), 몸); };
  if (모드 === '없음') { process.stderr.write('[codex계정] 쓸 수 있는 굽기 계정이 없다\\n'); process.exit(3); }
  if (모드 === '실없음') { process.stdout.write('{"type":"turn.started"}\\n'); return; }
  if (모드 === '밖실') { process.stdout.write('{"type":"thread.started","thread_id":"../t-1"}\\n'); 두기('t-1', 'ig_1.png', png); return; }
  if (모드 === '큰실패') {
    const 줄 = JSON.stringify({ type: 'item.completed', text: 'x'.repeat(1000) }) + '\\n';
    process.stdout.write('{"type":"thread.started","thread_id":"t-1"}\\n' + 줄.repeat(2000), () => process.exit(7));
    return;
  }
  if (모드 === '바뀜') {
    process.stdout.write('{"type":"thread.started","thread_id":"t-old"}\\n');
    두기('t-old', 'ig_old.png', Buffer.from('옛 thread의 그림'));
    process.stdout.write('{"type":"thread.started","thread_id":"t-new"}\\n');
    두기('t-new', 'ig_new.png', png);
  } else if (모드 === '끝줄') {
    두기('t-1', 'ig_1.png', png);
    process.stdout.write('{"type":"turn.started"}\\n{"type":"thread.started","thread_id":"t-1"}');
  } else {
    const 실 = process.env.FAKE_THREAD || 't-1';
    process.stdout.write('{"type":"thread.started","thread_id":"' + 실 + '"}\\n{"type":"turn.started"}\\n');
    두기(실, 'ig_1.png', png);
    if (모드 === '둘') 두기(실, 'ig_2.jpg', Buffer.from('둘째 그림'));
  }
  fs.writeFileSync(값('-o'), '구웠다\\n');
});
`;

/** 임시 무대 — 홈(진짜 홈 대신) · 보조 계정 폴더 · 편 폴더 · 지시문 · 참고 그림 · 가짜 codex계정 */
function 무대() {
  const t = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-bake-test-')));
  치울것.add(t);
  const 홈 = path.join(t, '홈');
  const 계정 = path.join(홈, '.codex-bake', 'bake1');
  fs.mkdirSync(계정, { recursive: true });
  const 편 = path.join(t, '편', 'LAB_시험_20261111');
  fs.mkdirSync(path.join(편, '판', '참고'), { recursive: true });
  const 지시문 = path.join(편, '판', '바다.txt');
  fs.writeFileSync(지시문, '펠트 몽글이 바닷가에서 물개를 본다. 세로 2:3.\n');
  const 참고1 = path.join(편, '판', '참고', '몽글 정본.jpg');
  const 참고2 = path.join(편, '판', '참고', '바탕.png');
  fs.writeFileSync(참고1, 'jpg');
  fs.writeFileSync(참고2, 'png');
  const 가짜 = path.join(t, '가짜', 'codex계정.js');
  fs.mkdirSync(path.dirname(가짜), { recursive: true });
  fs.writeFileSync(가짜, 가짜글);
  const env = (모드, 더 = {}) => ({
    ...process.env, USERPROFILE: 홈, HOME: 홈, CODEX_HOME: '', CODEX_BAKE_DIR: '', SYNK_굽기_시각: '',
    SYNK_CODEX_ROTATE: 가짜, FAKE_MODE: 모드, FAKE_THREAD: '', FAKE_HOME_DIR: 계정, FAKE_PNG: 그림.toString('base64'), FAKE_BODY: '', FAKE_LOG: path.join(t, '받은것.json'), ...더,
  });
  return { t, 홈, 계정, 편, 지시문, 참고1, 참고2, 가짜, env, 받은것: () => JSON.parse(fs.readFileSync(path.join(t, '받은것.json'), 'utf8')) };
}

function 돌리기(스크립트, 인자, env, cwd = REPO) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [스크립트, ...인자], { cwd, env });
    let 출력 = '';
    let 오류 = '';
    c.stdout.on('data', (d) => { 출력 += d; });
    c.stderr.on('data', (d) => { 오류 += d; });
    c.on('close', (code) => resolve({ code, 출력, 오류 }));
  });
}

/** 폴더 안 파일을 { 상대 경로(시분초는 <시각>) : 바이트 }로 */
function 담긴것(폴더) {
  const 결과 = {};
  const 걷기 = (d, 앞) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1))) {
      const rel = 앞 ? `${앞}/${e.name}` : e.name;
      if (e.isDirectory()) 걷기(path.join(d, e.name), rel);
      else 결과[rel.replace(/_\d{6}/g, '_<시각>')] = fs.readFileSync(path.join(d, e.name)).toString('base64');
    }
  };
  걷기(폴더, '');
  return 결과;
}
const 이름들 = (폴더) => fs.readdirSync(폴더).filter((f) => f !== '_기록' && f !== '참고' && !f.endsWith('.txt')).sort();

test('옛 사본과 새 도구 — 같은 가짜 codex계정에 같은 인자 · 같은 지시문을 넘기고 같은 자리에 같은 그림 · 기록을 남긴다', async () => {
  const m = 무대();
  // 옛 사본은 자기 자리에서 세 칸 위를 저장소 뿌리로 보고 tools/codex계정.js를 부른다 — 그 꼴의 가짜 저장소를 만든다
  const 가짜저장소 = path.join(m.t, '저장소');
  const 옛편 = path.join(가짜저장소, 'docs', '마케팅', 'LAB_시험_20261111');
  fs.mkdirSync(path.join(옛편, '판', '참고'), { recursive: true });
  fs.mkdirSync(path.join(가짜저장소, 'tools'), { recursive: true });
  fs.copyFileSync(m.가짜, path.join(가짜저장소, 'tools', 'codex계정.js'));
  fs.copyFileSync(옛사본, path.join(옛편, '굽기.cjs'));
  for (const f of ['바다.txt', '참고/몽글 정본.jpg', '참고/바탕.png']) fs.copyFileSync(path.join(m.편, '판', f), path.join(옛편, '판', f));

  const 옛 = await 돌리기(path.join(옛편, '굽기.cjs'), ['판/바다.txt', '바다', '판/참고/몽글 정본.jpg', '판/참고/바탕.png'], m.env('ok', { FAKE_LOG: path.join(m.t, '옛.json') }), 옛편);
  assert.strictEqual(옛.code, 0, 옛.오류);
  const 새 = await 돌리기(도구, [m.편, '판/바다.txt', '바다', '판/참고/몽글 정본.jpg', '판/참고/바탕.png'], m.env('ok', { FAKE_LOG: path.join(m.t, '새.json') }), m.편);
  assert.strictEqual(새.code, 0, 새.오류);

  const 옛받은 = JSON.parse(fs.readFileSync(path.join(m.t, '옛.json'), 'utf8'));
  const 새받은 = JSON.parse(fs.readFileSync(path.join(m.t, '새.json'), 'utf8'));
  // 편 폴더 · 임시 폴더 · 시분초만 가린 인자가 순서까지 같다
  const 일터 = (받은) => 받은.인자[받은.인자.indexOf('-C') + 1];
  치울것.add(일터(옛받은)); // 옛 사본은 빈 일터를 남긴다
  const 가림 = (받은, 편) => 받은.인자.map((x, i) => {
    if (받은.인자[i - 1] === '-C') { assert.ok(path.dirname(x) === fs.realpathSync(os.tmpdir()) || path.dirname(x) === os.tmpdir(), `임시 폴더가 아니다: ${x}`); return '<일터>'; }
    return x.split(편).join('<편>').replace(/_\d{6}/g, '_<시각>').replace(/\\/g, '/');
  });
  assert.deepStrictEqual(가림(새받은, m.편), 가림(옛받은, 옛편));
  assert.deepStrictEqual(가림(새받은, m.편), ['exec', '--json', '--skip-git-repo-check', '-C', '<일터>', '-s', 'read-only',
    '-i', '<편>/판/참고/몽글 정본.jpg', '-i', '<편>/판/참고/바탕.png', '-o', '<편>/판/_기록/바다_<시각>_답.txt', '-']);
  assert.strictEqual(새받은.입력, 옛받은.입력);
  assert.strictEqual(새받은.입력, fs.readFileSync(m.지시문, 'utf8'));
  // 부른 자리는 저마다의 저장소 뿌리이고, 부르는 동안 빈 일터가 있다
  assert.strictEqual(fs.realpathSync(옛받은.cwd), fs.realpathSync(가짜저장소));
  assert.strictEqual(fs.realpathSync(새받은.cwd), fs.realpathSync(REPO));
  assert.strictEqual(새받은.일터있음, true);
  // 구운 판 폴더에 남은 것(그림 · 답 · 사건)이 이름 · 바이트까지 같다
  assert.deepStrictEqual(담긴것(path.join(m.편, '판')), 담긴것(path.join(옛편, '판')));
  assert.deepStrictEqual(Object.keys(담긴것(path.join(m.편, '판'))).sort(),
    ['_기록/바다_<시각>_답.txt', '_기록/바다_<시각>_사건.jsonl', '바다.txt', '바다_<시각>.png', '참고/몽글 정본.jpg', '참고/바탕.png'].sort());
  assert.match(새.출력, /\[굽기\] 바다 → .*바다_\d{6}\.png · 계정 bake1 · thread t-1 · \d+초/);
  assert.match(옛.출력, /\[굽기\] 바다 → .*바다_\d{6}\.png · 계정 bake1 · thread t-1 · \d+초/);
  // 새 도구는 쓰고 난 빈 일터를 치운다
  assert.ok(!fs.existsSync(일터(새받은)), '새 도구가 빈 일터를 남겼다');
});

test('계정이 바뀌어 thread가 새로 열리면 마지막 thread의 그림을 옮긴다', async () => {
  const m = 무대();
  const r = await 돌리기(도구, [m.편, m.지시문, '바다'], m.env('바뀜'));
  assert.strictEqual(r.code, 0, r.오류);
  const 판 = 이름들(path.join(m.편, '판'));
  assert.strictEqual(판.length, 1);
  assert.match(판[0], /^바다_\d{6}\.png$/);
  assert.ok(fs.readFileSync(path.join(m.편, '판', 판[0])).equals(그림));
  assert.match(r.출력, /thread t-new/);
});

test('그림이 여러 장이면 번호를 붙이고, thread 줄이 줄바꿈 없이 끝나도 읽는다', async () => {
  const m = 무대();
  const 둘 = await 돌리기(도구, [m.편, m.지시문, '바다'], m.env('둘', { SYNK_굽기_시각: '101010' }));
  assert.strictEqual(둘.code, 0, 둘.오류);
  assert.deepStrictEqual(이름들(path.join(m.편, '판')), ['바다_101010_1.png', '바다_101010_2.jpg']);

  const m2 = 무대();
  const 끝 = await 돌리기(도구, [m2.편, m2.지시문, '바다'], m2.env('끝줄'));
  assert.strictEqual(끝.code, 0, 끝.오류);
  assert.match(끝.출력, /thread t-1/);
});

test('--판으로 구운 판 폴더를 바꾼다 — 편 폴더 기준 이름이나 절대 경로', async () => {
  const m = 무대();
  const a = await 돌리기(도구, [m.편, m.지시문, '바다', '--판', '구운판'], m.env('ok'));
  assert.strictEqual(a.code, 0, a.오류);
  assert.strictEqual(fs.readdirSync(path.join(m.편, '구운판')).filter((f) => /^바다_\d{6}\.png$/.test(f)).length, 1);
  assert.ok(fs.existsSync(path.join(m.편, '구운판', '_기록')));

  const 밖 = path.join(m.t, '밖', '판');
  const b = await 돌리기(도구, ['--판', 밖, m.편, m.지시문, '바다'], m.env('ok'));
  assert.strictEqual(b.code, 0, b.오류);
  assert.strictEqual(fs.readdirSync(밖).filter((f) => /^바다_\d{6}\.png$/.test(f)).length, 1);
});

test('지시문 · 참고 그림은 지금 폴더 기준으로 먼저, 없으면 편 폴더 기준으로 찾는다', async () => {
  const m = 무대();
  // 저장소 뿌리에서 편 폴더 기준 경로로 부른다(머리말의 예)
  const r = await 돌리기(도구, [m.편, '판/바다.txt', '바다', '판/참고/바탕.png'], m.env('ok'), REPO);
  assert.strictEqual(r.code, 0, r.오류);
  const 받은 = m.받은것();
  assert.strictEqual(받은.인자[받은.인자.indexOf('-i') + 1], m.참고2);
  assert.strictEqual(받은.입력, fs.readFileSync(m.지시문, 'utf8'));
  // 편 폴더에 없는 경로는 지금 폴더 기준으로 찾는다
  const 여기 = path.join(m.t, '여기');
  fs.mkdirSync(path.join(여기, '판'), { recursive: true });
  fs.writeFileSync(path.join(여기, '판', '여기만.txt'), '지금 폴더의 지시문\n');
  const r2 = await 돌리기(도구, [m.편, '판/여기만.txt', '바다2'], m.env('ok'), 여기);
  assert.strictEqual(r2.code, 0, r2.오류);
  assert.strictEqual(m.받은것().입력, '지금 폴더의 지시문\n');
  // 두 기준에 서로 다른 파일이 다 있으면 고르지 않고 멈춘다 — 다른 편의 지시문으로 조용히 굽지 않는다
  fs.writeFileSync(path.join(여기, '판', '바다.txt'), '다른 편의 지시문\n');
  fs.rmSync(path.join(m.t, '받은것.json'));
  const r3 = await 돌리기(도구, [m.편, '판/바다.txt', '바다3'], m.env('ok'), 여기);
  assert.strictEqual(r3.code, 2, r3.오류);
  assert.match(r3.오류, /같은 경로가 지금 폴더와 편 폴더에 다 있다/);
  assert.ok(!fs.existsSync(path.join(m.t, '받은것.json')), '멈췄어야 하는데 codex계정을 불렀다');
  // 편 폴더 안에서 부르면 두 기준이 같은 파일이라 그대로 간다
  const r4 = await 돌리기(도구, [m.편, '판/바다.txt', '바다4'], m.env('ok'), m.편);
  assert.strictEqual(r4.code, 0, r4.오류);
});

test('보조 계정 폴더는 codex계정과 같은 자리(CODEX_BAKE_DIR)를 보고, 연결로 둔 계정 폴더와 ~/.codex의 그림도 찾는다', async () => {
  const m = 무대();
  const 다른뿌리 = path.join(m.t, '다른뿌리');
  const 계정 = path.join(다른뿌리, 'bake9');
  fs.mkdirSync(계정, { recursive: true });
  const a = await 돌리기(도구, [m.편, m.지시문, '가'], m.env('ok', { CODEX_BAKE_DIR: 다른뿌리, FAKE_HOME_DIR: 계정, FAKE_THREAD: 't-a' }));
  assert.strictEqual(a.code, 0, a.오류);
  assert.match(a.출력, /계정 bake9/);

  // 계정 폴더가 다른 곳을 가리키는 연결(Windows junction · 그 밖은 심링크)
  const 진짜 = path.join(m.t, '진짜계정');
  fs.mkdirSync(진짜, { recursive: true });
  const 연결 = path.join(m.홈, '.codex-bake', 'bakeJ');
  fs.symlinkSync(진짜, 연결, 'junction');
  const b = await 돌리기(도구, [m.편, m.지시문, '나'], m.env('ok', { FAKE_HOME_DIR: 진짜, FAKE_THREAD: 't-b' }));
  assert.strictEqual(b.code, 0, b.오류);
  assert.match(b.출력, /계정 bakeJ/);

  const 기본 = path.join(m.홈, '.codex');
  fs.mkdirSync(기본, { recursive: true });
  const c = await 돌리기(도구, [m.편, m.지시문, '다'], m.env('ok', { FAKE_HOME_DIR: 기본, FAKE_THREAD: 't-c' }));
  assert.strictEqual(c.code, 0, c.오류);
  assert.match(c.출력, /계정 \.codex/);

  // 부른 쪽의 CODEX_HOME은 보지 않는다 — codex계정이 그 값을 지우거나 덮고 부른다. 같은 계정 폴더를 두 번 훑어 그림이 둘이 되지 않는다
  const d = await 돌리기(도구, [m.편, m.지시문, '라'], m.env('ok', { CODEX_HOME: m.계정, SYNK_굽기_시각: '111111', FAKE_THREAD: 't-d' }));
  assert.strictEqual(d.code, 0, d.오류);
  assert.deepStrictEqual(이름들(path.join(m.편, '판')).filter((f) => f.startsWith('라_')), ['라_111111.png']);
});

test('같은 이름 · 같은 초에 다시 구워도 그림 · 답 · 사건을 덮지 않고 같은 줄기로 짝을 맞춘다', async () => {
  const m = 무대();
  const 판 = path.join(m.편, '판');
  let 번 = 0;
  const 굽기 = (몸) => 돌리기(도구, [m.편, m.지시문, '바다'], m.env('ok', { SYNK_굽기_시각: '101010', FAKE_BODY: 몸, FAKE_THREAD: `t-${++번}` }));
  for (const 몸 of ['첫째', '둘째', '셋째']) { const r = await 굽기(몸); assert.strictEqual(r.code, 0, r.오류); }
  assert.deepStrictEqual(이름들(판), ['바다_101010.png', '바다_101010_2.png', '바다_101010_3.png']);
  assert.strictEqual(fs.readFileSync(path.join(판, '바다_101010.png'), 'utf8'), '첫째');
  assert.strictEqual(fs.readFileSync(path.join(판, '바다_101010_2.png'), 'utf8'), '둘째');
  assert.strictEqual(fs.readFileSync(path.join(판, '바다_101010_3.png'), 'utf8'), '셋째');
  assert.deepStrictEqual(fs.readdirSync(path.join(판, '_기록')).sort(), ['바다_101010_2_답.txt', '바다_101010_2_사건.jsonl', '바다_101010_3_답.txt', '바다_101010_3_사건.jsonl', '바다_101010_답.txt', '바다_101010_사건.jsonl'].sort());

  // 실패한 굽기의 사건 기록도 다음 굽기가 덮지 않는다
  const 실패 = await 돌리기(도구, [m.편, m.지시문, '바다'], m.env('실없음', { SYNK_굽기_시각: '101010' }));
  assert.strictEqual(실패.code, 1);
  assert.ok(fs.existsSync(path.join(판, '_기록', '바다_101010_4_사건.jsonl')));
  const 다음 = await 굽기('다섯째');
  assert.strictEqual(다음.code, 0, 다음.오류);
  assert.strictEqual(fs.readFileSync(path.join(판, '바다_101010_5.png'), 'utf8'), '다섯째');
  assert.strictEqual(fs.readFileSync(path.join(판, '_기록', '바다_101010_4_사건.jsonl'), 'utf8'), '{"type":"turn.started"}\n');

  // 기록 없이 그림만 있는 같은 줄기(옛 사본이 굽는 중이거나 손으로 옮긴 판)도 덮지 않는다
  fs.writeFileSync(path.join(판, '물개_121212.png'), '먼저 있던 판');
  const 물개 = await 돌리기(도구, [m.편, m.지시문, '물개'], m.env('ok', { SYNK_굽기_시각: '121212', FAKE_BODY: '새 판', FAKE_THREAD: 't-seal' }));
  assert.strictEqual(물개.code, 0, 물개.오류);
  assert.strictEqual(fs.readFileSync(path.join(판, '물개_121212.png'), 'utf8'), '먼저 있던 판');
  assert.strictEqual(fs.readFileSync(path.join(판, '물개_121212_2.png'), 'utf8'), '새 판');
});

test('같은 이름으로 동시에 구워도 그림과 기록이 굽기마다 한 벌씩 남는다', async () => {
  const m = 무대();
  const 판 = path.join(m.편, '판');
  // 같은 계정으로 세 세션이 같은 초에 굽는다 — thread는 굽기마다 다르다
  const 결과 = await Promise.all(['가', '나', '다'].map((몸, i) => 돌리기(도구, [m.편, m.지시문, '바다'],
    m.env('ok', { SYNK_굽기_시각: '131313', FAKE_BODY: 몸, FAKE_THREAD: `t-${i}`, FAKE_LOG: path.join(m.t, `받은것${i}.json`) }))));
  for (const r of 결과) assert.strictEqual(r.code, 0, r.오류);
  assert.deepStrictEqual(이름들(판), ['바다_131313.png', '바다_131313_2.png', '바다_131313_3.png']);
  assert.deepStrictEqual(이름들(판).map((f) => fs.readFileSync(path.join(판, f), 'utf8')).sort(), ['가', '나', '다']);
  assert.strictEqual(fs.readdirSync(path.join(판, '_기록')).length, 6);
  // 기록의 답 경로와 그림이 같은 줄기다
  결과.forEach((r, i) => {
    const 받은 = JSON.parse(fs.readFileSync(path.join(m.t, `받은것${i}.json`), 'utf8'));
    const 줄기 = path.basename(받은.인자[받은.인자.indexOf('-o') + 1]).replace(/_답\.txt$/, '');
    assert.ok(r.출력.includes(`${줄기}.png`), `${줄기}의 그림 줄이 없다: ${r.출력}`);
  });
});

test('인자가 틀리면 codex계정을 부르기 전에 멈춘다(종료 2)', async () => {
  const m = 무대();
  const 부르지않음 = async (인자, 무늬) => {
    const r = await 돌리기(도구, 인자, m.env('ok'));
    assert.strictEqual(r.code, 2, `${인자.join(' ')} → ${r.code} ${r.오류}`);
    assert.match(r.오류, 무늬);
    assert.ok(!fs.existsSync(path.join(m.t, '받은것.json')), '멈췄어야 하는데 codex계정을 불렀다');
  };
  await 부르지않음([m.편, m.지시문], /편 폴더 · 지시문 · 이름/);
  await 부르지않음([path.join(m.t, '없는편'), m.지시문, '바다'], /편 폴더가 없다/);
  await 부르지않음([m.편, path.join(m.편, '판', '없는.txt'), '바다'], /지시문 파일이 없다/);
  fs.writeFileSync(path.join(m.편, '판', '빈.txt'), '﻿ \n');
  await 부르지않음([m.편, path.join(m.편, '판', '빈.txt'), '바다'], /지시문이 비었다/);
  await 부르지않음([m.편, m.지시문, '바다', path.join(m.편, '판', '참고', '없는그림.jpg')], /참고 그림이 없다/);
  await 부르지않음([m.편, m.지시문, '../바다'], /이름은 파일 이름으로/);
  await 부르지않음([m.편, m.지시문, '바다', '--크기', '2:3'], /모르는 인자/);
  await 부르지않음([m.편, m.지시문, '바다', '--판'], /--판 뒤에 폴더가 없다/);
  // 옛 사본 꼴(편 폴더 없이 지시문부터)로 부르면 멈춘다
  await 부르지않음(['판/바다.txt', '바다'], /편 폴더 · 지시문 · 이름/);
  // 참고 그림은 다섯 장까지
  const 여섯 = Array.from({ length: 6 }, () => m.참고1);
  await 부르지않음([m.편, m.지시문, '바다', ...여섯], /참고 그림은 5장까지다\(6장을 줬다\)/);
  assert.ok(!fs.existsSync(path.join(m.편, '판', '_기록')), '멈춘 굽기가 기록 폴더를 만들었다');
});

test('참고 다섯 장은 순서대로 넘기고, --참고제한없음이면 여섯 장도 넘긴다', async () => {
  const m = 무대();
  const 장 = Array.from({ length: 6 }, (_, i) => { const p = path.join(m.편, '판', '참고', `r${i + 1}.jpg`); fs.writeFileSync(p, String(i)); return p; });
  const 다섯 = await 돌리기(도구, [m.편, m.지시문, '바다', ...장.slice(0, 5)], m.env('ok'));
  assert.strictEqual(다섯.code, 0, 다섯.오류);
  const 넘긴 = (받은) => 받은.인자.filter((x, i) => 받은.인자[i - 1] === '-i');
  assert.deepStrictEqual(넘긴(m.받은것()), 장.slice(0, 5));
  const 여섯 = await 돌리기(도구, [m.편, m.지시문, '바다2', ...장, '--참고제한없음'], m.env('ok'));
  assert.strictEqual(여섯.code, 0, 여섯.오류);
  assert.deepStrictEqual(넘긴(m.받은것()), 장);
});

test('codex계정의 종료 코드를 그대로 내고, thread · 그림이 없으면 1로 끝낸다 — 사건 기록은 끝까지 남는다', async () => {
  const m = 무대();
  const 기록 = path.join(m.편, '판', '_기록');
  const 없음 = await 돌리기(도구, [m.편, m.지시문, '바다'], m.env('없음'));
  assert.strictEqual(없음.code, 3);
  assert.match(없음.오류, /바다 실패 — 종료 3/);

  const 실없음 = await 돌리기(도구, [m.편, m.지시문, '바다2'], m.env('실없음'));
  assert.strictEqual(실없음.code, 1);
  assert.match(실없음.오류, /thread_id를 못 읽었다/);
  const 사건 = fs.readdirSync(기록).find((f) => /^바다2_\d{6}_사건\.jsonl$/.test(f));
  assert.strictEqual(fs.readFileSync(path.join(기록, 사건), 'utf8'), '{"type":"turn.started"}\n');

  // thread는 있는데 그 폴더에 그림이 없다(다른 계정 폴더에 생긴 꼴)
  const 딴곳 = path.join(m.t, '딴곳');
  fs.mkdirSync(딴곳, { recursive: true });
  const 그림없음 = await 돌리기(도구, [m.편, m.지시문, '바다3'], m.env('ok', { FAKE_HOME_DIR: 딴곳 }));
  assert.strictEqual(그림없음.code, 1);
  assert.match(그림없음.오류, /그림을 못 찾았다\(thread t-1\)/);

  // thread_id가 폴더 밖을 가리키는 꼴이면 그 자리의 그림을 집지 않는다
  const 밖실 = await 돌리기(도구, [m.편, m.지시문, '바다4'], m.env('밖실'));
  assert.strictEqual(밖실.code, 1);
  assert.match(밖실.오류, /thread_id 꼴이 이상하다/);
  assert.deepStrictEqual(이름들(path.join(m.편, '판')), []);

  // 사건을 많이 쏟고 실패해도 기록이 잘리지 않는다
  const 큰 = await 돌리기(도구, [m.편, m.지시문, '바다5'], m.env('큰실패'));
  assert.strictEqual(큰.code, 7);
  const 큰사건 = fs.readFileSync(path.join(기록, fs.readdirSync(기록).find((f) => /^바다5_\d{6}_사건\.jsonl$/.test(f))), 'utf8');
  const 줄 = `${JSON.stringify({ type: 'item.completed', text: 'x'.repeat(1000) })}\n`;
  assert.strictEqual(큰사건.length, '{"type":"thread.started","thread_id":"t-1"}\n'.length + 줄.length * 2000);
  assert.ok(큰사건.endsWith(줄));
});
