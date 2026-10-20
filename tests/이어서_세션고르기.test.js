'use strict';
/* /이어서 스킬의 세션고르기 — 어떤 세션에 「이어서 해」를 보내고, 무엇을 바로 보관하고, 무엇을 건드리지 않는지. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 고르기 = require('../.claude/skills/이어서/세션고르기.cjs');

const 지금 = Date.parse('2026-10-20T10:30:00Z');
const 분 = 60 * 1000;
const 일 = 24 * 60 * 분;

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

test('나누기: 예약 실행이 완료로 끝났으면 바로 보관하되, 대화형·워크트리·곁 세션·남은 쪽지·할 일이 있으면 아니다', () => {
  const 예약 = (덧 = {}) => 기록({ scheduledTaskId: 'tip-review', postTurnSummary: { status_category: 'completed' }, ...덧 });
  const 예약완료 = 예약({
    postTurnSummary: { status_category: 'completed', status_detail: '7일 지표 판정 완료; 훅 접기 권장', needs_action: '' },
  });
  const 대화형완료 = 기록({ postTurnSummary: { status_category: 'completed' } });
  const 워크트리완료 = 예약({ cwd: 'C:\\work\\repo\\.claude\\worktrees\\x' });
  const 부모완료 = 예약();
  const 자식 = 예약({ spawnedFrom: JSON.stringify({ sessionId: 부모완료.sessionId }) });
  const 쪽지 = 예약({ queuedSideSessionNotes: [{ sessionId: 'local_z' }] });
  const 할일남음 = 예약({ postTurnSummary: { status_category: 'completed', needs_action: '결과 읽기' } });
  const r = 판([예약완료, 대화형완료, 워크트리완료, 부모완료, 자식, 쪽지, 할일남음]);
  assert.equal(칸(r, 예약완료.sessionId), '보관');
  assert.equal(r.보관.find((s) => s.id === 예약완료.sessionId).이유, '예약 실행이 완료로 끝남');
  assert.equal(칸(r, 자식.sessionId), '보관');
  assert.equal(칸(r, 대화형완료.sessionId), '보냄', '대화형 세션의 완료는 마지막 차례 기준 — 깨워서 스스로 정한다');
  assert.equal(칸(r, 워크트리완료.sessionId), '보냄');
  assert.notEqual(칸(r, 부모완료.sessionId), '보관', '보관하면 곁 세션도 같이 보관된다');
  assert.equal(칸(r, 쪽지.sessionId), '보냄');
  assert.equal(칸(r, 할일남음.sessionId), '유호님차례');
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
  const 예약완료 = 기록({ title: '예약 완료', scheduledTaskId: 'tip', postTurnSummary: { status_category: 'completed' } });
  for (const r of [나, 한도, 재시작, 끝, 원문없음, 보관됨, 예약완료]) {
    fs.writeFileSync(path.join(기록폴더, `${r.sessionId}.json`), JSON.stringify(r));
  }
  fs.writeFileSync(path.join(기록폴더, 'archived-sessions.idx'), 'x');
  원문쓰기(원문뿌리, 한도, [사람('해 줘'), 답("You've hit your session limit · resets 8:20pm", 지금 - 40 * 분, { isApiErrorMessage: true })]);
  /* 메시지 뒤에 메타 줄이 1MB 넘게 붙어 있어도 읽는 범위를 넓혀 찾는다. */
  const 큰꼬리 = `${JSON.stringify({ type: 'attachment', attachment: { type: 'x', content: 'x'.repeat(1000) } })}\n`.repeat(1400);
  원문쓰기(원문뿌리, 재시작, [도구부름(), 도구결과(보정), 답('No response requested.')], 큰꼬리);
  원문쓰기(원문뿌리, 끝, [사람('해 줘'), 답('다 했습니다.')]);

  const 공통 = ['--기록', 기록폴더, '--원문', 원문뿌리, '--지금', new Date(지금).toISOString()];
  const 결과 = 고르기.실행(['--self', 나.sessionId, '--busy', '', ...공통], {});
  assert.equal(결과.ok, true, JSON.stringify(결과));
  assert.equal(결과.세션수, 5);
  assert.deepEqual(new Set(결과.보냄.map((s) => s.제목)), new Set(['한도', '재시작', '끝남', '원문 없음']));
  assert.deepEqual(결과.보관.map((s) => s.제목), ['예약 완료']);
  assert.equal(결과.보냄.find((s) => s.제목 === '한도').이유, '사용량 한도로 끊김');
  assert.equal(결과.보냄.find((s) => s.제목 === '재시작').이유, '앱 재시작·계정 전환으로 끊김');
  assert.equal(결과.보냄.find((s) => s.제목 === '재시작').워크트리, true);
  assert.ok(결과.알림.some((a) => a.includes('원문을 못 찾은 세션 2개')), JSON.stringify(결과.알림));

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
