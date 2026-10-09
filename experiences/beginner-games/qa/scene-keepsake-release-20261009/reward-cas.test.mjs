import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createWorldPlayHost} from '../../../play-common/account-host.mjs';
import {emptyPlayState,validatePlayChanges} from '../../../play-common/play-data.mjs';
const source=fs.readFileSync(new URL('../../../play-common/collection.js',import.meta.url),'utf8'),old=fs.readFileSync(new URL('./collection.before-read-record.js',import.meta.url),'utf8'),key='synk.order-rush.beginner.v1';
function storage(){const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function setup(code){let revision=0,state=emptyPlayState(),writes=0;const original=JSON.stringify({version:1,seed:411,completed:[],records:[],roundId:'order-rush:cas-story'});state.records[key]=original;const response=()=>({ok:true,scope:'synk-play',accountId:'reward-reader',revision,state:structuredClone(state)}),client={load:async()=>response(),mutate:async body=>{assert.equal(body.action,'progress');const changes=validatePlayChanges(body.changes);for(const c of changes)if((state.records[c.key]??null)!==c.previous)throw Object.assign(Error('conflict'),{code:'REVISION_CONFLICT'});for(const c of changes)state.records[c.key]=c.value;revision++;writes++;return response();}};
 const host=createWorldPlayHost({accountId:'reward-reader',client,guard(){},storage:storage()}),context=vm.createContext({SYNKPlayHost:host,localStorage:storage(),location:{pathname:'/try/order-rush/'}});vm.runInContext(code,context);
 return {host,context,original,remoteProgress(){state.records[key]=JSON.stringify({...JSON.parse(original),completed:[0],records:Array.from({length:6},()=>({voice:'water',stage:0}))});revision++;},latest:()=>JSON.parse(state.records[key]),writes:()=>writes};
}
test('reward guidance cannot change the running first-shop game’s CAS observation',async t=>{
 const b=setup(source);t.after(()=>b.host.stop());await b.context.SynkPlayAccount.ready();const game=b.context.SynkPlayAccount.storage(),cached=game.getItem(key);b.remoteProgress();await b.host.retry();
 assert.equal((await b.context.SynkPlayCollection.beginnerRewardRoute('order-rush')).kind,'first-shop');game.setItem(key,JSON.stringify({...JSON.parse(cached),stage:0,language:'ko'}));await assert.rejects(b.host.flush(),{code:'REVISION_CONFLICT'});assert.deepEqual(b.latest().completed,[0]);assert.equal(b.writes(),0);
});
test('the prior guidance read reproduces a silently accepted stale first-shop overwrite',async t=>{
 const b=setup(old);t.after(()=>b.host.stop());await b.context.SynkPlayAccount.ready();const game=b.context.SynkPlayAccount.storage(),cached=game.getItem(key);b.remoteProgress();await b.host.retry();await b.context.SynkPlayCollection.beginnerRewardRoute('order-rush');game.setItem(key,cached);await b.host.flush();assert.deepEqual(b.latest().completed,[]);assert.equal(b.writes(),1);
});
test('read-only account records exclude unknown keys and become unavailable after logout',async t=>{
 const b=setup(source);t.after(()=>b.host.stop());await b.context.SynkPlayAccount.ready();assert.equal(b.context.SynkPlayAccount.readRecord(key),b.original);assert.throws(()=>b.context.SynkPlayAccount.readRecord('synk.oauth.session.world'));b.host.stop();assert.throws(()=>b.context.SynkPlayAccount.readRecord(key));
});
