const fs = await import("node:fs/promises");
const OUT = "C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/12dccdfb-dd61-42c2-90ed-bf9d72e1a13d/scratchpad/brief/data/meta";
await fs.mkdir(OUT, { recursive: true });
const task = await taskSpace(76);
const page = task.page("p1");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = {};
for (const q of ["여성 패딩", "여성 코트", "여성 아우터"]) {
  const url = "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&is_targeted_country=false&media_type=all&q=" + encodeURIComponent(q) + "&search_type=keyword_unordered&sort_data[direction]=desc&sort_data[mode]=total_impressions";
  await page.goto(url);
  await page.waitForLoadState();
  await sleep(5000);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 4000));
    await sleep(2500);
  }
  const text = await page.evaluate(() => document.body.innerText);
  const head = text.slice(0, 600);
  const cards = text.split(/라이브러리 ID:|Library ID:/).slice(1).map(c => c.slice(0, 700));
  res[q] = { head, n: cards.length, cards };
  console.log(q, "카드", cards.length, "|", head.replace(/\s+/g, " ").slice(0, 200));
}
await fs.writeFile(OUT + "/cards.json", JSON.stringify(res, null, 1));
