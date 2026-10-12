/** Local Korean Whisper inference. No audio requests, remote models or WebGPU. */
export const OUTPUT_RATE = 16_000;
export const MAX_AUDIO_SECONDS = 30;
export const PARTIAL_INTERVAL_SECONDS = 8;
const MAX_GENERATED_TOKENS = 384;
const ENGINE = 'whisper-base';

/** Streaming resampling with a low-pass FIR when reducing the sample rate.
 * The worklet sends signed-16-bit-range floats, not normalized float PCM.
 * Storage is always bounded to 30 seconds at 16 kHz (1.92 MB). */
export function createPcmBuffer(sampleRate, { maxSeconds = MAX_AUDIO_SECONDS } = {}) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000) throw new Error('Unsupported microphone sample rate');
  const output = new Float32Array(Math.ceil(OUTPUT_RATE * maxSeconds));
  const taps = sampleRate > OUTPUT_RATE ? 63 : 1;
  const coefficients = new Float64Array(taps);
  const history = new Float32Array(taps);
  const cutoff = Math.min(1, OUTPUT_RATE / sampleRate) * .45;
  let sum = 0;
  for (let index = 0; index < taps; index += 1) {
    const x = index - (taps - 1) / 2;
    const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
    const window = taps === 1 ? 1 : .42 - .5 * Math.cos(2 * Math.PI * index / (taps - 1)) + .08 * Math.cos(4 * Math.PI * index / (taps - 1));
    coefficients[index] = taps === 1 ? 1 : sinc * window; sum += coefficients[index];
  }
  for (let index = 0; index < taps; index += 1) coefficients[index] /= sum;
  let size = 0, sourceIndex = 0, cursor = 0, previous = 0, nextOutput = 0;
  let frameSamples = 0, frameEnergy = 0, frameSum = 0, framePeak = 0, voicedSamples = 0;
  let firstVoice = -1, lastVoice = 0, flushed = false, truncated = false;
  function emit(value) {
    if (size >= output.length) { if (value !== 0) truncated = true; return; }
    output[size++] = value;
    frameEnergy += value * value; frameSum += value; framePeak = Math.max(framePeak, Math.abs(value)); frameSamples += 1;
    if (frameSamples >= 320) {
      // An energy gate rejects silence; it is not a learned speech/noise classifier.
      if (Math.sqrt(Math.max(0, frameEnergy / frameSamples - (frameSum / frameSamples) ** 2)) >= .004 && framePeak >= .015) {
        if (firstVoice < 0) firstVoice = size - frameSamples;
        lastVoice = size; voicedSamples += frameSamples;
      }
      frameSamples = 0; frameEnergy = 0; frameSum = 0; framePeak = 0;
    }
  }
  function sample(raw) {
    const value = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw / 32768)) : 0;
    history[cursor] = value;
    let filtered = 0;
    for (let tap = 0; tap < taps; tap += 1) filtered += coefficients[tap] * history[(cursor - tap + taps) % taps];
    cursor = (cursor + 1) % taps;
    while (nextOutput <= sourceIndex) {
      const fraction = nextOutput - (sourceIndex - 1);
      emit(sourceIndex === 0 ? filtered : previous + (filtered - previous) * fraction);
      nextOutput += sampleRate / OUTPUT_RATE;
    }
    previous = filtered; sourceIndex += 1;
  }
  return {
    append(data, rate = sampleRate) {
      if (flushed) return;
      if (rate !== sampleRate) throw new Error('Microphone sample rate changed');
      if (!(data instanceof Float32Array)) throw new Error('Invalid microphone PCM');
      for (const value of data) {
        // The UI deadline and the final worklet block can straddle 30 seconds.
        // Zero-only padding loses no speech. Inspect the entire overflow tail:
        // a leading zero must not hide a later nonzero sample in this block.
        if (size >= output.length) {
          if (Number.isFinite(value) && value !== 0) { truncated = true; break; }
          continue;
        }
        sample(value);
      }
    },
    flush() {
      if (flushed) return;
      flushed = true;
      // Drain the causal filter, retaining the microphone's last few samples.
      if (taps > 1) for (let index = 0; index < taps - 1 && size < output.length; index += 1) sample(0);
      if (frameSamples && Math.sqrt(Math.max(0, frameEnergy / frameSamples - (frameSum / frameSamples) ** 2)) >= .004 && framePeak >= .015) {
        if (firstVoice < 0) firstVoice = size - frameSamples;
        lastVoice = size; voicedSamples += frameSamples;
      }
    },
    snapshot() {
      if (voicedSamples < OUTPUT_RATE * .12 || firstVoice < 0) return null;
      const start = Math.max(0, firstVoice - OUTPUT_RATE * .25);
      const end = Math.min(size, lastVoice + OUTPUT_RATE * .35);
      return output.slice(start, end);
    },
    get size() { return size; }, get voicedSamples() { return voicedSamples; },
    get lastVoice() { return lastVoice; }, get truncated() { return truncated; },
  };
}

/** Scores are selected-token decoder probabilities, never calibrated accuracy.
 * Only fully covered words receive a score; unknown or mismatched spans stay unknown. */
export function decoderWords(raw, ids, observations, tokenizer) {
  const text = raw.trim();
  const offset = raw.indexOf(text);
  const generatedStart = ids.length - observations.length;
  let previous = 0, carry = 1, valid = true;
  const spans = [];
  for (let index = 0; index < observations.length; index += 1) {
    const score = observations[index];
    const selected = ids[generatedStart + index];
    if (selected >= 50257) continue;
    if (score.id !== selected || !Number.isFinite(score.p) || score.p < 0 || score.p > 1) valid = false;
    else carry = Math.min(carry, score.p);
    const prefix = tokenizer.decode(ids.slice(0, generatedStart + index + 1), { skip_special_tokens: true });
    let end = 0;
    while (end < prefix.length && end < raw.length && prefix[end] === raw[end]) end += 1;
    if (end > previous) {
      spans.push({ start: previous - offset, end: end - offset, ...(valid ? { conf: carry } : {}) });
      previous = end; carry = 1; valid = true;
    }
  }
  return [...text.matchAll(/\S+/gu)].map((match) => {
    const start = match.index, end = start + match[0].length;
    const covered = spans.filter((span) => span.end > start && span.start < end);
    const known = covered.length && covered[0].start <= start && covered.at(-1).end >= end && covered.every((span) => Number.isFinite(span.conf));
    return { word: match[0], ...(known ? { conf: Math.min(...covered.map((span) => span.conf)) } : {}) };
  });
}

export async function loadWhisperBackend(progress) {
  const { pipeline, env, LogitsProcessor, LogitsProcessorList } = await import('../vendor/transformers/transformers.min.js');
  env.allowRemoteModels = false; env.allowLocalModels = true;
  env.localModelPath = new URL('../models/', import.meta.url).href;
  env.useBrowserCache = true; env.useFSCache = false;
  env.backends.onnx.wasm.numThreads = 1; env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.wasmPaths = new URL('../vendor/transformers/', import.meta.url).href;
  const pipe = await pipeline('automatic-speech-recognition', 'whisper-base', {
    device: 'wasm', dtype: 'q8', local_files_only: true,
    progress_callback(event) {
      if (event.status === 'progress') progress({ phase: 'download', file: event.file, loaded: event.loaded, total: event.total });
      else if (event.status === 'initiate' || event.status === 'ready') progress({ phase: 'initialize' });
    },
  });
  class Observe extends LogitsProcessor {
    constructor() { super(); this.values = []; }
    _call(ids, logits) {
      const values = logits.data;
      let top = -Infinity, id = 0;
      for (let index = 0; index < values.length; index += 1) if (values[index] > top) { top = values[index]; id = index; }
      let sum = 0;
      for (const value of values) sum += Math.exp(value - top);
      this.values.push({ id, p: 1 / sum });
      return logits;
    }
  }
  async function decode(audio, warmup = false) {
    const inputs = await pipe.processor(audio);
    let output;
    try {
      const observer = new Observe(), processors = new LogitsProcessorList(); processors.push(observer);
      output = await pipe.model.generate({ ...inputs, language: 'korean', task: 'transcribe',
      max_new_tokens: warmup ? 1 : MAX_GENERATED_TOKENS, do_sample: false, logits_processor: processors });
      const ids = output.tolist()[0].map(Number);
      const raw = pipe.tokenizer.decode(ids, { skip_special_tokens: true });
      return { text: raw.trim(), words: decoderWords(raw, ids, observer.values, pipe.tokenizer),
        // A generation cap is uncertainty, not permission to silently treat truncated text as complete.
      tokenLimitReached: !warmup && observer.values.length >= MAX_GENERATED_TOKENS };
    } finally {
      output?.dispose?.();
      for (const tensor of Object.values(inputs)) tensor?.dispose?.();
    }
  }
  return { decode, warmup: () => decode(new Float32Array(OUTPUT_RATE), true), dispose: () => pipe.dispose() };
}

/** Dependency seams exercise PCM ordering and inference ownership without a model download. */
export function createWhisperWorkerRuntime({ postMessage, loadBackend = loadWhisperBackend } = {}) {
  let backend = null, loading = null, session = null, running = false, disposed = false;
  const ports = new Set();
  const emit = (event, details = {}) => { if (!disposed) postMessage({ event, ...details }); };
  function closePorts() { for (const port of ports) { port.onmessage = null; port.close(); } ports.clear(); }
  function remove(id) {
    if (session?.id !== id) return;
    session.cancelled = true; session.pending = null; session = null; closePorts();
  }
  async function drain() {
    if (running || disposed || !backend) return;
    const owner = session;
    const job = owner?.pending;
    if (!job || owner.cancelled) return;
    owner.pending = null; running = true;
    emit('inference-start');
    try {
      const audio = owner.pcm.snapshot();
      // A final request often follows a complete partial plus silence. Reuse
      // only identical PCM (including zero padding), never approximate speech.
      const previous = owner.decoded;
      const same = audio && previous && Math.max(audio.length, previous.audio.length) <= OUTPUT_RATE * MAX_AUDIO_SECONDS
        && (() => { for (let i = 0, n = Math.max(audio.length, previous.audio.length); i < n; i++) if ((audio[i] || 0) !== (previous.audio[i] || 0)) return false; return true; })();
      const result = audio ? same ? previous.result : await backend.decode(audio) : { text: '', words: [] };
      if (session !== owner || owner.cancelled || disposed) return;
      if (audio && !same) owner.decoded = { audio, result };
      if (job.final) {
        owner.finished = true;
        emit('result', { recognizerId: owner.id, final: true, result: {
          text: result.text, result: result.words, engine: ENGINE,
          ...(result.tokenLimitReached || owner.pcm.truncated ? { truncated: true } : {}),
        } });
      } else if (!owner.finalRequested) emit('partialresult', { recognizerId: owner.id, result: { partial: result.text } });
    } catch (error) {
      if (session === owner && !owner.cancelled) {
        owner.finished = true; owner.pending = null;
        // A failed decoder is not reusable merely because the microphone closed.
        emit('error', { error: error?.message || String(error) });
      }
    } finally { running = false; emit('inference-end'); void drain(); }
  }
  function request(owner, final) {
    if (owner.finished || owner.cancelled || (owner.finalRequested && !final)) return;
    if (final) { owner.finalRequested = true; owner.pcm.flush(); }
    // One pending job at most. Final always replaces a queued partial.
    owner.pending = { final };
    owner.lastPartialAt = owner.pcm.size; owner.lastDecodedVoice = owner.pcm.lastVoice;
    void drain();
  }
  function handleAudio(data) {
    const owner = session;
    if (!owner || data.recognizerId !== owner.id || owner.cancelled || owner.finished || owner.finalRequested) return;
    try {
      if (data.action === 'audioChunk') {
        owner.pcm.append(data.data, data.sampleRate);
        if (owner.pcm.size - owner.lastPartialAt >= OUTPUT_RATE * PARTIAL_INTERVAL_SECONDS &&
          owner.pcm.lastVoice - owner.lastDecodedVoice >= OUTPUT_RATE * .5) request(owner, false);
      } else if (data.action === 'retrieveFinalResult') request(owner, true);
    } catch (error) { emit('error', { recognizerId: owner.id, error: error.message }); remove(owner.id); }
  }
  return {
    async handle(data) {
      if (disposed) return;
      if (data.action === 'load') {
        if (!loading) loading = (async () => {
          try {
            const created = await loadBackend((event) => emit('progress', event));
            if (disposed) { await created.dispose?.(); return; }
            backend = created;
            emit('progress', { phase: 'warmup' }); emit('inference-start');
            await backend.warmup();
            emit('inference-end'); emit('load', { result: true });
          } catch (error) { emit('inference-end'); emit('error', { error: error?.message || String(error) }); }
        })();
        await loading;
      } else if (data.action === 'create') {
        if (!backend) { emit('error', { error: 'Speech model is not ready' }); return; }
        if (session) remove(session.id);
        try {
          session = { id: data.recognizerId, pcm: createPcmBuffer(data.sampleRate), pending: null,
            cancelled: false, finalRequested: false, finished: false, lastPartialAt: 0, lastDecodedVoice: 0 };
        } catch (error) { emit('error', { recognizerId: data.recognizerId, error: error.message }); }
      } else if (data.action === 'remove') remove(data.recognizerId);
      else if (data.action === 'connectAudioPort') {
        if (!session) { data.port.close(); return; }
        ports.add(data.port); data.port.onmessage = ({ data: audio }) => handleAudio(audio); data.port.start?.();
      } else if (data.action === 'retrieveFinalResult' || data.action === 'audioChunk') handleAudio(data);
    },
    async dispose() {
      disposed = true;
      if (session) remove(session.id);
      closePorts(); await backend?.dispose?.(); backend = null;
    },
  };
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof document === 'undefined') {
  const runtime = createWhisperWorkerRuntime({ postMessage: (message) => self.postMessage(message) });
  self.onmessage = ({ data }) => { void runtime.handle(data); };
}
