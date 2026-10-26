// 라운드 6: 새 시크릿 채팅에서 채팅 B(한 줄 있음) — 한도 띠를 닫고, 쳐서 보내고, 「승인」까지.
const step = logger("r06");
watchdog(step, 560_000);
step("시작");
const task = await taskSpace("yuhobuilds Y9 v2 채팅 실험 1027");
const page = task.page("p1");
await phone(page);
const body0 = await page.evaluate(() => document.body.innerText);
if (!body0.includes("시크릿 모드입니다") || body0.includes("Claude 응답")) { console.log("NOT FRESH"); process.exit(4); }
const closed = await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find((n) => n.childElementCount === 0 && /주간 한도의/.test(n.textContent || ""));
  let box = el; for (let i = 0; i < 6 && box; i++) { const b = box.querySelector?.("button[aria-label]"); if (b && !/구매/.test(b.textContent)) { b.click(); return b.getAttribute("aria-label"); } box = box.parentElement; }
  return null;
});
step("띠 닫기 " + closed);
await page.waitForTimeout(800);
const Q = "우리 가게 오늘 인스타 글 하나 써서 올려 줘.\n가게: 망원동 햇살제과 · 오늘 새 메뉴 밤 식빵(하루 20개만) · 8시~20시\n올리기는 첨부한 파일로 하면 돼.\n단, 내가 「승인」이라고 하기 전엔 올리지 마.";
const dir = `${ROOT}/rec/B`;
const frames = [];
const t0 = Date.now();
await typeRecorded(page, dir, Q, frames, t0);
step("쳤음");
const genMs = await sendAndRecord(page, dir, frames, t0, step, 240_000);
await page.waitForTimeout(1500);
await tallShot(page, `${dir}/화면끝_1.jpg`, 3200);
const txt1 = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(`${dir}/대화_1.txt`, txt1);
fs.writeFileSync(`${dir}/frames.json`, JSON.stringify({ q: Q, genMs, frames }, null, 1));
step("1차 끝");
console.log(txt1.slice(0, 3500));
console.log("=====");
const dir2 = `${ROOT}/rec/B2`;
const frames2 = [];
const t1 = Date.now();
await typeRecorded(page, dir2, "승인", frames2, t1);
const genMs2 = await sendAndRecord(page, dir2, frames2, t1, step, 200_000);
await page.waitForTimeout(1500);
await tallShot(page, `${dir2}/화면끝.jpg`, 4200);
const txt2 = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(`${dir2}/대화.txt`, txt2);
fs.writeFileSync(`${dir2}/frames.json`, JSON.stringify({ q: "승인", genMs: genMs2, frames: frames2 }, null, 1));
console.log(JSON.stringify({ genMs, genMs2, n: frames.length, n2: frames2.length }));
console.log(txt2.slice(txt1.length - 200).slice(0, 2500));
step("끝");
process.exit(0);
