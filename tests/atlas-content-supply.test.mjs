import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {ALL_ITEMS,PUBLISHED} from '../experiences/topik-items/bank.mjs';
import {HOLDOUT,isHeldout} from '../experiences/topik-items/holdout.mjs';
import {publicTopikBank,publicFollowupBank} from '../tools/build-world-topik-items.mjs';
import {currentUnits,blindUnit,validateException,digest,TASK,AUTHOR,AUTHORIZATION} from '../tools/lib/topik-review-atlas-20261028.mjs';
import {createSupplementalSession,shuffled,delayedSupplemental} from '../experiences/korean-rhythm/supplemental-player.mjs';
import {supplementalItems} from '../experiences/korean-rhythm/supplemental.mjs';
import {validateTeaException} from '../tools/lib/topik-review-atlas-tea-20261028.mjs';
import {BASE_ORDERS,ADDITIONAL_ORDERS} from '../experiences/order-rush/core.mjs';
import {orderMetadata,delayedOrders} from '../experiences/order-rush/learning.mjs';
const require=createRequire(import.meta.url),{createMap,validateMap}=require('../strata'),{createGame}=require('../atlas/game-learning.js');
const read=rel=>JSON.parse(fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8'));
const source=read('experiences/korean-rhythm/supplemental.json');

test('the 16 delayed source families and every shared-set peer stay outside all normal published banks',()=>{
 assert.equal(HOLDOUT.length,16);assert.equal(new Set(HOLDOUT.map(r=>r.familyKey)).size,16);
 assert.ok(PUBLISHED.every(i=>!isHeldout(i)));
 assert.ok(publicTopikBank().items.every(i=>!isHeldout(i)));
 const delayed=publicFollowupBank();assert.equal(delayed.items.length,16);
 assert.ok(delayed.items.every(i=>i.responseFormat==='single-choice'&&i.supplyRole==='delayed'&&i.exposurePeers.length));
 const mutated=structuredClone(ALL_ITEMS);mutated.find(i=>i.id===HOLDOUT[0].sourceItemId).question+=' changed';
 assert.throws(()=>publicFollowupBank(mutated),/Changed holdout source/);
});
test('each listening cell has four independent practice sources and two reserved delayed sources, with original family and audio',()=>{
 assert.equal(source.items.length,48);
 for(const skill of ['detail','negation','condition','reason'])for(const d of [1,2]){
  const cell=source.items.filter(i=>i.skillId===`ko.listening.${skill}`&&i.difficulty===d);
  assert.equal(new Set(cell.map(i=>i.familyKey)).size,6);assert.equal(cell.filter(i=>i.role==='practice').length,4);assert.equal(cell.filter(i=>i.role==='delayed').length,2);
 }
 for(const i of source.items){const original=ALL_ITEMS.find(o=>o.id===i.sourceItemId);assert.equal(i.familyKey,`topik-items.${original.family}`);assert.deepEqual(i.script,original.script);assert.deepEqual(i.audio,original.audio);assert.equal(i.sourceHash,digest(original));}
});
test('reviewed recommendations are direct nonblocking advice; drafts, mastered predecessors and unrelated goals gain no advice',()=>{
 const base=structuredClone(require('../strata/maps/topik-i.json'));
 const draft=read('strata/topik-i.recommendations.json').edges[0];
 const edge={...draft,reviewed:true,review:{task:TASK,reviewer:'/root',evidence:'fixture'},source_refs:[{source:'practice-taxonomy',selector:'fixture'}]};
 base.edges=base.edges.filter(e=>e.type!=='recommended_before');base.edges.push(edge);const map=createMap(base);
 assert.equal(map.recommendedBefore(edge.to)[0].blocking,false);assert.deepEqual(map.recommendedBefore('ko.listening.reason'),[]);
 const state={lines:[{key:`need:skill.${edge.to}`,usable:true,source:'observed'}]};assert.deepEqual(map.candidates(state)[0].blocked_by,[]);assert.deepEqual(map.candidates(state)[0].advisory,[edge.from]);
 assert.deepEqual(map.candidates({...state,mastered:[edge.from]})[0].advisory,[]);
 edge.reviewed=false;base.edges[base.edges.length-1]=edge;assert.deepEqual(createMap(base).recommendedBefore(edge.to),[]);
 edge.blocking=true;assert.throws(()=>validateMap(base),/nonblocking/);
});
function reviewFixture(){
 const units=currentUnits(),manifest={task:TASK,authorization:AUTHORIZATION,author:{id:AUTHOR,model:'fixture author'},allowlist:units.map(({id,kind,file,hash})=>({id,kind,file,hash}))};
 const packet={...manifest,packetHash:digest(manifest),units},evidence='independent test fixture evidence';
 const checks=Object.fromEntries(['answer_unique','naturalness','skill_fit','difficulty_fit','explanation','family_preserved','audio_source_unchanged','response_contract','no_official_type_claim','source_scope','interpretation_separate','nonblocking','direct_target','no_required_order_claim'].map(k=>[k,true]));
 const result={task:TASK,packetHash:packet.packetHash,reviewer:{id:'/independent-test-reviewer',model:'test fixture only'},reviewedAt:'2026-10-28T12:00:00Z',evidence:{path:`.tmp/${TASK}/fixture.txt`,sha256:digest(evidence)},results:units.map(u=>({id:u.id,hash:u.hash,verdict:'pass',reason:'Test fixture, never applied or published.',checks,solved:u.kind==='binary-choice'?u.content.answer:u.kind==='cup-compose'?u.content.cups.map(c=>({base:null,milk:false,temp:'hot',ice:false,sugar:false,...c})):null}))};
 return {packet,result,options:{units,readEvidence:()=>Buffer.from(evidence)}};
}
test('task-scoped exception rejects self-review, missing evidence, stale content and an incorrect blind cup assembly',()=>{
 const f=reviewFixture();assert.equal(validateException(f.packet,f.result,f.options),true);
 const same=structuredClone(f.result);same.reviewer.id=AUTHOR;assert.throws(()=>validateException(f.packet,same,f.options),/independent/);
 const empty=structuredClone(f.result);empty.results.pop();assert.throws(()=>validateException(f.packet,empty,f.options),/incomplete/);
 const stale=structuredClone(f.result);stale.results[0].hash='0'.repeat(64);assert.throws(()=>validateException(f.packet,stale,f.options),/stale/);
 const bad=structuredClone(f.result);bad.results.find(r=>Array.isArray(r.solved)).solved[0].base='tea';assert.throws(()=>validateException(f.packet,bad,f.options),/blind cups/);
 assert.throws(()=>validateException(f.packet,f.result,{...f.options,readEvidence:()=>Buffer.from('wrong')}),/evidence/);
 for(const u of f.packet.units){const blind=blindUnit(u);assert.equal('answer'in blind.content,false);assert.equal('cups'in blind.content,false);assert.equal('explanation'in blind.content,false);}
});
function controller(){
 let t=Date.parse('2026-10-28T12:00:00Z');const mem=new Map(),coach=createGame({gameId:'korean-rhythm',map:createMap(require('../strata/maps/topik-i.json')),storage:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)},clock:()=>new Date(t+=1000).toISOString(),followups:true});
 const audio={pause(){},async play(){}},session=createSupplementalSession({coach,audio});
 const item={id:'transfer-test',itemKey:'transfer-test.v1',familyKey:'topik-items.shared-test',skillId:'ko.listening.detail',difficulty:1,modality:'listening',responseFormat:'binary-choice',audioRequired:true,conceptIds:[],audio:'topik-items/audio/test.mp3',choices:[{id:'O'},{id:'X'}],correctId:'O',explanation:{ko:'근거'}};
 return {coach,audio,session,item};
}
test('supplemental answer waits for actual audio end; text/replay exclude independent evidence and duplicate answer is refused',async()=>{
 const {coach,audio,session,item}=controller();session.open(item);assert.equal(session.answer('O'),null);await session.play();audio.onerror();assert.equal(session.answer('O'),null);
 await session.play();audio.onended();session.text();assert.equal(session.answer('O'),true);assert.equal(session.state.record.independent,false);assert.equal(session.answer('X'),null);
 assert.equal(coach.summary().skills.find(s=>s.id===item.skillId).n,0);
});
test('post-answer explanation preserves first answer and same source in another task is a repeat',async()=>{
 const {coach,audio,session,item}=controller();session.open(item);await session.play();audio.onended();session.answer('O');assert.equal(session.state.record.independent,true);session.explanation();
 const prior=coach.summary().skills.find(s=>s.id===item.skillId);assert.equal(prior.n,1);
 session.open({...item,itemKey:'another-response.v1'});await session.play();audio.onended();session.answer('O');assert.equal(session.state.record.independent,false);
});
test('seeded ordering changes the source ordering instead of exposing the authored alternating OX pattern',()=>{
 const ids=source.items.map(i=>i.id);assert.deepEqual(shuffled(ids,123),shuffled(ids,123));assert.notDeepEqual(shuffled(ids,123),ids);assert.notDeepEqual(shuffled(ids,123),shuffled(ids,124));
});
test('cup follow-up selects the exact due response cell and never treats an exposed or unknown source as new',()=>{
 let t=Date.parse('2026-10-25T12:00:00Z');const mem=new Map();
 const coach=createGame({gameId:'order-rush',map:createMap(require('../strata/maps/topik-i.json')),storage:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)},clock:()=>new Date(t+=1000).toISOString(),followups:true});
 const id=coach.present(orderMetadata(BASE_ORDERS[0]));coach.delivery(id,{audio:'completed'});coach.answer(id,{correct:true,assessable:true});
 const pool=ADDITIONAL_ORDERS.filter(o=>o.role==='delayed');assert.deepEqual(delayedOrders(coach,pool),[]);
 t+=2*86400000;const due=delayedOrders(coach,pool);assert.deepEqual(due.map(o=>o.id),['n06','n07']);
 coach.present(orderMetadata(due[0]));assert.deepEqual(delayedOrders(coach,pool).map(o=>o.id),['n07']);
 assert.deepEqual(delayedOrders({...coach,exposure:()=>({seen:null})},pool),[]);
 assert.deepEqual(delayedOrders({...coach,mapVersion:'different'},pool),[]);
});
test('rhythm delay preserves its original cell and stops proposing reserves after one independent follow-up',()=>{
 let t=Date.parse('2026-10-25T12:00:00Z');const mem=new Map();
 const coach=createGame({gameId:'korean-rhythm',map:createMap(require('../strata/maps/topik-i.json')),storage:{getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)},clock:()=>new Date(t+=1000).toISOString(),followups:true});
 const first=supplementalItems().find(i=>i.skillId==='ko.listening.detail'&&i.difficulty===1);
 const id=coach.present(first);coach.delivery(id,{audio:'completed'});coach.answer(id,{correct:true,assessable:true});
 assert.deepEqual(delayedSupplemental(coach),[]);t+=2*86400000;
 const candidates=delayedSupplemental(coach);assert.equal(candidates.length,2);
 assert.ok(candidates.every(i=>i.responseFormat==='binary-choice'&&i.skillId===first.skillId&&i.difficulty===first.difficulty&&i.familyKey!==first.familyKey));
 assert.deepEqual(delayedSupplemental({...coach,mapVersion:'different'}),[]);
 assert.deepEqual(delayedSupplemental({...coach,exposure:()=>({seen:null})}),[]);
 const next=coach.present(candidates[0]);coach.delivery(next,{audio:'completed'});coach.answer(next,{correct:true,assessable:true});
 assert.deepEqual(delayedSupplemental(coach),[]);
 assert.ok(coach.followups().items.some(r=>r.status==='observed'&&r.outcome==='independent-correct'));
});
test('the fixed Town extension requires independent blind evidence and rejects changed source or unsupported levels',()=>{
 const base='experiences/topik-items/review/reports/atlas-world-learning-20261028-tea-';
 const raw=rel=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
 const input={packetRaw:raw(base+'full.json'),result:read(base+'root-result.json'),blindRaw:raw(base+'blind-all.json'),solved:read(base+'root-blind-solved.json')};
 assert.equal(validateTeaException(input).result.results.length,12);
 const same=structuredClone(input);same.result.reviewer=same.result.author;assert.throws(()=>validateTeaException(same),/Independent/);
 const wrong=structuredClone(input);wrong.solved.items[0].solved.tea='yuzu';assert.throws(()=>validateTeaException(wrong),/Blind Town answer/);
 const level=structuredClone(input);level.result.results[0].levels.push('L3');assert.throws(()=>validateTeaException(level),/unapproved/);
 const LINES='experiences/synk-town/town/data/lines/tea.json',AXES='experiences/synk-town/town/data/tea.json';
 const edit=(file,change)=>rel=>rel===file?JSON.stringify(change(JSON.parse(raw(rel)))):raw(rel);
 const later={id:'guest.tea.req-later.1',when:{part:'request'},levels:{L1:'따뜻한 차 주세요.',L2:'따뜻한 차 주세요.',L3:'따뜻한 차 주세요.',L4:'따뜻한 차 주세요.'}};
 assert.equal(validateTeaException({...input,readSource:edit(LINES,lines=>[...lines,later])}).result.results.length,12,'frames added beside the reviewed twelve keep their own review');
 assert.throws(()=>validateTeaException({...input,readSource:edit(AXES,tea=>({...tea,axes:{...tea.axes,temp:{...tea.axes.temp,warm:{...tea.axes.temp.warm,adv:'차갑게'}}}}))}),/Changed Town source/);
 assert.throws(()=>validateTeaException({...input,readSource:edit(LINES,lines=>lines.map(l=>l.id==='guest.tea.req-tea.1'?{...l,levels:{...l.levels,L1:l.levels.L1+'!'}}:l))}),/Stale or unapproved Town frame/);
});
