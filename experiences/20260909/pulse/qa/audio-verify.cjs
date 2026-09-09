'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const playwright = require(process.argv[2] || 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const evidence = { at: new Date().toISOString(), source: 'Original Web Audio synthesis; no imported recordings', checks: [], metrics: {}, limits: ['Browser audio rendering and waveform measurements are not human headphone/speaker listening.', 'Hidden-tab pause is tested with a visibility event and hidden-property fixture; real OS tab suspension varies.', 'Spatial presence is a zone-based stereo mix, not measured surround acoustics.'] };
const pass = name => { evidence.checks.push({ name, result: 'passed' }); process.stdout.write(`PASS ${name}\n`); };
const server = http.createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});return res.end('<!doctype html><html lang="ko"><head><title>PULSE audio check</title></head><body><button id="start">소리 시작</button></body></html>');}
  const abs=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!abs.startsWith(root+path.sep)||!fs.existsSync(abs)||path.extname(abs)!=='.js'){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':'text/javascript'});fs.createReadStream(abs).pipe(res);
});
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function prepare(page) {
  await page.evaluate(async()=>{
    const Base=window.AudioContext;
    window.AudioContext=class extends Base{
      constructor(...args){super(...args);window.testContext=this;}
      createDynamicsCompressor(){const node=super.createDynamicsCompressor();const analyser=super.createAnalyser();analyser.fftSize=2048;node.connect(analyser);window.testAnalyser=analyser;return node;}
    };
    const {createPulseAudio}=await import('/audio.js');
    window.audio=createPulseAudio({onState:state=>window.audioState=state});
    document.querySelector('#start').addEventListener('click',()=>audio.start());
  });
}
async function measure(page, duration=550) {
  return page.evaluate(async(duration)=>{
    const values=[],buffer=new Float32Array(testAnalyser.fftSize),end=performance.now()+duration;
    while(performance.now()<end){testAnalyser.getFloatTimeDomainData(buffer);let square=0,peak=0;for(const x of buffer){square+=x*x;peak=Math.max(peak,Math.abs(x));}values.push({rms:Math.sqrt(square/buffer.length),peak});await new Promise(r=>setTimeout(r,25));}
    return{rms:values.reduce((sum,x)=>sum+x.rms,0)/values.length,peak:Math.max(...values.map(x=>x.peak))};
  },duration);
}
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext(),page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await prepare(page);
    assert.equal((await page.evaluate(()=>audio.getState())).contextState,'not-created');pass('no context or playback before a user click');
    await page.click('#start');await page.waitForFunction(()=>audio.getState().contextState==='running');await wait(900);
    const audible=await measure(page);assert.ok(audible.rms>.003,JSON.stringify(audible));evidence.metrics.liveMix=audible;pass('real Chrome click starts nonzero audio output');
    assert.equal(await page.evaluate(async()=>{const {createPulseAudio}=await import('/audio.js');return createPulseAudio()===audio;}),true);pass('same-page repeated creation reuses one engine');
    await page.evaluate(()=>{audio.setMix({music:.32,effects:.21});audio.mute(true);});await wait(450);
    const muted=await measure(page);assert.ok(muted.rms<.000001,JSON.stringify(muted));evidence.metrics.muted=muted;pass('master mute ramps to silence');
    await page.reload();await prepare(page);let state=await page.evaluate(()=>audio.getState());assert.equal(state.muted,true);assert.equal(state.music,.32);assert.equal(state.effects,.21);assert.equal(state.contextState,'not-created');pass('mix and mute persist without autoplay after reload');
    await page.click('#start');await page.evaluate(()=>{audio.mute(false);audio.setMix({music:0,effects:.74});audio.updateScene({zone:'tram',phase:'explore'});audio.play('tram');});await wait(350);
    const effectsOnly=await measure(page);assert.ok(effectsOnly.rms>.002);await page.evaluate(()=>audio.setMix({music:.68,effects:0}));await wait(1500);const musicOnly=await measure(page);assert.ok(musicOnly.rms>.002);evidence.metrics.separateBuses={effectsOnly,musicOnly};pass('music and effects buses independently produce audio');
    const second=await context.newPage();await second.goto(base);await prepare(second);await second.click('#start');await wait(450);
    assert.equal((await page.evaluate(()=>audio.getState())).contextState,'suspended');assert.equal((await second.evaluate(()=>audio.getState())).contextState,'running');pass('another same-origin tab takes ownership without double playback');
    await page.click('#start');await wait(400);assert.equal((await page.evaluate(()=>audio.getState())).contextState,'running');assert.equal((await second.evaluate(()=>audio.getState())).contextState,'suspended');pass('user can reclaim audio in the first tab');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await wait(350);assert.equal((await page.evaluate(()=>audio.getState())).contextState,'suspended');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await wait(350);assert.equal((await page.evaluate(()=>audio.getState())).contextState,'running');pass('visibility pause and return resume preserve one context');
    await page.evaluate(()=>{for(const name of ['step','paper','switch','inspect','share','vote','confirm','tram','radio'])audio.play(name);audio.updateScene({zone:'harbor',phase:'ended',ending:'homes'});audio.updateScene({zone:'radio',phase:'ended',ending:'station'});audio.updateScene({zone:'tram',phase:'ended',ending:'lighthouse'});});await wait(500);assert.deepEqual(errors,[]);pass('all effects and ending transitions execute without browser errors');
    await page.evaluate(()=>audio.destroy());await second.evaluate(()=>audio.destroy());
    const rendered=await page.evaluate(async()=>{
      const {createSoundGraph,createAcousticPalette,createHarborAmbience,scheduleScoreBar,BAR_SECONDS}=await import('/audio-score.js');
      const sr=44100,duration=42,ctx=new OfflineAudioContext(2,sr*duration,sr),graph=createSoundGraph(ctx),score=createAcousticPalette(ctx,graph.musicBus,{wet:.27}),fx=createAcousticPalette(ctx,graph.effectsBus,{wet:.16}),ambience=createHarborAmbience(ctx,fx,graph.effectsBus);
      ambience.update('harbor');
      for(let bar=0;bar<8;bar++)scheduleScoreBar(score,bar,.15+bar*BAR_SECONDS,{phase:'explore'});
      for(let bar=0;bar<4;bar++)scheduleScoreBar(score,bar,27+bar*BAR_SECONDS,{phase:'ended',ending:'lighthouse'});
      for(const [name,time,pan] of [['step',3,-.2],['step',3.6,.2],['paper',8,-.3],['switch',12,.2],['tram',17,-.35],['radio',21,.4],['share',24,0],['confirm',26,0]])fx.effect(name,time,{pan});
      graph.masterBus.gain.setValueAtTime(.82,39.5);graph.masterBus.gain.linearRampToValueAtTime(0,41.8);
      const buffer=await ctx.startRendering();
      let peak=0,square=0,clips=0;const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
      const bytes=new Uint8Array(44+buffer.length*4),view=new DataView(bytes.buffer),text=(at,value)=>[...value].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
      text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sr,true);view.setUint32(28,sr*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,buffer.length*4,true);
      let stereoDifference=0;
      for(let i=0;i<buffer.length;i++){for(let c=0;c<2;c++){const value=c?right[i]:left[i];peak=Math.max(peak,Math.abs(value));square+=value*value;if(Math.abs(value)>=1)clips++;view.setInt16(44+i*4+c*2,Math.round(Math.max(-1,Math.min(1,value))*32767),true);}stereoDifference+=Math.abs(left[i]-right[i]);}
      let encoded='';for(let i=0;i<bytes.length;i+=16384)encoded+=String.fromCharCode(...bytes.subarray(i,i+16384));
      return{base64:btoa(encoded),metrics:{duration,sampleRate:sr,channels:2,peak,peakDb:20*Math.log10(peak),rms:Math.sqrt(square/(buffer.length*2)),rmsDb:20*Math.log10(Math.sqrt(square/(buffer.length*2))),clips,stereoDifference:stereoDifference/buffer.length}};
    });
    assert.equal(rendered.metrics.clips,0);assert.ok(rendered.metrics.peak<.90);assert.ok(rendered.metrics.rms>.006);assert.ok(rendered.metrics.stereoDifference>.001);
    const wav=Buffer.from(rendered.base64,'base64');fs.writeFileSync(path.join(__dirname,'audio-sample.wav'),wav);evidence.metrics.sample={...rendered.metrics,sha256:createHash('sha256').update(wav).digest('hex'),bytes:wav.length};pass('42-second original stereo sample renders with headroom and no clipped frames');
    fs.writeFileSync(path.join(__dirname,'audio-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);try{server.close();}catch{}process.exitCode=1;});
