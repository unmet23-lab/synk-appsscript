'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createSubscriptionProviders}=require('../src/subscription-providers.cjs');
const {createSubscriptionLogin}=require('../src/subscription-login.cjs');
const {createSharedAccounts,groupSubscriptionReads}=require('../src/subscription-shared-accounts.cjs');
const {createSubscriptionStore}=require('../src/subscription-store.cjs');

test('a registered provider participates in read retry and login verification without service-name branches',async()=>{
  const calls=[];
  const definitions={fixture:{spec:{label:'Fixture',bin:'fixture'},policy:{login:{args:()=>['sign-in']}},create:()=>({
    read:async row=>{calls.push(row.id);return {state:calls.length===1?'needs-login':'ok'};},
    verify:async folder=>({ok:true,email:folder+'@example.test'})
  })}};
  const providers=createSubscriptionProviders({definitions,runtime:{tools:{fixture:{path:'/fixture'}}},accounts:{},system:{},now:()=>10,retryDelay:0});
  assert.deepEqual(await providers.readConfirmed({id:'one',source:'auto',service:'fixture'}),{state:'ok'});
  assert.deepEqual(calls,['one','one']);
  assert.deepEqual(await providers.verifyLogin('fixture','profile'),{ok:true,email:'profile@example.test'});
  assert.equal(providers.get('constructor'),null);
  assert.equal((await providers.readConfirmed({id:'legacy',source:'auto',service:'constructor'})).state,'error');
  assert.equal(await providers.readConfirmed({id:'manual',source:'manual',service:'fixture'}),null);
});

test('login lifecycle uses the registered provider contract and publishes through account operations',async t=>{
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin={write(){}};child.unref=()=>{};
  const spawned=[],added=[],refreshed=[],changes=[];
  const runtime={tools:{fixture:{path:'/fixture'}},detectTools:async()=>{},childEnv:extra=>extra,stopProcess:()=>{},openWindowsConsole:async()=>{},spawnMacTerminal:()=>{}};
  const providers={get:()=>({spec:{label:'Fixture',folders:false},policy:{login:{args:email=>['sign-in',email],domains:['login.example.ai'],acceptsEmail:true,needsCode:true,browserMessage:'fixture message'}}}),verifyLogin:async()=>({ok:true,email:'one@example.test'})};
  const accounts={accountsDir:'/unused',homeEnv:()=>({FIXTURE:'1'}),agyCwd:()=>undefined,rows:()=>[],add:(...args)=>{added.push(args);return {id:'connected'};},refresh:async request=>{refreshed.push(request);},removeFolder:()=>assert.fail('no folder exists')};
  const login=createSubscriptionLogin({runtime,providers,accounts,system:{platform:'linux',env:{},spawn:(...args)=>{spawned.push(args);return child;}},now:()=>10,onChange:()=>changes.push(login.state.stage),openExternal:async()=>{}});
  t.after(()=>login.dispose());
  assert.equal((await login.startLogin('fixture',{email:'one@example.test'})).ok,true);
  assert.deepEqual(spawned[0].slice(0,2),['/fixture',['sign-in','one@example.test']]);
  child.stdout.emit('data','https://login.example.ai.evil.test/oauth\nhttp://login.example.ai/oauth\n');
  assert.equal(login.state.url,null);assert.equal(login.state.stage,'starting');
  child.stdout.emit('data','https://login.example.ai/oauth/authorize');
  assert.equal(login.state.url,'https://login.example.ai/oauth/authorize');
  assert.equal(login.state.needsCode,true);assert.equal(login.state.message,'fixture message');
  child.emit('close',0);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(login.state.stage,'done');
  assert.deepEqual(added,[['fixture',null,{ok:true,email:'one@example.test'}]]);
  assert.deepEqual(refreshed,[{ids:['connected']}]);
  assert.ok(changes.includes('browser')&&changes.includes('verifying')&&changes.includes('done'));
});

test('inherited object names never own shared account reads',()=>{
  const rows=['__proto__','constructor','toString'].map(service=>({id:service,service,source:'auto'}));
  const work=groupSubscriptionReads(rows,rows,{});
  assert.deepEqual(work.groups.map(group=>group.owner),[null,null,null]);
  assert.deepEqual(work.groups.map(group=>group.row),rows);
});

test('shared-login account owner preserves identity, hidden accounts, and read coverage for any provider',()=>{
  const a={id:'a',service:'fixture',source:'auto',email:'a@example.test',state:'ok',live:{used:20}};
  const b={id:'b',service:'fixture',source:'auto',email:'b@example.test',state:'elsewhere',live:{used:50}};
  const ordinary={id:'ordinary',service:'other',source:'auto'},board={rows:[a,ordinary,b],settings:{}};
  const policy={hiddenKey:'fixtureHidden',hiddenMax:20,awayMessage:'away',nobodyMessage:'nobody',unknownMessage:'unknown'};
  const owner=createSharedAccounts({service:'fixture',policy,load:()=>board,now:()=>42,applyRead:(row,result)=>Object.assign(row,result),addRow:()=>assert.fail('hidden account must not be recreated')});
  owner.apply({state:'ok',email:'B@example.test',live:{used:55}});
  assert.equal(a.state,'elsewhere');assert.deepEqual(a.live,{used:20});assert.deepEqual(b.live,{used:55});
  owner.remove(b);board.rows.splice(board.rows.indexOf(b),1);
  owner.apply({state:'ok',email:'B@example.test',live:{used:60}});
  assert.deepEqual(board.settings.fixtureHidden,['b@example.test']);assert.equal(board.rows.length,2);
  owner.reconnect('b@example.test');assert.deepEqual(board.settings.fixtureHidden,[]);
  board.rows.push(b);
  const work=groupSubscriptionReads([ordinary,b],board.rows,{fixture:owner});
  assert.deepEqual([...work.covered],['ordinary','b','a']);
  assert.equal(work.groups[0].row,ordinary);assert.equal(work.groups[1].owner,owner);assert.equal(work.groups[1].count,1);
});

test('persist before first explicit load keeps an existing board',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-store-first-save-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'board.json'),JSON.stringify({version:1,rows:[{id:'kept'}],settings:{usdKrw:1300}}));
  const store=createSubscriptionStore({root,now:()=>1,normalizeRow:row=>row});
  store.persist();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'board.json'))).rows,[{id:'kept'}]);
});

