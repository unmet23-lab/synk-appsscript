'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {removeRetiredAuthClients}=require('../tools/build-platform-release.cjs');
const {configuration}=require('../src/auth-config.cjs');
const registration=(id,port)=>({clientId:'public-'+id,redirectUri:'http://127.0.0.1:'+port+'/synk/oauth/'+id+'/callback'});
const current={version:1,supabaseUrl:'https://auth.example.test',supabasePublishableKey:'sb_publishable_fixture',clients:{platform:registration('platform',4200),world:registration('world',4201),care:registration('care',4202)}};
test('pinned runtime retires only album/rehearsal registrations and keeps current vault identity',()=>{
 const old={...current,clients:{...current.clients,rehearsal:registration('rehearsal',4203),'family-album':registration('family-album',4204)}};
 assert.throws(()=>configuration(old,'platform','development'),{code:'AUTH_CONFIG_INVALID'});
 const result=removeRetiredAuthClients(old);
 assert.deepEqual(result,current);
 assert.deepEqual(Object.keys(old.clients),['platform','world','care','rehearsal','family-album']);
 for(const id of ['platform','world','care'])assert.deepEqual(configuration(result,id,'development'),configuration(current,id,'development'));
});
test('a different unknown registration still fails before packaging',()=>{
 const value=removeRetiredAuthClients({...current,clients:{...current.clients,unexpected:registration('unexpected',4209)}});
 assert.throws(()=>configuration(value,'platform','development'),{code:'AUTH_CONFIG_INVALID'});
});
test('retirement does not add authentication to an unconfigured runtime',()=>{
 assert.equal(removeRetiredAuthClients(null),null);assert.equal(removeRetiredAuthClients(undefined),undefined);
});
