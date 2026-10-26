// 8번 폰 화면 녹화(2026-10-25) — 공개 캐스팅북(synk.im/pulse/casting/)을 휴대폰 크기(393×805 + 위 상태 표시줄 47 = 393×852, 3배)로 프레임마다 찍는다.
// 실시간 녹화가 아니라 프레임마다 스크롤 자리 · 누름 상태를 정해 찍어서, 원본 컷의 손가락 타이밍(원본재기/C??_프레임.jpg)에 프레임 단위로 맞춘다.
// 움직임 줄이기(reducedMotion)로 보드의 움직이는 사진 · 전환을 끄고 같은 프레임이 늘 같게 나오게 한다(누르면 단추가 바로 바뀐다).
//   node 녹화.cjs [R3 R6 R10 R12 R15 R17]  → 녹화/<R>/raw/0000.png …(1179×2415, 상태 표시줄 없음) + 녹화/<R>/states.json
//   다음: python -X utf8 녹화_마감.py → 상태 표시줄을 얹은 1179×2556 프레임 · 미리보기 mp4
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("C:/Users/q1212/Documents/SYNK-appsscript/node_modules/playwright");
const OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8/녹화/";
const B = "https://synk.im/pulse/casting/";
const FPS = 30;
const ASK = "딸기 라떼 신메뉴";

function flick(t, { t0, tr, t1, y0, y1 }) {
  if (t <= t0) return y0;
  const k = 4 / (t1 - tr), d = tr - t0;
  const yr = (2 * y0 / d + k * y1) / (2 / d + k);
  if (t <= tr) { const u = (t - t0) / d; return y0 + (yr - y0) * u * u; }
  const y = y1 - (y1 - yr) * Math.exp(-k * (t - tr));
  return t >= t1 ? y1 - (y1 - yr) * Math.exp(-4) * Math.max(0, 1 - (t - t1) / 0.12) : y;
}
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
// 원본 10번 화면 속 움직임 실측(원본재기 화면움직임.json — 컷 시작부터 초, 누적 px, 24fps를 늘린 같은 프레임은 뺌).
// 0.07초부터 빨라져 0.2~0.5초에 가장 빠르고, 컷 끝(1.00초)까지 천천히 줄며 계속 흐른다.
const C10 = [[0.033, 0], [0.067, 11.2], [0.100, 38.1], [0.134, 75.5], [0.167, 117.4], [0.234, 158.2], [0.267, 195.7], [0.301, 240.2], [0.334, 285.5], [0.401, 327.0], [0.434, 365.6], [0.467, 403.3], [0.501, 437.8], [0.567, 470.0], [0.601, 500.8], [0.634, 530.0], [0.668, 556.8], [0.734, 581.5], [0.768, 606.2], [0.801, 629.6], [0.834, 649.5], [0.901, 665.7], [0.934, 676.3], [0.968, 684.1]];
function measured(t, pts, y0, y1) {
  const end = pts[pts.length - 1][1];
  if (t <= pts[0][0]) return y0;
  for (let i = 1; i < pts.length; i++) {
    const [ta, va] = pts[i - 1], [tb, vb] = pts[i];
    if (t <= tb) return y0 + (y1 - y0) * (va + (vb - va) * (t - ta) / (tb - ta)) / end;
  }
  return y1;
}

const REC = {
  R3: { dur: 1.70, route: "#board", ask: "", scroll: (t) => (t < 0.70 ? flick(t, { t0: 0, tr: 0.13, t1: 0.60, y0: 0, y1: 315 }) : flick(t, { t0: 0.77, tr: 1.13, t1: 1.40, y0: 315, y1: 652 })) },
  R6: { dur: 1.37, route: "#m-F02", ask: "", scroll: (t) => 345 - 28 * ease(t / 1.37) },   // 극접사라 이름 줄과 얼굴을 한 화면에 못 담는다 — 대표 사진의 얼굴이 가운데(5번 쇼핑백 얼굴 → 6번 폰 얼굴)
  // 10번(10-25 Fable P2): 원본처럼 이어서 빠르게 넘긴다 — 넘기며 고르기의 사진 톡톡(뚝뚝 바뀜) 대신 하린 모델 북 「장면」 격자를 끌어 올림. 화면 속 움직임은 원본 실측 곡선 그대로(첫 flick 판은 0.6초에 거의 서서 원본보다 일찍 멈췄다), 700pt = 격자 두세 줄
  R10: { dur: 1.00, route: "#m-F02-scene", ask: "", scroll: (t) => measured(t, C10, 480, 1180) },
  R12: { dur: 0.83, route: "#board", ask: ASK, scroll: (t) => flick(t, { t0: 0, tr: 0.13, t1: 0.36, y0: 120, y1: 303 }) },
  R15: { dur: 1.13, route: "#m-F02", ask: "", strip: 5, scroll: () => 150, openAt: 0.50 },
  R17: { dur: 1.37, route: "#board", ask: ASK, scroll: () => 11, pressAt: 0.83 },
};

async function settleImages(page) {
  await page.evaluate(async () => {
    for (const im of document.images) { im.loading = "eager"; }
    await Promise.all([...document.images].filter((im) => im.getBoundingClientRect().width > 0).map((im) => (im.complete ? (im.decode ? im.decode().catch(() => {}) : 0) : new Promise((r) => { im.onload = im.onerror = r; }))));
    await document.fonts.ready;
  });
}

async function open(browser, rec, dpr = 3) {
  const ctx = await browser.newContext({ ...devices["iPhone 15"], viewport: { width: 393, height: 805 }, screen: { width: 393, height: 852 }, deviceScaleFactor: dpr, locale: "ko-KR", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(B + "#board", { waitUntil: "networkidle" });
  if (rec.ask) { await page.fill("#q", rec.ask); await page.waitForTimeout(600); await page.locator("#q").blur(); }
  if (rec.route !== "#board") { await page.evaluate((h) => { location.hash = h; }, rec.route); await page.waitForTimeout(1200); }
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(H, 2000); y += 400) { await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y); await page.waitForTimeout(250); }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await settleImages(page);
  await page.waitForTimeout(800);
  return { ctx, page };
}

const shoot = (page, file, clip) => page.screenshot({ path: file, ...(clip ? { clip } : {}) });

(async () => {
  const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(REC);
  const browser = await chromium.launch({ channel: "chrome" });
  for (const id of which) {
    const rec = REC[id];
    const dir = path.join(OUT, id, "raw");
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const n = Math.round(rec.dur * FPS);
    const states = [];
    const { ctx, page } = await open(browser, rec);
    console.log(id, "프레임", n, await page.title());
    if (rec.strip != null) {
      await page.evaluate((i) => { const s = document.querySelector("#strip"); const f = s.querySelectorAll("figure")[i]; s.scrollTo({ left: f.offsetLeft - (parseFloat(getComputedStyle(s).paddingLeft) || 0), behavior: "instant" }); }, rec.strip);
      await page.waitForTimeout(500); await settleImages(page);
    }
    if (rec.taps) {
      const shots = [];
      const card = await page.evaluate(() => { const b = document.querySelector("#dcard").getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 3, who: document.querySelector("#dcard").getAttribute("aria-label") }; });
      if (card.who !== "하린") throw Error("첫 장이 하린이 아님: " + card.who);
      for (let k = 0; k <= rec.taps.length; k++) {
        if (k) { await page.mouse.click(card.x, card.y); await page.waitForTimeout(500); await settleImages(page); await page.waitForTimeout(300); }
        const f = path.join(dir, `_state${k}.png`); await shoot(page, f); shots.push(f);
      }
      for (let i = 0; i < n; i++) {
        const t = i / FPS, k = rec.taps.filter((x) => t >= x).length;
        fs.copyFileSync(shots[k], path.join(dir, `${String(i).padStart(4, "0")}.png`));
        states.push({ i, t: +t.toFixed(3), photo: k });
      }
    } else {
      let opened = false, pressed = false;
      for (let i = 0; i < n; i++) {
        const t = i / FPS;
        if (rec.openAt != null && !opened && t >= rec.openAt) {
          await page.click("#strip figure:nth-child(" + (rec.strip + 1) + ") button"); await page.waitForTimeout(500); await settleImages(page); opened = true;
        }
        if (rec.pressAt != null && !pressed && t >= rec.pressAt) {
          await page.$eval(".tile[data-code='F02'] .add", (el) => el.click()); await page.waitForTimeout(150); pressed = true;   // 마우스 없이 누른다 — 아래 극접사판 참고
        }
        const y = rec.scroll ? Math.round(rec.scroll(t) * 3) / 3 : 0;
        if (!opened) await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
        await page.waitForTimeout(40);
        await shoot(page, path.join(dir, `${String(i).padStart(4, "0")}.png`));
        states.push({ i, t: +t.toFixed(3), y, opened, pressed });
      }
    }
    if (id === "R17") {
      await ctx.close();
      const { ctx: c9, page: p9 } = await open(browser, rec, 9);
      await p9.evaluate(() => scrollTo({ top: 11, behavior: "instant" })); await p9.waitForTimeout(400); await settleImages(p9);
      const box = await p9.evaluate(() => { const t = document.querySelector(".tile[data-code='F02']"); const b = t.getBoundingClientRect(); const a = t.querySelector(".add").getBoundingClientRect(); return { tile: { x: b.x, y: b.y, w: b.width, h: b.height }, add: { x: a.x, y: a.y, w: a.width, h: a.height } }; });
      const clip = { x: 0, y: Math.max(0, box.tile.y - 40), width: 260, height: Math.min(805 - Math.max(0, box.tile.y - 40), 300) };
      const zdir = path.join(OUT, id, "zoom"); fs.rmSync(zdir, { recursive: true, force: true }); fs.mkdirSync(zdir, { recursive: true });
      await shoot(p9, path.join(zdir, "before.png"), clip);
      // 마우스로 누르면 타일 위 :hover로 사진이 0.7초에 걸쳐 1.5% 커진다(.tile:hover .ph .base — 손가락 누름에는 없는 일). 10-25 판 after는 그렇게 찍혀
      // 가편집 17번에서 화면이 0.83초에 1.5% 튀었다(10-27 Fable P2) — 마우스 없이 누른다. 그 판은 before에 바뀐 단추 · 알림만 얹어 고쳤다(원판 after_원본.png).
      await p9.$eval(".tile[data-code='F02'] .add", (el) => el.click()); await p9.waitForTimeout(300);
      await shoot(p9, path.join(zdir, "after.png"), clip);
      fs.writeFileSync(path.join(zdir, "clip.json"), JSON.stringify({ clip, dpr: 9, box, scrollY: 11 }, null, 1));
      console.log(id, "극접사 자리", JSON.stringify(clip), JSON.stringify(box.add));
      await c9.close();
    } else await ctx.close();
    fs.writeFileSync(path.join(OUT, id, "states.json"), JSON.stringify({ id, fps: FPS, dur: rec.dur, n, route: rec.route, ask: rec.ask, states }, null, 1));
    console.log(id, "끝");
  }
  await browser.close();
})();
