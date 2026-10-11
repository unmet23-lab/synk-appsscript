import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TUTORS} from '../tutor-profiles.mjs';
import {readTutorChoice,saveTutorChoice,choiceKey} from '../tutor-choice.mjs';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};};
test('the three introduction cards stay equal to the approved source',()=>{
 const approved=JSON.parse(fs.readFileSync(new URL('../../../docs/캐릭터/소개글_정본.json',import.meta.url),'utf8')).카드;
 assert.equal(TUTORS.length,3);
 for(const tutor of TUTORS)assert.deepEqual(tutor.card,approved.find(card=>card.캐릭터===tutor.name));
});
test('a committed tutor is restored only for its owner',()=>{
 const data=storage();assert.equal(saveTutorChoice(data,'guest','marin'),true);
 assert.equal(readTutorChoice(data),'marin');assert.equal(readTutorChoice(data,'account-a'),null);
 saveTutorChoice(data,'account-a','mongle');saveTutorChoice(data,'account-b','kkamong');
 assert.equal(readTutorChoice(data,'account-a'),'mongle');assert.equal(readTutorChoice(data,'account-b'),'kkamong');assert.equal(readTutorChoice(data),'marin');
});
test('corrupt, unfinished and unknown records cannot skip first meeting',()=>{
 const data=storage();for(const value of ['broken','null','{"version":1,"completed":false,"tutor":"marin"}','{"version":2,"completed":true,"tutor":"marin"}','{"version":1,"completed":true,"tutor":"other"}']){data.setItem(choiceKey('guest'),value);assert.equal(readTutorChoice(data),null);}
 assert.throws(()=>saveTutorChoice(data,'guest','other'),TypeError);
});
test('blocked storage leaves first meeting usable and reports failure to persist',()=>{
 const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(readTutorChoice(blocked),null);assert.equal(saveTutorChoice(blocked,'guest','marin'),false);assert.equal(readTutorChoice(null),null);assert.equal(saveTutorChoice(null,'guest','mongle'),false);
});
