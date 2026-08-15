// tests/기능압축.test.js — [v9.147] 기능 압축(수집기 우선) 회귀 테스트
// 실행: node --test tests/기능압축.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
//
// 이 테스트가 지키는 것 = **압축이 「감량」에서 「출혈」로 조용히 넘어가지 않는 것**.
//   기능을 끄는 일은 코드 몇 줄이면 되지만, 잘못 끄면 증상이 「학생이 앱을 덜 연다」로만 나타난다 —
//   에러도 안 나고 테스트도 안 울어서, 개원 후 몇 달 뒤 참여율로만 드러난다. 그래서 여기서는
//   ①끄는 방식(호출부 존치·조기 반환) ②유지하기로 한 것이 실제로 살아 있는지 ③보상 게이트의 판정력
//   세 가지를 기계로 못박는다.
//
// ⚠ 「스위치가 false인지」만 검사하지 않는다 — 그건 유호님이 되살리는 순간 무고하게 빨간불이 된다.
//   검사하는 것은 **스위치가 실제로 그 함수의 동작을 가르는가**(배선)이고, 값 자체는 자유다.

const test = require('node:test');
const assert = require('node:assert/strict');

const { engineSource } = require('./_engine-source');
const code = engineSource().replace(/\r\n/g, '\n');
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다(「CARD_OFF 에 넣지 않는다」를 적어 둔 자리가 곧 위반이 된다). (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');

/* 파일 끝까지 자르는 변형 — 마지막 엔진 파일(엔진_수집.js)의 마지막 함수는 뒤에 표식이 없다.
 * 없는 표식을 억지로 만들면(다음 함수 이름 등) 그 이름이 바뀌는 순간 가드가 죽는다. */
function sectionToEnd(startMarker) {
  const s = code.indexOf(startMarker);
  assert.notEqual(s, -1, `섹션 시작 표식을 찾지 못함: ${startMarker}`);
  return code.slice(s);
}

function section(startMarker, endMarker) {
  const s = code.indexOf(startMarker);
  assert.notEqual(s, -1, `섹션 시작 표식을 찾지 못함: ${startMarker}`);
  const e = code.indexOf(endMarker, s + startMarker.length);
  assert.notEqual(e, -1, `섹션 끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(s, e);
}

/* 재작성 게이트 3종을 실값으로 로드 — 순수 함수라 시트 없이 돈다.
 * 문자열 검사가 아니라 **실제 판정**을 재는 이유: 정규식을 고치면서 판정력이 죽어도
 * "REWRITE_ECHO_RATIO가 코드에 있다"는 검사는 그대로 초록이다([[guard-must-check-result]]). */
function loadRewrite() {
  const s = code.indexOf('const REWRITE_ECHO_RATIO');
  const e = code.indexOf('function 재작성지급_');
  assert.notEqual(s, -1, '재작성 구역 시작을 찾지 못함');
  assert.notEqual(e, -1, '재작성 구역 끝을 찾지 못함');
  return new Function(`const PT = { 재작성: 3 };
    ${code.slice(s, e)}
    return { 재작성정규화_, 재작성에코_, 재작성판정_, REWRITE_ECHO_RATIO, REWRITE_COOLDOWN_DAYS };`)();
}

test('[v9.147] 압축 스위치는 호출부를 지우지 않고 함수 안에서 갈린다(가역성의 실체)', () => {
  // 호출부를 지우면 되살릴 때 배선을 다시 찾아야 하고, safety.test의 배치 순서 검사도 함께 깨진다.
  // LEAGUE_DAILY_CAST(v9.47)가 세운 관례를 그대로 따른다.
  ['const LEAGUE_ON', 'const WORLD_RAID_ON', 'const STORYBOOK_ON', 'const STORY_AI_ON'].forEach(c => {
    assert.ok(code.includes(c), `압축 스위치 상수 누락: ${c}`);
  });
  assert.ok(section('function leagueSettle_()', 'function leagueStoryDaily_()').includes('if (!LEAGUE_ON) return'),
    '리그 결산이 스위치를 안 본다');
  assert.ok(section('function worldRaidMonthly_()', 'function buildMonthlyCards_').includes('if (!WORLD_RAID_ON) return'),
    '월드레이드가 스위치를 안 본다');
  assert.ok(section('function buildMonthlyStorybook_()', 'function orphanVsClean_').includes('if (!STORYBOOK_ON) return'),
    '스토리북이 스위치를 안 본다');
  // 호출부(배치 배선)는 살아 있어야 한다 — 되살리기가 상수 한 줄이 되는 조건
  const night = section('function nightJobs()', 'function dailyBackupJob()');
  assert.ok(night.includes("safeRun('leagueSettle', leagueSettle_)"), '리그 결산 배선이 지워졌다(되살리기가 한 줄이 아니게 된다)');
  const mj = section('function monthlyJobs()', 'function runExecReportNow');
  assert.ok(mj.includes("safeRun('buildMonthlyStorybook', buildMonthlyStorybook_)"), '스토리북 배선이 지워졌다');
});

test('[v9.147] 리그 시즌 오프는 빈 대진표를 남기지 않는다(끈 것과 고장난 것은 화면에서 구별되지 않는다)', () => {
  const rm = section('function raidMonday()', '// [v9.1] 반 대항 리그 정산');
  assert.ok(rm.includes('if (!LEAGUE_ON)'), '리그 매칭 생성이 스위치를 안 본다 — 매주 빈 대진표가 쌓인다');
  // 레이드 생성은 그 앞에 있어야 한다(레이드는 유지 대상 — 유호 "레이드 유지")
  assert.ok(rm.indexOf('rd.getRange(rd.getLastRow() + 1, 1, rows.length, 6).setValues(rows)') < rm.indexOf('if (!LEAGUE_ON)'),
    '리그 게이트가 레이드 생성보다 앞에 있다 — 레이드까지 함께 죽는다');
});

test('[v9.147] 웰컴·미래편지는 AI만 끄고 기능은 산다(학부모 메일 채널을 폐지하지 않는다)', () => {
  // 개원일엔 전원이 신규라 웰컴이 학부모 첫 접점이다. 연출로 분류해 통째로 끄면 학원비를 내는 쪽의 첫인상이 사라진다.
  const w = section('function welcomeStoryBatch_()', 'function aiMonthlyTitles_');
  assert.ok(w.includes('if (apiKey && STORY_AI_ON)'), '웰컴 스토리가 AI 게이트를 안 탄다');
  assert.ok(w.includes('if (!story) story ='), '템플릿 폴백이 사라졌다 — AI를 끄면 편지가 안 나간다');
  assert.ok(w.includes('MailApp.sendEmail(s.pEmail'), '웰컴 메일 발송이 사라졌다');
  const f = section('function futureLetterBatch_()', 'const HL_TPL');
  assert.ok(f.includes('if (apiKey && STORY_AI_ON)'), '미래편지가 AI 게이트를 안 탄다');
  assert.ok(f.includes('if (!letter) letter ='), '미래편지 템플릿 폴백이 사라졌다');
});

test('[v9.147] 데일리 훅과 학부모 카드는 압축 대상이 아니다(수집의 분모를 지킨다)', () => {
  // 초안은 운세(BE)·몬스터한마디(BF)를 끄려 했다. BE는 student_errors 기반 AI 개인화 슬롯이고
  // BF는 진화 임박 넛지 통로였다 — 끄면 학생이 폼 입구까지 오지 않는다. 학업추세(BW)는 학부모 카드다.
  const off = section('const CARD_OFF = {', '\n');
  ['기록실', '플레이스타일', '시냅스케미', '매치업프리뷰'].forEach(k => {
    assert.ok(off.includes(k), `CARD_OFF에 ${k} 누락`);
  });
  const off코드 = 코드만(off); // 루프 밖에서 한 번만 정제한다
  ['운세', '몬스터한마디', '학업추세', '나의여정', '오늘의알림'].forEach(k => {
    assert.equal(off코드.includes(k), false, `${k}는 유지 대상인데 CARD_OFF에 들어갔다 — 데일리 훅/학부모 카드를 끄면 수집의 분모가 마른다`);
  });
  // 적용된 결과 검사 — 상수만 있고 카드 생성부가 안 보면 아무 일도 안 일어난다
  assert.ok(code.includes('CARD_OFF.기록실 ? [\'\'] :'), '기록실 카드가 스위치를 안 본다');
  assert.ok(code.includes('CARD_OFF.플레이스타일 ?'), '플레이스타일 카드가 스위치를 안 본다');
  assert.ok(code.includes('CARD_OFF.시냅스케미 ?'), '시냅스케미 카드가 스위치를 안 본다');
  assert.ok(code.includes('CARD_OFF.매치업프리뷰 ?'), '매치업프리뷰 카드가 스위치를 안 본다');
  // 열 헤더는 그대로 — Glide 바인딩·조립가이드가 열 위치를 참조한다(열을 지우면 그 아래가 통째로 밀린다)
  ["'기록실HTML'", "'플레이스타일'", "'시냅스케미'", "'매치업프리뷰'"].forEach(h => {
    assert.ok(code.includes(h), `열 헤더 ${h}가 사라졌다 — 계산만 끄고 열은 보존해야 한다`);
  });
});

test('[v9.147] 재작성 복붙 게이트는 「그대로 베낀 것」만 막고 자기 말 재작성은 통과시킨다', () => {
  const { 재작성에코_, 재작성판정_ } = loadRewrite();
  const 교정 = '저는 어제 친구와 함께 도서관에 갔습니다.';
  // ① 그대로 복붙 — 차단(이것을 못 막으면 3단 데이터가 모델 출력의 복제물이 된다)
  assert.equal(재작성에코_(교정, 교정), true, '완전 복붙을 못 잡는다');
  // ② 띄어쓰기·문장부호만 바꾼 복붙 — 차단(정규화가 일하는지)
  assert.equal(재작성에코_('저는어제 친구와함께 도서관에 갔습니다', 교정), true, '띄어쓰기만 바꾼 복붙을 못 잡는다');
  // ③ 교정문을 통째로 품은 채 한마디 덧붙인 것 — 차단
  assert.equal(재작성에코_(교정 + ' 감사합니다.', 교정), true, '교정문 포함 + 덧붙임을 못 잡는다');
  // ④ 자기 말로 다시 쓴 것 — **통과**(정상 학습을 막으면 이 보상의 목적이 죽는다)
  assert.equal(재작성에코_('어제 저는 친구랑 도서관에서 한국어를 공부했어요.', 교정), false, '자기 말 재작성을 복붙으로 오판한다');
  // ⑤ 교정문이 없으면(첨삭 실패·구 행) 판정 불가 — 지급한다(「모름」을 불리하게 세지 않는다)
  assert.equal(재작성에코_('무언가 썼습니다', ''), false, '판정 불가를 에코로 몰아 무지급한다');

  // 판정 단계 — 상한·에코·지급 3분기가 실제로 갈리는가
  const prep = { corr: { 'FB1': 교정 }, recent: new Set(), grants: [], echo: 0 };
  assert.equal(재작성판정_(prep, 'S1', '어제 도서관에서 공부했어요', 'FB1'), '지급');
  assert.equal(prep.grants.length, 1, '지급 대상이 안 쌓인다');
  assert.equal(재작성판정_(prep, 'S1', '또 다른 문장이에요', 'FB1'), '상한', '같은 주에 두 번 지급된다');
  assert.equal(재작성판정_(prep, 'S2', 교정, 'FB1'), '에코', '복붙에 지급된다');
  assert.equal(prep.grants.length, 1, '에코·상한이 지급 목록을 오염시킨다');
  // 재작성이 아닌 일반 제출(reDo 없음)은 이 경로를 타지 않는다
  assert.equal(재작성판정_(prep, 'S3', '평범한 숙제 제출', ''), '', '일반 숙제 제출에 재작성 보상이 나간다');
});

test('[v9.147] 새 지급 경로는 PT 단일 소스·일일 한도·미인식 스캐너에 전부 등록돼 있다', () => {
  // v9.83의 인플레는 "단가가 10곳에 흩어져 총합을 볼 수 없던 것"이 원인이었다 — 새 경로도 같은 규약을 탄다.
  assert.ok(/재작성:\s*\d+/.test(code), 'PT에 재작성 단가가 없다');
  assert.ok(/퀴즈응답:\s*\d+/.test(code), 'PT에 퀴즈응답 단가가 없다');
  assert.ok(code.includes("[sid, PT.재작성, '재작성', '시스템']"), '재작성 지급이 PT를 안 쓴다(숫자 직기입 금지)');
  assert.ok(code.includes("[sid, PT.퀴즈응답, '퀴즈응답', '시스템']"), '퀴즈응답 지급이 PT를 안 쓴다');
  assert.ok(/const DAILY_LIMIT = \{[^}]*'퀴즈응답': 1/.test(code), 'DAILY_LIMIT에 퀴즈응답 누락 — 하루 여러 번 지급된다');
  assert.ok(/const DAILY_LIMIT = \{[^}]*'재작성': 1/.test(code), 'DAILY_LIMIT에 재작성 누락');
  const scan = section('function unknownReasonScan_(', 'function checkUnknownReasonsNightly_');
  assert.ok(scan.includes("'재작성'"), 'KNOWN_RS에 재작성 누락 — 매일 밤 미인식 사유 경보가 뜬다');
  // 지급은 적재 뒤 — 순서가 뒤집히면 "포인트는 받았는데 로그엔 없는" 행이 생긴다
  const qs = section('function quizSweep_(ss)', 'function 퀴즈응답포인트_');
  assert.ok(qs.indexOf('ql.getRange(ql.getLastRow() + 1') < qs.indexOf('퀴즈응답포인트_(ss, out, tz)'),
    '퀴즈 포인트 지급이 quiz_log 적재보다 앞선다');
});

test('[v9.147] 강사 정답 모음은 무작위 표본이고 주간 배치에 걸려 있으며 발행 첨삭을 소급 정정하지 않는다', () => {
  const g = sectionToEnd('function goldenSampleWeekly_()');
  // ① 무작위 — 순서대로 자르면(slice만) 시간순 표본이 되어 「AI가 맞았다」 라벨이 한쪽으로 굳는다
  assert.ok(g.includes('Math.random()'), '표본이 무작위가 아니다 — 강사 선택/시간순 표본은 반쪽 채점표를 만든다');
  assert.ok(g.includes('for (let i = pool.length - 1; i > 0; i--)'), 'Fisher-Yates 셔플이 없다');
  // ② 학생에게 실제로 나간 카드만 평가 대상('노출')
  //   [vNEXT] 표기 대신 판정 정본(노출카드_)을 타는지로 본다 — 옛 표기 검사는 방언이 갈린 것을 못 봤다(P1 #9136f31e61a9).
  assert.ok(g.includes('!노출카드_(r[8])'), '격리·오류·대기 카드까지 표본에 든다 — 학생이 안 본 교정을 평가하게 된다');
  // ③ 멱등 — 같은 fb_id를 다시 뽑지 않는다
  assert.ok(g.includes('already.has(id)'), '멱등 가드가 없다 — 매주 같은 카드가 다시 쌓인다');
  // ④ 쓰기 대상은 teacher_gold뿐 — hw_feedback을 건드리면 발행된 첨삭을 소급 정정하게 된다
  assert.equal(/fb\.getRange\([^)]*\)\.setValue/.test(코드만(g)), false, '강사 정답 모음이 hw_feedback을 쓴다 — 3단 데이터 정합이 깨진다');
  // ⑤ 배선·골격
  assert.ok(section('function weeklyJobs()', 'function monthlyJobs()').includes("safeRun('goldenSample', goldenSampleWeekly_)"),
    '강사 정답 모음이 어느 트리거에도 안 걸렸다(영원히 안 돎)');
  // [v9.241] 세 번째 칸(수집 표식) 허용 — 지키는 사실은 「골격에 있고 헤더 정본 상수를 쓴다」다.
  assert.ok(/\['teacher_gold', GOLD_HEADERS[,\]]/.test(section('function sheetSkeleton_()', 'function buildMonsterDetailCards')),
    '시트 골격에 teacher_gold 누락 — Glide가 테이블로 못 잡는다');
  assert.ok(code.includes("'강사판정'") && code.includes("'강사교정'"), '강사 정답 모음 헤더에 강사 응답 칸이 없다');
});

test('[v9.147] 커버리지 계기판은 참여율을 재고, 강사 정답 모음의 예상 실패 모드를 먼저 말한다', () => {
  const r = section('function dataCoverageReport(', 'function quizFormUrlOf_'); // 인자 목록은 앵커에 넣지 않는다(v9.166에서 opts가 붙어 한 번 죽었다)
  // 참여율 = 압축이 감량인지 출혈인지를 가르는 유일한 숫자. 총량만 보면 소수 열성 학생이 가린다.
  assert.ok(r.includes('참여율'), '참여율 섹션이 없다 — 압축의 부작용을 재는 계기가 없다');
  assert.ok(r.includes("최근카운트('hw_feedback'") && r.includes("최근카운트('quiz_log'") && r.includes("최근카운트('talk_log'"),
    '참여 분자가 세 입구를 다 안 본다');
  assert.ok(r.includes("r[3] === 'student'"), '참여율 분모가 학생 역할이 아니다');
  // 강사 정답 모음의 두 실패 모드를 리포트가 스스로 지목해야 한다(강사 무응답 · 「AI가 맞았다」 라벨 0)
  assert.ok(r.includes('강사 교정 정답 모음'), '강사 정답 모음 섹션이 없다');
  assert.ok(r.includes('유인이 0인 업무'), '강사 무응답이라는 예상 실패 모드를 리포트가 말하지 않는다');
  assert.ok(r.includes('반쪽 채점표'), '「AI가 맞았다」 라벨 0 경보가 없다');
});
