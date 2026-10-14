import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoice, voiceSupport, clock, MAX_SPEAKING_MS } from '../voice.mjs';

// 가짜 브라우저: 음성 인식기와 녹음기. 실제 마이크·서버 없음.
function fakeWindow({ recognition = true, recorder = true, denyMic = false } = {}) {
  const made = { recognizers: [], recorders: [], streams: 0 };
  class Recognition {
    constructor() { this.started = 0; this.stopped = false; made.recognizers.push(this); }
    start() { this.started++; this.running = true; }
    stop() { this.running = false; queueMicrotask(() => this.onend?.()); }
    abort() { this.running = false; }
    say(text, final = true) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] }); }
    pause() { this.running = false; this.onend?.(); } // 브라우저가 쉬는 틈에 스스로 끝내는 경우
  }
  class MediaRecorder {
    static isTypeSupported(type) { return type === 'audio/webm;codecs=opus'; }
    constructor(stream, options) { this.stream = stream; this.mimeType = options?.mimeType || ''; this.state = 'inactive'; made.recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['소리'], { type: 'audio/webm' }) }); this.onstop?.(); }); }
  }
  const win = {
    ...(recognition ? { SpeechRecognition: Recognition } : {}),
    ...(recorder ? { MediaRecorder } : {}),
    navigator: recorder ? { mediaDevices: { getUserMedia: async () => { if (denyMic) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); made.streams++; return { getTracks: () => [{ stop() { made.stopped = (made.stopped || 0) + 1; } }] }; } } } : {},
  };
  return { win, made };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

test('지원 여부는 인식기와 녹음기를 따로 본다', () => {
  assert.deepEqual(voiceSupport(fakeWindow().win), { recognition: true, recorder: true });
  assert.deepEqual(voiceSupport(fakeWindow({ recognition: false }).win), { recognition: false, recorder: true });
  assert.deepEqual(voiceSupport(fakeWindow({ recorder: false }).win), { recognition: true, recorder: false });
});

test('쉬어도 끊기지 않고, 사람이 멈출 때 받아쓴 글·말한 시간·녹음을 돌려준다', async () => {
  const { win, made } = fakeWindow(), texts = [], states = [];
  const voice = createVoice({ win, onText: t => texts.push(t), onState: s => states.push(s) });
  await voice.start('앞에 적은 글');
  assert.equal(voice.state, 'listening');
  const rec = made.recognizers[0];
  rec.say('지금 표 정리를');
  rec.pause(); // 브라우저가 침묵에서 끝냄 → 다시 켠다
  assert.equal(rec.started, 2, '사람이 멈추기 전에는 다시 듣는다');
  rec.say('부탁드려도 될까요');
  assert.equal(texts.at(-1), '앞에 적은 글 지금 표 정리를 부탁드려도 될까요');
  await tick();
  const result = await voice.stop();
  assert.equal(result.text, '앞에 적은 글 지금 표 정리를 부탁드려도 될까요');
  assert.ok(result.durationMs >= 0);
  assert.equal(result.spoke, true);
  assert.match(result.audioUrl, /^blob:/);
  assert.equal(voice.state, 'idle');
  assert.ok(made.stopped >= 1, '마이크를 놓는다');
  assert.deepEqual(states.slice(0, 2), ['starting', 'listening']);
  assert.equal(states.at(-1), 'idle');
  voice.releaseAudio();
});

test('받아쓰기가 막혀도 녹음은 계속하고 문제를 알린다', async () => {
  const { win, made } = fakeWindow(), issues = [];
  const voice = createVoice({ win, onIssue: message => issues.push(message) });
  await voice.start();
  made.recognizers[0].onerror({ error: 'network' });
  assert.match(issues[0], /받아쓰기 서버/);
  made.recognizers[0].pause();
  assert.equal(made.recognizers[0].started, 1, '고장 난 인식기는 다시 켜지 않는다');
  const result = await voice.stop();
  assert.match(result.audioUrl, /^blob:/);
  voice.releaseAudio();
});

test('마이크가 막히면 인식기만으로 하거나, 둘 다 없으면 시작하지 않는다', async () => {
  const denied = fakeWindow({ denyMic: true }), issues = [];
  const voice = createVoice({ win: denied.win, onIssue: message => issues.push(message) });
  await voice.start();
  assert.match(issues[0], /마이크 사용이 막혀/);
  assert.equal(voice.state, 'listening', '인식기는 따로 마이크를 요청한다');
  voice.dispose();
  const none = createVoice({ win: { navigator: {} }, onIssue: message => issues.push(message) });
  await none.start();
  assert.equal(none.state, 'idle');
  assert.match(issues.at(-1), /마이크 연습을 지원하지 않아요/);
});

test('다른 화면으로 가면 진행 중인 녹음·받아쓰기를 버리고 늦은 결과를 붙이지 않는다', async () => {
  const { win, made } = fakeWindow(), texts = [];
  const voice = createVoice({ win, onText: t => texts.push(t) });
  await voice.start();
  const rec = made.recognizers[0];
  voice.dispose();
  assert.equal(voice.state, 'idle');
  rec.say('늦게 도착한 말');
  assert.equal(texts.length, 0);
  assert.equal(voice.audioUrl, '');
});

test('말한 시간 표기와 한 번에 말할 수 있는 길이', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(65_000), '1:05');
  assert.equal(MAX_SPEAKING_MS, 300_000);
});
