#!/usr/bin/env node
/* 주석통로계수 — 이 저장소에서 **주석을 스스로 지우는(걸러내는) 자리**를 전량 센다.
 *
 * ■ 왜 생겼나 (대기열 #Q114 가 「별건」으로 남긴 as 몫 · F401→F602 계열)
 *   주석 제거의 **통로는 하나**여야 한다(`tests/lib/소스검사.js` 의 `코드만`·`줄맞춰코드만`).
 *   사본이 생기면 저마다 다르게 틀리고 — 줄머리 `//` 만 지우거나, `[^:]` 로 `https://` 만
 *   지키거나, 문자열과 주석을 한 정규식으로 처리해 **순서에 기대거나** — 갈라진 쪽의 증상은
 *   언제나 「통과」다. 검사가 설명을 코드로 읽어 **영원히 초록**이 된다.
 *
 *   talk 저장소는 그 사본 수를 `tools/가드계수.js` 로 잰다. 그런데 그 계수기는 `acorn` 을 쓰고
 *   **as 엔 `package.json` 도 `node_modules` 도 없다**(실측 2026-08-18: 둘 다 없음). 그래서
 *   `tests/소스검사통로.test.js` 는 머리말에 「as 의 사본 수는 이 파일이 못 지킨다 · 사람이
 *   형제 저장소 명령으로 잰다」고 **못 재는 것을 못 잰다고** 적어 뒀다(F207 을 지킨 것이다).
 *   👉 이 도구가 그 조항을 닫는다. **재는 자리가 없으면 「빚 0」이 아니라 「안 재봤다」다.**
 *
 * ■ 🔑 왜 파서가 필요 없나 — 재는 층이 다르다
 *   talk 의 `존재위험` 은 「소스를 검사 대상으로 삼는 **단언 자리**」를 센다. 어느 변수가 소스를
 *   들었는지 따라가야 하니 데이터흐름이 필요하고, 그래서 파서가 든다.
 *   여기서 세는 것은 「**주석 문법을 겨눈 정규식 리터럴**」이다. 처방이 곧 그 리터럴 한 개라
 *   (`s.replace(/\/\*[\s\S]*?\*\//g,'')` → `코드만(s)`) 흐름을 따라갈 이유가 없다.
 *   ⚠ 그러므로 **이 숫자를 talk 의 `존재위험` 과 대조하지 않는다.** 두 축은 다른 것을 센다.
 *
 * ■ ⚠ 대가 — 틀릴 때의 «모습»을 적어 둔다 (CLAUDE.md 신뢰성 ④)
 *   ㉠ **정규식 리터럴이 아닌 제거기는 못 본다** — 문자열을 이어붙여 `new RegExp` 로 짓거나
 *      `indexOf('/*')` 로 손수 자르는 판. 새는 방향은 「0건」이라 조용하다. 그래서 아래
 *      `쓸모없앰` 이 아니라 **명단 래칫**이 진짜 방어다(모르는 것이 늘면 파일 수가 는다).
 *   ㉡ **면제가 넓어지면 진짜 사본이 조용히 빠진다.** 그래서 면제는 «파일 이름»이 아니라
 *      **정규식의 모양**으로만 판정하고(마커·URL), 그 경계는 픽스처가 값으로 못박는다
 *      (`tests/소스검사통로.test.js` ⑥ — 되돌리면 그 픽스처가 빨개진다).
 *   ㉢ 이 도구는 **주석을 지우지 않는다** — 대상 파일의 주석은 통로(`줄맞춰코드만`)로 눕힌 뒤 훑는다.
 *      즉 자기 머리말의 `/\/\*[\s\S]*?\*\//` 같은 예시에 스스로 눈이 멀지 않는다(실측으로
 *      확인: 이 파일 자신이 명단에 안 오른다).
 *   👉 **닫는 것 1개**: `tests/소스검사통로.test.js` 머리말의 「as 의 사본 수는 이 파일이
 *      못 지킨다 · 사람이 잰다」 — 이 도구가 서면서 그 조항이 거짓이 되므로 같은 커밋에서 고친다.
 *
 * 사용:
 *   node tools/주석통로계수.js            사람이 읽는 표(파일별 건수 + 자리)
 *   node tools/주석통로계수.js --json     기계용
 *   node tools/주석통로계수.js --뿌리 <경로>   다른 저장소를 잰다(계수기는 하나면 된다)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_기본 = path.join(__dirname, '..');
const { 줄맞춰코드만, 파일소스 } = require(path.join(ROOT_기본, 'tests', 'lib', '소스검사.js'));
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

/* 훑지 않는 곳 — 이름을 대고 뺀다(말없이 좁히면 「0건」이 실은 「안 봤다」가 된다).
 * `vendor` 는 남의 코드다: 여기 통로를 요구할 수 없고, 고치면 다음 갱신에 지워진다. */
const 안봄 = [
  { 조각: `${path.sep}.git${path.sep}`, 왜: 'git 내부' },
  { 조각: `${path.sep}node_modules${path.sep}`, 왜: '의존 패키지' },
  { 조각: `${path.sep}vendor${path.sep}`, 왜: '남의 코드 — 통로를 요구할 수 없다' },
  { 조각: `${path.sep}docs${path.sep}_archive${path.sep}`, 왜: '아카이브 — 안 도는 코드' },
];

function 훑기(뿌리) {
  const 나온것 = [];
  (function 걷기(d) {
    let 항목;
    try { 항목 = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of 항목) {
      const p = path.join(d, e.name);
      if (안봄.some((x) => (p + path.sep).includes(x.조각))) continue;
      if (e.isDirectory()) { 걷기(p); continue; }
      if (/\.(?:js|cjs|mjs)$/u.test(e.name)) 나온것.push(p);
    }
  }(뿌리));
  return 나온것.sort();
}

/* ── 정규식 리터럴 걷개 ──────────────────────────────────────────────────────
 * 🔑 이것은 «주석 제거기»가 아니다 — 그러니 통로의 사본이 아니다. 하는 일이 반대다:
 *   `코드만` 은 정규식을 **살려 두고 주석을 버린다**. 여기는 그렇게 주석이 지워진 글에서
 *   **정규식만 걷는다.** 그래서 문자열을 건너뛰는 부분만 겹치는데, 그건 「무엇이 주석인가」가
 *   아니라 「무엇이 리터럴인가」라서 갈라져도 이 도구의 판정만 좁아진다(위 대가 ㉠).
 */
const 정규식앞 = /[([{,;:=!&|?+\-*%~^<>]$|\b(?:return|typeof|case|in|of|new|delete|void|instanceof)$/u;

function 리터럴끝(s, i, 따옴표) {
  let j = i + 1;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === 따옴표) return j + 1;
    if (따옴표 !== '`' && s[j] === '\n') return j;
    j += 1;
  }
  return s.length;
}

function 정규식끝(s, i) {
  let j = i + 1;
  let 대괄호 = false;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '\n') return -1;
    if (대괄호) { if (c === ']') 대괄호 = false; } else if (c === '[') 대괄호 = true;
    else if (c === '/') return j;
    j += 1;
  }
  return -1;
}

/** 주석이 지워진 코드에서 정규식 리터럴을 걷는다 → `[{ 몸통, 줄 }]` (몸통 = 슬래시·플래그 뺀 것). */
function 정규식들(코드) {
  const s = String(코드);
  const 나온것 = [];
  let 앞 = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { const 끝 = 리터럴끝(s, i, c); 앞 += s.slice(i, 끝); i = 끝; continue; }
    if (c === '/' && 정규식앞.test(앞.replace(/\s+$/u, ''))) {
      const 끝 = 정규식끝(s, i);
      if (끝 !== -1) {
        나온것.push({ 몸통: s.slice(i + 1, 끝), 줄: s.slice(0, i).split('\n').length });
        앞 += s.slice(i, 끝 + 1);
        i = 끝 + 1;
        continue;
      }
    }
    앞 += c;
    i += 1;
  }
  return 나온것;
}

/* ── 「주석 문법을 겨눴는가」 판정 ────────────────────────────────────────────
 * 세 모양뿐이고, 그 셋이 실측한 사본 전부를 덮는다(2026-08-18 전수).
 *   ㉠ 블록제거형 — `\/\*` 와 `\*\/` 사이가 **임의 본문**이다 (`/\/\*[\s\S]*?\*\//`)
 *   ㉡ 줄머리형   — `^\s*` 앵커 + `\/\/` (`/^\s*(\/\/|\*|\/\*)/` — 주석 «줄»을 걸러낸다)
 *   ㉢ 줄꼬리형   — `\/\/` 뒤가 **줄 끝까지** (몸통 `\/\/[^\n]*` · `(^|\s)\/\/.*$`)
 *
 * 🔑 면제는 «모양»이다 — 파일 이름으로 빼지 않는다(위 대가 ㉡):
 *   · `\/\*loom부품:([^*]+)\*\/` — 사이가 임의 본문이 아니라 **식별자**다 ⇒ 마커지 제거기가 아니다
 *   · `https?:\/\/[^\s]+` · `(^|\/\/|\.)instagram\.com` — `\/\/` 뒤가 줄 끝이 아니다 ⇒ 주소다
 */
const 임의본문 = /^(?:\[(?:\\.|[^\]])*\]|\.|\\[sSwWdD])(?:[*+]\??|\{\d*,?\d*\}\??)$/u;

function 겨눔(몸통) {
  const s = String(몸통);

  // ㉠ 블록제거형
  for (const m of s.matchAll(/\\\/\\\*/gu)) {
    const 뒤 = s.slice(m.index + 4);
    const 닫힘 = 뒤.indexOf('\\*\\/');
    if (닫힘 > 0 && 임의본문.test(뒤.slice(0, 닫힘))) return '블록제거형';
  }
  // ㉡ 줄머리형 — 주석 «줄» 걸러내기
  if (s.includes('^\\s*') && s.includes('\\/\\/')) return '줄머리형';
  // ㉢ 줄꼬리형
  for (const m of s.matchAll(/\\\/\\\//gu)) {
    const 뒤 = s.slice(m.index + 4);
    if (/^(?:\[\^\\n\]|\.)(?:[*+]\??)(?:\$)?/u.test(뒤)) return '줄꼬리형';
  }
  return null;
}

/** 저장소 하나를 잰다 → `{ 뿌리, 자리[], 파일별{} }`. */
function 재기(뿌리) {
  const 자리 = [];
  for (const f of 훑기(뿌리)) {
    let 원문;
    try { 원문 = 파일소스(f); } catch (_) { continue; }
    /* 🔑 `코드만` 이 아니라 `줄맞춰코드만` 이다 — 앞은 주석«만» 있던 줄을 버려서 행 번호가 밀린다.
     *   사람이 그 줄로 찾아가야 하므로 여기는 행 번호가 뜻이다(통로가 이름 둘로 나뉜 이유). */
    const 코드 = 줄맞춰코드만(원문);
    const 줄들 = String(원문).split('\n');
    for (const r of 정규식들(코드)) {
      const 종류 = 겨눔(r.몸통);
      if (!종류) continue;
      자리.push({
        파일: path.relative(뿌리, f).split(path.sep).join('/'),
        줄: r.줄,
        종류,
        글: (줄들[r.줄 - 1] || '').trim().slice(0, 120),
      });
    }
  }
  const 파일별 = {};
  for (const a of 자리) 파일별[a.파일] = (파일별[a.파일] || 0) + 1;
  return { 뿌리, 자리, 파일별 };
}

module.exports = { 재기, 정규식들, 겨눔, 훑기, 안봄 };

/* ── CLI ───────────────────────────────────────────────────────────────────── */
if (require.main === module) {
  /* 모르는 낱말은 조용히 안 삼킨다 — 판정은 공용 하나다(`tools/lib/인자게이트.js` · F400 계열).
   * 🔑 목록은 여기서 «선언»한다: `tests/도구인자게이트.test.js` ④ 가 이 도구의 자기 낱말
   *   전량을 이 선언이 덮는지 매번 다시 센다(손 목록이 낡는 자리를 안 남긴다). */
  const 아는플래그 = ['--json', '--뿌리'];
  const 인자 = process.argv.slice(2);
  const 플래그오류 = 인자게이트('주석통로계수', 인자, 아는플래그);
  if (플래그오류) { console.error(플래그오류); process.exit(2); }

  const i뿌리 = 인자.indexOf('--뿌리');
  if (i뿌리 !== -1 && !인자[i뿌리 + 1]) { console.error('[주석통로계수] `--뿌리` 뒤에 경로가 없다'); process.exit(2); }

  const 뿌리 = i뿌리 === -1 ? ROOT_기본 : path.resolve(인자[i뿌리 + 1]);
  const 결과 = 재기(뿌리);

  if (인자.includes('--json')) { console.log(JSON.stringify(결과, null, 2)); process.exit(0); }

  const 순 = Object.entries(결과.파일별).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  console.log(`[주석통로계수] 주석 문법을 겨눈 정규식 ${결과.자리.length}자리 · ${순.length}파일  (뿌리: ${뿌리})`);
  console.log('  ⚠ 이 숫자는 talk 의 `존재위험` 과 «다른 축»이다 — 대조하지 않는다(머리말 🔑).');
  for (const [f, n] of 순) {
    console.log(`\n■ ${f}  (${n})`);
    for (const a of 결과.자리.filter((x) => x.파일 === f)) console.log(`   ${a.줄}  [${a.종류}] ${a.글}`);
  }
}
