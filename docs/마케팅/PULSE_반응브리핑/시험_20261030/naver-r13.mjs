const fs = await import("node:fs/promises");
const OUT = "C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/12dccdfb-dd61-42c2-90ed-bf9d72e1a13d/scratchpad/brief/data/naver";
const task = await taskSpace(76);
const p2 = task.page("p2");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const groups = [
  ["패딩", "패딩,여성패딩,여자패딩"],
  ["경량패딩", "경량패딩,여성경량패딩,여자경량패딩"],
  ["롱패딩", "롱패딩,여성롱패딩,여자롱패딩"],
  ["숏패딩", "숏패딩,여성숏패딩,여자숏패딩"],
  ["코트", "코트,여성코트,여자코트,겨울코트"],
].map(([a, b]) => a + "__SZLIG__" + b).join("__OUML__");
let ok = null;
for (const gender of ["f", ""]) {
  await sleep(3000);
  const body = new URLSearchParams({ queryGroups: groups, startDate: "20230101", endDate: "20261029", timeUnit: "date", gender, age: "", device: "" }).toString();
  const r = await p2.fetch("/qcHash.naver", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest" }, body, timeout: 30000 });
  const t = String(r.body || "");
  console.log("gender", JSON.stringify(gender), r.status, t.slice(0, 120));
  if (t) { const j = JSON.parse(t); if (j.success) { ok = { gender, hash: j.hashKey }; break; } }
}
if (ok) {
  await p2.goto("https://datalab.naver.com/keyword/trendResult.naver?hashKey=" + ok.hash);
  await p2.waitForLoadState();
  const d = await p2.evaluate(() => {
    const inputs = [...document.querySelectorAll("input, textarea")].map(e => ({ id: e.id, name: e.name, len: (e.value || "").length, head: (e.value || "").slice(0, 100) })).filter(e => e.len > 40);
    const sc = [...document.scripts].filter(s => !s.src).map(s => s.textContent).filter(t => t.length > 200).map(t => ({ len: t.length, head: t.slice(0, 160) }));
    const big = [...document.querySelectorAll("input, textarea")].sort((a, b) => (b.value || "").length - (a.value || "").length)[0];
    const bigScript = [...document.scripts].filter(s => !s.src).map(s => s.textContent).sort((a, b) => b.length - a.length)[0];
    return { inputs, sc, bigVal: big ? big.value : null, bigScript };
  });
  console.log(JSON.stringify({ used: ok.gender, inputs: d.inputs, sc: d.sc }, null, 1).slice(0, 2500));
  await fs.writeFile(OUT + "/trend_result_input.txt", d.bigVal || "");
  await fs.writeFile(OUT + "/trend_result_script.txt", d.bigScript || "");
}
