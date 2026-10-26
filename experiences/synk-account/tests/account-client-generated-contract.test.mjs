import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountClient} from '../src/generated/account-client.cjs';

const config={url:'https://account.example.test',anonKey:'public-synthetic',product:'world',getAccessToken:()=> 'synthetic-current',guard(){}};
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});

test('generated SDK keeps authenticated wardrobe read and save endpoints',async()=>{
 const calls=[],client=createAccountClient({...config,fetch:async(...args)=>{calls.push(args);return response({ok:true});}});
 await client.wardrobeLoad();await client.wardrobeSave({state:{worn:[]},expected_revision:3});
 assert.deepEqual(calls.map(([url,options])=>[url,options.method]),[['https://account.example.test/functions/v1/synk-wardrobe','GET'],['https://account.example.test/functions/v1/synk-wardrobe','POST']]);
 assert.ok(calls.every(([,options])=>options.headers.Authorization==='Bearer synthetic-current'));
 assert.deepEqual(JSON.parse(calls[1][1].body),{action:'save',state:{worn:[]},expected_revision:3});
});

test('unnamed 429 and server errors stay retryable service failures, not account deletion',async()=>{
 for(const status of [429,500,503]){
  const client=createAccountClient({...config,fetch:async()=>response({ok:false},status)});
  await assert.rejects(client.load(),{code:'SERVICE_UNAVAILABLE',retryable:true,status});
 }
});

test('native transport abort stays retryable across account, play and wardrobe methods',async()=>{
 const client=createAccountClient({...config,fetch:async()=>{throw new DOMException('Synthetic interruption','AbortError');}});
 for(const request of [()=>client.load(),()=>client.play.load(),()=>client.play.mutate({action:'wallet'}),()=>client.wardrobeLoad(),()=>client.wardrobeSave({state:{},expected_revision:0})]){
  await assert.rejects(request(),{code:'NETWORK',retryable:true});
 }
});
