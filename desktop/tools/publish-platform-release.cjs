'use strict';
// One publication transaction advances homepage downloads and the desktop feed.
// Build first. This command never rebuilds or replaces a published release asset.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {validateManifest,compareVersion}=require(fs.existsSync(path.join(__dirname,'../src/platform-update.cjs'))?'../src/platform-update.cjs':'../source/src/platform-update.cjs');
// The feed is signed here, on the publisher's PC, with a key pinned in the app (update-signing.cjs).
const {signForPublication}=require('./update-signing.cjs');
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
// 판을 낸 날(서울, publishedAt 기준). 홈 소식 줄의 PC 앱 줄과 바닥 기준일이 이 날을 따른다 —
// SYNK-website site-v10/platform-release.mjs의 platformReleaseDay와 같은 셈이라 원고를 다시 빌드해도 같은 날이 나온다.
function releaseDay(manifest){const t=Date.parse(manifest.publishedAt);assert(Number.isFinite(t),'Release publishedAt is missing');return new Date(t+9*36e5).toISOString().slice(0,10);}
const dayLabel=day=>day.replace(/-/g,'.');
// 홈 소식 줄(#now): PC 앱 줄(#platform-get)의 날짜를 판을 낸 날로 바꾸고, 그날보다 늦지 않은 첫 줄 앞(보통 맨 앞)으로 옮긴다.
// 펼친 줄 수와 「지난 소식 N」의 N은 그대로 둔다 — 빌드(site-v10/build.mjs)가 최신순으로 셋을 펼치고 나머지를 접는 모양을 지킨다.
// 소식 구역이 없거나(90일 · 3개 규칙으로 숨음) PC 앱 줄이 없으면 그대로 두고, 구역 모양이 빌드와 다르면 멈춘다.
function updateHomeNews(source,manifest){
  const day=releaseDay(manifest),start=source.indexOf('id="now"');if(start<0)return source;
  const end=source.indexOf('</section>',start);assert(end>start,'Home news section is not closed');
  const section=source.slice(start,end),lists=[...section.matchAll(/<ol class="news">([\s\S]*?)<\/ol>/g)];
  const groups=lists.map(m=>m[1].match(/<li>[\s\S]*?<\/li>/g)||[]);
  lists.forEach((m,i)=>assert(groups[i].join('')===m[1],'Unexpected home news markup'));
  const items=groups.flat(),dated=li=>li.match(/<time datetime="(\d{4}-\d{2}-\d{2})">/)?.[1]||'';
  const index=items.findIndex(li=>li.startsWith('<li><a href="#platform-get"'));if(index<0)return source;
  assert(dated(items[index]),'Platform news item has no date');
  const platform=items[index].replace(/<time datetime="\d{4}-\d{2}-\d{2}">[^<]*<\/time>/,`<time datetime="${day}">${dayLabel(day)}</time>`);
  const order=items.filter((_,i)=>i!==index);let at=order.findIndex(li=>dated(li)<=day);if(at<0)at=order.length;order.splice(at,0,platform);
  let offset=0,k=0;const next=groups.map(g=>order.slice(offset,offset+=g.length));
  return source.slice(0,start)+section.replace(/<ol class="news">[\s\S]*?<\/ol>/g,()=>'<ol class="news">'+next[k++].join('')+'</ol>')+source.slice(end);
}
// 바닥 「회사·사업 안내 기준일」은 홈 소식 줄의 가장 최근 날짜보다 앞설 수 없다(SYNK-website qa/news.test.mjs) — 판을 낸 날보다 앞서면 그날로 올리고, 뒤로는 돌리지 않는다.
function updateFooterDate(source,manifest){
  const day=releaseDay(manifest);
  return source.replace(/(<div class="foot-bottom">(?:(?!<\/div>)[\s\S])*?<time class="mono" datetime=")(\d{4}-\d{2}-\d{2})(">)[^<]*(<\/time>)/,(all,a,iso,b,c)=>iso<day?a+day+b+dayLabel(day)+c:all);
}
// 공개본에 쓸 파일을 쓰지 않고 만든다. 공개(release를 공개로 돌림) 전에 한 번 돌려 쪽 모양이 안 맞으면 release를 만들기 전에 멈춘다.
function planSite({publicDir,manifest,clientFile}){
  const writes=[];
  const read=relative=>{const file=path.join(publicDir,relative);if(fs.existsSync(file))return fs.readFileSync(file,'utf8');if(!fs.existsSync(path.join(publicDir,'.git')))return null;try{return run('git',['show','HEAD:'+relative],publicDir)+'\n';}catch{return null;}};
  const put=(relative,value)=>writes.push({relative,value});
  put(FEED,JSON.stringify(manifest,null,2)+'\n');
  const client=fs.readFileSync(clientFile,'utf8'),hash=crypto.createHash('sha256').update(client).digest('hex').slice(0,12);
  put('desktop/releases/client.js',client);
  const knowledgeHashes={};
  for(const relative of ['knowledge.json','en/knowledge.json']){const before=read(relative);if(before===null)continue;const value=updateSiteText(before,manifest);knowledgeHashes[relative]=crypto.createHash('sha256').update(value).digest('hex').slice(0,12);put(relative,value);}
  const pages=['index.html','en/index.html',...['lab','shift','pulse','path','atlas','founder'].flatMap(name=>[name+'/index.html','en/'+name+'/index.html']),'mn/index.html'];
  for(const relative of [...pages,'llms.txt','en/llms.txt','docs/platform.md','en/docs/platform.md']){
    const before=read(relative);if(before===null)continue;
    let value=updateSiteText(before,manifest);
    value=value.replace(/(data-knowledge="\/)((?:en\/)?knowledge\.json)\?v=[a-f0-9]+/g,(all,start,file)=>knowledgeHashes[file]?start+file+'?v='+knowledgeHashes[file]:all);
    if(pages.includes(relative))value=updateFooterDate(value,manifest);
    if(relative==='index.html'||relative==='en/index.html'){
      value=updateHomeNews(value,manifest);
      value=value.replace(/(<section[^>]*\bid="platform")(?:\s+data-platform-version="[^"]*")?/,`$1 data-platform-version="${manifest.version}"`);
      value=value.replace(/<script[^>]*src="\/desktop\/releases\/client\.js[^"\s]*"[^>]*><\/script>\s*/g,'');
      assert(value.includes('</body>'),'Homepage body missing');
      value=value.replace('</body>',`<script defer src="/desktop/releases/client.js?v=${hash}"></script>\n</body>`);
      for(const artifact of manifest.artifacts)assert(value.includes(artifact.url),'Homepage is missing '+artifact.platform+' '+artifact.arch);
    }
    put(relative,value);
  }
  return writes;
}
function stageSite({publicDir,manifest,clientFile}){
  const changed=[];
  for(const {relative,value} of planSite({publicDir,manifest,clientFile})){const file=path.join(publicDir,relative);if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===value)continue;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);changed.push(relative);}
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
  // Signing is deterministic, so a resumed --apply rebuilds the very feed it staged before.
  const manifest=signForPublication(JSON.parse(fs.readFileSync(get('manifest'),'utf8')),{keyFile:get('signing-key')}),publicDir=path.resolve(get('public')),artifactDir=path.resolve(get('artifacts'));
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
  // 홈 · 소식 줄 · 바닥 기준일을 바꿀 수 있는지 release를 공개하기 전에 미리 만들어 본다(못 바꾸면 여기서 멈춘다).
  report.siteFiles=planSite({publicDir,manifest,clientFile:path.resolve(get('client'))}).length;
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
module.exports={validateRelease,updateSiteText,releaseDay,updateHomeNews,updateFooterDate,planSite,stageSite,verifyLocalFiles,verifyPublicArtifact};
