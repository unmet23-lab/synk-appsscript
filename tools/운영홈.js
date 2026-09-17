#!/usr/bin/env node
'use strict';
// A local, read-only view of existing sources. No model calls and no business-state database.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const {panels,documents} = require('./operations-home/sources');
const {readClaude,companyRoots} = require('./operations-home/native-status');
const UI = path.join(__dirname,'operations-home');
const DEFAULT_ROOT = path.resolve(__dirname,'..');
const clean = text => text.replace(/<!--[^]*?-->/g,'').replace(/^---\r?\n[^]*?\r?\n---\r?\n/,'');
function section(text,heading) {
  if (!heading) return clean(text);
  const lines=clean(text).split(/\r?\n/); let start=-1,level=0,fence=null;const headings=[];
  for(let i=0;i<lines.length;i++){const f=/^\s*(`{3,}|~{3,})/.exec(lines[i]);if(f){if(!fence)fence=f[1];else if(f[1][0]===fence[0]&&f[1].length>=fence.length)fence=null;continue;}if(fence)continue;const m=/^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);if(m)headings.push({i,level:m[1].length,title:m[2]});}
  for(const h of headings){if(h.title===heading){start=h.i;level=h.level;break;}}
  if(start<0) throw new Error('원문에서 지정한 절을 찾지 못했습니다');
  let end=lines.length;
  for(const h of headings){if(h.i>start&&h.level<=level){end=h.i;break;}}
  return lines.slice(start,end).join('\n');
}
function inside(root,file){
  const base=fs.realpathSync(root), absolute=fs.realpathSync(path.resolve(root,file));
  const rel=path.relative(base,absolute);
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw new Error('허용한 원문 밖입니다');
  return absolute;
}
function readDocument(root,definition){
  try {
    const file=inside(root,definition.file), stat=fs.statSync(file);
    if(!stat.isFile()||stat.size>3_000_000)throw new Error('문서 크기를 확인해야 합니다');
    const raw=fs.readFileSync(file,'utf8');
    return {...definition,content:section(raw,definition.section),modifiedAt:stat.mtime.toISOString(),revision:crypto.createHash('sha256').update(raw).digest('hex').slice(0,16),available:true};
  }catch(error){return {...definition,content:'',available:false,error: error.code==='ENOENT'?'원문 파일을 찾지 못했습니다':error.message};}
}
function trackItems(text){
  let heading='',context=''; const result=[];
  for(const line of text.split(/\r?\n/)){
    const h=/^##\s+(.+)/.exec(line);if(h){heading=h[1];context='';}
    if(line.startsWith('원문:'))context=line;
    const m=/^-\s+\[([^\]]+)\]\s+(.+)/.exec(line);
    if(m&&!/완료/.test(m[1]))result.push({owner:m[1],text:m[2],heading,context,panelIds:panels.filter(p=>new RegExp(p.match,'i').test(heading+' '+m[2])).map(p=>p.id)});
  } return result;
}
function cacheDirectory(root){return path.join(os.tmpdir(),'synk-operations-home',crypto.createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,12));}
function saveRuntime(root,payload){
  if(!payload||!Number.isFinite(Date.parse(payload.checkedAt))||!Array.isArray(payload.tasks))throw new Error('상태 조회 형식 오류');
  const now=Date.now(); if(Date.parse(payload.checkedAt)>now+60_000)throw new Error('미래 확인 시각');
  const allowed=new Set(['active','running','idle','response_complete','error','needs_attention','interrupted','unknown']);
  const key=p=>{try{return fs.realpathSync(p).toLowerCase();}catch{return null;}};
  const roots=new Set(companyRoots(root).map(key).filter(Boolean));
  const tasks=payload.tasks.slice(0,100).filter(t=>t&&typeof t.cwd==='string'&&key(t.cwd)&&roots.has(key(t.cwd))).map(t=>({id:String(t.id||'').slice(0,100),title:String(t.title||'제목 없는 작업').slice(0,180),cwd:t.cwd,status:allowed.has(t.status)?t.status:'unknown',source:'Codex',sourceStatus:typeof t.sourceStatus==='string'?t.sourceStatus.slice(0,80):undefined}));
  const out={checkedAt:payload.checkedAt,source:'Codex 공식 작업 조회',coverage:'최근 50개와 고정 작업 · 운영 홈 조회 작업 제외',limit:50,tasks};
  const dir=cacheDirectory(root);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'runtime.json');
  fs.writeFileSync(file+'.tmp',JSON.stringify(out));fs.renameSync(file+'.tmp',file);return out;
}
function runtime(root){
  try{const data=JSON.parse(fs.readFileSync(path.join(cacheDirectory(root),'runtime.json'),'utf8'));return {...data,connected:true,stale:!Number.isFinite(Date.parse(data.checkedAt))||Date.now()-Date.parse(data.checkedAt)>45*60_000};}
  catch{return {connected:false,stale:true,tasks:[],checkedAt:null,source:'Codex 공식 작업 조회'};}
}
function assets(root){
  const items=[{id:'suit',file:'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2'},{id:'inter',file:'docs/브랜드_폰트/InterTight/InterTight-Regular.ttf'},{id:'inter-bold',file:'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf'},{id:'mono',file:'docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf'},{id:'tokens',file:'docs/tools/synk-tokens.css'}];
  try{
    const token=JSON.parse(fs.readFileSync(inside(root,'docs/디자인_토큰.json'),'utf8'));
    const folder=path.posix.dirname(token['재질']['펠트']['정본사진']['평상복']);
    for(const [id,name] of [['mongle','몽글'],['kkamong','까몽'],['marin','마린']])items.push({id,name,file:folder+'/'+name+'_본체.png'});
  }catch{}
  for(const name of ['SYNK','SYNK-LAB','SYNK-SHIFT','SYNK-PULSE'])items.push({id:name.toLowerCase()+'-logo',file:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/'+name+'-Ink.png'});
  return items;
}
function state(root){
  const docs=documents.map(d=>readDocument(root,d));const byId=new Map(docs.map(d=>[d.id,d]));
  const track=byId.get('track'),pending=trackItems(track.content);
  const revisions=docs.map(d=>d.id+':'+(d.revision||'missing')).join('|');
  return {name:'SYNK 운영 홈',readAt:new Date().toISOString(),revision:crypto.createHash('sha256').update(revisions).digest('hex').slice(0,16),panels:panels.map(p=>({...p,sources:p.sources.map(s=>{const d=byId.get(s.id);return {id:d.id,title:d.title,file:d.file,section:d.section,available:d.available,modifiedAt:d.modifiedAt,revision:d.revision,error:d.error};}),pending:pending.filter(t=>t.panelIds.includes(p.id))})),documents:docs.map(({content,...d})=>d),pending,trackModifiedAt:track.modifiedAt,runtime:runtime(root),assets:assets(root).filter(a=>{try{return fs.statSync(inside(root,a.file)).isFile();}catch{return false;}}).map(a=>({id:a.id,name:a.name,url:'/asset/'+a.id,original:'/asset/'+a.id+'?original=1'}))};
}
let sharp;try{sharp=require('sharp');}catch{try{sharp=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));}catch{}}
const imageCache=new Map();
function createServer({root=DEFAULT_ROOT,port=8790}={}){
  const staticFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/vendor/marked.mjs':'vendor/marked.mjs'};
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
  return http.createServer(async(req,res)=>{
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
    const send=(code,body,type='application/json; charset=utf-8')=>{res.writeHead(code,{...headers,'content-type':type});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
    if(!/^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host||'')&&!/^localhost(?::\d+)?$/.test(req.headers.host||''))return send(403,{error:'로컬에서만 볼 수 있습니다'});
    if(req.method!=='GET')return send(405,{error:'읽기 전용입니다'});
    if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return send(403,{error:'외부 요청은 받지 않습니다'});
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/api/health')return send(200,{name:'SYNK 운영 홈',root,version:1});
      if(url.pathname==='/api/state'){const output=state(root);output.otherRuntimes=[await readClaude(root)];return send(200,output);}
      if(url.pathname==='/api/search'){
        const q=(url.searchParams.get('q')||'').slice(0,150).trim().toLowerCase();if(q.length<1)return send(200,[]);
        const seen=new Set(),result=[];for(const def of documents){if(seen.has(def.file))continue;seen.add(def.file);const d=readDocument(root,{...def,section:undefined});const at=d.content.toLowerCase().indexOf(q);if(at>=0)result.push({id:d.id,title:d.title,file:d.file,snippet:d.content.slice(Math.max(0,at-70),at+180).replace(/[#*>`]/g,'').replace(/\s+/g,' ')});}return send(200,result);
      }
      if(url.pathname==='/api/document'){
        const id=url.searchParams.get('id');const def=documents.find(d=>d.id===id);
        if(!def)return send(404,{error:'연결된 원문이 아닙니다'});
        const d=readDocument(root,url.searchParams.get('full')==='1'?{...def,section:undefined}:def);return send(d.available?200:503,d);
      }
      if(url.pathname.startsWith('/asset/')){
        const id=decodeURIComponent(url.pathname.slice(7)),a=assets(root).find(a=>a.id===id);if(!a)return send(404,{error:'등록되지 않은 자산'});
        const file=inside(root,a.file),stat=fs.statSync(file),ext=path.extname(file);
        if(ext==='.png'&&sharp&&!url.searchParams.has('original')){
          const key=file+':'+stat.mtimeMs+':'+stat.size;
          if(!imageCache.has(key)){if(imageCache.size>24)imageCache.clear();imageCache.set(key,await sharp(file).resize({width:900,withoutEnlargement:true}).webp({quality:88}).toBuffer());}
          return send(200,imageCache.get(key),'image/webp');
        }
        return send(200,fs.readFileSync(file),types[ext]||'application/octet-stream');
      }
      if(staticFiles[url.pathname])return send(200,fs.readFileSync(path.join(UI,staticFiles[url.pathname])),types[path.extname(staticFiles[url.pathname])]);
      return send(404,{error:'페이지를 찾지 못했습니다'});
    }catch(error){return send(503,{error:'자료를 읽지 못했습니다. 원문 경로와 서버 연결을 확인하세요.'});}
  });
}
if(require.main===module){
  const args=process.argv.slice(2),value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:null;
  const root=path.resolve(value('--root')||DEFAULT_ROOT),port=Number(value('--port')||8790);
  if(args.includes('--record-runtime')){let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>100000)process.exit(2);});process.stdin.on('end',()=>{try{const r=saveRuntime(root,JSON.parse(input));console.log('작업 상태 '+r.tasks.length+'개 갱신');}catch(e){console.error(e.message);process.exitCode=1;}});}
  else if(args.includes('--check')){const s=state(root);console.log(JSON.stringify({panels:s.panels.length,documents:s.documents.length,unavailable:s.documents.filter(d=>!d.available),assets:s.assets.map(a=>a.id),pending:s.pending.length},null,2));}
  else{const server=createServer({root,port});server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'운영 홈 포트가 이미 사용 중입니다':e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('SYNK 운영 홈 http://127.0.0.1:'+port));}
}
module.exports={section,inside,readDocument,trackItems,state,createServer,saveRuntime,runtime,cacheDirectory};
