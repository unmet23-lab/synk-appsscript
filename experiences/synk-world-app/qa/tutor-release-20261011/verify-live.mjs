import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url)),publication=JSON.parse(fs.readFileSync(path.join(out,'publication.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!publication.published)throw Error('Release not published');
const rows=publication.changes.map(e=>({path:e.path,sha256:e.sha256}));
rows.push(...publication.preservedRuntime);
const results=[],failures=[];let cursor=0;
async function worker(){while(cursor<rows.length){const row=rows[cursor++];let result;for(let attempt=1;attempt<=3;attempt++){try{const url='https://synk.im/'+row.path+'?release='+publication.commit.slice(0,12),r=await fetch(url,{signal:AbortSignal.timeout(40000),headers:{'Cache-Control':'no-cache'}}),bytes=Buffer.from(await r.arrayBuffer());result={...row,status:r.status,actualSha256:sha(bytes),bytes:bytes.length,mime:r.headers.get('content-type'),attempt};result.pass=r.status===200&&result.actualSha256===row.sha256;if(result.pass)break;}catch(e){result={...row,pass:false,attempt,error:e.message};}if(attempt<3)await new Promise(r=>setTimeout(r,1500));}results.push(result);if(!result.pass)failures.push(result);if(results.length%100===0)console.log(JSON.stringify({checked:results.length,of:rows.length,failed:failures.length}));}}
await Promise.all(Array.from({length:8},worker));
const report={at:new Date().toISOString(),commit:publication.commit,sourceCommit:publication.sourceCommit,scope:'Public HTTPS GET comparison of every changed payload and preserved critical runtime; no account/API request',ok:failures.length===0,total:results.length,passed:results.length-failures.length,failures,results};
fs.writeFileSync(path.join(out,'public-http.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,total:report.total,passed:report.passed,failures}));if(failures.length)process.exitCode=1;
