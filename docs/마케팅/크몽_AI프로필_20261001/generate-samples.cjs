// 기존 유호 원본 3장만 사용한다. 계정 구매/얼굴 학습/기존 모델 교체는 하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const here = __dirname;
const plan = JSON.parse(fs.readFileSync(path.join(here,'samples.json'),'utf8'));
const cli = path.join(process.env.APPDATA,'npm','higgsfield.exe');
fs.mkdirSync(path.join(here,'jobs'),{recursive:true});
fs.mkdirSync(path.join(here,'samples'),{recursive:true});
for (const sample of plan.samples) {
  const record = path.join(here,'jobs',sample.id+'.json');
  if (fs.existsSync(record)) { console.log(sample.id+': existing record; inspect before retry'); continue; }
  const refs = plan.references.flatMap(f=>['--image',path.resolve(here,plan.source,f)]);
  const args = ['generate','create',plan.model,'--prompt',plan.identityInstruction+' '+sample.scene,...refs,'--aspect_ratio',plan.aspectRatio,'--resolution',plan.resolution,'--wait','--wait-timeout','10m','--json'];
  const result = spawnSync(cli,args,{encoding:'utf8',windowsHide:true,timeout:660000,maxBuffer:16*1024*1024});
  fs.writeFileSync(record,result.stdout || '{}');
  if (result.stderr) fs.writeFileSync(path.join(here,'jobs',sample.id+'.log'),result.stderr);
  console.log(sample.id+': CLI '+result.status);
  if (result.status !== 0 || result.error) { console.log(String(result.error || result.stderr).slice(0,500)); process.exitCode=1; break; }
}
