// 지금 앱 화면 묶기: SYNK-talk의 실제 컴포넌트를 react-native-web으로 묶어 before/dist에 낸다.
// 쓰는 법: NODE_PATH=<esbuild가 설치된 node_modules> node build.mjs
// 앱 저장소는 읽기만 한다. 기록 저장·추천 엔진은 아래 대체 모듈로 바꿔 화면만 그린다.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require(process.env.ESBUILD || 'esbuild');
const here = path.dirname(fileURLToPath(import.meta.url));
const APP = 'C:/Users/q1212/Documents/SYNK-talk';
const out = path.join(here, 'dist');
fs.mkdirSync(out, { recursive: true });

const stub = {
  name: 'stub',
  setup(b) {
    b.onResolve({ filter: /^APP\// }, (a) => ({ path: path.join(APP, a.path.slice(4)) }));
    b.onResolve({ filter: /app-learning\.js$|맞춤학습저장\.js$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
      contents: /맞춤학습저장/.test(a.path) ? 'export const 맞춤학습저장 = () => ({});' : 'export const createAppLearning = () => ({});',
      loader: 'js',
    }));
  },
};

await esbuild.build({
  entryPoints: [path.join(here, 'entry.jsx')],
  bundle: true,
  outfile: path.join(out, 'app.js'),
  loader: { '.js': 'jsx', '.json': 'json' },
  jsx: 'automatic',
  alias: { 'react-native': 'react-native-web' },
  nodePaths: [path.join(APP, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false', global: 'window' },
  resolveExtensions: ['.web.js', '.js', '.jsx', '.json'],
  plugins: [stub],
  logLevel: 'warning',
});

// 앱이 쓰는 이름(SUIT-Medium 등)으로 같은 서체 파일을 건다. 앱 테마의 다크 바탕(#080605)도 그대로.
const fonts = [['SUIT-Regular', 'SUIT-Regular.ttf'], ['SUIT-Medium', 'SUIT-Medium.ttf'], ['SUIT-SemiBold', 'SUIT-SemiBold.ttf'], ['SUIT-ExtraBold', 'SUIT-ExtraBold.ttf'], ['DMMono-Medium', 'DMMono-Medium.ttf']];
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
for (const [, f] of fonts) fs.copyFileSync(path.join(APP, 'assets/fonts', f), path.join(out, 'fonts', f));
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>지금 앱 · 맞춤 학습 화면</title>
<style>${fonts.map(([n, f]) => `@font-face{font-family:'${n}';src:url(fonts/${f})}`).join('')}html,body,#root{height:100%;margin:0;background:#080605}#root{display:flex;flex-direction:column}</style>
<div id="root"></div><script src="app.js"></script></html>`);
console.log('묶음', path.relative(process.cwd(), out));
