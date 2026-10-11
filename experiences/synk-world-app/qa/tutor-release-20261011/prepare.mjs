import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),pub='C:/Users/q1212/Documents/synk-policy',sourceCommit='4e57536c0';
const work=path.join(root,'.tmp/tutor-release-20261011'),payload=path.join(work,'candidate');
const frozen=path.join(root,'.tmp/world-app-tutor-switch-20261011');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const git=(repo,args,options={})=>execFileSync('git',['-C',repo,...args],{maxBuffer:80e6,windowsHide:true,...options});
const baseline=git(pub,['rev-parse','origin/main'],{encoding:'utf8'}).trim();
fs.mkdirSync(work,{recursive:true});
if(fs.existsSync(payload))throw Error('Candidate already exists');
const index=path.join(work,'baseline.index'),env={...process.env,GIT_INDEX_FILE:index};
git(pub,['read-tree',baseline],{env});
const publicPaths=git(pub,['ls-tree','-r','--name-only','-z',baseline,'world'],{encoding:'utf8'}).split('\0').filter(Boolean);
git(pub,['-c','core.autocrlf=false','checkout-index','--prefix='+payload.replaceAll('\\','/')+'/','--stdin','-z'],{env,input:publicPaths.join('\0')+'\0'});
const manifest=JSON.parse(fs.readFileSync(path.join(frozen,'manifest.json')));
const sourceCache=new Map(),source=p=>sourceCache.get(p)||git(root,['show',sourceCommit+':'+p]);
const configBytes=git(pub,['show',baseline+':world/world-config.json']),config=JSON.parse(configBytes);
function rewrite(s){return s.replaceAll('../synk-world-home/','./').replaceAll('href="../learning-hub/"',`href="${config.account.learningUrl}"`).replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g,(_,q,p)=>q+config.basePath+p);}
const voice=JSON.parse(source('experiences/hangul-stage/assets/voice/voices.json'));
if(voice.approved!==true)throw Error('Unapproved practice voice');
const voiceFiles=new Set(Object.values(voice.clips).map(f=>'hangul-stage/assets/voice/'+f));
const selected=manifest.files.filter(e=>e.path.startsWith('brand-opening/')||['app-shell.mjs','app-shell.css','world-account.bundle.mjs','life-content.mjs','life-progress.mjs','life-ui.mjs','life-ui.css','cafe-activity.mjs','cafe-ui.mjs','korean-runner/app.mjs','korean-runner/core.mjs','korean-runner/listening-check-ui.mjs','korean-rhythm/app.mjs','hangul-stage/app.mjs','hangul-stage/audio.mjs','hangul-stage/assets/voice/voices.json'].includes(e.path)||voiceFiles.has(e.path));
const names=[...new Set(selected.map(e=>e.source).filter(Boolean))];
const objects=git(root,['cat-file','--batch'],{input:names.map(p=>sourceCommit+':'+p).join('\n')+'\n'});let offset=0;
for(const name of names){const end=objects.indexOf(10,offset),header=objects.subarray(offset,end).toString('ascii'),size=Number(header.split(' ')[2]);if(!Number.isFinite(size))throw Error('Missing committed source '+name);offset=end+1;sourceCache.set(name,objects.subarray(offset,offset+size));offset+=size+1;}
const changes=[],verified=[];
function put(relative,bytes,origin){
 const file=path.join(payload,'world',relative);const old=fs.existsSync(file)?fs.readFileSync(file):null;
 if(old&&old.equals(bytes))return;
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
 changes.push({path:'world/'+relative,source:origin,sha256:sha(bytes),blob:blob(bytes),bytes:bytes.length,previousSha256:old&&sha(old),status:old?'modified':'added'});
}
for(const e of selected){
 let bytes;
 if(e.path==='hangul-stage/assets/voice/voices.json')bytes=Buffer.from(JSON.stringify({approved:true,clips:voice.clips})+'\n');
 else {
  if(!e.source)throw Error('No committed source: '+e.path);
  const raw=source(e.source);
  if(/\.(?:mjs|js|cjs|css|html)$/.test(e.source)){
   let s=raw.toString('utf8');
   if(e.path==='hangul-stage/app.mjs')s=s.replace(/const HUB = [^;]+;/,"const HUB = !hosted ? 'https://synk.im/account/client.html?product=world&play=learning-hub' : null;");
   bytes=Buffer.from(rewrite(s));
  }else {
   const current=fs.readFileSync(path.join(root,e.source));
   if(!current.equals(raw)&&!(/\.(json|svg|txt)$/.test(e.source)&&current.toString('utf8').replaceAll('\r\n','\n')===raw.toString('utf8').replaceAll('\r\n','\n')))throw Error('Frozen asset differs from committed source: '+e.source);
   if(sha(current)!==e.sourceSha256)throw Error('Frozen provenance drift: '+e.source);
   bytes=fs.readFileSync(path.join(frozen,'world',e.path));
   if(sha(bytes)!==e.sha256)throw Error('Frozen output drift: '+e.path);
  }
  verified.push({source:e.source,commitBlob:blob(raw)});
 }
 put(e.path,bytes,e.source||'approved primary voice manifest');
}
const documentPath=path.join(work,'document.mjs');fs.writeFileSync(documentPath,source('experiences/synk-world-app/document.mjs'));
const {renderWorldDocument}=await import(pathToFileURL(documentPath));
const html=rewrite(renderWorldDocument(source('experiences/brand-opening/home.html').toString('utf8'),config));
for(const name of ['index.html','mobile.html','desktop.html'])put(name,Buffer.from(html),'experiences/brand-opening/home.html');
const protectedFiles=['world-config.json','world-client.mjs','world-town-client.mjs','enrollment.mjs','wardrobe-studio.mjs','wardrobe-studio.css','wardrobe-catalog.mjs','wardrobe-garments-v8.mjs','avatar-v3.mjs'];
for(const f of protectedFiles)if(!fs.readFileSync(path.join(payload,'world',f)).equals(git(pub,['show',baseline+':world/'+f])))throw Error('Protected runtime changed '+f);
const result={sourceCommit,baseline,repository:'unmet23-lab/synk-policy',payload,changes,verified,protectedFiles,primaryVoiceClips:voiceFiles.size,deleted:[],published:false};
fs.writeFileSync(path.join(work,'candidate.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({baseline,changes:changes.length,bytes:changes.reduce((n,e)=>n+e.bytes,0),primaryVoiceClips:voiceFiles.size,protected:protectedFiles.length}));
