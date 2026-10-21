import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedAppearance,createTownWorldHost} from '../world-town-client.mjs';
const snapshot=()=>({accountId:'a',revision:7,avatar:{slots:{body:'mongle-knit-butter',neck:'mongle-scarf-lapis'},dyes:{body:['#ABCDEF','#123456'],neck:['#8899aa','#aabbcc']}},inventory:[{itemId:'mongle-knit-butter'},{itemId:'mongle-scarf-lapis'}]});
test('confirmed town appearance carries only owned dyed slots with normalized independent colors',()=>{
  const world=snapshot(),value=confirmedAppearance(world);assert.deepEqual(value.dyes,{body:['#abcdef','#123456'],neck:['#8899aa','#aabbcc']});
  value.dyes.body[0]='#000000';assert.equal(world.avatar.dyes.body[0],'#ABCDEF');
  world.inventory.pop();assert.deepEqual(confirmedAppearance(world).dyes,{body:['#abcdef','#123456']});
  world.accountId=null;assert.deepEqual(confirmedAppearance(world).dyes,{});
});
test('host subscribers get new server dyes and an ended host clears them',async()=>{
  const client={snapshot:snapshot(),generation:1,async refresh(){this.snapshot.avatar.dyes={body:['#ff0000','#0000ff']};this.snapshot.revision++;return this.snapshot;}},host=createTownWorldHost(client),seen=[];
  const unsubscribe=host.subscribe(value=>seen.push(value));await host.refresh();assert.deepEqual(seen.at(-1).dyes,{body:['#ff0000','#0000ff']});
  host.dispose();assert.deepEqual(seen.at(-1).dyes,{});assert.equal(seen.at(-1).verified,false);unsubscribe();
});
