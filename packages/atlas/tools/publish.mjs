// 공개 전 확인(설계 §9). 빌드 나무(tools/build.mjs --release가 낸 <밖>)를 받아 공개해도 되는지 기계로 보고, 올릴 명령을 찍는다.
//   ① 공개 판이다 — 판 이름이 숫자 세 칸(-dev · .dirty 판은 멈춘다)이고, manifest · 입구(loader.js의 판 이름 한 줄)가 같은 판을 말한다
//   ② 꼭 있어야 할 파일(엔진 묶음 atlas.mjs · 입구 loader.js · loader.mjs)이 manifest에 있고, 나무의 파일 목록이 manifest에 적힌 것과
//      꼭 같으며(적히지 않은 파일 · 빠진 파일 없음), 파일마다 sha256이 같다
//   ③ 판 폴더를 덮지 않는다 — 공개본에 같은 판의 manifest가 있으면 바이트가 같을 때만 지나간다(다시 올려도 바뀌는 것이 없을 때)
//   ④ 다 맞으면 tools/공개.js 올리기 명령(미리 보기)을 찍는다. 실행(--실행 --계획 --검수)은 그 도구의 절차 그대로다.
// 이 도구는 공개하지 않는다. 단계 0에서는 쓰지 않는다(공개본이 바뀌지 않는다) — 첫 공개는 단계 4의 제품 전환과 함께다.
//   node packages/atlas/tools/publish.mjs <밖> [--사이트 https://synk.im]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_EDITION = /^\d+\.\d+\.\d+$/;
// 판 폴더(files)와 atlas/ 바로 아래(entry)에 꼭 있어야 하는 파일 — 없으면 엔진 없이 입구만 올라갈 수 있다.
const REQUIRED = Object.freeze({ files: ['atlas.mjs'], entry: ['loader.js', 'loader.mjs'] });
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const filesIn = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name);

function listingProblems(dir, expected) {
  const present = new Set(filesIn(dir));
  const unlisted = [...present].filter(name => !expected.has(name));
  const missing = [...expected].filter(name => !present.has(name));
  return [
    ...unlisted.map(name => `${name}이 manifest에 없다(적히지 않은 파일은 올리지 않는다)`),
    ...missing.map(name => `${name}이 나무에 없다`),
  ];
}

function hashProblems(dir, table) {
  return Object.entries(table ?? {})
    .filter(([name, info]) => {
      const file = path.join(dir, name);
      return !fs.existsSync(file) || sha256(fs.readFileSync(file)) !== info.sha256;
    })
    .map(([name]) => `${name}이 manifest와 다르다`);
}

function contentProblems({ atlas, edition, manifest }) {
  const required = Object.entries(REQUIRED).flatMap(([table, names]) =>
    names.filter(name => !manifest[table]?.[name]).map(name => `manifest에 ${name}이 없다`),
  );
  const editionDir = path.join(atlas, edition);
  return [
    ...required,
    ...listingProblems(
      editionDir,
      new Set([...Object.keys(manifest.files ?? {}), 'manifest.json']),
    ),
    ...listingProblems(atlas, new Set(Object.keys(manifest.entry ?? {}))),
    ...hashProblems(editionDir, manifest.files),
    ...hashProblems(atlas, manifest.entry),
  ];
}

function readTree(out) {
  const atlas = path.join(out, 'atlas');
  const editions = fs
    .readdirSync(atlas, { withFileTypes: true })
    .filter(entry => entry.isDirectory());
  if (editions.length !== 1)
    throw new Error(`Atlas publish: 판 폴더가 하나가 아니다(${editions.length})`);
  const edition = editions[0].name;
  const manifestBytes = fs.readFileSync(path.join(atlas, edition, 'manifest.json'));
  return { atlas, edition, manifestBytes, manifest: JSON.parse(manifestBytes.toString('utf8')) };
}

function treeProblems({ atlas, edition, manifest }) {
  const problems = [];
  if (!RELEASE_EDITION.test(edition) || manifest.release !== true)
    problems.push(`공개 판이 아니다(${edition})`);
  if (manifest.edition !== edition)
    problems.push(`manifest의 판(${manifest.edition})이 폴더(${edition})와 다르다`);
  const loaderFile = path.join(atlas, 'loader.js');
  const loader = fs.existsSync(loaderFile) ? fs.readFileSync(loaderFile, 'utf8') : '';
  if (!loader.includes(`const EDITION = '${edition}';`))
    problems.push('입구의 판 이름이 판 폴더와 다르다');
  return [...problems, ...contentProblems({ atlas, edition, manifest })];
}

async function publicProblems({ edition, manifestBytes }, site, fetcher) {
  const url = `${site.replace(/\/$/, '')}/atlas/${edition}/manifest.json?probe=${Date.now()}`;
  const response = await fetcher(url, { headers: { 'cache-control': 'no-cache' } });
  if (response.status === 404) return [];
  if (!response.ok)
    return [`공개본을 확인하지 못했다(${response.status}) — 확인하기 전에는 올리지 않는다`];
  const published = Buffer.from(await response.arrayBuffer());
  return sha256(published) === sha256(manifestBytes)
    ? []
    : [`공개본에 다른 ${edition} 판이 있다 — 판 폴더는 덮지 않는다(판을 올린다)`];
}

export async function checkPublish({
  out,
  site = 'https://synk.im',
  fetcher = globalThis.fetch,
} = {}) {
  const tree = readTree(path.resolve(out));
  const problems = treeProblems(tree);
  if (!problems.length) problems.push(...(await publicProblems(tree, site, fetcher)));
  const items = [
    ...Object.keys(tree.manifest.files ?? {}).map(name => `atlas/${tree.edition}/${name}`),
    `atlas/${tree.edition}/manifest.json`,
    ...Object.keys(tree.manifest.entry ?? {}).map(name => `atlas/${name}`),
  ];
  const command = `node tools/공개.js 올리기 --원본 "${path.resolve(out)}" ${items.join(' ')}`;
  return {
    ok: problems.length === 0,
    edition: tree.edition,
    problems,
    command: problems.length ? null : command,
  };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const args = process.argv.slice(2);
  const siteAt = args.indexOf('--사이트');
  if (!args[0] || args[0].startsWith('--'))
    throw new Error('사용법: node packages/atlas/tools/publish.mjs <밖> [--사이트 <주소>]');
  const result = await checkPublish({
    out: args[0],
    ...(siteAt >= 0 ? { site: args[siteAt + 1] } : {}),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
