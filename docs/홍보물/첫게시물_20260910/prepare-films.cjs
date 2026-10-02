'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const items=read(path.join(__dirname,'원고/video.json')).items;
const ready=[],pending=[];
for(const item of items){
 let complete=true;
 for(const s of item.scenes){
  if(!s.narration||s.layout==='music')continue;
  const p=s.audioRecord?path.resolve(__dirname,s.audioRecord):path.join(__dirname,'audio','voice-'+hash(s.narration).slice(0,16)+'.json');
  if(!fs.existsSync(p)){complete=false;continue}
  const a=read(p),f=path.join(__dirname,'audio',a.file||'_pending');
  if(a.status!=='completed'||a.narration!==s.narration||!fs.existsSync(f)||hash(fs.readFileSync(f))!==a.sha256){complete=false;continue}
  s.audio=a.file;s.duration=Math.ceil(Math.max(s.duration,a.duration+.95)*30)/30;
 }
 (complete?ready:pending).push(item.id);
}
const file=path.join(root,'영상/public/firstposts20260910/films.json');
fs.writeFileSync(file,JSON.stringify(items,null,2));
fs.writeFileSync(path.join(__dirname,'_검토/음성준비현황.json'),JSON.stringify({ready,pending},null,2));
console.log(JSON.stringify({ready,pending}));
