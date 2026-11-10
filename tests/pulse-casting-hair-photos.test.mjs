// PULSE 고객 앱 옷 · 머리 고르기(11-10)의 머리 사진이 캐스팅북 빌드와 같은 바이트인지 본다. 회사 폴더 시험(pulse-casting-photos.test.mjs)은
// 회사 판이 가진 바이트를 해시로 고정하고, 여기서는 그 해시의 출처 — 캐스팅북 빌드 site/img/<코드>/<컷>-s.webp — 와 견준다.
// 캐스팅북 원천을 읽으므로 회사 폴더가 아니라 저장소 시험에 둔다(회사 이미지 판의 격리 QA 사본에는 회사 폴더만 있다 — pulse-model-films-book.test.mjs와 같은 까닭).
// site/는 git 밖 빌드 산출물이라 빌드한 작업본(공용 작업본)에서만 돈다. 다른 사본은 PULSE_CASTING_SITE=<…/site>로 그 빌드를 가리킬 수 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CASTING_MODELS,modelLooks} from '../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/casting-catalog.mjs';

const app=new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/',import.meta.url);
const site=process.env.PULSE_CASTING_SITE||fileURLToPath(new URL('../docs/마케팅/PULSE_AI모델_캐스팅_20260930/site/',import.meta.url));
const built=existsSync(site+'/img/F02/hair-2-s.webp');

test('the hair photos are byte copies of the casting book build (hair 2 · 3, and F04 hair 1 = the book portrait)',{skip:built?false:'캐스팅북 빌드(site/)가 이 사본에 없다'},()=>{
  const bytes=path=>readFileSync(path);
  for(const model of CASTING_MODELS){
    const [one,two,three]=modelLooks(model.id).hairs,code=model.id;
    assert.ok(bytes(new URL(two.src,app)).equals(bytes(`${site}/img/${code}/hair-2-s.webp`)),code+' hair 2');
    assert.ok(bytes(new URL(three.src,app)).equals(bytes(`${site}/img/${code}/hair-3-s.webp`)),code+' hair 3');
    // 머리 1은 대표 사진이다(캐스팅북도 hair-1 = hero). 앱 대표 사진이 캐스팅북 판과 같으면 그것을, 다르면(F04) 캐스팅북 판을 따로 둔다.
    assert.ok(bytes(new URL(one.src,app)).equals(bytes(`${site}/img/${code}/hero-s.webp`)),code+' hair 1 is the book portrait');
  }
});

test('the outfit photos stay the copies the casting book builds (full body · look 1 · look 2)',{skip:built?false:'캐스팅북 빌드(site/)가 이 사본에 없다'},()=>{
  for(const model of CASTING_MODELS)for(const outfit of modelLooks(model.id).outfits)
    assert.ok(readFileSync(new URL(outfit.src,app)).equals(readFileSync(`${site}/img/${model.id}/${outfit.id}-s.webp`)),model.id+' '+outfit.id);
});
