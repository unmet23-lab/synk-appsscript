/* chat-glyph-guard 회귀 — 채팅 층 검문 두 규칙 (① 옛 글자 F167 · ② 표 칸수 F119)
 *
 * 두 규칙은 축이 같다(「이번 턴 내 산문」) — 아래 ①~④ 의 턴 경계·루프·등록층 성질은 둘 다 지킨다.
 * ②(표 칸수)의 고유 성질은 ⑤ 에 모았다.
 *
 * 지키려는 성질:
 *   ① 이번 턴 내 발화의 옛 글자(한자·가나)는 턴이 끝나기 전에 잡힌다 — **턴 중간 텍스트 포함**
 *      (F167 의 실제 모양이 턴 중간의 보고 표였다).
 *   ② 축은 「유호님께 보이는 내 산문」뿐이다 — thinking·tool_result·지난 턴은 잡지 않는다
 *      (지난 턴을 잡으면 이미 화면에 닿은 글에 영원히 막힌다 · 도구 결과 속 글자는 관측이지 위반이 아니다).
 *   ③ stop_hook_active 면 통과 — 되돌린 턴을 또 막으면 처방을 따를 수 없다(F103).
 *   ④ 옛글자 정의는 파일 층(tests/문서문자.test.js)과 한 값이다 — 사본이 갈라지면 여기서 빨개진다.
 *
 * ⚠ 이 파일에 그 글자를 **적지 않는다** — 문서문자 스캔이 이 파일을 잡는다. 픽스처는 전부
 *   String.fromCodePoint 로 만든다(문서문자.test.js 와 같은 규율).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
/* 부정 단언의 주어만 정제한다 — 주석이 금지 패턴을 «설명»하면 그 설명이 위반으로 잡힌다(대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');
const path = require('node:path');
const { 훅띄우기 } = require('./lib/훅띄우기');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'chat-glyph-guard.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'chatglyph-'));

const 한자 = String.fromCodePoint(0x6703);   // 통합 한자 한 자
const 가나 = String.fromCodePoint(0x3042);   // 히라가나 한 자

// ── 대화록 항목 빌더 — 실측한 JSONL 모양 그대로 (2026-08-07 이 저장소 트랜스크립트) ──
const 어시 = (...블록) => ({ type: 'assistant', message: { role: 'assistant', content: 블록 } });
const 텍스트 = (t) => ({ type: 'text', text: t });
const 생각 = (t) => ({ type: 'thinking', thinking: t });
const 유저 = (s) => ({ type: 'user', message: { role: 'user', content: s } }); // 실제 입력은 문자열 content
const 도구결과 = (t) => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: [{ type: 'text', text: t }] }] },
});
const 메타유저 = (t) => ({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text: t }] } });

let n = 0;
function 결정(항목들, 입력추가 = {}) {
  const tp = path.join(TMP, `t${n++}.jsonl`);
  fs.writeFileSync(tp, 항목들.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({ transcript_path: tp, session_id: 'sess-T', ...입력추가 }),
    encoding: 'utf8',
  });
  const out = String(r.stdout || '').trim();
  if (!out) return { 결정: 'allow', 사유: '' };
  const j = JSON.parse(out);
  return { 결정: j.decision, 사유: String(j.reason || '') };
}

// ── ① 탐지 ──────────────────────────────────────────────────────────────────

test('🔴 마지막 발화의 한자를 잡는다', () => {
  const r = 결정([유저('질문'), 어시(텍스트(`보고: ${한자} 포함`))]);
  assert.strictEqual(r.결정, 'block');
  assert.match(r.사유, /U\+6703/, '어느 글자인지 U+ 코드로 짚어야 사람이 찾는다');
  assert.match(r.사유, /F167/, '왜 막는지의 주소가 없다');
});

test('가나도 같은 무게로 잡는다', () => {
  assert.strictEqual(결정([유저('질문'), 어시(텍스트(`히라가나 ${가나}`))]).결정, 'block');
});

test('🔴 턴 중간 텍스트의 한자도 잡는다 — F167 의 실제 모양(중간 보고 표·마지막은 깨끗)', () => {
  const r = 결정([
    유저('감사 보고해줘'),
    어시(텍스트(`| 항목 | ${한자}${한자} |`)),   // 턴 중간의 표
    도구결과('도구 응답'),
    어시(텍스트('요약: 세 건을 정리했다')),      // 마지막 발화는 깨끗
  ]);
  assert.strictEqual(r.결정, 'block', 'tool_result 캐리어를 턴 경계로 읽으면 이 자리가 통째로 사각이다');
});

test('isMeta 유저 항목은 턴 경계가 아니다 — 주입 문구 앞의 내 발화도 이번 턴이다', () => {
  const r = 결정([유저('질문'), 어시(텍스트(`${한자}`)), 메타유저('system-reminder 주입')]);
  assert.strictEqual(r.결정, 'block');
});

// ── ② 축 밖은 잡지 않는다 (거짓양성 = 곧 꺼지는 가드) ───────────────────────

test('한글·영어·키릴·킷 특수문자·이모지는 통과한다', () => {
  const r = 결정([유저('질문'), 어시(텍스트('한글 English Монгол ө ₮ № — 🔴✅ (F167)'))]);
  assert.strictEqual(r.결정, 'allow', '세 언어 밖을 잡았다 — 확정 「한글·몽골어·영어」가 전부 통과해야 한다');
});

test('🔑 지난 턴의 한자는 잡지 않는다 — 이미 화면에 닿은 글에 영원히 막히면 안 된다', () => {
  const r = 결정([
    유저('첫 질문'),
    어시(텍스트(`옛 보고 ${한자}`)),  // 지난 턴(그 턴의 Stop 몫이었다)
    유저('다음 질문'),
    어시(텍스트('이번 턴은 깨끗하다')),
  ]);
  assert.strictEqual(r.결정, 'allow');
});

test('🔑 도구 결과 속 한자는 위반이 아니다 — 관측 대상이지 내 산문이 아니다', () => {
  const r = 결정([유저('파일 봐줘'), 도구결과(`파일 내용 ${한자}${가나}`), 어시(텍스트('세 글자를 확인했다'))]);
  assert.strictEqual(r.결정, 'allow');
});

test('thinking 블록은 잡지 않는다 — 검사 축은 유호님께 보이는 text 뿐', () => {
  const r = 결정([유저('질문'), 어시(생각(`${한자} 고민`), 텍스트('깨끗한 답'))]);
  assert.strictEqual(r.결정, 'allow');
});

test('메시지 아닌 항목(큐·첨부·요약)은 걸림돌이 아니다', () => {
  const r = 결정([유저('질문'), 어시(텍스트('깨끗')), { type: 'queue-operation' }, { type: 'last-prompt' }]);
  assert.strictEqual(r.결정, 'allow');
});

// ── ③ 루프·불가 상황 ─────────────────────────────────────────────────────────

test('🔑 stop_hook_active 면 위반이 있어도 통과 — 되돌린 턴을 또 막으면 루프다(F103)', () => {
  const r = 결정([유저('질문'), 어시(텍스트(`${한자}`))], { stop_hook_active: true });
  assert.strictEqual(r.결정, 'allow');
});

test('대화록이 없으면 조용히 통과 — 이 훅은 소통 가드지 안전장치가 아니다', () => {
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({ transcript_path: path.join(TMP, '없다.jsonl') }),
    encoding: 'utf8',
  });
  assert.strictEqual(String(r.stdout || '').trim(), '');
});

// ── ④ 정의 단일 출처 · 처방 · 등록층 ────────────────────────────────────────

test('[단일 출처] 옛글자 클래스를 쓰는 층이 전부 같은 정의에서 읽는다', () => {
  /* 정의는 `.claude/hooks/lib/옛글자.js` 하나에 산다 — 소비자가 늘 때마다 사본을 만들지 않고
   * 통로를 판다(CLAUDE.md 「3번째」). 지금 소비자는 넷이다:
   *   · 채팅 층(사전)     chat-glyph-guard      — 유호님께 나갈 발화를 막는다 (F298)
   *   · 쓰는 순간(사전)   board-guard           — 파일에 박히기 전을 막는다 (F298)
   *   · 커밋 층(사전)     tools/lib/옛글자.js    — 커밋에 담기기 전을 막는다 (F351·F379)
   *   · 저장소 전량(사후) tests/문서문자.test.js — 그 커밋 층 모듈을 그대로 가져다 쓴다
   * 2026-08-12 이전엔 파일 층 정의가 `문서문자.test.js` 안에 살아서, 커밋 층을 세우려면
   * 사본을 만들 수밖에 없었다 — 그 구조가 F351·F379 를 낳았다. */
  const LIB = path.join(__dirname, '..', '.claude', 'hooks', 'lib', '옛글자.js');
  const libSrc = fs.readFileSync(LIB, 'utf8');
  assert.match(libSrc, /new RegExp\('(\[[^']+\])'/, 'lib/옛글자.js 에서 옛글자 클래스를 못 찾았다 — 정의가 사라졌거나 모양이 바뀌었다');

  // 사본이 되살아나면 갈라짐이 다시 조용해진다 — 소비자는 lib 을 **가져다 써야** 한다.
  for (const [f, 이름] of [[HOOK, 'chat-glyph-guard'],
                           [path.join(__dirname, '..', '.claude', 'hooks', 'board-guard.js'), 'board-guard'],
                           [path.join(__dirname, '..', 'tools', 'lib', '옛글자.js'), 'tools/lib/옛글자.js']]) {
    const src = fs.readFileSync(f, 'utf8');
    assert.match(src, /require\([^)]*옛글자\.js['"]\s*\)\)?/, `${이름} 가 lib/옛글자.js 를 안 쓴다 — 사본이 부활했나`);
    assert.ok(!/new RegExp\('\[\\\\u30/.test(코드만(src)), `${이름} 안에 옛글자 클래스 사본이 남아 있다`);
  }

  /* 🔴 커밋 층은 `.test()` 를 쓰므로 **전역 플래그를 떼서** 물려받아야 한다 — 전역 정규식의
   *   `.test()` 는 lastIndex 를 들고 다녀 같은 입력에 번갈아 참·거짓을 낸다(글자를 하나 걸러
   *   하나씩 놓친다). 여기가 그 파생을 못박는다. */
  const 커밋층 = require('../tools/lib/옛글자.js').옛글자;
  assert.ok(!커밋층.global, '커밋 층 정규식에 g 플래그가 붙었다 — .test() 가 호출마다 답을 뒤집는다');
  const 한자 = String.fromCodePoint(0x6703);
  for (let i = 0; i < 3; i++) assert.ok(커밋층.test(한자), `${i + 1}번째 호출에서 답이 뒤집혔다`);
});

test('차단문이 따를 수 있는 처방을 담는다 — 표기만 바꾸면 통과한다는 출구 포함(F103)', () => {
  const r = 결정([유저('질문'), 어시(텍스트(`${한자}`))]);
  assert.match(r.사유, /다시 말하라/, '무엇을 하라는지가 없다');
  assert.match(r.사유, /한글 음|U\+ 코드/, '글자를 짚어야 할 때의 대체 표기가 없다');
  assert.match(r.사유, /통과한다/, '처방을 따르면 통과한다는 보장이 없으면 우회를 배운다');
});

test('실제 settings.json 의 Stop 에 훅이 등록돼 있다 — 스스로 발화하지 않는 장치는 안 돈다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
  const cmds = (s.hooks.Stop || []).flatMap((e) => (e.hooks || []).map((h) => h.command || ''));
  assert.ok(cmds.some((c) => c.includes('chat-glyph-guard.js')), 'Stop 등록이 없다 — 훅 파일만 있으면 0회 실행이다');
});

// ── ⑤ 표 칸수 (F119) ────────────────────────────────────────────────────────
//
// 탐지력은 **사고 표를 축소 재현한 픽스처**가 못박는다(실저장소를 픽스처로 쓰지 않는다).
// 실저장소 쪽은 거짓양성만 본다 — 이 가드가 꺼지는 길은 「너무 자주 운다」뿐이다.
const 펜스 = '```';

test('🔴 F119 그 표를 잡는다 — 3열 헤더·구분선에 데이터가 2열(판정 칸이 빈다)', () => {
  const r = 결정([유저('검토 피드백 정리해줘'), 어시(텍스트([
    '| # | 피드백 | 판정 |',
    '|---|---|---|',
    '| ① 출시 권한 충돌 | **채택.** 문구를 가릅니다. |',
    '| ② 표현 정리 | **부분 채택.** 그 한 구만 고칩니다. |',
  ].join('\n')))]);
  assert.strictEqual(r.결정, 'block', '유호님 화면에서 판정 열이 통째로 비는 표가 그대로 나갔다');
  assert.match(r.사유, /3열이어야 하는데 2열/, '몇 열이어야 하는지를 안 짚으면 어디를 고칠지 모른다');
  assert.match(r.사유, /F119/, '왜 막는지의 주소가 없다');
  assert.match(r.사유, /오른쪽 열이 빈다/, '모자람과 넘침은 증상이 달라 처방도 다르다');
});

test('헤더 칸수가 구분선과 달라도 잡는다 — GFM 은 그 표를 표로 렌더하지도 않는다', () => {
  const r = 결정([유저('정리'), 어시(텍스트([
    '| # | 피드백 | 판정 |',
    '|---|---|',
    '| a | b |',
  ].join('\n')))]);
  assert.strictEqual(r.결정, 'block');
  assert.match(r.사유, /2열이어야 하는데 3열/);
});

test('칸이 넘치면 그만큼 조용히 버려진다 — 같은 무게로 잡는다', () => {
  const r = 결정([유저('정리'), 어시(텍스트([
    '| 항목 | 상태 |',
    '|---|---|',
    '| 배포 | 완료 | 군더더기 |',
  ].join('\n')))]);
  assert.strictEqual(r.결정, 'block');
  assert.match(r.사유, /버려진다/);
});

test('🔑 칸수가 맞는 표는 통과한다 — 폭이 아무리 넓어도 잡지 않는다(원인은 폭이 아니었다)', () => {
  const 긴칸 = '가'.repeat(300);
  const r = 결정([유저('정리'), 어시(텍스트([
    '| 항목 | 판정 |',
    '|---|---|',
    `| 배포 | ${긴칸} |`,
  ].join('\n')))]);
  assert.strictEqual(r.결정, 'allow', '폭으로 잡으면 정상 표가 매번 막혀 가드가 꺼진다');
});

test('🔑 백틱 안의 파이프는 칸막이가 아니다 — 날 split 으로 세면 정상 표가 빨개진다', () => {
  const r = 결정([유저('명령 정리'), 어시(텍스트([
    '| 명령 | 뜻 |',
    '|---|---|',
    '| `git log --oneline | head -5` | 최근 5개 |',
  ].join('\n')))]);
  assert.strictEqual(r.결정, 'allow', 'tools/lib/표.js 통로를 안 쓰면 여기가 빨개진다');
});

test('🔑 코드펜스 안의 깨진 표는 표가 아니라 **표를 보여주는 글**이다', () => {
  const r = 결정([유저('그 결함 설명해줘'), 어시(텍스트([
    '이렇게 나갔었다:',
    펜스,
    '| # | 피드백 | 판정 |',
    '|---|---|---|',
    '| ① | 내용 |',
    펜스,
    '판정 열이 비어 보인 이유다.',
  ].join('\n')))]);
  assert.strictEqual(r.결정, 'allow', '자기 결함을 설명하지 못하는 가드는 처방을 못 준다(F103)');
});

test('🔑 구분선 없는 파이프 줄은 표가 아니다 — 산문·경로·정규식이 그렇게 생겼다', () => {
  const r = 결정([유저('질문'), 어시(텍스트([
    '| 이건 표가 아니다',
    'a | b 는 파이프를 쓴 산문이다',
    '`^(foo|bar)$` 같은 정규식도 마찬가지',
  ].join('\n')))]);
  assert.strictEqual(r.결정, 'allow');
});

test('🔑 지난 턴의 깨진 표는 잡지 않는다 — 이미 화면에 닿았다', () => {
  const 깨진표 = ['| # | 판정 |', '|---|---|---|', '| a | b |'].join('\n');
  const r = 결정([유저('첫 질문'), 어시(텍스트(깨진표)), 유저('다음 질문'), 어시(텍스트('이번 턴은 깨끗하다'))]);
  assert.strictEqual(r.결정, 'allow');
});

test('🔑 도구 결과 속 깨진 표는 위반이 아니다 — 관측 대상이지 내 산문이 아니다', () => {
  const 깨진표 = ['| # | 판정 |', '|---|---|---|', '| a | b |'].join('\n');
  const r = 결정([유저('파일 봐줘'), 도구결과(깨진표), 어시(텍스트('표 하나를 확인했다'))]);
  assert.strictEqual(r.결정, 'allow');
});

test('stop_hook_active 면 깨진 표도 통과 — 고친 표가 또 막히면 루프다(F103)', () => {
  const r = 결정([유저('정리'), 어시(텍스트(['| # | 판정 |', '|---|---|---|', '| a | b |'].join('\n')))],
    { stop_hook_active: true });
  assert.strictEqual(r.결정, 'allow');
});

test('차단문이 따를 수 있는 처방을 담는다 — 표를 버리는 출구까지(F119 원 처방)', () => {
  const r = 결정([유저('정리'), 어시(텍스트(['| # | 피드백 | 판정 |', '|---|---|---|', '| ① | 내용 |'].join('\n')))]);
  assert.match(r.사유, /똑같이/, '무엇을 맞추라는지가 없다');
  assert.match(r.사유, /목록·산문/, '칸마다 문단이 들어가는 표는 고칠 게 아니라 버릴 것이다');
});
