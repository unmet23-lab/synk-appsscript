'use strict';
// Freeze only a local, unpublished review candidate. No shared dist or server output is changed.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const qa=__dirname,root=path.resolve(qa,'../../../..'),portal=path.join(root,'experiences/synk-account');
const talk=path.resolve(root,'../SYNK-talk');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const candidate=path.join(os.homedir(),'.codex/tmp','google-signup-'+Date.now()+'-'+crypto.randomUUID().slice(0,8));
const files=[];
function copy(source,relative,kind){const bytes=fs.readFileSync(source),target=path.join(candidate,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files.push({kind,source,path:relative,bytes:bytes.length,sha256:sha(bytes)});}
for(const name of ['index.html','style.css','config.example.json','src/app.mjs','src/core.mjs','src/portal.mjs','src/google-auth.mjs','tests/core.test.mjs','tests/google-auth.test.mjs','tests/google-auth-boundaries.test.mjs'])copy(path.join(portal,name),'frontend/'+name,'requested-change');
const prior=path.join(os.homedir(),'.codex/tmp/google-signup-1791510976210-07797998');
for(const name of ['index.html','style.css','src/app.mjs','src/portal.mjs','src/google-auth.mjs','tests/google-auth.test.mjs','tests/google-auth-boundaries.test.mjs'])copy(path.join(prior,'frontend',name),'reviewed-v1/'+name,'previous-official-review');
for(const [source,name] of [['core.before.mjs','src/core.mjs'],['core.test.before.mjs','tests/core.test.mjs'],['config.example.before.json','config.example.json']])copy(path.join(os.homedir(),'.codex/tmp/google-phone-readiness-20261009-r1',source),'reviewed-v1/'+name,'preexisting-dirty-preserved');
const priorV2=path.join(os.homedir(),'.codex/tmp/google-signup-1791512945214-747118cf');
for(const name of ['config.example.json','src/core.mjs','src/portal.mjs','src/google-auth.mjs','tests/core.test.mjs','tests/google-auth.test.mjs','tests/google-auth-boundaries.test.mjs'])copy(path.join(priorV2,'frontend',name),'reviewed-v2/'+name,'previous-official-review');
for(const name of ['portal.mjs','app.mjs'])copy(path.join(root,'.tmp/google-signup-20261009/before',name),'before/'+name,'preexisting-dirty-preserved');
copy(path.join(root,'.tmp/google-signup-20261009/before/existing.patch'),'before/existing.patch','preexisting-dirty-preserved');
for(const name of ['lib/synk-auth.js','lib/synk-store.js','lib/synk-server.js','lib/release-policy.js','supabase/functions/synk-account/index.ts','tests/google-registration.test.js','tests/synk-server.test.js'])copy(path.join(talk,name),'backend/'+name,'backend-local');
const backendManifest=path.join(os.homedir(),'.codex/tmp/google-registration-be-20261009-r1-c5a224/v2/manifest.json');
const backend=JSON.parse(fs.readFileSync(backendManifest,'utf8'));
for(const file of backend.files){if(sha(fs.readFileSync(path.join(talk,file.path)))!==file.sha256)throw Error('Backend source drift: '+file.path);}
copy(backendManifest,'backend-evidence/manifest.json','backend-evidence');
copy(path.join(path.dirname(backendManifest),'validation.tap'),'backend-evidence/validation.tap','backend-evidence');
for(const name of ['lib/synk-auth.js','lib/synk-store.js','lib/synk-server.js'])copy(path.join(path.dirname(backendManifest),'../before',path.basename(name)),'backend-before/'+name,'backend-preexisting-dirty-preserved');
const esbuild=require(path.join(portal,'node_modules/esbuild'));
const built=esbuild.buildSync({absWorkingDir:portal,entryPoints:['src/app.mjs'],bundle:true,write:false,metafile:true,platform:'browser',format:'iife',target:['es2022'],charset:'utf8',minifyWhitespace:true});
const artifact=built.outputFiles[0].contents;
fs.mkdirSync(path.join(candidate,'artifacts/dist'),{recursive:true});fs.writeFileSync(path.join(candidate,'artifacts/dist/app.js'),artifact);
const inputs=Object.keys(built.metafile.inputs).map(name=>{const source=path.resolve(portal,name),relative=path.relative(root,source);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unexpected input outside root: '+source);copy(source,'bundle-inputs/'+relative,'exact-bundle-input');return {source,sha256:sha(fs.readFileSync(source))};});
for(const name of ['AGENTS.md','docs/AI_운영원칙.md'])copy(path.join(root,name),'instructions/'+path.basename(name),'instructions');
for(const name of ['GOOGLE-SMS-SETUP.md','GOOGLE-REGISTRATION-NOTICE.md','SERVER-CONSUMERS.md'])if(fs.existsSync(path.join(qa,name)))copy(path.join(qa,name),'operations/'+name,'operations');
for(const name of ['auth-final.tap','browser/result.json','browser/README.md','browser/visual-review.json','sdk-browser/result.json','sdk-browser/README.md','sdk-browser/visual-review.json','claude-review.json','claude-delta-review.json','review-status.json'])if(fs.existsSync(path.join(qa,name)))copy(path.join(qa,name),'validation/'+name,'validation');
const manifest={version:1,status:'local_unpublished_candidate_not_a_public_release',createdAt:new Date().toISOString(),candidate,files,inputs,artifact:{path:'artifacts/dist/app.js',bytes:artifact.length,sha256:sha(artifact)},sharedDistModified:false,external:{deployed:false,googleEnabled:false,phoneEnabled:false,smsSent:0},backendTests:backend.tests,remaining:['Google OAuth credentials and manual-linking configuration','SMS provider account, sender and explicit cost approval','Privacy notice provider details','Rebundle and deploy every consumer of canonical auth/store from the exact approved current release base','Public portal release and real Google/SMS/account continuity verification']};
fs.writeFileSync(path.join(candidate,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(qa,'candidate-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
process.stdout.write(JSON.stringify({candidate,files:files.length,inputs:inputs.length,artifact:manifest.artifact})+'\n');
