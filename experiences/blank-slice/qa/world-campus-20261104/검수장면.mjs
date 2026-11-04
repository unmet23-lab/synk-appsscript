// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 빈칸베기=<틀.htm> --장면 <이 파일>): WORLD 게임 틀(틀.htm) 안의 빈칸 베기를
// 입구 → 제목 베기 순간 → 놀이(뜬 카드) → 찢긴 순간 → 붙은 뒤 → 해설(틀림) → 결과 채점 순서로 찍는다. 「전」 판에는 이 틀이 없어(새 화면) 찍지 않는다.
// 한 장 찍는 데 몇 초씩 걸린다(도구가 그림이 가라앉기를 기다린다). 그사이 판이 앞서 가면 카드가 두 번 떨어져 멈춘 보기로 넘어가 다음 장면이 어긋나므로, 놀이 화면은 판을 멈춘 채 찍는다.
export default async function 장면({ page, 찍기: 그냥찍기, 판, 주소들 }) {
  const 주소 = 주소들['빈칸베기'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const fr = () => page.frames().find((f) => f.url().includes('/blank-slice/index.html'));
  const 찍기 = async (이름) => {
    await fr().evaluate(() => { window.__slice.state().paused = true; window.__slice.stage()?.pause(true); });
    await 그냥찍기(이름);
    await fr().evaluate(() => { window.__slice.state().paused = false; window.__slice.stage()?.pause(false); });
  };
  await page.goto(주소, { waitUntil: 'load', timeout: 60000 });
  for (let i = 0; i < 100; i += 1) { if (await fr()?.evaluate(() => !!window.__slice && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await 쉼(150); }
  await fr().evaluate(() => { try { localStorage.setItem('synk.blank-slice.v1', JSON.stringify({ v: 1, plays: 3, practiced: true, slow: false, best: null })); } catch { /* 없음 */ } });
  await page.reload({ waitUntil: 'load' });
  for (let i = 0; i < 100; i += 1) { if (await fr()?.evaluate(() => !!window.__slice && document.documentElement.classList.contains('w-ready')).catch(() => false)) break; await 쉼(150); }
  await 쉼(1200);
  await 찍기('입구');
  // 제목 베기: 움직임 시계를 박자 안(3.6초의 88.5%)으로 옮겨 멈추고 찍는다
  await fr().evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 3186; } });
  await 쉼(120);
  await 찍기('입구_제목베기');
  await fr().evaluate(() => { for (const a of document.getAnimations()) a.play(); document.querySelector('#btn-start').click(); });
  const cur = () => fr().evaluate(() => ({ ...window.__slice.state().cur, pieces: window.__slice.pieces(), over: !document.querySelector('#results').hidden, check: !document.querySelector('#answer-check').hidden, explain: !document.querySelector('#explain').hidden }));
  const 던짐 = async () => { for (let k = 0; k < 300; k += 1) { const c = await cur(); if (c.over) return c; if (c.check) await fr().evaluate(() => document.querySelector('#check-options button').click()); else if (c.explain) await fr().evaluate(() => document.querySelector('#btn-next').click()); else if (c.id && !c.done && c.pieces.length === 4 && c.pieces.every((p) => c.options.includes(p.word) && p.alive)) return c; await 쉼(60); } return null; };
  const 벰 = (i) => fr().evaluate((n) => window.__slice.stage().sliceIndex(n, { x: 0.85, y: -0.35 }), i);
  let c = await 던짐(); await 쉼(1100);
  await 찍기('놀이');
  await 벰(c.pieces.find((p) => p.word === c.answer).index); await 쉼(160);
  await 찍기('찢긴순간');
  await 쉼(620);
  await 찍기('붙은뒤');
  c = await 던짐(); await 쉼(800);
  await 벰(c.pieces.find((p) => p.word !== c.answer).index); await 쉼(1000);
  await 찍기('해설');
  await fr().evaluate(() => document.querySelector('#btn-next').click());
  for (let guard = 0; guard < 14; guard += 1) {
    c = await 던짐();
    if (!c || c.over) break;
    await 쉼(350);
    await 벰(c.pieces.find((p) => p.word === c.answer).index);
    await 쉼(1500);
    if ((await cur()).over) break;
  }
  await 쉼(1000);
  await 찍기('결과_채점중');
  await 쉼(2800);
  await 찍기('결과');
}
