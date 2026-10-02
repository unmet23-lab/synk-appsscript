import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {automaticQuality,qualitySettings,slowerQuality} from '../graphics.js';

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
    assert.equal(renderState.pixelRatio,qualitySettings(expectedMode,{pixelRatio:2,explicit:selected!=='auto'}).pixelRatio);
    assert.equal(context.renderer.shadowMap.enabled,selected!=='low');
  }
});
