'use strict';
require('./preload-candidate.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../../../..'),out=path.join(root,'.tmp/tutor-life-backend-20261012');
const candidate=require(path.join(out,'candidate-runtime.cjs')),baseline=require(path.join(out,'rollback-runtime.cjs'));
const key='synk.life-korean.progress.v1';
test('candidate differs from deployed v9 only by the canonical life record allowlist entry',()=>{
 const proof=JSON.parse(fs.readFileSync(path.join(out,'candidate-proof.json'),'utf8'));
 assert.equal(proof.candidate.runtimeExactSingleAllowlistAddition,true);assert.equal(proof.canonical.completePlayDataModuleEqualsCanonicalBuild,true);
 assert.deepEqual(candidate.model.PLAY_RECORD_KEYS,[...baseline.model.PLAY_RECORD_KEYS,key]);
 const before=fs.readFileSync(path.join(out,'rollback/synk-play-runtime.mjs'),'utf8'),after=fs.readFileSync(path.join(out,'candidate/synk-play-runtime.mjs'),'utf8');
 assert.equal(after.replace('      "synk.talk-rally.v1",\n      "synk.life-korean.progress.v1"\n','      "synk.talk-rally.v1"\n'),before);
});
test('exact deployable ESM imports and its model matches the tested CJS module',async()=>{
 const {default:runtime}=await import(pathToFileURL(path.join(out,'candidate/synk-play-runtime.mjs')).href);
 for(const name of ['createPlayService','createPlayStore','createAuthVerifier','awardAccountRace'])assert.equal(typeof runtime[name],'function');
 assert.deepEqual(runtime.model.PLAY_RECORD_KEYS,candidate.model.PLAY_RECORD_KEYS);
 assert.equal(runtime.model.validatePlayValue(key,'{"version":1}'),'{"version":1}');
});
test('deployed v9 rejects the life record before reaching database storage',async()=>{
 let touched=false;
 const handler=baseline.createPlayService({verify:async()=>({product:'world'}),store:{withAccount(){touched=true;throw Error('NO_DATABASE');}},model:baseline.model,economy:baseline.economy,enabled:()=>true});
 const response=await handler(new Request('https://synthetic.invalid/functions/v1/synk-play',{method:'POST',headers:{'content-type':'application/json','x-synk-product':'world','x-synk-contract':'1'},body:JSON.stringify({action:'progress',id:'00000000-0000-4000-8000-000000000001',changes:[{key,previous:null,value:'{"version":1}'}]})}));
 assert.equal(response.status,400);assert.equal((await response.json()).error.code,'INVALID_PLAY_STATE');assert.equal(touched,false);
});
test('new life record keeps previous bounds, secret rejection and CAS value validation',()=>{
 assert.deepEqual(candidate.model.validatePlayChanges([{key,previous:null,value:'{"version":1}'}]),[{key,previous:null,value:'{"version":1}'}]);
 for(const bad of ['{"refreshToken":"synthetic-secret"}','{"password":"synthetic-secret"}','{"n":',JSON.stringify({large:'a'.repeat(33000)})])assert.throws(()=>candidate.model.validatePlayValue(key,bad));
 assert.throws(()=>candidate.model.validatePlayChanges([{key,previous:'broken-json',value:'{}'}]));
 assert.throws(()=>candidate.model.validatePlayChanges([{key:'synk.oauth.session.world',previous:null,value:'{}'}]));
 for(const oldKey of baseline.model.PLAY_RECORD_KEYS){const value=oldKey==='synk.order-rush.flow-mode'?'auto':'{}';assert.equal(candidate.model.validatePlayValue(oldKey,value),baseline.model.validatePlayValue(oldKey,value));}
});
test('exact candidate retains disabled-by-default feature gating without storage access',async()=>{
 let touched=false;const handler=candidate.createPlayService({verify:async()=>({product:'world'}),store:{withAccount(){touched=true;}},model:candidate.model,economy:candidate.economy});
 const response=await handler(new Request('https://synthetic.invalid/functions/v1/synk-play',{headers:{'x-synk-product':'world','x-synk-contract':'1'}}));assert.equal(response.status,503);assert.equal((await response.json()).error.code,'PLAY_UNAVAILABLE');assert.equal(touched,false);
});
