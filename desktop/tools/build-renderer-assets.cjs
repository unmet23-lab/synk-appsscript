'use strict';
// Copy approved source assets without recolouring or rebuilding the SYNK mark.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),target=path.join(root,'desktop/assets/launcher');
const account='experiences/synk-account/assets/';
const sources={
  'synk.svg':account+'synk-logo.svg','SUIT.woff2':account+'SUIT-Variable.woff2',
  'InterTight.woff2':account+'InterTight-700.woff2','DMMono.ttf':account+'DMMono-Medium.ttf',
  'button.webp':account+'slab-coral-long.webp','button-soft.webp':account+'slab-cream-long.webp',
  'chip.webp':account+'chip-blush-long.webp',
  // 계정 포털의 laptop-felt.webp는 10-10에 크림색으로 바뀌었다. PC 앱은 처음부터 쓰던 파란 펠트 노트북(SNS 키트 원본과 같은 파일)을 그대로 쓴다.
  'laptop.webp':'docs/디자인/SNS키트/assets/felt-laptop.webp',
  'world.png':'desktop/assets/world.png','messenger.png':'desktop/assets/messenger.png',
  'world-cover.webp':'experiences/korean-rhythm/assets/signal-stage.webp',
  'world-book.avif':'docs/Loom_자산/구움/공방_책.avif',
  'teacher-cover.png':'docs/디자인/웹_단락이미지/20260919/lab-presentation.png',
  'shift-cover.png':'docs/디자인/웹_단락이미지/20260919/shift-ai-workshop.png',
  'path-cover.png':'docs/디자인/웹_단락이미지/20260919/path-study-plan.png',
  'pulse-cover.png':'docs/디자인/웹_단락이미지/20260919/pulse-music-rights.png',
  'care-note.webp':'docs/디자인/펠트부품/assets/배경/note-brief.webp',
  'fortune-star.avif':'docs/Loom_자산/구움/공방_별똥별.avif',
  'studio-camera.webp':'experiences/entry-check/assets/items/camera.webp',
  'wide-coral.webp':'docs/디자인/펠트부품/assets/ui/wide-coral.webp',
  'wide-lapis.webp':'docs/디자인/펠트부품/assets/배경/wide-lapis.webp',
  'wide-cream.webp':'docs/디자인/펠트부품/assets/배경/wide-cream.webp',
  'wide-black.webp':'docs/디자인/펠트부품/assets/배경/wide-black.webp',
  'wide-butter.webp':'docs/디자인/펠트부품/assets/배경/wide-butter.webp',
  // 회원 혜택 포스터 물건(2026-10-17): 사업 색 바탕에서 GPT 이미지 2.5로 굽고 tools/펠트_바탕색오리기.py로 오렸다.
  // 앨범·리허설 혜택은 10-1x에 지웠다(그림도 혜택물건 폴더에 없다).
  ...Object.fromEntries(['gift','insight','subscriptions','care','fortune'].map(id=>['benefit-'+id+'.webp','docs/디자인/플랫폼_시그널/혜택물건/benefit-'+id+'.webp'])),
  'engine.js':'atlas/engine.js','personalization.js':'atlas/personalization.js',
  // WORLD 「들어 있는 것」의 게임 화면(2026-10-21 지금 WORLD 게임을 휴대폰 세로로 찍은 것). 옛 LAB 시절 사진과 WORLD에 없는 레이싱은 뺐다.
  ...Object.fromEntries(['runner','rhythm','hangul'].map(id=>[id+'.jpg','docs/디자인/플랫폼_시그널/WORLD게임화면/'+id+'.jpg'])),
};
fs.mkdirSync(target,{recursive:true});
// 원본이 저장소에 없는 그림(공방_책.avif 등)은 앞서 승인해 복사해 둔 사본이 기록된 해시와 같을 때만 그대로 쓴다.
const recorded=(()=>{try{return Object.fromEntries(JSON.parse(fs.readFileSync(path.join(target,'sources.json'),'utf8')).assets.map(a=>[a.name,a]));}catch{return {};}})();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assets=Object.entries(sources).map(([name,source])=>{
  const from=path.join(root,source),copy=path.join(target,name);
  if(!fs.existsSync(from)&&fs.existsSync(copy)&&recorded[name]?.source===source&&sha(fs.readFileSync(copy))===recorded[name].sha256)return recorded[name];
  // 글 파일은 줄끝을 LF로 맞춰 윈도 작업본(core.autocrlf)에서도 같은 해시가 나오게 한다.
  let bytes=fs.readFileSync(from);if(/\.(svg|js|json)$/i.test(name))bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
  fs.writeFileSync(copy,bytes);return {name,source,bytes:bytes.length,sha256:sha(bytes)};
});
fs.writeFileSync(path.join(target,'sources.json'),JSON.stringify({note:'Approved assets copied unchanged. Screenshots show existing development content, not released content or learning-effect evidence.',assets},null,2)+'\n');
console.log('Launcher assets:',assets.length);
