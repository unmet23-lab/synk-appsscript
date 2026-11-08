import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
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

// 생활 한국어 과제 마디 22(Atlas × WORLD D, 11-08)와 말하기 유형 6마디(E, 11-08)는 WORLD 코치 지도에만 싣는다 — 게임 묶음은 기본 지도 그대로이고,
// 코치 지도판은 그 기본판 뒤에 생활 층 판 · 말하기 층 판이 붙는다(재확인 짝은 능력 칸으로 맺어 지도판이 달라도 끊기지 않는다).
test('환승 러시 묶음의 지도는 WORLD 기본 지도와 판이 같고(strata/world-map.js 한 곳), WORLD 코치 지도는 그 위에 생활 · 말하기 층만 더한다',()=>{
 const box={console};vm.createContext(box);vm.runInContext(fs.readFileSync(new URL('../../subway-rush/atlas-learning.js',import.meta.url),'utf8'),box);
 const game=box.SynkLearning.createGame({gameId:'subway-rush',storage:memory(),clock:()=>'2026-11-05T00:00:00.000Z'});
 const base=require('../../../strata/index.js').createMap(require('../../../strata/world-map.js').worldMapData());
 assert.equal(game.mapVersion,base.map_ver);
 // 지도판 = 기본판 + 층 판들의 지문 하나(strata/world-coach.js) — Trail 식별자 120자 안(층 판을 이어 붙이면 126자로 모든 제시가 던졌다, E 11-08).
 const layers=[require('../../../strata/world-life.js').layer().layer_ver,require('../../../strata/topik-speaking.js').layer().layer_ver];
 assert.equal(worldMap.map_ver,`${base.map_ver}:layers-${require('../../../strata/world-coach.js').fingerprint(layers.join('|'))}`);
 assert.ok(worldMap.map_ver.length<=120,worldMap.map_ver);
 assert.equal(worldLearning.engine.createGame({gameId:'world-home',storage:memory(),clock:()=>'2026-11-05T00:00:00.000Z'}).mapVersion,worldMap.map_ver);
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
