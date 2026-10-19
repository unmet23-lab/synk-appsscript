'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const TITLE='SYNK 플레저',BODY='오늘 챙길 일이 있어요. 수첩에서 확인해 주세요.';
const TEST_BODY='이 PC의 알림 연결을 확인했어요. Chrome을 종료해도 SYNK가 알려드려요.';
const WINDOW_MINUTES=90;
function koreaTime(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw Error('INVALID_CLOCK');const text=new Date(date.getTime()+9*3600000).toISOString();return {day:text.slice(0,10),minute:Number(text.slice(11,13))*60+Number(text.slice(14,16))};}
function validPatch(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['enabled','hour','minute'].includes(key))&&(!Object.hasOwn(value,'enabled')||typeof value.enabled==='boolean')&&(!Object.hasOwn(value,'hour')||Number.isInteger(value.hour)&&value.hour>=0&&value.hour<24)&&(!Object.hasOwn(value,'minute')||Number.isInteger(value.minute)&&value.minute>=0&&value.minute<60);}
// The main process owns authentication, the encrypted opt-in and the daily
// receipt. Neither notebook contents nor tokens are persisted by this service.
function createCareNotifications({directory,safeStorage,getAccount,loadCare,shouldNotify,Notification,icon,openCare,onChange=()=>{},now=Date.now,platform=process.platform,enabled=true,configFingerprint='unconfigured',pollMs=60000}){
  let queue=Promise.resolve(),timer,disposed=false,lastCheck=null,lastCode=null,accountKey=null;
  const active=new Set();
  const ordered=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
  const fault=code=>Object.assign(Error(code),{code});
  function available(){try{return enabled&&platform==='win32'&&Notification.isSupported()&&safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';}catch{return false;}}
  function identity(){const value=getAccount();return value?.signedIn===true&&value.status==='signed-in'&&typeof value.account?.synk_user_id==='string'?{owner:value.account.synk_user_id,generation:value.sessionGeneration}:null;}
  const same=expected=>{const current=identity();return !disposed&&!!current&&current.owner===expected.owner&&current.generation===expected.generation;};
  const file=owner=>path.join(directory,crypto.createHash('sha256').update(configFingerprint+'\0'+owner).digest('hex')+'.enc');
  function authorize(expected){if(!available())throw fault('NOTIFICATIONS_UNAVAILABLE');if(!expected)throw fault('AUTH_REQUIRED');if(!same(expected))throw fault('AUTH_CHANGED');return expected;}
  async function read(expected){let bytes;try{bytes=await fs.readFile(file(expected.owner));}catch(error){if(error.code==='ENOENT')return {enabled:false,hour:9,minute:0,attemptDay:null};throw error;}if(bytes.length>16384)throw fault('NOTIFICATION_STORAGE_FAILED');const value=JSON.parse(safeStorage.decryptString(bytes));if(value.version!==1||value.owner!==expected.owner||value.configFingerprint!==configFingerprint||!validPatch({enabled:value.enabled,hour:value.hour,minute:value.minute})||value.attemptDay!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(value.attemptDay))throw fault('NOTIFICATION_STORAGE_FAILED');authorize(expected);return value;}
  async function write(expected,value){authorize(expected);await fs.mkdir(directory,{recursive:true});const target=file(expected.owner),temporary=target+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{const bytes=safeStorage.encryptString(JSON.stringify({...value,version:1,owner:expected.owner,configFingerprint}));await fs.writeFile(temporary,bytes,{flag:'wx',mode:0o600});authorize(expected);await fs.rename(temporary,target);}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}}
  const view=value=>({ok:true,available:available(),signedIn:!!identity(),enabled:value?.enabled===true,hour:value?.hour??9,minute:value?.minute??0,timeZone:'Asia/Seoul',lastCheck,lastCode});
  const failure=error=>({ok:false,available:available(),code:['INVALID_REQUEST','NOTIFICATIONS_UNAVAILABLE','AUTH_REQUIRED','AUTH_CHANGED','CARE_DATA_REQUIRED','CARE_LOAD_FAILED','NOTIFICATION_DISPLAY_FAILED','TEST_RATE_LIMITED'].includes(error.code)?error.code:'NOTIFICATION_STORAGE_FAILED'});
  async function savedCare(expected){const result=await loadCare();authorize(expected);if(result?.ok!==true||result.scope!=='synk-care'||result.accountId!==expected.owner)throw fault('CARE_LOAD_FAILED');if(!result.state)throw fault('CARE_DATA_REQUIRED');return result.state;}
  function clear(){for(const notification of active){try{notification.close();}catch{}}active.clear();}
  function display(expected,test=false){authorize(expected);return new Promise((resolve,reject)=>{let settled=false;const notification=new Notification({title:TITLE,body:test?TEST_BODY:BODY,icon,silent:false,timeoutType:'default'});active.add(notification);const finish=(ok)=>{if(settled)return;settled=true;clearTimeout(timeout);if(ok)resolve({ok:true,displayed:true,test});else reject(fault('NOTIFICATION_DISPLAY_FAILED'));};const timeout=setTimeout(()=>finish(false),12000);notification.once('show',()=>{if(!same(expected)){notification.close();finish(false);}else finish(true);});notification.once('failed',()=>{active.delete(notification);finish(false);});notification.once('close',()=>active.delete(notification));notification.once('click',()=>{active.delete(notification);if(same(expected))void Promise.resolve(openCare()).catch(()=>{});});try{notification.show();}catch{active.delete(notification);finish(false);}});}
  async function tick(){
    const expected=identity();
    return ordered(async()=>{
      try{
        if(!available()||!expected||!same(expected))return view();
        const record=await read(expected);if(!record.enabled)return view(record);
        const time=koreaTime(now()),elapsed=time.minute-record.hour*60-record.minute;
        if(elapsed<0||elapsed>=WINDOW_MINUTES||record.attemptDay===time.day)return view(record);
        const payload=await savedCare(expected);authorize(expected);
        const fresh=koreaTime(now()),freshElapsed=fresh.minute-record.hour*60-record.minute;
        if(fresh.day!==time.day||freshElapsed<0||freshElapsed>=WINDOW_MINUTES)return view(record);
        const due=shouldNotify(payload,{day:time.day,now:new Date(now())});
        lastCheck=new Date(now()).toISOString();lastCode=null;
        if(!due){onChange(view(record));return view(record);}
        // Persist before display: restarts and ambiguous failures must not resend.
        record.attemptDay=time.day;await write(expected,record);
        const result=await display(expected);onChange(view(record));return {...view(record),...result};
      }catch(error){lastCode=error.code||'CARE_LOAD_FAILED';const result=failure(error);onChange(result);return result;}
    });
  }
  const initial=identity();accountKey=initial?initial.owner+'\0'+initial.generation:null;
  return {
    available,
    status(){const expected=identity();return ordered(async()=>{try{if(!available()||!expected)return view();authorize(expected);return view(await read(expected));}catch(error){return failure(error);}});},
    configure(patch){const expected=identity();return ordered(async()=>{try{authorize(expected);if(!validPatch(patch))throw fault('INVALID_REQUEST');const record=await read(expected),next={...record,...patch};if(next.enabled)await savedCare(expected);await write(expected,next);const result=view(next);onChange(result);return result;}catch(error){return failure(error);}});},
    test(){const expected=identity();return ordered(async()=>{try{authorize(expected);const record=await read(expected);if(!record.enabled)throw fault('NOTIFICATIONS_UNAVAILABLE');if(record.lastTestAt&&now()-record.lastTestAt<60000)throw fault('TEST_RATE_LIMITED');await savedCare(expected);record.lastTestAt=now();await write(expected,record);return await display(expected,true);}catch(error){return failure(error);}});},
    tick,
    start(){if(timer||disposed)return;timer=setInterval(()=>void tick(),pollMs);timer.unref?.();void tick();},
    syncAccount(){const owner=identity(),key=owner?owner.owner+'\0'+owner.generation:null;if(key===accountKey)return;accountKey=key;clear();lastCode=null;lastCheck=null;void tick();},
    dispose(){disposed=true;clearInterval(timer);timer=null;clear();},
  };
}
module.exports={createCareNotifications,koreaTime,validPatch,TITLE,BODY,TEST_BODY,WINDOW_MINUTES};
