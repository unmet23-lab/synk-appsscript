'use strict';
// Native SVG localization of the approved LAB cover; photographic assets unchanged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=__dirname,root=path.resolve(dir,'../../../..');
const template=path.join(root,'docs/마케팅/프로필최신화_20260919/커버_펠트글래스_v4/lab-youtube.svg');
const plan=JSON.parse(fs.readFileSync(path.join(dir,'copy.json'),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function main(){
  const src=fs.readFileSync(template,'utf8');
  const pattern=/<g aria-label="[^"]*"[^>]*><path d="[^"]*"\/><\/g>/g;
  if(src.match(pattern)?.length!==3)throw Error('Expected three original text groups');
  const stripped=src.replace(pattern,'');
  const profile=path.resolve(dir,plan.profileImage);
  const manifest={revision:plan.revision,createdAt:new Date().toISOString(),sourceSvg:template,sourceSha256:sha(template),profileSource:profile,profileRevision:plan.profileRevision,profileSha256:sha(profile),fontNote:'Brand Inter Tight and SUIT; installed JhengHei, Myanmar Text, Leelawadee UI and Nirmala UI only for unsupported scripts. HarfBuzz shaping; explicit outlined glyphs, no export-time fallback. Canon fonts unchanged.',outputs:[]};
  for(const c of plan.channels){
    if(c.name.length>100||c.description.length>1000)throw Error('YouTube copy limit '+c.id);
    const req=[{text:c.headline,size:76,weight:700},{text:plan.coverKorean,size:50,weight:800},{text:c.sub,size:36,weight:500},{text:c.countryLabel,size:32,weight:500,tracking:.06}];
    const run=spawnSync('python',['-X','utf8',path.join(dir,'glyphs.py')],{input:JSON.stringify(req),encoding:'utf8',maxBuffer:5e6});
    if(run.status!==0)throw Error(c.id+': '+run.stderr);
    const glyphs=JSON.parse(run.stdout),qa=[];
    const sizes=glyphs.map((g,i)=>{const scale=Math.min(1,(i===3?500:830)/(g.box[2]-g.box[0]));return {scale,w:(g.box[2]-g.box[0])*scale,h:(g.box[3]-g.box[1])*scale};});
    const logoH=83.89887640449439,total=logoH+24+sizes[0].h+17+sizes[1].h+30+sizes[2].h;
    let y=720-total/2;const logoY=y;
    let svg=stripped.replace('aria-label="몽골어권 한국어 학습 자료와 K-LOFI"',`aria-label="${esc(c.name)}"`).replace('y="577.7914680477528"',`y="${logoY}"`);
    const add=(i,x,top)=>{const g=glyphs[i],m=sizes[i];qa.push({text:req[i].text,x,y:top,w:m.w,h:m.h,fonts:g.fonts,shaper:g.shaper});return `<g aria-label="${esc(req[i].text)}" transform="translate(${x-g.box[0]*m.scale} ${top-g.box[1]*m.scale}) scale(${m.scale})" fill="${i<2?'url(#feltType)':'#484848'}" ${i<2?'filter="url(#typeDepth)"':''}><path d="${g.d}"/></g>`;};
    let text=add(3,878,logoY+(logoH-sizes[3].h)/2);
    y+=logoH+24;text+=add(0,580,y);y+=sizes[0].h+17;text+=add(1,580,y);y+=sizes[1].h+30;text+=add(2,580,y);
    for(const t of qa)if(t.x<508||t.y<509||t.x+t.w>1430||t.y+t.h>931)throw Error('Unsafe bounds '+JSON.stringify(t));
    if(Math.abs((logoY+y+sizes[2].h)/2-720)>.01)throw Error('Off center '+c.id);
    const end=svg.lastIndexOf('</svg>');svg=svg.slice(0,end)+text+svg.slice(end);
    fs.writeFileSync(path.join(dir,c.id+'.svg'),svg);
    const png=path.join(dir,c.id+'.png');await sharp(Buffer.from(svg)).png().toFile(png);
    const meta=await sharp(png).metadata();if(meta.width!==2560||meta.height!==1440||fs.statSync(png).size>6*1024*1024)throw Error('Invalid output size');
    await sharp(png).extract({left:508,top:509,width:1544,height:422}).resize(1200).png().toFile(path.join(dir,c.id+'.display.png'));
    await sharp(png).extract({left:508,top:509,width:1544,height:422}).resize(390).png().toFile(path.join(dir,c.id+'.mobile.png'));
    manifest.outputs.push({id:c.id,file:path.basename(png),sha256:sha(png),bytes:fs.statSync(png).size,safe:{x:508,y:509,w:1544,h:422},visibleCenterY:720,text:qa});
  }
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  // Review sheet is a layout of generated native-SVG cover exports, not an AI image edit.
  const tiles=await Promise.all(plan.channels.map(async(c,i)=>({input:await sharp(path.join(dir,c.id+'.display.png')).resize(772,211).toBuffer(),left:(i%2)*772,top:Math.floor(i/2)*211})));
  await sharp({create:{width:1544,height:Math.ceil(tiles.length/2)*211,channels:3,background:'#ffffff'}}).composite(tiles).png().toFile(path.join(dir,'review-sheet.png'));
  console.log(JSON.stringify(manifest.outputs.map(o=>({id:o.id,bytes:o.bytes,center:o.visibleCenterY})),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
