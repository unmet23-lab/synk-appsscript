'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {writeJSON}=require('./monitor.cjs');
const NAME='synk-three-flows';
function needsScheduleEdit(item,root) {
  return item.schedule?.kind!=='interval'||item.schedule?.minutes!==5||item.script!=='synk_automation.py'
    ||item.no_agent!==true||item.deliver!=='local'||item.failure_deliver!=='local'||item.workdir!==root;
}
function jobs(home) {
  const file=path.join(home,'cron/jobs.json');
  if(!fs.existsSync(file)) return [];
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  const rows=Array.isArray(raw)?raw:raw.jobs;
  if(!Array.isArray(rows)) throw new Error('Unknown official cron storage shape.');
  return rows;
}
function main() {
  const home=path.join(process.env.LOCALAPPDATA,'hermes'),root=path.resolve(__dirname,'../..');
  const apply=process.argv.includes('--apply'),enable=process.argv.includes('--enable');
  let installLock;
  if(apply) {
    const folder=path.join(home,'runtime/synk-automation');fs.mkdirSync(folder,{recursive:true});
    installLock=path.join(folder,'install.lock');
    const fd=fs.openSync(installLock,'wx',0o600);fs.writeFileSync(fd,String(process.pid));fs.closeSync(fd);
  }
  try {
  const YAML=require(path.join(home,'hermes-agent/node_modules/yaml'));
  const config=YAML.parse(fs.readFileSync(path.join(home,'config.yaml'),'utf8'));
  const routes=Object.keys(config.platforms?.telegram?.channel_overrides||{});
  if(routes.length!==1 || !/^\d+$/.test(routes[0])) throw new Error('Existing private Telegram route unavailable.');
  const before=jobs(home).filter(j=>j.name===NAME);
  if(before.length>1) throw new Error('Duplicate named schedules; refusing another schedule.');
  const destination=path.join(home,'scripts/synk_automation.py');
  const originals=['monitor.cjs','overview.cjs','status.cjs','workspace.cjs','validation.cjs','validation-preview.cjs','validation-data.cjs','validation-python.cjs','validation-python.py','validation-web.cjs','integration.cjs','integration-windows.ps1','plugin/__init__.py','plugin/plugin.yaml','automation.py'].map(x=>path.join(__dirname,x));
  const shared=['tools/운영홈.js','tools/operations-home/resume.js','tools/operations-home/native-status.js','tools/참고카드_목록.js','tools/server-backup/read-status.cjs','tools/모델정책.js'].map(x=>path.join(root,x));
  const native=['pyproject.toml','gateway/session_context.py'].map(x=>path.join(home,'hermes-agent',x));
  const files=[...originals,...shared,...native];
  for(const file of files) if(!fs.statSync(file).isFile()) throw new Error('Source contract file missing: '+path.basename(file));
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const plan={version:1,notification_policy:'attention_only_v1',node:process.execPath,monitor:path.join(__dirname,'monitor.cjs'),recipient:routes[0],files:files.map(file=>({path:file,sha256:hash(file)}))};
  const receipt={applied:apply,enabled:enable,name:NAME,noAgent:true,pollMinutes:5,notificationPolicy:'attention_only_v1',dailyDigest:false,existingSchedules:before.length,contractFiles:files.length};
  if(apply) {
    const folder=path.join(home,'runtime/synk-automation');fs.mkdirSync(folder,{recursive:true});
    const backup=path.join(home,'backups','synk-automation-'+Date.now());fs.mkdirSync(backup,{recursive:true});
    for(const [source,label] of [[destination,'script.py'],[path.join(folder,'config.json'),'config.json']]) if(fs.existsSync(source)) fs.copyFileSync(source,path.join(backup,label));
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(path.join(__dirname,'automation.py'),destination);
    plan.files.push({path:destination,sha256:hash(destination)});
    writeJSON(path.join(folder,'config.json'),plan);
    const cli=path.join(home,'bin/hermes.exe');
    const run=args=>{const out=spawnSync(cli,args,{encoding:'utf8',windowsHide:true,timeout:60000,env:{...process.env,HERMES_HOME:home}});if(out.error||out.status) throw new Error('Official cron command failed: '+args.slice(0,2).join(' '));};
    if(!before.length) run(['cron','create','every 5m','--name',NAME,'--script','synk_automation.py','--no-agent','--deliver','local','--failure-deliver','local','--workdir',root,'--paused','--paused-reason','Verify sources and delivery before activation']);
    const found=jobs(home).filter(j=>j.name===NAME);if(found.length!==1) throw new Error('Official schedule creation could not be confirmed.');
    const item=found[0];
    if(item.no_agent!==true || !['synk_automation.py',destination].includes(item.script) || item.deliver!=='local') throw new Error('Existing schedule ownership contract differs; left unchanged.');
    if(before.length && needsScheduleEdit(item,root)) run(['cron','edit',item.id,'--schedule','every 5m','--no-agent','--script','synk_automation.py','--deliver','local','--failure-deliver','local','--workdir',root]);
    receipt.jobId=item.id;
    if(enable && item.enabled!==true) run(['cron','resume',item.id]);
    receipt.backup=path.relative(home,backup);
    writeJSON(path.join(backup,'receipt.json'),receipt);
  }
  console.log(JSON.stringify(receipt,null,2));
  } finally {if(installLock)fs.unlinkSync(installLock);}
}
module.exports={jobs,NAME,needsScheduleEdit};
if(require.main===module)main();
