'use strict';
// packages/atlas/tools/publish.mjs가 manifest의 지도 칸(map.files)을 올리기 목록 · 나무 대조 · 해시 검사에 넣게 고친다(설계 주인 11-20 — 5-2 전).
// 변형 실행기가 tools/publish.mjs도 사본으로 시험하게 하고, 시험 둘 · 변형 둘을 더한다. 바꿀 글은 꼭 한 번 있어야 한다.
//   node publish-map-patch.cjs <저장소 뿌리> [--실행]
const fs = require('node:fs'), path = require('node:path');
const root = process.argv[2], run = process.argv.includes('--실행');
const edits = [];
const once = (rel, from, to) => edits.push({ rel, from, to });

// ── tools/publish.mjs ───────────────────────────────────────────────
const P = 'packages/atlas/tools/publish.mjs';
once(P,
  "//   ② 꼭 있어야 할 파일(엔진 묶음 atlas.mjs · 입구 loader.js · loader.mjs)이 manifest에 있고, 나무의 파일 목록이 manifest에 적힌 것과\n" +
  "//      꼭 같으며(적히지 않은 파일 · 빠진 파일 없음), 파일마다 sha256이 같다\n",
  "//   ② 꼭 있어야 할 파일(엔진 묶음 atlas.mjs · 입구 loader.js · loader.mjs)이 manifest에 있고, 나무의 파일 목록이 manifest에 적힌 것과\n" +
  "//      꼭 같으며(적히지 않은 파일 · 빠진 파일 없음), 파일마다 sha256이 같다. 지도(판 폴더의 map/ — manifest의 map 칸)도 같다:\n" +
  "//      지도가 빠지거나 다르면 켜진 길의 코치가 지도를 못 받아(MAP_FAILED) 목록의 계정이 모두 지금 판으로 돌아간다(설계 주인 11-20)\n");
once(P,
  "const filesIn = dir =>\n" +
  "  fs\n" +
  "    .readdirSync(dir, { withFileTypes: true })\n" +
  "    .filter(entry => entry.isFile())\n" +
  "    .map(entry => entry.name);\n" +
  "\n" +
  "function listingProblems(dir, expected) {\n" +
  "  const present = new Set(filesIn(dir));\n" +
  "  const unlisted = [...present].filter(name => !expected.has(name));\n" +
  "  const missing = [...expected].filter(name => !present.has(name));\n" +
  "  return [\n" +
  "    ...unlisted.map(name => `${name}이 manifest에 없다(적히지 않은 파일은 올리지 않는다)`),\n" +
  "    ...missing.map(name => `${name}이 나무에 없다`),\n" +
  "  ];\n" +
  "}\n" +
  "\n" +
  "function hashProblems(dir, table) {\n" +
  "  return Object.entries(table ?? {})\n" +
  "    .filter(([name, info]) => {\n" +
  "      const file = path.join(dir, name);\n" +
  "      return !fs.existsSync(file) || sha256(fs.readFileSync(file)) !== info.sha256;\n" +
  "    })\n" +
  "    .map(([name]) => `${name}이 manifest와 다르다`);\n" +
  "}\n",
  "const filesIn = dir =>\n" +
  "  fs\n" +
  "    .readdirSync(dir, { withFileTypes: true })\n" +
  "    .filter(entry => entry.isFile())\n" +
  "    .map(entry => entry.name);\n" +
  "// 지도 폴더는 아래 폴더(items/)까지 — 이름은 map/ 뒤 경로(items/talk.json). 폴더가 없으면 빈 목록이다.\n" +
  "const filesUnder = (dir, prefix = '') =>\n" +
  "  fs.existsSync(dir)\n" +
  "    ? fs\n" +
  "        .readdirSync(dir, { withFileTypes: true })\n" +
  "        .flatMap(entry =>\n" +
  "          entry.isDirectory()\n" +
  "            ? filesUnder(path.join(dir, entry.name), `${prefix}${entry.name}/`)\n" +
  "            : entry.isFile()\n" +
  "              ? [`${prefix}${entry.name}`]\n" +
  "              : [],\n" +
  "        )\n" +
  "    : [];\n" +
  "\n" +
  "function listingProblems(dir, expected, { list = filesIn, label = '' } = {}) {\n" +
  "  const present = new Set(list(dir));\n" +
  "  const unlisted = [...present].filter(name => !expected.has(name));\n" +
  "  const missing = [...expected].filter(name => !present.has(name));\n" +
  "  return [\n" +
  "    ...unlisted.map(name => `${label}${name}이 manifest에 없다(적히지 않은 파일은 올리지 않는다)`),\n" +
  "    ...missing.map(name => `${label}${name}이 나무에 없다`),\n" +
  "  ];\n" +
  "}\n" +
  "\n" +
  "function hashProblems(dir, table, label = '') {\n" +
  "  return Object.entries(table ?? {})\n" +
  "    .filter(([name, info]) => {\n" +
  "      const file = path.join(dir, name);\n" +
  "      return !fs.existsSync(file) || sha256(fs.readFileSync(file)) !== info.sha256;\n" +
  "    })\n" +
  "    .map(([name]) => `${label}${name}이 manifest와 다르다`);\n" +
  "}\n");
once(P,
  "  const editionDir = path.join(atlas, edition);\n" +
  "  return [\n" +
  "    ...required,\n",
  "  const editionDir = path.join(atlas, edition);\n" +
  "  const mapDir = path.join(editionDir, 'map');\n" +
  "  const mapTable = manifest.map?.files ?? {};\n" +
  "  return [\n" +
  "    ...required,\n");
once(P,
  "    ...listingProblems(atlas, new Set(Object.keys(manifest.entry ?? {}))),\n" +
  "    ...hashProblems(editionDir, manifest.files),\n" +
  "    ...hashProblems(atlas, manifest.entry),\n" +
  "  ];\n",
  "    ...listingProblems(atlas, new Set(Object.keys(manifest.entry ?? {}))),\n" +
  "    ...listingProblems(mapDir, new Set(Object.keys(mapTable)), { list: filesUnder, label: 'map/' }),\n" +
  "    ...hashProblems(editionDir, manifest.files),\n" +
  "    ...hashProblems(mapDir, mapTable, 'map/'),\n" +
  "    ...hashProblems(atlas, manifest.entry),\n" +
  "  ];\n");
once(P,
  "export async function checkPublish({\n",
  "// 올릴 공개 경로 — 판 폴더의 엔진 묶음 · 지도 · manifest와 입구. manifest에 적힌 것 모두다(지도가 빠지면 켜진 길이 MAP_FAILED).\n" +
  "export function publishItems(manifest, edition) {\n" +
  "  return [\n" +
  "    ...Object.keys(manifest.files ?? {}).map(name => `atlas/${edition}/${name}`),\n" +
  "    ...Object.keys(manifest.map?.files ?? {}).map(name => `atlas/${edition}/map/${name}`),\n" +
  "    `atlas/${edition}/manifest.json`,\n" +
  "    ...Object.keys(manifest.entry ?? {}).map(name => `atlas/${name}`),\n" +
  "  ];\n" +
  "}\n" +
  "\n" +
  "export async function checkPublish({\n");
once(P,
  "  const items = [\n" +
  "    ...Object.keys(tree.manifest.files ?? {}).map(name => `atlas/${tree.edition}/${name}`),\n" +
  "    `atlas/${tree.edition}/manifest.json`,\n" +
  "    ...Object.keys(tree.manifest.entry ?? {}).map(name => `atlas/${name}`),\n" +
  "  ];\n",
  "  const items = publishItems(tree.manifest, tree.edition);\n");

// ── tools/mutants.mjs: 공개 전 확인도 사본으로 ────────────────────────
const M = 'packages/atlas/tools/mutants.mjs';
once(M,
  "import { RECORD_MUTANTS } from './mutants/record.mjs';\n",
  "import { RECORD_MUTANTS } from './mutants/record.mjs';\n" +
  "import { RELEASE_MUTANTS } from './mutants/release.mjs';\n");
once(M,
  "  ...FLOW_MUTANTS,\n];\n",
  "  ...FLOW_MUTANTS,\n  ...RELEASE_MUTANTS,\n];\n");
once(M,
  "  for (const part of ['src', 'loader'])\n" +
  "    fs.cpSync(path.join(ROOT, part), path.join(dir, part), { recursive: true });\n",
  "  for (const part of ['src', 'loader'])\n" +
  "    fs.cpSync(path.join(ROOT, part), path.join(dir, part), { recursive: true });\n" +
  "  // 공개 전 확인(tools/publish.mjs)도 사본으로 시험한다 — 지도를 올리기 목록에서 빼는 변형(설계 주인 11-20). node 내장만 부르는 파일이라\n" +
  "  // 사본 하나로 돈다. 시험은 test/support/subject.mjs의 subjectTool로 부른다.\n" +
  "  for (const file of TOOL_SUBJECTS) {\n" +
  "    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });\n" +
  "    fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));\n" +
  "  }\n");
once(M,
  "export const SELF_TEST = [\n",
  "// 사본에 함께 넣는 도구 파일(패키지 기준) — 변형이 바꿀 수 있고, 시험은 subjectTool로 사본의 것을 부른다.\n" +
  "export const TOOL_SUBJECTS = ['tools/publish.mjs'];\n" +
  "\n" +
  "export const SELF_TEST = [\n");

// ── test/support/subject.mjs: subjectTool ─────────────────────────────
const S = 'packages/atlas/test/support/subject.mjs';
once(S,
  "export const loaderSource = (name = 'loader.js') =>\n",
  "// 사본에 든 도구(tools/mutants.mjs의 TOOL_SUBJECTS) — 공개 전 확인처럼 변형이 바꾸는 도구 파일을 사본에서 부른다.\n" +
  "export const subjectTool = name => import(pathToFileURL(subjectPath('tools', name)).href);\n" +
  "export const loaderSource = (name = 'loader.js') =>\n");

// ── test/unit/publish.test.mjs: 사본 도구 · 지도 시험 ─────────────────
const T = 'packages/atlas/test/unit/publish.test.mjs';
once(T,
  "import { checkPublish } from '../../tools/publish.mjs';\n" +
  "import { tempDir } from '../support/temp.mjs';\n",
  "import { subjectTool } from '../support/subject.mjs';\n" +
  "import { tempDir } from '../support/temp.mjs';\n" +
  "\n" +
  "// 변형 실행기가 고친 사본(ATLAS_SUBJECT_ROOT)의 공개 전 확인을 시험한다 — 기본은 이 패키지의 것.\n" +
  "const { checkPublish } = await subjectTool('publish.mjs');\n");
once(T,
  "function tree(edition, { release = true, loaderEdition = edition } = {}) {\n",
  "// map: 지도 파일(map/ 뒤 경로 → 내용) — 있으면 판 폴더의 map/ 아래에 쓰고 manifest의 map 칸에 적는다(tools/build.mjs와 같은 꼴).\n" +
  "function tree(edition, { release = true, loaderEdition = edition, map = null } = {}) {\n");
once(T,
  "    entry: { 'loader.js': { sha256: sha256(loader) }, 'loader.mjs': { sha256: sha256(wrapper) } },\n" +
  "  };\n",
  "    entry: { 'loader.js': { sha256: sha256(loader) }, 'loader.mjs': { sha256: sha256(wrapper) } },\n" +
  "  };\n" +
  "  if (map) {\n" +
  "    manifest.map = { edition: 1, files: {} };\n" +
  "    for (const [name, text] of Object.entries(map)) {\n" +
  "      const bytes = Buffer.from(text);\n" +
  "      const file = path.join(dir, 'map', name);\n" +
  "      fs.mkdirSync(path.dirname(file), { recursive: true });\n" +
  "      fs.writeFileSync(file, bytes);\n" +
  "      manifest.map.files[name] = { sha256: sha256(bytes) };\n" +
  "    }\n" +
  "  }\n");
once(T,
  "test('공개본에 같은 판이 같은 바이트로 있으면 지나가고, 다른 바이트면 덮지 않는다', async () => {\n",
  "const MAP = { 'index.json': '{\"edition\":1}', 'units.json': '[]', 'items/talk-rally.json': '[1]' };\n" +
  "\n" +
  "test('지도 파일(map/ — 아래 폴더 포함)이 모두 올리기 목록에 든다 — 빠지면 켜진 길의 코치가 MAP_FAILED(설계 주인 11-20)', async () => {\n" +
  "  const { out } = tree('1.0.0', { map: MAP });\n" +
  "  const result = await checkPublish({ out, fetcher: answer(404) });\n" +
  "  assert.equal(result.ok, true, result.problems.join());\n" +
  "  for (const name of Object.keys(MAP)) assert.ok(result.command.includes(` atlas/1.0.0/map/${name}`), name);\n" +
  "});\n" +
  "\n" +
  "test('지도 파일 하나의 해시가 다르거나, 빠지거나, 적히지 않은 지도 파일이 있으면 막는다', async () => {\n" +
  "  const fetcher = answer(404);\n" +
  "  const changed = tree('1.0.0', { map: MAP });\n" +
  "  fs.writeFileSync(path.join(changed.out, 'atlas', '1.0.0', 'map', 'items', 'talk-rally.json'), '[2]');\n" +
  "  const result = await checkPublish({ out: changed.out, fetcher });\n" +
  "  assert.equal(result.ok, false);\n" +
  "  assert.equal(result.command, null);\n" +
  "  assert.deepEqual(result.problems, ['map/items/talk-rally.json이 manifest와 다르다']);\n" +
  "\n" +
  "  const missing = tree('1.0.0', { map: MAP });\n" +
  "  fs.rmSync(path.join(missing.out, 'atlas', '1.0.0', 'map', 'units.json'));\n" +
  "  assert.match((await checkPublish({ out: missing.out, fetcher })).problems.join(), /map\\/units\\.json이 나무에 없다/);\n" +
  "\n" +
  "  const extra = tree('1.0.0', { map: MAP });\n" +
  "  fs.writeFileSync(path.join(extra.out, 'atlas', '1.0.0', 'map', 'items', 'debug.json'), '{}');\n" +
  "  assert.match((await checkPublish({ out: extra.out, fetcher })).problems.join(), /map\\/items\\/debug\\.json이 manifest에 없다/);\n" +
  "});\n" +
  "\n" +
  "test('공개본에 같은 판이 같은 바이트로 있으면 지나가고, 다른 바이트면 덮지 않는다', async () => {\n");

// ── README ────────────────────────────────────────────────────────────
once('packages/atlas/README.md',
  "`publish.mjs`는 공개 판인지, 나무가 manifest와 같은지, 공개본에",
  "`publish.mjs`는 공개 판인지, 나무가 manifest와 같은지(판 폴더의 지도 `map/`까지 — 지도가 빠지면 켜진 길의 코치가 `MAP_FAILED`로 지금 판에 돌아간다), 공개본에");

let bad = 0;
const byFile = new Map();
for (const e of edits) {
  const file = path.join(root, e.rel);
  if (!byFile.has(file)) byFile.set(file, fs.readFileSync(file, 'utf8'));
  const text = byFile.get(file);
  const crlf = /\r\n/.test(text);
  const from = crlf ? e.from.replace(/\n/g, '\r\n') : e.from, to = crlf ? e.to.replace(/\n/g, '\r\n') : e.to;
  const n = text.split(from).length - 1;
  if (n !== 1) { console.log(`${e.rel}: 「${e.from.slice(0, 70).replace(/\n/g, '⏎')}」 ${n}곳`); bad++; continue; }
  byFile.set(file, text.replace(from, () => to));
}
if (bad) { console.log('멈춤 — 쓰지 않았다'); process.exit(1); }
if (run) for (const [file, text] of byFile) fs.writeFileSync(file, text);
console.log(run ? `씀 ${byFile.size}개` : `시험 통과 ${byFile.size}개 · 고침 ${edits.length}곳(--실행으로 씀)`);
