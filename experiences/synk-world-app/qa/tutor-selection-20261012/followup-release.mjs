import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const report=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(report,'../../../..'),repo=path.resolve(root,'../synk-policy');
const work=path.join(root,'.tmp/tutor-selection-sync-20261012/focus');
const payload=path.join(work,'public'),planFile=path.join(work,'candidate.json');
const revision='tutor-account-focus-20261012';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const git=(args,options={})=>execFileSync('git',['-C',repo,...args],{windowsHide:true,maxBuffer:5e6,...options});
const remote=()=>execFileSync('gh',['api','repos/unmet23-lab/synk-policy/branches/main','--jq','.commit.sha'],{windowsHide:true,encoding:'utf8'}).trim();
const source='experiences/synk-world-app/app-shell.mjs',app='world/app-shell.mjs';
const entries=['world/index.html','world/mobile.html','world/desktop.html'];
const expected=[app,...entries].sort();
const addition="// Switching between side-by-side web and desktop windows need not hide either\n// document. Refocus must also restore the latest selected companion.\nwindow.addEventListener('focus',()=>{if(!document.hidden&&client.snapshot&&!client.busy)void refreshTutorAccount();});\n";
const anchor="document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client.snapshot&&!client.busy)client.refresh().then(refreshTutorAccount).catch(()=>{});});";
function fileFor(name){const file=path.resolve(payload,name);assert.ok(file.startsWith(payload+path.sep));return file;}
function checkSecrets(name,text){
 assert.ok(!/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bsb_secret_[A-Za-z0-9_-]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/.test(text),'Potential secret in '+name);
}
fs.mkdirSync(work,{recursive:true});
if(!process.argv.includes('--publish')){
 const previous=JSON.parse(fs.readFileSync(path.join(report,'publication.json'),'utf8'));
 const baseline=remote(),sourceBytes=fs.readFileSync(path.join(root,source)),text=sourceBytes.toString('utf8');
 const newline=text.includes('\r\n')?'\r\n':'\n',block=addition.replaceAll('\n',newline);
 assert.equal(text.split(block).length,2,'Expected exactly the reviewed three focus lines');
 const priorSource=Buffer.from(text.replace(block,''));
 assert.equal(sha(priorSource),previous.changes.find(change=>change.path===app).sourceSHA256,'Source includes changes beyond the reviewed focus addition');
 const changes=[];
 for(const name of expected){
  const before=git(['show',baseline+':'+name]),beforeText=before.toString('utf8');
  assert.equal(sha(before),previous.changes.find(change=>change.path===name).sha256,'Public file changed since the verified tutor release: '+name);
  let after;
  if(name===app){assert.equal(beforeText.split(anchor).length,2);after=beforeText.replace(anchor,addition+anchor);}
  else {let count=0;after=beforeText.replace(/(src=["']\/world\/app-shell\.mjs)\?v=[^"']*(["'])/g,(_,prefix,quote)=>{count++;return prefix+'?v='+revision+quote;});assert.equal(count,1);}
  checkSecrets(name,after);
  const file=fileFor(name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,after);
  if(name===app)execFileSync(process.execPath,['--check',file],{windowsHide:true,stdio:'pipe'});
  const bytes=fs.readFileSync(file);assert.equal(sha(bytes),sha(Buffer.from(after)));
  changes.push({path:name,beforeSHA256:sha(before),sha256:sha(bytes),bytes:bytes.length});
 }
 assert.equal(sha(fs.readFileSync(path.join(root,source))),sha(sourceBytes),'Source changed while preparing');
 assert.equal(remote(),baseline,'Public branch advanced while preparing');
 const plan={createdAt:new Date().toISOString(),baseline,previousRelease:previous.commit,revision,payload,source,sourceSHA256:sha(sourceBytes),sourceDelta:'Three focus lines only',changes,deleted:0,sharedCheckoutWrites:0};
 fs.writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n');
 console.log(JSON.stringify({mode:'prepared',baseline,paths:expected,manifest:planFile},null,2));
}else{
 const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));assert.equal(plan.payload,payload);assert.equal(plan.revision,revision);
 assert.deepEqual(plan.changes.map(change=>change.path).sort(),expected);
 assert.equal(remote(),plan.baseline,'Public branch advanced; prepare again');
 assert.equal(sha(fs.readFileSync(path.join(root,source))),plan.sourceSHA256,'Source changed; prepare again');
 for(const change of plan.changes){const bytes=fs.readFileSync(fileFor(change.path));assert.equal(bytes.length,change.bytes);assert.equal(sha(bytes),change.sha256);checkSecrets(change.path,bytes.toString('utf8'));}
 const env={...process.env,GIT_INDEX_FILE:path.join(work,'publish.index')};
 git(['read-tree',plan.baseline],{env});
 for(const change of plan.changes){const blob=git(['hash-object','-w','--no-filters',fileFor(change.path)],{encoding:'utf8'}).trim();git(['update-index','--add','--cacheinfo',`100644,${blob},${change.path}`],{env});}
 const tree=git(['write-tree'],{env,encoding:'utf8'}).trim();
 assert.deepEqual(git(['diff','--name-only','-z',plan.baseline,tree],{encoding:'utf8'}).split('\0').filter(Boolean).sort(),expected);
 assert.equal(git(['diff','--name-only','--diff-filter=D',plan.baseline,tree],{encoding:'utf8'}).trim(),'');
 for(const change of plan.changes)assert.equal(sha(git(['show',tree+':'+change.path])),change.sha256);
 const message=path.join(work,'message.txt');fs.writeFileSync(message,'Refresh WORLD tutor selection when its window regains focus\n\nRestore account tutor changes after switching between visible desktop and browser windows. Keep the current activity and pending progress guarded.\n');
 const commit=git(['commit-tree',tree,'-p',plan.baseline,'-F',message],{encoding:'utf8'}).trim();
 assert.equal(remote(),plan.baseline,'Public branch advanced before push');
 git(['push','origin',commit+':refs/heads/main']);
 const publishedHead=remote();assert.equal(publishedHead,commit,'Check push outcome before retrying');
 const receipt={...plan,commit,tree,publishedAt:new Date().toISOString(),publishedHead,forcePush:false};
 fs.writeFileSync(path.join(report,'public-focus.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({mode:'published',commit,paths:expected},null,2));
}
