'use strict';
// Anonymous HTTP integrity check. No browser control or media playback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const source=path.resolve(process.argv[2]),base=new URL(process.argv[3]);
if(base.hostname!=='synk-field-notes.unmet23.chatgpt.site'||base.protocol!=='https:')throw Error('Expected the existing approved collection');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['index.html','01-lab-youtube/index.html','01-lab-youtube/video.mp4','01-lab-youtube/upload-01.jpg','01-lab-youtube/감상노트.md','assets/craft-film-4k.mp4','assets/craft-film-poster.jpg','execution.css'];
(async()=>{
 const checks=[];let home='';
 for(const file of files){
  const url=new URL(file.split('/').map(encodeURIComponent).join('/'),base),res=await fetch(url,{signal:AbortSignal.timeout(90000)});
  assert.equal(res.status,200,file);assert.equal(new URL(res.url).hostname,base.hostname);
  const bytes=Buffer.from(await res.arrayBuffer()),local=fs.readFileSync(path.join(source,file));
  // The hosting edge appends its own Cloudflare browser-check script before </body>.
  // Inspect that sole, observed hosting insertion separately; never alter the site or run it here.
  let comparable=bytes,hostingInsertion=false;
  if(file.endsWith('.html')){
   comparable=Buffer.from(bytes.toString('utf8').replace(/<script>\(function\(\)\{function c\(\)\{var b=a.contentDocument[\s\S]*?<\/script>(?=<\/body>)/g,insertion=>{
    assert.ok(insertion.length<1500&&insertion.includes('window.__CF$cv$params=')&&insertion.includes('/cdn-cgi/challenge-platform/scripts/jsd/main.js'),'Unexpected hosting insertion');
    assert.equal(hostingInsertion,false,'More than one hosting insertion');hostingInsertion=true;return '';
   }));
  }
  assert.equal(sha(comparable),sha(local),file+' differs from the validated source');
  if(file.endsWith('.mp4'))assert.match(res.headers.get('content-type'),/^video\/mp4/);
  checks.push({file,status:res.status,bytes:bytes.length,transportSha256:sha(bytes),sourceSha256:sha(comparable),match:true,hostingInsertion});
  if(file==='index.html')home=bytes.toString('utf8');
 }
 const dialogs=[...home.matchAll(/<dialog\b[^>]*>[\s\S]*?<\/dialog>/g)];assert.equal(dialogs.length,1);
 assert.doesNotMatch(dialogs[0][0].split('>')[0],/\sopen(?:\s|=|$)/);
 assert.match(dialogs[0][0],/id="listening-film"/);
 const outside=home.replace(dialogs[0][0],'');assert.doesNotMatch(outside,/<video[^>]*id="listening-film"/);
 assert.match(home,/<header[^>]*>[\s\S]*id="craft-film"[\s\S]*<\/header>/);
 assert.match(home,/기존 체험 일정 안내까지 담은 브랜드 필름 전체/);
 assert.equal([...home.matchAll(/<article class="entry(?: radio-entry)?"/g)].length,19);
 const report={at:new Date().toISOString(),url:base.href,anonymous:true,files:checks,firstIntroCraft:true,radioMenuOnly:true,oldScheduleVersion:true,accounts:19,browserPlaybackTested:false};
 fs.writeFileSync(path.join(__dirname,'공개반영검증.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
