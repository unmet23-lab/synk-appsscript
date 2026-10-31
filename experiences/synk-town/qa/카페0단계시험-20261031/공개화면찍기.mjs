#!/usr/bin/env node
/**
 * T1용 — 지금 공개된 화면을 휴대폰 390px로 찍는다(읽기만, 로그인 없음).
 *   node experiences/synk-town/qa/카페0단계시험-20261031/공개화면찍기.mjs <주소> <낼 파일.jpg> [--전체]
 * 첫 화면(390×844)만 찍고, --전체면 쪽 전체를 찍는다. 콘솔 오류 · 실패 요청 수를 함께 찍는다.
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { 공용 } from './글판.mjs';

const require = createRequire(import.meta.url);
const [주소, 낼, ...나머지] = process.argv.slice(2);
if (!주소 || !낼) { console.error('사용: node 공개화면찍기.mjs <주소> <낼.jpg> [--전체]'); process.exit(2); }
const { chromium } = require(path.join(공용, 'node_modules', 'playwright'));
let 브라우저;
try { 브라우저 = await chromium.launch({ channel: 'chrome', headless: true }); } catch { 브라우저 = await chromium.launch({ headless: true }); }
const 맥락 = await 브라우저.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const 쪽 = await 맥락.newPage();
const 오류 = [];
쪽.on('console', (m) => { if (m.type() === 'error') 오류.push(m.text().slice(0, 160)); });
쪽.on('requestfailed', (q) => 오류.push(`요청 실패 ${q.url().slice(0, 120)}`));
const 시작 = Date.now();
await 쪽.goto(주소, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => 오류.push('goto ' + e.message.split('\n')[0]));
await 쪽.waitForTimeout(Number(process.env.WAIT_MS || 2500));
fs.mkdirSync(path.dirname(path.resolve(낼)), { recursive: true });
await 쪽.screenshot({ path: 낼, type: 'jpeg', quality: 88, fullPage: 나머지.includes('--전체') });
console.log(JSON.stringify({ 주소, 최종: 쪽.url(), 제목: await 쪽.title(), 초: (Date.now() - 시작) / 1000, 오류 }, null, 1));
await 브라우저.close();
