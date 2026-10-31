#!/usr/bin/env node
/**
 * T2 휴대폰 무게 — 비교 페이지(카운터 · 홀 판)를 390px 휴대폰 조건으로 열어 첫 표시 시간과 전송량을 잰다(기획 v0.6 §7 「휴대폰 무게」).
 *   node experiences/synk-town/qa/카페0단계시험-20261031/무게재기.mjs <페이지 폴더> <페이지 파일> [회수=3]
 * 조건: Lighthouse 휴대폰 기본값과 같은 「느린 4G」(내려받기 1.6Mbps · 올리기 750kbps · 왕복 150ms) + CPU 4배 느리게.
 * 재는 것: 첫 글자 표시(FCP) · 가장 큰 그림 표시(LCP) · 첫 화면까지 받은 바이트(같은 곳 · 바깥 글꼴 나눠서) · 손님/결 바꾸기 뒤 더 받은 바이트.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { 공용 } from './글판.mjs';
import { 정적서버 } from '../../../../tools/lib/검수캡처.mjs';

const require = createRequire(import.meta.url);
const [폴더, 파일, 회수글 = '3'] = process.argv.slice(2);
if (!폴더 || !파일) { console.error('사용: node 무게재기.mjs <페이지 폴더> <페이지 파일> [회수]'); process.exit(2); }
const { chromium } = require(path.join(공용, 'node_modules', 'playwright'));
const 서버 = await 정적서버(폴더);
let 브라우저;
try { 브라우저 = await chromium.launch({ channel: 'chrome', headless: true }); } catch { 브라우저 = await chromium.launch({ headless: true }); }
const 결과 = [];
try {
  for (let n = 0; n < Number(회수글); n++) {
    const 맥락 = await 브라우저.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
    const 쪽 = await 맥락.newPage();
    const cdp = await 맥락.newCDPSession(쪽);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const 받음 = new Map();
    const 주소 = new Map();
    cdp.on('Network.requestWillBeSent', (e) => 주소.set(e.requestId, e.request.url));
    cdp.on('Network.loadingFinished', (e) => 받음.set(e.requestId, e.encodedDataLength));
    await 쪽.addInitScript(() => {
      window.__잰것 = { fcp: null, lcp: null };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__잰것.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver((l) => { const es = l.getEntries(); window.__잰것.lcp = es[es.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const 시작 = Date.now();
    await 쪽.goto(`${서버.주소}/${encodeURI(파일)}`, { waitUntil: 'load', timeout: 120000 });
    const 열림초 = (Date.now() - 시작) / 1000;
    await 쪽.waitForTimeout(1500);
    const 잰것 = await 쪽.evaluate(() => window.__잰것);
    const 나누기 = () => {
      let 같은곳 = 0, 글꼴 = 0, 그밖 = 0;
      for (const [id, b] of 받음) {
        const u = 주소.get(id) || '';
        if (u.startsWith(서버.주소)) 같은곳 += b; else if (/fonts\.(googleapis|gstatic)\.com/.test(u)) 글꼴 += b; else 그밖 += b;
      }
      return { 같은곳, 글꼴, 그밖 };
    };
    const 첫화면 = 나누기();
    // 손님 바꾸기 · 결 바꾸기를 눌러 본다(미리 받아 둔 그림이면 더 받는 것이 없어야 한다)
    await 쪽.click('#손님-교수'); await 쪽.click('#결-실사'); await 쪽.waitForTimeout(800);
    const 바꾼뒤 = 나누기();
    결과.push({ 회: n + 1, 열림초, fcp: Math.round(잰것.fcp), lcp: Math.round(잰것.lcp), 첫화면KB: Math.round(첫화면.같은곳 / 1024), 글꼴KB: Math.round(첫화면.글꼴 / 1024), 바꾼뒤더KB: Math.round((바꾼뒤.같은곳 - 첫화면.같은곳) / 1024) });
    await 맥락.close();
  }
} finally {
  await 브라우저.close();
  await 서버.닫기();
}
console.log(JSON.stringify(결과, null, 1));
const 가운데 = (k) => 결과.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(결과.length / 2)];
console.log(`가운데값 — FCP ${가운데('fcp')}ms · LCP ${가운데('lcp')}ms · 첫 화면 ${가운데('첫화면KB')}KB(같은 곳) + 글꼴 ${가운데('글꼴KB')}KB · 바꾼 뒤 더 ${가운데('바꾼뒤더KB')}KB`);
