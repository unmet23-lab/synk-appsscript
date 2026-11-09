'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const executable=process.argv[2],parent=process.argv[3];
 assert.ok(executable&&path.isAbsolute(executable)&&parent&&path.isAbsolute(parent),'Usage: node native-smoke.cjs <absolute WorkBackupRust.exe> <existing scratch folder>');
 const root=await fs.mkdtemp(path.join(parent,'native-smoke-'));
 for(const n of ['sources/sub','store','keys','restores','state'])await fs.mkdir(path.join(root,n),{recursive:true});
 const samples={'hello.txt':Buffer.from('Rust backup parity\n한글 업무 파일\n'),'sub/data.json':Buffer.from('{"same":true,"version":1}'),'binary.bin':crypto.randomBytes(65536)};
 for(const [name,data]of Object.entries(samples))await fs.writeFile(path.join(root,'sources',name),data,{flag:'wx'});
 const dialogs=[{method:'dialog.open',value:{canceled:false,filePaths:[path.join(root,'sources')]}},{method:'dialog.open',value:{canceled:false,filePaths:[path.join(root,'store')]}},{method:'dialog.save',value:{canceled:false,filePath:path.join(root,'keys/recovery.json')}},{method:'dialog.open',value:{canceled:false,filePaths:[path.join(root,'restores')]}},{method:'dialog.open',value:{canceled:false,filePaths:[path.join(root,'restores')]}}];
 await fs.writeFile(path.join(root,'dialogs.json'),JSON.stringify(dialogs),{flag:'wx'});
 const report=path.join(root,'smoke.json');
 const env={...process.env,SOLO_BACKUP_TEST_STATE:path.join(root,'state'),SOLO_BACKUP_TEST_DIALOGS:path.join(root,'dialogs.json'),SOLO_BACKUP_SMOKE_REPORT:report};
 const child=spawn(executable,['--test-mode','--smoke'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const code=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Native smoke timeout'));},240000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve(code);});});
 await fs.writeFile(path.join(root,'process.json'),JSON.stringify({code,stdout,stderr}));assert.equal(code,0,`Native app failed, inspect ${root}`);
 const result=JSON.parse(await fs.readFile(report,'utf8'));assert.equal(result.startupRegistered,false);
 const expected=Object.fromEntries(Object.entries(samples).map(([name,data])=>[name,sha(data)]));
 async function walk(dir){let out=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())out.push(...await walk(file));else out.push(file);}return out;}
 const original=await walk(path.join(root,'sources'));for(const file of original)assert.equal(sha(await fs.readFile(file)),expected[path.relative(path.join(root,'sources'),file).replaceAll('\\','/')]);
 const full=await walk(result.restore.path),selected=await walk(result.selected.path);const expectedHashes=Object.values(expected);
 let restored=0;for(const file of full){const hash=sha(await fs.readFile(file));if(expectedHashes.includes(hash))restored++;}assert.equal(restored,3);
 assert.equal(result.selected.files,1);assert.ok((await Promise.all(selected.map(async file=>sha(await fs.readFile(file))))).some(hash=>expectedHashes.includes(hash)));
 const credential=await fs.readFile(path.join(root,'state/vault/credential.bin'));assert.equal(credential.subarray(0,5).toString(),'SWBR1');
 const summary={root,code,backupFiles:result.backup.files,fullRestoreHashMatches:restored,selectedFiles:result.selected.files,originalHashMatches:original.length,credentialFormat:'SWBR1',startupRegistered:false,productionTouched:false};
 await fs.writeFile(path.join(root,'verified.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
