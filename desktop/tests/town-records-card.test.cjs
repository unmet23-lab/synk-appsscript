'use strict';
// SYNK TOWN's 「마을 기록」 card (renderer/town-records-card.mjs, W6c): the sections talk's records route sends, drawn as they come and
// escaped; a pressed button goes out as the rights command at the card's revision (asking once more where the section says so);
// a conflict reloads; a reply after reset() is dropped; the records download pages the town part on.
const test=require('node:test'),assert=require('node:assert/strict');
const loaded=import('../renderer/town-records-card.mjs');
const settle=async()=>{for(let n=0;n<6;n++)await new Promise(resolve=>setImmediate(resolve));};
const card=(revision=4,more={})=>({records:{available:true,started:true,revision,sections:[
  {id:'known',title:'주민이 아는 나',empty:'주민이 기억하는, 같이 한 일이 아직 없어요.',rows:[{text:'찻집 주인 · <b>찻집 일</b> — 같이 했어요',action:{type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'20749.tea-order'},label:'잊어 주세요'}}]},
  {id:'settings',title:'마을이 맞춰 둔 것',rows:[{text:'덜 추천하는 생활 · 찻집 주문',action:null}],note:'단추가 없는 줄은 마을 안 이웃 수첩에서 바꿀 수 있어요.'},
  {id:'eval',title:'마을을 낫게 하는 데 쓰는 기록',lines:['쓰지 않고 있어요. 안 써도 마을은 똑같아요.'],actions:[{type:'EVAL_CONSENT',payload:{state:'granted',ver:'town-eval-signals-1'},label:'좋아요'}],detail:{title:'자세히 제목',rows:[{label:'보관',text:'30일이 지나면 지웁니다.'}]}},
  {id:'clear',title:'맞춤 기록 모두 비우기',lines:['요즘 자주 한 생활, 남긴 응답, 본 것 기록을 비워요.'],actions:[{type:'MEMORY_CLEAR',payload:{},label:'비우기',confirm:'맞춤 기록을 모두 비울까요?'}]}],...more}});

test('the card draws each state, escapes what it shows and gives every control a key (no button for a row the card cannot change)',async()=>{
  const {townRecordsHtml,townRecordsState}=await loaded,html=state=>townRecordsHtml({...townRecordsState(),...state});
  assert.match(html({phase:'loading'}),/불러오고 있어요/);
  assert.match(html({phase:'failed'}),/data-town="retry"/);
  assert.match(html({phase:'ready',records:{available:false}}),/아직 쓸 수 없어요/);
  const empty=html({phase:'ready',records:{available:true,started:false}});assert.match(empty,/싱크타운에 들어가면/);assert.doesNotMatch(empty,/<button/);
  const ready=html({phase:'ready',records:card().records});
  assert.ok(ready.includes('&lt;b&gt;찻집 일&lt;/b&gt;')&&!ready.includes('<b>찻집 일</b>'),'escaped');
  assert.deepEqual([...ready.matchAll(/data-town="([^"]+)"/g)].map(m=>m[1]),['known.r0','eval.a0','eval.more','clear.a0'],'the less-often row has no button');
  assert.match(ready,/aria-expanded="false">자세히</);assert.doesNotMatch(ready,/자세히 제목/);
  assert.match(html({phase:'ready',records:card().records,open:['eval']}),/자세히 제목[\s\S]*30일이 지나면 지웁니다/);
  assert.equal((html({phase:'ready',records:card().records,busy:'known.r0'}).match(/ disabled/g)||[]).length,3,'every rights button waits while one is on its way');
  assert.match(townRecordsHtml({...townRecordsState(),phase:'ready',records:card().records},{classes:{button:'ghost-button'},headingLevel:3}),/<h3 id="town-records-known">[\s\S]*class="ghost-button"/);
});

test('a press sends the rights command at the card\'s revision, asks once more where the section says so, and shows what it did',async()=>{
  const {createTownRecords}=await loaded,sent=[],asked=[];let answer=true,revision=4;
  const town=createTownRecords({load:async()=>card(revision),send:async command=>{sent.push(command);return card(++revision);},confirm:async question=>{asked.push(question);return answer;},randomId:()=>'id-'+sent.length});
  await town.refresh();assert.equal(town.state().phase,'ready');
  await town.press('known.r0');
  assert.deepEqual(sent,[{id:'id-0',type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'20749.tea-order'},expectedRevision:4}]);
  assert.equal(town.state().records.revision,5);assert.equal(town.state().message.text,'그 주민의 기억에서 뺐어요.');
  answer=false;await town.press('clear.a0');assert.equal(sent.length,1,'cancelled');assert.deepEqual(asked,[{title:'맞춤 기록을 모두 비울까요?',body:[],ok:'비우기'}]);
  answer=true;await town.press('clear.a0');assert.equal(sent.at(-1).type,'MEMORY_CLEAR');assert.equal(sent.at(-1).expectedRevision,5);
  await town.press('eval.more');assert.deepEqual(town.state().open,['eval']);await town.press('eval.more');assert.deepEqual(town.state().open,[]);
  await town.press('settings.r0');await town.press('nothing.a9');assert.equal(sent.length,2,'no command for a row without a button or an unknown key');
});

test('a stale revision reloads the card with the reason; a reply that comes after reset() changes nothing; a failed first read can be retried',async()=>{
  const {createTownRecords}=await loaded;let reads=0,release;
  const stale=createTownRecords({load:async()=>card(4+reads++),send:async()=>{throw Object.assign(new Error('x'),{code:'stale-command'});},confirm:async()=>true,randomId:()=>'r'});
  await stale.refresh();await stale.press('known.r0');
  assert.equal(reads,2);assert.equal(stale.state().records.revision,5);assert.equal(stale.state().message.text,'다른 곳에서 먼저 바뀌었어요. 지금 기록을 다시 불러왔어요.');
  const late=createTownRecords({load:()=>new Promise(resolve=>{release=resolve;}),send:async()=>card(),confirm:async()=>true});
  const pending=late.refresh();late.reset();release(card());await pending;assert.equal(late.state().records,null);assert.equal(late.state().phase,'idle');
  let fail=true;const flaky=createTownRecords({load:async()=>{if(fail)throw Object.assign(new Error('x'),{code:'NETWORK',retryable:true});return card();},send:async()=>card(),confirm:async()=>true});
  await flaky.refresh();assert.equal(flaky.state().phase,'failed');fail=false;await flaky.press('retry');assert.equal(flaky.state().phase,'ready');
  const academy=createTownRecords({load:async()=>card(),send:async()=>{throw Object.assign(new Error('x'),{code:'eval-consent-academy'});},confirm:async()=>true});
  await academy.refresh();await academy.press('eval.a0');assert.equal(academy.state().message.text,'학원 소속 계정에는 묻지 않아요.');assert.equal(academy.state().message.tone,'error');
});

test('the records download joins every town page under the first page\'s cutoff and refuses a page that does not move',async()=>{
  const {townExport}=await loaded;
  assert.equal(await townExport(null,async()=>{throw new Error('not called');}),null,'no town tables: null');
  const first={state:null,world:{revision:3},seen:null,evalSignals:[],entry:null,commands:[{command_id:'a'}],events:[{stream:'town',seq:1}],exportAt:'2026-10-28T00:00:00.000Z',afterCommand:'a',afterEvent:'town:1',hasMore:true};
  const asked=[],pages=[{commands:[{command_id:'b'}],events:[],exportAt:first.exportAt,afterCommand:'b',afterEvent:'town:1',hasMore:true},{commands:[],events:[{stream:'trail',seq:2}],exportAt:first.exportAt,afterCommand:'b',afterEvent:'trail:2',hasMore:false}];
  const whole=await townExport(first,async page=>{asked.push(page);return {town:pages.shift()};});
  assert.deepEqual(asked,[{afterCommand:'a',afterEvent:'town:1',at:first.exportAt},{afterCommand:'b',afterEvent:'town:1',at:first.exportAt}]);
  assert.deepEqual(whole.commands.map(row=>row.command_id),['a','b']);assert.deepEqual(whole.events.map(row=>row.seq),[1,2]);
  assert.equal(whole.world.revision,3);assert.ok(!('hasMore' in whole)&&!('afterCommand' in whole),'the joined file has no cursors');
  await assert.rejects(townExport({...first},async()=>({town:{commands:[],events:[],afterCommand:'a',afterEvent:'town:1',hasMore:true}})),{code:'EXPORT_BROKEN'});
});
