'use strict';
// 현재 서버 HTML에 필요한 조각만 이식한다. 로컬의 별개 차림 선택 UI를 배포하지 않는다.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createHash,randomUUID}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/라디오생동_20260909/털고정');
const hash=b=>createHash('sha256').update(b).digest('hex'),sha=f=>hash(fs.readFileSync(f));
const mode=process.argv[2]||'--prepare';
if(!['--prepare','--upload','--check','--apply'].includes(mode))throw Error('모드 오류');
const base=JSON.parse(fs.readFileSync(path.join(out,'../v4/배포전상태.json'),'utf8')).server;
const v4=JSON.parse(fs.readFileSync(path.join(out,'../v4/라이브반영.json'),'utf8'));
const oldPath=path.join(out,'감사/before-마스코트.html'),htmlTarget=base.codeFiles['bots/오버레이/마스코트.html'];
const readHtml=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
if(hash(readHtml(oldPath))!==htmlTarget.sha256)throw Error('서버 원본 스냅샷 불일치');
// 경계 2차: 패치 정본은 최초 HTML, 교체/복원의 기준은 실제 배포한 1차 HTML이다.
const priorSha='1114809e0ee368569dddcff0fa36834a6c7e2e5ff564c94074da7a55e73d01a7';
const priorReceipt=path.join(out,'라이브반영_경계1.json'),receiptPath=path.join(out,'라이브반영.json');
if(!fs.existsSync(priorReceipt)){
  if(JSON.parse(fs.readFileSync(receiptPath,'utf8')).htmlSha!==priorSha)throw Error('1차 배포 영수증 불일치');
  fs.copyFileSync(receiptPath,priorReceipt);
}
if(JSON.parse(fs.readFileSync(priorReceipt,'utf8')).htmlSha!==priorSha)throw Error('1차 보존 영수증 불일치');
const local=readHtml(path.join(root,'bots/오버레이/마스코트.html'));
const helperPath=path.join(root,'bots/오버레이/라디오가장자리.js'),helperName='라디오가장자리-'+sha(helperPath).slice(0,12)+'.js';
const candidate='docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b/';
const cuts=['본체','눈감음','눈웃음','궁금함','집중','안도','응원','놀람'];
let html=readHtml(oldPath);
function replace(from,to){if(html.split(from).length!==2)throw Error('이식 기준 유일성 실패: '+from);html=html.replace(from,to);}
replace('<script src="라디오표정리듬.js"></script>','<script src="라디오표정리듬.js"></script>\n<script src="'+helperName+'"></script>');
replace("까몽: '../../docs/Loom_자산/라디오DJ/'","까몽: '../../"+candidate+"'");
if((html.match(/까몽_여름델\+전설의팻말_/g)||[]).length!==9)throw Error('9개 표정 참조 기준 불일치');
html=html.replaceAll('까몽_여름델+전설의팻말_','여름델+전설의팻말_');
const anchor='  Promise.all(Object.entries(컷표[DJ]).map(([이름, 파일]) => new Promise(끝 => {\n';
const fragment=local.slice(local.indexOf(anchor)+anchor.length,local.indexOf('    const im = new Image();',local.indexOf(anchor)));
if(!fragment.includes('라디오가장자리.읽기'))throw Error('준비 조각 누락');
replace(anchor,anchor+fragment);
replace('bottom: 15.6%; border-radius: 50%;','bottom: var(--접지바닥, 15.6%); border-radius: 50%;');
const shadow="  if (차림 && 차림.접지) 틀.style.setProperty('--접지색', 차림.접지);   // 발밑 그림자 색도 결을 따라간다(09-07)";
const shadowNext=local.slice(local.indexOf(shadow),local.indexOf('\n',local.indexOf("틀.style.setProperty('--접지바닥'"))+1);
replace(shadow,shadowNext.trimEnd());
for(const [,code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(code);
new vm.Script(fs.readFileSync(helperPath,'utf8'));
const htmlNext=path.join(out,'after-마스코트.html');fs.writeFileSync(htmlNext,html);
const helperCopy=path.join(out,helperName);fs.copyFileSync(helperPath,helperCopy);
const files=cuts.map(c=>({local:path.join(root,candidate,'여름델+전설의팻말_'+c+'.webp'),target:'/opt/synk-radio/지면/'+candidate+'여름델+전설의팻말_'+c+'.webp'}));
files.push({local:helperCopy,target:'/opt/synk-radio/지면/bots/오버레이/'+helperName});
files.forEach(f=>f.sha256=sha(f.local));
const protectedFiles=[base.tuningFile,base.audioPlaylist,...Object.values(base.codeFiles).filter(f=>f.path!==htmlTarget.path),...Object.values(base.currentDJAssets),{path:base.stagePlaylist.path,sha256:v4.stageSha256},{path:v4.file,sha256:v4.sha256}].map(f=>({path:f.path,sha256:f.sha256}));
const payload={mode,files,protectedFiles,html:{target:htmlTarget.path,oldSha:priorSha,newSha:hash(html),base64:Buffer.from(html).toString('base64')},backup:htmlTarget.path+'.before-fur-20260909-'+priorSha.slice(0,12),stage:v4.file,id:randomUUID()};
if(mode==='--prepare'){console.log(JSON.stringify({htmlNext,helperName,sourceSha:htmlTarget.sha256,newSha:hash(html),assets:files.length,protected:protectedFiles.length},null,2));process.exit(0);}
const key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk@34.71.111.97';
function rpc(code,p){return JSON.parse(execFileSync('ssh',['-i',key,host,'node'],{input:'process.argv[1]='+JSON.stringify(JSON.stringify(p))+';\n'+code,encoding:'utf8',timeout:60000}));}
if(mode==='--upload'){
  rpc(`const fs=require('fs'),path=require('path'),crypto=require('crypto'),p=JSON.parse(process.argv[1]);for(const f of p.protectedFiles){if(crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex')!==f.sha256)throw Error('보호 파일 변경: '+f.path);}for(const f of p.files)fs.mkdirSync(path.dirname(f.target),{recursive:true});console.log('{}');`,payload);
  for(const f of files)execFileSync('scp',['-i',key,f.local,host+':'+f.target+'.upload-'+payload.id],{stdio:'inherit',timeout:60000});
}
const remote=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
(async()=>{
const p=JSON.parse(process.argv[1]),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const protect=()=>p.protectedFiles.forEach(f=>assert.equal(hash(f.path),f.sha256,'보호 파일 변경: '+f.path));
protect();const old=hash(p.html.target);assert.ok([p.html.oldSha,p.html.newSha].includes(old),'라이브 HTML 동시 변경');
for(const f of p.files){
 if(p.mode==='--upload'){const temp=f.target+'.upload-'+p.id;assert.equal(hash(temp),f.sha256);if(fs.existsSync(f.target)){assert.equal(hash(f.target),f.sha256);fs.unlinkSync(temp);}else fs.renameSync(temp,f.target);}
 assert.equal(hash(f.target),f.sha256);
}
function status(){const s=Object.fromEntries(cp.execFileSync('systemctl',['show','radio-live','--property=MainPID,ActiveState,NRestarts,ActiveEnterTimestamp'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));const opened=[];let children=[];try{children=cp.execFileSync('pgrep',['-P',s.MainPID],{encoding:'utf8'}).trim().split('\n');}catch{}for(const pid of children){try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const t=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(/\.(mp4|flac)$/.test(t))opened.push(t);}catch{}}}catch{}}return {service:s,opened};}
const before=status();let restarted=false,rollback=false;
function restore(){assert.equal(hash(p.html.target),p.html.newSha,'다른 HTML 변경이 있어 자동 복원 중지');assert.equal(hash(p.backup),p.html.oldSha);const temp=p.html.target+'.restore-'+p.id;fs.copyFileSync(p.backup,temp);fs.renameSync(temp,p.html.target);}
if(p.mode==='--apply'&&old!==p.html.newSha){
 if(fs.existsSync(p.backup))assert.equal(hash(p.backup),p.html.oldSha);else fs.copyFileSync(p.html.target,p.backup);
 const next=p.html.target+'.next-'+p.id;fs.writeFileSync(next,Buffer.from(p.html.base64,'base64'));assert.equal(hash(next),p.html.newSha);protect();assert.equal(hash(p.html.target),old,'교체 직전 HTML 동시 변경');fs.renameSync(next,p.html.target);
}
// 디스크 해시만으로 실행 중 브라우저의 새 HTML 로드를 증명하지 않는다.
if(p.mode==='--apply'){assert.equal(hash(p.html.target),p.html.newSha);try{cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);restarted=true;}catch(e){restore();cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);throw Error('재시작 실패, HTML 복원');}}
let after=status();
if(p.mode==='--apply'){
 for(let i=0;i<20&&(after.service.ActiveState!=='active'||!after.opened.includes(p.stage));i++){await new Promise(r=>setTimeout(r,1000));after=status();}
 if(after.service.ActiveState!=='active'||!after.opened.includes(p.stage)){
  if(restarted){restore();cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);rollback=true;}
  throw Error('송출 시작 미확인; HTML 복원='+rollback);
 }
}
protect();console.log(JSON.stringify({at:new Date().toISOString(),mode:p.mode,applied:hash(p.html.target)===p.html.newSha,restarted,htmlSha:hash(p.html.target),backup:p.backup,files:p.files.map(f=>({path:f.target,sha256:hash(f.target)})),protectedUnchanged:p.protectedFiles.length,before,after},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
const result=rpc(remote,payload);fs.writeFileSync(path.join(out,mode==='--apply'?'라이브반영.json':mode==='--upload'?'업로드검사.json':'서버검사.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
