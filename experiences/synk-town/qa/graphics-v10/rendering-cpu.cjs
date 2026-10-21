// Actual Three scratch values, mocked direct renderer; no GPU or user state.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
(async()=>{
 const town=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(town,'day-rendering.mjs'),'utf8');
 const T=await import(pathToFileURL(path.resolve(town,'../synk-world-home/scene-assets/three.module.js')));
 const create=new Function('THREE',source.replace(/^import[^\n]*\n/gm,'').replace('export function createTownRendering','function createTownRendering')+'\nreturn createContactLight;')(T);
 const checks=[],check=(name,ok)=>checks.push({name,ok:ok===true});
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),initialBackground=new T.Color('#bcddec'),initialOverride=new T.MeshNormalMaterial();scene.background=initialBackground;scene.overrideMaterial=initialOverride;
 const clear=new T.Color('#183544'),viewport=new T.Vector4(1,2,640,480),scissor=new T.Vector4(3,4,600,400),target={name:'original-target'};
 const references={clear:[],viewport:[],scissor:[]};let renders=0,throwRender=false,contextLost=false;
 const renderer={isWebGLRenderer:true,info:{autoReset:true,render:{calls:0,triangles:0},reset(){this.render.calls=this.render.triangles=0;}},shadowMap:{autoUpdate:true,needsUpdate:true},autoClear:false,clearAlpha:.6,target,scissorTest:true,
 getContext:()=>({isContextLost:()=>contextLost}),getDrawingBufferSize:v=>v.set(640,480),getRenderTarget(){return this.target;},setRenderTarget(v){this.target=v;},getClearAlpha(){return this.clearAlpha;},getClearColor(v){references.clear.push(v);return v.copy(clear);},setClearColor(v,a){clear.copy(v);this.clearAlpha=a;},getViewport(v){references.viewport.push(v);return v.copy(viewport);},setViewport(v){viewport.copy(v);},getScissor(v){references.scissor.push(v);return v.copy(scissor);},setScissor(v){scissor.copy(v);},getScissorTest(){return this.scissorTest;},setScissorTest(v){this.scissorTest=v;},
 render(s,c){if(s!==scene||c!==camera)throw Error('wrong-scene');renders++;this.info.render.calls=7;this.info.render.triangles=42;clear.set('#ff0000');viewport.set(9,9,9,9);scissor.set(8,8,8,8);this.target=null;this.scissorTest=false;this.autoClear=true;this.shadowMap.autoUpdate=false;this.shadowMap.needsUpdate=false;scene.background=null;scene.overrideMaterial=null;if(throwRender)throw Error('test-render-failure');}};
 const state=()=>({clear:clear.getHexString(),viewport:viewport.toArray(),scissor:scissor.toArray(),target:renderer.target===target,scissorTest:renderer.scissorTest,autoClear:renderer.autoClear,alpha:renderer.clearAlpha,shadowAuto:renderer.shadowMap.autoUpdate,shadowUpdate:renderer.shadowMap.needsUpdate,infoAuto:renderer.info.autoReset,background:scene.background===initialBackground,override:scene.overrideMaterial===initialOverride});
 const original=JSON.stringify(state()),contact=create({renderer,scene,camera,quality:'light'});contact.render();
 check('direct-beauty-renders-original-scene-once',renders===1);
 check('direct-render-restores-all-renderer-scene-state',JSON.stringify(state())===original);
 check('direct-mode-allocates-no-AO-targets',contact.metrics().enabled===false&&contact.metrics().allocations===0&&contact.metrics().estimatedTargetBytes===0);
 check('render-counts-come-from-actual-stub-submission',contact.metrics().drawCalls===7&&contact.metrics().triangles===42);
 contact.render();check('scratch-color-viewport-scissor-reused',Object.values(references).every(rows=>rows.length===2&&rows[0]===rows[1]));
 contact.setQuality('balanced',{mobile:true});contact.setSize();contact.render();check('mobile-balanced-remains-direct-zero-targets',contact.metrics().enabled===false&&contact.metrics().allocations===0);
 throwRender=true;let renderError=null;try{contact.render();}catch(e){renderError=e.message;}
 check('render-error-is-not-swallowed',renderError==='test-render-failure');
 check('render-error-finally-restores-state',JSON.stringify(state())===original);
 throwRender=false;contextLost=true;const oldRenders=renders;let lostError=null;try{contact.render();}catch(e){lostError=e.message;}
 check('context-loss-fails-before-submission',lostError==='CONTACT_CONTEXT_LOST'&&renders===oldRenders&&JSON.stringify(state())===original);
 contextLost=false;contact.dispose();contact.dispose();let disposedError=null;try{contact.render();}catch(e){disposedError=e.message;}
 check('disposed-renderer-fails-and-disposal-is-idempotent',disposedError==='CONTACT_DISPOSED'&&contact.metrics().disposed===true);
 let invalid=false;try{create({renderer:{},scene,camera});}catch(e){invalid=e instanceof TypeError&&e.message==='CONTACT_SCENE_REQUIRED';}check('invalid-scene-contract-fails-closed',invalid);
 initialOverride.dispose();
 const report={checkedAt:new Date().toISOString(),scope:'Actual Three Color/Vector scratch and mocked direct-render state/error tests. AO implementation is unchanged by exact inverse AST; full GPU behavior/resources are checked separately. No benchmark or GPU quality claim.',source:'day-rendering.mjs',sha256:crypto.createHash('sha256').update(source).digest('hex'),checks,passed:checks.every(c=>c.ok===true)};
 fs.writeFileSync(path.join(__dirname,'rendering-cpu.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.ok)}));if(!report.passed)process.exitCode=1;
})();
