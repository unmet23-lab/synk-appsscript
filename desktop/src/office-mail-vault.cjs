'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {renameSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const {ID:MEMBER}=require('./site-visits.cjs');
const {goodId}=require('./office-task-store.cjs');
const {fail,providers}=require('./office-mail-http.cjs');
function createMailVault(userData,secrets) {
  function file(member,id) {
    if(typeof member!=='string'||!MEMBER.test(member)||id!==null&&!goodId(id))throw fail('MAIL_STORAGE');
    return path.join(userData,'OfficeMail',member,id===null?'connections.enc':id+'.enc');
  }
  function secure(){if(!secrets?.available())throw fail('MAIL_STORAGE');}
  async function read(member,id) {
    secure();
    const name=file(member,id);
    try{
      if((await fs.stat(name)).size>512*1024)throw fail('MAIL_STORAGE');
      const raw=JSON.parse(secrets.decrypt(await fs.readFile(name)));
      if(raw.version!==1||raw.member!==member||raw.id!==id||!raw.value||typeof raw.value!=='object')throw fail('MAIL_STORAGE');
      return raw.value;
    }catch(e){if(e.code==='ENOENT')return null;throw fail('MAIL_STORAGE');}
  }
  async function write(member,id,value,guard,published) {
    secure();
    const name=file(member,id),dir=path.dirname(name),temp=path.join(dir,randomUUID()+'.tmp');
    const encrypted=secrets.encrypt(JSON.stringify({version:1,member,id,value}));
    if(encrypted.length>512*1024)throw fail('MAIL_STORAGE');
    try{
      await fs.mkdir(dir,{recursive:true,mode:0o700});
      await fs.writeFile(temp,encrypted,{flag:'wx',mode:0o600});
      if(!guard())throw fail('MAIL_CHANGED');
      renameSync(temp,name);
      published?.();
    }catch(e){throw e.code==='MAIL_CHANGED'?e:fail('MAIL_STORAGE');}
    finally{await fs.rm(temp,{force:true}).catch(()=>{});}
  }
  return {read,write,secure};
}
async function readMailClients(dir=path.join(process.env.LOCALAPPDATA||'','synk','solio-office-dev','office-access')) {
  if(!path.isAbsolute(dir))return {};
  try {
    const file=path.join(dir,'mail-oauth-clients.json');
    if((await fs.stat(file)).size>16384)return {};
    const parsed=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
    const clients={};
    for(const p of providers){
      const row=parsed[p];if(!row||typeof row.clientId!=='string')continue;
      if(p==='gmail'&&/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(row.clientId)&&
        (row.clientSecret==null||typeof row.clientSecret==='string'&&row.clientSecret.length<=512)){
        clients[p]={id:row.clientId,secret:row.clientSecret||''};
      }else if(p==='outlook'&&goodId(row.clientId))clients[p]={id:row.clientId};
    }
    return clients;
  }catch{return {};}
}
module.exports={createMailVault,readMailClients};
