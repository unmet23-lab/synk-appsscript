// 라이브 공용 파일마다 가장 가까운 master 판(고쳐 쓴 원천과 라이브의 다른 줄 수가 가장 적은 커밋)을 찾는다.
//   node closest.cjs [파일…]
const {execFileSync,spawnSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {makeRewrite}=require('./rewrite-lib.cjs');
const worktree='D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const C='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1';
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const git=(...a)=>execFileSync('git',['-C',worktree,'-c','core.autocrlf=false',...a],{maxBuffer:1<<28,env});
const config={basePath:'/world/',account:{learningUrl:'https://synk.im/try/learning-hub/'}};const rewrite=makeRewrite(config);
const SHARED=[['experiences/synk-world-app/app-shell.mjs','app-shell.mjs'],['experiences/synk-world-app/world-learning-ui.mjs','world-learning-ui.mjs'],['experiences/synk-world-app/life-ui.mjs','life-ui.mjs'],['experiences/synk-world-app/life-progress.mjs','life-progress.mjs'],['experiences/synk-world-app/life-ui.css','life-ui.css'],['experiences/brand-opening/world-strings.mjs','brand-opening/world-strings.mjs'],['experiences/brand-opening/home.mjs','brand-opening/home.mjs'],['experiences/brand-opening/home-tutor-lines.mjs','brand-opening/home-tutor-lines.mjs'],['experiences/brand-opening/home-tutor.mjs','brand-opening/home-tutor.mjs'],['experiences/brand-opening/home.css','brand-opening/home.css'],['experiences/brand-opening/world-lang.mjs','brand-opening/world-lang.mjs'],['experiences/synk-world-app/world-client.mjs','world-client.mjs'],['experiences/synk-world-app/world-reminder-device.mjs','world-reminder-device.mjs'],['experiences/synk-world-app/world-session.mjs','world-session.mjs']];
const only=process.argv.slice(2);
const report=JSON.parse(fs.readFileSync(path.join(C,'report.json'),'utf8'));
const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'],{maxBuffer:1<<28,env}).toString('utf8'));
const liveSha=new Map(tree.tree.filter(t=>t.type==='blob'&&t.path.startsWith('world/')).map(t=>[t.path.slice(6),t.sha]));
const cache='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'closest-'));
const count=(a,b)=>{const fa=path.join(tmp,'a'),fb=path.join(tmp,'b');fs.writeFileSync(fa,a);fs.writeFileSync(fb,b);const r=spawnSync('git',['diff','--no-index','--numstat','--',fa,fb],{encoding:'utf8',maxBuffer:1<<26});const m=/^(\d+)\s+(\d+)/.exec(r.stdout||'');return m?(+m[1])+(+m[2]):0;};
const out={};
for(const [src,p] of SHARED){
 if(only.length&&!only.includes(p))continue;
 const live=fs.readFileSync(path.join(cache,liveSha.get(p)),'utf8').replace(/\r\n/g,'\n');
 const commits=git('log','--format=%H %cs','--since=2026-09-20','8fd4a3e8e^','--',src).toString().trim().split('\n').filter(Boolean);
 let best=null;const seen=new Map();
 for(const line of commits){const [h,d]=line.split(' ');const blob=git('rev-parse',`${h}:${src}`).toString().trim();if(seen.has(blob))continue;
  const text=rewrite(git('cat-file','-p',blob).toString('utf8').replace(/\r\n/g,'\n'),p);const n=count(text,live);seen.set(blob,n);
  if(!best||n<best.n)best={h:h.slice(0,10),d,n};if(n===0)break;}
 const a0=rewrite(git('show',`8fd4a3e8e^:${src}`).toString('utf8').replace(/\r\n/g,'\n'),p);
 out[p]={closest:best,vsA0:count(a0,live),versions:seen.size};
 console.log(p.padEnd(36),'가장 가까운',best?.h,best?.d,'다른 줄',best?.n,'· A0와 다른 줄',out[p].vsA0,'· 본 판',seen.size);
}
fs.writeFileSync(path.join(C,'closest.json'),JSON.stringify(out,null,1));
