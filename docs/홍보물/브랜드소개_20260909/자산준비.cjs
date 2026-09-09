'use strict';
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const mascot=require(path.join(root,'tools/lib/마스코트자산.js'));
const checkOnly=process.argv.includes('--검사만');
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
 woolLogo:'docs/Loom_자산/구움/양모워드마크_누끼.png',
 stitch:'영상/public/공방/공방_구분띠스티치.avif'
};
// 09-09 공용 배경 삭제: 아래 복사본은 완성된 이 소개서 재실행에만 쓴다.
// 새 작품의 기본 재료가 아니며, 없어져도 삭제 원본을 다시 굽거나 다른 배경으로 치환하지 않는다.
const frozen=Object.fromEntries(['window','classroom','cafe','house','lake','meadow','city','night','moon']
 .map(key=>[key,path.join(__dirname,'assets',key+'.webp')]));
const order='paper ink mong smile curious notebook compass letter book scissors radio window classroom roof cafe house lake meadow city clipboard seal logo korean headphones night moon woolLogo stitch'.split(' ');
(async()=>{
 if(!checkOnly) fs.mkdirSync(path.join(__dirname,'assets'),{recursive:true});
 const assets=[],tiles=[];let i=0;
 for(const key of order){
  const isFrozen=Object.hasOwn(frozen,key),p=isFrozen?frozen[key]:list[key];
  if(isFrozen&&!fs.existsSync(p)) throw new Error('동결 소개서 복사본 누락: '+key+' — 삭제한 공용 배경은 재생성하지 않습니다. 기존 완성본 복사본을 복구하세요.');
  const source=path.isAbsolute(p)?p:path.join(root,p);const m=await sharp(source).metadata();
  const output=path.join(__dirname,'assets',key+'.webp');
  if(!checkOnly&&!isFrozen&&!fs.existsSync(output)) await sharp(source).resize({width:3840,height:3840,fit:'inside',withoutEnlargement:true}).webp({quality:94,alphaQuality:100}).toFile(output);
  assets.push({key,source:path.relative(root,source).split(path.sep).join('/'),width:m.width,height:m.height,alpha:m.hasAlpha,output:'assets/'+key+'.webp',...(isFrozen?{frozen:true,allowNewWork:false}: {})});
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
