import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)),repo=path.resolve(root,'../..');
const publicFiles=new Set(['index.html','style.css','app.mjs','model.mjs']);
const assets=new Set(['synk.svg','SUIT.woff2','InterTight.ttf','InterTightBold.ttf','DMMono.ttf','button-soft.webp','badge-cream.webp','wide-lapis.webp','shift-cover.png']);
const atlas=new Set(['engine.js','domain.js','temper-outcomes.js','personalization.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.webp':'image/webp','.png':'image/png'};
export function createServer(){
  const server=http.createServer(async(req,res)=>{
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(req.method==='HEAD'?undefined:JSON.stringify(value));};
    for(const [k,v] of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}))res.setHeader(k,v);
    try{
      const host=`127.0.0.1:${server.address().port}`;
      if(req.headers.host!==host||(req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers['sec-fetch-site']==='cross-site')return json(403,{ok:false,error:'LOCAL_ONLY'});
      if(!['GET','HEAD'].includes(req.method))return json(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
      const url=new URL(req.url,`http://${host}`);
      if(url.pathname==='/api/health')return json(200,{ok:true,service:'synk-shift-workbench',mode:'local-mvp',productionConnected:false,aiConnected:false});
      const file=decodeURIComponent(url.pathname).slice(1)||'index.html';let target;
      if(publicFiles.has(file))target=path.join(root,file);
      else if(file.startsWith('assets/')&&assets.has(file.slice(7)))target=path.join(root,file);
      else if(file.startsWith('atlas/')&&atlas.has(file.slice(6)))target=path.join(repo,file);
      else return json(404,{ok:false,error:'NOT_FOUND'});
      const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    }catch(e){json(e instanceof URIError?400:500,{ok:false,error:e instanceof URIError?'INVALID_URL':'SERVER_ERROR'});}
  });return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const index=process.argv.indexOf('--port'),port=Number(index>=0?process.argv[index+1]:4293);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid --port');
  createServer().listen(port,'127.0.0.1',()=>console.log(`SYNK SHIFT · local MVP · http://127.0.0.1:${port}/`));
}
