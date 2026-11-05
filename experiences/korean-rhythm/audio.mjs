// 말의 리듬 — 소리. 우리가 만든 노래 녹음과 문제 내레이션을 AudioBuffer로 풀어 한 AudioContext 시계에 미리 예약한다.
// 음악·내레이션·노트가 같은 시계로 함께 멈추고 같은 자리에서 다시 간다. 오실레이터는 시작 카운트와 키 소리에만 쓴다.
// 음원을 못 받으면 다른 음악이나 읽기 문제로 바꾸지 않고 다시 시작하라고 알린다.
const cache = new Map();
const voiceCache = new Map();
const frequency = (m) => 440 * 2 ** ((m - 69) / 12);
// 받는 중에 연결이 끊기면 브라우저 오류는 영어(Failed to fetch · Load failed)다. 화면에 나가는 말은 여기서 정한다. 실패는 캐시에 남지 않아 연결이 돌아오면 다시 시작으로 받는다.
async function download(url, signal, message) {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(message);
    return await response.arrayBuffer();
  } catch (error) {
    if (error?.name === 'AbortError' || signal?.aborted) throw error;
    throw new Error(message);
  }
}

export async function loadRecording(track, context, signal) {
  if (!track.audioUrl) throw new Error('이 곡의 음원 파일을 찾지 못했어요.');
  const key = track.audioUrl + '@' + context.sampleRate;
  if (cache.has(key)) return cache.get(key);
  const bytes = await download(track.audioUrl, signal, '곡을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시작해 주세요.');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const buffer = await context.decodeAudioData(bytes);
  if (!Number.isFinite(buffer.duration) || Math.abs(buffer.duration - track.duration) > 0.15) throw new Error('곡을 제대로 불러오지 못했어요. 새로고침한 뒤 다시 시작해 주세요.');
  cache.clear(); cache.set(key, buffer);
  return buffer;
}

export async function loadNarration(voice, context, signal) {
  if (!voice?.url || !(voice.duration > 0)) throw new Error('이 문장의 소리 파일을 찾지 못했어요. 새로고침해 주세요.');
  const key = voice.url + '@' + context.sampleRate;
  if (voiceCache.has(key)) return voiceCache.get(key);
  const buffer = await context.decodeAudioData(await download(voice.url, signal, '문장 소리를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시작해 주세요.'));
  if (Math.abs(buffer.duration - voice.duration) > 0.15) throw new Error('문장 소리를 제대로 불러오지 못했어요. 새로고침해 주세요.');
  voiceCache.set(key, buffer);
  return buffer;
}

export class MusicPlayer {
  constructor({ onDelivery = () => {} } = {}) {
    this.onDelivery = onDelivery;
    this.context = null; this.source = null; this.buffer = null; this.origin = 0; this.abort = null;
    this.master = null; this.musicGain = null; this.voiceGain = null; this.analyser = null; this.voiceAnalyser = null;
    this.voiceSources = []; this.voices = []; this.scheduledVoices = [];
    this.enabled = true; this.recording = null;
    // WORLD 캠퍼스 판(world-play.mjs)이 거는 고리: countSound(시각, 차례) 네 박 소리 · voiceCue(음성 시작 시각) 문장 안내음 예약 · cueReset() 건너뛸 때 예약 지우기,
    // duckLead = 음성 몇 초 전부터 음악을 낮출지(LAB 0.12 — 캠퍼스 판은 안내음이 낮아진 음악 위에서 나게 0.5).
    this.countSound = null; this.voiceCue = null; this.cueReset = null; this.duckLead = 0.12;
    // 같은 판의 고리 셋: keepContext = 곡을 멈춰도 문맥을 닫지 않고 재웠다가 다음 곡 · 다시 듣기에 쓴다(새로 만들면 윈도우 장치 묻기로 손짓 직후 0.5초쯤 멈춘다),
    // onPark() = 재울 때 곡 밖의 소리 길 끊기, recordingSource(track, context, signal) = 곡 버퍼를 대신 구하기. 안 걸면 LAB 그대로.
    this.keepContext = false; this.spare = null; this.onPark = null; this.recordingSource = null;
    this.session = 0; this.reviewCancel = null; this.reopened = null; this.wakeLimit = 4000;
  }

  /** 소리 문맥 하나. 재워 둔 문맥이 있으면 그것을 — 아이폰이 끼어들어 interrupted가 된 문맥은 resume이 풀리지 않을 수 있어 버린다. */
  openContext(options) {
    const spare = this.spare;
    this.spare = null;
    if (spare?.state === 'suspended' || spare?.state === 'running') {
      this.reopened = spare;
      this.origin = spare.currentTime + 1e6;   // 시작 전까지 시계가 앞 판의 자리를 가리키지 않게(받는 동안 누른 키가 그 자리의 노트로 판정되지 않게 — 새 문맥과 같이 음수)
      return spare;
    }
    if (spare && spare.state !== 'closed') spare.close().catch(() => {});
    return new AudioContext(options);
  }

  /** 문맥을 깨운다. 다시 쓴 문맥이 깨어나지 않으면(거부 · 풀리지 않음) 버리고 실패로 돌린다 — 재워 두면 누를 때마다 같은 실패를 되풀이하고, 풀리지 않으면 시작 단추가 막힌다. 다음 누름은 새 문맥이다.
   *  새 문맥은 전처럼 그냥 기다린다(블루투스 · 소리 장치가 깨는 데 오래 걸려도 건강한 문맥을 버리지 않게). */
  async wake(context, session) {
    if (this.reopened !== context) return context.resume();
    let timer;
    try {
      await Promise.race([context.resume(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('소리를 켜지 못했어요. 다시 눌러 주세요.')), this.wakeLimit); })]);
      if (context.state !== 'running' && context.state !== 'closed') throw new Error('소리를 켜지 못했어요. 다시 눌러 주세요.');
    } catch (error) {
      if (this.spare === context) this.dropSpare();
      else if (this.session === session) { this.context = null; context.close().catch(() => {}); }
      throw error;
    } finally { clearTimeout(timer); }
  }

  /** 화면을 떠날 때: 재워 둔 문맥을 놓는다. */
  dropSpare() {
    const spare = this.spare;
    this.spare = null;
    if (spare && spare.state !== 'closed') spare.close().catch(() => {});
  }

  async prepare(track, questions = []) {
    this.stop();
    const session = this.session, abort = new AbortController();
    const context = this.openContext({ latencyHint: 'interactive' });   // 누른 순간에 만든다(자동 재생 규칙)
    this.context = context; this.abort = abort;
    await this.wake(context, session);
    if (this.session !== session) throw new DOMException('Cancelled', 'AbortError');
    this.master = context.createGain(); this.master.gain.value = 0.7;
    this.musicGain = context.createGain(); this.musicGain.gain.value = this.enabled ? 1 : 0; this.musicGain.connect(this.master);
    this.voiceGain = context.createGain(); this.voiceGain.gain.value = 1.25;
    this.voiceAnalyser = context.createAnalyser(); this.voiceAnalyser.fftSize = 2048;
    this.voiceGain.connect(this.voiceAnalyser); this.voiceAnalyser.connect(this.master);
    this.analyser = context.createAnalyser(); this.analyser.fftSize = 2048;
    this.master.connect(this.analyser); this.analyser.connect(context.destination);
    const buffer = await (this.recordingSource || loadRecording)(track, context, abort.signal);
    const voices = await Promise.all(questions.map(async (q) => ({ q, buffer: await loadNarration(q.voice, context, abort.signal) })));
    if (this.session !== session || context.state === 'closed') throw new DOMException('Cancelled', 'AbortError');   // 문맥을 다시 쓰면 문맥만으로는 앞 요청을 가려내지 못한다
    this.voices = voices;
    this.recording = { title: track.title, sourceId: track.sourceId, url: track.audioUrl, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels };
    return buffer;
  }

  /** 네 박자 카운트 뒤 곡을 시작한다. */
  start(buffer, beat) {
    this.buffer = buffer;
    this.origin = this.context.currentTime + 4 * beat + 0.12;
    this.schedule(0);
    for (let i = 0; i < 4; i += 1) { const at = this.origin - (4 - i) * beat; if (this.countSound) this.countSound(at, i); else this.note(76, at, 0.13, 0.045); }
  }

  /** 곡의 from초부터 음악을 틀고, 아직 시작하지 않은 내레이션을 예약한다. 내레이션 동안 음악은 6%로 낮췄다가 되돌린다. */
  schedule(from) {
    const context = this.context, source = context.createBufferSource();
    source.buffer = this.buffer; source.loop = false; source.connect(this.musicGain);
    if (from > 0) source.start(this.origin + from, from); else source.start(this.origin);
    this.source = source;
    for (const { q, buffer: voiceBuffer } of this.voices) {
      if (q.showTime < from) continue;
      const start = this.origin + q.showTime, end = start + voiceBuffer.duration, voice = context.createBufferSource();
      voice.onended = () => { if (this.context === context && context.state !== 'closed' && context.currentTime >= end - 0.03) this.onDelivery(q, { audio: 'completed' }); };
      voice.buffer = voiceBuffer; voice.connect(this.voiceGain); voice.start(start);
      this.voiceSources.push(voice);
      this.scheduledVoices.push({ id: q.id, url: q.voice.url, start: q.showTime, end: q.showTime + voiceBuffer.duration });
      const gain = this.musicGain.gain, level = this.enabled ? 1 : 0;
      gain.setValueAtTime(level, start - this.duckLead); gain.linearRampToValueAtTime(level * 0.06, start);
      this.voiceCue?.(start);
      gain.setValueAtTime(level * 0.06, end + 0.15); gain.linearRampToValueAtTime(level, end + 0.7);
    }
  }

  /** 확인용(?qa): 곡의 t초로 건너뛴다. 아직 시작하지 않은 문장만 다시 예약한다(시작한 문장은 끝까지 들은 것으로 치지 않는다). */
  seek(t) {
    const context = this.context;
    if (!context || context.state === 'closed' || !this.buffer) return false;
    for (const s of this.voiceSources) { s.onended = null; try { s.stop(); } catch { /* 이미 멈춤 */ } s.disconnect(); }
    this.voiceSources = []; this.scheduledVoices = [];
    if (this.source) { try { this.source.stop(); } catch { /* 이미 멈춤 */ } this.source.disconnect(); this.source = null; }
    const now = context.currentTime, gain = this.musicGain.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(this.enabled ? 1 : 0, now);
    this.origin = now + 0.05 - Math.max(0, t);
    this.cueReset?.();
    this.schedule(Math.max(0, t));
    return true;
  }

  get time() { return this.context ? this.context.currentTime - this.origin : 0; }
  get state() { return this.context?.state || 'closed'; }
  get signalLevel() { return rms(this.analyser); }
  get voiceLevel() { return rms(this.voiceAnalyser); }
  get activeVoice() { return this.scheduledVoices.find((v) => this.time >= v.start && this.time < v.end) || null; }

  async pause() { if (this.context?.state === 'running') await this.context.suspend(); }
  async resume() { if (this.context?.state === 'suspended') await this.context.resume(); }

  /** 배경 음악만 켜고 끈다(내레이션은 늘 들린다). 예약된 낮춤도 새 크기로 다시 건다. */
  setSound(enabled) {
    this.enabled = enabled;
    if (!this.musicGain || !this.context || this.context.state === 'closed') return;
    const now = this.context.currentTime, gain = this.musicGain.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(enabled ? (this.activeVoice ? 0.06 : 1) : 0, now, 0.02);
    for (const v of this.scheduledVoices) {
      const start = this.origin + v.start, end = this.origin + v.end;
      if (end <= now) continue;
      if (start > now) { gain.setValueAtTime(enabled ? 1 : 0, start - this.duckLead); gain.linearRampToValueAtTime(enabled ? 0.06 : 0, start); }
      gain.setValueAtTime(enabled ? 0.06 : 0, end + 0.15); gain.linearRampToValueAtTime(enabled ? 1 : 0, end + 0.7);
    }
  }

  note(midi, time = this.context?.currentTime, len = 0.16, gain = 0.035) {
    if (!this.context || this.context.state === 'closed') return;
    const o = this.context.createOscillator(), g = this.context.createGain();
    o.type = 'sine'; o.frequency.value = frequency(midi);
    g.gain.setValueAtTime(gain, time); g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    o.connect(g); g.connect(this.musicGain);
    o.start(time); o.stop(time + len + 0.01);
  }
  hit(lane) { this.note([72, 76, 79, 81][lane]); }

  /** 결과 화면에서 문장 하나를 다시 튼다(곡의 시계와 따로). 끝나면(또는 다른 소리로 끊기면) 풀린다. */
  async review(voice) {
    this.stop();
    const session = this.session, context = this.openContext();
    this.context = context;
    await this.wake(context, session);
    if (this.session !== session) throw new DOMException('Cancelled', 'AbortError');
    const buffer = await loadNarration(voice, context);
    if (this.session !== session) throw new DOMException('Cancelled', 'AbortError');
    this.source = context.createBufferSource(); this.source.buffer = buffer; this.source.connect(context.destination); this.source.start();
    return new Promise((resolve, reject) => {
      this.reviewCancel = reject;
      this.source.onended = () => { resolve(); if (this.keepContext && this.session === session) this.stop(); };   // 다 들었으면 재운다(풀린 뒤라 끊긴 것으로 치지 않는다)
    });
  }

  /** keepContext: 문맥을 닫지 않고 재운다. 곡 밖으로 나가는 길을 끊어 예약해 둔 소리가 다음 곡에서 깨어나지 않게 하고, 재우면 ended가 안 올 수 있어 다시 듣기는 끊긴 것으로 푼다. */
  park() {
    this.analyser?.disconnect();
    this.onPark?.();
    this.reviewCancel?.(new DOMException('Cancelled', 'AbortError'));
    this.spare = this.context;
    this.spare.suspend().catch(() => {});
  }

  stop() {
    this.session += 1;
    this.abort?.abort(); this.abort = null;
    for (const source of this.voiceSources) { source.onended = null; try { source.stop(); } catch { /* 이미 멈춤 */ } source.disconnect(); }
    this.voiceSources = []; this.voices = []; this.scheduledVoices = [];
    if (this.source) { try { this.source.stop(); } catch { /* 이미 멈춤 */ } this.source.disconnect(); this.source = null; }
    if (this.context && this.context.state !== 'closed') { if (this.keepContext) this.park(); else this.context.close().catch(() => {}); }
    this.reviewCancel = null;
    this.context = null; this.master = null; this.musicGain = null; this.voiceGain = null; this.voiceAnalyser = null; this.analyser = null;
    this.recording = null; this.buffer = null;
  }
}

function rms(analyser) {
  if (!analyser) return 0;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  return Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
}
