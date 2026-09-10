const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 실제 월간 함수만 VM에 적재한다. 모든 GAS I/O는 메모리 mock이며 외부 실행/학생 원문은 없다.
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'Code.js'), 'utf8');
const form = fs.readFileSync(path.join(root, '엔진_폼리포트.js'), 'utf8');
function slice(source, from, to) {
  const a = source.indexOf(from), b = source.indexOf(to, a + from.length);
  assert.ok(a >= 0 && b > a, '실제 함수 구간을 읽어야 한다');
  return source.slice(a, b);
}
const source = slice(code, 'function buildExecReport_()', '// [v9.42] 🗂️') + '\n' +
  slice(form, 'function reportCardsContinue()', 'function exportSlidePng(');
const headers = ['card_id', 'student_id', '월', 'image_url', '칭호', '코멘트', 'created_at',
  'delivery_status', 'delivery_updated_at', 'delivery_reason', 'delivery_body', 'delivery_subject'];
function profile(id, email = id.toLowerCase() + '@example.invalid') {
  const r = Array(81).fill('');
  r[0] = id; r[1] = '합성 ' + id; r[3] = 'student'; r[4] = 'A'; r[25] = email;
  return r;
}
function card(id, state = 'pending', month = '2026-09') {
  return [month + '-' + id, id, month, 'https://lh3.googleusercontent.com/d/FILE_________' + id,
    '', '', '2026-09-01', state, '', '', '원래 본문 ' + id, '원래 제목 ' + id];
}
function harness(options = {}) {
  const cfg = { now: '2026-09-01T01:00:00Z', quota: 99, mailThrow: null, failSent: false, ...options };
  const calls = { mail: [], create: [], reads: [], alerts: [], logs: [], renders: 0, sharing: 0, sanitized: 0, duplicates: 0, fills: 0 };
  const lock = { held: false, tryLock() { if (this.held || cfg.busy) return false; this.held = true; return true; },
    releaseLock() { this.held = false; } };
  function sheet(name, data) {
    const sh = { name, data: data.map(r => r.slice()), maxCols: Math.max(26, ...data.map(r => r.length)),
      getLastRow() { return this.data.length; }, getLastColumn() { return Math.max(0, ...this.data.map(r => r.length)); },
      getMaxColumns() { return this.maxCols; }, insertColumnsAfter(n, extra) { this.maxCols += extra; },
      getRange(row, col, nr = 1, nc = 1) {
        calls.reads.push({ name, row, col, nr, nc });
        return {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sh.data[row - 1 + i]?.[col - 1 + j] ?? '')),
          getValue: () => sh.data[row - 1]?.[col - 1] ?? '',
          setValue(v) { return this.setValues([[v]]); },
          setValues(values) {
            const sent = values.some(r => r.some(v => v === 'sent' || typeof v === 'string' && v.includes('"status":"sent"')));
            if (cfg.failSent && sent) { cfg.failSent = false; throw new Error('synthetic sent persistence failure'); }
            values.forEach((r, i) => { while (sh.data.length < row + i) sh.data.push([]);
              r.forEach((v, j) => { sh.data[row - 1 + i][col - 1 + j] = v; }); });
            return this;
          }
        };
      }
    }; return sh;
  }
  const sheets = {
    profiles: sheet('profiles', [Array(81).fill('header'), ...(cfg.profiles || [profile('S1'), profile('S2')])]),
    app_state: sheet('app_state', [['key', 'value'], ...(cfg.states || [])]),
    report_cards: sheet('report_cards', [headers, ...(cfg.cards || [])])
  };
  const ss = { getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar', getSheetByName: n => sheets[n] || null };
  const iter = a => { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; };
  const files = new Map();
  const blob = name => ({ name, getContentType: () => cfg.badBlob ? 'text/html' : 'image/png',
    getBytes: () => cfg.emptyBlob ? [] : [1, 2, 3], setName(n) { this.name = n; return this; }, copyBlob() { return this; } });
  function file(id, name) { return { getId: () => id, getName: () => name, getBlob: () => {
    if (cfg.blobFail) throw new Error('synthetic file unavailable'); return blob(name);
  }, setSharing: () => { calls.sharing++; } }; }
  (cfg.cards || []).forEach(r => { const id = r[3].split('/').pop(); files.set(id, file(id,
    r[7] ? 'SYNK_card_' + r[0] + '.png' : r[2] + '_' + r[1] + '_합성이름.png')); });
  const folder = { getFilesByName: name => iter([...files.values()].filter(f => f.getName() === name)),
    createFile(b) { const id = 'FILE_________' + (calls.create.length + 1); const f = file(id, b.name);
      calls.create.push(id); files.set(id, f); return f; } };
  const slides = [], triggers = [], properties = new Map();
  const context = {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [cfg.now])); } static now() { return new Date(cfg.now).getTime() + (cfg.elapsed || 0); } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => lock },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger(t) { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger(handler) { const t = { handler, delay: 0, getHandlerFunction: () => handler }; return {
        timeBased() { return this; }, after(delay) { t.delay = delay; return this; }, create() { triggers.push(t); return t; }
      }; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => properties.get(k), setProperty: (k, v) => properties.set(k, v) }) },
    Utilities: { formatDate: (d, tz, pattern) => d.toISOString().slice(0, pattern === 'yyyy-MM' ? 7 : 10), sleep() {} },
    MailApp: { sendEmail(to, subject, body, opts) { calls.mail.push({ to, subject, body, opts }); cfg.quota--;
      if (cfg.mailThrow === to) throw new Error('synthetic ambiguous response'); } },
    DriveApp: { getFoldersByName: () => iter([folder]), createFolder: () => folder,
      getFileById(id) { if (!files.has(id)) throw new Error('synthetic missing file'); return files.get(id); } },
    SlidesApp: { openById: () => ({ getSlides: () => slides.slice(), saveAndClose() {} }) },
    Logger: { log: value => calls.logs.push(String(value)) },
    ensureSheet(_ss, name, h) { return sheets[name] || (sheets[name] = sheet(name, [h])); },
    getState(sh, key) { const row = sh.data.findIndex(r => r[0] === key); return { row: row + 1, val: row < 0 ? '' : sh.data[row][1] }; },
    quotaOk: () => cfg.quota > 0,
    adminMail(subject, body) { assert.equal(lock.held, false, 'adminMail 자체 잠금 전에 해제해야 한다'); calls.alerts.push({ subject, body }); },
    automationOwnerAllowed_: () => cfg.owner !== false,
    ymTextOf_: v => String(v).slice(0, 7), ymTextColFix_() {},
    ymShift_: (s, n) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7),
    readPointLogs_: () => [], calcTeacherStats: () => [], toDate_: v => v ? new Date(v) : null,
    CARD_WEBFONT: '', CARD_FONT: '', TEACHER_UNASSIGNED: '(미지정)', ADMIN_EMAIL: 'ops@example.invalid', escHtml_: v => v,
    행소독_: rows => { calls.sanitized++; return rows; }, // 소독 채널 본체의 수식 검증은 safety.test가 담당한다.
    REPORT_TEMPLATE_ID: cfg.template === false ? '' : 'synthetic-template', REPORT_FOLDER_NAME: 'synthetic-folder',
    MAX_CARDS_PER_RUN: cfg.maxCards || 2, SEND_REPORT_EMAIL: true,
    readAcademicLogs_: () => ({}), monsterImgMap_: () => ({}),
    reportTemplateSlide_: () => ({ duplicate() { calls.duplicates++; cfg.elapsed = (cfg.elapsed || 0) + (cfg.duplicateMs || 0);
      const id = 'slide-' + (slides.length + 1); const s = {
      getObjectId: () => id, remove() { slides.splice(slides.indexOf(s), 1); } }; slides.push(s); return s; } }),
    reportCardData_: r => ({ sid: r[0], name: r[1], pointsText: '10P', attendText: '2회', title: '', comment: '' }),
    fillReportCardSlide_() { calls.fills++; cfg.elapsed = (cfg.elapsed || 0) + (cfg.fillMs || 0); },
    exportSlidePng() { calls.renders++; if (cfg.renderFail) throw new Error('synthetic render failure'); return blob('new.png'); }
  };
  vm.createContext(context); vm.runInContext(source, context);
  const read = key => context.getState(sheets.app_state, key).val;
  return { E: context, cfg, calls, sheets, files, triggers, lock, read, file };
}

test('월보: quota 부족에는 발송키가 없고, 같은 본문 재시도 성공 뒤에만 sent/발송키', () => {
  const h = harness({ quota: 0 });
  assert.equal(h.E.buildExecReport_().pending, 1);
  assert.equal(h.read('경영리포트발송_2026-08'), '');
  const saved = JSON.parse(h.read('경영리포트메일_2026-08'));
  h.sheets.profiles.data[1][1] = '바뀐 이름'; h.cfg.quota = 10;
  assert.equal(h.E.buildExecReport_().sent, 1);
  assert.equal(h.calls.mail[0].body, saved.body);
  assert.ok(h.read('경영리포트발송_2026-08'));
  h.E.buildExecReport_(); assert.equal(h.calls.mail.length, 1);
});

test('월보: 발송시도 예외는 uncertain, 재시도해도 중복 발송 0', () => {
  const h = harness({ mailThrow: 'ops@example.invalid' });
  assert.equal(h.E.buildExecReport_().uncertain, 1);
  h.cfg.mailThrow = null; h.E.buildExecReport_();
  assert.equal(h.calls.mail.length, 1); assert.equal(h.read('경영리포트발송_2026-08'), '');
});

test('월보: 성공 직후 상태 저장 실패는 sending으로 남고 다음 실행에서 uncertain', () => {
  const h = harness({ failSent: true });
  assert.throws(() => h.E.buildExecReport_(), /persistence/);
  assert.equal(JSON.parse(h.read('경영리포트전달_2026-08')).status, 'sending');
  assert.equal(h.triggers.length, 1, '하드킬/예외 회수용 예약은 남아야 한다');
  h.E.monthlyReportContinue(); assert.equal(h.calls.mail.length, 1);
  assert.equal(JSON.parse(h.read('경영리포트전달_2026-08')).status, 'uncertain');
});

test('월보: 구 선마킹 키는 발송으로 추정/변경하지 않고 다음 달 신규 월보를 막지 않는다', () => {
  const h = harness({ states: [['경영리포트발송_2026-08', '2026-09-01']] });
  assert.equal(h.E.buildExecReport_().legacy_unknown, 1);
  assert.equal(h.read('경영리포트전달_2026-08'), ''); assert.equal(h.calls.mail.length, 0);
  h.cfg.now = '2026-10-01T01:00:00Z'; assert.equal(h.E.buildExecReport_().sent, 1);
  assert.equal(h.read('경영리포트발송_2026-08'), '2026-09-01');
});

test('월보: 월이 넘어가도 알려진 pending만 원본문안으로 이어 보낸다', () => {
  const h = harness({ quota: 0 }); h.E.buildExecReport_();
  h.cfg.now = '2026-10-02T01:00:00Z'; h.cfg.quota = 10;
  h.E.monthlyReportContinue(); assert.match(h.calls.mail[0].subject, /8월/);
  assert.ok(h.read('경영리포트발송_2026-08')); assert.equal(h.read('경영리포트발송_2026-09'), '');
});

test('동시실행은 busy로 끝나고 발송/생성 없이 한 개의 후속 예약만 남긴다', () => {
  const h = harness({ busy: true });
  assert.equal(h.E.runReportCards_().busy, 1); h.E.runReportCards_();
  assert.equal(h.calls.mail.length, 0); assert.equal(h.calls.create.length, 0); assert.equal(h.triggers.length, 1);
});

test('카드: 생성 후 quota 부족을 pending으로 남기고 파일 재사용 후 학생별 sent', () => {
  const h = harness({ quota: 0 }); const first = h.E.runReportCards_();
  assert.equal(first.generated, 2); assert.equal(first.pending, 2); assert.equal(first.sent, 0);
  assert.equal(h.calls.create.length, 2); assert.equal(h.triggers[0].delay, 86400000);
  assert.equal(h.calls.sanitized, 2, '학생 유래 본문은 공용 시트 소독 채널을 지나야 한다');
  h.cfg.quota = 10; h.E.reportCardsContinue();
  assert.equal(h.calls.create.length, 2); assert.equal(h.calls.renders, 2); assert.equal(h.calls.mail.length, 2);
  h.E.runReportCards_(); assert.equal(h.calls.mail.length, 2); assert.equal(h.calls.sharing, 0);
  assert.ok(h.calls.mail.every(m => m.opts.attachments[0].getContentType() === 'image/png'));
});

test('카드: 일부 발송 예외와 정상 수신자를 분리하고 확정 수신자/불확실 수신자 모두 자동 중복 0', () => {
  const h = harness({ mailThrow: 's1@example.invalid' }); const out = h.E.runReportCards_();
  assert.equal(out.uncertain, 1); assert.equal(out.sent, 1);
  assert.deepEqual(h.sheets.report_cards.data.slice(1).map(r => r[7]), ['uncertain', 'sent']);
  h.cfg.mailThrow = null; h.E.runReportCards_(); assert.equal(h.calls.mail.length, 2);
});

test('카드: 보호자 이메일을 나중에 채우면 같은 PNG와 원본문안으로 자동 재시도', () => {
  const h = harness({ profiles: [profile('S1', '')] });
  const out = h.E.runReportCards_(); assert.equal(out.pending, 1); assert.equal(out.noMail, 1);
  const original = h.sheets.report_cards.data[1][10];
  h.sheets.profiles.data[1][25] = 'new@example.invalid'; h.sheets.profiles.data[1][1] = '수정된 이름';
  h.E.reportCardsContinue(); assert.equal(h.calls.create.length, 1); assert.equal(h.calls.mail.length, 1);
  assert.equal(h.calls.mail[0].to, 'new@example.invalid'); assert.equal(h.calls.mail[0].body, original);
});

test('카드: 파일 없음/빈 PNG/잘못된 MIME은 발송 전 pending, 복구 후 재사용', () => {
  for (const problem of ['blobFail', 'emptyBlob', 'badBlob']) {
    const h = harness({ cards: [card('S1')], profiles: [profile('S1')], [problem]: true });
    assert.equal(h.E.runReportCards_().pending, 1); assert.equal(h.calls.mail.length, 0);
    h.cfg[problem] = false; assert.equal(h.E.reportCardsContinue().sent, 1); assert.equal(h.calls.create.length, 0);
  }
});

test('카드: Drive URL은 허용 호스트/정확한 ID 경로만 읽는다', () => {
  const h = harness();
  assert.equal(h.E.reportCardFileId_('https://lh3.googleusercontent.com/d/FILE_________1'), 'FILE_________1');
  assert.equal(h.E.reportCardFileId_('https://drive.google.com/file/d/FILE_________1/view?usp=sharing'), 'FILE_________1');
  assert.equal(h.E.reportCardFileId_('https://drive.google.com/open?id=FILE_________1'), 'FILE_________1');
  for (const bad of ['https://evil.invalid/FILE_________1', 'https://drive.google.com.evil.invalid/file/d/FILE_________1/view',
    'https://lh3.googleusercontent.com/d/../../secret', 'https://drive.google.com/file/d/short/view']) assert.equal(h.E.reportCardFileId_(bad), '');
});

test('카드: 현재월 구 생성행은 legacy_unknown 그대로, 다른 신규 학생은 정상 전달', () => {
  const legacy = card('S1', '').slice(0, 7), h = harness({ cards: [legacy] });
  const out = h.E.runReportCards_(); assert.equal(out.legacy_unknown, 1); assert.equal(out.sent, 1);
  assert.deepEqual(h.sheets.report_cards.data[1], legacy); assert.equal(h.calls.mail[0].to, 's2@example.invalid');
});

test('카드: hardkill sending 회수와 sent 저장 실패 모두 자동 재발송하지 않는다', () => {
  const h = harness({ cards: [card('S1', 'sending')], profiles: [profile('S1')] });
  assert.equal(h.E.runReportCards_().uncertain, 1); assert.equal(h.calls.mail.length, 0);
  const fresh = harness({ failSent: true, profiles: [profile('S1')] });
  assert.throws(() => fresh.E.runReportCards_(), /persistence/);
  assert.equal(fresh.sheets.report_cards.data[1][7], 'sending');
  fresh.E.reportCardsContinue(); assert.equal(fresh.calls.mail.length, 1);
  assert.equal(fresh.sheets.report_cards.data[1][7], 'uncertain');
});

test('카드: 한 번에 처리할 수 있는 수를 넘기면 4분 후 생성/전달을 잇는다', () => {
  const h = harness({ profiles: [profile('S1'), profile('S2'), profile('S3')] });
  assert.equal(h.E.runReportCards_().generation_pending, 1); assert.equal(h.triggers[0].delay, 240000);
  h.E.reportCardsContinue(); assert.equal(h.calls.create.length, 3); assert.equal(h.calls.mail.length, 3);
  assert.equal(h.triggers.length, 0);
});

test('카드: 생성 실패는 완료가 아니며 24시간 후 재시도, 기존 카드 전달은 살린다', () => {
  const h = harness({ cards: [card('S1')], renderFail: true });
  const out = h.E.runReportCards_(); assert.equal(out.sent, 1); assert.equal(out.generation_pending, 1);
  assert.equal(h.triggers[0].delay, 86400000);
  h.cfg.renderFail = false; h.E.reportCardsContinue(); assert.equal(h.calls.mail.length, 2);
});

test('카드: 중복 card_id/중복 프로필 수신자는 추측하지 않는다', () => {
  const h = harness({ cards: [card('S1'), card('S1')], profiles: [profile('S1')] });
  assert.equal(h.E.runReportCards_().uncertain, 2); assert.equal(h.calls.mail.length, 0);
  const duplicate = harness({ cards: [card('S1')], profiles: [profile('S1'), profile('S1', 'other@example.invalid')] });
  assert.equal(duplicate.E.runReportCards_().pending, 1); assert.equal(duplicate.calls.mail.length, 0);
});

test('카드: 준비 실패는 발송 예산을 소모하지 않고 과거 대기가 현재월 신규 전달을 막지 않는다', () => {
  const h = harness({ cards: [card('S1'), card('S2'), card('S3')],
    profiles: [profile('S1', ''), profile('S2', ''), profile('S3')] });
  const out = h.E.runReportCards_(); assert.equal(out.pending, 2); assert.equal(out.sent, 1);
  assert.equal(h.calls.mail[0].to, 's3@example.invalid');
  const older = harness({ cards: [card('S1', 'pending', '2026-08'), card('S2', 'pending', '2026-08'), card('S3')],
    profiles: [profile('S1'), profile('S2'), profile('S3')] });
  older.E.runReportCards_(); assert.equal(older.calls.mail[0].to, 's3@example.invalid');
});

test('카드: quota가 소진되면 전달 잔여가 있어도 4분 무한 재시도가 아니라 다음날 예약', () => {
  const h = harness({ cards: [card('S1'), card('S2'), card('S3')],
    profiles: [profile('S1'), profile('S2'), profile('S3')], quota: 0 });
  assert.equal(h.E.runReportCards_().pending, 3); assert.equal(h.triggers[0].delay, 86400000);
});

test('카드: 생성 후 행 기록 전 중단으로 남은 PNG는 이름이 유일할 때만 재사용', () => {
  const h = harness({ profiles: [profile('S1')] });
  h.files.set('ORPHAN_______1', h.file('ORPHAN_______1', 'SYNK_card_2026-09-S1.png'));
  h.E.runReportCards_(); assert.equal(h.calls.create.length, 0); assert.equal(h.calls.renders, 0);
  assert.equal(h.calls.mail.length, 1);
  assert.doesNotMatch(h.calls.mail[0].body, /10P|2회|포인트|출석/);
  assert.match(h.calls.mail[0].body, /첨부된 이미지/);
});

test('명시 확인한 legacy 카드 한 건만 기존 PNG로 회수하며 confirmed sent는 다시 열지 않는다', () => {
  const legacy = card('S1', '').slice(0, 7), h = harness({ cards: [legacy], profiles: [profile('S1')] });
  assert.throws(() => h.E.resolveMonthlyDelivery_('card', legacy[0], 'not_sent', false), /확인/);
  h.E.resolveMonthlyDelivery_('card', legacy[0], 'not_sent', true); h.E.reportCardsContinue();
  assert.equal(h.calls.create.length, 0); assert.equal(h.calls.mail.length, 1);
  h.E.resolveMonthlyDelivery_('card', legacy[0], 'not_sent', true); h.E.runReportCards_();
  assert.equal(h.calls.mail.length, 1);
});

test('해소함수는 verified=true라도 운영 소유자 확인이 없으면 I/O 전에 거절한다', () => {
  const h = harness({ owner: false }); h.calls.reads.length = 0;
  assert.throws(() => h.E.resolveMonthlyDelivery_('card', '2026-09-S1', 'sent', true), /소유자/);
  assert.equal(h.calls.reads.length, 0); assert.equal(h.calls.mail.length, 0);
  delete h.E.automationOwnerAllowed_;
  assert.throws(() => h.E.resolveMonthlyDelivery_('card', '2026-09-S1', 'sent', true), /소유자/);
});

test('월간 명시적 API 입구도 같은 소유자/실제 확인 검증을 통과해야 한다', () => {
  const h = harness({ owner: false });
  assert.throws(() => h.E.resolveMonthlyDelivery('card', '2026-09-S1', 'not_sent', true), /소유자/);
  assert.equal(h.calls.mail.length, 0); assert.equal(h.calls.reads.length, 0);
  const owner = harness();
  assert.throws(() => owner.E.resolveMonthlyDelivery('card', '2026-09-S1', 'not_sent', false), /확인/);
  assert.equal(owner.calls.reads.length, 0);
});

test('카드: URL이 다른 학생 PNG를 가리키면 실제 파일명/월/SID가 달라 발송하지 않는다', () => {
  const wrong = card('S1'); wrong[3] = card('S2')[3];
  const h = harness({ cards: [wrong, card('S2')] });
  const out = h.E.runReportCards_(); assert.equal(out.pending, 1); assert.equal(out.sent, 1);
  assert.equal(h.calls.mail[0].to, 's2@example.invalid');
  assert.equal(h.E.reportCardFileMatches_('2026-09_S10_합성.png', '2026-09-S1', 'S1', '2026-09'), false);
  assert.equal(h.E.reportCardFileMatches_('SYNK_card_2026-08-S1.png', '2026-09-S1', 'S1', '2026-09'), false);
});

test('카드: 템플릿 복제/채우기부터 시간 예산을 적용하며 성공한 소량만 저장한다', () => {
  const profiles = Array.from({ length: 10 }, (_, i) => profile('S' + i));
  const h = harness({ profiles, maxCards: 30, duplicateMs: 40000 });
  const out = h.E.runReportCards_(); assert.equal(h.calls.duplicates, 2); assert.equal(out.generated, 2);
  assert.equal(out.generation_pending, 8); assert.equal(h.triggers[0].delay, 240000);
  const fill = harness({ profiles, maxCards: 30, fillMs: 70000 });
  fill.E.runReportCards_(); assert.equal(fill.calls.duplicates, 5); assert.equal(fill.calls.fills, 2);
});

test('카드: 300명도 5장씩 후속 실행하며 전원 한 번씩 전달하고 후속 예약을 정리한다', () => {
  const h = harness({ profiles: Array.from({ length: 300 }, (_, i) => profile('S' + i)), maxCards: 30, quota: 1000 });
  for (let n = 0; n < 60; n++) h.E.reportCardsContinue();
  assert.equal(h.calls.create.length, 300); assert.equal(h.calls.mail.length, 300);
  assert.equal(new Set(h.calls.mail.map(m => m.to)).size, 300); assert.equal(h.triggers.length, 0);
  h.E.runReportCards_(); assert.equal(h.calls.mail.length, 300);
});

test('월간 읽기점검은 현재월 카드 상태열과 전월 월보 상태셀만 읽고 저장/본문 반환 0', () => {
  const h = harness({ cards: [card('S1', 'pending'), card('S2', ''), card('S3', 'sent', '2026-08')],
    states: [['경영리포트메일_2026-08', 'sensitive body'], ['경영리포트발송_2026-08', 'old']] });
  h.calls.reads.length = 0;
  const before = JSON.stringify(h.sheets), out = h.E.monthlyDeliveryHealth_();
  assert.equal(out.cards.counts.pending, 1); assert.equal(out.cards.counts.legacy_unknown, 1); assert.equal(out.cards.counts.sent, 0);
  assert.equal(out.report.status, 'legacy_unknown'); assert.equal(JSON.stringify(h.sheets), before);
  assert.equal(h.calls.mail.length, 0); assert.doesNotMatch(JSON.stringify(out), /S1|sensitive|FILE_|example/);
  assert.ok(h.calls.reads.every(r => r.nc === 1 && (r.name === 'app_state' || [3, 8].includes(r.col))));
});
