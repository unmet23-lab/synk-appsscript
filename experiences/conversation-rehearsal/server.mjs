import { sharedAccountServer } from '../synk-account/server-shared.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BOOK_STYLES } from './book.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');
const assets = ['synk.svg','SUIT.woff2','InterTight.woff2','DMMono.ttf','teacher-cover.png','button.webp','button-soft.webp','chip.webp','wide-cream.webp','wide-lapis.webp'];
const files = new Map([
  ['/',path.join(root,'index.html')],
  ...['index.html','app.css','app.mjs','domain.mjs','storage.mjs','book.mjs'].map(name=>[`/${name}`,path.join(root,name)]),
  ['/member-book-assets.mjs',path.join(root,'../member-book-assets.mjs')],
  ['/core/ask.js',path.join(repo,'atlas/ask.js')],
  ...assets.map(name=>[`/assets/${name}`,path.join(repo,'desktop/assets/launcher',name)]),
]);
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf' };
export function createServer({accountConfigPath,accountConfig} = {}) {
  const shared=sharedAccountServer({configPath:accountConfigPath,config:accountConfig});
  return http.createServer(async(req,res)=>{
    await shared.ready;
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.setHeader('Content-Security-Policy',res.getHeader('Content-Security-Policy').replace("connect-src 'self'",`connect-src ${shared.connections()}`));
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{Allow:'GET, HEAD'});res.end();return; }
    let url;
    try { url=new URL(req.url,'http://127.0.0.1'); } catch { res.writeHead(400);res.end();return; }
    const common=await shared.read(url.pathname);if(common){res.writeHead(200,{'Content-Type':common.type});res.end(req.method==='HEAD'?undefined:common.body);return;}
    if(url.pathname==='/book.css'){res.writeHead(200,{'Content-Type':'text/css; charset=utf-8','Content-Length':Buffer.byteLength(BOOK_STYLES)});res.end(req.method==='HEAD'?undefined:BOOK_STYLES);return;}
    const file=files.get(url.pathname);
    if(!file) { res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':'찾을 수 없는 화면입니다.');return; }
    try { const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body); }
    catch { res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?'':'화면을 읽지 못했습니다. 로컬 파일을 확인해 주세요.'); }
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const server=createServer();
  server.on('error',error=>{console.error(`리허설 서버: ${error.message}`);process.exitCode=1;});
  server.listen(4297,'127.0.0.1',()=>console.log('SYNK 리허설 http://127.0.0.1:4297/'));
}
