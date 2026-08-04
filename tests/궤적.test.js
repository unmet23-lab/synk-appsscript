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
  const src = [함수본문(궤적, '궤적_의도버킷_'), 함수본문(궤적, '궤적_대조_'),
    '\nconst OUTCOME_PATH_ = ' + JSON.stringify(상수(궤적, 'OUTCOME_PATH_')) + ';'].join('\n');
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
  const src = 함수본문(궤적, '궤적_의도버킷_');
  const 버킷 = new Function(src + '\nreturn 궤적_의도버킷_;')();
  // 10년 후 「한국 정착」 + 내년 「학사」 → 우리가 관측하는 것은 후자다
  assert.equal(버킷('한국 정착', '학사', 'F-5 영주'), '유학');
  assert.equal(버킷('한국 정착', '', 'E-7 전문직'), '취업');
  assert.equal(버킷('몽골 복귀', '', ''), '몽골');
  assert.equal(버킷('', '', ''), '', '아무 답도 없는데 버킷을 지어냈다');
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
  assert.ok(!/setAppState_|CARD_FONT|Glide/.test(함수본문(궤적, '궤적재작성_')),
    'trajectory가 앱 상태·카드로 새어 나가는 경로가 생겼다');
});

test('trajectory는 파생이다 — 매번 재작성되고 옛 꼬리를 지운다', () => {
  /* 손으로 고쳐도 다음 아침 덮인다. 그 사실이 코드에 없으면 원장이 여기 적고 사라진 값을 찾는다.
   * 꼬리 청소가 없으면 상담시트에서 지워진 사람의 옛 줄이 영원히 남아 커버리지를 부풀린다. */
  const fn = 함수본문(궤적, '궤적재작성_');
  assert.ok(/clearContent\(\)/.test(fn), '옛 꼬리 행을 안 지운다 — 사라진 사람이 통계에 계속 산다');
  assert.ok(/writeIfChanged\(sh, 2, 1, out\)/.test(fn), '재작성이 소독 통로를 안 지난다');
});
