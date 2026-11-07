// 8번 폰 화면 다시 녹화(2026-11-07, Claude — 최종 편집) — 받은 판의 손가락 자취(폰추적.py → 폰입히기.py가 만든 계획)대로 공개 캐스팅북을 프레임마다 찍는다.
// 10-25 녹화(녹화.cjs)는 원본 손가락 시각에 맞춘 것이고, 그사이 보드가 바뀌었다(모델 13 → 21 · 그룹 두 팀 칸 · 「영상으로 보기」 단추 · 「13명을 앞에 세웠어요」).
// 그래서 지금 화면을 판의 손가락에 맞춰 다시 찍는다(콘티 3절 4 · 5단계 — 끌기 동안 손끝과 1:1, 뗀 뒤 지수로 멈춤, 누름은 손가락이 덮은 동안 바뀜).
//   node 녹화_따라.cjs <계획.json>   계획: { id, route, ask, fps, frames: [{ y, press?, open? }], strip?, zoom?: { scrollY, tileCode }, hideToast? }
//   → <계획 폴더>/<id>/raw/0000.png …(393×805 · 3배 = 1179×2415, 상태 표시줄 없음) · zoom/before.png · after.png · clip.json(극접사만)
// 녹화.cjs와 같은 화면 조건(아이폰 15 크기 · 움직임 줄이기 · 마우스 없이 누름 — 10-27 Fable P2 :hover 확대)을 쓴다.
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("C:/Users/q1212/Documents/SYNK-appsscript/node_modules/playwright");
const B = "https://synk.im/pulse/casting/";

async function settleImages(page) {
  await page.evaluate(async () => {
    for (const im of document.images) { im.loading = "eager"; }
    await Promise.all([...document.images].filter((im) => im.getBoundingClientRect().width > 0).map((im) => (im.complete ? (im.decode ? im.decode().catch(() => {}) : 0) : new Promise((r) => { im.onload = im.onerror = r; }))));
    await document.fonts.ready;
  });
}

async function open(browser, plan, dpr = 3) {
  const ctx = await browser.newContext({ ...devices["iPhone 15"], viewport: { width: 393, height: 805 }, screen: { width: 393, height: 852 }, deviceScaleFactor: dpr, locale: "ko-KR", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(B + "#board", { waitUntil: "networkidle" });
  if (plan.hideToast) await page.addStyleTag({ content: "#toast{display:none!important}" });   // 17번: 누름 알림 상자 없이 칩만 바뀌게(Fable v1 · v3)
  if (plan.ask) { await page.fill("#q", plan.ask); await page.waitForTimeout(700); await page.locator("#q").blur(); }
  if (plan.route !== "#board") { await page.evaluate((h) => { location.hash = h; }, plan.route); await page.waitForTimeout(1200); }
  // 지나갈 자리의 그림을 미리 다 불러 둔다(빠른 넘김 프레임에 빈 칸이 찍히지 않게)
  const ys = plan.frames.map((f) => f.y);
  const lo = Math.max(0, Math.min(...ys) - 900), hi = Math.max(...ys) + 1800;
  for (let y = lo; y <= hi; y += 300) { await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y); await page.waitForTimeout(160); }
  await settleImages(page);
  await page.waitForTimeout(600);
  return { ctx, page };
}

(async () => {
  const planPath = process.argv[2];
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const dir = path.join(path.dirname(planPath), plan.id);
  const raw = path.join(dir, "raw");
  fs.rmSync(raw, { recursive: true, force: true }); fs.mkdirSync(raw, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const { ctx, page } = await open(browser, plan);
  console.log(plan.id, "프레임", plan.frames.length, await page.title());
  if (plan.strip != null) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), plan.frames[0].y);
    await page.evaluate((i) => { const s = document.querySelector("#strip"); const f = s.querySelectorAll("figure")[i]; s.scrollTo({ left: f.offsetLeft - (parseFloat(getComputedStyle(s).paddingLeft) || 0), behavior: "instant" }); }, plan.strip);
    await page.waitForTimeout(500); await settleImages(page);
  }
  let opened = false, pressed = false;
  const states = [];
  for (let i = 0; i < plan.frames.length; i++) {
    const f = plan.frames[i];
    if (f.open && !opened) {
      await page.click("#strip figure:nth-child(" + (plan.strip + 1) + ") button"); await page.waitForTimeout(500); await settleImages(page); opened = true;
    }
    if (f.press && !pressed) {
      await page.$eval(`.tile[data-code='${plan.pressCode}'] .add`, (el) => el.click()); await page.waitForTimeout(150); pressed = true;
    }
    const y = Math.round(f.y * 3) / 3;
    if (!opened) await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(40);
    const real = await page.evaluate(() => scrollY);
    await page.screenshot({ path: path.join(raw, `${String(i).padStart(4, "0")}.png`) });
    states.push({ i, y, real, opened, pressed });
  }
  await ctx.close();
  if (plan.zoom) {
    // 극접사(9배) — 10-25 판과 같은 화면 자리(타일이 화면 위에서 같은 높이)에 오게 스크롤해 누르기 전 · 뒤를 찍는다
    const { ctx: c9, page: p9 } = await open(browser, { ...plan, frames: [{ y: plan.zoom.scrollY }] }, 9);
    await p9.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), plan.zoom.scrollY); await p9.waitForTimeout(500); await settleImages(p9);
    const box = await p9.evaluate((code) => { const t = document.querySelector(`.tile[data-code='${code}']`); const b = t.getBoundingClientRect(); const a = t.querySelector(".add").getBoundingClientRect(); return { tile: { x: b.x, y: b.y, w: b.width, h: b.height }, add: { x: a.x, y: a.y, w: a.width, h: a.height } }; }, plan.zoom.tileCode);
    const clip = plan.zoom.clip || { x: 0, y: Math.max(0, box.tile.y - 40), width: 260, height: Math.min(805 - Math.max(0, box.tile.y - 40), 300) };
    const zdir = path.join(dir, "zoom"); fs.rmSync(zdir, { recursive: true, force: true }); fs.mkdirSync(zdir, { recursive: true });
    await p9.screenshot({ path: path.join(zdir, "before.png"), clip });
    await p9.$eval(`.tile[data-code='${plan.zoom.tileCode}'] .add`, (el) => el.click()); await p9.waitForTimeout(300);
    await p9.screenshot({ path: path.join(zdir, "after.png"), clip });
    fs.writeFileSync(path.join(zdir, "clip.json"), JSON.stringify({ clip, dpr: 9, box, scrollY: plan.zoom.scrollY }, null, 1));
    console.log(plan.id, "극접사 자리", JSON.stringify(clip), JSON.stringify(box.add));
    await c9.close();
  }
  fs.writeFileSync(path.join(dir, "states.json"), JSON.stringify({ ...plan, frames: undefined, n: states.length, states }, null, 1));
  await browser.close();
  const off = states.filter((s) => !s.opened && Math.abs(s.real - s.y) > 1);
  console.log(plan.id, "끝", off.length ? `스크롤이 계획과 다른 장 ${off.length}(페이지 끝 등)` : "");
})();
