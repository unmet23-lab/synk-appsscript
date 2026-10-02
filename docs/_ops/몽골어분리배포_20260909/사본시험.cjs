'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const clone = 'C:/Users/q1212/Documents/SYNK-deploy-mn-20260909';
const label = process.argv[2]; assert(/^[a-z0-9_-]+$/.test(label));
const start = new Date().toISOString();
const git = args => spawnSync('git', ['--no-optional-locks',...args], {cwd:clone,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
const before = git(['status']); fs.writeFileSync(path.join(__dirname,label+'-status-before.txt'),before.stdout+before.stderr);
const rootFiles=fs.readdirSync(clone).filter(file=>file.endsWith('.js'));
const syntax=[];
for(const file of rootFiles){const result=spawnSync(process.execPath,['--check',file],{cwd:clone,encoding:'utf8',windowsHide:true});syntax.push({file,status:result.status,error:result.stderr||null});}
JSON.parse(fs.readFileSync(path.join(clone,'appsscript.json'),'utf8'));
const tests=[{name:'mongolian21',args:['--test','tests/몽골어출구.test.js','tests/몽골어검문장부.test.js','tests/몽골어대조_판정.test.js','tests/몽골어대조_읽기.test.js']},{name:'ci',args:['tools/test-ci.js']}];
const results=[];
for(const suite of tests){
  console.log(`${label}: ${suite.name} started`);
  const startedAt=new Date().toISOString();
  const result=spawnSync(process.execPath,suite.args,{cwd:clone,encoding:'utf8',windowsHide:true,maxBuffer:40*1024*1024});
  const output=result.stdout+'\n'+result.stderr;
  fs.writeFileSync(path.join(__dirname,label+'-'+suite.name+'.log'),output);
  const summary=output.split(/\r?\n/).filter(line=>/^[ℹ#] (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)|^✖|^test at |^\[test-ci\]/.test(line));
  const record={name:suite.name,startedAt,finishedAt:new Date().toISOString(),status:result.status,summary};results.push(record);console.log(JSON.stringify(record));
}
const after=git(['status']);fs.writeFileSync(path.join(__dirname,label+'-status-after.txt'),after.stdout+after.stderr);
const report={label,start,finishedAt:new Date().toISOString(),repo:clone,head:git(['rev-parse','HEAD']).stdout.trim(),syntax,appsscriptJson:true,results};
fs.writeFileSync(path.join(__dirname,label+'-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({syntax:syntax.length,syntaxFailed:syntax.filter(row=>row.status!==0).length,appsscriptJson:true,repo:clone}));
if(syntax.some(row=>row.status!==0)||results.some(row=>row.status!==0))process.exitCode=1;
