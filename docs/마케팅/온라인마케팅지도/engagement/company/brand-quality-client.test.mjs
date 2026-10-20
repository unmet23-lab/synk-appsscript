import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// 브랜드 제작실 · 품질·운영 확인(brand-quality.js) — 시그널 13판 A 「목록 + 상세」 간소판의 화면 계약.
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const checks=[['mobile','모바일 화면'],['links','링크와 이동'],['playback','영상·소리 재생'],['intake','문의·접수'],['errors','오류와 복구'],['feedback','고객 의견']].map(([id,title])=>({id,title,hint:title+' 안내'}));
const sources=[{id:'synk-paper-felt',title:'SYNK · 흰 펠트 로고',category:'logo'},{id:'suit-variable',title:'SUIT Variable',category:'font'}];
function fixture({role='admin'}={}){
  const handlers=new Map(),requests=[],notifications=[];let renders=0,confirmed=true;
  const context=vm.createContext({Intl,console,structuredClone,URL,FormData:class{getAll(){return [];}get(){return '';}has(){return false;}},
    state:{user:{id:'A',role},tab:'workroom'},wr:{view:'tools'},makerTools:{view:'brand'},confirm:()=>confirmed,navigator:{clipboard:{writeText:async()=>{}}},
    window:{addEventListener(){}},document:{addEventListener(type,handler){handlers.set(type,handler);},querySelector(){return {textContent:'',matches(){return false;}};}},
    api(path,body){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return promise;},render(){renders++;},notify:message=>notifications.push(message),makerToolsEnsure(){},escape,
  });
  // 그리기 도우미(mt*)는 maker-tools.js 앞 절반 — 탭 파일보다 먼저 읽는다.
  const kit=readFileSync(new URL('./public/maker-tools.js',import.meta.url),'utf8');vm.runInContext(kit.slice(0,kit.indexOf('\n// ── 상태와 화면 바꾸기')),context,{filename:'maker-tools.js'});
  vm.runInContext(readFileSync(new URL('./public/brand-quality.js',import.meta.url),'utf8'),context,{filename:'brand-quality.js'});
  const evaluate=code=>vm.runInContext(code,context);
  return {context,evaluate,handlers,requests,notifications,get renders(){return renders;},set confirmed(value){confirmed=value;}};
}
const workspace=(extra={})=>({recipes:[],operations:[],sources,checks,canWrite:true,canShareCompany:true,canShareTeam:true,notice:'서버가 주는 안내 한 줄',...extra});
const recipe=(extra={})=>({id:'recipe-1',ownerId:'A',title:'yuhobuilds 쇼츠 표지',purpose:'첫 화면과 표지',format:'YouTube Shorts · 1080×1920',sourceIds:['synk-paper-felt'],exampleUrl:'https://youtube.com/shorts/R3zPsNM6a2c',visibility:'team',status:'draft',revision:1,updatedAt:'2026-10-18T07:40:00Z',versions:[{id:'v1',label:'v1',body:'검정 면 · 흰 글자',url:'',createdAt:'2026-10-18T07:40:00Z'}],ownerName:'검증 관리자',canEdit:true,canApprove:true,...extra});
const operation=(extra={})=>({id:'op-1',ownerId:'A',title:'workspace.synk.im 로그인',targetUrl:'https://workspace.synk.im/',visibility:'team',nextDue:'',nextAction:'',archived:false,revision:1,updatedAt:'2026-10-13T06:20:00Z',
  checks:Object.fromEntries(checks.map(item=>[item.id,item.id==='mobile'?{status:'pass',evidence:'로그인 단추가 첫 화면 안',environment:'390×844',checkedAt:'2026-10-13T06:20:00Z'}:{status:'unverified',evidence:'',environment:'',checkedAt:null}])),history:[],ownerName:'검증 관리자',canEdit:true,counts:{pass:1,issue:0,unverified:5,notApplicable:0},...extra});
const blackPills=html=>(html.match(/class="btn[^"]*\bprimary\b/g)||[]).length;
const press=dataset=>({target:{closest:()=>({dataset,disabled:false})}});
async function loaded(f,data){f.evaluate('brandQualityEnsure()');const request=f.requests.at(-1);assert.equal(request.path,'/api/brand-quality');request.resolve(data);await new Promise(resolve=>setImmediate(resolve));}

test('empty brand and quality desks show one line and one black pill, and the head button hides while they are empty',async()=>{
  const f=fixture();await loaded(f,workspace());
  for(const [kind,line,label] of [['brand','승인 자료를 골라 첫 양식을 만들어요','새 제작 양식'],['quality','확인할 서비스를 먼저 등록해요','새 운영 확인']]){
    const html=f.evaluate(`brandQualityPanel('${kind}')`);assert.match(html,new RegExp(line));assert.equal(blackPills(html),1);assert.equal((html.match(/data-bq-action="new"/g)||[]).length,1);assert.match(html,new RegExp(label));
    assert.doesNotMatch(html,/\sstyle=|0개 기록|다음 제작에도 이어지는 기준|공개한 다음까지 확인하기|습니다|합니다/);
  }
  assert.match(f.evaluate("brandQualityPanel('quality')"),/서버가 주는 안내 한 줄/);assert.equal(f.evaluate("brandQualityNavCount('brand')").value,0);
});
test('the first row opens automatically, approvers get the approval poster and everyone else a quiet card',async()=>{
  const f=fixture();await loaded(f,workspace({recipes:[recipe()],operations:[operation()]}));
  assert.equal(f.evaluate('bq.drafts.brand.id'),'recipe-1');assert.equal(f.evaluate('bq.drafts.quality.id'),'op-1');
  let html=f.evaluate("brandQualityPanel('brand')");assert.match(html,/mt-now is-poster/);assert.match(html,/data-bq-action="approve"/);assert.equal(blackPills(html),1);assert.match(html,/<button class="btn primary" type="submit"[^>]*>양식 저장</);assert.match(html,/class="btn" data-bq-action="new"/);assert.match(html,/data-bq-action="sources"/);
  html=f.evaluate("brandQualityPanel('quality')");assert.match(html,/6개 중 5개를 아직 안 봤어요/);assert.match(html,/data-bq-action="focus-item" data-kind="quality" data-state="unverified"/);assert.match(html,/aria-label="확인됨 1 · 미확인 5 · 문제 0"/);assert.equal((html.match(/class="bq-leds"[\s\S]*?<\/span><\/span>/)?.[0].match(/class="mt-led"/g)||[]).length,6);assert.equal(blackPills(html),1);
  assert.deepEqual(JSON.parse(f.evaluate("JSON.stringify([brandQualityNavCount('brand'),brandQualityNavCount('quality')])")),[{value:1,tone:'',label:'승인할 양식'},{value:1,tone:'',label:'확인할 서비스'}]);
  const member=fixture({role:'member'});await loaded(member,workspace({recipes:[recipe({canApprove:false})]}));html=member.evaluate("brandQualityPanel('brand')");
  assert.doesNotMatch(html,/data-bq-action="approve"|mt-now is-poster/);assert.match(html,/팀장이나 관리자가 승인하면/);assert.doesNotMatch(html,/<option value="approved"/);
});
test('approval saves the open recipe with the approved status and its revision, and a refused confirmation sends nothing',async()=>{
  const f=fixture();await loaded(f,workspace({recipes:[recipe()]}));f.confirmed=false;await f.handlers.get('click')(press({bqAction:'approve',kind:'brand'}));assert.equal(f.requests.length,1);
  f.confirmed=true;const approving=f.handlers.get('click')(press({bqAction:'approve',kind:'brand'}));const request=f.requests[1];assert.equal(request.path,'/api/brand-quality/recipes/recipe-1');assert.equal(request.body.status,'approved');assert.equal(request.body.revision,1);assert.ok(!Object.hasOwn(request.body,'version'));
  request.resolve({recipe:recipe({status:'approved',revision:2,approvedAt:'2026-10-20T12:00:00Z',approvedByName:'검증 관리자'})});await approving;
  assert.equal(f.evaluate('bq.drafts.brand.status'),'approved');assert.equal(f.evaluate('bq.dirty.brand'),false);assert.deepEqual(f.notifications,['제작 양식을 저장했어요.']);assert.match(f.evaluate("brandQualityPanel('brand')"),/승인한 양식이에요/);
});
test('a late response after an account switch never fills the new account, and filters and the phone list keep their own state',async()=>{
  const f=fixture();f.evaluate('brandQualityEnsure()');const stale=f.requests[0];f.context.state.user={id:'B',role:'member'};f.evaluate('brandQualityEnsure()');stale.resolve(workspace({recipes:[recipe()]}));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.evaluate('bq.data'),null);assert.equal(f.evaluate("brandQualityNavCount('brand')"),null);assert.equal(f.requests.length,2);
  f.requests[1].resolve(workspace({recipes:[recipe(),recipe({id:'recipe-old',title:'보관한 표지 양식',status:'archived'})]}));await new Promise(resolve=>setImmediate(resolve));
  let html=f.evaluate("brandQualityPanel('brand')");assert.doesNotMatch(html,/보관한 표지 양식/);assert.match(html,/data-filter="all" aria-pressed="false">보관 포함 <b>2<\/b>/);
  await f.handlers.get('click')(press({bqAction:'filter',kind:'brand',filter:'all'}));html=f.evaluate("brandQualityPanel('brand')");assert.match(html,/보관한 표지 양식/);
  await f.handlers.get('click')(press({bqAction:'pick'}));assert.match(f.evaluate("brandQualityPanel('brand')"),/class="mt-desk is-picking"/);
  await f.handlers.get('click')(press({bqAction:'open',kind:'brand',id:'recipe-old'}));assert.equal(f.evaluate('bq.drafts.brand.id'),'recipe-old');assert.equal(f.evaluate('bq.picking'),false);assert.match(f.evaluate("brandQualityPanel('brand')"),/보관한 양식이에요/);
});
// 아르곤 검수 뒤: 승인 실패 · 보관 기록의 검은 알약 · 조사 틀 · 다시 읽기 유지 · 보관 저장 · 주소 바꿈 · 새로 쓰는 중 찾기 · 그 자리 갱신.
test('approval failure leaves the recipe under review, archived recipes keep one black pill and the copy line uses no particle template',async()=>{
  const f=fixture();await loaded(f,workspace({recipes:[recipe(),recipe({id:'recipe-done',title:'승인한 표지',status:'approved',versions:[{id:'v2',label:'v2',body:'본문',url:'',createdAt:'2026-10-19T00:00:00Z'}]}),recipe({id:'recipe-old',title:'보관한 표지',status:'archived'})]}));
  const approving=f.handlers.get('click')(press({bqAction:'approve',kind:'brand'}));assert.equal(f.requests[1].body.status,'approved');assert.equal(f.evaluate('bq.drafts.brand.status'),'draft');f.requests[1].reject(new Error('양식 상태를 다시 골라 주세요.'));await approving;
  assert.equal(f.evaluate('bq.drafts.brand.status'),'draft');let html=f.evaluate("brandQualityPanel('brand')");assert.match(html,/data-bq-action="approve"/);assert.match(html,/양식 상태를 다시 골라 주세요/);
  await f.handlers.get('click')(press({bqAction:'open',kind:'brand',id:'recipe-done'}));html=f.evaluate("brandQualityPanel('brand')");assert.match(html,/최신 버전\(v2\)을 복사해서 바로 써요/);
  await f.handlers.get('click')(press({bqAction:'filter',kind:'brand',filter:'all'}));await f.handlers.get('click')(press({bqAction:'open',kind:'brand',id:'recipe-old'}));html=f.evaluate("brandQualityPanel('brand')");
  assert.equal(blackPills(html),1);assert.match(html,/class="btn" data-bq-action="new"/);assert.match(html,/type="submit"/);
});
test('reload keeps the open record on success and its state on failure, and saving an archived record turns on 보관 포함',async()=>{
  const f=fixture();await loaded(f,workspace({recipes:[recipe(),recipe({id:'recipe-2',title:'둘째 양식'})]}));await f.handlers.get('click')(press({bqAction:'open',kind:'brand',id:'recipe-2'}));
  let reloading=f.handlers.get('click')(press({bqAction:'reload'}));f.requests[1].reject(new Error('잠시 뒤 다시 읽어 주세요.'));await reloading;
  assert.equal(f.evaluate('bq.drafts.brand.id'),'recipe-2');assert.match(f.evaluate("brandQualityPanel('brand')"),/잠시 뒤 다시 읽어 주세요/);
  reloading=f.handlers.get('click')(press({bqAction:'reload'}));f.requests[2].resolve(workspace({recipes:[recipe(),recipe({id:'recipe-2',title:'둘째 양식 새 이름',revision:2})]}));await reloading;
  assert.equal(f.evaluate('bq.drafts.brand.id'),'recipe-2');assert.equal(f.evaluate('bq.drafts.brand.title'),'둘째 양식 새 이름');assert.equal(f.evaluate('bq.error'),'');
  f.evaluate("bq.drafts.brand.status='archived'");const saving=f.evaluate("bqSave('brand')");f.requests[3].resolve({recipe:recipe({id:'recipe-2',title:'둘째 양식 새 이름',status:'archived',revision:3})});await saving;
  assert.equal(f.evaluate('bq.archived.brand'),true);assert.match(f.evaluate("brandQualityPanel('brand')"),/data-id="recipe-2"[^>]*aria-current="true"/);
});
test('changing the address keeps only the items checked again, and a fresh draft hides the empty search line',async()=>{
  const f=fixture();await loaded(f,workspace({operations:[operation()]}));f.evaluate("bq.drafts.quality.targetUrl='https://synk.im/';bq.drafts.quality.checks.mobile.rechecked=true;bq.drafts.quality.checks.links={status:'pass',evidence:'예전 주소에서 봄',environment:'390×844'}");
  const saving=f.evaluate("bqSave('quality')");const body=f.requests[1].body;assert.equal(body.checks.mobile.status,'pass');assert.equal(body.checks.links.status,'unverified');assert.equal(body.checks.links.evidence,'');f.requests[1].resolve({operation:operation({targetUrl:'https://synk.im/'})});await saving;
  await f.handlers.get('click')(press({bqAction:'new',kind:'quality'}));f.evaluate("bq.query.quality='없는 이름'");const html=f.evaluate("brandQualityPanel('quality')");assert.match(html,/data-bq-none="quality" hidden/);assert.match(html,/저장 전/);
});
test('item changes update the summary, the facts and the now card in place without redrawing',async()=>{
  const f=fixture();await loaded(f,workspace({operations:[operation()]}));const nodes=new Map();f.context.fakeForm={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{outerHTML:'',innerHTML:'',textContent:''});return nodes.get(selector);}};
  const renders=f.renders;f.evaluate("bq.drafts.quality.checks.links.status='issue';bqLive(fakeForm,'quality')");assert.equal(f.renders,renders);
  assert.match(nodes.get('[data-bq-item="links"]>summary').innerHTML,/문제 있음/);assert.match(nodes.get('[data-bq-now="quality"]').outerHTML,/문제 1개를 고친 뒤 다시 확인해요/);assert.match(nodes.get('[data-bq-facts]').outerHTML,/<dt>문제<\/dt><dd>1/);assert.equal(nodes.get('[data-bq-fold="quality:checks"] .mt-sum').textContent,'확인됨 1 · 미확인 4 · 문제 1');
});
