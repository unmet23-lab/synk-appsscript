// 아르곤 웹 — Gemini 웹 「4 Argon」 · 사고 수준 「높음」 새 대화에 파일(사진 · 글 · 영상)을 올리고 지시문을 보내 답을 파일로 받는 ego 페이지 스크립트.
// 부르는 쪽이 globalThis.JOB을 앞에 붙여 `ego-browser nodejs` 표준 입력으로 돌린다(한글 경로는 -e import가 안 된다):
//   tools/아르곤웹.js(사진 · 지시문 검수 — 공용 차례를 잡고 부른다) · tools/오마주.js 아르곤(원본 영상 첫 분석).
//   JOB = { mode: "보내기" | "읽기", files, prompt, out, shots, u, space, head, mark, failShot, sentWaitSec, answerMin }
// 10-28 오마주 영상용 실행기를 10-31 사진 · 지시문 검수 시험판과 합쳐 넓혔다. 읽기 · 보내기만 한다 — 영상 권리 동의 창 · 한도 · 로봇 확인이
// 보이면 누르지 않고 멈춘다. 함정은 docs/현장노트/gemini_사진.md 「영상 올려 분석시키기」 절.
// - 보내기는 빈 탭이나 새 탭에서 한다: 답이 생기는 중인 탭을 다른 주소로 옮기면 대화가 통째로 사라진다(10-27). 받으면 그 탭을 닫는다.
// - 보내기를 누르기 직전에 표시 파일(mark)을 쓴다 — 표시가 남은 작업은 부르는 쪽이 다시 보내지 않고 「읽기」로 받는다(10-29 두 번 보냄).
// - 보냈는지는 대화 주소만으로 보지 않는다 — 보낸 글(user-query)의 지시문 앞머리 · 멈춤 단추로도 본다(10-26~10-31 주소가 늦게 붙음).
// - 글 파일(.txt) 칩에는 「첨부파일 닫기」 단추가 안 잡힌다 — 사진 · 영상만 그 단추로 세고, 글 파일은 칩의 이름(확장자 뺀)으로 본다(10-31).
const fs = await import("node:fs/promises");
const J = globalThis.JOB;
const mode = J.mode || "보내기";
const files = J.files || (J.video ? [J.video] : []);
const { prompt, out, u } = J;
const shots = J.shots || out.replace(/[\\/][^\\/]*$/, "");
const space = J.space || "synk-argon-web";
const head = J.head || "아르곤 답";
const mark = J.mark || `${out}.보냄.json`;
const failShot = J.failShot || `${shots}/${out.split(/[\\/]/).pop().replace(/\.[^.]+$/, "")}_실패.png`;
const sentWait = (J.sentWaitSec || 180) * 1000;
const answerMs = (J.answerMin || 12) * 60_000;
const base = (f) => f.split(/[\\/]/).pop();
const kind = (f) => (/\.(jpe?g|png|webp|gif|heic)$/i.test(f) ? "사진" : /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(f) ? "영상" : "글");
const chipN = files.filter((f) => kind(f) !== "글").length;
const docNames = files.filter((f) => kind(f) === "글").map((f) => base(f).replace(/\.[^.]+$/, ""));
const norm = (t) => String(t || "").replace(/\d+\.(?=\s)/g, "").replace(/[\s#*_`>|-]+/g, ""); // 보낸 글은 목록 번호 · 마크다운 기호가 빠져 그려진다
const promptHead = norm(prompt).slice(0, 40);
const promptLen = String(prompt || "").replace(/\s+/g, "").length;
const log = (o) => console.log(JSON.stringify(o));
const now = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
let page = null;
const fail = async (why, kind_ = "실패") => {
  if (page) await page.screenshot({ path: failShot }).catch(() => {});
  log({ step: "fail", kind: kind_, why });
  throw new Error(why);
};
const state = () => page.evaluate(() => {
  const labs = [...document.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || "");
  const mode = labs.find((t) => t.startsWith("모드 선택 도구 열기")) || "";
  const closes = labs.filter((t) => t === "첨부파일 닫기").length;
  const busy = labs.some((t) => /대답 생성 중지|생성 중지|Stop/.test(t));
  const ed = document.querySelector('[aria-label="Gemini 프롬프트 입력"]');
  const len = ed ? ed.innerText.replace(/\s+/g, "").length : -1;
  const text = document.body.innerText;
  const uqs = [...document.querySelectorAll("user-query")];
  return {
    mode, closes, busy, len, path: location.pathname, uqN: uqs.length,
    uq: uqs.length ? uqs[uqs.length - 1].innerText.slice(0, 3000) : "",
    failed: /업로드에 실패|실패한 파일/.test(text),
    limit: /한도는 .*초기화|사용량 한도/.test(text),
    consent: /동영상 제작에 관한 알림|필요한 권리가 있는지 확인/.test(text) && /동의/.test(text),
  };
});
const answerNow = (p) => p.evaluate(() => {
  const resp = [...document.querySelectorAll("model-response")];
  const el = resp[resp.length - 1];
  const busy = [...document.querySelectorAll("button")].some((b) => /대답 생성 중지|생성 중지|Stop/.test(b.getAttribute("aria-label") || ""));
  return { text: el ? el.innerText : "", busy };
});
const writeMark = (url) => fs.writeFile(mark, JSON.stringify({ 시각: now(), 공간: space, 계정: u, 대화: url || null, 지시문앞: promptHead, 답: out }, null, 1) + "\n", "utf8").catch(() => {});

// 답 기다리기 — 글이 30초 동안 안 늘고 멈춤 단추가 없으면 끝(200자 아래 짧은 답은 60초). 대화 주소가 늦게 붙으면 붙는 대로 표시에 적는다.
const waitAnswer = async (url) => {
  let last = "", same = 0, text = "", busy = true;
  const t0 = Date.now();
  while (Date.now() - t0 < answerMs) {
    await page.waitForTimeout(5000);
    const r = await answerNow(page).catch(() => ({ text: "", busy: true }));
    text = r.text;
    busy = r.busy;
    same = text && text === last && !busy ? same + 1 : 0;
    last = text;
    if (!/\/app\/[0-9a-f]+/.test(url)) {
      const nu = await page.url().catch(() => url);
      if (/\/app\/[0-9a-f]+/.test(nu)) { url = nu; await writeMark(url); log({ step: "url", url }); }
    }
    if ((same >= 6 && text.length > 200) || same >= 12) return { text, url };
  }
  if (busy || text.length > 200) await fail(`답이 ${J.answerMin || 12}분 안에 안 끝남(${text.length}자) — 다시 보내지 말고 나중에 「읽기」`, "늦음");
  return await fail("답이 안 나옴: " + text.slice(0, 200));
};
const finish = async (text, url) => {
  const names = files.map(base).join(" · ");
  await fs.writeFile(out, `# ${head} — ${now()}\n\n대화: ${url}\n${names ? `올린 것: ${names}\n` : ""}\n${text}\n`, "utf8");
  await fs.unlink(mark).catch(() => {});
  log({ step: "done", url, chars: text.length, out });
  await page.close().catch(() => {});
};

const task = await taskSpace(space);

if (mode === "읽기") {
  // 보낸 대화가 남은 탭을 지시문 앞머리로 찾아 읽기만 한다 — 주소를 옮기거나 새로 고치지 않는다(10-27 대화가 사라짐).
  const pages = await task.pages();
  for (const p of pages.slice().reverse()) {
    const qs = await p.evaluate(() => [...document.querySelectorAll("user-query")].map((e) => e.innerText.slice(0, 3000))).catch(() => []);
    if (qs.some((t) => norm(t).includes(promptHead))) { page = p; break; }
  }
  if (!page) await fail(`작업 공간 「${space}」의 탭 ${pages.length}개 가운데 이 지시문을 보낸 대화가 없다 — 다시 보내기 전에 사이드바에서 찾는다`, "없음");
  await page.info();
  const url = await page.url();
  log({ step: "tab", url });
  const r = await waitAnswer(url);
  await finish(r.text, r.url);
} else {
  // 빈 탭만 다시 쓴다 — 대화가 열린 탭은 답이 아직 생기는 중일 수 있어 건드리지 않고 새 탭을 연다
  for (const p of await task.pages()) { const pu = await p.url().catch(() => "x"); if (!pu || pu === "about:blank" || /^chrome:\/\/new-?tab/.test(pu)) { page = p; break; } }
  if (!page) page = await task.newPage();
  await page.info();
  const win = await page.cdp("Browser.getWindowForTarget", {});
  if (win.bounds.windowState === "minimized") { await page.cdp("Browser.setWindowBounds", { windowId: win.windowId, bounds: { windowState: "normal" } }); await page.waitForTimeout(1500); }
  for (let i = 0; ; i++) {
    try { await page.goto(`https://gemini.google.com/u/${u}/app`); break; } catch (e) {
      if (/navigation committed/.test(e.message)) break;
      if (i >= 2 || !/ERR_ABORTED|timeout/i.test(e.message)) throw e;
      await page.waitForTimeout(3000);
    }
  }
  let s = { mode: "", len: -1 };
  for (let i = 0; i < 45; i++) { await page.waitForTimeout(2000); s = await state().catch(() => ({ mode: "", len: -1, limit: false })); if (s.mode || s.len >= 0) break; }
  if (/sorry/.test(await page.url())) await fail("로봇 확인 화면(sorry) — 멈춤, 유호님 손", "멈춤");
  if (s.limit) await fail("사용량 한도 문구가 보임", "멈춤");
  // 빈 입력창에서는 모드 단추를 숨긴다(10-31) — 「.」을 먼저 넣고, 모드 단추는 사이드바가 다 뜬 뒤에 나오니 30초까지 기다린다(10-25).
  if (!s.mode && s.len >= 0) {
    await page.click('loc=css:[aria-label="Gemini 프롬프트 입력"]', { timeout: 15000, label: "focus prompt box" }).catch(() => {});
    await page.waitForTimeout(400);
    await page.keyboard.insertText(".");
    for (let i = 0; i < 15; i++) { await page.waitForTimeout(2000); s = await state().catch(() => s); if (s.mode) break; }
  }
  const mark_ = (re, tag) => page.evaluate(({ re, tag }) => {
    document.querySelectorAll(`[data-synk="${tag}"]`).forEach((e) => e.removeAttribute("data-synk"));
    const r = new RegExp(re);
    const el = [...document.querySelectorAll("gem-menu-item, [role=menuitem], [role=menuitemradio], input-companion-item, button")]
      .find((e) => r.test((e.innerText || "").trim()) && e.getBoundingClientRect().width > 0);
    if (el) el.setAttribute("data-synk", tag);
    return !!el;
  }, { re, tag });
  // 「+」를 누른 뒤 모드 단추가 늦게 찬다 — 1.5초씩 여덟 번 보고, 짧은 메뉴는 Escape로 닫고 다시 누른다(10-31 b 줄).
  const openTools = async () => {
    for (let i = 0; i < 3; i++) {
      s = await state();
      if (s.mode) return;
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);
      await page.click('loc=css:button[aria-label="업로드 및 도구"]', { timeout: 15000, label: "open tools panel" }).catch(() => {});
      for (let k = 0; k < 8; k++) { await page.waitForTimeout(1500); s = await state(); if (s.mode) return; }
    }
    s = await state();
    if (!s.mode) await fail("모드 단추가 없음(도구 판을 열어도)");
  };
  const OK = (m) => /Argon/.test(m) && /높음|최고가/.test(m);
  const chooseArgon = async () => {
    for (let i = 0; i < 3; i++) {
      await openTools();
      if (OK(s.mode)) return;
      await page.click('loc=css:button[aria-label^="모드 선택 도구 열기"]', { timeout: 15000, label: "open mode menu" });
      await page.waitForTimeout(1300);
      if (!/Argon/.test(s.mode) && (await mark_("^4 Argon", "argon"))) {
        await page.click('loc=css:[data-synk="argon"]', { timeout: 15000, label: "choose 4 Argon" });
        await page.waitForTimeout(1300);
        await openTools();
        await page.click('loc=css:button[aria-label^="모드 선택 도구 열기"]', { timeout: 15000, label: "open mode menu" });
        await page.waitForTimeout(1300);
      }
      if (await mark_("^사고 수준", "think")) { await page.click('loc=css:[data-synk="think"]', { timeout: 15000, label: "open thinking submenu" }); await page.waitForTimeout(1300); }
      if (await mark_("^높음", "hi")) { await page.click('loc=css:[data-synk="hi"]', { timeout: 15000, label: "choose high thinking" }); await page.waitForTimeout(1300); }
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(700);
    }
    await openTools();
  };
  await chooseArgon();
  if (!OK(s.mode)) await fail("모드가 4 Argon · 높음이 아님: " + s.mode);
  log({ step: "mode", mode: s.mode });

  // 파일 올리기 — 숨은 파일 칸이 없어 「파일 업로드」를 파일 선택 대기와 함께 실제로 누른다(10-22)
  if (files.length) {
    const menuText = () => page.evaluate(() => { const m = document.querySelector("[role=menu]"); return m ? m.innerText : ""; });
    let mt = await menuText();
    for (let i = 0; i < 3 && !/파일 업로드/.test(mt); i++) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(600);
      await page.click('loc=css:button[aria-label="업로드 및 도구"]', { timeout: 15000, label: "open upload menu" }).catch(() => {});
      for (let k = 0; k < 6 && !/파일 업로드/.test(mt); k++) { await page.waitForTimeout(1000); mt = await menuText(); }
    }
    if (!/파일 업로드/.test(mt)) await fail("「파일 업로드」 메뉴가 안 뜸");
    await page.evaluate(() => {
      document.querySelectorAll('[data-synk="upl"]').forEach((e) => e.removeAttribute("data-synk"));
      const el = [...document.querySelectorAll("[role=menu] *")].find((e) => e.childElementCount === 0 && (e.innerText || "").trim() === "파일 업로드");
      if (el) el.setAttribute("data-synk", "upl");
    });
    const chooserP = page.waitForFileChooser({ timeout: 15000 });
    await page.click('loc=css:[data-synk="upl"]', { timeout: 15000, label: "choose file upload" }).catch((e) => fail("파일 업로드 누르기 실패: " + e.message));
    const chooser = await chooserP.catch((e) => fail("파일 선택 창이 안 뜸(동의 창일 수 있다 — 누르지 않는다): " + e.message, "멈춤"));
    await chooser.setFiles(files);
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(1500); s = await state(); if (s.closes >= chipN || s.failed || s.consent) break; }
    if (s.consent) await fail("영상 권리 동의 창이 떴다 — 누르지 않고 멈춤(유호님 손)", "멈춤");
    if (s.failed) await fail("업로드 실패 표시 — 멈춤(보안 확인 신호일 수 있음)", "멈춤");
    if (s.closes < chipN) await fail(`첨부 칸의 사진 · 영상이 ${s.closes}/${chipN}개`);
    // 글 파일 칩은 「TXT」 + 확장자 없는 이름으로 보인다 — 보낸 글 · 사이드바 대화 이름은 빼고 찾는다(10-25)
    const seen = () => page.evaluate((names) => {
      let t = document.body.innerText;
      for (const el of document.querySelectorAll('user-query, a[href*="/app/"]')) { const x = el.innerText; if (x) t = t.split(x).join(" "); }
      return names.filter((n) => t.includes(n));
    }, docNames);
    let got = [];
    for (let i = 0; i < 20 && got.length < docNames.length; i++) { got = await seen().catch(() => got); if (got.length < docNames.length) await page.waitForTimeout(1500); }
    if (got.length < docNames.length) await fail("글 파일 칩이 안 보임: " + docNames.filter((n) => !got.includes(n)).join(", "));
    log({ step: "uploaded", 사진영상: s.closes, 글: got.length });
    // 썸네일이 뜬 뒤에도 올리는 중이다 — 수가 맞은 뒤 더 기다린다(10-25). 영상은 칩이 먼저 뜬다(10-28).
    await page.waitForTimeout(12000 + 1500 * files.length + (files.some((f) => kind(f) === "영상") ? 15000 : 0));
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(600);
  }

  // 지시문 → 보내기
  await page.click('loc=css:[aria-label="Gemini 프롬프트 입력"]', { timeout: 15000, label: "focus prompt box" }).catch((e) => fail("입력창 누르기 실패: " + e.message));
  await page.waitForTimeout(500);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(400);
  await page.keyboard.insertText(prompt);
  await page.waitForTimeout(2500);
  s = await state();
  if (Math.abs(s.len - promptLen) > 3) await fail(`지시문 길이가 다름 ${s.len}/${promptLen}`);
  if (s.mode && !OK(s.mode)) { await chooseArgon(); s = await state(); if (!OK(s.mode)) await fail("보내기 직전 모드가 바뀜: " + s.mode); }
  await writeMark(null); // 이 뒤로 끝나면 부르는 쪽은 다시 보내지 않는다
  log({ step: "clicking", 첨부단추: s.closes, 모드: s.mode });
  let clickErr = "";
  await page.click('loc=css:[aria-label="메시지 보내기"]', { timeout: 15000, label: "send prompt" }).catch((e) => { clickErr = e.message; });
  // 보냈는지 — 대화 주소, 보낸 글의 지시문 앞머리, 멈춤 단추 가운데 하나. 60초가 지나도 보낸 글이 없고 입력창에 지시문이 그대로면 안 간 것.
  let url = await page.url(), sent = false, notSent = false;
  const t1 = Date.now();
  while (Date.now() - t1 < sentWait) {
    await page.waitForTimeout(2000);
    const st = await state().catch(() => null);
    if (!st) continue;
    url = await page.url().catch(() => url);
    if (st.consent) await fail("보낸 뒤 영상 권리 동의 창 — 누르지 않고 멈춤(유호님 손)", "멈춤");
    if (/\/app\/[0-9a-f]+/.test(url) || st.busy || (st.uqN > 0 && norm(st.uq).includes(promptHead))) { sent = true; break; }
    if (Date.now() - t1 > 60_000 && st.uqN === 0 && Math.abs(st.len - promptLen) <= 3) { notSent = true; break; }
  }
  if (notSent) { await fs.unlink(mark).catch(() => {}); await fail(`보내기가 안 먹음 — 입력창에 지시문이 그대로다(다시 돌려도 된다)${clickErr ? " · " + clickErr : ""}`); }
  if (!sent) await fail("보낸 글도 대화 주소도 안 보임 — 다시 보내지 말고 사이드바 맨 위 대화부터 볼 것", "늦음");
  if (/\/app\/[0-9a-f]+/.test(url)) await writeMark(url);
  log({ step: "sent", url });
  const r = await waitAnswer(url);
  await finish(r.text, r.url);
}
