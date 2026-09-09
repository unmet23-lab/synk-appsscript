'use strict';
// 같은 공개 소스만 작은 Git 전송 단위로 보낸다. 인증은 호출 프로세스 환경에만 존재한다.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const repo=process.argv[2],remote=process.argv[3];
if(!repo||!remote||!remote.startsWith('https://git.chatgpt-team.site/'))throw Error('Expected explicit site source repository');
const run=(args,opt={})=>{const r=cp.spawnSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:20*1024*1024,timeout:180000,...opt});if(r.status!==0)throw Error(r.error?.message||r.stderr||'Git command failed');return r.stdout.trim()};
const head=run(['rev-parse','HEAD']),tree=run(['rev-parse','HEAD^{tree}']);
const index=path.join(repo,'.git','share-batch.index');
const env={...process.env,GIT_INDEX_FILE:index};
run(['branch','--list','codex/initial-full-share'])||run(['branch','codex/initial-full-share',head]);
const existing=run(['ls-remote',remote,'refs/heads/main']).split(/\s/)[0];
let parent=existing||null;
if(parent){
 run(['fetch','--quiet',remote,'main']);
 if(run(['rev-parse',parent+'^{tree}'])===tree){run(['push',remote,parent+':refs/heads/main']);run(['update-ref','refs/heads/main',parent,head]);console.log('FINAL_HEAD '+run(['rev-parse','--verify','HEAD']));process.exit(0)}
}
// 선행 전송이 나중에 완료되어도 non-fast-forward 거절이 덮어쓰기를 막는다.
run(parent?['read-tree',parent]:['read-tree','--empty'],{env});
let entries=cp.execFileSync('git',['ls-tree','-rlz',head],{cwd:repo}).toString('utf8').split('\0').filter(Boolean).map(s=>{const m=/^(\d+) blob ([0-9a-f]+)\s+(\d+)\t([\s\S]+)$/.exec(s);if(!m)throw Error('Unexpected tree entry');return {mode:m[1],sha:m[2],size:Number(m[3]),name:m[4]}});
if(parent){const present=new Map(cp.execFileSync('git',['ls-tree','-rz',parent],{cwd:repo}).toString('utf8').split('\0').filter(Boolean).map(s=>{const m=/^\d+ blob ([0-9a-f]+)\t([\s\S]+)$/.exec(s);return [m[2],m[1]]}));entries=entries.filter(e=>present.get(e.name)!==e.sha)}
entries.sort((a,b)=>a.size-b.size);
const groups=[];let group=[],bytes=0;for(const e of entries){if(group.length&&(group.length>=32||bytes+e.size>18*1024*1024)){groups.push(group);group=[];bytes=0}group.push(e);bytes+=e.size}if(group.length)groups.push(group);
for(let i=0;i<groups.length;i++){
 for(const e of groups[i])run(['update-index','--add','--cacheinfo',e.mode+','+e.sha+','+e.name],{env});
 const nextTree=run(['write-tree'],{env});
 const commit=run(['commit-tree',nextTree,...(parent?['-p',parent]:[]),'-m','Curated marketing source '+(i+1)+'/'+groups.length]);
 console.log('Transferring batch '+(i+1)+'/'+groups.length+' ('+groups[i].length+' files)');
 const pushed=cp.spawnSync('git',['push',remote,commit+':refs/heads/main'],{cwd:repo,encoding:'utf8',timeout:180000,maxBuffer:1024*1024});
 if(pushed.status!==0)throw Error(pushed.error?.message||pushed.stderr||'Push failed');
 parent=commit;console.log('Batch '+(i+1)+' accepted');
}
if(run(['rev-parse',parent+'^{tree}'])!==tree)throw Error('Final public source tree mismatch');
run(['update-ref','refs/heads/main',parent,head]);
console.log('FINAL_HEAD '+run(['rev-parse','--verify','HEAD']));
