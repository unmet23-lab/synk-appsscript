// 공개 전 확인(설계 §9). 빌드 나무(tools/build.mjs --release가 낸 <밖>)를 받아 공개해도 되는지 기계로 보고, 올릴 명령을 찍는다.
//   ① 공개 판이다 — 판 이름이 숫자 세 칸(-dev · .dirty 판은 멈춘다)이고, manifest · 입구(loader.js의 판 이름 한 줄)가 같은 판을 말한다
//   ② 꼭 있어야 할 파일(엔진 묶음 atlas.mjs · 입구 loader.js · loader.mjs)이 manifest에 있고, 나무의 파일 목록이 manifest에 적힌 것과
//      꼭 같으며(적히지 않은 파일 · 빠진 파일 없음), 파일마다 sha256이 같다. 지도(판 폴더의 map/ — manifest의 map 칸)도 같다:
//      지도가 빠지거나 다르면 켜진 길의 코치가 지도를 못 받아(MAP_FAILED) 목록의 계정이 모두 지금 판으로 돌아간다(설계 주인 11-20).
//      그래서 공개 판의 manifest는 켜진 길의 코치가 받는 지도 파일을 모두 싣는다 — index.json · units.json · words.json과
//      index.json에 든 은행마다 items/<은행>.json(GPT GA2). 폴더 · 파일 자리가 뒤바뀌면 던지지 않고 문제로 알린다(GA3)
//   ③ 판 폴더를 덮지 않는다 — 공개본에 같은 판의 manifest가 있으면 바이트가 같을 때만 지나가고, 판 폴더의 파일(엔진 묶음 · 지도)은
//      하나씩 본다: 공개본에 없으면(404) 이번에 더하고(선택 공개 2단계의 지도처럼), 있으면 sha256이 같아야 한다(GPT GA1).
//      받기나 본문 읽기가 던지면 그 파일을 「확인하지 못했다」로 남기고 다음 파일을 본다(앞서 찾은 문제도 남는다)
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
const isDirectory = file => fs.existsSync(file) && fs.statSync(file).isDirectory();
const isFile = file => fs.existsSync(file) && fs.statSync(file).isFile();
// 지도 폴더는 아래 폴더(items/)까지 — 이름은 map/ 뒤 경로(items/talk.json). 폴더가 아니면 빈 목록이다(그 자리는 contentProblems가 알린다).
const filesUnder = (dir, prefix = '') =>
  isDirectory(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap(entry =>
          entry.isDirectory()
            ? filesUnder(path.join(dir, entry.name), `${prefix}${entry.name}/`)
            : entry.isFile()
              ? [`${prefix}${entry.name}`]
              : [],
        )
    : [];

function listingProblems(dir, expected, { list = filesIn, label = '' } = {}) {
  const present = new Set(list(dir));
  const unlisted = [...present].filter(name => !expected.has(name));
  const missing = [...expected].filter(name => !present.has(name));
  return [
    ...unlisted.map(name => `${label}${name}이 manifest에 없다(적히지 않은 파일은 올리지 않는다)`),
    ...missing.map(name => `${label}${name}이 나무에 없다`),
  ];
}

function hashProblems(dir, table, label = '') {
  return Object.entries(table ?? {})
    .filter(([name, info]) => {
      const file = path.join(dir, name);
      return !isFile(file) || sha256(fs.readFileSync(file)) !== info.sha256;
    })
    .map(([name]) => `${label}${name}이 manifest와 다르다`);
}

// 켜진 길의 코치가 받는 지도 파일(src/coach/index.mjs loadMap): units.json은 늘 받고, items/<은행>.json은 그 은행을 열 때,
// words.json은 낱말 이름을 싣지 않은 조각을 열 때 받는다. 은행은 index.json의 문항 줄(bank 칸)에서 읽는다. 하나라도 manifest에서
// 빠지면 올리기 목록에서도 빠져 공개본에서 404 → MAP_FAILED다(GPT GA2 — 지도 파일이 하나 이상인지만 보던 것을 고친다).
const MAP_ALWAYS = ['index.json', 'units.json', 'words.json'];
function indexBanks(mapDir) {
  const file = path.join(mapDir, 'index.json');
  if (!isFile(file)) return { banks: [], problems: [] }; // 빠진 index.json은 아래 MAP_ALWAYS · 목록 대조가 알린다
  try {
    const index = JSON.parse(fs.readFileSync(file, 'utf8'));
    const at = Array.isArray(index?.fields) ? index.fields.indexOf('bank') : -1;
    if (at < 0 || !Array.isArray(index.items)) throw new Error('문항 줄의 bank 칸이 없다');
    const banks = [...new Set(index.items.map(row => row?.[at]))];
    if (banks.some(bank => typeof bank !== 'string' || !bank))
      throw new Error('은행 이름이 빈 줄이 있다');
    return { banks, problems: [] };
  } catch (error) {
    return { banks: [], problems: [`map/index.json을 읽지 못했다(${error.message})`] };
  }
}
export function mapRequiredProblems(mapDir, mapTable) {
  const { banks, problems } = indexBanks(mapDir);
  const names = [...MAP_ALWAYS, ...banks.map(bank => `items/${bank}.json`)];
  return [
    ...problems,
    ...names
      .filter(name => !Object.hasOwn(mapTable, name))
      .map(name => `manifest에 지도 ${name}이 없다(켜진 길의 코치가 받는다 — 없으면 MAP_FAILED)`),
  ];
}

function contentProblems({ atlas, edition, manifest }) {
  const required = Object.entries(REQUIRED).flatMap(([table, names]) =>
    names.filter(name => !manifest[table]?.[name]).map(name => `manifest에 ${name}이 없다`),
  );
  const editionDir = path.join(atlas, edition);
  const mapDir = path.join(editionDir, 'map');
  const mapTable = manifest.map?.files ?? {};
  const mapShape = [
    ...(Object.keys(mapTable).length
      ? mapRequiredProblems(mapDir, mapTable)
      : [
          'manifest에 지도 파일이 없다(공개 판은 지도와 함께 낸다 — 없으면 켜진 길의 코치가 MAP_FAILED)',
        ]),
    ...(fs.existsSync(mapDir) && !isDirectory(mapDir) ? ['map이 폴더가 아니다'] : []),
  ];
  return [
    ...required,
    ...mapShape,
    ...listingProblems(
      editionDir,
      new Set([...Object.keys(manifest.files ?? {}), 'manifest.json']),
    ),
    ...listingProblems(atlas, new Set(Object.keys(manifest.entry ?? {}))),
    ...listingProblems(mapDir, new Set(Object.keys(mapTable)), { list: filesUnder, label: 'map/' }),
    ...hashProblems(editionDir, manifest.files),
    ...hashProblems(mapDir, mapTable, 'map/'),
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

// 판 폴더의 파일(엔진 묶음 · 제3자 고지 · 지도) — 이름은 판 폴더 뒤 경로다.
const editionFiles = manifest => [
  ...Object.entries(manifest.files ?? {}),
  ...Object.entries(manifest.map?.files ?? {}).map(([name, info]) => [`map/${name}`, info]),
];

async function publicProblems({ edition, manifest, manifestBytes }, site, fetcher) {
  const folder = `${site.replace(/\/$/, '')}/atlas/${edition}/`;
  // 받기 · 본문 읽기가 던져도(끊김 · 시간 초과) 예외로 끝내지 않고 그 파일을 「확인하지 못했다」로 돌려준다(GPT GA1).
  const read = async name => {
    try {
      const response = await fetcher(`${folder}${name}?probe=${Date.now()}`, {
        headers: { 'cache-control': 'no-cache' },
      });
      if (response.status === 404) return { missing: true };
      if (!response.ok) return { failed: String(response.status) };
      return { bytes: Buffer.from(await response.arrayBuffer()) };
    } catch (error) {
      return { failed: error?.message || String(error) };
    }
  };
  const head = await read('manifest.json');
  if (head.missing) return [];
  if (head.failed)
    return [`공개본을 확인하지 못했다(${head.failed}) — 확인하기 전에는 올리지 않는다`];
  if (sha256(head.bytes) !== sha256(manifestBytes))
    return [`공개본에 다른 ${edition} 판이 있다 — 판 폴더는 덮지 않는다(판을 올린다)`];
  // 같은 판이 이미 있다. 판 폴더의 파일은 하나씩 본다 — 없으면(404) 이번에 더하고(선택 공개 2단계의 지도처럼), 있으면 sha256이
  // 같아야 한다. 다르면 같은 판 폴더를 덮게 되므로 멈춘다(GPT GA1).
  const problems = [];
  for (const [name, info] of editionFiles(manifest)) {
    const file = await read(name);
    if (file.missing) continue;
    if (file.failed)
      problems.push(
        `공개본의 ${name}을 확인하지 못했다(${file.failed}) — 확인하기 전에는 올리지 않는다`,
      );
    else if (sha256(file.bytes) !== info.sha256)
      problems.push(`공개본의 ${name}이 manifest와 다르다 — 판 폴더는 덮지 않는다(판을 올린다)`);
  }
  return problems;
}

// 올릴 공개 경로 — 판 폴더의 엔진 묶음 · 지도 · manifest와 입구. manifest에 적힌 것 모두다(지도가 빠지면 켜진 길이 MAP_FAILED).
export function publishItems(manifest, edition) {
  return [
    ...Object.keys(manifest.files ?? {}).map(name => `atlas/${edition}/${name}`),
    ...Object.keys(manifest.map?.files ?? {}).map(name => `atlas/${edition}/map/${name}`),
    `atlas/${edition}/manifest.json`,
    ...Object.keys(manifest.entry ?? {}).map(name => `atlas/${name}`),
  ];
}

export async function checkPublish({
  out,
  site = 'https://synk.im',
  fetcher = globalThis.fetch,
} = {}) {
  const tree = readTree(path.resolve(out));
  const problems = treeProblems(tree);
  if (!problems.length) problems.push(...(await publicProblems(tree, site, fetcher)));
  const items = publishItems(tree.manifest, tree.edition);
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
