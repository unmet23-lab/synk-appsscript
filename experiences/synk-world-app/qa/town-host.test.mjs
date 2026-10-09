import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createAccountTownHost} from '../town-host.mjs';
import {confirmedAppearance} from '../world-town-client.mjs';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-town-test-'));
const host=createAccountTownHost({directory});
test('town host rejects missing or path-shaped identities',()=>{
  for(const id of [undefined,'','../player','player-a'])assert.throws(()=>host.handle(id,'state','GET'),/AUTH_REQUIRED/);
});
test('authenticated accounts own separate durable town fixtures',()=>{
  const a=host.handle(A,'state','GET'),b=host.handle(B,'state','GET');assert.equal(a.status,200);assert.equal(b.status,200);
  const changed=host.handle(A,'command','POST',{id:'account-a-choice',type:'CHOOSE',payload:{branch:'inside'},expectedRevision:a.body.state.revision});
  assert.equal(changed.status,200);assert.equal(changed.body.state.branch,'inside');
  assert.equal(host.handle(B,'state','GET').body.state.branch,b.body.state.branch);
  assert.equal(changed.body.rehearsal,true);assert.equal(changed.body.accountScoped,true);
});
test('restarting a host preserves the same account and leaves another unchanged',()=>{
  const restored=createAccountTownHost({directory});
  assert.deepEqual(restored.handle(A,'state','GET').body.state,host.handle(A,'state','GET').body.state);
  assert.deepEqual(restored.handle(B,'state','GET').body.state,host.handle(B,'state','GET').body.state);
});
test('rejected commands cannot change revision or another account',()=>{
  const before=host.handle(A,'state','GET').body.state;
  const failed=host.handle(A,'command','POST',{id:'bad-choice',type:'PLACE',payload:{slot:'arbitrary'},expectedRevision:before.revision});
  assert.ok(failed.status>=400);assert.deepEqual(host.handle(A,'state','GET').body.state,before);
  assert.equal(host.handle(A,'state','POST').status,405);
});
test('appearance only renders known slots with server-returned ownership',()=>{
  const base={accountId:A,revision:4,inventory:[{itemId:'mongle-apron-starter'}],avatar:{slots:{body:'mongle-apron-starter',neck:'mongle-scarf-first-steps'}}};
  assert.equal(confirmedAppearance(base).outfit,'apron');
  const both=confirmedAppearance({...base,inventory:[...base.inventory,{itemId:'mongle-scarf-first-steps'}]});
  assert.equal(both.outfit,'scarf-apron');assert.equal(both.revision,4);
  assert.equal(confirmedAppearance({...base,avatar:{slots:{body:'external-model',neck:'external-model'}}}).outfit,'none');
});
test('unauthenticated appearance is empty and not verified',()=>{
  assert.deepEqual(confirmedAppearance(null),{avatarId:'mongle',renderVersion:3,slots:{body:'',neck:''},dyes:{},outfit:'none',verified:false,revision:null});
});
