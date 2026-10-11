'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const work=path.resolve('.tmp/tutor-account-desktop-20261012');
const git=(args,options={})=>execFileSync('git',args,{encoding:'utf8',maxBuffer:30e6,windowsHide:true,...options});
const base=git(['rev-parse','HEAD']).trim(),env={...process.env,GIT_INDEX_FILE:path.join(work,'source-commit.index')};
const files=[
 'desktop/src/account-requests.cjs','desktop/src/auth-service.cjs','desktop/src/catalog.cjs','desktop/src/security.cjs','desktop/src/world-requests.cjs',
 'desktop/tests/auth.test.cjs','desktop/tests/world-cloud-preview.test.cjs','desktop/tests/world-requests.test.cjs','desktop/tools/world-tutor-native-smoke.cjs',
 'experiences/synk-world-app/app-shell.mjs','experiences/synk-world-app/document.mjs','experiences/synk-world-app/world-bootstrap.js','experiences/synk-world-app/server.mjs','experiences/synk-world-app/world-account.mjs','experiences/synk-world-app/world-account.bundle.mjs','experiences/synk-world-app/qa/document.test.mjs','experiences/synk-world-app/qa/native-account.test.mjs','tools/build-world-app-public.mjs'
];
for(const dir of ['experiences/synk-world-app/qa/account-desktop-20261012','experiences/synk-world-app/qa/tutor-switch-20261011/backend-life-20261012'])for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isFile()&&!e.name.endsWith('.eszip'))files.push(dir+'/'+e.name);
const docs=JSON.parse(fs.readFileSync(path.join(work,'own-docs.json')));
assert.equal(git(['diff','--cached','--name-only','--',...files,...docs.map(e=>e.path)]).trim(),'','Another task has staged a scoped file');
git(['read-tree',base],{env});
for(const file of files){const blob=git(['hash-object','-w','--path='+file,file]).trim();git(['update-index','--add','--cacheinfo',`100644,${blob},${file}`],{env});}
for(const d of docs){const blob=git(['hash-object','-w','--stdin'],{input:d.headContent}).trim();git(['update-index','--add','--cacheinfo',`100644,${blob},${d.path}`],{env});}
git(['diff','--cached','--check'],{env});const tree=git(['write-tree'],{env}).trim();
const changed=git(['diff','--name-only','-z',base,tree]).split('\0').filter(Boolean);assert.ok(changed.every(p=>files.includes(p)||docs.some(d=>d.path===p)));assert.equal(git(['diff','--name-only','--diff-filter=D',base,tree]).trim(),'');
const message=path.join(work,'source-message.txt');fs.writeFileSync(message,'Connect WORLD tutor home to native account and verify real account persistence\n\nPreserve native credential boundaries, support the WORLD route under the existing CSP, and restore the home when the account changes. Record the live life-record allowlist fix, actual login/save/re-login verification and WORLD 0.4.2 installation with a scoped Platform release catalog update.\n');
const commit=git(['commit-tree',tree,'-p',base,'-F',message]).trim();git(['update-ref','HEAD',commit,base]);
const report={at:new Date().toISOString(),base,commit,files:changed,privateIndex:true,unrelatedWorkingChangesPreserved:true,pushed:false};fs.writeFileSync(path.join(work,'source-commit.json'),JSON.stringify(report,null,2));
git(['reset','-q','HEAD','--',...changed]);console.log(JSON.stringify({commit,files:changed.length,pushed:false}));
