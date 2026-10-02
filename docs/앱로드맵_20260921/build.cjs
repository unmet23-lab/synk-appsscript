'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8').replace(/^\uFEFF/,''));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const assetRecords=[];
function asset(p,mime){const abs=path.isAbsolute(p)?p:path.join(root,p),b=fs.readFileSync(abs);assetRecords.push({path:abs.replace(/\\/g,'/'),bytes:b.length,sha256:sha(b)});return `data:${mime};base64,${b.toString('base64')}`;}
const editorial=json('data-editorial.json');
const chapters=[...json('data-platform.json'),...json('data-learning.json'),...json('data-village.json'),...editorial.chapters].sort((a,b)=>Number(a.number)-Number(b.number));
const expected=['start','daily','path','games','personal','home','scenery','life','neighbors','village','controls','global'];
if(JSON.stringify(chapters.map(c=>c.id))!==JSON.stringify(expected))throw Error('Twelve ordered chapters required');
const featureIds=new Set();
for(const c of chapters){
 for(const k of ['kicker','title','lead','statusNote'])if(typeof c[k]!=='string'||!c[k])throw Error(`${c.id}: ${k}`);
 for(const f of c.features){
  if(!/^[a-z0-9-]+$/.test(f.id)||featureIds.has(f.id))throw Error(`Feature id: ${f.id}`);featureIds.add(f.id);
  if(!['connected','prototype','planned'].includes(f.status)||f.details.length!==3)throw Error(`${f.id}: status/details`);
  for(const k of ['title','benefit','statusLabel','current','next'])if(typeof f[k]!=='string'||!f[k])throw Error(`${f.id}: ${k}`);
 }
}
const data={...editorial,chapters};
const sources=[...data.sources,...chapters.flatMap(c=>c.sources)];
for(const s of sources)if(!fs.existsSync(s.path))throw Error(`Missing source: ${s.path}`);
const tokens=JSON.parse(read('docs/디자인_토큰.json'));
const color=name=>{const c=tokens.색.킷.find(c=>c.이름===name);if(!c)throw Error(name);return c.hex;};
const font=(family,p,format,weight)=>`@font-face{font-family:'${family}';src:url('${asset('docs/브랜드_폰트/'+p,format==='woff2'?'font/woff2':'font/ttf')}') format('${format}');font-style:normal;font-weight:${weight};font-display:swap}`;
const rep={
 FONTS:[font('SUIT','SUIT/SUIT-Variable.woff2','woff2','100 900'),font('Inter Tight','InterTight/InterTight-Medium.ttf','truetype','400 500'),font('Inter Tight','InterTight/InterTight-Bold.ttf','truetype','600 900'),font('DM Mono','DM_Mono/DMMono-Medium.ttf','truetype','400 700')].join('\n'),
 BLUE:color('Lapis Deep'),GREEN:color('Meadow Deep'),CORAL:color('Coral 3'),
 LOGO:asset('docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Ink.png','image/png'),
 FUTURE:asset('experiences/dokkaebi-express/art-direction/future-korea-20260919/namsan-2226-concept-v1.png','image/png'),
 STITCH:asset('docs/Loom_자산/누끼/공방_실땀한땀라피스.webp','image/webp'),
 MONGLE:asset('C:/Users/q1212/Documents/SYNK-talk/assets/마스코트/몽글_눈웃음.webp','image/webp'),
 KKAMONG:asset('C:/Users/q1212/Documents/SYNK-talk/assets/마스코트/까몽_본체.webp','image/webp'),
 MARIN:asset('C:/Users/q1212/Documents/SYNK-talk/assets/마스코트/마린_본체.webp','image/webp'),
 LETTER:asset('C:/Users/q1212/Documents/SYNK-talk/assets/장면/편지작업실.webp','image/webp'),
 DATA:JSON.stringify(data).replace(/</g,'\\u003c')
};
const logo=assetRecords.find(x=>x.path.endsWith('/SYNK-Ink.png'));
if(logo.sha256!=='645a8ce5ca3f9c8b71b07a05a7436f4e5fcd59fcd6d7d4b6efb761b017d6a4fc')throw Error('Review changed logo before rebuilding');
let html=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
for(const [key,val] of Object.entries(rep)){const token=`__${key}__`;if(!html.includes(token))throw Error(`Missing ${token}`);html=html.replaceAll(token,val);}
if(/__(?:FONTS|DATA|FUTURE|LOGO|MONGLE|KKAMONG|MARIN|LETTER|STITCH|BLUE|GREEN|CORAL)__/.test(html))throw Error('Unresolved template');
const output=path.join(__dirname,'SYNK_WORLD_앱로드맵_20260921.html');fs.writeFileSync(output,html);fs.writeFileSync(path.join(__dirname,'data.json'),JSON.stringify(data,null,2)+'\n');
const manifest={date:'2026-09-21',file:path.basename(output),bytes:Buffer.byteLength(html),sha256:sha(html),chapters:chapters.length,features:featureIds.size,sources:sources.length,assets:assetRecords,offline:true,productDeployment:false};
fs.writeFileSync(path.join(__dirname,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,bytes:manifest.bytes,sha256:manifest.sha256,chapters:manifest.chapters,features:manifest.features,sources:manifest.sources}));
