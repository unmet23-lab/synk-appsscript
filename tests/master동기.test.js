'use strict';
/**
 * master동기 회귀 — 「로컬 판이 진실」 가정을 막는 두 장치가 **실제로 도는지** 잰다.
 *
 * ■ 이 파일이 지키는 다섯 문장
 *   ① **master 직접 커밋은 밀린다.** 안 밀린 커밋은 이 노트북에만 있고, 서버측 잠금도 PR 도
 *      origin 에 올라온 것만 지킨다. 실측 2026-08-17: 좌초 수거 커밋 8건이 쌓여 master 가
 *      갈라졌고(5앞/57뒤), 그때부터 push 자체가 non-fast-forward 로 거절됐다 — 자기 힘으로 못 나온다.
 *   ② **머지 뒤 로컬 master 가 전진한다.** origin 만 앞서가면 그 트리를 읽는 층이 전부 거짓을
 *      낸다(F542 보드 줄 · F565 가지 기준 · F566 커밋 목록).
 *   ③ **실패를 삼키지 않는다.** 남의 미커밋이 ff 를 막는 것은 **정상**이고 막아야 맞다 —
 *      대신 사유와 처방이 문장으로 나와야 한다. 조용한 실패는 「통과」와 같은 모양이다.
 *   ④ **못 셈 ≠ 0건**(F207). git 조회가 실패하면 null 이지 0 이 아니다.
 *   ⑤ **조준이 밀리지 않는다.** HEAD 가 master 가 아니면 안 민다 — ref 는 워크트리 사이에
 *      공유되므로, 가지 위에서 부르면 내 커밋과 무관한 master 를 밀게 된다.
 *
 * ■ 안 재는 것 (정직하게)
 *   🚫 실제 GitHub 왕복 — 자격·네트워크가 필요해 CI 에서 깨진다(F296). 여기 origin 은
 *      **로컬 bare 저장소**다: push·fetch·ff 는 진짜로 돌고, 원격 호스트만 없다.
 *   🚫 두 호출부(인계문수거·작업가지)가 «세션 시작에서» 실제로 발화하는지 — 그건 훅 층이라
 *      소스 계약(⑥)으로만 잡는다. 발화 자체는 사람이 한 번 실측하고 보드에 적는다.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 동기 = require('../tools/lib/master동기.js');

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
    { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return (r.stdout || '').trim();
};
const git있나 = spawnSync('git', ['--version']).status === 0;

/** origin(bare) + 클론 둘. A=원격을 앞세우는 쪽 · B=우리가 재는 트리. */
function 판만들기() {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'master동기-'));
  const origin = path.join(집, 'origin.git');
  git(집, 'init', '--bare', '-b', 'master', origin);
  const A = path.join(집, 'A');
  git(집, 'clone', '--quiet', origin, A);
  fs.writeFileSync(path.join(A, 'seed.txt'), '0\n');
  git(A, 'add', 'seed.txt');
  git(A, 'commit', '-m', 'seed');
  git(A, 'push', '--quiet', 'origin', 'master');
  const B = path.join(집, 'B');
  git(집, 'clone', '--quiet', origin, B);
  return { 집, origin, A, B };
}

/** 그 트리에 로컬 커밋 n 개 — 밀지 않는다(= 좌초 상태를 만든다). */
function 로컬커밋(트리, n, 파일 = 'local.txt') {
  for (let i = 0; i < n; i++) {
    fs.appendFileSync(path.join(트리, 파일), `${i}\n`);
    git(트리, 'add', '--', 파일);
    git(트리, 'commit', '-m', `로컬 ${i}`);
  }
}

/** A 에서 n 개 밀어 origin 을 앞세운다(= B 를 뒤처지게 한다). */
function 원격앞세우기(A, n, 파일 = 'seed.txt') {
  for (let i = 0; i < n; i++) {
    fs.appendFileSync(path.join(A, 파일), `원격 ${i}\n`);
    git(A, 'add', '--', 파일);
    git(A, 'commit', '-m', `원격 ${i}`);
  }
  git(A, 'push', '--quiet', 'origin', 'master');
}

// ── ① 밀기: 좌초를 안 만든다 ────────────────────────────────────────────────
test('① master 직접 커밋 3건이 그 자리에서 밀린다 — 좌초 0', { skip: !git있나 && 'git 없음' }, () => {
  const { A, B, origin } = 판만들기();
  로컬커밋(B, 3);
  assert.equal(동기.갈라짐(B).앞선, 3, '픽스처가 좌초 3건을 안 만들었다 — 검사가 헛돈다');

  const r = 동기.밀기(B);
  assert.equal(r.한것, '밀었다', `밀지 못했다: ${r.실패}`);
  assert.equal(r.밀린수, 3);
  assert.equal(동기.갈라짐(B).앞선, 0, '밀었다는데 앞선 커밋이 남았다');
  // origin 이 진짜로 받았나 — 우리 트리 말이 아니라 **원격을 열어서** 본다.
  const 원격로그 = git(origin, 'log', '--oneline', 'master');
  assert.match(원격로그, /로컬 2/, 'origin 에 그 커밋이 없다 — 「밀었다」가 거짓이다');
  assert.ok(A);
});

test('① 밀 것이 없으면 «없음» 이고 실패가 아니다', { skip: !git있나 && 'git 없음' }, () => {
  const { B } = 판만들기();
  const r = 동기.밀기(B);
  assert.equal(r.한것, '없음');
  assert.equal(r.실패, '');
});

// ── ② 전진: 뒤처짐을 안 남긴다 ──────────────────────────────────────────────
test('② 로컬 master 가 origin 까지 전진한다 — 뒤처짐 0', { skip: !git있나 && 'git 없음' }, () => {
  const { A, B } = 판만들기();
  원격앞세우기(A, 4);
  const r = 동기.전진(B);
  assert.equal(r.한것, '전진했다', `전진 못 했다: ${r.실패}`);
  assert.equal(r.전진수, 4);
  assert.equal(동기.갈라짐(B).뒤처진, 0, '전진했다는데 뒤처짐이 남았다');
  // 바이트로 확인한다 — ref 만 움직이고 작업본이 안 왔으면 그건 전진이 아니다.
  assert.match(fs.readFileSync(path.join(B, 'seed.txt'), 'utf8'), /원격 3/,
    'ref 는 갔는데 작업본이 안 왔다');
});

// ── ③ 실패를 삼키지 않는다 ──────────────────────────────────────────────────
test('③ 남의 미커밋이 ff 를 막으면 — 덮지 않고, 사유와 처방을 낸다', { skip: !git있나 && 'git 없음' }, () => {
  const { A, B } = 판만들기();
  원격앞세우기(A, 2);                       // 원격이 seed.txt 를 건드렸다
  fs.appendFileSync(path.join(B, 'seed.txt'), '남의 미커밋\n');   // 같은 파일을 남이 편집 중

  const r = 동기.전진(B);
  assert.equal(r.한것, '실패', 'ff 가 통과했다 — 남의 미커밋을 덮었을 수 있다');
  assert.match(r.실패, /2건을 못 받았다/);
  assert.match(r.처방, /미커밋이 ff 를 막는다|작업본소유자/, '처방이 없다 — 조용한 실패다');
  assert.match(fs.readFileSync(path.join(B, 'seed.txt'), 'utf8'), /남의 미커밋/,
    '🔴 남의 미커밋이 사라졌다 — 이 검사가 막으려던 사고 그 자체다');
  assert.match(동기.줄내기('t', r), /^\[t\] 🔴/, '보고 줄이 실패를 빨갛게 안 낸다');
});

test('③ 갈라졌으면 push 실패를 «detached 로 푼다» 처방과 함께 낸다', { skip: !git있나 && 'git 없음' }, () => {
  const { A, B } = 판만들기();
  원격앞세우기(A, 2);
  로컬커밋(B, 1, 'mine.txt');               // 앞 1 · 뒤 2 = 갈라짐
  const r = 동기.밀기(B);
  assert.equal(r.한것, '실패');
  assert.match(r.처방, /detached/, '갈라짐인데 처방이 일반형이다 — 따를 수 없는 처방은 우회를 만든다');
});

// ── ④ 못 셈 ≠ 0건 ──────────────────────────────────────────────────────────
test('④ git 조회가 실패하면 null(모름) 이지 0 이 아니다', () => {
  const 죽은실행 = () => ({ 성공: false, 출력: '', 오류: 'boom' });
  assert.equal(동기.갈라짐('/없는곳', { 실행: 죽은실행 }).앞선, null);
  const r = 동기.밀기('/없는곳', { 실행: 죽은실행 });
  assert.equal(r.한것, '못셈');
  assert.equal(r.밀린수, null, '못 센 것을 0 으로 접었다(F207)');
});

/* 🔑 위 검사만으론 부족했다 — 변이가 잡아낸 구멍이다(첫 판: 「못 셈을 0 으로 접는다」가 통과).
 *   `성공:false` 는 그 분기에 닿기 **전에** 걸러지므로, 진짜 사각은 **조회가 성공했는데 출력이
 *   숫자가 아닌** 자리다(ref 가 없을 때 git 이 빈 줄을 내는 꼴). 그 칸을 따로 못박는다. */
/* 두 칸을 **따로** 잰다 — 한 칸만 재면 다른 칸이 조용히 0 으로 접힌다.
 *   ㉠ 빈 출력: `Number('')` 는 0 이고 **유한하다** → isFinite 만 보면 통과한다.
 *   ㉡ 숫자 아닌 출력: 여기서 isFinite 가 진다. */
for (const [칸, 출력] of [['㉠ 빈 출력', ''], ['㉡ 숫자 아닌 출력', 'abc']]) {
  test(`④ 조회는 성공했는데 ${칸} — 그것도 null 이다(0 으로 접지 않는다)`, () => {
    const 헛소리 = (인자들) => (인자들[0] === 'rev-list'
      ? { 성공: true, 출력, 오류: '' }
      : { 성공: true, 출력: 'master', 오류: '' });
    assert.equal(동기.갈라짐('/아무데나', { 실행: 헛소리 }).앞선, null,
      '못 읽은 것을 0 으로 접었다 — 「갈라짐 없음」과 「안 쟀다」가 같은 모양이 된다(F207)');
    const r = 동기.밀기('/아무데나', { 실행: 헛소리 });
    assert.equal(r.한것, '못셈');
    assert.equal(r.밀린수, null);
  });
}

// ── ⑤ 조준이 밀리지 않는다 ─────────────────────────────────────────────────
test('⑤ HEAD 가 master 가 아니면 안 민다 — ref 는 워크트리 사이에 공유된다', { skip: !git있나 && 'git 없음' }, () => {
  const { B } = 판만들기();
  로컬커밋(B, 2);                            // master 가 2 앞선다
  git(B, 'checkout', '--quiet', '-b', '딴가지');
  const r = 동기.밀기(B);
  assert.equal(r.한것, '건너뜀', '가지 위인데 master 를 밀려 했다');
  assert.match(동기.줄내기('t', r), /건너뜀/);
});

test('⑤ 메인 트리가 master 가 아니면 전진도 건너뛴다 — 남의 화면을 바꾸지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { A, B } = 판만들기();
  원격앞세우기(A, 2);
  git(B, 'checkout', '--quiet', '-b', '딴가지');
  const r = 동기.전진(B);
  assert.equal(r.한것, '건너뜀');
  assert.match(r.실패, /딴가지/, '어느 가지였는지를 안 밝힌다');
});

// ── ⑥ 두 생산자가 이 통로를 «실제로» 부른다 (소스 계약) ─────────────────────
/* 🔑 위 ①~⑤ 가 전부 초록이어도 **아무도 안 부르면** 드리프트는 그대로 자란다.
 *   스스로 발화하지 않는 장치는 안 돈다(CLAUDE.md) — 그래서 호출 자체를 못박는다. */
test('⑥ 인계문수거는 커밋 뒤 밀기를 부른다', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'tools', '인계문수거.js'), 'utf8');
  const 코드 = s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
  assert.match(코드, /require\([^)]*master동기/, '공용 통로를 안 부른다');
  assert.match(코드, /동기\.밀기\(/, '커밋 뒤 밀기 호출이 없다 — 좌초 커밋이 다시 태어난다');
});

test('⑥ 작업가지 --닫기 는 머지 뒤 전진을 부른다', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'tools', '작업가지.js'), 'utf8');
  const 코드 = s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
  assert.match(코드, /require\([^)]*master동기/, '공용 통로를 안 부른다');
  assert.match(코드, /동기\.전진\(/, '머지 뒤 전진 호출이 없다 — origin 만 앞서간다');
  // 그리고 그 호출은 **머지 뒤**여야 한다 — 앞이면 방금 머지분을 못 받는다.
  const 머지 = 코드.indexOf("'pr', 'merge'");
  const 전진 = 코드.indexOf('동기.전진(');
  assert.ok(머지 !== -1 && 전진 > 머지, '전진 호출이 머지보다 앞에 있다 — 방금 머지분을 못 받는다');
});

/* ── ⑥-b 옛 통로 금지 — **이 검사가 이 트랙의 핵심이다** ────────────────────
 *
 * 호출부를 하나씩 고치면 여섯 번째 도구가 또 안 민다(실측: 좌초 8건은 전부 인계문수거 것이었지만,
 * master 에 직접 커밋하는 도구는 **다섯**이었고 그중 아무도 안 밀었다). 그래서 개별 호출을
 * 세는 대신 **「master 에 커밋하는 도구」를 열거해 전부 짝을 요구한다** — 새 도구가 늘면
 * 그 도구가 이 검사를 빨갛게 만든다(CLAUDE.md: 잘못 쓸 수 없는 공용 통로 + 옛 통로를 테스트로 금지).
 *
 * ⚠ 면제는 **목록으로 보이게** 둔다(빈 목록이면 그대로 빈 채로). 조용한 면제는 이 검사를
 *   있으나 마나로 만든다 — 면제가 늘면 여기서 눈에 띄어야 한다. */
const 면제 = new Map([
  // 경로 → 왜 면제인가. 지금은 없다.
]);

test('⑥-b master 에 커밋하는 도구는 **전부** 밀기와 짝을 이룬다 (옛 통로 금지)', () => {
  const 도구방 = path.join(__dirname, '..', 'tools');
  const 커밋꼴 = /\(\s*\[\s*'commit'/;               // git(['commit'  ·  gitQuiet(['commit'
  const 벗기기 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');

  const 커밋하는것 = [];
  for (const 이름 of fs.readdirSync(도구방)) {
    if (!이름.endsWith('.js')) continue;
    const 코드 = 벗기기(fs.readFileSync(path.join(도구방, 이름), 'utf8'));
    if (커밋꼴.test(코드)) 커밋하는것.push([이름, 코드]);
  }

  // 분모를 먼저 밝힌다 — 0건 열거는 「전부 통과」와 같은 모양이다(F207).
  assert.ok(커밋하는것.length >= 5,
    `master 에 커밋하는 도구를 ${커밋하는것.length}개만 찾았다 — 탐지 정규식이 죽었다(실측 5개)`);

  const 안민것 = 커밋하는것
    .filter(([이름]) => !면제.has(이름))
    .filter(([, 코드]) => !(/require\([^)]*master동기/.test(코드) && /동기\.밀기\(/.test(코드)))
    .map(([이름]) => 이름);

  assert.deepEqual(안민것, [],
    `이 도구들은 master 에 커밋하는데 밀지 않는다 — 좌초 커밋이 여기서 태어난다: ${안민것.join(', ')}`);
});

// ── ⑦ 전진은 머지 커밋을 만들지 않는다 (ff-only 고정) ───────────────────────
test('⑦ 전진은 --ff-only 다 — 머지 커밋을 만들어 남의 이력을 흔들지 않는다', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'tools', 'lib', 'master동기.js'), 'utf8');
  const 코드 = s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
  assert.match(코드, /'--ff-only'/, 'ff-only 고정이 아니다');
  assert.ok(!/'merge'\s*,\s*'origin\//.test(코드.replace(/'--ff-only',\s*/, '')),
    'ff-only 없는 merge 호출이 있다');
});
