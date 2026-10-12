import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createProductionFixture} from './pulse-production-fixture.mjs';

const item={label:'릴스 본편',kind:'video',platform:'instagram',placement:'릴스 · 유료 광고',durationSeconds:15,aspectRatio:'9:16',language:'한국어',subtitles:'burned',fileFormat:'MP4',quantity:1,notes:'고객과 합의할 검증용 예시'};
async function fixture(t){const f=await createProductionFixture({seed:false});t.after(()=>f.stop());return f;}
async function save(f,items=[item],notes='납품 목록 검증',customer=null){return f.studio({action:'save_deliverables',deliverableRevision:f.row.studio?.deliverables?.revision||0,items,notes},customer);}
async function requestReview(f){return f.studio({action:'request_deliverable_review',deliverableRevision:f.row.studio.deliverables.revision});}
async function confirm(f,revision=f.row.studio.deliverables.revision){return f.studio({action:'confirm_deliverables',deliverableRevision:revision},f.customer);}
async function confirmed(f){f.ok(await save(f));f.ok(await requestReview(f));f.ok(await confirm(f));}
async function unchanged(f,status,operation){const before=structuredClone(f.app.store.get('clientProjects',f.row.id));const result=await operation();f.ok(result,status);assert.deepEqual(f.app.store.get('clientProjects',f.row.id),before,'rejected HTTP writes must leave the project unchanged');return result;}

test('HTTP deliverable draft, exact-version customer confirmation and revised history persist without video approval',async t=>{
  const f=await fixture(t),stage=f.row.stage,terms=f.row.terms;
  f.ok(await save(f,[{label:'릴스 영상',platform:'instagram'}],'고객이 아는 사용처만 남김',f.customer));
  assert.equal(f.row.studio.deliverables.revision,1);assert.equal(f.row.studio.deliverables.items[0].durationSeconds,null);
  await unchanged(f,409,()=>requestReview(f));
  const itemId=f.row.studio.deliverables.items[0].id;
  f.ok(await save(f,[{...item,id:itemId}]));assert.equal(f.row.studio.deliverables.revision,2);
  f.ok(await requestReview(f));assert.equal(f.row.studio.deliverables.request.deliverableRevision,2);
  f.ok(await confirm(f));const agreed=structuredClone(f.row.studio.deliverables);
  assert.equal(agreed.confirmation.author,'customer');assert.equal(agreed.confirmation.deliverableRevision,2);
  assert.equal(f.row.stage,stage);assert.equal(f.row.terms,terms);assert.deepEqual(f.row.versions,[]);assert.deepEqual(f.row.messages,[]);
  f.ok(await save(f,[{...agreed.items[0],durationSeconds:30}],'길이를 다시 협의',f.customer));
  const revised=f.row.studio.deliverables;
  assert.equal(revised.revision,3);assert.equal(revised.request,null);assert.equal(revised.confirmation,null);assert.deepEqual(revised.links,[]);
  const previous=revised.history.at(-1);assert.equal(previous.revision,2);assert.equal(previous.items[0].durationSeconds,15);assert.equal(previous.confirmation.deliverableRevision,2);
  f.ok(await requestReview(f));await unchanged(f,409,()=>confirm(f,2));f.ok(await confirm(f));
  const saved=structuredClone(f.row.studio.deliverables);await f.restart();await f.refresh();assert.deepEqual(f.row.studio.deliverables,saved);
  const staff=f.ok(await f.request(`/api/client-projects/${f.row.id}/studio`)).project;
  assert.deepEqual(staff.studio.deliverables,saved);assert.doesNotMatch(JSON.stringify(saved),/authorId|inviteHash|diskName|csrfToken/);
});

test('HTTP deliverable writes enforce project ACL, CSRF, origin, author role and both revision checks atomically',async t=>{
  const f=await fixture(t),startRevision=f.row.revision;
  await unchanged(f,403,()=>f.studio({action:'request_deliverable_review',deliverableRevision:0},f.customer));
  await unchanged(f,403,()=>f.studio({action:'confirm_deliverables',deliverableRevision:0}));
  const body={action:'save_deliverables',revision:f.row.revision,deliverableRevision:0,items:[item],notes:''};
  for(const headers of [{'X-Pulse-CSRF':''},{'X-Pulse-CSRF':'wrong'},{Origin:'https://wrong.example.test'}])await unchanged(f,403,()=>f.request('/pulse/api/studio',{customer:f.customer,body,headers}));
  await unchanged(f,400,()=>f.studio({...body,confirmation:{deliverableRevision:1}},f.customer));
  await unchanged(f,400,()=>f.studio({...body,items:[{...item,authorId:f.owner.id}]},f.customer));
  const other=f.app.store.createUser({name:'다른 담당자',email:'other-deliverable@example.test',role:'member',teamId:'other-team'}),token=f.app.store.mint('session',other.id,{csrfToken:'other-csrf'},10);
  await unchanged(f,404,()=>f.request(`/api/client-projects/${f.row.id}/studio`,{body,headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'other-csrf'}}));
  f.ok(await save(f,[item],'',f.customer));
  await unchanged(f,409,()=>f.studio({action:'save_deliverables',revision:startRevision,deliverableRevision:1,items:f.row.studio.deliverables.items,notes:''},f.customer));
  await unchanged(f,409,()=>f.studio({action:'save_deliverables',deliverableRevision:0,items:f.row.studio.deliverables.items,notes:''},f.customer));
  await unchanged(f,409,()=>confirm(f));
  f.ok(await requestReview(f));await unchanged(f,409,()=>requestReview(f));
  await unchanged(f,409,()=>confirm(f,'1'));f.ok(await confirm(f));await unchanged(f,409,()=>confirm(f));
  const itemId=f.row.studio.deliverables.items[0].id;
  await unchanged(f,403,()=>f.studio({action:'link_deliverable_version',deliverableRevision:1,itemId,versionIds:[]},f.customer));
});

test('HTTP final-file mapping requires real project finals from the latest approved preview and preserves old links',async t=>{
  const f=await fixture(t);await confirmed(f);const itemId=f.row.studio.deliverables.items[0].id;
  const bytes=await readFile(new URL('./public/pulse-app/demo-assets/preview-v1.mp4',import.meta.url));
  async function uploadVersion(kind,label,status=201){
    const result=await f.request(`/api/client-projects/${f.row.id}/media`,{body:bytes,raw:true,headers:{'Content-Type':'video/mp4','X-File-Name':`${kind}.mp4`,'X-Version-Label':encodeURIComponent(label),'X-Version-Kind':kind,'X-Version-Guide':encodeURIComponent('검증용 파일의 사용 안내'),'X-Project-Revision':String(f.row.revision)}});
    f.ok(result,status);if(status===201){f.row=result.data.project;await f.refresh();return f.row.versions.at(-1);}return result;
  }
  const preview=await uploadVersion('preview','HTTP 검증 시안 v1');
  await unchanged(f,409,()=>uploadVersion('final','아직 승인하지 않은 최종본',409));
  const approval=f.ok(await f.request('/pulse/api/action',{customer:f.customer,body:{action:'approve',revision:f.row.revision,versionId:preview.id}}));f.row=approval.project;await f.refresh();assert.ok(f.row.versions.find(version=>version.id===preview.id).approvedAt);
  const final=await uploadVersion('final','합의한 세로 최종본');assert.equal(final.approvedPreviewId,preview.id);assert.ok(final.media?.id);
  const link=(versionIds,extra={})=>f.studio({action:'link_deliverable_version',deliverableRevision:f.row.studio.deliverables.revision,itemId,versionIds,...extra});
  await unchanged(f,404,()=>link([randomUUID()]));await unchanged(f,404,()=>link([preview.id]));await unchanged(f,404,()=>link([final.id],{itemId:randomUUID()}));await unchanged(f,400,()=>link([final.id,final.id]));
  f.ok(await link([final.id]));assert.equal(f.row.studio.deliverables.links[0].current,true);assert.deepEqual(f.row.studio.deliverables.links[0].versionIds,[final.id]);
  const download=await f.request('/pulse/api/media/'+final.media.id,{customer:f.customer});f.ok(download);assert.deepEqual(download.bytes,bytes,'the mapped final file is really downloadable by this customer');
  await uploadVersion('preview','새로 검토할 시안 v2');assert.equal(f.row.studio.deliverables.links[0].current,false);
  await unchanged(f,409,()=>link([final.id]));
  const previous=f.row.studio.deliverables;
  f.ok(await save(f,[{...previous.items[0],durationSeconds:30}],'새 시안 길이에 맞춰 다시 협의'));
  assert.equal(f.row.studio.deliverables.confirmation,null);assert.deepEqual(f.row.studio.deliverables.links,[]);
  const historical=f.row.studio.deliverables.history.at(-1);assert.deepEqual(historical.links[0].versionIds,[final.id]);assert.equal(historical.links[0].current,false);assert.equal(historical.confirmation.deliverableRevision,1);
});
