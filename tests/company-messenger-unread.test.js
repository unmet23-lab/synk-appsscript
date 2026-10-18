'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('messenger unread visibility and query regressions run in the default test suite',()=>{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test','--test-reporter=tap','tools/company-messenger/tests/notification-unread-count.test.mjs'],{cwd:path.resolve(__dirname,'..'),env,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024,windowsHide:true});
  assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/^# tests 8\s*$/m);assert.match(result.stdout,/^# pass 8\s*$/m);assert.match(result.stdout,/^# fail 0\s*$/m);assert.match(result.stdout,/^# skipped 0\s*$/m);
});
