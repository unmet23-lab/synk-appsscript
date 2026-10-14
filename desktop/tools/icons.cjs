'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),source=path.resolve(root,'../experiences/synk-account/assets');
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
async function main({macOnly=false}={}){const out=path.join(root,'assets');fs.mkdirSync(out,{recursive:true});const previous=macOnly?JSON.parse(fs.readFileSync(path.join(out,'sources.json'))):null;const ledger={version:2,transformation:'Approved existing assets; proportion preserved, centered on white; no recoloring or redrawing.',mac:{canvas:1024,tile:824,inset:100,radius:185,exterior:'transparent',composition:'Existing Windows composition proportionally scaled into the tile; marks unchanged.',inputs:[]},sources:[]};
  for(const [id,name]of Object.entries(sources)){let canvas,sourceRow;
    if(macOnly){canvas=fs.readFileSync(path.join(out,id+'.png'));sourceRow=previous.sources.find(row=>row.id===id);if(!sourceRow)throw Error('Existing icon provenance missing: '+id);}
    else{const bytes=fs.readFileSync(path.join(source,name));const image=await sharp(bytes,{density:144}).resize(832,832,{fit:'contain',background:'#ffffff'}).png().toBuffer();canvas=await sharp({create:{width:1024,height:1024,channels:4,background:'#ffffff'}}).composite([{input:image,left:96,top:96}]).png().toBuffer();sourceRow={id,source:'experiences/synk-account/assets/'+name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
    const png=async size=>({size,data:await sharp(canvas).resize(size,size).png().toBuffer()});
    if(!macOnly){fs.writeFileSync(path.join(out,id+'.png'),canvas);fs.writeFileSync(path.join(out,id+'.ico'),ico(await Promise.all([16,24,32,48,64,128,256].map(png))));}
    const mac=await macCanvas(canvas);fs.writeFileSync(path.join(out,id+'.icns'),icns(await Promise.all([256,512,1024].map(async size=>({size,data:await sharp(mac).resize(size,size).png().toBuffer()})))));
    ledger.sources.push(sourceRow);ledger.mac.inputs.push({id,file:id+'.png',sha256:crypto.createHash('sha256').update(canvas).digest('hex')});
  }fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(ledger,null,2)+'\n');
}
if(require.main===module){if(process.argv.slice(2).some(arg=>arg!=='--mac-only'))throw Error('Use --mac-only to preserve existing PNG/ICO files');main({macOnly:process.argv.includes('--mac-only')}).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});}
module.exports={ico,icns,macCanvas};
