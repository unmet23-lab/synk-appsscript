#!/usr/bin/env node
'use strict';
/**
 * 꿈 무대 엔딩 여덟째 판(2026-11-20) — 엔딩의 정지 카드를 화면 크기(1280×720, 2배 밀도) 투명 PNG로 조판한다.
 * 유호님 11-20 「디자인 사이트 크롤링해서 … 엔딩 마무리 트렌디하게」에 따른 조사(README 「엔딩 여덟째 판」)를 옮겼다.
 *   - 흐르는 크레딧 대신 정지 카드. 이름은 Noto Serif KR 600, 역할은 SUIT 500. 글자는 순백 대신 오프화이트이고,
 *     역할도 회색으로 묻지 않는다(DESIGN 3절 「읽혀야 할 말을 회색으로 물리지 않는다」). 줄 그은 틀린 말만 한 단계 낮춘다.
 *   - 크기는 화면 높이 기준 제목 7% · 주연 이름 5.5% · 출연 이름 4.7% · 역할 2.9% · 작은 글 2.8%다.
 * 한 카드 안에서 따로 움직이는 글(「이 영화에 쓰인 말」의 블록, 그어지는 줄, 고친 말)은 같은 자리에 층마다 한 장씩 뽑는다.
 *
 *   node 엔딩카드.cjs <밖 폴더> --로고 <평면 로고.png> [--말 mn | --세로]
 *   (원고는 엔딩원고.cjs의 「판8」, 로고는 엔딩로고.py가 만든 평면 판)
 * --말 mn: 엄마 모국어 자막판(11-21). 역할 · 설명은 원고 「번역.mn」으로 바꾸고, 학생 이름과 「이 영화에 쓰인 말」의 한국어 말은
 *   그대로 둔 채 그 아래에 뜻을 단다. 들리는 말의 자막(자막_1 …)도 같은 폴더에 뽑는다. 몽골어는 Inter Tight 500에
 *   1.04배 광학 보정이다(브랜드 폰트 정본 「몽골어 광학 보정」).
 * --세로: 9:16 세로판(1080×1920, 1배 밀도). 사진은 위, 크레딧은 사진 아래 가운데에 둔다(엔딩세로.py가 같은 자리를 쓴다).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const 인자 = process.argv.slice(2);
const 밖 = path.resolve(인자[0]);
const 로고 = path.resolve(인자[인자.indexOf('--로고') + 1]);
const 원고 = require('./엔딩원고.cjs').판8;
const 세로 = 인자.includes('--세로');
const 말 = 인자.includes('--말') ? 인자[인자.indexOf('--말') + 1] : null;
const 번 = 말 ? 원고.번역[말] : null;
if (말 && !번) throw new Error(`원고에 「번역.${말}」이 없다`);
const 뿌리 = path.resolve(__dirname, '..', '..', '..', '..');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const 명조 = b64('C:/Windows/Fonts/NotoSerifKR-VF.ttf');
const 수트 = b64(path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2'));
const 인터 = 말 ? b64(path.join(뿌리, 'docs', '브랜드_폰트', 'InterTight', 'InterTight-Medium.ttf')) : null;
const 막 = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const 머리 = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"M";src:url(data:font/ttf;base64,${명조}) format("truetype");font-weight:200 900}
@font-face{font-family:"S";src:url(data:font/woff2;base64,${수트}) format("woff2");font-weight:100 900}
:root{--이름:#E6DFD2;--역:#C2BBAF;--틀:#9C968C}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;background:transparent;overflow:hidden}
body{color:var(--이름);-webkit-font-smoothing:antialiased;font-family:"S"}
.판{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.역{font:500 21px "S";letter-spacing:.06em;color:var(--역)}
.이{font:600 34px "M";letter-spacing:.03em;color:var(--이름)}
.작{font:500 20px "S";letter-spacing:.04em;color:var(--역);line-height:1.5}
.덧{font:400 20px "S";letter-spacing:.02em;color:var(--역);line-height:1.5}
.제목{font:600 50px "M";letter-spacing:.02em;padding-bottom:24px}
.오른{position:absolute;left:780px;top:0;bottom:0;width:460px;display:flex;flex-direction:column;justify-content:center}
.쌍+.쌍{margin-top:30px}
.쌍 .이{margin-top:6px}
.블{text-align:center}
.블+.블{margin-top:34px}
.블 .말{font:600 32px "M";letter-spacing:.02em;margin:6px 0 4px}
.틀{position:relative;color:var(--틀)}
.줄{position:absolute;left:-2px;right:-2px;top:54%;height:2px;background:var(--틀)}
.화살{font:300 28px "M";color:var(--역);margin:0 .4em}
.표{display:grid;grid-template-columns:auto auto;column-gap:22px;row-gap:12px;align-items:baseline}
.표 .역{text-align:right}
.표 .이{font-size:26px}
[data-층]{visibility:var(--보임,visible)}
</style>` + (세로 ? `<style>
html,body{width:1080px;height:1920px}
.역{font-size:36px}
.이{font-size:58px}
.작{font-size:34px}
.덧{font-size:32px}
.제목{font-size:104px;padding-bottom:40px}
.아래{position:absolute;left:60px;right:60px;top:1150px;height:300px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center}
.쌍+.쌍{margin-top:34px}
.블{max-width:960px}
.블+.블{margin-top:64px}
.블 .말{font-size:48px;margin:10px 0 6px;line-height:1.35}
.줄{height:3px}
.화살{font-size:40px}
.표{column-gap:30px;row-gap:18px}
.표 .이{font-size:44px}
</style>` : '') + (말 ? `<style>
@font-face{font-family:"IT";src:url(data:font/ttf;base64,${인터}) format("truetype");font-weight:500}
.몽{font-family:"IT";font-weight:500}
.몽역{font:500 22px "IT";letter-spacing:.02em;color:var(--역)}
.몽작{font:500 20px "IT";letter-spacing:.03em;color:var(--역);line-height:1.5}
.몽말{font:500 23px "IT";letter-spacing:.01em;color:var(--이름);line-height:1.45;margin-top:2px}
.표 .몽역{text-align:right}
.표 .몽값{font:500 27px "IT";color:var(--이름)}
.자막판{position:absolute;left:0;right:0;bottom:42px;display:flex;justify-content:center}
.자막{font:500 30px "IT";color:#EFE9DE;text-align:center;line-height:1.36;letter-spacing:.005em;max-width:1120px;
  text-shadow:0 0 10px rgba(0,0,0,.65),0 1px 2px rgba(0,0,0,.95)}
</style>` : '');

const 카드 = {};
if (번) {
  const 몽 = (k) => (k in 번 ? 번[k] : k);
  카드.제목 = `<div class="판"><div data-층="글" style="text-align:center"><div class="제목" style="padding-bottom:12px">${막(원고.제목)}</div><div class="몽역" style="font-size:25px;letter-spacing:.05em">${막(번.제목)}</div></div></div>`;
  카드.주연 = `<div class="판" data-층="글"><div class="몽역">${막(번.주연)}</div><div class="이" style="font-size:40px;margin-top:12px">${막(원고.주연)}</div></div>`;
  원고.출연.forEach((쌍들, i) => {
    카드[`출연_${i + 1}`] = `<div class="오른" data-층="글">${쌍들.map(([역, 이]) => `<div class="쌍"><div class="몽역">${막(몽(역))}</div><div class="이">${막(이)}</div>${이 in 번 ? `<div class="몽역" style="margin-top:4px">${막(번[이])}</div>` : ''}</div>`).join('')}</div>`;
  });
  카드.특별출연 = `<div class="오른" data-층="글"><div class="쌍"><div class="몽역">${막(번.특별출연)}</div><div class="이" style="font-size:40px">${막(원고.특별출연)}</div><div class="몽" style="font-size:31px;margin-top:6px">${막(번[원고.특별출연])}</div></div></div>`;
  카드.쓰인말 = `<div class="판"><div data-층="머리" style="text-align:center;margin-bottom:30px"><div class="작" style="letter-spacing:.24em">이 영화에 쓰인 말</div><div class="몽역" style="margin-top:4px;letter-spacing:.06em">${막(번['이 영화에 쓰인 말'])}</div></div>${원고.쓰인말.map((b, i) => {
    const 한 = b.틀린
      ? `<span class="틀">${막(b.틀린)}<span class="줄" data-층="${i + 1}줄"></span></span><span data-층="${i + 1}고침"><span class="화살">→</span>${막(b.말)}</span>`
      : 막(b.말);
    const 뜻 = `<div class="몽말"${b.틀린 ? ` data-층="${i + 1}고침"` : ''}>${막(몽(b.말))}</div>`;

    return `<div class="블" data-층="${i + 1}" style="margin-top:${i ? 28 : 0}px"><div class="몽작">${막(몽(b.때))}</div><div class="말">${한}</div>${뜻}<div class="몽작">${막(몽(b.덧))}</div></div>`;
  }).join('')}</div>`;
  카드.마지막 = `<div class="판" data-층="글"><div class="표">${원고.마지막.map(([역, 이]) => `<div class="몽역">${막(역 ? 몽(역) : '')}</div>${이 in 번 ? `<div class="몽값">${막(번[이])}</div>` : `<div class="이">${막(이)}</div>`}`).join('')}</div>
<div class="몽작" style="letter-spacing:.2em;margin-top:46px">${막(번[원고.제작])}</div><img src="data:image/png;base64,${b64(로고)}" style="height:34px;margin-top:12px"></div>`;
  번.자막.forEach((글, i) => {
    카드[`자막_${i + 1}`] = `<div class="자막판" data-층="글"><div class="자막">${글.split('\n').map(막).join('<br>')}</div></div>`;
  });
} else if (세로) {
  카드.제목 = `<div class="판"><div class="제목" data-층="글">${막(원고.제목)}</div></div>`;
  카드.주연 = `<div class="판" data-층="글"><div class="역">주연</div><div class="이" style="font-size:72px;margin-top:18px">${막(원고.주연)}</div></div>`;
  원고.출연.forEach((쌍들, i) => {
    카드[`출연_${i + 1}`] = `<div class="아래" data-층="글">${쌍들.map(([역, 이]) => `<div class="쌍"><div class="역">${막(역)}</div><div class="이" style="margin-top:8px">${막(이)}</div></div>`).join('')}</div>`;
  });
  카드.특별출연 = `<div class="아래" data-층="글"><div class="쌍"><div class="역">특별출연</div><div class="이" style="font-size:72px;margin-top:10px">${막(원고.특별출연)}</div></div></div>`;
  카드.쓰인말 = `<div class="판"><div class="작" data-층="머리" style="letter-spacing:.24em;margin-bottom:64px">이 영화에 쓰인 말</div>${원고.쓰인말.map((b, i) => {
    const 말글 = b.틀린
      ? `<span class="틀">${막(b.틀린)}<span class="줄" data-층="${i + 1}줄"></span></span><br><span data-층="${i + 1}고침"><span class="화살">→</span>${막(b.말)}</span>`
      : 막(b.말);
    return `<div class="블" data-층="${i + 1}"><div class="작">${막(b.때)}</div><div class="말">${말글}</div><div class="덧">${막(b.덧)}</div></div>`;
  }).join('')}</div>`;
  카드.마지막 = `<div class="판" data-층="글"><div class="표">${원고.마지막.map(([역, 이]) => `<div class="역">${막(역)}</div><div class="이">${막(이)}</div>`).join('')}</div>
<div class="작" style="letter-spacing:.24em;margin-top:80px">${막(원고.제작)}</div><img src="data:image/png;base64,${b64(로고)}" style="height:52px;margin-top:18px"></div>`;
} else {
카드.제목 = `<div class="판"><div class="제목" data-층="글">${막(원고.제목)}</div></div>`;
카드.주연 = `<div class="판" data-층="글"><div class="역">주연</div><div class="이" style="font-size:40px;margin-top:12px">${막(원고.주연)}</div></div>`;
원고.출연.forEach((쌍들, i) => {
  카드[`출연_${i + 1}`] = `<div class="오른" data-층="글">${쌍들.map(([역, 이]) => `<div class="쌍"><div class="역">${막(역)}</div><div class="이">${막(이)}</div></div>`).join('')}</div>`;
});
카드.특별출연 = `<div class="오른" data-층="글"><div class="쌍"><div class="역">특별출연</div><div class="이" style="font-size:40px">${막(원고.특별출연)}</div></div></div>`;
카드.쓰인말 = `<div class="판"><div class="작" data-층="머리" style="letter-spacing:.24em;margin-bottom:40px">이 영화에 쓰인 말</div>${원고.쓰인말.map((b, i) => {
  const 말 = b.틀린
    ? `<span class="틀">${막(b.틀린)}<span class="줄" data-층="${i + 1}줄"></span></span><span data-층="${i + 1}고침"><span class="화살">→</span>${막(b.말)}</span>`
    : 막(b.말);
  return `<div class="블" data-층="${i + 1}"><div class="작">${막(b.때)}</div><div class="말">${말}</div><div class="덧">${막(b.덧)}</div></div>`;
}).join('')}</div>`;
카드.마지막 = `<div class="판" data-층="글"><div class="표">${원고.마지막.map(([역, 이]) => `<div class="역">${막(역)}</div><div class="이">${막(이)}</div>`).join('')}</div>
<div class="작" style="letter-spacing:.24em;margin-top:46px">${막(원고.제작)}</div><img src="data:image/png;base64,${b64(로고)}" style="height:34px;margin-top:12px"></div>`;
}

(async () => {
  fs.mkdirSync(밖, { recursive: true });
  const 브 = await chromium.launch({ channel: 'chrome' });
  const 쪽 = await 브.newPage(세로 ? { viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const 쓴것 = [];
  for (const [이름, 몸] of Object.entries(카드)) {
    await 쪽.setContent(머리 + 몸);
    await 쪽.evaluate(() => document.fonts.ready);
    const 층들 = await 쪽.evaluate(() => [...new Set([...document.querySelectorAll('[data-층]')].map((e) => e.dataset.층))]);
    for (const 층 of 층들) {
      // 이 층만 보이고 나머지는 자리만 지킨다(visibility) — 층마다 같은 자리에 놓인다
      await 쪽.evaluate((층) => document.querySelectorAll('[data-층]').forEach((e) => e.style.setProperty('--보임', e.dataset.층 === 층 ? 'visible' : 'hidden')), 층);
      const 파일 = path.join(밖, 층 === '글' ? `${이름}.png` : `${이름}_${층}.png`);
      await 쪽.screenshot({ path: 파일, omitBackground: true });
      쓴것.push(path.basename(파일));
    }
  }
  await 브.close();
  console.log(JSON.stringify({ 밖, 쓴것 }));
})().catch((e) => { console.error(e); process.exit(1); });
