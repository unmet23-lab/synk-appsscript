'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
// Also run against the extracted installed payload. These assertions concern
// consent and storage, independently of its deliberately held app catalogue.
const renderer=process.env.SYNK_AUDIT_RENDERER||path.resolve(__dirname,'../renderer');
const load=name=>import(pathToFileURL(path.join(renderer,name)).href);
let engine=require('../../atlas/personalization');
if(process.env.SYNK_AUDIT_ASSETS){
  const fs=require('node:fs'),vm=require('node:vm');
  // Run the packaged UMD browser entry in this test's isolated JS realm. CJS
  // sidecars are intentionally not part of the launcher's browser payload.
  for(const name of ['engine.js','personalization.js'])vm.runInThisContext('(function(module,exports,require){\n'+fs.readFileSync(path.join(process.env.SYNK_AUDIT_ASSETS,name),'utf8')+'\n})(undefined,undefined,undefined);',{filename:'installed-launcher/'+name});
  engine=globalThis.SynkAtlasPersonalization;assert.ok(engine);
}
const at='2026-10-31T00:00:00.000Z';
const selection={context:'teacher',goal:'clarity',textSize:'large',explanation:'brief',motion:'reduced',consent:true};
async function fixture(){const mod=await load('personalization.mjs'),store=new Map(),writes=[];const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>{writes.push(key);store.set(key,value);},removeItem:key=>store.delete(key)};return{...mod,store,writes,storage,host:mod.createPlatformPersonalization(engine,storage,{clock:()=>at})};}
test('first start and temporary purpose write no profile and leave consent inactive',async()=>{
  const f=await fixture(),before=f.host.current();assert.equal(before.active,false);assert.equal(f.store.size,0);assert.equal(f.writes.length,0);
  const preview=f.previewPurpose(before,'creator',['world','messenger']);assert.equal(preview.sessionOnly,true);assert.deepEqual(preview.order,['messenger','world']);assert.equal(f.host.current().active,false);assert.equal(f.store.size,0);
  assert.throws(()=>f.host.save({...selection,consent:false}),/동의/);assert.equal(f.writes.length,0);
});
test('explicit consent alone persists a declared preference and each purpose changes the recommendation',async()=>{
  const f=await fixture();for(const [context,goal,expected]of[['student','study','world'],['teacher','clarity','teacher'],['work','work','messenger'],['career','prepare','path']]){const r=f.host.save({...selection,context,goal});assert.equal(r.active,true);assert.equal(r.selected,expected);assert.equal(r.order[0],expected);assert.equal(r.provenance.goal.source,'self-declared');assert.equal(r.plan.selected.canLaunch,undefined);assert.equal(r.plan.selected.installer,undefined);}
  assert.equal(f.store.size,1);assert.equal(new Set(f.writes).size,1);
});
test('view preferences reject private fields and unknown app identifiers',async()=>{
  const {parsePreferences,APP_IDS}=await load('state.mjs');const raw={selected:'not-an-app',favorites:['world','world','not-an-app'],density:'invalid',lastLaunch:{world:'invalid',messenger:123,'not-an-app':55},token:'secret',accountId:'private',studentNotes:'private'},r=parsePreferences(JSON.stringify(raw));
  assert.deepEqual(Object.keys(r).sort(),['density','favorites','lastLaunch','selected']);assert.equal(r.selected,'world');assert.deepEqual(r.favorites,['world']);assert.equal(r.density,'comfortable');assert.deepEqual(Object.keys(r.lastLaunch).sort(),[...APP_IDS].sort());assert.equal(r.lastLaunch.world,null);assert.equal(r.lastLaunch.messenger,123);assert.equal(r.token,undefined);assert.equal(r.accountId,undefined);assert.equal(r.studentNotes,undefined);
});
