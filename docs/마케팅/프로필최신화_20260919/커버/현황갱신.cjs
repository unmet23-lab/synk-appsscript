'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const at=n=>path.join(__dirname,n);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function main(){
  const manifest=JSON.parse(fs.readFileSync(at('명세.json'),'utf8'));
  const state=JSON.parse(fs.readFileSync(path.join(__dirname,'../실행상태.json'),'utf8'));
  manifest.status='partially-published-see-execution-status';
  manifest.updatedAt=new Date().toISOString();
  manifest.executionStatus='../실행상태.json';
  manifest.promptRecord='../반영기록_20260919.md';
  const rendered=[];
  for(const [i,item] of manifest.outputs.entries()){
    const p=at(item.file),m=await sharp(p).metadata();
    if(m.width!==item.w||m.height!==item.h) throw Error(`Wrong dimensions: ${item.id}`);
    item.bytes=fs.statSync(p).size;item.sha256=hash(p);
    item.printedText=[];delete item.headline;
    item.publication=state.accounts.find(a=>a.id===item.id)?.status;
    item.liveCropVerified=['lab-youtube','synkbrief-youtube','lab-facebook'].includes(item.id);
    if(item.id!=='shift-tistory'){
      let preview=sharp(p);
      if(item.mode==='youtube') preview=preview.extract({left:508,top:509,width:1544,height:422});
      await preview.resize(390,item.mobile.height,{fit:'fill'}).png().toFile(at(item.mobile.file));
      item.mobile.sha256=hash(at(item.mobile.file));
    }
    if(['synk-linkedin-company','yuhobuilds-youtube','shift-pinterest'].includes(item.id)){
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${item.w}" height="${item.h}" viewBox="0 0 ${item.w} ${item.h}"><image width="${item.w}" height="${item.h}" href="${item.file}"/></svg>`;
      fs.writeFileSync(at(`${item.id}.svg`),svg);
      fs.writeFileSync(at(`${item.id}.html`),`<!doctype html><meta charset="utf-8"><style>body{margin:0}img{display:block;width:100%}</style><img src="${item.file}" alt="${item.id} 펠트 커버">`);
      fs.writeFileSync(at(`${item.id}.mobile.html`),`<!doctype html><meta charset="utf-8"><style>body{margin:0}</style><img src="${item.mobile.file}" alt="${item.id} 로컬 안전영역 미리보기">`);
    }
    const thumb=await sharp(p).resize(600,190,{fit:'contain',background:'#eeeae4'}).png().toBuffer();
    rendered.push({input:thumb,left:10+(i%2)*620,top:10+Math.floor(i/2)*230});
    const title=Buffer.from(`<svg width="600" height="28"><text x="4" y="20" font-family="Arial" font-size="17">${item.id}</text></svg>`);
    rendered.push({input:title,left:10+(i%2)*620,top:203+Math.floor(i/2)*230});
  }
  await sharp({create:{width:1240,height:Math.ceil(manifest.outputs.length/2)*230,channels:3,background:'#eeeae4'}}).composite(rendered).png().toFile(at('contact-sheet.png'));
  for(const file of ['synk-company-safe-gpt-source.png','shift-centered-gpt-source.png','synk-linkedin-company-safe-gpt.png','yuhobuilds-youtube-safe-gpt.png','shift-pinterest-safe-gpt.png']){
    const rel='docs/마케팅/프로필최신화_20260919/커버/'+file;
    const entry={file:rel,sha256:hash(at(file))};
    const n=manifest.sources.findIndex(s=>s.file===rel);
    if(n<0)manifest.sources.push(entry);else manifest.sources[n]=entry;
  }
  fs.writeFileSync(at('명세.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({checked:manifest.outputs.length,published:state.covers.published,verified:state.covers.verified}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
