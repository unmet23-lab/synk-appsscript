'use strict';

const {randomUUID,createHash}=require('node:crypto');
const { EXCERPT_INDEX_VERSION, compactMessage, fault, textValue } = require('./estimate-domain.cjs');
const { openVault, secureAvailable, mailboxId } = require('./estimate-store.cjs');
const { authorize, tokenRequest } = require('./estimate-auth.cjs');
const { createGmailApi, scanGmail, readOriginal:readGmailOriginal } = require('./estimate-gmail.cjs');

const providers=['gmail','naver','outlook'];
const knownFailure = new Set(['VALUE','MISSING','STALE','AUTH','CANCELLED','SECURE_STORAGE','READ','CONFIG','MAIL_AUTH','MAIL_PROVIDER','MAIL_SHAPE','MAIL_FOLDER','MAIL_CHANGING','MAIL_NETWORK','MAIL_TIMEOUT','MAIL_TLS','MAIL_LIMIT','MAIL_LINK','BUSY','AUTH_CHANGED']);
function publicProblem(error){
  if(knownFailure.has(error?.code))return {ok:false,code:error.code,message:textValue(error.message,260)};
  return {ok:false,code:'TEMPORARY',message:'업무 메일 작업을 마치지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.'};
}
function createEstimateService({root,owner,safe,isCurrent,readConfig,openExternal,onChange=()=>{},fetcher=fetch,
  makeVault=openVault,oauth=authorize,refresh=tokenRequest,gmailApi=createGmailApi,gmailScan=scanGmail,
  naver, outlook, now=Date.now}) {
  const lifetime=new AbortController(),active=new Map();
  const disconnected=new Map(),connections=new Map();
  let receiptRead=null;
  let connectionRevision=0;
  let snapshotSequence=0;
  let selectedThreadIds=[];
  let vault,limit=200,configuration,started=false,connecting=false;
  const naverTools=()=>naver||require('./estimate-naver.cjs');
  const outlookTools=()=>outlook||require('./estimate-outlook.cjs');
  const unchanged=()=>{
    if(lifetime.signal.aborted||!isCurrent())throw fault('AUTH_CHANGED','로그인이 바뀌어 기존 요청을 중단했어요.');
  };
  function database(){unchanged();return vault ||= makeVault({root,owner,safe,now});}
  function connection(id) {
    if(!connections.has(id))connections.set(id,{abort:new AbortController(),tokens:null,updating:null});
    return connections.get(id);
  }
  function invalidateConnection(id){
    const current=connections.get(id);if(current)current.abort.abort();
    connections.delete(id);
    if(receiptRead?.boxId===id)receiptRead=null;
  }
  function accessFor(box,settings) {
    const slot=connection(box.id), signal=AbortSignal.any([slot.abort.signal,lifetime.signal]);
    return async (force=false)=>{
      unchanged();signal.throwIfAborted();
      if(!force&&slot.tokens?.expiresAt>now()+45000)return slot.tokens.accessToken;
      if(!slot.updating)slot.updating=(async()=>{
        const store=database(),current=store.boxById(box.id);
        if(!current)throw fault('CANCELLED','메일 연결이 끝났어요.');
        const token=await refresh(box.provider,settings[box.provider],{grant_type:'refresh_token',refresh_token:current.credential.refresh},fetcher,signal);
        unchanged();signal.throwIfAborted();
        if(token.refresh)store.updateBox(box.id,value=>{value.credential={refresh:token.refresh};});
        slot.tokens=token;return token.accessToken;
      })().finally(()=>{slot.updating=null;});
      return slot.updating;
    };
  }
  async function config(){
    if(!configuration || configuration.warning){
      try{configuration=await readConfig();}
      catch(error){
        if(error?.code!=='CONFIG')throw error;
        configuration={warning:'Gmail과 Outlook의 연결 설정 파일을 읽지 못했어요. 네이버와 저장한 작업은 사용할 수 있어요.'};
      }
    }
    unchanged();return configuration;
  }
  function capabilities(settings){
    const available=secureAvailable(safe);
    const readyProviders=available?providers.filter(p=>p==='naver'||settings[p]):[];
    return {providers,readyProviders,connect:readyProviders.length>0,import:false,
      connectionNote:available?(settings.warning||'네이버는 IMAP 앱 비밀번호로 연결해요. Gmail과 Outlook은 솔리오 전용 앱 연결 설정이 필요해요.'):'이 기기의 보호 저장소를 사용할 수 없어요.'};
  }
  async function snapshot(selection){
    try {
      if(selection!==undefined){
        if(!Array.isArray(selection)||selection.length>2||!selection.every(id=>typeof id==='string'&&id.length>0&&id.length<=256)){
          throw fault('VALUE','선택한 문의를 다시 열어 주세요.');
        }
        const next=[...new Set(selection)];
        if(next.length!==selectedThreadIds.length || next.some(id=>!selectedThreadIds.includes(id)))receiptRead=null;
        selectedThreadIds=next;
      }
      const selected=selectedThreadIds,sequence=++snapshotSequence;
      const settings=await config(), data=database().snapshot(capabilities(settings),limit,selected);
      for(const thread of [...(data.threads || []),...(data.selectedThreads || [])]){
        const proof=receiptRead;
        if(thread.needsReceiptReview && proof?.token && proof.threadId===thread.id && proof.evidenceId===thread.evidenceId && proof.boxId===thread.boxId &&
           connections.get(proof.boxId)===proof.slot)thread.receiptToken=proof.token;
      }
      data.snapshotSequence=sequence;
      return {ok:true,data};
    }
    catch(error){return publicProblem(error);}
  }
  const changed=()=>{if(isCurrent()&&!lifetime.signal.aborted)onChange();};
  function stopScan(id){
    const task=active.get(id);
    active.delete(id);
    task?.abort();
  }
  function start(id) {
    unchanged();
    if(active.has(id))return;
    const store=database(),box=store.boxById(id);
    if(!box)return;
    if(box.cursor && box.excerptIndexVersion!==EXCERPT_INDEX_VERSION){
      box.previousGeneration=Number(box.cursor.generation)||0;
      box.cursor=null;
    }
    const abort=new AbortController(),signal=AbortSignal.any([abort.signal,lifetime.signal]);
    active.set(id,abort);
    const check=()=>{unchanged();signal.throwIfAborted();if(!store.boxById(id))throw fault('CANCELLED','메일 연결이 끝났어요.');};
    const commit=async part=>{check();store.commit(id,part);changed();};
    void (async()=>{
      try {
        store.updateBox(id,b=>{b.phase='scanning';b.startedAt=now();b.detail='업무 메일을 확인하고 있어요.';});changed();
        if(box.provider==='naver'){
          await naverTools().scanNaver({box,credential:box.credential,commit,signal});
        } else {
          const settings=await config();
          if(!settings[box.provider]) throw fault('CONFIG','이 메일 서비스의 앱 연결 설정이 필요해요.');
          const access=accessFor(box,settings);
          if(box.provider==='gmail')await gmailScan({box,api:gmailApi({access,fetcher,signal}),commit,signal});
          else await outlookTools().scanOutlook({box,access,commit,signal,fetcher});
        }
      } catch(error){
        if(!signal.aborted&&isCurrent()&&!lifetime.signal.aborted){
          const problem=publicProblem(error);
          try{store.updateBox(id,b=>{b.phase='partial';b.detail='일부만 확인했어요. '+problem.message;});}catch{}
        }
      } finally {if(active.get(id)===abort)active.delete(id);changed();}
    })();
  }
  async function connect(input){
    const provider=input?.provider||'gmail';
    if(!providers.includes(provider))throw fault('VALUE','메일 서비스를 선택해 주세요.');
    // 설정을 읽기 전에 순번을 적는다. 읽는 사이에 해제한 메일함을 이 요청이 되살리지 않게 한다(0.5.8 검수 GPT-O).
    const consentRevision=connectionRevision;
    const store=database(),settings=await config(),signal=lifetime.signal;
    if(connecting)throw fault('BUSY','다른 메일 연결을 먼저 마쳐 주세요.');
    connecting=true;
    try {
      let label,subject,credential;
      if(provider==='naver'){
        const address=textValue(input.address,254).toLowerCase();
        if(!/^[a-z0-9._-]{1,64}@naver\.com$/.test(address)||typeof input.password!=='string'||!input.password||input.password.length>256)throw fault('VALUE','네이버 메일 주소와 앱 비밀번호를 확인해 주세요.');
        const verified=await naverTools().verifyNaver({address,password:input.password,signal});
        unchanged();
        if(String(verified?.address).toLowerCase()!==address)throw fault('MAIL_AUTH','선택한 네이버 업무 메일을 확인하지 못했어요.');
        label=address;subject=address;credential={address,password:input.password};
      } else {
        if(!settings[provider])throw fault('CONFIG',(provider==='gmail'?'Gmail':'Outlook')+' 연결을 위한 솔리오 앱 등록이 필요해요.');
        const token=await oauth({provider,client:settings[provider],openExternal,fetcher,signal});
        unchanged();
        const access=()=>token.accessToken;
        if(provider==='gmail'){
          const info=await gmailApi({access,fetcher,signal}).profile();
          label=String(info.emailAddress||'').toLowerCase();subject=label;
        }else{
          const info=await outlookTools().outlookProfile({access,fetcher,signal});
          label=String(info.address||'').toLowerCase();subject=String(info.subject||'');
        }
        if(!/^[^\s@]+@[^\s@]+$/.test(label)||!subject||subject.length>320)throw fault('MAIL_AUTH','등록할 업무 메일의 주소를 확인하지 못했어요.');
        credential={refresh:token.refresh};
      }
      unchanged();
      const previousId=mailboxId(provider,subject);
      if((disconnected.get(previousId)||0)>consentRevision)throw fault('CANCELLED','메일함을 연결 해제해서 이전 연결 요청을 취소했어요.');
      invalidateConnection(previousId);
      stopScan(previousId);
      const id=store.register({provider,label,subject,credential});
      start(id);
    } finally {connecting=false;}
  }
  async function openMessage(name,input) {
    const target=database().originalTarget(input);
    const {box,ref}=target;
    const confirming=name==='confirmReceipt',previous=receiptRead;
    if(confirming && (!target.checkReceipt || !previous?.token || previous.threadId!==input.threadId ||
      previous.evidenceId!==input.evidenceId || previous.token!==input.receiptToken || connections.get(box.id)!==previous.slot)){
      throw fault('STALE','현재 보낸 원문을 먼저 열어 확인해 주세요.');
    }
    // This window displays one original. A later open or a changed selection supersedes its proof.
    receiptRead=null;
    let read;
    if(target.checkReceipt) {
      read={threadId:input.threadId,boxId:box.id,evidenceId:input.evidenceId,slot:connection(box.id),token:null};
      receiptRead=read;
    }
    if(previous?.token)changed();
    function latest() {
      unchanged();
      if(read && receiptRead!==read)throw fault('STALE','다시 연 원문을 확인해 주세요.');
    }
    if(name!=='readOriginal' && !confirming){
      const url=name==='openMailbox'?target.home:target.web;
      if(!url)throw fault('MISSING','이 메일은 솔리오에서 원문을 열어 주세요.');
      await openExternal(url);
      latest();
      if(name!=='openOriginal' || !read)return {ok:true};
      // A web sign-in page cannot confirm this reply. Show the same original in the app.
    }
    if(!ref)throw fault('STALE','메일함을 갱신한 뒤 원문을 열어 주세요.');
    const signal=AbortSignal.any([lifetime.signal,connection(box.id).abort.signal]);
    let body;
    try{
      if(box.provider==='naver')body=await naverTools().readOriginal({box,ref,signal});
      else{
        const settings=await config();
        if(!settings[box.provider])throw fault('CONFIG','메일 서비스의 연결 설정이 필요해요.');
        const access=accessFor(box,settings);
        body=box.provider==='gmail'?await readGmailOriginal({box,ref,api:gmailApi({access,fetcher,signal})})
          :await outlookTools().readOriginal({box,ref,access,fetcher,signal});
      }
    }catch(error){
      if(signal.aborted)throw fault('CANCELLED','메일 연결이 끝났어요.');
      latest();
      if(error.code==='STALE' || error.httpStatus===404){
        unchanged();
        if(database().invalidateOriginal(input,target)){
          stopScan(box.id);
          changed();
        }
        throw fault('STALE','메일이 이동했거나 삭제됐어요. 메일함을 갱신해 주세요.');
      }
      throw error;
    }
    latest();signal.throwIfAborted();
    const current=database().originalTarget(input);
    if(JSON.stringify(current.ref)!==JSON.stringify(ref))throw fault('STALE','메일 위치가 바뀌었어요. 다시 열어 주세요.');
    const text=textValue(body?.text,128000);
    if(!text)throw fault('READ','표시할 글 본문이 없어요. 원래 메일함을 확인해 주세요.');
    const identity=input.readId ? {readId:input.readId} : {evidenceId:input.evidenceId};
    const partial=Boolean(body.partial||body.text.length>128000);
    let receiptToken;
    if(read && current.checkReceipt && !partial && input.evidenceId){
      const fresh=compactMessage({text,subject:current.subject,outgoing:true},value=>createHash('sha256').update(value).digest('hex'));
      const bodyDigest=createHash('sha256').update(text).digest('hex');
      if(fresh.signals.checkReceipt && !fresh.signals.statedQuoteTerms &&
         Boolean(fresh.signals.termReview)===Boolean(current.needsTermsReview) && fresh.signals.reading.stamp===current.receiptStamp &&
         (!confirming || previous.bodyDigest===bodyDigest)){
        if(confirming){
          database().confirmReceipt(input);
          receiptRead=null;
          changed();
          return {ok:true};
        }
        receiptToken=randomUUID();
        read.token=receiptToken;
        read.bodyDigest=bodyDigest;
        changed();
      }else if(database().invalidateOriginal(input,current)){
        stopScan(box.id);
        changed();start(box.id);
      }
    }
    if(confirming)throw fault('STALE','보낸 메일의 원문 전체를 다시 열고 확인해 주세요.');
    return {ok:true,...(receiptToken ? {receiptToken} : {}),original:{threadId:input.threadId,...identity,subject:current.subject,text,partial}};
  }
  async function action(name,input={}){
    try {
      unchanged();
      if(!input||typeof input!=='object'||Array.isArray(input))throw fault('VALUE','입력을 확인해 주세요.');
      if(name==='connect')await connect(input);
      else if(name==='scan')for(const box of database().boxes())start(box.id);
      else if(name==='more')limit+=200;
      else if(['openOriginal','openMailbox','readOriginal'].includes(name))return await openMessage(name,input);
      else if(['handoff','quote','mark','reopen'].includes(name)&&(typeof input.evidenceId!=='string'||!input.evidenceId)) {
        throw fault('STALE','대화를 다시 열고 현재 내용을 확인해 주세요.');
      }
      else if(name==='confirmReceipt'){
        await openMessage(name,input);
      }
      else if(name==='disconnect'){
        if(typeof input.id!=='string'||input.confirm!==true)throw fault('VALUE','연결을 해제할 메일함을 확인해 주세요.');
        const store=database();if(!store.boxById(input.id))throw fault('MISSING','메일함을 찾지 못했어요.');
        disconnected.set(input.id,++connectionRevision);
        invalidateConnection(input.id);
        stopScan(input.id);store.forget(input.id);changed();
      } else if (name === 'repeatPreview') {
        return { ok: true, preview: database().runAction(name,input) };
      } else database().runAction(name,input);
      return await snapshot();
    } catch(error){return publicProblem(error);}
  }
  async function opened(){
    if(started)return;started=true;
    try {await config();for(const box of database().boxes())start(box.id);}
    catch { /* snapshot carries the connection or vault error back to the user. */ }
  }
  function close(){
    receiptRead=null;lifetime.abort();for(const task of active.values())task.abort();active.clear();
    for(const id of connections.keys())invalidateConnection(id);
    if(vault){vault.close();vault=null;}
  }
  return {snapshot,action,opened,close};
}
module.exports={createEstimateService,publicProblem};
