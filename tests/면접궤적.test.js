/* 면접폼 궤적 연결 고리 회귀 — 「의도와 결과가 한 사람으로 이어지는가」
 *
 * 왜 있나 (2026-08-04 대조): 로드맵 ④(유학 집약 봇)의 재료는 궤적이다.
 *   의도 = 크루카드 100+문항(졸업후진로·희망진학과정·비자목표 7종·전공관심 7종) → 상담시트
 *   결과 = 면접폼의 「결과(합격·승인/불합격·거절/…)」
 *   둘 다 이미 쌓이는데 **조인 키가 없어 안 이어졌다.** 소급 불가는 「문항」이 아니라 「연결」이었다.
 *
 * 🔴 이 파일이 지키는 것 중 가장 중요한 건 「선택 문항이어야 한다」다.
 *   익명은 실수가 아니라 값을 하는 설계다 — 이 폼의 1순위 자산은 질문 은행이고, 거절 경험은
 *   특히 밝히기 싫은 정보라 실명 강제는 회수율을 깎는다. 필수로 바뀌면 1순위 자산을 잃는다.
 *
 * 소스 검사다(Apps Script 런타임 없이 도는 층 · tests/폼안전.test.js 계보).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// SYNK_TEST_SRC_ROOT = 변이 실험용 이음매. 평소엔 실소스를 본다.
// 탐지력은 「사본을 변이시키면 빨개지는가」로 재고, **실파일은 절대 안 건드린다**(F065·F067·code-edit-guard).
const ROOT = process.env.SYNK_TEST_SRC_ROOT || path.resolve(__dirname, '..');
const 폼리포트 = fs.readFileSync(path.join(ROOT, '엔진_폼리포트.js'), 'utf8');
const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');

/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. `함수본문` 은 중괄호를 세므로 원문을 받아야 한다. (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');

/** 최상위 function 본문을 이름으로 잘라 온다(중괄호 깊이 추적). */
function 함수본문(src, name) {
  const i = src.indexOf(`function ${name}(`);
  assert.notEqual(i, -1, `${name} 함수를 못 찾았다`);
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  assert.fail(`${name} 본문 끝을 못 찾았다`);
}

// ── 조인 키 ────────────────────────────────────────────────────────────────

test('제목 상수가 하나다 — 생성부와 마이그레이션이 같은 것을 본다', () => {
  /* 두 곳에 적으면 갈라진다(CONSENT_Q_TITLE 이 같은 이유로 상수가 됐다).
   * 갈라지면 마이그레이션이 「없다」고 판단해 **문항을 하나 더 만든다** — 조인 키가 둘이 된다. */
  assert.match(폼리포트, /const INTERVIEW_SID_TITLE = '학생ID'/,
    '조인 키 제목 상수가 없다/변형됐다');
  const 생성 = 함수본문(폼리포트, 'createInterviewLogForm');
  const 증분 = 함수본문(폼리포트, 'migrateInterviewSid');
  assert.ok(생성.includes('INTERVIEW_SID_TITLE'), '생성부가 제목을 하드코딩하고 있다');
  assert.ok(증분.includes('INTERVIEW_SID_TITLE'), '마이그레이션이 제목을 하드코딩하고 있다');
});

test('조인 키 제목이 상담시트 헤더와 같다 — 어긋나면 연결이 통째로 죽는다', () => {
  // 상담시트 60열 헤더가 '학생ID'(migrateConsentV186 의 스키마 검사가 그 값을 못박는다).
  assert.match(폼리포트, /hdr\[59\] !== '학생ID'/,
    '상담시트 학생ID 열 규약이 바뀌었다 — 조인 키 양쪽이 어긋난다');
});

// ── 🔴 익명성 불변식 ───────────────────────────────────────────────────────

test('🔴 생성부에서 학생ID 는 **선택** 문항이다 (익명 회수가 1순위 자산이다)', () => {
  const 생성 = 함수본문(폼리포트, 'createInterviewLogForm');
  const m = /txt\(INTERVIEW_SID_TITLE,\s*(true|false)\s*,/.exec(생성);
  assert.ok(m, '생성부에 학생ID 문항이 없다 — 새로 만든 폼엔 조인 키가 빠진다');
  assert.equal(m[1], 'false',
    '학생ID 를 필수로 만들었다 — 거절 경험은 특히 밝히기 싫은 정보라 회수율이 죽는다');
});

test('🔴 마이그레이션이 「필수로 바뀐 것」을 선택으로 되돌린다', () => {
  const 증분 = 함수본문(폼리포트, 'migrateInterviewSid');
  assert.ok(/isRequired\(\)/.test(증분), '필수 여부를 아예 안 본다 — 누가 필수로 바꿔도 모른다');
  assert.ok(/setRequired\(false\)/.test(증분), '필수를 선택으로 되돌리지 않는다');
});

test('폼이 이메일을 수집하지 않는다 (익명성의 다른 한쪽)', () => {
  const 생성 = 함수본문(폼리포트, 'createInterviewLogForm');
  assert.ok(/setCollectEmail\(false\)/.test(생성), '이메일 수집이 켜졌다 — 익명 회수가 깨진다');
});

// ── 멱등·발동 ──────────────────────────────────────────────────────────────

test('마이그레이션이 멱등이다 — 이미 있으면 문항을 또 만들지 않는다', () => {
  /* ⚠ 이 검사는 처음에 「존재 검사가 추가보다 앞에 오는가」만 봤고, 변이 실측에서 그게
   *   샌다는 게 드러났다 — 검사 결과를 **쓰지 않아도** 순서는 그대로라 초록이었다.
   *   그래서 순서가 아니라 **결과를 쓰는 분기와 그 분기의 return**까지 못박는다.
   *   (조용히 새면 유호님이 두 번 누른 날 조인 키가 두 칸이 되고, 그건 화면에 안 보인다.) */
  const 증분 = 함수본문(폼리포트, 'migrateInterviewSid');
  const i검사 = 증분.indexOf('indexOf(INTERVIEW_SID_TITLE)');
  const i분기 = 증분.indexOf('if (at !== -1)');
  const i추가 = 증분.indexOf('addTextItem');
  assert.notEqual(i검사, -1, '기존 문항 존재 검사가 없다 — 누를 때마다 칸이 하나씩 늘어난다');
  assert.notEqual(i분기, -1, '존재 검사 결과를 쓰는 분기가 없다 — 세어만 보고 그냥 추가한다');
  /* 분기가 보는 값이 **그 검사에서 나온 것**인지까지 본다 — 변이 실측에서 텍스트는 그대로 두고
   * 대입만 끊는 형태(`const at = -1; titles.indexOf(...)`)가 두 검사를 모두 통과했다.
   * 소스 검사는 여기까지가 한계다(실행층 검사가 아니다) — 그 한계를 아는 채로 못을 하나 더 박는다. */
  assert.match(증분, /const at = titles\.indexOf\(INTERVIEW_SID_TITLE\);/,
    '분기가 보는 값이 존재 검사의 결과가 아니다 — 검사는 돌지만 결과는 버려진다');
  assert.ok(i검사 < i분기 && i분기 < i추가, '존재 검사→분기→추가 순서가 깨졌다');
  assert.ok(/\breturn\b/.test(증분.slice(i분기, i추가)),
    '이미 있을 때 빠져나오지 않는다 — 분기만 있고 return 이 없으면 아래 addTextItem 이 그대로 돈다');
  assert.equal((증분.match(/addTextItem/g) || []).length, 1,
    '문항을 만드는 곳이 둘 이상이다 — 한 곳만 멱등이면 다른 곳으로 샌다');
});

test('🔑 라이브 폼에 닿는 통로가 있다 — 생성부는 살아 있는 폼을 안 건드린다', () => {
  /* createInterviewLogForm 은 폼이 있으면 조기 반환한다(배포 링크 보호 · 그 판단은 옳다).
   * 그래서 생성부만 고치면 라이브에는 **영원히 안 닿는다** — 이 검사가 그 구멍을 지킨다. */
  const 생성 = 함수본문(폼리포트, 'createInterviewLogForm');
  assert.ok(/이미 있어 새로 만들지 않았습니다/.test(생성),
    '생성부의 조기 반환이 사라졌다 — 배포된 링크가 미아가 될 수 있다');
  assert.ok(/function migrateInterviewSid\(/.test(폼리포트),
    '라이브 폼 증분 통로가 없다 — 생성부만 고치면 이미 선 폼엔 안 닿는다');
});

test('🔑 발동 조건이 같이 있다 — 메뉴에 올라가 있지 않으면 안 돈다', () => {
  /* CLAUDE.md 「장치와 그 발동 조건은 같은 커밋에서 정한다 — 스스로 발화하지 않는 장치는 안 돈다」.
   * 편집기 드롭다운에서만 도는 함수는 유호님이 못 찾는다(v9.141 이 같은 이유로 메뉴에 올렸다). */
  assert.match(셋업, /function menuMigrateInterviewSid\(\)\s*\{\s*menuRun_\(migrateInterviewSid\);/,
    '메뉴 래퍼가 없다');
  assert.match(셋업, /addItem\('[^']*학생ID[^']*',\s*'menuMigrateInterviewSid'\)/,
    '시트 메뉴에 등재되지 않았다 — 함수만 있으면 유호님이 못 누른다');
});

// ── [v9.180] 링크 둘로 — 공개는 익명, 아는 사람에게만 개인 링크 ────────────────
/* 유호님 확정: 「처음 테스트하는 고객도 필요하고, 정규 인원 말고도 쓸 일이 분명 있다.」
 * 이 절이 지키는 것은 **잃는 것이 없어야 한다**는 것이다 — 공개 링크의 익명이 유지되고,
 * 두 링크가 같은 폼이라 회수가 갈리지 않는다. 한쪽이라도 어긋나면 v9.178의 조인 키가 헛돈다. */

test('🔴 공개 링크에는 프리필이 섞이지 않는다 — 기본값이 익명→실명으로 뒤집히면 회수율이 죽는다', () => {
  const 생성 = 함수본문(폼리포트, 'createInterviewLogForm');
  assert.ok(/setState\(st, '면접폼URL', form\.getPublishedUrl\(\)\)/.test(생성),
    '공개 링크가 발행 URL 그대로가 아니다 — 지금까지 뿌린 링크·QR가 미아가 된다');
  assert.equal(/setState\(st, '면접폼URL',[^)]*SIDTOKEN/.test(코드만(생성)), false,
    '공개 링크에 프리필 토큰이 들어갔다 — 익명 기본값이 뒤집힌다');
});

test('개인 링크 틀을 만드는 곳이 하나다 — 두 곳이면 한쪽만 갱신되는 날이 온다', () => {
  const 쓰는곳 = 폼리포트.split('\n').filter((l) => /setState\([^)]*'면접폼URL틀'/.test(l));
  assert.equal(쓰는곳.length, 1, `면접폼URL틀 기입이 ${쓰는곳.length}곳이다 — 면접URL틀보증_ 하나로 모아라`);
  assert.ok(/function 면접URL틀보증_\(/.test(폼리포트), '공용 통로 함수가 없다');
});

test('🔑 마이그레이션의 **두 경로 모두** 개인 링크 틀을 보증한다', () => {
  /* 「이미 있음」 가지에서 조기 반환하면 「칸은 있는데 링크 틀은 없는」 상태가 영영 안 고쳐진다.
   * 멱등은 「아무것도 안 한다」가 아니라 「같은 결과로 수렴한다」다. */
  const 증분 = 함수본문(폼리포트, 'migrateInterviewSid');
  const i분기 = 증분.indexOf('if (at !== -1)');
  const i추가 = 증분.indexOf('addTextItem');
  assert.ok(/면접URL틀보증_\(st, form\)/.test(증분.slice(i분기, i추가)), '이미 있음 경로가 틀을 보증하지 않는다');
  assert.ok(/면접URL틀보증_\(st, form\)/.test(증분.slice(i추가)), '새로 넣는 경로가 틀을 보증하지 않는다');
  assert.ok(/면접URL틀보증_\(st, form\)/.test(함수본문(폼리포트, 'createInterviewLogForm')),
    '새 폼을 만들 때 틀이 안 생긴다 — 나중에 따로 눌러야 하면 안 눌린다');
});

test('🔴 명단에 없는 학생ID를 거절하지 않는다 — 그게 유호님이 지목한 바로 그 경우다', () => {
  /* 「처음 테스트하는 고객」은 정의상 profiles 에 없다. 대조는 알림용이지 차단용이 아니다. */
  const 링크 = 함수본문(폼리포트, 'interviewPersonalLink');
  const i대조 = 링크.indexOf('profiles');
  assert.notEqual(i대조, -1, '명단 대조 자체가 없다 — 누구 링크인지 확인할 방법이 사라진다');
  assert.equal(/return[^\n]*명단에 없/.test(코드만(링크)), false,
    '명단에 없다고 링크를 안 주고 끝낸다 — 테스트 고객·상담만 한 분이 전부 막힌다');
  assert.ok(링크.indexOf('개인 링크 (이 분에게만') > i대조, '대조 뒤에 링크를 돌려주지 않는다');
  assert.ok(/단톡에 올리면 남의 ID로 제출/.test(링크), '개인 링크를 뿌리면 안 되는 이유를 안 알려준다');
});

test('틀이 없으면 안내하고 멈춘다 (빈 틀로 깨진 링크를 건네지 않는다)', () => {
  const 링크 = 함수본문(폼리포트, 'interviewPersonalLink');
  const i가드 = 링크.indexOf("if (!tpl)");
  const i프롬프트 = 링크.indexOf('ui.prompt');
  assert.ok(i가드 !== -1 && i가드 < i프롬프트,
    '틀 검사가 없거나 프롬프트 뒤다 — 다 입력하고 나서야 못 만든다고 알게 된다');
});

test('🔑 학생ID 조립이 채번과 같은 통로다 — 한 글자만 달라도 조인이 통째로 죽는다', () => {
  const 정규 = 함수본문(폼리포트, '면접학생ID정규화_');
  assert.ok(/학생ID_포맷_\(/.test(정규), '채번 통로를 안 쓴다');
  assert.equal(/'SYNK-'\s*\+/.test(코드만(정규)), false, "'SYNK-' 를 여기서 따로 이어 붙인다 — 같은 파일 L1099 의 경고");
});

test('행동: 정규화가 실제로 무엇을 받아 무엇을 내는가 (픽스처)', () => {
  /* 소스 검사만으로는 「형식을 본다」까지고, 「무엇을 통과시키나」는 못 잰다 — 실행해서 잰다.
   * 학생ID_포맷_ 도 실소스에서 잘라 와 함께 평가한다(스텁을 쓰면 통로가 같은지 못 본다). */
  const 평가 = new Function(
    함수본문(폼리포트, '학생ID_포맷_') + '\n' + 함수본문(폼리포트, '면접학생ID정규화_') +
    '\nreturn 면접학생ID정규화_;')();
  for (const [입력, 기대] of [
    ['SYNK-001', 'SYNK-001'], ['synk 1', 'SYNK-001'], ['SYNK001', 'SYNK-001'],
    ['  synk-7  ', 'SYNK-007'], ['1', 'SYNK-001'], ['023', 'SYNK-023'], ['1234', 'SYNK-1234'],
    ['DEMO-01', ''], ['SYNK-', ''], ['', ''], ['SYNK-1 그리고 아무 말', ''],
  ]) assert.equal(평가(입력), 기대, `정규화(${JSON.stringify(입력)})`);
});

test('🔴 moveItem 은 인덱스로 부른다 — 라이브가 잡은 결함(소스 검사가 못 보던 층)', () => {
  /* 2026-08-04 원격 실행이 던졌다: moveItem(item, toIndex) 오버로드는 제네릭 Item 을 받는데
   * addTextItem() 은 TextItem 을 돌려준다. 회귀 17·변이 15/15 전부 초록인 채로 살아남았다 —
   * **시그니처는 실행해야 보이는 층**이라 소스 검사로는 거기까지 못 간다. 재발만 막는다. */
  const 자리 = 함수본문(폼리포트, '면접SID자리_');
  assert.ok(/form\.moveItem\(현재, 목표\)/.test(자리), '이동이 인덱스 두 개 형태가 아니다');
  /* ⚠ 이 검사는 처음에 **자기 주석을 잡았다** — 위 설명문에 적은 `moveItem(item, toIndex)` 를
   *   진짜 호출로 세어 빨간불을 냈다. 결함을 설명한 문장이 그 결함으로 세어지면 안 된다.
   *   그래서 주석 줄을 걷어내고 **코드 줄만** 본다(가드가 자기 산문에 눈머는 형태의 반대쪽). */
  const 코드줄 = 코드만(폼리포트).split('\n');   // 통로는 «인라인» 주석까지 본다
  const 나쁜호출 = 코드줄.filter((l) => /moveItem\(\s*(item|it)\s*[,)]/.test(l));
  assert.deepEqual(나쁜호출, [],
    'moveItem 에 아이템 객체를 그대로 넘기는 곳이 있다 — 라이브에서 예외로 죽는다(getIndex() 를 넘겨라)');
  // 방향에 따라 목표가 달라야 한다(빼는 순간 뒤가 한 칸 당겨진다)
  assert.ok(/현재 < 이름at \? 이름at : 이름at \+ 1/.test(자리), '이동 방향별 목표 보정이 없다');
});

test('🔑 자리 잡기를 **양쪽 경로**에서 부른다 — 맨 끝에 박힌 폼이 영영 안 고쳐지면 안 된다', () => {
  /* 라이브가 지금 정확히 그 상태였다: addTextItem 은 성공하고 moveItem 만 던져서
   * 학생ID 칸이 「5. 자료 활용 동의」 뒤에 남았다. 새로 넣는 경로에서만 자리를 잡으면 못 고친다. */
  const 증분 = 함수본문(폼리포트, 'migrateInterviewSid');
  const i분기 = 증분.indexOf('if (at !== -1)');
  const i추가 = 증분.indexOf('addTextItem');
  assert.ok(/면접SID자리_\(/.test(증분.slice(i분기, i추가)), '이미 있음 경로가 자리를 안 고친다');
  assert.ok(/면접SID자리_\(/.test(증분.slice(i추가)), '새로 넣는 경로가 자리를 안 잡는다');
});

test('개인 링크 메뉴도 발동 조건이 같이 있다', () => {
  assert.match(셋업, /function menuInterviewPersonalLink\(\)\s*\{\s*menuRun_\(interviewPersonalLink\);/,
    '메뉴 래퍼가 없다');
  assert.match(셋업, /addItem\('[^']*개인 링크[^']*',\s*'menuInterviewPersonalLink'\)/,
    '시트 메뉴에 등재되지 않았다 — 함수만 있으면 유호님이 못 누른다');
});

test('새 문항이 응답 시트를 위치로 읽는 코드를 깨지 않는다', () => {
  /* 문항을 끼워 넣으면 응답 시트에 열이 생긴다. 결석 폼처럼 위치로 파싱하는 폼이었다면
   * 이 증분은 금지였다(그 파일 주석의 경고). 면접기록_응답을 읽는 곳이 하나뿐이고
   * getLastRow 만 쓴다는 실측을 여기 못박는다 — 나중에 위치 파싱이 생기면 빨간불이 난다. */
  const 콘텐츠 = fs.readFileSync(path.join(ROOT, '엔진_콘텐츠AI.js'), 'utf8');
  const 쓰는곳 = 콘텐츠.split('\n').filter((l) => l.includes('면접기록_응답'));
  assert.equal(쓰는곳.length, 1, `면접기록_응답 사용처가 ${쓰는곳.length}곳이다 — 위치 파싱이 생겼는지 확인하라`);
  const 뒤 = 콘텐츠.slice(콘텐츠.indexOf('면접기록_응답'));
  assert.ok(!/shIv\.getRange\(/.test(뒤.slice(0, 400)),
    '응답 시트를 getRange 로 읽는다 — 문항을 끼워 넣으면 열이 밀려 깨진다');
});
