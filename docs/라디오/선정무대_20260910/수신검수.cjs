'use strict';
// 기존 tools/라디오수신검수.cjs를 별도 산출물 폴더로 실행한다. 옛 검수 기록 보존.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const source=path.resolve(__dirname,'../../../tools/라디오수신검수.cjs');
const anchor="const out=path.resolve(__dirname,'../docs/_ops/라디오생동_20260909/'+version);";
let code=fs.readFileSync(source,'utf8');
if(code.split(anchor).length!==2)throw Error('기존 수신검수 통로 변경');
code=code.replace(anchor,'const out='+JSON.stringify(path.join(__dirname,process.argv.includes('--speck')?'정수리수정':'라이브13'))+';');
const runner=new Module(source,module);runner.filename=source;runner.paths=Module._nodeModulePaths(path.dirname(source));runner._compile(code,source);
