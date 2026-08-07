/* chat-glyph-guard 회귀 — 채팅 층 옛 글자 검문 (F167)
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

test('[단일 출처] 옛글자 클래스가 파일 층(문서문자.test.js)과 같은 값이다', () => {
  const 뽑기 = (src, 이름) => {
    const m = src.match(/new RegExp\('(\[[^']+\])'/);
    assert.ok(m, `${이름} 에서 옛글자 클래스를 못 찾았다 — 정의가 사라졌거나 모양이 바뀌었다`);
    return m[1];
  };
  const 훅클래스 = 뽑기(fs.readFileSync(HOOK, 'utf8'), '훅');
  const 파일층클래스 = 뽑기(fs.readFileSync(path.join(__dirname, '문서문자.test.js'), 'utf8'), '문서문자.test.js');
  assert.strictEqual(훅클래스, 파일층클래스, '두 층의 옛글자 정의가 갈라졌다 — 한쪽만 넓히면 다른 층이 사각이 된다');
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
