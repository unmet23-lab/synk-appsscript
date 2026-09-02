/* 지면얹기 «자» 회귀 — 「얹힌 CSS 가 낡았다」가 **줄끝 표기로 켜지면 안 된다**.
 *
 * ■ 무엇을 지키나 (실사고 2026-09-03 · 새 워크트리에서 재현)
 *   `node tools/지면얹기.js` 가 등록 12벌 중 **8벌**을 「얹힌 CSS 가 낡았다」로 내고 exit 1 했다.
 *   그런데 그 여덟은 내용이 한 글자도 안 낡았다 — `git diff` 가 **0줄**이었다.
 *   원인은 지면이 아니라 **자**였다. 이 저장소는 `core.autocrlf=true` 로 체크아웃되므로
 *   커밋된 지면(인덱스는 늘 LF)이 윈도 작업본에 **통째로 CRLF 로** 내려온다 — 우리가 얹은
 *   블록까지 함께. 생성기는 늘 LF 로 블록을 짓는다. 바이트로 견주면 **줄마다 `\r` 한 개씩**
 *   어긋나고, 멀쩡한 지면이 전부 적색이 된다.
 *
 * 🔑 **초록이던 넷도 내용 때문이 아니었다.** 그 넷엔 «외톨이 `\r`» 이 하나씩 남아 있어(09-01 에
 *   고친 고아 `\r` 버그의 화석) git 이 텍스트로 안 보고 줄끝을 안 건드렸을 뿐이다.
 *   ⇒ **넷은 고장나서 초록이었고 여덟은 멀쩡해서 빨갰다.** 그래서 실물 상태를 재는 검사로는
 *      이 병을 못 세운다 — 자를 픽스처로 직접 물어야 한다.
 *
 * 🔴 왜 하드 게이트에서 특히 나쁜가: 주인 없는 적색은 **남의 배포를 막는다**. 그리고 처방
 *   (`--적용`)을 따르면 8벌이 통째로 LF 로 덮여 큰 가짜 diff 가 나고, `tools/크루카드사본.js`
 *   가 강제하는 네 벌 바이트 동일성이 그 자리에서 깨진다 — **따를 수 없는 처방**(F103).
 *
 * ⚠ 이 검사가 틀릴 때의 모습 = **접기가 뜻을 먹는 것**. 줄끝을 접다가 진짜 낡음까지 못 보면
 *   그건 적색이 아니라 **영원한 초록**이라 아무도 안 운다. 그래서 ②·③ 이 탐지력을 진다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 얹 = require(path.join(루트, 'tools', 'lib', 'loom얹기.js'));
const { 표기접기, 코드만 } = require(path.join(루트, 'tests', 'lib', '소스검사.js'));

const 프리셋 = '밝은부품';

/** 체크아웃이 하는 일 그대로 — 파일 전체를 CRLF 로 편다(줄끝 축을 «한 번만» 뒤집는다). */
const CRLF로 = (s) => s.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const LF로 = (s) => s.replace(/\r\n/g, '\n');

/** 훅이 «실제로» 닿는 손 HTML 하나. 훅 0 이면 얹기가 애초에 안 돌아 이 파일이 통째로 헛돈다. */
const 원고 = [
  '<html><head><meta charset="utf-8">',
  '<style>body{background:#FAFAF9}</style>',
  '</head><body>',
  '<p><span class="칩">시범</span></p>',
  '</body></html>',
].join('\n');

const 최신판 = (() => {
  const r = 얹.얹기(원고, { 지면: 프리셋 });
  assert.ok(r.얹힘, `픽스처에 훅이 0 이다 — 이 파일의 모든 검사가 미실행이 된다 (${r.사유})`);
  return r.html;
})();

/* ── ① 급소 — 체크아웃이 CRLF 로 준 판을 「낡았다」로 읽지 않는다 ──────────── */

test('🔴 CRLF 로 체크아웃된 최신 지면은 «낡음»이 아니다 — 09-03 에 8벌을 적색으로 만든 자리', () => {
  const 체크아웃판 = CRLF로(최신판);
  assert.notEqual(체크아웃판, 최신판, '픽스처가 LF 그대로다 — 이 검사는 아무것도 증명하지 못한다');

  const r = 얹.얹기(체크아웃판, { 지면: 프리셋 });
  assert.ok(r.얹힘, 'CRLF 판에서 훅이 사라졌다 — 뜯기가 줄끝에 걸렸다');
  assert.equal(
    r.같나, true,
    '줄끝만 CRLF 인 최신 지면을 「낡았다」로 읽는다 — 이것이 09-03 의 주인 없는 적색이다'
    + ` (디스크 ${체크아웃판.length}자 / 산출 ${r.html.length}자 · 접으면 `
    + `${표기접기(체크아웃판).length} vs ${표기접기(r.html).length})`
  );
});

test('LF 판도 그대로 최신이다 — 리눅스 CI 쪽 축(한쪽만 고치면 반대쪽이 샌다)', () => {
  const r = 얹.얹기(LF로(최신판), { 지면: 프리셋 });
  assert.equal(r.같나, true, 'LF 판이 낡음으로 뒤집혔다');
});

/* ── ② 탐지력 — 진짜 낡은 블록은 CRLF 판에서도 문다 ──────────────────────── */

test('🔴 얹힌 CSS 가 진짜 낡으면 CRLF 판에서도 문다 — 접기가 뜻을 먹으면 영원한 초록이 된다', () => {
  assert.ok(최신판.includes('.칩{'), '픽스처가 겨냥한 선택자가 산출에 없다 — 아래 변이가 무효다');
  const 병든 = CRLF로(최신판).replace('.칩{', '.칩{outline:9px solid red;');
  assert.notEqual(병든, CRLF로(최신판), '변이가 아무것도 안 바꿨다 — 이 검사는 자기 자신만 증명한다');

  const r = 얹.얹기(병든, { 지면: 프리셋 });
  assert.equal(r.같나, false, '옛 세대 CSS 를 든 지면을 「최신」으로 읽는다');
});

test('🔴 블록이 통째로 없으면 문다 — 「아직 안 입었다」가 초록으로 새면 안 된다', () => {
  const 벗은판 = CRLF로(얹.뜯기(최신판));
  const r = 얹.얹기(벗은판, { 지면: 프리셋 });
  assert.equal(r.같나, false, 'Loom 이 하나도 안 얹힌 지면을 「최신」으로 읽는다');
});

/* ── ③ 접는 축은 «둘»이다 — 한쪽만 막으면 나머지가 그대로 샌다(#Q101) ────── */

test('줄끝 공백 축도 접는다 — CRLF 만 접으면 반쪽이다', () => {
  const 공백판 = 최신판.replace(/\n/g, ' \n');
  assert.notEqual(공백판, 최신판, '픽스처가 원본과 같다');
  assert.equal(
    얹.얹기(공백판, { 지면: 프리셋 }).같나, true,
    '줄 끝 공백 한 칸에 「낡음」이 켜진다 — 08-17 에 표식 절단 5건을 낸 것과 같은 축이다'
  );
});

test('자는 하나다 — `최신` 이 그 자를 그대로 쓴다', () => {
  assert.equal(얹.최신('a;\r\nb;\r\n', 'a;\nb;\n'), true, 'CRLF 축이 안 접힌다');
  assert.equal(얹.최신('a; \nb;\t\n', 'a;\nb;\n'), true, '줄끝 공백 축이 안 접힌다');
  assert.equal(얹.최신('  var a  =  1;\n', 'var a = 1;\n'), false, '줄 «가운데» 공백까지 먹는다 — 뜻이 사라진다');
});

/* ── ④ 실물 왕복 — 픽스처가 실물과 안 닮으면 위 셋이 저 혼자만 초록이다 ──── */

test('실물 지면도 줄끝을 뒤집으면 판정이 흔들리지 않는다', () => {
  const 실물 = path.join(루트, 'docs', '엔진', 'SYNK_엔진_지도.html');
  assert.ok(fs.existsSync(실물), `실물 지면이 없다: ${path.relative(루트, 실물)} — 옮겼으면 이 칸을 고쳐라`);
  const 원본 = fs.readFileSync(실물, 'utf8');

  const 판 = { CRLF: CRLF로(원본), LF: LF로(원본) };
  assert.notEqual(판.CRLF, 판.LF, '이 지면엔 줄끝이 하나도 없다 — 왕복이 아무것도 안 잰다');

  const a = 얹.얹기(판.CRLF, { 지면: 프리셋 });
  const b = 얹.얹기(판.LF, { 지면: 프리셋 });
  assert.equal(
    a.같나, b.같나,
    `같은 내용이 줄끝 표기에 따라 다른 판정을 받는다 (CRLF ${a.같나} / LF ${b.같나})`
  );
  assert.equal(a.훅.length, b.훅.length, '훅 수가 줄끝에 흔들린다 — 뜯기가 표기에 걸렸다');
});

/* ── ⑤ 이 수리가 새는 유일한 방향 — 호출부가 «자를 다시 만드는» 것 ──────── */

test('🔴 호출부가 `=== 원본` 으로 다시 견주지 않는다 — 자가 둘이 되면 그 순간 되돌아온다', () => {
  const 자리들 = ['tools/지면얹기.js', 'tools/lib/loom얹기.js'];
  const 날대조 = /(?:===|!==)\s*원본|원본\s*(?:===|!==)/;
  for (const rel of 자리들) {
    const 코드 = 코드만(fs.readFileSync(path.join(루트, rel), 'utf8'));   // 주석은 자가 아니다
    assert.ok(
      !날대조.test(코드),
      `${rel} 이 «원본»을 날바이트로 견준다 — 판정은 \`얹기\` 가 내는 \`같나\` 하나여야 한다`
      + ' (자가 둘이면 갈리고, 갈린 쪽이 내는 것은 주인 없는 적색이다)'
    );
  }
  assert.equal(자리들.length, 2, '분모 — 자를 읽는 호출부가 늘었으면 여기 적어라');
});
