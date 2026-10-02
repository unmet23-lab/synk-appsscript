'use strict';
// 승인된 원래 커밋의 세 파일 차이만 apply_patch 형식으로 내보낸다. 사본 파일을 직접 쓰지 않는다.
const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const source='C:/Users/q1212/Documents/SYNK-appsscript'; const clone='C:/Users/q1212/Documents/SYNK-deploy-mn-20260909';
const base='184fe8c5d6d30795fd479293e743f1a1f066d7e8';const commit='8e62344a2';const files=['Code.js','엔진_운영배치.js','엔진_콘텐츠AI.js'];
const git=(cwd,args)=>execFileSync('git',['--no-optional-locks','-c','core.quotepath=false',...args],{cwd,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
assert.equal(git(source,['diff','--name-only',base,commit+'^','--',...files]).trim(),'','원격과 원 교정 부모 파일 차이');
assert.equal(git(clone,['rev-parse','HEAD']).trim(),base);
const diff=git(source,['diff','--no-ext-diff','--unified=0',commit+'^',commit,'--',...files]);
const lines=['*** Begin Patch'];let deleted=0,added=0;
for(const line of diff.split(/\r?\n/)){
  if(line.startsWith('diff --git ')){const file=line.split(' b/')[1];assert(files.includes(file));lines.push('*** Update File: '+clone+'/'+file);}
  else if(line.startsWith('@@'))lines.push('@@');
  else if(line.startsWith('---')||line.startsWith('+++')||line.startsWith('index '))continue;
  else if(line.startsWith('-')){deleted++;lines.push(line);}
  else if(line.startsWith('+')){added++;lines.push(line);}
}
assert.equal(added,71);assert.equal(deleted,71);lines.push('*** End Patch');
const patch=lines.join('\n')+'\n';
fs.writeFileSync(path.join(__dirname,'몽골어71.patch'),patch);
fs.writeFileSync(path.join(__dirname,'사본준비.json'),JSON.stringify({checkedAt:new Date().toISOString(),source,clone,remoteBase:base,sourceCommit:commit,files,originalParentMatchesRemote:true,added,deleted,remoteMutation:false},null,2)+'\n');
if(process.argv.includes('--patch'))process.stdout.write(patch);else console.log(JSON.stringify({files,added,deleted}));
