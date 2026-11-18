// 강사 빨랫줄 시안 굽기: 원고 → 그림 · 소리 넣기 → SUIT 심기 → 캡처 → (--녹화) 소리 입힌 녹화
//   node "docs/디자인/synk.im_SHIFT강사빨랫줄_20261118/src/굽기.mjs" [--녹화]
// 캡처와 녹화는 저장소 밖 .tmp/SHIFT빨랫줄/에 둔다.
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
const 브랜드폰트 = require("./tools/lib/브랜드폰트.js");
const b64 = (p, t) => `data:${t};base64,` + fs.readFileSync(p).toString("base64");
const 자산 = path.join(편, "assets");
const 소리 = ["hover", "press", "flip", "clipopen", "clipsnap", "whoosh", "pop"];
let html = fs.readFileSync(path.join(여기, "빨랫줄.src.html"), "utf8");
const 움직임태그 = '<script src="../assets/gsap-3.12.5.js"></script>';
if (!html.includes(움직임태그)) throw new Error("원고에서 강사 카드의 GSAP 스크립트를 찾지 못했습니다.");
const gsap = fs.readFileSync(path.join(자산, "gsap-3.12.5.js"), "utf8");
html = html.replace(움직임태그, () => `<script>
${gsap}</script>`);
for (const 이름 of ["yuho", "a", "b", "c", "d"]) html = html.replaceAll(`{{P_${이름}}}`, b64(path.join(자산, `p-${이름}.webp`), "image/webp"));
for (const s of 소리) html = html.replaceAll(`{{S_${s}}}`, b64(path.join(자산, "sound", `${s}.mp3`), "audio/mpeg"));
if (/\{\{[A-Z]_/.test(html)) throw new Error("채우지 못한 자리 " + html.match(/\{\{[A-Z]_[a-z]+\}\}/)[0]);
const 출력 = path.join(편, "시안.html");
fs.writeFileSync(출력, 브랜드폰트.심기(브랜드폰트.원고로(html)).html);

const 캡처 = path.join(루트, ".tmp", "SHIFT빨랫줄", "캡처"); fs.mkdirSync(캡처, { recursive: true });
const 주소 = "file:///" + 출력.replaceAll("\\", "/");
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const 오류 = [];
async function 열기(w, h, 이름, 녹화폴더) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 900 ? 2 : 1, isMobile: w < 900, hasTouch: w < 900, ...(녹화폴더 ? { recordVideo: { dir: 녹화폴더, size: { width: w, height: h } } } : {}) });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") 오류.push(`${이름}: ${m.text()}`); });
  page.on("pageerror", (e) => 오류.push(`${이름}: ${e.message}`));
  const t0 = Date.now();
  await page.goto(주소, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const 넘침 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(이름, "가로 넘침", 넘침);
  return { ctx, page, t0 };
}
const 찍기 = (page, f) => page.screenshot({ path: path.join(캡처, f) });
const 카드 = async (page, i) => { const bb = await page.locator(".ts-card").nth(i).boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height * 0.62]; };

// 1440: 손 안내 → 안내가 끝난 뒤 → 실제 강사 뒷면 → 예시 강사 뒷면
{
  const { ctx, page } = await 열기(1440, 900, "1440");
  await page.waitForTimeout(3900); await 찍기(page, "안내_1440.png");
  await page.waitForTimeout(3800); await 찍기(page, "기본_1440.png");
  await page.evaluate(() => { __ts.stopGuide(); __ts.pick(__ts.cards[0]); }); await page.waitForTimeout(1100); await 찍기(page, "뒷면_1440.png");
  await page.evaluate(() => __ts.pick(__ts.cards[2])); await page.waitForTimeout(1100); await 찍기(page, "예시뒷면_1440.png");
  await ctx.close();
}
// 390: 안내가 끝난 뒤 → 실제 강사 뒷면
{
  const { ctx, page } = await 열기(390, 844, "390");
  await page.waitForTimeout(7600); await 찍기(page, "기본_390.png");
  await page.evaluate(() => { __ts.stopGuide(); __ts.pick(__ts.cards[0]); }); await page.waitForTimeout(1100); await 찍기(page, "뒷면_390.png");
  await ctx.close();
}

// --녹화: 실제로 손을 올리고 눌러 보며 녹화하고, 쪽이 남긴 소리 기록으로 소리를 입힌 mp4를 만든다(LAB 줄 무대 녹화와 같은 방법).
if (process.argv.includes("--녹화")) {
  const 녹화 = path.join(루트, ".tmp", "SHIFT빨랫줄", "녹화"); fs.mkdirSync(녹화, { recursive: true });
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const 폴더 = fs.mkdtempSync(path.join(녹화, `${w}-`));
    const { ctx, page, t0 } = await 열기(w, h, `녹화${w}`, 폴더);
    const 손 = async (i, 누름 = true) => { const [x, y] = await 카드(page, i); if (w < 900) { if (누름) await page.touchscreen.tap(x, y); return; } await page.mouse.move(x, y, { steps: 14 }); await page.waitForTimeout(420); if (누름) { await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); } };
    await page.waitForTimeout(7200);                 // 떨어짐 · 손 안내가 끝날 때까지
    if (w >= 900) { await 손(1, false); await 손(3, false); }
    await 손(0); await page.waitForTimeout(2200);
    await 손(2); await page.waitForTimeout(2200);
    if (w >= 900) {
      const [x, y] = await 카드(page, 4); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.down(); await page.mouse.move(x + 120, y - 10, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(1600);
    } else { await page.locator(".ts-scroll").evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })); await page.waitForTimeout(1500); await 손(4); await page.waitForTimeout(2000); }
    const snd = await page.evaluate(() => window.__snd);
    await ctx.close();
    const webm = fs.readdirSync(폴더).filter((f) => f.endsWith(".webm")).map((f) => path.join(폴더, f))[0];
    const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", webm]).toString());
    const ins = [], fil = [];
    snd.forEach((s) => {
      const at = Math.max(0, (s.t - t0) / 1000); if (at > dur) return;
      ins.push("-i", path.join(자산, "sound", `${s.k}.mp3`)); const k = ins.filter((x) => x === "-i").length;
      fil.push(`[${k}:a]aresample=48000,asetrate=${Math.round(48000 * (s.r || 1))},aresample=48000,volume=${(s.g || 1).toFixed(3)},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[s${k}]`);
    });
    const mp4 = path.join(녹화, `강사빨랫줄_${w}_소리.mp4`);
    const 섞기 = path.join(폴더, "섞기.txt");
    fs.writeFileSync(섞기, fil.join(";") + `;${fil.map((x) => x.match(/\[s\d+\]$/)[0]).join("")}amix=inputs=${fil.length}:normalize=0,atrim=0:${dur.toFixed(2)},acompressor=threshold=-20dB:ratio=3,loudnorm=I=-19:TP=-1.5:LRA=11,aresample=48000[a]`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", webm, ...ins, "-/filter_complex", 섞기, "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", mp4]);
    console.log("녹화", w, "소리", snd.length, "개 →", mp4);
  }
}
await browser.close();
console.log(오류.length ? "오류:\n" + 오류.join("\n") : "콘솔 오류 없음");
