import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply, canonicalId, changedPaths, isStatic, mergeFile, plan, policy, publicPath, selectStaticPaths } from './deploy/static/swap.mjs';

const here=dirname(fileURLToPath(import.meta.url)),repository=resolve(here,'../../../../..');
const C='docs/마케팅/온라인마케팅지도/engagement/company';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=args=>execFileSync('git',args,{cwd:repository,maxBuffer:256*1024*1024}).toString('utf8');

test('policy keeps every server-read file in the image',()=>{
  for(const path of [C+'/public/app.js',C+'/public/index.html',C+'/public/pulse-app/assets/casting/m01.webp','tools/company-messenger/public/app.js','experiences/teacher-world/app.mjs','experiences/atlas-lab/lab.js','atlas/ask.js'])assert.equal(isStatic(path),true,path);
  for(const path of [C+'/server.mjs',C+'/public/publish-rules.js',C+'/public/subtitle-lab.js',C+'/public/pulse-app/casting-catalog.mjs',C+'/public/pulse-app/demo-assets/scene-1.png','atlas/engine.js','atlas/domain.js','experiences/atlas-lab/interpretation.mjs','experiences/atlas-lab/model-extraction.mjs','docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','tools/company-messenger/server.mjs'])assert.equal(isStatic(path),false,path);
  assert.equal(policy.directories,undefined,'every file is judged on its own origin, never a whole folder');
});

// Every Docker COPY source, expanded against git: the release files a server module could reach.
function imageFiles(){
  const tracked=new Set(git(['ls-files','-z']).split('\0').filter(Boolean)),files=new Set();
  for(const line of readFileSync(join(here,'Dockerfile'),'utf8').split('\n').filter(line=>/^COPY \[/.test(line))){
    const sources=JSON.parse(line.slice(5)).slice(0,-1);
    for(const source of sources){
      // Dockerfile.dockerignore keeps validation and preview programs out of the image.
      if(source.endsWith('/*.mjs')){const folder=source.slice(0,-5);for(const path of tracked){const name=path.slice(folder.length);if(path.startsWith(folder)&&!name.includes('/')&&name.endsWith('.mjs')&&!/\.test\.mjs$|^verify-|^preview-/.test(name)&&(!name.endsWith('-check.mjs')||['publication-link-check.mjs','client-delivery-check.mjs'].includes(name)))files.add(path);}}
      else if(tracked.has(source))files.add(source);
      else for(const path of tracked)if(path.startsWith(source+'/'))files.add(path);
    }
  }
  return files;
}
test('no server module imports, requires or reads a file the static set would carry',()=>{
  const files=imageFiles(),staticFiles=new Set([...files].filter(isStatic)),problems=[];
  assert.ok(staticFiles.size>200,'policy covers the screen files');
  for(const module of [...files].filter(path=>/\.(?:mjs|js|cjs)$/.test(path)&&!staticFiles.has(path)&&!/\.test\.mjs$/.test(path))){
    const source=readFileSync(join(repository,module),'utf8');
    // Imports, requires, module-relative URLs and joins against the module folder are server reads.
    for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\(\s*|\brequire\(\s*|new URL\(\s*)['"](\.{1,2}\/[^'"\n]+)['"]|join\(\s*(?:here|ROOT|__dirname)\s*,\s*['"]([^'"\n]+)['"]/g)){
      const target=posix.normalize(posix.join(posix.dirname(module),match[1]??match[2]));
      if(staticFiles.has(target))problems.push(module+' -> '+target);
    }
  }
  // The one allowed read: the server derives immutable asset names from the entry it serves.
  assert.deepEqual([...new Set(problems)],[C+'/server.mjs -> '+C+'/public/index.html']);
});

test('set ids match the node script byte for byte',()=>{
  const files={[C+'/public/앱.js']:{sha256:'a'.repeat(64),size:3,origin:'c'.repeat(64)},'tools/company-messenger/public/app.js':{size:0,origin:null,sha256:'b'.repeat(64)}};
  const python=execFileSync('python',['-X','utf8','-B','-c',"import importlib.util,json,sys;s=importlib.util.spec_from_file_location('n',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(m.canonical_id(json.loads(sys.argv[2])))",join(here,'deploy/static/static-set-node.py'),JSON.stringify(files)]).toString('utf8').trim();
  assert.equal(canonicalId(files),python);
  assert.notEqual(canonicalId({...files,[C+'/public/앱.js']:{...files[C+'/public/앱.js'],origin:null}}),python,'the origin is part of the id');
});

test('three-way merge keeps live-only lines and refuses conflicts and diverged binaries',()=>{
  const base=Buffer.from('a\nb\nc\n'),ours=Buffer.from('a\nb\nc\nlive\n'),theirs=Buffer.from('a\nB\nc\n');
  assert.equal(mergeFile(base,ours,theirs).toString(),'a\nB\nc\nlive\n');
  assert.equal(mergeFile(base,base,theirs),theirs);
  assert.throws(()=>mergeFile(base,Buffer.from('a\nX\nc\n'),theirs),{message:'MERGE_CONFLICT'});
  assert.throws(()=>mergeFile(Buffer.from([0,1]),Buffer.from([0,2]),Buffer.from([0,3])),{message:'BINARY_DIVERGED'});
});

function fakeNode(){
  const app=Buffer.from('a\nb\nc\nlive\n'),files={[C+'/public/app.js']:{sha256:sha(app),size:app.length,origin:'e'.repeat(64)},[C+'/public/style.css']:{sha256:'c'.repeat(64),size:1,origin:'c'.repeat(64)}},calls=[];
  return {calls,files,remote:async request=>{calls.push(request.op);
    if(request.op==='status')return {status:'present',current:'0123456789abcdef'};
    if(request.op==='manifest')return {manifest:{id:'0123456789abcdef',files}};
    if(request.op==='served')return {files:Object.fromEntries(request.paths.map(path=>[path,path===C+'/public/app.js'?{from:'set',release:'e'.repeat(64),base64:app.toString('base64')}:{from:null,release:null}]))};
    if(request.op==='stage')return {status:'staged',set:request.expectId};
    if(request.op==='flip')return {status:'flipped',from:request.from,to:request.to};
    throw Error(request.op);}};
}
test('a plan merges commits onto live bytes, lists image-only paths and pins the next set id',async()=>{
  const node=fakeNode(),commit='1'.repeat(40);
  const blobs={[commit+'^:'+C+'/public/app.js']:'a\nb\nc\n',[commit+':'+C+'/public/app.js']:'a\nB\nc\n',[commit+':'+C+'/public/new.webp']:'RIFF'};
  const result=await plan({commits:[commit],remote:node.remote,read:(revision,path)=>blobs[revision+':'+path]===undefined?null:Buffer.from(blobs[revision+':'+path]),changed:()=>changedPaths(['M',C+'/public/app.js','M',C+'/server.mjs','A',C+'/public/new.webp','D',C+'/public/old.js',''].join('\0'))});
  assert.deepEqual(result.changed,[C+'/public/app.js',C+'/public/new.webp']);
  assert.equal(Buffer.from(result.changes[C+'/public/app.js'].base64,'base64').toString(),'a\nB\nc\nlive\n');
  assert.deepEqual(result.imageOnly,[C+'/server.mjs']);
  assert.deepEqual(result.skipped,[{commit,path:C+'/public/old.js',kind:'D'}]);
  // Changed rows are made against the release bytes the node reports; a new file has no origin.
  const merged=Buffer.from('a\nB\nc\nlive\n'),next={...node.files,[C+'/public/app.js']:{sha256:sha(merged),size:merged.length,origin:'e'.repeat(64)},[C+'/public/new.webp']:{sha256:sha(Buffer.from('RIFF')),size:4,origin:null}};
  assert.equal(result.expectId,canonicalId(next));
  assert.deepEqual(result.origins,{[C+'/public/app.js']:'e'.repeat(64),[C+'/public/new.webp']:null});
  await assert.rejects(plan({commits:['abc'],remote:node.remote}),{message:'FULL_COMMITS_REQUIRED'});
  const swapped=await apply(result,{remote:node.remote,check:async()=>({matches:true})});
  assert.equal(swapped.status,'swapped');assert.deepEqual(node.calls.slice(-2),['stage','flip']);
  await assert.rejects(apply(result,{remote:node.remote,check:async()=>({matches:false})}),error=>error.message==='PUBLIC_SET_MISMATCH'&&error.rollback.to==='0123456789abcdef');
});

test('public spot checks map the plain company and teacher paths only',()=>{
  assert.equal(publicPath(C+'/public/index.html'),'/');assert.equal(publicPath(C+'/public/pulse-app/app.mjs'),'/pulse-app/app.mjs');
  assert.equal(publicPath(C+'/public/customer-computer.html'),null);assert.equal(publicPath('experiences/teacher-world/app.mjs'),'/teacher-world/app.mjs');
  assert.equal(publicPath('tools/company-messenger/public/app.js'),'/messenger/app.js');
  assert.equal(publicPath('tools/company-messenger/public/styles.css'),null);assert.equal(publicPath('tools/company-messenger/public/index.html'),null);
  assert.deepEqual(selectStaticPaths([C+'/server.mjs',C+'/public/b.js',C+'/public/a.js']),[C+'/public/a.js',C+'/public/b.js']);
});

test('changed paths come from NUL-separated diff-tree output, keeping Korean names and rename targets',()=>{
  assert.deepEqual(changedPaths(['M',C+'/public/앱.js','R100',C+'/public/old.js',C+'/public/new.js','A','tools/company-messenger/public/a b.js',''].join('\0')),[{kind:'M',path:C+'/public/앱.js'},{kind:'R100',path:C+'/public/new.js'},{kind:'A',path:'tools/company-messenger/public/a b.js'}]);
  assert.deepEqual(changedPaths(''),[]);
});

test('the public check waits out the server one-second reread of the current link',async()=>{
  const {checkPublic}=await import('./deploy/static/swap.mjs');
  let calls=0;const sleeps=[];
  const fetch=async url=>{if(url.endsWith('/api/static-set')){calls++;return {json:async()=>({mode:'host',set:calls<3?'0123456789abcdef':'fedcba9876543210'})};}throw Error('unexpected '+url);};
  const ok=await checkPublic({changed:[],changes:{},expectId:'fedcba9876543210'},{fetch,origin:'https://example.test',sleep:async ms=>{sleeps.push(ms);}});
  assert.equal(ok.matches,true);assert.equal(calls,3);assert.deepEqual(sleeps,[1200,1200]);
  calls=-100;const stuck=await checkPublic({changed:[],changes:{},expectId:'fedcba9876543210'},{fetch,origin:'https://example.test',attempts:2,sleep:async()=>{}});
  assert.equal(stuck.matches,false);
});
