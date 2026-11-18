// 강사 빨랫줄 시안 굽기: 원고 → 그림 넣기 → SUIT 심기 → 캡처(1440 기본, 1440 「보고서와 공문」, 390 기본)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 편 = path.resolve(여기, "..");
const 루트 = path.resolve(편, "../../..");
const require = createRequire(path.join(루트, "package.json"));
const { chromium } = require("playwright");
const b64 = (p, t) => `data:${t};base64,` + fs.readFileSync(p).toString("base64");
const 자산 = path.join(편, "assets");
let html = fs.readFileSync(path.join(여기, "빨랫줄.src.html"), "utf8")
  .replaceAll("{{LOGO}}", b64(path.join(루트, "docs/마케팅/SHIFT_강사소개서_20261118/src/logo-shift-800.webp"), "image/webp"))
  .replaceAll("{{FOUNDER}}", b64(path.join(루트, "docs/마케팅/SHIFT_강사소개서_20261118/src/founder-480.webp"), "image/webp"));
for (const 이름 of ["shirt", "cardigan", "apron", "hoodie", "jacket", "tag"]) {
  html = html.replaceAll(`{{IMG_${이름}}}`, b64(path.join(자산, `${이름}.webp`), "image/webp"));
}
const 출력 = path.join(편, "시안.html");
fs.writeFileSync(출력, html);
execFileSync(process.execPath, [path.join(루트, "tools/lib/브랜드폰트.js"), "--심기", 출력], { stdio: "inherit" });
const 캡처 = path.join(루트, ".tmp", "SHIFT빨랫줄", "캡처"); fs.mkdirSync(캡처, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const 오류 = [];
async function 열기(w, h, 이름) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("console", m => { if (m.type() === "error") 오류.push(`${이름}: ${m.text()}`); });
  page.on("pageerror", e => 오류.push(`${이름}: ${e.message}`));
  await page.goto("file:///" + 출력.replaceAll("\\", "/"), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(900);
  const 넘침 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(이름, "가로 넘침", 넘침);
  return page;
}
let p = await 열기(1440, 900, "1440");
await p.screenshot({ path: path.join(캡처, "기본_1440.png") });
await p.screenshot({ path: path.join(캡처, "전체_1440.png"), fullPage: true });
await p.click('button.chip[data-f="2"]'); await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(캡처, "보고서_1440.png") });
await p.click('button.peg[data-id="b"]'); await p.waitForTimeout(600);
await p.screenshot({ path: path.join(캡처, "예시펼침_1440.png"), fullPage: true });
await p.close();
p = await 열기(390, 844, "390");
await p.screenshot({ path: path.join(캡처, "기본_390.png") });
await p.screenshot({ path: path.join(캡처, "전체_390.png"), fullPage: true });
await p.close();
await browser.close();
console.log(오류.length ? "오류:\n" + 오류.join("\n") : "콘솔 오류 없음");
