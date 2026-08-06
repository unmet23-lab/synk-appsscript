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
//   SYNK_MEMORY_DIR=... 로 대상 디렉터리 덮어쓰기(테스트용)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { memoryDir, load, decisions } = require('./memory-graph.js');

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

const INDEX = 'MEMORY.md'; // 인덱스는 지도라 본문이 중복된다 — 큐에서 제외한다
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
    .replace(/\[\[[^\]|>]*>?([^\]]*)\]\]/g, '$1') // [[막힘>x]] → x
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
   * 항목은 불릿·문단으로 쓴다. 헤더 아래 실제 항목이 있으면 그게 배달된다. */
  if (/^\s{0,3}#{1,6}\s/.test(line)) return null;
  const masked = markerClause(stripMd(maskCodeSpans(line)));
  if (masked === null) return { 사유: '문장 속 지시어로 판정' };
  const clean = unmaskCodeSpans(masked);
  // 범례("💡새 / 🔍검토 / ⏳판단대기 / ✅채택")는 항목이 아니다. 단 판별은 **⏳ 바로 옆 모양**으로만 한다 —
  // 첫 판은 「줄 어딘가에 🔍가 있고 '/'가 있으면 범례」로 봤는데, 긴 메모리 줄은 경로·날짜에 '/'가
  // 흔하고 🔍도 본문에 쓰여서 **진짜 미결이 조용히 사라졌다**(실측 2건). 넓은 가드가 큐를 줄이면
  // 아무도 눈치채지 못한다 — 거짓양성보다 이쪽이 나쁘다.
  if (/^⏳\S*\s*\/\s*[💡🔍✅⚠🚫]/.test(clean)) return { 사유: '범례로 판정' };
  // 장식뿐인 줄(「## ⏳」 같은 헤더)만 거른다. **길이가 아니라 글자 수로 센다** —
  // 길이로 재면 `##` 같은 기호가 통과하고, 하한을 올리면 「⏳ 티원」 같은
  // 짧은 한국어 항목이 통째로 사라진다(한글은 2글자로도 완결된 항목이다).
  if (clean.replace(/⏳/g, '').replace(/[^\p{L}\p{N}]/gu, '').length < 2) return { 사유: '장식뿐인 줄로 판정' };
  return { clean };
}

// 괄호 안의 ⏳는 양쪽 다 실재한다 — 여는 괄호만 보고는 못 가른다:
//   "(⏳유호 승인 대기·미검증 출처 명기)."  ← 괄호 자체가 항목이다
//   "(⏳ 미결 다수)일 가능성. 그렇다면 …"    ← 문장이 괄호 뒤로 이어진다 = 지시어
// 가르는 것은 **괄호가 닫힌 뒤에 문장이 계속되는가**다.
function parenIsItem(clean, i) {
  const close = clean.indexOf(')', i);
  if (close === -1) return true;                 // 안 닫히면 줄 끝까지가 항목이다
  return clean.slice(close + 1).trim().length <= 2; // 뒤에 문장이 남으면 지시어
}

function markerClause(clean) {
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] !== '⏳') continue;
    let j = i - 1;
    while (j >= 0 && /\s/.test(clean[j])) j--;
    if (j < 0 || MARKER_PREV.has(clean[j])) return clean.slice(i).trim();
    if (clean[j] === '(' && parenIsItem(clean, i)) return clean.slice(i).trim();
  }
  return null;
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
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== INDEX)) {
    const full = path.join(dir, f);
    const text = fs.readFileSync(full, 'utf8');
    // 자동 생성된 역링크 구간은 큐가 아니다
    const body = text.split('<!-- memory-graph:역링크 시작')[0];
    const mtime = fs.statSync(full).mtimeMs;
    body.split('\n').forEach((line, i) => {
      const 판정 = 줄판정(line);
      if (!판정) return;
      if (판정.사유) return 버린다(f, i, line, 판정.사유);
      const clean = 판정.clean;
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
  }
  /* 열거 불가로 얹는다 — 그냥 대입하면 `deepStrictEqual(extract(d), [])` 하는 기존 검사가
   * 배열의 own 열거 속성을 함께 세서 깨진다(결정큐_코드스팬 실측). 반환 형태 불변이 조건이었다. */
  Object.defineProperty(items, '버려진', { value: 버려진 });
  return items;
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
  return { total: ranked.length, ranked, today: pick(ranked, count, date), blockers, scheduled, 버려진: items.버려진 || [] };
}

/* 걸러진 ⏳ 한 줄 — 목록은 --버려진 에 있다.
 * [2026-08-07 · F173] 이 주석은 원래 「세션 시작 훅이 이 출력을 그대로 보여준다」였는데 **거짓이었다**:
 * session-decisions 훅은 render() 를 안 쓰고 자기 텍스트를 다시 조립하느라 이 한 줄만 빠졌고,
 * 그래서 매 세션 유일하게 읽히는 화면에는 폐기함이 **한 번도** 안 떴다(보안 제안 1건이 이틀간 안 보였다).
 * 판정을 두 곳에 적으면 갈라진다(신뢰성 ④) — 훅은 이 함수를 require 해 같은 문구를 쓴다. export 필수. */
function 버려진줄(r) {
  const n = (r.버려진 || []).length;
  return n ? `⚠ ⏳ ${n}줄이 항목이 아닌 것으로 걸러졌다 — 진짜 미결이 섞였는지 확인: node tools/decision-queue.js --버려진` : '';
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

/** 한 장 본문 — 번호로 닫을 수 있는 것은 **실제 메모리 줄**뿐이다(차단자는 그래프 파생이라 줄이 없다) */
function 한장(r, date) {
  const d = date || new Date();
  const 닫을수있는것 = r.ranked.filter((it) => it.raw && it.line > 0);
  const 차단자 = r.ranked.filter((it) => !it.raw || it.line <= 0);
  const lines = [
    '# 결정 큐 — 주간 한 장',
    '',
    `> **발행 ${ymd(d)}** · 미결 **${닫을수있는것.length}건**` +
      (r.scheduled && r.scheduled.length ? ` · 예약 ${r.scheduled.length}건(날짜가 되면 여기 올라온다)` : ''),
    '>',
    '> **끝난 번호만 쓰시면 됩니다.** 예) `3,7,12 완료`  → 클로드가 그 줄들을 닫습니다.',
    '> 답이 필요한 것은 번호 옆에 그냥 쓰셔도 됩니다. 아무것도 안 쓰셔도 큐는 그대로 남습니다.',
    '',
    '<!-- 이 파일은 `node tools/decision-queue.js --한장` 이 다시 만든다. 손으로 고치지 않는다. -->',
    '',
  ];
  닫을수있는것
    .slice()
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.line - b.line)
    .forEach((it, i) => {
      const 몸통 = it.text.replace(/^⏳\s*/, '');
      const 접힘 = 몸통.length > SHEET_LEN ? 몸통.slice(0, SHEET_LEN - 1) + '…' : 몸통;
      lines.push(`${i + 1}. **[${it.topic}]** ${접힘} <!--q:${it.topic}|${지문(it.raw)}-->`);
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
  for (const m of text.matchAll(/^\s*(\d+)\.\s[\s\S]*?<!--q:(.+?)\|([0-9a-f]+)-->/gm)) {
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
  const ci = args.indexOf('--count');
  const count = ci >= 0 ? Number(args[ci + 1]) || 3 : 3;
  const r = build({ count });
  if (args.includes('--json')) return console.log(JSON.stringify(r, null, 2));
  if (args.includes('--버려진')) {
    if (!r.버려진.length) return console.log('\n[걸러진 ⏳] 0건\n');
    console.log(`\n[걸러진 ⏳] ${r.버려진.length}건 — 큐에 없다. 진짜 미결이면 ⏳를 줄머리나 구분자(·:) 뒤로 옮긴다\n`);
    r.버려진.forEach((it) => console.log(`     [${it.topic}:${it.line}] ${it.사유}\n     ${it.text}`));
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
  한장, 시트읽기, 닫음, 지문, 한장밀림, SHEET, 주기일,
};
