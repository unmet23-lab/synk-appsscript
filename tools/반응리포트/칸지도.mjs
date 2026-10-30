#!/usr/bin/env node
/**
 * 광고 반응 리포트 · 칸 지도 — 랜딩 페이지를 휴대폰(390) · PC(1440) 폭으로 열어 칸(section[id])마다 위 · 아래 끝을 쪽 높이의 %로 잰다(2026-10-30).
 * Clarity 평균 스크롤 %를 「평균이 닿는 칸」으로 바꾸는 데 쓴다(랜딩.js 칸얹기). 쪽이 바뀌면 다시 잰다 — 지도에 잰 날 · 쪽 높이 · 칸 목록 해시를 남긴다.
 *
 *   node tools/반응리포트/칸지도.mjs <랜딩 주소> <출력 JSON>
 *
 * 브라우저는 설치된 Chrome(`channel: 'chrome'`) → Edge → Playwright 기본 순서(현장 노트 · 시험 「Codex 런타임의 Playwright는 브라우저가 없어」).
 * 읽기만 한다(쪽을 열고 재기만, 누르거나 쓰지 않는다).
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const 폭들 = [[390, 844], [1440, 900]];

async function 브라우저() {
  const { chromium } = require('playwright');
  for (const 길 of [{ channel: 'chrome' }, { channel: 'msedge' }, {}]) {
    try { return await chromium.launch({ ...길, headless: true }); } catch { /* 다음 길 */ }
  }
  throw new Error('브라우저를 띄우지 못했다(Chrome · Edge · Playwright 기본)');
}

export async function 재기(주소) {
  const b = await 브라우저();
  const 지도들 = [];
  try {
    for (const [폭, 높이] of 폭들) {
      const p = await b.newPage({ viewport: { width: 폭, height: 높이 } });
      await p.goto(주소, { waitUntil: 'networkidle', timeout: 60000 });
      await p.waitForTimeout(1500);
      // 늦게 그려지는 칸을 위해 끝까지 한 번 내렸다 올린다
      await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
      // 글꼴 · 영상이 늦게 들어와 쪽 높이가 흔들리면 칸 %가 틀어진다 — 0.7초 띄워 두 번 재 같을 때까지(세 번까지, 검토 20)
      for (let 번 = 0, 앞 = -1; 번 < 3; 번++) {
        await p.waitForTimeout(700);
        const 높이 = await p.evaluate(() => document.documentElement.scrollHeight);
        if (높이 === 앞) break;
        앞 = 높이;
      }
      const r = await p.evaluate(() => {
        const 쪽 = document.documentElement.scrollHeight;
        const 본 = new Set();
        const 칸 = [];
        for (const s of document.querySelectorAll('section[id]')) {
          if (본.has(s.id) || s.closest('section[id]') !== s) continue; // 안쪽 칸은 바깥 칸에 든다
          본.add(s.id);
          const 상자 = s.getBoundingClientRect();
          if (상자.height < 40) continue;
          const 제목 = (s.querySelector('h1,h2')?.textContent || s.getAttribute('aria-label') || s.id).replace(/\s+/g, ' ').trim().slice(0, 40);
          칸.push({ id: s.id, 제목, 위px: Math.round(상자.top + scrollY), 높이px: Math.round(상자.height) });
        }
        return { 쪽, 창: innerHeight, 칸 };
      });
      const 칸 = r.칸.sort((a, c) => a.위px - c.위px).map((c, i, 모두) => ({
        id: c.id, 이름: c.제목, 위: Math.round((c.위px / r.쪽) * 1000) / 10,
        // 아래 끝은 다음 칸 위까지(칸 사이 틈은 앞 칸에 든다), 마지막 칸은 자기 아래 끝
        아래: Math.round(((i + 1 < 모두.length ? 모두[i + 1].위px : c.위px + c.높이px) / r.쪽) * 1000) / 10,
      }));
      const 해시 = createHash('sha256').update(JSON.stringify(칸.map((c) => [c.id, c.위, c.아래]))).digest('hex').slice(0, 12);
      지도들.push({ 폭, 창높이: r.창, 쪽높이: r.쪽, 잰날: new Date().toISOString().slice(0, 10), 주소, 해시, 칸 });
      await p.close();
    }
  } finally { await b.close(); }
  return 지도들;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('칸지도.mjs')) {
  const [주소, 출력] = process.argv.slice(2);
  if (!주소 || !출력) { console.log('node tools/반응리포트/칸지도.mjs <랜딩 주소> <출력 JSON>'); process.exit(2); }
  재기(주소).then((지도들) => {
    fs.mkdirSync(path.dirname(출력), { recursive: true });
    fs.writeFileSync(출력, JSON.stringify(지도들, null, 1));
    for (const m of 지도들) console.log(`${m.폭}폭 쪽 ${m.쪽높이}px · 칸 ${m.칸.length}: ${m.칸.map((c) => `${c.id} ${c.위}%`).join(' · ')}`);
  }).catch((e) => { console.error(`멈춤: ${e.message}`); process.exit(1); });
}
