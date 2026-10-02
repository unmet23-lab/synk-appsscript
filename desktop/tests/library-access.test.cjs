'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {projectLibrary}=require('../src/library-access.cjs');
const now=Date.parse('2026-10-02T00:00:00Z');
const payload=(memberships=[],entitlements=[],extra={})=>({ok:true,account:{synk_user_id:'synthetic-account',status:'active'},memberships,entitlements,...extra});
const learner={kind:'learner',role:'student',learner_id:'synthetic-learner'};
const teacher={kind:'staff',role:'teacher',staff_id:'synthetic-staff'};
test('verified learner and teaching membership expose only relevant app entries',()=>{
  assert.deepEqual(projectLibrary(payload([learner]),now),{status:'ready',appIds:['world']});
  assert.deepEqual(projectLibrary(payload([teacher]),now),{status:'ready',appIds:['teacher']});
  assert.deepEqual(projectLibrary(payload([teacher,{...teacher,role:'director'},learner]),now),{status:'ready',appIds:['world','teacher']});
});
test('academy staff, unknown roles and profile claims never confer company or other app entries',()=>{
  const data=payload([{...teacher,role:'inspector'},{...teacher,role:'l10n_reviewer'},{...teacher,role:'employee'},{kind:'company',role:'admin',staff_id:'synthetic'}]);
  data.account.profile={role:'admin',employee:true,context:'work',appIds:['messenger','studio']};
  data.library={status:'ready',appIds:['messenger','studio']};
  assert.deepEqual(projectLibrary(data,now),{status:'ready',appIds:[]});
});
test('inactive, revoked or structurally incomplete memberships are ignored',()=>{
  const rows=[{...learner,active:false},{...learner,active:'true'},{...learner,active:null},{...teacher,revoked_at:'2026-10-01T00:00:00Z'},{kind:'learner',role:'student'},{kind:'staff',role:'teacher'},null,'teacher'];
  assert.deepEqual(projectLibrary(payload(rows),now),{status:'ready',appIds:[]});
});
test('explicit platform library grants and existing WORLD practice.plus are recognized exactly',()=>{
  const entitlements=[{product:'platform',key:'library.messenger'},{product:'platform',key:'library.studio'},{product:'world',key:'practice.plus'}];
  assert.deepEqual(projectLibrary(payload([],entitlements),now),{status:'ready',appIds:['world','messenger']});
  for(const entitlement of [{product:'messenger',key:'library.messenger'},{product:'world',key:'library.teacher'},{product:'platform',key:'library.admin'},{product:'world',key:'unknown'},{product:'platform',key:'library.world.extra'}])assert.deepEqual(projectLibrary(payload([],[entitlement]),now).appIds,[]);
});
test('menu grants stop at expiry and reject future, revoked and malformed validity',()=>{
  const grant={product:'platform',key:'library.pulse',valid_until:'2026-10-02T00:00:01Z'};
  assert.deepEqual(projectLibrary(payload([],[grant]),now).appIds,['pulse']);
  assert.deepEqual(projectLibrary(payload([],[grant]),now+1000).appIds,[]);
  for(const values of [{valid_until:'bad'},{valid_until:0},{valid_from:'bad'},{valid_from:'2026-10-03T00:00:00Z'},{revoked_at:'2026-10-01T00:00:00Z'},{status:'revoked'},{active:false},{active:'true'}])assert.deepEqual(projectLibrary(payload([],[{...grant,...values}]),now).appIds,[]);
});
test('missing or unavailable contracts fail closed instead of using universal defaults',()=>{
  for(const data of [null,{},payload([],[],{ok:false}),payload([],[],{memberships:null}),payload([],[],{entitlements:undefined}),payload([],[],{account:{synk_user_id:'synthetic-account',status:'disabled'}}),payload([],[],{account:{synk_user_id:'synthetic-account',status:'deletion-requested'}})])assert.deepEqual(projectLibrary(data,now),{status:'unavailable',appIds:[]});
  assert.deepEqual(projectLibrary(payload(),now),{status:'ready',appIds:[]});
});

test('retired Studio and SHIFT menu grants never migrate into company access',()=>{const retired=['studio','shift'].map(id=>({product:'platform',key:'library.'+id}));assert.deepEqual(projectLibrary(payload([],retired),now),{status:'ready',appIds:[]});assert.deepEqual(projectLibrary(payload([teacher],retired),now).appIds,['teacher']);assert.deepEqual(projectLibrary(payload([],retired.concat({product:'platform',key:'library.messenger'})),now).appIds,['messenger']);});
