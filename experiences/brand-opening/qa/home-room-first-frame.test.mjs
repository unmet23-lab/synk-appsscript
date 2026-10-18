import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';

// 우리 집 3D 방의 첫 그림(synk-world-home/living-home-scene.mjs, 10-17 4차)을 실제 장면으로 본다.
// 창밖 한강 그림은 첫 그림에 함께 올라가고, 셰이더는 미리 엮어(compile + KHR_parallel_shader_compile) 다 될 때까지 그리지 않으며, 그사이 닫으면 오류 없이 접힌다.
// 이 PC의 GPU(ANGLE d3d11)로 띄운다 — 소프트웨어 WebGL(SwiftShader)에는 KHR_parallel_shader_compile이 없어 미리 엮기 확인을 건너뛴다.
// 계정·저장·네트워크는 쓰지 않고 이 저장소의 파일만 내준다.
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary'};
const fixture='<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}#room{width:390px;height:700px}</style><div id="room"></div>';
let server,browser,base;
before(async()=>{
 server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://fixture.invalid');
  if(url.pathname==='/room.html'){res.setHeader('Content-Type',types['.html']);res.end(fixture);return;}
  const name=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!name.startsWith(root+path.sep))throw Error('outside fixture');
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(await readFile(name));
 }catch{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
// 기록: 셰이더가 다 됐는지 묻기(ready/busy)와 그 뒤의 그리기(draw)·새 셰이더 만들기(new)를 차례로, 창 그림이 GPU로 올라간 횟수를 센다.
function probe(){
 const P=window.__probe={log:[],uploads:0,onPoll:null},C=WebGL2RenderingContext.prototype,COMPLETION_STATUS_KHR=0x91B1,ids=new WeakMap();let made=0;
 // 묻기 기록에는 셰이더 번호를 붙인다(ready:3·busy:3) — 바쁘다던 셰이더가 다 됐다고 답한 뒤에 그렸는지 본다.
 const ask=C.getProgramParameter;C.getProgramParameter=function(program,name){const value=ask.call(this,program,name);if(name===COMPLETION_STATUS_KHR){P.log.push(`${value?'ready':'busy'}:${ids.get(program)??'?'}`);P.onPoll?.();}return value;};
 const create=C.createProgram;C.createProgram=function(){const program=create.call(this);ids.set(program,++made);if(P.log.length)P.log.push('new');return program;};
 for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const draw=C[name];C[name]=function(...args){if(P.log.length&&P.log.at(-1)!=='draw')P.log.push('draw');return draw.apply(this,args);};}
 for(const name of ['texImage2D','texSubImage2D']){const upload=C[name];C[name]=function(...args){if(args.some(a=>a instanceof HTMLImageElement&&/window-hangang/.test(a.src)))P.uploads++;return upload.apply(this,args);};}
}
async function roomPage(t){
 const context=await browser.newContext({viewport:{width:390,height:700},isMobile:true,hasTouch:true});t.after(()=>context.close());
 await context.addInitScript(probe);
 const page=await context.newPage();const failed=[];page.on('pageerror',e=>failed.push(e.message));
 await page.goto(`${base}/room.html`);
 t.after(()=>assert.deepEqual(failed,[],'no page error'));
 const parallel=await page.evaluate(()=>!!document.createElement('canvas').getContext('webgl2')?.getExtension('KHR_parallel_shader_compile'));
 return {page,parallel};
}

// 그림자를 켜는 PC 화질(balanced)로 본다 — 그림자 깊이 셰이더까지 미리 엮였는지가 같이 걸린다.
test('창밖 한강 그림은 첫 그림에 함께 올라가고, 셰이더가 다 엮이기 전에는 그리지 않으며 첫 그림이 새 셰이더를 만들지 않는다',{timeout:120000},async t=>{
 const {page,parallel}=await roomPage(t);
 const result=await page.evaluate(async()=>{
  const {mountLivingHomeScene}=await import('/experiences/synk-world-home/living-home-scene.mjs');
  const errors=[],api=await mountLivingHomeScene(document.querySelector('#room'),{quality:'balanced',onError:e=>errors.push(String(e))});
  const out={frames:api.metrics().frames,uploads:__probe.uploads,log:__probe.log.join(' '),errors};api.dispose();return out;
 });
 assert.deepEqual(result.errors,[]);
 assert.equal(result.frames,1,'mount resolves after exactly one frame');
 assert.ok(result.uploads>=1,'the window image is uploaded with the first frame, not after it');
 if(!parallel){t.diagnostic('KHR_parallel_shader_compile 없음: 미리 엮기 확인은 건너뜀');return;}
 const log=result.log.split(' '),draw=log.indexOf('draw'),before=log.slice(0,draw);
 assert.ok(log.some(x=>x.startsWith('ready:'))&&draw>=0,`shaders were polled before the first frame (${result.log.slice(0,200)})`);
 assert.ok(!log.slice(draw).some(x=>x.startsWith('busy:')),`nothing is drawn while a shader is still compiling (${result.log.slice(0,200)})`);
 // 6초 한도로 그냥 그린 것이 아니다 — 바쁘다고 답한 셰이더마다 그 뒤에 다 됐다고 답했다.
 const busy=[...new Set(before.filter(x=>x.startsWith('busy:')).map(x=>x.slice(5)))];
 assert.deepEqual(busy.filter(id=>before.lastIndexOf(`ready:${id}`)<before.lastIndexOf(`busy:${id}`)),[],'every shader that was still compiling reported ready before the first frame');
 // 처음 물어본 뒤로는 새 셰이더가 없어야 한다(그림자 판은 본 그리기보다 먼저 셰이더를 만드니 draw 기준으로 세지 않는다).
 const asked=log.findIndex(x=>/^(ready|busy):/.test(x));
 assert.equal(log.slice(asked).filter(x=>x==='new').length,0,`the first frame (shadow pass included) finds every shader already compiled (${log.slice(asked,asked+40).join(' ')})`);
});

test('셰이더를 엮는 동안 방을 닫으면 오류 없이 접히고 캔버스도 남지 않는다',{timeout:120000},async t=>{
 const {page,parallel}=await roomPage(t);
 if(!parallel){t.skip('KHR_parallel_shader_compile 없음');return;}
 const result=await page.evaluate(async()=>{
  const {mountLivingHomeScene}=await import('/experiences/synk-world-home/living-home-scene.mjs');
  const host=document.querySelector('#room'),controller=new AbortController(),errors=[];
  // 셰이더가 다 됐는지 처음 물어보는 그 순간에 닫는다.
  __probe.onPoll=()=>{__probe.onPoll=null;controller.abort();};
  const outcome=await mountLivingHomeScene(host,{quality:'low',signal:controller.signal,onError:e=>errors.push(String(e))}).then(()=>'mounted',e=>e?.name);
  await new Promise(resolve=>setTimeout(resolve,400));
  return {outcome,errors,closedWhileWarming:__probe.onPoll===null,canvases:host.querySelectorAll('canvas').length};
 });
 assert.deepEqual(result,{outcome:'AbortError',errors:[],closedWhileWarming:true,canvases:0});
});
