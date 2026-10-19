// Deployed beside an exact snapshot of the company's strict report validator.
// This validates input only. It never imports a report or reads credentials.
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join,resolve} from 'node:path';

export function validateReportContract(report,{validateResearchReport,role,at}={}){
  if(!['full','yt-tt','meta-brand'].includes(role))throw Error('CREATIVE_ROLE_REQUIRED');
  const validated=validateResearchReport(report,at?{at}:undefined);
  if(role==='yt-tt'&&validated.entries.some(e=>!(e.source==='youtube-trends'&&['recent-video','breakout-video'].includes(e.kind)||e.source==='tiktok-top-ads'&&e.kind==='ad')))throw Error('YT_TT_SOURCE_ROLE_MISMATCH');
  if(role==='meta-brand'&&validated.entries.some(e=>!(['facebook','instagram'].includes(e.source)&&['ad','reel'].includes(e.kind))))throw Error('META_BRAND_SOURCE_ROLE_MISMATCH');
  return {valid:true,entries:validated.entries.length};
}

export async function loadPinnedValidator(directory){
  const manifestFile=join(directory,'manifest.json'),info=await lstat(manifestFile);
  if(!info.isFile()||info.isSymbolicLink()||process.platform!=='win32'&&(info.uid!==0||(info.mode&0o022)))throw Error('REPORT_CONTRACT_MANIFEST_UNSAFE');
  const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
  const expected=['creative-research.mjs','organization.mjs','validate-report.mjs'];
  if(manifest.schema!=='synk-argon-report-contract/v1'||!Array.isArray(manifest.files)||manifest.files.length!==expected.length||expected.some(name=>manifest.files.filter(x=>x.name===name).length!==1))throw Error('REPORT_CONTRACT_MANIFEST_INVALID');
  for(const row of manifest.files){
    const file=join(directory,row.name),stat=await lstat(file);
    if(!stat.isFile()||stat.isSymbolicLink()||process.platform!=='win32'&&(stat.uid!==0||(stat.mode&0o022)))throw Error('REPORT_CONTRACT_FILE_UNSAFE');
    const bytes=await readFile(file);
    if(bytes.length!==row.bytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('REPORT_CONTRACT_HASH_MISMATCH');
  }
  const source=await import(pathToFileURL(join(directory,'creative-research.mjs')));
  return source.validateResearchReport;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    let size=0;const chunks=[];
    for await(const chunk of process.stdin){size+=chunk.length;if(size>1024*1024)throw Error('REPORT_CONTRACT_INPUT_TOO_LARGE');chunks.push(chunk);}
    const report=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const validateResearchReport=await loadPinnedValidator(dirname(fileURLToPath(import.meta.url)));
    console.log(JSON.stringify(validateReportContract(report,{validateResearchReport,role:process.argv[2]})));
  }catch(error){
    const message=String(error?.message||'REPORT_CONTRACT_FAILED').replace(/[\u0000-\u001f]/g,' ').slice(0,500);
    console.log(JSON.stringify({valid:false,error:message}));process.exitCode=1;
  }
}
