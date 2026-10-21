#!/usr/bin/env node
// Screen-only company changes: build the next static set from the bytes the site
// serves now plus named commits, stage it on the data-disk owner, flip, and check
// the public site.
//   node swap.mjs status
//   node swap.mjs ensure                                                      (empty root before the first mounting release)
//   node swap.mjs init --release-manifest <release-manifest.json> --commit <sha>   (first set, no flip)
//   node swap.mjs plan --commits <sha,sha,...> --out <plan.json>
//   node swap.mjs apply --plan <plan.json> --sha256 <plan sha>
//   node swap.mjs rollback --to <set id> --from <set id>
// No image build, backup, restore or rearm: the HA release manifest never lists the static root.
// A set row only wins while the image still holds its origin bytes (static-set.mjs), so an
// image release that changes a screen file is served as released.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url)),repository=resolve(here,'../../../../../../..');
export const policy=JSON.parse(readFileSync(join(here,'policy.json'),'utf8'));
const nodeScript=readFileSync(join(here,'static-set-node.py'),'utf8');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const ORIGIN='https://workspace.synk.im';

const globPattern=glob=>new RegExp('^'+glob.split('**').map(part=>part.split('*').map(text=>text.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*')).join('.*')+'$');
const includes=policy.include.map(globPattern),excludes=policy.exclude.map(globPattern);
export const isStatic=path=>includes.some(rule=>rule.test(path))&&!excludes.some(rule=>rule.test(path));
export const selectStaticPaths=paths=>paths.filter(isStatic).sort();

// Must equal canonical_id in static-set-node.py (sorted keys, no spaces, UTF-8).
export function canonicalId(files){
  const sorted=Object.fromEntries(Object.keys(files).sort().map(path=>[path,{origin:files[path].origin??null,sha256:files[path].sha256,size:files[path].size}]));
  return sha256(Buffer.from(JSON.stringify({files:sorted}),'utf8')).slice(0,16);
}

const git=(args,options={})=>execFileSync('git',args,{cwd:repository,maxBuffer:256*1024*1024,...options});
// The pinned SSH helpers live in the shared checkout's .tmp, also when this runs from a worktree.
function sharedCheckout(){try{return resolve(repository,git(['rev-parse','--git-common-dir'],{stdio:['ignore','pipe','ignore']}).toString('utf8').trim(),'..');}catch{return repository;}}
export function remoteFrom(helper=join(sharedCheckout(),'.tmp/platform-ha-20261011/remote-app-current-v1.cjs')){
  const remote=createRequire(import.meta.url)(helper);
  return async(request,timeout=180000)=>{
    const source='import base64,json\nREQUEST=json.loads(base64.b64decode('+JSON.stringify(Buffer.from(JSON.stringify(request)).toString('base64'))+').decode("utf-8"))\n'+nodeScript;
    const value=await remote('primary',source,timeout);
    if(value?.status==='refused')throw Error('NODE_REFUSED_'+value.code);
    return value;
  };
}

const textual=bytes=>!bytes.includes(0)&&Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes);
function show(revision,path){try{return git(['show',revision+':'+path],{stdio:['ignore','pipe','ignore']});}catch{return null;}}
// Three-way merge of one file: ours = served bytes, base/theirs = the commit's parent and result.
export function mergeFile(base,ours,theirs){
  if(ours.equals(base))return theirs;if(ours.equals(theirs))return ours;
  if(!textual(base)||!textual(ours)||!textual(theirs))throw Error('BINARY_DIVERGED');
  const folder=mkdtempSync(join(tmpdir(),'synk-static-merge-'));
  try{
    for(const [name,bytes] of [['ours',ours],['base',base],['theirs',theirs]])writeFileSync(join(folder,name),bytes);
    try{return execFileSync('git',['merge-file','-p','--quiet',join(folder,'ours'),join(folder,'base'),join(folder,'theirs')],{maxBuffer:64*1024*1024});}
    catch{throw Error('MERGE_CONFLICT');}
  }finally{rmSync(folder,{recursive:true,force:true});}
}

// `git diff-tree -z` output: NUL-separated, so non-ASCII paths are never quoted (core.quotePath).
export function changedPaths(output){
  const parts=output.split('\0'),rows=[];
  for(let i=0;i<parts.length&&parts[i];){const kind=parts[i++],count=/^[RC]/.test(kind)?2:1;rows.push({kind,path:parts[i+count-1]});i+=count;}
  return rows;
}

export async function plan({commits,remote,read=show,changed=commit=>changedPaths(git(['diff-tree','--no-commit-id','--name-status','-r','-M','--root','-z',commit]).toString('utf8'))}){
  if(!commits.length||!commits.every(commit=>/^[a-f0-9]{40}$/.test(commit)))throw Error('FULL_COMMITS_REQUIRED');
  const status=await remote({op:'status'});if(status.status!=='present'||!status.current)throw Error('LIVE_SET_REQUIRED');
  const live=(await remote({op:'manifest',set:status.current})).manifest,current=new Map(),origins=new Map(),imageOnly=new Set(),skipped=[];
  for(const commit of commits){
    for(const {kind,path} of changed(commit)){
      if(!isStatic(path)){imageOnly.add(path);continue;}
      if(kind.startsWith('D')||kind.startsWith('R')){skipped.push({commit,path,kind:kind[0]});continue;}
      const base=read(commit+'^',path),theirs=read(commit,path);if(!theirs)throw Error('COMMIT_BLOB_MISSING '+path);
      // The first touch of a path starts from what the site serves now (set or release copy).
      if(!origins.has(path)){const served=(await remote({op:'served',paths:[path]})).files[path];origins.set(path,served.release??null);if(typeof served.base64==='string')current.set(path,Buffer.from(served.base64,'base64'));}
      const ours=current.get(path);
      current.set(path,ours?mergeFile(base??Buffer.alloc(0),ours,theirs):theirs);
    }
  }
  const files={...live.files},changes={};
  for(const [path,bytes] of current){
    const row={sha256:sha256(bytes),size:bytes.length,origin:origins.get(path)};
    if(live.files[path]?.sha256===row.sha256&&live.files[path]?.origin===row.origin)continue;
    files[path]=row;changes[path]={base64:bytes.toString('base64'),sha256:row.sha256};
  }
  const result={schema:'synk-company-static-swap-plan/v2',base:status.current,commits,expectId:canonicalId(files),changes,changed:Object.keys(changes).sort(),origins:Object.fromEntries([...origins].sort()),imageOnly:[...imageOnly].sort(),skipped};
  if(!result.changed.length)throw Error('NOTHING_TO_SWAP');
  return result;
}

// Public spot checks; the authoritative check is the live set id plus the node's full byte check.
export function publicPath(path){
  const company='docs/마케팅/온라인마케팅지도/engagement/company/public/',messenger='tools/company-messenger/public/';
  if(path===company+'index.html')return '/';
  if(path.startsWith(company)&&!path.endsWith('.html'))return '/'+path.slice(company.length);
  if(path.startsWith('experiences/teacher-world/')&&path!=='experiences/teacher-world/index.html')return '/teacher-world/'+path.slice('experiences/teacher-world/'.length);
  // The messenger rewrites links inside its HTML and CSS, so only other files compare byte for byte.
  if(path.startsWith(messenger)&&!/\.(?:html|css)$/.test(path))return '/messenger/'+path.slice(messenger.length);
  return null;
}
// The server rereads `current` at most once a second, so a just-flipped id may need a moment.
export async function checkPublic(result,{fetch=globalThis.fetch,origin=ORIGIN,attempts=6,pause=1200,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  let live;
  for(let attempt=1;;attempt++){
    live=await (await fetch(origin+'/api/static-set',{cache:'no-store',signal:AbortSignal.timeout(20000)})).json();
    if((live.set===result.expectId&&live.mode==='host')||attempt>=attempts)break;
    await sleep(pause);
  }
  const checks=[];
  for(const path of result.changed){
    const url=publicPath(path);if(!url){checks.push({path,result:'unmapped'});continue;}
    const response=await fetch(origin+url,{headers:{'accept-encoding':'identity'},cache:'no-store',signal:AbortSignal.timeout(60000)});
    let body=Buffer.from(await response.arrayBuffer());if(url==='/')body=Buffer.from(body.toString('utf8').replace(/\?v=[A-Za-z0-9_-]{43}/g,''));
    checks.push({path,url,status:response.status,result:response.status===200&&sha256(body)===result.changes[path].sha256?'match':'differs'});
  }
  return {set:live.set,mode:live.mode,expected:result.expectId,matches:live.set===result.expectId&&live.mode==='host'&&checks.every(check=>check.result!=='differs'),checks};
}

export async function apply(result,{remote,check=checkPublic}){
  if(result.schema!=='synk-company-static-swap-plan/v2')throw Error('PLAN_SCHEMA');
  const started=Date.now();
  const staged=await remote({op:'stage',base:result.base,changes:result.changes,expectId:result.expectId,commit:result.commits.at(-1)},600000);
  const flipped=await remote({op:'flip',to:result.expectId,from:result.base},300000);
  const flippedAt=Date.now(),verification=await check(result);
  if(!verification.matches)throw Object.assign(Error('PUBLIC_SET_MISMATCH'),{verification,rollback:{to:result.base,from:result.expectId}});
  return {status:'swapped',from:result.base,to:result.expectId,staged,flipped,verification,durationMs:Date.now()-started,flipToVerifiedMs:Date.now()-flippedAt};
}

function argument(name){const index=process.argv.indexOf('--'+name);return index>0?process.argv[index+1]:undefined;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const command=process.argv[2];
  (async()=>{
    const remote=remoteFrom();
    if(command==='status')return remote({op:'status'});
    if(command==='ensure')return remote({op:'ensure'});
    if(command==='init'){
      const manifest=JSON.parse(readFileSync(argument('release-manifest'),'utf8')),paths=selectStaticPaths((manifest.files||manifest.entries||[]).map(row=>row.path));
      return remote({op:'init',paths,commit:argument('commit')},900000);
    }
    if(command==='plan'){const result=await plan({commits:argument('commits').split(','),remote});const body=JSON.stringify(result,null,1)+'\n';writeFileSync(argument('out'),body,{flag:'wx'});return {plan:argument('out'),sha256:sha256(Buffer.from(body)),base:result.base,next:result.expectId,changed:result.changed,imageOnly:result.imageOnly,skipped:result.skipped};}
    if(command==='apply'){const body=readFileSync(argument('plan'));if(sha256(body)!==argument('sha256'))throw Error('PLAN_SHA_MISMATCH');return apply(JSON.parse(body),{remote});}
    if(command==='rollback'){const flipped=await remote({op:'flip',to:argument('to'),from:argument('from')},300000);return {flipped,verification:await checkPublic({changed:[],expectId:argument('to')})};}
    throw Error('EXPLICIT_COMMAND_REQUIRED');
  })().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(JSON.stringify({error:error.message,...(error.verification?{verification:error.verification,rollback:error.rollback}:{})}));process.exitCode=1;});
}
