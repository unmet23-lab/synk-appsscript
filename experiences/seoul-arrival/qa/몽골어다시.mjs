// 고친 몽골어 줄만 다시 문법 채점한다(세 겹의 마지막: tools/몽골어대조.js --구독). 고친 조각 목록은 .tmp/seoul-mn/고친조각.json.
// 긴 줄 구조상 앞뒤 문맥이 필요한 조각(문장을 두 화면에 나눈 줄)은 이 검사의 지적에서 사람이 거른다.
//   node experiences/seoul-arrival/qa/몽골어다시.mjs   → .tmp/seoul-mn/다시.jsonl
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const OUT=path.join(ROOT,'.tmp','seoul-mn');
const parts=JSON.parse(fs.readFileSync(path.join(OUT,'고친조각.json'),'utf8'));
const table=fs.readFileSync(path.join(OUT,'표-mn.txt'),'utf8').split('\n').filter(l=>l.includes('\t')).map(l=>l.split('\t'));
const rows=table.filter(([,mn])=>parts.some(p=>mn.includes(p)));
console.log('고친 줄',rows.length,'/ 조각',parts.length);
const SIZE=12,results=path.join(OUT,'다시.jsonl'),args=process.argv.slice(2),from=args.includes('--부터')?Number(args[args.indexOf('--부터')+1]):0;
if(!from)fs.rmSync(results,{force:true});
for(let i=from;i*SIZE<rows.length;i++){
 const part=rows.slice(i*SIZE,(i+1)*SIZE),file=path.join(OUT,`다시${String(i).padStart(2,'0')}.txt`);
 fs.writeFileSync(file,part.map(r=>r[0]).join('\n')+'\n---\n'+part.map(r=>r[1]).join('\n')+'\n');
 const r=spawnSync(process.execPath,[path.join(ROOT,'tools/몽골어대조.js'),'--파일',file,'--구독'],{encoding:'utf8',env:{...process.env,SYNK_장부올리기:'나중'},maxBuffer:1<<26});
 const o=r.stdout||'';const g=o.match(/■ 문법[^\n]*\n\s*판정:\s*((?:.|\n)*?)\n\n■/);const s=o.match(/■ 맞춤법[^\n]*\n((?:[^\n■]+\n)+)/);
 fs.appendFileSync(results,JSON.stringify({i,code:r.status,문법:g?.[1]||null,맞춤법:s?.[1]||null,out:o.slice(-5000),err:(r.stderr||'').slice(-800)})+'\n');
 if(r.status===1)console.log('  오류',(r.stderr||'').slice(-400));
 console.log('묶음',i,'·',(g?.[1]||'(못 읽음)').slice(0,300).replace(/\n/g,' '),'·',(s?.[1]||'').replace(/\n/g,' / ').slice(0,200));
}
