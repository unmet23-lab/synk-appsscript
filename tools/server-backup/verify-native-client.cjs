'use strict';
// Explicit small encrypted DB supplement; never changes the scheduled success ledger.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process'),{PassThrough}=require('stream');
const backup=require('./backup.cjs'),cipher=require('./cipher.cjs'),CONF='/etc/synk-server-backup',STATE='/var/lib/synk-server-backup';
async function main(){
 const conf=JSON.parse(fs.readFileSync(CONF+'/config.json')),secret=JSON.parse(fs.readFileSync(CONF+'/credentials.json')),last=JSON.parse(fs.readFileSync(STATE+'/latest-success.json'));
 if(conf.role!=='company'||last.role!=='company'||last.status!=='success')throw Error('NATIVE_CHECK_ROLE_INVALID');
 const pub=fs.readFileSync(CONF+'/public.pem','utf8'),d=backup.drive(backup.oauth(secret.drive77,'77yuhbs@gmail.com'));await d.identity();await backup.privateFolder(d,last.folderId);
 const dependency=await backup.verifyKeyDependency(d,JSON.parse(fs.readFileSync(CONF+'/vault-key-dependency.json')),conf.dbRef,cipher.keyId(pub));
 const stamp=new Date().toISOString(),id=crypto.randomUUID(),file=path.join(STATE,'staging','native-client-check-'+id+'.enc'),pg=path.join(__dirname,'pg-client.py');
 const common=['-h',conf.dbHost,'-p','5432','-U',conf.dbUser,'-d','postgres','-w'];
 function proc(args){const p=spawn('/usr/bin/python3',['-I',pg,...args],{stdio:['pipe','pipe','pipe']});p.stderr.on('data',()=>{});p.on('error',()=>{});p.done=new Promise(r=>p.on('close',r));return p;}
 const dump=proc(['pg_dump',...common,'-Fc','-Z','6']),toc=proc(['pg_restore','-l']);dump.stdin.end();toc.stdin.on('error',()=>{});let index='';toc.stdout.on('data',b=>index+=b);const stream=new PassThrough();dump.stdout.pipe(toc.stdin);dump.stdout.pipe(stream);
 const e=await cipher.encryptStream(pub,stream,file,'supabase-native-client-check');if(await dump.done!==0||await toc.done!==0||e.bytes<10000)throw Error('NATIVE_DUMP_FAILED');
 const rows=index.split('\n').filter(x=>x&&!x.startsWith(';'));if(rows.length<50)throw Error('NATIVE_TOC_INVALID');
 const record=await backup.upload(d,last.folderId,file,{sourceKey:'supabase/'+conf.dbRef+'/native-client-check',version:stamp,keyId:cipher.keyId(pub),plaintextBytes:e.bytes,plaintextSha256:e.sha256,format:'PostgreSQL custom dump',vaultKeyDependency:dependency});fs.unlinkSync(file);
 const result={status:'success',checkedAt:new Date().toISOString(),startedAt:stamp,nativeClient:true,noContainerStarted:true,noPlaintextFileWritten:true,noSuccessLedgerChanged:true,toc:rows.length,tableData:(index.match(/ TABLE DATA /g)||[]).length,ciphertext:record,previousScheduledRunId:last.runId,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'backup.cjs'))).digest('hex')};
 const output=STATE+'/native-client-check.json';fs.writeFileSync(output+'.tmp',JSON.stringify(result,null,2)+'\n',{mode:0o600});fs.renameSync(output+'.tmp',output);console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(backup.safe(e));process.exitCode=1;});
