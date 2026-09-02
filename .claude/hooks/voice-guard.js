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
const path = require('path');
const cp = require('child_process');

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

/* ── 문장 모양 자 (2026-09-03 신설) ──────────────────────────────────────────
 * 유호 지시: 말투 도구를 들여 «내 답»과 «대외 문안» 둘 다 재게 한다.
 * 위 규칙들은 «우리 규칙»(금칙어·결핍 프레임)을 보고, 이 층은 «일반 한국어»를 본다 —
 * 번역투 · 긴 줄표 · 이중 피동 · 어려운 한자어. 자 = hanlint(MIT · 딸린 것 0).
 *
 * 🔴 **막지 않는다.** 09-03 첫 실측에서 대외 문안에 이미 1,336건이 있었고 그 중 802건이 긴 줄표다.
 *    막으면 그 파일들을 아예 못 고치게 되고, 그러면 다음 사람은 규칙이 아니라 훅을 끈다.
 * 🔴 **이번에 새로 넣는 줄만** 본다. 파일 전체를 대면 기존 문장이 인질이 된다(위 새텍스트와 같은 판단).
 * 🔴 조각에 못 믿을 규칙은 걸러낸다 — 앞 문장이 없으니 「가리킬 것이 없다」는 당연히 뜬다.
 */
let 문체lib = null;
try { 문체lib = require(path.join(__dirname, '..', '..', 'tools', 'lib', '대외문안.js')); } catch (_) {}
const 문체대상인가 = (p) => (문체lib ? 문체lib.대외문안인가(p) : false);
const 문체검사기 = path.join(__dirname, '..', '..', 'node_modules', 'hanlint', 'bin', 'hanlint.js');
const 문체자 = path.join(__dirname, '..', 'hanlint', '대외문안.toml');

function 문체찾기(글) {
  if (!문체lib || !글 || 글.trim().length < 60) return [];
  if (!fs.existsSync(문체검사기) || !fs.existsSync(문체자)) return [];
  let 낸것 = '';
  try {
    낸것 = cp.execFileSync(process.execPath,
      [문체검사기, '-', '--config', 문체자, '--format', 'json', '--path', '조각.md'],
      { input: 글, encoding: 'utf8', timeout: 8000, maxBuffer: 1 << 24 });
  } catch (e) {
    낸것 = String(e.stdout || '');
    if (!낸것.trim()) return [];
  }
  try {
    const j = JSON.parse(낸것);
    return (j.files || []).flatMap((f) => f.findings || [])
      .filter((f) => 문체lib.조각에믿을규칙.has(f.rule))
      .map((f) => ({ id: f.rule, 왜: f.why || '', 문구: String(f.quote || '').slice(0, 60) }));
  } catch { return []; }
}

/* ── 경고 층 (2026-09-02 · 유호 확정 「1,2로 하자」) ─────────────────────────
 * 정본 = `docs/정본/SYNK/SYNK 집필 규범.txt` §17 「긍정 프레임 — 손이 하는 동작 다섯」.
 *
 * 🔴 **왜 «차단»이 아니라 «경고»인가** — 그 다섯 중 5번이 「부정이 «무기»인 자리는 남긴다」이고,
 *   어느 쪽인지는 **기계가 원리상 못 가른다**:
 *     · 「시험장에는 AI가 같이 들어가지 않으니까요」   ← 남겨야 할 최고의 문장
 *     · 「4급은 외워서 닿는 급수가 아닙니다」          ← 고쳐야 할 부정 전제
 *   같은 꼴인데 판정이 반대다. 차단으로 만들면 앞엣것이 매번 막히고, 이 파일이 스스로 경고한
 *   그 일이 벌어진다 — 「따를 수 없는 처방은 우회를 정상 통로로 만든다」.
 *
 * 🔴 **`위반찾기` 에 섞지 않는다** — `tools/몽골어대조.js` 가 그 반환 «길이»로 게이트를 건다.
 *   경고를 거기 넣으면 몽골어 검문이 경고 하나로 불통과가 된다(자를 빌려 쓰는 쪽을 깨뜨린다). */
const 경고규칙 = [
  /* 🔑 무엇을 잡고 무엇을 넘기나 — **어미가 가른다**(09-02 실측으로 고른 축):
   *   잡는다 = «단정»하는 부정 (`~지 않습니다` · `~지는 않는다` · `~아닙니다` · `~가 아니라`)
   *            → 이게 결핍을 «주장»한다. 문을 여는 자리에 오면 읽는 사람이 없는 것부터 본다.
   *   넘긴다 = «근거»를 대는 부정 (`~않으니까` · `~않잖` · `~않아서` · `~않으면`)
   *            → 앞의 긍정을 받쳐 주는 꼬리다. 「시험장에는 AI가 같이 들어가지 않으니까요」가 그것이다.
   *   ⚠ 첫 판은 `지 않` 만 봐서 「되«지는» 않습니다」를 놓쳤고, 무기 문장이 조용한 것도
   *     설계가 아니라 우연이었다. 조사(는·도·가)를 열고 어미로 가르도록 고쳤다. */
  { id: '부정문열기',
    re: /^\s*(?:[-*>]\s*|\*\*)?[^.!?\n]{0,40}(?:지(?:는|도|가)?\s*않(?:습니다|는다|다|고|은|는)|아닙니다|아니다|[이가]\s*아니라)/,
    왜: '부정 전제로 문을 열면 읽는 사람이 결핍을 먼저 본다(집필 규범 §17 동작 1)',
    대신: '같은 사실을 여는 쪽에서 — 「닿지 않습니다」 → 「말해 본 시간이 열어 줍니다」',
    ㄴ예외: '부정이 «무기»인 자리는 그대로 둔다(동작 5). 판정은 사람이 한다' },
];

/* 🔴 이 규칙만 «줄머리»에 앵커를 건다(문을 여는 자리를 재니까). 그래서 차단 규칙들과 달리
 *   **태그가 앞에 붙으면 그대로 오염된다** — 실측 09-02: `<span style=…>※ 이 아니라` 가
 *   경고로 잡혔다. 차단 규칙은 한글 구문을 찾아 앵커가 없어 이 병이 없었다.
 *   ⇒ 경고 층만 태그를 걷고 잰다. `검사본()` 을 고치면 차단 층의 판정까지 흔들리므로 여기서 한다. */
function 마크업걷기(line) {
  return line
    .replace(/<[^>\n]*>/g, '')      // html 태그
    .replace(/^\s*[#>*\-|]+\s*/, '') // md 글머리·인용·표 칸
    .trim();
}

/** 경고 층. 차단하지 않는다 — 반환값을 게이트로 쓰지 말 것. */
function 경고찾기(text) {
  const out = [];
  주석제거(text).split('\n').forEach((line, i) => {
    const s = 마크업걷기(검사본(line));
    if (!s.trim()) return;
    /* 「※」로 여는 줄은 **제작 지시**다(번역자·디자이너에게 하는 말) — 독자가 읽는 카피가 아니다.
     *   실측: `※ 값 자체(URL·번호·주소)는 번역 대상이 아닙니다` 가 경고로 잡혔는데,
     *   이건 고치면 «지시가 틀려지는» 문장이다. 말투 규칙의 독자는 학부모·학생이지 제작자가 아니다. */
    if (/^[※⚠]/.test(s)) return;
    for (const r of 경고규칙) {
      const m = s.match(r.re);
      if (m) out.push({ 행: i + 1, id: r.id, 문구: m[0].trim(), 왜: r.왜, 대신: r.대신 });
    }
  });
  return out;
}

/* 규칙을 다른 도구가 빌려 쓴다 — `tools/몽골어대조.js` 가 **역번역된 한국어**에 같은 자를 댄다.
 * 훅은 파일만 보고, 번역은 파일 밖에서 뉘앙스가 뒤집힌다. 자를 두 벌 만들면 갈라지므로 하나에서 파생시킨다. */
module.exports = { 위반찾기, 규칙, 검사본, 주석제거, 대상인가, 경고찾기, 경고규칙 };
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
  let 총 = 0, 경고총 = 0;
  console.log(`[voice-guard --check] 대상 ${파일들.length}개 파일`);
  for (const f of 파일들) {
    let 본문;
    try { 본문 = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    for (const v of 위반찾기(본문)) {
      총++;
      console.log(`  ✖ ${f}:${v.행} [${v.id}] "${v.문구}" — ${v.왜}`);
    }
    // 경고는 «따로» 센다 — 섞으면 「막을 것」과 「볼 것」이 같은 수가 되고 종료코드가 거짓말한다.
    for (const w of 경고찾기(본문)) {
      경고총++;
      console.log(`  ⚠ ${f}:${w.행} [${w.id}] "${w.문구}" — ${w.왜}`);
    }
  }
  console.log(총 ? `\n  위반 ${총}건` : '  ✅ 위반 0건');
  console.log(경고총 ? `  ⚠ 경고 ${경고총}건 (막지 않는다 — 부정이 «무기»인 자리는 남긴다 · 집필 규범 §17 동작 5)` : '  ✅ 경고 0건');
  process.exit(총 ? 1 : 0); // 🔑 경고는 종료코드를 바꾸지 않는다
}

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const tool = String(input.tool_name || '');
if (!/^(Edit|Write|MultiEdit)$/.test(tool)) process.exit(0);

const ti = input.tool_input || {};
const filePath = String(ti.file_path || '').replace(/\\/g, '/');
/* 자가 둘이고 대상도 다르다 —
 *   ① 말투 위반(이 파일 위쪽 규칙)  → 학생 접점 좁은 목록. **막는다.**
 *   ② 문장 모양(hanlint)            → 대외 문안 넓은 목록. **막지 않는다.**
 * 한쪽만 대상이어도 그쪽은 돌아야 하므로 둘 다 아닐 때만 빠진다. */
const 문체대상 = 문체대상인가(filePath);
if (!대상인가(filePath) && !문체대상) process.exit(0);

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

const 위반 = 대상인가(filePath) ? 새텍스트.flatMap((t) => 위반찾기(t)) : [];
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

/* 경고 층 — **막지 않는다.** 통과시키면서 눈에만 띄게 한다(집필 규범 §17 동작 5:
 * 부정이 «무기»인 자리가 있어 기계가 판정할 수 없다). `additionalContext` 는 세션에만 보이고
 * 도구 실행을 멈추지 않는다 — 「알림」과 「차단」을 같은 통로로 내면 둘이 같은 무게가 된다. */
const 경고 = 대상인가(filePath) ? 새텍스트.flatMap((t) => 경고찾기(t)) : [];
const 문체 = 문체대상 ? 새텍스트.flatMap((t) => 문체찾기(t)) : [];

if (경고.length || 문체.length) {
  const 토막 = [];
  if (경고.length) {
    토막.push(`[voice-guard 경고 ${경고.length}건 · 막지 않았다] ${filePath}`);
    토막.push(경고.map((w) => `  ⚠ [${w.id}] "${w.문구}" — ${w.왜}\n     → 이렇게: ${w.대신}`).join('\n'));
    토막.push('→ 부정이 «무기»인 자리면 그대로 둔다(예: 「시험장에는 AI가 같이 들어가지 않으니까요」).');
    토막.push('→ 자 다섯 = docs/정본/SYNK/SYNK 집필 규범.txt §17 「긍정 프레임 — 손이 하는 동작 다섯」');
  }
  if (문체.length) {
    /* 규칙 이름을 그대로 내면 그 자체가 낯선 말이 된다 — 우리말로 바꿔 낸다. */
    const 우리말 = {
      dash: '긴 줄표(—)로 이어 붙였다', hardWord: '쉬운 말이 있는 어려운 말',
      longSentence: '문장이 길다(30어절 넘음)', translationese: '번역투(~에 의해·~을 통해·~로부터)',
      doublePassive: '이중 피동(되어지다·보여지다)', doubleNegative: '이중 부정',
      euiChain: '「의」가 겹쳤다', nounPile: '명사를 조사 없이 쌓았다',
      cliche: '상투어', japaneseLoan: '일본어투', redundantPair: '겹말',
      imperativePeriod: '명령·청유 뒤 마침표',
    };
    const 묶음 = new Map();
    for (const f of 문체) { if (!묶음.has(f.id)) 묶음.set(f.id, { 수: 0, 보기: f.문구 }); 묶음.get(f.id).수++; }
    토막.push(`[문장 모양 ${문체.length}건 · 막지 않았다] ${filePath} — 대외 문안이라 잰다`);
    for (const [id, v] of [...묶음].sort((a, b) => b[1].수 - a[1].수)) {
      토막.push(`  ✍ ${우리말[id] || id}${v.수 > 1 ? ` ×${v.수}` : ''}${v.보기 ? `  「${v.보기}」` : ''}`);
    }
    토막.push('→ 이번에 «새로 넣는 줄»만 잰 것이다. 기존 문장은 기준선이 잠그고 있다.');
    토막.push('→ 전량 확인: node tools/글검사.js --전량 · 새 것만: node tools/글검사.js');
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 토막.join('\n') },
  }));
  process.exit(0);
}
