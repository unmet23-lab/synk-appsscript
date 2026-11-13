// PULSE 고객 앱의 남은 그림 자리(11-13)가 어느 화면에서든 실제 화소의 1.5배 넘게 늘어나지 않는지 본다:
// 첫 화면 3쪽 · 고객 방의 모델 장면 사진(작은 판 960 · 큰 판 1600 srcset + 모자란 화면은 칸 줄이기),
// 고객 방 · 의뢰서의 예시 그림(霜の肌理 15초의 장 · 자료 예시 — 큰 판 없음)과 손님 사진 · 내 모델 그림(크기를 모름)의 칸 줄이기(data-cap).
// 칸 줄이기는 film.css 규칙을 글에서 읽어 셈으로 따라 한다: 칸 = min(칸, 실제 화소 × 화소비 띠의 몫), 채우기(cover)는 그대로.
// 브라우저의 srcset 고르기는 pulse-model-scene-scale.test.mjs와 같은 셈(sizes 폭 S에 「후보 폭 ÷ S ≥ 화소비」인 가장 작은 후보, 없으면 가장 큰 후보).
// 저장소 전용 도구 tools/화면배율.mjs의 셈을 쓰므로 회사 폴더가 아니라 저장소 시험에 둔다. 표시 · 마크업 약속은 회사 시험 pulse-pixel-cap.test.mjs.
// 11-13 크롬 실측(로컬 정적 서버, 21개 화면 · currentSrc의 실제 화소)과 같은 판 · 같은 배율이 나온다 — 5K(2560×1320 @2) 고객 방 장면 큰 판 1.47(칸 1176 폭으로 줄어듦),
// 기준 1440×900 @1.5에서는 첫 화면 3쪽 작은 판 1.31 · 고객 방 작은 판 1.22 그대로(칸 줄이기 없음).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {기기들,기본기준,늘어난배율} from '../tools/화면배율.mjs';

const appDir=new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/',import.meta.url);
globalThis.location??=new URL('http://localhost/pulse-app/');
const {sceneSet}=await import(new URL('request-data.mjs',appDir).href);
const {HOME_SCENE_SIZES}=await import(new URL('film-home.mjs',appDir).href);
const {ROOM_SCENE_SIZES}=await import(new URL('film-views.mjs',appDir).href);
const css=readFileSync(new URL('film.css',appDir),'utf8');
const webpSize=bytes=>{
  const kind=bytes.toString('latin1',12,16);
  if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  throw new Error(`not a webp: ${kind}`);
};
const assets=new URL('assets/request/',appDir);
const sizeOf=name=>webpSize(readFileSync(new URL(name,assets)));

// film.css의 칸 줄이기 띠 — 글이 바뀌면 셈도 따라 바뀐다.
const base=Number(css.match(/img\[data-cap\]\{--cap-k:([\d.]+);margin:auto;max-width:calc\(var\(--cap-w\) \* var\(--cap-k\)\);max-height:calc\(var\(--cap-h\) \* var\(--cap-k\)\)\}/)?.[1]);
const bands=[...css.matchAll(/@media not all and \(max-resolution:([\d.]+)dppx\)\{img\[data-cap\]\{--cap-k:([\d.]+)\}\}/g)].map(([,over,k])=>({over:Number(over),k:Number(k)}));
const kOf=ratio=>bands.filter(b=>ratio>b.over).reduce((k,b)=>b.k,base);
/** 칸 줄이기를 거친 칸과, 그 칸에 채워 그린 배율. */
function capped([boxW,boxH],[w,h],ratio){
  const k=kOf(ratio),box=[Math.min(boxW,w*k),Math.min(boxH,h*k)];
  return {box,clamped:box[0]<boxW||box[1]<boxH,scale:늘어난배율({칸폭:box[0],칸높이:box[1],원본폭:w,원본높이:h,맞춤:'cover',화소비:ratio})};
}
const portrait=(w,h)=>w<=820||w<=h;
const screens=[...기기들.map(d=>[d.이름,d.w,d.h,d.화소비]),
  ['1366',1366,768,1],['1440 최대화',1440,780,1.5],['1920',1920,1080,1],['맥북 14',1512,860,2],['맥북 프로 16',1728,1117,2],['맥북 프로 16 창',1728,1000,2],
  ['4K 200%',1920,1080,2],['4K 150%',2560,1440,1.5],['4K 150% 창',2560,1300,1.5],['5K',2560,1320,2],['4K 100%',3840,2000,1],['울트라와이드',3440,1440,1],
  ['3008 · 125%',3008,1600,1.25],['화소비 4 휴대폰',360,780,4],['큰 휴대폰',430,932,3],['안드로이드',412,915,2.625],['세로 패드',820,1180,2],['세로 패드 큰',1024,1366,2]];
const pick=(candidates,S,dpr)=>candidates.find(c=>c.w/S>=dpr)||candidates.at(-1);
const cutsOf=src=>sceneSet(src).split(', ').map(item=>{const [url,w]=item.split(' ');return {url,w:Number(w.replace('w','')),real:sizeOf(url.replace('./assets/request/',''))};});

// 칸 크기는 film.css 짜임: 첫 화면 3쪽 창 = min(58%, 1400px) × 쪽 높이(휴대폰은 창 폭 × 32dvh), 고객 방 스크린 = 54% × 창 높이(휴대폰은 창 폭 × 32dvh, 모델 제안 방 — 그 밖의 방은 44dvh).
const homeBox=(w,h)=>portrait(w,h)?[w,0.32*h]:[Math.min(0.58*w,1400),h];
const roomBox=(w,h,state='model')=>portrait(w,h)?[w,(state==='model'?0.32:0.44)*h]:[0.54*w,h];
const homeSizes=(w,h)=>portrait(w,h)?Math.max(0.681*w,0.176*h):Math.max(Math.min(0.395*w,953),0.548*h);
const roomSizes=(w,h)=>portrait(w,h)?Math.max(0.681*w,0.176*h):Math.max(0.368*w,0.548*h);

test('film.css carries the cap and its bands this test follows',()=>{
  assert.equal(base,1.47);
  assert.deepEqual(bands.map(b=>b.over),[1,1.25,1.5,2,2.5,3,4]);
  for(const ratio of [1,1.1,1.25,1.3,1.5,1.75,2,2.25,2.5,2.625,3,3.5,4])assert.ok(kOf(ratio)*ratio<=1.4701,`${ratio}x: share ${kOf(ratio)}`);
  assert.equal(HOME_SCENE_SIZES,'(max-width:820px) max(68.1vw,17.6vh), (max-aspect-ratio:1/1) max(68.1vw,17.6vh), max(min(39.5vw,953px),54.8vh)');
  assert.equal(ROOM_SCENE_SIZES,'(max-width:820px) max(68.1vw,17.6vh), (max-aspect-ratio:1/1) max(68.1vw,17.6vh), max(36.8vw,54.8vh)');
});

test('the model scene photos on the first screen’s third page and in the client room never stretch past the limit, on the 21 screens',()=>{
  const scenes=readdirSync(assets).filter(name=>/^model-scene-[a-z]\d+\.webp$/.test(name));
  assert.equal(scenes.length,21);
  const clampedOn=new Set();
  for(const name of scenes){
    const candidates=cutsOf(`./assets/request/${name}`);
    assert.deepEqual(candidates.map(c=>c.w),[960,1600],name);
    for(const [label,w,h,dpr] of screens){
      for(const [where,box,S] of [['home 3',homeBox(w,h),homeSizes(w,h)],['room',roomBox(w,h),roomSizes(w,h)]]){
        const chosen=pick(candidates,S,dpr),{scale,clamped,box:drawn}=capped(box,chosen.real,dpr);
        assert.ok(scale<기본기준,`${name} ${where} on ${label} ${w}×${h}@${dpr}: box ${box.map(Math.round).join('×')} picks ${chosen.url.split('/').pop()} → ${drawn.map(Math.round).join('×')} stretches it ${scale}×`);
        if(clamped)clampedOn.add(`${where} ${w}×${h}@${dpr}`);
      }
    }
  }
  // 칸을 줄이는 것은 큰 판으로도 모자란 화면뿐이다(그 밖은 칸을 채우던 그대로).
  assert.deepEqual([...clampedOn].sort(),['home 3 2560×1320@2','room 2560×1320@2']);
  // 기준 화면은 작은 판 그대로(받는 무게가 늘지 않는다) — 1440 @1.5 · 2560 @1 · 휴대폰 @3.
  const f02=cutsOf('./assets/request/model-scene-f02.webp');
  for(const d of 기기들){
    assert.equal(pick(f02,homeSizes(d.w,d.h),d.화소비).w,960,`${d.이름} home 3 keeps the 960 cut`);
    assert.equal(pick(f02,roomSizes(d.w,d.h),d.화소비).w,960,`${d.이름} room keeps the 960 cut`);
  }
});

test('the four candidates beside the request’s big portrait never stretch past the limit, on the 21 screens — and the reference screens keep the casting photo',async()=>{
  const {castSet,CAST_SIZES}=await import(new URL('request-flow.mjs',appDir).href);
  const {CASTING_MODELS}=await import(new URL('casting-catalog.mjs',appDir).href);
  assert.equal(CAST_SIZES,'(max-width:820px) 18.3vw, (max-aspect-ratio:1/1) 18.3vw, max(14.7vw,calc(27.2vw - 185px),13.7vh)');
  // 넓은 창: 큰 칸 자리(창 − min(46%,680px))의 2/5 폭 × (창 높이 − 틈 3) ÷ 4. 세로 창: 넷이 한 줄(창 폭 ÷ 4, 3:4 칸).
  const tileBox=(w,h)=>portrait(w,h)?[w/4,w/3]:[(w-Math.min(0.46*w,680)-1)*2/5,(h-3)/4];
  const tileSizes=(w,h)=>portrait(w,h)?0.183*w:Math.max(0.147*w,0.272*w-185,0.137*h);
  const photos=new URL('assets/casting/photos/',appDir);
  for(const item of CASTING_MODELS){
    const set=castSet(item),id=item.id.toLowerCase();
    const candidates=set?set.split(', ').map(part=>{const [url,w]=part.split(' ');return {url,w:Number(w.replace('w','')),real:webpSize(readFileSync(new URL(url.replace('./assets/',''),new URL('assets/',appDir))))};})
      :[{url:`${id}-context.webp`,real:webpSize(readFileSync(new URL(`${id}-context.webp`,photos)))}];
    for(const c of candidates)if(c.w)assert.equal(c.real[0],c.w,`${c.url} is as wide as its descriptor`);
    for(const [label,w,h,dpr] of screens){
      const box=tileBox(w,h),chosen=set?pick(candidates,tileSizes(w,h),dpr):candidates[0],{scale}=capped(box,chosen.real,dpr);
      assert.ok(scale<기본기준,`${item.id} candidate on ${label} ${w}×${h}@${dpr}: box ${box.map(Math.round).join('×')} ${chosen.url.split('/').pop()} ${scale}×`);
    }
    if(set)for(const d of 기기들)assert.match(pick(candidates,tileSizes(d.w,d.h),d.화소비).url,/-context\.webp$/,`${item.id} on ${d.이름} keeps the casting photo`);
  }
});

test('the example pictures (no large cut) fill the room screen as before on the reference screens and shrink only where they would stretch',()=>{
  // 霜の肌理 15초의 장(원본 영상 폭 1080이 한계) — 저희 차례 · 제작 중 고객 방, 업종을 고르기 전 말 · 글자 단계, 자료 단계 예시.
  const pictures=['w-gift.webp','w-gift-snow.webp','file-gift-set.webp','sheet-gift-05.webp'].map(name=>[name,sizeOf(name)]);
  assert.deepEqual(Object.fromEntries(pictures.map(([name,size])=>[name,size.join('×')])),{'w-gift.webp':'960×1707','w-gift-snow.webp':'960×1707','file-gift-set.webp':'900×1200','sheet-gift-05.webp':'720×1280'});
  for(const [name,size] of pictures)for(const [label,w,h,dpr] of screens){
    for(const state of ['model','other']){
      const box=roomBox(w,h,state),{scale,clamped}=capped(box,size,dpr);
      assert.ok(scale<기본기준,`${name} in the room (${state}) on ${label} ${w}×${h}@${dpr}: ${scale}×`);
      if(name.startsWith('w-gift')&&기기들.some(d=>d.w===w&&d.h===h&&d.화소비===dpr))assert.equal(clamped,false,`${name} on the reference screen ${label} fills the room screen as before`);
    }
  }
});

test('a picture of any size (a customer photo, a my-model picture) in any box stays within the limit at any pixel ratio up to 4',()=>{
  const sizes=[[320,240],[640,800],[800,800],[1080,1350],[1600,900],[1024,1536],[2048,1152],[3024,4032],[4032,3024]];
  const ratios=[1,1.0005,1.25,1.26,1.5,1.51,1.75,2,2.01,2.5,2.625,3,3.0005,3.5,4];
  for(const size of sizes)for(const ratio of ratios)for(let boxW=60;boxW<=3200;boxW+=70)for(let boxH=60;boxH<=2600;boxH+=70){
    const {scale}=capped([boxW,boxH],size,ratio);
    assert.ok(scale<기본기준,`${size.join('×')} in ${boxW}×${boxH} at ${ratio}x: ${scale}×`);
  }
  // 큰 사진은 칸을 줄이지 않는다 — 휴대폰 사진(3024×4032)은 5K 큰 칸(1127×1320 @2)에서도 채우던 그대로.
  assert.equal(capped([1127,1320],[3024,4032],2).clamped,false);
});
