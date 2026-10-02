import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createCompanyApp} from './server.mjs';

test('workroom serves shared practice modules without exposing the source directory or a new customer service',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-practice-route-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  t.after(async()=>{await app.stop();const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&target.split(sep).at(-1).startsWith('synk-practice-route-'));await rm(target,{recursive:true,force:true});});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  const modules={
    '/workroom-practice/model.mjs':'../../../../../experiences/shift-workbench/model.mjs',
    '/workroom-practice/core.js':'../../../../../atlas/engine.js',
    '/workroom-practice/personalization.js':'../../../../../atlas/personalization.js',
    '/workroom-practice.js':'./public/workroom-practice.js',
    '/workroom-practice.css':'./public/workroom-practice.css',
  };
  for(const [route,source]of Object.entries(modules)){
    const response=await fetch(base+route);assert.equal(response.status,200,route);
    assert.match(response.headers.get('content-type'),route.endsWith('.css')?/text\/css/:/text\/javascript/);
    assert.equal(await response.text(),await readFile(new URL(source,import.meta.url),'utf8'),route);
    const head=await fetch(base+route,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  }
  for(const route of ['/workroom-practice/server.mjs','/workroom-practice/data/company.sqlite','/workroom-practice/unknown.js'])assert.equal((await fetch(base+route)).status,404,route);
  const felt=await fetch(base+'/messenger/assets/felt-ui/slab-cream-long.webp');assert.equal(felt.status,200);assert.deepEqual(Buffer.from(await felt.arrayBuffer()),await readFile(new URL('../../../../디자인/펠트부품/assets/ui/slab-cream-long.webp',import.meta.url)));
  // Synthetic module contents are public, but existing company records still require a session.
  for(const route of ['/api/workroom-guide','/api/content-workspace','/api/studio-workspace'])assert.equal((await fetch(base+route)).status,401,route);
  const home=await(await fetch(base+'/')).text();assert.match(home,/\/workroom-practice\.js/);assert.match(home,/\/workroom-practice\.css/);
});
