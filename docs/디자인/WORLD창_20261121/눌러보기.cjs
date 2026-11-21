// WORLD 창 시안: 장면 캡처와 눌러 보기 시험
//   node docs/디자인/WORLD창_20261121/눌러보기.cjs <빌드.cjs로 구운 파일.html>
// 캡처는 그 파일 옆 shots/에 둔다(저장소 밖에 구워서 돌린다).
const { chromium } = require('playwright');
const path = require('node:path'); const fs = require('node:fs'); const { pathToFileURL } = require('node:url');
const built = process.argv[2]; if (!built) { console.error('사용: node 눌러보기.cjs <구운 파일.html>'); process.exit(2); }
const out = path.join(path.dirname(path.resolve(built)), 'shots'); fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.resolve(built)).href;
const fails = [], ok = m => console.log('  ok', m), bad = m => { fails.push(m); console.log('  FAIL', m); };
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [vw, vh] of [[1440, 960], [1280, 820]]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } }); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(url); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `${vw}-practice.png`) });
    // 창 안 넘침
    const over = await p.evaluate(() => { const w = document.querySelector('#win'); return [...w.querySelectorAll('*')].filter(n => { const r = n.getBoundingClientRect(), wr = w.getBoundingClientRect(); return r.width && (r.right > wr.right + 1 || r.left < wr.left - 1); }).map(n => n.className || n.tagName).slice(0, 5); });
    over.length ? bad(`${vw} 넘침 ${over}`) : ok(`${vw} 넘침 없음`);
    // 게임 열고 닫기
    await p.click('.game >> nth=0'); (await p.isVisible('#sheet')) ? ok('게임 판 열림') : bad('게임 판 안 열림');
    await p.keyboard.press('Escape'); (await p.isHidden('#sheet')) ? ok('Esc로 닫힘') : bad('Esc로 안 닫힘');
    // 도움 방식
    await p.click('[data-seg=help] button >> nth=0'); (await p.getAttribute('[data-seg=help] button >> nth=0', 'aria-pressed')) === 'true' ? ok('도움 방식 바뀜') : bad('도움 방식');
    // 내 SYNK ID
    await p.click('#who'); await p.waitForTimeout(250); (await p.isVisible('#v-id')) ? ok('ID 보기') : bad('ID 보기 안 열림');
    await p.screenshot({ path: path.join(out, `${vw}-id.png`) });
    await p.click('#badge'); await p.waitForTimeout(650); (await p.getAttribute('#badge', 'data-flip')) !== null ? ok('학생증 뒤집힘') : bad('뒤집기');
    await p.screenshot({ path: path.join(out, `${vw}-id-back.png`) });
    await p.click('#badge'); await p.waitForTimeout(600);
    // 기록 연결 끄기 → 도장 · 맥락 줄
    await p.click('#sw-learning'); const st = await p.getAttribute('#stamp', 'data-state'); st === 'off' ? ok('도장 꺼짐') : bad('도장 ' + st);
    await p.click('#sw-learning');
    // 펼치기
    for (const id of ['#r-sum', '#r-sessions', '#r-rights']) { await p.click(`${id} [data-more]`); }
    await p.screenshot({ path: path.join(out, `${vw}-id-open.png`), fullPage: false });
    const n0 = await p.locator('#sessions .line').count(); await p.click('[data-end] >> nth=0'); const n1 = await p.locator('#sessions .line').count(); n1 === n0 - 1 ? ok('로그인한 곳 하나 끝냄') : bad('세션 끝내기');
    // 강사
    await p.click('.mock [data-role=teacher]'); await p.waitForTimeout(200);
    const role = await p.textContent('[data-rolecls]'); role.startsWith('강사') ? ok('강사: ' + role) : bad('강사 역할 ' + role);
    await p.evaluate(() => document.querySelector('#body').scrollTop = 0); await p.click('#r-sum [data-more]'); await p.click('#r-sessions [data-more]'); await p.click('#r-rights [data-more]');
    await p.screenshot({ path: path.join(out, `${vw}-id-teacher.png`) });
    // 삭제 요청 → 취소
    await p.click('#del'); await p.click('#del-dialog button[value=ok]'); (await p.getAttribute('#stamp', 'data-state')) === 'del' ? ok('삭제 요청 상태') : bad('삭제 요청');
    await p.screenshot({ path: path.join(out, `${vw}-id-deleting.png`) });
    await p.click('#del-cancel'); (await p.getAttribute('#stamp', 'data-state')) === 'off' ? ok('삭제 취소 → 기록 꺼짐') : bad('삭제 취소');
    // 강사 연습 보기
    await p.click('#t-practice'); await p.screenshot({ path: path.join(out, `${vw}-practice-teacher.png`) });
    errs.length ? bad(`${vw} 콘솔 ${errs}`) : ok(`${vw} 콘솔 오류 없음`);
    await p.close();
  }
  // 휴대폰 폭
  const p = await b.newPage({ viewport: { width: 470, height: 900 } }); await p.goto(url);
  await p.click('.mock [data-w=phone]'); await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(out, 'phone-practice.png') });
  const over = await p.evaluate(() => { const w = document.querySelector('#win'), wr = w.getBoundingClientRect(); return [...w.querySelectorAll('*')].filter(n => { const r = n.getBoundingClientRect(); return r.width && r.right > wr.right + 1; }).map(n => n.className || n.tagName).slice(0, 6); });
  over.length ? bad('휴대폰 넘침 ' + over) : ok('휴대폰 넘침 없음');
  await p.evaluate(() => { const b = document.querySelector('#body'); b.scrollTop = 700; }); await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, 'phone-practice-2.png') });
  await p.click('#t-id'); await p.waitForTimeout(250); await p.screenshot({ path: path.join(out, 'phone-id.png') });
  await p.evaluate(() => { const b = document.querySelector('#body'); b.scrollTop = 480; }); await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, 'phone-id-2.png') });
  await b.close();
  console.log(fails.length ? `\n실패 ${fails.length}` : '\n모두 통과');
})();
