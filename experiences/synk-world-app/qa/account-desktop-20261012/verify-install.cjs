'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve('.tmp/world-tutor-native-20261012'),installed=path.join(process.env.LOCALAPPDATA,'Programs/SYNKWorldPreview');
const profile=path.join(process.env.APPDATA,'SYNK Desktop/im.synk.world.preview');
const phase=process.argv[2];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function digest(directory){if(!fs.existsSync(directory))return {exists:false};const entries=[];const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Unexpected link');if(e.isDirectory())walk(file);else if(e.isFile())entries.push({path:path.relative(directory,file),sha256:hash(file)});}};walk(directory);entries.sort((a,b)=>a.path.localeCompare(b.path));return {exists:true,files:entries.length,sha256:crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex')};}
const platformFile=path.join(process.env.LOCALAPPDATA,'Programs/SYNKPlatformPreview/resources/app.asar');
const current=()=>({profile:digest(profile),platformSHA256:hash(platformFile)});
if(phase==='before'){
 const backup=path.join(root,'installed-before-backup');assert.ok(!fs.existsSync(backup));fs.cpSync(installed,backup,{recursive:true});
 const packageInfo=require(path.join(root,'package.json'));assert.equal(hash(packageInfo.installer.path),packageInfo.installer.sha256);
 const info={at:new Date().toISOString(),...current(),backup,installerSHA256:packageInfo.installer.sha256};fs.writeFileSync(path.join(root,'before-install.json'),JSON.stringify(info,null,2));console.log(JSON.stringify({backupReady:true,installerMatches:true,profileFiles:info.profile.files}));
}else if(phase==='after'){
 const before=require(path.join(root,'before-install.json')),after=current();assert.deepEqual(after,before&&{profile:before.profile,platformSHA256:before.platformSHA256},'Profile or Platform changed during installer');
 const expected=require(path.join(root,'final-payload.json'));const files=expected.files.map(e=>({path:e.path,match:fs.existsSync(path.join(installed,e.path))&&hash(path.join(installed,e.path))===e.sha256}));assert.ok(files.every(e=>e.match));
 const metadata=JSON.parse(fs.readFileSync(path.join(installed,'resources/synk-install.json')));assert.equal(metadata.version,'0.4.2');
 const report={at:new Date().toISOString(),ok:true,installedVersion:metadata.version,installed,files,profileUnchanged:true,platformUnchanged:true,installerSHA256:before.installerSHA256};fs.writeFileSync(path.join(root,'installed.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,version:metadata.version,files:files.length,profileUnchanged:true,platformUnchanged:true}));
}else throw Error('Use before or after');
