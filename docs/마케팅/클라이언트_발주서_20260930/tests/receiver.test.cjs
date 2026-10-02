'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {serverSources}=require('../receiver/build.cjs');
const source=fs.readFileSync(path.join(__dirname,'../receiver/Code.gs'),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
const prefix='pulse.intake.v1.';

function harness(){
  const props=new Map(),entries=new Map(),mails=[];let serial=0,locked=false,releases=0;
  const faults={createName:null,setName:null,afterCreateName:null,mail:false};
  const iterator=a=>{let i=0;return {hasNext:()=>i<a.length,next:()=>a[i++]};};
  class BlobMock{
    constructor(content,type,name){this.bytes=typeof content==='string'?Buffer.from(content):Buffer.from(content);this.type=type;this.name=name;}
    getBytes(){return Array.from(this.bytes);}
    getDataAsString(){return this.bytes.toString('utf8');}
  }
  class Entry{
    constructor(name){this.id='drive-'+(++serial);this.name=name;this.trashed=false;this.access='PRIVATE';this.editors=[];this.viewers=[];entries.set(this.id,this);}
    getId(){return this.id;}getName(){return this.name;}isTrashed(){return this.trashed;}
    getSharingAccess(){return this.access;}getEditors(){return this.editors;}getViewers(){return this.viewers;}
  }
  class File extends Entry{
    constructor(blob){super(blob.name);this.blob=blob;}
    getBlob(){return this.blob;}getSize(){return this.blob.bytes.length;}
    setContent(text){if(faults.setName===this.name){faults.setName=null;throw new Error('private-file-id must not leak');}this.blob=new BlobMock(text,this.blob.type,this.name);return this;}
  }
  class Folder extends Entry{
    constructor(name){super(name);this.children=[];}
    getUrl(){return 'https://drive.google.com/drive/folders/'+this.id;}
    createFolder(name){const folder=new Folder(name);this.children.push(folder);return folder;}
    createFile(blob){if(faults.createName===blob.name){faults.createName=null;throw new Error('private-folder-id must not leak');}const file=new File(blob);this.children.push(file);if(faults.afterCreateName===blob.name){faults.afterCreateName=null;throw new Error('response lost');}return file;}
    getFilesByName(name){return iterator(this.children.filter(e=>e instanceof File&&!e.trashed&&e.name===name));}
    getFoldersByName(name){return iterator(this.children.filter(e=>e instanceof Folder&&!e.trashed&&e.name===name));}
  }
  const output=html=>({getContent:()=>html,setTitle(){return this;}});
  const ctx=vm.createContext({
    // Intentionally omit URL, Blob, TextEncoder: those are not Apps Script globals.
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)??null,setProperty:(k,v)=>props.set(k,String(v)),getProperties:()=>Object.fromEntries(props)})},
    DriveApp:{Access:{PRIVATE:'PRIVATE'},createFolder:name=>new Folder(name),getFolderById:id=>{const v=entries.get(id);if(!(v instanceof Folder))throw new Error('unknown folder '+id);return v;},getFileById:id=>{const v=entries.get(id);if(!(v instanceof File))throw new Error('unknown file '+id);return v;}},
    Utilities:{getUuid:()=>crypto.randomUUID(),Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,data)=>Array.from(crypto.createHash('sha256').update(typeof data==='string'?data:Buffer.from(data)).digest()),computeHmacSha256Signature:(value,key)=>Array.from(crypto.createHmac('sha256',key).update(value).digest()),base64Decode:s=>Array.from(Buffer.from(s,'base64')),base64Encode:a=>Buffer.from(a).toString('base64'),newBlob:(content,type,name)=>new BlobMock(content,type,name)},
    LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){assert.equal(locked,true);locked=false;releases++;}})},
    HtmlService:{createHtmlOutputFromFile:()=>output('<html><head></head><body>form</body></html>'),createHtmlOutput:output},
    ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({getContent:()=>text,setMimeType(){return this;}})},
    Session:{getEffectiveUser:()=>({getEmail:()=>'owner@example.com'})},
    MailApp:{sendEmail:(to,subject,body)=>{if(faults.mail){faults.mail=false;throw new Error('mail quota');}mails.push({to,subject,body});}}
  });
  for(const code of Object.values(serverSources()))vm.runInContext(code,ctx);
  vm.runInContext(source,ctx);
  ctx.initializeInbox_();
  const invite=ctx.createInvite_().invite;
  const root=entries.get(props.get(prefix+'rootFolder'));
  const payload=(data={})=>({schema:'synk-video-brief',version:1,createdAt:'2026-01-01T00:00:00Z',data:{subject:'테스트 의류',goal:'purchase',subjectType:'fashion',...data}});
  const request=(manifest=[],data={})=>({invite,requestId:'req_'+crypto.randomUUID().replaceAll('-',''),consent:true,payload:payload(data),manifest});
  const readState=id=>{const rec=JSON.parse(props.get(prefix+'submission.'+id));return JSON.parse(entries.get(rec.stateFileId).getBlob().getDataAsString());};
  const folder=id=>root.children.find(e=>e.name===id);
  return {ctx,props,entries,root,invite,payload,request,readState,folder,faults,mails,get locked(){return locked;},get releases(){return releases;}};
}
const asset=(name='photo.png',size=3,category='product',type='image/png')=>({name,size,category,type,sha256:crypto.createHash('sha256').update(size===0?'':'abc').digest('hex')});
function upload(h,started,index,bytes){return h.ctx.uploadIntakeFile({...plain(started),index,base64:Buffer.from(bytes).toString('base64')});}

test('invites remain hashed, expire, and public RPC surface is limited',()=>{
  const h=harness(),cfg=plain(h.ctx.getIntakeConfig(h.invite));
  assert.deepEqual(cfg,{enabled:true,recipientLabel:'SYNK PULSE 비공개 접수함',maxFileBytes:30*1024*1024,maxTotalBytes:80*1024*1024,maxFiles:30,analysisAutomatic:false});
  assert.equal(h.ctx.getIntakeConfig('not-an-invite').enabled,false);
  assert.ok(!JSON.stringify([...h.props]).includes(h.invite));
  const key=[...h.props.keys()].find(k=>k.includes('.invite.'));
  const record=JSON.parse(h.props.get(key));record.expiresAt='2000-01-01T00:00:00Z';h.props.set(key,JSON.stringify(record));
  assert.equal(h.ctx.getIntakeConfig(h.invite).enabled,false);
  assert.throws(()=>h.ctx.beginIntake(h.request()),/invalid_invite/);
  const publicFunctions=[...source.matchAll(/^function (\w+)\(/gm)].map(m=>m[1]).filter(n=>!n.endsWith('_'));
  assert.deepEqual(publicFunctions,['doGet','doPost','getIntakeConfig','beginIntake','uploadIntakeFile','finishIntake']);
  assert.doesNotMatch(source,/\.(setSharing|addEditor|addViewer|setOwner|removeEditor|removeViewer)\(/);
  assert.equal(h.locked,false);
});

test('consent, answers and HTTP links are server validated without browser URL',()=>{
  const h=harness();
  assert.throws(()=>h.ctx.beginIntake({...h.request(),consent:false}),/consent_required/);
  assert.throws(()=>h.ctx.beginIntake(h.request([],{subject:''})),/invalid_answers/);
  for(const url of ['javascript:alert(1)','https://','https://bad host.com','https://evil.test:99999','https://user:pass@example.com'])assert.throws(()=>h.ctx.beginIntake(h.request([],{productUrl:url})),/invalid_answers/);
  const s=h.ctx.beginIntake(h.request([],{productUrl:'https://example.com/product?id=1',destinationUrl:'http://localhost:4000/cart'}));
  assert.equal(s.status,'uploading');
});

test('manifest enforces file count, size, total, names, MIME and active categories',()=>{
  const h=harness();
  const invalid=[
    [Array.from({length:31},()=>asset()),/invalid_manifest/],
    [[asset('a.png',30*1024*1024+1)],/file_too_large/],
    [[asset('a.png',30*1024*1024),asset('b.png',30*1024*1024),asset('c.png',21*1024*1024)],/total_too_large/],
    [[asset('../a.png')],/invalid_filename/],[[asset('a.exe')],/invalid_filename/],
    [[asset('a.png',3,'model')],/invalid_category/],[[asset('a.png',3,'product','image/png\ntext/html')],/invalid_type/],
    [[asset('a.png',-1)],/file_too_large/],[[{...asset(),sha256:'wrong'}],/invalid_hash/]
  ];
  for(const [manifest,error] of invalid)assert.throws(()=>h.ctx.beginIntake(h.request(manifest)),error);
  assert.equal(h.root.children.length,0,'rejected requests must not create submissions');
  const s=h.ctx.beginIntake(h.request([asset('a.png',30*1024*1024),asset('b.png',30*1024*1024),asset('c.png',20*1024*1024)]));
  assert.equal(s.status,'uploading');
});

test('same project retry ignores client timestamps, rejects changed answers/manifest and invite reuse',()=>{
  const h=harness(),r=h.request([asset()]);
  const a=plain(h.ctx.beginIntake(r));r.payload.createdAt='2099-12-31T00:00:00Z';
  r.payload.data.production='retired';r.payload.data.audio='retired';
  const b=plain(h.ctx.beginIntake(r));assert.deepEqual(b,a);
  assert.equal(h.root.children.length,1);
  assert.throws(()=>h.ctx.beginIntake({...r,manifest:[asset('changed.png')]}),/request_changed/);
  assert.throws(()=>h.ctx.beginIntake({...r,manifest:[{...asset(),sha256:crypto.createHash('sha256').update('xyz').digest('hex')}]}),/request_changed/);
  assert.throws(()=>h.ctx.beginIntake({...r,payload:h.payload({subject:'다른 제품'})}),/request_changed/);
  assert.throws(()=>h.ctx.beginIntake({...r,requestId:'different_request_1234567'}),/invite_used/);
});

test('uploads validate token/bytes, are idempotent and do not accept changed data',()=>{
  const h=harness(),r=h.request([asset()]),s=h.ctx.beginIntake(r);
  assert.throws(()=>upload(h,{...plain(s),uploadToken:'0'.repeat(64)},0,'abc'),/unauthorized/);
  assert.throws(()=>upload(h,s,1,'abc'),/invalid_file/);
  assert.throws(()=>upload(h,s,0,'ab'),/file_size_mismatch/);
  assert.throws(()=>upload(h,s,0,'xyz'),/file_hash_mismatch/);
  const a=plain(upload(h,s,0,'abc')),b=plain(upload(h,s,0,'abc'));
  assert.deepEqual(b,a);assert.equal(a.sha256,crypto.createHash('sha256').update('abc').digest('hex'));
  assert.throws(()=>upload(h,s,0,'xyz'),/file_hash_mismatch/);
  assert.deepEqual(plain(h.ctx.beginIntake(r).uploaded),[0]);
  assert.equal(h.folder(s.submissionId).children.filter(f=>f.name==='00__photo.png').length,1);
  assert.equal(h.folder(s.submissionId).children.find(f=>f.name==='00__photo.png').blob.type,'application/octet-stream');
  assert.equal(h.readState(s.submissionId).files[0].type,'image/png');
  assert.equal(h.locked,false);
});

test('upload recovers an uncertain Drive create and a state write failure without duplicates',()=>{
  const h=harness(),r=h.request([asset()]),s=h.ctx.beginIntake(r);
  h.faults.afterCreateName='00__photo.png';assert.throws(()=>upload(h,s,0,'abc'),/\[retry\]/);
  assert.deepEqual(plain(h.ctx.beginIntake(r).uploaded),[]);
  h.faults.setName='_intake-state.json';assert.throws(()=>upload(h,s,0,'abc'),/\[retry\]/);
  assert.equal(upload(h,s,0,'abc').size,3);
  assert.equal(h.folder(s.submissionId).children.filter(f=>f.name==='00__photo.png').length,1);
});

test('missing files cannot produce a receipt; artifacts and full receipt are stable on retry',()=>{
  const h=harness(),r=h.request([asset()]),s=h.ctx.beginIntake(r);
  assert.throws(()=>h.ctx.finishIntake(s),/files_missing/);
  assert.equal(h.readState(s.submissionId).status,'uploading');
  upload(h,s,0,'abc');
  const receipt=plain(h.ctx.finishIntake(s));
  assert.deepEqual(Object.keys(receipt).sort(),['fileCount','ok','receivedAt','status','submissionId']);
  assert.equal(receipt.ok,true);assert.equal(receipt.status,'received');assert.equal(receipt.fileCount,1);
  assert.deepEqual(plain(h.ctx.finishIntake(s)),receipt);assert.deepEqual(plain(h.ctx.beginIntake(r)),receipt);
  assert.ok(!JSON.stringify(receipt).includes('drive-'));
  const folder=h.folder(s.submissionId);
  assert.equal(folder.children.length,8);
  const packet=JSON.parse(folder.children.find(f=>f.name==='03_제작검토_전달서.json').getBlob().getDataAsString());
  assert.equal(packet.status,'awaiting_analysis');assert.equal(packet.receivedAt,receipt.receivedAt);
  assert.equal(packet.assetManifest[0].presentInPackage,true);
});

test('a new receipt mails the owner once, without answers or file names; mail failure keeps the receipt',()=>{
  const h=harness(),s=h.ctx.beginIntake(h.request([asset('secret-launch.png')],{subject:'비공개 신제품'}));
  upload(h,s,0,'abc');
  assert.equal(h.mails.length,0,'no mail before the receipt boundary');
  const receipt=plain(h.ctx.finishIntake(s));
  assert.equal(h.mails.length,1);
  const [mail]=h.mails;
  assert.equal(mail.to,'owner@example.com');
  assert.ok(mail.subject.includes(receipt.submissionId)&&mail.body.includes(receipt.receivedAt));
  assert.match(mail.body,/자료: 1개/);
  assert.doesNotMatch(mail.subject+mail.body,/비공개 신제품|secret-launch|테스트 의류/);
  assert.deepEqual(plain(h.ctx.finishIntake(s)),receipt);
  assert.equal(h.mails.length,1,'a retried finish must not mail again');
  const q=harness();q.faults.mail=true;
  const t=q.ctx.beginIntake(q.request([]));
  assert.equal(plain(q.ctx.finishIntake(t)).status,'received');
  assert.equal(q.readState(t.submissionId).status,'received');
  assert.equal(q.mails.length,0);assert.equal(q.locked,false);
});

test('failed final artifact creation stays finalizing and retries do not duplicate artifacts',()=>{
  const h=harness(),r=h.request([]),s=h.ctx.beginIntake(r);
  h.faults.createName='04_제작검토_전달서.md';
  assert.throws(()=>h.ctx.finishIntake(s),e=>/\[retry\]/.test(e.message)&&!e.message.includes('private-folder-id'));
  assert.equal(h.readState(s.submissionId).status,'finalizing');
  assert.equal(h.ctx.beginIntake(r).status,'finalizing');
  const startedAt=h.readState(s.submissionId).receivedAt;
  const receipt=h.ctx.finishIntake(s);assert.ok(receipt.receivedAt>=startedAt);
  const names=h.folder(s.submissionId).children.map(f=>f.name);assert.equal(new Set(names).size,names.length);
  assert.equal(h.readState(s.submissionId).status,'received');
});

test('final verification detects server-side file corruption, and storage must remain private',()=>{
  const h=harness(),s=h.ctx.beginIntake(h.request([asset()]));upload(h,s,0,'abc');
  const file=h.folder(s.submissionId).children.find(f=>f.name==='00__photo.png');file.setContent('xyz');
  assert.throws(()=>h.ctx.finishIntake(s),/file_verification_failed/);
  assert.equal(h.readState(s.submissionId).status,'uploading');
  h.root.editors=['someone'];assert.equal(h.ctx.getIntakeConfig(h.invite).enabled,false);
  assert.throws(()=>upload(h,s,0,'abc'),/storage_not_private/);
  h.root.editors=[];h.root.access='ANYONE';assert.throws(()=>h.ctx.finishIntake(s),/storage_not_private/);
});

test('legacy removed fields and hidden conditional values do not reach received files; customer text is escaped',()=>{
  const h=harness(),r=h.request([],{subject:'<script>alert(1)</script>',production:'retired-production',audio:'retired-audio',offerMode:'no',offerDetails:'actual-offer',distribution:'organic',successTarget:'hidden-target',scenes:['whole'],scenePriority:{whole:'must',detail:'prefer'},fieldNotes:{production:'hidden-production-note',audio:'hidden-audio-note'},baselineImages:{color:{name:'missing.png',size:9,category:'product'}}});
  const s=h.ctx.beginIntake(r);h.ctx.finishIntake(s);
  const contents=h.folder(s.submissionId).children.filter(f=>/^0[1-6]_/.test(f.name)).map(f=>f.getBlob().getDataAsString()).join('\n');
  assert.doesNotMatch(contents,/retired-production|retired-audio|hidden-target|hidden-production-note|hidden-audio-note/);
  const html=h.folder(s.submissionId).children.find(f=>f.name==='05_발주서.html').getBlob().getDataAsString();
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('재첨부 필요'));assert.ok(html.includes('반드시 포함'));
  const answer=JSON.parse(h.folder(s.submissionId).children.find(f=>f.name==='01_발주서.json').getBlob().getDataAsString());
  assert.deepEqual(answer.data.scenePriority,{whole:'must'});assert.equal(answer.version,1);assert.equal(answer.data.offerDetails,'actual-offer');assert(!Object.hasOwn(answer.data,'successTarget'));assert(!Object.hasOwn(answer.data,'goal'));
});

test('client HTML injects only a validated invite and never script markup',()=>{
  const h=harness();
  const safe=h.ctx.doGet({parameter:{invite:h.invite}}).getContent();assert.ok(safe.includes(h.invite));
  const attack=h.ctx.doGet({parameter:{invite:'</script><script>alert(1)</script>'}}).getContent();
  assert.ok(attack.includes('window.SYNK_INTAKE={"invite":""}'));assert.ok(!attack.includes('alert(1)'));
});

test('empty files work and unfinished upload credentials expire',()=>{
  const h=harness(),s=h.ctx.beginIntake(h.request([asset('empty.txt',0,'reference','text/plain')]));
  assert.equal(upload(h,s,0,'').size,0);
  const key=prefix+'submission.'+s.submissionId,record=JSON.parse(h.props.get(key));record.expiresAt='2000-01-01T00:00:00Z';h.props.set(key,JSON.stringify(record));
  assert.throws(()=>h.ctx.finishIntake(s),/expired/);assert.equal(h.readState(s.submissionId).status,'uploading');
});

test('server bundle guarantees core initialization before handoff in one file',()=>{
  const sources=serverSources();assert.deepEqual(Object.keys(sources),['Libraries.gs']);
  assert.ok(sources['Libraries.gs'].indexOf('var PULSE_BRIEF_CORE_')<sources['Libraries.gs'].indexOf('var PULSE_BRIEF_HANDOFF_'));
  const h=harness();assert.equal(typeof h.ctx.PULSE_BRIEF_HANDOFF_.build,'function');
});

const post=(h,body)=>JSON.parse(h.ctx.doPost({postData:{contents:JSON.stringify(body)}}).getContent());
test('admin sync uses a separate hashed token and lists only completed projects with stable paging',()=>{
  const h=harness(),adminToken=crypto.randomBytes(32).toString('hex');h.ctx.configureAdminSync_(adminToken);
  assert.ok(!JSON.stringify([...h.props]).includes(adminToken));
  assert.deepEqual(post(h,{action:'listReceived',adminToken:h.invite}),{ok:false,error:'unauthorized'});
  const r1=h.request([]),s1=h.ctx.beginIntake(r1);h.ctx.finishIntake(s1);
  const secondInvite=h.ctx.createInvite_().invite,r2={...h.request([]),invite:secondInvite},s2=h.ctx.beginIntake(r2);h.ctx.finishIntake(s2);
  h.ctx.beginIntake({...h.request([]),invite:h.ctx.createInvite_().invite});
  const a=post(h,{action:'listReceived',adminToken,limit:1});assert.equal(a.items.length,1);assert.ok(a.nextCursor);
  const b=post(h,{action:'listReceived',adminToken,limit:1,cursor:a.nextCursor});assert.equal(b.items.length,1);assert.equal(b.nextCursor,null);
  assert.notEqual(a.items[0].submissionId,b.items[0].submissionId);
  assert.ok(!JSON.stringify(a).includes('drive-'));
  assert.equal(post(h,{action:'listReceived',adminToken,limit:21}).ok,false);
  assert.equal(post(h,{action:'listReceived',adminToken,cursor:'bad'}).ok,false);
});

test('admin reads only indexed completed files or fixed artifacts, in bounded verified chunks',()=>{
  const h=harness(),adminToken=crypto.randomBytes(32).toString('hex');h.ctx.configureAdminSync_(adminToken);
  const s=h.ctx.beginIntake(h.request([asset()])),args={action:'readFile',adminToken,submissionId:s.submissionId,fileIndex:0,offset:0,limit:2};
  assert.equal(post(h,args).ok,false);upload(h,s,0,'abc');h.ctx.finishIntake(s);
  const a=post(h,args),b=post(h,{...args,offset:2});
  assert.equal(a.base64,Buffer.from('ab').toString('base64'));assert.equal(a.eof,false);assert.equal(b.eof,true);assert.equal(a.size,3);
  assert.equal(a.sha256,crypto.createHash('sha256').update('abc').digest('hex'));
  const artifact=post(h,{action:'readFile',adminToken,submissionId:s.submissionId,artifact:'01_발주서.json'});assert.equal(artifact.ok,true);assert.equal(artifact.eof,true);
  for(const bad of [{...args,limit:1048577},{...args,offset:4},{...args,fileIndex:1},{...args,artifact:'01_발주서.json'},{action:'readFile',adminToken,submissionId:s.submissionId,artifact:'_intake-state.json'},{action:'readFile',adminToken,fileId:'drive-1'}])assert.equal(post(h,bad).ok,false);
  assert.ok(!JSON.stringify(artifact).includes('drive-'));
});

test('admin list repairs a lost final index update without treating unfinished work as received',()=>{
  const h=harness(),adminToken=crypto.randomBytes(32).toString('hex');h.ctx.configureAdminSync_(adminToken);
  const s=h.ctx.beginIntake(h.request([]));h.ctx.finishIntake(s);
  const key=prefix+'submission.'+s.submissionId,record=JSON.parse(h.props.get(key));delete record.receivedAt;delete record.fileCount;h.props.set(key,JSON.stringify(record));
  const out=post(h,{action:'listReceived',adminToken});assert.equal(out.items.length,1);assert.equal(JSON.parse(h.props.get(key)).fileCount,0);
});
