'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../atlas/engine'),Trail=require('../atlas/trail'),Ledger=require('../atlas/learning-ledger');
const {createGame}=require('../atlas/game-learning'),{createMap}=require('../strata');
const map=createMap(require('../strata/topik-i').topikMap());
const T0=Date.parse('2026-10-29T00:00:00Z'),skill='ko.reading.detail',cellKey=skill+'|1|single-choice';
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};};
function fixture(){
 let tick=0;const storage=memory(),options={gameId:'withdrawal',map,storage,storageScope:'account',accountKey:'account.withdrawal',historyComplete:true,fold:false,clock:()=>new Date(T0+(++tick)*1000).toISOString()};
 const game=createGame(options),presentations=[],answers=[];
 for(let i=0;i<4;i++){const p=game.present({id:'question.'+i,itemKey:'item.'+i,familyKey:'family.'+i,skillId:skill,modality:'reading',difficulty:1,responseFormat:'single-choice'});presentations.push(p);answers.push(game.answer(p,{correct:true,assessable:true}).eventId);}
 const events=game.events(),scope=events[0].scope,ledger=Ledger.fold(null,events,{scope,log:events});
 const [key,raw]=[...storage.data].find(([,value])=>{try{return Array.isArray(JSON.parse(value).events);}catch{return false;}});
 const payload=JSON.parse(raw);payload.events=[];payload.ledger=ledger;storage.setItem(key,JSON.stringify(payload));
 const exclude=(target,id='exclude.1')=>({schema:1,scope,id,type:'record.excluded',at:new Date(T0+100000).toISOString(),recordedAt:new Date(T0+100000).toISOString(),targetId:target});
 return {storage,options,ledger,answers,presentations,exclude};
}
const evidence=game=>game.summary().skills.flatMap(s=>[1,2,3].flatMap(level=>Object.values(s.levels[level].formats).flatMap(f=>f.evidence)));
test('the actual older ledger reader accepts the optional provenance without a wire change',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const folder=path.join(__dirname,'fixtures/atlas-ledger-personalization-20261029'),source=fs.readFileSync(path.join(folder,'before.cjs')),pin=require(path.join(folder,'source.json'));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),pin.sha256);
 const module={exports:{}};new Function('require','module','exports',source.toString())(name=>require('../atlas/'+name.slice(2)),module,module.exports);
 const f=fixture(),next=Ledger.demote(f.ledger,{excluded:[f.presentations[0]],strays:1},()=>null);
 assert.equal(next.version,module.exports.VERSION);assert.doesNotThrow(()=>module.exports.validate(next));
 assert.equal(module.exports.rows(module.exports.cellOf(next,cellKey)).rows.length,3);
});
test('provenance safely retains a valid event ID named __proto__',()=>{
 let n=0,ms=T0;const scope={domain:'LAB',workspace:'raw-id',subject:'synthetic'};
 const s=A.createSession({scope,clock:()=>new Date(ms+=1000).toISOString(),id:()=>++n===3?'__proto__':`safe.${n}`});
 const d=s.plan('documents',[{id:'standard',pace:'standard',minutes:5}]);
 const p=s.practice('presented',{decisionId:d.id,taskId:'raw',taskVersion:'v1',itemKey:'raw.item',conceptIds:[skill],firstExposure:true,measure:{skillId:skill,modality:'reading',difficulty:1,responseFormat:'single-choice',familyKey:'raw.family',audioRequired:false,confounded:false}});
 s.practice('attempted',{presentationId:p.id,attemptNo:1,verdict:'correct',errorTags:[]});
 const l=Ledger.fold(null,s.events(),{scope});assert.ok(Object.hasOwn(l.parents,'__proto__'));assert.doesNotThrow(()=>Ledger.validate(l));
 assert.equal(Ledger.rows(Ledger.cellOf(Ledger.demote(l,{excluded:[p.id]},()=>null),cellKey)).rows.length,0);
});
test('an exclusion of a folded answer reaches another already open tab and cannot be written back as evidence',()=>{
 const f=fixture(),a=createGame(f.options),b=createGame(f.options);assert.equal(evidence(b).length,4);
 a.syncPort.importEvents([f.exclude(f.answers[0])]);assert.equal(evidence(a).length,3);
 assert.equal(evidence(b).length,3);assert.ok(!evidence(b).includes(f.answers[0]));b.flush();
 assert.equal(evidence(createGame(f.options)).length,3);
});
test('excluding a folded presentation removes its answer while preserving other evidence and exposure',()=>{
 const f=fixture(),next=Ledger.demote(f.ledger,{excluded:[f.presentations[0]],strays:1},()=>null);
 assert.equal(Ledger.rows(Ledger.cellOf(next,cellKey)).rows.length,3);
 assert.ok(!Ledger.rows(Ledger.cellOf(next,cellKey)).rows.some(r=>r.eventId===f.answers[0]));
 assert.equal(Ledger.before(next,'item:item.0',['attempt']),true);
 assert.equal(Ledger.rows(Ledger.cellOf(f.ledger,cellKey)).rows.length,4,'the original ledger is immutable');
});
test('different corrections to the same folded base converge without restoring either withdrawn answer',()=>{
 const f=fixture(),a=Ledger.demote(f.ledger,{excluded:[f.answers[0]],strays:1},()=>null),b=Ledger.demote(f.ledger,{excluded:[f.answers[1]],strays:1},()=>null);
 const merged=Ledger.reconcile(a,b),reverse=Ledger.reconcile(b,a);
 assert.equal(Ledger.rows(Ledger.cellOf(merged,cellKey)).rows.length,2);
 assert.deepEqual(merged,reverse);assert.deepEqual(Ledger.reconcile(merged,a),merged);
});
test('equal counts and cutoff never turn unrelated missing rows into withdrawals',()=>{
 const f=fixture(),other=fixture(),a=Ledger.demote(f.ledger,{excluded:[f.presentations[0]]},()=>null);
 assert.equal(a.folded,other.ledger.folded);assert.equal(a.cutoff,other.ledger.cutoff);
 for(const legacy of [false,true]){
  const b=JSON.parse(JSON.stringify(other.ledger));if(legacy)delete b.parents;
  assert.equal(Ledger.rows(Ledger.cellOf(Ledger.reconcile(a,b),cellKey)).rows.length,3);
  assert.equal(Ledger.rows(Ledger.cellOf(Ledger.reconcile(b,a),cellKey)).rows.length,4);
 }
 const newer={...f.ledger,folded:f.ledger.folded+1};
 assert.equal(Ledger.rows(Ledger.cellOf(Ledger.reconcile(a,newer),cellKey)).rows.length,3);
 assert.equal(Ledger.rows(Ledger.cellOf(f.ledger,cellKey)).rows.length,4);
});
test('a newly withdrawn descendant remains withdrawn through a third legacy-parent ledger',()=>{
 const f=fixture(),id=f.answers[0],audio='source.audio';
 const a={...f.ledger,adjusted:1,withdrawn:[audio]},b=structuredClone(f.ledger);b.folded++;b.parents[id]=[f.presentations[0],b.parents[id][1],audio];
 const joined=Ledger.reconcile(a,b);assert.ok(joined.withdrawn.includes(id));
 const c=structuredClone(b);c.folded++;c.parents[id].pop();
 const final=Ledger.reconcile(joined,c);assert.equal(Ledger.rows(Ledger.cellOf(final,cellKey)).rows.length,3);assert.ok(!Ledger.rows(Ledger.cellOf(final,cellKey)).rows.some(r=>r.eventId===id));
});
test('joining corrections never removes a local-only or lost-source restriction',()=>{
 const f=fixture(),a={...f.ledger,adjusted:1,local:true,followupsPreserved:false,followupsLost:{anchors:1,at:T0}},b={...f.ledger,adjusted:2,followupsPreserved:true};
 for(const joined of [Ledger.reconcile(a,b),Ledger.reconcile(b,a)]){assert.equal(joined.local,true);assert.equal(joined.followupsPreserved,false);assert.deepEqual(joined.followupsLost,{anchors:1,at:T0});}
 const shuffled=JSON.parse(JSON.stringify(b));shuffled.cells[cellKey].ind.reverse();
 assert.deepEqual(Ledger.reconcile(a,shuffled).cells,Ledger.reconcile(shuffled,a).cells);
});
test('a legacy ledger with no parent provenance cannot keep unverified ability after a parent exclusion',()=>{
 const f=fixture(),legacy=JSON.parse(JSON.stringify(f.ledger));delete legacy.parents;
 const next=Ledger.demote(legacy,{excluded:[f.presentations[0]],strays:1},()=>null);
 assert.equal(Ledger.rows(Ledger.cellOf(next,cellKey)).rows.length,0);
 assert.equal(Ledger.before(next,'item:item.0',['attempt']),true);assert.doesNotThrow(()=>Ledger.validate(next));
});
test('a playback observed after the answer in either timestamp is not positive delivery evidence',()=>{
 const scope={domain:'LAB',workspace:'audio-time',subject:'synthetic'};let ms=T0,n=0;
 const session=A.createSession({scope,clock:()=>new Date(ms).toISOString(),id:()=>`audio.${++n}`});
 const decision=session.plan('documents',[{id:'standard',pace:'standard',minutes:5}]);ms+=1000;
 const p=session.practice('presented',{decisionId:decision.id,taskId:'audio',taskVersion:'v1',itemKey:'audio.item',conceptIds:[skill],firstExposure:true,measure:{skillId:skill,modality:'listening',difficulty:1,responseFormat:'single-choice',familyKey:'audio.family',audioRequired:true,confounded:false}});
 ms=T0+3000;const delivery=session.practice('delivery',{presentationId:p.id,audio:'completed'});ms=T0+4000;
 const attempt=session.practice('attempted',{presentationId:p.id,attemptNo:1,verdict:'correct',errorTags:[]});
 for(const fields of [{at:new Date(T0+2000).toISOString()},{at:new Date(T0+3500).toISOString(),recordedAt:new Date(T0+3500).toISOString()}]){
  const events=session.events().map(e=>e.id===attempt.id?{...e,...fields}:e.id===delivery.id&&fields.recordedAt?{...e,recordedAt:new Date(T0+4000).toISOString()}:e);
  assert.doesNotThrow(()=>A.createSession({scope,events}));
  const row=Trail.summarize(events,{scope,asOf:new Date(T0+10000).toISOString()}).attempts[0];
  assert.equal(row.independent,false);assert.equal(row.audio,'pending');
  const index=Trail.createIndex({scope});events.forEach(e=>index.add(e));
  assert.equal(index.attempt(attempt.id).independent,false);assert.equal(index.attempt(attempt.id).audio,'pending');
 }
 assert.equal(Trail.summarize(session.events(),{scope,asOf:new Date(T0+10000).toISOString()}).attempts[0].independent,true);
 const index=Trail.createIndex({scope});session.events().forEach(e=>index.add(e));assert.equal(index.attempt(attempt.id).independent,true);assert.equal(index.attempt(attempt.id).audio,'completed');
 const ledger=Ledger.fold(null,session.events(),{scope});
 assert.deepEqual(ledger.parents[attempt.id],[p.id,decision.id,delivery.id]);
 assert.equal(Ledger.rows(Ledger.cellOf(Ledger.demote(ledger,{excluded:[delivery.id]},()=>null),cellKey)).rows.length,0);
 const legacy=JSON.parse(JSON.stringify(ledger));legacy.parents[attempt.id].pop();assert.doesNotThrow(()=>Ledger.validate(legacy));
 assert.equal(Ledger.rows(Ledger.cellOf(Ledger.demote(legacy,{excluded:[delivery.id]},()=>null),cellKey)).rows.length,0);
});
