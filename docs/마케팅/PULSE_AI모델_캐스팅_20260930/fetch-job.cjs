// 사용: node fetch-job.cjs <job.json> <저장경로>
// Higgsfield --wait --json 결과의 result_url(원본)을 내려받는다. 입력 참조 이미지 주소는 쓰지 않는다.
const fs=require('node:fs');
const [,,jobFile,out]=process.argv;
let job;
try{const j=JSON.parse(fs.readFileSync(jobFile,'utf8'));job=Array.isArray(j)?j[0]:j;}catch(e){console.error('JSON 아님: '+jobFile+' '+fs.readFileSync(jobFile,'utf8').slice(0,300));process.exit(1);}
if(!job||job.status!=='completed'||!job.result_url){console.error('완료 결과 없음: '+jobFile+' status='+(job&&job.status));process.exit(1);}
(async()=>{const r=await fetch(job.result_url);if(!r.ok)throw Error(r.status+' '+job.result_url);fs.writeFileSync(out,Buffer.from(await r.arrayBuffer()));console.log(out,fs.statSync(out).size);})().catch(e=>{console.error(e.message);process.exit(1);});
