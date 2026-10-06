import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as pathServer } from '../../path-vr/server.mjs';
import { createServer as rehearsalServer } from '../../conversation-rehearsal/server.mjs';
import { createServer as familyServer } from '../../family-album/server.mjs';
const config={version:1,supabaseUrl:'https://auth.example.test',accountApiUrl:'https://api.example.test',supabasePublishableKey:'sb_publishable_fixture',portalUrl:'https://portal.example.test',clients:{path:{clientId:'fixture-path',redirectUri:'http://127.0.0.1:4292/'},rehearsal:{clientId:'fixture-rehearsal',redirectUri:'http://127.0.0.1:4297/'},'family-album':{clientId:'fixture-family',redirectUri:'http://127.0.0.1:4298/'}}};
for(const [name,create] of [['path',pathServer],['rehearsal',rehearsalServer],['family',familyServer]])test(`${name} serves the exact shared account graph and only vetted connection origins`,async t=>{
  const server=create({port:0,accountConfig:config});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const base=`http://127.0.0.1:${server.address().port}`;
  const root=await fetch(base);assert.match(root.headers.get('content-security-policy'),/connect-src 'self' https:\/\/auth.example.test https:\/\/api.example.test;/);
  const pub=await(await fetch(base+'/api/account-config')).json();assert.equal(pub.clients.path.clientId,'fixture-path');assert.equal(pub.configured,undefined);
  for(const file of ['core','product-account','document-sync','personal-data','personal-media','account-notebook']){const r=await fetch(base+`/synk-account/src/${file}.mjs`);assert.equal(r.status,200,file);assert.match(r.headers.get('content-type'),/javascript/);}
  for(const file of ['/synk-account/src/account-notebook.css','/synk-account/assets/slab-cream-long.webp','/path-vr/model.mjs','/conversation-rehearsal/domain.mjs','/family-album/model.mjs'])assert.equal((await fetch(base+file)).status,200,file);
  for(const file of ['/synk-account/config.json','/synk-account/src/private.mjs','/synk-account/server-shared.mjs'])assert.equal((await fetch(base+file)).status,404,file);
});
test('secret-bearing shared configuration cannot reach browser or connection policy',async t=>{
  const server=pathServer({port:0,accountConfig:{...config,supabasePublishableKey:'sb_secret_hidden'}});await server.start();t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const base=`http://127.0.0.1:${server.address().port}`;
  assert.match((await fetch(base)).headers.get('content-security-policy'),/connect-src 'self';/);const text=await(await fetch(base+'/api/account-config')).text();assert.equal(text.includes('hidden'),false);assert.equal(text.includes('auth.example'),false);
});
