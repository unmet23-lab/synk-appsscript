// 공용 파일마다 단계 4 직전(A0) 뒤의 「새 길이 아닌 커밋」이 라이브에 들어 있는지 가른다.
//   node classify-other.cjs <커밋 X>
// 커밋의 더한 줄(뜻 있는 줄)이 라이브 파일(LF · 빌드 고쳐 쓰기 반영)에 얼마나 있는지 센다. 대부분 있으면 L(라이브), 거의 없으면 N(라이브 밖).
const {execFileSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path');
const worktree='D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const build='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120';
const X=process.argv[2];if(!X)throw Error('commit');const A0='8fd4a3e8e^';
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const git=(...a)=>execFileSync('git',['-C',worktree,...a],{maxBuffer:1<<28,env}).toString('utf8');
const ATLAS=/Atlas (?:재설계 )?단계 ?4|Atlas 엔진 · WORLD 셸|Atlas 엔진\(단계 4|Atlas 4-4d|Atlas 단계4/;
const SHARED=[
 ['experiences/synk-world-app/app-shell.mjs','app-shell.mjs'],['experiences/synk-world-app/world-learning-ui.mjs','world-learning-ui.mjs'],
 ['experiences/synk-world-app/life-ui.mjs','life-ui.mjs'],['experiences/synk-world-app/life-progress.mjs','life-progress.mjs'],
 ['experiences/synk-world-app/life-ui.css','life-ui.css'],['experiences/brand-opening/world-strings.mjs','brand-opening/world-strings.mjs'],
 ['experiences/brand-opening/home.mjs','brand-opening/home.mjs'],['experiences/brand-opening/home-tutor-lines.mjs','brand-opening/home-tutor-lines.mjs'],
 ['experiences/brand-opening/home-tutor.mjs','brand-opening/home-tutor.mjs'],['experiences/brand-opening/home.css','brand-opening/home.css'],
 ['experiences/brand-opening/world-lang.mjs','brand-opening/world-lang.mjs'],['experiences/synk-world-app/world-client.mjs','world-client.mjs'],
 ['experiences/synk-world-app/world-reminder-device.mjs','world-reminder-device.mjs'],['experiences/synk-world-app/world-session.mjs','world-session.mjs'],
];
const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'],{maxBuffer:1<<28,env}).toString('utf8'));
const liveSha=new Map(tree.tree.filter(t=>t.type==='blob'&&t.path.startsWith('world/')).map(t=>[t.path.slice(6),t.sha]));
const cacheDir=path.join(build,'live-blobs');fs.mkdirSync(cacheDir,{recursive:true});
function live(p){const sha=liveSha.get(p);if(!sha)return null;const f=path.join(cacheDir,sha);if(!fs.existsSync(f))fs.writeFileSync(f,Buffer.from(JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/blobs/'+sha],{maxBuffer:1<<28,env}).toString('utf8')).content,'base64'));return fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');}
const norm=s=>s.replace(/\s+/g,' ').trim();
const out=[];
for(const [src,pub] of SHARED){
 const L=live(pub);if(L==null){out.push({src,pub,missingLive:true});continue;}
 const liveLines=new Set(L.split('\n').map(norm));
 const commits=git('log','--format=%H\t%s',A0+'..'+X,'--',src).trim().split('\n').filter(Boolean).map(l=>{const [h,...s]=l.split('\t');return {h,s:s.join('\t')};});
 const others=commits.filter(c=>!ATLAS.test(c.s));
 const rows=[];
 for(const c of others){
  const diff=git('show','--format=','-U0',c.h,'--',src);
  const added=diff.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>norm(l.slice(1).replace(/\.\.\/brand-opening\//g,'./brand-opening/').replace(/\.\.\/synk-world-home\//g,'./'))).filter(l=>l.length>=12);
  const inLive=added.filter(l=>liveLines.has(l)||[...liveLines].some(x=>x.includes(l.slice(0,60)))).length;
  rows.push({c:c.h.slice(0,9),s:c.s.slice(0,80),added:added.length,inLive,cls:added.length===0?'?':(inLive/added.length>=0.6?'L':(inLive/added.length<=0.2?'N':'mixed'))});
 }
 out.push({src,pub,atlas:commits.length-others.length,others:rows});
}
fs.writeFileSync(path.join(build,'classify-other.json'),JSON.stringify(out,null,1));
for(const f of out){console.log(`${f.pub}  atlas ${f.atlas}  others ${f.others?.length??'-'}${f.missingLive?' (라이브에 없음)':''}`);for(const r of f.others||[])console.log(`   ${r.cls.padEnd(5)} ${r.c} ${String(r.inLive).padStart(3)}/${String(r.added).padEnd(3)} ${r.s}`);}
