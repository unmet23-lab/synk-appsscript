// 묶음 하나로 내보내는 빌드(설계 §9). 나가는 나무는 공개 경로 그대로다 — tools/공개.js 올리기에 그대로 넘긴다(tools/publish.mjs).
//   <밖>/atlas/loader.js            입구(판 이름 한 줄)
//   <밖>/atlas/loader.mjs           ES 모듈 겉(판과 무관)
//   <밖>/atlas/<판>/atlas.mjs        엔진 묶음
//   <밖>/atlas/<판>/manifest.json    판 · 커밋 · 파일마다 바이트 · sha256 · gzip 바이트 · 제3자 코드
//   <밖>/atlas/<판>/LICENSES.txt     묶음에 든 제3자 코드의 고지(있을 때만)
// 같은 커밋이면 같은 바이트다 — 시각 · 절대 경로를 넣지 않는다(시험이 두 번 빌드해 견준다).
//
//   node packages/atlas/tools/build.mjs [--out <폴더>] [--release]
// 판 이름: --release면 package.json의 판 그대로(공개 판). 작업본이 깨끗하고, HEAD가 origin/master에 들었고, 판이 0.0.0이 아닐 때만 낸다.
// 그 밖에는 <판>-dev.<커밋 앞 7자>(이 패키지에 커밋하지 않은 고침이 있으면 .dirty)라 공개 판과 섞이지 않는다.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RELEASE_EDITION = /^\d+\.\d+\.\d+$/;
export const EDITION_FORM = /^\d+\.\d+\.\d+(?:-dev\.[0-9a-f]{7}(?:\.dirty)?)?$/;
const PLACEHOLDER = "'__ATLAS_EDITION__'";
// 압축한 묶음에 남으면 안 되는 이 PC의 자리(공개 저장소 · 공개 사이트에 작업 경로가 실리지 않게).
const LOCAL_PATH =
  /[A-Za-z]:[\\/](?:Users|SYNK)|\/Users\/|\/home\/|SYNK-worktrees|(?<![\w.-])\.tmp[\\/]/;

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const gzipBytes = bytes => zlib.gzipSync(bytes, { level: 9 }).length;
const describe = bytes => ({
  bytes: bytes.length,
  sha256: sha256(bytes),
  gzipBytes: gzipBytes(bytes),
});
const lf = text => text.replace(/\r\n/g, '\n');

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function sourceState(root = PACKAGE_ROOT) {
  const commit = git(['rev-parse', 'HEAD'], root);
  const dirty = git(['status', '--porcelain', '--untracked-files=all', '--', '.'], root) !== '';
  return { commit, dirty };
}

function isInOrigin(commit, root) {
  try {
    git(['merge-base', '--is-ancestor', commit, 'origin/master'], root);
    return true;
  } catch {
    return false;
  }
}

export function editionFor({ version, commit, dirty, release, inOrigin }) {
  if (!RELEASE_EDITION.test(version))
    throw new Error(`Atlas build: package.json 판 꼴이 아니다(${version})`);
  if (!release) return `${version}-dev.${commit.slice(0, 7)}${dirty ? '.dirty' : ''}`;
  const refusals = [];
  if (version === '0.0.0') refusals.push('판이 0.0.0이다(단계 0은 공개 판이 아니다)');
  if (dirty) refusals.push('이 패키지에 커밋하지 않은 고침이 있다');
  if (!inOrigin) refusals.push('HEAD가 origin/master에 없다(git fetch 뒤 다시)');
  if (refusals.length)
    throw new Error(`Atlas build: 공개 판을 낼 수 없다 — ${refusals.join(' · ')}`);
  return version;
}

// 묶음에 든 제3자 코드 — esbuild metafile의 입력 가운데 node_modules 아래 것을 패키지마다 하나로 모은다.
function thirdPartyOf(metafile, root) {
  const dirs = new Map();
  for (const input of Object.keys(metafile.inputs)) {
    const normal = input.replace(/\\/g, '/');
    const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(normal);
    if (match)
      dirs.set(match[1], path.resolve(root, normal.slice(0, match.index + match[0].length)));
  }
  return [...dirs.keys()].sort().map(name => {
    const dir = dirs.get(name);
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const licenseFile = fs.readdirSync(dir).find(file => /^licen[cs]e(?:\.md|\.txt)?$/i.test(file));
    const text = licenseFile ? lf(fs.readFileSync(path.join(dir, licenseFile), 'utf8')).trim() : '';
    return { name, version: info.version, license: info.license ?? null, text };
  });
}

function licensesText(parties) {
  return parties.map(p => `${p.name} ${p.version} (${p.license})\n\n${p.text}\n`).join('\n---\n\n');
}

function emptyOutput(out) {
  if (fs.existsSync(out) && fs.readdirSync(out).length) {
    throw new Error(`Atlas build: 빈 폴더가 아니다 — 덮지 않는다(${out})`);
  }
}

async function bundle(edition, root) {
  const esbuild = await import('esbuild');
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/index.mjs'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    define: { __ATLAS_EDITION__: JSON.stringify(edition) },
    metafile: true,
    write: false,
    logLevel: 'silent',
  });
  return {
    code: Buffer.from(result.outputFiles[0].contents),
    metafile: result.metafile,
    esbuild: esbuild.version,
  };
}

function loaderFor(edition, root) {
  const template = lf(fs.readFileSync(path.join(root, 'loader/loader.js'), 'utf8'));
  if (template.split(PLACEHOLDER).length !== 2)
    throw new Error('Atlas build: 입구의 판 이름 자리가 하나가 아니다');
  return Buffer.from(template.replace(PLACEHOLDER, `'${edition}'`));
}

export async function build({
  out,
  release = false,
  root = PACKAGE_ROOT,
  state = sourceState(root),
} = {}) {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const inOrigin = release ? isInOrigin(state.commit, root) : false;
  const edition = editionFor({ version, ...state, release, inOrigin });
  if (!EDITION_FORM.test(edition)) throw new Error(`Atlas build: 판 이름 꼴이 아니다(${edition})`);
  const target = path.resolve(out ?? path.join(root, '..', '..', '.tmp', 'atlas-build', edition));
  emptyOutput(target);
  const { code, metafile, esbuild } = await bundle(edition, root);
  if (LOCAL_PATH.test(code.toString('utf8')))
    throw new Error('Atlas build: 묶음에 이 PC의 경로가 남았다');
  const parties = thirdPartyOf(metafile, root);
  const files = { 'atlas.mjs': code };
  if (parties.length) files['LICENSES.txt'] = Buffer.from(licensesText(parties));
  const entry = {
    'loader.js': loaderFor(edition, root),
    'loader.mjs': Buffer.from(lf(fs.readFileSync(path.join(root, 'loader/loader.mjs'), 'utf8'))),
  };
  const manifest = {
    edition,
    version,
    release,
    commit: state.commit,
    dirty: state.dirty,
    builder: { esbuild },
    files: Object.fromEntries(
      Object.entries(files).map(([name, bytes]) => [name, describe(bytes)]),
    ),
    entry: Object.fromEntries(
      Object.entries(entry).map(([name, bytes]) => [name, describe(bytes)]),
    ),
    thirdParty: parties.map(({ name, version: v, license }) => ({ name, version: v, license })),
  };
  const editionDir = path.join(target, 'atlas', edition);
  fs.mkdirSync(editionDir, { recursive: true });
  for (const [name, bytes] of Object.entries(files))
    fs.writeFileSync(path.join(editionDir, name), bytes);
  fs.writeFileSync(
    path.join(editionDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  for (const [name, bytes] of Object.entries(entry))
    fs.writeFileSync(path.join(target, 'atlas', name), bytes);
  return { out: target, edition, manifest };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const known = new Set(['--out', '--release']);
  if (
    args.some((arg, i) => arg.startsWith('--') && !known.has(arg)) ||
    (outAt >= 0 && !args[outAt + 1])
  ) {
    throw new Error('사용법: node packages/atlas/tools/build.mjs [--out <폴더>] [--release]');
  }
  const result = await build({
    out: outAt >= 0 ? args[outAt + 1] : undefined,
    release: args.includes('--release'),
  });
  console.log(
    JSON.stringify(
      {
        out: result.out,
        edition: result.edition,
        files: result.manifest.files,
        entry: result.manifest.entry,
      },
      null,
      2,
    ),
  );
}
