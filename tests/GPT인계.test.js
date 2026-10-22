'use strict';
// GPT 인계(tools/GPT인계.mjs): 카드 글·결과 읽기·결과 파일과 Codex 대화 기록에서 저절로 받아 오기·기다림 판정. GPT는 부르지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const 도구 = path.join(root, 'tools/GPT인계.mjs');
const tool = () => import(pathToFileURL(도구));

function 임시(t) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gpt-handoff-test-'));
  t.after(() => fs.rmSync(뿌리, { recursive: true, force: true, maxRetries: 5 }));
  const 옛 = { dir: process.env.SYNK_GPT_HANDOFF_DIR, home: process.env.CODEX_HOME, clip: process.env.SYNK_NO_CLIPBOARD };
  t.after(() => { for (const [k, v] of [['SYNK_GPT_HANDOFF_DIR', 옛.dir], ['CODEX_HOME', 옛.home], ['SYNK_NO_CLIPBOARD', 옛.clip]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  Object.assign(process.env, { SYNK_GPT_HANDOFF_DIR: path.join(뿌리, '인계'), CODEX_HOME: path.join(뿌리, 'codex'), SYNK_NO_CLIPBOARD: '1' });
  return 뿌리;
}
/** 가짜 Codex 대화 기록 한 파일. */
function 기록쓰기(뿌리, 이름, 사건들) {
  const f = path.join(뿌리, 'codex', 'sessions', '2026', '10', '22', `rollout-${이름}.jsonl`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 사건들.map(e => JSON.stringify(e)).join('\n') + '\n');
  return f;
}
const 사용자 = text => ({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
const 답 = text => ({ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } });
const 턴끝 = last => ({ type: 'event_msg', payload: { type: 'task_complete', last_agent_message: last } });

test('카드: 표·결과 파일·끝 표식 줄·멈출 화면이 들어가고, 할 일 없이·이름이 틀리면·같은 이름이면 멈춘다', async t => {
  임시(t);
  const { 준비하기, 끝표식 } = await tool();
  const { 폴더, 표, 글 } = 준비하기({ 이름: '결제권한-20261022', 할일: 'GCP 결제 계정에 unmet23을 결제 계정 사용자로 넣는다', 대상: 'console.cloud.google.com' });
  assert.match(표, /^[0-9a-f]{12}$/);
  assert.ok(글.startsWith(`[SYNK GPT 인계 · 결제권한-20261022 · ${표}]`));
  assert.ok(글.includes(`마지막 줄: ${끝표식} ${표}`));
  assert.ok(글.includes(path.join(폴더, '결과.md').split(path.sep).join('/')), '결과 파일은 / 경로로');
  assert.match(글, /비밀번호·인증 코드·휴대폰 2단계 인증·캡차·결제 확인 화면이 나오면 거기서 멈추고/);
  assert.match(글, /적힌 일만 한다/);
  assert.match(글, /대상: console\.cloud\.google\.com/);
  assert.equal(fs.readFileSync(path.join(폴더, '지시.md'), 'utf8'), 글 + '\n');
  assert.throws(() => 준비하기({ 이름: '빈칸', 할일: '  ' }), /할 일/);
  assert.throws(() => 준비하기({ 이름: '띄어 쓴 이름', 할일: 'x' }), /이름은/);
  assert.throws(() => 준비하기({ 이름: '결제권한-20261022', 할일: 'x' }), /이미 있는 인계/);
});

test('결과 읽기: 그 표의 끝 표식이 마지막 줄일 때만, 상태 줄을 읽는다', async () => {
  const { 결과읽기 } = await tool();
  assert.deepEqual(결과읽기('상태: 끝\n권한을 넣었다\nGPT_인계_끝 abc\n\n', 'abc'), { 상태: '끝', 본문: '상태: 끝\n권한을 넣었다' });
  assert.equal(결과읽기('상태: 끝\nGPT_인계_끝 abc', 'zzz'), null, '다른 카드의 결과');
  assert.equal(결과읽기('GPT_인계_끝 abc\n쓰는 중', 'abc'), null, '끝 표식이 마지막 줄이 아니면 쓰다 만 것');
  assert.equal(결과읽기('상태: 막힘\r\n인증 화면\r\nGPT_인계_끝 abc\r\n', 'abc').상태, '막힘');
  assert.equal(결과읽기('한 일만\nGPT_인계_끝 abc', 'abc').상태, '모름');
});

test('받아 오기: 결과 파일이 먼저, 없으면 대화 기록의 그 턴 마지막 답 — 끝 표식 없이 턴이 끝났으면 기다림, 오래된 기록은 안 본다', async t => {
  const 뿌리 = 임시(t);
  const { 준비하기, 살피기 } = await tool();
  const { 폴더, 표, 글 } = 준비하기({ 이름: '기록', 할일: '시험' });
  assert.equal(살피기(폴더).꼴, '아직');
  // 턴이 아직 안 끝남 → 아직
  const f = 기록쓰기(뿌리, 'a', [{ type: 'session_meta', payload: {} }, 사용자(`AGENTS 안내\n${글}`), 답('보고 있어요')]);
  assert.equal(살피기(폴더).꼴, '아직');
  // 끝 표식 없이 턴이 끝남 → 기다림(유호님 손)
  fs.appendFileSync(f, JSON.stringify(턴끝('로그인 화면이에요. 비밀번호를 넣어 주시면 이어서 할게요.')) + '\n');
  const 기다림 = 살피기(폴더);
  assert.equal(기다림.꼴, '기다림');
  assert.match(기다림.본문, /비밀번호를 넣어 주시면/);
  // 유호님이 이어 가라고 하고 다음 턴이 끝 표식으로 끝남 → 결과
  fs.appendFileSync(f, [사용자('넣었어 이어서 해'), 답('넣었어요'), 턴끝(`상태: 끝\n권한을 넣었어요. 콘솔 결제 › 계정 관리에서 보면 돼요.\nGPT_인계_끝 ${표}`)].map(e => JSON.stringify(e)).join('\n') + '\n');
  const 결과 = 살피기(폴더);
  assert.equal(결과.꼴, '결과');
  assert.equal(결과.상태, '끝');
  assert.match(결과.출처, /rollout-a\.jsonl$/);
  // 다른 카드의 기록은 섞이지 않는다
  기록쓰기(뿌리, 'b', [사용자('[SYNK GPT 인계 · 남 · 000000000000]'), 턴끝('상태: 끝\nGPT_인계_끝 000000000000')]);
  assert.equal(살피기(폴더).출처.endsWith('rollout-a.jsonl'), true);
  // 결과 파일이 있으면 그것이 앞선다
  fs.writeFileSync(path.join(폴더, '결과.md'), `상태: 일부\n한 칸만 했어요\nGPT_인계_끝 ${표}\n`);
  assert.deepEqual([살피기(폴더).상태, 살피기(폴더).출처], ['일부', '결과.md']);
  // 이미 열린 대화에 붙인 카드는 기록 파일의 수정 시각이 카드보다 앞일 수 있다(열린 파일은 수정 시각이 늦게 바뀜) — 7일 안이면 본다
  fs.rmSync(path.join(폴더, '결과.md'));
  const 한시간전 = new Date(Date.now() - 3600_000);
  fs.utimesSync(f, 한시간전, 한시간전);
  assert.equal(살피기(폴더).꼴, '결과');
  // 7일 넘게 묵은 기록은 훑지 않는다
  const 열흘전 = new Date(Date.now() - 10 * 86_400_000);
  fs.utimesSync(f, 열흘전, 열흘전);
  assert.equal(살피기(폴더).꼴, '아직');
});

test('기록 훑기: 표가 없던 파일은 크기가 그대로면 다시 읽지 않고, 커지면 다시 읽는다', async t => {
  const 뿌리 = 임시(t);
  const { 준비하기, 살피기 } = await tool();
  const { 폴더, 표, 글 } = 준비하기({ 이름: '덧붙음', 할일: '시험' });
  const f = 기록쓰기(뿌리, 'c', [사용자('다른 일')]);
  assert.equal(살피기(폴더).꼴, '아직');
  // 같은 대화에 카드를 덧붙이면(크기가 바뀜) 다시 읽어 찾는다
  fs.appendFileSync(f, [사용자(글), 턴끝(`상태: 끝\nGPT_인계_끝 ${표}`)].map(e => JSON.stringify(e)).join('\n') + '\n');
  assert.equal(살피기(폴더).꼴, '결과');
});

test('기다리기: 결과가 생기면 바로 돌려주고, 시간이 지나면 아직 그대로', async t => {
  임시(t);
  const { 준비하기, 기다리기 } = await tool();
  const { 폴더, 표 } = 준비하기({ 이름: '기다림', 할일: '시험' });
  setTimeout(() => fs.writeFileSync(path.join(폴더, '결과.md'), `상태: 끝\n됐어요\nGPT_인계_끝 ${표}\n`), 150);
  const s = await 기다리기(폴더, { 분: 0.05, 간격ms: 50 });
  assert.equal(s.꼴, '결과');
  const { 폴더: 빈 } = 준비하기({ 이름: '안옴', 할일: '시험' });
  assert.equal((await 기다리기(빈, { 분: 0.002, 간격ms: 20 })).꼴, '아직');
});

test('검수 고침: 새 사용자 말마다 앞 턴을 지우고, . · .. 이름과 남은 폴더는 막고, --분은 유한한 숫자만, 링크는 따라가지 않는다', async t => {
  const 뿌리 = 임시(t);
  const { 준비하기, 살피기, 기다리기, 폴더찾기 } = await tool();
  // A1·GA2: 카드 → 인증 기다림으로 턴 끝 → 「이어서 해」 → 진행 중 답 — 새 턴이 안 끝났으면 아직
  const { 폴더, 표, 글 } = 준비하기({ 이름: '턴', 할일: '시험' });
  const f = 기록쓰기(뿌리, 'turn', [사용자(글), 턴끝('비밀번호를 넣어 주세요'), 사용자('넣었어 이어서 해'), 답('이어서 하는 중이에요')]);
  assert.equal(살피기(폴더).꼴, '아직', '앞 턴의 끝남이 남지 않는다');
  // 같은 카드를 다시 붙이면 앞 결과를 바로 돌려주지 않는다
  fs.appendFileSync(f, [턴끝(`상태: 일부\nGPT_인계_끝 ${표}`), 사용자(글)].map(e => JSON.stringify(e)).join('\n') + '\n');
  assert.equal(살피기(폴더).꼴, '아직', '다시 붙인 카드의 새 턴을 기다린다');
  // A2·GA1: . · .. 는 뿌리 밖·뿌리 자체를 가리키니 막는다
  for (const 이름 of ['.', '..', '...']) assert.throws(() => 준비하기({ 이름, 할일: '시험' }), /이름은/);
  assert.throws(() => 폴더찾기('..'), /이름은/);
  assert.ok(!fs.existsSync(path.join(뿌리, '지시.md')) && !fs.existsSync(path.join(뿌리, '인계', '지시.md')));
  // GA3: 이름은 폴더를 배타로 만들어 잡는다 — 상태.json이 아직 없어도 이미 있는 폴더면 멈춘다
  fs.mkdirSync(path.join(뿌리, '인계', '먼저잡음'));
  assert.throws(() => 준비하기({ 이름: '먼저잡음', 할일: '시험' }), /이미 있는 인계/);
  // A3·GA5: --분이 숫자가 아니거나 끝없으면 기다리지 않고 멈춘다
  for (const 분 of [NaN, Infinity, 0, -1]) await assert.rejects(기다리기(폴더, { 분 }), /--분은/);
  // GA4: 기록 폴더 안의 링크(정션)는 따라가지 않는다 — 위 폴더를 가리켜도 끝난다
  const 링크 = path.join(뿌리, 'codex', 'sessions', '되돌이');
  try { fs.symlinkSync(path.join(뿌리, 'codex'), 링크, 'junction'); } catch { return t.skip('이 PC에서 정션을 못 만든다'); }
  assert.equal(살피기(폴더).꼴, '아직');
});

test('명령: 준비는 카드를 찍고(클립보드 끔), 확인은 아직이면 종료 2·결과면 0, 목록에 상태가 나온다', async t => {
  const 뿌리 = 임시(t);
  const env = { ...process.env };
  const 돌림 = (...a) => spawnSync(process.execPath, [도구, ...a], { env, encoding: 'utf8' });
  const 준비 = 돌림('준비', '명령시험', '--할일', '설정 화면에서 한 칸만 켠다', '--클립보드안함');
  assert.equal(준비.status, 0, 준비.stderr);
  assert.match(준비.stdout, /\[SYNK GPT 인계 · 명령시험 · [0-9a-f]{12}\]/);
  assert.match(준비.stdout, /기다리기 명령시험/);
  assert.equal(돌림('확인', '명령시험').status, 2);
  const 표 = JSON.parse(fs.readFileSync(path.join(뿌리, '인계', '명령시험', '상태.json'), 'utf8')).표;
  fs.writeFileSync(path.join(뿌리, '인계', '명령시험', '결과.md'), `상태: 끝\n켰어요\nGPT_인계_끝 ${표}\n`);
  const 확인 = 돌림('확인', '명령시험');
  assert.equal(확인.status, 0);
  assert.match(확인.stdout, /결과\(상태: 끝, 결과\.md\)[\s\S]*켰어요/);
  assert.match(돌림('목록').stdout, /명령시험 .* 결과\(끝\)/);
  assert.equal(돌림('준비', '명령시험').status, 2, '할 일 없이');
  const 오타 = 돌림('기다리기', '명령시험', '--분', '오타');
  assert.equal(오타.status, 2);
  assert.match(오타.stderr, /--분은/);
});
