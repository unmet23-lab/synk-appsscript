// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 주문폭주=<틀.htm> --장면 <이 파일>): WORLD 게임 틀(틀.htm) 안의 주문 폭주를
// 입구 → 영업(주문을 다 듣고 맞게 담음) → 맞음 → 결과 순서로 찍는다. 「전」 판에는 이 틀이 없어(새 화면) 찍지 않는다.
export default async function 장면({ page, 찍기, 판, 주소들 }) {
  const 주소 = 주소들['주문폭주'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const fr = () => page.frames().find((f) => f.url().includes('/order-rush/index.html'));
  const f = page.frameLocator('iframe.game-frame');
  await page.goto(주소, { waitUntil: 'load', timeout: 60000 });
  for (let i = 0; i < 100; i += 1) { if (await fr()?.evaluate(() => !!window.__rush && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await 쉼(150); }
  await 쉼(2600);   // 제목이 잔 뒤에서 오르고 바쁜 박자가 한 번
  await 찍기('입구');
  await f.locator('#start').click();
  for (let i = 0; i < 120; i += 1) { if (await fr().evaluate(() => window.__rush.state().current?.heard).catch(() => false)) break; await 쉼(150); }
  const cups = await fr().evaluate(() => window.__rush.state().current.recipe);
  for (const [i, cup] of cups.entries()) {
    if (i) await f.locator('#add-cup').click();
    if (cup.base) await f.locator(`[data-ingredient=${cup.base}]`).click();
    if (cup.milk) await f.locator('[data-ingredient=milk]').click();
    if (cup.ice) await f.locator('[data-ingredient=ice]').click(); else if (cup.temp === 'cold') await f.locator('[data-ingredient=cold]').click();
    if (cup.sugar) await f.locator('[data-ingredient=sugar]').click();
  }
  await 쉼(700);
  await 찍기('영업');
  await f.locator('#serve').click();
  await 쉼(400);
  await 찍기('맞음');
  await fr().evaluate(() => window.__rush.finish());
  await 쉼(3500);
  await 찍기('결과');
}
