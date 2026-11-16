'use strict';
// 「바꾸는 중」 표시(검정 구 1-가 구현 설계 2절 장치 1): 설치기가 바꾸는 동안 사람이 켠 앱은 창 없이 요청만 남기고 끝난다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {STALE_MS,markerPaths,readUpdatingMarker,writeShowRequest,yieldToUpdatingInstaller}=require('../src/platform-update-marker.cjs');
function folder(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-marker-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}
function mark(localAppData,text,ageMs=0){const {folder:dir,marker}=markerPaths(localAppData);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(marker,text);const at=new Date(Date.now()-ageMs);fs.utimesSync(marker,at,at);return marker;}

test('a fresh marker of a live installer is seen, a stale or dead one is not',t=>{
  const localAppData=folder(t);
  assert.deepEqual(readUpdatingMarker({localAppData}),{present:false,pid:null},'no marker');
  mark(localAppData,JSON.stringify({pid:4242,product:'platform'}));
  assert.deepEqual(readUpdatingMarker({localAppData,isAlive:pid=>pid===4242}),{present:true,pid:4242});
  assert.deepEqual(readUpdatingMarker({localAppData,isAlive:()=>false}),{present:false,pid:null},'the installer is gone');
  mark(localAppData,JSON.stringify({pid:4242}),STALE_MS+2000);
  assert.deepEqual(readUpdatingMarker({localAppData,isAlive:()=>true}),{present:false,pid:null},'heartbeat stopped more than ten seconds ago');
});

test('an unreadable fresh marker is read twice and then counted as present without a number',t=>{
  const localAppData=folder(t);mark(localAppData,'{"pid":');
  let reads=0;
  assert.deepEqual(readUpdatingMarker({localAppData,read:file=>{reads++;return fs.readFileSync(file,'utf8');}}),{present:true,pid:null});
  assert.equal(reads,2);
  let calls=0;
  assert.deepEqual(readUpdatingMarker({localAppData,isAlive:()=>true,read:()=>{calls++;if(calls===1)throw Object.assign(Error('sharing violation'),{code:'EBUSY'});return '{"pid":77}';}}),{present:true,pid:77},'a second read succeeds');
});

test('the show request carries the installer number and is retried before giving up quietly',t=>{
  const localAppData=folder(t);
  assert.equal(writeShowRequest({localAppData,pid:4242,now:()=>Date.parse('2026-11-17T00:00:00Z')}),true);
  assert.deepEqual(JSON.parse(fs.readFileSync(markerPaths(localAppData).request,'utf8')),{pid:4242,at:'2026-11-17T00:00:00.000Z'});
  assert.equal(writeShowRequest({localAppData,pid:null}),true);assert.equal(JSON.parse(fs.readFileSync(markerPaths(localAppData).request,'utf8')).pid,null);
  const waits=[];let tries=0;
  assert.equal(writeShowRequest({localAppData,pid:1,write:()=>{tries++;throw Error('locked');},wait:ms=>waits.push(ms)}),false);
  assert.equal(tries,6);assert.deepEqual(waits,[200,200,200,200,200]);
});

test('an app opened while the installer updates leaves a request and exits without any window',t=>{
  const localAppData=folder(t);const exits=[];
  assert.equal(yieldToUpdatingInstaller({localAppData,exit:code=>exits.push(code)}),false);assert.deepEqual(exits,[]);
  mark(localAppData,JSON.stringify({pid:999}));
  assert.equal(yieldToUpdatingInstaller({localAppData,exit:code=>exits.push(code),isAlive:()=>true}),true);
  assert.deepEqual(exits,[0]);assert.equal(JSON.parse(fs.readFileSync(markerPaths(localAppData).request,'utf8')).pid,999);
});

// 본체가 쓰다 만 초안을 물으면 화면의 판단만 돌려준다(조용한 업데이트의 조건). 답하지 못하면 「있음」이다
test('the main window bridge answers a draft check with the screen judgement only',()=>{
  const vm=require('node:vm'),{EventEmitter}=require('node:events');
  let bridge=null;const ipcRenderer=new EventEmitter(),sent=[];ipcRenderer.send=(...args)=>sent.push(args);ipcRenderer.invoke=async()=>({ok:true});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value;}},ipcRenderer})});
  let answer=false;const stop=bridge.answerDraftCheck(()=>answer);
  ipcRenderer.emit('synk:draft-check',{},7);answer=true;ipcRenderer.emit('synk:draft-check',{},8);
  answer=()=>{throw Error('screen broke');};
  const failing=bridge.answerDraftCheck(()=>{throw Error('screen broke');});stop();
  ipcRenderer.emit('synk:draft-check',{},9);ipcRenderer.emit('synk:draft-check',{},'not a number');failing();
  assert.deepEqual(sent,[['synk:draft-answer',7,false],['synk:draft-answer',8,true],['synk:draft-answer',9,true]]);
  assert.throws(()=>bridge.answerDraftCheck(null));
});
