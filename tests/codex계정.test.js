/* codex계정 — 한도에 막힌 굽기 계정은 건너뛰고 다음 계정으로 다시 부른다. 본 계정으로는 넘어가지 않는다.
 * 가짜 codex(CODEX_BIN)와 임시 폴더(CODEX_BAKE_DIR)만 쓴다. 실제 ~/.codex·계정은 읽지 않는다. */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const 도구 = path.join(REPO, 'tools', 'codex계정.js');
const { 풀리는시각, 코덱스오류, 한도문구 } = require(도구);

/* 한도 오류 문장은 codex-cli 0.163 꼴(굽은 따옴표)이다. 이 파일은 한도 문구를 일부러 담는다 —
 * 굽기가 이 파일을 읽어도 계정을 「막힘」으로 적지 않는다는 것이 ⑥·⑦이 지키는 일이다. */
const 한도 = "You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings to buy credits or try again at Oct 21st, 2026 3:40 PM.";

/* 폴더 이름이 bake1이면 한도, bake3이면 로그인 풀림, quote는 한도 문구를 인용한 성공,
 * quotefail은 한도 문구를 인용한 뒤 다른 오류로 실패, json은 --json 사건으로 한도, 그 밖은 성공 */
const 가짜 = `
const home = require('path').basename(process.env.CODEX_HOME || '');
const 한도 = ${JSON.stringify(한도)};
const 머리 = () => console.error('OpenAI Codex v0.163.0\\n--------\\nmodel: gpt-6.1-sol\\n--------\\nuser\\n' + input);
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  if (home === 'bake1') {
    머리();
    console.error('2026-10-17T06:50:38.341157Z ERROR codex_api::endpoint::responses: usage_limit_reached');
    console.error('ERROR: ' + 한도 + '\\nERROR: ' + 한도);
    process.exit(1);
  }
  if (home === 'bake3') {
    /* 0.163 실측 꼴: 다시 잇기 줄 뒤 마지막 오류가 401 */
    머리();
    console.error('2026-10-17T06:50:38.341157Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 401 Unauthorized');
    console.error('ERROR: Reconnecting... 5/5');
    const 끝 = 'ERROR: unexpected status 401 Unauthorized: Missing bearer or basic authentication in header, url: https://api.openai.com/v1/responses';
    console.error(끝 + '\\n' + 끝);
    process.exit(1);
  }
  if (home === 'quote' || home === 'quotefail') {
    머리();
    console.error('exec\\nGet-Content docs/현장노트/그림_굽기_오리기.md\\n succeeded in 12ms:\\n- 증상: ' + 한도 + '\\nERROR: ' + 한도 + '\\nusage_limit_reached\\ncodex\\n노트에 따르면 ' + 한도);
    if (home === 'quotefail') { console.error('ERROR: stream disconnected before completion: error sending request'); process.exit(1); }
    console.log('노트 답: ' + 한도 + ' (usage_limit_reached)');
    return;
  }
  if (home === 'json') {
    console.log(JSON.stringify({ type: 'thread.started', thread_id: 't' }));
    console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', aggregated_output: 'ERROR: ' + 한도.replace('Oct 21st', 'Oct 30th') } }));
    console.log(JSON.stringify({ type: 'error', message: 한도 }));
    console.log(JSON.stringify({ type: 'turn.failed', error: { message: 한도 } }));
    process.exit(1);
  }
  console.log('done[' + home + '] ' + input.length + ' ' + process.argv.slice(2).join(' '));
});
`;

function 판(계정들) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'codex계정-'));
  const bin = path.join(뿌리, 'fake-codex.js');
  fs.writeFileSync(bin, 가짜);
  if (계정들) fs.writeFileSync(path.join(뿌리, '계정.json'), JSON.stringify({ 계정: 계정들 }));
  const 부르기 = () => {
    const env = { ...process.env, CODEX_BAKE_DIR: 뿌리, CODEX_BIN: bin };
    delete env.CODEX_HOME;
    return spawnSync(process.execPath, [도구, 'exec', '--skip-git-repo-check', '-'], { input: 'hello', env, encoding: 'utf8' });
  };
  const 장부 = () => JSON.parse(fs.readFileSync(path.join(뿌리, '계정.json'), 'utf8')).계정;
  return { 부르기, 장부 };
}

test('① 한도에 막힌 계정은 풀리는 시각을 적고 다음 계정으로 다시 부른다', () => {
  const { 부르기, 장부 } = 판([{ 이름: 'bake1' }, { 이름: 'bake2' }]);
  const r = 부르기();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /done\[bake2\] 5 exec --skip-git-repo-check -/);
  assert.match(r.stderr, /bake1 한도 — 10-21 15:40에 풀림/);
  assert.strictEqual(장부()[0].막힘까지, new Date(2026, 9, 21, 15, 40).getTime());
  assert.ok(장부()[1].마지막사용 > 0);

  /* 두 번째에는 막힌 계정을 부르지 않고 바로 다음 계정으로 간다 */
  const r2 = 부르기();
  assert.strictEqual(r2.status, 0);
  assert.doesNotMatch(r2.stderr, /한도/);
});

test('② 모두 막히면 본 계정으로 넘어가지 않고 3으로 끝난다', () => {
  const { 부르기 } = 판([{ 이름: 'bake1' }]);
  const r = 부르기();
  assert.strictEqual(r.status, 3);
  assert.doesNotMatch(r.stdout, /done/);
  assert.match(r.stderr, /본 계정 폴더\(~\/\.codex\)로는 넘어가지 않는다/);
});

test('②-1 예비는 장부 앞에 있어도 다른 계정이 모두 막혔을 때만 쓴다', () => {
  const 넉넉 = 판([{ 이름: 'spare', 예비: true }, { 이름: 'bake1' }, { 이름: 'bake2' }]);
  const r = 넉넉.부르기();
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /done\[bake2\]/);
  assert.doesNotMatch(r.stderr, /예비/);

  const 빠듯 = 판([{ 이름: 'spare', 예비: true }, { 이름: 'bake1' }]);
  const r2 = 빠듯.부르기();
  assert.strictEqual(r2.status, 0);
  assert.match(r2.stdout, /done\[spare\]/);
  assert.match(r2.stderr, /보조 계정이 모두 막혀 예비 spare/);
});

test('③ 로그인이 풀린 계정은 표시하고 건너뛴다', () => {
  const { 부르기, 장부 } = 판([{ 이름: 'bake3' }, { 이름: 'bake2' }]);
  const r = 부르기();
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /done\[bake2\]/);
  assert.strictEqual(장부()[0].로그인필요, true);
});

test('④ 굽기 계정이 하나도 없으면 예전처럼 본 계정으로 부른다', () => {
  const { 부르기 } = 판(null);
  const r = 부르기();
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /done\[\] 5/);
  assert.match(r.stderr, /굽기 계정이 아직 없다/);
});

test('⑤ 풀리는 시각 — 날짜 있는 꼴·시각만·남은 시간', () => {
  const 지금 = new Date(2026, 9, 17, 16, 0);
  assert.strictEqual(풀리는시각('try again at Oct 21st, 2026 3:40 PM.', 지금), new Date(2026, 9, 21, 15, 40).getTime());
  assert.strictEqual(풀리는시각('or try again at 5:05 PM.', 지금), new Date(2026, 9, 17, 17, 5).getTime());
  assert.strictEqual(풀리는시각('or try again at 9:00 AM.', 지금), new Date(2026, 9, 18, 9, 0).getTime());
  assert.strictEqual(풀리는시각('try again in 2 hours 5 minutes.', 지금), 지금.getTime() + 2 * 36e5 + 5 * 6e4);
  assert.strictEqual(풀리는시각('something else', 지금), null);
  assert.ok(한도문구.test("You've hit your usage limit."));
  assert.ok(한도문구.test(한도));
});

test('⑥ 성공한 실행은 출력에 한도 문구가 있어도 막힘으로 적지 않고 다시 부르지 않는다', () => {
  const { 부르기, 장부 } = 판([{ 이름: 'quote' }, { 이름: 'bake2' }]);
  const r = 부르기();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /노트 답: /);
  assert.doesNotMatch(r.stdout, /done\[bake2\]/);
  assert.doesNotMatch(r.stderr, /\[codex계정\] quote 한도/);
  assert.ok(!(장부()[0].막힘까지 > 0));
  assert.ok(장부()[0].마지막사용 > 0);
  assert.strictEqual(장부().find((a) => a.이름 === 'bake2').마지막사용, undefined);
});

test('⑦ 실패한 실행도 모델 출력 속 한도 문구로는 막지 않는다 — Codex의 마지막 오류가 실패한 까닭이다', () => {
  const { 부르기, 장부 } = 판([{ 이름: 'quotefail' }, { 이름: 'bake2' }]);
  const r = 부르기();
  assert.strictEqual(r.status, 1);
  assert.doesNotMatch(r.stdout, /done\[bake2\]/);
  assert.doesNotMatch(r.stderr, /\[codex계정\] quotefail (한도|로그인)/);
  assert.ok(!(장부()[0].막힘까지 > 0));
  assert.ok(!장부()[0].로그인필요);
});

test('⑧ --json 실행의 한도 사건(error·turn.failed)은 막힘으로 적고 다음 계정으로 간다', () => {
  const { 부르기, 장부 } = 판([{ 이름: 'json' }, { 이름: 'bake2' }]);
  const r = 부르기();
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /done\[bake2\]/);
  /* 명령 출력(item.completed) 속 다른 날짜가 아니라 한도 사건의 날짜를 읽는다 */
  assert.strictEqual(장부()[0].막힘까지, new Date(2026, 9, 21, 15, 40).getTime());
});

test('⑨ Codex 오류 문장 — ERROR:/Error: 줄과 --json 사건만, 차례대로', () => {
  assert.deepStrictEqual(코덱스오류({
    출력: `노트 답: ${한도}\n{"type":"item.completed","item":{"text":"x"}}\n{"type":"error","message":"a"}\n{"type":"turn.failed","error":{"message":"b"}}\n{깨진 줄`,
    오류: `user\n- 증상: ${한도}\n  ERROR: 들여쓴 줄\n2026-10-17T06:50:38Z ERROR codex_api: 추적 줄\nERROR: Reconnecting... 1/5\nERROR: ${한도}\nError: Not logged in`,
  }), ['Reconnecting... 1/5', 한도, 'Not logged in', 'a', 'b']);
  assert.deepStrictEqual(코덱스오류({}), []);
  /* 색을 강제한 출력 */
  assert.deepStrictEqual(코덱스오류({ 오류: `\x1b[31mERROR:\x1b[0m ${한도}` }), [한도]);
});
