'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { authorize } = require('../src/estimate-auth.cjs');
const { createEstimateService } = require('../src/estimate-service.cjs');
const { openVault } = require('../src/estimate-store.cjs');
const {createGmailApi}=require('../src/estimate-gmail.cjs');

const protectedStorage = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(text), decryptString: bytes => bytes.toString() };
const owner = 'synthetic-member-estimate';

test('공급자 설정이 깨져도 네이버와 저장한 일감을 열고 Gmail 조회 제한은 연결 해제로 오인하지 않는다',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-estimate-config-'));
  const svc=createEstimateService({root,owner,safe:protectedStorage,isCurrent:()=>true,
    readConfig:async()=>{throw Object.assign(Error('example'),{code:'CONFIG'});}});
  t.after(()=>{svc.close();fs.rmSync(root,{recursive:true,force:true});});
  const snap=await svc.snapshot();
  assert.equal(snap.ok,true);assert.deepEqual(snap.data.capabilities.readyProviders,['naver']);
  const waits=[];let tries=0;
  const api=createGmailApi({access:()=> 'example',wait:async n=>waits.push(n),fetcher:async()=>++tries===1?
    Response.json({error:{errors:[{reason:'userRateLimitExceeded'}]}},{status:403}):Response.json({historyId:'11'})});
  assert.equal((await api.profile()).historyId,'11');assert.equal(waits.length,1);
});

test('두 OAuth 서비스는 임시 로컬 창에서 요청을 확인하고 읽기 권한과 PKCE로 토큰을 교환한다', async () => {
  for (const provider of ['gmail','outlook']) {
    let login;
    const result = await authorize({provider, client:{clientId:'sample-client',clientSecret:'example-only'},
      openExternal:async href=>{
        login = new URL(href);
        assert.equal(login.protocol,'https:');
        assert.equal(login.searchParams.get('code_challenge_method'),'S256');
        const redirect = new URL(login.searchParams.get('redirect_uri'));
        assert.equal(redirect.hostname,provider==='gmail'?'127.0.0.1':'localhost');
        redirect.search = new URLSearchParams({code:'test-only-code',state:'wrong-state'});
        assert.equal((await fetch(redirect)).status,400);
        redirect.searchParams.set('state',login.searchParams.get('state'));
        assert.equal((await fetch(redirect)).status,200);
      },
      fetcher:async(href,options)=>{
        assert.equal(options.redirect,'error');
        assert.equal(options.body.get('code'),'test-only-code');
        assert.equal(crypto.createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'),login.searchParams.get('code_challenge'));
        assert.match(login.searchParams.get('scope'),provider==='gmail'?/gmail\.readonly/:/Mail\.Read\b/);
        assert.doesNotMatch(login.searchParams.get('scope'),/Mail.Send|ReadWrite|gmail.modify/i);
        return Response.json({access_token:'sample-a',refresh_token:'sample-r',scope:login.searchParams.get('scope')});
      }});
    assert.equal(result.refresh,'sample-r');
  }
});

test('등록한 세 메일함을 각각 확인하고 한 서비스 실패와 한 계정의 읽지 못한 편지를 전체 완료로 표시하지 않는다',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(), 'synk-estimate-spec-'));
  const vault=openVault({root,owner,safe:protectedStorage});
  for(const provider of ['gmail','naver','outlook']) {
    vault.register({provider,label:provider+'@example.com',subject:provider,credential:{refresh:'sample'}});
  }
  vault.close();
  const seen=[];
  const ok=provider=>async({commit})=>{
    seen.push(provider);
    await commit({reset:true,cursor:{generation:1,phase:'scan'}});
    await commit({complete:true,cursor:{generation:1,phase:'done'},coverage:provider==='naver'?{partial:true,unreadable:2}:{label:'예시 메일함 전체'}});
  };
  let current=true;
  const service=createEstimateService({root,owner,safe:protectedStorage,isCurrent:()=>current,readConfig:async()=>({gmail:{},outlook:{}}),
    gmailScan:ok('gmail'),gmailApi:()=>({}),naver:{scanNaver:ok('naver')},
    outlook:{scanOutlook:async()=>{seen.push('outlook');throw Error('synthetic private content');}}});
  t.after(()=>{service.close();fs.rmSync(root,{recursive:true,force:true});});
  await service.opened();
  let snapshot;
  for(let i=0;i<50;i++){
    snapshot=(await service.snapshot()).data;
    if(snapshot.boxes.every(b=>b.phase!=='scanning'))break;
    await new Promise(resolve=>setTimeout(resolve,5));
  }
  assert.deepEqual(seen.sort(),['gmail','naver','outlook']);
  const box=Object.fromEntries(snapshot.boxes.map(b=>[b.provider,b]));
  assert.equal(box.gmail.phase,'complete');
  assert.equal(typeof box.gmail.completedAt,'number');
  assert.equal(box.naver.phase,'partial');
  assert.match(box.naver.detail,/2통/);
  assert.equal(box.naver.completedAt,undefined);
  assert.equal(box.outlook.phase,'partial');
  assert.doesNotMatch(box.outlook.detail,/synthetic private/);
  current=false;
  assert.equal((await service.action('more')).code,'AUTH_CHANGED');
});

test('연결 해제 뒤 늦게 돌아온 로그인은 같은 메일함을 되살리지 않는다',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-estimate-consent-'));
  const vault=openVault({root,owner,safe:protectedStorage}),address='studio@example.com';
  const id=vault.register({provider:'gmail',subject:address,label:address,credential:{refresh:'old-demo'}});vault.close();
  let complete,entered;
  const waiting=new Promise(resolve=>{entered=resolve;});
  const service=createEstimateService({root,owner,safe:protectedStorage,isCurrent:()=>true,readConfig:async()=>({gmail:{}}),
    oauth:()=>{entered();return new Promise(resolve=>{complete=resolve;});},gmailApi:()=>({profile:async()=>({emailAddress:address})}),gmailScan:()=>assert.fail('해제 뒤 검사')});
  t.after(()=>{service.close();fs.rmSync(root,{recursive:true,force:true});});
  const connecting=service.action('connect',{provider:'gmail'});
  await waiting;
  assert.equal((await service.action('disconnect',{id,confirm:true})).ok,true);
  complete({refresh:'new-demo',accessToken:'example'});
  assert.equal((await connecting).code,'CANCELLED');
  assert.deepEqual((await service.snapshot()).data.boxes,[]);
});

test('설정을 읽는 사이에 해제한 메일함은 먼저 시작한 연결 요청이 되살리지 않는다(0.5.8 검수 GPT-O)',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-estimate-consent-'));
  const address='studio@naver.com'; // 공개허용: 로컬 시험이 만든 메일 주소 예시로 메일을 보내지 않는다.
  const vault=openVault({root,owner,safe:protectedStorage});
  const id=vault.register({provider:'naver',subject:address,label:address,credential:{address,password:'old-demo'}});vault.close();
  let release;const pending=new Promise(resolve=>{release=resolve;});
  let reads=0;
  const service=createEstimateService({root,owner,safe:protectedStorage,isCurrent:()=>true,readConfig:()=>{reads++;return pending;},
    naver:{verifyNaver:async()=>({address}),scanNaver:()=>assert.fail('해제 뒤 검사')}});
  t.after(()=>{service.close();fs.rmSync(root,{recursive:true,force:true});});
  const connecting=service.action('connect',{provider:'naver',address,password:'new-demo'});
  while(!reads)await new Promise(resolve=>setImmediate(resolve));
  const disconnecting=service.action('disconnect',{id,confirm:true});
  release({});
  assert.equal((await disconnecting).ok,true);
  assert.equal((await connecting).code,'CANCELLED');
  assert.deepEqual((await service.snapshot()).data.boxes,[]);
});

function removeOutlookFixture(root) {
  const resolved = fs.realpathSync(root);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('synk-estimate-outlook-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}

function outlookMoveMailbox({ basic = false, proxyAddresses = [], proxyStatus = 0 } = {}) {
  const address = 'studio@contoso.example';
  const subject = '00000000-0000-0000-bbbb-000000000001';
  const folders = { inbox: 'F-inbox', sentitems: 'F-sent', drafts: 'F-drafts', deleteditems: 'F-deleted', archive: 'F-archive' };
  const events = new Map(Object.values(folders).map(id => [id, []]));
  const messages = new Map();
  const requests = [];
  const reply = '금요일까지 촬영 참고 자료를 보내드리겠습니다.';
  const original = '30초 세로 제품 영상 3편의 견적을 부탁드립니다. 자세한 문의는 시청각 행사입니다.';
  const addressOf = address => ({ emailAddress: { address } });
  function mail(id, parentFolderId, subject, content, outgoing = false) {
    const body = { contentType: 'text', content };
    return { id, parentFolderId, conversationId: 'C-' + id, subject, body, uniqueBody: body, bodyPreview: content,
      from: addressOf(outgoing ? address : 'buyer@example.test'),
      toRecipients: [addressOf(outgoing ? 'buyer@example.test' : address)],
      isDraft: false, receivedDateTime: '2026-11-01T00:00:00Z', sentDateTime: '2026-11-01T00:00:00Z' };
  }
  for (const message of [mail('M-inbound', folders.inbox, '이동할 문의', original),
    mail('M-sent', folders.sentitems, '이동할 발신 메일', reply, true),
    mail('M-kept', folders.inbox, '남겨둘 문의', '30초 제품 영상 1편 견적을 부탁드립니다.')]) {
    messages.set(message.id, message);
  }
  const notFound = () => Response.json({ error: { code: 'ErrorItemNotFound' } }, { status: 404 });
  function move(id, parentFolderId) {
    const previous = messages.get(id);
    const current = { ...previous, parentFolderId };
    messages.set(id, current);
    events.get(previous.parentFolderId).push({ id, '@removed': { reason: 'deleted' } });
    events.get(parentFolderId).push(current);
  }
  async function fetcher(href, options) {
    const url = new URL(href);
    assert.equal(url.origin, 'https://graph.microsoft.com');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    const [, me, scope, folder, resource, leaf] = url.pathname.slice(1).split('/').map(decodeURIComponent);
    assert.equal(me, 'me');
    if (!scope) {
      const aliasesRequested = url.searchParams.get('$select')?.split(',').includes('proxyAddresses');
      requests.push({ profile: true, aliasesRequested });
      if (aliasesRequested && proxyStatus) return Response.json({ error: { code: 'Request_BadRequest' } }, { status: proxyStatus });
      return Response.json({ id: subject, mail: address, userPrincipalName: address, ...(aliasesRequested ? { proxyAddresses } : {}) });
    }
    assert.ok(scope === 'mailFolders' || scope === 'messages', url.pathname);
    const fields = url.searchParams.get('$select')?.split(',') || [];
    const project = item => Object.fromEntries(Object.entries(item).filter(([key]) =>
      !fields.length || fields.includes(key) || key === 'id' || key === '@removed'));
    const track = { scope, folder, leaf, fields, deltaToken: url.searchParams.get('$deltatoken'), prefer: options.headers.Prefer };
    requests.push(track);
    if (scope === 'messages' || leaf && leaf !== 'delta') {
      // The immutable ID can still resolve a message after its parent folder has changed.
      const item = messages.get(scope === 'messages' ? folder : leaf);
      if (!item) return notFound();
      track.actualParent = item.parentFolderId;
      return Response.json(project(item));
    }
    if (!folder) return Response.json({ value: [...events.keys()].map(id => ({ id, childFolderCount: 0 })) });
    if (!resource) return folders[folder] ? Response.json({ id: folders[folder] }) : notFound();
    assert.equal(resource, 'messages');
    assert.equal(leaf, 'delta');
    assert.ok(events.has(folder));
    if (basic && fields.includes('uniqueBody')) {
      return Response.json({ error: { code: 'ErrorInvalidProperty' } }, { status: 400 });
    }
    const token = url.searchParams.get('$deltatoken');
    const entries = events.get(folder);
    const value = token === null ? [...messages.values()].filter(item => item.parentFolderId === folder) : entries.slice(Number(token));
    url.searchParams.set('$deltatoken', String(entries.length));
    return Response.json({ value: value.map(project), '@odata.deltaLink': url.href });
  }
  return { address, subject, folders, original, reply, requests, move, fetcher, mail,
    put: item => messages.set(item.id, item), access: async () => 'synthetic-outlook' };
}

test('Outlook은 옮긴 메시지의 이전 폴더를 지우고 같은 immutable id로 실제 원문을 연다', async t => {
  const { scanOutlook, readOriginal } = require('../src/estimate-outlook.cjs');
  for (const basic of [false, true]) {
    const graph = outlookMoveMailbox({ basic });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-estimate-outlook-move-'));
    const vault = openVault({ root, owner, safe: protectedStorage });
    t.after(() => { vault.close(); removeOutlookFixture(root); });
    const boxId = vault.register({ provider: 'outlook', subject: graph.subject, label: graph.address, credential: {} });
    const changes = [];
    const settings = { access: graph.access, fetcher: graph.fetcher, wait: async () => {} };
    const scan = () => scanOutlook({ ...settings, box: vault.boxById(boxId), commit: async part => {
      changes.push(structuredClone(part));
      vault.commit(boxId, part);
    } });
    await scan();
    const initial = changes.flatMap(part => part.messages || []);
    const inbox = initial.find(message => message.originalRef.id === 'M-inbound');
    const sent = initial.find(message => message.originalRef.id === 'M-sent');
    const kept = vault.snapshot({}).threads.find(thread => thread.subject === '남겨둘 문의');
    assert.equal(inbox.originalRef.folderId, graph.folders.inbox);
    assert.equal(sent.originalRef.folderId, graph.folders.sentitems);
    assert.equal(sent.outgoing, true);
    assert.ok(kept?.evidenceId);
    assert.deepEqual(await readOriginal({ ...settings, box: vault.boxById(boxId), ref: inbox.originalRef }),
      { text: graph.original, partial: false });
    assert.equal(vault.boxById(boxId).cursor.folders[0].select, basic ? 'basic' : 'full');
    changes.length = 0;
    graph.move('M-inbound', graph.folders.deleteditems);
    graph.move('M-sent', graph.folders.archive);
    await scan();
    const current = changes.flatMap(part => part.messages || []);
    const staleLookups = graph.requests.filter(r => r.actualParent && r.folder !== r.actualParent && r.scope === 'mailFolders');
    assert.equal(staleLookups.length, 2);
    assert.ok(staleLookups.every(r => r.prefer.includes('IdType="ImmutableId"')));
    assert.deepEqual(changes.flatMap(part => part.removed || []).sort(), [inbox.id, sent.id].sort());
    assert.ok(staleLookups.every(r => r.fields.includes('parentFolderId')));
    assert.ok(!current.some(message => [inbox.id, sent.id].includes(message.id)));
    const deleted = current.find(message => message.originalRef.id === 'M-inbound');
    const archived = current.find(message => message.originalRef.id === 'M-sent');
    assert.equal(deleted.originalRef.folderId, graph.folders.deleteditems);
    assert.equal(deleted.excluded, true);
    assert.equal(deleted.evidenceId, inbox.evidenceId);
    assert.equal(archived.originalRef.folderId, graph.folders.archive);
    assert.equal(archived.evidenceId, sent.evidenceId);
    assert.equal(vault.snapshot({}).threads.find(thread => thread.subject === '남겨둘 문의').evidenceId, kept.evidenceId);
    const open = ref => readOriginal({ ...settings, box: vault.boxById(boxId), ref });
    await assert.rejects(open(inbox.originalRef), { code: 'STALE' });
    await assert.rejects(open(sent.originalRef), { code: 'STALE' });
    assert.deepEqual(await open(deleted.originalRef), { text: graph.original, partial: false });
    assert.deepEqual(await open(archived.originalRef), { text: graph.reply, partial: false });
    assert.equal(changes.at(-1).complete, true);
  }
});

test('Outlook 구버전의 지난 폴더 위치는 기존 전체 갱신으로 한 번 정리한다', async t => {
  const { scanOutlook } = require('../src/estimate-outlook.cjs');
  const { EXCERPT_INDEX_VERSION } = require('../src/estimate-domain.cjs');
  const graph = outlookMoveMailbox();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-estimate-outlook-migration-'));
  const vault = openVault({ root, owner, safe: protectedStorage });
  let close = () => vault.close();
  t.after(() => { close(); removeOutlookFixture(root); });
  const boxId = vault.register({ provider: 'outlook', subject: graph.subject, label: graph.address, credential: {} });
  await scanOutlook({ box: vault.boxById(boxId), access: graph.access, fetcher: graph.fetcher, commit: part => vault.commit(boxId, part) });
  graph.move('M-inbound', graph.folders.deleteditems);
  const old = vault.snapshot({}).threads.find(thread => thread.subject === '이동할 문의');
  assert.equal(vault.originalTarget({ threadId: old.id, evidenceId: old.evidenceId }).ref.folderId, graph.folders.inbox);
  vault.updateBox(boxId, box => {
    box.excerptIndexVersion = 43;
    for (const f of box.cursor.folders) {
      if (f.id !== graph.folders.inbox && f.id !== graph.folders.deleteditems) continue;
      const delta = new URL(f.delta);
      delta.searchParams.set('$deltatoken', '1');
      f.delta = delta.href;
    }
  });
  vault.close();
  close = () => {};

  const service = createEstimateService({ root, owner, safe: protectedStorage, isCurrent: () => true,
    readConfig: async () => ({ outlook: {} }), fetcher: graph.fetcher,
    refresh: async () => ({ accessToken: 'synthetic-outlook', expiresAt: Date.now() + 60000 }) });
  close = () => service.close();
  const start = graph.requests.length;
  await service.opened();
  async function finishScan() {
    for (let i = 0; i < 100; i++) {
      const snapshot = (await service.snapshot()).data;
      if (snapshot.boxes[0].phase !== 'scanning') return snapshot;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('Outlook 검사 완료 대기');
  }
  const snapshot = await finishScan();
  assert.equal(snapshot.boxes[0].phase, 'complete');
  assert.equal(snapshot.threads.find(thread => thread.subject === '이동할 문의').status, 'excluded');
  assert.ok(snapshot.threads.find(thread => thread.subject === '남겨둘 문의').evidenceId);
  assert.ok(graph.requests.slice(start).some(r => r.leaf === 'delta' && r.deltaToken === null));
  const clean = openVault({ root, owner, safe: protectedStorage });
  try {
    const moved = snapshot.threads.find(thread => thread.subject === '이동할 문의');
    assert.equal(clean.boxById(boxId).excerptIndexVersion, EXCERPT_INDEX_VERSION);
    assert.equal(clean.originalTarget({ threadId: moved.id, evidenceId: moved.evidenceId }).ref.folderId, graph.folders.deleteditems);
  } finally {
    clean.close();
  }
  const next = graph.requests.length;
  assert.equal((await service.action('scan', { boxId })).ok, true);
  assert.equal((await finishScan()).boxes[0].phase, 'complete');
  const deltaChecks = graph.requests.slice(next).filter(r => r.leaf === 'delta');
  assert.ok(deltaChecks.length > 0 && deltaChecks.every(r => r.deltaToken !== null));
});

test('Outlook은 Graph 등록 SMTP 별칭 회신을 발신으로 보고 불명확한 보낸 편지를 보류한다', async t => {
  const { scanOutlook, readOriginal } = require('../src/estimate-outlook.cjs');
  const alias = 'quotes@contoso.example';
  const unknown = 'unverified@example.test';
  const shownSmtp = 'quotes-secondary@contoso.example';
  const exactPrice = '요청하신 제품 영상 3편의 부가세 포함 확정 견적은 726,000원입니다.';
  const addressOf = address => ({ emailAddress: { address } });
  for (const proxyStatus of [0, 400, 403]) {
    const graph = outlookMoveMailbox({ proxyStatus, proxyAddresses: [
      'SMTP:studio@contoso.example', 'smtp:Quotes@Contoso.Example', 'smtp:' + shownSmtp, 'SIP:' + unknown, 'smtp:not-mail', null,
    ] });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-estimate-outlook-alias-'));
    const vault = openVault({ root, owner, safe: protectedStorage });
    t.after(() => { vault.close(); removeOutlookFixture(root); });
    const boxId = vault.register({ provider: 'outlook', subject: graph.subject, label: graph.address, credential: {} });
    const buyer = addressOf('buyer@example.test');
    const member = addressOf(graph.address);
    const putReply = (id, from, sender, folder = graph.folders.sentitems) => {
      const message = graph.mail(id, folder, id === 'M-alias' ? 'RE: 이동할 문의' : id, exactPrice, true);
      graph.put({ ...message, from: addressOf(from), sender: addressOf(sender), toRecipients: [buyer], ccRecipients: [member],
        conversationId: id === 'M-alias' ? 'C-M-inbound' : 'C-' + id,
        sentDateTime: '2026-11-02T00:00:00Z', receivedDateTime: '2026-11-02T00:00:00Z' });
    };
    putReply('M-alias', alias, alias);
    putReply('M-inbox-alias', alias, alias, graph.folders.inbox);
    putReply('M-unverified', unknown, unknown);
    putReply('M-disagreement', graph.address, unknown);
    putReply('M-disagreement-from', unknown, graph.address);
    putReply('M-primary', graph.address, graph.address);
    putReply('M-secondary', shownSmtp, alias);
    const changes = [];
    const settings = { access: graph.access, fetcher: graph.fetcher };
    await scanOutlook({ ...settings, box: vault.boxById(boxId), commit: part => {
      changes.push(structuredClone(part));
      vault.commit(boxId, part);
    } });
    const byId = new Map(changes.flatMap(part => part.messages || []).map(item => [item.originalRef.id, item]));
    const confirmed = byId.get('M-alias');
    assert.deepEqual({
      outgoing: confirmed.outgoing, receivedByMember: confirmed.receivedByMember, directionUncertain: confirmed.directionUncertain,
    }, { outgoing: !proxyStatus, receivedByMember: true, directionUncertain: Boolean(proxyStatus) },
    'Graph SMTP alias must be verified only when the profile supplied that address');
    assert.equal(byId.get('M-secondary').outgoing, !proxyStatus);
    assert.equal(byId.get('M-primary').outgoing, true);
    assert.equal(byId.get('M-inbox-alias').outgoing, false);
    assert.equal(byId.get('M-inbox-alias').directionUncertain, !proxyStatus);
    for (const id of ['M-unverified', 'M-disagreement', 'M-disagreement-from']) {
      assert.equal(byId.get(id).receivedByMember, true);
      assert.equal(byId.get(id).outgoing, false);
      assert.equal(byId.get(id).directionUncertain, true);
    }
    const customer = vault.snapshot({}).threads.find(thread => thread.subject.includes('이동할 문의'));
    assert.ok(customer);
    assert.equal(Boolean(customer.sentQuoteReply), !proxyStatus);
    assert.equal(customer.status, proxyStatus ? 'review' : 'waiting');
    assert.equal(vault.boxById(boxId).phase, 'complete');
    const profileCalls = graph.requests.filter(request => request.profile);
    assert.deepEqual(profileCalls.map(request => request.aliasesRequested), proxyStatus ? [true,false] : [true]);
    const exact = await readOriginal({ ...settings, box: vault.boxById(boxId), ref: confirmed.originalRef });
    assert.deepEqual(exact, { text: exactPrice, partial: false });
    assert.equal(graph.requests.filter(request => request.profile).at(-1).aliasesRequested, false);
  }
});
