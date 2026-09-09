'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveMotion, createSpeech } = require('./a11y.js');

test('device motion preference is the default; explicit choices can override it', () => {
  assert.equal(resolveMotion('system', true), true);
  assert.equal(resolveMotion('system', false), false);
  assert.equal(resolveMotion('reduce', false), true);
  assert.equal(resolveMotion('allow', true), false);
  assert.throws(() => resolveMotion('invalid', true), TypeError);
});
function speechFixture(voices = [{ name:'Korean', lang:'ko-KR' }]) {
  const states = [], calls = [], utterances = [];
  const synth = {
    getVoices: () => voices,
    speak(utterance) { calls.push('speak'); utterances.push(utterance); },
    cancel() { calls.push('cancel'); }
  };
  function Utterance(text) { this.text = text; }
  return { states, calls, utterances, synth, speaker: createSpeech({ synth, Utterance, onState:(...args) => states.push(args) }) };
}
test('installing a speech helper never starts audio', () => {
  const fixture = speechFixture();
  assert.deepEqual(fixture.calls, []);
  assert.equal(fixture.speaker.available(), true);
});
test('unsupported speech and missing Korean voices fail honestly without speaking', () => {
  const absent = createSpeech({});
  assert.deepEqual(absent.speak('설명'), { ok:false, reason:'unsupported' });
  const english = speechFixture([{ lang:'en-US' }]);
  assert.deepEqual(english.speaker.speak('설명'), { ok:false, reason:'voice-unavailable' });
  assert.deepEqual(english.calls, []);
});
test('new reading cancels active reading; stale end/error events cannot corrupt new state', () => {
  const fixture = speechFixture();
  assert.equal(fixture.speaker.speak('첫 장면').ok, true);
  const first = fixture.utterances[0];
  assert.equal(first.lang,'ko-KR');
  assert.equal(fixture.speaker.speak('다음 장면').ok, true);
  assert.deepEqual(fixture.calls,['speak','cancel','speak']);
  const lastState = fixture.states.at(-1);
  first.onend(); first.onerror({ error:'interrupted' });
  assert.deepEqual(fixture.states.at(-1),lastState);
  fixture.speaker.cancel();
  assert.equal(fixture.states.at(-1)[0],'idle');
  assert.equal(fixture.calls.at(-1),'cancel');
});
test('blocked playback returns a failure and leaves the helper idle', () => {
  const fixture = speechFixture();
  fixture.synth.speak = () => { throw new Error('Not allowed'); };
  assert.deepEqual(fixture.speaker.speak('설명'),{ok:false,reason:'unavailable'});
  assert.equal(fixture.states.at(-1)[0],'error');
  fixture.speaker.cancel();
  assert.deepEqual(fixture.calls,[]);
});
