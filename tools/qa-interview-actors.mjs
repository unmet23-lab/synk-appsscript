import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = fileURLToPath(new URL('../experiences/path-vr/', import.meta.url));
const qa = path.join(root, 'qa/interview-actors'); await mkdir(qa, { recursive: true });
const html = `<!doctype html><style>body{margin:0;background:#28292c}canvas{display:block}</style><script type="module">
import * as THREE from '/vendor/three.module.js';
import {createInterviewActors} from '/interview/actors.mjs';
const scene=new THREE.Scene();scene.background=new THREE.Color('#c4c4c1');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1440,960);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x77706c,2.0));
const light=new THREE.DirectionalLight(0xfff2dd,2.3);light.position.set(-2,4,3);light.castShadow=true;light.shadow.mapSize.set(1024,1024);scene.add(light);
const mesh=(w,h,d,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.7}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m;};
mesh(10,.1,10,0,-.08,0,0x92958e);mesh(7,3,.1,0,1.5,-2.7,0xd1d0ca);mesh(4.6,.08,1.1,0,.72,-.38,0x684c39);
const camera=new THREE.PerspectiveCamera(47,1.5,.05,50);camera.position.set(0,1.22,2.35);camera.lookAt(0,1.08,-1.35);
const cast=await createInterviewActors(THREE,scene);window.qa={THREE,scene,renderer,camera,cast};
window.draw=(t,state={})=>{cast.update(t,state,camera.position);renderer.render(scene,camera);};window.draw(0);window.ready=true;
</script>`;
const server = http.createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; }
  const relative = decodeURIComponent(req.url.split('?')[0]).slice(1);
  if (!relative.startsWith('vendor/') && !relative.startsWith('interview/') && !relative.startsWith('assets/interview/actors/')) { res.writeHead(404); res.end(); return; }
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const body = await readFile(absolute); res.writeHead(200, { 'Content-Type': absolute.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const errors = [], external = [], checks = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon.ico')) errors.push(m.text()); });
page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
const check = (name, condition) => { checks.push({ name, passed: !!condition }); assert.ok(condition, name); };
try {
  await page.goto(base); await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  await page.screenshot({ path: path.join(qa, 'panel.png') });
  const loaded = await page.evaluate(() => {
    const { cast, renderer, THREE } = window.qa;
    return { actors: cast.actors.map(a => ({ id: a.id, morphMeshes: a.meshes.length, texturedMeshes: a.meshes.filter(m => m.material.map?.image).length, head: a.head.getWorldPosition(new THREE.Vector3()).toArray(), root: a.root.position.toArray() })), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  });
  check('three separate skinned humans loaded', loaded.actors.length === 3 && loaded.actors.every(a => a.morphMeshes === 3));
  check('skin, suit and hair textures really loaded', loaded.actors.every(a => a.texturedMeshes === 3));
  check('head height fits seated interview', loaded.actors.every(a => a.head[1] > 1.05 && a.head[1] < 1.35));
  const animated = await page.evaluate(() => {
    for(let i=0;i<120;i++)window.draw(i/60,{speaker:'lead',speaking:true,amplitude:.8});
    const actor=window.qa.cast.actors[0];
    const mouth=actor.meshes[0].morphTargetInfluences[actor.meshes[0].morphTargetDictionary.AK_25_JawOpen];
    const second=window.qa.cast.actors[1];
    const silent=second.meshes[0].morphTargetInfluences[second.meshes[0].morphTargetDictionary.AK_25_JawOpen];
    return {mouth,silent,yaw:second.yaw};
  });
  check('speaking mouth opens while other actors stay silent', animated.mouth > .1 && animated.silent === 0);
  await page.screenshot({ path: path.join(qa, 'panel-speaking.png') });
  await page.evaluate(() => {
    for(let i=120;i<540;i++)window.draw(i/60,{speaker:'lead',speaking:false,listening:true,phase:'answering'});
    const {camera}=window.qa;camera.position.set(1.25,1.3,.4);camera.lookAt(1.4,1.18,-1.35);window.draw(9,{listening:true,phase:'answering'});
  });
  await page.screenshot({ path: path.join(qa, 'observer-close.png') });
  await page.evaluate(() => { const {camera}=window.qa;camera.position.set(-1.35,1.3,.35);camera.lookAt(-1.4,1.14,-1.35);window.draw(9.1); });
  await page.screenshot({ path: path.join(qa, 'specialist-close.png') });
  const blink = await page.evaluate(() => {window.draw(.095);const a=window.qa.cast.actors[0];return a.meshes[0].morphTargetInfluences[a.meshes[0].morphTargetDictionary.AK_09_EyeBlinkLeft];});
  check('eyelid morph closes', blink > .8);
  check('no browser errors', errors.length === 0); check('no external runtime requests', external.length === 0);
  await page.evaluate(() => { window.qa.cast.dispose(); window.qa.cast.dispose(); window.qa.renderer.dispose(); });
  await writeFile(path.join(qa, 'verification.json'), JSON.stringify({ checkedAt: '2026-10-11', checks, loaded, animated, errors, external, hardwareVR: 'not-tested', limitations: ['Realistic-style 3D game characters, not photoreal video', 'Procedural speech envelope is not phoneme lip sync', 'Browser visual QA only, headset presence unverified'] }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, loaded, animated, errors, external }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
