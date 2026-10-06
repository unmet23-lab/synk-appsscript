'use strict';
// 대답 카드 글자 맞춤: 원고의 모든 대답(연습 포함)을 화면 폭마다 실제 펠트 카드에 넣어 본다(헤드리스 크롬, 게임의 fitCards 그대로).
// 걸림: 낱말 중간 끊김, 세 줄 이상, 카드가 늘어남, 글자가 펠트의 평평한 면 밖으로 나감, 번호 단추가 화면 밖.
// 펠트 면은 늘인 쿠션 판 실측 — 왼 5%, 오른 7%, 위 5%, 아래 19%(아래는 쿠션 옆면)를 뺀 곳.
// 쓰는 법: node experiences/talk-rally/server.mjs 를 켠 뒤  node experiences/talk-rally/qa/cards-fit.cjs [폭,폭,…]   (SPLITS=1이면 두 줄 대답이 어디서 접혔는지도)
const path = require('node:path');
const NM = process.env.SYNK_QA_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [NM] }));
const URL_BASE = process.env.RALLY_URL || 'http://127.0.0.1:5221/';
const WIDTHS = (process.argv[2] || '320,360,375,390,414,430,600,768,1024,1280').split(',').map(Number);
const FACE = { l: 0.05, r: 0.07, t: 0.05, b: 0.19 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  let failed = 0;
  for (const w of WIDTHS) {
    const phone = w < 760;
    const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 800 : 820 }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    await page.goto(URL_BASE + '?qa'); await page.waitForSelector('#btn-start'); await sleep(300);
    await page.click('#btn-start');
    await page.waitForFunction(() => window.__rally?.state()?.cur?.phase === 'talk', null, { timeout: 25000 });
    await sleep(300);
    const r = await page.evaluate(async (FACE) => {
      const src = document.querySelector('script[type="module"][src]')?.src || '';
      const m = await import(src.includes('.mjs') ? './content.mjs' : './content.js');   // 공개본은 .mjs가 .js로 바뀌어 있다
      const all = [...new Set([m.PRACTICE, ...m.ITEMS].flatMap((it) => it.options))];
      const box = document.querySelector('#cards'); box.hidden = false;
      const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const out = [];
      for (let k = 0; k < all.length; k += 3) {
        // 게임의 renderCards와 같은 모양으로 셋씩 넣고 게임의 맞춤(fitCards)을 그대로 돌린다
        box.innerHTML = all.slice(k, k + 3).map((word, i) => `<button class="card l${i}" type="button" aria-pressed="false"><span class="no" aria-hidden="true">${i + 1}</span><span class="say">${esc(word)}</span></button>`).join('');
        window.__rally.fitCards();
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        for (const btn of box.children) {
          const say = btn.querySelector('.say'), c = btn.getBoundingClientRect(), no = btn.querySelector('.no').getBoundingClientRect();
          const rg = document.createRange(); rg.selectNodeContents(say);
          const lines = [...rg.getClientRects()].filter((q) => q.width > 1), tops = new Set(lines.map((q) => Math.round(q.top)));
          let L = Infinity, R = -Infinity, T = Infinity, B = -Infinity;
          for (const q of lines) { L = Math.min(L, q.left); R = Math.max(R, q.right); T = Math.min(T, q.top); B = Math.max(B, q.bottom); }
          // 낱말(띄어쓰기 단위)이 두 줄에 걸치면 끊김. 줄마다 낱말을 모아 어디서 접혔는지 남긴다(쉼표 뒤 줄바꿈은 <br>, ‘만날 거예요’는 한 덩어리 span)
          const broken = [], byTop = new Map(), tw = document.createTreeWalker(say, NodeFilter.SHOW_TEXT);
          while (tw.nextNode()) {
            const node = tw.currentNode; let pos = 0;
            for (const tok of node.data.split(' ')) {
              if (tok) {
                const r2 = document.createRange(); r2.setStart(node, pos); r2.setEnd(node, pos + tok.length);
                const ts = [...new Set([...r2.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top)))];
                if (ts.length > 1) broken.push(tok);
                if (ts.length) byTop.set(ts[0], [...(byTop.get(ts[0]) || []), tok]);
              }
              pos += tok.length + 1;
            }
          }
          const face = { l: c.left + c.width * FACE.l, r: c.right - c.width * FACE.r, t: c.top + c.height * FACE.t, b: c.bottom - c.height * FACE.b };
          out.push({ word: say.textContent, split: [...byTop.entries()].sort((x, y) => x[0] - y[0]).map(([, ws]) => ws.join(' ')).join(' / '), comma: !!say.querySelector('br'),
            lines: tops.size, broken, w: Math.round(c.width), h: c.height, margin: Math.min(L - face.l, face.r - R, T - face.t, face.b - B),
            fs: parseFloat(getComputedStyle(say).fontSize), base: parseFloat(getComputedStyle(btn).fontSize), noIn: no.left >= 0 && no.top >= 0 && no.right <= innerWidth });
        }
      }
      return { out, minH: parseFloat(getComputedStyle(box.firstElementChild).minHeight) };
    }, FACE);
    const o = r.out, two = o.filter((x) => x.lines === 2);
    const bad = {
      '낱말 끊김': o.filter((x) => x.broken.length).map((x) => `${x.word}(${x.broken.join('/')})`),
      '세 줄 이상': o.filter((x) => x.lines > 2).map((x) => x.word),
      '카드 늘어남': o.filter((x) => x.h > r.minH + 0.5).map((x) => `${x.word} ${x.h.toFixed(1)}px`),
      '면 밖 글자': o.filter((x) => x.margin < 0).map((x) => `${x.word} ${x.margin.toFixed(1)}px`),
      '번호 화면 밖': o.filter((x) => !x.noIn).map((x) => x.word),
    };
    const fails = Object.entries(bad).filter(([, v]) => v.length);
    failed += fails.length;
    const least = o.reduce((a, x) => (x.margin < a.margin ? x : a));
    console.log(`${fails.length ? '걸림' : '통과'} ${w}px  카드 ${o[0].w}×${r.minH} 글자 ${o[0].base}px  대답 ${o.length}개: 한 줄 ${o.length - two.length - o.filter((x) => x.lines > 2).length} · 두 줄 ${two.length}(쉼표 뒤 ${two.filter((x) => x.comma).length})`
      + `  줄인 카드 ${o.filter((x) => x.fs < x.base).map((x) => `${x.word} ${x.fs}px`).join(', ') || '없음'}  면 안 최소 여백 ${least.margin.toFixed(1)}px(${least.word})`
      + fails.map(([k, v]) => `\n   ${k} ${v.length}: ${v.slice(0, 6).join(' · ')}`).join('')
      + (process.env.SPLITS ? `\n   두 줄: ${two.map((x) => x.split).join(' · ')}` : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `걸림 ${failed}건` : '모든 폭 통과');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
