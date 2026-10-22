'use strict';

// 예약 멈춤 — 앱 데이터·대화 원문·실행 중 CLI·승인 기록·편 폴더는 모두 임시 폴더의 가짜다. 텔레그램은 보내지 않고
// (SYNK_TG_DRYRUN_DIR), 앱 로그는 읽지 않으며(로그파일들: []), 시각은 KST(오프셋 540분)로 못박는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 멈춤 = require('../tools/예약멈춤.js');

const KST = (s) => Date.parse(`${s}+09:00`);
const iso = (ms) => new Date(ms).toISOString();
const 분 = 60e3;
const 텔레그램명령 = '& "C:/Users/q1212/AppData/Local/hermes/bin/hermes.exe" send -t telegram:1 -f .tmp/알림.txt 2>&1';
const 줄 = {
  사용자: (t, 글) => ({ type: 'user', timestamp: iso(t), message: { role: 'user', content: 글 } }),
  호출: (t, id, 명령) => ({ type: 'assistant', timestamp: iso(t), message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'PowerShell', input: { command: 명령 } }] } }),
  결과: (t, id, 글, is_error = false) => ({ type: 'user', timestamp: iso(t), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 글, is_error }] } }),
  답: (t, 글) => ({ type: 'assistant', timestamp: iso(t), message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 글 }] } }),
  끝: (t) => ({ type: 'system', subtype: 'stop_hook_summary', timestamp: iso(t) }),
  한도: (t, 글) => ({ type: 'assistant', timestamp: iso(t), isApiErrorMessage: true, message: { role: 'assistant', model: '<synthetic>', stop_reason: 'stop_sequence', content: [{ type: 'text', text: 글 }] } }),
};

/** 임시 판 — 계정 폴더 하나(acct/org), 원문·실행 중·승인·지시문·편 폴더, 상태 파일, 가짜 텔레그램 폴더. */
function 판() {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '예약멈춤-'));
  const p = {
    뿌리,
    세션: path.join(뿌리, 'sessions', 'acct', 'org'),
    집: path.join(뿌리, 'claude'),
    실행중: path.join(뿌리, 'registry'),
    승인: path.join(뿌리, 'approvals'),
    마케팅: path.join(뿌리, '마케팅'),
    보낸글: path.join(뿌리, 'tg'),
    상태: path.join(뿌리, '상태.json'),
    번호: 0,
  };
  for (const d of [p.세션, p.집, p.실행중, p.승인, p.마케팅]) fs.mkdirSync(d, { recursive: true });
  p.환경 = {
    SYNK_CLAUDE_SESSIONS: path.join(뿌리, 'sessions'), CLAUDE_CONFIG_DIR: p.집, SYNK_CLAUDE_REGISTRY: p.실행중,
    SYNK_APPROVAL_DIR: p.승인, SYNK_예약멈춤_마케팅: p.마케팅, SYNK_TG_DRYRUN_DIR: p.보낸글, SYNK_예약멈춤_상태: p.상태,
  };
  return p;
}

/** 작업 정의(scheduled-tasks.json)와 지시문. 텔레그램 단계·편 브랜드가 지시문에 있으면 감시가 읽는다. */
function 정의쓰기(p, 작업들, 건너뜀 = {}) {
  const 목록 = 작업들.map(({ 텔레그램 = true, 브랜드 = null, ...t }) => {
    const 파일 = path.join(p.집, 'scheduled-tasks', t.id, 'SKILL.md');
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    fs.writeFileSync(파일, [`# ${t.id}`, 브랜드 ? `기획.md 첫 줄: 「1일 1편 · ${브랜드} · <만든 날 YYYY-MM-DD> · 슬롯 …」` : '',
      텔레그램 ? `3. 텔레그램: \`"C:/Users/q1212/AppData/Local/hermes/bin/hermes.exe" send -t telegram:1 -f <파일>\`` : '4. 한국어로 보고한다.'].join('\n'));
    return { displayName: `【매일】 ${t.id}`, cronExpression: '0 7 * * *', enabled: true, createdAt: KST('2026-10-21T12:00:00'), filePath: 파일, ...t };
  });
  fs.writeFileSync(path.join(p.세션, 'scheduled-tasks.json'), JSON.stringify({ scheduledTasks: 목록, recordedSkips: 건너뜀 }));
}

/** 실행 세션 기록 하나와 그 대화 원문. 돌려주는 값은 기록(sessionId·cliSessionId). */
function 실행쓰기(p, 작업, 시작, 원문줄들, 덧 = {}, 폴더 = p.세션) {
  p.번호 += 1;
  const n = String(p.번호).padStart(12, '0');
  const 기록 = { sessionId: `local_00000000-0000-4000-8000-${n}`, cliSessionId: `11111111-0000-4000-8000-${n}`, cwd: 'C:\\work\\repo',
    createdAt: 시작, lastActivityAt: 시작, title: `【매일】 ${작업}`, scheduledTaskId: 작업, isArchived: false, ...덧 };
  fs.mkdirSync(폴더, { recursive: true });
  fs.writeFileSync(path.join(폴더, `${기록.sessionId}.json`), JSON.stringify(기록));
  if (원문줄들) {
    const 원문 = path.join(p.집, 'projects', 기록.cwd.replace(/[^A-Za-z0-9]/g, '-'), `${기록.cliSessionId}.jsonl`);
    fs.mkdirSync(path.dirname(원문), { recursive: true });
    fs.writeFileSync(원문, 원문줄들.map((x) => JSON.stringify(x)).join('\n') + '\n');
  }
  return 기록;
}

const 정상끝 = (시작, 끝) => [줄.사용자(시작, '예약 작업 지시문'), 줄.호출(끝 - 3 * 분, 'toolu_tg', 텔레그램명령), 줄.결과(끝 - 2 * 분, 'toolu_tg', 'sent\r\n'), 줄.답(끝, '보고: 편을 만들었습니다'), 줄.끝(끝 + 500)];
const 읽기 = (p, 지금ms, 덧 = {}) => 멈춤.지금읽기({ 환경: p.환경, 지금ms, 오프셋분: 540, 살았나판: () => true, 로그파일들: [], ...덧 });
const 알리기 = (p, 지금ms, 덧 = {}) => 멈춤.알림({ 환경: p.환경, 지금ms, 오프셋분: 540, 살았나판: () => true, 로그파일들: [], ...덧 });
const 회차때표 = (x) => `${new Date((x.예정 ?? x.시작) + 540 * 분).toISOString().slice(5, 16).replace('T', ' ')} ${x.예정 != null ? '회차' : '실행'}`;
const 보낸것 = (p) => (fs.existsSync(p.보낸글) ? fs.readdirSync(p.보낸글).sort().map((f) => fs.readFileSync(path.join(p.보낸글, f), 'utf8')) : []);

test('예정들 — 이 PC 시간대로 cron을 읽고, 요일 7은 일요일, 날짜·요일을 둘 다 정하면 어느 하나, 걸음·범위도 읽는다', () => {
  const 오 = () => 540;
  const 날 = (식, 부터, 까지) => 멈춤.예정들(식, KST(부터), KST(까지), 오).map((t) => new Date(t + 540 * 분).toISOString().slice(0, 16));
  assert.deepEqual(날('0 7 * * *', '2026-10-21T06:00:00', '2026-10-22T07:00:00'), ['2026-10-21T07:00', '2026-10-22T07:00']);
  assert.deepEqual(날('30 9 * * 1', '2026-10-19T00:00:00', '2026-10-27T00:00:00'), ['2026-10-19T09:30', '2026-10-26T09:30']); // 월요일
  assert.deepEqual(날('0 10 * * 7', '2026-10-18T00:00:00', '2026-10-19T00:00:00'), ['2026-10-18T10:00']); // 10-18은 일요일
  assert.deepEqual(날('0 10 1 * 5', '2026-10-29T00:00:00', '2026-11-02T00:00:00'), ['2026-10-30T10:00', '2026-11-01T10:00']); // 금요일 또는 1일
  assert.deepEqual(날('*/20 8-9 * * *', '2026-10-22T07:59:00', '2026-10-22T09:59:00'), ['2026-10-22T08:00', '2026-10-22T08:20', '2026-10-22T08:40', '2026-10-22T09:00', '2026-10-22T09:20', '2026-10-22T09:40']);
  assert.throws(() => 멈춤.cron읽기('0 7 * *'), /다섯 칸/);
  assert.throws(() => 멈춤.cron읽기('61 7 * * *'), /못 읽었다/);
});

test('정상 끝남 — 차례가 끝났고 텔레그램을 보냈으면 알리지 않는다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab', 브랜드: 'LAB' }]);
  실행쓰기(p, 'synk-daily-lab', KST('2026-10-22T07:11:00'), 정상끝(KST('2026-10-22T07:11:00'), KST('2026-10-22T08:30:00')),
    { lastActivityAt: KST('2026-10-22T08:30:00'), postTurnSummary: { status_category: 'blocked', needs_action: '「올려」' } });
  const r = 읽기(p, KST('2026-10-22T13:00:00'));
  assert.equal(r.상태, '읽음');
  assert.equal(r.회차들.length, 1);
  assert.equal(r.회차들[0].판정.종류, '끝남');
  assert.equal(r.회차들[0].판정.텔레그램, true);
  assert.equal(알리기(p, KST('2026-10-22T13:00:00')).결과, '바뀐 것 없음');
  assert.deepEqual(보낸것(p), []);
  assert.match(멈춤.상태글(r), /✓ 【매일】 synk-daily-lab — 10-22 07:00 회차 · 끝남 · 텔레그램 보냄 · 마지막 활동 10-22 08:3/);
});

test('한도 멈춤 — 바로 한 통(한도 문구·마지막 활동·그날 편 사실), 같은 날은 다시 안 보내고 다음 날 회차는 다시 알린다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-yuhobuilds', cronExpression: '10 7 * * *', 브랜드: 'yuhobuilds' }]);
  fs.mkdirSync(path.join(p.마케팅, 'yuhobuilds_세션공유_20261022'), { recursive: true });
  fs.writeFileSync(path.join(p.마케팅, 'yuhobuilds_세션공유_20261022', '기획.md'), '1일 1편 · yuhobuilds · 2026-10-22 · 슬롯 2026-10-23 · 시의성\n본문');
  const 시작 = KST('2026-10-22T07:20:00');
  실행쓰기(p, 'synk-daily-yuhobuilds', 시작, [줄.사용자(시작, '지시문'), 줄.호출(시작 + 20 * 분, 'toolu_1', 'node tools/올리기전검사.js'), 줄.결과(시작 + 21 * 분, 'toolu_1', '고칠 것 0'),
    줄.한도(시작 + 28 * 분, "You've hit your session limit · resets 12:10pm (Asia/Seoul)")],
  { lastActivityAt: 시작 + 28 * 분, error: "You've hit your session limit · resets 12:10pm (Asia/Seoul)", errorAt: 시작 + 28 * 분, lastTurnCutShort: true });
  const 지금 = KST('2026-10-22T07:50:00');
  const r = 알리기(p, 지금);
  assert.equal(r.결과, '보냄');
  const [글] = 보낸것(p);
  assert.match(글, /^⏸ 앱 예약 작업이 끝 보고 없이 멈춘 것 같습니다/);
  assert.match(글, /【매일】 synk-daily-yuhobuilds — 10-22 07:10 회차 · 멈춤 · 사용량 한도로 끊김 「You've hit your session limit · resets 12:10pm/);
  assert.match(글, /마지막 활동 10-22 07:48/);
  assert.match(글, /그날 yuhobuilds 편 기획만 1편\(준비\.json 없음\)/);
  assert.match(글, /다시 깨우려면 \/이어서 \(한도로 끊긴 것은 풀린 뒤에\)/);
  // 같은 날 10분 뒤 — 이미 알렸다
  assert.equal(알리기(p, 지금 + 10 * 분).결과, '바뀐 것 없음');
  // 다음 날 회차도 한도로 멈추면 다시 한 통
  const 다음 = KST('2026-10-23T07:21:00');
  실행쓰기(p, 'synk-daily-yuhobuilds', 다음, [줄.사용자(다음, '지시문'), 줄.한도(다음 + 5 * 분, "You've hit your session limit · resets 11:00am (Asia/Seoul)")],
    { lastActivityAt: 다음 + 5 * 분, error: "You've hit your session limit · resets 11:00am (Asia/Seoul)", errorAt: 다음 + 5 * 분 });
  assert.equal(알리기(p, 다음 + 15 * 분).결과, '보냄');
  assert.equal(보낸것(p).length, 2);
  assert.match(보낸것(p)[1], /10-23 07:10 회차/);
  assert.doesNotMatch(보낸것(p)[1], /10-22 07:10 회차/);
});

test('앱 재시작으로 끊긴 차례 — 첫 회차는 지켜보고, 9분 넘게 그대로면 한 통. 그사이 움직이면 알리지 않는다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab' }, { id: 'synk-daily-synkbrief', cronExpression: '5 7 * * *' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  const 끊긴줄 = [줄.사용자(시작, '지시문'), 줄.호출(시작 + 40 * 분, 'toolu_r', 'npx remotion render …')];
  실행쓰기(p, 'synk-daily-lab', 시작, 끊긴줄, { lastActivityAt: 시작 + 40 * 분 });
  const 다른 = 실행쓰기(p, 'synk-daily-synkbrief', 시작, 끊긴줄, { lastActivityAt: 시작 + 40 * 분 });
  const 지금 = KST('2026-10-22T09:00:00');
  assert.equal(알리기(p, 지금).결과, '바뀐 것 없음');
  // 9분 안에 synkbrief 원문이 다시 움직였다(누가 /이어서를 보냈다)
  const 원문 = path.join(p.집, 'projects', 'C--work-repo', `${다른.cliSessionId}.jsonl`);
  fs.appendFileSync(원문, [줄.사용자(지금 + 5 * 분, '이어서 해'), 줄.호출(지금 + 6 * 분, 'toolu_s', 'node 다시.js')].map((x) => JSON.stringify(x)).join('\n') + '\n');
  const r = 알리기(p, 지금 + 10 * 분);
  assert.equal(r.결과, '보냄');
  const [글] = 보낸것(p);
  assert.match(글, /synk-daily-lab — 10-22 07:00 회차 · 멈춤 · 앱 재시작·계정 전환으로 끊김/);
  assert.doesNotMatch(글, /synkbrief/); // 움직였으니 다시 9분을 센다
  assert.equal(알리기(p, 지금 + 20 * 분).결과, '보냄'); // synkbrief도 그 뒤 9분 넘게 그대로라 따로 한 통
  assert.match(보낸것(p)[1], /synk-daily-synkbrief/);
});

test('일하는 중 — CLI가 busy로 살아 있으면 조용해도 3시간까지는 도는 중, 넘으면 지켜본 뒤 알린다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  const r0 = 실행쓰기(p, 'synk-daily-lab', 시작, [줄.사용자(시작, '지시문'), 줄.호출(시작 + 10 * 분, 'toolu_w', 'node 긴작업.js')], { lastActivityAt: 시작 });
  fs.writeFileSync(path.join(p.실행중, '4242.json'), JSON.stringify({ pid: 4242, hostSessionId: r0.sessionId, status: 'busy' }));
  assert.equal(읽기(p, KST('2026-10-22T09:30:00')).회차들[0].판정.종류, '도는 중');
  // 프로세스가 죽었으면(살았나 거짓) 같은 원문은 끊긴 차례다
  assert.equal(읽기(p, KST('2026-10-22T09:30:00'), { 살았나판: () => false }).회차들[0].판정.종류, '멈춤');
  const 늦게 = KST('2026-10-22T10:30:00');
  assert.match(읽기(p, 늦게).회차들[0].판정.까닭, /3시간 9분 동안 움직임 없음\(CLI는 일하는 중으로 떠 있음\)/);
  assert.equal(알리기(p, 늦게).결과, '바뀐 것 없음');
  assert.equal(알리기(p, 늦게 + 10 * 분).결과, '보냄');
});

test('시작 안 함 — 예정 2시간 뒤에도 세션이 없으면 지켜본 뒤 한 통. 앱이 띄웠다는 기록이 있거나 2시간 안이면 알리지 않는다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-publish', cronExpression: '0 14 * * *', displayName: '【매일 14:00】 예약 큐', createdAt: KST('2026-10-22T00:00:00') }]);
  assert.equal(읽기(p, KST('2026-10-22T15:30:00')).회차들[0].판정.종류, '아직');
  const 지금 = KST('2026-10-22T16:30:00');
  assert.equal(알리기(p, 지금).결과, '바뀐 것 없음');
  assert.equal(알리기(p, 지금 + 10 * 분).결과, '보냄');
  const [글] = 보낸것(p);
  assert.match(글, /【매일 14:00】 예약 큐 — 10-22 14:00 회차 · 시작 안 함 · 시작하지 않았습니다\(그 시각에 PC·앱이 꺼져 있었거나 잠자기였을 수 있음\)/);
  assert.match(글, /「지금 실행」/);
  assert.doesNotMatch(글, /\/이어서/);
  const q = 판();
  정의쓰기(q, [{ id: 'synk-daily-publish', cronExpression: '0 14 * * *', createdAt: KST('2026-10-22T00:00:00'), lastScheduledFor: iso(KST('2026-10-22T14:00:00')) }]);
  assert.equal(읽기(q, 지금).회차들[0].판정.종류, '모름');
  // 앱 설정에서 Code 탭 예약 작업을 꺼 두었으면 그 까닭을 쓴다(PC가 꺼져 있었다고 하지 않는다)
  fs.writeFileSync(path.join(p.뿌리, 'claude_desktop_config.json'), JSON.stringify({ preferences: { ccdScheduledTasksEnabled: false } }));
  assert.match(읽기(p, 지금).회차들[0].판정.까닭, /앱 설정에서 예약 작업이 꺼져 있습니다/);
  // 앱이 그 회차를 건너뛰었다고 적었으면(recordedSkips) 그 까닭을 쓴다
  const r = 판();
  정의쓰기(r, [{ id: 'synk-daily-publish', cronExpression: '0 14 * * *', createdAt: KST('2026-10-22T00:00:00') }],
    { 'synk-daily-publish': [{ at: KST('2026-10-21T14:03:00'), reason: 'global_limit' }, { at: KST('2026-10-22T14:04:00'), reason: 'per_task_limit' }] });
  assert.equal(읽기(r, 지금).회차들[0].판정.까닭, '시작하지 않았습니다 — 앱이 건너뜀: 같은 작업이 아직 돌고 있었다');
});

test('보고 없음 — 텔레그램 단계가 있는 작업이 텔레그램 없이 차례를 끝내고 2시간 조용하면 알린다. 권한 알림·완료 요약·텔레그램 단계 없는 작업은 빼고', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', 텔레그램: false }, { id: 'e' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  const 끝 = KST('2026-10-22T08:00:00');
  const 텔레그램없이 = [줄.사용자(시작, '지시문'), 줄.답(끝, '확인할 것이 있어 멈춥니다. 어느 쪽으로 할까요?'), 줄.끝(끝 + 500)];
  const 기다림 = { status_category: 'blocked', status_detail: '두 안 가운데 고르기 대기', needs_action: '두 안 가운데 하나 고르기' };
  실행쓰기(p, 'a', 시작, 텔레그램없이, { lastActivityAt: 끝, postTurnSummary: 기다림 });
  const b = 실행쓰기(p, 'b', 시작, 텔레그램없이, { lastActivityAt: 끝, postTurnSummary: 기다림 });
  fs.writeFileSync(path.join(p.승인, `${b.cliSessionId}.json`), JSON.stringify({ state: 'notified', notice: { sent_at: iso(끝 + 30e3), message_id: '9', error: null } }));
  실행쓰기(p, 'c', 시작, 텔레그램없이, { lastActivityAt: 끝, postTurnSummary: { status_category: 'completed', needs_action: '' } });
  실행쓰기(p, 'd', 시작, 텔레그램없이, { lastActivityAt: 끝, postTurnSummary: 기다림 });
  // e — 텔레그램을 불렀지만 실패했다(stderr의 「hermes send: …」)
  실행쓰기(p, 'e', 시작, [줄.사용자(시작, '지시문'), 줄.호출(끝 - 분, 'toolu_e', 텔레그램명령), 줄.결과(끝 - 30e3, 'toolu_e', 'hermes send: telegram unavailable'), 줄.답(끝, '보냈습니다'), 줄.끝(끝 + 500)],
    { lastActivityAt: 끝, postTurnSummary: 기다림 });
  const 판정 = (지금) => Object.fromEntries(읽기(p, 지금).회차들.map((x) => [x.작업, x.판정.종류]));
  assert.deepEqual(판정(KST('2026-10-22T09:30:00')), { a: '쉬는 중', b: '끝남', c: '끝남', d: '끝남', e: '쉬는 중' });
  const 지금 = KST('2026-10-22T10:30:00');
  assert.deepEqual(판정(지금), { a: '보고 없음', b: '끝남', c: '끝남', d: '끝남', e: '보고 없음' });
  알리기(p, 지금);
  assert.equal(알리기(p, 지금 + 10 * 분).결과, '보냄');
  const 보냄 = 보낸것(p);
  assert.equal(보냄.length, 1, '여러 작업은 한 통으로 묶는다');
  assert.match(보냄[0], /【매일】 a — 10-22 07:00 회차 · 보고 없음 · 텔레그램 끝 보고 없이 섰습니다 — 기다리는 것: 두 안 가운데 하나 고르기/);
  assert.match(보냄[0], /【매일】 e — /);
  assert.doesNotMatch(보냄[0], /【매일】 [bcd] — /);
});

test('직접 멈춤·보관됨은 알리지 않는다 — Stop 줄로 끝나고 앱 표식이 있으면 사람이 멈춘 것이다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'a' }, { id: 'b' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  실행쓰기(p, 'a', 시작, [줄.사용자(시작, '지시문'), 줄.호출(시작 + 분, 'toolu_a', 'node x.js'), 줄.결과(시작 + 2 * 분, 'toolu_a', 'ok'), 줄.사용자(시작 + 3 * 분, '[Request interrupted by user]')],
    { lastActivityAt: 시작 + 3 * 분, lastTurnCutShort: true });
  실행쓰기(p, 'b', 시작, [줄.사용자(시작, '지시문'), 줄.호출(시작 + 분, 'toolu_b', 'archive')], { lastActivityAt: 시작 + 분, isArchived: true, lastTurnCutShort: true });
  const r = 읽기(p, KST('2026-10-22T12:00:00'));
  assert.deepEqual(r.회차들.map((x) => x.판정.종류), ['직접 멈춤', '보관됨']);
  assert.equal(알리기(p, KST('2026-10-22T12:00:00')).결과, '바뀐 것 없음');
  assert.equal(알리기(p, KST('2026-10-22T12:10:00')).결과, '바뀐 것 없음');
});

test('계정 폴더 미러 — 세션마다 가장 늦게 바뀐 사본을 읽고, 예정에 안 묶인 실행(「지금 실행」)도 회차로 본다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  const r = 실행쓰기(p, 'synk-daily-lab', 시작, 정상끝(시작, 시작 + 60 * 분), { lastActivityAt: 시작 + 60 * 분 });
  const 옛사본 = path.join(p.뿌리, 'sessions', 'acct2', 'org');
  fs.mkdirSync(옛사본, { recursive: true });
  const 옛 = path.join(옛사본, `${r.sessionId}.json`);
  fs.writeFileSync(옛, JSON.stringify({ ...r, lastActivityAt: 시작, error: "You've hit your session limit · resets 9:00am", errorAt: 시작 + 분 }));
  const 예전 = new Date(Date.now() - 60 * 분);
  fs.utimesSync(옛, 예전, 예전); // 미러가 늦게 옮기기 전의 옛 사본
  실행쓰기(p, 'synk-daily-lab', KST('2026-10-22T11:00:00'), 정상끝(KST('2026-10-22T11:00:00'), KST('2026-10-22T11:30:00')), { lastActivityAt: KST('2026-10-22T11:30:00') });
  const 회차 = 읽기(p, KST('2026-10-22T12:00:00')).회차들;
  assert.deepEqual(회차.map((x) => [x.예정 != null, x.판정.종류]), [[true, '끝남'], [false, '끝남']]);
  assert.match(멈춤.상태글({ 상태: '읽음', 확인시각: iso(KST('2026-10-22T12:00:00')), 오프셋분: 540, 회차들: 회차 }), /10-22 11:00 실행 · 끝남/);
});

test('보내기 실패 — 알림 기록을 안 남겨 다음 회차에 다시 보낸다. 앱 데이터를 못 찾으면 「모름」이고 상태 파일을 안 만든다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  실행쓰기(p, 'synk-daily-lab', 시작, [줄.사용자(시작, '지시문'), 줄.한도(시작 + 분, "You've hit your session limit · resets 9:00am (Asia/Seoul)")],
    { lastActivityAt: 시작 + 분, error: "You've hit your session limit · resets 9:00am (Asia/Seoul)", errorAt: 시작 + 분 });
  const 지금 = KST('2026-10-22T07:30:00');
  const 실패 = 알리기(p, 지금, { 보내는일: () => ({ ok: false, error: '네트워크' }) });
  assert.equal(실패.결과, '못 보냄');
  assert.deepEqual(JSON.parse(fs.readFileSync(p.상태, 'utf8')).알림, {});
  assert.equal(알리기(p, 지금 + 10 * 분).결과, '보냄');
  assert.equal(알리기(p, 지금 + 20 * 분).결과, '바뀐 것 없음');
  const q = 판();
  fs.rmSync(path.join(q.뿌리, 'sessions'), { recursive: true });
  const 모름 = 알리기(q, 지금);
  assert.equal(모름.결과, '모름');
  assert.equal(fs.existsSync(q.상태), false);
});

test('감시가 15분 넘게 끊겼다 이어지면(절전) 지켜보던 회차를 처음부터 센다', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-publish', cronExpression: '0 14 * * *' }]);
  const 지금 = KST('2026-10-22T16:30:00');
  알리기(p, 지금);
  assert.equal(알리기(p, 지금 + 60 * 분).결과, '바뀐 것 없음', '한 시간 뒤 첫 회차 — 그사이 PC가 잤을 수 있다');
  assert.equal(알리기(p, 지금 + 70 * 분).결과, '보냄');
});

// ── 아르곤 10-22 검수 지적(재현한 것) ─────────────────────────────────────────

test('홈 채널로 보낸 hermes send(「Sent to … home channel」 note)도 보낸 것으로 본다(아르곤 ①)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'a' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  const 끝 = KST('2026-10-22T08:00:00');
  실행쓰기(p, 'a', 시작, [줄.사용자(시작, '지시문'), 줄.호출(끝 - 분, 'toolu_h', '"C:/Users/q1212/AppData/Local/hermes/bin/hermes.exe" send -t telegram -f a.txt'),
    줄.결과(끝 - 30e3, 'toolu_h', 'Sent to telegram home channel (chat_id: 1)\n'), 줄.답(끝, '보냈습니다'), 줄.끝(끝 + 500)],
  { lastActivityAt: 끝, postTurnSummary: { status_category: 'blocked', needs_action: '「올려」' } });
  const x = 읽기(p, KST('2026-10-22T12:00:00')).회차들[0];
  assert.equal(x.판정.종류, '끝남');
  assert.equal(x.판정.텔레그램, true);
});

test('창 끝 — 예정은 30시간 밖인데 지터로 늦게 뜬 세션만 창 안이면 그 회차를 「지금 실행」으로 바꿔 넣지 않는다(아르곤 ②)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab' }]);
  실행쓰기(p, 'synk-daily-lab', KST('2026-10-22T07:11:00'), 정상끝(KST('2026-10-22T07:11:00'), KST('2026-10-22T08:00:00')), { lastActivityAt: KST('2026-10-22T08:00:00') });
  실행쓰기(p, 'synk-daily-lab', KST('2026-10-23T07:12:00'), 정상끝(KST('2026-10-23T07:12:00'), KST('2026-10-23T08:00:00')), { lastActivityAt: KST('2026-10-23T08:00:00') });
  const 회차 = 읽기(p, KST('2026-10-23T13:05:00')).회차들; // 10-22 07:00 예정은 30시간 5분 전, 그 세션(07:11)은 창 안
  assert.deepEqual(회차.map((x) => [회차때표(x), x.판정.종류]), [['10-23 07:00 회차', '끝남']]);
});

test('같은 날 회차 둘 — 「시작 안 함」 뒤 직접 돌린 회차가 멈추면 한 번 더 알리고, 멈춘 회차 뒤에 다시 돌린 회차가 끝났으면 알리지 않는다(아르곤 ③)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab' }]);
  알리기(p, KST('2026-10-22T09:30:00'));
  assert.equal(알리기(p, KST('2026-10-22T09:40:00')).결과, '보냄');
  assert.match(보낸것(p)[0], /시작 안 함/);
  const 손 = KST('2026-10-22T10:00:00'); // 알림대로 「지금 실행」
  실행쓰기(p, 'synk-daily-lab', 손, [줄.사용자(손, '지시문'), 줄.한도(손 + 20 * 분, "You've hit your session limit · resets 3:00pm (Asia/Seoul)")],
    { lastActivityAt: 손 + 20 * 분, error: "You've hit your session limit · resets 3:00pm (Asia/Seoul)", errorAt: 손 + 20 * 분 });
  assert.equal(알리기(p, KST('2026-10-22T10:30:00')).결과, '보냄');
  assert.match(보낸것(p)[1], /사용량 한도로 끊김/);
  assert.equal(알리기(p, KST('2026-10-22T10:40:00')).결과, '바뀐 것 없음', '그 뒤로는 그날 다시 안 보낸다');

  const q = 판();
  정의쓰기(q, [{ id: 'synk-daily-lab' }]);
  const 첫 = KST('2026-10-22T07:11:00');
  실행쓰기(q, 'synk-daily-lab', 첫, [줄.사용자(첫, '지시문'), 줄.호출(첫 + 30 * 분, 'toolu_r', 'npx remotion render')], { lastActivityAt: 첫 + 30 * 분 });
  const 다시 = KST('2026-10-22T09:00:00');
  실행쓰기(q, 'synk-daily-lab', 다시, 정상끝(다시, 다시 + 60 * 분), { lastActivityAt: 다시 + 60 * 분 });
  const 회차 = 읽기(q, KST('2026-10-22T11:00:00')).회차들;
  assert.deepEqual(회차.map((x) => x.판정.종류), ['멈춤', '끝남']);
  알리기(q, KST('2026-10-22T11:00:00'));
  assert.equal(알리기(q, KST('2026-10-22T11:10:00')).결과, '바뀐 것 없음');
  assert.deepEqual(보낸것(q), []);
});

test('앱이 뒤 회차를 이미 띄웠으면 세션 없는 지난 회차를 「시작 안 함」으로 뒤집지 않는다 — 지운 세션일 수 있다(아르곤 ④)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab', lastScheduledFor: iso(KST('2026-10-23T07:00:00')) }]);
  실행쓰기(p, 'synk-daily-lab', KST('2026-10-23T07:11:00'), 정상끝(KST('2026-10-23T07:11:00'), KST('2026-10-23T08:00:00')), { lastActivityAt: KST('2026-10-23T08:00:00') });
  const 회차 = 읽기(p, KST('2026-10-23T09:00:00')).회차들; // 10-22 07:00 회차 세션은 지워졌다
  assert.deepEqual(회차.map((x) => [회차때표(x), x.판정.종류]), [['10-22 07:00 회차', '모름'], ['10-23 07:00 회차', '끝남']]);
});

test('낡은 busy 기록 — 한도·보통 끝은 실행 중 기록보다 먼저 보고, 한 세션의 실행 기록이 여럿이면 상태를 늦게 쓴 것을 쓴다(아르곤 ⑤)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const 시작 = KST('2026-10-22T07:11:00');
  const a = 실행쓰기(p, 'a', 시작, 정상끝(시작, 시작 + 30 * 분), { lastActivityAt: 시작 + 30 * 분 });
  const b = 실행쓰기(p, 'b', 시작, [줄.사용자(시작, '지시문'), 줄.한도(시작 + 분, "You've hit your session limit · resets 9:00am (Asia/Seoul)")], { lastActivityAt: 시작 + 분 });
  const c = 실행쓰기(p, 'c', 시작, [줄.사용자(시작, '지시문'), 줄.호출(시작 + 분, 'toolu_c', 'node 긴작업.js')], { lastActivityAt: 시작 });
  const 실행 = (pid, id, status, t) => fs.writeFileSync(path.join(p.실행중, `${pid}.json`), JSON.stringify({ pid, hostSessionId: id, status, statusUpdatedAt: t }));
  실행(11, a.sessionId, 'busy', 시작); // 죽은 CLI의 pid를 다른 프로세스가 물려받은 낡은 기록
  실행(12, b.sessionId, 'busy', 시작);
  실행(13, c.sessionId, 'busy', 시작); // 앞 CLI
  실행(14, c.sessionId, 'idle', 시작 + 2 * 분); // 다시 뜬 CLI — 차례를 돌리지 않는다
  const 판정 = Object.fromEntries(읽기(p, KST('2026-10-22T11:30:00')).회차들.map((x) => [x.작업, [x.판정.종류, Boolean(x.판정.확실)]]));
  assert.deepEqual(판정, { a: ['끝남', false], b: ['멈춤', true], c: ['멈춤', false] });
});

test('지시문 경로(filePath)를 못 읽으면 기본 scheduled-tasks/<작업>/SKILL.md를 읽는다(아르곤 ⑦)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'a', filePath: path.join(p.뿌리, '옮긴곳', 'SKILL.md') }]);
  const 시작 = KST('2026-10-22T07:11:00');
  const 끝 = KST('2026-10-22T08:00:00');
  실행쓰기(p, 'a', 시작, [줄.사용자(시작, '지시문'), 줄.답(끝, '멈춥니다'), 줄.끝(끝 + 500)], { lastActivityAt: 끝, postTurnSummary: { status_category: 'blocked', needs_action: '고르기' } });
  assert.equal(읽기(p, KST('2026-10-22T11:00:00')).회차들[0].판정.종류, '보고 없음');
});

test('같은 날 예정 전에 직접 돌린 회차가 있으면 예정 회차의 「시작 안 함」은 빼고, 그 회차가 멈췄으면 그것만 한 번 알린다(아르곤 재확인 ③)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab' }, { id: 'synk-daily-synkbrief', cronExpression: '5 7 * * *' }]);
  const 손 = KST('2026-10-22T06:50:00'); // 예정(07:00) 전에 「지금 실행」 — 예정 회차에 묶이지 않는다
  실행쓰기(p, 'synk-daily-lab', 손, [줄.사용자(손, '지시문'), 줄.호출(손 + 20 * 분, 'toolu_l', 'npx remotion render')], { lastActivityAt: 손 + 20 * 분 });
  실행쓰기(p, 'synk-daily-synkbrief', 손, [줄.사용자(손, '지시문'), 줄.호출(손 + 분, 'toolu_b', 'node x.js'), 줄.결과(손 + 2 * 분, 'toolu_b', 'ok'), 줄.사용자(손 + 3 * 분, '[Request interrupted by user]')],
    { lastActivityAt: 손 + 3 * 분, lastTurnCutShort: true }); // 직접 멈춤
  const 지금 = KST('2026-10-22T09:30:00');
  assert.deepEqual(읽기(p, 지금).회차들.map((x) => [x.작업, 회차때표(x), x.판정.종류]), [
    ['synk-daily-lab', '10-22 06:50 실행', '멈춤'], ['synk-daily-synkbrief', '10-22 06:50 실행', '직접 멈춤'],
    ['synk-daily-lab', '10-22 07:00 회차', '시작 안 함'], ['synk-daily-synkbrief', '10-22 07:05 회차', '시작 안 함']]);
  알리기(p, 지금);
  assert.equal(알리기(p, 지금 + 10 * 분).결과, '보냄');
  const [글] = 보낸것(p);
  assert.match(글, /synk-daily-lab — 10-22 06:50 실행 · 멈춤 · 앱 재시작·계정 전환으로 끊김/);
  assert.doesNotMatch(글, /시작 안 함/);
  assert.doesNotMatch(글, /synkbrief/);
  assert.equal(알리기(p, 지금 + 20 * 분).결과, '바뀐 것 없음');
  assert.equal(알리기(p, 지금 + 30 * 분).결과, '바뀐 것 없음');
});

test('앱이 건너뛴 기록이 있으면 뒤 회차를 띄운 뒤에도 그 회차는 「시작 안 함」이다(아르곤 재확인 ④)', () => {
  const p = 판();
  정의쓰기(p, [{ id: 'synk-daily-lab', lastScheduledFor: iso(KST('2026-10-23T07:00:00')) }],
    { 'synk-daily-lab': [{ at: KST('2026-10-22T07:02:00'), reason: 'sign_in_required' }] });
  실행쓰기(p, 'synk-daily-lab', KST('2026-10-23T07:11:00'), 정상끝(KST('2026-10-23T07:11:00'), KST('2026-10-23T08:00:00')), { lastActivityAt: KST('2026-10-23T08:00:00') });
  const 회차 = 읽기(p, KST('2026-10-23T09:00:00')).회차들;
  assert.deepEqual(회차.map((x) => [회차때표(x), x.판정.종류, x.판정.까닭 || '']), [
    ['10-22 07:00 회차', '시작 안 함', '시작하지 않았습니다 — 앱이 건너뜀: 로그인이 필요했다'], ['10-23 07:00 회차', '끝남', '']]);
});

// ── 운영 사본에서 돌 때(10-22 18:28 「git 폴더를 못 찾았다」) ─────────────────────

test('공용 git 폴더 — git을 부르지 않고 찾는다: 메인 작업본은 .git 폴더, 워크트리(운영 사본)는 .git 파일 → gitdir → commondir', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '예약멈춤-git-'));
  const 메인 = path.join(뿌리, '메인');
  const 작업gitdir = path.join(메인, '.git', 'worktrees', '사본1');
  fs.mkdirSync(작업gitdir, { recursive: true });
  fs.writeFileSync(path.join(작업gitdir, 'commondir'), '../..\n');
  const 사본 = path.join(뿌리, 'ops', 'SYNK-appsscript');
  fs.mkdirSync(사본, { recursive: true });
  fs.writeFileSync(path.join(사본, '.git'), `gitdir: ${작업gitdir.split(path.sep).join('/')}\n`);
  assert.equal(path.resolve(멈춤.공용git폴더(메인)), path.resolve(메인, '.git'));
  assert.equal(path.resolve(멈춤.공용git폴더(사본)), path.resolve(메인, '.git'));
});

test('못 읽는 회차가 6회(약 1시간) 내리 이어지면 감시가 멈췄다고 한 통, 그 뒤로는 안 보내고, 다시 읽히면 「다시 읽습니다」 한 줄', () => {
  const p = 판();
  const 없는앱 = { ...p.환경, SYNK_CLAUDE_SESSIONS: path.join(p.뿌리, '없는-앱-데이터') };
  const 처음 = KST('2026-10-22T18:30:00');
  for (let i = 0; i < 5; i++) assert.equal(알리기(p, 처음 + i * 10 * 분, { 환경: 없는앱 }).결과, '모름');
  assert.deepEqual(보낸것(p), []);
  const 여섯째 = 알리기(p, 처음 + 50 * 분, { 환경: 없는앱 });
  assert.equal(여섯째.못읽음.회수, 6);
  assert.equal(보낸것(p).length, 1);
  assert.match(보낸것(p)[0], /^⚠ 앱 예약 작업 감시가 6회\(50분\) 내리 앱 기록을 못 읽었습니다 — 앱 세션 기록 폴더/);
  알리기(p, 처음 + 60 * 분, { 환경: 없는앱 });
  assert.equal(보낸것(p).length, 1, '「멈췄다」는 한 번만');
  정의쓰기(p, [{ id: 'synk-daily-lab', createdAt: KST('2026-10-22T12:00:00') }]); // 앱 기록이 다시 보인다(오늘 낮에 만든 작업이라 기다릴 회차는 없다)
  const 다시 = 알리기(p, 처음 + 70 * 분);
  assert.equal(다시.결과, '보냄');
  assert.match(보낸것(p)[1], /✅ 앱 예약 작업 감시가 다시 앱 기록을 읽습니다\(7회 못 읽은 뒤\)/);
  assert.equal(fs.existsSync(path.join(path.dirname(p.상태), '못읽음.json')), false);
  assert.equal(알리기(p, 처음 + 80 * 분).결과, '바뀐 것 없음');
});

test('「다시 읽습니다」 보내기가 실패해도 읽힌 회차에서 「내리」 셈은 끊긴다 — 새 장애는 새로 세어 다시 알리고, 못 보낸 「다시 읽습니다」는 다음에 보낸다(GPT 10-22 P1)', () => {
  const p = 판();
  const 없는앱 = { ...p.환경, SYNK_CLAUDE_SESSIONS: path.join(p.뿌리, '없는-앱-데이터') };
  const 처음 = KST('2026-10-22T18:30:00');
  for (let i = 0; i < 6; i++) 알리기(p, 처음 + i * 10 * 분, { 환경: 없는앱 });
  assert.equal(보낸것(p).length, 1, '첫 장애 「멈췄다」');
  정의쓰기(p, [{ id: 'synk-daily-lab', createdAt: KST('2026-10-22T12:00:00') }]);
  const 실패 = 알리기(p, 처음 + 60 * 분, { 보내는일: () => ({ ok: false, error: '네트워크' }) });
  assert.equal(실패.결과, '못 보냄');
  const 셈 = JSON.parse(fs.readFileSync(path.join(path.dirname(p.상태), '못읽음.json'), 'utf8'));
  assert.equal(셈.회수, 0);
  assert.equal(셈.빚, true);
  for (let i = 0; i < 6; i++) 알리기(p, 처음 + (70 + i * 10) * 분, { 환경: 없는앱 }); // 또 못 읽는다
  assert.equal(보낸것(p).length, 2, '새 장애도 「멈췄다」 한 통');
  assert.match(보낸것(p)[1], /6회\(50분\) 내리 앱 기록을 못 읽었습니다/);
  정의쓰기(p, [{ id: 'synk-daily-lab', createdAt: KST('2026-10-22T12:00:00') }]);
  assert.equal(알리기(p, 처음 + 130 * 분).결과, '보냄');
  assert.match(보낸것(p)[2], /✅ 앱 예약 작업 감시가 다시 앱 기록을 읽습니다\(6회 못 읽은 뒤\)/);
  assert.equal(fs.existsSync(path.join(path.dirname(p.상태), '못읽음.json')), false);
});
