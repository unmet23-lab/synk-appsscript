import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {deliverableActions,emptyDeliverables,deliverableReadiness,deliverableView,applyDeliverableAction} from './pulse-deliverables.mjs';
import {deliverablesView} from './public/pulse-app/deliverables-view.mjs';
import {strategyView as strategyForm,strategySummary} from './public/pulse-app/strategy-view.mjs';

const staff={author:'staff',authorId:'private-user-id',authorName:'제작자',at:'2026-10-12T01:00:00.000Z'},customer={author:'customer',authorId:'customer',authorName:'고객',at:'2026-10-12T01:01:00.000Z'};
const item={label:'릴스 본편',kind:'video',platform:'instagram',placement:'릴스 · 유료 광고',durationSeconds:15,aspectRatio:'9:16',language:'한국어',subtitles:'burned',fileFormat:'MP4',quantity:1,notes:''};
const preview={id:randomUUID(),kind:'preview',label:'승인 시안',approvedAt:staff.at};
const final={id:randomUUID(),kind:'final',label:'최종 영상',approvedPreviewId:preview.id};
const row={versions:[preview,final]};
const reject=(run,status)=>assert.throws(run,error=>error.status===status);
function apply(studio,action,values={},asStaff=true,project=row){return applyDeliverableAction({studio,row:project,input:{action,revision:5,deliverableRevision:studio.deliverables?.revision||0,...values},staff:asStaff,stamp:asStaff?staff:customer});}
const save=(studio={},items=[item],asStaff=true)=>apply(studio,'save_deliverables',{items,notes:'파일 형식은 프로젝트별 협의'},asStaff);
const requested=()=>apply(save(),'request_deliverable_review');
const confirmed=()=>apply(requested(),'confirm_deliverables',{},false);

test('deliverables add an optional schema without changing existing studio fields',()=>{
 const studio={strategy:{revision:3},unrelated:{keep:true}},result=save(studio,[],false);
 assert.equal(result,studio);assert.deepEqual(result.unrelated,{keep:true});assert.equal(result.strategy.revision,3);
 assert.deepEqual(emptyDeliverables(),{revision:0,items:[],notes:'',request:null,confirmation:null,links:[],history:[]});
 assert.equal(result.deliverables.revision,1);assert.equal(deliverableReadiness(result.deliverables).ready,false);
 assert.equal(deliverableActions('unexpected'),null);assert.deepEqual(deliverableActions('confirm_deliverables'),['deliverableRevision']);
 const fields=deliverableActions('save_deliverables');fields.push('forged');assert.equal(deliverableActions('save_deliverables').includes('forged'),false);
});

test('clients can save incomplete preferences but review needs complete output specifications',()=>{
 const studio=save({},[{label:'신제품 영상',platform:'instagram'}],false);
 assert.equal(studio.deliverables.items[0].durationSeconds,null);assert.equal(studio.deliverables.items[0].quantity,1);
 reject(()=>apply(studio,'request_deliverable_review'),409);
 const next=save(studio,[{...item,id:studio.deliverables.items[0].id}]);assert.ok(apply(next,'request_deliverable_review').deliverables.request);
 const image=save({},[{...item,kind:'image',durationSeconds:null,subtitles:''}]);assert.equal(deliverableReadiness(image.deliverables).ready,true);
 const subtitle=save({},[{...item,kind:'subtitle',durationSeconds:null,subtitles:'',aspectRatio:'',fileFormat:'SRT'}]);assert.equal(deliverableReadiness(subtitle.deliverables).ready,true);
});

test('strict schema rejects forged fields, IDs, loose numbers, duplicate items and invalid choices',()=>{
 const invalid=[{label:'bad\u0000value'},{label:'x'.repeat(161)},{durationSeconds:'15'},{durationSeconds:0},{durationSeconds:601},{durationSeconds:NaN},{quantity:0},{quantity:101},{quantity:1.5},{quantity:'1'},{platform:'unknown'},{kind:'audio'},{aspectRatio:'3:2'},{subtitles:'yes'},{notes:'x'.repeat(1001)},{unknown:'private'}];
 for(const patch of invalid)reject(()=>save({},[{...item,...patch}]),400);
 reject(()=>save({},Array.from({length:31},()=>({...item}))),400);
 reject(()=>save({},[{...item,id:randomUUID()}]),404);
 const studio=save(),existing=studio.deliverables.items[0];reject(()=>save(studio,[existing,existing]),400);
 reject(()=>apply(studio,'save_deliverables',{items:[existing],notes:12}),400);
 reject(()=>apply(studio,'save_deliverables',{items:[existing],notes:'',authorId:'spoof'}),400);
 reject(()=>apply(studio,'save_deliverables',{items:[existing],notes:'',deliverableRevision:0}),409);
});

test('only staff requests and only customer confirms the exact requested specification',()=>{
 const studio=save();reject(()=>apply(studio,'confirm_deliverables',{},false),409);reject(()=>apply(studio,'request_deliverable_review',{},false),403);
 apply(studio,'request_deliverable_review');reject(()=>apply(studio,'request_deliverable_review'),409);reject(()=>apply(studio,'confirm_deliverables'),403);
 reject(()=>apply(studio,'confirm_deliverables',{deliverableRevision:0},false),409);reject(()=>apply(studio,'confirm_deliverables',{deliverableRevision:'1'},false),409);
 apply(studio,'confirm_deliverables',{},false);assert.equal(studio.deliverables.confirmation.deliverableRevision,1);reject(()=>apply(studio,'confirm_deliverables',{},false),409);
 reject(()=>applyDeliverableAction({studio,row,input:{action:'save_deliverables',deliverableRevision:1,items:[]},staff:false,stamp:staff}),403);
});

test('a changed list archives the complete approved version and invalidates current approval and links',()=>{
 const studio=confirmed(),before=structuredClone(studio.deliverables),itemId=before.items[0].id;
 apply(studio,'link_deliverable_version',{itemId,versionIds:[final.id]});
 save(studio,[{...before.items[0],durationSeconds:30}],false);
 assert.equal(studio.deliverables.revision,2);assert.equal(studio.deliverables.request,null);assert.equal(studio.deliverables.confirmation,null);assert.deepEqual(studio.deliverables.links,[]);
 assert.equal(studio.deliverables.history[0].items[0].durationSeconds,15);assert.equal(studio.deliverables.history[0].confirmation.deliverableRevision,1);assert.deepEqual(studio.deliverables.history[0].links[0].versionIds,[final.id]);
 apply(studio,'request_deliverable_review');reject(()=>apply(studio,'confirm_deliverables',{deliverableRevision:1},false),409);
});

test('final links are scoped to current approved preview, current specification and staff permission',()=>{
 const studio=confirmed(),itemId=studio.deliverables.items[0].id;
 reject(()=>apply(studio,'link_deliverable_version',{itemId,versionIds:[final.id]},false),403);
 reject(()=>apply(studio,'link_deliverable_version',{itemId,versionIds:[preview.id]}),404);
 reject(()=>apply(studio,'link_deliverable_version',{itemId,versionIds:[randomUUID()]}),404);
 reject(()=>apply(studio,'link_deliverable_version',{itemId,versionIds:[final.id,final.id]}),400);
 reject(()=>apply(studio,'link_deliverable_version',{itemId:randomUUID(),versionIds:[final.id]}),404);
 const second={...final,id:randomUUID(),label:'자막 없는 최종본'};
 apply(studio,'link_deliverable_version',{itemId,versionIds:[final.id,second.id]},true,{versions:[preview,final,second]});
 assert.deepEqual(studio.deliverables.links[0].versionIds,[final.id,second.id]);
 assert.equal(deliverableView(studio,{versions:[preview,final,second]}).links[0].current,true);
 const changed={versions:[preview,final,{id:randomUUID(),kind:'preview',approvedAt:null}]};
 assert.equal(deliverableView(studio,changed).links[0].current,false);
 reject(()=>apply(studio,'link_deliverable_version',{itemId,versionIds:[final.id]},true,changed),409);
 apply(studio,'link_deliverable_version',{itemId,versionIds:[]});assert.deepEqual(studio.deliverables.links,[]);
 const draft=save();reject(()=>apply(draft,'link_deliverable_version',{itemId:draft.deliverables.items[0].id,versionIds:[final.id]}),409);
});

test('public projections exclude internal metadata and keep bounded nonrecursive histories',()=>{
 const studio=confirmed();studio.deliverables.privateMemo='secret-note';studio.deliverables.items[0].privateSource='private-source';
 for(let i=2;i<=25;i++)save(studio,[{...item,id:studio.deliverables.items[0].id,label:'버전 '+i}]);
 assert.equal(studio.deliverables.history.length,20);assert.equal(studio.deliverables.history[0].revision,5);assert.equal(studio.deliverables.history.at(-1).revision,24);
 const output=deliverableView(studio,row);assert.equal(output.history.some(entry=>Object.hasOwn(entry,'history')),false);
 assert.doesNotMatch(JSON.stringify(output),/authorId|private-user-id|privateMemo|secret-note|privateSource|private-source/);
 output.items[0].label='outside';assert.notEqual(studio.deliverables.items[0].label,'outside');
});

test('read-only deliverable history has no mutations and editable fields have unique names',()=>{
 const studio=confirmed();studio.deliverables.items.push({...item,id:randomUUID(),label:'유튜브 본편'});
 const project={studio:{deliverables:deliverableView(studio,row)},versions:row.versions};
 const readOnly=deliverablesView({project,mode:'staff',canEdit:true},{readOnly:true});assert.doesNotMatch(readOnly,/<form|data-action=|data-mutate/);assert.match(readOnly,/릴스 본편/);assert.match(readOnly,/유튜브 본편/);
 const editable=deliverablesView({project,mode:'customer'});assert.match(editable,/name="deliverable_0_label"/);assert.match(editable,/name="deliverable_1_label"/);
 assert.doesNotMatch(editable,/data-form="deliverable-link"/);assert.match(editable,/data-form="deliverables"/);
});

test('strategy form asks one message, one proof and one action with optional legacy fields retained',()=>{
 const project={studio:{strategy:{revision:1,data:{primaryPromise:'메시지',evidence1:'자료',desiredAction:'구매처 방문',value1:'기존 가치'},history:[]}}};
 const html=strategyForm({project,mode:'customer'});for(const field of ['primaryPromise','evidence1','desiredAction'])assert.equal((html.match(new RegExp('name="'+field+'"','g'))||[]).length,1);
 for(const field of ['value1','value2','value3','evidence2','evidence3','subtitles','screenCopy','notes'])assert.match(html,new RegExp('name="'+field+'"'));
 assert.doesNotMatch(html,/핵심 가치 2~3개|전할 가치 2~3개/);assert.match(html,/메시지 · 근거 · 행동/);assert.match(strategySummary(project),/믿을 근거/);
});
