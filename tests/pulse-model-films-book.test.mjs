// PULSE 고객 앱 의뢰서 모델 단계의 4초(11-10)가 캐스팅북(synk.im/pulse/casting) 모델 벽 영상을 그 주소에서 받으므로,
// 고객 앱의 사람 목록 · 주소가 캐스팅북 빌드 규칙과 맞는지 본다. 캐스팅북 원천(docs/마케팅/PULSE_AI모델_캐스팅_20260930)을 읽어
// 회사 폴더 시험이 아니라 저장소 시험에 둔다 — 회사 이미지 판의 격리 QA 사본에는 회사 폴더만 있다(pulse-film-scale.test.mjs와 같은 까닭).
// 캐스팅북 빌드(build-site.cjs)는 wall.json의 photo에 없는 사람마다 video/<코드>-wall.mp4 · img/<코드>/wall.webp를 싣고 파일이 없으면 멈춘다 —
// 어긋나면 고객 앱 영상이 404로 비어 사진만 남는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CASTING_MODELS} from '../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/casting-catalog.mjs';

globalThis.location??=new URL('http://localhost/pulse-app/');
const {MOVING_MODELS,modelFilm}=await import('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/request-flow.mjs');
const book=new URL('../docs/마케팅/PULSE_AI모델_캐스팅_20260930/',import.meta.url);
const read=name=>readFileSync(new URL(name,book),'utf8');

test('the moving models are exactly the people the casting book wall films',()=>{
  const wall=JSON.parse(read('wall.json'));
  const ids=CASTING_MODELS.map(model=>model.id);
  assert.deepEqual([...wall.order].sort(),[...ids].sort(),'the book wall and the app list the same people');
  assert.deepEqual([...MOVING_MODELS].sort(),ids.filter(id=>!Object.hasOwn(wall.photo,id)).sort(),'everyone the book films moves here, and the photo-only people stay photos');
});

test('the app points at the paths the casting book builds and publishes',()=>{
  const build=read('build-site.cjs'),publish=read('publish-candidate.cjs');
  assert.ok(build.includes('rel = `video/${m.code}-wall.mp4`, poster = `img/${m.code}/wall.webp`'),'the book builds each clip and its first-frame poster under these names');
  assert.match(publish,/<후보 폴더>\/pulse\/casting\//,'the book is published under /pulse/casting/');
  for(const id of MOVING_MODELS){
    const film=modelFilm({id});
    assert.equal(film.src,`https://synk.im/pulse/casting/video/${id}-wall.mp4`);
    assert.equal(film.poster,`https://synk.im/pulse/casting/img/${id}/wall.webp`);
  }
});
