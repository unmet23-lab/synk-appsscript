'use strict';
/* Apps Script 안전 점검 — 2026-10-02 학원 운영 시스템을 지운 뒤 남은 프로젝트(@synkbrief 자료 DM)를 본다.
 *
 * 옛 safety 시험 157개는 지운 학원 기능을 검사했다. 그 기록은 git 이력에 있다.
 * 여기에는 남은 코드에도 그대로 필요한 검사만 다시 적었다.
 *   - 라이브에 올라가는 파일(.claspignore 허용목록)과 구문, 올리는 순서
 *   - 설정 파일(실행 API는 본인만)
 *   - 웹 입구: doGet은 HtmlService를 돌려주지 않고, synkbrief가 아닌 요청은 아무 일도 하지 않는다
 *   - 파일 사이의 톱레벨 참조 금지(Apps Script는 파일 순서대로 전역을 초기화한다)
 *   - 옛 트리거 정리
 *   - 버전 표기
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { ROOT, liveFiles } = require('./_engine-source');

const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 라이브에 올리지 않고 저장소에만 두는 루트 Apps Script 파일. 이유가 있는 것만 적는다.
const 올리지않는파일 = {};

test('라이브에 올라가는 파일은 Code.js와 엔진_synkbrief.js 둘이고 구문이 정상이다', () => {
  const 전수 = liveFiles();
  assert.deepEqual([...전수].sort(), ['Code.js', '엔진_synkbrief.js'].sort());
  전수.forEach((f) => execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }));
});

test('루트의 Apps Script 파일은 라이브에 올리거나, 올리지 않는 이유가 적혀 있다', () => {
  const 전수 = new Set(liveFiles());
  fs.readdirSync(ROOT).filter((f) => /\.(js|gs)$/.test(f)).forEach((f) => {
    assert.ok(전수.has(f) || 올리지않는파일[f], f + ' 가 .claspignore 허용목록에도, 올리지 않는 이유 목록에도 없다');
  });
});

test('설정 파일이 정상이고 실행 API는 본인만 허용한다', () => {
  const manifest = JSON.parse(읽기('appsscript.json'));
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.executionApi && manifest.executionApi.access, 'MYSELF');
});

test('clasp 올리는 순서는 Code.js가 맨 앞이고 라이브 파일과 같다', () => {
  const clasp = JSON.parse(읽기('.clasp.json'));
  assert.equal(clasp.filePushOrder[0], 'Code.js');
  assert.deepEqual([...clasp.filePushOrder].sort(), [...liveFiles()].sort());
});

test('각 라이브 파일은 혼자 읽어도 초기화에서 죽지 않는다(파일 사이 톱레벨 참조 없음)', () => {
  liveFiles().forEach((f) => {
    assert.doesNotThrow(() => vm.runInContext(읽기(f), vm.createContext({ console })), f);
  });
});

test('웹 입구 함수는 Code.js에만 있다', () => {
  liveFiles().forEach((f) => {
    const n = (읽기(f).match(/^function\s+do(?:Get|Post)\s*\(/gm) || []).length;
    assert.equal(n, f === 'Code.js' ? 2 : 0, f);
  });
});

test('doGet은 HtmlService를 돌려주지 않는다', () => {
  const src = 읽기('Code.js');
  const s = src.indexOf('function doGet(');
  const e = src.indexOf('\nfunction ', s + 1);
  assert.notEqual(s, -1);
  assert.doesNotMatch(src.slice(s, e === -1 ? undefined : e), /HtmlService/);
});

// Apps Script 전역을 흉내 낸 실행 환경
function 환경(props = {}) {
  const 속성 = new Map(Object.entries(props));
  const 트리거 = [];
  const 기록 = { 만든트리거: [], 지운트리거: [], 웹훅: [] };
  const 만들기 = (name) => {
    let minutes;
    const b = { timeBased: () => b, everyMinutes: n => { minutes = n; return b; },
      create: () => { const t = { getHandlerFunction: () => name, getEventType: () => 'CLOCK', minutes }; 트리거.push(t); 기록.만든트리거.push(name); return t; } };
    return b;
  };
  const ctx = vm.createContext({
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (속성.has(k) ? 속성.get(k) : null) }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType(m) { this.mime = m; return this; } }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ScriptApp: {
      EventType: { CLOCK: 'CLOCK' },
      getProjectTriggers: () => 트리거.slice(),
      deleteTrigger: (t) => { 트리거.splice(트리거.indexOf(t), 1); 기록.지운트리거.push(t.getHandlerFunction()); },
      newTrigger: 만들기,
    },
  });
  vm.runInContext(읽기('Code.js'), ctx);
  ctx.synkbrief_웹훅_ = (e, body) => { 기록.웹훅.push(body); return body && body.object === 'instagram' ? { ok: true, channel: 'synkbrief' } : null; };
  ctx.synkbrief정기점검 = () => {};
  const 옛트리거 = (names) => names.forEach((n) => 트리거.push({ getHandlerFunction: () => n, getEventType: () => 'CLOCK' }));
  return { ctx, 트리거, 기록, 옛트리거 };
}

test('doPost는 synkbrief 알림만 처리하고, 나머지는 아무 일도 하지 않고 돌려보낸다', () => {
  const { ctx, 기록 } = 환경();
  const 응답 = (body) => JSON.parse(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify(body) } }).text);
  assert.deepEqual(응답({ object: 'instagram', entry: [] }), { ok: true, channel: 'synkbrief' });
  assert.deepEqual(응답({ object: 'page', entry: [] }), { ok: true, skip: 'unhandled' });
  assert.equal(기록.웹훅.length, 2);
});

test('doPost는 깨진 요청에 내부 오류 내용을 내보내지 않는다', () => {
  const { ctx } = 환경();
  const r = JSON.parse(ctx.doPost({ parameter: {}, postData: { contents: '{깨짐' } }).text);
  assert.deepEqual(r, { ok: false, error: 'internal' });
});

test('doGet은 검증 토큰이 맞을 때만 Meta 확인 값을 돌려준다', () => {
  const { ctx } = 환경({ 상담AI_검증토큰: 'verify' });
  const 확인 = (token) => ctx.doGet({ parameter: { 'hub.mode': 'subscribe', 'hub.verify_token': token, 'hub.challenge': '42' } }).text;
  assert.equal(확인('verify'), '42');
  assert.equal(확인('wrong'), 'SYNK');
  assert.equal(ctx.doGet({ parameter: {} }).text, 'SYNK');
  assert.equal(환경().ctx.doGet({ parameter: { 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': '42' } }).text, 'SYNK',
    '검증 토큰 속성이 없으면 빈 토큰으로도 통과하지 않는다');
});

// 지운 학원 운영 시스템이 설치하던 트리거의 실행 함수 이름(옛 엔진_셋업확장.js resetAllTriggers)
const 옛트리거이름 = ['parentSweep', 'dailyBackupJob', 'morningJobs', 'sendMorningDigestJob', 'calcAllJob', 'momentSweepJob',
  'nightJobs', 'weeklyJobs', 'monthlyJobs', 'monthlyReportCardsJob', 'monthlyReportJob', '교재연동Nightly', 'onConsultEdit', 'onHwFeedbackEdit'];

test('명시 활성화·읽기 키가 있으면 옛 트리거를 정리하고 15분 운영 점검 하나를 복구한다', () => {
  const { ctx, 트리거, 기록, 옛트리거 } = 환경({ SYNKBRIEF_OPS_MONITOR_ENABLED: '1', SYNKBRIEF_OPS_READ_KEY: 'test-only-ops-key-abcdefghijklmnopqrstuvwxyz' });
  옛트리거(옛트리거이름);
  ctx.parentSweep();
  assert.deepEqual(트리거.map((t) => t.getHandlerFunction()), ['synkbrief정기점검']);
  assert.equal(기록.지운트리거.length, 옛트리거이름.length);
  ctx.트리거정리();
  assert.deepEqual(트리거.map((t) => t.getHandlerFunction()), ['synkbrief정기점검'], '두 번 돌려도 하나만 남는다');
  assert.equal(기록.만든트리거.length, 1);
  assert.equal(트리거[0].minutes, 15);
});

test('운영 알림 미설치·비활성화·유효한 키 누락이면 정리가 새 타이머를 만들지 않는다', () => {
  for (const props of [{}, { SYNKBRIEF_OPS_READ_KEY: 'test-only-ops-key-abcdefghijklmnopqrstuvwxyz' },
    { SYNKBRIEF_OPS_MONITOR_ENABLED: '0', SYNKBRIEF_OPS_READ_KEY: 'test-only-ops-key-abcdefghijklmnopqrstuvwxyz' },
    { SYNKBRIEF_OPS_MONITOR_ENABLED: '1' }, { SYNKBRIEF_OPS_MONITOR_ENABLED: '1', SYNKBRIEF_OPS_READ_KEY: 'short' },
    { SYNKBRIEF_OPS_MONITOR_ENABLED: '1', SYNKBRIEF_OPS_READ_KEY: 'invalid read key with whitespace abcdefghijk' }]) {
    const { ctx, 트리거, 기록, 옛트리거 } = 환경(props);
    옛트리거(옛트리거이름); ctx.parentSweep();
    assert.equal(트리거.length, 0); assert.equal(기록.만든트리거.length, 0);
    assert.equal(기록.지운트리거.length, 옛트리거이름.length);
  }
});

test('기존 운영 점검 타이머는 설정 유무와 무관하게 같은 객체로 보존한다', () => {
  const { ctx, 트리거, 기록, 옛트리거 } = 환경();
  const installed = { getHandlerFunction: () => 'synkbrief정기점검', getEventType: () => 'CLOCK', minutes: 15 };
  트리거.push(installed); 옛트리거(['parentSweep']); ctx.트리거정리();
  assert.equal(트리거.length, 1); assert.equal(트리거[0], installed); assert.equal(기록.만든트리거.length, 0);
});

test('다른 이벤트의 동일 handler는 정기 타이머가 있는 것으로 오인하지 않는다', () => {
  const { ctx, 트리거, 기록 } = 환경({ SYNKBRIEF_OPS_MONITOR_ENABLED: '1', SYNKBRIEF_OPS_READ_KEY: 'test-only-ops-key-abcdefghijklmnopqrstuvwxyz' });
  const edit = { getHandlerFunction: () => 'synkbrief정기점검', getEventType: () => 'EDIT' };
  트리거.push(edit); ctx.트리거정리();
  assert.equal(트리거.includes(edit), true); assert.equal(기록.만든트리거.length, 1); assert.equal(트리거[1].minutes, 15);
});

test('옛 트리거 이름마다 정리 함수가 있다', () => {
  const { ctx } = 환경();
  옛트리거이름.forEach((n) => assert.equal(typeof ctx[n], 'function', n));
});

test('SYNK_VERSION은 라이브 파일의 가장 높은 버전 태그와 같고, 버전 이력에 그 버전이 있다', () => {
  const 태그 = liveFiles().flatMap((f) => [...읽기(f).matchAll(/\[v9\.(\d+)\]/g)].map((m) => Number(m[1])));
  const 상수 = 읽기('Code.js').match(/const SYNK_VERSION = 'v9\.(\d+)'/);
  assert.ok(상수, 'SYNK_VERSION 선언이 없다');
  assert.equal(Number(상수[1]), Math.max(...태그));
  assert.match(읽기('docs/버전_이력.md'), new RegExp('\\[v9\\.' + 상수[1] + '\\]'));
});
