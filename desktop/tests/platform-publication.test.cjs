'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateRelease,updateSiteText,stageSite}=require('../tools/publish-platform-release.cjs');
const sample=()=>({schemaVersion:1,product:'platform',channel:'preview',version:'0.4.4',releaseId:'platform-preview-0.4.4',buildId:'20261014.1',publishedAt:'2026-10-14T00:00:00.000Z',artifacts:[['win32','x64','win','exe'],['darwin','arm64','mac','dmg'],['darwin','x64','mac','dmg']].map(([platform,arch,os,ext])=>({platform,arch,url:`https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.4/SYNK-Platform-Preview-0.4.4-Signal-${os}-${arch}.${ext}`,bytes:123,sha256:'a'.repeat(64),asarSHA256:'b'.repeat(64)}))});
test('publication requires every platform and never changes bytes under the same version',()=>{
 const release=sample();assert.equal(validateRelease(release).length,3);assert.doesNotThrow(()=>validateRelease(release,structuredClone(release)));
 const partial=sample();partial.artifacts.pop();assert.throws(()=>validateRelease(partial),/three/);
 const altered=sample();altered.artifacts[0].sha256='c'.repeat(64);assert.throws(()=>validateRelease(altered,release),/immutable/);
 const previous=sample();previous.version='0.4.5';assert.throws(()=>validateRelease(release,previous),/immutable/);
});
test('static links and update manifest advance together while unrelated content stays intact',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-release-site-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const release=sample(),old=release.artifacts.map(a=>`<a href="${a.url.replaceAll('0.4.4','0.4.3')}">download</a>`).join('');
 const original=`<html><body>KEEP USER CONTENT ${old} Preview 0.4.3</body></html>`;
 fs.writeFileSync(path.join(directory,'index.html'),original);fs.mkdirSync(path.join(directory,'en'));fs.writeFileSync(path.join(directory,'en/index.html'),original);
 const client=path.join(directory,'input-client.js');fs.writeFileSync(client,'// fixed client\n');
 const changed=stageSite({publicDir:directory,manifest:release,clientFile:client});assert(changed.includes('desktop/releases/preview.json'));
 const page=fs.readFileSync(path.join(directory,'index.html'),'utf8');assert(page.includes('KEEP USER CONTENT'));assert(!page.includes('0.4.3'));assert.equal((page.match(/client\.js/g)||[]).length,1);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'desktop/releases/preview.json'))),release);
 assert.equal(stageSite({publicDir:directory,manifest:release,clientFile:client}).length,0);
});
test('unrelated release links remain unchanged',()=>{
 const other='https://github.com/unmet23-lab/synk-policy/releases/download/other/product.exe';assert.equal(updateSiteText(other,sample()),other);
});
