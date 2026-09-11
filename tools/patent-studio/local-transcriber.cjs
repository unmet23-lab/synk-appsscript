'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const SETTINGS = Object.freeze({ language: 'ko', device: 'cpu', computeType: 'int8', beamSize: 5,
  temperature: 0, conditionOnPreviousText: false, vadFilter: false, initialPrompt: null, prefix: null });
const problem = code => Object.assign(new Error('로컬 음성 인식을 완료하지 못했습니다. 원음은 보존됩니다.'), { code });

function createLocalTranscriber({ configPath = path.join(__dirname, '.runtime/local-stt.json'), timeoutMs = 90000 } = {}) {
  let worker = null, ready = null, metadata = null, last = null, config = null;
  const pending = new Map();
  function configuration() {
    try {
      const c = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!path.isAbsolute(c.python) || !path.isAbsolute(c.modelPath) || !fs.existsSync(c.python)
        || !['model.bin', 'tokenizer.json', 'config.json'].every(n => fs.existsSync(path.join(c.modelPath, n)))) return null;
      return c;
    } catch { return null; }
  }
  async function status() {
    const c = configuration();
    return { available: !!c, provider: 'local', model: c?.modelId || 'faster-whisper-small',
      reason: !c ? 'local_runtime_missing' : last?.ok ? 'last_request_succeeded' : last ? 'last_request_failed' : metadata ? 'model_loaded' : 'configured_not_probed',
      offline: true, loaded: !!metadata, ...(metadata ? { runtime: metadata } : {}) };
  }
  function failAll(code) {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(problem(code)); }
    pending.clear();
  }
  function ensureReady() {
    if (ready) return ready;
    config = configuration();
    if (!config) return Promise.reject(problem('LOCAL_RUNTIME_MISSING'));
    ready = new Promise((resolve, reject) => {
      let settled = false;
      const failReady = code => { if (!settled) { settled = true; clearTimeout(timer); reject(problem(code)); } };
      const timer = setTimeout(() => { failReady('LOCAL_MODEL_TIMEOUT'); worker?.kill(); }, timeoutMs);
      worker = spawn(config.python, ['-u', path.join(__dirname, 'local-stt-worker.py'), config.modelPath],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, HF_HUB_OFFLINE: '1', PYTHONIOENCODING: 'utf-8' } });
      worker.stderr.on('data', () => {}); // Never expose arbitrary dependency output to the UI.
      worker.stdin.on('error', () => failAll('LOCAL_WORKER_WRITE'));
      readline.createInterface({ input: worker.stdout }).on('line', line => {
        let message;
        try { message = JSON.parse(line); } catch { return; }
        if (message.type === 'ready') {
          if (!Array.isArray(config.files) || JSON.stringify(message.modelFiles) !== JSON.stringify(config.files)) {
            failReady('LOCAL_MODEL_FINGERPRINT_MISMATCH'); worker?.kill(); return;
          }
          settled = true; clearTimeout(timer); metadata = message; resolve(metadata); return;
        }
        if (message.type === 'fatal') { failReady(message.code); worker?.kill(); return; }
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id); clearTimeout(task.timer);
        if (message.type === 'result') task.resolve(message); else task.reject(problem('LOCAL_TRANSCRIPTION_FAILED'));
      });
      worker.once('error', () => { failReady('LOCAL_WORKER_START_FAILED'); failAll('LOCAL_WORKER_START_FAILED'); });
      const child = worker;
      child.once('close', () => { failReady('LOCAL_WORKER_EXIT'); if (worker === child) { failAll('LOCAL_WORKER_EXIT'); worker = null; ready = null; metadata = null; } });
    });
    return ready;
  }
  async function warmup() { await ensureReady(); return status(); }
  async function transcribe({ bytes, mimeType } = {}) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 20 * 1024 * 1024) throw problem('INVALID_AUDIO');
    const copy = Buffer.from(bytes), sha = crypto.createHash('sha256').update(copy).digest('hex');
    await ensureReady();
    const id = crypto.randomUUID();
    const request = { id, audioSha256: sha, audioBase64: copy.toString('base64') };
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(problem('LOCAL_TRANSCRIPTION_TIMEOUT')); worker?.kill(); }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        worker.stdin.write(JSON.stringify(request) + '\n', error => { if (error) { clearTimeout(timer); pending.delete(id); reject(problem('LOCAL_WORKER_WRITE')); } });
      });
      if (result.audioSha256 !== sha || result.networkAttempts !== 0) throw problem('LOCAL_EVIDENCE_MISMATCH');
      last = { ok: true };
      return { text: result.text, alternatives: result.text ? [{ text: result.text }] : [], provider: 'local', model: config.modelId,
        raw: { request: { audioSha256: sha, audioRef: 'sha256:' + sha, audioBytes: copy.length, mimeType,
          settings: SETTINGS, modelFingerprint: config.modelFingerprint, workerSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'local-stt-worker.py'))).digest('hex') },
          response: result, runtime: metadata, alternativesKind: 'single_decoder_result', coverage: 'not_complete', needsHumanVerification: true,
          offline: true, networkAttempts: result.networkAttempts } };
    } catch (e) { last = { ok: false }; throw e; }
  }
  async function close() {
    if (!worker) return;
    const child = worker;
    await new Promise(resolve => { child.once('close', resolve); child.stdin.end(); const timer = setTimeout(() => child.kill(), 1500); timer.unref(); });
  }
  return { status, warmup, transcribe, close };
}
module.exports = { createLocalTranscriber, SETTINGS };
