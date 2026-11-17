// LAB 「직접 풀어 보기」 무대 시안 세 판(A 종이 문제지 · B 큰 글 · C 자막)을 한 쪽으로 짓는다.
// 쓰기: node docs/디자인/synk.im_LAB무대_20261117/만들기.mjs [--사진 new|old] [--나갈 <파일 이름>]
// 글은 공개본 원고(원고.json — 11-17 synk.im/lab/에서 떼어 냄)를 그대로 쓰고, 동작은 공개본 learner.js를 그대로 쓴다.
// 시안마다 짜임과 겉모습만 다르다. 볼 때는 저장소 뿌리에서 `node tools/지면서버.js 8765`를 띄우고 이 폴더의 시안.html을 연다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인자 = process.argv.slice(2);
const 값 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 ? 인자[i + 1] : d; };
const 사진판 = 값('--사진', 'new');
const 나갈 = 값('--나갈', 사진판 === 'new' ? '시안.html' : '시안_옛사진.html');

const Q = JSON.parse(fs.readFileSync(path.join(여기, '원고.json'), 'utf8'));
// 둘째 판(11-17 GPT 맹검 반영): 7일 뒤 칸의 앱 상태표(1 · 7 · 30일 세 칸)는 시간 자와 같은 말을 되풀이하고 대시보드 부품으로 읽혀 뺀다.
// 그 칸의 상태는 시간 자가 보인다. 「none」은 없는 조각 이름이라 learner.js가 문제 카드와 조각을 모두 숨긴다.
for (const d of Q.days) if (d.shot === 'piece-check-d7') d.shot = 'none';
const 짧은이름 = ['지금', '1분', '1일', '7일', '30일', '내 위치'];
const 조각설명 = JSON.parse(fs.readFileSync(path.join(여기, '조각설명.json'), 'utf8'));
const 맹검파일 = path.join(여기, '맹검.json');
const 맹검 = fs.existsSync(맹검파일) ? JSON.parse(fs.readFileSync(맹검파일, 'utf8')) : null;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 시간 자: 지금 0 · 1분 뒤 5% · 날 d는 12% + 76%·√(d/30) · 내 위치 100%. 날 눈금 간격이 30일 쪽으로 좁아져 1 · 7 · 30일 사이가 벌어지는 것이 보인다.
// 휴대폰(900px 이하)은 이름이 겹치지 않게 1분 뒤 10% · 날 d는 20% + 62%·√(d/30)(30일 82%)으로 띄운다.
const 날자리 = d => 12 + 76 * Math.sqrt(d / 30);
const 날자리폰 = d => 20 + 62 * Math.sqrt(d / 30);
const 단계자리 = [0, 5, 날자리(1), 날자리(7), 날자리(30), 100];
const 단계자리폰 = [0, 10, 날자리폰(1), 날자리폰(7), 날자리폰(30), 100];

function 사진(cls = '') {
  const 이름 = ['now', 'morning', 'rain', 'snow'];
  return 이름.map((n, i) => `<img data-photo="class-${n}" src="assets/photo/${사진판}/class-${n}.webp" alt="" width="1600" height="885" class="sv-photo${i === 0 ? ' is-on' : ''}${cls}" decoding="async">`).join('');
}
function 문제(창 = '') {
  const 장면 = 창 ? `<p class="sv-ctxline">${창}<span class="sv-context" data-context lang="ko"></span></p>` : `<p class="sv-context" data-context lang="ko"></p>`;
  return `<div class="lw-piece sv-quiz" data-quiz>
  <div class="sv-qtop"><span data-qhead lang="ko"></span><span data-qcount></span></div>
  <i class="sv-qbar" aria-hidden="true"><b data-qbar></b></i>
  ${장면}
  <p class="sv-prompt" data-prompt lang="ko"></p>
  <div class="sv-choices" data-choices lang="ko"></div>
</div>`;
}
function 조각() {
  const 크기 = { 'piece-tutor-review': [732, 239], 'piece-evidence': [780, 577] };
  return Object.keys(크기).map(n => `<figure class="lw-piece sv-shot" data-shot="${n}" hidden><img src="assets/shots/${n}.webp" alt="${esc(조각설명[n])}" width="${크기[n][0]}" height="${크기[n][1]}" decoding="async"></figure>`).join('\n');
}
// 때(data-when)는 시간 자 위에 크게 둔다(둘째 판). 글 칸에는 말과 덧말만.
function 글() {
  return `<div class="sv-copy" aria-live="polite"><p class="sv-say" data-say></p><p class="sv-sub" data-sub></p></div>`;
}
function 누를곳() { return `<div class="sv-next" data-next></div>`; }
function 머리(v) {
  return `<p class="sv-label">SYNK WORLD · 직접 풀어 보기</p>
<h2 class="sv-title" id="t-${v}"><span>한 문제만 풀어 보세요</span> <span>30일을 빨리 감아 드립니다</span></h2>`;
}
function 자() {
  const 눈금 = ['<i class="is-major" style="--x:0%;--xm:0%"></i>', '<i style="--x:5%;--xm:10%"></i>'];
  for (let d = 1; d <= 30; d++) 눈금.push(`<i${[1, 7, 30].includes(d) ? ' class="is-major"' : ''} style="--x:${날자리(d).toFixed(2)}%;--xm:${날자리폰(d).toFixed(2)}%"></i>`);
  const 단계 = Q.steps.map((s, i) => `<li style="--x:${단계자리[i].toFixed(2)}%;--xm:${단계자리폰[i].toFixed(2)}%"><i aria-hidden="true"></i><span data-s="${esc(짧은이름[i])}">${esc(s)}</span></li>`).join('');
  return `<div class="sv-rail"><p class="sv-day" data-when aria-live="polite"></p><div class="sv-ticks" aria-hidden="true"><b class="sv-fill"></b>${눈금.join('')}</div><ol class="sv-steps" data-steps>${단계}</ol></div>`;
}
function 꼬리() {
  return `<a class="sv-why" href="https://synk.im/atlas/#learner-why">왜 이렇게 만들었나 <span aria-hidden="true">→</span></a>`;
}
const 각주 = `<p class="sv-note">실제 첫 레슨의 문제와 SYNK WORLD 화면 · 예시 학습자의 30일</p>`;
const 자료 = `<script type="application/json" data-try-data>${JSON.stringify(Q)}</script>`;

const 판 = {
  // A 종이 문제지 — 사진이 구역을 덮고, 문제는 종이 한 장 위에. 때 · 피드백 · 다음 단추도 그 종이 안에 있어 누를 곳이 한 자리다.
  a: () => `<section class="sv sv-a" id="sv-a" aria-labelledby="t-a" data-try>${자료}
<div class="sv-photos">${사진()}</div>
<div class="sv-head">${머리('a')}</div>
${꼬리()}
<div class="sv-sheet">${문제()}
${조각()}
<div class="sv-sheet-foot">${글()}${누를곳()}</div></div>
<div class="sv-bottom">${자()}${각주}</div>
</section>`,
  // B 큰 글 — 밝은 바탕에 장면 한 줄과 보기 세 낱말을 크게. 사진은 장면 줄 앞의 작은 창.
  b: () => `<section class="sv sv-b" id="sv-b" aria-labelledby="t-b" data-try>${자료}
<div class="sv-top"><div>${머리('b')}</div>${꼬리()}</div>
<div class="sv-center">
<div class="sv-scene">${문제(`<span class="sv-pill" aria-hidden="true">${사진()}</span>`)}</div>
${조각()}
<div class="sv-after"><span class="sv-pill sv-pill--day" aria-hidden="true">${사진(' sv-mirror')}</span>${글()}${누를곳()}</div>
</div>
<div class="sv-bottom">${자()}${각주}</div>
</section>`,
  // C 자막 — 사진이 구역을 덮고, 카드 없이 물음과 보기가 영화 자막처럼 아래에. 앱 화면은 끼워 넣은 장면처럼 가운데에.
  c: () => `<section class="sv sv-c" id="sv-c" aria-labelledby="t-c" data-try>${자료}
<div class="sv-photos">${사진()}</div>
<div class="sv-head">${머리('c')}</div>
${꼬리()}
<div class="sv-insert">${조각()}</div>
<div class="sv-subs">${문제()}${글()}${누를곳()}</div>
<div class="sv-bottom">${자()}${각주}</div>
</section>`,
};

const 설명 = {
  a: ['A · 종이 문제지', '교실 사진이 구역 전체를 덮습니다. 문제는 어두운 카드 대신 종이 한 장 위에 놓이고, 물음은 학습지처럼 명조로 씁니다. 맞았는지와 다음으로 가는 단추도 같은 종이 안에 있습니다.'],
  b: ['B · 큰 글', '밝은 바탕에 장면 한 줄과 보기 세 낱말을 크게 씁니다. 교실 사진은 장면 줄 앞의 작은 창이 되어 그날 장면을 당겨 보여 주고, 날이 바뀔 때마다 그 창의 사진도 바뀝니다.'],
  c: ['C · 자막', '교실 사진이 구역 전체를 덮고, 카드 없이 물음과 보기가 영화 자막처럼 아래에 놓입니다. LAB 첫 화면의 상황극과 같은 말투입니다.'],
};

function 맹검표() {
  if (!맹검) return '';
  const 줄 = 맹검.줄.map(r => `<tr><th scope="row">${esc(r.판)}</th>${r.점수.map(x => `<td>${esc(x)}</td>`).join('')}<td class="w">${esc(r.한줄)}</td></tr>`).join('');
  return `<section class="pg-blind" id="blind"><h2>맹검 점수</h2><p>${esc(맹검.설명)}</p>
<div class="pg-tablewrap"><table><thead><tr><th scope="col">판</th>${맹검.칸.map(c => `<th scope="col">${esc(c)}</th>`).join('')}<th scope="col">가장 크게 짚은 것</th></tr></thead><tbody>${줄}</tbody></table></div></section>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LAB 무대 시안</title>
<meta name="description" content="synk.im LAB 「직접 풀어 보기」 구역의 무대 시안 세 판과 교실 사진 연작">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700&display=swap">
<link rel="stylesheet" href="시안.css">
</head>
<body>
<header class="pg-head">
<p class="pg-kicker">synk.im LAB · 「직접 풀어 보기」 구역 시안</p>
<h1>세 판 가운데 하나를 골라 주세요</h1>
<p>글과 동작은 지금 공개본 그대로입니다. 짜임, 겉모습, 교실 사진, 시간 줄만 바꿨습니다. 판마다 문제를 직접 풀고 30일 뒤까지 넘겨 보실 수 있습니다.</p>
${맹검?.추천 ? `<p class="pg-pick"><strong>추천 · B 큰 글</strong> ${esc(맹검.추천.replace(/^B 큰 글을 추천합니다\.\s*/, ''))}</p>` : ''}
<nav class="pg-nav" aria-label="시안 차례"><a href="#now">지금 공개본</a><a href="#sv-a">A 종이 문제지</a><a href="#sv-b">B 큰 글</a><a href="#sv-c">C 자막</a><a href="#photos">교실 사진</a>${맹검 ? '<a href="#blind">맹검 점수</a>' : ''}</nav>
</header>
<section class="pg-now" id="now"><div class="pg-cap"><h2>지금 공개본</h2><p>왼쪽 검은 설명 칸과 오른쪽 교실 사진 위 문제 카드로 나뉜 짜임입니다. 2026년 11월 17일 synk.im/lab/에서 찍었습니다.</p></div>
<div class="pg-shots"><img src="assets/live/live-start-1440.jpg" alt="지금 공개본 첫 화면" loading="lazy"><img src="assets/live/live-day30-1440.jpg" alt="지금 공개본 30일 뒤" loading="lazy"></div></section>
${['a', 'b', 'c'].map(v => `<div class="pg-cap" id="cap-${v}"><h2>${설명[v][0]}</h2><p>${설명[v][1]}</p></div>\n${판[v]()}`).join('\n')}
<section class="pg-photos" id="photos"><div class="pg-cap"><h2>교실 사진 연작</h2><p>책상 위 소품(목도리 · 연필 · 글자 없는 책 · 컵)을 모두 뺐습니다. 대신 그날 문제의 장면을 사진 속 사람들이 합니다. 첫날은 선생님과 새로 온 학생이 인사하고, 30일 뒤에는 옆자리 친구가 떨어진 책을 주워 줍니다. 칠판은 늘 비어 있고, 사진 속에 글은 하나도 없습니다.</p></div>
<div class="pg-grid">${['now', 'morning', 'rain', 'snow'].map((n, i) => `<figure><img src="assets/photo/new/class-${n}.webp" alt="" loading="lazy"><figcaption>${['처음 만난 날', '다음 날 아침', '7일 뒤 · 비', '30일 뒤 · 첫눈'][i]}</figcaption></figure>`).join('')}</div>
<div class="pg-cap pg-old"><h3>지금 공개본의 교실 연작</h3></div>
<div class="pg-grid pg-grid--old">${['now', 'morning', 'rain', 'snow'].map(n => `<figure><img src="assets/photo/old/class-${n}.webp" alt="" loading="lazy"></figure>`).join('')}</div></section>
${맹검표()}
<footer class="pg-foot"><p>시안입니다. 공개본에는 아무것도 바꾸지 않았습니다.</p></footer>
<script src="assets/js/learner.js"></script>
<script>
// 시간 자에 답의 자국을 남긴다(시안 몫 — learner.js는 그대로). 답을 고른 그 칸에 맞음 · 틀림, 처음부터 다시 하면 지운다.
for (const root of document.querySelectorAll('[data-try]')) {
  const lis = [...root.querySelectorAll('[data-steps] li')];
  root.addEventListener('click', e => {
    if (e.target.closest('.lw-again')) { lis.forEach(li => delete li.dataset.mark); return; }
    const b = e.target.closest('.lwq-choice');
    if (!b) return;
    const now = lis.find(li => li.classList.contains('is-now'));
    if (now) now.dataset.mark = b.classList.contains('is-right') ? 'right' : 'wrong';
  });
}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(여기, 나갈), html);
console.log('지음', 나갈, html.length, 'bytes');

// --아티팩트 <폴더>: claude.ai 페이지로 올릴 판. 문서 뼈대(doctype · html · head · body)를 벗기고, CSS를 쪽 안에 넣고 글꼴을 data URI로 심는다.
// 사진 · 조각 · 공개본 캡처 · learner.js는 같은 상대 경로로 그 폴더에 모은다(올릴 때 files로 함께 낸다).
const 판폴더 = 값('--아티팩트', null);
if (판폴더) {
  const 밖 = path.resolve(판폴더);
  fs.mkdirSync(밖, { recursive: true });
  let css = fs.readFileSync(path.join(여기, '시안.css'), 'utf8');
  css = css.replace(/url\('assets\/fonts\/([^']+)'\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(여기, 'assets', 'fonts', f)).toString('base64')})`);
  css = css.replace('color-scheme:light;', 'color-scheme:dark;');
  const 몸 = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).trim();
  const 쪽 = `<title>LAB 무대 시안</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700&display=swap">\n<style>${css}</style>\n${몸}\n`;
  fs.writeFileSync(path.join(밖, 'index.html'), 쪽);
  const 옮길 = [];
  for (const d of ['assets/photo/new', 'assets/photo/old', 'assets/shots', 'assets/live', 'assets/js']) {
    for (const f of fs.readdirSync(path.join(여기, d))) {
      fs.mkdirSync(path.join(밖, d), { recursive: true });
      fs.copyFileSync(path.join(여기, d, f), path.join(밖, d, f));
      옮길.push(`${d}/${f}`);
    }
  }
  fs.writeFileSync(path.join(밖, 'files.json'), JSON.stringify(Object.fromEntries(옮길.map(p => [p, path.join(밖, p).replace(/\\/g, '/')])), null, 1));
  console.log('아티팩트 판', 밖, Math.round(쪽.length / 1024), 'KB +', 옮길.length, '파일');
}
