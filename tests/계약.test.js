/**
 * 두 저장소 사이의 계약 회귀 (계약/수집_교정_계약.json)
 *
 * 왜 있나 — 2년 계획의 단일 실패점이 여기다.
 *   수집층(이 저장소)은 2년간 학생 문장에 오류태그를 붙이고, 교정 엔진(SYNK-talk)은
 *   **같은 어휘로** 교정·채점한다. 둘이 갈라지면 2년치 집계가 제품에서 안 읽히는데,
 *   그 사실은 **데이터가 이미 쌓인 뒤에** 드러난다 — 코드 결함은 고치면 되지만 이건 소급 불가다.
 *
 * 🔴 그런데 지키던 것이 프로즈 한 줄이었다: SYNK-talk `prompts/교정.md`의
 *   "⚠ 이 어휘는 HW_ERROR_TAGS와 같아야 한다". 이 저장소가 프로즈 실패를 이미 여러 번
 *   실측했고(커밋 범위·헤르메스 읽기전용·훅 등록), 처방은 매번 같았다 — 기계로 옮긴다.
 *
 * 🔑 새로운 층 하나: **저장소가 둘이라 서로의 CI가 상대를 못 본다.**
 *   이 저장소의 테스트도 SYNK-talk의 테스트도 상대편 파일을 읽지 않는다. 그래서 계약을
 *   **파일 하나**로 뽑고 양쪽이 각자 자기 구현을 그 파일과 대조한다 — 한쪽만 고치면
 *   그쪽 CI가 빨개진다. 형제 저장소 실물 대조는 있으면 하고 없으면 **skip으로 드러낸다**
 *   (CI엔 형제가 없다 · 통과와 미실행이 같은 모양이면 안 된다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const 계약경로 = path.join(REPO, '계약', '수집_교정_계약.json');
const 계약 = JSON.parse(fs.readFileSync(계약경로, 'utf8'));
const 수집 = fs.readFileSync(path.join(REPO, '엔진_수집.js'), 'utf8');

// 소스의 배열 리터럴을 값으로 — 문자열 매칭은 줄바꿈·따옴표가 바뀌면 죽는다
function 배열(이름) {
  const m = 수집.match(new RegExp(`const ${이름} = (\\[[\\s\\S]*?\\]);`));
  assert.ok(m, `${이름} 정의를 못 찾았다 — 이름이 바뀌었다면 이 테스트도 함께 옮겨라`);
  return new Function('return ' + m[1])();
}

test('오류태그 23종이 계약과 정확히 같다 (순서까지 — 인덱스로 집계하는 곳이 있다)', () => {
  assert.deepEqual(배열('HW_ERROR_TAGS'), 계약.오류태그,
    '수집층 태그가 계약과 다르다 — 한쪽만 고쳤다면 SYNK-talk도 같이 고치고 계약 파일을 양쪽에 넣어라');
});

test('골든 판정 문자열이 계약과 같다 (Glide Choice 옵션 표가 글자까지 묶여 있다)', () => {
  assert.deepEqual(배열('GOLD_VERDICTS'), 계약.골든판정,
    '판정 문자열이 갈라졌다 — 이 값은 Glide 화면의 선택지와 문자 단위로 묶여 있어 조용히 미응답 처리된다');
});

test('픽스처 내보내기가 계약이 약속한 필드를 전부 만든다', () => {
  // exportGoldenFixture_가 push하는 객체의 키를 소스에서 뽑는다.
  // 이 항목이 계약보다 좁아지면 SYNK-talk의 채점기가 없는 필드를 읽어 조용히 0점 처리한다.
  const i = 수집.indexOf('function exportGoldenFixture_(');
  assert.notEqual(i, -1, 'exportGoldenFixture_를 못 찾았다');
  const 본문 = 수집.slice(i, 수집.indexOf('\n}\n', i));
  const j = 본문.indexOf('항목.push({');
  assert.notEqual(j, -1, '픽스처 항목을 만드는 자리를 못 찾았다');
  const 블록 = 본문.slice(j, 본문.indexOf('});', j));
  for (const f of 계약.픽스처_항목필드) {
    assert.ok(new RegExp(`(^|[\\s{,])${f}\\s*:`, 'm').test(블록),
      `픽스처 항목에 계약 필드 「${f}」가 없다 — 채점기가 그 검사를 조용히 건너뛴다`);
  }
});

test('픽스처 최상위 필드도 계약대로 만든다', () => {
  const i = 수집.indexOf('function exportGoldenFixture_(');
  const 본문 = 수집.slice(i, 수집.indexOf('\n}\n', i));
  for (const f of 계약.픽스처_최상위필드) {
    assert.ok(new RegExp(`(^|[\\s{,])${f}\\s*:`, 'm').test(본문) || 본문.includes(`doc.${f}`),
      `픽스처 최상위에 계약 필드 「${f}」가 없다`);
  }
});

test('계약 파일 자체가 비지 않았다 (빈 계약은 모든 검사를 통과시킨다)', () => {
  assert.equal(계약.오류태그.length, 23, `오류태그 수가 23이 아니다(${계약.오류태그.length}) — 줄었다면 왜 줄었는지부터`);
  assert.ok(계약.골든판정.length >= 3 && 계약.픽스처_항목필드.length >= 6,
    '계약이 얇아졌다 — 항목이 사라지면 그 이음매는 다시 프로즈로 돌아간다');
  assert.ok(new Set(계약.오류태그).size === 계약.오류태그.length, '오류태그에 중복이 있다 — 집계가 두 칸으로 갈린다');
});

test('형제 저장소 SYNK-talk의 계약 파일이 이 저장소와 같다 (줄바꿈만 제외)', (t) => {
  // 형제는 이 저장소 밖이다 — CI엔 없다. 없음을 통과로 만들지 않고 skip으로 드러낸다.
  const 형제 = path.join(REPO, '..', 'SYNK-talk', '계약', '수집_교정_계약.json');
  if (!fs.existsSync(형제)) {
    return t.skip('형제 저장소 SYNK-talk가 이 기계에 없다 — 실물 대조는 로컬에서만 (탐지는 위 검사들이 진다)');
  }
  /* 줄바꿈은 정규화하고 나머지는 바이트로 본다.
   * 실측(08-04): 이 저장소는 `계약/`에 eol 지정이 없어 core.autocrlf=true 아래 **새 클론에서
   * CRLF로 나오고**, SYNK-talk는 `* text=auto eol=lf`라 언제나 LF다 — 내용이 같은데도 대조가
   * 빨개진다. `.gitattributes`로 파일 쪽도 못박았지만, **거짓 경보를 내는 가드는 곧 꺼지므로**
   * 검사 자체도 체크아웃 정책에 안 흔들리게 둔다. 줄바꿈 차이는 계약의 분열이 아니다. */
  const 정규화 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(정규화(형제), 정규화(계약경로),
    'SYNK-talk의 계약 파일이 다르다 — 한쪽만 고쳤다. 두 저장소에 같은 내용으로 넣어야 계약이 계약이다\n' +
    `  이 저장소: ${계약경로}\n  형제:      ${형제}`);
});
