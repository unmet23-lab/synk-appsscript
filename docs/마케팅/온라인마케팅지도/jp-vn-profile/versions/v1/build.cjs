'use strict';
// Localized native SVG layout. Photographic assets are reused unchanged, not regenerated.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=__dirname,root=path.resolve(dir,'../../../..');
const previous=path.join(root,'docs/마케팅/프로필최신화_20260919');
const template=path.join(previous,'커버_펠트글래스_v4/lab-youtube.svg');
const profile=path.join(previous,'배경_순백_20260919/synklab-profile-white.png');
const plan=JSON.parse(fs.readFileSync(path.join(dir,'copy.json'),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function main(){
  const src=fs.readFileSync(template,'utf8');
  const matches=src.match(/<g aria-label="[^"]*"[^>]*><path d="[^"]*"\/><\/g>/g);
  if(matches?.length!==3)throw Error('Expected three template text groups');
  const stripped=src.replace(/<g aria-label="[^"]*"[^>]*><path d="[^"]*"\/><\/g>/g,'');
  const manifest={revision:plan.revision,createdAt:new Date().toISOString(),sourceSvg:template,sourceSha256:sha(template),profileSource:profile,profileSha256:sha(profile),fontNote:'Inter Tight and SUIT retained; Japanese-only glyphs use installed Yu Gothic Bold/Medium because the brand font set does not cover Japanese. Outlined, no OS fallback at export.',outputs:[]};
  for(const c of plan.channels){
    const req=[{text:c.headline,size:c.locale==='ja'?80:76,weight:700},{text:'재밌는 한국어',size:50,weight:800},{text:c.sub,size:36,weight:500},{text:c.countryLabel,size:32,weight:500,tracking:.06}];
    const result=spawnSync('python',['-X','utf8',path.join(dir,'glyphs.py')],{input:JSON.stringify(req),encoding:'utf8',maxBuffer:5e6});
    if(result.status!==0)throw Error(result.stderr);
    const glyphs=JSON.parse(result.stdout),qa=[];
    const sizes=glyphs.map((g,i)=>{const scale=Math.min(1,(i===3?360:830)/(g.box[2]-g.box[0]));return {scale,w:(g.box[2]-g.box[0])*scale,h:(g.box[3]-g.box[1])*scale};});
    const logoH=83.89887640449439;
    const total=logoH+24+sizes[0].h+17+sizes[1].h+30+sizes[2].h;
    let y=720-total/2;
    const logoY=y;
    let svg=stripped.replace('aria-label="몽골어권 한국어 학습 자료와 K-LOFI"',`aria-label="${esc(c.name)}"`).replace('y="577.7914680477528"',`y="${logoY}"`);
    const add=(i,x,top)=>{const g=glyphs[i],m=sizes[i];qa.push({text:req[i].text,x,y:top,w:m.w,h:m.h,fonts:g.fonts});return `<g aria-label="${esc(req[i].text)}" transform="translate(${x-g.box[0]*m.scale} ${top-g.box[1]*m.scale}) scale(${m.scale})" fill="${i<2?'url(#feltType)':'#484848'}" ${i<2?'filter="url(#typeDepth)"':''}><path d="${g.d}"/></g>`;};
    let text=add(3,878,logoY+(logoH-sizes[3].h)/2);
    y+=logoH+24;text+=add(0,580,y);y+=sizes[0].h+17;text+=add(1,580,y);y+=sizes[1].h+30;text+=add(2,580,y);
    for(const t of qa){if(t.x<508||t.y<509||t.x+t.w>1430||t.y+t.h>931)throw Error('Unsafe bounds '+JSON.stringify(t));}
    if(Math.abs((logoY+y+sizes[2].h)/2-720)>.01)throw Error('Off center');
    svg=svg.replace('</svg>','</svg>'); // Keep nested approved logo SVG intact.
    const end=svg.lastIndexOf('</svg>');svg=svg.slice(0,end)+text+svg.slice(end);
    const file=path.join(dir,c.id+'.svg');fs.writeFileSync(file,svg);
    const png=path.join(dir,c.id+'.png');await sharp(Buffer.from(svg)).png().toFile(png);
    const meta=await sharp(png).metadata();if(meta.width!==2560||meta.height!==1440||fs.statSync(png).size>6*1024*1024)throw Error('Invalid banner size');
    await sharp(png).extract({left:508,top:509,width:1544,height:422}).resize(1200).png().toFile(path.join(dir,c.id+'.display.png'));
    await sharp(png).extract({left:508,top:509,width:1544,height:422}).resize(390).png().toFile(path.join(dir,c.id+'.mobile.png'));
    await sharp(png).extract({left:0,top:509,width:2560,height:422}).resize(1600).png().toFile(path.join(dir,c.id+'.desktop.png'));
    manifest.outputs.push({id:c.id,file:path.basename(png),sha256:sha(png),bytes:fs.statSync(png).size,safe:{x:508,y:509,w:1544,h:422},visibleCenterY:720,text:qa,profileSourceUnchanged:true});
  }
  await sharp(profile).resize(150,150).png().toFile(path.join(dir,'lab-watermark.png'));
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest.outputs.map(o=>({id:o.id,bytes:o.bytes,center:o.visibleCenterY})),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
