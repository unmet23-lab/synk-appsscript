'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { fileURLToPath } = require('node:url');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectPages, readCreditPortal } = require('../src/subscription-credit-portal.cjs');
const { HELP_LINKS } = require('../src/subscription-common.cjs');

const email = 'studio@example.com';
const accountButton = { getClientRects:() => [1], getAttribute:() => 'Google Account (' + email + ')' };

test('account links open the Flow wallet separately from Google AI Studio usage', () => {
  const activity=new URL(HELP_LINKS['flow-activity']);
  assert.equal(activity.origin+activity.pathname,'https://one.google.com/ai/activity');
  assert.equal(activity.searchParams.get('utm_source'),'flow');
  assert.equal(activity.searchParams.get('g1_landing_page'),'0');
  assert.equal(HELP_LINKS['gemini-studio-usage'],'https://aistudio.google.com/usage');
});

async function inBrowser(options, documentFor, onClick = () => {}) {
  let location = new URL(options.url), finished = false, documentTime = 100;
  const browserGlobals = {};
  const page = {
    goto:async url => { location = new URL(url); documentTime++; },
    url:async () => location.href,
    click:async selector => {
      onClick(selector,location);
      if(selector.startsWith('button[aria-label="계정"]')) location = new URL('/settings/account',location);
      if(selector.startsWith('button[aria-label="결제"]')) location = new URL('/settings/billing',location);
    },
    evaluate:async fn => vm.runInNewContext(typeof fn === 'string' ? fn : '(' + fn.toString() + ')()', { document:{querySelector:()=>null,...documentFor(location)}, location, globalThis:browserGlobals, performance:{timeOrigin:documentTime} }),
  };
  const space = { pages:async () => [page], finish:async () => { finished = true; } };
  const result = await vm.runInNewContext('(' + inspectPages.toString() + ')(options)', {
    options, URL, taskSpace:async () => space, setTimeout:fn => { queueMicrotask(fn); },
  });
  assert.equal(finished,true);
  return JSON.parse(JSON.stringify(result));
}

test('Flow waits for statement rows as well as pagination and counts only debits from the Flow wallet', async () => {
  let second = false, waiting = 2;
  const make = (time, type, change) => '2026. 11. 19. ' + time + '\t' + type + '\t' + change;
  const first = [make('12:05','Google Flow 크레딧',-100),make('12:04','Google Flow 크레딧',-100)];
  const next = [make('12:04','Google Flow',-300),make('12:02','AI 크레딧',-50)];
  const opts = {kind:'flow',service:'gemini',email,from:'2026-11-01',to:'2026-11-20',url:'https://one.google.com/ai/activity'};
  const captured=await inBrowser(opts, () => {
    const rows = !second ? first : waiting-- > 0 ? [] : next;
    const innerText = ['Google Flow 크레딧','0','내 최근 활동',...rows,second ? '4 중 3–4':'4 중 1–2'].join('\n');
    return {body:{innerText},querySelectorAll:() => [accountButton]};
  }, () => { second = true; });
  assert.deepEqual(captured,{ok:true,account:email,from:opts.from,to:opts.to,used:500,wallet:0});
});

test('a negated English API organization label stays unlinked and a later account switch is rejected', async () => {
  const opts={kind:'api',service:'gpt',email,url:'https://chatgpt.com/settings/billing'};
  let profile = email;
  const documentFor = location => {
    const account={getClientRects:() => [1],innerText:'이메일\nThe email address linked to your account\n'+profile,querySelectorAll:()=>[]};
    if(location.pathname === '/settings/billing') return {body:{innerText:'Billing email\n'+email+'\nAPI subscription benefit\nYou are not currently connected to an API organization.'}};
    return {querySelectorAll:()=>[account]};
  };
  assert.equal((await inBrowser(opts,documentFor)).status,'unlinked');
  let seenBilling=false;
  const changed=await inBrowser(opts,loc=>{
    if(loc.pathname==='/settings/billing')seenBilling=true;
    else if(seenBilling) profile='other@example.com';
    return documentFor(loc);
  });
  assert.deepEqual(changed,{ok:false,code:'CREDIT_WRONG_ACCOUNT'});
});

test('an applied monthly Google Cloud credit has an actual billing account and balance on the same card', async () => {
  const opts={kind:'api',service:'gemini',email,to:'2026-11-20',url:'https://me.developers.google.com/benefits'};
  const base="Nov '26\n$10 monthly Gen AI & Cloud credits\nBilling account\n";
  const inspect=async lines=>inBrowser(opts,()=>({querySelectorAll:selector=>selector==='[aria-label]' ? [accountButton] : [{getClientRects:()=>[],querySelector:()=>({getClientRects:()=>[1]}),querySelectorAll:()=>[],innerText:base+lines}]}));
  assert.equal((await inspect('Example account\nAlways use this billing account\nBalance: USD 0')).status,'linked');
  assert.equal((await inspect('Select a billing account\nAlways use this billing account')).status,'unlinked');
  assert.equal((await inspect('Example account\nAlways use this billing account')).ok,false);
  assert.equal((await inspect('Example account\nBalance: USD 10\nApply')).status,'unlinked');
  const cards=[{innerText:"Oct '26\nMonthly Google Cloud credits\nBilling account\nOther account\nBalance: USD 10"},{innerText:base+'Select a billing account'}];
  const withCards=()=>inBrowser(opts,()=>({querySelectorAll:s=>s==='[aria-label]'?[accountButton]:cards.map(card=>({...card,getClientRects:()=>[1],querySelectorAll:()=>[]}))}));
  assert.equal((await withCards()).status,'unlinked');
  cards.push({innerText:base+'Example account\nBalance: USD 10'});
  assert.equal((await withCards()).status,'linked');
  cards[1]={innerText:base+'Example account\nBalance: USD 2'};
  assert.equal((await withCards()).status,'linked');
  cards.splice(1);
  cards[0].innerText+='\nExpires: Nov 25, 2026';
  assert.equal((await withCards()).ok,false);
});

test('Claude reopens the billing dialog through its fragment without replacing the account document', async () => {
  const opts={kind:'api',service:'claude',email,url:'https://claude.ai/new#settings/billing'};
  let menu=false, identityReads=0;
  const doc=loc=>({
    body:{innerText:loc.hash==='#settings/billing'?'API credits\nExample organization\nConnected\nMonthly credits':''},
    querySelector:s=>s.startsWith('[role="dialog"]')?{innerText:loc.hash==='#settings/billing'?'API credits\nExample organization\nConnected\nMonthly credits':''}:{innerText:'Example · Pro'},
    querySelectorAll:()=>menu?[{getClientRects:()=>[1],innerText:email}]:[],
  });
  const result=await inBrowser(opts,doc,(selector,loc)=>{
    if(selector.includes('dialog-close')){loc.hash='';menu=false;}
    if(selector.includes('user-menu-button')){menu=true;identityReads++;}
  });
  assert.equal(result.status,'linked');
  assert.equal(identityReads,2);
});

test('Google confirms a grant for the same signed-in user while the billing name resolves', async () => {
  const opts={kind:'api',service:'gemini',email,to:'2026-11-20',url:'https://me.developers.google.com/benefits'};
  let reads=0, first='Personal';
  const doc=()=>({querySelectorAll:s=>s==='[aria-label]'?[accountButton]:[{
    getClientRects:()=>[1],querySelectorAll:()=>[],
    innerText:"Nov '26\nMonthly Google Cloud credits\nBilling account\n"+(++reads===1?first:'Second')+'\nBalance: USD 10',
  }]});
  assert.equal((await inBrowser(opts,doc)).status,'linked');
  reads=0;first='billingAccounts/example';
  assert.equal((await inBrowser(opts,doc)).status,'linked');
  let calls=0;
  const slowly=()=>({querySelectorAll:s=>s==='[aria-label]'?[accountButton]:[{
    getClientRects:()=>[1],querySelectorAll:()=>[],
    innerText:"Nov '26\nMonthly Google Cloud credits\nBilling account\n"+(++calls<=2?'billingAccounts/example':'Second')+'\nBalance: USD 10',
  }]});
  assert.equal((await inBrowser(opts,slowly)).status,'linked');
  let logins=0;
  const switched=()=>({querySelectorAll:s=>s==='[aria-label]'&&++logins>=3?[{getClientRects:()=>[1],getAttribute:()=>'Google Account (another@example.com)'}]:slowly().querySelectorAll(s)});
  assert.deepEqual(await inBrowser(opts,switched),{ok:false,code:'CREDIT_WRONG_ACCOUNT'});
});

test('Claude also reopens from its canonical billing path and ignores a team subscription', async () => {
  const opts={kind:'api',service:'claude',email,url:'https://claude.ai/settings/billing'};
  let menu=false, team=false;
  const doc=()=>{
    const innerText=(team?'Team annual subscription\n':'')+'API credits\nExample organization\nConnected\nMonthly credits';
    return {body:{innerText:'Team plan\n'+innerText},querySelector:s=>s.startsWith('[role="dialog"]')?{innerText}:{innerText:'Studio Team · Pro'},
      querySelectorAll:()=>menu?[{getClientRects:()=>[1],innerText:email}]:[]};
  };
  const click=(selector,loc)=>{
    if(selector.includes('dialog-close')){loc.pathname='/new';loc.hash='';menu=false;}
    if(selector.includes('user-menu-button'))menu=true;
  };
  assert.equal((await inBrowser(opts,doc,click)).status,'linked');
  team=true;assert.equal((await inBrowser(opts,doc,click)).ok,false);
});

test('a Flow loading placeholder or an unfamiliar debit cannot overwrite a previous reading with zero', async () => {
  const opts={kind:'flow',service:'gemini',email,from:'2026-11-01',to:'2026-11-20',url:'https://one.google.com/ai/activity'};
  for(const history of ['No recent activity','Nov 19, 2026\tUnknown ledger\t-20\n1–1 of 1']){
    const result=await inBrowser(opts,()=>({body:{innerText:'Google Flow credits\n0\n'+history},querySelector:()=>null,querySelectorAll:s=>s==='[aria-label]'?[accountButton]:[]}));
    assert.deepEqual(result,{ok:false,code:'CREDIT_SOURCE_UNKNOWN'});
  }
  const placeholder={getClientRects:()=>[1],getAttribute:()=>null,querySelectorAll:()=>[],innerText:'No recent activity'};
  const pending=await inBrowser(opts,()=>({body:{innerText:'Google Flow credits\n0\nNo recent activity'},querySelectorAll:s=>s==='[aria-label]'?[accountButton]:[placeholder]}));
  assert.equal(pending.ok,false);
});

test('an explicitly empty statement settles twice, and other named Google products never add to Flow usage', async () => {
  const opts={kind:'flow',service:'gemini',email,from:'2026-11-01',to:'2026-11-20',url:'https://one.google.com/ai/activity'};
  const doc=text=>({body:{innerText:'Google Flow credits\n100\n'+text},querySelector:()=>null,querySelectorAll:s=>s==='[aria-label]'?[accountButton]:[]});
  const none=await inBrowser(opts,()=>doc('0–0 of 0'));
  assert.equal(none.used,0);
  const mixed=await inBrowser(opts,()=>doc('Nov 19, 2026\tGoogle Flow\t-20\nNov 18, 2026\tGoogle Antigravity\t-5\n1–2 of 2'));
  assert.equal(mixed.used,20);
});

test('alternate invoice contacts require an independently matching signed-in profile', async () => {
  const opts={kind:'api',service:'gpt',email,url:'https://chatgpt.com/settings/billing'};
  const doc=loc=>loc.pathname.endsWith('/billing') ? {body:{innerText:'Billing email\nbilling-other@example.com\nAPI credits\nConnected\nMonthly credits'}} :
    {querySelectorAll:()=>[{getClientRects:()=>[1],innerText:'The email address linked to your account\n'+email}]};
  assert.deepEqual(await inBrowser(opts,doc),{ok:false,code:'CREDIT_SOURCE_UNKNOWN'});
  const withProfile=loc=>({...doc(loc),querySelector:()=>({getAttribute:()=>'Profile for Example'})});
  assert.equal((await inBrowser(opts,withProfile)).ok,false);
  const withBillingOwner=loc=>{
    const d=withProfile(loc);
    if(loc.pathname.endsWith('/billing')) d.body.innerText+='\nAccount email\n'+email;
    return d;
  };
  assert.equal((await inBrowser(opts,withBillingOwner)).status,'linked');
});

test('billing actions can finish loading without changing the verified API organization', async () => {
  const opts={kind:'api',service:'gpt',email,url:'https://chatgpt.com/settings/billing'};
  let visits=0, changeOrganization=false;
  const doc=loc=>{
    if(!loc.pathname.endsWith('/billing')) return {querySelectorAll:()=>[{getClientRects:()=>[1],innerText:'Account email\nThe email address linked to your account\n'+email}]};
    const later=++visits>1, org=later && changeOrganization?'Second':'Personal';
    return {body:{innerText:'Billing email\n'+email+'\nAPI 구독 혜택\nAPI 조직\nAPI 조직 “'+org+'”에 연결되어 있습니다.\n연결됨\n'+(later?'새로 표시된 관리 동작':'플랜 취소')}};
  };
  assert.equal((await inBrowser(opts,doc)).status,'linked');
  visits=0;changeOrganization=true;
  assert.equal((await inBrowser(opts,doc)).ok,false);
});

test('two settled consecutive Flow pages may contain exactly the same transactions', async () => {
  const opts={kind:'flow',service:'gemini',email,from:'2026-11-01',to:'2026-11-20',url:'https://one.google.com/ai/activity'};
  let next=false;
  const row='Nov 19, 2026\tGoogle Flow\t-20';
  const nodes=()=>Array.from({length:2},()=>({getClientRects:()=>[1],cells:[{innerText:'Nov 19, 2026'}]}));
  const firstRows=nodes(),nextRows=nodes();
  let replace=true;
  const doc=()=>({body:{innerText:['Google Flow credits','100',row,row,next?'3–4 of 4':'1–2 of 4'].join('\n')},
    querySelectorAll:s=>s==='[aria-label]'?[accountButton]:s==='table tbody tr'?(next&&replace?nextRows:firstRows):[]});
  assert.equal((await inBrowser(opts,doc,()=>{next=true;})).used,80);
  next=false;replace=false;
  assert.deepEqual(await inBrowser(opts,doc,()=>{next=true;}),{ok:false,code:'CREDIT_SOURCE_UNKNOWN'});
});

test('a named empty Flow activity table settles, while a busy table or enclosing indicator never confirms zero', async () => {
  const opts={kind:'flow',service:'gemini',email,from:'2026-11-01',to:'2026-11-20',url:'https://one.google.com/ai/activity'};
  const region={getClientRects:()=>[1],getAttribute:k=>k==='aria-label'?'Recent activity':null,querySelectorAll:()=>[],innerText:'No recent activity'};
  const busy={getClientRects:()=>[1],getAttribute:k=>k==='aria-busy'?'true':null};
  const doc=(indicator,text)=>({body:{innerText:'Google Flow credits\n100\nNo recent activity\n'+text},
    querySelectorAll:s=>s==='[aria-label]'?[accountButton]:s.includes('aria-busy')?(indicator?[busy]:[]):[region]});
  assert.equal((await inBrowser(opts,()=>doc(false,''))).used,0);
  assert.equal((await inBrowser(opts,()=>doc(true,'0–0 of 0'))).ok,false);
});

test('a redirect during navigation never reads the identity or balance of the next origin', async () => {
  const opts={kind:'api',service:'gemini',email,url:'https://me.developers.google.com/benefits'};
  let reads=0;
  const r=await inBrowser(opts,location=>{
    location.hostname='accounts.google.com';
    return {querySelectorAll(){reads++;return [accountButton];}};
  });
  assert.equal(reads,0);
  assert.equal(r.ok,false);
});

test('Flow reads and mismatched pairs are refused before any browser is looked up or opened (GPT solio-subs-agy-be-20261126 A5 · B7)', async () => {
  // 계정판 쪽 Flow 읽기는 고칠 때까지 꺼져 있다. 실행 파일을 찾기 전에 거절한다
  const home = path.join(os.tmpdir(), 'solio-credit-none-' + process.pid);
  for (const service of ['gemini', 'gpt', 'claude']) assert.deepEqual(await readCreditPortal({ runtime:{}, home, platform:'win32' }, { service, email }, { kind:'flow' }), { ok:false, code:'INVALID_CREDIT_CHECK' });
  // 브라우저 안 모듈도 Claude · GPT의 Flow는 작업 공간을 열기 전에 거절한다
  for (const service of ['gpt', 'claude']) {
    let opened = false;
    globalThis.taskSpace = async () => { opened = true; throw Error('must not open'); };
    try { assert.deepEqual(await inspectPages({ service, kind:'flow', email, url:'https://example.com/', spaceName:'x' }), { ok:false, code:'INVALID_CREDIT_CHECK' }); }
    finally { delete globalThis.taskSpace; }
    assert.equal(opened, false);
  }
});

test('the browser receives a private temporary module and the command line contains no account address', async t => {
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'solio-credit-test-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const dir=path.join(home,'.local','share','ego','active_version_dir');
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'ego-browser.exe'),'');
  let script;
  const runtime={childEnv:()=>({}),rawRun:async (_exe,args)=>{
    assert.equal(args.join(' ').includes(email),false);
    const url=JSON.parse(args[2].slice('await import('.length,-1));
    script=fileURLToPath(url);
    assert.ok(fs.readFileSync(script,'utf8').includes(email));
    return {code:0,out:'',err:'SOLIO_CREDIT_RESULT '+JSON.stringify({ok:true,account:email,status:'linked'})+'\n'};
  }};
  const r=await readCreditPortal({runtime,home,platform:'win32'},{service:'gpt',email},{kind:'api'});
  assert.equal(r.status,'linked');
  assert.equal(fs.existsSync(script),false);
});
