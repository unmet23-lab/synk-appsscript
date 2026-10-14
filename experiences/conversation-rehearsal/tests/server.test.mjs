import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from '../server.mjs';
import { MEMBER_SIGNAL_FILES } from '../../member-signal/serve.mjs';

const own = name => new URL(`../${name}`, import.meta.url);
const ASSETS = ['podium.webp','bubble.webp','quote.webp','trophy.webp','thought.webp','stamp.webp'];

test('serves exact public assets, the shared signal frame and canonical Core while denying writes/private files',async t=>{
  const server=createServer({accountConfig:{version:1}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const root=await fetch(base);assert.equal(root.status,200);const html=await root.text();assert.match(html,/중요한 대화 리허설/);
  const csp=root.headers.get('content-security-policy');assert.match(csp,/connect-src 'self';/);
  // 누르고 말하기 녹음은 이 창의 blob 주소로만 다시 듣는다. 다른 미디어 출처는 열지 않는다.
  assert.match(csp,/(?:^|; )media-src blob:;/);assert.doesNotMatch(csp,/media-src[^;]*(?:'self'|https?:|\*|data:)/);
  for(const directive of ["default-src 'none'","script-src 'self'","style-src 'self'","img-src 'self'","font-src 'self'","object-src 'none'","base-uri 'none'","form-action 'none'","frame-ancestors 'none'"]) assert.ok(csp.includes(directive),directive);
  const ask=await fetch(`${base}/core/ask.js`);assert.equal(ask.status,200);assert.equal(await ask.text(),await readFile(new URL('../../../atlas/ask.js',import.meta.url),'utf8'));
  for(const asset of ['app.mjs','app.css','domain.mjs','storage.mjs','book.mjs','coach.mjs','voice.mjs']){const response=await fetch(`${base}/${asset}`);assert.equal(response.status,200,asset);assert.equal(await response.text(),await readFile(own(asset),'utf8'),asset);}
  for(const asset of ['book.css','member-book-assets.mjs']){const response=await fetch(`${base}/${asset}`);assert.equal(response.status,200);assert.ok((await response.text()).length>0);}
  const bookCSS=await fetch(`${base}/book.css`,{method:'HEAD'});assert.match(bookCSS.headers.get('content-type'),/text\/css/);assert.equal(await bookCSS.text(),'');
  // 화면이 실제로 부르는 그림은 모두 허용 목록 안에 있어야 한다.
  const app=await readFile(own('app.mjs'),'utf8');
  for(const name of new Set([...app.matchAll(/\.\/assets\/([\w-]+\.webp)/g)].map(match=>match[1]))) assert.ok(ASSETS.includes(name),name);
  for(const name of ASSETS){
    const head=await fetch(`${base}/assets/${name}`,{method:'HEAD'});assert.equal(head.status,200,name);assert.equal(await head.text(),'');assert.ok(Number(head.headers.get('content-length'))>0);assert.match(head.headers.get('content-type'),/image\/webp/);
  }
  // 공통 시그널 틀: 화면(index.html·app.mjs)과 signal.css가 부르는 경로가 모두 열리고, 목록 밖 파일은 닫힌다.
  const signalCSS=await readFile(new URL('../../member-signal/signal.css',import.meta.url),'utf8');
  const referenced=new Set([...`${html}\n${app}`.matchAll(/\/member-signal\/[\w./-]+/g)].map(match=>match[0]).concat([...signalCSS.matchAll(/url\(\.\/([^)]+)\)/g)].map(match=>`/member-signal/${match[1]}`)));
  assert.ok(referenced.has('/member-signal/signal.mjs')&&referenced.has('/member-signal/signal.css')&&referenced.has('/member-signal/theme.js'));
  for(const pathname of new Set([...referenced,...MEMBER_SIGNAL_FILES.map(name=>`/member-signal/${name}`)])){
    const head=await fetch(`${base}${pathname}`,{method:'HEAD'});assert.equal(head.status,200,pathname);assert.ok(Number(head.headers.get('content-length'))>0,pathname);
  }
  const signal=await fetch(`${base}/member-signal/signal.mjs`);assert.match(signal.headers.get('content-type'),/text\/javascript/);assert.equal(await signal.text(),await readFile(new URL('../../member-signal/signal.mjs',import.meta.url),'utf8'));
  for(const pathname of ['/server.mjs','/README.md','/tests/server.test.mjs','/qa/cua-practice-390.png','/assets/engine.js','/assets/teacher-cover.png','/.env','/atlas/engine.js','/%2e%2e/%2e%2e/Code.js','/member-signal/serve.mjs',encodeURI('/member-signal/조사_20261014.md'),'/member-signal/%2e%2e/conversation-rehearsal/server.mjs']) assert.equal((await fetch(`${base}${pathname}`)).status,404,pathname);
  for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) assert.equal((await fetch(base,{method})).status,405);
});
