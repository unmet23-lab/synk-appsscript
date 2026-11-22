'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {renameSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const {ID:MEMBER}=require('./site-visits.cjs');
const {goodId}=require('./office-task-store.cjs');
const {fail,providers}=require('./office-mail-http.cjs');
const CURSOR_CHUNK=96*1024;
const cursorPart=(page,n)=>page+'.cursor-'+n+'.enc';
function createMailVault(userData,secrets) {
  const writers=new Map(),recovered=new Set();
  function file(member,id) {
    if(typeof member!=='string'||!MEMBER.test(member)||id!==null&&!goodId(id))throw fail('MAIL_STORAGE');
    return path.join(userData,'OfficeMail',member,id===null?'connections.enc':id+'.enc');
  }
  function secure(){if(!secrets?.available())throw fail('MAIL_STORAGE');}
  function pageFile(root,provider,key,index){
    if(!providers.includes(provider)||!goodId(key)||!Number.isSafeInteger(index)||index<1)throw fail('MAIL_STORAGE');
    return path.join(root+'.pages',provider+'-'+key+'-'+index+'.enc');
  }
  async function readValue(name,member,id,part=null,includeSearchTime=false) {
    secure();
    let handle;
    try{
      handle=await fs.open(name,'r');
      const stat=await handle.stat();
      if(stat.size>512*1024)throw fail('MAIL_STORAGE');
      const raw=JSON.parse(secrets.decrypt(await handle.readFile()));
      if(raw.version!==1||raw.member!==member||raw.id!==id||(raw.part??null)!==part||!raw.value||typeof raw.value!=='object')throw fail('MAIL_STORAGE');
      // In the old format the creation of the receipt was also its last modification.
      // Read the date on this handle: a different mailbox may already have replaced the path.
      if(includeSearchTime&&raw.value.plan&&!raw.value.asOf)raw.value.asOf=stat.mtime.toISOString();
      return raw.value;
    }catch(e){if(e.code==='ENOENT'&&part===null)return null;throw fail('MAIL_STORAGE');}
    finally{await handle?.close();}
  }
  async function writeValue(name,member,id,value,guard,published,part=null,beforePublish) {
    secure();
    const dir=path.dirname(name),temp=path.join(dir,randomUUID()+'.tmp');
    const encrypted=secrets.encrypt(JSON.stringify({version:1,member,id,...(part?{part}:{}),value}));
    if(encrypted.length>512*1024)throw fail('MAIL_STORAGE');
    try{
      await fs.mkdir(dir,{recursive:true,mode:0o700});
      await fs.writeFile(temp,encrypted,{flag:'wx',mode:0o600,flush:true});
      for(let retry=0;;retry++){
        if(beforePublish)await beforePublish();
        if(!guard())throw fail('MAIL_CHANGED');
        try{renameSync(temp,name);break;}
        catch(e){if(retry>=3||!['EPERM','EBUSY'].includes(e.code))throw e;await delay(20*(retry+1));}
      }
      published?.();
    }catch(e){throw ['MAIL_CHANGED','NOT_ALLOWED'].includes(e.code)?e:fail('MAIL_STORAGE');}
    finally{await fs.rm(temp,{force:true}).catch(()=>{});}
  }
  function serialize(name,work){
    const job=(writers.get(name)||Promise.resolve()).catch(()=>{}).then(work);
    writers.set(name,job);
    return job.finally(()=>{if(writers.get(name)===job)writers.delete(name);});
  }
  function manifest(group){
    const ref=group.pageFiles;
    if(!ref||!goodId(ref.key)||!Number.isSafeInteger(ref.count)||ref.count<1)throw fail('MAIL_STORAGE');
    return ref;
  }
  function cursorCount(header){
    if(!Number.isSafeInteger(header?.bytes)||header.bytes<=CURSOR_CHUNK)throw fail('MAIL_STORAGE');
    return Math.ceil(header.bytes/CURSOR_CHUNK);
  }
  async function pageCursor(page,name,member,id){
    if(!page.packedCursor)return page.cursor;
    const count=cursorCount(page.packedCursor),chunks=[];
    for(let i=1;i<=count;i++){
      const part=cursorPart(name,i);
      const chunk=await readValue(part,member,id,path.basename(part));
      if(typeof chunk.data!=='string')throw fail('MAIL_STORAGE');
      const bytes=Buffer.from(chunk.data,'base64');
      if(bytes.length!==Math.min(CURSOR_CHUNK,page.packedCursor.bytes-(i-1)*CURSOR_CHUNK))throw fail('MAIL_STORAGE');
      chunks.push(bytes);
    }
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('MAIL_STORAGE');}
  }
  async function read(member,id,{includeSearchTime=false}={}){
    const root=file(member,id);
    return serialize(root,async()=>{
      const receipt=await readValue(root,member,id,null,includeSearchTime);
      if(!Array.isArray(receipt?.groups))return receipt;
      const groups=receipt.groups.map(g=>({...g}));
      for(const group of groups){
        if(!Object.hasOwn(group,'pageFiles'))continue;
        const {key,count}=manifest(group);
        delete group.pageFiles;group.items=group.items.slice();
        for(let i=1;i<=count;i++){
          const name=pageFile(root,group.provider,key,i);
          const page=await readValue(name,member,id,path.basename(name));
          if(!Array.isArray(page.items)||page.items.length>10)throw fail('MAIL_STORAGE');
          group.items.push(...page.items);
          if(i===count){
            const cursor=await pageCursor(page,name,member,id);
            if(cursor!=null)group.cursor=cursor;
          }
        }
      }
      // Keep possible recovery material when the published receipt itself cannot be read.
      // An obsolete cursor can be collected after every referenced page has opened.
      if(id&&receipt.plan&&!receipt.quoteHandoff)await recover(root,receipt).catch(()=>{});
      return {...receipt,groups};
    });
  }
  async function recover(root,receipt){
    if(recovered.has(root))return;
    const dir=root+'.pages';
    const entries=await fs.readdir(dir).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
    const live=new Map();
    for(const group of receipt?.groups||[]){
      if(group.pageFiles){const {key,count}=manifest(group);live.set(group.provider+'-'+key,count);}
    }
    // Only remove application-owned pieces left before the receipt was published.
    for(const name of entries){
      const part=/^(gmail|outlook)-([0-9a-f-]{36})-([1-9][0-9]*)\.enc(\.cursor-[1-9][0-9]*\.enc)?$/i.exec(name);
      const tail=part&&live.get(part[1]+'-'+part[2])||0;
      const orphan=part&&goodId(part[2])&&(Number(part[3])>tail||part[4]&&Number(part[3])!==tail);
      if(orphan||name.endsWith('.tmp')&&goodId(name.slice(0,-4))){
        await fs.rm(path.join(dir,name),{force:true});
      }
    }
    recovered.add(root);
  }
  async function piece(root,member,id,provider,key,index,value,guard,staged){
    const name=pageFile(root,provider,key,index);
    const bytes=value.cursor==null?null:Buffer.from(JSON.stringify(value.cursor),'utf8');
    if(bytes?.length>CURSOR_CHUNK){
      for(let start=0;start<bytes.length;start+=CURSOR_CHUNK){
        const part=cursorPart(name,1+start/CURSOR_CHUNK);
        const data=bytes.subarray(start,start+CURSOR_CHUNK).toString('base64');
        await writeValue(part,member,id,{data},guard,undefined,path.basename(part));
        staged.push(part);
      }
      value={items:value.items,packedCursor:{bytes:bytes.length}};
    }
    await writeValue(name,member,id,value,guard,undefined,path.basename(name));staged.push(name);
  }
  async function discard(files){
    for(const name of files)await fs.rm(name,{force:true}).catch(()=>{});
  }
  async function write(member,id,value,guard,published){
    const root=file(member,id);
    return serialize(root,async()=>{
      if(!id||!value.plan||value.quoteHandoff||!Array.isArray(value.groups))return writeValue(root,member,id,value,guard,published);
      const saved=await readValue(root,member,id);
      if(!saved?.groups?.some(g=>g.pageFiles))await recover(root,saved);
      const groups=[],staged=[];
      try{
        for(const group of value.groups){
          const {items,cursor,...fields}=group;
          const first={...fields,items:items.slice(0,10)};delete first.pageFiles;
          if(items.length>10||cursor!=null){
            const key=randomUUID();let count=0;
            for(let offset=10;;offset+=10){
              const last=offset+10>=items.length;
              const page={items:items.slice(offset,offset+10),...(last&&cursor!=null?{cursor}:{})};
              await piece(root,member,id,group.provider,key,++count,page,guard,staged);
              if(last)break;
            }
            first.pageFiles={key,count};
          }
          groups.push(first);
        }
        await writeValue(root,member,id,{...value,groups},guard,published);
      }catch(e){await discard(staged);throw e;}
    });
  }
  async function appendPage(member,id,provider,expected,next,guard,asOf,beforePublish){
    const root=file(member,id);
    return serialize(root,async()=>{
      const receipt=await readValue(root,member,id);
      const group=receipt?.groups?.find(g=>g.provider===provider);
      if(!group||!receipt.plan||receipt.quoteHandoff||receipt.quoteOutcome)throw fail('MAIL_NOT_FOUND');
      if((group.page??0)!==expected||!group.more)return false;
      if(!Array.isArray(next.items)||next.items.length>10||typeof next.more!=='boolean')throw fail('MAIL_STORAGE');
      const ref=group.pageFiles?manifest(group):{key:id,count:0};
      const count=ref.count+1;
      const page={items:next.items,...(next.more&&next.cursor!=null?{cursor:next.cursor}:{})};
      const staged=[],superseded=[];
      if(ref.count){
        const oldName=pageFile(root,provider,ref.key,ref.count);
        const old=await readValue(oldName,member,id,path.basename(oldName));
        if(old.packedCursor){
          const chunks=cursorCount(old.packedCursor);
          for(let i=1;i<=chunks;i++)superseded.push(cursorPart(oldName,i));
        }
      }
      try{
        await piece(root,member,id,provider,ref.key,count,page,guard,staged);
        group.pageFiles={key:ref.key,count};group.page=expected+1;group.more=next.more;
        delete group.cursor;delete group.code;if(next.code)group.code=next.code;
        if(asOf&&!receipt.asOf)receipt.asOf=asOf;
        await writeValue(root,member,id,receipt,guard,undefined,null,beforePublish);
      }catch(e){await discard(staged);throw e;}
      // Readers hold the same receipt lock. Its old cursor is now unreachable;
      // the original messages in the previous part are still part of the card.
      await discard(superseded);return true;
    });
  }
  return {read,write,appendPage,secure};
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
