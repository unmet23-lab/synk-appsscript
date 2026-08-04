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
