'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),S=require('../receiver/sync.cjs');
const TOKEN='abc123'.repeat(10)+'abcd',ENDPOINT='https://script.google.com/macros/s/test_deployment/exec',RECEIPT='p_'+'a'.repeat(32),RECEIVED='2026-10-01T09:00:00.000Z';
const json=value=>({status:200,headers:new Headers(),text:async()=>JSON.stringify(value)});
async function setup(t,{content=Buffer.from('고객 원본 자료'),name='제품.png',manifestChange}={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pulse-sync-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('pulse-sync-'));await fs.rm(root,{recursive:true,force:true});});
  const config={endpoint:ENDPOINT,adminToken:TOKEN,inboxDir:path.join(root,'inbox')},item={submissionId:RECEIPT,receivedAt:RECEIVED,fileCount:1,status:'received'};
  const original={index:0,name,size:content.length,category:'product',type:'image/png',sha256:S.digest(content)};
  const source={submissionId:RECEIPT,receivedAt:RECEIVED,files:[original]};if(manifestChange)manifestChange(source);
  const artifacts=Object.fromEntries(S.ARTIFACTS.map(artifact=>[artifact,Buffer.from(artifact==='02_자료목록.json'?JSON.stringify(source):artifact+'\n고객 자료\n')])),calls=[];
  const api=async(action,args={})=>{
    calls.push({action,args});
    if(action==='listReceived')return {ok:true,items:[item],nextCursor:null};
    const data=args.artifact?artifacts[args.artifact]:content,remoteName=args.artifact||name,offset=args.offset,bytes=data.subarray(offset,offset+args.limit);
    return {ok:true,submissionId:RECEIPT,name:remoteName,size:data.length,sha256:S.digest(data),offset,base64:bytes.toString('base64'),eof:offset+bytes.length===data.length};
  };
  const fetchImpl=async(url,options)=>{
    assert.equal(url,ENDPOINT);assert.equal(options.method,'POST');assert.equal(options.redirect,'manual');const {adminToken,action,...args}=JSON.parse(options.body);assert.equal(adminToken,TOKEN);return json(await api(action,args));
  };
  return {root,config,item,content,source,artifacts,calls,api,fetchImpl};
}
test('fake HTTP downloads six artifacts and chunked originals with truthful local status',async t=>{
  const fixture=await setup(t,{content:Buffer.alloc(S.CHUNK_BYTES+17,97)}),result=await S.runSync(fixture.config,{fetchImpl:fixture.fetchImpl,now:()=>RECEIVED});
  assert.deepEqual(result.downloaded,[RECEIPT]);assert.deepEqual(result.failed,[]);
  const folder=path.join(fixture.config.inboxDir,RECEIPT),manifest=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'));
  assert.equal(manifest.download_verified,true);assert.equal(manifest.analysis_status,'pending');assert.equal(manifest.received_at,RECEIVED);assert.equal(manifest.artifacts.length,6);assert.equal(manifest.files[0].type,'image/png');
  assert.deepEqual(await fs.readFile(path.join(folder,manifest.files[0].path)),fixture.content);
  assert.equal(await fs.readFile(path.join(folder,'AGENT_NOTES.md'),'utf8'),S.AGENT_NOTES);assert(!JSON.stringify(manifest).includes(TOKEN));
  assert.deepEqual(fixture.calls.filter(c=>c.action==='readFile'&&c.args.fileIndex===0).map(c=>c.args.offset),[0,S.CHUNK_BYTES]);
  const before=fixture.calls.filter(c=>c.action==='readFile').length,again=await S.runSync(fixture.config,{fetchImpl:fixture.fetchImpl});assert.deepEqual(again.skipped,[RECEIPT]);assert.equal(fixture.calls.filter(c=>c.action==='readFile').length,before);
});
test('ContentService redirect uses a token-free GET and refuses other hosts or POST redirects',async t=>{
  const {config}=await setup(t),calls=[],client=S.createClient(config,{fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?{status:302,headers:new Headers({location:'https://script.googleusercontent.com/macros/echo?user_content_key=opaque'})}:json({ok:true,items:[]});}});
  await client('listReceived',{limit:20});assert.equal(calls[0].options.method,'POST');assert(JSON.parse(calls[0].options.body).adminToken===TOKEN);assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);assert.deepEqual(calls[1].options.headers,{});assert(!JSON.stringify(calls[1]).includes(TOKEN));
  for(const location of ['https://evil.example/steal','https://script.googleusercontent.com.evil.example/steal','http://script.googleusercontent.com/steal','https://user:pass@script.googleusercontent.com/a','https://script.googleusercontent.com/a?token='+TOKEN]){
    let count=0;const unsafe=S.createClient(config,{fetchImpl:async()=>{count++;return {status:302,headers:new Headers({location})};}});await assert.rejects(()=>unsafe('listReceived'),e=>e.code==='unsafe_redirect');assert.equal(count,1);
  }
  for(const status of [307,308]){const unsafe=S.createClient(config,{fetchImpl:async()=>({status,headers:new Headers({location:'https://script.googleusercontent.com/a'})})});await assert.rejects(()=>unsafe('listReceived'),e=>e.code==='unsafe_redirect');}
});
test('configuration and transport failures never echo tokens, response bodies, or private URLs',async t=>{
  const {config,root}=await setup(t);for(const endpoint of ['http://script.google.com/macros/s/id/exec','https://evil.example/macros/s/id/exec','https://script.google.com/macros/s/id/exec?token='+TOKEN,'https://user:pass@script.google.com/macros/s/id/exec','https://script.google.com/macros/s/id/dev'])assert.throws(()=>S.validateConfig({...config,endpoint}),e=>e.code==='invalid_endpoint'&&!e.message.includes(TOKEN));
  for(const fetchImpl of [async()=>{throw Error('Secret '+TOKEN+' private URL');},async()=>json({ok:false,message:TOKEN}),async()=>({status:500,headers:new Headers(),text:async()=>TOKEN})]){const request=S.createClient(config,{fetchImpl});await assert.rejects(()=>request('listReceived'),e=>!String(e).includes(TOKEN)&&!String(e).includes('private URL'));}
  const file=path.join(root,'connection.json');await fs.writeFile(file,JSON.stringify(config),{mode:0o600});assert.deepEqual(await S.loadConfig(file),config);
  await fs.writeFile(file,'{"adminToken":"'+TOKEN+'"');await assert.rejects(()=>S.loadConfig(file),e=>e.code==='config_unavailable'&&!String(e).includes(TOKEN));
  assert.equal(S.safeError(Error(TOKEN)),'local_operation_failed');
});
test('integrity failure keeps private partials and retry completes without losing received originals',async t=>{
  const f=await setup(t),bad=async(action,args)=>{const reply=await f.api(action,args);if(action==='readFile'&&args.fileIndex===0)reply.base64=Buffer.alloc(f.content.length,120).toString('base64');return reply;};
  const first=await S.runSync(f.config,{request:bad});assert.equal(first.failed[0].code,'download_hash_mismatch');await assert.rejects(()=>fs.access(path.join(f.config.inboxDir,RECEIPT)));
  const partial=path.join(f.config.inboxDir,'.partials',RECEIPT),savedArtifact=await fs.readFile(path.join(partial,'01_발주서.json'));assert.equal(await fs.readFile(path.join(partial,'01_발주서.json'),'utf8'),savedArtifact.toString());
  const tempDir=path.join(f.config.inboxDir,'.partial-downloads',RECEIPT),files=await fs.readdir(tempDir);assert(files.some(name=>name.endsWith('.part')));
  const retry=await S.runSync(f.config,{request:f.api});assert.deepEqual(retry.downloaded,[RECEIPT]);const completed=path.join(f.config.inboxDir,RECEIPT);assert.deepEqual(await fs.readFile(path.join(completed,'01_발주서.json')),savedArtifact);assert.equal(await fs.readFile(path.join(completed,'originals','01_제품.png'),'utf8'),f.content.toString());assert.deepEqual(await fs.readdir(path.join(completed,'originals')),['01_제품.png']);assert.deepEqual(await fs.readdir(tempDir),files);
});
test('receipt IDs and source filenames cannot escape the inbox',async t=>{
  const f=await setup(t);for(const id of ['../outside','p_'+'a'.repeat(32)+'/x','C:\\outside'])await assert.rejects(()=>S.syncReceipt({...f.item,submissionId:id},f.config,f.api),e=>e.code==='invalid_receipt');
  assert.throws(()=>S.safeJoin(f.config.inboxDir,'..','outside'),e=>e.code==='unsafe_local_path');assert.throws(()=>S.safeJoin(f.config.inboxDir,path.parse(f.root).root),e=>e.code==='unsafe_local_path');
  for(const name of ['../../outside.txt','..\\outside.txt','../AGENT_NOTES.md'])assert.throws(()=>S.validateManifest({...f.source,files:[{...f.source.files[0],name}]},f.item),e=>e.code==='invalid_source_filename');
  assert.equal(S.localName('CON.txt',0),'01_CON.txt');assert.equal(S.localName('colon:name?.txt ',0),'01_colon_name_.txt');
  const unsafe=await setup(t,{manifestChange:m=>m.files[0].name='../outside.txt'}),result=await S.runSync(unsafe.config,{request:unsafe.api});assert.equal(result.failed[0].code,'invalid_source_filename');
});
test('changed remote metadata, offsets and false EOF cannot create a verified receipt',async t=>{
  const f=await setup(t,{content:Buffer.alloc(S.CHUNK_BYTES+1,98)});
  for(const mutate of [r=>r.offset++,r=>r.eof=true,r=>r.sha256='0'.repeat(64),r=>r.base64='not-base64']){
    const first=await f.api('readFile',{fileIndex:0,offset:0,limit:S.CHUNK_BYTES});mutate(first);assert.throws(()=>S.decodeChunk(first,{submissionId:RECEIPT,name:'제품.png',offset:0,limit:S.CHUNK_BYTES,maxSize:30*1024*1024,known:f.source.files[0]}),e=>e instanceof S.SyncError);
  }
  const changing=async(action,args)=>{const r=await f.api(action,args);if(action==='readFile'&&args.fileIndex===0&&args.offset>0)r.sha256='f'.repeat(64);return r;};const result=await S.runSync(f.config,{request:changing});assert.equal(result.failed[0].code,'remote_file_changed');
});
test('completed local files are rechecked instead of overwriting damaged originals',async t=>{
  const f=await setup(t);await S.runSync(f.config,{request:f.api});const file=path.join(f.config.inboxDir,RECEIPT,'originals','01_제품.png');await fs.writeFile(file,'사용자가 변경한 원본');
  const before=f.calls.length,result=await S.runSync(f.config,{request:f.api});assert.equal(result.failed[0].code,'local_verification_failed');assert.equal(f.calls.length,before+1);assert.equal(await fs.readFile(file,'utf8'),'사용자가 변경한 원본');
});
test('list pagination processes only complete receipts and detects cursor loops',async t=>{
  const f=await setup(t);await assert.rejects(()=>S.runSync(f.config,{request:async()=>({ok:true,items:[{...f.item,status:'uploading'}]})}),e=>e.code==='incomplete_receipt');
  let count=0;await assert.rejects(()=>S.runSync(f.config,{request:async()=>({ok:true,items:[],nextCursor:(count++,'again')})}),e=>e.code==='invalid_cursor');
});
test('existing symlink destinations cannot redirect originals outside the inbox',async t=>{
  const f=await setup(t),outside=path.join(f.root,'outside');await fs.mkdir(outside);await fs.mkdir(f.config.inboxDir);await fs.symlink(outside,path.join(f.config.inboxDir,RECEIPT),process.platform==='win32'?'junction':'dir');const result=await S.runSync(f.config,{request:f.api});assert.equal(result.failed[0].code,'unsafe_local_directory');assert.deepEqual(await fs.readdir(outside),[]);
});
