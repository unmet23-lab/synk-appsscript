'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EXCERPT_INDEX_VERSION, REPEAT_REPLIED, fault, emptyState, compactMessage, inspectThread, updateJob, publicView, textValue, choiceApplies, handoffEvidenceMatches } = require('./estimate-domain.cjs');
const {gmailOriginalUrl}=require('./estimate-gmail.cjs');
const {originalMessageUrl}=require('./estimate-outlook.cjs');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const mailboxId=(provider,subject)=>hash(provider+'\0'+subject);
const workload = status => ['reply','promise','draft'].includes(status) ? 0 : status==='review' ? 1 : 2;
function inspectStoredThread(messages,provider) {
  if(provider!=='naver')return inspectThread(messages);
  const folders=new Map();
  for(const message of messages){
    const ref=message.originalRef;
    const known=ref?.folder && Number.isSafeInteger(ref.uidvalidity) && ref.uidvalidity>0 && Number.isSafeInteger(ref.uid) && ref.uid>0;
    folders.set(message,known ? JSON.stringify([ref.folder,ref.uidvalidity]) : '');
  }
  // An IMAP UID has an order only within the same mailbox and UIDVALIDITY.
  const result=inspectThread(messages,undefined,(a,b)=>{
    const left=folders.get(a),right=folders.get(b);
    return left===right ? (left ? a.originalRef.uid-b.originalRef.uid : 0) : left.localeCompare(right);
  });
  if(!result)return null;
  const evidenceAt=messages.find(m=>m.id===result.evidenceId)?.at;
  const tiedOriginals=new Map();
  for(const at of new Set([evidenceAt,result.lastAt,result.customerOrigin?.at].filter(Number.isFinite))){
    const tied=messages.filter(m=>!m.excluded && !m.draft && m.at===at);
    if(new Set(tied.map(m=>m.id)).size<=1)continue;
    const scope=folders.get(tied[0]);
    if(!scope || tied.some(m=>folders.get(m)!==scope)){
      result.orderUncertain=true;
      for(const m of tied){
        if(!folders.get(m))continue;
        const {folder,uidvalidity,uid}=m.originalRef;
        const location=JSON.stringify([folder,uidvalidity,uid]);
        tiedOriginals.set(location,{messageId:m.id,at:m.at,subject:m.subject || '(제목 없음)',ref:m.originalRef});
      }
    }
  }
  if(result.orderUncertain)result.tiedOriginals=[...tiedOriginals.values()];
  return result;
}
function secureAvailable(safe) {
  try { return safe?.isEncryptionAvailable() === true && safe.getSelectedStorageBackend?.() !== 'basic_text'; }
  catch { return false; }
}
function openVault({root,owner,safe,now=Date.now}) {
  if(typeof owner!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(owner))throw fault('AUTH','로그인이 필요해요.');
  if(!secureAvailable(safe))throw fault('SECURE_STORAGE','이 기기의 보호 저장소에 연결할 수 없어요.');
  const dir=path.join(root,hash(owner));
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(path.join(dir,'work.sqlite'));
  let key;
  function transaction(fn){
    db.exec('BEGIN IMMEDIATE');
    try { const out=fn(); db.exec('COMMIT'); return out; }
    catch(error){ db.exec('ROLLBACK'); throw error; }
  }
  try {
    db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS vault(k TEXT PRIMARY KEY, v BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS boxes(id TEXT PRIMARY KEY, v BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS thread_choice(id TEXT PRIMARY KEY,box TEXT NOT NULL,v BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS thread_links(box TEXT NOT NULL, key TEXT NOT NULL, group_id TEXT NOT NULL,PRIMARY KEY(box,key));
      CREATE INDEX IF NOT EXISTS linked_group ON thread_links(box,group_id);
      CREATE TABLE IF NOT EXISTS sent_proof(box TEXT NOT NULL,key TEXT NOT NULL,PRIMARY KEY(box,key));
      CREATE TABLE IF NOT EXISTS pending_moves(box TEXT NOT NULL, id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY, box TEXT NOT NULL, priority INTEGER, at INTEGER, generation INTEGER, v BLOB NOT NULL);
      CREATE INDEX IF NOT EXISTS thread_order ON threads(priority,at DESC);
      CREATE INDEX IF NOT EXISTS thread_box ON threads(box,generation);
      CREATE TABLE IF NOT EXISTS staging(box TEXT NOT NULL,id TEXT NOT NULL,group_id TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 0,v BLOB NOT NULL,PRIMARY KEY(box,id));
      CREATE INDEX IF NOT EXISTS staging_group ON staging(box,group_id);`);
    if(!db.prepare('PRAGMA table_info(staging)').all().some(col=>col.name==='generation')){
      db.exec('ALTER TABLE staging ADD COLUMN generation INTEGER NOT NULL DEFAULT 0');
    }
    key=transaction(()=>{
      const old=db.prepare("SELECT v FROM vault WHERE k='key'").get();
      if(old){ const value=safe.decryptString(Buffer.from(old.v)); if(!/^[a-f0-9]{64}$/.test(value))throw Error('INVALID_DATA'); return Buffer.from(value,'hex'); }
      const newKey=crypto.randomBytes(32);
      db.prepare("INSERT INTO vault(k,v) VALUES ('key',?)").run(safe.encryptString(newKey.toString('hex')));
      return newKey;
    });
  } catch(error){ db.close();throw fault('SECURE_STORAGE','이 회원의 보호된 자료를 열 수 없어요.'); }
  function seal(purpose,value){
    const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(Buffer.from(owner+'|'+purpose));
    const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),bytes]);
  }
  function unseal(purpose,source){
    const bytes=Buffer.from(source);
    try {
      const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
      decipher.setAAD(Buffer.from(owner+'|'+purpose));decipher.setAuthTag(bytes.subarray(12,28));
      return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
    } catch { throw fault('READ','보호된 자료를 읽지 못했어요. 원본을 보존했어요.'); }
  }
  const boxById=id=>{const r=db.prepare('SELECT v FROM boxes WHERE id=?').get(id);return r?unseal('box:'+id,r.v):null;};
  const boxes=()=>db.prepare('SELECT id,v FROM boxes ORDER BY rowid').all().map(r=>unseal('box:'+r.id,r.v));
  const saveBox=box=>db.prepare('INSERT INTO boxes(id,v) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET v=excluded.v').run(box.id,seal('box:'+box.id,box));
  const getThread=id=>{const row=db.prepare('SELECT v FROM threads WHERE id=?').get(id);return row?unseal('thread:'+id,row.v):null;};
  const pendingMove=id=>Boolean(db.prepare('SELECT 1 FROM pending_moves WHERE id=?').get(id));
  const fingerprint = value => crypto.createHmac('sha256',key).update(JSON.stringify(value)).digest('hex');
  const boundEvidence = (thread,sourceId) => fingerprint([EXCERPT_INDEX_VERSION,thread.boxId,sourceId,thread.subject,
    thread.request,thread.evidence,thread.reading || null,thread.quoteRequest,thread.receiptReply || null,thread.receiptHistory || null]);
  const currentEvidence = thread => thread?.evidenceSchema === EXCERPT_INDEX_VERSION && !thread.orderUncertain ? thread.evidenceId : null;
  function fullFolderScanPending(box) {
    if (typeof box.fullScanPending === 'boolean') return box.fullScanPending;
    // Previous vaults kept the provider cursor before storing a separate completion flag.
    const cursor=box.cursor;
    return cursor?.provider===box.provider && (cursor.phase==='scan' || cursor.phase==='verify' ||
      cursor.phase==='done' && cursor.coverage?.partial===true);
  }
  const waitingForScan=(generation,box)=>(box?.provider==='naver'||box?.provider==='outlook') &&
    (fullFolderScanPending(box) || generation!==(box.stageGeneration || 1));
  function pendingEvidence(thread){
    if(!thread)return false;
    if(pendingMove(thread.id))return true;
    const row=db.prepare('SELECT generation FROM threads WHERE id=? AND box=?').get(thread.id,thread.boxId);
    return !row || waitingForScan(row.generation,boxById(thread.boxId));
  }
  function readChoices(thread,box){
    if(box?.provider!=='naver'||!thread.orderUncertain||thread.evidenceSchema!==EXCERPT_INDEX_VERSION)return [];
    let candidates=thread.tiedOriginals;
    if(!Array.isArray(candidates)){
      const rows=db.prepare('SELECT id,v FROM staging WHERE box=? AND group_id=? AND generation=?').all(box.id,thread.id,box.stageGeneration||1);
      const messages=rows.map(row=>unseal('msg:'+box.id+row.id,row.v));
      candidates=inspectStoredThread(messages,box.provider)?.tiedOriginals || [];
    }
    return candidates.map(({messageId,at,subject,ref})=>{
      const readId='original-'+fingerprint([thread.boxId,thread.id,thread.evidenceId,messageId,at,ref]);
      const folder=ref.folder.toUpperCase()==='INBOX' ? '받은메일함' : ref.folder;
      return {readId,label:folder+' · '+subject,subject,ref};
    });
  }
  function effectiveThread(thread){
    if(!thread?.receiptReply)return thread;
    const history=thread.receiptHistory || [];
    const readCount=thread.receiptReadCount || (thread.receiptConfirmed ? history.length+1 : 0);
    if(!readCount)return thread;
    const index=history.length-readCount;
    const next=index>=0 ? history[index] : thread.receiptReply;
    return {...thread,...next,evidenceId:thread.evidenceId,lastAt:thread.lastAt,activityId:thread.activityId,
      needsTermsReview:index>=0 && Boolean(next.needsTermsReview),
      receiptReply:index>=0 ? thread.receiptReply : null,receiptConfirmed:index<0,
      reason:index<0 && next.status==='reply' ? '보낸 원문을 확인했어요. 원래 문의의 견적을 이어갈 수 있어요.' : next.reason};
  }
  const putThread=(item,generation,verified=true,continuity=null)=>{
    const old=getThread(item.id);
    const messageId = item.sourceEvidenceId || item.evidenceId || '';
    if(verified){
      const before=continuity || old;
      const unchanged=currentEvidence(before) && boundEvidence(before,before.sourceEvidenceId)===boundEvidence(item,messageId);
      // Only consecutive observations of the same terms share an approval. A later return to old terms is a new decision.
      item={...item,sourceEvidenceId:messageId,evidenceId:unchanged ? before.evidenceId : crypto.randomUUID(),evidenceSchema:EXCERPT_INDEX_VERSION};
      // The sender's latest reply can rotate quote approval without changing the customer request that an employee accepted.
      const origin=item.customerOrigin;
      const proven=!item.orderUncertain && origin?.id && origin.stamp && Number.isFinite(origin.at);
      if(proven){
        const customerFingerprint=fingerprint([item.boxId,origin.id,origin.at,origin.stamp,origin.subject,origin.terms]);
        const continuous=currentEvidence(before) && before.boxId===item.boxId && before.customerFingerprint===customerFingerprint;
        item.customerRequestId=continuous ? before.customerRequestId :
          before?.customerRequestId ? crypto.randomUUID() : item.evidenceId;
        item.customerFingerprint=customerFingerprint;
        item.customerMessageKey=origin.messageKey ? fingerprint([item.boxId,origin.messageKey]) : null;
        item.customerMessageAt=origin.at;
      } else {
        delete item.customerRequestId;
        delete item.customerFingerprint;
        delete item.customerMessageKey;
        delete item.customerMessageAt;
      }
      if(unchanged && item.receiptReply){
        item.receiptReadCount=before.receiptReadCount || 0;
        item.receiptConfirmed=Boolean(before.receiptConfirmed);
      }
    }
    // 앱이 읽은 답장으로 세운 「지난번처럼 해줘」 잠금은 같은 고객 요청이 이어지는 동안 남긴다.
    // 답장을 메일함에서 영구 삭제해도 고객은 이미 받았다. 새 고객 요청만 잠금을 푼다(0.5.8 검수 GPT-P).
    const prior=continuity || old;
    if(prior?.repliedSinceRequest===true && item.repliedSinceRequest===false && prior.boxId===item.boxId &&
        (prior.sourceEvidenceId||prior.evidenceId)===(item.sourceEvidenceId||item.evidenceId))item.repliedSinceRequest=true;
    if(!item.manual){
      let choice=old && choiceApplies(item,old.manual) ? old.manual : null;
      if(!choice){const row=db.prepare('SELECT v FROM thread_choice WHERE id=? AND box=?').get(item.id,item.boxId);if(row)choice=unseal('choice:'+item.id,row.v);}
      if(choice && choiceApplies(item,choice))item.manual=choice;
    }
    const priority=workload(choiceApplies(item)?item.manual.status:effectiveThread(item).status);
    db.prepare(`INSERT INTO threads(id,box,priority,at,generation,v) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET priority=excluded.priority,at=excluded.at,generation=excluded.generation,v=excluded.v`)
      .run(item.id,item.boxId,priority,item.lastAt,generation,seal('thread:'+item.id,item));
  };
  function getWork(){
    const item=db.prepare("SELECT v FROM vault WHERE k='work'").get();
    return item ? unseal('work',item.v):{jobs:[],quotes:[],handoffs:[]};
  }
  function saveWork(work){db.prepare("INSERT INTO vault(k,v) VALUES('work',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(seal('work',work));}
  function register({provider,label,subject,credential}){
    const id=mailboxId(provider,subject);
    return transaction(()=>{
      const previous=boxById(id);
      const box={phase:'ready',checked:0,detail:'처음부터 확인할 준비가 되었어요.',...previous,id,label,subject,provider,credential};
      saveBox(box);return id;
    });
  }
  function updateBox(id,fn){return transaction(()=>{const b=boxById(id);if(!b)throw fault('MISSING','등록한 메일함을 찾지 못했어요.');fn(b);saveBox(b);});}
  function joinGroups(box,from,to){
    if(from===to)return;
    const sourceThread=getThread(from), destinationThread=getThread(to);
    if(pendingMove(from) || sourceThread?.orderUncertain || destinationThread?.orderUncertain){
      db.prepare('INSERT OR IGNORE INTO pending_moves(box,id) VALUES(?,?)').run(box,to);
      db.prepare('DELETE FROM pending_moves WHERE id=?').run(from);
    }
    db.prepare('UPDATE staging SET group_id=? WHERE box=? AND group_id=?').run(to,box,from);
    db.prepare('UPDATE thread_links SET group_id=? WHERE box=? AND group_id=?').run(to,box,from);
    const source=db.prepare('SELECT v FROM thread_choice WHERE box=? AND id=?').get(box,from);
    if(source){
      const dest=db.prepare('SELECT v FROM thread_choice WHERE box=? AND id=?').get(box,to);
      if(!dest||(sourceThread?.lastAt||0)>(destinationThread?.lastAt||0)){
        const choice=unseal('choice:'+from,source.v);
        db.prepare('INSERT INTO thread_choice(id,box,v) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET v=excluded.v').run(to,box,seal('choice:'+to,choice));
      }
      db.prepare('DELETE FROM thread_choice WHERE box=? AND id=?').run(box,from);
    }
    const work=getWork();
    let changed=false;
    for(const record of [...work.quotes,...work.handoffs]){
      if(record.threadId===from){record.threadId=to;changed=true;}
    }
    if(changed)saveWork(work);
    if(sourceThread&&(!destinationThread||sourceThread.lastAt>destinationThread.lastAt||
      sourceThread.lastAt===destinationThread.lastAt&&sourceThread.evidenceId>destinationThread.evidenceId)){
      const row=db.prepare('SELECT generation FROM threads WHERE box=? AND id=?').get(box,from);
      putThread({...sourceThread,id:to},row.generation,Boolean(currentEvidence(sourceThread)),sourceThread);
    }
    db.prepare('DELETE FROM threads WHERE box=? AND id=?').run(box,from);
  }
  function relatedGroup(box,entry){
    const primary=hash(box+'\0'+entry.threadId);
    if(!Array.isArray(entry.threadLinks)||!entry.threadLinks.length)return primary;
    const keys=[...new Set([primary,...entry.threadLinks.map(k=>hash(box+'\0'+k))])];
    const read=db.prepare('SELECT group_id FROM thread_links WHERE box=? AND key=?');
    const existing=keys.map(key=>read.get(box,key)?.group_id).filter(Boolean);
    const group=existing[0]||primary;
    for(const other of new Set(existing))if(other!==group)joinGroups(box,other,group);
    const add=db.prepare('INSERT INTO thread_links(box,key,group_id) VALUES(?,?,?) ON CONFLICT(box,key) DO UPDATE SET group_id=excluded.group_id');
    for(const key of keys)add.run(box,key,group);
    return group;
  }
  function stageMessages(box,part,generation){
    const groups=new Set();
    const previous=db.prepare('SELECT group_id FROM staging WHERE box=? AND id=?');
    const write=db.prepare('INSERT INTO staging(box,id,group_id,generation,v) VALUES(?,?,?,?,?) ON CONFLICT(box,id) DO UPDATE SET group_id=excluded.group_id,generation=excluded.generation,v=excluded.v');
    for(const entry of part.messages||[]){
      if(!entry || typeof entry.id!=='string'||!entry.id||typeof entry.threadId!=='string'||!entry.threadId||!Number.isFinite(entry.at))throw fault('MAIL_SHAPE','일부 메일을 읽지 못했어요.');
      const id=hash(entry.id),grp=relatedGroup(box.id,entry);
      const prior=previous.get(box.id,id);
      if(prior&&prior.group_id!==grp&&box.provider==='naver'&&entry.threadLinks?.length){
        joinGroups(box.id,prior.group_id,grp);
      }
      if(prior)groups.add(prior.group_id);
      groups.add(grp);
      const compact={id:entry.evidenceId?hash(entry.evidenceId):id,at:entry.at,...compactMessage(entry,hash)};
      if(prior && compact.id!==id){
        const old=getThread(grp);
        if(old && old.sourceEvidenceId===id && currentEvidence(old)){
          const sameMessage={...old,sourceEvidenceId:compact.id};
          putThread(sameMessage,db.prepare('SELECT generation FROM threads WHERE id=?').get(grp).generation,true,sameMessage);
        }
      }
      // Folder UIDs alone cannot distinguish a new Naver inquiry from a moved copy.
      if(box.provider==='naver')compact.customerStableId=entry.customerStableId || null;
      if(entry.uncertain)compact.uncertain=textValue(entry.uncertain,240);
      for(const field of ['outgoing','draft','copied','automatic','generated','bulk','excluded','directionUncertain','possibleSelf','hasAttachments'])compact[field]=entry[field]===true;
      if((box.provider==='outlook'||box.provider==='naver')&&entry.evidenceId){
        const proof='sender-verified:'+compact.id;
        const unknown='sender-unconfirmed:'+compact.id;
        if(box.provider==='outlook' && compact.directionUncertain && !compact.draft)
          db.prepare('INSERT OR IGNORE INTO sent_proof(box,key) VALUES(?,?)').run(box.id,unknown);
        if(compact.outgoing&&!compact.draft)db.prepare('INSERT OR IGNORE INTO sent_proof(box,key) VALUES(?,?)').run(box.id,proof);
        if(!compact.draft&&!entry.unreadable&&(box.provider==='outlook'||entry.possibleSelf)&&
          db.prepare('SELECT 1 FROM sent_proof WHERE box=? AND key=?').get(box.id,proof)){
          compact.outgoing=true;delete compact.uncertain;delete compact.directionUncertain;
        } else if (box.provider==='outlook' && !compact.draft && !entry.receivedByMember &&
          db.prepare('SELECT 1 FROM sent_proof WHERE box=? AND key IN (?,?) LIMIT 1').get(box.id,compact.id,unknown)) {
          // Older versions recorded folder membership alone. It cannot establish who sent this message.
          compact.directionUncertain=true;
          compact.uncertain='보낸 기록이 있는 메일의 발신자를 확인해 주세요.';
        }
      }
      write.run(box.id,id,grp,generation,seal('msg:'+box.id+id,compact));
    }
    for(const removed of part.removed||[]){
      const id=hash(removed),prior=previous.get(box.id,id);
      if(prior){
        groups.add(prior.group_id);
        // A folder delta can announce removal well before the destination folder is read.
        db.prepare('INSERT OR IGNORE INTO pending_moves(box,id) VALUES(?,?)').run(box.id,prior.group_id);
      }
      db.prepare('DELETE FROM staging WHERE box=? AND id=?').run(box.id,id);
    }
    for(const group of groups){
      if(!pendingMove(group))updateStagedThread(box,group,generation,false);
      // An incremental Outlook page may contain the incoming message before the sent folder catches up.
      if(box.provider==='outlook' && part.cursor?.provider==='outlook' && !part.complete && !fullFolderScanPending(box)){
        db.prepare('INSERT OR IGNORE INTO pending_moves(box,id) VALUES(?,?)').run(box.id,group);
      }
    }
  }
  function updateStagedThread(box,group,generation,final){
    const rows=db.prepare('SELECT id,v FROM staging WHERE box=? AND group_id=? AND generation=?').all(box.id,group,generation);
    const result=inspectStoredThread(rows.map(row=>unseal('msg:'+box.id+row.id,row.v)),box.provider);
    const old=db.prepare('SELECT generation,at FROM threads WHERE box=? AND id=?').get(box.id,group);
    // While rebuilding a mailbox, do not replace the last complete judgement with a partially seen older thread.
    if(!final && old){
      const previous=getThread(group);
      if(!previous.orderUncertain && old.generation!==generation && (!result||old.at>result.lastAt))return;
      if(previous.orderUncertain || old.generation!==generation && old.at===result?.lastAt && (previous.sourceEvidenceId||previous.evidenceId)!==result.evidenceId){
        db.prepare('INSERT OR IGNORE INTO pending_moves(box,id) VALUES(?,?)').run(box.id,group);
        return;
      }
    }
    if(result)putThread({...result,id:group,boxId:box.id,boxLabel:box.label},generation);
    else db.prepare('DELETE FROM threads WHERE box=? AND id=?').run(box.id,group);
  }
  function commit(id,part){
    return transaction(()=>{
      const box=boxById(id); if(!box)throw fault('MISSING','메일함 연결이 끝났어요.');
      if(part.reset)box.stageGeneration=(box.stageGeneration||1)+1;
      const generation=box.provider==='gmail'?Number(part.cursor?.generation)||1:box.stageGeneration||1;
      if(part.messages?.length||part.removed?.length)stageMessages(box,part,generation);
      for(const entry of part.records||[]){
        if(entry.value){
          putThread(entry.value,generation);
          db.prepare('DELETE FROM pending_moves WHERE box=? AND id=?').run(id,entry.id);
        } else if(getThread(entry.id)){
          db.prepare('INSERT OR IGNORE INTO pending_moves(box,id) VALUES(?,?)').run(id,entry.id);
        }
      }
      const coverage=part.coverage;
      const incomplete=coverage?.partial===true||Number(coverage?.unreadable)>0;
      // 네이버는 보낸 편지함의 읽지 못한 편지만 메일함 전체를 기다리게 한다. 다른 폴더의 읽지 못한 편지는 제 대화에서
      // 확인 대상으로 남는다(0.5.8 검수 c Fable — 스팸 한 통이 모든 문의를 「원문을 확인 중」으로 묶었다).
      const blocking=box.provider==='naver' && Number.isSafeInteger(coverage?.unreadableSent) ? coverage.unreadableSent>0 : incomplete;
      if(box.provider==='naver'||box.provider==='outlook'){
        // Another folder can still supply a sent quote until the full mailbox scan commits.
        box.fullScanPending=!(part.complete && !blocking) && (Boolean(part.reset) || fullFolderScanPending(box));
      }
      if(box.provider==='gmail'&&part.complete&&!incomplete){
        db.prepare('DELETE FROM threads WHERE box=? AND (generation<>? OR id IN (SELECT id FROM pending_moves WHERE box=?))').run(id,generation,id);
        db.prepare('DELETE FROM pending_moves WHERE box=?').run(id);
      }
      if(part.complete&&!blocking&&box.provider!=='gmail'){
        const deferred=db.prepare('SELECT id FROM threads t WHERE t.box=? AND t.generation<>? AND EXISTS (SELECT 1 FROM staging s WHERE s.box=t.box AND s.group_id=t.id AND s.generation=?) UNION SELECT id FROM pending_moves WHERE box=?').all(id,generation,generation,id);
        for(const thread of deferred)updateStagedThread(box,thread.id,generation,true);
        db.prepare('DELETE FROM pending_moves WHERE box=?').run(id);
        db.prepare('DELETE FROM staging WHERE box=? AND generation<>?').run(id,generation);
        db.prepare('DELETE FROM threads WHERE box=? AND generation<>?').run(id,generation);
      }
      box.excerptIndexVersion=EXCERPT_INDEX_VERSION;
      box.cursor=part.cursor;
      box.phase=part.complete?(incomplete?'partial':'complete'):'scanning';
      box.checked=db.prepare('SELECT count(*) AS n FROM threads WHERE box=? AND generation=?').get(id,generation).n;
      if(part.complete&&!incomplete)box.completedAt=now();
      box.detail=part.complete?(incomplete?'메일함의 일부만 확인했어요. 다시 확인해 주세요.':'등록한 메일함을 끝까지 확인했어요.'):'확인한 위치를 저장했어요. 아직 조사 중이에요.';
      if(part.detail)box.detail=textValue(part.detail,240);
      if(part.complete&&coverage?.label)box.detail=textValue(coverage.label,240);
      if(part.complete&&coverage?.limitedFolders>0)box.detail+=' 본문 미리보기만 확인한 폴더가 '+coverage.limitedFolders+'개예요.';
      if(Number(coverage?.unreadable)>0)box.detail='내용을 읽지 못한 메일이 '+Number(coverage.unreadable)+'통 있어요. 다시 확인해 주세요.';
      saveBox(box);
    });
  }
  function confirmReceipt(input){
    return transaction(()=>{
      const thread=getThread(input.threadId);
      if(!thread?.receiptReply || thread.receiptConfirmed || pendingEvidence(thread) ||
         !input.evidenceId || currentEvidence(thread)!==input.evidenceId)throw fault('STALE','보낸 원문이 바뀌었어요. 다시 확인해 주세요.');
      const {generation}=db.prepare('SELECT generation FROM threads WHERE id=?').get(thread.id);
      thread.receiptReadCount=(thread.receiptReadCount || 0)+1;
      thread.receiptConfirmed=thread.receiptReadCount>(thread.receiptHistory?.length || 0);
      thread.evidenceId=crypto.randomUUID();
      delete thread.manual;
      putThread(thread,generation,false);
    });
  }
  function runAction(name,input){
    return transaction(()=>{
      const work=getWork();
      const threadId = name === 'accept' || name === 'finish'
        ? work.handoffs.find(item => item.id === input?.id)?.threadId : input?.threadId;
      const old=threadId?getThread(threadId):null;
      if(pendingEvidence(old) || !old && threadId && pendingMove(threadId))throw fault('STALE','현재 문의의 원문을 확인 중이에요. 메일함 확인이 끝나면 다시 열어 주세요.');
      if(old?.orderUncertain)throw fault('STALE','같은 시각에 받은 메일의 순서를 확인할 수 없어요. 메일함에서 현재 문의를 확인해 주세요.');
      if(old && !currentEvidence(old))throw fault('STALE','이전 버전에서 읽은 메일이에요. 메일함을 다시 확인해 주세요.');
      // 답장을 이미 보낸 문의의 반복 견적은 원문 확인 보류보다 먼저 그 까닭으로 거절한다(원문을 확인해도 열리지 않는다).
      if(old && old.repliedSinceRequest!==false && ['repeatPreview','saveRepeatedQuote'].includes(name))throw fault('VALUE',REPEAT_REPLIED);
      if(old?.receiptReply && !old.receiptConfirmed && ['quote','repeatPreview','saveRepeatedQuote','rememberQuote','handoff','accept'].includes(name)){
        throw fault('VALUE','먼저 보낸 답장의 원문을 확인해 주세요.');
      }
      const effective=effectiveThread(old);
      const state={...work,threads:effective?[effective]:[]};
      const result = updateJob(state,name,input,()=>crypto.randomUUID(),now(),fingerprint);
      if (name === 'repeatPreview') return result;
      if(old&&['mark','reopen'].includes(name)){
        old.manual=effective.manual;
        const {generation}=db.prepare('SELECT generation FROM threads WHERE id=?').get(old.id);
        db.prepare('INSERT INTO thread_choice(id,box,v) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET v=excluded.v').run(old.id,old.boxId,seal('choice:'+old.id,old.manual));
        putThread(old,generation);
      } else saveWork({jobs:state.jobs,quotes:state.quotes,handoffs:state.handoffs});
    });
  }
  function originalTarget(input){
    const thread = effectiveThread(getThread(input.threadId));
    const stale=()=>fault('STALE','메일함을 다시 확인하고 현재 문의를 열어 주세요.');
    if(!thread || pendingEvidence(thread))throw stale();
    const box=boxById(thread.boxId);
    let ref=thread.originalRef,subject=thread.subject;
    if(input.readId){
      if(input.evidenceId || typeof input.readId!=='string')throw stale();
      const choice=readChoices(thread,box).find(item=>item.readId===input.readId);
      if(!choice)throw stale();
      ref=choice.ref;
      subject=choice.subject;
    }else if(!input.evidenceId || input.evidenceId!==currentEvidence(thread))throw stale();
    const outlookLink=box?.provider==='outlook' ? originalMessageUrl(thread.originalUrl) : '';
    const personalOutlook=/@(?:hotmail|outlook|live|msn)\.(?:[a-z]{2,8}(?:\.[a-z]{2})?)$/iu.test(box?.label||'');
    const outlookHome=outlookLink ? new URL('/mail/', outlookLink).href : personalOutlook
      ? 'https://outlook.live.com/mail/' : 'https://www.microsoft.com/ko-kr/microsoft-365/outlook/log-in';
    const homes={gmail:'https://mail.google.com/mail/?'+new URLSearchParams({authuser:box?.label||''}),outlook:outlookHome,naver:'https://mail.naver.com/'};
    if(!box||!Object.hasOwn(homes,box.provider))throw fault('MISSING','현재 문의의 메일함을 찾지 못했어요.');
    const web=box.provider==='gmail'?gmailOriginalUrl(box.label,ref?.id):outlookLink;
    return {box,ref,web,home:homes[box.provider],subject,receiptStamp:thread.receiptReply && !thread.receiptConfirmed ? thread.reading?.stamp : null,
      checkReceipt:Boolean(thread.receiptReply && !thread.receiptConfirmed),needsTermsReview:Boolean(thread.needsTermsReview)};
  }
  function invalidateOriginal(input,expected){
    return transaction(()=>{
      let current;
      try{current=originalTarget(input);}catch(error){if(error.code==='STALE')return false;throw error;}
      if(current.box.id!==expected.box.id || JSON.stringify(current.ref)!==JSON.stringify(expected.ref))return false;
      db.prepare('INSERT OR IGNORE INTO pending_moves(box,id) VALUES(?,?)').run(current.box.id,input.threadId);
      // The next scan must revisit the original even if no new delta mentions its old location.
      current.box.excerptIndexVersion=0;
      saveBox(current.box);
      return true;
    });
  }
  function snapshot(capabilities,limit=200,selectedIds=[]){
    const data=emptyState();
    Object.assign(data,getWork());
    data.boxes=boxes();
    const mailboxMap=new Map(data.boxes.map(box=>[box.id,box]));
    const select='SELECT t.id,t.v,t.generation,p.id AS pending FROM threads t LEFT JOIN pending_moves p ON p.id=t.id';
    const rows=db.prepare(select+' ORDER BY t.priority,t.at DESC,t.id LIMIT ?').all(limit);
    const pageIds=new Set(rows.map(row=>row.id));
    const checkedIds=[...new Set(selectedIds)];
    const byId=db.prepare(select+' WHERE t.id=?');
    for(const id of checkedIds){
      if(pageIds.has(id))continue;
      const row=byId.get(id);
      if(row)rows.push(row);
    }
    data.threads=rows.map(row=>{
      const thread=unseal('thread:'+row.id,row.v);
      const box=mailboxMap.get(thread.boxId);
      const pending=row.pending || waitingForScan(row.generation,box);
      if(!pending && currentEvidence(thread))return effectiveThread(thread);
      const choices=pending ? [] : readChoices(thread,box).map(({readId,label,subject})=>({readId,label,subject}));
      const reason=pending ? '메일함에서 현재 문의의 원문을 확인 중이에요.' : thread.orderUncertain
        ? '같은 시각의 메일이 여러 개예요. 어느 메일이 최신인지 원문을 확인해 주세요.'
        : '이전 버전에서 읽은 메일이에요. 메일함을 다시 확인해 주세요.';
      const outlookProgress=pending && box?.provider==='outlook';
      const status=outlookProgress && choiceApplies(thread) && thread.manual.status==='done' ? 'done' : 'review';
      return {id:thread.id,boxId:thread.boxId,boxLabel:thread.boxLabel,subject:thread.subject,lastAt:thread.lastAt,
        evidenceId:'',evidence:'',request:outlookProgress ? thread.request : '',replyDraft:'',quoteRequest:null,status,kind:thread.kind,reason,awaitingEvidence:true,originalChoices:choices};
    });
    const evidence = new Map(data.threads.map(thread => [thread.id,thread]));
    for (const record of [...data.quotes,...data.handoffs]) {
      if (record.threadId && !evidence.has(record.threadId)){
        const thread=getThread(record.threadId);
        evidence.set(record.threadId,!pendingEvidence(thread) && currentEvidence(thread) ? effectiveThread(thread) : null);
      }
      const thread=evidence.get(record.threadId);
      record.currentEvidence = record.status==='accepted' ? handoffEvidenceMatches(record,thread)
        : Boolean(record.evidenceId && record.evidenceId === thread?.evidenceId);
    }
    const result=publicView(data,capabilities);
    result.checkedThreadIds=checkedIds;
    result.selectedThreads=result.threads.filter(thread=>!pageIds.has(thread.id));
    result.threads=result.threads.filter(thread=>pageIds.has(thread.id));
    result.threadCount=db.prepare('SELECT count(*) AS n FROM threads').get().n;
    result.hasMore=result.threadCount>pageIds.size;
    return result;
  }
  function forget(id){return transaction(()=>{
    const work=getWork(), owned=new Set(db.prepare('SELECT id FROM threads WHERE box=?').all(id).map(r=>r.id));
    work.quotes=work.quotes.filter(q=>!owned.has(q.threadId)&&q.boxId!==id);
    work.handoffs=work.handoffs.filter(h=>!owned.has(h.threadId)&&h.boxId!==id);
    saveWork(work);
    db.prepare('DELETE FROM thread_choice WHERE box=?').run(id);
    db.prepare('DELETE FROM thread_links WHERE box=?').run(id);
    db.prepare('DELETE FROM sent_proof WHERE box=?').run(id);
    db.prepare('DELETE FROM pending_moves WHERE box=?').run(id);
    db.prepare('DELETE FROM staging WHERE box=?').run(id);db.prepare('DELETE FROM threads WHERE box=?').run(id);db.prepare('DELETE FROM boxes WHERE id=?').run(id);
  });}
  return { register,boxById,boxes,updateBox,commit,runAction,confirmReceipt,originalTarget,invalidateOriginal,snapshot,forget,close(){try{db.close();}finally{key.fill(0);}} };
}
module.exports={openVault,secureAvailable,mailboxId};
