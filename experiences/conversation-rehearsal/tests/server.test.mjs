import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from '../server.mjs';

test('serves exact public assets and canonical Core while denying writes/private files',async t=>{
  const server=createServer({accountConfig:{version:1}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const root=await fetch(base);assert.equal(root.status,200);assert.match(await root.text(),/중요한 대화 리허설/);assert.match(root.headers.get('content-security-policy'),/connect-src 'self';/);
  const ask=await fetch(`${base}/core/ask.js`);assert.equal(ask.status,200);assert.equal(await ask.text(),await readFile(new URL('../../../atlas/ask.js',import.meta.url),'utf8'));
  for(const asset of ['book.mjs','book.css','member-book-assets.mjs']){const response=await fetch(`${base}/${asset}`);assert.equal(response.status,200);assert.ok((await response.text()).length>0);}
  const bookCSS=await fetch(`${base}/book.css`,{method:'HEAD'});assert.match(bookCSS.headers.get('content-type'),/text\/css/);assert.equal(await bookCSS.text(),'');
  for(const name of ['teacher-cover.png','button.webp','button-soft.webp','chip.webp','wide-cream.webp','wide-lapis.webp','SUIT.woff2']){
    const head=await fetch(`${base}/assets/${name}`,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.ok(Number(head.headers.get('content-length'))>0);
  }
  for(const pathname of ['/server.mjs','/README.md','/tests/server.test.mjs','/assets/engine.js','/.env','/atlas/engine.js','/%2e%2e/%2e%2e/Code.js']) assert.equal((await fetch(`${base}${pathname}`)).status,404,pathname);
  for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) assert.equal((await fetch(base,{method})).status,405);
});
