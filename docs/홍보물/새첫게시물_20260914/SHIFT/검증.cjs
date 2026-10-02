'use strict';

// Read-only verification of this local export, never a publication gate or hook.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
const current=require(path.join(root,'tools/lib/비전정본.js')).loadVisions().shift;
const issues=[];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(manifest.slides.length!==7)issues.push('slide count');
if(manifest.officialCopy.vision!==current.headline||manifest.officialCopy.subtext!==current.subtext)issues.push('vision drift');
const role=(i,name)=>manifest.slides[i].text.filter(t=>t.role===name).map(t=>t.text).join(' ');
for(const [i,roleName,key] of [[0,'official-vision','vision'],[1,'official-education','education'],[2,'official-advertising','advertising'],[3,'official-connection','connection'],[6,'official-subtext','subtext'],[6,'official-philosophy','philosophy']])if(role(i,roleName)!==manifest.officialCopy[key])issues.push('official copy '+key);
const sourceDrift=manifest.sources.filter(s=>hash(path.join(root,s.path))!==s.sha256).map(s=>s.path);
if(sourceDrift.length)issues.push('source drift');
const pngs=[],overlap=[];
for(const s of manifest.slides){
  for(const key of ['png','svg','html','mobileQA'])if(!fs.existsSync(path.join(__dirname,s[key])))issues.push('missing '+s[key]);
  for(const [file,w,h] of [[s.png,2160,2700],[s.mobileQA,390,488]]){const b=fs.readFileSync(path.join(__dirname,file));const actual={width:b.readUInt32BE(16),height:b.readUInt32BE(20)};pngs.push({file,...actual});if(actual.width!==w||actual.height!==h)issues.push('PNG size '+file);}
  if(hash(path.join(__dirname,s.png))!==s.sha256)issues.push('PNG hash '+s.png);
  if(s.overflow.length)issues.push('overflow '+s.number);
  if(s.text.some(t=>t.mono&&/[가-힣]/.test(t.text)))issues.push('Korean in DM Mono');
  if(s.actualFonts.flatMap(f=>f.fonts).some(f=>!f.isCustomFont))issues.push('font fallback '+s.number);
  const nodes=s.textBBoxes;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];if(Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1)overlap.push({slide:s.number,a:a.text,b:b.text});}
}
if(overlap.length)issues.push('text overlap');
const examples=role(1,'public-example').replace(/[“”]/g,'');
if(examples!=='다시 한 번 말씀해 주세요. 질문해도 괜찮습니다. 어떻게 진행할지 함께 확인해 볼까요?')issues.push('public example drift');
if(!manifest.slides[1].text.some(t=>t.text==='초안을 바탕으로 만든 공개용 예시'))issues.push('missing draft disclosure');
const result={passed:issues.length===0,issues,sourceCount:manifest.sources.length,sourceDrift,officialCopyMatches:6,pngs,textOverlap:overlap,fontVerification:'actual browser font samples, all custom fonts; not an accessibility certification',published:manifest.published,livePlatformVerified:manifest.livePlatformVerified};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
process.exitCode=issues.length?1:0;
