const fs = await import("node:fs/promises");
const OUT = "C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/12dccdfb-dd61-42c2-90ed-bf9d72e1a13d/scratchpad/brief/data/naver";
await fs.mkdir(OUT, { recursive: true });
const task = await taskSpace(76);
const page = task.page("p1");
const form = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
const post = async (u, o) => {
  const r = await page.fetch(u, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" }, body: form(o), timeout: 20000 });
  if (r.status !== 200) return { 오류: r.status, 글: String(r.body).slice(0, 200) };
  try { return JSON.parse(r.body); } catch { return { 오류: "json", 글: String(r.body).slice(0, 200) }; }
};
const base = { age: "", gender: "", device: "" };
const OUTER = 50021359;
const SUB = { 패딩: 50021321, 롱코트: 50021459, 숏코트: 50021439, 무스탕: 50021380, 재킷: 50021360, 트렌치코트: 50021419, 퍼재킷: 50021320, 베스트: 50021441 };
const out = {};

// A. 순위(기간별 상위 40)
const windows = { "2026-10": ["2026-10-01", "2026-10-29"], "2025-11": ["2025-11-01", "2025-11-30"], "2025-12": ["2025-12-01", "2025-12-31"], "2025-10": ["2025-10-01", "2025-10-31"] };
out.순위 = {};
for (const [k, [s, e]] of Object.entries(windows)) {
  const rows = [];
  for (const p of [1, 2]) {
    const r = await post("/shoppingInsight/getCategoryKeywordRank.naver", { cid: OUTER, timeUnit: "date", startDate: s, endDate: e, ...base, page: p, count: 20 });
    rows.push(...(r.ranks || []).map(x => x.keyword));
  }
  out.순위[k] = rows;
  console.log("순위", k, rows.slice(0, 12).join(", "));
}
// B. 연령별(여성) 상위 20 — 이번 달
out.연령순위 = {};
for (const age of ["20", "30", "40", "50"]) {
  const r = await post("/shoppingInsight/getCategoryKeywordRank.naver", { cid: OUTER, timeUnit: "date", startDate: "2026-10-01", endDate: "2026-10-29", age, gender: "f", device: "", page: 1, count: 20 });
  out.연령순위[age] = (r.ranks || []).map(x => x.keyword);
  console.log("연령", age, out.연령순위[age].slice(0, 10).join(", "));
}
// C. 하위 분야 주간 클릭 추이(한 번에 여러 분야를 넣어 서로 견줄 수 있게, 안 되면 따로)
const cids = Object.values(SUB);
let trend = await post("/shoppingInsight/getCategoryClickTrend.naver", { cid: cids.slice(0, 3).join(","), timeUnit: "week", startDate: "2024-09-02", endDate: "2026-10-29", ...base });
console.log("여러 분야 한 번에:", trend.오류 || (trend.result || []).map(x => x.title).join("/"));
out.추이 = {};
for (const [name, cid] of Object.entries(SUB)) {
  const r = await post("/shoppingInsight/getCategoryClickTrend.naver", { cid, timeUnit: "week", startDate: "2024-09-02", endDate: "2026-10-29", ...base });
  out.추이[name] = (r.result?.[0]?.data || []).map(d => [d.period, d.value]);
}
{
  const r = await post("/shoppingInsight/getCategoryClickTrend.naver", { cid: OUTER, timeUnit: "week", startDate: "2024-09-02", endDate: "2026-10-29", ...base });
  out.추이.아우터 = (r.result?.[0]?.data || []).map(d => [d.period, d.value]);
}
out.여러분야 = trend;
// D. 성별·연령 비중
out.비중 = {};
for (const type of ["Gender", "Age", "Device"]) {
  for (const [k, [s, e]] of Object.entries({ "2026-10": windows["2026-10"], "2025-11~12": ["2025-11-01", "2025-12-31"] })) {
    const r = await post(`/shoppingInsight/getCategory${type}Rate.naver`, { cid: OUTER, timeUnit: "date", startDate: s, endDate: e, ...base });
    out.비중[type + " " + k] = r.result || r;
  }
}
await fs.writeFile(OUT + "/naver.json", JSON.stringify(out, null, 1));
console.log("추이 칸 수", Object.fromEntries(Object.entries(out.추이).map(([k, v]) => [k, v.length])));
console.log("비중 예", JSON.stringify(out.비중["Age 2026-10"]).slice(0, 600));
