const fs = await import("node:fs/promises");
const OUT = "C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/12dccdfb-dd61-42c2-90ed-bf9d72e1a13d/scratchpad/brief/data/naver";
const task = await taskSpace(76);
const p2 = task.page("p2");
const d = await p2.evaluate(() => {
  const groups = [...document.querySelectorAll("g[class*='bb-circles-']")].map(g => ({
    cls: g.getAttribute("class"),
    cy: [...g.querySelectorAll("circle")].map(c => Number(c.getAttribute("cy"))),
    cx: [...g.querySelectorAll("circle")].slice(0, 3).map(c => Number(c.getAttribute("cx"))),
  }));
  const ticks = [...document.querySelectorAll(".bb-axis-y .tick")].map(t => ({ tr: t.getAttribute("transform"), txt: t.textContent }));
  const legend = [...document.querySelectorAll(".bb-legend-item, [class*='legend'] li, [class*='legend'] span")].map(e => e.textContent.trim()).filter(Boolean).slice(0, 12);
  return { groups: groups.map(g => ({ cls: g.cls, n: g.cy.length, cx: g.cx, cy: g.cy })), ticks, legend };
});
await fs.writeFile(OUT + "/trend_svg.json", JSON.stringify(d));
console.log(d.groups.map(g => g.cls + " n=" + g.n + " cx=" + g.cx.join(",")).join("\n"));
console.log(JSON.stringify(d.ticks), JSON.stringify(d.legend));
