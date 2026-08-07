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

/* ⚠ 아래 두 검사는 **특정 함수에 붙이지 않는다.**
 *   08-04 실측: 처음엔 `exportGoldenFixture_` 본문을 잘라서 그 안을 봤는데, 타 세션이 항목
 *   조립부를 **다른 함수로 분리**하자 앵커가 통째로 죽었다("자리를 못 찾았다"). 이 저장소가
 *   이미 적어 둔 교훈 그대로다 — **문구 앵커는 문구가 바뀌면 죽는다.**
 *   그래서 「어느 함수인가」가 아니라 **「파일 어딘가에 픽스처를 만드는 자리」**로 찾는다. */
function 블록찾기(시작표식, 끝표식) {
  const j = 수집.indexOf(시작표식);
  assert.notEqual(j, -1,
    `픽스처를 만드는 자리를 못 찾았다(${시작표식}) — 조립 방식이 바뀌었다면 이 테스트도 함께 옮겨라`);
  const e = 수집.indexOf(끝표식, j);
  assert.notEqual(e, -1, `${시작표식} 의 끝(${끝표식})을 못 찾았다`);
  return 수집.slice(j, e);
}

test('픽스처 항목이 계약이 약속한 필드를 전부 만든다', () => {
  // 계약보다 좁아지면 SYNK-talk 채점기가 없는 필드를 읽고 **폴백이 조용히 통과시킨다**
  // (`fx.포함 || []` 형태라 「검사 통과」와 「검사 안 함」이 같은 모양이 된다 — v9.173 실사고).
  const 블록 = 블록찾기('항목.push({', '});');
  for (const f of 계약.픽스처_항목필드) {
    assert.ok(new RegExp(`(^|[\\s{,])${f}\\s*:`, 'm').test(블록),
      `픽스처 항목에 계약 필드 「${f}」가 없다 — 채점기가 그 검사를 조용히 건너뛴다`);
  }
});

test('픽스처 최상위 필드도 계약대로 만든다', () => {
  const 블록 = 블록찾기('const doc = {', '\n  };');
  for (const f of 계약.픽스처_최상위필드) {
    assert.ok(new RegExp(`(^|[\\s{,])${f}\\s*:`, 'm').test(블록) || 수집.includes(`doc.${f}`),
      `픽스처 최상위에 계약 필드 「${f}」가 없다`);
  }
});

test('계약 파일 자체가 비지 않았다 (빈 계약은 모든 검사를 통과시킨다)', () => {
  assert.equal(계약.오류태그.length, 24, `오류태그 수가 24가 아니다(${계약.오류태그.length}) — 줄었다면 왜 줄었는지부터`);
  assert.ok(계약.골든판정.length >= 3 && 계약.픽스처_항목필드.length >= 6,
    '계약이 얇아졌다 — 항목이 사라지면 그 이음매는 다시 프로즈로 돌아간다');
  assert.ok(new Set(계약.오류태그).size === 계약.오류태그.length, '오류태그에 중복이 있다 — 집계가 두 칸으로 갈린다');
});

/* ── M0 계약 동결: learning_events (N1) ─────────────────────────────────────
 * 여기부터는 「학습 행동 한 건」의 규격이다. 아직 테이블도 열도 없다(M0 = 엔진 코드 0줄).
 * 그래서 검사할 수 있는 것은 **계약 자신의 정합성**과 **계약이 라이브를 정확히 가리키는가** 둘이다.
 * ⚠ 「아직 없다」를 단언하는 검사는 넣지 않는다 — 구현되는 날 빨개지는 회귀는 버그가 남아
 *   있기를 요구하는 회귀다. 대신 미구현 항목은 라이브_대응으로 옮겨질 때 자동으로 감시 대상이 된다. */
const LE = 계약.learning_events;
const 전필드 = Object.values(LE.필드).flat();

test('learning_events 필드가 전부 정확히 한 번 분류된다 (미분류·이중분류가 곧 계약의 구멍이다)', () => {
  const 라이브 = Object.keys(LE.라이브_대응);
  const 미구현 = LE.미구현;

  assert.equal(new Set(전필드).size, 전필드.length,
    `필드가 두 묶음에 중복됐다 — 어느 묶음의 규칙을 따르는지 읽는 사람마다 달라진다: ${전필드.filter((f, i) => 전필드.indexOf(f) !== i).join(', ')}`);

  const 겹침 = 라이브.filter((f) => 미구현.includes(f));
  assert.deepEqual(겹침, [], `라이브이면서 동시에 미구현인 필드: ${겹침.join(', ')} — 구현했으면 미구현에서 빼라`);

  const 미분류 = 전필드.filter((f) => !라이브.includes(f) && !미구현.includes(f));
  assert.deepEqual(미분류, [],
    `분류되지 않은 필드: ${미분류.join(', ')} — 필드를 늘렸으면 라이브_대응이나 미구현 중 한쪽에 넣어라. 안 넣으면 "있는 줄 알았는데 아무도 안 만드는" 필드가 된다`);

  const 유령 = [...라이브, ...미구현].filter((f) => !전필드.includes(f));
  assert.deepEqual(유령, [], `필드 목록에 없는 것이 분류돼 있다: ${유령.join(', ')} — 필드를 지웠는데 분류만 남았다`);
});

test('계약이 가리키는 라이브 열이 실제로 수집층 헤더에 있다 (열 개명이 계약을 조용히 죽인다)', () => {
  /* 특정 상수 이름에 매달지 않는다 — 시트가 늘면 상수도 는다. 파일 안의 *_HEADERS 를 전부 모아 합집합으로 본다.
   * ⚠ voice_log 헤더는 이 파일 밖(교재연동이 자체 관리 — 스키마감사 「잔여」)이라, 그 시트에만 있는 열은
   *   여기 대응에 넣지 않았다. 넣으려면 이 검사부터 그 파일로 넓혀야 한다. */
  const 헤더합 = new Set();
  let 상수수 = 0;
  for (const m of 수집.matchAll(/const \w+_HEADERS = (\[[\s\S]*?\]);/g)) {
    상수수++;
    for (const h of new Function('return ' + m[1])()) 헤더합.add(h);
  }
  assert.ok(상수수 >= 3,
    `수집층에서 헤더 상수를 ${상수수}개밖에 못 뽑았다 — 정규식이 죽었으면 이 검사는 무엇이든 통과시킨다`);

  for (const [필드, 열들] of Object.entries(LE.라이브_대응)) {
    assert.ok(Array.isArray(열들) && 열들.length, `라이브_대응 「${필드}」에 열이 없다`);
    for (const 열 of 열들) {
      assert.ok(헤더합.has(열),
        `계약이 「${필드}」는 라이브 열 「${열}」로 있다고 적었는데 수집층 헤더에 없다 — 열을 개명·삭제했다면 계약도 같이 고쳐라(안 고치면 L0 이관 때 이 필드가 통째로 증발한다)`);
    }
  }
});

test('learning_events 값목록이 닫혀 있고 비어 있지 않다 (빈 통제 어휘는 자유 문자열과 같다)', () => {
  for (const [이름, 값들] of Object.entries(LE.값목록)) {
    assert.ok(값들.length >= 3, `값목록 「${이름}」이 ${값들.length}개뿐이다 — 축이 되려면 구분이 있어야 한다`);
    assert.equal(new Set(값들).size, 값들.length, `값목록 「${이름}」에 중복이 있다 — 집계가 두 칸으로 갈린다`);
  }
  // 오류태그와 같은 이유로 크기를 못박는다. 줄었다면 왜 줄었는지가 먼저다.
  assert.equal(LE.값목록.task_type.length, 6, `task_type이 6종이 아니다(${LE.값목록.task_type.length})`);
  assert.equal(LE.값목록.source_kind.length, 4, `source_kind가 4종이 아니다(${LE.값목록.source_kind.length})`);
  /* c4 = c3 6종 + 3종 · c5 = +1종. 값 추가는 하위호환이지만 **삭제·개명은 과거 집계를 깨뜨린다**(값목록_규칙).
   * 이름을 하나씩 못박는 이유: 개수만 세면 하나를 지우고 하나를 더해도 통과한다. */
  for (const v of ['intervention.delivered', 'correction.viewed', 'data_use.granted']) {
    assert.ok(LE.값목록.event_type.includes(v),
      `c4가 추가한 event_type 「${v}」가 없다 — 없으면 AI 개입·교정 조회·훈련 승격이 계약 밖 사건이 된다(L0 §3-2·§6-1·C0 §9)`);
  }
  /* 🔴 c5: 폐기(discarded)와 철회(revoked)는 다른 사건이다. 승격이 사건이면 철회도 사건이어야
   * 대칭이 맞고, 한 축으로 두면 「지웠어야 할 것이 남는다」가 **증상 없이** 성립한다(L0 §9-3).
   * 동의문(`docs/동의_문구_v1.md`)이 「보관 중인 녹음을 모두 삭제」를 약속한 자리다. */
  assert.ok(LE.값목록.event_type.includes('data_use.revoked'),
    'c5가 추가한 event_type 「data_use.revoked」가 없다 — 철회가 계약 밖 사건이 되면 동의문이 거짓말이 된다');
  /* 🔴 c6: 둘 다 「없으면 나중에 못 만드는」 사건이다.
   *  task.assigned = 부재의 **분모**. 접속 0인 날만 세면 「안 왔다」와 「낼 게 없던 날」이 같은 모양이라
   *    이탈 신호를 영영 못 배운다 — 그날 낼 것이 있었는지는 그날만 안다.
   *  exam.result  = TOPIK 실성적(**강사 입력** · 유호님 확정 2026-08-06). 게이트 3축의 ③이
   *    「TOPIK 취득에 도움되는가」인데 c5까지 그 축을 재는 사건이 하나도 없었다. */
  for (const v of ['task.assigned', 'exam.result']) {
    assert.ok(LE.값목록.event_type.includes(v),
      `c6가 추가한 event_type 「${v}」가 없다 — 부재의 분모와 TOPIK 성과가 계약 밖 사건이 된다`);
  }
  /* 🔴 c9: 「학생이 실제로 보고·들었다」는 **관측** 사건(유호님 확정 2026-08-07 · 절단문서 §결정 요청).
   *   이것 하나가 소급불가 둘을 닫는다 — ①-2(재생 완료·자기 목소리 되듣기 = 오디오 **밖**의 화면
   *   행동이라 WAV 에서 파생 불가)와 ①-12(`intervention.delivered` 는 전날 밤 배치의 **추정**이라
   *   관측 짝이 없으면 네트워크 실패가 「전달 완료」로 학습된다). 「그날 열었는가」는 그날에만 안다. */
  assert.ok(LE.값목록.event_type.includes('content.viewed'),
    'c9가 추가한 event_type 「content.viewed」가 없다 — 관측 짝이 없으면 추정이 관측 행세를 한다');
  assert.equal(LE.값목록.event_type.length, 13, `event_type이 13종이 아니다(${LE.값목록.event_type.length})`);
  /* task_format 은 task_type 과 **다른 축**이다(통로 vs 형식). 이름이 비슷해 실제로 한 번 섞였다 —
   * 발주 §1이 task_type 에 낭독·자유발화를 넣었다. 섞이면 섀도잉과 자유발화를 나중에 못 가른다. */
  /* 🔴 c7: 병렬 코퍼스(몽골어↔한국어)의 축. `번역`이 없으면 「몽골어 원문이 있는 답」과 「없는 답」이
   *   한 칸에 섞이고, 섞인 뒤에는 못 가른다 — 제시문은 그 순간에만 남길 수 있다.
   *   DB 는 여기서 한 발 더 나간다: `task_format='번역'`인데 `task_snapshot.mn`이 비면 행을 거절한다
   *   (`submissions_translation_source_c7`) — 축만 있고 원문이 없으면 코퍼스가 아니라 그냥 한국어 문장이다. */
  assert.ok(LE.값목록.task_format.includes('번역'),
    'c7이 추가한 task_format 「번역」이 없다 — 병렬 코퍼스의 왼쪽(몽골어 제시문)을 담을 축이 사라진다');
  assert.equal(LE.값목록.task_format.length, 7, `task_format이 7종이 아니다(${LE.값목록.task_format.length})`);
  assert.equal(LE.값목록.task_format.filter((v) => LE.값목록.task_type.includes(v)).length, 0,
    'task_format과 task_type에 같은 값이 있다 — 두 축이 한 어휘로 뭉개지는 중이다');
  // 값목록이 있는 필드는 실제 필드 목록에도 있어야 한다 — 어휘만 남고 필드가 사라지면 아무도 모른다
  for (const 이름 of Object.keys(LE.값목록)) {
    assert.ok(전필드.includes(이름), `값목록 「${이름}」에 해당하는 필드가 없다 — 필드를 지웠거나 이름이 갈렸다`);
  }
  assert.ok(전필드.length >= 30,
    `learning_events 필드가 ${전필드.length}개로 얇아졌다 — 지웠다면 그 필드가 소급 불가인지부터 확인하라`);
});

test('필드로 만들지 않기로 한 항목이 계약 필드에 몰래 들어오지 않았다', () => {
  /* privacy_class 는 §9 유호님 기각(「이 행을 훈련에 써도 되나」를 말하는 열 금지 · 재제안 금지)이다.
   * c4에서 「보류·확정 대기」가 아니라 **금지 목록**임을 이름으로 못박았다(L0 §6-2로 해소).
   * 필드로 들어가면 기각을 코드로 뒤집는 셈이 된다. */
  const 금지 = Object.keys(LE.필드로_만들지_않는다);
  assert.ok(금지.length, '금지 목록이 비었다 — 지웠다면 이 검사도 함께 지워라(빈 목록은 아무것도 안 지킨다)');
  for (const f of 금지) {
    assert.ok(!전필드.includes(f),
      `「${f}」는 필드로 만들지 않기로 한 것인데 계약 필드에 들어와 있다 — 유호님 기각을 코드가 뒤집었다`);
  }
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
    '  고치는 법: node tools/계약동기화.js  (손으로 옮기지 마라 — c1 「불변」이 그렇게 갈렸다)\n' +
    `  이 저장소: ${계약경로}\n  형제:      ${형제}`);
});
