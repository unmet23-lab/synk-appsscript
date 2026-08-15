/* 대기열 `#Qnn` 채번 게이트 — 판정층 + **배선** 회귀 (F461 처방 ㄴ · 2026-08-15)
 *
 * 무엇이 비어 있었나 — 규칙(「열린 줄은 전부 `#Qnn` 을 갖고 그 번호는 유일하다」)을 재는 곳은
 *   `tests/대기열점유.test.js` 안의 **인라인 사본** 하나뿐이었고, 그건 사후 검사다. 2026-08-15
 *   두 세션이 7분 차로 같은 「최대+1」을 읽어 `#Q84` 를 겹쳐 발급했고, 그 결과가 **주인 없는 CI
 *   적색**이었다 — 겹친 두 세션 중 누구도 자기 것으로 안 읽고 그동안 남의 배포가 막혔다.
 *
 * ☠️ 이 게이트가 죽는 가장 그럴듯한 방법 셋을 여기서 각각 잰다:
 *   ① **작업본을 재는 것**(F302) — 스테이징만 겹쳤는데 작업본이 깨끗하면 조용히 통과한다.
 *   ② **뿌리를 `CLAUDE_PROJECT_DIR` 로 잡는 것**(F403) — 워크트리에서 옆 저장소를 재고 통과한다.
 *   ③ **처방이 못 따를 것**(F103) — 차단문이 시키는 대로 고쳤는데 또 막히면 다음 수는 BYPASS 다.
 *   셋 다 새는 방향이 「통과」거나 「우회」라 증상이 없다.
 *
 * 🔑 탐지력은 픽스처가 진다 — 실저장소에는 **거짓양성만** 묻는다(CLAUDE.md 맹점 ②: 버그가 아직
 *   있을 것을 요구하는 회귀를 쓰지 않는다). 실저장소의 답은 그날 대기열에 따라 바뀐다.
 * 🔑 판정 함수는 **게이트와 사후 회귀가 같은 것**을 부른다 — 여기서도 사본을 안 만들고
 *   `tools/대기열.js` 의 `채번()` 을 그대로 부른다(맹점 ④).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const 큐 = require(path.join(ROOT, 'tools', '대기열.js'));
const 좌표 = 큐.대기열좌표;
const 훅원본 = path.join(ROOT, 'tools', 'githooks', 'pre-commit');
const 게이트원본 = path.join(ROOT, 'tools', '대기열채번검사.js');
const 도구원본 = path.join(ROOT, 'tools', '대기열.js');
const 라이브원본 = path.join(ROOT, 'tools', 'lib', '확정대조.js');

/** 진짜 파서로 넣는다 — 모양을 손으로 베끼면 파싱은 한 번도 안 검사된다. */
const 재기 = (본문) => 큐.채번(큐.항목들(본문));

const 큐파일 = (...줄들) => `# 작업 대기열\n\n## P1 급한 것\n\n${줄들.join('\n')}\n`;

/* ── ① 판정층 — 탐지력 (픽스처) ───────────────────────────────────────── */

test('🔴 급소 — 같은 `#Qnn` 이 두 줄에 있으면 잡는다 (2026-08-15 실사고 그 모양)', () => {
  const r = 재기(큐파일('- [ ] 〖지금〗 #Q84 **마스코트 2단계 잔여**', '- [ ] 〖지금〗 #Q84 **배포대조 본체 미측정**'));
  assert.strictEqual(r.중복.length, 1, '겹친 번호를 못 잡았다 — 이 게이트가 지는 단 하나가 이것이다');
  assert.strictEqual(r.중복[0].id, 84);
  assert.deepStrictEqual([r.중복[0].먼저, r.중복[0].나중], [5, 6], '어느 두 줄인지 못 짚으면 처방을 못 낸다');
});

test('🔑 거짓양성 — 번호가 다 다르면 안 잡는다 (막는 게이트의 기본값은 통과다)', () => {
  const r = 재기(큐파일('- [ ] 〖지금〗 #Q84 **하나**', '- [ ] 〖⏳유호〗 #Q85 **둘**', '- [ ] 〖재료0〗 #Q86 **셋**'));
  assert.deepStrictEqual(r.중복, []);
  assert.deepStrictEqual(r.없음, []);
  assert.strictEqual(r.분모, 3);
});

test('☠️ `#Q8` 은 `#Q84` 가 아니다 — 접두가 걸리면 한 자리 번호가 두 자리 줄을 통째로 잠근다', () => {
  const r = 재기(큐파일('- [ ] 〖지금〗 #Q8 **하나**', '- [ ] 〖지금〗 #Q84 **둘**'));
  assert.deepStrictEqual(r.중복, [], '접두 혼동으로 거짓 차단했다 — 못 따를 처방이 되고 곧 우회가 된다');
});

test('☠️ 번호 없는 줄 둘이 `#Qnull` 중복으로 새지 않는다 — 사유가 엉뚱하면 처방도 엉뚱하다', () => {
  const r = 재기(큐파일('- [ ] 〖지금〗 **번호 없음 하나**', '- [ ] 〖지금〗 **번호 없음 둘**'));
  assert.deepStrictEqual(r.중복, [], '「번호가 없다」를 「번호가 겹쳤다」로 번역했다');
  assert.strictEqual(r.없음.length, 2, '번호 없는 줄은 `없음` 이 지목해야 한다');
});

test('🔑 처방 번호의 바닥 = 지금 최대 — 「최대+1」이 재사용이 되면 처방 자체가 다음 충돌이다', () => {
  const r = 재기(큐파일('- [ ] 〖지금〗 #Q84 **하나**', '- [ ] 〖지금〗 #Q84 **둘**', '- [ ] 〖지금〗 #Q87 **셋**'));
  assert.strictEqual(r.최대, 87, '최대를 겹친 번호에서 읽으면 처방이 살아있는 #Q87 을 덮는다');
});

test('🔑 닫힌 줄(`- [x]`)은 세지 않는다 — 규약이 「닫으면 지운다」라 남아 있어도 열린 자리가 아니다', () => {
  const r = 재기(큐파일('- [x] 〖지금〗 #Q84 **닫힘**', '- [ ] 〖지금〗 #Q84 **열림**'));
  assert.deepStrictEqual(r.중복, []);
  assert.strictEqual(r.분모, 1);
});

test('☠️ 분모 — 0건은 「위반 없음」과 같은 모양이라 따로 셀 수 있어야 한다 (F207)', () => {
  const r = 재기('# 작업 대기열\n\n## P1\n\n(열린 줄 없음)\n');
  assert.strictEqual(r.분모, 0, '분모를 안 내면 파싱 실패가 초록으로 읽힌다');
  assert.deepStrictEqual(r.중복, []);
});

/* ── ② 배선 — 진짜 훅·진짜 게이트·진짜 `git commit` ─────────────────── */

const g = (dir, args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });

/** 실 훅·실 게이트를 그대로 실은 1회용 저장소. HEAD = 번호가 안 겹친 상태. */
function mkRepo(초기 = 큐파일('- [ ] 〖지금〗 #Q1 **처음부터 있던 줄**')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-채번E2E-'));
  g(dir, ['init', '-b', 'master']);
  g(dir, ['config', 'user.email', 'test@synk.local']);
  g(dir, ['config', 'user.name', 'test']);
  g(dir, ['config', 'commit.gpgsign', 'false']);

  const hooks = path.join(dir, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const dst = path.join(hooks, 'pre-commit');
  fs.copyFileSync(훅원본, dst);
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows */ }

  /* 게이트와 그 판정 통로는 **실물을 그대로** 싣는다 — 이 시험의 과녁이 그것이다.
   * 옆 게이트들(계약동봉·옛글자·인용검사…)은 일부러 안 싣는다: 훅이 「없으면 막지 않고
   * 말한다」로 넘어가는 규약이라, 그 자리가 규약대로 도는지도 같이 드러난다. */
  fs.mkdirSync(path.join(dir, 'tools', 'lib'), { recursive: true });
  fs.copyFileSync(게이트원본, path.join(dir, 'tools', '대기열채번검사.js'));
  fs.copyFileSync(도구원본, path.join(dir, 'tools', '대기열.js'));
  fs.copyFileSync(라이브원본, path.join(dir, 'tools', 'lib', '확정대조.js'));

  fs.mkdirSync(path.join(dir, path.dirname(좌표)), { recursive: true });
  fs.writeFileSync(path.join(dir, 좌표), 초기, 'utf8');
  fs.writeFileSync(path.join(dir, 'README.md'), '대기열과 무관한 파일\n', 'utf8');
  g(dir, ['add', '--', 'docs', 'tools', 'README.md']);
  g(dir, ['commit', '-m', '초기']);
  return dir;
}

/** `git commit -m … -- 경로들` — 범위를 못 박는 실제 통로 그대로.
 *  ⚠ 못 띄운 것을 「막혔다」로 번역하지 않는다 — 미실행은 차단이 아니다.
 *  ⚠ `spawnSync` 인 이유: 훅의 말은 전부 stderr 라, 성공 갈래에서 그것을 못 돌려주면
 *     「말했나」를 묻는 단언이 빈 문자열에 대고 통과한다. */
function 커밋(dir, 경로들, env) {
  const r = spawnSync('git', ['commit', '-m', '시도', '--', ...경로들],
    { cwd: dir, encoding: 'utf8', env: env || process.env });
  if (r.error || r.status === null) {
    throw new Error(`git 을 못 띄웠다 — 미실행은 차단이 아니다: ${r.error ? r.error.code : r.signal}`);
  }
  return { 막혔나: r.status !== 0, 출력: String(r.stderr || '') + String(r.stdout || '') };
}

const 준비 = (t, ...a) => { try { return mkRepo(...a); } catch (_) { return t.skip('git 을 못 돌린다'), null; } };
const 방들 = [];
const 쓰고버린다 = (t, ...a) => { const d = 준비(t, ...a); if (d) 방들.push(d); return d; };
test.after(() => { for (const d of 방들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 판정이 아니다 */ } } });

const 쓴다 = (dir, 본문) => fs.writeFileSync(path.join(dir, 좌표), 본문, 'utf8');
const 스테이징 = (dir) => g(dir, ['add', '--', 좌표]);

test('🔴 급소 — 번호가 겹친 대기열을 담은 커밋이 **진짜로** 막힌다', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **처음부터 있던 줄**', '- [ ] 〖지금〗 #Q1 **뒤늦게 같은 번호를 받은 줄**'));
  const r = 커밋(dir, [좌표]);
  assert.ok(r.막혔나, `겹친 번호가 그대로 커밋됐다 — 이 게이트가 아예 안 돈다:\n${r.출력}`);
  assert.match(r.출력, /#Q1 가 줄\d+ ↔ 줄\d+/, `차단은 됐는데 «어느 두 줄인지»를 안 말한다:\n${r.출력}`);
});

test('🔑 거짓 차단 없음 — 번호가 안 겹친 대기열 편집은 그대로 커밋되고, **분모를 말한다**', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **처음부터 있던 줄**', '- [ ] 〖지금〗 #Q2 **규약대로 최대+1**'));
  const r = 커밋(dir, [좌표]);
  assert.ok(!r.막혔나, `정상 편집을 막았다 — 못 따를 처방은 우회를 정상 통로로 만든다(F103):\n${r.출력}`);
  /* 조용한 0 은 「이 커밋의 자리가 아니었다」와 구별이 안 된다 — 게이트가 죽어도 같은 모양이다. */
  assert.match(r.출력, /\[채번\] 깨끗하다 — 열린 2줄을 봤다/,
    `쟀는데 «몇 줄을 봤는지»를 안 말한다 — 초록이 분모 없이 나온다(F207):\n${r.출력}`);
});

test('🔑 대기열을 안 건드리는 커밋은 이 게이트가 안 막는다 (대상 판정이 검사기 안에 있다)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q1 **작업본에만 있는 겹침**'));
  fs.writeFileSync(path.join(dir, 'README.md'), '무관한 변경\n', 'utf8');
  const r = 커밋(dir, ['README.md']);
  assert.ok(!r.막혔나, `대기열을 안 담은 커밋까지 막았다 — 남의 미커밋이 내 커밋을 막는다:\n${r.출력}`);
  assert.doesNotMatch(r.출력, /\[채번\]/,
    `대상이 아닌 커밋에서도 떠들었다 — 매 커밋 소음이 되면 아무도 안 읽는다:\n${r.출력}`);
});

test('☠️ 급소 ① — 작업본이 아니라 **스테이징**을 잰다 (F302: 반대로 재면 초록이 거짓이다)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  /* 겹친 판을 스테이징하고, 작업본만 깨끗하게 되돌린다 — 작업본을 재는 게이트는 여기서 통과한다. */
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q1 **겹침**'));
  스테이징(dir);
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q2 **깨끗한 작업본**'));
  const r = spawnSync('git', ['commit', '-m', '시도'], { cwd: dir, encoding: 'utf8' });
  assert.notStrictEqual(r.status, null, 'git 을 못 띄웠다 — 미실행은 차단이 아니다');
  assert.notStrictEqual(r.status, 0,
    `스테이징이 겹쳤는데 통과했다 — 작업본을 재고 있다(F302):\n${r.stderr}${r.stdout}`);
});

test('🔑 급소 ① 뒤집기 — 스테이징이 깨끗하면 작업본이 겹쳐 있어도 안 막는다', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q2 **깨끗**'));
  스테이징(dir);
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q1 **아직 손보는 중**'));
  const r = spawnSync('git', ['commit', '-m', '시도'], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 0,
    `커밋될 내용은 깨끗한데 막았다 — 작업본을 재고 있다(반대 방향):\n${r.stderr}${r.stdout}`);
});

test('🔴 급소 ② — 다른 저장소를 가리키는 `CLAUDE_PROJECT_DIR` 이 있어도 **커밋되는 저장소**를 잰다 (F403)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  const 남 = 쓰고버린다(t); if (!남) return;         // 남의 저장소 = 번호가 안 겹친 상태
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q1 **겹침**'));
  const r = 커밋(dir, [좌표], { ...process.env, CLAUDE_PROJECT_DIR: 남 });
  assert.ok(r.막혔나,
    `옆 저장소를 재고 조용히 통과했다 — 워크트리에서 이 게이트가 통째로 눈이 먼다:\n${r.출력}`);
});

test('🔴 급소 ③ — 차단문이 시킨 그대로 고치면 **실제로 통과한다** (F103: 못 따를 처방은 곧 BYPASS)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q1 **늦게 도입된 쪽**', '- [ ] 〖지금〗 #Q7 **더 큰 번호**'));
  const 막힘 = 커밋(dir, [좌표]);
  assert.ok(막힘.막혔나, '막히지 않아 처방을 시험할 수 없다');

  /* 처방을 **읽어서** 따른다 — 손으로 정답을 적으면 차단문이 틀려도 이 시험은 초록이다. */
  const m = /#Q\d+ 가 줄\d+ ↔ 줄\d+ 두 곳에 있다 → \*\*늦게 도입된 쪽\*\*을 \*\*#Q(\d+)\*\*/.exec(막힘.출력);
  assert.ok(m, `차단문이 «무슨 번호로 옮기라»를 안 준다 — 그러면 다음 수는 추측이다:\n${막힘.출력}`);
  const 처방 = Number(m[1]);
  assert.ok(처방 > 7, `처방 #Q${처방} 이 살아있는 #Q7 을 덮는다 — 처방 자체가 다음 충돌이다`);

  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', `- [ ] 〖지금〗 #Q${처방} **늦게 도입된 쪽**`, '- [ ] 〖지금〗 #Q7 **더 큰 번호**'));
  const 다시 = 커밋(dir, [좌표]);
  assert.ok(!다시.막혔나, `차단문이 시킨 대로 고쳤는데 또 막힌다 — 우회가 정상 통로가 된다:\n${다시.출력}`);
});

test('⚠ 검사기가 없으면 **막지 않고 말한다** — 통과와 미실행이 같은 모양이면 안 된다', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.rmSync(path.join(dir, 'tools', '대기열채번검사.js'));
  g(dir, ['add', '--', 'tools']);
  g(dir, ['commit', '-m', '검사기 제거']);
  쓴다(dir, 큐파일('- [ ] 〖지금〗 #Q1 **하나**', '- [ ] 〖지금〗 #Q1 **겹침**'));
  const r = 커밋(dir, [좌표]);
  assert.ok(!r.막혔나, `검사기가 통째로 없는 기계에서 커밋을 막았다 — 그 세션은 아무것도 못 한다(F103):\n${r.출력}`);
  assert.match(r.출력, /\[채번\][^\n]*못 했다/, `조용히 넘어갔다 — 미실행이 통과와 같은 모양이다(F207):\n${r.출력}`);
});

/* ── ③ 실저장소 — 거짓양성만 ───────────────────────────────────────────── */

test('🔑 실저장소 — 지금 대기열이 채번 규칙을 지킨다(거짓양성 0 · 위반이면 여기가 먼저 빨개진다)', () => {
  const 전체 = 큐.항목들();
  if (전체 === null) { assert.fail('대기열 파일을 못 읽었다 — 0건 초록 금지(F207)'); }
  const r = 큐.채번(전체);
  assert.ok(r.분모 > 0, '열린 줄을 0건 셌다 — 초록이 아니라 미실행이다');
  assert.deepStrictEqual(r.중복.map((d) => `#Q${d.id} (줄${d.먼저} ↔ 줄${d.나중})`), []);
  assert.deepStrictEqual(r.없음.map((it) => `줄${it.줄번호} ${큐.씨앗(it.본문)}`), []);
});

test('🔑 실저장소 — 훅이 이 게이트를 **실제로 부른다** (등록이 빠지면 판정층이 초록이어도 안 돈다)', () => {
  const 훅 = fs.readFileSync(훅원본, 'utf8');
  assert.match(훅, /node\s+"\$ROOT\/tools\/대기열채번검사\.js"\s+--cached/,
    '훅에 등록이 없다 — 스스로 발화하지 않는 장치는 안 돈다(CLAUDE.md 신뢰성)');
});
