import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {projectView} from './public/pulse-app/views.mjs';
import {usesRoom,roomRoute,roomTab,journalModel} from './public/pulse-app/room-view.mjs';
// 클릭 · 불러오기 원문만 vm에 넣으므로 번역 틀의 진짜 함수를 맥락에 넣는다(다국어 판 2).
import {t,k,locale} from './public/pulse-app/i18n.mjs';

const source=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
const clickStart=source.indexOf("document.addEventListener('click',async event=>{"),clickSource=source.slice(clickStart,source.indexOf('\n});',clickStart)+4);
const loadProjectSource=source.split('\n').find(line=>line.startsWith('async function loadProject('));
const withLeaveSource=source.split('\n').find(line=>line.startsWith('function withLeave('));
const resetContextSource=source.split('\n').find(line=>line.startsWith('function resetContext('));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const project=(id='p')=>({id,revision:5,title:'알림 경로 시험',stage:'review',versions:[{id:'v1',kind:'preview',label:'시안'}],messages:[],studio:{preferences:{},concepts:[],scenes:[],sceneReviews:[],comments:[],feedbackRounds:{drafts:[],rounds:[]}}});
function render(s){const original=globalThis.location;globalThis.location={origin:'https://pulse.example.test'};try{return projectView(s);}finally{if(original===undefined)delete globalThis.location;else globalThis.location=original;}}
const comment=(id,type='project',targetId=null)=>({id,targetType:type,targetId,targetRevision:type==='project'?null:1,text:'답변 '+id,author:'staff',authorName:'합성 담당자',at:'2026-10-14T00:00:00Z'});

test('project replies with their stored null target appear in 05, including older notification targets',()=>{
  const p=project();p.studio.comments=Array.from({length:7},(_,i)=>comment('project-'+i));
  const html=render({mode:'customer',project:p,tab:'review',versionId:'v1',notificationCommentId:'project-0'});
  for(let i=0;i<7;i++)assert.match(html,new RegExp('data-message-id="project-'+i+'"'));
  // 시사실 판(2026-11-05): 영상 확인의 프로젝트 답변은 「담당자에게 묻기」 칸(data-panel="ask") 문의 글 아래에 있다. 알림으로 오면 그 칸이 열린다(아래 focused target 시험).
  assert.match(html,/<div class="sx-panel" data-panel="ask"[^>]*>[\s\S]*?data-form="feedback"[\s\S]*?data-message-id="project-0"/);assert.match(html,/답변 project-0/);
});

test('older scene and concept reply notifications include the exact target beyond the four recent comments',()=>{
  for(const [type,tab,collection]of [['scene','storyboard','scenes'],['concept','concepts','concepts']]){
    const p=project();p.studio[collection]=[{id:'card',revision:1,title:'확인할 자료',description:'설명',visibility:'customer',duration:3}];
    p.studio.comments=Array.from({length:7},(_,i)=>comment(type+'-'+i,type,'card'));
    const html=render({mode:'customer',project:p,tab,notificationCommentId:type+'-0'});
    assert.match(html,new RegExp('data-message-id="'+type+'-0"'));
    for(let i=3;i<7;i++)assert.match(html,new RegExp('data-message-id="'+type+'-'+i+'"'));
    assert.doesNotMatch(html,new RegExp('data-message-id="'+type+'-1"'));
  }
});

// 시사실 판(2026-11-05)부터 알림 대상이 숨은 칸([data-panel][hidden]) 안에 있으면 그 칸을 먼저 연다. panel을 주면 그 숨은 칸 안의 노드다.
function node(kind,id,panel=null){
  const outer={tagName:'DETAILS',open:false,parentElement:null},inner={tagName:'DETAILS',open:false,parentElement:outer},classes=new Set();
  return {id:kind==='scene'?'scene-'+id:kind==='concept'?'concept-'+id:id,dataset:kind==='message'?{messageId:id}:kind==='request'?{sceneRequestId:id}:{},parentElement:inner,ancestors:[inner,outer],focusCount:0,scrollCount:0,attributes:{},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},matches:selector=>selector==='article',closest:selector=>selector==='[data-panel][hidden]'&&panel?.hidden?panel:null,setAttribute(name,value){this.attributes[name]=value;},focus(){this.focusCount++;},scrollIntoView(){this.scrollCount++;}};
}
function harness(item,{mode='customer',read,request,nodes={},draft=false}={}){
  const s={mode,user:mode==='staff'?{id:'staff'}:null,project:project(),tab:'direction',versionId:'v1',live:{open:true,notifications:[item]}},drafts=new Map(draft?[['customer:customer:p:strategy:',{values:{primaryPromise:'작성 중인 고객 초안'},revision:2}]]:[]),notices=[],loads=[],reads=[],renders=[],dialogs=[],timers=[];
  let handler,pulls=0,resets=0;
  const stage=node('stage','stage'),main={querySelectorAll:selector=>nodes[selector]||[],querySelector:selector=>selector==='[data-stage-content]'?stage:nodes[selector]||null};
  const sandbox={t,k,locale,s,drafts,epoch:1,busy:false,loading:false,composing:false,demo:null,leaveAction:null,main,
    pendingInitialScene:'',liveIdentity:'customer:p',liveSnapshot:null,deviceState:null,deviceOperation:0,deviceRefresh:0,deviceBusy:false,pendingRemote:null,
    notice:value=>notices.push(value),setTimeout:fn=>timers.push(fn),scheduleInviteNavigation(){},
    document:{addEventListener:(_,fn)=>{handler=fn;}},
    live:{read:async ids=>{reads.push(ids);return read?.();},pull:()=>{pulls++;},stop(){}},
    projectStamp:()=>({epoch:sandbox.epoch,id:s.project?.id,user:s.user?.id}),current:stamp=>stamp.epoch===sandbox.epoch&&(!stamp.id||stamp.id===s.project?.id)&&stamp.user===s.user?.id,
    identity:()=>`${s.mode}:${s.user?.id||'customer'}:${s.project?.id||'new'}`,
    request:async path=>{loads.push(path);return request?request(path):{project:project(mode==='staff'?decodeURIComponent(path.split('/')[3]):s.project.id)};},
    accept:result=>{s.project=result.project;},fetchWorkflow:async()=>{},
    render:()=>renders.push({tab:s.tab,project:s.project?.id,versionId:s.versionId,focusId:s.notificationCommentId}),
    openDialog:type=>dialogs.push(type),closeDialog(){},
    cancelInviteNavigation(){},setBusy:value=>{sandbox.busy=value;},recordReset:()=>{resets++;},
    production:{click:async()=>false,reset(){}},
    // 판 3: 의뢰 흐름 손님은 대응표 하나(roomRoute)로 간다. 클릭 원문만 vm에 넣으므로 바깥 함수는 진짜를 넣는다.
    roomCustomer:()=>s.mode==='customer'&&!!s.project&&usesRoom(s.project),roomRoute,roomTab,journalModel,JOURNAL_SHOWN:5,openJournal:options=>{sandbox.journalOpened=options;},window:{scrollTo:()=>{sandbox.scrolledTop=true;}}
  };
  vm.createContext(sandbox);vm.runInContext(resetContextSource+'\nconst originalResetContext=resetContext;resetContext=(...args)=>{recordReset();return originalResetContext(...args);};\n'+loadProjectSource+'\n'+withLeaveSource+'\n'+clickSource,sandbox);
  return {s,sandbox,drafts,notices,loads,reads,renders,dialogs,stage,get pulls(){return pulls;},get resets(){return resets;},click:()=>handler({target:{closest:()=>({dataset:{action:'open-notification',id:item.id}})}}),async confirmLeave(){drafts.clear();await sandbox.leaveAction?.();}};
}

test('classification, replies, corrected scenes, preparation and specifications open their exact focused target',async()=>{
  const cases=[
    {tab:'review',versionId:'v1',messageId:'feedback-item',feedbackRoundId:'round',feedbackItemId:'item',selector:'[data-message-id]',kind:'message',targetId:'feedback-item'},
    {tab:'review',commentId:'project-reply',selector:'[data-message-id]',kind:'message',targetId:'project-reply'},
    {tab:'storyboard',sceneId:'scene',requestId:'scene-request',selector:'[data-scene-request-id]',kind:'request',targetId:'scene-request'},
    {tab:'storyboard',sceneId:'scene',selector:'.scene-card',kind:'scene',targetId:'scene'},
    {tab:'concepts',conceptId:'concept',selector:'.concept-card',kind:'concept',targetId:'concept'},
    {tab:'strategy',target:'kickoff',selector:'.kickoff-card',kind:'kickoff',targetId:'kickoff'},
    {tab:'strategy',target:'deliverables',selector:'.deliverables-panel',kind:'deliverables',targetId:'deliverables'},
    {tab:'review',target:'approval',versionId:'v1',selector:'#review-approval',kind:'approval',targetId:'approval'}
  ];
  for(const item of cases){
    // 프로젝트 답변은 처음에 숨은 「담당자에게 묻기」 칸 안에 있다 — 알림으로 오면 그 칸만 열리고 의견 칸은 닫힌다.
    const panels=item.commentId?[{hidden:false,dataset:{panel:'note'}},{hidden:true,dataset:{panel:'ask'}}]:[];
    const target=node(item.kind,item.targetId,panels[1]||null),f=harness({id:'notice',projectId:'p',...item},{nodes:{'[data-panel]':panels,[item.selector]:item.selector.includes('data-')||item.selector.endsWith('-card')&&item.kind!=='kickoff'?[node(item.kind,'other'),target]:target}});
    await f.click();assert.equal(f.reads.length,1);assert.equal(f.loads.length,1);assert.equal(f.renders.length,1);assert.equal(f.s.tab,item.tab);assert.equal(f.s.live.open,false);
    assert.equal(target.focusCount,1,JSON.stringify(item));assert.equal(target.scrollCount,1);assert.equal(target.attributes.tabindex,'-1');assert.ok(target.ancestors.every(parent=>parent.open));assert.equal(f.stage.scrollCount,0);
    if(item.commentId){assert.equal(f.s.notificationCommentId,item.commentId);assert.equal(f.s.reviewPanel,'ask');assert.deepEqual(panels.map(panel=>panel.hidden),[true,false]);}
    else assert.equal(f.s.reviewPanel,undefined);
  }
});

test('a rejected read refreshes notification state without loading a project, moving tabs, or altering drafts',async()=>{
  const f=harness({id:'old',projectId:'p',tab:'review',commentId:'old-comment'},{draft:true,read:()=>{throw Error('이미 끝난 확인 요청이에요.');}}),before=JSON.stringify([...f.drafts]);
  await f.click();assert.equal(f.pulls,1);assert.equal(f.loads.length,0);assert.equal(f.renders.length,0);assert.equal(f.s.tab,'direction');assert.equal(f.s.live.open,true);assert.equal(JSON.stringify([...f.drafts]),before);assert.match(f.notices[0],/이미 끝난/);
});

test('same-project navigation refreshes content and preserves each local draft with its saved binding',async()=>{
  const f=harness({id:'notice',projectId:'p',tab:'review',versionId:'v1'},{draft:true}),before=JSON.stringify([...f.drafts]);
  f.drafts.set('customer:customer:p:round-draft:item',{boundData:{versionId:'old-preview',itemId:'item'},values:{text:'이전 시안에 쓰던 글'},revision:3});
  const expected=JSON.stringify([...f.drafts]);await f.click();assert.equal(f.loads.length,1);assert.equal(f.s.tab,'review');assert.equal(JSON.stringify([...f.drafts]),expected);assert.ok(before.includes('작성 중인 고객 초안'));assert.equal(f.resets,0);
});

test('cross-project staff navigation waits for the existing draft-discard confirmation',async()=>{
  const f=harness({id:'notice',projectId:'q',tab:'review'},{mode:'staff',draft:true});await f.click();
  assert.deepEqual(f.dialogs,['leave']);assert.equal(f.s.project.id,'p');assert.equal(f.drafts.size,1);assert.equal(f.loads.length,0);
  await f.confirmLeave();assert.equal(f.s.project.id,'q');assert.equal(f.s.tab,'review');assert.equal(f.drafts.size,0);assert.equal(f.resets,1);
});

test('notification navigation does not refresh over an in-flight save or another project load',async()=>{
  for(const flag of ['busy','loading']){const f=harness({id:'notice',projectId:'p',tab:'review'},{draft:true});f.sandbox[flag]=true;await f.click();assert.equal(f.loads.length,0,flag);assert.equal(f.renders.length,0,flag);assert.equal(f.s.tab,'direction');assert.equal(f.drafts.size,1);}
});

test('a notification read finishing after a customer context switch cannot open the old project or move the new tab',async()=>{
  const wait=deferred(),f=harness({id:'notice',projectId:'p',tab:'review',versionId:'old-version'},{read:()=>wait.promise});
  const pending=f.click();await Promise.resolve();f.sandbox.epoch++;f.s.project=project('q');f.s.tab='concepts';f.s.versionId='q-version';
  wait.resolve();await pending;assert.equal(f.loads.length,0);assert.equal(f.renders.length,0);assert.equal(f.s.project.id,'q');assert.equal(f.s.tab,'concepts');assert.equal(f.s.versionId,'q-version');
});

test('reset during an in-flight notification load releases loading and the old result cannot navigate or render',async()=>{
  const wait=deferred(),f=harness({id:'notice',projectId:'p',tab:'review',versionId:'old-version'},{request:()=>wait.promise});
  const pending=f.click();for(let i=0;i<20&&!f.loads.length;i++)await Promise.resolve();assert.equal(f.loads.length,1);assert.equal(f.sandbox.loading,true);
  f.sandbox.resetContext();assert.equal(f.sandbox.loading,false,'reset owns cleanup so a new invitation is not permanently blocked');
  wait.resolve({project:project('p')});await pending;assert.equal(f.s.project,null);assert.equal(f.renders.length,0);assert.equal(f.s.tab,'strategy');assert.equal(f.s.versionId,'');assert.equal(f.sandbox.loading,false);
});

test('the old notification request cannot clear a newer context load flag',async()=>{
  const wait=deferred(),f=harness({id:'notice',projectId:'p',tab:'review'},{request:()=>wait.promise});
  const pending=f.click();for(let i=0;i<20&&!f.loads.length;i++)await Promise.resolve();assert.equal(f.loads.length,1);
  f.sandbox.resetContext();f.s.project=project('q');f.s.tab='concepts';f.sandbox.loading=true;
  wait.resolve({project:project('p')});await pending;
  assert.equal(f.s.project.id,'q');assert.equal(f.s.tab,'concepts');assert.equal(f.sandbox.loading,true);assert.equal(f.renders.length,0);
});

test('a request-flow customer: a reply opens that line in the journal where you are, a final opens the video screen on that final, others the room top (판 3 · 3b)',async()=>{
  const room=id=>{const p=project(id);return {...p,requestFlow:true,versions:[{id:'v1',kind:'preview',label:'시안'},{id:'f1',kind:'final',label:'최종본'}],studio:{...p.studio,request:{status:'confirmed',rounds:[]}}};};
  const reply=node('message','staff-reply'),f=harness({id:'n1',projectId:'p',tab:'review',messageId:'staff-reply'},{request:()=>({project:room('p')}),nodes:{'[data-message-id]':[node('message','other'),reply]}});
  // 판 3b: 화면을 옮기지 않는다 — 옛 탭 이름(direction)은 방으로 접히고, 일지가 그 줄을 연다.
  await f.click();assert.equal(f.s.tab,'overview');assert.equal(f.sandbox.journalOpened?.target,'m:staff-reply');assert.equal(reply.focusCount,0,'the old thread lookup is not used');assert.equal(f.stage.scrollCount,0);
  const delivery=node('delivery','review-delivery'),g=harness({id:'n2',projectId:'p',tab:'history',versionId:'f1'},{request:()=>({project:room('p')}),nodes:{'#review-delivery':delivery}});
  await g.click();assert.equal(g.s.tab,'review');assert.equal(g.s.versionId,'f1');assert.equal(delivery.focusCount,1);
  const top=harness({id:'n3',projectId:'p',tab:'strategy'},{request:()=>({project:room('p')})});
  await top.click();assert.equal(top.s.tab,'overview');assert.equal(top.sandbox.scrolledTop,true,'the room has no stage content to scroll to');assert.equal(top.stage.scrollCount,0);
});
