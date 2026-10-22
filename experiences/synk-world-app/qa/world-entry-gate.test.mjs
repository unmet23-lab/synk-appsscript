import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createWorldEntryGate} from '../tutor-selection-sync.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(options={}){
 let current={owner:'guest',generation:0,tutor:null},continuation;
 const states=[],entries=[],errors=[],choices=[];
 const gate=createWorldEntryGate({restore:options.restore||(()=>Promise.resolve()),prepare:options.prepare||(()=>Promise.resolve(true)),read:()=>current,
  choose:then=>{choices.push({...current});continuation=then;},onState:value=>states.push(value.phase),onEnter:value=>entries.push({...value}),onError:error=>errors.push(error)});
 return {gate,states,entries,errors,choices,set(value){current={...current,...value};},finish:()=>continuation?.()};
}

test('Game Start waits for account restoration and skips selection for the restored tutor',async()=>{
 const account=deferred(),f=fixture({restore:()=>account.promise});
 const starting=f.gate.start();await Promise.resolve();
 assert.deepEqual(f.states,['restoring']);assert.equal(f.choices.length,0);assert.equal(f.entries.length,0);
 f.set({owner:'account-a',generation:1,tutor:'kkamong'});account.resolve();
 assert.equal(await starting,true);assert.equal(f.choices.length,0);assert.equal(f.entries[0].tutor,'kkamong');
});

test('an account with no selection chooses once and enters only after confirmed selection',async()=>{
 const f=fixture();f.set({owner:'new-account',generation:1});
 assert.equal(await f.gate.start(),false);assert.equal(f.gate.state().phase,'choosing');assert.equal(f.entries.length,0);
 assert.equal(f.finish(),false,'choosing a preview cannot enter');
 f.set({tutor:'marin'});assert.equal(f.finish(),true);assert.equal(f.entries[0].owner,'new-account');
 assert.equal(f.finish(),true);assert.equal(f.entries.length,1,'a duplicate completion does not enter twice');
});

test('a remembered guest can return without creating an account or choosing again',async()=>{
 const f=fixture();f.set({tutor:'mongle'});await f.gate.start();
 assert.deepEqual(f.choices,[]);assert.equal(f.entries[0].owner,'guest');
});

test('the gate rechecks the owner if account changes while tutor records are loading',async()=>{
 const load=deferred();let reads=0;const f=fixture({prepare:()=>++reads===1?load.promise:Promise.resolve(true)});
 f.set({owner:'account-a',generation:1,tutor:'mongle'});const starting=f.gate.start();await Promise.resolve();
 f.set({owner:'account-b',generation:2,tutor:'marin'});load.resolve(true);await starting;
 assert.equal(reads,2);assert.equal(f.entries.length,1);assert.equal(f.entries[0].owner,'account-b');
});

test('cancel makes a late choice completion inert and replay uses the saved tutor',async()=>{
 const f=fixture();await f.gate.start();f.gate.cancel();f.set({tutor:'kkamong'});
 assert.equal(f.finish(),false);assert.equal(f.entries.length,0);assert.equal(f.gate.state().phase,'idle');
 await f.gate.start();assert.equal(f.entries.length,1);assert.equal(f.choices.length,1);
});

test('a stale chooser cannot enter the home of a different owner',async()=>{
 const f=fixture();f.set({owner:'account-a',generation:1});await f.gate.start();
 f.set({owner:'account-b',generation:2,tutor:'marin'});assert.equal(f.finish(),false);
 await Promise.resolve();await Promise.resolve();
 assert.equal(f.entries.length,1);assert.equal(f.entries[0].owner,'account-b');
});

test('a failed account restore never falls through to the temporary guest',async()=>{
 const failure=Error('offline'),f=fixture({restore:()=>Promise.reject(failure)});
 await f.gate.start();assert.equal(f.gate.state().phase,'error');assert.equal(f.choices.length,0);assert.equal(f.entries.length,0);assert.deepEqual(f.errors,[failure]);
});

test('conflicted or unreadable tutor records keep home closed for explicit recovery',async()=>{
 const f=fixture({prepare:()=>Promise.resolve(false)});f.set({owner:'account-a',generation:1,tutor:'mongle'});
 await f.gate.start();assert.equal(f.gate.state().phase,'error');assert.equal(f.choices.length,0);assert.equal(f.entries.length,0);
});

// 입장 준비 실패의 상태 줄(10-22 Fable P2): 원인을 모르는 오류는 함께 뜨는 복구 창의 단추 이름으로, 로그인이 끝난 오류만 로그인 안내로,
// 고를 창이 열린 채 멈춘 경우는 그 창으로 안내한다. 세 글 모두 번역 표의 msg 줄과 글자까지 같아야 영어·몽골어 화면에서 바뀐다.
test('entry failures name the next step and every status line has a translated msg row',async()=>{
 const {default:STRINGS}=await import('../../brand-opening/world-strings.mjs');
 const messages=[];
 const run=async options=>{
  const gate=createWorldEntryGate({restore:()=>Promise.resolve(),prepare:()=>Promise.resolve(true),read:()=>({owner:'account-a',generation:1,tutor:'mongle'}),choose:()=>{},
   onState:value=>{if(value.phase==='error')messages.push(value.message);},...options});
  await gate.start();return messages.at(-1);
 };
 const offline=await run({restore:()=>Promise.reject(Object.assign(Error('offline'),{code:'NETWORK_UNAVAILABLE'}))});
 const signedOut=await run({restore:()=>Promise.reject(Object.assign(Error('401'),{code:'AUTH_REQUIRED'}))});
 const blocked=await run({prepare:()=>Promise.resolve(false)});
 assert.equal(offline,'WORLD를 열지 못했어요. 「다시 불러오기」를 눌러 주세요.');
 assert.equal(signedOut,'로그인이 끝났어요. 다시 로그인해 주세요.');
 assert.equal(blocked,'들어가기 전에 고를 것이 있어요. 열린 창에서 골라 주세요.');
 assert.equal(STRINGS['account.reconnect'].ko,'다시 불러오기','상태 줄이 부르는 단추 이름이 복구 창의 단추와 같다');
 for(const text of [offline,signedOut,blocked]){
  const row=Object.entries(STRINGS).find(([key,entry])=>key.startsWith('msg.')&&entry.ko===text);
  assert.ok(row,`msg 줄 없음: ${text}`);assert.ok(row[1].en&&row[1].mn,`번역 없음: ${row[0]}`);
 }
});

test('newer entry requests supersede older restores without duplicate selection',async()=>{
 const slow=deferred();let reads=0;const f=fixture({restore:()=>++reads===1?slow.promise:Promise.resolve()});
 const first=f.gate.start();await f.gate.start();slow.resolve();await first;
 assert.equal(f.choices.length,1);assert.equal(f.gate.state().phase,'choosing');
});

function loginReturnContext(overrides={}){
 const source=readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
 const callback=source.match(/function resumeEntryAfterClosedLogin\(\)\{[\s\S]*?\n\}/)?.[0];
 assert.ok(callback);
 const context={worldRequested:true,worldPanel:{open:false},accountActionPending:false,sessionTask:null,starts:0};
 context.entryGate={state:()=>({phase:'restoring'}),start:()=>{context.starts++;}};
 Object.assign(context,overrides);vm.createContext(context);vm.runInContext(callback,context);
 return {context,run:()=>vm.runInContext('resumeEntryAfterClosedLogin()',context)};
}

test('closing a cancelled native sign-in rechecks the session and resumes the existing guest tutor',async()=>{
 const account=deferred(),f=fixture({restore:()=>account.promise});f.set({tutor:'kkamong'});f.gate.invalidate();
 const returned=loginReturnContext({entryGate:f.gate});assert.equal(returned.run(),true);
 await Promise.resolve();assert.equal(f.entries.length,0,'account restoration must still finish');
 account.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.entries.length,1);assert.equal(f.entries[0].owner,'guest');assert.equal(f.entries[0].tutor,'kkamong');assert.equal(f.choices.length,0);
});

test('a login panel closed during native startup resumes only after the startup settles',()=>{
 const f=loginReturnContext({accountActionPending:true});assert.equal(f.run(),false);assert.equal(f.context.starts,0);
 f.context.accountActionPending=false;assert.equal(f.run(),true);assert.equal(f.context.starts,1);
});

test('login cancellation does not reopen entry under an active panel, account restore, title or ready home',()=>{
 const cases=[{worldPanel:{open:true}},{sessionTask:Promise.resolve()},{worldRequested:false},{entryGate:{state:()=>({phase:'ready'}),start:()=>assert.fail('ready home must remain ready')}}];
 for(const value of cases){const f=loginReturnContext(value);assert.equal(f.run(),false);assert.equal(f.context.starts,0);}
});
