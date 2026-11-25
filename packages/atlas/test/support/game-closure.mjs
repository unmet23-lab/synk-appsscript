// 셸의 게임 표에 든 게임의 입구에서 import를 따라가 정한 제품 파일(4-6e-5 — 설계 주인 11-21 설계 관문 답 1). 게임 목록은 셸의 게임 표(world-atlas-game.mjs
// GAME_BANKS)에서 읽는다. 게임 폴더의 HTML이 싣는 스크립트가 입구이고, esbuild로 그 import를 따라간다(묶지 않고 metafile의 입력만 본다).
// 그래서 폴더 밖 공유 모듈(brand-opening/game-tutor-support.mjs 등)이 저절로 든다. 옛 엔진 사본(atlas-learning.js)과 시험은 뺀다. 절대
// 주소(/atlas/loader.js) · 바깥 주소 · import map의 꾸러미 이름(three)은 따라가지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { parse } from 'parse5';
import { PACKAGE_ROOT } from './subject.mjs';

export const EXPERIENCES = path.resolve(PACKAGE_ROOT, '..', '..', 'experiences');
export const nameOf = file =>
  path.relative(EXPERIENCES, path.resolve(file)).split(path.sep).join('/');
const OLD_ENGINE = /(^|\/)atlas-learning\.js$/;
const TEST = /\.test\.m?js$/;
// 이 스크립트는 공개할 때만 /assets/로 옮긴다.
const publishedScripts = new Map([['/assets/launch-notice.js', 'launch-notice/launch-notice.js']]);

// 게임 HTML은 브라우저와 같은 HTML5 파서(parse5, 이 꾸러미의 개발 의존성 — 잠긴 판 8.0.1)로 읽는다. 파서를 못 불러오면 이 모듈째 실패한다 —
// 정규식으로 물러서거나 건너뛰지 않는다(test/build/closure-parser.test.mjs가 본다). 정규식은 주석 · 따옴표 · 태그 끝의 규칙을 하나씩 흉내 내다
// 빠뜨렸다(4-6e 첫 묶음 GB4 · 다시 검수 GA2 · r3 GA1 · GA2 — 같은 파일 세 회차라 파서로 바꿨다, 설계 검토 11-23).
// 이 도우미는 실수를 막는 장치이고 악의를 막는 장치가 아니다(설계 주인 11-23). 실제 게임 HTML에 나오는 꼴은 바르게 읽고, 나오지 않는 꼴은
// 브라우저 동작을 흉내 내지 않고 감지해 실패한다(아래 htmlTraps). 실제 열한 곳의 꼴은 .tmp/검수/게임HTML_훑기_20261123.txt에 훑어 두었다.
const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const attrOf = (node, name) => node.attrs?.find(row => row.name === name)?.value;
const ASCII_SPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;
// 주소 글 — URL 파서처럼 앞뒤의 C0 제어 문자와 공백(U+0000~U+0020)만 빼고 안의 탭 · 줄바꿈을 지운다. U+00A0 같은 글자는 그대로다.
export function urlText(value) {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 0x20) start += 1;
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end -= 1;
  return value.slice(start, end).replace(/[\t\n\r]/g, '');
}

// 한 HTML 글이 싣는 스크립트 주소들 — HTML 이름공간의 script 요소에서 속성 이름이 바로 src인 것만 읽는다(이름은 파서가 소문자로 맞춘다 —
// data-src는 브라우저가 싣지 않는다, r5 GPT GA3). 같은 이름의 속성이 둘이면 첫째다(파서가 뒤를 버린다). 빈 src는 싣지 않는다(브라우저도 오류로
// 끝낸다). 돌지 않는 종류(type="text/plain" 등)도 읽는다 — 더 따라가도 해가 없다. template 안의 스크립트는 돌지 않으므로 따라가지 않는다(파서는
// 그 자식을 content에 둔다 — childNodes만 걷는다).
export const scriptSrcs = html => {
  const out = [];
  const walk = node => {
    const src =
      node.nodeName === 'script' && node.namespaceURI === HTML_NS ? attrOf(node, 'src') : undefined;
    if (src && urlText(src)) out.push(urlText(src));
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(parse(String(html)));
  return out;
};

// 브라우저는 싣거나 돌리는데 src만 읽어서는 입구 목록에서 빠지는 꼴(설계 검토 11-23 조건 · r4 GA1). 게임 HTML에 있으면 따라가기 전에 실패한다 —
// 조용히 입구를 빠뜨리지 않게. 지금 게임 HTML에는 하나도 없다.
const NESTED = new Set(['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe']);
const hasText = node =>
  node.childNodes.some(child => child.nodeName === '#text' && child.value.trim());
// 주소를 바꾸는 가져오기 표 — 키가 맨 이름(three 등)이 아니라 주소 꼴(/ · ./ · ../ · 스킴)이거나 scopes가 있으면 esbuild가 따라가는 파일과
// 브라우저가 싣는 파일이 달라진다. 읽지 못하는 표도 막는다.
function remapsUrls(node) {
  let map;
  try {
    map = JSON.parse(node.childNodes.map(child => child.value ?? '').join(''));
  } catch {
    return true;
  }
  const urlish = key => /^(\/|\.\.?\/|[a-z][a-z0-9+.-]*:)/i.test(key);
  return map?.scopes !== undefined || Object.keys(map?.imports ?? {}).some(urlish);
}
const INLINE_SCRIPT = 'src 없는 script — 주소를 바꾸지 않는 importmap 말고는 받지 않는다';
// src 없이 글이 있는 script는 주소를 바꾸지 않는 importmap(type이 앞뒤 ASCII 공백을 뺀 importmap)만 받는다. 그 밖에는 type · language를
// 가리지 않고 막는다 — 도는지는 브라우저마다 다를 수 있다(예: Chromium은 type 앞뒤의 유니코드 공백을 지우고 돌린다, r5 GA1). 실제 재료의 src
// 없는 script는 korean-racing의 importmap 하나뿐이다. 그래서 공백뿐인 type · ld+json 같은 데이터 스크립트도 실패한다 — 재료에 없는 꼴의 한계다
// (설계 주인 잣대 ㄴ · ㄷ, r4 GA3의 장면).
function scriptTrap(node) {
  if (node.namespaceURI !== HTML_NS) return '<svg> · <math>의 script — href로 싣는다';
  if (attrOf(node, 'src') !== undefined) return null;
  // importmap은 본문이 비어도 읽어 본다 — 빈 · 읽지 못한 표는 맨 이름(three)을 못 풀어 게임이 서지 않는데, 따라갈 파일은 같아 조용히 지나갔다
  // (r6 GA1 · 설계 주인 잣대 ㄷ — 실제 재료의 importmap은 본문이 있다). 감지와 멈춤만 넣는다.
  if ((attrOf(node, 'type') ?? '').replace(ASCII_SPACE, '').toLowerCase() === 'importmap')
    return remapsUrls(node)
      ? '주소를 바꾸거나 읽지 못하는 importmap — 따라가는 파일이 달라지거나 맨 이름을 못 푼다'
      : null;
  return hasText(node) ? INLINE_SCRIPT : null;
}
function elementTrap(node) {
  if (node.nodeName === 'base' && attrOf(node, 'href') !== undefined)
    return '<base href> — 상대 주소가 게임 폴더가 아니게 풀린다';
  if (NESTED.has(node.nodeName))
    return `<${node.nodeName}> — 중첩 문서의 스크립트를 따라가지 않는다`;
  if (
    node.nodeName === 'template' &&
    (attrOf(node, 'shadowrootmode') ?? attrOf(node, 'shadowroot')) !== undefined
  )
    return '선언형 섀도 루트 template — 안의 스크립트가 돈다';
  return node.nodeName === 'script' ? scriptTrap(node) : null;
}
// 속성으로 도는 코드 — 인라인 이벤트 속성(on…)과 javascript: 주소. javascript: 값은 모든 속성에서 막는다 — 입력칸 value 같은 글도 실패하는
// 한계가 있지만 실제 재료에는 javascript: 값이 없다(설계 주인 잣대 ㄴ, r5 GA2).
function attrTraps(node) {
  return (node.attrs ?? []).flatMap(row => {
    if (/^on/i.test(row.name) && row.value.trim())
      return [`인라인 이벤트 속성 ${row.name} — 그 코드의 import를 따라가지 않는다`];
    return /^javascript:/i.test(urlText(row.value))
      ? [`javascript: 주소(${row.name}) — 그 코드를 따라가지 않는다`]
      : [];
  });
}
export function htmlTraps(html) {
  const traps = [];
  const walk = node => {
    const trap = elementTrap(node);
    if (trap) traps.push(trap);
    traps.push(...attrTraps(node));
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(parse(String(html)));
  return traps;
}

// 게임 폴더에 있지만 게임 화면이 아닌 HTML과 그 까닭(4-7 — 한글 만나기를 셸의 게임 표에 더하며, 단계 4 계획 §26-12). 입구로 따라가지 않는다.
// 그 화면이 싣는 것(src와 인라인 module 스크립트의 직접 import)을 적어 두고 견준다. 다르면 멈춘다 — 그때 게임 화면인지 다시 정하고, 게임
// 화면이면 인라인 스크립트를 파일로 옮겨 입구로 따라가게 한다. 실은 파일은 옛 엔진 사본이거나 그 게임 입구가 이미 따라간 파일이어야 한다 —
// 그래서 이 화면을 빼도 따라간 파일은 같다. 게임 화면의 인라인 스크립트는 그대로 함정이다(htmlTraps).
export const NOT_GAME_PAGES = Object.freeze({
  'hangul-stage/voice-check.html': Object.freeze({
    why: '유호님이 글자 소리를 귀로 확인하는 화면이다(tools/한글단계_목소리.cjs) — 코치 · 기록을 부르지 않는다',
    srcs: Object.freeze(['./atlas-learning.js']),
    imports: Object.freeze(['./pack.mjs']),
  }),
});

// 스크립트 주소 → 따라갈 파일. 바깥 주소와 옛 엔진 사본은 null이다.
function entryFile(dir, found) {
  const src = found.split(/[?#]/, 1)[0];
  if (/^(https?:)?\/\//.test(src)) return null;
  const file = src.startsWith('/')
    ? path.join(EXPERIENCES, publishedScripts.get(src) ?? src)
    : path.join(dir, src);
  return OLD_ENGINE.test(file) ? null : file;
}

// 게임 하나의 입구 — 그 폴더의 HTML이 싣는 제 스크립트들과, 입구로 보지 않는 게임이 아닌 화면들(NOT_GAME_PAGES).
function entriesOf(dir) {
  const entries = new Set();
  const pages = [];
  for (const html of fs.readdirSync(dir).filter(file => file.endsWith('.html'))) {
    const text = fs.readFileSync(path.join(dir, html), 'utf8');
    const name = nameOf(path.join(dir, html));
    if (Object.hasOwn(NOT_GAME_PAGES, name)) pages.push({ name, text });
    else {
      const traps = htmlTraps(text);
      if (traps.length) throw new Error(`${name}: ${traps.join(' · ')}`);
      for (const found of scriptSrcs(text)) {
        const file = entryFile(dir, found);
        if (file) entries.add(file);
      }
    }
  }
  return { entries: [...entries], pages };
}

const outside = {
  name: 'outside',
  setup(build) {
    build.onResolve({ filter: /^(\/|https?:|[^./])/ }, args =>
      args.kind === 'entry-point' ? undefined : { path: args.path, external: true },
    );
  },
};

// 인라인 module 스크립트의 글 — 게임이 아닌 화면에서만 읽는다(product-flow 시험이 코치 이름도 이 글에서 본다).
const isModuleType = node =>
  (attrOf(node, 'type') ?? '').replace(ASCII_SPACE, '').toLowerCase() === 'module';
export function inlineModules(html) {
  const out = [];
  const walk = node => {
    const inline =
      node.nodeName === 'script' &&
      node.namespaceURI === HTML_NS &&
      attrOf(node, 'src') === undefined &&
      isModuleType(node) &&
      hasText(node);
    if (inline) out.push(node.childNodes.map(child => child.value ?? '').join(''));
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(parse(String(html)));
  return out;
}

// 인라인 module 글이 직접 들이는 것(esbuild의 import 기록 — original은 적힌 주소, path는 푼 파일).
async function directImports(contents, resolveDir) {
  const result = await esbuild.build({
    stdin: { contents, resolveDir, loader: 'js' },
    bundle: true,
    write: false,
    metafile: true,
    outdir: 'out',
    format: 'esm',
    platform: 'browser',
    logLevel: 'silent',
    plugins: [outside],
  });
  return result.metafile.inputs['<stdin>'].imports;
}

// 게임이 아닌 화면(name — experiences/ 기준)이 적어 둔 꼴과 다른 곳. reached는 그 게임 입구가 따라간 파일(experiences/ 기준)이다.
export async function notGamePageProblems(name, html, reached) {
  const page = Object.hasOwn(NOT_GAME_PAGES, name) ? NOT_GAME_PAGES[name] : null;
  if (!page) return [`${name}: 게임이 아닌 화면으로 적지 않았다`];
  const inline = inlineModules(html);
  const traps = htmlTraps(html);
  if (traps.length !== inline.length || traps.some(trap => trap !== INLINE_SCRIPT))
    return [`${name}: 인라인 module 말고도 도는 코드가 있다 — ${traps.join(' · ')}`];
  const dir = path.join(EXPERIENCES, path.dirname(name));
  const imports = [];
  for (const contents of inline) imports.push(...(await directImports(contents, dir)));
  const loads = { srcs: scriptSrcs(html), imports: imports.map(row => row.original) };
  const problems = [];
  if (JSON.stringify(loads) !== JSON.stringify({ srcs: page.srcs, imports: page.imports }))
    problems.push(
      `${name}: 싣는 것이 적어 둔 꼴과 다르다 ${JSON.stringify(loads)} — 게임 화면인지 다시 정한다`,
    );
  const files = [
    ...loads.srcs.map(src => path.join(dir, src)),
    ...imports.filter(row => !row.external).map(row => row.path),
  ].map(nameOf);
  const missing = files.filter(file => !OLD_ENGINE.test(file) && !reached.has(file));
  if (missing.length)
    problems.push(`${name}: 게임 입구가 따라가지 않는 파일을 싣는다 — ${missing.join(', ')}`);
  return problems;
}

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
    const { entries, pages } = entriesOf(path.join(EXPERIENCES, game));
    const result = await esbuild.build({
      entryPoints: entries,
      bundle: true,
      write: false,
      metafile: true,
      outdir: 'out',
      format: 'esm',
      platform: 'browser',
      logLevel: 'silent',
      plugins: [outside],
    });
    const reached = new Set(Object.keys(result.metafile.inputs).map(nameOf));
    for (const page of pages) {
      const problems = await notGamePageProblems(page.name, page.text, reached);
      if (problems.length) throw new Error(problems.join(' · '));
    }
    for (const name of reached)
      if (/\.m?js$/.test(name) && !OLD_ENGINE.test(name) && !TEST.test(name)) files.add(name);
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
