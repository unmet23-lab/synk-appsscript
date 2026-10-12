import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {projectView} from './public/pulse-app/views.mjs';

const source=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
const navigation=source.slice(source.indexOf('function readStaffHistoryTarget('),source.indexOf("async function start(invite='')"));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const projectId=id(1),sceneId=id(2),commentId=id(10),reviewId=id(20);
const href=kind=>'?mode=staff&project='+projectId+'&tab=history&'+kind+'='+(kind==='comment'?commentId:reviewId);
function project(){return {id:projectId,title:'합성 프로젝트',customerName:'가상 고객',stage:'producing',revision:7,messages:[],versions:[],studio:{preferences:{},assets:[],references:[],concepts:[],scenes:[{id:sceneId,title:'합성 장면',description:'장면 설명',visibility:'customer',duration:3,revision:1}],comments:Array.from({length:5},(_,i)=>({id:id(10+i),targetType:'scene',targetId:sceneId,visibility:'customer',text:i?'다른 댓글 '+i:'오래된 댓글의 검색 일치 본문',at:'2026-10-12T00:00:00Z'})),sceneReviews:Array.from({length:4},(_,i)=>({id:id(20+i),sceneId,sceneRevision:1,status:'comment',text:i?'다른 의견 '+i:'오래된 검토의 검색 일치 본문',at:'2026-10-12T00:00:00Z'}))}};}
function fixture(kind='comment'){
  const p=project(),notices=[],actions=[],nodes=new Map();
  for(const type of ['comment','review'])for(const row of p.studio[type==='comment'?'comments':'sceneReviews'])nodes.set('#pulse-history-'+type+'-'+row.id,{classList:{add:value=>actions.push(['class',value])},focus:options=>actions.push(['focus',options]),scrollIntoView:options=>actions.push(['scroll',options])});
  const context=vm.createContext({URLSearchParams,Array,Set,console,notices,actions,nodes,p,link:href(kind),notice:message=>notices.push(message),main:{querySelector:key=>nodes.get(key)},s:{mode:'staff',user:{id:'synthetic-user'},workspace:{projects:[{id:projectId}]},project:p,tab:'history'},loadProject:async()=>{}});
  vm.runInContext(`let epoch=0,initialStaffProject=${JSON.stringify(projectId)},initialStaffTab='history',initialStaffScene='',pendingInitialScene='',initialStaffHistory=null;${navigation};initialStaffHistory=readStaffHistoryTarget(link);`,context);
  return {context,p,notices,actions,nodes,run:code=>vm.runInContext(code,context)};
}

test('history links accept exactly one valid comment or review UUID in the staff history scope',()=>{
  const f=fixture();
  for(const kind of ['comment','review']){f.context.input=href(kind);assert.equal(f.run('readStaffHistoryTarget(input).kind'),kind);assert.equal(f.run('readStaffHistoryTarget(input).projectId'),projectId);}
  for(const bad of [href('comment')+'&review='+reviewId,href('comment')+'&comment='+commentId,href('comment')+'&query=private-text',href('comment').replace('mode=staff','mode=customer'),href('comment').replace('tab=history','tab=storyboard'),href('comment').replace(commentId,'not-a-uuid'),href('comment').replace(projectId,'other'),href('comment')+'&scene='+sceneId]){f.context.input=bad;assert.equal(f.run('readStaffHistoryTarget(input)'),null);}
});

test('history renders stable anchors and the full old comment/review that a scene card omits',()=>{
  const p=project(),before=JSON.stringify(p),s={project:p,mode:'staff',canEdit:true,tab:'storyboard'};
  const scene=projectView(s);assert.ok(!scene.includes('오래된 댓글의 검색 일치 본문'));assert.ok(!scene.includes('오래된 검토의 검색 일치 본문'));
  const history=projectView({...s,tab:'history'});
  assert.ok(history.includes(`id="pulse-history-comment-${commentId}" tabindex="-1"`));assert.ok(history.includes(`id="pulse-history-review-${reviewId}" tabindex="-1"`));
  assert.ok(history.includes('오래된 댓글의 검색 일치 본문'));assert.ok(history.includes('오래된 검토의 검색 일치 본문'));assert.equal(JSON.stringify(p),before);
});

test('initial staff navigation opens and focuses the exact authorized record once without changing project or drafts',async()=>{
  for(const kind of ['comment','review']){
    const f=fixture(kind),before=JSON.stringify(f.p);f.run("const drafts=new Map([['unchanged',{text:'작성 중인 합성 글'}]])");
    await f.run('openInitialStaffProject()');assert.equal(f.run('s.historyTarget.kind'),kind);
    f.run('focusInitialStaffHistory()');assert.equal(f.actions.length,3);assert.equal(f.actions[1][0],'focus');assert.equal(f.actions[1][1].preventScroll,true);assert.equal(f.actions[2][1].behavior,'auto');
    f.run('focusInitialStaffHistory()');assert.equal(f.actions.length,3);assert.equal(f.run("drafts.get('unchanged').text"),'작성 중인 합성 글');assert.equal(JSON.stringify(f.p),before);
  }
});

test('a missing project or missing projected record never produces an exact source target',async()=>{
  const absent=fixture();absent.run('s.workspace.projects=[]');let calls=0;absent.context.loadProject=async()=>{calls++;};await absent.run('openInitialStaffProject()');assert.equal(calls,0);assert.equal(absent.run('s.historyTarget'),undefined);assert.equal(absent.notices.length,1);
  const revoked=fixture();revoked.context.loadProject=async()=>{revoked.context.s.project.studio.comments=[];};await revoked.run('openInitialStaffProject()');revoked.run('focusInitialStaffHistory()');assert.equal(revoked.actions.length,0);assert.equal(revoked.notices.length,1);
});

test('customer mode, changed project and removed records cannot focus a stale staff target',()=>{
  for(const change of ["s.mode='customer'","s.project={...s.project,id:'different'}","s.project.studio.comments=[]","s.tab='storyboard'"]){const f=fixture();f.run('s.historyTarget=initialStaffHistory;'+change+';focusInitialStaffHistory()');assert.equal(f.actions.length,0);assert.equal(f.run('s.historyTarget'),null);}
});

test('an identity change while the project is loading cannot install an old search target',async()=>{
  const f=fixture();let finish;f.context.loadProject=()=>new Promise(resolve=>{finish=resolve;});const pending=f.run('openInitialStaffProject()');f.run("epoch++;s.user={id:'other-user'}");finish();await pending;assert.equal(f.run('s.historyTarget'),undefined);assert.equal(f.actions.length,0);
});
