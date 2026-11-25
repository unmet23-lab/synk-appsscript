// Flow 영상 칸 굽기 공용 실행기(2026-11-25 Claude) — 광명역 공모 편 flow/lib.mjs(11-23)를 편 폴더 설정으로 돌게 옮겼다. 부르는 쪽은 tools/플로우영상.js다.
// LAB 편 전체를 샷마다 Omni 1.2 Flash로 굽는다(결정 11-25 「LAB 영상 칸 엔진 · Omni 1.2 Flash · Veo 안 씀」 · 「LAB 편 전체를 영상으로」).
// 지키는 것: 「AI 크레딧 추가」 · 업그레이드 · 구독 · 요금제 · 로그아웃 · 계정 전환 · 워터마크 · 보기 설정(톱니) · 공유 단추는 누르지 않는다.
//  누르는 것은 aria-label · 역할 · 표식(data-synk-*)으로 하나까지 좁힌 단추만. 계정 창 안은 「계정 패널 닫기」 말고 누르지 않는다.
// 편 폴더는 라운드 파일이 globalThis.V4.편(절대 경로)으로 준다. 편 아래 「영상칸/」이 이 실행기의 자리다:
//   영상칸/계획.json  칸(샷)마다 { model, n, cost, dur, proj, start, end?, key } + 「_누적상한」(이 편에서 다시 굽기까지 낼 크레딧 상한 — 적은 편만, 없으면 계정 바닥만 본다)
//   영상칸/지시문.json { 공통, 클립: [{ id, prompt }] }   영상칸/시작/<start>.jpg   영상칸/받음/<id>_a.mp4(git 밖)   영상칸/flow/(기록 · 캡처, git 밖)
const fs = await import("node:fs");
const { createHash } = await import("node:crypto");

const 편 = String((globalThis.V4 && globalThis.V4.편) || "").split("\\").join("/").replace(/\/+$/, "");
if (!편) throw new Error("V4.편(편 폴더 절대 경로)이 없다 — tools/플로우영상.js로 부른다");
export const 편폴더 = 편;
export const V = 편 + "/영상칸/";
export const FLOW = V + "flow/";
export const OUT = V + "받음/";
export const START = V + "시작/";
try { fs.mkdirSync(FLOW + "zip", { recursive: true }); fs.mkdirSync(OUT, { recursive: true }); } catch {}
export const STEPS = FLOW + "steps.jsonl";
export const RESF = FLOW + "results.json";
export const SPACE = "flowvid-" + createHash("sha1").update(편).digest("hex").slice(0, 10);
export const PROFILE = null;   // 기본 프로필(Profile 7)에서 /u/2가 77yuhbs다(계정 창 메일로 다시 확인한다)
// 공간이 없으면 PROFILE에 새로 만들고, 있으면 그대로 잡는다(profileId는 새로 만들 때만 받는다 — 있는 공간에 주면 오류)
export async function openSpace() {
  try { return PROFILE ? await taskSpace(SPACE, { profileId: PROFILE }) : await taskSpace(SPACE); }
  catch (e) { if (/already exists/.test(String(e))) return await taskSpace(SPACE); throw e; }
}
export const JSONP = V + "지시문.json";
export const JSON_COPY = FLOW + "지시문_사본.json";
export const VEO = "Veo 3.1 - Quality";
export const OMNI = "Omni 1.2 Flash";
// Flow 계정 둘(11-26 유호님 「unmet23 제미나이랑 77yuhbs 제미나이 … 둘 다 울트라」). 부르는 쪽이 V4.account로 고른다(없으면 77yuhbs).
// 주소는 /u/<번호> 대신 메일로 연다 — 번호는 로그인 차례로 바뀐다.
export const ACCOUNTS = Object.freeze({ "77yuhbs": "77yuhbs@gmail.com", unmet23: "unmet23@gmail.com" });
export const ACCOUNT = (globalThis.V4 && globalThis.V4.account) || "77yuhbs";
if (!Object.hasOwn(ACCOUNTS, ACCOUNT)) throw new Error("모르는 Flow 계정: " + ACCOUNT);
export const EMAIL = ACCOUNTS[ACCOUNT];
export const FLOW_HOME = "https://labs.google/fx/ko/tools/flow?authuser=" + encodeURIComponent(EMAIL);
// 프로젝트와 올린 그림은 계정마다 따로다. 77yuhbs는 옛 기록과 같은 열쇠(「omni」), 다른 계정은 「omni@unmet23」.
export const projKey = (p) => (ACCOUNT === "77yuhbs" ? p : `${p}@${ACCOUNT}`);

// 모델 · 판 · 「생성 시」 크레딧 · 줄 찾기 KEY · 프로젝트 · 시작 그림
export const PLAN = {};
let 예산 = Infinity;
try {
  const J = JSON.parse(fs.readFileSync(V + "계획.json", "utf8"));
  for (const [k, v] of Object.entries(J)) { if (k === "_누적상한") 예산 = Number(v); else if (!k.startsWith("_")) PLAN[k] = v; }
} catch {}
// 누적 상한은 이 편에서 이 실행기가 접수한 줄의 값만 센다(계정은 다른 세션과 같이 쓴다). 기본은 없음 — 11-25 유호님 「크레딧 모자라는거 아니면 끝까지 진행해」라서 계정 바닥(FLOOR)에서만 멈춘다
export const BUDGET = 예산;
// 계정 크레딧 바닥 — 접수 뒤 남을 크레딧이 이 밑이면 그 계정으로는 내지 않는다. 부르는 쪽(tools/플로우영상.js)이 다른 계정으로 넘긴다.
// 11-26 유호님 「옴니 크레딧은 공모전용으로는 쓰지말고 우리 매일 만드는 컨텐츠 (lab , shift , yuhobuils) 에 전부 쓰자」 — 공모전 · PULSE 몫을 남기지 않는다.
export const FLOOR = 300;

const kst = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
export const kstNow = kst;
export function step(round, name, data = {}) {
  const line = JSON.stringify({ local: kst(), round, step: name, ...data });
  try { fs.appendFileSync(STEPS, line + "\n"); } catch {}
  console.log(line);
}
export const num = (s) => (s == null ? NaN : Number(String(s).replace(/[^\d]/g, "")));
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
export const uuidOf = (s) => ((s || "").match(UUID) || [null])[0];
export const sec = (a, b = Date.now()) => Math.round((b - a) / 1000);
export const norm = (x) => (x || "").replace(/\s+/g, "");

// 같은 라운드 · 같은 접수가 두 번 돌지 않게(멈춘 실행기가 뒤늦게 돌 수 있다 — 10-22 현장노트)
export function takeLock(name) {
  try { fs.closeSync(fs.openSync(FLOW + name + ".lock", "wx")); return true; } catch { return false; }
}
export const hasLock = (name) => fs.existsSync(FLOW + name + ".lock");

// 결과 장부(라운드 사이에 이어 쓴다)
export function loadRes() {
  try { return JSON.parse(fs.readFileSync(RESF, "utf8")); } catch { return {}; }
}
export function saveRes(res) { fs.writeFileSync(RESF, JSON.stringify(res, null, 1)); }

// 지시문: 원본(저장소 작업본)을 읽고, 없으면 round-01이 떠 둔 사본(읽기만 — 원본은 고치지 않는다)
export function loadPrompts(round) {
  let src = JSONP, J;
  try { J = JSON.parse(fs.readFileSync(JSONP, "utf8")); }
  catch (e) {
    src = JSON_COPY;
    J = JSON.parse(fs.readFileSync(JSON_COPY, "utf8"));
    step(round, "지시문 원본 못 읽음 — 사본 씀", { e: String(e).slice(0, 120) });
  }
  const full = {};
  for (const c of J["클립"]) full[c.id] = c.prompt + " " + (c["공통"] || J["공통"]);
  return { J, full, src, common: J["공통"] };
}
// KEY가 자기 넣은 글에 한 번, 다른 클립 넣은 글(extra 포함)에는 없음
export function checkKey(id, key, prompt, others) {
  if (!key || prompt.split(key).length - 1 !== 1) throw new Error("KEY가 자기 지시문에 한 번이 아님 " + id);
  for (const [oid, t] of Object.entries(others)) if (oid !== id && t.includes(key)) throw new Error(`KEY 겹침 ${id} ↔ ${oid}`);
}

export async function unmin(page, round) {
  try {
    const { windowId, bounds } = await page.cdp("Browser.getWindowForTarget", {});
    if (bounds.windowState === "minimized") {
      await page.cdp("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
      step(round, "창 펴기", { from: bounds.windowState });
    }
    return bounds.windowState;
  } catch (e) {
    step(round, "창 상태 못 읽음", { e: String(e).slice(0, 120) });
    return null;
  }
}
export async function front(page) { try { await page.cdp("Page.bringToFront", {}); } catch {} }

export async function shot(page, round, name) {
  await front(page);
  try { await page.screenshot({ path: FLOW + name + ".png" }); return FLOW + name + ".png"; }
  catch (e) { step(round, "캡처 못 함", { name, e: String(e).slice(0, 80) }); return null; }
}
// 확대 캡처: rectFn(페이지 안에서 도는 함수)이 돌려준 자리를 ×2로 찍는다
export async function zoomShot(page, round, name, rectFn) {
  try {
    await front(page);
    const r = await page.evaluate(rectFn);
    if (!r || !(r.w > 0 && r.h > 0)) { step(round, "확대 캡처 자리 없음", { name }); return null; }
    const pad = 8;
    const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.round(r.w + pad * 2), height: Math.round(r.h + pad * 2), scale: 2 };
    const res = await page.cdp("Page.captureScreenshot", { format: "png", clip });
    fs.writeFileSync(FLOW + name + ".png", Buffer.from(res.data, "base64"));
    return FLOW + name + ".png";
  } catch (e) { step(round, "확대 캡처 못 함", { name, e: String(e).slice(0, 120) }); return null; }
}
// 페이지 안에서 도는 자리 함수(닫힌 변수 없이)
// 설정 창 자리: 겉 오버레이(화면 전체)도 같은 글을 가지므로, 맞는 것 가운데 안쪽 것(맞는 자식이 없는 것) 중 가장 작은 것
export const panelRect = () => {
  const all = [...document.querySelectorAll("body *")].filter((e) => { const t = e.innerText || ""; return /생성 시\s*[\d,]+\s*크레딧/.test(t) && /16:9/.test(t) && /9:16/.test(t); });
  if (!all.length) return null;
  const set = new Set(all);
  const inner = all.filter((e) => ![...e.querySelectorAll("*")].some((d) => set.has(d)));
  const area = (e) => { const b = e.getBoundingClientRect(); return b.width * b.height; };
  const pick = (inner.length ? inner : all).filter((e) => area(e) > 0).sort((a, b) => area(a) - area(b))[0];
  if (!pick) return null;
  const b = pick.getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
};
export const composerRect = () => {
  const box = document.querySelector("[role=textbox], [contenteditable=true]");
  if (!box) return null;
  let a = box, hit = null;
  for (let i = 0; i < 12 && a; i++, a = a.parentElement) {
    if (a.querySelector('button[aria-label="설정 트리거"]') && a.querySelector('button[aria-label="생성 시작"]')) { hit = a; break; }
  }
  const b = (hit || box).getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
};

export const flags = (page) => page.evaluate(() => {
  const t = document.body.innerText || "";
  return { creditBand: /크레딧 추가/.test(t), dialogs: document.querySelectorAll("[role=dialog]").length, url: location.href };
});

// ── 계정 창: 열기 · 읽기 · 닫기(읽기만)
export async function openAccount(page, round) {
  const info = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const W = innerWidth;
    const els = [...document.querySelectorAll("button, a, [role=button]")].filter(vis)
      .filter((e) => { const r = e.getBoundingClientRect(); return r.x > W * 0.6 && r.y < 100; });
    const desc = (e) => ({ tag: e.tagName, label: (e.getAttribute("aria-label") || "").slice(0, 40), href: (e.getAttribute("href") || "").slice(0, 40) });
    document.querySelectorAll("[data-synk-acct]").forEach((e) => e.removeAttribute("data-synk-acct"));
    // 「계정 세부정보」(DIV)만. 옆 「Google 계정: …」 링크(accounts.google.com/SignOutOptions)는 로그아웃 쪽 — 링크(A)는 후보에서 뺀다.
    const av = els.filter((e) => e.tagName !== "A" && !e.getAttribute("href") && (e.getAttribute("aria-label") || "").trim() === "계정 세부정보");
    if (av.length === 1) av[0].setAttribute("data-synk-acct", "1");
    return { n: av.length, list: els.map(desc) };
  });
  if (info.n !== 1) { step(round, "아바타 후보", info); throw new Error("멈춤 — 계정 창 단추를 하나로 못 좁힘"); }
  await page.click('[data-synk-acct="1"]', { label: "open account panel" });
  await page.waitForTimeout(2500);
}

export const readAccount = (page) => page.evaluate(() => {
  const t = document.body.innerText || "";
  const email = (t.match(/[\w.+-]+@gmail\.com/) || [null])[0];
  const cm = t.match(/Google Flow 크레딧\s*([\d,]+)\s*개/);
  const leaf = [...document.querySelectorAll("body *")].find((e) => e.children.length === 0 && /워터마크 표시/.test(e.textContent || ""));
  let wm = null;
  if (leaf) {
    let box = leaf;
    for (let i = 0; i < 7 && box && !wm; i++) {
      const sw = box.querySelector("[role=switch], input[type=checkbox], button[aria-checked], button[aria-pressed], [aria-checked]");
      if (sw) wm = { tag: sw.tagName, role: sw.getAttribute("role"), ariaChecked: sw.getAttribute("aria-checked"), ariaPressed: sw.getAttribute("aria-pressed"), checked: typeof sw.checked === "boolean" ? sw.checked : null };
      box = box.parentElement;
    }
  }
  return {
    email, credits: cm ? cm[1] : null, watermark: wm, watermarkText: !!leaf,
    closeBtn: document.querySelectorAll('button[aria-label="계정 패널 닫기"]').length,
    dialogs: document.querySelectorAll("[role=dialog]").length, creditBand: /크레딧 추가/.test(t),
  };
});

export async function closeAccount(page, round) {
  const n = await page.evaluate(() => document.querySelectorAll('button[aria-label="계정 패널 닫기"]').length);
  if (n === 1) {
    await page.click('loc=css:button[aria-label="계정 패널 닫기"]', { label: "close account panel" });
    await page.waitForTimeout(1500);
  }
  let d = await page.evaluate(() => document.querySelectorAll("[role=dialog]").length);
  if (d > 0) { // Escape로는 안 닫힌다(10-21) — 다시 불러 닫는다(안의 단추는 누르지 않는다)
    await page.reload();
    await page.waitForLoadState();
    await page.waitForTimeout(5000);
    d = await page.evaluate(() => document.querySelectorAll("[role=dialog]").length);
  }
  if (d > 0) step(round, "계정 창 안 닫힘", { closeBtn: n, dialogsAfter: d });
  return d === 0;
}

// 계정 창에서 크레딧 · 메일 · 워터마크를 읽고 닫는다(읽기만). 고른 계정(V4.account)이 아니거나 띠가 보이거나 창이 안 닫히면 멈춘다.
export async function readCredits(page, round, tag, shotName = null) {
  await unmin(page, round);
  await openAccount(page, round);
  const a = await readAccount(page);
  if (shotName) await shot(page, round, shotName);
  const closed = await closeAccount(page, round);
  const out = { credits: num(a.credits), at: kst(), email: a.email, watermark: a.watermark ? a.watermark.ariaChecked : null, watermarkRaw: a.watermark, band: a.creditBand };
  step(round, "크레딧 " + tag, out);
  if (!closed) throw new Error("멈춤 — 계정 창이 안 닫힘");
  if (a.email !== EMAIL) throw new Error("멈춤 — 계정이 " + ACCOUNT + "가 아님: " + a.email);
  if (a.creditBand) throw new Error("멈춤 — 「크레딧 추가」 띠");
  if (!Number.isFinite(out.credits)) throw new Error("멈춤 — 크레딧 숫자를 못 읽음");
  return out;
}

// ── 생성 설정
export const readSettings = (page) => page.evaluate(() => {
  const t = document.body.innerText || "";
  const m = t.match(/생성 시\s*([\d,]+)\s*크레딧/);
  const model = document.querySelector('button[aria-label="모델 제품군 선택"]');
  const chip = document.querySelector('button[aria-label="설정 트리거"]');
  const bar = document.querySelector("flow-ingredient-bar");
  const imgs = bar ? [...bar.querySelectorAll("img")].map((i) => i.naturalWidth + "x" + i.naturalHeight) : [];
  const box = document.querySelector("[role=textbox], [contenteditable=true]");
  const slots = [...document.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter((s) => s === "시작" || s === "종료");
  return {
    cost: m ? m[1] : null,
    model: model ? model.innerText.trim().split("\n")[0].replace(/\s*\b(arrow_drop_down|expand_more|keyboard_arrow_down)\b\s*$/, "").trim() : null,
    chip: chip ? chip.innerText.replace(/\s+/g, " ").trim() : null,
    frames: imgs, prompt: box ? box.innerText : "", slots,
    creditBand: /크레딧 추가/.test(t), dialogs: document.querySelectorAll("[role=dialog]").length,
  };
});

export const panelOpen = (page) => page.evaluate(() => /생성 시\s*[\d,]+\s*크레딧/.test(document.body.innerText || ""));
export async function openSettings(page) {
  if (await panelOpen(page)) return;
  await page.click('loc=css:button[aria-label="설정 트리거"]', { label: "open generation settings" });
  await page.waitForTimeout(2500);
}
export async function closeSettings(page) {
  if (!(await panelOpen(page))) return;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
}

// 설정 창 안의 단추 글 · 상태(보기만)
export const panelInfo = (page) => page.evaluate(() => {
  const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const all = [...document.querySelectorAll("body *")].filter((e) => { const t = e.innerText || ""; return /생성 시\s*[\d,]+\s*크레딧/.test(t) && /16:9/.test(t) && /9:16/.test(t); });
  if (!all.length) return { err: "설정 창 없음" };
  all.sort((a, b) => a.innerText.length - b.innerText.length);
  const panel = all[0];
  const items = [...panel.querySelectorAll("button, [role=radio], [role=tab], [role=option], [role=button], [role=menuitemradio], [role=switch], [role=checkbox], input")].filter(vis).map((e) => ({
    tag: e.tagName, role: e.getAttribute("role") || "", label: (e.getAttribute("aria-label") || "").slice(0, 40),
    text: (e.innerText || e.value || "").replace(/\s+/g, " ").trim().slice(0, 40),
    state: e.getAttribute("aria-checked") || e.getAttribute("aria-selected") || e.getAttribute("aria-pressed") || "",
  }));
  return { text: panel.innerText.replace(/\s+/g, " ").trim().slice(0, 600), items };
});

// 설정 창 안에서 글이 label과 같은 단추 하나를 표식으로 잡아 진짜 클릭. 없으면 {missing:true}(throwIfMissing이면 멈춤)
export async function clickInPanel(page, round, label, throwIfMissing = true) {
  await openSettings(page);
  const r = await page.evaluate((label) => {
    const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    const all = [...document.querySelectorAll("body *")].filter((e) => { const t = e.innerText || ""; return /생성 시\s*[\d,]+\s*크레딧/.test(t) && /16:9/.test(t) && /9:16/.test(t); });
    if (!all.length) return { err: "설정 창 없음" };
    all.sort((a, b) => a.innerText.length - b.innerText.length);
    const panel = all[0];
    // 아이콘 글자(videocam · crop_16_9 같은 소문자 낱말)가 같은 줄에 붙어 나올 수 있어 셋 중 하나가 맞으면 된다
    const same = (e) => {
      const raw = e.innerText || "";
      const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
      const flat = raw.replace(/\s+/g, " ").trim();
      const stripped = flat.replace(/\b[a-z][a-z0-9_]*\b/g, "").replace(/\s+/g, " ").trim();
      return flat === label || (lines.length > 0 && lines[lines.length - 1] === label) || stripped === label;
    };
    const cands = [...panel.querySelectorAll("button, [role=radio], [role=tab], [role=option], [role=button], [role=menuitemradio]")].filter(vis).filter(same);
    const inner = cands.filter((e) => !cands.some((o) => o !== e && e.contains(o)));
    document.querySelectorAll("[data-synk-set]").forEach((e) => e.removeAttribute("data-synk-set"));
    if (inner.length === 0) return { missing: true };
    if (inner.length !== 1) return { err: "후보 " + inner.length, texts: inner.map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 30)) };
    const el = inner[0];
    el.setAttribute("data-synk-set", "1");
    return { ok: true, tag: el.tagName, role: el.getAttribute("role"), state: el.getAttribute("aria-selected") || el.getAttribute("aria-checked") || el.getAttribute("aria-pressed") || "" };
  }, label);
  step(round, "설정 " + label, r);
  if (r.missing) { if (throwIfMissing) throw new Error("설정 단추 없음 " + label); return r; }
  if (!r.ok) throw new Error("설정 단추 " + label + " — " + r.err);
  await page.click('[data-synk-set="1"]', { label: "set " + label });
  await page.waitForTimeout(1300);
  return r;
}

// 모델 고르기: 목록을 연 뒤 2.5초 기다려(펼쳐지는 동안 자리가 움직인다 — 10-21) 이름이 딱 맞는 항목 하나에 표식 → 진짜 클릭 → 2.5초 뒤 창의 모델 이름을 다시 읽는다. 틀리면 한 번 더.
export async function chooseModel(page, round, model) {
  await openSettings(page);
  let s = await readSettings(page);
  if (s.model === model) { step(round, "모델 그대로", { model: s.model, cost: s.cost }); return s; }
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.click('loc=css:button[aria-label="모델 제품군 선택"]', { label: "open model list" });
    await page.waitForTimeout(2500);
    const r = await page.evaluate((model) => {
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const items = [...document.querySelectorAll("[role=menuitem], [role=option], [role=menuitemradio]")].filter(vis);
      const linesOf = (e) => (e.innerText || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const names = items.map((e) => linesOf(e).join(" / ").slice(0, 80));
      document.querySelectorAll("[data-synk-model]").forEach((e) => e.removeAttribute("data-synk-model"));
      const hit = items.filter((e) => linesOf(e).some((l) => l === model || l.replace(/\b[a-z][a-z0-9_]*\b/g, "").replace(/\s+/g, " ").trim() === model));
      let rect = null;
      if (hit.length === 1) { hit[0].setAttribute("data-synk-model", "1"); const b = hit[0].getBoundingClientRect(); rect = [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }
      return { names, n: hit.length, rect };
    }, model);
    step(round, "모델 목록", { attempt, ...r });
    if (r.n !== 1) { await page.keyboard.press("Escape"); await page.waitForTimeout(800); throw new Error("멈춤 — 모델 항목 " + model + "을 하나로 못 좁힘"); }
    await page.click('[data-synk-model="1"]', { label: "choose " + model });
    await page.waitForTimeout(2500);
    await openSettings(page);
    s = await readSettings(page);
    step(round, "모델 고른 뒤", { attempt, want: model, model: s.model, cost: s.cost });
    if (s.model === model) return s;
  }
  throw new Error("멈춤 — 모델이 " + model + "로 안 바뀜(지금 " + s.model + ")");
}

// 클립 계획대로 설정: 동영상 · 프레임 · 16:9 → 모델 → (Omni 720p · Veo는 720p 칸이 있으면 720p) → 4초(Veo에 없으면 8초) → x1/x2.
// 그림을 걸기 전에 부른다(비율 · 모델을 바꾸면 칸이 다시 짜일 수 있다). 끝에 창을 닫고 칩을 읽는다.
export async function ensureSettings(page, round, plan) {
  await openSettings(page);
  for (const lab of ["동영상", "프레임", "9:16"]) await clickInPanel(page, round, lab);
  await page.waitForTimeout(1500);
  await chooseModel(page, round, plan.model);
  let info = await panelInfo(page);
  const has = (t) => (info.items || []).some((i) => i.text === t || i.text.replace(/\b[a-z][a-z0-9_]*\b/g, "").replace(/\s+/g, " ").trim() === t);
  if (plan.model === OMNI || has("720p")) await clickInPanel(page, round, "720p");
  let dur = null;
  if (plan.model === OMNI) {
    // 11-11: Omni 1.2는 길이가 슬라이더(값 0~11 = 3~14초)다 — 초점을 두고 Home 뒤 오른쪽 화살표로 옮기고 「길이 N초」 글로 확인한다
    const want = Number(String(plan.dur).replace(/[^0-9]/g, ""));
    const n0 = await page.evaluate(() => { const i = document.querySelector('input[aria-label="길이"]'); if (i) i.focus(); return i ? 1 : 0; });
    if (!n0) throw new Error("멈춤 — 길이 슬라이더가 없음");
    await page.keyboard.press("Home");
    await page.waitForTimeout(500);
    for (let k = 0; k < want - 3; k++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(350); }
    const got = await page.evaluate(() => { const m = (document.body.innerText || "").match(/길이\s*([0-9.]+)\s*초/); return m ? m[1] : null; });
    step(round, "길이 맞춤", { want, got });
    if (Number(got) !== want) throw new Error("멈춤 — 길이가 " + want + "초로 안 맞음(" + got + ")");
    dur = want + "초";
  } else {
    if (plan.dur) { if (has(plan.dur)) dur = plan.dur; else throw new Error("멈춤 — " + plan.dur + " 칸이 없음"); }
    else if (has("4초")) dur = "4초"; else if (has("8초")) dur = "8초";
    if (!dur) throw new Error("멈춤 — 4초(Veo는 8초) 칸이 없음");
    await clickInPanel(page, round, dur);
  }
  await clickInPanel(page, round, plan.n === 1 ? "x1" : "x2");
  const s = await readSettings(page);
  info = await panelInfo(page);
  step(round, "설정 맞춘 뒤", { want: plan, model: s.model, cost: s.cost, dur, panel: info.text });
  await closeSettings(page);
  const a = await readSettings(page);
  step(round, "설정 창 닫은 뒤", { chip: a.chip, slots: a.slots, frames: a.frames });
  return { cost: s.cost, model: s.model, dur, chip: a.chip, slots: a.slots };
}

export const slotImgs = (page) => page.evaluate(() => {
  const bar = document.querySelector("flow-ingredient-bar");
  return bar ? [...bar.querySelectorAll("img")].map((i) => ({ size: i.naturalWidth + "x" + i.naturalHeight, src: i.currentSrc || i.src })) : [];
});

// ── 그림 고르기 창
// 10-28 R14: 고르기 창이 열렸는데 제목 「프레임 이미지 선택」이 없는 때가 있었다 — 「애셋 검색」 입력칸으로도 알아본다
export const pickerOpen = (page) => page.evaluate(() => /프레임 이미지 선택/.test(document.body.innerText || "")
  || [...document.querySelectorAll('input[placeholder="애셋 검색"]')].some((i) => i.getBoundingClientRect().width > 0));
export async function closePicker(page) {
  const open = await pickerOpen(page);
  if (!open) return;
  try { await page.click('loc=css:button[aria-label="닫기"]', { label: "close frame picker" }); }
  catch { await page.keyboard.press("Escape"); }
  await page.waitForTimeout(800);
}
// 이름 검색 → 정확히 그 이름인 줄을 표식으로 눌러 칸에 건다(창이 남으면 「프롬프트에 추가」). 그 줄 썸네일의 애셋 id를 돌려준다.
export async function pickVerified(page, round, slot, file) {
  await closePicker(page);
  await page.click(`xpath=//button[normalize-space(.)='${slot}']`, { label: `open ${slot} frame picker` });
  // 10-28 R15: 제목 없는 새 고르기 창은 「애셋 검색」 칸이 숨어 있고 돋보기(search) 단추를 눌러야 나온다 — 칸이 없으면 그 단추를 누른다
  let seen = null;
  for (let i = 0; i < 20; i++) {
    seen = await page.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const input = [...document.querySelectorAll('input[placeholder="애셋 검색"]')].some(vis);
      document.querySelectorAll("[data-synk-search]").forEach((e) => e.removeAttribute("data-synk-search"));
      const btns = [...document.querySelectorAll("[role=dialog] button, [role=dialog] [role=button]")].filter((b) => vis(b) && (b.innerText || "").trim() === "search");
      if (btns.length === 1) btns[0].setAttribute("data-synk-search", "1");
      return { input, search: btns.length, dialogs: document.querySelectorAll("[role=dialog]").length };
    });
    if (seen.input) break;
    if (seen.search === 1 && i >= 2) {
      await page.click('[data-synk-search="1"]', { label: "open asset search box" });
      await page.waitForTimeout(800);
    } else await page.waitForTimeout(1000);
  }
  step(round, "고르기 창 " + slot, seen);
  if (!seen || !seen.input) throw new Error("멈춤 — 고르기 창의 「애셋 검색」 칸이 안 보임 " + JSON.stringify(seen));
  await page.fill('loc=css:input[placeholder="애셋 검색"]', file.replace(/\.(jpg|png)$/, ""));
  await page.waitForTimeout(2500);
  const r = await page.evaluate((file) => {
    // 크기만 보면 visibility:hidden인 줄(같은 이름 둘째 칸)을 골라 클릭이 막혔다(10-24 S23) — 보이는지까지 본다
    const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (e.checkVisibility ? e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) : getComputedStyle(e).visibility !== "hidden"); };
    const leaves = [...document.querySelectorAll("body *")].filter((e) => e.children.length === 0 && (e.textContent || "").trim() === file && vis(e));
    document.querySelectorAll("[data-synk-pick]").forEach((e) => e.removeAttribute("data-synk-pick"));
    const items = leaves.map((e) => {
      let a = e, img = null;
      for (let i = 0; i < 6 && a; i++, a = a.parentElement) { img = a.querySelector("img"); if (img) break; }
      const r = e.getBoundingClientRect();
      return { e, src: img ? (img.currentSrc || img.src) : null, x: r.x, y: r.y };
    });
    if (!items.length) return { n: 0 };
    items.sort((p, q) => p.x - q.x || p.y - q.y);
    const withImg = items.filter((o) => o.src);
    const pick = (withImg.length ? withImg : items)[0];
    pick.e.setAttribute("data-synk-pick", "1");
    return { n: leaves.length, src: pick.src, srcs: items.map((o) => o.src) };
  }, file);
  const uuid = uuidOf(r.src);
  step(round, "그림 검색 " + slot, { file, n: r.n, uuid, srcs: (r.srcs || []).map(uuidOf) });
  if (!r.n) { await closePicker(page); throw new Error("멈춤 — 검색 결과에 " + file + " 없음"); }
  await page.click('[data-synk-pick="1"]', { label: `choose ${file}` });
  await page.waitForTimeout(2500);
  const still = await pickerOpen(page);
  if (still) {
    const n = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => (b.innerText || "").trim() === "프롬프트에 추가" && b.getBoundingClientRect().width > 0).length);
    step(round, "프롬프트에 추가 단추 " + slot, { n });
    if (n === 1) {
      await page.click('xpath=//button[normalize-space(.)="프롬프트에 추가"]', { label: "add as " + slot + " frame" });
      await page.waitForTimeout(2500);
    }
  }
  await closePicker(page);
  // 11-23: 칸 썸네일 주소에 애셋 id가 없다(현장노트 10-31 「새 축소판」) — 이름 검색이 딱 하나면 「n1」로 돌려 내기 전 확인이 받게 한다
  return uuid || (r.n === 1 ? "n1" : null);
}

export async function typePrompt(page, prompt) {
  const rect = await page.evaluate(() => {
    const b = document.querySelector("[role=textbox], [contenteditable=true]");
    const r = b.getBoundingClientRect();
    return { x: r.x + Math.min(40, r.width / 2), y: r.y + r.height / 2 };
  });
  await page.mouse.click(rect.x, rect.y, { label: "focus prompt box" });
  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(300);
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(300);
  await page.keyboard.insertText(prompt);
  await page.waitForTimeout(1000);
}

// ── 결과 줄: 끝난 판 제목(.footer-title) · 실패 판(.error-title · .error-message-text) · 남은 % · 받기 단추 · video 수
export const rowState = (page, key) => page.evaluate((key) => {
  const notBox = (n) => !n.closest("[role=textbox], [contenteditable=true]");
  const leaves = [...document.querySelectorAll("div.prompt-text")].filter((n) => (n.textContent || "").includes(key) && notBox(n));
  const rows = [...new Set(leaves.map((n) => n.closest("div.batch-container")).filter(Boolean))];
  if (rows.length !== 1) return { found: rows.length, leaves: leaves.length };
  const row = rows[0];
  // 진행률은 「숫자%」만 든 칸에서만 읽는다 — 지시문의 「about 3% of the frame width」가 줄 안 여러 칸에 있어 끝을 못 봤다(10-27)
  const t = row.innerText || "";
  const pctLeaves = [...row.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^\s*\d{1,3}\s*%\s*$/.test(e.textContent || "")).map((e) => (e.textContent || "").trim());
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  return {
    found: 1,
    pct: pctLeaves,
    titles: [...row.querySelectorAll(".footer-title")].map((e) => (e.textContent || "").trim()),
    failTitles: row.querySelectorAll(".error-title").length,
    fails: [...row.querySelectorAll(".error-message-text")].map((e) => (e.textContent || "").trim()),
    videos: row.querySelectorAll("video").length,
    dl: [...row.querySelectorAll("button")].filter((b) => /다운로드/.test(b.getAttribute("aria-label") || "") && vis(b)).map((b) => b.getAttribute("aria-label")),
    meta: ((t.match(/(Veo[^\n•]*|Omni[^\n•]*)•[^\n]*/) || [""])[0]).replace(/\s+/g, " ").slice(0, 80),
    y: Math.round(row.getBoundingClientRect().y),
  };
}, key);

// 줄 안에서 aria-label이 src에 맞는 보이는 단추 하나에 표식(data-synk-dl)을 달고 화면 가운데로(맨 위 줄은 머리 띠에 가려진다, 10-21)
// 「삭제」가 바로 옆이라 좌표로 누르지 않는다. 여럿이면 「일괄 다운로드」 하나만.
export const markRowButton = (page, key, src) => page.evaluate(({ key, src }) => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const notBox = (n) => !n.closest("[role=textbox], [contenteditable=true]");
  const leaves = [...document.querySelectorAll("div.prompt-text")].filter((n) => (n.textContent || "").includes(key) && notBox(n));
  const rows = [...new Set(leaves.map((n) => n.closest("div.batch-container")).filter(Boolean))];
  document.querySelectorAll("[data-synk-dl]").forEach((e) => e.removeAttribute("data-synk-dl"));
  if (rows.length !== 1) return { err: "줄 " + rows.length };
  const re = new RegExp(src);
  let bs = [...rows[0].querySelectorAll("button")].filter(vis).filter((b) => re.test(b.getAttribute("aria-label") || ""));
  const labels = bs.map((b) => b.getAttribute("aria-label"));
  if (bs.length > 1) bs = bs.filter((b) => (b.getAttribute("aria-label") || "") === "일괄 다운로드");
  if (bs.length !== 1) return { err: "단추 " + bs.length, labels };
  bs[0].setAttribute("data-synk-dl", "1");
  bs[0].scrollIntoView({ block: "center" });
  return { ok: true, label: bs[0].getAttribute("aria-label"), labels };
}, { key, src });

// 줄의 「다운로드」(두 판이 끝났으면 zip, 한 판이면 mp4)를 waitForEvent → saveAs로 받는다(다운로드 폴더를 거치지 않음).
// 메뉴가 뜨면 「720p」 하나만 고른다(1080p · 4K 업스케일은 하지 않는다 — 4K는 50크레딧).
// 10-27: 같은 ego 브라우저의 다른 세션(서울로 네이처) 받기 이벤트가 내 waitForEvent("download")로 들어왔다(벚꽃 JPEG가 C04o_줄.zip으로 저장).
// 받기 앞뒤로 공유 노트 폴더의 잠금을 잡고, 받은 파일 머리(zip=PK · mp4=ftyp)가 기대와 다르면 「_섞임_」 이름으로 남기고 실패로 돌려준다.
const DL_LOCK = "C:/Users/q1212/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_129d6aba-b501-42b0-a446-c2f175d042cb/ego_받기.lock";
// 잠금 글은 「세션이름 도구 컷 시각」(첫 낱말 = 주인) — 네이처 세션과 맞춘 꼴(10-27). 수정 시각이 3분 넘은 잠금은 주인 없는 것으로 치운다(두 세션 같은 규칙).
async function takeDlLock(page, round, id) {
  try { fs.mkdirSync(DL_LOCK.replace(/\/[^/]+$/, ""), { recursive: true }); } catch {}
  for (let i = 0; i < 90; i++) {
    try { fs.writeFileSync(DL_LOCK, `labvt flow ${id} ${kst()}`, { flag: "wx" }); return true; } catch {}
    let age = 0;
    try { age = (Date.now() - fs.statSync(DL_LOCK).mtimeMs) / 1000; } catch { continue; }
    if (age > 180) { try { fs.unlinkSync(DL_LOCK); step(round, "주인 없는 받기 잠금 치움", { age: Math.round(age) }); } catch {} continue; }
    if (i % 10 === 0) step(round, "받기 잠금 기다림", { age: Math.round(age), who: (() => { try { return fs.readFileSync(DL_LOCK, "utf8").split(" ")[0]; } catch { return null; } })() });
    await page.waitForTimeout(2000);
  }
  return false;
}
const dropDlLock = () => { try { if (fs.readFileSync(DL_LOCK, "utf8").startsWith("labvt ")) fs.unlinkSync(DL_LOCK); } catch {} };
// 사용자 다운로드 폴더의 mp4(이름 · 경로 · 크기 · 수정 시각) — 받기 사건이 안 올 때 찾는다
const DOWNLOADS = (process.env.USERPROFILE || "C:/Users/q1212").split("\\").join("/") + "/Downloads/";
function downloadsMp4() {
  try {
    return fs.readdirSync(DOWNLOADS).filter((n) => /\.mp4$/i.test(n)).map((n) => {
      const st = fs.statSync(DOWNLOADS + n);
      return { name: n, path: DOWNLOADS + n, size: st.size, mtime: st.mtimeMs };
    });
  } catch { return []; }
}
function magicOk(path, zip) {
  const b = Buffer.alloc(12);
  const fd = fs.openSync(path, "r");
  try { fs.readSync(fd, b, 0, 12, 0); } finally { fs.closeSync(fd); }
  return zip ? b[0] === 0x50 && b[1] === 0x4b : b.toString("latin1", 4, 8) === "ftyp";
}

export async function downloadRow(page, round, id, key) {
  if (!(await takeDlLock(page, round, id))) return { err: "받기 잠금을 3분 안에 못 잡음" };
  try { return await downloadRowInner(page, round, id, key); } finally { dropDlLock(); }
}

async function downloadRowInner(page, round, id, key) {
  const mk = await markRowButton(page, key, "다운로드");
  step(round, "받기 단추 " + id, mk);
  if (!mk.ok) return { err: "받기 단추 " + (mk.err || "") };
  await page.waitForTimeout(1000);
  const dlp = page.waitForEvent("download", { timeout: 150000 });
  dlp.catch(() => {});
  const 누른때 = Date.now();
  const 받은전 = new Set(downloadsMp4().map((f) => f.name));
  await page.click('[data-synk-dl="1"]', { label: "download " + id + " row" });
  await page.waitForTimeout(2500);
  const menu = await page.evaluate(() => [...document.querySelectorAll("[role=menuitem]")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()));
  if (menu.length) {
    step(round, "받기 메뉴 " + id, { menu });
    if (menu.filter((m) => /720p/.test(m)).length === 1) await page.click('css=[role=menuitem]:has-text("720p")', { label: "choose 720p original" });
    else { await page.keyboard.press("Escape"); return { err: "메뉴에서 720p를 하나로 못 고름", menu }; }
  }
  // 11-25: 받기 사건이 안 오고 파일이 사용자 다운로드 폴더로 바로 떨어진 때가 있다(waitForEvent는 150초를 넘겨도 끝나지 않았다).
  // 사건과 다운로드 폴더를 함께 본다 — 누른 뒤 새로 생겨 크기가 멈춘 mp4가 하나면 그것을 옮긴다(받기 잠금이 다른 Flow 받기와 겹치지 않게 지킨다).
  const 폴더판 = async () => {
    for (let i = 0; i < 75; i += 1) {
      await page.waitForTimeout(2000);
      const 새 = downloadsMp4().filter((f) => !받은전.has(f.name) && f.mtime >= 누른때 - 2000);
      if (새.length === 1) {
        const a = 새[0].size;
        await page.waitForTimeout(1500);
        const b = (downloadsMp4().find((f) => f.name === 새[0].name) || {}).size;
        if (a > 100000 && a === b) return { 폴더: 새[0] };
      } else if (새.length > 1) return { 여럿: 새.map((f) => f.name) };
    }
    return null;
  };
  const 먼저 = await Promise.race([dlp.then((d) => ({ d })).catch(() => null), 폴더판()]);
  if (먼저 && 먼저.여럿) return { err: "다운로드 폴더에 새 mp4가 여럿 — 어느 것이 이 판인지 모름", files: 먼저.여럿 };
  if (먼저 && 먼저.폴더) {
    const f = 먼저.폴더;
    let dest = OUT + id + "_a.mp4";
    for (const L of "bcdefgh") { if (!fs.existsSync(dest)) break; dest = OUT + id + "_" + L + ".mp4"; }
    if (fs.existsSync(dest)) return { err: "이미 있는 파일 " + dest, name: f.name };
    fs.copyFileSync(f.path, dest);
    if (!magicOk(dest, false)) { fs.unlinkSync(dest); return { err: "다운로드 폴더 파일 머리가 mp4가 아님", name: f.name }; }
    try { fs.unlinkSync(f.path); } catch {}
    step(round, "다운로드 폴더에서 옮김 " + id, { name: f.name });
    return { name: f.name, dest, size: fs.statSync(dest).size, zip: false };
  }
  if (!먼저 || !먼저.d) return { err: "받기 사건도 다운로드 폴더 파일도 없음(150초)" };
  const d = 먼저.d;
  const name = d.suggestedFilename();
  const zip = /\.zip$/i.test(name);
  let dest = zip ? FLOW + "zip/" + id + "_줄.zip" : OUT + id + "_a.mp4";
  for (const L of "bcdefgh") { if (zip || !fs.existsSync(dest)) break; dest = OUT + id + "_" + L + ".mp4"; }   // 11-23: 세 번째 판부터 _c · _d
  if (fs.existsSync(dest)) return { err: "이미 있는 파일 " + dest, name };
  await d.saveAs(dest);
  if (!magicOk(dest, zip)) {
    const bad = FLOW + "zip/_섞임_" + id + "_" + Date.now() + "_" + name;
    fs.renameSync(dest, bad);
    return { err: "받은 파일 머리가 " + (zip ? "zip" : "mp4") + "가 아님 — 다른 받기와 섞였을 수 있음", name, bad };
  }
  return { name, dest, size: fs.statSync(dest).size, zip };
}
