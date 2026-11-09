#!/usr/bin/env node
// 화면배율 — 화면에 얹은 그림 · 영상이 실제 화소의 몇 배로 늘어나는지 쓸어 잰다(읽기만, 2026-11-09).
// 눈 검수와 미학 맹검은 줄인 그림으로 보므로 이 결함을 못 잡는다. PULSE 첫 화면 쇼릴(1280×800)이 유호님 화면에서 1.7배로 늘어난 채
// 공개까지 갔고 「이런거 보면 화질 너무 꺠져있잖아 … 이런거 쓸바에 안쓰는게 나아」로 돌아왔다(슬롭 점검표 48).
//
//   node tools/화면배율.mjs <주소…> [--기준 1.5] [--json <파일>]
//
// 기기: 유호님 화면(폭 1440 · 1.5배 표시 — 스크린샷 폭 2160) · 큰 모니터(2560 × 1440) · 휴대폰(390 × 844 · 3배).
// 쪽을 끝까지 내려 지연 그림을 깨우고, 받지 않고 미뤄 둔 영상(data-src · data-wide · data-tall)은 그 기기에서 부를 파일의 머리만 받아 잰다.
// naturalWidth는 srcset이면 밀도로 나눈 값이라 쓰지 않는다 — currentSrc를 새로 열어 실제 화소를 잰다.
// 기준을 넘는 칸이 있으면 종료 코드 1이다.
// 못 보는 것: 파일 안의 배율(세로 720p를 잘라 1280×800으로 구운 영상은 파일 크기로만 잰다 — 굽는 도구에서 막는다),
// 눌러야 나오는 단계(의뢰서 중간 단계처럼 — 그 화면의 주소가 없으면 잰 것이 아니다).
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const 기기들 = Object.freeze([
  { 이름: '유호님 화면', w: 1440, h: 900, 화소비: 1.5 },
  { 이름: '큰 모니터', w: 2560, h: 1440, 화소비: 1 },
  { 이름: '휴대폰', w: 390, h: 844, 화소비: 3 },
]);
export const 기본기준 = 1.5;
const 작은칸 = { 폭: 120, 높이: 80 };

/** 칸과 원본 크기, object-fit, 기기 화소비로 실제 화소 대비 배율을 낸다. 원본 크기를 모르면 null. */
export function 늘어난배율({ 칸폭, 칸높이, 원본폭, 원본높이, 맞춤 = 'fill', 화소비 = 1 }) {
  if (!(원본폭 > 0 && 원본높이 > 0 && 칸폭 > 0 && 칸높이 > 0)) return null;
  const 가로 = 칸폭 / 원본폭, 세로 = 칸높이 / 원본높이;
  const 배 = 맞춤 === 'contain' ? Math.min(가로, 세로)
    : 맞춤 === 'none' ? 1
      : 맞춤 === 'scale-down' ? Math.min(1, 가로, 세로)
        : Math.max(가로, 세로); // cover · fill은 더 늘어난 축이 화질을 정한다.
  return Math.round(배 * 화소비 * 100) / 100;
}

/** 쪽 안에서 돈다 — 보이는 그림 · 영상의 칸과 실제 화소를 모은다. */
const 쪽에서재기 = async ({ 폭, 높이 }) => {
  const 캐시 = (window.__화면배율 ||= new Map());
  const 크기읽기 = (주소, 영상) => {
    if (캐시.has(주소)) return 캐시.get(주소);
    const 약속 = new Promise((끝) => {
      const 멈춤 = setTimeout(() => 끝(null), 15000);
      const 다 = (값) => { clearTimeout(멈춤); 끝(값); };
      if (영상) {
        const v = document.createElement('video');
        v.muted = true; v.preload = 'metadata';
        v.addEventListener('loadedmetadata', () => { 다([v.videoWidth, v.videoHeight]); v.removeAttribute('src'); v.load(); }, { once: true });
        v.addEventListener('error', () => 다(null), { once: true });
        v.src = 주소;
      } else {
        const i = new Image();
        i.onload = () => 다([i.naturalWidth, i.naturalHeight]);
        i.onerror = () => 다(null);
        i.src = 주소;
      }
    });
    캐시.set(주소, 약속);
    return 약속;
  };
  const 세로화면 = matchMedia('(max-aspect-ratio: 1/1)').matches;
  const 줄 = [];
  for (const 칸 of document.querySelectorAll('img,video')) {
    const r = 칸.getBoundingClientRect();
    if (r.width < 폭 || r.height < 높이) continue;
    if (칸.checkVisibility && !칸.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const 영상 = 칸.tagName === 'VIDEO';
    const d = 칸.dataset || {};
    const 주소 = 칸.currentSrc || 칸.src || (영상 ? (세로화면 ? d.tall : d.wide) || d.src : '');
    if (!주소) continue;
    const 크기 = await 크기읽기(new URL(주소, location.href).href, 영상);
    if (!크기) { 줄.push({ 종류: 영상 ? '영상' : '그림', 주소, 못읽음: true }); continue; }
    줄.push({ 종류: 영상 ? '영상' : '그림', 주소, 칸폭: r.width, 칸높이: r.height, 맞춤: getComputedStyle(칸).objectFit, 원본폭: 크기[0], 원본높이: 크기[1] });
  }
  return 줄;
};

async function 재기(browser, 주소, 기기) {
  const ctx = await browser.newContext({ viewport: { width: 기기.w, height: 기기.h }, deviceScaleFactor: 기기.화소비, serviceWorkers: 'block' });
  try {
    const page = await ctx.newPage();
    await page.goto(주소, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    const 모음 = new Map();
    const 전체 = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; ; y += Math.round(기기.h * 0.8)) {
      await page.evaluate((위) => window.scrollTo(0, 위), y);
      await page.waitForTimeout(300);
      for (const 칸 of await page.evaluate(쪽에서재기, { 폭: 작은칸.폭, 높이: 작은칸.높이 })) {
        모음.set(`${칸.주소}|${Math.round(칸.칸폭 || 0)}`, 칸);
      }
      if (y >= 전체) break;
    }
    return [...모음.values()].map((칸) => ({
      쪽: 주소, 기기: 기기.이름, 파일: 칸.주소.split('/').pop().split('?')[0], 종류: 칸.종류,
      실제: 칸.못읽음 ? '못 읽음' : `${칸.원본폭}x${칸.원본높이}`,
      칸: 칸.못읽음 ? '' : `${Math.round(칸.칸폭)}x${Math.round(칸.칸높이)}`,
      배율: 칸.못읽음 ? null : 늘어난배율({ ...칸, 화소비: 기기.화소비 }),
    }));
  } finally {
    await ctx.close();
  }
}

async function main(argv) {
  const 주소들 = [];
  let 기준 = 기본기준, 결과파일 = '';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--기준') 기준 = Number(argv[++i]);
    else if (argv[i] === '--json') 결과파일 = argv[++i];
    else 주소들.push(argv[i]);
  }
  if (!주소들.length || !(기준 > 0)) {
    console.error('쓰기: node tools/화면배율.mjs <주소…> [--기준 1.5] [--json <파일>]');
    return 2;
  }
  const { 브라우저열기 } = await import('./lib/검수캡처.mjs');
  const browser = await 브라우저열기();
  const 줄 = [];
  try {
    for (const 주소 of 주소들) for (const 기기 of 기기들) 줄.push(...await 재기(browser, 주소, 기기));
  } finally {
    await browser.close();
  }
  줄.sort((a, b) => (b.배율 ?? 99) - (a.배율 ?? 99));
  if (결과파일) fs.writeFileSync(결과파일, JSON.stringify(줄, null, 1));
  const 못읽음 = 줄.filter((칸) => 칸.배율 === null), 걸림 = 줄.filter((칸) => 칸.배율 !== null && 칸.배율 >= 기준);
  console.log(`칸 ${줄.length} · 기준 ${기준}배 넘음 ${걸림.length} · 크기를 못 읽음 ${못읽음.length}`);
  for (const 칸 of [...못읽음, ...걸림]) {
    console.log(`${String(칸.배율 ?? '?').padStart(5)}  ${칸.기기.padEnd(7)} ${칸.종류} ${칸.파일}  실제 ${칸.실제} · 칸 ${칸.칸}  ${칸.쪽}`);
  }
  return 걸림.length || 못읽음.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((코드) => { process.exitCode = 코드; }, (오류) => { console.error(오류); process.exitCode = 2; });
}
export const 이_파일 = fileURLToPath(import.meta.url);
