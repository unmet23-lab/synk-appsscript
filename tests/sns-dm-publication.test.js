'use strict';
const {test,afterEach}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const publisher=require('../tools/lib/sns-publisher.js');
const {normalizeDm}=require('../tools/lib/sns-dm.js');
const dirs=[];
afterEach(()=>{for(const dir of dirs.splice(0)){assert(path.resolve(dir).startsWith(path.resolve(publisher.REPO_ROOT,'tmp')+path.sep));fs.rmSync(dir,{recursive:true,force:true});}});
function fixture(){
 const base=path.join(publisher.REPO_ROOT,'tmp');fs.mkdirSync(base,{recursive:true});
 const dir=fs.mkdtempSync(path.join(base,'sns-dm-test-'));dirs.push(dir);
 const folder=path.join(dir,'01-test-instagram');fs.mkdirSync(folder);
 const accounts=path.join(dir,'accounts.json'),plan=path.join(dir,'plan.json'),source=path.join(folder,'원고.json');
 const dm={account_id:'100001',title:'확정 자료',keyword:'자료',message:'승인 자료 안내',duration_mode:'evergreen',ends_at:null,
 resource:{kind:'url',url:'https://synk.im/builds/manual/',folder_id:'fixture_post_folder',library_root:'fixture_library_root'},
 public_reply_text:null,conversation_config:{}};
 fs.writeFileSync(accounts,JSON.stringify({accounts:{'test-instagram':{platform:'instagram',handle:'@fixture',publisher:'direct-after-connection',connection:'fixture'}}}));
 const raw={id:'01-test-instagram',platform:'instagram',title:'확정 게시물',caption:'승인된 본문',dm};
 fs.writeFileSync(source,JSON.stringify(raw));fs.writeFileSync(path.join(folder,'upload-1.png'),'fake image bytes');
 publisher.buildPlan({root:dir,accountsFile:accounts,outputFile:plan});
 const approve=()=>publisher.approvePlan(plan,['01-test-instagram'],'정확한 게시와 자료 전달 승인',{readCredentialImpl:()=>{throw Error('Instagram browser approval must not need publish credentials');}});
 const receipt=(url='https://www.instagram.com/reel/FixtureA/')=>publisher.recordInstagramPublication(plan,'01-test-instagram',url,'브라우저에서 승인 게시물 확인');
 const handoff=()=>publisher.dmPublicationHandoff(plan,'01-test-instagram');
 return {dir,folder,plan,source,raw,dm,approve,receipt,handoff};
}
test('DM settings are carried from content package through approved browser receipt to stable registration handoff',()=>{
 const f=fixture();f.approve();const receipt=f.receipt();assert.equal(receipt.item.state,'browser-published');
 const h=f.handoff();assert.equal(h.campaign.resource.url,f.dm.resource.url);assert.equal(h.post_url,'https://www.instagram.com/p/FixtureA/');
 assert.match(h.campaign.campaign_id,/^pub-[a-f0-9]{40}$/);assert.deepEqual(f.handoff(),h);
 assert.deepEqual(f.receipt(),receipt,'same URL receipt is idempotent');
});
test('browser publication and source handoff both require current approval',()=>{const f=fixture();assert.throws(f.receipt,/승인/);assert.throws(f.handoff,/승인/);});

test('approval review includes exact resource, lifetime, public copy and every FAQ answer',()=>{
 const f=fixture(),plan=JSON.parse(fs.readFileSync(f.plan));
 plan.items[0].dm.public_reply_text='요청한 자료를 DM으로 보내 드려요.';
 plan.items[0].dm.conversation_config={version:1,faqs:[{id:'usage',questions:['사용 방법은'],answer:'자료 첫 화면의 안내를 따라 주세요.'}]};
 const review=publisher.renderPlanMarkdown(plan);
 assert(review.includes(JSON.stringify(normalizeDm(plan.items[0].dm),null,2)));
 assert(review.includes('댓글 DM 자료 연결 — 01-test-instagram'));
 assert(review.includes('게시 계정: @fixture'));
});
test('changed resource URL, lifetime, FAQ, public reply or opening mode invalidates publication approval',async t=>{
 for(const key of ['resource','duration_mode','conversation_config','public_reply_text','opening_mode'])await t.test(key,()=>{
  const f=fixture();f.approve();f.receipt();const p=JSON.parse(fs.readFileSync(f.plan));
  if(key==='resource')p.items[0].dm.resource.url='https://synk.im/other/';
  else if(key==='duration_mode'){p.items[0].dm.duration_mode='fixed';p.items[0].dm.ends_at=new Date(Date.now()+86400000).toISOString();}
  else if(key==='opening_mode')p.items[0].dm.opening_mode='resource';
  else p.items[0].dm[key]=key==='conversation_config'?{version:1,faqs:[{id:'changed',questions:['질문'],answer:'변경'}]}:'변경';
  fs.writeFileSync(f.plan,JSON.stringify(p));assert.throws(f.handoff,/바뀌었/);
 });
});
test('changed source or media rejects handoff even with old valid receipt',()=>{const f=fixture();f.approve();f.receipt();fs.appendFileSync(path.join(f.folder,'upload-1.png'),'changed');assert.throws(f.handoff,/원본/);});
test('receipt cannot be moved to a different actual post or account',()=>{const f=fixture();f.approve();f.receipt();assert.throws(()=>f.receipt('https://www.instagram.com/p/Other/'),/덮어쓸/);const rp=publisher.resultFileFor(f.plan),r=JSON.parse(fs.readFileSync(rp));r.items['01-test-instagram'].account='@other';fs.writeFileSync(rp,JSON.stringify(r));assert.throws(f.handoff,/일치/);});
test('browser receipt rejects profile links and missing approval evidence',()=>{const f=fixture();f.approve();assert.throws(()=>f.receipt('https://www.instagram.com/fixture/'),/게시물/);assert.throws(()=>publisher.recordInstagramPublication(f.plan,'01-test-instagram','https://www.instagram.com/p/FixtureA/',''),/근거/);});
test('Drive configuration requires an approved file-content hash and does not accept a bare ambiguous file name',()=>{const f=fixture();assert.throws(()=>normalizeDm({...f.dm,resource:{kind:'drive',file_id:'fixture_material_file',folder_id:'fixture_post_folder',library_root:'fixture_library_root'}}),/지문/);});

test('unregisterable duration, source URLs and FAQ are rejected before publication approval',async t=>{
 const invalids=[
  d=>{d.duration_mode='fixed';d.ends_at=new Date(Date.now()+31*86400000).toISOString();},
  d=>{d.duration_mode='fixed';d.ends_at=new Date(Date.now()-86400000).toISOString();},
  d=>{d.resource.url='https://drive.google.com/file/d/fixture_material_file/view';},
  d=>{d.resource.url='https://127.0.0.1/private';},
  d=>{d.public_reply_text='자세한 자료는 www.example.com';},
  d=>{d.conversation_config={version:1,faqs:[{id:'faq',questions:['사용 방법'],answer:'https://example.com'}]};},
  d=>{d.conversation_config={version:1,faqs:[{id:'faq',questions:['사용 방법','사용  방법'],answer:'자료 안내대로 사용해 주세요.'}]};},
  d=>{d.conversation_config={version:1,faqs:[{id:'faq',questions:['사용 방법'],answer:'password: fixture-only'}]};}
 ];
 for(let i=0;i<invalids.length;i++)await t.test('invalid input '+i,()=>{const f=fixture(),raw=structuredClone(f.raw);invalids[i](raw.dm);fs.writeFileSync(f.source,JSON.stringify(raw));assert.throws(()=>publisher.buildPlan({root:f.dir,accountsFile:path.join(f.dir,'accounts.json'),outputFile:f.plan}));});
});

test('operator preparation command builds Drive metadata binding from actual bytes without manually authoring JSON',()=>{
 const f=fixture(),material=path.join(f.dir,'자료.txt');fs.writeFileSync(material,'승인할 실제 자료');
 const result=require('../tools/sns-DM준비.js').main(['--원고',f.source,'--계정ID','100001','--자료명','정확한 자료','--키워드','자료','--문구','확인한 안내',
 '--자료ID','fixture_material_file','--자료원본',material,'--자료폴더','fixture_post_folder','--자료함','fixture_library_root','--상시']);
 assert.deepEqual(result,{configured:true,kind:'drive',duration_mode:'evergreen',approval_required:true});
 const raw=JSON.parse(fs.readFileSync(f.source));assert.equal(raw.dm.resource.sha256,require('node:crypto').createHash('sha256').update('승인할 실제 자료').digest('hex'));assert.equal(raw.caption,f.raw.caption);
 assert.equal(raw.dm.opening_mode,'resource');
});
test('new preparation defaults to direct delivery through approval and handoff while explicit text remains available',async t=>{
 for(const [extra,mode] of [[[],'resource'],[['--바로전달'],'resource'],[['--전달방식','text'],'text']])await t.test(mode+' '+extra.join(' '),()=>{
  const f=fixture();
  require('../tools/sns-DM준비.js').main(['--원고',f.source,'--계정ID','100001','--자료명','정확한 자료','--키워드','자료','--문구','확인한 안내',
   '--자료URL','https://synk.im/builds/manual/','--자료폴더','fixture_post_folder','--자료함','fixture_library_root','--상시',...extra]);
  publisher.buildPlan({root:f.dir,accountsFile:path.join(f.dir,'accounts.json'),outputFile:f.plan});f.approve();f.receipt();
  assert.equal(f.handoff().campaign.opening_mode,mode);
 });
});
test('legacy approved input keeps an omitted opening mode and explicit text unchanged',()=>{
 const f=fixture();assert.deepEqual(normalizeDm(f.dm),f.dm);
 const explicit={...f.dm,opening_mode:'text'};assert.deepEqual(normalizeDm(explicit),explicit);
 f.approve();f.receipt();assert.equal(Object.hasOwn(f.handoff().campaign,'opening_mode'),false);
});
test('conflicting preparation modes are rejected before changing the source',()=>{
 const f=fixture(),before=fs.readFileSync(f.source,'utf8');
 assert.throws(()=>require('../tools/sns-DM준비.js').configure(f.source,{url:'https://synk.im/',evergreen:true,direct:true,openingMode:'text'}),/함께/);
 assert.equal(fs.readFileSync(f.source,'utf8'),before);
});
test('an omitted or unknown explicit preparation mode cannot silently use the direct default',()=>{
 const f=fixture(),before=fs.readFileSync(f.source,'utf8'),command=require('../tools/sns-DM준비.js');
 assert.throws(()=>command.main(['--원고',f.source,'--전달방식']),/text 또는 resource/);
 assert.throws(()=>command.main(['--원고',f.source,'--전달방식','automatic']),/text 또는 resource/);
 assert.equal(fs.readFileSync(f.source,'utf8'),before);
});
test('preparation rejects ambiguous lifetime/material choice and preserves original source',()=>{
 const f=fixture(),before=fs.readFileSync(f.source,'utf8');assert.throws(()=>require('../tools/sns-DM준비.js').configure(f.source,{url:'https://synk.im/',fileId:'fixture_material_file'}));assert.equal(fs.readFileSync(f.source,'utf8'),before);
});
