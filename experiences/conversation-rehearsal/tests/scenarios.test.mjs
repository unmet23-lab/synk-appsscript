import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SCENARIOS, PRACTICES, DIRECTIONS, REVIEWS, INTENSITIES, TURN_IDS, createSession, appendTurn, getTurn, archive, parseArchive, practiceDetails } from '../domain.mjs';
import { ELEMENTS, analyzeAnswer } from '../coach.mjs';

const NEW = ['presentation', 'negotiation', 'apology', 'feedback'];
const AI_NAMES = /GPT|ChatGPT|Claude|Gemini|OpenAI|Anthropic|클로드|제미나이/i;
const sentences = text => text.split(/(?<=[.?!…])\s+/u).filter(Boolean);
function walk(scenario, practice, focus, intensity) {
  let session = createSession({ scenario, practice, intensity, counterpart: '연습 상대', goal: '내가 정한 목표', id: `${scenario}-${practice?.counterpart}-${practice?.goal}-${focus}-${intensity}`, at: '2026-10-14T00:00:00.000Z' });
  for (let i = 0; i < 3; i++) session = appendTurn(session, { answer: `내 답 ${i}`, review: 'easy', focus });
  return session;
}

test('seven situations: the three originals plus presentation, negotiation, apology and feedback', () => {
  assert.deepEqual(Object.keys(SCENARIOS), ['interview', 'request', 'refusal', ...NEW]);
  assert.deepEqual(Object.keys(PRACTICES), Object.keys(SCENARIOS));
  for (const [id, scenario] of Object.entries(SCENARIOS)) {
    for (const key of ['name', 'short', 'note', 'counterpart', 'goal', 'starter', 'check']) assert.ok(typeof scenario[key] === 'string' && scenario[key].trim(), `${id}.${key}`);
    assert.deepEqual(Object.keys(scenario.turns), TURN_IDS, id);
  }
});

test('the original three situations keep every normal-strength line exactly as before (hash of 2026-10-08 text)', () => {
  const strip = value => JSON.parse(JSON.stringify(value, (key, v) => (key === 'tone' || key === 'tones') ? undefined : v));
  const original = ['interview', 'request', 'refusal'];
  const text = JSON.stringify(strip({ scenarios: Object.fromEntries(original.map(id => [id, SCENARIOS[id]])), practices: Object.fromEntries(original.map(id => [id, PRACTICES[id]])), reviews: REVIEWS, directions: DIRECTIONS }));
  assert.equal(createHash('sha256').update(text).digest('hex'), 'c1a91988670e67a90a030cd529bcf48111ce151a0451beaa0e12c6d67384d34f');
});

test('every situation has 2 counterparts × 2 goals × 5 authored turns, with gentle and tough voices', () => {
  for (const [scenario, options] of Object.entries(PRACTICES)) {
    assert.equal(Object.keys(options.counterparts).length, 2, scenario);
    assert.equal(Object.keys(options.goals).length, 2, scenario);
    for (const [id, counterpart] of Object.entries(options.counterparts)) {
      for (const key of ['label', 'opening', 'pressure', 'hint']) assert.ok(counterpart[key]?.trim(), `${scenario}.${id}.${key}`);
      for (const intensity of ['gentle', 'tough']) for (const key of ['opening', 'pressure']) {
        const line = counterpart.tone[intensity][key];
        assert.ok(line?.trim() && line !== counterpart[key], `${scenario}.${id}.${intensity}.${key}`);
      }
      assert.notEqual(counterpart.tone.gentle.pressure, counterpart.tone.tough.pressure);
    }
    for (const [id, goal] of Object.entries(options.goals)) {
      for (const key of ['label', 'goal', 'starter', 'check']) assert.ok(goal[key]?.trim(), `${scenario}.${id}.${key}`);
      assert.deepEqual(Object.keys(goal.turns), TURN_IDS, `${scenario}.${id}`);
      const prompts = Object.values(goal.turns).map(turn => turn.prompt);
      assert.equal(new Set(prompts).size, 5, `${scenario}.${id} 대사 중복`);
      for (const [turnId, turn] of Object.entries(goal.turns)) {
        for (const key of ['title', 'prompt', 'hint']) assert.ok(turn[key]?.trim(), `${scenario}.${id}.${turnId}.${key}`);
        assert.notEqual(turn.prompt, turn.hint);
      }
      const { tones, prompt } = goal.turns.pressure;
      assert.ok(tones.gentle && tones.tough && new Set([tones.gentle, prompt, tones.tough]).size === 3, `${scenario}.${id} 압박 강도`);
    }
    for (const turn of Object.values(SCENARIOS[scenario].turns)) assert.ok(turn.title && turn.prompt && turn.hint);
    assert.ok(SCENARIOS[scenario].turns.pressure.tones.gentle && SCENARIOS[scenario].turns.pressure.tones.tough);
  }
});

test('all 7 situations × counterparts × goals × 3 directions × 3 strengths produce lines, and strength changes what the counterpart says', () => {
  let paths = 0;
  for (const [scenario, options] of Object.entries(PRACTICES)) for (const counterpart of Object.keys(options.counterparts)) for (const goal of Object.keys(options.goals)) {
    const practice = { counterpart, goal };
    for (const focus of Object.keys(DIRECTIONS)) {
      const byStrength = {};
      for (const intensity of Object.keys(INTENSITIES)) {
        const session = walk(scenario, practice, focus, intensity), restored = parseArchive(JSON.stringify(archive([session]))).sessions[0];
        assert.equal(restored.intensity, intensity);
        byStrength[intensity] = [0, 1, 2].map(i => getTurn(restored, i));
        for (const [i, turn] of byStrength[intensity].entries()) {
          assert.ok(turn.title && turn.prompt.length > 4 && turn.hint.length > 4, `${scenario}/${counterpart}/${goal}/${focus}/${intensity}/${i}`);
          assert.deepEqual(turn, getTurn(session, i));
          assert.equal(new Set(sentences(turn.prompt)).size, sentences(turn.prompt).length, `같은 문장 반복: ${turn.prompt}`);
          assert.doesNotMatch(turn.prompt + turn.hint, AI_NAMES);
        }
        paths++;
      }
      // 첫 대사와 압박 대사는 강도마다 달라지고, 보통은 이전 대사(앞말 + 대사)를 그대로 쓴다.
      assert.equal(new Set(Object.values(byStrength).map(turns => turns[0].prompt)).size, 3);
      const normal = options.counterparts[counterpart], authored = options.goals[goal].turns;
      assert.equal(byStrength.normal[0].prompt, `${normal.opening} ${authored.opening.prompt}`);
      assert.equal(byStrength.normal[2].prompt, authored.close.prompt);
      if (focus === 'pressure') {
        assert.equal(new Set(Object.values(byStrength).map(turns => turns[1].prompt)).size, 3);
        assert.equal(byStrength.normal[1].prompt, `${normal.pressure} ${authored.pressure.prompt}`);
        assert.equal(byStrength.tough[1].prompt, `${normal.tone.tough.pressure} ${authored.pressure.tones.tough}`);
      } else assert.equal(new Set(Object.values(byStrength).map(turns => turns[1].prompt)).size, 1);
    }
  }
  assert.equal(paths, 7 * 2 * 2 * 3 * 3);
});

test('new situations also run without an explicit practice choice, and the coach knows each of them', () => {
  for (const scenario of NEW) {
    for (const intensity of Object.keys(INTENSITIES)) {
      const session = walk(scenario, undefined, 'pressure', intensity);
      assert.equal(getTurn(session, 1).prompt, intensity === 'normal' ? SCENARIOS[scenario].turns.pressure.prompt : SCENARIOS[scenario].turns.pressure.tones[intensity]);
    }
    assert.ok(ELEMENTS[scenario].length >= 4);
    for (const [goalId, goal] of Object.entries(PRACTICES[scenario].goals)) {
      // 연습 목표의 시작 문장은 그 상황의 코치가 읽을 수 있는 말이어야 한다(빈 분석이 아니라 무언가를 찾음).
      assert.ok(analyzeAnswer({ scenario, text: goal.starter.replaceAll('○○', '보고서') }).found.length >= 1, `${scenario}.${goalId}`);
    }
  }
  assert.throws(() => createSession({ scenario: 'presentation', counterpart: '팀장', goal: '보고', practice: { counterpart: 'hr', goal: 'status' } }));
  assert.throws(() => createSession({ scenario: 'apology', counterpart: '동료', goal: '사과', intensity: 'harsh' }));
  assert.deepEqual(practiceDetails({ scenario: 'feedback', practice: { counterpart: 'peer', goal: 'praise' } }).label, '같은 팀 동료 · 잘한 점 구체적으로 칭찬하기');
});

test('authored copy is natural, complete Korean: sentence endings, no doubled spaces, no tool names', () => {
  const texts = [];
  for (const scenario of Object.values(SCENARIOS)) { texts.push(scenario.name, scenario.note, scenario.check); for (const turn of Object.values(scenario.turns)) texts.push(turn.prompt, turn.hint, ...Object.values(turn.tones || {})); }
  for (const options of Object.values(PRACTICES)) {
    for (const c of Object.values(options.counterparts)) texts.push(c.opening, c.pressure, c.hint, c.tone.gentle.opening, c.tone.gentle.pressure, c.tone.tough.opening, c.tone.tough.pressure);
    for (const g of Object.values(options.goals)) { texts.push(g.check); for (const turn of Object.values(g.turns)) texts.push(turn.prompt, turn.hint, ...Object.values(turn.tones || {})); }
  }
  for (const text of texts) {
    assert.doesNotMatch(text, /\s{2}|undefined|null/u, text);
    assert.doesNotMatch(text, AI_NAMES, text);
  }
  for (const scenario of NEW) for (const g of Object.values(PRACTICES[scenario].goals)) for (const turn of Object.values(g.turns)) {
    for (const line of [turn.prompt, turn.hint, ...Object.values(turn.tones || {})]) assert.match(line, /[.?!…]$/u, line);
  }
});
