'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

// Coordination metadata only. OAuth credentials stay in each app's own vault.
// A file can request an account, never prove one: auth-service verifies that ID
// with the identity server before publishing a signed-in snapshot or API token.
function suiteKey(config,mode){return crypto.createHash('sha256').update(JSON.stringify([mode,config?.supabaseUrl,config?.accountApiUrl])).digest('hex');}
function validRecord(value,key){return !!value&&value.version===2&&value.key===key&&['signed-in','signed-out','checking'].includes(value.status)&&typeof value.generation==='string'&&value.generation.length>0&&value.generation.length<=160&&(value.status!=='signed-in'||typeof value.accountId==='string'&&value.accountId.length>0&&value.accountId.length<=128)&&Number.isSafeInteger(value.updatedAt)&&Object.keys(value).every(k=>['version','key','status','generation','accountId','updatedAt'].includes(k));}
function createSuiteStore({directory,key,io=fs}){
  const file=path.join(directory,'platform-session.json');
  const invalid=code=>Object.assign(new Error(code),{code});
  function bytes(){const info=io.lstatSync(file);if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw invalid('SUITE_STATE_INVALID');return io.readFileSync(file);}
  function parse(raw){let value;try{value=JSON.parse(raw.toString('utf8'));}catch{throw invalid('SUITE_STATE_CORRUPT');}if(!validRecord(value,key))throw invalid('SUITE_STATE_INVALID');return value;}
  function read(){try{return parse(bytes());}catch(error){if(error.code==='ENOENT')return null;throw error;}}
  function prepare(){io.mkdirSync(directory,{recursive:true,mode:0o700});const info=io.lstatSync(directory);if(!info.isDirectory()||info.isSymbolicLink())throw invalid('SUITE_STATE_INVALID');try{const old=io.lstatSync(file);if(!old.isFile()||old.isSymbolicLink())throw invalid('SUITE_STATE_INVALID');}catch(error){if(error.code!=='ENOENT')throw error;}}
  function saveExclusive(target,data){const fd=io.openSync(target,'wx',0o600);let saved=false,created;try{created=io.fstatSync(fd);io.writeFileSync(fd,data);io.fsyncSync(fd);saved=true;}finally{io.closeSync(fd);if(!saved&&created){try{const item=io.lstatSync(target);if(item.isFile()&&!item.isSymbolicLink()&&item.dev===created.dev&&item.ino===created.ino)io.unlinkSync(target);}catch{}}}}
  function preserve(original){
    const digest=crypto.createHash('sha256').update(original).digest('hex'),backup=path.join(directory,'platform-session-corrupt-'+digest+'.json');
    try{saveExclusive(backup,original);}catch(error){if(error.code!=='EEXIST')throw error;}
    const info=io.lstatSync(backup);if(!info.isFile()||info.isSymbolicLink()||info.size!==original.length||info.size>4096)throw invalid('SUITE_STATE_INVALID');
    const fd=io.openSync(backup,io.constants.O_RDONLY|(io.constants.O_NOFOLLOW||0));
    try{const opened=io.fstatSync(fd);if(!opened.isFile()||opened.size!==original.length||opened.dev!==info.dev||opened.ino!==info.ino)throw invalid('SUITE_STATE_INVALID');const saved=io.readFileSync(fd);if(saved.length!==original.length||crypto.createHash('sha256').update(saved).digest('hex')!==digest||!saved.equals(original))throw invalid('SUITE_STATE_INVALID');}finally{io.closeSync(fd);}
  }
  function write(value,beforeCommit){if(!validRecord(value,key))throw invalid('SUITE_STATE_INVALID');prepare();
    const temporary=path.join(directory,'platform-session-'+crypto.randomBytes(12).toString('hex')+'.tmp');try{saveExclusive(temporary,JSON.stringify(value)+'\n');beforeCommit?.();io.renameSync(temporary,file);}finally{try{io.unlinkSync(temporary);}catch{}}}
  function recover(value){
    if(!validRecord(value,key)||value.status!=='checking'||value.accountId!==null)throw invalid('SUITE_STATE_INVALID');
    prepare();const original=bytes();try{return parse(original);}catch(error){if(error.code!=='SUITE_STATE_CORRUPT')throw error;}
    // Preserve the unreadable bytes before atomic replacement. Never create a
    // missing-file interval in which another app could restore an old account.
    preserve(original);
    write(value,()=>{if(!bytes().equals(original))throw invalid('SUITE_STATE_CHANGED');});
    return value;
  }
  return {read,write,recover};
}
function createSuitePublisher({store,key,now=Date.now,onError=()=>{},onChange=()=>{},schedule=setTimeout,unschedule=clearTimeout}){
  let latest=null,last=null,closed=false,failed=false,authToInitialize=null,initialization=null,initialized=false,retryTimer=null,retryDelay=500,signInRequested=false,signInStarted=false,signInGeneration=null,authStatus=null;
  const record=(status,accountId=null)=>({version:2,key,status,accountId,generation:crypto.randomUUID(),updatedAt:now()});
  function read(){try{const uncertain=failed;latest=store.read();if(!latest&&uncertain){latest=record('checking');store.write(latest);}last=latest&&JSON.stringify(latest);failed=false;return true;}catch(error){
    if(error.code==='SUITE_STATE_CORRUPT'&&store.recover){try{latest=store.recover(record('checking'));last=JSON.stringify(latest);failed=false;return true;}catch(recoveryError){error=recoveryError;}}
    failed=true;onError(error);return false;
  }}
  read();
  const available=()=>!closed&&!failed&&(!authToInitialize||initialized)&&latest?.status!=='checking';
  function retry(){if(closed||retryTimer!==null||!authToInitialize)return;retryTimer=schedule(()=>{retryTimer=null;void initialize(authToInitialize);},retryDelay);retryTimer?.unref?.();retryDelay=Math.min(retryDelay*2,30000);}
  async function initialize(auth){
    if(closed||initialized)return auth.status();if(initialization)return initialization;authToInitialize=auth;
    const operation=(async()=>{
      if(failed&&!read()){retry();return auth.status();}
      if(retryTimer!==null){unschedule(retryTimer);retryTimer=null;}
      initialized=true;
      // A damaged selection could have represented an explicit logout. Keep
      // every old vault fenced until a new explicit OAuth login is verified.
      if(latest?.status==='checking'){onChange();return auth.status();}
      if(latest?.status==='signed-out')await auth.signOut();else await auth.initialize();
      if(!closed)onChange();return auth.status();
    })();initialization=operation;
    try{return await operation;}finally{if(initialization===operation)initialization=null;}
  }
  function flush(force=false){if(closed)return false;const before=available();if(!latest&&failed&&!read())return false;
    if(authToInitialize&&!initialized){void initialize(authToInitialize);return false;}
    if(!latest)return !failed;const serial=JSON.stringify(latest);if(!force&&last===serial&&!failed)return available();
    try{store.write(latest);last=serial;failed=false;}catch(error){failed=true;onError(error);}
    if(before!==available())onChange();return available();
  }
  function select(status,accountId=null){latest=record(status,accountId);return flush();}
  function beginSelection(status){const previous=latest;if(select(status))return true;latest=previous;return false;}
  function clearSignIn(){signInRequested=false;signInStarted=false;signInGeneration=null;}
  return {
    initialize,
    // A saved choice is not a credential. Each app still verifies its own token
    // with the server. Closing or refreshing Platform does not revoke that choice.
    publish(snapshot){if(closed)return false;
      authStatus=snapshot.status;
      // Retryable verification may finish later using this same OAuth session.
      // Keep its explicit choice intent only while that auth epoch survives.
      if(signInStarted&&snapshot.sessionGeneration!==signInGeneration)clearSignIn();
      if(snapshot.status==='signing-in'&&signInRequested){signInStarted=true;signInGeneration=snapshot.sessionGeneration;signInRequested=false;}
      if(snapshot.signedIn&&snapshot.account?.synk_user_id){const renewed=signInStarted;clearSignIn();if(!renewed&&latest?.status==='signed-in'&&latest.accountId===snapshot.account.synk_user_id)return flush();return select('signed-in',snapshot.account.synk_user_id);}
      if(snapshot.error&&snapshot.status!=='restoring'&&!snapshot.error.retryable)clearSignIn();
      return flush();
    },
    // A pending/cancelled OAuth attempt does not change the selected account.
    // Only server-verified completion above commits a new choice. Logout must
    // become durable before the main app reports success or clears its vault.
    beginSignIn(){flush(true);if(closed||failed||authToInitialize&&!initialized||initialization)return false;if(!signInStarted||!['signing-in','restoring'].includes(authStatus)){clearSignIn();signInRequested=true;}return true;},
    signOut(){const result=beginSelection('signed-out');if(result)clearSignIn();return result;},
    refresh:flush,available,
    project(snapshot){const recovering=!failed&&latest?.status==='checking',connecting=recovering&&['signing-in','restoring'].includes(snapshot.status);return available()?snapshot:{...snapshot,status:connecting?snapshot.status:'error',signedIn:false,account:null,library:{status:'unavailable',appIds:[]},error:connecting?snapshot.error:{code:'SUITE_UNAVAILABLE',message:recovering?'앱 계정 연결을 복구했어요. SYNK ID로 다시 로그인해 주세요.':'앱 계정 연결을 저장하지 못했어요. 연결을 다시 확인하고 있어요.',retryable:true}};},
    dispose(){closed=true;if(retryTimer!==null)unschedule(retryTimer);retryTimer=null;},
  };
}

function createSuiteFollower({store,auth,schedule=setInterval,unschedule=clearInterval,onError=()=>{}}){
  let current=null,closed=false,timer=null,attempt=null,sequence=0,queue=Promise.resolve(),seen=false;
  function observe(){if(closed)return queue;let next;try{next=store.read();}catch(error){onError(error);next={status:'checking',generation:'unavailable',accountId:null};}
    if(!next&&seen)next={status:'checking',generation:'unavailable',accountId:null};
    if(next)seen=true;
    const marker=next?JSON.stringify([next.status,next.generation,next.accountId]):'standalone';if(marker===current)return queue;current=marker;const expected=++sequence;
    // Fence the renderer and pending requests now, before async logout or OAuth.
    const transition=auth.bindPlatform(next);
    // Only a flow interrupted by coordination may restart. A user cancellation
    // or rejected OAuth result still gets one attempt per platform generation.
    if(transition?.interrupted&&next?.status==='checking')attempt=null;
    queue=queue.catch(()=>{}).then(async()=>{if(closed||expected!==sequence)return;
      if(!next){await auth.initialize();return;}
      if(next.status==='checking')return;
      if(next.status==='signed-out'){attempt=null;await auth.signOut();return;}
      await auth.initialize();if(closed||expected!==sequence)return;
      const snapshot=auth.status();if(snapshot.signedIn&&snapshot.account?.synk_user_id===next.accountId){attempt=next.generation;return;}
      if(snapshot.error?.retryable){attempt=next.generation;return;}
      if(attempt===next.generation)return;attempt=next.generation;
      await auth.signOut();if(closed||expected!==sequence)return;await auth.signIn();
    }).catch(error=>{if(!closed&&expected===sequence)onError(error);});return queue;
  }
  return {start(){void observe();if(timer===null){timer=schedule(()=>void observe(),500);timer?.unref?.();}return queue;},refresh:observe,dispose(){closed=true;sequence++;if(timer!==null)unschedule(timer);timer=null;}};
}
module.exports={suiteKey,validRecord,createSuiteStore,createSuitePublisher,createSuiteFollower};
