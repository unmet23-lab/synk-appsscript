import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyboardInput} from './controls.mjs';
import {RunnerModel,LANES} from './core.mjs';

function setup(){
  const keys=new KeyboardInput(),model=new RunnerModel({seed:1});
  model.events=[];model.generated=10000;
  const down=(code,repeat=false)=>{const action=keys.down(code,repeat);if(action)model.input(action);};
  const settle=()=>{for(let i=0;i<30;i++)model.step(.01);};
  return {keys,model,down,settle};
}

test('both outer lanes return to the center on one press, including duplicated keydown',()=>{
  for(const [out,back,lane] of [['ArrowRight','ArrowLeft',2],['ArrowLeft','ArrowRight',0]]){
    const {keys,model,down,settle}=setup();
    down(out);keys.up(out);settle();assert.equal(model.lane,lane);
    down(back);down(back);down(back,true);settle();
    assert.equal(model.lane,1);assert.ok(Math.abs(model.x-LANES[1])<.01);
  }
});
test('fresh consecutive taps still move from left through center to right',()=>{
  const {keys,model,down,settle}=setup();down('ArrowLeft');keys.up('ArrowLeft');
  down('ArrowRight');keys.up('ArrowRight');settle();assert.equal(model.lane,1);
  down('ArrowRight');keys.up('ArrowRight');settle();assert.equal(model.lane,2);
});
test('arrow and letter aliases held together cannot skip the middle lane',()=>{
  const {model,down,settle}=setup();down('ArrowRight');down('KeyD');
  down('ArrowLeft');down('KeyA');settle();assert.equal(model.lane,1);
});
test('blur or pause reset releases stuck keys for the next deliberate press',()=>{
  const {keys,model,down,settle}=setup();down('ArrowRight');keys.reset();
  down('ArrowLeft');settle();assert.equal(model.lane,1);assert.ok(Math.abs(model.x)<.01);
});
