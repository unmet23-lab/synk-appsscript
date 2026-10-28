// 수요 스캔 · 인스타 릴스 읽기(2026-10-28) — ego(로그인된 인스타)에서 읽기만 한다: 팔로우 · 좋아요 · 댓글 · 메시지 · 계정 확인 단추는 누르지 않는다.
// tools/수요스캔/릴스.js가 globalThis.JOB을 앞에 붙여 ego-browser nodejs 표준 입력으로 돌린다(한글 경로는 -e import가 안 된다).
//   JOB = { 일: '계정', 계정: ['핸들', …], 내림: 8, out } — 계정마다 릴스 탭을 내리며 graphql 응답의 code · play_count · like_count ·
//         comment_count · taken_at · video_duration만 모은다(캡션 · 이름 · 메시지함 응답은 버린다). 재생 수는 릴스 탭 응답에만 있다
//         (docs/현장노트/수집_yt-dlp.md 「인스타 릴스의 재생 수는…」, PULSE 10-25 ig-measure-01.mjs에서 옮김).
//   JOB = { 일: '받기', code, saveAs, out } — 그 릴스 페이지에 실린 JSON에서 가장 큰 video_versions 주소를 찾아 원본 mp4를 받는다(컷 재기용, git 밖).
// 계정 보호 확인(「비정상적인 로그인 시도가 감지되었습니다」) · 로그인 화면 · 로봇 확인이 보이면 그 자리에서 멈추고 「막힘」으로 적는다 — 유호님 손.
const fs = await import("node:fs/promises");
const JOB = globalThis.JOB;
const task = await taskSpace("synk-demand-reels");
const page = task.page("p1");
const sleep = (ms) => page.waitForTimeout(ms);
const 막힘글 = () => page.evaluate(() => {
  const t = document.body ? document.body.innerText.slice(0, 3000) : "";
  if (/\/challenge\//.test(location.pathname) || /비정상적인 로그인 시도|suspicious login|본인입니다|This was me/i.test(t)) return "계정 보호 확인 창(본인입니다 / 내가 아닙니다)";
  if (/\/accounts\/login/.test(location.pathname) || (/로그인|Log in/.test(t) && /가입하기|Sign up/.test(t) && !document.querySelector('a[href*="/reel/"]'))) return "로그인 화면";
  if (/sorry|captcha/i.test(location.href)) return "로봇 확인 화면";
  return null;
}).catch(() => null);

const out = { 일: JOB.일, 시각: new Date().toISOString(), 결과: [] };
if (JOB.일 === "계정") {
  for (const 핸들 of JOB.계정) {
    const rec = { 핸들, 상태: "됨", 릴스: [] };
    try {
      await page.goto("about:blank");
      await page.cdp("Network.enable", {});
      await page.events();
      await page.goto(`https://www.instagram.com/${핸들}/reels/`).catch((e) => { if (!/navigation committed/.test(e.message)) throw e; });
      await page.waitForLoadState().catch(() => {});
      await sleep(4500);
      const 막 = await 막힘글();
      if (막) { rec.상태 = "막힘"; rec.까닭 = 막; out.결과.push(rec); break; } // 계정 전체가 막혔으니 남은 계정도 부르지 않는다
      const seen = new Map();
      await page.mouse.move(700, 500);
      for (let i = 0; i < (JOB.내림 || 8); i++) {
        for (const e of await page.events()) {
          if (e.method !== "Network.responseReceived" || !/\/graphql/.test(e.params?.response?.url || "")) continue;
          try {
            const b = await page.cdp("Network.getResponseBody", { requestId: e.params.requestId });
            const body = b.body || "";
            if (!body.startsWith("{") || !/play_count/.test(body)) continue;
            const walk = (o, d) => {
              if (!o || typeof o !== "object" || d > 30) return;
              if (typeof o.code === "string" && (o.play_count !== undefined || o.ig_play_count !== undefined)) {
                seen.set(o.code, { code: o.code, 재생: o.play_count ?? o.ig_play_count ?? null, 좋아요: o.like_count ?? null, 댓글: o.comment_count ?? null,
                  올린때: o.taken_at ?? null, 길이: o.video_duration ?? null });
              }
              for (const k in o) walk(o[k], d + 1);
            };
            walk(JSON.parse(body), 0);
          } catch {}
        }
        await page.mouse.wheel(0, 1600);
        await sleep(1600);
      }
      rec.릴스 = [...seen.values()];
      if (!rec.릴스.length) { rec.상태 = "빔"; rec.까닭 = "릴스 탭 응답에서 재생 수를 못 찾음"; }
    } catch (err) {
      rec.상태 = "실패";
      rec.까닭 = String(err).slice(0, 200);
    }
    out.결과.push(rec);
    console.log(JSON.stringify({ 핸들, 상태: rec.상태, 릴스: rec.릴스.length, 까닭: rec.까닭 || null }));
    await sleep(9000 + Math.floor(Math.random() * 6000)); // 계정 사이 9~15초
  }
} else if (JOB.일 === "받기") {
  const rec = { code: JOB.code, 상태: "됨" };
  try {
    await page.goto(`https://www.instagram.com/reel/${JOB.code}/`).catch((e) => { if (!/navigation committed/.test(e.message)) throw e; });
    await page.waitForLoadState().catch(() => {});
    await sleep(4500);
    const 막 = await 막힘글();
    if (막) { rec.상태 = "막힘"; rec.까닭 = 막; }
    else {
      const info = await page.evaluate((code) => {
        const hits = [];
        const walk = (o, depth) => {
          if (!o || typeof o !== "object" || depth > 40) return;
          if (o.code === code && (o.video_versions || o.like_count !== undefined)) hits.push(o);
          for (const k in o) walk(o[k], depth + 1);
        };
        for (const s of document.querySelectorAll('script[type="application/json"]')) { try { walk(JSON.parse(s.textContent), 0); } catch {} }
        const o = hits.find((h) => h.video_versions) || hits[0];
        if (!o) return null;
        const vv = (o.video_versions || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0));
        return { 계정: o.user?.username || o.owner?.username || null, 좋아요: o.like_count ?? null, 댓글: o.comment_count ?? null, 올린때: o.taken_at ?? null,
          길이: o.video_duration ?? null, url: vv[0]?.url || null };
      }, JOB.code);
      if (!info?.url) { rec.상태 = "실패"; rec.까닭 = "릴스 JSON에서 영상 주소를 못 찾음"; }
      else {
        const res = await page.fetch(info.url, { saveAs: JOB.saveAs, timeout: 60000 });
        Object.assign(rec, { ...info, url: undefined, 받기: res.status });
        if (!res.ok) { rec.상태 = "실패"; rec.까닭 = `받기 ${res.status}`; }
      }
    }
  } catch (err) { rec.상태 = "실패"; rec.까닭 = String(err).slice(0, 200); }
  out.결과.push(rec);
  console.log(JSON.stringify(rec));
}
await fs.writeFile(JOB.out, JSON.stringify(out, null, 1), "utf8");
