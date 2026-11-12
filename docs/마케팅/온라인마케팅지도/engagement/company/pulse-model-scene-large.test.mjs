import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {CASTING_MODELS} from './public/pulse-app/casting-catalog.mjs';

// 의뢰서 큰 칸의 장면 사진(model-scene-<id>.webp, 폭 960)은 화소비가 높은 큰 화면에서 실제 화소의 1.5배 넘게 늘어났다(11-12 실측 1.6 ~ 2.35배).
// 그런 화면만 srcset으로 큰 판(model-scene-<id>-l.webp, 폭 1600 — 같은 원본 · 같은 비율)을 받는다. 이 시험은 회사 원천만 읽는다.
// 화면마다 어느 판을 고르고 몇 배인지는 저장소 시험 tests/pulse-model-scene-scale.test.mjs.
globalThis.location??=new URL('http://localhost/pulse-app/');
const {SCENE_SIZES,sceneSet}=await import('./public/pulse-app/request-flow.mjs');
const assets=new URL('./public/pulse-app/assets/request/',import.meta.url);
const webpSize=bytes=>{
  const kind=bytes.toString('latin1',12,16);
  if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  throw new Error(`not a webp: ${kind}`);
};

test('every casting model has a 1600-wide cut of its request scene with the same frame as the 960 one',()=>{
  assert.equal(CASTING_MODELS.length,21);
  for(const model of CASTING_MODELS){
    const id=model.id.toLowerCase(),small=new URL(`model-scene-${id}.webp`,assets),large=new URL(`model-scene-${id}-l.webp`,assets);
    assert.ok(existsSync(large),`model-scene-${id}-l.webp`);
    const [sw,sh]=webpSize(readFileSync(small)),[lw,lh]=webpSize(readFileSync(large));
    assert.equal(sw,960,`${id} small is 960 wide`);
    assert.equal(lw,1600,`${id} large is 1600 wide`);
    assert.ok(Math.abs(sw/sh-lw/lh)<0.002,`${id} keeps the frame: ${sw}×${sh} vs ${lw}×${lh}`);
  }
});

test('the big portrait offers the large cut through srcset, and only for model scenes',()=>{
  assert.equal(sceneSet('./assets/request/model-scene-f02.webp'),'./assets/request/model-scene-f02.webp 960w, ./assets/request/model-scene-f02-l.webp 1600w');
  assert.equal(sceneSet('./assets/films/omitok-court-poster-v1.webp'),'','work posters have no large cut');
  assert.equal(sceneSet('blob:http://localhost/x'),'','a customer photo has no large cut');
  // sizes = cover로 그려지는 폭 ÷ 1.47(작은 판으로 1.47배를 넘을 때 큰 판) — 세로 창은 두 조건으로 나눠 적는다(sizes에 「or」를 모르는 브라우저).
  assert.equal(SCENE_SIZES,'(max-width:820px) max(68.1vw,34vh), (max-aspect-ratio:1/1) max(68.1vw,34vh), max(22.1vw,calc(40.8vw - 277px),54.8vh)');
  const flow=readFileSync(new URL('./public/pulse-app/request-flow.mjs',import.meta.url),'utf8');
  assert.ok(flow.includes("function crossfade(img,src,set=''){if(!img||img.getAttribute('src')===src)return;play(img,[{opacity:1},{opacity:.25}],{duration:120}).finished.then(()=>{if(set){img.sizes=SCENE_SIZES;img.srcset=set;}else{img.removeAttribute('srcset');img.removeAttribute('sizes');}img.src=src;"),'swapping the photo swaps (or drops) its srcset before the src — srcset wins over src');
  assert.ok(flow.includes("crossfade($('[data-portrait]'),choiceShot(a),sceneSet(choiceShot(a)))"),'「recommend」 shows a work poster (or the fashion model scene) with its own set');
});

test('the server serves the large cuts next to the small ones',()=>{
  const server=readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
  assert.ok(server.includes("...CASTING_MODELS.map(model=>'model-scene-'+model.id.toLowerCase()),...CASTING_MODELS.map(model=>'model-scene-'+model.id.toLowerCase()+'-l')])files['/pulse-app/assets/request/'+name+'.webp']"));
});
