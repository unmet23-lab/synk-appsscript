import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldPlayHost} from './account-host.mjs';
import {emptyPlayState,validatePlayRecords,validatePlayChanges} from './play-data.mjs';
import {buyItem,awardMiniGame} from '../korean-racing/garage-core.js';
const key='synk.word-magic.progress.v1';
const clone=x=>structuredClone(x);
function storage(){const map=new Map();return {map,get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function server(){const accounts=new Map();let loseAck=false,delay=null;return {accounts,lose(){loseAck=true;},delay(fn){delay=fn;},client(owner){const row=()=>{if(!accounts.has(owner))accounts.set(owner,{revision:0,state:emptyPlayState(),receipts:new Map()});return accounts.get(owner);};const envelope=()=>({ok:true,scope:'synk-play',accountId:owner,revision:row().revision,state:clone(row().state)});return {load:async()=>{if(delay)await delay();return envelope();},mutate:async body=>{
  const r=row();if(r.receipts.has(body.id))return {...envelope(),result:clone(r.receipts.get(body.id)),duplicate:true};let result;
  if(body.action==='wallet'){const method={buyItem,awardMiniGame}[body.method];result=method(r.state.wallet,...body.args);r.state.wallet=result.state;}
  if(body.action==='progress'){for(const c of body.changes)if((r.state.records[c.key]??null)!==c.previous)throw Object.assign(Error('conflict'),{code:'REVISION_CONFLICT'});for(const c of body.changes){if(c.value===null)delete r.state.records[c.key];else r.state.records[c.key]=c.value;}}
  if(body.action==='import'){if(r.revision!==0)throw Object.assign(Error('already'),{code:'IMPORT_CONFLICT'});r.state={...clone(body.state),imported:true};}
  r.revision++;r.receipts.set(body.id,clone(result));if(loseAck){loseAck=false;throw Error('network acknowledgement lost');}return {...envelope(),result};
}};}};}
const make=(remote,owner='a',local=storage(),extra={})=>createWorldPlayHost({accountId:owner,client:remote.client(owner),guard(){},storage:local,...extra});

test('a fresh device restores progress, wallet purchases and equipment from the account',async()=>{
  const remote=server(),a=make(remote),b=make(remote);await a.ready();
  a.storage().setItem(key,JSON.stringify({version:1,completed:['first']}));await a.flush();
  await a.wallet('awardMiniGame',[{game:'word-magic',total:3,correct:3,completed:true,roundId:'first'}]);
  assert.equal((await a.wallet('buyItem',['magic-toys-picnic'])).ok,true);await b.ready();
  assert.equal(b.storage().getItem(key),a.storage().getItem(key));assert.deepEqual(b.snapshot().state.wallet,a.snapshot().state.wallet);assert.equal(b.snapshot().state.wallet.coins,5);
  a.stop();b.stop();
});
test('lost acknowledgement replays one id without paying or spending twice',async()=>{
  const remote=server(),local=storage(),a=make(remote,'a',local);await a.ready();remote.lose();
  await assert.rejects(a.wallet('awardMiniGame',[{game:'word-magic',total:1,correct:1,completed:true,roundId:'once'}]));assert.equal(a.status().pending,1);
  a.stop();const restored=make(remote,'a',local);await restored.ready();assert.equal(restored.snapshot().state.wallet.coins,25);assert.equal(restored.status().pending,0);restored.stop();
});
test('two devices conflicting on the same progress preserve both until explicit choice',async()=>{
  const remote=server(),a=make(remote),b=make(remote);await Promise.all([a.ready(),b.ready()]);
  a.storage().setItem(key,'{"last":1}');await a.flush();b.storage().setItem(key,'{"last":2}');await assert.rejects(b.flush(),{code:'REVISION_CONFLICT'});
  assert.equal(b.storage().getItem(key),'{"last":2}');assert.equal(remote.accounts.get('a').state.records[key],'{"last":1}');
  await b.resolve('local');await a.retry();assert.equal(a.storage().getItem(key),'{"last":2}');a.stop();b.stop();
});
test('favorite removal survives a fresh device and unrelated records survive CAS',async()=>{
  const remote=server(),a=make(remote),fav='SYNK_SHIP_STARBOOK_V1:kept:'+'a'.repeat(32);await a.ready();a.storage().setItem(fav,'{"record":true}');a.storage().setItem(key,'{"last":1}');await a.flush();
  const b=make(remote);await b.ready();b.storage().removeItem(fav);await b.flush();const c=make(remote);await c.ready();assert.equal(c.storage().getItem(fav),null);assert.equal(c.storage().getItem(key),'{"last":1}');[a,b,c].forEach(x=>x.stop());
});
test('logout invalidates old references and pending records never enter a different account',async()=>{
  const remote=server(),local=storage(),a=make(remote,'a',local);await a.ready();const ref=a.storage();ref.setItem(key,'{"last":1}');a.stop();assert.throws(()=>ref.setItem(key,'{}'));
  const b=make(remote,'b',local);await b.ready();assert.equal(b.storage().getItem(key),null);assert.equal(b.status().pending,0);b.stop();
  const a2=make(remote,'a',local);await a2.ready();assert.equal(a2.storage().getItem(key),'{"last":1}');a2.stop();
});
test('guest data is never imported without the explicit import command',async()=>{
  const remote=server(),local=storage();local.setItem(key,'{"last":3}');const a=make(remote,'a',local);await a.ready();assert.equal(a.storage().getItem(key),null);assert.equal(a.status().canImport,true);
  await a.importLegacy();assert.equal(a.storage().getItem(key),'{"last":3}');assert.equal(local.getItem(key),'{"last":3}');assert.equal(a.status().canImport,false);await assert.rejects(a.importLegacy());a.stop();
});
test('late responses after logout cannot restore an ended account',async()=>{
  const remote=server();let release;remote.delay(()=>new Promise(r=>{release=r;}));const a=make(remote);const promise=a.ready();a.stop();release();await assert.rejects(promise);assert.equal(a.status().phase,'stopped');
});
test('the save contract excludes credentials, unknown keys and oversized values',()=>{
  assert.throws(()=>validatePlayRecords({'synk.oauth.session.world':'{}'}));assert.throws(()=>validatePlayRecords({[key]:'{"access_token":"secret"}'}));assert.throws(()=>validatePlayRecords({[key]:JSON.stringify('a'.repeat(600000))}));assert.throws(()=>validatePlayChanges([{key,previous:null,value:null},{key,previous:null,value:'{}'}]));
});
test('an open game cannot silently overwrite remote progress after a foreground refresh',async()=>{
 const remote=server(),a=make(remote),b=make(remote);await a.ready();await b.ready();const openGame=b.storage();assert.equal(openGame.getItem(key),null);
 a.storage().setItem(key,'{"last":4}');await a.flush();await b.retry();
 openGame.setItem(key,'{"last":1}');await assert.rejects(b.flush(),{code:'REVISION_CONFLICT'});assert.equal(remote.accounts.get('a').state.records[key],'{"last":4}');a.stop();b.stop();
});
test('outbox storage failure cannot claim account save or dispatch a purchase',async()=>{
 const remote=server(),local=storage(),a=make(remote,'a',local);await a.ready();local.setItem=()=>{throw Error('quota');};
 assert.throws(()=>a.storage().setItem(key,'{}'));assert.equal(a.status().code,'PLAY_STORAGE_UNAVAILABLE');await assert.rejects(a.wallet('buyItem',['magic-toys-picnic']));assert.equal(remote.accounts.get('a').revision,0);a.stop();
});

test('an import racing another device cannot replace account data or block future saves',async()=>{
 const remote=server(),local=storage();local.setItem(key,'{"last":2}');const a=make(remote,'a',local),b=make(remote);await a.ready();await b.ready();
 b.storage().setItem(key,'{"last":5}');await b.flush();await assert.rejects(a.importLegacy(),{code:'IMPORT_CONFLICT'});assert.equal(a.status().phase,'conflict');
 await assert.rejects(a.resolve('local'),{code:'IMPORT_CONFLICT'});await a.resolve('remote');assert.equal(a.status().pending,0);assert.equal(a.storage().getItem(key),'{"last":5}');assert.equal(local.getItem(key),'{"last":2}');
 a.storage().setItem(key,'{"last":6}');await a.flush();assert.equal(remote.accounts.get('a').state.records[key],'{"last":6}');assert.ok([...local.map.keys()].some(k=>k.includes(':recovery:')));a.stop();b.stop();
});

for(const code of ['NETWORK','SESSION_REVOKED','AUTH_SESSION_MISSING'])test(`a failed latest-state read reports ${code} and does not remain saved`,async t=>{
 const remote=server(),base=remote.client('a');let failing=false;
 const a=make(remote,'a',storage(),{client:{...base,load:async()=>{if(failing)throw Object.assign(Error(code),{code});return base.load();}}});t.after(()=>a.stop());
 await a.ready();const ref=a.storage();failing=true;await assert.rejects(a.retry(),{code});
 assert.equal(a.status().phase,code==='NETWORK'?'offline':'stopped');assert.equal(a.status().code,code);
 if(code!=='NETWORK'){assert.throws(()=>ref.getItem(key),{code:'PLAY_SESSION_ENDED'});assert.throws(()=>ref.setItem(key,'{}'),{code:'PLAY_SESSION_ENDED'});assert.equal(a.status().pending,0);}
 else{failing=false;await a.retry();assert.equal(a.status().phase,'synced');}
});

test('session revocation during conflict resolution closes the old storage reference',async t=>{
 const remote=server(),base=remote.client('a');let revoked=false;
 const a=make(remote,'a',storage(),{client:{...base,load:async()=>{if(revoked)throw Object.assign(Error('revoked'),{code:'SESSION_REVOKED'});return base.load();}}}),b=make(remote);t.after(()=>{a.stop();b.stop();});
 await a.ready();await b.ready();const ref=a.storage();b.storage().setItem(key,'{"last":2}');await b.flush();ref.setItem(key,'{"last":1}');await assert.rejects(a.flush(),{code:'REVISION_CONFLICT'});
 revoked=true;await assert.rejects(a.resolve('remote'),{code:'SESSION_REVOKED'});assert.equal(a.status().phase,'stopped');assert.equal(a.status().code,'SESSION_REVOKED');assert.throws(()=>ref.setItem(key,'{}'),{code:'PLAY_SESSION_ENDED'});
 assert.equal(remote.accounts.get('a').state.records[key],'{"last":2}');
});

test('a confirmed wallet result does not need another network request',async t=>{
 const remote=server(),base=remote.client('a');let calls=0;
 const a=make(remote,'a',storage(),{client:{...base,mutate:async body=>{if(++calls>1)throw Object.assign(Error('offline'),{code:'NETWORK'});return base.mutate(body);}}});t.after(()=>a.stop());await a.ready();
 const result=await a.wallet('awardMiniGame',[{game:'word-magic',total:1,correct:1,completed:true,roundId:'confirmed'}]);
 assert.equal(result.saved,true);assert.equal(result.state.coins,25);assert.equal(calls,1);assert.equal(a.status().phase,'synced');assert.equal(a.status().pending,0);
});

test('a later queued failure preserves the confirmed wallet result and the pending error',async t=>{
 const remote=server(),base=remote.client('a');let release,started;
 const sent=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const a=make(remote,'a',storage(),{client:{...base,mutate:async body=>{if(body.action==='progress')throw Object.assign(Error('offline'),{code:'NETWORK'});started();await gate;return base.mutate(body);}}});t.after(()=>a.stop());await a.ready();
 const result=a.wallet('awardMiniGame',[{game:'word-magic',total:1,correct:1,completed:true,roundId:'before-offline'}]);await sent;a.storage().setItem(key,'{"last":1}');release();
 assert.equal((await result).saved,true);assert.equal(a.snapshot().state.wallet.coins,25);assert.equal(a.status().phase,'offline');assert.equal(a.status().code,'NETWORK');assert.equal(a.status().pending,1);
});

test('concurrent wallet calls each receive their own confirmed result without extra requests',async t=>{
 const remote=server(),base=remote.client('a');let calls=0,release,started;
 const sent=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const a=make(remote,'a',storage(),{client:{...base,mutate:async body=>{if(++calls===1){started();await gate;}return base.mutate(body);}}});t.after(()=>a.stop());await a.ready();
 const award=a.wallet('awardMiniGame',[{game:'word-magic',total:1,correct:1,completed:true,roundId:'concurrent'}]);await sent;const purchase=a.wallet('buyItem',['magic-toys-picnic']);release();
 const results=await Promise.all([award,purchase]);assert.ok(results.every(result=>result.saved));assert.equal(results[1].ok,true);assert.equal(calls,2);assert.equal(a.snapshot().state.wallet.coins,5);assert.equal(a.status().pending,0);
});

for(const revoked of [false,true])test(`a receipt completed by another tab ${revoked?'reports revocation':'is retrieved with the same id'}`,async t=>{
 const remote=server(),base=remote.client('a'),local=storage(),ids=[];
 const client={...base,mutate:async body=>{ids.push(body.id);if(revoked&&ids.length>1)throw Object.assign(Error('revoked'),{code:'SESSION_REVOKED'});return base.mutate(body);}};
 const other=make(remote,'a',local,{client}),a=make(remote,'a',local,{client,locks:{request:async(name,task)=>{await other.flush();return task();}}});t.after(()=>{a.stop();other.stop();});await other.ready();await a.ready();
 const result=a.wallet('awardMiniGame',[{game:'word-magic',total:1,correct:1,completed:true,roundId:'other-tab'}]);
 if(revoked){await assert.rejects(result,{code:'SESSION_REVOKED'});assert.equal(a.status().phase,'stopped');}
 else{assert.equal((await result).state.coins,25);assert.equal(a.status().phase,'synced');}
 assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);assert.equal(remote.accounts.get('a').state.wallet.coins,25);
});

test('a definitively rejected wallet is preserved and cannot block later account progress',async t=>{
 const remote=server(),base=remote.client('a'),local=storage();let rejectedBody;
 const client={...base,mutate:async body=>{if(body.method==='invalid-review'){rejectedBody=clone(body);throw Object.assign(Error('invalid review'),{code:'INVALID_PLAY_COMMAND',status:400});}return base.mutate(body);}};
 const a=make(remote,'a',local,{client});t.after(()=>a.stop());await a.ready();
 await assert.rejects(a.wallet('invalid-review',[{id:'review',wordIds:['old-word']}]),{code:'INVALID_PLAY_COMMAND'});
 assert.equal(a.status().phase,'synced');assert.equal(a.status().pending,0);assert.equal(a.status().rejected,1);
 const archive=JSON.parse([...local.map].find(([key])=>key.includes(':rejected:'))[1]);assert.deepEqual(archive.entry.body,rejectedBody);assert.equal(archive.accountId,'a');
 a.storage().setItem(key,'{"last":2}');await a.retry();assert.equal(remote.accounts.get('a').state.records[key],'{"last":2}');
 assert.equal((await a.wallet('awardMiniGame',[{game:'word-magic',total:1,correct:1,completed:true,roundId:'after-rejection'}])).saved,true);
 assert.equal(a.snapshot().state.wallet.coins,25);assert.equal(a.status().rejected,1);
});

test('a restored rejected request is archived before the next command and stays account scoped',async t=>{
 const remote=server(),base=remote.client('a'),local=storage(),id='11111111-1111-4111-8111-111111111111',later='22222222-2222-4222-8222-222222222222';let calls=0;
 const body={id,action:'wallet',method:'awardRace',args:[{id:'review',wordIds:['old-word']},[],{automatic:false,roundId:'old'}]};
 local.setItem('synk.play.account.v1:a:pending:'+id,JSON.stringify({accountId:'a',at:1,body}));
 local.setItem('synk.play.account.v1:a:pending:'+later,JSON.stringify({accountId:'a',at:2,body:{id:later,action:'progress',changes:[{key,previous:null,value:'{"last":3}'}]}}));
 const a=make(remote,'a',local,{client:{...base,mutate:async value=>{calls++;if(value.id===id)throw Object.assign(Error('invalid'),{code:'INVALID_PLAY_COMMAND'});return base.mutate(value);}}});t.after(()=>a.stop());
 await a.ready();await a.retry();assert.equal(calls,2);assert.equal(a.status().pending,0);assert.equal(a.status().rejected,1);assert.equal(a.storage().getItem(key),'{"last":3}');
 const b=make(remote,'b',local);t.after(()=>b.stop());await b.ready();assert.equal(b.status().rejected,0);assert.equal(b.storage().getItem(key),null);
 const reopened=make(remote,'a',local);t.after(()=>reopened.stop());await reopened.ready();assert.equal(reopened.status().rejected,1);
});

test('another tab can preserve a rejected wallet without a second send or a false save',async t=>{
 const remote=server(),base=remote.client('a'),local=storage();let sends=0;
 const client={...base,mutate:async()=>{sends++;throw Object.assign(Error('invalid'),{code:'INVALID_PLAY_COMMAND'});}};
 const other=make(remote,'a',local,{client}),a=make(remote,'a',local,{client,locks:{request:async(name,task)=>{await other.flush();return task();}}});t.after(()=>{a.stop();other.stop();});await other.ready();await a.ready();
 await assert.rejects(a.wallet('invalid',[]),{code:'INVALID_PLAY_COMMAND'});assert.equal(sends,1);assert.equal(a.status().phase,'synced');assert.equal(a.status().pending,0);assert.equal(a.status().rejected,1);
});

test('failure to preserve a rejected command leaves its original outbox entry intact',async t=>{
 const remote=server(),base=remote.client('a'),local=storage(),write=local.setItem;
 local.setItem=(key,value)=>{if(key.includes(':rejected:'))throw Error('quota');write(key,value);};
 const a=make(remote,'a',local,{client:{...base,mutate:async()=>{throw Object.assign(Error('invalid'),{code:'INVALID_PLAY_COMMAND'});}}});t.after(()=>a.stop());await a.ready();
 await assert.rejects(a.wallet('invalid',[]),{code:'PLAY_STORAGE_UNAVAILABLE'});assert.equal(a.status().phase,'offline');assert.equal(a.status().pending,1);assert.equal(a.status().rejected,0);
});

for(const code of ['SERVICE_UNAVAILABLE','COMMAND_CAPACITY','REVISION_CONFLICT'])test(`${code} is not discarded as command rejection`,async t=>{
 const remote=server(),base=remote.client('a'),local=storage();const a=make(remote,'a',local,{client:{...base,mutate:async()=>{throw Object.assign(Error(code),{code});}}});t.after(()=>a.stop());await a.ready();
 await assert.rejects(a.wallet('anything',[]),{code});assert.equal(a.status().pending,1);assert.equal(a.status().rejected,0);assert.equal(a.status().phase,code==='REVISION_CONFLICT'?'conflict':'offline');
});

test('invalid acknowledgement after a commit preserves the same command for receipt retry',async t=>{
 const remote=server(),base=remote.client('a'),local=storage();let malformed=true;
 const a=make(remote,'a',local,{client:{...base,mutate:async body=>{const response=await base.mutate(body);return malformed?{...response,state:{wallet:response.state.wallet,records:{unknown:'{}'},imported:false}}:response;}}});t.after(()=>a.stop());await a.ready();
 await assert.rejects(a.wallet('awardMiniGame',[{game:'word-magic',total:1,correct:1,completed:true,roundId:'malformed-ack'}]),{code:'INVALID_PLAY_STATE'});
 assert.equal(a.status().pending,1);assert.equal(a.status().rejected,0);malformed=false;await a.retry();assert.equal(a.snapshot().state.wallet.coins,25);assert.equal(a.status().pending,0);
});
