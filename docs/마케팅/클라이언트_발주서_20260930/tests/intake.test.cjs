'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../src/intake.js'),'utf8');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const receipt=(overrides={})=>({ok:true,status:'received',submissionId:'submission-1',fileCount:0,receivedAt:'2026-10-01T00:01:00.000Z',...overrides});
const begun=(overrides={})=>({ok:true,status:'uploading',submissionId:'submission-1',uploadToken:'test-upload-token',uploaded:[],...overrides});
const payload=(overrides={})=>({schema:'synk-video-brief',version:1,createdAt:'2026-10-01T00:00:00.000Z',data:{subject:'접수 단위시험',goal:'purchase'},...overrides});
function fixtureFile(name='제품.png',bytes='image',category='product',type='image/png'){
  const buffer=Buffer.from(bytes);
  return {name,size:buffer.length,category,file:{name,type,bytes:buffer,async arrayBuffer(){return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);}}};
}
function setup({route,online=true,invite='test-invite',storage=new Map(),uuidPrefix='request',storageFails=false}={}){
  const calls=[],reads=[],timers=new Map();
  let sequence=0,timerSequence=0;
  function invoke(name,value,success,failure){
    calls.push({name,value:clone(value)});
    queueMicrotask(async()=>{
      try{success(await route(name,clone(value),calls.length));}
      catch(error){failure(error);}
    });
  }
  function runner(success=()=>{},failure=()=>{}){
    return {
      withSuccessHandler(handler){return runner(handler,failure);},
      withFailureHandler(handler){return runner(success,handler);},
      beginIntake(value){invoke('beginIntake',value,success,failure);},
      uploadIntakeFile(value){invoke('uploadIntakeFile',value,success,failure);},
      finishIntake(value){invoke('finishIntake',value,success,failure);},
      getIntakeConfig(value){invoke('getIntakeConfig',value,success,failure);}
    };
  }
  class FakeFileReader{
    readAsDataURL(file){
      reads.push(file.name);
      queueMicrotask(()=>{
        if(file.failRead){this.onerror();return;}
        this.result='data:'+file.type+';base64,'+file.bytes.toString('base64');
        this.onload();
      });
    }
  }
  const context=vm.createContext({
    SYNK_INTAKE:{invite},
    google:online?{script:{run:runner()}}:undefined,
    FileReader:FakeFileReader,
    sessionStorage:{
      getItem(key){if(storageFails)throw Error('storage unavailable');return storage.get(key)||null;},
      setItem(key,value){if(storageFails)throw Error('storage unavailable');storage.set(key,value);}
    },
    crypto:{subtle:webcrypto.subtle,randomUUID(){return uuidPrefix+'-'+(++sequence);}},
    setTimeout(callback){const id=++timerSequence;timers.set(id,callback);return id;},
    clearTimeout(id){timers.delete(id);}
  });
  vm.runInContext(source,context,{filename:'intake.js'});
  return {api:context.SynkBriefIntake,calls,reads,storage,timers,context,expire(){for(const [id,fn] of timers){timers.delete(id);fn();}}};
}
function successRoute(){
  let fileCount=0;
  return (name,value)=>{
    if(name==='beginIntake'){fileCount=value.manifest.length;return begun();}
    if(name==='uploadIntakeFile')return {ok:true,index:value.index,size:Buffer.from(value.base64,'base64').length};
    if(name==='finishIntake')return receipt({fileCount});
    throw Error('Unexpected test RPC: '+name);
  };
}

test('offline or missing invite stays unavailable and cannot call a submission RPC',async()=>{
  for(const opts of [{online:false},{invite:''}]){
    const env=setup({...opts,route:()=>{throw Error('must not be called');}});
    assert.equal(env.api.available(),false);
    assert.deepEqual(clone(await env.api.config()),{enabled:false});
    await assert.rejects(env.api.send(payload(),[]),/자동 접수 주소가 아직 연결되지/);
    assert.equal(env.calls.length,0);
  }
});

test('online config passes the invite to the configured RPC',async()=>{
  const env=setup({route:(name,value)=>{assert.equal(name,'getIntakeConfig');assert.equal(value,'test-invite');return {enabled:true,maxFiles:30};}});
  assert.equal(env.api.available(),true);
  assert.deepEqual(await env.api.config(),{enabled:true,maxFiles:30});
  assert.equal(env.timers.size,0);
});

test('submission begins, uploads original bytes in order, and finishes before success',async()=>{
  const files=[fixtureFile(),fixtureFile('자료.txt','sample original','reference','text/plain')],progress=[];
  const env=setup({route:successRoute()});
  const result=await env.api.send(payload(),files,item=>progress.push(clone(item)));
  assert.deepEqual(env.calls.map(call=>call.name),['beginIntake','uploadIntakeFile','uploadIntakeFile','finishIntake']);
  assert.deepEqual(env.calls[0].value.manifest,files.map(f=>({name:f.name,size:f.size,category:f.category,type:f.file.type,sha256:createHash('sha256').update(f.file.bytes).digest('hex')})));
  assert.equal(env.calls[0].value.consent,true);
  assert.equal(env.calls[0].value.invite,'test-invite');
  for(let index=0;index<files.length;index++){
    const request=env.calls[index+1].value;
    assert.equal(request.index,index);
    assert.equal(request.submissionId,'submission-1');
    assert.equal(request.uploadToken,'test-upload-token');
    assert.deepEqual(Buffer.from(request.base64,'base64'),files[index].file.bytes);
  }
  assert.deepEqual(env.calls[3].value,{submissionId:'submission-1',uploadToken:'test-upload-token'});
  assert.deepEqual(progress.map(p=>p.phase),['hash','begin','file','file','finish']);
  assert.equal(result.status,'received');
  assert.equal(env.timers.size,0);
});

test('zero-file brief still waits for finish acknowledgement',async()=>{
  const env=setup({route:successRoute()});
  assert.equal((await env.api.send(payload(),[])).fileCount,0);
  assert.deepEqual(env.calls.map(c=>c.name),['beginIntake','finishIntake']);
  assert.equal(env.reads.length,0);
});

for(const mismatch of [{index:9,size:5},{index:0,size:6}]){
  test('wrong upload acknowledgement is rejected: '+JSON.stringify(mismatch),async()=>{
    const normal=successRoute();
    const env=setup({route:(name,value)=>name==='uploadIntakeFile'?mismatch:normal(name,value)});
    await assert.rejects(env.api.send(payload(),[fixtureFile()]),/파일 확인이 끝나지/);
    assert(!env.calls.some(call=>call.name==='finishIntake'));
  });
}

for(const acknowledgement of [null,{ok:false,status:'received',submissionId:'submission-1'},{ok:true,status:'uploading',submissionId:'submission-1'},{ok:true,status:'received'}]){
  test('finish refuses incomplete receipt '+JSON.stringify(acknowledgement),async()=>{
    const normal=successRoute();
    const env=setup({route:(name,value)=>name==='finishIntake'?acknowledgement:normal(name,value)});
    await assert.rejects(env.api.send(payload(),[]),/접수 완료를 확인하지 못했어요/);
  });
}

test('retry resumes same request, skips confirmed uploads and ignores changing createdAt',async()=>{
  const files=[fixtureFile(),fixtureFile('두번째.png','second')];
  let begins=0,failed=false;
  const normal=successRoute();
  const env=setup({route:(name,value)=>{
    if(name==='beginIntake'){normal(name,value);return begun({uploaded:++begins===1?[]:[0]});}
    if(name==='uploadIntakeFile'&&value.index===1&&!failed){failed=true;throw Error('temporary failure');}
    return normal(name,value);
  }});
  const initial=payload();
  await assert.rejects(env.api.send(initial,files),/temporary failure/);
  const retryPayload=payload({createdAt:'2026-10-01T00:15:00.000Z'});
  assert.equal((await env.api.send(retryPayload,files)).status,'received');
  const requests=env.calls.filter(c=>c.name==='beginIntake');
  assert.equal(requests[0].value.requestId,requests[1].value.requestId);
  assert.deepEqual(requests[0].value.payload,requests[1].value.payload);
  assert.equal(requests[1].value.payload.createdAt,initial.createdAt);
  assert.deepEqual(env.calls.filter(c=>c.name==='uploadIntakeFile').map(c=>c.value.index),[0,1,1]);
  assert.deepEqual(env.reads,['제품.png','두번째.png','두번째.png']);
});

test('session storage preserves request identity across client reload',async()=>{
  const store=new Map();
  const first=setup({storage:store,uuidPrefix:'first',route:()=>{throw Error('connection interrupted');}});
  await assert.rejects(first.api.send(payload(),[]),/connection interrupted/);
  const second=setup({storage:store,uuidPrefix:'second',route:successRoute()});
  await second.api.send(payload({createdAt:'2026-10-01T02:00:00.000Z'}),[]);
  assert.equal(first.calls[0].value.requestId,second.calls[0].value.requestId);
});

test('changed answers or file manifest receive a new request identity',async()=>{
  const env=setup({route:successRoute()});
  await env.api.send(payload(),[]);
  await env.api.send(payload({data:{subject:'변경한 브랜드',goal:'purchase'}}),[]);
  await env.api.send(payload({data:{subject:'변경한 브랜드',goal:'purchase'}}),[fixtureFile()]);
  const ids=env.calls.filter(c=>c.name==='beginIntake').map(c=>c.value.requestId);
  assert.equal(new Set(ids).size,3);
});

test('confirmed received begin response short-circuits repeated uploads and finish',async()=>{
  const env=setup({route:name=>{assert.equal(name,'beginIntake');return receipt({fileCount:1});}});
  const result=await env.api.send(payload(),[fixtureFile()]);
  assert.equal(result.submissionId,'submission-1');
  assert.deepEqual(env.calls.map(c=>c.name),['beginIntake']);
  assert.equal(env.reads.length,0);
});

test('received begin response must have the same acknowledgement requirements as finish',async()=>{
  for(const result of [{status:'received'},{ok:false,status:'received',submissionId:'submission-1'}]){
    const env=setup({route:()=>result});
    await assert.rejects(env.api.send(payload(),[]),/접수 완료를 확인하지 못했어요/);
    assert.deepEqual(env.calls.map(c=>c.name),['beginIntake']);
  }
});

test('unreadable original rejects before upload and finish',async()=>{
  const file=fixtureFile();file.file.failRead=true;
  const env=setup({route:successRoute()});
  await assert.rejects(env.api.send(payload(),[file]),/제품.png 파일을 읽지 못했어요/);
  assert.deepEqual(env.calls.map(c=>c.name),['beginIntake']);
});

test('session-storage denial still allows same-tab retry',async()=>{
  let fail=true;
  const normal=successRoute();
  const env=setup({storageFails:true,route:(name,value)=>{
    if(name==='beginIntake'&&fail){fail=false;throw Error('retry required');}
    return normal(name,value);
  }});
  await assert.rejects(env.api.send(payload(),[]),/retry required/);
  await env.api.send(payload(),[]);
  assert.equal(env.calls[0].value.requestId,env.calls[1].value.requestId);
});

test('timed-out RPC rejects instead of reporting receipt',async()=>{
  const env=setup({route:()=>new Promise(()=>{})});
  const result=env.api.send(payload(),[]);
  env.expire();
  await assert.rejects(result,/응답이 늦어지고 있어요/);
  assert.deepEqual(env.calls.map(c=>c.name),['beginIntake']);
});

test('receipt rejects the wrong file count or missing timestamp at both acknowledgement points',async()=>{
  for(const changes of [{fileCount:1},{receivedAt:''},{receivedAt:'not-a-date'}]){
    for(const phase of ['beginIntake','finishIntake']){
      const normal=successRoute();
      const env=setup({route:(name,value)=>name===phase?receipt(changes):normal(name,value)});
      await assert.rejects(env.api.send(payload(),[]),/접수 완료를 확인하지 못했어요/);
    }
  }
});

test('invalid begin upload instructions cannot advance to reading or uploading files',async()=>{
  for(const changes of [{submissionId:''},{uploadToken:''},{uploaded:null},{uploaded:[-1]},{uploaded:[1]},{uploaded:['0']}]){
    const env=setup({route:()=>begun(changes)});
    await assert.rejects(env.api.send(payload(),[fixtureFile()]),/자료 전송 준비를 확인하지 못했어요/);
    assert.deepEqual(env.calls.map(c=>c.name),['beginIntake']);
    assert.equal(env.reads.length,0);
  }
});

test('same name and byte count with changed original content creates a new request and hash',async()=>{
  const before=fixtureFile('제품.png','image'),after=fixtureFile('제품.png','other');
  assert.equal(before.name,after.name);
  assert.equal(before.size,after.size);
  const received=new Map(),normal=successRoute();
  let activeRequest='';
  const env=setup({route:(name,value)=>{
    if(name==='beginIntake'){
      if(received.has(value.requestId))return received.get(value.requestId);
      activeRequest=value.requestId;
    }
    const result=normal(name,value);
    if(name==='finishIntake')received.set(activeRequest,result);
    return result;
  }});
  await env.api.send(payload(),[before]);
  await env.api.send(payload({createdAt:'2026-10-01T00:30:00.000Z'}),[after]);
  const starts=env.calls.filter(call=>call.name==='beginIntake');
  assert.notEqual(starts[0].value.requestId,starts[1].value.requestId);
  const hashes=starts.map(call=>call.value.manifest[0].sha256);
  assert.equal(hashes[0],createHash('sha256').update(before.file.bytes).digest('hex'));
  assert.equal(hashes[1],createHash('sha256').update(after.file.bytes).digest('hex'));
  assert.notEqual(hashes[0],hashes[1]);
  const uploads=env.calls.filter(call=>call.name==='uploadIntakeFile');
  assert.equal(uploads.length,2);
  assert.deepEqual(Buffer.from(uploads[1].value.base64,'base64'),after.file.bytes);
});

test('hash read failure stops before any remote RPC',async()=>{
  const file=fixtureFile();file.file.arrayBuffer=async()=>{throw Error('original unavailable');};
  const env=setup({route:successRoute()});
  await assert.rejects(env.api.send(payload(),[file]),/original unavailable/);
  assert.equal(env.calls.length,0);
  assert.equal(env.reads.length,0);
});
