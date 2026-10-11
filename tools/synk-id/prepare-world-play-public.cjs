#!/usr/bin/env node
'use strict';
// Freeze the shared callback page and WORLD assets. The Platform entry bundle
// is included only when explicitly requested for a reviewed account handoff.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),SOURCE='experiences/synk-account';
const CALLBACK='https://synk.im/account/client.html?product=world';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function once(text,from,to){if(text.split(from).length!==2)throw Error('WORLD_PUBLIC_SOURCE_CHANGED');return text.replace(from,to);}
function transform(name,text){
 if(name===SOURCE+'/src/client.mjs')return once(text,"if (!PRODUCTS[product]) throw new Error('등록된 SYNK 제품 주소를 확인해 주세요.');","if (!['platform','world'].includes(product)) throw new Error('등록된 플랫폼 또는 WORLD 계정 주소로 이동해 주세요.');");
 if(name===SOURCE+'/client.html')return text.replaceAll('href="../learning-hub/"','href="/try/learning-hub/"').replace('href="./index.html"','href="https://synk.im/id/"').replace('src="../learning-hub/atlas-learning.js"','src="/try/learning-hub/atlas-learning.js"');
 return text;
}
async function prepare(configPath,out,{includePlatform=false,platformSourceRoot=ROOT}={}){
 out=path.resolve(out);if(!out.startsWith(path.join(ROOT,'.tmp')+path.sep))throw Error('OUTPUT_MUST_BE_WORKSPACE_TMP');
 const config=JSON.parse(await fs.readFile(configPath,'utf8'));
 const {readConfig}=await import(require('node:url').pathToFileURL(path.join(ROOT,SOURCE,'src/core.mjs')).href);
 const parsed=readConfig(config,CALLBACK);
 const registration=parsed.authorizationClients.find(item=>item.clientId===parsed.clients.world.clientId&&item.product==='world');
 if(!parsed.configured||parsed.portalUrl!=='https://synk.im/id/'||!/^sb_publishable_/.test(parsed.supabasePublishableKey)||parsed.clients.world.redirectUri!==CALLBACK||parsed.clients.platform.redirectUri!=='https://synk.im/account/client.html?product=platform'||parsed.learningUrl!=='https://synk.im/try/learning-hub/'||!registration?.redirectUris.includes(CALLBACK))throw Error('WORLD_PUBLIC_CONFIG_NOT_VERIFIED');
 await fs.mkdir(path.dirname(out),{recursive:true});await fs.mkdir(out);
 platformSourceRoot=path.resolve(platformSourceRoot);
 const snapshot=path.join(out,'snapshot'),platformSnapshot=path.join(out,'platform-snapshot'),payload=path.join(out,'payload/account'),records=new Map(),platformRecords=new Map(),files={};
 async function write(file,bytes){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
 async function capture(file){
  const name=path.relative(ROOT,file).replaceAll('\\','/');if(name.startsWith('../')||path.isAbsolute(name))throw Error('DEPENDENCY_OUTSIDE_WORKSPACE');
  if(records.has(name))return records.get(name).bytes;
  const source=await fs.readFile(file),bytes=/\.(?:[cm]?js|html|css|svg|json|webmanifest)$/.test(name)?Buffer.from(transform(name,source.toString('utf8').replace(/\r\n/g,'\n'))):source;
  records.set(name,{sourceSha256:sha(source),frozenSha256:sha(bytes),bytes});await write(path.join(snapshot,name),bytes);return bytes;
 }
 async function output(name,bytes){await write(path.join(payload,name),bytes);files[name]=sha(bytes);}
 async function capturePlatform(file){
  const name=path.relative(platformSourceRoot,file).replaceAll('\\','/');if(name.startsWith('../')||path.isAbsolute(name))throw Error('PLATFORM_DEPENDENCY_OUTSIDE_SNAPSHOT');
  if(platformRecords.has(name))return platformRecords.get(name).bytes;
  const source=await fs.readFile(file),bytes=Buffer.from(source.toString('utf8').replace(/\r\n/g,'\n'));
  platformRecords.set(name,{source:path.resolve(file),sourceSha256:sha(source),frozenSha256:sha(bytes),bytes});await write(path.join(platformSnapshot,name),bytes);return bytes;
 }
 const esbuild=require(require.resolve('esbuild',{paths:[path.join(ROOT,SOURCE)]}));
 const options={bundle:true,write:false,platform:'browser',format:'iife',target:['es2022'],charset:'utf8',minifyWhitespace:true,metafile:true};
 async function bundle(entry){
 const entryRoot=entry==='platform'?platformSourceRoot:ROOT,frozenRoot=entry==='platform'?platformSnapshot:snapshot,captureEntry=entry==='platform'?capturePlatform:capture;
 const discovered=await esbuild.build({...options,absWorkingDir:entryRoot,entryPoints:[path.join(entryRoot,SOURCE,'src/'+entry+'.mjs')],plugins:[{name:'freeze-world-play',setup(build){build.onLoad({filter:/\.[cm]?js$/},async args=>({contents:await captureEntry(args.path),loader:'js'}));}}]});
 if(entry==='client'){
 for(const name of ['account-host.mjs','account-view.mjs','world-play-entry.mjs'])if(!Object.keys(discovered.metafile.inputs).some(input=>input.replaceAll('\\','/').endsWith('/'+name)))throw Error('WORLD_PLAY_DEPENDENCY_MISSING: '+name);
 }
 const built=await esbuild.build({...options,absWorkingDir:frozenRoot,entryPoints:[path.join(frozenRoot,SOURCE,'src/'+entry+'.mjs')]});
 const clean=value=>Buffer.from(value).toString('utf8').replace(/\/\/[^\n]*\n/g,'');if(clean(built.outputFiles[0].contents)!==clean(discovered.outputFiles[0].contents))throw Error('FROZEN_REBUILD_MISMATCH');
 await output('dist/'+entry+'.js',built.outputFiles[0].contents);
 }
 await bundle('client');
 if(includePlatform)await bundle('platform');
 const manifest=JSON.parse(await fs.readFile(path.join(ROOT,SOURCE,'build-manifest.json'),'utf8'));
 for(const name of ['client.html','style.css','world-classroom.css','wardrobe.css','world.webmanifest','dist/wardrobe-three.js',...Object.keys(manifest.sha256).filter(name=>name.startsWith('assets/'))])await output(name,await capture(path.join(ROOT,SOURCE,name)));
 await output('config.json',Buffer.from(JSON.stringify(config,null,2)+'\n'));
 for(const [name,record]of records)if(sha(await fs.readFile(path.join(ROOT,name)))!==record.sourceSha256)throw Error('SHARED_SOURCE_CHANGED_DURING_FREEZE: '+name);
 for(const [name,record]of platformRecords)if(sha(await fs.readFile(record.source))!==record.sourceSha256)throw Error('PLATFORM_SOURCE_CHANGED_DURING_FREEZE: '+name);
 const report={preparedAt:new Date().toISOString(),publicUrl:CALLBACK+'&play=learning-hub',sourceRoot:ROOT,includePlatform,files,sources:Object.fromEntries([...records].map(([name,{bytes,...record}])=>[name,record])),platformSources:Object.fromEntries([...platformRecords].map(([name,{bytes,...record}])=>[name,record])),userLoginVerified:false,deployed:false,requirements:['WORLD callback registration','synk-play migration and enabled Edge','published learning-hub and game payloads','reachable spaceship room server before advertising cooperative play',...(includePlatform?['Review Platform handoff source delta against the current published Platform bundle']:[])]};
 await write(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');return {out,payload,files:Object.keys(files).length,sourceFiles:records.size};
}
module.exports={prepare,transform};
if(require.main===module){const args=process.argv.slice(2);if(args.length!==2&&!(args.length===3&&args[2]==='--with-platform')&&!(args.length===4&&args[2]==='--platform-source')){console.error('Usage: prepare-world-play-public.cjs PUBLIC_CONFIG NEW_OUTPUT_DIRECTORY [--with-platform | --platform-source EXACT_SOURCE_ROOT]');process.exitCode=1;}else prepare(args[0],args[1],{includePlatform:args.length>2,platformSourceRoot:args[3]||ROOT}).then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error.message);process.exitCode=1;});}
