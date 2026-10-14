'use strict';
// Assemble only after all three targets were built from the same frozen source.
// This validates local bytes or GitHub's uploaded asset digests; it never uploads,
// installs, replaces a public manifest, or assumes that a build report is an upload.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {validateSnapshot,sha}=require('./build-platform-release.cjs');
const updaterPath=fs.existsSync(path.join(__dirname,'../src/platform-update.cjs'))?'../src/platform-update.cjs':'../source/src/platform-update.cjs';
const {MANIFEST_URL,validateManifest}=require(updaterPath);
const TARGETS=Object.freeze(['win32-x64','darwin-arm64','darwin-x64']);
const HASH=/^[a-f0-9]{64}$/;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
function readJson(file){assert(fs.statSync(file).size<=16*1024*1024,'JSON input is too large');return JSON.parse(fs.readFileSync(file,'utf8'));}
const inside=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
const artifactKeys=['platform','arch','url','bytes','sha256','asarSHA256'];
function descriptor(value){assert(value&&typeof value==='object'&&!Array.isArray(value),'Missing artifact descriptor');return Object.fromEntries(artifactKeys.map(key=>[key,value[key]]));}
function exactIso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
function validateReport(report,spec,now){
  assert(report?.ok===true&&report.schemaVersion===1&&report.product==='platform','Build did not report a successful Platform result');
  for(const key of ['channel','version','releaseId','buildId','sourceHash'])assert(report[key]===spec[key],'Build '+key+' differs from frozen release');
  const artifact=descriptor(report.artifact),target=artifact.platform+'-'+artifact.arch;
  assert(TARGETS.includes(target),'Unexpected build target');
  assert(exactIso(report.builtAt)&&Date.parse(report.builtAt)<=now+10*60*1000,'Invalid build timestamp');
  assert(Number.isSafeInteger(report.memberCount)&&report.memberCount>0,'Build archive verification is missing');
  assert(report.installedStateTouched===false&&report.published===false&&report.notarized===false,'Unexpected build side-effect or signing report');
  assert(report.unsignedPreview===(artifact.platform==='win32')&&report.adHocSigned===(artifact.platform==='darwin'),'Preview signing report differs from target');
  const metadata=report.metadata;
  assert(metadata?.clientId==='platform'&&metadata.appId==='im.synk.platform.preview'&&metadata.mode==='development','Delivered application identity differs');
  for(const key of ['channel','version','releaseId','buildId','sourceHash'])assert(metadata[key]===spec[key],'Delivered '+key+' differs from frozen release');
  assert(metadata.platform===artifact.platform&&metadata.arch===artifact.arch,'Delivered target differs from artifact');
  const expectedName=`SYNK-Platform-Preview-${spec.version}-Signal-${artifact.platform==='win32'?'win':'mac'}-${artifact.arch}.${artifact.platform==='win32'?'exe':'dmg'}`;
  assert(artifact.url===`https://github.com/unmet23-lab/synk-policy/releases/download/${spec.releaseId}/${expectedName}`,'Artifact URL or filename differs from release target');
  return {artifact,target,name:expectedName};
}
function remoteAssets(input,spec){
  if(input===undefined||input===null)return {rows:[],draftTagValidated:false};
  const value=typeof input==='string'?readJson(path.resolve(input)):input;
  if(!Array.isArray(value))for(const key of ['tag_name','tagName'])if(value?.[key]!==undefined)assert(value[key]===spec.releaseId,'GitHub release tag differs');
  const assets=Array.isArray(value)?value:value?.assets;
  assert(Array.isArray(assets),'Remote asset listing must be an array or contain assets');return {rows:assets,draftTagValidated:value?.isDraft===true&&value?.tagName===spec.releaseId};
}
function checkRemote(evidence,artifact,name){
  const matches=evidence.rows.filter(row=>row?.name===name);assert(matches.length<=1,'Duplicate GitHub asset name');
  if(!matches.length)return false;
  const row=matches[0],url=row.browser_download_url??row.url;
  assert(row.size===artifact.bytes,'GitHub asset size differs');
  assert(row.digest==='sha256:'+artifact.sha256,'GitHub asset digest differs or is missing');
  let draftUrlMatches=false;
  if(evidence.draftTagValidated&&typeof url==='string'){
    try{const parsed=new URL(url);draftUrlMatches=parsed.href===url&&parsed.origin==='https://github.com'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&new RegExp('^/unmet23-lab/synk-policy/releases/download/untagged-[A-Za-z0-9-]+/'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$').test(parsed.pathname);}catch{}
  }
  assert(url===artifact.url||draftUrlMatches,'GitHub asset download URL differs');
  assert(row.state===undefined||row.state==='uploaded','GitHub asset is not uploaded');
  return true;
}
function localArtifact({reportPath,report,name,artifactRoot}){
  const directory=path.dirname(reportPath),roots=[...(artifactRoot?[path.resolve(artifactRoot)]:[]),directory];
  const candidates=roots.flatMap(root=>[path.join(root,name),path.join(root,'dist',name),path.join(root,'signal',name)]);
  if(typeof report.artifactFile==='string'&&path.isAbsolute(report.artifactFile)&&path.basename(report.artifactFile)===name&&inside(directory,path.resolve(report.artifactFile)))candidates.unshift(path.resolve(report.artifactFile));
  const matches=[...new Set(candidates)].filter(file=>fs.existsSync(file));
  // If collected copies coexist, all of them must match. This prevents silently
  // accepting one current binary while publishing a different same-name copy.
  for(const file of matches){
    const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink(),'Installer must be a regular file');
    const real=fs.realpathSync(file);assert(roots.some(root=>inside(fs.realpathSync(root),real)),'Installer resolved outside its explicit root');
  }
  return matches;
}
function assemble({release,reports,output,artifactRoot,remoteAssets:remoteInput,now=Date.now()}={}){
  assert(typeof release==='string'&&Array.isArray(reports)&&reports.length===3&&reports.every(file=>typeof file==='string'),'Use one frozen release and exactly three build reports');
  assert(typeof output==='string'&&output,'An output manifest path is required');
  const releasePath=path.resolve(release),root=fs.statSync(releasePath).isDirectory()?releasePath:path.dirname(releasePath);
  assert(fs.statSync(releasePath).isDirectory()||path.basename(releasePath)==='release-input.json','Expected release-input.json or its frozen directory');
  const spec=validateSnapshot(root),destination=path.resolve(output);
  assert(!fs.existsSync(destination),'Preserve existing assembled manifest');
  assert(spec.manifestUrl===MANIFEST_URL&&typeof spec.sourceHash==='string'&&HASH.test(spec.sourceHash),'Frozen update source is invalid');
  assert(Number.isFinite(now),'Invalid assembly timestamp');
  const publishedAt=new Date(now).toISOString(),rows=remoteAssets(remoteInput,spec),targets=new Set(),verified=[];
  for(const reportFile of reports){
    const reportPath=path.resolve(reportFile),report=readJson(reportPath),entry=validateReport(report,spec,now);
    assert(!targets.has(entry.target),'Repeated build target');targets.add(entry.target);
    const sidecar=descriptor(readJson(path.join(path.dirname(reportPath),'artifact.json')));
    assert(JSON.stringify(sidecar)===JSON.stringify(entry.artifact),'Build report and artifact.json differ');
    verified.push({...entry,reportPath,report});
  }
  assert(TARGETS.every(target=>targets.has(target)),'Missing required build target');
  verified.sort((a,b)=>TARGETS.indexOf(a.target)-TARGETS.indexOf(b.target));
  const manifest={schemaVersion:1,product:'platform',channel:spec.channel,version:spec.version,releaseId:spec.releaseId,buildId:spec.buildId,publishedAt,sourceHash:spec.sourceHash,artifacts:verified.map(row=>row.artifact)};
  // The public document must be accepted by the same validator shipped in the app.
  for(const target of verified)validateManifest(manifest,{platform:target.artifact.platform,arch:target.artifact.arch,currentVersion:spec.version,currentBuildId:spec.buildId,now});
  const verification=verified.map(entry=>{
    const files=localArtifact({...entry,artifactRoot});
    for(const file of files)assert(fs.statSync(file).size===entry.artifact.bytes&&sha(file)===entry.artifact.sha256,'Local installer bytes differ for '+entry.target);
    const remote=checkRemote(rows,entry.artifact,entry.name);
    assert(files.length||remote,'No local bytes or uploaded GitHub digest for '+entry.target);
    return {target:entry.target,verifiedBy:[...(files.length?['local-bytes']:[]),...(remote?['github-release-assets']:[])],bytes:entry.artifact.bytes,sha256:entry.artifact.sha256};
  });
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  const temporary=destination+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(temporary,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});fs.linkSync(temporary,destination);}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
  return {ok:true,manifestFile:destination,releaseId:spec.releaseId,buildId:spec.buildId,sourceHash:spec.sourceHash,verification,manifest};
}
function parseArgs(args){
  const result={reports:[]};
  for(const arg of args){const match=/^--(release|report|out|artifact-root|remote-assets)=(.+)$/.exec(arg);assert(match,'Unsupported argument');const [,key,value]=match;
    if(key==='report'){result.reports.push(value);continue;}
    const name=({out:'output','artifact-root':'artifactRoot','remote-assets':'remoteAssets'})[key]||key;assert(result[name]===undefined,'Repeated argument');result[name]=value;
  }return result;
}
if(require.main===module){try{const {manifest,...summary}=assemble(parseArgs(process.argv.slice(2)));console.log(JSON.stringify(summary));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={assemble,parseArgs,TARGETS};
