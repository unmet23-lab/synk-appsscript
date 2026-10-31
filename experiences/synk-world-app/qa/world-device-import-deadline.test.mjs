import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),acorn=require('acorn'),source=fs.readFileSync(new URL('../world-game-host.mjs',import.meta.url),'utf8'),found=[],stack=[acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'})];
while(stack.length){const n=stack.pop();if(!n||typeof n!=='object')continue;if(n.type==='FunctionDeclaration'&&n.id?.name==='importDeviceLearning')found.push(n);for(const value of Object.values(n))if(value&&typeof value==='object')stack.push(...(Array.isArray(value)?value:[value]));}
assert.equal(found.length,1);const body=source.slice(found[0].start,found[0].end);
const make=learnHost=>new Function('check','engine','scopedStorage','storage','accountKey','revision','connected','learnHost','return '+body)(()=>{},{createGame:()=>({syncPort:{importEvents:()=>({added:1,skipped:[]})}})},value=>value,{},'synthetic-account',1,true,learnHost);
test('the device import deadline includes a retry that never settles',async()=>{
 const move=make({preferences(){},retry:()=>new Promise(()=>{}),status:()=>({phase:'syncing',queued:1})});let timer;
 try{const result=await Promise.race([move([{}],{timeoutMs:10,pollMs:1}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Import exceeded its retry deadline')),150);})]);assert.deepEqual(result,{added:1,skipped:0,confirmed:false,code:'TIMEOUT'});}finally{clearTimeout(timer);}
});
test('a rejected retry still allows an already confirmed status to be verified',async()=>{
 const move=make({preferences(){},retry:async()=>{throw Error('synthetic retry unavailable');},status:()=>({phase:'synced',queued:0})});assert.deepEqual(await move([{}],{timeoutMs:100,pollMs:1}),{added:1,skipped:0,confirmed:true});
});
test('a pending retry still preserves independently confirmed synchronization',async()=>{
 const move=make({preferences(){},retry:()=>new Promise(()=>{}),status:()=>({phase:'synced',queued:0})});assert.deepEqual(await move([{}],{timeoutMs:10,pollMs:1}),{added:1,skipped:0,confirmed:true});
});
test('a settled retry and polling share the same bounded deadline',async()=>{
 let polls=0;const start=Date.now(),move=make({preferences(){},retry:async()=>{},status:()=>{polls++;return {phase:'syncing',queued:1};}});
 assert.deepEqual(await move([{}],{timeoutMs:10,pollMs:1000}),{added:1,skipped:0,confirmed:false,code:'TIMEOUT'});assert.ok(polls>=2);assert.ok(Date.now()-start<500,'the poll sleep uses the remaining deadline');
});
