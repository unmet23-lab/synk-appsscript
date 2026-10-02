import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createCreatorSourcesService,CREATOR_SOURCE_FILES,CREATOR_SOURCE_GUIDES} from './creator-sources.mjs';

const here=dirname(fileURLToPath(import.meta.url));
function users(){return new Map(['admin','manager','member','viewer'].map(role=>[role,{id:role,role,active:true}]));}
function storeFor(people){return {get(kind,id){return kind==='users'?people.get(id):undefined;}};}
async function fixture(t,{missing=[]}={}){
  const root=await mkdtemp(join(tmpdir(),'synk-creator-sources-')),people=users();
  t.after(async()=>{assert.equal(dirname(root),resolve(tmpdir()));assert.ok(root.includes('synk-creator-sources-'));await rm(root,{recursive:true,force:true});});
  for(const asset of CREATOR_SOURCE_FILES){if(missing.includes(asset.id))continue;const path=resolve(root,asset.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,'FIXED-'+asset.id);}
  return {root,people,service:createCreatorSourcesService({store:storeFor(people),root})};
}

test('only fixed approved files are listed and every current active role can read',async t=>{
  const f=await fixture(t);assert.equal(CREATOR_SOURCE_FILES.length,18);assert.equal(new Set(CREATOR_SOURCE_FILES.map(row=>row.id)).size,18);
  for(const role of f.people.keys()){
    const data=await f.service.workspace({id:role});assert.equal(data.assets.length,15);assert.equal(data.guides.length,4);
    assert.ok(data.assets.every(row=>row.available&&row.byteSize>0&&row.updatedAt&&row.downloadUrl.startsWith('/api/creator-sources/assets/')));
    assert.ok(!JSON.stringify(data).includes(f.root));assert.ok(!JSON.stringify(data).includes('encryption.key'));
  }
  for(const asset of CREATOR_SOURCE_FILES){assert.ok(!asset.path.split('/').includes('data'));assert.equal(asset.fileName.includes('\n'),false);assert.ok(/^[a-z0-9-]+$/.test(asset.id));}
});

test('asset and license requests always recheck actual active account',async t=>{
  const f=await fixture(t);await assert.rejects(f.service.workspace(null),{status:401});await assert.rejects(f.service.file({id:'missing',active:true},'synk-ink-vector'),{status:401});
  const data=await f.service.workspace({id:'viewer'}),font=data.assets.find(row=>row.id==='suit-variable');
  assert.equal(font.license.url,'/api/creator-sources/assets/suit-license');
  const license=await f.service.file({id:'viewer'},'suit-license');assert.equal(license.mimeType,'text/plain; charset=utf-8');
  f.people.get('viewer').active=false;
  await assert.rejects(f.service.file({id:'viewer',active:true},'synk-ink-vector'),{status:401});await assert.rejects(f.service.file({id:'viewer',active:true},'suit-license'),{status:401});await assert.rejects(f.service.workspace({id:'viewer',active:true}),{status:401});
});

test('unknown, path traversal, URL and non-string asset ids cannot select files',async t=>{
  const f=await fixture(t);
  for(const id of ['../../data/encryption.key','synk-ink-vector/..','SYNK-INK-VECTOR','synk-ink-vector?file=secret','file:///etc/passwd','https://example.test/file','',null,{}])await assert.rejects(f.service.file({id:'admin'},id),{status:404});
});

test('files preserve fixed name and bytes and unavailable originals have no download URL',async t=>{
  const f=await fixture(t,{missing:['felt-check']});const data=await f.service.workspace({id:'member'}),missing=data.assets.find(row=>row.id==='felt-check');
  assert.equal(missing.available,false);assert.equal(missing.previewUrl,null);assert.equal(missing.downloadUrl,null);assert.equal(missing.byteSize,null);
  await assert.rejects(f.service.file({id:'member'},'felt-check'),{status:404});
  const result=await f.service.file({id:'member'},'synk-ink-vector');assert.equal(result.fileName,'SYNK-Ink.svg');assert.equal(result.cacheControl,'private, no-store');assert.equal(await readFile(result.path,'utf8'),'FIXED-synk-ink-vector');
});

test('redirected approved path is rejected even if its target is inside the workspace',async t=>{
  const f=await fixture(t,{missing:['felt-check','felt-coral-action']}),row=CREATOR_SOURCE_FILES.find(asset=>asset.id==='felt-check'),target=join(f.root,'private');await mkdir(target);await writeFile(join(target,'badge-check.webp'),'SECRET');
  const redirected=dirname(resolve(f.root,row.path));await mkdir(dirname(redirected),{recursive:true});
  try{await symlink(target,redirected,process.platform==='win32'?'junction':'dir');}catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('host does not permit test directory link');return;}throw error;}
  await assert.rejects(f.service.file({id:'admin'},'felt-check'),{status:404});assert.equal((await f.service.workspace({id:'admin'})).assets.find(asset=>asset.id==='felt-check').available,false);
});

test('account deactivation during asynchronous metadata work suppresses the response',async t=>{
  const f=await fixture(t);let calls=0;const store={get(kind,id){const person=f.people.get(id);return person?{...person,active:++calls===1}:undefined;}};
  const service=createCreatorSourcesService({store,root:f.root});await assert.rejects(service.workspace({id:'member'}),{status:401});calls=0;await assert.rejects(service.file({id:'member'},'suit-license'),{status:401});
});

test('repository manifest resolves every real file and font license without production data',async()=>{
  const people=users(),service=createCreatorSourcesService({store:storeFor(people)}),data=await service.workspace({id:'viewer'});
  assert.equal(data.assets.filter(row=>row.available).length,15);
  for(const row of CREATOR_SOURCE_FILES){const file=await service.file({id:'viewer'},row.id);assert.ok(file.byteSize>0);}
  assert.ok(CREATOR_SOURCE_GUIDES.every(row=>row.licenseUrl.startsWith('https://')));
  for(const font of data.assets.filter(row=>row.category==='font'))assert.match(await readFile((await service.file({id:'viewer'},font.license.url.split('/').at(-1))).path,'utf8'),/SIL OPEN FONT LICENSE Version 1\.1/);
});

async function client(){
  const handlers={},context=createContext({state:{user:{id:'one'},tab:'workroom'},wr:{view:'tools'},document:{addEventListener(kind,fn){handlers[kind]=fn;},querySelector(){return null;}},escape:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),icon:()=>'',render(){},modal(){},notify(){},api:async()=>({assets:[],guides:[]}),navigator:{clipboard:{writeText:async()=>{}}},URL,console});
  runInContext(await readFile(join(here,'public/creator-sources.js'),'utf8'),context);return {context,handlers,eval:code=>runInContext(code,context)};
}

test('client loads sources only when the tools page is active and once per account',async()=>{
  const c=await client();let calls=0;c.context.api=async()=>{calls++;return{assets:[],guides:[]};};c.context.wr.view='desk';await c.eval('creatorSourcesEnsure()');assert.equal(calls,0);
  c.context.wr.view='tools';await c.eval('creatorSourcesEnsure()');await c.eval('creatorSourcesEnsure()');assert.equal(calls,1);
  c.context.state.user={id:'two'};await c.eval('creatorSourcesEnsure()');assert.equal(calls,2);assert.equal(c.eval('creatorSources.userId'),'two');
});

test('client discards a late previous account response and clears filters on reset',async()=>{
  const c=await client();let finish;c.context.api=()=>new Promise(resolve=>{finish=resolve;});const pending=c.eval('creatorSourcesEnsure()');c.context.state.user={id:'two'};c.eval('creatorSourcesReset()');finish({assets:[{title:'OLD ACCOUNT'}],guides:[]});await pending;assert.equal(c.eval('creatorSources.data'),null);
  c.eval("creatorSources.category='font';creatorSources.query='old';creatorSources.limit=30;creatorSourcesReset()");assert.equal(c.eval('creatorSources.query'),'');assert.equal(c.eval('creatorSources.category'),'all');assert.equal(c.eval('creatorSources.limit'),6);
});

test('client guards local download and preview links and escapes file metadata',async()=>{
  const c=await client();assert.equal(c.eval("creatorSourceLocalUrl('/api/creator-sources/assets/suit-license?download=1')"),'/api/creator-sources/assets/suit-license?download=1');
  for(const bad of ['javascript:alert(1)','//evil.test/path','/api/creator-sources/assets/../../secret','/api/creator-sources/assets/test?path=secret']){c.context.bad=bad;assert.equal(c.eval('creatorSourceLocalUrl(bad)'),'#');}
  c.context.row={id:'test',title:'<script>bad</script>',fileName:'<img src=x>',sourcePath:'safe',usage:'<strong>use</strong>',category:'logo',variant:'web',available:true,preview:'image',previewUrl:'javascript:alert(1)',downloadUrl:'//evil.test'};
  const html=c.eval('creatorSourceCard(row)');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));assert.ok(!html.includes('href="//evil'));assert.ok(html.includes('&lt;script&gt;'));
});

test('client filters existing approved metadata without duplicating the materials vault',async()=>{
  const c=await client();c.context.assets=[{id:'1',title:'LAB',category:'logo',usage:'코랄'},{id:'2',title:'SUIT',category:'font',usage:'한글'}];c.eval('creatorSources.data={assets,guides:[]};creatorSources.category="font"');assert.equal(c.eval('creatorSourcesFiltered().length'),1);c.eval('creatorSources.category="all";creatorSources.query="코랄"');assert.equal(c.eval('creatorSourcesFiltered()[0].id'),'1');
  const script=await readFile(join(here,'public/creator-sources.js'),'utf8');assert.ok(!script.includes("api('/api/studio-materials"));assert.ok(!script.includes("api('/api/content-generate"));
});
