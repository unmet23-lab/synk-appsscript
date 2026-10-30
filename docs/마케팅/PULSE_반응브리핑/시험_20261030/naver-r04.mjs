const fs = await import("node:fs/promises");
const OUT = "C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/12dccdfb-dd61-42c2-90ed-bf9d72e1a13d/scratchpad/brief/data/naver";
const task = await taskSpace(76);
const page = task.page("p1");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const form = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
const post = async (u, o) => {
  await sleep(1500);
  const r = await page.fetch(u, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" }, body: form(o), timeout: 20000 });
  if (r.status !== 200) return { 오류: r.status };
  try { return JSON.parse(r.body); } catch { return { 오류: "json" }; }
};
const OUTER = 50021359;
const rank = async (o) => {
  const r = await post("/shoppingInsight/getCategoryKeywordRank.naver", { timeUnit: "date", age: "", gender: "", device: "", page: 1, count: 20, ...o });
  return (r.ranks || []).map(x => x.keyword);
};
const out = { 연령순위: {}, 주별순위: {}, 하위순위: {}, 견줌: {} };
for (const age of ["20", "30", "40", "50"]) {
  out.연령순위[age] = await rank({ cid: OUTER, startDate: "2026-10-01", endDate: "2026-10-29", age });
  console.log("연령", age, out.연령순위[age].slice(0, 12).join(", "));
}
const weeks = [["2026-10-01", "2026-10-07"], ["2026-10-08", "2026-10-14"], ["2026-10-15", "2026-10-21"], ["2026-10-22", "2026-10-29"]];
for (const [s, e] of weeks) {
  out.주별순위[s] = await rank({ cid: OUTER, startDate: s, endDate: e });
  console.log("주", s, out.주별순위[s].slice(0, 10).join(", "));
}
for (const [name, cid] of Object.entries({ 패딩: 50021321, 롱코트: 50021459, 숏코트: 50021439, 무스탕: 50021380 })) {
  out.하위순위[name] = await rank({ cid, startDate: "2026-10-01", endDate: "2026-10-29" });
  console.log("하위", name, out.하위순위[name].slice(0, 10).join(", "));
}
const groups = { "패딩·롱코트·숏코트": "50021321,50021459,50021439", "무스탕·재킷·트렌치": "50021380,50021360,50021419", "패딩·퍼재킷·베스트": "50021321,50021320,50021441" };
for (const [k, cid] of Object.entries(groups)) {
  const r = await post("/shoppingInsight/getCategoryClickTrend.naver", { cid, timeUnit: "week", startDate: "2025-12-01", endDate: "2026-10-29", age: "", gender: "", device: "" });
  out.견줌[k] = (r.result || []).map(x => ({ 이름: x.title, 값: x.data.map(d => [d.period, Math.round(d.value * 10) / 10]) }));
}
await fs.writeFile(OUT + "/naver2.json", JSON.stringify(out, null, 1));
// 검색어 트렌드(검색 쪽 긴 역사) 화면이 로그인 없이 열리는지
const p2 = await task.newPage();
await p2.goto("https://datalab.naver.com/keyword/trendSearch.naver");
await p2.waitForLoadState();
const info = await p2.evaluate(() => ({ title: document.title, login: /로그인/.test(document.body.innerText.slice(0, 3000)), inputs: document.querySelectorAll("input").length }));
console.log({ p2: p2.label, ...info });
