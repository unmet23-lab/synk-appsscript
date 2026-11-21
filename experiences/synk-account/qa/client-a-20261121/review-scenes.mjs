// 검수 묶음(tools/검수묶음.mjs 준비 --장면) 캡처: WORLD 앱 창을 PC 앱 다리 흉내로 장면마다 찍는다(전 = 지금 공개본, 후 = 공개 후보).
// --화면 "WORLD 창=https://synk.im/account/client.html?product=world" 와 함께 준다. 계정 · 로그인 요청은 모두 합성이다.
import { SCENES, answer, bridge } from './synthetic.mjs';

const SHOTS = ['signing-in', 'signed-out', 'error', 'setup', 'signed-in', 'signed-in-class', 'load-fail'];
export default async function scenes({ page, 찍기, 주소들 }) {
  const url = 주소들['WORLD 창'] || Object.values(주소들).find(Boolean);
  if (!url) throw new Error(`--화면 "WORLD 창=<주소>"가 필요하다(받은 이름: ${Object.keys(주소들).join(', ') || '없음'})`);
  let current = SCENES['signing-in'];
  await page.exposeBinding('__synthRequest', (_src, op, params) => answer(current, op, params));
  // 장면은 같은 탭의 sessionStorage로 고른다 — 다리는 쪽을 열 때마다 그 장면의 로그인 상태로 시작한다.
  await page.addInitScript(all => {
    const name = sessionStorage.getItem('__synthScene') || 'signing-in';
    const make = new Function(`return (${all.bridge})`)();
    make({ auth: all.scenes[name].auth });
  }, { bridge: bridge.toString(), scenes: Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, { auth: v.auth }])) });
  for (const name of SHOTS) {
    current = SCENES[name];
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(n => sessionStorage.setItem('__synthScene', n), name);
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(name.startsWith('signed-in') || name === 'load-fail' ? 1800 : 700);
    await 찍기(name);
    if (name === 'signed-in') {
      const del = page.getByRole('button', { name: '계정 삭제 요청' });
      if (await del.count()) { await del.click();await page.waitForTimeout(300);await 찍기('delete-dialog');await page.keyboard.press('Escape'); }
    }
  }
}
