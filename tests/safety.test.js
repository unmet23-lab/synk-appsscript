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
});

test('[v9.74] profiles 열 레지스트리 — 공유 블록이 선점 열(DA105 최애·DB~DD 교재연동 3열)과 겹치지 않는다', () => {
  // 리뷰 B1 재발 차단: 공유 블록을 확장할 때 이미 주인이 있는 열을 침범하면 첫 calcAll이 데이터를 파괴한다.
  const s1 = 85, len1 = code.match(/const SHARED_COL_HEADERS = \[([\s\S]*?)\];/)[1].split(',').filter(s => s.trim()).length;
  const s2 = Number(code.match(/const SHARED2_COL_START = (\d+)/)[1]);
  const len2 = code.match(/const SHARED2_COL_HEADERS = \[([\s\S]*?)\];/)[1].split(',').filter(s => s.trim()).length;
  const reserved = { 105: '최애(v9.50·A4, 학생 Set Column)', 106: '목소리폼URL(교재연동)', 107: '목소리성장카드(교재연동)', 108: '필살기노트(교재연동)' };
  Object.keys(reserved).forEach(cs => {
    const c = Number(cs);
    assert.ok(!(c >= s1 && c <= s1 + len1 - 1) && !(c >= s2 && c <= s2 + len2 - 1),
      '공유 블록이 선점 열 ' + c + '(' + reserved[cs] + ')을 침범 — 리뷰 B1 재발');
  });
  // 선점 주인들이 실제로 그 열을 쓰는지(레지스트리의 근거) — 코드가 바뀌면 이 목록도 갱신해야 한다
  assert.ok(code.includes("pf.getRange('DA1').getValue()) !== '최애'"), 'DA105 최애 보장 코드가 사라짐 — 레지스트리 갱신 필요');
  const tb = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
  ['DB1', 'DC1', 'DD1'].forEach(cell => assert.ok(tb.includes("getRange('" + cell + "')"), '교재연동.js ' + cell + ' 보장 코드가 사라짐 — 레지스트리 갱신 필요'));
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

/* ── [v9.63] 첨삭 무인 발행 + 품질 게이트 (유호 07-25 확정) ─────────────── */

test('[v9.63] 품질 게이트가 정상 카드는 통과시키고 불량 카드는 사유와 함께 거른다', () => {
  const gate = loadFunction('function fbQualityGate_(card, srcText)', 'function aiFeedbackBatch_()', 'fbQualityGate_', {});
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
  assert.ok(ack.includes("!== '노출'"), '첨삭 포인트 정산은 노출 행만 처리해야 한다');
  assert.ok(code.includes("/^(오류|격리)/.test(String(rG[8] || ''))"), '성장카드 짝 로더에 격리 제외 필터가 없다');
  assert.ok(code.includes('격리 카드는 오류사전 재료에서 제외'), '오류사전 로더에 격리 제외 필터가 없다');
  assert.ok(code.includes('격리 카드는 약점 재료에서 제외'), 'AI 약점 로더(aiWeakMap_)에 격리 제외 필터가 없다'); // v9.64 세션이 위탁 반영한 1줄의 회귀 고정
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

/* ── [v9.67] 감시 사각 3종 수리(2026-07-26 손타는 기능 진단 · 유호 승인) ─────────────── */

test('[v9.67] resetAllTriggers는 교재연동Nightly(23시)를 개통 시스템에 재설치한다(전체 삭제 실종 결함)', () => {
  const body = section('function resetAllTriggers(', 'const BIZ_BURN_DEFAULT');
  // 전체 삭제 루프 → 통합 10개 → 교재연동 조건 재설치 순서. 재설치가 빠지면 AI 문법판정·목소리·필살기 노트가 조용히 죽는다.
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

test('[v9.67] preflight·워치독·매니페스트가 교재연동Nightly 생존을 개통 조건부로 감시한다(미개통 오경보 0)', () => {
  const pre = section('function preflightGlide()', 'function safeRun(name, fn)');
  assert.ok(pre.includes("need['교재연동Nightly'] = 1"), 'preflight need 목록 편입 누락 — 실종을 조립 점검이 영영 모른다');
  assert.ok(pre.includes('textbookLinkOn_'), 'preflight 개통 발자국 조건 누락 — setupTextbookLink 미실행 시스템에 오경보');
  const wd = section('function systemWatchdog(', 'function buildSystemManifest()');
  assert.ok(wd.includes("recommended.push('교재연동Nightly')"), '워치독 권장 트리거 편입 누락 — 주간 메일 감시망 밖');
  const mf = section('function buildSystemManifest()', 'function checkConsultSync()');
  assert.ok(mf.includes('10 + (tbOnM ? 1 : 0)'), '매니페스트 기대치가 고정 10이면 정상 설치된 11개 상태를 ⚠로 오판한다');
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
  assert.ok(fbk.includes('if (sid && !stu) badSid.push(sid)'), '미등록 sid만 수집해야 한다(빈 ID·빈 문장은 폼 필수문항이라 제외)');
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
  assert.ok(!sm.includes('String(r[2])'), '원본 문자열화 잔재 — Date 오염 경로가 남는다');
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
  const sp = section('const SPEAK = {', 'const PARENT_Q');
  const m7 = sp.slice(sp.indexOf('miss7:'), sp.indexOf('evosoon:'));
  assert.ok((m7.match(/'/g) || []).length / 2 >= 12, 'miss7 톤당 4문장(계 12) 미만 — 장기 미출석 반복 체감 회귀');
  const evo = sp.slice(sp.indexOf('evosoon:'), sp.indexOf('crown:'));
  assert.ok((evo.match(/\{n\}/g) || []).length >= 6, 'evosoon 6문장 미만');
  const bd = sp.slice(sp.indexOf('bday:'), sp.indexOf('idle:'));
  assert.ok((bd.match(/'/g) || []).length / 2 >= 4, 'bday 4문장 미만');
});

test('[v9.74] 숙제 카드 — 라벨 있는 완성 카드(과제·선생님 체크·제출 안내), 과제 없으면 미노출', () => {
  const hw = loadFunction('function hwCardHtml_(', 'function quizCardHtml_(', 'hwCardHtml_', { escHtml_: (s) => String(s), CARD_FONT: '' });
  const html = hw('어휘', 'Үгийн сан', '오늘 단어 중 2개를 한 문장 안에 같이 넣어 보세요.', '의미 연결이 자연스러운지', 'Утгын холбоо');
  ['오늘의 숙제', '어휘', '오늘 단어 중 2개', '선생님이 이걸 봐요', '의미 연결이 자연스러운지', '숙제 제출'].forEach((k) =>
    assert.ok(html.includes(k), '숙제 카드에 누락: ' + k));
  assert.equal(hw('어휘', '', '', '', ''), ''); // 게시 전 콜드스타트 — 빈 껍데기 카드 대신 미노출
});

test('[v9.74] 퀴즈 카드 — 문제와 공개 안내만, 정답은 어떤 경로로도 카드에 담기지 않는다(언어정책)', () => {
  const quiz = loadFunction('function quizCardHtml_(', 'function prepCardHtml_(', 'quizCardHtml_', { escHtml_: (s) => String(s), CARD_FONT: '' });
  const html = quiz('감사합니다의 실제 발음은?', false);
  assert.ok(html.includes('오늘의 퀴즈') && html.includes('감사합니다의 실제 발음은?') && html.includes('정답 공개'));
  assert.ok(quiz('문제', true).includes('맞춤 문제'), '개인 퀴즈(ai_daily) 라벨 누락');
  assert.equal(quiz('', false), '');
  // 호출부가 문제(q[0]·pq.q)만 넘기는지 — 정답(q[1]·pq.a)이 카드로 새는 회귀 차단
  assert.ok(code.includes('quizCardHtml_(pq ? pq.q : q[0], !!pq)'), '퀴즈 카드 호출부는 문제만 넘겨야 한다');
  const fnQ = section('function quizCardHtml_(', 'function prepCardHtml_(');
  assert.ok(!fnQ.includes('quizAns'), '퀴즈 카드 빌더에 정답 인자가 생기면 언어정책(정답 평문 노출 금지) 위반');
});

test('[v9.74] 수업준비 카드 — 검사 포인트의 제자리는 강사 화면, 워밍업 퀴즈는 정답 동봉', () => {
  const prep = loadFunction('function prepCardHtml_(', 'function teacherInOutMap_(', 'prepCardHtml_', { escHtml_: (s) => String(s), CARD_FONT: '' });
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

test('[v9.74] 학부모 접점에서 몬스터 호칭 제거 — 성장 파트너(хамтрагч), 학생 세계관은 유지', () => {
  assert.ok(code.includes('도장이 쌓일수록 성장 파트너가 자라요'), '출석달력 캡션 교체 누락');
  assert.ok(!code.includes('도장이 채워질수록 몬스터가 자라요'), '구 캡션 잔존');
  assert.ok(code.includes('학생의 성장 파트너가 진화했어요') && !code.includes('학생의 몬스터가 진화했어요'), '진화 학부모 메일 교체 누락');
  assert.ok(!code.includes('-ийн монстр'), '학부모 몽골어 배너·하이라이트에 монстр 잔존'); // 학생용(운세 "дараагийн монстр"·onboarding "таны монстр")은 세계관 유지로 남는다
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

test('[v9.71] 메신저 연결 스위프가 상담로그 실제 열 순서(시각·세션·발신·내용)와 맞는다', () => {
  // 상담AI.js가 쓰는 헤더와 만족도팩이 읽는 인덱스가 어긋나면 연결 요청이 영원히 접수되지 않는다(양쪽 파일 교차 계약).
  const ai = fs.readFileSync(path.join(ROOT, '상담AI.js'), 'utf8');
  const head = ai.match(/const 상담AI_로그헤더 = \[([^\]]+)\]/);
  assert.ok(head, '상담AI_로그헤더 선언을 찾지 못함');
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
  assert.ok(!code.includes('const count = pfData.filter(r => r[0]).length'), '구 전체 행 수 count가 살아 있다');
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
  const deps = { escHtml_: esc, CARD_FONT: "font-family:test;" };
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
  const deps = { escHtml_: esc, CARD_FONT: "font-family:test;" };
  const load = (name) => loadFunction('function buildRaidCard_', '\n// [v9.14] 📊 월간 경영 리포트', name, deps);
  const brief = load('buildBriefHud_'), rows = load('hudBriefRows_');
  // ① AI 브리핑 이스케이프(유일 XSS 잔여면이라는 리뷰 지적) + 미션 0건일 때 "특이사항 없음"과 동시 출력 모순 억제
  const aiOnly = brief('반', { ai: '<script>x</script>' });
  assert.ok(aiOnly.includes('&lt;script&gt;'), 'AI 브리핑이 이스케이프 없이 침투한다');
  assert.ok(!aiOnly.includes('특이사항 없음'), 'AI 브리핑과 "특이사항 없음"이 동시 출력된다(모순)');
  // ② absent 캡 5(구 slice(0,5) 하위호환)
  const ab = rows({ absent: ['a','b','c','d','e','f','g'] });
  assert.ok(ab[0][1].includes('외 2명'), '어제 결석 캡(5명+외 n)이 없다');
  // ③ 10열 격파찬스 = 라이브 소스(goal−weekDmg) — 죽은 raidLeft 스냅샷(금·일만 갱신) 회귀 금지
  const wiring = section('crewCols = Object.keys(cls).sort().map', 'writeIfChanged(cs, 2, 9, crewCols)');
  assert.ok(wiring.includes('(raidGoal[c] || 0) - (weekDmg[c] || 0)'), '10열이 라이브 소스가 아니다');
  assert.ok(!wiring.includes('raidLeft[c]'), '10열이 죽은 raidLeft 스냅샷(월~목 발동 불가)을 다시 쓴다');
  // ④ hudDetailRows가 crewCols와 같은 map 안에서 push — 행 순서·개수 원자 동기
  assert.ok(wiring.includes('hudDetailRows.push('), '14열 행 생성이 9열 map 밖으로 이탈했다(반 순서 어긋남 위험)');
  // ⑤ 강사가 실행 불가한 안내 금지 — '해결' 표기는 시트 접근자만 가능
  assert.ok(!code.includes("'해결'로 바꾸면 다음 브리핑부터"), '강사가 수행할 수 없는 풋노트 안내가 남아 있다');
});
