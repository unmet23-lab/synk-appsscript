// LAB 「직접 풀어 보기」 B 큰 글의 움직이는 판(2026-11-18)을 한 쪽으로 짓는다.
// 유호님 11-18: 「b로 짓되 전부 모션그래픽으로 보는 재미나 하는 재미가 있게 누르는 효과같은거 신경써서 만들어줘. 이대로 사진형태로 나가면 100% 슬롭이고 최악이야」
// 사진은 하나도 쓰지 않는다. 그날의 빛과 날씨는 캔버스가 그리고(assets/js/lw-motion.js), 글과 동작은 공개본 원고(원고.json) · 공개본 learner.js 그대로다.
// 쓰기: node docs/디자인/synk.im_LAB무대_20261117/만들기_모션.mjs [--아티팩트 <폴더>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인자 = process.argv.slice(2);
const 값 = (k, d) => { const i = 인자.indexOf(k); return i >= 0 ? 인자[i + 1] : d; };

const Q = JSON.parse(fs.readFileSync(path.join(여기, '원고.json'), 'utf8'));
// 7일 뒤 칸의 앱 상태표는 시간 줄과 같은 말을 되풀이해 뺐다(11-17 둘째 판). 그 자리에는 뒤집어 보는 카드(lw-motion.js)가 선다.
for (const d of Q.days) if (d.shot === 'piece-check-d7') d.shot = 'none';
const 조각설명 = JSON.parse(fs.readFileSync(path.join(여기, '조각설명.json'), 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 시간 줄 자리: 지금 0 · 1분 뒤 5% · 날 d는 12% + 76%·√(d/30) · 내 위치 100%(휴대폰은 1분 뒤 14% · 날 d는 24% + 58%·√(d/30)).
const 날자리 = d => 12 + 76 * Math.sqrt(d / 30);
const 날자리폰 = d => 24 + 58 * Math.sqrt(d / 30);
const 단계자리 = [0, 5, 날자리(1), 날자리(7), 날자리(30), 100];
const 단계자리폰 = [0, 14, 날자리폰(1), 날자리폰(7), 날자리폰(30), 100];
const 짧은이름 = ['지금', '1분', '1일', '7일', '30일', '내 위치'];

const 조각 = () => {
  const 크기 = { 'piece-tutor-review': [732, 239], 'piece-evidence': [780, 577] };
  return Object.keys(크기).map(n => `<figure class="lw-piece mv-shot" data-shot="${n}" hidden><img src="assets/shots/${n}.webp" alt="${esc(조각설명[n])}" width="${크기[n][0]}" height="${크기[n][1]}" decoding="async"></figure>`).join('\n');
};
const 단계 = Q.steps.map((s, i) => `<li style="--x:${단계자리[i].toFixed(2)}%;--xm:${단계자리폰[i].toFixed(2)}%"><i aria-hidden="true"></i><span data-s="${esc(짧은이름[i])}">${esc(s)}</span></li>`).join('');

const 무대 = `<section class="mv" id="mv" aria-labelledby="t-mv" data-try data-motion data-scene="now" data-sound-base="assets/sound/">
<script type="application/json" data-try-data>${JSON.stringify(Q)}</script>
<div class="mv-light" aria-hidden="true"><div class="mv-win"><i></i><i></i><i></i><i></i><canvas class="mv-fx"></canvas></div></div>
<div class="mv-top">
  <div><p class="mv-label">SYNK WORLD · 직접 풀어 보기</p><h2 class="mv-title" id="t-mv"><span>한 문제만 풀어 보세요</span> <span>30일을 빨리 감아 드립니다</span></h2></div>
  <div class="mv-tools"><button class="mv-sound" type="button" aria-pressed="true"><i aria-hidden="true"><b></b><b></b><b></b></i><span>소리 켬</span></button><a class="mv-why" href="https://synk.im/atlas/#learner-why">왜 이렇게 만들었나 <span aria-hidden="true">→</span></a></div>
</div>
<div class="mv-stage">
  <div class="mv-quiz" data-quiz>
    <p class="mv-qhead"><span data-qhead lang="ko"></span><span data-qcount hidden></span></p><i hidden><b data-qbar></b></i>
    <p class="mv-ctx" data-context lang="ko"></p>
    <p class="mv-prompt" data-prompt lang="ko"></p>
    <div class="mv-choices" data-choices lang="ko"></div>
  </div>
  ${조각()}
  <div class="mv-card" hidden>
    <p class="mv-card-tag">일주일 만에 다시 꺼낼 말</p>
    <p class="mv-card-word" lang="ko"></p>
    <button class="mv-card-open" type="button" aria-expanded="false" aria-controls="mv-trail"><i aria-hidden="true"></i><span>이 말이 지나온 길 보기</span></button>
    <ol class="mv-card-trail" id="mv-trail"></ol>
  </div>
  <div class="mv-after"><div aria-live="polite"><p class="mv-say" data-say></p><p class="mv-sub" data-sub></p></div><div class="mv-next" data-next></div></div>
</div>
<div class="mv-warp" aria-hidden="true"><span class="mv-num">0</span><span class="mv-unit">일</span><span class="mv-cap"></span></div>
<div class="mv-stamp" aria-hidden="true"><span><small>30일 확인</small>혼자<br>맞힘</span></div>
<div class="mv-bottom">
  <p class="mv-when" data-when aria-live="polite"></p>
  <div class="mv-rail"><b class="mv-fill" aria-hidden="true"></b><ol data-steps>${단계}</ol></div>
  <p class="mv-note">실제 첫 레슨의 문제와 SYNK WORLD 화면 · 예시 학습자의 30일</p>
</div>
</section>`;

const 머리 = `<header class="pg-head">
<p class="pg-kicker">synk.im/lab · 「쓸수록 달라지는 것」 구역 · 시안 2026-11-18</p>
<h1>B 큰 글, 움직이는 판</h1>
<p>사진을 모두 뺐습니다. 대신 교실 창으로 들어온 빛 한 덩어리가 벽에 놓이고, 그 빛이 날마다 달라집니다. 첫날은 늦은 오후의 낮은 해, 다음 날은 아침빛, 7일 뒤는 비 오는 날, 30일 뒤는 해 질 녘 첫눈입니다. 비와 눈은 그 빛 안에서만 그림자로 지나갑니다.</p>
<ul>
<li>보기 앞의 번호는 눌리는 자판 단추입니다. 키보드 1, 2, 3으로도 고를 수 있습니다.</li>
<li>답하면 그 말이 작은 표가 되어 시간 줄의 돌아올 날로 날아가 앉습니다. 그날이 오면 무대로 돌아옵니다.</li>
<li>다음 단추를 누르면 무대가 빠지고, 가운데 큰 숫자가 날을 감습니다. 그동안 창빛이 벽을 여러 번 쓸고 지나가며 하루하루가 흐릅니다.</li>
<li>소리는 브랜드 사운드킷의 짧은 소리 셋만 씁니다. 틀렸을 때 내는 소리는 없습니다. 오른쪽 위에서 끌 수 있습니다.</li>
</ul>
</header>`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LAB 무대 B 움직이는 판</title>
<link rel="stylesheet" href="모션.css">
</head>
<body>
${머리}
${무대}
<footer class="pg-foot"><p>시안입니다. 공개본에는 아무것도 바꾸지 않았습니다. 글과 문제는 지금 공개본 원고 그대로입니다.</p></footer>
<script src="assets/js/learner.js"></script>
<script src="assets/js/lw-motion.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(여기, '모션.html'), html);
console.log('지음 모션.html', html.length, 'bytes');

// --아티팩트 <폴더>: claude.ai 페이지로 올릴 판. 문서 뼈대를 벗기고 CSS를 쪽 안에 넣고 글꼴을 data URI로 심는다. 조각 그림 · 소리 · 스크립트는 files로 함께 낸다.
const 판폴더 = 값('--아티팩트', null);
if (판폴더) {
  const 밖 = path.resolve(판폴더);
  fs.mkdirSync(밖, { recursive: true });
  let css = fs.readFileSync(path.join(여기, '모션.css'), 'utf8');
  css = css.replace(/url\('assets\/fonts\/([^']+)'\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(여기, 'assets', 'fonts', f)).toString('base64')})`);
  // 소리는 쪽 안에 심는다(짧은 소리 셋, 모두 32KB 아래)
  const 소리 = ['earn', 'notify', 'achieve'].map(k => `data-sound-${k}="data:audio/wav;base64,${fs.readFileSync(path.join(여기, 'assets', 'sound', k + '.wav')).toString('base64')}"`).join(' ');
  const 몸 = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).trim().replace('data-sound-base="assets/sound/"', 소리);
  const 쪽 = `<title>LAB 무대 B 움직이는 판</title>\n<style>${css}</style>\n${몸}\n`;
  fs.writeFileSync(path.join(밖, 'index.html'), 쪽);
  const 옮길 = [];
  for (const [d, 거름] of [['assets/shots', null], ['assets/js', /^(learner|lw-motion)\.js$/]]) {
    for (const f of fs.readdirSync(path.join(여기, d))) {
      if (거름 && !거름.test(f)) continue;
      fs.mkdirSync(path.join(밖, d), { recursive: true });
      fs.copyFileSync(path.join(여기, d, f), path.join(밖, d, f));
      옮길.push(`${d}/${f}`);
    }
  }
  fs.writeFileSync(path.join(밖, 'files.json'), JSON.stringify(Object.fromEntries(옮길.map(p => [p, path.join(밖, p).replace(/\\/g, '/')])), null, 1));
  console.log('아티팩트 판', 밖, Math.round(쪽.length / 1024), 'KB +', 옮길.length, '파일');
}
