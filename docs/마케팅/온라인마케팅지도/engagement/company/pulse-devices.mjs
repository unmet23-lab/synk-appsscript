import {createHash} from 'node:crypto';

const DAY=86400000;
export const PULSE_DEVICE_DAYS=30;
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=()=>Object.assign(new Error('고객 연결이 종료됐습니다. 담당자에게 새 초대 링크를 요청해 주세요.'),{status:401});

// A remembered device is created only by explicit push opt-in. The invitation's
// deadline admits NEW devices; its revision continues to revoke existing ones.
export function createPulseDeviceService({store,clock=()=>new Date().toISOString()}){
  function current(hash){
    if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))return null;
    const stored=store.db.prepare("SELECT * FROM tokens WHERE hash=? AND purpose='pulse-device' AND expiresAt>?").get(hash,clock());
    if(!stored)return null;
    const auth={...stored,body:JSON.parse(stored.body)},row=store.get('clientProjects',auth.body.projectId);
    if(!row||row.stage==='archived'||!row.inviteHash||row.inviteRevision!==auth.body.inviteRevision)return null;
    return {auth,row};
  }
  function read(raw){return typeof raw==='string'&&/^[A-Za-z0-9_-]{43}$/.test(raw)?current(digest(raw)):null;}
  function describe(device){return {remembered:!!device,expiresAt:device?.auth.expiresAt||null,renewalDays:PULSE_DEVICE_DAYS};}
  function remember(session,raw){
    const existing=read(raw);
    if(existing&&existing.row.id===session.row.id&&existing.row.inviteRevision===session.row.inviteRevision){
      return {raw,device:existing,created:false};
    }
    const at=clock(),expiresAt=new Date(Date.parse(at)+PULSE_DEVICE_DAYS*DAY).toISOString();
    const value=store.mint('pulse-device',null,{projectId:session.row.id,inviteRevision:session.row.inviteRevision,csrf:session.auth.body.csrf,createdAt:at,lastUsedAt:at},PULSE_DEVICE_DAYS*24*60);
    const hash=digest(value);store.db.prepare('UPDATE tokens SET expiresAt=? WHERE hash=?').run(expiresAt,hash);
    return {raw:value,device:current(hash),created:true};
  }
  function bind(session,device){
    const live=current(device.auth.hash);if(!live||live.row.id!==session.row.id||live.row.inviteRevision!==session.row.inviteRevision)throw fail();
    const body={...session.auth.body,csrf:live.auth.body.csrf,deviceHash:live.auth.hash};
    store.db.prepare("UPDATE tokens SET body=? WHERE hash=? AND purpose='pulse-session'").run(JSON.stringify(body),session.auth.hash);
  }
  function resume(raw){
    const device=read(raw);if(!device)return null;
    const value=store.mint('pulse-session',null,{projectId:device.row.id,inviteRevision:device.row.inviteRevision,csrf:device.auth.body.csrf,deviceHash:device.auth.hash},720);
    const expiresAt=new Date(Math.min(Date.parse(clock())+12*3600000,Date.parse(device.auth.expiresAt))).toISOString();
    store.db.prepare('UPDATE tokens SET expiresAt=? WHERE hash=?').run(expiresAt,digest(value));
    return {raw:value,device};
  }
  function touch(raw){
    const device=read(raw);if(!device)return null;
    const at=clock(),expiresAt=new Date(Date.parse(at)+PULSE_DEVICE_DAYS*DAY).toISOString();
    // Avoid a DB write per range request/live heartbeat. The caller additionally
    // limits renewal to foreground project reads and deliberate writes.
    if(Date.parse(expiresAt)-Date.parse(device.auth.expiresAt)>3600000){
      store.db.prepare("UPDATE tokens SET expiresAt=?,body=? WHERE hash=? AND purpose='pulse-device'").run(expiresAt,JSON.stringify({...device.auth.body,lastUsedAt:at}),device.auth.hash);
    }
    return current(device.auth.hash);
  }
  function forget(hash,{keepSessionHash=null}={}){
    store.db.prepare("DELETE FROM tokens WHERE hash=? AND purpose='pulse-device'").run(hash);
    for(const session of store.db.prepare("SELECT hash,body FROM tokens WHERE purpose='pulse-session'").all()){
      const body=JSON.parse(session.body);if(body.deviceHash!==hash)continue;
      if(session.hash===keepSessionHash){
        // Turning off push forgets the device, but must not log the customer
        // out of this already-admitted short session after the invite deadline.
        delete body.deviceHash;body.acceptedInvite=true;
        store.db.prepare('UPDATE tokens SET body=? WHERE hash=?').run(JSON.stringify(body),session.hash);
      }
      else store.db.prepare('DELETE FROM tokens WHERE hash=?').run(session.hash);
    }
  }
  return {current,read,describe,remember,bind,resume,touch,forget};
}
