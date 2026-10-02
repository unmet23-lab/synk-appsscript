import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {automaticQuality,qualitySettings,slowerQuality,createPausedFrameGate} from '../graphics.js';

test('paused frames settle once then stop submitting work; active frames always render',()=>{
  const gate=createPausedFrameGate(),state=['high',1.75,1280,720,'marin',{}];
  for(let i=0;i<120;i++)assert.equal(gate.shouldRender({dt:1/60,state}),true);
  let submitted=0;
  for(let i=0;i<120;i++)submitted+=Number(gate.shouldRender({paused:true,dt:1/60,state}));
  assert(submitted>=60&&submitted<=61,'camera and field of view settle for about one second');
  for(let i=0;i<120;i++)assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),false);
  assert.equal(gate.shouldRender({paused:false,dt:1/60,state}),true,'resume immediately renders');
  assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),true,'a later pause receives its own settle window');
});

test('paused appearance and size changes repaint, then settle back to zero draws',()=>{
  const gate=createPausedFrameGate(),state=['high',1.75,1280,720,'marin',{},'coast'];
  const freeze=()=>{for(let i=0;i<90;i++)gate.shouldRender({paused:true,dt:1/60,state});};
  freeze();
  for(const [index,value] of [[0,'low'],[1,1],[2,390],[3,844],[4,'kkamong'],[5,{}],[6,'sunset']]){
    assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),false);
    state[index]=value;
    assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),true,`state ${index} repaints`);
    freeze();
    assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),false);
  }
});

test('hidden tabs never render and a frozen view refreshes when shown again',()=>{
  const gate=createPausedFrameGate(),state=['balanced',390,844];
  for(let i=0;i<90;i++)gate.shouldRender({paused:true,dt:1/60,state});
  for(const paused of [false,true])for(let i=0;i<10;i++)assert.equal(gate.shouldRender({paused,hidden:true,dt:1,state}),false);
  assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),true);
  for(let i=0;i<90;i++)gate.shouldRender({paused:true,dt:1/60,state});
  assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),false);
});

test('same-size canvas resets repaint a paused frame, including a changed display pixel ratio',()=>{
  const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const resizeFunction=appSource.slice(appSource.indexOf('function resize('),appSource.indexOf('async function init('));
  const gate=createPausedFrameGate(),state=['high',1280,720];
  let ratio=1,resets=0;
  const context={
    pausedFrameGate:gate,qualitySettings,mode:'high',currentQuality:'auto',capture4k:false,devicePixelRatio:1,
    renderQuality:qualitySettings('high'),mobile:false,running:false,
    stage:{clientWidth:1280,clientHeight:720},camera:{updateProjectionMatrix(){}},
    renderer:{getPixelRatio:()=>ratio,setPixelRatio:value=>{ratio=value;resets++;},setSize:()=>{resets++;}}
  };
  const freeze=()=>{for(let i=0;i<90;i++)gate.shouldRender({paused:true,dt:1/60,state});};
  freeze();assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),false);
  runInNewContext(resizeFunction+'\nresize();',context);
  assert.equal(resets,1);assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),true,'same-size clear must repaint');
  freeze();context.devicePixelRatio=2;
  runInNewContext(resizeFunction+'\nresize();',context);
  assert.equal(ratio,1.75);assert.equal(context.renderQuality.pixelRatio,1.75);
  assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),true,'moving to a different DPR display must repaint');
  freeze();assert.equal(gate.shouldRender({paused:true,dt:1/60,state}),false);
});

test('automatic quality does not downgrade a narrow desktop and preserves phone shadows',()=>{
  assert.equal(automaticQuality({coarsePointer:false}),'high');
  assert.equal(automaticQuality({coarsePointer:true,memoryGB:4,cores:6}),'balanced');
  assert.equal(automaticQuality({coarsePointer:true,memoryGB:2,cores:4}),'low');
  const phone=qualitySettings('balanced',{pixelRatio:3});
  assert.equal(phone.pixelRatio,1.4);assert.equal(phone.shadows,true);assert.equal(phone.shadowSize,1024);
});

test('sustained slow frames reduce quality one step, stable frames preserve it',()=>{
  assert.equal(slowerQuality('high',.041),'balanced');
  assert.equal(slowerQuality('balanced',.041),'low');
  assert.equal(slowerQuality('low',.1),'low');
  assert.equal(slowerQuality('high',1/60),'high');
  assert.equal(slowerQuality('balanced',NaN),'balanced');
});

test('finishing asset loading preserves a quality selected while loading',async()=>{
  const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const qualityFunctions=appSource.slice(appSource.indexOf('function setQuality('),appSource.indexOf('function resize('));
  const startupQuality=appSource.match(/\n\s+(setQuality\([^;\n]+\));reset\(false\);/);
  assert(startupQuality,'the asset-loading completion must apply the render quality');
  for(const {selected,listenerRegistered} of ['auto','high','balanced','low'].flatMap(selected=>[
    {selected,listenerRegistered:false},{selected,listenerRegistered:true}
  ])){
    let finishAssets;
    const renderState={};
    const qualityControl={value:'auto'};
    const context={
      currentQuality:'auto',mode:'high',deviceGraphics:{coarsePointer:false},
      capture4k:true,devicePixelRatio:2,automaticQuality,qualitySettings,
      assetsReady:new Promise(resolve=>{finishAssets=resolve;}),
      $(id){assert.equal(id,'quality');return qualityControl;},
      renderer:{setPixelRatio:value=>{renderState.pixelRatio=value;},shadowMap:{}},
      scenery:{atmosphere:{setQuality:value=>{renderState.waterQuality=value;}}},
      light:{shadow:{mapSize:{x:2048,setScalar(value){this.x=value;}}}},
      resize(){},adaptiveTime:0,frameSample:[]
    };
    // Run the app's real quality functions and its initialization call across
    // a controllable asset-loading boundary, rather than checking a literal.
    const initialized=runInNewContext(`${qualityFunctions}\n(async()=>{await assetsReady;${startupQuality[1]};})()`,context);
    qualityControl.value=selected;
    // The select is usable before the module's change listener is installed.
    if(listenerRegistered)runInNewContext(`setQuality('${selected}')`,context);
    finishAssets();await initialized;
    const expectedMode=selected==='auto'?'high':selected;
    assert.equal(context.currentQuality,selected,`${selected} was overwritten when loading finished`);
    assert.equal(context.mode,expectedMode);
    assert.equal(renderState.waterQuality,expectedMode,'water detail follows the quality selected during loading');
    assert.equal(renderState.pixelRatio,qualitySettings(expectedMode,{pixelRatio:2,explicit:selected!=='auto'}).pixelRatio);
    assert.equal(context.renderer.shadowMap.enabled,selected!=='low');
  }
});
