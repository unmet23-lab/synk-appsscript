// WORLD 첫 공개 1단계 후보(라이브 + 새 길 조각) — 설계 주인 11-20 (가) 선택 공개.
//   node cand.cjs <커밋 X>      (X = 검수자 이름을 뺀 master 커밋, 그 커밋의 공개 빌드가 wf.cjs build로 만들어져 있어야 한다)
// 만드는 것(후보 폴더 OUT):
//   new/world/…   — 새 길 새 파일(X 빌드 그대로)과 공용 파일의 「라이브 + (바탕 → 내 판)」 3방향 결과
//   base/world/…  — 공용 파일의 바탕(단계 4 직전 A0 원천을 빌드와 같은 고쳐 쓰기로)
//   mine/world/…  — 공용 파일의 내 판(X 원천에서 라이브 밖 다른 일 커밋을 되돌린 것)
//   report.json   — 파일마다 갈래 · 겹침 수 · 되돌린 커밋
// 겹침(3방향 충돌)이 있으면 그 파일을 conflict로 적고 멈춤 목록에 둔다 — 손으로 풀고 다시 돌린다(resolved/ 폴더의 파일을 쓴다).
const {execFileSync,spawnSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const worktree='D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const exp='D:/SYNK-worktrees/world-export-atlas-20261120b',build=path.join(exp,'.tmp/world-public-atlas-20261120');
const OUT='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1';
const X=process.argv[2];if(!X)throw Error('commit');const A0='8fd4a3e8e^';
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const git=(...a)=>execFileSync('git',['-C',worktree,'-c','core.autocrlf=false',...a],{maxBuffer:1<<28,env});
const show=(rev,file)=>{try{return git('show',`${rev}:${file}`).toString('utf8').replace(/\r\n/g,'\n');}catch{return null;}};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const config=JSON.parse(fs.readFileSync(path.join(build,'world/world-config.json'),'utf8'));
// tools/build-world-app-public.mjs rewrite()와 같은 글(relative는 world/ 뒤 경로).
function rewrite(text,relative){
 text=text.replaceAll('../synk-world-home/',relative.startsWith('brand-opening/')?'../':'./').replaceAll('href="../learning-hub/"','href="'+config.account.learningUrl+'"');
 if(relative==='me2-shop.mjs'){const from="'../play-common/drag-rail.js'";text=text.replace(from,"'./play-common/drag-rail.js'");}
 if(!relative.includes('/'))text=text.replaceAll('../brand-opening/','./brand-opening/');
 if(relative==='world-front-entry.mjs')text=text.replace("from '../seoul-arrival/","from './seoul-arrival/");
 if(relative==='world-missed-spot.mjs')text=text.replaceAll("from '../entry-check/","from './entry-check/");
 text=text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g,(_,quote,folder)=>quote+config.basePath+folder);
 return text;
}
const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'],{maxBuffer:1<<28,env}).toString('utf8'));
const liveHead=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/commits/main'],{maxBuffer:1<<26,env}).toString('utf8')).sha;
const liveSha=new Map(tree.tree.filter(t=>t.type==='blob'&&t.path.startsWith('world/')).map(t=>[t.path.slice(6),t.sha]));
const cacheDir=path.join(build,'live-blobs');fs.mkdirSync(cacheDir,{recursive:true});
// 고쳐 쓰기 값(배우기 허브 주소 · basePath)은 라이브 설정과 같아야 한다 — 라이브 world-config.json은 그대로 두므로.
const liveConfigSha=liveSha.get('world-config.json');
function live(p){const s=liveSha.get(p);if(!s)return null;const f=path.join(cacheDir,s);if(!fs.existsSync(f))fs.writeFileSync(f,Buffer.from(JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/blobs/'+s],{maxBuffer:1<<28,env}).toString('utf8')).content,'base64'));return fs.readFileSync(f);}
{const lc=JSON.parse(live('world-config.json').toString('utf8'));if(lc.basePath!==config.basePath||lc.account?.learningUrl!==config.account?.learningUrl)throw Error('라이브 설정과 고쳐 쓰기 값이 다르다: '+JSON.stringify([lc.basePath,lc.account?.learningUrl,config.basePath,config.account?.learningUrl]));console.log('고쳐 쓰기 값 = 라이브 설정',lc.basePath,lc.account?.learningUrl);}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cand-'));
// git merge-file: current에 (base → other) 변경을 얹는다. 겹침 수를 돌려준다.
function merge3(current,base,other,label){
 const c=path.join(tmp,'c'),b=path.join(tmp,'b'),o=path.join(tmp,'o');fs.writeFileSync(c,current);fs.writeFileSync(b,base);fs.writeFileSync(o,other);
 const r=spawnSync('git',['merge-file','-p','-L',label+'(지금)','-L','바탕','-L','새 판',c,b,o],{encoding:'utf8',maxBuffer:1<<28});
 if(r.status<0||r.error)throw r.error||Error('merge-file failed');return {text:r.stdout,conflicts:r.status};
}
// 새 길이 아닌, 라이브 밖 커밋(첫날 끝 앞면) — 내 판에서 되돌린다(classify-other.cjs로 가름).
const NOT_LIVE={
 'experiences/synk-world-app/app-shell.mjs':['ffdd763c24','d1e3f5efd','245db7a0f','00f803b63'],
 'experiences/brand-opening/home.mjs':['00f803b63'],
};
const SHARED=[
 ['experiences/synk-world-app/app-shell.mjs','app-shell.mjs'],['experiences/synk-world-app/world-learning-ui.mjs','world-learning-ui.mjs'],
 ['experiences/synk-world-app/life-ui.mjs','life-ui.mjs'],['experiences/synk-world-app/life-progress.mjs','life-progress.mjs'],
 ['experiences/synk-world-app/life-ui.css','life-ui.css'],['experiences/brand-opening/world-strings.mjs','brand-opening/world-strings.mjs'],
 ['experiences/brand-opening/home.mjs','brand-opening/home.mjs'],['experiences/brand-opening/home-tutor-lines.mjs','brand-opening/home-tutor-lines.mjs'],
 ['experiences/brand-opening/home-tutor.mjs','brand-opening/home-tutor.mjs'],['experiences/brand-opening/home.css','brand-opening/home.css'],
 ['experiences/brand-opening/world-lang.mjs','brand-opening/world-lang.mjs'],['experiences/synk-world-app/world-client.mjs','world-client.mjs'],
 ['experiences/synk-world-app/world-reminder-device.mjs','world-reminder-device.mjs'],['experiences/synk-world-app/world-session.mjs','world-session.mjs'],
];
const NEW=['world-atlas-next.mjs','world-practice-next.mjs','world-today.mjs','world-position-next.mjs','world-diagnostic-next.mjs','world-mock-next.mjs','world-position-next-view.mjs','world-plan-next.mjs','world-lookback-next.mjs','world-me-next.mjs','world-month-answer.mjs','world-old-engine-doors.mjs','world-atlas-game.mjs',
 // 게임 키트 아홉은 1단계에서 뺀다(11-20 — X 뒤 4-6d가 바꿨고 라이브 게임은 아직 부르지 않는다 · 게임 공개 때 함께). KITS=1이면 넣는다.
 ...(process.env.KITS==='1'?['blank-slice','entry-check','korean-racing','korean-rhythm','korean-runner','order-rush','snap-words','subway-rush','talk-rally'].map(g=>`${g}/kit/atlas-next.mjs`):[])];
fs.rmSync(OUT,{recursive:true,force:true});for(const d of ['new','base','mine'])fs.mkdirSync(path.join(OUT,d,'world'),{recursive:true});
const put=(dir,p,bytes)=>{const f=path.join(OUT,dir,'world',p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,bytes);};
const report={X,A0,liveHead,files:[],stops:[]};
for(const p of NEW){
 if(liveSha.has(p))report.stops.push(`${p}: 새 파일인데 라이브에 이미 있다`);
 const f=path.join(build,'world',p);if(!fs.existsSync(f)){report.stops.push(`${p}: X 빌드에 없다`);continue;}
 const b=fs.readFileSync(f);put('new',p,b);report.files.push({p,kind:'new',bytes:b.length,sha256:sha(b)});
}
const resolvedDir=path.join(OUT,'..','cand-step1-resolved');
for(const [src,p] of SHARED){
 const L=live(p);if(!L){report.stops.push(`${p}: 라이브에 없다`);continue;}
 // MINE_ROOT: 내 판 원천을 git X 대신 그 폴더(X + 주석 이름 지우기 = X′)에서 읽는다.
 const baseSrc=show(A0,src);let mineSrc=process.env.MINE_ROOT?fs.readFileSync(path.join(process.env.MINE_ROOT,src),'utf8').replace(/\r\n/g,'\n'):show(X,src);const reverted=[];
 for(const c of NOT_LIVE[src]||[]){ // 새것부터 되돌린다(배열 차례가 새것 먼저)
  const after=show(c,src),before=show(c+'^',src);const r=merge3(mineSrc,after,before,'되돌리기 '+c);
  reverted.push({c,conflicts:r.conflicts});mineSrc=r.text;
 }
 const base=rewrite(baseSrc,p),mine=rewrite(mineSrc,p),theirs=L.toString('utf8').replace(/\r\n/g,'\n');
 put('base',p,base);put('mine',p,mine);
 const resolved=path.join(resolvedDir,p);
 let result,conflicts;
 if(fs.existsSync(resolved)){result=fs.readFileSync(resolved,'utf8');conflicts=/^<{7}|^={7}$|^>{7}/m.test(result)?-1:0;}
 else ({text:result,conflicts}=merge3(theirs,base,mine,'라이브'));
 // 손으로 푼 판(resolved/)이 있으면 그 판이 후보다 — 내 판의 되돌리기 겹침은 그 판을 지은 길(rebase-shell.cjs)이 대신 본다.
 const revertConflicts=fs.existsSync(resolved)?0:reverted.reduce((n,r)=>n+(r.conflicts>0?r.conflicts:0),0);
 put('new',p,result);
 report.files.push({p,src,kind:'merged',reverted,revertConflicts,conflicts,resolvedByHand:fs.existsSync(resolved),bytes:Buffer.byteLength(result),liveBytes:L.length,sha256:sha(Buffer.from(result))});
 if(conflicts||revertConflicts)report.stops.push(`${p}: 3방향 겹침 ${conflicts} · 되돌리기 겹침 ${revertConflicts} — ${resolved}에 푼 판을 두고 다시 돌린다`);
}
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,1));
console.log('후보',report.files.length,'파일 · 멈춤',report.stops.length,'· 라이브',liveHead.slice(0,9));
for(const f of report.files.filter(f=>f.kind==='merged'))console.log(' ',f.p.padEnd(36),'겹침',f.conflicts,'되돌리기',f.reverted.map(r=>r.c+':'+r.conflicts).join(',')||'-','바이트',f.liveBytes,'→',f.bytes);
for(const s of report.stops)console.log('  멈춤',s);
