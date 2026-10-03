import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_CONTENT,gameItems} from './game-catalog.mjs';

// 교사 목록의 게임 라벨은 그 게임에 실제로 있는 문항의 능력만 보여 준다(10-03 감사: 레이싱이 없는 낱말 듣기를 내걸었다).
test('game labels list exactly the skills of the questions the game really has',()=>{
  for(const c of GAME_CONTENT){
    const actual=new Set(gameItems(c).map(i=>i.skillId));
    assert.ok(c.skillIds.length>0,c.id);
    assert.deepEqual(new Set(c.skillIds),actual,c.id);
    assert.ok(c.skillIds.every(s=>s.startsWith(`ko.${c.modality}.`)),c.id);
  }
});
