// 이해 시험용 받아쓰기(.srt)를 time.ts 자막표에서 만든다: npx tsx 자막만들기.mjs <main|yt|tt> > ../시험/말_<판>.srt
import { caps } from './src/y21/time.ts';
const cut = process.argv[2] || 'main';
const t = (s) => { const ms = Math.round(s * 1000); const h = String(Math.floor(ms / 3600000)).padStart(2, '0'); const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0'); const x = String(Math.floor(ms / 1000) % 60).padStart(2, '0'); return `${h}:${m}:${x},${String(ms % 1000).padStart(3, '0')}`; };
caps(cut).forEach(([a, b, text], i) => console.log(`${i + 1}\n${t(a)} --> ${t(b)}\n${text.replaceAll('**', '')}\n`));
