/** 「대학 입학 면접 연습」(synk.im/path/interview/study/)의 공개 후보만 짓는다. 올리거나 배포하지 않는다.
 * 실행: node tools/prepare-path-study-interview-public.mjs <.tmp 아래 새 폴더> <live-config.json>
 * 이 쪽의 코드와 계정 엔진만 한 파일로 묶고, 방 · 음성 · VR은 이미 공개된 면접실 파일(../film/*, ../voice.mjs …)을 그대로 부른다.
 * 라이브 면접실의 파일과 묶음 도구(tools/package-path-interview.mjs)는 건드리지 않는다.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validatePathConfig, PATH_PUBLIC_URL } from './prepare-path-app-public.mjs';
import { PUBLIC_PREFIX } from './upload-path-media.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STUDY = 'experiences/path-vr/interview/study';
/** 이미 공개된 면접실 모듈. 같은 사이트의 상대 주소로 부르고 묶지 않는다. */
export const LIVE_MODULES = Object.freeze(['../film-player.mjs', '../voice.mjs', '../whisper-model.mjs', '../film/strict-vr.mjs', '../film/speech-turn.mjs', '../film/rehearsal-session.mjs']);
/** 묶어도 되는 원천. 여기 없는 모듈이 들어오면 멈춘다. */
export const BUNDLED = Object.freeze([`${STUDY}/app.mjs`, `${STUDY}/session.mjs`, `${STUDY}/account.mjs`, `${STUDY}/consent-mn.mjs`,
  'experiences/path-app/interview-shape.mjs', 'experiences/path-app/document.mjs', 'experiences/path-app/state.mjs', 'experiences/path-app/content.mjs',
  'experiences/synk-account/src/product-account.mjs', 'experiences/synk-account/src/platform-entry.mjs', 'experiences/synk-account/src/core.mjs']);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (p) => p.split(path.sep).join('/');

/** 앱(계정 서버)과 면접실(기기 안 음성 인식 · 영상 저장소)의 허용을 합친 것. 인라인 스크립트와 eval은 없다. */
export function studyInterviewCsp(config) {
  const account = [...new Set([new URL(config.supabaseUrl).origin, new URL(config.accountApiUrl).origin])].join(' ');
  return `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: ${PUBLIC_PREFIX}; font-src 'self'; connect-src 'self' blob: ${PUBLIC_PREFIX} ${account}; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
}

export async function bundleStudyInterview({ root = ROOT } = {}) {
  const require = createRequire(path.join(root, 'experiences/synk-account/package.json'));
  const esbuild = require('esbuild');
  const seen = new Map();
  const result = await esbuild.build({ absWorkingDir: root, entryPoints: [path.join(root, STUDY, 'app.mjs')], outfile: 'app.mjs', bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', charset: 'utf8', legalComments: 'eof', metafile: true, logLevel: 'silent',
    plugins: [{ name: 'study-interview-boundary', setup(build) {
      build.onResolve({ filter: /^\.\.?\// }, (args) => (slash(path.relative(root, args.importer)) === `${STUDY}/app.mjs` && LIVE_MODULES.includes(args.path) ? { path: args.path, external: true } : undefined));
      build.onLoad({ filter: /.*/ }, async (args) => {
        const name = slash(path.relative(root, args.path));
        if (!BUNDLED.includes(name)) throw Error('면접 쪽 원천 목록 밖의 모듈: ' + name);
        const bytes = await fs.readFile(args.path); seen.set(name, sha(bytes));
        return { contents: bytes.toString('utf8'), loader: 'js' };
      });
    } }] });
  if (result.outputFiles.length !== 1) throw Error('면접 쪽은 한 파일로 묶여야 한다.');
  const imports = Object.values(result.metafile.outputs).flatMap((o) => o.imports).map((i) => i.path);
  if ([...new Set(imports)].sort().join() !== [...LIVE_MODULES].sort().join()) throw Error('면접 쪽이 부르는 공개 모듈이 목록과 다르다: ' + imports.join(', '));
  const text = result.outputFiles[0].text;
  if (/\bimport\s*\(/.test(text)) throw Error('동적 불러오기를 두지 않는다.');
  return { bytes: Buffer.from(text), sources: seen };
}

export function studyInterviewHtml(source, { config, appHash, cssHash }) {
  if (!source.includes('<meta charset="utf-8">') || /http-equiv=["']Content-Security-Policy/i.test(source) || /<script(?![^>]*\bsrc=)[^>]*>/i.test(source) || /\son[a-z]+\s*=/i.test(source) || /<(?:base|iframe|object|style)\b|\sstyle\s*=/i.test(source)) throw Error('면접 쪽 HTML에 인라인 코드나 다른 정책이 있다.');
  return source.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="referrer" content="no-referrer">\n<meta http-equiv="Content-Security-Policy" content="${studyInterviewCsp(config)}">`)
    .replace('src="./app.mjs"', `src="./app.mjs?v=${appHash}"`).replace('href="./study.css"', `href="./study.css?v=${cssHash}"`);
}

export async function prepareStudyInterviewPublic({ out, config, root = ROOT } = {}) {
  const publicConfig = validatePathConfig(config, { targetUrl: PATH_PUBLIC_URL });
  const target = path.resolve(root, out), relative = path.relative(path.join(root, '.tmp'), target);
  if (!out || !relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('작업 사본의 .tmp 아래 새 폴더를 준다.');
  const { bytes, sources } = await bundleStudyInterview({ root });
  const css = await fs.readFile(path.join(root, STUDY, 'study.css')), html = await fs.readFile(path.join(root, STUDY, 'index.html'), 'utf8');
  const page = Buffer.from(studyInterviewHtml(html, { config: publicConfig, appHash: sha(bytes), cssHash: sha(css) }));
  const files = new Map([['index.html', page], ['app.mjs', bytes], ['study.css', css]]);
  const manifest = { schemaVersion: 1, generator: 'tools/prepare-path-study-interview-public.mjs', liveModules: LIVE_MODULES,
    sources: Object.fromEntries([...sources, [`${STUDY}/index.html`, sha(html)], [`${STUDY}/study.css`, sha(css)]].sort()), files: Object.fromEntries([...files].map(([n, b]) => [n, { bytes: b.length, sha256: sha(b) }])) };
  files.set('build-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.mkdir(target);
  for (const [name, data] of files) await fs.writeFile(path.join(target, name), data, { flag: 'wx' });
  return { output: target, files: [...files.keys()] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [out, configPath] = process.argv.slice(2);
  if (!out || !configPath || process.argv.length !== 4) throw Error('사용: node tools/prepare-path-study-interview-public.mjs <.tmp 아래 새 폴더> <live-config.json>');
  console.log(JSON.stringify(await prepareStudyInterviewPublic({ out, config: JSON.parse(await fs.readFile(configPath, 'utf8')) }), null, 2));
}
