/** Export only the standalone interview's public runtime and explicit licenses.
 * Run: node tools/package-path-interview.mjs [--mount /path/]
 * Output: .tmp/path-interview-quest/ (never deploys or uploads anything).
 */
import { publicFiles, WHISPER_PUBLIC_FILES } from '../experiences/path-vr/server.mjs';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { mediaPublicUrl } from './upload-path-media.mjs';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = path.join(REPOSITORY, 'experiences/path-vr');
export const OUTPUT = path.join(REPOSITORY, '.tmp/path-interview-quest');
export const PAGES_OUTPUT = path.join(REPOSITORY, '.tmp/path-interview-pages');
export const ENTRYPOINT = '/interview/film/rehearsal.html';
const GENERATOR = 'tools/package-path-interview.mjs';
const BASE_FILES = new Set([...WHISPER_PUBLIC_FILES, 'xr.mjs', 'vendor/three.module.js', 'vendor/three.core.js', 'vendor/GLTFLoader.js', 'vendor/BufferGeometryUtils.js', 'vendor/HDRLoader.js',
  'vendor/vosk/vosk.mjs', 'vendor/vosk/vosk-worker.js', 'vendor/vosk/LICENSE.txt', 'vendor/vosk/NOTICE.txt',
  'assets/SUIT.woff2', 'assets/InterTight.woff2', 'assets/DMMono.woff2', 'assets/logo-path.webp', 'assets/logo-path-320.webp', 'assets/path-vr-felt.webp', 'assets/path-vr-felt-480.webp', 'assets/PathSans-ui.woff2', 'assets/PathSans-rest.woff2', 'models/vosk-model-small-ko-0.22.tar.gz']);
const INTERVIEW_FILES = new Set(['index.html', 'style.css', 'room.mjs', 'app.mjs', 'dialogue.mjs', 'content.mjs', 'actors.mjs', 'audio.mjs', 'voice.mjs', 'audio-worklet.js', 'credits.json', 'film-manifest.json', 'film-player.mjs', 'film/index.html', 'film/style.css', 'film/preview.mjs', 'film/compare.html', 'film/compare.css', 'film/compare.mjs', 'film/nanobanana.html', 'film/rehearsal.html', 'film/rehearsal.css', 'film/rehearsal.mjs', 'film/rehearsal-session.mjs','film/answer-followup.mjs','film/listening-sequence.mjs', 'film/strict-vr.mjs', 'film/room-space.mjs', 'film/speech-turn.mjs', 'film/strict-manifest.json'].map((name) => 'interview/' + name));
const REQUIRED = [...BASE_FILES, ...INTERVIEW_FILES, 'assets/interview/actors/manifest.json', 'assets/interview/actors/LICENSE-Microsoft-Rocketbox.txt', 'assets/interview/audio/manifest.json', 'assets/interview/audio/MODEL-LICENSE.txt', 'assets/interview/audio/INFERENCE-CODE-LICENSE.txt', 'assets/interview/room/manifest.json', 'assets/interview/room/LICENSE.txt', 'assets/interview/room/back-wall-photo.png','assets/interview/room/back-wall-elevation.png', 'assets/interview/room/front-room-extension.png', 'assets/interview/room/front-room-wide.png','assets/interview/room/left-wall-photo.png','assets/interview/room/right-wall-photo.png',
  'assets/interview/film/room-reference-4k.jpg', 'assets/interview/film/room-poster-4k.jpg',
  ...['question', 'plan', 'experience'].flatMap((name) => ['720p', '4k'].map((quality) => `assets/interview/film/strict-listen-${name}-tail-${quality}.mp4`)),
  ...['front-room-extension', 'front-room-wide', 'left-wall-photo', 'right-wall-photo', 'back-wall-elevation', 'carpet', 'desk', 'left-wall-detail', 'right-wall-detail', 'back-wall-detail', 'ceiling-detail'].map((name) => `assets/interview/room/${name}-4k.jpg`)];
// These public legal texts have exact known source paths. No directory scan of
// docs, tooling, account configuration, private media, or certificate folders.
const LICENSES = [
  ['experiences/path-vr/vendor/THREE-LICENSE.txt', 'vendor/THREE-LICENSE.txt'],
  ['docs/브랜드_폰트/SUIT/LICENSE_OFL.txt', 'assets/licenses/SUIT-OFL.txt'],
  ['docs/브랜드_폰트/InterTight/OFL.txt', 'assets/licenses/InterTight-OFL.txt'],
  ['docs/브랜드_폰트/DM_Mono/OFL.txt', 'assets/licenses/DMMono-OFL.txt'],
  ['experiences/path-vr/vendor/vosk/LICENSE.txt', 'models/LICENSE-vosk-model.txt'],
  ['experiences/path-vr/models/speech-assets.json', 'models/speech-assets.json'],
];

export function isPackageRuntime(file) {
  if (typeof file !== 'string' || file.includes('\\') || file.includes('..') || file.startsWith('/')) return false;
  if (BASE_FILES.has(file) || INTERVIEW_FILES.has(file)) return true;
  if (['assets/interview/film/room-reference.png', 'assets/interview/film/room-reference-nanobanana.jpg', 'assets/interview/film/room-reference-4k.jpg', 'assets/interview/film/room-poster-4k.jpg', 'assets/interview/film/room-poster-1920.jpg', 'assets/interview/film/room-poster-1280.jpg'].includes(file)) return true;
  if (/^assets\/interview\/film\/[a-z0-9-]+\.(?:mp4|webm)$/.test(file)) return !/fixture|verification|config|secret|private|key|token/i.test(file);
  const match = /^assets\/interview\/(actors|audio|room)\/([^/]+)$/.exec(file);
  if (!match) return false;
  const [, group, name] = match;
  if (name.startsWith('.') || /fixture|verification|config|secret|private|key|token/i.test(name)) return false;
  if (name === 'manifest.json' || /^(?:[a-zA-Z0-9_.-]*-)?(?:LICENSE|NOTICE|COPYING|ATTRIBUTION)[a-zA-Z0-9_.-]*\.txt$/i.test(name)) return true;
  return group === 'actors' ? /^[a-zA-Z0-9_-]+\.glb$/.test(name)
    : group === 'audio' ? /^[a-z0-9-]+\.mp3$/.test(name)
      : /^[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|hdr|exr)$/.test(name);
}

const PAGE_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: https://storage.googleapis.com; font-src 'self'; connect-src 'self' blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'none'";
// Pages does not interpret _headers. Meta CSP cannot enforce frame-ancestors;
// omit that directive rather than reporting a protection the browser ignores.
export const PAGES_CSP = PAGE_CSP.replace("; frame-ancestors 'none'", '');
const PAGES_MANIFEST = 'pages-manifest.json';
const PAGES_GENERATOR = GENERATOR + '#preparePagesInterview';
const PAGES_RUNTIME = new Set([
  ...WHISPER_PUBLIC_FILES,
  'xr.mjs', 'vendor/three.module.js', 'vendor/three.core.js', 'vendor/vosk/vosk.mjs', 'vendor/vosk/vosk-worker.js',
  'vendor/vosk/LICENSE.txt', 'vendor/vosk/NOTICE.txt', 'assets/SUIT.woff2', 'assets/DMMono.woff2', 'assets/logo-path.webp', 'assets/logo-path-320.webp', 'assets/path-vr-felt.webp', 'assets/path-vr-felt-480.webp', 'assets/PathSans-ui.woff2', 'assets/PathSans-rest.woff2',
  'models/vosk-model-small-ko-0.22.tar.gz',
  ...['film-player.mjs', 'voice.mjs', 'audio-worklet.js', 'dialogue.mjs', 'content.mjs'].map((name) => 'interview/' + name),
  ...['rehearsal.html', 'rehearsal.css', 'rehearsal.mjs', 'rehearsal-session.mjs', 'answer-followup.mjs', 'listening-sequence.mjs', 'room-space.mjs', 'strict-vr.mjs', 'speech-turn.mjs', 'strict-manifest.json'].map((name) => 'interview/film/' + name),
  ...['strict-question', 'strict-listening', 'strict-followup-experience', 'strict-followup-plan', 'strict-listen-question-tail', 'strict-listen-plan-tail', 'strict-listen-experience-tail'].flatMap((name) => ['720p', '4k'].map((quality) => `assets/interview/film/${name}-${quality}.mp4`)),
  'assets/interview/film/room-reference-4k.jpg', 'assets/interview/film/room-poster-4k.jpg', 'assets/interview/film/room-poster-1920.jpg', 'assets/interview/film/room-poster-1280.jpg',
  ...['front-room-extension', 'front-room-wide', 'left-wall-detail', 'right-wall-detail', 'back-wall-detail', 'ceiling-detail', 'carpet', 'desk'].map((name) => `assets/interview/room/${name}-4k.jpg`),
]);
const PAGES_LICENSES = LICENSES.filter(([, file]) => file !== 'models/speech-assets.json' && file !== 'assets/licenses/InterTight-OFL.txt');
export function pagesDocument(source) {
  if (typeof source !== 'string' || (source.match(/<head\b[^>]*>/gi) || []).length !== 1) throw new Error('Pages document requires one explicit head');
  if (/<meta\b[^>]*(?:http-equiv\s*=\s*["']?Content-Security-Policy|name\s*=\s*["']?referrer)/i.test(source)) throw new Error('Pages document already declares CSP or referrer');
  const opening = /<head\b[^>]*>\s*<meta\s+charset\s*=\s*["']utf-8["']\s*\/?>/i;
  if (!opening.test(source)) throw new Error('Pages document must declare UTF-8 before loading resources');
  const metadata = `<meta http-equiv="Content-Security-Policy" content="${PAGES_CSP}"><meta name="referrer" content="no-referrer">`;
  return source.replace(opening, (prefix) => prefix + metadata);
}

function pagesFileAllowed(file) {
  return PAGES_RUNTIME.has(file) || PAGES_LICENSES.some(([, target]) => target === file);
}

export function pagesRuntimeFile(file, source) {
  if (!pagesFileAllowed(file)) throw new Error('Not part of the public rehearsal runtime: ' + file);
  if (file === 'interview/film/rehearsal.html') {
    let text = source.toString('utf8');
    const header = /<header\b[^>]*>[\s\S]*?<\/header>/g, footer = /<footer\b[^>]*>[\s\S]*?<\/footer>/g;
    if ((text.match(header) || []).length !== 1 || (text.match(footer) || []).length !== 1) throw new Error('Rehearsal navigation source changed');
    text = text.replace(header, '<header class="topbar"><a class="brand" href="/path/" aria-label="SYNK PATH로 돌아가기"><img src="../../assets/logo-path-320.webp" alt="SYNK PATH" width="320" height="108"></a><span class="topbar-label">QUEST / SEATED INTERVIEW</span><a class="topbar-link" href="/path/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>PATH로 돌아가기</a></header>');
    text = text.replace(footer, '<footer><span>SYNK PATH · 생성 영상으로 연습하는 첫 면접</span><a href="/path/">PATH로 돌아가기</a></footer>');
    text = text.replace('추가 질문 영상 제작은 보류 중입니다. ', '');
    return { data: Buffer.from(pagesDocument(text)), transform: 'public-rehearsal-navigation-disclosure-and-csp-v3' };
  }
  if (file === 'interview/film/strict-manifest.json') {
    const original = JSON.parse(source.toString('utf8'));
    if (original.source?.status !== 'verified') throw new Error('Public video source must already be verified');
    const fields = ['schemaVersion', 'id', 'status', 'title', 'projection', 'stereo', 'notice', 'clips'];
    const result = Object.fromEntries(fields.map((key) => [key, original[key]]));
    // Keep the runtime verification contract and accurate AI/upscale disclosure.
    // Provider jobs, prompts, costs and production-review notes are build evidence.
    result.source = { status: original.source.status, provider: 'SYNK PATH 생성 영상' };
    result.notice = '면접관과 공간은 생성 영상·이미지로 구성했습니다. ' + original.notice;
    const clipKeys = ['id', 'src', 'status', 'kind', 'audio', 'reviewed', 'dialogue', 'loop', 'durationSeconds', 'width', 'height', 'fps', 'sha256', 'answerStartSeconds', 'speechEndSeconds', 'safeExitWindowsSeconds', 'playbackStartSeconds'];
    const mediaKeys = ['src', 'width', 'height', 'fps', 'sha256', 'durationSeconds'];
    result.clips = original.clips.map((clip) => {
      const runtime = Object.fromEntries(clipKeys.filter((key) => key in clip).map((key) => [key, clip[key]]));
      const transition = Object.fromEntries(['headHoldMs', 'tailHoldMs', 'validated'].map((key) => [key, clip.transition[key]]));
      const variants = Object.fromEntries(Object.entries(clip.variants).map(([quality, media]) => [quality, Object.fromEntries(mediaKeys.map((key) => [key, media[key]]))]));
      // Films come from the PATH media bucket (tools/upload-path-media.mjs): Pages empties its cache on
      // every site deploy and 4K files then arrived at about 200KB/s. The object path carries the file
      // hash, so check the local file still has that hash before pointing at it.
      const hosted = (media) => {
        const bytes = readFileSync(path.join(SOURCE, 'interview', media.src));
        if (createHash('sha256').update(bytes).digest('hex') !== media.sha256) throw new Error('Video hash does not match its file: ' + media.src);
        return { ...media, src: mediaPublicUrl(path.posix.basename(media.src), media.sha256) };
      };
      return { ...hosted(runtime), transition, variants: Object.fromEntries(Object.entries(variants).map(([quality, media]) => [quality, hosted(media)])) };
    });
    return { data: Buffer.from(JSON.stringify(result, null, 2) + '\n'), transform: 'public-runtime-video-manifest-v2' };
  }
  return { data: source, transform: 'byte-copy' };
}

/** Build a deterministic Pages overlay. Copy ONLY public/ into the site.
 * The existing site's /path/index.html is deliberately outside the overlay.
 * Audit metadata stays beside public/, never in the publishable directory.
 * This never reads or modifies the existing standalone package or live site.
 */
export async function preparePagesInterview() {
  const approved = await publicFiles(), runtime = [...PAGES_RUNTIME].sort();
  for (const required of runtime) if (!approved.includes(required)) throw new Error('Required public file is not approved: ' + required);
  const sourceMap = new Map(runtime.map((file) => [file, { root: SOURCE, file }]));
  for (const [source, file] of PAGES_LICENSES) sourceMap.set(file, { root: REPOSITORY, file: source });
  const rows = [];
  for (const file of [...sourceMap.keys()].sort()) {
    if (!pagesFileAllowed(file)) throw new Error('Pages overlay may not replace the PATH introduction: ' + file);
    const item = sourceMap.get(file), absolute = await checkedSource(item.root, item.file);
    const source = await readFile(absolute);
    const { data: output, transform } = pagesRuntimeFile(file, source);
    if (output.length > 100 * 1024 * 1024) throw new Error('File exceeds the GitHub 100 MiB limit: ' + file);
    rows.push({ file: 'path/' + file, source: path.relative(REPOSITORY, absolute).split(path.sep).join('/'), sourceBytes: source.length,
      sourceSHA256: createHash('sha256').update(source).digest('hex'), bytes: output.length, sha256: createHash('sha256').update(output).digest('hex'),
      transform, data: output });
  }
  const payloadBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  if (payloadBytes > 1_000_000_000) throw new Error('PATH overlay exceeds the published Pages site limit');
  const tempRoot = path.join(REPOSITORY, '.tmp');
  await mkdir(tempRoot, { recursive: true });
  if (await realpath(tempRoot) !== path.resolve(tempRoot)) throw new Error('Refusing a redirected .tmp folder');
  let existing = [];
  try {
    if ((await lstat(PAGES_OUTPUT)).isSymbolicLink()) throw new Error('Refusing a symlink Pages output');
    existing = await filesUnder(PAGES_OUTPUT);
    const prior = JSON.parse(await readFile(path.join(PAGES_OUTPUT, PAGES_MANIFEST), 'utf8'));
    if (prior.generatedBy !== PAGES_GENERATOR || !Array.isArray(prior.files)) throw new Error('Unrecognized Pages output manifest');
    for (const row of prior.files) {
      if (typeof row.file !== 'string' || !row.file.startsWith('path/') || !pagesFileAllowed(row.file.slice(5))) throw new Error('Invalid prior Pages output path');
    }
    const known = new Set([PAGES_MANIFEST, ...prior.files.map((row) => 'public/' + row.file)]);
    for (const file of existing) if (!known.has(file)) throw new Error('Preserving an unrecognized Pages file: ' + file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (existing.length) throw new Error('Nonempty Pages output has no manifest; nothing was changed');
  }
  const wanted = new Set([PAGES_MANIFEST, ...rows.map((row) => 'public/' + row.file)]);
  await mkdir(PAGES_OUTPUT, { recursive: true });
  for (const file of existing) {
    if (wanted.has(file)) continue;
    const absolute = path.resolve(PAGES_OUTPUT, file);
    if (!absolute.startsWith(PAGES_OUTPUT + path.sep)) throw new Error('Refusing out-of-Pages removal');
    await unlink(absolute);
    let folder = path.dirname(absolute);
    while (folder !== PAGES_OUTPUT && folder.startsWith(PAGES_OUTPUT + path.sep)) {
      try { await rmdir(folder); } catch { break; }
      folder = path.dirname(folder);
    }
  }
  for (const row of rows) {
    if (await digest(path.join(REPOSITORY, row.source)) !== row.sourceSHA256) throw new Error('Pages source changed during build: ' + row.source);
    const destination = path.join(PAGES_OUTPUT, 'public', row.file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, row.data);
  }
  const report = { schemaVersion: 1, generatedBy: PAGES_GENERATOR, entrypoint: '/path' + ENTRYPOINT, mountPath: '/path/',
    publishDirectory: 'public', deployed: false, hardwareVR: 'not-tested', payloadBytes,
    files: rows.map(({ data, ...row }) => row),
    preservedPaths: ['path/index.html'],
    excluded: ['index.html root redirect', '_headers', 'HOSTING.txt', '_package-manifest.json', 'server and account configuration', 'tools, tests and private production metadata', 'comparison pages and older 3D prototype', 'unused actors, narration and comparison media'],
    security: { csp: PAGES_CSP, referrer: 'no-referrer', cspTransport: 'early-document-meta',
      workerPolicy: 'Same-origin external Vosk worker uses its own response policy, not the parent document meta policy. Verify the live response has no inherited restrictive CSP.',
      limits: ['Meta CSP does not enforce frame-ancestors.', 'Permissions-Policy and nosniff require host response headers; this build does not claim to install them.', 'Full published site including this overlay must remain within 1 GB.'] },
    sources: ['https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits', 'https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github', 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy'] };
  await writeFile(path.join(PAGES_OUTPUT, PAGES_MANIFEST), JSON.stringify(report, null, 2) + '\n');
  return { directory: PAGES_OUTPUT, publicDirectory: path.join(PAGES_OUTPUT, 'public'), manifest: path.join(PAGES_OUTPUT, PAGES_MANIFEST),
    manifestSHA256: await digest(path.join(PAGES_OUTPUT, PAGES_MANIFEST)), entrypoint: report.entrypoint, files: rows.length, payloadBytes, deployed: false };
}

export async function verifyPagesInterview() {
  const report = JSON.parse(await readFile(path.join(PAGES_OUTPUT, PAGES_MANIFEST), 'utf8'));
  if (report.generatedBy !== PAGES_GENERATOR || report.entrypoint !== '/path' + ENTRYPOINT) throw new Error('Invalid Pages manifest');
  const expected = new Set(report.files.map((row) => row.file)), actual = await filesUnder(path.join(PAGES_OUTPUT, 'public'));
  if (expected.size !== report.files.length || actual.length !== expected.size || actual.some((file) => !expected.has(file))) throw new Error('Pages publish inventory mismatch');
  let transformed = 0;
  for (const row of report.files) {
    if (!row.file.startsWith('path/') || !pagesFileAllowed(row.file.slice(5))) throw new Error('Invalid Pages file path');
    const source = await readFile(await checkedSource(REPOSITORY, row.source));
    if (source.length !== row.sourceBytes || createHash('sha256').update(source).digest('hex') !== row.sourceSHA256) throw new Error('Pages source checksum mismatch: ' + row.source);
    const rebuilt = pagesRuntimeFile(row.file.slice(5), source), expectedBytes = rebuilt.data;
    if (rebuilt.transform !== row.transform) throw new Error('Unrecognized Pages transform');
    const output = await readFile(path.join(PAGES_OUTPUT, 'public', row.file));
    if (output.length !== row.bytes || createHash('sha256').update(output).digest('hex') !== row.sha256 || !output.equals(expectedBytes)) throw new Error('Pages output checksum mismatch: ' + row.file);
    transformed += row.transform !== 'byte-copy' ? 1 : 0;
  }
  return { checksumFiles: report.files.length, transformedDocuments: transformed, preservedIntroduction: !expected.has('path/index.html'), deployed: false };
}
export function normalizeMountPath(value = '/') {
  if (typeof value !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(value)) throw new TypeError('Mount path must be / or an absolute path of plain directory names');
  return value === '/' ? '/' : value.replace(/\/?$/, '/');
}
export function hostingHeaders(files, { mountPath = '/' } = {}) {
  const mount = normalizeMountPath(mountPath);
  const type = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.hdr': 'application/octet-stream' };
  const rules = ['# Netlify / Cloudflare Pages style headers. No wildcard CSP: policies can combine instead of override.', mount + '*', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: no-referrer', '  Permissions-Policy: xr-spatial-tracking=(self), microphone=(self)', '  Cache-Control: no-cache', ''];
  type['.mp4'] = 'video/mp4'; type['.webm'] = 'video/webm';
  for (const file of [...new Set(['', 'interview/', 'interview/film/', ...files])].sort()) {
    if (file === '_headers') continue;
    const csp = file === 'vendor/vosk/vosk-worker.js' ? PAGE_CSP.replace("'wasm-unsafe-eval'", "'unsafe-eval'") : PAGE_CSP;
    rules.push(mount + file, '  Content-Security-Policy: ' + csp);
    const mime = type[path.extname(file)];
    if (mime) rules.push('  Content-Type: ' + mime);
    rules.push('');
  }
  return rules.join('\n');
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isSymbolicLink()) throw new Error('Package directory contains a symlink: ' + relative);
    if (item.isDirectory()) files.push(...await filesUnder(path.join(directory, item.name), relative + '/'));
    else if (item.isFile()) files.push(relative);
    else throw new Error('Unsupported package file: ' + relative);
  }
  return files;
}

async function checkedSource(sourceRoot, file) {
  const absoluteRoot = await realpath(sourceRoot);
  const absolute = await realpath(path.join(sourceRoot, file));
  if (!absolute.startsWith(absoluteRoot + path.sep) || !(await stat(absolute)).isFile()) throw new Error('Source leaves its approved directory: ' + file);
  return absolute;
}

export async function packageInterview({ mountPath = '/' } = {}) {
  const mount = normalizeMountPath(mountPath);
  const entrypoint = mount + ENTRYPOINT.slice(1), legacyEntrypoint = mount + 'interview/';
  const approved = await publicFiles();
  const runtime = [...new Set(approved.filter(isPackageRuntime))].sort();
  for (const required of REQUIRED) if (!runtime.includes(required)) throw new Error('Required public file is not approved: ' + required);
  const copies = [];
  for (const file of runtime) copies.push({ source: await checkedSource(SOURCE, file), file });
  for (const [source, file] of LICENSES) copies.push({ source: await checkedSource(REPOSITORY, source), file });

  const generatedNames = ['index.html', '_headers', 'HOSTING.txt', '_package-manifest.json'];
  const wanted = new Set([...copies.map((item) => item.file), ...generatedNames]);
  // A fixed .tmp destination prevents accidentally replacing a workspace or a
  // user-selected directory. Rebuilds remove only previously generated files.
  const tempRoot = path.join(REPOSITORY, '.tmp');
  await mkdir(tempRoot, { recursive: true });
  if (await realpath(tempRoot) !== path.resolve(tempRoot)) throw new Error('Refusing a redirected .tmp folder');
  let existing = [];
  try {
    if ((await lstat(OUTPUT)).isSymbolicLink()) throw new Error('Refusing a symlink output directory');
    const previous = JSON.parse(await readFile(path.join(OUTPUT, '_package-manifest.json'), 'utf8'));
    if (previous.generatedBy !== GENERATOR) throw new Error('Output was not created by this packager');
    existing = await filesUnder(OUTPUT);
    const priorFiles = new Set([...previous.files.map((item) => item.file), '_package-manifest.json']);
    for (const file of existing) if (!priorFiles.has(file)) throw new Error('Preserving an unrecognized output file: ' + file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { existing = await filesUnder(OUTPUT); } catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
    if (existing.length) throw new Error('Nonempty output has no package manifest; nothing was changed');
  }
  await mkdir(OUTPUT, { recursive: true });
  for (const file of existing) {
    if (wanted.has(file)) continue;
    const absolute = path.resolve(OUTPUT, file);
    if (!absolute.startsWith(OUTPUT + path.sep)) throw new Error('Refusing out-of-package removal');
    await unlink(absolute);
    // Remove only empty generated subdirectories, never recursively.
    let folder = path.dirname(absolute);
    while (folder !== OUTPUT && folder.startsWith(OUTPUT + path.sep)) {
      try { await rmdir(folder); } catch { break; }
      folder = path.dirname(folder);
    }
  }
  for (const item of copies) {
    const target = path.join(OUTPUT, item.file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(item.source, target);
  }
  await writeFile(path.join(OUTPUT, 'index.html'), `<!doctype html>\n<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=.${ENTRYPOINT}"><title>SYNK PATH · 실사 면접실</title><a href=".${ENTRYPOINT}">실사 면접실 열기</a></html>\n`);
  await writeFile(path.join(OUTPUT, '_headers'), hostingHeaders([...wanted], { mountPath: mount }));
  await writeFile(path.join(OUTPUT, 'HOSTING.txt'), `SYNK PATH 실사 면접실 — 정적 실행 패키지

이 폴더 전체를 신뢰되는 HTTPS 정적 호스팅의 ${mount} 경로에 배치한 뒤 ${entrypoint}를 엽니다. ${mount}도 새 실사 면접실로 연결됩니다. 기존 3D 시제품은 ${legacyEntrypoint}에 보존했습니다. 패키지 생성 자체는 게시·배포하지 않습니다.

배포할 때: 폴더 구조를 유지합니다. 사이트 루트와 /path/ 같은 하위 경로 모두 지원합니다. 하위 경로는 node tools/package-path-interview.mjs --mount /path/처럼 지정해 헤더 경로도 맞춥니다. _headers는 Netlify/Cloudflare Pages 형식이며 호스트가 요구하는 설정 위치에 둡니다. Caddy 등 다른 서버에서는 이 파일이 자동 적용되지 않으므로 같은 MIME, 마이크·WebXR 권한 정책과 경로별 CSP를 서버에 직접 적용하세요. worker의 unsafe-eval은 ${mount}vendor/vosk/vosk-worker.js에만 적용하며 페이지 CSP와 중첩하지 마세요. connect-src blob:은 GLB 내장 이미지 로딩에 필요합니다.

모델 .tar.gz는 압축 파일 자체로 제공합니다. 별도 Content-Encoding: gzip을 붙여 자동 해제하지 마세요. 약 89MB인 모델 파일과 큰 자산을 허용하는 호스트인지 확인하고, MP4·모델의 HTTP Range 요청을 지원해야 합니다. HTML/JS에 SPA catch-all rewrite를 걸어 빠진 자산을 HTML로 반환하지 마세요.
Whisper의 .wasm은 application/wasm, .onnx는 application/octet-stream, 설정 파일은 application/json으로 제공합니다. Transformers JavaScript와 WASM은 같은 버전의 파일을 함께 유지합니다. Whisper는 기기 내 별도 worker에서 numThreads=1, proxy=false로 실행하므로 SharedArrayBuffer용 COOP/COEP를 요구하지 않습니다. Whisper worker에는 페이지와 같은 wasm-unsafe-eval만 유지하며 Vosk의 unsafe-eval 예외를 확대하지 않습니다.

USB 개발 테스트: PC 저장소에서 node experiences/path-vr/server.mjs --port 4293 실행 → Quest 개발자 모드·USB 디버깅 연결 → adb devices에서 device 확인 → adb reverse tcp:4293 tcp:4293 → Quest Browser에서 http://localhost:4293${ENTRYPOINT} 열기. 종료 후 adb reverse --remove tcp:4293으로 해당 매핑만 해제합니다. 이 경로는 PC 서버와 USB 연결이 유지되는 개발 테스트이며 독립 호스팅이 아닙니다. 일반 LAN IP의 HTTP와 달리 localhost는 보안 컨텍스트로 인정되는 경로입니다. 인증서 경고 무시나 브라우저 보안 해제는 필요하지 않습니다.

실기기에서는 음성 입력 준비·마이크 권한 허용을 마친 뒤 VR로 엽니다. 다운로드/모델 준비 시간은 면접 길이에 포함하지 않습니다. 실제 Quest 화질·음성 인식·멀미 검증은 아직 별도입니다.

마이크 음성·답변은 이 기기 메모리에서 처리합니다. 공개 Vosk 모델만 브라우저 캐시에 남습니다. 서버·계정 설정·인증서·원본 WAV·합성 시험 fixture·개발 도구는 패키지에 없습니다. 자산 출처는 interview/credits.json, 각 manifest.json과 함께 보관한 LICENSE/NOTICE/OFL 문서를 확인하세요.

USB 공식 근거: https://developers.meta.com/vr/documentation/web/browser-remote-debugging/
localhost 공식 근거: https://developer.android.com/develop/ui/views/layout/webapps/access-local-server
보안 컨텍스트: https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy
`);
  const records = [];
  for (const file of (await filesUnder(OUTPUT)).filter((name) => name !== '_package-manifest.json').sort()) {
    const absolute = path.join(OUTPUT, file);
    records.push({ file, bytes: (await stat(absolute)).size, sha256: await digest(absolute) });
  }
  const licenses = records.filter((item) => /LICENSE|NOTICE|OFL/i.test(item.file)).map((item) => item.file);
  const report = { generatedBy: GENERATOR, generatedAt: new Date().toISOString(), mountPath: mount, entrypoint, legacyEntrypoint, deployed: false,
    hardwareVR: 'not-tested', files: records, licenses, payloadBytes: records.reduce((sum, item) => sum + item.bytes, 0),
    excluded: ['server and account configuration', 'certificates and secrets', 'tools and tests', 'synthetic ASR fixture', 'source WAV files', 'ASR verification reports'] };
  await writeFile(path.join(OUTPUT, '_package-manifest.json'), JSON.stringify(report, null, 2) + '\n');
  return { directory: OUTPUT, mountPath: mount, entrypoint, files: records.length + 1, totalBytes: report.payloadBytes + (await stat(path.join(OUTPUT, '_package-manifest.json'))).size, licenses, deployed: false };
}

export async function verifyPackage() {
  const manifest = JSON.parse(await readFile(path.join(OUTPUT, '_package-manifest.json'), 'utf8'));
  if (manifest.generatedBy !== GENERATOR) throw new Error('Unrecognized package manifest');
  const recorded = new Set([...manifest.files.map((item) => item.file), '_package-manifest.json']);
  for (const file of await filesUnder(OUTPUT)) if (!recorded.has(file)) throw new Error('Unrecorded package file: ' + file);
  const sourceMap = new Map(LICENSES.map(([source, file]) => [file, path.join(REPOSITORY, source)]));
  let sourceCompared = 0, creditFilesPresent = 0;
  for (const item of manifest.files) {
    const absolute = path.resolve(OUTPUT, item.file);
    if (!absolute.startsWith(OUTPUT + path.sep)) throw new Error('Package path leaves output');
    if ((await stat(absolute)).size !== item.bytes || await digest(absolute) !== item.sha256) throw new Error('Package checksum mismatch: ' + item.file);
    const source = sourceMap.get(item.file) || (isPackageRuntime(item.file) ? path.join(SOURCE, item.file) : null);
    if (source) {
      if (await digest(source) !== item.sha256) throw new Error('Package no longer matches source: ' + item.file);
      sourceCompared++;
    }
    if (/\.wav$|fixture|verification|server\.mjs|^(?:tools|tests)\//i.test(item.file)
      || /config/i.test(item.file) && !WHISPER_PUBLIC_FILES.includes(item.file)) throw new Error('Unexpected non-runtime file: ' + item.file);
  }
  async function checkReferences(value) {
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') await checkReferences(child);
      else if (/(?:licenseFile|noticeFile)$|^manifest$/i.test(key)) {
        const absolute = path.resolve(OUTPUT, 'interview', child);
        if (!absolute.startsWith(OUTPUT + path.sep) || !(await stat(absolute)).isFile()) throw new Error('Missing or invalid credit reference: ' + child);
        creditFilesPresent++;
      }
    }
  }
  await checkReferences(JSON.parse(await readFile(path.join(OUTPUT, 'interview/credits.json'), 'utf8')));
  return { checksumFiles: manifest.files.length, sourceCompared, creditFilesPresent, licenses: manifest.licenses.length, excludedArtifacts: 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--pages') {
    console.log(JSON.stringify({ ...await preparePagesInterview(), verification: await verifyPagesInterview() }, null, 2));
  } else {
    if (args.length && (args.length !== 2 || args[0] !== '--mount')) throw new Error('Usage: node tools/package-path-interview.mjs [--mount /path/ | --pages]');
    const result = await packageInterview({ mountPath: args[1] || '/' });
    console.log(JSON.stringify({ ...result, verification: await verifyPackage() }, null, 2));
  }
}
