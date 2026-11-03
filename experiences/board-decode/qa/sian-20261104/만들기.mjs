#!/usr/bin/env node
/**
 * 게시판 해독 시안(2026-11-04) — 틀.htm에 사진 · 서체를 심어 자립형 한 장을 만든다(아티팩트로 보이는 판).
 *   node experiences/board-decode/qa/sian-20261104/만들기.mjs <나갈 파일.html> [--찍기 <폴더>]
 * 사진 원본 · 지시문은 공용 작업본 .tmp/board-decode-20261104/sian/(GPT 이미지 2.5 · 구독, 글자 없음).
 * 태오는 승인 얼굴의 웃는 기준 사진(.tmp/me2-20261102/photo-nb/refs/taeo2-smile.jpg)을 작은 원으로만 쓴다.
 * --찍기: 390×844로 A · B 두 판을 처음부터 끝까지 돌려 화면을 찍고 콘솔 오류 · 가로 넘침을 본다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 브랜드폰트 = require(path.join(뿌리, 'tools', 'lib', '브랜드폰트.js'));
const 공용 = 공용작업본(뿌리);
const 원 = path.join(공용, '.tmp', 'board-decode-20261104', 'sian');
const 웹 = path.join(원, '웹');
fs.mkdirSync(웹, { recursive: true });

const 사진 = { board: 'board-bg', tape: 'scene-tape', drum: 'scene-drum', office: 'scene-office', trash: 'scene-trash', new: 'scene-new', busy: 'scene-busy' };
const 찾기 = (이름) => { const f = fs.readdirSync(path.join(원, '판')).filter((x) => x.startsWith(이름 + '_') && x.endsWith('.png')).sort().at(-1); if (!f) throw new Error('사진 없음: ' + 이름); return path.join(원, '판', f); };
function 웹판(입력, 출력, 폭, 품질) {
  const r = spawnSync('python', ['-I', '-c', `from PIL import Image;import sys;i=Image.open(sys.argv[1]).convert('RGB');w=int(sys.argv[3]);i=i.resize((w,round(i.height*w/i.width)),Image.LANCZOS);i.save(sys.argv[2],'WEBP',quality=int(sys.argv[4]),method=6)`, 입력, 출력, String(폭), String(품질)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
}
const 그림 = {};
for (const [키, 이름] of Object.entries(사진)) {
  const 출력 = path.join(웹, 키 + '.webp');
  웹판(찾기(이름), 출력, 780, 74);
  그림[키] = 'data:image/webp;base64,' + fs.readFileSync(출력).toString('base64');
}
{
  const 출력 = path.join(웹, 'taeo.webp');
  const r = spawnSync('python', ['-I', '-c', `from PIL import Image;import sys;i=Image.open(sys.argv[1]).convert('RGB');w,h=i.size;s=min(w,h);t=max(0,int(h*.06));i=i.crop(((w-s)//2,t,(w+s)//2,t+s)).resize((132,132),Image.LANCZOS);i.save(sys.argv[2],'WEBP',quality=82,method=6)`, path.join(공용, '.tmp', 'me2-20261102', 'photo-nb', 'refs', 'taeo2-smile.jpg'), 출력], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  그림.taeo = 'data:image/webp;base64,' + fs.readFileSync(출력).toString('base64');
}

const 틀 = fs.readFileSync(path.join(여기, '틀.htm'), 'utf8');
const 판 = 틀.replace('{{FONT}}', () => 브랜드폰트.블록()).replace('{{PICS}}', () => JSON.stringify(그림));
const 나갈곳 = process.argv[2];
if (!나갈곳) throw new Error('나갈 파일을 준다');
fs.writeFileSync(나갈곳, 판);
console.log(`만듦 ${나갈곳} · ${(판.length / 1048576).toFixed(2)}MB`);

const i = process.argv.indexOf('--찍기');
if (i > 0) {
  const 폴더 = process.argv[i + 1];
  fs.mkdirSync(폴더, { recursive: true });
  const 쪽글 = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}</style></head><body>${판}</body></html>`;
  const 쪽파일 = path.join(폴더, '_쪽.html');
  fs.writeFileSync(쪽파일, 쪽글);
  const { chromium } = require('playwright');
  const 브 = await chromium.launch({ channel: 'chrome', headless: true });
  const 오류 = [], 넘침 = [], 기록 = [];
  const 찍 = async (p, 이름) => { await p.waitForTimeout(900); const n = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (n > 0) 넘침.push(`${이름}: ${n}px`); await p.screenshot({ path: path.join(폴더, 이름 + '.png') }); };
  for (const [ab, f, 이름] of [['B', '제외,보관', 'B보관'], ['A', '한함,폐기', 'A폐기']]) {
    const ctx = await 브.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) 오류.push(`${이름}: ${m.text()}`); });
    p.on('pageerror', (e) => 오류.push(`${이름}: ${e.message}`));
    await p.goto(`${pathToFileURL(쪽파일).href}?ab=${ab}&f=${encodeURIComponent(f)}`);
    await p.evaluate(() => document.fonts.ready);
    await 찍(p, `${이름}_0입구`);
    await p.click('[data-tear="2"]'); await p.waitForTimeout(1000);
    await 찍(p, `${이름}_1게시판`);
    const [w1, w2] = f.split(',');
    await p.click(`.w[data-w="${w1}"]`); await 찍(p, `${이름}_2단서`);
    if (ab === 'B') { await p.click('[data-memo]'); await 찍(p, `${이름}_3메모`); }
    await p.click('[data-clue-x]');
    const 오답 = await p.evaluate(() => { const a = window.__bd.state(); const o = a.order[0].find((x) => !x.ok && x.pic !== 'busy'); return o.t; });
    await p.click(`.opt:has-text("${오답.slice(0, 10)}")`); await 찍(p, `${이름}_4벌어진일`);
    await p.click('[data-scene-x]');
    const 정답 = async () => p.evaluate(() => { const s = window.__bd.state(); const list = s.phase === 'patch' ? s.patchOrder : s.order[s.slot]; return list.find((x) => x.ok).t; });
    await p.click(`.opt:has-text("${(await 정답()).slice(0, 10)}")`); await p.waitForTimeout(500);
    await 찍(p, `${이름}_5둘째칸`);
    await p.click(`.opt:has-text("${(await 정답()).slice(0, 10)}")`); await p.waitForTimeout(1400);
    await 찍(p, `${이름}_6정정쪽지`);
    await p.click(`.opt:has-text("${(await 정답()).slice(0, 10)}")`); await p.waitForTimeout(1400);
    await 찍(p, `${이름}_7끝`);
    await p.click('[data-peek] >> nth=0'); await 찍(p, `${이름}_8엿보기`);
    await p.click('[data-scene-x]'); await p.waitForTimeout(300);
    await p.click('[data-replay]'); await p.waitForTimeout(800);
    await 찍(p, `${이름}_9다시하기`);
    기록.push({ 이름, 수첩: await p.evaluate(() => [...window.__bd.known]), 앨범: await p.evaluate(() => [...window.__bd.album]) });
    await ctx.close();
  }
  // 넓은 화면 한 장
  const ctx = await 브.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => 오류.push(`넓음: ${e.message}`));
  await p.goto(`${pathToFileURL(쪽파일).href}?ab=B`); await p.waitForTimeout(800); await p.screenshot({ path: path.join(폴더, '넓음_입구.png') });
  await 브.close();
  fs.rmSync(쪽파일);
  console.log(JSON.stringify({ 오류, 넘침, 기록 }, null, 1));
}
