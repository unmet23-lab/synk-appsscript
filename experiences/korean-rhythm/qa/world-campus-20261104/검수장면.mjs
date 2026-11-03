// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 말의리듬=<틀.htm> --장면 <이 파일>): WORLD 게임 틀(틀.htm) 안의 말의 리듬을
// 입구 → 놀이 → 문장 듣기 → 답 → 결과 순서로 찍는다. 「전」 판에는 이 틀이 없어 찍지 않는다.
export default async function 장면({ page, 찍기, 판, 주소들 }) {
  const 주소 = 주소들['말의리듬'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const fr = () => page.frames().find((f) => f.url().includes('/korean-rhythm/index.html'));
  const f = page.frameLocator('iframe.game-frame');
  await page.addInitScript(() => { try { localStorage.setItem('synk.world.rhythm.calibrated', '1'); } catch { /* 저장 못 함 */ } });
  await page.goto(주소, { waitUntil: 'load', timeout: 60000 });
  for (let i = 0; i < 100; i += 1) { if (await fr()?.evaluate(() => !!window.__rhythm && !!document.querySelector('.w-art')).catch(() => false)) break; await 쉼(150); }
  await 쉼(2600);   // 제목이 마이크 뒤에서 오르고 박자 점
  await 찍기('입구');
  await f.locator('#start-button').click();
  const 때 = async (test, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fr().evaluate(test).catch(() => false)) return; await 쉼(100); } };
  await 때(() => window.__rhythm.state().screen === 'game' && window.__rhythm.state().time > -1);
  await fr().evaluate(() => { window.__rhythm.autoplay(true); window.__rhythm.plan(['right', 'right', 'right', 'right', 'right']); });
  await 때(() => window.__rhythm.state().time > 7);
  await 찍기('놀이');
  const q = await fr().evaluate(() => window.__rhythm.state().questions[0]);
  await fr().evaluate((t) => window.__rhythm.seek(t), q.showTime + 0.6);
  await 쉼(900);
  await 찍기('듣기');
  await fr().evaluate((t) => window.__rhythm.seek(t), q.answerOpen + 0.05);
  await 쉼(500);
  await 찍기('답');
  const 끝 = await fr().evaluate(() => window.__rhythm.state().duration);
  await fr().evaluate((t) => window.__rhythm.seek(t), 끝 - 3);
  await 때(() => window.__rhythm.state().screen === 'results');
  await 쉼(4200);
  await 찍기('결과');
}
