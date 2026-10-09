'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {requestSpec}=require('../src/account-requests.cjs');
const id='00000000-0000-4000-8000-000000000001';
test('only the authenticated WORLD client can request fixed play operations',()=>{
 assert.deepEqual(requestSpec('playLoad',{},'1','world','world'),{path:'synk-play'});
 const body={action:'wallet',id,method:'buyItem',args:['magic-toys-picnic']};assert.deepEqual(requestSpec('playMutate',body,'1','world','world'),{path:'synk-play',body});
 for(const [product,key]of [['platform','platform'],['world','care'],['messenger','world']])assert.throws(()=>requestSpec('playLoad',{},'1',product,key),{code:'INVALID_REQUEST'});
});
test('play IPC cannot override endpoint or owner and rejects malformed/oversized commands',()=>{
 const base={action:'progress',id,changes:[{key:'synk.word-magic.progress.v1',previous:null,value:'{}'}]};assert.equal(requestSpec('playMutate',base,'1','world','world').path,'synk-play');
 for(const body of [{...base,url:'https://evil.invalid'},{...base,accountId:'someone'},{...base,id:'bad'},{...base,changes:[{key:'x',previous:[],value:'{}'}]},{...base,changes:[{key:'x',previous:null,value:'x'.repeat(3*1024*1024)}]},{action:'wallet',id,method:'save',args:[{coins:1000}]}])assert.throws(()=>requestSpec('playMutate',body,'1','world','world'),{code:'INVALID_REQUEST'});
});
