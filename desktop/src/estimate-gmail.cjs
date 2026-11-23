'use strict';

const { createHash } = require('node:crypto');
const { fault, inspectThread, headerDisplayName, headerAddresses, submissionFlags, sameCurrentBody, originalBodyVersions } = require('./estimate-domain.cjs');
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const SCAN_BODY_DATA_LIMIT = 131072;
const ORIGINAL_BODY_DATA_LIMIT = 1024 * 1024;
const cleanKey = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(v);
const attachmentKey = v => typeof v === 'string' && v.length > 0 && v !== '.' && v !== '..' && v.isWellFormed();
const localThreadId = (box, thread) => createHash('sha256').update(box + '\0' + thread).digest('hex');
const delay = (ms, signal) => require('node:timers/promises').setTimeout(ms, undefined, { signal });

function headerOf(part, name) {
  return (part?.headers || []).find(h => String(h.name).toLowerCase() === name)?.value || '';
}
function isBodyFile(part, parentType) {
  const disposition = headerOf(part, 'content-disposition').trim();
  return /^attachment\b/iu.test(disposition) ||
    (part.filename && parentType !== 'multipart/alternative' && !/^inline\b/iu.test(disposition));
}

async function materializeTextParts(part, load, maxData, retryLater, parentType = '') {
  if (!part || isBodyFile(part, parentType)) return part;
  const type = String(part.mimeType || '').toLowerCase();
  if (type === 'text/plain' || type === 'text/html') {
    const { attachmentId, size } = part.body || {};
    if (!attachmentKey(attachmentId) || size > Math.floor(maxData * 3 / 4)) return part;
    const detached = await load(attachmentId);
    const data = detached?.data;
    if (typeof data === 'string' && data.length > maxData) return part;
    if (typeof data !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/u.test(data)) {
      retryLater?.();
      return part;
    }
    const bytes = Buffer.from(data, 'base64url');
    if (bytes.toString('base64url') !== data.replace(/=+$/u, '') ||
        [size, detached.size].some(length => length !== undefined && length !== bytes.length)) {
      retryLater?.();
      return part;
    }
    return { ...part, body: { size: bytes.length, data } };
  }
  if (!type.startsWith('multipart/') || !Array.isArray(part.parts)) return part;
  const parts = [];
  for (const child of part.parts) parts.push(await materializeTextParts(child, load, maxData, retryLater, type));
  return { ...part, parts };
}

async function withTextParts(item, api, { original = false, signal, retryLater } = {}) {
  if (!cleanKey(item?.id) || typeof api.attachment !== 'function') return item;
  const load = async id => {
    signal?.throwIfAborted();
    try { return await api.attachment(item.id, id); }
    catch (error) {
      signal?.throwIfAborted();
      // A missing body part does not establish that its complete message was deleted.
      if (original && error.httpStatus !== 404) throw error;
      return null;
    }
  };
  const maxData = original ? ORIGINAL_BODY_DATA_LIMIT : SCAN_BODY_DATA_LIMIT;
  const payload = await materializeTextParts(item.payload, load, maxData, retryLater);
  return { ...item, payload };
}

function relatedBodyCids(part, ids) {
  if (!part || /^attachment\b/iu.test(headerOf(part,'content-disposition'))) return;
  if (part.mimeType?.toLowerCase()==='text/html' && typeof part.body?.data==='string') {
    const charset=/\bcharset\s*=\s*["']?([^\s;"']+)/iu.exec(headerOf(part,'content-type'))?.[1] || 'utf-8';
    const {text}=require('./estimate-naver.cjs').decodeBytes(Buffer.from(part.body.data.slice(0,SCAN_BODY_DATA_LIMIT),'base64url'),charset);
    for (const hit of text.matchAll(/\b(?:src|background|href)\s*=\s*["']?cid:([^\s"'<>]+)|\burl\(\s*["']?cid:([^\s"'()<>]+)/giu)) {
      const id=hit[1]||hit[2];
      try { ids.add(decodeURIComponent(id)); } catch { ids.add(id); }
    }
  }
  for (const child of part.parts || []) relatedBodyCids(child,ids);
}
function hasFile(part,parentType='',relatedIds=null) {
  if (!part) return false;
  const disposition=headerOf(part,'content-disposition').trim(),type=String(part.mimeType||'').toLowerCase();
  if (/^attachment\b/iu.test(disposition)) return true;
  const cid=headerOf(part,'content-id').trim().replace(/^<([^<>]+)>$/u,'$1');
  if (parentType==='multipart/related' && type.startsWith('image/') && cid && relatedIds?.has(cid)) return false;
  if (part.filename && parentType!=='multipart/alternative' && !/^inline\b/iu.test(disposition)) return true;
  if (!Array.isArray(part.parts)) return false;
  if (type==='multipart/related') {
    relatedIds=new Set();
    for (const child of part.parts) relatedBodyCids(child,relatedIds);
  }
  return part.parts.some(child=>hasFile(child,type,relatedIds));
}
// A MIME alternative is one rendition of a body. Independent text sections may carry extra terms.
function messageBody(part, parentType='', original=false, relatedImages=null) {
  if (!part || /^attachment\b/iu.test(headerOf(part, 'content-disposition').trim())) return null;
  if (String(part.mimeType || '').toLowerCase() === 'message/rfc822') return { text: '', complete: false };
  const type = String(part.mimeType || '').toLowerCase();
  const maxText = original ? 128000 : 16000;
  if(relatedImages && parentType==='multipart/related' && type.startsWith('image/')){
    const cid=headerOf(part,'content-id').trim().replace(/^<([^<>]+)>$/u,'$1');
    if(!cid && part.filename && !/^inline\b/iu.test(headerOf(part,'content-disposition')))return null;
    relatedImages.parts.add(cid);
    return null;
  }
  if (isBodyFile(part, parentType)) return null;
  if (type === 'text/plain' || type === 'text/html') {
    const data = part.body?.data;
    if (parentType === 'multipart/alternative' && part.body?.size === 0 &&
        !part.body.attachmentId && (data === undefined || data === '')) return null;
    if (typeof data !== 'string') return { text: '', complete: false };
    const { decodeBytes, htmlText } = require('./estimate-naver.cjs');
    const charset = /\bcharset\s*=\s*["']?([^\s;"']+)/i.exec(headerOf(part, 'content-type'))?.[1] || 'utf-8';
    const maxData = original ? ORIGINAL_BODY_DATA_LIMIT : SCAN_BODY_DATA_LIMIT;
    const bytes = Buffer.from(data.slice(0, maxData), 'base64url');
    const decoded = decodeBytes(bytes, charset, data.length > maxData);
    const unattributed=[];
    const text = decoded.doubtful ? '' : type === 'text/html' ? htmlText(decoded.text,unattributed,original,relatedImages) : decoded.text;
    const sizeVerified = part.body.size === bytes.length;
    const complete = Boolean(text) && data.length <= maxData && text.length <= maxText && !part.body.attachmentId &&
      (part.body.size === undefined || sizeVerified);
    return { text: text.slice(0, maxText), complete, sizeVerified, plain: type === 'text/plain', unattributed };
  }
  if (type.startsWith('text/')) return { text: '', complete: false };
  if (!type.startsWith('multipart/')) {
    if (parentType === 'multipart/related' && type.startsWith('image/')) return null;
    return {text:'',complete:false};
  }
  const images=type==='multipart/related' ? {parts:new Set(),decorative:new Set(),informative:new Set()} : relatedImages;
  const candidates = (part.parts || []).map(child=>messageBody(child,type,original,images)).filter(Boolean);
  const unreadImages=type==='multipart/related' && [...images.parts].some(id=>!id || !images.decorative.has(id) || images.informative.has(id));
  if (!candidates.length) return unreadImages ? { text: '', complete: false } : null;
  const { unresolvedQuotes } = require('./estimate-naver.cjs');
  const complete = !unreadImages && candidates.every(candidate => candidate.complete);
  const sizeVerified = candidates.every(candidate => candidate.sizeVerified);
  const alternative = type === 'multipart/alternative';
  if (alternative && !original) {
    const selected = candidates.find(candidate => candidate.plain && candidate.text) ||
      candidates.find(candidate => candidate.text) || candidates[0];
    if (candidates.some(candidate => !sameCurrentBody(candidate.text, selected.text))) return { ...selected, complete: false };
    return { ...selected, complete, sizeVerified, unattributed: unresolvedQuotes(candidates, selected.plain && selected.text) };
  }

  const parts = candidates.filter(candidate => candidate.text.trim());
  const contents = parts.map(candidate => candidate.text.trim());
  const texts = alternative ? originalBodyVersions(contents) : contents;
  const alternatives = alternative && texts.length > 1;
  const displayed = alternatives ? texts.map((text, i) => '[본문 ' + (i + 1) + ']\n' + text) : texts;
  const text = displayed.join('\n\n');
  const unattributed = unresolvedQuotes(candidates, false);
  // A complete mixed body needs a verified byte length for each independent text section.
  const bodyComplete = alternative ? !alternatives : candidates.length === 1 || type === 'multipart/mixed' && sizeVerified;
  return {
    text: text.slice(0, maxText), plain: parts.every(candidate => candidate.plain), unattributed, sizeVerified,
    complete: complete && bodyComplete && text.length <= maxText && (!original || !unattributed.length),
  };
}
function snippetText(value) {
  return String(value || '').replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, match =>
    ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' })[match]);
}

function gmailMessage(item) {
  if (!cleanKey(item?.id) || (item.labelIds!==undefined&&!Array.isArray(item.labelIds)) || !/^\d+$/.test(String(item.internalDate)) || !Number.isSafeInteger(Number(item.internalDate))) {
    throw fault('MAIL_SHAPE', '메일 일부를 읽지 못했어요. 검사를 다시 시도해 주세요.');
  }
  const labels = new Set(item.labelIds), payload = item.payload;
  const senders = (payload?.headers || []).filter(h => String(h.name).toLowerCase() === 'from');
  const senderName = senders.length === 1 ? headerDisplayName(senders[0].value) : '';
  const automatic = headerOf(payload, 'auto-submitted').trim().toLowerCase();
  const to = headerOf(payload, 'to');
  const addresses=names=>(payload?.headers || []).filter(h=>names.includes(String(h.name).toLowerCase()))
    .flatMap(h=>headerAddresses(h.value)).map(deliveryAddress);
  const body = messageBody(payload);
  const source = body?.text ? (body.plain ? 'plain' : 'html') : (body?.unattributed?.length ? 'html' : 'snippet');
  return {
    id: item.id, originalRef:{id:item.id}, at: Number(item.internalDate), senderName, subject: headerOf(payload, 'subject'),
    text: body?.text || (body?.unattributed?.length ? '' : snippetText(item.snippet)), bodySource:source,
    readingReason:body?.unattributed?.length ? '메일 본문에서 이번 문의에 해당하는 내용을 확인해 주세요.' : '',
    partialBody: !body?.complete || !!body.unattributed?.length, outgoing: labels.has('SENT'), draft: labels.has('DRAFT'),
    excluded: labels.has('TRASH') || labels.has('SPAM'), ...submissionFlags(automatic,Boolean(headerOf(payload,'x-autoreply')||headerOf(payload,'x-autorespond'))),
    bulk: !!headerOf(payload, 'list-unsubscribe') || /bulk|list|junk/i.test(headerOf(payload, 'precedence')) || labels.has('CATEGORY_PROMOTIONS'),
    to, cc: headerOf(payload, 'cc'), hasAttachments:hasFile(payload),
    customerAddresses:addresses(['from','reply-to']),
    recipients:addresses(['to','cc','bcc']),
    messageId:headerOf(payload,'message-id').trim(),
    parents:(headerOf(payload,'in-reply-to')+' '+headerOf(payload,'references')).match(/<[^<>\s]+>/gu)||[],
  };
}

function deliveryAddress(address) {
  const normalized = address.toLowerCase();
  const consumer = /^([^@]+)@(?:gmail|googlemail)\.com$/u.exec(normalized);
  if (!consumer) return normalized;
  const local = consumer[1].split('+')[0].replace(/\./gu, '');
  return local + '@gmail.com';
}

// internalDate has millisecond resolution. Opaque Gmail message IDs do not establish chronology.
function orderWithinTimestamp(messages) {
  const groups=new Map(),positions=new Map(messages.map((message,index)=>[message,index])),ranks=new Map(positions),uncertain=new Set();
  for(const m of messages){
    if(m.draft||m.excluded)continue;
    if(!groups.has(m.at))groups.set(m.at,[]);
    groups.get(m.at).push(m);
  }
  for(const [at,group] of groups){
    if(group.length<2)continue;
    const names=new Map(group.filter(m=>/^<[^<>\s]+>$/u.test(m.messageId)).map(m=>[m.messageId,m]));
    const followsProvider=m=>m.parents.every(id=>!names.has(id)||positions.get(names.get(id))<positions.get(m));
    if(names.size!==group.length){
      if(!group.every(followsProvider))uncertain.add(at);
      continue;
    }
    const degree=new Map(),children=new Map(group.map(m=>[m,[]]));
    for(const m of group){
      const parents=new Set(m.parents.map(id=>names.get(id)).filter(Boolean));
      degree.set(m,parents.size);
      for(const parent of parents)children.get(parent).push(m);
    }
    const available=group.filter(m=>degree.get(m)===0);
    let count=0;
    while(available.length===1){
      const m=available.pop();
      ranks.set(m,count++);
      for(const child of children.get(m)){
        degree.set(child,degree.get(child)-1);
        if(degree.get(child)===0)available.push(child);
      }
    }
    if(count!==group.length){
      for(const m of group)ranks.set(m,positions.get(m));
      if(!group.every(followsProvider))uncertain.add(at);
    }
  }
  return {ranks,uncertain};
}

function fromThread(box, item) {
  if (!cleanKey(item?.id) || !Array.isArray(item.messages)) throw fault('MAIL_SHAPE', '대화 내용을 확인하지 못했어요.');
  const messages = item.messages.map(gmailMessage);
  const address = deliveryAddress(box.label);
  const inHeader = line => headerAddresses(line).some(recipient=>deliveryAddress(recipient)===address);
  for (const message of messages) {
    message.copied = inHeader(message.cc) && !inHeader(message.to);
  }
  const order=orderWithinTimestamp(messages);
  const classified = inspectThread(messages,text=>createHash('sha256').update(text).digest('hex'),
    (a,b)=>(order.ranks.get(a)??0)-(order.ranks.get(b)??0));
  const evidence=classified && messages.find(m=>m.id===classified.evidenceId);
  if(classified && (order.uncertain.has(classified.lastAt)||order.uncertain.has(evidence?.at)||order.uncertain.has(classified.customerOrigin?.at))){
    classified.orderUncertain=true;
    classified.status='review';
    classified.quoteRequest=null;
    classified.reason='같은 시각에 받은 메일의 순서를 확인할 수 없어요. 메일함에서 현재 문의를 확인해 주세요.';
  }
  return classified ? { ...classified, originalUrl:gmailOriginalUrl(box.label,classified.originalRef?.id),
    id: localThreadId(box.id,item.id), boxId: box.id, boxLabel: box.label } : null;
}

function gmailOriginalUrl(account, id) {
  return cleanKey(id) ? 'https://mail.google.com/mail/?'+new URLSearchParams({authuser:account,view:'om',th:id}).toString() : '';
}

async function readOriginal({box,ref,api}) {
  if(!cleanKey(ref?.id))throw fault('STALE','메일함을 갱신한 뒤 다시 열어 주세요.');
  const profile=await api.profile();
  if(String(profile?.emailAddress||'').toLowerCase()!==box.label.toLowerCase())throw fault('MAIL_AUTH','연결한 Gmail 메일함을 확인해 주세요.');
  const msg=await api.message(ref.id);
  if(msg?.id!==ref.id)throw fault('STALE','현재 Gmail 메시지를 찾지 못했어요.');
  const { payload } = await withTextParts(msg, api, { original: true });
  const body=messageBody(payload,'',true);
  if(!body?.text?.trim())throw fault('READ','이 메일의 글 본문을 표시할 수 없어요. Gmail에서 확인해 주세요.');
  return {text:body.text,partial:!body.complete||Boolean(body.unattributed?.length)};
}

function createGmailApi({ access, fetcher = fetch, signal, wait = delay }) {
  async function get(resource, params = {}) {
    const url = new URL(API + resource);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(key, value);
    let refreshed = false, refreshNext = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      signal?.throwIfAborted();
      const token = await access(refreshNext);
      refreshNext = false;
      const response = await fetcher(url, { headers: {Authorization: 'Bearer ' + token}, redirect: 'error',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000) });
      if (response.ok) return response.json();
      if (response.status === 401 && !refreshed) {
        refreshed = true;
        refreshNext = true;
        attempt--;
        continue;
      }
      const forbidden = response.status === 403 ? await response.json().catch(() => null) : null;
      const reasons = Array.isArray(forbidden?.error?.errors) ? forbidden.error.errors.map(error => error?.reason) : [];
      const dailyLimit = reasons.includes('dailyLimitExceeded');
      const rateLimited = response.status === 429 || reasons.includes('rateLimitExceeded') || reasons.includes('userRateLimitExceeded');
      const serverProblem = [500, 502, 503, 504].includes(response.status);
      if (!dailyLimit && (rateLimited || serverProblem) && attempt < 4) {
        const retry = Number(response.headers.get('retry-after'));
        await wait(Number.isFinite(retry) && retry > 0 ? Math.min(60000, retry * 1000) : 500 * 2 ** attempt, signal);
        continue;
      }
      const authProblem=!dailyLimit&&!rateLimited&&(response.status===401||response.status===403);
      const error = fault(authProblem?'MAIL_AUTH':'MAIL_PROVIDER',authProblem?'메일 읽기 연결을 확인해 주세요.':
        dailyLimit?'Gmail의 일일 조회 한도에 도달했어요. 한도가 초기화된 뒤 다시 확인해 주세요.':
        rateLimited?'메일 조회 한도에 도달했어요. 잠시 뒤 이어서 확인해 주세요.':
        serverProblem?'Gmail이 잠시 응답하지 않아요. 나중에 다시 확인해 주세요.':'메일 서비스에서 일부 내용을 읽지 못했어요.');
      error.httpStatus = response.status;
      throw error;
    }
    throw fault('MAIL_PROVIDER', '메일 서비스가 아직 응답할 수 없어요.');
  }
  return {
    profile: () => get('/profile'),
    message: id => {
      if(!cleanKey(id))throw fault('MAIL_SHAPE','메일 번호를 확인해 주세요.');
      return get('/messages/'+id,{format:'full',fields:'id,payload'});
    },
    attachment: (messageId, id) => {
      if (!cleanKey(messageId) || !attachmentKey(id)) throw fault('MAIL_SHAPE', '메일 본문의 번호를 확인하지 못했어요.');
      return get('/messages/' + messageId + '/attachments/' + encodeURIComponent(id));
    },
    threads: page => get('/threads', { maxResults: 100, includeSpamTrash: 'true', pageToken: page || undefined }),
    thread: id => { if (!cleanKey(id)) throw fault('MAIL_SHAPE', '메일 대화 번호를 확인하지 못했어요.');
      return get('/threads/' + id, { format: 'full' }); },
    history: (start, page) => get('/history', { startHistoryId: start, maxResults: 100, pageToken: page || undefined }),
  };
}

// Page commits include the cursor and materialized records. On retry, an unfinished page is replayed.
async function scanGmail({ box, api, commit, signal }) {
  signal?.throwIfAborted();
  const profile = await api.profile();
  if (!/^\d+$/.test(String(profile.historyId)) || String(profile.emailAddress).toLowerCase() !== box.label.toLowerCase()) {
    throw fault('MAIL_AUTH', '연결할 때 확인한 메일함과 지금 계정이 달라요.');
  }
  let cursor = box.cursor || { mode: 'list', start: String(profile.historyId), page: null, checked: 0, generation: (box.previousGeneration||0)+1 };
  const pendingTextThreads = new Set(Array.isArray(cursor.pendingTextThreads) ? cursor.pendingTextThreads.filter(cleanKey) : []);
  const retryThisScan = new Set(pendingTextThreads);
  const previousPage = new Set();
  let restarted = false;
  for (;;) {
    signal?.throwIfAborted();
    let page;
    try { page = cursor.mode === 'list' ? await api.threads(cursor.page) : await api.history(cursor.start, cursor.page); }
    catch (error) {
      if (!restarted && (error.httpStatus === 404 && cursor.mode === 'history' || error.httpStatus === 400 && cursor.page)) {
        const fresh = await api.profile();
        if (!/^\d+$/.test(String(fresh.historyId)) || String(fresh.emailAddress).toLowerCase() !== box.label.toLowerCase()) throw fault('MAIL_AUTH', '메일함 연결을 다시 확인해 주세요.');
        cursor = { mode: 'list', start: String(fresh.historyId), page: null, checked: 0, generation: (cursor.generation || 0) + 1 };
        restarted = true;
        previousPage.clear();
        pendingTextThreads.clear();
        retryThisScan.clear();
        await commit({ records: [], cursor, reset: true });
        continue;
      }
      throw error;
    }
    if (!page || (cursor.mode === 'list' && page.threads != null && !Array.isArray(page.threads)) ||
      (cursor.mode === 'history' && page.history != null && !Array.isArray(page.history))) throw fault('MAIL_SHAPE', '메일 목록을 확인하지 못했어요.');
    const ids = new Set();
    if (cursor.mode === 'list') {
      for (const t of page.threads || []) ids.add(t.id);
    } else {
      for (const change of page.history || []) {
        for (const item of change.messages || []) ids.add(item.threadId);
        for (const field of ['messagesAdded','messagesDeleted','labelsAdded','labelsRemoved']) {
          for (const item of change[field] || []) ids.add(item.message?.threadId);
        }
      }
      // A body part can recover without a new Gmail history event.
      if (!page.nextPageToken) for (const id of retryThisScan) ids.add(id);
    }
    const records = [];
    const list = [...ids];
    for (let i = 0; i < list.length; i += 4) {
      signal?.throwIfAborted();
      const items = await Promise.all(list.slice(i,i+4).map(async id => {
        if (!cleanKey(id)) throw fault('MAIL_SHAPE', '메일 대화 번호를 확인하지 못했어요.');
        pendingTextThreads.delete(id);
        retryThisScan.delete(id);
        try { const data = await api.thread(id);
          if (data?.id !== id) throw fault('MAIL_SHAPE', '다른 대화가 돌아와 읽기를 중단했어요.');
          if (!Array.isArray(data.messages)) throw fault('MAIL_SHAPE', '대화 내용을 확인하지 못했어요.');
          const messages = [];
          for (const message of data.messages) {
            messages.push(await withTextParts(message, api, { signal, retryLater: () => pendingTextThreads.add(id) }));
          }
          return { id: localThreadId(box.id,id), value: fromThread(box,{ ...data,messages }) };
        } catch (error) {
          if (error.httpStatus === 404) return { id: localThreadId(box.id,id), value: null };
          throw error;
        }
      }));
      records.push(...items);
    }
    const count = cursor.checked + (cursor.mode === 'list' ? ids.size : 0);
    cursor = { ...cursor, pendingTextThreads: [...pendingTextThreads] };
    signal?.throwIfAborted();
    if (page.nextPageToken) {
      if (typeof page.nextPageToken !== 'string' || previousPage.has(page.nextPageToken) || cursor.page === page.nextPageToken) throw fault('MAIL_SHAPE','같은 메일 목록이 다시 돌아왔어요.');
      previousPage.add(page.nextPageToken);
      cursor = { ...cursor, page: page.nextPageToken, checked: count };
      await commit({ records, cursor });
    } else if (cursor.mode === 'list') {
      cursor = { ...cursor, mode: 'history', page: null, checked: count };
      previousPage.clear();
      await commit({ records, cursor, listFinished: true });
    } else {
      if (!/^\d+$/.test(String(page.historyId))) throw fault('MAIL_SHAPE', '마지막 확인 위치를 읽지 못했어요.');
      cursor = { ...cursor, mode: 'history', start: String(page.historyId), page: null, checked: count };
      await commit({ records, cursor, complete: true });
      return;
    }
  }
}

module.exports = { SCOPE, createGmailApi, scanGmail, fromThread, localThreadId, gmailMessage, gmailOriginalUrl, readOriginal, snippetText };
