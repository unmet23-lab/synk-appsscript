// 강사 소개서 굽기: 원고 → 그림 넣기 → SUIT 심기 → 캡처(1440, 390) → A4 PDF
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 편 = path.resolve(여기, "..");
const 루트 = path.resolve(편, "../../..");
const require = createRequire(path.join(루트, "package.json"));
const { chromium } = require("playwright");
const 브랜드폰트 = require("./tools/lib/브랜드폰트.js");
const b64 = (f, t) => `data:${t};base64,` + fs.readFileSync(path.join(여기, f)).toString("base64");
let html = fs.readFileSync(path.join(여기, "소개서.src.html"), "utf8")
  .replaceAll("{{LOGO}}", b64("logo-shift-800.webp", "image/webp"))
  .replaceAll("{{FOUNDER}}", b64("founder-480.webp", "image/webp"));
const 출력 = path.join(편, "index.html");
fs.writeFileSync(출력, 브랜드폰트.심기(브랜드폰트.원고로(html)).html);
// 캡처는 확인용이라 저장소 밖(.tmp)에 둔다
const 캡처 = path.join(루트, ".tmp", "SHIFT강사소개서_20261118", "캡처"); fs.mkdirSync(캡처, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const 오류 = [];
for (const [이름, w, h] of [["1440", 1440, 900], ["390", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("console", m => { if (m.type() === "error") 오류.push(`${이름}: ${m.text()}`); });
  page.on("requestfailed", r => 오류.push(`${이름} 실패: ${r.url().slice(0, 80)}`));
  await page.goto("file:///" + 출력.replaceAll("\\", "/"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const 넘침 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const 글꼴 = await page.evaluate(() => [...document.fonts].filter(f => f.status === "loaded").map(f => f.family).filter((v, i, a) => a.indexOf(v) === i));
  console.log(이름, "가로 넘침", 넘침, "글꼴", 글꼴.join(", "));
  await page.screenshot({ path: path.join(캡처, `전체_${이름}.png`), fullPage: true });
  await page.screenshot({ path: path.join(캡처, `첫화면_${이름}.png`) });
  if (이름 === "1440") {
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: path.join(편, "양유호_AI강사소개서.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  }
  await page.close();
}
await browser.close();
console.log(오류.length ? "오류:\n" + 오류.join("\n") : "콘솔 오류 없음");
