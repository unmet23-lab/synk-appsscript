import test from 'node:test';
import assert from 'node:assert/strict';
import {comboShield,shieldContact,resolveContact} from '../driving.js';

test('only successful multiples of three earn one held shield',()=>{
 assert.equal(comboShield(2,true,0),0);assert.equal(comboShield(3,true,0),1);
 assert.equal(comboShield(6,true,0),1);assert.equal(comboShield(9,true,1),1);
 assert.equal(comboShield(3,false,0),0);assert.equal(comboShield(0,false,1),1);
 assert.equal(comboShield(0,true,0),0);assert.equal(comboShield(3.5,true,0),0);
});

test('one shield preserves collision statistics, speed, boost and learning data once',()=>{
 const initial=Object.freeze({shield:1,collisions:2,velocity:40,boost:2.8,correct:3,medals:2});
 const hit={axis:'side',direction:1,impact:14},blocked=shieldContact(initial,hit);
 assert.deepEqual(blocked,{shield:0,collisions:2,velocity:40,boost:2.8,correct:3,medals:2,protected:true});
 assert.equal(initial.shield,1);
 const next=shieldContact(blocked,hit);
 assert.equal(next.protected,false);assert.equal(next.collisions,3);assert.equal(next.velocity,30.4);assert.equal(next.boost,.65);
 assert.equal(next.correct,3);assert.equal(next.medals,2);
});

test('unprotected contacts respect speed floor and never increase remaining boost',()=>{
 const hit={axis:'front',direction:-1,impact:2};
 const weak=shieldContact({shield:0,collisions:0,velocity:15,boost:.3},hit);
 assert.equal(weak.velocity,14);assert.equal(weak.boost,.3);assert.equal(weak.collisions,1);
 const absent=shieldContact({shield:1,collisions:0,velocity:30,boost:2},null);
 assert.deepEqual(absent,{shield:1,collisions:0,velocity:30,boost:2,protected:false});
});

test('a protected contact still separates physical vehicles',()=>{
 const player={offset:.3,s:100,velocity:40},rival={offset:0,s:100,speed:26};
 const hit=resolveContact(player,rival);assert(hit);assert(Math.abs(player.offset-rival.offset)>=2.32);
 const result=shieldContact({shield:1,collisions:0,velocity:40,boost:2},hit);
 assert.equal(result.protected,true);assert.equal(result.velocity,40);
});
