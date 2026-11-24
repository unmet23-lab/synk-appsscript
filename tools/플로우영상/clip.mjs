// Flow 한 클립(한 줄)을 끝까지 — 광명역 공모 편 flow/clip.mjs(← 서울로 애니 · 「매진 임박」 v4_clip.mjs)를 옮김(11-25 Claude). 라운드 파일이 globalThis.V4 = { 편, round, id }를 정하고 이 파일을 import한다(tools/플로우영상.js).
// 바꾼 것: 프로젝트는 res._projects[plan.proj], 시작 그림 이름은 plan.start, 잠금 · 캡처 머리 v4_ 뺌, 확인한 접수 뒤 크레딧 읽기 그대로.
//   V4 = { round, id, run?(기록 이름 — 다시 낼 때 "S02r"), prompt?(다시 낼 때 바꾼 글), key?(그 글의 줄 찾기 KEY), finish? }
// 차례: 프로젝트 → 이미 낸 줄 · 접수 잠금이 있으면 기다리기부터 → 계정 창 크레딧(전) · 예산(계정에서 줄어든 양 + 이번 값 ≤ 250)
//   → 설정(동영상 · 프레임 · 16:9 · 모델 이름으로 · 720p · 4초 · x1/x2) → 시작 그림(이름 검색 · 애셋 id) → 지시문
//   → 내기 전 확인(창의 모델 이름 · 「생성 시 N 크레딧」 · 창 단추 선택 상태 · 칩 · 그림 칸 하나 1920x1080 · 끝 칸 빔 · 지시문 일치 · 띠 없음) + 확대 캡처
//   → 「생성 시작」 한 번(진짜 클릭) → 줄이 생겼는지 · 칸이 비었는지 → 크레딧(접수 뒤)
//   → 줄이 정해질 때까지(끝난 판 제목 + 실패 판 = 판 수, % 없음) → 끝난 판이 있으면 줄 「다운로드」(saveAs) → 크레딧(끝).
// 멈춤: 「크레딧 추가」 띠 · 예산 · 확인 실패 · 접수 줄 없음. 「다시 시도」 · 다시 누르기 · 결제 · 업스케일은 하지 않는다.
const fs = await import("node:fs");
const { pathToFileURL } = await import("node:url");
const L = await import(new URL("./lib.mjs", import.meta.url).href);
const { round: R, id, run = id, prompt: promptOverride = null, key: keyOverride = null, finish = false } = globalThis.V4;
const plan = L.PLAN[id];

// 창 단추가 골라져 있는지(aria-checked/selected "true")
const selected = (pi, label) => (pi.items || []).some((i) => (i.text === label || i.text.replace(/\b[a-z][a-z0-9_]*\b/g, "").replace(/\s+/g, " ").trim() === label) && i.state === "true");

if (!plan) {
  L.step(R, "오류", { e: "PLAN에 없는 클립 " + id });
  L.step(R, "끝", { stop: "PLAN에 없는 클립" });
} else if (!L.takeLock(R)) {
  L.step(R, "중복 — 그만둠");
} else {
  const t0 = Date.now();
  const res = L.loadRes();
  const rec = (res[run] = res[run] || {});
  const save = () => L.saveRes(res);
  let stop = null, task = null;
  try {
    const { full, src } = L.loadPrompts(R);
    const PROMPT = promptOverride || full[id];
    const KEY = keyOverride || plan.key;
    // 같은 프로젝트 안에서만 KEY가 겹치면 안 된다(Omni · Veo는 같은 지시문을 다른 프로젝트에 낸다)
    const others = Object.fromEntries(Object.entries(full).filter(([k]) => k !== id && L.PLAN[k] && L.PLAN[k].proj === plan.proj));
    if (promptOverride) others[id + "(원래 글)"] = full[id];
    L.checkKey(id, KEY, PROMPT, others);
    Object.assign(rec, { id, run, model: plan.model, n: plan.n, cost: plan.cost, key: KEY, prompt: PROMPT, promptSrc: src, start: plan.start + ".jpg", round: R });
    save();
    L.step(R, "클립", { id, run, model: plan.model, n: plan.n, cost: plan.cost, key: KEY, promptLen: PROMPT.length, override: !!promptOverride });

    task = await L.openSpace();
    const pages = await task.pages();
    const page = pages.length ? pages[pages.length - 1] : task.page("p1");
    await L.unmin(page, R);
    const PROJ = (res._projects || {})[plan.proj];
    if (!PROJ) throw new Error("멈춤 — 프로젝트 주소 기록 없음");
    // 10-28 E08x: 올리기 라운드 바로 뒤 같은 주소에서 「시작」을 누르면 검색칸 없는 그림 목록 창이 떴다 — 주소가 같아도 늘 새로 읽는다
    {
      // 10-27 C04v: 「load」를 15초 안에 못 기다려 goto가 던졌다(문서는 interactive까지 옴) — 이어서 아래 준비 확인으로 기다린다
      try { await page.goto(PROJ); } catch (e) { L.step(R, "goto 느림 — 이어감", { e: String(e).slice(0, 120) }); }
      try { await page.waitForLoadState(); } catch {}
    }
    for (let i = 0; i < 20; i++) {
      const ready = await page.evaluate(() => !!document.querySelector("[role=textbox], [contenteditable=true]") && !!document.querySelector('button[aria-label="설정 트리거"]'));
      if (ready) break;
      await page.waitForTimeout(1500);
    }
    // 앞 라운드가 그림 고르기 창을 연 채 멈추면 그 창이 계정 단추 클릭을 가로챈다(10-24 S23 → S25 · S02o) — 먼저 닫는다
    await L.closePicker(page);
    let f = await L.flags(page);
    if (f.dialogs) {
      // 10-28 R14: 제목 없는 고르기 창이 닫기 단추로 안 닫혀 다음 라운드를 막았다 — 프로젝트를 새로 읽으면 사라진다(접수 전이라 잃는 것 없음)
      const names = await page.evaluate(() => [...document.querySelectorAll("[role=dialog]")].map((d) => (d.innerText || "").replace(/\s+/g, " ").slice(0, 60)));
      L.step(R, "열린 창 — 새로 읽음", { dialogs: f.dialogs, names });
      try { await page.goto(PROJ); } catch (e) { L.step(R, "goto 느림 — 이어감", { e: String(e).slice(0, 120) }); }
      for (let i = 0; i < 20; i++) {
        const ready = await page.evaluate(() => !!document.querySelector("[role=textbox], [contenteditable=true]") && !!document.querySelector('button[aria-label="설정 트리거"]'));
        if (ready) break;
        await page.waitForTimeout(1500);
      }
      f = await L.flags(page);
    }
    L.step(R, "프로젝트", { ...f, space: task.spaceId, page: page.label });
    if (f.creditBand) throw new Error("멈춤 — 「크레딧 추가」 띠");
    if (f.dialogs) throw new Error("멈춤 — 열린 창이 있음");

    let st = await L.rowState(page, KEY);
    const already = st.found > 0 || L.hasLock(run + ".submit");
    L.step(R, "이미 낸 줄?", { already, found: st.found });

    if (!already) {
      // 크레딧(전) · 예산
      const cb = await L.readCredits(page, R, "접수 전 " + run);
      Object.assign(rec, { creditsBefore: cb.credits, creditsBeforeAt: cb.at, watermark: cb.watermark });
      save();
      const cost = L.num(plan.cost);
      if (cb.credits < cost) throw new Error("멈춤 — 크레딧이 모자람(" + cb.credits + " < " + cost + ")");
      // 11-25: 계정을 공모전 · PULSE와 같이 쓰므로 LAB 편 영상은 남은 크레딧이 바닥(1,000) 밑으로 내려가게 내지 않는다 — 그 편은 정지 그림 판으로 만든다
      if (cb.credits - cost < L.FLOOR) throw new Error(`멈춤 — Flow 크레딧 바닥: 남은 ${cb.credits} − 이번 ${cost} < ${L.FLOOR}(제작 절차 「LAB 편 전체 영상」 — 이 편은 정지 그림 판으로)`);
      // 계정은 다른 세션(네이처 · 정직 UCC)과 같이 쓰므로 잔액 차이가 아니라 이 프로젝트에서 내가 접수한 줄의 값을 센다(10-27).
      // 모든 판이 정책 실패로 끝난 줄은 환불되므로 빼고 센다.
      const used = Object.entries(res).filter(([k, v]) => !k.startsWith("_") && !k.startsWith("그림:") && v && v.accepted && L.PLAN[v.id] && L.PLAN[v.id].proj === plan.proj
        && !(v.failTitles >= (v.n || 2) && !(v.titles || []).length)).reduce((a, [, v]) => a + L.num(v.cost), 0);
      L.step(R, "예산", { proj: plan.proj, used, cost, budget: L.BUDGET, account: cb.credits });
      if (used + cost > L.BUDGET) throw new Error(`멈춤 — 예산: 이미 ${used} + 이번 ${cost} > ${L.BUDGET}`);

      // 설정 → 시작 그림 → 지시문
      rec.settings = await L.ensureSettings(page, R, plan);
      save();
      let s = await L.readSettings(page);
      if (s.frames.length || s.prompt.trim()) {
        // 앞 라운드가 접수 전에 멈추면 그 칸 그림 · 지시문이 남는다(10-23 23:34 S07 → S10). 이 프로젝트는 이 시험만 쓰므로 남은 것은 내 것이다.
        // 그림 칩 위 취소 표시를 한 번 누르고(메뉴 · 창이 뜨면 Escape 후 멈춤), 지시문은 전체 지우기. 그래도 남으면 멈춘다.
        L.step(R, "남은 칸 비우기", { frames: s.frames, prompt: s.prompt.trim().slice(0, 30) });
        for (let k = 0; k < 3 && (await L.readSettings(page)).frames.length; k++) {   // 시작 · 끝 칩이 둘 남을 수 있다(끝 그림 클립)
          const c = await page.evaluate(() => {
            const b = document.querySelector('flow-ingredient-bar button[aria-label="이미지 소재"]');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          });
          if (!c) throw new Error("멈춤 — 남은 그림 칩을 못 찾음");
          try { await page.mouse.move(c.x, c.y); } catch {}
          await page.waitForTimeout(600);
          await page.mouse.click(c.x, c.y, { label: "remove leftover start frame" });
          await page.waitForTimeout(1200);
          const pop = await page.evaluate(() => document.querySelectorAll("[role=dialog], [role=menu]").length);
          if (pop) { await page.keyboard.press("Escape"); throw new Error("멈춤 — 그림 칩을 누르자 메뉴 · 창이 열림(" + pop + ")"); }
        }
        if ((await L.readSettings(page)).prompt.trim()) await L.typePrompt(page, "");
        s = await L.readSettings(page);
        L.step(R, "비운 뒤", { frames: s.frames, prompt: s.prompt.trim().slice(0, 30), slots: s.slots });
        if (s.frames.length || s.prompt.trim()) throw new Error("멈춤 — 칸 · 지시문이 비어 있지 않음 " + JSON.stringify({ frames: s.frames, prompt: s.prompt.trim().slice(0, 30) }));
      }
      const su = await L.pickVerified(page, R, "시작", plan.start + ".jpg");
      rec.startUuid = su;
      // 끝 그림(plan.end) — 시작 그림에 얼굴이 없어 Omni가 다른 얼굴을 지어낸 컷(10-24 #26 통2 닮음 0.16)에 그 사람 얼굴을 끝 칸으로 건다
      const eu = plan.end ? await L.pickVerified(page, R, "종료", plan.end + ".jpg") : null;
      rec.endUuid = eu;
      await L.typePrompt(page, PROMPT);

      // 내기 전 확인(누르지 않음) + 확대 캡처
      await L.unmin(page, R);
      const imgs = await L.slotImgs(page);
      const slotIds = imgs.map((i) => L.uuidOf(i.src));
      await L.openSettings(page);
      const v = await L.readSettings(page);
      const pi = await L.panelInfo(page);
      await L.zoomShot(page, R, `${run}_설정확대`, L.panelRect);
      await L.closeSettings(page);
      const a = await L.readSettings(page);
      await L.zoomShot(page, R, `${run}_칸확대`, L.composerRect);
      await L.shot(page, R, `${run}_접수전`);
      const chip = a.chip || "";
      const dur = rec.settings.dur;
      const checks = {
        cost: v.cost === plan.cost,
        model: v.model === plan.model,
        panelSel: selected(pi, "동영상") && selected(pi, "프레임") && selected(pi, "9:16") && (plan.model === L.OMNI ? (pi.text || "").includes("길이 " + dur) : selected(pi, dur)) && selected(pi, plan.n === 1 ? "x1" : "x2") && (plan.model !== L.OMNI || selected(pi, "720p")),
        chip: /동영상|videocam|Omni|Veo/.test(chip) && /crop_9_16|9:16/.test(chip) && (plan.model === L.OMNI || chip.includes(dur)) && (plan.n === 1 ? !/x[2-4]\b/.test(chip) : /x2\b/.test(chip)) && (plan.model === L.OMNI ? /720p/.test(chip) : !/1080p|4K/i.test(chip)),
        frames: imgs.length === (plan.end ? 2 : 1) && imgs.every((i) => { const [w, h] = i.size.split("x").map(Number); return h > 0 && Math.abs(w / h - 9 / 16) < 0.01; }),   // 11-25 LAB 세로 판: 칸 그림 288x512 축소판이라 비율로 본다
        // 검색 썸네일 주소가 늦게 떠 su가 비면(10-23 23:34 S07) 올릴 때(v4_round-01) 이름 검색으로 적어 둔 그 그림의 애셋 id와 대조한다
        frameId: su === "n1" || !!slotIds[0] && (slotIds[0] === su || !su || (!su && ((res._assets || {})[plan.proj + ":" + plan.start] || {}).uuids?.includes(slotIds[0]) === true)),
        endSlotEmpty: plan.end ? !a.slots.includes("종료") && !a.slots.includes("시작") : a.slots.includes("종료") && !a.slots.includes("시작"),
        endId: !plan.end || eu === "n1" || (!!slotIds[1] && (slotIds[1] === eu || (!eu && ((res._assets || {})[plan.proj + ":" + plan.end] || {}).uuids?.includes(slotIds[1]) === true))),
        prompt: L.norm(a.prompt) === L.norm(PROMPT),
        noBand: !a.creditBand && !v.creditBand,
        noDialog: a.dialogs === 0,
      };
      Object.assign(rec, { checks, checkRead: { cost: v.cost, model: v.model, chip, frames: imgs.map((i) => i.size), slotIds, slots: a.slots, panel: pi.text } });
      save();
      L.step(R, "내기 전 확인 " + run, { cost: v.cost, model: v.model, chip, dur, frames: imgs.map((i) => i.size), slotIds, su, slots: a.slots, promptHead: a.prompt.slice(0, 60), checks });
      if (!Object.values(checks).every(Boolean)) throw new Error("멈춤 — 내기 전 확인이 맞지 않아 누르지 않음 " + JSON.stringify(checks));

      // 「생성 시작」 한 번
      st = await L.rowState(page, KEY);
      if (st.found > 0) throw new Error("멈춤 — 같은 지시문 줄이 이미 있음");
      if (!L.takeLock(run + ".submit")) throw new Error("멈춤 — 접수 잠금이 이미 있음");
      await page.evaluate(() => { const b = document.querySelector('button[aria-label="생성 시작"]'); if (b) b.scrollIntoView({ block: "center" }); });
      await page.waitForTimeout(600);
      Object.assign(rec, { submittedAt: L.kstNow(), submittedMs: Date.now() });
      save();
      L.step(R, "생성 시작 누름 " + run);
      try { await page.click('loc=css:button[aria-label="생성 시작"]', { label: "start " + run + " generation" }); }
      catch (e) { L.step(R, "누름 오류 — 다시 누르지 않음 " + run, { e: String(e).slice(0, 200) }); }
      await page.waitForTimeout(6000);
      st = await L.rowState(page, KEY);
      if (st.found !== 1) { await page.waitForTimeout(10000); st = await L.rowState(page, KEY); }
      const left = await L.readSettings(page);
      rec.accepted = st.found === 1;
      save();
      L.step(R, "접수 확인 " + run, { found: st.found, pct: st.pct, promptLeft: left.prompt.trim().slice(0, 30), framesAfter: left.frames, band: left.creditBand });
      await L.shot(page, R, `${run}_접수뒤`);
      if (!rec.accepted) throw new Error("멈춤 — 접수 줄이 안 보임(다시 누르지 않음)");
      if (left.creditBand) throw new Error("멈춤 — 「크레딧 추가」 띠");
      const ca = await L.readCredits(page, R, "접수 뒤 " + run);
      Object.assign(rec, { creditsAfterSubmit: ca.credits, creditsAfterSubmitAt: ca.at });
      save();
    } else if (!rec.submittedMs) {
      const lk = L.FLOW + run + ".submit.lock";
      if (fs.existsSync(lk)) rec.submittedMs = fs.statSync(lk).mtimeMs;
    }

    // 줄이 정해질 때까지(Veo 15분 · Omni 10분)
    const tSub = rec.submittedMs || Date.now();
    const maxSec = plan.model === L.VEO ? 900 : 600;
    const tw = Date.now();
    let done = null, noPct = 0, lastLog = -999, k = 0;
    while (L.sec(tw) < maxSec) {
      if (k++ % 3 === 0) await L.unmin(page, R);
      st = await L.rowState(page, KEY);
      if (st.found === 1) {
        if (st.pct.length) noPct = 0; else noPct++;
        const settled = st.pct.length === 0 && st.titles.length + st.failTitles >= plan.n;
        const alt = st.pct.length === 0 && noPct >= 3 && st.videos >= plan.n && L.sec(tSub) > 60;
        if (settled || alt) { done = st; break; }
      }
      if (L.sec(tw) - lastLog >= 30) { L.step(R, "기다림 " + run, { found: st.found, pct: st.pct, titles: st.titles, failTitles: st.failTitles, videos: st.videos, s: L.sec(tSub) }); lastLog = L.sec(tw); }
      await page.waitForTimeout(10000);
    }
    if (!done) { rec.pending = true; save(); throw new Error("멈춤 — " + maxSec + "초 안에 끝난 줄을 못 봄"); }
    rec.pending = false;
    Object.assign(rec, { genSec: L.sec(tSub), titles: done.titles, failTitles: done.failTitles, fails: done.fails, videos: done.videos, meta: done.meta, settledAt: L.kstNow() });
    save();
    L.step(R, "판 결과 " + run, { genSec: rec.genSec, titles: done.titles, failTitles: done.failTitles, fails: done.fails, videos: done.videos, dl: done.dl, meta: done.meta });
    await L.shot(page, R, `${run}_끝`);

    // 받기 — 끝난 판이 있는 줄만
    if (done.titles.length > 0 || (done.videos > 0 && done.failTitles < plan.n)) {
      let dl = null;
      for (let j = 0; j < 5; j++) {
        await L.unmin(page, R);
        try { dl = await L.downloadRow(page, R, id, KEY); } catch (e) { dl = { err: String(e).slice(0, 200) }; }
        if (dl && (dl.dest || /이미 있는 파일/.test(dl.err || ""))) break;
        L.step(R, "받기 다시 " + run, dl);
        await page.waitForTimeout(8000);
      }
      rec.download = dl;
      save();
      L.step(R, "받음 " + run, dl);
    } else {
      L.step(R, "받을 판 없음 " + run, { fails: done.fails });
    }

    const cz = await L.readCredits(page, R, "끝 " + run);
    Object.assign(rec, { creditsAfter: cz.credits, creditsAfterAt: cz.at });
    save();
    if (done.titles.length === 0 && done.failTitles >= plan.n) stop = "모든 판 실패 " + run;
    if (finish) { await task.finish({ keep: [] }); L.step(R, "작업 공간 닫음"); }
  } catch (e) {
    stop = stop || String(e).slice(0, 300);
    L.step(R, "오류", { e: String(e).slice(0, 400) });
  }
  rec.stop = stop;
  save();
  L.step(R, "끝", { totalSec: L.sec(t0), run, stop });
}
