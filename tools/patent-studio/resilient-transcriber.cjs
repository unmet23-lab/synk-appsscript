'use strict';

const { createTranscriber } = require('./transcriber.cjs');
const { createLocalTranscriber } = require('./local-transcriber.cjs');
const MODES = new Set(['local', 'gemini', 'vertex', 'auto', 'manual']);
const fail = code => Object.assign(new Error('음성 인식 경로를 확인해 주세요. 원음은 보존됩니다.'), { code });

function createResilientTranscriber({ env = process.env, local = createLocalTranscriber(), cloud, timeoutMs = 30000 } = {}) {
  const mode = env.SYNK_PATENT_STT_PROVIDER || 'local';
  const remoteProvider = mode === 'vertex' ? 'vertex' : 'gemini';
  cloud ??= createTranscriber({ env: { ...env, SYNK_PATENT_STT_PROVIDER: remoteProvider }, timeoutMs });
  let last = null;
  async function status() {
    const [localState, cloudState] = await Promise.all([local.status(), cloud.status()]);
    const selected = mode === 'auto' ? (cloudState.available ? cloudState : localState) : mode === 'local' ? localState : cloudState;
    const available = MODES.has(mode) && mode !== 'manual' && (mode === 'auto' ? localState.available || cloudState.available : selected.available);
    return { available, provider: mode, model: mode === 'manual' ? 'manual-listening' : selected.model,
      offline: mode === 'local' || mode === 'manual', reason: last ? last.ok ? 'last_request_succeeded' : 'last_request_failed' : mode === 'manual' ? 'manual_selected' : selected.reason,
      routes: { local: localState, [remoteProvider]: cloudState, manual: { available: true, provider: 'manual', offline: true } } };
  }
  async function transcribe({ bytes, mimeType, provider = mode } = {}) {
    if (!MODES.has(provider) || provider === 'manual' || (provider === 'gemini' || provider === 'auto') && remoteProvider !== 'gemini' || provider === 'vertex' && remoteProvider !== 'vertex') throw fail('TRANSCRIBER_UNAVAILABLE');
    const frozen = Buffer.from(bytes || []), attempts = [];
    const invoke = async (adapter, name) => {
      const started = performance.now();
      try {
        const result = await adapter.transcribe({ bytes: Buffer.from(frozen), mimeType });
        attempts.push({ provider: name, outcome: 'succeeded', durationMs: Number((performance.now() - started).toFixed(2)) });
        return result;
      } catch (e) {
        attempts.push({ provider: name, outcome: 'failed', code: e.code || 'TRANSCRIPTION_FAILED', httpStatus: e.httpStatus || null, durationMs: Number((performance.now() - started).toFixed(2)) });
        throw e;
      }
    };
    try {
      let result;
      if (provider === 'local') result = await invoke(local, 'local');
      else if (provider === 'auto') {
        try { result = await invoke(cloud, remoteProvider); }
        catch { result = await invoke(local, 'local'); }
      } else result = await invoke(cloud, remoteProvider);
      last = { ok: true };
      return { ...result, raw: { ...result.raw, selectedRoute: provider, routeAttempts: attempts } };
    } catch (e) { last = { ok: false }; e.routeAttempts = attempts; throw e; }
  }
  async function warmup() { return local.warmup ? local.warmup() : local.status(); }
  async function preflight(bytes) {
    await warmup();
    return transcribe({ bytes, mimeType: 'audio/wav', provider: 'local' });
  }
  async function close() { await local.close?.(); }
  return { status, transcribe, warmup, preflight, close };
}
module.exports = { createResilientTranscriber, MODES };
