'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=path.resolve(process.argv[2]),base=process.argv[3]?new URL(process.argv[3]):null;
const read=f=>fs.readFileSync(path.join(source,f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const home=read('index.html').toString(),css=read('execution.css').toString();
assert.equal([...home.matchAll(/<article class="entry(?: radio-entry)?"/g)].length,19);
assert.equal([...home.matchAll(/<article class="resource-card"/g)].length,6);
const classPos=home.indexOf('id="class"'),accounts=home.indexOf('id="accounts"'),resources=home.indexOf('id="resources"'),lastEntry=home.lastIndexOf('<article class="entry');
assert.ok(classPos>0&&accounts>classPos&&resources>lastEntry&&resources>accounts);
assert.equal([...home.slice(resources).matchAll(/<section\b/g)].length,1,'Only the workbook section belongs below its heading');
assert.match(home,/<h1>보는 콘텐츠에서,<br>쓰는 도구까지\.<\/h1>/);
assert.match(home,/캐릭터·소품·스티치 로고를 채널마다 다른 한 편으로/);
assert.match(home,/채운 예시 · 수정 원본 6종/);
assert.match(css,/\.field-edition \.intro-feature h1\{font-size:clamp\(2rem,3.2vw,3.25rem\)/);
assert.match(css,/text-wrap:balance/);assert.match(css,/text-wrap:pretty/);
assert.match(css,/\.field-edition \.intro-deck\{font-size:1.125rem;line-height:1.85;font-weight:500/);
assert.match(css,/\.field-edition \.provision-index\{grid-template-columns:1fr/);
const notes=home.indexOf('<footer class="collection-notes">');assert.ok(notes>resources);assert.match(home.slice(notes),/SYNK 제작 컬렉션/);
const room=home.match(/<dialog\b[^>]*>[\s\S]*?<\/dialog>/g);assert.equal(room.length,1);assert.doesNotMatch(room[0].split('>')[0],/\sopen(?:\s|=|$)/);
assert.doesNotMatch(home.replace(room[0],''),/<video[^>]*id="listening-film"/);
assert.match(home,/<header[^>]*>[\s\S]*id="craft-film"[\s\S]*<\/header>/);
assert.match(home,/기존 체험 일정 안내까지 담은 브랜드 필름 전체/);
const immutable={
 'assets/craft-film-4k.mp4':'81152c35029ada4ed51ec9ebf5a3c5f580d3925aeffd69f4158c0e34de9ac8a6',
 '01-lab-youtube/video.mp4':'dc49a898dbb3fff7699747a41b12bc12686034dc329f34b615e50443967017dd'
};
for(const [f,digest] of Object.entries(immutable))assert.equal(sha(read(f)),digest,f+' must remain byte-identical');
for(const n of [1,2,3]){assert.match(home,new RegExp(`src="assets/felt-number-${n}\\.webp"[^>]*alt=""`));assert.ok(read(`assets/felt-number-${n}.webp`).length<100000);}
(async()=>{
 const files=[];
 if(base){
  assert.equal(base.hostname,'synk-field-notes.unmet23.chatgpt.site');assert.equal(base.protocol,'https:');
  for(const file of ['index.html','execution.css','assets/felt-number-1.webp','assets/felt-number-2.webp','assets/felt-number-3.webp',...Object.keys(immutable)]){
   const response=await fetch(new URL(file,base),{signal:AbortSignal.timeout(90000)});assert.equal(response.status,200,file);
   assert.equal(new URL(response.url).hostname,base.hostname);const body=Buffer.from(await response.arrayBuffer());let compared=body,hostingInsertion=false;
   if(file.endsWith('.html'))compared=Buffer.from(body.toString().replace(/<script>\(function\(\)\{function c\(\)\{var b=a.contentDocument[\s\S]*?<\/script>(?=<\/body>)/g,s=>{
    assert.ok(s.length<1500&&s.includes('window.__CF$cv$params=')&&s.includes('/cdn-cgi/challenge-platform/scripts/jsd/main.js'));assert.equal(hostingInsertion,false);hostingInsertion=true;return '';
   }));
   assert.equal(sha(compared),sha(read(file)),file);files.push({file,status:200,bytes:body.length,sha256:sha(compared),hostingInsertion,match:true});
  }
 }
 const report={at:new Date().toISOString(),url:base?.href||null,pass:true,accounts:19,workbooks:6,order:['class','accounts','resources','publication-note'],sourceReview:true,browserQA:false,mediaUnchanged:true,newGlyphs:3,files};
 fs.writeFileSync(path.join(__dirname,base?'공개반영검증.json':'로컬검증.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
