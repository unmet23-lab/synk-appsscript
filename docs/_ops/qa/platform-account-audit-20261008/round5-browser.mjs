// Loopback-only QA: the real platform UI with synthetic config and in-memory storage.
// No production config, persisted login, member data, or generated output is read.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const account=path.join(root,'experiences/synk-account');
const origin='http://127.0.0.1:4328';
const {build}=createRequire(path.join(account,'package.json'))('esbuild');
const built=await build({stdin:{contents:`
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()};};
// A reused loopback browser tab must never contribute a persisted real session.
Object.defineProperty(window,'sessionStorage',{value:memory()});
Object.defineProperty(window,'localStorage',{value:memory()});
await import('./src/platform.mjs');
`,resolveDir:account,sourcefile:'round5-platform-fixture.mjs'},bundle:true,write:false,format:'esm',platform:'browser'});
const html=await fs.readFile(path.join(account,'platform.html'),'utf8');
const config={version:1,supabaseUrl:origin,accountApiUrl:origin,supabasePublishableKey:'sb_publishable_synthetic_round5',portalUrl:origin+'/synthetic-id',
  clients:{platform:{clientId:'synthetic-round5-platform',redirectUri:origin+'/client.html?product=platform'}}};

// Build an exact file map from the public asset directory, excluding symlinks.
// Request paths never become arbitrary filesystem paths.
const staticFiles=new Map([['/platform.css',path.join(account,'platform.css')],['/benefits.css',path.join(account,'benefits.css')],['/platform.webmanifest',path.join(account,'platform.webmanifest')]]);
const assetTypes=new Set(['.woff2','.ttf','.webp','.svg','.png','.jpg','.jpeg','.avif']);
async function addAssets(directory,prefix){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name),url=prefix+'/'+entry.name;
    if(entry.isDirectory())await addAssets(full,url);
    else if(entry.isFile()&&assetTypes.has(path.extname(entry.name).toLowerCase()))staticFiles.set(url,full);
  }
}
await addAssets(path.join(account,'assets'),'/assets');
const mime={'.css':'text/css; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.webmanifest':'application/manifest+json'};
let configReads=0;
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'");
  let url;try{url=new URL(req.url,origin);}catch{res.writeHead(400);res.end();return;}
  const send=(status,type,body)=>{res.writeHead(status,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);};
  if(req.method==='POST'&&url.pathname==='/__qa/reset'){configReads=0;send(200,'application/json',JSON.stringify({ok:true,configReads}));return;}
  if(!['GET','HEAD'].includes(req.method)){send(405,'text/plain','Method not allowed');return;}
  if(url.pathname==='/__qa/status'){send(200,'application/json',JSON.stringify({synthetic:true,configReads,pid:process.pid}));return;}
  if(url.pathname==='/'||url.pathname==='/platform.html'){send(200,'text/html; charset=utf-8',html);return;}
  if(url.pathname==='/dist/platform.js'){send(200,'text/javascript; charset=utf-8',built.outputFiles[0].text);return;}
  if(url.pathname==='/config.json'){
    const first=req.method==='HEAD'?configReads===0:++configReads===1;
    send(first?503:200,'application/json; charset=utf-8',JSON.stringify(first?{error:'synthetic_config_unavailable'}:config));return;
  }
  const file=staticFiles.get(url.pathname);
  if(!file){send(404,'text/plain; charset=utf-8','Not part of this synthetic QA server.');return;}
  try{send(200,mime[path.extname(file).toLowerCase()]||'application/octet-stream',await fs.readFile(file));}
  catch{send(404,'text/plain','Not found');}
});
server.listen(4328,'127.0.0.1',()=>console.log(JSON.stringify({url:origin+'/platform.html',pid:process.pid,synthetic:true,reset:'POST '+origin+'/__qa/reset'})));
