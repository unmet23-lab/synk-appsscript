import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fixture(){
  const requests=[],handlers=new Map(),notifications=[],navigation=[],modals=[];let renders=0,closes=0,invalidations=0;
  const context=vm.createContext({
    console,URL,Set,JSON,Promise,Intl,Date,structuredClone,
    state:{user:{id:'A',role:'member',name:'직원'},tab:'workroom',data:{channels:[]},modalRequest:0},
    wr:{view:'trends',series:'story'},wrRegions:{KR:'한국',US:'미국',CN:'중국'},wrDailyToday:()=> '2026-10-02',wrTrendTime:value=>value,
    document:{addEventListener(type,handler){handlers.set(type,handler);}},window:{scrollTo(){}},
    FormData:class{constructor(form){this.values=form.values;}get(key){return this.values[key]??null;}has(key){return Object.hasOwn(this.values,key);}},
    api(path,body){let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,resolve,reject});return pending;},
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
  const evaluate=code=>vm.runInContext(code,context),cr=evaluate('cr');evaluate('crIdentity()');
  return {context,requests,handlers,notifications,navigation,modals,evaluate,cr,get renders(){return renders;},get closes(){return closes;},get invalidations(){return invalidations;}};
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
  f.context.entry.provenance='official-page';assert.equal(f.evaluate('crObservationTime(entry)'),'2026-10-01T20:05:12.345Z');
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
