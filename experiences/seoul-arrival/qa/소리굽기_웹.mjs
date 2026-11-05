// 서울행 배경 소리 15종을 일레븐랩스 효과음 웹 화면에서 네 판씩 굽고 MP3로 받는다(ego 브라우저, unmet23 로그인). 이미 받은 판은 건너뛰고, 화면에 이미 나온 묶음은 다시 굽지 않는다.
// 키에 효과음 권한이 없어 API(소리굽기.mjs)가 401이라 웹으로 굽는다(유호님 2026-11-05 「네, 받아요」). 값은 초당 약 13크레딧이고 한 번에 네 판이 나온다.
//   ego-browser nodejs < experiences/seoul-arrival/qa/소리굽기_웹.mjs   → .tmp/seoul-sound/raw/<이름>_<판>.mp3 → qa/소리고르기.py → qa/소리다듬기.py
// 표준 입력으로 넘기면 import.meta를 못 쓰니 경로는 집 폴더에서 잡는다. 지시문은 소리굽기.mjs와 같다.
const os = await import("node:os");
const fs = await import("node:fs");
const task = await taskSpace("seoul-sound-20261105");
const page = task.page("p1");
const HOME = os.homedir().replaceAll("\\", "/");
const OUT = `${HOME}/Documents/SYNK-appsscript/.claude/worktrees/seoul-arrival/.tmp/seoul-sound/raw/`;
fs.mkdirSync(OUT, { recursive: true });
const LOCK = `${HOME}/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_129d6aba-b501-42b0-a446-c2f175d042cb/ego_받기.lock`;
const ME = "seoul-arrival";
const SOUNDS = [
  { name: "room", sec: 9, loop: true, text: "a quiet small bedroom at night, soft low room tone, very faint distant city traffic far away outside a closed window" },
  // 초침: 고리 켠 「slowly once per second」 판은 간격이 들쭉날쭉했다 — 고리를 끄고 여덟 번을 적은 이 지시문의 7판을 골랐다(qa/소리다듬기.py가 네 번을 잘라 고리로)
  { name: "clock", from: 5, sec: 8, loop: false, text: "close-up recording of a mechanical wall clock, a steady loud crisp tick exactly once per second, eight ticks, wooden case resonance, very quiet room behind it, no music" },
  { name: "dawn", sec: 9, loop: true, text: "early morning, small birds chirping outside an open window, a quiet room, a pencil writing and scribbling on paper close by" },
  { name: "cabin", sec: 9, loop: true, text: "inside an airplane cabin during descent, steady low jet engine hum, soft air conditioning hiss, calm" },
  { name: "train", sec: 9, loop: true, text: "inside a subway train crossing a long steel bridge, rhythmic wheels clacking over rail joints, steady rumble, airy and bright" },
  { name: "campus", sec: 9, loop: true, text: "a university campus plaza on a spring morning, birds singing in trees, distant students chatting and laughing softly, light footsteps on stone" },
  { name: "airport", sec: 9, loop: true, text: "a quiet airport departure gate before dawn, soft distant murmur of a few travellers, gentle air conditioning hum, calm and spacious" },
  { name: "hall", sec: 9, loop: true, text: "a large bright airport arrivals hall, soft murmur of many travellers waiting in line, rolling suitcase wheels in the distance, footsteps on hard floor, spacious reverb" },
  { name: "canteen", sec: 9, loop: true, text: "a busy university cafeteria at lunchtime, soft murmur of many students talking far away, metal trays and spoons clinking, plates being stacked, spacious room" },
  { name: "crowd", sec: 6, text: "a huge outdoor concert crowd cheering and screaming with excitement, thousands of fans, roaring applause" },
  { name: "applause", sec: 6, text: "an audience in a small movie theater applauding warmly after a premiere screening, clapping hands, indoors, no music, no voices" },
  // 지퍼: 「…then a soft pat on the lid」 지시문의 1~4판은 아르곤 듣기에서 넷 다 끝에 낮은 그르렁 울림(틀림 · 애매) — 뚜껑 치기를 빼고 5판부터 다시
  // 5~8판(「close-up recording of a zipper being pulled quickly along a fabric suitcase, one crisp bright zip, dry and close, quiet room」 2.5초)도
  // 넷 다 먹먹한 낮은 울림(2kHz 위가 1~5%뿐, 2초 넘게 끈다). 앱은 지퍼 뒤 1.5초를 기다린다 — 캐리어 · 방을 빼고 밝은 쇳소리를 짧게, 지시문 둘로 9판부터.
  // 9~12판은 2kHz 위가 17~66%로 밝아졌고, 아르곤 듣기에서 11판만 「맞음」(한 번에 닫히고 손잡이가 멈춤) — 11판을 쓴다. 13~16판(재킷 지시문)은 끝에 저음 쿵이 남아 안 들려 줬다
  { name: "zip", from: 9, sec: 1.2, text: "a single quick zipper pull on a small nylon pouch, bright thin high-pitched zip, crisp metal teeth, close-up foley, dry" },
  { name: "zip", from: 13, sec: 1.0, text: "fast zipper closing sound, one sharp bright metallic rasp of zipper teeth on a jacket, short, studio foley recording" },
  { name: "walk", sec: 5, text: "footsteps on stone pavement while pulling a rolling suitcase, the small wheels rumbling over the tiles, outdoors" },
  { name: "print", sec: 3, text: "a small plastic card printer printing an id card, short mechanical whirr and a click as the card drops out" },
  { name: "stamp", sec: 1.5, text: "a single firm rubber stamp pressed hard onto a passport page on a desk, one solid thump" },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hold() {
  for (let i = 0; i < 90; i++) {
    try { fs.writeFileSync(LOCK, `${ME} 효과음 ${new Date().toISOString()}`, { flag: "wx" }); return true; } catch {
      const st = fs.statSync(LOCK, { throwIfNoEntry: false });
      if (st && Date.now() - st.mtimeMs > 180000) { try { fs.unlinkSync(LOCK); } catch {} }
      await sleep(2000);
    }
  }
  return false;
}
function release() { try { if (fs.readFileSync(LOCK, "utf8").startsWith(ME + " ")) fs.unlinkSync(LOCK); } catch {} }
const closeMenus = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(200); };
async function setLoop(on) {
  const label = await page.evaluate(() => document.querySelector('button[aria-label^="Loop:"]')?.getAttribute("aria-label"));
  if (!label) throw Error("고리 단추 없음");
  if (/On/.test(label) !== !!on) { await page.click('button[aria-label^="Loop:"]', { label: "toggle loop" }); await page.waitForTimeout(300); }
  return page.evaluate(() => document.querySelector('button[aria-label^="Loop:"]')?.getAttribute("aria-label"));
}
async function setDur(target) {
  if (!await page.evaluate(() => !!document.querySelector("#auto-duration"))) { await page.click('button[aria-label^="Duration:"]', { label: "open duration" }); await page.waitForTimeout(400); }
  if (await page.evaluate(() => document.querySelector("#auto-duration").getAttribute("aria-checked")) === "true") { await page.click("#auto-duration", { label: "turn off auto" }); await page.waitForTimeout(300); }
  await page.focus('[role="dialog"] [role="slider"]');
  const now = () => page.evaluate(() => Number(document.querySelector('[role="dialog"] [role="slider"]').getAttribute("aria-valuenow")));
  for (let i = 0; i < 400; i++) { const v = await now(); if (Math.abs(v - target) < 0.05) break; const d = target - v; await page.keyboard.press(Math.abs(d) >= 1 ? (d > 0 ? "PageUp" : "PageDown") : (d > 0 ? "ArrowRight" : "ArrowLeft")); }
  const got = await now(); await closeMenus(); return got;
}
// 결과 칸은 묶음이 쌓인다 — 머리 글이 내 지시문으로 시작하는 묶음의 네 줄만 쓴다(맨 앞이 가장 새 묶음)
const GROUP = `(h)=>{const isRow=li=>li.querySelector('button[aria-label="Play"]')&&/^#[1-4]/.test((li.innerText||'').trim());const firsts=[...document.querySelectorAll('li')].filter(li=>isRow(li)&&/^#1/.test((li.innerText||'').trim()));for(const f of firsts){let p=f.parentElement;for(let i=0;i<6&&p;i++,p=p.parentElement){if(p.querySelectorAll('li').length>6)break;if((p.innerText||'').includes(h)){const rows=[...p.querySelectorAll('li')].filter(isRow);if(rows.length===4)return rows;}}}return null;}`;
const rowsReady = (head) => page.evaluate(([h, g]) => { const f = eval(g); const u = f(h); return { same: !!u, n: u ? u.length : 0 }; }, [head, GROUP]);
async function download(n, file, head) {
  await page.evaluate(() => { document.querySelectorAll("audio").forEach((a) => { try { a.pause(); } catch {} }); });
  if (!await hold()) throw Error("받기 잠금을 못 쥠");
  try {
    // 받은 뒤에도 앞 메뉴가 열려 있으면 다음 누름을 가로챈다. 메뉴를 닫으면 줄이 다시 그려져 단추 표식이 바뀌니 표식은 그 뒤에 읽는다.
    await closeMenus();
    let opened = false;
    for (let k = 0; k < 4 && !opened; k++) {
      const id = await page.evaluate(([n, h, g]) => { const f = eval(g); const rows = f(h); const li = rows?.find((li) => (li.innerText || "").trim().startsWith("#" + n)); return li?.querySelectorAll("button")[2]?.dataset.agentId; }, [n, head, GROUP]);
      if (!id) throw Error("받기 단추 없음 #" + n);
      try { await page.click(`[data-agent-id="${id}"]`, { label: "open download menu" }); opened = true; } catch { await page.waitForTimeout(500); }
    }
    if (!opened) throw Error("받기 메뉴를 못 엶 #" + n);
    await page.waitForTimeout(350);
    const dl = page.waitForEvent("download", { timeout: 30000 });
    const clicked = await page.evaluate(() => { const it = [...document.querySelectorAll('[role="menuitem"],[role="menu"] *')].find((e) => /^MP3/.test((e.innerText || "").trim())); if (!it) return false; const t = it.closest('[role="menuitem"]') || it; t.click(); return true; });
    if (!clicked) { await closeMenus(); throw Error("MP3 메뉴 없음"); }
    const d = await dl;
    await d.saveAs(file);
    await closeMenus();
  } finally { release(); }
  const b = fs.readFileSync(file);
  const ok = b.length > 800 && (b.subarray(0, 3).toString("latin1") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
  if (!ok) { fs.renameSync(file, file + ".섞임"); throw Error("mp3가 아님 " + file); }
  return b.length;
}
for (const s of SOUNDS) {
  const f0 = s.from || 1;   // 지시문을 바꿔 다시 구운 소리는 판 번호를 이어 붙인다(옛 판은 그대로 둔다)
  const missing = [f0, f0 + 1, f0 + 2, f0 + 3].filter((i) => !fs.existsSync(OUT + `${s.name}_${i}.mp3`));
  if (!missing.length) { console.log("있음", s.name); continue; }
  const head = s.text.slice(0, 30);
  const lp = await setLoop(!!s.loop); const dur = await setDur(s.sec);
  await page.fill('textarea[aria-label="Sound effect prompt"]', s.text); await page.waitForTimeout(400);
  const cost = await page.evaluate(() => document.body.innerText.match(/\d[\d,]* credits \/ [\d,]+ credits/)?.[0]);
  if (!(await rowsReady(head)).same) await page.click('button[aria-label="Generate sound effect"]', { label: "generate" });
  let ok = false;
  for (let i = 0; i < 160; i++) {
    await page.waitForTimeout(1500);
    if ((await rowsReady(head)).same) { ok = true; break; }
    // 「system is busy」 알림이면 조금 뒤 다시 누른다(실패한 굽기는 크레딧이 안 나간다)
    if (i % 20 === 19 && await page.evaluate(() => /system is (busy|experiencing)/i.test(document.body.innerText))) { console.log("바쁨, 다시", s.name); await page.click('button[aria-label="Generate sound effect"]', { label: "generate" }); }
  }
  if (!ok) { console.log("결과 못 봄", s.name); break; }
  await page.waitForTimeout(800);
  // 화면의 줄 번호는 묶음마다 #1~#4다 — 이어 붙인 판 번호(f0부터)를 줄 번호로 바꿔 받는다
  const sizes = []; for (const i of missing) { sizes.push(await download(i - f0 + 1, OUT + `${s.name}_${i}.mp3`, head)); await page.waitForTimeout(300); }
  console.log(s.name, lp, dur, cost, sizes.join(" "));
}
console.log(await page.evaluate(() => document.body.innerText.match(/\d[\d,]* credits \/ [\d,]+ credits/)?.[0]));
