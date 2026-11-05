// 끝 화면 이름 층(11-06 「霜の肌理」) — HTML로 짜서 크롬으로 투명 PNG를 뽑는다(후반 가이드 「글자는 HTML 층을 크롬으로 투명 PNG로」).
// 유호님이 고른 시안(키트 썸네일_글꼴시안_20261105/sian2/이름/일본어판.py 끝 화면)과 같은 값: 한자 142 px · 「の」 0.72배 · 로마자 0.26배 자간 .22em ·
// 아래 한 줄 34 px, 이름 묶음 위 끝 = 화면 높이 26.5 % − 120 px. 잇기15.py name_layer가 이 PNG를 읽는다.
// 「の」 양옆 여백은 −.04em — 시안의 +.04em은 단어 자간과 겹쳐 の 양옆이 다른 글자 사이의 1.5배였다(11-06 Fable 실측 14 · 14 · 9 px).
// −.04em에서 세 사이가 18 · 19 · 18 px(142 px 글자)로 같아진다.
//   node 이름층.cjs   → <밖>/결정/이름층_ja.png (1080 × 1920)
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/Documents/SYNK-appsscript/node_modules/playwright');
const 밖 = path.join(process.env.USERPROFILE, 'Documents/synk-vendor/pulse-season4-20261025/콘티/holiday-giftset/새컨셉/결정');
const F = path.join(process.env.USERPROFILE, 'Documents/synk-vendor/fonts/shippori');
const u = (p) => pathToFileURL(p).href;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Ship;src:url('${u(path.join(F, 'ShipporiMincho-Regular.ttf'))}');font-weight:400}
@font-face{font-family:Ship;src:url('${u(path.join(F, 'ShipporiMincho-Medium.ttf'))}');font-weight:500}
html,body{margin:0;background:transparent}
#c{width:1080px;height:1920px;position:relative}
.mark{position:absolute;left:0;right:0;top:${1920 * 0.265 - 120}px;display:flex;flex-direction:column;align-items:center;font-family:Ship}
.wm{display:flex;align-items:baseline;line-height:1;white-space:nowrap;font-weight:500;font-size:142px;letter-spacing:.04em;color:#F3EDE2}
.wm .no{font-size:.72em;margin:0 -.04em}
.roma{font-weight:400;font-size:37px;letter-spacing:.22em;margin:23px 0 0 .22em;line-height:1;white-space:nowrap;color:#E9E1D2}
.sub{font-weight:400;font-size:34px;letter-spacing:.02em;margin-top:34px;line-height:1;white-space:nowrap;color:#CDBF9F}
</style><div id="c"><div class="mark"><div class="wm">霜<span class="no">の</span>肌理</div><div class="roma">SHIMO NO KIME</div><div class="sub">美容液とクリームのホリデーコフレ</div></div></div>`;
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  // about:blank에서는 file:// 글꼴이 안 실린다 — 파일로 써서 연다
  const tmp = path.join(require('node:os').tmpdir(), 'synk-이름층-ja.html');
  require('node:fs').writeFileSync(tmp, html, 'utf8');
  await p.goto(u(tmp), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const ok = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
  if (ok < 2) throw new Error('글꼴을 못 실음 ' + ok);
  const out = path.join(밖, '이름층_ja.png');
  await (await p.$('#c')).screenshot({ path: out, omitBackground: true });
  console.log('저장', out, '글꼴', ok);
  await b.close();
})();
