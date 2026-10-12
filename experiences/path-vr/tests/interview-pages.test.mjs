import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile, unlink, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PAGES_OUTPUT, PAGES_CSP, pagesDocument, pagesRuntimeFile, preparePagesInterview, verifyPagesInterview } from '../../../tools/package-path-interview.mjs';
import { evaluateFilmReadiness, resolveFilmClipUrl } from '../interview/film-player.mjs';
import { CLIPS, selectRehearsalMedia } from '../interview/film/rehearsal-session.mjs';
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const sourceRoot = path.join(repo, 'experiences/path-vr');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const missing = async (file) => { await assert.rejects(access(file), { code: 'ENOENT' }); };

test('Pages meta policy precedes resource loading and does not grant parent eval', () => {
  const input = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="a.css"></head><body><script type="module" src="app.mjs"></script></body></html>';
  const output = pagesDocument(input);
  assert.ok(output.indexOf('Content-Security-Policy') > output.indexOf('charset="utf-8"'));
  assert.ok(output.indexOf('Content-Security-Policy') < output.indexOf('<link'));
  assert.match(output, /name="referrer" content="no-referrer"/);
  assert.match(PAGES_CSP, /worker-src 'self'/);
  assert.match(PAGES_CSP, /'wasm-unsafe-eval'/);
  assert.doesNotMatch(PAGES_CSP, /(?:^|\s)'unsafe-eval'|frame-ancestors/);
  assert.equal(output.replace(/<meta http-equiv="Content-Security-Policy"[^>]*><meta name="referrer"[^>]*>/, ''), input);
});

test('Pages transform refuses ambiguous or pre-existing policy and development pages', () => {
  for (const input of ['<html></html>', '<head></head>', '<head><script src="x"></script><meta charset="utf-8"></head>', '<head><meta charset="utf-8"></head><head></head>']) assert.throws(() => pagesDocument(input));
  assert.throws(() => pagesDocument('<head><meta charset="utf-8"><meta name="referrer" content="origin"></head>'), /already declares/);
  assert.throws(() => pagesDocument('<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src *"></head>'), /already declares/);
  assert.throws(() => pagesRuntimeFile('interview/film/nanobanana.html', Buffer.from('')), /Not part/);
  assert.throws(() => pagesRuntimeFile('index.html', Buffer.from('')), /Not part/);
});

test('public manifest preserves exact continuity, clip hashes and both qualities', async () => {
  const source = await readFile(path.join(sourceRoot, 'interview/film/strict-manifest.json'));
  const original = JSON.parse(source), { data, transform } = pagesRuntimeFile('interview/film/strict-manifest.json', source), manifest = JSON.parse(data);
  assert.equal(transform, 'public-runtime-video-manifest-v1');
  assert.equal(evaluateFilmReadiness(manifest, Object.values(CLIPS)).ready, true);
  assert.match(manifest.notice, /생성 영상·이미지/);
  assert.match(manifest.notice, /720p.*4K/);
  assert.deepEqual(Object.keys(manifest.source), ['status', 'provider']);
  assert.equal(manifest.continuityReview, undefined);
  assert.equal(manifest.followupAvailability, undefined);
  assert.equal(manifest.listeningVariation, undefined);
  assert.doesNotMatch(data.toString(), /Higgsfield|Seedance|validationScope|sourceRangeSeconds|fullDecodePassed/i);
  for (const quality of ['4k', '720p']) {
    const selected = selectRehearsalMedia(manifest, quality);
    assert.equal(evaluateFilmReadiness(selected, Object.values(CLIPS)).ready, true);
  }
  for (const clip of manifest.clips) {
    const old = original.clips.find((row) => row.id === clip.id);
    for (const key of ['src', 'sha256', 'dialogue', 'answerStartSeconds', 'speechEndSeconds', 'safeExitWindowsSeconds', 'playbackStartSeconds']) assert.deepEqual(clip[key], old[key], key);
    for (const quality of ['4k', '720p']) assert.equal(clip.variants[quality].sha256, old.variants[quality].sha256);
    for (const key of ['headHoldMs', 'tailHoldMs', 'validated']) assert.equal(clip.transition[key], old.transition[key]);
  }
});

test('Pages overlay is minimal, deterministic and source-audited', async () => {
  const first = await preparePagesInterview(), reportBytes = await readFile(first.manifest), report = JSON.parse(reportBytes);
  const verification = await verifyPagesInterview();
  assert.equal(verification.checksumFiles, first.files);
  assert.equal(verification.transformedDocuments, 2);
  assert.equal(verification.preservedIntroduction, true);
  assert.equal(first.deployed, false);
  assert.equal(report.entrypoint, '/path/interview/film/rehearsal.html');
  assert.ok(report.payloadBytes < 300_000_000, 'existing media, legacy Vosk and one selected Whisper model stay bounded');
  const published = new Set(report.files.map((row) => row.file));
  for (const file of ['path/index.html', 'path/_headers', 'path/HOSTING.txt', 'path/_package-manifest.json', 'path/pages-manifest.json', 'path/interview/index.html', 'path/interview/film/compare.html', 'path/interview/film/nanobanana.html', 'path/interview/credits.json', 'path/models/speech-assets.json']) {
    assert.equal(published.has(file), false, file);
    await missing(path.join(first.publicDirectory, file));
  }
  assert.equal(report.files.filter((row) => /\.mp4$/.test(row.file)).length, 14);
  assert.equal(report.files.filter((row) => /\.html$/.test(row.file)).length, 1);
  for (const file of ['path/vendor/THREE-LICENSE.txt', 'path/vendor/vosk/LICENSE.txt', 'path/vendor/vosk/NOTICE.txt', 'path/models/LICENSE-vosk-model.txt', 'path/assets/licenses/SUIT-OFL.txt', 'path/assets/licenses/DMMono-OFL.txt']) assert.ok(published.has(file), file);
  for (const file of ['interview/whisper-model.mjs', 'interview/whisper-worker.mjs', 'vendor/transformers/transformers.min.js', 'vendor/transformers/ort-wasm-simd-threaded.jsep.mjs', 'vendor/transformers/ort-wasm-simd-threaded.jsep.wasm', 'vendor/transformers/LICENSE-TRANSFORMERS.txt', 'vendor/transformers/LICENSE-ONNXRUNTIME.txt', 'models/whisper-base/LICENSE-WHISPER.txt', 'models/whisper-base/PROVENANCE.json', 'models/whisper-base/config.json', 'models/whisper-base/tokenizer_config.json', 'models/whisper-base/onnx/encoder_model_quantized.onnx', 'models/whisper-base/onnx/decoder_model_merged_quantized.onnx']) assert.ok(published.has('path/' + file), file);
  for (const file of ['models/whisper-base/fixture.wav', 'models/whisper-base/onnx/encoder_model.onnx', 'models/whisper-tiny/config.json', 'vendor/transformers/transformers.min.js.map']) {
    assert.equal(published.has('path/' + file), false, file);
    assert.throws(() => pagesRuntimeFile(file, Buffer.from('')), /Not part/);
  }
  for (const row of report.files) {
    assert.ok(row.bytes < 100 * 1024 * 1024, row.file);
    assert.equal(sha(await readFile(path.join(repo, row.source))), row.sourceSHA256);
    const output = await readFile(path.join(first.publicDirectory, row.file));
    assert.equal(sha(output), row.sha256);
    if (row.transform === 'byte-copy') assert.equal(row.sourceSHA256, row.sha256);
    if (/\.(?:md|txt)$/.test(row.file)) assert.doesNotMatch(output.toString(), /^---(?:\r?\n|$)/, 'Jekyll front matter would replace the raw public URL: ' + row.file);
    if (/\.(?:html|mjs|js|json|txt)$/.test(row.file)) assert.doesNotMatch(output.toString(), /Higgsfield|Seedance|nano.?banana|edge-tts/i, row.file);
  }
  const html = await readFile(path.join(first.publicDirectory, report.entrypoint.slice(1)), 'utf8');
  assert.match(html, /href="\/path\/"/);
  assert.match(html, /생성 영상/);
  assert.doesNotMatch(html, /nanobanana|기존 3D|영상 비교|추가 질문 영상 제작은 보류/);
  const workerModule = await readFile(path.join(first.publicDirectory, 'path/vendor/vosk/vosk.mjs'), 'utf8');
  assert.match(workerModule, /new Worker\(new URL\('\.\/vosk-worker\.js', import\.meta\.url\)\)/);
  const manifest = JSON.parse(await readFile(path.join(first.publicDirectory, 'path/interview/film/strict-manifest.json')));
  for (const clip of manifest.clips) for (const media of [clip, ...Object.values(clip.variants)]) {
    const url = resolveFilmClipUrl(media.src, { moduleUrl: 'https://synk.im/path/interview/film-player.mjs', pageUrl: 'https://synk.im/path/interview/film/rehearsal.html' });
    assert.ok(published.has(new URL(url).pathname.slice(1)), media.src);
  }
  const second = await preparePagesInterview();
  assert.equal(second.manifestSHA256, first.manifestSHA256);
  assert.deepEqual(await readFile(second.manifest), reportBytes);
});

test('Pages rebuild refuses to overwrite an unexpected PATH introduction', async () => {
  const target = path.join(PAGES_OUTPUT, 'public/path/index.html');
  const marker = 'Existing PATH introduction must remain untouched';
  await writeFile(target, marker, { flag: 'wx' });
  try {
    await assert.rejects(preparePagesInterview(), /Preserving an unrecognized Pages file/);
    assert.equal(await readFile(target, 'utf8'), marker);
  } finally { await unlink(target); }
  assert.equal((await verifyPagesInterview()).preservedIntroduction, true);
});

test('published imports, stylesheet URLs and fixed room textures resolve inside the minimal overlay', async () => {
  const report = JSON.parse(await readFile(path.join(PAGES_OUTPUT, 'pages-manifest.json'))), files = new Set(report.files.map((row) => row.file));
  function present(ref, from) {
    const url = new URL(ref, 'https://synk.im/' + from);
    if (url.pathname === '/path/') return;
    assert.equal(url.origin, 'https://synk.im');
    if (url.pathname.endsWith('/')) {
      assert.ok([...files].some((file) => file.startsWith(url.pathname.slice(1))), `${from} -> ${ref}`);
      return;
    }
    assert.ok(files.has(url.pathname.slice(1)), `${from} -> ${ref}`);
  }
  for (const row of report.files.filter((row) => /\.(?:html|mjs|js|css)$/.test(row.file))) {
    const text = await readFile(path.join(PAGES_OUTPUT, 'public', row.file), 'utf8');
    if (/\.(?:mjs|js)$/.test(row.file)) {
      for (const match of text.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) present(match[1], row.file);
      for (const match of text.matchAll(/new URL\(['"](\.{1,2}\/[^'"]+)['"],\s*import\.meta\.url\)/g)) present(match[1], row.file);
    }
    if (row.file.endsWith('.html')) for (const match of text.matchAll(/(?:href|src)="([^"]+)"/g)) present(match[1], row.file);
    if (row.file.endsWith('.css')) for (const match of text.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) present(match[1], row.file);
    if (row.file.endsWith('/room-space.mjs')) for (const match of text.matchAll(/['"]((?:room|film)\/[a-z0-9-]+\.jpg)['"]/g)) present('../../assets/interview/' + match[1], row.file);
  }
});

test('Pages verification detects changed published bytes', async () => {
  const target = path.join(PAGES_OUTPUT, 'public/path/interview/film/strict-manifest.json');
  const original = await readFile(target);
  await writeFile(target, Buffer.concat([original, Buffer.from(' ')]));
  try { await assert.rejects(verifyPagesInterview(), /output checksum mismatch/); }
  finally { await writeFile(target, original); }
  assert.equal((await verifyPagesInterview()).preservedIntroduction, true);
});
