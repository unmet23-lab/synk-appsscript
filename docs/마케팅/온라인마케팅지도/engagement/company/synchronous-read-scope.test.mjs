import test from 'node:test';
import assert from 'node:assert/strict';
import {createSynchronousReadScope} from './synchronous-read-scope.mjs';

test('one read reuses identical projections but separates users, permissions, methods and all arguments',()=>{
  const scope=createSynchronousReadScope();let calls=0;const source=scope.service({get(...args){return {calls:++calls,args};},other(){return ++calls;}},['get','other']);
  scope.run(()=>{const user={id:'a',role:'member'},first=source.get(user,'p');assert.equal(source.get({...user},'p'),first);assert.notEqual(source.get({...user,id:'b'},'p'),first);assert.notEqual(source.get({...user,role:'viewer'},'p'),first);assert.notEqual(source.get(user,'q'),first);assert.notEqual(source.get(user),source.get(user,undefined));assert.notEqual(source.get(user,undefined),source.get(user,null));assert.notEqual(source.get(user,null),source.get(user,'null'));assert.equal(source.other(),source.other());});
  const before=calls;source.get({id:'a',role:'member'},'p');source.get({id:'a',role:'member'},'p');assert.equal(calls,before+2);
});

test('errors are reused within a read so all dependent sections remain partial; end and throw discard them',()=>{
  const scope=createSynchronousReadScope();let fail=true,calls=0;const source=scope.service({get(){calls++;if(fail)throw Error('unavailable');return calls;}},['get']);
  assert.throws(()=>scope.run(()=>{assert.throws(()=>source.get(),/unavailable/);assert.throws(()=>source.get(),/unavailable/);throw Error('top-level');}),/top-level/);assert.equal(calls,1);fail=false;assert.equal(scope.run(()=>source.get()),2);assert.equal(scope.run(()=>source.get()),3);
});

test('promise results are never cached and scope ends before continuation after await',async()=>{
  const scope=createSynchronousReadScope();let calls=0;const source=scope.service({get(){return Promise.resolve(++calls);}},['get']);
  await scope.run(async()=>{assert.equal(await source.get(),1);assert.equal(await source.get(),2);});
  scope.run(()=>{assert.notEqual(source.get(),source.get());});assert.equal(calls,4);
});

test('a new request sees source and permission changes immediately',()=>{
  const scope=createSynchronousReadScope();let active=true,revision=1;const source=scope.service({get(user){if(!active)throw Object.assign(Error('revoked'),{status:403});return {id:user.id,revision};}},['get']),user={id:'a'};
  assert.equal(scope.run(()=>source.get(user)).revision,1);revision=2;assert.equal(scope.run(()=>source.get(user)).revision,2);active=false;assert.throws(()=>scope.run(()=>source.get(user)),{status:403});
});

test('the same method implementation in two services keeps its receiver and separate values',()=>{
  const scope=createSynchronousReadScope(),read=function(){return this.label;};
  const a=scope.service({label:'a',get:read},['get']),b=scope.service({label:'b',get:read},['get']);
  scope.run(()=>{assert.equal(a.get(),'a');assert.equal(b.get(),'b');});
});
