'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createQaRun,readEvidence,freshness}=require('../tools/lib/qa-evidence.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-qa-evidence-'));fs.mkdirSync(path.join(root,'product'));fs.writeFileSync(path.join(root,'product/main.js'),'one');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const start=(root,env={})=>createQaRun({root,label:'test-product',sources:['product'],target:{product:'fixture',buildId:'fixture-v1'},env});
test('two runs with the same requested ID never overwrite one another or source evidence',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'product/qa'));fs.writeFileSync(path.join(root,'product/qa/approved.jpg'),'preserve');
 const a=start(root,{SYNK_QA_RUN_ID:'same'}),b=start(root,{SYNK_QA_RUN_ID:'same'});assert.notEqual(a.out,b.out);assert.notEqual(a.dataDirectory,b.dataDirectory);
 fs.writeFileSync(path.join(a.out,'screen.png'),'first');assert.equal(fs.existsSync(path.join(b.out,'screen.png')),false);assert.equal(fs.readFileSync(path.join(root,'product/qa/approved.jpg'),'utf8'),'preserve');
 a.finish({ok:true,checks:2});b.finish({ok:false,error:'expected fixture failure'});
 assert.equal(readEvidence({root,manifestPath:a.manifestPath}).status,'passed');assert.equal(readEvidence({root,manifestPath:b.manifestPath}).status,'failed');assert.equal(freshness({root,manifestPath:b.manifestPath}).state,'fresh');
});
test('content hash detects same-size changes even when mtime is restored',t=>{
 const root=fixture(t),run=start(root),file=path.join(root,'product/main.js'),before=fs.statSync(file);assert.equal(freshness({root,manifestPath:run.manifestPath}).state,'fresh');
 fs.writeFileSync(file,'two');fs.utimesSync(file,before.atime,before.mtime);const current=freshness({root,manifestPath:run.manifestPath});assert.equal(current.state,'stale');assert.deepEqual(current.changed,['product/main.js']);
 run.finish({ok:true});assert.equal(readEvidence({root,manifestPath:run.manifestPath}).finishedSource.state,'stale');
});
test('added and removed source files are detected while output captures do not change source state',t=>{
 const root=fixture(t),run=start(root);fs.writeFileSync(path.join(run.out,'result.json'),'{}');assert.equal(freshness({root,manifestPath:run.manifestPath}).state,'fresh');
 fs.writeFileSync(path.join(root,'product/new.css'),'body{}');fs.unlinkSync(path.join(root,'product/main.js'));const current=freshness({root,manifestPath:run.manifestPath});assert.deepEqual(current.added,['product/new.css']);assert.deepEqual(current.removed,['product/main.js']);
});
test('output cannot be redirected to source QA or escape the repository',t=>{
 const root=fixture(t);assert.throws(()=>start(root,{SYNK_QA_OUT:'product/qa'}),/output must/);assert.throws(()=>start(root,{SYNK_QA_OUT:'../outside'}),/outside/);assert.throws(()=>start(root,{SYNK_QA_RUN_ID:'../escape'}),/run ID/);
});
test('untrusted evidence source paths cannot read outside the supplied root',t=>{
 const root=fixture(t),run=start(root);const evidence=JSON.parse(fs.readFileSync(run.manifestPath));evidence.source.inputs=['../secret'];fs.writeFileSync(run.manifestPath,JSON.stringify(evidence));assert.equal(freshness({root,manifestPath:run.manifestPath}).state,'unavailable');
});
test('missing or unsupported evidence is unavailable, never a fresh successful result',t=>{
 const root=fixture(t);assert.equal(freshness({root,manifestPath:'.tmp/missing.json'}).state,'unavailable');const run=start(root);fs.writeFileSync(run.manifestPath,'{"schemaVersion":99}');assert.equal(freshness({root,manifestPath:run.manifestPath}).state,'unavailable');
});
test('a missing declared source prevents a misleading partial evidence scope',t=>{
 const root=fixture(t);assert.throws(()=>createQaRun({root,label:'missing',sources:['product','missing-module.js'],env:{}}),/Missing QA source/);
});
test('transitive literal local modules are included and become stale when a shared rule changes',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'shared'));fs.writeFileSync(path.join(root,'product/main.js'),"import {value} from '../shared/rule.mjs';");fs.writeFileSync(path.join(root,'shared/rule.mjs'),"export {value} from './value.mjs';");fs.writeFileSync(path.join(root,'shared/value.mjs'),'export const value=1;');
 const run=start(root);assert.ok(run.evidence.source.files.some(row=>row.path==='shared/value.mjs'));fs.writeFileSync(path.join(root,'shared/value.mjs'),'export const value=2;');assert.deepEqual(freshness({root,manifestPath:run.manifestPath}).changed,['shared/value.mjs']);
});
test('missing literal modules are reported and computed or remote paths are not guessed',t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'product/main.js'),"import './missing.mjs'; import('https://example.test/remote.mjs'); import('../shared/'+name); // require('../../outside')\n");
 const run=start(root);assert.deepEqual(run.evidence.source.missingDependencies,[{from:'product/main.js',specifier:'./missing.mjs'}]);assert.equal(freshness({root,manifestPath:run.manifestPath}).state,'fresh');
 fs.writeFileSync(path.join(root,'product/missing.mjs'),'export {};');assert.equal(freshness({root,manifestPath:run.manifestPath}).state,'stale');
});
test('a literal dependency cannot escape the root',t=>{
 const root=fixture(t);fs.writeFileSync(path.join(root,'product/main.js'),"import '../../outside.mjs';");assert.throws(()=>start(root),/outside/);
});

for (const declaration of ['import','export']) test('multiline '+declaration+' declarations track transitive shared modules',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'shared'));fs.writeFileSync(path.join(root,'product/main.js'),declaration+" {\n value\n} from '../shared/rule.mjs';");fs.writeFileSync(path.join(root,'shared/rule.mjs'),"export {\n value\n} from './value.mjs';");fs.writeFileSync(path.join(root,'shared/value.mjs'),'export const value=1;');
 const run=start(root);assert.ok(run.evidence.source.files.some(row=>row.path==='shared/rule.mjs'));assert.ok(run.evidence.source.files.some(row=>row.path==='shared/value.mjs'));fs.writeFileSync(path.join(root,'shared/value.mjs'),'export const value=2;');assert.deepEqual(freshness({root,manifestPath:run.manifestPath}).changed,['shared/value.mjs']);
});
