#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 브랜드폰트 = require('./lib/브랜드폰트.js');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'SHIFT', '네이버_스타일');
const LOGO = path.join(
  ROOT,
  'docs',
  '홍보물',
  '마케팅실행_20260909',
  '브랜드킷',
  '배치용',
  'SYNK-SHIFT-Ink.png',
);
const OUTPUT = path.join(OUT_DIR, 'synkshift_네이버_스킨.png');

function chromePath() {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Google Chrome 실행 파일을 찾지 못했습니다.');
  return found;
}

function fileUrl(file) {
  return `file:///${path.resolve(file).replace(/\\/g, '/')}`;
}

function buildHtml() {
  const logo = fs.readFileSync(LOGO).toString('base64');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
${브랜드폰트.블록()}
<style>
  *{box-sizing:border-box}
  html,body{margin:0;width:3000px;height:700px;overflow:hidden;background:#FBF7F0}
  body{font-family:'SYNK Bracket','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;color:#2B2320}
  .paper{position:absolute;inset:0;background:#FBF7F0}
  .paper:before{content:"";position:absolute;inset:-10%;opacity:.19;filter:url(#wool)}
  .paper:after{content:"";position:absolute;left:0;right:0;bottom:78px;height:2px;background:#FBCAAB;opacity:.78}
  .safe{position:relative;width:940px;height:700px;margin:0 auto;display:grid;grid-template-columns:280px 1fr;gap:48px;align-items:center;padding:0 18px 44px}
  .logo{width:280px;height:auto;display:block;filter:drop-shadow(0 8px 18px rgba(43,35,32,.09))}
  .copy{min-width:0}
  .eyebrow{display:flex;align-items:center;gap:14px;margin:0 0 24px;font-size:20px;font-weight:600;letter-spacing:.08em;color:#575046}
  .signal{width:13px;height:13px;border-radius:4px;background:#F96859;box-shadow:inset 0 0 0 1px rgba(43,35,32,.08)}
  h1{margin:0;font-size:52px;line-height:1.13;font-weight:800;letter-spacing:-.045em;text-wrap:balance}
  p{margin:22px 0 0;font-size:22px;line-height:1.55;font-weight:500;letter-spacing:-.025em;color:#575046;word-break:keep-all}
</style></head>
<body>
<svg width="0" height="0" aria-hidden="true"><filter id="wool" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency=".62 .35" numOctaves="3" seed="41" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 .89 0 0 0 0 .85 0 0 0 0 .78 0 0 0 .34 -.16"/>
</filter></svg>
<div class="paper"></div>
<main class="safe">
  <img class="logo" alt="SYNK SHIFT" src="data:image/png;base64,${logo}">
  <section class="copy">
    <div class="eyebrow"><i class="signal"></i><span>유호</span></div>
    <h1>AI와 회사 만들기</h1>
    <p>브랜드와 콘텐츠를 만들고, 반복 업무를 줄이는 방법</p>
  </section>
</main>
</body></html>`;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-naver-skin-'));
  const html = path.join(temp, 'skin.html');
  const profile = path.join(temp, 'chrome-profile');
  fs.writeFileSync(html, buildHtml(), 'utf8');
  const result = spawnSync(chromePath(), [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=3000,700',
    `--user-data-dir=${profile}`,
    `--screenshot=${OUTPUT}`,
    fileUrl(html),
  ], { encoding: 'utf8', windowsHide: true });
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!path.resolve(temp).startsWith(tempRoot) || !path.basename(temp).startsWith('synk-naver-skin-')) {
    throw new Error(`임시 폴더 범위가 잘못됐습니다: ${temp}`);
  }
  fs.rmSync(temp, { recursive: true, force: true });
  if (result.status !== 0 || !fs.existsSync(OUTPUT)) {
    throw new Error(`네이버 스킨 렌더 실패: ${result.stderr || result.stdout || result.status}`);
  }
  const size = fs.statSync(OUTPUT).size;
  console.log(`✅ ${path.relative(ROOT, OUTPUT)} · 3000×700 · ${(size / 1048576).toFixed(2)}MB`);
}

if (require.main === module) main();

module.exports = { buildHtml, OUTPUT, LOGO };
