import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('./public/website-inquiries.js',import.meta.url),'utf8');
const healthSource=await readFile(new URL('./public/automation-health.js',import.meta.url),'utf8');
function fixture(){
  const listeners={};
  const context=vm.createContext({
    state:{user:{id:'admin',role:'admin'},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'inquiries'},
    document:{addEventListener(name,callback){listeners[name]=callback;}},
    location:{search:''},URLSearchParams,Date,FormData,
    escape:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    api:async()=>({}),render(){},notify(){},confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},
  });
  vm.runInContext(source+'\nglobalThis.testExports={state:websiteInquiryState,panel:websiteInquiriesPanel,load:wiLoad,reset:websiteInquiriesReset,select:wiSelect,ensure:websiteInquiriesEnsure};',context);
  const api=context.testExports;api.state.identity='admin:admin';
  return {context,api,listeners};
}
const data=()=>({draftOnly:true,settings:{enabled:false,revision:0},connection:{configured:false,formId:'form-id'},run:{status:'not-connected',lastSuccessAt:null},items:[]});
test('inquiry UI distinguishes missing connection from zero inquiries and offers no external send action',()=>{
  const f=fixture();f.api.state.data=data();const html=f.api.panel();
  assert.match(html,/연결 전에는 접수된 문의가 없다고 판단하지/);assert.match(html,/첫 수집 결과를 기다리고/);
  assert.doesNotMatch(html,/고객에게 보내기|data-wi-action="send"|mailto:/);
});
test('contact text and draft render as escaped text and unsafe task URLs never become links',()=>{
  const f=fixture(),view=data();view.items=[{id:'i1',email:'<img src=x onerror=alert(1)>',type:'<script>',message:'<script>alert(1)</script>',createdAt:'2026-10-20T00:00:00Z',revision:1,status:'new',
    classification:{label:'<img>',reason:'<script>',nextAction:'확인',isTest:false},replyDraft:'</textarea><script>alert(1)</script>',task:{href:'javascript:alert(1)'}}];
  f.api.state.data=view;f.api.select('i1');const html=f.api.panel();
  assert.doesNotMatch(html,/<script>|<img src=x|javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/고객에게 발송되지 않습니다/);
});
test('identity changes discard an old pending response and erase cached customer data on reset',async()=>{
  const f=fixture();let resolve;f.context.api=()=>new Promise(done=>{resolve=done;});
  const pending=f.api.load();f.context.state.user={id:'other',role:'admin'};resolve(data());await pending;
  assert.equal(f.api.state.data,null);
  f.api.state.data={items:[{email:'private@example.test'}]};f.api.reset();assert.equal(f.api.state.data,null);assert.equal(f.api.state.draft,null);
});
test('non-admin panel contains no cached inquiry data',()=>{
  const f=fixture();f.context.state.user.role='member';f.api.state.identity='admin:member';
  f.api.state.data={...data(),items:[{email:'private@example.test'}]};assert.doesNotMatch(f.api.panel(),/private@example/);assert.match(f.api.panel(),/회사 관리자만/);
});
test('automation view uses an independent metadata-only inquiry section and preserves existing card contracts',()=>{
  const f=fixture();f.context.location.origin='https://workspace.example.test';f.context.URL=URL;
  vm.runInContext(healthSource+'\nglobalThis.healthTest={section:ahWebsiteInquiry,href:ahHref,cardCount:ahCardIds.length};',f.context);
  const {section,href,cardCount}=f.context.healthTest;
  assert.equal(cardCount,17);
  for(const status of ['not-connected','paused','failed','ready','running','catching-up']){
    const html=section({enabled:status!=='paused',configured:status!=='not-connected',status,lastSuccessAt:'2026-10-20T01:00:00Z',nextCheckAt:'2026-10-20T02:00:00Z',email:'PRIVATE@example.test',error:'PRIVATE customer diagnostic'});
    assert.match(html,/문의 접수함 열기/);assert.doesNotMatch(html,/PRIVATE|data-ah-card=/);assert.match(html,/최근 전체 수집 완료/);
  }
  assert.equal(href('/?tab=workroom&section=tools&tool=inquiries'),'/?tab=workroom&section=tools&tool=inquiries');
  const stopped=section({enabled:true,configured:true,status:'ready',schedulerEnabled:false,nextCheckAt:'2026-10-20T02:00:00Z'});
  assert.match(stopped,/서버 자동 수집 꺼짐|예약 꺼짐/);assert.doesNotMatch(stopped,/5분마다 문의를 읽어/);
  assert.match(section(null),/상태 확인 불가/);
  f.context.state.user.role='member';assert.equal(section({enabled:true,configured:true,status:'ready'}),'');
});

test('enabled collection settings never imply execution when the server scheduler is stopped',()=>{
  const f=fixture();f.api.state.data={...data(),settings:{enabled:true,revision:1},connection:{configured:true,formId:'form-id'},run:{status:'ready'},schedulerEnabled:false};
  const html=f.api.panel();assert.match(html,/서버 자동 수집 꺼짐/);assert.match(html,/주기적으로 실행되지 않습니다/);assert.match(html,/지금 수집 확인/);
});
