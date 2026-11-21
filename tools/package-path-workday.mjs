// PATH 일터 체험 공개 묶음.
//
//   node tools/package-path-workday.mjs --jobs care-home[,hotel-front]
//                                                  .tmp/path-workday-pages/public/path/workday/ 를 다시 만든다
//   node tools/package-path-workday.mjs --verify   만든 묶음의 바이트와 바깥 참조를 다시 본다
//   node tools/package-path-workday.mjs --live     바깥 참조가 synk.im에 실제로 있는지도 본다(HEAD 요청)
//
// --jobs에는 유호님이 공개를 허락하신 직업만 적는다. 작업 사본에서 시험하느라 open으로 둔 다른 직업은
// 묶음의 직업 목록에 「만드는 중」 카드로만 실리고, 그 장면표와 사진과 영상은 실리지 않는다.
//
// 일터 체험은 synk.im/path/workday/ 에 올라간다. 싣는 파일은 experiences/path-vr/server.mjs 의 허용
// 목록(코드 파일 이름 목록 + 직업 목록이 가리키는 장면표, 영상 목록, 사진, 영상)뿐이다. 직업의
// production/ 폴더와 docs/ 는 실리지 않는다. HTML에는 면접실 공개 판과 같은 CSP meta를 넣는다
// (GitHub Pages는 _headers를 읽지 않는다).
//
// 일터 체험은 면접실이 이미 공개한 파일(재생기, 음성 인식, WebXR, three.js, 글꼴과 로고)을
// ../interview/…, ../vendor/…, ../assets/… 로 가져다 쓴다. 그 파일들은 이 묶음에 넣지 않고,
// 면접실 공개 판의 목록(PAGES_RUNTIME)에 있는지만 확인한다. 올리기는 공용 작업본에서
//   node tools/공개.js 올리기 path/workday/=<이 사본>/.tmp/path-workday-pages/public/path/workday …
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles, WORKDAY_PUBLIC, workdayJobFiles } from '../experiences/path-vr/server.mjs';
import { pagesDocument, PAGES_CSP } from './package-path-interview.mjs';

const REPOSITORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(REPOSITORY, 'experiences/path-vr');
export const WORKDAY_OUTPUT = path.join(REPOSITORY, '.tmp/path-workday-pages');
const MANIFEST = 'workday-pages-manifest.json';
const INDEX = 'workday/jobs/index.json';
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATOR = 'tools/package-path-workday.mjs';
const SITE = 'https://synk.im/path/';
const TEXT = /\.(?:html|css|mjs|js|json)$/;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Relative references a text file makes: module imports, stylesheet url(), href and src. */
export function references(file, source) {
  const found = new Set();
  const add = (value) => { if (/^\.{1,2}\//.test(value)) found.add(path.posix.normalize(path.posix.join(path.posix.dirname(file), value.replace(/[?#].*$/, '')))); };
  if (/\.m?js$/.test(file)) {
    for (const [, target] of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) add(target);
    for (const [, target] of source.matchAll(/new URL\(\s*['"](\.{1,2}\/[^'"`$]+)['"]\s*,\s*import\.meta\.url\s*\)/g)) add(target);
  }
  if (file.endsWith('.css')) for (const [, target] of source.matchAll(/url\(\s*['"]?(\.{1,2}\/[^'")]+)['"]?\s*\)/g)) add(target);
  if (file.endsWith('.html')) for (const [, target] of source.matchAll(/\b(?:href|src)\s*=\s*["'](\.{1,2}\/[^"']*)["']/g)) add(target);
  return [...found];
}

/** The job list as published: an open job that is not being published turns into a 「만드는 중」 card. */
export function publicIndex(index, published) {
  return { ...index, jobs: (Array.isArray(index?.jobs) ? index.jobs : []).map((entry) => (entry?.status === 'open' && !published.has(entry.id)
    ? { id: entry.id, status: 'making', title: entry.title, role: entry.role, summary: entry.summary }
    : entry)) };
}

/** jobs: the ids approved for synk.im. Nothing is published without naming them. */
export async function prepareWorkdayPages({ jobs } = {}) {
  if (!Array.isArray(jobs) || !jobs.length || jobs.some((id) => !ID.test(id || ''))) throw new Error('Name the jobs to publish: --jobs care-home[,…]');
  const published = new Set(jobs);
  const index = JSON.parse(await readFile(path.join(SOURCE, INDEX), 'utf8'));
  for (const id of published) if (!index.jobs?.some((entry) => entry?.id === id && entry.status === 'open')) throw new Error(`Not an open job: ${id}`);
  const approved = new Set(await publicFiles());
  const files = [...WORKDAY_PUBLIC, ...(await workdayJobFiles()).filter((file) => published.has(file.split('/')[2]))].sort();
  for (const id of published) if (!files.includes(`workday/jobs/${id}/job.json`)) throw new Error(`Job does not pass its check: ${id}`);
  for (const file of files) if (!approved.has(file) || !file.startsWith('workday/') || /(?:^|\/)(?:production|docs)\//.test(file)) throw new Error(`Not an approved workday file: ${file}`);
  // A film the list calls reviewed must be in the bundle: a missing file would only show up as a
  // silent fall back to the photograph on the public site.
  for (const file of files.filter((name) => name.endsWith('/manifest.json'))) {
    const manifest = JSON.parse(await readFile(path.join(SOURCE, file), 'utf8')), folder = path.posix.dirname(file);
    for (const clip of Array.isArray(manifest.clips) ? manifest.clips : []) if (clip?.reviewed === true && !files.includes(`${folder}/${clip.file}`)) throw new Error(`Reviewed film is missing from the bundle: ${folder}/${clip.file}`);
  }
  const rows = [], outside = new Set();
  for (const file of files) {
    let bytes = await readFile(path.join(SOURCE, file));
    if (file.endsWith('.html')) bytes = Buffer.from(pagesDocument(bytes.toString('utf8')));
    if (file === INDEX) bytes = Buffer.from(`${JSON.stringify(publicIndex(index, published), null, 2)}\n`);
    if (TEXT.test(file)) for (const target of references(file, bytes.toString('utf8'))) {
      // A folder link (./ or ../) is a page address, not a file to ship.
      if (target === 'workday' || target === '.' || target.endsWith('/')) continue;
      if (target.startsWith('workday/')) { if (!files.includes(target)) throw new Error(`${file} points at ${target}, which is not in the bundle`); } else outside.add(target);
    }
    rows.push({ file, bytes });
  }
  // What the pages borrow from the interview room must already be approved for publishing there.
  for (const target of outside) if (target !== 'interview/film/rehearsal.html' && !approved.has(target)) throw new Error(`Outside reference is not an approved public file: ${target}`);
  try { if ((await lstat(WORKDAY_OUTPUT)).isSymbolicLink()) throw new Error('Refusing a symlink output'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rm(WORKDAY_OUTPUT, { recursive: true, force: true });
  for (const row of rows) {
    const destination = path.join(WORKDAY_OUTPUT, 'public/path', row.file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, row.bytes);
  }
  const report = {
    schemaVersion: 1, generatedBy: GENERATOR, mountPath: '/path/workday/', entrypoint: '/path/workday/', jobs: [...published].sort(),
    security: { csp: PAGES_CSP, referrer: 'no-referrer', cspTransport: 'early-document-meta' },
    outside: [...outside].sort(),
    files: rows.map((row) => ({ file: row.file, bytes: row.bytes.length, sha256: sha256(row.bytes) })),
  };
  await writeFile(path.join(WORKDAY_OUTPUT, MANIFEST), JSON.stringify(report, null, 2) + '\n');
  return { directory: WORKDAY_OUTPUT, publicDirectory: path.join(WORKDAY_OUTPUT, 'public/path/workday'), jobs: report.jobs, files: rows.length, payloadBytes: rows.reduce((sum, row) => sum + row.bytes.length, 0), outside: report.outside };
}

async function filesUnder(directory, prefix = '') {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await filesUnder(path.join(directory, entry.name), name)); else out.push(name);
  }
  return out;
}

export async function verifyWorkdayPages({ live = false, fetchImpl = globalThis.fetch } = {}) {
  const report = JSON.parse(await readFile(path.join(WORKDAY_OUTPUT, MANIFEST), 'utf8'));
  if (report.generatedBy !== GENERATOR) throw new Error('Unrecognized workday manifest');
  const actual = (await filesUnder(path.join(WORKDAY_OUTPUT, 'public/path'))).sort(), expected = report.files.map((row) => row.file).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Workday output holds files the manifest does not list');
  for (const row of report.files) {
    const bytes = await readFile(path.join(WORKDAY_OUTPUT, 'public/path', row.file));
    if (bytes.length !== row.bytes || sha256(bytes) !== row.sha256) throw new Error(`Changed bytes: ${row.file}`);
    if (row.file.endsWith('.html') && !bytes.toString('utf8').includes(`content="${PAGES_CSP}"`)) throw new Error(`Missing CSP: ${row.file}`);
    if (/(?:^|\/)(?:production|docs)\//.test(row.file) || /\.(?:txt|md|py|png)$/.test(row.file)) throw new Error(`Working file in the bundle: ${row.file}`);
  }
  // The borrowed files must be on the site, and the modules must be the same bytes this bundle was
  // written against: an older published module could lack a name these pages import.
  const missing = [], different = [];
  if (live) for (const target of report.outside) {
    const response = await fetchImpl(`${SITE}${target}?probe=${Date.now()}`, { redirect: 'follow', cache: 'no-store' }).catch(() => null);
    if (!response?.ok) { missing.push(target); continue; }
    if (!/\.(?:mjs|js)$/.test(target)) continue;
    const [published, source] = [Buffer.from(await response.arrayBuffer()), await readFile(path.join(SOURCE, target))];
    const text = (bytes) => bytes.toString('utf8').replace(/\r\n/g, '\n');
    if (text(published) !== text(source)) different.push(target);
  }
  if (missing.length) throw new Error(`Not on ${SITE}: ${missing.join(', ')}`);
  if (different.length) throw new Error(`Published module differs from this checkout: ${different.join(', ')}`);
  return { files: report.files.length, outside: report.outside.length, live };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.length === 2 && args[0] === '--jobs') console.log(JSON.stringify(await prepareWorkdayPages({ jobs: args[1].split(',').map((id) => id.trim()).filter(Boolean) }), null, 2));
    else if (args.length === 1 && (args[0] === '--verify' || args[0] === '--live')) console.log(JSON.stringify(await verifyWorkdayPages({ live: args[0] === '--live' }), null, 2));
    else throw new Error('Usage: node tools/package-path-workday.mjs --jobs <id,…> | --verify | --live');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
