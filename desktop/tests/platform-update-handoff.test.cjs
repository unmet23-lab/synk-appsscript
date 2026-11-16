'use strict';
// 넘김 쪽지, 가림막, 도착 쪽지(검정 구 1-가 구현 설계 2절과 6절). 쪽지는 모양만 바꾸고, 쓰거나 읽다 난 실패는 모두 삼킨다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {handoffPaths,curtainEventName,windowHandle,writeHandoffNote,removeHandoffNote,launchCurtain,consumeArrivalNote}=require('../src/platform-update-handoff.cjs');
const TOKEN='a'.repeat(64);
function folder(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-handoff-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}

test('handoff note carries the window, place, visibility, scene and curtain event, and replaces an old note',t=>{
  const localAppData=folder(t),event=curtainEventName();
  assert.match(event,/^Local\\SYNK\.Curtain\.[a-f0-9]{32}$/);
  fs.mkdirSync(handoffPaths(localAppData).folder,{recursive:true});fs.writeFileSync(handoffPaths(localAppData).handoff,'{"old":true}');
  assert.equal(writeHandoffNote({localAppData,token:TOKEN,appPid:4242,version:'0.4.97',window:131072,bounds:{x:10.4,y:-20,width:1440,height:940},maximized:true,visibility:'behind',cut:0.5,curtainEvent:event,now:()=>Date.parse('2026-11-17T00:00:00Z')}),true);
  const note=JSON.parse(fs.readFileSync(handoffPaths(localAppData).handoff,'utf8'));
  assert.deepEqual(note,{schemaVersion:1,token:TOKEN,appPid:4242,version:'0.4.97',window:131072,x:10,y:-20,width:1440,height:940,maximized:true,visibility:'behind',quiet:false,cut:0.5,curtainEvent:event,writtenAt:'2026-11-17T00:00:00.000Z'});
  assert.deepEqual(fs.readdirSync(handoffPaths(localAppData).folder).filter(name=>name.endsWith('.partial')),[]);
  assert.equal(removeHandoffNote({localAppData}),true);assert.equal(fs.existsSync(handoffPaths(localAppData).handoff),false);
});

test('a handoff note with a bad token, process, version, visibility or event is never written',t=>{
  const localAppData=folder(t),base={localAppData,token:TOKEN,appPid:4242,version:'0.4.97',visibility:'front'};
  for(const bad of [{token:'x'},{appPid:0},{version:'0.4'},{visibility:'sideways'},{curtainEvent:'Global\\SYNK.Curtain.'+'0'.repeat(32)},{localAppData:'relative'}])
    assert.equal(writeHandoffNote({...base,...bad}),false,JSON.stringify(bad));
  assert.equal(fs.existsSync(handoffPaths(localAppData).handoff),false);
});

test('an unwritable handoff folder is swallowed',t=>{
  const localAppData=folder(t);fs.mkdirSync(path.join(localAppData,'SYNK','Installer'),{recursive:true});fs.writeFileSync(path.join(localAppData,'SYNK','Installer','Handoff'),'not a folder');
  assert.equal(writeHandoffNote({localAppData,token:TOKEN,appPid:4242,version:'0.4.97',visibility:'front'}),false);
});

test('window handles become plain numbers',()=>{
  const wide=Buffer.alloc(8);wide.writeBigUInt64LE(0x2a0b4cn);assert.equal(windowHandle(wide),0x2a0b4c);
  const narrow=Buffer.alloc(4);narrow.writeUInt32LE(77);assert.equal(windowHandle(narrow),77);
  assert.equal(windowHandle(null),0);assert.equal(windowHandle(Buffer.alloc(8)),0);
});

function fakeChild({lines=[],exitEarly=false}={}){
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stdout.destroy=()=>{};child.written=[];child.killed=false;child.unrefed=false;
  child.stdin={destroyed:false,writable:true,write:line=>{child.written.push(line);},unref:()=>{},on:()=>{}};
  child.kill=()=>{child.killed=true;};child.unref=()=>{child.unrefed=true;};child.pid=999;
  setImmediate(()=>{if(exitEarly){child.emit('exit',3);return;}for(const line of lines)child.stdout.emit('data',Buffer.from(line));});
  return child;
}

test('the curtain is kept after its first frame and hears cancel and closing on its input',async()=>{
  let spawned=null;const child=fakeChild({lines:['SYNK_CURTAIN_','READY\r\n']});
  const handle=await launchCurtain({spawn:(file,args,options)=>{spawned={file,args,options};return child;},file:'C:\\new\\SYNK Setup.exe',token:TOKEN});
  assert.ok(handle);assert.deepEqual(spawned.args,['--curtain','--handoff-token='+TOKEN]);
  assert.equal(spawned.options.detached,true);assert.deepEqual(spawned.options.stdio,['pipe','pipe','ignore']);
  assert.equal(child.killed,false);assert.equal(child.unrefed,true);
  handle.closing();handle.cancel();assert.deepEqual(child.written,['closing\n','cancel\n']);
});

test('a curtain that does not draw in time, exits, speaks wrongly or cannot start is ended and the update goes on without it',async()=>{
  const timers=[];const slow=fakeChild();
  const waiting=launchCurtain({spawn:()=>slow,file:'x.exe',token:TOKEN,setTimer:(fn,ms)=>{timers.push(ms);setImmediate(fn);return 1;},clearTimer:()=>{}});
  assert.equal(await waiting,null);assert.equal(slow.killed,true);assert.deepEqual(timers,[1500]);
  assert.equal(await launchCurtain({spawn:()=>fakeChild({exitEarly:true}),file:'x.exe',token:TOKEN}),null);
  const wrong=fakeChild({lines:['SYNK_UPDATE_READY x\n']});assert.equal(await launchCurtain({spawn:()=>wrong,file:'x.exe',token:TOKEN}),null);assert.equal(wrong.killed,true);
  assert.equal(await launchCurtain({spawn:()=>{throw Error('no such file');},file:'x.exe',token:TOKEN}),null);
  assert.equal(await launchCurtain({spawn:()=>fakeChild(),file:'x.exe',token:'bad'}),null);
});

test('the arrival note is used only by the app the installer opened, within five minutes, and is always removed',t=>{
  const localAppData=folder(t),now=Date.parse('2026-11-17T00:05:00Z'),paths=handoffPaths(localAppData);
  const write=(extra={})=>{fs.mkdirSync(paths.folder,{recursive:true});fs.writeFileSync(paths.arrival,JSON.stringify({schemaVersion:1,kind:'updated',installerPid:777,version:'0.4.97',x:-1440,y:10,width:1440,height:940,maximized:false,visibility:'behind',cut:1,lit:0.58,writtenAt:'2026-11-17T00:04:00.000Z',...extra}));};
  write();
  assert.deepEqual(consumeArrivalNote({localAppData,version:'0.4.97',parentPid:777,now:()=>now}),{kind:'updated',visibility:'behind',maximized:false,bounds:{x:-1440,y:10,width:1440,height:940},cut:1,lit:0.58});
  assert.equal(fs.existsSync(paths.arrival),false,'a used arrival note is removed');
  for(const [extra,options] of [[{},{parentPid:778}],[{version:'0.4.96'},{}],[{writtenAt:'2026-11-16T23:59:00.000Z'},{}],[{kind:'surprise'},{}],[{visibility:'hidden-ish'},{}]]){
    write(extra);
    assert.equal(consumeArrivalNote({localAppData,version:'0.4.97',parentPid:777,now:()=>now,...options}),null,JSON.stringify(extra)+JSON.stringify(options));
    assert.equal(fs.existsSync(paths.arrival),false,'a refused arrival note is removed too');
  }
  write({width:10});assert.equal(consumeArrivalNote({localAppData,version:'0.4.97',parentPid:777,now:()=>now}).bounds,null);
  fs.writeFileSync(paths.arrival,'{broken');assert.equal(consumeArrivalNote({localAppData,version:'0.4.97',parentPid:777,now:()=>now}),null);
  assert.equal(consumeArrivalNote({localAppData,version:'0.4.97',parentPid:777,now:()=>now}),null,'no note');
});
