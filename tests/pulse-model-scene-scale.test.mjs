// PULSE 의뢰서 모델 단계 큰 칸의 장면 사진(model-scene-<id>.webp 폭 960 · -l.webp 폭 1600)이 어느 화면에서든 실제 화소의 1.5배 넘게 늘어나지 않는지 본다(11-12).
// 브라우저의 srcset 고르기(w 표기: sizes 폭 S에 대해 「후보 폭 ÷ S ≥ 화소비」인 가장 작은 후보, 없으면 가장 큰 후보)를 셈으로 따라 하고,
// 큰 칸 크기는 film.css 짜임(넓은 창: 칸 폭 = (창 − min(46%,680px)) × 3/5 · 높이 = 창 높이, 세로 창: 창 폭 × 62dvh)으로 낸다.
// 저장소 전용 도구 tools/화면배율.mjs의 셈을 쓰므로 회사 폴더가 아니라 저장소 시험에 둔다(pulse-model-film-scale.test.mjs와 같은 까닭).
// 11-12 크롬 실측(로컬 정적 서버, currentSrc를 다시 열어 실제 화소로 잼)과 같은 판 · 같은 배율이 나온다 — 1440×900@1.5 작은 판 1.13 · 5K 큰 판 1.41 · 430×932@3 작은 판 1.45.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {기기들,기본기준,늘어난배율} from '../tools/화면배율.mjs';

const appDir=new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/',import.meta.url);
globalThis.location??=new URL('http://localhost/pulse-app/');
const {SCENE_SIZES,sceneSet}=await import(new URL('request-flow.mjs',appDir).href);
const webpSize=bytes=>{
  const kind=bytes.toString('latin1',12,16);
  if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  throw new Error(`not a webp: ${kind}`);
};

// SCENE_SIZES를 그대로 셈한다 — 글이 바뀌면 이 셈도 같이 고쳐야 하니 글을 먼저 못박는다.
const SIZES='(max-width:820px) max(68.1vw,34vh), (max-aspect-ratio:1/1) max(68.1vw,34vh), max(22.1vw,calc(40.8vw - 277px),54.8vh)';
const portrait=(w,h)=>w<=820||w<=h;
const sizesOf=(w,h)=>portrait(w,h)?Math.max(0.681*w,0.34*h):Math.max(0.221*w,0.408*w-277,0.548*h);
const leadOf=(w,h)=>portrait(w,h)?[w,0.62*h]:[(w-Math.min(0.46*w,680)-1)*3/5,h];
const pick=(candidates,S,dpr)=>candidates.find(c=>c.w/S>=dpr)||candidates.at(-1);

test('the request portrait never stretches its scene photo past the limit, on the reference screens and on high-density big screens',()=>{
  assert.equal(SCENE_SIZES,SIZES);
  const assets=new URL('assets/request/',appDir);
  const scenes=readdirSync(assets).filter(name=>/^model-scene-[a-z]\d+\.webp$/.test(name));
  assert.equal(scenes.length,21);
  const screens=[...기기들.map(d=>[d.이름,d.w,d.h,d.화소비]),
    ['1366',1366,768,1],['1440 최대화',1440,780,1.5],['1920',1920,1080,1],['맥북 14',1512,860,2],['맥북 프로 16',1728,1117,2],['맥북 프로 16 창',1728,1000,2],
    ['4K 200%',1920,1080,2],['4K 150%',2560,1440,1.5],['4K 150% 창',2560,1300,1.5],['5K',2560,1320,2],['4K 100%',3840,2000,1],['울트라와이드',3440,1440,1],
    ['3008 · 125%',3008,1600,1.25],['화소비 4 휴대폰',360,780,4],['큰 휴대폰',430,932,3],['안드로이드',412,915,2.625],['세로 패드',820,1180,2],['세로 패드 큰',1024,1366,2]];
  for(const name of scenes){
    const set=sceneSet(`./assets/request/${name}`);
    const candidates=set.split(', ').map(item=>{const [url,w]=item.split(' ');return {url,w:Number(w.replace('w','')),real:webpSize(readFileSync(new URL(url.replace('./assets/request/',''),assets)))};});
    assert.deepEqual(candidates.map(c=>c.w),[960,1600],name);
    for(const c of candidates)assert.equal(c.real[0],c.w,`${c.url} is as wide as its descriptor`);
    for(const [label,w,h,dpr] of screens){
      const [칸폭,칸높이]=leadOf(w,h),chosen=pick(candidates,sizesOf(w,h),dpr);
      const scale=늘어난배율({칸폭,칸높이,원본폭:chosen.real[0],원본높이:chosen.real[1],맞춤:'cover',화소비:dpr});
      assert.ok(scale<기본기준,`${name} on ${label} ${w}×${h}@${dpr}: box ${Math.round(칸폭)}×${Math.round(칸높이)} picks ${chosen.url.split('/').pop()} and stretches it ${scale}×`);
    }
  }
  // 기준 화면은 작은 판 그대로(받는 무게가 늘지 않는다) — 1440 @1.5 · 2560 @1 · 휴대폰 @3.
  const f02=sceneSet('./assets/request/model-scene-f02.webp').split(', ').map(item=>({w:Number(item.split(' ')[1].replace('w','')),url:item.split(' ')[0]}));
  for(const d of 기기들)assert.equal(pick(f02,sizesOf(d.w,d.h),d.화소비).w,960,`${d.이름} keeps the 960 cut`);
});
