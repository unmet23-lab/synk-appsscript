'use strict';
// 이미 켜진 앱을 한 번 더 켜면 그 실행은 main.cjs를 읽는 도중 `app.requestSingleInstanceLock()`이 거짓이라 `app.quit()`으로 끝난다.
// 창이 없으면 Electron은 before-quit과 will-quit을 그 자리에서 부른다. 그때 처리기가 아직 선언 전인 let 이름을 만지면
// 「Cannot access '…' before initialization」 창이 뜬다(`?.`로는 막지 못한다). 0.5.5 설치본에서 workspaceFollower로 실제로 났다(사무실 세션 11-22 보고).
// 원천 글을 읽어 따지면 처리기를 쓰는 꼴마다 빠지는 길이 생긴다(GPT pc-second-launch GA1 · d GA1~GA3). 그래서 실제 main.cjs를 실제 모듈과 함께 싣고
// electron과 타이머만 바꿔 두 번째 실행을 그대로 돌린다(fixtures/second-launch-probe.cjs).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const MAIN=path.join(__dirname,'..','src','main.cjs'),PROBE=path.join(__dirname,'fixtures','second-launch-probe.cjs');

function secondLaunch(source){
  const r=spawnSync(process.execPath,[PROBE,MAIN,...(source===undefined?[]:['--stdin'])],{input:source,encoding:'utf8',timeout:90000,windowsHide:true});
  assert.equal(r.status,0,'probe exited cleanly: '+(r.stderr||'').slice(-2000));
  const line=r.stdout.trim().split('\n').pop();
  return JSON.parse(line);
}

test('a second launch quits while main.cjs loads without a quit-handler error',()=>{
  const result=secondLaunch();
  assert.equal(result.top,null,'main.cjs reached the end of its first pass');
  assert.equal(result.quitCalled,true,'the failed single-instance lock quit this launch');
  assert.ok(result.handlers['will-quit']>=1&&result.handlers['before-quit']>=1,'quit handlers were registered before the lock');
  assert.deepEqual(result.errors,[],'no quit handler touched a name before its declaration');
});

test('the probe catches a quit-handler name declared after the lock (the 0.5.5 error)',()=>{
  const source=fs.readFileSync(MAIN,'utf8');
  const decl=source.match(/^let workspaceAuth=null,workspaceFollower=null;\r?\n/m);
  assert.ok(decl,'the Workspace auth declaration is where this test expects');
  const lock='else if(!app.requestSingleInstanceLock())app.quit();';
  assert.ok(source.includes(lock),'the single-instance lock line is present');
  // 0.5.5처럼 선언을 잠금보다 아래로 옮긴다
  const broken=source.replace(decl[0],'').replace(/\n$/,'')+'\nlet workspaceAuth=null,workspaceFollower=null;\n';
  const result=secondLaunch(broken);
  assert.equal(result.quitCalled,true);
  assert.ok(result.errors.some(e=>/^will-quit: Cannot access 'workspace(Follower|Auth)' before initialization$/.test(e)),result.errors.join(' | ')||'no error');
});
