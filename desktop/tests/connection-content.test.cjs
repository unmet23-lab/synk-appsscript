'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createConnectionContent}=require('../src/connection-content.cjs');
const {trustedEntry,assertSender}=require('../src/security.cjs');
const entry='http://127.0.0.1:4280/synk-account/client.html?product=world';
const options={appRoot:path.resolve(__dirname,'..'),clientId:'world',mode:'development',entry};

test('Messenger teaching cold start accepts only the fixed cloud retry entry',async()=>{
  const cloud={...options,clientId:'messenger',messengerCloudPreview:true,entry:'https://workspace.synk.im/?tab=teaching'};
  const html=await(await createConnectionContent(cloud)('synk-desktop://status/')).text();
  assert.ok(html.includes('href="https://workspace.synk.im/?tab=teaching"'));assert.match(html,/인터넷 연결/);
  for(const entry of ['https://workspace.synk.im/?tab=teaching&url=x','https://workspace.synk.im/?tab=teaching#x','https://workspace.synk.im/other?tab=teaching','https://example.invalid/?tab=teaching'])assert.throws(()=>createConnectionContent({...cloud,entry}),/Invalid connection entry/);
  for(const override of [{clientId:'world'},{mode:'release'},{messengerCloudPreview:false}])assert.throws(()=>createConnectionContent({...cloud,...override}),/Invalid connection entry/);
  assert.equal(trustedEntry('synk-desktop://status/',cloud.entry,'messenger'),false);
});
test('connection page links only to the configured entry, loads packaged brand assets and contains no script',async()=>{
  const serve=createConnectionContent(options),response=await serve('synk-desktop://status/'),html=await response.text();
  assert.equal(response.status,200);assert.match(html,/href="http:\/\/127\.0\.0\.1:4280\/synk-account\/client\.html\?product=world"/);assert.match(html,/다시 연결/);assert.match(html,/이 기기의 앱 서비스/);assert.doesNotMatch(html,/<script|onclick=|onload=/);
  for(const [asset,mime] of [['synk.svg','image/svg+xml'],['button.webp','image/webp'],['SUIT.woff2','font/woff2'],['InterTight.woff2','font/woff2']]){const r=await serve('synk-desktop://status/assets/'+asset);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),mime);assert.ok((await r.arrayBuffer()).byteLength>100);}
  assert.match(response.headers.get('content-security-policy'),/script-src 'none'/);assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
});
test('connection handler rejects arbitrary origins, parameters, files, traversal and write requests',async()=>{
  const serve=createConnectionContent(options);
  for(const url of ['synk-desktop://status/?entry=https://example.org','synk-desktop://user@status/','synk-desktop://status:123/','https://status/','synk-desktop://platform/','synk-desktop://status/#x','synk-desktop://status/src/main.cjs','synk-desktop://status/runtime.json','synk-desktop://status/assets/sources.json','synk-desktop://status/assets/../','synk-desktop://status/assets/%2e%2e/','synk-desktop://status/assets/..%5cmain.cjs'])assert.equal((await serve(url)).status,404,url);
  assert.equal((await serve({url:'synk-desktop://status/',method:'POST'})).status,405);
});
test('packaged connection assets cannot resolve through symlinks outside their folder',async()=>{
  const serve=createConnectionContent({...options,realpath:async file=>file.endsWith('synk.svg')?path.resolve('outside.svg'):file,readFile:async()=>{throw Error('must not read escaped path');}});
  assert.equal((await serve('synk-desktop://status/assets/synk.svg')).status,404);
});
test('connection page cannot use account IPC and rejects unsafe runtime entry',async()=>{
  assert.equal(trustedEntry('synk-desktop://status/',entry,'world'),false);
  const frame={url:'synk-desktop://status/'},contents={mainFrame:frame},window={isDestroyed:()=>false,webContents:contents};
  assert.throws(()=>assertSender({sender:contents,senderFrame:frame},window,entry,'world'),/UNTRUSTED_SENDER/);
  assert.throws(()=>createConnectionContent({...options,entry:'javascript:alert(1)'}),/Invalid connection entry/);
});
test('release copy omits local server instructions and escapes the product label',async()=>{
  const serve=createConnectionContent({...options,mode:'release',entry:'https://world.example.org/',productName:'<script>bad</script>'});
  const html=await (await serve('synk-desktop://status/')).text();assert.match(html,/인터넷 연결/);assert.doesNotMatch(html,/이 기기의 앱 서비스|<script>/);assert.match(html,/&lt;script&gt;bad/);
});
