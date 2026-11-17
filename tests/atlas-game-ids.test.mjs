// 지금 쓰는 게임 이름이 모두 Atlas 엔진의 게임 이름 꼴에 맞는지 본다(단계 4 · 4-4d Fable 끝 판 F1, 설계 주인 11-17 저녁 승인).
// 엔진 코치는 만들 때 꼴이 틀린 gameId를 던진다(packages/atlas/src/coach/index.mjs createCoach). 꼴은 [A-Za-z0-9_:-] 마디를 점으로 이은
// 80자 이하다(packages/atlas/src/coach/set-id.mjs isGameId). 4-6에서 게임들을 새 코치로 옮길 때 실행 중에 처음 터지지 않게, 코치나 옛 엔진
// 게임을 만드는 곳의 게임 이름을 원천에서 모아 미리 본다. 모으는 곳:
//   ① experiences/<게임>/learning.mjs의 GAME_ID(4-6에서 옮길 게임들)
//   ② WORLD 앱(experiences/synk-world-app)의 새 엔진 코치 이름(coachFor · 정책의 gameId · LIFE_GAME_ID · 근거를 세는 판의 FIRST_GAME)
//   ③ experiences 아래 그 밖의 원천에서 createGame({ gameId: '…' }) · createCoach({ gameId: '…' })의 글자
//   ④ SYNK-talk이 있으면(CI는 형제 저장소의 시험 입력을, PC는 공용 작업본 옆 사본을) 그 서버 런타임의 GAME_ID와 gameId 글자
// 시험(qa) · 생성물(bundle · dist · generated) · node_modules는 원천이 아니라 보지 않는다(시험은 엉뚱한 이름을 일부러 쓰고, 그 코치는 시험이 바로 던진다).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { isGameId } = await import(pathToFileURL(path.join(root, 'packages/atlas/src/coach/set-id.mjs')).href);

const tracked = execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files', '-z', 'experiences'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 1 << 28,
})
  .split('\0')
  .filter(Boolean);
const isSource = file =>
  /\.(?:mjs|js|cjs)$/.test(file) &&
  !/(?:^|\/)(?:qa|node_modules|dist|generated|tests?)\//.test(file) &&
  !/\.bundle\.|\.min\./.test(file);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const all = (text, pattern) => [...text.matchAll(pattern)].map(match => match[1]);

// 게임 이름 상수 — GAME_ID로 끝나는 이름과, 입구가 가져다 쓰는 근거 판의 FIRST_GAME처럼 GAME으로 끝나는 이름. 세 꼴 모두 빈 이름('')도 모은다 —
// 모으기에서 빠진 이름은 꼴 검사를 비켜 간다(끝 판 고침 검수 GPT GB1).
const GAME_CONST = /\b[A-Z_]*GAME(?:_ID)?\s*=\s*['"]([^'"]*)['"]/g;
const MADE_WITH = /\bcreate(?:Game|Coach)\(\{\s*gameId\s*:\s*['"]([^'"]*)['"]/g;
const POLICY_ID = /\bgameId\s*:\s*['"]([^'"]*)['"]/g;
// WORLD 코치를 만드는 coachFor 호출(정의의 기본값 포함)은 괄호 안의 글자 값을 꼴과 상관없이 모두 모은다 — 빈 이름 · 점 둘 · 띄어쓰기 · 틀(`…`)
// 같은 틀린 이름도 모아야 꼴 검사에 걸린다(끝 판 카본 B2). 괄호는 한 겹(화살표 함수의 인자)까지 안고, 그보다 깊어 못 읽는 호출은 수 대조가 잡는다.
const COACH_CALL = /\bcoachFor\(((?:[^()]|\([^()]*\))*)\)/g;
const coachNames = args => [...args.matchAll(/(['"`])([^'"`]*)\1/g)].map(match => match[2]);

function gather() {
  const found = new Map(); // 이름 → 처음 찾은 파일
  const add = (id, file) => {
    if (!found.has(id)) found.set(id, file);
  };
  // ① 게임들의 GAME_ID
  const games = tracked.filter(file => /^experiences\/[^/]+\/learning\.mjs$/.test(file));
  for (const file of games) for (const id of all(read(file), GAME_CONST)) add(id, file);
  // ② WORLD 새 엔진 코치 — coachFor 호출의 글자 값 · 정책의 gameId · 이름 상수
  const world = tracked.filter(file => /^experiences\/synk-world-app\/[^/]+\.mjs$/.test(file) && isSource(file));
  for (const file of world) {
    const text = read(file);
    const calls = [...text.matchAll(COACH_CALL)];
    assert.equal(calls.length, (text.match(/\bcoachFor\(/g) ?? []).length, `${file} — coachFor 호출을 모두 읽는다`);
    for (const [, args] of calls) for (const id of coachNames(args)) add(id, file);
    for (const id of all(text, POLICY_ID)) add(id, file);
    for (const id of all(text, GAME_CONST)) add(id, file);
  }
  // ③ 그 밖의 원천에서 게임이나 코치를 만드는 글자
  for (const file of tracked.filter(isSource)) {
    const text = read(file);
    if (!/create(?:Game|Coach)\(/.test(text)) continue;
    for (const id of all(text, MADE_WITH)) add(id, file);
  }
  return found;
}

function talkRoot() {
  const candidates = [process.env.SYNK_TALK_ROOT, path.resolve(root, '../SYNK-talk')];
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    candidates.push(path.resolve(path.dirname(common), '../SYNK-talk'));
  } catch {
    // git이 없으면 앞의 둘만 본다
  }
  return candidates.find(dir => dir && fs.existsSync(path.join(dir, 'supabase/functions'))) || null;
}
const TALK_RUNTIMES = [
  'supabase/functions/_shared/synk-classroom-runtime.js',
  'supabase/functions/synk-world-v1/world-v1-runtime.mjs',
  'supabase/functions/synk-town/town-runtime.mjs',
];

test('지금 쓰는 게임 이름은 모두 엔진의 게임 이름 꼴이다 — 게임들 · WORLD 코치 · 그 밖에 게임을 만드는 곳(Fable 끝 판 F1)', () => {
  const found = gather();
  for (const id of ['world-home', 'world-practice', 'world-mock', 'world-life'])
    assert.ok(found.has(id), `WORLD 새 엔진 코치 이름 ${id}을 찾는다(모으기가 깨지지 않았다)`);
  const games = [...found.values()].filter(file => /\/learning\.mjs$/.test(file)).length;
  assert.ok(games >= 8, `게임들의 GAME_ID를 찾는다(${games}개)`);
  // learning.mjs마다 이름 상수에 넣은 값을 빠짐없이 모았다 — 빈 이름이나, 모으기가 못 읽는 꼴(따옴표 글자가 아닌 값)로 바뀐 이름이
  // 수에서 말없이 빠지지 않게(GPT GB1). 넣기를 세는 꼴은 GAME_CONST의 이름 꼴과 같고, 견주기(==)는 세지 않는다.
  for (const file of tracked.filter(name => /^experiences\/[^/]+\/learning\.mjs$/.test(name))) {
    const text = read(file);
    const assigned = (text.match(/\b[A-Z_]*GAME(?:_ID)?\s*=(?![=>])/g) ?? []).length;
    assert.equal(all(text, GAME_CONST).length, assigned, `${file} — 이름 상수의 값을 모두 모은다`);
  }
  const bad = [...found].filter(([id]) => !isGameId(id));
  assert.deepEqual(bad, [], '꼴이 틀린 게임 이름 — 새 코치가 만들 때 던진다');
});

test('SYNK-talk 서버 런타임의 게임 이름도 꼴에 맞는다(형제 저장소가 있을 때)', t => {
  const talk = talkRoot();
  const files = talk ? TALK_RUNTIMES.filter(rel => fs.existsSync(path.join(talk, rel))) : [];
  if (!files.length) {
    t.skip('SYNK-talk 런타임이 없다');
    return;
  }
  const ids = new Map();
  for (const rel of files) {
    const text = fs.readFileSync(path.join(talk, rel), 'utf8');
    for (const id of [...all(text, GAME_CONST), ...all(text, MADE_WITH)]) if (!ids.has(id)) ids.set(id, rel);
  }
  assert.ok(ids.size > 0, `talk 런타임에서 게임 이름을 찾는다(${files.join(', ')})`);
  const bad = [...ids].filter(([id]) => !isGameId(id));
  assert.deepEqual(bad, [], '꼴이 틀린 게임 이름 — 새 코치로 옮길 때 던진다');
});

test('꼴 검사 자체 — 틀린 이름은 거짓, 맞는 이름은 참이다(모으기만 보고 지나가지 않게)', () => {
  for (const id of ['', 'a..b', 'world.', '.world', 'g'.repeat(81), 'world mock', '한글']) assert.equal(isGameId(id), false, id);
  for (const id of ['atlas', 'world-mock', 'world-mock.x', 'first-steps-v1', 'g'.repeat(80)]) assert.equal(isGameId(id), true, id);
  // 모으기는 빈 이름도 모은다 — 그래야 빈 게임 이름이 위 꼴 검사에 걸린다(GPT GB1).
  assert.deepEqual(all("const GAME_ID = '';", GAME_CONST), ['']);
  assert.deepEqual(all("createGame({ gameId: '' })", MADE_WITH), ['']);
  assert.deepEqual(all("const policy = { gameId: '' };", POLICY_ID), ['']);
  // coachFor 호출은 꼴이 틀린 이름도 그대로 모은다 — 여러 줄 호출 · 화살표 함수 인자 · 틀 글자까지(끝 판 카본 B2).
  const coachIds = text => [...text.matchAll(COACH_CALL)].flatMap(([, args]) => coachNames(args));
  assert.deepEqual(coachIds("coachFor('world-a..b',()=>[a,b],(a,b)=>{x=a;})"), ['world-a..b']);
  assert.deepEqual(coachIds("coachFor(GUEST, banks,\n  'world mock')"), ['world mock']);
  assert.deepEqual(coachIds("coachFor(GUEST, banks, `world-${kind}`)"), ['world-${kind}']);
  assert.deepEqual(coachIds("coachFor(gameId,held,setHeld)"), []);
  for (const id of ['world-a..b', 'world mock', 'world-${kind}']) assert.equal(isGameId(id), false, id);
});
