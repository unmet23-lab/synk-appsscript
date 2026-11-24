// r01(11-11 Claude): 읽기 · 준비만 — 「생성 시작」은 누르지 않는다.
// ① 작업 공간 → Flow 첫 화면(/u/1) → 계정 창: 메일 · 크레딧 읽기 → 닫기
// ② 보완 프로젝트 하나를 새로 만든다(이미 기록이 있으면 그 주소) ③ 설정 창에서 동영상 · 이미지 모델 목록과 「생성 시 N 크레딧」을 읽는다(고르기만, 내지 않음)
const fs = await import("node:fs");
const { pathToFileURL } = await import("node:url");
const L = await import(new URL("./lib.mjs", import.meta.url).href);
const R = (globalThis.V4 && globalThis.V4.round) || "r01";
const PJ = (globalThis.V4 && globalThis.V4.proj) || "omni";
const t0 = Date.now();
const res = L.loadRes();
try {
  const task = await L.openSpace();
  const pages = await task.pages();
  const page = pages.length ? pages[pages.length - 1] : task.page("p1");
  L.step(R, "작업 공간", { spaceId: task.spaceId || task.id, pages: pages.map((p) => p.label) });
  await L.unmin(page, R);
  res._projects = res._projects || {};
  if (!res._projects[PJ]) {
    await page.goto(L.FLOW_HOME);
    try { await page.waitForLoadState(); } catch {}
    let home = null;
    for (let i = 0; i < 25; i++) {
      home = await page.evaluate(() => ({ url: location.href, home: /새 프로젝트/.test(document.body.innerText || "") }));
      if (home.home) break;
      await page.waitForTimeout(1500);
    }
    L.step(R, "첫 화면", home);
    if (!home.home) throw new Error("멈춤 — Flow 첫 화면이 아님");
    const c0 = await L.readCredits(page, R, "시작 전 " + PJ, R + "_계정창");
    Object.assign(res, { _creditsStart: c0.credits, _creditsStartAt: c0.at });
    L.saveRes(res);
    const np = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const c = [...document.querySelectorAll("button, a, [role=button]")].filter(vis).filter((e) => /새 프로젝트/.test(e.innerText || ""));
      const inner = c.filter((e) => !c.some((o) => o !== e && e.contains(o)));
      document.querySelectorAll("[data-synk-np]").forEach((e) => e.removeAttribute("data-synk-np"));
      if (inner.length === 1) inner[0].setAttribute("data-synk-np", "1");
      return { n: inner.length, texts: inner.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30)) };
    });
    L.step(R, "새 프로젝트 단추", np);
    if (np.n !== 1) throw new Error("멈춤 — 새 프로젝트 단추를 하나로 못 좁힘");
    await page.click('[data-synk-np="1"]', { label: "create new project" });
    let proj = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const u = await page.url();
      if (/\/project\/[0-9a-f-]{20,}/.test(u)) { proj = u; break; }
    }
    if (!proj) throw new Error("멈춤 — 프로젝트 주소로 안 넘어감");
    res._projects[PJ] = proj;
    L.saveRes(res);
    L.step(R, "새 프로젝트", { project: proj });
  } else {
    try { await page.goto(res._projects[PJ]); } catch (e) { L.step(R, "goto 느림", { e: String(e).slice(0, 100) }); }
  }
  for (let i = 0; i < 20; i++) {
    const ready = await page.evaluate(() => !!document.querySelector("[role=textbox], [contenteditable=true]") && !!document.querySelector('button[aria-label="설정 트리거"]'));
    if (ready) break;
    await page.waitForTimeout(1500);
  }
  // 설정 창 읽기
  await L.openSettings(page);
  let info = await L.panelInfo(page);
  L.step(R, "설정 창(처음)", info);
  const listModels = async (tag) => {
    await page.click('loc=css:button[aria-label="모델 제품군 선택"]', { label: "open model list" });
    await page.waitForTimeout(2500);
    const names = await page.evaluate(() => [...document.querySelectorAll("[role=menuitem], [role=option], [role=menuitemradio]")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.innerText || "").split("\n").map((x) => x.trim()).filter(Boolean).join(" / ").slice(0, 120)));
    L.step(R, "모델 목록 " + tag, { names });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
    return names;
  };
  await L.clickInPanel(page, R, "동영상");
  await L.clickInPanel(page, R, "프레임", false);
  await page.waitForTimeout(1200);
  await L.openSettings(page);
  res._videoModels = await listModels("동영상");
  await L.openSettings(page);
  info = await L.panelInfo(page);
  L.step(R, "설정 창(동영상)", info);
  await L.clickInPanel(page, R, "이미지", false);
  await page.waitForTimeout(1500);
  await L.openSettings(page);
  info = await L.panelInfo(page);
  L.step(R, "설정 창(이미지)", info);
  try { res._imageModels = await listModels("이미지"); } catch (e) { L.step(R, "이미지 모델 목록 못 읽음", { e: String(e).slice(0, 200) }); }
  await L.openSettings(page);
  await L.zoomShot(page, R, R + "_설정_이미지", L.panelRect);
  await L.closeSettings(page);
  L.saveRes(res);
} catch (e) {
  L.step(R, "오류", { e: String(e).slice(0, 400) });
}
L.step(R, "끝", { totalSec: L.sec(t0) });
