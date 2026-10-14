import http from 'node:http';
import { readFileSync } from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from '../server.mjs';
import net from 'node:net';
test('take-home modules, embedded fonts and scoped print CSS are the only extra public resources',async()=>{const server=createServer({port:0,accountConfig:{version:1}});await server.start();const origin=`http://127.0.0.1:${server.address().port}`;try{for(const url of ['/takehome.mjs','/member-book-assets.mjs','/takehome.css'])assert.equal((await fetch(origin+url)).status,200,url);assert.match(await(await fetch(origin+'/takehome.css')).text(),/\.album-book/);assert.equal((await fetch(origin+'/../tools/build-member-book-assets.mjs')).status,404);}finally{await server.stop();}});
test('loopback server serves only exact public files and explicit Core sources', async () => {
  const server = createServer({ port: 0, accountConfig: { version: 1 } });await server.start();
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const url of ['/', '/app.mjs', '/media.mjs', '/assets/camera.webp', '/core/ask.js', '/core/domain.js']) {
      const res = await fetch(origin + url);assert.equal(res.status, 200, url);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    }
    // The album imports the shared personal-data module. Its travel validator
    // has static dependencies on these exact public Atlas modules even when
    // this product's resource is family-album. Check the real graph and bytes;
    // accepting an arbitrary additional /atlas route would be insufficient.
    const graph = new Map([
      ['/app.mjs', new URL('../app.mjs', import.meta.url)],
      ...['account-notebook.mjs', 'personal-data.mjs'].map(name => [`/synk-account/src/${name}`, new URL(`../../synk-account/src/${name}`, import.meta.url)]),
      ...['planner-account.mjs', 'planner-storage.mjs', 'planner.mjs', 'planner-feedback.mjs'].map(name => [`/path-travel/${name}`, new URL(`../../path-travel/${name}`, import.meta.url)]),
      ...['domain', 'travel', 'ask', 'trail-life', 'temper-outcomes'].map(name => [`/atlas/${name}.js`, new URL(`../../../atlas/${name}.js`, import.meta.url)]),
    ]);
    const sources = new Map();
    for (const [url, file] of graph) {
      const res = await fetch(origin + url);assert.equal(res.status, 200, url);
      assert.match(res.headers.get('content-type'), /^text\/javascript(?:;|$)/, url);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff', url);
      const bytes = Buffer.from(await res.arrayBuffer());assert.deepEqual(bytes, readFileSync(file), url);
      sources.set(url, bytes.toString('utf8'));
    }
    for (const [from, specifier, target] of [
      ['/app.mjs', '/synk-account/src/account-notebook.mjs', '/synk-account/src/account-notebook.mjs'],
      ['/app.mjs', '/synk-account/src/personal-data.mjs', '/synk-account/src/personal-data.mjs'],
      ['/synk-account/src/account-notebook.mjs', './personal-data.mjs', '/synk-account/src/personal-data.mjs'],
      ['/synk-account/src/personal-data.mjs', '../../path-travel/planner-account.mjs', '/path-travel/planner-account.mjs'],
      ['/path-travel/planner-account.mjs', './planner-storage.mjs', '/path-travel/planner-storage.mjs'],
      ['/path-travel/planner-storage.mjs', './planner.mjs', '/path-travel/planner.mjs'],
      ['/path-travel/planner-storage.mjs', './planner-feedback.mjs', '/path-travel/planner-feedback.mjs'],
      ...['domain', 'travel', 'ask'].map(name => ['/path-travel/planner.mjs', `../../atlas/${name}.js`, `/atlas/${name}.js`]),
      ...['trail-life', 'temper-outcomes'].map(name => ['/path-travel/planner-feedback.mjs', `../../atlas/${name}.js`, `/atlas/${name}.js`]),
    ]) {
      assert.ok(sources.get(from).includes(`from '${specifier}'`), `${from} must actually import ${specifier}`);
      assert.equal(new URL(specifier, origin + from).pathname, target);
      assert.ok(graph.has(target), target);
    }
    for (const url of ['/server.mjs', '/README.md', '/tests/model.test.mjs', '/assets/unknown.webp', '/core/engine.js',
      '/atlas/engine.js', '/atlas/private.js', '/atlas/domain.js.bak', '/atlas/domain.js/private',
      '/path-travel/server.mjs', '/path-travel/README.md', '/path-travel/tests/planner.test.mjs',
      '/synk-account/config.json', '/synk-account/server-shared.mjs', '/synk-account/src/private.mjs', '/%2e%2e/Code.js']) {
      assert.equal((await fetch(origin + url)).status, 404, url);
    }
    assert.equal((await fetch(origin, { method: 'HEAD' })).status, 200);
    assert.equal(await (await fetch(origin, { method: 'HEAD' })).text(), '');
    const health = await (await fetch(origin + '/api/health')).json();assert.equal(health.accountSync, false);
  } finally { await server.stop(); }
});
test('foreign origin, cross-site, unsupported methods and unconfigured external connections are denied',async()=>{const server=createServer({port:0,accountConfig:{version:1}});await server.start();const origin=`http://127.0.0.1:${server.address().port}`;try{assert.equal((await fetch(origin,{headers:{origin:'https://evil.test'}})).status,403);assert.equal((await fetch(origin,{headers:{'sec-fetch-site':'cross-site'}})).status,403);assert.equal((await fetch(origin,{method:'POST',body:'x'})).status,405);assert.equal(await new Promise((resolve,reject)=>{const req=http.get(origin,{headers:{host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);}),403);const csp=(await fetch(origin)).headers.get('content-security-policy');assert.match(csp,/connect-src 'self';/);assert.match(csp,/frame-ancestors 'none'/);assert.equal((await fetch(origin+'/%E0%A4%A')).status,400);}finally{await server.stop();}});

test('registered cross-site OAuth document return works while fetch iframe API and files remain blocked', async t => {
  const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const accountConfig = { version: 1, supabaseUrl: 'https://auth.example.test', supabasePublishableKey: 'sb_publishable_fixture',
    portalUrl: 'https://id.example.test/', clients: { 'family-album': { clientId: 'fixture-family', redirectUri: base + '/' } } };
  const server = createServer({ port, accountConfig }); await server.start(); t.after(() => server.stop());
  const navigation = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
  const request = (path, { method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request(base, { path, method, headers: { ...navigation, ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; }); res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
    }); req.on('error', reject); req.end();
  });
  for (const query of ['state=s&code=c', 'state=s&error=access_denied', 'state=s&error=access_denied&error_description=User+cancelled']) {
    const response = await request('/?' + query); assert.equal(response.status, 200); assert.match(response.text, /<!doctype html>/i);
    assert.equal(response.headers['referrer-policy'], 'no-referrer'); assert.equal(response.headers['cache-control'], 'no-store');
  }
  for (const [path, options] of [
    ['/?state=s&code=c', { method: 'HEAD' }], ['/?state=s&code=c', { method: 'POST' }],
    ['/?state=s&code=c', { headers: { 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' } }],
    ['/?state=s&code=c', { headers: { 'sec-fetch-dest': 'iframe' } }],
    ['/?state=s&code=c', { headers: { origin: 'https://id.example.test' } }],
    ['/?state=s&code=c', { headers: { host: 'localhost:' + port } }],
    ['/app.mjs?state=s&code=c', {}], ['/assets/camera.webp?state=s&code=c', {}], ['/api/account-config?state=s&code=c', {}],
    ['/api/health?state=s&code=c', {}], ['/?code=c', {}], ['/?state=s&code=c&state=s', {}], ['/?state=s&code=c&error=denied', {}],
    ['/a/../?state=s&code=c', {}], ['/', {}],
  ]) assert.equal((await request(path, options)).status, 403, path + ' ' + JSON.stringify(options));
});
