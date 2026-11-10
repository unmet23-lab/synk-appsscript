'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {gatedPort,listeningPids,windowsUser,windowsOwned,unixOwned,verifyLocalServer,createLocalServerGate}=require('../src/local-server-owner.cjs');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const NETSTAT=[
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1200',
  '  TCP    127.0.0.1:4296         0.0.0.0:0              LISTENING       4100',
  '  TCP    127.0.0.1:4296         127.0.0.1:51000        ESTABLISHED     4100',
  '  TCP    127.0.0.1:51000        127.0.0.1:4296         ESTABLISHED     7300',
  '  TCP    [::]:4296              [::]:0                 수신 대기       4200',
].join('\r\n');
test('only fixed http 127.0.0.1 entries are gated',()=>{
  assert.equal(gatedPort('http://127.0.0.1:4296/'),4296);assert.equal(gatedPort('http://127.0.0.1:4280/synk-account/teacher.html'),4280);
  for(const entry of ['synk-desktop://platform/index.html','https://synk.im/world/','http://localhost:4296/','http://127.0.0.1/','http://127.0.0.1:0/','bad'])assert.equal(gatedPort(entry),null,entry);
});
test('every socket that would answer the port is collected, whatever the state word says',()=>{
  assert.deepEqual(listeningPids(NETSTAT,4296).sort(),['4100','4200']);
  assert.deepEqual(listeningPids(NETSTAT,4280),[]);
  assert.equal(listeningPids('  TCP    127.0.0.1:4296         0.0.0.0:0              LISTENING       x',4296),null);
});
test('Windows: the port is ours only when every listener runs as this user',async()=>{
  const calls=[];
  const exec=owners=>async(file,args)=>{calls.push([path.win32.basename(file),...args]);if(/NETSTAT/i.test(file))return args.includes('TCPv6')?'':NETSTAT;const pid=args[1].slice('PID eq '.length);return owners.includes(pid)?`"node.exe","${pid}","Console","1","40,000 K"`:'정보: 지정된 조건에 맞는 작업이 실행되고 있지 않습니다.';};
  assert.equal(await windowsOwned(4296,{exec:exec(['4100','4200']),systemRoot:'C:\\Windows',user:'PC\\dev'}),true);
  assert.ok(calls.some(call=>call.includes('USERNAME eq PC\\dev')),'owner is asked by this user name');
  assert.equal(await windowsOwned(4296,{exec:exec(['4100']),systemRoot:'C:\\Windows',user:'PC\\dev'}),false,'a second listener of another account refuses');
  assert.equal(await windowsOwned(4280,{exec:exec(['4100','4200']),systemRoot:'C:\\Windows',user:'PC\\dev'}),false,'nobody listening refuses');
  assert.equal(await windowsOwned(4296,{exec:async()=>null,systemRoot:'C:\\Windows',user:'PC\\dev'}),false,'a failed tool refuses');
  assert.equal(await windowsOwned(4296,{exec:exec(['4100','4200']),systemRoot:'C:\\Windows',user:''}),false);
  assert.equal(windowsUser({USERNAME:'dev',USERDOMAIN:'PC'}),'PC\\dev');assert.equal(windowsUser({USERNAME:'de"v',USERDOMAIN:'PC'}),'');
});
test('macOS: one of this user\'s processes must hold 127.0.0.1:<port> itself',async()=>{
  let seen;const exec=out=>async(file,args)=>{seen=args;return out;};
  assert.equal(await unixOwned(4296,{exec:exec('p812\n'),uid:501}),true);assert.deepEqual(seen,['-nP','-a','-iTCP@127.0.0.1:4296','-sTCP:LISTEN','-u501','-Fp']);
  assert.equal(await unixOwned(4296,{exec:exec(null),uid:501}),false);assert.equal(await unixOwned(4296,{exec:exec(''),uid:501}),false);assert.equal(await unixOwned(4296,{exec:exec('p812\n'),uid:null}),false);
  assert.equal(await verifyLocalServer(4296,{platform:'sunos'}),false);
});
test('the gate waits for one answer, remembers only a confirmed one briefly and passes other addresses untouched',async()=>{
  let clock=1000,asked=0,answer=true;const gate=createLocalServerGate({entry:'http://127.0.0.1:4296/',now:()=>clock,verify:async port=>{asked++;assert.equal(port,4296);return answer;}});
  assert.equal(gate.required,true);assert.equal(gate.covers('http://127.0.0.1:4296/app.js'),true);assert.equal(gate.covers('ws://127.0.0.1:4296/live'),true);assert.equal(gate.covers('http://127.0.0.1:4297/'),false);assert.equal(gate.covers('https://synk.im/'),false);
  const decided=url=>new Promise(resolve=>gate.decide(url,resolve));
  assert.deepEqual(await Promise.all([decided('http://127.0.0.1:4296/'),decided('http://127.0.0.1:4296/a.js')]),[{cancel:false},{cancel:false}]);assert.equal(asked,1);
  clock+=4000;assert.deepEqual(await decided('http://127.0.0.1:4296/b.js'),{cancel:false});assert.equal(asked,1);
  clock+=2000;answer=false;assert.deepEqual(await decided('http://127.0.0.1:4296/c.js'),{cancel:true});assert.equal(asked,2);
  assert.deepEqual(await decided('http://127.0.0.1:4296/c.js'),{cancel:true});assert.equal(asked,3,'a refusal is asked again');
  assert.deepEqual(await decided('https://synk.im/x'),{});
  const thrown=createLocalServerGate({entry:'http://127.0.0.1:4296/',verify:async()=>{throw Error('boom');}});assert.equal(await thrown.allowed(),false);
  const open=createLocalServerGate({entry:'synk-desktop://platform/index.html',verify:()=>assert.fail('never asked')});assert.equal(open.required,false);assert.equal(await open.allowed(),true);
});
test('this PC: our own listening server is ours, a closed port is not',{skip:!['win32','darwin'].includes(process.platform)},async()=>{
  const server=http.createServer((_q,r)=>r.end()).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const port=server.address().port;try{assert.equal(await verifyLocalServer(port),true);}finally{await new Promise(resolve=>server.close(resolve));}
  assert.equal(await verifyLocalServer(port),false);
});
test('source-run product, teacher and development clients route their fixed port through the gate',()=>{
  assert.match(source('product-main.cjs'),/const localServer=createLocalServerGate\(\{entry:current\.entry\}\);/);
  assert.match(source('product-main.cjs'),/if\(!productResource\(current\.id,details\.url\)\)\{callback\(\{cancel:true\}\);return;\}localServer\.decide\(details\.url,callback\);/);
  assert.match(source('teacher-main.cjs'),/secureTeacherSession\(ownSession,TEACHER\.entry,createLocalServerGate\(\{entry:TEACHER\.entry\}\)\);/);
  assert.match(source('teacher-security.cjs'),/if\(gate\)gate\.decide\(details\.url,callback\);else callback\(\{\}\);/);
  const main=source('main.cjs');assert.match(main,/const localServer=createLocalServerGate\(\{entry:runtime\.entry\}\);/);
  assert.match(main,/else if\(localServer\.required\)ownSession\.webRequest\.onBeforeRequest\(\{urls:\['http:\/\/\*\/\*','ws:\/\/\*\/\*'\]\},\(details,callback\)=>localServer\.decide\(details\.url,callback\)\);/);
});
