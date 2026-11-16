// 저장소 사본(2026-11-17). 실제로 돌린 파일은 ~/ego/dream-stage-20261117b/bake.mjs 이고 `ego-browser nodejs < 웹굽기.mjs`로 돌린다.
// 쓰기 전에 고칠 곳 둘: taskSpace(242)의 번호를 지금 연 작업 공간 번호로, job.json 경로를 웹일감.py의 DREAM_JOB과 같게.
// 작업 공간은 「유호」 프로필(Profile 7)에서 새로 만들고 드리미나에 unmet23으로 로그인돼 있는지(오른쪽 위 크레딧이 23K대인지) 먼저 본다.
// 꿈 무대 콘티 — 드리미나 웹 Seedream 5.5 무제한으로 한 판(세 장)을 굽고 받는다(2026-11-17).
// 일감은 job.json: { prompt, refs: [{name,b64}], out: "<폴더>/", tag: "<판 이름>" }
// 무제한 스위치가 켜져 있고 값이 0/image일 때만 낸다(아니면 멈춘다 — 크레딧이 나가지 않게).
const fs = await import("node:fs/promises");
const job = JSON.parse(await fs.readFile("C:/Users/q1212/ego/dream-stage-20261117b/job.json", "utf8"));
const task = await taskSpace(242);
const page = task.page("p1");

// 1. 상세 화면이면 닫는다
if (await page.evaluate(() => [...document.querySelectorAll("*")].some(e => e.childElementCount === 0 && e.textContent.trim() === "Download" && e.getBoundingClientRect().top < 120))) {
  await page.mouse.click(278, 38, { label: "back from detail view" });
  await page.waitForTimeout(2000);
}
// 2. 앞 판의 참고 그림을 모두 뺀다(빼기 단추는 묶음 위에 마우스를 올려야 생긴다)
// 참고 그림 수는 화면의 작은 그림을 직접 센다(빼기 단추는 마우스를 올려야만 보여서 수를 놓칠 때가 있다 — 11-17 둘째 장면에서 겪음)
const thumbs0 = () => page.evaluate(() => {
  const tb = document.querySelector("[role=textbox]").getBoundingClientRect();
  return [...document.querySelectorAll("img")].map(im => im.getBoundingClientRect()).filter(r => r.width > 28 && r.width < 110 && r.height > 28 && r.left > tb.left - 160 && r.left < tb.left + 120 && r.top > tb.top - 50 && r.top < tb.top + 130).map(r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }));
});
async function hoverStack() {
  const t = await thumbs0();
  await page.mouse.move(700, 300, { label: "move away" });
  await page.waitForTimeout(300);
  if (!t.length) return [];
  await page.mouse.move(t[0].x, t[0].y, { label: "hover reference stack" });
  await page.waitForTimeout(900);
  return [...(await page.snapshot()).matchAll(/button "Remove · Reference" \[ref=(\d+)/g)].map(m => m[1]);
}
for (let i = 0; i < 14; i++) {
  if (!(await thumbs0()).length) break;
  const ids = await hoverStack();
  if (!ids.length) continue;
  await page.click("@" + ids[0], { label: "remove reference" });
  await page.waitForTimeout(900);
}
if ((await thumbs0()).length) { console.log("앞 판의 참고 그림을 다 빼지 못함 — 내지 않음"); process.exit(0); }
// 3. 참고 그림을 올린다(파일 선택기를 가짜로 바꿔 — 현장 노트 「웹 그림 칸 … showOpenFilePicker」)
if (job.refs.length) {
  await page.evaluate((files) => {
    window.showOpenFilePicker = async () => files.map(f => {
      const bin = atob(f.b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], f.name, { type: "image/jpeg", lastModified: Date.now() });
      return { kind: "file", name: f.name, getFile: async () => file };
    });
  }, job.refs);
  await page.click("loc=role:button[name='Upload references']", { label: "upload references" });
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1500); if ((await thumbs0()).length >= job.refs.length) break; }
  await page.mouse.move(700, 300, { label: "move away" });
}
// 4. 지시문
await page.click("loc=role:textbox[name='Prompt']", { label: "focus prompt box" });
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.press("Delete");
await page.waitForTimeout(600);
await page.keyboard.insertText(job.prompt);
await page.waitForTimeout(2000);
const st = await page.evaluate(() => {
  const s = document.querySelector('button[aria-label="Unlimited"]');
  return {
    checked: s?.getAttribute("aria-checked"),
    cost: [...document.querySelectorAll("*")].filter(e => e.childElementCount === 0 && /\/image$/.test(e.textContent.trim())).map(e => e.textContent.trim())[0],
    count: document.querySelector('button[aria-label^="Images to generate"]')?.getAttribute("aria-label"),
    size: [...document.querySelectorAll("button")].map(b => b.innerText.replace(/\s+/g, " ").trim()).filter(t => /^(16:9|1:1|4:3|3:2|21:9|9:16|Auto)/.test(t)),
    len: document.querySelector("[role=textbox]")?.innerText.length,
  };
});
st.refs = (await thumbs0()).length;
await page.mouse.move(700, 300, { label: "move away" });
console.log("상태", JSON.stringify(st));
if (!(st.refs === job.refs.length && st.checked === "true" && st.cost === "0/image" && st.count === "Images to generate: 3" && st.size.some(t => t.startsWith("16:9") && t.includes("2K")))) {
  console.log("조건이 안 맞아 내지 않음");
} else {
  async function toBottom() {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { const b = [...document.querySelectorAll("*")].find(e => e.childElementCount === 0 && /^Go to bottom$/.test(e.textContent.trim())); if (b) b.click(); const ims = [...document.querySelectorAll("img")].filter(im => /dreamina-sign/.test(im.src)); ims[ims.length - 1]?.scrollIntoView({ block: "end" }); });
      await page.waitForTimeout(1200);
    }
    await page.mouse.move(700, 200, { label: "hover feed" });
    await page.mouse.wheel(0, 3000, { label: "scroll feed to bottom" });
    await page.waitForTimeout(2000);
  }
  const last3 = () => page.evaluate(() => [...document.querySelectorAll("img")].filter(im => /dreamina-sign/.test(im.src) && im.naturalWidth >= 600).slice(-3).map(im => im.src.split("?")[0]));
  await toBottom();
  const beforeSet = new Set(await last3());
  await page.click("loc=role:button[name='Generate']", { label: "generate images" });
  let t0 = Date.now(), now = [], busy = true;
  while (Date.now() - t0 < 360000) {
    await page.waitForTimeout(7000);
    await toBottom();
    now = await last3();
    busy = await page.evaluate(() => /Processing your prompt|Generating\b/i.test(document.body.innerText));
    if (!busy && now.length === 3 && now.every(x => !beforeSet.has(x))) break;
  }
  console.log("새 판", now.every(x => !beforeSet.has(x)), "busy", busy, Math.round((Date.now() - t0) / 1000) + "초");
  if (busy || !now.every(x => !beforeSet.has(x))) { console.log("새 판을 못 찾음 — 받지 않음"); process.exit(0); }
  await toBottom();
  const box = await page.evaluate(() => {
    const ims = [...document.querySelectorAll("img")].filter(im => /dreamina-sign/.test(im.src) && im.naturalWidth >= 600);
    const im = ims[ims.length - 3];
    const r = im.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, src: im.src.slice(60, 100) };
  });
  console.log("열 그림", JSON.stringify(box));
  await page.waitForTimeout(800);
  await page.mouse.click(box.x, box.y, { label: "open newest result" });
  await page.waitForTimeout(2500);
  const thumbs = await page.evaluate(() => [...document.querySelectorAll("img")].map(i => i.getBoundingClientRect()).filter(r => r.width > 50 && r.width < 120 && r.top < 260 && r.left > 600).map(r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })));
  console.log("작은 그림", thumbs.length);
  for (let k = 0; k < Math.min(3, thumbs.length); k++) {
    await page.mouse.click(thumbs[k].x, thumbs[k].y, { label: `pick result ${k + 1}` });
    await page.waitForTimeout(1500);
    const dl = page.waitForEvent("download", { timeout: 60000 });
    await page.click('text="Download"', { label: "download image" });
    const d = await dl;
    const name = `${job.tag}_${k + 1}.png`;
    await d.saveAs(job.out + name);
    console.log("받음", name);
  }
  await page.mouse.click(278, 38, { label: "back from detail view" });
  await page.waitForTimeout(1500);
}
const credits = await page.evaluate(() => [...document.querySelectorAll("*")].filter(e => e.childElementCount === 0 && /^\d+(\.\d+)?K$/.test(e.textContent.trim())).map(e => e.textContent.trim())[0]);
console.log("크레딧 표시", credits);
