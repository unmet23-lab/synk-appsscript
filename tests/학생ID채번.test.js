// 학생ID(SYNK-NNN) 채번·자동 발급 회귀 [v9.164]
// 지키는 것: ①번호를 만드는 곳이 하나뿐 ②게이트(사람의 결정)가 살아 있음 ③발동층 2겹이 실제로 등록됨
//
// 왜 별도 파일인가: safety.test.js는 여러 세션이 동시에 만지는 큰 파일이다. 새 트랙의 회귀를
// 거기에 얹으면 충돌 지점이 늘어난다(멀티세션 규약).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const 폼리포트 = read('엔진_폼리포트.js');
const 셋업확장 = read('엔진_셋업확장.js');
const 운영배치 = read('엔진_운영배치.js');
const 크루카드상담 = read('crewcard/상담시트.js');

/* 주석을 걷어내고 **실행되는 코드만** 남긴다 — 통로는 공용 하나다.
 * 근거: 가드가 주석까지 세면 「채번 규칙을 설명한 주석」이 위반으로 잡힌다(실제로 처음에 그랬다).
 *   문서화를 벌하는 가드는 사람이 주석을 지우거나 가드를 끄는 법을 배우게 만든다 — clasp-guard가 겪은 것과 같은 함정.
 * 🔑 [2026-08-13] 지역 사본을 `tests/lib/소스검사.js` 로 돌렸다(F401 계열 · 대기열 P3 줄73).
 *   옛 판은 «줄머리» `//` 만 지워서 **인라인 주석이 그대로 남았다** — `const x = 1; // SYNK-001` 같은
 *   자리가 코드로 세어졌다. 동시에 문자열 속 `//` 를 지킬 근거는 없었다. 공용 판은 렉서라 둘 다
 *   옳게 본다(인라인도 지우고, `'https://…'` 는 살린다). */
const { 코드만 } = require('./lib/소스검사.js');

function section(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${startMarker}`);
  const e = src.indexOf(endMarker, s + startMarker.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${endMarker}`);
  return src.slice(s, e);
}

test('채번 통로가 하나다 — SYNK 번호를 조립하는 곳은 학생ID_포맷_ 뿐', () => {
  // 상담시트에는 유일성 제약이 없다. 두 곳에서 번호를 만들면 언젠가 한쪽만 고쳐지고,
  // 그 결과는 「같은 학생ID를 가진 두 학생」이다(profiles 키가 학생ID).
  const 포맷 = section(폼리포트, 'function 학생ID_포맷_', '\n}');
  assert.ok(포맷.includes("'SYNK-' + String(n).padStart(3, '0')"), '포맷 정본이 바뀌었다');

  // 정본 함수 밖에서 'SYNK-' 문자열을 붙여 번호를 만드는 곳이 있으면 안 된다(주석 제외 — 코드만 센다).
  const 조립 = [...코드만(폼리포트).matchAll(/'SYNK-'\s*\+/g)].length;
  assert.equal(조립, 1, `'SYNK-' + … 조립이 ${조립}곳 — 학생ID_포맷_ 하나만 남아야 한다`);

  // 옛 통로(인라인 스캔) 금지
  /* 🔑 여기도 정제본으로 잰다 — 아래 test 의 `imp` 는 이미 정제인데 이 자리만 원문이면 계수기가
   *   «첫 선언이 이긴다» 근사로 **저쪽까지 원문으로 물들여** 멀쩡한 자리가 위험으로 세어졌다(#Q72 실측). */
  const imp = 코드만(section(폼리포트, 'function importFormResponses()', 'function setupStore()'));
  assert.ok(!/match\(\/\^SYNK-/.test(imp), 'importFormResponses에 인라인 SYNK 스캔이 되살아났다');
});

test('구글폼 접수도 게이트를 지난다 — 제출만으로는 학생ID가 안 붙는다 [v9.167]', () => {
  // 실측 08-04: app_state '상담폼ID'가 살아 있고 폼은 「게시됨」 — 이 경로는 지금도 10분마다 돈다.
  // 같은 시트에 정책이 둘이면(폼=즉시 발급 / 크루카드=사람 게이트) **느슨한 쪽이 실질 정책**이 된다.
  const imp = 코드만(section(폼리포트, 'function importFormResponses()', 'function setupStore()'));

  assert.ok(!/학생ID_포맷_\(/.test(imp),
    'importFormResponses가 다시 학생ID를 조립한다 — 폼 제출 = 앱 로스터가 된다');
  assert.ok(!/학생ID_열_/.test(imp),
    'importFormResponses가 학생ID 열에 쓴다 — 발급 통로는 학생ID_발급_ 하나여야 한다');

  // 대신 같은 큐에 넣는다 — 처리상태가 비면 원장 화면에서 보이지 않아 조용히 유실된다
  assert.ok(imp.includes("'신규접수'") && imp.includes("'구글폼'"),
    '폼 접수 행이 처리상태/접수출처를 안 채운다 — 발급 큐에서 보이지 않는다');
});

test('cleanupFormTest는 실학생·크루카드 접수를 지우지 않는다 [v9.167]', () => {
  // 이 함수의 구 전제는 「상담시트 = 테스트판」이었다. 지금은 실접수와 발급된 학생이 같이 산다.
  // 편집기 함수 드롭다운은 합성 클릭에 미끄러지는 것으로 실측됐고(08-04), 오실행 1회 = 되돌릴 수 없는 소실.
  const cln = 코드만(section(폼리포트, 'function cleanupFormTest()', 'function setupTables()'));
  assert.ok(/학생ID_열_ - 1/.test(cln), '학생ID 보유 행(실학생) 보호가 없다 — 오실행 1회로 로스터가 지워진다');
  assert.ok(cln.includes("idx['접수출처']") && cln.includes("!== '구글폼'"),
    '크루카드 접수 행 보호가 없다 — 발급 대기 중인 실접수가 지워진다');
  assert.ok(!/if \(r\[0\]\) \{ consult\.getRange\(8 \+ i/.test(cln),
    '옛 무조건 삭제(A열에 값만 있으면 지운다)가 되살아났다');
});

test('발급 게이트 — 상태·기존ID·이름을 모두 확인하고, 공개 접수는 스스로 ID를 못 만든다', () => {
  const 발급 = section(폼리포트, 'function 학생ID_발급_()', '\n/* 상담시트 설치형 onEdit');

  // ① 사람이 정한 상태에서만 — 「신규접수」로 들어온 크루카드 행은 절대 발급되지 않는다
  assert.ok(발급.includes('학생ID_발급상태_.indexOf('), '처리상태 검사가 없다 — 접수 즉시 로스터 진입');
  const 상태 = new Function(`${section(폼리포트, 'const 학생ID_발급상태_', ';')}; return 학생ID_발급상태_;`)();
  assert.deepEqual(상태, ['반배정', '앱편입'], '발급 상태 목록이 바뀌었다');
  assert.ok(상태.indexOf('신규접수') === -1, '「신규접수」에 발급하면 공개 링크가 곧 로스터가 된다');

  // ② 이미 있는 ID는 건드리지 않는다(재실행 안전 — 아침 백스톱이 매일 돈다)
  assert.ok(/if \(String\(rows\[i\]\[학생ID_열_ - 1\] \|\| ''\)\.trim\(\)\) continue;/.test(발급),
    '기존 학생ID 보호 가드가 없다 — 매일 아침 번호가 갈아끼워진다');

  // ③ 무명 행 금지 — syncProfiles가 row[0]을 이름으로 그대로 쓴다
  assert.ok(발급.includes('if (!이름) continue;'), '이름 빈 행 가드가 없다 — 무명 학생이 앱에 생긴다');

  // ④ 락 — 폼 임포트와 같은 프로젝트 락으로 직렬화되어야 번호가 안 겹친다
  assert.ok(발급.includes('LockService.getScriptLock()') && 발급.includes('releaseLock()'),
    '채번이 락 밖에 있다 — 폼 임포트와 동시 실행 시 같은 번호가 두 번 나간다');

  // ⑤ 증분 전 시트에서는 아예 열지 않는다(처리상태 열이 없으면 판단 근거가 없다)
  assert.ok(발급.includes("colOf['처리상태']") && 발급.includes('c상태 === undefined'),
    '처리상태 열 부재 가드가 없다');
});

test('크루카드(별도 프로젝트)는 여전히 학생ID를 만들지 않는다', () => {
  // 락은 프로젝트마다 별개다 — 저쪽에서 채번하면 이쪽 락이 아무것도 못 막는다.
  assert.ok(!/'SYNK-/.test(코드만(크루카드상담)),
    '크루카드 프로젝트가 학생ID를 조립한다 — 프로젝트 간 락은 공유되지 않아 번호가 겹친다');
  const 매핑 = 코드만(section(크루카드상담, 'function 크루카드_상담매핑_', 'function 상담시트_이관_'));
  assert.ok(!/['"]학생ID['"]\s*:/.test(매핑), '이관 매핑이 학생ID를 채운다');
});

test('발동층 2겹이 실제로 등록된다 — 트리거 + 아침 백스톱', () => {
  // 가드는 로직이 아니라 **등록층**에서 샌다. 훅이 아무리 정확해도 안 불리면 통과가 된다.
  // ① 설치형 onEdit — 상담시트는 외부 파일이라 단순 트리거로는 안 걸린다
  assert.ok(폼리포트.includes("ScriptApp.newTrigger('onConsultEdit').forSpreadsheet(CONSULT_SHEET_ID).onEdit()"),
    'setupConsultTrigger가 설치형 onEdit을 안 만든다');

  // ② 핸들러 이름에 밑줄이 없어야 한다 — 밑줄 종결 함수는 트리거가 못 부른다(조용히 안 돈다)
  assert.ok(/function onConsultEdit\(e\)/.test(폼리포트), 'onConsultEdit 핸들러가 없거나 이름이 바뀌었다');
  assert.ok(!/newTrigger\('[^']*_'\)/.test(폼리포트) && !/newTrigger\('[^']*_'\)/.test(셋업확장),
    '밑줄로 끝나는 함수를 트리거 핸들러로 등록했다 — 조용히 안 돈다');

  // ③ 🔑 전체 삭제-재설치 목록에 반드시 있어야 한다.
  //    setupTriggers는 모든 트리거를 지우고 목록만 다시 만든다 — 여기 없으면 조용히 실종된다([v9.67] 재발).
  const setup = section(셋업확장, 'triggers.forEach(t => ScriptApp.deleteTrigger(t));', '트리거 통합 재설치 완료');
  assert.ok(setup.includes("newTrigger('onConsultEdit')"),
    'setupTriggers 재설치 목록에 onConsultEdit이 없다 — 트리거 재설치 한 번에 사라진다');

  // ④ 아침 백스톱이 syncProfiles보다 **앞**에 있어야 그날 아침 앱에 들어간다
  const morning = section(셋업확장, 'function morningJobs()', '\nfunction nightJobs()');
  const i발급 = morning.indexOf('학생ID_발급_');
  const iSync = morning.indexOf('syncProfiles');
  assert.ok(i발급 !== -1, 'morningJobs에 학생ID 발급 백스톱이 없다 — 트리거가 죽으면 발동층이 0이 된다');
  assert.ok(i발급 < iSync, '학생ID 발급이 syncProfiles 뒤에 있다 — 발급된 학생이 하루 늦게 앱에 들어간다');
});

test('syncProfiles의 전제가 그대로다 — 학생ID 없는 행은 앱에 안 들어간다', () => {
  // 이 성질이 「게이트」의 실체다. 여기가 바뀌면 크루카드 무토큰 공개 링크의 안전 근거가 통째로 무너진다.
  const sync = section(운영배치, 'function syncProfiles()', 'function dailyBackup');
  assert.ok(/const userId = row\[59\];/.test(sync), '학생ID 열 인덱스(59)가 바뀌었다 — 채번 열 60과 맞춰야 한다');
  assert.ok(/if \(!userId\) return;/.test(sync),
    '학생ID 없는 행을 건너뛰지 않는다 — 공개 접수가 곧바로 앱 로스터가 된다');
});
