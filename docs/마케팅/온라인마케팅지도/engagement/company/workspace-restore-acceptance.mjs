// Offline comparison of existing workspace backups. This never starts a host,
// edits a source snapshot, repairs history, or permits production traffic.
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdir,cp,lstat,readdir,realpath} from 'node:fs/promises';
import {createHash,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {join,resolve,relative,sep,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {workspaceMediaNames} from './workspace-media.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const serial=value=>JSON.stringify(value,(_,item)=>typeof item==='bigint'?{$integer:String(item)}:item);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const issue=code=>Object.assign(new Error(code),{acceptanceCode:code});
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const within=(base,path)=>path===base||path.startsWith(base+sep);

async function files(root){
  const result=new Map();
  async function visit(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const path=join(directory,entry.name),stat=await lstat(path);
      if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))throw issue('SNAPSHOT_LINK_OR_SPECIAL_FILE');
      if(stat.isDirectory())await visit(path);else result.set(relative(root,path),sha(await readFile(path)));
    }
  }
  const stat=await lstat(root);if(!stat.isDirectory()||stat.isSymbolicLink())throw issue('SNAPSHOT_DIRECTORY_REQUIRED');
  await visit(root);return result;
}
const sameFiles=(left,right)=>left.size===right.size&&[...left].every(([path,hash])=>right.get(path)===hash);
function decrypt(key,ciphertext){
  const data=Buffer.from(ciphertext,'base64');
  if(data.length<29)throw issue('ENCRYPTED_RECORD_UNREADABLE');
  const decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString());
}
function database(path){
  // Immutable URI avoids creating/updating WAL/SHM beside a preserved snapshot.
  // Non-empty WAL is refused by snapshot() before this URI ignores sidecars.
  const uri=pathToFileURL(path);uri.search='mode=ro&immutable=1';
  const db=new DatabaseSync(uri.href,{readOnly:true});
  try{
    db.exec('PRAGMA query_only=ON;');
    if(db.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok'))throw issue('DATABASE_INTEGRITY_FAILED');
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw issue('DATABASE_FOREIGN_KEY_FAILED');
    const schema=db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
    const tables=new Map();
    for(const {name} of schema.filter(row=>row.type==='table')){
      const statement=db.prepare('SELECT * FROM '+quote(name));statement.setReadBigInts(true);
      tables.set(name,statement.all().map(serial).sort());
    }
    return {schema:sha(serial(schema)),tables,db};
  }catch(error){db.close();throw error;}
}
function sameDatabase(left,right){
  return left.schema===right.schema&&left.tables.size===right.tables.size&&[...left.tables].every(([name,rows])=>serial(rows)===serial(right.tables.get(name)));
}
function practiceRows(company,key){
  const users=new Set(company.db.prepare("SELECT id FROM documents WHERE kind='users'").all().map(row=>row.id));
  const result=new Map();let active=0,deleted=0;
  for(const {id,body} of company.db.prepare("SELECT id,body FROM documents WHERE kind='workroomPracticeSync'").all()){
    const row=JSON.parse(body);
    if(!object(row)||row.version!==1||row.ownerId!==id||!users.has(id)||!Number.isSafeInteger(row.revision)||row.revision<1||!validDate(row.updatedAt)||!['active','deleted'].includes(row.status))throw issue('PRACTICE_ENVELOPE_INVALID');
    if(row.status==='deleted'){
      if(Object.hasOwn(row,'ciphertext')||Object.keys(row).some(name=>!['version','ownerId','revision','status','updatedAt'].includes(name)))throw issue('DELETED_RECORD_HAS_CONTENT');
      deleted++;
    }else{
      if(typeof row.ciphertext!=='string'||!object(decrypt(key,row.ciphertext)))throw issue('ENCRYPTED_RECORD_UNREADABLE');
      active++;
    }
    result.set(id,{revision:row.revision,status:row.status,digest:sha(body)});
  }
  for(const row of company.db.prepare('SELECT ciphertext FROM credentials').all())decrypt(key,row.ciphertext);
  return {rows:result,active,deleted};
}
async function snapshot(directory){
  const root=await realpath(resolve(directory));
  const before=await files(root);
  if(await readFile(join(root,'COMPLETE'),'utf8')!=='ok\n')throw issue('BACKUP_COMPLETE_REQUIRED');
  for(const path of before.keys())if(/\.sqlite-wal$/i.test(path)&&(await readFile(join(root,path))).length)throw issue('STOPPED_BACKUP_REQUIRED');
  const manifest=JSON.parse(await readFile(join(root,'integration-manifest.json'),'utf8'));
  if(!object(manifest)||manifest.version!==1||manifest.company!=='company'||manifest.messenger!=='messenger'||!validDate(manifest.createdAt)||!Array.isArray(manifest.identityLinks))throw issue('INTEGRATION_MANIFEST_INVALID');
  const key=await readFile(join(root,'company','encryption.key'));if(key.length!==32)throw issue('ENCRYPTION_KEY_INVALID');
  let company,messenger;
  try{
    company=database(join(root,'company','company.sqlite'));messenger=database(join(root,'messenger','messenger.sqlite'));
    const practices=practiceRows(company,key);
    const companyUsers=new Set(company.db.prepare("SELECT id FROM documents WHERE kind='users'").all().map(row=>row.id));
    const messengerUsers=new Set(messenger.db.prepare('SELECT id FROM users').all().map(row=>row.id));
    const seenCompany=new Set(),seenMessenger=new Set();
    for(const link of manifest.identityLinks){
      if(!object(link)||typeof link.companyUserId!=='string'||typeof link.messengerUserId!=='string'||!companyUsers.has(link.companyUserId)||!messengerUsers.has(link.messengerUserId)||seenCompany.has(link.companyUserId)||seenMessenger.has(link.messengerUserId))throw issue('IDENTITY_RELATION_INVALID');
      seenCompany.add(link.companyUserId);seenMessenger.add(link.messengerUserId);
    }
    const media=workspaceMediaNames(company.db);
    const attachments=messenger.db.prepare("SELECT disk_name FROM files WHERE storage_provider='local'").all().map(row=>row.disk_name);
    if(manifest.mediaCount!==media.length||manifest.attachmentCount!==attachments.length)throw issue('ATTACHMENT_MANIFEST_INVALID');
    for(const name of media){if(typeof name!=='string'||!/^[0-9a-f-]{36}\.(mp4|webm|png|jpg|intake)$/i.test(name)||!before.has(join('company','studio-media',name)))throw issue('REFERENCED_MEDIA_MISSING');}
    for(const name of attachments){if(typeof name!=='string'||!/^[a-f0-9-]{36}\.bin$/.test(name)||!before.has(join('messenger','uploads',name)))throw issue('REFERENCED_ATTACHMENT_MISSING');}
    return {root,before,manifest,key,company,messenger,practices};
  }catch(error){company?.db.close();messenger?.db.close();throw error;}
}
function freshness(evidence,baseline){
  if(!object(evidence)||!['synthetic-rehearsal','operator-attestation'].includes(evidence.kind)||evidence.declaredLatest!==true||evidence.writersStopped!==true||!validDate(evidence.writersStoppedAt)||!validDate(evidence.recordedAt)||evidence.baselineCreatedAt!==baseline.manifest.createdAt||Date.parse(evidence.writersStoppedAt)>Date.parse(evidence.baselineCreatedAt)||Date.parse(evidence.recordedAt)<Date.parse(evidence.baselineCreatedAt))throw issue('LATEST_STOPPED_BASELINE_EVIDENCE_REQUIRED');
}

export async function acceptWorkspaceRestore({candidateDirectory,baselineDirectory,freshnessEvidence,destination,layout='siblings'}={}){
  const report={version:1,status:'rejected',candidateMatchesDeclaredBaseline:false,productionTrafficAllowed:false,latestnessIndependentlyVerified:false,scope:freshnessEvidence?.kind==='synthetic-rehearsal'?'synthetic-rehearsal':'offline-operator-declaration',sourceReadOnly:true,sourceFilesUnchanged:null,preparedIsolatedCopy:false,checks:[],issues:[]};
  let candidate,baseline;
  try{
    if(!['siblings','cloud-volume'].includes(layout))throw issue('RESTORE_LAYOUT_INVALID');
    if(typeof candidateDirectory!=='string'||typeof baselineDirectory!=='string')throw issue('CANDIDATE_AND_LATEST_BASELINE_REQUIRED');
    baseline=await snapshot(baselineDirectory);freshness(freshnessEvidence,baseline);
    if(await realpath(resolve(candidateDirectory))===baseline.root)throw issue('INDEPENDENT_CANDIDATE_AND_BASELINE_REQUIRED');
    candidate=await snapshot(candidateDirectory);
    report.checks.push('complete-markers','sqlite-integrity-and-foreign-keys','readable-private-encryption','identity-relations','referenced-local-files','latest-stopped-baseline-declaration');
    report.counts={practiceActive:baseline.practices.active,practiceDeleted:baseline.practices.deleted,identityLinks:baseline.manifest.identityLinks.length};
    if(!timingSafeEqual(candidate.key,baseline.key))report.issues.push('ENCRYPTION_KEY_MISMATCH');
    for(const [id,row] of baseline.practices.rows){
      const other=candidate.practices.rows.get(id);
      if(!other||other.revision!==row.revision||other.status!==row.status||other.digest!==row.digest){
        const code=row.status==='deleted'?'DELETION_NOT_PRESERVED':'PRACTICE_CHANGE_NOT_PRESERVED';if(!report.issues.includes(code))report.issues.push(code);
      }
    }
    if(candidate.practices.rows.size!==baseline.practices.rows.size)report.issues.push('PRACTICE_RECORD_SET_MISMATCH');
    if(!sameDatabase(candidate.company,baseline.company))report.issues.push('COMPANY_DATABASE_DIFFERS');
    if(!sameDatabase(candidate.messenger,baseline.messenger))report.issues.push('MESSENGER_DATABASE_DIFFERS');
    if(serial(candidate.manifest.identityLinks)!==serial(baseline.manifest.identityLinks))report.issues.push('IDENTITY_LINKS_DIFFER');
    // File hashes stay in memory: no encryption-key/credential/content hashes in reports.
    const relativeFiles=s=>new Map([...s.before].filter(([name])=>!['COMPLETE','RESTORE.txt','integration-manifest.json',join('company','company.sqlite'),join('messenger','messenger.sqlite')].includes(name)&&!/\.sqlite-(wal|shm)$/i.test(name)));
    if(!sameFiles(relativeFiles(candidate),relativeFiles(baseline)))report.issues.push('BACKUP_PAYLOAD_FILES_DIFFER');
    report.sourceFilesUnchanged=sameFiles(candidate.before,await files(candidate.root))&&sameFiles(baseline.before,await files(baseline.root));
    if(!report.sourceFilesUnchanged)report.issues.push('SOURCE_CHANGED_DURING_ACCEPTANCE');
    if(report.issues.length)return report;
    report.checks.push('matching-key','practice-revisions-and-deletion','both-database-logical-rows','matching-payload-files','unchanged-source-files');
    if(destination!==undefined){
      if(typeof destination!=='string')throw issue('NEW_ISOLATED_DIRECTORY_REQUIRED');
      const target=resolve(destination),parent=await realpath(dirname(target));
      const actual=join(parent,relative(dirname(target),target));
      if([candidate.root,baseline.root].some(root=>within(root,actual)||within(actual,root)))throw issue('DESTINATION_MUST_BE_SEPARATE');
      await mkdir(actual,{mode:0o700}); // EEXIST rejects overwrite, including symlinks.
      await writeFile(join(actual,'PREPARATION_INCOMPLETE'),'Do not start a host.\n',{mode:0o600});
      const companyTarget=layout==='cloud-volume'?actual:join(actual,'company');
      if(layout==='cloud-volume'){
        for(const entry of await readdir(join(candidate.root,'company'))){
          if(['messenger','config','PREPARATION_INCOMPLETE','RECOVERY_ACCEPTANCE.json'].includes(entry))throw issue('RESTORE_LAYOUT_CONFLICT');
          await cp(join(candidate.root,'company',entry),join(companyTarget,entry),{recursive:true,errorOnExist:true,force:false});
        }
      }else await cp(join(candidate.root,'company'),companyTarget,{recursive:true,errorOnExist:true,force:false});
      await cp(join(candidate.root,'messenger'),join(actual,'messenger'),{recursive:true,errorOnExist:true,force:false});
      // A cloud volume moves between host staging and /data. Its path comes
      // from MESSENGER_DATA_DIR, never from the machine doing this comparison.
      await writeFile(join(companyTarget,'workspace-integration.json'),JSON.stringify({...(layout==='siblings'?{messengerDataDir:join(actual,'messenger')}:{}),identityLinks:candidate.manifest.identityLinks},null,2),{mode:0o600});
      const copied=await files(actual);
      for(const [path,hash] of candidate.before){if(['company','messenger'].some(name=>path.startsWith(name+sep))){const targetPath=layout==='cloud-volume'&&path.startsWith('company'+sep)?path.slice('company'.length+1):path;if(path!==join('company','workspace-integration.json')&&copied.get(targetPath)!==hash)throw issue('ISOLATED_COPY_MISMATCH');}}
      report.sourceFilesUnchanged=sameFiles(candidate.before,await files(candidate.root))&&sameFiles(baseline.before,await files(baseline.root));
      if(!report.sourceFilesUnchanged)throw issue('SOURCE_CHANGED_DURING_COPY');
      report.preparedIsolatedCopy=true;
      report.preparedLayout=layout;
      await writeFile(join(actual,'RECOVERY_ACCEPTANCE.json'),JSON.stringify({...report,status:'candidate-matches-declared-baseline',candidateMatchesDeclaredBaseline:true},null,2),{mode:0o600});
      // Keep the blocking marker: only the operator's actual environment and
      // access checks can authorize removing it and reopening traffic.
    }
    report.status='candidate-matches-declared-baseline';report.candidateMatchesDeclaredBaseline=true;
  }catch(error){
    const known=error.acceptanceCode||({ENOENT:'SNAPSHOT_OR_REQUIRED_FILE_MISSING',EEXIST:'DESTINATION_ALREADY_EXISTS'}[error.code])||'SNAPSHOT_OR_COPY_UNREADABLE';
    if(!report.issues.includes(known))report.issues.push(known);
  }finally{candidate?.company.db.close();candidate?.messenger.db.close();baseline?.company.db.close();baseline?.messenger.db.close();}
  return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let evidence;
  try{evidence=JSON.parse(await readFile(process.argv[4],'utf8'));}catch{}
  const report=await acceptWorkspaceRestore({candidateDirectory:process.argv[2],baselineDirectory:process.argv[3],freshnessEvidence:evidence,...(process.argv[5]?{destination:process.argv[5]}:{}),layout:process.argv[6]===undefined?'siblings':process.argv[6]==='--cloud-volume'?'cloud-volume':'invalid'});
  console.log(JSON.stringify(report,null,2));process.exitCode=report.candidateMatchesDeclaredBaseline?0:2;
}
