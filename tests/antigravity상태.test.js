'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {saveAntigravity,readAntigravity,cacheDirectory}=require('../tools/operations-home/antigravity-status');
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'synk-agy-status-test-')),root=path.join(base,'SYNK-appsscript');fs.mkdirSync(root);
 let clock=Date.now();const createdAt=new Date(clock-60_000).toISOString();
 const processes=new Map([[42,{pid:42,parentPid:30,name:'node.exe',createdAt}],[30,{pid:30,parentPid:10,name:'cmd.exe',createdAt}],[10,{pid:10,parentPid:1,name:'agy.exe',createdAt}]]);
 const receiverPath=path.resolve(__dirname,'../tools/operations-home/antigravity-status.js'),settingsPath=path.join(base,'settings.json');
 const opts={cacheBase:path.join(base,'cache'),settingsPath,receiverPath,parentPid:30,now:()=>clock,getProcessInfo:async pid=>processes.get(pid)||null,processExists:pid=>processes.has(pid)};
 fs.writeFileSync(settingsPath,JSON.stringify({statusLine:{type:'command',command:'node "'+receiverPath+'" --root "'+root+'"',enabled:true}}));
 const payload={conversation_id:'cda5f994-7345-4a92-b7a6-b387ea277af3',cwd:root,agent_state:'working',model:{id:'gemini-test',display_name:'Gemini Test'},tool_confirmation_pending:false};
 t.after(()=>{assert.equal(path.dirname(base),os.tmpdir());assert.ok(path.basename(base).startsWith('synk-agy-status-test-'));fs.rmSync(base,{recursive:true,force:true});});
 return {root,base,opts,payload,processes,advance:ms=>{clock+=ms;},now:()=>clock};
}
test('공식 상태에서 필요한 메타데이터만 보존하고 모델을 바꾸지 않는다',async t=>{
 const f=fixture(t),secret='SECRET_DO_NOT_STORE';
 const result=await saveAntigravity(f.root,{...f.payload,email:secret,transcript_path:secret,prompt:secret,quota:{secret},checkedAt:'2099-01-01T00:00:00Z'},f.opts);
 assert.equal(result.saved,true);
 const feed=await readAntigravity(f.root,f.opts);assert.equal(feed.configured,true);assert.equal(feed.connected,true);assert.equal(feed.tasks.length,1);assert.equal(feed.tasks[0].status,'running');assert.equal(feed.tasks[0].model,'Gemini Test');assert.equal(feed.tasks[0].modelId,'gemini-test');
 const folder=cacheDirectory(f.root,f.opts),files=fs.readdirSync(folder).filter(n=>n.endsWith('.json'));assert.equal(files.length,1);
 assert.ok(!fs.readFileSync(path.join(folder,files[0]),'utf8').includes(secret));assert.ok(!JSON.stringify(feed).includes(secret));assert.equal(Date.parse(feed.checkedAt),f.now());
});
test('승인 대기는 작업 중보다 우선하고 idle을 업무 완료로 바꾸지 않는다',async t=>{
 const f=fixture(t);await saveAntigravity(f.root,{...f.payload,tool_confirmation_pending:true},f.opts);assert.equal((await readAntigravity(f.root,f.opts)).tasks[0].status,'needs_attention');
 f.advance(1000);await saveAntigravity(f.root,{...f.payload,agent_state:'idle'},f.opts);assert.equal((await readAntigravity(f.root,f.opts)).tasks[0].status,'idle');
 f.advance(1000);await saveAntigravity(f.root,{...f.payload,agent_state:'idle',task_count:1},f.opts);assert.equal((await readAntigravity(f.root,f.opts)).tasks[0].status,'running');
});
test('상태 변화가 없는 긴 작업도 같은 agy 프로세스가 살아 있으면 유지한다',async t=>{
 const f=fixture(t);await saveAntigravity(f.root,f.payload,f.opts);f.advance(25*60*60_000);const feed=await readAntigravity(f.root,f.opts);assert.equal(feed.tasks[0].status,'running');assert.notEqual(feed.tasks[0].stale,true);
});
test('닫힌 명령창과 재사용된 PID를 진행 중으로 남기지 않는다',async t=>{
 const f=fixture(t);await saveAntigravity(f.root,f.payload,f.opts);f.processes.delete(10);let feed=await readAntigravity(f.root,f.opts);assert.equal(feed.tasks[0].status,'unknown');assert.equal(feed.tasks[0].stale,true);
 f.advance(1000);f.processes.set(10,{pid:10,parentPid:1,name:'agy.exe',createdAt:new Date(f.now()).toISOString()});feed=await readAntigravity(f.root,f.opts);assert.equal(feed.tasks[0].status,'unknown');
});
test('잘못된 입력과 회사 밖 작업은 마지막 정상 상태를 덮지 않는다',async t=>{
 const f=fixture(t);await saveAntigravity(f.root,f.payload,f.opts);assert.equal((await saveAntigravity(f.root,{...f.payload,conversation_id:'../../outside'},f.opts)).saved,false);
 const outside=path.join(f.base,'personal');fs.mkdirSync(outside);assert.equal((await saveAntigravity(f.root,{...f.payload,cwd:outside},f.opts)).saved,false);assert.equal((await saveAntigravity(f.root,null,f.opts)).saved,false);
 assert.equal((await readAntigravity(f.root,f.opts)).tasks.length,1);
});
test('연결 설정과 첫 실제 수신, 오래된 수신을 구분한다',async t=>{
 const f=fixture(t);let feed=await readAntigravity(f.root,f.opts);assert.equal(feed.configured,true);assert.equal(feed.connected,false);assert.equal(feed.tasks.length,0);
 await saveAntigravity(f.root,f.payload,f.opts);f.processes.delete(10);f.advance(25*60*60_000);feed=await readAntigravity(f.root,f.opts);assert.equal(feed.tasks.length,0);
 fs.writeFileSync(f.opts.settingsPath,JSON.stringify({statusLine:{enabled:false}}));feed=await readAntigravity(f.root,f.opts);assert.equal(feed.configured,false);
});
test('여러 명령창의 상태가 서로 덮이지 않는다',async t=>{
 const f=fixture(t);await Promise.all([saveAntigravity(f.root,f.payload,f.opts),saveAntigravity(f.root,{...f.payload,conversation_id:'d31a2138-02f8-4b42-9b6a-3b8a68cd9d27',agent_state:'idle'},f.opts)]);assert.equal((await readAntigravity(f.root,f.opts)).tasks.length,2);
});
test('오래된 한 세션 때문에 다른 살아 있는 작업을 숨기지 않는다',async t=>{
 const f=fixture(t);await saveAntigravity(f.root,f.payload,{...f.opts,parentPid:9876});
 await saveAntigravity(f.root,{...f.payload,conversation_id:'d31a2138-02f8-4b42-9b6a-3b8a68cd9d27'},f.opts);
 const feed=await readAntigravity(f.root,f.opts);assert.equal(feed.connected,true);assert.equal(feed.stale,false);assert.equal(feed.tasks.filter(task=>!task.stale).length,1);
});
test('늦게 끝난 이전 수신이 더 새로운 상태를 덮어쓰지 않는다',async t=>{
 const f=fixture(t),older=f.now();f.advance(1000);await saveAntigravity(f.root,{...f.payload,agent_state:'idle'},f.opts);
 await saveAntigravity(f.root,f.payload,{...f.opts,now:()=>older});
 const feed=await readAntigravity(f.root,f.opts);assert.equal(feed.tasks[0].status,'idle');assert.equal(Date.parse(feed.tasks[0].checkedAt),f.now());
});

test('임시 셸이 종료되어도 실제 Gemini 창을 확인하고 후속 수신은 프로세스 조회 없이 저장한다',async t=>{
 const f=fixture(t);await saveAntigravity(f.root,f.payload,f.opts);f.processes.delete(30);f.advance(10*60_000);
 let calls=0;await saveAntigravity(f.root,{...f.payload,agent_state:'idle'},{...f.opts,getProcessInfo:async()=>{calls++;throw Error('hot path queried');}});
 assert.equal(calls,0);const feed=await readAntigravity(f.root,f.opts);assert.equal(feed.tasks[0].status,'idle');assert.equal(feed.tasks[0].processState,'alive');
});

test('실제 Gemini 창을 확인하지 못한 수신은 임시 셸 종료만으로 창 종료를 단정하지 않는다',async t=>{
 const f=fixture(t);await saveAntigravity(f.root,f.payload,{...f.opts,getProcessInfo:async()=>{throw Error('lookup unavailable');}});
 f.processes.delete(30);const feed=await readAntigravity(f.root,f.opts);assert.equal(feed.tasks[0].processState,'unverified');assert.equal(feed.tasks[0].stale,true);assert.equal(feed.connected,false);
});
