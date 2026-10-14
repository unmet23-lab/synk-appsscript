import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSaved, saveSessions, removeSaved, STORAGE_KEY, createImportController } from '../storage.mjs';
import { createSession, appendTurn, archive } from '../domain.mjs';
const store = () => {const data=new Map();return {data,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const session = () => {let s=createSession({scenario:'refusal',counterpart:'지인',goal:'거절',id:'one'});for(let i=0;i<3;i++)s=appendTurn(s,{answer:'거절하는 말',review:'stuck',focus:'pressure'});return s;};
test('device memory starts off, explicit save survives reload, deletion disables it',()=>{
  const storage=store();assert.deepEqual(loadSaved(storage),{enabled:false,sessions:[],error:''});
  assert.equal(storage.data.size,0);
  assert.equal(saveSessions(storage,[session()]).ok,true);
  assert.equal(loadSaved(storage).sessions[0].scenario,'refusal');assert.equal(loadSaved(storage).enabled,true);
  removeSaved(storage);assert.equal(loadSaved(storage).enabled,false);assert.equal(storage.data.size,0);
});
test('corruption/quota/denied deletion never reports saved success',()=>{
  const storage=store();storage.setItem(STORAGE_KEY,'bad json');const load=loadSaved(storage);assert.equal(load.enabled,false);assert.ok(load.error);
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');},removeItem(){throw Error('denied');}};
  assert.ok(loadSaved(denied).error);assert.equal(saveSessions(denied,[session()]).ok,false);assert.equal(removeSaved(denied).ok,false);
});
test('late import reads cannot commit after route changes or newer selections',async()=>{
  const controller=createImportController();
  let complete;
  const pending=controller.read({size:100,text:()=>new Promise(resolve=>{complete=resolve;})});
  controller.invalidate();
  complete('not even valid JSON');
  assert.deepEqual(await pending,{status:'cancelled'});
  let first;
  const older=controller.read({size:100,text:()=>new Promise(resolve=>{first=resolve;})});
  const newer=await controller.read({size:100,text:async()=>JSON.stringify(archive([session()]))});
  assert.equal(newer.status,'ready');
  first('{}');assert.deepEqual(await older,{status:'cancelled'});
});

// ── schema 2 (2026-10-14) ────────────────────────────────────────────
import { setPlan, setRealDate, recordOutcome, retryTurn, SCHEMA } from '../domain.mjs';
test('a schema 1 device copy still loads and is rewritten as schema 2 without losing or inventing fields', () => {
  const storage = store(), legacy = session();
  const schema1 = { schema: 1, savedAt: '2026-10-08T00:00:00.000Z', sessions: [{ id: legacy.id, at: legacy.at, scenario: legacy.scenario, counterpart: legacy.counterpart, goal: legacy.goal, focus: legacy.focus, firstSentence: '', takeaway: '', turns: legacy.turns.map(({ id, answer, review, retry, retryReview }) => ({ id, answer, review, retry, retryReview })) }] };
  storage.setItem(STORAGE_KEY, JSON.stringify(schema1));
  const loaded = loadSaved(storage);
  assert.equal(loaded.enabled, true); assert.deepEqual(loaded.sessions, schema1.sessions);
  assert.equal(saveSessions(storage, loaded.sessions).ok, true);
  const rewritten = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(rewritten.schema, SCHEMA); assert.deepEqual(rewritten.sessions, schema1.sessions);
});
test('schema 2 plan, date, reflection and spoken seconds survive device save and reload', () => {
  const storage = store();
  let s = retryTurn(session(), 2, '다시 말한 거절', 'easy', { mode: 'voice', seconds: 12 });
  s = recordOutcome(setRealDate(setPlan(s, { ifThey: '한 번만 더 부탁하면', iWill: '같은 말로 다시 거절한다' }), '2026-10-16'), { did: 'yes', usedFirst: true, reaction: 'good', note: '짧게 말하니 편했다.', at: '2026-10-16T12:00:00.000Z' });
  assert.equal(saveSessions(storage, [s]).ok, true);
  assert.deepEqual(loadSaved(storage).sessions, [s]);
  storage.setItem(STORAGE_KEY, storage.getItem(STORAGE_KEY).replace('"reaction":"good"', '"reaction":"great"'));
  const broken = loadSaved(storage);
  assert.equal(broken.enabled, false); assert.ok(broken.error);
});
