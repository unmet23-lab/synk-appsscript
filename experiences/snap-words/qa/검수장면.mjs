// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 찰칵낱말=experiences/snap-words/qa/틀.htm --장면 <이 파일>): WORLD 게임 틀 안의 찰칵 낱말을
// 입구 → 둘러보기 → 다가감 → 카드 → 부탁 → 다름 → 보냄 → 인화 → 결과 → 앨범 순서로 찍는다. 「전」 판에는 이 게임이 없어(새 화면) 건너뛴다.
export default async function 장면({ page, 찍기, 판, 주소들 }) {
  const 주소 = 주소들['찰칵낱말'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const 틀 = () => page.frames().find((f) => f.url().includes('/snap-words/index.html'));
  await page.goto(주소, { waitUntil: 'load', timeout: 60000 });
  for (let i = 0; i < 200; i += 1) { if (await 틀()?.evaluate(() => !!window.__snap).catch(() => false)) break; await 쉼(150); }
  const f = 틀();
  const 다가감 = (src) => f.evaluate((s) => window.__snap.focusOn(window.__snap.S.items.find(eval(s))), src);
  const 찰칵 = async () => { await f.locator('#shutter').click(); await 쉼(900); };
  await 쉼(1400);
  await 찍기('입구');
  await f.locator('[data-go=start]').click();
  await f.waitForFunction(() => window.__snap.S.screen === 'shoot' && !window.__snap.S.busy && !document.querySelector('#msg').hidden, null, { timeout: 30000 });
  await 쉼(700);
  await 찍기('둘러보기');
  await 다가감("(i)=>i.group==='blade'"); await 쉼(800);
  await 찍기('다가감');
  await 찰칵();
  await 찍기('카드');
  await 다가감("(i)=>i.word==='cat'"); await 쉼(700); await 찰칵();
  await 다가감("(i)=>i.kind==='fixed'"); await 쉼(700); await 찰칵();
  await f.locator('#step-back').click(); await 쉼(800);
  await 찍기('부탁단추');
  await f.locator('#msg .pill').click(); await 쉼(1200);
  await 찍기('첫부탁');
  const 다른쪽 = await f.evaluate(() => { const { S } = window.__snap; return S.missions[S.mi].kind === 'word' ? "(i)=>i.kind==='plate'" : "(i)=>i.kind==='plate'&&i.group&&i.word!==window.__snap.S.missions[window.__snap.S.mi].word"; });
  await 다가감(다른쪽); await 쉼(600); await 찰칵();
  await 찍기('다름');
  for (let g = 0; g < 8; g += 1) {
    const st = await f.evaluate(() => { const { S } = window.__snap, m = S.missions[S.mi]; return { phase: S.phase, mi: S.mi, kind: m?.kind, word: m?.word }; });
    if (st.phase !== 'mission') break;
    await f.evaluate(({ kind, word }) => { const { S } = window.__snap; window.__snap.focusOn(S.items.find((i) => (kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && i.word === word)); }, st);
    await 쉼(650);
    await f.locator('#shutter').click();
    await f.waitForFunction((mi) => window.__snap.S.mi !== mi || window.__snap.S.phase !== 'mission', st.mi, { timeout: 12000 });
    await 쉼(300);
    if (g === 0) await 찍기('보냄');
  }
  await f.waitForFunction(() => window.__snap.S.screen === 'develop', null, { timeout: 12000 });
  await 쉼(1800);
  await 찍기('인화');
  for (let i = 0; i < 3; i += 1) {
    if (await f.evaluate(() => window.__snap.S.screen !== 'develop')) break;
    await f.waitForFunction(() => document.querySelector('.dev-opt:not([disabled])'));
    const n = await f.evaluate(() => window.__snap.answerNow());
    await f.locator('.dev-opt').nth(n).click();
    await 쉼(700);
    if (i === 0) await 찍기('인화맞음');
    await 쉼(900);
  }
  await f.waitForFunction(() => window.__snap.S.screen === 'result', null, { timeout: 12000 });
  await 쉼(1500);
  await 찍기('결과');
  await f.locator('.res-row [data-go=album]').click(); await 쉼(800);
  await 찍기('앨범');
}
