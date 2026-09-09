'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const sourceFiles=fs.readdirSync(root).filter(file=>file.endsWith('.js'));
for(const file of sourceFiles){const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,file+': '+result.stderr);}
JSON.parse(fs.readFileSync(path.join(root,'appsscript.json'),'utf8'));
const suites=[{name:'몽골어관련',args:['--test','tests/몽골어출구.test.js','tests/몽골어검문장부.test.js','tests/몽골어대조_판정.test.js','tests/몽골어대조_읽기.test.js']},{name:'전체CI모사',args:['tools/test-ci.js']}];
const results=[];
for(const suite of suites){
  console.log(suite.name+' 시작');
  const start=new Date();
  const result=spawnSync(process.execPath,suite.args,{cwd:root,encoding:'utf8',maxBuffer:30*1024*1024,windowsHide:true});
  const output=result.stdout+'\n'+result.stderr;
  fs.writeFileSync(path.join(__dirname,suite.name+'.log'),output);
  const summary=output.split(/\r?\n/).filter(line=>/^[ℹ#] (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)|^✖|^test at |^\[test-ci\]/.test(line));
  const record={suite:suite.name,startedAt:start.toISOString(),finishedAt:new Date().toISOString(),exitCode:result.status,summary}; results.push(record);console.log(JSON.stringify(record));
}
fs.writeFileSync(path.join(__dirname,'최종시험.json'),JSON.stringify({checkedAt:new Date().toISOString(),rootJsSyntaxPassed:sourceFiles.length,appsscriptJsonPassed:true,results},null,2)+'\n');
if(results.some(row=>row.exitCode!==0))process.exitCode=1;
