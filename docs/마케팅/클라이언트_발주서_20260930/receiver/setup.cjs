'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const S=require('./sync.cjs');
const TOKEN=/^[a-f0-9]{64}$/,SEVEN_DAYS=7*24*60*60*1000;
class SetupError extends Error{constructor(code){super(code);this.name='SetupError';this.code=code;}}
const check=(condition,code)=>{if(!condition)throw new SetupError(code);};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function defaultPrivateDir(env=process.env){check(typeof env.LOCALAPPDATA==='string'&&path.isAbsolute(env.LOCALAPPDATA),'local_appdata_unavailable');return path.join(env.LOCALAPPDATA,'SYNK','PULSE-Intake');}
async function privateDir(target){
  const full=path.resolve(target),root=path.parse(full).root;let current=root;
  for(const part of full.slice(root.length).split(path.sep).filter(Boolean)){
    current=path.join(current,part);let stat;try{stat=await fs.lstat(current);}catch(error){if(error.code!=='ENOENT')throw error;try{await fs.mkdir(current,{mode:0o700});}catch(mkdirError){if(mkdirError.code!=='EEXIST')throw mkdirError;}stat=await fs.lstat(current);}
    check(stat.isDirectory()&&!stat.isSymbolicLink(),'unsafe_setup_directory');
  }
}
async function fileStat(file){try{const stat=await fs.lstat(file);check(stat.isFile()&&!stat.isSymbolicLink(),'unsafe_setup_file');return stat;}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function readPrivate(file){
  const stat=await fileStat(file);if(!stat)return null;check(stat.size<=16384,'private_config_too_large');
  if(process.platform!=='win32')check((stat.mode&0o077)===0,'private_config_permissions');
  try{const data=JSON.parse(await fs.readFile(file,'utf8'));check(object(data),'invalid_private_config');return data;}catch(error){if(error instanceof SetupError)throw error;throw new SetupError('invalid_private_config');}
}
async function atomicWrite(file,content,{replace=false}={}){
  const old=await fileStat(file);check(!old||replace,'setup_file_exists');
  const temporary=file+'.tmp-'+crypto.randomUUID(),handle=await fs.open(temporary,'wx',0o600);
  try{await handle.writeFile(content);await handle.sync();}finally{await handle.close();}
  if(!replace)check(!(await fileStat(file)),'setup_file_exists');
  else await fileStat(file);
  await fs.rename(temporary,file);
}
function newToken(randomBytes){const value=randomBytes(32).toString('hex');check(TOKEN.test(value),'invalid_generated_token');return value;}
function ownerSource({adminTokenHash,inviteHash,createdAt,expiresAt}){
  check(TOKEN.test(adminTokenHash)&&TOKEN.test(inviteHash)&&typeof createdAt==='string'&&typeof expiresAt==='string'&&Number.isFinite(Date.parse(createdAt))&&Number.isFinite(Date.parse(expiresAt)),'invalid_owner_setup');
  const setup={adminTokenHash,inviteHash,createdAt,expiresAt};
  return `/* Generated owner-only setup. Contains hashes, never raw access tokens. */
function applyOwnerSetup() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  var activeEmail = Session.getActiveUser().getEmail();
  var effectiveEmail = Session.getEffectiveUser().getEmail();
  intakeAssert_(typeof activeEmail === 'string' && activeEmail.trim() !== '' && activeEmail === effectiveEmail, 'owner_only', '소유자 계정의 편집기에서 실행해주세요.');
  return applyOwnerSetup_();
}
function applyOwnerSetup_() {
  var setup = ${JSON.stringify(setup)};
  var props = PropertiesService.getScriptProperties();
  var key = PULSE_INTAKE_.prefix + 'adminTokenHash';
  var current = props.getProperty(key);
  intakeAssert_(!current || intakeEqual_(current, setup.adminTokenHash), 'admin_config_mismatch', '기존 동기화 설정이 다릅니다. 기존 값을 덮어쓰지 않았습니다.');
  initializeInbox_();
  return intakeLocked_(function() {
    var active = props.getProperty(key);
    intakeAssert_(!active || intakeEqual_(active, setup.adminTokenHash), 'admin_config_mismatch', '기존 동기화 설정이 다릅니다. 기존 값을 덮어쓰지 않았습니다.');
    var inviteKey = 'invite.' + setup.inviteHash;
    var invite = intakeGet_(inviteKey);
    intakeAssert_(Date.parse(invite ? invite.expiresAt : setup.expiresAt) > Date.now(), 'setup_invite_expired', '테스트 초대의 사용 기간이 지났습니다.');
    if (!active) props.setProperty(key, setup.adminTokenHash);
    if (!invite) {
      intakePut_(inviteKey, {version: 1, createdAt: setup.createdAt, expiresAt: setup.expiresAt});
    }
    return {configured: true, inviteReady: true, inviteExpiresAt: invite ? invite.expiresAt : setup.expiresAt};
  });
}
`;
}
async function assertNoPublicSecrets(outputDir,secrets,source){
  check(!secrets.some(secret=>source.includes(secret)),'public_secret_detected');
  for(const entry of await fs.readdir(outputDir,{withFileTypes:true})){
    if(entry.isSymbolicLink()&&/[.](?:gs|js|html|json)$/i.test(entry.name))throw new SetupError('unsafe_public_output');
    if(!entry.isFile()||!/[.](?:gs|js|html|json)$/i.test(entry.name)||entry.name==='OwnerSetup.gs')continue;
    const content=await fs.readFile(S.safeJoin(outputDir,entry.name),'utf8');check(!secrets.some(secret=>content.includes(secret)),'public_secret_detected');
  }
}
async function prepare({endpoint,baseDir=defaultPrivateDir(),outputDir=path.join(__dirname,'dist'),now=()=>new Date(),randomBytes=crypto.randomBytes}={}){
  const selectedEndpoint=endpoint===undefined?undefined:S.endpointUrl(endpoint);
  check(path.isAbsolute(baseDir)&&path.isAbsolute(outputDir),'invalid_setup_directory');baseDir=path.resolve(baseDir);outputDir=path.resolve(outputDir);
  const within=(parent,child)=>{const rel=path.relative(parent,child);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
  check(!within(outputDir,baseDir)&&!within(baseDir,outputDir),'private_public_directories_overlap');
  await privateDir(baseDir);await privateDir(outputDir);
  const connectionFile=S.safeJoin(baseDir,'connection.json'),inviteFile=S.safeJoin(baseDir,'invite.json'),connection=await readPrivate(connectionFile),existingInvite=await readPrivate(inviteFile);
  if(connection){check(TOKEN.test(connection.adminToken),'invalid_existing_admin_token');check(typeof connection.endpoint==='string'&&(connection.endpoint===''||S.endpointUrl(connection.endpoint)),'invalid_existing_endpoint');check(typeof connection.inboxDir==='string'&&path.isAbsolute(connection.inboxDir),'invalid_existing_inbox');}
  const adminToken=connection?.adminToken||newToken(randomBytes),inboxDir=connection?.inboxDir||S.safeJoin(baseDir,'inbox'),effectiveEndpoint=selectedEndpoint===undefined?(connection?.endpoint||''):selectedEndpoint;
  check(path.resolve(inboxDir)!==path.parse(path.resolve(inboxDir)).root&&!within(outputDir,path.resolve(inboxDir)),'invalid_existing_inbox');
  const time=now();check(time instanceof Date&&Number.isFinite(time.getTime()),'invalid_setup_time');let invite=existingInvite;
  if(invite){check(TOKEN.test(invite.token)&&typeof invite.createdAt==='string'&&typeof invite.expiresAt==='string'&&Number.isFinite(Date.parse(invite.createdAt))&&Number.isFinite(Date.parse(invite.expiresAt)),'invalid_existing_invite');check(Date.parse(invite.expiresAt)>time.getTime(),'setup_invite_expired');check(invite.token!==adminToken,'duplicate_access_tokens');}
  else{let token;for(let attempt=0;attempt<5;attempt++){token=newToken(randomBytes);if(token!==adminToken)break;}check(token!==adminToken,'duplicate_access_tokens');invite={version:1,token,createdAt:time.toISOString(),expiresAt:new Date(time.getTime()+SEVEN_DAYS).toISOString()};}
  const source=ownerSource({adminTokenHash:S.digest(adminToken),inviteHash:S.digest(invite.token),createdAt:invite.createdAt,expiresAt:invite.expiresAt});
  await assertNoPublicSecrets(outputDir,[adminToken,invite.token],source);
  const settings={...(connection||{}),endpoint:effectiveEndpoint,adminToken,inboxDir:path.resolve(inboxDir)};
  // Only these private files receive raw tokens. The generated Apps Script receives hashes.
  if(!connection||JSON.stringify(settings)!==JSON.stringify(connection))await atomicWrite(connectionFile,JSON.stringify(settings,null,2)+'\n',{replace:!!connection});
  if(!existingInvite)await atomicWrite(inviteFile,JSON.stringify(invite,null,2)+'\n');
  await privateDir(settings.inboxDir);
  await atomicWrite(S.safeJoin(outputDir,'OwnerSetup.gs'),source,{replace:true});
  if(effectiveEndpoint)await atomicWrite(S.safeJoin(baseDir,'customer-link.txt'),effectiveEndpoint+'?invite='+invite.token+'\n',{replace:true});
  return {prepared:true,endpointConfigured:!!effectiveEndpoint,inviteExpiresAt:invite.expiresAt,ownerSetupGenerated:true,remoteInitialized:false};
}
function errorCode(error){return error instanceof SetupError||error instanceof S.SyncError?error.code:'setup_failed';}
function parseArgs(args){if(args.length===0)return {};check(args.length===2&&args[0]==='--endpoint','invalid_setup_arguments');return {endpoint:S.endpointUrl(args[1])};}
async function main(args=process.argv.slice(2)){
  try{const result=await prepare(parseArgs(args));process.stdout.write(JSON.stringify(result)+'\n');}catch(error){process.stderr.write(JSON.stringify({ok:false,code:errorCode(error)})+'\n');process.exitCode=1;}
}
module.exports={SetupError,SEVEN_DAYS,defaultPrivateDir,ownerSource,assertNoPublicSecrets,prepare,parseArgs,errorCode,main};
if(require.main===module)main();
