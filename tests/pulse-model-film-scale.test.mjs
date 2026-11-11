// PULSE 의뢰서 모델 단계 큰 칸의 4초(캐스팅북 모델 벽 영상 720×1280, 11-10)가 세 기기에서 1.5배 넘게 늘어나지 않는지 본다(슬롭 점검표 48).
// 저장소 전용 도구 tools/화면배율.mjs의 기기 · 셈을 쓰므로 회사 폴더가 아니라 저장소 시험에 둔다(pulse-film-scale.test.mjs와 같은 까닭).
// 큰 칸은 넓은 창에서 창 높이를 꽉 채우고(실측 1440×900 → 466×900, 1920×950 → 743×950, 2560×1440 → 1127×1440), 세로 창(휴대폰)에서는 폭 전체 × 62dvh다.
// film.css: 칸이 9:16보다 좁으면 채운다(cover — 높이가 배율을 정한다). 넓은 칸은 화소비 띠마다 정한 폭 이하일 때만 채우고(폭 × 화소비 / 720 ≤ 1.47) 넘으면 높이에 맞춘다(contain).
// Fable 최종(pulse-model-films-20261110)이 9:16 문턱만으로는 최대화한 1440 창에 검정 띠가 생긴다고 짚어 띠를 더했다. 그래서 어느 칸이든 배율은
// max(칸 높이 / 1280 × 화소비, 띠 폭 × 화소비 / 720)를 넘지 않는다 — 기기마다 높이 쪽을, 띠마다 폭 쪽을 잰다. 휴대폰은 폭을 알아 그대로 잰다.
// 높이 쪽은 기준 기기 셋만으로는 지켜지지 않았다 — Fable 5.2 검수(pulse-model-films-20261111-f52, 11-11)가 화소비가 높은 큰 화면(맥북 프로 16형 1.75배 · 4K 150% 1.69배 · 5K 2.06배)을 짚어,
// 칸 높이 × 화소비가 약 1,881을 넘으면 영상 칸에 위아래 안쪽 여백을 두는 높이 띠(화소비 4까지 빈틈 없이)를 더했다. 둘째 시험이 그 띠와 그 화면들을 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {기기들,기본기준,늘어난배율} from '../tools/화면배율.mjs';

const appDir=new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');

test('the model clip in the request form never stretches past the limit on the three reference screens',()=>{
  const css=read('film.css');
  assert.match(css,/\.sx-casting-lead video\{[^}]*object-fit:contain;/,'wide boxes fit the clip by its height unless a band allows filling');
  assert.ok(css.includes('@container (max-aspect-ratio:9/16){.sx-casting-lead video{object-fit:cover}}'),'boxes narrower than 9:16 are filled');
  assert.ok(css.includes('.sx-casting-lead{container-type:size}'),'the container queries read the portrait box itself');
  // 화소비 띠: 띠의 가장 큰 화소비에서도 띠 폭이 1.5배를 넘기지 않는다(띠 사이 틈의 화소비는 어느 띠에도 안 들어 늘 contain).
  const bands=[...css.matchAll(/@media ([^{]*)\{@container \(max-width:(\d+)px\)\{\.sx-casting-lead video\{object-fit:cover\}\}\}/g)].map(([,query,width])=>{
    const max=query.match(/max-resolution:([\d.]+)dppx/)?.[1];
    return {query,width:Number(width),ratio:Number(max)};
  });
  assert.equal(bands.length,6,'six pixel-ratio bands');
  // 위가 열린 띠는 두지 않는다 — 화소비 3을 넘는 폰(「표시 크기 크게」로 CSS 폭이 줄어도)은 채우지 않는다(Fable 다시 검수 FA4).
  for(const band of bands)assert.ok(Number.isFinite(band.ratio),`${band.query} has an upper pixel ratio`);
  for(const band of bands)assert.ok(늘어난배율({칸폭:band.width,칸높이:1,원본폭:720,원본높이:1280,맞춤:'cover',화소비:band.ratio})<기본기준,`${band.query}: a ${band.width}px box filled at ${band.ratio}x`);
  const tall=Number(css.match(/\.sx-casting-lead\{grid-row:auto;grid-column:1\/-1;height:(\d+)vh;height:\1dvh\}/)?.[1])/100;
  assert.ok(tall>0&&tall<=1,'portrait windows give the portrait a share of the window height');
  const bandFor=ratio=>bands.find(band=>{const min=Number(band.query.match(/min-resolution:([\d.]+)dppx/)?.[1]||0);return ratio>=min&&ratio<=(band.query.includes('max-resolution')?band.ratio:Infinity);});
  for(const device of 기기들){
    const portrait=device.w<=820||device.w<=device.h;
    const 칸높이=portrait?tall*device.h:device.h;
    // 높이 쪽: 칸 폭이 9:16에 맞을 때(cover · contain 같음) — 넓은 창의 가장 나쁜 높이 쪽이다.
    const 높이쪽=늘어난배율({칸폭:칸높이*9/16,칸높이,원본폭:720,원본높이:1280,맞춤:'cover',화소비:device.화소비});
    assert.ok(높이쪽<기본기준,`${device.이름} ${device.w}×${device.h} at ${device.화소비}x: a ${Math.round(칸높이)}px tall portrait stretches the clip ${높이쪽}×`);
    if(!portrait)continue;
    // 휴대폰: 폭을 알므로 film.css 규칙대로 맞춤을 고르고 잰다.
    const 칸폭=device.w,band=bandFor(device.화소비);
    const 맞춤=칸폭/칸높이<=9/16||band&&칸폭<=band.width?'cover':'contain';
    const scale=늘어난배율({칸폭,칸높이,원본폭:720,원본높이:1280,맞춤,화소비:device.화소비});
    assert.ok(scale<기본기준,`${device.이름}: a ${칸폭}×${Math.round(칸높이)} ${맞춤} portrait stretches the clip ${scale}×`);
  }
});

test('the clip never stretches past the limit on its height either — tall boxes on high-density screens letterbox it on its own black padding',()=>{
  const css=read('film.css');
  // 범위 문법 「(앞 위 끝dppx < resolution <= 이 위 끝dppx)」 · 「(height > 상한px)」 — 첫 띠만 아래 끝이 없다.
  const caps=[...css.matchAll(/@media \((?:([\d.]+)dppx < )?resolution <= ([\d.]+)dppx\)\{@container \(height > (\d+)px\)\{\.sx-casting-lead video\{object-fit:contain;padding-block:calc\(\(100cqh - (\d+)px\)\/2\)\}\}\}/g)].map(([query,lo,hi,over,cap])=>({
    query,lo:lo===undefined?null:Number(lo),hi:Number(hi),over:Number(over),cap:Number(cap),
  })).sort((x,y)=>x.hi-y.hi);
  assert.equal(caps.length,7,'seven height bands, up to a pixel ratio of 4');
  // 띠 사이 틈이 없다(11-12 GPT 검수 — 0.001dppx 틈의 화소비 1.2505가 어느 띠에도 안 들어 1.56배였다): 첫 띠는 아래가 열리고, 다음 띠의 (배타) 아래 끝은 앞 띠의 위 끝과 같다.
  assert.equal(caps[0].lo,null,`${caps[0].query} covers every pixel ratio up to its top`);
  for(let i=1;i<caps.length;i++)assert.equal(caps[i].lo,caps[i-1].hi,`${caps[i].query} starts exactly where ${caps[i-1].query} ends`);
  assert.equal(caps.at(-1).hi,4);
  for(const band of caps){
    assert.equal(band.over,band.cap,`${band.query}: the padding starts right above the cap`);
    const scale=늘어난배율({칸폭:band.cap*9/16,칸높이:band.cap,원본폭:720,원본높이:1280,맞춤:'cover',화소비:band.hi});
    assert.ok(scale<기본기준,`${band.query}: a ${band.cap}px tall clip at ${band.hi}x stretches ${scale}×`);
  }
  // 화소비가 높은 큰 화면(11-11 · 11-12 크롬 실측과 같은 창). 넓은 창의 큰 칸은 창 높이를 꽉 채우고, 세로 창은 62dvh다.
  const tall=Number(css.match(/\.sx-casting-lead\{grid-row:auto;grid-column:1\/-1;height:(\d+)vh;height:\1dvh\}/)?.[1])/100;
  for(const [이름,w,h,ratio] of [['맥북 프로 16형',1728,1117,2],['맥북 프로 16형 창',1728,1000,2],['4K 150%',2560,1440,1.5],['4K 200%',1920,1080,2],['5K',2560,1320,2],['4K 100%',3840,2000,1],['3008 · 125%',3008,1600,1.25],['화소비 4 휴대폰',360,780,4]]){
    const 칸높이=w<=820||w<=h?tall*h:h,band=caps.find(b=>(b.lo===null||ratio>b.lo)&&ratio<=b.hi);
    const 높이=band&&칸높이>band.cap?band.cap:칸높이;
    const scale=늘어난배율({칸폭:높이*9/16,칸높이:높이,원본폭:720,원본높이:1280,맞춤:'cover',화소비:ratio});
    assert.ok(scale<기본기준,`${이름} ${w}×${h} at ${ratio}x: a ${Math.round(높이)}px tall clip stretches ${scale}×`);
  }
  // 경계 바로 위 · 위 끝의 화소비(표시 배율 × 확대 조합)도 어느 띠에 들고, 2,000px 높이 칸에서 1.5배를 넘지 않는다.
  for(const ratio of [1,1.0005,1.25,1.2505,1.5,1.5005,2,2.0005,2.5,2.5005,3,3.0005,4]){
    const band=caps.find(b=>(b.lo===null||ratio>b.lo)&&ratio<=b.hi);
    assert.ok(band,`a ${ratio}x screen falls in a height band`);
    const scale=늘어난배율({칸폭:band.cap*9/16,칸높이:band.cap,원본폭:720,원본높이:1280,맞춤:'cover',화소비:ratio});
    assert.ok(scale<기본기준,`a 2000px tall box at ${ratio}x: ${scale}×`);
  }
});
