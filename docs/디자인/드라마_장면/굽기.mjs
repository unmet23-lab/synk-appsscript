// 드라마 장면 화면 시안 굽기(11-02) — docs/디자인/펠트스크랩북/보기용만들기.mjs와 같은 방식.
// _src_시안.html(원고)에 쓰인 글자만 남긴 SUIT · Inter Tight · DM Mono를 data URI로 심어 .tmp/drama-scene-design/에 내보낸다.
// 장면 사진(img/)은 저장소에 없는 승인 칸 그림이라 .tmp/drama-webtoon-20261030/쇼케이스/img/에 있으면 함께 복사한다.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const OUT = path.resolve(REPO, '.tmp/drama-scene-design');
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const IMG = path.join(REPO, '.tmp/drama-webtoon-20261030/쇼케이스/img');
for (const n of ['p11-hello.jpg', 'p12-intro.jpg', 'p13-wave.jpg']) if (fs.existsSync(path.join(IMG, n))) fs.copyFileSync(path.join(IMG, n), path.join(OUT, 'img', n));
let html = fs.readFileSync(path.join(HERE, '_src_시안.html'), 'utf8');
const kitCss = fs.readFileSync(`${REPO}/docs/디자인/펠트스크랩북/scrapbook.css`, 'utf8');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feltfont-'));
const chars = new Set(); for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c));
for (const ch of '‘’“”·…→←↗×✓%₩°•–—−~「」○') chars.add(ch);
for (const ch of html) if (ch.codePointAt(0) >= 0x20) chars.add(ch);
const list = path.join(tmp, 'chars.txt'); fs.writeFileSync(list, [...chars].join(''), 'utf8');
const subset = (src, name) => {
 const out = path.join(tmp, name);
 const r = spawnSync('python', ['-m', 'fontTools.subset', src, `--text-file=${list}`, `--output-file=${out}`, '--flavor=woff2', '--layout-features=*', '--no-hinting'], { encoding: 'utf8' });
 if (r.status !== 0) throw new Error(r.stderr);
 return `url(data:font/woff2;base64,${fs.readFileSync(out).toString('base64')}) format('woff2')`;
};
const F = `${REPO}/docs/브랜드_폰트`;
const faces = [
 `@font-face{font-family:'SUIT Variable';font-weight:100 900;font-display:swap;src:${subset(`${F}/SUIT/SUIT-Variable.woff2`, 'suit.woff2')}}`,
 `@font-face{font-family:'Inter Tight';font-weight:400 600;font-display:swap;src:${subset(`${F}/InterTight/InterTight-Medium.ttf`, 'it500.woff2')}}`,
 `@font-face{font-family:'Inter Tight';font-weight:700 900;font-display:swap;src:${subset(`${F}/InterTight/InterTight-Bold.ttf`, 'it700.woff2')}}`,
 `@font-face{font-family:'DM Mono';font-weight:400;font-display:swap;src:${subset(`${F}/DM_Mono/DMMono-Regular.ttf`, 'dm400.woff2')}}`,
 `@font-face{font-family:'DM Mono';font-weight:500 700;font-display:swap;src:${subset(`${F}/DM_Mono/DMMono-Medium.ttf`, 'dm500.woff2')}}`,
].join('\n');
fs.rmSync(tmp, { recursive: true, force: true });
if (!html.includes('/*FONTS*/')) throw new Error('원고에 /*FONTS*/ 자리가 없음');
html = html.replace('/*FONTS*/', faces);
html = html.replace('<style>', `<style>\n${kitCss}\n</style>\n<style>`);

const files = {};
for (const m of html.matchAll(/(assets|img|ref)\/([a-z0-9-]+\.(?:webp|jpg))/g)) files[`${m[1]}/${m[2]}`] = `${m[1]}/${m[2]}`;
fs.writeFileSync(path.join(OUT, '시안.html'), html);
fs.writeFileSync(path.join(OUT, '미리보기.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${html}`);
fs.writeFileSync(path.join(HERE, 'files.json'), JSON.stringify(files, null, 1));
console.log(JSON.stringify({ bytes: Buffer.byteLength(html), files: Object.keys(files).length }));
