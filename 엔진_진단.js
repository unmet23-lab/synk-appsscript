'use strict';
/**
 * 급수 진단 「내 TOPIK, 지금 몇 급?」 — 엔진 (정본 = `docs/급수진단_설계_v1.md` · 문항 = `contents_진단문항.js`).
 *
 * ■ 무엇인가
 *   처음 만난 몽골 유학생이 15분 안에 «우리 학원 기준» 급수를 알고, 우리는 그 사람이 어디가 약한지 알아낸다.
 *   같은 자로 8주 뒤(중간 12-20 · 끝 01-24)에 다시 잰다 — 「8주 뒤 진단 급수가 안 오르면 다음 8주 무료」의 자다.
 *
 * ■ 화면은 여기 없다 — 🔴 이 웹앱은 익명 공개(ANYONE_ANONYMOUS)라 HtmlService 화면을 «절대» 못 낸다
 *   (`상담AI.js` doGet 머리말 · 2026-08-03 보안 철회). 화면은 사이트(synk.im · 정적 지면)가 그리고, 여기는
 *   **JSON 통로**(`진단API_` · ContentService)만이다. 정답은 통로로 안 나간다(스냅샷에만 남는다).
 *
 * ■ 사다리(설계 §④-㉠) — 3급에서 시작. 여섯 중 다섯(0.8)을 맞히면 4급으로. 4급도 통과하면 「4급 이상」(5급 은행 없음).
 *   3급 미달이면 「더 아래 · 안 쟀다」 — 2급 은행이 없어 급수를 «안 붙인다»(안 잰 것을 잰 것처럼 적지 않는다 · §③-㉤).
 *
 * ■ 기준판(설계 §⑤-㉡) = 넷을 묶은 문자열 하나 `DIAG_RULER_VER` — ①문항 은행 판 ②문턱 ③급마다 고른 문형 여섯 ④짝 규칙.
 *   넷 중 하나라도 바뀌면 이 문자열을 올린다. 등록하는 날 그 사람에게 판을 못박고(`진단잇기_`), 중간·끝은 못박은 판을 쓴다.
 *   판이 갈리면 「기준판갈림」을 상태에 남긴다 — 조용히 새 판으로 재지 않는다.
 *
 * ■ 최초 답 보존(설계 §⑥) — 한 급의 첫 제출은 «시도 1» 로 잠기고, 다시 내면 시도 2 로 «덧붙는다». 표본 급수는 시도 1 만 본다.
 *   같은 제출이 두 번 오면(멱등열쇠 같음) 저장한 결과를 그대로 돌려준다.
 *
 * ■ 순수 함수(`진단채점_`·`진단스냅샷_`·`진단코드_`)와 시트 함수(`진단시작_` 부터)를 가른다 — 시험은 순수 함수를 직접 태운다.
 */

const DIAG_GATE = 0.8;                       // 진단 전용 문턱 — TOPIK_PEAK_GATE 와 «같은 뜻, 다른 상수»(한쪽을 고칠 때 다른 쪽이 조용히 안 따라가게)
const DIAG_LADDER = [3, 4];                  // 사다리 — 은행이 있는 급만. 1·2·5급 은행이 서면 여기에 더한다(그때 기준판이 오른다)
const DIAG_RULER_VER = 'diag-r1-2026-09-07'; // 기준판 — 은행판(contents_진단문항.js 09-07 판) · 문턱 0.8 · 3급 여섯(G502·G503·G504·G507·G508·G510) · 4급 여섯(G705·G708·G710·G711·G713·G714) · 짝 규칙(같은 문형·같은 길이·같은 보기 구성) — 시험이 이 여섯이 은행과 같은지 잰다
const DIAG_VOID_ITEMS = [];                  // 못박은 판에서 «오류로 뺀» 문항 — '급|문형' 꼴. 빼면 그 급 분모가 5, 문턱은 4/5(설계 §⑤-㉢). 판을 통째로 갈지 않는다.
const DIAG_ROLE_ROUND = { 시작: 0, 중간: 1, 끝: 2, 연습: 0 };   // 역할 → 문항 회차(짝 셋 중 몇째)
const DIAG_SESSION_TAB_ = '진단세션';
const DIAG_SESSION_HEADERS = ['세션번호', '진단코드', '이메일', '전화', '역할', '회차', '문항스냅샷', '답', '시도', '멱등열쇠',
  '표본급수', '급수경로', '맞힌문형', '다음문형', '쓰기지시문', '쓰기문장', 'AI산출', '기준판', '잰시각', '학생번호', '시작점', '상태',
  'created_at', 'schema_ver'];
const DIAG_SCHEMA_VER = 1;
const DIAG_WRITE_BATCH_MAX_ = 20;            // 밤 배치가 하룻밤에 태깅하는 쓰기 문장 상한(AI 호출 상한)

/* ── 순수 함수 ────────────────────────────────────────────────────────────── */

/* 회차(0 시작 · 1 중간 · 2 끝)의 문항 스냅샷 — 급마다 여섯(정답 포함 · 저장용) + 쓰기 지시문. */
function 진단스냅샷_(회차) {
  const i = Math.max(0, Math.min(2, Number(회차) || 0));
  const 급별 = {};
  DIAG_LADDER.forEach(function (급) { 급별[급] = 진단문항급_(급, i); });
  return { 급별: 급별, 쓰기지시문: DIAG_WRITE[i] || DIAG_WRITE[0] };
}

/* 정답을 뺀 공개판 — 통로로 나가는 것은 이것뿐이다. */
function 진단공개문항_(급별) {
  const out = {};
  Object.keys(급별 || {}).forEach(function (급) {
    out[급] = (급별[급] || []).map(function (q, i) { return { n: i, 문형: q.문형, 문장: q.문장, 보기: q.보기 }; });
  });
  return out;
}

/* 채점 — 사다리를 탄다. 답 = { 3: [보기 자리 여섯], 4: [...] } (시도 1 만 넣는다). 제외 = ['4|G705', …].
 * 돌려주는 것: 표본급수(없으면 null) · 미측(3급도 못 잰 사람) · 상한(꼭대기 급을 통과) · 경로 · 맞힌문형 · 다음문형.
 * 🔑 「맞힌·다음 문형」은 **마지막으로 답한 급**의 것이다 — 통과한 급의 여섯은 이미 안 것이고, 학생이 볼 자리는 멈춘 급이다. */
function 진단채점_(급별, 답, 제외) {
  const 뺀 = {};
  (제외 || DIAG_VOID_ITEMS || []).forEach(function (k) { 뺀[String(k)] = 1; });
  const 경로 = [];
  let 표본급수 = null, 미측 = false, 상한 = false, 맞힌 = [], 다음 = [];
  for (let li = 0; li < DIAG_LADDER.length; li++) {
    const 급 = DIAG_LADDER[li];
    const 문항 = 급별[급] || [];
    const a = 답 && 답[급];
    if (!Array.isArray(a)) break;                                  // 여기까지 답했다 — 사다리가 여기서 멈춘다
    let 분모 = 0, 맞힌수 = 0;
    const 맞 = [], 틀 = [];
    문항.forEach(function (q, i) {
      if (뺀[급 + '|' + q.문형]) return;                            // 오류로 뺀 문항 — 분모에서 빠진다
      분모++;
      if (Number(a[i]) === Number(q.정답)) { 맞힌수++; 맞.push(q.문형); } else 틀.push(q.문형);
    });
    const 통과 = 분모 > 0 && (맞힌수 / 분모) >= DIAG_GATE;
    경로.push({ 급: 급, 맞힌: 맞힌수, 분모: 분모, 통과: 통과 });
    맞힌 = 맞; 다음 = 틀;
    if (!통과) { if (li === 0) 미측 = true; break; }
    표본급수 = 급;
    if (li === DIAG_LADDER.length - 1) 상한 = true;
  }
  // 끝 = 사다리가 더 못 간다(맨 아래서 미달 · 꼭대기 통과 · 중간 급에서 미달). 통과하고 다음 급을 아직 안 답했으면 끝이 아니다.
  const 끝 = 미측 || 상한 || (경로.length > 0 && !경로[경로.length - 1].통과);
  return { 표본급수: 표본급수, 미측: 미측, 상한: 상한, 경로: 경로, 맞힌문형: 맞힌, 다음문형: 다음, 끝: 끝 };
}

/* 사람이 읽고 옮겨 적을 여섯 자리 — 세션번호(긴 것)와 별개. 이메일·전화가 어긋나도 이 코드로 잇는다(설계 §⑥-㉠). */
function 진단코드_(난수) {
  const r = typeof 난수 === 'number' ? 난수 : Math.random();
  return String(100000 + Math.floor(r * 900000)).slice(0, 6);
}

/* 진단 은행의 문장 전부 — 자율일 굳히기가 «같은 문장을 연습에 안 내려고» 쓰는 제외 목록이다(자를 향해 가르치지 않는다). 정답은 안 낸다. */
function 진단문장목록_() {
  const out = [];
  DIAG_LADDER.forEach(function (급) { [0, 1, 2].forEach(function (i) { 진단문항급_(급, i).forEach(function (q) { out.push(q.문장); }); }); });
  return out;
}

/* 문형 번호 → 사람이 읽는 이름(`GRAMMAR_BANK`). 은행에 없으면 번호 그대로(지어내지 않는다). */
function 진단문형이름_(id) {
  const 은행 = typeof GRAMMAR_BANK === 'undefined' ? [] : GRAMMAR_BANK;
  const row = 은행.filter(function (r) { return r[0] === id; })[0];
  return row ? String(row[1]) : String(id);
}

/* ── 시트 ─────────────────────────────────────────────────────────────────── */

function 진단시트_(ss) { return ensureSheet(ss, DIAG_SESSION_TAB_, DIAG_SESSION_HEADERS); }
function 진단칸_(n) { return DIAG_SESSION_HEADERS.indexOf(n); }

/* 세션번호 또는 진단코드로 행을 찾는다 → { row, r(값 배열) } · 없으면 null. */
function 진단행찾기_(sh, 열쇠) {
  const k = String(열쇠 || '').trim();
  if (!k || sh.getLastRow() < 2) return null;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, DIAG_SESSION_HEADERS.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][진단칸_('세션번호')]) === k || String(vals[i][진단칸_('진단코드')]) === k) return { row: i + 2, r: vals[i] };
  }
  return null;
}
function 진단JSON_(v, 기본) { try { const j = JSON.parse(String(v || '')); return j == null ? 기본 : j; } catch (e) { return 기본; } }
function 진단칸쓰기_(sh, row, 값들) {   // 값들 = { 칸이름: 값 }
  Object.keys(값들).forEach(function (n) { const c = 진단칸_(n); if (c >= 0) sh.getRange(row, c + 1).setValue(값들[n]); });
}

/* 세션 시작 — 입력 { 역할, 이메일, 전화, 학생번호 }. 연락 통로가 하나도 없으면 시작하지 않는다(등록 때 이을 열쇠가 없다 · 판매 설계 §⑥-㉡ 걸음 1).
 * 돌려주는 것: 세션번호 · 진단코드 · 문항(정답 없음) · 쓰기지시문 · 기준판 · 사다리 시작 급. */
function 진단시작_(입력) {
  입력 = 입력 || {};
  const 역할 = DIAG_ROLE_ROUND.hasOwnProperty(입력.역할) ? String(입력.역할) : '시작';
  const 이메일 = String(입력.이메일 || '').trim().slice(0, 120);
  const 전화 = String(입력.전화 || '').trim().slice(0, 40);
  const 학생번호 = String(입력.학생번호 || '').trim().slice(0, 40);
  if (!이메일 && !전화 && !학생번호) return { ok: false, error: 'contact-required' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = 진단시트_(ss);
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  // 못박은 판 — 중간·끝은 그 학생의 시작점 세션이 쥔 기준판을 쓴다(설계 §⑤-㉢). 갈리면 상태에 남기고 «지금 판»으로 낸다.
  let 기준판 = DIAG_RULER_VER, 상태 = '선택형';
  if (학생번호 && 역할 !== '시작') {
    const 시작점 = 진단시작점_(sh, 학생번호);
    if (!시작점) 상태 = '선택형 · 시작점없음';
    else if (String(시작점.r[진단칸_('기준판')]) !== DIAG_RULER_VER) { 기준판 = String(시작점.r[진단칸_('기준판')]); 상태 = '선택형 · 기준판갈림(' + 기준판 + '→' + DIAG_RULER_VER + ')'; }
  }
  const 회차 = DIAG_ROLE_ROUND[역할];
  const snap = 진단스냅샷_(회차);
  const 세션번호 = 'DS-' + Utilities.formatDate(now, tz, 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0, 8);
  let 코드 = 진단코드_();
  for (let t = 0; t < 5 && 진단행찾기_(sh, 코드); t++) 코드 = 진단코드_();   // 여섯 자리가 겹치면 다시(다섯 번)
  const nowStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
  sh.appendRow([세션번호, 코드, 이메일, 전화, 역할, 회차, JSON.stringify(snap.급별), '{}', '{}', '{}',
    '', '[]', '[]', '[]', snap.쓰기지시문, '', '', 기준판, '', 학생번호, '', 상태, nowStr, DIAG_SCHEMA_VER]);
  return { ok: true, 세션번호: 세션번호, 진단코드: 코드, 역할: 역할, 기준판: 기준판, 시작급: DIAG_LADDER[0],
    문항: 진단공개문항_(snap.급별), 쓰기지시문: snap.쓰기지시문 };
}

/* 문항 «하나»의 답 — 입력 { 세션번호, 급, n(0~5), 답(보기 자리 0~3), 멱등열쇠 }.
 * 고른 순간 맞았는지 돌려준다(설계 §⑦ 「만지면 움직이나」 — 몽글 눈웃음의 재료). 정답 «자리»는 안 나간다 — 맞았는지만.
 * 첫 답은 «시도 1» 에 잠기고, 같은 문항을 다시 고르면 시도 2 로 덧붙는다(표본 급수는 시도 1 만 본다 · §⑥ 최초 제출 잠금).
 * 사다리 순서를 지킨다 — 앞 급의 시도 1 여섯이 다 차고 통과했어야 다음 급을 받는다. */
function 진단답_(입력) {
  입력 = 입력 || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = 진단시트_(ss);
  const f = 진단행찾기_(sh, 입력.세션번호);
  if (!f) return { ok: false, error: 'no-session' };
  const 급 = Number(입력.급);
  if (DIAG_LADDER.indexOf(급) < 0) return { ok: false, error: 'bad-level' };
  const 급별 = 진단JSON_(f.r[진단칸_('문항스냅샷')], {});
  const 문항 = 급별[급] || [];
  const n = Number(입력.n), 답 = Number(입력.답);
  if (!(n >= 0 && n < 문항.length) || !(답 >= 0 && 답 <= 3)) return { ok: false, error: 'bad-answer' };
  const 열쇠 = String(입력.멱등열쇠 || '').trim().slice(0, 80);
  const 답들 = 진단JSON_(f.r[진단칸_('답')], {});
  const 열쇠들 = 진단JSON_(f.r[진단칸_('멱등열쇠')], {});
  // 같은 제출이 두 번 — 저장한 결과를 그대로(두 창·재전송 · 설계 §⑥-㉠ 멱등)
  if (열쇠 && 열쇠들[급] && 열쇠들[급].indexOf(열쇠) > -1) return 진단답응답_(급별, 답들, 급, n, true);
  // 사다리 — 앞 급을 통과했어야 다음 급을 받는다
  const li = DIAG_LADDER.indexOf(급);
  if (li > 0) {
    const 앞 = 진단채점_(급별, 진단첫답_(답들), DIAG_VOID_ITEMS);
    if (!(앞.경로[li - 1] && 앞.경로[li - 1].통과)) return { ok: false, error: 'ladder' };
  }
  // 이 문항이 아직 비어 있는 첫 시도 묶음에 넣는다 — 시도 1 이 차 있으면 시도 2(없으면 새로)
  const 시도목록 = 답들[급] = 답들[급] || [];
  let 시도 = 시도목록.filter(function (t) { return t.답[n] == null; })[0];
  if (!시도) { 시도 = { 시도: 시도목록.length + 1, 답: 문항.map(function () { return null; }), 시각: '' }; 시도목록.push(시도); }
  시도.답[n] = 답;
  시도.시각 = new Date().toISOString();
  if (열쇠) (열쇠들[급] = 열쇠들[급] || []).push(열쇠);
  const 결과 = 진단채점_(급별, 진단첫답_(답들), DIAG_VOID_ITEMS);
  const 쓸것 = { 답: JSON.stringify(답들), 시도: JSON.stringify(시도목록.length), 멱등열쇠: JSON.stringify(열쇠들),
    표본급수: 결과.표본급수 == null ? '' : 결과.표본급수, 급수경로: JSON.stringify(결과.경로),
    맞힌문형: JSON.stringify(결과.맞힌문형), 다음문형: JSON.stringify(결과.다음문형) };
  if (결과.끝 && !f.r[진단칸_('잰시각')]) 쓸것.잰시각 = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  진단칸쓰기_(sh, f.row, 쓸것);
  return 진단답응답_(급별, 답들, 급, n, false);
}
/* 급마다 시도 1 만, 그것도 여섯이 «다 찼을 때만» — 반쪽 시도를 채점에 넣으면 빈칸이 오답으로 센다. 표본 급수의 재료. */
function 진단첫답_(답들) {
  const out = {};
  Object.keys(답들 || {}).forEach(function (급) {
    const 첫 = (답들[급] || [])[0];
    if (첫 && 첫.답 && 첫.답.length && 첫.답.every(function (v) { return v != null; })) out[급] = 첫.답;
  });
  return out;
}
function 진단답응답_(급별, 답들, 급, n, 중복) {
  const 첫 = (답들[급] || [])[0];
  const 값 = 첫 ? 첫.답[n] : null;
  const 맞음 = 값 != null && Number(값) === Number((급별[급][n] || {}).정답);
  const 남은 = 첫 ? 첫.답.filter(function (v) { return v == null; }).length : (급별[급] || []).length;
  const 결과 = 진단채점_(급별, 진단첫답_(답들), DIAG_VOID_ITEMS);
  const 이번 = 결과.경로.filter(function (p) { return p.급 === 급; })[0] || null;   // 여섯이 다 찼을 때만 있다
  const li = DIAG_LADDER.indexOf(급);
  const 다음급 = (이번 && 이번.통과 && li < DIAG_LADDER.length - 1) ? DIAG_LADDER[li + 1] : null;
  const 첫시도 = !(답들[급] || []).some(function (t, i) { return i > 0 && t.답[n] != null; });
  return { ok: true, 급: 급, n: n, 맞음: 맞음, 남은: 남은, 급끝: 남은 === 0, 통과: !!(이번 && 이번.통과),
    맞힌: 이번 ? 이번.맞힌 : null, 분모: 이번 ? 이번.분모 : null, 다음급: 다음급, 끝: 남은 === 0 && !다음급,
    표본급수: 결과.표본급수, 미측: 결과.미측, 상한: 결과.상한, 중복: !!중복,
    첫시도: 첫시도, 안내: 첫시도 ? '' : '첫 답이 잰 값이에요. 이번 답은 따로 남겨요.' };
}

/* 쓰기 한 문장 — 급수에 안 든다(설계 §⑤-㉣). 비워도 완주다(쓰기 없음). 태깅은 밤 배치(`diagWriteBatch_`). */
function 진단쓰기_(입력) {
  입력 = 입력 || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = 진단시트_(ss);
  const f = 진단행찾기_(sh, 입력.세션번호);
  if (!f) return { ok: false, error: 'no-session' };
  const 문장 = String(입력.문장 || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const 상태 = 문장 ? '완주 · 카드대기' : '완주 · 쓰기없음';
  진단칸쓰기_(sh, f.row, { 쓰기문장: 문장, 상태: 상태 });
  return { ok: true, 상태: 문장 ? '대기' : '없음' };
}

/* 결과 — 세션번호나 진단코드로. 정답은 안 나간다. 카드는 태깅이 끝났을 때만 든다. */
function 진단결과_(입력) {
  입력 = 입력 || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = 진단시트_(ss);
  const f = 진단행찾기_(sh, 입력.세션번호 || 입력.진단코드);
  if (!f) return { ok: false, error: 'no-session' };
  const 급별 = 진단JSON_(f.r[진단칸_('문항스냅샷')], {});
  const 결과 = 진단채점_(급별, 진단첫답_(진단JSON_(f.r[진단칸_('답')], {})), DIAG_VOID_ITEMS);
  const ai = 진단JSON_(f.r[진단칸_('AI산출')], null);
  const 문장 = String(f.r[진단칸_('쓰기문장')] || '');
  const 상태 = String(f.r[진단칸_('상태')] || '');
  return { ok: true, 세션번호: String(f.r[진단칸_('세션번호')]), 진단코드: String(f.r[진단칸_('진단코드')]), 역할: String(f.r[진단칸_('역할')]),
    기준판: String(f.r[진단칸_('기준판')]), 표본급수: 결과.표본급수, 미측: 결과.미측, 상한: 결과.상한, 경로: 결과.경로,
    맞힌문형: 결과.맞힌문형.map(function (g) { return { 번호: g, 이름: 진단문형이름_(g) }; }),
    다음문형: 결과.다음문형.map(function (g) { return { 번호: g, 이름: 진단문형이름_(g) }; }),
    쓰기: { 문장: 문장, 상태: !문장 ? '없음' : (ai ? '완료' : '대기'), 카드: ai ? { 태그: ai.태그 || [], 교정문: ai.교정문 || '', 규칙: ai.규칙 || '' } : null },
    상태: 상태 };
}

/* 「지금은 안 할래요」 — 사유는 선택. 안 고르고 닫아도 «눌렀다»는 남는다(그 자체가 분모 · 설계 §⑭-㉣). */
function 진단안할래_(입력) {
  입력 = 입력 || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = 진단시트_(ss);
  const f = 진단행찾기_(sh, 입력.세션번호);
  if (!f) return { ok: false, error: 'no-session' };
  const 사유 = String(입력.사유 || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const 지금 = String(f.r[진단칸_('상태')] || '');
  진단칸쓰기_(sh, f.row, { 상태: (지금 ? 지금 + ' · ' : '') + '안할래' + (사유 ? ':' + 사유 : '') });
  return { ok: true };
}

/* 그 학생의 «시작점» 세션(잇는 날 못박은 것). */
function 진단시작점_(sh, 학생번호) {
  if (sh.getLastRow() < 2) return null;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, DIAG_SESSION_HEADERS.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][진단칸_('학생번호')]).trim() === String(학생번호).trim() && String(vals[i][진단칸_('시작점')]) === '✓') return { row: i + 2, r: vals[i] };
  }
  return null;
}

/* 등록하는 날 — 진단 세션을 학생 번호에 잇고 시작점을 «하나» 못박는다(설계 §⑥-㉡).
 *   열쇠 = { 진단코드 | 이메일 | 전화 } 중 있는 것 전부(셋 다 봐서 맞는 세션 전부에 학생번호를 채운다)
 *   시작점 규칙 = 등록일에 가장 가까운 «시작» 역할 세션 · 이미 못박혀 있으면 안 바꾼다(되살릴 길이 없어지므로). */
function 진단잇기_(학생번호, 열쇠, 등록일) {
  const sid = String(학생번호 || '').trim();
  if (!sid) return { ok: false, error: 'no-student' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = 진단시트_(ss);
  if (sh.getLastRow() < 2) return { ok: true, 이은수: 0, 시작점: null };
  열쇠 = 열쇠 || {};
  const 코드 = String(열쇠.진단코드 || '').trim(), 메일 = String(열쇠.이메일 || '').trim().toLowerCase(), 폰 = String(열쇠.전화 || '').replace(/\D/g, '');
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, DIAG_SESSION_HEADERS.length).getValues();
  const 맞는 = [];
  vals.forEach(function (r, i) {
    const 있는sid = String(r[진단칸_('학생번호')] || '').trim();
    const 맞음 = (코드 && String(r[진단칸_('진단코드')]) === 코드) ||
      (메일 && String(r[진단칸_('이메일')] || '').trim().toLowerCase() === 메일) ||
      (폰 && String(r[진단칸_('전화')] || '').replace(/\D/g, '') === 폰) || 있는sid === sid;
    if (!맞음) return;
    if (있는sid && 있는sid !== sid) return;                       // 남의 학생 번호가 이미 있다 — 안 덮는다
    맞는.push({ row: i + 2, r: r });
  });
  맞는.forEach(function (m) { if (!String(m.r[진단칸_('학생번호')] || '').trim()) sh.getRange(m.row, 진단칸_('학생번호') + 1).setValue(sid); });
  const 이미 = 맞는.filter(function (m) { return String(m.r[진단칸_('시작점')]) === '✓'; })[0];
  if (이미) return { ok: true, 이은수: 맞는.length, 시작점: String(이미.r[진단칸_('세션번호')]), 유지: true };
  const 기준 = (등록일 instanceof Date ? 등록일 : new Date()).getTime();
  const 후보 = 맞는.filter(function (m) { return String(m.r[진단칸_('역할')]) === '시작' && m.r[진단칸_('잰시각')]; })
    .sort(function (a, b) { return Math.abs(new Date(a.r[진단칸_('잰시각')]).getTime() - 기준) - Math.abs(new Date(b.r[진단칸_('잰시각')]).getTime() - 기준); })[0];
  if (!후보) return { ok: true, 이은수: 맞는.length, 시작점: null, 안내: '시작 역할로 끝까지 잰 세션이 없어 시작점을 못 박았습니다' };
  sh.getRange(후보.row, 진단칸_('시작점') + 1).setValue('✓');
  return { ok: true, 이은수: 맞는.length, 시작점: String(후보.r[진단칸_('세션번호')]) };
}
/* 편집기·메뉴에서 부르는 겉 이름 — linkDiagnosisToStudent('S001', { 진단코드: '123456' }) */
function linkDiagnosisToStudent(학생번호, 열쇠) {
  const r = 진단잇기_(학생번호, 열쇠, new Date());
  const msg = r.ok ? ('이은 세션 ' + r.이은수 + ' · 시작점 ' + (r.시작점 || '없음') + (r.안내 ? ' · ' + r.안내 : '')) : ('실패: ' + r.error);
  Logger.log(msg);
  return msg;
}

/* ── JSON 통로 ────────────────────────────────────────────────────────────── */

/* `상담AI.js` doGet/doPost 가 `?p=진단` 이면 여기로 넘긴다. ContentService JSON 만 — HtmlService 는 절대 안 낸다(머리말).
 *   GET  ?p=진단&op=result&code=123456
 *   POST ?p=진단  본문(JSON · text/plain 로 보내면 브라우저가 예비 요청을 안 보낸다) { op, … }
 * 내부 오류 내용은 밖으로 안 흘린다. */
function 진단API_(e, method) {
  let 입력 = {};
  try {
    if (method === 'post') { try { 입력 = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (eP) { 입력 = {}; } }
    else 입력 = (e && e.parameter) || {};
    const op = String(입력.op || '');
    let out;
    if (op === 'start') out = 진단시작_({ 역할: 입력.역할 || 입력.role, 이메일: 입력.이메일 || 입력.email, 전화: 입력.전화 || 입력.phone, 학생번호: 입력.학생번호 || 입력.student });
    else if (op === 'answer') out = 진단답_({ 세션번호: 입력.세션번호 || 입력.session, 급: 입력.급 || 입력.level, n: 입력.n, 답: 입력.답 != null ? 입력.답 : 입력.answer, 멱등열쇠: 입력.멱등열쇠 || 입력.key });
    else if (op === 'write') out = 진단쓰기_({ 세션번호: 입력.세션번호 || 입력.session, 문장: 입력.문장 || 입력.text });
    else if (op === 'result') out = 진단결과_({ 세션번호: 입력.세션번호 || 입력.session, 진단코드: 입력.진단코드 || 입력.code });
    else if (op === 'decline') out = 진단안할래_({ 세션번호: 입력.세션번호 || 입력.session, 사유: 입력.사유 || 입력.reason });
    else out = { ok: false, error: 'bad-op' };
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('진단API_ 오류: ' + String(err && err.message || err).slice(0, 300));
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'internal' })).setMimeType(ContentService.MimeType.JSON);
  }
}

/* ── 밤 배치 — 쓰기 문장 태깅 + 카드 메일 ───────────────────────────────────── */

const DIAG_TAG_SYSTEM_ = 'SYNK LAB 의 한국어 선생님. 처음 만난 몽골 유학생(한국어 3급쯤)이 쓴 한 문장을 본다. ' +
  '할 일 셋: ①고칠 자리가 있으면 오류 태그를 주어진 목록에서만 고른다(없으면 ["오류없음"]) ②고친 문장 ③학생에게 돌려줄 «규칙 한 줄» — ' +
  '「외우세요」가 아니라 왜 그런지 규칙으로, 짧은 문장·초급 어휘·존댓말. 🚫 「아직·부족·못·틀렸다」 같은 결핍 낱말과 「잘했어요」 같은 평가 금지. ' +
  '문장이 한국어가 아니거나 뜻이 없으면 태그 ["오류없음"], 고친 문장은 원문 그대로, 규칙은 빈 문자열.';
function 진단태깅판_() {
  const raw = DIAG_TAG_SYSTEM_ + '|model=' + (typeof AI_FEEDBACK_MODEL === 'undefined' ? '?' : AI_FEEDBACK_MODEL);
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return d.map(function (b) { return ((b & 0xFF) + 0x100).toString(16).slice(1); }).join('').slice(0, 8);
}

function diagWriteBatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(DIAG_SESSION_TAB_);
  if (!sh || sh.getLastRow() < 2) return;
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return;                                             // 키 없음 = 카드가 «대기»로 남는다(「없음」으로 안 적는다 · 설계 §④-㉣)
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, DIAG_SESSION_HEADERS.length).getValues();
  const 태그목록 = typeof HW_ERROR_TAGS === 'undefined' ? [] : HW_ERROR_TAGS;
  const schema = { type: 'object', additionalProperties: false, required: ['tags', 'corrected', 'rule'], properties: {
    tags: { type: 'array', items: { type: 'string', enum: 태그목록.length ? 태그목록 : undefined } }, corrected: { type: 'string' }, rule: { type: 'string' } } };
  if (!태그목록.length) delete schema.properties.tags.items.enum;
  let 한 = 0;
  for (let i = 0; i < vals.length && 한 < DIAG_WRITE_BATCH_MAX_; i++) {
    const r = vals[i];
    const 문장 = String(r[진단칸_('쓰기문장')] || '').trim();
    if (!문장 || String(r[진단칸_('AI산출')] || '').trim()) continue;
    if (String(r[진단칸_('상태')] || '').indexOf('안할래') > -1) continue;
    let ai;
    try {
      const j = aiCall_(apiKey, DIAG_TAG_SYSTEM_, '오류 태그 목록: ' + 태그목록.join(' · ') + '\n\n학생이 쓴 문장:\n' + 문장, schema, 1024);
      ai = { 태그: j.tags || [], 교정문: String(j.corrected || 문장), 규칙: String(j.rule || ''), model: AI_FEEDBACK_MODEL, prompt_ver: 진단태깅판_(),
        시각: new Date().toISOString() };
    } catch (e) {
      Logger.log('진단 태깅 실패(' + String(r[진단칸_('세션번호')]) + '): ' + String(e && e.message || e).slice(0, 120));
      if (e && e.permanent) continue;                                // 이 행만 다음 밤으로 — 옛 글자·거절
      break;                                                        // 429·5xx 같은 일시 장애 — 오늘 밤은 여기까지
    }
    한++;
    진단칸쓰기_(sh, i + 2, { AI산출: JSON.stringify(ai), 상태: '완주' });
    const 메일 = String(r[진단칸_('이메일')] || '').trim();
    if (메일 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(메일)) 진단카드메일_(메일, r, ai);
  }
  if (한) Logger.log('진단 쓰기 태깅 ' + 한 + '건');
}

/* 약한 자리 카드 메일 — 문안은 설계 §⑭ 그대로(결핍 구문 0 · 비교 0 · 기간 단정 0). 한국어 판 · 몽골어는 다음 관문. */
function 진단카드메일_(to, r, ai) {
  const 급별 = 진단JSON_(r[진단칸_('문항스냅샷')], {});
  const 결과 = 진단채점_(급별, 진단첫답_(진단JSON_(r[진단칸_('답')], {})), DIAG_VOID_ITEMS);
  const 이름들 = function (a) { return a.map(진단문형이름_).join(' · '); };
  const 자리 = 결과.미측 ? '오늘은 여기까지 봤어요. 다음에 더 볼 수 있어요.' :
    (결과.표본급수 + '급 자리예요. 우리 학원 기준이에요. 공식 TOPIK 시험 급수와는 달라요.' + (결과.상한 ? '' : '\n' + (결과.표본급수 + 1) + '급까지 한 칸 남았어요.'));
  const 깨끗 = !ai.태그.length || (ai.태그.length === 1 && ai.태그[0] === '오류없음');
  const 본문 = [
    '[지금 자리]', 자리, '',
    '[오늘 본 것]',
    결과.맞힌문형.length ? '맞힌 자리: ' + 이름들(결과.맞힌문형) : null,
    결과.다음문형.length ? '다음 자리: ' + 이름들(결과.다음문형) : null,
    '',
    '쓴 문장: 「' + String(r[진단칸_('쓰기문장')] || '') + '」',
    깨끗 ? '이 문장은 깨끗해요.' : ('여기 한 자리가 보여요. ' + ai.규칙 + (ai.교정문 ? '\n이렇게 써요: 「' + ai.교정문 + '」' : '')),
    '',
    '[다음]',
    '오늘 나온 「다음 자리」가 첫 주 숙제가 됩니다. 선생님이 그 자리를 기억하고 있고, 8주 뒤에 오늘과 같은 자를 다시 대 봅니다.',
    '진단 코드: ' + String(r[진단칸_('진단코드')]) + ' (등록할 때 이 숫자를 말씀해 주세요)',
    '', 'SYNK LAB'
  ].filter(function (s) { return s !== null; }).join('\n');
  if (!quotaOk(1)) return;                                         // 관문 — 리허설이면 여기서 막힌다(메일 발송 전부 quotaOk 를 지난다 · safety v9.120)
  try { MailApp.sendEmail(to, '[SYNK LAB] 오늘 본 것 — 약한 자리 카드', 본문); }
  catch (e) { Logger.log('진단 카드 메일 실패: ' + String(e && e.message || e).slice(0, 120)); }
}
