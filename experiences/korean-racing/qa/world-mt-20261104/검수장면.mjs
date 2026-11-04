// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 레이스=experiences/korean-racing/qa/world-mt-20261104/틀.htm --장면 <이 파일>): WORLD 게임 틀 안의 MT 바닷가 레이스를
// 입구 → 코스 창 → 조작 연습 → 문제 → 정답 뒤 질주 → 멈춤 창(자전거 고르기) → 도착 → 결과 순서로 찍는다. 「전」 판에는 이 틀이 없어(새 화면) 찍지 않는다.
export default async function 장면({ page, 찍기, 판, 주소들 }) {
  const 주소 = 주소들['레이스'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  const fr = () => page.frames().find((f) => f.url().includes('/index.html'));
  const 준비 = async () => { for (let i = 0; i < 400; i += 1) { if (await fr()?.evaluate(() => window.__racingQA?.state().ready).catch(() => false)) break; await 쉼(250); } };
  const 달림 = async () => { for (let i = 0; i < 240; i += 1) { if (await fr().evaluate(() => window.__racingQA.state().running)) break; await 쉼(250); } };
  await page.goto(주소 + '?qa', { waitUntil: 'load', timeout: 90000 });
  await 준비();
  await 쉼(800);
  await 찍기('입구');
  await fr().evaluate(() => document.getElementById('choose-course').click());
  await 쉼(500);
  await 찍기('코스창');
  await fr().evaluate(() => document.getElementById('course-close').click());
  // 첫 판: 조작 연습을 보고 건너뛴다
  await fr().evaluate(() => document.getElementById('start').click());
  await 달림();
  await 쉼(1500);
  await 찍기('연습');
  await fr().evaluate(() => document.getElementById('tutorial-skip')?.click());
  await 달림();
  await 쉼(1200);
  await fr().evaluate(() => { const q = window.__racingQA; for (let i = 0; i < 120 && !q.state().gate?.announced; i += 1) q.advance(.5); q.advance(.3); q.hearNow(); });
  await 쉼(700);
  await 찍기('문제');
  // 정답 길로 옮겨 통과 → 질주
  await fr().evaluate(() => { const q = window.__racingQA, r = q.round, g = q.state().gate; r.playerOffset = [-3.45, 0, 3.45][g.types.indexOf(g.answer)]; document.getElementById('go')?.click(); for (let i = 0; i < 80 && r.boost <= 0; i += 1) q.advance(.25); q.advance(.8); });
  await 쉼(900);
  await 찍기('질주');
  await fr().evaluate(() => document.getElementById('pause').click());
  await 쉼(500);
  await 찍기('멈춤창');
  await fr().evaluate(() => document.getElementById('resume').click());
  await 쉼(400);
  // 끝까지: 앞선 상대 둘보다 먼저 들어온다(결과 사진은 꼴찌 태오)
  await fr().evaluate(() => {
    const q = window.__racingQA, r = q.round, LANES = [-3.45, 0, 3.45];
    for (let i = 0; i < 4000 && !r.finished; i += 1) {
      const g = q.state().gate;
      if (g && !g.judged) { if (g.announced && !g.heard) q.hearNow(); r.playerOffset = LANES[g.types.indexOf(g.answer)] ?? r.playerOffset; const go = document.getElementById('go'); if (go && !go.hidden && !go.disabled) go.click(); }
      const [t, h] = q.rig.rivals; t.s = r.playerS - 40; h.s = r.playerS - 10;
      q.advance(.25);
    }
  });
  await 쉼(1000);
  await 찍기('도착');
  await fr().evaluate(() => document.getElementById('cruise-results').click());
  await 쉼(2000);
  await 찍기('결과');
}
