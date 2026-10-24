'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {accountResponseContract}=require('../src/account-response-contract.cjs');
const {createSubscriptionStore}=require('../src/subscription-store.cjs');
const {createSubscriptionRuntime}=require('../src/subscription-runtime.cjs');
const {EventEmitter}=require('node:events');
const {verifyArchive}=require('../tools/archive-verification.cjs');
const fault=code=>Object.assign(new Error(code),{code});
const reply=(status,data)=>({response:{status,ok:status>=200&&status<300},data});

test('classroom contract distinguishes domain no-roster from gateway authentication without session access',()=>{
  const contract=accountResponseContract('worldRequest',{route:'classroom'},{product:'world'},fault);
  const noRoster=reply(401,{ok:false,error:{code:'AUTH_REQUIRED'}}),gateway=reply(401,{message:'invalid JWT'});
  assert.equal(contract.shouldRefresh(noRoster),false);assert.equal(contract.shouldRefresh(gateway),true);
  assert.deepEqual(contract.decode(noRoster,'owner'),{kind:'classroom',data:{ok:true,classes:[],empty_reason:'NO_LEARNER'}});
  assert.equal(contract.decode(reply(503,null),'owner').data.error.retryable,true);
});

test('response scope and owner contracts reject another account while public WORLD routes remain available',()=>{
  const play=accountResponseContract('playLoad',{}, {product:'play'},fault);
  assert.equal(play.decode(reply(200,{ok:true,scope:'synk-play',accountId:'other'}),'owner').mismatch,true);
  assert.equal(play.decode(reply(200,{ok:true,scope:'synk-care',accountId:'owner'}),'owner').mismatch,true);
  assert.equal(play.decode(reply(200,{ok:true,scope:'synk-play',accountId:'owner'}),'owner').mismatch,false);
  const sharing=accountResponseContract('worldRequest',{route:'town/sharing'},{product:'world'},fault);
  assert.equal(sharing.decode(reply(200,{ok:true,shares:[]}),'owner').mismatch,false);
  assert.throws(()=>accountResponseContract('playLoad',{}, {product:'messenger'},fault),{code:'INVALID_REQUEST'});
});

test('subscription stores own independent boards and preserve malformed data before recovery',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-subscription-boundary-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const make=dir=>createSubscriptionStore({root:dir,now:()=>100,normalizeRow:row=>row});
  const first=make(path.join(root,'a')),second=make(path.join(root,'b'));
  first.load().rows.push({id:'one'});first.persist();
  assert.deepEqual(second.load().rows,[]);assert.deepEqual(make(path.join(root,'a')).load().rows,[{id:'one'}]);
  fs.mkdirSync(path.join(root,'broken'));fs.writeFileSync(path.join(root,'broken/board.json'),'{invalid');
  assert.deepEqual(make(path.join(root,'broken')).load().rows,[]);
  assert.equal(fs.readFileSync(path.join(root,'broken/board.json.broken-100'),'utf8'),'{invalid');
});

test('subscription runtime invalidation makes a newly installed tool visible before the cache expires',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-tools-boundary-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const spawn=command=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin={end(){}};process.nextTick(()=>{child.stdout.emit('data',command==='powershell.exe'?'':'fixture 1.0');child.emit('close',0);});return child;};
  const runtime=createSubscriptionRuntime({platform:'win32',env:{},spawn,now:()=>100,home:root});
  assert.equal((await runtime.detectTools()).claude.path,null);
  fs.mkdirSync(path.join(root,'bin'));const installed=path.join(root,'bin','claude.exe');fs.writeFileSync(installed,'fixture');
  assert.equal((await runtime.detectTools()).claude.path,null);
  runtime.invalidateTools();assert.equal(runtime.tools,null);
  assert.equal((await runtime.detectTools()).claude.path,installed);
});

test('shared archive verifier validates both members and bytes without loading a release builder',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-archive-boundary-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/main.cjs'),'original');fs.writeFileSync(path.join(root,'synk-install.json'),'excluded metadata');
  const files=new Map([['src/main.cjs',Buffer.from('original')]]),asar={uncache(){},listPackage(){return ['/src',...files.keys()].map(p=>p.startsWith('/')?p:'/'+p);},statFile(_archive,file){return file==='src'?{files:{}}:{};},extractFile(_archive,file){return files.get(file.replaceAll('\\','/'));}};
  assert.equal(verifyArchive(asar,root,'fixture.asar'),1);
  files.set('src/main.cjs',Buffer.from('changed'));assert.throws(()=>verifyArchive(asar,root,'fixture.asar'),/Archive source differs/);
  files.set('extra.txt',Buffer.from('unexpected'));assert.throws(()=>verifyArchive(asar,root,'fixture.asar'),/Archive membership differs/);
});

test('domain selection leaves malformed parameters to request validation rather than dereferencing them',()=>{
  assert.doesNotThrow(()=>accountResponseContract('worldRequest',null,{product:'world'},fault));
  assert.doesNotThrow(()=>accountResponseContract('worldRequest',undefined,{product:'world'},fault));
});
