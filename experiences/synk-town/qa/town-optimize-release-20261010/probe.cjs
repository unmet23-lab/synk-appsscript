// QA-only extension of the preserved v10 native-input/completed-frame helper.
// Product sources are read, never edited. Only ephemeral in-memory fixtures.
const fs=require('node:fs'), path=require('node:path'), Module=require('node:module');
const town=path.resolve(__dirname,'../..'), out=path.join(__dirname,process.argv[2]||'before');
if(fs.existsSync(path.join(out,'browser.json')))throw Error('Refusing to overwrite original evidence');
fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync(path.join(town,'qa-brand-v10.cjs'),'utf8');
const split=original.indexOf('(async()=>{const startedAt=');
if(split<0)throw Error('Preserved helper boundary absent');
let helpers=original.slice(0,split).replace("const output = path.join(__dirname, 'qa/graphics-v10'), snapshot = path.join(output, 'source-before');",`const output = ${JSON.stringify(out)}, snapshot = path.join(output, 'source-before');`).replace("path.join(output, 'baseline-hashes.json')","path.join(__dirname, 'qa/graphics-v10/baseline-hashes.json')").replace("path.join(output, 'logic-before.json')","path.join(__dirname, 'qa/graphics-v10/logic-before.json')").replace("path.join(output, 'assets-before.json')","path.join(__dirname, 'qa/graphics-v10/assets-before.json')");
helpers=helpers.replace('rendering:m.rendering,quality:m.quality','rendering:m.rendering,occlusionReuse:m.occlusionReuse,shadowFocus:m.shadowFocus,quality:m.quality');
const body=String.raw`
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'qa/town-livable-10/final/source-manifest.json'),'utf8'));
const owned=require(path.join(__dirname,'qa/town-livable-10/owned-browser-evidence.cjs'));
const qaArgs=['--enable-webgl','--ignore-gpu-blocklist','--disk-cache-size=10485760','--media-cache-size=1048576','--disable-gpu-shader-disk-cache'];
const provenance={startedAt:new Date().toISOString(),capturePid:process.pid,diagnosticMode:process.argv.includes('--instrument'),scope:process.argv.includes('--instrument')?'DIAGNOSTIC ONLY browser route transformations for CPU pass timing, GPU query and program-change counters; screenshots/FPS are diagnostic rather than originalproduct evidence. Default appearance/DPR/AO/shadow/quality maintained. Temporary memory stores; no4288access.':'Source-current originals; no source monkeypatch in screenshot/completed-frame samples. CPU profiler separately recorded after originals. Native WASD, default appearance/DPR/AO/shadow/quality maintained. Temporary memory stores; no4288access.',cacheCondition:'10MiB disk cache /1MiB media cache/shader disk cache disabled',sourceHashes:Object.fromEntries(manifest.sources.map(r=>[r.name,hash(path.join(__dirname,r.name))])),assets:Object.fromEntries(manifest.assets.map(r=>[r.name,hash(path.join(__dirname,r.name))]))};
function save(file,value){fs.writeFileSync(path.join(output,file),JSON.stringify(value,null,2)+'\n');}
function summarizeCpu(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])), self=new Map(), inclusive=new Map(), parents=new Map();
 for(const n of profile.nodes)for(const child of n.children||[])parents.set(child,n.id);
 profile.samples.forEach((id,i)=>{const dt=profile.timeDeltas[i]||0;self.set(id,(self.get(id)||0)+dt);for(let p=id;p;p=parents.get(p))inclusive.set(p,(inclusive.get(p)||0)+dt);});
 const totalUs=profile.timeDeltas.reduce((a,b)=>a+b,0),row=(id,us)=>({function:nodes.get(id).callFrame.functionName||'(anonymous)',url:nodes.get(id).callFrame.url,line:nodes.get(id).callFrame.lineNumber+1,ms:us/1000,percent:100*us/totalUs});
 return{totalMs:totalUs/1000,sampleCount:profile.samples.length,self:[...self].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([id,us])=>row(id,us)),inclusive:[...inclusive].sort((a,b)=>b[1]-a[1]).slice(0,50).map(([id,us])=>row(id,us)),method:'CDP V8 sample CPU profiler1000us; inclusive stacks may include native WebGL driver wait; not GPU elapsed time.'};
}
async function cpuProfile(page,name){
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await page.evaluate(()=>{comfortSamples=[];comfortPhase='cpu-profile';comfortLastFrame=-1;comfortRecord=true;});await delay(7200);
 const rows=await page.evaluate(()=>{comfortRecord=false;return comfortSamples;});const result=await cdp.send('Profiler.stop');await cdp.detach();
 save(name+'.cpuprofile',result.profile);save(name+'-cpu-summary.json',summarizeCpu(result.profile));metrics[name+'-cpuProfile']={summary:summarizeCpu(result.profile),frames:rows.length,samples:rows,method:'Diagnostic CDP CPU sampling; separate from original no-source-patch frames.'};console.log(JSON.stringify({event:'cpu-profile',name,summary:summarizeCpu(result.profile).self.slice(0,8)}));
}
async function visit(browser,width,height){
 const {base}=await fixture(), page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,...(width<700?{isMobile:true,hasTouch:true}:{})});await observe(page,'perf-original-'+width);
 if(process.argv.includes('--instrument')){
  const instrument=require(path.join(__dirname,'qa/town-optimize-release-20261010/instrument.cjs'));await instrument.init(page);
  const sourceRows=new Map(manifest.sources.map(r=>[r.name.startsWith('../synk-world-home/')?'/'+r.name.slice('../synk-world-home/'.length):'/'+r.name,r]));
  await page.route('**/*',async route=>{const name=new URL(route.request().url()).pathname,row=sourceRows.get(name);if(!row||!['/day-scene.mjs','/day-rendering.mjs','/scene-assets/three.module.js'].includes(name))return route.continue();const source=fs.readFileSync(path.join(__dirname,row.name),'utf8'),transformed=instrument.transform(name,source);if(source===transformed)throw Error('No diagnostic transform: '+name);await route.fulfill({status:200,contentType:'text/javascript',body:transformed});});
 }
 await page.goto(base+'/day.html?play=walk');await page.waitForFunction(()=>globalThis.SYNKTownDay?.metrics()?.assetsReady&&SYNKTownDay.metrics().walk?.enabled,{},{timeout:60000});await focus(page);await quiet(page);await delay(700);
 metrics[width+'-adapter']=await page.evaluate(()=>{const gl=document.querySelector('#scene canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,vendor:e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):null,timerQueryAvailable:Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2'))};});
 await capture(page,width,'home-follow');await layout(page,width,'home');
 console.log(JSON.stringify({event:'original-home',width,frames:metrics[width+'-home-follow-renderProfile'].frames,cpu:metrics[width+'-home-follow-renderProfile'].cpuRenderMs}));
 if(width===1280&&!process.argv.includes('--instrument'))await cpuProfile(page,'1280-home');
 if(process.argv.includes('--instrument'))await stageProfile(page,width+'-home');
 await axis(page,'x',-3);await axis(page,'z',2.5);await axis(page,'x',0);await capture(page,width,'cafe-follow');
 if(width===1280&&!process.argv.includes('--instrument'))await cpuProfile(page,'1280-cafe');
 if(process.argv.includes('--instrument'))await stageProfile(page,width+'-cafe');
 await axis(page,'x',-3);await axis(page,'z',-4);await axis(page,'x',0);await capture(page,width,'greenhouse-follow');await layout(page,width,'greenhouse');
 console.log(JSON.stringify({event:'original-greenhouse',width,frames:metrics[width+'-greenhouse-follow-renderProfile'].frames,cpu:metrics[width+'-greenhouse-follow-renderProfile'].cpuRenderMs}));
 if(width===1280&&!process.argv.includes('--instrument'))await cpuProfile(page,'1280-greenhouse');
 if(process.argv.includes('--instrument'))await stageProfile(page,width+'-greenhouse');
 metrics[width+'-final']=await gameMetrics(page);await page.close();
}
async function stageProfile(page,name){
 await page.evaluate(()=>{Object.assign(__qaPerf,{record:true,rows:[],programs:{},reasons:{},gpu:[],ticks:0});comfortRecord=false;});await delay(7200);const r=await page.evaluate(()=>{__qaPerf.record=false;return{rows:__qaPerf.rows,programs:__qaPerf.programs,reasons:__qaPerf.reasons,gpuMs:__qaPerf.gpu,pendingGpuQueries:__qaPerf.pending.length};});save(name+'-stages.json',{scope:'DIAGNOSTIC ONLY: browser-served source route timing and counters, every8th GPU whole-frame EXT_disjoint_timer_query_webgl2 query; no blocking GPU wait. Defaults/appearance unchanged. Not original product perf or screenshots.',...r});console.log(JSON.stringify({event:'stage-profile',name,frames:r.rows.length,topPrograms:Object.entries(r.programs).sort((a,b)=>b[1]-a[1]).slice(0,8),topReasons:Object.entries(r.reasons).sort((a,b)=>b[1]-a[1]).slice(0,8),gpuSamples:r.gpuMs.length}));
}
(async()=>{let browser,failure=null,gpuClosed=false;const cleanupEvents=[];try{
 save('provenance.json',provenance);for(const r of manifest.sources){const file=path.join(output,'source',r.snapshot);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(__dirname,r.name),file);}
 browser=await chromium.launch({channel:'msedge',headless:true,args:qaArgs});const census=await owned.census();save('launch.json',{args:qaArgs,census,capturePid:process.pid});
 console.log(JSON.stringify({event:'launched',pid:process.pid,browserPids:census.rows?.map(r=>r.pid)}));
 await visit(browser,1280,900);if(!process.argv.includes('--instrument'))await visit(browser,390,844);
 check('no-javascript-errors',errors.length===0,errors);check('no-console-errors',consoleErrors.length===0,consoleErrors);check('no-webgl-shader-warnings',shaderWarnings.length===0,shaderWarnings);check('no-failed-assets',failedRequests.length===0,failedRequests);check('no-memory-api-errors',apiFailures.length===0,apiFailures);
 check('39-source-stable',manifest.sources.every(r=>hash(path.join(__dirname,r.name))===provenance.sourceHashes[r.name]));check('9-protected-assets-stable',manifest.assets.every(r=>hash(path.join(__dirname,r.name))===provenance.assets[r.name]));
 }catch(e){failure=e.stack||String(e);console.error(failure);}finally{
 const make=()=>({...provenance,finishedAt:new Date().toISOString(),checks,metrics,screenshots,errors,consoleErrors,shaderWarnings,failedRequests,apiFailures,failure,gpuClosed,cleanupEvents});
 save('browser-before-cleanup.json',make());const beforeCensus=await owned.census();cleanupEvents.push({type:'before-close',...beforeCensus});
 for(const server of servers){server.closeAllConnections();await ownedDeadline(new Promise(resolve=>server.close(resolve)),3000);}
 const closeStart=Date.now();gpuClosed=!browser||await ownedDeadline(browser.close().then(()=>true),20000);cleanupEvents.push({type:'browser-close',elapsedMs:Date.now()-closeStart,gpuClosed,connected:browser?.isConnected()});
 if(!gpuClosed)failure='Owned browser.close exceeded20s; raw result preserved.';const afterCensus=await owned.census();cleanupEvents.push({type:'after-close',...afterCensus});
 if(beforeCensus.available&&beforeCensus.rows.length&&afterCensus.available&&!afterCensus.rows.length){gpuClosed=true;save('shutdown-final.json',{capturePid:process.pid,beforeCensus,afterCensus,gpuClosed,forcedStop:false,profileDeletion:0,originalFailurePreserved:!!failure});}
 save('browser.json',make());console.log(JSON.stringify({event:'finished',failure,gpuClosed,checks:checks.length,output}));process.exitCode=failure?1:0;
 }})();
async function ownedDeadline(promise,ms){let timer;try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),ms);})]);}finally{clearTimeout(timer);}}
`;
const compiled=new Module(path.join(town,'qa-perf-diagnostic-runtime.cjs'),module);compiled.filename=path.join(town,'qa-perf-diagnostic-runtime.cjs');compiled.paths=Module._nodeModulePaths(town);compiled._compile(helpers+body,compiled.filename);
