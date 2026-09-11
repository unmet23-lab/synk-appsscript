'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {
  StudioStore,
  problem,
  digest
} = require('./store.cjs');
const core = require('./core.cjs');
const MAX_AUDIO = 20 * 1024 * 1024;
const MIME = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.webp', 'image/webp'], ['.png', 'image/png'], ['.ttf', 'font/ttf'], ['.woff2', 'font/woff2'], ['.json', 'application/json; charset=utf-8'], ['.wav', 'audio/wav']]);
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on('data', b => {
      size += b.length;
      if (size > limit) {
        reject(problem('TOO_LARGE', '파일 크기는 20 MB 이하로 준비해 주세요.', 413));
        req.pause();
      } else parts.push(b);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}
async function jsonBody(req) {
  try {
    return JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
  } catch (e) {
    if (e.status) throw e;
    throw problem('JSON', '요청 내용을 읽을 수 없습니다.');
  }
}
function audioMime(bytes, declared) {
  const mime = String(declared ?? '').split(';')[0].trim();
  const first = bytes.subarray(0, 32);
  let actual;
  if (first.toString('ascii', 0, 4) === 'RIFF' && first.toString('ascii', 8, 12) === 'WAVE') actual = 'audio/wav';else if (first.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) actual = 'audio/webm';else if (first.toString('ascii', 0, 4) === 'OggS') actual = 'audio/ogg';else if (first.toString('ascii', 0, 4) === 'fLaC') actual = 'audio/flac';else if (first.toString('ascii', 4, 8) === 'ftyp') actual = 'audio/mp4';else if (first.toString('ascii', 0, 3) === 'ID3' || first[0] === 255 && (first[1] & 224) === 224) actual = 'audio/mpeg';
  if (!actual || !['audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/mpeg', 'audio/mp3', 'audio/flac', 'video/webm'].includes(mime)) throw problem('AUDIO_TYPE', 'WAV, WebM, MP3, M4A, OGG, FLAC 음성 파일을 사용해 주세요.', 415);
  if (bytes.length < 44) throw problem('EMPTY_AUDIO', '녹음이 너무 짧습니다. 다시 녹음해 주세요.');
  return actual;
}
async function createServer(options = {}) {
  let savedRuntime = {};
  try { savedRuntime = JSON.parse(fs.readFileSync(path.join(__dirname, '.runtime/studio.json'), 'utf8')); } catch {}
  const directory = options.directory ?? process.env.SYNK_STUDIO_DATA ?? savedRuntime.directory ?? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), '.local/share'), 'SYNK', 'patent-studio');
  const store = options.store ?? new StudioStore(directory);
  const token = crypto.randomBytes(32).toString('hex');
  let transcriber = options.transcriber;
  if (!transcriber) {
    try {
      transcriber = require('./resilient-transcriber.cjs').createResilientTranscriber();
    } catch {
      transcriber = {
        status: async () => ({
          available: false,
          reason: '전사 연결을 준비하고 있습니다.'
        }),
        transcribe: async () => {
          throw new Error('TRANSCRIBER_UNAVAILABLE');
        }
      };
    }
  }
  const jobs = new Map();
  let preflightJob = null;
  const publicDir = path.join(__dirname, 'public');
  const send = (res, status, data, extra = {}) => {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra
    });
    res.end(bytes);
  };
  async function transcribeAudio(id, audioRow, {
    force = false, provider
  } = {}) {
    const key = id + ':' + audioRow.event_id;
    if (jobs.has(key)) return jobs.get(key);
    if (!force && audioRow.transcription && JSON.parse(audioRow.transcription).status !== 'pending') return store.get(id);
    const attemptId = crypto.randomUUID();
    const job = (async () => {
      let status;
      try {
        status = await transcriber.status();
        const requestedProvider = provider || status.provider;
        const routeAvailable = requestedProvider === 'auto' ? status.routes?.local?.available || status.routes?.gemini?.available : status.routes?.[requestedProvider]?.available ?? status.available;
        if (requestedProvider === 'manual' || !routeAvailable) {
          store.setTranscription(id, audioRow.event_id, {
            status: 'unavailable',
            attemptId,
            reason: requestedProvider === 'manual' ? '직접 청취 모드입니다. 저장된 원음을 듣고 전사를 입력해 주세요.' : '선택한 자동 전사 경로가 준비되지 않았습니다. 원음은 저장되었습니다.'
          });
          return store.get(id);
        }
        const audio = store.audio(audioRow.sha256);
        const result = await transcriber.transcribe({
          bytes: audio.bytes,
          mimeType: audio.mimeType, ...(provider ? { provider } : {})
        });
        const alternatives = Array.isArray(result.alternatives) && result.alternatives.length ? result.alternatives.map(a => typeof a === 'string' ? {
          text: a
        } : a) : result.text ? [{
          text: result.text
        }] : [];
        if (!alternatives.length) throw new Error('NO_TRANSCRIPT');
        const current = store.get(id);
        const event = {
          id: 'stt:' + audioRow.event_id + ':' + attemptId,
          type: 'transcripts-set',
          role: audioRow.role,
          ...(audioRow.response_id ? {
            responseId: audioRow.response_id
          } : {}),
          alternatives,
          source: 'machine',
          scopeConfirmed: false,
          confirmed: false,
          provider: result.provider,
          model: result.model
        };
        return store.apply(id, current.revision, event, db => {
          store.recordTranscription(id, audioRow.event_id, {
            status: 'ready',
            ...result,
            alternatives,
            completedAt: new Date().toISOString()
          }, db);
        });
      } catch (e) {
        store.setTranscription(id, audioRow.event_id, {
          status: 'failed',
          code: e.code ?? 'TRANSCRIPTION_FAILED',
          ...(e.routeAttempts ? { routeAttempts: e.routeAttempts } : {}),
          reason: '자동 전사를 완료하지 못했습니다. 원음은 저장되어 있으며 직접 듣고 전사를 입력할 수 있습니다.'
        });
        return store.get(id);
      } finally {
        jobs.delete(key);
      }
    })();
    jobs.set(key, job);
    return job;
  }
  async function preflight() {
    if (preflightJob) return preflightJob;
    preflightJob = (async () => {
      const checks = [];
      async function check(id, label, action) {
        const started = performance.now();
        try { const detail = await action(); checks.push({ id, label, status: 'pass', detail, durationMs: Number((performance.now() - started).toFixed(2)) }); }
        catch { checks.push({ id, label, status: 'fail', detail: '이 항목을 준비하지 못했습니다. 준비 안내와 저장 경로를 확인해 주세요.' }); }
      }
      await check('storage', '기록 저장·복원 준비', () => {
        store.db.exec('BEGIN IMMEDIATE; ROLLBACK;');
        const probe = path.join(directory, '.preflight-' + crypto.randomUUID());
        try { fs.writeFileSync(probe, 'SYNK'); if (fs.readFileSync(probe, 'utf8') !== 'SYNK') throw new Error(); }
        finally { if (fs.existsSync(probe)) fs.unlinkSync(probe); }
        return '로컬 DB 연결과 파일 쓰기·읽기를 확인했습니다.';
      });
      await check('assets', '발표 화면·서체·마스코트', () => {
        const assets = JSON.parse(fs.readFileSync(path.join(publicDir, 'assets/manifest.json'), 'utf8'));
        for (const a of assets.manifest) if (digest(fs.readFileSync(path.join(publicDir, 'assets', a.name))) !== a.sha256) throw new Error();
        return `${assets.manifest.length}개 자산의 파일 지문을 확인했습니다.`;
      });
      let sample;
      await check('sample', '준비한 합성 원음', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'samples/manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
        const entry = manifest.files.find(f => f.file === 'original.wav');
        const bytes = fs.readFileSync(path.join(directory, 'samples/original.wav'));
        if (!entry || digest(bytes) !== entry.sha256) throw new Error();
        sample = bytes;
        return '합성 샘플의 바이트와 지문이 일치합니다.';
      });
      await check('local-stt', '인터넷 없이 실제 받아쓰기', async () => {
        if (!sample || !transcriber.preflight) throw new Error();
        const result = await transcriber.preflight(sample);
        if (!result.text || result.raw?.networkAttempts !== 0) throw new Error();
        return `기기 안에서 “${result.text}”를 전사했습니다. 외부 통신 시도 0회. 사람 청취 확인은 별도입니다.`;
      });
      await check('engine', '근거 판단 예제', () => {
        const result = core.evaluate(core.createSession({ id: 'preflight-example', mode: 'example', exampleId: 'particle-ambiguity' }));
        if (result.metrics.accepted !== 1 || result.metrics.held !== 2) throw new Error();
        return '통제 예제에서 1개 반영·2개 보류를 계산했습니다.';
      });
      const result = { ok: checks.every(c => c.status === 'pass'), checkedAt: new Date().toISOString(), checks, transcription: await transcriber.status() };
      fs.writeFileSync(path.join(directory, 'last-preflight.json'), JSON.stringify(result, null, 2));
      return result;
    })().finally(() => { preflightJob = null; });
    return preflightJob;
  }
  const server = http.createServer(async (req, res) => {
    try {
      const host = String(req.headers.host ?? '');
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw problem('HOST', '로컬 주소에서만 열 수 있습니다.', 403);
      const url = new URL(req.url, 'http://' + host);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (req.headers.origin && req.headers.origin !== 'http://' + host) throw problem('ORIGIN', '같은 작업실에서 보낸 요청만 처리합니다.', 403);
        if (req.headers['x-studio-token'] !== token) throw problem('TOKEN', '작업실을 새로 열어 연결을 확인해 주세요.', 403);
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, {
        ok: true,
        service: 'synk-evidence-studio',
        engineVersion: core.VERSION ?? '1.0.0',
        storage: 'sqlite',
        pendingTranscriptions: jobs.size
      });
      if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
        let speech;
        try {
          speech = await transcriber.status();
        } catch {
          speech = {
            available: false,
            reason: '전사 연결 상태 확인 실패'
          };
        }
        let samples = [];
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'samples/manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
          samples = manifest.files.map(f => ({
            name: f.file,
            label: f.file === 'original.wav' ? '한국어 합성 음성' : f.file === 'unexpected.wav' ? '예상과 다른 합성 응답' : '도움 후 합성 응답',
            url: '/api/samples/' + f.file,
            kind: 'synthetic-speech',
            generator: manifest.generator,
            sha256: f.sha256
          }));
        } catch {}
        return send(res, 200, {
          token,
          examples: core.examples,
          samples,
          capabilities: {
            transcription: speech,
            storage: 'sqlite',
            audioLimitBytes: MAX_AUDIO,
            localOnly: true
          },
          sessions: store.list()
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/preflight') {
        await jsonBody(req);
        return send(res, 200, await preflight());
      }
      if (req.method === 'GET' && /^\/api\/samples\/(original|assisted|unexpected)\.wav$/.test(url.pathname)) {
        const name = path.basename(url.pathname);
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'samples/manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
        const entry = manifest.files.find(f => f.file === name);
        const bytes = fs.readFileSync(path.join(directory, 'samples', name));
        if (!entry || digest(bytes) !== entry.sha256) throw problem('SAMPLE_INTEGRITY', '합성 음성 파일의 지문이 일치하지 않습니다.', 409);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': bytes.length,
          'X-Content-Type-Options': 'nosniff'
        });
        return res.end(bytes);
      }
      if (req.method === 'POST' && url.pathname === '/api/sessions') return send(res, 201, store.create(await jsonBody(req)));
      const match = url.pathname.match(/^\/api\/sessions\/([a-zA-Z0-9-]+)(?:\/(events|audio|transcribe|comparison|export|verification))?$/);
      if (match) {
        const [, id, action] = match;
        if (req.method === 'GET' && !action) return send(res, 200, store.get(id));
        if (req.method === 'GET' && action === 'verification') return send(res, 200, store.verify(id));
        if (req.method === 'POST' && action === 'events') {
          const body = await jsonBody(req);
          const event = body.event;
          if (!event || Object.hasOwn(event, 'payload')) throw problem('EVENT_SHAPE', '사건은 명시된 필드 형식으로 보내 주세요.');
          if (event.type === 'audio-attached' || event.type === 'transcripts-set' && event.source !== 'human') throw problem('SERVER_EVENT', '원음과 기계 전사는 실제 파일 처리 경로에서 기록합니다.');
          if (event.audioRef) {
            if (event.type !== 'response-added' || !event.responseId) throw problem('AUDIO_OCCURRENCE', '새 응답의 실제 녹음 사건이 필요합니다.');
            const occurrence = store.db.prepare("SELECT * FROM session_audio WHERE session_id=? AND role='response' AND response_id=? AND sha256=?").get(id, event.responseId, String(event.audioRef).replace(/^sha256:/, ''));
            if (!occurrence) throw problem('AUDIO_OCCURRENCE', '이 응답에 연결된 실제 녹음이 아닙니다.');
          }
          return send(res, 200, store.apply(id, body.expectedRevision, event));
        }
        if (req.method === 'POST' && action === 'audio') {
          const provider = req.headers['x-transcription-provider'];
          if (provider && !['local', 'gemini', 'vertex', 'auto', 'manual'].includes(provider)) throw problem('TRANSCRIPTION_ROUTE', '받아쓰기 방식을 확인해 주세요.');
          const bytes = await readBody(req, MAX_AUDIO);
          const mimeType = audioMime(bytes, req.headers['content-type']);
          const expectedRevision = Number(req.headers['x-expected-revision']);
          const eventId = String(req.headers['x-event-id'] ?? '');
          if (!eventId) throw problem('EVENT_ID', '녹음 사건 번호가 필요합니다.');
          const state = store.attach(id, expectedRevision, {
            eventId,
            role: url.searchParams.get('role') ?? 'original',
            bytes,
            mimeType,
            acquisition: req.headers['x-capture-method'] ?? 'file',
            captureStartedAt: req.headers['x-capture-started-at'],
            captureEndedAt: req.headers['x-capture-ended-at']
          });
          const row = store.db.prepare('SELECT * FROM session_audio WHERE session_id=? AND event_id=?').get(id, eventId);
          return send(res, 200, await transcribeAudio(state.id, row, { provider }));
        }
        if (req.method === 'POST' && action === 'transcribe') {
          const body = await jsonBody(req);
          if (body.provider && !['local', 'gemini', 'vertex', 'auto', 'manual'].includes(body.provider)) throw problem('TRANSCRIPTION_ROUTE', '받아쓰기 방식을 확인해 주세요.');
          if (store.get(id).revision !== body.expectedRevision) throw problem('STALE_REVISION', '최신 기록을 확인해 주세요.', 409);
          const row = store.audioForSession(id, body.audioRef, body.audioEventId);
          return send(res, 200, await transcribeAudio(id, row, {
            force: true, provider: body.provider
          }));
        }
        if (req.method === 'GET' && action === 'comparison') {
          const s = store.get(id);
          return send(res, 200, {
            sessionId: id,
            revision: s.revision,
            baseline: s.analysis,
            comparisons: s.analysis.comparisons ?? ['no-purpose', 'no-epoch', 'no-target', 'predicted-response'].map(ablation => ({
              ablation,
              ...core.evaluate(s, {
                ablation
              })
            }))
          });
        }
        if (req.method === 'GET' && action === 'export') return send(res, 200, store.export(id), {
          'Content-Disposition': 'attachment; filename="SYNK-evidence-' + id + '.json"'
        });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/audio/')) {
        const audio = store.audio(url.pathname.slice('/api/audio/'.length));
        const total = audio.bytes.length;
        const range = req.headers.range;
        let start = 0,
          end = total - 1,
          status = 200;
        const headers = {
          'Content-Type': audio.mimeType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff'
        };
        if (range) {
          const m = range.match(/^bytes=(\d*)-(\d*)$/);
          if (!m || !m[1] && !m[2]) return send(res, 416, {
            error: '지원하지 않는 재생 범위'
          }, {
            'Content-Range': 'bytes */' + total
          });
          start = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
          end = m[1] && m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
          if (start >= total || start > end) return send(res, 416, {
            error: '재생 범위 초과'
          }, {
            'Content-Range': 'bytes */' + total
          });
          status = 206;
          headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
        }
        headers['Content-Length'] = end - start + 1;
        res.writeHead(status, headers);
        return res.end(audio.bytes.subarray(start, end + 1));
      }
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const pathname = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        const target = path.resolve(publicDir, pathname);
        if (!target.startsWith(publicDir + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) throw problem('NOT_FOUND', '파일을 찾을 수 없습니다.', 404);
        const type = MIME.get(path.extname(target));
        if (!type) throw problem('NOT_FOUND', '파일을 찾을 수 없습니다.', 404);
        const bytes = fs.readFileSync(target);
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': bytes.length,
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'"
        });
        return res.end(bytes);
      }
      throw problem('NOT_FOUND', '요청 경로를 찾을 수 없습니다.', 404);
    } catch (e) {
      if (!res.headersSent) send(res, e.status ?? 400, {
        error: e.status ? e.message : '입력 또는 처리 상태를 확인해 주세요.',
        code: e.code ?? 'INVALID_OPERATION'
      });else res.end();
    }
  });
  return {
    server,
    store,
    token,
    directory,
    close: async () => {
      if (preflightJob) await preflightJob.catch(() => {});
      await Promise.allSettled([...jobs.values()]);
      await transcriber.close?.();
      await new Promise(resolve => server.close(resolve));
      store.close();
    }
  };
}
module.exports = {
  createServer,
  audioMime
};
if (require.main === module) (async () => {
  await require('./assets.cjs').buildAssets();
  const app = await createServer();
  const port = Number(process.env.SYNK_STUDIO_PORT ?? 4318);
  app.server.listen(port, '127.0.0.1', () => console.log(`SYNK 근거 작업실: http://127.0.0.1:${port}\n원음·판정은 로컬 SQLite에 저장됩니다.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.close().then(() => process.exit(0)));
})().catch(e => {
  console.error('작업실 실행 실패: ' + (e.code ?? e.message));
  process.exitCode = 1;
});
