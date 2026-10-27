#!/usr/bin/env node
// 한국어 공부(synk.im/study/) — 원고(src/)를 올릴 폴더(dist/study/)로 조립한다. 설계: README.md.
// 사용: node experiences/korean-study/build.mjs [--check]
// 하는 일: app.mjs + Atlas Core ask.js + WORLD 쓰기의 순수 판정 모듈을 한 파일(app.js)로 묶고, 검수 통과 51·52·53 문항에서
//          화면이 쓰는 칸만 items.json으로 옮기고(예시답·채점 메모는 빼고), SUIT 글꼴을 옮기고, css·js·json에 내용 지문 토큰을 붙인다.
// --check: 다시 만들어 dist와 바이트가 같은지만 본다(원고를 고치고 빌드를 잊은 경우).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const esbuild = require(path.join(REPO, 'node_modules/esbuild'));
const SRC = path.join(HERE, 'src');
const BANK = path.join(REPO, 'experiences/synk-world-app/world-writing-items.json');
const FONT = path.join(REPO, 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2');
const check = process.argv.includes('--check');
const OUT = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'synk-study-')) : path.join(HERE, 'dist/study');
const sha = buf => createHash('sha256').update(buf).digest('hex');

// 화면이 쓰는 칸만. 51·52는 지문(카드 문장), 53은 자료(쓰기). 예시답(model·blanks)·채점 메모는 학생 화면에 가지 않는다.
const KEEP = {
  51: ['id', 'type', 'style', 'passage'],
  52: ['id', 'type', 'style', 'passage'],
  53: ['id', 'type', 'style', 'label', 'instruction', 'points', 'min', 'max', 'data'],
};
export function studyBank(bank) {
  const items = bank.items.filter(item => item?.review?.status === 'passed' && KEEP[item.type])
    .map(item => ({ ...Object.fromEntries(KEEP[item.type].map(key => [key, item[key]])), review: { status: 'passed' } }));
  return { version: 1, source: 'world-writing-items', sourceHash: bank.contentHash, items };
}

// 이미 현지어 검수를 거친 WORLD 쓰기 화면 글에서 이 쪽이 쓰는 키만 옮긴다(src/copy-reused.mjs — 만든 파일, 손으로 고치지 않는다).
export const REUSED_KEYS = ['writing.loading', 'writing.loadError', 'writing.countNote', 'writing.focus.found', 'writing.focus.counts', 'writing.focus.independent', 'writing.focus.limit',
  'writing.focus.method.step1', 'writing.focus.method.step2', 'writing.focus.method.verb', 'writing.focus.method.adj', 'writing.focus.method.noun', 'writing.focus.method.past', 'writing.focus.method.watch',
  'writing.focus.drill.lead', 'writing.focus.bin.formal', 'writing.focus.bin.polite', 'writing.focus.bin.plain', 'writing.focus.drill.count', 'writing.focus.drill.right', 'writing.focus.drill.wrong',
  'writing.focus.mine.title', 'writing.focus.mine.lead', 'writing.focus.mine.label', 'writing.focus.mine.ok', 'writing.focus.mine.not'];
export async function reusedCopy() {
  const strings = (await import(pathToFileURL(path.join(REPO, 'experiences/brand-opening/world-strings.mjs')).href)).default;
  const picked = Object.fromEntries(REUSED_KEYS.map(key => { const v = strings[key]; if (!v?.ko || !v.en || !v.mn) throw new Error(`world-strings에 ${key}의 ko·en·mn이 없어요`); return [key, { ko: v.ko, en: v.en, mn: v.mn }]; }));
  return `// 만든 파일 — node experiences/korean-study/build.mjs가 brand-opening/world-strings.mjs(검수된 WORLD 쓰기 글)에서 옮긴다. 손으로 고치지 않는다.
export default ${JSON.stringify(picked, null, 1)};
`;
}

// 원인별 미니 콘텐츠(content/ending-53.json): 2중 검수를 통과한 문항만, 검수 기록 칸 없이.
export function studyContent(data) {
  const items = data.items.filter(item => item?.review?.status === 'passed').map(({ review, ...item }) => ({ ...item, review: { status: 'passed' } }));
  return { version: 1, topic: data.topic, items };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!check) fs.rmSync(path.join(HERE, 'dist'), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  const write = (name, data) => fs.writeFileSync(path.join(OUT, name), data);

  { const reused = await reusedCopy(), file = path.join(SRC, 'copy-reused.mjs');
    if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== reused) { console.error('src/copy-reused.mjs가 world-strings와 달라요 — node experiences/korean-study/build.mjs'); process.exit(1); } }
    else fs.writeFileSync(file, reused); }
  write('items.json', `${JSON.stringify(studyBank(JSON.parse(fs.readFileSync(BANK, 'utf8'))))}\n`);
  write('study.json', `${JSON.stringify(studyContent(JSON.parse(fs.readFileSync(path.join(HERE, 'content/ending-53.json'), 'utf8'))))}
`);
  const itemsToken = sha(Buffer.concat(['items.json', 'study.json'].map(f => fs.readFileSync(path.join(OUT, f))))).slice(0, 12);
  const built = esbuild.buildSync({ entryPoints: [path.join(SRC, 'app.mjs')], bundle: true, write: false, format: 'esm', platform: 'browser',
    target: ['es2022'], charset: 'utf8', legalComments: 'none', define: { __ITEMS_TOKEN__: JSON.stringify(itemsToken) } });
  write('app.js', built.outputFiles[0].contents);
  write('study.css', fs.readFileSync(path.join(SRC, 'study.css')));
  fs.copyFileSync(FONT, path.join(OUT, 'assets/SUIT-Variable.woff2'));

  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  for (const f of ['study.css', 'app.js']) {
    const before = html;
    html = html.replace(new RegExp(`(["'])${f.replace('.', '\\.')}\\1`), `$1${f}?v=${sha(fs.readFileSync(path.join(OUT, f))).slice(0, 12)}$1`);
    if (html === before) throw new Error(`index.html에서 ${f} 참조를 찾지 못했어요`);
  }
  write('index.html', html);

  if (check) {
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)).map(f => `${e.name}/${f}`) : [e.name]).sort();
    const real = path.join(HERE, 'dist/study'), a = walk(OUT), b = fs.existsSync(real) ? walk(real) : [];
    const diff = [...new Set([...a, ...b])].filter(f => !a.includes(f) || !b.includes(f) || sha(fs.readFileSync(path.join(OUT, f))) !== sha(fs.readFileSync(path.join(real, f))));
    fs.rmSync(OUT, { recursive: true, force: true });
    if (diff.length) { console.error(`dist/study가 원고와 달라요: ${diff.join(', ')} — node experiences/korean-study/build.mjs`); process.exit(1); }
    console.log('dist/study 최신');
  } else console.log(`dist/study 만듦 · 문항 ${JSON.parse(fs.readFileSync(path.join(OUT, 'items.json'))).items.length}`);
}
