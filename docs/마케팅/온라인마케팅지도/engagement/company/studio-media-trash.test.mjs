// 작업실 파일의 늦춘 지우기(studio-media-trash.mjs, 2026-11-27). 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절 「조각 ③」의 「다른 지우기 길」.
// 이 시험의 파일 · 프로젝트 · 인물은 모두 합성이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createCompanyApp} from './server.mjs';
import {workspaceMediaNames} from './workspace-media.mjs';
import {MEDIA_NAME} from './studio-media-cloud.mjs';
import {PEOPLE_MEDIA_KIND} from './pulse-people-media.mjs';
import {MEDIA_TRASH_KIND,MEDIA_TRASH_WRITES,TRASH_NAME,trashMedia,takeTrash,createMediaTrash} from './studio-media-trash.mjs';

const HOUR=3600000,DAY=24*HOUR,AT='2026-11-27T00:00:00.000Z';
const P1='project:'+randomUUID(),P2='project:'+randomUUID(),A1='persona:'+randomUUID(),A2='persona:'+randomUUID();
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-media-trash-'));
  const store=new Store(join(directory,'data'));
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const media=join(store.directory,'studio-media');await mkdir(media,{recursive:true});
  const file=async(extension='png')=>{const name=`${randomUUID()}.${extension}`;await writeFile(join(media,name),'synthetic');return name;};
  const exists=async name=>!!(await stat(join(media,name)).catch(()=>null));
  let now=1000;const steady=()=>now;
  return {store,media,file,exists,steady,advance:ms=>{now+=ms;},trash:(options={})=>createMediaTrash({store,steady,writes:true,...options})};
}
const put=(store,names,{from='progress',owner=P1}={})=>store.transaction(()=>trashMedia(store,names,{from,at:AT,owner}));
const clean={removed:0,missing:0,kept:0,failed:0,skipped:0};

test('적기: 작업실 파일 이름만, 주인(프로젝트 · 인물)이 있어야 적는다. 다시 적으면 주인을 합치고 나이를 처음부터 센다',async t=>{
  const f=await fixture(t),name=await f.file();
  assert.equal(TRASH_NAME.source,MEDIA_NAME.source,'이름 규칙이 버킷 모듈과 같다');
  for(const owner of [undefined,'','p1','someone:x','project:','project:../x'])assert.throws(()=>f.store.transaction(()=>trashMedia(f.store,[name],{from:'progress',at:AT,owner})),/주인/,String(owner));
  put(f.store,[name,name,'../escape.png','not-a-name.png',42,null]);
  assert.deepEqual(f.store.all(MEDIA_TRASH_KIND).map(item=>item.diskName),[name],'규칙 밖 이름과 겹친 이름은 적지 않는다');
  assert.deepEqual(f.store.get(MEDIA_TRASH_KIND,name),{id:name,diskName:name,from:'progress',at:AT,owners:[P1],agedMs:0,counting:false});
  // 같은 파일을 가리키던 인물 판이 나중에 떨어졌다(GPT GB2 · GB4): 나이는 처음부터, 주인은 둘 다.
  f.store.put(MEDIA_TRASH_KIND,name,{...f.store.get(MEDIA_TRASH_KIND,name),counting:true,agedMs:5*HOUR});
  put(f.store,[name],{from:'persona-asset',owner:A1});
  assert.deepEqual(f.store.get(MEDIA_TRASH_KIND,name),{id:name,diskName:name,from:'persona-asset',at:AT,owners:[P1,A1],agedMs:0,counting:false});
  // 되돌려진 트랜잭션 안에서 적은 이름은 남지 않는다(이름을 떼는 쪽과 함께 되돌려진다).
  const other=await f.file();
  assert.throws(()=>f.store.transaction(()=>{trashMedia(f.store,[other],{from:'request-file',at:AT,owner:P2});throw new Error('되돌림');}),/되돌림/);
  assert.equal(f.store.get(MEDIA_TRASH_KIND,other),null);
  // 적힌 이름은 백업 목록이 세지 않는다.
  assert.equal(workspaceMediaNames(f.store.db).includes(name),false);
});

test('쓰기 스위치: 이 판은 꺼져 있어 defer가 이름을 그대로 돌려준다(바탕처럼 바로 지움). 켜면 적고 작업실 파일이 아닌 이름만 돌려준다',async t=>{
  const f=await fixture(t),a=await f.file(),b=await f.file('jpg');
  assert.equal(MEDIA_TRASH_WRITES,false,'두 판으로 연다 — 이 판은 쓰지 않는다(Fable 설계 검토 11-27 ①)');
  const off=createMediaTrash({store:f.store,steady:f.steady});
  assert.equal(off.writes,false);
  assert.deepEqual(f.store.transaction(()=>off.defer([a,b],{from:'progress',at:AT,owner:P1})),[a,b]);
  assert.equal(f.store.all(MEDIA_TRASH_KIND).length,0,'꺼져 있으면 적지 않는다');
  const on=f.trash();assert.equal(on.writes,true);
  assert.deepEqual(f.store.transaction(()=>on.defer([a,'legacy-name.bin',b],{from:'message-photo',at:AT,owner:P2})),['legacy-name.bin']);
  assert.deepEqual(f.store.all(MEDIA_TRASH_KIND).map(item=>[item.diskName,item.owners]),[[a,[P2]],[b,[P2]]]);
  assert.throws(()=>f.store.transaction(()=>on.defer([a],{from:'progress',at:AT,owner:'nobody'})),/주인/,'켜져 있으면 주인이 있어야 한다');
  // 꺼진 판도 지울 목록은 읽는다: 켜진 판이 적은 이름을 정리하고(나이 · 지우기), 되돌린 판에서도 파일이 남지 않는다.
  await off.sweep();f.advance(DAY);
  assert.deepEqual(await off.sweep(),{...clean,removed:2});
  assert.equal(await f.exists(a),false);assert.equal(await f.exists(b),false);
});

test('나이: 적힌 뒤 처음 도는 정리부터 서버 가동 시간으로 하루를 센다 — 그 전 시간은 세지 않고, 하루가 차야 파일을 지우고 문서를 뗀다',async t=>{
  const f=await fixture(t),trash=f.trash(),name=await f.file();
  // 서버가 사흘 동안 정리 없이 떠 있다가 이름을 뗐다. 그 사흘을 방금 적힌 이름에 더하지 않는다.
  f.advance(3*DAY);put(f.store,[name]);
  assert.deepEqual(await trash.sweep(),clean);
  assert.equal(f.store.get(MEDIA_TRASH_KIND,name).counting,true);assert.equal(f.store.get(MEDIA_TRASH_KIND,name).agedMs,0);
  assert.ok(await f.exists(name),'적힌 직후에는 지우지 않는다');
  f.advance(DAY-60000);await trash.sweep();
  assert.ok(await f.exists(name),'하루가 차기 전에는 지우지 않는다');assert.equal(f.store.get(MEDIA_TRASH_KIND,name).agedMs,DAY-60000);
  f.advance(60000);
  assert.deepEqual(await trash.sweep(),{...clean,removed:1});
  assert.equal(await f.exists(name),false);assert.equal(f.store.get(MEDIA_TRASH_KIND,name),null,'지운 뒤 문서를 뗀다');
  assert.equal(trash.pending(),0);
});

test('다시 띄움: 정상 종료 때 남긴 가동 시간과 새 프로세스의 가동 시간을 더한다. 꺼져 있던 시간은 세지 않는다(감사 기록 다시 검수 GA2)',async t=>{
  const f=await fixture(t),name=await f.file();
  const first=f.trash();put(f.store,[name]);await first.sweep();
  f.advance(6*HOUR);await first.sweep();
  f.advance(5*HOUR);first.account();
  assert.equal(f.store.get(MEDIA_TRASH_KIND,name).agedMs,11*HOUR,'종료 직전 정리 뒤 5시간도 남긴다');
  assert.ok(await f.exists(name),'종료 때는 지우지 않는다');
  // 꺼져 있던 이틀은 단조 시계가 다시 시작하므로 세지 않는다(새 프로세스는 자기가 뜬 때부터 센다).
  f.advance(2*DAY);const second=f.trash();
  f.advance(12*HOUR);await second.sweep();
  assert.ok(await f.exists(name),'11시간 + 12시간이면 아직이다');
  f.advance(HOUR);assert.equal((await second.sweep()).removed,1,'더해서 하루가 차면 지운다');
  assert.equal(await f.exists(name),false);
});

test('정리: 이미 없는 파일은 문서만 떼고(복원한 데이터 폴더), 다른 문서가 다시 가리키면 파일과 문서를 두고 나이를 처음부터 센다. 지우지 못하면 다음 정리가 다시 지운다',async t=>{
  const f=await fixture(t);
  const missing=`${randomUUID()}.jpg`,shared=await f.file(),stuck=`${randomUUID()}.png`;
  await mkdir(join(f.media,stuck));
  const used=new Set([shared]),trash=f.trash({owned:()=>used});
  put(f.store,[missing,shared,stuck]);await trash.sweep();f.advance(DAY);
  assert.deepEqual(await trash.sweep(),{...clean,missing:1,kept:1,failed:1});
  assert.ok(await f.exists(shared),'다른 문서가 가리키는 파일은 지우지 않는다');
  assert.equal(f.store.get(MEDIA_TRASH_KIND,missing),null,'이미 없던 이름은 문서를 뗀다');assert.equal(f.store.get(MEDIA_TRASH_KIND,stuck).agedMs,DAY,'지우지 못한 이름은 그대로 남는다');
  assert.deepEqual(f.store.get(MEDIA_TRASH_KIND,shared),{id:shared,diskName:shared,from:'progress',at:AT,owners:[P1],agedMs:0,counting:false},'다른 문서가 가리키는 이름은 주인 기록과 함께 남고 나이를 처음부터 센다(GPT -a2 GA2)');
  await rm(join(f.media,stuck),{recursive:true});await writeFile(join(f.media,stuck),'synthetic');
  assert.equal((await trash.sweep()).removed,1,'다음 정리가 다시 지운다');
  assert.equal(await f.exists(stuck),false);assert.deepEqual(f.store.all(MEDIA_TRASH_KIND).map(item=>item.diskName),[shared]);f.store.remove(MEDIA_TRASH_KIND,shared);
  // 문서가 가리키는 이름을 못 읽으면(꼴이 틀린 문서) 아무것도 지우지 않는다.
  const later=await f.file(),broken=f.trash({owned:()=>{throw new Error('목록을 읽지 못함');}});
  put(f.store,[later]);await broken.sweep();f.advance(DAY);
  assert.deepEqual(await broken.sweep(),{...clean,failed:1});
  assert.ok(await f.exists(later));assert.ok(f.store.get(MEDIA_TRASH_KIND,later));
  // 꼴이 틀린 문서(이름과 id가 다름, 규칙 밖 이름)는 보지 않는다.
  f.store.put(MEDIA_TRASH_KIND,'odd',{id:'odd',diskName:later,agedMs:DAY,counting:true});
  f.store.put(MEDIA_TRASH_KIND,'../x.png',{id:'../x.png',diskName:'../x.png',agedMs:DAY,counting:true});
  const plain=f.trash({owned:()=>new Set()});f.advance(1);
  assert.deepEqual(await plain.sweep(),{...clean,removed:1},'규칙에 맞는 later 하나만 지운다');
});

test('겹침: 마지막 참조를 뗀 때부터 다시 하루를 센다(GPT GB2). 고른 뒤 다시 적힌 이름은 파일도 문서도 건드리지 않는다(GPT GB3)',async t=>{
  const f=await fixture(t),shared=await f.file();
  // GB2: 첫 참조를 뗀 뒤 23시간 동안 나이가 쌓였다. 그사이 잡힌 백업은 둘째 문서 덕에 이 파일을 목록에 올린다. 마지막 참조를 떼면 나이를 처음부터 센다.
  const used=new Set([shared]),trash=f.trash({owned:()=>used});
  put(f.store,[shared]);await trash.sweep();f.advance(23*HOUR);await trash.sweep();
  assert.equal(f.store.get(MEDIA_TRASH_KIND,shared).agedMs,23*HOUR);
  used.delete(shared);put(f.store,[shared],{from:'request-file',owner:P2});
  f.advance(HOUR);assert.equal((await trash.sweep()).removed,0,'마지막 참조를 뗀 직후에는 지우지 않는다');
  f.advance(DAY-1);assert.equal((await trash.sweep()).removed,0);
  f.advance(1);assert.equal((await trash.sweep()).removed,1,'마지막 참조를 뗀 뒤 하루가 차야 지운다');
  // GB3: 하루가 찬 두 파일 가운데 첫 파일을 지우는 사이 둘째 이름이 다시 적혔다 — 둘째 파일은 지우지 않고 새 문서를 남긴다.
  const a=await f.file();put(f.store,[a]);const b=await f.file();put(f.store,[b]);
  let raced=false;
  const racing=f.trash({owned:()=>{if(!raced){raced=true;queueMicrotask(()=>put(f.store,[b],{from:'message-photo',owner:P2}));}return new Set();}});
  await racing.sweep();f.advance(DAY);raced=false;
  assert.deepEqual(await racing.sweep(),{...clean,removed:1,skipped:1});
  assert.equal(await f.exists(a),false);assert.ok(await f.exists(b),'다시 적힌 파일은 그대로');
  assert.deepEqual(f.store.get(MEDIA_TRASH_KIND,b),{id:b,diskName:b,from:'message-photo',at:AT,owners:[P1,P2],agedMs:0,counting:false},'다시 적힌 문서는 지울 목록에 남는다');
  // 「다른 문서가 가리켜 둠」으로 판정한 뒤, 뒤 파일을 지우는 사이 다시 적힌 이름은 문서를 떼지 않는다.
  f.store.remove(MEDIA_TRASH_KIND,b);
  const c=await f.file();put(f.store,[c]);const x=await f.file();put(f.store,[x]);
  let again=false;
  const keeping=f.trash({owned:()=>{if(!again){again=true;queueMicrotask(()=>put(f.store,[c],{from:'request-file',owner:P2}));}return new Set([c]);}});
  await keeping.sweep();f.advance(DAY);again=false;
  assert.deepEqual(await keeping.sweep(),{...clean,removed:1,kept:1});
  assert.equal(await f.exists(x),false);assert.ok(await f.exists(c));
  assert.equal(f.store.get(MEDIA_TRASH_KIND,c)?.agedMs,0,'다시 적힌 문서는 남는다');
  const later=f.trash({owned:()=>new Set()});await later.sweep();f.advance(DAY);
  assert.equal((await later.sweep()).removed,1,'하루 뒤 그 파일도 지운다');assert.equal(await f.exists(c),false);
});

test('주인 몫 가져가기: 그 주인이 든 이름만 떼어 돌려준다(주인이 둘인 이름 포함). 정리가 지우던 중에 가져가면 정리는 그 파일을 건너뛴다(GPT GB6)',async t=>{
  const f=await fixture(t),mine=await f.file(),others=await f.file(),both=await f.file(),plain=await f.file();
  f.store.transaction(()=>{trashMedia(f.store,[mine],{from:'persona-asset',at:AT,owner:A1});trashMedia(f.store,[others],{from:'persona-asset',at:AT,owner:A2});
    trashMedia(f.store,[both],{from:'persona-asset',at:AT,owner:A1});trashMedia(f.store,[both],{from:'request-file',at:AT,owner:P1});});
  assert.deepEqual(f.store.transaction(()=>takeTrash(f.store,A1)).sort(),[mine,both].sort(),'뒤에 다른 길에서 다시 적혀도 인물 몫이 남는다(GPT GB4)');
  assert.deepEqual(f.store.all(MEDIA_TRASH_KIND).map(item=>[item.diskName,item.owners]),[[others,[A2]],[both,[P1]]],'다른 주인이 남은 이름은 그 주인만 빼고 남긴다(GPT -a GA2)');
  assert.deepEqual(f.store.transaction(()=>takeTrash(f.store,A1)),[],'두 번 가져가지 않는다');
  // -a GA2: 두 의뢰(P1 · P2)가 같은 파일을 거뒀고 다른 문서가 아직 가리켜 P1 정리는 파일을 두었다. P2를 정리할 때도 그 이름을 받아 간다.
  f.store.transaction(()=>trashMedia(f.store,[both],{from:'progress',at:AT,owner:P2}));
  assert.deepEqual(f.store.transaction(()=>takeTrash(f.store,P1)),[both]);assert.deepEqual(f.store.get(MEDIA_TRASH_KIND,both).owners,[P2]);
  // 하루가 찬 뒤에도 다른 문서가 아직 가리켜 정리가 파일을 남기면, 남은 주인(P2)의 기록도 남는다(GPT -a2 GA2).
  const holding=f.trash({owned:()=>new Set([both,others])});await holding.sweep();f.advance(DAY);
  assert.equal((await holding.sweep()).kept,2);assert.deepEqual(f.store.get(MEDIA_TRASH_KIND,both).owners,[P2]);assert.ok(await f.exists(both));
  assert.deepEqual(f.store.transaction(()=>takeTrash(f.store,P2)),[both],'남은 주인도 자기 몫을 받는다');assert.equal(f.store.get(MEDIA_TRASH_KIND,both),null,'마지막 주인이 가져가면 문서를 뗀다');
  // 정리가 앞 파일(plain)을 지우는 사이 인물 A2를 지웠다: 인물 지우기가 이름을 받아 가고, 정리는 그 파일 · 문서에 손대지 않는다.
  put(f.store,[plain]);f.store.remove(MEDIA_TRASH_KIND,others);put(f.store,[others],{from:'persona-asset',owner:A2});
  let taken=null;const trash=f.trash({owned:()=>{if(taken===null){taken=[];queueMicrotask(()=>{taken=f.store.transaction(()=>takeTrash(f.store,A2));});}return new Set();}});
  await trash.sweep();taken=null;f.advance(DAY);
  assert.deepEqual(await trash.sweep(),{...clean,removed:1,skipped:1});
  assert.deepEqual(taken,[others],'인물 지우기가 그 이름을 넘겨받는다');
  assert.equal(await f.exists(plain),false);assert.ok(await f.exists(others),'파일은 인물 지우기가 지운다');
  assert.equal(f.store.all(MEDIA_TRASH_KIND).length,0);
});

test('기본 목록: 프로젝트 자산이 다시 가리키는 이름은 지우지 않는다(workspaceMediaNames)',async t=>{
  const f=await fixture(t),name=await f.file(),trash=f.trash();
  put(f.store,[name]);await trash.sweep();f.advance(DAY);
  f.store.put('clientProjects','p1',{id:'p1',versions:[],studio:{assets:[{id:randomUUID(),diskName:name}]}});
  assert.deepEqual(await trash.sweep(),{...clean,kept:1});
  assert.ok(await f.exists(name));assert.equal(f.store.get(MEDIA_TRASH_KIND,name).counting,false,'문서는 남아 나이를 처음부터 센다');
  // 프로젝트 자산이 그 이름을 놓으면 하루 뒤에 지운다.
  f.store.remove('clientProjects','p1');await trash.sweep();f.advance(DAY);
  assert.deepEqual(await trash.sweep(),{...clean,removed:1});assert.equal(await f.exists(name),false);
});

test('나이를 쌓은 시각은 거래가 커밋된 뒤에만 옮긴다 — 되돌려진 나이를 센 것으로 치지 않는다',async t=>{
  const f=await fixture(t),name=await f.file();
  let fail=false;const store=new Proxy(f.store,{get(target,key){if(key==='transaction')return fn=>target.transaction(()=>{const out=fn();if(fail)throw new Error('커밋 실패');return out;});const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  const trash=createMediaTrash({store,directory:f.store.directory,steady:f.steady});
  put(f.store,[name]);await trash.sweep();
  f.advance(20*HOUR);fail=true;await assert.rejects(trash.sweep(),/커밋 실패/);fail=false;
  assert.equal(f.store.get(MEDIA_TRASH_KIND,name).agedMs,0,'되돌려진 나이는 남지 않는다');
  f.advance(4*HOUR);assert.equal((await trash.sweep()).removed,1,'다음 정리가 되돌려진 20시간을 다시 센다');
});

test('회사 서버: 쓰기는 꺼진 채 뜨고, 6시간 정리가 늦춘 지우기를 돌려 실패를 로그에 남기며, 정상 종료가 마지막 가동 시간을 남긴다',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-media-trash-server-'));
  let app=null,stopped=false;
  // 단언이 중간에 깨져도 서버를 멈춘 뒤 폴더를 지운다(GPT GB6).
  t.after(async()=>{if(app&&!stopped)await app.stop().catch(()=>{});assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  app=createCompanyApp(options);await app.start();
  assert.equal(app.mediaTrash.writes,false,'운영 판은 쓰지 않는다');
  const media=join(options.dataDir,'studio-media');await mkdir(media,{recursive:true});
  const due=`${randomUUID()}.png`,young=`${randomUUID()}.png`,stuck=`${randomUUID()}.png`,people=randomUUID();
  await writeFile(join(media,due),'synthetic');await writeFile(join(media,young),'synthetic');await mkdir(join(media,stuck));
  app.store.put(MEDIA_TRASH_KIND,due,{id:due,diskName:due,from:'progress',at:AT,owners:[P1],agedMs:DAY,counting:true});
  app.store.put(MEDIA_TRASH_KIND,young,{id:young,diskName:young,from:'message-photo',at:AT,owners:[P1],agedMs:0,counting:true});
  app.store.put(MEDIA_TRASH_KIND,stuck,{id:stuck,diskName:stuck,from:'request-file',at:AT,owners:[P2],agedMs:DAY,counting:true});
  app.store.put(PEOPLE_MEDIA_KIND,people,{id:people,diskName:people+'.png',mimeType:'image/png',byteSize:1,at:'2026-11-20T00:00:00.000Z',gone:true,goneAt:'2026-11-21T00:00:00.000Z',agedMs:0});
  const logged=[];t.mock.method(console,'error',(...args)=>{logged.push(args.join(' '));});
  await app.sweepPulseMessageUploads();
  t.mock.restoreAll();
  assert.equal(!!(await stat(join(media,due)).catch(()=>null)),false,'하루가 찬 파일은 6시간 정리에서 지운다');
  assert.ok(await stat(join(media,young)),'하루가 차지 않은 파일은 남는다');
  assert.deepEqual(logged.filter(line=>line.startsWith('SYNK_COMPANY_MEDIA_TRASH_FAILED')),['SYNK_COMPANY_MEDIA_TRASH_FAILED failed=1'],'지우지 못한 파일은 로그에 남긴다(GPT GB5)');
  // 문의 사진 정리가 실패해도 늦춘 지우기는 돈다(GPT -a GB2).
  const after=`${randomUUID()}.png`;await writeFile(join(media,after),'synthetic');
  app.store.put(MEDIA_TRASH_KIND,after,{id:after,diskName:after,from:'progress',at:AT,owners:[P1],agedMs:DAY,counting:true});
  const all=app.store.all.bind(app.store);t.mock.method(app.store,'all',kind=>{if(kind==='clientProjects')throw new Error('합성 실패');return all(kind);});
  await app.sweepPulseMessageUploads();t.mock.restoreAll();
  assert.equal(!!(await stat(join(media,after)).catch(()=>null)),false,'문의 사진 정리가 던져도 하루가 찬 파일을 지운다');
  // 종료 때는 하루가 찬 파일도 지우지 않는다 — 나이만 남긴다(GPT -a GB3).
  const held=`${randomUUID()}.png`;await writeFile(join(media,held),'synthetic');
  app.store.put(MEDIA_TRASH_KIND,held,{id:held,diskName:held,from:'request-file',at:AT,owners:[P2],agedMs:DAY,counting:true});
  const aged=app.store.get(MEDIA_TRASH_KIND,young).agedMs,peopleAged=app.store.get(PEOPLE_MEDIA_KIND,people).agedMs;
  await new Promise(resolve=>setTimeout(resolve,20));
  stopped=true;await app.stop();
  const reopened=new Store(options.dataDir);
  try{
    assert.ok(reopened.get(MEDIA_TRASH_KIND,young).agedMs>aged,'종료 직전 정리 뒤 흐른 시간도 늦춘 지우기의 나이에 남긴다');
    assert.ok(reopened.get(PEOPLE_MEDIA_KIND,people).agedMs>peopleAged,'명단 그림의 나이에도 남긴다');
    assert.ok(await stat(join(media,young)),'종료 때는 지우지 않는다');
    assert.ok(await stat(join(media,held)),'하루가 찬 파일도 종료 때는 두고');assert.ok(reopened.get(MEDIA_TRASH_KIND,held),'다음 프로세스의 정리에 맡긴다');
  }finally{reopened.close();}
  // 이 정리는 6시간 예약(retirePulseRequests → sweepPulseMessageUploads)과 종료 순서에 실려 있다(시험 서버는 예약을 끄므로 코드 자리를 본다).
  const server=await readFile(new URL('./server.mjs',import.meta.url),'utf8');
  assert.match(server,/const sweepPulseMessageUploads=\(\)=>pulseSweeping\|\|\(pulseSweeping=\(async\(\)=>\{await sweepPeopleMedia\(\);[^\n]*await sweepMediaTrash\(\);\}\)\(\)\.finally\(/);
  assert.match(server,/const retirePulseRequests=\(\)=>pulseRequests\.retireUnconfirmed\(\)\.catch\(\(\)=>\{\}\)\.then\(sweepPulseMessageUploads\);/,'6시간 예약이 이 정리를 부른다(GPT GB5)');
  assert.match(server,/pulseRequestTimer=setInterval\(retirePulseRequests,6\*3600000\)/);
  assert.match(server,/await pulseSweeping\?\.catch\(\(\)=>\{\}\);\r?\n\s*try\{pulsePeople\.sweep\(\);\}catch\{\}try\{mediaTrash\.account\(\);\}catch\{\}\r?\n\s*try\{await messenger\.close\(\);\}finally\{[^}]*store\.close\(\);\}/);
});

// 도는 정리 회차가 끝난 뒤 저장소를 닫는다 — 지운 파일의 문서가 닫힌 저장소 때문에 남지 않는다(GPT pulse-media-trash-20261127-a GA3).
test('회사 서버: 정상 종료는 도는 6시간 정리 회차가 끝나기를 기다린다',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-media-trash-stop-'));
  let app=null,stopped=false;
  t.after(async()=>{if(app&&!stopped)await app.stop().catch(()=>{});assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  app=createCompanyApp(options);await app.start();
  const media=join(options.dataDir,'studio-media');await mkdir(media,{recursive:true});
  const names=Array.from({length:300},()=>`${randomUUID()}.png`);
  for(const name of names){await writeFile(join(media,name),'synthetic');app.store.put(MEDIA_TRASH_KIND,name,{id:name,diskName:name,from:'progress',at:AT,owners:[P1],agedMs:DAY,counting:true});}
  const running=app.sweepPulseMessageUploads();assert.equal(app.sweepPulseMessageUploads(),running,'도는 회차는 하나다');
  let settled=false;running.then(()=>{settled=true;},()=>{settled=true;});
  stopped=true;await app.stop();assert.equal(settled,true,'stop()이 돌아올 때 회차는 이미 끝났다(GPT -a2 GA1)');
  const reopened=new Store(options.dataDir);
  try{assert.equal(reopened.all(MEDIA_TRASH_KIND).length,0,'회차가 지운 파일의 문서를 모두 뗐다');}finally{reopened.close();}
  for(const name of names)assert.equal(!!(await stat(join(media,name)).catch(()=>null)),false,name);
});
