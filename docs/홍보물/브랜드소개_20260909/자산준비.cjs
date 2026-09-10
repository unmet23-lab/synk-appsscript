'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const mascot=require(path.join(root,'tools/lib/마스코트자산.js'));
const checkOnly=process.argv.includes('--검사만');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const selectedArg=process.argv.find(arg=>arg.startsWith('--keys='));
const selected=selectedArg?new Set(selectedArg.slice(7).split(',')):null;
const manifestPath=path.join(__dirname,'자산명세.json');
const previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):[];
// 이 목록만 새 제작에 쓸 수 있는 공용 원천이다.
const list={
 paper:'영상/public/공방/Paper_4K.avif',ink:'영상/public/공방/Ink_4K.avif',
 mong:mascot.절대경로('본체',{누끼:true}),smile:mascot.절대경로('눈웃음',{누끼:true}),curious:mascot.절대경로('궁금함',{누끼:true}),
 notebook:'영상/public/공방/공방_공책과연필.avif',compass:'영상/public/공방/공방_나침반.avif',
 letter:'영상/public/공방/공방_편지봉투.avif',book:'영상/public/공방/공방_책.avif',
 scissors:'영상/public/공방/공방_가위.avif',radio:'영상/public/공방/라디오_4K.avif',
 roof:'영상/public/공방/공방_별보는지붕.avif',
 clipboard:'영상/public/공방/무대_클립보드_4K.avif',seal:'영상/public/공방/무대_도장_4K.avif',
 logo:'영상/public/공방/로고찡긋플레이팅_4K.avif',korean:'영상/public/공방/ㄱ_4K.avif',
 headphones:'영상/public/공방/공방_꾸밈_헤드폰코랄.avif',
 woolLogo:'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink.png',
 stitch:'영상/public/공방/공방_구분띠스티치.avif'
};
// 09-09 공용 배경 삭제: 아래 복사본은 완성된 이 소개서 재실행에만 쓴다.
// 새 작품의 기본 재료가 아니며, 없어져도 삭제 원본을 다시 굽거나 다른 배경으로 치환하지 않는다.
const frozen=Object.fromEntries(['window','classroom','cafe','house','lake','meadow','city','night','moon']
 .map(key=>[key,path.join(__dirname,'assets',key+'.webp')]));
const order='paper ink mong smile curious notebook compass letter book scissors radio window classroom roof cafe house lake meadow city clipboard seal logo korean headphones night moon woolLogo stitch'.split(' ');
(async()=>{
 if(selected&&[...selected].some(key=>!order.includes(key)))throw new Error('알 수 없는 자산 선택: '+[...selected].filter(key=>!order.includes(key)).join(','));
 if(!checkOnly) fs.mkdirSync(path.join(__dirname,'assets'),{recursive:true});
 const assets=[],tiles=[];let i=0;
 for(const key of order){
  const isFrozen=Object.hasOwn(frozen,key),p=isFrozen?frozen[key]:list[key];
  if(isFrozen&&!fs.existsSync(p)) throw new Error('동결 소개서 복사본 누락: '+key+' — 삭제한 공용 배경은 재생성하지 않습니다. 기존 완성본 복사본을 복구하세요.');
  const source=path.isAbsolute(p)?p:path.join(root,p);const m=await sharp(source).metadata();
  const output=path.join(__dirname,'assets',key+'.webp');
  const recipe=key==='woolLogo'?'trim12-2820-webp-lossless-v1':'inside-3840-webp-q94-alpha100-v1';
  const sourceSha256=sha(fs.readFileSync(source));
  let outputSha256=fs.existsSync(output)?sha(fs.readFileSync(output)):null,stale=false;
  const prior=previous.find(a=>a.key===key);
  // 존재 여부만 보면 정본 교정이 누락된다. 원본·변환 규격·실제 출력 지문을 함께 확인한다.
  // 동결 배경은 자신이 원천인 완성 사본이므로 변환하거나 덮어쓰지 않는다.
  if(!isFrozen&&(!selected||selected.has(key))&&!(outputSha256&&prior?.sourceSha256===sourceSha256&&prior?.outputSha256===outputSha256&&prior?.recipe===recipe)){
   const bytes=await (key==='woolLogo'?sharp(source).trim({threshold:12}).resize({width:2820}).webp({lossless:true}):sharp(source).resize({width:3840,height:3840,fit:'inside',withoutEnlargement:true}).webp({quality:94,alphaQuality:100})).toBuffer();
   const expected=sha(bytes);stale=outputSha256!==expected;
   if(stale&&!checkOnly){const pending=output+'.asset-pending';fs.writeFileSync(pending,bytes);fs.renameSync(pending,output);outputSha256=expected;}
  }
  assets.push(selected&&!selected.has(key)&&!isFrozen&&prior?prior:{key,source:path.relative(root,source).split(path.sep).join('/'),width:m.width,height:m.height,alpha:m.hasAlpha,output:'assets/'+key+'.webp',sourceSha256,outputSha256,...(isFrozen?{frozen:true,allowNewWork:false}:{recipe}),...(checkOnly?{stale}: {})});
  if(checkOnly) continue;
  const thumb=await sharp(source).resize(230,190,{fit:'contain',background:'#FBF7F0'}).png().toBuffer();
  const x=(i%6)*250,y=Math.floor(i/6)*230;
  tiles.push({input:thumb,left:x+10,top:y+8});
  tiles.push({input:Buffer.from(`<svg width="245" height="26"><text x="10" y="20" font-family="Arial" font-size="15" fill="#2B2320">${key} · ${m.width}×${m.height}</text></svg>`),left:x,top:y+200});i++;
 }
 if(checkOnly){console.log(JSON.stringify({checked:assets.length,frozen:assets.filter(a=>a.frozen).length,filesWritten:0,assets}));return;}
 await sharp({create:{width:1500,height:Math.ceil(i/6)*230,channels:3,background:'#FBF7F0'}}).composite(tiles).png().toFile(path.join(__dirname,'자산보기.png'));
 fs.writeFileSync(path.join(__dirname,'자산명세.json'),JSON.stringify(assets,null,2));
 console.log(JSON.stringify(assets.map(a=>({key:a.key,w:a.width,h:a.height,alpha:a.alpha}))));
})().catch(e=>{console.error(e.message);process.exitCode=1});
