#!/usr/bin/env node
// decision-queue — 유호님이 답해야 풀리는 것들을 하루 몇 건씩 폰으로 밀어주는 큐.
//
// 왜 있나: 실측된 병목은 AI 처리량이 아니라 **유호님의 미결 결정**이다(memory
// decision-queue-bottleneck). 그런데 ⏳ 항목은 메모리 28개 파일에 흩어져 있어
// **아무도 전체를 보지 않는다** — 세션마다 자기 트랙의 ⏳만 보고, 유호님은 목록조차 못 본다.
// 이 도구는 그 흩어진 것을 한 줄씩 모아 순위를 매기고, 헤르메스 cron이 텔레그램으로 민다.
//
// 설계 원칙 두 가지:
//   ①**읽기 전용.** 메모리도 repo도 쓰지 않는다(지휘층은 읽기 전용 — memory ai-stack-decision).
//     답변은 유호님이 텔레그램에 쓰고, 다음 세션에 클로드가 읽어 반영한다.
//   ②**굶는 항목이 없다.** 순위만 쓰면 하위 항목은 영원히 안 나온다 → 상위 풀 안에서
//     날짜로 회전시켜 언젠가는 전부 한 번씩 나온다.
//
// 사용법:
//   node tools/decision-queue.js              오늘 밀 3건(텔레그램용 평문)
//   node tools/decision-queue.js --all        전체 큐를 순위대로
//   node tools/decision-queue.js --json       기계 판독용
//   node tools/decision-queue.js --count 5    건수 지정
//   node tools/decision-queue.js --버려진            걸러진 ⏳ 중 **아직 안 본 것만**
//   node tools/decision-queue.js --버려진 --전체     걸러진 전량
//   node tools/decision-queue.js --버려진 --확인     지금 뜬 것을 「봤다」로 표시(다음부터 안 뜬다)
//   node tools/decision-queue.js --조각              배달은 되는데 껍데기인 줄(재료가 ⏳ 앞에서 잘림)
//   SYNK_MEMORY_DIR=... 로 대상 디렉터리 덮어쓰기(테스트용)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { memoryDir, load, decisions, INDEX_FILES } = require('./memory-graph.js');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/* 인덱스는 지도라 본문이 중복된다 — 큐에서 제외한다.
 * ⚠ 인덱스는 **한 파일이 아니다**(F184 쪼개기: MEMORY.md + 지도.md). 목록을 여기 다시 적으면
 * 갈라진다 — memory-graph 의 INDEX_FILES 하나에서만 파생시킨다(CLAUDE.md 신뢰성 ④).
 * 실측 2026-08-07: 지도.md 를 토픽으로 읽어 조각 12건(메타 문장·중복)이 유호님께 배달됐다. */
const 인덱스다 = (name) => INDEX_FILES.includes(name);
const MAX_LEN = 300;       // 텔레그램 한 줄로 읽히는 길이

/* ── 추출 ──────────────────────────────────────────────────────────────────
 * ⏳ 가 있는 줄 하나 = 미결 항목 하나로 센다. 한 줄에 「⏳유호 3건」처럼
 * 뭉쳐 있는 것도 그대로 한 항목으로 둔다 — 쪼개려면 문장을 해석해야 하고,
 * 그 해석이 틀리면 없는 결정을 만들어낸다(있는 것을 덜 쪼개는 쪽이 안전하다).
 */
function stripMd(s) {
  return s
    .replace(/^#{1,6}\s+/, '')          // 헤더
    .replace(/^[-*]\s+/, '')            // 불릿
    /* [2026-08-07] 앞 판은 `[^\]|>]*>?` 가 별칭 없는 위키링크를 **통째로 먹었다** —
     * `[[x]]` 는 앞부분이 x 를 다 먹고 캡처가 비어 `이 한 번이 [[x]] 의` → `이 한 번이  의`.
     * 실측 08-07: 배달 111건 중 8건이 이 모양이었고 「— 가 요구한 2건 중」처럼 주어가 지워졌다.
     * 별칭 구분자(`|`·`>`)가 **있을 때만** 앞을 버린다(F222 ①). */
    .replace(/\[\[(?:[^\]|>]*[|>])?([^\]]*)\]\]/g, '$1') // [[x]]→x · [[막힘>x]]→x · [[a|b]]→b
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // [텍스트](링크)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    /* 취소선은 **내용까지** 지운다 — 표시만 벗기면 세션이 죽인 항목이 되살아나 배달된다.
     * 실측 2026-08-06: 「~~동의 6항목~~ ✅준비완료」·「③~~몽골어 검수~~ ✅해소」 두 줄이
     * 취소선으로 닫혔는데도 유호님께 계속 배달됐다(F126 「왜 계속 뜨는거야」의 큐 쪽 절반).
     * 취소선은 어디서든 「이 글자는 철회됐다」는 뜻이라 지우는 쪽이 언제나 맞다. */
    .replace(/~~.*?~~/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ⏳ 는 이 메모리에서 **두 가지로 쓰인다** — 실측으로 드러난 사실이다:
 *   ①항목 표시(줄머리·구분자 뒤): "- ⏳ 유호님 몫: …"   ← 이게 큐다
 *   ②본문 속 지시어: "위 ⏳3건 미결 상태에서", "(⏳ 미결 다수)일 가능성"  ← 큐가 아니다
 * 둘을 안 가르면 문장 조각이 결정으로 배달된다(실측: 52건 중 5건이 조각이었다).
 * 가르는 기준은 **⏳ 앞의 마지막 글자** — 글자·숫자·'(' 뒤면 문장 속이고,
 * 줄머리나 구분자(· — : 등) 뒤면 항목 표시다.
 * 항목이면 ⏳부터 끝까지를 돌려준다(앞은 배경이지 항목이 아니다). 아니면 null.
 */
const MARKER_PREV = new Set(['·', '—', '–', '-', ':', '.', '!', '?', ';', '▶', ']', '】', '>', '|', '*', ')']);

/* [2026-08-04] 세 번째 용법이 있었다 — **기호 자체를 인용하는 코드 스팬**.
 *   "⚠첫 판은 23건이 가짜였다: `⏳`가 이 메모리에서 두 용법으로 쓰이는데…"
 * stripMd가 백틱을 벗기면 ⏳ 앞 글자가 ':'(구분자)가 되어 **항목으로 승격**되고,
 * 하필 그 문장이 이 도구의 결함을 설명하는 문단이라 **자기 자신의 회고가 결정으로 배달됐다.**
 * 🔑일반화 = 문서가 기호를 「쓰는」 것과 「말하는」 것은 다르다. 코드 스팬은 말하는 자리다.
 * 마스킹은 판별용이고 표시용 텍스트에는 되돌린다(진짜 항목 뒤에 붙은 인용까지 지우면 안 된다). */
const CODE_MARK = '\u0000';
function maskCodeSpans(raw) {
  return raw.replace(/`[^`]*`/g, (m) => m.replace(/⏳/g, CODE_MARK));
}
function unmaskCodeSpans(s) {
  return s.split(CODE_MARK).join('⏳');
}

/* ── 한 줄 판정 — **이 저장소에서 「⏳가 항목인가」를 정하는 유일한 자리** ──────────
 * extract() 안에 있던 것을 꺼냈다. 꺼낸 이유는 재사용이 아니라 **갈라짐 방지**다(F108):
 * memory-status-guard 훅이 「이 파일에 살아 있는 ⏳」를 세는데, 훅이 자기 정규식으로 세면
 * 큐가 배달하지 않는 줄(헤더·범례·취소선으로 닫힌 줄)까지 「남았다」고 말하게 된다 —
 * 같은 판정을 두 곳에 적으면 갈라진다(CLAUDE.md 신뢰성 ④·가드 맹점④).
 * 반환: null=⏳ 아님(조용히 통과) · {사유}=걸러짐 · {clean}=항목 */
function 줄판정(line) {
  if (!line.includes('⏳')) return null;
  /* [2026-08-04] 마크다운 헤더의 ⏳는 **구획 이름**이지 항목이 아니다.
   * 실측: 하루치 3칸 중 2칸이 「⏳ 남은 것」·「⏳ 유호님 대기」 같은 헤더로 채워졌다 —
   * 배달은 됐는데 읽고 나면 무엇을 답해야 하는지 모른다. 빈 배달이 큐의 신뢰를 깎는다.
   * (기존 「글자 수 2 미만」 필터는 「## ⏳」만 걸러서 뒤에 말이 붙은 헤더를 못 잡았다.)
   * 항목은 불릿·문단으로 쓴다. 헤더 아래 실제 항목이 있으면 그게 배달된다.
   * [2026-08-07] 🔴 **여기서 `null` 을 돌려준 것이 결함이었다** — null 은 「⏳ 아님」이라
   * 이 줄은 배달도 폐기함도 아닌 **무기록**으로 사라졌다. 「헤더 아래 실제 항목이 있으면」이
   * 성립 안 하는 파일이 34개였고(불릿에 ⏳ 를 안 단다), 그중 하나가 소급불가 ①-2·①-12 를
   * 여는 유호님 결정이었다. 판정은 그대로 「항목 아님」이되 **기록은 남긴다**. */
  /* [2026-08-12 · 31b26852] 🔴 **코드 스팬 판별이 헤더 판별보다 «뒤»에 있어 갈라졌다.**
   * 아래 maskCodeSpans 는 항목 경로에만 걸렸고, 바로 위 헤더 검사는 «원문»을 봐서
   * `## ✅ 종결 (위 `⏳` 는 실행됐다)` 처럼 **기호를 말하기만 한** 제목을 「절 제목」으로 셌다.
   * 증상은 --절 이 그 파일을 「배달 0건」으로 계속 부르는 것뿐인데, **처방을 따라도 안 꺼진다** —
   * 백틱을 씌워도 헤더 경로는 그걸 안 읽기 때문이다(따를 수 없는 처방 = 우회를 정상 통로로 · F103).
   * 실측: 이 수리 직전 --절 2파일이 전부 이 모양이었다(data-accumulation-2year:76 · retry-of:50).
   * 🔑 처방 = 「쓰는 것 vs 말하는 것」 판별을 **모든 경로보다 앞**으로 올려 한 곳에서만 판정한다.
   *    파생을 하나로 두는 것이 규칙이다(CLAUDE.md 신뢰성 ④ · 가드 맹점④) — 위 :91 주석이
   *    「이 저장소에서 ⏳가 항목인가를 정하는 «유일한» 자리」라고 적어 놓고 그 안에서 갈라져 있었다. */
  const masked = maskCodeSpans(line);
  if (!masked.includes('⏳')) return null;   // 코드 스팬 «안에만» 있다 = 기호를 말한 줄이지 표식이 아니다
  if (/^\s{0,3}#{1,6}\s/.test(line)) return { 사유: '절 제목으로 판정', 절제목: true };
  const stripped = stripMd(masked);
  const mi = markerIndex(stripped);
  if (mi === -1) return { 사유: '문장 속 지시어로 판정' };
  const clean = unmaskCodeSpans(stripped.slice(mi).trim());
  // ⏳ 앞에서 버려지는 재료의 크기 — 「항목이면 앞은 배경」 판정 자체는 옳지만(위 주석),
  // 앞이 두툼한데 뒤가 껍데기면 그 줄은 **답할 수 없는 모양으로 배달**된다. extract 가 이 값으로 조각을 센다.
  const 앞글자 = 글자수(unmaskCodeSpans(stripped.slice(0, mi)));
  // 범례("💡새 / 🔍검토 / ⏳판단대기 / ✅채택")는 항목이 아니다. 단 판별은 **⏳ 바로 옆 모양**으로만 한다 —
  // 첫 판은 「줄 어딘가에 🔍가 있고 '/'가 있으면 범례」로 봤는데, 긴 메모리 줄은 경로·날짜에 '/'가
  // 흔하고 🔍도 본문에 쓰여서 **진짜 미결이 조용히 사라졌다**(실측 2건). 넓은 가드가 큐를 줄이면
  // 아무도 눈치채지 못한다 — 거짓양성보다 이쪽이 나쁘다.
  if (/^⏳\S*\s*\/\s*[💡🔍✅⚠🚫]/.test(clean)) return { 사유: '범례로 판정' };
  // 장식뿐인 줄(「## ⏳」 같은 헤더)만 거른다. **길이가 아니라 글자 수로 센다** —
  // 길이로 재면 `##` 같은 기호가 통과하고, 하한을 올리면 「⏳ 티원」 같은
  // 짧은 한국어 항목이 통째로 사라진다(한글은 2글자로도 완결된 항목이다).
  if (글자수(clean.replace(/⏳/g, '')) < 2) return { 사유: '장식뿐인 줄로 판정' };
  return { clean, 앞글자 };
}
const 글자수 = (s) => s.replace(/[^\p{L}\p{N}]/gu, '').length;

/* ── frontmatter (2026-08-12 · 31b26852) — **다섯 번째 배달 실패 모양** ──────────────
 * `description:` 은 파일 «전체» 요약이라 ✅(끝난 것)와 ⏳(남은 것)가 **구조적으로 한 줄에 온다.**
 * 실측: design-docs-sweep-0811 의 description 이 항목으로 배달되며 아래 metadata 블록까지 꼬리로
 * 끌고 갔다 — 「⏳유호 6…✅반영 종결(416088f) metadata: node_type: memory type: project」.
 * 받아도 답할 수 없고, 「끝난 일이 미결로 안 간다」 회귀(결정큐.test.js:566)를 **상시 빨갛게** 만든다.
 * 그 적색은 주인이 없어 아무도 안 고치고, 남의 배포 게이트만 막는다.
 * 🔑 판정은 「항목 아님」이되 **폐기함에 기록한다** — 조용히 지우면 그게 유일한 기록인 날 잃는다(F108
 *    이 파일 :104 이 헤더에서 배운 것과 같은 교훈이다).
 * 반환 = frontmatter 마지막 줄 index(없으면 -1). **닫히지 않은 `---` 는 frontmatter 가 아니다** —
 * 본문 첫 줄이 수평선이면 파일 전체를 삼켜 큐가 통째로 0건이 된다(미실행과 통과가 같은 모양). */
function frontmatter끝(줄들) {
  if (줄들[0] === undefined || 줄들[0].trim() !== '---') return -1;
  for (let i = 1; i < 줄들.length; i++) if (줄들[i].trim() === '---') return i;
  return -1;
}

/* ── 꼬리 조각 (2026-08-11 · a831951c) — **네 번째 배달 실패 모양** ─────────────
 * 앞의 셋(절 제목·지시어 오분류·소프트랩 절단)과 달리 판정이 전부 옳은데도 깨진다:
 * 재료를 ⏳ **앞에** 쓰고 표식만 꼬리에 달면, 「앞은 배경」 규칙대로 재료가 버려지고
 * 껍데기만 나간다. 실측: mvp-eta-measured:50 「…왕복시험이 전부 막힌다(F313…). ⏳유호님
 * 승인 자리.」 → 배달 = 「⏳유호님 승인 자리.」 7글자. 리허설 재배포 승인(전 세션의
 * 왕복시험을 여는 유일한 결정)이 답할 수 없는 모양으로 나갔고, 어떤 경고도 안 울렸다.
 * 🔑 배달을 막지 않는다 — 껍데기도 침묵보다 낫다(거짓양성보다 조용한 누락이 나쁘다는
 *    이 파일의 기존 판정). 세서 **경고**만 한다. 처방 = 그 줄을 「설명 줄 + ⏳질문 전문 줄」로 가른다.
 * 🔑 두 문턱의 AND 다 — 앞이 얇으면(「⏳ 티원」) 완결이고, 뒤가 두꺼우면 재료가 뒤에 있다.
 *    뒤 문턱을 길이가 아니라 글자 수로 재는 이유는 장식뿐인 줄 필터와 같다(한글은 짧아도 완결된다).
 *    판정은 꼬리(소프트랩 이어붙임) **뒤**에 한다 — 다음 줄이 재료를 이어주면 조각이 아니다. */
const 조각_앞문턱 = 20;   // 이만큼의 재료가 표식 앞에서 버려지고
const 조각_뒤문턱 = 12;   // 배달되는 글자가 이보다 적으면 껍데기다 (실측 표본 7글자)

// 괄호 안의 ⏳는 양쪽 다 실재한다 — 여는 괄호만 보고는 못 가른다:
//   "(⏳유호 승인 대기·미검증 출처 명기)."  ← 괄호 자체가 항목이다
//   "개정안 7건(⏳유호 승인 대기): ⑨소음…"   ← 괄호는 머리에 붙은 주석, 뒤가 항목 본문이다
//   "(⏳ 미결 다수)일 가능성. 그렇다면 …"    ← 괄호가 문장의 일부다 = 지시어
// 가르는 것은 길이가 아니라 **괄호 뒤가 조사처럼 붙어 이어지는가**다(한국어는 조사가 ')' 에 바로 붙는다).
/* [2026-08-07] 첫 판은 「뒤에 2자 넘게 남으면 지시어」였고, 그래서 머리에 붙은 주석형이 통째로 사라졌다.
 * 실측 2건 — minigame-collection:15 은 같은 파일 아래 줄이 같은 질문을 실어 손실 0이었지만,
 * engine-role-allocation:73(되돌리는 길=Codex Cloud(⏳유호 웹 환경 1회))은 **그 줄이 유일한 기록**이라
 * 그 토픽의 큐 항목이 0건이었다 — 유호님께 한 번도 배달된 적이 없다. 같은 모양의 두 번째 손실이다
 * (첫 번째 = hermes-v020-judgment:71 · 08-05 이후 미배달). 조건을 넓히기만 한다(기존 항목이
 * 지시어로 뒤집히는 경우 없음) — 거짓양성보다 조용한 누락이 나쁘다는 것이 이 파일의 기존 판정이다. */
function parenIsItem(clean, i) {
  const close = clean.indexOf(')', i);
  if (close === -1) return true;                 // 안 닫히면 줄 끝까지가 항목이다
  const 뒤 = clean.slice(close + 1);
  return 뒤.trim().length <= 2 || !/^[\p{L}\p{N}]/u.test(뒤);
}

/* 항목 판정과 「⏳가 어디서 시작하나」는 한 지식이다 — index 를 따로 구현하면 갈라진다(신뢰성 ④).
 * markerClause 는 이 인덱스의 얇은 포장으로 남는다(기존 호출부·테스트 형태 불변). */
function markerIndex(clean) {
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] !== '⏳') continue;
    let j = i - 1;
    while (j >= 0 && /\s/.test(clean[j])) j--;
    if (j < 0 || MARKER_PREV.has(clean[j])) return i;
    if (clean[j] === '(' && parenIsItem(clean, i)) return i;
  }
  return -1;
}
function markerClause(clean) {
  const i = markerIndex(clean);
  return i === -1 ? null : clean.slice(i).trim();
}

/* ── 날짜 게이트 ────────────────────────────────────────────────────────────
 * [2026-08-04] ⏳는 두 가지를 뜻한다 — 「몰라서 못 정함」과 **「알지만 아직 때가 아님」**.
 * 큐가 둘을 구별하지 못하면 후자가 매일 아침 폰으로 간다. 실제 사례: 「얼리버드 가격을
 * 2026-12에 확정한다」는 유호님이 이미 **시점까지 답한 결정**인데, 그냥 ⏳로 적으면
 * 4개월간 120번 배달된다. 그러면 큐 전체가 배경 소음이 되고 **진짜 급한 항목이 묻힌다** —
 * 이 도구가 풀려고 만든 병목(미결 결정)을 이 도구가 도로 만드는 셈이다.
 *
 * 표기 = ⏳ 바로 뒤에 `yyyy-MM` 또는 `yyyy-MM-dd`. 그 달/그 날이 되기 전까지 배달하지 않는다.
 *   예) "⏳2026-12 얼리버드 가격 확정 — 광고 P2 실측 뒤"
 * ⚠ 조용히 사라지지 않는다: --all·--json 에는 「언제부터 뜨는지」와 함께 남는다.
 *    (통과와 미실행이 같은 모양이면 안 된다 — CLAUDE.md 신뢰성 조항) */
const DATE_GATE = /^⏳\s*(\d{4})-(\d{2})(?:-(\d{2}))?(?![\d-])/;
function gateDate(clean) {
  const m = DATE_GATE.exec(clean);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], m[3] ? +m[3] : 1];
  // 날짜처럼 안 생긴 것은 게이트가 아니라 그냥 숫자다(버전·수량 오인 방지)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d);
}
function dayStart(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/* ── 소프트랩 꼬리 (2026-08-07 · F222 ②) ───────────────────────────────────
 * 마크다운은 **빈 줄까지가 한 문단**인데 판정은 줄 단위라, ⏳ 항목이 md 에서 줄바꿈되면
 * 뒤가 통째로 안 실렸다. 실측: s1a-delivery-batch:91 의 도전안이 「…20~30개 순환으로」에서
 * 끊겨 유호님 화면에 동사 없이 나갔다. 앞 세션의 처방은 「그 줄을 한 줄로 붙여 둔다」는
 * **프로즈**였고 그 파일 하나만 고쳤다(CLAUDE.md: 프로즈로 막을 것은 기계로 옮긴다).
 *
 * 🔑 이 함수는 **더하기만 한다** — 판정(줄판정)은 손대지 않으므로 지금 배달되는 항목이
 * 사라질 길이 없다. 잘라먹는 방향으로는 틀릴 수 없고, 못 이으면 지금과 같아진다.
 * 멈추는 자리 셋: ①빈 줄·새 블록(헤더·불릿·번호·표·인용·펜스) ②그림문자 —
 * 이 메모리는 ⚠🔴🔑🔎 를 사실상 불릿으로 쓴다(실측: referral-prereg:123 은 빈 줄 없이
 * `⚠` 로 다른 항목이 시작한다). ⏳ 도 그림문자라 **다음 항목을 삼키지 않는다**. */
const 새블록 = /^\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|[>|]|```|---)/;
function 꼬리(lines, i) {
  const 조각 = [];
  for (let k = i + 1; k < lines.length; k++) {
    const l = lines[k];
    if (!l.trim() || 새블록.test(l)) break;
    const 글자 = l.search(/\p{Extended_Pictographic}/u);
    조각.push((글자 === -1 ? l : l.slice(0, 글자)).trim());
    if (글자 !== -1) break;
  }
  return 조각.join(' ').trim();
}

/* [2026-08-04] 메모리 폴더가 없으면 **크게 실패한다 — 빈 배열로 떨어지지 않는다.**
 * 이 도구의 「미결 0건이면 침묵」 규칙과 결합하면 빈 배열은 **정상과 구별되지 않는다**:
 * 클라우드 cron이 매일 아침 아무 말도 안 하는데 아무도 이유를 모르는 상태가 된다
 * (v9.146에서 이미 겪은 「모름과 정상이 같은 모양」 계열). 경로를 못 찾은 것은 침묵이 아니라 사고다. */
function extract(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(
      `[decision-queue] 메모리 디렉터리를 못 찾음: ${dir}\n` +
      '  SYNK_MEMORY_DIR 환경변수로 직접 지정할 수 있다(클라우드 워크플로는 그렇게 넘긴다).'
    );
  }
  const items = [];
  /* [2026-08-05] 걸러진 ⏳를 남긴다 — **3번째 실측**이라 더는 프로즈로 안 막는다.
   * 앞선 둘은 이 파일 주석에 있다(범위 넓은 범례 가드 2건). 이번 건: 「삭제 후보 6묶음(⏳유호
   * 확정 대기)」처럼 **여는 괄호 뒤**에 쓴 ⏳가 지시어로 분류돼, 정본 §12의 유호님 결정 8문항이
   * 하루 동안 큐에 없었다. 필터가 맞았는지 틀렸는지는 사람이 봐야 갈리는데, 안 보이면 못 본다 —
   * 날짜 게이트에 이미 적용한 원칙(「통과와 미실행이 같은 모양이면 안 된다」)을 여기에도 편다.
   * ⚠ 새 함수로 다시 훑지 않는다 — 판정을 두 곳에 적으면 갈라진다(CLAUDE.md 신뢰성 ④).
   *   같은 통과에서 파생시키려고 반환 배열에 얹는다(tests 12곳이 배열로 받으므로 형태 불변). */
  const 버려진 = [];
  const 버린다 = (f, i, line, 사유) => 버려진.push({
    topic: f.replace(/\.md$/, ''), line: i + 1, 사유,
    text: line.trim().slice(0, MAX_LEN),
  });
  /* [2026-08-07] 절 제목은 폐기함에 **섞지 않는다** — 76줄짜리 폐기함은 이미 아무도 안 읽는
   * 크기라(「걸러진 전수 확인」이 5일간 0회였다) 거기 넣으면 무기록에서 무독으로 옮기는 것뿐이다.
   * 대신 「절 제목을 걸어 놓고 그 파일이 아무것도 못 낸다」는 **깨진 약속**만 따로 센다 —
   * 파일 단위라 목록이 짧고, 하나 고칠 때마다 줄어든다. */
  const 절뿐 = [];
  const 조각들 = [];   // 꼬리 조각 — 배달은 되지만 답할 수 없는 껍데기 (사유는 조각_앞문턱 주석)
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md') && !인덱스다(n))) {
    const full = path.join(dir, f);
    const text = fs.readFileSync(full, 'utf8');
    // 자동 생성된 역링크 구간은 큐가 아니다
    const body = text.split('<!-- memory-graph:역링크 시작')[0];
    const mtime = fs.statSync(full).mtimeMs;
    const 절제목 = [];
    let 배달 = 0;
    const 줄들 = body.split('\n');
    const fm끝 = frontmatter끝(줄들);
    줄들.forEach((line, i) => {
      const 판정 = 줄판정(line);
      if (!판정) return;
      // frontmatter 는 파일 «에 대한» 메타지 항목이 아니다 — 다만 기록은 남긴다(위 §frontmatter · F108)
      if (i <= fm끝) return 버린다(f, i, line, '프론트매터로 판정');
      if (판정.절제목) { 절제목.push({ line: i + 1, text: line.trim().slice(0, MAX_LEN) }); return; }
      if (판정.사유) return 버린다(f, i, line, 판정.사유);
      const 이어짐 = 꼬리(줄들, i);
      const clean = 이어짐 ? `${판정.clean} ${stripMd(이어짐)}`.trim() : 판정.clean;
      if (판정.앞글자 >= 조각_앞문턱 && 글자수(clean.replace(/⏳/g, '')) < 조각_뒤문턱) {
        조각들.push({ topic: f.replace(/\.md$/, ''), line: i + 1, 배달: clean, 원문: line.trim().slice(0, MAX_LEN) });
      }
      배달 += 1;
      items.push({
        topic: f.replace(/\.md$/, ''),
        line: i + 1,
        text: clean.length > MAX_LEN ? clean.slice(0, MAX_LEN - 1) + '…' : clean,
        // 원문 그대로 — 주간 한 장이 이걸 지문으로 삼아 **행 번호가 아니라 내용으로** 다시 찾는다.
        // 메모리는 세션 여럿이 동시에 고쳐 한 주 안에 행 번호가 반드시 밀린다.
        raw: line,
        mtime,
        notBefore: gateDate(clean),   // null이면 지금 배달 대상
      });
    });
    if (절제목.length && !배달) 절뿐.push({ topic: f.replace(/\.md$/, ''), 제목: 절제목 });
  }
  /* 열거 불가로 얹는다 — 그냥 대입하면 `deepStrictEqual(extract(d), [])` 하는 기존 검사가
   * 배열의 own 열거 속성을 함께 세서 깨진다(결정큐_코드스팬 실측). 반환 형태 불변이 조건이었다. */
  Object.defineProperty(items, '버려진', { value: 버려진 });
  Object.defineProperty(items, '절뿐', { value: 절뿐 });
  Object.defineProperty(items, '조각', { value: 조각들 });
  return items;
}

/* ── 검토 끝난 폐기함 줄 (2026-08-08 · F255) ───────────────────────────────
 * 폐기함 경고의 처방은 「걸러진 89줄에 진짜 미결이 섞였는지 확인」이었다. cleanup:128 이
 * 이미 그 전수 확인을 **실행 불가**로 판정하고(「실행 불가능한 분량의 확인 요구는 확인 0회와
 * 같은 모양이다」) 「다음 세션은 새로 늘어난 줄만 본다」로 바꿨는데 — **무엇이 새 줄인지 세는
 * 상태가 없어** 5일간 같은 전량이 다시 떴다. 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 *
 * 🔑 지문은 줄 번호가 아니라 **토픽+본문**이다: 메모리는 세션 여럿이 동시에 고쳐 행 번호가
 *    반드시 밀리고(--한장 이 같은 이유로 내용 지문을 쓴다), 본문이 바뀌면 다시 떠야 한다
 *    — 바뀐 줄은 다시 볼 값이 있다. 파일이 없으면 전부 새 줄 = **더 보이는 쪽으로 떨어진다.**
 * ⚠ append 전용 한 파일이라 동시 편집이 나도 양쪽 줄을 다 남기면 끝난다(순서 무의미). */
const 검토완료파일 = path.join(__dirname, '..', 'docs', '_ops', '결정큐_검토완료.txt');
const 폐기지문 = (it) => 지문(`${it.topic}|${it.text}`);
// 도장이 **명시적으로** 찍힌 것만 옛것이다 — 플래그를 안 단 호출부는 보이는 쪽으로 떨어진다
const 새것인가 = (it) => it.새것 !== false;
function 검토완료읽기(파일) {
  try {
    return new Set(
      fs.readFileSync(파일 || 검토완료파일, 'utf8')
        .split('\n').map((l) => l.trim().split(/\s/)[0])
        .filter((s) => /^[0-9a-f]{10}$/.test(s))
    );
  } catch { return new Set(); }
}

/* ── 차단자를 큐 항목으로 ───────────────────────────────────────────────────
 * '막힘>' 그래프에서 답해야 할 것은 **차단자**(결정-동의문구-몽골어병기 같은 것)이지
 * 그걸 기다리는 토픽이 아니다. 기다리는 토픽의 ⏳ 줄에 「이걸 풀면 3건 풀림」을 붙이면
 * **그 줄과 무관한 공로를 그 줄에 얹는 거짓말**이 된다(참인 채 거짓을 말하는 표시 —
 * memory report-card-public-link의 교훈). 차단자는 차단자대로 한 줄을 갖는다.
 */
function blockerItems(blockers) {
  return blockers
    .filter((b) => b.unblocks > 0)
    .map((b) => ({
      topic: b.blocker,
      line: 0,
      text: `${b.blocker.replace(/-/g, ' ')} — 이 결정을 기다리는 트랙: ${b.items.join(', ')}`,
      // 차단자는 항상 위. Infinity를 쓰면 차단자 둘을 비교할 때 Infinity-Infinity=NaN이라
      // 정렬이 불안정해진다(같은 입력에 다른 순서 → 회전이 날마다 튄다). 유한한 큰 값으로.
      mtime: Number.MAX_SAFE_INTEGER,
      unblocks: b.unblocks,
    }));
}

/* ── 순위 ──────────────────────────────────────────────────────────────────
 * 1순위 = 차단자(명시된 의존이라 가장 단단한 근거) · 2순위 = 최근 손댄 토픽.
 */
function rank(items, blockers) {
  const all = [...blockerItems(blockers), ...items.map((it) => ({ ...it, unblocks: 0 }))];
  return all.sort((a, b) => b.unblocks - a.unblocks || b.mtime - a.mtime || a.topic.localeCompare(b.topic));
}

/* ── 회전 ──────────────────────────────────────────────────────────────────
 * 같은 3건만 계속 나오면 나머지는 영영 안 보인다. 날짜를 걸음 수로 써서
 * 큐 전체를 한 바퀴 돌린다 — 순위는 시작점을 정할 뿐 독점하지 않는다.
 * 단 차단자가 걸린 항목은 회전과 무관하게 **항상 맨 앞에 한 자리**를 갖는다.
 */
function todayIndex(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
}

function pick(ranked, count, date) {
  if (!ranked.length) return [];
  const out = [];
  const usedTopics = new Set();
  // 차단자 한 자리 고정 — 날짜와 무관하게 늘 보인다
  const pinned = ranked.find((r) => r.unblocks > 0);
  if (pinned) { out.push(pinned); usedTopics.add(pinned.topic); }

  // 나머지는 회전. 같은 토픽이 하루치를 독점하면 3건이 사실상 1건이 되므로 토픽당 1건만.
  const rest = ranked.filter((r) => r !== pinned);
  if (rest.length) {
    const offset = todayIndex(date) % rest.length;
    for (let pass = 0; pass < 2 && out.length < count; pass++) {
      // 1차: 토픽 중복 없이 / 2차: 그래도 모자라면 중복 허용(항목 수가 적을 때)
      for (let i = 0; i < rest.length && out.length < count; i++) {
        const it = rest[(offset + i) % rest.length];
        if (out.includes(it)) continue;
        if (pass === 0 && usedTopics.has(it.topic)) continue;
        out.push(it); usedTopics.add(it.topic);
      }
    }
  }
  return out;
}

function build(opts = {}) {
  const dir = opts.dir || memoryDir();
  const date = opts.date || new Date();
  const count = opts.count || 3;
  const items = extract(dir);
  let blockers = [];
  try {
    const nodes = load(dir); // Map 또는 null을 그대로 돌려준다
    if (nodes) {
      blockers = (decisions(nodes).ranked || []).map((r) => ({
        blocker: r.blocker, unblocks: r.unblocks, items: r.items || [],
      }));
    }
  } catch { /* 그래프를 못 읽어도 큐 자체는 나와야 한다 */ }
  // 날짜 게이트: 아직 때가 안 된 항목은 큐에서 빼되 **버리지 않는다**(scheduled로 남는다)
  const now = dayStart(date);
  const due = items.filter((it) => it.notBefore === null || it.notBefore <= now);
  const scheduled = items
    .filter((it) => it.notBefore !== null && it.notBefore > now)
    .sort((a, b) => a.notBefore - b.notBefore);
  const ranked = rank(due, blockers);
  // 폐기함은 「검토했다」 도장을 달고 나간다 — 전량은 안 줄고, 봐야 할 것만 새것으로 뜬다
  const 완료 = 검토완료읽기(opts.검토완료);
  const 버려진 = (items.버려진 || []).map((it) => ({ ...it, 새것: !완료.has(폐기지문(it)) }));
  return { total: ranked.length, ranked, today: pick(ranked, count, date), blockers, scheduled, 버려진, 절뿐: items.절뿐 || [], 조각: items.조각 || [] };
}

/* 걸러진 ⏳ 한 줄 — 목록은 --버려진 에 있다.
 * [2026-08-07 · F173] 이 주석은 원래 「세션 시작 훅이 이 출력을 그대로 보여준다」였는데 **거짓이었다**:
 * session-decisions 훅은 render() 를 안 쓰고 자기 텍스트를 다시 조립하느라 이 한 줄만 빠졌고,
 * 그래서 매 세션 유일하게 읽히는 화면에는 폐기함이 **한 번도** 안 떴다(보안 제안 1건이 이틀간 안 보였다).
 * 판정을 두 곳에 적으면 갈라진다(신뢰성 ④) — 훅은 이 함수를 require 해 같은 문구를 쓴다. export 필수. */
function 버려진줄(r) {
  const 줄 = [];
  const n = (r.버려진 || []).length;
  // 분모를 같이 낸다 — 「0줄 새로」와 「폐기함이 안 돌았다」가 같은 모양이면 안 된다(F207)
  const 새 = (r.버려진 || []).filter(새것인가).length;
  if (새) 줄.push(`⚠ ⏳ ${새}줄이 **새로** 걸러졌다(전체 ${n} · 검토완료 ${n - 새}) — 진짜 미결이 섞였는지 확인: node tools/decision-queue.js --버려진`);
  /* 폐기함과 **다른 칸**이다: 저건 「걸렀다」고 기록은 남은 줄이고, 이건 「그 파일이 결정을
   * 내걸어 놓고 아무것도 못 낸다」는 파일 단위 신호다. 한 줄로 합치면 34가 76에 묻힌다. */
  const s = (r.절뿐 || []).length;
  if (s) 줄.push(`⚠ ⏳ 절 제목만 걸고 **배달 0건**인 파일 ${s}개 — 그 결정은 유호님께 안 간다: node tools/decision-queue.js --절`);
  /* 셋째 칸 — 배달은 되는데 **답할 수 없는 껍데기**인 줄(재료가 표식 앞에서 잘렸다).
   * 위 둘과 다른 축이라 합치지 않는다: 저건 「안 나간다」, 이건 「나가는데 빈손이다」. */
  const f = (r.조각 || []).length;
  if (f) 줄.push(`⚠ ⏳ 항목 ${f}건이 **재료를 표식 앞에 두고 꼬리만** 배달된다 — 받아도 답할 수 없다. 그 줄을 「설명 줄 + ⏳질문 전문 줄」로 가른다: node tools/decision-queue.js --조각`);
  return 줄.join('\n  ');
}

function render(r, date) {
  // 미결 0인데 걸러진 게 있으면 「없다」가 아니라 「안 보인다」다 — 그때는 경고만 낸다
  if (!r.total) return 버려진줄(r);   // 둘 다 없으면 빈 출력 = 헤르메스가 조용히 넘어간다
  const d = date || new Date();
  const p = (n) => String(n).padStart(2, '0');
  const lines = [`🗳 오늘의 결정 ${r.today.length}건 (미결 ${r.total}건 · ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())})`, ''];
  r.today.forEach((it, i) => {
    const head = it.unblocks > 0
      ? `⛔ 막고 있는 결정 — 풀면 ${it.unblocks}건이 함께 풀립니다`
      : `[${it.topic}]`;
    lines.push(`${i + 1}. ${head}`);
    lines.push(`   ${it.text}`);
    lines.push('');
  });
  lines.push('답은 이 방에 그냥 쓰시면 됩니다 — 다음 작업 때 클로드가 읽고 반영합니다.');
  const 경고 = 버려진줄(r);
  if (경고) lines.push('', 경고);
  return lines.join('\n');
}

/* ── 주간 한 장 (2026-08-06 · 유호님 채택) ────────────────────────────────
 * **큐는 배달로 줄지 않는다. 닫아야 준다.** 실측: 08-05 손 대청소 직후 42건이 하루 만에
 * 52건이 됐는데 노출은 하루 3건이라 한 바퀴에 13일이 걸리고 그 사이 더 쌓인다 —
 * 이 설계로는 원리적으로 못 따라잡는다. 유호님 「너무 많이 뜨고 뒤죽박죽」은 구조였다.
 * 그래서 주 1회 전량을 한 장으로 내고 **유호님은 끝난 번호만** 쓴다.
 *
 * 🔑 번호는 그 장에만 유효하다 — 닫을 때는 번호로 줄을 찾지 않고 **줄 지문으로 다시 찾는다.**
 *    (CLAUDE.md: 행 번호·좌표는 근거가 아니다. 승인은 행위에 대한 것이지 조준이 아니다.)
 *    지문이 하나로 안 떨어지면 **닫지 않고 사유를 말한다** — 엉뚱한 결정을 닫는 것이
 *    안 닫는 것보다 훨씬 나쁘다.
 * 🔑 원문을 지우지 않는다 — ⏳를 ✅로 바꾸고 확정일만 덧붙인다. 되돌림은 ✅→⏳ 한 수고,
 *    한 장은 git 추적이라 닫기 전 문장이 이력에 남는다(메모리 폴더는 git 밖이다).
 */
const SHEET = path.join(__dirname, '..', 'docs', '_ops', '결정큐_한장.md');
const SHEET_LEN = 160;   // 폰 한 줄에 들어가는 길이. 전문은 메모리 토픽에 그대로 있다
const 주기일 = 7;

function 지문(raw) {
  return crypto.createHash('sha1').update(String(raw == null ? '' : raw).trim()).digest('hex').slice(0, 10);
}

/** 한 장 본문 — 번호로 닫을 수 있는 것은 **실제 메모리 줄**뿐이다(차단자는 그래프 파생이라 줄이 없다)
 *
 * 🔑 **번호는 다시 발행해도 안 바뀐다.** 유호님 답은 텔레그램 수거를 30분마다 타고 늦게 오는데,
 *    그 사이 아무 세션이나 `--한장`을 다시 내면(훅이 7일마다 시킨다) 옛 번호가 **다른 결정**을
 *    가리킨다. 지문은 시트↔메모리만 검사하지 **유호님이 든 사본**은 검사하지 못해 새 시트 기준으로
 *    그대로 맞는다 — 실측: 새 토픽 하나가 알파벳 앞에 들어오자 「2번 완료」가 [c] 대신 [b]를 닫고
 *    `ok=true`로 지나갔다(회귀 「재발행해도 번호는 그 결정을 계속 가리킨다」).
 *    그래서 번호를 지문에 고정하고 **닫힌 번호는 다시 쓰지 않는다**(재사용이 이 버그를 되살린다).
 *    번호가 띄엄띄엄해지므로 줄머리를 `N.`(ol) 이 아니라 **불릿+`**N.**`** 로 낸다 —
 *    ol 은 렌더러가 1부터 다시 매겨 **틈이 안 보이고 번호가 또 밀린다**(GitHub·폰 미리보기).
 * @param {{이전?: string}} opts  이전 한 장 경로. **생략하면 정본(SHEET)** 을 읽는다 —
 *   `null`·`''` 도 정본으로 떨어지므로(시트읽기의 `파일 || SHEET`) 「없음」을 뜻하려면
 *   없는 경로를 준다. 테스트는 자기 픽스처 경로를 줘야 실저장소에 안 매달린다.
 */
function 한장(r, date, opts = {}) {
  const d = date || new Date();
  const 닫을수있는것 = r.ranked.filter((it) => it.raw && it.line > 0);
  const 차단자 = r.ranked.filter((it) => !it.raw || it.line <= 0);
  const 이전 = 시트읽기(opts.이전 === undefined ? SHEET : opts.이전);
  const 예약 = new Map();   // "topic|지문" → 이미 나간 번호
  let 최대 = 0;
  if (이전) for (const [n, v] of 이전.map) { 예약.set(`${v.topic}|${v.지문}`, n); if (n > 최대) 최대 = n; }
  const lines = [
    '# 결정 큐 — 주간 한 장',
    '',
    `> **발행 ${ymd(d)}** · 미결 **${닫을수있는것.length}건**` +
      (r.scheduled && r.scheduled.length ? ` · 예약 ${r.scheduled.length}건(날짜가 되면 여기 올라온다)` : ''),
    '>',
    '> **끝난 번호만 쓰시면 됩니다.** 예) `3,7,12 완료`  → 클로드가 그 줄들을 닫습니다.',
    '> 답이 필요한 것은 번호 옆에 그냥 쓰셔도 됩니다. 아무것도 안 쓰셔도 큐는 그대로 남습니다.',
    '> **번호는 다시 발행해도 그대로입니다** — 며칠 뒤에 답하셔도 그 번호가 그 결정을 가리킵니다(닫힌 번호는 빠져서 중간이 비어 보입니다).',
    '',
    '<!-- 이 파일은 `node tools/decision-queue.js --한장` 이 다시 만든다. 손으로 고치지 않는다. -->',
    '',
  ];
  닫을수있는것
    .slice()
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.line - b.line)
    .map((it) => {
      const fp = 지문(it.raw);
      return { it, fp, n: 예약.get(`${it.topic}|${fp}`) || ++최대 };   // 처음 보는 줄만 새 번호를 받는다
    })
    .sort((a, b) => a.n - b.n)
    .forEach(({ it, fp, n }) => {
      const 몸통 = it.text.replace(/^⏳\s*/, '');
      const 접힘 = 몸통.length > SHEET_LEN ? 몸통.slice(0, SHEET_LEN - 1) + '…' : 몸통;
      lines.push(`- **${n}.** **[${it.topic}]** ${접힘} <!--q:${it.topic}|${fp}-->`);
    });
  if (차단자.length) {
    lines.push('', '## ⛔ 먼저 풀면 여러 개가 함께 풀리는 것 (번호 없음 — 말로 답해 주세요)', '');
    차단자.forEach((it) => lines.push(`- ${it.text}`));
  }
  lines.push('');
  return lines.join('\n');
}

/** 한 장에서 번호 → {topic, 지문} 을 읽는다 */
function 시트읽기(파일) {
  const p = 파일 || SHEET;
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const map = new Map();
  // 불릿+굵은 번호가 지금 판, 맨 `N.` 은 옛 판(ol). 옛 판도 읽어야 **이미 나간 한 장의 번호가
  // 이어진다** — 못 읽으면 예약이 비어 전 항목이 1부터 다시 매겨지고, 그게 이 함수가 막는 사고다.
  for (const m of text.matchAll(/^\s*(?:[-*]\s+\*\*)?(\d+)\.(?:\*\*)?\s[\s\S]*?<!--q:(.+?)\|([0-9a-f]+)-->/gm)) {
    map.set(Number(m[1]), { topic: m[2], 지문: m[3] });
  }
  const 발행 = (text.match(/\*\*발행 (\d{4}-\d{2}-\d{2})\*\*/) || [])[1] || null;
  return { text, map, 발행 };
}

/** 번호들을 닫는다 — 지문으로 다시 찾고, 하나로 안 떨어지면 그 번호는 건너뛴다 */
function 닫음(numbers, opts = {}) {
  const dir = opts.dir || memoryDir();
  const date = opts.date || new Date();
  const sheet = 시트읽기(opts.sheet);
  if (!sheet) return { error: '주간 한 장이 없다 — 먼저 `node tools/decision-queue.js --한장`' };
  const 결과 = [];
  for (const n of numbers) {
    const 대상 = sheet.map.get(n);
    if (!대상) { 결과.push({ n, ok: false, 사유: '그 번호가 한 장에 없다' }); continue; }
    const full = path.join(dir, `${대상.topic}.md`);
    if (!fs.existsSync(full)) { 결과.push({ n, ok: false, 사유: `토픽 파일이 없다: ${대상.topic}` }); continue; }
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    const hits = [];
    lines.forEach((l, i) => { if (l.includes('⏳') && 지문(l) === 대상.지문) hits.push(i); });
    if (hits.length !== 1) {
      결과.push({
        n, ok: false, topic: 대상.topic,
        사유: hits.length === 0
          ? '그 줄이 그 사이 바뀌었거나 이미 닫혔다 — `--한장`으로 다시 발행하고 번호를 다시 고른다'
          : `같은 줄이 ${hits.length}개라 어느 것인지 못 가른다 — 손으로 닫는다`,
      });
      continue;
    }
    const i = hits[0];
    const 원문 = lines[i];
    const cr = 원문.endsWith('\r') ? '\r' : '';   // CRLF 파일에서 덧붙임이 개행 뒤로 가지 않게
    const 몸통 = cr ? 원문.slice(0, -1) : 원문;
    lines[i] = `${몸통.replace(/⏳/g, '✅')} — 유호님 확정 ${ymd(date)}(주간 한 장)${cr}`;
    fs.writeFileSync(full, lines.join('\n'));
    결과.push({ n, ok: true, topic: 대상.topic, 원문: 몸통.trim(), 새줄: lines[i].replace(/\r$/, '').trim() });
  }
  return { 결과 };
}

/** 한 장이 밀렸나 — 세션 시작 훅이 이걸로 스스로 발화한다 */
function 한장밀림(date, 파일) {
  const s = 시트읽기(파일);
  if (!s || !s.발행) return { 밀림: true, 지난날: null };
  // ⚠ `Z` 를 빼면 로컬로 파싱되는데 dayStart 는 **UTC 성분**을 읽어 하루가 밀린다(회귀가 잡았다).
  const 지난날 = Math.floor((dayStart(date || new Date()) - dayStart(new Date(`${s.발행}T00:00:00Z`))) / 86400000);
  return { 밀림: 지난날 >= 주기일, 지난날 };
}

function main() {
  const args = process.argv.slice(2);
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다. */
  const 아는플래그 = ['--all', '--count', '--json', '--닫음', '--버려진', '--전체', '--절', '--조각', '--한장', '--확인'];
  const 플래그오류 = 인자게이트('decision-queue', args, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const ci = args.indexOf('--count');
  const count = ci >= 0 ? Number(args[ci + 1]) || 3 : 3;
  const r = build({ count });
  if (args.includes('--json')) return console.log(JSON.stringify(r, null, 2));
  if (args.includes('--버려진')) {
    const 새것 = r.버려진.filter(새것인가);
    if (args.includes('--확인')) {
      if (!새것.length) return console.log('\n[걸러진 ⏳] 새로 걸러진 줄이 없다 — 표시할 것이 없다\n');
      const 머리 = fs.existsSync(검토완료파일) ? '' :
        '# 폐기함에서 「진짜 미결이 아니다」로 확인한 줄의 지문(토픽|본문 sha1 앞 10자).\n' +
        '# `node tools/decision-queue.js --버려진 --확인` 이 덧붙인다. 본문이 바뀌면 지문이 달라져 다시 뜬다.\n';
      fs.appendFileSync(검토완료파일, 머리 + 새것.map((it) => `${폐기지문(it)}  ${it.topic}:${it.line}`).join('\n') + '\n');
      return console.log(`\n[걸러진 ⏳] ${새것.length}줄을 검토 완료로 표시했다 → ${path.relative(path.join(__dirname, '..'), 검토완료파일)}\n`);
    }
    const 전체 = args.includes('--전체');
    const 대상 = 전체 ? r.버려진 : 새것;
    if (!대상.length) return console.log(`\n[걸러진 ⏳] 새로 걸러진 줄 0건 (검토완료 ${r.버려진.length} · 전량은 --전체)\n`);
    console.log(`\n[걸러진 ⏳] ${대상.length}건${전체 ? '' : ` 새로 (전체 ${r.버려진.length} · 검토완료 ${r.버려진.length - 새것.length})`} — 큐에 없다.`
      + '\n  진짜 미결이면 ⏳를 줄머리나 구분자(·:) 뒤로 옮긴다. 다 보고 나서 --확인 을 붙이면 다음부터 안 뜬다.\n');
    대상.forEach((it) => console.log(`     [${it.topic}:${it.line}] ${it.사유}\n     ${it.text}`));
    return;
  }
  if (args.includes('--절')) {
    if (!r.절뿐.length) return console.log('\n[⏳ 절 제목만 · 배달 0건] 0파일\n');
    console.log(`\n[⏳ 절 제목만 · 배달 0건] ${r.절뿐.length}파일 — 살아있으면 ⏳를 절 아래 «항목 줄»로 내리고, 끝났으면 제목의 ⏳를 ✅로 닫는다\n  (제목이 기호를 «말하기만» 하는 경우 — 「위 ⏳ 는 실행됐다」 — 는 백틱을 씌운다: \`⏳\`)\n`);
    r.절뿐.forEach((it) => it.제목.forEach((h) => console.log(`     [${it.topic}:${h.line}]\n     ${h.text}`)));
    return;
  }
  if (args.includes('--조각')) {
    if (!r.조각.length) return console.log('\n[⏳ 꼬리 조각] 0건\n');
    console.log(`\n[⏳ 꼬리 조각] ${r.조각.length}건 — 재료가 표식 앞에서 잘려 껍데기만 배달된다. 그 줄을 「설명 줄 + ⏳질문 전문 줄」로 가른다\n`);
    r.조각.forEach((it) => console.log(`     [${it.topic}:${it.line}] 배달되는 것: ${it.배달}\n     원문: ${it.원문}`));
    return;
  }
  if (args.includes('--all')) {
    console.log(`\n[결정 큐] 미결 ${r.total}건 — 순위대로\n`);
    r.ranked.forEach((it, i) => {
      const tag = it.unblocks > 0 ? ` ⛔${it.unblocks}건 해소` : '';
      console.log(`${String(i + 1).padStart(3)}. [${it.topic}]${tag}\n     ${it.text}`);
    });
    // 날짜 게이트로 미뤄 둔 것 — 안 보이면 「없다」와 구별이 안 된다
    if (r.scheduled && r.scheduled.length) {
      console.log(`\n[예약] ${r.scheduled.length}건 — 아직 때가 아니라 배달하지 않는다\n`);
      r.scheduled.forEach((it) => {
        const d = new Date(it.notBefore).toISOString().slice(0, 10);
        console.log(`     ${d}부터 · [${it.topic}]\n     ${it.text}`);
      });
    }
    // [2026-08-07 · F173] 폐기함도 여기 낸다 — `--all` 은 「전부 보여달라」인데 걸러진 것만 빠지면
    // 그 전량이 「이게 전부다」로 읽힌다(바로 위 예약 줄과 같은 이유다). 옆 세션 b6cb681a 가 지목.
    const 경고 = 버려진줄(r);
    if (경고) console.log(`\n${경고}`);
    return console.log('');
  }
  if (args.includes('--한장')) {
    const 본문 = 한장(r, new Date());
    fs.mkdirSync(path.dirname(SHEET), { recursive: true });
    fs.writeFileSync(SHEET, 본문);
    // 파일엔 지문을 남기고 **화면에서는 지운다** — 유호님이 읽는 물건에 기계용 표식이 섞이면 안 된다
    console.log(본문.replace(/ <!--q:.*?-->/g, '').replace(/^<!--[\s\S]*?-->\n\n/m, ''));
    console.log(`\n[한 장] ${path.relative(path.join(__dirname, '..'), SHEET)} 에 발행했다 — 끝난 번호를 받으면 \`--닫음 3,7,12\``);
    return;
  }
  const ci2 = args.indexOf('--닫음');
  if (ci2 >= 0) {
    const nums = String(args[ci2 + 1] || '').split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (!nums.length) return console.log('닫을 번호가 없다 — 예) node tools/decision-queue.js --닫음 3,7,12');
    const out = 닫음(nums);
    if (out.error) return console.log(out.error);
    // 닫은 줄 **전문**을 보여준다 — 한 장은 접혀 있어 유호님이 뒷부분을 못 봤을 수 있다(조준 확인)
    out.결과.forEach((r2) => {
      if (r2.ok) console.log(`✅ ${r2.n} [${r2.topic}]\n   닫기 전: ${r2.원문}\n   닫은 뒤: ${r2.새줄}\n`);
      else console.log(`⚠ ${r2.n} 못 닫음 — ${r2.사유}\n`);
    });
    const 성공 = out.결과.filter((r2) => r2.ok).length;
    console.log(`[닫음] ${성공}/${out.결과.length}건 — 되돌리려면 그 줄의 ✅를 ⏳로 되돌린다`);
    return;
  }
  const out = render(r);
  if (out) console.log(out);
}

if (require.main === module) main();
module.exports = {
  extract, rank, pick, build, render, stripMd, todayIndex, markerClause, gateDate, 줄판정, 버려진줄,
  폐기지문, 검토완료읽기,
  한장, 시트읽기, 닫음, 지문, 한장밀림, SHEET, 주기일,
};
