/** Same-origin, single-worker adapter for the interview's local speech model. */
export const WHISPER_WORKER_URL = new URL('./whisper-worker.mjs', import.meta.url).href;

export class WhisperModel {
  constructor({ Worker = globalThis.Worker, workerUrl = WHISPER_WORKER_URL,
    inferenceTimeoutMs = 45_000, timers = globalThis } = {}) {
    const target = new URL(workerUrl, import.meta.url);
    if (target.origin !== new URL(import.meta.url).origin) throw new Error('Speech worker must be same-origin');
    this.ready = false;
    this.disposed = false;
    this.failed = false;
    this.events = new Map();
    this.recognizers = new Map();
    this.nextId = 0;
    this.timers = timers;
    this.watchdog = null;
    this.worker = new Worker(target.href, { type: 'module', name: 'synk-local-whisper' });
    const model = this;
    this.KaldiRecognizer = class {
      constructor(sampleRate) {
        if (!model.ready || model.disposed) throw new Error('Speech model is not ready');
        if (!Number.isFinite(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000) throw new Error('Unsupported microphone sample rate');
        this.id = `whisper-${++model.nextId}`;
        this.events = new Map();
        this.removed = false;
        model.recognizers.set(this.id, this);
        model.worker.postMessage({ action: 'create', recognizerId: this.id, sampleRate });
      }
      on(name, callback) {
        const listeners = this.events.get(name) || new Set();
        listeners.add(callback); this.events.set(name, listeners);
        return () => listeners.delete(callback);
      }
      setWords() { /* Word decoder scores are always returned; never accuracy probabilities. */ }
      retrieveFinalResult() {
        if (!this.removed && !model.disposed) model.worker.postMessage({ action: 'retrieveFinalResult', recognizerId: this.id });
      }
      remove() {
        if (this.removed) return;
        this.removed = true; this.events.clear(); model.recognizers.delete(this.id);
        if (!model.disposed) model.worker.postMessage({ action: 'remove', recognizerId: this.id });
      }
    };
    this.worker.onmessage = ({ data }) => {
      if (this.disposed || this.failed) return;
      if (data.event === 'inference-start') {
        this.clearWatchdog();
        this.watchdog = timers.setTimeout(() => this.fail(new Error('Speech inference timeout')), inferenceTimeoutMs);
      } else if (data.event === 'inference-end') this.clearWatchdog();
      else if (data.event === 'load') {
        this.ready = Boolean(data.result); this.emit('load', data);
      } else if (data.event === 'error' && !data.recognizerId) this.fail(new Error(data.error || 'Speech worker failed'));
      else if (data.recognizerId) {
        const recognizer = this.recognizers.get(data.recognizerId);
        if (recognizer && !recognizer.removed) for (const callback of recognizer.events.get(data.event) || []) callback(data);
      } else this.emit(data.event, data);
    };
    this.worker.onerror = (event) => this.fail(new Error(event.message || 'Speech worker failed'));
    this.worker.onmessageerror = () => this.fail(new Error('Speech worker message failed'));
    this.worker.postMessage({ action: 'load' });
  }
  on(name, callback) {
    const listeners = this.events.get(name) || new Set();
    listeners.add(callback); this.events.set(name, listeners);
    return () => listeners.delete(callback);
  }
  emit(name, event) { for (const callback of this.events.get(name) || []) callback(event); }
  clearWatchdog() { if (this.watchdog !== null) this.timers.clearTimeout(this.watchdog); this.watchdog = null; }
  fail(error) {
    if (this.disposed || this.failed) return;
    this.failed = true; this.ready = false; this.clearWatchdog();
    this.worker.terminate();
    // The voice owner closes the microphone and disposes the failed adapter.
    this.emit('error', { event: 'error', error: error.message });
  }
  connectAudioPort(port) {
    if (this.disposed || !this.ready) { port.close?.(); throw new Error('Speech model is not ready'); }
    this.worker.postMessage({ action: 'connectAudioPort', port }, [port]);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.ready = false; this.clearWatchdog();
    for (const recognizer of this.recognizers.values()) { recognizer.removed = true; recognizer.events.clear(); }
    this.recognizers.clear(); this.events.clear(); this.worker.terminate();
  }
}

export function createWhisperModel(options) { return new WhisperModel(options); }
