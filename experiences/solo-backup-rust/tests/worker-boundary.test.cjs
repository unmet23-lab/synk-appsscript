'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
function rejectFrame(payload){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.resolve(__dirname,'../worker/dispatcher.cjs')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='',stderr='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>stderr+=b);
  const timer=setTimeout(()=>{child.kill();reject(Error('Worker did not terminate'));},5000);
  child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve({code,output,stderr});});child.stdin.on('error',()=>{});child.stdin.end(payload);
});}
test('invalid IPC exits without logging request contents',async()=>{
  const result=await rejectFrame('{SECRET_CANARY\n');assert.equal(result.code,1);assert.equal(result.stderr,'');assert.ok(!result.output.includes('SECRET_CANARY'));assert.match(result.output,/INVALID_FRAME/);
});
test('newline-free oversized IPC is rejected before parsing',async()=>{
  const result=await rejectFrame('x'.repeat(131073));assert.equal(result.code,1);assert.match(result.output,/PAYLOAD_TOO_LARGE/);assert.ok(result.output.length<200);
});
test('arbitrary methods cannot launch a process before boot',async()=>{
  const result=await rejectFrame(JSON.stringify({v:1,id:1,method:'spawn',args:['cmd.exe']})+'\n');assert.equal(result.code,1);assert.ok(!result.output.includes('cmd.exe'));
});
