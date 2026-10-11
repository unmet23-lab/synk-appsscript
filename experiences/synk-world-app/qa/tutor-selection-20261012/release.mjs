import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Run without arguments to prepare/reprepare. Only an explicit --publish writes
// a public commit; neither mode changes the shared checkout or its index.
const report=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(report,'../../../..');
const repo=path.resolve(root,'../synk-policy');
const work=path.join(root,'.tmp/tutor-selection-sync-20261012');
const payload=path.join(work,'public');
const manifestFile=path.join(work,'candidate.json');
const revision='tutor-account-20261012';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const git=(args,options={})=>execFileSync('git',['-C',repo,...args],{windowsHide:true,maxBuffer:8e6,...options});
const sourceGit=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,maxBuffer:8e6}).trimEnd();
const remote=()=>execFileSync('gh',['api','repos/unmet23-lab/synk-policy/branches/main','--jq','.commit.sha'],{encoding:'utf8',windowsHide:true}).trim();
const files=[
 ['experiences/synk-world-app/app-shell.mjs','world/app-shell.mjs'],
 ['experiences/synk-world-app/life-progress.mjs','world/life-progress.mjs'],
 ['experiences/synk-world-app/tutor-selection-sync.mjs','world/tutor-selection-sync.mjs'],
 ['experiences/brand-opening/home.mjs','world/brand-opening/home.mjs'],
 ['experiences/brand-opening/tutor-onboarding.mjs','world/brand-opening/tutor-onboarding.mjs'],
];
const entries=['world/index.html','world/mobile.html','world/desktop.html'];
const expectedPaths=[...files.map(([,name])=>name),...entries].sort();
const changedModules=new Set(files.map(([,name])=>name));
const quotedModule=/(['"])([^'"\r\n]*\.mjs)(\?[^'"\r\n]*)?\1/g;
const modulePath=(file,specifier)=>path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));
const deployPaths=(name,text)=>{
 if(name==='world/app-shell.mjs')return text.replaceAll("'../synk-world-home/wardrobe-","'./wardrobe-");
 if(name==='world/tutor-selection-sync.mjs')return text.replaceAll("'../brand-opening/","'./brand-opening/");
 return text;
};
const frameSource=/src="\$\{worldUrl\(game\.path\)\}(\?v=[^"]*)?"/g;
const normalize=(name,text)=>deployPaths(name,text).replaceAll('\r\n','\n').replace(quotedModule,(_,quote,specifier)=>quote+specifier+quote).replace(frameSource,'src="${worldUrl(game.path)}"').trimEnd();
function preserveFrameVersion(name,text,before){
 if(name!=='world/app-shell.mjs')return text;
 const originals=[...before.toString('utf8').matchAll(frameSource)];
 assert.equal(originals.length,1,'Expected one public game frame');let count=0;
 const after=text.replace(frameSource,()=>{count++;return originals[0][0];});
 assert.equal(count,1,'Expected one source game frame');return after;
}
function safePath(base,name){
 const resolved=path.resolve(base,name);
 assert.ok(resolved.startsWith(path.resolve(base)+path.sep),'Path escaped the release directory');
 return resolved;
}
function scanSecrets(name,text){
 const patterns={
  privateKey:/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/,
  secretApiKey:/\b(?:sb_secret_[A-Za-z0-9_-]{12,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/,
  literalSessionToken:/\b(?:service_role|serviceRoleKey|clientSecret|access_token|refresh_token)\s*[:=]\s*['"][^'"\r\n]{12,}['"]/i,
  jwt:/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/,
 };
 for(const [kind,pattern] of Object.entries(patterns))assert.ok(!pattern.test(text),`Potential ${kind} in ${name}; inspect without printing its value`);
}
function checkModule(file){execFileSync(process.execPath,['--check',file],{windowsHide:true,stdio:'pipe'});}
fs.mkdirSync(work,{recursive:true});

if(!process.argv.includes('--publish')){
 const baseline=remote(),sourceCommit=sourceGit(['rev-parse','HEAD']);
 git(['cat-file','-e',baseline+'^{commit}']);
 const originals=new Map(),queries=new Map();
 for(const [,name] of files){
  if(name==='world/tutor-selection-sync.mjs')continue;
  const bytes=git(['show',baseline+':'+name]);originals.set(name,bytes);
  for(const match of bytes.toString('utf8').matchAll(quotedModule)){
   const dependency=modulePath(name,match[2]),query=match[3]||'';
   if(queries.has(dependency))assert.equal(queries.get(dependency),query,'Inconsistent public module versions: '+dependency);
   else queries.set(dependency,query);
  }
 }
 const checks=[],changes=[];
 for(const [source,name] of files){
  const sourceBytes=fs.readFileSync(path.join(root,source));
  const before=originals.get(name)||null;
  if(before){
   const head=sourceGit(['show',sourceCommit+':'+source]);
   assert.ok(normalize(name,head)===normalize(name,before.toString('utf8')),'Unrelated source/public drift in '+source);
   checks.push({path:name,normalizedSourceHeadMatchesPublic:true});
  }else{
   assert.equal(git(['ls-tree','--name-only',baseline,'--',name],{encoding:'utf8'}).trim(),'','New module already exists; inspect the new baseline');
  }
  const after=preserveFrameVersion(name,deployPaths(name,sourceBytes.toString('utf8')).replaceAll('\r\n','\n').replace(quotedModule,(_,quote,specifier,query='')=>{
   const dependency=modulePath(name,specifier);
   const suffix=changedModules.has(dependency)?'?v='+revision:(queries.get(dependency)??query);
   return quote+specifier+suffix+quote;
  }),before);
  assert.ok(normalize(name,after)===normalize(name,sourceBytes.toString('utf8')),'Unexpected deployment transform in '+name);
  assert.ok(!after.includes('../synk-world-home/')&&!after.includes('../brand-opening/'),'Unmapped public import in '+name);
  scanSecrets(name,after);
  const file=safePath(payload,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,after);checkModule(file);
  const bytes=fs.readFileSync(file);
  assert.equal(sha(bytes),sha(Buffer.from(after)),'Prepared bytes changed: '+name);
  changes.push({path:name,source,sourceSHA256:sha(sourceBytes),beforeSHA256:before?sha(before):null,sha256:sha(bytes),bytes:bytes.length});
 }
 for(const name of entries){
  const before=git(['show',baseline+':'+name]),text=before.toString('utf8');let count=0;
  const after=text.replace(/(src=["']\/world\/app-shell\.mjs)(?:\?v=[^"']*)?(["'])/g,(_,prefix,quote)=>{count++;return prefix+'?v='+revision+quote;});
  assert.equal(count,1,'Expected one app-shell entry in '+name);scanSecrets(name,after);
  const file=safePath(payload,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,after);
  const bytes=fs.readFileSync(file);
  changes.push({path:name,beforeSHA256:sha(before),sha256:sha(bytes),bytes:bytes.length,entryChange:'app-shell version only'});
 }
 for(const change of changes.filter(item=>item.path.endsWith('.mjs'))){
  const text=fs.readFileSync(safePath(payload,change.path),'utf8');
  for(const match of text.matchAll(quotedModule)){
   const dependency=modulePath(change.path,match[2]);
   if(changedModules.has(dependency))assert.equal(match[3],'?v='+revision,'Changed dependency has stale version: '+dependency);
   else git(['cat-file','-e',baseline+':'+dependency]);
  }
 }
 assert.deepEqual(changes.map(item=>item.path).sort(),expectedPaths);
 for(const change of changes){
  assert.notEqual(change.beforeSHA256,change.sha256,'Expected release file is unchanged: '+change.path);
  if(change.source)assert.equal(sha(fs.readFileSync(path.join(root,change.source))),change.sourceSHA256,'Source changed during preparation; prepare again: '+change.source);
 }
 assert.equal(remote(),baseline,'Public branch advanced during preparation; prepare again');
 const manifest={createdAt:new Date().toISOString(),baseline,sourceCommit,revision,payload,changes,checks,secretScan:'passed',syntaxChecks:5,deleted:0,sharedCheckoutWrites:0,bundleChanged:false};
 fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({mode:'prepared',baseline,sourceCommit,manifest:manifestFile,payload,paths:expectedPaths,secretScan:'passed',published:false},null,2));
}else{
 const plan=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 assert.equal(plan.payload,payload);assert.equal(plan.revision,revision);
 assert.deepEqual(plan.changes.map(item=>item.path).sort(),expectedPaths);
 assert.equal(remote(),plan.baseline,'Public branch advanced; prepare again');
 for(const change of plan.changes){
  const file=safePath(payload,change.path),bytes=fs.readFileSync(file);
  assert.equal(bytes.length,change.bytes,'Prepared size changed: '+change.path);
  assert.equal(sha(bytes),change.sha256,'Prepared bytes changed: '+change.path);
  if(change.source)assert.equal(sha(fs.readFileSync(path.join(root,change.source))),change.sourceSHA256,'Source changed; prepare again: '+change.source);
  scanSecrets(change.path,bytes.toString('utf8'));if(change.path.endsWith('.mjs'))checkModule(file);
 }
 const env={...process.env,GIT_INDEX_FILE:path.join(work,'publish.index')};
 git(['read-tree',plan.baseline],{env});
 for(const change of plan.changes){
  const blob=git(['hash-object','-w','--no-filters',safePath(payload,change.path)],{encoding:'utf8'}).trim();
  git(['update-index','--add','--cacheinfo',`100644,${blob},${change.path}`],{env});
 }
 const tree=git(['write-tree'],{env,encoding:'utf8'}).trim();
 assert.deepEqual(git(['diff','--name-only','-z',plan.baseline,tree],{encoding:'utf8'}).split('\0').filter(Boolean).sort(),expectedPaths);
 assert.equal(git(['diff','--name-only','--diff-filter=D',plan.baseline,tree],{encoding:'utf8'}).trim(),'','Release must not delete files');
 for(const change of plan.changes)assert.equal(sha(git(['show',tree+':'+change.path])),change.sha256,'Committed bytes differ: '+change.path);
 const message=path.join(work,'message.txt');
 fs.writeFileSync(message,'Sync WORLD tutor selection with the existing account learning record\n\nRestore the selected tutor on another device, keep legacy local choices, and report pending or conflicting saves without changing learning scores.\n');
 const commit=git(['commit-tree',tree,'-p',plan.baseline,'-F',message],{encoding:'utf8'}).trim();
 assert.equal(remote(),plan.baseline,'Public branch advanced before push; prepare again');
 git(['push','origin',commit+':refs/heads/main']);
 const publishedHead=remote();assert.equal(publishedHead,commit,'Check the push outcome before retrying');
 const receipt={...plan,commit,tree,publishedAt:new Date().toISOString(),publishedHead,forcePush:false};
 fs.writeFileSync(path.join(report,'publication.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({mode:'published',commit,tree,paths:expectedPaths,receipt:path.join(report,'publication.json'),forcePush:false},null,2));
}
