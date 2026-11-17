// 낯선 시험관에게 보일 띠를 만든다(11-17). 시안을 실제로 눌러 가며 정해 둔 순간만 찍어 번호를 붙여 한 장으로 잇는다.
//   node 띠.cjs          → 공용 작업본 .tmp/senior-intro/띠/지금안.jpg · 처음안.jpg · 뒤_태오.jpg · 뒤_한유나.jpg
//   node 띠.cjs 게시판   → .tmp/senior-intro/띠2/게시판_유나끝.jpg · 게시판_태오끝.jpg · 고른뒤_<선배>_<판>.jpg
// 소리는 끄고 찍는다. 선배의 말은 화면에 글로 보인다.
const path = require('node:path'), fs = require('node:fs'), { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const { chromium } = require(path.join(뿌리, 'node_modules', 'playwright'));
const 공용 = 공용작업본(뿌리);
const 시안 = pathToFileURL(path.join(공용, '.tmp', 'senior-intro', '시안', 'index.html')).href;
// 「게시판」은 둘째 시험에 쓰는 띠다. 고친 게시판만, 고르는 보기 없이 찍어 띠2에 따로 둔다(첫 시험의 띠를 지우지 않는다).
const 모드 = process.argv[2] === '게시판' ? '게시판' : '전체';
const 밖 = path.join(공용, '.tmp', 'senior-intro', 모드 === '게시판' ? '띠2' : '띠');
fs.rmSync(밖, { recursive: true, force: true }); fs.mkdirSync(밖, { recursive: true });

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const 열기 = async (꼬리) => {
    const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    // 글꼴을 먼저 받아 둔 뒤에 연다. 글꼴이 늦으면 「일주일 뒤」 장면이 찍기 전에 지나간다.
    await page.goto(시안 + '?mute=1'); await page.evaluate(() => document.fonts.ready);
    await page.goto(시안 + 꼬리); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
    // 찍을 때는 소리를 끄지만 실제 화면은 소리가 켜진 채 열린다. 시험관이 「소리가 꺼져 있다」고 읽지 않게 단추만 켜진 꼴로 둔다.
    if (모드 === '게시판') await page.evaluate(() => document.getElementById('hud').classList.remove('muted'));
    return { ctx, page, errs };
  };
  const 장들 = {};
  const 찍 = async (page, 묶음) => { (장들[묶음] ||= []).push(await page.locator('#frame').screenshot({ type: 'jpeg', quality: 88 })); };
  const 켜짐 = (page, sel) => page.waitForFunction((s) => { const e = document.querySelector(s); return e && e.classList.contains('on'); }, sel, { timeout: 40000 });

  // ── 둘째 시험: 고친 게시판만. 줄 순서와 누른 순서를 두 가지로 찍는다(끝에 들은 선배가 단추에 뜨므로 번갈아 보인다) ──
  if (모드 === '게시판') {
    for (const [order, 첫, 둘, 이름] of [['ty', 'taeo', 'yuna', '유나끝'], ['yt', 'yuna', 'taeo', '태오끝']]) {
      const { ctx, page, errs } = await 열기(`?order=${order}&mute=1`);
      await page.waitForTimeout(3200);                                                                   // 망설일 때 뛰는 단추가 지나간 뒤
      await 찍(page, '게시판_' + 이름);                                                                    // ① 처음
      await page.click(`#L-board .row[data-k="${첫}"]`); await page.waitForTimeout(1500); await 찍(page, '게시판_' + 이름); // ② 윗줄을 누름
      await page.click(`#L-board .row[data-k="${둘}"]`); await page.waitForTimeout(1500); await 찍(page, '게시판_' + 이름); // ③ 아랫줄을 누름
      if (errs.length) console.log('게시판', 이름, '오류', errs); await ctx.close();
      for (const [k, 누구] of [['taeo', '권태오'], ['yuna', '한유나']]) {
        const o = await 열기(`?step=2&pick=${k}&order=${order}&mute=1`);
        await 켜짐(o.page, '#L-board .go'); await o.page.waitForTimeout(500); await 찍(o.page, `고른뒤_${누구}_${이름}`); // ① 포스트잇에 이름
        await o.page.click('#L-board .go'); await 켜짐(o.page, '#L-board .go'); await o.page.waitForTimeout(400); await 찍(o.page, `고른뒤_${누구}_${이름}`); // ② 서하의 한마디
        if (o.errs.length) console.log('고른뒤', 누구, '오류', o.errs); await o.ctx.close();
      }
    }
  }
  // ── 지금 안: 게시판 ──
  if (모드 === '전체') {
    const { ctx, page, errs } = await 열기('?order=ty&mute=1');
    await 찍(page, '지금안');                                                          // ① 처음
    await page.click('#L-board .row[data-k="taeo"]'); await page.waitForTimeout(1500); await 찍(page, '지금안'); // ② 태오 줄을 누름
    await page.click('#L-board .row[data-k="yuna"]'); await page.waitForTimeout(1500); await 찍(page, '지금안'); // ③ 한유나 줄을 누름
    await page.click('#L-board .go'); await page.waitForTimeout(800); await 찍(page, '지금안');               // ④ 고른 직후
    await 켜짐(page, '#L-board .go'); await page.waitForTimeout(500); await 찍(page, '지금안');               // ⑤ 포스트잇에 이름
    await page.click('#L-board .go'); await 켜짐(page, '#L-board .go'); await page.waitForTimeout(400); await 찍(page, '지금안'); // ⑥ 서하의 한마디
    if (errs.length) console.log('지금안 오류', errs); await ctx.close();
  }
  // ── 처음 안: 사진 카드 두 장 ──
  if (모드 === '전체') {
    const { ctx, page, errs } = await 열기('?v=a&order=ty&mute=1');
    await 찍(page, '처음안');                                                                             // ① 지호의 말
    await page.click('#L-a .go'); await page.waitForTimeout(900); await 찍(page, '처음안');                   // ② 서하의 물음
    await page.click('#L-a .cd[data-k="taeo"]'); await page.waitForTimeout(700); await 찍(page, '처음안');    // ③ 태오 카드
    await page.click('#L-a .cd[data-k="yuna"]'); await page.waitForTimeout(700); await 찍(page, '처음안');    // ④ 한유나 카드
    await page.click('#L-a .go'); await page.waitForTimeout(1300); await 찍(page, '처음안');                  // ⑤ 고른 뒤
    if (errs.length) console.log('처음안 오류', errs); await ctx.close();
  }
  // ── 고른 뒤: 선배마다 ──
  for (const [k, 이름] of 모드 === '전체' ? [['taeo', '뒤_태오'], ['yuna', '뒤_한유나']] : []) {
    const { ctx, page, errs } = await 열기(`?step=3&pick=${k}&mute=1`);
    await page.waitForTimeout(150); await 찍(page, 이름);                                                   // ① 일주일 뒤(2.3초 뒤 식당으로 넘어가므로 일찍 찍는다)
    await 켜짐(page, '#L-ep'); await page.waitForTimeout(2600); await 찍(page, 이름);                        // ② 선배의 첫 말
    await 켜짐(page, '#L-ep .mine'); await page.waitForTimeout(500); await 찍(page, 이름);                   // ③ 내 차례
    await page.click('#L-ep .mic'); await 켜짐(page, '#L-ep .memo'); await page.waitForTimeout(900); await 찍(page, 이름); // ④ 이름을 말하는 순간
    await 켜짐(page, '#L-ep .go'); await page.click('#L-ep .go'); await 켜짐(page, '#L-snap .go'); await page.waitForTimeout(300); await 찍(page, 이름); // ⑤ 첫 사진
    await page.click('#L-snap .go'); await 켜짐(page, '#L-td .go'); await page.waitForTimeout(300); await 찍(page, 이름); // ⑥ 「오늘」 한 장
    if (errs.length) console.log(이름, '오류', errs); await ctx.close();
  }
  await b.close();

  // 번호를 붙여 한 줄로 잇는다
  for (const [이름, bufs] of Object.entries(장들)) {
    const dir = path.join(밖, '_' + 이름); fs.mkdirSync(dir, { recursive: true });
    bufs.forEach((buf, i) => fs.writeFileSync(path.join(dir, `${i + 1}.jpg`), buf));
    const r = spawnSync('python', ['-X', 'utf8', '-c', `
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(os.path.join(d, '*.jpg')), key=lambda f: int(os.path.basename(f)[:-4]))
W = 330; ims = [Image.open(f).convert('RGB') for f in fs]; H = round(ims[0].height * W / ims[0].width)
g = Image.new('RGB', (len(ims) * (W + 14) + 14, H + 62), (255, 255, 255)); dr = ImageDraw.Draw(g)
try: font = ImageFont.truetype('malgunbd.ttf', 26)
except Exception: font = ImageFont.load_default()
for i, im in enumerate(ims):
    x = 14 + i * (W + 14); g.paste(im.resize((W, H), Image.LANCZOS), (x, 48)); dr.text((x + 2, 8), str(i + 1), fill=(20, 20, 20), font=font)
g.save(out, quality=88); print(os.path.basename(out), g.size)
`, dir, path.join(밖, `${이름}.jpg`)], { encoding: 'utf8' });
    process.stdout.write(r.stdout || r.stderr);
  }
})();
