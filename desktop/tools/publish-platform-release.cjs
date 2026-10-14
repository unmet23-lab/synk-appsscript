'use strict';
// One publication transaction advances homepage downloads and the desktop feed.
// Build first. This command never rebuilds or replaces a published release asset.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {validateManifest,compareVersion}=require(fs.existsSync(path.join(__dirname,'../src/platform-update.cjs'))?'../src/platform-update.cjs':'../source/src/platform-update.cjs');
const REPO='unmet23-lab/synk-policy', FEED='desktop/releases/preview.json';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const json=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const run=(exe,args,cwd)=>cp.execFileSync(exe,args,{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:16e6}).trim();
async function sha(file){const h=crypto.createHash('sha256');for await(const c of fs.createReadStream(file))h.update(c);return h.digest('hex');}
async function verifyPublicArtifact(artifact){
  const result=await new Promise((resolve,reject)=>{
    const child=cp.spawn(process.platform==='win32'?'curl.exe':'curl',['--fail','--location','--silent','--show-error',artifact.url],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    const hash=crypto.createHash('sha256');let bytes=0,errors='';
    child.stdout.on('data',chunk=>{bytes+=chunk.length;hash.update(chunk);if(bytes>artifact.bytes)child.kill();});
    child.stderr.on('data',chunk=>{errors=(errors+chunk.toString()).slice(-2000);});child.on('error',reject);
    child.on('close',code=>{if(code!==0)reject(Error('Public download failed: '+errors));else resolve({bytes,sha256:hash.digest('hex')});});
  });
  assert(result.bytes===artifact.bytes&&result.sha256===artifact.sha256,'Public artifact does not match the release');
  return {...result,url:artifact.url};
}
function validateRelease(manifest,previous){
  const keys=manifest.artifacts?.map(a=>a.platform+'-'+a.arch).sort();
  assert(JSON.stringify(keys)===JSON.stringify(['darwin-arm64','darwin-x64','win32-x64']),'All three platform artifacts must be present before publication');
  for(const item of manifest.artifacts)validateManifest(manifest,{platform:item.platform,arch:item.arch,currentVersion:manifest.version,currentBuildId:manifest.buildId});
  if(previous){const difference=compareVersion(manifest.version,previous.version);assert(difference>0||difference===0&&JSON.stringify(manifest)===JSON.stringify(previous),'A version is immutable; increment it for any changed bytes');}
  const names=manifest.artifacts.map(a=>path.posix.basename(new URL(a.url).pathname));
  assert(new Set(names).size===names.length,'Duplicate asset filenames');
  for(const name of names)assert(name.includes('-'+manifest.version+'-'),'Filename version must match release');
  return names;
}
function updateSiteText(source,manifest){
  const byKey=Object.fromEntries(manifest.artifacts.map(a=>[a.platform+'-'+a.arch,a]));
  const artifactFor=name=>/-win-x64\.exe$/.test(name)?byKey['win32-x64']:/-mac-arm64\.dmg$/.test(name)?byKey['darwin-arm64']:/-mac-x64\.dmg$/.test(name)?byKey['darwin-x64']:null;
  let result=source.replace(/https:\/\/github\.com\/unmet23-lab\/synk-policy\/releases\/download\/platform-preview-[^/\s"'<>]+\/SYNK-Platform-Preview-[^\s"'<>]+?\.(?:exe|dmg)/g,old=>artifactFor(old)?.url||old);
  result=result.replace(/https:\/\/github\.com\/unmet23-lab\/synk-policy\/releases\/tag\/platform-preview-[^\s"'<>]+/g,'https://github.com/'+REPO+'/releases/tag/'+manifest.releaseId);
  result=result.replace(/SYNK-Platform-Preview-\d+\.\d+\.\d+(?:-Signal)?-(?:win-x64\.exe|mac-(?:arm64|x64)\.dmg)/g,old=>{const a=artifactFor(old);return a?path.posix.basename(new URL(a.url).pathname):old;});
  result=result.replace(/SYNK-Platform-Preview-\d+\.\d+\.\d+ DMG/g,'SYNK-Platform-Preview-'+manifest.version+' DMG');
  result=result.replace(/Preview \d+\.\d+\.\d+/g,'Preview '+manifest.version);
  return result;
}
function stageSite({publicDir,manifest,clientFile}){
  const changed=[];
  const read=relative=>{const file=path.join(publicDir,relative);if(fs.existsSync(file))return fs.readFileSync(file,'utf8');if(!fs.existsSync(path.join(publicDir,'.git')))return null;try{return run('git',['show','HEAD:'+relative],publicDir)+'\n';}catch{return null;}};
  const put=(relative,value)=>{const file=path.join(publicDir,relative);if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===value)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);changed.push(relative);};
  put(FEED,JSON.stringify(manifest,null,2)+'\n');
  const client=fs.readFileSync(clientFile,'utf8'),hash=crypto.createHash('sha256').update(client).digest('hex').slice(0,12);
  put('desktop/releases/client.js',client);
  const knowledgeHashes={};
  for(const relative of ['knowledge.json','en/knowledge.json']){const before=read(relative);if(before===null)continue;const value=updateSiteText(before,manifest);knowledgeHashes[relative]=crypto.createHash('sha256').update(value).digest('hex').slice(0,12);put(relative,value);}
  const pages=['index.html','en/index.html',...['lab','shift','pulse','path','atlas','founder'].flatMap(name=>[name+'/index.html','en/'+name+'/index.html'])];
  for(const relative of [...pages,'llms.txt','en/llms.txt','docs/platform.md','en/docs/platform.md']){
    const before=read(relative);if(before===null)continue;
    let value=updateSiteText(before,manifest);
    value=value.replace(/(data-knowledge="\/)((?:en\/)?knowledge\.json)\?v=[a-f0-9]+/g,(all,start,file)=>knowledgeHashes[file]?start+file+'?v='+knowledgeHashes[file]:all);
    if(relative==='index.html'||relative==='en/index.html'){
      value=value.replace(/(<section[^>]*\bid="platform")(?:\s+data-platform-version="[^"]*")?/,`$1 data-platform-version="${manifest.version}"`);
      value=value.replace(/<script[^>]*src="\/desktop\/releases\/client\.js[^"\s]*"[^>]*><\/script>\s*/g,'');
      assert(value.includes('</body>'),'Homepage body missing');
      value=value.replace('</body>',`<script defer src="/desktop/releases/client.js?v=${hash}"></script>\n</body>`);
      for(const artifact of manifest.artifacts)assert(value.includes(artifact.url),'Homepage is missing '+artifact.platform+' '+artifact.arch);
    }
    put(relative,value);
  }
  return changed;
}
async function verifyLocalFiles(manifest,directory,{remoteArtifacts=[]}={}){
  const files=[];for(const artifact of manifest.artifacts){const file=path.join(directory,path.posix.basename(new URL(artifact.url).pathname));
    if(!fs.existsSync(file)){const remote=remoteArtifacts.find(a=>a.name===path.basename(file));assert(remote?.size===artifact.bytes&&remote?.digest==='sha256:'+artifact.sha256,'Missing or unverified remote artifact '+path.basename(file));continue;}
    const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===artifact.bytes,'Artifact size mismatch '+path.basename(file));assert(await sha(file)===artifact.sha256,'Artifact hash mismatch '+path.basename(file));files.push(file);}return files;
}
async function main(){
  const get=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
  for(const name of ['manifest','artifacts','public','client'])assert(get(name),'Missing --'+name+'=<path>');
  const manifest=JSON.parse(fs.readFileSync(get('manifest'),'utf8')),publicDir=path.resolve(get('public')),artifactDir=path.resolve(get('artifacts'));
  const feed=path.join(publicDir,FEED);
  const previous=fs.existsSync(feed)?JSON.parse(fs.readFileSync(feed,'utf8')):run('git',['ls-tree','--name-only','HEAD','--',FEED],publicDir)?JSON.parse(run('git',['show','HEAD:'+FEED],publicDir)):null;
  const names=validateRelease(manifest,previous);
  const remoteArtifacts=process.argv.includes('--remote-artifacts')?JSON.parse(run('gh',['release','view',manifest.releaseId,'--repo',REPO,'--json','assets'],publicDir)).assets:[];
  const files=await verifyLocalFiles(manifest,artifactDir,{remoteArtifacts});
  assert(run('git',['status','--porcelain'],publicDir)==='','Use a clean public checkout; unrelated files must not be published');
  let head=run('git',['rev-parse','HEAD'],publicDir),remote=run('git',['ls-remote','origin','refs/heads/main'],publicDir).split(/\s/)[0];
  if(head!==remote&&process.argv.includes('--apply')){
    const receiptFile=path.join(artifactDir,'publication.json'),receipt=fs.existsSync(receiptFile)?JSON.parse(fs.readFileSync(receiptFile,'utf8')):null;
    assert(receipt?.siteCommitPending&&receipt.commit===head&&receipt.sourceCommit===remote&&receipt.releaseId===manifest.releaseId&&JSON.stringify(previous)===JSON.stringify(manifest),'Refresh the public checkout before publishing');
    run('git',['push','origin','HEAD:main'],publicDir);receipt.siteCommitPending=false;receipt.published=true;json(receiptFile,receipt);if(get('website'))json(path.join(path.resolve(get('website')),FEED),manifest);console.log(JSON.stringify(receipt));return;
  }
  assert(head===remote,'Refresh the public checkout before publishing');
  const report={ok:true,releaseId:manifest.releaseId,sourceCommit:head,artifacts:names,published:false};
  if(!process.argv.includes('--apply')){console.log(JSON.stringify(report));return;}
  let release;try{release=JSON.parse(run('gh',['release','view',manifest.releaseId,'--repo',REPO,'--json','isDraft,assets,targetCommitish'],publicDir));}catch{
    run('gh',['release','create',manifest.releaseId,'--repo',REPO,'--target',head,'--draft','--prerelease','--title','SYNK Platform Preview '+manifest.version,'--notes','공통 배포: 홈페이지 다운로드와 PC 업데이트가 같은 설치 파일을 사용합니다. Preview는 정식 서명·공증 전입니다.'],publicDir);
    release={isDraft:true,assets:[]};
  }
  if(release.isDraft){
    for(const file of files){const old=release.assets.find(a=>a.name===path.basename(file));if(old){assert(old.size===fs.statSync(file).size&&old.digest==='sha256:'+await sha(file),'Existing draft asset differs; do not replace it');}else run('gh',['release','upload',manifest.releaseId,file,'--repo',REPO],publicDir);}
    const uploaded=JSON.parse(run('gh',['release','view',manifest.releaseId,'--repo',REPO,'--json','assets'],publicDir)).assets;
    for(const item of manifest.artifacts){const remote=uploaded.find(a=>a.name===path.posix.basename(new URL(item.url).pathname));assert(remote?.size===item.bytes&&remote?.digest==='sha256:'+item.sha256,'Uploaded release does not match manifest');}
    run('gh',['release','edit',manifest.releaseId,'--repo',REPO,'--draft=false'],publicDir);
  }
  // Read the public bytes, not just a successful upload response, before advancing links.
  report.publicArtifacts=await Promise.all(manifest.artifacts.map(verifyPublicArtifact));
  assert(run('git',['ls-remote','origin','refs/heads/main'],publicDir).split(/\s/)[0]===head,'Public site changed during upload; refresh before advancing feed');
  const changed=stageSite({publicDir,manifest,clientFile:path.resolve(get('client'))});
  if(changed.length){run('git',['add','--sparse','--',...changed],publicDir);run('git',['commit','-m','Publish unified Platform '+manifest.version+' downloads and update feed'],publicDir);report.commit=run('git',['rev-parse','HEAD'],publicDir);report.changed=changed;report.siteCommitPending=true;json(path.join(artifactDir,'publication.json'),report);run('git',['push','origin','HEAD:main'],publicDir);report.siteCommitPending=false;}
  report.published=true;report.commit=run('git',['rev-parse','HEAD'],publicDir);report.changed=changed;
  if(get('website'))json(path.join(path.resolve(get('website')),FEED),manifest);
  json(path.join(artifactDir,'publication.json'),report);console.log(JSON.stringify(report));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={validateRelease,updateSiteText,stageSite,verifyLocalFiles,verifyPublicArtifact};
