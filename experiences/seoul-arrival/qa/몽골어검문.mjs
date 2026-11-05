// 서울행 몽골어 문안 검문: 글 표를 12줄씩 묶어 tools/몽골어대조.js에 넘긴다(큰 묶음은 문장 지적을 놓친다 — 현장 노트 AI_CLI).
//   node experiences/seoul-arrival/qa/몽골어검문.mjs [--부터 0] [--구독]   → .tmp/seoul-mn/결과.jsonl
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
globalThis.location??={search:''};
const {TEXT_TABLES,L}=await import('../strings.mjs');
const {UI,STORY,KO}=TEXT_TABLES;
const args=process.argv.slice(2),opt=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const clean=s=>String(s).replace(/<br>/g,' ').replace(/<\/?(?:b|em)>/g,'').replace(/\s+/g,' ').trim();
const rows=[];
for(const [k,v] of Object.entries(UI.mn))rows.push([clean(KO[k]??k),clean(v)]);
for(const [k,v] of Object.entries(STORY.mn))rows.push([clean(k),clean(v)]);
// 앱 쪽 글(seoul-entry.mjs TEXT)
const entry=fs.readFileSync(path.join(ROOT,'experiences/synk-world-app/seoul-entry.mjs'),'utf8');
for(const m of entry.matchAll(/\{ko:'([^']+)',en:'[^']*',mn:'([^']+)'\}/g))rows.push([clean(m[1]),clean(m[2])]);
const seen=new Set(),uniq=rows.filter(([,mn])=>{if(!/[А-Яа-яӨөҮү]/.test(mn)||seen.has(mn))return false;seen.add(mn);return true;});
const OUT=path.join(ROOT,'.tmp','seoul-mn');fs.mkdirSync(OUT,{recursive:true});
const SIZE=12,from=Number(opt('--부터','0'));
const results=path.join(OUT,'결과.jsonl');
console.log('줄',uniq.length,'묶음',Math.ceil(uniq.length/SIZE));
for(let i=from;i*SIZE<uniq.length;i++){
 const part=uniq.slice(i*SIZE,(i+1)*SIZE),file=path.join(OUT,`묶음${String(i).padStart(2,'0')}.txt`);
 fs.writeFileSync(file,part.map(r=>r[0]).join('\n')+'\n---\n'+part.map(r=>r[1]).join('\n')+'\n');
 const r=spawnSync(process.execPath,[path.join(ROOT,'tools/몽골어대조.js'),'--파일',file,...(args.includes('--구독')?['--구독']:[])],{encoding:'utf8',env:{...process.env,SYNK_장부올리기:'나중'},timeout:300000});
 fs.appendFileSync(results,JSON.stringify({i,code:r.status,out:(r.stdout||'').slice(-6000),err:(r.stderr||'').slice(-800)})+'\n');
 console.log('묶음',i,'종료',r.status);
}
