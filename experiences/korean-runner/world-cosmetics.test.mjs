import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from './vendor/three.module.js';
import {RunnerModel} from './core.mjs';
import {createCosmeticLayer,normalizeCosmetics,cosmeticBudget,DEFAULT_COSMETICS,SCENERY_THEMES} from './world-cosmetics.mjs';

function fixture(){const scene=new T.Scene(),materials=new Map(),felt=color=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.94}));return materials.get(color);};const layer=createCosmeticLayer({scene,felt,plain:color=>new T.MeshStandardMaterial({color})}),player=new T.Group();player.position.z=3;const model=new RunnerModel({seed:1});return {scene,layer,player,model};}
test('unrecognized cosmetic IDs fall back to a complete usable wardrobe',()=>{
  assert.deepEqual(normalizeCosmetics(null),DEFAULT_COSMETICS);
  assert.deepEqual(normalizeCosmetics({trail:'broken',companion:'cloud',lantern:'firefly',other:true}),{...DEFAULT_COSMETICS,companion:'cloud',lantern:'firefly'});
  for(const theme of Object.values(SCENERY_THEMES))assert.ok(theme.ambient>=1.7&&theme.direct>=2.4,'all scenery keeps the road lit');
});
test('trails, companions, three lantern styles and finish effects are real scene objects',()=>{
  const {scene,layer,player,model}=fixture();
  for(const trail of ['petals','starlight','footprints']){layer.setSelection({trail,companion:'sparrow',lantern:'flower',finish:'festival'});for(let i=0;i<60;i++)layer.update(.02,model,{running:true,player});assert.ok(layer.info.activeTrail>0);assert.equal(scene.getObjectByName('trail-'+trail).visible,true);assert.equal(layer.info.companionVisible,true);}
  for(const style of ['paper','flower','firefly']){const lantern=layer.makeLantern(style);assert.equal(lantern.name,'lantern-'+style);assert.ok(lantern.children.length>=5);}
  layer.setSelection({finish:'flowers',companion:'cloud'});model.finished=true;layer.update(.1,model,{running:true,paused:true,player});assert.equal(layer.info.finishVisible,true);assert.equal(layer.info.companionVisible,true);
  for(let i=0;i<50;i++)layer.update(.1,model,{running:true,paused:true,player});assert.equal(layer.info.finishVisible,false,'completion decoration stops after its short celebration');
});
test('cosmetic pools stay bounded and do not alter movement, survival, learning or sound state',()=>{
  const {scene,layer,player,model}=fixture();layer.setSelection({trail:'starlight',lantern:'firefly',companion:'cloud',scenery:'moonlight',finish:'festival'});
  let beforeObjects=0;scene.traverse(()=>beforeObjects++);const before=JSON.stringify(model);
  for(let i=0;i<10000;i++){if(i%4===0)layer.effect('step',model);layer.update(.02,model,{running:true,player,quality:'performance'});assert.ok(layer.info.activeTrail<=12);assert.ok(layer.info.lanternFlashes<=2);}
  let afterObjects=0;scene.traverse(()=>afterObjects++);assert.equal(afterObjects,beforeObjects);assert.equal(JSON.stringify(model),before);assert.equal(layer.info.trailCapacity,24);assert.equal(layer.info.finishCapacity,28);
  layer.update(.02,model,{running:true,player,reduced:true});assert.deepEqual(layer.info.budget,cosmeticBudget('experience',true));assert.ok(layer.info.activeTrail<=6);
});
