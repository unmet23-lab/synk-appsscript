#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = process.env.SYNK_SOURCE_REPO || path.resolve(__dirname, '../../..');
const loom = require(path.join(repo, 'tools/lib/loom.js'));
const tokens = loom.정본();
const colors = { paper:'Paper',ink:'Ink',oat:'Oat',stone:'Stone','deep-wool':'Deep Wool','lapis-deep':'Lapis Deep','coral-deep':'Coral 3' };
const theme = loom.css({ 지면:'부품만', 구움:false }) + '\n/* Current brand tokens consumed by this page. */\n:root{\n'
  + Object.entries(colors).map(([key,name]) => `--room-${key}:${tokens.색[name]};`).join('\n')
  + `\n--room-font:${tokens.서체.본문스택};\n--synk-focus:var(--room-coral-deep);\n--synk-focus-surface:var(--room-paper);\n}\n`;
fs.writeFileSync(path.join(__dirname,'theme.css'),theme);
fs.mkdirSync(path.join(__dirname,'assets'),{ recursive:true });
const assets = [
  ['docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','SUIT-Variable.woff2'],
  ['docs/브랜드_폰트/SUIT/LICENSE_OFL.txt','SUIT-LICENSE_OFL.txt'],
  ['docs/브랜드_폰트/InterTight/InterTight-Regular.ttf','InterTight-Regular.ttf'],
  ['docs/브랜드_폰트/InterTight/OFL.txt','InterTight-OFL.txt']
];
for (const [source,name] of assets) fs.copyFileSync(path.join(repo,source),path.join(__dirname,'assets',name));
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
let sourceBaseCommit = null;
try { sourceBaseCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(); } catch (_) { /* Hashes still identify available sources. */ }
const sharedImage = path.resolve(__dirname,'../pulse/assets/felt-city.png');
const provenance = {
  sourceRepository:'SYNK-appsscript',
  sourceBaseCommit,
  themeSource:'tools/lib/loom.js',
  themeSourceSHA256:sha(fs.readFileSync(path.join(repo,'tools/lib/loom.js'))),
  tokenSource:'docs/디자인_토큰.json',
  tokenSourceSHA256:sha(fs.readFileSync(path.join(repo,'docs/디자인_토큰.json'))),
  fonts:assets.filter(([source]) => !source.endsWith('.txt')).map(([source,name]) => ({ source,output:'assets/'+name,sha256:sha(fs.readFileSync(path.join(__dirname,'assets',name))) })),
  sharedImage:{path:'../pulse/assets/felt-city.png',status:fs.existsSync(sharedImage)?'observed':'missing',sha256:fs.existsSync(sharedImage)?sha(fs.readFileSync(sharedImage)):null}
};
fs.writeFileSync(path.join(__dirname,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
const evidencePath = path.join(__dirname,'evidence.json');
if (!fs.existsSync(evidencePath)) fs.writeFileSync(evidencePath,JSON.stringify({
  artifact:'마지막 불빛 · 접근성 감상실', date:'2026-09-09',
  implemented:['텍스트 장면 설명','키보드 장면 선택','움직임 줄이기·정지','선택적 브라우저 읽어주기·취소','그림 누락 대체 화면','검수 기록 내려받기'],
  automated:{ status:'not_run' }, keyboard:{ status:'not_run' },
  expertAndUser:{ status:'not_verified', scope:['화면낭독기 실청취','한국어 합성 음성의 실제 청취','전문가·시각/청각장애 당사자 검수','설명이 감상에 충분한지와 실제 이용 편의'] },
  certification:'WCAG 전체 준수 인증 아님', sourceAudio:'없음 — 음원 전사·가사·효과음 만들지 않음'
},null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'evidence.js'),'window.SYNK_ACCESSIBILITY_EVIDENCE = '+fs.readFileSync(evidencePath,'utf8').trim()+';\n');
console.log('Built Loom theme, bundled fonts, provenance and evidence wrapper.');
