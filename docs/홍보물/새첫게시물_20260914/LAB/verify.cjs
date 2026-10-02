const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Read TrueType cmap format 4/12 directly; no fallback-font inference.
function cmapGlyph(buffer,code){
  let table=0;
  for(let i=0;i<buffer.readUInt16BE(4);i++){const p=12+i*16;if(buffer.toString('ascii',p,p+4)==='cmap')table=buffer.readUInt32BE(p+8);}
  if(!table)throw new Error('Missing cmap');
  for(let i=0;i<buffer.readUInt16BE(table+2);i++){
    const s=table+buffer.readUInt32BE(table+4+i*8+4),format=buffer.readUInt16BE(s);
    if(format===12){for(let j=0;j<buffer.readUInt32BE(s+12);j++){const p=s+16+j*12,a=buffer.readUInt32BE(p),z=buffer.readUInt32BE(p+4);if(code>=a&&code<=z)return buffer.readUInt32BE(p+8)+code-a;}}
    if(format===4&&code<=65535){const n=buffer.readUInt16BE(s+6)/2,ends=s+14,starts=ends+n*2+2,deltas=starts+n*2,ranges=deltas+n*2;for(let j=0;j<n;j++){const a=buffer.readUInt16BE(starts+j*2),z=buffer.readUInt16BE(ends+j*2);if(code<a||code>z)continue;const delta=buffer.readInt16BE(deltas+j*2),range=buffer.readUInt16BE(ranges+j*2);if(!range)return(code+delta)&65535;const glyph=buffer.readUInt16BE(ranges+j*2+range+2*(code-a));return glyph?(glyph+delta)&65535:0;}}
  }
  return 0;
}
(async()=>{
  const m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
  const q=JSON.parse(fs.readFileSync(path.join(__dirname,'qa.json'),'utf8'));
  assert.equal(m.cards.length,10); const headers=[],proof=[];
  for(const c of m.cards){
    const b=fs.readFileSync(path.join(__dirname,c.png)),meta=await sharp(b).metadata();assert.equal(meta.width,2160);assert.equal(meta.height,2700);assert.equal(hash(b),c.sha256);
    const p=await sharp(path.join(__dirname,c.preview)).metadata();assert.equal(p.width,390);assert.equal(p.height,488);
    const crop=await sharp(b).extract({left:128,top:104,width:600,height:184}).removeAlpha().raw().toBuffer();headers.push(hash(crop));
    const svg=fs.readFileSync(path.join(__dirname,c.svg),'utf8');assert(!svg.includes('\uFFFD'));
    assert(!/<image[^>]+href="(?!data:)/.test(svg));
    proof.push({id:c.id,pngSha256:c.sha256,previewSha256:hash(fs.readFileSync(path.join(__dirname,c.preview)))});
  }
  assert.equal(new Set(headers).size,1,'All ten original images must include the same rendered logo');
  assert(q.screens.every(s=>s.overflow.length===0&&s.textOverlaps.length===0));
  const allowedUnloaded=q.screens.flatMap(s=>s.fonts.filter(f=>f.status!=='loaded').map(f=>({id:s.id,...f})));
  assert(allowedUnloaded.every(f=>f.family==='SUIT Variable'&&['guardian-02','guardian-03','guardian-04'].includes(f.id)),'Only unused Korean faces may remain unloaded');
  const mnChars=new Set();
  for(const c of m.cards){const s=fs.readFileSync(path.join(__dirname,c.svg),'utf8');for(const t of s.matchAll(/<text[^>]*>([^<]*)<\/text>/g))for(const ch of t[1])if(/[\u0400-\u052f]/u.test(ch))mnChars.add(ch);}
  const glyphs={};for(const font of ['inter-medium.ttf','inter-bold.ttf']){const b=fs.readFileSync(path.join(__dirname,'assets',font));glyphs[font]={checked:mnChars.size,missing:[...mnChars].filter(c=>!cmapGlyph(b,c.codePointAt(0))),mongolianSpecific:['Ө','ө','Ү','ү','й'].map(c=>({character:c,glyph:cmapGlyph(b,c.codePointAt(0))}))};assert.equal(glyphs[font].missing.length,0);assert(glyphs[font].mongolianSpecific.every(x=>x.glyph>0));}
  for(const s of [...m.sourceCanon,...Object.values(m.assets).map(x=>({path:x.source,sha256:x.sha256}))])assert.equal(hash(fs.readFileSync(path.join(root,s.path))),s.sha256,s.path);
  const replace=fs.readFileSync(path.join(__dirname,'svg/student-05.svg'),'utf8');for(const t of ['게임을 만들어','영상을 만들어','그림을 그려','бүхэлд нь солино.'])assert(replace.includes(t));
  const res={passed:true,cards:10,dimensions:'2160×2700',previews:'390×488',identicalLogoRegions:true,textOverflow:0,textOverlaps:0,glyphs,unusedDeclaredFonts:allowedUnloaded,files:proof,scope:'Technical checks; native-language and user-effect review not claimed'};
  fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(res,null,2));console.log(JSON.stringify({passed:true,cards:10,cyrillicCharacters:mnChars.size,missingGlyphs:0,textOverflow:0,textOverlaps:0,identicalLogoRegions:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
