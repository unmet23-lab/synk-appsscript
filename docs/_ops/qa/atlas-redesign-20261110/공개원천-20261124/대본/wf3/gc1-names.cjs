const {execFileSync}=require('child_process');const fs=require('fs'),path=require('path');
const C=process.argv[2];
const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'],{maxBuffer:1<<28}).toString());
const live=new Map(tree.tree.filter(t=>t.type==='blob').map(t=>[t.path,t.sha]));
const T=['world/blank-slice','world/entry-check','world/order-rush','world/snap-words','world/subway-rush','world/hangul-stage','world/korean-rhythm','world/korean-runner'].map(g=>g+'/atlas-learning.js');
for(const p of T){const s=fs.readFileSync(path.join(C,live.get(p)),'utf8');
 const site=s.search(/\n\s*status,\n\s*invalidate\(code2? = "STORAGE_ERROR"\) \{|status,invalidate\(code2?="STORAGE_ERROR"\)/);
 const fnAt=s.lastIndexOf('function createLearningSync',site);const body=s.slice(fnAt,site);
 const count=re=>(body.match(re)||[]).length;
 console.log(p.padEnd(40),'let stopped',count(/let stopped\b|stopped = false|stopped=false/g),'· canPersist 정의',count(/(const|let|function) canPersist\b|canPersist = |canPersist=/g),'· state 정의',count(/(const|let) state\b|state = \{|state=\{|let state=/g),'· port',count(/\bport\./g),'· 다른 이름 state2',count(/\bstate2\b/g),'port2',count(/\bport2\b/g));}
