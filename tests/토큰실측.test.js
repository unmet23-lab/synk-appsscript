/**
 * token-audit 회귀 — 토큰 소비를 실제로 세는가
 *
 * 왜 있나: 2026-08-04에 「토큰이 많다」를 판단하려는데 잴 수단이 없어 추정할 뻔했다.
 * 실측이 전제를 뒤집었으므로(지침 압축 4~5% 상한 vs 이미지 89%), 이 도구가 틀리면
 * 다음 판단도 같이 틀린다.
 *
 * ⚠ 전사는 **repo 밖**(~/.claude/projects)에 산다 — CI에는 없다.
 *    그래서 탐지 능력은 **픽스처**로 못박고, 실저장소는 건드리지 않는다.
 *    (CLAUDE.md 「repo 밖 환경에 기대는 검사는 CI에서 깨진다」의 적용)
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const TOOL = path.resolve(__dirname, '..', 'tools', 'token-audit.js');

function run(args) {
  const r = spawnSync(process.execPath, [TOOL].concat(args), { encoding: 'utf8' });
  return { out: (r.stdout || '') + (r.stderr || ''), code: r.status };
}

let tmpSeq = 0;
function fixtureDir(lines) {
  tmpSeq += 1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `synk-tokenaudit-${process.pid}-${tmpSeq}-`));
  fs.writeFileSync(path.join(dir, 'aaaaaaaa-1111-2222-3333-444444444444.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
  return dir;
}

const turn = (u) => ({ message: { model: 'claude-opus-5', usage: u } });

test('전사 폴더가 없으면 조용히 통과하지 않고 그 사실을 말한다', () => {
  const missing = path.join(os.tmpdir(), `synk-none-${process.pid}-${Date.now()}`);
  const r = run(['--dir', missing]);
  assert.strictEqual(r.code, 0, '없다고 실패시키면 안 된다 — 진단 도구다');
  assert.match(r.out, /전사 폴더가 없다/, '미실행이 통과와 같은 모양이 됐다');
  assert.match(r.out, /repo 밖/, '왜 없을 수 있는지를 안 알려준다');
});

test('usage 4종을 세션 단위로 집계한다', () => {
  const dir = fixtureDir([
    turn({ input_tokens: 10, cache_creation_input_tokens: 2000, cache_read_input_tokens: 50000, output_tokens: 300 }),
    turn({ input_tokens: 5, cache_creation_input_tokens: 1000, cache_read_input_tokens: 70000, output_tokens: 200 }),
  ]);
  const r = run(['--dir', dir, '--days', '3650']);
  assert.match(r.out, /세션 1개/);
  assert.match(r.out, /120,000/, '캐시읽기 합계(50000+70000)가 안 보인다');
  assert.match(r.out, /3,000/, '캐시생성 합계(2000+1000)가 안 보인다');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('가중 환산으로 「어디로 갔나」를 가른다 — 재읽기가 1위면 1위로 나온다', () => {
  // 재읽기 1,000,000×0.1=100,000 vs 출력 1,000×5=5,000 → 재읽기가 압도
  const dir = fixtureDir([turn({ input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 1000000, output_tokens: 1000 })]);
  const r = run(['--dir', dir, '--days', '3650']);
  const body = r.out.split('어디로 갔나')[1] || '';
  const first = body.split('\n').filter((l) => /%/.test(l))[0] || '';
  assert.match(first, /컨텍스트 재읽기/, '가중 환산이 순서를 못 가른다 — 원값만 보면 판단이 뒤집힌다');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('--tools 는 이미지 base64를 컨텍스트 점유에 포함한다 (실제로 실리는 양이 그것이다)', () => {
  const big = 'A'.repeat(5000);
  const dir = fixtureDir([
    turn({ input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1, output_tokens: 1 }),
    { message: { content: [{ type: 'tool_use', id: 'u1', name: 'mcp__x__computer', input: { action: 'screenshot' } }] } },
    { message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: [{ type: 'image', source: { data: big } }] }] } },
    { message: { content: [{ type: 'tool_use', id: 'u2', name: 'Read', input: {} } ] } },
    { message: { content: [{ type: 'tool_result', tool_use_id: 'u2', content: [{ type: 'text', text: 'short' }] }] } },
  ]);
  const r = run(['--dir', dir, '--days', '3650', '--tools']);
  assert.match(r.out, /mcp__x__computer/, '이미지를 낸 도구가 목록에 없다');
  const line = r.out.split('\n').find((l) => l.includes('mcp__x__computer')) || '';
  assert.match(line, /5,00\d/, 'base64 길이가 점유에서 빠졌다 — 이미지는 문자수 0으로 보이면 안 된다');
  // 이미지 도구가 Read보다 위에 와야 한다(정렬이 점유 기준인지)
  assert.ok(
    r.out.indexOf('mcp__x__computer') < r.out.indexOf('  Read') || !r.out.includes('  Read'),
    '점유가 큰 도구가 위로 오지 않는다'
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('세션 시작 오버헤드를 첫 요청에서 집는다', () => {
  const dir = fixtureDir([
    turn({ input_tokens: 5, cache_creation_input_tokens: 60000, cache_read_input_tokens: 0, output_tokens: 10 }),
    turn({ input_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 60000, output_tokens: 10 }),
  ]);
  const r = run(['--dir', dir, '--days', '3650']);
  assert.match(r.out, /시작 오버헤드/);
  assert.match(r.out, /60,005/, '첫 요청 총 input 을 오버헤드로 못 잡았다');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('망가진 줄이 섞여도 나머지를 센다 (전사는 언제든 잘려 있을 수 있다)', () => {
  tmpSeq += 1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `synk-tokenaudit-bad-${process.pid}-`));
  fs.writeFileSync(
    path.join(dir, 'b.jsonl'),
    ['{"broken": ', JSON.stringify(turn({ input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 12345, output_tokens: 1 })), ''].join('\n')
  );
  const r = run(['--dir', dir, '--days', '3650']);
  assert.strictEqual(r.code, 0, '깨진 줄 하나에 도구 전체가 죽었다');
  assert.match(r.out, /12,345/, '깨진 줄 뒤의 정상 줄을 못 셌다');
  fs.rmSync(dir, { recursive: true, force: true });
});
