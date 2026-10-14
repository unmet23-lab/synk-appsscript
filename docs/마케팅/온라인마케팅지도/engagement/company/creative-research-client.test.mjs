import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateResearchReport} from './creative-research.mjs';

const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture({view='references'}={}){
  const requests=[],handlers=new Map(),notifications=[],navigation=[],modals=[],timers=new Map();let renders=0,closes=0,invalidations=0,timerId=0;
  const context=vm.createContext({
    console,URL,Set,JSON,Promise,Intl,Date,structuredClone,TextEncoder,AbortController,
    state:{user:{id:'A',role:'member',name:'직원'},tab:'workroom',data:{channels:[]},modalRequest:0},
    wr:{view:'trends',series:'story'},wrRegions:{KR:'한국',US:'미국',CN:'중국'},wrDailyToday:()=> '2026-10-02',wrTrendTime:value=>value,
    document:{visibilityState:'visible',addEventListener(type,handler){handlers.set(type,handler);}},window:{scrollTo(){}},
    setTimeout(handler,delay){const id=++timerId;timers.set(id,{handler,delay});return id;},clearTimeout(id){timers.delete(id);},
    FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key]??null;}has(key){return Object.hasOwn(this.values,key);}},
    api(path,body,method,options={}){let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,method,options,resolve,reject});if(options.signal)options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('consumer aborted'),{name:'AbortError'})),{once:true});return pending;},
    render(){renders++;},notify:message=>notifications.push(message),escape,
    button:(label,action,id='',classes='',attrs='')=>`<button data-action="${action}" ${attrs}>${escape(label)}</button>`,
    wrTrendLink:(label,url)=>{let safe='#';try{const parsed=new URL(url);if(['https:','http:'].includes(parsed.protocol))safe=parsed.href;}catch{}return `<a href="${escape(safe)}">${escape(label)}</a>`;},
    isViewer:()=>context.state.user?.role==='viewer',channelName:row=>row.displayName,
    canEditChannel:row=>context.state.user?.role!=='viewer'&&(row.ownerIds?.includes(context.state.user?.id)||row.canEdit===true),
    modal(title,description,html){context.state.modalRequest++;modals.push({title,description,html});},
    closeModal(){closes++;context.state.modalRequest++;},
    cp:{data:{},error:'',input:{topic:'기존 기획'},draftId:'draft',activeDraft:{id:'draft'},pendingDraftId:'pending',ideaId:'idea',results:{old:true}},
    cpBlank:()=>({seriesId:'default'}),cpInvalidateGeneration(){invalidations++;},
    async loadContentWorkspace(){},async cpNavigate(view){navigation.push(view);}
  });
  vm.runInContext(readFileSync(new URL('./public/creative-research.js',import.meta.url),'utf8'),context,{filename:'creative-research.js'});
  const evaluate=code=>vm.runInContext(code,context),cr=evaluate('cr');evaluate('crIdentity()');cr.view=view;
  return {context,requests,handlers,notifications,navigation,modals,timers,evaluate,cr,get renders(){return renders;},get closes(){return closes;},get invalidations(){return invalidations;}};
}
const row=(overrides={})=>({id:'one',source:'tiktok-top-ads',kind:'ad',title:'실제 관찰 예시',creator:'예시 브랜드',sourceUrl:'https://ads.tiktok.com/business/creativecenter/topads/123456789/pc/en',region:'US',actualRegions:['US'],checkedAt:'2026-10-02T00:00:00+09:00',metrics:{likes:null,comments:null,shares:null},visibility:'private',ownerName:'직원',canEdit:true,canArchive:true,...overrides});
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{for(let index=0;index<4;index++)await Promise.resolve();};
function form(values={},dataset={}){
  const submit={disabled:false,isConnected:true},errorBox={textContent:''};
  return {values,dataset:{crForm:'manual',source:'instagram',id:'',...dataset},isConnected:true,submit,errorBox,
    querySelector(selector){return selector==='[type="submit"]'?submit:errorBox;},matches:()=>false};
}

test('unknown reactions stay unmeasured while a confirmed zero and CTR relative position remain distinct',()=>{
  const f=fixture();f.context.entry=row();assert.match(f.evaluate('crMetrics(entry)'),/반응 수치 미확인/);
  f.context.entry=row({metrics:{likes:0,comments:null,shares:1200},ctrTopPercent:4.5});
  const html=f.evaluate('crMetrics(entry)');assert.match(html,/좋아요<\/small><strong>0/);assert.match(html,/공유<\/small><strong>1,200/);assert.ok(!html.includes('댓글'));
  assert.match(html,/CTR 상대 위치/);assert.match(html,/Top 4.5%/);
  f.cr.data={entries:[f.context.entry]};f.evaluate('crDetail("one")');assert.match(f.modals.at(-1).html,/실제 클릭률이 아닙니다/);
});

test('untrusted saved text is escaped in cards and details and unsafe original links cannot execute',()=>{
  const f=fixture();f.context.entry=row({title:'<img src=x onerror=boom>',creator:'<script>boom</script>',adaptation:'</p><svg onload=boom>',ownerName:'" onclick="boom',sourceUrl:'javascript:boom'});
  const html=f.evaluate('crCard(entry)');assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.match(html,/&lt;svg/);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));
  f.cr.data={entries:[f.context.entry]};f.evaluate('crDetail("one")');const detail=f.modals.at(-1).html;assert.ok(!detail.includes('href="javascript:'));assert.match(detail,/href="#"/);assert.match(detail,/&lt;svg/);
  assert.match(f.modals.at(-1).title,/&lt;img/);assert.ok(!f.modals.at(-1).title.includes('<img'),'the common modal inserts its title as HTML');
});

test('platform, search and actual ad country intersect without treating the exploration filter as the ad country',()=>{
  const f=fixture();f.cr.data={entries:[
    row({id:'us',title:'미국 사례',filterRegion:'KR',actualRegions:['US'],structure:'질문 뒤 반전'}),
    row({id:'kr',title:'한국 사례',actualRegions:['KR'],structure:'질문 뒤 반전'}),
    row({id:'ig',source:'instagram',kind:'reel',title:'인스타 사례',region:'KR',actualRegions:[],structure:'질문 뒤 반전'})
  ]};f.cr.source='tiktok-top-ads';f.cr.region='KR';f.cr.query='반전';
  const html=f.evaluate('crPanel()');assert.ok(html.includes('<h3>한국 사례</h3>'));assert.ok(!html.includes('<h3>미국 사례</h3>'));assert.ok(!html.includes('<h3>인스타 사례</h3>'));
  f.cr.query='없는 검색어';assert.match(f.evaluate('crPanel()'),/선택한 조건의 자료가 없어요/);
});

test('a newer read wins and a late read cannot restore private data after logout and the same user signs in',async()=>{
  const f=fixture(),first=f.evaluate('crLoad()'),second=f.evaluate('crLoad()');f.requests[1].resolve({entries:[row({title:'새 자료'})]});await second;
  f.requests[0].resolve({entries:[row({title:'오래된 자료'})]});await first;assert.equal(f.cr.data.entries[0].title,'새 자료');
  const late=f.evaluate('crLoad()');f.context.state.user=null;f.evaluate('crReset()');f.context.state.user={id:'A',role:'member'};f.evaluate('crIdentity()');const renders=f.renders;
  f.requests[2].resolve({entries:[row({title:'이전 세션의 비공개 자료'})]});await late;assert.equal(f.cr.data,null);assert.equal(f.renders,renders);
});

test('viewer UI and write entry points remain read only even if row edit flags are permissive',async()=>{
  const f=fixture();f.context.state.user.role='viewer';f.cr.data={entries:[row()]};const panel=f.evaluate('crPanel()');assert.ok(!panel.includes('data-action="creative-add"'));assert.ok(!panel.includes('data-action="creative-plan"'));
  f.evaluate('crDetail("one")');const detail=f.modals.at(-1).html;assert.ok(!detail.includes('data-action="creative-edit"'));assert.ok(!detail.includes('data-action="creative-archive"'));
  f.evaluate('crForm("tiktok-top-ads")');assert.equal(f.modals.length,1);
  await f.evaluate('crPlan("one")');await f.evaluate('crArchive("one")');await f.evaluate('crRestore("one")');assert.equal(f.requests.length,0);assert.equal(f.navigation.length,0);
});

test('an observed source prepares a fresh plan with honest evidence and never generates or saves it',async()=>{
  const f=fixture();f.cr.data={entries:[row({metrics:{likes:0,shares:15},ctrTopPercent:12,filterRegion:'KR',periodDays:7,hook:'첫 장면에서 결과 공개',structure:'결과 → 방법',adaptation:'학습 사례에 적용'})]};
  await f.evaluate('crPlan("one")');assert.equal(f.context.cp.input.topic,'실제 관찰 예시');assert.match(f.context.cp.input.proof,/좋아요 0/);assert.match(f.context.cp.input.proof,/공유 15/);assert.ok(!f.context.cp.input.proof.includes('댓글 0'));
  assert.match(f.context.cp.input.proof,/CTR Top 12% \(상대 위치, 실제 클릭률 아님\)/);assert.match(f.context.cp.input.proof,/첫 장면에서 결과 공개/);assert.match(f.context.cp.input.proof,/전체 인기 순위나 예상 성과가 아닙니다/);
  assert.match(f.context.cp.input.proof,/관찰 대상 미국/);assert.match(f.context.cp.input.proof,/탐색 필터 한국 \(실제 광고 지역과 별도\)/);assert.match(f.context.cp.input.proof,/화면의 집계 기간 최근 7일/);
  assert.equal(f.context.cp.draftId,'');assert.equal(f.context.cp.activeDraft,null);assert.equal(f.context.cp.pendingDraftId,'');assert.equal(f.context.cp.ideaId,'');assert.equal(f.context.cp.results,null);assert.equal(f.invalidations,1);assert.deepEqual(f.navigation,['plan']);assert.equal(f.requests.length,0);
});

test('leaving trends or changing its filter while a plan workspace loads prevents replacing another plan',async()=>{
  for(const transition of ['leave','filter']){
    const f=fixture();f.cr.data={entries:[row()]};let done;f.context.loadContentWorkspace=()=>new Promise(resolve=>{done=resolve;});const pending=f.evaluate('crPlan("one")');
    if(transition==='leave')f.context.wr.view='desk';else await f.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:{action:'creative-source',id:'instagram'}})}});
    done();await pending;assert.equal(f.context.cp.input.topic,'기존 기획');assert.equal(f.invalidations,0);assert.equal(f.navigation.length,0);
  }
});

test('a background reread during plan loading permits unchanged data and rejects changed, unreadable or released guide data',async()=>{
  for(const transition of ['unchanged','changed','unreadable','released']){
    const f=fixture(),chosen=guideRow({usage:{status:'in-use',canClaim:true,canRelease:true,isMine:true}});f.cr.data={entries:[chosen]};let done;f.context.loadContentWorkspace=()=>new Promise(resolve=>{done=resolve;});
    const pending=f.evaluate('crPlan("one",0,true)'),reread=f.evaluate('crLoad({background:true})');
    const next=transition==='changed'?{...chosen,title:'새로 조사한 원본'}:transition==='released'?{...chosen,usage:{status:'available',canClaim:true,canRelease:false,isMine:false}}:chosen;f.requests[0].resolve({entries:transition==='unreadable'?[]:[next]});await reread;done();await pending;
    if(transition==='unchanged'){assert.deepEqual(f.navigation,['plan']);assert.match(f.context.cp.input.proof,/준비된 제작 양식/);}else{assert.equal(f.navigation.length,0);assert.equal(f.context.cp.input.topic,'기존 기획');}
  }
});

test('manual form payload preserves unknown numbers, explicit zero, KST date and chosen sharing scope',()=>{
  const f=fixture();f.context.form=form({kind:'reel',title:'관찰',sourceUrl:'https://www.instagram.com/reel/example/',region:'GLOBAL',checkedAt:'2026-10-02',likes:'0',shares:'',visibility:'company'});
  const payload=plain(f.evaluate('crFormPayload(form)'));assert.equal(payload.metrics.likes,0);assert.equal(payload.metrics.shares,null);assert.equal(payload.metrics.views,null);assert.equal(payload.ctrTopPercent,null);assert.equal(payload.checkedAt,'2026-10-02T00:00:00+09:00');assert.equal(payload.visibility,'company');assert.equal(payload.shareConfirmed,true);
  f.context.form.values.visibility='private';assert.equal(f.evaluate('crFormPayload(form).shareConfirmed'),false);
  f.context.form.values.kind='ad';assert.deepEqual(plain(f.evaluate('crFormPayload(form).metrics')),{views:null,likes:null,comments:null,shares:null,saves:null,reach:null},'an ad-library observation cannot inherit performance from a previous reel form');
});

test('a duplicate submit is blocked and a late save cannot close a different modal or announce success after logout',async()=>{
  const f=fixture();f.context.form=form({kind:'reel',title:'관찰',sourceUrl:'https://www.instagram.com/reel/example/',region:'KR',checkedAt:'2026-10-02',visibility:'private'});
  const pending=f.evaluate('crSave(form)');await f.evaluate('crSave(form)');assert.equal(f.requests.length,1);assert.equal(f.context.form.submit.disabled,true);
  f.evaluate('modal("다른 작업", "", "")');f.requests[0].resolve({entry:row()});await flush();assert.equal(f.closes,0);assert.equal(f.requests.length,2);
  f.context.state.user=null;f.evaluate('crReset()');f.requests[1].resolve({entries:[row()]});await pending;assert.equal(f.cr.data,null);assert.equal(f.notifications.length,0);assert.equal(f.context.form.submit.disabled,false);
});

test('a late restore keeps a replacement modal open while refreshing the restored list',async()=>{
  const f=fixture();f.cr.data={entries:[row({archived:true})]};const pending=f.evaluate('crRestore("one")');f.evaluate('modal("새로 연 기획", "", "")');
  f.requests[0].resolve({entry:row()});await flush();if(f.requests[1])f.requests[1].resolve({entries:[row()]});await pending;
  assert.equal(f.closes,0);assert.equal(f.modals.at(-1).title,'새로 연 기획');assert.equal(f.cr.data.entries[0].archived,undefined);
});

test('archived sources stay out of the active feed but remain discoverable and restorable',async()=>{
  const f=fixture(),pending=f.evaluate('crLoad()');assert.equal(f.requests[0].path,'/api/creative-research?includeArchived=1');
  f.requests[0].resolve({entries:[row({id:'active',title:'활성 자료'}),row({id:'archived',title:'보관 자료',archived:true})]});await pending;
  let html=f.evaluate('crPanel()');assert.ok(html.includes('<h3>활성 자료</h3>'));assert.ok(!html.includes('<h3>보관 자료</h3>'));
  f.handlers.get('change')({target:{checked:true,matches:selector=>selector==='[data-cr-archived]'}});html=f.evaluate('crPanel()');
  assert.ok(!html.includes('<h3>활성 자료</h3>'));assert.ok(html.includes('<h3>보관 자료</h3>'));assert.ok(html.includes('data-action="creative-restore"'));assert.ok(!html.includes('data-action="creative-plan"'));
  await f.evaluate('crPlan("archived")');assert.equal(f.navigation.length,0);
});

test('editing an imported observation preserves its actual country even outside the three reference markets',()=>{
  const f=fixture();f.context.entry=row({region:'SE',actualRegions:['SE']});f.evaluate('crForm("tiktok-top-ads",entry,true)');
  assert.match(f.modals.at(-1).html,/<option value="SE" selected>/,'the selected country must not silently fall back to GLOBAL on edit');
});

test('editing notes preserves the exact observation instant when its KST date has not changed',()=>{
  const f=fixture();f.cr.data={entries:[row({source:'instagram',kind:'reel',checkedAt:'2026-10-01T20:05:12.345Z'})]};
  f.context.form=form({kind:'reel',title:'관찰',sourceUrl:'https://www.instagram.com/reel/example/',region:'US',checkedAt:'2026-10-02',visibility:'private',adaptation:'설명만 수정'},{id:'one'});
  assert.equal(f.evaluate('crFormPayload(form).checkedAt'),'2026-10-01T20:05:12.345Z');
  f.context.entry=f.cr.data.entries[0];const manual=f.evaluate('crObservationTime(entry)');assert.match(manual,/2026.*10.*2/);assert.ok(!manual.includes('20:05'),'a date-only observation must not display an invented time');
  f.context.entry.provenance='official-page';assert.equal(f.evaluate('crObservationTime(entry)'),f.evaluate('crTime(entry.checkedAt)'));
  f.context.form.values.checkedAt='2026-10-01';assert.equal(f.evaluate('crFormPayload(form).checkedAt'),'2026-10-01T00:00:00+09:00');
});

test('a TikTok observation can select its owned TikTok channel without offering archived or unrelated channels',()=>{
  const f=fixture();f.cr.data={channels:[
    {id:'owned',platform:'tiktok',displayName:'내 TikTok',ownerIds:['A'],active:true},
    {id:'archived',platform:'tiktok',displayName:'보관 TikTok',ownerIds:['A'],active:false},
    {id:'other',platform:'tiktok',displayName:'다른 직원 TikTok',ownerIds:['B'],active:true},
    {id:'youtube',platform:'youtube',displayName:'내 YouTube',ownerIds:['A'],active:true}
  ]};f.context.entry=row({channelId:'owned'});f.evaluate('crForm("tiktok-top-ads",entry,true)');const html=f.modals.at(-1).html;
  assert.match(html,/<option value="owned" selected>내 TikTok<\/option>/);assert.ok(!html.includes('보관 TikTok'));assert.ok(!html.includes('다른 직원 TikTok'));assert.ok(!html.includes('내 YouTube'));
});

test('team sharing is offered only when the current or existing shared team is still active and accessible',()=>{
  const f=fixture();f.cr.data={teams:[]};assert.ok(!f.evaluate('crVisibility()').includes('value="team"'));
  f.context.state.user.teamId='retired';assert.ok(!f.evaluate('crVisibility()').includes('value="team"'),'a stale user team ID must not offer a save action that the server rejects');
  f.context.state.user.teamId='active';f.cr.data.teams=[{id:'active',name:'현재 팀'}];assert.ok(f.evaluate('crVisibility()').includes('value="team"'));
  f.context.state.user.teamId=null;f.context.entry=row({teamId:'shared',visibility:'team'});f.cr.data.teams=[{id:'shared',name:'기존 공유 팀'}];assert.match(f.evaluate('crVisibility(entry)'),/<option value="team" selected>/);
  f.cr.data.teams=[];assert.ok(!f.evaluate('crVisibility(entry)').includes('value="team"'));
});

test('switching Meta material kinds changes the account requirement and hides unrelated performance fields',()=>{
  const f=fixture(),counts={hidden:false},channel={required:false},url={placeholder:''},fakeForm={dataset:{source:'instagram'},querySelector:selector=>({'[data-cr-observed-metrics]':counts,'[data-cr-channel]':channel,'[data-cr-url]':url}[selector])};
  const target={value:'insight',closest:()=>fakeForm,matches:selector=>selector==='[data-cr-kind]'};f.handlers.get('change')({target});assert.equal(channel.required,true);assert.equal(counts.hidden,false);assert.match(url.placeholder,/professional_dashboard/);
  target.value='ad';f.handlers.get('change')({target});assert.equal(channel.required,false);assert.equal(counts.hidden,true);assert.match(url.placeholder,/facebook.com\/ads\/library/);
  f.context.entry=row({source:'instagram',kind:'ad'});assert.match(f.evaluate('crMetrics(entry)'),/광고 게재 사례 · 성과 수치 미제공/);
  f.context.entry.kind='best-practice';assert.match(f.evaluate('crMetrics(entry)'),/공식 제작 안내/);
});

const report=(overrides={})=>({schemaVersion:1,reportId:'daily-2026-10-02',date:'2026-10-02',provider:'gemini-spark',entries:[{source:'instagram',kind:'reel',title:'조사 사례',sourceUrl:'https://www.instagram.com/reel/example/',checkedAt:'2026-10-02T00:00:00+09:00'}],...overrides});

test('report importing defaults to private and ignores sharing instructions inside the JSON',()=>{
  const f=fixture();f.evaluate('crImportForm()');const html=f.modals.at(-1).html;
  assert.match(html,/data-cr-report-file/);assert.match(html,/data-cr-report-json/);assert.match(html,/<option value="private" selected>/);assert.match(html,/모든 직원에게 공개/);
  f.context.form=form({report:JSON.stringify(report({visibility:'company',shareConfirmed:true})),visibility:'private'});
  let payload=plain(f.evaluate('crReportPayload(form)'));assert.equal(payload.visibility,'private');assert.equal(payload.shareConfirmed,false);
  f.context.form.values.visibility='company';payload=plain(f.evaluate('crReportPayload(form)'));assert.equal(payload.visibility,'company');assert.equal(payload.shareConfirmed,true);assert.equal(payload.entries[0].checkedAt,'2026-10-02T00:00:00+09:00');
});

test('manual report importing uploads producer run times unchanged and still uses the selected sharing scope',async()=>{
  const times={asOfAt:'2026-10-01T15:00:00.000Z',researchStartedAt:'2026-10-01T15:00:00.000Z',researchCompletedAt:'2026-10-01T15:10:00.000Z'};
  for(const visibility of ['private','company']){
    const f=fixture(),input=report({...times,visibility:'company',shareConfirmed:true});f.context.form=form({report:JSON.stringify(input),visibility});
    const pending=f.evaluate('crSaveReport(form)');assert.equal(f.requests.length,1);const request=f.requests[0];assert.equal(request.path,'/api/creative-research/import-report');
    assert.deepEqual(Object.fromEntries(Object.keys(times).map(key=>[key,request.body[key]])),times);assert.equal(request.body.visibility,visibility);assert.equal(request.body.shareConfirmed,visibility==='company');
    const validated=validateResearchReport(plain(request.body),{at:times.researchCompletedAt});assert.deepEqual(Object.fromEntries(Object.keys(times).map(key=>[key,validated[key]])),times);
    assert.equal(f.context.form.errorBox.textContent,'');assert.equal(f.closes,0);request.resolve({report:{createdCount:1,...times},existing:false});await flush();assert.equal(f.requests[1].path,'/api/creative-research?includeArchived=1');f.requests[1].resolve({entries:[row()],automation:{lastReport:{date:input.date,provider:input.provider,createdCount:1,...times},reportCount:1}});await pending;
    assert.equal(f.closes,1);assert.equal(f.context.form.submit.disabled,false);assert.deepEqual(f.notifications,['조사 보고서를 저장했어요. 신규 1건 · 갱신 0건']);
  }
});

test('invalid JSON and unsupported report shape stay inline and never start an upload',async()=>{
  for(const input of ['{broken','[]',JSON.stringify(report({schemaVersion:2})),JSON.stringify(report({entries:Array.from({length:31},()=>({}))})),JSON.stringify(report({script:'untrusted'}))]){
    const f=fixture();f.context.form=form({report:input,visibility:'company'});await f.evaluate('crSaveReport(form)');
    assert.equal(f.requests.length,0);assert.ok(f.context.form.errorBox.textContent);assert.equal(f.context.form.submit.disabled,false);assert.equal(f.notifications.length,0);
  }
});

test('a confirmed report upload refreshes the list and reports the server counts only once',async()=>{
  const f=fixture();f.context.form=form({report:JSON.stringify(report()),visibility:'company'});
  const pending=f.evaluate('crSaveReport(form)');await f.evaluate('crSaveReport(form)');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/creative-research/import-report');assert.equal(f.requests[0].body.shareConfirmed,true);
  assert.equal(f.closes,0);assert.equal(f.notifications.length,0);f.requests[0].resolve({report:{createdCount:2,updatedCount:3,retainedCount:1},existing:false});await flush();
  assert.equal(f.closes,1);assert.equal(f.requests[1].path,'/api/creative-research?includeArchived=1');f.requests[1].resolve({entries:[row()],automation:{lastReport:{date:'2026-10-02',provider:'gemini-spark',createdCount:2,updatedCount:3,retainedCount:1,itemCount:6},reportCount:1}});await pending;
  assert.deepEqual(f.notifications,['조사 보고서를 저장했어요. 신규 2건 · 갱신 3건']);assert.match(f.evaluate('crPanel()'),/신규 2건 · 갱신 3건 · 기존 유지 1건/);assert.equal(f.context.form.submit.disabled,false);
});

test('report failures preserve the import form and a late upload cannot cross an account change',async()=>{
  const failure=fixture();failure.context.form=form({report:JSON.stringify(report()),visibility:'company'});const failed=failure.evaluate('crSaveReport(form)');failure.requests[0].reject(new Error('원문 주소를 확인해 주세요.'));await failed;
  assert.equal(failure.closes,0);assert.equal(failure.requests.length,1);assert.equal(failure.context.form.errorBox.textContent,'원문 주소를 확인해 주세요.');
  const f=fixture();f.context.form=form({report:JSON.stringify(report()),visibility:'company'});const pending=f.evaluate('crSaveReport(form)');f.context.state.user=null;f.evaluate('crReset()');f.context.state.user={id:'A',role:'member'};f.evaluate('crIdentity()');f.requests[0].resolve({report:{createdCount:1}});await pending;
  assert.equal(f.requests.length,1);assert.equal(f.closes,0);assert.equal(f.notifications.length,0);assert.equal(f.cr.data,null);
});

test('report provenance and imported metadata remain distinct from official and manual observations',()=>{
  const f=fixture();f.cr.data={entries:[],automation:{lastReport:null,reportCount:0}};let html=f.evaluate('crPanel()');assert.match(html,/아직 가져온 일일 조사 보고서가 없어요/);assert.ok(!html.includes('매일 자동'));
  f.context.entry=row({provenance:'research-report',provenanceDetails:{provider:'gemini-spark',reportDate:'2026-10-02'}});f.cr.data.entries=[f.context.entry];html=f.evaluate('crCard(entry)');assert.match(html,/Gemini 예약 조사/);assert.ok(!html.includes('공식 상세 가져오기'));assert.ok(!html.includes('직접 확인 기록'));
  f.evaluate('crDetail("one")');assert.match(f.modals.at(-1).html,/Gemini 예약 조사/);assert.match(f.modals.at(-1).html,/조사 날짜/);
  f.context.entry.provenanceDetails.provider='codex';assert.match(f.evaluate('crCard(entry)'),/일일 조사/);
  f.cr.data.automation={lastReport:{date:'<script>boom</script>',provider:'gemini-spark',createdCount:0,updatedCount:0,retainedCount:0,itemCount:0},reportCount:1};html=f.evaluate('crAutomationSummary()');assert.match(html,/&lt;script/);assert.ok(!html.includes('<script>'));assert.match(html,/확인할 새 자료 없음/);
});

test('reference storage deferrals and daily guide deferrals remain distinct in the visible import result',()=>{
  const f=fixture();f.cr.data={entries:[],automation:{lastReport:{date:'2026-10-02',provider:'gemini-spark',createdCount:3,updatedCount:0,retainedCount:0,itemCount:6,deferredCount:3,deferredGuideCount:2,deferredObservationCount:1},reportCount:1}};
  let html=f.evaluate('crAutomationSummary()');assert.match(html,/신규 3건/);assert.match(html,/양식 보류 2건/);assert.match(html,/참고 자료 보류 1건/);assert.match(html,/제작 양식 반영은 계속됩니다/);assert.ok(!html.includes('양식 보류 3건'));
  delete f.cr.data.automation.lastReport.deferredGuideCount;delete f.cr.data.automation.lastReport.deferredObservationCount;html=f.evaluate('crAutomationSummary()');assert.match(html,/양식 보류 3건/);assert.ok(!html.includes('참고 자료 보류'));assert.ok(!html.includes('저장 한도로'));
});

test('viewer accounts cannot open or submit the report import even with forged controls',async()=>{
  const f=fixture();f.context.state.user.role='viewer';assert.ok(!f.evaluate('crPanel()').includes('creative-import-report'));f.evaluate('crImportForm()');assert.equal(f.modals.length,0);
  f.context.form=form({report:JSON.stringify(report()),visibility:'company'});await f.evaluate('crSaveReport(form)');assert.equal(f.requests.length,0);
});

test('reading a report file rejects oversized files and discards late content after modal or account changes',async()=>{
  for(const transition of ['modal','account']){
    const f=fixture(),json={value:'기존 내용'},status={textContent:''},errorBox={textContent:''};let resolveFile;
    const file={name:'daily.json',size:10,text:()=>new Promise(resolve=>{resolveFile=resolve;})},fileForm={isConnected:true,querySelector:selector=>({'.form-error':errorBox,'[data-cr-report-json]':json,'[data-cr-report-file-status]':status}[selector])};
    f.context.input={files:[file],closest:()=>fileForm};const pending=f.evaluate('crReadReportFile(input)');
    if(transition==='modal')f.evaluate('modal("다른 작업", "", "")');else{f.context.state.user=null;f.evaluate('crReset()');f.context.state.user={id:'A',role:'member'};f.evaluate('crIdentity()');}
    resolveFile(JSON.stringify(report()));await pending;assert.equal(json.value,'기존 내용');assert.equal(status.textContent,'');assert.equal(f.requests.length,0);
  }
  const f=fixture(),errorBox={textContent:''};f.context.input={files:[{name:'daily.json',size:1048577,text:()=>{throw new Error('must not read');}}],closest:()=>({isConnected:true,querySelector:()=>errorBox})};await f.evaluate('crReadReportFile(input)');assert.match(errorBox.textContent,/1MB/);
});

test('public YouTube videos can be saved without a channel while Studio observations still require one',()=>{
  const f=fixture();f.cr.data={channels:[]};f.context.entry=row({source:'youtube-trends',kind:'recent-video',channelId:null});f.evaluate('crForm("youtube-trends",entry,true)');let html=f.modals.at(-1).html;
  assert.ok(!html.includes('data-cr-channel required'));assert.match(html,/담당 채널 없이 저장/);assert.ok(!html.includes('class="btn primary" disabled'));
  f.context.entry.kind='top-search';f.evaluate('crForm("youtube-trends",entry,true)');html=f.modals.at(-1).html;assert.match(html,/data-cr-channel required/);assert.match(html,/class="btn primary" disabled/);
  const channel={required:true},submit={disabled:true},note={textContent:''},missing={hidden:false},fakeForm={dataset:{source:'youtube-trends'},querySelector:selector=>({'[data-cr-channel]':channel,'[type="submit"]':submit,'[data-cr-channel-note]':note,'[data-cr-channel-missing]':missing}[selector])};
  const target={value:'breakout-video',closest:()=>fakeForm,matches:selector=>selector==='[data-cr-kind]'};f.handlers.get('change')({target});assert.equal(channel.required,false);assert.equal(submit.disabled,false);assert.equal(missing.hidden,true);
  target.value='content-gap';f.handlers.get('change')({target});assert.equal(channel.required,true);assert.equal(submit.disabled,true);assert.equal(missing.hidden,false);
  fakeForm.dataset.crSaving='1';target.value='recent-video';f.handlers.get('change')({target});assert.equal(submit.disabled,true,'changing kind during an upload cannot unlock a duplicate submit');
});

test('public video URLs clear Studio interest while Studio URLs preserve the channel and interest contract',()=>{
  const f=fixture();f.context.entry=row({source:'youtube-trends',kind:'recent-video',sourceUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',interest:'high'});f.evaluate('crForm("youtube-trends",entry,true)');assert.match(f.modals.at(-1).html,/data-cr-interest-field hidden/);
  f.context.form=form({kind:'recent-video',sourceUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',interest:'high',visibility:'private'},{source:'youtube-trends'});assert.equal(f.evaluate('crFormPayload(form).interest'),'unknown');
  const studio='https://studio.youtube.com/channel/UCabcdefghijklmnopqrstuv/analytics/tab-trends';f.context.form.values.sourceUrl=studio;assert.equal(f.evaluate('crFormPayload(form).interest'),'high');
  f.context.entry.sourceUrl=studio;f.evaluate('crForm("youtube-trends",entry,true)');assert.match(f.modals.at(-1).html,/data-cr-channel required/);assert.ok(!f.modals.at(-1).html.includes('data-cr-interest-field hidden'));
  const channel={required:true},interest={value:'high'},interestField={hidden:false},url={value:studio},kind={value:'recent-video'},fakeForm={dataset:{source:'youtube-trends'},querySelector:selector=>({'[data-cr-channel]':channel,'[data-cr-url]':url,'[data-cr-kind]':kind,'[data-cr-interest]':interest,'[data-cr-interest-field]':interestField}[selector])};
  const target={closest:()=>fakeForm,matches:selector=>selector==='[data-cr-url]'};url.value='https://www.youtube.com/watch?v=dQw4w9WgXcQ';f.handlers.get('input')({target});assert.equal(channel.required,false);assert.equal(interestField.hidden,true);assert.equal(interest.value,'unknown');
  url.value=studio;f.handlers.get('input')({target});assert.equal(channel.required,true);assert.equal(interestField.hidden,false);
});

const research=(overrides={})=>({summary:'듣고 행동하는 짧은 사례의 구조를 검토합니다.',whyNow:'최근 공개 자료에 같은 질문이 반복돼 확인할 시점입니다.',viewerReason:'시청자는 말을 들은 뒤 바로 답을 확인할 수 있습니다.',brands:['LAB'],priority:'high',evidenceLevel:'page-read',limitations:'공개 원문을 읽었으며 실제 영상 재생과 학습 효과는 확인하지 않았습니다.',publishedAt:null,observedFacts:[{text:'공개 설명에 학습자가 듣고 선택하는 활동이 있습니다.',sourceUrl:'https://www.instagram.com/reel/example/'}],applications:[{brand:'LAB',idea:'소리를 듣고 행동하는 초급 한국어 도전',zeroSecondHook:'이 말을 들으면 어느 행동이 맞을까요?',action:'들리는 지시에 맞는 행동 하나를 고릅니다.',reward:'바로 정답과 자연스러운 표현을 확인합니다.',personalizationTool:'내 장소와 수준을 고르면 듣기 상황이 달라지는 도구',validation72h:'게시 72시간 뒤 시청 지속과 저장·댓글을 계정의 기존 자료와 비교합니다.'}],...overrides});

test('research cards and details separate observed records from proposals and keep the older analysis timestamp visible',()=>{
  const f=fixture();f.context.entry=row({source:'instagram',kind:'reel',checkedAt:'2026-10-09T09:00:00.000Z',researchCheckedAt:'2026-10-08T09:00:00.000Z',research:research(),provenance:'research-report',provenanceDetails:{provider:'gemini-spark'}});f.cr.data={entries:[f.context.entry]};
  const card=f.evaluate('crCard(entry)');assert.match(card,/검토 브랜드 · LAB/);assert.match(card,/먼저 검토 · 추정/);assert.match(card,/볼 이유/);assert.match(card,/왜 지금/);assert.ok(card.includes('조사 내용 확인 · '+f.evaluate('crTime(entry.researchCheckedAt)')));assert.ok(card.includes('자료·수치 확인 '+f.evaluate('crTime(entry.checkedAt)')));assert.match(card,/>원문<\/a>/);
  f.evaluate('crDetail("one")');const html=f.modals.at(-1).html;assert.match(html,/조사 기록의 관찰과 확인 범위/);assert.match(html,/원문 페이지 확인/);assert.match(html,/아직 실행과 효과를 검증하지 않은 제안/);assert.match(html,/0초 훅/);assert.match(html,/시청자가 할 행동/);assert.match(html,/바로 받는 보상/);assert.match(html,/맞춤 도구/);assert.match(html,/72시간 검증/);assert.match(html,/data-application="0"/);assert.ok(html.includes(f.evaluate('crTime(entry.researchCheckedAt)')));
});

test('all research text is escaped and unsafe evidence links cannot execute',()=>{
  const f=fixture();f.context.entry=row({research:research({summary:'<img src=x onerror=boom>',whyNow:'</p><script>boom</script>',viewerReason:'<svg onload=boom>',brands:['<img src=x>'],observedFacts:[{text:'<script>boom</script>',sourceUrl:'javascript:boom'}],limitations:'<iframe src=boom>',applications:[{brand:'<svg>',idea:'<img src=x onerror=boom>',zeroSecondHook:'<script>',action:'<svg>',reward:'<img>',personalizationTool:'<iframe>',validation72h:'<script>'}]})});
  const card=f.evaluate('crCard(entry)'),detail=f.evaluate('crResearchDetail(entry)');for(const html of [card,detail]){assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<svg>'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/&lt;/);}
  f.cr.data={entries:[f.context.entry]};assert.ok(!f.evaluate('crPanel()').includes('<option value="<img'));
});

test('brand and review priority filters intersect with platform, country and searches in the deep report',()=>{
  const f=fixture();f.cr.data={entries:[
    row({id:'lab',source:'instagram',kind:'reel',title:'LAB 일치',region:'KR',actualRegions:[],research:research({brands:['LAB'],priority:'high',observedFacts:[{text:'검증에 필요한 특별한 질문'}]})}),
    row({id:'brief',source:'instagram',kind:'reel',title:'다른 브랜드',region:'KR',actualRegions:[],research:research({brands:['synkbrief'],priority:'high'})}),
    row({id:'watch',source:'instagram',kind:'reel',title:'지켜볼 자료',region:'KR',actualRegions:[],research:research({brands:['LAB'],priority:'watch'})}),
    row({id:'us',source:'instagram',kind:'reel',title:'다른 국가',region:'US',actualRegions:[],research:research()})
  ]};f.cr.source='instagram';f.cr.region='KR';f.cr.brand='LAB';f.cr.priority='high';f.cr.query='특별한 질문';let html=f.evaluate('crPanel()');assert.match(html,/<h3>LAB 일치<\/h3>/);for(const title of ['다른 브랜드','지켜볼 자료','다른 국가'])assert.ok(!html.includes('<h3>'+title+'</h3>'));
  assert.match(html,/data-cr-brand/);assert.match(html,/검토 우선순위 · 추정/);f.cr.priority='watch';f.cr.query='';html=f.evaluate('crPanel()');assert.match(html,/<h3>지켜볼 자료<\/h3>/);assert.ok(!html.includes('<h3>LAB 일치</h3>'));
  f.cr.data.entries=[];html=f.evaluate('crPanel()');assert.equal(f.cr.brand,'LAB');assert.equal(f.cr.priority,'watch');assert.equal(f.cr.region,'KR');assert.match(html,/<option value="LAB" selected>/);assert.match(html,/<option value="watch" selected>/);assert.match(html,/<option value="KR" selected>/);
});

test('a chosen application prepares a bounded usable plan and keeps proposals and observation limits explicit',async()=>{
  const f=fixture(),first=research().applications[0],second={...first,brand:'synkbrief',idea:'두 번째 적용안을 내 조건으로 바꾸기',reward:'내 조건에 맞는 결과',validation72h:'게시 뒤 72시간 동안 실제 저장 수를 비교합니다.'};f.cr.data={entries:[row({adaptation:'직원의 긴 메모'.repeat(600),researchCheckedAt:'2026-10-01T00:00:00.000Z',research:research({applications:[first,second],observedFacts:Array.from({length:8},()=>({text:'조사 기록의 긴 사실 '.repeat(60)}))})})]};
  f.context.cp.data={catalog:{series:[{id:'synkbrief-use',name:'synkbrief 활용'},{id:'lab-expression',name:'LAB 표현 소개'}]}};
  await f.evaluate('crPlan("one",1)');const input=f.context.cp.input;assert.equal(input.seriesId,'synkbrief-use');assert.equal(input.topic,second.idea);assert.equal(input.takeaway,second.reward);assert.equal(input.entertainment,research().viewerReason);assert.ok(input.proof.length<=3000);assert.match(input.proof,/실행 전 적용 제안 · synkbrief/);assert.match(input.proof,/0초 훅 제안/);assert.match(input.proof,/72시간 검증 계획/);assert.ok(input.proof.includes('조사 내용 확인: '+f.evaluate('crTime(cr.data.entries[0].researchCheckedAt)')));assert.equal(input.authenticity.limits,research().limitations);assert.match(input.authenticity.disclosure,/실행과 효과는 아직 검증하지 않았습니다/);assert.equal(f.requests.length,0);assert.deepEqual(f.navigation,['plan']);
});

test('changing the deep report filters while a plan loads cannot overwrite a different plan',async()=>{
  for(const selector of ['[data-cr-brand]','[data-cr-priority]']){
    const f=fixture();f.cr.data={entries:[row({research:research()})]};let done;f.context.loadContentWorkspace=()=>new Promise(resolve=>{done=resolve;});const pending=f.evaluate('crPlan("one")');f.handlers.get('change')({target:{value:selector==='[data-cr-brand]'?'LAB':'high',matches:key=>key===selector}});done();await pending;
    assert.equal(f.context.cp.input.topic,'기존 기획');assert.equal(f.navigation.length,0);assert.equal(f.invalidations,0);
  }
});

test('the client enforces the complete UTF-8 byte budget before uploading a long Korean report',async()=>{
  const f=fixture(),long='한'.repeat(600),item={brand:'LAB',idea:'한'.repeat(800),zeroSecondHook:'한'.repeat(300),action:long,reward:long,personalizationTool:'한'.repeat(800),validation72h:'한'.repeat(800)};
  const detail=research({summary:long,whyNow:'한'.repeat(1200),viewerReason:long,limitations:'한'.repeat(1500),observedFacts:Array.from({length:8},()=>({text:'한'.repeat(1000),sourceUrl:'https://www.instagram.com/reel/example/'})),applications:[item,item,item]});
  const input=report({entries:Array.from({length:20},(_,index)=>({...report().entries[0],sourceUrl:`https://www.instagram.com/reel/example_${index}/`,research:detail}))});assert.ok(new TextEncoder().encode(JSON.stringify(input)).byteLength>1048576);
  f.context.form=form({report:JSON.stringify(input),visibility:'company'});await f.evaluate('crSaveReport(form)');assert.equal(f.requests.length,0);assert.match(f.context.form.errorBox.textContent,/1MB 이하/);assert.equal(f.context.form.submit.disabled,false);
});

const sync=(overrides={})=>({enabled:true,status:'waiting',documentId:'test-doc',documentUrl:'https://docs.google.com/document/d/test-doc/edit',lastCheckedAt:'2026-10-09T01:00:00.000Z',lastImportedAt:null,lastError:null,nextCheckAt:'2026-10-09T01:05:00.000Z',...overrides});

test('only admins see or operate the document connection while everyone can read its factual sync status',async()=>{
  const f=fixture();f.cr.data={entries:[],automation:{lastReport:null,sync:sync()}};let html=f.evaluate('crPanel()');assert.match(html,/새 완료 결과를 기다리는 중/);assert.match(html,/마지막 확인/);assert.ok(!html.includes('docs.google.com'));assert.ok(!html.includes('creative-sync-settings'));
  f.context.form=form({documentId:'https://docs.google.com/document/d/new-document/edit',enabled:'on'});f.evaluate('crSyncForm()');await f.evaluate('crSaveSync(form)');await f.evaluate('crCheckSync()');assert.equal(f.modals.length,0);assert.equal(f.requests.length,0);
  f.context.state.user.role='admin';html=f.evaluate('crPanel()');assert.match(html,/creative-sync-settings/);assert.match(html,/creative-sync-check/);assert.match(html,/연결한 조사 문서/);f.evaluate('crSyncForm()');assert.match(f.modals.at(-1).html,/name="documentId"/);assert.ok(!f.modals.at(-1).html.includes('name="connectionId"'));assert.ok(!f.modals.at(-1).html.includes('name="documentUrl"'));
});

test('document setup sends the strict URL contract and keeps a replacement modal open',async()=>{
  const f=fixture();f.context.state.user.role='admin';f.cr.data={entries:[],automation:{sync:sync({enabled:false})}};f.context.form=form({documentId:' https://docs.google.com/document/d/new-document/edit ',enabled:'on'});
  const pending=f.evaluate('crSaveSync(form)');await f.evaluate('crSaveSync(form)');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/creative-research/sync-settings');assert.deepEqual(plain(f.requests[0].body),{enabled:true,documentId:'https://docs.google.com/document/d/new-document/edit'});
  f.evaluate('modal("새 작업", "", "")');f.requests[0].resolve({enabled:true});await flush();assert.equal(f.closes,0);assert.equal(f.requests[1].path,'/api/creative-research?includeArchived=1');f.requests[1].resolve({entries:[],automation:{sync:sync()}});await pending;
  assert.equal(f.modals.at(-1).title,'새 작업');assert.deepEqual(f.notifications,['조사 문서 자동 반영 설정을 저장했어요.']);assert.equal(f.context.form.submit.disabled,false);
});

test('missing document setup stays inline and a late setup cannot restore a previous account session',async()=>{
  const empty=fixture();empty.context.state.user.role='admin';empty.context.form=form({documentId:'',enabled:'on'});await empty.evaluate('crSaveSync(form)');assert.equal(empty.requests.length,0);assert.match(empty.context.form.errorBox.textContent,/조사 문서 주소/);
  const f=fixture();f.context.state.user.role='admin';f.context.form=form({documentId:'https://docs.google.com/document/d/new-document/edit',enabled:'on'});const pending=f.evaluate('crSaveSync(form)');f.context.state.user=null;f.evaluate('crReset()');f.context.state.user={id:'A',role:'admin'};f.evaluate('crIdentity()');f.requests[0].resolve({enabled:true});await pending;assert.equal(f.requests.length,1);assert.equal(f.closes,0);assert.equal(f.notifications.length,0);assert.equal(f.cr.data,null);
});

test('a manual completion check blocks duplicates and never announces a second import for unchanged results',async()=>{
  const f=fixture();f.context.state.user.role='admin';const prior='2026-10-08T00:00:00.000Z';f.cr.data={entries:[],automation:{sync:sync({lastImportedAt:prior,status:'imported'})}};
  const pending=f.evaluate('crCheckSync()');await f.evaluate('crCheckSync()');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/creative-research/sync-check');assert.deepEqual(plain(f.requests[0].body),{});f.requests[0].resolve({existing:true});await flush();f.requests[1].resolve({entries:[],automation:{sync:sync({lastImportedAt:prior,status:'imported'})}});await pending;
  assert.deepEqual(f.notifications,['새로 반영할 완료 결과는 아직 없어요.']);assert.equal(f.cr.syncChecking,false);
  const next=f.evaluate('crCheckSync()');f.cr.syncRequest++;f.requests[2].resolve({});await next;assert.equal(f.cr.syncChecking,false,'a concurrent settings change must not strand the completion button');assert.equal(f.notifications.length,1);
});

test('the one-minute compatibility fallback retains filters and stops on hidden, inactive or signed-out views',async()=>{
  const f=fixture();f.cr.data={entries:[row({research:research()})],automation:{sync:sync()}};f.cr.brand='LAB';f.cr.priority='high';f.cr.query='듣기';f.evaluate('crScheduleRefresh()');f.evaluate('crScheduleRefresh()');assert.equal(f.timers.size,2);const id=f.cr.refreshTimer,timer=f.timers.get(id);assert.equal(timer.delay,60000);
  f.timers.delete(id);const pending=timer.handler();assert.equal(f.requests[0].path,'/api/creative-research?includeArchived=1');assert.equal(f.requests[0].body,undefined);f.requests[0].resolve({entries:[row({research:research()})],automation:{sync:sync({status:'imported',lastImportedAt:'2026-10-09T02:00:00.000Z'})}});await pending;assert.equal(f.cr.brand,'LAB');assert.equal(f.cr.priority,'high');assert.equal(f.cr.query,'듣기');assert.equal(f.timers.size,2);
  f.context.document.visibilityState='hidden';f.handlers.get('visibilitychange')();assert.equal(f.timers.size,0);f.context.document.visibilityState='visible';f.handlers.get('visibilitychange')();assert.equal(f.timers.size,2);f.context.wr.view='desk';f.evaluate('crEnsure()');assert.equal(f.timers.size,0);
  f.context.wr.view='trends';f.evaluate('crScheduleRefresh()');assert.equal(f.timers.size,2);f.context.state.user=null;f.evaluate('crEnsure()');assert.equal(f.timers.size,0);f.evaluate('crReset()');assert.equal(f.timers.size,0);
});

test('a late background refresh does not update hidden or departed workspaces',async()=>{
  for(const transition of ['hidden','leave']){
    const f=fixture();f.cr.data={entries:[row({title:'이전 자료'})],automation:{sync:sync()}};f.evaluate('crScheduleRefresh()');const [id,timer]=[...f.timers][0];f.timers.delete(id);const pending=timer.handler(),renders=f.renders;
    if(transition==='hidden')f.context.document.visibilityState='hidden';else f.context.state.tab='home';f.evaluate('crScheduleRefresh()');f.requests[0].resolve({entries:[row({title:'늦은 자료'})],automation:{sync:sync()}});await pending;
    assert.equal(f.cr.data.entries[0].title,'이전 자료');assert.equal(f.renders,renders);assert.equal(f.cr.loading,false);assert.equal(f.timers.size,0);
  }
});

test('the document field accepts bare IDs without browser URL validation or asking for credentials',()=>{
  const f=fixture();f.context.state.user.role='admin';f.evaluate('crSyncForm()');const html=f.modals.at(-1).html;
  assert.match(html,/<input type="text" inputmode="url" spellcheck="false" autocapitalize="none" name="documentId"/);assert.match(html,/Google 문서 주소 또는 문서 ID를 입력하세요/);assert.ok(!html.includes('type="url" name="documentId"'));assert.ok(!html.includes('type="password"'));assert.ok(!html.includes('name="connectionId"'));
});

test('bare IDs and common Docs link variants are forwarded unchanged in the documentId contract',async()=>{
  const id='1DocumentQaSynkSource_20261009';
  for(const input of [id,`https://docs.google.com/document/u/1/d/${id}/edit`,`https://docs.google.com/document/d/${id}/edit?usp=drive_web`,`https://docs.google.com/document/d/${id}/edit#heading=h.example`]){
    const f=fixture();f.context.state.user.role='admin';f.context.form=form({documentId:' '+input+' ',enabled:'on'});const pending=f.evaluate('crSaveSync(form)');
    assert.equal(f.requests[0].path,'/api/creative-research/sync-settings');assert.deepEqual(plain(f.requests[0].body),{enabled:true,documentId:input});f.requests[0].resolve({enabled:true});await flush();f.requests[1].resolve({entries:[],automation:{sync:sync()}});await pending;assert.equal(f.context.form.errorBox.textContent,'');assert.equal(f.context.form.submit.disabled,false);
  }
});

test('a document configuration error stays inline and allows correcting the input without closing the form',async()=>{
  const f=fixture();f.context.state.user.role='admin';f.context.form=form({documentId:'wrong-document',enabled:'on'});const pending=f.evaluate('crSaveSync(form)');f.requests[0].reject(new Error('Google 문서 주소 또는 문서 ID를 확인해 주세요.'));await pending;
  assert.equal(f.context.form.errorBox.textContent,'Google 문서 주소 또는 문서 ID를 확인해 주세요.');assert.equal(f.context.form.submit.disabled,false);assert.equal(f.closes,0);assert.equal(f.requests.length,1);assert.equal(f.notifications.length,0);
});

const productionGuide=(overrides={})=>({formatName:'듣고 골라보는 제작 양식',requiredAssets:['실제 한국어 음성','카메라 또는 실제 게임 화면'],productionSteps:[{order:1,title:'원본의 질문 구조 확인',instruction:'원문을 읽고 확인한 범위를 기록합니다.'},{order:2,title:'실제 장면 촬영',instruction:'첫 질문과 듣고 고르는 행동을 실제 화면으로 준비합니다.'},{order:3,title:'보상과 도구 연결',instruction:'정답 직후 내 조건에 맞는 결과를 보여줍니다.'}],brandAdaptation:'LAB의 승인 색과 읽기 좋은 자막, 대상 언어로 표현합니다.',appeal:'시청자가 듣고 바로 결정한 뒤 답을 확인합니다.',estimatedMinutes:40,...overrides});
const guideRow=(overrides={})=>row({source:'instagram',kind:'reel',title:'참고한 원본',sourceUrl:'https://www.instagram.com/reel/example/',region:'KR',actualRegions:[],visibility:'company',productionReady:true,research:research({productionGuide:productionGuide()}),usage:{status:'available',canClaim:true,canRelease:false,isMine:false},...overrides});
const mine=()=>({status:'in-use',userId:'A',userName:'직원',claimedAt:'2026-10-02T01:00:00Z',isMine:true,canClaim:true,canRelease:true});

test('the default pool contains only server-approved ready guides and keeps old or private observations in references',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow(),row({id:'legacy',title:'기존 근거 자료'}),guideRow({id:'private',title:'비공개 가이드',visibility:'private',productionReady:false})],automation:{pool:{date:'2026-10-02',limit:10,addedCount:3}}};let html=f.evaluate('crPanel()');
  assert.match(html,/<h2>준비된 제작 양식<\/h2>/);assert.match(html,/하루 새 양식 약 10개 보충을 목표/);assert.match(html,/하루에도 여러 번 갱신/);assert.match(html,/오늘 반영 3개 \/ 10개/);assert.match(html,/<h3>듣고 골라보는 제작 양식<\/h3>/);assert.ok(!html.includes('<h3>기존 근거 자료</h3>'));assert.ok(!html.includes('<h3>비공개 가이드</h3>'));
  await f.handlers.get('click')({target:{closest:()=>({disabled:false,dataset:{action:'creative-view',id:'references'}})}});html=f.evaluate('crPanel()');assert.match(html,/<h3>기존 근거 자료<\/h3>/);assert.match(html,/<h3>비공개 가이드<\/h3>/);assert.ok(!html.includes('data-guide-id="one"'));
  f.evaluate('crReset()');assert.equal(f.cr.view,'guides');assert.equal(f.cr.usagePendingId,'');
});

test('guide status, brand and search filters compose and preserve the gray readable claimed card',()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow({id:'available'}),guideRow({id:'other',usage:{status:'in-use',userId:'B',userName:'다른 직원',canClaim:false,canRelease:false,isMine:false}}),guideRow({id:'mine',usage:mine()})]};f.cr.brand='LAB';f.cr.query='카메라';f.cr.usageStatus='in-use';let html=f.evaluate('crPanel()');assert.ok(!html.includes('data-guide-id="available"'));assert.match(html,/data-guide-id="other"/);assert.match(html,/cr-guide-in-use/);assert.match(html,/사용중 · 다른 직원/);assert.match(html,/data-action="creative-guide-plan"[^>]*data-id="other"[^>]*disabled/);
  f.cr.usageStatus='mine';html=f.evaluate('crPanel()');assert.match(html,/data-guide-id="mine"/);assert.ok(!html.includes('data-guide-id="other"'));assert.match(html,/이 양식으로 기획/);assert.match(html,/선택 해제/);
});

test('a guide claim is confirmed by the server and reread before preparing a fresh bounded plan',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()]};const pending=f.evaluate('crPlan("one")');await f.evaluate('crClaimGuide("one")');assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/creative-research/one/claim');assert.deepEqual(plain(f.requests[0].body),{});assert.equal(f.navigation.length,0);
  f.requests[0].resolve({entry:guideRow({usage:mine()})});await flush();assert.equal(f.requests[1].path,'/api/creative-research?includeArchived=1');f.requests[1].resolve({entries:[guideRow({usage:mine()})]});await pending;
  assert.deepEqual(f.navigation,['plan']);assert.ok(f.context.cp.input.proof.length<=3000);assert.match(f.context.cp.input.proof,/준비된 제작 양식/);assert.match(f.context.cp.input.proof,/준비물/);assert.match(f.context.cp.input.proof,/실행 1/);assert.equal(f.cr.usagePendingId,'');
});

test('a claim conflict reloads ownership and never opens a competing plan',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()]};const pending=f.evaluate('crClaimGuide("one")');f.requests[0].reject(Object.assign(new Error('이미 선택됐습니다.'),{status:409}));await flush();f.requests[1].resolve({entries:[guideRow({usage:{status:'in-use',userId:'B',userName:'박 직원',isMine:false,canClaim:false,canRelease:false}})]});await pending;
  assert.equal(f.navigation.length,0);assert.equal(f.cr.data.entries[0].usage.userId,'B');assert.match(f.notifications[0],/박 직원님이 먼저 사용 중/);assert.equal(f.cr.usagePendingId,'');
});

test('release preserves the guide and existing saved work and is limited to the current claimant',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow({usage:mine()})]};const pending=f.evaluate('crReleaseGuide("one")');assert.equal(f.requests[0].path,'/api/creative-research/one/release');f.requests[0].resolve({entry:guideRow()});await flush();f.requests[1].resolve({entries:[guideRow()]});await pending;
  assert.equal(f.cr.data.entries.length,1);assert.equal(f.cr.data.entries[0].usage.status,'available');assert.equal(f.context.cp.draftId,'draft');assert.equal(f.context.cp.input.topic,'기존 기획');assert.match(f.notifications[0],/양식과 저장한 기획은 보존/);
  f.cr.data.entries[0]=guideRow({usage:{...mine(),userId:'B',isMine:false}});await f.evaluate('crReleaseGuide("one")');assert.equal(f.requests.length,2);f.context.state.user.role='viewer';f.cr.data.entries[0]=guideRow({usage:mine()});await f.evaluate('crClaimGuide("one")');await f.evaluate('crReleaseGuide("one")');assert.equal(f.requests.length,2);
});

test('late claim responses cannot cross accounts or replace a newer modal',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()]};const pending=f.evaluate('crClaimGuide("one")');f.context.state.user=null;f.evaluate('crReset()');f.context.state.user={id:'A',role:'member'};f.evaluate('crIdentity()');f.requests[0].resolve({entry:guideRow({usage:mine()})});await pending;assert.equal(f.requests.length,1);assert.equal(f.navigation.length,0);assert.equal(f.cr.data,null);assert.equal(f.notifications.length,0);
  const modal=fixture({view:'guides'});modal.cr.data={entries:[guideRow()]};const late=modal.evaluate('crClaimGuide("one")');modal.evaluate('modal("다른 작업", "", "")');modal.requests[0].resolve({entry:guideRow({usage:mine()})});await flush();modal.requests[1].resolve({entries:[guideRow({usage:mine()})]});await late;assert.equal(modal.navigation.length,0);assert.equal(modal.closes,0);assert.equal(modal.modals.at(-1).title,'다른 작업');assert.match(modal.notifications[0],/내 선택/);
});

test('pool ownership has a one-minute fallback even before document sync is enabled',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()],automation:{sync:{enabled:false}}};f.cr.brand='LAB';f.cr.usageStatus='all';f.evaluate('crScheduleRefresh()');const id=f.cr.refreshTimer,timer=f.timers.get(id);assert.equal(timer.delay,60000);f.timers.delete(id);const pending=timer.handler();f.requests[0].resolve({entries:[guideRow({usage:{status:'in-use',userId:'B',userName:'동료',isMine:false,canClaim:false,canRelease:false}})],automation:{sync:{enabled:false}}});await pending;
  assert.equal(f.cr.data.entries[0].usage.userName,'동료');assert.equal(f.cr.brand,'LAB');assert.equal(f.cr.usageStatus,'all');assert.equal(f.requests[0].body,undefined);f.context.state.tab='home';f.evaluate('crScheduleRefresh()');assert.equal(f.timers.size,0);
});

test('untrusted long guide instructions, asset names and claimant names are escaped in cards and details',()=>{
  const f=fixture({view:'guides'});f.context.entry=guideRow({research:research({productionGuide:productionGuide({formatName:'<img src=x onerror=boom>',requiredAssets:['<svg onload=boom>'],brandAdaptation:'<script>boom</script>',appeal:'<iframe>',productionSteps:[{order:1,title:'<img>',instruction:'긴 제작 설명 '.repeat(400)+'<script>'}]})}),usage:{...mine(),userName:'<svg onload=boom>'}});const card=f.evaluate('crGuideCard(entry)'),detail=f.evaluate('crGuideDetail(entry)');for(const html of [card,detail]){assert.ok(!html.includes('<img'));assert.ok(!html.includes('<svg'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;/);}assert.match(detail,/긴 제작 설명/);
});

test('the guide keeps its original evidence timestamp distinct from newer metadata-only analysis',()=>{
  const f=fixture({view:'guides'});f.context.entry=guideRow({productionGuideCheckedAt:'2026-10-01T09:00:00Z',productionGuideEvidenceLevel:'video-watched',researchCheckedAt:'2026-10-02T09:00:00Z',research:research({evidenceLevel:'metadata-only',productionGuide:productionGuide()})});
  const card=f.evaluate('crGuideCard(entry)'),detail=f.evaluate('crGuideDetail(entry)');assert.ok(card.includes('가이드 근거 확인 '+f.evaluate('crTime(entry.productionGuideCheckedAt)')));assert.match(detail,/영상 직접 시청/);assert.ok(!detail.includes('제목·설명 등 메타데이터 확인'));assert.ok(detail.includes(f.evaluate('crTime(entry.productionGuideCheckedAt)')));
});

test('a blind release removes cached unreadable content even if the follow-up read fails',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow({usage:mine()})]};const pending=f.evaluate('crReleaseGuide("one")');f.requests[0].resolve({entry:{id:'one',productionReady:false,usage:{status:'available',isMine:false,canClaim:false,canRelease:false}}});await flush();assert.equal(f.cr.data.entries.length,0);f.requests[1].reject(new Error('다시 연결해 주세요.'));await pending;assert.equal(f.cr.data.entries.length,0);assert.doesNotThrow(()=>f.evaluate('crPanel()'));assert.equal(f.context.cp.draftId,'draft');
});

test('a failed ownership reread keeps the confirmed selection but does not open a plan from stale cached content',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()]};const pending=f.evaluate('crClaimGuide("one")');f.requests[0].resolve({entry:guideRow({usage:mine()})});await flush();f.requests[1].reject(new Error('목록 연결 실패'));await pending;assert.equal(f.cr.data.entries[0].usage.isMine,true);assert.equal(f.navigation.length,0);assert.match(f.notifications[0],/선택은 저장됐지만 목록을 다시 읽지 못했어요/);assert.equal(f.cr.usagePendingId,'');
});

test('a new company session generation invalidates a pending claim even when the account ID is unchanged',async()=>{
  const f=fixture({view:'guides'});let generation=1;f.context.companyAuthSnapshot=()=>({generation,userId:'A'});f.evaluate('crIdentity()');f.cr.data={entries:[guideRow()]};const pending=f.evaluate('crClaimGuide("one")');generation=2;f.evaluate('crIdentity()');f.requests[0].resolve({entry:guideRow({usage:mine()})});await pending;assert.equal(f.cr.authGeneration,2);assert.equal(f.cr.data,null);assert.equal(f.cr.usagePendingId,'');assert.equal(f.navigation.length,0);assert.equal(f.requests.length,1);assert.equal(f.notifications.length,0);
});

test('alias blind release uses the private reservation ID and purges only the current users cached aliases on a failed reread',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow({id:'alias-B',usage:{...mine(),reservationEntryId:'reserved-A'}}),guideRow({id:'alias-C',usage:{...mine(),reservationEntryId:'reserved-A'}}),guideRow({id:'other',usage:{...mine(),userId:'B',isMine:false,reservationEntryId:'reserved-A'}})]};
  const pending=f.evaluate('crReleaseGuide("alias-B")');assert.equal(f.requests[0].path,'/api/creative-research/reserved-A/release');assert.deepEqual(plain(f.requests[0].body),{});f.requests[0].resolve({entry:{id:'reserved-A',productionReady:false,usage:{status:'available',canClaim:false,canRelease:false,isMine:false}}});await flush();assert.deepEqual(f.cr.data.entries.map(row=>row.id),['other']);f.requests[1].reject(new Error('목록 연결 실패'));await pending;assert.deepEqual(f.cr.data.entries.map(row=>row.id),['other']);assert.equal(f.context.cp.draftId,'draft');assert.doesNotThrow(()=>f.evaluate('crPanel()'));
});

test('actual catalog brands normalize SHIFT to synkbrief and use explicit generic planning for PULSE or PATH',()=>{
  const f=fixture();f.context.cp.data={catalog:{series:[{id:'synkbrief-news',name:'synkbrief 뉴스'},{id:'synkbrief-use',name:'synkbrief 활용'},{id:'synkbrief-basics',name:'synkbrief 기초'},{id:'yuhobuilds',name:'yuhobuilds 제작 여정'},{id:'lab-situation',name:'LAB 생활 상황극'},{id:'lab-expression',name:'LAB 표현 소개'},{id:'founder-clip',name:'인물·창업자 클립'},{id:'interview',name:'인물 인터뷰'},{id:'company-work',name:'회사 소개·작업물'},{id:'writing-newsletter',name:'글·뉴스레터'}]}};f.context.wr.series='lab-expression';
  assert.equal(f.evaluate('crPlanSeries("SHIFT")'),'synkbrief-use');assert.equal(f.evaluate('crPlanSeries("PULSE")'),'company-work');assert.equal(f.evaluate('crPlanSeries("PATH")'),'company-work');assert.equal(f.evaluate('crPlanSeries("LAB")'),'lab-expression');assert.match(f.evaluate('crPlanSeriesNotice("PULSE","company-work")'),/범용.*시리즈/);assert.match(f.evaluate('crPlanSeriesNotice("SHIFT","synkbrief-use")'),/synkbrief/);
  f.context.wr.series='synkbrief-news';assert.equal(f.evaluate('crPlanSeries("SHIFT")'),'synkbrief-news');f.context.wr.series='lab-expression';f.context.cp.data.catalog.series=[];assert.equal(f.evaluate('crPlanSeries("PULSE")'),'lab-expression','no-catalog fixtures keep the existing fallback');
});

test('an open readonly guide refreshes its status and buttons while preserving reading position and modal generation',async()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()]};f.evaluate('crDetail("one")');const version=f.context.state.modalRequest,status={textContent:'사용 가능'},actions={dataset:{application:'0'},innerHTML:'old'},scroll={scrollTop:270};
  const detail={dataset:{crDetailId:'one'},closest:()=>scroll,contains:()=>false,querySelectorAll:selector=>selector==='[data-cr-guide-status]'?[status]:selector==='[data-cr-guide-actions]'?[actions]:[],querySelector:()=>null};f.context.document.querySelector=()=>detail;
  const pending=f.evaluate('crLoad()');f.requests[0].resolve({entries:[guideRow({usage:{status:'in-use',userId:'B',userName:'동료',isMine:false,canClaim:false,canRelease:false}})]});await pending;
  assert.equal(status.textContent,'사용중 · 동료');assert.match(actions.innerHTML,/disabled/);assert.equal(scroll.scrollTop,270);assert.equal(f.context.state.modalRequest,version);assert.equal(f.closes,0);await f.evaluate('crClaimGuide("one")');assert.match(f.notifications.at(-1),/동료님이 사용 중/);assert.equal(f.requests.length,1);
});

test('blind release closes only the matching readonly detail and leaves a newer unsaved modal untouched',()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow({id:'alias-B',usage:{...mine(),reservationEntryId:'reserved-A'}})]};f.evaluate('crDetail("alias-B")');const detail={dataset:{crDetailId:'alias-B'}};f.context.document.querySelector=()=>detail;f.context.minimal={id:'reserved-A',productionReady:false,usage:{status:'available',isMine:false,canClaim:false,canRelease:false}};f.evaluate('crReleaseResult(minimal,"alias-B","reserved-A")');assert.equal(f.cr.data.entries.length,0);assert.equal(f.closes,1);
  const other=fixture({view:'guides'});other.cr.data={entries:[guideRow()]};other.evaluate('crDetail("one")');other.context.document.querySelector=()=>({dataset:{crDetailId:'one'}});other.evaluate('modal("수정 중인 원고", "", "unsaved")');other.cr.data.entries=[];other.evaluate('crRefreshOpenDetail()');assert.equal(other.closes,0);assert.equal(other.modals.at(-1).title,'수정 중인 원고');
});

function liveFixture({view='guides'}={}){
  const f=fixture({view}),streams=[];
  f.context.EventSource=class{
    constructor(url){this.url=url;this.readyState=0;this.handlers=new Map();this.closed=0;streams.push(this);}
    addEventListener(type,handler){this.handlers.set(type,handler);}
    close(){this.closed++;this.readyState=2;}
    open(){this.readyState=1;this.onopen?.();}
    changed(revision){this.handlers.get('changed')?.({data:JSON.stringify({revision})});}
    fail(){this.readyState=0;this.onerror?.();}
  };
  f.cr.data={entries:[guideRow()],revision:'revision-1'};f.cr.revision='revision-1';return Object.assign(f,{streams});
}
function fireTimer(f,delay){const item=[...f.timers].find(([id,timer])=>timer.delay===delay&&id!==f.cr.syncStatusTimer);assert.ok(item,'expected '+delay+'ms timer');f.timers.delete(item[0]);return item[1].handler();}

test('visible guides and references coalesce title-free invalidations without periodically reading the full workspace',async()=>{
  for(const view of ['guides','references']){
    const f=liveFixture({view});f.cr.brand='LAB';f.cr.query='원본';f.evaluate('crScheduleRefresh()');f.evaluate('crScheduleRefresh()');assert.equal(f.streams.length,1);assert.equal(f.streams[0].url,'/api/creative-research/events');
    f.streams[0].open();f.streams[0].changed('revision-2');f.streams[0].changed('revision-3');assert.equal(f.timers.size,2);const pending=fireTimer(f,150);assert.equal(f.requests.length,1);f.requests[0].resolve({entries:[guideRow()],revision:'revision-3'});await pending;
    assert.equal(f.cr.revision,'revision-3');assert.equal(f.cr.brand,'LAB');assert.equal(f.cr.query,'원본');assert.equal(f.timers.size,1);f.streams[0].changed('revision-3');assert.equal(f.timers.size,1);assert.equal(f.cr.liveStatus,'live');
  }
});

test('an invalidation during a running read is caught after that read without overlapping it',async()=>{
  const f=liveFixture();f.evaluate('crScheduleRefresh()');f.streams[0].open();const first=fireTimer(f,150);f.streams[0].changed('revision-2');await fireTimer(f,150);assert.equal(f.requests.length,1);
  f.requests[0].resolve({entries:[guideRow()],revision:'revision-1'});await first;const second=fireTimer(f,150);f.requests[1].resolve({entries:[guideRow({usage:mine()})],revision:'revision-2'});await second;assert.equal(f.cr.data.entries[0].usage.isMine,true);assert.equal(f.cr.liveDirty,false);assert.equal(f.timers.size,1);
});

test('fallback reads only revisions until something changed and reconnect performs a gap catchup',async()=>{
  const f=liveFixture();f.evaluate('crScheduleRefresh()');const stream=f.streams[0];stream.open();let pending=fireTimer(f,150);f.requests[0].resolve({entries:[guideRow()],revision:'revision-1'});await pending;
  stream.fail();assert.equal(f.requests[1].path,'/api/creative-research/revision');f.requests[1].resolve({revision:'revision-1'});await flush();pending=fireTimer(f,60000);assert.equal(f.requests[2].path,'/api/creative-research/revision');f.requests[2].resolve({revision:'revision-1'});await pending;assert.equal(f.requests.length,3);
  pending=fireTimer(f,60000);f.requests[3].resolve({revision:'revision-2'});await flush();assert.equal(f.requests[4].path,'/api/creative-research?includeArchived=1');f.requests[4].resolve({entries:[guideRow({usage:mine()})],revision:'revision-2'});await pending;assert.equal(f.cr.data.entries[0].usage.isMine,true);
  stream.open();pending=fireTimer(f,150);f.requests[5].resolve({entries:[guideRow()],revision:'revision-3'});await pending;assert.equal(f.cr.revision,'revision-3');assert.equal(f.timers.size,1);
});

test('hidden, departed, signed-out and replaced sessions close the stream and reject its late events',()=>{
  for(const change of ['hidden','tab','logout','session']){
    const f=liveFixture();let generation=1;f.context.companyAuthSnapshot=()=>({generation,userId:f.context.state.user?.id});f.evaluate('crIdentity()');f.cr.data={entries:[guideRow()],revision:'revision-1'};f.evaluate('crScheduleRefresh()');const old=f.streams[0];old.open();
    if(change==='hidden')f.context.document.visibilityState='hidden';else if(change==='tab')f.context.state.tab='home';else if(change==='logout')f.context.state.user=null;else generation=2;
    f.evaluate('crScheduleRefresh()');assert.equal(old.closed,1);assert.equal(f.timers.size,0);old.changed('revision-2');assert.equal(f.requests.length,0);if(['logout','session'].includes(change))assert.equal(f.cr.data,null);
  }
});

test('live permission loss removes an open readonly record without closing a different unsaved modal',async()=>{
  for(const readonly of [true,false]){
    const f=liveFixture();f.evaluate('crDetail("one")');f.context.document.querySelector=selector=>selector==='[data-cr-detail-id]'?{dataset:{crDetailId:'one'}}:null;if(!readonly)f.evaluate('modal("작성 중", "", "unsaved body")');
    f.evaluate('crScheduleRefresh()');f.streams[0].open();const pending=fireTimer(f,150);f.requests[0].resolve({entries:[],revision:'permission-change'});await pending;assert.equal(f.cr.data.entries.length,0);assert.equal(f.closes,readonly?1:0);if(!readonly)assert.equal(f.modals.at(-1).html,'unsaved body');
  }
});

test('background rendering restores unsubmitted search text, selection, focus and card position',()=>{
  const f=fixture();let phase=0,selection,scrollTo;const oldQuery={value:'아직 제출하지 않은 검색',selectionStart:3,selectionEnd:8,selectionDirection:'forward',name:'query'},nextQuery={value:'',setSelectionRange(...value){selection=value;},focus(){f.context.document.activeElement=this;}};
  const main={scrollTop:65},panel=index=>({querySelector:()=>index?nextQuery:oldQuery,contains:node=>node===oldQuery,querySelectorAll:selector=>selector==='[data-cr-entry-id]'?[{dataset:{crEntryId:'one'},getBoundingClientRect:()=>({top:index?330:300,bottom:500})}]:[]});
  f.context.document.activeElement=oldQuery;f.context.document.querySelector=()=>panel(phase);f.context.document.getElementById=()=>main;f.context.window.scrollX=0;f.context.window.scrollY=400;f.context.window.scrollTo=(...value)=>{scrollTo=value;};f.context.render=()=>{phase=1;};
  f.evaluate('crRenderPreserving()');assert.equal(nextQuery.value,oldQuery.value);assert.deepEqual(selection,[3,8,'forward']);assert.equal(f.context.document.activeElement,nextQuery);assert.equal(main.scrollTop,65);assert.deepEqual(scrollTo,[0,430]);
});

test('background updates defer replacing in-progress Korean search composition',()=>{
  const f=fixture();f.handlers.get('compositionstart')({target:{matches:()=>true}});const before=f.renders;f.evaluate('crRenderPreserving()');assert.equal(f.renders,before);assert.equal(f.cr.renderPending,true);f.handlers.get('compositionend')({target:{matches:()=>true}});assert.equal(f.cr.searchComposing,false);assert.equal(f.cr.renderPending,false);assert.equal(f.renders,before+1);
});

test('KST run times distinguish the current reference, upload, publication, actual checks and retained guide proof',()=>{
  const f=fixture();f.context.entry=guideRow({provenance:'research-report',provenanceDetails:{asOfAt:'2026-10-09T16:05:00.000Z',researchStartedAt:'2026-10-09T16:06:00.000Z',researchCompletedAt:'2026-10-09T16:40:00.000Z',importedAt:'2026-10-09T16:41:00.000Z'},checkedAt:'2026-10-09T16:10:00.000Z',researchCheckedAt:'2026-10-08T09:00:00.000Z',productionGuideCheckedAt:'2026-10-07T09:00:00.000Z',research:research({publishedAt:'2026-10-06T09:00:00.000Z',productionGuide:productionGuide()})});f.cr.data={entries:[f.context.entry],automation:{lastReport:{date:'2026-10-10',...f.context.entry.provenanceDetails}}};
  f.evaluate('crDetail("one")');const detail=f.modals.at(-1).html;for(const label of ['조사 기준 시각','조사 시작','조사 완료','자료 업로드','자료 발행','자료·수치 확인','가이드 근거 확인'])assert.ok(detail.includes(label),label);for(const time of [f.context.entry.checkedAt,f.context.entry.researchCheckedAt,f.context.entry.productionGuideCheckedAt,f.context.entry.research.publishedAt,...Object.values(f.context.entry.provenanceDetails)])assert.ok(detail.includes(f.evaluate('crTime('+JSON.stringify(time)+')')));
  assert.match(f.evaluate('crTime(entry.provenanceDetails.asOfAt)'),/2026.*10.*10.*오전 1:05.*KST/);assert.match(f.evaluate('crRunTimes({})'),/보고서에 미기록/);assert.match(f.evaluate('crTime("invalid")'),/시각 미기록/);assert.match(f.evaluate('crAutomationSummary()'),/조사 기준 시각/);
});

test('a retained own selection cannot bypass server-revoked claim permission',async()=>{
  const f=fixture({view:'guides'});f.context.entry=guideRow({usage:{...mine(),canClaim:false}});f.cr.data={entries:[f.context.entry]};assert.match(f.evaluate('crGuideActions(entry)'),/disabled/);await f.evaluate('crClaimGuide("one")');assert.equal(f.requests.length,0);assert.match(f.notifications[0],/현재 선택할 수 없는/);
});

test('a changed readonly report refreshes its full safe body without changing modal generation or reading position',()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()]};f.evaluate('crDetail("one")');const version=f.context.state.modalRequest,scroll={scrollTop:380},heading={textContent:''};let body='old body',focused=false;
  const active={isConnected:true,getAttribute:()=> 'https://www.instagram.com/reel/example/'},link={getAttribute:active.getAttribute,focus:()=>{focused=true;}},detail={dataset:{crDetailId:'one'},contains:()=>true,closest:selector=>selector==='.modal-body'?scroll:{querySelector:()=>heading},querySelectorAll:selector=>selector==='a'?[link]:[],querySelector:()=>link,get innerHTML(){return body;},set innerHTML(value){body=value;active.isConnected=false;}};
  f.context.document.activeElement=active;f.context.document.querySelector=selector=>selector==='[data-cr-detail-id]'?detail:null;f.cr.data.entries=[guideRow({title:'새 원문 제목 <img>',research:research({summary:'업데이트한 본문 <script>',productionGuide:productionGuide()})})];f.evaluate('crRefreshOpenDetail()');
  assert.match(body,/업데이트한 본문 &lt;script&gt;/);assert.ok(!body.includes('<script>'));assert.equal(heading.textContent,'새 원문 제목 <img>');assert.equal(scroll.scrollTop,380);assert.equal(f.context.state.modalRequest,version);assert.equal(focused,true);
});

test('a new visible report notifies without private titles and a denied reread purges the old cache',async()=>{
  const f=liveFixture();f.cr.brand='LAB';f.cr.query='검색 유지';f.evaluate('crScheduleRefresh()');f.streams[0].open();let pending=fireTimer(f,150);f.requests[0].resolve({entries:[guideRow(),guideRow({id:'new',title:'비공개 제목은 알림에 넣지 않음'})],revision:'revision-2'});await pending;
  assert.deepEqual(f.notifications,['새 자료 1건이 반영됐어요. 현재 검색 조건은 유지했어요.']);assert.equal(f.cr.query,'검색 유지');assert.equal(f.cr.brand,'LAB');f.streams[0].changed('permission-denied');pending=fireTimer(f,150);f.requests[1].reject(Object.assign(new Error('권한을 확인해 주세요.'),{status:403}));await pending;assert.equal(f.cr.data.entries.length,0);assert.match(f.cr.error,/권한/);
});

function fireSyncStatusTimer(f){const id=f.cr.syncStatusTimer,timer=f.timers.get(id);assert.ok(timer,'expected document-health timer');assert.equal(timer.delay,60000);f.timers.delete(id);return timer.handler();}

test('document-health polling continues with live SSE and preserves entries, selection, search and open detail',async()=>{
  const f=liveFixture();const entry=guideRow({usage:mine()});f.cr.data={entries:[entry],revision:'revision-1',automation:{sync:sync(),pool:{addedCount:10}}};f.cr.query='입력 중인 검색';f.cr.brand='LAB';f.evaluate('crDetail("one")');const modalVersion=f.context.state.modalRequest,detail=f.modals.at(-1),beforeEntries=f.cr.data.entries;
  f.evaluate('crScheduleRefresh()');f.streams[0].open();const initial=fireTimer(f,150);f.requests[0].resolve(f.cr.data);await initial;assert.equal(f.cr.liveStatus,'live');assert.equal(f.cr.refreshTimer,null);assert.ok(f.cr.syncStatusTimer);
  const pending=fireSyncStatusTimer(f);assert.equal(f.requests[1].path,'/api/creative-research/sync-status');assert.equal(f.requests[1].body,undefined);f.requests[1].resolve(sync({status:'error',sourceCount:3,errorSourceCount:1,staleSourceCount:0,lastError:'완료 문서 형식 확인 필요'}));await pending;
  assert.equal(f.cr.data.entries,beforeEntries);assert.equal(f.cr.data.entries[0].usage.isMine,true);assert.equal(f.cr.query,'입력 중인 검색');assert.equal(f.cr.brand,'LAB');assert.equal(f.context.state.modalRequest,modalVersion);assert.equal(f.modals.at(-1),detail);assert.equal(f.requests.length,2);assert.match(f.evaluate('crSyncSummary()'),/일부 조사 문서 확인 필요/);assert.ok(f.cr.syncStatusTimer);
});

test('late document-health responses cannot survive hidden views, logout, navigation or session replacement',async()=>{
  for(const change of ['hidden','tab','logout','session']){
    const f=liveFixture();let auth=1;f.context.companyAuthSnapshot=()=>({generation:auth});f.evaluate('crIdentity()');f.cr.data={entries:[guideRow()],automation:{sync:sync()}};f.evaluate('crScheduleRefresh()');const pending=fireSyncStatusTimer(f),old=f.cr.data;
    if(change==='hidden')f.context.document.visibilityState='hidden';else if(change==='tab')f.context.state.tab='home';else if(change==='logout')f.context.state.user=null;else auth=2;f.evaluate('crScheduleRefresh()');f.requests[0].resolve(sync({lastError:'이전 세션 상태'}));await pending;
    assert.equal(f.timers.size,0);if(['logout','session'].includes(change))assert.equal(f.cr.data,null);else{assert.equal(f.cr.data,old);assert.equal(f.cr.data.automation.sync.lastError,null);}
  }
});

test('a newer workspace or document setting operation wins over a pending health read',async()=>{
  for(const change of ['workspace','settings','check']){
    const f=liveFixture();f.cr.data.automation={sync:sync()};f.evaluate('crScheduleRefresh()');const pending=fireSyncStatusTimer(f);
    if(change==='workspace'){const full=f.evaluate('crLoad({background:true})');f.requests[1].resolve({entries:[guideRow()],revision:'revision-2',automation:{sync:sync({lastError:'newer-state'})}});await full;}else if(change==='settings')f.cr.syncRequest++;else f.cr.syncCheckRequest++;
    f.requests[0].resolve(sync({lastError:'late-state'}));await pending;assert.notEqual(f.cr.data.automation.sync.lastError,'late-state');assert.equal(f.cr.syncStatusLoading,false);assert.ok(f.cr.syncStatusTimer);
  }
});

test('health transport failures preserve saved data and recover on the next bounded poll',async()=>{
  const f=liveFixture();f.cr.data.automation={sync:sync()};const original=f.cr.data.entries;f.evaluate('crScheduleRefresh()');let pending=fireSyncStatusTimer(f);f.requests[0].reject(Error('private transport details'));await pending;assert.equal(f.cr.data.entries,original);assert.match(f.evaluate('crSyncSummary()'),/상태를 새로 확인하지 못했어요/);assert.ok(!f.evaluate('crSyncSummary()').includes('private transport details'));
  pending=fireSyncStatusTimer(f);f.requests[1].resolve(sync({sourceCount:3,errorSourceCount:0,staleSourceCount:0}));await pending;assert.equal(f.cr.syncStatusError,'');assert.match(f.evaluate('crSyncSummary()'),/읽기 오류 0개 · 조사 지연 0개/);assert.equal(f.requests.length,2);
});

test('denied health reads purge cached observations without closing another unsaved modal',async()=>{
  for(const ownDetail of [true,false]){
    const f=liveFixture();f.cr.data.automation={sync:sync()};f.evaluate('crDetail("one")');f.context.document.querySelector=selector=>selector==='[data-cr-detail-id]'?{dataset:{crDetailId:'one'}}:null;if(!ownDetail)f.evaluate('modal("편집 중", "", "unsaved")');f.evaluate('crScheduleRefresh()');const pending=fireSyncStatusTimer(f);f.requests[0].reject(Object.assign(Error('현재 권한 없음'),{status:403}));await pending;assert.equal(f.cr.data.entries.length,0);assert.equal(f.closes,ownDetail?1:0);if(!ownDetail)assert.equal(f.modals.at(-1).html,'unsaved');
  }
});

test('admin source health separates read attempts, successful reads, research completion and upload',()=>{
  const f=fixture();f.context.state.user.role='admin';const completed='2026-10-09T01:00:00.000Z',read='2026-10-11T01:00:00.000Z';f.cr.data={entries:[],automation:{sync:sync({status:'imported',sourceCount:3,errorSourceCount:1,staleSourceCount:1,sources:[{id:'primary',status:'imported',lastCheckedAt:read,lastReadAt:read,researchCompletedAt:completed,lastImportedAt:'2026-10-09T01:05:00Z',freshness:'stale',freshnessLimitHours:36},{id:'meta-brand',status:'error',lastError:'원문 <script> 오류',freshness:'unknown'},{id:'yt-tt',status:'imported',freshness:'current',researchCompletedAt:read}]})}};
  let html=f.evaluate('crSyncSummary()');for(const label of ['조사 문서별 상태','전체 조사','YouTube · TikTok','Meta · 브랜드','마지막 확인 시도','마지막 성공 읽기','마지막 조사 완료','마지막 자동 반영','36시간 넘게'])assert.ok(html.includes(label),label);assert.match(html,/일부 조사 문서 확인 필요/);assert.match(html,/원문 &lt;script&gt; 오류/);assert.ok(!html.includes('<script>'));assert.ok(html.includes(f.evaluate('crTime('+JSON.stringify(completed)+')')));assert.ok(html.includes(f.evaluate('crTime('+JSON.stringify(read)+')')));
  f.context.state.user.role='member';html=f.evaluate('crSyncSummary()');assert.ok(!html.includes('조사 문서별 상태'));assert.ok(!html.includes('전체 조사'));assert.match(html,/연결 문서 3개 · 읽기 오류 1개 · 조사 지연 1개/);
});

test('day-limit deferrals are not shown as a queue for automatic next-day admission',()=>{
  const f=fixture({view:'guides'});f.cr.data={entries:[guideRow()],automation:{pool:{date:'2026-10-11',addedCount:10,limit:10,deferredCount:20}}};const html=f.evaluate('crPanel()');assert.ok(html.includes('오늘 입장 보류 20건 (보고서별 누적 · 자동 대기열 아님)'));assert.ok(!html.includes('대기 20개'));
});


test('health rendering preserves the expanded source panel and defers in-progress Korean search input',()=>{
  const f=fixture();let phase=0;const oldDetails={open:true},newDetails={open:false};const panel=i=>({querySelector:selector=>selector==='[data-cr-sync-sources]'?(i?newDetails:oldDetails):null,querySelectorAll:()=>[],contains:()=>false});f.context.document.querySelector=()=>panel(phase);f.context.render=()=>{phase=1;};f.evaluate('crRenderPreserving()');assert.equal(newDetails.open,true);
  f.cr.searchComposing=true;phase=0;newDetails.open=false;f.evaluate('crRenderPreserving()');assert.equal(phase,0);assert.equal(f.cr.renderPending,true);assert.equal(newDetails.open,false);
});


test('document-health requests abort after fifteen seconds and retry once after the next minute',async()=>{
  const f=liveFixture();f.cr.data.automation={sync:sync()};f.evaluate('crScheduleRefresh()');const pending=fireSyncStatusTimer(f);assert.equal(f.requests[0].method,'GET');const signal=f.requests[0].options.signal;assert.equal(signal.aborted,false);await fireTimer(f,15000);await pending;assert.equal(signal.aborted,true);assert.equal(f.cr.syncStatusLoading,false);assert.equal(f.cr.syncStatusTimeoutTimer,null);assert.match(f.cr.syncStatusError,/확인하지 못했어요/);assert.ok(f.cr.syncStatusTimer);const retry=fireSyncStatusTimer(f);f.requests[1].resolve(sync());await retry;assert.equal(f.requests.length,2);assert.equal(f.cr.syncStatusError,'');assert.ok(![...f.timers.values()].some(timer=>timer.delay===15000));
});

test('leaving the visible pool aborts only its pending health request and clears its timeout',async()=>{
  for(const change of ['hidden','tab','logout']){const f=liveFixture();f.cr.data.automation={sync:sync()};f.evaluate('crScheduleRefresh()');const pending=fireSyncStatusTimer(f),signal=f.requests[0].options.signal;if(change==='hidden')f.context.document.visibilityState='hidden';else if(change==='tab')f.context.state.tab='home';else f.context.state.user=null;f.evaluate('crScheduleRefresh()');await pending;assert.equal(signal.aborted,true);assert.equal(f.timers.size,0);assert.equal(f.cr.syncStatusTimeoutTimer,null);}
});

test('health changes replace only the sync block while preserving expanded sources and their keyboard focus',()=>{
  const f=fixture();let replaced='',focused=false;const active={tagName:'SUMMARY'},oldSource={open:true},nextSource={open:false,querySelector:()=>({focus(){focused=true;}})};const old={outerHTML:'old',contains:()=>true,querySelector:()=>oldSource},next={outerHTML:'new',querySelector:()=>nextSource};Object.defineProperty(old,'outerHTML',{get:()=> 'old',set:v=>{replaced=v;}});f.context.document.activeElement=active;f.context.document.querySelector=()=>replaced?next:old;f.cr.data={entries:[],automation:{sync:sync()}};const renders=f.renders;f.evaluate('crRenderSyncStatus()');assert.match(replaced,/문서 읽기와 새 조사 도착/);assert.equal(f.renders,renders);assert.equal(nextSource.open,true);assert.equal(focused,true);
});
