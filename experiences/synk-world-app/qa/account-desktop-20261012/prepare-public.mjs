import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const repo='C:/Users/q1212/Documents/synk-policy';
const work=path.resolve('.tmp/tutor-account-desktop-20261012');
fs.mkdirSync(work,{recursive:true});
const git=(args,options={})=>execFileSync('git',['-C',repo,...args],{maxBuffer:30e6,windowsHide:true,...options});
const baseline=git(['rev-parse','origin/main'],{encoding:'utf8'}).trim();
const payload=path.join(work,'public-payload-r2');
assert.ok(!fs.existsSync(payload),'Use a fresh payload; never overwrite a reviewed candidate');
fs.mkdirSync(payload);
const env={...process.env,GIT_INDEX_FILE:path.join(work,'extract-world.index')};
git(['read-tree',baseline+':world'],{env});
git(['checkout-index','--all','--prefix='+path.join(payload,'world').replaceAll('\\','/')+'/'],{env});
const changes=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function edit(name,transform){const file=path.join(payload,'world',name),before=fs.existsSync(file)?fs.readFileSync(file):null,after=Buffer.from(transform(before?.toString('utf8')));fs.writeFileSync(file,after);changes.push({path:'world/'+name,beforeSHA256:before?sha(before):null,sha256:sha(after),bytes:after.length});}
const revision='account-desktop-20261012';
for(const name of ['index.html','mobile.html','desktop.html'])edit(name,source=>{
 let config=0,timer=0;
 source=source.replace(/<script>window\.__SYNK_WORLD_CONNECTED__=true;window\.__SYNK_WORLD_CONFIG__=([\s\S]*?);<\/script>/,(_,json)=>{config++;JSON.parse(json);return `<script type="application/json" id="synk-world-config">${json}</script><script src="/world/world-bootstrap.js?v=${revision}"></script>`;});
 source=source.replace(/<script>window\.__synkOpeningSafetyTimer=setTimeout\(function\(\)\{document.getElementById\("synk-opening-cover"\)\?\.remove\(\)\},5000\)<\/script>/,()=>{timer++;return '';});
 assert.equal(config,1);assert.equal(timer,1);
 return source.replace(/(src="\/world\/app-shell\.mjs)\?v=[^" ]+/,`$1?v=${revision}`);
});
edit('world-bootstrap.js',()=>fs.readFileSync('experiences/synk-world-app/world-bootstrap.js','utf8'));
edit('app-shell.mjs',source=>{
 const old='onInvalidate:()=>client?.invalidate()';
 assert.equal(source.split(old).length,2);
 return source.replace(old,old+",onConnect:()=>client?.restore().catch(()=>home.toast('계정 연결을 다시 확인해 주세요.'))").replace(/(world-account\.bundle\.mjs)\?v=[^']+/,`$1?v=${revision}`);
});
edit('world-account.bundle.mjs',()=>fs.readFileSync(path.join(work,'world-account.bundle.mjs'),'utf8'));
for(const change of changes)if(/\.(?:mjs|js)$/.test(change.path))execFileSync(process.execPath,['--check',path.join(payload,change.path)],{windowsHide:true});
const plan={baseline,createdAt:new Date().toISOString(),payload,revision,changes,deleted:0};
fs.writeFileSync(path.join(work,'public-candidate.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({baseline,changes:changes.length,deleted:0,payload}));
