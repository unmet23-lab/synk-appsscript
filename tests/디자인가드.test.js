/* 디자인가드 회귀 — 시각 산출물을 만질 때 브랜드 킷이 실제로 주입되는가.
 *
 * 두 축을 분리한다(CLAUDE.md 「가드·회귀의 세 맹점」):
 *   · **탐지력은 픽스처가 진다** — 앵커가 죽은 DESIGN.md 를 일부러 만들어 검사한다.
 *     실저장소가 깨끗해지면 「죽은 앵커를 잡는다」를 아무도 증명하지 않게 되기 때문이다.
 *     반대로 실저장소가 더러울 것을 **요구하는** 회귀는 쓰지 않는다.
 *   · **실저장소는 거짓양성만 본다** — 지금 DESIGN.md 의 죽은 앵커가 0 이어야 한다.
 *
 * 세 층 전부 본다: 로직 / **등록층**(settings.json 매처) / **자기 처방**(F103).
 *   가드는 로직보다 등록층에서 새고, 새는 방향은 언제나 「통과」다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'design-guard.js');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');
const DESIGN_MD = path.join(ROOT, 'DESIGN.md');
const guard = require(HOOK);

const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-design-guard-t-'));
test.after(() => { try { fs.rmSync(임시, { recursive: true, force: true }); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } });

let seq = 0;
const 새세션 = () => `t${process.pid}-${(seq += 1)}`;

/** 훅을 **서브프로세스로** 부른다 — require 로 로직만 부르면 stdin·표시파일·종료코드를
 *  다 건너뛰어 「실제로 도는가」를 안 재게 된다. */
function 호출(session_id, file_path, opts = {}) {
  const 입력 = JSON.stringify({ tool_name: opts.tool || 'Write', session_id, tool_input: { file_path } });
  const env = { ...process.env, SYNK_DESIGN_GUARD_DIR: opts.dir || 임시 };
  if (opts.designMd) env.SYNK_DESIGN_MD = opts.designMd;
  const out = execFileSync(process.execPath, [HOOK], { input: 입력, encoding: 'utf8', env });
  if (!out.trim()) return { decision: 'allow', reason: '' };
  const j = JSON.parse(out);
  return {
    decision: j.hookSpecificOutput.permissionDecision,
    reason: j.hookSpecificOutput.permissionDecisionReason,
  };
}

// ── ① 대상 판정 ─────────────────────────────────────────────────────────────

test('시각 산출물 확장자를 잡는다', () => {
  for (const p of [
    'docs/발표물/01_설명회_덱_16x9.html',
    'crewcard/카드_kr.html',
    'docs/tools/synk-tokens.css',
    'assets/로고_W5.svg',
    'app/화면/홈.tsx',
    'src/Card.jsx',
    'docs/디자인_토큰.json',
  ]) assert.ok(guard.대상인가(p), `시각 산출물인데 안 잡힌다: ${p}`);
});

test('시각 산출물이 아닌 것은 조용하다 (거짓양성이 훅을 꺼지게 만든다)', () => {
  for (const p of [
    'Code.js', 'contents_상담AI.js', 'docs/세션보드.md', 'CLAUDE.md',
    'tools/브랜드렌더린트.js', 'docs/tools/브랜드폰트_임베드.py', 'package.json',
  ]) assert.ok(!guard.대상인가(p), `시각 산출물이 아닌데 잡힌다: ${p}`);
});

test('제외는 전부 이유를 달고 있고, 실제로 제외된다', () => {
  for (const [re, 이유] of guard.제외) {
    assert.ok(이유 && 이유.length >= 6, `제외 이유가 비었다: ${re}`);
  }
  assert.ok(!guard.대상인가('tests/픽스처/더러운.html'), 'tests 픽스처가 제외되지 않는다');
  assert.ok(!guard.대상인가('node_modules/x/y.css'), 'node_modules 가 제외되지 않는다');
});

// ── ② 킷은 DESIGN.md 에서 **파생**된다 (두 곳에 안 적는다) ──────────────────

test('픽스처: 앵커가 죽으면 잡아내고, 살아 있으면 통과한다', () => {
  const 죽은판 = path.join(임시, 'DEAD.md');
  fs.writeFileSync(죽은판, '# 킷\n\n- 3규칙: 신호는 하나\n\n본문만 있고 철칙이 없다.\n', 'utf8');
  const r = 호출(새세션(), 'a.html', { designMd: 죽은판 });
  assert.strictEqual(r.decision, 'deny');
  assert.match(r.reason, /앵커/, '앵커가 죽었는데 경고가 없다 — 빈 주입은 미실행과 같은 모양이다');
  assert.match(r.reason, /철칙/, '어느 앵커가 죽었는지 안 알려준다');

  const 산판 = 호출(새세션(), 'a.html');
  assert.strictEqual(산판.decision, 'deny');
  assert.doesNotMatch(산판.reason, /앵커 .* 가 죽었다/, '멀쩡한 DESIGN.md 에 죽은 앵커를 보고한다');
});

test('실저장소: 지금 DESIGN.md 의 앵커가 전부 살아 있다', () => {
  const k = guard.킷추출();
  assert.ok(k, 'DESIGN.md 를 못 읽는다');
  assert.deepStrictEqual(k.죽은앵커, [], `DESIGN.md 앵커가 죽었다 — 훅이 빈 킷을 주입한다`);
});

test('주입되는 인용이 DESIGN.md 에 문자 그대로 실존한다 (파생 증명)', () => {
  const 본문 = fs.readFileSync(DESIGN_MD, 'utf8').replace(/\r/g, '');
  const k = guard.킷추출();
  for (const 조각 of [k.삼규칙, k.이모지, k.감각]) {
    assert.ok(본문.includes(조각), `정본에 없는 문장을 주입한다: ${조각.slice(0, 40)}…`);
  }
  // 철칙은 여러 줄 — 줄 단위로 전수 대조한다(한 줄이라도 어긋나면 파생이 아니라 사본이다)
  for (const line of k.철칙.split('\n')) {
    assert.ok(본문.includes(line), `철칙 인용이 정본과 어긋난다: ${line.slice(0, 40)}…`);
  }
});

// ── ③ 세션당 1회 ────────────────────────────────────────────────────────────

test('첫 시각 편집에서 막고, 같은 세션의 다음 편집은 조용히 통과한다', () => {
  const s = 새세션();
  assert.strictEqual(호출(s, 'docs/발표물/x.html').decision, 'deny', '첫 편집이 안 막힌다');
  assert.strictEqual(호출(s, 'docs/발표물/y.html').decision, 'allow', '같은 세션에서 또 막는다');
  assert.strictEqual(호출(s, 'a.css', { tool: 'Edit' }).decision, 'allow', '도구가 바뀌면 또 막는다');
});

test('세션이 바뀌면 다시 걸린다 (인계된 세션이 킷 없이 시작하지 않게)', () => {
  호출(새세션(), 'a.html');
  assert.strictEqual(호출(새세션(), 'a.html').decision, 'deny', '새 세션인데 안 막힌다');
});

test('세션 id 가 없어도 모든 세션이 한 표시를 공유하지 않는다 (「모름」이 「통과」가 되는 형태)', () => {
  // 폴백은 두 단이다: session_id → 세션식별.자리id() → 날짜. 둘 다 검사한다.
  /* ⚠ 「식별자가 하나도 없다」는 **id 소스 전부**를 비워야 만들어진다(F633) — HOST 만 지우면
   *   주변 env 의 `CLAUDE_CODE_SESSION_ID` 가 답을 흘려 넣어, 이 검사가 러너에 따라 갈린다(F296). */
  const 세션식별 = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', '세션식별.js'));
  const 원래 = new Map(세션식별.환경변수들.map((k) => [k, process.env[k]]));
  try {
    for (const k of 세션식별.환경변수들) delete process.env[k];
    process.env.CLAUDE_CODE_HOST_SESSION_ID = 'host-abc';
    assert.match(guard.표시경로(undefined), /host-abc/, '호스트 세션 id 폴백이 안 걸린다');

    for (const k of 세션식별.환경변수들) delete process.env[k];
    const 오늘 = new Date().toISOString().slice(0, 10);
    assert.match(guard.표시경로(undefined), new RegExp(오늘.replace(/-/g, '.')),
      '식별자가 하나도 없을 때 날짜로 안 떨어진다 — 모든 세션이 한 파일을 공유해 첫 세션 이후 영영 안 뜬다');
  } finally {
    for (const [k, v] of 원래) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('비시각 파일은 표시를 소모하지 않는다 (엉뚱한 편집이 킷 주입을 삼키면 안 된다)', () => {
  const s = 새세션();
  assert.strictEqual(호출(s, 'Code.js').decision, 'allow');
  assert.strictEqual(호출(s, 'docs/세션보드.md').decision, 'allow');
  assert.strictEqual(호출(s, 'a.html').decision, 'deny', '비시각 편집이 표시를 먼저 태웠다');
});

// ── ④ 자기 처방 (F103) — 차단 사유가 시키는 것이 실제로 되는가 ──────────────

test('막힌 뒤 **같은 편집을 그대로 재실행**하면 통과한다 (무한 루프 방지)', () => {
  const s = 새세션();
  const 막힘 = 호출(s, 'docs/발표물/z.html');
  assert.strictEqual(막힘.decision, 'deny');
  assert.match(막힘.reason, /다시 실행하면 통과/, '재실행이 통과한다는 안내가 없다');
  assert.strictEqual(호출(s, 'docs/발표물/z.html').decision, 'allow',
    '사유가 시킨 대로 재실행했는데 또 막힌다 — 따를 수 없는 처방이다(F103)');
});

test('사유가 가리키는 파일·도구·스킬이 전부 실존한다', () => {
  const r = 호출(새세션(), 'a.html');
  assert.match(r.reason, /DESIGN\.md/, '킷 정본을 안 가리킨다');
  assert.ok(fs.existsSync(DESIGN_MD), 'DESIGN.md 가 없다');

  assert.match(r.reason, /tools\/브랜드렌더린트\.js/, '검사 통로를 안 가리킨다');
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', '브랜드렌더린트.js')), '린트 파일이 없다');

  for (const 스킬 of ['make-interfaces-feel-better', 'emil-design-eng']) {
    assert.match(r.reason, new RegExp(스킬), `스킬을 안 가리킨다: ${스킬}`);
    assert.ok(fs.existsSync(path.join(ROOT, '.claude', 'skills', 스킬, 'SKILL.md')),
      `가리키는 스킬이 없다: ${스킬}`);
  }
});

test('처방이 시킨 DESIGN.md 읽기가 read-budget 에 막히지 않는다 (가드끼리 물리면 우회가 정상이 된다)', () => {
  /* ⚠ read-budget.js 는 require 하면 안 된다 — `require.main` 가드가 없어 stdin 에서 멈춘다.
   * 상수는 소스에서 읽는다. 그쪽이 경계를 바꾸면 이 검사도 따라간다(값을 두 곳에 안 적는다).
   * 🔴 축 교체(2026-08-15 · 2차 재발): 구 검사 「크기 < BIG」는 바이트 문턱을 사람이 지키게 하는
   * 회귀라 #Q73 수리(여유 873B) 하루 만에 feat 커밋 하나(+899B)로 다시 깨졌다 — 같은 자리
   * 주인 없는 적색 2번째 = 시스템 결함. 지금 훅 처방은 문턱 초과 시 구역 읽기(limit≤CHUNK ·
   * read-budget 이 일부러 예산 밖에 둔 권장 통로)라 어느 크기에서도 따라갈 수 있고, 크기와
   * 처방의 결합 자체가 없다. 남은 전제 하나 = 「구역 한 번에 전문이 들어온다」 — 그것만 지킨다
   * (실측 08-15: 155줄 vs 경계 400줄 — 여유가 바이트 축의 수십 배라 3번째가 설 땅이 없다).
   * ⚠ BIG 정규식 사망은 이 테스트가 아니라 아래 문턱 초과 픽스처가 잡는다(「넘었다」가 사라진다). */
  const 소스 = fs.readFileSync(path.join(ROOT, '.claude', 'hooks', 'read-budget.js'), 'utf8');
  const c = 소스.match(/const CHUNK\s*=\s*(\d+)/);
  assert.ok(c, 'read-budget 의 CHUNK 상수를 못 찾았다 — 이 검사가 조용히 무의미해진다');
  const CHUNK = Number(c[1]);
  const 줄수 = fs.readFileSync(DESIGN_MD, 'utf8').split(/\r?\n/).length;
  assert.ok(줄수 <= CHUNK,
    `DESIGN.md 가 ${줄수}줄 — 구역 읽기 경계(limit ≤ ${CHUNK})를 넘어 「그 한 번에 전문이 다 들어온다」 처방이 거짓이 된다`);
});

/* 위 검사는 **처방의 전제(한 구역에 전문이 들어온다)가 깨진 것**을 잡는다. 아래 둘은 **훅이 크기를 모른 채 반대로 말하는 것**을 잡는다.
 * 08-14(#Q73) 실사고에서 새어 나온 자리가 정확히 여기다 — 위 검사가 적색인 동안 훅은
 * 「≈4.5KB · read-budget 무료 구간」이라 적힌 손 값을 그대로 내보내며 전문 읽기를 권하고 있었다.
 * 크기 초과보다 이쪽이 나쁘다: 예산에 막히는 읽기를 «무료»라 부르면 우회가 정상 통로가 된다(F103). */

test('처방이 말하는 DESIGN.md 크기가 «지금» 크기다 (손으로 적으면 파일이 자라는 순간 거짓말이 된다)', () => {
  const 지금 = (fs.statSync(DESIGN_MD).size / 1024).toFixed(1);
  const out = execFileSync(process.execPath, [HOOK, '--show'], { encoding: 'utf8' });
  assert.match(out, new RegExp(`${지금.replace('.', '\\.')}KB`),
    `처방이 말하는 크기가 지금 크기(${지금}KB)와 다르다 — 파생이 아니라 손으로 적힌 값이다`);
});

/** 앵커만 살아 있는 최소 픽스처 — 크기·줄수만 바꿔 가며 여러 검사가 공유한다(두 곳에 안 적는다). */
const 앵커 = '# 킷\n\n- 3규칙: 신호는 하나\n\n이모지 과다 금지\n\n**철칙 4** — ① 순백 금지.\n\n- 감각 규칙: 동심원\n';

test('픽스처: 문턱을 넘은 DESIGN.md 를 「무료 구간」이라 부르지 않는다 (탐지력)', () => {
  const 큰판 = path.join(임시, 'BIG.md');
  fs.writeFileSync(큰판, 앵커 + '\n' + 'ㄱ'.repeat(20000), 'utf8'); // 한글 3B/자 = 60KB
  const r = 호출(새세션(), 'a.html', { designMd: 큰판 });
  assert.doesNotMatch(r.reason, /무료 구간/, '문턱을 넘었는데 「무료 구간」이라 말한다 — 따를 수 없는 처방(F103)');
  assert.match(r.reason, /넘었다/, '문턱 초과를 아예 안 알린다 — 조용한 통과');

  // 거짓양성도 본다: 문턱 아래에서까지 경고하면 그 경고는 곧 무시된다.
  const 작은판 = path.join(임시, 'SMALL.md');
  fs.writeFileSync(작은판, 앵커, 'utf8');
  const r2 = 호출(새세션(), 'b.html', { designMd: 작은판 });
  assert.match(r2.reason, /무료 구간/, '문턱 아래인데 「무료 구간」이라 말하지 않는다');
});

test('픽스처: 문턱을 넘으면 «따라갈 수 있는» 구역 읽기를 처방한다 (옛 처방으로 되돌아가면 빨개진다)', () => {
  /* 🔴 08-15 변이 실측으로 드러난 구멍 — 이 검사가 없는 동안, 초과 분기 처방을 옛 문구
   * (「이 파일을 문턱 아래로 되돌려라」)로 되돌리는 변이가 **CI 를 그대로 통과했다**.
   * 위 검사들은 「크기를 맞게 말하는가」만 보고, 그때 훅이 **무엇을 시키는가**는 아무도 안 봤다.
   * 그래서 처방 교체(F468) 자체에 회귀가 없었다 — 수리가 되돌려져도 조용한 상태였다.
   * 옛 처방은 사람이 바이트를 지키게 하는 해법이라 이미 두 번 깨졌다(#Q73 · F468) — 되돌아오면 세 번째다. */
  const 소스 = fs.readFileSync(path.join(ROOT, '.claude', 'hooks', 'read-budget.js'), 'utf8');
  const CHUNK = Number((/const CHUNK\s*=\s*(\d+)/.exec(소스) || [])[1]);
  assert.ok(Number.isFinite(CHUNK), 'read-budget 의 CHUNK 를 못 읽었다 — 이 검사가 조용히 무의미해진다');

  const 큰판 = path.join(임시, 'BIG-처방.md');
  fs.writeFileSync(큰판, 앵커 + '\n' + 'ㄱ'.repeat(20000), 'utf8');
  const r = 호출(새세션(), 'a.html', { designMd: 큰판 });

  assert.match(r.reason, new RegExp(`limit[^\\n]*${CHUNK}`),
    `문턱을 넘었는데 구역 읽기(limit ≤ ${CHUNK})를 안 시킨다 — read-budget 이 **일부러 예산 밖에 둔** 유일한 통로다(F103)`);
  assert.doesNotMatch(r.reason, /문턱 아래로 되돌/,
    '처방이 「파일을 줄여라」로 되돌아갔다 — 그건 사람이 바이트를 지키는 해법이고 이미 두 번 깨졌다(F468)');
});

test('--show 가 훅과 같은 문장을 낸다 (잴 통로를 하나로 · F052)', () => {
  const out = execFileSync(process.execPath, [HOOK, '--show'], { encoding: 'utf8' });
  assert.match(out, /철칙 4/, '--show 가 킷을 안 보여준다');
  assert.match(out, /브랜드렌더린트/, '--show 가 검사 통로를 안 보여준다');
});

// ── ⑤ 등록층 — 가드는 로직보다 등록층에서 샌다 ──────────────────────────────

test('settings.json 라우팅이 훅이 잡는 것보다 넓다', () => {
  const cfg = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const pre = (cfg.hooks && cfg.hooks.PreToolUse) || [];
  const entry = pre.find((b) => (b.hooks || []).some((h) => String(h.command || '').includes('design-guard.js')));
  assert.ok(entry, 'design-guard.js 가 PreToolUse 에 등록돼 있지 않다 — 훅이 아예 안 돈다');

  // 훅 본체는 Edit|Write|MultiEdit 셋을 처리한다. 매처가 그보다 좁으면 그 자체가 구멍이다.
  for (const tool of ['Edit', 'Write', 'MultiEdit']) {
    assert.ok(new RegExp(`^(?:${entry.matcher})$`).test(tool),
      `매처가 ${tool} 을 안 잡는다: ${entry.matcher}`);
  }

  const cmd = entry.hooks.find((h) => String(h.command || '').includes('design-guard.js')).command;
  // 앞단에서 경로로 미리 거르면 훅보다 좁아진다 — case 필터가 없어야 한다
  assert.ok(!/case "\$IN"/.test(cmd), '등록층에 case 필터가 있다 — 판정층이 둘로 갈린다(F063)');
  // 이식성(F044): 로컬 절대경로면 다른 기계에서 통째로 죽는다
  assert.ok(cmd.includes('${CLAUDE_PROJECT_DIR:-$PWD}'), '등록이 프로젝트 변수+폴백을 안 쓴다');
  assert.ok(!/[A-Za-z]:\\/.test(cmd), '등록에 윈도 절대경로가 박혔다');
  // 실패 안전: 훅을 못 찾으면 통과가 아니라 차단이어야 한다
  assert.ok(cmd.includes('"permissionDecision":"deny"'), '훅 미실행 시 통과하게 돼 있다(F044)');
});

test('DESIGN.md §6 이 가리키는 스킬과 훅이 가리키는 스킬이 갈라지지 않는다', () => {
  const 본문 = fs.readFileSync(DESIGN_MD, 'utf8');
  const r = 호출(새세션(), 'a.html');
  for (const 스킬 of ['make-interfaces-feel-better', 'emil-design-eng']) {
    assert.ok(본문.includes(스킬), `DESIGN.md §6 에 없는 스킬을 훅이 권한다: ${스킬}`);
    assert.match(r.reason, new RegExp(스킬));
  }
});
