'use strict';
// SYNK TOWN's 「마을 기록」 from the platform 「내 계정」 (SYNK-appsscript vertical slice design §20-5, W6c): the main process reads the
// card and sends only the person's own rights commands to the town's records route, and pages the town part of the records download.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {requestSpec}=require('../src/account-requests.cjs');
const {accountResponseContract}=require('../src/account-response-contract.cjs');
const owner='00000000-0000-4000-8000-000000000001';
const spec=(operation,params,product='platform',clientKey='platform')=>requestSpec(operation,params,'0.4.46',product,clientKey);

test('town records: a fixed read, rights commands only with word or switch payloads, the town export cursors — platform only',()=>{
  assert.deepEqual(spec('townRecords',{}),{path:'synk-town/records'});
  assert.deepEqual(spec('townRights',{id:'rights-1',type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'20749.tea-order'},expectedRevision:12}),
    {path:'synk-town/records',body:{id:'rights-1',type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'20749.tea-order'},expectedRevision:12}});
  for(const [type,payload] of [['FEEDBACK_REMOVE',{eventId:'E-5'}],['OBSERVED_CORRECT',{family:'cafe-life'}],['SEEN_CLEAR',{}],['MEMORY_CLEAR',{}],['EVAL_CONSENT',{state:'withdrawn'}],['EVAL_CONSENT',{state:'granted',ver:'town-eval-signals-1'}],['PREF_VISIT_BANDS',{on:true}]])
    assert.deepEqual(spec('townRights',{id:'r',type,payload,expectedRevision:0}).body.payload,payload,type);
  assert.deepEqual(spec('townExportPage',{afterCommand:'cmd-9',afterEvent:'town:3',at:'2026-10-28T01:02:03.000Z'}),{path:'synk-account?view=town-export&afterCommand=cmd-9&afterEvent=town%3A3&at=2026-10-28T01%3A02%3A03.000Z'});
  const invalid=[
    ['townRecords',{accountId:owner}],
    ['townRights',{id:'r',type:'DAY_REST',payload:{},expectedRevision:1}],
    ['townRights',{id:'r',type:'PREF_LESS_OFTEN',payload:{activity:'tea-order',on:false},expectedRevision:1}],
    ['townRights',{id:'r',type:'RESET',payload:{},expectedRevision:1}],
    ['townRights',{id:'bad id',type:'SEEN_CLEAR',payload:{},expectedRevision:1}],
    ['townRights',{id:'r',type:'SEEN_CLEAR',payload:{},expectedRevision:-1}],
    ['townRights',{id:'r',type:'SEEN_CLEAR',payload:[],expectedRevision:1}],
    ['townRights',{id:'r',type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'x'.repeat(101)},expectedRevision:1}],
    ['townRights',{id:'r',type:'MEMORY_FORGET',payload:{npc:{},eventId:'x'},expectedRevision:1}],
    ['townRights',{id:'r',type:'PREF_VISIT_BANDS',payload:{on:'false'},expectedRevision:1}],
    ['townRights',{id:'r',type:'SEEN_CLEAR',payload:{surfaceId:'w'},expectedRevision:1}],
    ['townRights',{id:'r',type:'SEEN_CLEAR',payload:{},expectedRevision:1,seen:['card:C1:self']}],
    ['townExportPage',{afterCommand:'c1'}],
    ['townExportPage',{afterEvent:'other:3',at:'2026-10-28T01:02:03.000Z'}],
    ['townExportPage',{afterCommand:'c1',at:'yesterday'}],
    ['townExportPage',{view:'export'}],
  ];
  for(const [operation,params] of invalid)assert.throws(()=>spec(operation,params),{code:'INVALID_REQUEST'},JSON.stringify(params));
  for(const [product,clientKey] of [['world','world'],['messenger','messenger'],['platform','fortune'],['platform','care']])
    for(const [operation,params] of [['townRecords',{}],['townRights',{id:'r',type:'SEEN_CLEAR',payload:{},expectedRevision:0}],['townExportPage',{}]])
      assert.throws(()=>spec(operation,params,product,clientKey),{code:'INVALID_REQUEST'},`${product}/${clientKey} ${operation}`);
});

test('town records replies must be this account\'s town records — another scope or owner is a mismatch',()=>{
  const fault=code=>Object.assign(new Error(code),{code}),config={product:'platform',clientKey:'platform'};
  const reply=data=>({response:{ok:true,status:200},data:{ok:true,...data}});
  for(const operation of ['townRecords','townRights']){
    const contract=accountResponseContract(operation,{},config,fault);
    assert.equal(contract.decode(reply({scope:'synk-town-records',accountId:owner,records:{available:true,started:false}}),owner).mismatch,false,operation);
    assert.equal(contract.decode(reply({scope:'synk-town-records',accountId:'00000000-0000-4000-8000-000000000002',records:{}}),owner).mismatch,true,operation);
    assert.equal(contract.decode(reply({scope:'synk-account-and-learning',accountId:owner}),owner).mismatch,true,operation);
    const refused=contract.decode({response:{ok:false,status:403},data:{ok:false,error:{code:'TOWN_RECORDS_COMMAND'}}},owner);
    assert.deepEqual([refused.kind,refused.data.error.code],['error','TOWN_RECORDS_COMMAND']);
    // The town's own command errors are lower-case words; the card needs them as they are (a stale revision reloads the card).
    for(const code of ['stale-command','eval-unavailable','eval-consent-academy','memory-unavailable'])
      assert.equal(contract.decode({response:{ok:false,status:409},data:{ok:false,error:{code}}},owner).data.error.code,code,`${operation} ${code}`);
    assert.equal(contract.decode({response:{ok:false,status:409},data:{ok:false,error:{code:'<script>'}}},owner).data.error.code,'ACCOUNT_UNAVAILABLE');
  }
  // Other operations keep the account words only.
  assert.equal(accountResponseContract('accountView',{},config,fault).decode({response:{ok:false,status:409},data:{ok:false,error:{code:'stale-command'}}},owner).data.error.code,'ACCOUNT_UNAVAILABLE');
});
