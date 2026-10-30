// 업종 반응 브리핑 · 네이버 쇼핑 분류 나무 받기 — ego 안에서 돈다. 1~3단계 분류를 한 번 받아 파일로 둔다(브리핑.js가 낱말로 찾는다).
// JOB = { out, 공간, 깊이: 3 }
const fs = await import('node:fs/promises');
const J = globalThis.JOB;
const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));
const 뿌리 = [50000000, 50000001, 50000002, 50000003, 50000004, 50000005, 50000006, 50000007, 50000008, 50000009];

const task = await taskSpace(J.공간 || '업종 브리핑 · 분류');
const page = task.page('p1');
await page.goto('https://datalab.naver.com/shoppingInsight/sCategory.naver');
await page.waitForLoadState();

const 분류 = [];
// 마디를 부르면 아이 목록에 이름·경로가 같이 오므로, 맨 아래 단계는 부르지 않고 부모 응답에서 적는다(1·2단계 160번 안팎).
async function 펼치기(cid, 깊이) {
  await 쉬기(700);
  const r = await page.fetch('/shoppingInsight/getCategory.naver?cid=' + cid, { timeout: 15000 });
  if (r.status !== 200) return;
  const j = JSON.parse(r.body || '{}');
  if (깊이 === 1 && j.name) 분류.push({ cid: j.cid, 이름: j.name, 경로: j.fullPath || j.name, 단계: j.level });
  for (const c of j.childList || []) {
    분류.push({ cid: c.cid, 이름: c.name, 경로: c.fullPath || c.name, 단계: c.level });
    if (깊이 + 1 < (J.깊이 || 3)) await 펼치기(c.cid, 깊이 + 1);
  }
}
for (const cid of 뿌리) await 펼치기(cid, 1);

await fs.writeFile(J.out, JSON.stringify({ 받은때: new Date().toISOString(), 분류 }));
await task.finish({ keep: [] });
console.log(JSON.stringify({ 끝: true, 수: 분류.length }));
