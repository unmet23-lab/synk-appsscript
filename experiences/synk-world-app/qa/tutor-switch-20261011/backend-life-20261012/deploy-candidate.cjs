'use strict';
// This release tool changes only synk-play, from the reviewed isolated Git HEAD.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..'),out=path.join(root,'.tmp/tutor-life-backend-20261012'),talk=path.resolve(root,'../SYNK-talk');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'release-manifest.json'),'utf8'));
const {readEszip}=require(path.join(root,'experiences/beginner-games/qa/account-sync/wardrobe-production-20261009/operation-sources/eszip-read.cjs'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),file=name=>path.join(__dirname,name);
const save=(name,value)=>{if(fs.existsSync(file(name)))throw Error('EXISTING_OPERATION_RECORD:'+name);fs.writeFileSync(file(name),JSON.stringify(value,null,2)+'\n');};
const credentials=require(path.join(talk,'lib/자격증명.js'));
process.env.SUPABASE_PROJECT_REF=credentials.운영REF;
const env=credentials.읽기('튜터생활진도허용키반영',{args:['--운영']});
if(env.SUPABASE_PROJECT_REF!=='qiwxeddwwnzkwalpsuty')throw Error('WRONG_TARGET');
const api='https://api.supabase.com/v1/projects/'+env.SUPABASE_PROJECT_REF;
async function get(suffix,bytes=false){const r=await fetch(api+suffix,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},redirect:'error',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('READ_HTTP_'+r.status);return bytes?Buffer.from(await r.arrayBuffer()):r.json();}
const meta=rows=>rows.map(f=>({slug:f.slug,version:f.version,status:f.status,verify_jwt:f.verify_jwt,updated_at:f.updated_at})).sort((a,b)=>a.slug.localeCompare(b.slug));
(async()=>{
 if(fs.existsSync(file('deployment.json')))throw Error('DEPLOYMENT_ALREADY_RECORDED');
 if(cp.execFileSync('git',['rev-parse','HEAD'],{cwd:manifest.worktree,encoding:'utf8'}).trim()!==manifest.head)throw Error('HEAD_DRIFT');
 const bundle=require(path.join(manifest.worktree,'tools/원격배포.js')).배포묶음(path.join(manifest.worktree,'supabase/functions/synk-play'));
 if(Object.keys(bundle).length!==2||manifest.files.some(f=>sha(Buffer.from(bundle[f.name]))!==f.sha256))throw Error('PAYLOAD_DRIFT');
 const beforeFunctions=meta(await get('/functions')),before=beforeFunctions.find(f=>f.slug==='synk-play'),beforeBody=await get('/functions/synk-play/body',true);
 if(before.version!==9||before.status!=='ACTIVE'||before.verify_jwt!==true||sha(beforeBody)!==manifest.sourceProof.baseline.bodySHA256)throw Error('REMOTE_BASELINE_DRIFT');
 save('predeploy.json',{at:new Date().toISOString(),project:env.SUPABASE_PROJECT_REF,head:manifest.head,before,bodySHA256:sha(beforeBody),files:manifest.files,accountRowsRead:0,authSettingsRead:0});
 const result=cp.spawnSync(process.execPath,[path.join(manifest.worktree,'tools/원격배포.js'),'supabase/functions/synk-play','--적용','--운영'],{cwd:manifest.worktree,windowsHide:true,timeout:180000,maxBuffer:3e6,encoding:'utf8',env:{...process.env,SUPABASE_PROJECT_REF:env.SUPABASE_PROJECT_REF,SUPABASE_ACCESS_TOKEN:env.SUPABASE_ACCESS_TOKEN,SUPABASE_TOKEN_EXPIRES:env.SUPABASE_TOKEN_EXPIRES}});
 const log=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(file('deploy-tool.txt'),log);
 save('deployment.json',{at:new Date().toISOString(),head:manifest.head,exitCode:result.status,signal:result.signal,error:result.error?.code||null,tool:'standard tools/원격배포.js',scope:'One function deployment; standard schema-version SELECT preflight; no database writes or auth/secret changes',logSHA256:sha(log)});
 if(result.status!==0)throw Error('STANDARD_DEPLOY_FAILED:'+result.status);
 const afterFunctions=meta(await get('/functions')),after=afterFunctions.find(f=>f.slug==='synk-play'),afterBody=await get('/functions/synk-play/body',true);
 fs.writeFileSync(file('synk-play-deployed.eszip'),afterBody);
 const original=readEszip(beforeBody),deployed=readEszip(afterBody),checks=[];
 checks.push({name:'function ACTIVE and JWT policy unchanged',pass:after.status==='ACTIVE'&&after.verify_jwt===before.verify_jwt&&after.version>before.version});
 checks.push({name:'same exact module set',pass:JSON.stringify([...original.keys()].sort())===JSON.stringify([...deployed.keys()].sort())});
 for(const [name,module]of deployed){const previous=original.get(name),expected=name==='source/synk-play-runtime.mjs'?Buffer.from(bundle['synk-play-runtime.mjs']):previous?.source;checks.push({name:name+' complete source matches',pass:!!expected&&module.source.equals(expected),sha256:sha(module.source)});}
 checks.push({name:'unrelated function metadata unchanged',pass:JSON.stringify(beforeFunctions.filter(f=>f.slug!=='synk-play'))===JSON.stringify(afterFunctions.filter(f=>f.slug!=='synk-play'))});
 checks.push({name:'entrypoint original TypeScript is unchanged',pass:JSON.parse(deployed.get('source/index.ts').sourceMap.toString('utf8')).sourcesContent[0]===bundle['index.ts']});
 const report={at:new Date().toISOString(),scope:'Management API code/metadata verification only; no account or student records read',head:manifest.head,before,after,bodyBytes:afterBody.length,bodySHA256:sha(afterBody),checks,passed:checks.filter(c=>c.pass).length,total:checks.length,allPassed:checks.every(c=>c.pass),databaseWrites:0,authOrSecretChanges:0,accountRowsRead:0,rollback:path.join(out,'synk-play-v9.rollback.eszip')};
 save('postdeploy.json',report);if(!report.allPassed)throw Error('DEPLOYMENT_VERIFICATION_FAILED');
 console.log(JSON.stringify({deployed:after,head:manifest.head,passed:report.passed,total:report.total,bodySHA256:report.bodySHA256,report:file('postdeploy.json')}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
