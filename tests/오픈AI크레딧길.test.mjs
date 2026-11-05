// OpenAI 월 API 크레딧은 받아쓰기 몫이다(유호님 11-03 「여기에만 써」 · 11-05 「그거에 쓰기로하자」, docs/AI_계정과_크레딧.md 「GPT」).
// 실제 주소를 부르는 코드가 새로 생겨도 문을 지나는지, 옛 도구가 키를 읽기 전에 멈추는지 본다. 어느 시험도 실제 API를 부르지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const 저장소 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 문을 지났다는 표: 키 통로를 가져오거나, 그 자리에서 같은 말로 멈춘다.
const 문 = /받아 적기에만 쓴다|lib\/오픈AI키\.mjs|\.\/오픈AI키\.mjs/;
// 키를 환경 변수에서만 받아 스스로 돌지 못하는 길. 늘리려면 까닭을 적는다.
const 문밖 = new Map([
  ['tools/learning-blind/providers.mjs', '사람이 OPENAI_API_KEY를 직접 준 실행만 부른다 — 이 PC에 그 값을 두지 않는다'],
]);
const 남의코드 = /^\.claude\/skills\/last30days\//; // 내려받은 조사 스킬 — 키를 환경에서만 받는다

// 시험 안에서 문이 빠지면 실제 API로 나가지 않도록, 있지도 않은 키 파일을 물려 키 읽기에서 먼저 넘어지게 한다.
function 막는환경(더 = {}) {
  const env = { ...process.env, OPENAI_KEY_FILE: path.join(os.tmpdir(), '없는-오픈AI-키-파일'), ...더 };
  delete env.SYNK_OPENAI_BASE;
  delete env.SYNK_OPENAI_KEYLIST;
  delete env.SYNK_ALLOW_PAID_API;
  return env;
}

test('실제 OpenAI 주소를 적은 코드는 모두 크레딧 문을 지난다', () => {
  const 나옴 = execFileSync('git', ['-C', 저장소, '-c', 'core.quotepath=false', 'grep', '-l', '-F', 'api.openai.com', '--',
    '*.js', '*.mjs', '*.cjs', '*.ts', '*.py', ':!tests', ':!docs'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const 파일들 = 나옴.split('\n').filter(Boolean);
  assert.ok(파일들.includes('tools/lib/오픈AI키.mjs'), '문 자체가 목록에 있어야 훑기가 돈 것이다');
  const 샌다 = 파일들.filter((f) => !문밖.has(f) && !남의코드.test(f))
    .filter((f) => !문.test(fs.readFileSync(path.join(저장소, f), 'utf8')));
  assert.deepEqual(샌다, [], '이 파일들이 크레딧 문 없이 실제 OpenAI를 부른다 — tools/lib/오픈AI키.mjs를 거치거나 받아쓰기 용도인지 먼저 정한다');
});

for (const [도구, 인자] of [
  ['tools/펠트부품GPT굽기.js', ['--판', 'UI', '--유료-api']],
  ['experiences/entry-check/art-source/bake.mjs', ['--판', '도구', '--유료-api']],
]) {
  test(`${도구}: --유료-api를 줘도 키를 읽기 전에 멈춘다`, () => {
    const r = spawnSync(process.execPath, [path.join(저장소, 도구), ...인자], { env: 막는환경(), encoding: 'utf8', timeout: 60_000 });
    assert.notEqual(r.status, 0);
    assert.match(`${r.stdout}${r.stderr}`, /받아 적기에만/);
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, /열쇠 파일이 없다/);
  });
}

test('듣기 시험 녹음: OpenAI 갈래는 키를 내주지 않고 코드 3으로 멈춘다', () => {
  const 작업 = fs.mkdtempSync(path.join(os.tmpdir(), '크레딧길-'));
  try {
    const 도구 = path.join(저장소, 'experiences/synk-world-app/qa/realtime-roleplay-20261029/듣기시험/녹음.mjs');
    const r = spawnSync(process.execPath, [도구, '학습자'], { env: 막는환경({ SYNK_ROLEPLAY_WORK: 작업 }), encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 3);
    assert.match(`${r.stdout}${r.stderr}`, /받아 적기에만/);
  } finally {
    fs.rmSync(작업, { recursive: true, force: true });
  }
});

test('상황극 키 통로: 키차례 + 키읽기로 바로 불러도 값을 내주지 않는다', async (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '크레딧길-'));
  const 파일 = path.join(폴더, '키.txt');
  fs.writeFileSync(파일, `sk-${'x'.repeat(24)}\n`);
  const 원래 = process.env.SYNK_OPENAI_BASE;
  t.after(() => {
    fs.rmSync(폴더, { recursive: true, force: true });
    if (원래 === undefined) delete process.env.SYNK_OPENAI_BASE; else process.env.SYNK_OPENAI_BASE = 원래;
  });
  const { 키읽기 } = await import(pathToFileURL(path.join(저장소, 'experiences/realtime-roleplay/lib/오픈AI키.mjs')).href);
  delete process.env.SYNK_OPENAI_BASE;
  assert.throws(() => 키읽기({ 이름: '시험', 파일 }), /받아 적기에만/);
  process.env.SYNK_OPENAI_BASE = 'http://127.0.0.1:9/v1';
  assert.equal(키읽기({ 이름: '시험', 파일 }), `sk-${'x'.repeat(24)}`); // 가짜 서버 시험은 그대로 돈다
});
