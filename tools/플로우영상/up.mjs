// 그림 파일을 보완 프로젝트에 올린다(11-11 Claude). V4 = { round, files: ["<절대 경로>.jpg", …] } — 한 번에 다섯 장씩. 「생성 시작」은 누르지 않는다.
const fs = await import("node:fs");
const { pathToFileURL } = await import("node:url");
const L = await import(new URL("./lib.mjs", import.meta.url).href);
const { round: R, files, proj: PJ } = globalThis.V4;
const t0 = Date.now();
if (!L.takeLock(R)) {
  L.step(R, "중복 — 그만둠");
} else {
  try {
    for (const f of files) if (!fs.existsSync(f)) throw new Error("파일 없음 " + f);
    const res = L.loadRes();
    const task = await L.openSpace();
    const pages = await task.pages();
    const page = pages[pages.length - 1];
    await L.unmin(page, R);
    try { await page.goto(res._projects[PJ]); } catch (e) { L.step(R, "goto 느림", { e: String(e).slice(0, 100) }); }
    for (let i = 0; i < 20; i++) {
      const ready = await page.evaluate(() => !!document.querySelector("[role=textbox], [contenteditable=true]") && !!document.querySelector('button[aria-label="설정 트리거"]'));
      if (ready) break;
      await page.waitForTimeout(1500);
    }
    await L.closePicker(page);
    for (let g = 0; g < files.length; g += 5) {
      const part = files.slice(g, g + 5);
      const plus = await page.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const bs = [...document.querySelectorAll("button")].filter(vis);
        document.querySelectorAll("[data-synk-plus]").forEach((e) => e.removeAttribute("data-synk-plus"));
        const hit = bs.filter((b) => /미디어.*추가|추가.*미디어/.test(b.getAttribute("aria-label") || ""));
        if (hit.length === 1) hit[0].setAttribute("data-synk-plus", "1");
        return { n: hit.length };
      });
      if (plus.n !== 1) throw new Error("멈춤 — 미디어 추가 단추를 하나로 못 좁힘");
      await page.click('[data-synk-plus="1"]', { label: "open add media menu" });
      await page.waitForTimeout(1800);
      const menu = await page.evaluate(() => [...document.querySelectorAll("[role=menuitem]")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()));
      if (menu.filter((m) => /업로드/.test(m)).length !== 1) { await page.keyboard.press("Escape"); throw new Error("멈춤 — 메뉴 「업로드」를 하나로 못 좁힘 " + JSON.stringify(menu)); }
      const chooserP = page.waitForFileChooser({ timeout: 15000 });
      chooserP.catch(() => {});
      await page.click('css=[role=menuitem]:has-text("업로드")', { label: "choose upload" });
      const chooser = await chooserP;
      await chooser.setFiles(part);
      L.step(R, "파일 넣음", { files: part.map((f) => f.split("/").pop()) });
      let quiet = 0, last = null;
      for (let i = 0; i < 30 && quiet < 3; i++) {
        await page.waitForTimeout(4000);
        last = await page.evaluate(() => {
          const pl = [...document.querySelectorAll("div.batch-container *")].filter((e) => e.children.length === 0 && /^[0-9 ]{1,4}%$/.test((e.textContent || "").trim()));
          return { pct: pl.length, rows: document.querySelectorAll("div.batch-container").length, dialogs: [...document.querySelectorAll("[role=dialog]")].filter((d) => d.getBoundingClientRect().width > 0).map((d) => (d.innerText || "").replace(/\s+/g, " ").slice(0, 200)) };
        });
        if (last.dialogs.length) break;
        if (i >= 2 && last.pct === 0) quiet++; else quiet = 0;
      }
      L.step(R, "올리기 끝", { part: part.length, ...last });
      if (last.dialogs.length) throw new Error("멈춤 — 올리는 중 창이 뜸");
    }
  } catch (e) {
    L.step(R, "오류", { e: String(e).slice(0, 400) });
  }
  L.step(R, "끝", { totalSec: L.sec(t0) });
}
