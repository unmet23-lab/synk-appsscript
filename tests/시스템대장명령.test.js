'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../tools/시스템대장.js');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-system-ledger-'));
  t.after(()=>{
    const resolved=fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.match(path.basename(resolved),/^synk-system-ledger-/);
    fs.rmSync(resolved,{recursive:true,force:true});
  });
  return root;
}
function run(root,args){return spawnSync(process.execPath,[script,...args],{cwd:root,env:{...process.env,SYNK_대장_ROOT:root},encoding:'utf8',windowsHide:true,timeout:10000});}
test('retired renderer explains the supported path and cannot report success or write output',t=>{
  const root=fixture(t),result=run(root,['--render']);
  assert.equal(result.status,2);
  assert.match(result.stderr,/더 이상 지원하지 않습니다/);
  assert.match(result.stderr,/docs\/시스템_대장\.md/);
  assert.match(result.stderr,/--check/);
  assert.doesNotMatch(result.stderr,/Cannot find module/);
  assert.equal(result.stdout,'');
  assert.deepEqual(fs.readdirSync(root),[]);
});
test('ledger check still validates the canonical document and help advertises supported commands',t=>{
  const root=fixture(t);fs.mkdirSync(path.join(root,'docs'));
  fs.writeFileSync(path.join(root,'docs/시스템_대장.md'),'# fixture\n## 도구 (내부)\n| 상태 | 시스템 | 한 줄 | 시작 | 최근 |\n|---|---|---|---|---|\n| 🟢 | fixture | 가상 시스템 | v1 | v1 |\n');
  const checked=run(root,['--check']);
  assert.equal(checked.status,0,checked.stderr);
  assert.match(checked.stdout,/형식 문제 0/);
  const help=run(root,[]);
  assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/--check/);assert.match(help.stdout,/--소급/);
  assert.doesNotMatch(help.stdout,/--render/);
});
