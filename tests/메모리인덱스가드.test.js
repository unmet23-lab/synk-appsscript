// memory-index-guard 훅 회귀 — 메모리 인덱스 비대화 차단 장치.
//
// 지키려는 성질:
//   ①긴 **새 줄**은 막는다 ②기존 긴 줄은 인질로 잡지 않는다(압축·재배치가 막히면 훅이 꺼진다)
//   ③인덱스 항목 줄만 본다(머리말·규칙 설명은 길어도 된다) ④다른 파일엔 침묵한다.
//
// ②가 이 파일의 핵심이다 — v6.11의 「과잉 차단은 BYPASS 습관을 만든다」를 그대로 적용했다.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'memory-index-guard.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'memidx-'));
const INDEX = path.join(TMP, 'MEMORY.md');

const entry = (name, chars) => `- [${name}](${name}.md) — ${'가'.repeat(chars)}`;
const SHORT = entry('짧은-토픽', 60);
const LONG = entry('긴-토픽', 400);

fs.writeFileSync(INDEX, ['# Project Memory', '', '> 인덱스는 지도다.', '', SHORT, LONG, ''].join('\n'), 'utf8');

function decide(payload) {
  const out = execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
  if (!out.trim()) return 'allow';
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

test('250자 넘는 새 줄은 차단', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: 'x', new_string: entry('새-토픽', 300) } }),
    'deny'
  );
});

test('250자 이내 새 줄은 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: 'x', new_string: entry('새-토픽', 150) } }),
    'allow'
  );
});

test('경계값 — 정확히 250자는 통과', () => {
  const line = entry('경계', 1);
  const pad = 250 - line.length;
  assert.ok(pad >= 0);
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: 'x', new_string: line + '가'.repeat(pad) } }),
    'allow'
  );
});

/* 이 테스트가 이 훅에서 가장 중요하다. 파일 전체를 검사하면 기존 25줄이 인질이 되어
 * 인덱스를 아예 못 고치게 되고, 그러면 다음 사람은 규칙을 지키는 게 아니라 훅을 끈다. */
test('[핵심] 기존 긴 줄은 인질로 잡지 않는다 — 다른 곳을 고치는 편집은 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: SHORT, new_string: entry('짧은-토픽', 80) } }),
    'allow',
    '긴 줄과 무관한 편집이 막혔다 — 인덱스가 동결된다'
  );
});

test('[핵심] Write로 전문 재작성 시, 그대로 옮겨 적은 기존 줄은 새 줄로 세지 않는다', () => {
  // 압축·재배치 작업이 바로 이 모양이다. 이걸 막으면 다이어트 자체가 불가능해진다.
  const rearranged = ['# Project Memory', '', '> 인덱스는 지도다.', '', LONG, SHORT, ''].join('\n');
  assert.strictEqual(
    decide({ tool_name: 'Write', tool_input: { file_path: INDEX, content: rearranged } }),
    'allow',
    '순서만 바꿨는데 막혔다 — 압축 작업이 훅에 걸린다'
  );
});

test('Write로 새 긴 줄을 넣으면 차단된다', () => {
  const withNew = ['# Project Memory', '', SHORT, LONG, entry('신규', 400), ''].join('\n');
  assert.strictEqual(decide({ tool_name: 'Write', tool_input: { file_path: INDEX, content: withNew } }), 'deny');
});

test('인덱스 항목이 아닌 줄은 길어도 통과 — 머리말·규칙 설명 자리', () => {
  const prose = '> ' + '가'.repeat(600);
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: 'x', new_string: prose } }),
    'allow'
  );
});

test('MultiEdit의 어느 한 조각이라도 넘으면 차단', () => {
  assert.strictEqual(
    decide({
      tool_name: 'MultiEdit',
      tool_input: {
        file_path: INDEX,
        edits: [{ old_string: 'a', new_string: entry('작은', 50) }, { old_string: 'b', new_string: entry('큰', 400) }],
      },
    }),
    'deny'
  );
});

test('MEMORY.md가 아닌 파일에는 침묵한다', () => {
  const other = path.join(TMP, '토픽.md');
  fs.writeFileSync(other, '# 토픽\n', 'utf8');
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: other, old_string: 'x', new_string: entry('아무거나', 600) } }),
    'allow',
    '토픽 파일은 길어야 한다 — 본문이 거기로 가야 인덱스가 짧아진다'
  );
});

test('Edit·Write·MultiEdit 외 도구에는 반응하지 않는다', () => {
  assert.strictEqual(
    decide({ tool_name: 'Read', tool_input: { file_path: INDEX, new_string: entry('큰', 600) } }),
    'allow'
  );
});

test('차단 메시지가 무엇을 하라는지 말한다 — 플래그를 깎지 말라는 지시 포함', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: 'x', new_string: entry('새', 400) } }),
    encoding: 'utf8',
  });
  const reason = JSON.parse(out).hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /토픽 파일/, '어디로 옮기라는 말이 없으면 사람이 플래그를 깎는다');
  assert.match(reason, /🚫재제안 금지/, '플래그 보존 지시가 빠졌다');
});

test('실제 settings.json에 훅이 등록돼 있다', () => {
  // 장치를 만들고 배선을 잊으면 조용히 0이 된다(CLAUDE.md 신뢰성 조항).
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
  const cmds = (s.hooks.PreToolUse || []).flatMap((e) => (e.hooks || []).map((h) => h.command || ''));
  assert.ok(cmds.some((c) => c.includes('memory-index-guard.js')), '훅이 settings.json에 없다');
});

/* ── --check : 재는 층을 하나로 (F052) ────────────────────────────────────────
 * 실사고: 인덱스 줄 길이를 awk 로 재고 「250자 위반」이라 보고했는데, awk 는 **바이트**를 세고
 * 훅은 JS 문자를 센다. 한글이 3바이트라 175자가 324로 보였다. 실측 대조(08-04, 실 MEMORY.md):
 * 같은 파일이 훅 기준 3건 · awk 기준 43건 — **14배**.
 * 처방은 「조심해서 재라」가 아니라 **훅이 쓰는 판정기를 그대로 CLI 로 노출하는 것**이다. */

const HOOKJS = path.join(__dirname, '..', '.claude', 'hooks', 'memory-index-guard.js');
function check(본문) {
  const f = path.join(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'midx-')), 'MEMORY.md');
  fs.writeFileSync(f, 본문);
  const r = require('node:child_process').spawnSync(process.execPath, [HOOKJS, '--check', f], { encoding: 'utf8' });
  return { code: r.status, out: String(r.stdout || '') };
}

test('--check 는 훅과 같은 기준(JS 문자)으로 잰다 — 한글이 바이트로 부풀어도 안 속는다', () => {
  // 한글 200자 = 600바이트. awk·wc -m 으로 재면 위반처럼 보이지만 훅 기준으로는 상한 안이다.
  const 한글줄 = '- [x](x.md) — ' + '가'.repeat(200);
  assert.ok(한글줄.length <= 250, '픽스처 전제가 깨졌다(문자 기준 상한 이내여야 한다)');
  assert.ok(Buffer.byteLength(한글줄, 'utf8') > 250, '픽스처 전제가 깨졌다(바이트로는 넘어야 한다)');
  const r = check(`# 인덱스\n${한글줄}\n`);
  assert.strictEqual(r.code, 0, '바이트로 재는 층과 섞였다 — 정확히 F052 의 형태다');
  assert.match(r.out, /위반 0건/);
});

test('--check 는 진짜 위반을 행 번호와 길이로 짚는다', () => {
  const 긴줄 = '- [y](y.md) — ' + '나'.repeat(300);
  const r = check(`# 인덱스\n- [a](a.md) — 짧다\n${긴줄}\n`);
  assert.strictEqual(r.code, 1, '위반이 있는데 0으로 끝났다 — 통과와 미실행이 같은 모양이면 안 된다');
  assert.match(r.out, /3행/, '몇 행인지가 안 보인다');
  assert.match(r.out, new RegExp(String(긴줄.length)), '실제 길이를 안 보여준다');
});

test('--check 는 인덱스 줄만 본다 (제목·설명 문단은 대상이 아니다)', () => {
  const 긴설명 = '> ' + '다'.repeat(400);
  const r = check(`# 인덱스\n${긴설명}\n- [a](a.md) — 짧다\n`);
  assert.strictEqual(r.code, 0, '인덱스 줄이 아닌 것을 셌다 — 훅과 대상이 갈렸다');
});
