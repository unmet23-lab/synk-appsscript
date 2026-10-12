import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,cp,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {request as httpRequest} from 'node:http';
import {createCompanyApp} from './server.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {acceptWorkspaceRestore} from './workspace-restore-acceptance.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const draft={title:'합성 광고 기획',customerName:'합성 고객',contact:'SYNTHETIC-PRIVATE-CONTACT',summary:'프로젝트 테스트',terms:'합성 합의',internalNotes:'SYNTHETIC-PRIVATE-STAFF',nextStep:'콘셉트 확인',dueDate:'2026-12-01',nextContactDate:''};
const strategyDraft={objective:'sales',product:'합성 제품',audience:'제품을 처음 보는 고객',channels:['instagram','website'],primaryPromise:'제품의 쓰임을 쉽게 이해',value1:'편리함',evidence1:'한 번의 조작으로 작동하는 사용 장면',value2:'가벼움',memoryHook:'제품 이름과 형태',desiredAction:'제품 페이지 방문'};
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-studio-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null};
  let app,base;async function start(){app=createCompanyApp(options);const address=await app.start();base='http://127.0.0.1:'+address.port;}await start();
  const users={},tokens={};for(const [name,role,teamId] of [['owner','member','a'],['other','member','b'],['viewer','viewer','a'],['reviewer','member','a']]){users[name]=app.store.createUser({name,email:name+'@pulse-synthetic.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'staff-csrf'},10);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer=null,headers={},method=body===undefined?'GET':'POST',raw=false}={}){
    const response=await fetch(base+path,{method,headers:{...(customer?{Cookie:customer.cookie}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'Content-Type':raw?'image/png':'application/json',...(customer?{'X-Pulse-CSRF':customer.csrf}:{'X-CSRF-Token':'staff-csrf'})}),...headers},...(body===undefined?{}:{body:raw?body:JSON.stringify(body)})});
    const bytes=Buffer.from(await response.arrayBuffer()),text=bytes.toString('utf8');return {status:response.status,headers:response.headers,bytes,text,data:response.headers.get('content-type')?.startsWith('application/json')&&text?JSON.parse(text):null};
  }
  async function create(user='owner',extra={}){const result=await request('/api/client-projects',{user,body:{...draft,...extra}});assert.equal(result.status,201);return result.data.project;}
  async function invite(row,user='owner'){const issued=await request('/api/client-projects/'+row.id+'/invite',{user,body:{revision:row.revision}});assert.equal(issued.status,200);const opened=await request('/pulse/api/open',{user:null,body:{invite:issued.data.invite}});assert.equal(opened.status,200);return {cookie:opened.headers.get('set-cookie').split(';')[0],csrf:opened.data.csrf,project:opened.data.project,invite:issued.data.invite};}
  const studio=(row,body,extra={})=>request('/api/client-projects/'+row.id+'/studio',{body:{revision:row.revision,...body},...extra});
  const customerStudio=(customer,row,body,extra={})=>request('/pulse/api/studio',{customer,body:{revision:row.revision,...body},...extra});
  const upload=(row,{customer,user='owner',headers={},body=png}={})=>request(customer?'/pulse/api/studio/media':'/api/client-projects/'+row.id+'/studio/media',{customer,user,body,raw:true,headers:{'X-Project-Revision':String(row.revision),'X-File-Name':encodeURIComponent('합성 참고.png'),...headers}});
  return {directory,options,get app(){return app;},get base(){return base;},users,tokens,request,create,invite,studio,customerStudio,upload,async restart(){await app.stop();await start();}};
}

test('customer taste, concept choice and scene review persist across server restart and are identical for staff',async t=>{
  const f=await fixture(t);let row=await f.create(),customer=await f.invite(row);row=customer.project;
  const preferences={brand:'합성 브랜드',goal:'제품을 이해하기',audience:'합성 고객군',mood:'차분한 빛',mustHave:'제품 이름',avoid:'과한 효과',notes:'화면 문구는 별도 확인'};
  let result=await f.customerStudio(customer,row,{action:'save_preferences',preferences});assert.equal(result.status,200);row=result.data.project;
  result=await f.studio(row,{action:'save_concept',title:'빛으로 여는 장면',description:'제품 중심',tagline:'가볍게 시작',imageUrl:'https://example.test/concept.jpg',visibility:'customer'});assert.equal(result.status,200);row=result.data.project;const concept=row.studio.concepts[0];
  result=await f.customerStudio(customer,row,{action:'select_concept',conceptId:concept.id,conceptRevision:concept.revision,text:'이 방향이 좋아요'});assert.equal(result.status,200);row=result.data.project;
  result=await f.studio(row,{action:'save_scene',title:'첫 장면',description:'제품 등장',narration:'안녕하세요',screenText:'제품명',duration:3,imageUrl:'https://example.test/scene.jpg',visibility:'customer'});assert.equal(result.status,200);row=result.data.project;const scene=row.studio.scenes[0];
  result=await f.customerStudio(customer,row,{action:'review_scene',sceneId:scene.id,sceneRevision:scene.revision,status:'changes',text:'문구를 조금 더 크게'});assert.equal(result.status,200);row=result.data.project;
  result=await f.studio(row,{action:'save_scene',id:scene.id,title:'첫 장면',description:'제품 등장',narration:'안녕하세요',screenText:'큰 제품명',duration:3,imageUrl:'https://example.test/scene-v2.jpg',visibility:'customer'});assert.equal(result.status,200);row=result.data.project;assert.equal(row.studio.sceneReviews[0].current,false);
  result=await f.customerStudio(customer,row,{action:'review_scene',sceneId:scene.id,sceneRevision:2,status:'confirmed',text:''});assert.equal(result.status,200);row=result.data.project;
  await f.restart();const client=(await f.request('/pulse/api/project',{customer})).data.project,staff=(await f.request('/api/client-projects/'+row.id+'/studio')).data.project;
  assert.deepEqual(client.studio.preferences,preferences);assert.deepEqual(staff.studio.preferences,preferences);assert.equal(client.studio.selectedConcept.current,true);assert.equal(client.studio.sceneReviews.length,2);assert.equal(client.studio.sceneReviews.at(-1).current,true);assert.equal(staff.studio.sceneReviews.at(-1).status,'confirmed');assert.equal(client.studio.cardRevisions.length,1);assert.equal(client.studio.cardRevisions[0].screenText,'제품명');
  assert.doesNotMatch(JSON.stringify(client),/SYNTHETIC-PRIVATE|inviteHash|authorId|diskName|csrf/);
});

test('private drafts, private comments and unshared staff assets stay hidden, including after later publication',async t=>{
  const f=await fixture(t);let row=await f.create(),customer=await f.invite(row);row=customer.project;
  let result=await f.upload(row);assert.equal(result.status,201);row=result.data.project;const asset=result.data.asset;
  result=await f.studio(row,{action:'save_concept',title:'PRIVATE-DRAFT',description:'SECRET-IDEA',tagline:'',assetId:asset.id,visibility:'internal'});assert.equal(result.status,200);row=result.data.project;const concept=row.studio.concepts[0];
  result=await f.studio(row,{action:'comment',targetType:'concept',targetId:concept.id,targetRevision:1,text:'PRIVATE-INTERNAL-COMMENT'});assert.equal(result.status,200);row=result.data.project;
  const client=await f.request('/pulse/api/project',{customer});assert.equal(client.data.project.studio.assets.length,0);assert.equal(client.data.project.studio.concepts.length,0);assert.doesNotMatch(client.text,/PRIVATE-DRAFT|SECRET-IDEA|PRIVATE-INTERNAL-COMMENT|diskName/);
  assert.equal((await f.request('/pulse/api/studio/media/'+asset.id,{customer})).status,404);
  assert.equal((await f.customerStudio(customer,row,{action:'save_reference',label:'stolen',assetId:asset.id,preference:'like',reason:''})).status,404);
  assert.equal((await f.customerStudio(customer,row,{action:'select_concept',conceptId:concept.id,conceptRevision:1})).status,404);
  result=await f.studio(row,{action:'save_concept',id:concept.id,title:'공개 콘셉트',description:'공개 설명',tagline:'',assetId:asset.id,visibility:'customer'});assert.equal(result.status,200);
  const published=await f.request('/pulse/api/project',{customer});assert.equal(published.data.project.studio.assets.length,1);assert.equal(published.data.project.studio.comments.length,0);assert.equal(published.data.project.studio.cardRevisions.length,0);assert.doesNotMatch(published.text,/PRIVATE-DRAFT|SECRET-IDEA|PRIVATE-INTERNAL-COMMENT/);
  assert.deepEqual((await f.request('/pulse/api/studio/media/'+asset.id,{customer})).bytes,png);
});

test('customer and staff roles, origin, CSRF, revision and target versions are enforced by the server',async t=>{
  const f=await fixture(t);let row=await f.create(),customer=await f.invite(row);row=customer.project;
  const body={action:'save_preferences',preferences:{goal:'test'}};
  for(const headers of [{'X-Pulse-CSRF':''},{'X-Pulse-CSRF':'bad'},{Origin:'https://wrong.test'}])assert.equal((await f.customerStudio(customer,row,body,{headers})).status,403);
  assert.equal((await f.request('/pulse/api/studio',{body:{...body,revision:row.revision}})).status,401);
  assert.equal((await f.studio(row,body,{user:'other'})).status,404);assert.equal((await f.studio(row,body,{user:'viewer'})).status,403);
  assert.equal((await f.customerStudio(customer,row,{action:'save_concept',title:'bad',description:'',tagline:'',visibility:'customer'})).status,403);
  assert.equal((await f.studio(row,{action:'select_concept',conceptId:row.id,conceptRevision:1})).status,403);
  let result=await f.studio(row,{action:'save_scene',title:'scene',description:'',narration:'',screenText:'',duration:4,visibility:'customer'});assert.equal(result.status,200);row=result.data.project;const scene=row.studio.scenes[0];
  assert.equal((await f.customerStudio(customer,row,{action:'review_scene',sceneId:scene.id,sceneRevision:0,status:'confirmed',text:''})).status,409);
  assert.equal((await f.customerStudio(customer,{...row,revision:row.revision-1},body)).status,409);
  assert.equal((await f.customerStudio(customer,row,{...body,preferences:{goal:'x',role:'admin'}})).status,400);
  assert.equal((await f.customerStudio(customer,row,{action:'save_reference',label:'bad',url:'javascript:alert(1)',preference:'like',reason:''})).status,400);
  const concurrent=await Promise.all([f.customerStudio(customer,row,body),f.studio(row,body)]);assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,409]);
});

test('uploaded references are project-scoped, Range-readable and remain private to other customers',async t=>{
  const f=await fixture(t);const first=await f.create(),second=await f.create('other'),a=await f.invite(first),b=await f.invite(second,'other');
  const uploaded=await f.upload(a.project,{customer:a});assert.equal(uploaded.status,201);const {project,asset}=uploaded.data;
  assert.equal((await f.request(asset.url,{customer:b})).status,404);assert.equal((await f.request(asset.url,{user:null})).status,401);
  assert.equal((await f.request('/api/client-projects/'+project.id+'/studio/media/'+asset.id,{user:'other'})).status,404);
  const partial=await f.request(asset.url,{customer:a,headers:{Range:'bytes=0-7'}});assert.equal(partial.status,206);assert.deepEqual(partial.bytes,png.subarray(0,8));assert.match(partial.headers.get('cache-control'),/no-store/);
  const reference=await f.customerStudio(a,project,{action:'save_reference',label:'밝은 색감',assetId:asset.id,preference:'like',reason:'제품이 잘 보임'});assert.equal(reference.status,200);assert.equal(reference.data.project.studio.references[0].media.url,asset.url);
  const revoked=await f.request('/api/client-projects/'+project.id+'/revoke',{body:{revision:reference.data.project.revision}});assert.equal(revoked.status,200);assert.equal((await f.request(asset.url,{customer:a})).status,401);
});

test('streamed upload rechecks invite revocation and removes the temporary file',async t=>{
  const f=await fixture(t),row=await f.create(),customer=await f.invite(row);let observed=false;
  const result=await new Promise((resolveResult,reject)=>{
    const req=httpRequest(f.base+'/pulse/api/studio/media',{method:'POST',headers:{Cookie:customer.cookie,Origin:f.app.origin,'X-Pulse-CSRF':customer.csrf,'Content-Type':'image/png','X-File-Name':'synthetic.png','X-Project-Revision':String(customer.project.revision),'Content-Length':png.length}},res=>{res.resume();res.on('end',()=>resolveResult(res.statusCode));});req.on('error',reject);req.write(png.subarray(0,8));
    void(async()=>{for(let i=0;i<100;i++){const names=await readdir(join(f.options.dataDir,'studio-media')).catch(()=>[]);if(names.some(name=>name.endsWith('.upload'))){observed=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(observed,true);await f.request('/api/client-projects/'+row.id+'/revoke',{body:{revision:customer.project.revision}});req.end(png.subarray(8));})().catch(error=>{req.destroy();reject(error);});
  });
  assert.equal(result,401);assert.deepEqual(await readdir(join(f.options.dataDir,'studio-media')),[]);assert.equal(f.app.store.get('clientProjects',row.id).studio,undefined);
});

test('latest-version feedback blocks approval but a reviewed newer preview resolves the older request',async t=>{
  const f=await fixture(t);let row=await f.create();row=(await f.request('/api/client-projects/'+row.id+'/versions',{body:{revision:row.revision,kind:'preview',label:'v1',url:'https://example.test/v1'}})).data.project;const customer=await f.invite(row);row=customer.project;
  let result=await f.request('/pulse/api/action',{customer,body:{action:'feedback',revision:row.revision,versionId:row.versions[0].id,seconds:12.5,text:'이 장면을 밝게'}});assert.equal(result.status,200);row=result.data.project;const feedback=row.messages.at(-1);
  assert.equal((await f.request('/pulse/api/action',{customer,body:{action:'approve',revision:row.revision,versionId:row.versions[0].id}})).status,409);
  row=(await f.request('/api/client-projects/'+row.id+'/versions',{body:{revision:row.revision,kind:'preview',label:'v2',url:'https://example.test/v2'}})).data.project;
  const beforeApproval=f.app.store.get('clientProjects',row.id);
  const premature=await f.request('/pulse/api/action',{customer,body:{action:'approve',revision:row.revision,versionId:row.versions.at(-1).id}});
  assert.equal(premature.status,409);assert.match(premature.data.error,/최신 수정본에 연결하고 검토/);
  assert.deepEqual(f.app.store.get('clientProjects',row.id),beforeApproval,'rejected early approval changes neither customer approval nor the unresolved request');
  row=(await f.request('/api/client-workflow',{body:{projectId:row.id,revision:row.revision,messageId:feedback.id,action:'submit_review',versionId:row.versions.at(-1).id}})).data.project;
  assert.equal(row.messages.find(message=>message.id===feedback.id).workflow.status,'waiting_customer');
  result=await f.request('/pulse/api/action',{customer,body:{action:'approve',revision:row.revision,versionId:row.versions.at(-1).id}});assert.equal(result.status,200);row=result.data.project;assert.ok(row.versions.at(-1).approvedAt);assert.equal(row.messages.find(message=>message.id===feedback.id).resolved,true);assert.equal(row.messages.find(message=>message.id===feedback.id).workflow,undefined);
  result=await f.request('/api/client-projects/'+row.id+'/versions',{body:{revision:row.revision,kind:'final',label:'final',url:'https://example.test/final',guide:'합의한 사용 안내'}});assert.equal(result.status,200);assert.equal(result.data.project.stage,'delivered');
});

test('studio originals are included in backup and missing referenced originals fail restore validation',async t=>{
  const f=await fixture(t),row=await f.create(),customer=await f.invite(row),uploaded=await f.upload(customer.project,{customer});assert.equal(uploaded.status,201);
  const stored=f.app.store.get('clientProjects',row.id).studio.assets[0];await f.app.stop();
  const baseline=await backupWorkspace({destination:join(f.directory,'backups'),companyDataDir:f.options.dataDir,messengerDataDir:join(f.options.dataDir,'messenger')});
  assert.deepEqual(await readFile(join(baseline,'company','studio-media',stored.diskName)),png);
  const manifest=JSON.parse(await readFile(join(baseline,'integration-manifest.json'),'utf8'));assert.equal(manifest.mediaCount,1);
  const candidate=join(f.directory,'candidate');await cp(baseline,candidate,{recursive:true});await rm(join(candidate,'company','studio-media',stored.diskName));
  const report=await acceptWorkspaceRestore({candidateDirectory:candidate,baselineDirectory:baseline,freshnessEvidence:{kind:'synthetic-rehearsal',declaredLatest:true,writersStopped:true,writersStoppedAt:manifest.createdAt,baselineCreatedAt:manifest.createdAt,recordedAt:new Date().toISOString()}});
  assert.equal(report.status,'rejected');assert.ok(report.issues.includes('REFERENCED_MEDIA_MISSING'));
});

test('concept selection requires a visible image and preserves the exact selected revision after edits',async t=>{
  const f=await fixture(t);let row=await f.create(),customer=await f.invite(row);row=customer.project;
  let result=await f.studio(row,{action:'save_concept',title:'준비 중',description:'',tagline:'',visibility:'customer'});assert.equal(result.status,200);row=result.data.project;const concept=row.studio.concepts[0];
  assert.equal((await f.customerStudio(customer,row,{action:'select_concept',conceptId:concept.id,conceptRevision:1})).status,409);
  result=await f.studio(row,{action:'save_concept',id:concept.id,title:'보여줄 콘셉트',description:'',tagline:'',imageUrl:'https://example.test/image.jpg',visibility:'customer'});assert.equal(result.status,200);row=result.data.project;
  result=await f.customerStudio(customer,row,{action:'select_concept',conceptId:concept.id,conceptRevision:2});assert.equal(result.status,200);row=result.data.project;assert.equal(row.studio.selectedConcept.current,true);
  result=await f.studio(row,{action:'save_concept',id:concept.id,title:'수정된 콘셉트',description:'새 메시지',tagline:'',imageUrl:'https://example.test/new-image.jpg',visibility:'customer'});assert.equal(result.status,200);row=result.data.project;
  assert.equal(row.studio.selectedConcept.current,false);assert.equal(row.studio.selectedConcept.conceptRevision,2);assert.equal(row.studio.conceptSelections.length,1);assert.equal(row.studio.cardRevisions.at(-1).title,'보여줄 콘셉트');
});

test('customer upload requires CSRF and a current revision and rejects invalid media without storage leaks',async t=>{
  const f=await fixture(t),row=await f.create(),customer=await f.invite(row);
  assert.equal((await f.upload(customer.project,{customer,headers:{'X-Pulse-CSRF':''}})).status,403);
  assert.equal((await f.upload(customer.project,{customer,headers:{'X-Project-Revision':'-1'}})).status,409);
  assert.equal((await f.upload(customer.project,{customer,headers:{'Content-Type':'text/html'}})).status,415);
  assert.equal((await f.upload(customer.project,{customer,body:Buffer.from('<script>invalid</script>')})).status,415);
  assert.equal((await f.upload(customer.project,{user:'viewer'})).status,403);
  assert.deepEqual(await readdir(join(f.options.dataDir,'studio-media')).catch(()=>[]),[]);
  assert.equal(f.app.store.get('clientProjects',row.id).studio,undefined);
});

test('independent PULSE entry and service worker use explicit public static routes and correct MIME',async t=>{
  const f=await fixture(t);
  for(const path of ['/pulse-app/','/pulse-app/index.html']){const result=await f.request(path,{user:null});assert.equal(result.status,200);assert.match(result.headers.get('content-type'),/^text\/html/);assert.match(result.headers.get('content-security-policy'),/frame-ancestors 'none'/);}
  for(const [path,mime] of [['/pulse-app/sw.js','text/javascript'],['/pulse-app/manifest.webmanifest','application/manifest+json'],['/pulse-app/assets/SUIT.woff2','font/woff2'],['/pulse-app/assets/brand-pulse.webp','image/webp'],['/pulse-app/icons/synk.svg','image/svg+xml']]){const result=await f.request(path,{user:null});assert.equal(result.status,200,path);assert.ok(result.headers.get('content-type').startsWith(mime),path);}
  assert.equal((await f.request('/pulse-app/pulse-studio.mjs',{user:null})).status,404);
  assert.equal((await f.request('/pulse-app/../pulse-studio.mjs',{user:null})).status,404);
});

test('strategy drafts, requested planning confirmation and complete prior versions persist without approving a video',async t=>{
 const f=await fixture(t);let row=await f.create();
 row=(await f.request('/api/client-projects/'+row.id+'/versions',{body:{revision:row.revision,kind:'preview',label:'시안',url:'https://example.test/video'}})).data.project;
 const customer=await f.invite(row);row=customer.project;const initialStage=row.stage;
 assert.equal(row.studio.strategy.revision,0);assert.equal(row.studio.strategy.confirmation,null);
 let result=await f.customerStudio(customer,row,{action:'save_strategy',strategy:strategyDraft});assert.equal(result.status,200);row=result.data.project;
 assert.equal(row.studio.strategy.revision,1);assert.equal(row.studio.strategy.author,'customer');
 result=await f.studio(row,{action:'request_strategy_review'});assert.equal(result.status,200);row=result.data.project;const requestedRevision=row.revision;
 assert.equal(row.studio.strategy.request.strategyRevision,1);
 result=await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:1});assert.equal(result.status,200);row=result.data.project;
 assert.equal(row.revision,requestedRevision+1);assert.equal(row.studio.strategy.confirmation.author,'customer');assert.equal(row.stage,initialStage);assert.equal(row.versions[0].approvedAt,null);assert.deepEqual(row.messages,[]);assert.equal(row.terms,draft.terms);
 result=await f.studio(row,{action:'save_strategy',strategy:{...strategyDraft,value2:'새 가치',planInterest:'premium',proposedDeadline:'2026-10-31',revisionNotes:'횟수 협의 필요'}});assert.equal(result.status,200);row=result.data.project;
 assert.equal(row.studio.strategy.revision,2);assert.equal(row.studio.strategy.request,null);assert.equal(row.studio.strategy.confirmation,null);assert.equal(row.studio.strategy.history[0].confirmation.strategyRevision,1);assert.equal(row.studio.strategy.history[0].data.value2,'가벼움');assert.equal(row.stage,initialStage);assert.equal(row.terms,draft.terms);
 result=await f.studio(row,{action:'request_strategy_review'});assert.equal(result.status,200);row=result.data.project;
 assert.equal((await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:1})).status,409);
 result=await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:2});assert.equal(result.status,200);row=result.data.project;
 await f.restart();const persisted=await f.request('/pulse/api/project',{customer});assert.equal(persisted.status,200);assert.deepEqual(persisted.data.project.studio.strategy,row.studio.strategy);assert.doesNotMatch(JSON.stringify(persisted.data.project.studio.strategy),/authorId|inviteHash|csrf|diskName/);assert.equal(persisted.data.project.history,undefined);
 assert.deepEqual((await f.request('/api/client-projects/'+row.id+'/studio')).data.project.studio.strategy,row.studio.strategy);
});

test('strategy API rejects unauthorized, stale, forged and premature confirmations without partial writes',async t=>{
 const f=await fixture(t);let row=await f.create(),customer=await f.invite(row);row=customer.project;
 const save={action:'save_strategy',strategy:strategyDraft};
 for(const headers of [{'X-Pulse-CSRF':''},{'X-Pulse-CSRF':'wrong'},{Origin:'https://wrong.test'}])assert.equal((await f.customerStudio(customer,row,save,{headers})).status,403);
 assert.equal((await f.studio(row,save,{user:'other'})).status,404);assert.equal((await f.studio(row,save,{user:'viewer'})).status,403);
 assert.equal((await f.studio(row,save,{headers:{'X-CSRF-Token':'wrong'}})).status,403);
 assert.equal((await f.customerStudio(customer,row,{action:'request_strategy_review'})).status,403);
 assert.equal((await f.studio(row,{action:'confirm_strategy',strategyRevision:0})).status,403);
 assert.equal((await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:0})).status,409);
 assert.equal((await f.studio(row,{action:'request_strategy_review'})).status,409);
 assert.equal((await f.customerStudio(customer,row,{...save,strategy:{...strategyDraft,approved:true}})).status,400);
 assert.equal((await f.customerStudio(customer,row,{...save,confirmation:{strategyRevision:1}})).status,400);
 let result=await f.customerStudio(customer,row,{action:'save_strategy',strategy:{notes:'아직 정하지 않은 초안'}});assert.equal(result.status,200);row=result.data.project;
 assert.equal((await f.studio(row,{action:'request_strategy_review'})).status,409);
 const before=f.app.store.get('clientProjects',row.id);assert.equal((await f.customerStudio(customer,{...row,revision:row.revision-1},save)).status,409);assert.deepEqual(f.app.store.get('clientProjects',row.id),before);
 const responses=await Promise.all([f.customerStudio(customer,row,save),f.studio(row,save)]);assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);row=responses.find(response=>response.status===200).data.project;
 result=await f.studio(row,{action:'request_strategy_review'});assert.equal(result.status,200);row=result.data.project;
 assert.equal((await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:row.studio.strategy.revision+1})).status,409);
 const revoke=await f.request('/api/client-projects/'+row.id+'/revoke',{body:{revision:row.revision}});assert.equal(revoke.status,200);
 assert.equal((await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:row.studio.strategy.revision})).status,401);
});

test('legacy studio and project fields survive strategy edits while scene mappings preserve their original wording',async t=>{
 const f=await fixture(t);let row=await f.create(),customer=await f.invite(row);row=customer.project;
 let result=await f.studio(row,{action:'save_preferences',preferences:{brand:'이전 브랜드',goal:'이전 목적'}});row=result.data.project;
 const saved=f.app.store.get('clientProjects',row.id);delete saved.studio.strategy;saved.legacyExtra={keep:true};saved.studio.legacyExtra={keep:true};f.app.store.put('clientProjects',row.id,saved);
 const old=f.app.store.get('clientProjects',row.id);assert.equal((await f.request('/pulse/api/project',{customer})).data.project.studio.strategy.revision,0);assert.deepEqual(f.app.store.get('clientProjects',row.id),old,'reading does not rewrite a legacy row');
 result=await f.studio(row,{action:'save_strategy',strategy:strategyDraft});assert.equal(result.status,200);row=result.data.project;
 const sceneDraft={action:'save_scene',title:'가치를 보여주는 장면',description:'제품 등장',narration:'',screenText:'',duration:3,visibility:'customer'};
 result=await f.studio(row,{...sceneDraft,purpose:'value',valueNumbers:[1,2]});assert.equal(result.status,200);row=result.data.project;const scene=row.studio.scenes[0];
 assert.deepEqual(scene.valueLabels,[{number:1,text:'편리함'},{number:2,text:'가벼움'}]);assert.equal(scene.strategyRevision,1);
 assert.equal((await f.studio(row,{...sceneDraft,valueNumbers:[3]})).status,400);assert.equal((await f.studio(row,{...sceneDraft,valueNumbers:[1],valueLabels:[{number:1,text:'forged'}]})).status,400);
 result=await f.studio(row,{action:'save_strategy',strategy:{...strategyDraft,value1:'새로운 편리함',value2:''}});assert.equal(result.status,200);row=result.data.project;
 assert.deepEqual(row.studio.scenes[0],scene,'strategy update never silently rewrites scenes');
 result=await f.studio(row,{...sceneDraft,id:scene.id,title:'이전 폼으로 제목 변경'});assert.equal(result.status,200);row=result.data.project;
 for(const key of ['purpose','valueNumbers','strategyRevision','valueLabels'])assert.deepEqual(row.studio.scenes[0][key],scene[key],key);
 result=await f.studio(row,{...sceneDraft,id:scene.id,purpose:'proof',valueNumbers:[1]});assert.equal(result.status,200);row=result.data.project;
 assert.equal(row.studio.scenes[0].strategyRevision,2);assert.deepEqual(row.studio.scenes[0].valueLabels,[{number:1,text:'새로운 편리함'}]);assert.deepEqual(row.studio.cardRevisions[0].valueLabels,scene.valueLabels);
 const persisted=f.app.store.get('clientProjects',row.id);assert.deepEqual(persisted.legacyExtra,{keep:true});assert.deepEqual(persisted.studio.legacyExtra,{keep:true});assert.equal(persisted.studio.preferences.brand,'이전 브랜드');assert.equal(persisted.studio.preferences.goal,'이전 목적');assert.equal(persisted.terms,draft.terms);
});
