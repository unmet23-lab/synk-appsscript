/* 궤적 레일 회귀 — 「무엇을 목표했고 실제로 어디로 갔나」가 한 사람으로 이어지는가.
 *
 * 왜 있나: 로드맵 ④(유학 집약 봇)의 유일한 비복제 자산이 의도↔결과의 짝이다.
 *   그리고 이건 **소급 불가**다 — 학생이 떠나면 연락이 끊긴다. 코드를 나중에 짜도 데이터는 안 온다.
 *   그래서 이 파일이 지키는 것은 「기능이 있는가」가 아니라 **「값이 조용히 뭉개지지 않는가」**다.
 *
 * 소스 검사 + 순수 함수 실행 검증(Apps Script 런타임 없이 도는 층 · tests/폼안전.test.js 계보).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
/* 시트 흉내는 공용 하나다 — 계약·근거·변이 픽스처가 거기 산다(#Q85 · F460). */
const { 시트흉내 } = require('./lib/시트흉내.js');
/* 부정 단언의 주어만 정제한다 — 주석이 금지 패턴을 «설명»하면 그 설명이 위반으로 잡힌다(대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');

// SYNK_TEST_SRC_ROOT = 변이 실험용 이음매. 평소엔 실소스를 본다(실파일은 절대 안 건드린다 · F065·F067).
const ROOT = process.env.SYNK_TEST_SRC_ROOT || path.resolve(__dirname, '..');
const 궤적 = fs.readFileSync(path.join(ROOT, '엔진_궤적.js'), 'utf8');
const 배치 = fs.readFileSync(path.join(ROOT, '엔진_운영배치.js'), 'utf8');
const 폼리포트 = fs.readFileSync(path.join(ROOT, '엔진_폼리포트.js'), 'utf8');

/** 톱레벨 const 배열/객체 리터럴을 실값으로 꺼낸다(문자열 대조보다 강하다 — 순서·공백에 안 흔들린다). */
function 상수(src, name) {
  const i = src.indexOf('const ' + name + ' = ');
  assert.notEqual(i, -1, name + ' 상수를 못 찾았다');
  const open = src.indexOf(src[src.indexOf('=', i) + 2] === '{' ? '{' : '[', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (!depth) return new Function('return ' + src.slice(open, j + 1))(); }
  }
  assert.fail(name + ' 리터럴 끝을 못 찾았다');
}

/** 최상위 function 본문을 이름으로 잘라 온다(중괄호 깊이 추적). */
function 함수본문(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.notEqual(i, -1, name + ' 함수를 못 찾았다');
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  assert.fail(name + ' 본문 끝을 못 찾았다');
}

/** 톱레벨 문자열 const 를 실값으로 꺼낸다(상수() 는 배열·객체 리터럴 전용이라 못 받는다). */
function 문자열상수(src, name) {
  const m = new RegExp('const ' + name + " = '([^']*)'").exec(src);
  assert.ok(m, name + ' 문자열 상수를 못 찾았다');
  return m[1];
}

/** 함수 **안**의 배열 리터럴을 주입한 바인딩으로 평가한다.
 * 문자열 대조가 아니라 값을 보기 위한 이음매다 — 같은 목록을 다른 바인딩으로 두 번 평가하면
 * 「상수를 참조하는가, 이름을 또 적었는가」가 결과로 갈린다(문구 검사로는 절대 안 갈린다 · F087). */
function 배열리터럴(src, decl, binding) {
  const i = src.indexOf(decl);
  assert.notEqual(i, -1, decl + ' 를 못 찾았다');
  const open = src.indexOf('[', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']') {
      depth--;
      if (!depth) return new Function(...Object.keys(binding), 'return ' + src.slice(open, j + 1))(...Object.values(binding));
    }
  }
  assert.fail(decl + ' 리터럴 끝을 못 찾았다');
}

/** 순수 함수만 꺼내 실행한다(시트 API에 안 닿는 것들). */
function 실행(names) {
  const src = names.map((n) => (n.startsWith('const ') ? '' : '') + (n.indexOf('function ') === 0 ? 함수본문(궤적, n.slice(9)) : n)).join('\n');
  return src;
}

// ── 🔴 두 축 직교 ─────────────────────────────────────────────────────────

test('🔴 결과종류(어느 길)와 단계(어디까지)가 섞이지 않는다', () => {
  /* 「비자 거절」을 결과종류에 넣으면 **거절당한 사람이 목표하던 길이 통째로 사라진다.**
   * 거절은 결과가 아니라 어느 길 위의 한 단계다 — 재도전이 정상이기 때문이다.
   * 이 검사가 무너지면 2년 뒤 「E-9를 노렸다가 거절되고 유학으로 튼 사람」을 셀 수 없다. */
  const kinds = 상수(궤적, 'OUTCOME_KINDS_');
  const stages = 상수(궤적, 'OUTCOME_STAGES_');
  kinds.forEach((k) => assert.ok(!/거절|불합격|보류|대기/.test(k),
    `결과종류에 단계 어휘가 섞였다: ${k} — 거절은 「어느 길」이 아니라 「어디까지」다`));
  assert.ok(stages.some((s) => /거절/.test(s)), '단계에 거절이 없다 — 그럼 거절을 어디에 적나');
});

test('모든 결과종류가 경로 버킷을 갖는다 — 대조가 조용히 「분류 불가」로 새지 않게', () => {
  const kinds = 상수(궤적, 'OUTCOME_KINDS_');
  const path_ = 상수(궤적, 'OUTCOME_PATH_');
  kinds.forEach((k) => assert.ok(path_[k], `결과종류 「${k}」에 버킷이 없다 — 대조가 영원히 분류 불가로 떨어진다`));
});

// ── 🔑 두 목록의 정합 (다른 파일과 갈라지는 지점) ─────────────────────────

test('🔑 면접폼 선택지 전부가 수확 매핑에 있다 — 늘리고 여길 안 고치면 조용히 뭉개진다', () => {
  /* INTERVIEW_KINDS는 엔진_폼리포트.js가 정본이다. 거기 한 줄을 늘리는 것은 쉽고,
   * 늘린 값은 여기서 '기타·미상'으로 떨어진다 — 에러가 아니라 **조용한 정보 손실**이라 아무도 모른다. */
  const kinds = 상수(폼리포트, 'INTERVIEW_KINDS');
  const map = 상수(궤적, 'INTERVIEW_TO_KIND_');
  kinds.forEach((k) => assert.ok(map[k], `면접 종류 「${k}」가 수확 매핑에 없다 — 그 면접 전부가 기타·미상으로 뭉개진다`));
});

test('🔑 면접폼 「결과」 4지선다 전부가 단계 매핑에 있다', () => {
  /* 폼 정본은 생성부에 인라인 배열로 있다 — 문항을 고치면 여기가 갈라진다.
   * 매핑이 없으면 기본값 '대기중'으로 떨어져 **합격이 대기로 기록된다**(가장 나쁜 방향). */
  const 생성 = 함수본문(폼리포트, 'createInterviewLogForm');
  const m = /mc\('결과', \[([^\]]*)\]/.exec(생성);
  assert.ok(m, '면접폼 결과 문항을 못 찾았다 — 폼 구조가 바뀌었다');
  const opts = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  const map = 상수(궤적, 'INTERVIEW_TO_STAGE_');
  const stages = 상수(궤적, 'OUTCOME_STAGES_');
  opts.forEach((o) => {
    assert.ok(map[o], `면접 결과 「${o}」가 단계 매핑에 없다 — 기본값 대기중으로 떨어져 합격이 대기로 기록된다`);
    assert.ok(stages.indexOf(map[o]) !== -1, `매핑 결과 「${map[o]}」가 단계 정본에 없다 — 드롭다운과 갈라진다`);
  });
});

// ── 멱등 ──────────────────────────────────────────────────────────────────

test('수확이 멱등이다 — 근거키 조회가 적재보다 앞이고, 그 결과를 실제로 쓴다', () => {
  /* 두 번 수확하면 한 사람이 두 번 합격한 것처럼 집계된다. 그리고 그건 화면에 안 보인다.
   * ⚠ 「순서만」 보면 샌다(면접궤적.test.js가 변이 실측에서 배운 것) — **결과를 쓰는 분기**까지 못박는다. */
  const fn = 함수본문(궤적, '궤적수확_면접_');
  const i조회 = fn.indexOf('있음[');
  const i분기 = fn.indexOf('if (!원천 || 있음[key]) return');
  const i적재 = fn.indexOf('신규.push');
  assert.notEqual(i조회, -1, '기존 근거키를 읽지 않는다 — 매일 아침 같은 행이 쌓인다');
  assert.notEqual(i분기, -1, '조회 결과를 쓰는 분기가 없다 — 읽어만 보고 그냥 적재한다');
  assert.ok(i조회 < i분기 && i분기 < i적재, '조회→분기→적재 순서가 깨졌다');
  assert.ok(/있음\[key\] = 1/.test(fn),
    '같은 배치 안 중복을 안 막는다 — 한 사람이 같은 면접을 두 번 제출하면 두 행이 된다');
});

test('근거키가 원천을 식별한다 — 사람ID만으로 만들면 두 번째 면접이 영원히 안 들어온다', () => {
  const fn = 함수본문(궤적, '궤적수확_면접_');
  assert.match(fn, /const key = '면접폼:' \+ sid \+ ':' \+ 원천/,
    '근거키 조립이 바뀌었다 — sid만 쓰면 같은 사람의 2번째 관측이 통째로 스킵된다');
});

// ── 🔑 읽는 방식 ──────────────────────────────────────────────────────────

test('🔑 면접기록_응답을 **헤더 이름**으로 읽는다 (위치로 읽으면 문항 추가에 조용히 어긋난다)', () => {
  /* migrateInterviewSid가 라이브 폼에 문항을 끼워 넣으면 응답 시트에 열이 붙는다.
   * 위치 파싱이면 그날부터 「면접 종류」 자리에서 「사용 언어」를 읽는다 — 에러 없이. */
  const fn = 함수본문(궤적, '궤적수확_면접_');
  assert.ok(/col\[h\] === undefined/.test(fn), '헤더 인덱스 맵을 만들지 않는다');
  ['학생ID', '면접 종류', '결과', '시기', '장소·기관', '자료활용동의'].forEach((h) => {
    assert.ok(fn.indexOf("col['" + h + "']") !== -1, `「${h}」를 헤더 이름으로 읽지 않는다`);
  });
  // 1열(타임스탬프)만 위치로 읽는 것은 폼 연결 시트의 불변 규약이다 — 그 하나만 허용한다
  const 위치읽기 = (fn.match(/r\[\d+\]/g) || []).filter((s) => s !== 'r[0]');
  assert.deepEqual(위치읽기, [], `응답 시트를 위치로 읽는 곳이 남아 있다: ${위치읽기.join(',')}`);
});

test('🔑 활용동의로 수확을 거르지 않는다 — 거르면 커버리지가 거짓이 된다', () => {
  /* 학원이 자기 학생의 진로를 기록하는 것은 운영이고, 「AI 학습에 써도 되는가」는 그 다음 질문이다.
   * 수확 단계에서 걸러 버리면 동의 안 한 사람의 결과가 **운영 통계에서까지 사라진다** —
   * 그러면 「결과 확인 12/40명」이 거짓말이 되고, 유호님은 없는 데이터를 있다고 믿는다.
   * 대신 칸에 담아 두고 내보낼 때 거른다. */
  const fn = 함수본문(궤적, '궤적수확_면접_');
  assert.ok(fn.indexOf("col['자료활용동의']") !== -1, '활용동의를 아예 안 싣는다 — 나중에 내보낼 때 거를 수단이 없다');
  assert.ok(!/자료활용동의.*\)\s*!==|동의.*return(?!.*push)/.test(fn.replace(/\/\*[\s\S]*?\*\//g, '')),
    '활용동의를 조건으로 return 한다 — 운영 커버리지가 동의율만큼 거짓으로 낮아진다');
});

// ── 대조 판정 실행 검증 ───────────────────────────────────────────────────

test('🔴 대조 판정 — 「모른다」를 「일치」로 세지 않는다', () => {
  /* 뭉치는 순간 커버리지가 부풀고, 부푼 커버리지는 「데이터가 쌓이고 있다」는 착각이 된다.
   * 이 저장소는 같은 형태로 이미 당했다(무데이터를 만점으로 세던 채점기 · 534e8a8). */
  const src = [함수본문(궤적, '궤적_과정버킷_'), 함수본문(궤적, '궤적_의도버킷_'), 함수본문(궤적, '궤적_대조_'),
    '\nconst OUTCOME_PATH_ = ' + JSON.stringify(상수(궤적, 'OUTCOME_PATH_')) + ';',
    '\nfunction 미정값_(v){ return !v || /미정|모름|모르|정하지/.test(String(v)); }'].join('\n');
  const 대조 = new Function(src + '\nreturn 궤적_대조_;')();

  assert.equal(대조('한국 정착', '학사', '', null), '미관측', '관측이 없는데 판정을 냈다');
  assert.equal(대조('', '', '', { stage: '대기중', kind: '한국 대학·대학원 입학' }), '진행중');
  assert.equal(대조('한국 정착', '학사', '', { stage: '불합격·거절', kind: '유학(D-2·D-4) 비자' }), '좌절(재도전 가능)');
  assert.equal(대조('', '', '', { stage: '합격·승인', kind: '한국 대학·대학원 입학' }), '의도 미정',
    '의도가 없는데 일치로 셌다 — 분모가 조용히 부푼다');
  assert.equal(대조('한국 정착', '학사', '', { stage: '합격·승인', kind: '한국 대학·대학원 입학' }), '일치');
  assert.equal(대조('한국 정착', '', 'E-9 비전문', { stage: '합격·승인', kind: '한국 취업(E-9 비전문)' }), '일치');
  assert.equal(대조('한국 정착', '학사', '', { stage: '합격·승인', kind: '한국 취업(E-9 비전문)' }),
    '불일치(유학→취업)', '이 한 줄이 로드맵 ④의 학습 신호다 — 바뀌면 신호가 사라진다');
});

test('의도 버킷은 **가까운 목표**를 먼저 본다 — 뒤집으면 진학자가 전부 불일치로 찍힌다', () => {
  const src = [함수본문(궤적, '궤적_과정버킷_'), 함수본문(궤적, '궤적_의도버킷_'),
    '\nfunction 미정값_(v){ return !v || /미정|모름|모르|정하지/.test(String(v)); }'].join('\n');
  const 버킷 = new Function(src + '\nreturn 궤적_의도버킷_;')();
  // 10년 후 「한국 정착」 + 내년 「학사」 → 우리가 관측하는 것은 후자다
  assert.equal(버킷('한국 정착', '학사', 'F-5 영주'), '유학');
  assert.equal(버킷('한국 정착', '', 'E-7 전문직'), '취업');
  assert.equal(버킷('몽골 복귀', '', ''), '몽골');
  assert.equal(버킷('', '', ''), '', '아무 답도 없는데 버킷을 지어냈다');
  /* 🔑 경로가 아닌 답은 버킷이 안 된다 — 목적지(한국 정착·F-5 영주)를 경로로 세면
   *   E-9 취업에 성공한 사람이 「불일치(정착→취업)」로 찍힌다(목표를 향해 간 사람을 이탈로 센다). */
  assert.equal(버킷('한국 정착', '', ''), '', '10년 후 목적지를 경로로 셌다');
  assert.equal(버킷('', '', 'F-5 영주'), '', '길의 끝(영주)을 길로 셌다');
});

test('관측일 — 자유 입력 「시기」의 여러 표기를 연-월로 접고, 못 읽으면 제출 시각으로 떨어진다', () => {
  const 관측일 = new Function(함수본문(궤적, '궤적_관측일_') + '\nreturn 궤적_관측일_;')();
  ['2026-05', '2026.5', '2026년 5월', '2026/05'].forEach((s) => {
    assert.equal(관측일(s, null, 'Asia/Ulaanbaatar'), '2026-05', `「${s}」를 못 읽는다`);
  });
  assert.equal(관측일('2026-13', null, 'Asia/Ulaanbaatar'), '', '13월을 통과시켰다');
  assert.equal(관측일('기억 안 남', null, 'Asia/Ulaanbaatar'), '', '못 읽었는데 값을 지어냈다');
});

// ── 🔑 발동 조건 ──────────────────────────────────────────────────────────

test('🔑 스스로 발화한다 — syncProfiles가 매일 아침 부른다', () => {
  /* CLAUDE.md 「장치와 그 발동 조건은 같은 커밋에서 정한다 — 스스로 발화하지 않는 장치는 안 돈다」.
   * 메뉴 버튼으로만 두면 유호님이 눌러야 도는 장치가 되고, 그런 장치는 결국 안 눌린다. */
  assert.match(배치, /if \(typeof 궤적갱신_ === 'function'\) 궤적갱신_\(src\)/,
    'syncProfiles가 궤적갱신_를 부르지 않는다 — 만든 것과 도는 것은 다르다');
  const sync = 함수본문(배치, 'syncProfiles');
  assert.ok(sync.indexOf('궤적갱신_(src)') !== -1, '호출이 syncProfiles 밖에 있다 — 아침 배치가 안 태운다');
});

test('궤적 실패가 로스터 동기화를 죽이지 않는다 (그리고 조용히 죽지도 않는다)', () => {
  const fn = 함수본문(궤적, '궤적갱신_');
  assert.ok(/try\s*\{/.test(fn) && /catch/.test(fn), '자체 try가 없다 — 궤적 예외가 아침 동기화를 통째로 되돌린다');
  assert.ok(/궤적경보_\(ss, String\(e\)/.test(fn), '실패를 삼키기만 한다 — 조용한 실패는 6개월 뒤에 발각된다');
  const 경보 = 함수본문(궤적, '궤적경보_');
  assert.ok(/getState\(st, '궤적실패'\).val \|\| ''\) === sig/.test(경보),
    '상태 변화 판정이 없다 — 같은 실패가 매일 오면 그 메일은 읽히지 않는다(F072)');
});

// ── 프라이버시 ────────────────────────────────────────────────────────────

test('⛔ 두 시트가 Glide 금지 선언과 함께 있다 — 남의 결과가 학생 기기로 내려가면 안 된다', () => {
  /* Row Owner는 행 전체를 학생 기기로 내려보낸다(구 조립가이드의 실측 경고). trajectory는
   * 한 행이 한 사람이지만, outcome_log는 남의 행까지 같은 시트에 있다. 화면을 안 만드는 것이 방어다. */
  assert.match(궤적, /⛔ Glide 바인딩 금지/, 'Glide 금지 선언이 사라졌다 — 다음 조립 때 올라간다');
  assert.ok(!/setAppState_|CARD_FONT|Glide/.test(코드만(함수본문(궤적, '궤적재작성_'))),
    'trajectory가 앱 상태·카드로 새어 나가는 경로가 생겼다');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 실행 층 — 소스 검사가 놓친 것들 [2026-08-04 적대 리뷰]
 *
 * 위쪽 소스 검사 15건은 **전부 초록인 채로** HIGH 3건을 통과시켰다. 공통점이 하나다:
 *   「순서가 맞는가」·「그 문자열이 있는가」만 봤고 **「값이 맞는가」를 안 봤다.**
 * 그래서 여기서는 시트를 흉내 내 **실제로 돌린다.** 문구를 바꿔도 안 걸리고, 동작이 틀리면 걸린다.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 시트 스텁 — 쓰기·비우기·서식·삼킴은 **공용 통로**에 얹는다(`tests/lib/시트흉내.js` · #Q85 · F460).
 *   여기서 손으로 다시 지으면 그 순간 사본이 되고, 라이브와 갈라져도 아무도 못 잰다 —
 *   실제로 옛 판의 `clearContent` 는 **no-op** 이었다(계약 ③ 위반: 「지운 자리에 덮어쓴다」가
 *   어긋나도 초록이 되는 «착한 쪽» 모양). 여기 남은 것은 궤적 시험에만 필요한 겉면뿐이다. */
function 가짜시트_(이름, 격자) {
  const sh = 시트흉내({ 첫행: 1, 행들: 격자 });
  const 원래getRange = sh.getRange.bind(sh);
  return Object.assign(sh, {
    _g: sh.data, _서식: sh.서식,
    getName: () => 이름,
    getMaxRows: () => Math.max(sh.data.length, 1000),
    getMaxColumns: () => 40,
    insertRowsAfter() { return this; },
    insertColumnsAfter() { return this; },
    setFrozenRows() { return this; },
    getFormUrl: () => '',
    getRange(r, c, nr, nc) {
      const rng = 원래getRange(r, c, nr, nc);
      rng.setFontWeight = () => rng;
      rng.setDataValidation = () => rng;
      return rng;
    },
  });
}

/** 엔진_궤적.js 를 스텁 전역과 함께 평가해 함수들을 꺼낸다. */
function 궤적로드_(시트들) {
  const 상태 = {};
  const ss = {
    getSheetByName: (n) => 시트들[n] || null,
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
    insertSheet: (n) => (시트들[n] = 가짜시트_(n, [[]])),
  };
  const 전역 = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build: () => ({}) }),
    },
    Logger: { log() {} },
    Utilities: { formatDate: (d, tz, f) => {
      const p = (n) => (n < 10 ? '0' : '') + n;
      const s = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      return f === 'yyyy-MM' ? s.slice(0, 7) : s;
    } },
    ensureSheet: (s, n, h) => 시트들[n] || (시트들[n] = 가짜시트_(n, [h.slice()])),
    writeIfChanged: (sh, r, c, v) => { sh.getRange(r, c, v.length, v[0].length).setValues(v); return true; },
    getState: (st, k) => ({ row: 상태[k] === undefined ? -1 : 1, val: 상태[k] === undefined ? '' : 상태[k] }),
    setState: (st, k, v) => { 상태[k] = v; },
    adminMail: () => {},
    미정값_: (v) => !v || /미정|모름|모르|정하지/.test(String(v)),
    // 실제 구현과 같은 계약: Date→'yyyy-MM', 문자열은 그대로
    ymTextOf_: (v, tz) => {
      if (v instanceof Date) { const p = (n) => (n < 10 ? '0' : '') + n; return v.getFullYear() + '-' + p(v.getMonth() + 1); }
      return String(v == null ? '' : v);
    },
    ymTextColFix_: (sh, col) => { sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@'); return 0; },
  };
  const 이름 = Object.keys(전역);
  const 꺼낼 = ['궤적갱신_', '궤적수확_면접_', '궤적재작성_', '궤적_최신관측_', '궤적_결과시트_', 'OUTCOME_HEADERS_', 'OUTCOME_KEY_COL_'];
  const fn = new Function(...이름, 궤적 + '\nreturn {' + 꺼낼.join(',') + '};');
  return Object.assign(fn(...이름.map((n) => 전역[n])), { ss, 시트들, 상태 });
}

const 면접헤더_ = ['타임스탬프', '이름', '학생ID', '지금 신분', '연락처', '면접 종류', '시기',
  '장소·기관', '사용 언어', '걸린 시간', '받은 질문 전부', '어떻게 답했나요',
  '다시 물어보거나 서류를 지적한 부분', '준비하면서 가장 어려웠던 것', '결과',
  '거절·보류였다면 들은 사유', '다음 사람에게 한마디', '자료활용동의'];

const 면접행_ = (ts, sid, 종류, 시기, 결과, 동의) => {
  const r = new Array(면접헤더_.length).fill('');
  r[0] = ts; r[1] = '바트'; r[2] = sid; r[5] = 종류; r[6] = 시기; r[14] = 결과; r[17] = 동의;
  return r;
};

test('🔴 수확이 정말 멱등이다 — 3번 돌려도 행이 안 는다 (근거키 열이 한 칸 밀려 있었다)', () => {
  /* 소스 검사(「조회→분기→적재 순서」)는 이 결함에서 **초록이었다.** 상수가 근거키가 아니라
   * created_at 을 가리켜 조회가 영원히 miss 했고, 에러도 안 났다(존재하는 열이라 getRange가 안 던진다).
   * 로그는 매일 「신규 관측 N건」을 정상처럼 보고했다. 그래서 순서가 아니라 **행 수**를 잰다. */
  const 시트 = { 면접기록_응답: 가짜시트_('면접기록_응답', [면접헤더_,
    면접행_(new Date(2026, 4, 10), 'SYNK-001', '한국 유학 비자 인터뷰', '2026-05', '합격·승인', '네, 동의합니다'),
    면접행_(new Date(2026, 4, 11), 'SYNK-002', 'EPS 취업(E-9) 면접·시험', '2026-05', '불합격·거절', '아니요, 원하지 않습니다')]) };
  const m = 궤적로드_(시트);
  assert.equal(m.OUTCOME_HEADERS_[m.OUTCOME_KEY_COL_], '근거키',
    '근거키 열 상수가 헤더의 근거키를 안 가리킨다 — 멱등 조회가 엉뚱한 열을 읽는다');
  assert.equal(m.궤적수확_면접_(m.ss), 2, '첫 수확이 2건이 아니다');
  const 행수 = () => m.시트들.outcome_log._g.length - 1;
  assert.equal(행수(), 2);
  assert.equal(m.궤적수확_면접_(m.ss), 0, '두 번째 수확이 0건이 아니다 — 멱등이 죽었다');
  assert.equal(m.궤적수확_면접_(m.ss), 0, '세 번째 수확이 0건이 아니다');
  assert.equal(행수(), 2, `3회 실행 후 행이 ${행수()}개다 — 매일 아침 복제된다`);
});

test('🔑 활용동의로 거르지 않는다 — 「아니요」 응답도 실린다 (문구가 아니라 행동으로)', () => {
  /* 옛 부정 정규식은 동의값을 변수로 한 번만 빼면 통째로 샜다(리뷰가 실측). 그래서 결과를 본다. */
  const 시트 = { 면접기록_응답: 가짜시트_('면접기록_응답', [면접헤더_,
    면접행_(new Date(2026, 4, 11), 'SYNK-002', '한국 기업 취업 면접', '2026-05', '합격·승인', '아니요, 원하지 않습니다')]) };
  const m = 궤적로드_(시트);
  assert.equal(m.궤적수확_면접_(m.ss), 1, '동의 안 한 응답이 수확에서 빠졌다 — 운영 커버리지가 동의율만큼 거짓이 된다');
  const 행 = m.시트들.outcome_log._g[1];
  assert.equal(행[m.OUTCOME_HEADERS_.indexOf('활용동의')], '아니요, 원하지 않습니다',
    '활용동의 값이 안 실렸다 — 나중에 내보낼 때 거를 수단이 없다');
});

test('🔴 관측일 열이 텍스트로 굳는다 — 안 굳히면 최신 판정이 요일·월 알파벳순으로 뒤집힌다', () => {
  /* 이 저장소의 월키 Date 오염 5번째 자리. outcome_log 는 sheetSkeleton_ 밖이라 자기치유도 안 닿는다. */
  const m = 궤적로드_({});
  const sh = m.궤적_결과시트_(m.ss);
  m.궤적갱신_(null); // 서식 고정 통로를 태운다(상담시트 null 이라 재작성은 조기 반환)
  assert.equal(m.시트들.outcome_log._서식[3], '@',
    'outcome_log 관측일(3열)에 텍스트 서식이 없다 — 시트가 2026-05 를 Date 로 재파싱한다');
});

test('🔴 최신 관측은 시간순이다 — 셀이 Date 로 굳어 있어도', () => {
  /* 오염된 셀을 되읽는 쪽도 방어해야 한다: 2026-05(금)과 2027-01(금)은 요일이 같아
   * String(Date) 비교에서 'May' > 'Jan' 이 되어 **옛 합격이 새 거절을 이긴다.** */
  const H = ['student_id', '이름', '관측일', '단계', '결과종류', '기관·회사명', '비자종류', '출처', '활용동의', '비고', '근거키', 'created_at'];
  const 시트 = { outcome_log: 가짜시트_('outcome_log', [H,
    ['SYNK-001', '바트', new Date(2026, 4, 1), '합격·승인', '한국 대학·대학원 입학', '', '', '면접폼(자동)', '', '', 'k1', ''],
    ['SYNK-001', '바트', new Date(2027, 0, 1), '불합격·거절', '유학(D-2·D-4) 비자', '', '', '면접폼(자동)', '', '', 'k2', '']]) };
  const m = 궤적로드_(시트);
  const 최신 = m.궤적_최신관측_(m.ss, 'Asia/Ulaanbaatar');
  assert.equal(최신['SYNK-001'].when, '2027-01',
    '옛 관측이 최신을 이겼다 — 좌절이어야 할 사람이 일치로 찍힌다(로드맵 ④ 학습 신호가 반대로 저장된다)');
  assert.equal(최신['SYNK-001'].stage, '불합격·거절');
});

test('🔑 outcome_log 자리는 면접 응답이 0건이어도 생긴다 — 절반은 원장이 손으로 적는다', () => {
  /* 수확 안에서만 만들면 개원 전(응답 0건)에는 시트가 영영 안 생긴다. 그러면 유호님이 탭을 손으로
   * 만들게 되고, 그 순간 헤더·드롭다운 어휘가 정본과 갈라진다(갈라지면 집계가 영원히 불가능). */
  const m = 궤적로드_({});
  m.궤적갱신_(null);
  assert.ok(m.시트들.outcome_log, '면접 응답이 없으면 outcome_log 가 안 생긴다 — 원장이 적을 자리가 없다');
  assert.deepEqual(m.시트들.outcome_log._g[0], m.OUTCOME_HEADERS_, '헤더가 정본과 다르다');
});

test('🔴 「아직 미정」·「취업비자준비」가 유학 의도로 둔갑하지 않는다', () => {
  /* 진로 5문항을 필수로 만들며 「아직 미정」을 신설했는데, 버킷이 **값이 아니라 존재**만 보고 있었다.
   * 정직하게 미정을 고른 학생이 가짜 불일치로 찍히는 것 = 「모른다를 일치로 세지 않는다」의 반대 위반. */
  const src = [함수본문(궤적, '궤적_과정버킷_'), 함수본문(궤적, '궤적_의도버킷_'), 함수본문(궤적, '궤적_대조_'),
    '\nconst OUTCOME_PATH_ = ' + JSON.stringify(상수(궤적, 'OUTCOME_PATH_')) + ';',
    '\nfunction 미정값_(v){ return !v || /미정|모름|모르|정하지/.test(String(v)); }'].join('\n');
  const 버킷 = new Function(src + '\nreturn 궤적_의도버킷_;')();
  const 대조 = new Function(src + '\nreturn 궤적_대조_;')();

  assert.equal(버킷('한국 정착', '아직 미정', '미정'), '', '「아직 미정」을 유학 의도로 셌다');
  assert.equal(버킷('한국 정착', '취업비자준비', ''), '취업',
    '상담폼의 「취업비자준비」를 유학으로 셌다 — EPS 취업자가 전원 불일치로 찍힌다');
  assert.equal(버킷('한국 정착', '학사', ''), '유학', '정상 진학 의도가 깨졌다');
  assert.equal(버킷('한국 정착', '어학연수 (D-4)', ''), '유학');
  assert.equal(버킷('', '듣도보도 못한 새 선택지', ''), '',
    '모르는 값을 유학으로 밀었다 — 선택지가 늘면 조용히 틀린다(보류가 정답)');
  assert.equal(대조('한국 정착', '아직 미정', '미정', { stage: '합격·승인', kind: '한국 취업(E-9 비전문)' }), '의도 미정',
    '없는 의도로 불일치 판정을 냈다');
});

test('🔑 「아직 미정」이 학생 화면·AI 프롬프트에 문장으로 안 실린다', () => {
  /* 「🎯 TOPIK 아직 미정까지 약 48주」는 응원이 아니라, 정직하게 모르겠다를 고른 대가다.
   * 읽는 곳이 셋(cGoal·pace·핵심비전)이라 프로즈 대신 공용 통로(Code.js 미정값_)를 지나는지 본다. */
  const code = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');
  assert.match(code, /function 미정값_\(v\)/, '미정 판정 공용 통로가 없다 — 세 곳이 각자 판정하면 갈라진다');
  const pace = 함수본문(배치, 'consultPace_');
  assert.ok(/미정값_\(goalLv\)/.test(pace), '페이스라인이 미정을 안 거른다');
  const sync = 함수본문(배치, 'syncProfiles');
  assert.ok(/미정값_\(cv\(row, 'TOPIK목표'\)\)/.test(sync), '상담목표(DU125)가 미정을 안 거른다');
  /* ⚠ 처음엔 `/미정값_/.test(본문)` 으로 봤는데 **변이 실측에서 샜다** — 네 칸 중 하나만 통로를
   *   지나도 문자열은 그대로 있다. 문구가 아니라 **결과**를 본다(이 파일의 다른 실행 검사와 같은 규약). */
  const 비전 = new Function(함수본문(배치, '진로비전_') +
    '\nfunction 미정값_(v){ return !v || /미정|모름|모르|정하지/.test(String(v)); }\nreturn 진로비전_;')();
  const cv = (row, n) => row[n] || '';
  assert.equal(비전(cv, { 졸업후진로: '아직 미정', 희망진학과정: '아직 미정', 관심전공분야: '미정', TOPIK목표: '아직 미정' }), '',
    '전부 미정인데 케어 한 줄을 지어냈다 — 「자기신고: 아직 미정 · 아직 미정(미정) · TOPIK 아직 미정」');
  assert.equal(비전(cv, { 졸업후진로: '한국 정착', 희망진학과정: '학사', 관심전공분야: 'IT·컴공', TOPIK목표: '3~4급 중급' }),
    '자기신고: 한국 정착 · 학사(IT·컴공) · TOPIK 3~4급 중급', '정상 답까지 지워졌다');
  assert.equal(비전(cv, { 졸업후진로: '한국 정착', 희망진학과정: '아직 미정', 관심전공분야: '미정', TOPIK목표: '아직 미정' }),
    '자기신고: 한국 정착', '미정 칸만 빠지고 답한 칸은 남아야 한다');
  /* 전공은 다중 요약이다 — 「IT·컴공, 미정」을 통째로 미정으로 보면 **답한 것까지 지운다**(변이가 잡았다) */
  assert.equal(비전(cv, { 졸업후진로: '', 희망진학과정: '학사', 관심전공분야: 'IT·컴공, 미정', TOPIK목표: '' }),
    '자기신고: 학사(IT·컴공)', '다중 전공에 미정이 섞였다고 멀쩡한 답까지 지웠다');
  assert.equal(비전(cv, { 졸업후진로: '', 희망진학과정: '학사', 관심전공분야: '미정, 공학', TOPIK목표: '' }),
    '자기신고: 학사(공학)', '앞자리가 미정이면 뒤의 진짜 답을 못 찾는다');
  // 실행 검증 — 통로가 실제로 그 문자열을 잡는가
  const 미정값_ = new Function(함수본문(code, '미정값_') + '\nreturn 미정값_;')();
  ['아직 미정', '미정', '미정 · 상담 필요', ''].forEach((v) => assert.equal(미정값_(v), true, `「${v}」를 미정으로 안 본다`));
  ['학사', '3~4급 중급', 'E-9 비전문'].forEach((v) => assert.equal(미정값_(v), false, `「${v}」를 미정으로 잘못 본다`));
});

test('trajectory는 파생이다 — 매번 재작성되고 옛 꼬리를 지운다', () => {
  /* 손으로 고쳐도 다음 아침 덮인다. 그 사실이 코드에 없으면 원장이 여기 적고 사라진 값을 찾는다.
   * 꼬리 청소가 없으면 상담시트에서 지워진 사람의 옛 줄이 영원히 남아 커버리지를 부풀린다. */
  const fn = 함수본문(궤적, '궤적재작성_');
  assert.ok(/clearContent\(\)/.test(fn), '옛 꼬리 행을 안 지운다 — 사라진 사람이 통계에 계속 산다');
  assert.ok(/writeIfChanged\(sh, 2, 1, out\)/.test(fn), '재작성이 소독 통로를 안 지난다');
});

test('🔑 활용동의 드롭다운이 면접폼 문구와 **글자까지** 같다 — 갈라지면 동의한 사람이 내보내기에서 빠진다', () => {
  /* 자동 수확은 폼 답을 그대로 실어 온다. 원장 수기 칸만 자유 입력이면 「예」·「동의함」이 섞이고,
   *   이 칸의 유일한 소비처인 **내보내기 거름망**이 그 값을 못 읽어 동의한 사람을 조용히 뺀다.
   *   그래서 여기서 보는 것은 「드롭다운이 있는가」가 아니라 **「두 목록의 값이 같은가」**다. */
  const 폼문구 = /mc\('자료활용동의', (\[[^\]]*\])/.exec(폼리포트);
  assert.ok(폼문구, '면접폼의 자료활용동의 문항을 못 찾았다 — 문항이 사라졌거나 이름이 바뀌었다');
  assert.deepEqual(상수(궤적, 'OUTCOME_CONSENTS_'), JSON.parse(폼문구[1].replace(/'/g, '"')),
    '활용동의 드롭다운과 면접폼 선택지가 갈라졌다 — 한쪽만 고치면 수확된 행이 매번 경고로 뜬다');

  // 실제로 검증이 걸리는가 — 9열(활용동의)이 재적용 목록에 있어야 한다
  const 판 = 함수본문(궤적, '궤적_결과시트_');
  const 열 = (판.match(/\[(\d+), OUTCOME_\w+_\]/g) || []).map((s) => Number(/\[(\d+)/.exec(s)[1]));
  const i동의 = 상수(궤적, 'OUTCOME_HEADERS_').indexOf('활용동의') + 1;
  assert.ok(열.includes(i동의), `활용동의(${i동의}열)에 드롭다운이 안 걸린다 — 목록만 만들고 안 쓴 것이다`);
  /* 판을 안 올리면 **이미 v1 을 본 시트는 영원히 재적용을 스킵한다** — 코드는 맞는데 라이브만 옛 상태다. */
  assert.notEqual(문자열상수(궤적, 'OUTCOME_VALIDATION_VER_'), 'v1',
    '검증 목록을 바꾸고 OUTCOME_VALIDATION_VER_ 를 안 올렸다 — 기존 시트는 스킵 게이트에 걸려 갱신되지 않는다');
});

test('🔴 워치독이 궤적 2시트를 본다 — 탭이 사라져도 배치 로그는 정상을 보고한다', () => {
  /* 왜 이게 회귀로 남는가: outcome_log 의 **절반은 원장이 손으로 적는다.** 탭을 실수로 지우거나
   *   이름을 바꾸면 ensureSheet 가 빈 시트를 새로 만들고 수확은 계속 성공한다 — 손으로 적은
   *   졸업생 소식이 사라졌다는 신호가 어디에도 안 뜬다. 그리고 그 데이터는 **소급이 안 된다.**
   *   워치독의 「누락 시트」 줄이 이 사고를 사람에게 알리는 유일한 층이다. */
  /* [v9.241] 워치독의 손 목록(`const reqSheets`)이 **골격 정본 도출**로 바뀌었다. 지키는 사실은
   *   그대로다 — 「궤적 2시트가 워치독의 눈에 든다」. 재는 자리만 한 칸 올라갔다: 이제 그 답은
   *   `sheetSkeleton_()` 이 들고 있고, 워치독은 거기서 파생한다. 그래서 검사도 두 칸으로 나뉜다.
   *   ⚠ 손 목록으로 되돌아가면 ②가 빨개진다 — 그게 이 회귀의 새 급소다. */
  const 콘텐츠AI = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');
  const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const OUT = 문자열상수(궤적, 'OUTCOME_TAB_');
  const TRJ = 문자열상수(궤적, 'TRAJECTORY_TAB_');

  // ① 도출 원천(골격)에 두 탭이 **상수 참조로** 들어 있다.
  const 골격 = 셋업.slice(셋업.indexOf('function sheetSkeleton_()'), 셋업.indexOf('function 수집장부탭_()'));
  assert.notEqual(골격.length, 0, '골격 구역을 못 떴다 — 이 검사가 조용히 0건이 되는 자리다');
  assert.ok(/\[\s*OUTCOME_TAB_\s*,/.test(골격), `골격에 ${OUT} 이 없다 — 워치독·재건·매니페스트가 한꺼번에 이 탭을 잃는다`);
  assert.ok(/\[\s*TRAJECTORY_TAB_\s*,/.test(골격), `골격에 ${TRJ} 가 없다`);
  /* 🔑 이름을 두 곳에 적지 않았는지 — 문자열로 또 적으면 탭 이름을 바꾼 날 한쪽만 갈린다. */
  assert.ok(!코드만(골격).includes(`'${OUT}'`) && !코드만(골격).includes(`'${TRJ}'`),
    '골격이 궤적 탭 이름을 문자열로 또 적었다 — 엔진_궤적.js 의 상수를 참조해야 한다');

  // ② 워치독이 그 골격에서 **도출**한다(손 목록으로 되돌아가면 여기서 죽는다).
  assert.ok(/const 골격탭 = sheetSkeleton_\(\)/.test(콘텐츠AI),
    '워치독이 골격에서 도출하지 않는다 — 손 목록으로 되돌아갔다(v9.144·v9.202 와 같은 병의 세 번째)');
  assert.ok(!코드만(콘텐츠AI).includes('const reqSheets'),
    '손 목록 `reqSheets` 가 되살아났다 — 새 시트가 생길 때마다 다시 낡는다');
});
