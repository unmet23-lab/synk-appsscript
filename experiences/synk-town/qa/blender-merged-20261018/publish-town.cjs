// WORLD Town에 합친 판(동네 전체)을 기본으로 공개(10-19 유호님 「고치고나서 마스터에 합치고 배포하고 종료해줘」).
// 공용 .tmp/world-room-firstpaint-20261017/publish.cjs에서 값을 바꾸고 두 가지를 더했다:
//  - export 뒤 Git 밖 구운 판(townwide-merged*.glb/json)을 이 워크트리에서 사본으로 복사(정본: 원본 창고 town-합친판3-20261019)
//  - stage는 world/town/ 아래만 올린다(다른 세션의 미공개 WORLD 변경은 공개본 그대로)
// synk-policy 쪽은 blob 없는 부분 클론이라 별도 인덱스(read-tree origin/main → update-index → write-tree → commit-tree)로 커밋한다.
//   node publish.cjs export <커밋> | build | compare | classify <since> <until> | stage [--go] | push | verify | clean
const {execFileSync,spawnSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo='C:/Users/q1212/Documents/SYNK-appsscript',policy='C:/Users/q1212/Documents/synk-policy';
const wt='C:/Users/q1212/Documents/SYNK-appsscript/.claude/worktrees/goofy-yonath-85aa95';
const exp='C:/Users/q1212/Documents/SYNK-world-export-town-20261019',out='.tmp/world-public-town-20261019',build=path.join(exp,out);
const work=path.join(wt,'.tmp/town-publish-20261019');
const config=path.join(repo,'.tmp/world-redesign-20261014/tools/account-config.json');
const SCOPE='town/';
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const PATHS=['experiences/brand-opening','experiences/synk-world-app','experiences/hangul-stage','experiences/korean-runner','experiences/korean-rhythm','experiences/synk-world-home','experiences/synk-account','experiences/synk-town','experiences/play-common','experiences/korean-racing','experiences/social-conversion.mjs','atlas','strata','tools'];
const [cmd,...rest]=process.argv.slice(2);
const sha1blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const pgit=(args,opts={})=>execFileSync('git',['-C',policy,...args],{maxBuffer:1<<28,env,...opts});
const unlink=()=>{for(const link of ['node_modules','experiences/synk-account/node_modules']){const p=path.join(exp,link);try{if(fs.lstatSync(p))execFileSync('powershell',['-NoProfile','-Command',`[IO.Directory]::Delete('${p}',$false)`]);}catch{}}};
if(cmd==='export'){
 const commit=rest[0];if(!commit)throw Error('commit');
 unlink();fs.rmSync(exp,{recursive:true,force:true});fs.mkdirSync(exp,{recursive:true});
 const have=PATHS.filter(p=>{try{execFileSync('git',['-C',repo,'cat-file','-e',`${commit}:${p}`]);return true;}catch{return false;}});
 const tar=execFileSync('git',['-C',repo,'-c','core.autocrlf=false','archive','--format=tar',commit,...have],{maxBuffer:1<<30});
 execFileSync('tar',['-x','-f','-','-C',exp],{input:tar,maxBuffer:1<<30});
 for(const [link,target] of [['node_modules','node_modules'],['experiences/synk-account/node_modules','experiences/synk-account/node_modules']])
  if(fs.existsSync(path.join(repo,target)))execFileSync('powershell',['-NoProfile','-Command',`New-Item -ItemType Junction -Path '${path.join(exp,link)}' -Target '${path.join(repo,target)}' | Out-Null`]);
 // The baked town set is kept out of Git: copy the list and every file it names from this worktree.
 const dsrc=path.join(wt,'experiences/synk-town/assets/district'),ddst=path.join(exp,'experiences/synk-town/assets/district');fs.mkdirSync(ddst,{recursive:true});
 const set=JSON.parse(fs.readFileSync(path.join(dsrc,'townwide-merged.json'),'utf8'));const copied=['townwide-merged.json'];
 for(const part of set.parts)for(const f of [part.url,part.phone].filter(Boolean))copied.push(f);
 for(const f of copied)fs.copyFileSync(path.join(dsrc,f),path.join(ddst,f));
 fs.writeFileSync(path.join(exp,'EXPORT_COMMIT'),commit+'\n');console.log('exported',commit,'paths',have.length,'files',walk(path.join(exp,'experiences')).length,'district files',copied.length);
}else if(cmd==='build'){
 const pulled=[];
 for(let attempt=1;attempt<=30;attempt++){
  fs.rmSync(build,{recursive:true,force:true});
  const r=spawnSync(process.execPath,['tools/build-world-app-public.mjs','--config',config,'--out',out],{cwd:exp,encoding:'utf8',maxBuffer:1<<26});
  if(r.status===0){console.log('build ok, attempt',attempt);break;}
  const m=/ENOENT: no such file or directory, (?:open|stat|scandir|lstat) '([^']+)'/.exec(r.stderr||'');
  if(!m){console.error((r.stderr||'').slice(0,2000));console.error((r.stdout||'').slice(-2000));process.exit(1);}
  const rel=path.relative(exp,m[1].replace(/\\/g,'/')).replace(/\\/g,'/');if(rel.startsWith('..'))throw Error('missing outside export '+m[1]);
  const src=path.join(repo,rel);if(!fs.existsSync(src))throw Error('missing everywhere '+rel);
  let ignored=false;try{execFileSync('git',['-C',repo,'check-ignore','-q','--',rel]);ignored=true;}catch{}
  if(!ignored)throw Error('not an ignored file, refusing to pull uncommitted source: '+rel);
  fs.mkdirSync(path.dirname(path.join(exp,rel)),{recursive:true});fs.copyFileSync(src,path.join(exp,rel));pulled.push(rel);
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(build,'manifest.json'),'utf8'));
 fs.writeFileSync(path.join(build,'pulled-ignored.json'),JSON.stringify(pulled,null,1));
 console.log('ok',manifest.ok,'missing',JSON.stringify(manifest.missing),'files',manifest.files.length,'pulled',pulled.length);
}else if(cmd==='compare'){
 pgit(['fetch','-q','origin']);
 const live=new Map();
 for(const line of pgit(['ls-tree','-r','-z','origin/main','world/']).toString('utf8').split('\0').filter(Boolean)){const [meta,p]=line.split('\t');live.set(p.slice(6),meta.split(' ')[2]);}
 const payload=path.join(build,'world'),res={same:[],changed:[],added:[]};
 for(const file of walk(payload)){const rel=path.relative(payload,file).replace(/\\/g,'/');const id=sha1blob(fs.readFileSync(file));if(!live.has(rel))res.added.push(rel);else if(live.get(rel)===id)res.same.push(rel);else res.changed.push(rel);}
 const built=new Set([...res.same,...res.changed,...res.added]);const liveOnly=[...live.keys()].filter(p=>!built.has(p));
 fs.writeFileSync(path.join(build,'compare-live.json'),JSON.stringify({...res,liveOnly},null,1));
 const inScope=a=>a.filter(p=>p.startsWith(SCOPE));
 console.log({origin:pgit(['rev-parse','--short','origin/main']).toString().trim(),same:res.same.length,changed:res.changed.length,added:res.added.length,liveOnly:liveOnly.length,townChanged:inScope(res.changed).length,townAdded:inScope(res.added).length,townLiveOnly:inScope(liveOnly).length});
 console.log('town added',inScope(res.added).join(' '));console.log('town changed',inScope(res.changed).join(' '));console.log('town liveOnly',inScope(liveOnly).join(' '));
}else if(cmd==='classify'){
 const [since,until]=rest;if(!since||!until)throw Error('since until');
 const manifest=JSON.parse(fs.readFileSync(path.join(build,'manifest.json'),'utf8')),cmp=JSON.parse(fs.readFileSync(path.join(build,'compare-live.json'),'utf8'));
 const source=new Map(manifest.files.map(f=>[f.path,f.source||null]));
 const changedSrc=new Set(execFileSync('git',['-C',repo,'-c','core.quotepath=false','diff','--name-only',since,until],{maxBuffer:1<<26}).toString('utf8').split('\n').filter(Boolean));
 const res={intended:[],eol:[],other:[]};
 for(const p of cmp.changed.filter(p=>p.startsWith(SCOPE))){
  const src=source.get(p);if(src&&changedSrc.has(src)){res.intended.push(p);continue;}
  const a=pgit(['show',`origin/main:world/${p}`]),b=fs.readFileSync(path.join(build,'world',p));
  if(a.toString('latin1').replace(/\r/g,'')===b.toString('latin1').replace(/\r/g,''))res.eol.push(p);else res.other.push({p,src,live:a.length,build:b.length});
 }
 fs.writeFileSync(path.join(build,'classify.json'),JSON.stringify(res,null,1));
 console.log({intended:res.intended.length,eol:res.eol.length,other:res.other.length});
 console.log('intended',res.intended.join(' '));console.log('other',JSON.stringify(res.other));
}else if(cmd==='stage'){
 pgit(['fetch','-q','origin']);
 const base=pgit(['rev-parse','origin/main']).toString().trim();
 const cls=JSON.parse(fs.readFileSync(path.join(build,'classify.json'),'utf8')),cmp=JSON.parse(fs.readFileSync(path.join(build,'compare-live.json'),'utf8'));
 if(cls.other.length)console.log('town files that differ from live but not from my commits, left as live:',cls.other.map(o=>o.p).join(' '));
 const plan=[];
 for(const p of [...cls.intended,...cmp.added.filter(p=>p.startsWith(SCOPE))])plan.push({p,kind:cmp.added.includes(p)?'added':'changed',bytes:fs.readFileSync(path.join(build,'world',p))});
 console.log(JSON.stringify({base:base.slice(0,9),files:plan.length,bytes:plan.reduce((n,x)=>n+x.bytes.length,0),summary:plan.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{})}));
 for(const x of plan)console.log(' ',x.kind.padEnd(8),x.p,x.bytes.length);
 fs.writeFileSync(path.join(work,'plan.json'),JSON.stringify({base,files:plan.map(x=>({path:'world/'+x.p,kind:x.kind,bytes:x.bytes.length,sha256:crypto.createHash('sha256').update(x.bytes).digest('hex')}))},null,1));
 if(!rest.includes('--go'))process.exit(0);
 const idx=path.join(work,'policy.index');fs.rmSync(idx,{force:true});const ienv={...env,GIT_INDEX_FILE:idx};
 pgit(['read-tree',base],{env:ienv});
 const staged=[];
 for(const x of plan){const id=pgit(['hash-object','-w','--no-filters','--stdin'],{input:x.bytes}).toString().trim();pgit(['update-index','--add','--cacheinfo',`100644,${id},world/${x.p}`],{env:ienv});staged.push({path:'world/'+x.p,id,sha256:crypto.createHash('sha256').update(x.bytes).digest('hex')});}
 const tree=pgit(['write-tree'],{env:ienv}).toString().trim();
 const stat=pgit(['diff','--stat',base,tree]).toString('utf8').trim().split('\n');
 const deleted=pgit(['diff','--name-only','--diff-filter=D',base,tree]).toString().trim();
 const outside=pgit(['diff','--name-only',base,tree]).toString('utf8').split('\n').filter(p=>p&&!p.startsWith('world/'+SCOPE));
 if(outside.length)throw Error('staged files outside world/town: '+outside.join(' '));
 const msg=fs.readFileSync(path.join(work,'commit-message.txt'),'utf8');
 const commit=pgit(['commit-tree',tree,'-p',base,'-F','-'],{input:Buffer.from(msg,'utf8')}).toString().trim();
 fs.writeFileSync(path.join(work,'staged.json'),JSON.stringify({base,tree,commit,files:staged},null,1));
 console.log('commit',commit.slice(0,9),'files',staged.length,'deleted',deleted?deleted.split('\n').length:0);console.log(stat.slice(-1)[0]);
}else if(cmd==='push'){
 const s=JSON.parse(fs.readFileSync(path.join(work,'staged.json'),'utf8'));
 pgit(['fetch','-q','origin']);const now=pgit(['rev-parse','origin/main']).toString().trim();
 if(now!==s.base)throw Error(`origin/main moved ${s.base.slice(0,9)} -> ${now.slice(0,9)}; stage again`);
 const r=spawnSync('git',['-C',policy,'push','origin',`${s.commit}:refs/heads/main`],{encoding:'utf8',env});
 console.log('push',r.status,(r.stderr||'').trim().slice(-300));
 console.log('remote',pgit(['ls-remote','origin','refs/heads/main']).toString().trim());
}else if(cmd==='verify'){
 const s=JSON.parse(fs.readFileSync(path.join(work,'staged.json'),'utf8'));
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const url=p=>'https://synk.im/'+p.split('/').map(encodeURIComponent).join('/')+'?probe='+Date.now();
 const pending=new Map(s.files.map(f=>[f.path,f.sha256])),start=Date.now();
 (async()=>{
  while(pending.size&&Date.now()-start<15*60e3){
   for(const [p,want] of [...pending]){try{const b=execFileSync('curl',['-s','-L','-H','Cache-Control: no-cache','--max-time','60',url(p)],{maxBuffer:1<<28});if(sha(b)===want)pending.delete(p);}catch{}}
   console.log(new Date().toISOString().slice(11,19),'matched',s.files.length-pending.size,'/',s.files.length);
   if(pending.size)await new Promise(r=>setTimeout(r,30000));
  }
  console.log(pending.size?'NOT YET: '+[...pending.keys()].join(', '):'all live bytes match');
 })();
}else if(cmd==='clean'){
 unlink();fs.rmSync(exp,{recursive:true,force:true});console.log('removed',exp,fs.existsSync(path.join(repo,'node_modules'))?'(shared node_modules intact)':'');
}else{console.log('usage: export <commit> | build | compare | classify <since> <until> | stage [--go] | push | verify | clean');}
