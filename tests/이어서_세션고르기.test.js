'use strict';
/* /이어서 스킬의 세션고르기 — 어떤 세션에 「이어서 해」를 보내고, 무엇을 바로 보관하고, 무엇을 건드리지 않는지. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 고르기 = require('../.claude/skills/이어서/세션고르기.cjs');

const 지금 = Date.parse('2026-10-20T10:30:00Z');
const 분 = 60 * 1000;
const 일 = 24 * 60 * 분;
const 만 = 10000;

let 번호 = 0;
function 새id() {
  번호 += 1;
  return `local_${String(번호).padStart(8, '0')}-0000-4000-8000-000000000000`;
}

function 기록(덧 = {}) {
  return {
    sessionId: 새id(),
    cliSessionId: `${String(번호).padStart(8, '0')}-1111-4111-8111-111111111111`,
    cwd: 'C:\\work\\repo',
    title: `세션 ${번호}`,
    isArchived: false,
    lastActivityAt: 지금 - 60 * 분,
    postTurnSummary: { status_category: 'review_ready', needs_action: '' },
    ...덧,
  };
}

const 사람 = (글, 시각 = 지금 - 61 * 분) => ({ type: 'user', timestamp: new Date(시각).toISOString(), message: { role: 'user', content: 글 } });
const 도구결과 = (글, 시각 = 지금 - 61 * 분) => ({
  type: 'user',
  timestamp: new Date(시각).toISOString(),
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 글 }] },
});
const 답 = (글, 시각 = 지금 - 60 * 분, 덧 = {}) => ({
  type: 'assistant',
  timestamp: new Date(시각).toISOString(),
  message: { role: 'assistant', content: [{ type: 'text', text: 글 }], stop_reason: 'end_turn' },
  ...덧,
});
const 도구부름 = (시각 = 지금 - 60 * 분) => ({
  type: 'assistant',
  timestamp: new Date(시각).toISOString(),
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }], stop_reason: 'tool_use' },
});
const 보정 = "[Tool call interrupted: the session ended before this call's result was recorded]";

/* ── 원문 끝 ──────────────────────────────────────────────────────────── */

test('원문 끝: 한도·오류·재시작·멈춤·답없음·보통 끝을 가른다', () => {
  const k = (메시지) => 고르기.끝판정(메시지).종류;
  assert.equal(k([사람('해 줘'), 답("You've hit your session limit · resets 8:20pm (Asia/Seoul)", 지금, { isApiErrorMessage: true })]), '한도');
  assert.equal(k([답('Claude AI usage limit reached|1792000000', 지금, { isApiErrorMessage: true })]), '한도');
  assert.equal(k([답('API Error: 500 Internal server error', 지금, { isApiErrorMessage: true })]), '오류');
  assert.equal(k([도구부름(), 도구결과(보정), 답('No response requested.')]), '재시작');
  assert.equal(고르기.끝판정([도구부름(), 도구결과(보정), 답('No response requested.')]).보정, true, '보정 줄은 끝난 차례가 분명하다');
  assert.equal(고르기.끝판정([도구부름(), 도구결과(보정)]).보정, true);
  assert.equal(k([도구부름(), 도구결과('ok')]), '재시작', '도구 결과 뒤에 답이 없으면 차례 한가운데에서 끝난 것');
  assert.equal(고르기.끝판정([도구부름(), 도구결과('ok')]).보정, undefined);
  assert.equal(k([사람('해 줘'), 도구부름()]), '재시작', '도구를 부르다 끝난 것');
  assert.equal(k([도구부름(), 사람('[Request interrupted by user]')]), '멈춤');
  assert.equal(k([도구부름(), 도구결과('[Request interrupted by user for tool use]'), 답('No response requested.')]), '멈춤');
  assert.equal(k([답('끝났습니다'), 사람('<system-reminder>Linked sessions now</system-reminder>')]), '답없음');
  assert.equal(k([사람('해 줘'), 답('다 했습니다.')]), '끝남');
  assert.equal(k([]), '모름');
});

test('원문 끝: 멈춤 줄 뒤에 글이 이어졌으면 멈춤이 아니다(차례 중간에 글을 보낸 경우)', () => {
  const 판 = 고르기.끝판정([도구부름(), 사람('[Request interrupted by user]'), 사람('이것도 같이 해 줘'), 답('네, 같이 했습니다.')]);
  assert.equal(판.종류, '끝남');
});

/* ── 끊김·상태 ────────────────────────────────────────────────────────── */

test('끊김: 앱 기록의 한도 오류, 지난 오류, Stop 표식, 앱 종료 표식', () => {
  const 한도기록 = 기록({ error: "You've hit your session limit · resets 8:30pm", errorAt: 지금 - 30 * 분, lastTurnCutShort: true });
  assert.equal(고르기.끊김(한도기록, undefined, 지금).종류, '한도');

  const 지난오류 = 기록({ error: 'API Error', errorAt: 지금 - 50 * 분 });
  assert.equal(고르기.끊김(지난오류, { 종류: '끝남', 시각: 지금 - 10 * 분 }, 지금), null, '오류 뒤에 보통 끝난 차례가 있으면 지난 오류');

  const 오래된오류 = 기록({ error: 'API Error', errorAt: 지금 - 8 * 일 });
  assert.equal(고르기.끊김(오래된오류, { 종류: '끝남', 시각: 지금 - 8 * 일 }, 지금), null, '7일 넘은 오류는 앱도 실패로 안 띄운다');

  const 멈춤판 = { 종류: '멈춤', 시각: 지금 - 30 * 분 };
  assert.equal(고르기.끊김(기록({ lastTurnCutShort: true }), 멈춤판, 지금).종류, '멈춤');
  assert.equal(고르기.끊김(기록({}), 멈춤판, 지금).종류, '재시작', '앱 표식 없는 멈춤 줄은 앱이 스스로 끊은 것');

  const 오류뒤Stop = 기록({ error: 'API Error: overloaded', errorAt: 지금 - 40 * 분, lastTurnCutShort: true });
  assert.equal(고르기.끊김(오류뒤Stop, 멈춤판, 지금).종류, '멈춤', '오류보다 늦은 Stop이 이긴다');

  assert.equal(고르기.끊김(기록({ interruptedByQuitAt: 지금 - 5 * 분 }), { 종류: '끝남', 시각: 지금 - 6 * 분 }, 지금).종류, '재시작');
  const 권한대기 = 고르기.끊김(기록({ interruptedByQuitAt: 지금 - 5 * 분, interruptedAwaitingPerson: true }), undefined, 지금);
  assert.equal(권한대기.종류, '멈춤', '앱 종료 때 권한·대화 상자를 기다리던 세션은 앱도 사람이 열 때까지 둔다');
  assert.equal(권한대기.원인, '종료 때 권한·대화 상자 대기');
  /* Esc·Stop은 원문에 멈춤 줄을 안 남기기도 한다(10-20 4/4) — 로그로 까닭을 모르면 표식만으로 깨우지 않는다. */
  assert.equal(고르기.끊김(기록({ lastTurnCutShort: true }), { 종류: '끝남', 시각: 지금 - 6 * 분 }, 지금).종류, '불명');
  assert.equal(고르기.끊김(기록({ lastTurnCutShort: true }), { 종류: '재시작', 시각: 지금 - 6 * 분 }, 지금).종류, '불명');
  assert.equal(고르기.끊김(기록({ lastTurnCutShort: true }), undefined, 지금).종류, '불명', '원문 없이 표식만 있으면 Stop인지 모른다');
  assert.equal(고르기.끊김(기록({ lastTurnCutShort: true }), { 종류: '모름' }, 지금).종류, '불명');
  assert.equal(고르기.끊김(기록({ postTurnSummary: { status_category: 'failed' } }), undefined, 지금).종류, '오류');
  assert.equal(고르기.끊김(기록({}), { 종류: '끝남', 시각: 지금 - 6 * 분 }, 지금), null);
});

test('끊김: 앱 로그의 멈춤 원인 — Stop·Esc·다른 세션은 멈춤, 일하다 앱 종료로 끊긴 것은 재시작', () => {
  const 표식기록 = () => 기록({ lastTurnCutShort: true });
  const 도구중 = { 종류: '재시작', 시각: 지금 - 30 * 분 };
  const Esc = { 의도: { 원인: 'Esc', 시각: 지금 - 29 * 분 } };
  const k = 고르기.끊김(표식기록(), 도구중, 지금, Esc);
  assert.equal(k.종류, '멈춤');
  assert.equal(k.원인, 'Esc');
  assert.equal(고르기.끊김(기록({}), 도구중, 지금, Esc).종류, '재시작', '앱 표식이 꺼져 있으면(멈춘 뒤 새 차례가 잘 끝남) 로그의 Esc는 지난 일이다');
  assert.equal(
    고르기.끊김(표식기록(), 도구중, 지금, { 의도: { 원인: 'Esc', 시각: 지금 - 90 * 분 } }).종류,
    '불명',
    '그 차례보다 앞선 Esc는 이 차례의 원인이 아니다',
  );
  /* Esc로 멈춘 세션을 나중에 앱이 다시 띄우면 CLI가 보정 줄을 붙인다 — 보정 줄 앞의 실제 시각으로 맞춘다. */
  const 보정끝 = { 종류: '재시작', 보정: true, 시각: 지금 - 2 * 분, 앞시각: 지금 - 30 * 분 };
  assert.equal(고르기.끊김(표식기록(), 보정끝, 지금, Esc).종류, '멈춤');
  /* Stop하고 한참 뒤 앱을 껐다 — 앱 종료 줄이 더 늦어도 Stop이 그 차례의 원인이다. */
  const Stop뒤종료 = { 의도: { 원인: 'Stop', 시각: 지금 - 29 * 분 }, 종료: { 시각: 지금 - 5 * 분 } };
  assert.equal(고르기.끊김(표식기록(), 도구중, 지금, Stop뒤종료).원인, 'Stop');
  /* 일하던 세션이 앱 종료로 끊김 — 앱이 표식을 켜도 깨운다. */
  assert.equal(고르기.끊김(표식기록(), 도구중, 지금, { 종료: { 시각: 지금 - 25 * 분 } }).종류, '재시작');
  assert.equal(고르기.끊김(표식기록(), 도구중, 지금, { 종료: { 시각: 지금 - 25 * 분 } }).확정, true);
  const 종료멈춤줄 = { 종류: '멈춤', 시각: 지금 - 30 * 분 };
  assert.equal(고르기.끊김(표식기록(), 종료멈춤줄, 지금, { 종료: { 시각: 지금 - 30 * 분 + 20 * 1000 } }).종류, '재시작', '멈춤 줄이 앱 종료 때 찍혔다');
  assert.equal(고르기.끊김(표식기록(), 종료멈춤줄, 지금, { 종료: { 시각: 지금 - 5 * 분 } }).종류, '멈춤', '한참 뒤의 앱 종료는 그 멈춤 줄의 원인이 아니다');
  assert.equal(고르기.끊김(기록({}), { 종류: '끝남', 시각: 지금 - 30 * 분 }, 지금, { 종료: { 시각: 지금 - 5 * 분 } }), null, '쉬던 세션의 앱 종료 줄은 끊김이 아니다');
  const 끝들 = new Map();
  const 세션 = 표식기록();
  끝들.set(세션.sessionId, 도구중);
  const r = 고르기.나누기([세션], 끝들, { self: 'x', busy: [], 지금, 멈춤들: new Map([[세션.sessionId, Esc]]) });
  assert.equal(r.직접멈춤[0].이유, 'Esc로 멈춤(컴퓨터 사용)');
});

test('로그읽기: 로그인 줄과 세션별 마지막 의도한 멈춤·앱 종료를 따로 뽑는다', (t) => {
  const 바탕 = fs.mkdtempSync(path.join(os.tmpdir(), '이어서-'));
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const A = 'local_aaaaaaaa-0000-4000-8000-000000000000';
  const B = 'local_bbbbbbbb-0000-4000-8000-000000000000';
  const C = 'local_cccccccc-0000-4000-8000-000000000000';
  const 계정 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const 조직 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const 로그 = path.join(바탕, 'main.log');
  fs.writeFileSync(
    로그,
    [
      `2026-10-20 18:40:00 [info] LocalSessions.interrupt: sessionId=${A}`,
      `2026-10-20 18:40:00 [info] Interrupting session ${A}`,
      `2026-10-20 18:50:00 [info] Interrupting session ${C}`,
      `2026-10-20 19:22:00 [info] beforeQuit: handler is not yet run, preventing quit and cleaning things up`,
      `2026-10-20 19:22:00 [info] Running onQuitCleanup: mcp-shutdown`,
      `2026-10-20 19:22:00 [info] Stopping session ${A}`,
      `2026-10-20 19:22:00 [info] Stopping session ${B}`,
      `2026-10-20 19:23:16 [info] [LocalSessionManager] Initialization succeeded — accountId=${계정}, orgId=${조직}, existingSessions=0`,
      `2026-10-20 19:31:36 [info] [cu-esc] escape pressed, stopping ${B}`,
      `2026-10-20 19:31:36 [info] Stopping session ${B}`,
      `2026-10-20 19:40:00 [info] Stopping session ${C}`,
      '',
    ].join('\r\n'),
  );
  const { 로그인, 멈춤들 } = 고르기.로그읽기([로그]);
  const 때 = (s) => Date.parse(`2026-10-20T${s}`); // 앱 로그는 PC 시간대로 적힌다 — 시험도 PC 시간대로 읽는다
  assert.equal(로그인.계정, 계정);
  assert.equal(로그인.조직, 조직);
  assert.deepEqual(멈춤들.get(A), { 의도: { 원인: 'Stop', 시각: 때('18:40:00') }, 종료: { 시각: 때('19:22:00') } }, 'Stop 뒤 앱 종료도 둘 다 남긴다');
  assert.deepEqual(멈춤들.get(B), { 종료: { 시각: 때('19:22:00') }, 의도: { 원인: 'Esc', 시각: 때('19:31:36') } }, 'Esc 뒤 붙는 Stopping 줄은 같은 사건');
  assert.deepEqual(멈춤들.get(C), { 의도: { 원인: '다른 세션', 시각: 때('18:50:00') } }, '종료와 상관없는 Stopping 줄은 원인을 모르니 셈하지 않는다');
});

test('인자: Windows PowerShell 5.1이 빈 --busy 값을 빼도 「일하는 세션 없음」으로 읽는다', (t) => {
  const 바탕 = fs.mkdtempSync(path.join(os.tmpdir(), '이어서-'));
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const 나 = 기록({});
  const 남 = 기록({ lastActivityAt: 지금 - 8 * 일 });
  for (const r of [나, 남]) fs.writeFileSync(path.join(바탕, `${r.sessionId}.json`), JSON.stringify(r));
  const 공통 = ['--기록', 바탕, '--원문', path.join(바탕, 'p'), '--지금', new Date(지금).toISOString()];
  const 빠짐 = 고르기.실행(['--self', 나.sessionId, '--busy', '--전부', ...공통], {});
  assert.equal(빠짐.ok, true);
  assert.equal(칸(빠짐, 남.sessionId), '보냄', '--전부가 busy 값으로 먹히지 않는다');
  const 등호 = 고르기.실행(['--self', 나.sessionId, `--busy=${남.sessionId}`, ...공통], {});
  assert.equal(칸(등호, 남.sessionId), '일하는중');
});

test('상태: 유호님 지시 대기 신호는 하나라도 있으면 대기다(마무리 상자가 요약을 낮춰도)', () => {
  const 마무리승인 = 고르기.상태(기록({ turnWrapUp: { description: '준비됨', needsUser: '최종 업로드 검토' } }));
  assert.equal(마무리승인.대기, true);
  assert.equal(마무리승인.기다림, '최종 업로드 검토');
  assert.equal(고르기.상태(기록({ turnWrapUp: { description: 'x' }, postTurnSummary: { status_category: 'blocked' } })).대기, true);
  const 완료인데할일 = 고르기.상태(기록({ turnWrapUp: { description: '준비됨' }, postTurnSummary: { status_category: 'completed', needs_action: '최종 업로드 검토' } }));
  assert.equal(완료인데할일.대기, true);
  assert.equal(완료인데할일.기다림, '최종 업로드 검토');
  assert.equal(고르기.상태(기록({ postTurnSummary: { status_category: 'need_input', needs_action: '시안 고르기' } })).기다림, '시안 고르기');
  const 완료설명 = 고르기.상태(기록({ postTurnSummary: { status_category: 'completed', status_detail: '7일 판정 완료', needs_action: '' } }));
  assert.equal(완료설명.대기, false, '상태 설명은 유호님이 할 일이 아니다');
  assert.equal(완료설명.설명, '7일 판정 완료');
  assert.equal(고르기.부모({ spawnedFrom: JSON.stringify({ sessionId: 'local_p', taskId: 'task_1' }) }), 'local_p');
  assert.equal(고르기.부모({ spawnedFrom: { sessionId: 'local_q' } }), 'local_q');
  assert.equal(고르기.부모({ spawnedFrom: '{깨짐' }), null);
});

/* ── 나누기 ──────────────────────────────────────────────────────────── */

function 판(기록들, 끝들 = new Map(), 덧 = {}) {
  return 고르기.나누기(기록들, 끝들, { self: 'local_self', busy: [], 지금, ...덧 });
}
const 칸 = (결과, id) => Object.keys(결과).find((k) => Array.isArray(결과[k]) && 결과[k].some((s) => s && s.id === id));

test('나누기: 한도로 끊긴 세션은 보내고, 승인을 기다리는 세션은 끊겼어도·--전부여도 보내지 않는다', () => {
  const 한도 = 기록({ error: "You've hit your session limit", errorAt: 지금 - 20 * 분, lastTurnCutShort: true });
  const 승인 = 기록({ postTurnSummary: { status_category: 'blocked', needs_action: '공개 배포 승인 기다림' } });
  const 마무리승인 = 기록({ turnWrapUp: { description: '준비됨', needsUser: '최종 업로드 검토' } });
  const 승인뒤한도 = 기록({
    turnWrapUp: { description: '준비됨', needsUser: '게시 승인' },
    error: "You've hit your session limit",
    errorAt: 지금 - 15 * 분,
    lastTurnCutShort: true,
  });
  const 승인뒤종료 = 기록({ postTurnSummary: { status_category: 'need_input', needs_action: '시안 고르기' }, interruptedByQuitAt: 지금 - 5 * 분 });
  const 완료인데할일 = 기록({ turnWrapUp: { description: '준비됨' }, postTurnSummary: { status_category: 'completed', needs_action: '최종 업로드 검토' } });
  for (const 전부 of [false, true]) {
    const r = 판([한도, 승인, 마무리승인, 승인뒤한도, 승인뒤종료, 완료인데할일], new Map(), { 전부 });
    assert.equal(칸(r, 한도.sessionId), '보냄');
    for (const s of [승인, 마무리승인, 승인뒤한도, 승인뒤종료, 완료인데할일]) assert.equal(칸(r, s.sessionId), '유호님차례', s.title);
    assert.equal(r.유호님차례.find((s) => s.id === 마무리승인.sessionId).기다림, '최종 업로드 검토');
    assert.equal(r.유호님차례.find((s) => s.id === 승인뒤한도.sessionId).이유, '그 뒤 사용량 한도로 끊김');
  }
  assert.equal(판([한도]).보냄[0].이유, '사용량 한도로 끊김');
});

test('나누기: 일하는 중(전체 id·앞부분), 이 세션, 보관된 세션은 건드리지 않는다', () => {
  const 일1 = 기록({ lastTurnCutShort: true });
  const 일2 = 기록({ lastTurnCutShort: true });
  const 나 = 기록({ lastTurnCutShort: true });
  const 보관됨 = 기록({ isArchived: true, lastTurnCutShort: true });
  const r = 고르기.나누기([일1, 일2, 나, 보관됨], new Map(), {
    self: 나.sessionId,
    busy: [일1.sessionId, 일2.sessionId.slice('local_'.length, 'local_'.length + 8)],
    지금,
  });
  assert.equal(칸(r, 일1.sessionId), '일하는중');
  assert.equal(칸(r, 일2.sessionId), '일하는중', 'local_ 없는 8자 앞부분도 맞춘다');
  assert.equal(칸(r, 나.sessionId), undefined);
  assert.equal(칸(r, 보관됨.sessionId), undefined);
  const 짧은앞부분 = 고르기.나누기([일1], new Map(), { self: 'x', busy: ['local_0'], 지금 });
  assert.equal(칸(짧은앞부분, 일1.sessionId), '직접멈춤', '너무 짧은 앞부분은 무시한다(원문 없는 표식은 불명)');
});

test('나누기: Stop·까닭 모를 끊김은 기본은 그대로 두고 --전부면 보낸다', () => {
  const 멈춤 = 기록({ lastTurnCutShort: true });
  const 불명 = 기록({ lastTurnCutShort: true });
  const 끝들 = new Map([[멈춤.sessionId, { 종류: '멈춤', 시각: 지금 - 30 * 분 }]]);
  const r = 판([멈춤, 불명], 끝들);
  assert.equal(칸(r, 멈춤.sessionId), '직접멈춤');
  assert.equal(r.직접멈춤.find((s) => s.id === 멈춤.sessionId).이유, 'Stop으로 멈춤');
  assert.equal(칸(r, 불명.sessionId), '직접멈춤');
  assert.equal(r.직접멈춤.find((s) => s.id === 불명.sessionId).이유, '앱 표식은 멈춤인데 원문·로그로 까닭을 못 가름');
  const 전부 = 판([멈춤, 불명], 끝들, { 전부: true });
  assert.equal(칸(전부, 멈춤.sessionId), '보냄');
  assert.equal(칸(전부, 불명.sessionId), '보냄');
});

/* 완료로 끝난 세션 — 원문이 보통으로 끝났고, 앱 요약이 원문 마지막 차례 것이며, 마지막 보고가 깨끗한 것.
 * 보고만 바꿔 애매한 경우를 만든다. 보고는 마지막보고()가 내는 모양({ 글, 온전, uuid })으로 넘긴다. */
const 깨끗한보고 = '공개했고 배포 점검도 통과했습니다. 남은 일은 없습니다.';
const 요약차례 = (r) => (r.postTurnSummary && r.postTurnSummary.summarizes_uuid) || '';
const 보고판 = (r, 글, 덧 = {}) => ({ 글, 온전: true, uuid: 요약차례(r), ...덧 });
function 완료판(세션들, 덧 = {}) {
  const 끝들 = new Map();
  const 보고들 = new Map();
  for (const [r, 보고] of 세션들) {
    if (보고 === undefined) continue;
    끝들.set(r.sessionId, { 종류: '끝남', 시각: 지금 - 60 * 분 });
    if (보고 !== null) 보고들.set(r.sessionId, 보고판(r, 보고));
  }
  return 판(세션들.map(([r]) => r), 끝들, { 보고들, 워크트리상태: () => ({ 깨끗: true }), ...덧 });
}
const 완료 = (덧 = {}) => {
  const r = 기록(덧);
  if (!덧.postTurnSummary) r.postTurnSummary = { status_category: 'completed', needs_action: '', summarizes_uuid: `u-${r.sessionId}` };
  return r;
};

test('나누기: 완료로 끝났고 마지막 보고가 깨끗하면 예약 실행·대화형·깨끗한 워크트리 세션을 깨우지 않고 바로 보관한다', () => {
  const 예약 = 완료({ scheduledTaskId: 'tip-review' });
  const 대화형 = 완료({});
  const 워크트리 = 완료({ cwd: 'C:\\work\\repo\\.claude\\worktrees\\x' });
  const 끝낸말 = 완료({ turnWrapUp: { description: '마무리했습니다.' } });
  const r = 완료판([
    [예약, '적용안을 쓸 줄이 없어서 그대로 끝냈습니다.'],
    [대화형, 깨끗한보고],
    [워크트리, '커밋 다섯 개가 모두 origin에 있고, 워크트리에 미커밋 변경과 돌고 있는 작업은 없습니다. 남은 일은 없습니다.'],
    [끝낸말, '이 세션은 보관해도 됩니다.'],
  ]);
  for (const s of [예약, 대화형, 워크트리, 끝낸말]) assert.equal(칸(r, s.sessionId), '보관', s.title);
  assert.equal(r.보관.find((s) => s.id === 예약.sessionId).이유, '예약 실행이 완료로 끝남');
  assert.equal(r.보관.find((s) => s.id === 대화형.sessionId).이유, '완료로 끝났고 남은 일 없음');
});

test('나누기: 바로 보관은 확실할 때만 — 애매하거나 못 읽으면 지금처럼 깨운다', () => {
  /* 10-20 완료 세션의 실제 보고에서 뽑은 문장들 — 앱은 completed로 분류했지만 남은 일이 있다. */
  const 애매한보고 = {
    'CI 미확인': '제 커밋을 origin에 올렸습니다. CI 미확인.',
    '확인 안 함': '이 세션 작업은 여기서 끝이에요. origin CI 결과는 확인하지 않았어요.',
    '유호님 할 일': '마쳤습니다. 휴대폰에서 하실 것: 인스타 댓글 고정만 남았어요.',
    '유호님 몫': '릴스는 올라갔습니다. 로그인이 필요한 마무리는 못 했고, 유호님 몫으로 남겼습니다.',
    '아직': '뒤로 가기 고침은 origin에 있고, synk.im/world 공개는 아직 하지 않았습니다.',
    '다른 세션이 이어서': '직접 할 일은 남아 있지 않습니다. 17판은 두 세션이 이어서 맡고 있어 보관하지 않고 그대로 둡니다.',
    '보류': 'master 맞추기는 보류했고 보강 세션이 진행 중입니다.',
    '넘김': '공개·반영을 다른 세션에 넘겼습니다. 정리를 마쳤습니다.',
    '질문': '다 했습니다. 다음 묶음도 바로 띄울까요?',
    '끝맺음 없음': '올렸습니다.',
    /* 10-20 Fable 검수가 찾은, 「마쳤습니다」만으로 통과하던 보고들 */
    '앞으로 할 일': '작업을 마쳤습니다. 공개는 내일 하겠습니다.',
    '검수 대기': '1차 작업을 마쳤습니다. Fable 검수 에이전트를 띄웠고 결과가 오면 반영하겠습니다.',
    '안 한 일': '커밋은 안 했습니다. 남은 일은 없습니다.',
    '진행 중': '영상 렌더 중입니다. 이 묶음은 끝냈습니다. 남은 일은 없습니다.',
    '다음 세션': '운영 반영은 다음 세션이 맡습니다. 남은 일은 없습니다.',
    '영어 요약': 'prod deploy not yet. 남은 일은 없습니다.',
    '완료어만': '렌더가 끝났습니다.',
    '없다고는 못 함': '남은 일이 없다고는 못 합니다.',
    '굵은 글씨 질문': '남은 일은 없습니다. **이대로 띄울까요?**',
  };
  const 세션들 = Object.entries(애매한보고).map(([이름, 보고]) => [완료({ title: 이름 }), 보고]);
  const 원문없음 = 완료({ title: '원문 없음' });
  const 보고없음 = 완료({ title: '보고 글 없음' });
  const 보통끝아님 = 완료({ title: '보통 끝 아님' });
  const 요약걸림 = 완료({
    title: '요약에 걸림',
    postTurnSummary: { status_category: 'completed', status_detail: '초기화권 만료 정확한 시각 미확인', needs_action: '', summarizes_uuid: 'u-요약걸림' },
  });
  const 마무리걸림 = 완료({ title: '마무리 상자에 걸림', turnWrapUp: { description: 'push했습니다. 공개는 유호님 승인 뒤에 하겠습니다.' } });
  const 쪽지 = 완료({ title: '남은 쪽지', queuedSideSessionNotes: [{ sessionId: 'local_z' }] });
  const 할일 = 완료({ title: '할 일', postTurnSummary: { status_category: 'completed', needs_action: '결과 읽기' } });
  const 워크트리더러움 = 완료({ title: '워크트리 미커밋', cwd: 'C:\\work\\repo\\.claude\\worktrees\\a' });
  const 워크트리모름 = 완료({ title: '워크트리 모름', cwd: 'C:\\work\\repo\\.claude\\worktrees\\b' });
  const 제외표시 = 완료({ title: '자동 보관 제외', autoArchiveExempt: true });
  const 다른차례 = 완료({ title: '요약이 다른 차례 것' });
  const 요약차례없음 = 완료({ title: '요약 차례 모름', postTurnSummary: { status_category: 'completed', needs_action: '' } });
  const 앞잘림 = 완료({ title: '차례 앞부분 잘림' });
  const 앞블록 = 완료({ title: '앞 글에 남은 일' });
  const 앱보고 = 완료({ title: '앱이 저장한 보고에 남은 일', lastTurnReport: 'CI는 확인하지 못했습니다. 유호님 몫입니다.' });
  const 끝들보정 = [
    ...세션들,
    [원문없음, undefined],
    [보고없음, null],
    [보통끝아님, 깨끗한보고],
    [요약걸림, 깨끗한보고],
    [마무리걸림, 깨끗한보고],
    [쪽지, 깨끗한보고],
    [할일, 깨끗한보고],
    [워크트리더러움, 깨끗한보고],
    [워크트리모름, 깨끗한보고],
    [제외표시, 깨끗한보고],
    [다른차례, 깨끗한보고],
    [요약차례없음, 깨끗한보고],
    [앞잘림, 깨끗한보고],
    [앞블록, `보고: CI는 확인하지 못했습니다. 유호님 몫으로 남겼습니다.\n${깨끗한보고}`],
    [앱보고, 깨끗한보고],
  ];
  const 워크트리상태 = (rr) =>
    rr.sessionId === 워크트리더러움.sessionId ? { 깨끗: false, 까닭: '미커밋 3·미푸시 1' } : { 깨끗: false, 까닭: '상태를 읽지 못함(git 없음)' };
  const 끝들 = new Map();
  const 보고들 = new Map();
  for (const [rr, 보고] of 끝들보정) {
    if (보고 === undefined) continue;
    끝들.set(rr.sessionId, { 종류: rr === 보통끝아님 ? '재시작' : '끝남', 시각: 지금 - 60 * 분, ...(rr === 보통끝아님 ? { 보정: true } : {}) });
    if (보고 === null) continue;
    const 덧 = rr === 다른차례 ? { uuid: 'u-다른-차례' } : rr === 앞잘림 ? { 온전: false } : {};
    보고들.set(rr.sessionId, 보고판(rr, 보고, 덧));
  }
  const r = 판(끝들보정.map(([rr]) => rr), 끝들, { 보고들, 워크트리상태 });
  assert.equal(r.보관.length, 0, `애매한 세션은 하나도 보관하지 않는다: ${r.보관.map((s) => s.제목).join(', ')}`);
  for (const [s] of 끝들보정) {
    const 기대 = s === 할일 ? '유호님차례' : '보냄';
    assert.equal(칸(r, s.sessionId), 기대, s.title);
  }
  const 이유 = (s) => r.보냄.find((x) => x.id === s.sessionId).이유;
  assert.match(이유(세션들[0][0]), /^완료로 끝났지만 마지막 보고에 「미확인」 — 스스로 확인하고 보관$/);
  assert.match(이유(세션들[1][0]), /「확인하지 않」/);
  assert.match(이유(세션들[9][0]), /끝맺음 말이 없음/);
  assert.match(이유(원문없음), /마지막 보고를 읽지 못함/);
  assert.match(이유(보고없음), /마지막 보고를 읽지 못함/);
  assert.match(이유(요약걸림), /「미확인」/, '앱 요약의 상태 설명도 본다');
  assert.match(이유(마무리걸림), /「유호님 승인」/, '마무리 상자도 본다');
  assert.match(이유(워크트리더러움), /워크트리 미커밋 3·미푸시 1/);
  assert.match(이유(워크트리모름), /워크트리 상태를 읽지 못함/);
  assert.match(이유(제외표시), /앱 자동 보관 제외 표시/, '유호님이 앱 자동 보관에서 뺀 세션은 보관하지 않는다');
  assert.match(이유(다른차례), /앱 요약이 원문 마지막 차례 것인지 확인하지 못함/);
  assert.match(이유(요약차례없음), /앱 요약이 원문 마지막 차례 것인지 확인하지 못함/);
  assert.match(이유(앞잘림), /마지막 보고를 읽지 못함/, '차례 앞부분을 못 읽었으면 믿지 않는다');
  assert.match(이유(앞블록), /「확인하지 못」/, '마지막 차례의 앞 글까지 본다');
  assert.match(이유(앱보고), /「확인하지 못」/, '앱이 저장한 마지막 보고(lastTurnReport)도 본다');
});

test('나누기: 완료로 끝났어도 애매하면 오래 쉰 세션은 오래쉼에 둔다(--전부면 깨운다)', () => {
  const 오래 = 완료({ lastActivityAt: 지금 - 9 * 일 });
  const 끝들 = new Map([[오래.sessionId, { 종류: '끝남', 시각: 지금 - 9 * 일 }]]);
  const 보고들 = new Map([[오래.sessionId, 보고판(오래, '올렸습니다. CI 미확인.')]]);
  assert.equal(칸(판([오래], 끝들, { 보고들 }), 오래.sessionId), '오래쉼');
  assert.equal(칸(판([오래], 끝들, { 보고들, 전부: true }), 오래.sessionId), '보냄');
  보고들.set(오래.sessionId, 보고판(오래, 깨끗한보고));
  assert.equal(칸(판([오래], 끝들, { 보고들 }), 오래.sessionId), '보관', '깨끗하면 오래 쉬었어도 보관한다');
});

test('나누기: 곁 세션이 그 아래까지 모두 보관 칸일 때만 부모도 보관하고, 아니면 부모는 깨우지 않고 기다린다', () => {
  const 곁 = (부모, 덧 = {}) => 완료({ spawnedFrom: JSON.stringify({ sessionId: 부모.sessionId }), ...덧 });
  const 부모1 = 완료({ title: '부모1' });
  const 끝난자식 = 곁(부모1, { title: '끝난 자식' });
  const 부모2 = 완료({ title: '부모2' });
  const 승인자식 = 곁(부모2, { title: '승인 자식', postTurnSummary: { status_category: 'blocked', needs_action: '시안 고르기' } });
  const 부모3 = 완료({ title: '부모3' });
  const 일하는자식 = 곁(부모3, { title: '일하는 자식' });
  const 부모4 = 완료({ title: '부모4' });
  const 멈춘자식 = 곁(부모4, { title: '멈춘 자식', lastTurnCutShort: true });
  const 부모5 = 완료({ title: '부모5' });
  const 가운데 = 곁(부모5, { title: '가운데' });
  const 손주 = 곁(가운데, { title: '손주', postTurnSummary: { status_category: 'review_ready', needs_action: '' } });
  const 부모6 = 완료({ title: '부모6' });
  const 떼어낸 = 곁(부모6, { title: '떼어 낸 곁 세션', lineageDetached: true, postTurnSummary: { status_category: 'review_ready' } });
  const 부모7 = 완료({ title: '부모7' });
  const 나 = 곁(부모7, { title: '이어서 친 세션' });
  const 끝들 = new Map();
  const 보고들 = new Map();
  const 모두 = [부모1, 끝난자식, 부모2, 승인자식, 부모3, 일하는자식, 부모4, 멈춘자식, 부모5, 가운데, 손주, 부모6, 떼어낸, 부모7, 나];
  for (const s of 모두) {
    if (s === 멈춘자식) continue;
    끝들.set(s.sessionId, { 종류: '끝남', 시각: 지금 - 60 * 분 });
    보고들.set(s.sessionId, 보고판(s, 깨끗한보고));
  }
  끝들.set(멈춘자식.sessionId, { 종류: '멈춤', 시각: 지금 - 60 * 분 });
  const r = 고르기.나누기(모두, 끝들, { self: 나.sessionId, busy: [일하는자식.sessionId], 지금, 보고들 });
  const 보관순 = r.보관.map((s) => s.제목);
  assert.deepEqual(보관순.filter((t) => t === '부모1' || t === '끝난 자식'), ['부모1', '끝난 자식'], '부모를 먼저 보관한다(부모를 보관하면 끝난 곁 세션도 같이 보관된다)');
  const 기다림 = (s) => r.곁세션대기.find((x) => x.id === s.sessionId);
  assert.deepEqual(기다림(부모2).곁, ['승인 자식'], '유호님 답을 기다리는 곁 세션은 쉬고 있어 같이 보관된다 — 부모를 보관하지 않는다');
  assert.equal(기다림(부모2).이유, '완료로 끝남 — 곁 세션이 끝나면 보관');
  assert.deepEqual(기다림(부모3).곁, ['일하는 자식']);
  assert.deepEqual(기다림(부모4).곁, ['멈춘 자식'], '멈춘 곁 세션도 같이 보관되므로 부모를 보관하지 않는다');
  assert.deepEqual(기다림(부모5).곁, ['손주'], '손주가 막으면 그 이름을 댄다');
  assert.deepEqual(기다림(가운데).곁, ['손주'], '손주가 보관 칸이 아니면 가운데도 기다린다');
  assert.equal(칸(r, 부모6.sessionId), '보관', '최상위로 떼어 낸 세션은 곁 세션으로 치지 않는다');
  assert.deepEqual(기다림(부모7).곁, ['이어서 친 세션'], '이 세션(/이어서를 친 곁 세션)도 일하는 곁 세션이다');
  assert.equal(칸(r, 나.sessionId), undefined, '이 세션은 어느 칸에도 넣지 않는다');

  /* 쉬는 부모(끊기지 않음)도 /이어서를 친 곁 세션이 끝나기를 기다린다 — 그 곁 세션이 끝나면 앱이 부모를 깨운다. */
  const 부모8 = 기록({ title: '쉬는 부모8' });
  const 나2 = 곁(부모8, { title: '이어서 친 세션2' });
  const r2 = 고르기.나누기([부모8, 나2], new Map(), { self: 나2.sessionId, busy: [], 지금 });
  assert.equal(칸(r2, 부모8.sessionId), '곁세션대기');
  assert.deepEqual(r2.곁세션대기[0].곁, ['이어서 친 세션2']);
});

test('나누기: 바로 보관을 끄면(기록 깨짐·계정 불확실) 완료 세션은 깨워서 스스로 정하게 한다', () => {
  const 예약완료 = 기록({ scheduledTaskId: 'tip-review', postTurnSummary: { status_category: 'completed' } });
  const r = 판([예약완료], new Map(), { 바로보관: false, 바로보관막힘: '기록 1개를 읽지 못해' });
  assert.equal(r.보관.length, 0);
  assert.equal(칸(r, 예약완료.sessionId), '보냄');
  assert.match(r.보냄[0].이유, /기록 1개를 읽지 못해/);
});

test('나누기: 곁 세션이 일하거나 이번에 깨울 대상이면 끊기지 않은 부모는 기다린다', () => {
  const 부모1 = 기록({});
  const 일하는자식 = 기록({ spawnedFrom: { sessionId: 부모1.sessionId } });
  const 부모2 = 기록({});
  const 끊긴자식 = 기록({ spawnedFrom: { sessionId: 부모2.sessionId }, error: 'API Error', errorAt: 지금 - 30 * 분 });
  const 끊긴부모 = 기록({ error: "You've hit your session limit", errorAt: 지금 - 30 * 분 });
  const 그자식 = 기록({ spawnedFrom: { sessionId: 끊긴부모.sessionId } });
  const 부모3 = 기록({});
  const 끝난자식 = 기록({ spawnedFrom: { sessionId: 부모3.sessionId }, lastActivityAt: 지금 - 9 * 일 });
  const 부모4 = 기록({});
  const 승인자식 = 기록({ spawnedFrom: { sessionId: 부모4.sessionId }, postTurnSummary: { status_category: 'blocked' } });
  const r = 고르기.나누기([부모1, 일하는자식, 부모2, 끊긴자식, 끊긴부모, 그자식, 부모3, 끝난자식, 부모4, 승인자식], new Map(), {
    self: 'local_self',
    busy: [일하는자식.sessionId, 그자식.sessionId],
    지금,
  });
  assert.equal(칸(r, 부모1.sessionId), '곁세션대기');
  assert.deepEqual(r.곁세션대기.find((s) => s.id === 부모1.sessionId).곁, [일하는자식.title]);
  assert.equal(칸(r, 부모2.sessionId), '곁세션대기');
  assert.equal(칸(r, 끊긴자식.sessionId), '보냄');
  assert.equal(칸(r, 끊긴부모.sessionId), '보냄', '부모가 끊겼으면 자식이 일해도 깨운다(보관은 보낼 글이 막는다)');
  assert.equal(칸(r, 부모3.sessionId), '보냄', '오래 쉬는 자식은 기다릴 이유가 아니다');
  assert.equal(칸(r, 부모4.sessionId), '곁세션대기', '자식이 유호님 차례면 부모도 건드리지 않는다');
});

test('나누기: 방금 끝난 세션·오래 쉰 세션·막 움직이는 세션·재시작 보정 줄·/loop 깨우기', () => {
  const 방금 = 기록({ lastActivityAt: 지금 - 4 * 분 });
  const 오래 = 기록({ lastActivityAt: 지금 - 8 * 일 });
  const 오래끊김 = 기록({ lastActivityAt: 지금 - 8 * 일, error: 'API Error', errorAt: 지금 - 6 * 일 });
  const 막 = 기록({ lastActivityAt: 지금 - 20 * 분 });
  const 막종료 = 기록({ lastActivityAt: 지금 - 20 * 분, interruptedByQuitAt: 지금 - 3 * 분 });
  const 막보정 = 기록({ lastActivityAt: 지금 - 1 * 분 });
  const 루프 = 기록({ lastTurnCutShort: true, pendingLoopWakeup: { at: 지금 + 10 * 분 } });
  const 끝들 = new Map([
    [막.sessionId, { 종류: '답없음', 시각: 지금 - 20 * 1000 }],
    [막종료.sessionId, { 종류: '재시작', 시각: 지금 - 30 * 1000 }],
    [막보정.sessionId, { 종류: '재시작', 보정: true, 시각: 지금 - 20 * 1000 }],
  ]);
  const r = 판([방금, 오래, 오래끊김, 막, 막종료, 막보정, 루프], 끝들);
  assert.equal(칸(r, 방금.sessionId), '방금끝남');
  assert.equal(칸(r, 오래.sessionId), '오래쉼');
  assert.equal(칸(r, 오래끊김.sessionId), '오래쉼');
  assert.equal(칸(r, 막.sessionId), '일하는중');
  assert.equal(칸(r, 막종료.sessionId), '보냄', '앱 종료 표식이 있으면 막 쓰인 원문이어도 끊긴 것');
  assert.equal(칸(r, 막보정.sessionId), '보냄', '다시 뜬 CLI의 보정 줄은 끝난 차례 — 막 쓰였어도 깨운다');
  assert.equal(칸(r, 루프.sessionId), '일하는중');
  const 전부 = 판([오래, 오래끊김], new Map(), { 전부: true });
  assert.equal(칸(전부, 오래.sessionId), '보냄');
  assert.equal(칸(전부, 오래끊김.sessionId), '보냄');
});

test('나누기: 끊긴 세션을 먼저, 그 안에서는 최근 것부터 보낸다', () => {
  const 쉼 = 기록({ lastActivityAt: 지금 - 30 * 분 });
  const 옛끊김 = 기록({ lastActivityAt: 지금 - 3 * 일, error: 'API Error', errorAt: 지금 - 3 * 일 });
  const 새끊김 = 기록({ lastActivityAt: 지금 - 2 * 60 * 분, error: 'API Error', errorAt: 지금 - 2 * 60 * 분 });
  const r = 판([쉼, 옛끊김, 새끊김]);
  assert.deepEqual(r.보냄.map((s) => s.id), [새끊김.sessionId, 옛끊김.sessionId, 쉼.sessionId]);
});

test('나누기: 최상위·권한 우회 모드 세션은 보내지 않고 직접입력으로 먼저 알린다(곁 세션은 받는다)', () => {
  const 끊김 = { error: "You've hit your session limit", errorAt: 지금 - 30 * 분 };
  const 우회 = (덧) => 기록({ permissionMode: 'bypassPermissions', ...끊김, ...덧 });
  const 최상위 = 우회({ title: '최상위 우회' });
  const 부모 = 기록({ title: '곁 부모', ...끊김 });
  const 곁우회 = 우회({ title: '곁 우회', spawnedFrom: { sessionId: 부모.sessionId } });
  const 떼어낸 = 우회({ title: '떼어 낸 우회', spawnedFrom: { sessionId: 부모.sessionId }, lineageDetached: true });
  const 자동 = 기록({ title: '최상위 자동', permissionMode: 'auto', ...끊김 });
  const 로그로우회 = 기록({ title: '기록엔 모드 없음', ...끊김 });
  const 거절뒤그대로 = 기록({ title: '거절 뒤 그대로', permissionMode: 'auto', lastActivityAt: 지금 - 60 * 분, ...끊김 });
  const 거절뒤움직임 = 기록({ title: '거절 뒤 움직임', permissionMode: 'auto', lastActivityAt: 지금 - 20 * 분, ...끊김 });
  const 모두 = [최상위, 부모, 곁우회, 떼어낸, 자동, 로그로우회, 거절뒤그대로, 거절뒤움직임];
  const 모드들 = new Map([[로그로우회.sessionId, { 모드: 'bypassPermissions', 시각: 지금 - 2 * 일 }]]);
  const 거절들 = new Map([
    [거절뒤그대로.sessionId, 지금 - 50 * 분],
    [거절뒤움직임.sessionId, 지금 - 50 * 분],
  ]);
  const r = 판(모두, new Map(), { 모드들, 거절들 });
  for (const s of [최상위, 떼어낸, 로그로우회, 거절뒤그대로]) assert.equal(칸(r, s.sessionId), '직접입력', s.title);
  for (const s of [부모, 곁우회, 자동, 거절뒤움직임]) assert.equal(칸(r, s.sessionId), '보냄', s.title);
  const 최상위판 = r.직접입력.find((s) => s.id === 최상위.sessionId);
  assert.equal(최상위판.직접, '최상위·권한 우회 모드라 다른 세션 글을 받지 않음');
  assert.equal(최상위판.이유, '사용량 한도로 끊김', '깨울 까닭은 그대로 남긴다');
  assert.match(r.직접입력.find((s) => s.id === 거절뒤그대로.sessionId).직접, /지난번 다른 세션 글을 받지 않았고 그 뒤 움직임 없음/);
  assert.equal(r.보냄.find((s) => s.id === 곁우회.sessionId).우회곁, true, '우회 모드 곁 세션은 보내되 받지 않을 수 있다고 표시한다');

  /* 이 세션도 우회 모드면 모드 갈래가 같아 받으므로 보낸다(우회끼리 표시 — 10-21 실측 4개 모두 받음). */
  const 우회에서 = 판(모두, new Map(), { 모드들, 거절들, 내모드: 'bypassPermissions' });
  assert.equal(칸(우회에서, 최상위.sessionId), '보냄');
  assert.equal(우회에서.보냄.find((s) => s.id === 최상위.sessionId).우회끼리, true);
  assert.equal(칸(우회에서, 거절뒤그대로.sessionId), '보냄', '지난 거절은 다른 모드 세션이 보낸 글이었을 수 있다');
});

test('나누기: 5시간 한도 여유만큼만 앞 차례부터 깨우고, 나머지는 건너뛰지 않고 한도대기로 남긴다', () => {
  const 끊김 = (덧) => 기록({ error: 'API Error', errorAt: 지금 - 30 * 분, ...덧 });
  const 큰끊김 = 끊김({ title: '큰 끊김', lastActivityAt: 지금 - 30 * 분 });
  const 작은끊김 = 끊김({ title: '작은 끊김', lastActivityAt: 지금 - 40 * 분 });
  const 쉼 = 기록({ title: '쉼', lastActivityAt: 지금 - 20 * 분 });
  const 마감쉼 = 기록({ title: '공모전 접수 마감 10-21', lastActivityAt: 지금 - 50 * 분 });
  const 일하는 = 기록({ title: '일하는 중' });
  const 문맥들 = new Map([
    [큰끊김.sessionId, 90 * 만],
    [작은끊김.sessionId, 10 * 만],
    [쉼.sessionId, 50 * 만],
    [마감쉼.sessionId, 30 * 만],
  ]);
  const 모두 = [큰끊김, 작은끊김, 쉼, 마감쉼, 일하는];
  const 공통 = { 문맥들, busy: [일하는.sessionId] };
  /* 몫(%) = 문맥 × 6 ÷ 200만: 큰 끊김 2.7, 작은 끊김 0.5(가장 작은 몫), 쉼 1.5, 마감 0.9. 차례: 마감 → 끊김(최근 것부터) → 쉼. */
  const 넉넉 = 판(모두, new Map(), { ...공통, 한도: { 사용: 20 } });
  assert.deepEqual(넉넉.보냄.map((s) => s.제목), ['공모전 접수 마감 10-21', '큰 끊김', '작은 끊김', '쉼']);
  assert.equal(넉넉.한도대기.length, 0);
  assert.deepEqual(넉넉.한도, { 사용: 20, 여유: 80, 남길: 12, 보낸몫: 5.6, 미룸: 0 });
  assert.equal(넉넉.보냄[1].문맥, '90만');
  assert.equal(넉넉.보냄[1].몫, 2.7);
  assert.equal(넉넉.보냄[0].마감, true);

  /* 사용 84 → 여유 16 − 남길 12(유호님·이 세션 10 + 일하는 세션 하나 2) = 4: 마감 0.9 + 큰 끊김 2.7까지. */
  const 빠듯 = 판(모두, new Map(), { ...공통, 한도: { 사용: 84, 풀림: Date.parse('2026-10-20T16:40:00Z') } });
  assert.deepEqual(빠듯.보냄.map((s) => s.제목), ['공모전 접수 마감 10-21', '큰 끊김']);
  assert.deepEqual(빠듯.한도대기.map((s) => s.제목), ['작은 끊김', '쉼'], '들어가지 않는 세션이 나오면 뒤는 작아도 앞지르지 않고 미룬다');
  assert.equal(빠듯.한도.미룸, 2);
  assert.equal(빠듯.한도.풀림, '10-21 01:40');

  const 바닥 = 판(모두, new Map(), { ...공통, 한도: { 사용: 100 } });
  assert.equal(바닥.보냄.length, 0);
  assert.equal(바닥.한도대기.length, 4, '한도가 바닥이면 모두 미루되 하나도 버리지 않는다');

  const 모름 = 판(모두, new Map(), 공통);
  assert.equal(모름.한도, null, '한도를 안 주면 나눠 깨우지 않는다');
  assert.equal(모름.보냄.length, 4);
});

test('나누기: 지난번에 한도로 미룬 세션은 같은 무리 안에서 먼저 깨운다(마감·끊긴 세션이 늘 앞)', () => {
  const 끊김 = (덧) => 기록({ error: 'API Error', errorAt: 지금 - 30 * 분, ...덧 });
  const 새끊김 = 끊김({ title: '새 끊김', lastActivityAt: 지금 - 20 * 분 });
  const 미룬끊김 = 끊김({ title: '미룬 끊김', lastActivityAt: 지금 - 3 * 60 * 분 });
  const 미룬쉼 = 기록({ title: '미룬 쉼', lastActivityAt: 지금 - 4 * 60 * 분 });
  const 새쉼 = 기록({ title: '새 쉼', lastActivityAt: 지금 - 30 * 분 });
  const 마감 = 기록({
    title: '재도전 계획서',
    postTurnSummary: { status_category: 'review_ready', status_detail: '기한 10-21 23:59', needs_action: '' },
    lastActivityAt: 지금 - 5 * 60 * 분,
  });
  const 지난미룸 = new Map([
    [미룬끊김.sessionId, 지금 - 5 * 60 * 분],
    [미룬쉼.sessionId, 지금 - 5 * 60 * 분],
  ]);
  const 영상마감 = 기록({ title: '영상 마감 처리', lastActivityAt: 지금 - 6 * 60 * 분 });
  const r = 판([새끊김, 미룬끊김, 미룬쉼, 새쉼, 마감, 영상마감], new Map(), { 지난미룸 });
  assert.deepEqual(r.보냄.map((s) => s.제목), ['재도전 계획서', '미룬 끊김', '새 끊김', '미룬 쉼', '새 쉼', '영상 마감 처리'], '날짜 없는 「마감」은 마감이 아니다');
  assert.equal(r.보냄[1].지난번미룸, '10-20 14:30');
  assert.equal(r.보냄[2].지난번미룸, undefined);
});

test('원문 끝: 마지막 실제 응답의 문맥 크기와 마지막 보고 글, 세션 몫 어림', () => {
  const 쓴답 = {
    type: 'assistant',
    timestamp: new Date(지금 - 70 * 분).toISOString(),
    message: {
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text: '남은 일은 없습니다.' }],
      usage: { input_tokens: 2, cache_creation_input_tokens: 3000, cache_read_input_tokens: 700000, output_tokens: 90 },
    },
  };
  const 한도답 = {
    type: 'assistant',
    timestamp: new Date(지금 - 60 * 분).toISOString(),
    isApiErrorMessage: true,
    message: {
      role: 'assistant',
      model: '<synthetic>',
      content: [{ type: 'text', text: "You've hit your session limit" }],
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
    },
  };
  assert.equal(고르기.문맥크기([사람('해 줘'), 쓴답, 한도답]), 703002, '한도 오류 글(usage 0)은 건너뛴다');
  assert.equal(고르기.문맥크기([사람('해 줘')]), 0);
  assert.deepEqual(
    고르기.마지막보고([사람('해 줘'), { ...쓴답, uuid: 'u1' }, { ...한도답, uuid: 'u2' }]),
    { 글: '남은 일은 없습니다.', 온전: true, uuid: 'u2' },
    '한도 오류 글은 보고가 아니고, uuid는 원문 마지막 응답 줄 것이다',
  );
  /* 보고 → 도구 → 짧은 마무리 글: 그 차례의 응답 글을 모두 잇는다(마지막 글만 보면 앞의 「확인 못함」을 놓친다). */
  const 여러글 = 고르기.마지막보고([사람('해 줘'), 답('보고: CI는 확인하지 못했습니다.'), 도구부름(), 도구결과('ok'), 답('보관하겠습니다.')]);
  assert.equal(여러글.글, '보고: CI는 확인하지 못했습니다.\n보관하겠습니다.');
  assert.equal(여러글.온전, true);
  assert.equal(고르기.마지막보고([쓴답, 도구부름(), 도구결과(보정), 답('No response requested.')]).글, '남은 일은 없습니다.');
  assert.equal(고르기.마지막보고([쓴답, 도구부름(), 도구결과('ok')]).온전, false, '읽은 범위에 차례를 연 글이 없으면 온전하지 않다');
  assert.deepEqual(고르기.마지막보고([사람('해 줘')]), { 글: '', 온전: true, uuid: '' });
  assert.equal(고르기.세션몫(70 * 만), 2.1);
  assert.equal(고르기.세션몫(0), 1.8, '문맥을 모르면 60만으로 친다');
  assert.equal(고르기.세션몫(5 * 만), 0.5, '아무리 작아도 0.5');
});

test('보고걸림: 남은 일이 없다고 밝힌 보고만 깨끗, 남은 일·미확인·유호님 할 일·앞으로 할 일·질문·끝맺음 없음은 걸림', () => {
  const 깨끗 = [
    '그래서 이 작업으로 남은 일은 없습니다.',
    '적용안을 쓸 줄이 없어서 그대로 끝냈습니다.',
    '판단할 팁 줄이 없었어요.',
    '남의 미커밋 수정과 origin이 넣은 줄은 그대로 두었습니다. 남은 일은 없습니다.',
    '커밋 다섯 개가 모두 origin에 있고, 워크트리에 미커밋 변경과 돌고 있는 작업은 없습니다. 남은 일은 없습니다.',
    '그 세션에 답했습니다. 이 세션은 그대로 종료하셔도 됩니다.',
    'synk-tip review: 0 pending rows. 끝냈습니다.',
    '오늘 기준 93일 남았습니다. 더 할 일은 없습니다.',
    '공개 주소는 https://synk.im/world?x=1 입니다. 다시 배포할 필요는 없습니다. 남은 일은 없습니다.',
    '할 일이 없어서 그대로 끝냈습니다.',
  ];
  for (const 글 of 깨끗) assert.equal(고르기.보고걸림(글), '', 글);
  /* 「마쳤습니다·끝났습니다」 같은 일반 완료어나 「필요 없음」만으로는 끝맺음이 아니다(10-20 Fable). */
  for (const 글 of ['작업을 마쳤습니다.', '렌더가 끝났습니다.', '다시 배포할 필요 없이 끝났습니다.', '팁 장부에 대기 중인 줄이 하나도 없습니다.']) {
    assert.equal(고르기.보고걸림(글), '끝맺음 말이 없음', 글);
  }
  const 걸림 = [
    /* 10-20 Fable 검수가 찾은, 예전 판에서 깨끗으로 통과하던 보고들 */
    ['작업을 마쳤습니다. 공개는 내일 하겠습니다.', '「내일」'],
    ['CI가 통과하면 공개할 예정입니다. 남은 일은 없습니다.', '「예정」'],
    ['Fable 검수 에이전트를 띄웠고 결과가 오면 반영하겠습니다. 남은 일은 없습니다.', '「띄웠」'],
    ['검수 대기입니다. 남은 일은 없습니다.', '「대기」'],
    ['push는 하지 않았습니다. 남은 일은 없습니다.', '「않았」'],
    ['커밋은 안 했습니다. 남은 일은 없습니다.', '「안 했」'],
    ['push가 남습니다. 남은 일은 없습니다.', '「남습」'],
    ['올리기가 막혀 트랙에 적었습니다. 남은 일은 없습니다.', '「막혀」'],
    ['영상 렌더 중입니다. 남은 일은 없습니다.', '「더 중입니다」'],
    ['운영 반영은 다음 세션이 맡습니다. 남은 일은 없습니다.', '「다음 세션」'],
    ['17판 세션이 합니다. 남은 일은 없습니다.', '「세션이 합」'],
    ['prod deploy not yet. 남은 일은 없습니다.', '「not yet」'],
    ['남은 작업은 다 끝나지 않았습니다.', '「남은 작업」'],
    ['할 일이 모두 끝난 것은 아닙니다.', '「할 일이」'],
    ['남은 일이 없다고는 못 합니다.', '「남은 일」'],
    ['남은 일은 없습니다. **이대로 띄울까요?**', '「까요」'],
    ['남은 일은 없습니다. 어느 쪽이 좋습니까?**', '「습니까」'],
    ['제 커밋을 origin에 올렸습니다. CI 미확인.', '「미확인」'],
    ['origin CI 결과는 확인하지 않았어요. 여기서 끝이에요.', '「확인하지 않」'],
    ['마쳤습니다. 휴대폰에서 하실 것: 인스타 댓글 고정만 남았어요.', '「하실 것」'],
    ['로그인 마무리는 못 했고, 유호님 몫으로 남겼습니다.', '「못 했」'],
    ['로그인이 필요한 마무리는 유호님 몫입니다. 끝냈습니다.', '「필요」'],
    ['끝냈습니다. 배포는 확인 필요.', '「필요」'],
    ['남은 건 댓글 고정뿐입니다. 끝냈습니다.', '「남은 건」'],
    ['유호님이 할 일은 업로드 확인입니다. 마쳤습니다.', '「할 일은」'],
    ['유호님이 보시고 고르시면 됩니다. 마쳤습니다.', '「보시고」'],
    ['공개는 아직 하지 않았습니다. 마쳤습니다.', '「아직」'],
    ['두 세션이 이어서 맡고 있어 보관하지 않고 그대로 둡니다.', '「세션이 이어」'],
    ['남은 일 셋은 새 작업 카드로 남겨 두었습니다.', '「남은 일」'],
    ['다 했습니다. 다음 묶음도 바로 띄울까요?', '「다음 묶음」'],
    ['다 끝냈습니다. 이대로 둘까요?', '「까요」'],
    ['올렸습니다.', '끝맺음 말이 없음'],
  ];
  for (const [글, 기대] of 걸림) assert.equal(고르기.보고걸림(글), 기대, 글);
});

/* ── 파일에서 끝까지 ─────────────────────────────────────────────────── */

function 임시폴더() {
  return fs.mkdtempSync(path.join(os.tmpdir(), '이어서-'));
}

function 원문쓰기(뿌리, 기록값, 메시지들, 꼬리 = '') {
  const 폴더 = path.join(뿌리, 고르기.원문폴더이름(기록값.cwd));
  fs.mkdirSync(폴더, { recursive: true });
  const 메타 = JSON.stringify({ type: 'custom-title', customTitle: 'x' });
  const 줄들 = [메타, ...메시지들.map((m) => JSON.stringify(m)), 메타];
  fs.writeFileSync(path.join(폴더, `${기록값.cliSessionId}.jsonl`), `${줄들.join('\n')}\n${꼬리}`);
}

test('실행: 기록·원문 폴더를 읽어 칸을 나누고, --busy·이 세션이 없으면 고르지 않는다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const 기록폴더 = path.join(바탕, 'sessions', 'acct', 'org');
  const 원문뿌리 = path.join(바탕, 'projects');
  fs.mkdirSync(기록폴더, { recursive: true });
  const 나 = 기록({ title: '이어서 실행' });
  const 한도 = 기록({ title: '한도' });
  const 재시작 = 기록({ title: '재시작', cwd: 'C:\\work\\repo\\.claude\\worktrees\\abc' });
  const 끝 = 기록({ title: '끝남' });
  const 원문없음 = 기록({ title: '원문 없음' });
  const 보관됨 = 기록({ title: '보관됨', isArchived: true });
  const 예약완료 = 기록({ title: '예약 완료', scheduledTaskId: 'tip', postTurnSummary: { status_category: 'completed', summarizes_uuid: 'u-예약' } });
  const 원문없는완료 = 기록({ title: '원문 없는 완료', postTurnSummary: { status_category: 'completed', summarizes_uuid: 'u-원문없음' } });
  for (const r of [나, 한도, 재시작, 끝, 원문없음, 보관됨, 예약완료, 원문없는완료]) {
    fs.writeFileSync(path.join(기록폴더, `${r.sessionId}.json`), JSON.stringify(r));
  }
  fs.writeFileSync(path.join(기록폴더, 'archived-sessions.idx'), 'x');
  원문쓰기(원문뿌리, 한도, [사람('해 줘'), 답("You've hit your session limit · resets 8:20pm", 지금 - 40 * 분, { isApiErrorMessage: true })]);
  /* 메시지 뒤에 메타 줄이 1MB 넘게 붙어 있어도 읽는 범위를 넓혀 찾는다. */
  const 큰꼬리 = `${JSON.stringify({ type: 'attachment', attachment: { type: 'x', content: 'x'.repeat(1000) } })}\n`.repeat(1400);
  원문쓰기(원문뿌리, 재시작, [도구부름(), 도구결과(보정), 답('No response requested.')], 큰꼬리);
  원문쓰기(원문뿌리, 끝, [사람('해 줘'), 답('다 했습니다.')]);
  원문쓰기(원문뿌리, 예약완료, [사람('예약 실행'), { ...답('적용안을 쓸 줄이 없어서 그대로 끝냈습니다.'), uuid: 'u-예약' }]);

  const 공통 = ['--기록', 기록폴더, '--원문', 원문뿌리, '--지금', new Date(지금).toISOString()];
  const 결과 = 고르기.실행(['--self', 나.sessionId, '--busy', '', ...공통], {});
  assert.equal(결과.ok, true, JSON.stringify(결과));
  assert.equal(결과.세션수, 6);
  assert.deepEqual(new Set(결과.보냄.map((s) => s.제목)), new Set(['한도', '재시작', '끝남', '원문 없음', '원문 없는 완료']));
  assert.deepEqual(결과.보관.map((s) => s.제목), ['예약 완료'], '원문이 깨끗하게 끝난 예약 실행만 보관한다');
  assert.match(결과.보냄.find((s) => s.제목 === '원문 없는 완료').이유, /마지막 보고를 읽지 못함/, '원문을 못 읽으면 완료여도 깨운다');
  assert.equal(결과.보냄.find((s) => s.제목 === '한도').이유, '사용량 한도로 끊김');
  assert.equal(결과.보냄.find((s) => s.제목 === '재시작').이유, '앱 재시작·계정 전환으로 끊김');
  assert.equal(결과.보냄.find((s) => s.제목 === '재시작').워크트리, true);
  assert.ok(결과.알림.some((a) => a.includes('원문을 못 찾은 세션 2개')), JSON.stringify(결과.알림));
  assert.ok(결과.알림.some((a) => a.includes('5시간 한도를 넘겨받지 않아')), '--한도가 없으면 나눠 깨우지 않았다고 알린다');
  assert.equal(결과.한도, null);
  assert.equal(결과.기억, null, '--기록으로 돌리면 --미룸파일 없이는 미룸 파일을 읽지도 쓰지도 않는다');

  const 바쁨 = 고르기.실행(['--self', 나.sessionId, '--busy', `${한도.sessionId},${재시작.sessionId.slice(6, 14)}`, ...공통], {});
  assert.deepEqual(바쁨.일하는중.map((s) => s.제목).sort(), ['재시작', '한도']);
  assert.ok(!바쁨.알림.some((a) => a.includes('기록에 없는')), '앞부분으로 준 id도 기록에 있는 것으로 센다');

  /* 기록 하나가 깨져 있으면 곁 세션 관계를 믿을 수 없으니 바로 보관하지 않는다. */
  fs.writeFileSync(path.join(기록폴더, 'local_eeeeeeee-0000-4000-8000-000000000000.json'), '{');
  const 깨짐 = 고르기.실행(['--self', 나.sessionId, '--busy', '', ...공통], {});
  assert.equal(깨짐.보관.length, 0);
  assert.ok(깨짐.보냄.some((s) => s.제목 === '예약 완료'));
  assert.ok(깨짐.알림.some((a) => a.includes('읽지 못한 세션 기록 1개')));

  assert.equal(고르기.실행(['--self', 나.sessionId, ...공통], {}).ok, false, '--busy가 없으면 고르지 않는다');
  assert.equal(고르기.실행(['--self', 'local_ffffffff-0000-4000-8000-000000000000', '--busy', '', ...공통], {}).ok, false);
  assert.equal(고르기.실행(['--busy', '', ...공통], {}).ok, false);
  assert.throws(() => 고르기.실행(['--모름'], {}), /모르는 인자/);
});

test('원문 끝: 읽는 범위 끝까지 메시지가 없으면 빈 목록(모름)이다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const 기록값 = 기록({});
  const 꼬리 = `${JSON.stringify({ type: 'attachment', attachment: { content: 'y'.repeat(2000) } })}\n`.repeat(200);
  원문쓰기(바탕, 기록값, [사람('해 줘'), 답('다 했습니다.')], 꼬리);
  const 파일 = 고르기.원문찾기(바탕, 기록값);
  assert.deepEqual(고르기.원문끝메시지(파일, 6, [64 * 1024, 128 * 1024]), [], '범위 안에 메시지가 없으면 비어 있다');
  assert.equal(고르기.끝판정(고르기.원문끝메시지(파일, 6, [64 * 1024, 128 * 1024])).종류, '모름');
  assert.equal(고르기.끝판정(고르기.원문끝메시지(파일)).종류, '끝남', '기본 범위면 찾는다');
});

test('지금계정폴더: 돌려 쓴 로그까지 보고 가장 늦은 로그인 줄을 고르며, 못 찾으면 확실하지 않다고 표시한다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const 뿌리 = path.join(바탕, 'claude-code-sessions');
  const A = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
  const B = ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
  for (const [계정, 조직] of [A, B]) {
    fs.mkdirSync(path.join(뿌리, 계정, 조직), { recursive: true });
    fs.writeFileSync(path.join(뿌리, 계정, 조직, 'local_1.json'), '{}');
  }
  const 로그폴더 = path.join(바탕, 'logs');
  fs.mkdirSync(로그폴더);
  const 줄 = (시각, [계정, 조직]) =>
    `${시각} [info] [LocalSessionManager] Initialization succeeded — accountId=${계정}, orgId=${조직}, existingSessions=0`;
  /* 막 돌려 써서 main.log에는 로그인 줄이 없고, main1.log에 두 번 있다. */
  fs.writeFileSync(path.join(로그폴더, 'main.log'), '2026-10-20 19:30:00 [info] something\r\n');
  fs.writeFileSync(path.join(로그폴더, 'main1.log'), [줄('2026-10-20 18:14:17', B), 줄('2026-10-20 19:23:16', A), ''].join('\r\n'));
  fs.writeFileSync(path.join(로그폴더, 'main2.log'), [줄('2026-10-19 10:00:00', B), ''].join('\r\n'));
  const 로그들 = fs.readdirSync(로그폴더).map((f) => path.join(로그폴더, f));
  const 로그로 = 고르기.지금계정폴더({ 뿌리들: [뿌리], 로그들 });
  assert.equal(로그로.폴더, path.join(뿌리, A[0], A[1]));
  assert.equal(로그로.확실, true);
  assert.match(로그로.근거, /19:23:16/);

  const 나중 = new Date(Date.now() + 60 * 1000);
  fs.utimesSync(path.join(뿌리, B[0], B[1]), 나중, 나중);
  const 로그없이 = 고르기.지금계정폴더({ 뿌리들: [뿌리], 로그들: [] });
  assert.equal(로그없이.폴더, path.join(뿌리, B[0], B[1]));
  assert.equal(로그없이.확실, false);
  assert.equal(고르기.지금계정폴더({ 뿌리들: [], 로그들: [] }), null);
});

test('로그후보: 앱 로그 폴더의 main.log와 돌려 쓴 main1.log…를 모두 찾는다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const 로그폴더 = path.join(바탕, 'Claude', 'logs');
  fs.mkdirSync(로그폴더, { recursive: true });
  for (const f of ['main.log', 'main1.log', 'main3.log', 'renderer.log']) fs.writeFileSync(path.join(로그폴더, f), 'x');
  const 찾음 = 고르기.로그후보({ LOCALAPPDATA: 바탕 }).map((p) => path.basename(p)).sort();
  assert.deepEqual(찾음, ['main.log', 'main1.log', 'main3.log']);
});

/* 원문에 남는 실제 응답 한 줄(문맥 크기 usage 포함). */
const 응답 = (문맥, 시각) => ({
  type: 'assistant',
  timestamp: new Date(시각).toISOString(),
  message: {
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }],
    usage: { input_tokens: 2, cache_creation_input_tokens: 1000, cache_read_input_tokens: 문맥 - 1002, output_tokens: 50 },
  },
});

test('실행: 한도로 미룬 세션은 보고(한도대기)와 미룸 파일에 남고, 다음 /이어서에서 먼저 깨운다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const 기록폴더 = path.join(바탕, 'sessions', 'acct', 'org');
  const 원문뿌리 = path.join(바탕, 'projects');
  const 미룸파일 = path.join(바탕, 'state', '이어서_미룸.json');
  fs.mkdirSync(기록폴더, { recursive: true });
  const 나 = 기록({ title: '이어서 실행' });
  const 앞 = 기록({ title: '앞 끊김', error: 'API Error', errorAt: 지금 - 30 * 분, lastActivityAt: 지금 - 30 * 분 });
  const 뒤 = 기록({ title: '뒤 끊김', error: 'API Error', errorAt: 지금 - 40 * 분, lastActivityAt: 지금 - 40 * 분 });
  const 쓰기 = (r) => fs.writeFileSync(path.join(기록폴더, `${r.sessionId}.json`), JSON.stringify(r));
  [나, 앞, 뒤].forEach(쓰기);
  원문쓰기(원문뿌리, 앞, [사람('해 줘'), 응답(50 * 만, 지금 - 31 * 분), 답('API Error: 500', 지금 - 30 * 분, { isApiErrorMessage: true })]);
  원문쓰기(원문뿌리, 뒤, [사람('해 줘'), 응답(50 * 만, 지금 - 41 * 분), 답('API Error: 500', 지금 - 40 * 분, { isApiErrorMessage: true })]);
  const 공통 = ['--self', 나.sessionId, '--busy', '', '--기록', 기록폴더, '--원문', 원문뿌리, '--미룸파일', 미룸파일];

  /* 몫은 문맥 50만이라 1.5씩. 사용 88 → 여유 12 − 남길 10 = 2: 앞 하나만 깨운다. */
  const 첫 = 고르기.실행([...공통, '--지금', new Date(지금).toISOString(), '--한도', '88', '--한도풀림', '2026-10-20T16:40:00.168Z'], {});
  assert.equal(첫.ok, true, JSON.stringify(첫));
  assert.deepEqual(첫.보냄.map((s) => s.제목), ['앞 끊김']);
  assert.deepEqual(첫.한도대기.map((s) => s.제목), ['뒤 끊김'], '미룬 세션이 보고에 남는다');
  assert.equal(첫.한도대기[0].이유, '오류로 끊김', '미뤄도 깨울 까닭은 그대로다');
  assert.equal(첫.한도.풀림, '10-21 01:40');
  assert.ok(첫.알림.some((a) => a.includes('1개는 한도가 풀린 뒤 /이어서를 다시 치면 깨웁니다')), JSON.stringify(첫.알림));
  assert.deepEqual(첫.기억, { 파일: 미룸파일, 지난번: 0, 이번: 1 });
  assert.deepEqual(JSON.parse(fs.readFileSync(미룸파일, 'utf8')).미룸.map((s) => s.id), [뒤.sessionId], '미룬 세션을 파일에 적어 둔다');

  /* 같은 /이어서의 다시 고르기(1분 뒤)에서는 방금 미룬 세션을 앞세우지 않는다 — 차례가 뒤집히지 않는다. */
  const 다시 = 고르기.실행([...공통, '--지금', new Date(지금 + 분).toISOString(), '--한도', '88'], {});
  assert.deepEqual(다시.보냄.map((s) => s.제목), ['앞 끊김']);
  assert.equal(JSON.parse(fs.readFileSync(미룸파일, 'utf8')).미룸[0].미룬때, new Date(지금).toISOString(), '처음 미룬 때를 그대로 둔다');

  /* 다음 실행: 앞 세션이 그새 다시 일하다 더 최근에 끊겼어도, 지난번에 미룬 뒤 세션을 먼저 깨운다. */
  Object.assign(앞, { errorAt: 지금 + 50 * 분, lastActivityAt: 지금 + 50 * 분 });
  쓰기(앞);
  const 나중 = new Date(지금 + 60 * 분).toISOString();
  const 둘째 = 고르기.실행([...공통, '--지금', 나중, '--한도', '88'], {});
  assert.deepEqual(둘째.보냄.map((s) => s.제목), ['뒤 끊김'], '지난번에 미룬 세션을 먼저 깨운다');
  assert.equal(둘째.보냄[0].지난번미룸, '10-20 19:30');
  assert.deepEqual(둘째.한도대기.map((s) => s.제목), ['앞 끊김']);
  assert.deepEqual(둘째.기억, { 파일: 미룸파일, 지난번: 1, 이번: 1 });
  assert.deepEqual(
    JSON.parse(fs.readFileSync(미룸파일, 'utf8')).미룸.map((s) => s.id),
    [앞.sessionId],
    '이번에 깨운 세션은 빠지고 이번에 미룬 세션이 남는다',
  );

  /* 여유가 넉넉하면 다 깨우고 미룸 파일을 비운다. */
  const 셋째 = 고르기.실행([...공통, '--지금', 나중, '--한도', '5'], {});
  assert.equal(셋째.한도대기.length, 0);
  assert.deepEqual(셋째.보냄.map((s) => s.제목), ['앞 끊김', '뒤 끊김']);
  assert.deepEqual(JSON.parse(fs.readFileSync(미룸파일, 'utf8')).미룸, []);
});

test('실행: --한도 값이 이상하면 나눠 깨우지 않고 알리고, 우회 모드에서 치면 최상위·우회 세션에도 보낸다고 알린다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const 나 = 기록({ title: '이어서 실행' });
  const 우회 = 기록({ title: '최상위 우회', permissionMode: 'bypassPermissions', error: 'API Error', errorAt: 지금 - 30 * 분 });
  for (const r of [나, 우회]) fs.writeFileSync(path.join(바탕, `${r.sessionId}.json`), JSON.stringify(r));
  const 기본 = ['--self', 나.sessionId, '--busy', '', '--기록', 바탕, '--원문', path.join(바탕, 'p'), '--지금', new Date(지금).toISOString()];
  const 이상 = 고르기.실행([...기본, '--한도', '많이'], {});
  assert.ok(이상.알림.some((a) => a.includes('--한도 값을 읽지 못해 나눠 깨우지 않았습니다: 많이')), JSON.stringify(이상.알림));
  assert.equal(이상.한도, null);
  const 빠짐 = 고르기.실행([...기본, '--한도', '--전부'], {});
  assert.ok(빠짐.알림.some((a) => a.includes('(빈 값)')), '값이 빠진 --한도는 다음 인자를 먹지 않는다');
  const 자동에서 = 고르기.실행([...기본, '--내모드', 'auto', '--한도', '30%'], {});
  assert.equal(칸(자동에서, 우회.sessionId), '직접입력');
  assert.equal(자동에서.한도.사용, 30);
  const 우회에서 = 고르기.실행([...기본, '--내모드', 'bypassPermissions'], {});
  assert.equal(칸(우회에서, 우회.sessionId), '보냄');
  assert.ok(
    우회에서.알림.some((a) => a.includes('이 세션이 권한 우회 모드라 최상위·우회 모드 세션 1개에도 보냅니다')),
    JSON.stringify(우회에서.알림),
  );
  assert.ok(!우회에서.알림.some((a) => a.includes('실측하지 않았습니다')), '우회 모드에서 보내는 길은 10-21 실측으로 맞아 실측 전이라는 알림을 붙이지 않는다');
});

test('로그읽기: 다른 세션 글을 받지 않은 때(refused)와 띄울 때의 권한 모드를 세션별 마지막 값으로 뽑는다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const A = 'local_aaaaaaaa-0000-4000-8000-000000000000';
  const B = 'local_bbbbbbbb-0000-4000-8000-000000000000';
  const C = 'local_cccccccc-0000-4000-8000-000000000000';
  const 꼬리 = (모드) => `provisional=false source=unknown autoState=unknown requested=${모드} effective=${모드} mdmAutoOff=false`;
  const 입력 = '192ef09a-066d-483d-995d-05a8373c19c9';
  const D = 'local_dddddddd-0000-4000-8000-000000000000';
  fs.writeFileSync(path.join(바탕, 'main1.log'), [`2026-10-20 19:00:00 [info] [permissionMode] spawn ${A} mode=default ${꼬리('default')}`, ''].join('\r\n'));
  fs.writeFileSync(
    path.join(바탕, 'main.log'),
    [
      `2026-10-20 20:44:25 [info] [permissionMode] spawn ${A} mode=auto ${꼬리('auto')}`,
      `2026-10-20 20:45:03 [info] [permissionMode] spawn ${A} mode=bypassPermissions ${꼬리('bypassPermissions')}`,
      `2026-10-20 20:46:00 [info] [permissionMode] spawn ${D} mode=auto provisional=false source=unknown autoState=unknown requested=auto effective=default mdmAutoOff=true`,
      `2026-10-20 20:45:10 [info] [LocalSessionManager] CLI undelivered input ${입력} for ${B} without running it — settled (hold=false cycle=true next=false)`,
      `2026-10-20 20:45:10 [warn] [LocalSessionManager] peer input ${입력} for ${B} drew no acknowledgement from the CLI in 45005ms — settled as undelivered (ownedCycle=true)`,
      `2026-10-20 20:49:27 [info] [LocalSessionManager] CLI refused input ${입력} for ${B} without running it — settled (hold=false cycle=false next=false)`,
      `2026-10-20 20:50:00 [info] [LocalSessionManager] CLI undelivered input ${입력} for ${C} without running it — settled (hold=false cycle=true next=false)`,
      '',
    ].join('\r\n'),
  );
  const 때 = (s) => Date.parse(`2026-10-20T${s}`); // 앱 로그는 PC 시간대로 적힌다
  const { 거절들, 모드들 } = 고르기.로그읽기(['main1.log', 'main.log'].map((f) => path.join(바탕, f)));
  assert.equal(거절들.get(B), 때('20:49:27'));
  assert.equal(거절들.has(C), false, '45초 무응답(undelivered)은 늦게라도 들어갈 수 있어 세지 않는다');
  assert.deepEqual(모드들.get(A), { 모드: 'bypassPermissions', 시각: 때('20:45:03') }, '파일 순서가 아니라 줄 시각으로 마지막 모드를 고른다');
  assert.equal(모드들.get(D).모드, 'default', '요청한 모드가 막혀 실제 모드(effective)가 다르면 실제 모드를 쓴다');
});

test('워크트리상태: git으로 미커밋·미푸시를 세고, 다시 쌓아 올린 커밋은 올라간 것으로, origin에 없는 커밋은 공용 master에 있어도 미푸시로 친다', (t) => {
  const 바탕 = 임시폴더();
  t.after(() => fs.rmSync(바탕, { recursive: true, force: true }));
  const g = (폴더, ...인자) =>
    execFileSync('git', ['-C', 폴더, '-c', 'user.name=시험', '-c', 'user.email=test@example.invalid', ...인자], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const 원격 = path.join(바탕, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'master', 원격], { stdio: 'ignore' });
  const 본 = path.join(바탕, 'main');
  execFileSync('git', ['clone', '-q', 원격, 본], { stdio: 'ignore' });
  g(본, 'config', 'core.autocrlf', 'false');
  const 커밋 = (폴더, 파일, 제목) => {
    fs.writeFileSync(path.join(폴더, 파일), `${파일}\n`);
    g(폴더, 'add', 파일);
    g(폴더, 'commit', '-q', '-m', 제목);
  };
  커밋(본, 'a.txt', '처음');
  g(본, 'push', '-q', 'origin', 'HEAD:master');
  const wt = path.join(바탕, 'wt');
  g(본, 'worktree', 'add', '-q', '-b', 'claude/wt', wt);
  const 상태 = () => 고르기.워크트리상태({ worktreePath: wt });
  assert.deepEqual(상태(), { 깨끗: true, 미커밋: 0, 미푸시: 0 });
  fs.writeFileSync(path.join(wt, 'b.txt'), 'b\n');
  assert.equal(상태().까닭, '미커밋 1', '추적하지 않는 새 파일도 센다(보관하면 워크트리와 함께 지워진다)');
  g(wt, 'add', 'b.txt');
  g(wt, 'commit', '-q', '-m', '곁 세션 일');
  assert.equal(상태().까닭, '미푸시 1');
  /* 내커밋.js 올리기처럼 origin 위에 같은 변경을 다시 쌓아 올리면 커밋 번호가 달라도 올라간 것으로 본다. */
  const 곁커밋 = g(wt, 'rev-parse', 'HEAD').trim();
  커밋(본, 'c.txt', '남의 일');
  g(본, 'cherry-pick', 곁커밋);
  g(본, 'push', '-q', 'origin', 'HEAD:master');
  assert.notEqual(g(본, 'rev-parse', 'HEAD').trim(), 곁커밋);
  assert.deepEqual(상태(), { 깨끗: true, 미커밋: 0, 미푸시: 0 });
  /* 공용 작업본 master에만 있고 origin에 없는 커밋(물려받은 미푸시 꼬리, master에 합친 이 세션 커밋)은 미푸시로 친다 —
   * 「origin에 반영됐을 때만 보관」을 지키는 보수 쪽이다. 그 세션을 깨워 스스로 정하게 한다(10-20 Fable). */
  커밋(본, 'd.txt', '공용 꼬리');
  const wt2 = path.join(바탕, 'wt2');
  g(본, 'worktree', 'add', '-q', '-b', 'claude/wt2', wt2);
  assert.deepEqual(고르기.워크트리상태({ worktreePath: wt2 }), { 깨끗: false, 미커밋: 0, 미푸시: 1, 까닭: '미푸시 1' });
  /* 분리된 HEAD도 같은 기준으로 센다. */
  g(wt, 'checkout', '-q', '--detach');
  assert.deepEqual(상태(), { 깨끗: true, 미커밋: 0, 미푸시: 0 });
  assert.deepEqual(고르기.워크트리상태({ cwd: path.join(바탕, '.claude', 'worktrees', '없음') }), { 깨끗: false, 까닭: '폴더를 찾지 못함' });
  assert.deepEqual(고르기.워크트리상태({ cwd: 'C:\\work\\repo' }), { 깨끗: false, 까닭: '폴더를 찾지 못함' }, '워크트리가 아닌 폴더는 보지 않는다');
});
