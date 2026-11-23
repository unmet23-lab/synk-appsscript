'use strict';
// 선택 공개 1단계 후보의 정적 import 검사(설계 주인 11-20 조건 ②): 후보 파일(new/world/…)이 라이브(또는 후보) 모듈에서
// 없는 이름을 정적으로 부르지 않는지, 공개 첫 화면들(world/*.html의 module 스크립트)에서 정적 import를 끝까지 따라가도
// 새 모듈 22개가 닿지 않는지, 새 모듈을 부르는 동적 import가 어디 있는지 본다. 라이브 바이트는 gh api로 받아 캐시한다.
//   node imports.cjs <후보 new 폴더> [<엔진 판 폴더 바깥(atlas/가 든 곳)>]
const {execFileSync}=require('node:child_process');const fs=require('node:fs'),path=require('node:path');
const acorn=require(require.resolve('acorn',{paths:['C:/Users/q1212/Documents/SYNK-appsscript/node_modules']}));
const CAND=path.resolve(process.argv[2]),ENGINE=process.argv[3]?path.resolve(process.argv[3]):null;
const env={...process.env,MSYS_NO_PATHCONV:'1'};
const cacheDir='D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs';fs.mkdirSync(cacheDir,{recursive:true});
const tree=JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'],{maxBuffer:1<<28,env}).toString('utf8'));
if(tree.truncated)throw Error('tree truncated');
const liveSha=new Map(tree.tree.filter(t=>t.type==='blob').map(t=>[t.path,t.sha]));
const NEW=new Set(['world-atlas-next.mjs','world-practice-next.mjs','world-today.mjs','world-position-next.mjs','world-diagnostic-next.mjs','world-mock-next.mjs','world-position-next-view.mjs','world-plan-next.mjs','world-lookback-next.mjs','world-me-next.mjs','world-month-answer.mjs','world-old-engine-doors.mjs','world-atlas-game.mjs',
 ...['blank-slice','entry-check','korean-racing','korean-rhythm','korean-runner','order-rush','snap-words','subway-rush','talk-rally'].map(g=>`${g}/kit/atlas-next.mjs`)].map(p=>'world/'+p));
// 사이트 경로(world/… · atlas/…) → 바이트: 후보가 먼저, 없으면 라이브.
function bytes(site){
 const c=path.join(CAND,site);if(fs.existsSync(c)&&fs.statSync(c).isFile())return {from:'후보',text:fs.readFileSync(c,'utf8')};
 if(ENGINE&&site.startsWith('atlas/')){const e=path.join(ENGINE,site);if(fs.existsSync(e))return {from:'엔진',text:fs.readFileSync(e,'utf8')};}
 const s=liveSha.get(site);if(!s)return null;const f=path.join(cacheDir,s);
 if(!fs.existsSync(f))fs.writeFileSync(f,Buffer.from(JSON.parse(execFileSync('gh',['api','repos/unmet23-lab/synk-policy/git/blobs/'+s],{maxBuffer:1<<28,env}).toString('utf8')).content,'base64'));
 return {from:'라이브',text:fs.readFileSync(f,'utf8')};
}
const resolve=(fromSite,spec)=>{
 if(!/^(\.{1,2}\/|\/)/.test(spec))return null; // 맨 이름(브라우저에서 안 됨) · https:// 는 따로
 const u=new URL(spec,'https://synk.im/'+fromSite);if(u.host!=='synk.im')return null;
 return decodeURIComponent(u.pathname).replace(/^\//,'');
};
const parsed=new Map();
function parse(site){
 if(parsed.has(site))return parsed.get(site);
 const b=bytes(site);let r=null;
 if(b){let ast;try{ast=acorn.parse(b.text,{ecmaVersion:'latest',sourceType:'module'});}catch(e){r={site,from:b.from,error:String(e.message)};parsed.set(site,r);return r;}
  const imports=[],exportsOwn=new Set(),stars=[],dynamic=[];
  const walk=n=>{if(!n||typeof n.type!=='string')return;
   if(n.type==='ImportExpression'){const s=n.source;dynamic.push(s.type==='Literal'?String(s.value):(s.type==='TemplateLiteral'&&s.expressions.length===0?s.quasis[0].value.cooked:'(식)'));}
   for(const k of Object.keys(n)){const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v.type==='string')walk(v);}};
  for(const st of ast.body){
   if(st.type==='ImportDeclaration'){imports.push({spec:st.source.value,names:st.specifiers.filter(s=>s.type==='ImportSpecifier').map(s=>s.imported.name??s.imported.value),def:st.specifiers.some(s=>s.type==='ImportDefaultSpecifier')});}
   else if(st.type==='ExportNamedDeclaration'){
    if(st.declaration){const d=st.declaration;if(d.declarations)for(const x of d.declarations){const ids=[];const grab=p=>{if(!p)return;if(p.type==='Identifier')ids.push(p.name);else if(p.type==='ObjectPattern')p.properties.forEach(q=>grab(q.value||q.argument));else if(p.type==='ArrayPattern')p.elements.forEach(grab);else if(p.type==='RestElement')grab(p.argument);else if(p.type==='AssignmentPattern')grab(p.left);};grab(x.id);ids.forEach(i=>exportsOwn.add(i));}else if(d.id)exportsOwn.add(d.id.name);}
    for(const s of st.specifiers||[])exportsOwn.add(s.exported.name??s.exported.value);
    if(st.source)imports.push({spec:st.source.value,names:(st.specifiers||[]).map(s=>s.local.name??s.local.value),def:false,reexport:true});
   }else if(st.type==='ExportDefaultDeclaration')exportsOwn.add('default');
   else if(st.type==='ExportAllDeclaration'){if(st.exported)exportsOwn.add(st.exported.name??st.exported.value);else stars.push(st.source.value);imports.push({spec:st.source.value,names:[],def:false,reexport:true});}
  }
  walk(ast);
  r={site,from:b.from,imports,exportsOwn,stars,dynamic};
 }
 parsed.set(site,r);return r;
}
function exportsOf(site,seen=new Set()){
 if(seen.has(site))return new Set();seen.add(site);const m=parse(site);if(!m||m.error)return null;
 const all=new Set(m.exportsOwn);for(const s of m.stars){const t=resolve(site,s);const e=t&&exportsOf(t,seen);if(e)for(const n of e)if(n!=='default')all.add(n);}
 return all;
}
const walkDir=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walkDir(path.join(dir,e.name)):[path.join(dir,e.name)]);
const candSites=walkDir(CAND).map(f=>path.relative(CAND,f).replace(/\\/g,'/')).filter(s=>/\.(mjs|js)$/.test(s));
const problems=[],dyn=[];
for(const site of candSites){
 const m=parse(site);if(!m)continue;if(m.error){problems.push(`${site}: 못 읽음 ${m.error}`);continue;}
 for(const im of m.imports){
  const t=resolve(site,im.spec);if(!t){if(!/^https:/.test(im.spec))problems.push(`${site}: 풀 수 없는 정적 import ${im.spec}`);continue;}
  const tm=parse(t);if(!tm){problems.push(`${site}: ${im.spec} → ${t} 가 후보에도 라이브에도 없다`);continue;}
  const ex=exportsOf(t);if(!ex){problems.push(`${site}: ${t} 못 읽음`);continue;}
  for(const n of im.names)if(!ex.has(n))problems.push(`${site}: ${t}(${tm.from})에 없는 이름 ${n}`);
  if(im.def&&!ex.has('default'))problems.push(`${site}: ${t}(${tm.from})에 default가 없다`);
 }
 for(const d of m.dynamic){const t=resolve(site,d);if(t&&NEW.has(t))dyn.push(`${site} → ${t}`);else if(d==='(식)'||/atlas\//.test(d))dyn.push(`${site} → ${d}${t?' ('+t+')':''}`);}
}
// 첫 화면들에서 정적 import를 끝까지 — 새 모듈에 닿으면 안 된다.
const htmls=[...new Set([...liveSha.keys()].filter(p=>/^world\/[^/]+\.html$/.test(p)).concat(candSites.filter(s=>/^world\/[^/]+\.html$/.test(s))))];
const reach=new Map();
for(const h of htmls){
 const b=bytes(h);if(!b)continue;
 const entries=[...b.text.matchAll(/<script[^>]*type=["']module["'][^>]*src=["']([^"'?#]+)/g)].map(x=>resolve(h,x[1])).filter(Boolean);
 const inline=[...b.text.matchAll(/<script[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
 for(const x of inline.matchAll(/(?:import|from)\s*['"]([^'"?#]+)/g)){const t=resolve(h,x[1]);if(t)entries.push(t);}
 const seen=new Set(),stack=[...entries];
 while(stack.length){const s=stack.pop();if(seen.has(s))continue;seen.add(s);const m=parse(s);if(!m||m.error)continue;for(const im of m.imports){const t=resolve(s,im.spec);if(t)stack.push(t);}}
 reach.set(h,seen);
}
let newReached=0;
for(const [h,seen] of reach){const hit=[...seen].filter(s=>NEW.has(s)||s.startsWith('atlas/'));newReached+=hit.length;console.log(`${h}: 정적 import ${seen.size}개 · 새 모듈 · /atlas/ ${hit.length}${hit.length?' — '+hit.join(' '):''}`);}
console.log('\n이름 엇갈림 · 못 찾음',problems.length);for(const p of problems)console.log('  ',p);
console.log('\n새 모듈 · /atlas/ · 식을 부르는 동적 import',dyn.length);for(const d of dyn)console.log('  ',d);
fs.writeFileSync(path.join(path.dirname(CAND),'imports.json'),JSON.stringify({problems,dyn,reach:Object.fromEntries([...reach].map(([h,s])=>[h,[...s].sort()]))},null,1));
process.exitCode=problems.length||newReached?1:0;
