// 말의 리듬 — 소리. 우리가 만든 노래 녹음과 문제 내레이션을 AudioBuffer로 풀어 한 AudioContext 시계에 미리 예약한다.
// 음악·내레이션·노트가 같은 시계로 함께 멈추고 같은 자리에서 다시 간다. 오실레이터는 시작 카운트와 키 소리에만 쓴다.
// 음원을 못 받으면 다른 음악이나 읽기 문제로 바꾸지 않고 다시 시작하라고 알린다.
const cache = new Map();
const voiceCache = new Map();
const frequency = (m) => 440 * 2 ** ((m - 69) / 12);

export async function loadRecording(track, context, signal) {
  if (!track.audioUrl) throw new Error('이 곡의 음원 파일을 찾지 못했어요.');
  const key = track.audioUrl + '@' + context.sampleRate;
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(track.audioUrl, { signal });
  if (!response.ok) throw new Error('곡을 불러오지 못했어요. 연결을 확인하고 다시 시작해 주세요.');
  const bytes = await response.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const buffer = await context.decodeAudioData(bytes);
  if (!Number.isFinite(buffer.duration) || Math.abs(buffer.duration - track.duration) > 0.15) throw new Error('음원과 노트의 길이가 달라요. 새로고침한 뒤 다시 시작해 주세요.');
  cache.clear(); cache.set(key, buffer);
  return buffer;
}

export async function loadNarration(voice, context, signal) {
  if (!voice?.url || !(voice.duration > 0)) throw new Error('이 문항의 나레이션을 찾지 못했어요.');
  const key = voice.url + '@' + context.sampleRate;
  if (voiceCache.has(key)) return voiceCache.get(key);
  const response = await fetch(voice.url, { signal });
  if (!response.ok) throw new Error('나레이션을 불러오지 못했어요. 다시 시작해 주세요.');
  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  if (Math.abs(buffer.duration - voice.duration) > 0.15) throw new Error('나레이션의 길이가 달라요. 새로고침해 주세요.');
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
  }

  async prepare(track, questions = []) {
    this.stop();
    const context = new AudioContext({ latencyHint: 'interactive' });   // 누른 순간에 만든다(자동 재생 규칙)
    this.context = context; this.abort = new AbortController();
    await context.resume();
    this.master = context.createGain(); this.master.gain.value = 0.7;
    this.musicGain = context.createGain(); this.musicGain.gain.value = this.enabled ? 1 : 0; this.musicGain.connect(this.master);
    this.voiceGain = context.createGain(); this.voiceGain.gain.value = 1.25;
    this.voiceAnalyser = context.createAnalyser(); this.voiceAnalyser.fftSize = 2048;
    this.voiceGain.connect(this.voiceAnalyser); this.voiceAnalyser.connect(this.master);
    this.analyser = context.createAnalyser(); this.analyser.fftSize = 2048;
    this.master.connect(this.analyser); this.analyser.connect(context.destination);
    const buffer = await loadRecording(track, context, this.abort.signal);
    this.voices = await Promise.all(questions.map(async (q) => ({ q, buffer: await loadNarration(q.voice, context, this.abort.signal) })));
    if (this.context !== context || context.state === 'closed') throw new DOMException('Cancelled', 'AbortError');
    this.recording = { title: track.title, sourceId: track.sourceId, url: track.audioUrl, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels };
    return buffer;
  }

  /** 네 박자 카운트 뒤 곡을 시작한다. */
  start(buffer, beat) {
    this.buffer = buffer;
    this.origin = this.context.currentTime + 4 * beat + 0.12;
    this.schedule(0);
    for (let i = 0; i < 4; i += 1) this.note(76, this.origin - (4 - i) * beat, 0.13, 0.045);
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
      gain.setValueAtTime(level, start - 0.12); gain.linearRampToValueAtTime(level * 0.06, start);
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
      if (start > now) { gain.setValueAtTime(enabled ? 1 : 0, start - 0.12); gain.linearRampToValueAtTime(enabled ? 0.06 : 0, start); }
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
    const context = new AudioContext();
    this.context = context;
    await context.resume();
    const buffer = await loadNarration(voice, context);
    if (this.context !== context) throw new DOMException('Cancelled', 'AbortError');
    this.source = context.createBufferSource(); this.source.buffer = buffer; this.source.connect(context.destination); this.source.start();
    return new Promise((resolve) => { this.source.onended = resolve; });
  }

  stop() {
    this.abort?.abort(); this.abort = null;
    for (const source of this.voiceSources) { try { source.stop(); } catch { /* 이미 멈춤 */ } source.disconnect(); }
    this.voiceSources = []; this.voices = []; this.scheduledVoices = [];
    if (this.source) { try { this.source.stop(); } catch { /* 이미 멈춤 */ } this.source.disconnect(); this.source = null; }
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
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
