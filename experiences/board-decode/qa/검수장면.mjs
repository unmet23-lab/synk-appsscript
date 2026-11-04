// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 게시판해독=experiences/board-decode/qa/틀.htm --장면 <이 파일>): WORLD 게임 틀 안의 게시판 해독을
// 입구 → 게시판 → 단서 · 메모 → 틀림 → 다음 칸 → 정정 → 끝 → 엿보기 → 축제 판 → 수첩 · 앨범 순서로 찍는다. 「전」 판에는 게임이 없어 찍지 않는다.
export default async function 장면({ page, 찍기, 판, 주소들 }) {
  const 주소 = 주소들['게시판해독'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const 틀 = () => page.frames().find((f) => f.url().includes('/board-decode/index.html'));
  await page.goto(주소, { waitUntil: 'load', timeout: 60000 });
  for (let i = 0; i < 200; i += 1) { if (await 틀()?.evaluate(() => !!window.__board).catch(() => false)) break; await 쉼(150); }
  const f = 틀();
  const 정답 = () => f.evaluate(() => { const s = window.__board.state(); const list = s.phase === 'patch' ? s.patchOrder : s.order[s.slot]; const k = ['f1', 'f2'][s.slot]; return list.findIndex((o) => (s.phase === 'patch' ? o.ok === true : o.ok === s.fork[k])); });
  const 오답 = () => f.evaluate(() => { const s = window.__board.state(); const list = s.order[s.slot]; const k = ['f1', 'f2'][s.slot]; return list.findIndex((o) => o.ok !== s.fork[k]); });
  await 쉼(1000);
  await 찍기('입구');
  await f.locator('[data-tear="2"]').click();
  await 쉼(1400);
  await 찍기('세탁실 첫 화면');
  await f.locator('.w').first().click();
  await 쉼(800);
  await f.locator('[data-memo]').first().click();
  await 쉼(600);
  await 찍기('단서와 연필 메모');
  await f.locator('[data-clue-x]').click();
  await f.locator(`[data-reply="${await 오답()}"]`).click();
  await 쉼(900);
  await 찍기('틀렸을 때 벌어진 일');
  await f.locator('[data-scene-x]').click();
  await 쉼(300);
  await f.locator(`[data-reply="${await 정답()}"]`).click();
  await 쉼(800);
  await 찍기('맞힌 뒤 다음 칸');
  await f.locator(`[data-reply="${await 정답()}"]`).click();
  await 쉼(1900);
  await 찍기('정정 쪽지');
  await f.locator(`[data-reply="${await 정답()}"]`).click();
  await 쉼(1700);
  await 찍기('끝');
  await f.locator('[data-peek]').first().click();
  await 쉼(800);
  await 찍기('다르게 답했다면');
  await f.locator('[data-scene-x]').click();
  await 쉼(300);
  await f.locator('[data-next]').click();
  await 쉼(1200);
  await 찍기('축제 첫 화면');
  await f.locator(`[data-reply="${await 정답()}"]`).click();
  await 쉼(800);
  await f.locator(`[data-reply="${await 정답()}"]`).click();
  await 쉼(1900);
  await 찍기('축제 정정');
  await f.locator('[data-panel="book"]').first().click();
  await 쉼(600);
  await 찍기('수첩');
  await f.locator('.tabs [data-panel="album"]').click();
  await 쉼(600);
  await 찍기('앨범');
}
