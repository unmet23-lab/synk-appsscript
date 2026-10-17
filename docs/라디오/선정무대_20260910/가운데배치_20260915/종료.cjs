'use strict';
// 사용자 요청에 따라 radio-live만 일시 정지한다. disable/delete는 하지 않아 같은 설정으로 다시 시작할 수 있다.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const dir=__dirname,key=path.join(os.homedir(),'.ssh/synk_radio');
const code=String.raw`
const cp=require('child_process');
const read=()=>Object.fromEntries(cp.execFileSync('systemctl',['show','radio-live','--property=MainPID,ActiveState,SubState,UnitFileState'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const before=read();
cp.execFileSync('sudo',['-n','systemctl','stop','radio-live']);
const after=read();
console.log(JSON.stringify({at:new Date().toISOString(),action:'stop radio-live',before,after,recoverableWith:'sudo systemctl start radio-live'}));
`;
const result=JSON.parse(execFileSync('ssh',['-i',key,'synk-radio','node'],{input:code,encoding:'utf8',timeout:60000,windowsHide:true}));
assert.equal(result.after.ActiveState,'inactive');assert.equal(result.after.SubState,'dead');assert.equal(result.after.MainPID,'0');
fs.writeFileSync(path.join(dir,'종료확인.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
