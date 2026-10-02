'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),source=path.resolve(root,'../experiences/synk-account/assets');
const sources={platform:'synk-logo.svg',world:'sticker-book.webp',messenger:'laptop-felt.webp'};
function ico(images){const header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=6+16*images.length;const entries=images.map(({size,data})=>{const entry=Buffer.alloc(16);entry[0]=entry[1]=size===256?0:size;entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);entry.writeUInt32LE(data.length,8);entry.writeUInt32LE(offset,12);offset+=data.length;return entry;});return Buffer.concat([header,...entries,...images.map(i=>i.data)]);}
function icns(images){const chunks=images.map(({size,data})=>{const header=Buffer.alloc(8);header.write({256:'ic08',512:'ic09',1024:'ic10'}[size],0,4,'ascii');header.writeUInt32BE(8+data.length,4);return Buffer.concat([header,data]);});const header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(8+chunks.reduce((n,b)=>n+b.length,0),4);return Buffer.concat([header,...chunks]);}
async function main(){const out=path.join(root,'assets');fs.mkdirSync(out,{recursive:true});const ledger={version:1,transformation:'Approved existing assets; proportion preserved, centered on white; no recoloring or redrawing.',sources:[]};
  for(const [id,name]of Object.entries(sources)){const bytes=fs.readFileSync(path.join(source,name));const image=await sharp(bytes,{density:144}).resize(832,832,{fit:'contain',background:'#ffffff'}).png().toBuffer();const canvas=await sharp({create:{width:1024,height:1024,channels:4,background:'#ffffff'}}).composite([{input:image,left:96,top:96}]).png().toBuffer();fs.writeFileSync(path.join(out,id+'.png'),canvas);
    const png=async size=>({size,data:await sharp(canvas).resize(size,size).png().toBuffer()});fs.writeFileSync(path.join(out,id+'.ico'),ico(await Promise.all([16,24,32,48,64,128,256].map(png))));fs.writeFileSync(path.join(out,id+'.icns'),icns(await Promise.all([256,512,1024].map(png))));
    ledger.sources.push({id,source:'experiences/synk-account/assets/'+name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(ledger,null,2)+'\n');
}
if(require.main===module)main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
module.exports={ico,icns};
