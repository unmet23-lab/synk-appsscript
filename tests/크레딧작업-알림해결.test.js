'use strict';
// 11-25 알림해결: 감시가 남긴 오늘 요청을 한 번만 집고, 마지막 답을 감시가 읽는 진단 파일로 남긴다. 도구가 없고 고치지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 만들기, 예약상태, 설정, 답가리기, 감시설명, 예약설명, 백업상태, 백업영수증, 운영기록 } = require('../tools/크레딧작업/알림해결.js');
const monitor = require('../tools/hermes-synk/monitor.cjs');
// 이 PC의 진짜 운영 사본 상태를 읽지 않게 한다.
process.env.SYNK_운영사본_상태 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-ops-'));

function 준비({ 남은분 = 100 } = {}) {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-'));
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-room-'));
  const 자리 = path.join(집, 'runtime/synk-automation'), 보낼곳 = path.join(자리, 'outbox');
  fs.mkdirSync(보낼곳, { recursive: true });
  fs.mkdirSync(path.join(자리, 'diagnosis'), { recursive: true });
  const 지금 = new Date('2026-11-25T00:10:00Z');
  const 묶음 = { version: 1, id: monitor.digestId('2026-11-25'), day: '2026-11-25', createdAt: '2026-11-25T00:05:00.000Z',
    holdUntil: new Date(+지금 + 남은분 * 60000).toISOString(),
    items: [{ id: 'ops-copy-task', incident: 'i1', title: '운영 사본 갱신이 멈춤', detail: '30분 넘게 갱신 기록이 없습니다' }], recoveries: [] };
  fs.writeFileSync(path.join(자리, 'diagnosis/request.json'), JSON.stringify(묶음));
  fs.writeFileSync(path.join(자리, 'state.json'), JSON.stringify({ digest: { day: 묶음.day, id: 묶음.id, status: 'waiting', holdUntil: 묶음.holdUntil } }));
  return { 집, 방, 자리, 보낼곳, 지금, 묶음, 작업: 만들기({ 집고정: 집, 지금고정: 지금 }) };
}

test('오늘 요청을 한 번만 집고 진단을 감시가 읽는 꼴로 남긴다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방, 실행: () => ({ code: 0, stdout: 'SYNK 운영 사본 갱신 | Ready | 마지막 2026-11-25 08:50 | 결과 1 | 다음 2026-11-25 08:55\r\n' }) });
  assert.equal(자료.id, f.묶음.id);
  assert.equal(자료.항목[0].id, 'ops-copy-task');
  const 지시 = f.작업.지시문(자료);
  assert.match(지시, /ops-copy-task/);
  assert.match(지시, /SYNK 운영 사본 갱신 \| Ready/, '미리 모은 예약 상태를 넣는다');
  assert.match(지시, /아무것도 고치지 않습니다/);
  assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, '같은 요청은 다시 집지 않는다');
  const 답 = JSON.stringify({ items: [
    { id: 'ops-copy-task', 원인: '갱신 예약이 앞 회차 잠금에 막혔다', 해결: '주인 없는 잠금을 넘게 코드를 고친다', 상태: 'AI가 고칠 수 있음' },
    { id: '모르는-알림', 원인: '지어낸 줄', 해결: '버려야 한다', 상태: '유호님 차례' },
  ], note: '' });
  const 사후 = await f.작업.사후({ 글: '끝났습니다.\n' + 답, 비용: 1.2 }, 자료, { 경로: '크레딧' });
  assert.deepEqual(사후, { 항목: 1, 유호님차례: 0 });
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.equal(진단.items.length, 1, '요청에 없는 id는 버린다');
  assert.equal(진단.items[0].incident, 'i1', '물은 사건을 적어 다른 사건에 붙지 않게 한다');
  assert.doesNotMatch(monitor.digestText({ ...f.묶음, items: [{ ...f.묶음.items[0], incident: 'i2' }] }, 진단), /앞 회차 잠금/, '새 사건에는 붙지 않는다');
  const 글 = monitor.digestText(f.묶음, 진단);
  assert.match(글, /원인: 갱신 예약이 앞 회차 잠금에 막혔다/);
  assert.match(글, /해결: AI가 고칠 수 있어요\. 주인 없는 잠금을/);
  assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, '진단이 있으면 할 일이 없다');
});

test('진단 실행은 고쳤다고 말할 수 없다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  await f.작업.사후({ 글: JSON.stringify({ items: [{ id: 'ops-copy-task', 원인: 'x', 해결: '고쳐 올렸다', 상태: '고침' }], note: '' }) }, 자료, {});
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.equal(진단.items[0].state, '확인 필요');
  assert.doesNotMatch(monitor.digestText(f.묶음, 진단), /고친 것|고쳐 올렸다/, '고쳤다는 말이 본문에 없다');
});

test('도구를 하나도 주지 않고 크레딧으로만 돈다', () => {
  const f = 준비();
  const 인자 = f.작업.인자();
  assert.equal(인자[인자.indexOf('--tools') + 1], '', '도구를 모두 끈다');
  assert.equal(인자[인자.indexOf('--disallowedTools') + 1], 'mcp__*');
  assert.equal(인자[인자.indexOf('--mcp-config') + 1], '{"mcpServers":{}}');
  assert.ok(인자.includes('--strict-mcp-config') && 인자.includes('--disable-slash-commands'));
  assert.equal(인자[인자.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.deepEqual(JSON.parse(인자[인자.indexOf('--settings') + 1]), 설정);
  assert.deepEqual(설정.permissions.allow, [], '경로 없는 Read 허용은 폴더 밖에도 적용된다');
  for (const 막음 of ['Read', 'Glob', 'Grep', 'Bash', 'PowerShell', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'Task']) assert.ok(설정.permissions.deny.includes(막음), 막음);
  assert.equal(f.작업.구독대체, false);
});

test('지시문에 감시 설명과 걸리는 예약 줄을 넣는다', async () => {
  assert.match(감시설명(), /^## 오늘 확인/);
  assert.match(예약설명(['ops-copy-task']), /운영 사본 갱신/);
  assert.equal(예약설명(['모르는-종류']), '');
  const f = 준비();
  const 지시 = f.작업.지시문(await f.작업.사전확인({ 방: f.방 }));
  assert.match(지시, /도구가 없으므로 아래 글만으로 판단합니다/);
  assert.match(지시, /SYNK 운영 사본 갱신/);
  assert.ok(지시.length < 40000, '지시문 길이 ' + 지시.length);
});

test('예약 상태는 가린 글로 넣고 못 읽으면 빈 글이다', () => {
  assert.equal(예약상태(() => ({ code: 0, stdout: 'SYNK x | Ready | founder@synk.im\n' })), 'SYNK x | Ready | [계정]');
  assert.equal(예약상태(() => ({ code: 1, stdout: 'x' })), '');
  assert.equal(예약상태(() => { throw new Error('없음'); }), '');
  assert.equal(예약상태(undefined), '');
});

test('백업 상태는 칸마다 한 줄로 줄이고 못 읽으면 빈 글이다', () => {
  const 파일 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'synk-backup-')), 'backup-health.json');
  fs.writeFileSync(파일, JSON.stringify({ checkedAt: '2026-11-25T12:00:00Z', status: 'pending', components: Array.from({ length: 12 }, (_, i) => ({ id: 'c' + i, label: '칸 ' + i, status: i ? 'ok' : 'failed',
    lastSuccessAt: '2026-11-24T03:10:00Z', codes: i ? [] : ['LATE'], receiptPath: 'C:/비밀/길', scope: '긴 글 '.repeat(200) })) }));
  const 글 = 백업상태(파일);
  assert.match(글, /backup-c0 \| 칸 0 \| failed \| .*마지막 성공 2026-11-24T03:10:00Z \| LATE/);
  assert.match(글, /backup-c11 /, '끝 칸까지 남는다');
  assert.doesNotMatch(글, /비밀|긴 글/);
  fs.writeFileSync(파일, '{ 끊긴');
  assert.equal(백업상태(파일), '');
});

const 실패영수증 = { status: 'partial_failure', startedAt: '2026-11-24T20:30:01Z', finishedAt: '2026-11-24T22:17:06Z', steps: [
  { id: 'hermes', label: '헤르메스 백업', status: 'success' }, { id: 'argon', label: '조사 서버 상태 암호화 백업', status: 'failed', code: 'ARGON_DOC_MAPPING_CHANGED', metrics: 'C:/비밀/길' }] };
const 실패줄 = 'argon | 조사 서버 상태 암호화 백업 | failed | ARGON_DOC_MAPPING_CHANGED';

test('백업 영수증은 알림이 가리키는 것의 실패한 단계만 싣는다', () => {
  const 창고 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-receipts-'));
  const 쓰기 = (이름, 값) => fs.writeFileSync(path.join(창고, 이름), JSON.stringify(값));
  쓰기('backup-status.json', 실패영수증);
  // 업무 문서만 따로 돌린 결과는 제 영수증에만 남는다
  쓰기('workspace-backup-status.json', { ...실패영수증, steps: [{ id: 'group-4-verify', label: 'workspace-백업 대조', status: 'failed', code: 'VERIFY_MISMATCH' }] });
  const 서버 = 백업영수증(['backup-server', 'ops-copy'], 창고), 문서 = 백업영수증(['backup-workspace'], 창고);
  assert.deepEqual(서버.split('\n'), ['매일 백업 · 시작 2026-11-24T20:30:01Z · 끝 2026-11-24T22:17:06Z · partial_failure', 실패줄]);
  assert.deepEqual(문서.split('\n').slice(1), ['group-4-verify | workspace-백업 대조 | failed | VERIFY_MISMATCH']);
  assert.equal(백업영수증(['backup-server', 'backup-workspace'], 창고), 서버 + '\n' + 문서);
  assert.equal(백업영수증(['backup-media', 'ops-copy'], 창고), '');
  // 영수증이 running이면 지금 도는 것인지 끊긴 것인지 감시로 가른다
  const 감시 = (status, checkedAt) => 쓰기('backup-health.json', { schemaVersion: 1, checkedAt, components: [{ id: 'server', status }] });
  쓰기('backup-status.json', { status: 'running', startedAt: '2026-11-25T00:00:00Z', steps: [{ id: 'workspace', label: '업무 문서', status: 'success' },
    { id: 'retention', label: '보존 규칙', status: 'running' }] });
  감시('interrupted', '2026-11-25T00:30:00Z');
  assert.deepEqual(백업영수증(['backup-server'], 창고).split('\n'), ['매일 백업 · 시작 2026-11-25T00:00:00Z · 끝 없음 · 끊김', 'retention | 보존 규칙 | 여기서 끊김 | 코드 없음'], 'PC를 다시 켜서 끊긴 회차');
  for (const [status, checkedAt, 까닭] of [['running', '2026-11-25T00:30:00Z', '감시가 도는 중이라고 한다'], ['interrupted', '2026-11-24T23:50:00Z', '감시가 본 뒤에 시작했다']]) {
    감시(status, checkedAt);
    assert.equal(백업영수증(['backup-server'], 창고), '매일 백업 · 시작 2026-11-25T00:00:00Z · 끝 없음 · 지금 도는 중', 까닭);
  }
  // 예약 실패만 본 칸, 칸이 빠진 감시, 못 읽은 감시로는 끊겼다고 하지 않는다
  const 모름 = ['매일 백업 · 시작 2026-11-25T00:00:00Z · 끝 없음 · 도는지 확인 불가', 'retention | 보존 규칙 | 도는지 확인 불가 | 코드 없음'];
  감시('attention', '2026-11-25T00:30:00Z');
  assert.deepEqual(백업영수증(['backup-server'], 창고).split('\n'), 모름);
  쓰기('backup-health.json', { schemaVersion: 1, checkedAt: '2026-11-25T00:30:00Z', components: [] });
  assert.deepEqual(백업영수증(['backup-server'], 창고).split('\n'), 모름);
  fs.rmSync(path.join(창고, 'backup-health.json'));
  assert.deepEqual(백업영수증(['backup-server'], 창고).split('\n'), 모름);
  fs.writeFileSync(path.join(창고, 'backup-status.json'), '{ 끊긴');
  assert.equal(백업영수증(['backup-server'], 창고), '');
});

test('운영 사본 기록은 저장소 경로와 정해진 까닭만 싣고, 오류 글의 경로와 계정 이름은 넣지 않는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-evidence-'));
  const 멈춘글 = '운영 사본에서 고친 파일이 1개 있어 따라가지 않았다 — git -C "C:\\Users\\계정이름\\AppData\\Local\\synk\\ops" checkout -- <파일>로 되돌린다';
  fs.writeFileSync(path.join(방, '상태.json'), JSON.stringify({ state: 'stopped', reasonKey: '고친 파일', reason: 멈춘글, unpushedSince: '2026-11-22T20:39:22Z',
    unpushed: ['docs/마케팅/편/게시/작업실.json', 'docs/_ops/장부.jsonl', 'docs/_ops/둘.jsonl'] }));
  fs.writeFileSync(path.join(방, '남은장부.json'), JSON.stringify({ paths: { 'docs/_ops/장부.jsonl': { 시각: 'x', 이유: 멈춘글 }, 'docs/_ops/둘.jsonl': { 시각: 'x', 이유: '올리는 중 — 여기서 끊기면' } } }));
  assert.deepEqual(운영기록(방).split('\n'), ['상태 stopped · 멈춘 까닭 고친 파일 · 처음 확인 2026-11-22T20:39:22Z', 'docs/마케팅/편/게시/작업실.json | 다시 올리는 목록에 없음',
    'docs/_ops/장부.jsonl | 못 올려 다시 올리는 목록에 있음', 'docs/_ops/둘.jsonl | 올리다 끊겨 다시 올리는 목록에 있음']);
  assert.equal(운영기록(path.join(방, '없음')), '');
  fs.writeFileSync(path.join(방, '상태.json'), JSON.stringify({ state: 'ok' }));
  assert.equal(운영기록(방), '', '목록이 없으면 빈 글');
});

test('다시 시작하기 전의 실패 단계를 진단에 남기고, 시작하지 못한 것은 다시 돌렸다고 쓰지 않는다', async () => {
  const f = 준비(), 창고 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-receipts-')), 영수증 = path.join(창고, 'backup-status.json');
  f.묶음.items.push({ id: 'backup-server', incident: 'i2', title: 'PC 백업', detail: '일부 실패' });
  fs.writeFileSync(path.join(f.자리, 'diagnosis/request.json'), JSON.stringify(f.묶음));
  fs.writeFileSync(영수증, JSON.stringify(실패영수증));
  let 남긴;
  // 백업은 시작하자마자 영수증을 새 회차 것으로 덮는다
  const 되살리기 = ({ 방, 증거 }) => {
    남긴 = { 예약: 'SYNK 매일 백업', 칸: ['server'], 코드: ['BACKUP_PARTIAL_FAILURE'], 앞영수증: 증거(['server']), 시각: f.지금.toISOString(), 결과: '시작함' };
    fs.writeFileSync(path.join(방, '되살리기.json'), JSON.stringify({ 회차: [남긴, { ...남긴, 예약: 'SYNK 미디어 원본 백업', 앞영수증: '', 결과: '시작하지 못함' }] }));
    fs.writeFileSync(영수증, JSON.stringify({ status: 'running', startedAt: '2026-11-25T00:10:00Z', steps: [{ id: 'drive-index', label: 'Drive 목록 기준', status: 'running' }] }));
    return 남긴;
  };
  const 작업 = 만들기({ 집고정: f.집, 지금고정: f.지금, 창고, 되살리기 });
  const 자료 = await 작업.사전확인({ 방: f.방, 실행: () => ({ code: 0, stdout: '' }) });
  assert.match(남긴.앞영수증, /ARGON_DOC_MAPPING_CHANGED/);
  assert.equal(자료.백업영수증.split('\n')[1], 실패줄, '다시 시작하기 전에 읽은 영수증');
  const 지시 = 작업.지시문(자료);
  assert.doesNotMatch(지시, /drive-index/, '진행 중인 단계를 실패로 싣지 않는다');
  assert.match(지시, /다시 시작하려 한 백업 예약[^\n]*결과가 「시작함」인 것만 다시 돌았다/);
  assert.match(지시, /SYNK 매일 백업 · 결과 시작함 · 까닭 BACKUP_PARTIAL_FAILURE\n  다시 시작하기 전 영수증: 매일 백업 · .* \/ argon \| 조사 서버/);
  assert.match(지시, /SYNK 미디어 원본 백업 · 결과 시작하지 못함/);
  assert.doesNotMatch(지시, /이미 다시 돌린/);
  // 마른 실행은 실제 작업이 쓰는 방에서 되살린 기록을 읽고, 시도는 제 방에만 쓴다
  const g = 준비(), 마른방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alert-fix-dry-'));
  const 마른 = await 만들기({ 집고정: g.집, 지금고정: g.지금, 되살리기: null, 되살린방: f.방 }).사전확인({ 방: 마른방 });
  assert.deepEqual(마른.되살린기록.map((x) => x.예약), ['SYNK 매일 백업', 'SYNK 미디어 원본 백업']);
  assert.ok(fs.existsSync(path.join(마른방, '시도.json')));
});

test('되살리고 증거를 모으는 동안 기다림이 끝났으면 크레딧을 쓰지 않는다', async () => {
  // 마감 10분 앞에서 시작해 되살리기가 10분 걸렸다
  const f = 준비({ 남은분: 12 });
  let 때 = +f.지금;
  const 늦은 = 만들기({ 집고정: f.집, 지금고정: () => new Date(때), 되살리기: () => { 때 += 10 * 60000; return { 이유: '다시 돌릴 백업 없음' }; } });
  const r = await 늦은.사전확인({ 방: f.방, 실행: () => ({ code: 0, stdout: '' }) });
  assert.equal(r.할일, false);
  assert.match(r.이유, /증거를 모으는 동안 기다림이 끝남 · 되살리기: 다시 돌릴 백업 없음/);
  assert.equal(fs.existsSync(path.join(f.방, '시도.json')), false, '집지 않은 것으로 남는다');
  // 예약을 조회하는 동안 감시가 그날을 닫았다
  const g = 준비();
  const 닫힘 = await g.작업.사전확인({ 방: g.방, 실행: () => {
    fs.writeFileSync(path.join(g.자리, 'state.json'), JSON.stringify({ digest: { day: g.묶음.day, id: g.묶음.id, status: 'done' } }));
    return { code: 0, stdout: '' };
  } });
  assert.equal(닫힘.할일, false);
  assert.equal(fs.existsSync(path.join(g.방, '시도.json')), false);
});

test('빈 답은 진단으로 치지 않고 실패 안내를 남긴다', async () => {
  for (const 글 of ['{}', '{"items":[]}', '{"items":[{"id":"ops-copy-task"}]}']) {
    const f = 준비();
    const 자료 = await f.작업.사전확인({ 방: f.방 });
    await f.작업.사후({ 글, 비용: 0.1 }, 자료, {});
    const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
    assert.match(monitor.digestText(f.묶음, 진단), /결과를 내지 못했어요/, 글);
  }
});

test('답에 섞인 비밀 꼴은 본문에 싣지 않는다', async () => {
  const 토큰 = '123456789:' + 'AbCd'.repeat(8);
  assert.equal(답가리기('토큰 ' + 토큰 + ' 끝', 200), '토큰 [인증값] 끝');
  assert.equal(답가리기('SYNK 운영 사본 갱신 예약을 다시 켠다', 200), 'SYNK 운영 사본 갱신 예약을 다시 켠다');
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  await f.작업.사후({ 글: JSON.stringify({ items: [{ id: 'ops-copy-task', 원인: '값 ' + 토큰, 해결: '키 ' + 'a1'.repeat(24), 상태: '확인 필요' }], note: '덧붙임 ' + 토큰 }) }, 자료, {});
  const 글 = monitor.digestText(f.묶음, monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id));
  assert.ok(!글.includes(토큰) && !글.includes('a1'.repeat(24)), '본문에 비밀 꼴이 없다');
});

test('답을 못 읽어도 진단 파일을 남겨 알림이 기다리지 않게 한다', async () => {
  const f = 준비();
  const 자료 = await f.작업.사전확인({ 방: f.방 });
  await f.작업.사후({ 글: '중간에 끊겼습니다', 비용: 0.3 }, 자료, {});
  const 진단 = monitor.readDiagnosis(path.join(f.집, 'runtime/synk-automation'), f.묶음.id);
  assert.deepEqual(진단.items, []);
  assert.match(monitor.digestText(f.묶음, 진단), /결과를 내지 못했어요/);
});

test('곧 그대로 나갈 요청, 이미 보낸 요청, 꼴이 다른 요청은 집지 않는다', async () => {
  const 곧 = 준비({ 남은분: 5 });
  assert.equal((await 곧.작업.사전확인({ 방: 곧.방 })).할일, false);
  const 보냄 = 준비();
  fs.writeFileSync(path.join(보냄.보낼곳, 보냄.묶음.id + '.claim'), 'sent');
  assert.equal((await 보냄.작업.사전확인({ 방: 보냄.방 })).할일, false);
  for (const 바꿈 of [{ version: 2 }, { id: '../밖' }, { items: [] }]) {
    const f = 준비();
    fs.writeFileSync(path.join(f.자리, 'diagnosis/request.json'), JSON.stringify({ ...f.묶음, ...바꿈 }));
    assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, JSON.stringify(바꿈));
  }
  // 감시가 그날을 닫았거나 이미 보내는 중이면 크레딧을 쓰지 않는다.
  for (const 상태 of [{ digest: { id: 보냄.묶음.id, status: 'done' } }, { digest: { id: 보냄.묶음.id, status: 'sending' } }, { digest: { id: 'event-' + '0'.repeat(24), status: 'waiting' } }, {}]) {
    const f = 준비();
    fs.writeFileSync(path.join(f.자리, 'state.json'), JSON.stringify(상태));
    assert.equal((await f.작업.사전확인({ 방: f.방 })).할일, false, JSON.stringify(상태));
  }
  const 없음 = 준비();
  fs.rmSync(path.join(없음.자리, 'diagnosis/request.json'));
  assert.equal((await 없음.작업.사전확인({ 방: 없음.방 })).할일, false);
});
