/**
 * hook-registration-snapshot 회귀 — 「등록을 바꾼 세션은 그 항목의 발동을 못 믿는다」를 말하는 층 (F584)
 *
 * 왜 픽스처인가 (이 트랙의 급소이자 이 파일의 존재 이유):
 *   이 훅은 **자기 자신의 라이브 실증을 원리상 못 낸다** — settings.json 에 등록되는 순간,
 *   그 세션에선 정확히 F584 가 말하는 이유로 발동을 못 믿게 된다. 그래서 탐지력은 전부 여기서
 *   진다. 실저장소는 흔들지 않는다(가드 맹점 ②: 버그가 아직 있을 것을 요구하는 회귀 금지 —
 *   탐지력은 픽스처로 못박고 실저장소에는 거짓양성만 검사한다).
 *
 * 무엇을 못박나:
 *   ① 새로 생긴 등록·사라진 등록을 **각각의 이름으로** 짚는다(둘은 방향이 반대고 처방도 다르다).
 *   ② matcher 만 좁혀도 잡는다 — 필터가 훅보다 좁아지는 것이 이 저장소가 세 번 겪은 사고다(F044·F053·F063).
 *   ③ 거짓양성 0: 블록 순서·hooks 밖 블록(permissions)·같은 내용 재저장은 **조용해야 한다**.
 *      소음은 진짜 경보를 죽인다.
 *   ④ 미측정을 통과로 번역하지 않는다 — 도장 없음·깨진 JSON 은 침묵이 아니라 각자의 알림이다(F207).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 훅띄우기 } = require('./lib/훅띄우기');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'hook-registration-snapshot.js');
const SID = 'local_testsession';

/** 픽스처 등록 한 벌 — 실등록을 베끼지 않는다(실저장소가 바뀌어도 이 회귀의 탐지력은 안 흔들린다). */
const 기본 = () => ({
  PreToolUse: [
    { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node .claude/hooks/alpha-guard.js' }] },
  ],
  PostToolUse: [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'node .claude/hooks/beta-guard.js' }] },
  ],
});

function 마당(t, 초기 = { hooks: 기본() }) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'hookreg-'));
  t.after(() => { try { fs.rmSync(뿌리, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 결과가 아니다 */ } });
  fs.mkdirSync(path.join(뿌리, '.claude'), { recursive: true });
  const settings = path.join(뿌리, '.claude', 'settings.json');
  fs.writeFileSync(settings, typeof 초기 === 'string' ? 초기 : JSON.stringify(초기, null, 2), 'utf8');
  const env = {
    ...process.env,
    SYNK_HOOKREG_DIR: path.join(뿌리, '.도장'),
    CLAUDE_PROJECT_DIR: 뿌리,
    CLAUDE_CODE_HOST_SESSION_ID: SID,
  };
  return { 뿌리, settings, env };
}

const 도장찍기 = (env) =>
  훅띄우기(HOOK, { input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: SID }), env, encoding: 'utf8' });

/** 편집 뒤 판정을 받는다. 침묵이면 빈 문자열. */
function 판정(env, 파일, tool = 'Write') {
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      session_id: SID,
      tool_name: tool,
      tool_input: { file_path: 파일 },
    }),
    env,
    encoding: 'utf8',
  });
  const out = String(r.stdout || '').trim();
  if (!out) return '';
  return String(JSON.parse(out).hookSpecificOutput.additionalContext || '');
}

const 쓰기 = (파일, 값) => fs.writeFileSync(파일, typeof 값 === 'string' ? 값 : JSON.stringify(값, null, 2), 'utf8');

test('① 새로 생긴 등록을 「이 세션엔 없던 것」으로 짚는다', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);

  const 판 = { hooks: 기본() };
  판.hooks.PreToolUse.push({ matcher: 'Read', hooks: [{ type: 'command', command: 'node .claude/hooks/gamma-guard.js' }] });
  쓰기(settings, 판);

  const 글 = 판정(env, settings);
  assert.match(글, /새로 생긴 등록 1건/, '추가를 못 짚었다');
  assert.match(글, /gamma-guard\.js/, '어느 항목인지 안 말했다 — 세면서 이름을 안 대면 처방이 안 선다');
  assert.doesNotMatch(글, /사라진 등록/, '삭제가 없는데 삭제를 말했다');
  // 「안 돈다」로 단정하지 않는다 — 하네스 내부는 확증 못 한 자리다(훅 주석의 그 약속).
  assert.match(글, /못 믿는다/, '근거가 닿는 지점보다 세게 단정한다');
});

test('② 사라진 등록은 방향이 반대다 — 「이 세션이 뜰 때는 있던 것」', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);

  쓰기(settings, { hooks: { PreToolUse: 기본().PreToolUse } }); // PostToolUse 통째로 삭제

  const 글 = 판정(env, settings);
  assert.match(글, /사라진 등록 1건/, '삭제를 못 짚었다');
  assert.match(글, /beta-guard\.js/);
  assert.doesNotMatch(글, /새로 생긴 등록/);
});

test('③ matcher 만 좁혀도 잡는다 — 필터가 훅보다 좁아지는 것이 이 저장소의 반복 사고다(F044·F053)', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);

  const 판 = { hooks: 기본() };
  판.hooks.PreToolUse[0].matcher = 'Edit'; // Write 를 필터에서 뺐다 — 훅은 그대로인데 라우팅만 좁아진 형태
  쓰기(settings, 판);

  const 글 = 판정(env, settings);
  assert.match(글, /새로 생긴 등록 1건/);
  assert.match(글, /사라진 등록 1건/);
  assert.match(글, /alpha-guard\.js/);
});

test('④ command 본문만 바뀌어도 잡는다 — case 필터·타임아웃이 조용히 갈리는 자리', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);

  const 판 = { hooks: 기본() };
  판.hooks.PostToolUse[0].hooks[0].command = 'case "$IN" in *git*) node .claude/hooks/beta-guard.js ;; esac';
  쓰기(settings, 판);

  assert.match(판정(env, settings), /등록 2건이 갈렸다/, '같은 훅 파일이라고 통과시키면 필터 축소를 놓친다');
});

test('⑤ 거짓양성 — 블록 순서만 바꾸면 조용하다(등록 내용이 같으면 하네스에도 같은 등록이다)', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);

  const b = 기본();
  쓰기(settings, { hooks: { PostToolUse: b.PostToolUse, PreToolUse: b.PreToolUse } });

  assert.strictEqual(판정(env, settings), '', '순서 변경에 경보를 냈다 — 소음은 진짜 경보를 죽인다');
});

test('⑥ 거짓양성 — hooks 밖(permissions·env)만 고치면 조용하다', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);

  쓰기(settings, { hooks: 기본(), permissions: { allow: ['Bash(npm run test)'] } });

  assert.strictEqual(판정(env, settings), '', 'hooks 를 안 만졌는데 경보를 냈다');
});

test('⑦ 거짓양성 — 같은 내용 재저장은 조용하다', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);
  쓰기(settings, { hooks: 기본() });

  assert.strictEqual(판정(env, settings), '');
});

test('⑧ 도장이 없으면 침묵이 아니라 「모른다」 — 미측정을 통과로 번역하지 않는다(F207)', (t) => {
  const { settings, env } = 마당(t);
  // 도장찍기 를 일부러 안 한다 = SessionStart 를 못 거친 세션(워크트리·훅 신설 직후가 실제로 이 모양이다)
  const 판 = { hooks: 기본() };
  판.hooks.PreToolUse.push({ matcher: 'Read', hooks: [{ type: 'command', command: 'node .claude/hooks/gamma-guard.js' }] });
  쓰기(settings, 판);

  const 글 = 판정(env, settings);
  assert.match(글, /세션 시작 판을 모른다/, '도장 없음을 조용히 통과시켰다');
  assert.match(글, /미측정/);
});

test('⑨ 편집 뒤 JSON 이 깨졌으면 그 자체를 알린다 — 등록층이 깨지면 훅 전체가 조용히 죽는다', (t) => {
  const { settings, env } = 마당(t);
  도장찍기(env);
  쓰기(settings, '{ "hooks": { "PreToolUse": [ }');

  assert.match(판정(env, settings), /JSON 으로 못 읽었다/);
});

test('⑩ 대상이 아닌 파일은 안 본다 — 이 훅의 과녁은 등록층 하나뿐이다', (t) => {
  const { 뿌리, env } = 마당(t);
  도장찍기(env);
  const 딴것 = path.join(뿌리, '.claude', 'config.json');
  쓰기(딴것, { hooks: { PreToolUse: [] } });

  assert.strictEqual(판정(env, 딴것), '');
});

test('⑪ settings.local.json 도 같은 등록층이다 — 한쪽만 보면 그 틈으로 샌다', (t) => {
  const { 뿌리, env } = 마당(t);
  const 로컬 = path.join(뿌리, '.claude', 'settings.local.json');
  쓰기(로컬, { hooks: 기본() });
  도장찍기(env); // 두 파일 다 도장이 찍혀야 한다

  const 판 = { hooks: 기본() };
  판.hooks.PreToolUse.push({ matcher: 'Read', hooks: [{ type: 'command', command: 'node .claude/hooks/delta-guard.js' }] });
  쓰기(로컬, 판);

  assert.match(판정(env, 로컬), /새로 생긴 등록 1건/, 'settings.local.json 이 도장·판정에서 빠졌다');
});

test('⑫ hooks 키가 아예 없는 판은 「빈 등록」이지 「모름」이 아니다', (t) => {
  const { settings, env } = 마당(t, { permissions: { allow: [] } });
  도장찍기(env);
  쓰기(settings, { hooks: 기본(), permissions: { allow: [] } });

  const 글 = 판정(env, settings);
  assert.match(글, /새로 생긴 등록 2건/, '빈 등록에서 2건이 생긴 것을 못 봤다');
  assert.doesNotMatch(글, /모른다/, 'hooks 없음을 「모름」으로 오독했다');
});

test('⑬ Edit·MultiEdit 도 같은 통로다 — 도구가 갈리면 그 틈이 곧 구멍이다', (t) => {
  for (const tool of ['Edit', 'MultiEdit']) {
    const { settings, env } = 마당(t);
    도장찍기(env);
    const 판 = { hooks: 기본() };
    판.hooks.PreToolUse.push({ matcher: 'Read', hooks: [{ type: 'command', command: 'node .claude/hooks/gamma-guard.js' }] });
    쓰기(settings, 판);

    assert.match(판정(env, settings, tool), /새로 생긴 등록 1건/, `${tool} 이 통로에서 빠졌다`);
  }
});
