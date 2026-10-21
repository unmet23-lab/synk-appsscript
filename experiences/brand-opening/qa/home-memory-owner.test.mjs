import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHomeMemory} from '../home-memory.mjs';
import {homeDayKey} from '../home-tutor-days.mjs';
import {lifeTutorExpression} from '../life-tutor-lines.mjs';
import {LESSONS} from '../../synk-world-app/life-content.mjs';

const NOW=Date.parse('2026-10-12T15:00:00+09:00');
const lesson=LESSONS.find(item=>item.id==='greetings-expressions');
const source=readFileSync(new URL('../home.mjs',import.meta.url),'utf8');
function functionSource(start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`home controller contains ${start}`);return source.slice(from,to);
}
const controller=[functionSource('function updateLearning(','function showPlay('),functionSource('function updateAccount(','export const home=')].join('\n');
function learned(owner,index=0){
  const question=lesson.questions[index];
  return {summary:{owner,status:{phase:'ready'}},details:{lessons:LESSONS,snapshot:{owner,daily:{days:{[homeDayKey(NOW)]:{items:{[question.id]:{lessonId:lesson.id,observedAt:NOW,outcome:'independent'}}}}}}},text:lifeTutorExpression(lesson,question)};
}
function harness(){
  const state={changes:[],closedPanels:0,revoked:[],tutorOwner:'guest'},nodes=new Map();
  const memory=createHomeMemory({now:()=>NOW,eventTarget:null,documentTarget:null,subscribeAlbum:()=>()=>{},
    onChange:value=>state.changes.push(value),
    createAlbum:({accountId})=>({
      list:async()=>accountId==='owner-a'?[{id:'a-photo',accountId,createdAt:NOW}]:[],
      get:async()=>({id:'a-photo',accountId,createdAt:NOW,blob:new Blob(['synthetic'],{type:'image/png'})}),close(){}
    }),
    url:{createObjectURL:()=> 'blob:owner-a-photo',revokeObjectURL:value=>state.revoked.push(value)}
  });
  const ports={memory,homeTutor:{update(){},refresh(){}},tutorUI:{setOwner:value=>{state.tutorOwner=value;}},
    $(selector){if(selector==='#life-next-button')return null;if(!nodes.has(selector))nodes.set(selector,{textContent:'',dataset:{},setAttribute(){}});return nodes.get(selector);},
    panelClosed(){state.closedPanels++;}
  };
  const api=new Function('ports',`
    const {memory,homeTutor,tutorUI,$}=ports;
    let accountOwner='guest',learningData={},panelKind='';
    function closePanel(){panelKind='';ports.panelClosed();}
    ${controller}
    return {updateLearning,updateAccount,openMemory(){panelKind='memory';},owner:()=>accountOwner};
  `)(ports);
  return {...api,state,memory,
    learn(value){api.updateLearning(value.summary,value.details);},
    account(owner){api.updateAccount({snapshot:owner==='guest'?null:{accountId:owner}});},
    flush:()=>new Promise(setImmediate),dispose:()=>memory.dispose()
  };
}

test('guest learning arriving before logout account update survives the owner switch',async()=>{
  const h=harness(),member=learned('owner-a',1),guest=learned('guest');
  h.account('owner-a');h.learn(member);await h.flush();assert.equal(h.memory.snapshot().text,member.text);
  h.openMemory();h.learn(guest);assert.equal(h.memory.snapshot().text,'');
  h.account('guest');await h.flush();
  assert.equal(h.memory.snapshot().status,'ready');assert.equal(h.memory.snapshot().text,guest.text);
  assert.equal(h.memory.snapshot().photoUrl,'');assert.equal(h.state.closedPanels,1);
  assert.deepEqual(h.state.revoked,['blob:owner-a-photo']);h.dispose();
});

test('logout account update arriving first clears the old owner until guest learning arrives',async()=>{
  const h=harness(),member=learned('owner-a',1),guest=learned('guest');
  h.account('owner-a');h.learn(member);await h.flush();assert.equal(h.memory.snapshot().photoId,'a-photo');
  h.account('guest');assert.equal(h.memory.snapshot().text,'');assert.equal(h.memory.snapshot().photoUrl,'');
  assert.equal(h.memory.snapshot().status,'loading');h.learn(guest);await h.flush();
  assert.equal(h.memory.snapshot().text,guest.text);assert.equal(h.memory.snapshot().status,'ready');h.dispose();
});

test('switching to another account without its learning clears both prior expression and photo',async()=>{
  const h=harness();h.account('owner-a');h.learn(learned('owner-a'));await h.flush();
  assert.ok(h.memory.snapshot().text);assert.equal(h.memory.snapshot().photoId,'a-photo');
  h.account('owner-b');assert.equal(h.memory.snapshot().text,'');assert.equal(h.memory.snapshot().photoUrl,'');await h.flush();
  assert.equal(h.owner(),'owner-b');assert.equal(h.memory.snapshot().status,'loading');assert.equal(h.memory.snapshot().photoId,'');h.dispose();
});

test('new account learning that arrives first is kept, but a mismatched snapshot is never displayed',async()=>{
  const h=harness(),next=learned('owner-b',1);h.account('owner-a');h.learn(learned('owner-a'));await h.flush();
  h.learn(next);h.account('owner-b');await h.flush();assert.equal(h.memory.snapshot().text,next.text);
  h.learn({summary:next.summary,details:learned('owner-a').details});await h.flush();
  assert.equal(h.memory.snapshot().text,'');assert.equal(h.memory.snapshot().status,'loading');h.dispose();
});
