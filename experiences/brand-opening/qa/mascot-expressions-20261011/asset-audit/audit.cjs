const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../../../../..'),art=require(path.join(root,'tools/lib/마스코트자산.js'));
const output=__dirname, assetDir=path.join(root,'experiences/brand-opening/assets/tutors');
const sources=JSON.parse(fs.readFileSync(path.join(assetDir,'sources.json'),'utf8')).files;
const defs=[{name:'마린',id:'marin',cuts:art.마린표정컷,source:art.마린경로},{name:'몽글',id:'mongle',cuts:art.몽글누끼컷,source:cut=>art.경로(cut,{누끼:true})}];
const label=(text,width,height=34)=>Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/><text x="12" y="24" font-size="18" font-family="Malgun Gothic, sans-serif" fill="#111">${text}</text></svg>`);
async function sheet(entries,file,{cell=300,columns=4,region}={}){
 const height=cell+34,rows=Math.ceil(entries.length/columns),layers=[];
 for(let i=0;i<entries.length;i++){
  const [text,source]=entries[i],left=(i%columns)*cell,top=Math.floor(i/columns)*height;
  let img=sharp(source);if(region)img=img.extract(region);
  layers.push({input:await img.resize(cell,cell,{fit:'contain',background:'#e7e9ed'}).flatten({background:'#e7e9ed'}).png().toBuffer(),left,top});
  layers.push({input:label(text,cell),left,top:top+cell});
 }
 await sharp({create:{width:cell*columns,height:rows*height,channels:3,background:'#ffffff'}}).composite(layers).png().toFile(path.join(output,file));
}
function compare(base,next,width,height,bodyY){
 const result={rgbaChanged:0,alphaChanged:0,visibleRgbChanged:0,bodyRgbaChanged:0,bbox:null},box=[width,height,-1,-1];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,alpha=base[i+3]!==next[i+3],rgb=base[i]!==next[i]||base[i+1]!==next[i+1]||base[i+2]!==next[i+2];
  if(alpha)result.alphaChanged++;
  if(rgb&&(base[i+3]>0||next[i+3]>0))result.visibleRgbChanged++;
  if(alpha||rgb){result.rgbaChanged++;if(y>=bodyY)result.bodyRgbaChanged++;box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);}
 }
 if(result.rgbaChanged)result.bbox=box;
 return result;
}
(async()=>{
 const report=[];
 for(const def of defs){
  await sheet(def.cuts.map(cut=>[cut,path.join(root,def.source(cut))]),`${def.id}-canonical-full.png`);
  const runtime=sources.filter(f=>f.file.startsWith(def.id+'-')&&f.file.endsWith('.webp'));
  await sheet(runtime.map(rec=>[rec.file.replace(def.id+'-',''),path.join(assetDir,rec.file)]),`${def.id}-runtime480-full.png`);
  const region=def.id==='marin'?{left:950,top:1450,width:2300,height:1150}:{left:1100,top:1040,width:1900,height:800};
  await sheet(def.cuts.map(cut=>[cut,path.join(root,def.source(cut))]),`${def.id}-canonical-face.png`,{cell:420,columns:4,region});
  const base=await sharp(path.join(root,def.source('본체'))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const cut of def.cuts){
   const source=def.source(cut),next=await sharp(path.join(root,source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const dimensions=[next.info.width,next.info.height],stats=compare(base.data,next.data,...dimensions,def.id==='marin'?2750:2000);
   report.push({character:def.name,cut,source:source.replaceAll('\\','/'),dimensions,...stats});
  }
 }
 fs.writeFileSync(path.join(output,'pixel-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(output);
})().catch(e=>{console.error(e);process.exitCode=1;});
