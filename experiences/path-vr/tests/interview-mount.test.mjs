import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolveFilmClipUrl } from '../interview/film-player.mjs';
import { hostingHeaders, normalizeMountPath } from '../../../tools/package-path-interview.mjs';

const root = new URL('../', import.meta.url);
// PATH 면접 영상(*.mp4)·음성 모델(*.tar.gz)은 .gitignore에 걸려 공용 작업본에만 있다 — CI 체크아웃에서는 그 파일을 재는 시험을 이름 대고 건너뛴다.
const gitOutside = (file) => Boolean(process.env.CI) && !existsSync(new URL(file, root)) && `CI 체크아웃에는 없다 — experiences/path-vr/${file} (git 밖 PATH 면접 미디어)`;
const origin = 'https://synk.example';
async function bundledFile(href, mount) {
  const url = new URL(href);
  assert.equal(url.origin, origin);
  assert.ok(url.pathname.startsWith(mount), `escaped deployment mount: ${href}`);
  assert.ok((await stat(new URL(url.pathname.slice(mount.length), root))).isFile(), href);
}

test('every published video quality and reference resolves inside root and nested deployments', { skip: gitOutside('assets/interview/film/strict-question-4k.mp4') }, async () => {
  const manifest = JSON.parse(await readFile(new URL('interview/film/strict-manifest.json', root), 'utf8'));
  for (const mount of ['/', '/path/', '/preview/path/']) {
    const moduleUrl = `${origin}${mount}interview/film-player.mjs`;
    const context = { moduleUrl, pageUrl: `${origin}${mount}interview/film/rehearsal.html` };
    let mediaCount = 0;
    for (const clip of manifest.clips) {
      for (const media of [clip, ...Object.values(clip.variants || {})]) {
        assert.match(media.src, /^\.\.\/assets\/interview\/film\//);
        const resolved = resolveFilmClipUrl(media.src, context);
        assert.ok(resolved, media.src);
        await bundledFile(resolved, mount); mediaCount++;
      }
    }
    assert.equal(mediaCount, 21);
    await bundledFile(new URL(manifest.reference, moduleUrl), mount);
  }
});

test('room and comparison pages keep images, styles and media under the deployment mount', { skip: gitOutside('assets/interview/film/seedance-sample.mp4') }, async () => {
  const files = ['interview/film/rehearsal.html', 'interview/film/index.html', 'interview/film/compare.html', 'interview/film/nanobanana.html', 'interview/film/rehearsal.css', 'interview/film/compare.css', 'interview/film/style.css'];
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8');
    const refs = [...source.matchAll(/(?:src|href)="([^"]+)"|url\(['"]?([^)'"\s]+)['"]?\)/g)].map((match) => match[1] || match[2]);
    for (const mount of ['/', '/path/']) {
      for (const ref of refs) {
        if (ref.startsWith('#') || ref.endsWith('/')) continue;
        await bundledFile(new URL(ref, `${origin}${mount}${file}`), mount);
      }
    }
  }
});

test('speech model, microphone worklet and worker retain their deployment directory', { skip: gitOutside('models/vosk-model-small-ko-0.22.tar.gz') }, async () => {
  for (const file of ['interview/voice.mjs', 'vendor/vosk/vosk.mjs']) {
    const source = await readFile(new URL(file, root), 'utf8');
    const refs = [...source.matchAll(/new URL\('([^']+)', import\.meta\.url\)/g)].map((match) => match[1]);
    assert.ok(refs.length, file);
    for (const mount of ['/', '/path/']) {
      for (const ref of refs) await bundledFile(new URL(ref, `${origin}${mount}${file}`), mount);
    }
  }
});

test('mounted headers scope worker-only eval and device permissions to the published directory', () => {
  assert.equal(normalizeMountPath('/path'), '/path/');
  for (const invalid of ['path', '/path//', '/../', '/path/../', '/path?x', '/path#x', '//remote.example/', '/path\\bad']) assert.throws(() => normalizeMountPath(invalid));
  const headers = hostingHeaders(['index.html', 'interview/film/rehearsal.html', 'vendor/vosk/vosk-worker.js', 'interview/whisper-worker.mjs', 'vendor/transformers/ort-wasm-simd-threaded.jsep.wasm'], { mountPath: '/path/' });
  const blocks = headers.split('\n\n');
  assert.match(blocks[0], /\n\/path\/\*\n/);
  assert.match(blocks[0], /Permissions-Policy: xr-spatial-tracking=\(self\), microphone=\(self\)/);
  assert.doesNotMatch(blocks[0], /Content-Security-Policy:/);
  const workerBlocks = blocks.filter((block) => block.includes("'unsafe-eval'"));
  assert.equal(workerBlocks.length, 1);
  assert.match(workerBlocks[0], /^\/path\/vendor\/vosk\/vosk-worker\.js\n/);
  assert.match(headers, /\/path\/interview\/film\/rehearsal\.html\n  Content-Security-Policy:/);
  assert.match(headers, /\/path\/interview\/whisper-worker\.mjs\n  Content-Security-Policy: [^\n]*'wasm-unsafe-eval'/);
  assert.match(headers, /\/path\/vendor\/transformers\/ort-wasm-simd-threaded\.jsep\.wasm\n[^\n]*\n  Content-Type: application\/wasm/);
  assert.doesNotMatch(headers, /\n\/interview\//);
});
