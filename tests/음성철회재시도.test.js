'use strict';

// 실제 학생·Drive·메일에 연결하지 않고, 시트와 파일 동작을 합성한 상태에서 정본 함수를 실행한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', '교재연동.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function voiceWithdraw(');
const end = source.indexOf('\n}\n', start);
assert.ok(start >= 0 && end > start);
const declaration = source.slice(start, end + 2);
const SID = 'synthetic-student-a';
const OTHER = 'synthetic-student-b';
const row = (fid, sid = SID) => [sid, '2026-09-11', 'synthetic-private-mission', 'https://drive.google.com/file/d/synthetic-url-only/view', fid, ''];

function harness(options = {}) {
  const data = (options.rows || []).map(r => r.slice());
  const events = [], logs = [], mails = [];
  const failingFiles = new Set(options.failingFiles || []);
  const failingRows = new Set(options.failingRows || []);
  const profileIds = options.profileIds || [SID];
  const consentIds = options.consentIds || [SID];
  const error = () => new Error('synthetic-sensitive-marker: token/file/student');
  const vl = {
    getLastRow: () => data.length + 1,
    getRange: (r, c, n, w) => ({ getValues: () => data.slice(r - 2, r - 2 + n).map(v => v.slice(c - 1, c - 1 + w)) }),
    deleteRow: (r) => {
      events.push(`delete:${r}`);
      if (failingRows.has(r)) throw error();
      data.splice(r - 2, 1);
    },
  };
  const consent = {
    getLastColumn: () => 2,
    getLastRow: () => consentIds.length + 2,
    getRange: (r, c, n, w) => ({
      getValues: () => r === 2 ? [['학생ID', '음성동의']] : consentIds.map(id => [id, '예, 동의합니다']),
      setValue: value => {
        events.push(`consent:${r}`);
        assert.equal(value, '아니요, 원하지 않습니다');
        if (options.consentWriteFails) throw error();
      },
    }),
  };
  const profiles = {
    getLastRow: () => profileIds.length + 1,
    getRange: (r, c, n, w) => ({
      getValues: () => profileIds.map(id => [id]),
      clearContent: () => {
        events.push(`card:${r}`);
        if (options.cardFails) throw error();
      },
    }),
  };
  const ss = { getSheetByName: name => name === 'voice_log' ? vl : name === 'profiles' && !options.noProfiles ? profiles : null };
  const scope = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: () => {
        events.push('consult-open');
        if (options.consultFails) throw error();
        return { getSheetByName: () => consent };
      },
    },
    DriveApp: { getFileById: id => {
      events.push(`file:${id}`);
      return { setTrashed: value => {
        assert.equal(value, true);
        if (failingFiles.has(id)) throw error();
        events.push(`trashed:${id}`);
      } };
    } },
    tbProfileCol_: () => options.noCardColumn ? 0 : 5,
    CONSULT_SHEET_ID: 'synthetic-consult-sheet',
    CONSENT_EXT_HEADERS: ['음성동의'],
    탭수축기준선지움_: name => { assert.equal(name, 'voice_log'); events.push('baseline-reset'); },
    Logger: { log: value => logs.push(value) },
    adminMail: (title, body) => { mails.push({ title, body }); },
  };
  vm.createContext(scope);
  vm.runInContext(declaration, scope);
  return { run: confirm => scope.voiceWithdraw(SID, confirm), data, events, logs, mails, failingFiles, failingRows };
}

test('기본·문자열 true는 미리보기: 동의/파일/행/카드/메일을 변경하지 않는다', () => {
  const h = harness({ rows: [row('file-ok'), row('')] });
  for (const confirm of [undefined, false, 'true']) {
    const result = h.run(confirm);
    assert.match(result, /미리보기/);
    assert.match(result, /파일ID 미확인 1행/);
    assert.match(result, /원본 제출 폼·응답 시트/);
  }
  assert.deepEqual(h.events, []);
  assert.equal(h.data.length, 2);
  assert.equal(h.mails.length, 0);
});

test('혼합 성공: 휴지통 성공행만 내림차순 삭제하고 실패·ID 없음·다른 학생 행을 보존한다', () => {
  const h = harness({ rows: [row('file-ok'), row('file-fail'), row(''), row('other-file', OTHER), row('file-ok-2')], failingFiles: ['file-fail'] });
  const result = h.run(true);
  assert.deepEqual(h.data.map(r => r[4]), ['file-fail', '', 'other-file']);
  assert.deepEqual(h.events.filter(e => e.startsWith('delete:')), ['delete:6', 'delete:2']);
  assert.ok(h.events.indexOf('consent:3') < h.events.indexOf('file:file-ok'));
  assert.ok(!h.events.includes('file:other-file'));
  assert.equal(h.events.filter(e => e === 'baseline-reset').length, 1);
  assert.match(result, /휴지통 이동 2개 · 실패 1개 · 파일ID 미확인 1행/);
  assert.match(result, /voice_log: 2행 삭제 · 남은 2행/);
});

test('Drive 실패 후 남은 행으로 재실행하면 해당 파일을 다시 처리할 수 있다', () => {
  const h = harness({ rows: [row('retry-file')], failingFiles: ['retry-file'] });
  assert.match(h.run(true), /voice_log: 0행 삭제 · 남은 1행/);
  assert.equal(h.data.length, 1);
  assert.ok(!h.events.includes('baseline-reset'));
  h.failingFiles.clear();
  assert.match(h.run(true), /voice_log: 1행 삭제 · 남은 0행/);
  assert.equal(h.data.length, 0);
  assert.equal(h.events.filter(e => e === 'file:retry-file').length, 2);
});

test('휴지통 성공 뒤 행 삭제 실패도 기록을 남기고 재시도한다', () => {
  const h = harness({ rows: [row('retry-row')], failingRows: [2] });
  assert.match(h.run(true), /행 삭제 실패 1행/);
  assert.equal(h.data.length, 1);
  assert.ok(!h.events.includes('baseline-reset'));
  h.failingRows.clear();
  assert.match(h.run(true), /voice_log: 1행 삭제 · 남은 0행/);
  assert.equal(h.data.length, 0);
});

test('같은 파일이 여러 행에 있으면 파일 작업은 한 번, 성공행 삭제는 각각 수행한다', () => {
  const h = harness({ rows: [row('duplicate'), row('duplicate')] });
  assert.match(h.run(true), /휴지통 이동 1개/);
  assert.equal(h.events.filter(e => e === 'file:duplicate').length, 1);
  assert.equal(h.data.length, 0);
});

test('같은 실패 파일의 모든 행을 남기고 실패 파일 수를 부풀리지 않는다', () => {
  const h = harness({ rows: [row('duplicate'), row('duplicate')], failingFiles: ['duplicate'] });
  const result = h.run(true);
  assert.match(result, /실패 1개/);
  assert.match(result, /voice_log: 0행 삭제 · 남은 2행/);
  assert.equal(h.events.filter(e => e === 'file:duplicate').length, 1);
  assert.equal(h.data.length, 2);
});

test('파일ID가 없으면 URL에서 삭제 대상을 추정하지 않고 미처리로 남긴다', () => {
  const h = harness({ rows: [row('   ')] });
  const result = h.run(true);
  assert.match(result, /파일ID 미확인 1행/);
  assert.equal(h.data.length, 1);
  assert.ok(!h.events.some(e => e.startsWith('file:') || e.startsWith('delete:')));
});

test('동의 접근·변경 실패와 동의행 없음은 완료로 표시하지 않는다', () => {
  for (const options of [{ consultFails: true }, { consentWriteFails: true }, { consentIds: [] }]) {
    const h = harness({ rows: [row('ok')], ...options });
    const result = h.run(true);
    assert.match(result, /① 동의: (실패|미처리)/);
    assert.match(result, /전체 자료의 삭제 완료를 뜻하지 않습니다/);
    assert.match(result, /휴지통 이동은 영구 삭제 완료가 아닙니다/);
  }
});

test('카드 초기화 실패·열 없음·profiles 없음은 초기화 완료로 표시하지 않는다', () => {
  for (const options of [{ cardFails: true }, { noCardColumn: true }, { noProfiles: true }]) {
    const h = harness(options);
    const result = h.run(true);
    assert.match(result, /④ 성장 카드: .*?(실패|미처리)/);
    assert.doesNotMatch(result, /✅/);
  }
});

test('처리 결과·로그·메일에는 파일ID·학생ID·자유서술·예외 원문을 넣지 않는다', () => {
  const h = harness({ rows: [row('synthetic-private-file')], failingFiles: ['synthetic-private-file'], consultFails: true, cardFails: true });
  const result = h.run(true);
  const all = JSON.stringify([result, h.logs, h.mails]);
  for (const secret of [SID, 'synthetic-private-file', 'synthetic-private-mission', 'synthetic-sensitive-marker', 'synthetic-url-only']) {
    assert.ok(!all.includes(secret), `운영 출력에 합성 식별·비밀 자료가 남음: ${secret}`);
  }
  assert.match(result, /①상담시트 음성동의 ②voice_log에 연결된 Drive 파일 ③voice_log 행 ④profiles 목소리성장카드/);
  assert.match(result, /파생자료.*별도 사본·백업/);
});
