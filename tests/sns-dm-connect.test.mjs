import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTalkConnection,installTalkConnection} from '../tools/sns-dm-connect.mjs';
const config={projectRef:'a'.repeat(20),serviceRoleKey:'synthetic_service_key_'.repeat(3)};
test('connection proof uses an authenticated invalid folder request without registering or revealing credentials',async()=>{
  const calls=[];const result=await verifyTalkConnection(config,{fetchImpl:async(url,options)=>{
    calls.push({url,body:options.body});assert.equal(options.body,'{}');assert.equal(options.headers.Authorization,'Bearer '+config.serviceRoleKey);
    return Response.json({ok:false,error:'invalid_folder'},{status:400});
  }});
  assert.equal(result.verified,true);assert.equal(calls.length,1);assert.ok(!JSON.stringify(result).includes(config.serviceRoleKey));
});
test('installation authenticates before opening the store and uses the encrypted secret API only',async()=>{
  const steps=[];let saved;
  const result=await installTalkConnection(config,{dataDir:process.cwd(),fetchImpl:async()=>{
    steps.push('probe');return Response.json({ok:false,error:'invalid_folder'},{status:400});},
    storeFactory:()=>{steps.push('open');return {setSecret:(key,value)=>{assert.equal(key,'social-dm-talk');saved=value;steps.push('encrypted');},
      secret:()=>saved,close:()=>steps.push('close')};}});
  assert.deepEqual(steps,['probe','open','encrypted','close']);assert.equal(result.registered,false);
  assert.ok(!JSON.stringify(result).includes(config.serviceRoleKey));
});
test('failed credential proof, ambiguous errors, or arbitrary hosts never install',async()=>{
  let opened=0;
  for(const status of [200,401,503]){
    await assert.rejects(installTalkConnection(config,{dataDir:process.cwd(),fetchImpl:async()=>Response.json({ok:false,error:'private failure'},{status}),
      storeFactory:()=>{opened++;throw Error();}}));}
  await assert.rejects(verifyTalkConnection({...config,projectRef:'https://attacker.test'},{fetchImpl:async()=>{throw Error('must not request');}}));
  assert.equal(opened,0);
});
