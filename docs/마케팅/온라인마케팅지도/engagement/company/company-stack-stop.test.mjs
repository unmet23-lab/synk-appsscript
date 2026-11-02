import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
const unix=value=>value.replaceAll('\\','/').replace(/^([A-Za-z]):/,(_,letter)=>'/'+letter.toLowerCase());
function fixture(t,failAt=''){
  const dir=mkdtempSync(join(tmpdir(),'synk-stack-stop-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  copyFileSync(fileURLToPath(new URL('./deploy/company-stack.sh',import.meta.url)),join(dir,'company-stack.sh'));
  writeFileSync(join(dir,'cloud-common.sh'),`compose() {
  printf '%s\\n' "$*" >> "$STOP_CALLS"
  [[ "$*" != "$STOP_FAIL_AT" ]]
}
event() { printf '%s\\n' "$1"; }
fail() { printf '%s\\n' "$1" >&2; exit 1; }
`);
  const result=spawnSync(bash,[unix(join(dir,'company-stack.sh')),'stop'],{encoding:'utf8',timeout:15000,windowsHide:true,env:{...process.env,MSYS_NO_PATHCONV:'1',STOP_CALLS:unix(join(dir,'calls')),STOP_FAIL_AT:failAt}});
  return {...result,calls:readFileSync(join(dir,'calls'),'utf8').trim().split('\n')};
}
test('stack stop closes the upstream before stopping the dependent HTTPS proxy',t=>{
  const r=fixture(t);assert.equal(r.status,0,r.stderr);assert.deepEqual(r.calls,['stop --timeout 60 company','stop --timeout 60']);assert.match(r.stdout,/STACK_STOPPED/);
});
test('failed upstream shutdown does not start the proxy-first wait or report success',t=>{
  const r=fixture(t,'stop --timeout 60 company');assert.equal(r.status,1);assert.deepEqual(r.calls,['stop --timeout 60 company']);assert.match(r.stderr,/COMPANY_STOP_FAILED/);assert.doesNotMatch(r.stdout,/STACK_STOPPED/);
});
test('a failure stopping the rest of the stack still fails the operation',t=>{
  const r=fixture(t,'stop --timeout 60');assert.equal(r.status,1);assert.equal(r.calls.length,2);assert.match(r.stderr,/STACK_STOP_FAILED/);assert.doesNotMatch(r.stdout,/STACK_STOPPED/);
});
