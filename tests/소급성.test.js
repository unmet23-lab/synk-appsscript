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

test('[v9.151] ⑤ hall_of_fame — student_id 헤더가 정의에 있고, 기존 시트에도 세우는 증분이 있다', () => {
  assert.ok(code.includes("'hall_of_fame', ['연도','이름','반','업적','한마디','사진URL','student_id']"),
    'hall_of_fame 정의에 student_id가 없다 — 졸업 후 이력 조인이 영영 불가');
  assert.ok(code.includes("hof.getRange(1, 7).setValue('student_id')"),
    '기존 시트 증분이 없다 — ensureSheet는 이미 있는 시트의 머리글을 고치지 않는다');
});
