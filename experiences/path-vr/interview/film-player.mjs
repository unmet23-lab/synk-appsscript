/** Two real video decoders, with no poster/still fallback or synthetic dialogue.
 * Contract: reviewed, native-audio speaking clips and silent listening clips,
 * each with verified neutral head/tail holds. Only rectilinear MONO is supported;
 * showing this film in a headset does not make it stereoscopic VR180/360.
 * prepare(ids) decodes every requested clip but retains at most two buffers.
 * queue() changes clips at ended, including a listening loop's next boundary.
 * pause/stop cancel asynchronous work; play/queue callers handle AbortError.
 */
const ORIGIN_FALLBACK = 'https://path.invalid/interview/';
// Public builds serve the films from the PATH media bucket (tools/upload-path-media.mjs) because
// GitHub Pages empties its cache on every site deploy. Only this fixed https prefix is accepted
// besides the page's own origin; the bucket answers synk.im with CORS so the room can draw frames.
export const TRUSTED_FILM_PREFIXES = Object.freeze(['https://storage.googleapis.com/synk-public-media/path/']);
const abortError = () => new DOMException('영상 작업이 취소되었습니다.', 'AbortError');
function filmError(code, message) { const error = new Error(message); error.name = 'FilmPlaybackError'; error.code = code; return error; }
const playbackStart = (clip) => clip.playbackStartSeconds === undefined ? 0 : clip.playbackStartSeconds;
function startFrameTolerance(clip) {
  // Seeking may submit the frame whose presentation interval contains the
  // requested time. Only listening trims permit this one-frame rounding;
  // the native-speech start gate must retain its original strict bound.
  if (!playbackStart(clip)) return 0.001;
  const [numerator, denominator = 1] = String(clip.fps ?? 60).split('/').map(Number);
  const fps = numerator / denominator;
  return Number.isFinite(fps) && fps > 0 ? 1 / fps : 1 / 60;
}
export function resolveFilmClipUrl(src, { moduleUrl = import.meta.url, pageUrl = globalThis.location?.href || ORIGIN_FALLBACK } = {}) {
  if (typeof src !== 'string' || !src.trim() || src.includes('\\')) return null;
  try {
    // Manifest media paths use this module's /interview/ directory, including
    // when the complete runtime is mounted below /path-vr/. Review pages live
    // one level deeper, so document-relative resolution would be incorrect.
    const moduleBase = /^https?:/.test(moduleUrl) ? moduleUrl : new URL('./film-player.mjs', ORIGIN_FALLBACK).href;
    const url = new URL(src, moduleBase);
    const trusted = url.protocol === 'https:' && !url.search && TRUSTED_FILM_PREFIXES.some((prefix) => url.href.startsWith(prefix));
    if (!['http:', 'https:'].includes(url.protocol) || (url.origin !== new URL(pageUrl).origin && !trusted) || url.username || url.password || url.hash) return null;
    return /\.(?:mp4|webm)$/i.test(decodeURIComponent(url.pathname)) ? url.href : null;
  } catch { return null; }
}
const clipUrl = resolveFilmClipUrl;

export function evaluateFilmReadiness(manifest, requiredIds) {
  const errors = [], missing = [];
  if (!manifest || typeof manifest !== 'object') return { ready: false, missing: [...new Set(requiredIds || [])], errors: ['실제 영상 목록이 없습니다.'] };
  if (manifest.status !== 'ready') errors.push('영상 제작·검수가 완료되지 않았습니다.');
  if (manifest.projection !== 'rectilinear-mono' || manifest.stereo !== false) errors.push('이 재생기는 평면 단안 영상(rectilinear-mono)만 지원합니다.');
  if (manifest.source?.status !== 'verified' || typeof manifest.source?.provider !== 'string' || !manifest.source.provider.trim()) errors.push('영상 원본의 출처·검수 상태가 확인되지 않았습니다.');
  const clips = Array.isArray(manifest.clips) ? manifest.clips : [];
  if (!Array.isArray(manifest.clips)) errors.push('영상 목록 형식이 올바르지 않습니다.');
  const ids = requiredIds === undefined ? clips.map((clip) => clip?.id) : requiredIds;
  if (!Array.isArray(ids) || !ids.length) return { ready: false, missing, errors: [...errors, '준비할 영상 ID가 없습니다.'] };
  const seen = new Set();
  for (const clip of clips) {
    if (!clip || !/^[a-z0-9-]+$/.test(clip.id || '') || seen.has(clip.id)) errors.push('잘못되거나 중복된 영상 ID가 있습니다.');
    if (clip) seen.add(clip.id);
  }
  for (const id of new Set(ids)) {
    const clip = clips.find((candidate) => candidate?.id === id);
    if (!clip || !clip.src || clip.status !== 'ready') { missing.push(id); continue; }
    if (!clipUrl(clip.src)) errors.push(`${id}: 같은 출처나 PATH 영상 저장소의 MP4/WebM 원본이 필요합니다.`);
    if (!['speaking', 'listening'].includes(clip.kind)) errors.push(`${id}: 영상 종류를 확인해 주세요.`);
    if (clip.audio !== (clip.kind === 'listening' ? 'silent' : 'native')) errors.push(`${id}: 질문은 원본 음성, 경청은 무음이어야 합니다.`);
    const start = playbackStart(clip);
    if (!Number.isFinite(start) || start < 0 || (start !== 0 && clip.kind !== 'listening')) errors.push(`${id}: 시작 위치는 경청 영상의 0초 이상 시점만 지정할 수 있습니다.`);
    const transition = clip.transition;
    if (clip.reviewed !== true || transition?.validated !== true || !Number.isFinite(transition?.headHoldMs) || transition.headHoldMs < 100 || !Number.isFinite(transition?.tailHoldMs) || transition.tailHoldMs < 100) errors.push(`${id}: 시작·끝의 무음 중립 프레임과 연결 검수가 필요합니다.`);
  }
  return { ready: errors.length === 0 && missing.length === 0, missing, errors };
}

export function createFilmPlayer({ mount, manifest, onState = () => {}, onEnded = () => {}, prepareTimeoutMs = 15000, startTimeoutMs = 8000, stallTimeoutMs = 8000, transitionMs = 0 } = {}) {
  if (!mount?.ownerDocument?.createElement || !mount.appendChild) throw new TypeError('영상 재생 영역이 필요합니다.');
  for (const value of [prepareTimeoutMs, startTimeoutMs, stallTimeoutMs]) if (!Number.isFinite(value) || value <= 0) throw new RangeError('영상 제한 시간은 양수여야 합니다.');
  if (!Number.isFinite(transitionMs) || transitionMs < 0 || transitionMs > 1000) throw new RangeError('영상 전환 시간은 0~1000ms여야 합니다.');
  const document = mount.ownerDocument, stage = document.createElement('div');
  stage.className = 'film-player'; stage.hidden = true;
  Object.assign(stage.style, { position: 'relative', width: '100%', height: '100%', minHeight: '1px', background: '#000' });
  const slots = [0, 1].map((index) => {
    const video = document.createElement('video');
    // CORS before any src: frames from the media bucket must stay usable as WebGL textures.
    video.crossOrigin = 'anonymous';
    video.preload = 'auto'; video.playsInline = true; video.controls = false; video.muted = true; video.loop = false;
    video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
    Object.assign(video.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'contain', opacity: '0', pointerEvents: 'none', transition: transitionMs ? `opacity ${transitionMs}ms linear` : 'none' });
    stage.appendChild(video);
    return { video, index, version: 0, playSerial: 0, id: null, primed: false, headFrame: null, watch: null, frame: null };
  });
  mount.appendChild(stage);
  let state = 'idle', active = null, pendingStart = null, queued = null, deferredQueue = null, paused = false, disposed = false, generation = 0, transitioning = false, transitionOwner = null, blend = null, playbackSerial = 0, handoffJob = null;
  function finishBlend() {
    if (!blend) return;
    blend.from.video.style.opacity = '0'; blend.from.video.style.zIndex = '0';
    blend.to.video.style.opacity = '1'; blend.to.video.style.zIndex = '1'; blend = null;
  }
  const jobs = new Set();
  const snapshot = () => active ? Object.freeze({ id: active.clip.id, playbackId: active.playbackId, kind: active.clip.kind, loop: active.loop, ended: active.ended, time: active.slot.video.currentTime, duration: active.slot.video.duration }) : null;
  const emit = (next, extra = {}) => { state = next; onState({ state, current: snapshot(), queued: queued?.clip.id || deferredQueue?.id || null, ...extra }); };
  const checkLive = () => { if (disposed) throw filmError('disposed', '종료된 영상 재생기입니다.'); };
  function validated(ids) {
    checkLive();
    const readiness = evaluateFilmReadiness(manifest, ids);
    if (!readiness.ready) {
      emit('blocked', { readiness });
      const error = filmError('film-not-ready', '실제 면접 영상이 아직 준비되지 않았습니다.'); error.readiness = readiness; throw error;
    }
    if (slots.some(({ video }) => typeof video.requestVideoFrameCallback !== 'function' || typeof video.cancelVideoFrameCallback !== 'function')) {
      emit('blocked'); throw filmError('decoded-frame-unsupported', '이 브라우저는 영상 프레임 확인을 지원하지 않습니다.');
    }
    return ids.map((id) => manifest.clips.find((clip) => clip.id === id));
  }
  function loopOption(clip, options) {
    const loop = options.loop ?? clip.kind === 'listening';
    if (loop && clip.kind !== 'listening') throw filmError('speaking-loop', '질문 영상은 반복 재생하지 않습니다.');
    return !!loop;
  }
  function task(timeout, code) {
    const controller = new AbortController(), token = generation;
    const timer = setTimeout(() => controller.abort(filmError(code, '영상 응답 시간이 초과되었습니다.')), timeout);
    const job = { signal: controller.signal, token, abort: () => controller.abort(abortError()), finish() { clearTimeout(timer); controller.abort(abortError()); jobs.delete(job); } };
    jobs.add(job); return job;
  }
  function guard(job) { if (job.signal.aborted) throw job.signal.reason; if (disposed || job.token !== generation) throw abortError(); }
  function wait(job, subscribe) {
    return new Promise((resolve, reject) => {
      if (job.signal.aborted) { reject(job.signal.reason); return; }
      let cleanup = () => {}, done = false;
      const finish = (error, value) => { if (done) return; done = true; cleanup(); job.signal.removeEventListener('abort', aborted); error ? reject(error) : resolve(value); };
      const aborted = () => finish(job.signal.reason);
      job.signal.addEventListener('abort', aborted, { once: true });
      cleanup = subscribe((value) => finish(null, value), (error) => finish(error)) || cleanup;
      if (done) cleanup();
    });
  }
  const mediaError = () => filmError('media-error', '영상 파일을 읽거나 재생하지 못했습니다. 실제 MP4/WebM 파일을 확인해 주세요.');
  function frame(slot, job, accepts = () => true) {
    return wait(job, (resolve, reject) => {
      const video = slot.video;
      let handle;
      const submitted = (_, metadata) => {
        // During a seek readyState can temporarily fall even though this callback
        // proves a decoded frame was submitted. Inspect the submitted frame;
        // initial buffering still has its separate HAVE_CURRENT_DATA gate.
        const width = metadata.width || video.videoWidth, height = metadata.height || video.videoHeight;
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(metadata.mediaTime)) reject(mediaError());
        else if (accepts(metadata)) resolve(metadata);
        // A seek can complete after a previously submitted frame's callback.
        // Keep listening under this job's existing timeout until the requested
        // decoded pose actually arrives; never expose the stale frame.
        else handle = video.requestVideoFrameCallback(submitted);
      };
      handle = video.requestVideoFrameCallback(submitted);
      const error = () => reject(mediaError()); video.addEventListener('error', error);
      return () => { video.cancelVideoFrameCallback(handle); video.removeEventListener('error', error); };
    });
  }
  function inHead(video, clip, metadata) {
    const start = playbackStart(clip), earliest = start - startFrameTolerance(clip), latest = start + clip.transition.headHoldMs / 1000;
    return Number.isFinite(video.currentTime) && video.currentTime >= earliest && video.currentTime <= latest && metadata.mediaTime >= earliest && metadata.mediaTime <= latest;
  }
  function hasPausedHead(slot, clip) {
    const proof = slot.headFrame;
    return slot.primed && proof?.version === slot.version && proof.src === clipUrl(clip.src) && slot.video.src === proof.src
      && slot.id === clip.id && slot.video.paused && Math.abs(slot.video.currentTime - playbackStart(clip)) <= 0.001
      && inHead(slot.video, clip, proof.metadata);
  }
  function decodedData(slot, job) {
    return wait(job, (resolve, reject) => {
      const video = slot.video;
      const ready = () => { if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(video.duration) && video.duration > 0) resolve(); };
      const error = () => reject(mediaError());
      for (const event of ['loadeddata', 'canplay']) video.addEventListener(event, ready);
      video.addEventListener('error', error); ready();
      return () => { for (const event of ['loadeddata', 'canplay']) video.removeEventListener(event, ready); video.removeEventListener('error', error); };
    });
  }
  function started(slot, job) {
    const version = slot.version, playSerial = ++slot.playSerial;
    return wait(job, (resolve, reject) => {
      const error = () => reject(mediaError()); slot.video.addEventListener('error', error);
      let result;
      try { result = slot.video.play(); } catch (failure) { reject(failure); return () => slot.video.removeEventListener('error', error); }
      Promise.resolve(result).then(() => {
        // A late play() promise must not restart cancelled media. A newer source
        // or resume in the same slot owns its playback and must not be paused
        // by this job. Source version cannot distinguish two resumes of the
        // same decoded performance; each play request also has its own owner.
        if ((job.signal.aborted || job.token !== generation || disposed) && ((slot.version === version && slot.playSerial === playSerial) || !slot.id)) { slot.video.pause(); slot.video.muted = true; }
        try { guard(job); resolve(); } catch (error) { reject(error); }
      }, reject);
      return () => slot.video.removeEventListener('error', error);
    });
  }
  function stopWatch(slot) {
    clearTimeout(slot.watch); slot.watch = null;
    if (slot.frame !== null) slot.video.cancelVideoFrameCallback(slot.frame);
    slot.frame = null;
  }
  function clearPendingStart(job) {
    if (!pendingStart || (job && pendingStart.job !== job)) return;
    const { record, previous } = pendingStart; pendingStart = null;
    if (record.slot.version !== record.version) return;
    record.slot.video.pause(); record.slot.video.muted = true; record.slot.video.style.opacity = '0';
    blend = null;
    if (previous && active === previous) { previous.slot.video.style.opacity = '1'; previous.slot.video.style.zIndex = '1'; }
  }
  function invalidate() {
    generation++; transitioning = false; transitionOwner = null;
    clearPendingStart();
    for (const job of [...jobs]) job.abort();
    for (const slot of slots) { stopWatch(slot); slot.video.pause(); slot.video.muted = true; }
    queued = null;
  }
  function fail(error) {
    if (disposed || error?.name === 'AbortError') return;
    invalidate(); paused = false; deferredQueue = null;
    emit('error', { code: error.code || 'playback-error', message: error.message });
  }
  function watch(record) {
    const slot = record.slot; stopWatch(slot);
    const next = () => {
      if (disposed || paused || active !== record || record.ended) return;
      clearTimeout(slot.watch);
      slot.watch = setTimeout(() => { if (active === record && !paused && !record.ended) fail(filmError('stall-timeout', '영상 재생이 멈췄습니다. 다시 준비해 주세요.')); }, stallTimeoutMs);
      slot.frame = slot.video.requestVideoFrameCallback(next);
    };
    next();
  }
  async function prime(slot, clip, job) {
    guard(job);
    // Keep the outgoing decoded frame alive until a dissolve has finished.
    // Automatic loop preloading would otherwise replace it in the same tick.
    if (blend?.from === slot) {
      const remaining = transitionMs - (performance.now() - blend.start);
      if (remaining > 0) await wait(job, (resolve) => { const timer = setTimeout(resolve, remaining); return () => clearTimeout(timer); });
      guard(job);
      if (blend?.from === slot) finishBlend();
    }
    if (hasPausedHead(slot, clip) && slot.video.readyState >= 2) return;
    const video = slot.video; slot.version++; const version = slot.version; slot.id = clip.id; slot.primed = false; slot.headFrame = null;
    video.pause(); video.muted = true; video.loop = false; video.style.opacity = '0';
    video.src = clipUrl(clip.src); video.load(); stage.hidden = false;
    try {
      await decodedData(slot, job); guard(job);
      const start = playbackStart(clip);
      if ((video.duration - start) * 1000 <= clip.transition.headHoldMs + clip.transition.tailHoldMs) throw filmError('invalid-hold-duration', '영상의 남은 길이보다 시작·끝 여유 구간이 깁니다.');
      const first = frame(slot, job);
      // Register before play; loadedmetadata alone is never a decoded-frame proof.
      let [, metadata] = await Promise.all([started(slot, job), first]); guard(job); video.pause();
      if (Math.abs(video.currentTime - start) > 0.001 || !inHead(video, clip, metadata)) {
        const rewound = frame(slot, job, (metadata) => inHead(video, clip, metadata)); video.currentTime = start;
        metadata = await rewound; guard(job);
      }
      if (!inHead(video, clip, metadata)) throw filmError('invalid-first-frame', '영상 시작 프레임을 확인하지 못했습니다.');
      slot.headFrame = { version, src: clipUrl(clip.src), metadata };
      slot.primed = true;
    } finally { if (slot.version === version) { video.pause(); video.muted = true; } }
  }
  async function begin(slot, clip, loop, job) {
    guard(job); transitioning = true; transitionOwner = job;
    const video = slot.video, version = slot.version;
    try {
      video.muted = true; video.loop = false;
      // prime() already decoded and paused the reviewed head. Expose that
      // one-use proof BEFORE starting its clock, in this same JS turn. Waiting
      // for another play promise/RVFC while hidden can consume the entire
      // neutral handle on a busy device and must never cause a late unmute.
      if (!hasPausedHead(slot, clip)) throw filmError('invalid-first-frame', '영상 시작 프레임을 확인하지 못했습니다.');
      slot.primed = false; slot.headFrame = null;
      finishBlend();
      const previous = active;
      blend = previous && previous.slot !== slot && transitionMs ? { from: previous.slot, to: slot, start: performance.now() } : null;
      const record = { slot, clip, loop, version, playbackId: ++playbackSerial, ended: false };
      pendingStart = { job, record, previous };
      video.style.zIndex = '2'; video.muted = clip.kind === 'listening'; video.style.opacity = '1'; stage.hidden = false;
      if (previous && previous.slot !== slot) { stopWatch(previous.slot); previous.slot.video.pause(); previous.slot.video.muted = true; previous.slot.video.style.zIndex = '1'; previous.slot.video.style.opacity = blend ? '1' : '0'; }
      await started(slot, job); guard(job);
      // An unresolved start cannot silently consume a whole question. Keep the
      // original finite deadline and report failure instead of a false start.
      if (record.ended) throw filmError('start-timeout', '영상 시작 확인 전에 재생이 끝났습니다. 다시 준비해 주세요.');
      active = record; pendingStart = null;
      paused = false; transitioning = false; transitionOwner = null; emit('playing'); watch(active);
      if (loop) automaticLoop();
      return snapshot();
    } catch (error) {
      clearPendingStart(job);
      if (slot.version === version && active?.slot !== slot) { video.pause(); video.muted = true; }
      throw error;
    } finally { if (transitionOwner === job) { transitioning = false; transitionOwner = null; } }
  }
  function automaticLoop() {
    if (!active?.loop || queued || paused || disposed) return;
    void queueClip(active.clip.id, { loop: true }, true).catch((error) => { if (error.name !== 'AbortError') fail(error); });
  }
  async function consume(next) {
    if (queued !== next || !next.ready || active !== next.owner || !active.ended || paused || transitioning || disposed) return;
    queued = null;
    const job = task(startTimeoutMs, 'start-timeout'); handoffJob = job;
    try { await begin(next.slot, next.clip, next.loop, job); }
    catch (error) { if (job.token === generation) fail(error); }
    finally { if (handoffJob === job) handoffJob = null; job.finish(); }
  }
  async function queueClip(id, options = {}, automatic = false) {
    const [clip] = validated([id]), loop = loopOption(clip, options);
    if (!active) throw filmError('no-current-film', '먼저 현재 영상을 재생해 주세요.');
    if (transitioning) throw filmError('transition-busy', '영상 전환이 끝난 뒤 다음 영상을 지정해 주세요.');
    if (paused) { deferredQueue = { id, loop }; return { id, queued: true, deferred: true }; }
    if (queued) queued.job?.abort();
    const owner = active, slot = slots.find((candidate) => candidate !== owner.slot), job = task(prepareTimeoutMs, 'prepare-timeout');
    const next = { clip, loop, slot, owner, ready: false, job, automatic }; queued = next; deferredQueue = null;
    try {
      await prime(slot, clip, job); guard(job);
      if (queued !== next || active !== owner) throw abortError();
      next.ready = true; emit(state);
      if (owner.ended) void consume(next);
      return { id, queued: true, deferred: false };
    } catch (error) {
      if (queued === next) { queued = null; if (job.token === generation && error.name !== 'AbortError') fail(error); }
      throw error;
    } finally { job.finish(); }
  }
  // Abandon only the successor. Keep the current performance, its clock,
  // decoded frame and microphone-independent playback running to a safe exit.
  function cancelQueued() {
    checkLive();
    const pending = queued; queued = null; deferredQueue = null;
    pending?.job?.abort();
    if (handoffJob) {
      handoffJob.abort();
      clearPendingStart(handoffJob);
      // A cancelled play promise can still be unwinding when a recognition
      // repair immediately queues again. Release only that handoff's lock;
      // its late finally must not unlock a newer transition using this slot.
      if (transitionOwner === handoffJob) { transitioning = false; transitionOwner = null; }
      handoffJob = null;
    }
  }
  for (const slot of slots) {
    slot.video.addEventListener('ended', () => {
      if (pendingStart?.record.slot === slot && pendingStart.record.version === slot.version) { pendingStart.record.ended = true; slot.video.pause(); slot.video.muted = true; return; }
      const record = active;
      if (!record || record.slot !== slot || record.version !== slot.version || paused || disposed || record.ended) return;
      record.ended = true; stopWatch(slot); slot.video.pause(); slot.video.muted = true;
      emit(queued ? 'waiting' : 'ended'); onEnded({ id: record.clip.id, loop: record.loop, queuedId: queued?.clip.id || null });
      if (active !== record || disposed || paused) return;
      if (queued) void consume(queued);
      else if (record.loop) automaticLoop();
    });
    slot.video.addEventListener('error', () => { if (active?.slot === slot && active.version === slot.version && !disposed) fail(mediaError()); });
  }
  async function prepare(ids = manifest?.clips?.slice(0, 2).map((clip) => clip.id)) {
    const requested = Array.isArray(ids) ? [...new Set(ids)] : [], clips = validated(requested);
    if (active) throw filmError('film-busy', '재생 중에는 queue로 다음 영상을 준비해 주세요.');
    invalidate(); paused = false; emit('preparing');
    const job = task(prepareTimeoutMs * clips.length, 'prepare-timeout');
    // Decode all requested files; leave the first two in the two physical slots.
    const order = clips.length > 2 ? [...clips.slice(2), ...clips.slice(0, 2)] : clips;
    try {
      for (let i = 0; i < order.length; i++) await prime(slots[i % 2], order[i], job);
      guard(job); emit('ready'); return { ready: true, decoded: requested, buffered: slots.filter((slot) => slot.primed).map((slot) => slot.id) };
    } catch (error) { if (job.token === generation) fail(error); throw error; }
    finally { job.finish(); }
  }
  async function play(id, options = {}) {
    const [clip] = validated([id]), loop = loopOption(clip, options);
    invalidate(); paused = false; deferredQueue = null; emit('preparing');
    const slot = slots.find((candidate) => candidate !== active?.slot && candidate.id === id && candidate.primed) || slots.find((candidate) => candidate !== active?.slot);
    const job = task(prepareTimeoutMs + startTimeoutMs, 'start-timeout');
    try { await prime(slot, clip, job); guard(job); return await begin(slot, clip, loop, job); }
    catch (error) { if (job.token === generation) fail(error); throw error; }
    finally { job.finish(); }
  }
  function pause() {
    checkLive(); if (paused) return;
    const successor = queued || pendingStart?.record;
    deferredQueue = successor ? { id: successor.clip.id, loop: successor.loop } : null;
    invalidate(); paused = true; emit('paused');
  }
  async function resume() {
    checkLive(); if (!paused) return snapshot();
    const desired = deferredQueue; deferredQueue = null; paused = false;
    if (!active) { if (desired) return play(desired.id, desired); emit('idle'); return null; }
    if (active.ended) { if (desired) await queueClip(desired.id, desired); else automaticLoop(); return snapshot(); }
    const record = active, job = task(startTimeoutMs, 'start-timeout');
    try {
      record.slot.video.muted = record.clip.kind === 'listening';
      await started(record.slot, job); guard(job); emit('playing'); watch(record);
      if (desired) void queueClip(desired.id, desired).catch((error) => { if (error.name !== 'AbortError') fail(error); });
      else automaticLoop();
      return snapshot();
    } catch (error) { if (job.token === generation) fail(error); throw error; }
    finally { job.finish(); }
  }
  function stop() {
    if (disposed) return;
    invalidate(); active = null; paused = false; deferredQueue = null; blend = null; stage.hidden = true;
    for (const slot of slots) { slot.version++; slot.id = null; slot.primed = false; slot.headFrame = null; slot.video.style.opacity = '0'; slot.video.removeAttribute('src'); slot.video.load(); }
    emit('idle');
  }
  function dispose() { if (disposed) return; stop(); disposed = true; stage.remove(); emit('disposed'); }
  // The headset and DOM share the same two decoded video elements. Expose only
  // the drawing state; consumers must use this player's lifecycle controls.
  function getVideos() {
    const progress = blend ? Math.min(1, Math.max(0, (performance.now() - blend.start) / transitionMs)) : 1;
    if (blend && progress === 1) finishBlend();
    const order = blend ? [blend.from, blend.to] : slots;
    const visible = pendingStart?.record || active;
    return order.map((slot) => ({ video: slot.video, opacity: stage.hidden ? 0 : blend ? (slot === blend.to ? progress : 1) : slot === visible?.slot ? 1 : 0 }));
  }
  return Object.freeze({ prepare, play, queue: queueClip, cancelQueued, pause, resume, stop, dispose, getVideos, get current() { return snapshot(); }, get state() { return state; } });
}
