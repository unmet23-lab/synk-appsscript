// 학습일 답 열쇠(synk:world:month-answer: · synk:world:first-answers:)가 라이브 synk.im의 다른 저장 열쇠와 겹치지 않는지 본다.
// synk.im 쪽은 모두 한 출처라 localStorage를 함께 쓴다 — 공개 저장소 main의 글 파일 전부에서 두 머리와, 그 머리로 시작할 수 있는 열쇠 짓기를 찾는다.
const {execFileSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path');
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const head=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/commits/main'],{maxBuffer:1<<26,env}).toString()).sha;
const tree=JSON.parse(execFileSync('gh',['api',`repos/unmet23-lab/synk-policy/git/trees/${head}?recursive=1`],{maxBuffer:1<<28,env}).toString());
const text=tree.tree.filter(t=>t.type==='blob'&&/\.(m?js|html|json)$/.test(t.path)&&t.size<4e6);
const cache='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs';
const get=t=>{const f=path.join(cache,t.sha);if(!fs.existsSync(f))fs.writeFileSync(f,Buffer.from(JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/blobs/'+t.sha],{maxBuffer:1<<28,env}).toString()).content,'base64'));return fs.readFileSync(f,'utf8');};
const hits=[],near=[];
for(const t of text){const s=get(t);
 for(const m of s.matchAll(/synk:world:(?:month-answer|first-answers)/g))hits.push(`${t.path}:${s.slice(0,m.index).split('\n').length}`);
 // 같은 머리를 지을 수 있는 열쇠 조각(synk:world: 로 시작하는 문자열)
 for(const m of s.matchAll(/['"`](synk:world:[a-z0-9-]*)/g))near.push(`${m[1]} ← ${t.path}`);
}
console.log('라이브',head.slice(0,9),'· 글 파일',text.length);
console.log('두 머리를 쓰는 곳',hits.length,hits.slice(0,10).join(' '));
const uniq=[...new Set(near)];console.log('synk:world: 로 시작하는 열쇠 조각',uniq.length);for(const u of uniq.slice(0,40))console.log('  ',u);
