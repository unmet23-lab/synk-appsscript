import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import runtime from '../../../../../tools/lib/generated/talk-publication.cjs';
import dmTools from '../../../../../tools/lib/sns-dm.js';
import {normalizePublicationDm} from './social-dm-contract.mjs';
import {canManageOwners,canReadChannel} from './organization.mjs';

const KIND='socialDmRegistrations',SECRET='social-dm-talk';
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
const hash=value=>createHash('sha256').update(stable(value)).digest('hex');
const need=(ok,message)=>{if(!ok)throw new Error(message);};
const clone=value=>JSON.parse(JSON.stringify(value));
const stoppedStates=new Set(['material_expired','receipt_conflict']);
const failureState=error=>({
  publication_permission_changed:'permission_required',publication_approval_changed:'approval_changed',
  publication_material_expired:'material_expired',publication_registration_conflict:'receipt_conflict',
})[error?.message]||'verification_required';

// Reuses the Talk CLI state machine/uploader. The only new remote operation is
// read-only ownership/registration inspection, so no management PAT is needed.
export function createTalkPublicationAdapters({configuration,driveRegistry,mediaId,handoff,fetchImpl=fetch,authorize=()=>{},signal}){
  const c=configuration;
  need(/^[a-z0-9]{20}$/.test(c?.projectRef||'')&&typeof c.serviceRoleKey==='string'&&c.serviceRoleKey.length>=20,'talk_unconfigured');
  const transport=fetchImpl;
  fetchImpl=(url,options={})=>{
    authorize();signal?.throwIfAborted();
    return transport(url,{...options,...(signal?{signal:options.signal?AbortSignal.any([signal,options.signal]):signal}:{})});
  };
  const admin=async(task,body)=>{
    const response=await fetchImpl(`https://${c.projectRef}.supabase.co/functions/v1/synkbrief-dm?task=${task}`,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+c.serviceRoleKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
    need(response.ok,'talk_request_unconfirmed');
    const text=await response.text();need(text.length<=131072,'talk_response_invalid');return JSON.parse(text);
  };
  const inspect=()=>admin('publication-inspect',{account_id:handoff.campaign.account_id,account_handle:handoff.account_handle,
    post_url:handoff.post_url,...(mediaId?{media_id:mediaId}:{}),campaign_id:handoff.campaign.campaign_id});
  const getCredentials=async()=>{
    const registry=JSON.parse(await readFile(driveRegistry,'utf8'));
    const rows=registry.connections?.filter(row=>row.email==='unmet23@gmail.com');
    need(rows?.length===1,'drive_connection_unavailable');const source=rows[0].credentials;
    need(source&&['client_id','client_secret','refresh_token'].every(k=>typeof source[k]==='string'&&source[k]),'drive_connection_unavailable');
    return {client_id:source.client_id,client_secret:source.client_secret,refresh_token:source.refresh_token};
  };
  let googleToken;
  const json=async response=>{need(response.ok,'drive_read_unconfirmed');const text=await response.text();need(text.length<=2097152,'drive_response_invalid');return JSON.parse(text);};
  const metadata=async id=>{
    need(/^[A-Za-z0-9_-]{10,200}$/.test(id),'file_id_invalid');
    if(!googleToken){const credentials=await getCredentials();const result=await json(await fetchImpl('https://oauth2.googleapis.com/token',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({...credentials,grant_type:'refresh_token'})}));need(typeof result.access_token==='string','drive_auth_unavailable');googleToken=result.access_token;}
    return json(await fetchImpl('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields='+encodeURIComponent('id,name,mimeType,parents,trashed,ownedByMe,owners(emailAddress),version,sha256Checksum,size,webViewLink,resourceKey,shortcutDetails,driveId'),{
      redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+googleToken}}));
  };
  return {metadata,inspectPost:async()=>{const result=await inspect();need(result.ok===true,'post_ownership_unverified');return result.post;},
    campaign:async()=>{const result=await inspect();need(result.ok===true,'campaign_read_unconfirmed');return result.campaign;},
    registerFolder:body=>admin('drive-register',body),catchUp:body=>admin('publication-check',body),
    readManifest:({folder_id,library_root})=>runtime.createDriveClient({getCredentials,fetchImpl,rootId:library_root}).readCampaignFolder(folder_id),
    upload:runtime.createManifestUploader({getCredentials,fetchImpl}).upload};
}

export function createSocialDmRegistration({store,dataDir,clock=()=>new Date().toISOString(),fetchImpl=fetch,configuration,
  adapterFactory=createTalkPublicationAdapters}){
  const now=()=>new Date(clock()).toISOString();
  const config=()=>configuration?.()||store.secret(SECRET)||{};
  const configured=()=>{const c=config();return /^[a-z0-9]{20}$/.test(c.projectRef||'')&&typeof c.serviceRoleKey==='string'&&c.serviceRoleKey.length>=20;};
  const change=(id,patch)=>{const next={...store.get(KIND,id),...patch,updatedAt:now()};store.put(KIND,id,next);return next;};
  let running=false,closed=false,controller=null;const idle=[];
  function make(job,channel){
    const variant=job?.snapshot?.variant,raw=variant?.dm;
    need(!(raw?.duration_mode==='fixed'&&Date.parse(raw.ends_at)<=Date.parse(now())),'publication_material_expired');
    let dm;try{dm=normalizePublicationDm(raw,channel,{now:Date.parse(now())});}catch{throw Error('publication_contract_invalid');}
    need(dm&&job.status==='published'&&(!job.providerId||/^\d{5,40}$/.test(job.providerId))&&/^[a-f0-9]{64}$/.test(job.approvalHash||''),'publication_receipt_unverified');
    const post_url=dmTools.instagramUrl(job.publicationUrl);
    const publication_hash=hash({jobId:job.id,approvalHash:job.approvalHash,contentVersion:job.contentVersion,
      post:job.snapshot.post,variant,post_url,mediaId:job.providerId||null,accountId:channel.externalId});
    return {schema_version:1,publication_hash,account_handle:channel.handle,post_url,
      campaign:{...dm,campaign_id:'pub-'+hash({jobId:job.id,dm,post_url}).slice(0,40)},receipt_at:job.publishedAt};
  }
  function recordFailure({job,error}){
    const current=store.get('socialPublishJobs',job?.id);
    if(!current?.snapshot?.variant?.dm)return {skipped:true};
    const old=store.get(KIND,current.id),state=failureState(error);
    // Retain any previous binding/journal: correcting a receipt must never
    // authorize a new campaign or overwrite evidence of an uncertain write.
    const row={id:current.id,jobId:current.id,channelId:current.channelId,attempts:0,createdAt:now(),...old,
      state,updatedAt:now(),nextAttemptAt:null,rejectedAtEnqueue:true};
    store.put(KIND,row.id,row);return {id:row.id,state};
  }
  function enqueue({job}){
    const current=store.get('socialPublishJobs',job?.id);
    if(!current?.snapshot?.variant?.dm)return {skipped:true};
    const channel=store.get('channels',current.channelId);let handoff;
    try{handoff=make(current,channel);}catch(error){return recordFailure({job:current,error});}
    const fingerprint=hash(handoff),old=store.get(KIND,current.id);
    if(old){
      if(old.fingerprint!==fingerprint)return recordFailure({job:current,error:Error('publication_registration_conflict')});
      return {id:old.id,state:old.state};
    }
    const row={id:current.id,jobId:current.id,channelId:current.channelId,connectionVersion:channel.connectionVersion||0,
      fingerprint,handoff,mediaId:current.providerId||null,state:'pending',attempts:0,createdAt:now(),updatedAt:now(),nextAttemptAt:now(),journal:null};
    store.put(KIND,row.id,row);return {id:row.id,state:row.state};
  }
  function assertCurrent(row){
    need(!closed,'registration_stopped');
    const job=store.get('socialPublishJobs',row.jobId),channel=store.get('channels',row.channelId),user=store.get('users',job?.approverId);
    need(channel?.active!==false&&channel?.hidden!==true&&(channel?.connectionVersion||0)===row.connectionVersion&&user?.active&&canManageOwners(user,channel),'publication_permission_changed');
    const fingerprint=hash(make(job,channel));
    need(fingerprint===row.fingerprint,'publication_approval_changed');
    return job;
  }
  async function run(row){
    try{
      assertCurrent(row);
      if(!configured()){change(row.id,{state:'connection_required',nextAttemptAt:new Date(Date.parse(now())+60000).toISOString()});return;}
      const previous=row.state;
      change(row.id,{state:'running',attempts:row.attempts+1});
      const adapter=adapterFactory({configuration:config(),driveRegistry:path.join(dataDir,'drive-storage.json'),mediaId:row.mediaId,handoff:clone(row.handoff),fetchImpl,
        authorize:()=>assertCurrent(row),signal:controller?.signal});
      // Every network write is preceded by the current immutable receipt/owner
      // check. Catch-up remains the existing idempotent Talk queue.
      for(const key of ['upload','registerFolder','catchUp']){
        const operation=adapter[key];adapter[key]=async(...args)=>{assertCurrent(row);return operation(...args);};
      }
      const service=runtime.createPublication({...adapter,now:()=>Date.parse(now()),
        loadJournal:()=>store.get(KIND,row.id).journal,
        saveJournal:journal=>{assertCurrent(row);change(row.id,{journal});}});
      const stage=store.get(KIND,row.id).journal?.stage;
      if(['running','needs_reconciliation'].includes(previous)||['uploading','needs_reconciliation'].includes(stage)){
        const proof=await service.run(row.handoff,{apply:false,waitMs:0});
        assertCurrent(row);
        if(!(proof.ok===true&&proof.registered===true)){change(row.id,{state:'needs_reconciliation',nextAttemptAt:new Date(Date.parse(now())+300000).toISOString()});return;}
      }
      assertCurrent(row);
      const result=await service.run(row.handoff,{apply:true,waitMs:0});
      assertCurrent(row);
      if(result.ok===true&&result.state==='registered'&&result.catchup_verified===true&&/^D\d{4,}$/.test(result.routing_code||'')){
        change(row.id,{state:'registered',routingCode:result.routing_code,registeredAt:now(),nextAttemptAt:null});return;
      }
      change(row.id,{state:['awaiting_sync','pending_catchup','needs_reconciliation'].includes(result.state)?result.state:'needs_reconciliation',
        nextAttemptAt:new Date(Date.parse(now())+60000).toISOString()});
    }catch(error){
      // A provider error can contain credentials or subscriber data. Persist a
      // fixed status only; an uncertain upload is never blindly repeated.
      const stage=store.get(KIND,row.id)?.journal?.stage;
      const classified=failureState(error);
      const state=classified!=='verification_required'?classified
        :['uploading','needs_reconciliation','complete'].includes(stage)?'needs_reconciliation'
        :['awaiting_sync','pending_catchup'].includes(stage)?stage:'verification_required';
      change(row.id,{state,nextAttemptAt:stoppedStates.has(state)?null:new Date(Date.parse(now())+300000).toISOString()});
    }
  }
  async function tick(){
    if(running||closed)return {processed:0};running=true;controller=new AbortController();let processed=0;
    try{for(const row of store.all(KIND).filter(r=>r.state!=='registered'&&!stoppedStates.has(r.state)&&!r.rejectedAtEnqueue&&(!r.nextAttemptAt||r.nextAttemptAt<=now())).slice(0,5)){
      if(closed)break;await run(row);processed++;
    }return {processed};}finally{running=false;controller=null;idle.splice(0).forEach(resolve=>resolve());}
  }
  function status(user){
    const live=store.get('users',user?.id);need(live?.active,'authentication_required');
    const items=store.all(KIND).filter(row=>canReadChannel(live,store.get('channels',row.channelId))).map(row=>({
      jobId:row.jobId,channelId:row.channelId,state:row.state,routingCode:row.routingCode||null,updatedAt:row.updatedAt}));
    return {configured:configured(),items};
  }
  async function close(){closed=true;controller?.abort();if(running)await new Promise(resolve=>idle.push(resolve));}
  return {enqueue,recordFailure,tick,status,close};
}
