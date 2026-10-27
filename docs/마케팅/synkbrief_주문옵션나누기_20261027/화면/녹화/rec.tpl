const fs = await import("node:fs");
const DIR = "C:/Users/q1212/ego/synkbrief-b10-20261027";
const TAG = "__TAG__";
const OUT = DIR + "/" + TAG;
const CLAIM = DIR + "/claim-" + TAG;
if (fs.existsSync(CLAIM)) { console.log("이미 돎"); } else {
fs.writeFileSync(CLAIM, String(Date.now()));
fs.mkdirSync(OUT, { recursive: true });
const L = (m) => fs.appendFileSync(DIR + "/steps.log", `${new Date().toISOString()} ${TAG} ${m}\n`);
L("시작");
const REQ = fs.readFileSync(DIR + "/req.txt", "utf8").trim();
const task = await taskSpace("synkbrief B10 주문 옵션 나누기");
L("space " + task.spaceId);
const page = task.page("p1");
await page.cdp("Page.bringToFront", {}).catch(() => {});
const W = 430, H = 2200, DSF = 1080 / 430;
await page.cdp("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DSF, mobile: true });
await page.goto("https://chatgpt.com/?temporary-chat=true");
await page.waitForLoadState();
await page.waitForTimeout(4500);
const hasDlg = await page.evaluate(() => !!document.querySelector("[role='dialog']"));
if (hasDlg) { await page.keyboard.press("Escape"); await page.waitForTimeout(900); }
let n = 0; const t0 = Date.now(); const log = [];
const cap = async (tag, png = false) => {
  n++;
  const r = await page.cdp("Page.captureScreenshot", png ? { format: "png", fromSurface: true } : { format: "jpeg", quality: 90, fromSurface: true });
  const p = `${OUT}/f${String(n).padStart(4, "0")}.${png ? "png" : "jpg"}`;
  fs.writeFileSync(p, Buffer.from(r.data, "base64"));
  log.push({ n, ms: Date.now() - t0, tag, f: p.split("/").pop() });
};
await cap("empty", true);
await page.click(".ProseMirror", { label: "focus chat input" });
const chars = [...REQ];
for (let i = 0; i < chars.length; i++) { await page.keyboard.insertText(chars[i]); if (i % 2 === 1 || i === chars.length - 1) await cap("type"); }
await page.waitForTimeout(400); await cap("typed", true);
await page.click("loc=role:button[name='보내기']", { label: "send prompt" });
log.push({ ms: Date.now() - t0, tag: "sent" }); L("보냄");
let last = ""; let stable = 0;
for (let i = 0; i < 900; i++) {
  await cap("gen");
  const txt = await page.evaluate(() => { const m = document.querySelector("main"); return m ? m.innerText : ""; });
  if (txt === last) stable++; else stable = 0;
  last = txt;
  if (stable >= 8 && !/응답 중|생각 중|Thinking/.test(txt) && Date.now() - t0 > 15000) break;
}
L("끝 " + n);
await cap("final", true);
const geo = await page.evaluate(() => ({ sh: document.scrollingElement.scrollHeight, ih: innerHeight }));
const marker = await page.evaluate(() => ({ url: location.href, tmp: /임시|temporary/i.test(document.body.innerText + location.href), p: document.body.innerText.includes("개인화되지 않음"), model: (document.querySelector("[data-testid='model-switcher-dropdown-button']")||{}).innerText || "" }));
const codes = await page.evaluate(() => [...document.querySelectorAll("main pre, main code")].map(e => e.innerText));
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, geo, marker, codes }, null, 1));
fs.writeFileSync(`${OUT}/answer.txt`, last);
await page.cdp("Emulation.clearDeviceMetricsOverride", {}).catch(() => {});
console.log(JSON.stringify({ frames: n, ms: Date.now() - t0, geo, marker, codes }));
console.log(last);
}
