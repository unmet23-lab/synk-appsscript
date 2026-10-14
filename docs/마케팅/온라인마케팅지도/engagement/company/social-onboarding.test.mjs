import test from 'node:test';
import assert from 'node:assert/strict';
import {socialOnboarding} from './social-onboarding.mjs';
const now=Date.parse('2026-10-14T00:00:00Z');
const base=()=>({channels:[{id:'ig',platform:'instagram',active:true,capability:{mode:'manual',canPublish:false}}],jobs:[],posts:[],provider:{configured:false},tracking:{links:[]},runtime:{enabled:false}});
const setup=data=>socialOnboarding(data,{origin:'https://workspace.example.test',now});
const get=(data,id)=>setup(data).channels[0].steps.find(s=>s.id===id);
test('setup remains incomplete without credentials and a saved configuration is distinct from proof',()=>{
  const d=base();assert.equal(get(d,'connection').status,'pending');d.provider.configured=true;
  assert.equal(get(d,'connection').status,'configured');assert.equal(get(d,'publishing').status,'pending');assert.equal(get(d,'publication').status,'pending');
});
test('publishing connection requires fresh API and current listed profile',()=>{
  const d=base();d.channels[0].capability={mode:'automatic',canPublish:true};d.connectionHealth={api:{state:'connected',stale:false},channels:[{channelId:'ig',state:'listed',stale:false}]};
  assert.equal(get(d,'publishing').status,'checked');d.connectionHealth.channels[0].stale=true;assert.equal(get(d,'publishing').status,'checking');d.connectionHealth.channels[0].stale=false;d.connectionHealth.api.state='error';assert.equal(get(d,'publishing').status,'checking');
});
test('comment collection and reply permissions are checked separately and unsupported platforms are explicit',()=>{
  const d=base();d.inboxHealth={channels:[{channelId:'ig',state:'connected',stale:false,canReply:true}]};d.inboxProvider={channels:[{channelId:'ig',enabled:true,available:true}]};assert.equal(get(d,'comments').status,'checked');
  d.inboxProvider.channels[0].enabled=false;assert.equal(get(d,'comments').status,'pending');d.channels[0].platform='youtube';assert.equal(get(d,'comments').status,'unsupported');
});
test('site events and verified completion are never inferred from link creation or another account',()=>{
  const d=base();d.tracking.links=[{id:'l',channelId:'other',active:true,stats:{siteEventsSeen:true,serverEventsSeen:true}}];assert.equal(get(d,'measurement').status,'pending');
  d.tracking.links.push({id:'own',channelId:'ig',active:true,stats:{}});assert.equal(get(d,'measurement').status,'checking');
  d.tracking.links[1].stats.siteEventsSeen=true;assert.equal(get(d,'measurement').status,'partial');d.tracking.links[1].stats.serverEventsSeen=true;assert.equal(get(d,'measurement').status,'observed');
});
test('reserved, recorded publication and confirmed public result remain distinct',()=>{
  const d=base();d.jobs=[{channelId:'ig',status:'scheduled'}];assert.equal(get(d,'publication').status,'scheduled');
  Object.assign(d.jobs[0],{status:'published',publicationUrl:'https://www.instagram.com/p/fixture/',publishedAt:'2026-10-13T00:00:00Z'});assert.equal(get(d,'publication').status,'partial');
  d.jobs[0].publicVerifiedAt='2026-10-13T00:10:00Z';assert.equal(get(d,'publication').status,'observed');
});
test('local server is never presented as remote operation, stale and future runtime are unverified',()=>{
  const d=base();d.runtime={enabled:true,lastSuccessAt:'2026-10-14T00:00:00Z',intervalMs:15000};assert.equal(setup(d).server.status,'observed');assert.equal(socialOnboarding(d,{origin:'http://127.0.0.1:4191',now}).server.status,'local');
  d.runtime.lastSuccessAt='2026-10-13T20:00:00Z';assert.equal(setup(d).server.status,'checking');d.runtime.lastSuccessAt='2099-01-01T00:00:00Z';assert.equal(setup(d).server.status,'checking');
});
test('empty or inactive account list never produces fabricated progress',()=>{
  const d=base();d.channels[0].active=false;assert.equal(setup(d).empty,true);assert.deepEqual(setup(d).channels,[]);
});
test('direct publishing needs this account consent and explicit enable, not global configured state',()=>{
  const d=base();d.provider={mode:'direct',configured:true,channels:[{channelId:'ig',supported:true,connected:false,enabled:false}]};
  assert.equal(get(d,'connection').status,'pending');assert.equal(get(d,'publishing').status,'pending');
  d.provider.channels[0].connected=true;assert.equal(get(d,'connection').status,'configured');assert.equal(get(d,'publishing').status,'pending');
  d.provider.channels[0].enabled=true;d.channels[0].capability={mode:'automatic',canPublish:true};
  d.connectionHealth={api:{state:'connected'},channels:[{channelId:'ig',state:'connected',checkedAt:'2026-10-14T00:00:00Z'}]};
  assert.equal(get(d,'publishing').status,'checked');assert.equal(get(d,'publication').status,'pending');
  d.connectionHealth.channels[0].checkedAt=null;assert.equal(get(d,'publishing').status,'checking');
  d.connectionHealth.channels[0].checkedAt='2026-10-13T23:00:00Z';assert.equal(get(d,'publishing').status,'checking');
  d.connectionHealth.channels[0].checkedAt='2026-10-14T01:00:00Z';assert.equal(get(d,'publishing').status,'checking');
});
test('unsupported direct channels skip connection steps and retain the manual publishing path',()=>{
  const d=base();d.channels[0].platform='tiktok';d.provider={provider:'direct',configured:true,channels:[{channelId:'ig',supported:false}]};
  assert.equal(get(d,'connection').status,'unsupported');assert.equal(get(d,'publishing').status,'unsupported');
  assert.match(get(d,'publishing').detail,/앱에서 마무리/);assert.equal(setup(d).channels[0].nextStepId,'publication');
});
