'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {quoteFields,inspectThread,updateJob,publicView}=require('../src/estimate-domain.cjs');
const {sampleState,createDemo}=require('../tools/estimate-demo.cjs');
const {openVault}=require('../src/estimate-store.cjs');
const {scanGmail,fromThread,localThreadId,createGmailApi}=require('../src/estimate-gmail.cjs');
const {createEstimateService}=require('../src/estimate-service.cjs');

const owner='member-test-one',other='member-test-two';
const safeKey=crypto.randomBytes(32);
const safe={isEncryptionAvailable:()=>true,encryptString(text){
  const iv=crypto.randomBytes(16),c=crypto.createCipheriv('aes-256-ctr',safeKey,iv);
  return Buffer.concat([iv,c.update(text,'utf8'),c.final()]);
},decryptString(value){const c=crypto.createDecipheriv('aes-256-ctr',safeKey,value.subarray(0,16));return Buffer.concat([c.update(value.subarray(16)),c.final()]).toString('utf8');}};
const fields={title:'영상',scope:'30초 세로 영상',quantity:1,buildMinutes:120,revisionMinutes:60,hourlyRate:50000,directCost:20000,subcontractCost:0,allocation:0,taxMode:'add10',terms:'수정 1회',deadline:'금요일'};
const letter=(id,at,text,other={})=>({id,at,text,subject:'업무 문의',...other});
// 0.5.8: 닫힌 꼴이 아닌 제목은 「지난번처럼 해줘」 금액 앞에서 제목 확인을 거친다. 확인 칸을 체크한 것처럼 한 번 더 부른다.
function titled(call,input){const first=call(input);return first&&first.needsTitleConfirmation?call({...input,confirmedTitle:true,titleConfirmationKey:first.titleConfirmationKey}):first;}
const withTitle=(input,preview)=>preview?.confirmedTitle?{...input,confirmedTitle:true,titleConfirmationKey:preview.titleConfirmationKey}:input;

test('나중에 연 원문이 일부이면 먼저 연 회신이 늦게 끝나도 확인 증표가 없다',async t=>{
  const {compactMessage}=require('../src/estimate-domain.cjs');
  const text='확인했습니다.\n김지훈 드림';
  const stamp=compactMessage({text,subject:'영상 견적',outgoing:true},value=>crypto.createHash('sha256').update(value).digest('hex')).signals.reading.stamp;
  const box={id:'box',provider:'naver',label:'fixture@example.test'};
  const ref={folder:'INBOX',uid:1,uidvalidity:1}, input={threadId:'thread',evidenceId:'reply'};
  const waiting=[];
  const service=createEstimateService({root:tempRoot(t),owner,safe,isCurrent:()=>true,readConfig:async()=>({}),
    naver:{readOriginal:()=>new Promise(resolve=>waiting.push(resolve))},
    makeVault:()=>({originalTarget:()=>({box,ref,subject:'영상 견적',receiptStamp:stamp,checkReceipt:true}),
      snapshot:()=>({threads:[{id:'thread',boxId:'box',evidenceId:'reply',needsReceiptReview:true}]}),close(){}})});
  try{
    const first=service.action('readOriginal',input),second=service.action('readOriginal',input);
    waiting[1]({text,partial:true});
    assert.equal((await second).original.partial,true);
    waiting[0]({text,partial:false});
    assert.equal((await first).code,'STALE');
    assert.equal((await service.snapshot()).data.threads[0].receiptToken,undefined);
    assert.equal((await service.action('confirmReceipt',input)).code,'STALE');
    const fresh=service.action('readOriginal',input);
    waiting[2]({text,partial:false});
    assert.ok((await fresh).receiptToken);
  }finally{service.close();}
});

test('Outlook 폴더 확인 중에는 들어온 문의에 이미 견적을 보냈는지 기다린다',t=>{
  const vault=openVault({root:tempRoot(t),owner,safe});
  try{
    const id=vault.register({provider:'outlook',subject:'test-mailbox',label:'studio@example.test',credential:{}});
    const inquiry={id:'in-1',threadId:'order',at:1,subject:'영상 견적',text:'영상 1편 견적을 부탁드립니다.'};
    const quote={...inquiry,id:'sent-2',at:2,outgoing:true,text:'이번 견적은 187,000원입니다.'};
    const cursor=phase=>({provider:'outlook',phase});
    vault.commit(id,{reset:true,messages:[inquiry],cursor:cursor('scan')});
    const pending=vault.snapshot({}).threads[0];
    assert.equal(pending.awaitingEvidence,true);
    assert.equal(pending.evidenceId,'');
    assert.throws(()=>vault.runAction('repeatPreview',{threadId:pending.id,evidenceId:'previous'}),{code:'STALE'});
    vault.commit(id,{messages:[quote],cursor:cursor('verify')});
    assert.equal(vault.snapshot({}).threads[0].awaitingEvidence,true);
    vault.commit(id,{complete:true,cursor:cursor('done')});
    const complete=vault.snapshot({}).threads[0];
    assert.ok(complete.evidenceId);
    assert.equal(complete.sentQuoteReply,true);
  }finally{vault.close();}
});

test('고객 예산과 제시한 금액, 진행 조건과 견적서 발송을 구별한다',()=>{
  const customer=letter('in',1,'제품 영상 3편 견적을 부탁드립니다.',{subject:'제품 영상 견적'});
  const result=(...bodies)=>inspectThread([customer,...bodies.map((text,i)=>
    letter('out-'+i,i+2,text,{outgoing:true,subject:'Re: 제품 영상 견적'}))]);
  const later='촬영 참고 자료는 내일 보내드리겠습니다.';
  for(const text of ['말씀하신 예산에 맞춘 총액은 726,000원입니다.','726,000원(부가세 별도)입니다.',
    '견적 금액은 726,000원인데 납품 일정은 미정입니다.','납기가 미정이라 제작비만 726,000원으로 확정했습니다.',
    '문의하신 제품 영상 견적은 726,000원입니다.','세부 일정은 아직 확정하지 않았지만 이번 확정 금액은 726,000원입니다.']){
    assert.equal(result(text+' '+later).sentReplyKind,'quote',text);
  }
  for(const text of ['말씀하신 예산은 726,000원입니다.','견적 금액 726,000원은 아직 확정된 금액이 아닙니다.',
    '견적 금액은 726,000원이 아닙니다.','공급가액 660,000원(부가세 66,000원)으로 아직 확정하지 않았습니다.',
    '지난번 작업은 편당 30만 원 총 60만 원이었습니다.','말씀하신 예산 80만 원~100만 원을 확인했습니다.',
    '이번 견적 문의에 적어주신 예산 100만 원을 확인했습니다.','촬영 일정은 언제 확정되나요?',
    '납기를 확인한 뒤 확정 견적을 안내드리겠습니다.',
    '촬영 취소 가능 여부는 내부 검토 중입니다.','촬영 일정은 확인해서 확정하겠습니다.']){
    const thread=result(text+' 확인 후 견적서를 송부하겠습니다.');
    assert.equal(thread.sentQuoteReply,false,text);
    assert.equal(thread.status,'promise',text);
  }
  for(const text of ['최종본 전달일은 12월 10일입니다.','취소 수수료는 총금액의 30%입니다.',
    '취소 수수료는 없습니다.','환불은 불가합니다.']){
    const thread=result(text+' '+later,'확인했습니다.\n김지훈 드림');
    assert.equal(thread.sentReplyKind,'terms',text);
    assert.equal(thread.status,'promise',text);
    assert.match(thread.reason,/진행 조건/u);
  }
  const link='https://drive.google.com/file/d/project-file/view';
  assert.ok(result(link+'\n확인 후 견적서를 송부하겠습니다.').needsTermsReview);
  assert.equal(result('행사장 약도입니다.\n'+link+'\n확인 후 견적서를 송부하겠습니다.').sentQuoteReply,false);
});

test('보낸 견적 뒤 안내 링크와 서명된 고객 인사를 구분하고 남은 약속을 표시한다',()=>{
  const subject='영상 견적';
  const request=letter('buyer',1,'제품 영상 3편 견적을 부탁드립니다.',{subject});
  const outgoing=(id,at,text)=>letter(id,at,text,{subject,outgoing:true});
  const price='제작비는 726,000원입니다.';
  const withLink=inspectThread([request,outgoing('price',2,price),outgoing('link',3,'추가로 안내드립니다. https://example.com/studio')]);
  assert.equal(withLink.status,'waiting');
  assert.equal(withLink.sentReplyKind,'quote');
  assert.equal(withLink.evidenceId,'link');
  assert.equal(Boolean(withLink.receiptReply),false);
  const promised=outgoing('promise',2,price+' 첫 시안은 내일 보여 드리겠습니다.');
  const thanks=letter('thanks',3,'네, 감사합니다.\n파도문구 김지민 드림',{subject,senderName:'김지민'});
  const withThanks=inspectThread([request,promised,thanks]);
  assert.equal(withThanks.status,'promise');
  assert.equal(withThanks.evidenceId,'buyer');
  assert.equal(withThanks.sentReplyKind,'quote');
  const firstQuote=inspectThread([request,outgoing('later',2,'첫 견적은 내일 알려드릴게요.')]);
  assert.equal(firstQuote.status,'promise');
  assert.equal(firstQuote.sentQuoteReply,false);
});
const gMessage=(id,body,labels=[],time=100)=>({id,internalDate:String(time),labelIds:labels,snippet:body,
  payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'제품 영상 견적'},{name:'To',value:'studio@example.com'}],body:{data:Buffer.from(body).toString('base64url')}}});
const box={id:'test-gmail',label:'studio@example.com',provider:'gmail'};
function clientMail(id,body,labels,time){
  const message=gMessage(id,body,labels,time);
  const sent=labels.includes('SENT') || labels.includes('DRAFT');
  message.payload.headers.find(h=>h.name==='To').value=sent?'client@example.org':box.label;
  message.payload.headers.push({name:'From',value:sent?box.label:'client@example.org'});
  return message;
}
const tempRoot=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'estimate-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};

test('항목을 생략한 정정에서 날짜와 수정 횟수를 바로잡고 모호한 값은 다시 묻는다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const before='제품 영상 3편 견적 부탁드립니다. 수정 1회. 희망 납품일은 12월 4일입니다. ';
  const read=change=>readQuoteRequest(before+'정정합니다. '+change,'제품 영상 견적');
  const date=read('12월 10일로 부탁드립니다.');
  assert.equal(date.review,true);
  assert.equal(date.deadline,'12월 10일');
  assert.equal(Boolean(date.deadlineIsLimit),false);
  assert.equal(date.revisions,1);
  const revisions=read('2회로 부탁드립니다.');
  assert.equal(revisions.revisions,2);
  assert.equal(revisions.deadline,'12월 4일');
  assert.equal(read('11월 31일로 부탁드립니다.').deadline,'');
  const unclear=read('모두 다시 말씀드리겠습니다.');
  assert.equal(unclear.revisions,null);
  assert.equal(unclear.deadline,'');
});

test('문의 두 건의 스냅샷 응답이 거꾸로 도착해도 각 요청의 선택과 순번을 지킨다',async t=>{
  const pending=[];
  const svc=createEstimateService({root:tempRoot(t),owner,safe,isCurrent:()=>true,
    readConfig:()=>new Promise(resolve=>pending.push(resolve)),
    makeVault:()=>({snapshot:(_caps,_limit,selected)=>({selected}),close(){}})});
  try {
    const first=svc.snapshot(['first']),second=svc.snapshot(['second']);
    assert.equal(pending.length,2);
    pending[1]({});
    const newer=await second;
    pending[0]({});
    const older=await first;
    assert.deepEqual(older.data.selected,['first']);
    assert.deepEqual(newer.data.selected,['second']);
    assert.ok(newer.data.snapshotSequence>older.data.snapshotSequence);
    assert.deepEqual((await svc.snapshot()).data.selected,['second']);
  } finally {svc.close();}
});

test('재검사에서 시각이 같고 원문이 다른 문의를 만나면 확인을 마칠 때까지 기존 금액과 인계를 보류한다',t=>{
  const root=tempRoot(t);
  let vault=openVault({root,owner,safe});
  try {
    const boxId=vault.register({provider:'naver',subject:'same-time',label:'studio@example.org',credential:{}});
    const mail=(id,uid,at,text)=>({id,evidenceId:id,threadId:'project',at,subject:'제품 영상 견적',text,
      originalRef:{folder:'INBOX',uidvalidity:1,uid}});
    const a=mail('original',1,20,'제품 영상 1편 견적 부탁드립니다. 수정 1회.');
    const b=mail('follow-up',2,20,'제품 영상 3편 견적 부탁드립니다. 수정 2회. 희망 납품일은 12월 10일입니다.');
    vault.commit(boxId,{reset:true,messages:[a],complete:true,cursor:{}});
    const first=vault.snapshot({}).threads[0], reference={threadId:first.id,evidenceId:first.evidenceId};
    vault.runAction('quote',{...reference,...fields});
    vault.runAction('handoff',{...reference,to:'견적 담당',next:'확인'});
    assert.equal(vault.originalTarget(reference).ref.uid,1);
    vault.commit(boxId,{reset:true,messages:[],cursor:{}});
    assert.equal(vault.snapshot({},0,[first.id]).selectedThreads[0].awaitingEvidence,true);
    assert.throws(()=>vault.runAction('quote',{...reference,...fields}),{code:'STALE'});
    assert.throws(()=>vault.runAction('accept',{id:vault.snapshot({}).handoffs[0].id}),{code:'STALE'});
    vault.commit(boxId,{messages:[mail('older',3,10,'제품 영상 2편 견적 부탁드립니다.')],cursor:{}});
    assert.throws(()=>vault.originalTarget(reference),{code:'STALE'});
    vault.commit(boxId,{messages:[b],cursor:{}});
    vault.close();vault=openVault({root,owner,safe});
    const waiting=vault.snapshot({},0,[first.id]);
    assert.equal(waiting.selectedThreads[0].awaitingEvidence,true);
    assert.equal(waiting.quotes[0].currentEvidence,false);
    assert.equal(waiting.handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.originalTarget(reference),{code:'STALE'});
    assert.throws(()=>vault.runAction('accept',{id:waiting.handoffs[0].id}),{code:'STALE'});
    vault.commit(boxId,{complete:true,cursor:{},coverage:{partial:true}});
    assert.throws(()=>vault.runAction('quote',{...reference,...fields}),{code:'STALE'});
    vault.commit(boxId,{messages:[a],complete:true,cursor:{}});
    const latest=vault.snapshot({}).threads[0];
    assert.equal(latest.quoteRequest.revisions,2);assert.equal(latest.quoteRequest.deadline,'12월 10일');
    assert.equal(vault.originalTarget({threadId:first.id,evidenceId:latest.evidenceId}).ref.uid,2);
    assert.throws(()=>vault.originalTarget(reference),{code:'STALE'});
    vault.commit(boxId,{reset:true,messages:[b],cursor:{}});
    assert.equal(vault.snapshot({}).threads[0].awaitingEvidence,true);
    assert.throws(()=>vault.originalTarget({threadId:first.id,evidenceId:latest.evidenceId}),{code:'STALE'});
    const moved={...a,originalRef:{...a.originalRef,folder:'Archive'}};
    vault.commit(boxId,{messages:[moved],complete:true,cursor:{}});
    const ambiguous=vault.snapshot({});
    assert.equal(ambiguous.threads[0].awaitingEvidence,true);
    const options=ambiguous.threads[0].originalChoices;
    assert.equal(options.length,2);
    assert.deepEqual(new Set(options.map(x=>vault.originalTarget({threadId:first.id,readId:x.readId}).ref.folder)),new Set(['INBOX','Archive']));
    for(const option of options){
      assert.deepEqual(Object.keys(option).sort(),['label','readId','subject']);
      assert.throws(()=>vault.runAction('quote',{threadId:first.id,evidenceId:option.readId,...fields}),{code:'STALE'});
      assert.throws(()=>vault.originalTarget({threadId:'other',readId:option.readId}),{code:'STALE'});
    }
    assert.equal(ambiguous.quotes[0].currentEvidence,false);
    assert.throws(()=>vault.originalTarget({threadId:first.id,evidenceId:latest.evidenceId}),{code:'STALE'});
    for(const mail of [moved,b]){
      vault.commit(boxId,{reset:true,messages:[mail],cursor:{}});
      assert.equal(vault.snapshot({}).threads[0].awaitingEvidence,true);
      vault.close();vault=openVault({root,owner,safe});
      vault.commit(boxId,{complete:true,coverage:{partial:true},cursor:{}});
      assert.equal(vault.snapshot({}).threads[0].awaitingEvidence,true);
      assert.throws(()=>vault.runAction('quote',{...reference,...fields}),{code:'STALE'});
      vault.commit(boxId,{messages:[moved,b],complete:true,cursor:{}});
    }
    const c=mail('newest',3,21,'제품 영상 4편 견적 부탁드립니다.');
    vault.commit(boxId,{messages:[c],complete:true,cursor:{}});
    const confirmed=vault.snapshot({}).threads[0];
    assert.throws(()=>vault.originalTarget({threadId:first.id,readId:options[0].readId}),{code:'STALE'});
    assert.equal(confirmed.quoteRequest.quantity,4);
    assert.equal(vault.originalTarget({threadId:first.id,evidenceId:confirmed.evidenceId}).ref.uid,3);
  } finally {vault.close();}
});

test('네이버에서 같은 문의를 먼저 다시 읽어도 전체 확인이 끝나야 견적을 쓸 수 있다',t=>{
  const root=tempRoot(t);
  let store=openVault({root,owner,safe});
  try {
    const id=store.register({provider:'naver',subject:'rescan',label:'studio@example.org',credential:{}});
    const mail={id:'same',threadId:'group',evidenceId:'same',at:8,subject:'영상 견적',text:'영상 3편 견적 부탁드립니다.',originalRef:{folder:'INBOX',uidvalidity:7,uid:8}};
    store.commit(id,{messages:[mail],complete:true,cursor:{}});
    const thread=store.snapshot({}).threads[0],input={threadId:thread.id,evidenceId:thread.evidenceId};
    store.commit(id,{reset:true,messages:[mail],cursor:{}});
    store.close();store=openVault({root,owner,safe});
    for(const part of [{messages:[mail],cursor:{}},{complete:true,coverage:{partial:true},cursor:{}}]){
      store.commit(id,part);
      assert.equal(store.snapshot({}).threads[0].awaitingEvidence,true);
      assert.throws(()=>store.originalTarget(input),{code:'STALE'});
      assert.throws(()=>store.runAction('quote',{...input,...fields}),{code:'STALE'});
    }
    store.commit(id,{messages:[],complete:true,cursor:{}});
    assert.equal(store.snapshot({}).threads[0].evidenceId,thread.evidenceId);
    assert.equal(store.originalTarget(input).ref.uid,8);
    store.commit(id,{messages:[],cursor:{}});
    assert.equal(store.originalTarget(input).ref.uid,8);
  } finally {store.close();}
});

test('네이버 스팸 · 받은 편지함의 읽지 못한 편지 한 통이 메일함 전체를 막지 않는다(0.5.8 검수 c Fable)',t=>{
  const store=openVault({root:tempRoot(t),owner,safe});
  try {
    const id=store.register({provider:'naver',subject:'unreadable-elsewhere',label:'studio@example.org',credential:{}});
    const mail={id:'ask',threadId:'group',evidenceId:'ask',at:8,subject:'영상 견적',text:'영상 3편 견적 부탁드립니다.',originalRef:{folder:'INBOX',uidvalidity:7,uid:8}};
    store.commit(id,{reset:true,messages:[mail],cursor:{}});
    store.commit(id,{messages:[],complete:true,cursor:{},coverage:{partial:true,unreadable:2,unreadableSent:0}});
    let thread=store.snapshot({}).threads[0];
    assert.notEqual(thread.awaitingEvidence,true);
    store.runAction('quote',{threadId:thread.id,evidenceId:thread.evidenceId,...fields});
    assert.equal(store.snapshot({}).quotes.length,1);
    // 보낸 편지함의 읽지 못한 편지는 답장 잠금을 놓칠 수 있어 전처럼 기다린다.
    store.commit(id,{reset:true,messages:[mail],cursor:{}});
    store.commit(id,{messages:[],complete:true,cursor:{},coverage:{partial:true,unreadable:1,unreadableSent:1}});
    thread=store.snapshot({}).threads[0];
    assert.throws(()=>store.runAction('quote',{threadId:thread.id,evidenceId:thread.evidenceId,...fields}),{code:'STALE'});
  } finally {store.close();}
});

test('세대 값이 없는 메일함도 재검사 중 이전 판단을 지키고 원천에서 삭제된 행을 정리한다',t=>{
  const store=openVault({root:tempRoot(t),owner,safe});
  try {
    const id=store.register({provider:'naver',subject:'early-scan',label:'me@example.org',credential:{}});
    const msg=(id,group,at,text)=>({id,evidenceId:id,threadId:group,at,text,subject:'영상 견적',originalRef:{folder:'INBOX',uidvalidity:1,uid:at}});
    const initial=msg('current','one',7,'제품 영상 3편 견적 부탁드립니다.');
    store.commit(id,{messages:[initial,msg('removed','two',8,'행사 영상 1편 견적 부탁드립니다.')],complete:true,cursor:{}});
    store.commit(id,{reset:true,messages:[msg('old','one',1,'제품 영상 1편 견적 부탁드립니다.')],cursor:{}});
    assert.ok(store.snapshot({}).threads.every(row=>row.awaitingEvidence && !row.quoteRequest));
    store.commit(id,{messages:[initial],complete:true,cursor:{}});
    assert.equal(store.snapshot({}).threads.length,1);
    assert.equal(store.snapshot({}).threads[0].quoteRequest.quantity,3);
  } finally {store.close();}
});

test('확인하던 원문이 바뀌면 진행 중이던 스캔이 이전 회신을 복원할 수 없다',async t=>{
  const root=tempRoot(t),vault=openVault({root,owner,safe});
  const id=vault.register({provider:'naver',subject:'rescan-on-change',label:'studio@example.test',credential:{}});
  const incoming={id:'request',threadId:'group',at:1,subject:'영상 견적',text:'제품 영상 3편 견적 부탁드립니다.',
    originalRef:{folder:'INBOX',uidvalidity:1,uid:1}};
  const sent={...incoming,id:'sent',at:2,outgoing:true,text:'확인했습니다.\n김지훈 드림',originalRef:{folder:'Sent',uidvalidity:1,uid:2}};
  const actualText='이번 견적은 726,000원입니다.';
  vault.commit(id,{reset:true,messages:[incoming,sent],complete:true,cursor:{generation:1}});
  const thread=vault.snapshot({}).threads[0],input={threadId:thread.id,evidenceId:thread.evidenceId};
  assert.equal(thread.needsReceiptReview,true);
  const scans=[];
  const service=createEstimateService({root,owner,safe,isCurrent:()=>true,readConfig:async()=>({}),makeVault:()=>vault,
    naver:{scanNaver:job=>new Promise(resolve=>scans.push({...job,finish:resolve})),readOriginal:async()=>({text:actualText,partial:false})}});
  try{
    await service.opened();
    const read=await service.action('readOriginal',input);
    assert.equal(read.original.text,actualText);
    assert.equal(read.receiptToken,undefined);
    assert.equal(scans.length,2);
    assert.equal(scans[0].signal.aborted,true);
    assert.equal(scans[1].box.cursor,null);
    await assert.rejects(scans[0].commit({complete:true,cursor:{generation:1}}));
    scans[0].finish();
    await service.action('scan');
    assert.equal(scans.length,2);
    assert.equal(vault.snapshot({}).threads[0].awaitingEvidence,true);
    await scans[1].commit({reset:true,messages:[incoming,{...sent,text:actualText}],complete:true,cursor:{generation:2}});
    assert.equal(vault.snapshot({}).threads[0].sentQuoteReply,true);
  }finally{for(const scan of scans)scan.finish();service.close();}
});

test('공급자가 선택한 원문의 삭제를 확인하면 다음 저장과 인계를 보류한다',async t=>{
  const root=tempRoot(t),vault=openVault({root,owner,safe});
  const id=vault.register({provider:'naver',subject:'gone',label:'studio@example.org',credential:{}});
  const msg={...letter('one',20,'제품 영상 1편 견적 부탁드립니다.'),threadId:'group',originalRef:{folder:'INBOX',uidvalidity:1,uid:4}};
  vault.commit(id,{reset:true,messages:[msg],complete:true,cursor:{}});
  const thread=vault.snapshot({}).threads[0],input={threadId:thread.id,evidenceId:thread.evidenceId};
  const service=createEstimateService({root,owner,safe,isCurrent:()=>true,readConfig:async()=>({}),makeVault:()=>vault,
    naver:{readOriginal:async()=>{throw Object.assign(new Error('삭제된 시험 메일'),{code:'STALE'});}}});
  try{
    assert.equal((await service.action('readOriginal',input)).code,'STALE');
    assert.equal((await service.action('quote',{...input,...fields})).code,'STALE');
    assert.equal((await service.action('handoff',{...input,to:'견적 담당',next:'확인'})).code,'STALE');
    assert.equal(vault.snapshot({}).threads[0].awaitingEvidence,true);
  }finally{service.close();}
});

test('제목에서 촬영 품목, 슬래시로 구분한 납기, 날짜에 붙은 요일을 구별한다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const body='제품 영상 1편 견적을 부탁드립니다. 수정 1회를 원합니다. 납기는 2026년 12월 4일까지입니다.';
  const read=(title,text=body)=>readQuoteRequest(text,title);
  assert.equal(read('납기: 2026년 12월 4일(금)').review,false);
  assert.equal(read('납기: 2026년 12월 4일(목)').review,true);
  assert.equal(read('납기: 2026년 12월 4일 / 제품 영상 견적 / 납기: 2026년 12월 4일').review,false);
  const shoot=read('촬영 12월 10일 견적 문의 · 납기: 2026년 12월 4일',body.replace('제품 영상','제품 영상 편집'));
  assert.ok(shoot.review||shoot.checkTitle);
});

test('제목에서 고친 수정 횟수에 범위 낱말이 붙으면 본문 횟수로 금액을 내지 않고 확인을 남긴다(0.5.8 검수 카본 O)',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const body='포스터 10장 견적 부탁드립니다. 수정은 2회 요청합니다.';
  for (const title of ['수정 2회가 아니라 3회까지','수정 2회 말고 3회 이내','최대 수정 2회가 아니라 3회까지']) {
    const facts=readQuoteRequest(body,title);
    assert.equal(facts.revisions,null,title);assert.equal(facts.review,true,title);
    assert.match(facts.conditionConflict,/수정 범위/,title);
  }
  // 제목의 수정 횟수 확인 글은 앞서 남긴 일정 확인 글을 덮지 않는다.
  const both=readQuoteRequest('포스터 10장 견적 부탁드립니다. 희망 납품일: 2026년 5월 20일 (월)요일. 수정은 2회 요청합니다.','[수정 3회] 포스터 10장 견적');
  assert.match(both.conditionConflict,/납품일/);assert.match(both.conditionConflict,/제목에는 수정 3회/);
});

test('「지난번처럼 해줘」 금액은 닫힌 꼴의 제목일 때만 제목 확인 없이 낸다(0.5.8 검수 GPT-O)',()=>{
  const {readQuoteRequest,titleNeedsConfirmation}=require('../src/estimate-repeat.cjs');
  const body='30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.';
  assert.equal(titleNeedsConfirmation(readQuoteRequest(body,'30초 세로 제품 영상 견적')),false);
  assert.equal(titleNeedsConfirmation(readQuoteRequest(body,'파도문구 신상품 영상 견적','파도문구')),true);
  // 보낸 사람 이름을 앞에 붙인 제목도 확인을 거친다. 이름 칸이 조건 낱말을 숨길 수 있다(Fable 설계 검토).
  for (const [title,sender] of [['[파도문구] 30초 세로 제품 영상 견적','파도문구'],['[당일] 30초 세로 제품 영상 견적','당일'],
    ['(자막없음) 30초 세로 제품 영상 견적','자막없음'],['당일 기업 견적','당일 기업']]) {
    const facts=readQuoteRequest(body,title,sender);
    assert.ok(facts.review || titleNeedsConfirmation(facts),title);
  }
  // 제목 낱말을 하나씩 지워 통과하던 꼴은 확인을 거치거나 금액을 보류한다.
  for (const [text,title] of [
    ['영어 → 한국어 번역 1건 견적 부탁드립니다. 수정 1회.','한국어 → 영어 번역 견적 요청'],
    ['영상 편집 2편 견적 부탁드립니다. 수정 1회. 납기: 12월 4일(금)','영상 편집 견적 납기: 12월 4일(목)'],
    ['영상 편집 2편 견적 부탁드립니다. 수정 1회.','영상 편집 견적 (기준 - 수정 3회까지)'],
    ['인터뷰 촬영 1건 견적 부탁드립니다. 수정 1회. 납기: 2026년 12월 30일','촬영일: 2026년 12월 25일 / 인터뷰 촬영 견적']]) {
    const facts=readQuoteRequest(text,title);
    assert.ok(facts.review || titleNeedsConfirmation(facts),title);
  }
});

test('처음 보는 발신 서명은 원문을 확인하고 가격·전달물·날짜는 고객에게 이미 보낸 내용으로 남긴다',()=>{
  const {compactMessage}=require('../src/estimate-domain.cjs');
  function assess(tail,senderName='',delimiter=''){
    return compactMessage({outgoing:true,senderName,subject:'견적',text:'메일 잘 받았습니다.\n감사합니다.\n'+delimiter+tail},value=>value).signals;
  }
  assert.equal(assess('').thanks,true);
  for(const name of ['조건우','김담당','박가람','이준','남궁예솔','류지현']){
    for(const sender of ['',name,name+' / 디자인팀','다른 사람']){
      const seen=assess(name+' 드림',sender);
      assert.equal(seen.thanks,false);assert.equal(seen.checkReceipt,true);assert.equal(seen.receiptKind,'verify');
    }
  }
  for(const commercial of ['무료로 드림','조건을 드림','견적서 드림','사은품 드림','최종파일 드림','신제품 드림','최종안 드림','구매내역서 드림','송장 드림','현금가 드림',
    '무료로 제작해 드립니다.','제작비는 받지 않겠습니다.','샘플 한 개를 같이 보내 드립니다.','감독 | 촬영취소','촬영 장소 서울스튜디오']){
    for(const separator of ['','-- \n']){
      const seen=assess(commercial,'김유호',separator);
      assert.equal(seen.receiptKind,'sent',commercial);assert.equal(seen.checkReceipt,false,commercial);
      assert.ok(seen.reading.stamp.includes(commercial),commercial);
    }
  }
  for(const date of ['2026-12-04','2026.12.04','20261204','12/04/2026']){
    assert.equal(assess(date+'\n김유호 드림','김유호','-- \n').receiptKind,'sent',date);
  }
  for(const phone of ['010-1234-5678','전화 02-1234-5678','+44 20 7946 0000']){
    assert.equal(assess('김유호 드림\n대표 | SYNK\n'+phone,'김유호','-- \n').receiptKind,'verify');
  }
  assert.equal(assess('홍길동\n다온전시\n전화 010-1111-2222','','-- \n').receiptKind,'verify');
  assert.equal(assess('홍길동\n무료 전시\n전화 010-1111-2222','','-- \n').receiptKind,'sent');
  assert.equal(assess('김유호 드림\n대표 | 무료 제작\n010-1234-5678','김유호','-- \n').receiptKind,'sent');
});

test('촬영 일정은 편집 단가의 범위를 확인하고 행사일은 참고 일정으로 읽는다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const read=(scope,term)=>readQuoteRequest(scope+' 1편 견적을 부탁드립니다. 수정 1회입니다.',scope+' 견적 / '+term);
  assert.equal(read('제품 영상 편집','촬영 일정: 12월 3일').review,true);
  assert.equal(read('제품 영상 편집','행사일: 12월 3일').review,false);
  assert.equal(read('제품 영상 촬영 및 편집','촬영 일정: 12월 3일').review,false);
  assert.equal(read('제품 영상 편집 촬영 제외','촬영일: 12월 3일').review,true);
});

test('날짜 옆 요일을 제목과 본문에서 같은 달력으로 대조한다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const start='제품 영상 1편 견적을 부탁드립니다. 수정 1회입니다. ';
  const read=(body,title='제품 영상 견적')=>readQuoteRequest(start+body,title);
  for(const date of ['2026년 12월 4일(금)','2026-12-04 [금요일]']){
    const hope=read('희망 납품일은 '+date+'입니다.');
    assert.equal(hope.review,false);assert.ok(hope.deadline);assert.equal(!!hope.deadlineIsLimit,false);
    const limit=read('납기는 '+date+'까지입니다.');
    assert.equal(limit.review,false);assert.equal(limit.deadlineIsLimit,true);
  }
  assert.equal(read('희망 납품일은 12월 4일(목)입니다.').review,false);
  for(const wrong of [
    read('희망 납품일은 2026년 12월 4일(목)입니다.'),
    read('희망 납품일은 2026-12-04입니다.','제품 영상 견적 / 희망 납품일 2026-12-04 [목]'),
    read('희망 납품일은 2026-12-03입니다. 정정: 희망 납품일은 2026-12-04 목요일입니다.')]){
    assert.equal(wrong.deadline,'');assert.equal(wrong.review,true);
    assert.match(wrong.conditionConflict,/목요일/);assert.match(wrong.conditionConflict,/금요일/);
    assert.doesNotMatch(wrong.conditionConflict,/여러 일정/);
  }
});

test('Gmail의 동시각 문의는 회신 관계로 순서를 판단하고 모호하면 이전 금액을 보류한다',()=>{
  function incoming(id,count,parent){
    const m=gMessage(id,'제품 영상 '+count+'편 견적 부탁드립니다. 수정 1회.',[],100);
    m.payload.headers.push({name:'Message-ID',value:'<'+id+'@example.org>'});
    if(parent)m.payload.headers.push({name:'In-Reply-To',value:'<'+parent+'@example.org>'});
    return m;
  }
  const first=incoming('z1',1),second=incoming('a1',3,'z1');
  const read=messages=>fromThread(box,{id:'same-time',messages});
  assert.equal(read([second,first]).quoteRequest.quantity,3);
  assert.equal(read([first,incoming('a1',3)]).quoteRequest.quantity,3);
  const cycle=[incoming('z1',1,'a1'),incoming('a1',3,'z1')];
  const unclear=read(cycle);
  assert.equal(unclear.orderUncertain,true);
  assert.equal(unclear.status,'review');
  assert.equal(unclear.quoteRequest,null);
  const later=gMessage('sent','확인 후 회신하겠습니다.',['SENT'],200);
  assert.equal(read([...cycle,later]).orderUncertain,true);
});

test('내부 수신자만 있는 Gmail 회신과 참조 문의의 임시 초안은 고객 회신 상태를 바꾸지 않는다',()=>{
  const project=gMessage('customer','제품 영상 3편 견적 부탁드립니다. 수정 2회.',[],100);
  project.payload.headers.push({name:'From',value:'Client <client@example.org>'},{name:'Reply-To',value:'quotes@example.org'});
  const outgoing=gMessage('forward','이 견적의 제작 시간부터 확인해 주세요.',['SENT'],101);
  const to=outgoing.payload.headers.find(h=>h.name==='To');
  to.value='team@example.org';
  const read=messages=>fromThread(box,{id:'client',messages});
  assert.equal(read([project,outgoing]).status,'reply');
  to.value='quotes@example.org';
  assert.equal(read([project,outgoing]).status,'waiting');
  project.payload.headers.find(h=>h.name==='To').value='other@example.org';
  project.payload.headers.push({name:'Cc',value:box.label});
  outgoing.labelIds=['DRAFT'];
  const draft=read([project,outgoing]);
  assert.equal(draft.status,'review');
  assert.match(draft.reason,/참조/);
  assert.match(draft.reason,/작성 중/);
  assert.equal(inspectThread([letter('file',1,'감사합니다.',{subject:'전시 영상 견적',hasAttachments:true})]).status,'review');
});

test('수신 주소를 증명할 수 없는 Gmail 발신과 초안은 고객 문의를 열린 상태로 둔다',()=>{
  const project=gMessage('request','전시 영상 1편 견적 부탁드립니다.',[],100);
  project.payload.headers.push({name:'From',value:'Client <client@example.org>'});
  const read=(incoming,outgoing)=>fromThread(box,{id:'project',messages:[incoming,outgoing]});
  for(const labels of [['SENT'],['DRAFT']]){
    const message=gMessage('out','견적 회신을 드립니다.',labels,200);
    message.payload.headers=message.payload.headers.filter(h=>h.name!=='To');
    for(const value of [null,'','(client@example.org)','"client@example.org":;','"client@example.org" <team@example.org>','clie(관리)nt@example.org']){
      message.payload.headers=message.payload.headers.filter(h=>h.name!=='Cc');
      if(value!==null)message.payload.headers.push({name:'Cc',value});
      const thread=read(project,message);
      assert.equal(thread.status,'reply',JSON.stringify([labels,value]));
      assert.equal(thread.quoteRequest.quantity,1);
    }
    message.payload.headers.push({name:'Bcc',value:'client@example.org'});
    assert.equal(read(project,message).status,labels[0]==='DRAFT'?'draft':'waiting');
    const unknown={...project,payload:{...project.payload,headers:project.payload.headers.filter(h=>h.name!=='From')}};
    assert.equal(read(unknown,message).status,'reply');
  }
});

test('참고 주소의 바깥 표시만 통일하고 URI 안 괄호와 인용 깊이를 보존한다',()=>{
  const {sameCurrentBody,originalBodyVersions}=require('../src/estimate-domain.cjs');
  const {gmailMessage}=require('../src/estimate-gmail.cjs');
  const base='제품 영상 3편 견적 부탁드립니다. 수정 1회.\n참고 URL ';
  const mime=(plain,html)=>gmailMessage({...gMessage('alternative',plain),payload:{mimeType:'multipart/alternative',parts:
    [['text/plain',plain],['text/html','<p>'+html.replace(/\n/gu,'</p><p>')+'</p>']].map(([mimeType,data])=>({mimeType,body:{data:Buffer.from(data).toString('base64url')}}))}});
  for(const url of ['https://example.com/a(b)','https://example.com/a)','https://example.com/a?next=(https://example.org/b)','https://example.com/a%28b%29']){
    assert.equal(sameCurrentBody(base+url,base+'('+url+')'),true);
    assert.equal(sameCurrentBody(base+'<'+url+'>',base+'('+url+')'),true);
    assert.equal(mime(base+url,base+'('+url+')').partialBody,false);
    assert.equal(originalBodyVersions(['> '+base.split('\n')[1]+url,'> '+base.split('\n')[1]+'('+url+')']).length,1);
    assert.equal(originalBodyVersions(['> '+url,'>> ('+url+')']).length,2);
  }
  for(const [left,right] of [['a?next=(https://example.org/b)','a?next=https://example.org/b'],['a%28b%29','a(b)'],['a(1)','a(2)'],['ａ','a']]){
    const a=base+'https://example.com/'+left,b=base+'https://example.com/'+right;
    assert.equal(sameCurrentBody(a,b),false);
    assert.equal(originalBodyVersions([a,b]).length,2);
    assert.equal(mime(a,b).partialBody,true);
  }
});

test('제목 납기의 앞뒤 표기에서 기한과 희망일을 구분하고 행사일을 납기로 옮기지 않는다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const inquiry=(subject,body)=>readQuoteRequest('행사 영상 1편 견적 부탁드립니다. 수정 1회. '+body,'행사 영상 견적 · '+subject);
  const hard='납기는 12월 4일까지입니다.',soft='희망 납품일은 12월 4일입니다.';
  for(const term of ['12월 4일까지 납품','12월 4일 납기','납기 12월 4일','납품일 12월 4일까지']){
    const conflict=inquiry(term,soft);
    assert.equal(conflict.deadline,'',term);assert.equal(conflict.review,true);assert.match(conflict.conditionConflict,/기한/);
    assert.equal(inquiry(term,hard).deadlineIsLimit,true);
  }
  for(const term of ['희망 납품일 12월 4일','12월 4일 희망 납품일']){
    assert.equal(inquiry(term,hard).deadline,'',term);assert.equal(inquiry(term,soft).deadline,'12월 4일');
  }
  for(const term of ['행사일 12월 10일 납기 12월 4일','납기 12월 4일 행사일 12월 10일','촬영일 12월 10일 · 12월 4일까지 납품']){
    const same=inquiry(term,hard);
    assert.equal(same.deadline,'12월 4일',term);assert.equal(same.deadlineIsLimit,true);assert.doesNotMatch(same.conditionConflict||'',/납품일/);
  }
  assert.equal(inquiry('행사일 12월 10일 납기 12월 6일',hard).deadline,'');
});

test('대체 본문의 같은 참고 URL은 표시 괄호를 구별하고 실제로 다른 경로는 보류한다',()=>{
  const {sameCurrentBody}=require('../src/estimate-domain.cjs');
  const base='제품 영상 3편 견적 부탁드립니다. 수정 1회.\n참고용 포트폴리오 ';
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  for(const url of ['https://example.org/a','https://example.org/a?id=1&lang=ko','https://example.org/a)','https://example.org/a(b)']){
    assert.equal(sameCurrentBody(base+url,base+'('+url+')'),true);
    assert.equal(sameCurrentBody(base+'<'+url+'>',base+'('+url+')'),true);
    assert.equal(readQuoteRequest(base+url,'제품 영상 견적').review,false);
  }
  assert.equal(sameCurrentBody(base+'https://example.org/a(1)',base+'https://example.org/a'),false);
  assert.equal(sameCurrentBody(base+'https://example.org/a',base+'(https://example.org/b)'),false);
});

test('연속된 행사일과 납기는 앞뒤 조합과 날짜 띄어쓰기를 보존하고 여러 해석이면 확인을 요청한다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const read=(title,body)=>readQuoteRequest('행사 영상 1편 견적 부탁드립니다. 수정 1회. '+body,'행사 영상 견적 · '+title);
  const limit='납기는 12월 4일까지입니다.',hope='희망 납품일은 12월 4일입니다.';
  for(const event of ['행사일 12월 10일','12월 10일 행사일','12월 10일 행사','12월 10일 행사 일정']){
    for(const due of ['납기 12 월 4 일까지','12 월 4 일까지 납기','12월 4일 납기']){
      for(const sep of [' ',' · ', ', ']){
        for(const title of [event+sep+due,due+sep+event]){
          const facts=read(title,limit);
          assert.equal(facts.deadline,'12월 4일',title);assert.equal(facts.deadlineIsLimit,true,title);
          assert.equal(read(title,hope).deadline,'',title);
        }
      }
    }
  }
  for(const date of ['12 월 10 일','2026 년 12 월 10 일','2026 - 12 - 10']){
    const facts=read(date+'까지 납품',hope);
    assert.equal(facts.deadline,'');assert.match(facts.conditionConflict,/납품일/);
  }
  assert.equal(read('12 월 4 일까지 납품',hope).deadline,'');
  assert.match(read('12월 10일 납기 12월 4일',limit).conditionConflict,/원문/);
  assert.equal(read('행사일 12월 4일 납기',limit).deadline,'');
  assert.equal(read('견적 문의 12월 4일까지 납품',limit).deadline,'12월 4일');
  assert.match(read('납기 12월 4일 12월 10일',limit).conditionConflict,/원문/);
});

test('전각 표시 괄호와 문장 끝의 마침표는 URI 안의 문장부호와 별개로 대조한다',()=>{
  const {sameCurrentBody,originalBodyVersions}=require('../src/estimate-domain.cjs');
  const gmail=require('../src/estimate-gmail.cjs');
  const line=text=>'제품 영상 3편 견적 부탁드립니다. 수정 1회.\n관련 링크 '+text;
  const url='https://example.com/a(b)';
  const message=values=>gmail.gmailMessage({...gMessage('mixed',''),payload:{mimeType:'multipart/alternative',
    parts:values.map(v=>({mimeType:'text/plain',body:{data:Buffer.from(line(v)).toString('base64url')}}))}});
  for(const [open,close] of [['(',')'],['（','）'],['<','>'],['＜','＞'],['〈','〉']]){
    for(const punctuation of ['','.','!',',']){
      const bare=url+punctuation,wrapped=open+url+close+punctuation;
      assert.equal(sameCurrentBody(line(bare),line(wrapped)),true,wrapped);
      assert.equal(originalBodyVersions([line(bare),line(wrapped)]).length,1);
      assert.equal(message([bare,wrapped]).partialBody,false);
    }
  }
  const outer='('+url+').',inner='('+url+'.)';
  assert.equal(sameCurrentBody(line(outer),line(inner)),false);
  assert.equal(originalBodyVersions([line(url+'.'),line(inner),line(outer)]).length,2);
  for(const forms of [[url+'.',outer,inner],[outer,inner,url+'.'],[inner,url+'.',outer]])assert.equal(message(forms).partialBody,true);
  assert.equal(sameCurrentBody(line('https://example.com/a（b）'),line(url)),false);
  const query='https://example.com/a?value=!';
  assert.equal(sameCurrentBody(line(query),line('('+query+')')),true);
  assert.equal(sameCurrentBody(line(query),line('(https://example.com/a?value=)!')),false);
  const {htmlText}=require('../src/estimate-naver.cjs');
  const href=(address,after)=>htmlText('<p>관련 링크 <a href="'+address+'">'+address+'</a>'+after+'</p>');
  assert.equal(originalBodyVersions([href(url+'.',''),href(url,'.')]).length,2);
  assert.equal(originalBodyVersions([href(query,''),href(query.slice(0,-1),'!')]).length,2);
});

test('품목명과 요일·조사가 붙어도 각 일정의 실제 날짜로 반복 견적을 판단한다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const read=(subject,day=4,hope=false)=>readQuoteRequest('행사 영상 1편 견적 부탁드립니다. 수정 1회. '+
    (hope?'희망 납품일은 12월 '+day+'일입니다.':'납기는 12월 '+day+'일까지입니다.'),subject);
  for(const title of ['전시 납기: 12월 4일까지','12월 4일 납기 행사 영상 견적','봄 전시: 12월 4일 납기']){
    const matched=read(title);
    assert.equal(matched.deadline,'12월 4일',title);assert.equal(matched.deadlineIsLimit,true);
    assert.doesNotMatch(matched.conditionConflict||'',/여러 일정/);
  }
  assert.equal(read('봄 전시 12월 4일 12월 10일 납기',10).deadline,'');
  for(const suffix of ['12월 4일(금) 납기 12월 10일에 행사','12월 4일(금)까지 납기 12월 10일(목) 행사일',
    '12월 10일(목) 행사일 12월 4일까지 납기','12월 4일납기 12월 10일행사','행사일 12월 10일(목) 납기 12월 4일(금)']){
    const subject='행사 영상 견적 · '+suffix,matched=read(subject);
    assert.equal(matched.deadline,'12월 4일',subject);assert.equal(matched.deadlineIsLimit,true);
    assert.equal(matched.review,false,subject);
    assert.equal(read(subject,10).deadline,'',subject);
  }
  const glued='행사 영상 견적 · 12월 10일까지납품';
  assert.equal(read(glued,4,true).deadline,'');
  assert.equal(read(glued,10,true).deadline,'');
});

test('실제 href와 인라인 요소 밖 문장부호를 가시 텍스트 경계에서 구분한다',()=>{
  const gmail=require('../src/estimate-gmail.cjs');
  const {htmlText,findText}=require('../src/estimate-naver.cjs');
  const {originalBodyVersions,sameCurrentBody}=require('../src/estimate-domain.cjs');
  const before='제품 영상 3편 견적 부탁드립니다. 수정 1회.\n';
  const anchor=(url,label=url)=>'<a href="'+url+'">'+label+'</a>';
  const testMail=(plain,html)=>{
    const bodies=[['text/plain',before+plain],['text/html','<p>'+before.trim()+'</p><p>'+html+'</p>']];
    const data=gmail.gmailMessage({...gMessage('variant',''),payload:{mimeType:'multipart/alternative',parts:bodies.map(([mimeType,text])=>({mimeType,body:{data:Buffer.from(text).toString('base64url')}}))}});
    const raw=['Content-Type: multipart/alternative; boundary=qa','',...bodies.flatMap(([type,text])=>['--qa','Content-Type: '+type+'; charset=utf-8','',text]),'--qa--',''].join('\r\n');
    const imap=findText(Buffer.from(raw));
    assert.equal(Boolean(data.partialBody),Boolean(imap.partial));
    return data.partialBody;
  };
  const u='https://example.com/a',v='https://example.com/b',query=u+'?v=wow!';
  for(const [plain,html] of [
    ['('+query+')','<span>(</span>'+anchor(query)+'<em>)</em>'],
    ['('+u+', '+v+')','('+anchor(u)+', '+anchor(v)+')'],
    ['('+u+', 소리 제외)','('+anchor(u)+'<span>, 소리 제외)</span>'],
    ['참고:'+u+'.','참고:'+anchor(u)+'<span>.</span>'],
  ])assert.equal(testMail(plain,html),false,plain);
  for(const [a,b] of [['!','！'],['.','．'],[',','，']]){
    assert.equal(sameCurrentBody('포트폴리오 '+u+a,'포트폴리오 '+u+b),false);
  }
  const same=u+'?v=1.',first=htmlText(anchor(same)),second=htmlText(anchor(u+'?v=1')+'<span><b>.</b></span>');
  for(const bodies of [[same,first,second],[second,first,same],[first,same,second]])assert.equal(originalBodyVersions(bodies).length,2);
});

test('같은 날짜 배정은 인정하며 제목에서 별도 촬영 견적을 지우지 않는다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const read=(title,day=4)=>readQuoteRequest('제품 영상 1편 견적 부탁드립니다. 수정 1회. 납기는 12월 '+day+'일까지입니다.',title,'파도문구');
  for(const title of ['영상 견적 · 12월 4일 납기 행사 12월 10일','영상 견적 · 납기: 12월 4일 행사: 12월 10일',
    '영상 견적 행사: 12월 10일 납기: 12월 4일','영상 견적 / 행사: 12월 10일 납기: 12월 4일','영상 견적 · 납기 12월 4일 · 12월 4일까지 납기']){
    const facts=read(title);assert.equal(facts.review,false,title);assert.equal(facts.deadlineIsLimit,true,title);
    assert.equal(read(title,7).deadline,'',title);
  }
  assert.equal(read('[파도문구] 행사: 12월 10일 납기: 12월 4일').review,false);
  assert.equal(read('행사: 12월 10일 전시 납기: 12월 4일').deadline,'12월 4일');
  const extra=read('12월 4일 촬영 견적 · 제품 영상 1편 · 12월 10일 납기',10);
  assert.equal(extra.review,true);assert.equal(extra.deadline,'12월 10일');
  const hope=readQuoteRequest('제품 영상 1편 견적 부탁드립니다. 수정 1회. 희망 납품일은 12월 4일입니다.','영상 견적 · 고객희망 납품일: 12월 4일');
  assert.equal(hope.review,false);assert.equal(hope.deadline,'12월 4일');
});

test('붙은 링크 둘과 쉼표를 포함한 단일 href는 Gmail에서 서로 다른 원문으로 남는다',()=>{
  const {htmlText}=require('../src/estimate-naver.cjs');
  const {originalBodyVersions,sameCurrentBody}=require('../src/estimate-domain.cjs');
  const a='https://example.com/a',b='https://example.com/b';
  const anchor=url=>'<a href="'+url+'">'+url+'</a>';
  const split=htmlText(anchor(a)+'<span>,</span>'+anchor(b)),joined=htmlText(anchor(a+','+b));
  const bare=a+','+b;
  assert.equal(sameCurrentBody(bare,split),true);assert.equal(sameCurrentBody(joined,split),false);
  for(const order of [[bare,split,joined],[joined,bare,split],[split,joined,bare]])assert.equal(originalBodyVersions(order).length,2);
  assert.equal(sameCurrentBody('('+a+')!','('+a+')！'),true);
  assert.equal(sameCurrentBody(a+'!',a+'！'),false);
  const nested=a+'?next=('+b+')';assert.equal(sameCurrentBody(nested,a+'?next='+b),false);
});

test('페이지 밖 선택한 견적과 인계 원문은 현재 보관된 행으로 확인하고 삭제한 행은 되살리지 않는다',t=>{
  const root=tempRoot(t),store=openVault({root,owner,safe});
  try{
    const id=store.register({provider:'gmail',subject:box.label,label:box.label,credential:{}});
    const mailbox={id,label:box.label};
    const rows=['first','second','third'].map((name,i)=>fromThread(mailbox,{id:name,messages:[gMessage(name,'제품 영상 1편 견적 부탁드립니다. 수정 1회.',[],i+1)]}));
    const commit=items=>store.commit(id,{records:items,complete:true,cursor:{generation:1}});
    commit(rows.map(value=>({id:value.id,value})));
    const selected=[rows[0].id,rows[1].id];
    const first=store.snapshot({},1,selected);
    assert.equal(first.hasMore,true);assert.equal(first.threads.length,1);
    assert.deepEqual(new Set(first.selectedThreads.map(t=>t.id)),new Set(selected));
    assert.ok(first.selectedThreads.every(t=>t.evidenceId&&t.directOriginal&&!Object.hasOwn(t,'originalRef')));
    const old=first.selectedThreads.find(row=>row.id===rows[0].id);
    commit([{id:old.id,value:null}]);
    const next=store.snapshot({},1,selected);
    assert.deepEqual(next.checkedThreadIds,selected);assert.equal(next.hasMore,true);
    assert.deepEqual(next.selectedThreads.map(t=>t.id),[rows[1].id]);
    assert.throws(()=>store.originalTarget({threadId:old.id,evidenceId:old.evidenceId}),{code:'STALE'});
  }finally{store.close();}
});

test('발신 방향 미상 뒤 내 약속과 답장이 와도 확인할 고객과 원문이 앞선 견적으로 돌아가지 않는다',()=>{
  const subject='제품 영상 견적';
  const a=letter('a',1,'제품 영상 3편 견적 부탁드립니다. 수정 1회.',{subject,originalRef:{id:'a'}});
  const b=letter('b',2,'첨부 요청입니다.',{subject,originalRef:{id:'b'},directionUncertain:true,uncertain:'발신자를 확인해 주세요.'});
  for(const body of ['견적을 내일 보내드리겠습니다.','확인했습니다. 감사합니다.','견적을 보냅니다.']){
    const reply=letter('sent',3,body,{subject,outgoing:true}), current=inspectThread([a,b,reply]);
    assert.equal(current.evidenceId,b.id);assert.deepEqual(current.originalRef,b.originalRef);
    assert.equal(current.status,'review');assert.equal(current.quoteRequest,null);
    assert.equal(inspectThread([a,reply]).evidenceId,a.id);
    const confirmed=letter('c',4,'제품 영상 5편 견적 부탁드립니다. 수정 2회.',{subject});
    assert.equal(inspectThread([a,b,reply,confirmed]).quoteRequest.quantity,5);
  }
});

test('명시한 참고용 파일은 이전 문의를 유지하고 새 조건이나 읽지 못한 첨부는 해당 메일에서 확인한다',()=>{
  const subject='제품 영상 견적';
  const a=letter('a',1,'제품 영상 3편 견적 부탁드립니다. 수정 1회.',{subject,originalRef:{id:'a'}});
  const b=letter('b',2,'참고용 파일을 첨부했습니다. 감사합니다.',{subject:'Re: '+subject,hasAttachments:true,originalRef:{id:'b'}});
  const kept=inspectThread([a,b]);assert.equal(kept.evidenceId,'a');assert.equal(kept.quoteRequest.quantity,3);
  for(const text of ['참고용으로 파일을 첨부했습니다.','참고용으로만 파일을 첨부했습니다. 감사합니다.']){
    assert.equal(inspectThread([a,{...b,text}]).evidenceId,'a');
  }
  for(const change of [{text:'참고 자료 첨부합니다.'},{text:'감사합니다.'},{text:'첨부 목록대로 작업해 주세요.'},{subject:'영상 5편을 제작해 주세요.'},{partialBody:true}]){
    const current=inspectThread([a,{...b,...change}]);
    assert.equal(current.evidenceId,'b');assert.equal(current.status,'review');assert.equal(current.quoteRequest,null);
    assert.deepEqual(current.originalRef,b.originalRef);
  }
  const updated=inspectThread([a,{...b,text:'수정 2회. 희망 납품일은 12월 10일입니다. 첨부 파일도 확인해 주세요.'}]);
  assert.equal(updated.quoteRequest.review,true);assert.equal(updated.quoteRequest.quantity,null);
  assert.equal(updated.quoteRequest.revisions,2);assert.equal(updated.quoteRequest.deadline,'12월 10일');
});

test('제목의 첫 견적 요청을 읽고 첨부 문의 후 같은 제목의 감사는 기존 근거를 유지한다',()=>{
  const subject='30초 세로 제품 영상 3편 견적을 부탁드립니다';
  for(const text of ['', '감사합니다.']){
    const thread=inspectThread([letter('a',1,text,{subject,originalRef:{id:'a'}})]);
    assert.equal(thread.status,'reply');assert.equal(thread.kind,'quote');
    assert.match(thread.request,/제품 영상 3편/);assert.equal(thread.originalRef.id,'a');
  }
  const a=letter('a',1,'제품 영상 1편 견적 부탁드립니다.',{subject:'제품 영상 견적'});
  const b=letter('b',2,'파일을 첨부했습니다.',{subject:'행사 영상 견적',hasAttachments:true,originalRef:{id:'b'}});
  const c=letter('c',3,'감사합니다.',{subject:'Re: 행사 영상 견적',originalRef:{id:'c'}});
  const current=inspectThread([a,b,c]);
  assert.equal(current.status,'review');assert.equal(current.originalRef.id,'b');assert.equal(current.quoteRequest,null);
  const own=letter('mine',3,'확인 후 회신드리겠습니다.',{subject:a.subject,outgoing:true});
  assert.equal(inspectThread([a,b,own,{...c,at:4}]).originalRef.id,'b');
});

test('Gmail 참조는 실제 주소와 개인 Gmail 별칭으로 판별하며 표시 이름과 주석을 제외한다',()=>{
  const {headerAddresses}=require('../src/estimate-domain.cjs');
  const local='soliotest'+crypto.randomUUID().replaceAll('-','');
  const gmail=name=>name+'@gmail.com';
  const account=gmail(local),projects=gmail(local+'+projects');
  const cc='Owner <'+projects+'>';
  const direct='"'+account+', 담당" <vendor@example.com> (안내 ('+account+'))';
  assert.deepEqual(headerAddresses('Project: '+direct+', '+cc+';'),['vendor@example.com',projects]);
  function classify(address,to,copy){
    const msg=gMessage('requested','제품 영상 1편 견적 부탁드립니다.');
    msg.payload.headers=[{name:'subject',value:'제품 영상 견적'},{name:'To',value:to},{name:'Cc',value:copy}];
    return fromThread({id:'inbox',label:address},{id:'thread',messages:[msg]}).status;
  }
  assert.equal(classify(account,direct,cc),'review');
  assert.equal(classify(gmail(local.slice(0,1)+'.'+local.slice(1)),gmail(local+'+team'),cc),'reply');
  assert.equal(classify('me@studio.example','m.e@studio.example','me@studio.example'),'review');
});

test('HTML 자동 링크에 쿼리가 있어도 같은 주소와 같은 메일 본문을 한 번만 표시한다',()=>{
  const {htmlText,findText}=require('../src/estimate-naver.cjs');
  const url='https://example.com/p?id=1&lang=ko',htmlUrl=url.replace('&','&amp;');
  const plain='참고용 포트폴리오 ('+url+')';
  const html='<p>참고용 포트폴리오 (<a href="'+htmlUrl+'">'+htmlUrl+'</a>)</p>';
  assert.equal(htmlText(html),plain);
  assert.equal(htmlText('<a href="'+htmlUrl+'">포트폴리오</a>'),'포트폴리오 ('+url+')');
  const raw=['Content-Type: multipart/alternative; boundary=qa','','--qa','Content-Type: text/plain; charset=utf-8','',plain,
    '--qa','Content-Type: text/html; charset=utf-8','',html,'--qa--',''].join('\r\n');
  const original=findText(Buffer.from(raw),0,null,false,'',true);
  assert.equal(original.plain,plain);assert.equal(Boolean(original.uncertain),false);
});

test('Gmail과 네이버 원문은 동일한 글의 인용 경계가 다를 때 실제 두 본문을 함께 표시한다',async()=>{
  const gmail=require('../src/estimate-gmail.cjs'), naver=require('../src/estimate-naver.cjs');
  const plain='영상 문의입니다.\n> 수정 2회를 원합니다.', alternate='<p>영상 문의입니다.</p><p>수정 2회를 원합니다.</p>';
  for(const [html,partial] of [[alternate,true],[alternate.replace('<p>수정 2회를 원합니다.</p>','<blockquote>수정 2회를 원합니다.</blockquote>'),false]]){
    const parts=[['text/plain',plain],['text/html',html]];
    const item={...gMessage('chosen',plain),payload:{mimeType:'multipart/alternative',parts:parts.map(([mimeType,body])=>({mimeType,body:{data:Buffer.from(body).toString('base64url')}}))}};
    const shown=await gmail.readOriginal({box,ref:{id:item.id},api:{profile:async()=>({emailAddress:box.label}),message:async()=>item}});
    const raw=['Content-Type: multipart/alternative; boundary=qa','','',...parts.map(([type,body])=>'--qa\r\nContent-Type: '+type+'; charset=utf-8\r\n\r\n'+body),'--qa--',''].join('\r\n');
    const found=naver.findText(Buffer.from(raw),0,null,false,'',true);
    for(const result of [shown,{text:found.plain,partial:found.partial}]){
      assert.equal(result.partial,partial);
      assert.equal((result.text.match(/수정 2회를/g)||[]).length,partial?2:1);
      assert.equal(result.text.includes('[본문 2]'),partial);assert.match(result.text,/> 수정 2회/);
    }
  }
  const {originalBodyVersions}=require('../src/estimate-domain.cjs');
  assert.equal(originalBodyVersions(['a\n＞ b','a\n> b','a\n>> b']).length,3);
});

test('삽입 그림의 조건은 세 메일에서 보류하고 확인한 장식은 글에 적힌 조건으로 계산한다',async()=>{
  const gmail=require('../src/estimate-gmail.cjs'),naver=require('../src/estimate-naver.cjs'),outlook=require('../src/estimate-outlook.cjs');
  const body='제품 영상 3편 견적 부탁드립니다. 수정 1회.';
  const plain={mimeType:'text/plain',body:{data:Buffer.from(body).toString('base64url')}};
  const logo={mimeType:'image/png',filename:'logo.png',headers:[{name:'Content-ID',value:'<brand-logo>'}],body:{attachmentId:'file'}};
  for(const [attrs,partial] of [['',true],['alt=""',true],['alt="사진 두 장도 필요합니다"',true],['alt="" role="presentation"',false]]){
    const markup='<p>'+body+'</p><img src="cid:brand-logo" '+attrs+'>';
    const html={mimeType:'text/html',body:{data:Buffer.from(markup).toString('base64url')}};
    const item={...gMessage('terms',body),payload:{mimeType:'multipart/related',parts:[{mimeType:'multipart/alternative',parts:[plain,html]},logo]}};
    const mail=gmail.gmailMessage(item);
    const original=await gmail.readOriginal({box,ref:{id:item.id},api:{profile:async()=>({emailAddress:box.label}),message:async()=>item}});
    const graph=outlook.outlookMessage({boxId:'b',folder:{id:'i',role:'inbox'},me:box.label,item:{id:'item',conversationId:'one',hasAttachments:false,
      subject:'제품 영상 견적',receivedDateTime:'2026-11-20T00:00:00Z',uniqueBody:{contentType:'html',content:markup}}});
    const reasons=[];naver.htmlText(markup,reasons);
    assert.equal(original.partial,partial);assert.equal(mail.partialBody,partial);assert.equal(graph.partialBody,partial);assert.equal(Boolean(reasons.length),partial);
    for(const entry of [mail,graph]){const facts=inspectThread([entry]).quoteRequest;assert.equal(facts?.quantity??null,partial?null:3);}
  }
  const sent=gMessage('sent','견적을 보냈습니다.',['SENT'],1);
  const reply=attrs=>({...gMessage('thanks','감사합니다.',[],2),payload:{headers:sent.payload.headers,mimeType:'multipart/related',parts:[{mimeType:'text/html',
    body:{data:Buffer.from('<p>감사합니다.</p><img src="cid:brand-logo" '+attrs+'>').toString('base64url')}},logo]}});
  assert.equal(fromThread(box,{id:'receipt',messages:[sent,reply('alt="" role="presentation"')]}).status,'waiting');
  const unknown=fromThread(box,{id:'receipt',messages:[sent,reply('')]});
  assert.equal(unknown.status,'review');assert.equal(unknown.originalRef.id,'thanks');assert.equal(unknown.quoteRequest,null);
  const changed=fromThread(box,{id:'receipt',messages:[sent,reply('alt="영상 5편으로 변경해 주세요"')]});
  assert.equal(changed.originalRef.id,'thanks');assert.equal(changed.status,'review');assert.equal(changed.quoteRequest,null);
});

test('같은 납품일은 표기와 무관하게 인식하고 무효이거나 미정으로 정정된 날짜는 회신에 쓰지 않는다',()=>{
  const {readQuoteRequest,repeatProposal}=require('../src/estimate-repeat.cjs');
  const base='제품 영상 3편 견적 부탁드립니다. 수정 1회. ';
  const same=readQuoteRequest(base+'희망 납품일은 2026년 12월 10일입니다.','희망 납품일 2026-12-10 견적 문의');
  assert.equal(same.review,false);assert.equal(same.deadline,'2026년 12월 10일');
  assert.equal(readQuoteRequest(base+'희망 납품일은 12월 4일입니다.','희망 납품일 12월4일 견적 문의').review,false);
  assert.equal(readQuoteRequest(base+'희망 납품일은 2026년 12월 10일입니다.','납기 2026-12-10 견적 문의').deadline,'');
  const options={...fields,scope:'제품 영상',repeatMethod:{unit:'편',includedRevisions:1}};
  for(const change of ['희망 납품일은 11월 31일입니다.','날짜는 미정입니다.']){
    const facts=readQuoteRequest(base+'납기는 12월 4일까지입니다. 정정합니다. '+change,'제품 영상 견적');
    assert.equal(facts.review,true);assert.equal(facts.deadline,'');assert.equal(Boolean(facts.deadlineIsLimit),false);
    const proposal=repeatProposal(options,{subject:'제품 영상 견적',quoteRequest:facts},{},quoteFields);
    assert.doesNotMatch(proposal.replyDraft+' '+proposal.notes.join(' '),/12월 4일/);
  }
  const corrected=readQuoteRequest(base+'납기는 12월 4일까지입니다. 정정합니다. 희망 납품일은 12월 6일입니다.','제품 영상 견적');
  assert.equal(corrected.review,true);assert.equal(corrected.deadline,'12월 6일');assert.equal(Boolean(corrected.deadlineIsLimit),false);
  assert.doesNotMatch(repeatProposal(options,{subject:'제품 영상 견적',quoteRequest:corrected},{},quoteFields).replyDraft,/12월 4일/);
  assert.equal(readQuoteRequest(base+'납기는 2028-02-29입니다.','제품 영상 견적').deadlineIsLimit,true);
});

test('항목을 밝힌 정정과 제목의 행사일·수정 횟수를 이번 납품 조건과 구분한다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const base='행사 영상 1편 견적을 부탁드립니다. 수정 1회. ';
  const read=(body,title='행사 영상 견적')=>readQuoteRequest(base+body,title);
  assert.equal(read('정정합니다. • 수정 2회로 변경합니다.').revisions,2);
  const hope=read('납기는 12월 4일까지입니다. 정정합니다. 12월 10일을 희망합니다.');
  assert.equal(hope.deadline,'12월 10일');assert.equal(Boolean(hope.deadlineIsLimit),false);
  const event=read('희망 납품일은 12월 4일입니다.','행사일 12월 10일 · 행사 영상 견적');
  assert.equal(event.deadline,'12월 4일');assert.doesNotMatch(event.conditionConflict||'',/납품일/);
  const caption=readQuoteRequest('행사 영상 1편 견적을 부탁드립니다. 수정 2회입니다.','[겨울 전시] 행사 영상 견적 (수정 2회)');
  assert.equal(caption.revisions,2);
  assert.doesNotMatch(caption.conditionConflict||'',/수정/);
});

test('메일의 문단 여백과 내용을 숨기는 스타일을 구분한다',()=>{
  const gmail=require('../src/estimate-gmail.cjs');
  const body='행사 영상 1편 견적 부탁드립니다. 수정 2회.';
  const part=(mimeType,text)=>({mimeType,body:{data:Buffer.from(text).toString('base64url')}});
  const read=style=>gmail.gmailMessage({...gMessage('padding',body),payload:{mimeType:'multipart/alternative',parts:[
    part('text/plain',body),part('text/html','<style>p { '+style+' }</style><p>'+body+'</p>')]}});
  assert.equal(read('margin: 0;').partialBody,false);
  assert.equal(read('margin: 0; display: none;').partialBody,true);
});

test('보낸 답장의 부탁 인사와 서명 링크는 미처리 약속으로 세지 않고 보관된 HTML 메일의 실제 질문을 읽는다',()=>{
  for(const text of ['견적서 보내드립니다. 검토 부탁드리겠습니다.','확인 부탁드리겠습니다.','잘 부탁드리겠습니다.']){
    assert.equal(inspectThread([letter('sent',2,text,{outgoing:true})]).status,'waiting');
  }
  assert.equal(inspectThread([letter('in',1,'자료를 공유합니다. https://example.org/a?log=1',{subject:'자료'})]).status,'review');
  const item=gMessage('htm','방문해 주셔서 감사합니다.');
  delete item.labelIds;item.payload.mimeType='text/html';
  item.payload.body.data=Buffer.from('<p>납품 가능 일정을 알려주세요.</p>').toString('base64url');
  const visible=fromThread(box,{id:'html',messages:[item]});
  assert.equal(visible.status,'reply');assert.match(visible.evidence,/납품 가능 일정/);
});

test('페이지마다 받은 일을 보여 주고 다음 검사에서는 바뀐 대화만 갱신한다',t=>{
  const root=tempRoot(t);const vault=openVault({root,owner,safe});
  try{
    const id=vault.register({provider:'outlook',subject:'example',label:'studio@example.com',credential:{}});
    const msg=(ref,thread,at,text)=>({id:ref,threadId:thread,at,text,subject:'제품 영상'});
    vault.commit(id,{reset:true,messages:[msg('1','threadA',1,'견적을 보내 주세요.'),msg('2','threadB',2,'파일을 부탁드립니다.')],cursor:{phase:'scan'}});
    let result=vault.snapshot({});assert.equal(result.threads.length,2);assert.equal(result.boxes[0].checked,2);
    const waiting=result.threads.find(x=>x.request.includes('파일'));
    vault.commit(id,{complete:true,cursor:{phase:'done'}});
    vault.commit(id,{messages:[{...msg('3','threadA',3,'견적서를 첨부했습니다.'),outgoing:true}],cursor:{phase:'verify'}});
    result=vault.snapshot({});assert.equal(result.threads.length,2);assert.ok(result.threads.some(x=>x.status==='waiting'));
    vault.commit(id,{messages:[msg('4','threadB',4,'금요일에 자료를 받을 수 있을까요?')],removed:['1','3'],complete:true,cursor:{phase:'done'}});
    result=vault.snapshot({});assert.equal(result.threads.length,1);assert.equal(result.threads[0].id,waiting.id);
    assert.throws(()=>vault.runAction('handoff',{threadId:waiting.id,evidenceId:waiting.evidenceId,to:'견적 담당',next:'옛 자료 확인'}),{code:'STALE'});
  }finally{vault.close();}
});

test('추가 첨부와 삭제한 초안은 답해야 할 원문을 보존하고 보낸 견적의 수신 인사는 대기로 남긴다',()=>{
  const last=(...messages)=>inspectThread(messages);
  const req=letter('request',10,'금요일까지 알려주세요.');
  assert.equal(last(req,letter('attachment',20,'참고 자료를 추가로 첨부합니다.',{subject:'Re: 문의'})).evidenceId,req.id);
  assert.equal(last(req,letter('trash',30,'초안입니다.',{draft:true,excluded:true})).status,'reply');
  assert.equal(last(req,letter('sent',20,'견적을 첨부합니다.',{outgoing:true}),letter('receipt',30,'견적서 잘 받았습니다. 감사합니다.',{subject:'Re: 견적 문의'})).status,'waiting');
  assert.equal(last(letter('link',1,'https://example.com/file?id=1\n견적을 보내 주세요.')).evidence,'견적을 보내 주세요.');
  const sent=gMessage('sent','견적서를 보냅니다.',['SENT'],2),receipt=gMessage('thanks','',[],3);
  receipt.payload.mimeType='text/html';
  receipt.payload.body.data=Buffer.from('<p>감사합니다.</p><blockquote type="cite">견적을 부탁드립니다.</blockquote>').toString('base64url');
  assert.equal(fromThread(box,{id:'quoted',messages:[sent,receipt]}).status,'waiting');
  const inline={mimeType:'image/png',filename:'logo.png',headers:[{name:'Content-ID',value:'<brand-logo>'}],body:{attachmentId:'image'}};
  const body={mimeType:'text/html',body:{data:Buffer.from('<p>감사합니다.</p><img src="cid:brand-logo" alt="" role="presentation">').toString('base64url')}};
  const withParts=(file,html=body)=>({...receipt,payload:{...receipt.payload,mimeType:'multipart/related',parts:[html,file]}});
  const gmailMessage=require('../src/estimate-gmail.cjs').gmailMessage;
  assert.equal(gmailMessage(withParts(inline)).hasAttachments,false);
  assert.equal(fromThread(box,{id:'signed',messages:[sent,withParts(inline)]}).status,'waiting');
  assert.equal(gmailMessage(withParts({...inline,headers:[...inline.headers,{name:'Content-Disposition',value:'attachment; filename=logo.png'}]})).hasAttachments,true);
  assert.equal(gmailMessage(withParts(inline,{...body,body:{data:Buffer.from('<p>새 파일입니다.</p>').toString('base64url')}})).hasAttachments,true);
  const ack=inspectThread([req,letter('sent-ack',20,'확인했습니다. 감사합니다.',{outgoing:true})]);
  assert.equal(ack.evidenceId,req.id);assert.equal(ack.status,'reply');
  const gmailHeader='2026년 11월 22일 (일) 오후 3:10, 담당자 <studio@example.org>님이 작성:';
  const appleHeader='2026. 11. 22. 오후 3:10, 담당자 <studio@example.org> 작성:';
  for(const tail of ['\n-- \n김담당\n예시 스튜디오\n전화 02-000-0000', '\n'+gmailHeader+'\n> 앞선 문의', '\n'+appleHeader+'\n앞선 문의', '\n'+gmailHeader.replace(', ', ',\n')+'\n> 인용']){
    const result=inspectThread([req,letter('sent-ack',20,'메일 잘 받았습니다.'+tail,{outgoing:true})]);
    assert.equal(result.evidenceId,req.id,tail);
    assert.equal(result.status,'reply',tail);
  }
  for(const sign of ['김담당 드림','박가람 올림']){
    const sent=letter('signed',20,'메일 잘 받았습니다.\n감사합니다.\n'+sign,{outgoing:true});
    const general=inspectThread([req,sent]);
    assert.equal(general.status,'reply');assert.equal(general.evidenceId,req.id);
    const quote={...req,subject:'제품 영상 견적',text:'제품 영상 3편 견적 부탁드립니다. 수정은 2회입니다.'};
    const result=inspectThread([quote,sent]);
    assert.equal(result.status,'review');assert.equal(result.evidenceId,sent.id);
    assert.equal(result.quoteRequest,null);assert.equal(result.receiptReply.evidenceId,req.id);
    const known=inspectThread([req,{...sent,senderName:sign.split(' ')[0]}]);
    assert.equal(known.status,'reply');assert.equal(known.evidenceId,req.id);
    const file=inspectThread([quote,{...sent,hasAttachments:true}]);
    assert.ok(!file.receiptReply);assert.notEqual(file.status,'reply');
  }
  for(const verb of ['답장','회신']){
    const result=inspectThread([req,letter('promised',20,'메일 잘 받았습니다. 검토 후 내일까지 '+verb+'드리겠습니다.',{outgoing:true})]);
    assert.equal(result.status,'promise',verb);
  }
  const offer=inspectThread([req,letter('offer',20,'메일 잘 받았습니다.\n견적 187,000원입니다.\n김담당 드림',{outgoing:true})]);
  assert.equal(offer.status,'waiting');
  const partial=inspectThread([req,letter('sent-partial',20,'메일 잘 받았습니다.\n'+gmailHeader+'\n> '+ '인용'.repeat(9000),{outgoing:true,originalRef:{id:'sent-partial'}})]);
  assert.equal(partial.status,'review');assert.equal(partial.reading.complete,false);
  assert.equal(partial.quoteRequest,null);assert.deepEqual(partial.originalRef,{id:'sent-partial'});
  assert.match(ack.reason,/확인 답장을 보냈어요/);assert.doesNotMatch(ack.reason,/답장이 없어요/);
  const proposed=quoteFields({...fields,scope:'15초 가로 제품 영상'},{scope:'30초 세로 제품 영상',quantity:1,unit:'편',revisions:1});
  assert.match(proposed.replyDraft,/제안드리는 15초 가로 제품 영상/);
  assert.doesNotMatch(proposed.replyDraft,/요청하신 15초/);
});

test('Outlook에서 처리한 메일을 보관함으로 옮긴 뒤와 전체 재검사 도중에도 처리 표시를 유지한다',t=>{
  const root=tempRoot(t),vault=openVault({root,owner,safe});
  try{
    const id=vault.register({provider:'outlook',subject:'example',label:'studio@example.com',credential:{}});
    const request={id:'inbox-9',evidenceId:'immutable-9',threadId:'conversation',at:9,subject:'영상',text:'금요일까지 견적을 부탁드립니다.'};
    vault.commit(id,{reset:true,messages:[request],cursor:{phase:'scan'},complete:true});
    const thread=vault.snapshot({}).threads[0];
    vault.runAction('mark',{threadId:thread.id,evidenceId:thread.evidenceId});
    vault.commit(id,{removed:['inbox-9'],cursor:{phase:'verify'}});
    const moved={...request,id:'archive-9'};
    vault.commit(id,{messages:[moved],cursor:{phase:'done'},complete:true});
    assert.equal(vault.snapshot({}).threads[0].status,'done');
    vault.commit(id,{reset:true,messages:[{...request,id:'first-2',evidenceId:'older',at:2}],cursor:{phase:'scan'}});
    assert.equal(vault.snapshot({}).threads[0].status,'done');
    vault.commit(id,{messages:[moved],cursor:{phase:'done'},complete:true});
    assert.equal(vault.snapshot({}).threads[0].status,'done');
  }finally{vault.close();}
});

test('네이버 재검사가 일부만 끝나면 이전 문의를 보존하고 전체 검사가 끝나야 정리한다',t=>{
  const vault=openVault({root:tempRoot(t),owner,safe});
  try {
    const id=vault.register({provider:'naver',subject:'mailbox',label:'studio@example.org',credential:{}});
    const original={id:'old-message',threadId:'old-thread',at:9,subject:'영상 문의',text:'견적을 부탁드립니다.'};
    vault.commit(id,{reset:true,messages:[original],cursor:{phase:'done'},complete:true});
    const before=vault.snapshot({}).threads[0];
    vault.commit(id,{reset:true,messages:[],cursor:{phase:'done'},complete:true,coverage:{partial:true}});
    const partial=vault.snapshot({});
    assert.equal(partial.boxes[0].phase,'partial');
    assert.equal(partial.threads[0].id,before.id);
    assert.equal(partial.threads[0].awaitingEvidence,true);
    assert.equal(partial.threads[0].evidenceId,'');
    vault.commit(id,{reset:true,messages:[],cursor:{phase:'done'},complete:true,coverage:{partial:false}});
    assert.equal(vault.snapshot({}).threads.length,0);
  } finally {vault.close();}
});

test('견적은 수량·수정시간·간접비·세금을 구별하고 모르는 금액을 0원으로 쓰지 않는다',()=>{
  const q=quoteFields(fields);assert.equal(q.subtotal,170000);assert.equal(q.tax,17000);assert.equal(q.total,187000);
  assert.equal(quoteFields({...fields,quantity:3,allocation:10000}).subtotal,520000);
  assert.equal(quoteFields({...fields,taxMode:'undecided'}).total,null);
  assert.throws(()=>quoteFields({...fields,quantity:''}));assert.throws(()=>quoteFields({...fields,directCost:''}));
  assert.equal(quoteFields({...fields,buildMinutes:1,revisionMinutes:0,hourlyRate:91,directCost:0}).subtotal,2);
});
test('인용 밑의 새 요청, 바뀐 제목, 변경 수량과 자동 안내 다음 줄에서 실제 근거를 고른다',()=>{
  const {htmlText}=require('../src/estimate-naver.cjs');
  const current=htmlText('<blockquote><div>기존 견적을 부탁드립니다.</div></blockquote><p>수정본 납품일을 알려주세요.</p>');
  assert.equal(inspectThread([letter('1',1,current)]).evidence,'수정본 납품일을 알려주세요.');
  const inline=htmlText('<p>시안을 확인했습니다.</p><div class="gmail_quote"><div class="gmail_attr">On Monday someone wrote:</div><blockquote>지난 단가를 알려 주세요.</blockquote><p>60개 기준으로 견적서를 보내 주세요.</p></div>');
  assert.equal(inspectThread([letter('inline',1,inline)]).evidence,'60개 기준으로 견적서를 보내 주세요.');
  const quoted='<blockquote>이전 견적을 보내 주세요.</blockquote>';
  const inlinePlain=htmlText('<div class="gmail_quote">On Monday a customer wrote:'+quoted+'60개로 견적서를 보내 주세요.</div>');
  assert.equal(inspectThread([letter('inline2',1,inlinePlain)]).evidence,'60개로 견적서를 보내 주세요.');
  const inlineBreak=htmlText('<div class="gmail_quote"><p>On Monday a customer wrote:<br>'+quoted+'</p>60개로 견적서를 보내 주세요.</div>');
  assert.equal(inspectThread([letter('inline3',1,inlineBreak)]).evidence,'60개로 견적서를 보내 주세요.');
  const english=htmlText('<div class="gmail_quote">On Monday a customer wrote:<br>'+quoted+'<p>Thanks. <b>On the updated order, could you quote 60 units? Here is what our buyer wrote:</b> Use the proof from last week.</p></div>');
  assert.match(inspectThread([letter('inline4',1,english)]).evidence,/quote 60 units/);
  const nested=htmlText('<p>시안을 확인했습니다.</p><div class="gmail_quote">On Monday a customer wrote:<br><div>'+quoted+'60개로 견적서를 보내 주세요.</div></div>');
  assert.equal(inspectThread([letter('nested',1,nested)]).evidence,'60개로 견적서를 보내 주세요.');
  const forwarded=htmlText('<p>시안을 확인했습니다.</p><div class="gmail_quote"><div class="gmail_attr">Forwarded message</div>60개 기준으로 견적서를 보내 주세요.<div class="gmail_quote">'+quoted+'</div></div>');
  assert.doesNotMatch(forwarded,/60개|보내 주세요/);
  const malformed=htmlText('<p>감사합니다.</p><blockquote><div>이전 자료</blockquote><p>60개로 견적서를 보내 주세요.</p>');
  assert.match(inspectThread([letter('malformed',1,malformed)]).evidence,/60개/);
  assert.equal(inspectThread([letter('form',1,'보낸 사람: 작업실\n견적서를 보내 주세요.',{subject:'디자인 건'})]).status,'reply');
  assert.equal(inspectThread([letter('form2',1,'보낸 사람: 작업실\n제목: 디자인 건\n견적서를 보내 주세요.',{subject:'디자인 건'})]).status,'reply');
  assert.equal(inspectThread([letter('form3',1,'안녕하세요.\n보낸 사람: 제작자\n회사: 작업실\n날짜: 미정\n견적서를 보내 주세요.',{subject:'디자인 건'})]).status,'reply');
  const eventForm='보낸 사람: 제작자 (team@example.org)\n제목: 행사 디자인\n날짜: 12월 3일\n회사: 작업실\n견적서를 보내 주세요.';
  assert.equal(inspectThread([letter('form4',1,eventForm,{subject:'디자인 건'})]).status,'reply');
  assert.equal(inspectThread([letter('form5',1,eventForm.replace('12월 3일','미정'),{subject:'디자인 건'})]).status,'reply');
  const inlineDate='시안을 확인했습니다.\nFrom: Design Team 11/20/2026 10:17 AM\nTo: Design Team\nCc: Sales Team\nSubject: Re: Design\n견적서를 보내 주세요.';
  assert.doesNotMatch(inspectThread([letter('headerDate',1,inlineDate,{subject:'디자인 건'})]).evidence,/견적서를 보내/);
  const noRecipient='시안을 확인했습니다.\nFrom: Design <design@example.org>\nDate: November 20, 2026\nSubject: Re: Design\n견적서를 보내 주세요.';
  assert.doesNotMatch(inspectThread([letter('noRecipient',1,noRecipient,{subject:'디자인 건'})]).evidence,/견적서를 보내/);
  const dateInEmail='안녕하세요.\n보낸 사람: 행사팀 (project+2026-11-20@example.org)\n받는 사람: 디자인팀\n회사: 작업실\n견적서를 보내 주세요.';
  assert.equal(inspectThread([letter('dateInEmail',1,dateInEmail,{subject:'디자인 건'})]).status,'reply');
  const fullHeader='From: a@example.org\nTo: b@example.org\n\nDate: November 20, 2026\nSubject: Design\n견적서를 보내 주세요.';
  assert.doesNotMatch(inspectThread([letter('blank',1,fullHeader,{subject:'디자인 건'})]).evidence,/견적서를 보내/);
  const history='시안을 확인했습니다.\n보낸 사람: 작업실\n날 짜(Date): 2026-11-20\n수신: 제작팀\n제목: 디자인 건\n견적서를 보내 주세요.';
  assert.doesNotMatch(inspectThread([letter('kr',1,history,{subject:'디자인 건'})]).evidence,/견적서/);
  const sent=letter('s',1,'견적서를 보냅니다.',{outgoing:true,subject:'Re: 첫 문의'});
  const changed=inspectThread([sent,letter('n',2,'수량은 60개입니다.',{subject:'Re: 수정 견적을 보내 주세요'})]);
  assert.equal(changed.status,'reply');assert.match(changed.evidence,/수정 견적.*60개/);
  const oldTitle='견적 부탁드립니다';
  for(const prefix of ['회신: ','전달: ','[외부] RE: ','[External] Fwd: ','RE: [외부] ','RE[2]: ']){
    const receipt=inspectThread([letter('ask',1,'견적 부탁드립니다.',{subject:oldTitle}),
      letter('s',2,'견적서를 보냈습니다.',{subject:oldTitle,outgoing:true}),letter('thanks',3,'감사합니다.',{subject:prefix+oldTitle})]);
    assert.equal(receipt.status,'waiting');
  }
  const detail=inspectThread([letter('m',2,'확인 부탁드립니다. 기존 10개 견적을 60개 기준으로 바꿔 주세요.')]);
  assert.match(detail.evidence,/60개/);
  const footer=inspectThread([letter('footer',1,'Please do not reply. Submit your request on the portal.\n견적서를 보내 주세요.')]);
  assert.equal(footer.evidence,'견적서를 보내 주세요.');
});
test('부모만 참조하는 네이버 회신 세 통을 도착 순서와 관계없이 한 대화로 묶는다',t=>{
  const vault=openVault({root:tempRoot(t),owner,safe});
  const {naverMessage}=require('../src/estimate-naver.cjs');
  const id=vault.register({provider:'naver',subject:'test',label:'me@example.com',credential:{}});
  const make=(key,parent,day,role,text)=>naverMessage({boxId:id,folder:{raw:role,role},uid:day,uidvalidity:1,me:'me@example.com',record:{
    internalDate:'0'+day+'-Nov-2026 09:00:00 +0900',raw:Buffer.from(['From: '+(role==='sent'?'me':'customer')+'@example.com','To: me@example.com',
      'Message-ID: <'+key+'@example.com>',...(parent?['In-Reply-To: <'+parent+'@example.com>']:[]),'Subject: Video','Content-Type: text/plain; charset=utf-8','',text].join('\r\n'))}});
  try{
    const a=make('a','',1,'inbox','견적 부탁드립니다.'),b=make('b','a',2,'inbox','수량을 추가할 수 있을까요?'),c=make('c','b',3,'sent','말씀하신 수량으로 견적서를 보냈습니다.');
    vault.commit(id,{reset:true,messages:[c,a],cursor:{phase:'scan'}});
    vault.commit(id,{messages:[b],complete:true,cursor:{phase:'done'}});
    const threads=vault.snapshot({}).threads;assert.equal(threads.length,1);assert.equal(threads[0].status,'waiting');
    const legacy=vault.register({provider:'naver',subject:'legacy',label:'old@example.org',credential:{}});
    vault.commit(legacy,{reset:true,messages:[a,b,c].map(({threadLinks,...message})=>message),complete:true,cursor:{}});
    const previouslySplit=vault.snapshot({}).threads.find(thread=>thread.boxId===legacy&&thread.status==='waiting');
    vault.runAction('quote',{threadId:previouslySplit.id,evidenceId:previouslySplit.evidenceId,...fields});
    vault.commit(legacy,{reset:true,messages:[a,b,c],complete:true,cursor:{}});
    const now=vault.snapshot({}),combined=now.threads.filter(thread=>thread.boxId===legacy);
    assert.equal(combined.length,1);assert.equal(now.quotes[0].threadId,combined[0].id);
    const raw=Buffer.from('From: me@example.com\r\nTo: client@example.com\r\nMessage-ID: <other@example.com>\r\nSubject: Video\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n검토 부탁드립니다.');
    const fromFolder=role=>naverMessage({boxId:id,folder:{raw:role,role},uid:7,uidvalidity:1,me:'me@example.com',
      record:{internalDate:'04-Nov-2026 09:00:00 +0900',raw}});
    const archive=fromFolder('archive'),sent=fromFolder('sent');
    vault.commit(id,{messages:[archive],cursor:{}});
    assert.equal(vault.snapshot({}).threads.find(thread=>thread.evidence.includes('검토')).status,'review');
    vault.commit(id,{messages:[sent],cursor:{}});
    vault.commit(id,{removed:[sent.id],messages:[archive],complete:true,cursor:{}});
    assert.equal(vault.snapshot({}).threads.find(thread=>thread.evidence.includes('검토')).status,'waiting');
  }finally{vault.close();}
});
test('Outlook에서 발송이 확인된 답장을 보관해도 재촉하지 않고, 같은 메일의 앞 판 완료 표시를 보존한다',t=>{
  const vault=openVault({root:tempRoot(t),owner,safe});
  const id=vault.register({provider:'outlook',subject:'test',label:'me@example.com',credential:{}});
  try{
    const base={id:'in-A',threadId:'A',at:10,subject:'영상',text:'견적 부탁드립니다.'};
    vault.commit(id,{reset:true,messages:[base],complete:true,cursor:{}});
    const first=vault.snapshot({}).threads[0];vault.runAction('mark',{threadId:first.id,evidenceId:first.evidenceId});
    vault.commit(id,{messages:[{...base,evidenceId:'immutable-in'}],complete:true,cursor:{}});
    assert.equal(vault.snapshot({}).threads[0].status,'done');
    const sent={id:'sent-A',evidenceId:'immutable-A',threadId:'A',at:20,subject:'영상',text:'추가 자료를 첨부했습니다.',outgoing:true};
    vault.commit(id,{messages:[sent],complete:true,cursor:{}});
    vault.commit(id,{removed:['sent-A'],cursor:{}});
    const archive={...sent,id:'archive-A',outgoing:false,possibleSelf:false,uncertain:'보낸 사람 확인'};
    vault.commit(id,{messages:[archive],complete:true,cursor:{}});
    assert.equal(vault.snapshot({}).threads[0].status,'waiting');
    vault.commit(id,{messages:[{...archive,id:'other',evidenceId:'unseen-self',at:30}],complete:true,cursor:{}});
    assert.equal(vault.snapshot({}).threads[0].status,'review');
  }finally{vault.close();}
});
test('보관 메일, 별칭에서 보낸 편지, 후속 요청, 미발송 초안과 자동응답을 대조한다',()=>{
  const raw={id:'thread1',messages:[
    clientMail('m1','30초 영상의 견적을 부탁드립니다.',[],1),
    clientMail('m2','견적을 첨부합니다.',['SENT'],2),
    clientMail('m3','납품 일정도 알려주세요.',[],3),
    clientMail('m4','일정을 확인하고',['DRAFT'],4),
  ]};
  const a=fromThread(box,raw);assert.equal(a.status,'draft');assert.equal(a.kind,'quote');assert.equal(a.evidenceId,'m3');
  assert.equal(fromThread(box,{...raw,messages:raw.messages.slice(0,2)}).status,'waiting');
  const ask=letter('a',1,'파일을 다시 보내주세요.');
  assert.equal(inspectThread([ask,letter('b',2,'감사합니다')]).evidenceId,'a');
  assert.equal(inspectThread([ask,letter('c',3,'복귀하면 답변하겠습니다.',{automatic:true})]).evidenceId,'a');
  assert.equal(inspectThread([ask,letter('d',4,'내일 보내드리겠습니다.',{outgoing:true})]).status,'promise');
});
test('일반 업무 문의와 견적 문의 모두를 모으고 견적 판본과 수신 담당자가 이어진다',async()=>{
  const api=createDemo();let {data}=await api.snapshot();
  assert.deepEqual(data.boxes.map(b=>b.provider),['gmail','naver','outlook']);
  assert.ok(data.threads.some(t=>t.kind==='general'&&t.status==='reply'));
  const t=data.threads.find(t=>t.kind==='quote'&&t.status==='reply');
  const q={threadId:t.id,evidenceId:t.evidenceId,...fields,referenceId:data.jobs[0].id};
  for(let i=0;i<2;i++)assert.ok((await api.action('quote',q)).ok);
  const h={threadId:t.id,evidenceId:t.evidenceId,to:'디자인 담당',conditions:'수정 1회 승인',next:'금요일 시안 준비',reference:'승인 시안 1'};
  await api.action('handoff',h);({data}=await api.action('handoff',h));
  assert.equal(data.quotes.length,1);assert.equal(data.handoffs.length,1);assert.equal(data.handoffs[0].quoteId,data.quotes[0].id);
  assert.equal(data.handoffs[0].request,t.request);
  assert.equal(data.handoffs[0].excerpt,t.evidence);
  assert.equal((await api.action('finish',{id:data.handoffs[0].id})).ok,false);
  await api.action('accept',{id:data.handoffs[0].id});({data}=await api.action('finish',{id:data.handoffs[0].id}));
  assert.equal(data.handoffs[0].status,'done');
  await api.action('quote',{...q,terms:'수정 2회'});
  ({data}=await api.snapshot());assert.equal(data.quotes[0].version,2);assert.equal(data.quotes[1].terms,'수정 1회');
});
test('Gmail은 마지막 목록, 상세 조회와 검사 중 받은 변경분까지 확인하고 실패한 페이지를 이어간다',async()=>{
  let fail=true;const calls=[],commits=[];
  const api={profile:async()=>({historyId:'10',emailAddress:box.label}),threads:async page=>{
    calls.push(page||'first');return page?{threads:[{id:'b'}]}:{threads:[{id:'a'}],nextPageToken:'page2'};
  },thread:async id=>{if(id==='b'&&fail)throw Error('network');return {id,messages:[gMessage('m'+id,'답변을 부탁드립니다.')]};},
  history:async start=>{assert.equal(start,'10');return {historyId:'18',history:[{messagesAdded:[{message:{threadId:'c'}}]}]};}};
  await assert.rejects(()=>scanGmail({box,api,commit:p=>commits.push(p)}));assert.ok(!commits.some(p=>p.complete));
  fail=false;await scanGmail({box:{...box,cursor:commits.at(-1).cursor},api,commit:p=>commits.push(p)});
  assert.deepEqual(calls,['first','page2','page2']);assert.deepEqual(commits.flatMap(p=>p.records.map(x=>x.id)).sort(),['a','b','c'].map(id=>localThreadId(box.id,id)).sort());
  assert.equal(commits.at(-1).cursor.start,'18');assert.equal(commits.at(-1).complete,true);
});
test('등록한 Gmail 계정과 다른 프로필이면 메일을 열지 않는다',async()=>{
  await assert.rejects(()=>scanGmail({box,api:{profile:async()=>({historyId:'11',emailAddress:'other@example.org'})},commit:()=>assert.fail()}),{code:'MAIL_AUTH'});
  const urls=[];const api=createGmailApi({access:async()=>'fake',fetcher:async(url,options)=>{
    assert.equal(options.redirect,'error');urls.push(url);return new Response('{}');}});
  await api.threads('opaque');assert.equal(urls[0].origin,'https://gmail.googleapis.com');assert.equal(urls[0].searchParams.get('includeSpamTrash'),'true');
});
test('회원별 암호화 저장과 로컬 인계는 재시작 뒤에도 유지되고 연결 해제는 그 업무함 자료만 지운다',t=>{
  const root=tempRoot(t);let v=openVault({root,owner,safe});let second;
  try{
    const id=v.register({provider:'gmail',subject:box.label,label:box.label,credential:{refresh:'synthetic-secret-marker'}});
    const t1={...fromThread({...box,id},{id:'a',messages:[gMessage('a1','원본표식123 견적을 부탁합니다.')]})};
    v.commit(id,{records:[{id:t1.id,value:t1}],cursor:{mode:'history',start:'21',generation:1},complete:true});
    const current={threadId:t1.id,evidenceId:v.snapshot({}).threads[0].evidenceId};
    for(const action of ['quote','handoff','mark'])assert.throws(()=>v.runAction(action,{threadId:t1.id,...fields}),{code:'STALE'});
    v.runAction('quote',{...current,...fields});v.runAction('handoff',{...current,to:'견적 담당',next:'범위 확인'});
    v.runAction('mark',current);v.close();v=openVault({root,owner,safe});second=openVault({root,owner:other,safe});
    assert.equal(v.snapshot({}).threads[0].status,'done');assert.equal(v.snapshot({}).handoffs.length,1);assert.equal(second.snapshot({}).threads.length,0);
    const bytes=fs.readFileSync(path.join(root,fs.readdirSync(root).find(n=>n===crypto.createHash('sha256').update(owner).digest('hex')),'work.sqlite'));
    assert.equal(bytes.includes(Buffer.from('synthetic-secret-marker')),false);assert.equal(bytes.includes(Buffer.from('원본표식123')),false);
    v.commit(id,{records:[{id:t1.id,value:{...t1,evidenceId:'new',status:'reply'}}],cursor:{generation:1}});
    assert.equal(v.snapshot({}).threads[0].status,'reply');v.forget(id);assert.equal(v.snapshot({}).quotes.length,0);assert.equal(v.snapshot({}).handoffs.length,0);
  }finally{v.close();second?.close();}
});
test('보호 저장소 실패와 로그아웃 뒤 요청을 거절한다',async t=>{
  const root=tempRoot(t);
  assert.throws(()=>openVault({root,owner,safe:{isEncryptionAvailable:()=>false}}),{code:'SECURE_STORAGE'});
  let current=true;
  const svc=createEstimateService({root,owner,safe,isCurrent:()=>current,readConfig:async()=>({}),openExternal:()=>assert.fail()});
  const snap=await svc.snapshot();assert.deepEqual(snap.data.boxes,[]);assert.deepEqual(snap.data.capabilities.readyProviders,['naver']);
  assert.equal((await svc.action('connect',{provider:'gmail'})).code,'CONFIG');
  current=false;assert.equal((await svc.snapshot()).code,'AUTH_CHANGED');svc.close();
});


test('두 거래처의 견적에서 단가와 답장 형식을 기억하고 새 수량·수정 횟수·납기를 구별한다', async () => {
  const api = createDemo();
  const initial = (await api.snapshot()).data;
  const a = initial.threads.find(t => t.subject.includes('다온전시'));
  const b = initial.threads.find(t => t.subject.includes('파도문구'));
  const at = t => ({ threadId:t.id, evidenceId:t.evidenceId });
  let result = await api.action('quote', { ...fields, ...at(a), title:'다온 단독', scope:'30초 세로 제품 영상', terms:'다온전시 전용 시사회', deadline:'12월 4일', replyFormat:'items' });
  const first = result.data.quotes[0];
  assert.equal(first.total,187000);
  assert.match(first.replyDraft,/제품 영상 1편 기준/);
  assert.match(first.replyDraft,/메일에서 요청하신 수정 횟수는 1회입니다/);
  assert.match(first.replyDraft,/진행 조건은 다음과 같습니다\. 다온전시 전용 시사회/);
  assert.doesNotMatch(first.replyDraft,/수정 조건.*시사회/);
  assert.ok(first.replyDraft.includes('•'));
  assert.equal((await api.action('repeatPreview', { ...at(b), methodId:first.id })).code,'STALE');
  const remember = { ...at(a), quoteId:first.id, expectedMethodId:'', unit:'편', includedRevisions:1 };
  result = await api.action('rememberQuote', remember);
  const methodId = result.data.quotes[0].repeatMethod.id;
  assert.equal((await api.action('rememberQuote', remember)).data.quotes[0].repeatMethod.id,methodId);
  assert.equal((await api.action('repeatPreview', { ...at(a), methodId })).code,'VALUE');
  const request = { ...at(b), methodId };
  const before = (await api.action('repeatPreview', request)).preview;
  assert.ok(before.needsRevisionMinutes);
  assert.equal(before.canSave,false);
  assert.equal(before.needsTitleConfirmation,true);
  assert.match(before.notes.join(' '),/수정 1회 기준.*2회/);
  assert.match(before.replyDraft,/3편/);
  assert.match(before.replyDraft,/수정 횟수는 2회/);
  assert.deepEqual(before.replyDraft.match(/[^.\n•]*까요\?/g)?.map(s=>s.trim()),['희망 납품일을 알려주실 수 있을까요?']);
  assert.doesNotMatch(before.replyDraft,/다온|시사회|12월 4일|187,000|[0-9,]+원/);
  assert.equal((await api.action('saveRepeatedQuote',{...request,expectedDraft:before.replyDraft})).code,'STALE');
  const adjusted = { ...request, revisionMinutes:120, confirmedTitle:true, titleConfirmationKey:before.titleConfirmationKey };
  const preview = (await api.action('repeatPreview',adjusted)).preview;
  assert.ok(preview.canSave);
  assert.match(preview.replyDraft,/660,000원.*726,000원/);
  assert.match(preview.replyDraft,/•/);
  const save = { ...adjusted,previewKey:preview.previewKey,expectedQuoteId:preview.expectedQuoteId,expectedDraft:preview.replyDraft };
  result = await api.action('saveRepeatedQuote',save);
  const second = result.data.quotes[0];
  assert.deepEqual([second.threadId,second.quantity,second.subtotal,second.tax,second.total,second.deadline],[b.id,3,660000,66000,726000,'']);
  assert.equal(second.replyDraft,preview.replyDraft);
  assert.equal(second.replyFormat,first.replyFormat);
  assert.deepEqual([second.sourceQuoteId,second.sourceIncludedRevisions,second.sourceRevisionMinutes],[first.id,1,60]);
  assert.equal((await api.action('saveRepeatedQuote',save)).data.quotes.length,2);
  assert.equal((await api.action('saveRepeatedQuote',{...save,revisionMinutes:1})).code,'STALE');
  assert.deepEqual((await api.snapshot()).data.quotes[1].replyDraft,first.replyDraft);
});

test('문의 한 통에서 확인할 수 있는 조건만 가격에 쓰며, 서명·추가 금액 조건·불명확한 수량은 확인한다', () => {
  const state=sampleState();
  const source=state.threads.find(t=>t.subject.includes('다온전시'));
  const basic={threadId:source.id,evidenceId:source.evidenceId};
  let seq=0;
  const run=(name,input)=>updateJob(state,name,input,()=>String(++seq),100);
  run('quote',{...fields,...basic,scope:'30초 세로 제품 영상',allocation:10000});
  run('rememberQuote',{...basic,quoteId:state.quotes[0].id,unit:'편',includedRevisions:1,expectedMethodId:''});
  const methodId=state.quotes[0].repeatMethod.id;
  function open(text,extra={}) {
    const data=inspectThread([letter('e',10,text,{subject:'새 견적 문의',...extra})]);
    const thread={...data,id:'target',boxId:'new-box'};
    state.threads=state.threads.filter(t=>t.id!==thread.id).concat(thread);
    return {threadId:thread.id,evidenceId:thread.evidenceId,methodId};
  }
  for(const text of ['30초 세로 제품 영상 2~3편 견적 부탁드립니다.', '60초 가로 제품 영상 3편 견적을 부탁드립니다.',
    '30초 세로 제품 영상 3편 정도 견적을 부탁드립니다.', '30초 세로 제품 영상 3편 견적을 부탁드립니다. 단, 할인 10%를 요청합니다.',
    '품목: 30초 세로 제품 영상\n수량: 3편\n수량: 4편\n견적을 부탁드립니다.',
    '30초 세로 제품 영상 3편 견적을 부탁드립니다. 인쇄물 두 장도 부탁드립니다.']) {
    assert.equal(titled(x=>run('repeatPreview',x),{...open(text+' 수정 1회.'),allocation:0}).canSave,false,text);
  }
  const long='안녕하세요.\n'.repeat(45)+'30초 세로 제품 영상 3편 견적을 부탁드립니다.\n수정 1회.\n희망 납품일은 12월 15일입니다.';
  const input=open(long);
  const partial=titled(x=>run('repeatPreview',x),input);
  assert.equal(partial.canSave,false);assert.ok(partial.needsAllocation);
  const allowed=titled(x=>run('repeatPreview',x),{...input,allocation:0});
  assert.ok(allowed.canSave);assert.match(allowed.replyDraft,/561,000원/);
  assert.match(allowed.replyDraft,/12월 15일/);assert.doesNotMatch(allowed.replyDraft,/납품일을 알려/);
  assert.equal(titled(x=>run('repeatPreview',x),{...open(long,{partialBody:true}),allocation:0}).canSave,false);
  for (const subject of ['긴급 영상 견적','예산 50만원 이내','부가세 포함','12/4까지 견적 요청','새 견적 문의 (수정: 2회)']) {
    const inSubject = open('30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.', {subject});
    assert.equal(titled(x=>run('repeatPreview',x),{...inSubject,allocation:0}).canSave,false,subject);
  }
  const accurate=open('30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.', {subject:'세부 견적 문의 (수정: 1회)'});
  assert.ok(titled(x=>run('repeatPreview',x),{...accurate,allocation:0}).canSave);
  for (const [subject,allowed] of [
    ['새 견적 문의 (수정 1회 초과)',false],['새 견적 문의 (수정 한 회)',true],
    ['[문의번호 20261121] 새 견적 문의',true],['새 견적 문의 (수정 1회 포함)',true],
    ['영상 견적 (수정 최대 1회)',false],['영상 3편 미만 견적',false]
  ]) {
    const current=open('30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 한회.',{subject});
    assert.equal(titled(x=>run('repeatPreview',x),{...current,allocation:0}).canSave,allowed,subject);
  }
  for (const [title,allowed] of [
    ['영상 3편 (수정 1회) 견적 문의',true],['이상민님 영상 견적 문의',true],
    ['수정 1회 포함, 편집 원본 파일 제공 필수',false],['수정 1회 포함, 텍스트용 별도 파일',false],
    ['영상 한편 견적 문의',false],['영상 두편에 대한 견적 문의',false],['영상 3편부터 견적',false]
  ]) {
    const inquiry=open('30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.',{subject:title});
    assert.equal(titled(x=>run('repeatPreview',x),{...inquiry,allocation:0}).canSave,allowed,title);
  }
  for (const [word,qty] of [['한',1],['두',2],['세',3],['네',4]]) {
    for (const space of ['',' ']) {
      for (const tail of ['의 견적 문의','에 대한 견적 문의',' 문의드립니다',' 견적문의',' 견적서 요청',' (수정 1회) 견적']) {
        const title='영상 '+word+space+'편'+tail;
        for(const quantity of [qty,qty+1]){
          const inquiry=open('30초 세로 제품 영상 '+quantity+'편 견적을 부탁드립니다. 수정 1회.',{subject:title});
          assert.equal(titled(x=>run('repeatPreview',x),{...inquiry,allocation:0}).canSave,quantity===qty,title+' / '+quantity);
        }
      }
    }
  }
  for (const [subject,qty,ok] of [
    ['Re: 영상 두 편 견적',3,false],['영상 ５편 견적',5,true],['영상 다섯편 견적',5,true],
    ['영상 다섯 편 견적',3,false],['영상 三편 견적',3,false],['영상 열두 편 견적',2,false],['이 건 견적',3,false],
    ['영상 3개 견적',3,false],['영상 3편, 사진 5장',3,false]
  ]) {
    const inquiry=open('30초 세로 제품 영상 '+qty+'편 견적을 부탁드립니다. 수정 1회.',{subject});
    assert.equal(titled(x=>run('repeatPreview',x),{...inquiry,allocation:0}).canSave,ok,subject);
  }
  const spacedHead='30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.';
  for (const [subject,ok] of [
    ['[솔리오] 영상 3편 견적 문의',true],['[외부] 영상 견적 문의',true],['(주)솔리오 영상 견적 문의',true],
    ['[견적] 영상 3편 제작 요청',true],['영상 견적 문의 (홍길동)',false],['안녕하세요, 영상 견적 문의드립니다',true],
    ['영상 3편 (수정 1회로 부탁드립니다) 견적 문의합니다',true],['영상 3편 - 견적 문의',true],
    ['간단한 편집 영상 견적 문의',false],['영상에 대한 편집 견적 문의',false],['이상민님 영상 견적 문의',true],
    ['영상 3편 이상민님 견적 문의',true],['김필수님 영상 견적 문의',true],
    ['영상 3편을 넘는 물량 견적 문의',false],['영상 견적 문의 수정 1회 포함 및 썸네일 제작',false],
    ['템플릿 3개월 사용권 견적 문의',false],['영상 쉰 편 견적 문의',false]
  ]) {
    const inquiry=open(spacedHead,{subject});
    assert.equal(titled(x=>run('repeatPreview',x),{...inquiry,allocation:0}).canSave,ok,subject);
  }
  const ambiguous=open(spacedHead,{subject:'푸른 바람 프로젝트 견적 문의'});
  const { readQuoteRequest }=require('../src/estimate-repeat.cjs');
  for(const subject of ['영상 3편 견적 [3편 이상]','영상 3편 견적 (3편 이상)','영상 견적 (편집 원본 파일 제공 필수)']){
    assert.ok(readQuoteRequest(spacedHead,subject).review,subject);
  }
  for(const subject of ['영상 세부 사항 문의','영상 세부 내용 견적 문의','세부 일정 견적 문의','세종 매장 영상 견적 문의','영상 3편 대표님 견적 부탁드립니다']){
    assert.equal(readQuoteRequest(spacedHead,subject).review,false,subject);
  }
  for(const [body,subject,verdict,sender] of [
    ['버전 1 제품 영상 2편 견적 부탁드립니다. 수정 1회.', '버전 1 제품 영상 12편 견적 문의','conflict'],
    [spacedHead,'영상 견적 문의 (수정 1회 포함), 광고문구 제작','conflict'],
    [spacedHead,'영상 3편 (장비비) 견적 문의','conflict'],
    [spacedHead,'영상 3편 (수정 1회 미포함) 견적 문의','conflict'],
    [spacedHead,'영상 3편 무료로 제작 견적 문의','conflict'],
    [spacedHead,'제품영상3편 견적 문의','clear'],[spacedHead,'제품영상두편 견적 문의','conflict'],
    [spacedHead,'영상 두 편뿐입니다. 견적 부탁드립니다','conflict'],
    [spacedHead,'영상 이십 편 견적 문의','conflict'],[spacedHead,'영상 3편, 수정 이 회 견적 문의','conflict'],
    [spacedHead,'파도문구 영상 견적 문의 (3편, 수정 1회)','clear','파도문구'],
    ['유튜브 썸네일 3장 견적 부탁드립니다. 수정 1회.','유튜브썸네일 3장 견적 문의','clear'],
    [spacedHead,'3편-견적 문의','clear'],
  ]) {
    const actual=readQuoteRequest(body,subject,sender);
    assert.equal(actual.review?'conflict':actual.checkTitle?'confirm':'clear',verdict,subject);
  }
  for(const subject of ['영상 견적문의드립니다','영상 견적요청드립니다','영상견적 문의','영상제작 견적 문의','영상 세부견적 문의','[외부] Re: 영상 견적 문의','영상 견적 문의드립니다.']){
    const form=readQuoteRequest(spacedHead,subject);
    assert.ok(!form.review && !form.checkTitle,subject);
  }
  for(const extra of ['광고문구 제작','코팅','후가공 별도 문의']){
    const paper=readQuoteRequest('A4 브로슈어 500부 견적을 부탁드립니다. 수정 1회.','브로슈어 세부 견적 문의 (수정 1회 포함), '+extra);
    assert.ok(paper.review,extra);assert.ok(!paper.checkTitle,extra);
  }
  const person=readQuoteRequest(spacedHead,'영상 견적 문의 (담당자: 홍길동)');
  assert.ok(person.checkTitle);assert.equal(person.review,false);
  for(const subject of ['영상 견적 문의 (홍길동)','영상 견적 문의 (양면)','영상 견적 문의 (고화질)','영상 견적 문의 [최저가]',
    '영상 3편 견적 문의 (장비비) (푸른 바람 프로젝트)','(푸른 바람 프로젝트) 영상 3편 견적 문의 (장비비)',
    '영상 3편 (수정 1회 차감) 견적 문의','영상 이편만 견적 문의','영상 한편쯤 견적 문의','영상 3편 정도 견적 문의',
    '영상 견적 문의 (수정 1회 포함), 광고문구 제작 (푸른 바람 프로젝트)','영상 견적 문의 (각 3편)','본사·지점 영상 각 3편 견적','영상 3편 수정 견적',
    '영상 3편 견적 (3편 프로젝트)','영상 3편 견적 (장비비 프로젝트)','영상 3편 견적 (가로 프로젝트)','영상 3편 견적, 매장 제작 요청']){
    const parsed=readQuoteRequest(spacedHead,subject);
    assert.ok(parsed.review,subject);assert.ok(!parsed.checkTitle,subject);
  }
  for(const [body,subject,sender,expect] of [
    ['유튜브 썸네일 3장 견적 부탁드립니다. 수정 1회.','유튜브썸네일 3장 견적 문의, 매장 썸네일 3장 제작','','conflict'],
    [spacedHead,'한편 제작 견적 문의','한편','conflict'],
    [spacedHead,'파도문구 담당자 영상 견적 문의','파도문구 담당자','clear'],[spacedHead,'[파도문구] 영상 견적 문의','파도문구','clear'],
    [spacedHead,'[신상품 프로젝트] 영상 견적 문의','','confirm'],
    [spacedHead,'파도문구 영상 견적 문의 (3편·수정 1회)','파도문구','clear'],
    ['매장 홍보 영상 3편 견적 부탁드립니다. 수정 1회.','세종 매장 홍보 영상 견적 문의','','clear']
  ]) {
    const item=readQuoteRequest(body,subject,sender);
    assert.equal(item.review?'conflict':item.checkTitle?'confirm':'clear',expect,subject);
  }
  for(const subject of ['가로 영상 3편 견적 문의','영상가로 견적','영상 가 로','가로영상제작 견적문의드립니다','3편가로 견적']){
    assert.ok(readQuoteRequest(spacedHead,subject).review,subject);
  }
  for(const subject of ['영상제작 견적문의드립니다','영상 3편을 견적문의드립니다']){
    assert.equal(readQuoteRequest(spacedHead,subject).review,false,subject);
  }
  assert.equal(readQuoteRequest('SNS 영상 3편 견적을 부탁드립니다. 수정 1회.','SNS영상제작 견적 문의').review,false);
  for(const [body,subject,sender,verdict] of [
    [spacedHead,'이십 편 제작 견적 문의','이십 편','conflict'],[spacedHead,'영상 견적 문의 (이십 편 프로젝트)','','conflict'],
    [spacedHead,'영상 견적 문의 (한 편쯤 프로젝트)','','conflict'],
    ['배너 디자인 3장 견적 부탁드립니다. 수정 1회.','배너디자인 3장 견적 문의, 매장배너제작 요청','','conflict'],
    ['A4 브로슈어 500부 견적 부탁드립니다. 수정 1회.','브로슈어 세부견적 문의','','confirm'],
    ['계약 3건 견적 부탁드립니다. 수정 1회.','계약이건 견적 문의','','conflict'],
    ['동영상 플랫폼 홍보 영상 3편 견적 부탁드립니다. 수정 1회.','동영상 플랫폼 홍보 영상 3편 견적 문의','','clear'],
    ['유튜브 썸네일 디자인 3장 견적 부탁드립니다. 수정 1회.','유튜브썸네일디자인 3장 견적 문의, 매장 썸네일 제작','','conflict'],
    [spacedHead,'한빛영상 영상 견적 문의','한빛영상','clear'],[spacedHead,'[한빛영상] 영상 견적 문의','한빛영상','clear']
  ]) {
    const found=readQuoteRequest(body,subject,sender);
    assert.equal(found.review?'conflict':found.checkTitle?'confirm':'clear',verdict,subject);
  }
  for(const subject of ['계약 이 건 견적 문의','계약 이\u00a0건 견적 문의','계약 이  건 견적 문의','계약 3건 이 건의 견적 문의']){
    assert.ok(readQuoteRequest('계약 3건 견적 부탁드립니다. 수정 1회.',subject).review,subject);
  }
  for(const subject of ['영상 3편 견적을 부탁드립니다','영상 제작에 대한 견적 문의','견적서를 요청드립니다','영상 제작 건으로 문의드립니다',
    '영상 제작문의','영상 제작견적 문의','영상 견적을부탁드립니다']){
    const facts=readQuoteRequest(spacedHead,subject);
    assert.equal(facts.review,false,subject);assert.ok(!facts.checkTitle,subject);
  }
  const detailPaper='A4 브로슈어 500부 견적 부탁드립니다. 수정 1회.';
  assert.ok(readQuoteRequest(detailPaper,'브로슈어세부견적 문의').checkTitle);
  for(const subject of ['브로슈어 세 부 견적','브로슈어세부견적 600부 문의','브로슈어세부견적 문의 (코팅)']){
    assert.ok(readQuoteRequest(detailPaper,subject).review,subject);
  }
  for(const [text,subject,sender,want] of [
    ['매장 홍보 영상 3편 견적 부탁드립니다. 수정 1회.','교육영상 3편 견적 문의','교육영상','conflict'],
    ['계약 3건 견적 부탁드립니다. 수정 1회.','한 건 견적 문의','한','conflict'],
    [spacedHead,'[영상 3편] 제작 견적 문의','','clear'],[detailPaper,'[A4] 브로슈어 500부 견적 문의','','clear'],
    [detailPaper,'A4 브로슈어세부견적요청드려요','','confirm'],
    ['유튜브 썸네일 3장 견적 부탁드립니다. 수정 1회.','유튜브썸네일견적 문의','','clear'],
    [spacedHead,'영상 견적 문의 (열댓 편쯤 프로젝트)','','conflict'],[spacedHead,'이십여 편 프로젝트 견적 문의','','conflict'],
    [spacedHead,'영상 견적 문의 (이십여 편 프로젝트)','','conflict']
  ]){
    const facts=readQuoteRequest(text,subject,sender);
    assert.equal(facts.review?'conflict':facts.checkTitle?'confirm':'clear',want,subject);
  }
  for(const [text,subject,sender,want] of [
    ['계약 3건 견적 부탁드립니다. 수정 1회.','계약 이 건(제작 견적 문의)','','conflict'],
    ['계약 3건 견적 부탁드립니다. 수정 1회.','계약이 건으로 견적 문의','','conflict'],
    ['회의 영상 3편 견적 부탁드립니다. 수정 1회.','[한빛영상] 회의 영상 3편 견적 문의','한빛영상','clear'],
    ['사장 인터뷰 영상 3편 견적 부탁드립니다. 수정 1회.','사장 인터뷰 영상 3편 견적 문의','','clear'],
    [spacedHead,'[교육 클립] 3편 견적 문의','교육 클립','conflict'],[spacedHead,'[영상 3편] 제작견적 문의','','clear'],
    [spacedHead,'[이십여 편] 견적 문의','이십여 편','conflict'],
    ['계약 3건 견적 부탁드립니다. 수정 1회.','이십여 건 계약 견적 문의','이십여 건','conflict'],
    [spacedHead,'한빛상사 견적 문의드립니다','한빛상사','clear'],[spacedHead,'[한빛영상] 견적 문의','한빛영상','confirm']
  ]){
    const facts=readQuoteRequest(text,subject,sender);
    assert.equal(facts.review?'conflict':facts.checkTitle?'confirm':'clear',want,subject);
  }
  for(const qty of ['2 편', '2 편)', '2 편_', '2 편🙏', '2 편만','2 편씩','2 편입니다','2 편추가','2\u200b편','２\u3000편','2\u00a0편','2~3 편']){
    assert.ok(readQuoteRequest(spacedHead,'영상 '+qty+' 견적 문의').review,qty);
  }
  for(const [scope,quantity,subject,sender] of [
    ['기업 행사','3건','기업 행사 건으로 견적 문의',''],['영상','3편','[한빛 주식회사] 영상 3편 견적 문의','한빛 주식회사'],
    ['영상','3편','한빛 주식회사 견적 문의','한빛 주식회사'],
    ['회로 설명 영상','3편','[한빛상사] 회로 설명 영상에 대한 견적 문의','한빛상사'],
    ['회의 영상','3편','[한빛영상] 회의 영상에 대한 견적 문의','한빛영상'],
    ['사장 인터뷰 영상','3편','사장 인터뷰 영상에 대한 견적 문의',''],
    ['행사 회의 영상','3편','행사 회의 영상 견적 문의',''],
    ['매장 홍보 영상','3편','[한빛건설] 매장 홍보 영상 3편 견적 문의','한빛건설']
  ]){
    const body=scope+' '+quantity+' 견적 부탁드립니다. 수정 1회.';
    const facts=readQuoteRequest(body,subject,sender);
    assert.equal(facts.review,false,subject);assert.ok(!facts.checkTitle,subject);
    for(const extra of [', 사진 2장', ' (급행)', ' 9건', ' 수정 2회']) assert.ok(readQuoteRequest(body,subject+extra,sender).review,subject+extra);
  }
  const meetingBody='행사 회의 영상 3편 견적 부탁드립니다. 수정 1회.';
  for (const [body,subject,sender] of [
    [meetingBody,'Re: 행사 회의 영상 견적 문의',''],
    [meetingBody+' 추가 촬영도 필요합니다.','행사 회의 영상 견적 문의',''],
    [meetingBody,'[급행] 행사 회의 영상 견적 문의','급행'],
    [meetingBody,'[한빛건설] 행사 회의 영상 견적 문의','다온 주식회사'],
    [meetingBody,'[한빛건설] 한빛건설 행사 회의 영상 견적 문의','한빛건설'],
    ['영상 A1 2편 견적 부탁드립니다. 수정 1회.','영상 A 12편 견적 문의','']
  ]) assert.ok(readQuoteRequest(body,subject,sender).review,subject);
  const quoteOnly=inspectThread([letter('stale-heading',12,'이번에는 조건을 변경하려고 합니다.\n> '+meetingBody,{subject:'행사 회의 영상 견적 문의'})]);
  assert.ok(!quoteOnly.quoteRequest || quoteOnly.quoteRequest.review || quoteOnly.quoteRequest.quantity===null);
  for(const suffix of ['2','20','버전2','두','스물','이십여','열댓']){
    const text='사내 행사 '+suffix+' 3건 견적 부탁드립니다. 수정 1회.';
    assert.ok(readQuoteRequest(text,'사내 행사 '+suffix+' 건으로 견적 문의').review,suffix);
  }
  const { headerDisplayName }=require('../src/estimate-domain.cjs');
  const { gmailMessage }=require('../src/estimate-gmail.cjs');
  const companyHeader='"한빛 주식회사" <buyer@example.org>';
  const embedded='"한빛 주식회사 <다온 구매팀>" <buyer@example.org>';
  assert.equal(headerDisplayName(companyHeader),'한빛 주식회사');
  assert.equal(headerDisplayName('한빛 주식회사 <buyer@example.org>'),'한빛 주식회사');
  for(const bad of [embedded,'한빛 주식회사 <x@example.org>, 다른곳 <y@example.org>','한빛 주식회사 <buyer@example.org','buyer@example.org']){
    assert.equal(headerDisplayName(bad),'',bad);
    assert.ok(readQuoteRequest(spacedHead,'한빛 주식회사 견적 문의',bad).review,bad);
  }
  const inbound=(...headers)=>gmailMessage({id:'mail',internalDate:'1',labelIds:[],payload:{headers:headers.map(value=>({name:'From',value}))}}).senderName;
  assert.equal(inbound(companyHeader),'한빛 주식회사');assert.equal(inbound(embedded),'');assert.equal(inbound(companyHeader,companyHeader),'');
  assert.equal(readQuoteRequest(spacedHead,'한빛 주식회사 견적 문의',inbound(companyHeader)).review,false);
  for(const quantity of [2,12]){
    const item='사내 행사 2';
    const text=item+' '+quantity+'건 견적 부탁드립니다. 수정 1회.';
    assert.equal(readQuoteRequest(text,item+' '+quantity+'건 견적 문의').review,false);
  }
  const { naverMessage }=require('../src/estimate-naver.cjs');
  const imap=(...froms)=>{
    const raw=Buffer.from(froms.map(v=>'From: '+v).concat('To: me@example.org','Subject: Quote','Content-Type: text/plain; charset=utf-8','','hello').join('\r\n'));
    return naverMessage({boxId:'box',folder:{raw:'INBOX',role:'inbox'},uidvalidity:'1',uid:'1',me:'me@example.org',record:{raw,size:raw.length,flags:[],internalDate:'20-Nov-2026 00:00:00 +0000'}}).senderName;
  };
  const encoded=s=>'=?UTF-8?B?'+Buffer.from(s).toString('base64')+'?=';
  assert.equal(imap(encoded('한빛 주식회사')+' <buyer@example.org>'),'한빛 주식회사');
  assert.equal(imap(encoded('한빛 주식회사 <다온 구매팀>')+' <buyer@example.org>'),'');
  assert.equal(imap(companyHeader,companyHeader),'');
  const department='홍보부 채용 홍보 3건 견적 부탁드립니다. 수정 1회.';
  assert.equal(readQuoteRequest(department,'홍보부 채용 홍보 3건 견적 문의').review,false);
  assert.ok(readQuoteRequest(department,'홍보부 채용 홍보 4건 견적 문의').review);
  assert.equal(inbound('"한빛\t주식회사" <buyer+sales@example.co.kr>'),'한빛 주식회사');
  assert.equal(readQuoteRequest(spacedHead,'한빛 주식회사 견적 문의',inbound('"한빛\t주식회사" <buyer@example.org>')).review,false);
  for(const address of ['buyer..team@example.org','.buyer@example.org','buyer.@example.org','buyer@-example.org','buyer@example..org','buyer@example-.org']){
    const header='한빛 주식회사 <'+address+'>';
    assert.equal(headerDisplayName(header),'',address);assert.equal(inbound(header),'',address);
    assert.ok(readQuoteRequest(spacedHead,'한빛 주식회사 견적 문의',inbound(header)).review,address);
  }
  const earlyState=state.threads.find(entry=>entry.id===ambiguous.threadId);
  const latestFacts=earlyState.quoteRequest;
  const savedTitle=earlyState.subject;
  earlyState.subject='영상 견적 문의';
  earlyState.quoteRequest=readQuoteRequest(spacedHead,earlyState.subject);
  assert.ok(titled(x=>run('repeatPreview',x),{...ambiguous,allocation:0}).canSave);
  earlyState.quoteRequest={...earlyState.quoteRequest,version:0,checkTitle:true};
  const legacy=run('repeatPreview',{...ambiguous,allocation:0});
  assert.equal(legacy.canSave,false);assert.equal(legacy.needsTitleConfirmation,false);
  assert.ok(legacy.notes.some(msg=>msg.includes('견적 작성')));
  earlyState.quoteRequest=latestFacts;earlyState.subject=savedTitle;
  const brochure=readQuoteRequest('A4 브로슈어 500부 견적을 부탁드립니다. 수정 1회.','브로슈어 세부 견적 문의');
  assert.ok(brochure.checkTitle);assert.equal(brochure.review,false);
  const pending=run('repeatPreview',{...ambiguous,allocation:0});
  assert.equal(pending.canSave,false);assert.ok(pending.needsTitleConfirmation);
  const consent={confirmedTitle:true,titleConfirmationKey:pending.titleConfirmationKey};
  assert.throws(()=>run('repeatPreview',{...ambiguous,confirmedTitle:true}),{code:'STALE'});
  const reviewed=run('repeatPreview',{...ambiguous,allocation:0,...consent});
  assert.ok(reviewed.canSave);
  assert.throws(()=>run('saveRepeatedQuote',{...ambiguous,allocation:0,expectedQuoteId:'',expectedDraft:reviewed.replyDraft}),{code:'STALE'});
  run('saveRepeatedQuote',{...ambiguous,allocation:0,...consent,previewKey:reviewed.previewKey,expectedQuoteId:'',expectedDraft:reviewed.replyDraft});
  assert.ok(state.quotes[0].confirmedTitle);
  const contradiction=open(spacedHead,{subject:'영상 2편 견적'});
  const invalid=run('repeatPreview',{...contradiction,allocation:0});
  assert.equal(invalid.canSave,false);assert.equal(invalid.needsTitleConfirmation,false);assert.equal(invalid.titleConfirmationKey,'');
  assert.throws(()=>run('repeatPreview',{...contradiction,allocation:0,confirmedTitle:true,titleConfirmationKey:invalid.titleConfirmationKey}),{code:'STALE'});
  assert.throws(()=>run('repeatPreview',{...contradiction,allocation:0,...consent}),{code:'STALE'});
  for (const [subject,qty,ok] of [['영상 열두 편 견적 문의',12,true],['영상 쉰편 견적 문의',50,true],['[거래처] 영상 견적 문의',3,false],['이 부분 견적 문의',3,true]]) {
    const inquiry=open('30초 세로 제품 영상 '+qty+'편 견적을 부탁드립니다. 수정 1회.',{subject});
    assert.equal(titled(x=>run('repeatPreview',x),{...inquiry,allocation:0}).canSave,ok,subject);
  }
  const titleOnly=open('품목: 30초 세로 제품 영상\n견적을 부탁드립니다.\n수정 1회.',{subject:'영상 3편 견적'});
  assert.equal(titled(x=>run('repeatPreview',x),{...titleOnly,allocation:0}).canSave,false);
  const detail=inspectThread([letter('detail',10,'A4 브로슈어 세부 견적을 부탁드립니다. 수정 1회.')]);
  assert.equal(detail.quoteRequest.quantity,null);assert.ok(detail.quoteRequest.review);
  for (const [subject,count,allowed] of [
    ['영상 두편 견적',3,false],['영상 두편 견적',2,true],['세부 견적 문의',2,true]
  ]) {
    const inquiry=open('30초 세로 제품 영상 '+(count===2?'두편':'3편')+' 견적을 부탁드립니다. 수정 1회.',{subject});
    assert.equal(titled(x=>run('repeatPreview',x),{...inquiry,allocation:0}).canSave,allowed,subject+' '+count);
  }
  const quoted=open('30초 세로 제품 영상 두 편 견적을 부탁드립니다. 수정 1회.\n> 30초 세로 제품 영상 99편 견적을 부탁드립니다.');
  assert.match(titled(x=>run('repeatPreview',x),{...quoted,allocation:0}).replyDraft,/2편/);
  assert.throws(()=>run('saveRepeatedQuote',{...input,evidenceId:'old'}),{code:'STALE'});
});

test('기억한 가격표는 같은 회원이 다시 열 수 있고 가격표 바꾸기나 메일함 해제 뒤에는 지난 미리보기를 저장할 수 없다', async t => {
  const root=tempRoot(t);
  let vault=openVault({root,owner,safe});
  try {
    const sourceBox=vault.register({provider:'gmail',subject:'source',label:'첫째',credential:{}});
    const targetBox=vault.register({provider:'gmail',subject:'target',label:'둘째',credential:{}});
    const samples=sampleState().threads.slice(-2);
    for(const [i,boxId] of [sourceBox,targetBox].entries()) {
      const sample={...samples[i],boxId};
      vault.commit(boxId,{records:[{id:sample.id,value:sample}],cursor:{generation:1},complete:true});
    }
    const [a,b]=samples.map(t=>({threadId:t.id,evidenceId:vault.snapshot({}).threads.find(row=>row.id===t.id).evidenceId}));
    vault.runAction('quote',{...a,...fields,scope:'30초 세로 제품 영상'});
    const sourceId=vault.snapshot({}).quotes[0].id;
    const remember={...a,quoteId:sourceId,unit:'편',includedRevisions:2,expectedMethodId:''};
    vault.runAction('rememberQuote',remember);
    const methodId=vault.snapshot({}).quotes[0].repeatMethod.id;
    vault.close();vault=openVault({root,owner,safe});
    const request={...b,methodId};
    const preview=titled(x=>vault.runAction('repeatPreview',x),request);
    assert.equal(preview.canSave,true);
    const save={...withTitle(request,preview),previewKey:preview.previewKey,expectedQuoteId:'',expectedDraft:preview.replyDraft};
    const service = createEstimateService({root,owner,safe,isCurrent:()=>true,readConfig:async()=>({}),openExternal:()=>assert.fail()});
    try {
      assert.deepEqual((await service.action('repeatPreview',withTitle(request,preview))).preview,preview);
      assert.equal((await service.action('saveRepeatedQuote',save)).data.quotes.length,2);
      assert.equal((await service.action('saveRepeatedQuote',save)).data.quotes.length,2);
    } finally {service.close();}
    vault.close();vault=openVault({root,owner,safe});
    assert.equal(vault.snapshot({}).quotes[0].replyDraft,preview.replyDraft);
    assert.doesNotMatch(preview.replyDraft,/준비하고 있습니다/);
    const second=openVault({root,owner:other,safe});
    try {
      assert.deepEqual(second.snapshot({}).quotes,[]);
      assert.throws(()=>second.runAction('repeatPreview',request),{code:'MISSING'});
    } finally {second.close();}
    vault.runAction('rememberQuote',{...remember,includedRevisions:1,expectedMethodId:methodId});
    assert.throws(()=>vault.runAction('saveRepeatedQuote',save),{code:'STALE'});
    assert.throws(()=>vault.runAction('rememberQuote',remember),{code:'STALE'});
    const current=vault.snapshot({}).quotes.find(q=>q.repeatMethod).repeatMethod.id;
    vault.forget(sourceBox);
    assert.throws(()=>vault.runAction('repeatPreview',{...request,methodId:current}),{code:'STALE'});
    assert.throws(()=>vault.runAction('saveRepeatedQuote',{...save,methodId:current}),{code:'STALE'});
    const kept=vault.snapshot({}).quotes;
    assert.equal(kept.length,1);
    assert.deepEqual([kept[0].sourceQuoteId,kept[0].sourceIncludedRevisions,kept[0].sourceRevisionMinutes],[sourceId,2,60]);
  } finally { vault.close(); }
});


test('기존 견적은 이번 근거에서 한 번 저장해야 사용할 수 있고 다른 거래처 조건은 선택되지 않는다',()=>{
  const state=sampleState(),thread=state.threads.at(-2);
  const input={threadId:thread.id,evidenceId:thread.evidenceId,...fields};
  let seq=0;
  const run=(name,data)=>updateJob(state,name,data,()=>String(++seq),10);
  run('quote',input);
  const legacy=state.quotes[0];
  delete legacy.evidenceId;delete legacy.replyFormat;
  const remember={threadId:thread.id,evidenceId:thread.evidenceId,quoteId:legacy.id,unit:'편',includedRevisions:1,expectedMethodId:''};
  assert.throws(()=>run('rememberQuote',remember),{code:'STALE'});
  run('quote',input);
  assert.equal(state.quotes.length,2);assert.equal(state.quotes[0].evidenceId,thread.evidenceId);
  run('rememberQuote',{...remember,quoteId:state.quotes[0].id});
  assert.ok(state.quotes[0].repeatMethod);
});

test('공급자 미리보기·여러 본문과 잘린 IMAP 메일을 견적 조건 전체로 읽지 않는다',()=>{
  const {gmailMessage}=require('../src/estimate-gmail.cjs');
  const {naverMessage,PREVIEW}=require('../src/estimate-naver.cjs');
  const {outlookMessage}=require('../src/estimate-outlook.cjs');
  const body='30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.';
  const g=gMessage('one',body);
  assert.equal(gmailMessage(g).partialBody,false);
  assert.equal(gmailMessage({...g,payload:{headers:g.payload.headers},snippet:body}).partialBody,true);
  const parts=[g.payload,gMessage('other','추가 파일이 필요합니다.').payload];
  const mixed=gmailMessage({...g,payload:{headers:g.payload.headers,mimeType:'multipart/mixed',parts}});
  assert.ok(mixed.partialBody);assert.equal(inspectThread([mixed]).quoteRequest,null);
  const html={...g.payload,mimeType:'text/html'};
  const alternative={mimeType:'multipart/alternative',parts:[g.payload,html]};
  const logo={mimeType:'image/png',filename:'logo.png',body:{attachmentId:'logo'}};
  const attachment={mimeType:'application/pdf',filename:'reference.pdf',body:{attachmentId:'pdf'}};
  for (const wrapper of [
    {mimeType:'multipart/related',parts:[alternative,logo]},
    {mimeType:'multipart/mixed',parts:[attachment,alternative]},
    {mimeType:'multipart/alternative',parts:[g.payload,{mimeType:'multipart/related',parts:[html,logo]}]}
  ]) {
    const withFile=gmailMessage({...g,payload:{...wrapper,headers:g.payload.headers}});
    assert.equal(withFile.text,body);assert.equal(withFile.partialBody,false);
  }
  const markdown={...gMessage('markdown','수정 2회로 부탁드립니다.').payload,mimeType:'text/markdown'};
  const extraText=gmailMessage({...g,payload:{mimeType:'multipart/mixed',parts:[g.payload,markdown],headers:g.payload.headers}});
  assert.equal(extraText.partialBody,true);assert.equal(inspectThread([extraText]).quoteRequest,null);
  const different = {...gMessage('different',body.replace('3편','5편')).payload,mimeType:'text/html'};
  const alternate = gmailMessage({...g,payload:{mimeType:'multipart/alternative',parts:[g.payload,different],headers:g.payload.headers}});
  assert.ok(alternate.partialBody);assert.equal(inspectThread([alternate]).quoteRequest,null);
  const attachedTerms=inspectThread([gmailMessage(gMessage('attached',body+' 첨부 조건을 참고해 주세요.'))]);
  assert.ok(attachedTerms.quoteRequest.review);
  const item={id:'A',subject:'영상 견적',bodyPreview:body,receivedDateTime:'2026-11-21T00:00:00Z'};
  const graph=raw=>outlookMessage({boxId:'box',folder:{id:'F',role:'inbox'},item:raw,me:'owner@example.org'});
  const named = address => graph({...item, from:{emailAddress:{name:'파도문구',address}}}).senderName;
  assert.equal(named('partner@example.org'), '파도문구');
  assert.equal(named('invalid'), '');
  assert.equal(graph(item).partialBody,true);
  assert.equal(graph({...item,uniqueBody:{content:body,contentType:'text'}}).partialBody,false);
  const header=Buffer.from('Date: Sat, 21 Nov 2026 00:00:00 +0000\r\nSubject: Quote\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'+body);
  const record=raw=>({internalDate:'21-Nov-2026 00:00:00 +0000',raw,size:raw.length});
  const mail=r=>naverMessage({boxId:'box',uidvalidity:1,uid:1,folder:{raw:'INBOX',role:'inbox'},me:'owner@example.org',record:r});
  assert.equal(mail(record(header)).partialBody,false);
  const clipped=Buffer.alloc(PREVIEW,32);header.copy(clipped);
  assert.equal(mail({...record(clipped),size:clipped.length+1024}).partialBody,true);
});

test('참고 첨부와 함께 수정 횟수와 납기를 바꾸면 지난 금액을 현재 문의에 적용하지 않는다', () => {
  const subject = '파도문구 신상품 영상 견적';
  const old = letter('request-1', 1, '30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회를 원합니다.', {subject});
  const next = letter('request-2', 2, '추가 자료를 첨부했습니다. 수정 2회. 희망 납품일은 12월 10일입니다.', {subject});
  const thread = inspectThread([old, next]);
  assert.equal(thread.evidenceId, next.id);
  assert.equal(thread.quoteRequest.revisions, 2);
  assert.equal(thread.quoteRequest.deadline, '12월 10일');
  assert.equal(thread.quoteRequest.scope, '');
  const state = {threads:[{...thread,id:'thread',boxId:'box'}], jobs:[], handoffs:[], quotes:[
    {id:'old-draft',threadId:'thread',evidenceId:old.id,replyDraft:'고객 전용 조건',total:561000}
  ]};
  updateJob(state, 'handoff', {threadId:'thread',evidenceId:next.id,confirmed:true,to:'견적 담당',
    next:'바뀐 조건 확인',conditions:'수정 2회',due:'12월 10일',reference:''}, () => 'handoff', 3);
  assert.equal(state.handoffs[0].quoteId, '');
  assert.equal(state.quotes[0].id, 'old-draft');
});

test('실제 작업의 납기와 조건을 다시 볼 수 있고 기억한 가격표로 다른 고객에게 옮기지 않는다', () => {
  const state = sampleState();
  updateJob(state, 'job', {...fields, deadline:'12월 4일', terms:'비공개 시사회 먼저'}, () => 'job', 1);
  assert.equal(state.jobs[0].deadline, '12월 4일');
  assert.equal(state.jobs[0].terms, '비공개 시사회 먼저');
  const first = state.threads.find(t => t.subject.includes('다온전시')), second = state.threads.find(t => t.subject.includes('파도문구'));
  const input = {threadId:first.id,evidenceId:first.evidenceId};
  updateJob(state, 'quote', {...fields, ...input, referenceId:'job', scope:'30초 세로 제품 영상'}, () => 'quote', 2);
  updateJob(state, 'rememberQuote', {...input, quoteId:'quote', expectedMethodId:'', unit:'편', includedRevisions:1}, () => 'method', 3);
  second.status = 'done';
  const target = {threadId:second.id,evidenceId:second.evidenceId,methodId:'method',revisionMinutes:120,allocation:0};
  assert.throws(() => updateJob(state,'repeatPreview',target,()=>'',4), {code:'VALUE'});
  updateJob(state,'reopen',target,()=>'',5);
  const preview = titled(x=>updateJob(state,'repeatPreview',x,()=>'',6),target);
  assert.equal(preview.canSave,true);
  assert.doesNotMatch(preview.replyDraft,/12월 4일|비공개 시사회/);
});

test('네이버가 한 메일의 두 번째 본문에 담은 추가 납품을 무시해 견적을 내지 않는다', () => {
  const {naverMessage}=require('../src/estimate-naver.cjs');
  const first='30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 2회를 원합니다.';
  const second='세로형 영상 1편도 추가해 주세요.';
  function message(subtype, parts) {
    const head=['Subject: Quote','From: Test <writer@example.org>','To: member@example.org','Content-Type: multipart/'+subtype+'; boundary=fixture',''];
    const segments=parts.map(([kind,body,extra]) => ['--fixture','Content-Type: '+kind+'; charset=utf-8',...(extra?[extra]:[]),'',body].join('\r\n'));
    const raw=Buffer.from([...head,'',...segments,'--fixture--',''].join('\r\n'));
    return naverMessage({boxId:'box',uidvalidity:1,uid:1,folder:{raw:'INBOX',role:'inbox'},me:'member@example.org',
      record:{internalDate:'21-Nov-2026 00:00:00 +0000',raw,size:raw.length}});
  }
  const mixed=message('mixed',[['text/plain',first],['text/plain',second]]);
  assert.equal(message('alternative',[['text/plain',first],['application/rtf',second]]).partialBody,true);
  assert.equal(message('mixed',[['text/plain',first],['application/rtf',second]]).partialBody,true);
  const imageTerms=message('mixed',[['text/plain',first],['text/html','<img alt="추가 납품: 썸네일 3장" src="cid:terms">']]);
  assert.ok(imageTerms.partialBody);assert.equal(inspectThread([imageTerms]).quoteRequest,null);
  const linkedPlain=first+'\n포트폴리오 (https://example.org/item)';
  const linkedHtml='<p>'+first+'</p><p><a href="https://example.org/item">포트폴리오</a></p>';
  assert.equal(message('alternative',[['text/plain',linkedPlain],['text/html',linkedHtml]]).partialBody,false);
  const namedAlternate=message('alternative',[['text/plain',first],['application/rtf; name=quote.rtf',second]]);
  assert.equal(namedAlternate.partialBody,true);
  assert.equal(message('alternative',[['text/plain',linkedPlain],['text/html',linkedHtml.replace('/item','/other')]]).partialBody,true);
  for (const parts of [
    [['text/plain',''],['text/html','<p>'+first+'</p>']],
    [['text/html','<p>'+first+'</p>'],['text/plain','']]
  ]) {
    const withEmpty = message('alternative',parts);
    assert.match(withEmpty.text,/3편/);
    assert.equal(withEmpty.partialBody,true);
  }
  assert.match(message('mixed',[['text/html','<img>'],['text/plain',first]]).text,/3편/);
  assert.equal(mixed.partialBody,true);
  assert.equal(inspectThread([mixed]).quoteRequest,null);
  const alternative=message('alternative',[['text/plain',first],['text/html','<p>'+first+'</p>']]);
  assert.equal(alternative.partialBody,false);
  const conflicting=message('alternative',[['text/plain',first],['text/html','<p>'+second+'</p>']]);
  assert.equal(conflicting.partialBody,true);
  const reply=message('alternative',[['text/plain',first+'\n> 지난달에는 한 편을 요청했습니다.'],['text/html','<p>'+first+'</p><blockquote>지난달에는 한 편을 요청했습니다.</blockquote>']]);
  assert.equal(reply.partialBody,false);
  assert.equal(message('alternative',[['text/plain','• '+first],['text/html','<p>&bull; '+first+'</p>']]).partialBody,false);
  assert.equal(message('mixed',[['text/html','<p>자료를 첨부합니다.</p><blockquote>수정은 2회, 납품은 12월 10일로 부탁드립니다.</blockquote>']]).partialBody,true);
  assert.equal(message('mixed',[['text/plain','첨부합니다.'],['message/rfc822','전달 메일','Content-Disposition: inline']]).partialBody,true);
  const attachment=message('mixed',[['text/plain',first],['text/plain','파일','Content-Disposition: attachment; filename="file.txt"']]);
  assert.equal(attachment.partialBody,false);
  const inline=message('mixed',[['text/plain',first],['text/plain',second,'Content-Disposition: inline; filename="terms.txt"']]);
  assert.equal(inline.partialBody,true);
});

test('견적 대화의 후속 조건, 질문형 횟수와 편집·촬영의 차이를 확인한다', () => {
  const {readQuoteRequest,repeatProposal}=require('../src/estimate-repeat.cjs');
  const subject='홍보 영상 제작 문의드립니다';
  const old=letter('request-1',1,'영상 촬영 3편 견적 부탁드립니다. 수정 1회.',{subject});
  const next=letter('request-2',2,'수정은 2회로 바꾸고 희망 납품일은 12월 10일입니다.\n첨부 파일도 확인해 주세요.',{subject:'Re: '+subject});
  const thread=inspectThread([old,next]), facts=thread.quoteRequest;
  assert.equal(thread.kind,'quote');
  assert.equal(thread.evidenceId,'request-2');
  assert.equal(facts.revisions,2);
  assert.equal(facts.deadline,'12월 10일');
  assert.equal(facts.review,true);
  const pending=repeatProposal({repeatMethod:{unit:'편',includedRevisions:1}},thread,{},()=>assert.fail('미확정 가격'));
  assert.equal(pending.fields,null);
  assert.match(pending.notes.join(' '),/수정 2회, 희망 납품일 12월 10일/);
  const body='영상 촬영 1편 견적 부탁드립니다.';
  const list=readQuoteRequest('- '+body+'\n• 수정 1회.','영상 촬영 견적');
  assert.equal(list.scope,'영상 촬영');
  assert.equal(list.quantity,1);
  assert.equal(list.revisions,1);
  assert.equal(list.review,false);
  assert.equal(readQuoteRequest(body+' 수정 1회?','영상 촬영 견적').revisions,null);
  assert.ok(readQuoteRequest(body+' 수정 1회?','영상 촬영 견적').review);
  assert.ok(readQuoteRequest(body+' 수정 1회.','영상 편집 견적 문의').review);
  assert.equal(readQuoteRequest(body.replace('촬영','편집')+' 수정 1회.','영상 편집 견적 문의').review,false);
  assert.equal(readQuoteRequest(body+' 수정 1회. 수정 2회.','영상 견적').revisions,null);
  const oneLine=readQuoteRequest('수정은 2회, 희망 납품일은 12월 10일입니다.','견적');
  assert.equal(oneLine.revisions,2);
  assert.equal(oneLine.deadline,'12월 10일');
  assert.ok(readQuoteRequest('행사 영상 1편 견적 부탁드립니다. 수정 1회.','행사 영상 1편, 매장 진열 견적 문의').review);
  assert.equal(readQuoteRequest('리플릿 세 부 견적 부탁드립니다. 수정 1회.','리플릿 세 부 견적 요청').review,false);
  const notices=['파일 첨부','자료 첨부','Re: '+subject].map((title,index)=>letter('file-'+index,10+index,'자료를 첨부합니다.\n감사합니다.',{subject:title}));
  assert.equal(inspectThread([old,...notices]).evidenceId,old.id);
  for(const tail of ['\n-- \n김영희 드림','\nOn Monday, requests@example.com wrote:\n> 이전 영상 견적 부탁드립니다.']){
    assert.equal(inspectThread([old,letter('receipt',11,'파일을 첨부합니다.'+tail,{subject})]).evidenceId,old.id);
  }
  const changed=letter('title-only',3,'자료를 첨부합니다.',{subject:'Re: 영상 5편 · 수정 2회 · 납품 12월 10일'});
  assert.equal(inspectThread([old,changed]).evidenceId,changed.id);
  const separate=inspectThread([old,letter('separate',4,'수정은 2회로 바꿔 주세요.\n희망 납품일은 12월 10일입니다.',{subject:'Re: '+subject})]);
  assert.equal(separate.quoteRequest.revisions,2);
  assert.equal(separate.quoteRequest.deadline,'12월 10일');
});

test('제목이 자동 알림처럼 시작하는 실제 문의와 일부만 읽은 단체 메일을 보존한다', () => {
  const old = letter('a',1,'영상 1편 견적 부탁드립니다.',{subject:'영상 견적'});
  const next = letter('b',2,'영상 3편으로 바꿔 주세요.',{subject:'로그인 알림 안내 영상 견적 문의'});
  assert.equal(inspectThread([old,next]).evidenceId,next.id);
  assert.equal(inspectThread([old,{...next,automatic:true}]).evidenceId,next.id);
  const away=letter('away',3,'휴가 중입니다. 복귀하면 답변하겠습니다.',{subject:'자동 회신',automatic:true});
  assert.equal(inspectThread([old,away]).evidenceId,old.id);
  const bulk = letter('g',3,'앞부분만 읽었습니다.',{subject:'공지',bulk:true});
  assert.equal(inspectThread([bulk]).status,'excluded');
  assert.equal(inspectThread([{...bulk,partialBody:true}]).status,'review');
  assert.equal(inspectThread([{...bulk,uncertain:'본문 확인 필요'}]).status,'review');
  const followup = inspectThread([old,letter('f',2,'수정 2회입니다.\n희망 납품일은 12월 10일입니다.\n재견적 부탁드립니다.')]);
  assert.match(followup.evidence,/수정 2회.*12월 10일.*재견적/);
  const {outlookMessage}=require('../src/estimate-outlook.cjs');
  const item={id:'X',subject:'영상 견적',uniqueBody:{content:'',contentType:'text'},bodyPreview:'이전에 보낸 질문을 확인해 주세요.',receivedDateTime:'2026-11-21T00:00:00Z'};
  const current=outlookMessage({boxId:'box',folder:{id:'F',role:'inbox'},item,me:'owner@example.org'});
  assert.equal(current.text,'');
  assert.doesNotMatch(inspectThread([old,current]).evidence,/이전에 보낸/);
});

test('제목의 품목과 수량을 분리하고 본문에서 정정한 조건은 확정값에 남기지 않는다', () => {
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const corrected=readQuoteRequest('홍보 영상 3편 견적 부탁드립니다. 수정 1회. 납품일: 12월 10일. 수정 2회로 변경합니다. 납품일을 12월 17일로 변경합니다.','영상 견적');
  assert.equal(corrected.review,true);
  assert.equal(corrected.revisions,null);
  assert.equal(corrected.deadline,'');
  const labelled=readQuoteRequest('품목: 홍보 영상\n홍보 영상 3편 견적 부탁드립니다.\n수정 1회.','홍보 영상 견적 문의');
  assert.equal(labelled.review,false);
  assert.equal(labelled.quantity,3);
  assert.equal(readQuoteRequest('행사 촬영 1건 견적 부탁드립니다. 수정 1회.','제품 촬영 견적').review,true);
  assert.equal(readQuoteRequest('두 페이지 디자인 1건 견적 부탁드립니다. 수정 1회.','디자인 두 건 견적 문의').review,true);
});

test('일부만 확인한 네이버 대화 병합은 최신 문의와 인계를 재시작 뒤에도 보존한다', t => {
  const folder=tempRoot(t);
  let vault=openVault({root:folder,owner,safe});
  try {
    const box=vault.register({provider:'naver',subject:'fixture',label:'me@example.org',credential:{}});
    const message=(id,threadId,at,links)=>({...letter(id,at,'영상 '+at+'편 견적 부탁드립니다.'),threadId,threadLinks:links});
    const a=message('first','A',1,['A']), b=message('latest','B',10,['B']);
    vault.commit(box,{reset:true,messages:[a,b],complete:true,cursor:{}});
    const source=vault.snapshot({}).threads.find(thread=>thread.lastAt===10);
    vault.runAction('handoff',{threadId:source.id,evidenceId:source.evidenceId,to:'견적 담당',next:'최신 문의 확인'});
    const handoff=vault.snapshot({}).handoffs[0];
    vault.runAction('accept',{id:handoff.id});
    vault.commit(box,{reset:true,messages:[message('bridge','A',3,['A','B'])],listFinished:true,cursor:{}});
    vault.commit(box,{complete:true,coverage:{partial:true},cursor:{}});
    vault.close();
    vault=openVault({root:folder,owner,safe});
    const view=vault.snapshot({});
    assert.equal(view.threads.length,1);
    assert.equal(view.threads[0].awaitingEvidence,true);
    assert.equal(view.handoffs[0].evidenceId,source.evidenceId);
    assert.equal(view.handoffs[0].threadId,view.threads[0].id);
    assert.equal(vault.snapshot({},0).handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.runAction('finish',{id:handoff.id}),{code:'STALE'});
    vault.commit(box,{messages:[message('later','A',11,['A','B'])],cursor:{}});
    assert.equal(vault.snapshot({},0).handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.runAction('finish',{id:handoff.id}),{code:'STALE'});
    assert.equal(vault.snapshot({}).handoffs[0].status,'accepted');
  } finally {vault.close();}
});

test('같은 공급자 메일의 확인 가능한 조건이 달라지면 이전 승인과 견적 입력을 다시 확인한다', t => {
  const root=tempRoot(t);
  let vault=openVault({root,owner,safe});
  try {
    const boxId=vault.register({provider:'gmail',subject:'fixture',label:'me@example.org',credential:{}});
    const message={...inspectThread([letter('msg',1,'영상 3편 견적 부탁드립니다. 수정 1회.',{subject:'영상 견적'})]),id:'thread',boxId};
    const store=record=>vault.commit(boxId,{records:[{id:record.id,value:record}],complete:true,cursor:{generation:1}});
    store(message);
    const input={threadId:message.id,evidenceId:vault.snapshot({}).threads[0].evidenceId};
    vault.runAction('handoff',{...input,to:'견적 담당',next:'초안 작성'});
    const partial={...message,quoteRequest:null};
    store(partial);
    const view=vault.snapshot({});
    assert.notEqual(view.threads[0].evidenceId,input.evidenceId);
    assert.equal(view.handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.runAction('quote',{...input,...fields}),{code:'STALE'});
    store(partial);
    assert.equal(vault.snapshot({}).threads[0].evidenceId,view.threads[0].evidenceId);
    store({...message,evidenceId:'next-provider-message'});
    store(partial);
    const returned=vault.snapshot({}).threads[0].evidenceId;
    assert.notEqual(returned,view.threads[0].evidenceId);
    vault.close();vault=openVault({root,owner,safe});
    assert.equal(vault.snapshot({}).threads[0].evidenceId,returned);
    assert.equal(vault.snapshot({}).handoffs[0].currentEvidence,false);
  } finally {vault.close();}
});

test('Outlook 폴더 이동 도중에는 예전 인계가 다시 나타나지 않고 이동 확인 뒤 최신 문의만 열린다', t=>{
  const root=tempRoot(t);let vault=openVault({root,owner,safe});
  try{
    const id=vault.register({provider:'outlook',subject:'test-move',label:'a@example.org',credential:{}});
    const mail=(id,number)=>({id:'inbox-'+id,evidenceId:id,threadId:'A',at:number,text:'제품 영상 '+number+'편 견적 부탁드립니다. 수정 1회.',subject:'제품 영상 견적'});
    const earlier=mail('one',1),newer=mail('three',3);
    vault.commit(id,{reset:true,messages:[earlier],complete:true,cursor:{}});
    const first=vault.snapshot({}).threads[0];
    vault.runAction('quote',{threadId:first.id,evidenceId:first.evidenceId,...fields});
    vault.runAction('handoff',{threadId:first.id,evidenceId:first.evidenceId,to:'견적 담당',next:'이전 조건 확인'});
    const handoff=vault.snapshot({}).handoffs[0];
    vault.commit(id,{messages:[newer],complete:true,cursor:{}});
    const latest=vault.snapshot({}).threads[0];
    vault.commit(id,{removed:[newer.id],cursor:{phase:'verify'}});
    vault.close();vault=openVault({root,owner,safe});
    assert.equal(vault.snapshot({}).handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.runAction('accept',{id:handoff.id}),{code:'STALE'});
    assert.throws(()=>vault.runAction('quote',{threadId:first.id,evidenceId:first.evidenceId,...fields}),{code:'STALE'});
    vault.commit(id,{messages:[{...newer,id:'archive-three'}],complete:true,cursor:{}});
    assert.equal(vault.snapshot({}).threads[0].evidenceId,latest.evidenceId);
    assert.equal(vault.snapshot({}).handoffs[0].currentEvidence,false);
    vault.commit(id,{removed:['archive-three'],complete:true,cursor:{}});
    const reverted=vault.snapshot({});
    assert.notEqual(reverted.threads[0].evidenceId,first.evidenceId);
    assert.equal(reverted.quotes[0].currentEvidence,false);
    assert.equal(reverted.handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.runAction('accept',{id:handoff.id}),{code:'STALE'});
    vault.runAction('quote',{threadId:first.id,evidenceId:reverted.threads[0].evidenceId,...fields});
    assert.equal(vault.snapshot({}).quotes[0].currentEvidence,true);
  }finally{vault.close();}
});

test('고객에게 보낸 답장과 견적 약속은 고객 근거를 유지하고 새 주문만 이전 인계를 닫는다',t=>{
  const vault=openVault({root:tempRoot(t),owner,safe});
  try {
    const id=vault.register({provider:'gmail',subject:'test-reply',label:box.label,credential:{}});
    const save=(thread,messages)=>{const item=fromThread({...box,id},{id:thread,messages});vault.commit(id,{records:[{id:item.id,value:item}],complete:true,cursor:{generation:1}});return vault.snapshot({}).threads.find(t=>t.id===item.id);};
    const m1=gMessage('first','30초 세로 제품 영상 1편 견적 부탁드립니다. 수정 1회.',[],1);
    const previous=save('source',[m1]);
    const first={threadId:previous.id,evidenceId:previous.evidenceId};
    vault.runAction('quote',{...first,...fields,scope:'30초 세로 제품 영상'});
    vault.runAction('rememberQuote',{...first,quoteId:vault.snapshot({}).quotes[0].id,expectedMethodId:'',unit:'편',includedRevisions:1});
    const target=clientMail('next','30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 1회.',[],2);
    const open=save('target',[target]);
    const at={threadId:open.id,evidenceId:open.evidenceId};
    vault.runAction('handoff',{...at,to:'견적 담당',next:'견적 작성'});
    const handoff=vault.snapshot({}).handoffs[0];
    vault.runAction('accept',{id:handoff.id});
    const methodId=vault.snapshot({}).quotes[0].repeatMethod.id;
    assert.match(titled(x=>vault.runAction('repeatPreview',x),{...at,methodId}).replyDraft,/561,000원/);
    const promise=clientMail('promise','확인 후 견적 안내드리겠습니다.',['SENT'],3);
    const pending=save('target',[target,promise]);
    assert.equal(pending.status,'promise');assert.equal(pending.evidenceId,open.evidenceId);assert.match(pending.request,/3편/);
    // 0.5.8: 최신 고객 요청 뒤에 답장을 보냈으면 접수 인사여도 반복 견적을 닫는다.
    assert.throws(()=>vault.runAction('repeatPreview',{...at,methodId}),{code:'VALUE',message:/이미 답장을 보냈어요/});
    const sent=clientMail('answered','견적서를 첨부했습니다.',['SENT'],4);
    assert.equal(save('target',[target,promise,sent]).status,'waiting');
    vault.runAction('finish',{id:handoff.id});assert.equal(vault.snapshot({}).handoffs[0].status,'done');
    const receipt=clientMail('thanks','메일 잘 받았습니다. 감사합니다.',['SENT'],5);
    const followup=clientMail('followup','확인 후 견적 안내드리겠습니다.',['SENT'],6);
    for(const messages of [[target,promise,sent,receipt],[target,promise,sent,receipt,followup]]){
      const sameRequest=save('target',messages);
      assert.equal(sameRequest.evidenceId,at.evidenceId);
      vault.runAction('reopen',at);
      assert.throws(()=>vault.runAction('repeatPreview',{...at,methodId}),{code:'VALUE'});
    }
    save('target',[target,promise,sent,receipt,followup,gMessage('change','제품 영상 5편으로 변경해 주세요.',[],7)]);
    assert.equal(vault.snapshot({}).handoffs[0].currentEvidence,false);
    for (const body of [
      '부가세 포함 50만 원입니다. 산출내역은 내일 보내드리겠습니다.',
      '예상 공급가액은 480,000원이며, 부가세 조건은 확인 후 안내드리겠습니다.',
      '촬영을 취소했습니다. 환불 일정은 확인 후 안내드리겠습니다.',
      '납기는 12월 10일로 확정했습니다. 촬영 참고 자료는 내일 보내드리겠습니다.',
      '부가세 포함 견적은 726,000원으로 확정했고 납기는 아직 정하지 않았습니다. 촬영 참고 자료는 내일 보내드리겠습니다.',
      '확정 견적서입니다. https://drive.google.com/file/d/synthetic-quote/view\n촬영 참고 자료는 내일 보내드리겠습니다.',
      '0원으로 드림. 촬영 참고 자료는 내일 보내드리겠습니다.',
      "이번 고객 견적 링크입니다. https://studio.example/ko/quotes/\n이용 방법 도움말은 https://studio.example/ko/quotes/help?source=Q-504 에 있습니다.\n자료는 내일 보내드리겠습니다.",
      "https://portal.example.test/help 이쪽은 사용 방법 도움말입니다. https://portal.example.test/share/abcd 이쪽은 이번 견적 링크입니다.\n자료는 내일 보내드리겠습니다.",
      "이번 견적 링크입니다. https://studio.example/ko/quotes/Q-504, 도움말은 내일 별도로 보내드리겠습니다.\n자료는 내일 보내드리겠습니다.",
      "이번 고객 견적 링크입니다. https://studio.example/support/quotes/Q-504\n자료는 내일 보내드리겠습니다.",
      "https://portal.example.test/share/abcd 이쪽은 이번 견적 링크입니다. https://portal.example.test/help 이쪽은 사용 방법 도움말입니다.\n자료는 내일 보내드리겠습니다.",
      "이용 방법 도움말은 https://studio.example/ko/quotes/help?source=Q-504 에 있습니다.\n이번 고객 견적 링크입니다. https://studio.example/ko/quotes/\n자료는 내일 보내드리겠습니다.",
      "이번 고객 견적 링크: https://studio.example/ko/quotes/ · 이용 방법 도움말: https://studio.example/ko/quotes/help?source=Q-504\n자료는 내일 보내드리겠습니다.",
      "이번 견적 링크입니다(https://studio.example/ko/quotes/).\n자료는 내일 보내드리겠습니다.",
      "이번 견적 링크입니다（https://studio.example/ko/quotes/）。\n자료는 내일 보내드리겠습니다.",
      "이번 견적 링크입니다. <https://studio.example/ko/quotes/>.\n자료는 내일 보내드리겠습니다.",
      "보내드린 견적은 아래에서 확인해 주세요.\nhttps://studio.example/ko/quotes/Q-504\n자료는 내일 보내드리겠습니다.",
      "이번 견적 링크입니다. (https://studio.example/ko/quotes/Q-504?source=help&item=(A)#v1).\n자료는 내일 보내드리겠습니다.",
      "보내드린 견적은 아래에 있습니다.\nhttps://studio.example/ko/quotes/?id=Q-504\n자료는 내일 보내드리겠습니다.",
      "이번 견적 링크입니다.\nhttps://portal.example.test/share/abcd\n자료는 내일 보내드리겠습니다.",
      "https://portal.example.test/share/abcd\n이번 견적 링크입니다.\n자료는 내일 보내드리겠습니다.",
      "둘 중 어느 쪽이 견적서인지 확인해 주세요.\nhttps://portal.example.test/a https://portal.example.test/b\n보내드린 견적은 아래에서 확인해 주세요.\nhttps://studio.example/ko/quotes/Q-504\n자료는 내일 보내드리겠습니다.",
      "0원으로 드림.\n이용 방법 도움말은 https://studio.example/ko/quotes/help?source=Q-504 에 있습니다.\n자료는 내일 보내드리겠습니다.",
      "관련 링크 두 개입니다. https://portal.example.test/a https://portal.example.test/b\n이번 확정 견적은 726,000원입니다.\n자료는 내일 보내드리겠습니다.",
      '견적 안내 https://studio.example/ko/quotes/\n촬영 참고 자료는 내일 보내드리겠습니다.',
    ]) {
      const answered=save('mixed',[target,clientMail('terms-and-promise',body,['SENT'],8)]);
      assert.equal(answered.status,'promise');
      const current={threadId:answered.id,evidenceId:answered.evidenceId};
      assert.throws(()=>vault.runAction('repeatPreview',{...current,methodId}),{code:'VALUE'});
    }
    // 0.5.8: 최신 고객 요청 뒤에 답장을 보냈으면 접수 인사여도 「지난번처럼 해줘」를 닫는다.
    const hello=clientMail('new-manager','문의 주셔서 감사합니다. 앞으로 잘 부탁드립니다.',['SENT'],9);
    const firstPromise=clientMail('will-quote','확인 후 견적 안내드리겠습니다.',['SENT'],10);
    const acknowledged=save('no-quote-sent',[target,hello,firstPromise]);
    assert.equal(acknowledged.status,'promise');
    assert.equal(acknowledged.repliedSinceRequest,true);
    assert.throws(()=>vault.runAction('repeatPreview',{threadId:acknowledged.id,evidenceId:acknowledged.evidenceId,methodId}),{code:'VALUE',message:/이미 답장을 보냈어요/});
    // 앱이 읽은 답장을 메일함에서 영구 삭제해도 같은 고객 요청이 이어지면 잠금이 남는다(0.5.8 검수 GPT-P).
    const erased=save('no-quote-sent',[target]);
    assert.equal(erased.repliedSinceRequest,true);
    assert.throws(()=>vault.runAction('repeatPreview',{threadId:erased.id,evidenceId:erased.evidenceId,methodId}),{code:'VALUE',message:/이미 답장을 보냈어요/});
    const reasked=save('no-quote-sent',[target,clientMail('asked-again','30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 1회.',[],14)]);
    assert.equal(reasked.repliedSinceRequest,false);
    const unanswered=save('unanswered',[target]);
    assert.equal(unanswered.repliedSinceRequest,false);
    const preview=titled(x=>vault.runAction('repeatPreview',x),{threadId:unanswered.id,evidenceId:unanswered.evidenceId,methodId});
    assert.equal(preview.canSave,true);
    assert.match(preview.replyDraft,/561,000원/);
    const introduced=save('new-manager-intro',[target,clientMail('manager-intro','담당자가 바뀌어 인사드립니다. 앞으로 잘 부탁드립니다.',['SENT'],9),firstPromise]);
    assert.equal(introduced.repliedSinceRequest,true);
    assert.throws(()=>vault.runAction('repeatPreview',{threadId:introduced.id,evidenceId:introduced.evidenceId,methodId}),{code:'VALUE',message:/이미 답장을 보냈어요/});
    for (const body of [
      '고객님께서 말씀하신 예산 100만 원을 확인했습니다. 확인 후 정확한 견적을 안내드리겠습니다.',
      '726,000원으로 아직 확정하지 않았습니다. 확인 후 견적 안내드리겠습니다.',
      '납기는 내일 확정할 예정입니다. 확인 후 견적 안내드리겠습니다.',
      '견적 포털 도움말입니다.\nhttps://portal.example.test/ko/quotes/help\n이번 견적은 내일 보내드리겠습니다.',
      "https://studio.example/project/one 먼저 참고용 작업 사례입니다. https://studio.example/project/two 여기도 참고용 예시입니다.\n자료는 내일 보내드리겠습니다.",
      "https://studio.example/ko/quotes/Q-504, 참고용 예전 예시입니다.\n자료는 내일 보내드리겠습니다.",
      "견적 포털 가이드입니다. https://studio.example/support/quotes/help/starting\n자료는 내일 보내드리겠습니다.",
      "도움말 이용 방법입니다. https://studio.example/quotes/help?path=/quotes/Q-504\n자료는 내일 보내드리겠습니다.",
      "견적 화면 이용 방법 도움말입니다.\nhttps://studio.example/ko/quotes/help?source=Q-504\n자료는 내일 보내드리겠습니다.",
      "예전 예시를 참고용으로만 보냅니다.\nhttps://studio.example/ko/quotes/\n자료는 내일 보내드리겠습니다.",
      "제작 예시는 참고용으로만 보냅니다. https://studio.example/portfolio\n자료는 내일 보내드리겠습니다.",
      "견적 포털 도움말입니다.\nhttps://portal.example.test/ko/quotes/help\n이번 견적은 내일 보내드리겠습니다.\n자료는 내일 보내드리겠습니다.",
      "사용 방법입니다.\nhttps://studio.example/help?download=/ko/quotes/Q-504#견적\n자료는 내일 보내드리겠습니다.",
    ]) {
      // 판별기가 조건을 보내지 않았다고 읽는 답장이어도, 접수 인사가 아니면 반복 견적은 열지 않는다(0.5.8 설계).
      const pendingQuote=save('preparing',[target,clientMail('promise-with-budget',body,['SENT'],11)]);
      assert.equal(pendingQuote.repliedSinceRequest,true,body);
      assert.throws(()=>vault.runAction('repeatPreview',{threadId:pendingQuote.id,evidenceId:pendingQuote.evidenceId,methodId}),{code:'VALUE',message:/이미 답장을 보냈어요/},body);
    }
    const unclear=clientMail('unclear','50만 원 선에서 생각 중입니다. 검토 후 견적 안내드리겠습니다.',['SENT'],12);
    const held=save('verify-terms',[target,unclear,clientMail('new-promise','내일 회신드리겠습니다.',['SENT'],13)]);
    assert.equal(held.needsTermsReview,true);
    assert.equal(held.needsReceiptReview,true);
    assert.throws(()=>vault.runAction('repeatPreview',{threadId:held.id,evidenceId:held.evidenceId,methodId}),{code:'VALUE'});
    // 원문 확인은 일반 견적의 보류만 푼다. 「지난번처럼 해줘」 잠금은 새 고객 요청만 푼다.
    vault.confirmReceipt({threadId:held.id,evidenceId:held.evidenceId});
    const confirmed=vault.snapshot({}).threads.find(t=>t.id===held.id);
    assert.notEqual(confirmed.needsReceiptReview,true);
    assert.equal(confirmed.repliedSinceRequest,true);
    assert.throws(()=>vault.runAction('repeatPreview',{threadId:confirmed.id,evidenceId:confirmed.evidenceId,methodId}),{code:'VALUE',message:/이미 답장을 보냈어요/});
  }finally{vault.close();}
});

test('0.5.8 「지난번처럼 해줘」는 최신 고객 요청 뒤에 보낸 답장이 없는 문의에서만 열리고, 새 견적 요청만 잠금을 푼다',()=>{
  const sender='솔리오스튜디오 김유호', customer='customer@example.test';
  const request=letter('ask',1,'30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.',{subject:'제품 영상 견적 문의',senderName:'김지민',customerAddresses:[customer]});
  const reply=(id,text,extra={})=>letter(id,2,text,{subject:'Re: 제품 영상 견적 문의',outgoing:true,senderName:sender,recipients:[customer],...extra});
  const flag=(...messages)=>inspectThread(messages).repliedSinceRequest;
  assert.equal(flag(request),false);
  // 접수 인사도 잠근다. 문장 판별로 여는 예외는 두지 않는다(0.5.8 검수 GPT-F).
  for (const text of ['감사합니다.','문의 주셔서 감사합니다. 확인 후 견적 안내드리겠습니다.',
    '안녕하세요, 솔리오스튜디오 김유호입니다.\n견적 문의 잘 받았습니다.\n내일까지 견적 보내 드리겠습니다.\n감사합니다.\n김유호 드림',
    '메일 잘 받았습니다. 검토 후 회신드리겠습니다.','보내 주신 문의 확인했습니다. 영업일 기준 1~2일 내 회신드리겠습니다.',
    '견적 문의 잘 받았습니다. 확인 후 연락드리겠습니다.\n\n주식회사 솔리오\n김유호 | 대표\n010-1234-5678\nstudio@example.test',
    '메일 잘 받았습니다.\n> 인쇄비는 얼마인가요? → 부가세 포함 200,000원입니다.','문의 주셔서 감사합니다.\n제작 범위는 메뉴판 2종 기획',
    '사양을 확인하고 금요일까지 드리겠습니다.','감사합니다. 김유호 드림',
    '네, 메일 잘 받았습니다.','확인했습니다.','말씀하신 조건으로 견적 드리겠습니다.','726,000원(부가세 별도)입니다.','취소 수수료는 없습니다.']) {
    assert.equal(flag(request,reply('sent',text)),true,text);
  }
  // 받는 사람 필터 · 휴지통 · 방향 불확실 · 끝까지 못 읽음 · 첨부 · 바뀐 제목도 잠근다.
  const ack='견적 문의 잘 받았습니다. 확인 후 연락드리겠습니다.';
  for (const extra of [{hasAttachments:true},{excluded:true},{directionUncertain:true},{directionUncertain:true,outgoing:false},{partialBody:true},
    {uncertain:'발신자를 확인해 주세요.'},{subject:'Re: 제품 영상 견적 726,000원'},{recipients:['someone-else@example.test']},
    {outgoing:false,possibleSelf:true,uncertain:'보낸 사람이 내 주소지만 보낸 편지함 밖에 있어 직접 확인이 필요해요.'}]) {
    assert.equal(flag(request,reply('edge',ack,extra)),true,JSON.stringify(extra));
  }
  // 임시 보관함의 초안은 고객이 받지 않았으니 잠그지 않는다.
  assert.equal(flag(request,reply('draft',ack,{outgoing:false,draft:true})),false);
  const priced=reply('price','견적 금액은 726,000원입니다.');
  assert.equal(flag(request,priced,{...reply('later',ack),at:3}),true);
  const follow=(text,subject='Re: 제품 영상 견적 문의')=>letter('follow',4,text,{subject,senderName:'김지민',customerAddresses:[customer]});
  assert.equal(flag(request,priced,follow('이번에는 같은 영상 5편 견적을 부탁드립니다.')),false);
  // 같은 시각의 보낸 편지(휴지통 포함)와 고객 요청은 순서를 믿지 않아 잠금이 남는다(0.5.8 검수 카본 G1 · G2).
  for (const extra of [{},{excluded:true}]) {
    const sameTime=letter('a-same',4,'견적 금액은 726,000원입니다.',{subject:'Re: 제품 영상 견적 문의',outgoing:true,senderName:sender,recipients:[customer],...extra});
    assert.equal(flag(request,priced,sameTime,follow('이번에는 같은 영상 5편 견적을 부탁드립니다.')),true,JSON.stringify(extra));
  }
  assert.equal(flag(request,priced,{...reply('later-ack',ack),at:4},follow('이번에는 같은 영상 5편 견적을 부탁드립니다.')),true);
  for (const text of ['말씀하신 조건으로 3편 진행 부탁드립니다. 수정은 1회면 됩니다.','네, 감사합니다.','참고 자료를 첨부합니다.']) {
    assert.equal(flag(request,priced,follow(text)),true,text);
  }
  // 바뀐 제목만으로는 풀지 않는다. 내 답장 제목에 「Re:」를 단 인사, 제목만 바꾼 확인 인사도 잠금이 남는다(0.5.8 검수 c).
  const namedReply=reply('titled','견적 금액은 726,000원입니다.',{subject:'Re: 30초 세로 제품 영상 3편 견적'});
  for (const [text,subject] of [['감사합니다! 카드 결제도 되나요?','Re: 30초 세로 제품 영상 3편 견적'],['견적서 잘 받았습니다. 감사합니다.','행사 영상 3편 견적']]) {
    assert.equal(flag(request,namedReply,follow(text,subject)),true,subject);
  }
  // 보낸 편지함 밖 내 주소 편지(possibleSelf)도 같은 시각 판별에서 보낸 편지로 세고, 스스로 잠금을 풀지 못한다.
  const self=letter('a-self',4,'견적은 30만 원입니다. 세금계산서 받을 주소를 알려주세요?',{subject:'Re: 제품 영상 견적 문의',senderName:sender,possibleSelf:true});
  assert.equal(flag(request,priced,self,follow('이번에는 같은 영상 5편 견적을 부탁드립니다.')),true);
  assert.equal(flag(request,letter('self-only',3,'영상 3편 견적 부탁드립니다?',{subject:'제품 영상 견적 문의',senderName:sender,possibleSelf:true})),true);
  // 「다시 열기」로 상태를 바꿔도 잠금이 먼저다.
  const state=sampleState();
  const source=state.threads.find(t=>t.subject.includes('다온전시'));
  const basic={threadId:source.id,evidenceId:source.evidenceId};
  let seq=0;
  const run=(name,input)=>updateJob(state,name,input,()=>String(++seq),100);
  run('quote',{...fields,...basic,scope:'30초 세로 제품 영상',allocation:10000});
  run('rememberQuote',{...basic,quoteId:state.quotes[0].id,unit:'편',includedRevisions:1,expectedMethodId:''});
  const methodId=state.quotes[0].repeatMethod.id;
  const put=messages=>{
    const thread={...inspectThread(messages),id:'target',boxId:'new-box'};
    state.threads=state.threads.filter(t=>t.id!==thread.id).concat(thread);
    return {threadId:thread.id,evidenceId:thread.evidenceId,methodId};
  };
  const fresh=titled(x=>run('repeatPreview',x),{...put([request]),allocation:0});
  assert.ok(fresh.canSave);assert.match(fresh.replyDraft,/561,000원/);
  assert.throws(()=>run('repeatPreview',{...put([request,reply('ack',ack)]),allocation:0}),{code:'VALUE',message:/이미 답장을 보냈어요/});
  const reasked=titled(x=>run('repeatPreview',x),{...put([request,reply('ack',ack),follow('30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 1회.')]),allocation:0});
  assert.ok(reasked.canSave);
  const locked=put([request,priced]);
  assert.throws(()=>run('repeatPreview',{...locked,allocation:0}),{code:'VALUE',message:/이미 답장을 보냈어요/});
  run('reopen',locked);
  assert.throws(()=>run('repeatPreview',{...locked,allocation:0}),{code:'VALUE',message:/이미 답장을 보냈어요/});
  assert.equal(publicView(state,{}).threads.find(t=>t.id==='target').repliedSinceRequest,true);
});

test('Gmail 목록을 마친 뒤 변경분 검사 중에 중단되어도 이전 세대의 문의를 보존한다',t=>{
  const root=tempRoot(t);let vault=openVault({root,owner,safe});
  try{
    const id=vault.register({provider:'gmail',subject:'test-rebuild',label:box.label,credential:{}});
    const item=fromThread({...box,id},{id:'older',messages:[gMessage('original','영상 1편 견적 부탁드립니다.')]});
    vault.commit(id,{records:[{id:item.id,value:item}],complete:true,cursor:{generation:1}});
    const original=vault.snapshot({}).threads[0];
    vault.commit(id,{records:[],listFinished:true,cursor:{generation:2,mode:'history'}});
    vault.close();vault=openVault({root,owner,safe});
    assert.equal(vault.snapshot({}).threads[0].evidenceId,original.evidenceId);
    vault.commit(id,{records:[],complete:true,cursor:{generation:2,mode:'history'}});
    assert.equal(vault.snapshot({}).threadCount,0);
  }finally{vault.close();}
});

test('Gmail 변경 페이지에서 사라진 메일은 전체 확인 전까지 원래 기록을 보존하고 이전 승인을 잠근다',t=>{
  const root=tempRoot(t);let vault=openVault({root,owner,safe});
  try{
    const id=vault.register({provider:'gmail',subject:'delta',label:box.label,credential:{}});
    const item=fromThread({...box,id},{id:'tracked',messages:[gMessage('one','영상 1편 견적 부탁드립니다.')]});
    const put=(records,end=false)=>vault.commit(id,{records,complete:end,cursor:{generation:1,mode:'history'}});
    put([{id:item.id,value:item}],true);
    const current=vault.snapshot({}).threads[0];
    const input={threadId:item.id,evidenceId:current.evidenceId};
    vault.runAction('handoff',{...input,to:'견적 담당',next:'처리'});
    put([{id:item.id,value:null}]);
    vault.close();vault=openVault({root,owner,safe});
    const interim=vault.snapshot({});
    assert.equal(interim.threads[0].id,item.id);assert.equal(interim.threads[0].awaitingEvidence,true);
    assert.equal(interim.handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.runAction('quote',{...input,...fields}),{code:'STALE'});
    put([{id:item.id,value:item}],true);
    assert.equal(vault.snapshot({}).threads[0].evidenceId,current.evidenceId);
    put([{id:item.id,value:null}],true);
    assert.equal(vault.snapshot({}).threads.length,0);assert.equal(vault.snapshot({}).handoffs[0].currentEvidence,false);
  }finally{vault.close();}
});

test('근거 지문이 없던 버전의 견적과 인계는 원문을 다시 읽은 뒤에도 과거 기록으로 남는다',t=>{
  const root=tempRoot(t);let vault=openVault({root,owner,safe});
  try{
    const id=vault.register({provider:'gmail',subject:'old-format',label:box.label,credential:{}});
    const item=fromThread({...box,id},{id:'thread',messages:[gMessage('A','제품 영상 1편 견적 부탁드립니다. 수정 1회.')]});
    vault.commit(id,{records:[{id:item.id,value:item}],complete:true,cursor:{generation:1}});
    vault.close();
    const db=new (require('node:sqlite').DatabaseSync)(path.join(root,crypto.createHash('sha256').update(owner).digest('hex'),'work.sqlite'));
    try{
      const key=Buffer.from(safe.decryptString(Buffer.from(db.prepare("SELECT v FROM vault WHERE k='key'").get().v)),'hex');
      const seal=(purpose,data)=>{
        const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
        cipher.setAAD(Buffer.from(owner+'|'+purpose));
        const encrypted=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
        return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
      };
      const legacy={...item};delete legacy.reading;
      db.prepare('UPDATE threads SET v=? WHERE id=?').run(seal('thread:'+item.id,legacy),item.id);
      const old={threadId:item.id,boxId:id,evidenceId:'A',subject:item.subject};
      const work={jobs:[],quotes:[{...old,...quoteFields(fields),id:'old-q',version:1}],handoffs:[{...old,id:'old-h',status:'accepted',evidence:item.evidence}]};
      db.prepare("INSERT OR REPLACE INTO vault(k,v) VALUES('work',?)").run(seal('work',work));
      key.fill(0);
    }finally{db.close();}
    vault=openVault({root,owner,safe});
    assert.equal(vault.snapshot({}).threads[0].evidenceId,'');
    assert.equal(vault.snapshot({},0).handoffs[0].currentEvidence,false);
    assert.throws(()=>vault.runAction('finish',{id:'old-h'}),{code:'STALE'});
    vault.commit(id,{records:[{id:item.id,value:item}],complete:true,cursor:{generation:2}});
    const refreshed=vault.snapshot({});
    assert.ok(refreshed.threads[0].evidenceId);
    assert.notEqual(refreshed.threads[0].evidenceId,'A');
    assert.equal(refreshed.quotes[0].currentEvidence,false);
    assert.equal(refreshed.handoffs[0].currentEvidence,false);
  }finally{vault.close();}
});

test('자동으로 전달된 문의 양식, HTML 표시 조건, 알 수 없는 대체 본문을 구분한다', () => {
  const {gmailMessage}=require('../src/estimate-gmail.cjs');
  const first='30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 2회.';
  const mail=(id,payload,headers=[])=>gmailMessage({id,internalDate:'2',labelIds:['INBOX'],payload:{...payload,
    headers:[{name:'subject',value:'제품 영상 견적'},...headers]}});
  const part=(mimeType,text)=>({mimeType,body:{data:Buffer.from(text).toString('base64url')}});
  const form=mail('web-form',part('text/plain',first),[{name:'Auto-Submitted',value:'auto-generated'}]);
  assert.equal(inspectThread([form]).status,'reply');
  assert.equal(inspectThread([form]).quoteRequest.quantity,3);
  const old=letter('old',1,'영상 한 편 견적 부탁드립니다. 수정 1회.',{subject:form.subject});
  for(const flags of [{automatic:true},{generated:true},{bulk:true}]){
    const update={...letter('revision',2,'수정 2회. 희망 납품일은 12월 10일입니다.',{subject:'원래 문의'}),...flags};
    const current=inspectThread([old,update]);
    assert.equal(current.evidenceId,'revision');assert.equal(current.quoteRequest.revisions,2);
  }
  const uncertainSent=inspectThread([old,letter('unreadable',3,'',{subject:form.subject,outgoing:true,uncertain:'본문 해독 실패'})]);
  assert.equal(uncertainSent.evidenceId,'old');assert.equal(uncertainSent.status,'review');
  const {compactMessage}=require('../src/estimate-domain.cjs');
  const titleUpdate=letter('title',3,'',{subject:'Re: 영상 5편 견적'});
  const reread=[old,titleUpdate].map(m=>({...m,...compactMessage(m)}));
  assert.equal(inspectThread(reread).evidence,inspectThread([old,titleUpdate]).evidence);
  const boundary=inspectThread([old,letter('corrected',2,'자료를 첨부합니다.\n--\n영상 3편으로 변경해 주세요. 납품일은 12월 10일입니다.',{subject:form.subject})]);
  assert.equal(boundary.evidenceId,'corrected');
  assert.match(boundary.request,/3편/);assert.equal(boundary.quoteRequest.deadline,'12월 10일');
  const rendered=mail('forwarded',part('text/html','<p>파일 첨부합니다.</p><div class="gmail_quote"><p>수정 2회, 희망 납품일 12월 10일로 바꿔 주세요.</p><div class="gmail_attr">Forwarded message</div><p>옛 금액입니다.</p></div>'));
  const current=inspectThread([old,rendered]);
  assert.equal(current.evidenceId,'forwarded');assert.match(current.evidence,/수정 2회/);assert.doesNotMatch(current.evidence,/옛 금액/);
  const unreadable=mail('rtf',{mimeType:'multipart/alternative',parts:[part('text/plain',first),part('application/rtf','영상 5편')]});
  assert.equal(unreadable.partialBody,true);assert.equal(inspectThread([unreadable]).quoteRequest,null);
  const named=mail('named',{mimeType:'multipart/alternative',parts:[part('text/plain',first),{...part('application/rtf','영상 5편'),filename:'terms.rtf'}]});
  assert.equal(named.partialBody,true);
  const paired=url=>mail('link',{mimeType:'multipart/alternative',parts:[
    part('text/plain',first+'\n포트폴리오 (https://example.org/item)'),
    part('text/html','<p>'+first+'</p><p><a href="'+url+'">포트폴리오</a></p>')]});
  assert.equal(paired('https://example.org/item').partialBody,false);
  assert.equal(paired('https://example.org/other').partialBody,true);
  const linked=inspectThread([paired('https://example.org/item')]);assert.equal(linked.quoteRequest.review,false);
  const state=sampleState(), source=state.threads.find(t=>t.subject.includes('다온전시'));
  const run=(name,inputs)=>updateJob(state,name,inputs,()=>crypto.randomUUID(),1);
  const base={threadId:source.id,evidenceId:source.evidenceId};
  run('quote',{...base,...fields,scope:'30초 세로 제품 영상',allocation:10000});
  run('rememberQuote',{...base,quoteId:state.quotes[0].id,unit:'편',includedRevisions:1,expectedMethodId:''});
  state.threads.push({...linked,id:'linked',boxId:'checked'});
  const req={threadId:'linked',evidenceId:linked.evidenceId,methodId:state.quotes[0].repeatMethod.id};
  const a=titled(x=>run('repeatPreview',x),{...req,revisionMinutes:120,allocation:0});
  const b=titled(x=>run('repeatPreview',x),{...req,revisionMinutes:114,allocation:15000});
  assert.equal(a.replyDraft,b.replyDraft);assert.match(a.replyDraft,/726,000원/);assert.notEqual(a.previewKey,b.previewKey);
  const stored={...withTitle(req,a),expectedQuoteId:'',expectedDraft:a.replyDraft,previewKey:a.previewKey};
  assert.throws(()=>run('saveRepeatedQuote',{...stored,revisionMinutes:114,allocation:15000}),{code:'STALE'});
  run('saveRepeatedQuote',{...stored,revisionMinutes:120,allocation:0});
  assert.equal(state.quotes[0].total,726000);
  for(const hidden of ['style="display:none"','hidden','style="visibility: hidden"','aria-hidden="true"']){
    const h=mail('hidden',part('text/html','<p>영상 3편 견적 부탁드립니다.</p><span '+hidden+'>수정 1회</span>'));
    assert.equal(h.partialBody,hidden.includes('aria-hidden'));
    assert.match(h.text,/영상 3편/);
    assert.equal(inspectThread([h]).quoteRequest?.revisions??null,null);
    if(hidden.includes('aria-hidden')) assert.match(h.text,/수정 1회/);
    else assert.doesNotMatch(h.text,/수정 1회/);
  }
  const visible=mail('visible',part('text/html','<p>30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 2회.</p><span style="display:none">수정 5회.</span>'));
  assert.equal(inspectThread([visible]).quoteRequest.revisions,2);
  const markup='<p>30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 2회.</p><span style="display:none; display:block">제품 사진 3장도 부탁드립니다.</span>';
  const css=mail('css',part('text/html',markup));
  assert.equal(css.partialBody,true);assert.equal(inspectThread([css]).quoteRequest,null);
  const reasons=[];
  assert.match(require('../src/estimate-naver.cjs').htmlText(markup,reasons,true),/제품 사진 3장/);
  assert.ok(reasons.length);
  const commented=markup.replace('display:none; display:block','display:none; /* fallback */ display:block');
  const cssComment=mail('commented',part('text/html',commented));
  assert.equal(cssComment.partialBody,true);assert.match(cssComment.text,/제품 사진 3장/);
  assert.match(require('../src/estimate-naver.cjs').htmlText(commented,[],true),/제품 사진 3장/);
  for (const colon of ['&#58;', '&#x3a;', '&colon;']) {
    const encoded=markup.replace('display:block','display'+colon+'block');
    const message=mail('encoded',part('text/html',encoded));
    assert.ok(message.partialBody);
    assert.match(message.text,/제품 사진 3장/);
    assert.match(require('../src/estimate-naver.cjs').htmlText(encoded,[],true),/제품 사진 3장/);
    assert.equal(inspectThread([message]).quoteRequest,null);
  }
  const twoItems='<p>30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 2회.</p>' +
    '<div style="visibility:hidden"><span style="visibility:initial">제품 사진 3장도 부탁드립니다.</span></div>';
  const nestedItem=mail('nested-visibility',part('text/html',twoItems));
  assert.equal(nestedItem.partialBody,true);
  assert.equal(inspectThread([nestedItem]).quoteRequest,null);
  assert.match(nestedItem.text,/제품 사진 3장/);
  assert.match(require('../src/estimate-naver.cjs').htmlText(twoItems,[],true),/제품 사진 3장/);
  for(const element of ['style-note','img-note','blockquote-message']){
    const html='<p>30초 세로 제품 영상 3편 견적 부탁드립니다. <'+element+'>제품 사진 3장도 부탁드립니다.</'+element+'><style>p{font-weight:bold}</style> 수정 2회.</p>';
    const trial=mail('custom-element',part('text/html',html));
    assert.match(trial.text,/제품 사진 3장/);
    assert.match(require('../src/estimate-naver.cjs').htmlText(html,[],true),/제품 사진 3장/);
    assert.ok(trial.partialBody || inspectThread([trial]).quoteRequest.review);
  }
  for (const nested of ['<p style="display:none">미리보기<p>제품 사진 3장도 부탁드립니다.</p>',
    '<ul><li hidden>안내<li>제품 사진 3장도 부탁드립니다.</li></ul>',
    '<div hidden><span>기타 참고</span></div><p>제품 사진 3장도 부탁드립니다.</p>',
    '<td style="display:none">제품 사진 3장도 부탁드립니다.</td>',
    '<p style=\'font-family:"A;display:none;B"\'>제품 사진 3장도 부탁드립니다.</p>',
    '<span style="display:&#160;none">제품 사진 3장도 부탁드립니다.</span>',
    '<span style="display:\u00a0none">제품 사진 3장도 부탁드립니다.</span>',
    '<head>제품 사진 3장도 부탁드립니다.</head>',
    '<title>제품 사진 3장도 부탁드립니다.</title>',
    '<head><p>제품 사진 3장도 부탁드립니다.</p></head>',
    '<!-- 메모 --!> 제품 사진 3장도 부탁드립니다. <!-- 끝 -->',
    '<p title="<!-- 메모">제품 사진 3장도 부탁드립니다.</p><!-- 끝 --!>',
    '<textarea><style>제품 사진 3장도 부탁드립니다.</style></textarea>',
    '<select><option>제품 사진 3장도 부탁드립니다.</option></select>',
    '<select><span style="display:none">제품 사진 3장도 부탁드립니다.</span></select>']) {
    const full='<p>30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 2회.</p>'+nested;
    const msg=mail('unclosed-block',part('text/html',full));
    assert.ok(msg.partialBody,nested);assert.equal(inspectThread([msg]).quoteRequest,null);
    assert.match(msg.text,/제품 사진 3장/);
    assert.match(require('../src/estimate-naver.cjs').htmlText(full,[],true),/제품 사진 3장/);
  }
});

test('메일함 요약에는 현재 견적의 조건만 남고 다른 본문과 발신 미확인 답장은 구별된다',async t=>{
  const {publicView}=require('../src/estimate-domain.cjs');
  const {outlookMessage}=require('../src/estimate-outlook.cjs');
  const gmail=require('../src/estimate-gmail.cjs'),naver=require('../src/estimate-naver.cjs');
  const old=letter('request',1,'30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 2회입니다.',{subject:'제품 영상 견적'});
  const padding=Array(35).fill('> 인용한 이전 거래 메시지입니다.').join('\n');
  const mail=inspectThread([{...old,text:old.text+'\n'+padding}]);
  const summary=publicView({threads:[mail],boxes:[],quotes:[],jobs:[],handoffs:[]},{}).threads[0];
  assert.equal(summary.request,'30초 세로 제품 영상 3편 · 수정 2회 · 희망 납품일 확인 필요');
  assert.ok(summary.request.length*8<(old.text+padding).length);
  assert.doesNotMatch(summary.request,/이전 거래/);
  const part=(mimeType,text)=>({mimeType,body:{data:Buffer.from(text).toString('base64url')}});
  const item={id:'multipart',payload:{mimeType:'multipart/alternative',parts:[part('text/plain','납품일 12월 4일'),part('text/html','<p>납품일 12월 10일</p>')]}};
  const original=await gmail.readOriginal({box,ref:{id:item.id},api:{profile:async()=>({emailAddress:box.label}),message:async()=>item}});
  assert.equal(original.partial,true);assert.match(original.text,/본문 1[\s\S]*12월 4일[\s\S]*본문 2[\s\S]*12월 10일/);
  assert.equal(gmail.gmailMessage({...item,internalDate:'1',labelIds:[]}).bodySource,'plain');
  const raw=Buffer.from('Content-Type: multipart/alternative; boundary=part\r\n\r\n--part\r\nContent-Type: text/plain\r\n\r\nPlain content\r\n--part\r\nContent-Type: text/html\r\n\r\n<p>Plain content</p><img alt="more details">\r\n--part--\r\n');
  const multi=naver.findText(raw,0,null,false,'',true);
  assert.equal(multi.partial,true);assert.match(multi.plain,/more details/);
  const duplicates=Buffer.from('Content-Type: multipart/alternative; boundary=both\r\n\r\n--both\r\nContent-Type: text/plain\r\n\r\nToday\r\n\r\n> Previous reply\r\n--both\r\nContent-Type: text/html\r\n\r\n<p>Today</p><blockquote>Previous reply</blockquote>\r\n--both--\r\n');
  const same=naver.findText(duplicates,0,null,false,'',true);
  assert.equal(same.partial,false);assert.equal(same.plain.match(/Previous reply/g).length,1);
  const styles=['<style>p {font-family: Arial, sans-serif;}</style>','<p style="opacity:0.5">납기: 12월 10일</p>'];
  const flags=[];
  assert.equal(naver.htmlText(styles.join(''),flags,true),'납기: 12월 10일');assert.deepEqual(flags,[]);
  const styled=naver.findText(Buffer.from(duplicates.toString().replace('<p>Today</p>',styles[0]+'<p>Today</p>')),0,null,false,'',true);
  assert.equal(styled.partial,false);
  const root=tempRoot(t),vault=openVault({root,owner,safe});
  try {
    const boxId=vault.register({provider:'outlook',subject:'profile',label:box.label,credential:{}});
    const make=(key,from,to,folder,body,day)=>outlookMessage({boxId,me:box.label,folder:{id:folder,role:folder},item:{
      id:key,conversationId:'one',from:{emailAddress:{address:from}},sender:{emailAddress:{address:from}},toRecipients:[{emailAddress:{address:to}}],
      receivedDateTime:'2026-11-'+day+'T00:00:00Z',subject:old.subject,uniqueBody:{contentType:'text',content:body}}});
    const customer=make('customer','buyer@example.org',box.label,'inbox',old.text,'20');
    const reply=make('reply','another-alias@example.org','buyer@example.org','sent','회신드립니다.','21');
    const add=(messages,removed=[])=>vault.commit(boxId,{messages,removed,complete:true,cursor:{}});
    add([customer]);
    const approved=vault.snapshot({}).threads[0].evidenceId;
    add([reply]);
    const check=()=>{const latest=vault.snapshot({}).threads[0];assert.notEqual(latest.evidenceId,approved);assert.equal(latest.status,'review');assert.equal(latest.quoteRequest,null);assert.equal(vault.originalTarget({threadId:latest.id,evidenceId:latest.evidenceId}).ref.id,'reply');};
    check();
    const archived=make('reply','another-alias@example.org','buyer@example.org','archive','회신드립니다.','21');
    add([archived],[reply.id]);
    check();
    const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
    const db=new (require('node:sqlite').DatabaseSync)(path.join(root,hash(owner),'work.sqlite'));
    try {db.prepare('INSERT INTO sent_proof(box,key) VALUES(?,?)').run(boxId,hash(reply.evidenceId));} finally{db.close();}
    add([archived]);
    check();
    add([make('reply','another-alias@example.org',box.label,'archive','제품 영상 5편 견적 부탁드립니다. 수정 1회.','21')]);
    assert.notEqual(vault.snapshot({}).threads[0].evidenceId,approved);
    const personal=vault.register({provider:'outlook',subject:'consumer-profile',label:'solio-qa-no-send@outlook.com',credential:{}}); // 공개허용: 로컬 시험이 만든 개인 도메인 예시로 메일을 보내지 않는다.
    vault.commit(personal,{messages:[customer],complete:true,cursor:{}});
    const selected=vault.snapshot({}).threads.find(t=>t.boxId===personal);
    assert.equal(vault.originalTarget({threadId:selected.id,evidenceId:selected.evidenceId}).home,'https://outlook.live.com/mail/');
    const custom=vault.register({provider:'outlook',subject:'custom-profile',label:'member@example.org',credential:{}});
    vault.commit(custom,{messages:[customer],complete:true,cursor:{}});
    const customMail=vault.snapshot({}).threads.find(t=>t.boxId===custom);
    assert.equal(vault.originalTarget({threadId:customMail.id,evidenceId:customMail.evidenceId}).home,'https://www.microsoft.com/ko-kr/microsoft-365/outlook/log-in');
  } finally {vault.close();}
});

test('한 품목을 두 번 나열하거나 제목과 본문의 조건이 어긋나면 가격과 확정 안내를 보류한다', () => {
  const {readQuoteRequest,repeatProposal}=require('../src/estimate-repeat.cjs');
  const printed=readQuoteRequest('감사합니다 카드 100장 견적을 부탁드립니다. 수정 1회를 원합니다.','카드 견적');
  assert.equal(printed.scope,'감사합니다 카드');
  const cardProposal=repeatProposal({...fields,scope:'카드',repeatMethod:{unit:'장',includedRevisions:1}},
    {quoteRequest:printed,subject:'카드 견적'}, {},quoteFields);
  assert.equal(cardProposal.fields,null);assert.doesNotMatch(cardProposal.replyDraft,/[0-9,]+원/u);
  assert.equal(readQuoteRequest('감사합니다.\n카드 100장 견적을 부탁드립니다. 수정 1회.','카드 견적').scope,'카드');
  const {compactMessage}=require('../src/estimate-domain.cjs');
  assert.equal(compactMessage({text:'파도문구의 작업입니다.',subject:'작업 기록'}).signals.asks,false);
  assert.equal(compactMessage({text:'문 의 드립니다.',subject:'작업 기록'}).signals.asks,true);
  assert.ok(readQuoteRequest('기존 제품 영상 1편 견적 부탁드립니다. 수정 1회.','신상품 영상 1편 견적 문의').review);
  const labelled='품목: 30초 세로 제품 영상\n수량: 1편\n';
  assert.ok(readQuoteRequest(labelled+labelled+'수정 1회.','제품 영상 견적').review);
  for(const body of [labelled+'30초 세로 제품 영상 1편 견적 부탁드립니다.','제품 영상 1편, 썸네일 3장','제품 영상 한 편 및 썸네일 세 장']) {
    assert.ok(readQuoteRequest(body+'\n수정 1회.','견적 문의').review,body);
  }
  assert.ok(readQuoteRequest('제품 영상 1편. 수정 1회.','제품 영상 급한 작업 견적 문의').review);
  assert.ok(readQuoteRequest('행사 영상 1편. 수정 1회.','행사 영상 1편 매장 진열 견적 문의').review);
  const deadline=readQuoteRequest('행사 영상 1편. 수정 1회. 희망 납품일은 12월 10일입니다.','12월 17일 납품');
  assert.ok(deadline.review);assert.equal(deadline.deadline,'');assert.match(deadline.conditionConflict,/12월 17일, 본문에는 12월 10일/);
  assert.ok(readQuoteRequest('기존 제품 영상 1편. 수정 1회.','신규 제품 영상 견적 문의').review);
  assert.match(readQuoteRequest(labelled+'수정 1회.','제품 영상 수정 2회 견적 문의').conditionConflict,/제목에는 수정 2회, 본문에는 수정 1회/);
  assert.equal(readQuoteRequest(labelled+'수정 1회.','수정 2회로 변경 요청').revisions,null);
  assert.equal(readQuoteRequest(labelled+'수정 1회. 납품일: 12월 10일. 납품 일정은 12월 10일 대신 12월 17일로 잡아 주실 수 있을까요?','제품 영상 견적').deadline,'');
});

test('자동 안내와 보내고 받는 말을 대조하고 기한·수정 상한·다른 품목을 구별한다',()=>{
  const {readQuoteRequest,repeatProposal}=require('../src/estimate-repeat.cjs');
  const old=letter('a',1,'30초 세로 제품 영상 3편 견적 회신 바랍니다. 수정은 2회입니다.',{subject:'파도문구 신상품 영상 견적',senderName:'파도문구'});
  const sent=letter('b',2,'견적을 보냅니다.',{outgoing:true,subject:old.subject});
  assert.equal(inspectThread([old]).status,'reply');assert.equal(inspectThread([old]).quoteRequest.quantity,3);
  const reply=letter('c',3,'급한 문의는 고객지원팀에 연락해 주세요.',{automatic:true,subject:'Re: '+old.subject});
  for(const follow of [reply,{...reply,automatic:false,text:'안녕하세요.\n참고 자료를 첨부합니다. 감사합니다.'}]){
    const result=inspectThread([old,sent,follow]);assert.equal(result.status,'waiting');assert.equal(result.evidenceId,'a');
  }
  const attachment={...reply,automatic:false,text:'참고 자료 첨부합니다.',hasAttachments:true,originalRef:{id:'attachment'}};
  const newFile=inspectThread([old,sent,attachment]);
  assert.equal(newFile.status,'review');assert.equal(newFile.evidenceId,'c');
  assert.equal(newFile.quoteRequest,null);assert.deepEqual(newFile.originalRef,{id:'attachment'});
  const newerFile={...attachment,id:'second-file',at:4,originalRef:{id:'second-file'}};
  assert.equal(inspectThread([old,sent,attachment,newerFile]).originalRef.id,'second-file');
  for (const flags of [{bulk:true},{automatic:true},{bulk:true,automatic:true}]) {
    const latest=inspectThread([old,sent,attachment,{...newerFile,...flags}]);
    assert.equal(latest.originalRef.id,'second-file');
    assert.equal(latest.status,'review');
    assert.equal(latest.quoteRequest,null);
  }
  const cancel=inspectThread([old,sent,{...reply,automatic:true,bulk:true,text:'이번 주문을 취소합니다.'}]);
  assert.equal(cancel.evidenceId,reply.id);assert.match(cancel.evidence,/취소/);
  assert.equal(inspectThread([old,{...sent,text:'내일까지 답변을 드리겠습니다.'}]).status,'promise');
  for (const body of ['이번 주문을 취소해 주세요.','작업을 중단합니다.','색상을 바꿔 주세요.']) {
    const changed=inspectThread([old,sent,{...reply,text:body}]);
    assert.equal(changed.evidenceId,'c');
    assert.match(changed.request,new RegExp(body.slice(0,-1)));
    assert.notEqual(changed.status,'waiting');
    assert.equal(changed.quoteRequest.review,true);
  }
  const body='제품 영상 3편 견적 회신 바랍니다. 수정 1회입니다.';
  assert.equal(readQuoteRequest(body,'제품 영상 수정 2회까지 견적 문의').review,false);
  assert.match(readQuoteRequest(body.replace('1회','3회'),'제품 영상 수정 2회까지 견적 문의').conditionConflict,/수정 범위/);
  for (const basis of ['수정 2회까지 기준','견적 기준: 수정 2회까지','수정 2회 이내를 기준으로']) {
    const title='제품 영상 견적 문의 ('+basis+')';
    const different=readQuoteRequest(body,title);
    assert.equal(different.review,true,basis);
    assert.match(different.conditionConflict,/수정 범위/);
    assert.equal(readQuoteRequest(body.replace('1회','2회'),title).review,false,basis);
  }
  for (const separator of [', ','·','，']) {
    const paid=readQuoteRequest(body,'12월 10일 결제일'+separator+'제품 영상 견적 문의');
    assert.equal(paid.review,true,separator);
    assert.match(paid.conditionConflict,/결제 조건/);
  }
  assert.equal(readQuoteRequest(body,'12월 10일 행사일, 제품 영상 견적 문의').review,false);
  assert.ok(readQuoteRequest('제품 사진 2장이랑 소개 영상 3편 견적을 부탁드립니다. 수정 1회입니다.','견적 문의').review);
  const request=readQuoteRequest(body+' 납기는 12월 10일까지입니다.','제품 영상 견적');
  const confirmed=readQuoteRequest(body+' 희망 납품일은 12월 10일입니다.','제품 영상 3편 수정 1회, 희망 납품일 12월 10일');
  assert.equal(confirmed.review,false);assert.equal(confirmed.revisions,1);assert.equal(confirmed.deadline,'12월 10일');
  const fixed=readQuoteRequest(body+' 납기: 12월 10일','제품 영상 견적');
  assert.equal(fixed.deadlineIsLimit,true);
  assert.match(repeatProposal({...fields,scope:'제품 영상',repeatMethod:{unit:'편',includedRevisions:1}}, {quoteRequest:fixed,subject:'제품 영상 견적'}, {},quoteFields).replyDraft,/납품 기한은 12월 10일까지/);
  const desired=readQuoteRequest(body+' 납기는 12월 10일을 희망합니다.','제품 영상 견적');
  assert.equal(desired.review,false);
  assert.equal(Boolean(desired.deadlineIsLimit),false);
  const desiredQuote=repeatProposal({...fields,scope:'제품 영상',repeatMethod:{unit:'편',includedRevisions:1}},
    {quoteRequest:desired,subject:'제품 영상 견적'}, {},quoteFields);
  assert.equal(desiredQuote.fields.deadline,'12월 10일');
  assert.match(desiredQuote.replyDraft,/희망 납품일은 12월 10일/);
  const disputed=readQuoteRequest(body+' 납기는 12월 10일까지 희망합니다.','제품 영상 견적');
  assert.equal(disputed.review,true);
  assert.equal(disputed.deadline,'');
  const proposal=repeatProposal({...fields,scope:'제품 영상',repeatMethod:{unit:'편',includedRevisions:1}}, {quoteRequest:request,subject:'제품 영상 견적'}, {},quoteFields);
  assert.equal(proposal.fields.deadline,'12월 10일까지');assert.match(proposal.replyDraft,/납품 기한은 12월 10일까지/);
  assert.doesNotMatch(proposal.replyDraft,/희망 납품일/);
  const gmail=require('../src/estimate-gmail.cjs');
  const part=(mimeType,body)=>({mimeType,body:{data:Buffer.from(body).toString('base64url')}});
  const html='<p>'+body+'</p><p><a href="https://example.org/work">포트폴리오</a></p><img alt="" role="presentation" src="cid:logo">';
  const message=gmail.gmailMessage({...gMessage('declared',body),payload:{mimeType:'multipart/alternative',parts:[part('text/plain',body+'\n포트폴리오 <https://example.org/work>'),part('text/html',html)]}});
  assert.equal(message.partialBody,false);
  assert.equal(inspectThread([{...message,subject:'제품 영상 견적'}]).quoteRequest.quantity,3);
});

test('원문을 누른 메시지 한 통만 열고 요약·다른 회원·해제 뒤 응답에 본문을 남기지 않는다',async t=>{
  const root=tempRoot(t),store=openVault({root,owner,safe}),calls=[],links=[];
  const id=store.register({provider:'gmail',subject:box.label,label:box.label,credential:{}});
  const payload=gMessage('picked','제품 영상 견적을 부탁드립니다.');
  const source=fromThread({id,label:box.label},{id:'container-thread',messages:[payload]});
  store.commit(id,{records:[{id:source.id,value:source}],complete:true,cursor:{generation:1}});
  const read=()=>store.snapshot({}).threads[0];
  const input={threadId:read().id,evidenceId:read().evidenceId};
  const sentinel='선택한 메시지 원문에만 있는 가상 문장';
  let pending,entered;const paused=new Promise(r=>{entered=r;});
  const svc=createEstimateService({root,owner,safe,isCurrent:()=>true,makeVault:()=>store,readConfig:async()=>({gmail:{}}),openExternal:async u=>links.push(u),
    gmailApi:()=>({profile:async()=>({emailAddress:box.label}),message:async msgId=>{
      calls.push(msgId);if(calls.length===2)await new Promise(r=>{pending=r;entered();});
      return gMessage(msgId,'요청입니다.\n> '+sentinel);
    }})});
  try {
    assert.equal(read().canReadOriginal,true);assert.equal(read().directOriginal,true);assert.ok(!('originalRef' in read()));
    assert.deepEqual(calls,[]);assert.equal((await svc.action('openOriginal',input)).ok,true);
    const path=new URL(links[0]);assert.equal(path.origin,'https://mail.google.com');assert.equal(path.searchParams.get('th'),'picked');assert.equal(path.searchParams.get('authuser'),box.label);
    const body=await svc.action('readOriginal',{...input,url:'https://example.org/',id:'wrong'});assert.equal(body.ok,true);
    assert.ok(body.original.text.includes(sentinel));assert.deepEqual(calls,['picked']);assert.ok(!JSON.stringify(await svc.snapshot()).includes(sentinel));
    assert.equal((await svc.action('readOriginal',{...input,evidenceId:'superseded'})).code,'STALE');assert.equal(calls.length,1);
    const foreign=openVault({root,owner:other,safe});
    try{assert.throws(()=>foreign.originalTarget(input),{code:'STALE'});}finally{foreign.close();}
    const flight=svc.action('readOriginal',input);await paused;
    await svc.action('disconnect',{id,confirm:true});pending();
    const closed=await flight;assert.equal(closed.ok,false);assert.ok(!JSON.stringify(closed).includes(sentinel));
  }finally{svc.close();}
});

test('고객 원문을 기준으로 인계 완료와 같은 대화의 새 견적을 구별한다',t=>{
  let vault;
  t.after(()=>vault?.close());
  vault=openVault({root:tempRoot(t),owner,safe});
  const boxId=vault.register({provider:'gmail',subject:'customer-origin',label:'store@example.test',credential:{}});
  const subject='제품 영상 견적',threadId='one-conversation';
  const incoming=(id,at,count)=>letter(id,at,'30초 세로 제품 영상 '+count+'편 견적 부탁드립니다. 수정 1회.',{subject});
  const first=incoming('customer-first',1,1);
  function sync(messages){
    const value=inspectThread(messages,text=>crypto.createHash('sha256').update(text).digest('hex'));
    vault.commit(boxId,{records:[{id:threadId,value:{...value,id:threadId,boxId}}],cursor:{generation:1},complete:true});
    return vault.snapshot({}).threads[0];
  }
  const evidence=thread=>({threadId,evidenceId:thread.evidenceId});
  let thread=sync([first]);
  vault.runAction('quote',{...evidence(thread),...fields,scope:'30초 세로 제품 영상'});
  const quote=vault.snapshot({}).quotes[0];
  vault.runAction('rememberQuote',{...evidence(thread),quoteId:quote.id,unit:'편',includedRevisions:1,expectedMethodId:''});
  const methodId=vault.snapshot({}).quotes[0].repeatMethod.id;
  vault.runAction('handoff',{...evidence(thread),to:'견적 담당',next:'수량 확인'});
  const handoff=vault.snapshot({}).handoffs[0];
  vault.runAction('accept',{id:handoff.id});
  const signature=letter('sent-with-signature',2,'메일 잘 받았습니다. 감사합니다.\n김새길 드림',{subject,outgoing:true});
  thread=sync([first,signature]);
  assert.equal(thread.needsReceiptReview,true);
  assert.equal(thread.canRepeatSameThread,false);
  assert.equal(vault.snapshot({}).handoffs[0].currentEvidence,true);
  assert.throws(()=>vault.runAction('repeatPreview',{...evidence(thread),methodId}),{code:'VALUE'});
  vault.runAction('finish',{id:handoff.id});
  vault.confirmReceipt(evidence(thread));
  thread=vault.snapshot({}).threads[0];
  assert.throws(()=>vault.runAction('repeatPreview',{...evidence(thread),methodId}),{code:'VALUE'});
  thread=sync([first,signature,incoming('customer-second',3,2)]);
  assert.equal(thread.canRepeatSameThread,true);
  assert.equal(titled(x=>vault.runAction('repeatPreview',x),{...evidence(thread),methodId}).canSave,true);
  thread=sync([first]);
  assert.equal(thread.canRepeatSameThread,false);
});

test('촬영일·촬영 횟수 정정과 제목에서 부정한 수량을 견적 조건으로 옮기지 않는다',()=>{
  const {readQuoteRequest}=require('../src/estimate-repeat.cjs');
  const body='30초 세로 제품 영상 3편 견적 문의드립니다.\n수정 1회.\n납기: 12월 20일.';
  const date=readQuoteRequest(body+' 촬영일은 12월 10일입니다. 정정합니다. 12월 12일입니다.','제품 영상 견적');
  const count=readQuoteRequest(body+' 촬영 횟수는 1회입니다. 정정합니다. 2회입니다.','제품 영상 견적');
  assert.equal(date.deadline,'12월 20일');assert.equal(count.revisions,1);
  const clean=readQuoteRequest(body,'수정 2회가 아닌 1회로 견적 부탁드립니다');
  assert.equal(clean.quantity,3);assert.equal(clean.revisions,1);
  assert.doesNotMatch(clean.conditionConflict || '',/제목에는 수정 2회/u);
  const separate=readQuoteRequest('30초 세로 제품 영상 3편.\n견적 문의드립니다.\n수정 1회','제품 영상 견적');
  assert.equal(separate.review,false);assert.equal(separate.quantity,3);
});

test('전체 메일을 읽을 때 글꼴과 줄표를 허용하고 취소한 금액은 구분해 표시한다',()=>{
  const {htmlText}=require('../src/estimate-naver.cjs');
  const {originalBodyVersions,compactMessage}=require('../src/estimate-domain.cjs');
  const reasons=[];
  const style='<style type="text/css" style="display:none"><!-- p {font-size:11pt;margin-top:0} --></style>';
  const original=htmlText('<html><head>'+style+'</head><body><p>견적은 <s>726,000원</s> 561,000원입니다.</p></body></html>',reasons,true);
  assert.deepEqual(reasons,[]);assert.match(original,/〔취소선〕726,000원〔\/취소선〕 561,000원/);
  assert.equal(compactMessage({outgoing:true,text:original,subject:'견적'}).signals.statedQuoteTerms,true);
  const onlyWithdrawn=htmlText('<p style="text-decoration:line-through">견적은 726,000원입니다.</p><p>다시 확인해 안내드리겠습니다.</p>',[],true);
  const terms=compactMessage({outgoing:true,text:onlyWithdrawn,subject:'견적'}).signals;
  assert.equal(terms.statedQuoteTerms,false);assert.equal(terms.termReview,true);
  assert.equal(originalBodyVersions(['- 자료 확인\n> 앞의 대화','• 자료 확인\n> 앞의 대화']).length,1);
  assert.equal(originalBodyVersions(['- 자료 확인\n> 다른 대화','• 자료 확인\n> 앞의 대화']).length,2);
});

test('메일의 항목 번호와 가격은 줄을 나누고 0 여백이 있는 원문도 끝까지 읽는다', () => {
  const { htmlText } = require('../src/estimate-naver.cjs');
  for (const original of [false, true]) {
    for (const markup of ['<div>옵션 1<hr>20,000원</div>', '<div>옵션 1<p>20,000원</p></div>']) {
      const reasons = [];
      assert.equal(htmlText(markup, reasons, original), '옵션 1\n20,000원');
      assert.deepEqual(reasons, []);
    }
    assert.equal(htmlText('<p>₩<span>20</span>,000</p>', [], original), '₩20,000');
    const body = '<p>확인했습니다.</p><p>김지훈 드림</p>';
    const sheet = css => '<html><head><style>p {' + css + '}</style></head><body>' + body + '</body></html>';
    for (const css of ['margin:0in', 'margin:0pt 0cm .0rem 0%', 'margin-top:0Q !important',
      'text-align: left', 'text-align: center !important; margin:0in', 'font-weight:normal; text-align: end']) {
      const reasons = [];
      assert.equal(htmlText(sheet(css), reasons, original), '확인했습니다.\n김지훈 드림');
      assert.deepEqual(reasons, []);
    }
    for (const markup of [
      sheet('margin:0in; display:none'),
      sheet('text-align: left; visibility:hidden'),
      sheet('text-align:var(--alignment)'),
      '<style>@import url(https://css.example.test/main.css); p {text-align:left}</style>' + body,
      '<link rel="stylesheet" href="https://css.example.test/main.css">' + body,
    ]) {
      const reasons = [];
      assert.equal(htmlText(markup, reasons, original), '확인했습니다.\n김지훈 드림');
      assert.ok(reasons.length);
    }
  }
});
