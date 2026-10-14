import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialMarketingService} from './social-marketing.mjs';
import {createSocialSourceDistribution} from './social-source-distribution.mjs';

function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-source-'));let at='2026-10-13T00:00:00.000Z';const store=new Store(directory),clock=()=>at;
  const admin=store.createUser({email:'admin@source.test',name:'합성 관리자',role:'admin'}),other=store.createUser({email:'other@source.test',name:'외부 팀',role:'member',teamId:'b'});
  store.put('channels','x',{id:'x',platform:'x',ownerIds:[admin.id],teamId:'a',active:true});
  const studio=createStudioService({store,clock}),packages={list:()=>({packages:[]}),get:(user,id)=>{const row=store.get('studioPublicationPackages',id);if(!row)throw Object.assign(new Error('missing package'),{status:404});if(row.syntheticFailure)throw Object.assign(new Error('synthetic broken package'),{status:422});studio.production(user,row.productionId);return {package:row};}},marketing=createSocialMarketingService({store,studio,publicationPackages:packages,clock});
  const publishing=createSocialPublishingService({store,clock,provider:{capability:()=>({mode:'manual',formats:['text']})},validateSource:marketing.validateSource});
  const distribution=createSocialSourceDistribution({store,studio,publicationPackages:packages,marketing,publishing,clock});
  t.after(async()=>{await publishing.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-social-source-')));rmSync(directory,{recursive:true,force:true});});
  function production(title='합성 원고'){let p=studio.saveProduction(admin,{title,stage:'ready'}).production;return studio.addVersion(admin,p.id,{kind:'text',label:'확정 원고',text:'실제 저장된 문구'}).production;}
  function rule(scope='new',sourceId='studio:all',channelIds=['x']){const r=publishing.saveRule(admin,{title:'합성 규칙',sourceId,channelIds,scope,enabled:true,delayMinutes:30}).rule;distribution.initializeRule(admin,r.id);return r;}
  return {store,admin,other,studio,packages,marketing,publishing,distribution,production,rule,advance(){at=new Date(Date.parse(at)+60000).toISOString();}};
}

test('new sources use the rule baseline, preserve canonical text, and generate drafts once',async t=>{
  const f=fixture(t),old=f.production();f.rule('new');
  assert.equal((await f.distribution.scan()).created,0);
  f.advance();f.studio.addVersion(f.admin,old.id,{kind:'text',label:'다음 확정본',text:'수정한 확정 원고'});
  assert.equal((await f.distribution.scan()).created,1);
  assert.equal((await f.distribution.scan()).created,0);
  const posts=f.publishing.workspace(f.admin).posts;assert.equal(posts.length,1);assert.equal(posts[0].body,'수정한 확정 원고');assert.equal(posts[0].status,'draft');assert.equal(f.store.all('socialPublishJobs').length,0);
  assert.equal(f.store.all('socialSourceReceipts').length,1);
});
test('existing/all scopes and explicit source selection do not pick another production',async t=>{
  const f=fixture(t),a=f.production('A'),b=f.production('B');const rule=f.rule('existing','studio:'+a.id);
  assert.equal((await f.distribution.scan({user:f.admin,ruleId:rule.id})).created,1);
  f.advance();f.studio.addVersion(f.admin,a.id,{kind:'text',label:'새 버전',text:'새 원고'});
  assert.equal((await f.distribution.scan()).created,0);
  assert.equal(f.publishing.workspace(f.admin).posts[0].source.productionId,a.id);
  assert.notEqual(a.id,b.id);
});
test('each enabled rule is isolated and revoked owners stop creating drafts',async t=>{
  const f=fixture(t);f.production();const first=f.rule('all'),second=f.rule('all');
  assert.equal((await f.distribution.scan({user:f.admin,ruleId:first.id})).created,1);
  assert.equal(f.store.all('socialSourceReceipts')[0].ruleId,first.id);
  assert.equal(f.store.all('socialSourceReceipts').some(row=>row.ruleId===second.id),false);
  f.store.put('users',f.admin.id,{...f.admin,active:false});const result=await f.distribution.scan();assert.equal(result.created,0);assert.equal(result.failed,2);
  assert.match(f.store.get('socialSourceScanStatus',second.id).error,/권한/);
});
test('catalog and manual rule actions apply current permissions without exposing source bodies',async t=>{
  const f=fixture(t),p=f.production('private-source-title'),rule=f.rule('all');
  const view=f.distribution.workspace(f.other);assert.doesNotMatch(JSON.stringify(view),/private-source-title|실제 저장된 문구/);
  assert.throws(()=>f.distribution.initializeRule(f.other,rule.id),{status:403});
  await assert.rejects(()=>f.distribution.scan({user:f.other,ruleId:rule.id}),{status:403});
  assert.throws(()=>f.distribution.validateRuleSource(f.other,'studio:'+p.id),{status:403});
});
test('unconfirmed productions and cancelled scans never create drafts',async t=>{
  const f=fixture(t),p=f.production();f.rule('all');f.studio.saveProduction(f.admin,{stage:'review'},p.id);
  assert.equal((await f.distribution.scan()).created,0);
  f.studio.saveProduction(f.admin,{stage:'ready'},p.id);const controller=new AbortController();controller.abort();
  assert.equal((await f.distribution.scan({signal:controller.signal})).created,0);assert.equal(f.store.all('socialPosts').length,0);
});


function packageFixture(f,formats=['youtube-shorts','instagram-reels']){
  const p=f.studio.saveProduction(f.admin,{title:'플랫폼별 영상',stage:'ready'}).production,sourceId=randomUUID(),packageId=randomUUID();
  const media=id=>({id,productionId:p.id,mimeType:'video/mp4',fileName:'합성영상.mp4',diskName:id+'.mp4',byteSize:100,width:1080,height:1920,duration:15,sha256:'a'.repeat(64)});
  f.studio.addMedia(f.admin,p.id,media(sourceId),'확정 영상');const version=f.studio.production(f.admin,p.id).production.versions[0];
  const outputs=formats.map(channel=>{const mediaId=randomUUID();f.store.put('studioMedia',mediaId,media(mediaId));return {channel,mediaId};});
  const pack={id:packageId,productionId:p.id,versionId:version.id,title:'플랫폼별 묶음',body:'확정된 묶음 문구',state:'prepared',createdAt:'2026-10-13T00:00:00.000Z',source:{id:sourceId},outputs};
  f.store.put('studioPublicationPackages',packageId,pack);return {p,pack,sourceId};
}

test('package variants retain the exact Instagram Reels, YouTube Shorts and long-video media and performance format',async t=>{
  const f=fixture(t);for(const id of ['youtube','instagram'])f.store.put('channels',id,{id,platform:id,active:true,teamId:'a',ownerIds:[f.admin.id]});
  const short=packageFixture(f),long=packageFixture(f,['youtube-video','instagram-reels']);f.marketing.prepareMedia=async()=>({media:[]});
  const rule=f.rule('all','packages:all',['youtube','instagram']),result=await f.distribution.scan({user:f.admin,ruleId:rule.id});
  assert.equal(result.created,2);assert.equal(result.failed,0);
  for(const original of [short,long]){
    const post=f.publishing.workspace(f.admin).posts.find(p=>p.source.packageId===original.pack.id);
    for(const variant of post.variants){const output=original.pack.outputs.find(x=>x.channel.startsWith(variant.channelId+'-'));assert.equal(variant.media[0].assetId,output.mediaId);assert.equal(variant.publicationFormat,output.channel);assert.equal(variant.format,output.channel==='instagram-reels'?'reel':output.channel==='youtube-shorts'?'shorts':'video');}
    assert.equal(post.status,'draft');assert.equal(post.body,'확정된 묶음 문구');
  }
  assert.equal(f.store.all('socialPublishJobs').length,0);
});

test('a broken package does not block healthy Studio sources or healthy packages',async t=>{
  const f=fixture(t),goodText=f.production('정상 원고'),good=packageFixture(f),bad=packageFixture(f);f.marketing.prepareMedia=async()=>({media:[]});
  f.store.put('studioPublicationPackages',bad.pack.id,{...bad.pack,syntheticFailure:true});
  const studioRule=f.rule('all','studio:'+goodText.id),packageRule=f.rule('all','packages:all');
  assert.equal((await f.distribution.scan({user:f.admin,ruleId:studioRule.id})).created,1);
  const result=await f.distribution.scan({user:f.admin,ruleId:packageRule.id});assert.equal(result.created,1);assert.equal(result.failed,1);
  assert.ok(f.publishing.workspace(f.admin).posts.some(post=>post.source.packageId===good.pack.id));
  assert.doesNotThrow(()=>f.distribution.workspace(f.admin));
});

test('one media preparation failure leaves other confirmed sources eligible',async t=>{
  const f=fixture(t),bad=packageFixture(f),good=f.production('파일 없이 완성된 원고');f.marketing.prepareMedia=async()=>{throw Object.assign(new Error('synthetic missing file'),{status:404});};
  const rule=f.rule('all'),result=await f.distribution.scan({user:f.admin,ruleId:rule.id});
  assert.equal(result.failed,1);assert.equal(result.created,1);assert.equal(f.publishing.workspace(f.admin).posts[0].source.productionId,good.id);assert.notEqual(good.id,bad.p.id);
});

test('existing receipts still require current source authorization before deduplication is disclosed',async t=>{
  const f=fixture(t);f.production();const rule=f.rule('all');assert.equal((await f.distribution.scan({user:f.admin,ruleId:rule.id})).created,1);
  let receiptReads=0;const get=f.publishing.get;f.publishing.get=(...args)=>{receiptReads++;return get(...args);};
  f.marketing.validateSource=()=>{throw Object.assign(new Error('synthetic revoked source'),{status:403});};
  const result=await f.distribution.scan({user:f.admin,ruleId:rule.id});assert.equal(result.existing,0);assert.equal(result.failed,1);assert.equal(receiptReads,0);assert.equal(f.store.all('socialPosts').length,1);
});

test('a rule or confirmed-source change while preparing media prevents the obsolete draft',async t=>{
  for(const change of ['disabled','revision','source-review']){
    const f=fixture(t),source=packageFixture(f),rule=f.rule('all','studio:'+source.p.id);let release,started;const waiting=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
    f.marketing.prepareMedia=async()=>{started();await waiting;return {media:[]};};
    const pending=f.distribution.scan({user:f.admin,ruleId:rule.id,authorize:()=>f.admin});await began;
    if(change==='disabled')f.store.put('socialDistributionRules',rule.id,{...rule,enabled:false});
    if(change==='revision')f.store.put('socialDistributionRules',rule.id,{...rule,revision:rule.revision+1});
    if(change==='source-review')f.studio.saveProduction(f.admin,{stage:'review'},source.p.id);
    release();const result=await pending;assert.equal(result.created,0);assert.equal(f.store.all('socialPosts').length,0);assert.equal(f.store.all('socialSourceReceipts').length,0);
  }
});

test('a changed caller session after media preparation cannot use the still-authorized rule owner',async t=>{
  const f=fixture(t),source=packageFixture(f),rule=f.rule('all','studio:'+source.p.id);let release,started,sessionUser=f.admin;const waiting=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
  f.marketing.prepareMedia=async()=>{started();await waiting;return {media:[]};};
  const pending=f.distribution.scan({user:f.admin,ruleId:rule.id,authorize:()=>sessionUser});await began;sessionUser=f.other;release();
  await assert.rejects(pending,{status:401});assert.equal(f.store.all('socialPosts').length,0);assert.equal(f.store.all('socialSourceReceipts').length,0);
});

test('a rule edited while media is prepared stops quietly instead of reporting a file problem',async t=>{
  const f=fixture(t),source=packageFixture(f),rule=f.rule('all','studio:'+source.p.id);
  f.marketing.prepareMedia=async(owner,ids,{authorize})=>{f.store.put('socialDistributionRules',rule.id,{...f.store.get('socialDistributionRules',rule.id),revision:rule.revision+1});authorize();return {media:[]};};
  const result=await f.distribution.scan({user:f.admin,ruleId:rule.id,authorize:()=>f.admin});assert.equal(result.created,0);assert.equal(result.failed,0);
  assert.equal(f.store.all('socialPosts').length,0);assert.doesNotMatch(String(f.store.get('socialSourceScanStatus',rule.id)?.error||''),/파일·규격·권한/);
});
