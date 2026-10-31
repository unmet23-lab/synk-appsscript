// Y29 영상에 쓸 실험 화면을 다시 찍는다 — node 자료/폰찍기.mjs  (편 폴더에서)
// 네 판(기준 · 한줄B는 Y5 10-25 실험, 한줄D · 한줄E는 이 편 10-31 실험)의 HTML 28개를
//   · 휴대폰 첫 화면 390×844 · 2배 → remotion/public/shot/<판>/<이름>.png
//   · 끝 장면 한 장만 휴대폰 전체 390 폭 · 3배 → remotion/public/shot/끝_<이름>.png
// 으로 찍는다. AI가 지어낸 사람 이름(세무사 화면의 「한서윤」 · 「韓瑞允」 · 「김도윤」)은 찍기 전에 그 글자만 흐린다(Y5와 같은 「흐림 사본」).
// 원본 HTML은 고치지 않는다(페이지 안에서만 흐림을 씌우고 찍는다).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const 편 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const 루트 = path.resolve(편, '../../..');
const { chromium } = require(path.join(루트, 'node_modules/playwright'));

const Y5 = path.join(루트, 'docs/마케팅/yuhobuilds_AI화면한줄_20261025/자료/실험');
const 판들 = {
  기준: path.join(Y5, '기준'),
  한줄B: path.join(Y5, '한줄B'),
  한줄D: path.join(편, '자료/실험/한줄D'),
  한줄E: path.join(편, '자료/실험/한줄E'),
};
const 이름들 = ['꽃집_s_1', '빵집_s_1', '빵집_s_2', '세무사_s_1', '세무사_s_2', '필라테스_s_1', '필라테스_s_2'];
const 끝 = [['한줄E', '세무사_s_1']]; // 끝 장면(빨간 우체통 세무사) — 전체 높이로
const 흐릴이름 = /한\s*서\s*윤|韓\s*瑞\s*允|김\s*도\s*윤/g;

const 밖 = path.join(편, 'remotion/public/shot');

// 페이지 안: 사람 이름 글자만 span으로 감싸고, 그 자리 위에 흐림 덮개(backdrop-filter)를 얹는다. 감싼 수를 돌려준다.
// span에 filter만 주면 금색 글자(background-clip: text — 부모 배경을 글자 모양으로 오림)는 안 흐려진다(10-31 한줄D 세무사 ① 큰 제목).
const 흐리기 = (패턴) => {
  const re = new RegExp(패턴, 'g');
  const 걷기 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const 마디들 = [];
  while (걷기.nextNode()) if (re.test(걷기.currentNode.nodeValue)) 마디들.push(걷기.currentNode);
  let n = 0;
  for (const 마디 of 마디들) {
    const 글 = 마디.nodeValue;
    const 조각 = document.createDocumentFragment();
    let k = 0;
    re.lastIndex = 0;
    for (let m; (m = re.exec(글)); ) {
      조각.append(글.slice(k, m.index));
      const s = document.createElement('span');
      s.textContent = m[0];
      s.dataset.흐림 = '1';
      조각.append(s);
      k = m.index + m[0].length;
      n++;
    }
    조각.append(글.slice(k));
    마디.replaceWith(조각);
  }
  for (const s of document.querySelectorAll('[data-흐림]')) {
    const r = s.getBoundingClientRect();
    if (!r.width) continue;
    const px = parseFloat(getComputedStyle(s).fontSize) || 16;
    const d = document.createElement('div');
    const pad = Math.round(px * 0.12);
    Object.assign(d.style, {
      position: 'absolute',
      left: `${r.left + scrollX - pad}px`,
      top: `${r.top + scrollY - pad}px`,
      width: `${r.width + 2 * pad}px`,
      height: `${r.height + 2 * pad}px`,
      backdropFilter: `blur(${Math.max(3, px * 0.28)}px)`,
      webkitBackdropFilter: `blur(${Math.max(3, px * 0.28)}px)`,
      zIndex: '2147483647',
      pointerEvents: 'none',
      borderRadius: `${pad}px`,
    });
    document.documentElement.append(d);
  }
  return n;
};

const 브라우저 = await chromium.launch({ channel: 'chrome' });
const 찍기 = async (파일, 출력, { 전체 = false, 배율 = 2 } = {}) => {
  const 쪽 = await 브라우저.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 배율 });
  await 쪽.goto(pathToFileURL(파일).href, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await 쪽.waitForTimeout(1500);
  const n = await 쪽.evaluate(흐리기, 흐릴이름.source);
  // 등장 움직임 · 깜빡임이 있는 화면이 있어 한 번 더 쉬고 찍는다.
  await 쪽.waitForTimeout(800);
  fs.mkdirSync(path.dirname(출력), { recursive: true });
  await 쪽.screenshot({ path: 출력, fullPage: 전체 });
  await 쪽.close();
  return n;
};

let 합 = 0;
for (const [판, 폴더] of Object.entries(판들)) {
  for (const 이름 of 이름들) {
    const n = await 찍기(path.join(폴더, `${이름}.html`), path.join(밖, 판, `${이름}.png`));
    합 += n;
    console.log(`찍음 ${판}/${이름}${n ? ` · 이름 흐림 ${n}곳` : ''}`);
  }
}
for (const [판, 이름] of 끝) {
  const n = await 찍기(path.join(판들[판], `${이름}.html`), path.join(밖, `끝_${이름}.png`), { 전체: true, 배율: 3 });
  console.log(`찍음 끝_${이름}(전체 · 3배)${n ? ` · 이름 흐림 ${n}곳` : ''}`);
}
await 브라우저.close();
console.log(`끝 — 이름 흐림 모두 ${합}곳`);
