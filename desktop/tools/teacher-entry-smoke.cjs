'use strict';
const path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const artifactPrefix=process.argv.find(arg=>arg.startsWith('--artifact-prefix='))?.slice(18)||'teacher-entry-native';
if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(artifactPrefix))throw Error('Invalid artifact prefix');
(async()=>{const root=path.resolve(__dirname,'..'),{createServer}=await import(pathToFileURL(path.join(root,'../experiences/learning-hub/server.mjs')).href),server=createServer();let child;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4280,'127.0.0.1',resolve);});
    const result=await new Promise((resolve,reject)=>{
      child=spawn(require('electron'),[path.join(root,'src/teacher-main.cjs'),'--synk-teacher-preview','--synk-smoke'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
      child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',reject);child.once('exit',code=>{const line=stdout.split(/\r?\n/).find(x=>x.startsWith('SYNK_TEACHER_SMOKE '));resolve({exitCode:code,result:line?JSON.parse(line.slice(19)):null,stderr});});
    });
    const report={checkedAt:new Date().toISOString(),...result,ok:result.exitCode===0&&result.result?.ok===true};fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,`artifacts/${artifactPrefix}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
