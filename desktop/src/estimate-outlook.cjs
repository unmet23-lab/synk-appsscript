'use strict';

// Microsoft Graph 위임 권한(Mail.Read, User.Read)으로 본인 기본 사서함을 읽는다.
// Bearer 토큰은 https://graph.microsoft.com/v1.0/me 아래 미리 정한 경로에만 보낸다. 쓰기 요청은 만들지 않는다.
const { createHash } = require('node:crypto');
const { fault, textValue, headerDisplayName, submissionFlags } = require('./estimate-domain.cjs');
const { htmlText } = require('./estimate-naver.cjs');

const ORIGIN = 'https://graph.microsoft.com';
const BASE = ORIGIN + '/v1.0';
const MAX_BODY = 20 * 1024 * 1024;
const MAX_FOLDERS = 5000;
const MAX_ROUNDS = 4;
const TEXT_LIMIT = 16000;
const PAGE = 50;
const WELL_KNOWN = ['inbox', 'sentitems', 'drafts', 'deleteditems', 'junkemail', 'outbox', 'archive', 'searchfolders', 'syncissues', 'conversationhistory'];
const SKIP_TREES = ['searchfolders', 'syncissues', 'conversationhistory'];
const FOLDER_SELECT = 'id,displayName,parentFolderId,childFolderCount';
const SELECT_FULL = 'id,parentFolderId,conversationId,subject,bodyPreview,uniqueBody,isDraft,hasAttachments,receivedDateTime,sentDateTime,createdDateTime,lastModifiedDateTime,from,sender,toRecipients,ccRecipients,internetMessageId,internetMessageHeaders,webLink';
const SELECT_BASIC = 'id,parentFolderId,conversationId,subject,bodyPreview,isDraft,hasAttachments,receivedDateTime,sentDateTime,createdDateTime,lastModifiedDateTime,from,sender,toRecipients,ccRecipients,internetMessageId,webLink';
const ALLOWED_QUERY = new Set(['$select', '$top', '$skip', '$skiptoken', '$deltatoken', 'includeHiddenFolders']);

const hash = (...parts) => createHash('sha256').update(parts.map(String).join('\0')).digest('hex').slice(0, 40);
const graphId = v => typeof v === 'string' && /^[A-Za-z0-9+/=_.-]{1,1024}$/.test(v);
const shape = () => fault('MAIL_SHAPE', 'Outlook 메일 목록을 확인하지 못했어요.');
const sleep = (ms, signal) => require('node:timers/promises').setTimeout(ms, undefined, { signal });

// ---------- 주소 검사 ----------

// 경로 모양: 고정 낱말은 대소문자를 가리지 않고, 폴더 번호는 정확히 맞춘다.
// mailFolders('ID')와 mailFolders/ID 두 가지 표기를 같은 것으로 본다.
function pathParts(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (/\.\.|\\|\/\/|[\u0000-\u001f]/.test(decoded)) return null;
  return decoded.replace(/\('([^'()/]*)'\)/g, '/$1').split('/').slice(1);
}

function matches(parts, expected) {
  if (!parts || parts.length !== expected.length) return false;
  return expected.every((want, i) => typeof want === 'string'
    ? parts[i].toLowerCase() === want.toLowerCase()
    : parts[i] === want.id);
}

// href가 graph.microsoft.com/v1.0/me 아래 기대한 경로일 때만 URL을 돌려준다. 그 밖에는 토큰을 보내기 전에 멈춘다.
function graphUrl(href, expected) {
  if (typeof href !== 'string' || href.length > 16384) throw shape();
  const head = /^https:\/\/([^/?#]+)(\/[^?#]*)(\?[^#]*)?$/i.exec(href);
  if (!head || head[1].toLowerCase() !== 'graph.microsoft.com') throw fault('MAIL_LINK', 'Outlook이 아닌 곳으로 이어지는 주소를 받아 검사를 멈췄어요.');
  if (/%2e|%2f|%5c/i.test(head[2])) throw fault('MAIL_LINK', 'Outlook 주소의 경로를 확인하지 못했어요.');
  let url;
  try { url = new URL(href); } catch { throw shape(); }
  if (url.protocol !== 'https:' || url.hostname !== 'graph.microsoft.com' || url.port || url.username || url.password || url.hash) {
    throw fault('MAIL_LINK', 'Outlook이 아닌 곳으로 이어지는 주소를 받아 검사를 멈췄어요.');
  }
  const parts = pathParts(url.pathname);
  if (!parts || parts[0]?.toLowerCase() !== 'v1.0' || parts[1]?.toLowerCase() !== 'me' || !matches(parts, expected)) {
    throw fault('MAIL_LINK', 'Outlook 주소의 경로가 예상과 달라 검사를 멈췄어요.');
  }
  for (const key of url.searchParams.keys()) if (!ALLOWED_QUERY.has(key)) throw fault('MAIL_LINK', 'Outlook 주소의 조회 조건을 확인하지 못했어요.');
  return url;
}

const paths = {
  me: ['v1.0', 'me'],
  folders: ['v1.0', 'me', 'mailFolders'],
  folder: id => ['v1.0', 'me', 'mailFolders', { id }],
  children: id => ['v1.0', 'me', 'mailFolders', { id }, 'childFolders'],
  delta: id => ['v1.0', 'me', 'mailFolders', { id }, 'messages', 'delta'],
  message: (folder,id) => ['v1.0','me','mailFolders',{id:folder},'messages',{id}],
  original: id => ['v1.0','me','messages',{id}],
};
const build = (segments, query = {}) => {
  const path = segments.map(s => typeof s === 'string' ? s : encodeURIComponent(s.id)).join('/');
  const qs = new URLSearchParams(query).toString();
  return ORIGIN + '/' + path + (qs ? '?' + qs : '');
};

// ---------- 요청 ----------

function createGraph({ access, fetcher = fetch, signal, wait = sleep, timeout = 45000 }) {
  if (typeof access !== 'function') throw fault('CONFIG', 'Outlook 연결 정보가 필요해요.');
  async function get(href, expected, { prefer } = {}) {
    const url = graphUrl(href, expected);
    let refreshed = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      signal?.throwIfAborted();
      const token = await access(refreshed);
      if (typeof token !== 'string' || !token || token.length > 32768 || /[\s\u0000-\u001f]/.test(token)) {
        throw fault('MAIL_AUTH', 'Outlook 메일 읽기 연결을 확인해 주세요.');
      }
      const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
      if (prefer) headers.Prefer = prefer;
      const limit = AbortSignal.timeout(timeout);
      let response;
      try {
        response = await fetcher(url.href, { method: 'GET', headers, redirect: 'error', signal: signal ? AbortSignal.any([signal, limit]) : limit });
      } catch {
        if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : fault('ABORT_ERR', '검사를 멈췄어요.');
        if (attempt < 5) { await wait(500 * 2 ** attempt, signal); continue; }
        throw fault('MAIL_NETWORK', 'Outlook 메일 서버에 연결하지 못했어요.');
      }
      const status = response.status;
      if (status >= 300 && status < 400) throw fault('MAIL_LINK', 'Outlook이 다른 주소로 보내려 해 검사를 멈췄어요.');
      if (response.ok) {
        const length = Number(response.headers?.get?.('content-length'));
        if (Number.isFinite(length) && length > MAX_BODY) throw fault('MAIL_LIMIT', 'Outlook 응답이 너무 커요.');
        const text = await response.text();
        if (text.length > MAX_BODY) throw fault('MAIL_LIMIT', 'Outlook 응답이 너무 커요.');
        try { return JSON.parse(text); } catch { throw shape(); }
      }
      if (status === 401 && !refreshed) { refreshed = true; continue; }
      if ((status === 429 || status === 503 || status === 504) && attempt < 5) {
        const retry = Number(response.headers?.get?.('retry-after'));
        await wait(Number.isFinite(retry) && retry > 0 ? Math.min(120000, retry * 1000) : 1000 * 2 ** attempt, signal);
        continue;
      }
      let code = '';
      try { const body = JSON.parse(await response.text()); if (/^[A-Za-z]{1,64}$/.test(body?.error?.code)) code = body.error.code; } catch {}
      const auth = status === 401 || status === 403;
      const error = fault(auth ? 'MAIL_AUTH' : 'MAIL_PROVIDER', auth ? 'Outlook 메일 읽기 권한을 확인해 주세요.' : 'Outlook에서 메일 일부를 읽지 못했어요.');
      error.httpStatus = status;
      error.graphCode = code;
      throw error;
    }
    throw fault('MAIL_PROVIDER', 'Outlook이 아직 응답할 수 없어요. 잠시 뒤 다시 시도해 주세요.');
  }
  return { get };
}

const expired = e => e?.httpStatus === 410 || (e?.httpStatus === 400 && /syncstate|resync|deltatoken|skiptoken/i.test(e.graphCode || ''));

async function readProfile(graph, includeAliases = false) {
  const basic = 'id,mail,userPrincipalName';
  const getProfile = fields => graph.get(build(paths.me, { $select: fields }), paths.me);
  let me;
  try { me = await getProfile(includeAliases ? basic + ',proxyAddresses' : basic); }
  catch (error) {
    if (!includeAliases || ![400, 403].includes(error.httpStatus)) throw error;
    me = await getProfile(basic);
  }
  const address = String(me?.mail || me?.userPrincipalName || '').trim().toLowerCase();
  const addressPattern = /^[^\s@]{1,128}@[^\s@]{1,255}$/;
  if (typeof me?.id !== 'string' || !/^[A-Za-z0-9@._-]{1,256}$/.test(me.id) || !addressPattern.test(address)) {
    throw fault('MAIL_AUTH', 'Outlook 계정 정보를 확인하지 못했어요.');
  }
  const proxies = Array.isArray(me.proxyAddresses) ? me.proxyAddresses : [];
  const aliases = proxies.filter(value => typeof value === 'string' && /^smtp:/i.test(value))
    .map(value => value.slice(5).trim().toLowerCase());
  const principal = typeof me.userPrincipalName === 'string' ? me.userPrincipalName.trim().toLowerCase() : '';
  return { address, subject: me.id, identities: [...new Set([address, principal, ...aliases].filter(value => addressPattern.test(value)))] };
}

async function outlookProfile({ access, signal, fetcher } = {}) {
  const {address,subject}=await readProfile(createGraph({ access, fetcher, signal }));
  return {address,subject};
}

// ---------- 폴더 ----------

async function wellKnownIds(graph) {
  const ids = {};
  for (const name of WELL_KNOWN) {
    try {
      const folder = await graph.get(build(paths.folder(name), { $select: 'id' }), paths.folder(name));
      if (!graphId(folder?.id)) throw shape();
      ids[name] = folder.id;
    } catch (error) {
      if (error.httpStatus === 404) { ids[name] = null; continue; }
      throw error;
    }
  }
  if (!ids.inbox || !ids.sentitems || !ids.drafts || !ids.deleteditems) throw fault('MAIL_FOLDER', 'Outlook 기본 폴더를 확인하지 못했어요.');
  return ids;
}

const ROLE_OF = { sentitems: 'sent', outbox: 'outbox', drafts: 'drafts', deleteditems: 'trash', junkemail: 'junk', inbox: 'inbox', archive: 'archive' };

async function pages(graph, first, expected, onItem) {
  const seen = new Set();
  let href = first;
  for (;;) {
    const page = await graph.get(href, expected);
    if (!page || !Array.isArray(page.value)) throw shape();
    for (const item of page.value) onItem(item);
    const next = page['@odata.nextLink'];
    if (next == null) return;
    graphUrl(next, expected);
    if (seen.has(next) || next === href) throw fault('MAIL_SHAPE', '같은 Outlook 목록이 다시 돌아왔어요.');
    seen.add(next); href = next;
  }
}

async function listFolders(graph, known) {
  const byKnown = new Map(Object.entries(known).filter(([, id]) => id).map(([name, id]) => [id, name]));
  const out = [];
  let skipped = 0;
  const queue = [{ href: build(paths.folders, { includeHiddenFolders: 'true', $top: '100', $select: FOLDER_SELECT }), expected: paths.folders, role: '' }];
  while (queue.length) {
    const { href, expected, role: parentRole } = queue.shift();
    await pages(graph, href, expected, item => {
      if (!graphId(item?.id)) throw shape();
      if (/mailSearchFolder/i.test(String(item['@odata.type'] || ''))) { skipped++; return; }
      const name = byKnown.get(item.id);
      if (SKIP_TREES.includes(name)) { skipped++; return; }
      if (out.some(f => f.id === item.id)) return;
      const own = ROLE_OF[name];
      const role = own || (['sent', 'outbox', 'drafts', 'trash', 'junk'].includes(parentRole) ? parentRole : 'normal');
      out.push({ id: item.id, role });
      if (out.length > MAX_FOLDERS) throw fault('MAIL_LIMIT', 'Outlook 폴더가 너무 많아요.');
      if (Number(item.childFolderCount) > 0) {
        queue.push({ href: build(paths.children(item.id), { includeHiddenFolders: 'true', $top: '100', $select: FOLDER_SELECT }), expected: paths.children(item.id), role });
      }
    });
  }
  return { folders: out, skipped };
}

// ---------- 메일 ----------

const addressOf = r => String(r?.emailAddress?.address || '').trim().toLowerCase();
function originalMessageUrl(value) {
  if (typeof value!=='string' || value.length>4096) return '';
  let url;try{url=new URL(value);}catch{return '';}
  if(!['https://outlook.office.com','https://outlook.office365.com','https://outlook.live.com'].includes(url.origin) || url.username || url.password) return '';
  if(/^\/owa\/?$/iu.test(url.pathname)){
    const item=url.searchParams.get('ItemID');
    if(!graphId(item))return '';
    return url.origin+'/owa/?'+new URLSearchParams({ItemID:item,viewmodel:'ReadMessageItem'}).toString();
  }
  if(/^\/mail\/(?:\d+\/)?(?:deeplink\/read|inbox\/id)\/[a-z0-9_.+%=-]+$/iu.test(url.pathname))return url.origin+url.pathname;
  return '';
}
const timeOf = (...values) => { for (const v of values) { const t = Date.parse(v); if (Number.isFinite(t)) return t; } return NaN; };

function outlookMessage({ boxId, folder, item, me,identities=[me] }) {
  if (!graphId(item?.id)) throw shape();
  // 초안인지는 Graph의 isDraft로 정한다. 보낸 답장을 임시 보관함 폴더로 옮겨도 초안이 되지 않는다(0.5.8 검수 GPT-N).
  const draft = item.isDraft === true || folder.role === 'outbox';
  const fromAddress = addressOf(item.from), senderAddress = addressOf(item.sender);
  const fromMember = Boolean(fromAddress && identities.includes(fromAddress));
  const senderMember = Boolean(senderAddress && identities.includes(senderAddress));
  const usesMemberAddress = fromMember || senderMember;
  const verifiedSender = usesMemberAddress && (!fromAddress || fromMember) && (!senderAddress || senderMember);
  const outgoing = !draft && folder.role === 'sent' && verifiedSender;
  const headers = new Map();
  if (Array.isArray(item.internetMessageHeaders)) {
    for (const h of item.internetMessageHeaders) if (typeof h?.name === 'string') headers.set(h.name.toLowerCase(), String(h.value ?? ''));
  }
  const autoHeader = (headers.get('auto-submitted') || '').trim().toLowerCase();
  const unattributed=[];
  const contentType = String(item.uniqueBody?.contentType || '').toLowerCase();
  const unique = ['html','text'].includes(contentType) && typeof item.uniqueBody.content === 'string'
    ? (String(item.uniqueBody.contentType).toLowerCase() === 'html' ? htmlText(item.uniqueBody.content.slice(0, 262144),unattributed) : item.uniqueBody.content)
    : null;
  const text = textValue(String(unique ?? item.bodyPreview ?? '').replace(/\r\n?/g, '\n'), TEXT_LIMIT);
  const to = (item.toRecipients || []).map(addressOf), cc = (item.ccRecipients || []).map(addressOf);
  const directRecipient=to.some(address=>identities.includes(address));
  const copiedRecipient=cc.some(address=>identities.includes(address));
  const receivedByMember=directRecipient || copiedRecipient;
  let at = outgoing ? timeOf(item.sentDateTime, item.receivedDateTime, item.createdDateTime)
    : draft ? timeOf(item.lastModifiedDateTime, item.createdDateTime)
    : timeOf(item.receivedDateTime, item.sentDateTime, item.createdDateTime);
  let uncertain = '';
  if (!Number.isFinite(at)) { at = 0; uncertain = '받은 시각을 읽지 못했어요.'; }
  // 보낸 사람 주소만으로 내 답장이라고 정하지 않는다. 보낸 편지함 밖의 '내 주소' 편지는 확인할 거리로 남긴다.
  const unverifiedSent = !draft && folder.role === 'sent' && !verifiedSender;
  if (unverifiedSent) uncertain = '보낸 편지함에서 발신자를 확인하기 어려워요.';
  else if (!outgoing && !draft && usesMemberAddress) uncertain = '보낸 사람이 내 주소지만 보낸 편지함 밖에 있어 직접 확인이 필요해요.';
  const from = item.from?.emailAddress;
  const senderName = typeof from?.name === 'string' && typeof from.address === 'string'
    ? headerDisplayName('"' + from.name + '" <' + from.address + '>') : '';
  return {
    id: hash(boxId, 'outlook', folder.id, item.id),
    evidenceId:hash(boxId,'outlook-message',item.id), originalUrl:originalMessageUrl(item.webLink), originalRef:{id:item.id,folderId:folder.id},
    possibleSelf:!outgoing&&!draft&&usesMemberAddress, receivedByMember,
    directionUncertain:!draft && !outgoing && (usesMemberAddress || unverifiedSent),
    threadId: hash(boxId, 'outlook-thread', typeof item.conversationId === 'string' && item.conversationId ? item.conversationId : 'message:' + item.id),
    at, senderName, subject: textValue(String(item.subject || ''), 500), text, bodySource:unique === null ? 'snippet' : contentType==='html' ? 'html' : 'plain',
    readingReason:unattributed.length ? 'HTML에서 현재 문의로 확인할 수 없는 부분이 있어요.' : '',
    partialBody: unique === null || !!unattributed.length || item.uniqueBody.content.length >= 262144 || text.length >= TEXT_LIMIT, outgoing, draft,
    copied: copiedRecipient && !directRecipient, hasAttachments:item.hasAttachments===true,
    ...submissionFlags(autoHeader,headers.has('x-autoreply') || headers.has('x-autorespond')),
    bulk: headers.has('list-unsubscribe') || headers.has('list-id') || /bulk|list|junk/i.test(headers.get('precedence') || ''),
    excluded: folder.role === 'trash' || folder.role === 'junk',
    uncertain,
  };
}

// ---------- 검사 ----------

function validCursor(cursor, subject) {
  return cursor && cursor.v === 1 && cursor.provider === 'outlook' && cursor.subject === subject && ['scan', 'verify','done'].includes(cursor.phase) &&
    Number.isSafeInteger(cursor.generation) && Array.isArray(cursor.folders) &&
    cursor.folders.every(f => graphId(f.id) && typeof f.role === 'string' && (f.link === null || typeof f.link === 'string') &&
      (f.delta === null || typeof f.delta === 'string'));
}

const restartSignal = () => Object.assign(fault('MAIL_CHANGED', 'Outlook 조사 위치가 만료돼 처음부터 다시 읽어야 해요.'), { restart: true });
// 폴더를 옮겨도 같은 번호가 유지되는 ImmutableId와 글자 본문을 요청한다.
const PREFER = ['odata.maxpagesize=' + PAGE, 'outlook.body-content-type="html"', 'IdType="ImmutableId"'].join(', ');

async function readOriginal({box,ref,access,fetcher,signal}) {
  if(!graphId(ref?.id)||!graphId(ref.folderId))throw fault('STALE','메일함을 갱신한 뒤 다시 열어 주세요.');
  const graph=createGraph({access,fetcher,signal});
  if((await readProfile(graph)).subject!==box.subject)throw fault('MAIL_AUTH','연결한 Outlook 메일함을 확인해 주세요.');
  const resource=paths.original(ref.id);
  const item=await graph.get(build(resource,{$select:'id,parentFolderId,body'}),resource,{prefer:PREFER});
  if(item?.id!==ref.id||item.parentFolderId!==ref.folderId)throw fault('STALE','Outlook 메시지가 이동했거나 삭제됐어요.');
  const body=item.body;
  if(typeof body?.content!=='string'||!['text','html'].includes(body.contentType?.toLowerCase()))throw fault('READ','Outlook에서 메일 본문을 확인해 주세요.');
  const flags=[];
  const text=body.contentType.toLowerCase()==='html'?htmlText(body.content,flags,true):body.content;
  return {text,partial:Boolean(flags.length)};
}

async function scanOutlook({ box, access, signal, commit, fetcher = fetch, wait, now = Date.now, timeout } = {}) {
  if (!box || typeof box.id !== 'string' || !box.id || typeof box.subject !== 'string' || !box.subject) throw fault('VALUE', '메일함 정보를 확인해 주세요.');
  if (typeof commit !== 'function') throw fault('VALUE', '검사 결과를 저장할 곳이 필요해요.');
  const graph = createGraph({ access, fetcher, signal, wait, timeout });
  const profile = await readProfile(graph, true);
  if (profile.subject !== box.subject) throw fault('MAIL_AUTH', '연결할 때 확인한 Outlook 계정과 지금 계정이 달라요.');
  const me = profile.address;
  let saved = validCursor(box.cursor, box.subject) ? structuredClone(box.cursor) : null;
  let state = saved && structuredClone(saved);
  if(state?.phase==='done'){state.phase='verify';state.startedAt=now();saved=structuredClone(state);}
  let restarts = 0, rounds = 0;
  const save = async change => { await commit({ ...change, cursor: state }); saved = structuredClone(state); };

  async function begin() {
    const known = await wellKnownIds(graph);
    const { folders, skipped } = await listFolders(graph, known);
    state = {
      v: 1, provider: 'outlook', subject: box.subject, generation: (saved?.generation || box.cursor?.generation || 0) + 1,
      phase: 'scan', startedAt: now(), known, skipped,
      folders: folders.map(f => ({ id: f.id, role: f.role, link: null, delta: null, select: 'full', count: 0, done: false })),
    };
    rounds = 0;
    await save({ messages: [], reset: true });
  }

  // 한 폴더의 delta 목록을 끝까지 따라간다. 반환값: 바뀐 항목 수
  async function follow(f) {
    const expected = paths.delta(f.id);
    const seen = new Set();
    const seenItems = new Set();
    // A resumed scan has no in-memory history. Verify the remaining items against the folder.
    let verifyAll=Boolean(f.link || f.delta);
    let changes = 0;
    for (;;) {
      signal?.throwIfAborted();
      const href = f.link || f.delta || build(expected, { $select: f.select === 'basic' ? SELECT_BASIC : SELECT_FULL });
      let page;
      try { page = await graph.get(href, expected, { prefer: PREFER }); }
      catch (error) {
        if (expired(error)) throw restartSignal();
        if (error.httpStatus === 404) throw restartSignal(); // 폴더가 사라졌다
        // 처음 요청에서 머리글·고유 본문 선택이 거절되면 기본 항목으로 다시 읽는다.
        if (error.httpStatus === 400 && !f.link && !f.delta && f.select === 'full') { f.select = 'basic'; continue; }
        throw error;
      }
      if (!page || !Array.isArray(page.value)) throw shape();
      const events=new Map(), duplicates=new Set();
      for (const item of page.value) {
        if(!graphId(item?.id))throw shape();
        if(events.has(item.id) || seenItems.has(item.id))duplicates.add(item.id);
        if(!verifyAll){
          seenItems.add(item.id);
          if(seenItems.size>=4096){verifyAll=true;seenItems.clear();}
        }
        events.set(item.id,item);
      }
      const messages=[],removed=[];
      const hasTextFields=value=>value && ['conversationId','subject'].every(key=>typeof value[key]==='string'||value[key]===null);
      for(const [id,event] of events){
        let full=event;
        // Delta events, including removals, can arrive out of order across pages. The folder item is authoritative.
        if(verifyAll || duplicates.has(id) || event['@removed'] || event.parentFolderId!==f.id || !hasTextFields(event) || (!Object.hasOwn(event,'bodyPreview')&&!event.uniqueBody)){
          const target=paths.message(f.id,id);
          try{full=await graph.get(build(target,{$select:f.select==='basic'?SELECT_BASIC:SELECT_FULL}),target,{prefer:PREFER});}
          catch(error){
            if(error.httpStatus!==404)throw error;
            removed.push(hash(box.id,'outlook',f.id,id));continue;
          }
          if(full?.id!==id||!graphId(full.parentFolderId))throw shape();
          // Resolving an immutable message ID does not establish that it is still in this folder.
          if(full.parentFolderId!==f.id){
            removed.push(hash(box.id,'outlook',f.id,id));continue;
          }
          if(!hasTextFields(full))throw shape();
        }
        messages.push(outlookMessage({boxId:box.id,folder:f,item:full,me,identities:profile.identities}));
      }
      const next = page['@odata.nextLink'], delta = page['@odata.deltaLink'];
      if ((next == null) === (delta == null)) throw fault('MAIL_SHAPE', 'Outlook 목록의 다음 위치를 확인하지 못했어요.');
      const link = next ?? delta;
      graphUrl(link, expected);
      if (next != null && (seen.has(next) || next === href)) throw fault('MAIL_SHAPE', '같은 Outlook 목록이 다시 돌아왔어요.');
      seen.add(link);
      changes += messages.length + removed.length;
      f.count += messages.length;
      if (next != null) f.link = next;
      else { f.link = null; f.delta = delta; f.done = true; }
      await save({ messages, removed });
      if (delta != null) return changes;
    }
  }

  async function verifyRound() {
    const { folders } = await listFolders(graph, state.known);
    const fresh = new Map(folders.map(f => [f.id,f.role]));
    if (state.folders.some(f => fresh.get(f.id)!==f.role)) throw restartSignal(); // 삭제·휴지통 이동은 기존 편지의 역할까지 바꾼다.
    let changed = 0;
    for (const f of folders) {
      if (!state.folders.some(s => s.id === f.id)) {
        state.folders.push({ id: f.id, role: f.role, link: null, delta: null, select: 'full', count: 0, done: false });
        changed++;
      }
    }
    if (changed) { state.phase = 'scan'; await save({ messages: [] }); return true; }
    for (const f of state.folders) changed += await follow(f);
    return changed > 0;
  }

  for (;;) {
    try {
      signal?.throwIfAborted();
      if (!state) await begin();
      if (state.phase === 'scan') {
        for (const f of state.folders) if (!f.done) await follow(f);
        state.phase = 'verify';
        await save({ messages: [] });
      }
      if (!(await verifyRound())) {
        state.phase = 'done';
        state.completedAt = now();
        state.coverage = {
          provider: 'outlook',
          label: 'Microsoft Graph 본인 기본 사서함의 모든 메일 폴더. 온라인 보관 사서함과 공유 사서함은 범위 밖이에요.',
          folders: state.folders.length,
          excludedFolders: state.folders.filter(f => f.role === 'trash' || f.role === 'junk').length,
          systemFoldersSkipped: state.skipped || 0,
          limitedFolders: state.folders.filter(f => f.select === 'basic').length,
          messagesRead: state.folders.reduce((n, f) => n + f.count, 0),
          startedAt: state.startedAt, completedAt: state.completedAt,
        };
        await commit({ messages: [], cursor: state, complete: true, coverage: state.coverage });
        return state.coverage;
      }
      if (++rounds >= MAX_ROUNDS) {
        throw fault('MAIL_CHANGING', '검사하는 동안 Outlook 메일함이 계속 바뀌어 끝까지 확인하지 못했어요. 잠시 뒤 이어서 확인해 주세요.');
      }
    } catch (error) {
      if (error?.restart && restarts++ < 1) { state = null; continue; }
      if (error?.restart) throw fault('MAIL_CHANGING', 'Outlook 메일함이 계속 바뀌어 전체 확인을 마치지 못했어요.');
      throw error;
    }
  }
}

module.exports = { BASE, outlookProfile, scanOutlook, graphUrl, outlookMessage, originalMessageUrl, readOriginal, createGraph };
