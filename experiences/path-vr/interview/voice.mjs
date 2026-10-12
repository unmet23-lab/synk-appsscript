/** Local Korean ASR. No Web Speech API, server recognizer, or audio upload. */
export const SPEECH_MODEL_URL = new URL('../models/vosk-model-small-ko-0.22.tar.gz', import.meta.url).href;
export const SPEECH_MODEL_BYTES = 89_103_045; // Local USTAR gzip; actual progress total comes from HTTP.
const WORKLET_URL = new URL('./audio-worklet.js', import.meta.url).href;
const noop = () => {};

export function voiceError(error) {
  const raw = String(error?.message || error || 'unknown');
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return { code: 'microphone-denied', message: '마이크 사용이 허용되지 않았어요. 브라우저의 마이크 권한을 확인해 주세요.' };
  if (name === 'NotFoundError') return { code: 'microphone-missing', message: '사용할 수 있는 마이크가 없어요. 헤드셋 마이크를 확인해 주세요.' };
  if (name === 'NotReadableError') return { code: 'microphone-busy', message: '마이크를 열지 못했어요. 다른 앱의 마이크 사용을 끝낸 뒤 다시 시도해 주세요.' };
  if (/memory|allocation|out of bounds|wasm trap/i.test(raw)) return { code: 'memory', message: '음성 모델을 실행할 메모리가 부족해요. 다른 브라우저 탭을 닫고 다시 시도해 주세요.' };
  if (/404|not found|Failed to fetch|NetworkError|HTTP error/i.test(raw)) return { code: 'model-download', message: '한국어 음성 모델을 불러오지 못했어요. 연결과 모델 파일을 확인한 뒤 다시 시도해 주세요.' };
  if (/timeout/i.test(raw)) return { code: 'timeout', message: '음성 처리 시간이 길어지고 있어요. 다시 시도해 주세요.' };
  if (name === 'AbortError') return { code: 'cancelled', message: '음성 입력을 종료했어요.' };
  return { code: 'voice-unavailable', message: '음성 입력을 시작하지 못했어요. 브라우저와 헤드셋을 확인한 뒤 다시 시도해 주세요.' };
}

function abortError() { return new DOMException('Voice input cancelled', 'AbortError'); }

/** Merge capture segments without correcting their text or inferring missing
 * confidence. Word times remain relative to their original capture, including
 * after pause/resume. Vosk confidence is a decoder score, not accuracy proof.
 * Text-only/edited segments have unknown words; their confidence is never
 * borrowed from another segment or from a supplied utterance-level average. */
export function mergeVoiceResults(results = []) {
  const segments = results.map((result) => {
    const text = String(result?.text || '').replace(/\s+/gu, ' ').trim();
    const tokens = text ? text.split(' ') : [];
    const supplied = Array.isArray(result?.words) ? result.words : [];
    // Confidence must refer to the exact, unedited transcript. If the text and
    // metadata no longer agree, preserve the text and mark its words unknown.
    const aligned = supplied.length === tokens.length && supplied.every((item, index) => item?.word === tokens[index]);
    const words = tokens.map((word, index) => {
      const item = aligned ? supplied[index] : {};
      return { word,
        ...(Number.isFinite(item.conf) && item.conf >= 0 && item.conf <= 1 ? { conf: item.conf } : {}),
        ...(Number.isFinite(item.start) && item.start >= 0 ? { start: item.start } : {}),
        ...(Number.isFinite(item.end) && item.end >= 0 ? { end: item.end } : {}),
      };
    });
    return { text, words, engine: result?.engine };
  });
  const words = segments.flatMap((segment) => segment.words);
  const known = words.filter((word) => Number.isFinite(word.conf));
  const engines = [...new Set(segments.filter(segment => segment.text).map(segment => segment.engine))];
  return { text: segments.map((segment) => segment.text).filter(Boolean).join(' '), words,
    ...(engines.length === 1 && typeof engines[0] === 'string' ? { engine: engines[0] } : {}),
    ...(results.some(result => result?.truncated) ? { truncated: true } : {}),
    ...(known.length ? { confidence: known.reduce((sum, word) => sum + word.conf, 0) / known.length } : {}),
    confidenceCoverage: words.length ? known.length / words.length : 0,
  };
}

function normalize(result = {}) {
  return mergeVoiceResults([{ text: result.text, words: result.result, engine: result.engine, truncated: result.truncated }]);
}

/**
 * onStatus receives { state, message, code?, loaded?, total?, progress? }.
 * onPartial receives {text}; onResult receives the complete utterance so far as
 * {text, words: [{word, conf?, start?, end?}], confidence?, confidenceCoverage}.
 * Missing confidence is unknown, not zero or an assumed high-confidence word.
 * stop() resolves only after the worker acknowledges final PCM. Mic is closed
 * immediately on stop, while only local queued PCM finishes recognition.
 * `platform` / `modelFactory` are dependency seams for lifecycle tests.
 */
export function createVoiceInput({ onPartial = noop, onResult = noop, onLevel = noop, onStatus = noop,
  platform = globalThis, modelFactory, modelNotice = '한국어 음성 모델을 준비하고 있어요. 처음에는 약 89MB를 내려받아요.', prepareTimeoutMs = 240_000, finalTimeoutMs = 15_000 } = {}) {
  let model = null;
  let preparing = null;
  let cancelPreparing = null;
  let disposed = false;
  let session = null;
  let captureGeneration = 0;
  let startPending = null;
  let currentState = 'idle';
  const emit = (state, message, extra = {}) => {
    currentState = state;
    onStatus({ state, message, ...extra });
  };
  const reportError = (error) => {
    const details = voiceError(error);
    emit(details.code === 'cancelled' ? 'idle' : 'error', details.message, details);
    return error;
  };
  const disposeModel = () => { model?.dispose?.(); model = null; };

  async function prepare() {
    if (disposed) throw abortError();
    if (model?.ready) return;
    if (preparing) return preparing;
    emit('loading', modelNotice, { progress: null });
    preparing = (async () => {
      if (!platform.Worker || !platform.WebAssembly) throw new Error('WebAssembly worker unavailable');
      const factory = modelFactory || (async () => {
        const { Model } = await import('../vendor/vosk/vosk.mjs');
        return new Model(SPEECH_MODEL_URL, -2);
      });
      const created = await factory();
      if (disposed) { created.dispose?.(); throw abortError(); }
      model = created;
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cancelPreparing = null;
          error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => finish(new Error('Model load timeout')), prepareTimeoutMs);
        cancelPreparing = () => finish(abortError());
        model.on('progress', (event) => {
          if (settled || disposed) return;
          if (event.phase === 'download') {
            const loaded = Number(event.loaded) || 0;
            const total = Number(event.total) || 0;
            emit('loading', '한국어 음성 모델을 내려받고 있어요.', { loaded, total, progress: total ? Math.min(1, loaded / total) : null });
          } else if (event.phase !== 'cache-unavailable') {
            emit('loading', '내려받은 음성 모델을 기기에서 열고 있어요.', { phase: event.phase, progress: null });
          }
        });
        model.on('load', (event) => finish(event.result ? null : new Error('Model load failed')));
        model.on('error', (event) => {
          const error = new Error(event.error || 'Worker failed');
          if (!settled) finish(error);
          else if (!disposed) {
            if (session) failSession(session, error);
            disposeModel();
            reportError(error);
          }
        });
        if (model.ready) finish();
      });
      if (disposed) throw abortError();
      emit('ready', '음성 입력 준비가 됐어요. 말한 내용은 이 기기에서만 처리해요.');
    })().catch((error) => { disposeModel(); throw reportError(error); }).finally(() => { preparing = null; });
    return preparing;
  }

  function closeMicrophone(active) {
    active.stream?.getTracks().forEach((track) => track.stop());
    active.stream = null;
    try { active.source?.disconnect(); } catch { /* already disconnected */ }
    if (active.fixtureSource) {
      active.fixtureSource.onended = null;
      try { active.fixtureSource.stop(); } catch { /* source already ended */ }
    }
  }

  async function cleanup(active) {
    closeMicrophone(active);
    active.node?.port.postMessage({ type: 'dispose' });
    try { active.node?.disconnect(); active.silencer?.disconnect(); } catch { /* already disconnected */ }
    try { active.recognizer?.remove(); } catch { /* failed worker */ }
    active.node?.port.close();
    if (active.context && active.context.state !== 'closed') await active.context.close().catch(noop);
    if (session === active) session = null;
    onLevel(0);
  }

  function failSession(active, error) {
    active.error = error;
    active.cancel?.(error);
    active.finalReject?.(error);
    void cleanup(active);
  }

  function combinedResult(active) {
    return mergeVoiceResults(active.results);
  }

  async function begin(arrayBuffer) {
    if (disposed) throw abortError();
    if (session) return session.starting;
    const generation = ++captureGeneration;
    await prepare();
    if (disposed || generation !== captureGeneration) throw abortError();
    if (session) return session.starting;
    const active = { results: [], context: null, stream: null, source: null, node: null, recognizer: null, cancelled: false };
    session = active;
    const cancellation = new Promise((_, reject) => { active.cancel = reject; });
    active.cancellation = cancellation;
    // A resolved start leaves this promise unused; keep later cancellation handled.
    cancellation.catch(noop);
    active.starting = (async () => {
      if (platform.isSecureContext === false) throw new Error('Microphone requires secure context');
      const Context = platform.AudioContext || platform.webkitAudioContext;
      if (!Context || !platform.AudioWorkletNode) throw new Error('AudioWorklet unavailable');
      try { active.context = new Context({ sampleRate: 16000, latencyHint: 'interactive' }); }
      catch { active.context = new Context(); }
      await active.context.resume();
      if (disposed || active.cancelled) throw abortError();
      if (!arrayBuffer) {
        if (!platform.navigator?.mediaDevices?.getUserMedia) throw new Error('Microphone requires HTTPS');
        emit('requesting', '마이크를 준비하고 있어요.');
        const permission = platform.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        permission.then((stream) => { if (active.cancelled || disposed || session !== active) stream.getTracks().forEach((track) => track.stop()); }, noop);
        active.stream = await Promise.race([permission, cancellation]);
      }
      await Promise.race([active.context.audioWorklet.addModule(WORKLET_URL), cancellation]);
      if (disposed || active.cancelled) throw abortError();
      active.recognizer = new model.KaldiRecognizer(active.context.sampleRate);
      active.recognizer.setWords(true);
      active.recognizer.on('result', (event) => {
        if (session !== active || active.cancelled) return;
        const result = normalize(event.result);
        if (result.text) active.results.push(result);
        onPartial({ text: '' });
        if (result.text || event.final) onResult(combinedResult(active));
        if (event.final) active.finalResolve?.(combinedResult(active));
      });
      active.recognizer.on('partialresult', (event) => {
        if (session === active && !active.cancelled) onPartial({ text: [combinedResult(active).text, event.result?.partial || ''].filter(Boolean).join(' ') });
      });
      active.recognizer.on('error', (event) => {
        const error = new Error(event.error || 'Recognition failed');
        failSession(active, error);
        reportError(error);
      });
      active.node = new platform.AudioWorkletNode(active.context, 'synk-interview-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      active.node.port.onmessage = ({ data }) => { if (data.type === 'level' && session === active) onLevel(data.value); };
      const channel = new platform.MessageChannel();
      model.connectAudioPort(channel.port1);
      active.node.port.postMessage({ type: 'connect', port: channel.port2, recognizerId: active.recognizer.id }, [channel.port2]);
      active.silencer = active.context.createGain();
      active.silencer.gain.value = 0;
      active.node.connect(active.silencer).connect(active.context.destination);
      if (arrayBuffer) {
        const audio = await Promise.race([active.context.decodeAudioData(arrayBuffer.slice(0)), cancellation]);
        if (disposed || active.cancelled) throw abortError();
        active.fixtureSource = active.context.createBufferSource();
        active.fixtureSource.buffer = audio;
        active.source = active.fixtureSource;
        active.fixtureEnded = new Promise((resolve) => { active.fixtureSource.onended = resolve; });
        active.source.connect(active.node);
        active.fixtureSource.start();
      } else {
        active.source = active.context.createMediaStreamSource(active.stream);
        active.source.connect(active.node);
        active.stream.getTracks().forEach((track) => track.addEventListener('ended', () => {
          if (session === active && !active.stopping) void stop().catch(noop);
        }, { once: true }));
      }
      active.started = true;
      emit('listening', '듣고 있어요. 답변을 마치면 완료를 눌러 주세요.');
    })().catch(async (error) => { await cleanup(active); throw reportError(error); });
    return active.starting;
  }

  async function stop() {
    captureGeneration += 1;
    const active = session;
    if (!active) return mergeVoiceResults();
    if (active.stopping) return active.stopping;
    if (!active.started) {
      active.cancelled = true;
      active.cancel?.(abortError());
      await cleanup(active);
      emit('ready', '음성 입력을 종료했어요.');
      return combinedResult(active);
    }
    active.stopping = (async () => {
      closeMicrophone(active);
      emit('processing', '답변의 마지막 부분을 기기에서 확인하고 있어요.');
      let timer;
      try {
        const final = new Promise((resolve, reject) => {
          active.finalResolve = resolve;
          active.finalReject = reject;
          timer = setTimeout(() => reject(new Error('Final recognition timeout')), finalTimeoutMs);
        });
        active.node.port.postMessage({ type: 'flush' });
        const result = await final;
        emit('ready', result.text ? '답변을 확인했어요.' : '말소리를 인식하지 못했어요. 다시 답해 주세요.');
        return result;
      } catch (error) { disposeModel(); throw reportError(error); }
      finally { clearTimeout(timer); await cleanup(active); }
    })();
    return active.stopping;
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    cancelPreparing?.();
    if (session) {
      session.cancelled = true;
      session.cancel?.(abortError());
      session.finalReject?.(abortError());
      await cleanup(session);
    }
    disposeModel();
    emit('disposed', '음성 입력을 종료했어요.');
  }

  return {
    prepare, start: () => {
      if (!startPending) startPending = begin().finally(() => { startPending = null; });
      return startPending;
    }, stop, dispose,
    get ready() { return Boolean(model?.ready && !disposed); },
    get state() { return currentState; },
    // Development fixture path: same worklet and worker as the microphone; the
    // WAV stays local and is not played through the output device.
    async transcribeWav(arrayBuffer) {
      if (!(arrayBuffer instanceof ArrayBuffer)) throw new TypeError('WAV fixture must be an ArrayBuffer');
      if (session) throw new Error('Stop the active microphone before a fixture run');
      await begin(arrayBuffer);
      const active = session;
      if (!active) throw abortError();
      await Promise.race([active.fixtureEnded, active.cancellation]);
      return stop();
    },
  };
}

/** Development helper. Only same-origin public synthetic WAV fixtures allowed. */
export async function transcribeWavFixture(url, callbacks = {}) {
  const target = new URL(url, import.meta.url);
  if (target.origin !== new URL(import.meta.url).origin) throw new Error('Fixture must be same-origin');
  const response = await fetch(target);
  if (!response.ok) throw new Error(`Fixture HTTP ${response.status}`);
  const input = createVoiceInput(callbacks);
  try { return await input.transcribeWav(await response.arrayBuffer()); }
  finally { await input.dispose(); }
}
