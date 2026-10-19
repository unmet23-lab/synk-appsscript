'use strict';

// 텔레그램 승인 훅 — 임시 폴더의 가짜 기록·가짜 설정만 쓴다. 텔레그램은 보내지 않고(SYNK_TG_DRYRUN_DIR) 실제 설정 파일도 건드리지 않는다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');

const 승인 = require('../tools/텔레그램승인.js');
const 도구 = path.join(__dirname, '..', 'tools', '텔레그램승인.js');

function 방만들기() {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tg-approval-'));
  const 환경 = { SYNK_APPROVAL_DIR: path.join(방, 'store'), SYNK_TG_DRYRUN_DIR: path.join(방, 'tg') };
  let 번호 = 0;
  const 세션 = (첫글 = '그냥 대화') => {
    번호 += 1;
    const id = `00000000-0000-4000-8000-${String(번호).padStart(12, '0')}`;
    const 기록경로 = path.join(방, 'projects', `${id}.jsonl`);
    fs.mkdirSync(path.dirname(기록경로), { recursive: true });
    fs.writeFileSync(기록경로, [JSON.stringify({ type: 'queue-operation' }), JSON.stringify({ type: 'user', message: { role: 'user', content: 첫글 } })].join('\n') + '\n');
    return { id, 기록경로 };
  };
  const 막힘 = (s, 덧 = {}) => ({ session_id: s.id, transcript_path: s.기록경로, cwd: 방, permission_mode: 'auto', hook_event_name: 'PermissionDenied',
    tool_name: 'Bash', tool_input: { command: 'git push --force origin main', description: 'Force-push local main to origin' }, tool_use_id: 'toolu_01A', reason: '[Git Destructive]', ...덧 });
  const 멈춤 = (s, 덧 = {}) => ({ session_id: s.id, transcript_path: s.기록경로, cwd: 방, hook_event_name: 'Stop', stop_hook_active: false, last_assistant_message: '보고', ...덧 });
  const 기록 = (s) => JSON.parse(fs.readFileSync(path.join(환경.SYNK_APPROVAL_DIR, `${s.id}.json`), 'utf8'));
  const 보낸글 = () => (fs.existsSync(환경.SYNK_TG_DRYRUN_DIR) ? fs.readdirSync(환경.SYNK_TG_DRYRUN_DIR).sort().map((n) => fs.readFileSync(path.join(환경.SYNK_TG_DRYRUN_DIR, n), 'utf8')) : []);
  return { 방, 환경, 세션, 막힘, 멈춤, 기록, 보낸글, 지우기: () => fs.rmSync(방, { recursive: true, force: true }) };
}

const 예약첫글 = '<scheduled-task name="synk-tip-claude-review-2" file="C:\\Users\\q1212\\.claude\\scheduled-tasks\\synk-tip-claude-review-2\\SKILL.md">\nThis is an automated run of a scheduled task.';
const 두줄 = '보고를 마쳤어요.\n\n막힌 일: 원격 origin의 main을 로컬 main으로 강제 push하려다 막혔어요\n이어갈 문장: origin main에 강제 push해';

test('사람이 보는 세션은 기록도 알림도 하지 않는다', () => {
  const t = 방만들기();
  try {
    const s = t.세션('이거 고쳐줘');
    assert.equal(승인.훅처리(t.막힘(s), t.환경), '');
    assert.equal(승인.훅처리(t.멈춤(s, { last_assistant_message: 두줄 }), t.환경), '');
    assert.equal(fs.existsSync(t.환경.SYNK_APPROVAL_DIR), false);
    assert.deepEqual(t.보낸글(), []);
  } finally { t.지우기(); }
});

test('앱 예약 작업은 막힌 호출을 남기고, 끝날 때 두 줄로 알림 한 통을 보낸다(내부 번호 없음)', () => {
  const t = 방만들기();
  try {
    const s = t.세션(예약첫글);
    승인.훅처리(t.막힘(s, { tool_input: { command: 'git push --force origin main  # token=ghp_abcdefghijklmnopqrstuvwxyz', description: 'Force-push local main to origin' } }), { ...t.환경, CLAUDE_PID: '4242', CLAUDE_CODE_SESSION_ATTENDED: '0' });
    승인.훅처리(t.막힘(s), t.환경); // 같은 호출(tool_use_id)이 다시 와도 한 번만
    let r = t.기록(s);
    assert.deepEqual([r.state, r.source, r.denials.length, r.claude_pid, r.attended], ['recording', { kind: 'scheduled-task', name: 'synk-tip-claude-review-2' }, 1, 4242, '0']);
    assert.match(r.denials[0].command, /\[숨김\]/);
    assert.doesNotMatch(r.denials[0].command, /ghp_/);
    assert.equal(r.denials[0].reason, '[Git Destructive]');
    assert.equal(승인.훅처리(t.멈춤(s, { last_assistant_message: 두줄 }), t.환경), '');
    r = t.기록(s);
    assert.equal(r.state, 'notified');
    assert.match(r.notice.message_id, /^dryrun-/);
    assert.equal(r.notice.sentence, 'origin main에 강제 push해');
    const [글] = t.보낸글();
    assert.equal(글, r.notice.text);
    assert.deepEqual(글.split('\n'), [
      '자동 모드가 예약 작업의 한 단계를 막아 그 단계만 건너뛰었어요.',
      '막힌 일: 원격 origin의 main을 로컬 main으로 강제 push하려다 막혔어요',
      '이어 가려면 아래 문장을 그대로 보내 주세요(이 알림에 답장해도 돼요).',
      'origin main에 강제 push해',
      '건너뛴 채로 두려면 이 알림에 「취소」라고 답장해 주세요.',
    ]);
    assert.doesNotMatch(글, /synk-tip|toolu_|[0-9a-f]{8}-[0-9a-f]{4}|git push --force/);
    assert.equal(승인.훅처리(t.멈춤(s, { last_assistant_message: 두줄 }), t.환경), ''); // 두 번 보내지 않는다
    assert.equal(t.보낸글().length, 1);
  } finally { t.지우기(); }
});

test('두 줄이 없으면 예약 작업에는 한 번만 이어 쓰게 하고, 그래도 없으면 명령 꼴로 짓는다', () => {
  const t = 방만들기();
  try {
    const s = t.세션(예약첫글);
    승인.훅처리(t.막힘(s), t.환경);
    const 출력 = JSON.parse(승인.훅처리(t.멈춤(s), t.환경));
    assert.equal(출력.hookSpecificOutput.hookEventName, 'Stop');
    assert.match(출력.hookSpecificOutput.additionalContext, /막힌 일: \(/);
    assert.match(출력.hookSpecificOutput.additionalContext, /다시 시도하거나 다른 길로 돌아가지 마세요/);
    assert.doesNotMatch(출력.hookSpecificOutput.additionalContext, /승인합니다|허락합니다|push해/); // 동의처럼 읽힐 말을 넣지 않는다
    assert.deepEqual(t.보낸글(), []);
    assert.equal(승인.훅처리(t.멈춤(s, { stop_hook_active: true }), t.환경), '');
    const 글 = t.보낸글()[0];
    assert.match(글, /막힌 일: origin main에 강제 push\n/);
    assert.match(글, /\norigin main에 강제 push해\n/);
  } finally { t.지우기(); }
});

test('헤르메스 작업은 결과 글을 지키려고 이어 쓰게 하지 않고, 바로 도구 설명으로 짓는다', () => {
  const t = 방만들기();
  try {
    const s = t.세션('텔레그램에서 사용자가 명시적으로 맡긴 SYNK 작업입니다.');
    const 환경 = { ...t.환경, SYNK_UNATTENDED: 'hermes:synk-0123456789ab' };
    승인.훅처리(t.막힘(s, { tool_input: { command: 'node tools/공개.js 올리기 회의 --실행', description: 'synk.im에 회의 도구 공개 (계획 3fa9c1e7b2)' } }), 환경);
    assert.deepEqual(t.기록(s).source, { kind: 'hermes', name: 'synk-0123456789ab' });
    assert.equal(승인.훅처리(t.멈춤(s, { last_assistant_message: '작업 ID: synk-0123456789ab … 끝' }), 환경), '');
    const 글 = t.보낸글()[0];
    assert.match(글, /^자동 모드가 휴대폰에서 맡긴 작업의 한 단계를 막아/);
    assert.match(글, /막힌 일: synk\.im에 회의 도구 공개 \(계획\)\n/);
    assert.match(글, /이 알림에 답장으로 할 일과 그 대상을 함께 적어/);
    assert.doesNotMatch(글, /3fa9c1e7b2|synk-0123456789ab/);
  } finally { t.지우기(); }
});

test('알린 뒤 같은 세션이 또 막히면 지난 알림은 내력에 두고 새로 알린다', () => {
  const t = 방만들기();
  try {
    const s = t.세션(예약첫글);
    승인.훅처리(t.막힘(s), t.환경);
    승인.훅처리(t.멈춤(s, { last_assistant_message: 두줄 }), t.환경);
    const 첫 = t.기록(s).notice;
    승인.훅처리(t.막힘(s, { tool_use_id: 'toolu_02B', tool_input: { command: 'gh release create v1', description: 'GitHub 릴리스 만들기' }, reason: '[Production Deploy]' }), t.환경);
    let r = t.기록(s);
    assert.deepEqual([r.state, r.denials.length, r.history.length, r.history[0].notice.message_id], ['recording', 1, 1, 첫.message_id]);
    assert.equal(r.notice, undefined);
    승인.훅처리(t.멈춤(s, { last_assistant_message: '막힌 일: GitHub에 새 릴리스를 만들려다 막혔어요\n이어갈 문장: GitHub에 v1 릴리스 만들어' }), t.환경);
    r = t.기록(s);
    assert.equal(r.state, 'notified');
    assert.notEqual(r.notice.message_id, 첫.message_id);
    assert.equal(t.보낸글().length, 2);
  } finally { t.지우기(); }
});

test('보내기가 실패해도 Claude를 막지 않고 기록에 실패로 남긴다', () => {
  const t = 방만들기();
  try {
    const s = t.세션(예약첫글);
    승인.훅처리(t.막힘(s), t.환경);
    const 출력 = 승인.멈춤처리(t.멈춤(s, { last_assistant_message: 두줄 }), t.환경, { 보내는일: () => { throw new Error('network down token=abc'); } });
    assert.equal(출력, '');
    const r = t.기록(s);
    assert.equal(r.state, 'notify_failed');
    assert.equal(r.notice.message_id, null);
    assert.equal(r.notice.sentence, 'origin main에 강제 push해'); // 문장을 그대로 보내면 헤르메스가 맞춰 잇는다
    assert.doesNotMatch(r.notice.error, /abc/);
  } finally { t.지우기(); }
});

test('표시가 이상하거나 세션·기록 경로가 어긋나면 남기지 않는다', () => {
  const t = 방만들기();
  try {
    const s = t.세션('그냥 대화');
    assert.equal(승인.막힘남기기(t.막힘(s), { ...t.환경, SYNK_UNATTENDED: 'Bad Marker' }), null);
    assert.equal(승인.막힘남기기(t.막힘(s, { session_id: 'not-a-session' }), { ...t.환경, SYNK_UNATTENDED: 'hermes:x' }), null);
    assert.equal(승인.막힘남기기(t.막힘(s, { transcript_path: path.join(t.방, 'other.jsonl') }), { ...t.환경, SYNK_UNATTENDED: 'hermes:x' }), null);
    assert.equal(fs.existsSync(t.환경.SYNK_APPROVAL_DIR), false);
  } finally { t.지우기(); }
});

test('다듬기: 세션·작업 ID, 해시, 긴 숫자, 비밀값은 빼고 보통 말은 남긴다', () => {
  assert.equal(승인.다듬기('synk.im에 회의 도구 공개 (계획 3fa9c1e7b2d4) synk-0123456789ab toolu_01ABCdef 336a8278-59e1-470b-841a-75f19118ce83'), 'synk.im에 회의 도구 공개 (계획)');
  assert.equal(승인.다듬기('「origin main에 강제 push해」'), 'origin main에 강제 push해');
  assert.equal(승인.다듬기('10월 21일 15크레딧 영상 1편 올리기'), '10월 21일 15크레딧 영상 1편 올리기');
  assert.equal(승인.다듬기('password=hunter2 로 로그인'), 'password=[숨김] 로 로그인');
  assert.equal(승인.다듬기('가'.repeat(200), 20).length, 20);
  assert.deepEqual(승인.두줄읽기('- **막힌 일:** 「A에 B 하려다 막힘」\n> 이어갈 문장: `A에 B 해`'), { what: 'A에 B 하려다 막힘', sentence: 'A에 B 해' });
  assert.deepEqual(승인.두줄읽기('막힌 일 없음'), { what: null, sentence: null });
});

test('켜기·끄기: hooks에 두 줄만 더하고 빼며 autoMode 등 다른 칸은 한 글자도 바꾸지 않는다', () => {
  const t = 방만들기();
  try {
    const 설정파일 = path.join(t.방, 'settings.json');
    const 처음 = { permissions: { defaultMode: 'auto' }, autoMode: { environment: ['$defaults', 'x'], allow: ['$defaults'] },
      hooks: { PreToolUse: [{ matcher: 'Artifact', hooks: [{ type: 'command', command: 'node a.mjs pre' }] }], Stop: [{ hooks: [{ type: 'command', command: 'node other.js' }] }] } };
    fs.writeFileSync(설정파일, JSON.stringify(처음, null, 2) + '\n');
    const 항목 = 승인.훅항목('C:/Program Files/nodejs/node.exe', 'C:/repo/tools/텔레그램승인.js');
    const 미리 = 승인.설정바꾸기('켜기', { 설정파일, 항목 });
    assert.deepEqual([미리.바뀜, 미리.실행], [true, false]);
    assert.deepEqual(JSON.parse(fs.readFileSync(설정파일, 'utf8')), 처음); // 미리 보기는 쓰지 않는다
    const 켬 = 승인.설정바꾸기('켜기', { 설정파일, 항목, 실행: true });
    assert.ok(fs.existsSync(켬.백업));
    const 뒤 = JSON.parse(fs.readFileSync(설정파일, 'utf8'));
    assert.deepEqual(뒤.autoMode, 처음.autoMode);
    assert.deepEqual(뒤.permissions, 처음.permissions);
    assert.deepEqual(뒤.hooks.PreToolUse, 처음.hooks.PreToolUse);
    assert.deepEqual(뒤.hooks.PermissionDenied, [{ hooks: [항목] }]);
    assert.deepEqual(뒤.hooks.Stop, [...처음.hooks.Stop, { hooks: [항목] }]);
    assert.deepEqual(항목, { type: 'command', command: 'C:/Program Files/nodejs/node.exe', args: ['C:/repo/tools/텔레그램승인.js', '훅'], timeout: 60 });
    assert.equal(승인.설정바꾸기('켜기', { 설정파일, 항목, 실행: true }).바뀜, false); // 두 번 켜도 한 번만
    승인.설정바꾸기('끄기', { 설정파일, 실행: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(설정파일, 'utf8')), 처음);
    assert.throws(() => 승인.설정바꾸기('켜기', { 설정파일: path.join(t.방, '없음.json'), 항목 }));
  } finally { t.지우기(); }
});

test('명령줄 훅: 표준입력으로 받아 종료 0, 깨진 입력도 종료 0(오류는 기록 폴더에만)', () => {
  const t = 방만들기();
  try {
    const s = t.세션(예약첫글);
    const 돌리기 = (입력) => spawnSync(process.execPath, [도구, '훅'], { input: 입력, encoding: 'utf8', env: { ...process.env, ...t.환경 } });
    let r = 돌리기(JSON.stringify(t.막힘(s)));
    assert.deepEqual([r.status, r.stdout], [0, '']);
    assert.equal(t.기록(s).denials.length, 1);
    r = 돌리기(JSON.stringify(t.멈춤(s)));
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).hookSpecificOutput.hookEventName, 'Stop');
    r = 돌리기('{깨진 입력');
    assert.deepEqual([r.status, r.stdout], [0, '']);
    assert.match(fs.readFileSync(path.join(t.환경.SYNK_APPROVAL_DIR, '훅오류.log'), 'utf8'), /JSON/);
  } finally { t.지우기(); }
});

test('같은 세션의 막힘 두 건이 동시에 와도 둘 다 남는다(잠금)', async () => {
  const t = 방만들기();
  try {
    const s = t.세션(예약첫글);
    const 하나 = (id) => new Promise((resolve) => {
      const p = spawn(process.execPath, [도구, '훅'], { env: { ...process.env, ...t.환경 } });
      p.on('close', resolve);
      p.stdin.end(JSON.stringify(t.막힘(s, { tool_use_id: id })));
    });
    await Promise.all([하나('toolu_A'), 하나('toolu_B'), 하나('toolu_C')]);
    assert.deepEqual(t.기록(s).denials.map((d) => d.tool_use_id).sort(), ['toolu_A', 'toolu_B', 'toolu_C']);
  } finally { t.지우기(); }
});
