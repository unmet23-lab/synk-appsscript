// tests/소급성.test.js — [v9.151] 소급 불가 5건 수리 회귀 (판정 정본 = memory masterplan-v3-2026-08-04)
// 실행: node tests/소급성.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
//
// 지키는 것 = 지금 안 남기면 영영 되돌릴 수 없는 것들.
//   ① 동의의 행 단위 결합(어느 판 문구에 언제 동의했는가) ② 삭제 전 전 열 스냅샷
//   ③ 학생ID 불변(이력 조인의 주체 축) ④ 음성 원본 참조(무제한 보존) ⑤ 한국행 실적의 student_id 조인.
// 코드 결함은 고치면 되고 파생 데이터는 다시 계산하면 되지만, 이 다섯은 잃는 순간이 곧 영구다.

const test = require('node:test');
const assert = require('node:assert/strict');
const { engineSource } = require('./_engine-source');
/* 부정 단언의 주어만 정제한다 — 주석이 금지 패턴을 «설명»하면 그 설명이 위반으로 잡힌다(대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');
const code = engineSource().replace(/\r\n/g, '\n');

function section(startMarker, endMarker) {
  const s = code.indexOf(startMarker);
  assert.notEqual(s, -1, `섹션 시작 표식을 찾지 못함: ${startMarker}`);
  const e = code.indexOf(endMarker, s + startMarker.length);
  assert.notEqual(e, -1, `섹션 끝 표식을 찾지 못함: ${startMarker} 뒤 ${endMarker}`);
  return code.slice(s, e);
}

test('[v9.151] ① 동의 스탬프 — 무응답은 안 찍고, 찍힌 행은 불변이고, 가동 전 응답은 버전을 지어내지 않는다', () => {
  const fn = section('function 동의버전스탬프_(', '\n}\n');
  assert.ok(fn.includes("if (!String(r[ci] || '').trim()) return"), '무응답 행까지 찍는다 — 응답 없는 동의가 만들어진다');
  assert.ok(fn.includes("if (String(r[vi] || '').trim()) return"), '재실행이 기존 스탬프를 덮는다 — 과거 근거가 현재 판으로 위조된다');
  assert.ok(fn.includes("'기록전(≤'"), "가동 전 응답에 현재 버전을 소급 기재한다 — '기록전' 정직 마커가 없다");
  assert.ok(fn.includes('Math.max(62, wH) + 1'), '헤더 증분이 migrateConsentV186 규약(끝에만 추가·62열 이후)을 안 따른다');
  assert.ok(fn.includes('showColumns(firstNew'), '숨김 상속 차단이 없다 — 숨은 열 옆에 만든 스탬프 열이 안 보인다');
  // 발동 조건 — 스스로 발화하지 않는 장치는 안 돈다
  const sync = section('function syncProfiles()', '\n}\n');
  assert.ok(sync.includes('동의버전스탬프_('), 'syncProfiles가 스탬프를 안 부른다 — 장치는 있는데 발동층이 없다');
});

test('[v9.151] ② 퇴소 스냅샷 — deleteRow보다 먼저, 전 열을, JSON으로 남긴다', () => {
  const sync = section('function syncProfiles()', '\n}\n');
  const iSnap = sync.indexOf("'exit_snapshot'");
  const iDel = sync.indexOf('dst.deleteRow(rn)');
  assert.notEqual(iSnap, -1, 'exit_snapshot 보관이 없다 — 삭제가 30일 백업 너머 영구 손실이 된다');
  assert.notEqual(iDel, -1, 'deleteRow 경로를 찾지 못함(구조를 바꿨다면 이 테스트도 함께 옮겨라)');
  assert.ok(iSnap < iDel, '스냅샷이 deleteRow 뒤에 있다 — 지운 다음에는 남길 것이 없다');
  assert.ok(sync.includes('dst.getRange(rn, 1, 1, wide)'), '전 열을 읽지 않는다 — 상태열(P~CB 래칫)이 스냅샷에서 빠진다');
  assert.ok(sync.includes('JSON.stringify(v).slice(0, 49500)'), 'JSON 직렬화·50k 셀 상한 안전판이 없다');
});

test('[v9.151] ③ 학생ID 불변 가드 — 같은 이름의 「삭제+신규」 동시 관측을 id 교체로 보고 알린다', () => {
  const sync = section('function syncProfiles()', '\n}\n');
  assert.ok(sync.includes('학생ID 변경 의심'), 'id 교체 알림이 없다 — 이력 단절이 무증상으로 지나간다');
  assert.ok(sync.includes('ad.name === rm.name && ad.id !== rm.id'), '판정식이 다르다 — 같은 이름·다른 id의 동시 관측을 비교해야 한다');
  assert.ok(sync.includes('exit_snapshot)'), '알림이 복구 경로(exit_snapshot)를 안내하지 않는다 — 경보만 있고 출구가 없다');
});

test('[v9.151] ④ talk_log audio_ref — 고정 위치(11번째)에 있고, 무제한 보존 선언이 코드에 산다', () => {
  const m = code.match(/const TALK_LOG_HEADERS = (\[[^\]]*\]);/);
  assert.ok(m, 'TALK_LOG_HEADERS 정의를 찾지 못함');
  const H = JSON.parse(m[1].replace(/'/g, '"'));
  // [v9.187] 「맨 끝」→「고정 11번째」 — 급수 열이 뒤에 붙으면서(스키마 감사) 「끝」은 더 이상 위치의 증거가 아니다.
  //   지키려는 불변식은 처음부터 「앞에 끼우지 않는다(위치 접근 r[1]~r[6] 불변)」였고, 인덱스 고정이 그걸 더 세게 잰다.
  assert.equal(H[10], 'audio_ref', 'audio_ref가 11번째(고정 위치)가 아니다 — 위치 접근이 밀리거나 열이 없다');
  // 보존 정책이 헤더 주석에 선언돼 있어야 한다 — SYNK-talk이 녹음을 설계하는 날 이 주석이 계약이다
  const at = code.indexOf('const TALK_LOG_HEADERS');
  const near = code.slice(Math.max(0, at - 1500), at);
  assert.ok(near.includes('무제한'), '음성 원본 무제한 보존(유호 확정 08-04) 선언이 헤더 주석에 없다');
});

test('[v9.207] ⑥ schema_ver — 3시트가 열을 갖고, 적재 5자리가 값을 싣고, 라이브 시트 치유를 지난다', () => {
  // ① 열 정의. **「끝 칸」으로 재지 않는다** — 다음 열이 규약대로 끝에 붙는 날 이 검사가 거짓 적색이 된다.
  //    지키려는 불변식은 위치가 아니라 존재와 적재다(위치를 지는 것은 ④ audio_ref 하나뿐이고 사유가 다르다).
  ['HW_FEEDBACK_HEADERS', 'QUIZ_LOG_HEADERS', 'TALK_LOG_HEADERS'].forEach((name) => {
    const m = code.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`));
    assert.ok(m, `${name} 정의를 찾지 못함(이름을 바꿨다면 이 검사도 함께 옮겨라)`);
    assert.ok(new Function('return ' + m[1])().includes('schema_ver'),
      `${name}에 schema_ver가 없다 — 그 시트 행은 어느 계약 규격으로 쓰였는지 영영 말하지 못한다(A-8 · 소급 불가)`);
  });
  /* ② 적재. 헤더만 늘리면 **열은 서고 값은 영원히 빈칸**이다 — talk_log의 model·prompt_ver가 v9.145에서
   *    정확히 그 상태였고(「v9.145 이전 행은 두 칸이 비어 있습니다」), 그 구간은 소급이 없다.
   *    **경로별로 잰다** — 총 개수만 세면 한 경로가 빠지고 다른 경로에 두 번 실려도 통과한다(①배포 검수 P3 지적 `a937affd`).
   *    앵커는 실패 쪽을 `e.permanent`(코드)로 잡는다 — 그냥 'permanent'는 위쪽 주석의 같은 낱말에 먼저 걸려
   *    성공 행을 실패 행으로 오인하고 자기일관 초록이 된다(수집.test.js가 변이 시험으로 실측한 구멍). */
  const 실린다 = (구간, re, 이름) => {
    const m = 구간.match(re);
    assert.ok(m, `${이름}: 적재 리터럴을 찾지 못함(구조를 바꿨다면 이 검사도 함께 옮겨라)`);
    assert.ok(/SCHEMA_VER/.test(m[0]),
      `${이름}에 schema_ver가 안 실린다 — 그 경로로 들어온 행만 자기 규격을 영영 말하지 못한다(다른 경로가 실어도 못 메운다)`);
  };
  const quizFn = section('function quizSweep_(ss)', '\n}\n');
  실린다(quizFn, /out\.push\(\[[\s\S]*?\]\);/, 'quiz 응답 행');
  const talkFn = section('function talkBatch_()', '\n}\n');
  실린다(talkFn, /const row = \[[\s\S]*?\];/, 'talk 성공 행');
  실린다(talkFn, /e\.permanent[\s\S]*?tl\.appendRow\(\[[\s\S]*?\]\);/, 'talk 영구실패 행');
  const hwFn = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  실린다(hwFn, /fb\.appendRow\(\[fbId,[\s\S]*?\]\);/, 'hw 성공 행');
  실린다(hwFn, /e\.permanent[\s\S]*?fb\.appendRow\(\[[\s\S]*?\]\);/, 'hw 영구실패 행');
  // ③ 치유. ensureSheet는 시트가 **없을 때만** 헤더를 쓴다 — 이미 라이브에 서 있는 시트는 헤더보정_을
  //    지나지 않으면 append가 폭을 넘는 새 칸을 **조용히 버린다**(적재되는 척하며 사라지는 그 형태).
  ['hwFeedbackEnsureCols_(fb)', '헤더보정_(ql, QUIZ_LOG_HEADERS)', 'talkHeaderHeal_(tl)'].forEach((호출) => {
    assert.ok(code.includes(호출),
      `치유 호출이 없다: ${호출} — 라이브 시트에 이미 서 있는 폭 때문에 새 칸이 조용히 버려진다`);
  });
  /* ④ 읽기 폭. `dataCoverageReport` 는 **읽기 전용이라 치유를 안 부른다**(언제 눌러도 안전한 것이 그 함수의 계약).
   *    그래서 헤더 상수만 늘어난 구간에 상수 폭을 시트에 그대로 요구하면, 아직 안 넓혀진 라이브 시트에서
   *    getRange 가 던져 **리포트가 통째로 죽는다**. hw·voice 는 원래 `Math.min` 으로 잘랐고 quiz·talk 만
   *    안 잘라 넷이 갈라져 있었다(①배포 검수 P3 `2d09296c` 가 짚었다 — schema_ver 가 그 비대칭을 발화시켰다).
   *    새 시트를 이 리포트에 추가하면서 같은 실수를 하면 여기서 빨개진다(새는 방향이 닫힌다). */
  const 리포트 = section('function dataCoverageReport(opts)', '\n}\n');
  assert.ok(!/_HEADERS\.length\)\.getValues\(\)/.test(코드만(리포트)),
    'dataCoverageReport 가 헤더 상수 폭을 시트에 그대로 요구한다 — 치유를 안 지난 라이브 시트에서 getRange 가 던져 ' +
    '리포트가 통째로 죽는다. hw(`Math.min(HW_FEEDBACK_HEADERS.length, fb.getLastColumn())`)와 같은 모양으로 자를 것');
  /* ⑤ [v9.208] voice_log — 수집 4시트의 마지막(파일이 달라 위 3시트 축에 못 실렸던 자리 · A-8 2단계).
   *    열·적재는 여기서 같은 잣대로 재고, 치유(`헤더보정_(vl, VOICE_LOG_HEADERS)`)는 수집.test.js 가
   *    이미 못박고 있어 다시 적지 않는다(같은 판정이 두 곳에 살면 갈라진다).
   *    ⚠ 적재 값 `SCHEMA_VER` 는 엔진_수집.js 의 전역 상수를 교재연동.js 가 함수 안에서 참조한다 —
   *    사본 상수를 두면 계약.test.js(판 대조)가 그 사본을 못 본다. 이 검사는 참조가 실려 있는 것까지만 잰다. */
  const 교재 = require('fs').readFileSync(require('path').join(__dirname, '..', '교재연동.js'), 'utf8').replace(/\r\n/g, '\n');
  const vm = 교재.match(/const VOICE_LOG_HEADERS = (\[[^\]]*\]);/);
  assert.ok(vm, 'VOICE_LOG_HEADERS 정의를 찾지 못함(이름을 바꿨다면 이 검사도 함께 옮겨라)');
  assert.ok(new Function('return ' + vm[1])().includes('schema_ver'),
    'voice_log에 schema_ver가 없다 — 그 시트 행은 어느 계약 규격으로 쓰였는지 영영 말하지 못한다(A-8 · 소급 불가)');
  실린다(교재.slice(교재.indexOf('function voiceSweep_(')), /vOut\.push\(\[[\s\S]*?\]\);/, 'voice 폼 행');
});

test('[v9.151] ⑤ hall_of_fame — student_id 헤더가 정의에 있고, 기존 시트에도 세우는 증분이 있다', () => {
  assert.ok(code.includes("'hall_of_fame', ['연도','이름','반','업적','한마디','사진URL','student_id']"),
    'hall_of_fame 정의에 student_id가 없다 — 졸업 후 이력 조인이 영영 불가');
  assert.ok(code.includes("hof.getRange(1, 7).setValue('student_id')"),
    '기존 시트 증분이 없다 — ensureSheet는 이미 있는 시트의 머리글을 고치지 않는다');
});
