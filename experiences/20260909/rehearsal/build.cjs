/* Generate self-contained brand assets from the CURRENT canonical sources.
   node experiences/20260909/rehearsal/build.cjs --source-root C:/.../SYNK-appsscript */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const at = process.argv.indexOf('--source-root');
const sourceRoot = path.resolve(at >= 0 ? process.argv[at + 1] : path.join(__dirname, '../../..'));
const target = path.join(__dirname, 'assets');
fs.mkdirSync(target, { recursive: true });
const cleanText = text => text.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').trimEnd() + '\n';
const loom = require(path.join(sourceRoot, 'tools/lib/loom.js'));
const font = require(path.join(sourceRoot, 'tools/lib/브랜드폰트.js'));
const logo = require(path.join(sourceRoot, 'tools/lib/로고정본.js'));
const t = loom.정본(); const c = t.색; const s = t.율.단계;
const palette = { paper: c.Paper, ink: c.Ink, brand: c['Lapis Deep'], muted: c['Deep Wool'],
  border: c.Oat, 'border-strong': c['Deep Wool'], coral3: c['Coral 3'] };
const spacing = { 's-small': s.숨.px, 's-gap': s.틈.px, 's-unit': s.칸.px,
  's-block': s.단.px, 's-section': s.켜.px, 's-chapter': s.장.px };
const ink = c.Ink.slice(1).match(/../g).map(x => parseInt(x,16)).join(',');
const variables = `:root{${Object.entries(palette).map(([k,v])=>`--${k}:${v};`).join('')}${Object.entries(spacing).map(([k,v])=>`--${k}:${v}px;`).join('')}--font:${t.서체.본문스택};--dialog-shade:rgba(${ink},.35);}`;
const interSource = 'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf';
const interBoldSource = 'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf';
fs.copyFileSync(path.join(sourceRoot, interSource), path.join(target, 'InterTight-Medium.ttf'));
fs.copyFileSync(path.join(sourceRoot, interBoldSource), path.join(target, 'InterTight-Bold.ttf'));
fs.writeFileSync(path.join(target, 'SUIT-LICENSE.txt'), cleanText(fs.readFileSync(path.join(sourceRoot, 'docs/브랜드_폰트/SUIT/LICENSE_OFL.txt'), 'utf8')));
fs.writeFileSync(path.join(target, 'InterTight-LICENSE.txt'), cleanText(fs.readFileSync(path.join(sourceRoot, 'docs/브랜드_폰트/InterTight/OFL.txt'), 'utf8')));
const fonts = `${font.면()}\n${t.서체.낫표교정}\n@font-face{font-family:'Inter Tight';font-weight:100 600;font-display:swap;src:url('./InterTight-Medium.ttf') format('truetype');}\n@font-face{font-family:'Inter Tight';font-weight:601 900;font-display:swap;src:url('./InterTight-Bold.ttf') format('truetype');}`;
fs.writeFileSync(path.join(target, 'loom.css'), cleanText(`/* Generated from current SYNK Loom. Do not hand-edit. */\n${fonts}\n${variables}\n${loom.계정컬렉션()}\n${loom.마케팅실행()}\n`));
const svg = logo.워드마크({ 판: '라이트', 표현: '민', 신호: 'k', 색갈래: '단색' }).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
fs.writeFileSync(path.join(target, 'synk.svg'), cleanText(svg));
const sources = ['AGENTS.md','docs/AI_운영원칙.md','DESIGN.md','docs/명품_기준_v1.md','docs/디자인_토큰.json',
  'docs/로고_중립색_정본_v1.md','docs/마케팅_정본.md','docs/SYNK_철학.md','tools/lib/loom.js','tools/lib/브랜드폰트.js',
  'tools/lib/로고정본.js','docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', interSource, interBoldSource,
  'docs/브랜드_폰트/SUIT/LICENSE_OFL.txt','docs/브랜드_폰트/InterTight/OFL.txt'];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = { sourceRoot, sourceHead: execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),
  sources: sources.map(file=>({file,sha256:sha(path.join(sourceRoot,file))})),
  outputs: ['loom.css','synk.svg','InterTight-Medium.ttf','InterTight-Bold.ttf','SUIT-LICENSE.txt','InterTight-LICENSE.txt'].map(file=>({file,sha256:sha(path.join(target,file))})) };
fs.writeFileSync(path.join(__dirname,'source-manifest.json'), JSON.stringify(manifest,null,2)+'\n');
console.log('Generated Loom CSS, local fonts and the neutral SYNK mark. Source manifest saved.');
