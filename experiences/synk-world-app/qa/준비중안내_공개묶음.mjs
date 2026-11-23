// WORLD 배우기 · 놀이 「준비 중」 안내(유호님 11-24)의 synk.im/world 선택 공개 재료. 본보기: 시트종이_공개묶음.mjs.
//   node experiences/synk-world-app/qa/준비중안내_공개묶음.mjs [--끝 <커밋=origin/master>]
// master 전체 공개는 몽골 시범 뒤라(결정 11-20 Atlas 선택 공개), 지금 공개본 위에 이 일의 변경만 얹는다.
// · app-shell.mjs: 바탕 판(이 일의 첫 커밋 바로 앞)에 이 일의 커밋(제목이 「WORLD 배우기 준비 중 안내」)만 얹은 「내 판」을
//   공개 빌드와 같은 경로 고쳐 쓰기를 거쳐 지금 공개본 위에 3방향으로 합친다. 겹치면 멈춘다(조용히 버리지 않는다).
// · world-learn-soon.mjs: 끝 판 그대로(같은 경로 고쳐 쓰기). 이미 공개된 판이 있으면(11-24 첫 공개 synk-policy 44ae5f98 뒤) 그 판을 기준에 둔다.
//   기준 판은 공개 도구의 git 사본(~/Documents/synk-vendor/synk-policy-publish.git HEAD)에서 꺼낸다. synk.im 주소는 부르지 않는다 —
//   공개 전에 없는 주소를 부르면 그 404가 쿼리와 상관없이 CDN에 묶인다(11-24 Fable F1). 기준이 없으면 tools/공개.js가 새 파일로 올리고,
//   공개된 파일인데 기준이 없으면 「새로 만든 파일인데 공개본에 같은 이름의 다른 파일」로 멈춘다(Fable FA1).
// · server.mjs · tools/build-world-app-public.mjs · qa는 공개본에 싣지 않는다.
// 출력: .tmp/learn-soon-pub/base(지금 공개본) · new(후보 원천) · 항목.txt, 그리고 tools/공개.js 미리 보기 명령.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const END = opt('--끝', 'origin/master');
const TITLE = '^WORLD 배우기 준비 중 안내';
const OUT = path.join(ROOT, '.tmp', 'learn-soon-pub');
const git = (...a) => execFileSync('git', ['-C', ROOT, '-c', 'core.autocrlf=false', ...a], {maxBuffer: 1 << 30});
const lf = s => s.replace(/\r\n/g, '\n');
// 공개 빌드(tools/build-world-app-public.mjs rewrite)와 같은 경로 고쳐 쓰기
function rw(text, rel) {
  text = text.replaceAll('../synk-world-home/', rel.startsWith('brand-opening/') ? '../' : './');
  if (!rel.includes('/')) text = text.replaceAll('../brand-opening/', './brand-opening/');
  return text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g, (_, q, f) => `${q}/world/${f}`);
}
const PUB_GIT = path.join(os.homedir(), 'Documents', 'synk-vendor', 'synk-policy-publish.git');
const published = rel => { try { return execFileSync('git', ['--git-dir', PUB_GIT, 'show', `HEAD:world/${rel}`], {maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore']}); } catch { return null; } };
const live = async rel => { const r = await fetch(`https://synk.im/world/${rel}?probe=${Date.now()}`, {cache: 'no-store'}); if (!r.ok) throw Error(`공개본을 못 받음 ${r.status} ${rel}`); return lf(await r.text()); };
const mine = git('log', '--reverse', '--format=%H', `--grep=${TITLE}`, END).toString().trim().split('\n').filter(Boolean);
if (!mine.length) throw Error(`이 일의 커밋이 ${END}에 없다(${TITLE})`);
const BASE = git('rev-parse', `${mine[0]}^`).toString().trim();
// 기준 · 새 판 · 항목만 지운다. 후보 폴더(cand*)는 검수 사슬이 바이트를 묶고 있어 남긴다.
for (const name of ['base', 'new', '항목.txt']) fs.rmSync(path.join(OUT, name), {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
const srcOf = rel => rel.startsWith('brand-opening/') ? `experiences/${rel}` : `experiences/synk-world-app/${rel}`;
// 바탕 판에 이 일의 커밋만 얹는다(그 파일의 diff를 차례로). 남의 커밋은 싣지 않는다.
function mineOnly(src) {
  const tmp = fs.mkdtempSync(path.join(OUT, 'm-')), file = path.join(tmp, 'f');
  fs.writeFileSync(file, lf(git('show', `${BASE}:${src}`).toString()));
  for (const c of mine) {
    const d = lf(git('diff', `${c}^`, c, '--', src).toString());
    if (!d.trim()) continue;
    const patch = path.join(tmp, 'p.diff');
    fs.writeFileSync(patch, d.replaceAll(`a/${src}`, 'a/f').replaceAll(`b/${src}`, 'b/f'));
    execFileSync('git', ['-c', 'core.autocrlf=false', 'apply', '--recount', '--unsafe-paths', `--directory=${path.relative(ROOT, tmp).replaceAll('\\', '/')}`, '-p1', patch], {cwd: ROOT});
  }
  const text = fs.readFileSync(file, 'utf8'); fs.rmSync(tmp, {recursive: true, force: true}); return text;
}
function merge3(tag, liveText, baseText, mineText) {
  const dir = fs.mkdtempSync(path.join(OUT, 'g-')), a = path.join(dir, 'live'), b = path.join(dir, 'base'), c = path.join(dir, 'mine');
  fs.writeFileSync(a, liveText); fs.writeFileSync(b, baseText); fs.writeFileSync(c, mineText);
  let out, conflicts = 0;
  try { out = execFileSync('git', ['merge-file', '-p', '--diff3', a, b, c]).toString(); } catch (e) { out = e.stdout.toString(); conflicts = e.status; }
  fs.rmSync(dir, {recursive: true, force: true});
  if (conflicts) { fs.writeFileSync(path.join(OUT, `겹침-${tag.replaceAll('/', '_')}.txt`), out); throw Error(`${tag}: 공개본과 겹침 ${conflicts}곳 — ${OUT}`); }
  return out;
}
const write = (dir, rel, data) => { const f = path.join(OUT, dir, 'world', rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, data); };
const changed = new Set(mine.flatMap(c => git('diff-tree', '--no-commit-id', '--name-only', '-r', c).toString().trim().split('\n')).filter(Boolean));
const MERGED = ['app-shell.mjs'], NEW = ['world-learn-soon.mjs'];
const items = [];
for (const rel of MERGED) {
  const src = srcOf(rel);
  if (!changed.has(src)) continue;
  const pub = await live(rel);
  const text = merge3(rel, pub, rw(lf(git('show', `${BASE}:${src}`).toString()), rel), rw(mineOnly(src), rel));
  write('base', rel, pub); write('new', rel, text); items.push(`world/${rel}`);
}
for (const rel of NEW) {
  const src = srcOf(rel);
  if (!changed.has(src)) continue;
  // synk.im 주소는 부르지 않는다(머리 주석). 공개 도구의 git 사본에 이미 있으면 그 판을 기준에 둔다.
  write('new', rel, rw(lf(git('show', `${END}:${src}`).toString()), rel)); items.push(`world/${rel}`);
  const was = published(rel);
  if (was) write('base', rel, was);
  console.log(`${rel}: ${was ? '공개된 판을 기준으로' : '공개본에 없음 — 새 파일로'}`);
}
// 공개본의 app-shell.mjs가 새 모듈을 부르는지, 새 모듈의 스위치가 켜져 있는지
const shell = fs.readFileSync(path.join(OUT, 'new', 'world', 'app-shell.mjs'), 'utf8');
if (!/^import \{installLearnSoon\} from '\.\/world-learn-soon\.mjs';$/m.test(shell) || !/^installLearnSoon\(\{lang:currentLang,/m.test(shell)) throw Error('후보 app-shell.mjs에 준비 중 안내 두 줄이 없다');
const outside = [...changed].filter(f => f.startsWith('experiences/') && ![...MERGED, ...NEW].some(rel => srcOf(rel) === f) && !/\/qa\//.test(f) && f !== 'experiences/synk-world-app/server.mjs');
if (outside.length) console.log('공개하지 않는 원천(확인):', outside.join(' '));
fs.writeFileSync(path.join(OUT, '항목.txt'), items.join('\n') + '\n');
const posix = p => p.replaceAll('\\', '/');
console.log(`끝 ${git('rev-parse', '--short', END).toString().trim()} · 바탕 ${BASE.slice(0, 9)} · 이 일의 커밋 ${mine.length}개 · 항목 ${items.length}개`);
console.log(['node tools/공개.js 올리기', '--원본', posix(path.join(OUT, 'new')), '--기준폴더', posix(path.join(OUT, 'base')), ...items, '--후보폴더', posix(path.join(OUT, 'cand'))].join(' '));
