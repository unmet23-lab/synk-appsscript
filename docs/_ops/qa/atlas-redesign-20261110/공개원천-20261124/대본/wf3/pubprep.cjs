// 공개 미리 보기 입력: pub/(올릴 판 — world/ 후보 36개 + atlas/ 엔진 판 폴더 · 입구 · 지도), pubbase/(기준 — 공용 파일 14개의 지금 라이브 바이트),
// items.txt(공개 경로 목록). 엔진 판 폴더는 manifest의 files · entry · map 칸과 sha256이 맞는지 다시 본다.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const {execFileSync}=require('node:child_process');
const C='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1',REL='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/atlas-release';
const cache='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs';
const PUB=path.join(C,'pub'),BASE=path.join(C,'pubbase');fs.rmSync(PUB,{recursive:true,force:true});fs.rmSync(BASE,{recursive:true,force:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const put=(root,rel,bytes)=>{const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,bytes);};
const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'],{maxBuffer:1<<28}).toString());
const live=new Map(tree.tree.filter(t=>t.type==='blob').map(t=>[t.path,t.sha]));
const report=JSON.parse(fs.readFileSync(path.join(C,'report.json'),'utf8'));
const items=[];
for(const f of report.files){
 const rel='world/'+f.p;let bytes=fs.readFileSync(path.join(C,'new',rel));
 if(f.kind==='merged'){
  const L=fs.readFileSync(path.join(cache,live.get(rel)));put(BASE,rel,L);
  const crlf=/\r\n/.test(L.toString('latin1'));if(crlf)bytes=Buffer.from(bytes.toString('utf8').replace(/\r?\n/g,'\r\n'),'utf8');
 }else if(live.has(rel))throw Error('새 파일이 라이브에 있다 '+rel);
 put(PUB,rel,bytes);items.push(rel);
}
const m=JSON.parse(fs.readFileSync(path.join(REL,'atlas/0.1.0/manifest.json'),'utf8'));
const check=(rel,info)=>{const b=fs.readFileSync(path.join(REL,rel));if(sha(b)!==info.sha256)throw Error('sha 다름 '+rel);if(live.has(rel))throw Error('라이브에 이미 있다 '+rel);put(PUB,rel,b);items.push(rel);};
for(const [n,info] of Object.entries(m.files))check('atlas/0.1.0/'+n,info);
for(const [n,info] of Object.entries(m.entry))check('atlas/'+n,info);
// 지도(map/)는 2단계에 올린다(11-20 — 켜진 길만 받고, 켜기는 2단계 뒤다). MAP=1이면 넣는다.
const withMap=process.env.MAP==='1';
if(withMap)for(const [n,info] of Object.entries(m.map.files))check('atlas/0.1.0/map/'+n,info);
{const rel='atlas/0.1.0/manifest.json';if(live.has(rel))throw Error('manifest 라이브');put(PUB,rel,fs.readFileSync(path.join(REL,rel)));items.push(rel);}
// 나무에 manifest가 모르는 파일이 없나
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const inRel=walk(path.join(REL,'atlas')).map(f=>path.relative(REL,f).split(path.sep).join('/')).filter(r=>withMap||!r.startsWith('atlas/0.1.0/map/'));const extra=inRel.filter(r=>!items.includes(r));if(extra.length)throw Error('manifest 밖 파일 '+extra.join(' '));
fs.writeFileSync(path.join(C,'items.txt'),items.join('\n')+'\n');
console.log('pub',items.length,'(world',items.filter(i=>i.startsWith('world/')).length,'· atlas',items.filter(i=>i.startsWith('atlas/')).length,') · base',report.files.filter(f=>f.kind==='merged').length);
