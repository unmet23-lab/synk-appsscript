import {test} from 'node:test';
import assert from 'node:assert/strict';
import {followupRows,advisoryRows} from '../world-learning-followups.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {worldPosition} from '../world-position-kit.mjs';
const measure={skillId:'ko.listening.detail',difficulty:1,responseFormat:'single-choice',modality:'listening',audioRequired:true,taskVersion:'v1'};
const row={id:'source:d1',gameId:'world-practice',status:'due',dueAt:'2026-10-28T00:00:00Z',measure};
const item={id:'new',itemKey:'new.v1',familyKey:'new',...measure,supplyRole:'delayed',exposurePeers:[{itemKey:'peer.v1',familyKey:'peer'}]};
const project=(rows=[row])=>({evidenceComplete:true,coverage:{limited:false},items:rows});
const run=(extra={})=>followupRows({projection:project(),pool:[item],seen:()=>false,taskVersion:'v1',...extra});
test('only due same-game/same-format/same-version evidence opens an unseen task',()=>{
 assert.equal(run().rows[0].item.id,'new');
 for(const diff of [{responseFormat:'binary-choice'},{difficulty:2},{skillId:'ko.listening.reason'},{modality:'reading'},{audioRequired:false}])assert.equal(run({pool:[{...item,...diff}]}).rows[0].available,false);
 assert.equal(run({taskVersion:'v2'}).rows[0].available,false);
 assert.equal(run({projection:project([{...row,gameId:'another-game'}])}).rows.length,0);
 assert.equal(run({projection:project([{...row,status:'not_due'}])}).rows[0].available,false);
 assert.equal(run({audioAvailable:false}).rows[0].available,false);
});
test('unknown exposure, seen peer and incomplete retention do not consume holdouts',()=>{
 for(const seen of [()=>null,x=>x.itemKey==='peer.v1'])assert.equal(run({seen}).rows[0].available,false);
 for(const projection of [{...project(),evidenceComplete:false},{...project(),coverage:{retentionLimited:true}}]){const r=run({projection});assert.equal(r.limited,true);assert.equal(r.rows[0].available,false);}
 assert.equal(run({pool:[{...item,setId:'set'}, {...item,id:'sibling',itemKey:'seen',setId:'set'}],seen:x=>x.itemKey==='seen'}).rows[0].available,false);
});
test('advice is direct, reviewed, nonblocking and never replaces independent evidence',()=>{
 const lookup=id=>[{node:{id:'ko.listening.detail'},target:id,reviewed:true,blocking:false}];
 const args={targets:['ko.listening.reason'],summary:{evidenceComplete:true,skills:[]},lookup,supply:{'ko.listening.detail':2}};
 assert.equal(advisoryRows(args).length,1);
 assert.equal(advisoryRows({...args,summary:{evidenceComplete:true,skills:[{id:'ko.listening.detail',status:'recent-independent'}]}}).length,0);
 assert.equal(advisoryRows({...args,lookup:()=>[{node:{id:'ko.listening.detail'},reviewed:false,blocking:false}]}).length,0);
 assert.equal(advisoryRows({...args,summary:{evidenceComplete:false}}).length,0);
});
test('real WORLD coach map version produces playable followups with the real product kit',()=>{
 let now='2026-10-25T00:00:00.000Z';const data=new Map();
 const coach=worldLearning.engine.createGame({gameId:'world-practice',followups:true,clock:()=>now,storage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}});
 const source={id:'source',itemKey:'source.v1',familyKey:'source',skillId:'ko.reading.detail',difficulty:1,responseFormat:'single-choice',modality:'reading',audioRequired:false};
 coach.answer(coach.present(source),{correct:false,assessable:true});now='2026-10-26T01:00:00.000Z';
 assert.match(coach.mapVersion,/^world:/);
 const fresh={...source,id:'fresh',itemKey:'fresh.v1',familyKey:'fresh'};
 const result=followupRows({projection:coach.followups(),pool:[fresh,...worldPosition.practice.pool],seen:i=>coach.exposure(i).seen,taskVersion:coach.mapVersion});
 assert.ok(result.rows.some(row=>row.status==='due'&&row.available),'actual combined map version must admit a fresh same-format item');
});
