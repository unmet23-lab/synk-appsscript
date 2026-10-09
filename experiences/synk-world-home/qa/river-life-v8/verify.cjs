const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs'), path = require('path');
const html = `<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="module">
import * as THREE from '/scene-assets/three.module.js';
import {createRiverLife} from '/river-life-v8.mjs';
const scene=new THREE.Scene();scene.background=new THREE.Color('#aec8cc');scene.fog=new THREE.Fog('#aec8cc',18,80);
scene.add(new THREE.HemisphereLight('#e6f1ee','#809286',2));const light=new THREE.DirectionalLight('#fff0d6',3);light.position.set(-5,8,6);scene.add(light);
const river=createRiverLife({scene,mobile:false});
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,600);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const plane=new THREE.Mesh(new THREE.PlaneGeometry(100,50),new THREE.MeshStandardMaterial({color:'#57838c',roughness:.3}));plane.rotation.x=-Math.PI/2;plane.position.set(0,-1.16,-20);scene.add(plane);
const camera=new THREE.PerspectiveCamera(37,1000/600,.1,150);camera.position.set(2.2,2.5,-14.1);camera.lookAt(-1.2,-.60,-22.2);
renderer.render(scene,camera);window.test={THREE,scene,river,renderer,camera,render:()=>renderer.render(scene,camera)};
</script>`;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], checks = [];
  try {
    const page = await browser.newPage({viewport:{width:1000,height:600}});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.route('**/__river-life-v8-unit',route=>route.fulfill({contentType:'text/html',body:html}));
    await page.goto('http://127.0.0.1:4296/__river-life-v8-unit');await page.waitForFunction(()=>window.test?.river.metrics);
    const result = await page.evaluate(() => {
      const {scene,river,renderer}=test,checks=[];const ok=(label,value)=>checks.push({label,pass:!!value});
      const initial=river.metrics,group=scene.getObjectByName('han-river-passing-launch-v8');
      ok('one named boat',!!group?.getObjectByName('cream-and-navy-river-launch'));
      ok('four opaque material batches',group.children[0].children.length===4);
      ok('five additional draw calls',initial.drawCalls===5);
      ok('mesh triangle count below 3500',initial.triangles<3500);
      ok('initial route position',initial.position[0]===-1.2&&initial.position[1]===-1.16&&initial.position[2]===-22.2);
      ok('no new targets lights or textures',initial.extraRenderTargets===0&&initial.extraLights===0&&initial.textureCount===0);
      river.update(.1,true);ok('reduced motion freezes',river.metrics.elapsed===0&&river.metrics.position[0]===-1.2);
      river.update(.1,false);ok('motion advances gently right',river.metrics.elapsed===.1&&river.metrics.position[0]>-1.2&&river.metrics.position[0]<-1.17);
      river.update(10,false);ok('long frame delta clamped',river.metrics.elapsed===.2);
      for(const dt of [NaN,Infinity,-1,0])river.update(dt,false);ok('invalid deltas ignored',river.metrics.elapsed===.2);
      const water=group.getObjectByName('launch-contact-reflection-and-wake');
      ok('water decal stays planar',water.position.y===0&&water.material.depthWrite===false);
      ok('water and vessel share route group',water.parent===group&&group.children[0].parent===group);
      ok('wake clock follows vessel clock',water.material.uniforms.uPhase.value===river.metrics.elapsed);
      ok('water decal over water surface',Math.abs(water.geometry.boundingSphere.center.y-.014)<.001);
      river.setTime('sunset');ok('sunset palette',river.metrics.time==='sunset');
      test.render();ok('renderer compiled programs and five vessel draws',renderer.info.programs.length>=3&&renderer.info.render.calls===6);
      let wrapSeen=false,previous=river.metrics.position[0];
      for(let i=0;i<3100;i++){river.update(.1,false);const current=river.metrics.position[0];if(current<previous){wrapSeen=true;ok('wrap occurs at outer route bounds',previous>51.9&&current<-51.9);}previous=current;}
      ok('route loops',wrapSeen);ok('position stays in route',river.metrics.position[0]>=-52&&river.metrics.position[0]<52);
      const moving=river.metrics.elapsed;river.dispose();river.update(.1);ok('disposal stops updates',river.metrics.disposed&&river.metrics.elapsed===moving);
      river.dispose();ok('disposal idempotent',river.metrics.disposed);
      return {checks,initial,final:river.metrics,renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}};
    });
    checks.push(...result.checks);await page.screenshot({path:path.join(__dirname,'boat-close-sunset.png')});
    // A fresh route starts on the left and provides a repeatable detail image.
    await page.reload();await page.waitForFunction(()=>window.test?.river.metrics);await page.screenshot({path:path.join(__dirname,'boat-close-day.png')});
    fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({...result,errors},null,2));
    console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),errors,initial:result.initial},null,2));
    if(errors.length||checks.some(c=>!c.pass))process.exitCode=1;
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
