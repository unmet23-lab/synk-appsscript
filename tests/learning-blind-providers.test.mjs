// Mock API-shaped fixtures only. These tests are not model quality, API access,
// latency, price, or real billed-usage evidence and never perform a network call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROVIDERS, DECISION_INSTRUCTIONS, buildRequest, normalizeResponse } from '../tools/learning-blind/providers.mjs';

const input = () => ({ observations: [
  { id: 'obs-reading', skillId: 'read-instruction', result: 'difficulty', text: '짧은 지시문의 뜻을 고르는 연습에서 틀렸어요.' },
  { id: 'obs-self-report', kind: 'self-report', text: '듣기가 쉽다고 말했지만 실제 듣기 수행은 아직 없어요.' },
], context: { audioAvailable: false }, candidates: [
  { id: 'practice-reading', label: '짧은 지시문 뜻 고르기', contentId: 'reading-1', skillId: 'read-instruction', difficulty: 1, responseFormat: 'choice', modality: 'text' },
  { id: 'practice-listening', label: '나레이션 듣고 O/X', contentId: 'listen-1', skillId: 'listen-instruction', difficulty: 1, responseFormat: 'ox', modality: 'audio' },
] });
const decision = () => ({ candidateId: 'practice-reading', evidenceId: 'obs-reading' });
const raw = provider => {
  const common = { model: PROVIDERS[provider].model, usage: { input_tokens: 100, output_tokens: 12 } };
  if (provider === 'openai') return { ...common, status: 'completed', incomplete_details: null, output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(decision()) }] },
  ] };
  if (provider === 'anthropic') return { ...common, type: 'message', role: 'assistant', stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(decision()) }] };
  return { ...common, answers: {
    candidateId: { type: 'choice', choice: 'practice-reading', confidence: 0.7, probabilities: { 'practice-reading': 0.7, 'practice-listening': 0.3 } },
    evidenceId: { type: 'choice', choice: 'obs-reading', confidence: 0.6, probabilities: { 'obs-reading': 0.6, 'obs-self-report': 0.1, none: 0.3 } },
  } };
};

test('three pinned providers expose public transport metadata without reading keys or environment', async () => {
  assert.deepEqual(Object.keys(PROVIDERS), ['openai', 'anthropic', 'typesafe']);
  assert.equal(PROVIDERS.typesafe.model, 'jev-1.13.0');
  assert.equal(PROVIDERS.typesafe.maxOutputTokens, null);
  assert.equal(PROVIDERS.anthropic.headers['anthropic-version'], '2023-06-01');
  assert.ok(Object.isFrozen(PROVIDERS) && Object.values(PROVIDERS).every(Object.isFrozen));
  const source = await readFile(new URL('../tools/learning-blind/providers.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|process\s*\.\s*env|node:fs|node:https|readFile\s*\(/);
});

test('same authored input and decision instructions reach every provider; no tools, history or grading labels are added', () => {
  const original = input(), snapshot = structuredClone(original);
  const openai = buildRequest('openai', original), claude = buildRequest('anthropic', original), jev = buildRequest('typesafe', original);
  assert.equal(openai.instructions, DECISION_INSTRUCTIONS);
  assert.equal(claude.system, DECISION_INSTRUCTIONS);
  assert.ok(jev.questions.candidateId.instructions.startsWith(DECISION_INSTRUCTIONS));
  assert.ok(jev.questions.evidenceId.instructions.startsWith(DECISION_INSTRUCTIONS));
  assert.equal(openai.input[0].content, claude.messages[0].content);
  assert.equal(openai.input[0].content, jev.state);
  assert.deepEqual(JSON.parse(jev.state), original);
  assert.deepEqual(original, snapshot);
  for (const body of [openai, claude, jev]) {
    assert.equal(body.tools, undefined);
    assert.equal(body.temperature, undefined);
    assert.equal(body.previous_response_id, undefined);
  }
  assert.equal(openai.store, false);
  assert.deepEqual(openai.reasoning, { effort: 'low' });
  assert.deepEqual(claude.thinking, { type: 'between_tools' });
  assert.equal(claude.output_config.effort, 'low');
});

test('explicit candidate and evidence permutations control state, JSON enums and Jev choice criteria', () => {
  const options = { candidateOrder: ['practice-listening', 'practice-reading'], evidenceOrder: ['none', 'obs-self-report', 'obs-reading'] };
  for (const provider of Object.keys(PROVIDERS)) {
    const request = buildRequest(provider, input(), options);
    const state = JSON.parse(provider === 'typesafe' ? request.state : provider === 'openai' ? request.input[0].content : request.messages[0].content);
    assert.deepEqual(state.candidates.map(row => row.id), options.candidateOrder);
    assert.deepEqual(state.observations.map(row => row.id), ['obs-self-report', 'obs-reading']);
    if (provider === 'typesafe') {
      assert.deepEqual(Object.keys(request.questions.candidateId.criteria), options.candidateOrder);
      assert.deepEqual(Object.keys(request.questions.evidenceId.criteria), options.evidenceOrder);
      assert.equal(request.questions.candidateId.type, 'choice');
      assert.equal(request.questions.evidenceId.type, 'choice');
    } else {
      const schema = provider === 'openai' ? request.text.format.schema : request.output_config.format.schema;
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual(schema.required, ['candidateId', 'evidenceId']);
      assert.deepEqual(schema.properties.candidateId.enum, options.candidateOrder);
      assert.deepEqual(schema.properties.evidenceId.enum, options.evidenceOrder);
    }
  }
});

test('observation-only evidence permutation appends none; missing observations still have an explicit none option', () => {
  const body = buildRequest('typesafe', input(), { evidenceOrder: ['obs-self-report', 'obs-reading'] });
  assert.deepEqual(Object.keys(body.questions.evidenceId.criteria), ['obs-self-report', 'obs-reading', 'none']);
  const unknown = input(); unknown.observations = []; delete unknown.context.audioAvailable;
  assert.deepEqual(buildRequest('openai', unknown).text.format.schema.properties.evidenceId.enum, ['none']);
});

test('invalid input IDs, grading roots, duplicate orders and non-boolean sound state are rejected', () => {
  const mutations = [
    x => { x.expected = decision(); },
    x => { x.observations[1].id = x.observations[0].id; },
    x => { x.candidates[0].id = 'none'; },
    x => { x.observations[0].id = '__proto__'; },
    x => { x.context.audioAvailable = 'true'; },
    x => { x.candidates[0].label = ''; },
  ];
  for (const mutate of mutations) { const x = input(); mutate(x); assert.throws(() => buildRequest('openai', x)); }
  assert.throws(() => buildRequest('openai', input(), { candidateOrder: ['practice-reading', 'practice-reading'] }));
  assert.throws(() => buildRequest('openai', input(), { evidenceOrder: ['obs-reading', 'unknown'] }));
  assert.throws(() => buildRequest('unknown', input()), /LEARNING_PROVIDER_UNKNOWN/);
});

for (const provider of Object.keys(PROVIDERS)) {
  test(`${provider}: official-shaped mock response normalizes to the same two IDs and billed usage`, () => {
    assert.deepEqual(normalizeResponse(provider, raw(provider)), { ...decision(), model: PROVIDERS[provider].model,
      usage: { inputTokens: 100, outputTokens: 12 }, status: 'completed' });
  });
  test(`${provider}: usage is mandatory, nonnegative and integer; changed models never silently fall back`, () => {
    for (const usage of [undefined, {}, { input_tokens: 0 }, { input_tokens: -1, output_tokens: 10 }, { input_tokens: 100, output_tokens: 1.5 }]) {
      assert.throws(() => normalizeResponse(provider, { ...raw(provider), usage }));
    }
    assert.throws(() => normalizeResponse(provider, { ...raw(provider), model: 'other-model' }));
    assert.throws(() => normalizeResponse(provider, { ...raw(provider), error: { message: 'provider failure' } }));
  });
}

test('OpenAI rejects incomplete, refusal, unexpected tool output, extra fields and multiple JSON texts', () => {
  const mutations = [
    x => { x.status = 'incomplete'; },
    x => { x.incomplete_details = { reason: 'max_output_tokens' }; },
    x => { x.output[1].status = 'in_progress'; },
    x => { x.output[1].content = [{ type: 'refusal', refusal: 'refused' }]; },
    x => { x.output.push({ type: 'function_call', name: 'unexpected' }); },
    x => { x.output[1].content[0].text = JSON.stringify({ ...decision(), confidence: 1 }); },
    x => { x.output[1].content.push({ type: 'output_text', text: '{}' }); },
    x => { x.output[1].content[0].text = 'not json'; },
  ];
  for (const mutate of mutations) { const x = raw('openai'); mutate(x); assert.throws(() => normalizeResponse('openai', x)); }
});

test('Claude accepts only a completed text-only turn under between_tools; refusal and truncation are failures', () => {
  for (const reason of ['max_tokens', 'refusal', 'tool_use', 'pause_turn', null]) {
    assert.throws(() => normalizeResponse('anthropic', { ...raw('anthropic'), stop_reason: reason }));
  }
  assert.throws(() => normalizeResponse('anthropic', { ...raw('anthropic'), content: [{ type: 'tool_use', id: 'tool' }] }));
  assert.throws(() => normalizeResponse('anthropic', { ...raw('anthropic'), content: [{ type: 'text', text: JSON.stringify({ ...decision(), extra: 'unexpected' }) }] }));
});

test('Jev accepts actual choice fields, never probabilities/score/unknown answer names as replacements', () => {
  const mutations = [
    x => { x.answers.candidateId.type = 'score'; },
    x => { delete x.answers.candidateId.choice; },
    x => { x.answers.evidenceId.choice = ''; },
    x => { x.answers.evidenceId.confidence = NaN; },
    x => { x.answers.evidenceId.probabilities['obs-reading'] = -1; },
    x => { x.answers.unexpected = { type: 'choice', choice: 'none' }; },
    x => { x.status = 'incomplete'; },
  ];
  for (const mutate of mutations) { const x = raw('typesafe'); mutate(x); assert.throws(() => normalizeResponse('typesafe', x)); }
});

test('explicit none is preserved, while response membership remains the evaluator responsibility', () => {
  const x = raw('openai'); x.output[1].content[0].text = JSON.stringify({ candidateId: 'unknown-but-valid-id', evidenceId: 'none' });
  assert.equal(normalizeResponse('openai', x).evidenceId, 'none');
  assert.equal(normalizeResponse('openai', x).candidateId, 'unknown-but-valid-id');
});

test('Claude cache usage is counted separately from noncached input instead of disappearing', () => {
  const x = raw('anthropic'); x.usage.cache_creation_input_tokens = 5; x.usage.cache_read_input_tokens = 25;
  assert.equal(normalizeResponse('anthropic', x).usage.inputTokens, 130);
  x.usage.cache_read_input_tokens = -1;
  assert.throws(() => normalizeResponse('anthropic', x));
});
