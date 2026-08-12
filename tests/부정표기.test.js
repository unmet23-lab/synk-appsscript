/* 부정 표기 회귀 — 「안 만진다」를 「만진다」로 읽지 않는다 (마찰 F354 + 그 거울면).
 *
 * 사고의 모양: 보드의 「만지는 파일」 칸은 **비켜남을 같이 적는** 것이 관례인데
 * (`talk 0` · `배포 0` · `clasp push 0` · `<진짜 파일들>**(🚫<안 만지는 것>)`),
 * 자리를 재는 두 소비자가 그 관례를 **서로 다르게** 틀렸다:
 *   · `board-guard`      — 🚫 든 ` · ` 조각을 **통째로** 버렸다(너무 넓다)  + `clasp push 0` 은 점유로 셌다(너무 좁다)
 *   · `track-collision`  — 🚫 를 **아예 안 뗐다**(더 넓게 틀림)
 * 같은 판정이 두 곳에 살면 갈라지고, 갈라진 쪽이 조용히 틀린다(CLAUDE.md 가드 맹점 ④).
 * 이제 정본은 `tools/lib/보드.js` 의 `만지는텍스트` 하나다.
 *
 * 실측이 사정거리를 못박았다(아카이브+보드 32파일 · 데이터행 663 · 토큰 1020):
 *   · 토큰 «바로 뒤» 부정 꼬리 = 경로 축 **0건** · `clasp push` 축 **2건**
 *   · 🚫 조각째 버리기로 사라지던 «진짜» 자리 = **59건**(고유 경로 24)
 *
 * 여기서 못박는 것 넷:
 *   ① **탐지력은 픽스처가 진다** — 아래 표기는 전부 실보드에서 그대로 뜯어온 것이다(맹점 ①).
 *   ② 실저장소에는 **거짓양성만** 건다 — 「없던 자리를 만들지 않는다」 · 「부정 구절이 안 남는다」
 *      (맹점 ② — 버그가 아직 있을 것을 요구하는 회귀는 고치는 순간 빨개진다).
 *   ③ **두 방향을 같이** 잰다 — 부정을 떼되(과잉 차단) 진짜 선언은 안 죽인다(새는 쪽).
 *   ④ **소비자 둘이 같은 판정을 쓴다** — 한쪽만 고치면 갈라진 채로 초록이 된다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const 보드 = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));
const { 만지는텍스트 } = 보드;
const REPO = path.resolve(__dirname, '..');
const HOOK = path.join(REPO, '.claude', 'hooks', 'board-guard.js');
const TRACKHOOK = path.join(REPO, '.claude', 'hooks', 'track-collision.js');

/** 그 칸에서 「자리」로 잡히는 경로들 — board-guard 의 규칙과 같은 모양(2조각 이상·장부 제외). */
const 경로RE = /[\w가-힣./_-]+\.(?:ts|tsx|js|jsx|mjs|cjs|gs|json|html|md|sql|ya?ml)\b/g;
const 장부RE = /(세션보드|마찰신호|버전_이력|지침_이력)/;
const 자리 = (칸) => {
  const s = new Set();
  for (const m of String(칸).matchAll(경로RE)) {
    const p = m[0].replace(/^(?:\.\.?\/)+/, '').toLowerCase();
    if (p.split('/').length >= 2 && !장부RE.test(p)) s.add(p);
  }
  if (/clasp\s*push/i.test(칸)) s.add('공유:clasp-라이브');
  return s;
};
const 자리들 = (칸) => 자리(만지는텍스트(칸));

/* ── ① 신고된 방향 — 부정 표기를 점유로 읽지 않는다 ───────────────────────────── */

/* 실측 원문 그대로다(`local_ed8b5124` 가 이 표기로 deny 를 맞았다 · 아카이브에 2줄 산다). */
const 신고칸 = '검수 장부(도구)·`tools/이해대장.js`(CI 적색)·`docs/_ops/장부/F352.md`·메모리 · 이 줄 (배포 코드 편집 0 · clasp push 0 · talk 0 · 운영 DB 0)';

test('🔴 [F354] `clasp push 0` 은 점유가 아니다 — 비켜났다고 적은 것을 자리로 세면 관습이 죽는다', () => {
  assert.ok(!자리들(신고칸).has('공유:clasp-라이브'),
    '🔴 「안 민다」고 적은 줄이 라이브를 점유한 것으로 읽혔다 — 세션이 할 수 있는 건 그 낱말을 지우는 것뿐이고, 그 순간 정보가 보드에서 사라진다(F103)');
});

test('같은 칸의 **진짜** 선언은 그대로 산다 — 부정을 떼며 자리까지 떼면 새는 쪽이다', () => {
  const s = 자리들(신고칸);
  assert.ok(s.has('tools/이해대장.js'), `진짜 만지는 파일이 사라졌다: ${[...s].join(', ')}`);
});

test('진짜 `clasp push` 선언은 여전히 자리다 — 힘을 뺀 게 아니라 사정거리를 고친 것', () => {
  for (const 칸 of [
    '검수 장부(도구)·clasp push(배포집합 15)·버전_이력·이 줄 (엔진 코드 편집 0',   // 괄호가 꼬리를 끊는다
    '검수 장부(도구)·clasp push(v9.215)·`docs/_ops/작업대기열.md`(P0 낡음)·메모리',
    '검수기록.jsonl(`c4cdf6c6`) · clasp push 15종 · 이 줄 (코드 편집 0 · talk 0)',   // 「15종」은 부정이 아니다
    '`엔진_수집.js`(SCHEMA_VER)·`tests/계약.test.js`·clasp push·`엔진_운영배치.js`(스윕)',
  ]) {
    assert.ok(자리들(칸).has('공유:clasp-라이브'), `🔴 진짜 배포 선언을 놓쳤다 — 두 배포 트랙이 안 만난다:\n  ${칸}`);
  }
});

/* ── ② 거울면 — 🚫 는 «그 자리부터» 부정한다. 앞은 살린다 ────────────────────── */

/* 실보드 원문. 옛 판정은 이 조각을 통째로 버려 `tests/board-guard.test.js` 를 못 봤다. */
const 거울칸 = '**appsscript: `.claude/hooks/board-guard.js`·tests/board-guard.test.js**(🚫tools/board-move.js·작업본소유자.js=읽기만';

test('🔴 [거울면] 🚫 «앞» 의 진짜 자리가 살아난다 — 실측 59건이 조용히 사라지고 있었다', () => {
  const s = 자리들(거울칸);
  assert.ok(s.has('tests/board-guard.test.js'),
    `🔴 🚫 가 같은 조각에 붙었다는 이유로 진짜 선언이 통째로 사라졌다 — 새는 방향이라 증상이 「조용함」이다: ${[...s].join(', ')}`);
  assert.ok(s.has('.claude/hooks/board-guard.js'), `같은 조각의 다른 진짜 자리도 살아야 한다: ${[...s].join(', ')}`);
});

test('🚫 «뒤» 는 자리가 아니다 — 비켜났다고 적은 것은 끝까지 비켜난 것이다', () => {
  assert.ok(!자리들(거울칸).has('tools/board-move.js'), '🚫 뒤의 「안 만진다」가 점유로 셌다(F221 이 고친 방향이 되살아났다)');
});

test('🚫 조각이 통째로 부정이면 아무 자리도 안 남긴다', () => {
  assert.equal(자리들('🚫`tools/codex-review.js`=`8f854054` 선언 중이라 비켜남)').size, 0);
});

/* ── ③ 부정 낱말 — 사람이 실제로 쓰는 모양 전부 (맹점 ①) ─────────────────────── */

test('실보드에 실제로 쓰인 부정 표기가 전부 떨어진다', () => {
  const 표본 = [
    ['**talk**: `lib/학습자상태.js` · 배포 0', 'lib/학습자상태.js', null],
    ['`tests/교정API.test.js`(신설) · 서버·supabase 무변경', 'tests/교정API.test.js', null],
    ['`docs/조립후_증분.md` — 코드 무변경', 'docs/조립후_증분.md', null],
    ['`src/화면.js` · 코드 편집 없음', 'src/화면.js', null],
    ['`tools/원격배포.js` · `tests/배포.test.js` 제외', 'tools/원격배포.js', 'tests/배포.test.js'],
    ['`lib/게임.js` · `contents/토픽퀴즈문항.js` 읽기만', 'lib/게임.js', 'contents/토픽퀴즈문항.js'],
    ['`lib/게임.js` · `docs/설계.md` 안 건드림', 'lib/게임.js', 'docs/설계.md'],
    ['`lib/게임.js` · `docs/설계.md` 편집 금지', 'lib/게임.js', 'docs/설계.md'],
  ];
  for (const [칸, 살것, 죽을것] of 표본) {
    const s = 자리들(칸);   // ⚠ 자리 키는 board-guard 와 같이 **소문자**다 — 기대값도 같은 통로로 낮춘다
    assert.ok(s.has(살것.toLowerCase()), `🔴 진짜 자리가 부정 표기에 휩쓸렸다: ${칸}\n  → ${[...s].join(', ')}`);
    if (죽을것) assert.ok(!s.has(죽을것.toLowerCase()), `🔴 「안 만진다」가 점유로 읽혔다: ${칸}`);
  }
});

test('진짜 꼬리는 부정으로 안 읽는다 — `신설`·`+회귀`·`§6`·`15종`', () => {
  for (const [칸, 살것] of [
    ['`tools/보드수거.js`(신설)', 'tools/보드수거.js'],
    ['`lib/멘탈게이지.js`+회귀', 'lib/멘탈게이지.js'],
    ['`docs/발주_게임모듈.md` §6', 'docs/발주_게임모듈.md'],
    ['`tools/원격배포.js` 15종', 'tools/원격배포.js'],
    ['`tests/이해대장.test.js`(그 한 검사)·픽스처 회귀', 'tests/이해대장.test.js'],
  ]) {
    assert.ok(자리들(칸).has(살것), `🔴 멀쩡한 선언을 부정으로 읽었다 — 이쪽이 새는 방향이다: ${칸}`);
  }
});

/* 🔑 **괄호가 부정을 끊는다.** 관례는 진짜 파일들을 나열한 «뒤에» 괄호로 비켜남을 다는 것인데
 *   (`… · tools/사슬점검.js (배포 0`), 괄호를 구절 경계로 안 세면 그 줄의 마지막 진짜 파일이
 *   부정 꼬리와 한 구절이 되어 **함께 떨어진다** — 새는 쪽이고 증상이 조용하다.
 *   변이 시험이 이 자리를 잡아냈다(경계에서 괄호를 뺐더니 위 검사가 전부 초록이었다). */
test('🔴 괄호 앞의 마지막 진짜 파일이 뒤따르는 부정에 휩쓸리지 않는다', () => {
  const 칸 = '**talk**: `lib/학습자상태.js`·`tests/학습자상태.test.js`·`tools/사슬점검.js` (배포 0';
  const s = 자리들(칸);
  assert.ok(s.has('tools/사슬점검.js'),
    `🔴 괄호가 부정을 못 끊어 마지막 선언이 함께 떨어졌다 — 그 파일은 어느 가드에도 안 보인다: ${[...s].join(', ')}`);
  assert.ok(s.has('lib/학습자상태.js'), `앞쪽 선언도 살아야 한다: ${[...s].join(', ')}`);
});

/* 🔑 **일부러 안 뗀 축을 못박는다.** 같은 낱말이 접두·꼬리 두 모양으로 쓰이고
 *   (`…(화면 파일은 읽기만)` 은 «앞» 경로를 부정하지 **않는다**), 사정거리를 지어내면
 *   진짜 자리를 놓친다 = 새는 쪽. 넓히려는 다음 사람은 이 검사와 먼저 대화해야 한다. */
test('접두형 「읽기만: <경로>」는 **일부러** 안 뗀다 — 좁게 틀리면 막히고, 막히는 것은 보인다', () => {
  assert.ok(자리들('**읽기만: `docs/제품방향.md`**').has('docs/제품방향.md'),
    '접두형까지 떼기 시작하면 `…(화면 파일은 읽기만)` 같은 줄에서 진짜 자리를 놓친다');
  assert.ok(자리들('fixtures/깨진화면.js} 신설**(화면 파일은 읽기만)').has('fixtures/깨진화면.js'),
    '괄호 안 「읽기만」이 그 앞의 진짜 신설 선언을 부정하면 안 된다');
});

/* ── ④ 소비자 둘이 **같은** 판정을 쓴다 (맹점 ④) ───────────────────────────── */

const 임시들 = [];
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 진행 */ } } });

const 나 = { CLAUDE_CODE_HOST_SESSION_ID: 'local_3fd8f6db-8bee-47b1-a3d1-b156f732f5e9' };
const 머리 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'].join('\n');
const 남의줄 = '| 2026-08-12 | **배포 트랙** | 검수 장부·clasp push(v9.215)·`tests/board-guard.test.js`**(🚫`tools/board-move.js`=`local_11111111`) | 🔵**착수**(`local_82404266`) |';
const 내줄 = (파일) => `| 2026-08-12 | **다른 트랙** | ${파일} | 🔵**착수**(\`local_3fd8f6db\`) |`;

function 보드픽스처() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-부정-'));
  임시들.push(dir);
  const p = path.join(dir, 'docs', '_ops', '보드', 'bbbb2222.md');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${머리}\n${남의줄}\n`, 'utf8');
  return p;
}
function 판정(보드파일, 파일칸) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 보드파일, old_string: 남의줄, new_string: `${남의줄}\n${내줄(파일칸)}` } }),
    encoding: 'utf8',
    env: { ...process.env, ...나 },
  });
  if (!out.trim()) return { 결정: 'allow', 사유: '' };
  const h = JSON.parse(out).hookSpecificOutput || {};
  return { 결정: h.permissionDecision || 'allow', 사유: String(h.permissionDecisionReason || '') };
}

test('🔴 [board-guard] `clasp push 0` 선언은 배포 트랙과 겹침으로 막히지 않는다', () => {
  const r = 판정(보드픽스처(), '`tools/전혀다른.js` · 이 줄 (clasp push 0 · talk 0 · 운영 DB 0)');
  assert.notEqual(r.결정, 'deny',
    `🔴 따를 수 없는 처방이다 — 실제로 안 겹치는데 비켜나라고 한다:\n${r.사유.slice(0, 300)}`);
});

test('[board-guard] 진짜 `clasp push` 는 여전히 막는다 — 두 배포 트랙은 되돌릴 수 없다', () => {
  const r = 판정(보드픽스처(), '`tools/전혀다른.js`·clasp push(v9.216)');
  assert.equal(r.결정, 'deny', '🔴 부정을 떼며 공유자원 축의 힘까지 뺐다');
  assert.match(r.사유, /clasp/i, '무엇이 겹쳤는지 안 말하면 비켜날 자리를 못 고른다');
});

test('🔴 [board-guard·거울면] 🚫 앞의 진짜 선언과 겹치면 이제 막는다 — 전엔 조용히 통과했다', () => {
  const r = 판정(보드픽스처(), '`tests/board-guard.test.js`');
  assert.equal(r.결정, 'deny',
    '🔴 남이 선언한 파일인데 🚫 가 같은 조각에 붙었다는 이유로 안 보였다 — 새는 방향이라 아무도 안 운다');
});

test('[board-guard] 남이 🚫 로 비켜난 파일은 내가 잡아도 안 막힌다', () => {
  const r = 판정(보드픽스처(), '`tools/board-move.js`');
  assert.notEqual(r.결정, 'deny', '🔴 남이 「안 만진다」고 적은 자리를 점유로 셌다(F221 재발)');
});

test('🔴 [track-collision] 판정 정본이 하나다 — 두 훅이 같은 칸을 같은 뜻으로 읽는다', () => {
  const 소스 = fs.readFileSync(TRACKHOOK, 'utf8');
  assert.match(소스, /만지는텍스트\(내줄\.파일칸\)/,
    '🔴 track-collision 이 파일 칸을 날것으로 훑는다 — 「안 만진다」고 적은 파일까지 내 자리로 세고, board-guard 와 갈라진 채 초록이 된다');
});

/* ── ⑤ 실저장소 — **거짓양성만** 검사한다 (맹점 ②) ──────────────────────────── */

function 실보드칸들() {
  const 파일들 = [path.join(REPO, 'docs', '세션보드_아카이브.md')];
  const d = 보드.폴더(REPO);
  if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.endsWith('.md')) 파일들.push(path.join(d, f));
  const 칸들 = [];
  for (const f of 파일들) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!보드.데이터행(l)) continue;
      const 칸 = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
      if (칸.length >= 3) 칸들.push({ f: path.basename(f), 칸: 칸[2] || '' });
    }
  }
  return 칸들;
}

test('🔴 [실저장소] 없던 자리를 만들지 않는다 — 구절을 다시 잇다가 새 경로가 태어나면 그게 거짓 차단이다', () => {
  const 칸들 = 실보드칸들();
  assert.ok(칸들.length > 50, `실보드 표본이 너무 적다 — 몇 건이 돌았는지부터 밝힌다: ${칸들.length}칸(미실행과 통과가 같은 모양이 된다)`);
  for (const { f, 칸 } of 칸들) {
    const 원본 = 자리(칸);
    for (const k of 자리들(칸)) {
      assert.ok(원본.has(k), `🔴 [${f}] 원본에 없던 자리 «${k}» 가 생겼다 — 조립이 경로를 지어냈다:\n  ${칸.slice(0, 160)}`);
    }
  }
});

test('[실저장소] 부정 구절이 결과에 안 남는다 — 남으면 그게 곧 다음 거짓 차단이다', () => {
  for (const { f, 칸 } of 실보드칸들()) {
    const 남은 = 만지는텍스트(칸);
    assert.ok(!/🚫/.test(남은), `🔴 [${f}] 금지 표식이 결과에 살아남았다 — 그 뒤 텍스트도 함께 남았다는 뜻이다:\n  ${남은.slice(0, 160)}`);
    assert.ok(!/(?:^|[\s:=])(?:clasp\s*push)\s+0\b/i.test(남은), `🔴 [${f}] 「clasp push 0」 이 그대로 남았다:\n  ${남은.slice(0, 160)}`);
  }
});
