// 「제2의 나」 실존 인물 대조 — 구글 렌즈 역검색 한 묶음 (2026-11-03). ego 브라우저 nodejs 안에서 돈다.
// 쓰는 법: 실존대조.mjs가 globalThis.LENS = { space, items: [{ id, img, out }] } 를 정하고 이 파일을 import 한다.
//   img = 얼굴만 자른 jpg(전신이면 렌즈가 옷을 잡는다), out = 결과 폴더(썸네일 t<번호>.jpg · 결과.json · 화면.png).
// 렌즈 「전체」 탭의 시각 일치 카드(배우 프로필 · 기사 · SNS)를 모은다. 「시각적으로 일치하는 항목」 탭은 얼굴에 한두 장만 준다.
// google.com/sorry(로봇 확인)가 뜨면 누르지 않고 멈춘다.
const fs = await import("node:fs/promises");
const path = await import("node:path");
const { space, items } = globalThis.LENS;
const task = await taskSpace(space);
const page = task.page("p1");
const 쉬기 = (ms) => page.waitForTimeout(ms);

for (const [k, it] of items.entries()) {
  if (k) await 쉬기(15000);
  await fs.mkdir(it.out, { recursive: true });
  await page.goto("https://www.google.com/imghp?hl=ko");
  if (/\/sorry\//.test(await page.url())) { console.log(JSON.stringify({ id: it.id, 멈춤: "로봇 확인(sorry)" })); break; }
  await page.click("loc=role:button[name='이미지로 검색']", { label: "open search by image" });
  await page.waitForSelector("text=파일을 업로드", { timeout: 15000 });
  // 파일 선택 창을 띄우지 않고 숨은 입력에 바로 넣는다 — 같은 ego에서 Gemini 실행기가 참고 그림을 올리는 중이어도 창을 가로채지 않게
  const 바로 = await page.setInputFiles("input[type=file]", [it.img]).then(() => true, () => false);
  if (!바로) {
    const 고르기 = page.waitForFileChooser({ timeout: 15000 });
    await page.click("text=파일을 업로드", { label: "upload face crop" });
    await (await 고르기).setFiles(it.img);
  }
  await page.waitForURL(/vsrid|\/sorry\//, { timeout: 40000 });
  if (/\/sorry\//.test(await page.url())) { console.log(JSON.stringify({ id: it.id, 멈춤: "로봇 확인(sorry)" })); break; }
  await 쉬기(5000);
  for (let i = 0; i < 4; i++) { await page.mouse.move(700, 600); await page.mouse.wheel(0, 2500, { label: "scroll lens results" }); await 쉬기(1500); }
  await page.screenshot({ path: path.join(it.out, "화면.png").replace(/\\/g, "/") }).catch(() => {}); // 창이 가려지면 캡처가 시간 초과로 끝난다(11-04) — 기록용이라 대조는 잇는다
  const 카드 = await page.evaluate(() => {
    const out = [];
    for (const img of document.querySelectorAll("img")) {
      const r = img.getBoundingClientRect();
      if (r.width < 90 || r.height < 90) continue;
      let card = img.parentElement;
      for (let i = 0; i < 6 && card && (card.innerText || "").trim().length < 8; i++) card = card.parentElement;
      const a = img.closest("a[href]") || card?.querySelector("a[href]");
      out.push({ src: img.currentSrc || img.src, 글: (card?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 160), 주소: a ? a.href.slice(0, 300) : "" });
    }
    return out;
  });
  const 결과 = [];
  for (const [i, c] of 카드.entries()) {
    const 파일 = path.join(it.out, `t${String(i).padStart(2, "0")}.jpg`);
    try {
      if (c.src.startsWith("data:")) await fs.writeFile(파일, Buffer.from(c.src.split(",")[1], "base64"));
      else { const r = await fetch(c.src); if (!r.ok) throw new Error(String(r.status)); await fs.writeFile(파일, Buffer.from(await r.arrayBuffer())); }
      결과.push({ 번호: i, 파일: path.basename(파일), 글: c.글, 주소: c.주소 });
    } catch (e) { 결과.push({ 번호: i, 받기실패: e.message, 글: c.글 }); }
  }
  await fs.writeFile(path.join(it.out, "결과.json"), JSON.stringify({ id: it.id, 검색주소: (await page.url()).slice(0, 200), 카드: 결과 }, null, 1));
  console.log(JSON.stringify({ id: it.id, 카드: 결과.length, 받음: 결과.filter((x) => x.파일).length }));
}
