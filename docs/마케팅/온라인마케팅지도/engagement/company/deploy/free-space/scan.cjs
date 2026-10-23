'use strict';
// 회사 DB 빈 칸 잔여 재기(읽기 전용)와 한 번 정리(VACUUM, 승인 뒤) — 이 PC에서 쓰기 노드로(README).
//   node scan.cjs <이름표> [--out <파일>]                          읽기 전용: 빈 페이지·페이지 안 빈 칸·WAL의 문의 잔여 수
//   node scan.cjs <이름표> --vacuum --approval <승인 파일> [--out …]  VACUUM 앞뒤 수(릴리스 잠금·백업 중이면 하지 않음)
// 신원·주소 조회·SSH는 tools/server-backup/read-status.cjs와 같다(호스트 키 고정, 주소는 Compute에서 읽음).
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const PROJECT='synk-bake-unmet27';
// 요약과 판정 — free-space.test.mjs가 불러 본다.
// 빈 칸(freelist·inPage)의 Live는 산 줄의 사본 — 그 줄을 지우면 잔여가 되므로 「copies」로 따로 보인다.
// 덜 쓴 WAL 꼬리(walTorn)는 칸 경계를 믿을 수 없어, 빈 칸처럼 표식이 하나라도 있으면 깨끗하지 않다고 본다.
const STRICT=['freelist','inPage','walTorn'];
const parts=s=>Object.entries(s?.residue||{}).filter(([,x])=>x&&typeof x==='object');
const brief=s=>s&&{error:s.error,code:s.code,freePages:s.pragma?.freelist_count,pages:s.pragma?.page_count,dbBytes:s.files?.db,walBytes:s.files?.wal,inquiries:s.inquiries,
  skipped:s.residue?.skipped,attempts:s.residue?.attempts,changedDuringScan:s.residue?.changedDuringScan,fragmentBytes:s.residue?.fragmentBytes,
  residue:Object.fromEntries(parts(s).map(([k,x])=>[k,{payloadResidue:x.payloadResidue,draftResidue:x.draftResidue,undecided:x.payloadShort+x.draftShort,
    ...(STRICT.includes(k)?{copies:x.payloadLive+x.draftLive,nonzeroBytes:x.nonzeroBytes}:{})}]))};
// 판정할 수 있었는가: 잔여를 세었고(메모리 부족으로 건너뛰지 않았고) 조용한 한 번에 읽었다.
const decided=s=>!!s?.residue&&!s.residue.skipped&&!s.residue.changedDuringScan;
// 정리가 끝났다고 볼 때: 빈 페이지 0, 어디에도 잔여 0, 빈 칸·덜 쓴 꼬리에는 산 줄 사본도 판정 못 한 조각도 없고 0 아닌 바이트도 없다.
// 표식 없는 옛 바이트도 정리 대상이다 — 표식만 보면 그것이 남아도 깨끗하다고 나온다(10-23 GPT GA2). 세지 못한 칸(nonzeroBytes 없음)도 깨끗하지 않다.
// 셀 사이 1~3바이트 조각(fragmentBytes)은 자리를 몰라 표식을 볼 수 없으니 0이어야 한다(셋째 GA2). 그 수가 없는 옛 결과도 깨끗하지 않다.
const clean=s=>decided(s)&&s.pragma?.freelist_count===0&&s.residue?.fragmentBytes===0&&
  parts(s).every(([k,x])=>x.payloadResidue+x.draftResidue===0&&(!STRICT.includes(k)||(x.payloadLive+x.draftLive+x.payloadShort+x.draftShort===0&&x.nonzeroBytes===0)));
module.exports={brief,decided,clean};
if(require.main===module)main();

function main(){
const REPO=path.resolve(__dirname,'../../../../../../..');
const policy=require(path.join(REPO,'tools/모델정책.js'));
const {NODES}=require(path.join(REPO,'tools/server-backup/read-status.cjs'));
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]||'';};
const label=args[0],vacuum=args.includes('--vacuum'),out=flag('--out'),approvalFile=flag('--approval');
if(!/^[a-z0-9-]{1,40}$/.test(label||'')){console.error('사용: node scan.cjs <이름표> [--vacuum --approval <승인 파일>] [--out <파일>]');process.exit(2);}
// 결과 파일은 덮지 않는다. 원격 일을 하기 전에 먼저 본다(VACUUM 뒤에 쓰기가 실패해 결과를 잃지 않게).
if(out&&fs.existsSync(out)){console.error('--out 파일이 이미 있습니다: '+out);process.exit(2);}
let approval=null;
if(vacuum){
  // 운영 DB 파일을 다시 쓰는 일이라 유호님 승인 문장(대상·시간·끊김)을 파일로 받아 해시를 결과에 남긴다.
  const text=approvalFile&&fs.existsSync(approvalFile)?fs.readFileSync(approvalFile,'utf8').trim():'';
  if(text.length<10){console.error('--vacuum은 유호님 승인 문장을 담은 --approval 파일이 있어야 합니다.');process.exit(2);}
  approval={file:path.basename(approvalFile),sha256:crypto.createHash('sha256').update(text).digest('hex')};
}
let script=fs.readFileSync(path.join(__dirname,'free-space-node.py'),'utf8');
if(vacuum){const js=fs.readFileSync(path.join(__dirname,'vacuum.mjs'),'utf8');if(!script.includes('\nVACUUM_JS = None'))throw Error('VACUUM_SLOT_MISSING');script=script.replace('\nVACUUM_JS = None',()=>'\nVACUUM_JS = '+JSON.stringify(js));}
(async()=>{
  if(policy.벌텍스프로젝트()!==PROJECT)throw Error('PROJECT_MISMATCH');
  const token=await policy.벌텍스토큰(),result=[];
  for(const n of NODES.filter(x=>x.alias==='synk-company-1'||x.alias==='synk-company-2')){
    const r=await fetch(`https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${n.zone}/instances/${n.name}`,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!r.ok){result.push({node:n.name,error:'NODE_METADATA_FAILED '+r.status});continue;}
    const v=await r.json(),address=v.networkInterfaces?.find(x=>x.name==='nic0')?.accessConfigs?.[0]?.natIP;
    if(v.id!==n.id||v.status!=='RUNNING'||!address){result.push({node:n.name,error:'NODE_NOT_READY '+v.status});continue;}
    const known=path.join(os.tmpdir(),'synk-free-space-'+n.alias+'-hostkey');
    fs.writeFileSync(known,n.alias+' '+n.hostKey+'\n');
    // 쓰기 노드(회사 DB가 붙은 쪽)만 일을 한다. 다른 노드는 hasDb:false로 바로 끝난다.
    const p=spawnSync('ssh',['-i',path.join(os.homedir(),'.ssh',n.key),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+known.split(path.sep).join('/'),'-o','HostKeyAlias='+n.alias,'-o','CheckHostIP=no','-o','ConnectTimeout=15','synk@'+address,'sudo -n python3 - '+(vacuum?'vacuum':'scan')],
      {input:script,encoding:'utf8',timeout:900000,windowsHide:true,maxBuffer:16<<20});
    if(p.status!==0){result.push({node:n.name,error:'SSH_OR_RUN_FAILED',stderr:(p.stderr||'').slice(-400)});continue;}
    try{result.push({node:n.name,...JSON.parse(p.stdout)});}catch{result.push({node:n.name,error:'BAD_OUTPUT',out:(p.stdout||'').slice(0,300)});}
    if(vacuum&&result.at(-1).hasDb)break;  // 한 번만
  }
  const record={label,mode:vacuum?'vacuum':'scan',approval,checkedAt:new Date().toISOString(),result};
  if(out)try{fs.writeFileSync(out,JSON.stringify(record,null,1)+'\n',{flag:'wx'});}catch(e){console.error('결과 파일을 쓰지 못했습니다('+e.code+') — 아래 요약과 전체 결과:');console.error(JSON.stringify(record));process.exitCode=1;}
  const w=result.find(x=>x.hasDb);
  console.log(JSON.stringify({label,writer:w?.node||null,...(vacuum?{error:w?.error,before:brief(w?.before),vacuum:w?.vacuum,after:brief(w?.after),afterClean:clean(w?.after)}:{...brief(w),decided:decided(w)}),
    errors:result.filter(x=>x.error).map(x=>x.node+' '+x.error)},null,1));
  if(!w||w.error||(!vacuum&&!decided(w))||(vacuum&&(w.vacuum?.exit!==0||w.vacuum?.quickCheck!=='ok'||w.vacuum?.walTruncated!==true||!clean(w.after))))process.exitCode=1;
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
}
