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
  const body = section('function bootstrapSynk()', 'function safeRun');
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
