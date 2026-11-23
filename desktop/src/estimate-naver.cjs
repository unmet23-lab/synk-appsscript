'use strict';

// 네이버 메일 IMAP 읽기 전용 공급자. 표준 Node TLS만 쓰고, 조회 명령만 보낸다.
// 오류 문구에는 서버 응답, 명령 원문, 비밀번호, 메일 내용을 넣지 않는다.
const tls = require('node:tls');
const { createHash } = require('node:crypto');
const { fault, textValue, headerDisplayName, headerAddresses, submissionFlags, sameCurrentBody, originalBodyVersions } = require('./estimate-domain.cjs');

const HOST = 'imap.naver.com';
const PORT = 993;
const MAX_RESPONSE = 8 * 1024 * 1024;
const MAX_LITERAL = 1024 * 1024;
const PREVIEW = 65536;
const BATCH = 20;
const MAX_ROUNDS = 4;
const MAX_FOLDERS = 2000;
const TEXT_LIMIT = 16000;
// 상태를 바꾸지 않는 명령만 허용한다. SELECT, STORE, COPY, MOVE, EXPUNGE, APPEND 등은 보낼 수 없다.
const ALLOWED = new Set(['CAPABILITY', 'LOGIN', 'LIST', 'EXAMINE', 'UID SEARCH', 'UID FETCH', 'NOOP', 'LOGOUT']);

const hash = (...parts) => createHash('sha256').update(parts.map(String).join('\0')).digest('hex').slice(0, 40);
const shape = () => fault('MAIL_SHAPE', '메일 서버의 응답을 확인하지 못했어요.');

// ---------- 주소와 자격 ----------

function naverAccount(address, password) {
  const raw = typeof address === 'string' ? address.trim().toLowerCase() : '';
  const match = /^([a-z0-9][a-z0-9._-]{0,63})(?:@naver\.com)?$/.exec(raw);
  if (!match) throw fault('VALUE', '네이버 아이디나 네이버 메일 주소를 확인해 주세요.');
  if (typeof password !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(password)) {
    throw fault('VALUE', '네이버에서 발급한 앱 비밀번호를 확인해 주세요.');
  }
  return { user: match[1], address: match[1] + '@naver.com', password };
}

function quote(value) {
  if (typeof value !== 'string' || /[^\x20-\x7e]/.test(value)) throw fault('MAIL_SHAPE', '메일 서버에 보낼 수 없는 이름이 있어요.');
  return '"' + value.replace(/[\\"]/g, '\\$&') + '"';
}

// ---------- 응답 프레임 ----------

// 한 응답(literal 포함)을 바이트 단위로 정확히 잘라 낸다.
function createReader(max = MAX_RESPONSE, maxLiteral = MAX_LITERAL) {
  let buf = Buffer.alloc(0), pos = 0, need = 0;
  return {
    push(chunk) { buf = buf.length ? Buffer.concat([buf, chunk]) : Buffer.from(chunk); },
    next() {
      for (;;) {
        if (need > 0) {
          if (buf.length - pos < need) return null;
          pos += need; need = 0;
        }
        const end = buf.indexOf('\r\n', pos, 'latin1');
        if (end < 0) {
          if (buf.length > max) throw fault('MAIL_LIMIT', '메일 서버 응답이 너무 커요.');
          return null;
        }
        const tail = buf.toString('latin1', Math.max(pos, end - 24), end);
        const literal = /~?\{(\d{1,10})\+?\}$/.exec(tail);
        if (literal) {
          const size = Number(literal[1]);
          if (size > maxLiteral) throw fault('MAIL_LIMIT', '메일 서버 응답이 너무 커요.');
          need = size; pos = end + 2;
          if (pos + need > max) throw fault('MAIL_LIMIT', '메일 서버 응답이 너무 커요.');
          continue;
        }
        const response = buf.subarray(0, end + 2);
        buf = buf.subarray(end + 2); pos = 0;
        return response;
      }
    },
  };
}

// 응답을 토큰으로 나눈다. 문자열과 literal은 Buffer, atom은 문자열, NIL은 null이다.
function tokenize(buf, start = 0) {
  const root = [], stack = [root];
  const top = () => stack[stack.length - 1];
  let i = start;
  while (i < buf.length) {
    const c = buf[i];
    if (c === 0x20 || c === 0x0d || c === 0x0a) { i++; continue; }
    if (c === 0x28) { const list = []; top().push(list); stack.push(list); i++; continue; }
    if (c === 0x29) { if (stack.length === 1) throw shape(); stack.pop(); i++; continue; }
    if (c === 0x22) {
      const out = []; i++;
      for (;;) {
        if (i >= buf.length) throw shape();
        const d = buf[i];
        if (d === 0x5c) { if (i + 1 >= buf.length) throw shape(); out.push(buf[i + 1]); i += 2; continue; }
        if (d === 0x22) { i++; break; }
        if (d === 0x0d || d === 0x0a) throw shape();
        out.push(d); i++;
      }
      top().push(Buffer.from(out));
      continue;
    }
    if (c === 0x7b || (c === 0x7e && buf[i + 1] === 0x7b)) {
      const open = c === 0x7e ? i + 1 : i, close = buf.indexOf(0x7d, open);
      const digits = close > 0 ? buf.toString('latin1', open + 1, close).replace(/\+$/, '') : '';
      if (!/^\d{1,10}$/.test(digits) || buf[close + 1] !== 0x0d || buf[close + 2] !== 0x0a) throw shape();
      const size = Number(digits), from = close + 3;
      if (from + size > buf.length) throw shape();
      top().push(Buffer.from(buf.subarray(from, from + size)));
      i = from + size;
      continue;
    }
    let j = i, depth = 0;
    while (j < buf.length) {
      const d = buf[j];
      if (depth === 0 && (d === 0x20 || d === 0x28 || d === 0x29 || d === 0x0d || d === 0x0a)) break;
      if (d === 0x5b) depth++; else if (d === 0x5d && depth > 0) depth--;
      j++;
    }
    const atom = buf.toString('latin1', i, j);
    top().push(atom.toUpperCase() === 'NIL' ? null : atom);
    i = j;
  }
  if (stack.length !== 1) throw shape();
  return root;
}

const firstLine = buf => {
  const end=buf.indexOf('\r\n');
  return buf.toString('latin1',0,end<0?buf.length:end);
};
const asText = v => Buffer.isBuffer(v) ? v.toString('latin1') : typeof v === 'string' ? v : '';

// ---------- 연결 ----------

function defaultConnect({ host, port, servername, signal }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername, minVersion: 'TLSv1.2', rejectUnauthorized: true });
    const fail = () => {
      clearTimeout(timer); signal?.removeEventListener('abort', fail); socket.destroy();
      reject(fault('MAIL_NETWORK', '네이버 메일 서버에 연결하지 못했어요.'));
    };
    const timer = setTimeout(fail, 30000);
    signal?.addEventListener('abort', fail, { once: true });
    socket.once('error', fail);
    socket.once('secureConnect', () => {
      clearTimeout(timer); signal?.removeEventListener('abort', fail);
      resolve(socket); // 남겨 둔 error 처리기는 연결 뒤 오류를 닫힘으로 바꾼다.
    });
  });
}

function abortReason(signal) {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : Object.assign(new Error('검사를 멈췄어요.'), { name: 'AbortError', code: 'ABORT_ERR' });
}

async function openImap({ connect = defaultConnect, signal, idle = 60000, onCommand } = {}) {
  signal?.throwIfAborted();
  let socket;
  try { socket = await connect({ host: HOST, port: PORT, servername: HOST, signal }); }
  catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    throw error?.code === 'MAIL_NETWORK' ? error : fault('MAIL_NETWORK', '네이버 메일 서버에 연결하지 못했어요.');
  }
  const protocol = typeof socket?.getProtocol === 'function' ? socket.getProtocol() : null;
  if (!socket || socket.encrypted !== true || socket.authorized !== true || !/^TLSv1\.[23]$/.test(String(protocol))) {
    socket?.destroy?.();
    throw fault('MAIL_TLS', '네이버 메일 서버의 암호화 연결을 확인하지 못했어요.');
  }
  const reader = createReader();
  const queue = [];
  let failure = null, waiting = null, counter = 0;
  const wake = () => { const w = waiting; waiting = null; w?.(); };
  const fail = error => { if (!failure) { failure = error; socket.destroy(); } wake(); };
  socket.on('data', chunk => {
    if (failure) return;
    try { reader.push(chunk); let r; while ((r = reader.next())) queue.push(r); } catch (error) { fail(error); return; }
    wake();
  });
  socket.on('error', () => fail(fault('MAIL_NETWORK', '네이버 메일 서버와 연결이 끊어졌어요.')));
  socket.on('close', () => fail(fault('MAIL_NETWORK', '네이버 메일 서버와 연결이 끊어졌어요.')));
  const onAbort = () => fail(abortReason(signal));
  signal?.addEventListener('abort', onAbort, { once: true });

  async function next() {
    for (;;) {
      if (queue.length) return queue.shift();
      if (failure) throw failure;
      await new Promise(resolve => {
        const timer = setTimeout(() => fail(fault('MAIL_TIMEOUT', '네이버 메일 서버가 제때 응답하지 않았어요.')), idle);
        waiting = () => { clearTimeout(timer); resolve(); };
      });
    }
  }

  const greeting = firstLine(await next());
  if (!/^\* OK\b/i.test(greeting)) { fail(fault('MAIL_PROVIDER', '네이버 메일 서버가 연결을 받지 않았어요.')); throw failure; }

  async function command(verb, args = '') {
    if (!ALLOWED.has(verb)) throw fault('MAIL_INTERNAL', '허용하지 않은 메일 명령이에요.');
    if (verb === 'UID FETCH' && (/(?<!\.PEEK)\bBODY\[/i.test(args) || /\bRFC822(?!\.SIZE)\b/i.test(args) || /\bBINARY\[/i.test(args))) {
      throw fault('MAIL_INTERNAL', '읽음 상태를 바꾸는 조회는 보낼 수 없어요.');
    }
    if (/[\r\n]/.test(args)) throw fault('MAIL_INTERNAL', '메일 명령을 만들지 못했어요.');
    if (failure) throw failure;
    const tag = 'S' + (++counter);
    onCommand?.(verb);
    socket.write(tag + ' ' + verb + (args ? ' ' + args : '') + '\r\n');
    const untagged = [];
    for (;;) {
      const response = await next();
      const line = firstLine(response);
      if (line.startsWith(tag + ' ')) {
        const status = /^\S+ (OK|NO|BAD)\b/i.exec(line)?.[1]?.toUpperCase();
        if (!status) throw shape();
        return { status, line, untagged };
      }
      if (line.startsWith('+')) { fail(shape()); throw failure; }
      untagged.push(response);
    }
  }

  async function close() {
    signal?.removeEventListener('abort', onAbort);
    if (!failure) { try { await Promise.race([command('LOGOUT'), new Promise(r => setTimeout(r, 3000).unref?.())]); } catch {} }
    failure ||= fault('MAIL_NETWORK', '연결을 닫았어요.');
    socket.destroy();
  }
  return { command, close };
}

async function login(session, account) {
  const capability = await session.command('CAPABILITY');
  const caps = capability.untagged.map(firstLine).join(' ').toUpperCase();
  if (capability.status !== 'OK' || !/\bIMAP4REV1\b/.test(caps)) throw fault('MAIL_PROVIDER', '네이버 메일 서버의 IMAP 기능을 확인하지 못했어요.');
  if (/\bLOGINDISABLED\b/.test(caps)) throw fault('MAIL_TLS', '네이버 메일 서버가 이 연결에서 로그인을 막았어요.');
  const result = await session.command('LOGIN', quote(account.user) + ' ' + quote(account.password));
  if (result.status !== 'OK') {
    throw fault('MAIL_AUTH', '네이버 메일 로그인에 실패했어요. IMAP 사용 설정과 앱 비밀번호를 확인해 주세요.');
  }
}

// ---------- 폴더 ----------

function decodeFolder(raw) {
  return raw.replace(/&([^-]*)-/g, (all, b64) => {
    if (!b64) return '&';
    const bytes = Buffer.from(b64.replace(/,/g, '/'), 'base64');
    if (bytes.length % 2) return all;
    return Buffer.from(bytes).swap16().toString('utf16le');
  });
}

const ROLE_NAMES = {
  sent: ['sent messages', 'sent', 'sent items', 'sent mail', '보낸메일함', '보낸 메일함', '보낸편지함', '보낸 편지함'],
  drafts: ['drafts', 'draft', '임시보관함', '임시 보관함'],
  trash: ['deleted messages', 'deleted items', 'trash', '휴지통'],
  junk: ['junk', 'spam', 'junk e-mail', 'junk email', '스팸메일함', '스팸 메일함', '스팸편지함'],
};
const ROLE_FLAGS = { '\\SENT': 'sent', '\\DRAFTS': 'drafts', '\\TRASH': 'trash', '\\JUNK': 'junk', '\\ARCHIVE': 'normal' };

async function listFolders(session) {
  const result = await session.command('LIST', '"" "*"');
  if (result.status !== 'OK') throw fault('MAIL_FOLDER', '메일 폴더 목록을 읽지 못했어요.');
  const found = [];
  let skipped = 0;
  for (const response of result.untagged) {
    if (!/^\* LIST /i.test(firstLine(response))) continue;
    const t = tokenize(response);
    const [, , attrs, delim, name] = t;
    if (!Array.isArray(attrs) || (delim !== null && !Buffer.isBuffer(delim) && typeof delim !== 'string')) throw shape();
    const raw = asText(name);
    const flags = attrs.map(a => String(a).toUpperCase());
    if (flags.includes('\\NOSELECT') || flags.includes('\\NONEXISTENT')) continue;
    if (flags.includes('\\ALL') || flags.includes('\\FLAGGED')) { skipped++; continue; }  // 다른 폴더의 사본을 모아 보이는 가상 폴더
    if (!raw) throw shape();
    found.push({ raw, flags, delim: asText(delim) });
  }
  if (found.length > MAX_FOLDERS) throw fault('MAIL_LIMIT', '메일 폴더가 너무 많아요.');
  const named = found.map(f => {
    const label = decodeFolder(f.raw), lower = label.toLowerCase();
    let role = f.flags.map(flag => ROLE_FLAGS[flag]).find(Boolean) || '';
    if (!role && lower === 'inbox') role = 'inbox';
    if (!role) role = Object.keys(ROLE_NAMES).find(key => ROLE_NAMES[key].includes(lower)) || '';
    return { ...f, label, role };
  });
  // 휴지통, 스팸, 보낸 편지함, 임시 보관함 아래 폴더는 같은 역할을 이어받는다.
  for (const f of named) {
    if (f.role) continue;
    const parent = named.find(p => ['sent', 'drafts', 'trash', 'junk'].includes(p.role) && p.delim && f.raw.startsWith(p.raw + p.delim));
    f.role = parent ? parent.role : 'normal';
  }
  return { folders: named.map(f => ({ raw: f.raw, role: f.role })), skipped };
}

function parseExamine(result) {
  if (result.status !== 'OK') return null;
  if (!/\[READ-ONLY\]/i.test(result.line) || /\[READ-WRITE\]/i.test(result.line)) throw fault('MAIL_INTERNAL', '메일함을 읽기 전용으로 열지 못했어요.');
  let uidvalidity = null, uidnext = null, exists = null;
  for (const response of result.untagged) {
    const line = firstLine(response);
    const v = /^\* OK \[UIDVALIDITY (\d{1,10})\]/i.exec(line); if (v) uidvalidity = Number(v[1]);
    const n = /^\* OK \[UIDNEXT (\d{1,10})\]/i.exec(line); if (n) uidnext = Number(n[1]);
    const e = /^\* (\d{1,10}) EXISTS\b/i.exec(line); if (e) exists = Number(e[1]);
  }
  if (!uidvalidity) throw fault('MAIL_SHAPE', '메일함의 확인 번호를 읽지 못했어요.');
  return { uidvalidity, uidnext, exists };
}

async function examine(session, raw) {
  return parseExamine(await session.command('EXAMINE', quote(raw)));
}

// 보낸 편지함은 삭제 표시만 붙은 편지도 읽는다. 표시만으로는 고객에게 간 답장이 사라지지 않는다(0.5.8 검수 GPT-M).
async function searchUids(session, from, to, withDeleted = false) {
  if (from > to) return [];
  const result = await session.command('UID SEARCH', 'UID ' + from + ':' + to + (withDeleted ? '' : ' UNDELETED'));
  if (result.status !== 'OK') throw fault('MAIL_FOLDER', '메일 번호 목록을 읽지 못했어요.');
  const uids = new Set();
  for (const response of result.untagged) {
    const line = firstLine(response);
    if (!/^\* SEARCH\b/i.test(line)) continue;
    for (const part of line.slice(8).trim().split(/\s+/).filter(Boolean)) {
      if (!/^\d{1,10}$/.test(part)) throw shape();
      const uid = Number(part);
      if (uid >= from && uid <= to) uids.add(uid);
    }
  }
  return [...uids].sort((a, b) => a - b);
}

async function highestUid(session, withDeleted = false) {
  const result = await session.command('UID SEARCH', withDeleted ? 'ALL' : 'UNDELETED');
  if (result.status !== 'OK') throw fault('MAIL_FOLDER', '메일 번호 목록을 읽지 못했어요.');
  let max = 0;
  for (const response of result.untagged) {
    const line = firstLine(response);
    if (/^\* SEARCH\b/i.test(line)) for (const p of line.slice(8).trim().split(/\s+/)) if (/^\d+$/.test(p)) max = Math.max(max, Number(p));
  }
  return max;
}

async function fetchUids(session, uids, bytes=PREVIEW) {
  const result = await session.command('UID FETCH', uids.join(',') + ' (UID FLAGS INTERNALDATE RFC822.SIZE BODYSTRUCTURE BODY.PEEK[]<0.' + bytes + '>)');
  if (result.status !== 'OK') throw fault('MAIL_FOLDER', '메일 일부를 읽지 못했어요.');
  const byUid = new Map();
  for (const response of result.untagged) {
    if (!/^\* \d+ FETCH /i.test(firstLine(response))) continue;
    const t = tokenize(response);
    const items = t[3];
    if (!Array.isArray(items) || items.length % 2) throw shape();
    const fields = {};
    for (let i = 0; i < items.length; i += 2) {
      const key = String(items[i]).toUpperCase(), value = items[i + 1];
      if (key === 'UID') fields.uid = Number(value);
      else if (key === 'FLAGS') { if (!Array.isArray(value)) throw shape(); fields.flags = value.map(v => String(v).toUpperCase()); }
      else if (key === 'INTERNALDATE') fields.internalDate = asText(value);
      else if (key === 'RFC822.SIZE') fields.size = Number(value);
      else if (key === 'BODYSTRUCTURE' && Array.isArray(value)) fields.structure = value;
      else if (key.startsWith('BODY[]')) fields.raw = Buffer.isBuffer(value) ? value : null;
    }
    if (!Number.isSafeInteger(fields.uid)) continue;
    byUid.set(fields.uid, { ...(byUid.get(fields.uid) || {}), ...fields });
  }
  return byUid;
}

// ---------- 글자 해독 ----------

function decodeIso2022kr(bytes) {
  const out = [];
  let shifted = false;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b && bytes[i + 1] === 0x24 && bytes[i + 2] === 0x29 && bytes[i + 3] === 0x43) { i += 3; continue; }
    if (b === 0x0e) { shifted = true; continue; }
    if (b === 0x0f) { shifted = false; continue; }
    out.push(shifted && b >= 0x21 && b <= 0x7e ? b | 0x80 : b);
  }
  return new TextDecoder('euc-kr',{fatal:true}).decode(Buffer.from(out));
}

// { text, doubtful } 를 돌려준다. 선언이 없거나 틀린 한국어 메일은 UTF-8, EUC-KR 순서로 맞춰 본다.
function decodeBytes(bytes, charset, clipped = false) {
  const label = String(charset || '').trim().toLowerCase().replace(/^["']|["']$/g, '').replace(/\*.*$/, '');
  if (!bytes.length) return { text: '', doubtful: false };
  if (label === 'iso-2022-kr' || label === 'csiso2022kr') {
    for (let tail=0;tail<=(clipped?Math.min(3,bytes.length):0);tail++) {
      try { return { text: decodeIso2022kr(bytes.subarray(0,bytes.length-tail)), doubtful:false }; } catch {}
    }
    return { text:'', doubtful:true };
  }
  const attempt = (name) => { try { return new TextDecoder(name, { fatal: true }).decode(bytes,{stream:clipped}); } catch { return null; } };
  if (label && !['utf-8', 'utf8', 'us-ascii', 'ascii', ''].includes(label)) {
    let known = true;
    try { new TextDecoder(label); } catch { known = false; }
    if (known && new TextDecoder(label).encoding !== 'replacement') {
      const strict = attempt(label);
      if (strict !== null) return { text: strict, doubtful: false };
      return { text: '', doubtful: true };
    }
  }
  if (/[\x0e\x0f\x1b]/.test(bytes.toString('latin1'))) return { text: '', doubtful: true };
  const utf = attempt('utf-8');
  if (utf !== null) return { text: utf, doubtful: false };
  const korean = attempt('euc-kr');
  if (korean !== null) return { text: korean, doubtful: false };
  return { text: new TextDecoder('utf-8').decode(bytes), doubtful: true };
}

function headerBytes(latin1) { return Buffer.from(latin1, 'latin1'); }

const WORD = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;
function decodeHeader(latin1) {
  const raw = decodeBytes(headerBytes(latin1), '');
  let doubtful = raw.doubtful;
  const value = raw.text;
  let out = '', last = 0, pending = null;
  const flush = () => {
    if (!pending) return;
    const decoded = decodeBytes(Buffer.concat(pending.parts), pending.charset);
    doubtful ||= decoded.doubtful;
    out += decoded.text; pending = null;
  };
  for (const m of value.matchAll(WORD)) {
    const between = value.slice(last, m.index);
    const bytes = m[2].toUpperCase() === 'B'
      ? Buffer.from(m[3].replace(/[^A-Za-z0-9+/=]/g, ''), 'base64')
      : Buffer.from(m[3].replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (s, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
    const charset = m[1].toLowerCase().replace(/\*.*$/, '');
    // 이웃한 encoded-word 사이 공백은 버리고, 같은 문자 집합이면 바이트를 이어 붙여 한 번에 푼다.
    const adjacent = pending && /^[ \t]*$/.test(between);
    if (adjacent && pending.charset === charset) pending.parts.push(bytes);
    else {
      flush();
      if (!adjacent) out += between;
      pending = { charset, parts: [bytes] };
    }
    last = m.index + m[0].length;
  }
  flush();
  out += value.slice(last);
  return { text: out.replace(/\s+/g, ' ').trim(), doubtful };
}

function splitEntity(buf) {
  if (buf[0] === 0x0a) return { fields: new Map(), body: buf.subarray(1) };
  if (buf[0] === 0x0d && buf[1] === 0x0a) return { fields: new Map(), body: buf.subarray(2) };
  let at = buf.indexOf('\r\n\r\n', 0, 'latin1'), gap = 4;
  const bare = buf.indexOf('\n\n', 0, 'latin1');
  if (at < 0 || (bare >= 0 && bare < at)) { at = bare; gap = 2; }
  if (at < 0) return null;
  const head = buf.toString('latin1', 0, at).replace(/\r?\n[ \t]+/g, ' ');
  const fields = new Map();
  for (const line of head.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!fields.has(name)) fields.set(name, []);
    fields.get(name).push(line.slice(colon + 1).trim());
  }
  return { fields, body: buf.subarray(at + gap) };
}

function params(value) {
  const parts = [];
  let current = '', quoted = false;
  for (const ch of String(value || '')) {
    if (ch === '"') quoted = !quoted;
    if (ch === ';' && !quoted) { parts.push(current); current = ''; } else current += ch;
  }
  parts.push(current);
  const out = { value: parts.shift().trim().toLowerCase() };
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    let key = part.slice(0, eq).trim().toLowerCase(), val = part.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) val = val.slice(1, -1).replace(/\\(.)/g, '$1');
    if (key.endsWith('*')) { key = key.slice(0, -1); const m = /^[^']*'[^']*'(.*)$/.exec(val); if (m) val = m[1]; }
    out[key] ??= val;
  }
  return out;
}

function decodeTransfer(body, encoding, clipped = false) {
  const cte = String(encoding || '').trim().toLowerCase();
  if (cte === 'base64') {
    let clean = body.toString('latin1').replace(/\s/g, '');
    if (clipped && /^[A-Za-z0-9+/]*={0,2}$/.test(clean)) clean=clean.slice(0,clean.length-clean.length%4);
    const valid = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean);
    return { bytes: Buffer.from(clean,'base64'), ok: valid };
  }
  if (cte === 'quoted-printable') {
    let text = body.toString('latin1').replace(/=\r?\n/g, '');
    if (clipped) text=text.replace(/=(?:[0-9a-f]|\r)?$/i,'');
    return { bytes: Buffer.from(text.replace(/=([0-9A-Fa-f]{2})/g, (s, h) => String.fromCharCode(parseInt(h, 16))), 'latin1'), ok: !/=(?![0-9A-Fa-f]{2})/.test(text) };
  }
  if (['', '7bit', '8bit', 'binary'].includes(cte)) return { bytes: body, ok: true };
  return { bytes: Buffer.alloc(0), ok: false };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  bull: '•', middot: '·', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
// Raw NULs are removed before parsing. This marks where a real quoted block was removed, across nested HTML elements.
const REMOVED_QUOTE = '\u0000';
const IMAGE_REVIEW='삽입된 그림은 메일함에서 확인해 주세요.';
const ALT_REVIEW='이미지에 따로 적힌 내용을 확인해 주세요.';
const isImageWarning=value=>value===IMAGE_REVIEW || value===ALT_REVIEW;
function mailQuoteBlocks(html, unattributed, original, renderImage) {
  const stack = [{kind:'root',parts:[]}];
  const tags = /<\/?(?:blockquote|div|img)\b[^>]*>/gi;
  let pos = 0;
  function closeFrame(){
    const frame=stack.pop(),parent=stack.at(-1);
    const contents=frame.parts.join('');
    if(original){
      if(frame.kind==='quote'){
        const quoted=visibleHtmlText(contents).split('\n').filter(Boolean).map(line=>'&gt; '+line.replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;')).join('\n');
        parent.parts.push('\n'+quoted+'\n');
      }else parent.parts.push(contents+'\n');
      return;
    }
    if (unattributed && frame.kind==='quote' && !frame.attributed) {
      const words=visibleHtmlText(contents);
      if (words.trim()) unattributed.push(words);
    }
    if(frame.kind==='attribution'&&/forwarded message|전달(?:된)?\s*(?:메일|메시지)/i.test(contents)) parent.parts.push('\u0001');
    if(frame.kind==='quote'||(frame.kind==='content'&&frame.hasQuote))parent.hasQuote=true;
    const boundary=contents.search(/\u0001|^-{2,}\s*forwarded message/im);
    if (frame.kind==='gmail' && boundary>=0) { parent.parts.push(contents.slice(0,boundary)+'\n'); return; }
    if (frame.kind==='gmail' && !frame.hasQuote && unattributed) {
      const words=visibleHtmlText(contents);
      if (words) unattributed.push(words);
    }
    const quoted=frame.kind==='quote'||frame.kind==='attribution'||(frame.kind==='gmail'&&!frame.hasQuote);
    if (frame.kind === 'quote') parent.parts.push(REMOVED_QUOTE + '\n');
    else parent.parts.push(quoted ? '\n' : contents + '\n');
  }
  for(const match of html.matchAll(tags)){
    const tag = match[0], closing = tag[1] === '/', name = /^<\/?([\w]+)/.exec(tag)[1].toLowerCase();
    stack.at(-1).parts.push(html.slice(pos,match.index));
    if(name==='img'){
      stack.at(-1).parts.push(renderImage(tag,stack.some(frame=>frame.attributed)));
    }else if(closing){
      const open=stack.findLastIndex(frame=>frame.name===name);
      if(open>0)while(stack.length>open)closeFrame();
    }else{
      const classes=/\bclass\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.split(/\s+/)||[];
      const kind=name==='blockquote'?'quote':classes.includes('gmail_attr')?'attribution':classes.includes('gmail_quote')?'gmail':'content';
      const attributed=kind==='quote' && (/\b(?:cite\s*=|type\s*=\s*["']?cite\b)/i.test(tag) ||
        stack.some(parent=>parent.kind==='gmail'||parent.attributed) ||
        /\bOn\b[^<>\n]{1,400}\bwrote:\s*(?:<[^>]*>\s*)*$/i.test(html.slice(Math.max(0,match.index-600),match.index)));
      stack.push({name,kind,attributed,parts:['\n'],hasQuote:false});
    }
    pos = match.index+tag.length;
  }
  stack.at(-1).parts.push(html.slice(pos));
  while(stack.length>1)closeFrame();
  return stack[0].parts.join('');
}
// Use the HTML5 tree builder to distinguish real elements, comments and literal text.
// The following transformations operate on this inert representation, never on executable DOM.
function readableFontSize(declaration) {
  const match=/^font-size\s*:\s*(\d+(?:\.\d+)?|\.\d+)(px|pt|em|rem|%)$/iu.exec(declaration);
  if(!match)return /^font-size\s*:\s*(?:small|medium|large|x-large)$/iu.test(declaration);
  const size=Number(match[1]);
  switch(match[2].toLowerCase()){
    case '%': return size>=50 && size<=400;
    case 'em': case 'rem': return size>=0.5 && size<=4;
    default: return size>=6 && size<=96;
  }
}

const zeroCssLength = /^[+-]?(?:0+(?:\.0+)?|\.0+)(?:e[+-]?\d+)?(?:%|px|pt|pc|in|cm|mm|q|r?(?:em|ex|cap|ch|ic|lh)|[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))?$/iu;
function zeroMargin(declaration) {
  const match = /^margin(?:-(top|right|bottom|left))?\s*:\s*([^!]+?)(?:\s*!\s*important)?$/iu.exec(declaration);
  if (!match) return false;
  const values = match[2].trim().split(/\s+/u);
  return values.length <= (match[1] ? 1 : 4) && values.every(value => zeroCssLength.test(value));
}

const textAlignment = /^text-align\s*:\s*(?:left|right|center|justify|start|end)(?:\s*!\s*important)?$/iu;

function mailTreeMarkup(raw, reasons) {
  const {parse}=require('./estimate-html5.cjs');
  let uncertain=false, uncertainStyles=false;
  const document=parse(raw,{scriptingEnabled:false,onParseError:error=>{if(error.code!=='missing-doctype')uncertain=true;}});
  const html=document.childNodes.find(n=>n.tagName==='html');
  const head=html?.childNodes.find(n=>n.tagName==='head');
  const body=html?.childNodes.find(n=>n.tagName==='body');
  const leadingHead=/^\s*(?:<!doctype\s+html\s*>\s*)?(?:<html(?=[\s>])[^>]*>\s*)?<head(?=[\s>])/iu;
  if(/<head(?=[\s>])/iu.test(raw) && !leadingHead.test(raw))uncertain=true;
  function controlsVisibility(node){
    return node?.attrs?.some(({name,value})=>name==='hidden' || name==='aria-hidden' && value.trim().toLowerCase()==='true' ||
      name==='style' && /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*(?:0(?:\.0+)?|\.0+)|mso-hide\s*:\s*all)\s*(?:!important\s*)?(?=;|$)/iu.test(value));
  }
  let visibilityAttribute=Boolean(controlsVisibility(html) || controlsVisibility(body));
  if(visibilityAttribute)uncertain=true;
  const children=[...(head?.childNodes||[]).filter(n=>['style','link'].includes(n.tagName)),...(body?.childNodes||[])];
  if(!body){uncertain=true;children.push(...(html?.childNodes||[]).filter(n=>n!==head));}
  const stack=children.reverse(),out=[];
  const voidTag=/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/u;
  const escape=text=>text.replace(/&/gu,'&amp;').replace(/</gu,'&lt;').replace(/>/gu,'&gt;').replace(/[\u0000\u0001]/gu,'\ufffd');
  while(stack.length){
    const node=stack.pop();
    if(typeof node==='string'){out.push(node);continue;}
    if(node.nodeName==='#text'){out.push(escape(node.value));continue;}
    if(node.nodeName==='#comment'){
      if(/^\s*\[if[\s\]]/iu.test(node.data)){uncertain=true;out.push(escape(node.data));}
      continue;
    }
    const name=node.tagName;
    if(!name || name==='script')continue;
    if(name==='link'){uncertain=true;uncertainStyles=true;continue;}
    if(name==='style'){
      const rawStyle=node.childNodes.map(child=>child.value || '').join('').trim();
      const css=rawStyle.startsWith('<!--') && rawStyle.endsWith('-->') ? rawStyle.slice(4,-3) : rawStyle;
      const rest=css.replace(/\/\*[\s\S]*?\*\//gu,'').replace(/[^{}@]+\{([^{}]*)\}/gu,(block,body)=>{
        const declarations=body.split(';').map(s=>s.trim()).filter(Boolean);
        return declarations.every(s=>readableFontSize(s) || zeroMargin(s) || textAlignment.test(s) || /^(?:font-family\s*:\s*[\p{L}\p{N}\s,'"-]+|font-weight\s*:\s*(?:[1-9]00|normal|bold|bolder|lighter)|font-style\s*:\s*(?:normal|italic|oblique))$/iu.test(s)) ? '' : block;
      });
      if(rest.trim()){uncertain=true;uncertainStyles=true;}
      continue;
    }
    visibilityAttribute ||= Boolean(controlsVisibility(node));
    const inline=node.attrs?.find(({name})=>name==='style')?.value || '';
    const struck=['s','strike','del'].includes(name) ||
      /(?:^|;)\s*text-decoration(?:-line)?\s*:[^;]*\bline-through\b/iu.test(inline);
    if(/(?:^|;)\s*overflow(?:-[xy])?\s*:\s*hidden/iu.test(inline) && /(?:^|;)\s*(?:max-)?(?:width|height)\s*:/iu.test(inline))uncertain=true;
    if(['title','template','select','textarea','xmp','plaintext','noscript','math','svg','iframe','object','embed','canvas','video','form','picture'].includes(name))uncertain=true;
    // Emit only the fixed vocabulary the text and quotation readers understand.
    // Custom element names are ordinary containers and can never become a style or a quote.
    const tag=/^(?:p|div|span|td|th|br|li|tr|h[1-6]|blockquote|table|a|img|hr)$/u.test(name) ? name
      : /^(?:address|article|aside|caption|dd|details|dl|dt|fieldset|figcaption|figure|footer|form|header|main|nav|ol|pre|section|ul)$/u.test(name) ? 'div' : 'span';
    const attrs=(node.attrs||[]).filter(a=>['style','hidden','aria-hidden','class','cite','type','href','src','alt','role'].includes(a.name)).map(a=>{
      if(a.name==='hidden' && !a.value)return ' hidden';
      const value=a.name==='href' ? a.value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/gu,'') : a.value;
      return ' '+a.name+'="'+escape(value).replace(/"/gu,'&quot;').replace(/'/gu,'&#39;').replace(/=/gu,'&#61;').replace(/\u00a0/gu,'&#160;')+'"';
    }).join('');
    out.push('<'+tag+attrs+'>');
    if(voidTag.test(name)){if(!voidTag.test(tag))out.push('</'+tag+'>');continue;}
    if(struck)out.push('〔취소선〕');
    stack.push((struck?'〔/취소선〕':'')+'</'+tag+'>');
    const content=node.content?.childNodes || node.childNodes || [];
    for(let i=content.length-1;i>=0;i--)stack.push(content[i]);
  }
  const markup=out.join('');
  if(raw!==markup && visibilityAttribute)uncertain=true;
  // HTML can discard a cell outside a table while keeping its text. A lost cell no longer tells us how that text was shown.
  if(/<t[dh](?=[\s>])/iu.test(raw)){
    const sourceTags=raw.match(/<!--[\s\S]*?-->|<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)\s*>|<[a-z][\w:-]*(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/giu) || [];
    const cells=sourceTags.filter(tag=>/^<t[dh](?=[\s>])/iu.test(tag)).length;
    if(cells!==(markup.match(/<t[dh](?=[\s>])/giu)||[]).length)uncertain=true;
  }
  if(uncertain)reasons?.push('HTML 표시 조건 확인 필요');
  return {markup,uncertainStyles};
}

function htmlText(html, unattributed, original=false, relatedImages=null) {
  const raw=String(html||'');
  let {markup,uncertainStyles}=mailTreeMarkup(raw,unattributed);
  if (/\s(?:style|hidden|aria-hidden)(?=[\s=/>])/iu.test(markup)) {
    // A simple sequence of text leaves has no HTML insertion mode or parent CSS to resolve.
    // In richer documents retain the text and ask the reader to check the original.
    const flatLeaves=markup.replace(/<(p|div|span)(?:\s+(?:hidden|style\s*=\s*(?:"[^"<>]*"|'[^'<>]*')))?\s*>[^<>]*<\/\1\s*>/giu,'');
    const flatTextBody=markup===String(html||'') && !/[<>]/u.test(flatLeaves);
    const decodedMarkup=decodeHtmlReferences(markup);
    const nestedVisibility=/visibility\s*:\s*visible/iu.test(decodedMarkup);
    if (nestedVisibility || /aria-hidden\s*=|mso-hide\s*:/iu.test(markup)) unattributed?.push('HTML 표시 조건 확인 필요');
    const tags=/<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/giu;
    let pos=0, visible='';
    for(const tag of markup.matchAll(tags)){
      if(tag.index<pos)continue;
      visible+=markup.slice(pos,tag.index);
      const name=tag[1].toLowerCase(), closing=tag[0][1]==='/';
      pos=tag.index+tag[0].length;
      if(closing){
        visible+=tag[0];
      } else {
        // Only actual attributes and style declarations control display. A title may quote CSS as plain text.
        let hiddenAttribute=false, ariaHidden=false;
        const style=[];
        for (const attribute of tag[0].matchAll(/\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu)) {
          const name=attribute[1].toLowerCase(), value=attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
          if(name==='hidden')hiddenAttribute=true;
          if(name==='aria-hidden' && decodeHtmlReferences(value).trim().toLowerCase()==='true')ariaHidden=true;
          if(name==='style')style.push(decodeHtmlReferences(value));
        }
        const inlineStyle=style.join(';');
        const uncertainInline = /&(?:#|[a-z])|\\|\/\*|(?:^|;)\s*all\s*:|var\s*\(/iu.test(inlineStyle);
        const declarations=inlineStyle.replace(/\/\*[\s\S]*?\*\//gu,'').split(';').map(s=>s.trim());
        const properties=declarations.filter(s=>/^(?:display|visibility|opacity|mso-hide)\s*:/iu.test(s));
        const hidesStyle=properties.some(s=>/^(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*(?:0(?:\.0+)?|\.0+)|mso-hide\s*:\s*all)\s*(?:!important)?$/iu.test(s));
        const names=properties.map(s=>s.split(':',1)[0].trim().toLowerCase());
        // Dropping text is safe only up to its own explicit closing tag, with no intervening markup.
        // HTML can implicitly close paragraphs, list items and cells, and children can override visibility.
        const candidate=hiddenAttribute || hidesStyle;
        const voidTag=/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/u.test(name);
        const nextOpen=candidate && !voidTag ? markup.indexOf('<',pos) : -1;
        const boundary=nextOpen<0 ? null : /^<\/([\w:-]+)\s*>/u.exec(markup.slice(nextOpen));
        const closedLeaf=boundary?.[1].toLowerCase()===name;
        const literalTag=/^[\x20-\x7e\t\r\n\f]+$/u.test(tag[0]) && !tag[0].includes('&');
        const singleHide=literalTag && (hiddenAttribute ? !style.length :
          style.length===1 && /^(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*(?:0(?:\.0+)?|\.0+))\s*(?:!important)?\s*;?$/iu.test(inlineStyle.trim()));
        const ambiguous=uncertainInline || (candidate && (!flatTextBody || !singleHide || uncertainStyles || !closedLeaf)) ||
          (hiddenAttribute && names.includes('display')) || (hidesStyle && new Set(names).size!==names.length) ||
          (nestedVisibility && names.includes('visibility')) || ariaHidden || names.includes('mso-hide');
        if(ambiguous)unattributed?.push('HTML 표시 조건 확인 필요');
        if(!candidate || ambiguous)visible+=tag[0];
        else if(closedLeaf)pos=nextOpen+boundary[0].length;
      }
    }
    markup=visible+markup.slice(pos);
  }
  function renderImage(tag,inQuotedMail){
    const attrs=new Map();
    for(const match of tag.matchAll(/\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/gu)){
      const key=match[1].toLowerCase();
      if(!attrs.has(key))attrs.set(key,decodeHtmlReferences(match[2]??match[3]??match[4]??'').trim());
    }
    const label=attrs.get('alt') || '';
    const decorative=attrs.get('alt')==='' && /^(?:none|presentation)$/iu.test(attrs.get('role') || '');
    if(!inQuotedMail && !decorative)unattributed?.push(IMAGE_REVIEW);
    if(relatedImages && /^cid:/iu.test(attrs.get('src') || '')){
      let id=attrs.get('src').slice(4);
      try{id=decodeURIComponent(id);}catch{}
      (inQuotedMail || decorative ? relatedImages.decorative : relatedImages.informative).add(id);
    }
    if(!inQuotedMail && label)unattributed?.push(ALT_REVIEW);
    return original && label ? ' '+label.replace(/</gu,'&lt;').replace(/>/gu,'&gt;')+' ' : ' ';
  }
  return visibleHtmlText(mailQuoteBlocks(markup,unattributed,original,renderImage));
}
function decodeHtmlReferences(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+);?|&([a-z][a-z0-9]*);/gi, (all, numeric, named) => {
    if (numeric) {
      const code = numeric[1].toLowerCase() === 'x' ? parseInt(numeric.slice(2),16) : Number(numeric.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
    }
    if (named === 'Tab') return '\t';
    if (named === 'NewLine') return '\n';
    if (named === 'colon') return ':';
    if (named === 'semi') return ';';
    const key=named.toLowerCase();
    return Object.hasOwn(ENTITIES,key) ? ENTITIES[key] : all;
  });
}
function visibleHtmlText(fragment) {
  const flatten=markup=>decodeHtmlReferences(markup
    .replace(/<\/(?:td|th)\s*>/gi, ' ')
    .replace(/<\/?(?:br|hr|p|div|li|tr|h[1-6]|blockquote|table)(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/gi, '\n')
    .replace(/<!doctype\s+[^>]*>|<\/?[a-z][\w:-]*(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'">])*>/giu, ''));
  const anchors=/<a\b[^>]*?\bhref\s*=\s*(?:"(https?:\/\/[^"\s<>]+)"|'(https?:\/\/[^'\s<>]+)')[^>]*>([\s\S]*?)<\/a\s*>/giu;
  const parts=[];
  let start=0;
  for(const hit of fragment.matchAll(anchors)){
    parts.push(flatten(fragment.slice(start,hit.index)));
    parts.push({address:decodeHtmlReferences(hit[1]||hit[2]),label:flatten(hit[3])});
    start=hit.index+hit[0].length;
  }
  parts.push(flatten(fragment.slice(start)));
  const text=parts.map((part,i)=>{
    if(typeof part==='string')return part;
    const {address,label}=part;
    if(!label.trim())return label;
    if(label.trim()!==address)return label+' ('+address+')';
    if(/[,，;；](?:https?):\/\//iu.test(address))return '<'+address+'>';
    const before=parts[i-1].at(-1)?.normalize('NFKC'),after=parts[i+1][0]?.normalize('NFKC');
    const wrapped=before==='(' && after===')' || before==='<' && after==='>' || before==='〈' && after==='〉';
    const punctuation=/[.,!?;:。．，！？；：]/u;
    return !wrapped && (punctuation.test(address.at(-1)) || punctuation.test(after||'')) ? '('+address+')' : label;
  }).join('');
  return text
    .replace(/(^|\n)[ \t]*On [^\n?？]{1,400}? wrote:\s*\u0000/gi, '$1\n')
    .replace(/[\u0000\u0001]/gu, '\n')
    .replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
function unresolvedQuotes(parts, plain) {
  const ambiguous=parts.flatMap(part=>part.unattributed || []);
  if (!ambiguous.length || !plain) return ambiguous;
  const normalize=value=>value.normalize('NFKC').replace(/\s+/gu,' ').trim();
  const lines=String(plain).split(/\r?\n/u).filter(line=>/^\s*>/u.test(line)).map(line=>line.replace(/^\s*(?:>\s*)+/u,''));
  const quoted=normalize(lines.join(' '));
  return ambiguous.filter(value=>isImageWarning(value) || !quoted.includes(normalize(value)));
}

// BODYSTRUCTURE lists every sibling even when the raw preview stops inside a file.
function onlyFilePartsRemain(structure, subtype, completed, started) {
  if (!Array.isArray(structure) || !completed) return false;
  const count = structure.findIndex(value => !Array.isArray(value));
  if (count < started || count <= completed || String(structure[count]).toLowerCase() !== subtype) return false;
  return structure.slice(completed,count).every(part => {
    const type = String(part[0]).toLowerCase();
    const index = type === 'text' ? 9 : type === 'message' && String(part[1]).toLowerCase() === 'rfc822' ? 11 : 8;
    return !Array.isArray(part[0]) && Array.isArray(part[index]) && String(part[index][0]).toLowerCase() === 'attachment';
  });
}

// Display one readable body. Track the other MIME parts before trusting it for pricing.
function findText(entity, depth = 0, structure = null, clipped = false, parentType = '',original=false, imageContext=null) {
  if (depth > 12) return { doubtful: true };
  const split = splitEntity(entity);
  if (!split) return clipped ? {partial:true} : { doubtful: true, broken: true };
  const type = params(split.fields.get('content-type')?.[0] || 'text/plain');
  const disposition = params(split.fields.get('content-disposition')?.[0] || '');
  if(imageContext && parentType==='multipart/related' && type.value.startsWith('image/') && disposition.value!=='attachment'){
    const id=(split.fields.get('content-id')?.[0] || '').trim().replace(/^<([^<>]+)>$/u,'$1');
    imageContext.parts.add(id);
    return {};
  }
  if (disposition.value === 'attachment' || (parentType !== 'multipart/alternative' && disposition.value !== 'inline' && (disposition.filename || type.name))) return {hasAttachments:true};
  if (type.value.startsWith('multipart/')) {
    if (!type.boundary) return { doubtful: true };
    const body = split.body.toString('latin1'), mark = '--' + type.boundary;
    const pieces = body.split(new RegExp('(?:^|\\r?\\n)' + mark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(--)?[ \\t]*(?:\\r?\\n|$)'));
    const candidates = [];
    const images=type.value==='multipart/related' ? {parts:new Set(),decorative:new Set(),informative:new Set()} : imageContext;
    let doubtful = false, partial = false, closed = false, hasAttachments=false, completed = 0, started = 0;
    // split 결과: [머리말, 닫힘표시, 조각, 닫힘표시, ...]
    for (let i = 2; i < pieces.length; i += 2) {
      if (pieces[i - 1] === '--') { closed = true; break; }
      started++;
      const ended = i + 1 < pieces.length;
      if (ended) completed++;
      // The server identified all unseen data as explicit file attachments. Its truncated header may itself be incomplete.
      if (!ended && onlyFilePartsRemain(structure, type.value.slice(10), completed, started)) continue;
      const found = findText(Buffer.from(pieces[i] || '', 'latin1'), depth + 1, Array.isArray(structure)?structure[started-1]:null, clipped && !ended,type.value,original,images);
      hasAttachments ||= found.hasAttachments===true;
      doubtful ||= !!found.doubtful;
      partial ||= !!found.partial;
      if (found.plain != null || found.html != null || found.unattributed?.length) candidates.push(found);
    }
    const bodyOf = part => part.plain ?? part.html ?? '';
    if(type.value==='multipart/related' && [...images.parts].some(id=>!id || !images.decorative.has(id) || images.informative.has(id)))partial=true;
    const readable = candidates.filter(part => bodyOf(part).trim());
    const selected = readable.find(part => part.plain) || readable[0] || candidates[0] || {};
    if (readable.length !== candidates.length) partial = true;
    if (!original && readable.length > 1) {
      partial ||= type.value !== 'multipart/alternative' ||
        readable.some(part => !sameCurrentBody(bodyOf(part), bodyOf(selected)));
    }
    const onlyAttachmentsMissing = !closed && onlyFilePartsRemain(structure, type.value.slice(10), completed, started);
    if(original && readable.length){
      const contents=readable.map(bodyOf);
      const texts=type.value==='multipart/alternative' ? originalBodyVersions(contents) : contents;
      const alternatives=type.value==='multipart/alternative' && texts.length>1;
      const displayed=alternatives ? texts.map((text,i)=>'[본문 '+(i+1)+']\n'+text) : texts;
      return {plain:displayed.join('\n\n'),doubtful,partial:partial || alternatives || candidates.some(c=>c.unattributed?.length) || !closed && !onlyAttachmentsMissing};
    }
    return { ...selected, doubtful, hasAttachments:hasAttachments||onlyAttachmentsMissing, unattributed:unresolvedQuotes(candidates,type.value === 'multipart/alternative' && selected.plain),
      partial:partial || !closed && !onlyAttachmentsMissing, onlyAttachmentsMissing };
  }
  if (type.value !== 'text/plain' && type.value !== 'text/html' && type.value !== '') return { partial:!(parentType==='multipart/related' && type.value.startsWith('image/')) };
  const transfer = decodeTransfer(split.body, split.fields.get('content-transfer-encoding')?.[0],clipped);
  if (!transfer.ok) return { doubtful: true };
  const decoded = decodeBytes(transfer.bytes, type.charset,clipped);
  if (type.value !== 'text/html') return { plain: decoded.text, doubtful: decoded.doubtful };
  const unattributed=[];
  return { html: htmlText(decoded.text,unattributed,original,imageContext), unattributed, doubtful: decoded.doubtful };
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function internalTime(value) {
  const m = /^\s?(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(String(value || ''));
  if (!m || !(m[2].toLowerCase() in MONTHS)) return NaN;
  const offset = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9])) * 60000;
  return Date.UTC(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) - offset;
}

const messageIds = line => (String(line || '').match(/<[^<>\s]{1,500}>/g) || []);

function naverMessage({ boxId, folder, uidvalidity, uid, record, me }) {
  const id = hash(boxId, 'naver', folder.raw, uidvalidity, uid);
  const flags = new Set(record?.flags || []);
  // 초안인지는 \Draft 표시로 정한다. 보낸 답장을 임시 보관함으로 옮겨도 초안이 되지 않는다(0.5.8 검수 GPT-N).
  const draft = flags.has('\\DRAFT');
  const base = {
    id, originalRef:{folder:folder.raw,uidvalidity,uid}, threadId: hash(boxId, 'naver-thread', 'uid', id), at: internalTime(record?.internalDate), subject: '', text: '',
    outgoing: false, directionUncertain:!draft && folder.role==='sent', draft, copied: false, automatic: false, bulk: false,
    excluded: folder.role === 'trash' || folder.role === 'junk' || flags.has('\\DELETED'), uncertain: '',
  };
  if (!Number.isFinite(base.at)) base.at = 0;
  const raw = record?.raw;
  const split = raw ? splitEntity(raw) : null;
  const truncated = !!raw && (Number(record.size) > raw.length || raw.length >= PREVIEW && !Number.isSafeInteger(record.size));
  if (!split && truncated) return { ...base, partialBody:true, uncertain:'메일 머리글이 길어 원문 확인이 필요해요.' };
  if (!split) return { ...base, unreadable: true, uncertain: '메일 형식을 읽지 못해 직접 확인이 필요해요.' };
  const one = name => split.fields.get(name)?.[0] || '';
  const fromFields = split.fields.get('from') || [];
  const namePart = fromFields.length === 1 ? headerDisplayName(fromFields[0]) : '';
  const from = namePart ? decodeHeader(namePart) : null;
  const senderName = from && !from.doubtful && !/[<>"\u0000-\u001f]/u.test(from.text) ? from.text : '';
  const subject = decodeHeader(one('subject')), to = decodeHeader(split.fields.get('to')?.join(', ') || ''), cc = decodeHeader(split.fields.get('cc')?.join(', ') || '');
  const senders=fromFields.length===1 ? headerAddresses(fromFields[0]) : [];
  const fromSelf=senders.length===1 && senders[0]===me;
  const direct=headerAddresses(to.text).includes(me),copy=headerAddresses(cc.text).includes(me);
  const incoming=senders.length===1 && !fromSelf && (direct||copy);
  const outgoing=!draft && folder.role==='sent' && fromSelf;
  const own = messageIds(one('message-id'))[0] || '';
  const related=[...new Set([...messageIds(one('references')),...messageIds(one('in-reply-to')),own].filter(Boolean))].slice(0,100);
  if(own&&!related.includes(own))related.push(own);
  const root = related[0]||'';
  const automatic = one('auto-submitted').toLowerCase();
  const found = findText(raw, 0, truncated ? record.structure : null,truncated);
  const body = found.plain ?? found.html ?? '';
  const text = textValue(String(body).replace(/\r\n?/g, '\n'), TEXT_LIMIT);
  if (!base.at) base.at = Date.parse(one('date')) || 0;
  const message = {
    ...base,
    customerStableId:own?hash(boxId,'naver-customer-message',own,one('from')):null,
    evidenceId:own?hash(boxId,'naver-message',own,one('from'),one('date'),subject.text,text):id,
    threadLinks:related.map(ref=>hash(boxId,'naver-thread',ref)), hasAttachments:found.hasAttachments===true,
    threadId: root ? hash(boxId, 'naver-thread', root) : base.threadId,
    senderName, subject: textValue(subject.text, 500), text, bodySource:found.plain != null ? 'plain' : found.html != null ? 'html' : 'none',
    readingReason:found.unattributed?.length ? 'HTML에서 현재 문의로 확인할 수 없는 부분이 있어요.' : '',
    partialBody: truncated && !found.onlyAttachmentsMissing || !!found.partial || !!found.unattributed?.length || text.length >= TEXT_LIMIT,
    outgoing, directionUncertain:base.directionUncertain && !outgoing && !incoming,
    possibleSelf: !outgoing && !draft && fromSelf, copied:copy && !direct,
    ...submissionFlags(automatic,split.fields.has('x-autoreply') || split.fields.has('x-autorespond')),
    bulk: split.fields.has('list-unsubscribe') || split.fields.has('list-id') || /bulk|list|junk/i.test(one('precedence')),
  };
  if (!text && truncated && !found.broken && !found.doubtful) {
    return { ...message, partialBody:true, uncertain:'미리보기 범위에 본문이 없어 원문 확인이 필요해요.' };
  }
  if (found.broken) {
    return { ...message, text: '', unreadable: true, uncertain: '본문을 읽지 못해 직접 확인이 필요해요.' };
  }
  if (found.doubtful || subject.doubtful) {
    return { ...message, unreadable: true, uncertain: '글자나 형식 일부를 해독하지 못해 직접 확인이 필요해요.' };
  }
  if(message.possibleSelf)message.uncertain='보낸 사람이 내 주소지만 보낸 편지함 밖에 있어 직접 확인이 필요해요.';
  if (!message.at) message.uncertain = '받은 시각을 읽지 못했어요.';
  return message;
}

// ---------- UID 구간 ----------

function addUids(ranges, uids) {
  const all = [...ranges.map(r => [r[0], r[1]]), ...uids.map(u => [u, u])].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const r of all) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]); else out.push(r);
  }
  return out;
}
function uidsIn(ranges) { const out = []; for (const [a, b] of ranges) for (let u = a; u <= b; u++) out.push(u); return out; }
const countIn = ranges => ranges.reduce((n, [a, b]) => n + b - a + 1, 0);

// ---------- 검사 ----------

function validCursor(cursor, address) {
  return cursor && cursor.v === 1 && cursor.provider === 'naver' && cursor.address === address &&
    ['scan', 'verify', 'done'].includes(cursor.phase) && !(cursor.phase==='done'&&cursor.coverage?.partial&&cursor.coverage.unreadableSent!==0) && Number.isSafeInteger(cursor.generation) && Array.isArray(cursor.folders) &&
    cursor.folders.every(f => typeof f.raw === 'string' && typeof f.role === 'string' && Array.isArray(f.seen) &&
      Number.isSafeInteger(f.last) && (f.uidvalidity === null || Number.isSafeInteger(f.uidvalidity)));
}

const restartSignal = () => Object.assign(fault('MAIL_CHANGED', '메일함 번호가 바뀌어 처음부터 다시 읽어야 해요.'), { restart: true });
const transient = error => ['MAIL_NETWORK', 'MAIL_TIMEOUT'].includes(error?.code);

async function verifyNaver({ address, password, signal, connect, onCommand } = {}) {
  const account = naverAccount(address, password);
  const session = await openImap({ connect, signal, onCommand });
  try {
    await login(session, account);
    const { folders } = await listFolders(session);
    if (!folders.some(f => f.role === 'inbox')) throw fault('MAIL_FOLDER', '받은 메일함을 찾지 못했어요.');
    return { address: account.address };
  } finally { await session.close(); }
}

async function readOriginal({box,ref,signal,connect,onCommand}) {
  const account=naverAccount(box.credential?.address,box.credential?.password);
  if(account.address!==box.subject)throw fault('MAIL_AUTH','연결한 메일함을 확인해 주세요.');
  if(typeof ref?.folder!=='string'||!ref.folder||ref.folder.length>1024||![ref.uid,ref.uidvalidity].every(n=>Number.isSafeInteger(n)&&n>0&&n<=4294967295))throw fault('STALE','메일함을 갱신한 뒤 다시 열어 주세요.');
  const session=await openImap({connect,signal,onCommand});
  try{
    await login(session,account);
    const folder=await examine(session,ref.folder);
    if(folder?.uidvalidity!==ref.uidvalidity)throw fault('STALE','메일함이 바뀌었어요. 갱신한 뒤 다시 열어 주세요.');
    const record=(await fetchUids(session,[ref.uid],MAX_LITERAL)).get(ref.uid);
    if(!record?.raw || record.flags?.includes('\\DELETED'))throw fault('STALE','해당 메일이 이동했거나 삭제됐어요. 메일함을 다시 확인해 주세요.');
    const clipped=record.size>record.raw.length||(!Number.isSafeInteger(record.size)&&record.raw.length>=MAX_LITERAL);
    const content=findText(record.raw,0,record.structure,clipped,'',true);
    const text=content.plain??content.html??'';
    if(!text.trim())throw fault('READ','이 메일의 글 본문을 표시할 수 없어요. 메일함에서 확인해 주세요.');
    return {text,partial:Boolean(clipped||content.partial||content.doubtful||content.unattributed?.length)};
  }finally{await session.close();}
}

async function scanNaver({ box, credential, signal, commit, connect, onCommand, now = Date.now, reconnects = 2, batch = BATCH } = {}) {
  if (!box || typeof box.id !== 'string' || !box.id) throw fault('VALUE', '메일함 정보를 확인해 주세요.');
  if (typeof commit !== 'function') throw fault('VALUE', '검사 결과를 저장할 곳이 필요해요.');
  const account = naverAccount(credential?.address, credential?.password);
  if (box.subject && String(box.subject).toLowerCase() !== account.address) throw fault('MAIL_AUTH', '연결할 때 확인한 메일함과 지금 계정이 달라요.');
  const me = account.address, boxIdOf = box.id;
  let saved = validCursor(box.cursor, me) ? structuredClone(box.cursor) : null;
  let state = saved && structuredClone(saved);
  if(state?.phase==='done'){state.phase='verify';state.startedAt=now();saved=structuredClone(state);}
  let resumedFolders=!!state;
  let session = null, restarts = 0, rounds = 0, failures = reconnects;

  const save = async (change) => { await commit({ ...change, cursor: state }); saved = structuredClone(state); };
  const connectSession = async () => {
    session = await openImap({ connect, signal, onCommand });
    await login(session, account);
  };
  async function begin() {
    const { folders, skipped } = await listFolders(session);
    state = {
      v: 1, provider: 'naver', address: me, generation: (saved?.generation || box.cursor?.generation || 0) + 1, phase: 'scan',
      startedAt: now(), skipped,
      folders: folders.map(f => ({ raw: f.raw, role: f.role, uidvalidity: null, hi: 0, last: 0, seen: [], unreadable: 0, done: false, failed: false })),
    };
    rounds = 0;
    await save({ messages: [], reset: true });
  }

  async function scanFolder(f) {
    const info = await examine(session, f.raw);
    if (!info) { f.failed = true; return; }
    f.failed = false;
    if (f.uidvalidity === null) {
      f.uidvalidity = info.uidvalidity;
      f.hi = info.uidnext ? info.uidnext - 1 : info.exists ? await highestUid(session, f.role === 'sent') : 0;
    } else if (f.uidvalidity !== info.uidvalidity) throw restartSignal();
    const uids = await searchUids(session, f.last + 1, f.hi, f.role === 'sent');
    for (let i = 0; i < uids.length; i += batch) {
      signal?.throwIfAborted();
      const chunk = uids.slice(i, i + batch);
      const records = await fetchUids(session, chunk);
      const messages = [], present = [];
      for (const uid of chunk) {
        const record = records.get(uid);
        if (!record || record.flags?.includes('\\DELETED') && f.role !== 'sent') continue;
        const message = naverMessage({ boxId: boxIdOf, folder: f, uidvalidity: f.uidvalidity, uid, record, me });
        if (message.unreadable) f.unreadable++;
        messages.push(message); present.push(uid);
      }
      f.last = chunk[chunk.length - 1];
      f.seen = addUids(f.seen, present);
      await save({ messages });
    }
    f.last = Math.max(f.last, f.hi);
    f.done = true;
    await save({ messages: [] });
  }

  async function verifyRound() {
    let changed = false;
    const removed = [];
    const { folders } = await listFolders(session);
    const fresh = new Map(folders.map(f => [f.raw, f]));
    for (const f of [...state.folders]) {
      if(fresh.has(f.raw)&&fresh.get(f.raw).role!==f.role)throw restartSignal();
      if (!fresh.has(f.raw)) {
        for (const uid of uidsIn(f.seen)) removed.push(hash(boxIdOf, 'naver', f.raw, f.uidvalidity, uid));
        state.folders.splice(state.folders.indexOf(f), 1); changed = true;
      }
    }
    for (const f of folders) {
      if (!state.folders.some(s => s.raw === f.raw)) {
        state.folders.push({ raw: f.raw, role: f.role, uidvalidity: null, hi: 0, last: 0, seen: [], unreadable: 0, done: false, failed: false });
        changed = true;
      }
    }
    for (const f of state.folders) {
      if (!f.done || f.uidvalidity === null) continue;
      const info = await examine(session, f.raw);
      if (!info) { f.failed = true; f.done = false; changed = true; continue; }
      if (info.uidvalidity !== f.uidvalidity) throw restartSignal();
      const top = info.uidnext ? info.uidnext - 1 : info.exists ? await highestUid(session, f.role === 'sent') : 0;
      const present = new Set(f.hi > 0 ? await searchUids(session, 1, f.hi, f.role === 'sent') : []);
      const seen=new Set(uidsIn(f.seen));
      for(const uid of present){
        if(!seen.has(uid) && uid<=f.last){f.last=uid-1;f.done=false;changed=true;}
      }
      const gone = uidsIn(f.seen).filter(uid => !present.has(uid));
      if (gone.length) {
        for (const uid of gone) removed.push(hash(boxIdOf, 'naver', f.raw, f.uidvalidity, uid));
        f.seen = addUids([], uidsIn(f.seen).filter(uid => present.has(uid)));
        changed = true;
      }
      if (top > f.hi) { f.hi = top; f.done = false; changed = true; }
    }
    if (state.folders.some(f => !f.done)) state.phase = 'scan';
    await save({ messages: [], removed });
    return changed;
  }

  try {
    for (;;) {
      try {
        signal?.throwIfAborted();
        if (!session) await connectSession();
        if(resumedFolders&&state){
          const {folders}=await listFolders(session);
          const live=new Map(folders.map(f=>[f.raw,f.role]));
          if(state.folders.some(f=>live.get(f.raw)!==f.role))state=null;
          resumedFolders=false;
        }
        if (!state) await begin();
        if (state.phase === 'scan') {
          for (const f of state.folders) if (!f.done && !f.failed) await scanFolder(f);
          const failed = state.folders.filter(f => f.failed).length;
          if (failed) {
            for (const f of state.folders) f.failed = false; // 다음 실행에서 다시 연다
            await save({ messages: [] });
            throw Object.assign(fault('MAIL_FOLDER', '메일 폴더 ' + failed + '개를 열지 못해 전체 확인을 마치지 못했어요. 다시 시도해 주세요.'), { folders: failed });
          }
          if (state.folders.some(f => !f.done)) continue;
          state.phase = 'verify';
          await save({ messages: [] });
        }
        const changed = await verifyRound();
        if (!changed && state.phase === 'verify') {
          const total = state.folders.reduce((n, f) => n + countIn(f.seen), 0);
          const unreadable = state.folders.reduce((n, f) => n + f.unreadable, 0);
          // 보낸 편지함의 읽지 못한 편지만 메일함 전체를 막는다. 그 편지는 머리글이 깨지면 원래 대화를 잃어 답장 잠금이 빠질 수 있다.
          // 받은 편지함 · 스팸 · 휴지통의 읽지 못한 편지는 제 대화에서 확인 대상으로 남는다(0.5.8 검수 c Fable).
          const unreadableSent = state.folders.filter(f => f.role === 'sent').reduce((n, f) => n + f.unreadable, 0);
          state.phase = 'done';
          state.completedAt = now();
          state.coverage = {
            provider: 'naver', label: '네이버 메일에서 열 수 있는 모든 폴더', folders: state.folders.length,
            excludedFolders: state.folders.filter(f => f.role === 'trash' || f.role === 'junk').length, virtualFoldersSkipped: state.skipped || 0,
            messages: total, unreadable, unreadableSent, partial: unreadable > 0, startedAt: state.startedAt, completedAt: state.completedAt,
          };
          await commit({ messages: [], cursor: state, complete: true, coverage: state.coverage });
          return state.coverage;
        }
        if (++rounds >= MAX_ROUNDS) {
          throw fault('MAIL_CHANGING', '검사하는 동안 메일함이 계속 바뀌어 끝까지 확인하지 못했어요. 잠시 뒤 이어서 확인해 주세요.');
        }
      } catch (error) {
        if (error?.restart && restarts++ < 1) { state = null; continue; }
        if (error?.restart) throw fault('MAIL_CHANGING', '메일함 번호가 계속 바뀌어 전체 확인을 마치지 못했어요.');
        if (transient(error) && failures-- > 0 && !signal?.aborted) {
          await session?.close().catch(() => {});
          session = null; state = saved && structuredClone(saved);
          continue;
        }
        throw error;
      }
    }
  } finally {
    await session?.close().catch(() => {});
  }
}

module.exports = {
  HOST, PORT, PREVIEW, verifyNaver, scanNaver, readOriginal,
  // 시험과 다른 공급자가 쓰는 도우미
  createReader, tokenize, decodeFolder, decodeHeader, decodeBytes, findText, htmlText, unresolvedQuotes, isImageWarning, internalTime, naverMessage, naverAccount,
};
