const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CODE_PATH = path.join(ROOT, 'Code.js');
const MANIFEST_PATH = path.join(ROOT, 'appsscript.json');
const code = fs.readFileSync(CODE_PATH, 'utf8');

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

function loadFunction(startMarker, endMarker, functionName, dependencies) {
  const source = section(startMarker, endMarker);
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  return new Function(...names, `${source}\nreturn ${functionName};`)(...values);
}

test('Code.js 구문이 정상이다', () => {
  execFileSync(process.execPath, ['--check', CODE_PATH], { stdio: 'pipe' });
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
  assert.equal(/^function\s+do(?:Get|Post)\s*\(/m.test(code), false);
});

test('재건용 핵심 시트 제목이 실제 읽기·쓰기 순서와 일치한다', () => {
  // [v9.37] skeleton 배열이 모듈 const SHEET_SKELETON으로 승격됨 — 시작 표식을 그 선언부로 이동(의도 동일: 골격 헤더 정합)
  const body = section('const SHEET_SKELETON', 'function safeRun');
  assert.ok(body.includes(
    "['profiles', ['user_id','이름','이름_몽골','role','class_name','생일','email','연락처','messenger_link','parent_of','tuition','등록일','보호자명','보호자연락처','created_at']]"
  ));
  assert.ok(body.includes("['teacher_checkins', ['이름','구분','시각']]"));
});

test('재건 결과는 일부 단계가 실패하면 완료라고 표시하지 않는다', () => {
  const body = section('function bootstrapSynk()', 'function safeRun');
  assert.ok(body.includes("const rebuildFailed = log.some(line => line.indexOf('✗') === 0)"));
  assert.ok(body.includes("rebuildFailed ? 'SYNK OS 재건 일부 실패' : 'SYNK OS 재건 완료'"));
  assert.equal(body.includes("['기준 테이블', setupTables]"), false);
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
  assert.equal(/, 7\)\.(getValues|setValues|clearContent)/.test(body), false);
});

test('성장 리포트 메일은 공개 URL 링크 대신 PNG를 첨부로 보낸다', () => {
  const body = section('function runReportCards_()', 'function exportSlidePng');
  assert.ok(body.includes('blob: blob.copyBlob()'));
  assert.ok(body.includes('{ attachments: [m.blob] }'));
  // 공개 URL(m.url)을 메일 본문에 실으면 미성년 실명·성적이 전달·캡처로 샌다
  assert.equal(body.includes("'리포트 카드 보기: ' + m.url"), false);
});

test.todo('숙제 일괄 지급을 별도 처리로그와 전용 잠금으로 원자화');
test.todo('숙제 포인트와 자동 정정을 같은 야간 계산에 즉시 반영');
test.todo('성장 리포트의 공개 링크를 비공개 전달 방식으로 교체');
test.todo('실제 포인트 사유·점수 목록 확인 후 허용 규칙 적용');
test.todo('레이드·월간 정산의 중간 실패 복구 구조 추가');

test('[v9.40] preflightGlide는 콘텐츠 부족분을 자동 복구하고 진단은 그 뒤에 한다', () => {
  const body = section('function preflightGlide()', 'function safeRun');
  assertOrder(body, [
    'SHEET_SKELETON.forEach',          // ① 시트 골격(월간 산출물 포함) 먼저
    'contentSetupOf_(tp)',             // ② 부족 유형 자동 설치
    'injectMongolianContents()',       // ③ 큐레이션 몽골어 재주입
    'calcAll()',                       // ④ 계산(콜드스타트 시딩 포함)
    '자동 복구 후에도 불일치'            // ⑤ 복구 후 재실측 진단(경고 문구)
  ]);
  // 파괴 호출 금지 — setupSchedule은 라이브 15반 커스텀을 리셋한다
  assert.equal(/setupSchedule\(\)/.test(body), false);
});

test('[v9.40] 시트 골격에 월간 산출 5종이 있어 Glide가 조립 시점에 테이블로 잡을 수 있다', () => {
  const body = section('const SHEET_SKELETON', 'function bootstrapSynk()');
  ['synk_stories', 'synk_cards', 'world_raid', 'league_pairs', 'academic_log'].forEach((name) => {
    assert.ok(body.includes(`['${name}',`), `SHEET_SKELETON에 ${name} 누락`);
  });
  // teacher_stats 구 3열 스키마가 되살아나면 calcTeacherStats 실사용 8열과 다시 어긋난다
  assert.equal(body.includes("['teacher','지급수','편중률']"), false);
});

test('[v9.40] 공지 헬퍼는 라이브 구 스키마(title_ko/body_ko)를 인식한다', () => {
  const noticeBody = section('function addNotice(', 'function replaceContentType');
  assert.ok(noticeBody.includes("'title_ko'"));
  assert.ok(noticeBody.includes("'body_ko'"));
  const trBody = section('function translateNotices_(', 'function langColOf_');
  assert.ok(trBody.includes("'title_ko'"));
  // 리그·월드 정산이 notices 1~3열에 직접 쓰면 구 스키마에서 열이 어긋난다 — addNotice 경유 강제
  const settle = section('function leagueSettle_()', 'function leagueStoryDaily_()');
  assert.equal(settle.includes("ensureSheet(ss, 'notices'"), false);
  assert.ok(settle.includes('addNotice(ss, nr[0], nr[1])'));
});

test('[v9.40] calcAll은 숙제·퀴즈·팁 키가 없으면 게이트를 기다리지 않고 즉시 게시한다', () => {
  const body = section('function calcAll()', 'function syncProfiles()');
  assert.ok(body.includes("getState(st, '오늘의퀴즈').row < 1 || getState(st, '오늘의팁').row < 1"));
  assert.ok(body.includes("getState(st, pair[0] + '숙제').row > 0"));
});

test('[v9.47] 리그 일일 중계는 상수로 꺼져 있고 일요일 결산 경로는 그대로다', () => {
  assert.ok(code.includes('const LEAGUE_DAILY_CAST = false'));
  const daily = section('function leagueStoryDaily_()', 'function weeklyFuel_');
  assert.ok(daily.includes('if (!LEAGUE_DAILY_CAST) return'));
  const night = section('function nightJobs()', 'function dailyBackupJob()');
  assert.ok(night.includes("safeRun('leagueSettle', leagueSettle_)")); // 결산(일요일)은 게이트 무관 유지
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
  assert.ok(!sb.includes('rows.length, 8).setValues(rows)'), '구 13행 분할 발간 코드가 남아 있음');
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

test('[v9.47] 칭찬(+3P)은 일일 한도에 있고 다이제스트 크루의 눈이 칭찬 태그를 수집한다', () => {
  assert.ok(code.includes("'칭찬': 1"));
  const dig = section('function parentWeeklyDigestCore_', 'function restoreDrill');
  assert.ok(dig.includes("rs.indexOf('칭찬') > -1"));
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
  assert.ok(fn.includes('writeIfChanged(pf, 2, SHARED_COL_START, out)')); // 무변경 시 쓰기 0(쿼터 보호)
  // 헤더 20개가 열 지도와 일치해야 조립 문서의 CG~CZ 안내가 유효 ([v9.49] 폼URL 2종+새첨삭수 추가로 17→20)
  assert.ok(code.includes("const SHARED_COL_START = 85"));
  const heads = code.match(/const SHARED_COL_HEADERS = \[([\s\S]*?)\];/);
  assert.ok(heads, 'SHARED_COL_HEADERS 선언을 찾지 못함');
  assert.equal(heads[1].split(',').filter(s => s.trim()).length, 20);
});

test('[v9.49] hw_feedback 골격 — 학생확인(Glide 전용)과 포인트지급(스크립트 전용) 열이 분리돼 있다', () => {
  const body = section('const SHEET_SKELETON', 'function bootstrapSynk()');
  assert.ok(body.includes("['hw_feedback', ['id','student_id','제출일','제출문','고친문장','오늘의포인트','칭찬','다음미션','상태','학생확인','포인트지급']]"));
});

test('[v9.49] 첨삭 확인 정산은 지급(appendPoints) 성공 뒤에만 지급완료로 표시한다', () => {
  const body = section('function sweepFeedbackAck_(', 'function aiFeedbackBatch_()');
  assertOrder(body, [
    'const doneToday = new Set()',            // point_logs 재조회(크래시 재시도 중복 방지)
    "appendPoints(ss, [[sid, AI_FEEDBACK_ACK_POINTS, '첨삭확인', '시스템']])", // 행 단위 지급 먼저(리뷰 M2)
    "fb.getRange(i + 2, 11).setValue('지급완료')" // 마킹은 그 뒤
  ]);
  assert.ok(body.includes("String(r[8]) !== '노출'")); // 검수 게이트: 노출 상태만 지급
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
  assert.ok(body.includes("props.setProperty('숙제폼_포인터', String(from + processed))"));
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
  assert.equal(code.includes("'숙제첨삭확인'"), false);
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
