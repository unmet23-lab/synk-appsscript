import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

// Execute the real server's HTTP callback with a temporary static tree. API/database initialization is
// outside this test: the requests below only exercise module routing, file reads and traversal guards.
const source=fs.readFileSync(fileURLToPath(new URL('../server.mjs',import.meta.url)),'utf8');
const start=source.indexOf('const server=http.createServer('),end=source.indexOf('\nserver.listen(',start);
assert.ok(start>=0&&end>start,'actual HTTP handler boundaries');

test('WORLD serves the W5b and E10 browser modules and blocks other town source paths',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-town-static-')),town=path.join(directory,'town');fs.mkdirSync(town);
 const allowed=['day-app.mjs','day-cards.mjs','day-notebook.mjs','day-observation.mjs','walk-packets.mjs','day-language.mjs','dialogue.mjs','new-tea.mjs'];
 const denied=['day-unlisted.mjs','day-cards.mjs.extra','server.mjs','core.mjs'];
 for(const name of [...allowed,...denied])fs.writeFileSync(path.join(town,name),`export const fixture=${JSON.stringify(name)};\n`);
 const context={http,fs,path,URL,port:0,publicConfig:{basePath:'/'},home:directory,root:directory,town,brandOpening:directory,allowedGames:new Set(),mime:{'.mjs':'text/javascript; charset=utf-8'},json:(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}};
 const server=vm.runInNewContext(source.slice(start,end)+'\nserver',context);await new Promise(r=>server.listen(0,'127.0.0.1',r));context.port=server.address().port;
 t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 function request(route,method='GET'){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:context.port,path:route,method},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString(),type:res.headers['content-type']}));});req.on('error',reject);req.end();});}
 for(const name of allowed){const result=await request('/town/'+name);assert.equal(result.status,200,name);assert.equal(result.type,'text/javascript; charset=utf-8');assert.equal(result.body,fs.readFileSync(path.join(town,name),'utf8'));}
 for(const name of denied)assert.equal((await request('/town/'+name)).status,404,name);
 for(const route of ['/town/%2e%2e%2fday-cards.mjs','/town/%5cday-cards.mjs','/town/day-cards.mjs%00'])assert.equal((await request(route)).status,403,route);
 const head=await request('/town/day-cards.mjs','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');
 assert.equal((await request('/town/day-cards.mjs','POST')).status,405);
});
