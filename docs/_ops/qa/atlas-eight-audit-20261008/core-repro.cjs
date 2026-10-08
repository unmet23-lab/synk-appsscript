'use strict';
// Read-only audit reproduction: synthetic records, no network or product writes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Core = require('../../../../atlas/engine');
const Trail = require('../../../../atlas/trail');
const Game = require('../../../../atlas/game-learning');
const Strata = require('../../../../strata');
const scope = {domain:'LAB', workspace:'audit', subject:'synthetic'};
let serial = 0, tick = Date.parse('2026-10-08T00:00:00.000Z');
const session = Core.createSession({scope, clock:()=>new Date(tick+=1000).toISOString(), id:()=>`audit.${++serial}`});
session.observe({kind:'need', key:'skill.ko.reading.detail', strength:0.9, n:8});
const candidates = [{id:'standard',minutes:3,pace:'standard'}];
const levers = [{id:'focus',class:'content',options:[{id:'detail',targets:['need:skill.ko.reading.detail']}]}];
const decision = session.plan('reading',candidates,{levers});
const presentation = session.practice('presented',{decisionId:decision.id,taskId:'read',taskVersion:'v1',itemKey:'read.new',conceptIds:['ko.reading.detail'],firstExposure:true});
const attempt = session.practice('attempted',{presentationId:presentation.id,attemptNo:1,verdict:'correct',errorTags:[]});
const completion = session.complete(decision);
const definition = {measure:'independent',window:'immediate',assisted:false,attemptId:attempt.id,targetLine:'need:skill.ko.reading.detail'};
const original = session.outcome(decision.id,{...definition,value:1});
const correction = session.outcome(decision.id,{...definition,value:0.2});
const before = session.plan('reading',candidates,{levers});
session.exclude(correction.id);
const after = session.plan('reading',candidates,{levers});
assert.equal(before.outcomeBasis,'unobserved');
assert.equal(after.outcomeBasis,'performance');
assert.equal(session.state().outcomes[0].id,original.id);

// Comparable existing feedback contract: excluding a correction does not revive
// the previous feedback (also covered in tests/atlas.test.js:32-41).
session.feedback(completion.id,'too_much');
const correctedFeedback = session.feedback(completion.id,'want_more');
session.exclude(correctedFeedback.id);
assert.equal(session.state().feedback.length,0);

const events = session.events();
const reordered = Object.fromEntries(Object.entries(presentation).reverse());
const trailCount = Trail.summarize([...events,reordered],{scope,asOf:new Date(tick+1000).toISOString()}).presentations.length;
let sessionError = null;
try {Core.createSession({scope,events:[...events,reordered]});} catch (e) {sessionError=e.message;}
assert.equal(trailCount,1);
assert.equal(sessionError,'Atlas: conflicting event id');

// The product restore path reaches Core.createSession. Its normal sync import
// canonicalizes duplicates before this call, so this only proves a stored-log
// compatibility failure, not a demonstrated failure of normal remote sync.
const disk = new Map();
const storage = {getItem:key=>disk.get(key)??null,setItem:(key,value)=>disk.set(key,value)};
const map = Strata.createMap(require('../../../../strata/maps/topik-i.json'));
const options = {gameId:'audit',map,storage,clock:()=>new Date(tick+10000).toISOString()};
const game = Game.createGame(options);
const pid = game.present({id:'audit.item',itemKey:'audit.item',skillId:'ko.reading.detail',difficulty:1,modality:'reading',responseFormat:'single-choice'});
game.answer(pid,{correct:true,assessable:true});
const key = `${Game.KEY}.device`;
const saved = JSON.parse(disk.get(key));
const storedPresentation = saved.events.find(e=>e.type==='practice.presented');
saved.events.push(Object.fromEntries(Object.entries(storedPresentation).reverse()));
disk.set(key,JSON.stringify(saved));
const restored = Game.createGame(options).summary();
assert.equal(restored.storage.available,false);

const result = {
  source:'current local atlas/engine.js',
  outcomeExclusion:{line:218,original:original.id,correction:correction.id,before:before.outcomeBasis,after:after.outcomeBasis,returnedOutcomes:session.state().outcomes.map(row=>({id:row.id,value:row.value})),comparableFeedbackCount:session.state().feedback.length,expected:'After excluding the latest outcome, no earlier report for that same decision/measure/window/target becomes current.'},
  reorderedDuplicate:{line:121,trailPresentations:trailCount,coreError:sessionError,productRestoreStorageAvailable:restored.storage.available,productRestoreWarning:restored.storage.warning,expected:'An otherwise equal JSON event with different property order remains an idempotent replay.',limitation:'Normal game-learning importEvents and local merge already use canonical sameEvent; no normal-sync failure claimed.'}
};
fs.writeFileSync(path.join(__dirname,'core-repro-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
