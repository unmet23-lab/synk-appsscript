#!/usr/bin/env node
// SYNK LAB · TOPIK 4급 첫 연락 — 종이 한 장 안내물을 PNG(대화방·공지 게시용)와 A4 PDF(인쇄·메일 첨부용)로 굽는다.
// 사용: node experiences/lab-topik4/안내문/build.mjs
//         → 이 폴더에 공용판: 몽골어 안내문(flyer.html, QR from=flyer) · 통화용 소개(intro-ko.html · intro-mn.html)
//       node experiences/lab-topik4/안내문/build.mjs --from univ-a-qr,univ-b-qr --out <저장소 밖 폴더>
//         → 몽골어 안내문만, 들어온 곳 키마다 QR을 바꿔 굽는다(학교별 판은 영업 자료라 저장소에 올리지 않는다)
// 먼저: node experiences/lab-topik4/build.mjs(안내문은 신청 페이지 dist의 줄인 글꼴을 쓴다).
//       QR은 segno, 읽어 보기는 OpenCV(python -m pip install --user segno==1.6.6 opencv-python).
// 하는 일: 원고 HTML이 부르는 css·글꼴·그림을 안에 싣고 QR 자리를 채워 Chrome으로 찍은 뒤,
//          글이 종이 밖으로 넘치지 않았는지 · 글꼴이 다 들어왔는지 · 찍힌 PNG의 QR이 그 주소로 읽히는지 확인한다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PAGE = 'https://synk.im/lab/topik4/';
const W = 1240;
const H = 1754;
const MIME = { '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
// 신청 페이지 app.js의 fromKey와 같은 꼴만 받는다(아니면 페이지가 direct로 센다).
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
// QR 없이 한 판씩 굽는 것: 통화·화상 대화를 청하는 메일(11통)에 붙이는 소개.
const SHEETS = [['intro-ko.html', 'synk-intro-ko'], ['intro-mn.html', 'synk-intro-mn']];

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const perKey = opt('--from') !== null;
const keys = (opt('--from') || 'flyer').split(',').map(s => s.trim()).filter(Boolean);
const outDir = path.resolve(opt('--out') || HERE);
for (const k of keys) if (!KEY.test(k)) throw new Error(`들어온 곳 키 꼴이 아니에요(영소문자·숫자·하이픈 40자): ${k}`);
if (!fs.existsSync(path.join(HERE, '../dist/lab/topik4/assets/SUIT-subset.woff2'))) throw new Error('글꼴이 없어요 — 먼저 node experiences/lab-topik4/build.mjs');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-t4-print-'));
const python = (code, ...rest) => {
  // -E -P: 환경 변수와 현재 폴더를 모듈 경로에 넣지 않는다. 사용자 site(segno·OpenCV)는 남긴다.
  const r = spawnSync('python', ['-E', '-P', '-c', code, ...rest], { cwd: work, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) throw new Error(`python 실패(${r.status}): ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  return r.stdout;
};
const qrSvg = url => python("import sys, segno\nsys.stdout.write(segno.make(sys.argv[1], error='m').svg_inline(scale=1, border=4, dark='#08090C', light='#FFFFFF', omitsize=True))", url);
// cv2.imread는 윈도우에서 한글 경로를 못 열어 바이트로 읽어 푼다.
const qrRead = png => python("import sys, cv2, numpy\nimg = cv2.imdecode(numpy.fromfile(sys.argv[1], dtype=numpy.uint8), cv2.IMREAD_COLOR)\nprint(cv2.QRCodeDetector().detectAndDecode(img)[0])", png).trim();

/** 원고가 부르는 css를 <style>로, 상대 경로(url(...)·src="...")를 data:로 바꿔 어디에 놓고 찍어도 같은 모양이 나오게 한다. */
function inline(html, base) {
  const file = rel => {
    const p = path.resolve(base, rel);
    if (!fs.existsSync(p)) throw new Error(`원고가 부르는 파일이 없어요: ${rel}`);
    return p;
  };
  const data = rel => {
    const p = file(rel);
    const type = MIME[path.extname(p).toLowerCase()];
    if (!type) throw new Error(`실을 줄 모르는 파일이에요: ${rel}`);
    return `data:${type};base64,${fs.readFileSync(p).toString('base64')}`;
  };
  return html
    .replace(/<link rel="stylesheet" href="([^":]+\.css)">/g, (_, rel) => `<style>\n${fs.readFileSync(file(rel), 'utf8')}</style>`)
    .replace(/url\((\.\.?\/[^)'"]+)\)/g, (_, rel) => `url(${data(rel)})`)
    .replace(/\bsrc="(\.\.?\/[^"]+)"/g, (_, rel) => `src="${data(rel)}"`);
}

async function shoot(browser, html, name) {
  const tmp = path.join(work, `${name}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  const check = await page.evaluate(async () => {
    await document.fonts.ready;
    const fam = [...document.fonts].filter(f => f.status !== 'loaded').map(f => `${f.family} ${f.weight}`);
    const box = document.querySelector('.page');
    const over = [...box.children].map(el => [el.className || el.tagName, Math.round(el.getBoundingClientRect().bottom)]).filter(([, b]) => b > innerHeight);
    return { fam, over, scroll: box.scrollHeight };
  });
  if (check.fam.length) throw new Error(`${name}: 글꼴이 다 들어오지 않았어요 — ${check.fam.join(', ')}`);
  if (check.over.length || check.scroll > H) throw new Error(`${name}: 글이 종이 밖으로 넘쳐요 — ${JSON.stringify(check)}`);
  const png = path.join(outDir, `${name}.png`);
  const pdf = path.join(outDir, `${name}.pdf`);
  await page.screenshot({ path: png });
  // A4 210mm는 CSS 793.7px — 1240px 판을 그 폭에 맞춰 줄여 한 쪽에 담는다. 링크는 PDF에서도 눌린다.
  await page.pdf({ path: pdf, width: '210mm', height: '297mm', margin: { top: 0, right: 0, bottom: 0, left: 0 }, scale: 793.7 / W, printBackground: true, pageRanges: '1', tagged: true });
  await page.close();
  return { png, pdf };
}

const size = f => `${(fs.statSync(f).size / 1024).toFixed(0)}KB`;
fs.mkdirSync(outDir, { recursive: true });
const flyer = fs.readFileSync(path.join(HERE, 'flyer.html'), 'utf8');
if (flyer.split('{{QR}}').length !== 2) throw new Error('flyer.html에 {{QR}} 자리가 꼭 한 번 있어야 해요');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const key of keys) {
    const url = `${PAGE}?from=${key}&lang=mn`;
    const name = key === 'flyer' ? 'synk-lab-topik4-mn' : `synk-lab-topik4-mn-${key}`;
    const svg = qrSvg(url);
    const { png, pdf } = await shoot(browser, inline(flyer, HERE).replace('{{QR}}', () => svg), name);
    const read = qrRead(png);
    if (read !== url) throw new Error(`${name}: 찍힌 QR이 ${JSON.stringify(read)}로 읽혀요(기대 ${url})`);
    console.log(`${name} — QR ${url} 읽힘 · png ${size(png)} · pdf ${size(pdf)}`);
  }
  if (!perKey) {
    for (const [src, name] of SHEETS) {
      const { png, pdf } = await shoot(browser, inline(fs.readFileSync(path.join(HERE, src), 'utf8'), HERE), name);
      console.log(`${name} — png ${size(png)} · pdf ${size(pdf)}`);
    }
  }
} finally {
  await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
}
