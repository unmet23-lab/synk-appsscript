// 견본.html을 claude.ai 보기용 페이지로 바꾼다. 사용: node docs/디자인/펠트스크랩북/보기용만들기.mjs [출력 폴더]
// - html/head/body 껍데기를 빼고(게시할 때 씌워진다), scrapbook.css를 안에 넣는다.
// - 글꼴은 이 페이지에 쓰인 글자만 남겨 data URI로 넣는다(아티팩트는 다른 곳의 글꼴을 막는다).
// - 그림은 assets/·shots/ 경로로 바꾸고 함께 올릴 목록(files.json)을 만든다.
// - 로컬 확인용 preview.html(게시 껍데기를 흉내 낸 것)과 그림 사본도 만든다.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const KITDIR = `${REPO}/docs/디자인/펠트스크랩북`;
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'synk-scrapbook-artifact'));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

let html = fs.readFileSync(`${KITDIR}/견본.html`, 'utf8');
const kitCss = fs.readFileSync(`${KITDIR}/scrapbook.css`, 'utf8');

// 1) 글꼴: 쓰인 글자만 남긴 woff2 → data URI
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kitfont-'));
const chars = new Set(); for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c));
for (const ch of '‘’“”·…→←↗×✓%₩°•–—−~') chars.add(ch);
for (const ch of html) if (ch.codePointAt(0) >= 0x20) chars.add(ch);
const list = path.join(tmp, 'chars.txt'); fs.writeFileSync(list, [...chars].join(''), 'utf8');
const subset = (src, name) => {
  const out = path.join(tmp, name);
  const r = spawnSync('python', ['-m', 'fontTools.subset', src, `--text-file=${list}`, `--output-file=${out}`, '--flavor=woff2', '--layout-features=*', '--no-hinting'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return `url(data:font/woff2;base64,${fs.readFileSync(out).toString('base64')}) format('woff2')`;
};
const F = `${REPO}/docs/브랜드_폰트`;
const fonts = {
  "url(../../브랜드_폰트/SUIT/SUIT-Variable.woff2) format('woff2')": subset(`${F}/SUIT/SUIT-Variable.woff2`, 'suit.woff2'),
  "url(../../브랜드_폰트/InterTight/InterTight-Medium.ttf) format('truetype')": subset(`${F}/InterTight/InterTight-Medium.ttf`, 'it500.woff2'),
  "url(../../브랜드_폰트/InterTight/InterTight-Bold.ttf) format('truetype')": subset(`${F}/InterTight/InterTight-Bold.ttf`, 'it700.woff2'),
  "url(../../브랜드_폰트/DM_Mono/DMMono-Regular.ttf) format('truetype')": subset(`${F}/DM_Mono/DMMono-Regular.ttf`, 'dm400.woff2'),
  "url(../../브랜드_폰트/DM_Mono/DMMono-Medium.ttf) format('truetype')": subset(`${F}/DM_Mono/DMMono-Medium.ttf`, 'dm500.woff2'),
};
for (const [from, to] of Object.entries(fonts)) { if (!html.includes(from)) throw new Error('글꼴 경로 없음: ' + from); html = html.split(from).join(to); }
fs.rmSync(tmp, { recursive: true, force: true });

// 2) 그림 경로
const files = {};
html = html.replace(/\.\.\/\.\.\/마케팅\/맞춤도구\/assets\/([a-z0-9-]+\.webp)/g, (_, f) => { files[`assets/${f}`] = `docs/마케팅/맞춤도구/assets/${f}`; return `assets/${f}`; });
const shots = { '도구_결과_데스크톱.webp': 'tool-result-desktop.webp', '도구_첫화면_데스크톱.webp': 'tool-intro-desktop.webp', '도구_결과_휴대폰.webp': 'tool-result-phone.webp', '링크카드_회의.webp': 'linkcard-meeting.webp', '링크카드_컴퓨터.webp': 'linkcard-computer.webp' };
for (const [ko, en] of Object.entries(shots)) { const from = `대표/${ko}`; if (!html.includes(from)) throw new Error('캡처 경로 없음: ' + from); html = html.split(from).join(`shots/${en}`); files[`shots/${en}`] = `docs/디자인/펠트스크랩북/대표/${ko}`; }
if (/\.\.\/\.\.\//.test(html.replace(/<pre[\s\S]*?<\/pre>/, ''))) throw new Error('바꾸지 못한 상대 경로가 남음');

// 3) 껍데기 빼고 양식 CSS 넣기
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = html.match(/<style>[\s\S]*?<\/style>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const page = `${title}\n<!-- SYNK 디자인 양식 견본. 원문: SYNK-appsscript/docs/디자인/펠트스크랩북 (README.md · scrapbook.css · 견본.html). 이 페이지는 저장소 견본을 옮긴 보기용이다. -->\n<style>\n${kitCss}\n</style>\n${styles}\n${body.trim()}\n`;
fs.writeFileSync(path.join(OUT, 'SYNK_펠트스크랩북.html'), page);
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify(files, null, 1));
for (const [to, from] of Object.entries(files)) fs.copyFileSync(path.join(REPO, from), path.join(OUT, to));
fs.writeFileSync(path.join(OUT, 'preview.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n${page}</body></html>`);
console.log(JSON.stringify({ bytes: Buffer.byteLength(page), files: Object.keys(files).length }));
