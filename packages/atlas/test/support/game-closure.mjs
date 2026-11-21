// 열한 게임 입구에서 import를 따라가 정한 제품 파일(4-6e-5 — 설계 주인 11-21 설계 관문 답 1). 게임 목록은 셸의 게임 표(world-atlas-game.mjs
// GAME_BANKS)에서 읽는다. 게임 폴더의 HTML이 싣는 스크립트가 입구이고, esbuild로 그 import를 따라간다(묶지 않고 metafile의 입력만 본다).
// 그래서 폴더 밖 공유 모듈(brand-opening/game-tutor-support.mjs 등)이 저절로 든다. 옛 엔진 사본(atlas-learning.js)과 시험은 뺀다. 절대
// 주소(/atlas/loader.js) · 바깥 주소 · import map의 꾸러미 이름(three)은 따라가지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { PACKAGE_ROOT } from './subject.mjs';

export const EXPERIENCES = path.resolve(PACKAGE_ROOT, '..', '..', 'experiences');
export const nameOf = file =>
  path.relative(EXPERIENCES, path.resolve(file)).split(path.sep).join('/');
const OLD_ENGINE = /(^|\/)atlas-learning\.js$/;
const TEST = /\.test\.m?js$/;

// `<script … src=…>` — 큰따옴표 · 작은따옴표 · 따옴표 없는 값을 모두 받는다(r4 GPT GA2 · GA6). 대소문자를 가리지 않는다.
export const SCRIPT_SRC = /<script\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

// 게임 하나의 입구 — 그 폴더의 HTML이 싣는 제 스크립트들.
function entriesOf(dir) {
  const entries = new Set();
  for (const html of fs.readdirSync(dir).filter(file => file.endsWith('.html'))) {
    const text = fs.readFileSync(path.join(dir, html), 'utf8');
    for (const match of text.matchAll(SCRIPT_SRC)) {
      const src = (match[1] ?? match[2] ?? match[3]).split('?')[0];
      if (/^(https?:)?\/\//.test(src)) continue;
      const file = src.startsWith('/') ? path.join(EXPERIENCES, src) : path.join(dir, src);
      if (!OLD_ENGINE.test(file)) entries.add(file);
    }
  }
  return [...entries];
}

const outside = {
  name: 'outside',
  setup(build) {
    build.onResolve({ filter: /^(\/|https?:|[^./])/ }, args =>
      args.kind === 'entry-point' ? undefined : { path: args.path, external: true },
    );
  },
};

let cached = null;
// { games, files } — files는 experiences/ 기준 이름, 게임마다 따라간 파일의 합.
export async function gameClosure() {
  if (cached) return cached;
  const { GAME_BANKS } = await import(
    pathToFileURL(path.join(EXPERIENCES, 'synk-world-app', 'world-atlas-game.mjs')).href
  );
  const games = Object.keys(GAME_BANKS);
  const files = new Set();
  for (const game of games) {
    const result = await esbuild.build({
      entryPoints: entriesOf(path.join(EXPERIENCES, game)),
      bundle: true,
      write: false,
      metafile: true,
      outdir: 'out',
      format: 'esm',
      platform: 'browser',
      logLevel: 'silent',
      plugins: [outside],
    });
    for (const input of Object.keys(result.metafile.inputs)) {
      const name = nameOf(input);
      if (/\.m?js$/.test(name) && !OLD_ENGINE.test(name) && !TEST.test(name)) files.add(name);
    }
  }
  cached = { games, files: [...files].sort() };
  return cached;
}

// 주석을 걷고 띄어쓰기를 고르게 다시 찍은 글(esbuild) — 글자 안의 글은 비운다. `.`과 이름과 `(` 사이의 공백 · 줄바꿈은 같은 꼴이 된다.
export function printed(name) {
  const code = esbuild.transformSync(fs.readFileSync(path.join(EXPERIENCES, name), 'utf8'), {
    loader: 'js',
  }).code;
  return maskStrings(code);
}
export const maskStrings = code =>
  code.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
