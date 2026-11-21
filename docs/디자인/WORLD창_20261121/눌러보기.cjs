// WORLD 창 시안: 장면 캡처와 눌러 보기 시험(4판부터 약한 곳 추천 포함)
//   node 눌러보기.cjs <구운 파일.html>   캡처는 그 파일 옆 shots/
const { chromium } = require("playwright");
const path = require('node:path'); const fs = require('node:fs'); const { pathToFileURL } = require('node:url');
const built = process.argv[2]; if (!built) { console.error('사용: node 눌러보기.cjs <구운 파일.html>'); process.exit(2); }
const out = path.join(path.dirname(path.resolve(built)), 'shots'); fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.resolve(built)).href;
const fails = [], ok = m => console.log('  ok', m), bad = m => { fails.push(m); console.log('  FAIL', m); };
const overflow = p => p.evaluate(() => { const w = document.querySelector('#win'), wr = w.getBoundingClientRect(); return [...w.querySelectorAll('*')].filter(n => { const r = n.getBoundingClientRect(); return r.width && n.closest('.view:not([hidden]),.top') && (r.right > wr.right + 1 || r.left < wr.left - 1); }).map(n => n.className?.baseVal ?? n.className ?? n.tagName).slice(0, 6); });
// 보이는 보기가 창 안에 한 화면으로 드는지(스크롤 없이)
const fits = p => p.evaluate(() => { const b = document.querySelector('#body'); return b.scrollHeight - b.clientHeight; });
// 판 안의 글이 아래로 잘리는지
const clipped = p => p.evaluate(() => [...document.querySelectorAll('.view:not([hidden]) .tile')].filter(t => t.offsetParent && t.scrollHeight > t.clientHeight + 1).map(t => t.className));
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [vw, vh] of [[1440, 980], [1280, 900]]) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } }); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(url); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(out, `${vw}-practice.png`) });
    let o = await overflow(p); o.length ? bad(`${vw} 연습 넘침 ${o}`) : ok(`${vw} 연습 넘침 없음`);
    let cl = await clipped(p); cl.length ? bad(`${vw} 연습 판 잘림 ${cl}`) : ok(`${vw} 연습 판 잘림 없음`);
    let f = await fits(p); f <= 2 ? ok(`${vw} 연습 한 화면`) : bad(`${vw} 연습이 ${f}px 넘쳐 스크롤`);
    // 약한 곳 추천: 처음엔 가장 약한 기술, 줄을 고르면 첫 판 · 게임 차례가 바뀐다
    const first = () => p.getAttribute('.game >> nth=0', 'data-game');
    const cta = () => p.textContent('[data-rec-go]');
    (await first()) === '말의 리듬' && (await cta()) === '말의 리듬으로 연습' ? ok('처음: 부정·변경 듣기 → 말의 리듬') : bad(`처음 추천 ${await first()} / ${await cta()}`);
    (await p.locator('.game[data-last]').count()) === 0 ? ok('마지막 게임 노란 칸 없음') : bad('data-last 남음');
    (await p.locator('.game[data-rec]').count()) === 3 ? ok('추천 칸 셋') : bad('추천 칸 수');
    await p.click('[data-skill=cond]'); await p.waitForTimeout(150);
    (await first()) === '입장 검사' && (await cta()) === '입장 검사로 연습' ? ok('조건 읽기 → 입장 검사') : bad(`조건 ${await first()} / ${await cta()}`);
    (await p.textContent('[data-games-note]')).startsWith('노란 칸은 「조건 읽기」를') ? ok('게임 머리 글 바뀜') : bad('게임 머리 글');
    (await p.getAttribute('[data-skill=cond]', 'aria-pressed')) === 'true' ? ok('고른 줄 표시') : bad('고른 줄');
    await p.screenshot({ path: path.join(out, `${vw}-practice-cond.png`) });
    await p.click('[data-skill=obj]'); (await first()) === '빈칸 베기' ? ok('을/를 → 빈칸 베기') : bad('을/를');
    await p.click('[data-skill=word]'); (await p.textContent('.go-tag')) === '잘하는 곳 이어 가기' && (await p.textContent('[data-games-note]')).startsWith('「낱말 듣기」는') ? ok('잘하는 줄 글') : bad('잘하는 줄');
    cl = await clipped(p); cl.length ? bad(`${vw} 고른 뒤 판 잘림 ${cl}`) : ok(`${vw} 고른 뒤 판 잘림 없음`);
    f = await fits(p); f <= 2 ? ok(`${vw} 고른 뒤 한 화면`) : bad(`${vw} 고른 뒤 ${f}px 넘침`);
    await p.click('[data-skill=neg]');
    await p.click('[data-rec-go]'); (await p.textContent('#sheet-name')) === '말의 리듬' ? ok('연습 단추 → 말의 리듬 열림') : bad('연습 단추');
    await p.keyboard.press('Escape');
    await p.click('.quiet'); (await p.textContent('#sheet-name')) === '바람길' ? ok('이어 하기 → 바람길') : bad('이어 하기');
    await p.keyboard.press('Escape');
    await p.click('.game >> nth=2'); (await p.isVisible('#sheet')) ? ok('게임 판 열림') : bad('게임 판 안 열림');
    await p.keyboard.press('Escape'); (await p.isHidden('#sheet')) ? ok('Esc로 닫힘') : bad('Esc로 안 닫힘');
    await p.click('[data-seg=help] button >> nth=0'); (await p.getAttribute('[data-seg=help] button >> nth=0', 'aria-pressed')) === 'true' ? ok('도움 방식 바뀜') : bad('도움 방식');
    await p.click('#who'); await p.waitForTimeout(250); (await p.isVisible('#v-id')) ? ok('ID 보기') : bad('ID 안 열림');
    await p.waitForTimeout(2700);
    await p.screenshot({ path: path.join(out, `${vw}-id.png`) });
    o = await overflow(p); o.length ? bad(`${vw} ID 넘침 ${o}`) : ok(`${vw} ID 넘침 없음`);
    f = await fits(p); f <= 2 ? ok(`${vw} ID 한 화면`) : bad(`${vw} ID가 ${f}px 넘쳐 스크롤`);
    await p.click('#badge'); await p.waitForTimeout(650); (await p.getAttribute('#badge', 'data-flip')) !== null ? ok('학생증 뒤집힘') : bad('뒤집기');
    await p.screenshot({ path: path.join(out, `${vw}-id-back.png`) });
    await p.click('#badge'); await p.waitForTimeout(600);
    await p.click('#sw-learning'); (await p.getAttribute('#stamp', 'data-state')) === 'off' ? ok('도장 꺼짐') : bad('도장');
    (await p.textContent('[data-lstate]')) === '꺼짐' ? ok('판 글 꺼짐') : bad('판 글');
    await p.click('#sw-learning');
    const n0 = await p.locator('#sessions li').count(); await p.click('[data-end] >> nth=0'); (await p.locator('#sessions li').count()) === n0 - 1 ? ok('로그인한 곳 하나 끝냄') : bad('세션');
    await p.click('#export'); await p.waitForTimeout(1300); (await p.textContent('#toast')).includes('파일') ? ok('내려받기 알림') : bad('내려받기');
    await p.click('.mock [data-role=teacher]'); await p.waitForTimeout(200);
    (await p.textContent('[data-rolecls]')).startsWith('강사') ? ok('강사증') : bad('강사');
    (await p.isVisible('#class-sub .lnk')) ? ok('강사: 내 수업 열기') : bad('강사 내 수업');
    await p.waitForTimeout(2700); await p.screenshot({ path: path.join(out, `${vw}-id-teacher.png`) });
    await p.click('#del'); await p.click('#del-dialog button[value=ok]'); (await p.getAttribute('#stamp', 'data-state')) === 'del' ? ok('삭제 요청') : bad('삭제 요청');
    await p.screenshot({ path: path.join(out, `${vw}-id-deleting.png`) });
    await p.click('#del-cancel'); (await p.getAttribute('#stamp', 'data-state')) === 'off' ? ok('삭제 취소') : bad('삭제 취소');
    await p.click('#t-practice'); await p.waitForTimeout(2700); await p.screenshot({ path: path.join(out, `${vw}-practice-teacher.png`) });
    errs.length ? bad(`${vw} 콘솔 ${errs}`) : ok(`${vw} 콘솔 오류 없음`);
    await p.close();
  }
  const p = await b.newPage({ viewport: { width: 470, height: 900 } }); await p.goto(url);
  await p.click('.mock [data-w=phone]'); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, 'phone-practice.png') });
  const o = await overflow(p); o.length ? bad('휴대폰 넘침 ' + o) : ok('휴대폰 넘침 없음');
  for (const [y, n] of [[560, 2], [1100, 3]]) { await p.evaluate(y => { document.querySelector('#body').scrollTop = y; }, y); await p.waitForTimeout(150); await p.screenshot({ path: path.join(out, `phone-practice-${n}.png`) }); }
  await p.click('#t-id'); await p.waitForTimeout(300); await p.screenshot({ path: path.join(out, 'phone-id.png') });
  const o2 = await overflow(p); o2.length ? bad('휴대폰 ID 넘침 ' + o2) : ok('휴대폰 ID 넘침 없음');
  for (const [y, n] of [[520, 2], [1040, 3]]) { await p.evaluate(y => { document.querySelector('#body').scrollTop = y; }, y); await p.waitForTimeout(150); await p.screenshot({ path: path.join(out, `phone-id-${n}.png`) }); }
  await b.close();
  console.log(fails.length ? `\n실패 ${fails.length}` : '\n모두 통과');
})();
