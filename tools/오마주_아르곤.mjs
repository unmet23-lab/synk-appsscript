// 오마주 원본 첫 분석 — Gemini 웹 「4 Argon」 · 사고 수준 「높음」 새 대화에 원본 영상(소리째)을 올리고 지시문을 보내 답을 받는다(2026-10-28).
// tools/오마주.js 아르곤이 globalThis.JOB = { video, prompt, out, shots, u }를 앞에 붙여 ego-browser nodejs 표준 입력으로 돌린다(한글 경로는 -e import가 안 된다).
// 화면 다루기는 PULSE 이미지 콘티 스크립트(synk-vendor …/p12/ego/gem21.mjs, 장부 S33)를 옮겼다 — 모드 단추는 「업로드 및 도구」를 연 동안만 보이고,
// 숨은 파일 칸이 없어 「파일 업로드」를 파일 선택 대기와 함께 실제로 누른다. 읽기 · 보내기만 한다: 영상 권리 동의 창 · 한도 · 로봇 확인이 보이면 누르지 않고 멈춘다
// (docs/현장노트/gemini_사진.md 「영상을 붙여 처음 보내면 동영상 제작에 관한 알림…」 — 남의 영상이면 유호님께 묻는다).
const fs = await import("node:fs/promises");
const { video, prompt, out, shots, u } = globalThis.JOB;
const task = await taskSpace("synk-homage-argon");
const pages_ = await task.pages();
const page = pages_.length ? pages_[pages_.length - 1] : await task.newPage();
const fail = async (why) => { await page.screenshot({ path: `${shots}/아르곤_실패.png` }).catch(() => {}); throw new Error(why); };
const state = () => page.evaluate(() => {
  const labs = [...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || "");
  const mode = labs.find((t) => t.startsWith("모드 선택 도구 열기")) || "";
  const closes = labs.filter((t) => t === "첨부파일 닫기").length;
  const ed = document.querySelector('[aria-label="Gemini 프롬프트 입력"]');
  const len = ed ? ed.innerText.replace(/\s+/g, "").length : -1;
  const text = document.body.innerText;
  return {
    mode, closes, len, path: location.pathname,
    failed: /업로드에 실패|실패한 파일/.test(text),
    limit: /한도는 .*초기화|사용량 한도/.test(text),
    consent: /동영상 제작에 관한 알림|필요한 권리가 있는지 확인/.test(text) && /동의/.test(text),
  };
});
const mark = (re, tag) => page.evaluate(({ re, tag }) => {
  document.querySelectorAll(`[data-synk="${tag}"]`).forEach((e) => e.removeAttribute("data-synk"));
  const r = new RegExp(re);
  const el = [...document.querySelectorAll("gem-menu-item, [role=menuitem], [role=menuitemradio], input-companion-item, button")]
    .find((e) => r.test((e.innerText || "").trim()) && e.getBoundingClientRect().width > 0);
  if (el) el.setAttribute("data-synk", tag);
  return !!el;
}, { re, tag });

await page.info();
const win = await page.cdp("Browser.getWindowForTarget", {});
if (win.bounds.windowState === "minimized") { await page.cdp("Browser.setWindowBounds", { windowId: win.windowId, bounds: { windowState: "normal" } }); await page.waitForTimeout(1500); }
await page.goto(`https://gemini.google.com/u/${u}/app`).catch((e) => { if (!/navigation committed/.test(e.message)) throw e; });
let s;
for (let i = 0; i < 45; i++) { await page.waitForTimeout(2000); s = await state().catch(() => ({ mode: "", limit: false })); if (s.mode || s.len >= 0) break; }
if (/sorry/.test(await page.url())) await fail("로봇 확인 화면(sorry) — 멈춤, 유호님 손");
if (s.limit) await fail("사용량 한도 문구가 보임");

const openTools = async () => {
  for (let i = 0; i < 3; i++) {
    s = await state();
    if (s.mode) return;
    await page.click('loc=css:button[aria-label="업로드 및 도구"]', { timeout: 15000, label: "open tools panel" }).catch(() => {});
    await page.waitForTimeout(2200);
  }
  s = await state();
  if (!s.mode) await fail("모드 단추가 없음(도구 판을 열어도)");
};
const OK = (m) => /Argon/.test(m) && /높음|최고가/.test(m);
const chooseArgon = async () => {
  for (let i = 0; i < 3; i++) {
    await openTools();
    if (OK(s.mode)) return;
    await page.click('loc=css:button[aria-label^="모드 선택 도구 열기"]', { timeout: 15000, label: "open mode menu" });
    await page.waitForTimeout(1300);
    if (!/Argon/.test(s.mode) && (await mark("^4 Argon", "argon"))) {
      await page.click('loc=css:[data-synk="argon"]', { timeout: 15000, label: "choose 4 Argon" });
      await page.waitForTimeout(1300);
      await openTools();
      await page.click('loc=css:button[aria-label^="모드 선택 도구 열기"]', { timeout: 15000, label: "open mode menu" });
      await page.waitForTimeout(1300);
    }
    if (await mark("^사고 수준", "think")) { await page.click('loc=css:[data-synk="think"]', { timeout: 15000, label: "open thinking submenu" }); await page.waitForTimeout(1300); }
    if (await mark("^높음", "hi")) { await page.click('loc=css:[data-synk="hi"]', { timeout: 15000, label: "choose high thinking" }); await page.waitForTimeout(1300); }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(700);
  }
  await openTools();
};
await chooseArgon();
if (!OK(s.mode)) await fail("모드가 4 Argon · 높음이 아님: " + s.mode);

// 원본 올리기
const menuText = () => page.evaluate(() => { const m = document.querySelector("[role=menu]"); return m ? m.innerText : ""; });
let mt = await menuText();
for (let i = 0; i < 3 && !/파일 업로드/.test(mt); i++) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(600);
  await page.click('loc=css:button[aria-label="업로드 및 도구"]', { timeout: 15000, label: "open upload menu" }).catch(() => {});
  for (let k = 0; k < 6 && !/파일 업로드/.test(mt); k++) { await page.waitForTimeout(1000); mt = await menuText(); }
}
if (!/파일 업로드/.test(mt)) await fail("「파일 업로드」 메뉴가 안 뜸");
await page.evaluate(() => {
  document.querySelectorAll('[data-synk="upl"]').forEach((e) => e.removeAttribute("data-synk"));
  const el = [...document.querySelectorAll("[role=menu] *")].find((e) => e.childElementCount === 0 && (e.innerText || "").trim() === "파일 업로드");
  if (el) el.setAttribute("data-synk", "upl");
});
const chooserP = page.waitForFileChooser({ timeout: 15000 });
await page.click('loc=css:[data-synk="upl"]', { timeout: 15000, label: "choose file upload" }).catch((e) => fail("파일 업로드 누르기 실패: " + e.message));
const chooser = await chooserP;
await chooser.setFiles([video]);
for (let i = 0; i < 40; i++) { await page.waitForTimeout(1500); s = await state(); if (s.closes >= 1 || s.failed || s.consent) break; }
if (s.consent) await fail("영상 권리 동의 창이 떴다 — 누르지 않고 멈춤(유호님 손)");
if (s.failed) await fail("업로드 실패 표시 — 멈춤(보안 확인 신호일 수 있음)");
if (s.closes < 1) await fail("올린 파일이 첨부 칸에 안 보임");
await page.waitForTimeout(15000); // 영상은 올리기가 끝나기 전에 첨부 칸이 먼저 뜬다
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(600);

// 지시문 → 보내기
await page.click('loc=css:[aria-label="Gemini 프롬프트 입력"]', { timeout: 15000, label: "focus prompt box" }).catch((e) => fail("입력창 누르기 실패: " + e.message));
await page.waitForTimeout(500);
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.press("Backspace");
await page.waitForTimeout(400);
await page.keyboard.insertText(prompt);
await page.waitForTimeout(2500);
s = await state();
if (Math.abs(s.len - prompt.replace(/\s+/g, "").length) > 3) await fail(`지시문 길이가 다름 ${s.len}/${prompt.replace(/\s+/g, "").length}`);
if (s.mode && !OK(s.mode)) { await chooseArgon(); s = await state(); if (!OK(s.mode)) await fail("보내기 직전 모드가 바뀜: " + s.mode); }
await page.click('loc=css:[aria-label="메시지 보내기"]', { timeout: 15000, label: "send analysis prompt" }).catch((e) => fail("보내기 누르기 실패: " + e.message));
let url = await page.url();
for (let i = 0; i < 30 && !/\/app\/[0-9a-f]+/.test(url); i++) { await page.waitForTimeout(2000); url = await page.url(); s = await state(); if (s.consent) await fail("보낸 뒤 영상 권리 동의 창 — 누르지 않고 멈춤(유호님 손)"); }
if (!/\/app\/[0-9a-f]+/.test(url)) await fail("보낸 뒤 대화 주소가 안 생김 — 다시 누르지 말고 사이드바부터 볼 것");
console.log(JSON.stringify({ step: "sent", url }));

// 답 기다리기 — 글이 30초 동안 안 늘고 멈춤 단추가 없으면 끝
let last = "", same = 0, text = "";
const t0 = Date.now();
while (Date.now() - t0 < 10 * 60_000) {
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const resp = [...document.querySelectorAll("model-response")];
    const el = resp[resp.length - 1];
    const busy = [...document.querySelectorAll("button")].some((b) => /대답 생성 중지|생성 중지|Stop/.test(b.getAttribute("aria-label") || ""));
    return { text: el ? el.innerText : "", busy };
  }).catch(() => ({ text: "", busy: true }));
  text = r.text;
  same = text && text === last && !r.busy ? same + 1 : 0;
  last = text;
  if (same >= 6 && text.length > 200) break;
}
if (text.length < 200) await fail("답이 안 나옴: " + text.slice(0, 200));
await fs.writeFile(out, `# 아르곤 첫 분석 — ${new Date().toISOString()}\n\n대화: ${url}\n\n${text}\n`, "utf8");
console.log(JSON.stringify({ step: "done", url, chars: text.length, out }));
