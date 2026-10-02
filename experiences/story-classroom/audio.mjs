/**
 * StoryAudio — local, nonverbal sound for a reading game.
 *
 * const audio = new StoryAudio();
 * await audio.start();             // call directly inside a user click
 * audio.play('pickup');
 * const enabled = audio.toggle();  // synchronous user preference
 * audio.suspend();                 // retains enabled preference
 * await audio.start();             // resume one loop, if enabled
 * audio.destroy();                 // permanent cleanup
 *
 * Dialogue recordings are played by StoryVoice. UI sounds are unmodified copies of the
 * approved SYNK kit. The sparse original background score is synthesized here,
 * never fetched from a service. Missing Web Audio remains silent and playable.
 */

const EFFECT_FILES = Object.freeze({
  // Reading another dialogue bubble is quiet. Avoid a repeated notification
  // melody competing with the story on every page turn.
  select: 'sound-earn.wav',
  pickup: 'sound-earn.wav',
  place: 'sound-earn.wav',
  success: 'sound-achieve.wav',
  // A soft existing notice invites another look; no failure buzzer is created.
  mistake: 'sound-notify.wav',
  door: 'sound-notify.wav',
  reveal: 'sound-achieve.wav',
});

// The sparse score initially rendered near -43 dBFS peak. A fixed 13.6 dB
// music trim brings stereo peaks to -29 dBFS, preserving approved UI gain.
const MUSIC_TRIM = 10 ** (13.6 / 20);

// C major pentatonic; midi 48/55 are bass C/G. Resting beats are intentional:
// dialogue gets room to breathe rather than a constant stream of UI-like notes.
// Each tuple is [beat within bar, midi note, decay seconds, gain, stereo pan].
const SCORE = Object.freeze([
  [[0,48,.34,.09,-.1], [1,64,.29,.10,.18], [2.5,67,.25,.075,.1]],
  [[0,55,.34,.07,-.12], [1.5,62,.30,.08,-.15]],
  [[0,48,.34,.08,-.1], [1,60,.28,.08,.12], [2.5,64,.30,.08,.2]],
  [[0,55,.34,.065,-.1], [2,62,.30,.07,-.12]],
  [[0,48,.34,.08,-.12], [1,67,.24,.07,.14], [2,64,.29,.075,.2]],
  [[0,55,.34,.065,-.1], [1.5,69,.24,.06,.08], [2.5,67,.26,.065,-.1]],
  [[0,48,.34,.08,-.1], [1,64,.28,.085,.15], [2.5,62,.30,.075,-.15]],
  [[0,55,.34,.07,-.1], [1,60,.32,.08,.12]],
  [[0,48,.34,.08,-.1], [1.5,64,.29,.075,.18], [3,67,.25,.065,.1]],
  [[0,55,.34,.065,-.12], [2,62,.30,.075,-.15]],
  [[0,48,.34,.08,-.1], [1.5,60,.28,.08,.12], [2.5,64,.30,.075,.2]],
  [[0,55,.34,.06,-.1]],
  [[0,48,.34,.08,-.12], [1,67,.24,.065,.14], [3,64,.29,.075,.2]],
  [[0,55,.34,.065,-.1], [1.5,69,.24,.06,.08], [2.5,67,.26,.065,-.1]],
  [[0,48,.34,.075,-.1], [1,64,.28,.08,.15], [2.5,62,.30,.07,-.15]],
  [[0,48,.34,.07,-.1], [1,60,.32,.08,.12], [1,64,.32,.04,-.08]],
]);

export class StoryAudio {
  constructor({ enabled = true, volume = .42, musicVolume = .23 } = {}) {
    this.enabled = !!enabled;
    this.started = false;
    this.destroyed = false;
    this.volume = Math.max(0, Math.min(1, volume));
    this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    this.context = null;
    this._generation = 0;
    this._timer = null;
    this._buffers = new Map();
    this._nodes = new Set();
    this._extras = new Map();
    this._lastPlayed = new Map();
    this._loadPromise = null;
    this._bar = 0;
    this._nextBar = 0;
    this._beatSeconds = 60 / 72;
    this._visibility = () => {
      if (globalThis.document?.hidden) this.suspend();
      else if (this.started && this.enabled) void this.start();
    };
    globalThis.document?.addEventListener('visibilitychange', this._visibility);
  }

  /** Unlock or resume from a user click. Returns whether sound is running. */
  async start() {
    if (this.destroyed || !this.enabled || globalThis.document?.hidden) return false;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return false;
    const generation = ++this._generation;
    try {
      if (!this.context) {
        this.context = new Context();
        this._master = this.context.createGain();
        this._master.gain.value = this.volume;
        this._master.connect(this.context.destination);
        this._music = this.context.createGain();
        this._music.gain.value = this.musicVolume * MUSIC_TRIM;
        this._music.connect(this._master);
      }
      // Resume before awaiting any network work so the gesture is still active.
      await this.context.resume();
      if (generation !== this._generation || this.destroyed || !this.enabled) return false;
      this.started = true;
      this._startMusic();
      // A caller that awaits start() can immediately play the first scene cue.
      // Failed local fetches settle silently; sound never makes the game fail.
      await this._loadEffects();
      return generation === this._generation && !this.destroyed && this.enabled && this.context.state === 'running';
    } catch {
      return false;
    }
  }

  /** Update the user's sound preference immediately; unlock in this click. */
  toggle() {
    if (this.destroyed) return false;
    this.enabled = !this.enabled;
    if (this.enabled) void this.start();
    else this.suspend();
    return this.enabled;
  }

  /** Play one approved, nonverbal UI event. Unknown names are silent. */
  play(name) {
    const ctx = this.context;
    const file = EFFECT_FILES[name];
    if (this.destroyed || !this.enabled || !file || !ctx || ctx.state !== 'running') return false;
    const buffer = this._buffers.get(file);
    if (!buffer) return false;
    const now = ctx.currentTime;
    if (now - (this._lastPlayed.get(name) ?? -Infinity) < .09) return false;
    this._lastPlayed.set(name, now);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this._master);
    this._retain(source);
    source.start(now);
    return true;
  }

  /** Keep the quiet score behind dialogue without changing the sound choice. */
  duckVoice(active) {
    if (!this.context || !this._music) return;
    this._music.gain.cancelScheduledValues(this.context.currentTime);
    this._music.gain.setTargetAtTime(this.musicVolume * MUSIC_TRIM * (active ? .2 : 1), this.context.currentTime, .08);
  }

  /** Stop scheduling and every current/future voice, retaining sound choice. */
  suspend() {
    ++this._generation;
    if (this._timer !== null) globalThis.clearInterval(this._timer);
    this._timer = null;
    for (const node of this._nodes) {
      try { node.stop(); } catch { /* an ended node needs only disconnection */ }
      try { node.disconnect(); } catch { /* cleanup is idempotent */ }
      for (const extra of this._extras.get(node) || []) {
        try { extra.disconnect(); } catch { /* cleanup is idempotent */ }
      }
    }
    this._nodes.clear();
    this._extras.clear();
    if (this.context && this.context.state !== 'closed') void this.context.suspend().catch(() => {});
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.enabled = false;
    this.suspend();
    globalThis.document?.removeEventListener('visibilitychange', this._visibility);
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this._buffers.clear();
  }

  async _loadEffects() {
    if (this._loadPromise) return this._loadPromise;
    const ctx = this.context;
    this._loadPromise = Promise.allSettled([...new Set(Object.values(EFFECT_FILES))].map(async (file) => {
      const response = await fetch(new URL(`./assets/${file}`, import.meta.url));
      if (!response.ok) throw new Error(`Missing local sound: ${file}`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (!this.destroyed) this._buffers.set(file, buffer);
    }));
    return this._loadPromise;
  }

  _retain(node, extras = []) {
    this._nodes.add(node);
    this._extras.set(node, extras);
    node.onended = () => {
      this._nodes.delete(node);
      this._extras.delete(node);
      try { node.disconnect(); } catch { /* already stopped */ }
      for (const extra of extras) { try { extra.disconnect(); } catch { /* already stopped */ } }
    };
  }

  _startMusic() {
    if (this._timer !== null || this.destroyed || !this.enabled) return;
    this._nextBar = this.context.currentTime + .12;
    const schedule = () => {
      const ctx = this.context;
      if (!this.enabled || this.destroyed || ctx.state !== 'running') return;
      // Only one bar is scheduled ahead; no long queue survives a tab pause.
      while (this._nextBar < ctx.currentTime + .35) {
        for (const [beat, midi, duration, gain, pan] of SCORE[this._bar % SCORE.length]) {
          this._pluck(midi, this._nextBar + beat * this._beatSeconds, duration, gain, pan);
        }
        this._bar = (this._bar + 1) % SCORE.length;
        this._nextBar += this._beatSeconds * 4;
      }
    };
    schedule();
    this._timer = globalThis.setInterval(schedule, 150);
  }

  _pluck(midi, time, duration, gain, pan) {
    const ctx = this.context;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const envelope = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner?.();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = .4;
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.linearRampToValueAtTime(gain, time + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    envelope.connect(filter);
    if (panner) {
      panner.pan.value = pan;
      filter.connect(panner);
      panner.connect(this._music);
    } else filter.connect(this._music);
    const oscillator = ctx.createOscillator();
    oscillator.type = midi < 60 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.connect(envelope);
    this._retain(oscillator, [envelope, filter, ...(panner ? [panner] : [])]);
    oscillator.start(time);
    oscillator.stop(time + duration + .02);
  }
}
