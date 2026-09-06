'use strict';
/**
 * 자율일 묶음 — 일요일에 앱이 무엇을 내나 (1기 · 정본 = `docs/자율일_설계_v1.md`).
 *
 * ■ 한 줄
 *   토요일 밤에 학생마다 「내일 할 것」 한 묶음을 짓고(`sundayBundleBatch_`), 그 묶음이 판·목표·문항·고리를
 *   제 안에 박는다(`자율일배정` 시트 한 행). 월요일 새벽에 그 묶음의 «항목»이 몇 개 찼는지 센다
 *   (`sundayBundleJudge_`). 제출 «행 수»는 아무 데도 안 쓴다 — 같은 문장을 세 번 녹음해도 항목 하나다.
 *
 * ■ 짓는 곳과 내는 곳이 다르다 (설계 §⑧)
 *   여기는 «짓고 세는» 쪽이다. «내고 받는» 쪽은 SYNK-talk 다 — 토요일 밤 묶음을 `자율일다리_` 가 talk 로 실어
 *   보내고(`명부스윕_` 과 같은 꼴 · 세 값이 없으면 0초 스킵), talk 의 일요일 편지가 그것을 재료로 낸다.
 *   talk 쪽이 안 서 있으면 낭독·답하기는 «미집계» 로 남는다 — 조용히 완주로 접지 않는다.
 *
 * ■ 순수 함수와 시트 함수를 가른다
 *   `자율일묶음_`·`자율일완주_`·`자율일오답고르기_`·`자율일한줄_` 은 시트를 모른다(시험이 직접 태운다 ·
 *   `tests/자율일배정.test.js`). 시트·AI·다리를 만지는 것은 `sundayBundle*` 둘과 그 아래 `자율일…_(ss, …)` 들이다.
 *
 * ■ 🔴 진단 문항은 여기서 «절대» 안 쓴다 — 진단 여섯 문형의 문항 셋은 자(ruler)다. 굳히기 문항은 같은 문형의
 *   «다른 문장»을 AI 가 짓는다(`자율일재료생성_`). memory `teaching-toward-the-ruler-kills-it`.
 */

/* 시트 골격 — `sheetSkeleton_` 이 이 상수를 그대로 쓴다(두 곳에 적으면 갈린다). */
const AUTO_ASSIGN_HEADERS = ['배정ID', 'student_id', '자율일', '차시', '주유형', '차시판', '목표', '항목', '공급상태',
  '완주판정', '찬수', '항목수', '미집계', '빈항목', '판정시각', 'created_at', 'schema_ver'];
const AUTO_ASSIGN_SCHEMA_VER = 1;
const AUTO_ASSIGN_TAB_ = '자율일배정';
const AUTO_WRONG_WINDOW_DAYS_ = 14;   // 오답 창 — `퀴즈오답맵_` 과 같은 14일(한 재료에 창 하나 · 설계 §③-㉡)
const AUTO_REVIEW_WINDOW_DAYS_ = 60;  // 전체복습(8차시)이 「8주 동안 오답을 낸 문형」을 고르는 창

/* ── 순수 함수 ────────────────────────────────────────────────────────────── */

function 자율일항목ID_(배정ID, 종류, n) { return String(배정ID) + '#' + 종류 + String(n); }

/* 오답 고르기 — 그 주 문형이 든 것 먼저, 그다음 반복 많은 것, 같으면 최근 것(설계 §③-㉡).
 * 오답행 = [{ id, 문형, 반복, t, 문항 }] · 상한을 넘는 것은 버리지 않는다 — 다음 주 창에서 다시 골라진다. */
function 자율일오답고르기_(오답행, 목표문형, 상한) {
  const 목표 = {};
  (목표문형 || []).forEach(function (g) { 목표[g] = 1; });
  const 순 = (오답행 || []).slice().sort(function (a, b) {
    return ((목표[b.문형] ? 1 : 0) - (목표[a.문형] ? 1 : 0)) ||
      ((Number(b.반복) || 0) - (Number(a.반복) || 0)) ||
      ((Number(b.t) || 0) - (Number(a.t) || 0));
  });
  return 순.slice(0, Math.max(0, Number(상한) || 0));
}

/* 묶음 짓기 — 한 학생 × 한 자율일. 재료가 모자라면 «공급실패» 를 이름으로 남기고, 조용히 메우지 않는다.
 *   주    = `COHORT1_WEEKS` 의 한 행
 *   재료  = { 굳히기문항: [{문장,보기,정답,판,목표}], 낭독: [{문장,목표}], 답하기: [{물음,목표}],
 *            오답행: [{id,문형,반복,t,문항}], 이월: [{종류,목표,문항,원오답}], 전체복습문형: ['G7xx',…] }
 * 항목 수는 `COHORT1_BUNDLE_SIZE` 가 정한다(부담 상한이 곧 규칙 · 설계 §③-㉡). */
function 자율일묶음_(주, 학생ID, 재료) {
  재료 = 재료 || {};
  const 크기 = COHORT1_BUNDLE_SIZE;
  const 배정ID = String(학생ID) + '|' + 주.일;
  const 유형 = (주.유형 || []).slice();
  let 목표;
  if (유형.indexOf('전체복습') > -1) {
    목표 = ((재료.전체복습문형 && 재료.전체복습문형.length) ? 재료.전체복습문형 : COHORT1_ALL_GRAMMAR).slice(0, 3);
  } else if (유형.indexOf('문형없음') > -1) {
    목표 = ['요목:' + (주.요목 || '')];
  } else {
    목표 = (주.문형 || []).slice();
  }
  const 항목 = [], 실패 = [];
  const 목표로 = function (i) { return 목표.length ? 목표[i % 목표.length] : ''; };

  const 굳 = (재료.굳히기문항 || []).slice(0, 크기.굳히기);
  굳.forEach(function (q, i) {
    항목.push({ 항목ID: 자율일항목ID_(배정ID, '굳히기', i + 1), 종류: '굳히기', 목표: q.목표 || 목표로(i),
      문항: { 문장: q.문장, 보기: q.보기, 정답: q.정답, 판: q.판 || '' } });
  });
  if (굳.length < 크기.굳히기) 실패.push('굳히기 ' + 굳.length + '/' + 크기.굳히기);

  const 낭 = (재료.낭독 || []).slice(0, 크기.낭독);
  낭.forEach(function (s, i) {
    항목.push({ 항목ID: 자율일항목ID_(배정ID, '낭독', i + 1), 종류: '낭독', 목표: s.목표 || 목표로(i), 문장: s.문장 });
  });
  if (낭.length < 크기.낭독) 실패.push('낭독 ' + 낭.length + '/' + 크기.낭독);

  const 답 = (재료.답하기 || []).slice(0, 크기.답하기);
  답.forEach(function (s, i) {
    항목.push({ 항목ID: 자율일항목ID_(배정ID, '답하기', i + 1), 종류: '답하기', 목표: s.목표 || 목표로(i), 물음: s.물음 });
  });
  if (답.length < 크기.답하기) 실패.push('답하기 ' + 답.length + '/' + 크기.답하기);

  // 오답 — 이월이 자리를 «먼저» 차지하고(설계 §③-㉡ 자리 차지), 남은 자리를 이번 주 오답으로 채운다. 총량은 늘 상한 이하.
  const 이월 = (재료.이월 || []).slice(0, 크기.오답);
  const 고른 = 자율일오답고르기_(재료.오답행, 주.문형, 크기.오답 - 이월.length);
  let n = 0;
  이월.forEach(function (c) {
    항목.push({ 항목ID: 자율일항목ID_(배정ID, '오답', ++n), 종류: '오답', 목표: c.목표 || '', 문항: c.문항 || null,
      원오답: c.원오답 || null, 이월: true });
  });
  고른.forEach(function (w) {
    항목.push({ 항목ID: 자율일항목ID_(배정ID, '오답', ++n), 종류: '오답', 목표: w.문형 || '', 문항: w.문항 || null,
      원오답: { quiz_log_id: w.id, t: w.t || 0 } });
  });

  if (주.진단) 항목.push({ 항목ID: 자율일항목ID_(배정ID, '진단', 1), 종류: '진단', 회차: 주.진단 });

  const 공급상태 = !항목.length ? '공급실패:전부' : (실패.length ? '공급실패:' + 실패.join(' · ') : '정상');
  return { 배정ID: 배정ID, 학생ID: String(학생ID), 자율일: 주.일, 차시: 주.차시, 주유형: 유형, 차시판: COHORT1_WEEKS_VER,
    목표: 목표, 항목: 항목, 공급상태: 공급상태 };
}

/* 완주 판정 — 다섯 갈래(설계 §④). 제출들 = [{ 항목ID }] · 옵션.미집계 = 셀 수 없는 종류(예: talk 답이 없으면 ['낭독','답하기']).
 * 「공급실패:전부」면 학생 쪽 판정을 안 한다(우리 잘못이 빈 날로 안 보이게). 일부 실패는 채운 만큼이 분모다(§③-㉢). */
function 자율일완주_(묶음, 제출들, 옵션) {
  const 미집계 = (옵션 && 옵션.미집계) || [];
  if (String(묶음.공급상태 || '') === '공급실패:전부' || !(묶음.항목 || []).length) {
    return { 판정: '공급실패', 찬수: 0, 항목수: 0, 빈항목: [], 미집계: 미집계 };
  }
  const 세는 = 묶음.항목.filter(function (a) { return 미집계.indexOf(a.종류) === -1; });
  const 찼다 = {};
  (제출들 || []).forEach(function (s) { if (s && s.항목ID) 찼다[String(s.항목ID)] = 1; });
  const 빈 = 세는.filter(function (a) { return !찼다[a.항목ID]; });
  const 찬수 = 세는.length - 빈.length;
  const 판정 = !세는.length ? '미집계' : (빈.length === 0 ? '완주' : (찬수 === 0 ? '빈날' : '부분'));
  return { 판정: 판정, 찬수: 찬수, 항목수: 세는.length, 빈항목: 빈.map(function (a) { return a.항목ID; }), 미집계: 미집계 };
}

/* 발행 뒤 불변 — 한 번 항목이 실린 묶음은 재실행이 갈아 끼우지 않는다(심문 2회차 아스트라 P0: 같은 배정ID 를 나중 내용으로
 * 교체하면 오프라인에서 먼저 푼 제출이 다른 문항에 붙는다). 다시 지어도 되는 것은 «항목이 0 인 행»(공급실패:전부)뿐이다. */
function 자율일다시지을까_(기존묶음) {
  if (!기존묶음) return true;
  return !((기존묶음.항목 || []).length > 0);
}

/* AI 가 지은 굳히기 문항 거르기 — 「응답이 왔다」와 「낼 수 있다」는 다르다(심문 2회차 아스트라 P1 · 제미나이 P0).
 *   ① 빈칸 ___ 이 정확히 하나 · 보기 넷 · 정답 자리 0~3 · 보기가 서로 다르다
 *   ② 🔴 진단 문항의 문장과 같으면 뺀다 — 진단 문항은 자(ruler)라 연습에 나오면 자가 죽는다(진단문장 = 진단 은행의 문장 목록)
 *   ③ 검문(AI 둘째 눈 · 「정답이 하나뿐인가」)이 아니라고 한 것은 뺀다 — 검문 결과가 없으면(호출 실패) 그 문항은 «안 낸다»(조용히 통과시키지 않는다)
 * 걸러서 8 이 안 되면 그만큼 공급실패로 적힌다(§③-㉢). */
function 자율일문항거르기_(문항들, 진단문장, 검문) {
  const 진단 = {};
  (진단문장 || []).forEach(function (s) { 진단[String(s).replace(/\s+/g, ' ').trim()] = 1; });
  const 본 = {};
  return (문항들 || []).filter(function (q, i) {
    if (!q || typeof q.문장 !== 'string' || !Array.isArray(q.보기) || q.보기.length !== 4) return false;
    if ((q.문장.match(/___/g) || []).length !== 1) return false;
    if (!(q.정답 >= 0 && q.정답 <= 3)) return false;
    if (new Set(q.보기.map(function (o) { return String(o).trim(); })).size !== 4) return false;
    const 키 = q.문장.replace(/\s+/g, ' ').trim();
    if (진단[키] || 본[키]) return false;
    본[키] = 1;
    if (검문 && 검문[i] !== true) return false;
    return true;
  });
}

/* 월요일 한 줄 — 공급 실패가 0 이 아니면 그것이 «먼저» 온다(우리 고장이 학생 이름 뒤에 안 숨게 · 설계 §④-㉠).
 * 판정들 = [{ 이름, 판정 }] */
function 자율일한줄_(판정들, 자율일) {
  const 셈 = { 완주: 0, 부분: 0, 빈날: 0, 공급실패: 0, 미집계: 0 };
  const 빈이름 = [], 실패이름 = [];
  (판정들 || []).forEach(function (j) {
    const k = String(j.판정 || '').replace(/\(.*\)$/, '');
    if (셈[k] == null) return;
    셈[k]++;
    if (k === '빈날') 빈이름.push(j.이름 || '?');
    if (k === '공급실패') 실패이름.push(j.이름 || '?');
  });
  const 앞 = 셈.공급실패 ? '🔴 공급 실패 ' + 셈.공급실패 + '(' + 실패이름.join('·') + ') — 우리가 못 낸 날입니다 · ' : '';
  return '지난 자율일(' + String(자율일 || '').slice(5) + ') — ' + 앞 + '완주 ' + 셈.완주 + ' · 부분 ' + 셈.부분 +
    ' · 빈 날 ' + 셈.빈날 + (빈이름.length ? '(' + 빈이름.join('·') + ')' : '') +
    (셈.미집계 ? ' · 미집계 ' + 셈.미집계 : '');
}

/* ── 시트 · AI · 다리 ─────────────────────────────────────────────────────── */

/* 1기 학생 — `app_state` 한 칸 `1기반`(값 = 반 이름 · 쉼표로 여럿)에 든 반의 학생. 비면 []. */
function 자율일학생들_(ss) {
  const st = ss.getSheetByName('app_state');
  if (!st) return [];
  const 반들 = String((getState(st, '1기반') || {}).val || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!반들.length) return [];
  const pf = ss.getSheetByName('profiles');
  if (!pf || pf.getLastRow() < 2) return [];
  return pf.getRange(2, 1, pf.getLastRow() - 1, 5).getValues()
    .filter(function (r) { return r[0] && r[3] === 'student' && 반들.indexOf(String(r[4] || '').trim()) > -1 && String(r[0]).indexOf('DEMO-') !== 0; })
    .map(function (r) { return { sid: String(r[0]).trim(), name: String(r[1] || '').trim() || String(r[0]).trim() }; });
}

/* 시트의 행을 읽어 배정ID → { row, 묶음 } 으로. JSON 칸(주유형·목표·항목)은 풀어서 낸다. */
function 자율일행들_(sh) {
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  const H = AUTO_ASSIGN_HEADERS;
  const col = function (n) { return H.indexOf(n); };
  sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues().forEach(function (r, i) {
    const id = String(r[col('배정ID')] || '').trim();
    if (!id) return;
    const J = function (v) { try { return JSON.parse(String(v || '')); } catch (e) { return null; } };
    out[id] = { row: i + 2, 묶음: {
      배정ID: id, 학생ID: String(r[col('student_id')] || '').trim(), 자율일: String(r[col('자율일')] || ''), 차시: Number(r[col('차시')]) || 0,
      주유형: J(r[col('주유형')]) || [], 차시판: String(r[col('차시판')] || ''), 목표: J(r[col('목표')]) || [], 항목: J(r[col('항목')]) || [],
      공급상태: String(r[col('공급상태')] || ''), 완주판정: String(r[col('완주판정')] || ''), 미집계: J(r[col('미집계')]) || [],
      빈항목: J(r[col('빈항목')]) || [] } };
  });
  return out;
}

function 자율일행값_(묶음, now) {
  return [묶음.배정ID, 묶음.학생ID, 묶음.자율일, 묶음.차시, JSON.stringify(묶음.주유형), 묶음.차시판, JSON.stringify(묶음.목표),
    JSON.stringify(묶음.항목), 묶음.공급상태, 묶음.완주판정 || '', '', '', '', '', '', now, AUTO_ASSIGN_SCHEMA_VER];
}

/* 프롬프트 판 — 첨삭(`fbPromptVer_`)과 같은 규약: 손 번호 금지 · 지문 8자리. 문항 스냅샷의 「판」 칸에 든다. */
const AUTO_GEN_SYSTEM_ = 'SYNK LAB(몽골 유학생 대상 한국어 학원)의 문형 연습 출제자. 주어진 TOPIK 4급 문형으로 «연습 문항»을 짓는다. ' +
  '규칙: ①한 문장은 네 어절 이하(꼭 필요하면 다섯) ②낱말은 1·2급 기초만(밥·물·문·책·집·친구·학교·비·우산·전화·노래) ' +
  '③빈칸은 ___ 하나 ④보기 넷은 «같은 자리에 들어갈 수 있는 다른 연결 어미»여야 한다 — 뜻이 통째로 다른 낱말을 채우면 찍어도 맞는다 ' +
  '⑤같은 뜻의 어미를 보기에 같이 넣지 않는다(답이 둘이 된다) ⑥정답 자리를 0~3 에 흩는다 ⑦장면은 대학생의 생활 안 ' +
  '⑧낭독 문장은 그 문형이 자연스럽게 든 한 문장, 답하기 물음은 그 문형으로 답하게 만드는 한 물음 ⑨사과·자기 언급·메타 발언 0.';
function 자율일생성판_() {
  const raw = AUTO_GEN_SYSTEM_ + '|model=' + (typeof AI_FEEDBACK_MODEL === 'undefined' ? '?' : AI_FEEDBACK_MODEL);
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return d.map(function (b) { return ((b & 0xFF) + 0x100).toString(16).slice(1); }).join('').slice(0, 8);
}

/* 그 주 재료를 AI 가 짓는다 — 굳히기 8(문형당 절반) · 낭독 2 · 답하기 2. 못 지으면 빈 배열과 오류 문구(공급실패의 사유가 된다).
 * 1차시(문형없음)는 굳히기를 `COHORT1_STYLE_ITEMS` 에서 가져오고 낭독·답하기만 짓는다. */
function 자율일재료생성_(주) {
  const out = { 굳히기문항: [], 낭독: [], 답하기: [], 오류: '' };
  const 판 = 'ai:' + (typeof AI_FEEDBACK_MODEL === 'undefined' ? '?' : AI_FEEDBACK_MODEL) + ':' + 자율일생성판_();
  const 문형없음 = (주.유형 || []).indexOf('문형없음') > -1;
  if (문형없음) {
    out.굳히기문항 = (COHORT1_STYLE_ITEMS || []).map(function (q) {
      return { 문장: q[0], 보기: q[1], 정답: q[2], 판: 'c1:' + COHORT1_WEEKS_VER, 목표: '요목:' + 주.요목 };
    });
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) { out.오류 = 'CLAUDE_API_KEY 없음'; return out; }
  const 목표들 = 문형없음 ? ['요목:' + 주.요목] : (주.문형 || []);
  const 설명 = 목표들.map(function (g) {
    if (g.indexOf('요목:') === 0) return g + ' = 글 말투(-ㄴ다/-는다) ↔ 말 말투(-아/어요) 가르기';
    const row = (typeof GRAMMAR_BANK === 'undefined' ? [] : GRAMMAR_BANK).filter(function (r) { return r[0] === g; })[0];
    return g + ' = ' + (row ? row[1] + ' · ' + row[2] : '(은행에 없음)');
  }).join('\n');
  const 굳수 = 문형없음 ? 0 : COHORT1_BUNDLE_SIZE.굳히기;
  const user = '문형:\n' + 설명 + '\n\n지을 것: 굳히기 ' + 굳수 + '개(문형마다 고르게) · 낭독 ' + COHORT1_BUNDLE_SIZE.낭독 +
    '개(문형마다 하나) · 답하기 ' + COHORT1_BUNDLE_SIZE.답하기 + '개(문형마다 하나). 굳히기의 target 은 문형 번호 그대로.';
  const schema = { type: 'object', additionalProperties: false, required: ['drill', 'read', 'answer'], properties: {
    drill: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['target', 'sentence', 'options', 'answer'],
      properties: { target: { type: 'string' }, sentence: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'integer' } } } },
    read: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['target', 'sentence'], properties: { target: { type: 'string' }, sentence: { type: 'string' } } } },
    answer: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['target', 'question'], properties: { target: { type: 'string' }, question: { type: 'string' } } } }
  } };
  try {
    const j = aiCall_(apiKey, AUTO_GEN_SYSTEM_, user, schema, 4096);
    if (!문형없음) {
      const 초벌 = (j.drill || []).map(function (q) { return q && { 문장: String(q.sentence || ''), 보기: q.options, 정답: q.answer, 판: 판, 목표: q.target }; });
      // 둘째 눈 — 「정답이 하나뿐인가 · 보기 넷이 같은 자리의 어미인가」를 따로 묻는다. 실패하면 검문 없음 = 전부 안 낸다(공급실패로 남는다)
      let 검문 = null;
      try {
        const k = aiCall_(apiKey, '한국어 문법 문항 검문관. 문항마다 «정답이 하나뿐인가»만 본다 — 보기 중 둘 이상이 자연스럽게 들어가면 false. 문법 설명은 쓰지 않는다.',
          JSON.stringify(초벌.map(function (q) { return { s: q.문장, o: q.보기, a: q.정답 }; })),
          { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'array', items: { type: 'boolean' } } } }, 1024);
        검문 = Array.isArray(k.ok) && k.ok.length === 초벌.length ? k.ok : null;
      } catch (eK) { 검문 = null; }
      const 진단문장 = typeof 진단문장목록_ === 'function' ? 진단문장목록_() : [];
      out.굳히기문항 = 자율일문항거르기_(초벌, 진단문장, 검문 || 초벌.map(function () { return false; }));
      if (!검문) out.오류 = '검문 실패 — 굳히기 안 냄';
    }
    out.낭독 = (j.read || []).filter(function (s) { return s && s.sentence; }).map(function (s) { return { 문장: s.sentence, 목표: s.target, 판: 판 }; });
    out.답하기 = (j.answer || []).filter(function (s) { return s && s.question; }).map(function (s) { return { 물음: s.question, 목표: s.target, 판: 판 }; });
  } catch (e) {
    out.오류 = String(e && e.message || e).slice(0, 160);
  }
  return out;
}

/* 그 주 재료 — 같은 자율일의 행이 이미 있으면 그 첫 행의 굳히기·낭독·답하기를 «재사용»한다(재실행이 문항을 갈아 끼우지 않게).
 * 없으면 짓는다. */
function 자율일주재료_(주, 기존행들) {
  const 같은주 = Object.keys(기존행들 || {}).map(function (k) { return 기존행들[k].묶음; }).filter(function (b) { return b.자율일 === 주.일; });
  if (같은주.length) {
    const 항목 = 같은주[0].항목 || [];
    const 뽑 = function (종류, f) { return 항목.filter(function (a) { return a.종류 === 종류; }).map(f); };
    const 굳 = 뽑('굳히기', function (a) { return { 문장: a.문항.문장, 보기: a.문항.보기, 정답: a.문항.정답, 판: a.문항.판, 목표: a.목표 }; });
    const 낭 = 뽑('낭독', function (a) { return { 문장: a.문장, 목표: a.목표 }; });
    const 답 = 뽑('답하기', function (a) { return { 물음: a.물음, 목표: a.목표 }; });
    if (굳.length || 낭.length || 답.length) return { 굳히기문항: 굳, 낭독: 낭, 답하기: 답, 오류: '', 재사용: true };
  }
  return 자율일재료생성_(주);
}

/* quiz_log → 이 학생의 오답 행(첫 시도 · 오답 또는 찍맞 · 창 안). 우리 항목이면 목표 문형과 문항 스냅샷을 되찾는다.
 *   목표찾기 = 항목ID → { 목표, 문항 } (지난 묶음들에서 만든 지도) */
function 자율일오답행_(ss, sid, 컷ms, 목표찾기) {
  const ql = ss.getSheetByName('quiz_log');
  if (!ql || ql.getLastRow() < 2) return [];
  const H = QUIZ_LOG_HEADERS;
  const c = function (n) { return H.indexOf(n); };
  const w = Math.min(H.length, ql.getLastColumn());
  const agg = {};
  ql.getRange(2, 1, ql.getLastRow() - 1, w).getValues().forEach(function (r) {
    if (String(r[c('student_id')] || '').trim() !== sid) return;
    if (c('시도') >= 0 && (Number(r[c('시도')]) || 1) > 1) return;             // 첫 답만(v9.312 규약)
    const 판정 = String(r[c('정답여부')] || '').trim();
    const 찍맞 = 판정 === '정답' && String(r[c('확신도')] || '').trim() === QUIZ_CONFIDENCE[QUIZ_CONFIDENCE.length - 1];
    if (판정 !== '오답' && !찍맞) return;
    const d = toDate_(r[c('제출일')]) || (r[c('created_at')] instanceof Date ? r[c('created_at')] : null);
    if (!d || d.getTime() < 컷ms) return;
    const qid = String(r[c('퀴즈ID')] || '').trim();
    const 문제 = String(r[c('문제')] || '').trim();
    const key = qid || 문제;
    if (!key) return;
    const 우리 = 목표찾기 && 목표찾기[qid];
    const e = agg[key] = agg[key] || { id: qid || 문제.slice(0, 40), 문형: 우리 ? 우리.목표 : '', 반복: 0, t: 0,
      문항: 우리 ? 우리.문항 : { 문장: 문제, 정답: String(r[c('정답')] || '') } };
    e.반복++;
    if (d.getTime() > e.t) e.t = d.getTime();
  });
  return Object.keys(agg).map(function (k) { return agg[k]; });
}

/* 지난 묶음들에서 항목ID → { 목표, 문항 } 지도. 오답 되찾기와 전체복습 문형 세기에 쓴다. */
function 자율일목표지도_(기존행들) {
  const m = {};
  Object.keys(기존행들 || {}).forEach(function (k) {
    (기존행들[k].묶음.항목 || []).forEach(function (a) { if (a.항목ID && a.목표) m[a.항목ID] = { 목표: a.목표, 문항: a.문항 || null }; });
  });
  return m;
}

/* 토요일 밤 — 내일이 1기 자율일이면 학생마다 묶음을 짓는다. 그 밖의 날은 0초에 돌아선다. */
function sundayBundleBatch_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const 내일 = Utilities.formatDate(new Date(now.getTime() + 86400000), tz, 'yyyy-MM-dd');
  const 주 = 차시주_(내일);
  if (!주) return;                                               // 1기 자율일 전날이 아니다 — 정상
  if (isRehearsal_()) { rehearsalNote_('자율일 묶음: 리허설 중이라 짓지 않았다'); return; }
  const 학생들 = 자율일학생들_(ss);
  if (!학생들.length) {
    adminMail('[SYNK] ⚠️ 자율일 묶음 — 1기 반이 비어 있습니다', '내일(' + 내일 + ')이 1기 ' + 주.차시 + '차시 자율일인데 app_state 「1기반」 칸이 비었거나 그 반에 학생이 0명입니다. 묶음을 짓지 못했습니다.');
    return;
  }
  const sh = ensureSheet(ss, AUTO_ASSIGN_TAB_, AUTO_ASSIGN_HEADERS);
  const 기존 = 자율일행들_(sh);
  const 재료 = 자율일주재료_(주, 기존);
  const 목표찾기 = 자율일목표지도_(기존);
  const 컷 = now.getTime() - AUTO_WRONG_WINDOW_DAYS_ * 86400000;
  const 복습컷 = now.getTime() - AUTO_REVIEW_WINDOW_DAYS_ * 86400000;
  const 전체복습 = (주.유형 || []).indexOf('전체복습') > -1;
  const nowStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm');
  const 묶음들 = [], 새행 = [], 갱신 = [];
  let 실패 = 0;
  학생들.forEach(function (s) {
    const 오답행 = 자율일오답행_(ss, s.sid, 전체복습 ? 복습컷 : 컷, 목표찾기);
    let 전체복습문형 = null;
    if (전체복습) {                                              // 8주 동안 오답을 낸 문형 상위 셋(없으면 열둘 순환)
      const 셈 = {};
      오답행.forEach(function (w) { if (w.문형) 셈[w.문형] = (셈[w.문형] || 0) + w.반복; });
      전체복습문형 = Object.keys(셈).sort(function (a, b) { return 셈[b] - 셈[a]; }).slice(0, 3);
    }
    // 이월 — 지난 자율일 묶음에서 안 찬 굳히기·오답 항목이 이번 주 오답 자리를 먼저 차지한다(낭독·답하기는 이번 주 문형이 이긴다 · 설계 §③-㉣)
    const 지난 = 기존[s.sid + '|' + (COHORT1_WEEKS.filter(function (w) { return w.차시 === 주.차시 - 1; })[0] || {}).일];
    const 이월 = [];
    if (지난 && /^(부분|빈날)/.test(지난.묶음.완주판정 || '')) {
      const 항목별 = {};
      (지난.묶음.항목 || []).forEach(function (a) { 항목별[a.항목ID] = a; });
      (지난.묶음.빈항목 || []).forEach(function (id) {
        const a = 항목별[id];
        if (!a || (a.종류 !== '굳히기' && a.종류 !== '오답') || !a.문항) return;
        if (이월.length >= COHORT1_BUNDLE_SIZE.오답) return;
        이월.push({ 종류: '오답', 목표: a.목표, 문항: a.문항, 원오답: { 이월: id } });
      });
    }
    const 묶음 = 자율일묶음_(주, s.sid, { 굳히기문항: 재료.굳히기문항, 낭독: 재료.낭독, 답하기: 재료.답하기, 오답행: 오답행, 이월: 이월, 전체복습문형: 전체복습문형 });
    if (재료.오류 && 묶음.공급상태.indexOf('공급실패') === 0) 묶음.공급상태 += ' (' + 재료.오류 + ')';
    if (묶음.공급상태.indexOf('공급실패') === 0) 실패++;
    묶음들.push(묶음);
    const 있음 = 기존[묶음.배정ID];
    if (있음 && !자율일다시지을까_(있음.묶음)) { 묶음들[묶음들.length - 1] = 있음.묶음; return; }   // 발행 뒤 불변 — 이미 실린 묶음은 그대로(다리도 그것을 보낸다)
    if (있음) 갱신.push({ row: 있음.row, 값: 자율일행값_(묶음, nowStr) });
    else 새행.push(자율일행값_(묶음, nowStr));
  });
  갱신.forEach(function (u) { sh.getRange(u.row, 1, 1, AUTO_ASSIGN_HEADERS.length).setValues([u.값]); });
  if (새행.length) sh.getRange(sh.getLastRow() + 1, 1, 새행.length, AUTO_ASSIGN_HEADERS.length).setValues(새행);
  const 다리 = 자율일다리_(주, 묶음들);
  const 요약 = '1기 ' + 주.차시 + '차시 자율일(' + 주.일 + ') 묶음 ' + 묶음들.length + '명 — 공급 실패 ' + 실패 +
    (재료.재사용 ? ' · 재료 재사용' : ' · 재료 새로 지음') + (재료.오류 ? ' · 생성 오류: ' + 재료.오류 : '') + ' · 다리: ' + 다리;
  Logger.log('자율일 묶음: ' + 요약);
  if (실패 || 재료.오류) adminMail('[SYNK] ⚠️ 자율일 묶음 — 공급 실패 ' + 실패 + '명', 요약 + '\n\n공급 실패는 학생 잘못이 아니라 우리가 못 낸 것입니다. 월요일 판정에서 그 학생은 「공급 실패」로 따로 셉니다.');
  return 요약;
}

/* 다리 — 묶음을 talk 로 실어 보낸다. 세 값(URL·KEY·ANON)이 없으면 「미배선」(0초 스킵 · 고장이 아니다). */
function 자율일다리_(주, 묶음들) {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty('SUNDAY_BUNDLE_URL') || '').trim();
  const key = String(props.getProperty('SUNDAY_BUNDLE_KEY') || '').trim();
  const anon = String(props.getProperty('SUNDAY_BUNDLE_ANON') || '').trim();
  if (!url || !key || !anon) return '미배선';
  const 몸통 = { 자율일: 주.일, 차시판: COHORT1_WEEKS_VER, 묶음: 묶음들.filter(function (b) { return (b.항목 || []).length; }) };
  try {
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json',
      headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'x-sunday-bundle-key': key },
      payload: JSON.stringify(몸통), muteHttpExceptions: true });
    const code = res.getResponseCode();
    let j = null;
    try { j = JSON.parse(res.getContentText()); } catch (e) { j = null; }
    if (code !== 200 || !j || j.ok !== true) {                   // 200 을 성공으로 읽지 않는다 — 봉투를 본다(명부스윕_ 규약)
      adminMail('[SYNK] ⚠️ 자율일 묶음 다리가 거절됐습니다(HTTP ' + code + ')', '묶음은 시트에 남았지만 talk 로 못 갔습니다. 내일 앱은 평일 편지를 냅니다.\n' + String(res.getContentText() || '').slice(0, 400));
      return 'http' + code;
    }
    return 'ok';
  } catch (e) {
    adminMail('[SYNK] ⚠️ 자율일 묶음 다리 오류', String(e && e.message || e).slice(0, 300));
    return '오류';
  }
}

/* 월요일 새벽(그리고 화요일 한 번 더) — 어제 자율일 묶음의 항목이 찼는지 센다.
 *   굳히기·오답 = quiz_log(퀴즈ID = 항목ID) · 진단 = 진단세션(학생번호·역할·잰시각) · 낭독·답하기 = talk `SUNDAY_PROGRESS_URL`(없으면 미집계)
 *   화요일은 월요일에 «빈날·부분» 이던 행만 다시 세어 바뀐 것에 「(지각)」 표식을 붙인다(오프라인 큐 · 설계 §④). */
function sundayBundleJudge_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const now = new Date();
  const dow = Number(Utilities.formatDate(now, tz, 'u'));         // 1=월 … 7=일
  if (dow !== 1 && dow !== 2) return;
  const 뒤로 = dow === 1 ? 1 : 2;
  const 자율일 = Utilities.formatDate(new Date(now.getTime() - 뒤로 * 86400000), tz, 'yyyy-MM-dd');
  const 주 = 차시주_(자율일);
  if (!주) return;
  const sh = ss.getSheetByName(AUTO_ASSIGN_TAB_);
  if (!sh) return;
  const 기존 = 자율일행들_(sh);
  const 대상 = Object.keys(기존).map(function (k) { return 기존[k]; }).filter(function (e) {
    if (e.묶음.자율일 !== 자율일) return false;
    return dow === 1 ? !e.묶음.완주판정 : /^(빈날|부분)$/.test(e.묶음.완주판정);
  });
  const 이름 = {};
  const pf = ss.getSheetByName('profiles');
  if (pf && pf.getLastRow() >= 2) pf.getRange(2, 1, pf.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0]) 이름[String(r[0]).trim()] = String(r[1] || '').trim(); });
  // 배치가 아예 안 돈 날 — 1기 학생인데 그 자율일 행이 없으면 «공급실패(미배정)»다(심문 2회차 아스트라 P1 · 전원 미공급과 「집계할 학생 없음」이 같은 얼굴이 되지 않게)
  const 미배정 = dow === 1 ? 자율일학생들_(ss).filter(function (s) { return !기존[s.sid + '|' + 자율일]; }) : [];
  if (!대상.length && !미배정.length) return;
  const 퀴즈제출 = 자율일퀴즈제출_(ss, 자율일, tz);
  const 진단제출 = 자율일진단제출_(ss, 주, 자율일, tz);
  const 말하기 = 자율일말하기제출_(자율일);               // null = talk 답이 없다 → 미집계
  const 판정들 = [];
  const nowStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm');
  const H = AUTO_ASSIGN_HEADERS;
  대상.forEach(function (e) {
    const b = e.묶음;
    const 제출 = (퀴즈제출[b.배정ID] || []).concat(진단제출[b.학생ID] ? [{ 항목ID: 자율일항목ID_(b.배정ID, '진단', 1) }] : [])
      .concat(말하기 ? (말하기[b.배정ID] || []) : []);
    const r = 자율일완주_(b, 제출, { 미집계: 말하기 ? [] : ['낭독', '답하기'] });
    let 판정 = r.판정;
    if (dow === 2 && 판정 !== b.완주판정) 판정 += '(지각)';
    if (dow === 2 && 판정 === b.완주판정) return;                 // 화요일에 안 바뀐 행은 손대지 않는다
    sh.getRange(e.row, H.indexOf('완주판정') + 1, 1, 6).setValues([[판정, r.찬수, r.항목수, JSON.stringify(r.미집계), JSON.stringify(r.빈항목), nowStr]]);
    판정들.push({ 이름: 이름[b.학생ID] || b.학생ID, 판정: 판정 });
  });
  if (dow === 1) {
    미배정.forEach(function (s) { 판정들.push({ 이름: s.name, 판정: '공급실패' }); });
    const 줄 = 자율일한줄_(판정들, 자율일) + (미배정.length ? '\n(공급 실패 중 ' + 미배정.length + '명은 묶음 행 자체가 없다 — 토요일 밤 배치가 안 돌았거나 1기 반이 그때 비어 있었다)' : '') +
      (말하기 ? '' : '\n(낭독·답하기는 talk 답이 없어 이번 셈에서 뺐습니다 — SUNDAY_PROGRESS_URL 미배선)');
    adminMail('[SYNK] 자율일 한 줄 — ' + 자율일, 줄);
    Logger.log(줄);
  }
}

/* quiz_log 에서 «배정ID#…» 꼴 퀴즈ID 로 들어온 제출을 배정ID 별로 모은다(자율일 당일 이후만 · 날짜는 시트 시간대 문자열로 견준다). */
function 자율일퀴즈제출_(ss, 자율일, tz) {
  const ql = ss.getSheetByName('quiz_log');
  const out = {};
  if (!ql || ql.getLastRow() < 2) return out;
  const H = QUIZ_LOG_HEADERS;
  const c = function (n) { return H.indexOf(n); };
  const w = Math.min(H.length, ql.getLastColumn());
  ql.getRange(2, 1, ql.getLastRow() - 1, w).getValues().forEach(function (r) {
    const qid = String(r[c('퀴즈ID')] || '').trim();
    const i = qid.indexOf('#');
    if (i < 1) return;
    const d = toDate_(r[c('제출일')]) || (r[c('created_at')] instanceof Date ? r[c('created_at')] : null);
    if (!d || Utilities.formatDate(d, tz, 'yyyy-MM-dd') < 자율일) return;
    const 배정ID = qid.slice(0, i);
    (out[배정ID] = out[배정ID] || []).push({ 항목ID: qid });
  });
  return out;
}

/* 진단세션 — 그 주 역할(중간·끝)로 자율일 당일 이후에 «완주» 한 학생번호 집합. 시트가 없으면 {}. */
function 자율일진단제출_(ss, 주, 자율일, tz) {
  const out = {};
  if (!주.진단) return out;
  const sh = ss.getSheetByName(typeof DIAG_SESSION_TAB_ === 'undefined' ? '진단세션' : DIAG_SESSION_TAB_);
  if (!sh || sh.getLastRow() < 2) return out;
  const H = typeof DIAG_SESSION_HEADERS === 'undefined' ? [] : DIAG_SESSION_HEADERS;
  const c = function (n) { return H.indexOf(n); };
  if (c('학생번호') < 0) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues().forEach(function (r) {
    const sid = String(r[c('학생번호')] || '').trim();
    if (!sid || String(r[c('역할')] || '') !== 주.진단) return;
    if (String(r[c('상태')] || '').indexOf('완주') !== 0) return;
    const d = r[c('잰시각')] instanceof Date ? r[c('잰시각')] : toDate_(r[c('잰시각')]);
    if (d && Utilities.formatDate(d, tz, 'yyyy-MM-dd') >= 자율일) out[sid] = 1;
  });
  return out;
}

/* talk 가 되돌려 주는 말하기 충족 — GET SUNDAY_PROGRESS_URL?자율일=… → { ok, 배정: { 배정ID: [항목ID,…] } }. 없거나 실패면 null(미집계). */
function 자율일말하기제출_(자율일) {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty('SUNDAY_PROGRESS_URL') || '').trim();
  const anon = String(props.getProperty('SUNDAY_BUNDLE_ANON') || '').trim();
  if (!url || !anon) return null;
  try {
    const res = UrlFetchApp.fetch(url + (url.indexOf('?') > -1 ? '&' : '?') + 'day=' + encodeURIComponent(자율일),
      { method: 'get', headers: { apikey: anon, Authorization: 'Bearer ' + anon }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    const j = JSON.parse(res.getContentText());
    if (!j || j.ok !== true || !j.배정 || typeof j.배정 !== 'object') return null;
    const out = {};
    Object.keys(j.배정).forEach(function (id) { out[id] = (j.배정[id] || []).map(function (x) { return { 항목ID: String(x) }; }); });
    return out;
  } catch (e) { return null; }
}
