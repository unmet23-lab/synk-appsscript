import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
 assert.ok(html.indexOf('__SYNK_WORLD_CONFIG__')<html.indexOf('app-shell.mjs'));
});
test('Config cannot close the bootstrap script',()=>{
 const html=renderWorldDocument(source,{basePath:'/',label:'</script><img src=x>'});
 assert.ok(html.includes('\\u003c/script>'));
 assert.ok(!html.includes('<img src=x>'));
});
test('Reject paths which could escape the mounted app',()=>{
 for(const basePath of ['//evil.test/','/world/../','world/','/world/?x=1','/<script>/'])assert.throws(()=>renderWorldDocument(source,{basePath}),TypeError);
});
