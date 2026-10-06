// 주문 폭주 — 소리. 손님 주문은 audio/<주문>.wav(합성 음성 15개), 효과음은 Web Audio로 짧게 만든다.
// 상태 알림(onState): 'playing'(듣는 중) → 'ready'(끝까지 들음) 또는 'error'(재생 실패). 학습 기록은 이 알림으로 app.mjs가 남긴다.
// 소리 끄기는 이 브라우저에 남는다. 소리를 끄면 주문 음성도 효과음도 내지 않는다(그때 주문은 글로 보여 준다 — app.mjs).
// 끝 신호 지킴: 주문 길이 + VOICE_GUARD초가 지나도 끝 신호가 없으면 스스로 넘긴다 — 재생 위치가 끝까지 갔으면 들은 것(신호만 늦음),
// 아니면 재생 실패. 소리 장치가 멈추면 ‘듣는 중’에 갇혀 영업 시간이 계속 멈춰 있었다(10-06 확인 중 발견, 말 랠리 audio.mjs와 같은 방식).
const SOUND_KEY = 'synk.order-rush.sound';
export const VOICE_GUARD = 1.5;

// 효과음: [주파수(Hz), 시작(초)] 목록과 소리 크기. 틀린 서빙에는 실패음 대신 ‘다시 볼까요?’처럼 올라가는 두 음.
const TONES = {
  tap: { notes: [[440, 0]], gain: 0.03 },
  serve: { notes: [[523.25, 0], [659.25, 0.085], [783.99, 0.17]], gain: 0.035 },
  wrong: { notes: [[329.63, 0], [392, 0.11]], gain: 0.026 },
  arrive: { notes: [[587.33, 0], [783.99, 0.07]], gain: 0.02 },
  star: { notes: [[880, 0]], gain: 0.03 },
  done: { notes: [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.3]], gain: 0.032 },
};

export class CafeAudio {
  constructor(onState) {
    this.onState = onState;
    this.element = new Audio();
    this.element.preload = 'auto';
    this.busy = false;
    this.token = 0;
    this.context = null;
    this.wasPlaying = false;
    this.guard = 0;
    this.order = null;
    this.held = false;   // 멈춤 창으로 잠깐 세운 재생(이어 하면 다시 튼다)
    let on = true;
    try { on = localStorage.getItem(SOUND_KEY) !== 'off'; } catch { /* 저장할 수 없으면 켠 채로 */ }
    this.on = on;
  }

  isOn() { return this.on; }
  setOn(on) {
    this.on = !!on;
    try { localStorage.setItem(SOUND_KEY, this.on ? 'on' : 'off'); } catch { /* 이번 페이지에서만 */ }
    if (!this.on) this.stop();
  }

  unlock() {
    if (!this.context) { const C = window.AudioContext || window.webkitAudioContext; if (C) this.context = new C(); }
    this.context?.resume().catch(() => {});
  }

  async play(order) {
    this.stop();
    const token = ++this.token;
    this.busy = true;
    this.order = order;
    this.onState('playing', order);
    this.element.src = `audio/${order.id}.wav`;
    const fail = () => { if (token !== this.token) return; clearTimeout(this.guard); this.busy = false; this.onState('error', order); };
    this.element.onended = () => { if (token !== this.token) return; clearTimeout(this.guard); this.busy = false; this.onState('ready', order); };
    this.element.onerror = fail;
    // 재생이 막 시작될 때 멈춤 창을 열면 브라우저가 play()를 AbortError로 끊는다: 실패가 아니라 세운 것(이어 하면 다시 튼다)
    try { await this.element.play(); } catch (e) { if (this.held && e?.name === 'AbortError') return; fail(); return; }
    this.arm(token);
  }

  /** 끝 신호 지킴을 남은 길이만큼 건다(멈췄다 이어 하면 다시 건다). */
  arm(token) {
    clearTimeout(this.guard);
    if (token !== this.token || !this.busy) return;
    const el = this.element, order = this.order;
    const left = Number.isFinite(el.duration) ? Math.max(0, el.duration - el.currentTime) : 8;
    this.guard = setTimeout(() => {
      if (token !== this.token || !this.busy) return;
      const played = Number.isFinite(el.duration) && el.currentTime >= el.duration - 0.05;
      this.token++;
      el.pause();
      this.busy = false;
      this.onState(played ? 'ready' : 'error', order);
    }, (left + VOICE_GUARD) * 1000);
  }

  stop() {
    this.token++;
    this.held = false;
    clearTimeout(this.guard);
    this.element.pause();
    this.element.onended = null;
    this.element.onerror = null;
    this.busy = false;
    this.wasPlaying = false;
  }

  pause() { clearTimeout(this.guard); this.wasPlaying = this.busy; this.held = this.busy; this.element.pause(); this.busy = false; }

  async resume() {
    const again = this.wasPlaying, token = this.token;
    this.wasPlaying = false;
    this.held = false;
    if (!again || this.element.ended || !this.element.src) return;
    this.busy = true;
    try { await this.element.play(); } catch { if (token !== this.token) return; this.busy = false; this.onState('error', this.order); return; }
    this.arm(token);
  }

  tone(kind) {
    const t = TONES[kind];
    if (!t || !this.on || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    for (const [freq, at] of t.notes) {
      const osc = this.context.createOscillator(), gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(t.gain, now + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + at + 0.16);
      osc.connect(gain).connect(this.context.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.18);
    }
  }
}
