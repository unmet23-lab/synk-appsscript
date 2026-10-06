// 연수 단계와 목소리 파일이 원고(content.mjs · narration.mjs)와 어긋나지 않는지 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENUES } from './content.mjs';
import { composeShift } from './core.mjs';
import { TUTORIAL, TUTORIAL_CASES, VOICE_ID } from './narration.mjs';
import { voiceLines } from './art-source/voice.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pool = VENUES.find((v) => v.id === 'pool');
const byId = (id) => pool.cases.find((c) => c.id === id);

test('연수 손님: 첫째는 통과(모자 있고 음식 없음), 둘째는 김밥 때문에 음식 규칙 거절', () => {
  const [first, second] = TUTORIAL_CASES.map(byId);
  assert.equal(first.answer, 'pass');
  assert.ok(first.items.includes('swim-cap') && !first.items.some((i) => ['gimbap', 'snack'].includes(i)));
  assert.equal(second.answer, 'food');
  assert.ok(second.items.includes('gimbap'));
  // 연수 문구가 말하는 규칙 번호(두 번째)와 실제 안내문 순서가 같다
  assert.equal(pool.notice.rules[1].id, 'food');
  assert.match(TUTORIAL.find((s) => s.id === 'tut-rule').text, /두 번째/);
});

test('연수 근무의 나머지 손님도 안내문 규칙을 모두 만난다', () => {
  const base = composeShift(pool, { firstTime: true });
  const ids = base.map((c) => c.id);
  for (const id of TUTORIAL_CASES) assert.ok(ids.includes(id), `${id}가 처음 근무 구성에 있어야 연수 줄이 6명으로 유지된다`);
  const answers = new Set(base.map((c) => c.answer));
  for (const r of pool.notice.rules) assert.ok(answers.has(r.id), `규칙 ${r.id}`);
});

test('연수 단계: 비출 곳이 화면에 있고, 조작을 기다리는 단계는 알맞은 손님에 붙는다', () => {
  const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
  for (const s of TUTORIAL) {
    if (!s.target) continue;
    const base = s.target.split(' ')[0];
    const hit = base.startsWith('#') ? html.includes(`id="${base.slice(1)}"`) : html.includes(`class="${base.slice(1)}`) || html.includes(` ${base.slice(1)}"`);
    assert.ok(hit, `${s.id}: ${s.target}`);
  }
  assert.deepEqual(TUTORIAL.filter((s) => s.wait).map((s) => [s.wait, s.guest]),
    [['pass', 0], ['next', 0], ['reject', 1], ['rule:food', 1], ['next', 1]]);
  assert.equal(TUTORIAL.at(-1).target, null);
});

test('목소리: 원고의 모든 줄이 구워져 있고, 구운 글이 지금 원고와 같다', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(here, 'assets', 'voice', 'voices.json'), 'utf8'));
  for (const l of voiceLines()) {
    const m = manifest.lines[l.id];
    assert.ok(m, `구운 목소리 없음: ${l.id} (node art-source/voice.mjs --유료-api)`);
    assert.equal(m.spoken, l.spoken, `원고가 바뀌었다: ${l.id}`);
    assert.ok(fs.existsSync(path.join(here, 'assets', 'voice', `${l.id}.mp3`)), `${l.id}.mp3`);
  }
  // 손님마다 대사·대답·그 뒤에 생긴 일이 다 있다
  for (const v of VENUES) for (const c of v.cases.filter(c => !c.textOnly)) for (const id of [VOICE_ID.line(c.id), VOICE_ID.reply(c.id), VOICE_ID.oops(c.id)]) assert.ok(manifest.lines[id], id);
  for (const c of VENUES.flatMap(v => v.cases).filter(c => c.textOnly)) {
    assert.ok(c.followupOnly, '음성 없는 손님은 확인용 원고로 명시한다');
    assert.ok(!voiceLines().some(line => line.id === VOICE_ID.line(c.id)), '무료 글 읽기 문항을 음성 제작 대상으로 넣지 않는다');
  }
});
