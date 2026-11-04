// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 말랠리=<틀서버 주소> --장면 <이 파일>): WORLD 게임 틀 안의 말 랠리를
// 입구 → 말 걺 → 공 기다림 → 왼쪽 받아치기(닿는 순간) → 스매시 → 틀림 해설 → 연달아 틀림 → 결과 순서로 찍는다. 「전」 판에는 이 틀이 없어(새 화면) 찍지 않는다.
export default async function 장면({ page, 찍기, 판, 주소들 }) {
  const 주소 = 주소들['말랠리'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const fr = () => page.frames().find((f) => f.url().includes('/talk-rally/index.html'));
  await page.goto(주소, { waitUntil: 'load', timeout: 60000 });
  for (let i = 0; i < 160; i += 1) { if (await fr()?.evaluate(() => !!window.__rally && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await 쉼(150); }
  await 쉼(1200);
  await 찍기('입구');
  const cur = () => fr().evaluate(() => window.__rally.state().cur);
  const 칸 = (k) => fr().evaluate((v) => window.__rally.setLane(v), k);
  const 랠리 = (n) => fr().evaluate((v) => window.__rally.setRally(v), n);
  const 날음 = async () => { for (let i = 0; i < 200; i += 1) { const c = await cur(); if (c?.phase === 'flight' && c.choice == null) return c; await 쉼(100); } return null; };
  const 고름 = (c, ok) => fr().evaluate((n) => window.__rally.choose(n), ok ? c.options.indexOf(c.answer) : c.options.findIndex((o) => o !== c.answer));
  await fr().evaluate(() => document.querySelector('#btn-start').click());
  await 쉼(2600);
  await 찍기('말걺_첫공');
  // 칸(k)는 다음 공의 정답 칸이다 — 앞 공을 고르기 전에 건다. 고른 칸이 장면 이름과 맞는지 본다.
  const 받기 = async (이름, 다음칸, 쉬기) => {
    const c = await 날음(); await 쉼(300);
    await 칸(다음칸);
    const 정답칸 = c.options.indexOf(c.answer);
    await 고름(c, true); await 쉼(쉬기);
    await 찍기(이름);
    return 정답칸;
  };
  let c = await 날음(); await 쉼(1400);
  await 찍기('공기다림');
  await 칸(0); await 고름(c, true); await 쉼(2200);
  if ((await 받기('왼쪽_받아침_말함', 1, 2000)) !== 0) throw Error('왼쪽 칸이 아니다');
  if ((await 받기('가운데_받아침', 2, 1700)) !== 1) throw Error('가운데 칸이 아니다');
  await 랠리(3);   // 랠리 3 스매시를 건너뛰어 오른쪽 칸도 영상으로 받는다
  if ((await 받기('오른쪽_받아침', 0, 1800)) !== 2) throw Error('오른쪽 칸이 아니다');
  await 랠리(5);
  await 받기('스매시_랠리6', 1, 1500);
  await 랠리(8);
  await 받기('스매시_랠리9', 1, 1500);
  c = await 날음(); await 쉼(300);
  await 고름(c, false); await 쉼(1800);
  await 찍기('틀림_해설');
  await fr().evaluate(() => document.querySelector('#btn-next').click());
  c = await 날음(); await 쉼(300);
  await 고름(c, false); await 쉼(1800);
  await 찍기('연달아틀림');
  await fr().evaluate(() => window.__rally.finish());
  await 쉼(1200);
  await 찍기('결과_세는중');
  await 쉼(3500);
  await 찍기('결과');
}
