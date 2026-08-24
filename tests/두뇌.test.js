/* 회사 두뇌 — 설계원칙 ⑤(대상이 볼 수 없는 지식은 프롬프트에 실리지 않는다)를 실행으로 검증한다.
 *
 * ♻ 08-24 부활(심문 0822 G8 소화 · S5 와 같은 계보): v9.137(ab8d4507)이 세운 이 12검사는 08-19
 *   대철거(e75fc7fc · 테스트 237→9)에 «자기검증»으로 묶여 걷혔지만, 전부 **제품 몫**이다 —
 *   정보 격리(내부 지식이 공개 봇으로 새는가) · 익명 RPC 브릿지 · 수식 인젝션 · 학생 데이터
 *   무접촉. 걷힌 다섯 달 새 엔진_두뇌.js:347 주석은 존재하지 않는 이 파일을 가리키는 거짓
 *   참조였고, 라이브 탑재 + AI 키 취급 코드가 검사 0 이었다. 옛 판 그대로 현행 코드 위에서
 *   12/12 초록(08-24 실측) — 코드가 규약을 안 깨고 있었다는 증거이지, 검사가 불필요하다는
 *   증거가 아니다(다음에 깨는 날 잡는 것이 이 파일이다).
 *
 * 왜 텍스트 검사가 아니라 실행인가: 이 규칙의 실패는 "필터를 안 걸었다"가 아니라
 *   "필터를 걸었는데 한 줄이 샜다"의 모양으로 온다. 문자열 검사는 필터의 *존재*만 보고
 *   *결과*를 못 본다([[guard-must-check-result]] — 같은 패턴으로 5건이 났다).
 *   그래서 여기서는 가짜 시트를 물려 실제로 로드하고, 나온 결과에 내부 지식이 있는지 본다.
 *
 * 홈페이지 봇은 익명 공개 엔드포인트가 된다 — 여기가 뚫리면 학원 내부 문서가 밖으로 나간다. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./_engine-source');

/* 지식 시트 한 장을 흉내 내 두뇌를 로드한다. rows = [대상, 주제, 확정, 내용, 출처, 갱신일] */
function 두뇌로드(rows) {
  const sheet = {
    getLastRow: () => rows.length + 1,   // +1 = 헤더 행
    getRange: (r, c, nr, nc) => ({
      getValues: () => rows.slice(r - 2, r - 2 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
    }),
    appendRow: () => { },
  };
  const ss = {
    getSheetByName: (n) => (n === '두뇌지식' ? sheet : null),
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => { } }) },
    Utilities: { formatDate: () => '2026-08-03' },
    Logger: { log: () => { } },
    UrlFetchApp: {}, ContentService: {}, HtmlService: {}, MailApp: {},
    console,
  };
  vm.createContext(ctx);
  ['contents_두뇌.js', '엔진_두뇌.js'].forEach((f) => {
    new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }).runInContext(ctx);
  });
  return ctx;
}

const 표본 = [
  ['공통', '개원 시기', 'Y', '2027년 2월 개원 예정입니다.', 'docs/roadmap', '2026-08-03'],
  ['내부', '급여 계산 방식', 'Y', '시급 15000투그릭 기준으로 정산합니다.', 'docs/급여정본', '2026-08-03'],
  ['공개', '수업 방식', 'Y', '8주 한 시즌으로 운영합니다.', 'docs/커리큘럼', '2026-08-03'],
];

test('공개 경로는 내부 지식을 한 줄도 받지 않는다 (홈페이지 봇이 내부 문서를 말할 수 없다)', () => {
  const ctx = 두뇌로드(표본);
  const 블록 = ctx.두뇌_지식로드_('공개');
  assert.equal(블록.filter((b) => b.대상 === '내부').length, 0, '공개 경로에 내부 지식이 실렸다');
  assert.ok(블록.some((b) => b.주제 === '수업 방식'), '공개 지식은 실려야 한다');
  assert.ok(블록.some((b) => b.주제 === '개원 시기'), '공통 지식은 양쪽 모두 실려야 한다');
});

test('내부 경로는 공통+내부만 받는다 (공개 전용 지식은 강사 답변에 섞이지 않는다)', () => {
  const 블록 = 두뇌로드(표본).두뇌_지식로드_('내부');
  const 라벨 = 블록.map((b) => b.대상).sort();
  assert.deepEqual([...new Set(라벨)], ['공통', '내부']);
});

test('프롬프트 실물에 내부 문장이 들어가지 않는다 (필터 존재가 아니라 결과를 본다)', () => {
  const ctx = 두뇌로드(표본);
  const 프롬프트 = ctx.두뇌_시스템_('공개', ctx.두뇌_지식로드_('공개'));
  assert.ok(프롬프트.indexOf('시급 15000') < 0, '내부 급여 문장이 공개 프롬프트에 샜다');
  assert.ok(프롬프트.indexOf('급여 계산 방식') < 0, '내부 주제명조차 공개 프롬프트에 나오면 안 된다');
});

test('열람권 표에 없는 대상은 빈손이 아니라 예외다 (fail-closed)', () => {
  const ctx = 두뇌로드(표본);
  assert.throws(() => ctx.두뇌_지식로드_('아무개'), /알 수 없는 대상/);
});

test('확정=Y인데 내용이 비면 아는 것이 아니라 모르는 것으로 간다', () => {
  const ctx = 두뇌로드([
    ['내부', '환불 규정', 'Y', '', '', '2026-08-03'],       // 확정만 켜고 내용을 안 쓴 실수
    ['내부', '개원 시기', 'Y', '2027년 2월입니다.', '', '2026-08-03'],
  ]);
  const 블록 = ctx.두뇌_지식로드_('내부');
  assert.equal(ctx.두뇌_유효확정_(블록[0]), false, '빈 내용이 확정으로 통과했다 — 봇이 빈손으로 답을 지어낸다');
  const 프롬프트 = ctx.두뇌_시스템_('내부', 블록);
  const 모르는것 = 프롬프트.slice(프롬프트.indexOf('【모르는 것'));
  assert.ok(모르는것.indexOf('환불 규정') >= 0, '빈 확정은 "모르는 것" 목록으로 가야 한다');
});

test('지식이 상한을 넘어도 모르는 주제는 항상 실린다 (모르는 것을 아는 것으로 착각하지 않게)', () => {
  const 많은지식 = [];
  for (let i = 0; i < 60; i++) 많은지식.push(['내부', '주제' + i, 'Y', 'ㄱ'.repeat(500), '', '2026-08-03']);
  많은지식.push(['내부', '급여 문의', '', '', '', '2026-08-03']);   // 미확정 — 반드시 살아남아야 한다
  const ctx = 두뇌로드(많은지식);
  const 블록 = ctx.두뇌_지식로드_('내부');
  const 고른것 = ctx.두뇌_관련지식_('수업 시간표가 어떻게 되나요', 블록, 5000);
  assert.ok(고른것.length < 블록.length, '상한을 넘었는데 좁히지 않았다');
  assert.ok(고른것.some((b) => b.주제 === '급여 문의'), '미확정 주제가 탈락하면 봇이 그 질문에 답을 지어낸다');
});

test('모델이 지어낸 출처는 근거 표기에서 걸러진다', () => {
  const ctx = 두뇌로드(표본);
  const 블록 = ctx.두뇌_지식로드_('공개');
  const 표기 = ctx.두뇌_출처표기_(['수업 방식', '있지도 않은 주제'], 블록);
  assert.equal(표기.length, 1);
  assert.equal(표기[0].주제, '수업 방식');
  assert.equal(표기[0].출처, 'docs/커리큘럼');
});

/* ── 익명 RPC 브릿지 차단 ──
 * 2026-08-03 배포 직전에 잡힌 사고 경로의 회귀 방지. 이 웹앱은 ANYONE_ANONYMOUS + USER_DEPLOYING이라,
 * doGet이 HtmlService 페이지를 한 번이라도 돌려주면 받은 사람이 google.script.run으로
 * 이 프로젝트의 밑줄 없는 전역 함수 전부를 원장 권한으로 부를 수 있다(학생 리포트카드 URL·학부모 메일 발송 포함).
 * 노출 단위가 「내가 부르려던 함수」가 아니라 「프로젝트 전체」라는 것이 이 사고의 핵심이었다. */

test('doGet은 HtmlService를 반환하지 않는다 (익명 google.script.run 브릿지를 열지 않는다)', () => {
  const src = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const 본문 = src.slice(src.indexOf('function doGet'), src.indexOf('function 상담_정규화_'));
  assert.ok(본문.indexOf('function doGet') === 0 && 본문.length > 100, 'doGet 본문을 못 잘랐다면 이 검사가 눈이 먼 것이다');
  assert.ok(본문.indexOf('HtmlService') < 0,
    'doGet이 HtmlService를 반환한다 — 익명 방문자가 프로젝트 전역 함수를 원장 권한으로 부를 수 있게 된다');
  assert.ok(/hub\.mode.*subscribe/.test(본문) && /hub\.verify_token/.test(본문),
    'Meta 웹훅 검증 경로가 사라졌다 — 상담 봇 전체가 죽는다');
});

test('보류된 강사 웹화면은 라이브 허용목록에 없다 (파일이 남아 있어도 배포되지 않는다)', () => {
  const 보류 = '_보류_두뇌_웹화면.js';
  assert.ok(fs.existsSync(path.join(ROOT, 보류)), 보류 + ' 이 사라졌다 — 되살릴 때 참고할 경위와 조건이 그 머리말에 있다');
  const ignore = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8');
  const 허용 = ignore.split(/\r?\n/).filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim());
  허용.forEach((pat) => {
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    assert.ok(!re.test(보류),
      '.claspignore 허용목록의 "' + pat + '" 가 ' + 보류 + ' 를 라이브로 올린다 — 익명 RPC 브릿지가 다시 열린다');
  });
});

/* ── 시트 수식 인젝션 ──
 * 남이 보낸 글이 그대로 셀에 들어가면 시트가 그것을 수식으로 실행한다.
 * 같은 스프레드시트에 profiles(학생 연락처·보호자 정보)가 있어서, 사람이 셀을 클릭하지 않아도 데이터가 외부로 나간다. */

function 상담AI로드() {
  const ctx = { SpreadsheetApp: {}, PropertiesService: {}, Utilities: {}, Logger: { log: () => { } }, UrlFetchApp: {}, ContentService: {}, CacheService: {}, MailApp: {}, console };
  vm.createContext(ctx);
  new vm.Script(fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8'), { filename: '상담AI.js' }).runInContext(ctx);
  return ctx;
}

test('셀안전_이 수식으로 해석되는 첫 글자를 무력화한다', () => {
  const { 셀안전_ } = 상담AI로드();
  ['=IMPORTDATA("http://x")', '+1+1', '-1+1', '@SUM(A1)', '\tfoo', '\rfoo'].forEach((v) => {
    assert.equal(셀안전_(v)[0], "'", JSON.stringify(v) + ' 가 수식 시작 그대로 통과했다');
  });
  assert.equal(셀안전_('안녕하세요'), '안녕하세요', '평범한 글까지 건드리면 안 된다');
  assert.equal(셀안전_(null), '', 'null은 빈 문자열이어야 한다');
});

test('남의 글을 시트에 쓰는 기록 함수는 전부 셀안전_을 거친다', () => {
  const 검사 = [
    ['상담AI.js', '상담_기록_', ['세션', '내용']],
    ['상담AI.js', '상담_리드적재_', ['lead_name', 'lead_contact']],
    ['엔진_두뇌.js', '두뇌_기록_', ['세션', '내용']],
  ];
  검사.forEach(([파일, 함수, 인자들]) => {
    const src = fs.readFileSync(path.join(ROOT, 파일), 'utf8');
    const from = src.indexOf('function ' + 함수);
    assert.ok(from >= 0, 파일 + ' 에서 ' + 함수 + ' 를 못 찾았다');
    const 본문 = src.slice(from, src.indexOf('\n}', from));
    const append = 본문.slice(본문.indexOf('appendRow'));
    assert.ok(append.length > 10, 함수 + ' 의 appendRow를 못 찾았다 — 쓰기 경로가 바뀌었는지 확인할 것');
    인자들.forEach((a) => {
      assert.ok(new RegExp('셀안전_\\([^)]*' + a).test(append),
        함수 + ' 가 ' + a + ' 를 셀안전_ 없이 시트에 쓴다 — 수식 인젝션 경로');
    });
  });
});

test('두뇌는 지식·로그 두 탭 밖의 시트를 이름으로 부르지 않는다 (학생 데이터 무접촉)', () => {
  const src = fs.readFileSync(path.join(ROOT, '엔진_두뇌.js'), 'utf8');
  const 부르는탭 = [...src.matchAll(/getSheetByName\(([^)]*)\)/g)].map((m) => m[1].trim());
  부르는탭.forEach((t) => {
    assert.ok(t === '두뇌_지식탭' || t === '두뇌_로그탭',
      '두뇌가 허용되지 않은 시트를 연다: ' + t + ' — 학생 개인정보 시트에 닿으면 공개 봇으로 샌다');
  });
  assert.ok(부르는탭.length >= 2, 'getSheetByName 호출을 하나도 못 찾았다면 이 검사가 눈이 먼 것이다');
});
