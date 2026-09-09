'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const base=__dirname;
const data=JSON.parse(fs.readFileSync(path.join(base,'콘텐츠원고.json'),'utf8'));
const packages=path.join(base,'packages');fs.mkdirSync(packages,{recursive:true});
const archives=[];
for(const p of data.items){
  const folder=path.join(base,p.id);
  if(p.format==='video'&&!fs.existsSync(path.join(folder,'video.mp4')))throw new Error('실제 영상 없음: '+p.id);
  const names=fs.readdirSync(folder).filter(n=>/^(upload-\d+\.jpg|master-\d+\.png|video\.mp4|자막\.srt|게시문안\.txt|제목\.txt|대체텍스트\.txt|사용안내\.md|본문\.md)$/.test(n));
  archives.push({id:p.id,destination:path.join(packages,p.id+'.zip'),files:names.map(name=>({source:path.join(folder,name),entry:name}))});
}
const include=['index.html','collection.css','assets','packages','미리보기','읽어주세요.md','납품명세.json','사용자산.json','콘텐츠원고.json','_검토',...data.items.map(p=>p.id)];
const files=[];
function collect(relative){
 const absolute=path.join(base,relative);
 if(fs.statSync(absolute).isDirectory()){for(const name of fs.readdirSync(absolute))collect(path.join(relative,name));}
 else if(!['_검토/압축계획.json','_검토/압축검증.json'].includes(relative.replaceAll('\\','/')))files.push({source:absolute,entry:relative.replaceAll('\\','/')});
}
for(const relative of include.filter(x=>x!=='packages'))collect(relative);
for(const a of archives)files.push({source:a.destination,entry:'packages/'+a.id+'.zip'});
archives.push({id:'whole',destination:path.join(base,'계정별콘텐츠_전체.zip'),files});
const plan=path.join(base,'_검토/압축계획.json');
fs.writeFileSync(plan,JSON.stringify({archives,report:path.join(base,'_검토/압축검증.json')},null,2),'utf8');
// zipfile preserves Unicode names. No PowerShell execution-policy changes.
// The helper reopens every entry and compares its SHA-256 with the source.
const bundledPython=path.join(process.env.USERPROFILE||'','\.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.SYNK_PYTHON||(fs.existsSync(bundledPython)?bundledPython:'python');
execFileSync(python,[path.join(base,'압축도우미.py'),plan],{stdio:'inherit',windowsHide:true});
