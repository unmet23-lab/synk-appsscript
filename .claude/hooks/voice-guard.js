#!/usr/bin/env node
// voice-guard — 학생 접점 글의 말투 위반 차단 (PreToolUse 훅)
//
// 정본 = `.claude/skills/synk-brand/SKILL.md` 「반례」 표. 이 훅은 그 표의 기계 강제다.
//
// 왜 훅인가:
//   금칙어 8개(패배·졌다·…)는 **단어 목록이라 「금칙어 0개인 위반」을 구조적으로 못 잡는다.**
//   "아직 Lv2밖에 안 됐네요"·"다른 크루는 벌써 다 냈어요"·"8주 하면 3급 나와요"에는
//   금칙어가 0개인데 전부 위반이다. 사람 눈으로 세는 검수는 단어만 세고 구문을 못 센다.
//
// ⚠ 이 훅은 「탐지력」을 실저장소로 증명하지 않는다(CLAUDE.md 가드 맹점②).
//   2026-08-06 실측상 학생 접점 파일의 위반은 0건이다 — 사람이 이미 규칙을 지키고 있다.
//   탐지력은 tests/말투가드.test.js 의 **픽스처**가 지고, 실저장소는 **거짓양성 0건**만 검사한다.
//   실저장소에서 위반을 찾도록 테스트를 쓰면 「버그가 아직 있을 것을 요구하는 회귀」가 된다.
'use strict';
const fs = require('fs');

/* 검사 대상 = 학생·학부모가 읽는 곳만. 화이트리스트인 이유:
 *   `부족`·`실패`·`못 받` 같은 낱말은 코드·테스트·문서에서 정상적으로 쓰인다.
 *   전량 검사는 거짓양성 폭발 → BYPASS 습관을 만든다. 규칙 문서 자신(skills/synk-brand)이
 *   반례 예문을 품고 있어 화이트리스트 밖에 두는 것도 이 방식이라 자동으로 해결된다. */
const 대상 = [
  /(^|\/)contents_[^/]*\.js$/,
  /(^|\/)docs\/발표물\/[^/]*\.html$/,
  /(^|\/)docs\/크루카드\/[^/]*\.html$/,
  /* 「파일 밖이라 무방비」로 접어뒀던 SNS·DM 문구의 **절반은 실제로 파일 안에 있었다**(2026-08-06 실측).
   *   · Phase 0 절차서 = 인스타·페북 아이스브레이커 4칸 + 인스턴트 답장의 **실문구 정본**이다.
   *     Business Suite 는 저장이 곧 발행이라, 여기서 안 잡으면 잡을 층이 라이브밖에 안 남는다.
   *   · synk-content = 캐러셀·클립 대본·앱 퀴즈의 **산출물**이 쌓이는 곳. 스킬이 여기에 쓰는 순간 걸린다
   *     → 「검사를 기억한다」가 「검사를 통과해야 써진다」가 된다.
   * ⚠ 규칙 문서인 `skills/synk-brand` 는 여전히 밖이다(반례 표를 품어 자기가 인질이 된다). */
  /(^|\/)docs\/DM상담_Phase0_절차서\.md$/,
  /(^|\/)\.claude\/skills\/synk-content\/.*\.md$/,
];

/* 규칙. `대신`은 처방이자 **자기 검사 재료**다 — 차단하면서 시키는 문장이 이 훅을 통과하는지
 * 테스트가 되먹여 확인한다(CLAUDE.md 가드 맹점③: 따를 수 없는 처방은 우회를 정상 통로로 만든다). */
const 규칙 = [
  { id: '결핍프레임', re: /아직[^.!?\n]{0,12}밖에/,
    왜: '결핍은 단어가 아니라 구문("아직~밖에")이 만든다',
    대신: 'Lv2 구간이에요 — 지금이 회로가 제일 굵어지는 때' },
  { id: '손실강조', re: /(연속|출석)[^.!?\n]{0,10}끊(겼|어졌|기)/,
    왜: '같은 사실을 손실 쪽에서 셌다. 재시작 쪽에서 센다',
    대신: '오늘 오면 연속 1일부터 다시 쌓여요' },
  { id: '또래비교', re: /다른 ?(크루|친구|학생|반)[^.!?\n]{0,15}(벌써|이미|다 )/,
    왜: 'S1 위반 — 비교는 "어제의 나"와만',
    대신: '이번 주 숙제, 아직 열어뒀어요' },
  { id: '재촉', re: /마감[^.!?\n]{0,4}임박|얼마 남지 ?않|서둘러|지금 놓치면|마지막 기회/,
    왜: 'Y3 위반 — 재촉은 긍정 단어로도 만들어진다',
    대신: '다음 시즌 시작일은 [날짜]예요. 천천히 보고 정하셔도 돼요' },
  { id: '기간단정', re: /\d+\s*(주|개월|달)[^.!?\n]{0,8}\d+\s*급/,
    왜: '집필 규범 §5가 기간 단정을 광고·상담에서 금지했다',
    대신: '정규 과정은 12개월 6시즌 구성이에요' },
  { id: '부정조건', re: /안 ?하면|못 받|못 하면|안 내면|안 오면/,
    왜: '얻는 쪽에서 세면 같은 사실이 초대가 된다',
    대신: '숙제를 내면 왕관이 하나 올라가요' },
  { id: '오답낙인', re: /틀렸(습니다|어요|네요|다)/,
    왜: '실수는 리프레이밍한다',
    대신: '이건 다음에 맞힐 문제예요' },
  { id: '관용구', re: /발 벗고|손에 넣|눈에 밟히|발등에 불|눈코 뜰|하늘의 별 따기/,
    왜: '한국식 관용구는 몽골어로 옮기면 뜻이 샌다',
    대신: '오늘 한 문장만 해볼까요?' },
  /* 금칙어 8종 전량. **스킬보다 좁으면 그 자체가 구멍**이라 하나도 빼지 않는다.
   * `졌다`의 lookbehind 가 핵심 — 한국어 `-어지다`의 과거형("즐거워졌다"·"지워졌다")이
   * 전부 `졌다`로 끝난다. 2026-08-06 실측에서 거짓양성 4건이 전부 이 형태였다.
   * 패배의 「졌다」는 앞이 조사·공백이고, 어미의 「졌다」는 앞이 한글이다. */
  { id: '금칙어', re: /패배|(?<![가-힣])졌다|불운|하락|늦었다|부족|안 됨|실패/,
    왜: 'synk-brand 금칙어 — 부정 금지는 SYNK의 핵심 철학이다',
    대신: '틀린 문제 = 다음에 맞힐 문제 · 이번 달은 실력을 다지는 시간' },
];

/** 검사 전에 지우는 것: 주석 줄과 **중첩 인용**.
 *
 * 🔑 순진하게 "따옴표 안은 면제"로 하면 이 훅은 아무것도 못 잡는다 —
 *   JS 파일에서 학생 문구는 그 자체가 문자열 리터럴('...')이기 때문이다.
 *   면제되는 것은 리터럴 **안쪽**의 인용("..." · 「...」)뿐이다. 그게 사용이 아니라 언급이다.
 *   실측 근거: contents_상담AI.js 의 `'"실패"라는 낱말을 쓰지 않는다'` — 규칙을 말하는 문장이다.
 */
function 검사본(line) {
  if (line.trim().startsWith('//')) return '';
  /* ⚠ 곡선 따옴표를 빠뜨리면 안 된다 — 사람이 한글 문서에 실제로 쓰는 표기는 “ ” 와 ‘ ’ 다
   * (CLAUDE.md 가드 맹점①). 2026-08-06 실측: 상담브로셔의 `“6개월에 3급” 같은 약속을 하지
   * 않습니다` 가 곧은 따옴표만 보던 판에 걸렸다 — 금지를 말하는 문장이 금지로 걸린 것이다. */
  return line
    .replace(/[“"][^”"\n]*[”"]/g, '')
    .replace(/[‘'][^’'\n]*[’']/g, (m) => (/[‘’]/.test(m) ? '' : m)) // JS 문자열('...')은 콘텐츠라 살린다
    .replace(/「[^」\n]*」/g, '');
}

/** 블록 주석을 **행 수를 유지한 채** 지운다.
 *  라인 단위로 `/*`·`<!--` 시작만 보면 블록 **중간 줄**을 놓친다 —
 *  2026-08-06 실측 거짓양성 12건 중 3건이 그 형태였다(들여쓴 주석 본문). */
function 주석제거(text) {
  const blank = (m) => m.replace(/[^\n]/g, '');
  return text.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
}

function 위반찾기(text) {
  const out = [];
  주석제거(text).split('\n').forEach((line, i) => {
    const s = 검사본(line);
    if (!s.trim()) return;
    for (const r of 규칙) {
      const m = s.match(r.re);
      if (m) out.push({ 행: i + 1, id: r.id, 문구: m[0], 왜: r.왜, 대신: r.대신 });
    }
  });
  return out;
}

const 대상인가 = (p) => 대상.some((re) => re.test(p));

/* 규칙을 다른 도구가 빌려 쓴다 — `tools/몽골어대조.js` 가 **역번역된 한국어**에 같은 자를 댄다.
 * 훅은 파일만 보고, 번역은 파일 밖에서 뉘앙스가 뒤집힌다. 자를 두 벌 만들면 갈라지므로 하나에서 파생시킨다. */
module.exports = { 위반찾기, 규칙, 검사본, 주석제거, 대상인가 };
if (require.main !== module) return; // require 로 불렸으면 여기까지 — 아래는 CLI·훅 본체다

/* --check [경로…] : 훅과 **같은 판정기**로 지금 상태를 잰다(F052 — 잴 통로를 하나로).
 * 경로를 안 주면 화이트리스트 전량. */
if (process.argv.includes('--check')) {
  const 인자 = process.argv.slice(process.argv.indexOf('--check') + 1).filter((a) => !a.startsWith('--'));
  const { execFileSync } = require('child_process');
  let 파일들 = 인자;
  if (!파일들.length) {
    // -z + quotepath 미신뢰: 한글 경로가 이스케이프되면 대상 정규식이 조용히 빗나간다(코드그래프 F).
    const out = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-z'], { encoding: 'utf8' });
    파일들 = out.split('\0').filter(Boolean).filter(대상인가);
  }
  let 총 = 0;
  console.log(`[voice-guard --check] 대상 ${파일들.length}개 파일`);
  for (const f of 파일들) {
    let 본문;
    try { 본문 = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    for (const v of 위반찾기(본문)) {
      총++;
      console.log(`  ✖ ${f}:${v.행} [${v.id}] "${v.문구}" — ${v.왜}`);
    }
  }
  console.log(총 ? `\n  위반 ${총}건` : '  ✅ 위반 0건');
  process.exit(총 ? 1 : 0);
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const tool = String(input.tool_name || '');
if (!/^(Edit|Write|MultiEdit)$/.test(tool)) process.exit(0);

const ti = input.tool_input || {};
const filePath = String(ti.file_path || '').replace(/\\/g, '/');
if (!대상인가(filePath)) process.exit(0);

/* 이번 편집이 새로 넣는 텍스트만 본다 — 파일 전체를 검사하면 기존 문장이 인질이 되어
 * 그 파일을 아예 못 고치게 되고, 그러면 다음 사람은 규칙이 아니라 훅을 끈다
 * (memory-index-guard 와 같은 판단). */
const 새텍스트 = [];
if (tool === 'Write') {
  let 기존 = new Set();
  try { 기존 = new Set(fs.readFileSync(filePath, 'utf8').split('\n').map((l) => l.trim())); } catch (_) {}
  새텍스트.push(String(ti.content || '').split('\n').filter((l) => !기존.has(l.trim())).join('\n'));
} else {
  const edits = tool === 'MultiEdit' && Array.isArray(ti.edits) ? ti.edits : [ti];
  for (const e of edits) 새텍스트.push(String(e.new_string || ''));
}

const 위반 = 새텍스트.flatMap((t) => 위반찾기(t));
if (위반.length) {
  const 줄 = 위반.map((v) => `  ✖ [${v.id}] "${v.문구}" — ${v.왜}\n     → 이렇게: ${v.대신}`).join('\n');
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `[voice-guard] 학생 접점 글에 말투 위반 ${위반.length}건 — ${filePath}\n${줄}\n` +
        '→ 정본 = .claude/skills/synk-brand/SKILL.md 「반례」 표. 단어를 바꾸는 게 아니라 **어느 쪽에서 세는지**를 바꿔라.\n' +
        '→ 금칙어를 **언급**하는 문장이면 "…" 또는 「…」로 감싸라 — 사용이 아니라 언급은 통과한다.\n' +
        '→ 지금 상태 전량 확인: node .claude/hooks/voice-guard.js --check',
    },
  }));
  process.exit(0);
}
