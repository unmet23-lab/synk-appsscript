import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLauncher,resolveRenders} from './server.mjs';

async function setup(t, open=async()=>{}, opened=engine=>engine) {
  const calls=[];
  const server=createLauncher({resolve:engine=>({editorInstalled:false,gameBuilt:false,phase:'needs-install',canLaunch:true,message:'install',executable:`C:/known/${engine}.exe`,args:[],opened:opened(engine)}),open:async target=>{calls.push(target);await open(target);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  const request=(route,method='GET',body,headers={})=>new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:server.address().port,path:route,method,headers:{Host:'127.0.0.1:5195',...headers}},res=>{
      let result='';res.on('data',b=>result+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(result)}));
    });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  const status=await request('/api/status');
  const authorized={Origin:'http://127.0.0.1:5195','Content-Type':'application/json','x-namsan-token':status.headers['x-namsan-token']};
  return {request,calls,authorized,status};
}

test('status exposes real phase without local executable paths or token in body',async t=>{
  const {status}=await setup(t);assert.equal(status.status,200);
  assert.equal(status.body.unity.phase,'needs-install');assert.equal(status.body.unity.busy,false);
  assert.equal(status.body.unity.executable,undefined);assert.equal(status.body.unity.args,undefined);
  assert.equal(status.headers['cache-control'],'no-store');
});
test('cross-origin, missing token and untrusted Host cannot launch a process',async t=>{
  const {request,calls,authorized}=await setup(t);
  for(const headers of [{...authorized,Origin:'https://example.com'},{...authorized,'x-namsan-token':''},{...authorized,Host:'malicious.example:5195'}]){
    assert.equal((await request('/api/launch','POST',{engine:'unity'},headers)).status,403);
  }
  assert.equal(calls.length,0);
});
test('only explicit allowed engine launch resolves a fixed program',async t=>{
  const {request,calls,authorized}=await setup(t);
  const result=await request('/api/launch','POST',{engine:'unreal'},authorized);
  assert.equal(result.status,200);assert.equal(result.body.ok,true);
  assert.equal(calls.length,1);assert.equal(calls[0].executable,'C:/known/unreal.exe');
});
test('request cannot supply arbitrary paths, arguments or unknown engines',async t=>{
  const {request,calls,authorized}=await setup(t);
  for(const body of [{engine:'shell'},{engine:'unity',path:'bad.exe'},{engine:'unreal',args:['bad']},null])
    assert.equal((await request('/api/launch','POST',body,authorized)).status,400);
  assert.equal((await request('/api/launch','GET')).status,404);assert.equal(calls.length,0);
});
test('a pending Windows dialog prevents duplicate or second-engine launches',async t=>{
  let complete;const gate=new Promise(resolve=>complete=resolve);
  const {request,calls,authorized}=await setup(t,()=>gate);
  const first=request('/api/launch','POST',{engine:'unity'},authorized);
  for(let i=0;i<50&&!calls.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal((await request('/api/status')).body.unity.busy,true);
  assert.equal((await request('/api/launch','POST',{engine:'unreal'},authorized)).status,409);
  complete();assert.equal((await first).body.ok,true);assert.equal(calls.length,1);
  assert.equal((await request('/api/status')).body.unity.busy,false);
});
test('the launch message puts the particle each opened name takes',async t=>{
  // The six names resolve() can open: Korean names follow their last syllable, Epic Games Launcher is read 런처.
  let name='';const {request,authorized}=await setup(t,undefined,()=>name);const said=[];
  for(name of ['Unity 게임','Unity 프로젝트','Unity 설치 창','Unreal 게임','Unreal 프로젝트','Epic Games Launcher'])
    said.push((await request('/api/launch','POST',{engine:'unity'},authorized)).body.message.split('.')[0]);
  assert.deepEqual(said,['Unity 게임을 열었어요','Unity 프로젝트를 열었어요','Unity 설치 창을 열었어요','Unreal 게임을 열었어요','Unreal 프로젝트를 열었어요','Epic Games Launcher를 열었어요']);
});
test('Windows cancellation is a visible failure, never a successful game launch',async t=>{
  const {request,authorized}=await setup(t,()=>{throw new Error('cancelled')});
  const result=await request('/api/launch','POST',{engine:'unity'},authorized);
  assert.equal(result.status,409);assert.equal(result.body.ok,false);assert.equal(result.body.message,'cancelled');
});

test('render gallery requires a complete successful report and all three fixed PNGs',t=>{
  const experiences=mkdtempSync(path.join(os.tmpdir(),'namsan-render-gate-'));
  assert.equal(path.dirname(path.resolve(experiences)),path.resolve(os.tmpdir()));
  assert.match(path.basename(experiences),/^namsan-render-gate-[\w-]+$/);
  t.after(()=>rmSync(experiences,{recursive:true,force:true}));
  const directory=path.join(experiences,'namsan-urp/QA/Unity');mkdirSync(directory,{recursive:true});
  const names=['01-garden','02-mongle','03-terrace'];
  const png=Buffer.alloc(40);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1600,16);png.writeUInt32BE(1000,20);Buffer.from([73,69,78,68,174,66,96,130]).copy(png,32);
  for(const name of names)writeFileSync(path.join(directory,name+'.png'),png);
  assert.equal(resolveRenders('unity',{experiences}).available,false,'Images alone are not renderer evidence');
  const report={savedSceneReloaded:true,materialBindingsVerified:true,frames:names.map(name=>({image:'QA/Unity/'+name+'.png',settled:true}))};
  const reportPath=path.join(directory,'render-validation.json');writeFileSync(reportPath,JSON.stringify(report));
  const gallery=resolveRenders('unity',{experiences});assert.equal(gallery.available,true);assert.equal(gallery.frames.length,3);
  assert.match(gallery.frames[0].url,/^\/renders\/unity\/01-garden\.png\?v=\d+$/);
  report.frames[0].settled=false;writeFileSync(reportPath,JSON.stringify(report));
  assert.equal(resolveRenders('unity',{experiences}).available,false,'Unsettled capture is not a published gallery');
  report.frames[0].settled=true;report.frames[0].image='C:/private/secret.png';writeFileSync(reportPath,JSON.stringify(report));
  assert.equal(resolveRenders('unity',{experiences}).available,false,'Report paths cannot choose exposed files');
  report.frames[0].image='QA/Unity/01-garden.png';writeFileSync(reportPath,JSON.stringify(report));
  rmSync(path.join(directory,'03-terrace.png'));assert.equal(resolveRenders('unity',{experiences}).available,false);
  assert.equal(resolveRenders('unreal',{experiences}).available,false);
});
