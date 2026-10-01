'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const motion=require('../tools/lib/loom-motion.js');
const scope={window:{LoomMotion:motion}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/엔진/atlas-constellation-20260921/constellation.js'),'utf8'),scope);

test('hovering adjacent features preserves their established label sides and follows gentle node motion',()=>{
  const graph=Object.create(scope.window.AtlasConstellation.prototype);
  const group={id:'core',engine:{name:'Core'},focus:1,color:[255,255,255],light:[255,255,255],hub:{p:{x:80,y:80},chroma:0,appearance:1}};
  const make=(index,localIndex,x)=>({index,localIndex,group:0,concept:'Feature '+index,p:{x,y:200},inspect:0,appearance:1});
  Object.assign(graph,{ctx:new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),groups:[group],nodes:[make(1,3,250),make(2,1,260)],width:1000,height:600,dt:1/60,paused:false,hovered:null,selected:null,hoveredFeature:null,labelState:new Map(),featureBoxes:[],labelAppearance:()=>1,nucleusRadius:()=>20,textSprite:()=>({width:70,w:90,h:32,pad:10,canvas:{}})});
  const draw=()=>graph.drawLabels({x:800,y:500},false);
  for(let i=0;i<90;i++)draw();
  const state=graph.labelState.get('concept:1'),initialSlot=state.slot,initialX=state.x;
  graph.hovered='core';graph.hoveredFeature=2;
  for(let i=0;i<90;i++)draw();
  assert.equal(state.slot,initialSlot,'hover must not move an existing label to another side');
  assert.ok(Math.abs(state.x-initialX)<.001,'stationary node keeps the same label position');
  const second=graph.labelState.get('concept:2'),secondSlot=second.slot;
  for(let i=0;i<120;i++){graph.hoveredFeature=i%2?1:2;draw();}
  assert.equal(state.slot,initialSlot);
  assert.equal(second.slot,secondSlot);
  graph.nodes[0].p.x+=2;
  for(let i=0;i<120;i++)draw();
  assert.ok(Math.abs(state.x-initialX-2)<.01,'label follows the small motion of its own point');
});
