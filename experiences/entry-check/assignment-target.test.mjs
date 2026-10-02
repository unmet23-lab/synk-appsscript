import test from 'node:test';
import assert from 'node:assert/strict';
import {VENUES} from './content.mjs';
import {assignmentCases,assignmentVenues,caseMetadata} from './learning.mjs';
test('every assigned guest is reachable at its real venue independently of campaign unlocks',()=>{
 for(const venue of VENUES)for(const guest of venue.cases){
  const m=caseMetadata(guest),target={...m,familyKeys:[m.familyKey],itemKeys:[m.itemKey],requiredAttempts:1};
  assert.deepEqual(assignmentVenues(target).map(v=>v.id),[venue.id]);
  assert.deepEqual(assignmentCases(venue.cases,target).map(c=>c.id),[guest.id]);
  assert.equal(assignmentCases(venue.cases,{...target,responseFormat:'action'}).length,0);
 }
});
test('next venue prioritizes still unattempted target families across different notices',()=>{
 const all=VENUES.flatMap(v=>v.cases),m=caseMetadata(all[0]);
 const same=all.filter(c=>{const x=caseMetadata(c);return x.skillId===m.skillId&&x.difficulty===m.difficulty;});
 const target={...m,familyKeys:same.map(c=>caseMetadata(c).familyKey),itemKeys:same.map(c=>caseMetadata(c).itemKey)};
 const first=assignmentVenues(target)[0],seen=assignmentCases(first.cases,target).map(c=>c.id);
 if(assignmentVenues(target).length>1)assert.notEqual(assignmentVenues(target,seen)[0].id,first.id);
});
