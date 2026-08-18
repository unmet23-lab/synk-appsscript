'use strict';
/**
 * githook-install 회귀 — 「설치기는 있는데 **부르는 자리가 없다**」를 막는 층 (F628 잔여).
 *
 * 🔴 왜 있나 (2026-08-18 클라우드 컨테이너 실측):
 *   `.git/hooks` 는 버전 관리 밖이라 clone 에 안 딸려온다. 새 컨테이너는 **훅 0개**로 시작하는데
 *   `tools/install-githooks.js` 를 부르는 등록이 저장소에 **0개**였다 — 그래서 그 도구는 「누가
 *   기억하면 도는」 물건이었고, 그날 클라우드가 낸 커밋 8건은 주인 표식이 전부 비었다.
 *   CLAUDE.md 신뢰성: 스스로 발화하지 않는 장치는 안 돈다 · 장치와 발동 조건은 같은 커밋에서.
 *
 * 분담 — 겹쳐 적지 않는다(같은 판정을 두 곳에 적으면 갈라진다):
 *   · **등록이 있나**  → `tests/훅등록.test.js` 가 이미 진다(`.claude/hooks/*.js` 전량 ↔ settings.json).
 *   · **어느 이벤트냐** → 여기(④). PreToolUse 에 등록돼도 위 검사는 초록인데, 그러면 아무것도 안 깐다.
 *   · **무엇을 깔고 무엇을 안 덮나** → `tests/훅설치.test.js`(설치기 자신 · F391).
 *   · **깔고 나서 말하나·입 다무나** → 여기(①②③⑤).
 *
 * 탐지력은 전부 픽스처가 진다 — 실저장소의 `.git/hooks` 는 이 파일이 건드리지 않는다
 * (가드 맹점 ②: 버그가 아직 있을 것을 요구하는 회귀 금지). 이음매는 설치기가 이미 가진
 * `SYNK_GITHOOKS_ROOT` 하나뿐이고, 이 트랙은 새 이음매를 0개 만들었다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 훅띄우기 } = require('./lib/훅띄우기');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'githook-install.js');
const SETTINGS = path.join(ROOT, '.claude', 'settings.json');

/** 훅 0개인 1회용 저장소. 원본 한 벌만 두고 설치기를 그리로 겨눈다. */
function 픽스처(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '훅설치발동-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 결과가 아니다 */ } });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  fs.mkdirSync(path.join(dir, 'tools', 'githooks'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tools', 'githooks', 'testhook'), '#!/bin/sh\necho 원본1\nexit 0\n');
  return dir;
}

const 설치본 = (dir) => path.join(dir, '.git', 'hooks', 'testhook');
const 환경 = (dir) => ({ ...process.env, SYNK_GITHOOKS_ROOT: dir, CLAUDE_PROJECT_DIR: dir });

function 띄우기(dir, 통과코드 = [0]) {
  const r = 훅띄우기(HOOK, { input: '{}', env: 환경(dir), encoding: 'utf8', 통과코드 });
  return { out: String(r.stdout || ''), err: String(r.stderr || ''), code: r.status };
}

test('① 훅 0개인 저장소에서 실제로 깔고, 깔았다고 말한다(몇 건인지 숫자까지)', (t) => {
  const dir = 픽스처(t);
  assert.ok(!fs.existsSync(설치본(dir)), '픽스처가 이미 설치돼 있다 — 이 검사가 잴 게 없다');

  const r = 띄우기(dir);

  assert.ok(fs.existsSync(설치본(dir)), '「깔았다」고 끝났는데 설치본이 없다 — 새는 방향이 통과다');
  assert.match(r.out, /githook설치/, '무엇이 한 말인지 이름을 안 댄다');
  assert.match(r.out, /1건/, '분모를 안 말한다 — 몇 건 깔았는지 없이 낸 초록은 못 읽는다(F207)');

  /* 「썼다」와 「돈다」를 가른다 — 실행비트가 안 붙으면 파일은 있는데 훅은 안 돈다(대가 ②). */
  const 모드 = fs.statSync(설치본(dir)).mode;
  assert.ok(모드 & 0o111, '설치본에 실행비트가 없다 — 파일만 있고 안 도는, 맞는 얼굴로 틀린 값이다');
});

test('② 이미 최신이면 **아무 말도 안 한다**(상시 소음은 진짜 경보를 죽인다)', (t) => {
  const dir = 픽스처(t);
  띄우기(dir);                       // 1회차 = 설치
  const r = 띄우기(dir);             // 2회차 = 할 일 없음

  assert.equal(r.out, '', `할 일이 없는데 stdout 에 말했다 — 매 세션 뜨는 줄은 그 자체가 비용이다: ${r.out}`);
  assert.equal(r.err, '', `할 일이 없는데 stderr 에 말했다: ${r.err}`);
});

test('③ 설치기가 거부하면(F391 설치본 단독 줄) 조용히 0으로 안 끝나고, 그 처방을 그대로 낸다', (t) => {
  const dir = 픽스처(t);
  띄우기(dir);
  const 단독 = 'node tools/새게이트.js || exit 1';
  fs.appendFileSync(설치본(dir), `${단독}\n`);

  const r = 띄우기(dir, [1]);

  assert.equal(r.code, 1, '설치기가 거부했는데 훅은 0으로 끝났다 — 거부가 통과로 번역됐다');
  assert.match(r.err, /설치본에만 있는 줄/, '설치기가 낸 축을 안 흘렸다 — 무엇에 걸렸는지 모른다');
  assert.ok(r.err.includes('새게이트'), '어느 줄인지 안 보인다 — 사람이 판정할 재료가 없다');
  assert.match(r.err, /원본\(tools\/githooks\/\)에 먼저/, '따를 처방이 없다 — 처방 없는 거부는 우회를 만든다(F103)');
  assert.ok(fs.readFileSync(설치본(dir), 'utf8').includes(단독), '거부한다면서 이미 덮었다');
});

test('④ 등록은 **SessionStart** 여야 한다 — 다른 이벤트에 달면 아무것도 안 깔면서 등록 검사는 초록이다', () => {
  const 설정 = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const 걸린곳 = [];
  for (const [event, entries] of Object.entries(설정.hooks || {})) {
    for (const e of entries || []) {
      for (const h of e.hooks || []) {
        if (/githook-install\.js/.test(String(h.command || ''))) 걸린곳.push({ event, matcher: e.matcher });
      }
    }
  }
  assert.ok(걸린곳.length, 'githook-install 등록이 없다 — 부르는 자리가 없으면 설치기는 안 돈다(F628 그 자리)');
  for (const { event, matcher } of 걸린곳) {
    assert.equal(event, 'SessionStart', `${event} 에 달렸다 — 세션 시작 전에 깔려야 그 세션 커밋이 표식을 받는다`);
    assert.match(String(matcher || ''), /startup/, `matcher 가 startup 을 안 잡는다(${matcher}) — 새 컨테이너가 바로 그 자리다`);
  }
});

test('⑤ 설치기가 없으면 조용히 넘어가지 않는다(미실행과 통과가 같은 모양이면 안 된다 · F044)', (t) => {
  /* 설치기는 **훅 곁에서** 찾는다 — 그래서 `tools/` 없는 곳에 훅만 복사하면 그 갈래가 재현된다.
   * 새 환경변수를 만들지 않고 재는 자리다(이음매를 늘리면 그 이음매가 다음 구멍이 된다). */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '훅설치발동-고아-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* 진행 */ } });
  const 고아 = path.join(dir, '.claude', 'hooks', 'githook-install.js');
  fs.mkdirSync(path.dirname(고아), { recursive: true });
  fs.copyFileSync(HOOK, 고아);

  const r = 훅띄우기(고아, { input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8', 통과코드: [1] });

  assert.equal(r.status, 1, '설치기가 없는데 0으로 끝났다 — 못 깐 것이 깐 것과 같은 모양이 된다');
  assert.match(String(r.stderr || ''), /설치기가 없어/, '왜 못 깔았는지 이름을 안 댄다');
});

test('⑥ 「깔았다」는데 **재보니 아직 설치 필요**면 운다 — exit 0 은 「썼다」지 「돈다」가 아니다', (t) => {
  /* 이 갈래(대가 ②)는 진짜 설치기로는 못 만든다 — 쓰기가 성공하면 재확인도 성공하기 때문이다.
   * 그래서 ⑤ 와 **같은 성질**(설치기는 훅 곁에서 찾는다)을 써서 가짜 설치기를 곁에 둔다.
   * 새 이음매가 아니다: 훅의 배선을 그대로 쓰되 상대만 바꿨다. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '훅설치발동-거짓성공-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* 진행 */ } });
  const 고아 = path.join(dir, '.claude', 'hooks', 'githook-install.js');
  fs.mkdirSync(path.dirname(고아), { recursive: true });
  fs.copyFileSync(HOOK, 고아);
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  /* 설치는 0 으로 끝나는데 `--check` 는 끝까지 「설치 필요」라 우기는 설치기 = 쓴 척만 한 자리. */
  fs.writeFileSync(path.join(dir, 'tools', 'install-githooks.js'),
    "if (process.argv.includes('--check')) { console.error('[install-githooks] 1건 설치 필요'); process.exit(1); }\n"
    + "console.log('[install-githooks] 완료'); process.exit(0);\n");

  const r = 훅띄우기(고아, { input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8', 통과코드: [1] });

  assert.equal(r.status, 1, '설치기 exit 0 만 믿고 통과했다 — 안 도는 훅을 「깔았다」고 보고하는 자리다');
  assert.match(String(r.stderr || ''), /재보니 아직/, '무엇이 어긋났는지 이름을 안 댄다');
  assert.equal(String(r.stdout || ''), '', '실패인데 「깔았다」를 stdout 에도 냈다 — 두 말이 갈린다');
});

test('⑦ 설치기가 **안 뜨거나 죽으면**(status null) 「최신」으로 읽지 않는다 (변이 M5 가 뚫은 자리)', (t) => {
  /* 🔴 변이 실측 2026-08-18: `r.status === null` 을 0 으로 읽게 바꿨더니 훅이 **조용히 exit 0** 하는데
   *   회귀 6건이 전부 초록이었다. 죽은 프로세스의 침묵과 「깔 게 없다」의 침묵이 같은 모양이다 —
   *   새는 방향이 통과다(F207). 그 갈래를 여기서 못박는다. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '훅설치발동-죽음-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* 진행 */ } });
  const 고아 = path.join(dir, '.claude', 'hooks', 'githook-install.js');
  fs.mkdirSync(path.dirname(고아), { recursive: true });
  fs.copyFileSync(HOOK, 고아);
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tools', 'install-githooks.js'),
    "process.kill(process.pid, 'SIGKILL');\n");   // 아무 말 없이 죽는다 = 판정 재료 0

  const r = 훅띄우기(고아, { input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8', 통과코드: [1] });

  assert.equal(r.status, 1, '설치기가 죽었는데 0으로 끝났다 — 「안 쟀다」가 「최신」이 됐다');
  assert.match(String(r.stderr || ''), /못 쟀다/, '못 잰 것을 못 쟀다고 안 말한다');
  assert.equal(String(r.stdout || ''), '', '못 쟀는데 stdout 에 무언가 말했다');
});
