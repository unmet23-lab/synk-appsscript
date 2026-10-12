import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdtemp, open, readFile, rmdir, unlink } from 'node:fs/promises';
import { createServer, parseRange } from '../server.mjs';
import { isPackageRuntime, hostingHeaders, packageInterview, verifyPackage, OUTPUT, ENTRYPOINT } from '../../../tools/package-path-interview.mjs';
const execute = promisify(execFile);

function request(server, pathname, { method = 'GET', headers = {}, secure = false } = {}) {
  return new Promise((resolve, reject) => {
    const transport = secure ? https : http;
    const req = transport.request({ hostname: '127.0.0.1', port: server.address().port, path: pathname, method, headers, ...(secure ? { rejectUnauthorized: false } : {}) }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    req.on('error', reject); req.end();
  });
}

test('Range parsing bounds large media without interpreting multipart or unsafe integers', () => {
  assert.deepEqual(parseRange('bytes=0-15', 100), { start: 0, end: 15 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-20', 100), { start: 80, end: 99 });
  assert.deepEqual(parseRange('bytes=-1000', 100), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=90-1000', 100), { start: 90, end: 99 });
  for (const range of ['bytes=100-', 'bytes=20-10', 'bytes=-0', 'bytes=-', 'bytes=0-2,5-9', 'bytes=9007199254740992-', 'garbage']) assert.equal(parseRange(range, 100), false, range);
  assert.equal(parseRange('bytes=0-', 0), false);
});

test('model GET and HEAD ranges return exact bytes and denied sources stay private', async () => {
  const server = createServer({ port: 0 }); await server.start();
  try {
    const model = '/models/vosk-model-small-ko-0.22.tar.gz';
    const part = await request(server, model, { headers: { Range: 'bytes=0-15' } });
    assert.equal(part.status, 206); assert.equal(part.body.length, 16);
    assert.match(part.headers['content-range'], /^bytes 0-15\/\d+$/);
    assert.equal(part.headers['content-type'], 'application/gzip');
    assert.equal(part.headers['content-encoding'], undefined, 'gzip archive must not be transparently decompressed');
    assert.equal(part.headers['accept-ranges'], 'bytes');
    const handle = await open(new URL('../models/vosk-model-small-ko-0.22.tar.gz', import.meta.url));
    try { const expected = Buffer.alloc(16); await handle.read(expected, 0, 16, 0); assert.deepEqual(part.body, expected); } finally { await handle.close(); }
    const head = await request(server, model, { method: 'HEAD', headers: { Range: 'bytes=-8' } });
    assert.equal(head.status, 206); assert.equal(head.headers['content-length'], '8'); assert.equal(head.body.length, 0);
    const bad = await request(server, model, { headers: { Range: 'bytes=999999999-' } });
    assert.equal(bad.status, 416); assert.match(bad.headers['content-range'], /^bytes \*\/\d+$/);
    for (const denied of ['/server.mjs', '/models/fixtures/interview-ko.wav', '/models/fixtures/verification.json', '/tests/interview-voice.test.mjs', '/.env', '/account.config.json', '/%2e%2e%2ftools/package-path-interview.mjs']) assert.equal((await request(server, denied)).status, 404, denied);
    assert.equal((await request(server, '/interview/', { method: 'POST' })).status, 405);
    assert.equal((await request(server, '/interview/', { headers: { Host: 'evil.example' } })).status, 403);
    assert.equal((await request(server, '/interview/', { headers: { Host: 'localhost.evil.example' } })).status, 403);
    assert.equal((await request(server, '/interview/production/seedance-shot-plan.json')).status, 404);
    const preview = await request(server, '/interview/film/');
    assert.equal(preview.status, 200); assert.match(preview.headers['content-type'], /text\/html/);
    const reference = await request(server, '/assets/interview/film/room-reference.png', { method: 'HEAD' });
    assert.equal(reference.status, 200); assert.equal(reference.headers['content-type'], 'image/png');
    assert.equal((await request(server, '/assets/interview/film/question-motivation.mp4')).status, 404, 'planned film must not resolve to the reference image');
    assert.equal((await request(server, '/interview/film/compare.html')).status, 200);
    assert.equal((await request(server, '/interview/film/nanobanana.html')).status, 200);
    for (const name of ['rehearsal.html', 'rehearsal.css', 'rehearsal.mjs', 'rehearsal-session.mjs', 'answer-followup.mjs', 'listening-sequence.mjs', 'strict-vr.mjs', 'room-space.mjs', 'speech-turn.mjs', 'strict-manifest.json']) assert.equal((await request(server, '/interview/film/' + name)).status, 200, name);
    const usbEntry = await request(server, ENTRYPOINT, { headers: { Host: 'localhost:4293' } });
    assert.equal(usbEntry.status, 200, 'ADB reverse uses the localhost Host header without a LAN exception');
    assert.match(usbEntry.headers['permissions-policy'], /microphone=\(self\)/);
    assert.equal((await request(server, '/interview/production/strict-interview.json')).status, 404);
    const nanoReference = await request(server, '/assets/interview/film/room-reference-nanobanana.jpg', { method: 'HEAD' });
    assert.equal(nanoReference.status, 200); assert.equal(nanoReference.headers['content-type'], 'image/jpeg');
    const backWall = await request(server, '/assets/interview/room/back-wall-photo.png', { method: 'HEAD' });
    assert.equal(backWall.status, 200); assert.equal(backWall.headers['content-type'], 'image/png');
    const frontRoom = await request(server, '/assets/interview/room/front-room-extension.png', { method: 'HEAD' });
    assert.equal(frontRoom.status, 200); assert.equal(frontRoom.headers['content-type'], 'image/png');
    assert.equal((await request(server, '/assets/interview/room/front-room-wide.png', { method: 'HEAD' })).status, 200);
    for (const side of ['left', 'right']) {
      const wall = await request(server, '/assets/interview/room/' + side + '-wall-photo.png', { method: 'HEAD' });
      assert.equal(wall.status, 200); assert.equal(wall.headers['content-type'], 'image/png');
    }
    assert.equal((await request(server, '/interview/production/side-wall-photographs.json')).status, 404);
    assert.equal((await request(server, '/interview/production/front-room-extension.json')).status, 404);
    assert.equal((await request(server, '/interview/production/back-wall-photo.json')).status, 404);
    for (const name of ['seedance-sample.mp4', 'wan-sample.mp4', 'seedance-nanobanana-sample.mp4', 'strict-question.mp4', 'strict-listening.mp4', 'strict-followup-experience.mp4', 'strict-followup-plan.mp4']) {
      const part = await request(server, '/assets/interview/film/' + name, { headers: { Range: 'bytes=0-31' } });
      assert.equal(part.status, 206); assert.equal(part.headers['content-type'], 'video/mp4');
      assert.equal(part.body.length, 32); assert.equal(part.body.subarray(4, 8).toString(), 'ftyp');
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('page and WASM worker CSP remain separate; GLB blob images and device permissions work', async () => {
  const server = createServer({ port: 0 }); await server.start();
  try {
    const page = await request(server, '/interview/', { method: 'HEAD' });
    const worker = await request(server, '/vendor/vosk/vosk-worker.js', { method: 'HEAD' });
    assert.equal(page.status, 200); assert.equal(worker.status, 200);
    assert.match(page.headers['content-security-policy'], /script-src 'self' 'wasm-unsafe-eval'/);
    assert.doesNotMatch(page.headers['content-security-policy'], /(?:^|\s)'unsafe-eval'(?:;|\s)/);
    assert.match(worker.headers['content-security-policy'], /script-src 'self' 'unsafe-eval'/);
    assert.match(page.headers['content-security-policy'], /connect-src [^;]*blob:/);
    assert.match(page.headers['permissions-policy'], /microphone=\(self\)/);
    assert.match(page.headers['permissions-policy'], /xr-spatial-tracking=\(self\)/);
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('Whisper serves exact WASM and ONNX ranges under strict worker CSP without exposing alternate or test assets', async () => {
  const server = createServer({ port: 0 }); await server.start();
  try {
    const wasm = '/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm';
    const part = await request(server, wasm, { headers: { Range: 'bytes=0-7' } });
    assert.equal(part.status, 206); assert.equal(part.headers['content-type'], 'application/wasm');
    assert.deepEqual([...part.body], [0, 97, 115, 109, 1, 0, 0, 0]);
    assert.equal(part.headers['content-encoding'], undefined);
    for (const file of ['interview/whisper-model.mjs', 'interview/whisper-worker.mjs', 'vendor/transformers/transformers.min.js', 'vendor/transformers/ort-wasm-simd-threaded.jsep.mjs']) {
      const result = await request(server, '/' + file, { method: 'HEAD' });
      assert.equal(result.status, 200, file);
      assert.match(result.headers['content-type'], /javascript/);
      assert.match(result.headers['content-security-policy'], /script-src 'self' 'wasm-unsafe-eval'/);
      assert.doesNotMatch(result.headers['content-security-policy'], /(?:^|\s)'unsafe-eval'(?:;|\s)/);
      assert.match(result.headers['content-security-policy'], /worker-src 'self'/);
    }
    for (const file of ['encoder_model_quantized.onnx', 'decoder_model_merged_quantized.onnx']) {
      const relative = 'models/whisper-base/onnx/' + file;
      const result = await request(server, '/' + relative, { headers: { Range: 'bytes=0-15' } });
      assert.equal(result.status, 206); assert.equal(result.headers['content-type'], 'application/octet-stream');
      const handle = await open(new URL('../' + relative, import.meta.url));
      try { const expected = Buffer.alloc(16); await handle.read(expected, 0, 16, 0); assert.deepEqual(result.body, expected); }
      finally { await handle.close(); }
    }
    for (const name of ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json']) {
      const result = await request(server, '/models/whisper-base/' + name, { method: 'HEAD' });
      assert.equal(result.status, 200); assert.match(result.headers['content-type'], /application\/json/);
    }
    for (const denied of ['/models/whisper-base/fixture.wav', '/models/whisper-base/private.json', '/models/whisper-base/onnx/encoder_model.onnx', '/models/whisper-tiny/config.json', '/vendor/transformers/transformers.min.js.map']) {
      assert.equal((await request(server, denied)).status, 404, denied);
      assert.equal(isPackageRuntime(denied.slice(1)), false, denied);
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('LAN mode requires an explicit host allowlist and real TLS configuration', () => {
  assert.throws(() => createServer({ host: '0.0.0.0', port: 0 }), /TLS/);
  assert.throws(() => createServer({ host: '0.0.0.0', port: 0, allowedHosts: ['quest.local'] }), /TLS/);
  assert.throws(() => createServer({ host: '0.0.0.0', port: 0, tls: { key: 'test', cert: 'test' } }), /allowedHosts/);
});

test('HTTPS serves the allowed Quest host while rejecting another host', async (context) => {
  const openssl = process.env.OPENSSL_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : '/usr/bin/openssl');
  try { await access(openssl); } catch { context.skip('OpenSSL is needed only to generate an ephemeral test certificate'); return; }
  const folder = await mkdtemp(path.join(os.tmpdir(), 'synk-interview-tls-test-'));
  const key = path.join(folder, 'test-key.pem'), cert = path.join(folder, 'test-cert.pem');
  let server;
  try {
    await execute(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=quest.test', '-addext', 'subjectAltName=DNS:quest.test,IP:127.0.0.1']);
    server = createServer({ port: 0, host: '0.0.0.0', tls: { key: await readFile(key), cert: await readFile(cert) }, allowedHosts: ['quest.test'] });
    await server.start();
    const good = await request(server, '/interview/', { secure: true, headers: { Host: 'quest.test' } });
    assert.equal(good.status, 200); assert.match(good.body.toString(), /SYNK PATH/);
    assert.equal((await request(server, '/interview/', { secure: true, headers: { Host: 'unapproved.test' } })).status, 403);
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    // Only known ephemeral test files; no recursive removal or system trust changes.
    await unlink(key).catch(() => {}); await unlink(cert).catch(() => {}); await rmdir(folder);
  }
});

test('static export selection rejects private tools, fixtures, raw WAV and configuration even if source server lists them', () => {
  for (const included of ['interview/film/index.html', 'interview/film/preview.mjs', 'interview/film/compare.html', 'interview/film/compare.css', 'interview/film/compare.mjs', 'interview/film-manifest.json', 'interview/film-player.mjs', 'assets/interview/film/room-reference.png', 'assets/interview/film/question-motivation.mp4', 'assets/interview/film/seedance-sample.mp4', 'assets/interview/film/wan-sample.mp4']) assert.equal(isPackageRuntime(included), true, included);
  for (const included of ['interview/film/nanobanana.html', 'assets/interview/film/room-reference-nanobanana.jpg', 'assets/interview/film/seedance-nanobanana-sample.mp4']) assert.equal(isPackageRuntime(included), true, included);
  for (const included of ['interview/film/rehearsal.html', 'interview/film/rehearsal.mjs', 'interview/film/rehearsal-session.mjs', 'interview/film/rehearsal.css', 'interview/film/strict-manifest.json', 'interview/film/strict-vr.mjs', 'interview/film/room-space.mjs', 'interview/film/speech-turn.mjs', 'assets/interview/film/strict-listening.mp4']) assert.equal(isPackageRuntime(included), true, included);
  for (const excluded of ['interview/production/seedance-shot-plan.json', 'interview/production/back-wall-photo.json', 'assets/interview/film/private.mp4', 'assets/interview/film/fixture.webm', 'assets/interview/film/prompt.txt']) assert.equal(isPackageRuntime(excluded), false, excluded);
  for (const included of ['interview/app.mjs', 'vendor/HDRLoader.js', 'vendor/vosk/vosk-worker.js', 'models/vosk-model-small-ko-0.22.tar.gz', 'assets/interview/audio/intro.mp3', 'assets/interview/actors/Business_Male_02.glb', 'assets/interview/audio/MODEL-LICENSE.txt', 'assets/interview/audio/INFERENCE-CODE-LICENSE.txt', 'assets/interview/room/wood_table_001_diff_1k.jpg', 'assets/interview/room/brown_photostudio_02_1k.hdr', 'assets/interview/room/back-wall-photo.png']) assert.equal(isPackageRuntime(included), true, included);
  for (const excluded of ['server.mjs', '../.env', '/interview/app.mjs', 'assets\\interview\\audio\\intro.mp3', 'tools/prepare-interview-speech.py', 'models/fixtures/interview-ko.wav', 'assets/interview/audio/intro.wav', 'assets/interview/audio/asr-verification.json', 'assets/interview/audio/config.json', 'assets/interview/room/token.jpg']) assert.equal(isPackageRuntime(excluded), false, excluded);
});

test('hosting file grants unsafe-eval to the worker only without overlapping wildcard CSP', () => {
  const headers = hostingHeaders(['index.html', 'interview/index.html', 'interview/app.mjs', 'vendor/vosk/vosk-worker.js', 'interview/whisper-worker.mjs', 'vendor/transformers/ort-wasm-simd-threaded.jsep.wasm', 'models/whisper-base/onnx/encoder_model_quantized.onnx']);
  const common = headers.split('\n\n')[0];
  assert.doesNotMatch(common, /Content-Security-Policy:/);
  const blocks = headers.split('\n\n').filter((block) => block.includes("'unsafe-eval'"));
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /^\/vendor\/vosk\/vosk-worker\.js\n/);
  assert.match(headers, /\/interview\/\n  Content-Security-Policy:/);
  assert.match(headers, /\/interview\/film\/\n  Content-Security-Policy:/);
  assert.match(headers, /Content-Type: text\/javascript/);
  assert.match(headers, /\/vendor\/transformers\/ort-wasm-simd-threaded\.jsep\.wasm\n  Content-Security-Policy: [^\n]*'wasm-unsafe-eval'[^\n]*\n  Content-Type: application\/wasm/);
  assert.match(headers, /\/models\/whisper-base\/onnx\/encoder_model_quantized\.onnx\n[^\n]*\n  Content-Type: application\/octet-stream/);
});

test('standalone package copies current runtime exactly, keeps credit files, and excludes private artifacts', async () => {
  const output = await packageInterview();
  const verified = await verifyPackage();
  assert.equal(output.deployed, false);
  assert.ok(output.totalBytes > 89_103_045, 'model and runtime are bundled together');
  assert.equal(verified.excludedArtifacts, 0);
  assert.ok(verified.sourceCompared > 40, 'all runtime files are compared with current sources');
  assert.ok(verified.creditFilesPresent >= 10, 'credit links resolve inside the bundle');
  assert.equal(verified.licenses, 14);
  const manifest = JSON.parse(await readFile(path.join(OUTPUT, '_package-manifest.json'), 'utf8'));
  assert.equal(manifest.entrypoint, ENTRYPOINT);
  assert.equal(manifest.legacyEntrypoint, '/interview/');
  const root = await readFile(path.join(OUTPUT, 'index.html'), 'utf8');
  assert.ok(root.includes('0;url=.' + ENTRYPOINT));
  assert.ok(root.includes('href=".' + ENTRYPOINT + '"'));
  for (const runtime of ['interview/index.html', 'interview/film/rehearsal.html', 'interview/film/room-space.mjs', 'interview/film/speech-turn.mjs', 'assets/interview/room/back-wall-photo.png']) assert.ok(manifest.files.some((item) => item.file === runtime), runtime);
  for (const runtime of ['interview/whisper-model.mjs', 'interview/whisper-worker.mjs', 'vendor/transformers/ort-wasm-simd-threaded.jsep.wasm', 'models/whisper-base/config.json', 'models/whisper-base/tokenizer_config.json', 'models/whisper-base/onnx/encoder_model_quantized.onnx', 'models/whisper-base/onnx/decoder_model_merged_quantized.onnx']) assert.ok(manifest.files.some((item) => item.file === runtime), runtime);
  const hosting = await readFile(path.join(OUTPUT, 'HOSTING.txt'), 'utf8');
  assert.ok(hosting.includes(ENTRYPOINT));
  assert.match(hosting, /adb reverse tcp:4293 tcp:4293/);
  assert.match(hosting, /HTTP Range/);
});
