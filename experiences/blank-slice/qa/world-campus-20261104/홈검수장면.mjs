// 검수 묶음 캡처 장면(tools/검수묶음.mjs 준비 … --화면 놀이=<공개 후보를 띄운 주소> --장면 <이 파일>): 앱 「놀이」의 빈칸 베기 카드를
// 처음(잠김) → 카페 첫 방문 → 새로 열림 → 눌렀을 때 순서로 찍는다. 「전」 판은 지금 공개본이라 카드가 없어 찍지 않는다(앱화면.cjs와 같은 길).
export default async function 장면({ page, 찍기, 판, 기기, 주소들 }) {
  const 주소 = 주소들['놀이'];
  if (판 === '전' || !주소) return;
  const 쉼 = (ms) => page.waitForTimeout(ms);
  page.setDefaultTimeout(40000);
  await page.goto(`${주소}${기기 === '390' ? 'mobile' : 'desktop'}.html?opening=off`, { waitUntil: 'load', timeout: 60000 });
  await page.getByText('계속하기', { exact: true }).click();
  await page.getByText('읽을 수 있어요', { exact: true }).click();
  await page.locator('button:has-text("함께하기")').first().click();
  await page.locator('[data-tutor-action=finish]').click();
  await 쉼(1200);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=blank]');
  await page.locator('[data-game=blank]').scrollIntoViewIfNeeded();
  await 찍기('놀이_잠김');
  await page.locator('#panel-close').click();
  await 쉼(500);
  // 싱크타운 카페 첫 방문 — 지금 앱에서 가장 짧게 이야기 기록을 남기는 길
  await page.evaluate(() => document.querySelector('[data-view=cafe]').click());
  await page.locator('.felt-button[data-life-lesson=cafe-apply]').click();
  const 다음 = async () => { if (await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count()) await page.locator('[data-life-cafe-mode=read]').click(); await page.locator('[data-life-cafe-next]:not([disabled])').click(); await 쉼(500); };
  const 고름 = async (id) => { await page.locator(`[data-life-cafe-choice=${id}]:not([disabled])`).click(); await 쉼(700); };
  await 다음(); await 고름('b'); await 다음(); await 고름('c'); await 다음(); await 다음(); await 고름('a'); await 다음();
  await page.locator('#panel-close').click();
  await 쉼(600);
  await page.locator('[data-view=play]').first().click();
  await page.waitForSelector('[data-game=blank]');
  await page.locator('[data-game=blank]').scrollIntoViewIfNeeded();
  await 찍기('놀이_열림');
  // 공개판의 손님은 주문 폭주처럼 로그인부터 연다(app-shell GUEST_GAMES) — 게임 틀까지의 길은 시범 서버의 앱화면.cjs가 본다
  await page.locator('[data-game=blank]').click();
  await 쉼(1500);
  await 찍기('눌렀을때_로그인');
}
