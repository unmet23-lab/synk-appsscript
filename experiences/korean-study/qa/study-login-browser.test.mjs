import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';
import {ACCOUNT,configFor} from './semantic-fixture.mjs';
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright');}catch{pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
test('등록 콜백에서 공부 세션으로 돌아오며 WORLD 작업공간 API를 열지 않는다', {timeout:60000},async()=>{
 const requests=[];const server=http.createServer(async(req,res)=>{
  const base='http://127.0.0.1:'+server.address().port,u=new URL(req.url,base);requests.push(u.pathname);
  if(u.pathname==='/account/config.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify(configFor(base)));return;}
  if(u.pathname==='/auth/v1/oauth/token'){let body='';for await(const c of req)body+=c;assert.ok(body.includes('authorization_code'));res.setHeader('content-type','application/json');res.end(JSON.stringify({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600}));return;}
  if(u.pathname==='/study/'){res.setHeader('content-type','text/html');res.end('<h1>study-return-fixture</h1>');return;}
  const rel=u.pathname.startsWith('/account/')?'experiences/synk-account/'+u.pathname.slice(9):u.pathname==='/learning-hub/atlas-learning.js'?'experiences/learning-hub/atlas-learning.js':null;
  if(!rel||rel.includes('..')||!fs.existsSync(rel)){res.writeHead(404).end();return;}res.setHeader('content-type',path.extname(rel)==='.js'?'text/javascript':path.extname(rel)==='.css'?'text/css':path.extname(rel)==='.html'?'text/html':'application/octet-stream');res.end(fs.readFileSync(rel));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await pw.chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(({base})=>{if(sessionStorage.getItem('fixture-started'))return;sessionStorage.setItem('fixture-started','1');const p={state:'a'.repeat(43),verifier:'b'.repeat(43),product:'world',createdAt:Date.now(),clientId:'world-fixture',redirectUri:base+'/account/client.html?product=world'};sessionStorage.setItem('synk.oauth.pending.world',JSON.stringify(p));sessionStorage.setItem('synk.study.login.intent',JSON.stringify({v:1,state:p.state,createdAt:p.createdAt,clientId:p.clientId,redirectUri:p.redirectUri}));sessionStorage.setItem('synk.oauth.session.world','original-world');},{base});
  await page.goto(base+'/account/client.html?product=world&code=synthetic-code&state='+'a'.repeat(43));await page.waitForURL(base+'/study/');
  const stored=await page.evaluate(()=>({study:JSON.parse(sessionStorage.getItem('synk.oauth.session.study')),world:sessionStorage.getItem('synk.oauth.session.world'),intent:sessionStorage.getItem('synk.study.login.intent')}));
  assert.equal(stored.study.access_token,'synthetic-access');assert.equal(stored.world,'original-world');assert.equal(stored.intent,null);assert.deepEqual(errors,[]);assert.equal(requests.some(p=>p.startsWith('/functions/')||p.startsWith('/api/world')),false);
 }finally{await browser.close();server.close();}
});
