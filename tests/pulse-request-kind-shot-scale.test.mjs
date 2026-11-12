// PULSE 의뢰서 모델 단계 큰 칸의 업종 작품 그림(「추천해 주세요」 · 「사람 없이 제품만」 — KINDS shot, 큰 판 없음)이 어느 화면에서든
// 실제 화소의 1.5배 넘게 늘어나지 않는지 본다(11-12). film.css 규칙을 글에서 읽어 셈으로 따라 한다:
// 세로 작품(data-shot=tall)은 4초 영상과 같은 규칙 — 9:16보다 좁은 칸 · 화소비 띠 안의 칸만 채우고(cover), 그 밖은 맞추며(contain), 높이 띠를 넘는 칸은 위아래 여백.
// 가로 작품(data-shot=wide)은 늘 맞추고(자르지 않음) 화소비마다 폭 상한을 넘는 칸은 좌우 여백.
// 큰 칸 크기는 pulse-model-scene-scale.test.mjs와 같은 film.css 짜임(넓은 창: (창 − min(46%,680px) − 1) × 3/5 × 창 높이, 세로 창: 창 폭 × 62dvh).
// 저장소 전용 도구 tools/화면배율.mjs의 셈을 쓰므로 회사 폴더가 아니라 저장소 시험에 둔다.
// 11-12 크롬 실측(로컬 정적 서버, 내용 상자 · object-fit까지 읽어 셈)과 같은 배율이 나온다 — 1440×900 @1.5 세로 1.05 · 가로 0.55, 휴대폰 390 @3 세로 1.23 · 가로 0.91.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {기기들,기본기준,늘어난배율} from '../tools/화면배율.mjs';

const appDir=new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/',import.meta.url);
globalThis.location??=new URL('http://localhost/pulse-app/');
const {KINDS}=await import(new URL('request-data.mjs',appDir).href);
const css=readFileSync(new URL('film.css',appDir),'utf8');
const webpSize=bytes=>{
  const kind=bytes.toString('latin1',12,16);
  if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  throw new Error(`not a webp: ${kind}`);
};

// film.css 규칙 읽기 — 글이 바뀌면 셈도 따라 바뀐다.
const TALL='\\.sx-casting-lead video,\\.sx-casting-lead img\\[data-shot=tall\\]';
const narrow=css.includes('@container (max-aspect-ratio:9/16){.sx-casting-lead video,.sx-casting-lead img[data-shot=tall]{object-fit:cover}}');
const fillBands=[...css.matchAll(new RegExp(`@media ([^{]*)\\{@container \\(max-width:(\\d+)px\\)\\{${TALL}\\{object-fit:cover\\}\\}\\}`,'g'))].map(([,query,width])=>({
  min:Number(query.match(/min-resolution:([\d.]+)dppx/)?.[1]||0),max:Number(query.match(/max-resolution:([\d.]+)dppx/)?.[1]),width:Number(width),
}));
const capsOf=(axis,selector,prop)=>[...css.matchAll(new RegExp(`@media (?:not all and \\(max-resolution:([\\d.]+)dppx\\)\\{@media )?\\(max-resolution:([\\d.]+)dppx\\)\\{@container \\(min-${axis}:(\\d+)px\\)\\{${selector}\\{${prop}:calc\\(\\(100cq${axis==='height'?'h':'w'} - (\\d+)px\\)\\/2\\)\\}\\}\\}`,'g'))].map(([,lo,hi,over,cap])=>({
  lo:lo===undefined?null:Number(lo),hi:Number(hi),over:Number(over),cap:Number(cap),
}));
const heightCaps=capsOf('height',TALL,'object-fit:contain;padding-block');
const widthCaps=capsOf('width','\\.sx-casting-lead img\\[data-shot=wide\\]','padding-inline');
const capFor=(caps,ratio)=>caps.find(b=>(b.lo===null||ratio>b.lo)&&ratio<=b.hi);

/** film.css가 정한 대로 그림이 그려지는 배율(내용 상자 · object-fit)을 낸다. */
function drawn(shape,[w,h],[boxW,boxH],ratio){
  if(shape==='wide'){
    const cap=capFor(widthCaps,ratio),contentW=cap&&boxW>=cap.over?cap.cap:boxW;
    return {fit:'contain',scale:늘어난배율({칸폭:contentW,칸높이:boxH,원본폭:w,원본높이:h,맞춤:'contain',화소비:ratio})};
  }
  const band=fillBands.find(b=>ratio>=b.min&&ratio<=b.max);
  let fit=(narrow&&boxW/boxH<=9/16)||(band&&boxW<=band.width)?'cover':'contain',contentH=boxH;
  const cap=capFor(heightCaps,ratio);
  if(cap&&boxH>=cap.over){fit='contain';contentH=cap.cap;}
  return {fit,scale:늘어난배율({칸폭:boxW,칸높이:contentH,원본폭:w,원본높이:h,맞춤:fit,화소비:ratio})};
}
const portrait=(w,h)=>w<=820||w<=h;
const leadOf=(w,h)=>portrait(w,h)?[w,0.62*h]:[(w-Math.min(0.46*w,680)-1)*3/5,h];
const screens=[...기기들.map(d=>[d.이름,d.w,d.h,d.화소비]),
  ['1366',1366,768,1],['1440 최대화',1440,780,1.5],['1920',1920,1080,1],['맥북 14',1512,860,2],['맥북 프로 16',1728,1117,2],['맥북 프로 16 창',1728,1000,2],
  ['4K 200%',1920,1080,2],['4K 150%',2560,1440,1.5],['4K 150% 창',2560,1300,1.5],['5K',2560,1320,2],['4K 100%',3840,2000,1],['울트라와이드',3440,1440,1],
  ['3008 · 125%',3008,1600,1.25],['화소비 4 휴대폰',360,780,4],['큰 휴대폰',430,932,3],['안드로이드',412,915,2.625],['세로 패드',820,1180,2],['세로 패드 큰',1024,1366,2]];

test('film.css carries every band this test follows',()=>{
  assert.ok(narrow,'tall works fill boxes narrower than 9:16');
  assert.equal(fillBands.length,6,'six fill bands for tall works');
  assert.equal(heightCaps.length,7,'seven height bands for tall works');
  assert.equal(widthCaps.length,7,'seven width bands for wide works');
  for(const caps of [heightCaps,widthCaps]){
    assert.equal(caps[0].lo,null);
    for(let i=1;i<caps.length;i++)assert.equal(caps[i].lo,caps[i-1].hi,'no gap between bands');
    assert.equal(caps.at(-1).hi,4);
    for(const band of caps)assert.equal(band.over-1,band.cap);
  }
  assert.doesNotMatch(css,/img\[data-shot=wide\][^{]*\{[^}]*object-fit:cover/,'wide works are never cropped');
});

test('the business picture in the big portrait never stretches past the limit, on the 21 screens',()=>{
  // 큰 칸에서 꼴을 다는 것은 큰 판이 없는 작품 그림(tall · wide)뿐이다 — 모델 장면 사진(scene)은 큰 판 srcset으로 채운다(pulse-model-scene-scale.test.mjs).
  const shots=KINDS.filter(kind=>kind.shotShape==='tall'||kind.shotShape==='wide');
  assert.equal(shots.length,6);
  const table=[];
  for(const kind of shots){
    const size=webpSize(readFileSync(new URL(kind.shot.replace('./',''),appDir)));
    for(const [label,w,h,ratio] of screens){
      const box=leadOf(w,h),{fit,scale}=drawn(kind.shotShape,size,box,ratio);
      if(kind.shotShape==='wide')assert.equal(fit,'contain',`${kind.id} is never cropped`);
      assert.ok(scale<기본기준,`${kind.id} (${kind.shotShape} ${size.join('×')}) on ${label} ${w}×${h}@${ratio}: box ${box.map(Math.round).join('×')} ${fit} stretches it ${scale}×`);
      table.push(scale);
    }
  }
  assert.equal(table.length,shots.length*21);
});

test('the bands hold on any box up to a pixel ratio of 4 — between bands and at their edges too',()=>{
  const ratios=[1,1.0005,1.01,1.1,1.25,1.2505,1.26,1.3,1.5,1.5005,1.51,1.75,2,2.0005,2.01,2.25,2.5,2.5005,2.51,2.625,2.75,3,3.0005,3.5,4];
  for(const ratio of ratios)for(let boxW=120;boxW<=3200;boxW+=40)for(let boxH=160;boxH<=2600;boxH+=40){
    for(const [shape,size] of [['tall',[720,1280]],['wide',[1280,720]]]){
      const {fit,scale}=drawn(shape,size,[boxW,boxH],ratio);
      assert.ok(scale<기본기준,`${shape} in ${boxW}×${boxH} at ${ratio}x: ${fit} ${scale}×`);
    }
  }
});
