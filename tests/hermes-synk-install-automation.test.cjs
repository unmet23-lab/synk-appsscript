const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {needsScheduleEdit,contractCheck}=require('../tools/hermes-synk/install-automation.cjs');
test('refreshing the source manifest preserves an unchanged official schedule',()=>{
  const job={schedule:{kind:'interval',minutes:5},script:'synk_automation.py',no_agent:true,deliver:'local',failure_deliver:'local',workdir:'C:/fixture'};
  assert.equal(needsScheduleEdit(job,'C:/fixture'),false);
  assert.equal(needsScheduleEdit({...job,schedule:{kind:'interval',minutes:10}},'C:/fixture'),true);
  assert.equal(needsScheduleEdit({...job,failure_deliver:'origin'},'C:/fixture'),true);
});

test('workdir in another path spelling is the same folder, so the ops-copy refresh does not edit the schedule every round',()=>{
  const job={schedule:{kind:'interval',minutes:5},script:'synk_automation.py',no_agent:true,deliver:'local',failure_deliver:'local',workdir:'C:/Fixture/Repo'};
  assert.equal(needsScheduleEdit(job,path.resolve('C:/fixture/repo')),false);
  assert.equal(needsScheduleEdit({...job,workdir:''},'C:/fixture/repo'),true);
});

// The contract check compares content by path inside the pinned checkout, so moving the pin from the main checkout to the ops copy
// is "moved" with no content differences, while a changed file, an extra pin, a changed installed script or a Hermes upgrade are reported.
test('contractCheck separates a moved pin from changed content and flags Hermes-side changes',t=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'synk-contract-'));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const put=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);return file;};
  const home=path.join(base,'hermes'),main=path.join(base,'main'),ops=path.join(base,'ops');
  for(const root of [main,ops]) { put(path.join(root,'tools/hermes-synk/monitor.cjs'),'monitor'); put(path.join(root,'tools/hermes-synk/overview.cjs'),'overview'); put(path.join(root,'tools/hermes-synk/automation.py'),'checker'); }
  const native=[put(path.join(home,'hermes-agent/pyproject.toml'),'v1')];
  const destination=put(path.join(home,'scripts/synk_automation.py'),'checker');
  const planFor=root=>({node:'node',recipient:'1',notification_policy:'attention_only_v1',monitor:path.join(root,'tools/hermes-synk/monitor.cjs'),
    files:[...['monitor.cjs','overview.cjs','automation.py'].map(x=>path.join(root,'tools/hermes-synk',x)),...native].map(file=>({path:file,sha256:hash(file)}))});
  const pin=root=>{ const p=planFor(root); put(path.join(home,'runtime/synk-automation/config.json'),JSON.stringify({...p,files:[...p.files,{path:destination,sha256:hash(destination)}]})); };
  const job=root=>({schedule:{kind:'interval',minutes:5},script:'synk_automation.py',no_agent:true,deliver:'local',failure_deliver:'local',workdir:root});
  const check=(root,j=job(root))=>contractCheck({home,root,plan:planFor(root),native,destination,job:j,hash});
  pin(ops);
  assert.deepEqual(check(ops),{inSync:true,nativeChanged:false,differs:[],moved:false,schedule:'같음',root:ops});
  pin(main);
  const moved=check(ops);
  assert.equal(moved.inSync,false);
  assert.equal(moved.moved,true);
  assert.deepEqual(moved.differs,[],'same content under another checkout is only a move');
  assert.equal(check(ops,job(main)).schedule,'다시 잡을 것');
  pin(ops);
  put(path.join(ops,'tools/hermes-synk/overview.cjs'),'overview v2');
  assert.deepEqual(check(ops).differs,['tools/hermes-synk/overview.cjs']);
  put(path.join(ops,'tools/hermes-synk/automation.py'),'checker v2');
  assert.deepEqual(check(ops).differs.sort(),['tools/hermes-synk/automation.py','tools/hermes-synk/overview.cjs','synk_automation.py'].sort(),'a new checker also differs from the installed copy pin');
  put(destination,'checker v2');
  pin(ops);
  put(destination,'edited by hand');
  assert.deepEqual(check(ops).differs,['설치된 감시 스크립트']);
  put(destination,'checker v2');
  put(native[0],'v2');
  assert.equal(check(ops).nativeChanged,true);
  pin(ops);
  const config=JSON.parse(fs.readFileSync(path.join(home,'runtime/synk-automation/config.json'),'utf8'));
  config.files.push({path:path.join(ops,'tools/old.cjs'),sha256:'0'.repeat(64)});
  fs.writeFileSync(path.join(home,'runtime/synk-automation/config.json'),JSON.stringify(config));
  assert.deepEqual(check(ops).differs,['없앨 고정: tools/old.cjs']);
});
