// 아르곤 웹 — Gemini 웹 「카본」 · 사고 수준 하위 메뉴의 가장 높은 단계(11-11 「전부 카본(max)」, 그 전은 「4 Argon」 높음) 새 대화에 파일(사진 · 글 · 영상)을 올리고 지시문을 보내 답을 파일로 받는 ego 페이지 스크립트.
// 부르는 쪽이 tools/아르곤웹.js 페이지글()로 globalThis.JOB과 판단 함수(글정규화 · 대화견주기 · 표시풀까 …, 시험은 그쪽)를 앞에 붙여
// `ego-browser nodejs` 표준 입력으로 돌린다(한글 경로는 -e import가 안 된다):
//   tools/아르곤웹.js(사진 · 지시문 검수 — 공용 차례를 잡고 부른다) · tools/오마주.js 아르곤(원본 영상 첫 분석).
//   JOB = { mode: "보내기" | "읽기" | "확인", files, prompt, out, shots, u, account, space, profile, head, mark, unsentMark, claimed, twins,
//           releaseAfterMs, failShot, sentWaitSec, answerMin, upload?, 표식? }
// 11-08 작업 표식: 부르는 쪽이 prompt 맨 앞에 번호를 붙여 준다(표식). 표시에 그대로 적어 다음 읽기가 같은 번호로 대화를 알아본다 — 지시문 · 그림 수가 같은 다른 편 대화를 집지 않게.
// 11-08 올리기 잠금: 파일을 올리는 보내기면 부르는 쪽이 잠금을 쥐고 upload = { lock, key, deadline }을 준다 — 보내기 누르기 직전에 여기서 풀고,
//   마감까지 거기 못 닿으면 올리기를 그만두고(제 탭을 닫음) 「올리기넘김」으로 끝낸다. 본문은 맨 끝 finally까지 한 덩이다(아래 「본문」).
// 11-07: ego 기본 프로필이 `Profile 2`(「유호 (Chrome)」)로 바뀌고 구글 로그인이 그 프로필에만 남아 공간을 그 프로필로 만들고, 차례가 준 계정(account)과
//   화면의 「Google 계정 … @」 표시가 다르면 아무것도 올리지 않고 멈춘다. 「확인」은 그 계정 확인까지만 하고 탭을 닫는다(보내기 없음).
// 10-28 오마주 영상용 실행기를 10-31 사진 · 지시문 검수 시험판과 합쳐 넓혔다. 읽기 · 보내기만 한다 — 영상 권리 동의 창 · 한도 · 로봇 확인이
// 보이면 누르지 않고 멈춘다. 함정은 docs/현장노트/gemini_사진.md 「영상 올려 분석시키기」 절.
// - 보내기는 빈 탭이나 새 탭에서 한다: 답이 생기는 중인 탭을 다른 주소로 옮기면 대화가 통째로 사라진다(10-27). 받으면 그 탭을 닫는다.
// - 보내기를 누르기 직전에 표시 파일(mark)을 쓴다 — 표시가 남은 작업은 부르는 쪽이 다시 보내지 않고 「읽기」로 받는다(10-29 두 번 보냄).
// - 보냈는지는 대화 주소만으로 보지 않는다 — 보낸 글(user-query)의 지시문 앞머리 · 멈춤 단추로도 본다(10-26~10-31 주소가 늦게 붙음).
// - 글 파일(.txt) 칩에는 「첨부파일 닫기」 단추가 안 잡힌다 — 사진 · 영상만 그 단추로 세고, 글 파일은 칩의 이름(확장자 뺀)으로 본다(10-31).
// - 답을 기다리다 보낸 글이 화면에서 사라지고 새 채팅으로 돌아가면 대화가 안 남은 것으로 보고 일찍 끝낸다(11-07 그림 8장 — 12분을 헛기다림).
// - 읽기(11-08): ① 같은 공간의 탭을 화면만 읽어 찾는다 — 지시문 앞머리만이 아니라 전체 · 그림 수로(같은 틀의 다른 지시문과 섞이지 않게).
//   ② 탭에 없고 보냄 표시가 있으면 빈 탭 하나로 같은 계정 첫 화면의 사이드바 최근 대화(보낸 지 20분 안 8개 · 지나면 15개)를 차례로 열어 찾고,
//   찾으면 그 답을 읽고 표시에 주소를 남긴다. ③ 어디에도 없고 보낸 지 20분이 지났으면 표시를 unsentMark(<답>.안보내짐.json)로 옮긴다 —
//   다음 보내기가 다시 보낸다. 지시문이 같은데 첨부가 다르거나 같은 대화가 여럿이면 「헷갈림」으로 멈춘다(표시는 그대로, 손으로).
const fs = await import("node:fs/promises");
const J = globalThis.JOB;
if (typeof 대화견주기 !== "function" || typeof 표시풀까 !== "function") throw new Error("판단 함수가 없다 — tools/아르곤웹.js 페이지글()로 붙여 부른다");
const mode = J.mode || "보내기";
const files = J.files || (J.video ? [J.video] : []);
const { prompt, out, u } = J;
const shots = J.shots || out.replace(/[\\/][^\\/]*$/, "");
const space = J.space || "synk-argon-web-p7";
const profile = J.profile || "Profile 7"; // 11-11 다시 로그인 뒤 Profile 7(tools/아르곤웹.js 기본프로필) — 공간을 처음 만들 때만 넘긴다 — 같은 이름 공간이 있으면 그 프로필이 이것과 같은지만 본다
const account = J.account || "";
const head = J.head || "아르곤 답";
const mark = J.mark || `${out}.보냄.json`;
const unsentMark = J.unsentMark || mark.replace(/\.보냄\.json$/, ".안보내짐.json");
const failShot = J.failShot || `${shots}/${out.split(/[\\/]/).pop().replace(/\.[^.]+$/, "")}_실패.png`;
const sentWait = (J.sentWaitSec || 180) * 1000;
const answerMs = (J.answerMin || 12) * 60_000;
const releaseAfter = J.releaseAfterMs || 20 * 60_000;
const base = (f) => f.split(/[\\/]/).pop();
const kind = (f) => (/\.(jpe?g|png|webp|gif|heic)$/i.test(f) ? "사진" : /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(f) ? "영상" : "글");
const chipN = files.filter((f) => kind(f) !== "글").length;
const docNames = files.filter((f) => kind(f) === "글").map((f) => base(f).replace(/\.[^.]+$/, ""));
// 보낸 대화가 이 작업인지 견줄 기대 — 지시문 전체 · 사진 수(영상이 있으면 안 셈) · 글 파일 수(칩 아이콘이 그림으로 잡힐 여유)
const 기대 = { 지시문: prompt, 그림: files.some((f) => kind(f) === "영상") ? null : files.filter((f) => kind(f) === "사진").length, 글: docNames.length };
const norm = 글정규화; // 보낸 글은 목록 번호 · 마크다운 기호가 빠져 그려진다(tools/아르곤웹.js와 같은 함수)
const promptHead = norm(prompt).slice(0, 40);
const promptLen = String(prompt || "").replace(/\s+/g, "").length;
const log = (o) => console.log(JSON.stringify({ ...o, t: new Date().toISOString().slice(11, 23) })); // t(UTC) — 같은 브라우저 실행기끼리 언제 겹쳤는지 · 사라짐이 몰린 때를 가린다(11-12 밤)
const now = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
const 경로 = (x) => { try { return new URL(x).pathname; } catch { return ""; } };
let page = null;
let shot = failShot;
const fail = async (why, kind_ = "실패", more = {}) => {
  if (page) await page.screenshot({ path: shot }).catch(() => {});
  log({ step: "fail", kind: kind_, why, ...more });
  const e = new Error(why);
  e.kind = kind_;
  throw e;
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
  return { text: el ? el.innerText : "", busy, uqN: document.querySelectorAll("user-query").length, path: location.pathname };
});
// 보낸 글마다 글 전체와 보이는 그림 수(썸네일 크기만 — 작은 아이콘은 뺀다)
const 보낸글읽기 = (p) => p.evaluate(() => [...document.querySelectorAll("user-query")].map((q) => ({
  글: q.innerText || "",
  그림: [...q.querySelectorAll("img")].filter((im) => { const r = im.getBoundingClientRect(); return (r.width >= 40 && r.height >= 40) || im.naturalWidth >= 80; }).length,
})));
// 읽기: 남은 보냄 표시(보낸 때 · 공간 · 계정 · 대화). 깨졌으면 파일 시각만
let 표시 = null;
const 표시읽기 = async () => {
  let st;
  try { st = await fs.stat(mark); } catch { return null; }
  let j = {};
  try { const x = JSON.parse(await fs.readFile(mark, "utf8")); if (x && typeof x === "object") j = x; } catch { /* 깨진 표시 */ }
  return { ...j, 파일시각: st.mtimeMs };
};
// 표시의 「시각」은 처음 쓴 때(보낸 때) 그대로 둔다 — 읽기가 사이드바로 찾은 주소를 적을 때도
let markAt = null;
const writeMark = (url, more = {}) => {
  markAt = markAt || now();
  // 줄(11-12) — 다음 읽기가 보낸 줄(브라우저 · 계정)로만 선다(b 줄은 둘째 ego)
  return fs.writeFile(mark, JSON.stringify({ 시각: markAt, 공간: space, 계정: u, 계정이름: account || null, ...(J.줄 ? { 줄: J.줄 } : {}), 대화: url || null, 지시문앞: promptHead, ...(J.표식 ? { 표식: J.표식 } : {}), 답: out, ...more }, null, 1) + "\n", "utf8").catch(() => {});
};

// 답 기다리기 — 글이 30초 동안 안 늘고 멈춤 단추가 없으면 끝(200자 아래 짧은 답은 60초). 대화 주소가 늦게 붙으면 붙는 대로 표시에 적는다.
// 보낸 글이 사라지고 새 채팅 주소(대화 번호 없음)로 15초 넘게 있으면 대화가 안 남은 것이다. 빈답마감을 주면 그동안 답 글이 없을 때 끝낸다(사이드바로 연 대화).
// 멈춤 단추가 남아도 200자 넘는 글이 3분 동안 한 글자도 안 바뀌면 끝으로 본다(11-11 — 다 쓴 답을 「중지」 단추가 남아 「늦음」으로 놓친 것이
// 05시 1만 5천 자 한 번, 17시 카본 듣기 다섯 번. 모두 늦음 때 글자 수와 나중에 받은 답 길이가 같았다 — 현장노트 gemini_사진).
// 사라짐진단 — 보내기에서 부를 때(11-13): 사라짐이면 실패 앞에 진단(요청 상태 · 누를 때 올리는 중이던 수 · 화면 알림)을 단계 기록 vanished로 남긴다.
// 표시는 그대로 두고 옛 길대로 20분 뒤 읽기 — 화면이 새 채팅으로 튕겨도 대화가 생겼고 사이드바가 늦게 바뀐 일이 있다(10-19 지유 세트 셋 · GPT 검수 11-13)
const waitAnswer = async (url, 빈답마감 = 0, 사라짐진단 = false) => {
  let last = "", same = 0, 고정 = 0, text = "", busy = true, 사라짐 = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < answerMs) {
    await page.waitForTimeout(5000);
    const r = await answerNow(page).catch(() => ({ text: "", busy: true, uqN: -1, path: "" }));
    text = r.text;
    busy = r.busy;
    same = text && text === last && !busy ? same + 1 : 0;
    고정 = text && text === last ? 고정 + 1 : 0;
    last = text;
    if (busy && 고정 >= 36 && text.length > 200) { log({ step: "answer-still", 초: 고정 * 5, chars: text.length, why: "멈춤 단추는 남았는데 글이 3분째 그대로 — 끝으로 본다" }); return { text, url }; }
    사라짐 = r.uqN === 0 && !busy && !text && /^\/u\/\d+\/app\/?$/.test(r.path) ? 사라짐 + 1 : 0;
    if (사라짐 >= 3 && 사라짐진단) log({ step: "vanished", ...(await 진단읽기()) });
    if (사라짐 >= 3) await fail("보낸 글이 화면에서 사라지고 새 채팅으로 돌아갔다 — 대화가 안 남았을 수 있다. 다시 보내지 말고 보낸 지 20분 뒤 「읽기」(사이드바를 보고 없으면 표시를 푼다)", "사라짐");
    if (!/\/app\/[0-9a-f]+/.test(url)) {
      const nu = await page.url().catch(() => url);
      if (/\/app\/[0-9a-f]+/.test(nu)) { url = nu; await writeMark(url); log({ step: "url", url }); }
    }
    if ((same >= 6 && text.length > 200) || same >= 12) return { text, url };
    if (빈답마감 && !text && !busy && Date.now() - t0 > 빈답마감) await fail(`대화는 있는데 답 글이 ${Math.round(빈답마감 / 1000)}초 동안 안 뜬다 — 다시 보내지 말고 손으로 본다: ${url}`, "없음");
  }
  if (busy || text.length > 200) await fail(`답이 ${J.answerMin || 12}분 안에 안 끝남(${text.length}자) — 다시 보내지 말고 나중에 「읽기」`, "늦음");
  return await fail("답이 안 나옴: " + text.slice(0, 200));
};
const finish = async (text, url) => {
  // 답 대신 Gemini 오류 · 거절 문구(11-13 — 「오류가 발생했습니다. / 다시 시도」를 답으로 써 「받음」으로 셌고 다시 보내지 않았다). 대화는 끝났고 답이 없다 —
  // 답 파일은 쓰지 않고, 표시는 「안 보내짐」처럼 기록 파일에 덧붙여 옮긴다(기록을 먼저 쓰고 표시를 지운다 · 다음 보내기가 다시 보낸다)
  const 오류 = Gemini오류답(text);
  if (오류) {
    const 앞표시 = await 표시읽기();
    try {
      let 앞 = [];
      try { const t = JSON.parse(await fs.readFile(unsentMark, "utf8")); 앞 = Array.isArray(t) ? t : [t]; } catch { /* 처음 옮긴다 */ }
      await fs.writeFile(unsentMark, JSON.stringify([...앞, 풀린기록({ ...(앞표시 || {}), 대화: url || (앞표시 && 앞표시.대화) || null }, null, `Gemini 오류 문구 「${오류}」 — 대화는 끝났고 답이 없다`, now())], null, 1) + "\n", "utf8");
      await fs.unlink(mark).catch((e) => { if (e.code !== "ENOENT") throw e; }); // 없으면 됐다(표시 없는 읽기) — 못 지우면 아래 「없음」(Fable 설계 검토 ⑤)
    } catch (e) { await fail(`Gemini가 답 대신 오류 문구를 냈다(「${오류}」) — 표시를 못 옮김(${e.message}) · 표시는 그대로`, "없음", { url }); }
    log({ step: "gemini-error", url, 글: 오류, record: unsentMark });
    // 받은 판처럼 제 탭을 닫는다 — fail이 그림을 찍은 뒤에. page는 비우지 않는다(사이드바 catch가 page를 쓴다 · 거기서는 다시 닫지 않는다, GPT 검수 GA3)
    const 탭 = page;
    try { await fail(`Gemini가 답 대신 오류 · 거절 문구를 냈다(「${오류}」)`, "Gemini오류", { url, record: unsentMark }); }
    finally { if (탭) await 탭.close().catch(() => {}); }
  }
  const names = files.map(base).join(" · ");
  await fs.writeFile(out, 답파일글(head, now(), url, names, text), "utf8"); // 머리 꼴은 답파일몸과 짝(아르곤웹.js 판단함수)
  await fs.unlink(mark).catch(() => {});
  log({ step: "done", url, chars: text.length, out });
  await page.close().catch(() => {});
};

// 사라짐 진단(11-12 밤 · 11-13 올리기 요청까지) — 사라짐은 보내기의 약 17%(11-11~12 · 카페 와이파이 22% · 집 12%, 사진 1장 + 글 묶음 40%)
// 나는데 화면에 오류 글이 안 남아 까닭을 못 가렸다. 올리기 앞에서 이 탭에 Gemini 보내기 요청(StreamGenerate · batchexecute)과 파일 올리기 요청
// (content-push · /upload/)의 응답 상태 · 걸린 시간, 보내기 요청 응답 앞뒤 200자, 화면 알림(스낵바) 글을 적는 고리를 건다. 올리기 요청은
// 시작 · 끝 수를 따로 세어(__synkUp) 누르기 전에 끝나기를 기다린다 — 11-08 「덜 올라간 채 보내져 사라짐」을 화면 빙글 표시가 못 잡았다
// (11-11~12 보내기 176건 내내 빙글 0). 사라짐이면 진단을 단계 기록에 남긴다(비공개 .tmp/아르곤웹). 탭이 새로 떴으면(고리가 없음) 「새로뜸」
// 새보내기 — 올리기 앞에서 부를 때: 같은 문서를 다음 보내기가 다시 쓰면(빈탭이 사라진 탭을 다시 씀) 앞 보내기의 누른 때 · 셈 · 기록이 남아 있으니 비우고
// 세대(__synkGen)를 올린다 — 앞 세대 요청이 늦게 끝나도 새 셈에 안 든다. 누르기 바로 앞에서는 비우지 않는다(탭이 새로 떴을 때만 건다)
const 진단걸기 = (새보내기 = false) => page.evaluate((새) => {
  if (window.__synkNet) {
    if (새) { window.__synkGen = (window.__synkGen || 0) + 1; window.__synkNet = []; window.__synkToast = []; window.__synkUp = { 시작: 0, 끝: 0 }; window.__synkClick = 0; window.__synkUpAtClick = undefined; }
    return;
  }
  window.__synkGen = 1;
  window.__synkNet = [];
  window.__synkToast = [];
  window.__synkUp = { 시작: 0, 끝: 0 };
  try { performance.setResourceTimingBufferSize(1000); } catch (e) { /* 자원 타이밍 칸 늘리기 — 못 하면 기본 250 */ }
  const 적기 = (rec) => { window.__synkNet.push(rec); if (window.__synkNet.length > 20) window.__synkNet.shift(); };
  const 올리기 = (u) => /content-push|\/upload\//.test(u || "");
  // 누른 뒤 60초가 지난 요청은 적지 않는다 — 긴 답을 기다리는 동안 13초마다 오가는 batchexecute가 누르기 언저리 기록을 밀어냈다(11-13 실물).
  // 보내기 · 답은 geminiweb-pa.clients6.google.com/processSession(XHR)로 오간다 — 11-13 03:33 고친 판 첫 사라짐에서 자원 타이밍으로 찾았다(64초 · 200).
  // 그 응답 앞뒤 200자에 구글 쪽 까닭이 있을 것이라 함께 적는다(ProcessFile은 올린 파일 처리)
  const 볼것 = (u) => (/StreamGenerate|batchexecute|processSession|ProcessFile/.test(u || "") || 올리기(u)) && !(window.__synkClick && Date.now() - window.__synkClick > 60_000);
  const 이름 = (u) => (올리기(u) ? "upload" : String(u).replace(/\?.*$/, "").split("/").pop().slice(0, 40));
  // 같은 XHR 객체를 다시 쓰면(open → send를 되풀이) 요청마다 건 듣기가 쌓여 끝 수가 더 늘고 앞 기록이 덮였다(GPT 검수 11-13) — 객체마다 듣기는
  // 한 번만 걸고, 기록은 지금 요청 것(__synkRec)만 닫는다. 진행 중에 open을 다시 하면 앞 요청은 이벤트 없이 끊기니 그때 닫는다(reopen)
  const 닫기 = (x, 까닭) => {
    const rec = x.__synkRec;
    if (!rec || rec.닫힘) return null;
    rec.닫힘 = true;
    if (x.__synkUpNow && rec.gen === window.__synkGen) window.__synkUp.끝 += 1;
    if (까닭 && !rec.err) rec.err = 까닭;
    return rec;
  };
  const O = XMLHttpRequest.prototype.open, S = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { 닫기(this, "reopen"); this.__synkU = String(u || ""); return O.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (볼것(this.__synkU)) {
      const up = 올리기(this.__synkU);
      const rec = { u: 이름(this.__synkU), t0: Date.now(), gen: window.__synkGen };
      적기(rec);
      if (up) window.__synkUp.시작 += 1;
      this.__synkRec = rec;
      this.__synkUpNow = up;
      if (!this.__synkHooked) {
        this.__synkHooked = true;
        this.addEventListener("loadend", () => {
          const r = 닫기(this);
          if (!r) return;
          r.status = this.status; r.ms = Date.now() - r.t0;
          if (this.__synkUpNow) return; // 올리기 응답 본문(파일 자리)은 안 적는다
          try { const tx = String(this.responseText || ""); r.len = tx.length; r.head = tx.slice(0, 200); r.tail = tx.slice(-200); } catch (e) { r.len = -1; }
        });
        for (const k of ["error", "abort", "timeout"]) this.addEventListener(k, () => { const r = this.__synkRec; if (r && !r.닫힘) r.err = k; });
      }
    } else this.__synkRec = null;
    return S.apply(this, arguments);
  };
  const F = window.fetch;
  window.fetch = async function (input, init) {
    const u = String((input && input.url) || input || "");
    if (!볼것(u)) return F.apply(this, arguments);
    const up = 올리기(u);
    const rec = { u: 이름(u), t0: Date.now(), via: "fetch", gen: window.__synkGen };
    적기(rec);
    if (up) window.__synkUp.시작 += 1;
    try { const r = await F.apply(this, arguments); rec.status = r.status; rec.ms = Date.now() - rec.t0; return r; } catch (e) { rec.err = String((e && e.message) || e).slice(0, 100); throw e; } finally { if (up && rec.gen === window.__synkGen) window.__synkUp.끝 += 1; }
  };
  new MutationObserver(() => {
    for (const el of document.querySelectorAll("mat-snack-bar-container, simple-snack-bar, .mdc-snackbar__label, [role=alert]")) {
      const tx = String(el.innerText || "").trim().slice(0, 200);
      if (tx && !window.__synkToast.includes(tx)) window.__synkToast.push(tx);
    }
  }).observe(document.body, { childList: true, subtree: true });
}, 새보내기).catch(() => {});
// 누르기 바로 앞 — 누른 때와 그때 아직 올리는 중이던 올리기 요청 수를 적는다(진단읽기가 요청마다 누르기 앞뒤를 가른다). 고리가 없으면 -1
const 누름표시 = () => page.evaluate(() => {
  window.__synkClick = Date.now();
  window.__synkUpAtClick = window.__synkUp ? window.__synkUp.시작 - window.__synkUp.끝 : -1;
  return window.__synkUpAtClick;
}).catch(() => -1);
// 자원 — 11-13 실물 시험에서 보내기 요청이 고리에도, 자원 타이밍의 「StreamGenerate」 이름으로도 안 잡혔다(이름이 바뀐 듯). 브라우저 자원 타이밍은
// 어떤 길로 나간 요청이든 남기니(주소 · 시작 · 걸린 시간 · 응답 상태 · 받은 크기), 이름이 맞는 것과 함께 누르기 앞뒤 60초 안의 요청 꼴 자원
// (fetch · XHR · beacon · other — 그림 · 글꼴 · 스크립트는 뺌)은 이름과 상관없이 담는다. 구글 밖 주소는 호스트를 붙인다
const 진단읽기 = () => page.evaluate(() => {
  const 누름 = window.__synkClick || 0;
  const 볼것 = /StreamGenerate|batchexecute|processSession|ProcessFile|content-push|\/upload\//;
  const 요청꼴 = (e) => /^(fetch|xmlhttprequest|beacon|other)$/.test(e.initiatorType || "");
  const 떨어짐 = (e) => performance.timeOrigin + e.startTime - 누름;
  const 가까이 = (e) => 누름 && 떨어짐(e) > -25_000 && 떨어짐(e) < 60_000; // 올리기(누르기 20초쯤 전) ~ 보내기 · 답 첫머리, 페이지 열기(40초쯤 전) 잡음은 뺀다
  const 이름 = (u) => {
    if (/content-push|\/upload\//.test(u)) return "upload";
    const 끝 = String(u).replace(/[?#].*$/, "").split("/").pop().slice(0, 40);
    try { const h = new URL(u).host; return h === location.host ? 끝 : `${h}/${끝}`.slice(0, 60); } catch (e) { return 끝; }
  };
  let 자원 = [];
  try {
    // 누른 때를 알면 그 창(25초 전 ~ 60초 뒤) 안에서 누른 때에 가까운 30개를 시간 순으로(11-13 실물 — 긴 답을 기다리는 13초마다의 batchexecute,
    // 페이지를 열 때 몰린 cspreport · fine-allowlist가 칸을 채워 누르기 언저리가 밀렸다), 모르면 이름이 맞는 마지막 30개
    const 모두 = performance.getEntriesByType("resource");
    const 고름 = 누름
      ? 모두.filter((e) => (볼것.test(e.name) || 요청꼴(e)) && 가까이(e)).sort((a, b) => Math.abs(떨어짐(a)) - Math.abs(떨어짐(b))).slice(0, 30).sort((a, b) => a.startTime - b.startTime)
      : 모두.filter((e) => 볼것.test(e.name)).slice(-30);
    자원 = 고름.map((e) => ({
      u: 이름(e.name),
      ...(누름 ? { 누른뒤시작: Math.round(performance.timeOrigin + e.startTime - 누름) } : {}),
      ms: Math.round(e.duration), status: e.responseStatus ?? null, 받은: e.transferSize ?? null, 종류: e.initiatorType,
    }));
  } catch (e) { 자원 = [{ 못읽음: String((e && e.message) || e).slice(0, 80) }]; }
  return {
    망: (window.__synkNet || []).map((x) => { const { t0, gen, ...rest } = x; return { ...rest, 지남: Date.now() - t0, ...(누름 ? { 누른뒤시작: t0 - 누름 } : {}) }; }),
    자원, 알림: window.__synkToast || [], 새로뜸: !window.__synkNet,
    올리는중누를때: window.__synkUpAtClick === undefined ? null : window.__synkUpAtClick, 올리기: window.__synkUp || null,
  };
}).catch((e) => ({ 진단못함: String((e && e.message) || e).slice(0, 100) }));
const 받은진단 = (d) => ({ 망: (d.망 || []).map(({ head, tail, ...x }) => x), 올리는중누를때: d.올리는중누를때 ?? null, 자원: d.자원 || [] });

// 올리기 잠금(11-08) — 잠금은 부르는 쪽(tools/아르곤웹.js)이 쥐고, 푸는 것은 여기서 한다: 보내기 누르기 직전(표시를 쓴 뒤) · 그 앞에서 끝날 때
// (맨 끝 finally) · 마감. 잠금 폴더의 내 열쇠 파일(<key>.key)을 지운 때만 폴더를 지운다 — 지우기는 한 사람만 되고, 남이 넘겨받은 잠금에는 내 열쇠
// 파일이 없다. 실행기(ego-browser nodejs)를 꺼도 ego 안 스크립트는 살아 있어(현장노트 gemini_사진) 마감은 여기서 지킨다 — 마감이 오면 「올리기넘김」을
// 찍고 풀고 제 탭을 닫아 하던 조작을 끊고, 늦게 돌아온 ego 호출도 올리기 · 파일 고르기 · 누르기 앞의 마감확인에서 멈춘다(11-08 GPT 검수 — 공간 열기가
// 마감 뒤에 돌아오자 남이 쥔 잠금 아래서 파일을 올렸다). 마감 뒤에는 표시를 쓰지도 누르지도 않는다(같은 질문을 두 번 보내지 않는 표시 규칙과 그대로
// 맞물린다 — 표시가 없으면 다시 보내도 된다).
const up = J.upload && J.upload.lock && J.upload.key ? J.upload : null;
const upDeadline = up ? Number(up.deadline) || 0 : 0;
let 누름 = false, 넘김 = false, 감시 = null;
const 올리기풀기 = async () => {
  if (!up) return;
  for (let i = 0; ; i += 1) {
    try { await fs.unlink(`${up.lock}/${up.key}.key`); break; } catch (e) {
      if (e.code === "ENOENT" || i >= 3 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) return; // 내 열쇠 파일이 없다 — 이미 풀렸거나 남이 넘겨받은 잠금
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  // 내 열쇠를 지운 폴더는 아무도 못 잡는다 — 경로째 지우지 않고 고유한 이름으로 옮긴 뒤 지운다(지우는 사이 같은 경로에 새로 잡힌 잠금을 안 건드리게).
  // 못 옮기면 그대로 둔다 — 열쇠 없이 2분 묵은 폴더는 기다리는 쪽이 치운다
  const 무덤 = `${up.lock}.풀림-${up.key}-${Date.now()}`;
  for (let i = 0; ; i += 1) {
    try { await fs.rename(up.lock, 무덤); break; } catch (e) {
      if (e.code === "ENOENT" || i >= 4 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await fs.rm(무덤, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
};
// 마감을 넘겼으면(감시가 울렸거나) 잠금을 풀고 표시 없이 그만둔다 — 제 탭은 맨 끝 finally가 닫는다
const 마감확인 = async () => {
  if (!upDeadline || (!넘김 && Date.now() <= upDeadline)) return;
  넘김 = true;
  await 올리기풀기();
  await fail("올리기 마감을 넘겨 그만둔다(표시 안 씀) — 다시 돌려도 된다", "올리기넘김");
};
if (upDeadline) {
  감시 = setTimeout(() => {
    if (누름) return;
    넘김 = true;
    log({ step: "fail", kind: "올리기넘김", why: `올리기가 마감(${new Date(upDeadline).toLocaleTimeString("sv-SE", { timeZone: "Asia/Seoul" })})까지 보내기 앞에 못 닿음 — 그만두고 잠금을 푼다(보내지 않음 · 다시 돌려도 된다)` });
    올리기풀기().finally(() => { if (page) page.close().catch(() => {}); });
  }, Math.max(0, upDeadline - Date.now()));
}

// 본문 — 어느 길로 끝나든(받음 · 실패 · 예외) 맨 끝 finally가 마감 감시를 끄고 올리기 잠금을 푼다. 기존 줄을 그대로 두려고 들여 쓰지 않았다.
try {
// profileId는 공간을 처음 만들 때만 받는다 — 이미 있는 이름에 넘기면 ego가 「profileId only applies when creating」으로 막는다(11-07, 두 번째 실행부터 전부 실패).
// 있으면 그 공간의 프로필이 맞는지만 보고 이름으로 다시 연다.
const oldSpace = (await listTaskSpaces()).find((s) => s.name === space);
if (oldSpace && oldSpace.profileId && oldSpace.profileId !== profile) await fail(`공간 「${space}」이 ${oldSpace.profileId}에 있다(${profile} 아님) — 다른 이름으로 새로 만든다`, "멈춤");
const task = oldSpace ? await taskSpace(space) : await taskSpace(space, { profileId: profile });
await 마감확인(); // 공간 열기가 마감 뒤에 돌아왔으면 여기서 멈춘다(잠금 없는 읽기 · 확인은 그냥 지나간다)

// 빈 탭만 다시 쓴다 — 실패 뒤 Gemini 새 채팅 탭도 남는다. about:blank만 찾으면 8개 한도에 걸려 읽기조차 못 한다.
// 같은 계정의 새 채팅에서 대화 · 초안 · 첨부 · 보내기/중지 단추 · 보이는 진행 표시가 모두 없을 때만 재사용한다.
// task.pages()는 이 공간의 관리 탭만 돌려준다. 대화나 진행 중 업로드가 남은 탭은 그대로 둔다.
const 빈탭 = async () => {
  for (const p of await task.pages()) {
    const pu = await p.url().catch(() => "x");
    if (pu === "about:blank" || /^chrome:\/\/new-?tab/.test(pu)) return p;
    if (pu !== `https://gemini.google.com/u/${u}/app` && pu !== `https://gemini.google.com/u/${u}/app/`) continue;
    const 비었음 = await p.evaluate(() => {
      const ed = document.querySelector('[aria-label="Gemini 프롬프트 입력"]');
      if (!ed || document.querySelectorAll('user-query, model-response').length) return false;
      if ([...document.querySelectorAll('[contenteditable="true"], textarea')].some(e => String(e.innerText || e.value || '').trim())) return false;
      if ([...document.querySelectorAll('button')].some(b => /첨부파일 닫기|메시지 보내기|대답 생성 중지|생성 중지|Stop|Send message/i.test(b.getAttribute('aria-label') || ''))) return false;
      return ![...document.querySelectorAll('[role="progressbar"], mat-spinner, mat-progress-spinner')].some(e => {
        const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0;
      });
    }).catch(() => false);
    if (비었음) { log({ step: "reuse-empty", url: pu, label: p.label }); return p; }
  }
  return await task.newPage();
};

// 새 계정 첫 화면의 「정확한 위치를 사용하시겠습니까?」 창이 클릭을 막는다(11-12 unmet22 — 「닫기 / 정확한 위치 사용」) — 위치를 주지 않는 쪽
// (닫기)으로만 닫는다. 그 창이 없으면 아무것도 누르지 않는다. 닫았으면 true
const 위치창닫기 = async () => {
  const 있음 = await page.evaluate(() => {
    document.querySelectorAll('[data-synk="loc-close"]').forEach((e) => e.removeAttribute("data-synk"));
    for (const d of document.querySelectorAll('[role=dialog], [role=alertdialog], mat-dialog-container, .cdk-overlay-pane')) {
      const r = d.getBoundingClientRect();
      if (!r.width || !r.height || !/정확한 위치/.test(d.innerText || "")) continue;
      const b = [...d.querySelectorAll("button")].find((x) => /^(닫기|Close|아니요|나중에)$/.test((x.innerText || x.getAttribute("aria-label") || "").trim()));
      if (b) { b.setAttribute("data-synk", "loc-close"); return true; }
    }
    return false;
  }).catch(() => false);
  if (!있음) return false;
  await page.click('loc=css:[data-synk="loc-close"]', { timeout: 10000, label: "close location prompt" }).catch(() => {});
  await page.waitForTimeout(800);
  log({ step: "dismiss", what: "정확한 위치 창 — 닫기(위치를 주지 않음)" });
  return true;
};

// 같은 계정 첫 화면을 열고 sorry · 한도 · 계정을 본다(보내기 · 확인 · 사이드바 찾기). 한도 문구는 보낼 때만 멈춘다 — 읽기는 모델 몫이 없어도 된다.
const 첫화면 = async () => {
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
  // sorry 화면에서는 입력창이 영영 안 뜬다 — 바퀴마다 주소부터 본다(11-07 확인 차례가 sorry 화면에서 이 고리를 다 돌며 a 줄을 26분 쥠)
  for (let i = 0; i < 45; i++) { await page.waitForTimeout(2000); if (/sorry/.test(await page.url().catch(() => ""))) break; s = await state().catch(() => ({ mode: "", len: -1, limit: false })); if (s.mode || s.len >= 0) break; }
  if (/sorry/.test(await page.url())) await fail("로봇 확인 화면(sorry) — 멈춤, 유호님 손", "멈춤");
  if (s.limit && mode !== "읽기") await fail("사용량 한도 문구가 보임", "멈춤");
  await 위치창닫기();
  // 계정 확인 — 로그인이 바뀌면 /u/ 순번도 바뀐다(11-07 ego 프로필 교체). 계정 표시는 입력창보다 늦게 뜰 수 있어 10초까지 본다.
  const whoNow = () => page.evaluate(() => [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter((t) => /@/.test(t)).join(" | ")).catch(() => "");
  let who = await whoNow();
  for (let i = 0; i < 5 && !/@/.test(who); i++) { await page.waitForTimeout(2000); who = await whoNow(); }
  log({ step: "account", u, account: account || null, profile, who: who.replace(/\s+/g, " ").slice(0, 120) });
  if (account && !who.includes(`${account}@`)) await fail(`계정이 ${account}가 아님(/u/${u} · 공간 ${space}): ${who.replace(/\s+/g, " ").slice(0, 120) || "계정 표시 없음 — 로그아웃 화면일 수 있다"}`, "멈춤");
  return s;
};

// 사이드바의 대화 링크 — 호스트가 gemini.google.com이고 경로가 정확히 /u/<u>/app/<번호>인 것만, 위(최근)부터 깊이까지.
// 글자에 대화 번호가 들어 있기만 보면 계정 메뉴의 「로그아웃 옵션」 링크(continue에 지금 주소)를 집는다(10-25). 덜 떴으면 목록을 내려 더 불러온다.
const 사이드바링크 = async (깊이) => {
  const 읽어 = () => page.evaluate((n) => {
    const re = new RegExp(`^/u/${n}/app/([0-9a-f]+)$`);
    const 본 = new Set(), 목록 = [];
    for (const a of document.querySelectorAll("a[href]")) {
      let t;
      try { t = new URL(a.getAttribute("href"), location.href); } catch { continue; }
      const m = t.host === "gemini.google.com" ? re.exec(t.pathname) : null;
      if (!m || 본.has(m[1])) continue;
      본.add(m[1]);
      목록.push({ id: m[1], path: t.pathname, title: (a.innerText || a.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 60) });
    }
    return 목록;
  }, u).catch(() => []);
  let links = [];
  for (let i = 0; i < 20; i++) { links = await 읽어(); if (links.length >= 깊이 || (links.length && i >= 3)) break; await page.waitForTimeout(1500); }
  for (let k = 0; k < 3 && links.length && links.length < 깊이; k++) {
    const 내림 = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href*="/app/"]')].pop();
      let el = a ? a.parentElement : null;
      while (el && !(el.scrollHeight > el.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
      if (!el) return false;
      el.scrollTop += 1500;
      return true;
    }).catch(() => false);
    if (!내림) break;
    await page.waitForTimeout(1800);
    links = await 읽어();
  }
  return links.slice(0, 깊이);
};

// 대화 하나 열기 — 사이드바 링크를 실제로 누르고(SPA 이동 — 주소로 바로 열면 빈 화면일 때가 있다, 10-19), 안 가면 주소로 연다.
// 앞 대화의 글이 잠깐 남을 수 있어 주소가 바뀐 뒤 글이 바뀌기를(같으면 6초까지) 기다리고, 1.5초 사이 두 번 읽어 같을 때 쓴다.
let 앞글 = "";
const 글표 = (qs) => `${norm((qs[0] && qs[0].글) || "").slice(0, 300)}#${qs.length}#${qs.map((q) => q.그림).join(",")}`;
const 대화열기 = async (c) => {
  const 표 = await page.evaluate((p) => {
    document.querySelectorAll('[data-synk="convo"]').forEach((e) => e.removeAttribute("data-synk"));
    const a = [...document.querySelectorAll("a[href]")].find((x) => {
      try { const t = new URL(x.getAttribute("href"), location.href); const r = x.getBoundingClientRect(); return t.host === "gemini.google.com" && t.pathname === p && r.width > 0 && r.height > 0; } catch { return false; }
    });
    if (a) a.setAttribute("data-synk", "convo");
    return !!a;
  }, c.path).catch(() => false);
  let 갔음 = false;
  if (표) {
    await page.click('loc=css:[data-synk="convo"]', { timeout: 15000, label: "open sidebar conversation" }).catch(() => {});
    for (let k = 0; k < 7 && !갔음; k++) {
      await page.waitForTimeout(1500);
      const pu = await page.url().catch(() => "");
      if (/sorry/.test(pu)) return { sorry: true, url: pu }; // 로봇 확인이면 주소로 다시 열지 않는다
      갔음 = 경로(pu) === c.path;
    }
  }
  if (!갔음) await page.goto(`https://gemini.google.com${c.path}`, { timeout: 60000, waitUntil: "domcontentloaded" }).catch((e) => { if (!/navigation committed|timed? ?out|ERR_ABORTED/i.test(e.message)) throw e; });
  const t0 = Date.now();
  let 지난 = null;
  while (Date.now() - t0 < 25000) {
    await page.waitForTimeout(1500);
    const pu = await page.url().catch(() => "");
    if (/sorry/.test(pu)) return { sorry: true, url: pu };
    const p = 경로(pu);
    if (p !== c.path) { if (Date.now() - t0 > 6000 && /^\/u\/\d+\/app\/?$/.test(p)) return { gone: true, url: pu }; continue; }
    const qs = await 보낸글읽기(page).catch(() => []);
    if (!qs.length) continue;
    const 지금표 = 글표(qs);
    if (지금표 === 앞글 && Date.now() - t0 < 6000) continue; // 앞 대화 글이 아직 남았을 수 있다
    if (지금표 === 지난) { 앞글 = 지금표; return { url: pu, qs }; }
    지난 = 지금표;
  }
  return { blank: true, url: await page.url().catch(() => "") };
};

// 탭에서 못 찾은 보냄 표시 — 빈 탭 하나로 같은 계정 첫 화면의 사이드바 최근 대화를 차례로 열어 지시문 전체 · 그림 수가 맞는 대화를 찾는다.
// 이미 열린 탭은 건드리지 않는다(답이 생기는 중인 탭을 옮기면 대화가 사라진다, 10-27). 표시에 적힌 대화가 있으면 그것부터 연다.
const 사이드바에서읽기 = async (markId, claimed) => {
  if (!표시) await fail(`작업 공간 「${space}」의 탭에 이 지시문 대화가 없고 보냄 표시도 없다 — 보낸 적이 없으면 보내기로(사이드바는 보냄 표시가 있을 때만 본다)`, "없음");
  if (표시.공간 && 표시.공간 !== space) await fail(`보낸 공간은 「${표시.공간}」(지금 「${space}」) — 그 공간으로 읽는다(사이드바 찾기 · 표시 풀기는 보낸 공간에서만)`, "없음");
  const 같은 = 표시계정(표시, u, account);
  if (!같은.같음) await fail(`${같은.까닭} — 그 계정 줄로 읽는다(사이드바 찾기 · 표시 풀기 안 함)`, "없음");
  // 20분 안 대화는 위쪽에 있다 — 그때는 덜 연다(연달아 열면 로봇 확인이 뜬다, 10-19 · 10-24). 사용자 지정 상한 15
  const 깊이 = Date.now() - 보낸때(표시) >= releaseAfter ? 15 : 8;
  shot = failShot.replace(/(\.png)?$/i, "_읽기.png"); // 보낼 때 찍은 실패 그림은 남긴다
  page = await 빈탭();
  try {
    await 첫화면();
    const links = await 사이드바링크(깊이);
    const 목록에 = new Set(links.map((l) => l.id));
    const 후보 = [];
    if (markId) 후보.push({ id: markId, path: `/u/${u}/app/${markId}`, title: "(표시에 적힌 대화)" });
    for (const l of links) if (!후보.some((c) => c.id === l.id) && !claimed.has(l.id)) 후보.push(l);
    log({ step: "sidebar-list", links: links.length, 볼것: Math.min(후보.length, 깊이), 표시주소: markId || null });
    const 본 = { 계정확인: !!account, 사이드바: links.length, 열어봄: 0, 빈화면: 0, 헷갈림: 0 };
    let 찾음 = null;
    const 같음 = [], 비슷함 = [];
    for (let i = 0; i < 후보.length && i < 깊이; i++) {
      if (찾음 && (찾음.표시 || i > 찾음.i + 2)) break; // 찾은 뒤 둘 더 본다 — 같은 지시문을 따로 보낸 대화가 붙어 있는지(표시에 적힌 대화면 그대로)
      const c = 후보[i];
      if (i) await page.waitForTimeout(2000);
      const 열림 = await 대화열기(c);
      본.열어봄 += 1;
      if (열림.sorry) await fail("로봇 확인 화면(sorry) — 멈춤, 유호님 손", "멈춤");
      const 판정 = 열림.gone ? "없는 대화" : 열림.blank ? "빈 화면" : 대화견주기(열림.qs, 기대);
      log({ step: "sidebar", i: i + 1, url: 열림.url, title: c.title, 판정 });
      if (열림.blank || (열림.gone && 목록에.has(c.id))) 본.빈화면 += 1; // 목록에 있는데 안 열린 대화는 이 작업일 수 있다 — 표시를 풀지 않는다
      if (판정 === "맞음") { if (!찾음) 찾음 = { i, c, url: 열림.url, 표시: c.id === markId }; else 같음.push(열림.url); }
      else if (판정 === "첨부다름" || 판정 === "잘림") 비슷함.push(`${열림.url}(${판정})`);
    }
    if (찾음) {
      if (같음.length) await fail(`이 지시문 · 첨부와 같은 대화가 ${같음.length + 1}개 — 어느 것이 이 작업인지 못 가린다: ${[찾음.url, ...같음].join(" · ")}`, "헷갈림", { urls: [찾음.url, ...같음] });
      if (J.twins && !찾음.표시) await fail(`지시문 · 그림 수가 같은 작업이 이 묶음에 ${J.twins}개 더 있어 사이드바로는 가리지 못한다: ${찾음.url}`, "헷갈림", { urls: [찾음.url] });
      if (경로(await page.url().catch(() => "")) !== 찾음.c.path) {
        const 다시 = await 대화열기(찾음.c);
        if (다시.sorry) await fail("로봇 확인 화면(sorry) — 멈춤, 유호님 손", "멈춤");
        if (!다시.qs || 대화견주기(다시.qs, 기대) !== "맞음") await fail(`찾은 대화를 다시 열어 보니 맞지 않는다 — 손으로 본다: ${찾음.url}`, "헷갈림", { urls: [찾음.url] });
      }
      const via = 찾음.표시 ? "표시 주소" : "사이드바";
      await writeMark(찾음.url, { 찾음: via });
      log({ step: "found", via, url: 찾음.url, 차례: 찾음.i + 1 });
      const r = await waitAnswer(찾음.url, 120_000);
      await finish(r.text, r.url);
      return;
    }
    본.헷갈림 = 비슷함.length;
    if (비슷함.length) await fail(`지시문은 같은데 첨부가 다르거나 글이 덜 보이는 대화 ${비슷함.length}개 — 다시 보내지 말고 손으로 본다: ${비슷함.join(" · ")}`, "헷갈림", { urls: 비슷함 });
    const 판단 = 표시풀까(표시, Date.now(), 본, releaseAfter);
    if (!판단.풀기) await fail(`탭 · 사이드바 최근 대화 ${본.열어봄}개에 이 지시문 대화가 없다 · ${판단.까닭} — 표시는 둔다`, "없음");
    // 「안 보내짐」 — 표시를 지우지 않고 옆 기록 파일에 덧붙여 옮긴다(기록을 먼저 쓰고 표시를 지운다)
    try {
      let 앞 = [];
      try { const t = JSON.parse(await fs.readFile(unsentMark, "utf8")); 앞 = Array.isArray(t) ? t : [t]; } catch { /* 처음 푼다 */ }
      await fs.writeFile(unsentMark, JSON.stringify([...앞, 풀린기록(표시, 본, 판단.까닭, now())], null, 1) + "\n", "utf8");
      await fs.unlink(mark);
    } catch (e) { await fail(`표시를 못 옮김(${e.message}) — 표시는 그대로`, "없음"); }
    log({ step: "unsent", record: unsentMark });
    await fail(`${판단.까닭} — 안 보내진 것으로 본다. 표시를 ${unsentMark}로 옮겼다(다음 보내기가 다시 보낸다)`, "안보내짐", { record: unsentMark });
  } catch (e) {
    if (e.kind !== "멈춤" && e.kind !== "Gemini오류") await page.close().catch(() => {}); // 로봇 확인 화면은 유호님이 누르시게 둔다 · Gemini 오류 탭은 finish가 닫았다
    throw e;
  }
};

if (mode === "읽기") {
  // ① 보낸 대화가 남은 탭을 찾아 화면만 읽는다 — 주소를 옮기거나 새로 고치지 않는다(10-27 대화가 사라짐).
  // 지시문 전체 · 그림 수가 맞는 탭만, 이 묶음의 다른 작업이 쓴 대화(claimed)는 빼고. 같은 지시문 탭이 여럿이면 표시의 대화 주소로 고르고, 못 고르면 헷갈림.
  표시 = await 표시읽기();
  if (표시 && 표시.시각) markAt = 표시.시각;
  const markId = 대화아이디(표시 && 표시.대화);
  const claimed = new Set(J.claimed || []);
  const 탭들 = [];
  for (const p of (await task.pages()).slice().reverse()) {
    const qs = await 보낸글읽기(p).catch(() => []);
    if (!qs.length) continue;
    const pu = await p.url().catch(() => "");
    탭들.push({ p, url: pu, id: 대화아이디(pu), 판정: 대화견주기(qs, 기대) });
  }
  const 맞는탭 = 탭들.filter((t) => t.판정 === "맞음" && !(t.id && claimed.has(t.id)));
  // 보냄 표시가 없으면 작업 번호(표식)도 없어 지시문 · 그림 수로만 견준다 — 편마다 같은 지시문을 보내는 미학맹검의 남의 탭을 제 답으로 집지 않게,
  // 맞는 탭이 하나뿐이어도 표시가 있을 때만 고른다(11-13 Fable 설계 검토 ② · 11-08 대사바뀜과 같은 꼴)
  const 고른탭 = 맞는탭.find((t) => markId && t.id === markId) || (표시 && 맞는탭.length === 1 && !J.twins ? 맞는탭[0] : null);
  if (!고른탭 && 맞는탭.length) await fail(`작업 공간 「${space}」에 이 지시문 · 첨부와 같은 대화 탭이 ${맞는탭.length}개${J.twins ? ` · 같은 지시문 작업이 ${J.twins}개 더 있다` : ""}${표시 ? "" : " · 이 작업의 보냄 표시가 없다(남의 대화일 수 있다)"} — 어느 것이 이 작업인지 못 가린다: ${맞는탭.map((t) => t.url).join(" · ")}`, "헷갈림", { urls: 맞는탭.map((t) => t.url) });
  if (고른탭) {
    page = 고른탭.p;
    await page.info();
    const url = await page.url();
    log({ step: "tab", url });
    const r = await waitAnswer(url);
    await finish(r.text, r.url);
  } else {
    // ② 탭에 없으면 사이드바에서(보냄 표시가 있을 때만) — 찾으면 읽고, 없고 20분 지났으면 표시를 「안 보내짐」으로
    await 사이드바에서읽기(markId, claimed);
  }
} else {
  page = await 빈탭();
  await 마감확인();
  let s = await 첫화면();
  await 마감확인();
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
  // 모드 메뉴 단추 누르기 — 새 계정은 단추가 늦게 그려지거나 안내 창이 가려 첫 누르기가 15초 넘게 안 먹는다(11-12 synk.yuh 첫 확인, 두 번째엔 통과).
  // 위치 창을 닫고 Escape · 도구 판 다시 열기 뒤 두 번까지 다시 누른다
  const 모드단추누르기 = async () => {
    for (let i = 0; ; i += 1) {
      try { await page.click('loc=css:button[aria-label^="모드 선택 도구 열기"]', { timeout: 15000, label: "open mode menu" }); return; } catch (e) {
        if (i >= 2) throw e;
        log({ step: "retry", what: "모드 단추", why: String(e.message || e).slice(0, 160) });
        await 위치창닫기();
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(3000);
        await openTools();
      }
    }
  };
  // 모드 고르기(11-11 유호님 「제미나이 관련한 검수나 이미지 생성 · 딥리서치 전부 카본(max)」) — 모델 「카본」 + 사고 수준 하위 메뉴의 가장 높은 단계.
  // 단계 이름은 판마다 바뀌어 와서(낮음 · 보통 · 높음 ↔ 최저가 · 보통 · 최고가) 하위 메뉴를 열어 읽은 항목에 순위를 매겨 가장 높은 것을 누르고,
  // 모드 칸에 「카본」과 그 단계 이름이 있는지로 대조한다(카본인가 · 수준순위 · 가장높은수준 · 카본모드맞나 — tools/아르곤웹.js 판단 함수, 시험은 그쪽).
  // 「확인」도 보내기 없이 여기까지 해 본다 — 로그인 · 메뉴가 바뀐 뒤 고를 수 있는지 먼저 가린다.
  let 고른수준 = null; // { 글, 순위, 차례 } — 이번 탭에서 하위 메뉴를 열어 읽은 가장 높은 단계
  const OK = (m) => 카본모드맞나(m, 고른수준 && 고른수준.글);
  const 단계글들 = () => page.evaluate(() => [...document.querySelectorAll("gem-menu-item, [role=menuitem], [role=menuitemradio]")]
    .filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.innerText || "").trim()).filter(Boolean));
  const 단계표시 = (글) => page.evaluate(({ 글 }) => {
    document.querySelectorAll('[data-synk="lvl"]').forEach((e) => e.removeAttribute("data-synk"));
    const el = [...document.querySelectorAll("gem-menu-item, [role=menuitem], [role=menuitemradio]")]
      .find((e) => e.getBoundingClientRect().width > 0 && (e.innerText || "").trim().split(/\r?\n/)[0].trim() === 글);
    if (el) el.setAttribute("data-synk", "lvl");
    return !!el;
  }, { 글 });
  const chooseCarbon = async () => {
    for (let i = 0; i < 3; i++) {
      await openTools();
      if (OK(s.mode)) return;
      await 모드단추누르기();
      await page.waitForTimeout(1300);
      // 모델 항목 글은 「Most complex work 4 카본」처럼 설명이 앞에 온다(11-11 실물) — 이름은 맨 앞이 아니라 낱말 경계로 찾는다
      if (!카본인가(s.mode) && (await mark_("(?:^|\\s)(?:\\d+(?:\\.\\d+)?\\s*)?(?:Carbon|카본)(?:\\s|$)", "carbon"))) {
        await page.click('loc=css:[data-synk="carbon"]', { timeout: 15000, label: "choose Carbon" });
        await page.waitForTimeout(1300);
        await openTools();
        await 모드단추누르기();
        await page.waitForTimeout(1300);
      }
      if (await mark_("^사고 수준", "think")) {
        await page.click('loc=css:[data-synk="think"]', { timeout: 15000, label: "open thinking submenu" });
        await page.waitForTimeout(1300);
        const 글들 = await 단계글들();
        const 높은 = 가장높은수준(글들);
        log({ step: "levels", 단계: 글들.filter((g) => 수준순위(g) >= 0).map((g) => g.split(/\r?\n/)[0].trim()), 고름: 높은 ? 높은.글 : null });
        if (높은) {
          고른수준 = 높은;
          if (await 단계표시(높은.글)) { await page.click('loc=css:[data-synk="lvl"]', { timeout: 15000, label: "choose top thinking level" }); await page.waitForTimeout(1300); }
        }
      }
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(700);
    }
    await openTools();
  };
  await chooseCarbon();
  if (!OK(s.mode)) await fail(`모드가 카본 · 사고 수준 가장 높은 단계(${고른수준 ? 고른수준.글 : "하위 메뉴에서 단계를 못 읽음"})가 아님: ${s.mode}`);
  log({ step: "mode", mode: s.mode, level: 고른수준.글, rank: 고른수준.순위 });
  if (mode === "확인") {
    // 넣은 「.」만 지우고 닫는다 — 보내기 · 올리기 없음
    await page.click('loc=css:[aria-label="Gemini 프롬프트 입력"]', { timeout: 15000, label: "focus prompt box" }).catch(() => {});
    await page.keyboard.press("ControlOrMeta+a").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    log({ step: "done", url: await page.url().catch(() => ""), chars: 0, out: null });
    await page.close().catch(() => {});
  } else {

    await 진단걸기(true); // 올리기 요청도 세려고 올리기 앞에서 건다(11-13) — 누르기 전에 올리는 중인 요청이 끝나기를 기다리고 사라짐 진단에 남긴다
    // 파일 올리기 — 숨은 파일 칸이 없어 「파일 업로드」를 파일 선택 대기와 함께 실제로 누른다(10-22)
    let 올릴바이트 = 0; // 올리기 기다림을 크기에 맞춘다(11-08)
    for (const f of files) { try { 올릴바이트 += (await fs.stat(f)).size; } catch { /* 없는 파일은 부르는 쪽 작업문제가 먼저 막는다 */ } }
    if (files.length) {
      await 마감확인(); // 올리기 앞 — 마감 뒤에는 파일 고르기 창을 열지 않는다
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
      await 마감확인(); // 파일 넣기 바로 앞 — 고르기 창을 기다리는 사이 마감이 왔으면 넣지 않는다
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
      // 썸네일이 뜬 뒤에도 올리는 중이다 — 수가 맞은 뒤 더 기다린다(10-25). 영상은 칩이 먼저 뜬다(10-28). 큰 묶음은 크기만큼 더(11-08 — 올리기뒤기다림)
      await page.waitForTimeout(올리기뒤기다림(올릴바이트, files.length, files.some((f) => kind(f) === "영상")));
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
    if (s.mode && !OK(s.mode)) { await chooseCarbon(); s = await state(); if (!OK(s.mode)) await fail("보내기 직전 모드가 바뀜: " + s.mode); }
    // 누르기 직전 올리기 끝 기다림(11-08 — 큰 그림 묶음 셋 · 영상 하나가 덜 올라간 채 보내져 새 채팅으로 사라졌다): 미리보기 안 돌고 있는 표시와 꺼진 보내기
    // 단추가 없어질 때까지 크기에 비례한 상한(올리기끝상한초)까지 본다. 표시 선택자는 10-27 p7 실행기 것 — 그 실행기 round-22에서 덜 끝난 올리기(썸네일 6 → 5)를
    // 잡았고 다시 할 때는 바로 지나갔다. 상한을 넘겨도 지금처럼 보낸다(선택자가 다른 것을 잡아도 늦어질 뿐 막히지 않게) — 기다린 초를 단계 기록에 남겨 다음에 가린다.
    // 11-13: 그 표시는 11-11~12 보내기 176건 내내 0이었다 — 진단 고리가 센 끝나지 않은 올리기 요청(올리는중)도 0이 될 때까지 함께 본다
    if (files.length) {
      const 상한초 = 올리기끝상한초(올릴바이트);
      let 초 = 0, 본 = { 빙글: 0, 꺼짐: false };
      for (; 초 <= 상한초 && !넘김; 초 += 1) {
        본 = await page.evaluate(() => {
          const 미리보기 = [...document.querySelectorAll("uploader-file-preview, .file-preview-container, [class*='file-preview']")];
          const 빙글 = 미리보기.filter((c) => c.querySelector("svg circle, [role=progressbar], mat-progress-spinner, mat-spinner, [class*='spinner'], [class*='progress'], [class*='loading'], [aria-busy=true]")).length;
          const b = document.querySelector('[aria-label="메시지 보내기"]');
          const 올리는중 = window.__synkUp ? window.__synkUp.시작 - window.__synkUp.끝 : -1; // 진단 고리가 센 끝나지 않은 올리기 요청(없으면 -1)
          return { 빙글, 꺼짐: !!b && (b.disabled || b.getAttribute("aria-disabled") === "true"), 올리는중 };
        }).catch(() => ({ 빙글: 0, 꺼짐: false, 올리는중: -1 }));
        if (!본.빙글 && !본.꺼짐 && !(본.올리는중 > 0)) break;
        await page.waitForTimeout(1000);
      }
      log({ step: "upload-wait", 초, 상한초, 빙글: 본.빙글, 꺼짐: 본.꺼짐, 올리는중: 본.올리는중, MB: Math.round(올릴바이트 / 104857.6) / 10 });
    }
    // 올리기 마감을 넘겼으면 표시를 쓰지 않고 그만둔다(감시가 이미 탭을 닫았을 수 있다). 이 검사와 「누름」 사이에는 await가 없어 감시가 끼어들지 못한다
    if (넘김 || (upDeadline && Date.now() > upDeadline)) await fail("올리기 마감을 넘겨 보내지 않는다(표시 안 씀) — 다시 돌려도 된다", "올리기넘김");
    누름 = true;
    if (감시) clearTimeout(감시);
    await writeMark(null); // 이 뒤로 끝나면 부르는 쪽은 다시 보내지 않는다
    log({ step: "clicking", 첨부단추: s.closes, 모드: s.mode });
    await 올리기풀기(); // 올리기 · 썸네일 뒤 기다림 · 지시문 넣기가 끝났다 — 누르기 전에 다음 올리기에 넘긴다(답을 기다리는 동안 쥐지 않는다)
    let clickErr = "";
    await 진단걸기();
    await 누름표시();
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
    const r = await waitAnswer(url, 0, true);
    log({ step: "net", ...받은진단(await 진단읽기()) }); // 받은 보내기의 요청 상태(본문 빼고) · 누를 때 올리는 중이던 수 — 사라짐과 견줄 바탕
    await finish(r.text, r.url);
  }
}
} finally {
  if (감시) clearTimeout(감시);
  await 올리기풀기();
  if (넘김 && page) await page.close().catch(() => {}); // 마감으로 그만둔 판 — 제 탭을 닫는다(실패 그림은 fail이 먼저 찍었다)
  // 보내기 누르기 전에 끝난 보내기 · 확인은 입력창에 넣은 「.」 · 지시문을 지운다(11-12 synk.yuh 확인이 실패하며 「.」을 남겼다 — 다음 빈 탭 찾기도
  // 초안이 있는 탭은 안 쓴다). 누른 뒤 · 읽기는 건드리지 않는다
  else if (page && !누름 && (mode === "보내기" || mode === "확인")) {
    const 남은글 = await page.evaluate(() => { const ed = document.querySelector('[aria-label="Gemini 프롬프트 입력"]'); return ed ? ed.innerText.trim().length : 0; }).catch(() => 0);
    if (남은글) {
      await page.click('loc=css:[aria-label="Gemini 프롬프트 입력"]', { timeout: 5000, label: "focus prompt box" }).catch(() => {});
      await page.keyboard.press("ControlOrMeta+a").catch(() => {});
      await page.keyboard.press("Backspace").catch(() => {});
      log({ step: "cleared", 글자: 남은글 });
    }
  }
}
