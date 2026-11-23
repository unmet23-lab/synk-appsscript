'use strict';

// 네이버 IMAP과 Outlook Graph 공급자 시험. 실제 서버에 접속하지 않고 지어낸 자료만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const naver = require('../src/estimate-naver.cjs');
const outlook = require('../src/estimate-outlook.cjs');
const { inspectThread } = require('../src/estimate-domain.cjs');

const USER = 'solio.sample';
const ADDRESS = USER + '@naver.com';
const APP_PASSWORD = 'Zq7Synthetic9Xv';

test('과거 인용의 로고와 현재 문의에 포함된 이미지를 구분한다',()=>{
  const text='<p>제품 영상 1편 견적을 부탁드립니다.</p>';
  const image='<img src="cid:logo" alt="가상 회사 로고">';
  const quoted='<blockquote type="cite">'+image+'</blockquote>';
  function read(html){
    const raw=mail(['From: customer@example.org','To: '+ADDRESS,'Content-Type: multipart/related; boundary=img'],[
      '--img','Content-Type: text/html; charset=utf-8','',text+html,
      '--img','Content-Type: image/png','Content-ID: <logo>','Content-Transfer-Encoding: base64','','AA==','--img--'
    ].join('\r\n'));
    const msg=naver.naverMessage({boxId:'fixture',folder:{raw:'INBOX',role:'inbox'},uidvalidity:7,uid:1,me:ADDRESS,
      record:{raw,size:raw.length,internalDate:'22-Nov-2026 00:00:00 +0000',flags:[]}});
    return {msg,original:naver.findText(raw,0,null,false,'',true)};
  }
  const onlyQuoted=read(quoted);
  assert.equal(onlyQuoted.msg.partialBody,false);
  assert.doesNotMatch(onlyQuoted.msg.text,/가상 회사 로고/);
  assert.match(onlyQuoted.original.plain??onlyQuoted.original.html,/가상 회사 로고/);
  assert.equal(read(image+quoted).msg.partialBody,true);
  assert.equal(read('<blockquote>'+image+'</blockquote>').msg.partialBody,true);
  const quotedArrow=read('<blockquote type="cite"><img alt="홈페이지 바로가기 >" src="cid:logo"></blockquote>');
  assert.equal(quotedArrow.msg.partialBody,false);
  assert.match(quotedArrow.original.plain??quotedArrow.original.html,/홈페이지 바로가기 >/);
  const currentArrow=read('<img alt="납기 12월 4일 > 확정 일정표" src="cid:logo">');
  assert.equal(currentArrow.msg.partialBody,true);
  assert.match(currentArrow.original.plain??currentArrow.original.html,/납기 12월 4일 > 확정 일정표/);
  assert.doesNotMatch(currentArrow.msg.text,/src=|cid:logo/);
  assert.equal(read('<img src="cid:logo" alt="" role="presentation"></img>').msg.partialBody,false);
});

test('네이버 보낸메일함에 들어간 메일도 발신자와 수신자로 방향을 확인한다',()=>{
  const make=(headers,role='sent')=>naver.naverMessage({
    boxId:'naver-direction',folder:{raw:'Folder',role},uidvalidity:11,uid:1,me:ADDRESS,
    record:{raw:mail([...headers,'Subject: 제품 영상 견적','Content-Type: text/plain; charset=utf-8'],'영상 3편 견적 부탁드립니다.'),
      internalDate:'01-Nov-2026 09:00:00 +0900'}});
  const received=['From: customer@example.org','To: '+ADDRESS];
  for(const role of ['sent','archive']){
    const message=make(received,role);
    assert.equal(message.outgoing,false);
    assert.equal(message.directionUncertain,false);
  }
  assert.equal(make(['From: '+ADDRESS,'To: customer@example.org']).outgoing,true);
  const unknown=make(['To: customer@example.org']);
  assert.equal(unknown.outgoing,false);
  assert.equal(unknown.directionUncertain,true);
  assert.equal(inspectThread([unknown]).status,'review');
});

test('네이버에서 삭제 표시된 원문을 읽지 않고 표시를 취소한 예전 메일은 다시 찾는다',async()=>{
  const model=sampleMailbox(),folder=model.folders[0],item=folder.messages[0];
  model.folders=[folder];
  folder.messages=folder.messages.slice(0,2);
  const credential={address:ADDRESS,password:APP_PASSWORD};
  const box={id:'deleted-mail',subject:ADDRESS,credential},ref={folder:folder.raw,uidvalidity:folder.uidvalidity,uid:item.uid};
  const store=staging(),server=fakeImap(model);
  const scan=()=>naver.scanNaver({box:{...box,cursor:store.cursor},credential,commit:store.commit,connect:server.connect});
  await scan();
  const selected=[...store.published.values()].find(m=>m.originalRef.uid===item.uid);
  assert.ok(selected);
  item.flags=['\\Deleted'];
  await scan();
  assert.equal(store.published.has(selected.id),false);
  await assert.rejects(naver.readOriginal({box,ref,connect:server.connect}),{code:'STALE'});
  item.flags=[];
  await scan();
  assert.equal(store.published.has(selected.id),true);
  const race=fakeImap(model,{before({cmd}){if(cmd.startsWith('UID FETCH '))item.flags=['\\Deleted'];}});
  await assert.rejects(naver.readOriginal({box,ref,connect:race.connect}),{code:'STALE'});
});

test('네이버 보낸 편지함의 삭제 표시만 붙은 답장도 읽어 「지난번처럼 해줘」를 잠근다(0.5.8 검수 GPT-M)',async()=>{
  const model=sampleMailbox(),inbox=model.folders[0],sent=model.folders.find(f=>f.uidvalidity===21);
  model.folders=[inbox,sent];
  inbox.messages=inbox.messages.slice(0,1);
  const credential={address:ADDRESS,password:APP_PASSWORD},box={id:'deleted-sent',subject:ADDRESS,credential};
  const store=staging(),server=fakeImap(model);
  const scan=()=>naver.scanNaver({box:{...box,cursor:store.cursor},credential,commit:store.commit,connect:server.connect});
  const replied=()=>{
    const all=[...store.published.values()];
    const reply=all.find(m=>m.originalRef.uid===3 && m.originalRef.uidvalidity===21);
    assert.ok(reply,'삭제 표시가 붙은 보낸 답장도 남는다');
    assert.equal(reply.outgoing,true);
    return {reply,flag:inspectThread(all).repliedSinceRequest};
  };
  // 처음 읽을 때 이미 삭제 표시가 붙어 있으면 휴지통처럼 제외로 남기고 잠근다.
  sent.messages[0].flags=['\\Deleted'];
  await scan();
  let seen=replied();
  assert.equal(seen.reply.excluded,true);assert.equal(seen.flag,true);
  // 읽은 뒤에 삭제 표시가 붙어도 지우지 않는다.
  const fresh=staging(),later=fakeImap(model);
  sent.messages[0].flags=[];
  const rescan=()=>naver.scanNaver({box:{...box,cursor:fresh.cursor},credential,commit:fresh.commit,connect:later.connect});
  await rescan();
  sent.messages[0].flags=['\\Deleted'];
  await rescan();
  store.published=fresh.published;
  seen=replied();
  assert.equal(seen.flag,true);
  assert.ok(later.log.some(l=>/ UID SEARCH UID \d+:\d+$/.test(l)),'보낸 편지함은 삭제 표시를 거르지 않고 찾는다');
  assert.ok(later.log.some(l=>/ UID SEARCH UID \d+:\d+ UNDELETED$/.test(l)),'받은 편지함은 그대로 삭제 표시를 거른다');
  // 보낸 편지함 밖으로 옮긴 내 주소의 편지도 보낸 답장일 수 있어 잠근다.
  const moved=naver.naverMessage({boxId:'box',folder:{raw:'Projects',role:'normal'},uidvalidity:1,uid:30,me:ADDRESS,
    record:{raw:sent.messages[0].raw,size:sent.messages[0].raw.length,internalDate:'02-Nov-2026 09:00:00 +0900'}});
  assert.equal(moved.possibleSelf,true);
  const question=[...store.published.values()].find(m=>m.originalRef.uidvalidity===11);
  assert.equal(inspectThread([question,moved]).repliedSinceRequest,true);
});

test('임시 보관함으로 옮긴 보낸 답장은 초안으로 보지 않고 「지난번처럼 해줘」를 잠근다(0.5.8 검수 GPT-N)',()=>{
  const request=outlook.outlookMessage({boxId:'b',folder:{id:'inbox',role:'inbox'},me:OWNER,item:{id:'ask',subject:'제품 영상 견적 문의',
    receivedDateTime:'2026-11-20T00:00:00Z',from:{emailAddress:{address:'client@example.com',name:'고객'}},toRecipients:[{emailAddress:{address:OWNER}}],
    uniqueBody:{contentType:'text',content:'30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 1회.'}}});
  const sentItem=draft=>({id:'reply',subject:'RE: 제품 영상 견적 문의',isDraft:draft,sentDateTime:'2026-11-20T01:00:00Z',lastModifiedDateTime:'2026-11-20T01:00:00Z',
    from:{emailAddress:{address:OWNER}},toRecipients:[{emailAddress:{address:'client@example.com'}}],uniqueBody:{contentType:'text',content:'확인 후 견적 안내드리겠습니다.'}});
  const moved=outlook.outlookMessage({boxId:'b',folder:{id:'drafts-sub',role:'drafts'},me:OWNER,item:sentItem(false)});
  assert.equal(moved.draft,false);assert.equal(moved.directionUncertain,true);
  assert.equal(inspectThread([request,moved]).repliedSinceRequest,true);
  const unsent=outlook.outlookMessage({boxId:'b',folder:{id:'drafts',role:'drafts'},me:OWNER,item:sentItem(true)});
  assert.equal(unsent.draft,true);assert.equal(inspectThread([request,unsent]).repliedSinceRequest,false);
  // 네이버도 \Draft 표시가 없는 임시 보관함 편지는 초안으로 보지 않는다.
  const raw=Buffer.from('From: '+ADDRESS+'\r\nTo: client@example.com\r\nSubject: RE: quote\r\nMessage-ID: <s9@mail.example.org>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n확인 후 견적 안내드리겠습니다.\r\n');
  const naverIn=flags=>naver.naverMessage({boxId:'box',folder:{raw:'Drafts',role:'drafts'},uidvalidity:1,uid:7,me:ADDRESS,
    record:{raw,size:raw.length,flags,internalDate:'21-Nov-2026 00:00:00 +0000'}});
  assert.equal(naverIn([]).draft,false);assert.equal(naverIn([]).possibleSelf,true);
  assert.equal(naverIn(['\\DRAFT']).draft,true);
});

test('네이버의 긴 첨부 메일은 서버가 확인한 본문과 파일 경계를 구분한다', () => {
  const head='From: Team <team@example.org>\r\nSubject: Quote\r\nContent-Type: multipart/mixed; boundary=parts\r\n\r\n';
  const body='30초 세로 제품 영상 3편 견적 부탁드립니다. 수정 2회.';
  const raw=Buffer.from(head+'--parts\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'+body+'\r\n--parts\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename=test.pdf\r\n\r\n'+'A'.repeat(90000)+'\r\n--parts--\r\n');
  const text=['TEXT','PLAIN',['CHARSET','UTF-8'],null,null,'8BIT',Buffer.byteLength(body),1];
  const file=['APPLICATION','PDF',null,null,null,'BASE64',90000,null,['ATTACHMENT',['FILENAME','test.pdf']]];
  const fromParts=children=>naver.naverMessage({boxId:'box',folder:{raw:'INBOX',role:'inbox'},uidvalidity:1,uid:1,me:'me@example.org',
    record:{raw:raw.subarray(0,naver.PREVIEW),size:raw.length,internalDate:'21-Nov-2026 00:00:00 +0000',structure:[...children,'MIXED']}});
  assert.equal(fromParts([text,file]).partialBody,false);
  assert.equal(fromParts([text,file]).hasAttachments,true);
  assert.equal(inspectThread([fromParts([text,file])]).quoteRequest.quantity,3);
  assert.equal(fromParts([text,file,text]).partialBody,true);
  assert.deepEqual(naver.decodeBytes(Buffer.from('1b2442467c4b5c1b2842','hex'),'iso-2022-jp'),{text:'日本',doubtful:false});
  function clippedMessage(encoding,bytes) {
    const raw=Buffer.concat([Buffer.from('From: me@example.org\r\nSubject: Mail\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: '+encoding+'\r\n\r\n'),bytes]);
    return naver.naverMessage({boxId:'box',folder:{raw:'Sent',role:'sent'},uidvalidity:1,uid:9,me:'me@example.org',
      record:{raw,size:raw.length+100,internalDate:'21-Nov-2026 00:00:00 +0000'}});
  }
  for(const clipped of [clippedMessage('8bit',Buffer.from('보낸 답장입니다. 한').subarray(0,-1)),
    clippedMessage('base64',Buffer.from(Buffer.from('보낸 답장입니다. 한글').toString('base64').slice(0,-5))),
    clippedMessage('quoted-printable',Buffer.from('Sent message =A'))]){
    assert.equal(clipped.partialBody,true);
    assert.ok(clipped.text);
    assert.ok(!clipped.unreadable);
    assert.equal(inspectThread([clipped]).status,'waiting');
  }
});

// ---------- 시험용 인코더 ----------

let eucTable = null;
function eucKr(text) {
  if (!eucTable) {
    eucTable = new Map();
    const decoder = new TextDecoder('euc-kr');
    for (let lead = 0x81; lead <= 0xfe; lead++) for (let trail = 0x41; trail <= 0xfe; trail++) {
      const ch = decoder.decode(Buffer.from([lead, trail]));
      if (ch.length === 1 && ch !== '\ufffd' && !eucTable.has(ch)) eucTable.set(ch, [lead, trail]);
    }
  }
  const out = [];
  for (const ch of text) {
    if (ch.charCodeAt(0) < 0x80) out.push(ch.charCodeAt(0));
    else { const pair = eucTable.get(ch); assert.ok(pair, '시험 글자 ' + ch); out.push(...pair); }
  }
  return Buffer.from(out);
}
const b64Word = (bytes, charset) => '=?' + charset + '?B?' + Buffer.from(bytes).toString('base64') + '?=';
const qpWord = text => '=?UTF-8?Q?' + [...Buffer.from(text, 'utf8')].map(b => b === 0x20 ? '_' : (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0')).join('') + '?=';
const qpBody = text => {
  const encoded = [...Buffer.from(text, 'utf8')].map(b => b === 0x0a ? '\r\n' : b >= 0x20 && b < 0x7f && b !== 0x3d ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0')).join('');
  return encoded.replace(/(.{60}[^=]{0,2})(?=.)/g, '$1=\r\n');
};
const wrap = s => s.replace(/(.{76})/g, '$1\r\n');
function mutf7(name) {
  return name.replace(/&/g, '&-').replace(/[^\x20-\x7e]+/g, run => {
    const bytes = Buffer.from(run, 'utf16le').swap16();
    return '&' + bytes.toString('base64').replace(/=+$/, '').replace(/\//g, ',') + '-';
  });
}
function mail(headers, body) {
  const head = Buffer.concat(headers.map(h => Buffer.concat([Buffer.isBuffer(h) ? h : Buffer.from(h, 'utf8'), Buffer.from('\r\n')])));
  return Buffer.concat([head, Buffer.from('\r\n'), Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')]);
}

// ---------- 가짜 네이버 IMAP 서버 ----------

function sampleMailbox() {
  const subject = eucKr('제품 영상 견적 문의');
  const body = eucKr('안녕하세요.\r\nS4 OK [READ-ONLY] 가짜 줄이 본문에 있어요.\r\n제품 영상 견적 부탁드립니다. 금요일까지 일정 알려주실 수 있을까요?\r\n');
  const question = mail([
    'From: =?UTF-8?B?' + Buffer.from('고객').toString('base64') + '?= <client@example.com>',
    'To: ' + ADDRESS, // 두 encoded-word가 한 글자의 바이트를 나눠 갖는다.
    'Subject: ' + b64Word(subject.subarray(0, 3), 'EUC-KR') + '\r\n ' + b64Word(subject.subarray(3), 'EUC-KR'),
    'Message-ID: <q1@example.com>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="ks_c_5601-1987"', 'Content-Transfer-Encoding: base64',
  ], wrap(body.toString('base64')));
  const followUp = mail([
    'From: client@example.com', 'To: ' + ADDRESS, 'Subject: ' + qpWord('추가 질문: 일정'),
    'Message-ID: <q2@example.com>', 'In-Reply-To: <s1@mail.example.org>', 'References: <q1@example.com> <s1@mail.example.org>',
    'Content-Type: multipart/alternative; boundary="b-1"',
  ], '--b-1\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n' +
    qpBody('답장 감사합니다. 납품 날짜를 다시 알려주실 수 있을까요?\n') +
    '\r\n--b-1\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n<p>html</p>\r\n--b-1--\r\n');
  const reply = mail([
    'From: ' + ADDRESS, 'To: client@example.com', 'Subject: RE: ' + qpWord('제품 영상 견적 문의'), 'Message-ID: <s1@mail.example.org>',
    'In-Reply-To: <q1@example.com>', 'References: <q1@example.com>', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit',
  ], Buffer.from('견적서는 내일 보내드리겠습니다.\r\n', 'utf8'));
  const selfInInbox = mail(['From: ' + ADDRESS, 'To: ' + ADDRESS, 'Subject: memo', 'Message-ID: <m1@mail.example.org>'], '자료 정리 부탁해요?\r\n');
  const rawHeader = mail([Buffer.from('Subject: 파일 다시 보내 주세요', 'utf8'), 'From: other@example.com', 'To: ' + ADDRESS,
    'Cc: team@example.com', 'Message-ID: <r1@example.com>', 'Content-Type: text/html; charset=euc-kr'],
  Buffer.concat([Buffer.from('<html><style>p{}</style><body><p>'), eucKr('지난 파일을 다시 보내 주실 수 있나요?'), Buffer.from('</p><img src="https://tracker.example/x.png"></body></html>')]));
  const big = mail(['From: client@example.com', 'To: ' + ADDRESS, 'Subject: big', 'Message-ID: <big@example.com>', 'Content-Type: multipart/mixed; boundary=zz'],
    '--zz\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nplease see attached\r\n--zz\r\nContent-Type: application/octet-stream; name="a.bin"\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
    wrap(Buffer.alloc(90000, 7).toString('base64')) + '\r\n--zz--\r\n');
  const draft = mail(['From: ' + ADDRESS, 'To: client@example.com', 'Subject: RE: draft', 'Message-ID: <d1@mail.example.org>', 'References: <q1@example.com>'], '초안입니다\r\n');
  const trash = mail(['From: spam@example.com', 'To: ' + ADDRESS, 'Subject: 견적 요청?', 'Message-ID: <t1@example.com>'], '견적 부탁해요?\r\n');
  return {
    user: USER, password: APP_PASSWORD,
    folders: [
      { raw: 'INBOX', attrs: ['\\HasNoChildren'], uidvalidity: 11, messages: [
        { uid: 1, raw: question, date: '01-Nov-2026 09:00:00 +0900' },
        { uid: 4, raw: followUp, date: '03-Nov-2026 09:00:00 +0900' },
        { uid: 7, raw: selfInInbox, date: '03-Nov-2026 10:00:00 +0900' },
        { uid: 8, raw: rawHeader, date: '04-Nov-2026 10:00:00 +0900' },
        { uid: 9, raw: big, date: '04-Nov-2026 11:00:00 +0900' },
        { uid: 12, raw: Buffer.from('broken message without header end'), date: '05-Nov-2026 11:00:00 +0900' },
      ] },
      { raw: '[Naver]', attrs: ['\\Noselect', '\\HasChildren'], uidvalidity: 1, messages: [] },
      { raw: mutf7('보낸메일함'), attrs: [], uidvalidity: 21, messages: [{ uid: 3, raw: reply, date: '02-Nov-2026 09:00:00 +0900' }] },
      { raw: mutf7('임시보관함'), attrs: [], uidvalidity: 31, messages: [{ uid: 2, raw: draft, flags: ['\\Draft'], date: '05-Nov-2026 09:00:00 +0900' }] },
      { raw: mutf7('휴지통'), attrs: [], uidvalidity: 41, messages: [{ uid: 5, raw: trash, date: '05-Nov-2026 09:00:00 +0900' }] },
    ],
  };
}

function fakeImap(model, { secure = true, chunk = 7, before } = {}) {
  const log = [];
  let connections = 0;
  const folderOf = raw => model.folders.find(f => f.raw === raw && !f.attrs.includes('\\Noselect'));
  const unquote = s => s.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1');
  async function connect({ host, port, servername }) {
    assert.equal(host, 'imap.naver.com'); assert.equal(port, 993); assert.equal(servername, 'imap.naver.com');
    connections++;
    const sock = new EventEmitter();
    sock.encrypted = secure; sock.authorized = secure; sock.getProtocol = () => secure ? 'TLSv1.3' : null; sock.destroyed = false;
    let pending = '';
    const send = data => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      for (let i = 0; i < buf.length; i += chunk) { const part = buf.subarray(i, i + chunk); setImmediate(() => { if (!sock.destroyed) sock.emit('data', part); }); }
    };
    sock.destroy = () => { if (sock.destroyed) return; sock.destroyed = true; setImmediate(() => sock.emit('close')); };
    sock.write = data => {
      pending += data;
      let at;
      while ((at = pending.indexOf('\r\n')) >= 0) { const line = pending.slice(0, at); pending = pending.slice(at + 2); handle(line); }
    };
    let selected = null;
    function handle(line) {
      log.push(line);
      const space = line.indexOf(' '), tag = line.slice(0, space), cmd = line.slice(space + 1);
      before?.({ cmd, model, sock });
      if (sock.destroyed) return;
      const done = (text = 'OK done') => send(tag + ' ' + text + '\r\n');
      if (cmd === 'CAPABILITY') { send('* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n'); return done(); }
      if (cmd.startsWith('LOGIN ')) {
        const [, user, pass] = /^LOGIN ("(?:[^"\\]|\\.)*") ("(?:[^"\\]|\\.)*")$/.exec(cmd) || [];
        return user && unquote(user) === model.user && unquote(pass) === model.password ? done() : done('NO [AUTHENTICATIONFAILED] Invalid ' + (pass || ''));
      }
      if (cmd === 'LIST "" "*"') {
        for (const f of model.folders) send('* LIST (' + f.attrs.join(' ') + ') "/" "' + f.raw + '"\r\n');
        return done();
      }
      if (cmd.startsWith('EXAMINE ')) {
        const f = folderOf(unquote(cmd.slice(8)));
        if (!f || f.fail) return done('NO cannot open');
        selected = f;
        const uidnext = Math.max(0, ...f.messages.map(m => m.uid), f.top || 0) + 1;
        send('* FLAGS (\\Seen \\Draft)\r\n* ' + f.messages.length + ' EXISTS\r\n* OK [UIDVALIDITY ' + f.uidvalidity + '] ok\r\n* OK [UIDNEXT ' + uidnext + '] next\r\n');
        return done('OK [READ-ONLY] EXAMINE done');
      }
      if (cmd.startsWith('UID SEARCH ')) {
        const m = /^UID SEARCH UID (\d+):(\d+)(?: UNDELETED)?$/.exec(cmd);
        const uids = selected.messages.filter(x=>!cmd.includes('UNDELETED') || !(x.flags||[]).some(flag=>flag.toUpperCase()==='\\DELETED'))
          .map(x => x.uid).filter(u => !m || (u >= Number(m[1]) && u <= Number(m[2])));
        send('* SEARCH' + uids.map(u => ' ' + u).join('') + '\r\n');
        return done();
      }
      if (cmd.startsWith('UID FETCH ')) {
        const m = /^UID FETCH ([\d,]+) \(UID FLAGS INTERNALDATE RFC822\.SIZE BODYSTRUCTURE BODY\.PEEK\[\]<0\.(\d+)>\)$/.exec(cmd);
        assert.ok(m, '예상한 조회 명령');
        const wanted = new Set(m[1].split(',').map(Number));
        selected.messages.forEach((msg, i) => {
          if (!wanted.has(msg.uid)) return;
          const part = msg.raw.subarray(0, Number(m[2]));
          send(Buffer.concat([Buffer.from('* ' + (i + 1) + ' FETCH (UID ' + msg.uid + ' FLAGS (' + (msg.flags || []).join(' ') + ') INTERNALDATE "' + msg.date + '" RFC822.SIZE ' + msg.raw.length + ' BODY[]<0> {' + part.length + '}\r\n'), part, Buffer.from(')\r\n')]));
        });
        return done();
      }
      if (cmd === 'LOGOUT') { send('* BYE bye\r\n'); done(); setImmediate(() => sock.destroy()); return; }
      done('BAD unknown');
    }
    setImmediate(() => send('* OK IMAP ready\r\n'));
    return sock;
  }
  return { connect, log, get connections() { return connections; } };
}

function staging() {
  const s = { staged: new Map(), published: null, commits: [], cursor: null, failAt: null };
  s.commit = async change => {
    if (s.failAt !== null && s.commits.length + 1 === s.failAt) { s.failAt = null; throw Object.assign(new Error('저장 실패 시험'), { code: 'DISK' }); }
    const copy = structuredClone(change);
    s.commits.push(copy);
    if (copy.reset) s.staged = new Map();
    for (const m of copy.messages || []) s.staged.set(m.id, m);
    for (const id of copy.removed || []) s.staged.delete(id);
    s.cursor = copy.cursor;
    if (copy.complete) s.published = new Map(s.staged);
  };
  return s;
}

const WRITE = /^(?:UID )?(?:STORE|COPY|MOVE|EXPUNGE|APPEND|SELECT|DELETE|CREATE|RENAME|SUBSCRIBE|UNSUBSCRIBE|CLOSE|UNSELECT|SETACL|IDLE|AUTHENTICATE|STARTTLS|ENABLE)\b/i;
const verbs = log => log.map(line => line.replace(/^\S+ /, ''));

// ---------- 네이버 시험 ----------

test('네이버: 한글 폴더와 제목을 풀고 보낸 편지, 초안, 휴지통을 폴더로 가른다. 쓰기 명령과 비밀번호 노출이 없다', async () => {
  const model = sampleMailbox(), server = fakeImap(model), store = staging(), seen = [];
  const box = { id: 'box-naver-1', label: ADDRESS, subject: ADDRESS };
  const coverage = await naver.scanNaver({ box, credential: { address: USER, password: APP_PASSWORD }, commit: store.commit, connect: server.connect, onCommand: v => seen.push(v), batch: 2 });

  assert.equal(store.commits[0].reset, true);
  assert.equal(store.commits.filter(c => c.complete).length, 1);
  assert.equal(store.commits.at(-1).complete, true);
  assert.ok(store.published);
  const all = [...store.published.values()], bySubject = s => all.find(m => m.subject === s);
  assert.equal(all.length, 9);

  const question = bySubject('제품 영상 견적 문의');
  assert.ok(question, '나뉜 EUC-KR 제목');
  assert.match(question.text, /제품 영상 견적 부탁드립니다/);
  assert.equal(question.outgoing, false);
  assert.equal(question.at, Date.UTC(2026, 10, 1, 0, 0, 0));
  const reply = bySubject('RE: 제품 영상 견적 문의');
  assert.equal(reply.outgoing, true, '보낸메일함 폴더');
  assert.equal(reply.threadId, question.threadId);
  const follow = bySubject('추가 질문: 일정');
  assert.equal(follow.threadId, question.threadId);
  assert.match(follow.text, /납품 날짜를 다시 알려주실 수 있을까요\?/);
  assert.equal(bySubject('RE: draft').draft, true);
  assert.equal(bySubject('견적 요청?').excluded, true);
  const memo = bySubject('memo');
  assert.equal(memo.outgoing, false, '보낸 사람 주소만으로 보낸 편지라 하지 않는다');
  const html = bySubject('파일 다시 보내 주세요');
  assert.equal(html.text, '지난 파일을 다시 보내 주실 수 있나요?');
  assert.equal(bySubject('big').text, 'please see attached');
  const broken = all.find(m => m.unreadable);
  assert.ok(broken && broken.text === '' && broken.uncertain);
  assert.equal(coverage.unreadable, 1);
  assert.equal(coverage.partial, true);
  assert.equal(coverage.folders, 4);

  // 대화 판정: 내 답장 뒤 고객 추가 질문 → 답장 필요, 초안이 그 뒤에 있으면 초안 상태
  const thread = all.filter(m => m.threadId === question.threadId);
  assert.equal(inspectThread(thread).status, 'draft');
  assert.equal(inspectThread(thread.filter(m => !m.draft)).status, 'reply');

  for (const line of verbs(server.log)) assert.doesNotMatch(line, WRITE);
  for (const line of server.log.filter(l => /UID FETCH/.test(l))) { assert.match(line, /BODY\.PEEK\[\]/); assert.doesNotMatch(line, /(?<!\.PEEK)BODY\[|RFC822(?!\.SIZE)/); }
  assert.deepEqual([...new Set(seen)].sort(), ['CAPABILITY', 'EXAMINE', 'LIST', 'LOGIN', 'LOGOUT', 'UID FETCH', 'UID SEARCH']);
  assert.doesNotMatch(JSON.stringify(store.commits), new RegExp(APP_PASSWORD));
  assert.doesNotMatch(seen.join(' '), new RegExp(APP_PASSWORD));

  // 보낸 편지함 밖의 읽지 못한 편지만 있으면 다시 검사해도 처음부터 읽지 않고 이어 간다(0.5.8 검수 c Fable).
  assert.equal(store.cursor.coverage.unreadableSent, 0);
  const credential = { address: ADDRESS, password: APP_PASSWORD };
  const again = staging();
  await naver.scanNaver({ box: { ...box, cursor: store.cursor }, credential, commit: again.commit, connect: fakeImap(sampleMailbox()).connect });
  assert.ok(again.commits.every(c => !c.reset));
  assert.equal(again.commits.at(-1).cursor.generation, store.cursor.generation);
  // 보낸 편지함에 읽지 못한 편지가 있으면 전처럼 처음부터 다시 읽고, 같은 편지는 같은 번호다.
  const brokenSent = () => { const m = sampleMailbox(); m.folders.find(f => f.uidvalidity === 21).messages.push({ uid: 4, raw: Buffer.from('broken message without header end'), date: '05-Nov-2026 12:00:00 +0900' }); return m; };
  const first = staging();
  await naver.scanNaver({ box, credential, commit: first.commit, connect: fakeImap(brokenSent()).connect });
  assert.equal(first.cursor.coverage.unreadableSent, 1);
  const retry = staging();
  await naver.scanNaver({ box: { ...box, cursor: first.cursor }, credential, commit: retry.commit, connect: fakeImap(brokenSent()).connect });
  assert.equal(retry.commits[0].reset, true);
  assert.equal(retry.commits[0].cursor.generation, first.cursor.generation + 1);
  assert.deepEqual([...retry.published.keys()].sort(), [...first.published.keys()].sort());
});

test('네이버: 로그인 실패와 암호화 확인 실패에 비밀번호가 드러나지 않는다', async () => {
  const model = sampleMailbox();
  const wrong = 'Wrong9Synthetic0';
  const error = await naver.verifyNaver({ address: ADDRESS, password: wrong, connect: fakeImap(model).connect }).catch(e => e);
  assert.equal(error.code, 'MAIL_AUTH');
  for (const text of [error.message, String(error.stack), JSON.stringify(error)]) { assert.ok(!text.includes(wrong)); assert.ok(!text.includes('Invalid')); }

  const plain = fakeImap(model, { secure: false });
  const tlsError = await naver.verifyNaver({ address: ADDRESS, password: APP_PASSWORD, connect: plain.connect }).catch(e => e);
  assert.equal(tlsError.code, 'MAIL_TLS');
  assert.equal(plain.log.length, 0, '암호화를 확인하기 전에는 아무 명령도 보내지 않는다');

  assert.deepEqual(await naver.verifyNaver({ address: USER, password: APP_PASSWORD, connect: fakeImap(model).connect }), { address: ADDRESS });
  await assert.rejects(naver.verifyNaver({ address: 'someone@example.org', password: APP_PASSWORD, connect: fakeImap(model).connect }), { code: 'VALUE' });
});

test('네이버: 중간에 멈추면 같은 세대에서 이어 읽고 앞 페이지를 지우지 않는다', async () => {
  const box = { id: 'box-naver-2', label: ADDRESS };
  const credential = { address: USER, password: APP_PASSWORD };
  const first = staging();
  first.failAt = 3; // reset과 첫 묶음을 저장한 뒤 둘째 묶음 저장에서 멈춘다
  await assert.rejects(naver.scanNaver({ box, credential, commit: first.commit, connect: fakeImap(sampleMailbox()).connect, batch: 2 }), { code: 'DISK' });
  assert.equal(first.published, null);
  const stopped = first.cursor;
  assert.equal(stopped.phase, 'scan');
  assert.equal(stopped.folders[0].last, 4);

  const server = fakeImap(sampleMailbox());
  await naver.scanNaver({ box: { ...box, cursor: stopped }, credential, commit: first.commit, connect: server.connect, batch: 2 });
  const resumed = first.commits.slice(2);
  assert.ok(resumed.every(c => !c.reset), '이어 읽을 때는 비우지 않는다');
  assert.equal(resumed.at(-1).cursor.generation, stopped.generation);
  assert.ok(server.log.some(l => / UID SEARCH UID 5:12 UNDELETED$/.test(l)), '마지막으로 저장한 번호 다음부터 읽는다');

  const full = staging();
  await naver.scanNaver({ box, credential, commit: full.commit, connect: fakeImap(sampleMailbox()).connect });
  assert.deepEqual([...first.published.keys()].sort(), [...full.published.keys()].sort());

  // 연결이 끊겨도 저장한 자리부터 다시 연결해 이어 간다.
  let drops = 0;
  const flaky = fakeImap(sampleMailbox(), { before: ({ cmd, sock }) => { if (cmd.startsWith('UID FETCH') && drops++ === 1) sock.destroy(); } });
  const net = staging();
  await naver.scanNaver({ box, credential, commit: net.commit, connect: flaky.connect, batch: 2 });
  assert.equal(flaky.connections, 2);
  assert.equal(net.commits.filter(c => c.reset).length, 1);
  assert.deepEqual([...net.published.keys()].sort(), [...full.published.keys()].sort());
});

test('네이버: 검사 중 UIDVALIDITY가 바뀌면 처음부터 다시 읽고, 계속 바뀌면 완료라고 하지 않는다', async () => {
  const box = { id: 'box-naver-3', label: ADDRESS };
  const credential = { address: USER, password: APP_PASSWORD };
  let changed = false;
  const once = fakeImap(sampleMailbox(), { before: ({ cmd, model }) => { if (!changed && cmd.startsWith('UID FETCH')) { changed = true; model.folders[0].uidvalidity = 99; } } });
  const store = staging();
  await naver.scanNaver({ box, credential, commit: store.commit, connect: once.connect, batch: 2 });
  const resets = store.commits.map((c, i) => c.reset ? i : -1).filter(i => i >= 0);
  assert.equal(resets.length, 2);
  assert.ok(store.commits.slice(0, resets[1]).every(c => !c.complete), '바뀌기 전 세대는 게시하지 않는다');
  assert.equal(store.cursor.folders.find(f => f.raw === 'INBOX').uidvalidity, 99);
  assert.ok([...store.published.values()].some(m => m.subject === '제품 영상 견적 문의'));

  const always = fakeImap(sampleMailbox(), { before: ({ cmd, model }) => { if (cmd.startsWith('EXAMINE "INBOX"')) model.folders[0].uidvalidity++; } });
  const unstable = staging();
  await assert.rejects(naver.scanNaver({ box, credential, commit: unstable.commit, connect: always.connect }), { code: 'MAIL_CHANGING' });
  assert.equal(unstable.published, null);
  assert.ok(unstable.commits.every(c => !c.complete));
});

test('네이버: 검사 중 새로 온 편지와 지운 편지를 마지막 확인에서 반영하고, 못 연 폴더가 있으면 끝내지 않는다', async () => {
  const box = { id: 'box-naver-4', label: ADDRESS };
  const credential = { address: USER, password: APP_PASSWORD };
  let step = 0;
  const server = fakeImap(sampleMailbox(), { before: ({ cmd, model }) => {
    if (cmd.startsWith('UID FETCH') && step++ === 1) {
      const inbox = model.folders[0];
      inbox.messages.shift(); // 이미 읽은 1번을 지운다
      inbox.messages.push({ uid: 20, raw: mail(['From: late@example.com', 'To: ' + ADDRESS, 'Subject: 늦게 온 문의', 'Message-ID: <late@example.com>'], '견적 가능할까요?\r\n'), date: '06-Nov-2026 09:00:00 +0900' });
    }
  } });
  const store = staging();
  await naver.scanNaver({ box, credential, commit: store.commit, connect: server.connect, batch: 2 });
  const subjects = [...store.published.values()].map(m => m.subject);
  assert.ok(subjects.includes('늦게 온 문의'));
  assert.ok(!subjects.includes('제품 영상 견적 문의'));
  assert.ok(store.commits.some(c => (c.removed || []).length === 1));

  const model = sampleMailbox();
  model.folders[2].fail = true;
  const failing = staging();
  await assert.rejects(naver.scanNaver({ box, credential, commit: failing.commit, connect: fakeImap(model).connect }), { code: 'MAIL_FOLDER' });
  assert.equal(failing.published, null);
  model.folders[2].fail = false;
  await naver.scanNaver({ box: { ...box, cursor: failing.cursor }, credential, commit: failing.commit, connect: fakeImap(model).connect });
  assert.ok(failing.published.size > 0);
  assert.equal(failing.commits.filter(c => c.reset).length, 1);
});

test('네이버: literal 바이트 수를 지켜 본문 속 줄을 명령 응답으로 오해하지 않는다', () => {
  const reader = naver.createReader();
  const payload = Buffer.from('* 1 FETCH (UID 3 BODY[]<0> {14}\r\nS1 OK fake\r\n::)\r\nS1 OK done\r\n');
  const responses = [];
  for (const byte of payload) { reader.push(Buffer.from([byte])); let r; while ((r = reader.next())) responses.push(r); }
  assert.equal(responses.length, 2);
  assert.equal(naver.tokenize(responses[0])[3][3].toString(), 'S1 OK fake\r\n::');
  assert.equal(responses[1].toString(), 'S1 OK done\r\n');
  assert.equal(naver.decodeFolder('&vPSwuLpUx3zVaA-'), '보낸메일함');
  assert.equal(naver.decodeFolder(mutf7('스팸메일함')), '스팸메일함');
  assert.equal(naver.decodeFolder('A&-B'), 'A&B');
  const big = naver.createReader(1024, 100);
  big.push(Buffer.from('* 1 FETCH (BODY[] {101}\r\n'));
  assert.throws(() => big.next(), { code: 'MAIL_LIMIT' });
});

// ---------- 가짜 Microsoft Graph ----------

const SUBJECT = '00000000-0000-0000-aaaa-000000000001';
const OWNER = 'owner@contoso.example';

function fakeGraph({ pageSize = 2, hook } = {}) {
  const folders = new Map(), wellKnown = {};
  const calls = [], accessCalls = [];
  const sessions = new Map();
  let sessionNo = 0;
  const addFolder = (id, parent = null, wk = null) => { folders.set(id, { id, parent, messages: [], log: [] }); if (wk) wellKnown[wk] = id; };
  addFolder('F-inbox', null, 'inbox'); addFolder('F-sent', null, 'sentitems'); addFolder('F-drafts', null, 'drafts');
  addFolder('F-deleted', null, 'deleteditems'); addFolder('F-junk', null, 'junkemail'); addFolder('F-archive', null, 'archive');
  addFolder('F-search', null, 'searchfolders'); addFolder('F-del-child', 'F-deleted'); addFolder('F-project', 'F-archive');
  const msg = (id, extra) => ({ id, conversationId: 'C-' + (extra.conv || id), subject: extra.subject || id, bodyPreview: extra.preview || '', isDraft: !!extra.draft,
    receivedDateTime: extra.at || '2026-11-01T00:00:00Z', sentDateTime: extra.at || '2026-11-01T00:00:00Z', lastModifiedDateTime: extra.at || '2026-11-01T00:00:00Z',
    from: { emailAddress: { address: extra.from || 'client@fabrikam.example' } }, toRecipients: [{ emailAddress: { address: extra.to || OWNER } }], ccRecipients: [],
    uniqueBody: extra.unique ? { contentType: 'text', content: extra.unique } : undefined, internetMessageHeaders: extra.headers || [] });
  const put = (folder, m) => {
    const f = folders.get(folder), item = { ...m, parentFolderId: folder };
    f.messages.push(item);
    f.log.push({ add: item });
  };
  const drop = (folder, id) => { const f = folders.get(folder); f.messages = f.messages.filter(m => m.id !== id); f.log.push({ remove: id }); };
  put('F-inbox', msg('M1', { conv: 'quote', subject: '견적 문의', preview: '영상 견적 부탁드립니다. 일정 알려주실 수 있을까요?', at: '2026-11-01T00:00:00Z' }));
  put('F-inbox', msg('M2', { conv: 'quote', subject: 'RE: 견적 문의', unique: '추가로 수정 범위도 알려주세요?', preview: 'ignored', at: '2026-11-03T00:00:00Z' }));
  put('F-inbox', msg('M3', { subject: 'Newsletter', preview: 'Read more?', headers: [{ name: 'List-Unsubscribe', value: '<mailto:x@news.example>' }] }));
  put('F-inbox', msg('M4', { subject: 'Out of office', preview: 'auto', headers: [{ name: 'Auto-Submitted', value: 'auto-replied' }] }));
  put('F-inbox', msg('M5', { subject: 'note to self', from: OWNER, preview: '정리해 주세요?' }));
  put('F-sent', msg('S1', { conv: 'quote', subject: 'RE: 견적 문의', from: OWNER, to: 'client@fabrikam.example', preview: '견적서를 내일 보내드리겠습니다.', at: '2026-11-02T00:00:00Z' }));
  put('F-drafts', msg('D1', { conv: 'quote', subject: 'RE: 견적 문의', from: OWNER, draft: true, at: '2026-11-04T00:00:00Z' }));
  put('F-deleted', msg('T1', { subject: '견적?', preview: '견적 부탁해요?' }));
  put('F-del-child', msg('T2', { subject: '견적2?', preview: '견적 부탁해요?' }));
  put('F-junk', msg('J1', { subject: 'win', preview: 'click?' }));
  put('F-project', msg('P1', { subject: '보관한 문의', preview: '파일 다시 보내 주실 수 있나요?' }));

  const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const folderItem = f => ({ id: f.id, displayName: 'x', parentFolderId: f.parent, childFolderCount: [...folders.values()].filter(c => c.parent === f.id).length });
  const listing = (items, url) => {
    const skip = Number(url.searchParams.get('$skip') || 0), page = items.slice(skip, skip + pageSize);
    const body = { value: page.map(folderItem) };
    if (skip + pageSize < items.length) { const next = new URL(url); next.searchParams.set('$skip', String(skip + pageSize)); body['@odata.nextLink'] = next.href; }
    return json(200, body);
  };
  async function fetcher(href, init) {
    const url = new URL(href);
    calls.push({ href, method: init.method, auth: init.headers.Authorization, prefer:init.headers.Prefer, host: url.hostname, body: init.body });
    assert.equal(url.hostname, 'graph.microsoft.com', '토큰은 Graph에만 간다');
    assert.equal(init.redirect, 'error');
    const hooked = hook?.({ url, calls, put, drop, json, folders });
    if (hooked) return hooked;
    const parts = url.pathname.replace(/\('([^']*)'\)/g, '/$1').split('/').slice(1).map(decodeURIComponent);
    if (parts.length === 2) return json(200, { id: SUBJECT, mail: OWNER, userPrincipalName: OWNER });
    if (parts.length === 3) return listing([...folders.values()].filter(f => !f.parent), url);
    const id = parts[3];
    if (parts.length === 4) { const real = wellKnown[id] || (folders.has(id) && id); return real ? json(200, { id: real }) : json(404, { error: { code: 'ErrorFolderNotFound' } }); }
    if (!folders.has(id)) return json(404, { error: { code: 'ErrorItemNotFound' } });
    const f = folders.get(id);
    if (parts[4] === 'childFolders') return listing([...folders.values()].filter(c => c.parent === id), url);
    if (parts[4] === 'messages' && parts[5] !== 'delta') {
      const current=f.messages.findLast(item=>item.id===parts[5]);
      return current ? json(200,current) : json(404,{error:{code:'ErrorItemNotFound'}});
    }
    const base = 'https://graph.microsoft.com/v1.0/me/mailFolders(\'' + id + '\')/messages/delta';
    const delta = url.searchParams.get('$deltatoken'), skip = url.searchParams.get('$skiptoken');
    if (delta) {
      const from = Number(delta.split('.')[1]);
      if (from < 0) return json(410, { error: { code: 'SyncStateNotFound' } });
      const value = f.log.slice(from).map(e => e.add || { id: e.remove, '@removed': { reason: 'deleted' } });
      return json(200, { value, '@odata.deltaLink': base + '?$deltatoken=' + id + '.' + f.log.length });
    }
    let session;
    if (skip) { session = sessions.get(skip.split('.')[0]); if (!session) return json(410, { error: { code: 'SyncStateNotFound' } }); }
    else { session = { id: 's' + (++sessionNo), snapshot: f.messages.slice(), mark: f.log.length }; sessions.set(session.id, session); }
    const offset = skip ? Number(skip.split('.')[1]) : 0, value = session.snapshot.slice(offset, offset + pageSize);
    const body = { value };
    if (offset + pageSize < session.snapshot.length) body['@odata.nextLink'] = base + '?$skiptoken=' + session.id + '.' + (offset + pageSize);
    else body['@odata.deltaLink'] = base + '?$deltatoken=' + id + '.' + session.mark;
    return json(200, body);
  }
  const access = async force => { accessCalls.push(force); return force ? 'synthetic-fresh-token' : 'synthetic-cached-token'; };
  return { fetcher, access, calls, accessCalls, folders, sessions, put, drop, msg };
}

const outlookBox = extra => ({ id: 'box-outlook-1', label: OWNER, subject: SUBJECT, ...extra });

test('Outlook 첫 검사와 재개에서 다음 페이지의 오래된 본문이 삭제한 문의를 되살리지 않는다',async()=>{
  for(const interrupt of [false,true]){
    const stale={id:'old',conversationId:'test',subject:'이미 삭제된 견적',uniqueBody:{contentType:'text',content:'영상 1편 견적 부탁드립니다.'}};
    const graph=fakeGraph({hook:({url,json})=>{
      if(!url.pathname.includes('F-inbox') || !url.pathname.endsWith('/delta'))return;
      const base=url.origin+url.pathname;
      if(url.searchParams.has('$deltatoken'))return json(200,{value:[],'@odata.deltaLink':base+'?$deltatoken=finished'});
      return url.searchParams.has('$skiptoken') ? json(200,{value:[stale],'@odata.deltaLink':base+'?$deltatoken=finished'})
        : json(200,{value:[{id:stale.id,'@removed':{reason:'deleted'}}],'@odata.nextLink':base+'?$skiptoken=next'});
    }});
    const store=staging();
    const run=box=>outlook.scanOutlook({box,access:graph.access,fetcher:graph.fetcher,commit:store.commit});
    if(interrupt){store.failAt=3;await assert.rejects(run(outlookBox()),{code:'DISK'});}
    await run(outlookBox({cursor:store.cursor}));
    assert.ok(store.published);assert.ok(![...store.published.values()].some(m=>m.subject===stale.subject));
    assert.ok(graph.calls.filter(c=>new URL(c.href).pathname.includes('/messages/old')).length>=2);
  }
  const alias='login@contoso.example',addr=address=>({emailAddress:{address}});
  const make=(to,cc)=>outlook.outlookMessage({boxId:'b',folder:{id:'inbox',role:'inbox'},me:OWNER,identities:[OWNER,alias],
    item:{id:'alias-message',receivedDateTime:'2026-11-20T00:00:00Z',toRecipients:to.map(addr),ccRecipients:cc.map(addr)}});
  assert.equal(make([],[alias]).copied,true);assert.equal(make([],[alias]).receivedByMember,true);
  assert.equal(make([alias],[OWNER]).copied,false);assert.equal(make([OWNER],[alias]).copied,false);
});

test('네이버 본문에 삽입한 그림의 조건은 확인한 뒤 견적을 정하고 HTML 줄바꿈은 보존한다',async()=>{
  const text='품목: 30초 세로 제품 영상<br style="font-family:Arial">수량: 3편<br class="line">수정: 1회';
  const raw=attrs=>Buffer.from('Subject: Quote\r\nContent-Type: multipart/related; boundary=img\r\n\r\n--img\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n'+
    text+'<img src="cid:order" '+attrs+'>\r\n--img\r\nContent-Type: image/png\r\nContent-ID: <order>\r\nContent-Disposition: inline\r\n\r\nPNG\r\n--img--\r\n');
  for(const [attrs,partial] of [['alt=""',true],['',true],['alt="" role="presentation"',false]]){
    const input=raw(attrs);
    const mail=naver.naverMessage({boxId:'b',folder:{raw:'INBOX',role:'inbox'},uidvalidity:4,uid:3,me:'qa@example.org',
      record:{raw:input,size:input.length,internalDate:'21-Nov-2026 00:00:00 +0000'}});
    const original=naver.findText(input,0,null,false,'',true);
    assert.equal(mail.partialBody,partial);assert.equal(original.partial,partial);
    assert.match(mail.text,/영상\n수량: 3편\n수정: 1회/u);assert.match(original.plain,/영상\n수량: 3편\n수정: 1회/u);
    const facts=require('../src/estimate-domain.cjs').compactMessage(mail).signals.quoteRequest;
    if(partial)assert.equal(facts,null);else {assert.equal(facts.quantity,3);assert.equal(facts.revisions,1);}
  }
  const inbox=sampleMailbox();
  inbox.folders[0].messages.find(m=>m.uid===4).raw=raw('alt=""');
  const imap=fakeImap(inbox);
  const picked=await naver.readOriginal({box:{subject:ADDRESS,credential:{address:ADDRESS,password:APP_PASSWORD}},
    ref:{folder:'INBOX',uidvalidity:11,uid:4},connect:imap.connect});
  assert.equal(picked.partial,true);assert.match(picked.text,/영상\n수량: 3편\n수정: 1회/u);
  assert.equal(imap.log.filter(s=>s.includes('UID FETCH')).length,1);
});

test('Outlook은 제목과 대화 번호가 없는 초안이 있어도 다른 메일을 끝까지 확인한다',async()=>{
  const graph=fakeGraph(), store=staging();
  graph.put('F-drafts',{...graph.msg('blank-draft',{draft:true}),subject:null,conversationId:null});
  await outlook.scanOutlook({box:outlookBox(),access:graph.access,fetcher:graph.fetcher,commit:store.commit,wait:async()=>{}});
  assert.ok([...store.published.values()].some(m=>m.draft && m.subject===''));
  assert.equal(store.commits.at(-1).complete,true);
});

test('Outlook: 여러 페이지의 모든 폴더를 읽고 보낸 편지, 초안, 휴지통, 스팸을 기본 폴더 번호로 가른다', async () => {
  const graph = fakeGraph(), store = staging();
  const coverage = await outlook.scanOutlook({ box: outlookBox(), access: graph.access, fetcher: graph.fetcher, commit: store.commit, wait: async () => {} });
  assert.equal(store.commits[0].reset, true);
  assert.equal(store.commits.at(-1).complete, true);
  assert.equal(store.commits.filter(c => c.complete).length, 1);
  const all = [...store.published.values()], find = s => all.filter(m => m.subject === s);
  assert.equal(all.length, 11);
  assert.equal(find('견적 문의')[0].outgoing, false);
  const sent = all.find(m => m.outgoing);
  assert.equal(sent.subject, 'RE: 견적 문의');
  assert.equal(all.filter(m => m.outgoing).length, 1);
  assert.equal(all.filter(m => m.draft).length, 1);
  assert.equal(all.filter(m => m.excluded).length, 3, '휴지통 하위 폴더와 스팸까지 제외');
  assert.equal(find('보관한 문의')[0].excluded, false);
  assert.equal(find('Newsletter')[0].bulk, true);
  assert.equal(find('Out of office')[0].automatic, true);
  const self = find('note to self')[0];
  assert.equal(self.outgoing, false);
  assert.ok(self.uncertain);
  assert.equal(all.find(m => m.text === '추가로 수정 범위도 알려주세요?').threadId, sent.threadId, 'uniqueBody를 우선한다');
  const thread = all.filter(m => m.threadId === sent.threadId);
  assert.equal(inspectThread(thread).status, 'draft');
  assert.equal(coverage.folders, 8);
  assert.equal(coverage.systemFoldersSkipped, 1);
  assert.match(coverage.label, /기본 사서함/);
  assert.match(coverage.label, /공유 사서함은 범위 밖/);
  assert.ok(graph.calls.every(c => c.method === 'GET' && c.body === undefined));
  const messagePages=graph.calls.filter(c=>new URL(c.href).pathname.endsWith('/messages/delta'));
  assert.ok(messagePages.length && messagePages.every(c=>c.prefer?.includes('outlook.body-content-type="html"')));
  assert.ok(graph.calls.every(c => c.href.startsWith('https://graph.microsoft.com/v1.0/me')));
  assert.ok(graph.calls.some(c => new URL(c.href).searchParams.get('$skip') === '2'), '폴더 목록 다음 페이지');
  assert.ok(graph.calls.some(c => c.href.includes('$skiptoken=')), '메일 다음 페이지');
});

test('메일함을 다시 열면 Outlook은 저장한 변경 위치, 네이버는 본문을 다시 받지 않고 UID부터 확인한다',async()=>{
  const graph=fakeGraph(), office=staging();
  const settings={box:outlookBox(),access:graph.access,fetcher:graph.fetcher,commit:office.commit,wait:async()=>{}};
  await outlook.scanOutlook(settings);
  const offset=graph.calls.length;
  await outlook.scanOutlook({...settings,box:{...settings.box,cursor:office.cursor}});
  const later=graph.calls.slice(offset).map(call=>new URL(call.href)).filter(url=>url.pathname.endsWith('/delta'));
  assert.ok(later.length>0);
  assert.ok(later.every(url=>url.searchParams.has('$deltatoken')));

  const model=sampleMailbox();
  for(const folder of model.folders)folder.messages=[];
  const server=fakeImap(model), local=staging();
  const nbox={id:'sample-naver-again',label:ADDRESS,subject:ADDRESS};
  const nsettings={box:nbox,credential:{address:USER,password:APP_PASSWORD},connect:server.connect,commit:local.commit};
  await naver.scanNaver(nsettings);
  const at=local.commits.length;
  await naver.scanNaver({...nsettings,box:{...nbox,cursor:local.cursor}});
  assert.equal(local.commits.slice(at).some(part=>part.reset),false);
  assert.equal(local.commits.at(-1).complete,true);
});

test('네이버는 긴 번호 목록과 Base64 본문의 마지막 글자까지 읽는다',async()=>{
  const payload=mail(['Subject: 영상','Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64'],Buffer.from('How much does it cost?').toString('base64'));
  const messages=Array.from({length:1500},(_,i)=>({uid:i+1,raw:payload,date:'05-Nov-2026 09:00:00 +0900'}));
  const model={user:USER,password:APP_PASSWORD,folders:[{raw:'INBOX',attrs:[],uidvalidity:13,messages}]},server=fakeImap(model,{chunk:65536}),store=staging();
  await naver.scanNaver({box:{id:'long-test',subject:ADDRESS},credential:{address:USER,password:APP_PASSWORD},connect:server.connect,commit:store.commit,batch:100});
  assert.equal(store.published.size,1500);
  assert.equal([...store.published.values()].at(-1).text,'How much does it cost?');
});
test('Gmail의 한국어 문자셋에서 요청을 읽고, 잘린 네이버 Base64는 확인이 필요하다고 알린다',()=>{
  const {fromThread}=require('../src/estimate-gmail.cjs');
  const decoded=fromThread({id:'box',label:ADDRESS},{id:'T',messages:[{id:'M',internalDate:'1',labelIds:[],snippet:'',
    payload:{mimeType:'text/plain',headers:[{name:'Content-Type',value:'text/plain; charset=euc-kr'},{name:'Subject',value:'디자인 건'}],
      body:{data:eucKr('견적서를 보내 주실 수 있을까요?').toString('base64url')}}}]});
  assert.equal(decoded.status,'reply');assert.match(decoded.evidence,/견적서/);
  const incomplete=mail(['Content-Type: text/plain','Content-Transfer-Encoding: base64'],'QnVkZ2V0P');
  assert.equal(naver.findText(incomplete).doubtful,true);
});

test('Gmail은 별도 글 본문만 읽고 실제 첨부와 읽지 못한 그림을 원문 확인의 근거로 쓰지 않는다', async () => {
  const { createGmailApi, gmailMessage, readOriginal } = require('../src/estimate-gmail.cjs');
  const text = '메일 잘 받았습니다.\n김새길 드림';
  const body = { size: Buffer.byteLength(text), data: Buffer.from(text).toString('base64url') };
  const partId = 'gmail_body_' + 'long_id_'.repeat(35);
  const plain = { mimeType: 'text/plain', body };
  const separate = { mimeType: 'text/plain', body: { size: body.size, attachmentId: partId } };
  const file = { ...separate, filename: '가격 안내.txt',
    headers: [{ name: 'Content-Disposition', value: 'attachment' }], body: { attachmentId: 'separate-file' } };
  const relatedImage = { mimeType: 'multipart/related', parts: [
    { mimeType: 'image/png', headers: [{ name: 'Content-ID', value: '<synthetic-photo@example.test>' }],
      body: { size: 7, attachmentId: 'image' } },
  ] };
  const context = { box: { label: ADDRESS }, ref: { id: 'selected' } };
  const original = { id: 'selected', internalDate: '1', labelIds: ['SENT'], snippet: text };
  let current, status = 200;
  const paths = [];
  const api = createGmailApi({ access: async () => 'synthetic-token', fetcher: async url => {
    paths.push(url.pathname);
    if (url.pathname.endsWith('/profile')) return Response.json({ emailAddress: ADDRESS });
    if (url.pathname.endsWith('/messages/selected')) return Response.json(current);
    assert.ok(url.pathname.endsWith('/messages/selected/attachments/' + partId));
    return Response.json(status === 200 ? body : {}, { status });
  } });
  const read = () => readOriginal({ ...context, api });
  current = { ...original, payload: { mimeType: 'multipart/mixed', parts: [separate, file] } };
  assert.deepEqual(await read(), { text, partial: false });
  assert.equal(paths.filter(value => value.includes('/attachments/')).length, 1);

  current = { ...original, payload: { mimeType: 'multipart/mixed', parts: [plain, relatedImage] } };
  assert.equal(gmailMessage(current).partialBody, true);
  assert.deepEqual(await read(), { text, partial: true });
  assert.equal(paths.filter(value => value.includes('/attachments/')).length, 1);

  status = 404;
  current = { ...original, payload: { mimeType: 'multipart/mixed', parts: [plain, separate] } };
  assert.deepEqual(await read(), { text, partial: true });
  current = { ...original, payload: separate };
  await assert.rejects(read(), { code: 'READ' });
});

test('Gmail은 다른 대체본문이 비었다고 확인된 경우에만 전체 원문으로 판정한다', async () => {
  const { gmailMessage, readOriginal } = require('../src/estimate-gmail.cjs');
  const html = '<p>영상 견적을 요청합니다.</p>';
  const alternative = { mimeType: 'text/html', body: { data: Buffer.from(html).toString('base64url') } };
  let current;
  const api = { profile: async () => ({ emailAddress: ADDRESS }), message: async () => current };
  const context = { box: { label: ADDRESS }, ref: { id: 'selected' }, api };
  for (const [emptyBody, partial] of [[{ size: 0 }, false], [{ size: 0, data: '' }, false],
    [{}, true], [{ size: 7 }, true], [{ size: 0, attachmentId: 'detached' }, true]]) {
    current = { id: context.ref.id, internalDate: '1', payload: { mimeType: 'multipart/alternative', parts: [
      { mimeType: 'text/plain', body: emptyBody }, alternative,
    ] } };
    assert.equal(gmailMessage(current).partialBody, partial);
    assert.deepEqual(await readOriginal(context), { text: '영상 견적을 요청합니다.', partial });
  }
});

test('Gmail 수집은 기존 상한을 지키고 이력 변경이 없는 다음 검사에서 누락된 본문만 다시 읽는다', async () => {
  const { scanGmail } = require('../src/estimate-gmail.cjs');
  const inquiry = '30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 2회를 원합니다.';
  const body = { size: Buffer.byteLength(inquiry), data: Buffer.from(inquiry).toString('base64url') };
  const partSizes = new Map([['readable', body.size], ['too-large', 200000], ['missing', body.size]]);
  const fetched = [];
  const openedThreads = [];
  const records = [];
  let cursor, partUnavailable = true;
  const api = {
    profile: async () => ({ emailAddress: ADDRESS, historyId: '11' }),
    threads: async () => ({ threads: [...partSizes.keys()].map(id => ({ id })) }),
    thread: async id => {
      openedThreads.push(id);
      return { id, messages: [{
        id, internalDate: '1', labelIds: ['INBOX'], snippet: '제품 영상 견적',
        payload: { mimeType: 'text/plain', headers: [{ name: 'Subject', value: '영상 견적' }],
          body: { size: partSizes.get(id), attachmentId: id + '-body' } },
      }] };
    },
    attachment: async (messageId, id) => {
      assert.equal(id, messageId + '-body');
      fetched.push(messageId);
      if (messageId === 'missing' && partUnavailable) throw Object.assign(new Error('missing part'), { httpStatus: 404 });
      return body;
    },
    history: async () => ({ historyId: '11' }),
  };
  const scan = () => scanGmail({ box: { id: 'box', label: ADDRESS, cursor }, api,
    commit: async part => {
      records.push(...part.records);
      cursor = JSON.parse(JSON.stringify(part.cursor));
    } });
  await scan();
  assert.deepEqual(fetched.sort(), ['missing', 'readable']);
  const byOriginal = new Map(records.map(({ value }) => [value?.originalRef?.id, value]));
  assert.equal(byOriginal.get('readable').quoteRequest.quantity, 3);
  for (const id of ['too-large', 'missing']) {
    assert.equal(byOriginal.get(id).reading.complete, false);
    assert.ok(!byOriginal.get(id).quoteRequest);
  }
  assert.deepEqual(cursor.pendingTextThreads, ['missing']);

  partUnavailable = false;
  fetched.length = 0;
  openedThreads.length = 0;
  await scan();
  assert.deepEqual(openedThreads, ['missing']);
  assert.deepEqual(fetched, ['missing']);
  assert.equal(records.at(-1).value.quoteRequest.quantity, 3);
  assert.deepEqual(cursor.pendingTextThreads, []);

  openedThreads.length = 0;
  await scan();
  assert.deepEqual(openedThreads, []);
});

test('Outlook은 변경 알림이 번호만 주면 원문을 읽고, 폴더를 옮겨도 확인 근거 번호를 유지한다',async()=>{
  let collapsed=false;
  const graph=fakeGraph({hook:({url,folders,json})=>{
    const delta=url.searchParams.get('$deltatoken');
    if(!collapsed&&delta&&url.pathname.includes('F-inbox')){
      collapsed=true;
      return json(200,{value:[{id:'M1',lastModifiedDateTime:'2026-11-20T00:00:00Z'}],'@odata.deltaLink':url.href});
    }
    if(url.pathname.endsWith('/messages/M1'))return json(200,folders.get('F-inbox').messages.find(x=>x.id==='M1'));
  }});
  const store=staging();
  await outlook.scanOutlook({box:outlookBox(),access:graph.access,fetcher:graph.fetcher,commit:store.commit,wait:async()=>{}});
  assert.equal(collapsed,true);
  assert.ok(graph.calls.some(c=>c.href.includes('/messages/M1?')));
  const item=graph.folders.get('F-inbox').messages.find(x=>x.id==='M1');
  const before=outlook.outlookMessage({boxId:'b',folder:{id:'first',role:'inbox'},item,me:OWNER});
  const after=outlook.outlookMessage({boxId:'b',folder:{id:'second',role:'normal'},item,me:OWNER});
  assert.equal(before.evidenceId,after.evidenceId);
});

test('Outlook: 다른 호스트나 다른 사용자로 가는 다음 주소에는 토큰을 보내지 않는다', async () => {
  for (const evil of ['https://graph.evil.example/v1.0/me/mailFolders/F-inbox/messages/delta?$skiptoken=x',
    'https://graph.microsoft.com.evil.example/v1.0/me/mailFolders/F-inbox/messages/delta?$skiptoken=x',
    'https://graph.microsoft.com/v1.0/users/victim/mailFolders/F-inbox/messages/delta?$skiptoken=x',
    'https://graph.microsoft.com/beta/me/mailFolders/F-inbox/messages/delta?$skiptoken=x',
    'https://graph.microsoft.com/v1.0/me/mailFolders/F-other/messages/delta?$skiptoken=x',
    'https://graph.microsoft.com/v1.0/me/mailFolders/F-inbox/messages/%2e%2e/delta?$skiptoken=x',
    'https://graph.microsoft.com/v1.0/me/mailFolders/F-inbox/messages/delta?$skiptoken=x&$expand=attachments',
    'http://graph.microsoft.com/v1.0/me/mailFolders/F-inbox/messages/delta?$skiptoken=x']) {
    const graph = fakeGraph({ hook: ({ url, json }) => url.pathname.endsWith('/delta') && url.pathname.includes('F-inbox') && !url.searchParams.has('$skiptoken')
      ? json(200, { value: [], '@odata.nextLink': evil }) : null });
    const store = staging();
    const error = await outlook.scanOutlook({ box: outlookBox(), access: graph.access, fetcher: graph.fetcher, commit: store.commit, wait: async () => {} }).catch(e => e);
    assert.equal(error.code, 'MAIL_LINK', evil);
    assert.ok(graph.calls.every(c => c.host === 'graph.microsoft.com' && !c.href.includes('victim') && !c.href.includes('F-other')), evil);
    assert.equal(store.published, null);
    assert.ok(!error.message.includes('synthetic'));
  }
  assert.equal(outlook.graphUrl("https://graph.microsoft.com/v1.0/me/mailfolders('F-inbox')/messages/delta?$deltatoken=a",
    ['v1.0', 'me', 'mailFolders', { id: 'F-inbox' }, 'messages', 'delta']).hostname, 'graph.microsoft.com');
});

test('Outlook: 제한 응답과 만료 토큰은 다시 시도하고, 다른 계정이면 멈춘다', async () => {
  let limited = 0, expiredOnce = 0;
  const waits = [];
  const graph = fakeGraph({ hook: ({ url, json }) => {
    if (url.pathname.includes('F-sent') && url.pathname.endsWith('/delta') && limited++ === 0) return json(429, { error: { code: 'TooManyRequests' } }, { 'retry-after': '2' });
    if (url.pathname.includes('F-junk') && url.pathname.endsWith('/delta') && expiredOnce++ === 0) return json(401, { error: { code: 'InvalidAuthenticationToken' } });
    return null;
  } });
  const store = staging();
  await outlook.scanOutlook({ box: outlookBox(), access: graph.access, fetcher: graph.fetcher, commit: store.commit, wait: async ms => { waits.push(ms); } });
  assert.deepEqual(waits, [2000]);
  assert.ok(graph.accessCalls.includes(true));
  assert.ok(graph.calls.some(c => c.auth === 'Bearer synthetic-fresh-token'));
  assert.ok(store.published);

  const other = fakeGraph();
  await assert.rejects(outlook.scanOutlook({ box: outlookBox({ subject: 'someone-else' }), access: other.access, fetcher: other.fetcher, commit: staging().commit }), { code: 'MAIL_AUTH' });
  assert.equal(other.calls.length, 1);
  assert.deepEqual(await outlook.outlookProfile({ access: other.access, fetcher: other.fetcher }), { address: OWNER, subject: SUBJECT });
});

test('Outlook: 저장 도중 멈추면 저장한 다음 주소부터 이어 읽고, 주소가 만료되면 새 세대로 다시 읽는다', async () => {
  const graph = fakeGraph(), store = staging();
  store.failAt = 3; // reset, 받은편지함 첫 페이지 다음
  await assert.rejects(outlook.scanOutlook({ box: outlookBox(), access: graph.access, fetcher: graph.fetcher, commit: store.commit, wait: async () => {} }), { code: 'DISK' });
  const stopped = store.cursor;
  assert.equal(stopped.phase, 'scan');
  assert.match(stopped.folders.find(f => f.id === 'F-inbox').link, /\$skiptoken=/);
  const before = graph.calls.length;
  await outlook.scanOutlook({ box: outlookBox({ cursor: stopped }), access: graph.access, fetcher: graph.fetcher, commit: store.commit, wait: async () => {} });
  assert.ok(store.commits.slice(2).every(c => !c.reset));
  const firstDelta = graph.calls.slice(before).find(c => c.href.includes('/delta'));
  assert.equal(firstDelta.href, stopped.folders.find(f => f.id === 'F-inbox').link);
  assert.equal(store.published.size, 11);

  // 다음 날 이어 읽으려니 저장한 주소가 만료됐다.
  const later = fakeGraph(), expired = staging();
  await outlook.scanOutlook({ box: outlookBox({ cursor: { ...structuredClone(stopped) } }), access: later.access, fetcher: later.fetcher, commit: expired.commit, wait: async () => {} });
  assert.equal(expired.commits[0].reset, true, '만료되면 이전 세대를 버리고 새로 시작');
  assert.equal(expired.commits[0].cursor.generation, stopped.generation + 1);
  assert.equal(expired.published.size, 11);
});

test('Outlook: 검사 중 도착하거나 지운 편지를 반영한 뒤에만 완료한다', async () => {
  let injected = false;
  const graph = fakeGraph({ hook: ({ url, put, drop }) => {
    if (!injected && url.pathname.includes('F-inbox') && url.searchParams.has('$skiptoken')) {
      injected = true;
      drop('F-inbox', 'M1');
      put('F-inbox', graph.msg('M9', { subject: '새 문의', preview: '견적 가능할까요?' }));
    }
    return null;
  } });
  const store = staging();
  await outlook.scanOutlook({ box: outlookBox(), access: graph.access, fetcher: graph.fetcher, commit: store.commit, wait: async () => {} });
  const subjects = [...store.published.values()].map(m => m.subject);
  assert.ok(subjects.includes('새 문의'));
  assert.ok(!subjects.includes('견적 문의'));
  assert.ok(store.commits.some(c => (c.removed || []).length === 1));

  // 메일함이 계속 바뀌면 완료라고 하지 않는다.
  let n = 0;
  const busy = fakeGraph({ hook: ({ url, put }) => {
    if (url.searchParams.has('$deltatoken') && url.pathname.includes('F-inbox')) put('F-inbox', busy.msg('N' + (++n), { subject: 'flood' }));
    return null;
  } });
  const unstable = staging();
  await assert.rejects(outlook.scanOutlook({ box: outlookBox(), access: busy.access, fetcher: busy.fetcher, commit: unstable.commit, wait: async () => {} }), { code: 'MAIL_CHANGING' });
  assert.equal(unstable.published, null);
  assert.equal(unstable.cursor.phase, 'verify');
});

test('네이버 자세히 보기는 선택한 메일 한 통을 읽기 전용으로 가져오고 메일함 번호 변경을 감지한다',async()=>{
  const model=sampleMailbox(),server=fakeImap(model);
  const box={id:'naver-original',subject:ADDRESS,credential:{address:ADDRESS,password:APP_PASSWORD}},ref={folder:'INBOX',uidvalidity:11,uid:1};
  const data=await naver.readOriginal({box,ref,connect:server.connect});
  assert.match(data.text,/금요일까지/);
  assert.equal(server.log.filter(line=>line.includes('UID FETCH')).length,1);
  assert.ok(server.log.some(line=>line.includes('UID FETCH 1 ')&&line.includes('BODY.PEEK')));
  await assert.rejects(naver.readOriginal({box,ref:{...ref,uidvalidity:31},connect:server.connect}),{code:'STALE'});
  await assert.rejects(naver.readOriginal({box,ref:{...ref,uid:999},connect:server.connect}),{code:'STALE'});
});

test('Outlook은 보낸 편지함으로 옮긴 고객 메일의 발신자를 유지하고 증분 응답의 마지막 상태를 적용한다',async()=>{
  const graph=fakeGraph(),store=staging();
  const msg=graph.msg('change',{from:'buyer@example.com',to:OWNER,unique:'영상 3편 견적 부탁드립니다.'});
  graph.put('F-sent',msg);
  await outlook.scanOutlook({box:outlookBox(),access:graph.access,fetcher:graph.fetcher,commit:store.commit});
  const get=()=>[...store.published.values()].filter(m=>m.subject==='change');
  assert.equal(get().length,1);assert.equal(get()[0].outgoing,false);
  graph.drop('F-sent','change');graph.put('F-inbox',msg);graph.drop('F-inbox','change');graph.put('F-inbox',msg);
  await outlook.scanOutlook({box:outlookBox({cursor:store.cursor}),access:graph.access,fetcher:graph.fetcher,commit:store.commit});
  assert.equal(get().length,1);assert.equal(get()[0].outgoing,false);assert.deepEqual(get()[0].originalRef,{id:'change',folderId:'F-inbox'});
  const inbox=graph.folders.get('F-inbox');
  inbox.log.push({add:msg},{remove:'change'});
  await outlook.scanOutlook({box:outlookBox({cursor:store.cursor}),access:graph.access,fetcher:graph.fetcher,commit:store.commit});
  assert.equal(get().length,1);
  graph.drop('F-inbox','change');inbox.log.push({add:msg});
  await outlook.scanOutlook({box:outlookBox({cursor:store.cursor}),access:graph.access,fetcher:graph.fetcher,commit:store.commit});
  assert.equal(get().length,0);
  const originalUrl=outlook.originalMessageUrl('https://outlook.office.com/owa/?ItemID=change&ignored=1');
  assert.equal(originalUrl,'https://outlook.office.com/owa/?ItemID=change&viewmodel=ReadMessageItem');
  assert.equal(outlook.originalMessageUrl('https://example.org/mail/inbox/id/change'),'');
  const used=[];
  const originalArgs={box:outlookBox(),ref:{id:'change',folderId:'inbox-folder'},access:graph.access,fetcher:async (href,options)=>{
    const u=new URL(href);used.push(u.pathname);if(u.pathname==='/v1.0/me/messages/change'){
      assert.match(options.headers.Prefer,/outlook\.body-content-type="html"/u);
      assert.ok(u.searchParams.get('$select').split(',').includes('parentFolderId'));
      return Response.json({id:'change',parentFolderId:'inbox-folder',body:{contentType:'html',content:'<p>선택한 문의</p><blockquote>인용한 원문</blockquote>'}});
    }
    return graph.fetcher(href,options);
  }};
  const view=await outlook.readOriginal(originalArgs);
  assert.match(view.text,/선택한 문의/);assert.match(view.text,/인용한 원문/);assert.deepEqual(used,['/v1.0/me','/v1.0/me/messages/change']);
  await assert.rejects(outlook.readOriginal({...originalArgs,ref:{id:'change',folderId:'previous-folder'}}),{code:'STALE'});
});

test('Gmail은 독립 mixed 본문을 순서대로 읽고 대체 표현과 첨부를 구별한다', async () => {
  const { gmailMessage, readOriginal } = require('../src/estimate-gmail.cjs');
  const commitment = '촬영 참고 자료는 내일 보내드리겠습니다.';
  const date = '납기는 12월 10일로 확정했습니다.';
  const body = (text, mimeType = 'text/plain') => ({
    mimeType, body: { data: Buffer.from(text).toString('base64url'), size: Buffer.byteLength(text) },
  });
  const multipart = (type, ...parts) => ({ mimeType: 'multipart/' + type, parts });
  const attached = { ...body('다른 고객과 100만원으로 확정했습니다.'), filename: '외부 계약.txt',
    headers: [{ name: 'Content-Disposition', value: 'attachment' }] };
  const equivalent = body('<p>' + date + '</p>', 'text/html');
  const appointment = multipart('alternative', body(date), equivalent);
  const item = { id: 'current', internalDate: '1', labelIds: ['SENT'] };
  const context = { box: { label: ADDRESS }, ref: { id: item.id },
    api: { profile: async () => ({ emailAddress: ADDRESS }), message: async () => item } };
  item.payload = multipart('mixed', body(commitment), appointment, attached);
  const result = gmailMessage(item);
  const text = commitment + '\n\n' + date;
  assert.equal(result.text, text);
  assert.equal(result.partialBody, false);
  assert.equal(result.hasAttachments, true);
  assert.deepEqual(await readOriginal(context), { text, partial: false });

  item.payload = multipart('mixed', body(commitment), multipart('alternative', body(date), body('금액은 아직 결정되지 않았습니다.')));
  assert.equal(gmailMessage(item).partialBody, true);
  const different = await readOriginal(context);
  assert.equal(different.partial, true);
  assert.match(different.text, /\[본문 2\]/u);

  const incomplete = body(date);
  incomplete.body.size += 1;
  item.payload = multipart('mixed', body(commitment), incomplete);
  assert.equal(gmailMessage(item).partialBody, true);
  assert.deepEqual(await readOriginal(context), { text, partial: true });
});

test('Gmail은 Googlemail 별칭을 같은 To·Cc 수신자로 확인하되 회사 주소를 합치지 않는다', () => {
  const { fromThread } = require('../src/estimate-gmail.cjs');
  const text = '30초 제품 영상 3편 견적을 부탁드립니다.';
  const classify = (label, to, cc) => fromThread({ id: 'googlemail-fixture', label }, { id: 'thread', messages: [{
    id: 'incoming', internalDate: '1', labelIds: ['INBOX'], payload: {
      mimeType: 'text/plain', body: { data: Buffer.from(text).toString('base64url'), size: Buffer.byteLength(text) },
      headers: [{ name: 'From', value: 'buyer@example.test' }, { name: 'Subject', value: '영상 견적' },
        { name: 'To', value: to }, { name: 'Cc', value: cc }],
    },
  }] });
  const copied = classify('studio.test@gmail.com', 'other@example.test', 'StudioTest+estimate@GOOGLEMAIL.COM'); // 공개허용: 로컬 시험이 만든 메일 주소 예시로 메일을 보내지 않는다.
  assert.equal(copied.status, 'review');
  assert.match(copied.reason, /참조로 받은 편지/u);
  const direct = classify('studio.test@googlemail.com', 'StudioTest+estimate@GMAIL.COM', 'studio.test@googlemail.com'); // 공개허용: 로컬 시험이 만든 메일 주소 예시로 메일을 보내지 않는다.
  assert.equal(direct.status, 'reply');
  assert.equal(classify('studio.test@example.test', 'other@example.test', 'studiotest+estimate@example.test').status, 'reply');
  assert.equal(classify('studio.test@example.test', 'other@example.test', 'studio.test@example.test').status, 'review');
});
