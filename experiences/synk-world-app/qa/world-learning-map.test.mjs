import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {worldMap,worldLearning} from '../world-learning-map.mjs';

// WORLD 코치만 TOPIK I+II 합친 지도를 쓴다(2026-10-21 ④). 한 기록에 섞인 TOPIK II 능력(ko2.*) 사건을
// TOPIK I 지도만 아는 코치(게임 엔진 atlas/game-browser.js)는 요약에서 건너뛰고, 자기 능력 기록은 그대로 읽는다.
const require=createRequire(import.meta.url);
const gameBrowser=require('../../../atlas/game-browser.js');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const measure=(id,skillId)=>({id,itemKey:`qa.${id}.v1`,familyKey:`qa.${id}`,skillId,modality:'reading',difficulty:1,responseFormat:'single-choice',audioRequired:false,confounded:false,conceptIds:[]});

test('합친 지도는 TOPIK I 능력과 TOPIK II 능력을 모두 갖고, 게임 엔진의 지도는 TOPIK I만이다',()=>{
 const ids=new Set(worldMap.allNodes().map(node=>node.id));
 assert.ok(ids.has('ko.listening.response')&&ids.has('ko.reading.main'));
 assert.ok(ids.has('ko2.reading.main')&&ids.has('ko2.listening.response'));
 assert.ok(!gameBrowser.SKILLS.some(node=>/^ko2\./.test(node.id||'')),'게임 엔진 지도에는 TOPIK II 능력이 없다');
 assert.ok(worldLearning.SKILLS.some(node=>node.id==='ko2.reading.main'));
});

test('섞인 기록: WORLD 코치가 남긴 ko2 답은 TOPIK I 지도 코치의 요약에서 빠지고, ko 답은 두 코치 모두 읽는다',()=>{
 let now=Date.parse('2026-10-21T01:00:00Z');const clock=()=>new Date(now+=1000).toISOString();
 const storage=memory();
 const world=worldLearning.engine.createGame({gameId:'world-home',storage,clock});
 const one=world.present(measure('topik1-main','ko.reading.main'));world.answer(one,{correct:true,assessable:true});
 const two=world.present(measure('topik2-main','ko2.reading.main'));world.answer(two,{correct:false,assessable:true});
 const wide=world.summary().skills;
 assert.ok(wide.some(skill=>skill.id==='ko2.reading.main'&&skill.n>0),'WORLD 코치는 ko2 답을 센다');
 const narrow=gameBrowser.engine.createGame({gameId:'world-home',storage,clock});
 const skills=narrow.summary().skills;
 assert.ok(!skills.some(skill=>/^ko2\./.test(skill.id)),'TOPIK I 지도 코치의 요약에는 ko2 능력이 없다');
 assert.equal(skills.find(skill=>skill.id==='ko.reading.main')?.n,wide.find(skill=>skill.id==='ko.reading.main')?.n,'ko 답은 같은 수로 읽는다');
});
