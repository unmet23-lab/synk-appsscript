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
  // 화면 도우미(mtHead · mtBlock · mtBadge …)는 maker-tools.js 앞 절반. 머리 주석에도 같은 문구가 있어 줄 머리에서 찾는다.
  const kit=await readFile(join(here,'public/maker-tools.js'),'utf8');runInContext(kit.slice(0,kit.indexOf('\n// ── 상태와 화면 바꾸기')),context);
  runInContext(await readFile(join(here,'public/creator-sources.js'),'utf8'),context);return {context,handlers,eval:code=>runInContext(code,context)};
}

test('client loads sources only when the tools page is active and once per account',async()=>{
  const c=await client();let calls=0;c.context.api=async()=>{calls++;return{assets:[],guides:[]};};c.context.wr.view='desk';await c.eval('creatorSourcesEnsure()');assert.equal(calls,0);
  c.context.wr.view='tools';await c.eval('creatorSourcesEnsure()');await c.eval('creatorSourcesEnsure()');assert.equal(calls,1);
  c.context.state.user={id:'two'};await c.eval('creatorSourcesEnsure()');assert.equal(calls,2);assert.equal(c.eval('creatorSources.userId'),'two');
});

test('client discards a late previous account response and clears filters on reset',async()=>{
  const c=await client();let finish;c.context.api=()=>new Promise(resolve=>{finish=resolve;});const pending=c.eval('creatorSourcesEnsure()');c.context.state.user={id:'two'};c.eval('creatorSourcesReset()');finish({assets:[{title:'OLD ACCOUNT'}],guides:[]});await pending;assert.equal(c.eval('creatorSources.data'),null);
  c.eval("creatorSources.category='font';creatorSources.query='old';creatorSourcesReset()");assert.equal(c.eval('creatorSources.query'),'');assert.equal(c.eval('creatorSources.category'),'all');assert.equal(c.eval('creatorSources.limit'),undefined);
});

test('client guards local download and preview links and escapes file metadata',async()=>{
  const c=await client();assert.equal(c.eval("creatorSourceLocalUrl('/api/creator-sources/assets/suit-license?download=1')"),'/api/creator-sources/assets/suit-license?download=1');
  for(const bad of ['javascript:alert(1)','//evil.test/path','/api/creator-sources/assets/../../secret','/api/creator-sources/assets/test?path=secret']){c.context.bad=bad;assert.equal(c.eval('creatorSourceLocalUrl(bad)'),'#');}
  c.context.row={id:'test',title:'<script>bad</script>',fileName:'<img src=x>',sourcePath:'safe',usage:'<strong>use</strong>',category:'logo',variant:'web',available:true,preview:'image',previewUrl:'javascript:alert(1)',downloadUrl:'//evil.test'};
  const html=c.eval('creatorSourceCard(row)');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));assert.ok(!html.includes('href="//evil'));assert.ok(html.includes('&lt;script&gt;'));
});

test('client panel shows every approved asset card with real kinds and folds usage details into the card',async()=>{
  const c=await client(),logo=index=>({id:'logo-'+index,title:'로고 '+index,category:'logo',variant:'SNS 웹용',fileName:`logo-${index}.webp`,byteSize:2048,available:true,preview:'image',previewUrl:'/api/creator-sources/assets/logo-'+index,downloadUrl:'/api/creator-sources/assets/logo-'+index+'?download=1',usage:'로고는 비율을 지켜요.',sourcePath:'docs/디자인/SNS키트/README.md',assetPath:'docs/디자인/SNS키트/assets/logo-'+index+'.webp',updatedAt:'2026-10-20T12:21:41.000Z'});
  const font={id:'suit-variable',title:'SUIT Variable',category:'font',variant:'한글 · 가변 웹 폰트',fileName:'SUIT-Variable.woff2',byteSize:624536,available:true,preview:'font',sample:'각자의 목표에 맞는 도움',sampleRole:'hangul',previewUrl:null,downloadUrl:'/api/creator-sources/assets/suit-variable?download=1',usage:'한글 본문은 500으로 써요.',sourcePath:'docs/브랜드_폰트_정본.md',license:{label:'SIL OFL 1.1',notice:'라이선스 원문을 같이 넘겨요.',url:'/api/creator-sources/assets/suit-license',downloadUrl:'/api/creator-sources/assets/suit-license?download=1'}};
  const data={assets:[...Array.from({length:7},(_,index)=>logo(index)),font],guides:[{id:'pexels',title:'Pexels · 사진과 영상',url:'https://www.pexels.com/',licenseUrl:'https://www.pexels.com/license/',note:'조건'}],rightsTemplate:'자료 제목:'};
  c.context.api=async()=>data;await c.eval('creatorSourcesEnsure()');const html=c.eval('creatorSourcesPanel()');
  assert.match(html,/SYNK MAKER · SOURCES/);assert.match(html,/<dt>자료<\/dt><dd>8<\/dd>/);assert.match(html,/<dt>종류<\/dt><dd>2<\/dd>/);
  // 8개 모두 한 번에 — 「먼저 6개 표시 · 자료 더 보기」와 종류 셀렉트는 없다. 종류 캡슐은 실제로 있는 종류만.
  assert.equal((html.match(/data-creator-source-card="/g)||[]).length,8);assert.ok(!html.includes('더 보기'));assert.ok(!html.includes('<select'));
  assert.deepEqual([...html.matchAll(/data-creator-source-category="([a-z]+)"/g)].map(match=>match[1]),['all','logo','font']);
  assert.equal((html.match(/<a class="btn small" href="\/api\/creator-sources\/assets\/[a-z0-9-]+\?download=1" download>/g)||[]).length,8);
  assert.match(html,/<details class="src-card-fold" id="creator-source-suit-variable" data-creator-source-card="suit-variable"><summary>/);assert.match(html,/SIL OFL 1\.1/);assert.match(html,/data-creator-source-action="copy-asset" data-id="suit-variable"/);
  assert.ok(!/\sstyle=/.test(html));assert.ok(!html.includes('btn primary'));
  const pick=id=>c.handlers.click({target:{closest:selector=>selector==='[data-creator-source-category]'?{dataset:{creatorSourceCategory:id}}:null}});
  await pick('font');assert.equal(c.eval('creatorSources.category'),'font');assert.equal((c.eval('creatorSourcesResults()').match(/data-creator-source-card="/g)||[]).length,1);
  await pick('unknown');assert.equal(c.eval('creatorSources.category'),'all');
});

test('client keeps opened asset cards open when search or kind redraws only the results',async()=>{
  const c=await client();c.context.api=async()=>({assets:[{id:'suit-variable',title:'SUIT Variable',category:'font',available:true,preview:'font',sample:'가',downloadUrl:'/api/creator-sources/assets/suit-variable?download=1',usage:'한글 본문',sourcePath:'docs/브랜드_폰트_정본.md'}],guides:[]});await c.eval('creatorSourcesEnsure()');
  const card={id:'creator-source-suit-variable',open:false},results={innerHTML:'',querySelectorAll:()=>[{id:card.id}]};
  Object.assign(c.context.document,{querySelector:selector=>selector==='[data-creator-source-results]'?results:null,querySelectorAll:()=>[],getElementById:id=>id===card.id?card:null});
  c.handlers.input({target:{value:'SU',matches:selector=>selector==='[data-creator-source-query]'}});
  assert.match(results.innerHTML,/data-creator-source-card="suit-variable"/);assert.equal(card.open,true);
  card.open=false;await c.handlers.click({target:{closest:selector=>selector==='[data-creator-source-category]'?{dataset:{creatorSourceCategory:'font'}}:null}});assert.equal(card.open,true);
});
test('client filters existing approved metadata without duplicating the materials vault',async()=>{
  const c=await client();c.context.assets=[{id:'1',title:'LAB',category:'logo',usage:'코랄'},{id:'2',title:'SUIT',category:'font',usage:'한글'}];c.eval('creatorSources.data={assets,guides:[]};creatorSources.category="font"');assert.equal(c.eval('creatorSourcesFiltered().length'),1);c.eval('creatorSources.category="all";creatorSources.query="코랄"');assert.equal(c.eval('creatorSourcesFiltered()[0].id'),'1');
  const script=await readFile(join(here,'public/creator-sources.js'),'utf8');assert.ok(!script.includes("api('/api/studio-materials"));assert.ok(!script.includes("api('/api/content-generate"));
});
