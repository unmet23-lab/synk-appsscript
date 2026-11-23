// WORLD 첫 공개(Atlas 엔진 판 폴더와 입구, 설계 주인 11-20) 후보 만들기 — 옛 .tmp/world-motion-20261015/publish.cjs의 export · build · compare를 본떴다.
//   node wf.cjs export <커밋>   — 커밋을 LF 그대로(core.autocrlf=false) D:에 꺼낸다(node_modules는 공용 작업본 연결)
//   node wf.cjs build           — 공개 빌드(git 밖 미디어는 공용 작업본에서 「git이 무시하는 파일」일 때만 가져온다)
//   node wf.cjs compare         — 라이브 synk-policy main의 world/와 blob으로 견준다(gh api — 공용 사본을 건드리지 않는다)
const {execFileSync,spawnSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo='C:/Users/q1212/Documents/SYNK-appsscript',worktree='D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const exp='D:/SYNK-worktrees/world-export-step2-20261120',out='.tmp/world-public-step2-20261120',build=path.join(exp,out);
const config=path.join(repo,'.tmp/world-redesign-20261014/tools/account-config.json');
const PATHS=['experiences','atlas','strata','tools','packages/atlas','package.json'];
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const [cmd,...rest]=process.argv.slice(2);
const sha1blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
if(cmd==='export'){
 const commit=rest[0];if(!commit)throw Error('commit');
 for(const link of ['node_modules','experiences/synk-account/node_modules']){const p=path.join(exp,link);try{if(fs.lstatSync(p))execFileSync('powershell',['-NoProfile','-Command',`[IO.Directory]::Delete('${p}',$false)`]);}catch{}}
 fs.rmSync(exp,{recursive:true,force:true});fs.mkdirSync(exp,{recursive:true});
 const tarFile=path.join(exp,'..','world-export-step2-20261120.tar');
 execFileSync('git',['-C',worktree,'-c','core.autocrlf=false','archive','--format=tar','-o',tarFile,commit,...PATHS],{env,maxBuffer:1<<26});
 const posix=p=>p.split(path.sep).join('/').replace(/^([A-Za-z]):/,(_,d)=>'/'+d.toLowerCase());
 execFileSync('tar',['-x','-f',posix(tarFile),'-C',posix(exp)],{env,maxBuffer:1<<26});
 fs.rmSync(tarFile,{force:true});
 for(const [link,target] of [['node_modules','node_modules'],['experiences/synk-account/node_modules','experiences/synk-account/node_modules']])
  if(fs.existsSync(path.join(repo,target)))execFileSync('powershell',['-NoProfile','-Command',`New-Item -ItemType Junction -Path '${path.join(exp,link)}' -Target '${path.join(repo,target)}' | Out-Null`]);
 fs.writeFileSync(path.join(exp,'EXPORT_COMMIT'),commit+'\n');console.log('exported',commit,'files',walk(path.join(exp,'experiences')).length);
}else if(cmd==='build'){
 const pulled=[];
 for(let attempt=1;attempt<=40;attempt++){
  fs.rmSync(build,{recursive:true,force:true});
  const r=spawnSync(process.execPath,['tools/build-world-app-public.mjs','--config',config,'--out',out],{cwd:exp,encoding:'utf8',maxBuffer:1<<26});
  if(r.status===0){console.log('build ok, attempt',attempt);break;}
  const m=/ENOENT: no such file or directory, (?:open|stat|scandir|lstat) '([^']+)'/.exec(r.stderr||'')||/Baked town set missing: (\S+)/.exec(r.stderr||'');
  if(!m){console.error((r.stderr||'').slice(0,3000));process.exit(1);}
  const raw=m[1].replace(/\\/g,'/');const rel=(path.isAbsolute(raw)?path.relative(exp,raw):raw).replace(/\\/g,'/');if(rel.startsWith('..'))throw Error('missing outside export '+raw);
  const src=path.join(repo,rel);if(!fs.existsSync(src))throw Error('missing everywhere '+rel);
  let ignored=false;try{execFileSync('git',['-C',repo,'check-ignore','-q','--',rel],{env});ignored=true;}catch{}
  if(!ignored)throw Error('not an ignored file, refusing to pull uncommitted source: '+rel);
  fs.mkdirSync(path.dirname(path.join(exp,rel)),{recursive:true});
  if(fs.statSync(src).isDirectory())fs.cpSync(src,path.join(exp,rel),{recursive:true});else fs.copyFileSync(src,path.join(exp,rel));
  pulled.push(rel);
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(build,'manifest.json'),'utf8'));
 fs.writeFileSync(path.join(build,'pulled-ignored.json'),JSON.stringify(pulled,null,1));
 console.log('ok',manifest.ok,'missing',JSON.stringify(manifest.missing).slice(0,500),'files',manifest.files.length,'pulled',pulled.length,pulled.slice(0,20).join(' '));
}else if(cmd==='compare'){
 const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'],{maxBuffer:1<<28,env}).toString('utf8'));
 if(tree.truncated)throw Error('tree truncated');
 const head=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/commits/main'],{maxBuffer:1<<26,env}).toString('utf8')).sha;
 const live=new Map(tree.tree.filter(t=>t.type==='blob'&&t.path.startsWith('world/')).map(t=>[t.path.slice(6),t.sha]));
 const payload=path.join(build,'world'),res={same:[],changed:[],added:[]};
 for(const file of walk(payload)){const rel=path.relative(payload,file).replace(/\\/g,'/');const id=sha1blob(fs.readFileSync(file));if(!live.has(rel))res.added.push(rel);else if(live.get(rel)===id)res.same.push(rel);else res.changed.push(rel);}
 const built=new Set([...res.same,...res.changed,...res.added]);const liveOnly=[...live.keys()].filter(p=>!built.has(p));
 fs.writeFileSync(path.join(build,'compare-live.json'),JSON.stringify({liveHead:head,...res,liveOnly},null,1));
 console.log({liveHead:head.slice(0,9),same:res.same.length,changed:res.changed.length,added:res.added.length,liveOnly:liveOnly.length});
}else{console.log('usage: export <commit> | build | compare');}
