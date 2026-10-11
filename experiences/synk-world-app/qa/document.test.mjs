import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {renderWorldDocument} from '../document.mjs';
const source=fs.readFileSync(new URL('../../brand-opening/home.html',import.meta.url),'utf8');
for(const basePath of ['/','/world/','/preview/world/'])test(`Connected Maru mounts once at ${basePath}`,()=>{
 const html=renderWorldDocument(source,{mode:'account',basePath});
 assert.match(html,/id="home-main"/);
 assert.match(html,/id="world-panel"/);
 assert.equal((html.match(/type="module"/g)||[]).length,1,'only authenticated shell bootstraps the home');
 assert.ok(html.includes(`src="${basePath}app-shell.mjs"`));
 assert.ok(html.includes(`href="${basePath}brand-opening/home.css"`));
 assert.ok(html.includes(`src="${basePath}brand-opening/assets/felt-world-scene-mobile-v9.webp"`));
 assert.ok(html.includes(`href="${basePath}korean-runner/"`));
 assert.doesNotMatch(html,/(?:src|href)="assets\//);
 assert.ok(html.indexOf('id="synk-world-config"')<html.indexOf('world-bootstrap.js'));
 assert.ok(html.indexOf('world-bootstrap.js')<html.indexOf('app-shell.mjs'));
 for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if(/type="(?:application\/json|importmap)"/.test(script[1]))continue;
  assert.match(script[1],/\bsrc="/, 'executable scripts must work under the desktop CSP');
  assert.equal(script[2].trim(),'');
 }
});

test('External bootstrap sets connected config before the shell and removes a stuck cover',()=>{
 let removed=false,callback;
 const context={window:{},document:{getElementById:id=>id==='synk-world-config'?{textContent:'{"basePath":"/world/","mode":"account"}'}:{remove(){removed=true;}}},setTimeout(fn,delay){assert.equal(delay,5000);callback=fn;return 7;}};
 vm.runInNewContext(fs.readFileSync(new URL('../world-bootstrap.js',import.meta.url),'utf8'),context);
 assert.equal(context.window.__SYNK_WORLD_CONNECTED__,true);
 assert.equal(context.window.__SYNK_WORLD_CONFIG__.basePath,'/world/');
 assert.equal(context.window.__synkOpeningSafetyTimer,7);
 assert.equal(removed,false);
 callback();
 assert.equal(removed,true);
});
test('Config cannot close the bootstrap script',()=>{
 const html=renderWorldDocument(source,{basePath:'/',label:'</script><img src=x>'});
 assert.ok(html.includes('\\u003c/script>'));
 assert.ok(!html.includes('<img src=x>'));
});
test('Reject paths which could escape the mounted app',()=>{
 for(const basePath of ['//evil.test/','/world/../','world/','/world/?x=1','/<script>/'])assert.throws(()=>renderWorldDocument(source,{basePath}),TypeError);
});
