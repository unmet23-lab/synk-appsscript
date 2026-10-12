import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientMaterialsService} from './client-materials.mjs';
import {createClientRightsService} from './client-rights.mjs';
import {clientDeliveryIdentity} from './client-closeout.mjs';
import {applySceneRequestAction,recordSceneReview} from './client-scene-requests.mjs';
import {createClientCompletionRecordsService} from './client-completion-records.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const at='2026-10-13T03:00:00.000Z';
const status=(fn,expected)=>assert.throws(fn,error=>error.status===expected);
const section=(report,name)=>report.sections.find(item=>item.id===name).rows;
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-completion-records-')),store=new Store(directory);let now=at;
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-completion-records-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['peer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@completion.test',role,teamId});
  const clock=()=>now,projects=createClientProjectsService({store,clock}),materials=createClientMaterialsService({store,clientProjects:projects,clock}),rights=createClientRightsService({store,clientProjects:projects,clientMaterials:materials,clock}),options={store,clientProjects:projects,clientMaterials:materials,clientRights:rights,clock},service=createClientCompletionRecordsService(options);
  const project=projects.save(users.owner,{title:'합성 프로젝트',customerName:'합성 고객',reviewerId:users.reviewer.id,contact:'PRIVATE-CONTACT',internalNotes:'PRIVATE-INTERNAL-NOTES'}).project;
  const row=()=>store.get('clientProjects',project.id),put=update=>store.put('clientProjects',project.id,{...row(),...update}),prepare=(name='owner')=>service.prepare(users[name],project.id);
  const snapshot=()=>createHash('sha256').update(JSON.stringify({documents:store.db.prepare('SELECT * FROM documents ORDER BY kind,id').all(),tokens:store.db.prepare('SELECT * FROM tokens ORDER BY hash').all(),credentials:store.db.prepare('SELECT * FROM credentials ORDER BY id').all()})).digest('hex');
  function add(kind,label=kind,extra={}){projects.addVersion(users.owner,project.id,{revision:row().revision,kind,label,url:'https://example.test/'+kind+'.mp4',guide:kind==='final'?'합성 최종본 사용 안내':'',...extra});return row().versions.at(-1);}
  function completed(){const preview=add('preview','승인 시안'),invite=projects.invite(users.owner,project.id,{revision:row().revision}),opened=projects.open(invite.invite);projects.customerAction(opened.session,opened.csrf,{revision:row().revision,action:'approve',versionId:preview.id});const final=add('final','납품본');projects.customerAction(opened.session,opened.csrf,{revision:row().revision,action:'confirm_delivery',deliveryKey:clientDeliveryIdentity(row()).deliveryKey,confirmed:true});projects.closeout(users.owner,project.id,{revision:row().revision,action:'close',deliveryKey:clientDeliveryIdentity(row()).deliveryKey,confirmed:true});return {preview,final,opened};}
  function reference(){put({studio:{assets:[],references:[{id:id(10),label:'참고 자료',url:'https://example.test/reference.png',at}],concepts:[],scenes:[],comments:[],sceneReviews:[],history:[]}});}
  function saveRight(targetId='material:reference:'+id(10),overrides={}){const workspace=rights.workspace(users.owner,project.id),target=workspace.items.find(item=>item.targetId===targetId);return rights.save(users.owner,project.id,{expectedRevision:workspace.revision,projectRevision:workspace.projectRevision,targetId,sourceFingerprint:target.sourceFingerprint,status:'allowed',scope:'홈페이지에서 사용',evidence:'합성 확인 근거',agreedAt:'2026-10-13',expiryMode:'none',expiresAt:'',...overrides});}
  return {directory,store,users,projects,materials,rights,service,options,projectId:project.id,row,put,prepare,snapshot,add,completed,reference,saveRight,setNow(value){now=value}};
}

test('incomplete reports expose all nine scalar sections without changing any stored source',async t=>{
  const f=await fixture(t),before=f.snapshot(),report=f.prepare();assert.equal(report.schema,1);assert.equal(report.status,'no_delivery');assert.match(report.statusLabel,/납품 전/);assert.deepEqual(report.sections.map(item=>item.id),['current_summary','approval','delivery','receipt_history','closeout_history','customer_requests','scene_requests','rights_current','rights_history']);assert.deepEqual(section(report,'approval'),[]);assert.deepEqual(section(report,'delivery'),[]);assert.match(report.warnings.join(' '),/완료를 확정하거나 업무 상태를 바꾸지 않습니다/);assert.equal(f.snapshot(),before);assert.match(report.fingerprint,/^[a-f0-9]{64}$/);assert.ok(Object.values(report.counts).every(value=>Number.isSafeInteger(value)&&value>=0));
  for(const part of report.sections)for(const row of part.rows){assert.deepEqual(Object.keys(row),part.columns.map(column=>column.key));assert.ok(Object.values(row).every(value=>['string','number','boolean'].includes(typeof value)));}
});

test('canonical approval, final delivery, customer receipt and closure retain exact historical summary and remain read-only',async t=>{
  const f=await fixture(t),{preview,final}=f.completed(),before=f.snapshot(),report=f.prepare();assert.equal(report.status,'closed');assert.equal(report.counts.currentFinalFiles,1);assert.equal(section(report,'approval')[0].approvedAt,at);assert.equal(section(report,'delivery')[0].label,final.label);assert.match(section(report,'approval')[0].source,new RegExp(preview.id));assert.match(section(report,'receipt_history')[0].application,/현재 납품 묶음/);assert.match(section(report,'closeout_history')[0].application,/현재 상태/);assert.equal(section(report,'closeout_history')[0].summary,f.row().closureHistory[0].summaryText);assert.equal(f.snapshot(),before);
  f.setNow('2026-10-13T03:01:00.000Z');const later=f.prepare();assert.notEqual(later.generatedAt,report.generatedAt);assert.equal(later.fingerprint,report.fingerprint);assert.equal(f.snapshot(),before);
});

test('a new preview cannot inherit old approval, receipt or closure and historical summary is never regenerated',async t=>{
  const f=await fixture(t);f.completed();const original=f.row().closureHistory[0].summaryText;f.add('preview','새 시안');f.put({title:'현재만 바뀐 이름'});const before=f.snapshot(),report=f.prepare();assert.equal(report.status,'no_delivery');assert.equal(section(report,'approval')[0].status,'승인 대기');assert.equal(report.counts.currentFinalFiles,0);assert.match(section(report,'receipt_history')[0].application,/이전 기록/);assert.match(section(report,'closeout_history')[0].application,/이전 마감 기록/);assert.equal(section(report,'closeout_history')[0].summary,original);assert.doesNotMatch(section(report,'closeout_history')[0].summary,/현재만 바뀐 이름/);assert.equal(f.snapshot(),before);
});

test('changing the delivered file set invalidates current receipt and portfolio consent while retaining both histories',async t=>{
  const f=await fixture(t);f.completed();f.saveRight('portfolio');const original=f.prepare();f.add('final','추가 납품');const report=f.prepare(),portfolio=section(report,'rights_current').find(item=>item.label.includes('포트폴리오'));assert.equal(report.status,'waiting_receipt');assert.equal(report.counts.currentFinalFiles,2);assert.equal(portfolio.status,'미확인');assert.equal(portfolio.scope,'');assert.match(section(report,'rights_history')[0].application,/현재 원본에 적용하지 않음/);assert.equal(section(report,'rights_history')[0].status,'허용 기록 있음');assert.match(section(report,'receipt_history')[0].application,/이전 기록/);assert.notEqual(report.fingerprint,original.fingerprint);
});

test('staff-written receipt and completion markers without source proof cannot claim customer confirmation or completed feedback',async t=>{
  const f=await fixture(t);f.completed();const row=f.row();row.deliveryReceipts[0].actor=f.users.owner.id;row.messages.push({id:id(21),author:'customer',visibility:'customer',action:'feedback',text:'반영 요청',resolved:true,workflow:{status:'done',resultVersionId:id(22),history:[]}},{id:id(23),author:'customer',visibility:'customer',action:'support',text:'문의',resolved:true});f.put(row);const report=f.prepare();assert.equal(report.status,'waiting_receipt');assert.equal(report.counts.pendingCustomerRequests,2);assert.match(section(report,'receipt_history')[0].proof,/근거 확인 필요/);assert.ok(section(report,'customer_requests').every(item=>item.status.includes('완료 근거 확인 필요')));assert.ok(section(report,'customer_requests').every(item=>item.completedAt===''));
});

function sceneFixture(f){
  f.put({reviewerId:null,stage:'producing',sceneRequestWorkflows:{},studio:{assets:[],references:[],concepts:[],scenes:[{id:id(30),title:'장면 제목',description:'수정한 장면',revision:2,visibility:'customer',duration:3}],comments:[],history:[],sceneReviews:[{id:id(31),sceneId:id(30),title:'장면 제목',sceneRevision:1,status:'changes',text:'자막 수정 요청',author:'customer',at}]}});
  const row=f.row();row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'submit',requestId:id(31),sceneRevision:2,confirmed:true,note:'PRIVATE-SCENE-PROCESS'},{actor:f.users.owner.id,at,canEdit:true,reviewerId:null});
  const proof={id:id(32),sceneId:id(30),title:'장면 제목',sceneRevision:2,status:'confirmed',text:'확인했습니다',author:'customer',at};row.studio.sceneReviews.push(proof);row.sceneRequestWorkflows=recordSceneReview(row,proof,{at,reviewerId:null});f.put(row);
}
test('scene completion requires current exact customer proof and exports processing actions without private notes',async t=>{
  const f=await fixture(t);sceneFixture(f);const original=f.prepare();assert.equal(original.counts.sceneRequests,1);assert.equal(original.counts.pendingSceneRequests,0);assert.equal(section(original,'scene_requests')[0].confirmedAt,at);assert.match(section(original,'scene_requests')[0].source,/tab=history&review=/);assert.doesNotMatch(JSON.stringify(original),/PRIVATE-SCENE-PROCESS/);
  const row=f.row();row.studio.sceneReviews=row.studio.sceneReviews.filter(review=>review.id!==id(32));f.put(row);const missing=f.prepare();assert.equal(missing.counts.pendingSceneRequests,1);assert.equal(section(missing,'scene_requests')[0].confirmedAt,'');assert.match(section(missing,'scene_requests')[0].status,/근거 확인 필요/);
  sceneFixture(f);const changed=f.row();changed.studio.scenes[0].revision++;f.put(changed);const stale=f.prepare();assert.equal(stale.counts.pendingSceneRequests,1);assert.equal(section(stale,'scene_requests')[0].confirmedAt,'');assert.notEqual(stale.fingerprint,original.fingerprint);
});

test('Korean expiry and withdrawal keep historical permission distinct from the current effective condition',async t=>{
  const f=await fixture(t);f.reference();f.saveRight(undefined,{expiryMode:'date',expiresAt:'2026-10-13'});f.setNow('2026-10-13T14:59:59.999Z');const valid=f.prepare();assert.equal(section(valid,'rights_current')[0].status,'허용 기록 있음');f.setNow('2026-10-13T15:00:00.000Z');const expired=f.prepare();assert.equal(section(expired,'rights_current')[0].status,'등록 기간 지남');assert.equal(section(expired,'rights_history')[0].status,'허용 기록 있음');assert.notEqual(expired.fingerprint,valid.fingerprint);
  f.saveRight(undefined,{status:'denied',scope:'공개하지 않음',evidence:'철회 요청',expiryMode:'unknown'});const denied=f.prepare();assert.equal(section(denied,'rights_current')[0].status,'거절·철회 기록');assert.equal(section(denied,'rights_history')[1].status,'허용 기록 있음');assert.match(section(denied,'rights_history')[1].application,/최신 기록에 대체됨/);
});

test('approved feedback and processed support retain their own proof when a later preview becomes current',async t=>{
  const f=await fixture(t),{preview}=f.completed();f.put({messages:[...f.row().messages,{id:id(80),author:'customer',visibility:'customer',action:'feedback',text:'기존 시안 수정',resolved:true,resolvedAt:at,workflow:{status:'done',resultVersionId:preview.id,history:[{action:'submit_review',at,note:'PRIVATE-REVIEW-NOTE'}]}},{id:id(81),author:'customer',visibility:'customer',action:'support',text:'안내 문의',resolved:true,resolvedAt:at}]});let report=f.prepare();assert.equal(report.counts.pendingCustomerRequests,0);assert.equal(section(report,'customer_requests')[0].currentResult,true);assert.match(section(report,'customer_requests')[0].status,/승인된 수정본 연결 확인/);assert.match(section(report,'customer_requests')[1].status,/직원 문의 처리 기록/);f.add('preview','추가 시안');report=f.prepare();assert.equal(report.counts.pendingCustomerRequests,0);assert.equal(section(report,'customer_requests')[0].currentResult,false);assert.equal(section(report,'customer_requests')[0].resultVersion,'승인 시안');assert.equal(report.status,'no_delivery');assert.doesNotMatch(JSON.stringify(report),/PRIVATE-REVIEW-NOTE/);
});

test('live reviewer deactivation invalidates submitted scene completion in an otherwise unchanged project',async t=>{
  const f=await fixture(t);sceneFixture(f);let row=f.row();row.reviewerId=f.users.reviewer.id;row.sceneRequestWorkflows={};row.studio.sceneReviews=row.studio.sceneReviews.filter(review=>review.id===id(31));row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'submit',requestId:id(31),sceneRevision:2,confirmed:true},{actor:f.users.owner.id,at,canEdit:true,reviewerId:f.users.reviewer.id});row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'accept',requestId:id(31),confirmed:true},{actor:f.users.reviewer.id,at,canEdit:false,canReview:true,reviewerId:f.users.reviewer.id});const review={id:id(32),sceneId:id(30),sceneRevision:2,status:'confirmed',text:'확인',author:'customer',at};row.studio.sceneReviews.push(review);row.sceneRequestWorkflows=recordSceneReview(row,review,{at,reviewerId:f.users.reviewer.id});f.put(row);const before=f.prepare();assert.equal(before.counts.pendingSceneRequests,0);f.store.put('users',f.users.reviewer.id,{...f.users.reviewer,active:false});const after=f.prepare();assert.equal(after.revision,before.revision);assert.equal(after.counts.pendingSceneRequests,1);assert.equal(section(after,'scene_requests')[0].confirmedAt,'');assert.notEqual(after.fingerprint,before.fingerprint);
});

test('changed or removed source conditions stay historical and a missing stored closure snapshot is stated explicitly',async t=>{
  const f=await fixture(t);f.reference();f.saveRight();let row=f.row();row.studio.references[0].url='https://example.test/replaced.png';f.put(row);let report=f.prepare();assert.equal(section(report,'rights_current')[0].status,'미확인');assert.equal(section(report,'rights_current')[0].scope,'');assert.match(section(report,'rights_history')[0].application,/현재 원본에 적용하지 않음/);row=f.row();row.studio.references=[];row.closureHistory=[{id:id(40),closedAt:at,actorName:'합성 담당자'}];f.put(row);report=f.prepare();assert.equal(report.counts.materialConditions,0);assert.equal(report.counts.rightsHistory,1);assert.match(section(report,'closeout_history')[0].summary,/저장 당시 요약이 없습니다/);assert.match(section(report,'closeout_history')[0].summary,/현재 내용으로 과거 요약을 만들지 않았습니다/);
});

test('read access matches current project ACL including viewer, reviewer and archive without trusting stale user roles',async t=>{
  const f=await fixture(t);for(const name of ['owner','reviewer','manager','viewer','admin'])assert.equal(f.prepare(name).projectId,f.projectId);for(const name of ['peer','other'])status(()=>f.prepare(name),404);status(()=>f.service.prepare(null,f.projectId),401);status(()=>f.service.prepare(f.users.owner,'bad'),400);
  const before=f.prepare();f.store.put('users',f.users.owner.id,{...f.users.owner,role:'manager'});assert.notEqual(f.prepare().fingerprint,before.fingerprint);f.store.put('users',f.users.reviewer.id,{...f.users.reviewer,teamId:'b'});status(()=>f.prepare('reviewer'),404);f.put({stage:'archived'});assert.equal(f.prepare().status,'archived');f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.prepare(),401);f.store.put('users',f.users.owner.id,{...f.users.owner,role:'unknown'});status(()=>f.prepare(),401);
});

test('permission loss, source revision changes and dependent projection errors fail closed during preparation',async t=>{
  for(const mode of ['permission','source','rights','mismatch']){
    const f=await fixture(t),wrapper={workspace(user,projectId){const data=f.rights.workspace(user,projectId);if(mode==='permission')f.store.put('users',user.id,{...user,active:false});if(mode==='source')f.put({revision:f.row().revision+1});if(mode==='rights')throw Object.assign(new Error('조건 조회 실패'),{status:503});if(mode==='mismatch')data.projectRevision++;return data;}},service=createClientCompletionRecordsService({...f.options,clientRights:wrapper});status(()=>service.prepare(f.users.owner,f.projectId),mode==='permission'?401:mode==='source'?409:503);
  }
});

test('source bodies remain literal for safe renderer handling while structured secrets, private drafts and all external addresses are omitted',async t=>{
  const f=await fixture(t);f.reference();const row=f.row();row.title='합성 https://example.test/title?token=SECRET-TITLE';row.customerName='고객 https://example.test/customer?token=SECRET-CUSTOMER';row.inviteHash='PRIVATE-INVITE';row.studio.feedbackRounds={drafts:{owner:{text:'PRIVATE-DRAFT'}}};row.messages=[{id:id(50),author:'customer',visibility:'customer',action:'support',text:'=1+1\n+SUM(A1)\n-1\n@SUM(A1)\nhttps://example.test/a?token=SECRET-HTTPS\nftp://example.test/b\n//example.test/c\nwww.example.test/d\nmailto:private@example.test\ntel:01012345678',at,resolved:false,workflow:{history:[{action:'start',at,note:'PRIVATE-WORKFLOW-NOTE'}]}},{id:id(51),author:'staff',visibility:'internal',action:'message',text:'PRIVATE-STAFF-MESSAGE'},{id:id(52),author:'customer',visibility:'customer',action:'support',text:'PRIVATE-DELETED',deleted:true},{id:id(53),author:'customer',visibility:'private',action:'support',text:'PRIVATE-HIDDEN'}];f.put(row);f.saveRight(undefined,{evidence:'https://example.test/evidence?token=SECRET-RIGHTS'});const before=f.snapshot(),report=f.prepare(),serialized=JSON.stringify(report),request=section(report,'customer_requests')[0];assert.match(request.request,/^=1\+1\n\+SUM\(A1\)\n-1\n@SUM\(A1\)/);assert.match(request.request,/\[외부 주소 생략\]/);assert.doesNotMatch(serialized,/PRIVATE-|SECRET-|https?:|ftp:|mailto:|tel:|www\.example|\/\/example/);assert.ok(report.counts.externalAddressesOmitted>=9);assert.equal(report.counts.customerRequests,1);assert.equal(f.snapshot(),before);
  for(const part of report.sections)for(const item of part.rows)if(item.source)assert.ok(item.source.startsWith('/?tab=workroom&section=clients&project=')||item.source.startsWith('/pulse-app/?mode=staff&project='));
});

test('loss of a real final file changes fingerprint and prevents the current report from claiming completed delivery',async t=>{
  const f=await fixture(t);f.completed();await mkdir(join(f.directory,'studio-media'),{recursive:true});const diskName=id(60)+'.mp4',path=join(f.directory,'studio-media',diskName);await writeFile(path,Buffer.from('synthetic-video'));const row=f.row();row.versions.at(-1).url='';row.versions.at(-1).media={id:id(60),diskName,fileName:'최종본.mp4',mimeType:'video/mp4',byteSize:15};f.put(row);
  // File metadata is part of delivery identity, so confirm and close this exact set.
  const invited=f.projects.invite(f.users.owner,f.projectId,{revision:f.row().revision}),opened=f.projects.open(invited.invite);f.projects.customerAction(opened.session,opened.csrf,{revision:f.row().revision,action:'confirm_delivery',deliveryKey:clientDeliveryIdentity(f.row()).deliveryKey,confirmed:true});f.projects.closeout(f.users.owner,f.projectId,{revision:f.row().revision,action:'close',deliveryKey:clientDeliveryIdentity(f.row()).deliveryKey,confirmed:true});f.saveRight('portfolio');const before=f.snapshot(),present=f.prepare();assert.equal(present.status,'closed');await unlink(path);const missing=f.prepare();assert.equal(missing.revision,present.revision);assert.equal(missing.status,'follow_up');assert.notEqual(missing.fingerprint,present.fingerprint);assert.match(section(missing,'delivery')[0].status,/확인 필요/);assert.equal(section(missing,'rights_current').at(-1).status,'미확인');assert.equal(f.snapshot(),before);
});

test('large row or text reports reject explicitly without silently truncating or rewriting original records',async t=>{
  const f=await fixture(t);f.put({messages:Array.from({length:2001},(_,index)=>({id:id(index+100),author:'customer',visibility:'customer',action:'support',text:'그대로 남겨 둘 문의',at}))});let before=f.snapshot();status(()=>f.prepare(),413);assert.equal(f.snapshot(),before);f.put({messages:[{id:id(70),author:'customer',visibility:'customer',action:'support',text:'가'.repeat(1000001),at}]});before=f.snapshot();status(()=>f.prepare(),413);assert.equal(f.snapshot(),before);
});

test('corrupt encrypted rights fail without exporting an empty condition section or changing source data',async t=>{
  const f=await fixture(t);f.reference();f.saveRight();const envelope=f.store.get('clientRights',f.projectId),body=f.store.decrypt(envelope.ciphertext);body.projectId=id(999);f.store.put('clientRights',f.projectId,{...envelope,ciphertext:f.store.encrypt(body)});const before=f.snapshot();status(()=>f.prepare(),500);assert.equal(f.snapshot(),before);
});

test('the preview limit includes headings and warnings so renderer text limits cannot reject an accepted boundary report',async t=>{
  const f=await fixture(t),message={id:id(90),author:'customer',visibility:'customer',action:'support',text:'a',at};f.put({messages:[message]});const initial=f.prepare(),cellCharacters=initial.sections.reduce((sum,part)=>sum+part.rows.reduce((count,row)=>count+Object.values(row).reduce((size,value)=>size+String(value).length,0),0),0);f.put({messages:[{...message,text:'a'.repeat(1000000-cellCharacters+1-25)}]});const before=f.snapshot();assert.throws(()=>f.prepare(),error=>error.status===413&&error.message.includes('제목과 안내'));assert.equal(f.snapshot(),before);
});
