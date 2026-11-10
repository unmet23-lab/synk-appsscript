// 운영 공개본(synk.im/world/?drama=1)을 ego 브라우저의 실제 로그인 계정으로 한 바퀴 도는 도우미(2026-11-11).
// ego 스크립트 안에서 await import("file:///<이 파일의 절대 경로>")로 불러 쓴다. 쓰는 법 · 결과는 같은 폴더 README.
// 실제 계정에 학습 기록과 받아 적기 횟수(하루 30번)가 남는다 — 평가 집계에서 뺀 시험 계정으로, 필요한 만큼만 돌린다.
// 공통: 보이는 단추 · 글 읽기
export const readTop = (page) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const dlg = [...document.querySelectorAll("dialog[open], [role=dialog], [aria-modal=true]")].filter(vis).map((d) => (d.innerText || "").replace(/\s+/g, " ").trim().slice(0, 500));
  const btns = [...document.querySelectorAll("button, [role=button], [role=radio]")].filter(vis).map((b) => ((b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim() + (b.getAttribute("aria-checked") === "true" ? " ✓" : "") + (b.disabled ? " (꺼짐)" : ""))).filter(Boolean);
  const frames = [...document.querySelectorAll("iframe")].map((f) => ({ src: (f.getAttribute("src") || "").slice(0, 90), vis: vis(f) }));
  return { dlg, btns: btns.slice(-24), frames, hosts: { learning: typeof window.SYNKLearningHost, drama: typeof window.SYNKDramaHost } };
});
// 드라마 틀 안 읽기
export const readFrame = (page) => page.evaluate(() => {
  const f = [...document.querySelectorAll("iframe")].find((x) => /\/world\/drama\//.test(x.src || ""));
  if (!f) return { err: "no drama frame" };
  const d = f.contentDocument, w = f.contentWindow;
  if (!d) return { err: "no frame doc" };
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && w.getComputedStyle(e).visibility !== "hidden"; };
  const txt = (id) => { const e = d.getElementById(id); return e && vis(e) ? (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400) : null; };
  const btns = [...d.querySelectorAll("button, [role=button], a")].filter(vis).map((b) => ((b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim() + (b.disabled ? " (꺼짐)" : "") + (b.id ? " #" + b.id : ""))).filter(Boolean);
  const fr = f.getBoundingClientRect();
  return { chip: txt("analysisChip"), ep: txt("epTag"), prog: txt("prog"), subs: txt("subs"), slate: txt("slate"), win: txt("win"), panel: txt("panel"), mstate: txt("mstate"), micSub: txt("micSub"), dialog: txt("dialog"), btns, synth: w.__synth ? { calls: w.__synth.calls, next: w.__synth.next, have: Object.keys(w.__synth.buf || {}) } : null, frameAt: [Math.round(fr.left), Math.round(fr.top)] };
});
// 드라마 틀 안 단추를 글로 찾아 실제 마우스로 누름
export const clickFrame = async (page, label, opt = {}) => {
  const pos = await page.evaluate(({ label, byId }) => {
    const f = [...document.querySelectorAll("iframe")].find((x) => /\/world\/drama\//.test(x.src || ""));
    const d = f.contentDocument, w = f.contentWindow;
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && w.getComputedStyle(e).visibility !== "hidden"; };
    let c;
    if (byId) c = [d.getElementById(byId)].filter((e) => e && vis(e) && !e.disabled);
    else c = [...d.querySelectorAll("button, [role=button], a")].filter(vis).filter((b) => (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim() === label && !b.disabled);
    if (c.length !== 1) return { err: (byId || label) + " 후보 " + c.length };
    c[0].scrollIntoView({ block: "center" });
    const r = c[0].getBoundingClientRect(), fr = f.getBoundingClientRect();
    return { x: Math.round(fr.left + r.left + r.width / 2), y: Math.round(fr.top + r.top + r.height / 2) };
  }, { label, byId: opt.byId || null });
  if (pos.err) return pos;
  await page.mouse.click(pos.x, pos.y, { label: "drama frame button" });
  return pos;
};
const brief = (r) => JSON.stringify({ chip: r.chip, prog: r.prog, mstate: r.mstate, micSub: r.micSub, subs: r.subs, win: r.win, panel: r.panel, dialog: r.dialog, btns: r.btns });
export const say = (r) => console.log(brief(r));
// 합성 테이크 한 번: 구가 눌릴 수 있을 때까지 기다림 → 누름 → 소리 길이만큼 → 다시 눌러 멈춤 → 받아 적기 끝까지
export const take = async (page, name) => {
  await page.evaluate((name) => { const f = [...document.querySelectorAll("iframe")].find((x) => /\/world\/drama\//.test(x.src || "")); f.contentWindow.__synth.next = name; }, name);
  let r;
  for (let i = 0; i < 30; i++) {
    r = await readFrame(page);
    if (r.btns && r.btns.some((b) => / #orbBtn$/.test(b) && !/꺼짐/.test(b) && !/Listen/i.test(b))) break;
    await page.waitForTimeout(1500);
  }
  console.log("앞:", brief(r));
  const before = await page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].find((x) => /\/world\/drama\//.test(x.src || "")); return f.contentWindow.__synth.calls; });
  const c1 = await clickFrame(page, null, { byId: "orbBtn" });
  if (c1.err) { console.log("구 누르기 실패", JSON.stringify(c1)); return r; }
  let last = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    last = await page.evaluate((before) => { const f = [...document.querySelectorAll("iframe")].find((x) => /\/world\/drama\//.test(x.src || "")); const S = f.contentWindow.__synth; return S.calls > before ? { dur: S.last?.dur, log: S.log.slice(-1)[0], rec: f.contentDocument.body.classList.contains("is-recording") } : null; }, before);
    if (last && last.rec) break;
  }
  console.log("녹음:", JSON.stringify(last));
  if (!last) { r = await readFrame(page); console.log("getUserMedia가 안 불림:", brief(r)); return r; }
  await page.waitForTimeout(Math.round((last.dur + 1.1) * 1000));
  r = await readFrame(page);
  console.log("말하는 중:", JSON.stringify({ mstate: r.mstate, micSub: r.micSub }));
  const c2 = await clickFrame(page, null, { byId: "orbBtn" });
  if (c2.err) console.log("멈춤 누르기:", JSON.stringify(c2));
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1500);
    r = await readFrame(page);
    if (!/Transcrib|받아 적는|Speaking|말하는/i.test((r.mstate || "") + (r.micSub || ""))) break;
  }
  console.log("뒤:", brief(r));
  return r;
};

// 합성 마이크: 드라마 틀의 getUserMedia를 바꿔, 테이크마다 __synth.next에 적힌 소리를 WebAudio 스트림으로 돌려준다.
// files = { 이름: base64 } — Node 쪽에서 fs로 읽어 넘긴다(틀을 다시 열면 다시 넣어야 한다).
export const injectSynth = (page, files) => page.evaluate((files) => {
  const f = [...document.querySelectorAll("iframe")].find((x) => /\/world\/drama\//.test(x.src || ""));
  const w = f.contentWindow;
  const b64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  const S = (w.__synth = w.__synth || { buf: {}, next: null, calls: 0, log: [] });
  for (const [k, v] of Object.entries(files)) S.buf[k] = b64(v);
  const md = w.navigator.mediaDevices;
  if (!S.orig) S.orig = md.getUserMedia.bind(md);
  md.getUserMedia = async () => {
    S.calls++;
    const name = S.next;
    if (!name || !S.buf[name]) { S.log.push({ at: Date.now(), name, err: "no synth queued" }); throw new w.DOMException("no synth queued", "NotFoundError"); }
    const ctx = S.ctx || (S.ctx = new w.AudioContext());
    if (ctx.state !== "running") await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    const audio = await ctx.decodeAudioData(S.buf[name].slice(0));
    const node = ctx.createBufferSource();
    node.buffer = audio;
    node.connect(dest);
    node.start(ctx.currentTime + 0.4);
    S.last = { name, dur: audio.duration, at: Date.now() };
    S.log.push({ at: Date.now(), name, dur: Math.round(audio.duration * 100) / 100, ctx: ctx.state });
    return dest.stream;
  };
  return { ok: true, have: Object.keys(S.buf) };
}, files);
// 장면 한 판: 내 차례마다 화면의 대사를 읽어 pick(panel)이 고른 소리를 넣는다. 장면 밖 화면(코치 노트 · 연습)이 나오면 그 화면을 돌려준다.
// 같은 줄은 노트가 나면 되묻기 → 대사 보임 → 세 번째에 넘어간다 — 노트 길을 보려면 그 줄에 세 번 다 틀린 소리를 준다.
export const runScene = async (page, pick, maxTakes = 6) => {
  let takes = 0, r;
  for (let i = 0; i < 60 && takes < maxTakes; i++) {
    r = await readFrame(page);
    if (r.dialog) return { r, takes, why: "dialog" };
    if (/TAP TO SPEAK/i.test(r.mstate || "") && r.panel && /YOUR TURN/.test(r.panel)) {
      const name = pick(r.panel);
      if (!name) return { r, takes, why: "unknown turn" };
      await take(page, name);
      takes++;
      continue;
    }
    if (r.panel && !/YOUR TURN/.test(r.panel)) return { r, takes, why: "scene end" };
    await page.waitForTimeout(2000);
  }
  return { r, takes, why: "limit" };
};
