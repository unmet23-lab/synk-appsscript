'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const qa=__dirname,root=path.resolve(qa,'../../../..'),record=JSON.parse(fs.readFileSync(path.join(qa,'selected-files.json'))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(args,options={})=>cp.execFileSync('git',['-c','maintenance.auto=false','-c','gc.auto=0',...args],{cwd:root,windowsHide:true,maxBuffer:64*1024*1024,...options});
const text=args=>git(args,{encoding:'utf8'}).trim();
const indexPath=path.join(root,text(['rev-parse','--git-path','index'])),originalIndex=sha(fs.readFileSync(indexPath)),originalHEAD=text(['rev-parse','HEAD']);
const temporaryIndex=path.join(qa,'source-index-'+crypto.randomUUID()),env={...process.env,GIT_INDEX_FILE:temporaryIndex};
const branch='codex/beginner-games-finish-20261010',ref='refs/heads/'+branch;
const message='feat(beginner-games): finish three beginner games, shops and account-safe revisit\n\nPreserve the published 10493b5a15 release source, assets and scoped QA. Add scene keepsakes, optional recall and honest reward guidance using the existing account contract. Keep unrelated classroom, wardrobe and account source changes outside this snapshot.\n';
const result={at:new Date().toISOString(),branch,parent:record.head,publicCommit:record.publicCommit,defaultIndexBefore:originalIndex,headBefore:originalHEAD};
try{
  for(const f of record.files){assert.equal(sha(fs.readFileSync(path.join(root,f.path))),f.workSHA256,'Work changed: '+f.path);assert.equal(sha(fs.readFileSync(path.join(root,record.overrides[f.path]||f.path))),f.stagedSHA256,'Snapshot changed: '+f.path);}
  const paths=[...new Set([...record.paths,path.relative(root,__filename).replaceAll('\\','/'),path.relative(root,path.join(qa,'selected-files.json')).replaceAll('\\','/')])].sort();
  const files=paths.map(p=>path.join(root,record.overrides[p]||p).replaceAll('\\','/'));
  assert(files.every(p=>!p.includes('\n')&&!p.includes('"')),'Unsupported path quoting');
  const blobs=git(['hash-object','-w','--no-filters','--stdin-paths'],{encoding:'utf8',input:files.join('\n')+'\n'}).trim().split(/\r?\n/);assert.equal(blobs.length,paths.length);
  git(['read-tree',record.head],{env});
  git(['update-index','-z','--index-info'],{env,input:paths.map((p,i)=>'100644 '+blobs[i]+'\t'+p+'\0').join('')});
  const changed=git(['diff','--cached','--name-status','-z',record.head],{env,encoding:'utf8'}).split('\0').filter(Boolean),rows=[];
  for(let i=0;i<changed.length;i+=2){assert(['A','M'].includes(changed[i]),'Unexpected deletion/rename');assert(paths.includes(changed[i+1]),'Out of scope: '+changed[i+1]);rows.push({change:changed[i],path:changed[i+1]});}
  assert(rows.length>100,'Missing game source');
  const tree=git(['write-tree'],{env,encoding:'utf8'}).trim();
  const commit=git(['commit-tree',tree,'-p',record.head],{encoding:'utf8',input:message}).trim();
  git(['update-ref',ref,commit,'']);
  Object.assign(result,{commit,tree,files:rows.length,added:rows.filter(r=>r.change==='A').length,modified:rows.filter(r=>r.change==='M').length,deletions:0});
  console.log(JSON.stringify({prepared:true,branch,commit,files:rows.length}));
  const pushed=git(['push','origin',ref],{encoding:'utf8',timeout:180000});
  result.pushOutput=pushed;
  const remote=text(['ls-remote','origin',ref]).split(/\s+/)[0];assert.equal(remote,commit,'Remote ref mismatch');
  result.remoteCommit=remote;result.pushed=true;
  result.defaultIndexAfter=sha(fs.readFileSync(indexPath));result.headAfter=text(['rev-parse','HEAD']);
  assert.equal(result.defaultIndexAfter,originalIndex,'Shared index changed during scoped operation');assert.equal(result.headAfter,originalHEAD,'Shared HEAD changed during scoped operation');
  for(const f of record.files)assert.equal(sha(fs.readFileSync(path.join(root,f.path))),f.workSHA256,'Work changed during push: '+f.path);
  result.sharedIndexAndHeadPreserved=true;result.workingFilesPreserved=true;
  fs.writeFileSync(path.join(qa,'source-push-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pushed:true,branch,commit,files:rows.length,sharedIndexAndHeadPreserved:true}));
}catch(error){result.error=error.message;fs.writeFileSync(path.join(qa,'source-push-result.json'),JSON.stringify(result,null,2)+'\n');console.error(error.message);process.exitCode=1;}
