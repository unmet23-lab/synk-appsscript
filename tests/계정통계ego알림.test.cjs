'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFile,spawnSync}=require('node:child_process');
const {promisify}=require('node:util');
const {guardEgo,runCloser,LIMITS,CLOSER}=require('../tools/계정통계예약/ego-alert.cjs');
const {egoRound}=require('../tools/계정통계예약/capture-routes.cjs');

function fakeChild(){
  const log=[];
  return {log,stdout:{destroy:()=>log.push('stdout')},stderr:{destroy:()=>log.push('stderr')},kill:()=>log.push('kill')};
}
function setup(t){
  t.mock.timers.enable({apis:['setTimeout','Date']});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-ego-alert-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const step=async ms=>{t.mock.timers.tick(ms);await new Promise(resolve=>setImmediate(resolve));};
  const saved=name=>{try{return JSON.parse(fs.readFileSync(path.join(dir,'ego-alert-'+name+'.json'),'utf8'));}catch{return null;}};
  return {dir,step,saved};
}
const limits={first:20_000,every:40_000,total:180_000,afterClose:120_000,max:360_000};

test('제때 끝난 읽기는 창을 보지 않고 기록도 남기지 않는다',async t=>{
  const {dir,step,saved}=setup(t),child=fakeChild();let checks=0;
  const stop=guardEgo(child,{dir,name:'fast',check:async()=>{checks++;return 'closed';},limits,state:{closedAt:0}});
  await step(19_999);stop();await step(400_000);
  assert.equal(checks,0);assert.deepEqual(child.log,[]);assert.equal(saved('fast'),null);
});

test('오래 걸린 읽기는 창을 보고, 알림이 없으면 전과 같이 3분에 끊고 그 사실을 남긴다',async t=>{
  const {dir,step,saved}=setup(t),child=fakeChild();let checks=0;
  const stop=guardEgo(child,{dir,name:'stuck',check:async()=>{checks++;return 'none';},limits,state:{closedAt:0}});
  await step(20_000);assert.equal(checks,1);
  await step(40_000);assert.equal(checks,2);
  await step(119_999);assert.deepEqual(child.log,[]);
  await step(1);
  assert.deepEqual(child.log,['stdout','stderr','kill']);
  stop();
  const note=saved('stuck');
  assert.equal(note.timedOut,true);assert.ok(note.checks.length>=2);assert.ok(note.checks.every(c=>c.result==='none'));
  assert.deepEqual(Object.keys(note).sort(),['at','checks','timedOut']);
});

test('느리지만 알림 없이 제때 끝난 읽기는 기록을 남기지 않는다',async t=>{
  const {dir,step,saved}=setup(t),child=fakeChild();
  const stop=guardEgo(child,{dir,name:'slow',check:async()=>'none',limits,state:{closedAt:0}});
  await step(20_000);stop();
  assert.equal(saved('slow'),null);assert.deepEqual(child.log,[]);
});

test('알림을 닫으면 명령을 끊지 않고 닫은 때부터 2분을 더 기다린다',async t=>{
  const {dir,step,saved}=setup(t),child=fakeChild(),answers=['none','none','none','closed','none'];
  const stop=guardEgo(child,{dir,name:'late',check:async()=>answers.shift()??'none',limits,state:{closedAt:0}});
  await step(20_000);await step(40_000);await step(40_000);await step(40_000); // 140초에 닫음
  await step(40_000); // 180초: 전이라면 끊겼을 때
  assert.deepEqual(child.log,[]);
  await step(79_999);assert.deepEqual(child.log,[]);
  await step(1); // 140초 + 120초
  assert.deepEqual(child.log,['stdout','stderr','kill']);
  stop();
  assert.ok(saved('late').checks.some(c=>c.result==='closed'&&c.afterMs===140_000));
});

test('알림을 닫은 뒤 읽기가 이어서 끝나면 끊지 않고 닫은 사실만 남긴다',async t=>{
  const {dir,step,saved}=setup(t),child=fakeChild();
  const stop=guardEgo(child,{dir,name:'ok',check:async()=>'closed',limits,state:{closedAt:0}});
  await step(20_000);await step(5_000);stop();await step(400_000);
  assert.deepEqual(child.log,[]);
  assert.deepEqual(saved('ok'),{at:saved('ok').at,timedOut:false,checks:[{afterMs:20_000,result:'closed'}]});
});

test('한 읽기가 닫으면 같은 때 밀려 있던 다른 읽기도 더 기다린다',async t=>{
  const {dir,step}=setup(t),one=fakeChild(),two=fakeChild(),state={closedAt:0};
  const answers=['none','none','closed'];
  const stopOne=guardEgo(one,{dir,name:'one',check:async()=>answers.shift()??'none',limits,state});
  const stopTwo=guardEgo(two,{dir,name:'two',check:async()=>'none',limits,state});
  await step(20_000);await step(40_000);await step(40_000); // 100초에 one이 닫음
  assert.equal(state.closedAt>0,true);stopOne();
  await step(119_999);assert.deepEqual(two.log,[]); // 180초가 지나도 100 + 120초까지 산다
  await step(1);assert.deepEqual(two.log,['stdout','stderr','kill']);stopTwo();
  const three=fakeChild();
  const stopThree=guardEgo(three,{dir,name:'three',check:async()=>'none',limits,state});
  await step(180_000);assert.deepEqual(three.log,['stdout','stderr','kill']);stopThree(); // 앞서 닫은 것은 뒤에 시작한 읽기를 늘리지 않는다
});

test('알림이 되풀이해 떠도 읽기 하나가 6분을 넘지 않는다',async t=>{
  const {dir,step}=setup(t),child=fakeChild();
  const stop=guardEgo(child,{dir,name:'again',check:async()=>'closed',limits,state:{closedAt:0}});
  for(let s=0;s<359;s++)await step(1000);
  assert.deepEqual(child.log,[]);
  await step(1000);assert.deepEqual(child.log,['stdout','stderr','kill']);stop();
});

test('창을 보는 일이 실패해도 읽기는 그대로 가고 정한 낱말만 남는다',async t=>{
  const {dir,step,saved}=setup(t),child=fakeChild();
  const stop=guardEgo(child,{dir,name:'broken',check:async()=>{throw Error('secret-token');},limits,state:{closedAt:0}});
  await step(20_000);stop();
  assert.deepEqual(saved('broken').checks,[{afterMs:20_000,result:'failed'}]);
  assert.equal(/secret/.test(fs.readFileSync(path.join(dir,'ego-alert-broken.json'),'utf8')),false);
});

test('닫는 도구는 Windows에서만 정해 둔 파일을 돌리고, 모르는 답은 failed로 본다',async()=>{
  let calls=[];
  const run=answer=>async(...a)=>{calls.push(a);if(answer instanceof Error)throw answer;return {stdout:answer};};
  assert.equal(await runCloser({platform:'linux',run:run('closed\r\n')}),'none');assert.equal(calls.length,0);
  for(const word of ['none','closed','still_open','unexpected'])assert.equal(await runCloser({platform:'win32',run:run(word+'\r\n')}),word);
  assert.equal(await runCloser({platform:'win32',run:run('top=123 closed')}),'failed');
  assert.equal(await runCloser({platform:'win32',run:run('')}),'failed');
  assert.equal(await runCloser({platform:'win32',run:run(Error('ENOENT'))}),'failed');
  const [bin,args,options]=calls[0];
  assert.equal(bin,'pwsh');assert.deepEqual(args,['-NoProfile','-NonInteractive','-File',CLOSER]);
  assert.equal(options.shell,false);assert.equal(options.windowsHide,true);assert.ok(options.timeout<=LIMITS.every);
});

test('egoRound는 끝나거나 실패하면 지켜보기를 멈추고, 오류를 그대로 넘긴다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-ego-round-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const events=[],guard=(child,info)=>{events.push([child,info.name,info.dir===dir]);return ()=>events.push('stop');};
  const child={},ok=Object.assign(Promise.resolve({stdout:'ok'}),{child});
  let options;
  assert.equal((await egoRound(dir,'a','1',undefined,{start:(_bin,_args,o)=>{options=o;return ok;},guard})).stdout,'ok');
  assert.deepEqual(events,[[child,'a',true],'stop']);
  assert.equal(options.timeout,undefined); // 제한은 지켜보는 쪽이 잰다
  events.length=0;
  const bad=Object.assign(Promise.reject(Error('SYNK_FORMAT')),{child});
  await assert.rejects(egoRound(dir,'b','1',undefined,{start:()=>bad,guard}),/SYNK_FORMAT/);
  assert.equal(events.at(-1),'stop');
});

test('끊긴 명령은 전과 같이 killed로 끝나서 실패 기록이 TIMEOUT이 된다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-ego-kill-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const run=promisify(execFile);
  const start=(_bin,_args,options)=>run(process.execPath,['-e','setTimeout(()=>{},120000)'],options);
  const guard=(child,info)=>guardEgo(child,{...info,check:async()=>'none',limits:{first:50,every:50,total:400,afterClose:100,max:800},state:{closedAt:0}});
  await assert.rejects(egoRound(dir,'kill','1',undefined,{start,guard}),error=>error.killed===true&&!error.code);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'ego-alert-kill.json'),'utf8')).timedOut,true);
});

const pwsh=process.platform==='win32'&&spawnSync('pwsh',['-NoProfile','-Command','exit 0'],{windowsHide:true}).status===0;
test('닫는 파일은 해당 프로그램이 없으면 아무 창도 건드리지 않고 none이라고 답한다',{skip:!pwsh&&'PowerShell 7이 없다'},()=>{
  const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',CLOSER,'-ProcessName','synk-no-such-process'],{encoding:'utf8',windowsHide:true,timeout:60_000});
  assert.equal(r.stdout.trim(),'none',r.stderr);
});
test('닫는 파일은 알림 제목, 창 종류, 단추 하나를 모두 확인한다',()=>{
  const text=fs.readFileSync(CLOSER,'utf8');
  for(const part of ["'Profile error occurred'",'"#32770"','$buttons.Count -ne 1','IsWindowVisible(h)','#requires -Version 7'])assert.ok(text.includes(part),part);
});
