import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const company='docs/마케팅/온라인마케팅지도/engagement/company';
const inputs=[company+'/workspace-restore-acceptance.mjs',company+'/workspace-restore-acceptance.test.mjs',company+'/workspace-backup.mjs',company+'/workroom-practice-sync-service.mjs',company+'/store.mjs','tools/company-messenger/server.mjs',relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/')];
const sha=value=>createHash('sha256').update(value).digest('hex');
async function hashes(){return Promise.all(inputs.map(async path=>({path,sha256:sha(await readFile(join(root,path)))})));}
await mkdir(here,{recursive:true});const before=await hashes();
const env={...process.env};for(const name of Object.keys(env))if(name.startsWith('SYNK_')||name.startsWith('MESSENGER_'))delete env[name];
let result,failed=false;try{result=await run(process.execPath,['--no-warnings','--test','--test-reporter=tap',company+'/workspace-restore-acceptance.test.mjs'],{cwd:root,env,maxBuffer:4000000});}catch(error){result=error;failed=true;}
const output=result.stdout+'\n'+(result.stderr||'');await writeFile(join(here,'recovery-tests.txt'),output);
const after=await hashes(),changed=before.filter((row,i)=>row.sha256!==after[i].sha256).map(row=>row.path);
const numbers=Object.fromEntries(['tests','pass','fail','skipped'].map(name=>[name,Number(output.match(new RegExp('^# '+name+' (\\d+)','m'))?.[1]??-1)]));
const report={version:1,checkedAt:new Date().toISOString(),status:!failed&&numbers.fail===0&&changed.length===0?'synthetic-offline-recovery-acceptance-verified':'failed',scope:'synthetic backups created by existing backupWorkspace; no operating account or server touched',tests:numbers,sources:after,sourceChangesDuringRun:changed,testLog:{path:'recovery-tests.txt',sha256:sha(output)},verified:['latest complete stopped synthetic backup copied to a new directory only after acceptance','stale pre-deletion backup rejected with later edit/deletion and messenger changes','two independent identical historical copies report equality only, never independently verified latestness','exact same physical snapshot rejected','missing/incorrect key does not generate or overwrite a key','SQLite immutable read-only input preserves source files including WAL/SHM','complete markers, both DB logical rows, key readability and equality, identity links and local file bytes checked','reports and CLI errors omit account IDs, body, ciphertext, credentials and key hashes','existing/overlapping destinations rejected and no host auto-started'],notExecuted:['actual production deployment environment','actual live snapshot and stop evidence','physical PC/phone account verification','opening operating traffic'],boundaries:{latestnessIsExternalOperatorEvidence:true,latestnessIndependentlyVerified:false,productionTrafficAllowed:false,markerIsAdvisoryAndNotServerEnforced:true,serverAutoStarted:false,automaticDeletionReplayOrHistoricalMerge:false,atlasCommonEngineChanged:false}};
await writeFile(join(here,'recovery-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,tests:numbers,sourceChangesDuringRun:changed},null,2));if(report.status==='failed')process.exitCode=1;
