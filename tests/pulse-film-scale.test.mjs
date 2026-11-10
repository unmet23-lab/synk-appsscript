// PULSE 고객 앱 첫 화면 3쪽 「이렇게 만들어요」 인물 장면이 큰 모니터에서 늘어나지 않는지 본다(11-10 배율 후속, 커밋 8928093c2d).
// 저장소 전용 도구 tools/화면배율.mjs의 기기 · 셈을 쓰므로 회사 폴더가 아니라 저장소 시험에 둔다. 회사 폴더 시험이 이 도구를
// 불러오면 회사 이미지 판의 격리 QA 사본(회사 원천만)에서 ERR_MODULE_NOT_FOUND로 실패한다(사슬 60 준비에서 드러남, 11-10).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {기기들,기본기준,늘어난배율} from '../tools/화면배율.mjs';
import {entryView} from '../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/film-home.mjs';

const appDir=new URL('../docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/',import.meta.url);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const narrowBlock=css=>{const open=['\n','\r\n'].map(nl=>css.indexOf(`@media (max-width:820px),(max-aspect-ratio:1/1){${nl}`)).find(at=>at>=0);return css.slice(open,css.indexOf('/* 제목 어절 나타나기(motion.mjs) */'));};
const webpSize=bytes=>{
  const kind=bytes.toString('latin1',12,16);
  if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  throw new Error(`not a webp: ${kind}`);
};

// 3쪽 인물 장면 그림(폭 960)이 큰 모니터(2560×1440)에서 1485px 화면에 1.55배로 늘어났다(tools/화면배율.mjs, 사슬 59 반영 뒤 확인).
// 그림을 새로 굽지 않고, 글 칸이 「42%」와 「화면을 상한에 두는 폭」 가운데 큰 쪽을 쓴다 — 오른쪽 화면은 그 나머지라 칸 안에 빈 띠가 생기지 않는다.
// 아래 셈은 화면배율 도구와 같은 기기 · 같은 셈(cover는 더 늘어난 축, 100분의 1에서 반올림)이다.
test('on a big monitor the cast photos of the three checks stay under the stretch limit: the copy column takes the width the photos cannot fill, while 1920, 1440 and phones keep their split',()=>{
  const css=read('film.css'),narrow=narrowBlock(css),wide=css.slice(0,css.indexOf(narrow));
  const column=wide.match(/\.sx-check\{flex:0 0 max\((\d+)%,calc\(100% - (\d+)px\)\);/);
  assert.ok(column,'the copy column is the larger of its share and what leaves the photo stage at its cap');
  const share=Number(column[1])/100,cap=Number(column[2]);
  assert.match(wide,/\.sx-p\.is-check\{padding:0;/,'the row spans the whole window, so the shares are of the window width');
  assert.match(wide,/\.sx-check-stage\{flex:1;position:relative;overflow:hidden;/,'the photo stage is the rest of the row: no band between the copy and the photo');
  assert.doesNotMatch(css,/\.sx-check-stage\{[^}]*max-(width|height)/,'the stage is never capped on its own, which would leave a band');
  assert.match(wide,/\.sx-pane-cast img,\.sx-pane-cuts img\{width:100%;height:100%;object-fit:cover;/,'the photos cover the stage');
  // 세로 창(휴대폰 · 세로 태블릿)은 화면이 위 · 글이 아래로 쌓여 폭을 꽉 채운다 — 넓은 창의 상한을 덮는다.
  assert.ok(narrow.includes('.sx-check{flex:none;width:100%;'),'portrait windows stack the copy under the stage and ignore the cap');
  const tall=Number(narrow.match(/\.sx-check-stage\{flex:none;width:100%;height:(\d+)vh;/)[1])/100;
  const stageOf=({w,h})=>w>820&&w>h?[Math.min((1-share)*w,cap),h]:[w,tall*h];
  const pane=entryView({}).match(/<div class="sx-pane sx-pane-cast[^"]*">([\s\S]*?)<\/div>/)[1];
  const photos=[...pane.matchAll(/model-scene-[a-z]\d+\.webp/g)].map(found=>found[0]);
  assert.equal(photos.length,4,'four people take turns on the stage');
  for(const name of photos){
    const [nw,nh]=webpSize(readFileSync(new URL(`assets/request/${name}`,appDir)));
    for(const device of 기기들){
      const [칸폭,칸높이]=stageOf(device);
      const scale=늘어난배율({칸폭,칸높이,원본폭:nw,원본높이:nh,맞춤:'cover',화소비:device.화소비});
      assert.ok(scale<기본기준,`${name} ${nw}×${nh} on ${device.w}×${device.h} at ${device.화소비}x: stage ${Math.round(칸폭)}×${Math.round(칸높이)} stretches it ${scale}×`);
    }
  }
  // 상한은 큰 모니터만 건드린다 — 1920 · 1440 · 1366 창은 옛 42 : 58 그대로다(11-10 실측: 칸 1114×1080 · 835×900 · 792×768이 고치기 전과 같다).
  for(const w of [1366,1440,1920])assert.equal(Math.max(share*w,w-cap),share*w,`a ${w} window keeps the ${Math.round(share*100)}% copy column`);
  assert.equal(stageOf({w:2560,h:1440})[0],cap,'a 2560 monitor gets the capped stage');
});
