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
const { 훅띄우기 } = require('./lib/훅띄우기');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'memory-index-guard.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'memidx-'));
const INDEX = path.join(TMP, 'MEMORY.md');

const entry = (name, chars) => `- [${name}](${name}.md) — ${'가'.repeat(chars)}`;
const SHORT = entry('짧은-토픽', 60);
const LONG = entry('긴-토픽', 400);

fs.writeFileSync(INDEX, ['# Project Memory', '', '> 인덱스는 지도다.', '', SHORT, LONG, ''].join('\n'), 'utf8');

/* ⚠ 「출력이 있는데 결정이 없는 경우」= **알림만 낸 훅**이다. 그걸 그대로 돌려주면 판정이
 *   `undefined` 가 되어 통과가 두 모양이 된다 — 알림을 붙이는 순간 이 도우미부터 고쳐야 한다는
 *   경고가 memory/guard-routing-and-collisions(F235 절)에 이미 적혀 있었고, ③ 축을 붙이며 실제로 밟았다. */
function decide(payload, env) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...(env || {}) },
  });
  if (!out.trim()) return 'allow';
  const 결정 = (JSON.parse(out).hookSpecificOutput || {}).permissionDecision;
  return 결정 || 'allow';
}

/** 결정과 글을 **한 번의 실행으로** 받는다.
 *
 * 🔴 두 번 띄우면 안 된다 — 통과한 호출은 기준 도장을 갱신하므로 **관측이 다음 관측을 바꾼다**.
 *   실제로 밟았다: 「구역 읽기는 기준이 아니다」 검사가 글을 먼저 받느라 훅을 한 번 더 띄웠고,
 *   그 호출이 기준을 심어 두 번째 호출이 deny 로 뒤집혔다(재는 층이 값을 깨뜨린 자리 · F045 계열). */
function 훅응답(payload, env) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...(env || {}) },
  });
  if (!out.trim()) return { 결정: 'allow', 글: '' };
  const o = JSON.parse(out).hookSpecificOutput || {};
  return { 결정: o.permissionDecision || 'allow', 글: String(o.permissionDecisionReason || o.additionalContext || '') };
}
const 훅글 = (payload, env) => 훅응답(payload, env).글;

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

/* ── F123: 재는 축은 「들어온 조각」이 아니라 편집 **결과**의 줄이다 ────────────────
 * 08-06 실사고: 부분 치환으로 250자 초과 줄을 「고쳤는데」 결과 줄이 277자여도 통과했다
 * (MEMORY.md 8차 압축 중 3줄 실측). 훅이 본 것은 들어온 조각이고 상한이 걸린 대상은
 * 편집 뒤 파일의 줄이라 축이 어긋났다 — 새는 방향은 언제나 통과다. */
test('[F123·탐지] 부분 치환 — 조각은 짧아도 결과 줄이 상한 위면 차단', () => {
  // LONG(400자대) 줄의 이름 조각만 바꾼다 — 들어오는 조각은 몇 자뿐, 결과 줄은 그대로 길다.
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: '[긴-토픽]', new_string: '[긴-토픽2]' } }),
    'deny',
    '조각이 짧다고 통과시켰다 — 결과 줄은 여전히 상한 위다(F123 재발)'
  );
});

test('[F123·거짓양성] 부분 치환으로 상한 아래로 **마무리한** 편집은 통과', () => {
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: '가'.repeat(400), new_string: '가'.repeat(100) } }),
    'allow',
    '긴 줄을 상한 아래로 줄였는데 막혔다 — 압축이 훅에 걸린다'
  );
});

test('[F123·거짓양성] 기존 긴 줄을 Edit 로 그대로 옮겨 적는 재배치는 통과 — Write 재배치와 같은 결이다', () => {
  // 짧은 줄 자리에 「짧은 줄 + 기존 긴 줄 사본」을 넣는다 — 결과에 긴 줄이 늘지만 전부 이미 있던 줄이다.
  assert.strictEqual(
    decide({ tool_name: 'Edit', tool_input: { file_path: INDEX, old_string: SHORT, new_string: SHORT + '\n' + LONG } }),
    'allow',
    '이미 있던 줄을 옮겨 적었는데 막혔다 — 아카이브 이동·재배치가 훅에 걸린다'
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
  // 통과코드 0·1 = `--check` 의 계약(0 깨끗 / 1 위반). 그 밖은 못 띄웠거나 터진 것이라 결과가 아니다.
  const r = 훅띄우기([HOOKJS, '--check', f], { encoding: 'utf8', 통과코드: [0, 1] });
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

/* ── ② 총 줄 수 상한 (F181-b · 2026-08-07 신설) ─────────────────────────────────
 * 줄당 상한만 있던 시절, 250자 이내의 착한 줄이 무한히 쌓였고 유일한 제동은 사람의 손 압축
 * (머리말이 스스로 세는 횟수가 **12차**)이었다. 이 절이 지키려는 성질은 셋이다:
 *   ①늘리며 상한을 넘는 편집은 막는다  ②상한 아래는 건드리지 않는다
 *   ③**줄이는 편집은 상한 위에서도 통과한다** — ③이 깨지면 압축 자체가 불가능해지고,
 *     그러면 다음 사람은 규칙을 지키는 게 아니라 훅을 끈다(v6.11 · F103 자기 처방).
 *
 * ⚠ 축이 **줄**인 이유: 상한을 집행하는 건 저장소가 아니라 하네스이고, 그쪽 문구가
 *   "Compact it to under 140 lines." 다. 이 트랙의 첫 판은 자(char) 로 쟀고 그건 안 물렸다 —
 *   실측 순간 인덱스가 140줄(초과)인데 19,522자(상한 안)라 훅이 조용했다(F089). */

const MAX_LINES = 139; // 훅과 같은 값. 갈라지면 아래 [단일 출처] 테스트가 잡는다.

/** 줄당 상한(250자)에 안 걸리면서 정확히 N 줄인 인덱스를 만든다. */
function 인덱스(줄수) {
  const 줄 = ['# Project Memory', '> 인덱스는 지도다.'];
  for (let i = 0; 줄.length < 줄수; i++) 줄.push(`- [t${i}](t${i}.md) — 짧다`);
  return 줄.join('\n');
}

function 인덱스로결정(본문, payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memtotal-'));
  const f = path.join(dir, 'MEMORY.md');
  fs.writeFileSync(f, 본문, 'utf8');
  return decide({ ...payload, tool_input: { ...payload.tool_input, file_path: f } });
}

const 앵커 = '> 인덱스는 지도다.';

const 한줄더 = 앵커 + '\n- [새](새.md) — 한 줄 늘린다';

test('[단일 출처] 훅이 쓰는 상한과 이 테스트의 상한이 같다', () => {
  // 값을 두 곳에 적으면 갈라진다 — 훅 소스에서 직접 읽어 대조한다.
  const src = fs.readFileSync(HOOK, 'utf8');
  const m = src.match(/const MAX_LINES = (\d+)/);
  assert.ok(m, '훅에 MAX_LINES 가 없다 — 줄 수 상한이 통째로 사라졌다');
  assert.strictEqual(Number(m[1]), MAX_LINES);
});

test('[단일 출처] 상한의 근거인 하네스 원문이 훅에 인용돼 있다', () => {
  // 이 숫자는 저장소가 정한 게 아니다. 근거 문구가 사라지면 다음 사람이 값을 발명하게 된다.
  assert.match(fs.readFileSync(HOOK, 'utf8'), /Compact it to under 140 lines\./);
});

test('[탐지] 줄을 늘리면서 상한을 넘기는 편집은 차단', () => {
  assert.strictEqual(
    인덱스로결정(인덱스(MAX_LINES), { tool_name: 'Edit', tool_input: { old_string: 앵커, new_string: 한줄더 } }),
    'deny'
  );
});

test('[거짓양성] 상한 안에서 줄을 늘리는 편집은 통과 — 상한은 동결이지 금지가 아니다', () => {
  assert.strictEqual(
    인덱스로결정(인덱스(MAX_LINES - 5), { tool_name: 'Edit', tool_input: { old_string: 앵커, new_string: 한줄더 } }),
    'allow'
  );
});

test('[거짓양성] 줄 수를 안 바꾸고 문장만 늘리는 편집은 상한 위에서도 통과 — 축은 자가 아니라 줄이다', () => {
  assert.strictEqual(
    인덱스로결정(인덱스(MAX_LINES + 5), {
      tool_name: 'Edit',
      tool_input: { old_string: 앵커, new_string: 앵커 + ' 가나다라마바사' },
    }),
    'allow'
  );
});

test('[핵심·자기 처방] 이미 상한을 넘은 파일이라도 **줄이는** 편집은 통과한다', () => {
  // 차단문이 시키는 게 바로 이 편집이다. 이게 막히면 처방이 따를 수 없는 처방이 된다(F103).
  const 본문 = 인덱스(MAX_LINES + 5);
  const 뺄줄 = 본문.split('\n').find((l) => l.startsWith('- [t3]'));
  assert.ok(뺄줄, '픽스처 전제가 깨졌다');
  assert.strictEqual(
    인덱스로결정(본문, { tool_name: 'Edit', tool_input: { old_string: '\n' + 뺄줄, new_string: '' } }),
    'allow',
    '상한 위에서 줄이는 편집이 막혔다 — 압축이 영원히 불가능해진다'
  );
});

test('[핵심·자기 처방] 상한 위에서 Write 로 통째 압축하는 것도 통과 — 옆 트랙의 파일명 교체가 이 모양이다', () => {
  const 결정 = 인덱스로결정(인덱스(MAX_LINES + 5), {
    tool_name: 'Write',
    tool_input: { content: 인덱스(MAX_LINES - 20) },
  });
  assert.strictEqual(결정, 'allow', '압축 Write 가 막혔다 — 12차 손 압축조차 못 하게 된다');
});

test('[탐지] 상한을 이미 넘은 파일에서 **줄을 더 늘리면** 차단', () => {
  assert.strictEqual(
    인덱스로결정(인덱스(MAX_LINES + 5), { tool_name: 'Edit', tool_input: { old_string: 앵커, new_string: 한줄더 } }),
    'deny'
  );
});

test('경계값 — 결과가 정확히 상한 줄이면 통과(넘을 때만 막는다)', () => {
  assert.strictEqual(
    인덱스로결정(인덱스(MAX_LINES - 1), { tool_name: 'Edit', tool_input: { old_string: 앵커, new_string: 한줄더 } }),
    'allow'
  );
});

test('old_string 이 파일에 없으면 판단을 보류한다 — Edit 자체가 실패할 것이라 추측으로 막지 않는다', () => {
  assert.strictEqual(
    인덱스로결정(인덱스(MAX_LINES + 5), {
      tool_name: 'Edit',
      tool_input: { old_string: '이 문자열은 파일에 없다', new_string: 한줄더 },
    }),
    'allow'
  );
});

test('차단문이 처방을 담는다 — 축(줄)·근거(하네스 원문)·탈출구가 다 있어야 한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memtotal-'));
  const f = path.join(dir, 'MEMORY.md');
  fs.writeFileSync(f, 인덱스(MAX_LINES), 'utf8');
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: f, old_string: 앵커, new_string: 한줄더 },
    }),
    encoding: 'utf8',
  });
  const reason = JSON.parse(out).hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /🚫재제안 금지/, '플래그 보존 지시가 빠지면 사람은 제일 짧은 것부터 깎는다');
  assert.match(reason, /줄이는 편집은 이 검사를 언제나 통과한다/, '탈출구를 안 알려주면 훅을 끈다(F103)');
  assert.match(reason, /그대로 다시 실행하라/, '주입인데 차단처럼 읽히면 사람은 훅을 끈다');
  assert.match(reason, /Compact it to under 140 lines\./, '근거가 없으면 다음 사람이 숫자를 발명한다');
  assert.match(reason, /자\(KB\)가 아니라 줄이다/, '축을 안 말하면 문장만 짧게 줄이고 줄 수는 0줄 준다');
  assert.match(reason, new RegExp(String(MAX_LINES)), '상한이 얼마인지가 없다');
  /* 🔴 여기가 이 훅에서 제일 깨지기 쉬운 자리다 — 처방이 「이미 소진된 수단」을 시키면 안 된다.
   * 08-07 실측(ef865456): 빈줄 25줄·작은 절 병합은 하루 만에 다 썼고 두 번째 시도가 0쌍이었다.
   * 남은 유일한 길은 하네스가 말한 「설명절을 토픽 파일로」다. 이 문구가 빠지면 다음 사람은 훅을 끈다. */
  assert.match(reason, /설명절을 토픽 파일로 옮겨라/, '따를 수 있는 처방이 없으면 차단은 우회를 만든다(F103)');
  assert.match(reason, /빈줄 걷기.*다 썼다/s, '소진된 수단을 다시 시키면 한 세션을 통째로 버린다');
});

/* 주입 성격(세션당 1회) — 하드 차단이면 곧 상시 차단이 된다(하루 유입 19~21줄 · 상한 139줄).
 * 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103). */
function 세션결정(sid, 자국dir, payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memtotal-'));
  const f = path.join(dir, 'MEMORY.md');
  fs.writeFileSync(f, 인덱스(MAX_LINES), 'utf8');
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: sid, ...payload, tool_input: { ...payload.tool_input, file_path: f } }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_INDEX_CAP_DIR: 자국dir },
  });
  return out.trim() ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'allow';
}

const 키우기 = { tool_name: 'Edit', tool_input: { old_string: 앵커, new_string: 한줄더 } };

test('[주입] 같은 세션의 두 번째 시도는 조용히 통과한다 — 판단은 사람이 하고 훅은 보여주기만 한다', () => {
  const 자국 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'memcap-')), '자국');
  assert.strictEqual(세션결정('sess-A', 자국, 키우기), 'deny', '첫 시도가 안 막히면 늘어나는 게 안 보인다');
  assert.strictEqual(세션결정('sess-A', 자국, 키우기), 'allow', '두 번째도 막으면 상시 차단 = 훅이 꺼진다');
});

test('[주입] 세션이 다르면 각자 한 번씩 본다 — 자국이 남의 세션까지 덮지 않는다', () => {
  const 자국 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'memcap-')), '자국');
  assert.strictEqual(세션결정('sess-B', 자국, 키우기), 'deny');
  assert.strictEqual(세션결정('sess-C', 자국, 키우기), 'deny', '한 세션이 본 것으로 전체가 조용해지면 안 된다');
});

test('세션 id 를 모르면 매번 경고한다 — 모름은 통과가 아니다', () => {
  const 자국 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'memcap-')), '자국');
  assert.strictEqual(세션결정(undefined, 자국, 키우기), 'deny');
  assert.strictEqual(세션결정(undefined, 자국, 키우기), 'deny', '식별자가 없을 때 조용해지면 새는 방향이 통과 쪽이다');
});

/* ── ③ 동시 편집 (F519) ──────────────────────────────────────────────────────
 *
 * 지키려는 성질 넷:
 *   ㉠ 내가 못 본 줄이 통째 쓰기에 사라지는 것은 막는다(되돌릴 수 없다)
 *   ㉡ 내가 본 줄을 내가 빼는 것은 압축이라 **언제나 통과**한다(막으면 훅이 꺼진다 · F103)
 *   ㉢ 다시 읽으면 같은 Write 가 통과한다 = 차단문이 시키는 그 명령이 실제로 통한다(자기 처방)
 *   ㉣ 못 쟀으면 못 쟀다고 말한다(초록과 미측정이 같은 모양이면 안 된다 · F207)
 *
 * 픽스처가 **진짜 도장 통로**(Read → tmp 기준본)를 그대로 탄다 — 기준을 테스트가 직접 심으면
 * 도장 통로가 죽어도 초록이 나온다(F253: 픽스처가 정본 좌표를 안 쓰면 초록은 탐지력이 아니다). */
function 새판() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memcas-'));
  return { file: path.join(dir, 'MEMORY.md'), env: { SYNK_INDEX_BASE_DIR: path.join(dir, '기준') } };
}
const 항목 = (n) => `- [토픽${n}](t${n}.md) — 한 문장 ${n}`;
const 판본 = (ns) => ['# Project Memory', '', ...ns.map(항목), ''].join('\n');
const 읽기 = (판, sid, 더) => decide(
  { session_id: sid, tool_name: 'Read', tool_input: { file_path: 판.file, ...(더 || {}) } }, 판.env);
const 쓰기 = (판, sid, 본문) => decide(
  { session_id: sid, tool_name: 'Write', tool_input: { file_path: 판.file, content: 본문 } }, 판.env);
const 쓰기글 = (판, sid, 본문) => 훅글(
  { session_id: sid, tool_name: 'Write', tool_input: { file_path: 판.file, content: 본문 } }, 판.env);

test('[③·탐지] 내가 읽은 뒤 남이 넣은 줄이 통째 쓰기에서 사라지면 막는다', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내');                                          // 내 기준 = 1·2·3
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');        // 그 사이 남이 4 를 넣었다
  assert.strictEqual(쓰기(판, 'sess-내', 판본([1, 2, 3])), 'deny',
    '이게 통과하면 남의 줄이 소리 없이 사라진다 — F519 가 그 실사고다');
  assert.match(쓰기글(판, 'sess-내', 판본([1, 2, 3])), /토픽4/,
    '무엇이 사라지는지 안 보여주면 사람은 고칠 수가 없다');
});

test('[③·거짓양성] 내 기준에 있던 줄을 빼는 압축은 통과 — 그건 사고가 아니라 판정이다', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');
  읽기(판, 'sess-내');
  assert.strictEqual(쓰기(판, 'sess-내', 판본([1, 2])), 'allow',
    '압축을 막으면 이 훅은 꺼진다 — 인덱스는 줄이라고 하네스가 매 세션 요구한다');
});

test('[③·자기 처방] 다시 읽으면 같은 Write 가 통과한다 — 따를 수 없는 처방은 우회를 만든다(F103)', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내');
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');
  assert.strictEqual(쓰기(판, 'sess-내', 판본([1, 2, 3])), 'deny');
  읽기(판, 'sess-내');                                          // 차단문 ①·② 가 시키는 바로 그 동작
  assert.strictEqual(쓰기(판, 'sess-내', 판본([1, 2, 3])), 'allow',
    '차단문이 시킨 명령이 그 가드를 못 지나면 남는 출구는 BYPASS 뿐이다');
});

test('[③·거짓차단 금지] 내가 쓴 판이 내 기준이 된다 — 내가 넣은 줄을 내가 빼는 것도 압축이다', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내');
  assert.strictEqual(쓰기(판, 'sess-내', 판본([1, 2, 3, 9])), 'allow');
  fs.writeFileSync(판.file, 판본([1, 2, 3, 9]), 'utf8');        // 도구가 실제로 쓴 것을 흉내낸다
  assert.strictEqual(쓰기(판, 'sess-내', 판본([1, 2, 3])), 'allow',
    '기준을 안 갱신하면 내 첫 Write 가 넣은 줄을 내가 «남의 줄»로 읽고 스스로를 막는다');
});

/* 🔴 변이가 짚은 구멍 — 차단문의 **처방 ①** 이 회귀에 한 번도 안 걸려 있었다.
 * 「내 압축 결과에 저 줄들을 얹어라」가 그 문의 첫 처방인데, 그렇게 얹은 판이 통과하는지를
 * 아무도 안 쟀다. 통과 안 하면 남는 출구가 ②(다시 읽고 그냥 지우기)뿐이라 처방이 반쪽이 된다(F103). */
test('[③·자기 처방] 남의 줄을 내 판에 얹으면 통과한다 — 차단문이 첫 번째로 시키는 그 동작이다', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내');
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');        // 남이 넣은 4
  assert.strictEqual(쓰기(판, 'sess-내', 판본([1, 2, 4])), 'allow',
    '3 은 내 기준에 있던 줄이라 내가 뺀 것이고(압축), 4 는 얹었다 — 잃는 줄이 0이면 막을 이유가 없다');
});

test('[③·거짓양성] old_string 에 남의 줄을 담아 지우는 Edit 은 통과 — 눈으로 보고 지운 것이다', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내');
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');
  assert.strictEqual(
    decide({ session_id: 'sess-내', tool_name: 'Edit',
      tool_input: { file_path: 판.file, old_string: `${항목(3)}\n${항목(4)}`, new_string: 항목(3) } }, 판.env),
    'allow', 'old_string 이 디스크와 대조된다는 것은 그 줄을 실제로 봤다는 뜻이다 — 여기서 막으면 거짓차단이다');
});

test('[③·거짓양성] Edit 은 이 축을 안 본다 — old_string 이 디스크와 대조돼 모르는 줄을 못 지운다', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내');
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');
  assert.strictEqual(
    decide({ session_id: 'sess-내', tool_name: 'Edit',
      tool_input: { file_path: 판.file, old_string: 항목(1), new_string: `${항목(1)} 고침` } }, 판.env),
    'allow', '안 새는 자리에 검사를 세우면 거짓양성만 는다');
});

test('[③·경계] 구역 읽기(offset·limit)는 기준이 안 된다 — 일부만 본 세션은 전문을 본 세션이 아니다', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내', { offset: 1, limit: 2 });
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');
  const r = 훅응답({ session_id: 'sess-내', tool_name: 'Write',
    tool_input: { file_path: 판.file, content: 판본([1, 2, 3]) } }, 판.env);
  assert.match(r.글, /안 돌렸다/, '거짓 기준으로 «쟀다»고 하면 막아야 할 것을 통과시킨다');
  assert.strictEqual(r.결정, 'allow',
    '여기서 막으면 read-budget 이 권장하는 구역 읽기가 곧 상시 차단이 된다');
});

test('[③·분모] Read 없이 통째로 쓰면 «안 쟀다»고 말한다 — 초록과 미측정은 같은 모양이면 안 된다(F207)', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  const 글 = 쓰기글(판, 'sess-처음', 판본([1, 2]));
  assert.match(글, /Read` 로 연 적이 없다/);
  assert.match(글, /settings\.json/, '어느 층이 비었는지를 안 말하면 알림이 잔소리가 된다');
});

test('[③·순서] 소실과 250자 초과가 겹치면 «소실»을 먼저 말한다 — 되돌릴 수 없는 쪽이 앞이다(F228)', () => {
  const 판 = 새판();
  fs.writeFileSync(판.file, 판본([1, 2, 3]), 'utf8');
  읽기(판, 'sess-내');
  fs.writeFileSync(판.file, 판본([1, 2, 3, 4]), 'utf8');
  const 긴줄 = `- [긴-토픽](x.md) — ${'가'.repeat(300)}`;
  const 글 = 쓰기글(판, 'sess-내', `${판본([1, 2, 3])}${긴줄}\n`);
  assert.match(글, /사라진다/, '①(길이)가 앞에서 막으면 ③ 이 구조적으로 침묵한다 — F228 이 그 실사고다');
  assert.match(글, /초과 줄도 1개/, '미룬 사유를 안 실으면 두 번째 시도에서야 알게 된다');
});

/* ── 셸 통로 — 훅이 못 보는 자리로 새던 곳 (F519 곁가지) ───────────────────────── */
const 셸 = (cmd, 도구) => decide({ session_id: 's', tool_name: 도구 || 'Bash', tool_input: { command: cmd } });
const 인덱스경로 = '/c/Users/q/.claude/projects/p/memory/MEMORY.md';

test('[셸·탐지] 리다이렉트·이동으로 인덱스를 덮어쓰면 막는다 — F519 의 실제 통로다', () => {
  assert.strictEqual(셸(`cat 새판.md > ${인덱스경로}`), 'deny');
  assert.strictEqual(셸(`mv MEMORY.new.md ${인덱스경로}`), 'deny');
  assert.strictEqual(셸(`node 조립.js | tee ${인덱스경로}`), 'deny');
  assert.strictEqual(셸(`Set-Content -Path ${인덱스경로} -Value $x`, 'PowerShell'), 'deny');
});

test('[셸·거짓양성] 읽는 명령과 «인덱스를 원본으로 쓰는» 복사는 안 막는다', () => {
  assert.strictEqual(셸(`cat ${인덱스경로}`), 'allow');
  assert.strictEqual(셸(`grep -n 토픽 ${인덱스경로}`), 'allow');
  assert.strictEqual(셸(`cp ${인덱스경로} /tmp/backup.md`), 'allow', '목적지가 아니라 원본이다');
  assert.strictEqual(셸(`node .claude/hooks/memory-index-guard.js --check ${인덱스경로}`), 'allow');
});

test('[셸·처방] 차단문이 갈 곳을 말한다 — Write 도구와 스크래치패드', () => {
  const 글 = 훅글({ session_id: 's', tool_name: 'Bash', tool_input: { command: `mv a.md ${인덱스경로}` } });
  assert.match(글, /`Write` 도구로 써라/, '막기만 하고 통로를 안 주면 다음 사람은 우회를 만든다(F103)');
  assert.match(글, /스크래치패드/, '조립 산출물을 메모리 폴더에 두면 decision-queue 가 유령 ⏳ 를 만든다');
});

test('[라우팅] 매처가 Read·Bash·PowerShell 까지 잡는다 — 규칙만 늘리고 라우팅을 안 넓히면 조용히 샌다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
  const 등록 = (s.hooks.PreToolUse || []).find((e) => (e.hooks || [])
    .some((h) => String(h.command || '').includes('memory-index-guard.js')));
  assert.ok(등록, '등록이 없으면 훅 파일은 그냥 디스크의 글자다');
  for (const 도구 of ['Read', 'Edit', 'Write', 'MultiEdit', 'Bash', 'PowerShell']) {
    assert.ok(new RegExp(등록.matcher).test(도구), `매처가 ${도구} 를 안 잡는다 — 그 통로는 검사 밖이다`);
  }
});

test('--check 가 줄 수를 같은 판정기로 낸다 — 초과는 종료코드로 드러난다', () => {
  const 아래 = check(인덱스(MAX_LINES - 10));
  assert.strictEqual(아래.code, 0);
  assert.match(아래.out, /총 \d+줄 \/ 상한 139줄/, '줄 수를 안 보여주면 사람은 wc -l 로 재고 층이 갈린다');
  assert.match(아래.out, /Compact it to under 140 lines\./, '근거 문구가 없으면 이 숫자가 어디서 왔는지 모른다');
  // 자 수는 참고로만 찍는다 — 「상한 아님」이 안 붙으면 다음 사람이 또 그 축으로 상한을 세운다.
  assert.match(아래.out, /\(참고 · 상한 아님\) \d+자/, '자 수를 상한처럼 보이게 찍으면 이 트랙의 오진이 되풀이된다');

  const 위 = check(인덱스(MAX_LINES + 10));
  assert.strictEqual(위.code, 1, '초과인데 0으로 끝났다 — 통과와 미실행이 같은 모양이면 안 된다');
  assert.match(위.out, /초과/);
});
