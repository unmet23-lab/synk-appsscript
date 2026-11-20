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

test('a redirect during navigation never reads the identity or balance of the next origin', async () => {
  const opts={kind:'api',service:'gpt',email,url:'https://chatgpt.com/settings/billing'};
  let reads=0;
  const r=await inBrowser(opts,location=>{
    location.hostname='example.test';
    return {querySelectorAll(){reads++;return [];}};
  });
  assert.equal(reads,0);
  assert.equal(r.ok,false);
});

test('Gemini and Flow requests are refused before finding the browser, starting a process or creating a tab', async () => {
  const forbidden = () => assert.fail('a disabled portal request tried to open a browser');
  const runtime = {get rawRun(){return forbidden();}, get childEnv(){return forbidden();}};
  const system = {runtime, platform:'win32', get home(){return undefined;}};
  for (const [service,kind,code] of [
    ['gemini','api','USAGE_DISABLED'], ['gemini','flow','USAGE_DISABLED'],
    ['gpt','flow','INVALID_CREDIT_CHECK'], ['claude','flow','INVALID_CREDIT_CHECK'],
  ]) {
    assert.deepEqual(await readCreditPortal(system,{service,email},{kind}),{ok:false,code});
    const reply = await vm.runInNewContext('(' + inspectPages.toString() + ')(options)', {
      options:{service,kind,email},taskSpace:forbidden,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(reply)),{ok:false,code});
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
