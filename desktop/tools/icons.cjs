'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),source=path.resolve(root,'../experiences/synk-account/assets');
// platform은 아래 platformOrb가 맡는다. 이 표의 platform 줄은 옛 흰 바탕 아이콘의 원본이고, 지금은 쓰지 않는다
const sources={platform:'synk-logo.svg',world:'sticker-book.webp',messenger:'laptop-felt.webp'};
function ico(images){const header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=6+16*images.length;const entries=images.map(({size,data})=>{const entry=Buffer.alloc(16);entry[0]=entry[1]=size===256?0:size;entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);entry.writeUInt32LE(data.length,8);entry.writeUInt32LE(offset,12);offset+=data.length;return entry;});return Buffer.concat([header,...entries,...images.map(i=>i.data)]);}
function icns(images){const chunks=images.map(({size,data})=>{const header=Buffer.alloc(8);header.write({256:'ic08',512:'ic09',1024:'ic10'}[size],0,4,'ascii');header.writeUInt32BE(8+data.length,4);return Buffer.concat([header,data]);});const header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(8+chunks.reduce((n,b)=>n+b.length,0),4);return Buffer.concat([header,...chunks]);}
// Keep the approved mark and the Windows canvas unchanged. macOS receives the
// same composition at 824 px inside a transparent 1024 px canvas.
async function macCanvas(canvas){
  const image=await sharp(canvas).resize(824,824).png().toBuffer();
  const mask=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="824" height="824"><rect width="824" height="824" rx="185" fill="white"/></svg>');
  const rounded=await sharp(image).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  return sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:rounded,left:100,top:100}]).png().toBuffer();
}
// Platform 아이콘은 검정 구(점 눈) 그림이다(결정 표 11-17 「구의 눈은 점 눈」). 시안 세션이 크기마다 따로 그린 투명 바탕 PNG를
// 그대로 묶고, 큰 그림을 줄여 작은 크기를 만들지 않는다. 그림은 docs/디자인/플랫폼_클라이언트_검정구_20261116/아이콘만들기.cjs가 굽는다.
const ORB_DIR='docs/디자인/플랫폼_클라이언트_검정구_20261116/아이콘',ORB_GENERATOR='docs/디자인/플랫폼_클라이언트_검정구_20261116/아이콘만들기.cjs';
const ORB_ICO=[16,24,32,48,64,128,256],ORB_MAC=[256,512,1024],ORB_WINDOW='synk-1024-둥근점.png';
const orbFile=name=>path.resolve(root,'..',ORB_DIR,name);
// 알파 채널은 원본 그림의 것을 본다. ensureAlpha 뒤의 채널 수는 늘 4라 불투명 그림도 지나갔다(0.4.96 카본 E2)
async function alphaBox(bytes){const meta=await sharp(bytes).metadata();const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x1=info.width,x2=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){x1=Math.min(x1,x);x2=Math.max(x2,x);}return {size:info.width,height:info.height,x1,x2,disc:x2-x1+1,channels:info.channels,hasAlpha:meta.hasAlpha===true};}
// Mac은 다른 앱 아이콘과 같은 크기로 보이게 그림을 1024 가운데의 824 칸에 둔다(world · messenger와 같은 칸). 구는 원이라 모서리를 깎지 않고,
// 그림의 원판(투명하지 않은 둘레)이 그 칸에 꼭 맞도록 줄여 투명한 바탕 가운데에 놓는다. 줄인 폭은 바탕과 짝수 차이로 맞춰 좌우가 같게 한다.
async function orbMacFrame(bytes,size){
  const box=await alphaBox(bytes);if(box.size!==size)throw Error('Orb icon size differs: '+size);
  let n=Math.round(size*(824/1024)*size/box.disc);if((size-n)%2)n-=1;
  const image=await sharp(bytes).resize(n,n).png().toBuffer();
  return sharp({create:{width:size,height:size,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:image,left:(size-n)/2,top:(size-n)/2}]).png().toBuffer();
}
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function platformOrb(out,{macOnly=false}={}){
  const names=[...new Set([...ORB_ICO.map(s=>'synk-'+s+'.png'),...ORB_MAC.map(s=>'synk-'+s+'.png'),ORB_WINDOW])],files={};
  for(const name of names){files[name]=fs.readFileSync(orbFile(name));const box=await alphaBox(files[name]);if(!box.hasAlpha)throw Error('Orb icon needs alpha: '+name);if(box.height!==box.size)throw Error('Orb icon is not square: '+name);}
  for(const size of ORB_ICO){const box=await alphaBox(files['synk-'+size+'.png']);if(box.size!==size)throw Error('Orb icon size differs: '+size);}
  if((await alphaBox(files[ORB_WINDOW])).size!==1024)throw Error('Orb window icon size differs: '+ORB_WINDOW);
  // Mac만 다시 만들 때는 Windows 아이콘(platform.png · platform.ico)을 덮지 않는다(0.4.96 카본 E3)
  if(!macOnly){fs.writeFileSync(path.join(out,'platform.png'),files[ORB_WINDOW]);
  fs.writeFileSync(path.join(out,'platform.ico'),ico(ORB_ICO.map(size=>({size,data:files['synk-'+size+'.png']}))));}
  fs.writeFileSync(path.join(out,'platform.icns'),icns(await Promise.all(ORB_MAC.map(async size=>({size,data:await orbMacFrame(files['synk-'+size+'.png'],size)})))));
  const list=keys=>keys.map(name=>({file:name,sha256:sha(files[name])}));
  return {source:{id:'platform',source:ORB_DIR,generator:ORB_GENERATOR,windows:'platform.ico packs the hand-drawn transparent PNGs 16-256 unchanged; platform.png is '+ORB_WINDOW+' (round-dot eyes survive OS downscaling).',files:list(names)},
    mac:{id:'platform',composition:'Transparent orb; its opaque disc is scaled to the 824 tile centered in the frame; no rounded-rect mask.',files:list(ORB_MAC.map(s=>'synk-'+s+'.png'))}};
}
async function main({macOnly=false}={}){const out=path.join(root,'assets');fs.mkdirSync(out,{recursive:true});const previous=macOnly?JSON.parse(fs.readFileSync(path.join(out,'sources.json'))):null;const ledger={version:3,transformation:'world and messenger: approved existing assets; proportion preserved, centered on white; no recoloring or redrawing. platform: the black orb with dot eyes (decision 11-17), packed from hand-drawn transparent PNGs without redrawing.',mac:{canvas:1024,tile:824,inset:100,radius:185,exterior:'transparent',composition:'world and messenger: existing Windows composition proportionally scaled into the rounded tile; marks unchanged. platform: see its input row.',inputs:[]},sources:[]};
  const orb=await platformOrb(out,{macOnly});ledger.sources.push(orb.source);ledger.mac.inputs.push(orb.mac);
  for(const [id,name]of Object.entries(sources)){if(id==='platform')continue;let canvas,sourceRow;
    if(macOnly){canvas=fs.readFileSync(path.join(out,id+'.png'));sourceRow=previous.sources.find(row=>row.id===id);if(!sourceRow)throw Error('Existing icon provenance missing: '+id);}
    else{const bytes=fs.readFileSync(path.join(source,name));const image=await sharp(bytes,{density:144}).resize(832,832,{fit:'contain',background:'#ffffff'}).png().toBuffer();canvas=await sharp({create:{width:1024,height:1024,channels:4,background:'#ffffff'}}).composite([{input:image,left:96,top:96}]).png().toBuffer();sourceRow={id,source:'experiences/synk-account/assets/'+name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
    const png=async size=>({size,data:await sharp(canvas).resize(size,size).png().toBuffer()});
    if(!macOnly){fs.writeFileSync(path.join(out,id+'.png'),canvas);fs.writeFileSync(path.join(out,id+'.ico'),ico(await Promise.all([16,24,32,48,64,128,256].map(png))));}
    const mac=await macCanvas(canvas);fs.writeFileSync(path.join(out,id+'.icns'),icns(await Promise.all([256,512,1024].map(async size=>({size,data:await sharp(mac).resize(size,size).png().toBuffer()})))));
    ledger.sources.push(sourceRow);ledger.mac.inputs.push({id,file:id+'.png',sha256:crypto.createHash('sha256').update(canvas).digest('hex')});
  }fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(ledger,null,2)+'\n');
}
if(require.main===module){if(process.argv.slice(2).some(arg=>arg!=='--mac-only'))throw Error('Use --mac-only to preserve existing PNG/ICO files');main({macOnly:process.argv.includes('--mac-only')}).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});}
module.exports={ico,icns,macCanvas,orbMacFrame,alphaBox,ORB_DIR,ORB_ICO,ORB_MAC,ORB_WINDOW};
