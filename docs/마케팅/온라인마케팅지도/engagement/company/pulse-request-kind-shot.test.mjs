import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

// 의뢰서 모델 단계에서 「추천해 주세요」 · 「사람 없이 제품만」을 고르면 큰 칸에 업종 작품 그림이 놓인다(KINDS shot). 작품 그림은 큰 판이 없어
// 칸을 채우면 실제 화소의 1.5배 넘게 늘었고(11-12 실측 — 기준 화면 1440×900 @1.5에서 가로 작품 1.88배, 휴대폰 세로 작품 1.63배),
// 가로 작품은 세로 칸에 잘려 가운데 띠만 남았다. 이제 그림마다 꼴(shotShape)을 적고, 큰 칸은 그 꼴대로 늘리지 않고 놓는다.
// 이 시험은 회사 원천만 읽는다. 화면마다 몇 배인지는 저장소 시험 tests/pulse-request-kind-shot-scale.test.mjs.
globalThis.location??=new URL('http://localhost/pulse-app/');
const appDir=new URL('./public/pulse-app/',import.meta.url);
const {KINDS}=await import(new URL('request-data.mjs',appDir).href);
const {shotShape,sceneSet}=await import(new URL('request-flow.mjs',appDir).href);
const read=name=>readFileSync(new URL(name,appDir),'utf8');
const webpSize=bytes=>{
  const kind=bytes.toString('latin1',12,16);
  if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  throw new Error(`not a webp: ${kind}`);
};

test('every business picture says its shape, and the shape is the file’s own',()=>{
  for(const kind of KINDS){
    assert.ok(kind.shotShape,`${kind.id} has a shape`);
    if(kind.shotShape==='scene'){
      // 모델 장면 사진(작은 판 폭 960): 의뢰서 큰 칸에서는 큰 판 srcset으로 채우고(pulse-model-scene-large 시험), 스크린 · 광고 틀에서는 꼴대로 맞춘다.
      assert.ok(sceneSet(kind.shot),`${kind.id}: a model scene keeps its large cut`);
      assert.equal(webpSize(readFileSync(new URL(kind.shot.replace('./',''),appDir)))[0],960,`${kind.id}: the small cut is 960 wide`);
      assert.equal(shotShape(kind.shot),'scene');
      continue;
    }
    const file=new URL(kind.shot.replace('./',''),appDir);
    assert.ok(existsSync(file),kind.shot);
    const [w,h]=webpSize(readFileSync(file));
    const ratio=w/h;
    if(kind.shotShape==='tall')assert.ok(Math.abs(ratio-9/16)<0.01,`${kind.id}: ${w}×${h} is a 9:16 picture`);
    else if(kind.shotShape==='wide')assert.ok(Math.abs(ratio-16/9)<0.01,`${kind.id}: ${w}×${h} is a 16:9 picture`);
    else assert.fail(`${kind.id}: unknown shape ${kind.shotShape}`);
    // 세로 작품의 규칙은 4초 영상(720×1280)과 같다 — 그보다 작은 그림이면 그 규칙으로도 1.5배를 넘는다.
    assert.ok(Math.min(w,h)>=720,`${kind.id}: ${w}×${h} is at least as large as the clip the rules were set for`);
    assert.equal(sceneSet(kind.shot),'',`${kind.id}: a work picture has no large cut`);
    assert.equal(shotShape(kind.shot),kind.shotShape);
  }
  assert.ok(KINDS.some(kind=>kind.shotShape==='wide')&&KINDS.some(kind=>kind.shotShape==='tall'));
  assert.equal(shotShape('blob:http://localhost/x'),'','a customer photo has no shape — it fills as before');
  assert.equal(shotShape('./assets/request/model-scene-f02.webp'),'','a model scene that is no business picture has no shape');
  // 업종을 고르기 전 「추천해 주세요」의 그림(still('w-gift-sphere'))도 화장품 업종과 같은 그림이라 꼴이 있다.
  assert.equal(shotShape('./assets/request/w-gift-sphere.webp'),'tall');
});

test('the big portrait carries the shape on first paint and on every swap, and swaps only once the next picture is in',()=>{
  const flow=read('request-flow.mjs');
  assert.ok(flow.includes('const portraitImg=src=>{const set=sceneSet(src),shape=set?\'\':shotShape(src);return `<img data-portrait src="${esc(src)}"${set?` srcset="${esc(set)}" sizes="${SCENE_SIZES}"`:\'\'}${shape?` data-shot="${shape}"`:\'\'} alt="" decoding="async">`;};'));
  assert.ok(flow.includes("const shape=set?'':shotShape(src);if(shape)img.dataset.shot=shape;else delete img.dataset.shot;img.src=src;"),'the shape changes with the src, not before it — the old photo is never drawn in the new shape; a picture with a large cut fills as before');
  assert.ok(flow.includes("Promise.all([play(img,[{opacity:1},{opacity:.25}],{duration:120}).finished,next.decode?next.decode().catch(()=>{}):null]).then(()=>{if(swaps.get(img)!==token)return;"),'the swap waits for the next picture, and a later pick wins over an earlier one still loading');
  assert.ok(flow.includes("if(img.getAttribute('src')===src){if(pending){swaps.delete(img);play(img,[{opacity:.25},{opacity:1}],{duration:300});}return;}"),'going back to the picture already shown drops the pending swap and lifts the dimming');
});

test('the work pictures are fitted, never filled past their pixels: tall ones ride the clip’s rules, wide ones sit whole like a screen in a dark room',()=>{
  const css=read('film.css');
  assert.ok(css.includes('.sx-casting-lead img[data-shot]{object-fit:contain;object-position:50% 50%;background:#000}'));
  assert.doesNotMatch(css,/img\[data-shot=wide\][^{]*\{[^}]*object-fit:cover/,'a wide work is never cropped into the tall box');
  // Fable 5.2 P2(11-12): 세로 작품을 채울 때 자르는 자리는 영상과 같은 50% 22%(가운데면 1920 창에서 정수리가 잘린다),
  // 세로 창의 큰 칸은 가로 작품을 칸 위에 붙인다(62dvh 칸 가운데 두면 위아래 검정이 빈 칸처럼 보인다). 칸 높이는 그림 꼴에 묶지 않는다 —
  // 묶으면 후보 칸을 가리켜 사람 사진이 될 때 칸이 커져 후보 칸이 마우스 밑에서 밀린다(Fable 5.2 다시 검수 P2).
  assert.ok(css.includes('.sx-casting-lead img[data-shot=tall]{object-position:50% 22%}'));
  assert.ok(css.includes('  .sx-casting-lead img[data-shot=wide]{object-position:50% 0}'),'portrait windows: a wide work sits at the top of the box, right under the words');
  assert.doesNotMatch(css,/\.sx-casting-lead:has\([^)]*data-shot/,'the box height never follows the picture shape');
  assert.ok(css.includes('@container (max-aspect-ratio:9/16){.sx-casting-lead video,.sx-casting-lead img[data-shot=tall]{object-fit:cover}}'),'tall works fill only where the clip does');
  const tallBands=css.match(/\.sx-casting-lead video,\.sx-casting-lead img\[data-shot=tall\]\{object-fit:cover\}/g)||[];
  assert.equal(tallBands.length,7,'the narrow-box rule and the six pixel-ratio bands');
  const tallCaps=css.match(/\.sx-casting-lead video,\.sx-casting-lead img\[data-shot=tall\]\{object-fit:contain;padding-block:/g)||[];
  assert.equal(tallCaps.length,7,'the seven height bands');
  const wideCaps=[...css.matchAll(/\(max-resolution:([\d.]+)dppx\)\{@container \(min-width:(\d+)px\)\{\.sx-casting-lead img\[data-shot=wide\]\{padding-inline:calc\(\(100cqw - (\d+)px\)\/2\)\}\}\}/g)];
  assert.equal(wideCaps.length,7,'seven width bands, up to a pixel ratio of 4');
  for(const [query,ratio,over,cap] of wideCaps){
    assert.equal(Number(over)-1,Number(cap),`${query}: the padding starts right above the cap`);
    assert.ok(Number(cap)*Number(ratio)/1280<1.5,`${query}: a ${cap}px wide work at ${ratio}x`);
  }
  assert.doesNotMatch(css,/resolution <=|< resolution/,'no media range syntax (Safari 16.0–16.3 drops the whole rule)');
});

test('the first step’s screen shows the same picture whole, never past 1.47× its pixels at any pixel ratio',()=>{
  const flow=read('request-flow.mjs'),css=read('film.css');
  assert.ok(flow.includes("if(id==='what'){const kind=kindOf(a),src=kind?.shot||still('w-gift-sphere'),shape=shotShape(src);monSwap(`<img class=\"sx-q-fill\" data-still src=\"${esc(src)}\"${shape?` data-shot=\"${shape}\"`:''} alt=\"\">"),'the first paint carries the shape');
  assert.ok(flow.includes("kind(el){a.kind=el.dataset.id;setRows('kind',a.kind);crossfade($('[data-still]'),kindOf(a).shot);"),'changing the business swaps the picture (and its shape) through crossfade');
  // 말 · 글자 단계의 광고 틀도 같은 그림이다 — 틀 비율이 달라도 자르지 않고 틀 안에 맞춘다. 손님이 올린 사진은 꼴이 없다(채우던 그대로).
  assert.ok(flow.includes("const own=ownPhoto(a),shot=kindOf(a)?.shot,shape=own?'':shotShape(shot);"));
  assert.ok(flow.includes("`<img class=\"sx-q-fill\" src=\"${esc(own||shot||still(id==='words'?'w-gift':'w-gift-snow'))}\"${shape?` data-shot=\"${shape}\"`:''} alt=\"\">"));
  assert.ok(css.includes('.sx-q-screen:has(>.sx-q-view>.sx-q-fill[data-shot]){background:#000}'),'only a picture placed straight on the screen turns the screen black — an ad frame keeps its edge');
  // 휴대폰 첫 단계 띠(19dvh, Fable 5.2 P2): 세로 작품 · 모델 장면은 오른쪽에 붙고, 이름 글줄은 그 왼쪽 빈자리에만(그림 폭 ≤ 띠 높이 × .75).
  assert.ok(css.includes('  .sx-q[data-step=what] .sx-q-fill:is([data-shot=tall],[data-shot=scene]){margin-right:var(--sx-m);object-position:100% 50%}'));
  assert.ok(css.includes('>.sx-q-cap{max-width:calc(100% - 2*var(--sx-m) - 19vh*.75 - 16px);max-width:calc(100% - 2*var(--sx-m) - 19dvh*.75 - 16px)}'),'the name line stays clear of the picture');
  assert.ok(css.includes('  .sx-q[data-step=what] .sx-q-screen{height:19vh;height:19dvh}'),'the strip height the caption width counts on');
  assert.ok(css.includes('.sx-q-fill[data-shot]{--shot-k:1.47;object-fit:contain;margin:auto;max-width:calc(var(--shot-w) * var(--shot-k));max-height:calc(var(--shot-h) * var(--shot-k))}'),'fitted whole, centred, capped on both sides');
  // 꼴마다 적은 원본 폭 · 높이가 그 꼴 그림의 실제 화소 이하라야 상한(원본 × k)이 실제 화소의 k배 안에 든다.
  const declared=Object.fromEntries([...css.matchAll(/\.sx-q-fill\[data-shot=(\w+)\]\{--shot-w:(\d+)px;--shot-h:(\d+)px\}/g)].map(([,shape,w,h])=>[shape,[Number(w),Number(h)]]));
  assert.deepEqual(Object.keys(declared).sort(),['scene','tall','wide']);
  for(const kind of KINDS){
    const [w,h]=webpSize(readFileSync(new URL(kind.shot.replace('./',''),appDir))),[dw,dh]=declared[kind.shotShape];
    assert.ok(dw<=w&&dh<=h,`${kind.id}: declared ${dw}×${dh} within the real ${w}×${h}`);
  }
  // 화소비 띠: 「앞 위 끝 < 화소비」마다 k를 낮춘다(뒤 규칙이 이긴다 — 틈 없음). k × 띠의 위 끝 < 1.5.
  const bands=[...css.matchAll(/@media not all and \(max-resolution:([\d.]+)dppx\)\{\.sx-q-fill\[data-shot\]\{--shot-k:([\d.]+)\}\}/g)].map(([,lo,k])=>({lo:Number(lo),k:Number(k)}));
  assert.deepEqual(bands.map(b=>b.lo),[1,1.25,1.5,2,2.5,3,4]);
  const tops=[1.25,1.5,2,2.5,3,4,5];
  assert.ok(1.47*1<1.5,'up to 1x');
  bands.forEach((band,i)=>assert.ok(band.k*tops[i]<1.5,`over ${band.lo}x up to ${tops[i]}x: k ${band.k}`));
  const at=css.indexOf('.sx-q-fill[data-shot]{--shot-k:1.47'),first=css.indexOf('@media not all and (max-resolution:1dppx){.sx-q-fill[data-shot]');
  assert.ok(at>0&&first>at,'the bands come after the base so they win');
});
