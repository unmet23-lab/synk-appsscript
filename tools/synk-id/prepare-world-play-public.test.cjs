'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {prepare,transform}=require('./prepare-world-play-public.cjs');
const root=path.resolve(__dirname,'../..'),callback='https://synk.im/account/client.html?product=world',sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const config={version:1,supabaseUrl:'https://synthetic-world.supabase.co',accountApiUrl:'https://synthetic-world.supabase.co',supabasePublishableKey:'sb_publishable_synthetic',portalUrl:'https://synk.im/id/',learningUrl:'https://synk.im/try/learning-hub/',clients:{world:{clientId:'world-synthetic',redirectUri:callback},platform:{clientId:'platform-synthetic',redirectUri:'https://synk.im/account/client.html?product=platform'}},authorizationClients:[{product:'world',clientId:'world-synthetic',redirectUris:[callback]}]};
test('WORLD callback payload freezes real account storage and all dynamic wardrobe assets without replacing the platform home',async()=>{
 await fs.mkdir(path.join(root,'.tmp'),{recursive:true});const dir=await fs.mkdtemp(path.join(root,'.tmp/world-public-test-')),input=path.join(dir,'config.json');await fs.writeFile(input,JSON.stringify(config));
 const out=path.join(dir,'candidate');await prepare(input,out);const manifest=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8')),payload=path.join(out,'payload/account');
 for(const [name,digest]of Object.entries(manifest.files))assert.equal(sha(await fs.readFile(path.join(payload,name))),digest,name);
 assert.equal(manifest.deployed,false);assert.equal(manifest.userLoginVerified,false);assert.equal(manifest.files['platform.html'],undefined);assert.equal(manifest.files['dist/platform.js'],undefined);
 const source=await fs.readFile(path.join(payload,'dist/client.js'),'utf8');assert.match(source,/SYNKPlayHost/);assert.match(source,/synk-play/);assert.match(source,/플랫폼 또는 WORLD/);
 const html=await fs.readFile(path.join(payload,'client.html'),'utf8');assert.match(html,/src="\/try\/learning-hub\/atlas-learning.js"/);assert.match(html,/href="https:\/\/synk.im\/world\/"/);assert.match(html,/<nav>[\s\S]*href="\/try\/learning-hub\/">기본 학습<\/a>/);assert.doesNotMatch(html,/href="\.\.\/learning-hub\/"/);
 for(const name of ['wardrobe.css','world.webmanifest','dist/wardrobe-three.js'])assert.ok(manifest.files[name]);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(payload,'config.json'),'utf8')),config);await assert.rejects(prepare(input,out),/EEXIST/);
 const invalid=path.join(dir,'invalid.json');await fs.writeFile(invalid,JSON.stringify({...config,authorizationClients:[]}));await assert.rejects(prepare(invalid,path.join(dir,'invalid')),/WORLD_PUBLIC_CONFIG_NOT_VERIFIED/);
 await assert.rejects(prepare(input,path.join(root,'world-public-forbidden')),/OUTPUT_MUST_BE_WORKSPACE_TMP/);
});
test('public source transformation retains the normal PKCE implementation and rejects an unknown source revision',()=>{
 assert.throws(()=>transform('experiences/synk-account/src/client.mjs','unexpected'),/WORLD_PUBLIC_SOURCE_CHANGED/);
 const source="if (!PRODUCTS[product]) throw new Error('등록된 SYNK 제품 주소를 확인해 주세요.');\nbeginOAuth(config);";const output=transform('experiences/synk-account/src/client.mjs',source);assert.match(output,/\['platform','world'\]/);assert.match(output,/beginOAuth\(config\)/);
});
test('explicit Platform handoff captures a reproducible entry bundle without expanding page or game scope',async()=>{
 const dir=await fs.mkdtemp(path.join(root,'.tmp/world-public-platform-test-')),input=path.join(dir,'config.json');await fs.writeFile(input,JSON.stringify(config));
 const out=path.join(dir,'candidate');await prepare(input,out,{includePlatform:true});const manifest=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));
 assert.equal(manifest.includePlatform,true);assert.ok(manifest.files['dist/platform.js']);assert.equal(manifest.files['platform.html'],undefined);
 for(const name of ['platform.mjs','platform-entry.mjs','platform-home.mjs'])assert.ok(manifest.platformSources['experiences/synk-account/src/'+name]);
 const esbuild=require(require.resolve('esbuild',{paths:[path.join(root,'experiences/synk-account')]}));
 const rebuilt=await esbuild.build({entryPoints:[path.join(out,'platform-snapshot/experiences/synk-account/src/platform.mjs')],absWorkingDir:path.join(out,'platform-snapshot'),bundle:true,write:false,platform:'browser',format:'iife',target:['es2022'],charset:'utf8',minifyWhitespace:true});
 assert.equal(sha(rebuilt.outputFiles[0].contents),manifest.files['dist/platform.js']);
 assert.equal(sha(await fs.readFile(path.join(out,'payload/account/dist/platform.js'))),manifest.files['dist/platform.js']);
 const isolated=path.join(dir,'isolated');await prepare(input,isolated,{includePlatform:true,platformSourceRoot:path.join(out,'platform-snapshot')});
 const second=JSON.parse(await fs.readFile(path.join(isolated,'manifest.json'),'utf8'));assert.equal(second.files['dist/platform.js'],manifest.files['dist/platform.js']);
 assert.ok(Object.values(second.platformSources).every(row=>row.source.startsWith(path.join(out,'platform-snapshot'))));
});
