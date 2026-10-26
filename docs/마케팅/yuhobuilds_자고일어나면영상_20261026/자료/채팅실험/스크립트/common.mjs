// yuhobuilds Y9 v2 채팅 실험 공용 도우미(synkbrief B3 판에서 사용량 읽기를 뺌) — 휴대폰 폭 찍기 · 입력 녹화 · 답 기다리며 녹화.
// 라운드 파일이 import해서 쓴다. 모든 기록은 ROOT 아래(저장소 밖).
import fs from "node:fs";

export const ROOT = "C:/Users/q1212/ego/y9v2-20261027";
export const W = 430;
export const SCALE = 1080 / 430;

export function logger(name) {
  const file = `${ROOT}/${name}.steps.log`;
  return (s) => fs.appendFileSync(file, `${new Date().toISOString()} ${s}\n`);
}

export function watchdog(step, ms) {
  setTimeout(() => { step("감시 시간 초과 — 종료"); process.exit(3); }, ms);
}

export const race = (p, ms = 20_000, label = "시간 초과") => Promise.race([p, new Promise((r) => setTimeout(() => r({ __timeout: label }), ms))]);

export function record(name, obj) {
  fs.appendFileSync(`${ROOT}/measure.jsonl`, JSON.stringify({ round: name, ...obj }) + "\n");
}

export async function phone(page, h = 932) {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {});
    await page.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } });
  } catch {}
  await page.cdp("Page.bringToFront", {});
  await page.cdp("Emulation.setDeviceMetricsOverride", { width: W, height: h, deviceScaleFactor: SCALE, mobile: true });
}

export async function shot(page, file) {
  const r = await race(page.cdp("Page.captureScreenshot", { format: "jpeg", quality: 88, fromSurface: true }), 15_000);
  if (r.__timeout || !r.data) return false;
  fs.mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  return true;
}

/** 입력 칸에 글을 두 글자씩 넣으며 프레임을 찍는다. frames: [{f, ms, tag}] */
export async function typeRecorded(page, dir, text, frames, t0) {
  await page.click("[data-testid=chat-input]", { label: "click chat input" });
  await page.waitForTimeout(300);
  let n = frames.length;
  const snap = async (tag) => {
    const f = `f${String(n++).padStart(4, "0")}.jpg`;
    if (await shot(page, `${dir}/${f}`)) frames.push({ f, ms: Date.now() - t0, tag });
  };
  await snap("pre");
  const lines = text.split(String.fromCharCode(10));
  for (let li = 0; li < lines.length; li++) {
    if (li > 0) { await page.keyboard.press("Shift+Enter"); await page.waitForTimeout(80); await snap("type"); }
    const chars = [...lines[li]];
    for (let i = 0; i < chars.length; i += 2) {
      await page.keyboard.insertText(chars.slice(i, i + 2).join(""));
      await page.waitForTimeout(60);
      await snap("type");
    }
  }
  await snap("typed");
}

/** 보내고 답이 다 나올 때까지 프레임을 찍는다(글이 4초 동안 그대로이고 멈춤 단추가 없으면 끝). */
export async function sendAndRecord(page, dir, frames, t0, step, maxMs = 240_000) {
  let n = frames.length;
  const snap = async (tag) => {
    const f = `f${String(n++).padStart(4, "0")}.jpg`;
    if (await shot(page, `${dir}/${f}`)) frames.push({ f, ms: Date.now() - t0, tag });
  };
  await page.click("button[aria-label='메시지 보내기']", { label: "send message" });
  const sentAt = Date.now();
  step("보냄");
  let last = "";
  let sameSince = Date.now();
  while (Date.now() - sentAt < maxMs) {
    await snap("gen");
    const st = await race(page.evaluate(() => {
      const stop = [...document.querySelectorAll("button")].some((b) => /중지|Stop/i.test(b.getAttribute("aria-label") || ""));
      const msgs = document.querySelectorAll("[data-is-streaming], .font-claude-response, [data-testid=assistant-message]");
      const lastMsg = msgs.length ? msgs[msgs.length - 1].innerText : document.body.innerText.slice(-2000);
      const streaming = !!document.querySelector("[data-is-streaming=true]");
      return { stop, streaming, len: lastMsg.length, tail: lastMsg.slice(-80) };
    }), 8_000);
    if (st.__timeout) continue;
    const key = `${st.len}|${st.tail}`;
    if (key !== last) { last = key; sameSince = Date.now(); }
    if (!st.stop && !st.streaming && Date.now() - sameSince > 4000 && Date.now() - sentAt > 6000) break;
    await page.waitForTimeout(150);
  }
  step(`답 끝 ${(Date.now() - sentAt) / 1000}초`);
  await page.waitForTimeout(800);
  await snap("done");
  return Date.now() - sentAt;
}

/** 다 쓴 대화 화면 전체를 긴 한 장으로 */
export async function tallShot(page, file, h = 3200) {
  await page.cdp("Emulation.setDeviceMetricsOverride", { width: W, height: h, deviceScaleFactor: SCALE, mobile: true });
  await page.waitForTimeout(2000);
  const ok = await shot(page, file);
  await page.cdp("Emulation.setDeviceMetricsOverride", { width: W, height: 932, deviceScaleFactor: SCALE, mobile: true });
  return ok;
}
