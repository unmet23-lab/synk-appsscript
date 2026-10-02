'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const dir=__dirname,root=path.resolve(dir,'../../../..'),key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk@34.71.111.97';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=fs.readFileSync(path.join(dir,'server-board-before.html'),'utf8'),local=fs.readFileSync(path.join(root,'bots/오버레이/전광판.html'),'utf8');
const css=/  #구석\.현재곡 \{[\s\S]*?  #구석\.현재곡\.밝음 \{ opacity: 1; \}/;
assert.ok(css.test(before));assert.ok(css.test(local));
let after=before.replace(css,local.match(css)[0]);
assert.ok(after.includes("글(구석칸, '♫  ' + 제목)"));after=after.replace("글(구석칸, '♫  ' + 제목)","글(구석칸, 제목)");
fs.writeFileSync(path.join(dir,'server-board-after.html'),after);
const files=[['server-board-after.html','/opt/synk-radio/지면/bots/오버레이/전광판.html','server-board-before.html'],['now-playing.json','/opt/synk-radio/소리/now-playing.json','server-manifest-before.json']].map(([local,target,before])=>({local:path.join(dir,local),target,old:sha(fs.readFileSync(path.join(dir,before)))}));
for(const f of files){f.sha=sha(fs.readFileSync(f.local));f.incoming=f.target+'.design-revision-incoming';cp.execFileSync('scp',['-i',key,f.local,host+':'+f.incoming],{stdio:'inherit',timeout:120000});}
const data=Buffer.from(JSON.stringify(files)).toString('base64');
const script=`const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');const files=JSON.parse(Buffer.from('${data}','base64'));const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');for(const f of files){assert.equal(sha(f.target),f.old,'Concurrent edit');assert.equal(sha(f.incoming),f.sha);}const m=JSON.parse(fs.readFileSync(files[1].incoming));assert.equal(sha('/opt/synk-radio/소리/playlist.txt'),m.playlistSha256);const now=require('/opt/synk-radio/지면/bots/오버레이/현재곡.js');now.검증(m);assert.equal(now.찾기(m,2854).title,'노을빛 드라이브');assert.equal(now.찾기(m,3188).title,'너와 걷던 여름밤');for(const f of files){fs.copyFileSync(f.target,f.target+'.before-design-revision-'+Date.now());fs.renameSync(f.incoming,f.target);}cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);console.log(JSON.stringify({at:new Date().toISOString(),files:files.map(f=>({path:f.target,sha:sha(f.target)})),titles:[now.찾기(m,2854),now.찾기(m,3188)],status:cp.execFileSync('systemctl',['show','radio-live','-p','ActiveState','-p','MainPID','-p','NRestarts'],{encoding:'utf8'})}));`;
const result=cp.execFileSync('ssh',['-i',key,host,'node'],{input:script,encoding:'utf8',timeout:60000});fs.writeFileSync(path.join(dir,'deployed.json'),result);console.log(result);
