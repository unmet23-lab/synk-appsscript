import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildCustomerPreviewApproval} from './client-preview-approval.mjs';
import {previewApprovalState} from './public/pulse-app/production-context.mjs';
// 클릭 원문만 vm에 넣으므로 번역 틀의 진짜 함수를 맥락에 넣는다(다국어 판 2).
import {t,k,locale} from './public/pulse-app/i18n.mjs';
import {projectView} from './public/pulse-app/views.mjs';

const rawProject=()=>({id:'approval-project',revision:8,title:'승인 상태 시험',stage:'review',versions:[{id:'v1',kind:'preview',label:'이전 시안'},{id:'v2',kind:'preview',label:'수정본'}],messages:[{id:'request',author:'customer',authorName:'합성 고객',action:'feedback',visibility:'customer',versionId:'v1',resolved:false,text:'수정할 내용'}],studio:{preferences:{},concepts:[],scenes:[],comments:[],feedbackRounds:{drafts:[],rounds:[]}}});
const projected=raw=>({...raw,previewApproval:buildCustomerPreviewApproval(raw),messages:raw.messages.map(({workflow,...message})=>message)});
function render(project){const before=globalThis.location;globalThis.location={origin:'https://pulse.example.test'};try{return projectView({mode:'customer',project,tab:'review',versionId:'v2'});}finally{if(before===undefined)delete globalThis.location;else globalThis.location=before;}}
const approvalButton=html=>html.match(/<button[^>]*data-action="approve"[^>]*>/)?.[0]||'';
// 시사실 판(2026-11-05): 고객 영상 확인은 옛 「다음 결정」 띠 대신 승인 칸(#review-approval)의 안내 한 줄과 단추로 차례를 알리고,
// 다른 탭의 일이 먼저일 때만 왼쪽에 차례 줄(sx-next)을 세운다. 고객 화면만 바뀌었고 직원 화면은 옛 띠 그대로다.
const decide=html=>html.match(/<section class="sx-review-decide" id="review-approval"[^>]*>([\s\S]*?)<\/section>/)?.[1]||'';
const nextLine=html=>html.match(/<p class="sx-next sx-small">([\s\S]*?)<\/p>/)?.[1]||'';

test('an earlier unlinked request disables approval and gives the turn to the team without exposing its workflow',()=>{
  const raw=rawProject();raw.messages[0].workflow={status:'review',resultVersionId:'v2',note:'PRIVATE-WORKFLOW-NOTE',history:[{actor:'PRIVATE-REVIEWER-ID'}]};
  const customer=projected(raw),html=render(customer);
  assert.equal(customer.messages[0].workflow,undefined);assert.equal(previewApprovalState(customer).canApprove,false);
  assert.match(approvalButton(html),/disabled/);assert.ok(decide(html).includes(customer.previewApproval.reason),'the approval block says the team holds the turn');assert.match(decide(html),/제작팀이 보고 있어요/);assert.equal(nextLine(html),'');
  assert.ok(html.includes(customer.previewApproval.reason));assert.doesNotMatch(JSON.stringify(customer),/PRIVATE-WORKFLOW|PRIVATE-REVIEWER/);assert.doesNotMatch(html,/PRIVATE-WORKFLOW|PRIVATE-REVIEWER/);
});

test('an active strategy request takes priority, while an already confirmed strategy leaves the blocked preview with the team',()=>{
  const raw=rawProject();raw.studio.strategy={revision:1,data:{primaryPromise:'메시지',evidence1:'근거',desiredAction:'행동'},request:{strategyRevision:1},confirmation:null};
  const asked=render(projected(raw));assert.match(nextLine(asked),/내 차례/);assert.match(nextLine(asked),/제작 설계 확인을 부탁드려요/);assert.match(nextLine(asked),/data-tab="strategy"/);
  raw.studio.strategy.confirmation={strategyRevision:1};
  const held=render(projected(raw));assert.equal(nextLine(held),'');assert.match(decide(held),/제작팀이 보고 있어요/);assert.match(approvalButton(held),/disabled/);
});

test('the exact latest reviewed correction enables customer approval despite unresolved public feedback',()=>{
  const raw=rawProject();raw.messages[0].workflow={status:'waiting_customer',resultVersionId:'v2'};
  const customer=projected(raw),html=render(customer);
  assert.equal(customer.messages[0].resolved,false);assert.equal(customer.messages[0].workflow,undefined);
  assert.equal(previewApprovalState(customer).canApprove,true);assert.ok(approvalButton(html));assert.doesNotMatch(approvalButton(html),/disabled/);
  assert.match(decide(html),/이 시안으로 최종본을 만들까요\?/);assert.doesNotMatch(decide(html),/제작팀/);assert.equal(nextLine(html),'');
});

test('a correction linked to an older preview stays blocked and stale projected decisions cannot authorize a new preview',()=>{
  const raw=rawProject();raw.messages[0].workflow={status:'waiting_customer',resultVersionId:'v1'};
  const customer=projected(raw);assert.equal(previewApprovalState(customer).canApprove,false);assert.match(approvalButton(render(customer)),/disabled/);
  customer.previewApproval={...customer.previewApproval,versionId:'v1',status:'ready',canApprove:true,waitingFor:'customer'};
  assert.equal(previewApprovalState(customer).canApprove,false);assert.match(approvalButton(render(customer)),/disabled/);
});

test('an unsent current draft disables approval while keeping the next action with the customer',()=>{
  const raw=rawProject();raw.messages=[];raw.studio.feedbackRounds.drafts=[{id:'draft',versionId:'v2',current:true,items:[{id:'item',text:'보내기 전 의견'}]}];
  const customer=projected(raw),html=render(customer);
  assert.equal(customer.previewApproval.status,'draft_pending');assert.equal(approvalButton(html),'','the card offers sending the collected notes instead of a blocked approval');
  assert.match(decide(html),/data-action="open-round-submit"[^>]*><span>의견 1개 보내기<\/span>/);assert.match(decide(html),/보내기 전까지는 저희에게 보이지 않아요/);assert.equal(nextLine(html),'');
});

function clickHarness(project){
  const appSource=readFileSync(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8'),start=appSource.indexOf("document.addEventListener('click',async event=>{"),code=appSource.slice(start,appSource.indexOf('\n});',start)+4);
  let handler,closed=0;const notices=[],dialogs=[],requests=[];
  const sandbox={t,k,locale,s:{mode:'customer',project,versionId:'v2'},busy:false,loading:false,demo:null,previewApprovalState,production:{click:async()=>false},latestPreview:()=>project.versions.filter(v=>v.kind==='preview').at(-1),notice:value=>notices.push(value),closeDialog:()=>closed++,openDialog:(...value)=>dialogs.push(value),hasDraft:()=>false,options:()=>({}),request:async(path,input)=>{requests.push({path,input});return {};},mutate:async operation=>operation(),document:{addEventListener:(_,fn)=>{handler=fn;},querySelector:()=>null}};
  vm.createContext(sandbox);vm.runInContext(code,sandbox);
  return {notices,dialogs,requests,get closed(){return closed;},click:action=>handler({target:{closest:()=>({dataset:{action,id:'v2',revision:String(project.revision)}})}})};
}

test('stale enabled buttons and open dialogs recheck server approval state before opening or sending',async()=>{
  const customer=projected(rawProject()),f=clickHarness(customer);
  await f.click('approve');assert.equal(f.dialogs.length,0);assert.equal(f.requests.length,0);assert.equal(f.notices.at(-1),customer.previewApproval.reason);
  await f.click('approve-confirm');assert.equal(f.closed,1);assert.equal(f.requests.length,0);assert.equal(f.notices.at(-1),customer.previewApproval.reason);
});

test('a ready approval still opens explicit confirmation and sends the selected revision only on confirmation',async()=>{
  const raw=rawProject();raw.messages[0].workflow={status:'waiting_customer',resultVersionId:'v2'};
  const f=clickHarness(projected(raw));await f.click('approve');assert.equal(f.dialogs[0][0],'approve');assert.equal(f.requests.length,0);
  await f.click('approve-confirm');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/pulse/api/action');
  assert.equal(f.requests[0].input.body.action,'approve');assert.equal(f.requests[0].input.body.versionId,'v2');assert.equal(f.requests[0].input.body.revision,8);
});
