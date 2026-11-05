// 서울행 글 표를 한국어 · 몽골어 두 칸으로 풀어 쓴다(Fable 교정 · 아르곤 채점 재료). 앱 쪽 글(seoul-entry.mjs TEXT)도 함께.
//   node experiences/seoul-arrival/qa/몽골어표.mjs [--언어 mn|en]   → .tmp/seoul-mn/표-<언어>.txt
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
globalThis.location??={search:''};
const {TEXT_TABLES}=await import('../strings.mjs');
const {UI,STORY,KO}=TEXT_TABLES;
const args=process.argv.slice(2),i=args.indexOf('--언어'),LANG=i<0?'mn':args[i+1];
const clean=s=>String(s).replace(/<br>/g,' / ').replace(/<\/?(?:b|em)>/g,'').replace(/\s+/g,' ').trim();
const lines=['# 화면 단추 · 안내(UI)'];
for(const [k,v] of Object.entries(UI[LANG]))lines.push(`${clean(KO[k]??k)}\t${clean(v)}`);
lines.push('','# 이야기 글(화면에는 한국어 줄 아래 작은 번역 줄로 나온다)');
for(const [k,v] of Object.entries(STORY[LANG]))lines.push(`${clean(k)}\t${clean(v)}`);
lines.push('','# 앱 쪽 글(로그인 안내 · 학생증 옮기기)');
const entry=fs.readFileSync(path.join(ROOT,'experiences/synk-world-app/seoul-entry.mjs'),'utf8');
for(const m of entry.matchAll(/\{ko:'([^']+)',en:'([^']*)',mn:'([^']+)'\}/g))lines.push(`${clean(m[1])}\t${clean(LANG==='en'?m[2]:m[3])}`);
const OUT=path.join(ROOT,'.tmp','seoul-mn');fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(path.join(OUT,`표-${LANG}.txt`),lines.join('\n')+'\n');
console.log(path.join(OUT,`표-${LANG}.txt`),lines.length);
