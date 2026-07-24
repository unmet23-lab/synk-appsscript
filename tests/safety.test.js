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

test('[v9.47·v9.51] 칭찬(+3P)은 일일 한도에 있고 태그는 사유 접미로 흐른다(태그 열 폐기)', () => {
  assert.ok(code.includes("'칭찬': 1"));
  const dig = section('function parentWeeklyDigestCore_', 'function restoreDrill');
  assert.ok(dig.includes("rs.indexOf('칭찬·') === 0")); // 크루의 눈 태그 = reason 접미('칭찬·집중력')
  assert.equal(dig.includes('/* [v9.0] H 태그 */'), false); // 구 8열(라이브=🔒 Row ID) 읽기가 되살아나면 Row ID가 태그로 샌다
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

// ───────────────────────── v9.54 최종 점검 팩 회귀 장치 ─────────────────────────

test('[v9.54] setupStore는 전체 열 보존 경로(replaceContentType)로만 contents를 만진다', () => {
  const body = section('function setupStore()', 'function healthCheck()');
  assert.ok(body.includes("replaceContentType(ss, 'store'"), 'setupStore는 replaceContentType에 위임해야 한다');
  // 구 6열 clear/압축 패턴이 되살아나면 몽골어(G)·영어(H)·Glide Row ID가 생존 행에서 오정렬된다
  assert.equal(/clearContent\(\)/.test(body), false, 'setupStore 안에 직접 clearContent가 있으면 안 된다');
  assert.equal(body.includes('getRange(2, 1, last - 1, 6)'), false, '6열 고정 접근 금지');
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

test('[v9.54] 진화 배너 내레이터는 실제 단계명(mon.stage)을 쓴다 — 범위 밖 r[18] 금지', () => {
  const idx = code.indexOf('NARRATE_EVO, id + todayYmd0');
  assert.notEqual(idx, -1, '진화 배너 내레이터 호출부를 찾지 못함');
  const seg = code.slice(idx, idx + 400);
  assert.ok(seg.includes('mon.stage'), '{m} 슬롯은 mon.stage여야 한다');
  // pfData는 15열(인덱스 0~14)만 읽는다 — r[18]은 상시 undefined라 항상 "몬스터"로 나오던 v9.50·B1 결함
  assert.equal(seg.includes('r[18]'), false);
});

test('[v9.54] aiText_는 사고 OFF로 짧은 예산 전액을 본문에 쓴다(폴백률 급증 방지)', () => {
  const body = section('function aiText_(', 'function aiStudents_(');
  assert.ok(body.includes("thinking: { type: 'disabled' }"),
    'Sonnet 5는 thinking 생략 시 적응형 사고가 기본 ON — 사고 토큰이 900~1536 예산을 잠식한다');
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
  assert.equal((body.match(/aiWeakMap_\(ss\)/g) || []).length, 1, 'aiWeakMap_ 전량 read는 메모이즈 안에서 1회만');
});

test('[v9.54] 미등원 판정은 attendance 부재 시 열리지 않는다(전원 미등원 오경보 방지)', () => {
  const body = section('function checkNoShow()', 'function checkEvolution');
  assertOrder(body, ["ss.getSheetByName('attendance')", 'if (!at) return;', 'at.getLastRow()']);
});

test('[v9.60] 레벨테스트 폼 생성은 재실행 안전 — 이미 있으면 새 폼을 만들지 않는다', () => {
  const body = section('function createLevelTestForm()', 'function cleanupOrphanFormSheets()');
  // 2026-07-24 실사고: 두 번째 실행이 시트 이름 충돌로 죽으면서 중복 폼 + 잔재 응답 시트를 남겼다.
  // 조기 반환(있으면 만들지 않음)이 FormApp.create보다 반드시 앞에 와야 한다.
  assertOrder(body, ["ss.getSheetByName('레벨테스트_응답')", 'return msgX;', 'FormApp.create(']);
  assert.ok(body.includes('shX.getFormUrl()'), 'URL 기록이 없을 때 시트에 연결된 폼에서 회수해야 재생성을 피한다');
});

test('[v9.60] 잔재 청소는 자동생성 이름 + 빈 시트만 지운다(데이터 보호)', () => {
  const body = section('function cleanupOrphanFormSheets()', 'function sweepLevelTest_()');
  assert.ok(body.includes('설문지 응답 시트'), '자동 생성 이름만 대상');
  assert.ok(body.includes('getLastRow() >= 2'), '응답이 있으면 보존해야 한다');
  assert.ok(body.includes('deleteSheet'), '삭제 경로 존재');
  // 이름 붙은 정본 시트를 지우는 경로가 생기면 안 된다
  assert.equal(/deleteSheet\(ss\.getSheetByName/.test(body), false);
});

test('[v9.54] 루트의 모든 엔진 .js가 .claspignore 허용목록에 있다(반쪽 배포 방지)', () => {
  // 상담AI.js가 허용목록에 빠져 매니페스트·contents만 라이브로 가던 실사고(2026-07-24)의 회귀 장치.
  // 새 엔진 파일을 루트에 만들면 이 테스트가 배포 게이트에서 누락을 잡는다.
  const ig = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8');
  const allows = ig.split(/\r?\n/).filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim());
  const rootJs = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js'));
  assert.ok(rootJs.length >= 1, '루트 .js 목록을 읽지 못함');
  for (const f of rootJs) {
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
  assert.equal(code.includes("'월 시즌 · '"), false, '구 표기 부활 금지 — "시즌"은 커리큘럼 8주 트랙 전용(유호 07-24)');
  assert.ok(code.includes('+ season + "\' 무대"'), '리그 결과 공지도 무대 표기');
});

test('[v9.56] 시즌 패스 트랙 — 입력 셀 정본·형식 검증·미설정 시 통째 생략', () => {
  const calc = section('function calcAll()', 'function writeSharedCols_');
  assert.ok(calc.includes("'시즌트랙입력'"), 'app_state 입력 셀이 정본');
  assert.ok(calc.includes('/^\\d{4}-\\d{2}-\\d{2}$/'), '시작일 형식 검증 없이 파싱하면 깨진 날짜로 주차가 NaN');
  assert.ok(calc.includes('seasonT: seasonCfg ?'), '여정 카드 주입은 설정 있을 때만(null이면 카드에서 생략)');
  const journey = section('function myJourneyHtml_(', 'function calcAll()');
  assert.ok(journey.includes("let seasonB = '', wrapB = '';"), '미설정 폴백(빈 문자열) 고정');
  assert.ok(journey.includes('🎫 시즌'), '트랙 블록 렌더');
  assert.ok(journey.includes('나의 기록'), '8주차 랩업(공유 카드) 렌더');
});

test('[v9.56] 추천 현황 — leads 추천인 집계가 여정 카드 한 줄로 흐른다(0명이면 비표시)', () => {
  const calc = section('function calcAll()', 'function writeSharedCols_');
  assert.ok(calc.includes('refCntByName'), 'leads 추천인(E열) 집계');
  const journey = section('function myJourneyHtml_(', 'function calcAll()');
  assert.ok(journey.includes("(o.refN || 0) > 0 ?"), '0명일 땐 줄 자체가 생략돼야 한다');
});

test('[v9.56] 교실 스크린 — 10분 보드에 편승하되 실패 격리·분 단위 시계 금지(업데이트 예산 보호)', () => {
  const body = section('function todayBoard_(', 'function expandHwBatch()');
  assert.ok(body.includes("setAppState_(ss, '교실스크린HTML'"), '스크린 HTML은 app_state 한 키');
  assert.ok(body.includes('catch (eScr)'), '스크린 실패가 출결 보드를 깨면 안 된다');
  const scrSeg = body.slice(body.indexOf('교실 스크린 모드'));
  assert.equal(/formatDate\(now,\s*tz,\s*'HH:mm'\)/.test(scrSeg), false,
    '분 단위 시계를 넣으면 내용이 매 스위프 바뀌어 야간·주말에도 sync가 깨어난다');
});

test('[v9.56] 이달의 카드 인쇄 — 최신 발간월만 모아 Drive 저장·PDF 실패 시 HTML 폴백 안내', () => {
  const body = section('function printMonthlyCards()', '// [v9.12] 🗺️ 시냅스 여행 지도');
  assert.ok(body.includes("getSheetByName('synk_cards')"));
  assert.ok(body.includes("'SYNK_인쇄'"), '고정 폴더 — 파일이 드라이브 루트에 흩어지지 않게');
  assert.ok(body.includes("getAs('application/pdf')"));
  assert.ok(body.includes('Ctrl+P'), 'PDF 변환 실패 폴백 안내(비개발자 절차)');
});

test('[v9.56] 첨삭 통보 메일에 검수 바로가기(#gid)가 붙는다 — 검수함 조립 전 다리', () => {
  const body = section('function aiFeedbackBatch_(', 'function callClaudeFeedback_');
  assert.ok(body.includes("'#gid=' + (ss.getSheetByName('hw_feedback')"));
  assert.ok(body.includes('!AI_FEEDBACK_AUTOPUBLISH ?'), '자동공개로 전환하면 링크 줄은 자동 소멸');
});

test('[v9.57] 톱레벨 크로스파일 참조 금지 — 전역 초기화 순서 크래시(상담AI.gs:27 실사고) 기계 차단', () => {
  // Apps Script는 파일 순서대로 전역을 초기화한다. 어떤 파일의 톱레벨 코드가 다른 파일의 전역을 읽으면
  // 순서에 따라 ReferenceError로 "프로젝트 전체"(모든 트리거·실행)가 즉사한다 — 07-24 라이브 실사고.
  const rootJs = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js'));
  const topLevel = {}, declared = {};
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
    topLevel[f] = out;
    declared[f] = new Set([...out.matchAll(/(?:^|[\s;])(?:const|let|var|function)\s+([A-Za-z_$가-힣][\w$가-힣]*)/g)].map((m) => m[1]));
  }
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
});

test('[v9.61] preflight는 학생 입력 폼 3종 미생성을 경고한다(버튼이 조용히 안 그려지는 결함)', () => {
  // 2026-07-24 실측: 출석폼URL틀·숙제폼URL틀이 없어 CX102·CY103이 공란 → Glide Open-link 버튼 전원 미렌더.
  // 컴포넌트는 존재해 눈으로 하는 조립 점검을 통과했다 → 기계 경고로 이관.
  const body = section('function preflightGlide()', 'function safeRun(name, fn)');
  ['출석폼URL틀', '숙제폼URL틀', '약점메모폼URL'].forEach((k) => {
    assert.ok(body.includes(`'${k}'`), `preflight가 ${k} 부재를 감시해야 한다`);
  });
  ['createAttendanceForm', 'createHwForm', 'createTeacherMemoForm'].forEach((fn) => {
    assert.ok(body.includes(fn), `경고문이 처방(${fn} 실행)을 담아야 한다`);
  });
});
