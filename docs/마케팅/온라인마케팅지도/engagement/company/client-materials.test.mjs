import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,unlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientMaterialsService} from './client-materials.mjs';
import {clientKickoffSources} from './client-kickoff.mjs';
import {clientDeliveryIdentity} from './client-closeout.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';

const at='2026-10-12T01:00:00.000Z',later='2026-10-13T01:00:00.000Z';
const throws=(fn,status)=>assert.throws(fn,error=>error.status===status);
const card=(extra={})=>({id:randomUUID(),revision:1,title:'장면',visibility:'internal',at,...extra});
const preview=(extra={})=>({id:randomUUID(),kind:'preview',label:'시안',url:'https://example.test/preview',createdAt:at,approvedAt:null,...extra});
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-materials-')),store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-client-materials-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['viewer','viewer','a'],['manager','manager','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@materials.test',role,teamId});
  let now=at;const clientProjects=createClientProjectsService({store,clock:()=>now}),service=createClientMaterialsService({store,clientProjects,clock:()=>now});
  const project=clientProjects.save(users.owner,{title:'자료 모아보기 합성 프로젝트',customerName:'합성 고객',reviewerId:users.reviewer.id,internalNotes:'PRIVATE-MEMO'}).project;
  const read=()=>store.get('clientProjects',project.id),update=fn=>{const row=read();fn(row);store.put('clientProjects',row.id,row);return row;},view=(who=users.owner)=>service.workspace(who,project.id);
  update(row=>row.studio=emptyPulseStudio());
  async function file(extra={}){const id=randomUUID(),intake=extra.kind==='attachment'||extra.kind==='document',data=Buffer.from('test bytes'),metadata={id,diskName:id+(intake?'.intake':'.png'),fileName:'자료.png',mimeType:'image/png',byteSize:data.length,sha256:createHash('sha256').update(data).digest('hex'),author:'staff',at,...extra};await mkdir(join(directory,'studio-media'),{recursive:true});await writeFile(join(directory,'studio-media',metadata.diskName),data);return metadata;}
  return {directory,store,users,clientProjects,service,project,read,update,view,file,setNow:value=>now=value};
}

test('empty index is read only and does not copy notes, tokens or customer unsubmitted drafts',async t=>{
  const f=await fixture(t);f.update(row=>{row.inviteHash='PRIVATE-TOKEN';row.intake={reportText:'PRIVATE-REPORT',files:[]};row.studio.feedbackRounds={drafts:{customer:{text:'PRIVATE-DRAFT'}}};row.studio.preferences.notes='PRIVATE-STUDIO-NOTE';row.messages=[{text:'PRIVATE-MESSAGE'}];});
  const before=f.store.db.prepare('SELECT * FROM documents ORDER BY kind,id').all(),tokens=f.store.db.prepare('SELECT * FROM tokens').all(),view=f.view();
  assert.deepEqual(view.groups.map(group=>group.id),['received','reference','preview','delivery']);assert.deepEqual(view.items,[]);assert.equal(view.revision,f.read().revision);assert.equal(view.generatedAt,at);assert.doesNotMatch(JSON.stringify(view),/PRIVATE|diskName|sha256|authorId/);
  f.setNow(later);assert.equal(f.view().generatedAt,later);assert.deepEqual(f.store.db.prepare('SELECT * FROM documents ORDER BY kind,id').all(),before);assert.deepEqual(f.store.db.prepare('SELECT * FROM tokens').all(),tokens);
});

test('read ACL uses current stored identity, team and archived project access',async t=>{
  const f=await fixture(t);for(const name of ['owner','reviewer','viewer','manager','admin'])assert.equal(f.view(f.users[name]).projectId,f.project.id);
  throws(()=>f.view(null),401);throws(()=>f.view(f.users.other),404);
  f.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'b'});throws(()=>f.view(f.users.viewer),404);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});throws(()=>f.view(f.users.owner),401);f.store.put('users',f.users.owner.id,f.users.owner);
  f.update(row=>row.stage='archived');assert.equal(f.view().projectId,f.project.id);f.store.remove('clientProjects',f.project.id);throws(()=>f.view(),404);
});

test('intake attachments use existing authenticated routes and omit intake documents',async t=>{
  const f=await fixture(t),attachment=await f.file({kind:'attachment',fileName:'고객 자료.pdf',mimeType:'application/pdf'}),document=await f.file({kind:'document',fileName:'PRIVATE-RECEIPT.json'});
  f.update(row=>row.intake={receivedAt:at,files:[attachment,document]});const [item]=f.view().items;
  assert.equal(f.view().items.length,1);assert.equal(item.kind,'document');assert.equal(item.category,'received');assert.equal(item.status,'received');assert.equal(item.visibility,'internal');assert.equal(item.downloadUrl,`/api/client-projects/${f.project.id}/intake-files/${attachment.id}`);assert.equal(item.sourceUrl,`/?tab=workroom&section=clients&project=${f.project.id}&intake=1`);assert.doesNotMatch(JSON.stringify(f.view()),/PRIVATE|diskName|sha256|studio-media/);
});

test('one asset referenced in multiple cards has one item and all original relations',async t=>{
  const f=await fixture(t),asset=await f.file({author:'customer',fileName:'제품 로고.png'}),reference=card({label:'참고 스타일',assetId:asset.id}),concept=card({title:'콘셉트',assetId:asset.id}),scene=card({title:'첫 장면',assetId:asset.id});
  f.update(row=>{row.studio.assets=[asset];row.studio.references=[reference];row.studio.concepts=[concept];row.studio.scenes=[scene];});
  const items=f.view().items;assert.equal(items.length,1);assert.equal(items[0].category,'received');assert.equal(items[0].visibility,'customer');assert.equal(items[0].relations.length,3);assert.ok(items[0].relations.some(value=>value.url.endsWith('scene='+scene.id)));
});

test('shared external reference URLs collapse while references with both file and URL keep both originals',async t=>{
  const f=await fixture(t),asset=await f.file(),a=card({label:'참고 A',assetId:asset.id,url:'https://example.test/style'}),b=card({label:'참고 B',url:a.url});
  f.update(row=>{row.studio.assets=[asset];row.studio.references=[a,b];});const items=f.view().items;assert.equal(items.length,2);const link=items.find(item=>item.kind==='link');assert.equal(link.relations.length,2);assert.equal(link.downloadUrl,'');assert.equal(link.openUrl,a.url);
});

test('usable status requires current kickoff source fingerprints for every nonwaived linked requirement',async t=>{
  const f=await fixture(t),asset=await f.file({author:'customer'}),reference=card({label:'자료 참고',assetId:asset.id});
  f.update(row=>{row.studio.assets=[asset];row.studio.references=[reference];row.kickoffPlan={enabled:true,requirements:[{id:'one',label:'승인 로고',sourceKey:'asset:'+asset.id,required:true},{id:'two',label:'참고',sourceKey:'reference:'+reference.id,required:true}]};for(const requirement of row.kickoffPlan.requirements)requirement.review={sourceFingerprint:clientKickoffSources(row).find(source=>source.key===requirement.sourceKey).fingerprint};});
  assert.equal(f.view().items[0].status,'ready');assert.equal(f.view().items[0].relations.filter(value=>value.label.startsWith('착수 자료:')).length,2);
  f.update(row=>row.studio.references[0].reason='참고 변경');assert.equal(f.view().items[0].status,'received');
  f.update(row=>row.kickoffPlan.requirements[1].waiver={reason:'PRIVATE-WAIVER'});assert.equal(f.view().items[0].status,'ready');assert.doesNotMatch(JSON.stringify(f.view()),/PRIVATE/);
  f.update(row=>row.studio.assets[0].fileName='새 자료.png');assert.equal(f.view().items[0].status,'received');
});

test('visibility matches customer assets, references, published card history and only current preview shares',async t=>{
  const f=await fixture(t),list=await Promise.all(Array.from({length:7},()=>f.file()));
  f.update(row=>{row.studio.assets=list;row.studio.assets[0].author='customer';row.studio.references=[card({assetId:list[1].id})];row.studio.concepts=[card({assetId:list[2].id,visibility:'customer'})];row.studio.history=[card({assetId:list[3].id,visibility:'customer'})];row.studio.previews={samples:[card({assetId:list[4].id,visibility:'customer'})],sampleHistory:[card({assetId:list[5].id,visibility:'customer'})],animatic:{visibility:'customer',audioAssetId:list[6].id},animaticHistory:[]};});
  const visibility=new Map(f.view().items.map(item=>[item.id,item.visibility]));for(const n of [0,1,2,3,4,6])assert.equal(visibility.get('asset:'+list[n].id),'customer');assert.equal(visibility.get('asset:'+list[5].id),'internal');
  f.update(row=>{row.studio.previews.samples[0].visibility='internal';row.studio.previews.animatic.visibility='internal';});for(const n of [4,6])assert.equal(f.view().items.find(item=>item.id==='asset:'+list[n].id).visibility,'internal');
});

test('latest approved preview defines current finals and an old approval cannot label files current',async t=>{
  const f=await fixture(t),old=preview({approvedAt:at,label:'이전 시안'}),current=preview({approvedAt:later,label:'최신 시안'}),oldFinal={...preview(),kind:'final',approvedPreviewId:old.id,label:'이전 납품'},final={...preview(),kind:'final',approvedPreviewId:current.id,label:'현재 납품'};
  f.update(row=>row.versions=[old,oldFinal,current,final]);let items=f.view().items;assert.equal(items.find(item=>item.label==='이전 시안').status,'previous_preview');assert.equal(items.find(item=>item.label==='최신 시안').status,'approved_preview');assert.equal(items.find(item=>item.label==='이전 납품').status,'previous_final');assert.equal(items.find(item=>item.label==='현재 납품').status,'current_final');assert.equal(items.find(item=>item.label==='현재 납품').relations[0].label,'연결된 승인 시안: 최신 시안');
  f.update(row=>row.versions.push(preview({label:'미승인 새 시안'})));items=f.view().items;assert.equal(items.filter(item=>item.status==='current_final').length,0);assert.equal(items.find(item=>item.label==='미승인 새 시안').status,'pending_preview');assert.ok(items.filter(item=>item.category==='delivery').every(item=>!item.current));
});

test('receipt requires actual customer confirmation of exact current delivery file set',async t=>{
  const f=await fixture(t),p=preview({approvedAt:at}),final={...preview(),kind:'final',approvedPreviewId:p.id};
  f.update(row=>{row.versions=[p,final];row.deliveryReceipts=[{deliveryKey:clientDeliveryIdentity(row).deliveryKey,actor:'customer',confirmedAt:at}];});assert.equal(f.view().items.find(item=>item.category==='delivery').receiptConfirmed,true);
  f.update(row=>row.deliveryReceipts[0].actor='staff');assert.equal(f.view().items.find(item=>item.category==='delivery').receiptConfirmed,false);
  f.update(row=>{row.deliveryReceipts[0].actor='customer';row.versions.push({...preview(),kind:'final',approvedPreviewId:p.id,label:'추가 자막'});});assert.ok(f.view().items.filter(item=>item.category==='delivery').every(item=>!item.receiptConfirmed));
});

test('missing disk files and deleted assets have no misleading open or download buttons',async t=>{
  const f=await fixture(t),asset=await f.file(),intake=await f.file({kind:'attachment'});f.update(row=>{row.intake={files:[intake]};row.studio.assets=[asset];row.studio.scenes=[card({assetId:asset.id})];});
  await unlink(join(f.directory,'studio-media',asset.diskName));await unlink(join(f.directory,'studio-media',intake.diskName));let items=f.view().items;assert.ok(items.every(item=>item.status==='unavailable'&&!item.openUrl&&!item.downloadUrl));
  f.update(row=>row.studio.assets=[]);items=f.view().items;assert.equal(items.filter(item=>item.id.startsWith('asset:')).length,0);assert.ok(items.some(item=>item.id.startsWith('scene:')&&item.status==='unavailable'));
});

test('unsafe external links and storage traversal never become open links or leaked credentials',async t=>{
  const f=await fixture(t),bad=['http://example.test/a','javascript:alert(1)','data:text/html,bad','https://name:PRIVATE-PASSWORD@example.test/a','/api/private','file:///C:/PRIVATE-PATH'];
  f.update(row=>{row.studio.references=bad.map((url,i)=>card({label:'차단 링크 '+i,url}));row.studio.assets=[{id:randomUUID(),fileName:'경로 오류',diskName:'../PRIVATE-PATH',byteSize:1,mimeType:'image/png'}];});const items=f.view().items;assert.equal(items.length,bad.length+1);assert.ok(items.every(item=>!item.openUrl&&!item.downloadUrl&&item.status==='unavailable'));assert.doesNotMatch(JSON.stringify(items),/PRIVATE|javascript:|data:text|file:\/\/\/|diskName/);
});

test('existing authorized HTTPS capability links remain usable without exposing URL as a title',async t=>{
  const f=await fixture(t),url='https://example.test/material.pdf?token=capability&signature=sample';f.update(row=>{row.studio.references=[card({label:'서명된 참고자료',url})];row.versions=[preview({url})];});const items=f.view().items;assert.ok(items.every(item=>item.openUrl===url));assert.ok(items.every(item=>item.kind==='document'));assert.ok(items.every(item=>!item.label.includes('capability')));
});

test('uploaded finals reuse protected media route while external-only versions have no fake download',async t=>{
  const f=await fixture(t),media=await f.file({fileName:'최종.srt',mimeType:'application/x-subrip',diskName:randomUUID()+'.srt'}),p=preview({approvedAt:at});f.update(row=>row.versions=[p,{...preview(),kind:'final',label:'최종 자막',approvedPreviewId:p.id,media}]);
  const items=f.view().items,final=items.find(item=>item.category==='delivery');assert.equal(final.kind,'subtitle');assert.equal(final.openUrl,'/api/client-media/'+media.id);assert.equal(final.downloadUrl,final.openUrl);assert.equal(items[0].downloadUrl,'');assert.doesNotMatch(JSON.stringify(items),/diskName|sha256/);
  await unlink(join(f.directory,'studio-media',media.diskName));assert.equal(f.view().items.find(item=>item.category==='delivery').openUrl,'https://example.test/preview');
});
