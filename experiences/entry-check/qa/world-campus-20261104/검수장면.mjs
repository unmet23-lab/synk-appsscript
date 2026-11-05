// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 입장검사=<틀.htm> --장면 <이 파일>): WORLD 게임 틀(틀.htm) 안의 입장 검사를
// 입구 → 근무 전 안내 → 손님 말 → 표를 살핌(긴장) → 거절 이유 고르기 → 판정(맞음 · 틀림) → 그 뒤에 생긴 일 → 결과 순서로 찍는다. 「전」 판에는 이 틀이 없어 찍지 않는다.
export default async function 장면({ page, 찍기, 판, 주소들 }) {
  const 주소 = 주소들['입장검사'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const fr = () => page.frames().find((f) => f.url().includes('/entry-check/index.html'));
  const f = page.frameLocator('iframe.game-frame');
  await page.addInitScript(() => { try { localStorage.setItem('synk.entry-check.v1', JSON.stringify({ v: 1, stars: {}, plays: 1, tutorial: true, doneDay: null, motion: true })); } catch { /* 저장 못 함 */ } });
  await page.goto(주소, { waitUntil: 'load', timeout: 60000 });
  for (let i = 0; i < 100; i += 1) { if (await fr()?.evaluate(() => !!window.__entry && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await 쉼(150); }
  await 쉼(1600);
  await 찍기('입구');
  await f.locator('#rec-start').click();
  await 쉼(1200);
  await 찍기('근무전안내');
  await f.locator('#btn-begin').click();
  await 쉼(1400);
  const 손님 = async (앞) => { for (let i = 0; i < 80; i += 1) { const c = await fr().evaluate(() => window.__entry.state().cur); if (c?.id && c.id !== 앞 && !c.done) return c; await 쉼(100); } return null; };
  const 찍기판정 = async (c, 고름) => {
    if (고름 === 'pass') await f.locator('#btn-pass').click();
    else { await f.locator('#btn-reject').click(); await 쉼(350); await f.locator(`#notice .rule[data-rule="${고름}"]`).click(); }
  };
  let c = await 손님(null);
  await 쉼(900);
  await 찍기('손님말');
  await 쉼(2000);
  await f.locator('#doc').click();
  await 쉼(350);
  await 찍기('표살핌_긴장');
  await 쉼(2200);
  await 찍기판정(c, c.answer);
  await 쉼(1400);
  await 찍기('판정_맞음');
  await f.locator('#btn-next').click();
  await 쉼(500);
  // 둘째 손님은 일부러 놓치거나 잘못 거절해 틀린 얼굴과 사건을 본다. 찍기는 화면이 가라앉을 때까지 기다리므로 「판정_틀림」에는 사건까지 뜬 뒤가 찍힌다 — 첫 순간은 장면캡처.cjs · 시안영상으로 본다
  let 앞 = c.id;
  c = await 손님(앞);
  await 쉼(1200);
  if (c.answer === 'pass') {
    await f.locator('#btn-reject').click();
    await 쉼(400);
    await 찍기('거절이유_고르기');
    const 규칙 = await fr().evaluate(() => document.querySelector('#notice .rule').dataset.rule);
    await f.locator(`#notice .rule[data-rule="${규칙}"]`).click();
  } else await 찍기판정(c, 'pass');
  await 쉼(500);
  await 찍기('판정_틀림');
  await 쉼(5000);
  await 찍기('그뒤에생긴일');
  // 나머지는 맞게 끝까지
  for (let g = 0; g < 14; g += 1) {
    await f.locator('#btn-next').click();
    await 쉼(600);
    if (await fr().evaluate(() => !document.querySelector('#results').hidden)) break;
    앞 = c.id;
    c = await 손님(앞);
    if (!c) break;
    await 쉼(300);
    await 찍기판정(c, c.answer);
    await 쉼(800);
  }
  await 쉼(3400);
  await 찍기('결과');
  await fr().evaluate(() => window.scrollTo(0, 560));
  await 쉼(400);
  await 찍기('결과_표현');
}
