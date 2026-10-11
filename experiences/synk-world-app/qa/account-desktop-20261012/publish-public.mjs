import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const work=path.resolve('.tmp/tutor-account-desktop-20261012'),repo='C:/Users/q1212/Documents/synk-policy';
const plan=JSON.parse(fs.readFileSync(path.join(work,'public-candidate.json')));
const git=(args,options={})=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',maxBuffer:20e6,windowsHide:true,...options});
const current=()=>execFileSync('gh',['api','repos/unmet23-lab/synk-policy/branches/main','--jq','.commit.sha'],{encoding:'utf8',windowsHide:true}).trim();
assert.equal(current(),plan.baseline,'Public parent advanced');
const proof=JSON.parse(fs.readFileSync(path.join(work,'bundle-manifest.json')));
assert.equal(proof.baseline.matchesPublic,true);
assert.equal(proof.onlyFrozenHeadPlusOwnAdapter,true);
assert.equal(plan.changes.length,6);
const env={...process.env,GIT_INDEX_FILE:path.join(work,'publish.index')};
git(['read-tree',plan.baseline],{env});
for(const e of plan.changes){
 const file=path.join(plan.payload,e.path),bytes=fs.readFileSync(file);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);
 const blob=git(['hash-object','-w','--no-filters',file]).trim();
 git(['update-index','--add','--cacheinfo',`100644,${blob},${e.path}`],{env});
}
const tree=git(['write-tree'],{env}).trim();
assert.deepEqual(git(['diff','--name-only','-z',plan.baseline,tree]).split('\0').filter(Boolean).sort(),plan.changes.map(e=>e.path).sort());
assert.equal(git(['diff','--name-only','--diff-filter=D',plan.baseline,tree]).trim(),'');
const message=path.join(work,'public-message.txt');
fs.writeFileSync(message,'Connect WORLD tutor home to desktop native account session\n\nUse fixed native account operations and restore the home when the native account changes. Load the existing WORLD bootstrap through an external script under the desktop CSP. Preserve all existing public game, expression and wardrobe files.\n');
const commit=git(['commit-tree',tree,'-p',plan.baseline,'-F',message]).trim();
assert.equal(current(),plan.baseline);
const receipt={createdAt:new Date().toISOString(),parent:plan.baseline,commit,tree,changedFiles:6,deleted:0,sharedCheckoutWrites:0,forcePush:false,changes:plan.changes};
fs.writeFileSync(path.join(work,'publication.json'),JSON.stringify(receipt,null,2)+'\n');
if(process.argv.includes('--apply')){git(['push','origin',commit+':refs/heads/main']);receipt.publishedAt=new Date().toISOString();fs.writeFileSync(path.join(work,'publication.json'),JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt));
