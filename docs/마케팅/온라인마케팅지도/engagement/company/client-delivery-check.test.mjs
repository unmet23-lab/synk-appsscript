import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDeliveryService} from './client-delivery.mjs';
import {buildDeliveryCheck,deliveryCheckFingerprint,deliveryItemConfirmationKey} from './client-delivery-check.mjs';

const stamp='2026-10-12T03:00:00.000Z';
const specItem=(extra={})=>({id:randomUUID(),label:'세로 영상',kind:'video',quantity:1,durationSeconds:30,aspectRatio:'9:16',subtitles:'none',fileFormat:'mp4',language:'한국어',...extra});
const media=(mimeType='video/mp4')=>{const id=randomUUID(),ext={'video/mp4':'mp4','video/webm':'webm','image/png':'png','application/x-subrip':'srt','text/vtt':'vtt'}[mimeType];return {id,diskName:id+'.'+ext,fileName:'검증 파일.'+ext,mimeType,byteSize:100};};
const probe=(extra={})=>({status:'inspected',sha256:'a'.repeat(64),byteSize:100,metadata:{kind:'video',duration:30,width:1080,height:1920,displayAspectRatio:9/16},...extra});
function pure(extra={}){const spec=specItem(extra),version={id:randomUUID(),kind:'preview',approvedAt:stamp},row={id:randomUUID(),stage:'review',versions:[version],studio:{deliverables:{revision:1,items:[spec],confirmation:{deliverableRevision:1}}}},draft={approvedPreviewId:version.id,draftRevision:1,requirements:[{id:'video',kind:'video'},{id:'subtitle',kind:'subtitle'},{id:'image',kind:'image'}],items:[]};return {row,draft,spec,version};}
function add(p,{kind='video',spec=p.spec,metadata=media(),source='upload',url=''}={}){const item={id:randomUUID(),requirementId:kind,deliverableItemId:spec?.id||'',label:'최종 파일',confirmed:false,source,...(metadata?{media:metadata}:{}),...(url?{url}:{})};p.draft.items.push(item);return item;}
function inspection(p,entries={}){return {fingerprint:deliveryCheckFingerprint(p.row,p.draft),checkedAt:stamp,results:Object.fromEntries(p.draft.items.filter(item=>item.media).map(item=>[item.media.id,entries[item.media.id]||probe()]))};}
function confirm(p,item,record){item.confirmed=true;item.confirmationToken=deliveryItemConfirmationKey(p.row,p.draft,item,record);}
const check=(p,record)=>buildDeliveryCheck(p.row,p.draft,{inspection:record,now:stamp,canInspect:true});

test('unconfigured and unconfirmed specifications preserve the existing manual delivery flow',()=>{
  const p=pure();delete p.row.studio;assert.equal(check(p).status,'not_configured');assert.equal(check(p).pendingCount,0);assert.equal(check(p).canPublish,true);
  p.row.studio={deliverables:{revision:2,items:[p.spec],confirmation:{deliverableRevision:1}}};assert.equal(check(p).status,'waiting_confirmation');assert.equal(check(p).confirmed,false);assert.equal(check(p).canPublish,true);
});
test('existing direct final uploads without a delivery draft are explicitly uninspected rather than false missing files',()=>{
  const p=pure();p.row.versions.push({id:randomUUID(),kind:'final',approvedPreviewId:p.version.id});const report=check(p);assert.equal(report.status,'existing_delivery');assert.equal(report.pendingCount,0);assert.equal(report.blockingCount,0);assert.equal(report.manualCount,0);assert.equal(report.canInspect,false);assert.equal(report.canPublish,false);assert.deepEqual(report.checks,[]);assert.match(report.inspectReason,/기존 최종 파일/);
});
test('confirmed specifications expose exact quantity and separate-subtitle omissions',()=>{
  const p=pure({quantity:2,subtitles:'both'});add(p);const record=inspection(p),result=check(p,record);
  assert.equal(result.status,'attention');assert.match(result.checks.find(value=>value.id.startsWith('quantity:')).text,/합의 2개 · 연결 1개/);assert.equal(result.checks.find(value=>value.id.startsWith('subtitle:')).status,'missing');assert.equal(result.canPublish,false);
});
test('technical pass still requires current human review for content, language, sound and use',()=>{
  const p=pure(),item=add(p),record=inspection(p);let result=check(p,record);assert.equal(result.blockingCount,0);assert.equal(result.status,'manual');assert.equal(result.canPublish,false);assert.match(result.checks.find(value=>value.id.endsWith(':content')).text,/언어·번인 자막·소리/);
  confirm(p,item,record);result=check(p,record);assert.equal(result.status,'ready');assert.equal(result.canPublish,true);
});
test('measured length and displayed ratio use explicit tolerances and mismatch cannot be acknowledged away',()=>{
  const p=pure(),item=add(p);let record=inspection(p,{[item.media.id]:probe({metadata:{kind:'video',duration:30.1,displayAspectRatio:(9/16)*1.009}})});confirm(p,item,record);assert.equal(check(p,record).status,'ready');
  record=inspection(p,{[item.media.id]:probe({metadata:{kind:'video',duration:30.101,displayAspectRatio:(9/16)*1.011}})});confirm(p,item,record);const result=check(p,record);assert.equal(result.checks.find(value=>value.id.endsWith(':duration')).status,'fail');assert.equal(result.checks.find(value=>value.id.endsWith(':ratio')).status,'fail');assert.equal(result.canPublish,false);
});
test('display ratio from rotation and sample aspect metadata takes precedence over coded dimensions',()=>{
  const p=pure(),item=add(p),record=inspection(p,{[item.media.id]:probe({metadata:{kind:'video',duration:30,width:1920,height:1080,rotation:90,displayAspectRatio:9/16}})});assert.equal(check(p,record).checks.find(value=>value.id.endsWith(':ratio')).status,'ready');
});
test('exact file format differences fail while detailed codec prose remains a manual check',()=>{
  const p=pure({fileFormat:'MOV'}),item=add(p);let record=inspection(p);confirm(p,item,record);assert.equal(check(p,record).checks.find(value=>value.id.endsWith(':format')).status,'fail');
  p.spec.fileFormat='MP4 / H.264 / 20 Mbps';record=inspection(p);item.confirmed=false;assert.equal(check(p,record).checks.find(value=>value.id.endsWith(':format')).status,'manual');confirm(p,item,record);assert.equal(check(p,record).status,'ready');
});
test('subtitle sidecars share a specification mapping without increasing primary video quantity',()=>{
  const p=pure({subtitles:'separate'}),video=add(p),subtitle=add(p,{kind:'subtitle',metadata:media('text/vtt')}),record=inspection(p,{[subtitle.media.id]:probe({sha256:'b'.repeat(64),metadata:{kind:'subtitle',subtitleFormat:'vtt',cueCount:4,lastCueEnd:29}})});confirm(p,video,record);confirm(p,subtitle,record);const result=check(p,record);
  assert.equal(result.status,'ready');assert.match(result.checks.find(value=>value.id.startsWith('quantity:')).text,/연결 1개/);assert.equal(result.checks.filter(value=>value.id.endsWith(':format')).length,1);
});
test('empty, overlapping and overlong subtitle timelines are distinguished',()=>{
  const p=pure({subtitles:'separate'});add(p);const subtitle=add(p,{kind:'subtitle',metadata:media('application/x-subrip')});let record=inspection(p,{[subtitle.media.id]:probe({sha256:'b'.repeat(64),metadata:{kind:'subtitle',cueCount:0,lastCueEnd:31}})}),result=check(p,record);assert.equal(result.checks.find(value=>value.id.endsWith(':cues')).status,'fail');assert.equal(result.checks.find(value=>value.id.endsWith(':subtitle_end')).status,'fail');
  record=inspection(p,{[subtitle.media.id]:probe({sha256:'b'.repeat(64),metadata:{kind:'subtitle',cueCount:4,lastCueEnd:30,subtitleWarnings:['overlap']}})});result=check(p,record);assert.equal(result.checks.find(value=>value.id.endsWith(':subtitle_warnings')).status,'manual');
});
test('duplicate bytes and repeated external URLs cannot inflate promised quantity',()=>{
  const p=pure({quantity:2});add(p);add(p);let result=check(p,inspection(p));assert.equal(result.checks.find(value=>value.id.startsWith('quantity:')).status,'missing');
  p.draft.items=[];add(p,{metadata:null,url:'https://files.example.test/a'});add(p,{metadata:null,url:'https://files.example.test/a'});result=check(p);assert.match(result.checks.find(value=>value.id.startsWith('quantity:')).text,/연결 1개/);
});
test('external links remain manual without manufacturing metadata or requiring network inspection',()=>{
  const p=pure(),item=add(p,{metadata:null,url:'https://private.example.test/video',source:'link'});let result=check(p);assert.equal(result.inspectionCurrent,true);assert.equal(result.status,'manual');assert.equal(result.checks.some(value=>value.id.endsWith(':duration')),false);confirm(p,item,null);assert.equal(check(p).status,'ready');
});
test('missing, corrupt and unavailable file inspections have different blocking behavior',()=>{
  const p=pure(),item=add(p);assert.equal(check(p).status,'needs_check');
  for(const [data,expected]of [[{status:'unavailable',code:'missing'},'missing'],[{status:'corrupt',code:'invalid_media'},'fail'],[{status:'unavailable',code:'probe_timeout'},'manual']]){const record=inspection(p,{[item.media.id]:data}),result=check(p,record);assert.equal(result.checks.find(value=>value.id.endsWith(':inspection')).status,expected);confirm(p,item,record);assert.equal(check(p,record).canPublish,expected==='manual');}
});
test('file mappings never count wrong kinds and extra unassigned files require review',()=>{
  const p=pure(),wrong=add(p,{kind:'image',metadata:media('image/png')}),record=inspection(p,{[wrong.media.id]:probe({metadata:{kind:'image',width:1080,height:1920}})});assert.equal(check(p,record).checks.find(value=>value.id.endsWith(':kind')).status,'fail');
  const q=pure(),main=add(q),extra=add(q,{spec:null,metadata:null,url:'https://files.example.test/guide'}),inspected=inspection(q);confirm(q,main,inspected);assert.equal(check(q,inspected).status,'manual');confirm(q,extra,inspected);assert.equal(check(q,inspected).status,'ready');
});
test('unmapped extra files cannot bypass a missing or corrupt local-file inspection',()=>{
  const p=pure(),main=add(p),extra=add(p,{spec:null,metadata:media('image/png')}),record=inspection(p,{[extra.media.id]:{status:'unavailable',code:'missing'}});confirm(p,main,record);confirm(p,extra,record);const report=check(p,record);assert.equal(report.checks.find(value=>value.id===extra.id+':inspection').status,'missing');assert.equal(report.canPublish,false);
});
test('other specification kinds remain manually reviewable rather than manufacturing an unsupported kind mismatch',()=>{
  const p=pure({kind:'other',fileFormat:'별도 파일',durationSeconds:null,aspectRatio:''}),item=add(p),record=inspection(p);assert.equal(check(p,record).blockingCount,0);assert.equal(check(p,record).status,'manual');confirm(p,item,record);assert.equal(check(p,record).status,'ready');
});
test('specification, mapping and approved-preview changes invalidate inspection and human acknowledgement',()=>{
  const p=pure(),item=add(p),record=inspection(p);confirm(p,item,record);assert.equal(check(p,record).status,'ready');
  p.row.studio.deliverables.revision=2;p.row.studio.deliverables.confirmation.deliverableRevision=2;assert.equal(check(p,record).inspectionCurrent,false);assert.equal(check(p,record).status,'needs_check');const next=inspection(p);assert.equal(check(p,next).status,'manual');
  p.row.versions.push({id:randomUUID(),kind:'preview'});assert.equal(check(p,next).checks.find(value=>value.id==='approval').status,'missing');
});
test('same-byte rechecks retain confirmation while changed-byte rechecks revoke it',()=>{
  const p=pure(),item=add(p),first=inspection(p);confirm(p,item,first);const repeated=inspection(p);assert.equal(check(p,repeated).status,'ready');const changed=inspection(p,{[item.media.id]:probe({sha256:'c'.repeat(64)})});assert.equal(check(p,changed).status,'manual');
});
test('reports omit storage paths, original file bytes and arbitrary private specification properties',()=>{
  const p=pure();p.spec.private='PRIVATE_SPEC';const item=add(p);item.media.diskName='PRIVATE_DISK';item.media.fileName='PRIVATE_FILENAME';const report=check(p,inspection(p));assert.doesNotMatch(JSON.stringify(report),/PRIVATE_|diskName|sha256/);assert.match(report.fingerprint,/^[a-f0-9]{64}$/);
});

const projectInput={title:'납품 점검 합성 프로젝트',customerName:'합성 고객',contact:'PRIVATE_CONTACT',summary:'공개 목적',terms:'공개 조건',internalNotes:'PRIVATE_NOTES',nextStep:'납품 준비',dueDate:'2026-10-20',nextContactDate:''};
const revisions=view=>({projectRevision:view.projectRevision,draftRevision:view.draftRevision,approvedPreviewId:view.approvedPreview?.id});
async function fixture(t,customInspector=null){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-check-')),store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const owner=store.createUser({name:'제작 담당',email:'owner@check.test',role:'member',teamId:'a'}),reviewer=store.createUser({name:'검토자',email:'reviewer@check.test',role:'member',teamId:'a'}),other=store.createUser({name:'다른 팀',email:'other@check.test',role:'member',teamId:'b'});
  const clientProjects=createClientProjectsService({store,clock:()=>stamp}),calls=[],fileInspector=customInspector||{inspect:async metadata=>{calls.push(metadata.id);return probe();}},service=createClientDeliveryService({store,clientProjects,clock:()=>stamp,fileInspector});
  let row=clientProjects.save(owner,{...projectInput,reviewerId:reviewer.id}).project;const invite=clientProjects.invite(owner,row.id,{revision:row.revision}),customer=clientProjects.open(invite.invite);row=clientProjects.project(owner,row.id);row=clientProjects.addVersion(owner,row.id,{revision:row.revision,kind:'preview',label:'승인 시안'},media()).project;clientProjects.customerAction(customer.session,customer.csrf,{revision:row.revision,action:'approve',versionId:row.versions.at(-1).id});row=clientProjects.project(owner,row.id);const spec=specItem();store.put('clientProjects',row.id,{...row,studio:{schemaVersion:1,deliverables:{revision:1,items:[spec],confirmation:{deliverableRevision:1}}}});
  const id=row.id,act=(action,extra={},user=owner)=>service.mutate(user,id,{...revisions(service.get(user,id)),action,...extra}),selected=()=>act('use_approved',{requirementId:'video',label:'최종 영상',deliverableItemId:spec.id});
  return {directory,store,clientProjects,service,owner,reviewer,other,customer,id,spec,calls,act,selected};
}
test('refresh writes only derived inspection records and preserves project, draft and customer revisions',async t=>{
  const f=await fixture(t);f.selected();const project=f.store.get('clientProjects',f.id),draft=f.store.all('clientDeliveryDrafts')[0],customer=f.clientProjects.read(f.customer.session),before=f.service.get(f.owner,f.id);assert.equal(before.deliveryCheck.status,'needs_check');assert.equal(f.store.all('clientDeliveryChecks').length,0);
  const view=await f.service.refreshChecks(f.owner,f.id);assert.equal(view.deliveryCheck.status,'manual');assert.equal(view.draftRevision,before.draftRevision);assert.equal(view.projectRevision,before.projectRevision);assert.deepEqual(f.store.get('clientProjects',f.id),project);assert.deepEqual(f.store.all('clientDeliveryDrafts')[0],draft);assert.deepEqual(f.clientProjects.read(f.customer.session),customer);assert.equal(f.store.all('clientDeliveryChecks').length,1);assert.doesNotMatch(JSON.stringify(customer),/deliveryCheck|confirmationToken|diskName/);
});
test('current inspection token is mandatory for confirmed-spec acknowledgement and known failures still block publication',async t=>{
  const f=await fixture(t);f.selected();let view=await f.service.refreshChecks(f.owner,f.id),item=view.items[0];assert.throws(()=>f.act('update_item',{itemId:item.id,confirmed:true}),error=>error.status===409);view=f.act('update_item',{itemId:item.id,confirmed:true,confirmationToken:item.confirmationToken});assert.equal(view.canPublish,true);
  const row=f.store.get('clientProjects',f.id);row.studio.deliverables.items[0].durationSeconds=45;row.studio.deliverables.revision=2;row.studio.deliverables.confirmation.deliverableRevision=2;f.store.put('clientProjects',f.id,row);view=await f.service.refreshChecks(f.owner,f.id);assert.equal(view.items[0].confirmed,false);assert.throws(()=>f.act('update_item',{itemId:item.id,confirmed:true,confirmationToken:item.confirmationToken}),error=>error.status===409);view=f.act('update_item',{itemId:item.id,confirmed:true,confirmationToken:view.items[0].confirmationToken});assert.equal(view.canPublish,false);assert.throws(()=>f.act('publish',{confirmed:true}),error=>error.status===409);
});
test('check requires exact revisions, current owner permission and a current approved preview',async t=>{
  const f=await fixture(t);f.selected();const base=revisions(f.service.get(f.owner,f.id));for(const key of Object.keys(base)){const input={...base};delete input[key];await assert.rejects(f.service.check(f.owner,f.id,input),error=>error.status===409);}
  await assert.rejects(f.service.check(f.reviewer,f.id,base),error=>error.status===403);await assert.rejects(f.service.refreshChecks(f.other,f.id),error=>error.status===404);await assert.rejects(f.service.check(f.owner,f.id,{...base,media:media()}),error=>error.status===400);assert.equal((await f.service.check(f.owner,f.id,base)).deliveryCheck.status,'manual');
});
test('a project mutation during asynchronous probing prevents stale report writes',async t=>{
  let start,release;const started=new Promise(resolve=>start=resolve),wait=new Promise(resolve=>release=resolve),f=await fixture(t,{inspect:async()=>{start();await wait;return probe();}});f.selected();const pending=f.service.refreshChecks(f.owner,f.id);await started;f.act('save_guide',{guide:'검사 도중 수정'});release();await assert.rejects(pending,error=>error.status===409);assert.equal(f.store.all('clientDeliveryChecks').length,0);
});
test('revoked user and authorization are rechecked after awaited file reads before saving',async t=>{
  let start,release;const started=new Promise(resolve=>start=resolve),wait=new Promise(resolve=>release=resolve),f=await fixture(t,{inspect:async()=>{start();await wait;return probe();}});f.selected();const pending=f.service.refreshChecks(f.owner,f.id);await started;f.store.put('users',f.owner.id,{...f.owner,active:false});release();await assert.rejects(pending,error=>error.status===401);assert.equal(f.store.all('clientDeliveryChecks').length,0);
  f.store.put('users',f.owner.id,f.owner);let calls=0;await assert.rejects(f.service.refreshChecks(f.owner,f.id,{authorize:()=>{if(++calls===2)throw Object.assign(new Error('세션 만료'),{status:401});}}),error=>error.status===401);assert.equal(f.store.all('clientDeliveryChecks').length,0);
});
test('explicit rechecks reject edit-permission revocation during asynchronous inspection',async t=>{
  let start,release;const started=new Promise(resolve=>start=resolve),wait=new Promise(resolve=>release=resolve),f=await fixture(t,{inspect:async()=>{start();await wait;return probe();}});f.selected();const pending=f.service.check(f.owner,f.id,revisions(f.service.get(f.owner,f.id)));await started;f.store.put('users',f.owner.id,{...f.owner,role:'viewer'});release();await assert.rejects(pending,error=>error.status===403);assert.equal(f.store.all('clientDeliveryChecks').length,0);
});
test('mapping accepts only current project specification items and changing mapping resets human confirmation',async t=>{
  const f=await fixture(t);assert.throws(()=>f.act('use_approved',{requirementId:'video',label:'최종',deliverableItemId:randomUUID()}),error=>error.status===400);f.selected();let view=await f.service.refreshChecks(f.owner,f.id);view=f.act('update_item',{itemId:view.items[0].id,confirmed:true,confirmationToken:view.items[0].confirmationToken});assert.equal(view.items[0].confirmed,true);view=f.act('update_item',{itemId:view.items[0].id,deliverableItemId:''});assert.equal(view.items[0].confirmed,false);assert.equal(view.deliveryCheck.canPublish,false);
});
test('external-only drafts are never passed to the local inspector and remain explicitly manual',async t=>{
  const f=await fixture(t);f.act('add_link',{requirementId:'video',label:'외부 최종 영상',url:'https://private.example.test/final',deliverableItemId:f.spec.id});const view=await f.service.refreshChecks(f.owner,f.id);assert.deepEqual(f.calls,[]);assert.equal(view.deliveryCheck.status,'manual');assert.equal(view.items[0].confirmed,false);
});
test('background scans coalesce, omit archived projects and preserve settings revisions',async t=>{
  const f=await fixture(t);f.selected();const before=f.service.get(f.owner,f.id),first=f.service.scanChecks(),second=f.service.scanChecks();assert.equal(first,second);assert.deepEqual(await first,{checked:1,failed:0});assert.equal(f.service.get(f.owner,f.id).draftRevision,before.draftRevision);const row=f.store.get('clientProjects',f.id);f.store.put('clientProjects',f.id,{...row,stage:'archived'});assert.deepEqual(await f.service.scanChecks(),{checked:0,failed:0});
});
test('completed delivery retains checks and a new approval never reuses the prior draft or inspection',async t=>{
  const f=await fixture(t);f.selected();let view=await f.service.refreshChecks(f.owner,f.id);view=f.act('update_item',{itemId:view.items[0].id,confirmed:true,confirmationToken:view.items[0].confirmationToken});view=f.act('publish',{confirmed:true});assert.equal(view.status,'delivered');assert.equal(view.deliveryCheck.status,'ready');assert.equal(view.deliveryCheck.canInspect,false);assert.match(view.deliveryCheck.inspectReason,/화면을 새로 불러오면/);assert.doesNotMatch(view.deliveryCheck.inspectReason,/다시 실행/);assert.equal((await f.service.refreshChecks(f.owner,f.id)).deliveryCheck.status,'ready');
  let row=f.clientProjects.project(f.owner,f.id);row=f.clientProjects.addVersion(f.owner,f.id,{revision:row.revision,kind:'preview',label:'추가 작업 시안'},media()).project;f.clientProjects.customerAction(f.customer.session,f.customer.csrf,{revision:row.revision,action:'approve',versionId:row.versions.at(-1).id});view=f.service.get(f.owner,f.id);assert.equal(view.draftRevision,0);assert.equal(view.items.length,0);assert.equal(view.deliveryCheck.status,'attention');assert.equal(f.store.all('clientDeliveryChecks').length,1);
});
