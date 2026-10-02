'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {spawnSync}=require('node:child_process');const OUT=__dirname,ROOT=path.resolve(OUT,'../../../..');
const MODULES='C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';const {chromium}=require(path.join(MODULES,'playwright'));
const FF='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){const m=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'))),issues=[];const v=m.probe?.streams.find(s=>s.codec_type==='video');
  if(!v||v.width!==1080||v.height!==1920||v.avg_frame_rate!=='30/1'||v.pix_fmt!=='yuv420p'||v.color_range!=='tv'||v.color_space!=='bt709'||v.color_transfer!=='bt709'||v.color_primaries!=='bt709')issues.push('Video format/color');
  if(m.probe?.streams.some(s=>s.codec_type==='audio'))issues.push('Unexpected audio');if(Number(v?.duration)!==65)issues.push('Duration');
  for(const s of m.sources)if(sha(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256)issues.push('Source drift '+s.path);
  if(sha(fs.readFileSync(path.join(OUT,m.file+'.mp4')))!==m.mp4Sha256)issues.push('Output drift');
  if(m.officialVision!==require(path.join(ROOT,'tools/lib/비전정본.js')).loadVisions().lab.headline)issues.push('Vision');
  if(m.mnChecks.some(c=>!c.exactExisting)||m.nativeReviewed||m.newTranslation||m.published)issues.push('Language/publishing boundary');
  for(const f of m.actualFonts){const expected=f.lang==='mn'?'Inter Tight':'SUIT Variable';if(!f.fonts.some(x=>x.familyName.includes(expected)&&x.isCustomFont)||f.fonts.some(x=>!x.isCustomFont))issues.push('Actual font '+f.lang);}
  const decode=spawnSync(FF,['-hide_banner','-loglevel','error','-i',path.join(OUT,m.file+'.mp4'),'-f','null','-'],{encoding:'utf8',windowsHide:true});if(decode.status!==0||decode.stderr.trim())issues.push('Full decode '+decode.stderr);
  const result={checkedAt:new Date().toISOString(),issues,fullDecodePassed:decode.status===0&&!decode.stderr.trim(),silentByDesign:true,nativeReviewed:false,published:false};
  if(process.argv.includes('--play')){
    const server=http.createServer((req,res)=>{let p;try{p=path.resolve(OUT,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));}catch{res.writeHead(400);return res.end();}if(!p.startsWith(OUT+path.sep)){res.writeHead(403);return res.end();}if(!fs.existsSync(p)){res.writeHead(404);return res.end();}const b=fs.readFileSync(p),type=p.endsWith('.mp4')?'video/mp4':p.endsWith('.png')?'image/png':'text/html; charset=utf-8';res.writeHead(200,{'Content-Type':type,'Content-Length':b.length});res.end(b);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    try{const page=await browser.newPage({viewport:{width:390,height:844}});const ext=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))return r.continue();ext.push(u.origin);return r.abort();});await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.evaluate(()=>document.fonts.ready);
      const start=Date.now();await page.evaluate(()=>{const v=document.querySelector('video');window.playAudit={seek:0,rate:[],times:[],ended:false};v.addEventListener('seeking',()=>window.playAudit.seek++);v.addEventListener('ratechange',()=>window.playAudit.rate.push(v.playbackRate));v.addEventListener('timeupdate',()=>window.playAudit.times.push(v.currentTime));v.addEventListener('ended',()=>window.playAudit.ended=true);v.playbackRate=1;return v.play();});
      for(let i=0;i<14;i++){await page.waitForTimeout(5000);if(i===3||i===7||i===11)await page.screenshot({path:path.join(OUT,`qa/play-${i}-390.png`)});const state=await page.evaluate(()=>({ended:window.playAudit.ended,t:document.querySelector('video').currentTime}));console.log('Playback '+state.t.toFixed(1)+'s');if(state.ended)break;}
      result.playback=await page.evaluate(()=>({...window.playAudit,duration:document.querySelector('video').duration,playbackRate:document.querySelector('video').playbackRate,quality:document.querySelector('video').getVideoPlaybackQuality(),horizontalOverflow:document.documentElement.scrollWidth>innerWidth}));result.playback.elapsedMs=Date.now()-start;result.playback.errors=errors;result.playback.external=ext;
      if(!result.playback.ended||result.playback.seek||result.playback.playbackRate!==1||result.playback.horizontalOverflow||errors.length||ext.length)issues.push('Playback');
    }finally{await browser.close();server.close();}
  }
  result.passed=issues.length===0;fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(issues.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
