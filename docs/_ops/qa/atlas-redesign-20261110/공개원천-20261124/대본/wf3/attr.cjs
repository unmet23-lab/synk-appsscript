// 공개 후보(master 빌드)와 라이브 world/의 차이를 커밋별로 가른다.
//   node attr.cjs <커밋 X>
// 바뀐 파일: 줄 차이(LF로 맞춤)의 더한 줄은 원천 파일을 X에서 git blame해 커밋을 찾고, 뺀 줄(라이브에만 있는 줄)은 master 이력(pickaxe)에 있었는지 본다.
// 새 파일: 원천 파일의 최근 커밋을 적는다. 라이브 바이트는 gh api blob으로 읽는다(공용 synk-policy 사본을 건드리지 않는다).
const {execFileSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const worktree='D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const exp='D:/SYNK-worktrees/world-export-atlas-20261120b',build=path.join(exp,'.tmp/world-public-atlas-20261120');
const X=process.argv[2];if(!X)throw Error('commit');
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const git=(...a)=>execFileSync('git',['-C',worktree,...a],{maxBuffer:1<<28,env}).toString('utf8');
const cmp=JSON.parse(fs.readFileSync(path.join(build,'compare-live.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(build,'manifest.json'),'utf8'));
const source=new Map(manifest.files.map(f=>[f.path,f.source||null]));
const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/'+cmp.liveHead+'?recursive=1'],{maxBuffer:1<<28,env}).toString('utf8'));
const liveSha=new Map(tree.tree.filter(t=>t.type==='blob'&&t.path.startsWith('world/')).map(t=>[t.path.slice(6),t.sha]));
const cacheDir=path.join(build,'live-blobs');fs.mkdirSync(cacheDir,{recursive:true});
function liveBytes(p){const sha=liveSha.get(p);const f=path.join(cacheDir,sha);if(fs.existsSync(f))return fs.readFileSync(f);
 const b=Buffer.from(JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/blobs/'+sha],{maxBuffer:1<<28,env}).toString('utf8')).content,'base64');fs.writeFileSync(f,b);return b;}
const textual=p=>/\.(?:mjs|js|cjs|css|html|json|svg|txt)$/i.test(p);
const lf=b=>b.toString('utf8').replace(/\r\n/g,'\n');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'attr-'));
function diffLines(a,b){const fa=path.join(tmp,'a'),fb=path.join(tmp,'b');fs.writeFileSync(fa,a);fs.writeFileSync(fb,b);
 let out='';try{out=execFileSync('git',['diff','--no-index','--no-color','-U0','--',fa,fb],{maxBuffer:1<<28,env}).toString('utf8');}catch(e){out=(e.stdout||'').toString('utf8');}
 const plus=[],minus=[];for(const line of out.split('\n')){if(line.startsWith('+++')||line.startsWith('---'))continue;if(line.startsWith('+'))plus.push(line.slice(1));else if(line.startsWith('-'))minus.push(line.slice(1));}return {plus,minus};}
const blameCache=new Map();
function blame(src){if(blameCache.has(src))return blameCache.get(src);const map=new Map();
 let out='';try{out=git('blame','--line-porcelain',X,'--',src);}catch{blameCache.set(src,map);return map;}
 let commit=null;for(const line of out.split('\n')){if(/^[0-9a-f]{40} /.test(line))commit=line.slice(0,40);else if(line.startsWith('\t')){const t=line.slice(1).replace(/\r$/,'');if(!map.has(t))map.set(t,new Set());map.get(t).add(commit);}}
 blameCache.set(src,map);return map;}
const subj=new Map();const subject=c=>{if(!subj.has(c)){try{subj.set(c,git('log','-1','--format=%ad %s','--date=short',c).trim());}catch{subj.set(c,'?');}}return subj.get(c);};
const byCommit=new Map(),files=[];
const bump=(c,p,n)=>{if(!byCommit.has(c))byCommit.set(c,{lines:0,files:new Set()});const e=byCommit.get(c);e.lines+=n;e.files.add(p);};
for(const p of cmp.changed){
 const src=source.get(p),built=fs.readFileSync(path.join(build,'world',p));
 if(!textual(p)){files.push({p,src,kind:'binary-changed'});if(src){const c=git('log','-1','--format=%H',X,'--',src).trim();if(c)bump(c,p,1);}continue;}
 const live=liveBytes(p);const a=lf(live),b=lf(built);
 if(a===b){files.push({p,src,kind:'eol-only'});continue;}
 const strip=t=>t.replace(/\?v=[a-z0-9.-]+/gi,'');
 if(strip(a)===strip(b)){files.push({p,src,kind:'token-only'});continue;}
 const {plus,minus}=diffLines(a,b);const rec={p,src,kind:'changed',plus:plus.length,minus:minus.length,commits:{},unattributed:0,minusInHistory:0,minusLiveOnly:[]};
 if(src){const map=blame(src);
  for(const line of plus){const cs=map.get(line);if(!cs){rec.unattributed++;continue;}for(const c of cs){rec.commits[c]=(rec.commits[c]||0)+1;bump(c,p,1/cs.size);}}
  // 뺀 줄: 의미 있는 줄 몇 개만 master 이력에서 찾는다(라이브에만 있는 줄인지)
  const sample=[...new Set(minus.map(s=>s.trim()).filter(s=>s.length>=12))].slice(0,6);
  for(const s of sample){let hit='';try{hit=git('log','-S',s,'--format=%h','-n','1',X,'--',src).trim();}catch{}if(hit)rec.minusInHistory++;else rec.minusLiveOnly.push(s.slice(0,140));}
 }else rec.unattributed=plus.length;
 files.push(rec);
}
for(const p of cmp.added){const src=source.get(p);let c='';if(src){try{c=git('log','-1','--format=%H',X,'--',src).trim();}catch{}}files.push({p,src,kind:'added',last:c?c.slice(0,9):null});if(c)bump(c,p,1);}
const commits=[...byCommit.entries()].map(([c,e])=>({c:c.slice(0,9),subject:subject(c),lines:Math.round(e.lines),files:[...e.files].slice(0,12),fileCount:e.files.size})).sort((x,y)=>y.lines-x.lines);
fs.writeFileSync(path.join(build,'attr.json'),JSON.stringify({X,liveHead:cmp.liveHead,commits,files},null,1));
const kinds=files.reduce((a,f)=>(a[f.kind]=(a[f.kind]||0)+1,a),{});
console.log(JSON.stringify(kinds));
console.log('commits',commits.length);
for(const c of commits.slice(0,80))console.log(String(c.lines).padStart(6),c.c,String(c.fileCount).padStart(3),c.subject.slice(0,150));
const liveOnly=files.filter(f=>f.minusLiveOnly&&f.minusLiveOnly.length);
console.log('files with live-only removed lines',liveOnly.length);
for(const f of liveOnly.slice(0,40))console.log(' ',f.p,'|',f.minusLiveOnly.slice(0,2).join(' ‖ ').slice(0,260));
