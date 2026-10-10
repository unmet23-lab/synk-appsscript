'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const qa=__dirname,root=path.resolve(qa,'../../../..');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),fileHash=file=>hash(fs.readFileSync(file));
const asar=require(path.join(root,'desktop/node_modules/@electron/asar'));
const {sourceFiles}=require(path.join(root,'desktop/tools/source-hash.cjs'));
const program='C:/Users/q1212/AppData/Local/Programs/SYNKPlatformPreview',archive=path.join(program,'resources/app.asar');
const stage=path.join(root,'.tmp/platform-reinstall-20261010/attempt2/platform/stage');
const files=sourceFiles(stage);
const checks=[
 {name:'current-platform-archive',ok:fileHash(archive)==='eaa006fec10921cbb2681fd52f791fa1ac3ceb008097a951be684209160cf45e'},
 {name:'current-platform-executable',ok:fileHash(path.join(program,'SYNKPlatformPreview.exe'))==='64da348884eb4a3eb644385b3d6dfa35f7b33000e151fb5d33c27d98fcfe81ca'},
 {name:'current-platform-metadata',ok:fileHash(path.join(program,'resources/synk-install.json'))==='0a59c4b1469049143425218e4ba556120779183a6a147ea7b9627e28c1c42b12'},
 {name:'current-all100-source-files',ok:files.length===100&&files.every(file=>hash(asar.extractFile(archive,path.normalize(file)))===fileHash(path.join(stage,file)))},
];
const output=path.join(qa,'current-preflight.json');if(fs.existsSync(output))throw Error('Preserve prior preflight');
fs.writeFileSync(output,JSON.stringify({checkedAt:new Date().toISOString(),ok:checks.every(row=>row.ok),checks,actualAccountTestPerformed:false,normalProfileRead:false,vaultRead:false,accountRecordsRead:false,credentialsRead:false},null,2)+'\n');
console.log(JSON.stringify({ok:checks.every(row=>row.ok),checks:checks.length,actualAccountTestPerformed:false}));
if(checks.some(row=>!row.ok))process.exitCode=1;
