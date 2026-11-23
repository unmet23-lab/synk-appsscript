// 새 길(Atlas 단계 4) 커밋이 건드린 공개 파일을 고른다.
//   node atlas-set.cjs <커밋 X>
// 새 길 커밋 = 8fd4a3e8e(단계 4 잇기 첫 커밋, 11-11)부터 X까지 제목이 Atlas 단계 4 꼴인 커밋.
// 공개 파일마다 원천(빌드 manifest의 source)을 보고, 그 원천을 새 길 커밋 · 다른 커밋 중 누가 바꿨는지 센다.
const {execFileSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path');
const worktree='D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const build='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120';
const X=process.argv[2];if(!X)throw Error('commit');
const git=(...a)=>execFileSync('git',['-C',worktree,...a],{maxBuffer:1<<28}).toString('utf8');
const ATLAS=/Atlas (?:재설계 )?단계 ?4|Atlas 엔진 · WORLD 셸|Atlas 4-4d|Atlas 단계4/;
const log=git('log','--format=%H\t%s','8fd4a3e8e^..'+X).trim().split('\n').map(l=>{const [h,...s]=l.split('\t');return {h,s:s.join('\t')};});
const atlas=new Set(log.filter(c=>ATLAS.test(c.s)).map(c=>c.h));
const manifest=JSON.parse(fs.readFileSync(path.join(build,'manifest.json'),'utf8'));
const cmp=JSON.parse(fs.readFileSync(path.join(build,'compare-live.json'),'utf8'));
const state=new Map();for(const k of ['same','changed','added'])for(const p of cmp[k])state.set(p,k);
const bySource=new Map();for(const f of manifest.files)if(f.source){if(!bySource.has(f.source))bySource.set(f.source,[]);bySource.get(f.source).push(f.path);}
// 원천마다 8fd4a3e8e^..X 사이 커밋 — 한 번의 git log로 파일 → 커밋 표를 만든다
const touched=new Map();let cur=null;
for(const line of git('log','--format=@@%H','--name-only','8fd4a3e8e^..'+X).split(/\r?\n/)){if(line.startsWith('@@'))cur=line.slice(2);else if(line.trim()){const p=line.trim();if(!touched.has(p))touched.set(p,[]);touched.get(p).push(cur);}}
const rows=[];
for(const [src,paths] of bySource){
 const commits=touched.get(src)||[];
 if(!commits.length)continue;
 const a=commits.filter(c=>atlas.has(c)),o=commits.filter(c=>!atlas.has(c));
 if(!a.length)continue;
 rows.push({src,paths,states:paths.map(p=>state.get(p)||'?'),atlas:a.length,other:o.length,others:o.map(c=>log.find(l=>l.h===c)?.s.slice(0,70)||c.slice(0,9))});
}
// 생성 묶음: 원천이 아니라 빌드가 만든 파일(source 없음)도 새 길 원천을 품을 수 있다 — 이름으로 적는다
const generated=manifest.files.filter(f=>!f.source).map(f=>f.path);
rows.sort((x,y)=>x.src.localeCompare(y.src));
fs.writeFileSync(path.join(build,'atlas-set.json'),JSON.stringify({X,atlasCommits:[...atlas].length,rows,generated},null,1));
console.log('atlas commits',atlas.size,'of',log.length,'| sources touched by atlas',rows.length);
for(const r of rows)console.log(String(r.atlas).padStart(3),String(r.other).padStart(3),r.states.join(',').padEnd(8),r.src,r.other?' | others: '+r.others.slice(0,3).join(' ‖ '):'');
console.log('generated (no source):',generated.length,generated.filter(p=>/bundle|standalone|atlas-learning|collection|profile-core/.test(p)).slice(0,20).join(' '));
