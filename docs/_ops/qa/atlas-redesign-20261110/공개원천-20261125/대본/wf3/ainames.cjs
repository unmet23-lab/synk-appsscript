// 후보의 더한 줄(새 파일은 모든 줄)에서 공개.js의 AI 이름 정규식에 걸리는 곳을 원천 파일별로 센다.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const src=fs.readFileSync('C:/Users/q1212/Documents/SYNK-appsscript/tools/공개.js','utf8');
const grab=name=>{const m=new RegExp('const '+name+' = (/.*/[a-z]*);').exec(src);return eval(m[1]);};
const A=grab('AI이름'),K=grab('AI한글이름');
const C='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1';
const report=JSON.parse(fs.readFileSync(path.join(C,'report.json'),'utf8'));
let total=0;const bySrc={};
for(const f of report.files){
 const cand=fs.readFileSync(path.join(C,'pub/world',f.p),'utf8');let lines;
 if(f.kind==='merged'){const r=spawnSync('git',['diff','--no-index','-U0','--',path.join(C,'pubbase/world',f.p),path.join(C,'pub/world',f.p)],{encoding:'utf8',maxBuffer:1<<28});lines=r.stdout.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>l.slice(1));}
 else lines=cand.split('\n');
 const hits=lines.filter(l=>A.test(l)||K.test(l));
 if(hits.length){bySrc[f.p]=hits.length;total+=hits.length;}
}
console.log('걸리는 줄',total);for(const [p,n] of Object.entries(bySrc))console.log(' ',p.padEnd(40),n);
const words={};for(const f of report.files){const cand=fs.readFileSync(path.join(C,'pub/world',f.p),'utf8');for(const m of cand.matchAll(new RegExp(A.source,'gi')))words[m[0]]=(words[m[0]]||0)+1;for(const m of cand.matchAll(new RegExp(K.source,'gi')))words[m[0]]=(words[m[0]]||0)+1;}
console.log('낱말',JSON.stringify(words));
