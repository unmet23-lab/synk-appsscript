import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {buildClientKickoff} from './client-kickoff.mjs';
import {buildClientSchedule} from './client-schedule.mjs';
import {buildClientCloseout} from './client-closeout.mjs';
import {buildSceneRequests} from './client-scene-requests.mjs';
import {buildClientProjectGroups} from './client-project-groups.mjs';

const context=vm.createContext({Date,Map,Set});
vm.runInContext(readFileSync(new URL('public/client-project-screen-plan.js',import.meta.url),'utf8'),context);
const plan=context.clientProjectScreenPlan;
const base={id:'project-one',title:'합성 프로젝트',stage:'planning',revision:4,versions:[],messages:[],dueDate:'',terms:'',nextContactDate:''};
const item=(changes={})=>({id:'task-one',projectId:base.id,revision:base.revision,kind:'support',group:'reply',status:'open',title:'고객 문의',statusLabel:'내 차례',dueDate:'',...changes});
const keys=['materials','kickoff','requests','schedule','delivery','closeout','followup','record','lounge','versions','messages'];
const section=(result,key)=>result.sections.find(entry=>entry.key===key);
const plain=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};

test('every stage keeps every existing section once while its relevant panels come first',()=>{
  const heads={received:'kickoff',planning:'kickoff',producing:'requests',review:'requests',delivered:'delivery',archived:'materials'};
  for(const [stage,first]of Object.entries(heads)){
    const result=plan({...base,stage});
    assert.equal(result.sections[0].key,first);
    assert.deepEqual([...result.sections.map(entry=>entry.key)].sort(),keys.slice().sort());
    assert.equal(result.sections.length,new Set(result.sections.map(entry=>entry.key)).size);
    assert.deepEqual([...result.defaultOpen],[...result.sections.filter(entry=>entry.open).map(entry=>entry.key)]);
    assert.equal(result.defaultOpen.length,stage==='received'?1:2);
  }
  assert.equal(section(plan({...base,stage:'unknown'}),'record').open,true);
});

test('real disabled kickoff and schedule projections never turn missing setup into warnings',()=>{
  const row={...base,studio:{}},kickoff=buildClientKickoff(row,{now:'2026-10-12T01:00:00Z'}),schedule=buildClientSchedule(row,{now:'2026-10-12T01:00:00Z'});
  assert.ok(kickoff.missingCount>0);
  const result=plan({...row,kickoff,schedule},{workflowItems:[item({kind:'client_kickoff'}),item({id:'old-schedule',kind:'client_schedule'})]});
  assert.equal(section(result,'kickoff').attention,false);
  assert.equal(section(result,'schedule').attention,false);
  assert.match(section(result,'kickoff').summary,/꺼짐/);
  assert.deepEqual([...result.attentionSections],[]);
});

test('enabled unresolved kickoff stays visible even if the registered stage is already delivered',()=>{
  const row={...base,stage:'delivered',studio:{},kickoffPlan:{enabled:true,dueDate:'2026-10-20',requirements:[]}},kickoff=buildClientKickoff(row,{now:'2026-10-12T01:00:00Z'});
  assert.equal(kickoff.status,'waiting');
  const result=plan({...row,kickoff});
  assert.equal(section(result,'kickoff').attention,true);
  assert.equal(section(result,'kickoff').open,true);
  assert.match(section(result,'kickoff').summary,/챙길 것/);
});

test('pending changes and reviewed changes needing a new baseline remain visible',()=>{
  for(const status of ['pending','reviewed']){
    const result=plan({...base,changes:{enabled:true,status,pendingCount:status==='pending'?2:0,statusLabel:'기존 변경 상태'}});
    assert.equal(section(result,'kickoff').attention,true);
    assert.equal(section(result,'kickoff').open,true);
  }
  assert.match(section(plan({...base,changes:{enabled:true,status:'reviewed'}}),'kickoff').summary,/새 기준으로 저장/);
  for(const status of ['disabled','clean','archived'])assert.equal(section(plan({...base,changes:{enabled:status!=='disabled',status,pendingCount:8}}),'kickoff').attention,false);
});

test('schedule warnings use existing enabled attention state without calculating a new forecast',()=>{
  assert.equal(section(plan({...base,schedule:{enabled:true,status:'attention',pendingCount:3}}),'schedule').attention,true);
  for(const status of ['tracking','complete','disabled','archived'])assert.equal(section(plan({...base,schedule:{enabled:true,status,pendingCount:3,risk:{status:'unknown'}}}),'schedule').attention,false);
  assert.equal(section(plan({...base,dueDate:'2020-01-01'}),'schedule').attention,false);
});

test('unavailable scene requests from the authoritative projection stay open for read-only viewers',()=>{
  const row={...base,stage:'delivered',studio:{sceneReviews:[{id:'scene-review',sceneId:'deleted-scene',author:'customer',status:'changes',at:'2026-10-11T00:00:00Z'}]}},sceneRequests=buildSceneRequests(row,{canEdit:false,canReview:false});
  assert.equal(sceneRequests.items[0].status,'unavailable');
  const result=plan({...row,sceneRequests});
  assert.equal(section(result,'requests').attention,true);
  assert.equal(section(result,'requests').open,true);
  assert.match(section(result,'requests').summary,/아직 1건/);
});

test('only unresolved customer support and feedback produce request warnings',()=>{
  const messages=[{author:'customer',action:'approve',resolved:false},{author:'staff',action:'support',resolved:false},{author:'customer',action:'support',resolved:true},{author:'customer',action:'feedback',workflow:{status:'done'}},{author:'customer',action:'feedback',resolved:false}];
  const result=plan({...base,stage:'delivered',messages});
  assert.equal(section(result,'messages').attention,true);
  assert.equal(section(result,'messages').open,true);
  assert.match(section(result,'messages').summary,/1건/);
  assert.equal(section(plan({...base,messages:messages.slice(0,-1)}),'messages').attention,false);
});

test('the existing project group remains the sole source of primary action, reason and counts',()=>{
  const tasks=[item({id:'later',dueDate:'2026-10-20'}),item({id:'first',dueDate:'2026-10-11',kind:'delivery',group:'next'})],group=buildClientProjectGroups(tasks,{today:'2026-10-12'})[0];
  const result=plan(base,{group,workflowItems:tasks,today:'2026-10-12'});
  assert.equal(result.primary,group.primary);
  assert.equal(result.reason,group.reason);
  assert.equal(result.counts,group.counts);
  assert.equal(result.primary.id,'first');
  assert.equal(section(result,'delivery').attention,true);
  assert.equal(section(result,'messages').attention,true);
});

test('waiting-only groups remain waiting-only without inventing an actionable primary',()=>{
  const group=buildClientProjectGroups([item({kind:'customer_review',status:'waiting_customer',group:'waiting'})],{today:'2026-10-12'})[0],result=plan(base,{group});
  assert.equal(result.primary,null);
  assert.equal(result.counts.actionable,0);
  assert.equal(result.reason,group.reason);
  assert.equal(section(result,'versions').attention,true);
  assert.equal(section(result,'versions').open,true);
});

test('a missing or other-project workflow group does not claim zero work or leak its priority',()=>{
  const group={projectId:'other-project',primary:{title:'남의 프로젝트'},reason:'다른 이유',counts:{total:3},items:[item({projectId:'other-project'})]};
  for(const candidate of [null,group]){
    const result=plan(base,{group:candidate,workflowItems:[item({projectId:'other-project'})]});
    assert.equal(result.primary,null);assert.equal(result.reason,'');assert.equal(result.counts,null);
    assert.deepEqual([...result.attentionSections],[]);
  }
});

test('completed, archived and stale-revision workflow rows do not reintroduce warnings',()=>{
  const tasks=['done','complete','completed','archived'].map((status,index)=>item({id:'finished-'+index,kind:'client_delivery_check',status}));
  tasks.push(item({id:'resolved',kind:'client_delivery_check',resolved:true}),item({id:'old',kind:'client_delivery_check',revision:3}),item({id:'archived',kind:'client_delivery_check',stage:'archived'}));
  assert.equal(section(plan(base,{workflowItems:tasks}),'delivery').attention,false);
  assert.equal(section(plan(base,{workflowItems:[item({kind:'client_delivery_check',status:'attention',statusLabel:'규격 확인 필요'})]}),'delivery').attention,true);
});

test('concurrent older or completed group priorities ask for a refresh without recomputing priority',()=>{
  for(const previous of [item({revision:3}),item({status:'done'}),item({resolved:true})]){
    const group={projectId:base.id,primary:previous,reason:'기존 우선순위',counts:{total:2},items:[previous,item({id:'still-current'})]},result=plan(base,{group});
    assert.equal(result.workflowStale,true);assert.equal(result.primary,null);assert.equal(result.reason,'');assert.equal(result.counts,null);
  }
  const group=buildClientProjectGroups([item()],{today:'2026-10-12'})[0];
  assert.equal(plan(base,{group}).workflowStale,false);
});

test('a loaded confirmed delivery projection can warn read-only users without fabricating unconfigured work',()=>{
  assert.equal(section(plan({...base,deliveryCheck:{confirmed:true,pendingCount:2,status:'attention',statusLabel:'파일 확인 필요'}}),'delivery').attention,true);
  for(const deliveryCheck of [undefined,{confirmed:false,pendingCount:2,status:'attention'},{confirmed:true,pendingCount:0,status:'ready'},{confirmed:true,pendingCount:2,status:'archived'}])assert.equal(section(plan({...base,deliveryCheck}),'delivery').attention,false);
});

test('closeout warnings apply only to a current delivery identity and never reuse a previous approval',()=>{
  const versions=[{id:'preview-one',kind:'preview',label:'첫 시안',approvedAt:'2026-10-01T00:00:00Z',createdAt:'2026-10-01T00:00:00Z'},{id:'final-one',kind:'final',label:'이전 최종본',approvedPreviewId:'preview-one',createdAt:'2026-10-02T00:00:00Z'}];
  const row={...base,stage:'delivered',versions},closeout=buildClientCloseout(row,{now:'2026-10-12T01:00:00Z'});
  assert.equal(closeout.overdue,true);
  assert.equal(section(plan({...row,closeout}),'closeout').attention,true);
  const newer={...row,versions:[...versions,{id:'preview-two',kind:'preview',label:'새 시안',createdAt:'2026-10-11T00:00:00Z'}]},current=buildClientCloseout(newer,{now:'2026-10-12T01:00:00Z'}),result=plan({...newer,closeout:current});
  assert.equal(current.deliveryKey,null);
  assert.equal(section(result,'closeout').attention,false);
  assert.doesNotMatch(section(result,'delivery').summary,/현재 승인본 납품 파일/);
  assert.match(section(result,'versions').summary,/새 시안.*고객 확인 기다리는 중/);
});

test('follow-up dates use the supplied valid Korean day and do not warn on absent or invalid dates',()=>{
  const options={today:'2026-10-12'};
  for(const nextContactDate of ['2026-10-11','2026-10-12'])assert.equal(section(plan({...base,nextContactDate},options),'followup').attention,true);
  for(const nextContactDate of ['','2026-10-13','2026-02-30','today',null])assert.equal(section(plan({...base,nextContactDate},options),'followup').attention,false);
  assert.equal(section(plan({...base,nextContactDate:'2026-10-11'}),'followup').attention,false);
});

test('archived projects retain accessible history without live task or failure indicators',()=>{
  const project={...base,stage:'archived',nextContactDate:'2026-10-01',kickoff:{enabled:true,status:'waiting',missingCount:4},sceneRequests:{pendingCount:2,items:[{},{}]},schedule:{enabled:true,status:'attention',pendingCount:5},messages:[{author:'customer',action:'support'}]};
  const group=buildClientProjectGroups([item()],{today:'2026-10-12'})[0],result=plan(project,{group,workflowItems:[item()],today:'2026-10-12'});
  assert.deepEqual([...result.attentionSections],[]);assert.equal(result.primary,null);assert.equal(result.counts,null);
  assert.equal(result.sections.length,11);assert.equal(result.sections.every(entry=>entry.summary.startsWith('보관 기록 · ')),true);
});

test('frozen project and workflow records are never mutated and calls are deterministic without browser APIs',()=>{
  const project=freeze({...base,messages:[{author:'customer',action:'support',resolved:false}],kickoff:{enabled:true,status:'waiting',missingCount:1}}),group=freeze(buildClientProjectGroups([item()],{today:'2026-10-12'})[0]),options=freeze({group,workflowItems:group.items,today:'2026-10-12'});
  const before=JSON.stringify({project,options}),a=plan(project,options),b=plan(project,options);
  assert.deepEqual(plain(a),plain(b));assert.equal(JSON.stringify({project,options}),before);
  assert.equal(plan(null).sections.length,11);
});
