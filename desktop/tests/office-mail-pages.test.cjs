'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { searchMailbox, sourceUrl } = require('../src/office-mail-api.cjs');

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const address = 'paged@example.test';
const plan = { terms: [], from: '', after: '', before: '', folder: 'inbox', provider: 'all', attachment: '' };
const baseTime = Date.UTC(2026, 10, 15, 12);
const idAt = i => (0x1000 + i).toString(16);
const stamp = i => new Date(baseTime - i * 60_000).toISOString();
const graphLink = id => 'https://outlook.office.com/mail/inbox/id/' + id;

function gmailFixture(count, { width = 11, sender = () => address } = {}) {
  const calls = [], ids = Array.from({ length: count }, (_, i) => idAt(i));
  async function fetch(raw, options) {
    const url = new URL(raw);
    assert.equal(url.origin, 'https://gmail.googleapis.com');
    assert.equal(options.redirect, 'error');
    const token = url.searchParams.get('pageToken');
    const id = url.pathname.split('/').at(-1);
    const kind = id === 'messages' ? 'list' : url.searchParams.get('format');
    calls.push({ kind, token, id, q: url.searchParams.get('q') });
    if (kind === 'list') {
      const offset = token ? Number(/^page:(\d+)\+\/=$/.exec(token)?.[1]) : 0;
      assert.ok(Number.isInteger(offset) && offset >= 0, 'opaque page token resumes the same query');
      const size = Math.min(width, Number(url.searchParams.get('maxResults')));
      const batch = ids.slice(offset, offset + size);
      return json({ messages: batch.map(id => ({ id })), ...(offset + batch.length < ids.length ? { nextPageToken: 'page:' + (offset + batch.length) + '+/=' } : {}) });
    }
    const i = ids.indexOf(id);
    assert.notEqual(i, -1);
    if (kind === 'metadata') return json({ id, payload: { headers: [{ name: 'From', value: sender(i) }, { name: 'Subject', value: id }] } });
    assert.equal(url.searchParams.get('fields'), 'id,internalDate,snippet');
    return json({ id, internalDate: String(Date.parse(stamp(i))), snippet: id });
  }
  return { calls, ids, fetch };
}
function message(id, i, extra = {}) {
  return { id, subject: id, receivedDateTime: stamp(i), sentDateTime: stamp(i), webLink: graphLink(id), ...extra };
}
function graphFixture(folders, width = 7) {
  const calls = [];
  async function fetch(raw, options) {
    const url = new URL(raw);
    assert.equal(url.origin, 'https://graph.microsoft.com');
    assert.equal(options.redirect, 'error');
    const folder = url.pathname.split('/').at(-2);
    const page = Number(url.searchParams.get('$skiptoken') || '0');
    calls.push({ folder, page, url: url.href, prefer: options.headers.Prefer });
    const rows = folders[folder];
    assert.ok(rows, 'search sticks to one of the original static folder paths');
    const value = rows.slice(page, page + width);
    return json({ value, ...(page + value.length < rows.length ? { '@odata.nextLink': url.origin + url.pathname + '?$skiptoken=' + (page + value.length) } : {}) });
  }
  return { calls, fetch };
}
const page = (provider, fetch, previousItems = [], cursor, filter = plan) =>
  searchMailbox({ provider, address, access: 'fixture', plan: filter, fetch, previousItems, cursor: cursor && structuredClone(cursor) });
async function collect(provider, fetch, filter, initial = []) {
  const items = [...initial], pages = [];
  let cursor;
  for (let i = 0; i < 50; i++) {
    const result = await page(provider, fetch, items, cursor, filter);
    assert.ok(result.items.length <= 10);
    assert.equal(result.code, undefined);
    items.push(...result.items);
    pages.push(result.items.length);
    if (!result.more) return { items, pages };
    assert.ok(result.cursor);
    cursor = result.cursor;
  }
  assert.fail('normal provider data must finish');
}

test('Gmail preserves the eleventh ID, reuses the opaque token and keeps loading past 100', async () => {
  const fixture = gmailFixture(125);
  const result = await collect('gmail', fixture.fetch, plan);
  assert.deepEqual(result.pages, [...Array(12).fill(10), 5]);
  assert.deepEqual(result.items.map(x => x.sourceId), fixture.ids);
  assert.equal(new Set(result.items.map(x => x.id)).size, 125);
  assert.ok(result.items.every(x => sourceUrl('gmail', address, x)?.endsWith('/' + x.sourceId)));
  const lists = fixture.calls.filter(c => c.kind === 'list');
  assert.equal(lists.filter(c => !c.token).length, 1);
  assert.equal(new Set(lists.map(c => c.q)).size, 1);
});

test('Gmail consumes a 204 on its advertised last page and settles a card with a saved eleventh mail', async () => {
  for (const recoverSavedError of [false, true]) {
    const fixture = gmailFixture(12);
    let continuationGets = 0;
    const fetch = (raw, options) => {
      const url = new URL(raw);
      if (url.pathname.endsWith('/messages') && url.searchParams.has('pageToken')) {
        continuationGets++;
        if (recoverSavedError && continuationGets === 1) return json({}, 503);
        return new Response(null, { status:204, headers:{'Content-Type':'application/json'} });
      }
      return fixture.fetch(raw, options);
    };
    let result = await page('gmail', fetch);
    const displayed = [...result.items];
    assert.equal(displayed.length, 10);
    assert.equal(result.more, true);
    result = await page('gmail', fetch, displayed, result.cursor);
    displayed.push(...result.items);
    assert.equal(displayed.length, 11);
    if (recoverSavedError) {
      assert.equal(result.code, 'MAIL_NETWORK');
      assert.equal(result.more, true);
      result = await page('gmail', fetch, displayed, result.cursor);
      assert.deepEqual(result.items, []);
    }
    assert.equal(result.more, false);
    assert.equal(result.code, undefined);
    assert.equal(result.cursor, undefined);
    assert.deepEqual(displayed.map(item => item.sourceId), fixture.ids.slice(0, 11));
    assert.equal(continuationGets, recoverSavedError ? 2 : 1);
  }
});

test('empty first lists, malformed 200 continuations and empty message projections stay errors', async () => {
  const empty = () => new Response(null, { status:204 });
  const malformed = () => new Response('not JSON', { status:200 });
  for (const response of [empty, malformed]) {
    await assert.rejects(page('gmail', response), { code:'MAIL_NETWORK' });
    for (const step of ['metadata', 'full']) {
      const fixture = gmailFixture(1);
      const result = await page('gmail', (raw, options) => new URL(raw).searchParams.get('format') === step ?
        response() : fixture.fetch(raw, options));
      assert.deepEqual(result.items, []);
      assert.equal(result.code, 'MAIL_NETWORK');
      assert.equal(result.more, true);
    }
  }
  const fixture = gmailFixture(12);
  const fetch = (raw, options) => new URL(raw).searchParams.has('pageToken') ? malformed() : fixture.fetch(raw, options);
  const first = await page('gmail', fetch);
  const partial = await page('gmail', fetch, first.items, first.cursor);
  assert.equal(partial.items.length, 1);
  assert.equal(partial.more, true);
  assert.equal(partial.code, 'MAIL_NETWORK');
  await assert.rejects(page('gmail', fetch, [...first.items, ...partial.items], partial.cursor), { code:'MAIL_NETWORK' });
});

test('Gmail advances through whole pages excluded by the exact sender without reading their excerpts', async () => {
  const fixture = gmailFixture(126, { width: 5, sender: i => i < 112 ? 'other@example.test' : address });
  const result = await collect('gmail', fixture.fetch, { ...plan, from: address });
  assert.deepEqual(result.items.map(x => x.sourceId), fixture.ids.slice(112));
  assert.deepEqual(fixture.calls.filter(c => c.kind === 'full').map(c => c.id), fixture.ids.slice(112));
});

test('a saved Gmail card without a cursor skips the stable keys before fetching details', async () => {
  const fixture = gmailFixture(18, { width: 5 });
  const saved = fixture.ids.slice(0, 10).map((sourceId, i) => ({ id: 'old-' + i, sourceId }));
  const result = await collect('gmail', fixture.fetch, plan, saved);
  assert.deepEqual(result.items.map(x => x.sourceId), fixture.ids);
  assert.deepEqual(fixture.calls.filter(c => c.kind === 'metadata').map(c => c.id), fixture.ids.slice(10));
});

test('Outlook merges the two folder streams across pages, preserves heads and deduplicates moved messages', async () => {
  const folders = { inbox: [], sentitems: [] };
  for (let i = 0; i < 37; i++) folders[i % 2 ? 'sentitems' : 'inbox'].push(message(idAt(i), i));
  folders.sentitems.splice(11, 0, message(idAt(8), 22, { webLink: 'https://outlook.office.com/mail/sentitems/id/moved' }));
  const fixture = graphFixture(folders);
  const result = await collect('outlook', fixture.fetch, { ...plan, folder: 'inbox_sent' });
  assert.deepEqual(result.pages, [10, 10, 10, 7]);
  assert.deepEqual(result.items.map(x => x.graphId), Array.from({ length: 37 }, (_, i) => idAt(i)));
  assert.ok(fixture.calls.every(call => /\bImmutableId\b/.test(call.prefer)));
  assert.ok(result.items.every(x => sourceUrl('outlook', address, x) === graphLink(x.graphId)));
});

test('a legacy Outlook card can resume using its stored original web links when no Graph ID was recorded', async () => {
  const rows = Array.from({ length: 26 }, (_, i) => message(idAt(i), i));
  const fixture = graphFixture({ inbox: rows }, 4);
  const saved = rows.slice(0, 10).map((m, i) => ({ id: 'old-' + i, webLink: m.webLink, subject: m.subject }));
  const result = await collect('outlook', fixture.fetch, plan, saved);
  assert.deepEqual(result.items.map(i => i.subject), rows.map(m => m.subject));
  assert.equal(new Set(result.items.map(i => i.id)).size, rows.length);
  let attempts = 0;
  await assert.rejects(page('outlook', async () => { attempts++; return json({ value: [] }); }, [{ id: 'ui-only', subject: 'unidentified' }]), { code: 'MAIL_PAGE_RESTART' });
  assert.equal(attempts, 0);
});

test('an empty filtered Outlook page still leads to the next page, including beyond one hundred matches', async () => {
  const rows = Array.from({ length: 175 }, (_, i) => message(idAt(i), i, {
    from: { emailAddress: { address: i < 57 ? 'other@example.test' : address } },
  }));
  const fixture = graphFixture({ inbox: rows }, 5);
  const result = await collect('outlook', fixture.fetch, { ...plan, from: address });
  assert.deepEqual(result.items.map(i => i.graphId), rows.slice(57).map(i => i.id));
  assert.ok(result.pages.some(n => n === 0), 'bounded read records real progress across fully filtered pages');
  assert.ok(fixture.calls.every(c => c.folder === 'inbox'));
});

test('a transient Gmail detail error leaves the missing ID available to the following request', async () => {
  const fixture = gmailFixture(19);
  let failOnce = true;
  const fetch = async (raw, init) => {
    const url = new URL(raw);
    if (failOnce && url.pathname.endsWith('/' + idAt(4)) && url.searchParams.get('format') === 'metadata') {
      failOnce = false;
      return json({}, 503);
    }
    return fixture.fetch(raw, init);
  };
  const first = await page('gmail', fetch);
  assert.equal(first.code, 'MAIL_NETWORK');
  assert.ok(first.cursor && first.more);
  let all = [...first.items], next = first;
  for (let k = 0; next.more && k < 10; k++) {
    next = await page('gmail', fetch, all, next.cursor);
    all.push(...next.items);
  }
  assert.equal(next.more, false);
  assert.deepEqual(all.map(x => x.sourceId).sort(), [...fixture.ids].sort());
});

test('a failed Graph folder can resume while the other folder retains its exact progress', async () => {
  const folders = { inbox: [], sentitems: [] };
  for (let i = 0; i < 25; i++) folders[i % 2 ? 'sentitems' : 'inbox'].push(message(idAt(i), i));
  const fixture = graphFixture(folders);
  let failOnce = true;
  const fetch = (raw, init) => {
    if (failOnce && new URL(raw).pathname.includes('/sentitems/')) {
      failOnce = false;
      return json({}, 503);
    }
    return fixture.fetch(raw, init);
  };
  const filter = { ...plan, folder: 'inbox_sent' };
  const first = await page('outlook', fetch, [], undefined, filter);
  assert.equal(first.code, 'MAIL_NETWORK');
  assert.ok(first.cursor && first.items.length);
  let all = [...first.items], next = first;
  for (let k = 0; next.more && k < 10; k++) {
    next = await page('outlook', fetch, all, next.cursor, filter);
    all.push(...next.items);
  }
  assert.equal(next.more, false);
  assert.deepEqual(all.map(x => x.graphId).sort(), Array.from({ length: 25 }, (_, i) => idAt(i)).sort());
});

test('an expired continuation rebuilds the original query once and keeps durable item identities', async () => {
  for (const provider of ['gmail', 'outlook']) {
    const fixture = provider === 'gmail' ? gmailFixture(35, { width: 5 }) :
      graphFixture({ inbox: Array.from({ length: 35 }, (_, i) => message(idAt(i), i)) }, 5);
    let invalidate = false, rejected = 0, recovered = 0;
    const fetch = async (raw, options) => {
      const url = new URL(raw);
      if (url.pathname.endsWith('/messages')) {
        const token = url.searchParams.get(provider === 'gmail' ? 'pageToken' : '$skiptoken');
        if (invalidate && token) {
          invalidate = false; rejected++;
          return json({ error: { code: 'InvalidPageToken' } }, 410);
        }
        if (rejected && !token) recovered++;
      }
      return fixture.fetch(raw, options);
    };
    let result = await page(provider, fetch);
    const items = [...result.items], firstIds = items.map(i => i.id);
    assert.ok(result.cursor && result.more);
    invalidate = true;
    for (let i = 0; result.more && i < 20; i++) {
      result = await page(provider, fetch, items, result.cursor);
      items.push(...result.items);
    }
    assert.equal(result.more, false, provider);
    assert.equal(rejected, 1);
    assert.ok(recovered >= 1);
    assert.deepEqual(items.slice(0, firstIds.length).map(i => i.id), firstIds);
    assert.deepEqual(items.map(i => i.subject), Array.from({ length: 35 }, (_, i) => idAt(i)), provider);
  }
});

test('a saved continuation never sends a request for another plan or a different account', async () => {
  const fixture = gmailFixture(25);
  const first = await page('gmail', fixture.fetch);
  assert.ok(first.cursor);
  for (const change of [{ address: 'different@example.test' }, { plan: { ...plan, folder: 'sent' } }, { provider: 'outlook' }]) {
    let read = 0;
    await assert.rejects(searchMailbox({ provider: 'gmail', address, plan, fetch: async () => { read++; return json({}); }, access: 'fixture',
      cursor: structuredClone(first.cursor), previousItems: first.items, ...change }), e => e.code === 'MAIL_CHANGED' || e.code === 'MAIL_PAGE_RESTART');
    assert.equal(read, 0);
  }
});

test('untrusted Graph continuations never replace the selected fields or the original folder query', async () => {
  const base = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages';
  const redirected = [
    'https://example.test/v1.0/me/mailFolders/inbox/messages?$skiptoken=one',
    '/v1.0/me/mailFolders/sentitems/messages?$skiptoken=one',
    base + '?$skiptoken=one&$expand=attachments',
    base + '?$skiptoken=one&$select=body',
    base + '?$skiptoken=one&$search=different',
    base + '?$skip=10',
  ];
  for (const next of redirected) {
    const calls = [];
    const fetch = async raw => {
      calls.push(String(raw));
      return json({ value: [message('one', 0)], '@odata.nextLink': next });
    };
    const first = await page('outlook', fetch, [], undefined, { ...plan, terms: ['견적'] });
    assert.equal(first.code, 'MAIL_NETWORK');
    assert.deepEqual(first.items.map(x => x.subject), ['one']);
    assert.equal(calls.length, 1, next);
  }
});

test('the same saved time ceiling excludes newer messages on both sides, including token recovery', async () => {
  const asOf = stamp(3);
  for (const provider of ['gmail', 'outlook']) {
    const fixture = provider === 'gmail' ? gmailFixture(27, { width: 5 }) :
      graphFixture({ inbox: Array.from({ length: 27 }, (_, i) => message(idAt(i), i)) }, 5);
    const items = [];
    let cursor, invalidate = false, resets = 0;
    const fetch = (raw, init) => {
      const u = new URL(raw);
      const marker = u.searchParams.get(provider === 'gmail' ? 'pageToken' : '$skiptoken');
      if (invalidate && u.pathname.endsWith('/messages') && marker) { invalidate = false; resets++; return json({}, 410); }
      if (!marker && u.pathname.endsWith('/messages')) {
        if (provider === 'gmail') assert.match(u.searchParams.get('q'), /before:\d+/);
        else assert.match(u.searchParams.get('$filter'), /receivedDateTime le /);
      }
      return fixture.fetch(raw, init);
    };
    for (let i = 0; i < 10; i++) {
      const result = await searchMailbox({ provider, address, access: 'fixture', plan, asOf, cursor, previousItems: items, fetch });
      items.push(...result.items);
      if (!result.more) break;
      cursor = result.cursor;
      if (!i) invalidate = true;
    }
    assert.equal(resets, 1);
    assert.deepEqual(items.map(x => x.subject), Array.from({ length: 24 }, (_, i) => idAt(i + 3)));
  }
});

test('Outlook orders a tied date by case-sensitive immutable ID across both folder page boundaries', async () => {
  const ids = ['m', 'z', 'a', 'c', 'B', 'd', 'x', 'k', 'p', 'Q', 'f', 'y', 's', 'v', 'w'];
  const both = { inbox: ids.slice(0, 8).map(id => message(id, 0)), sentitems: ids.slice(8).map(id => message(id, 0)) };
  const fixture = graphFixture(both, 2);
  const got = await collect('outlook', fixture.fetch, { ...plan, folder: 'inbox_sent' });
  assert.deepEqual(got.items.map(i => i.graphId), [...ids].sort());
});

test('a changed legacy Outlook original never borrows a different message with the same visible content', async () => {
  const rows = [message('new-key', 0, { subject: 'same subject' }), message('second', 1)];
  const fixture = graphFixture({ inbox: rows });
  await assert.rejects(page('outlook', fixture.fetch, [{ id: 'old', subject: 'same subject', webLink: graphLink('old-key') }]), { code: 'MAIL_PAGE_RESTART' });
  assert.equal(fixture.calls.length, 1);
});

test('a legacy link verified once keeps its immutable identity after the link changes on a later page', async () => {
  const rows = Array.from({ length: 30 }, (_, i) => message(idAt(i), i));
  rows.splice(22, 0, message(idAt(1), 22, { webLink: graphLink('moved-later') }));
  const saved = rows.slice(0, 10).map(row => ({ id: 'old-' + row.id, subject: row.subject, webLink: row.webLink }));
  const fixture = graphFixture({ inbox: rows }, 5);
  const got = await collect('outlook', fixture.fetch, plan, saved);
  assert.deepEqual(got.items.map(i => i.subject), Array.from({ length: 30 }, (_, i) => idAt(i)));
});

test('when one folder fails while loading more, older rows wait behind its unverified sort frontier', async () => {
  for (const status of [429, 503]) {
    const folders = { inbox: [], sentitems: [] };
    for (let i = 0; i < 42; i++) folders[i % 2 ? 'sentitems' : 'inbox'].push(message(idAt(i), i));
    const fixture = graphFixture(folders, 4);
    let armed = false, failures = 0;
    const fetch = (raw, init) => {
      if (armed && new URL(raw).pathname.includes('/sentitems/')) { armed = false; failures++; return json({}, status); }
      return fixture.fetch(raw, init);
    };
    const filter = { ...plan, folder: 'inbox_sent' };
    const first = await page('outlook', fetch, [], undefined, filter);
    const all = [...first.items];
    let next = first, code;
    armed = true;
    for (let k = 0; next.more && k < 12; k++) {
      next = await page('outlook', fetch, all, next.cursor, filter);
      if (next.code) code = next.code;
      all.push(...next.items);
    }
    assert.equal(failures, 1);
    assert.equal(code, status === 429 ? 'MAIL_LIMIT' : 'MAIL_NETWORK');
    assert.deepEqual(all.map(row => row.graphId), Array.from({ length: 42 }, (_, i) => idAt(i)));
  }
});

test('the eleventh root-folder candidate is classified on demand and an excluded folder never becomes visible', async () => {
  const calls = [], filter = { ...plan, folder: 'received' };
  const rows = Array.from({ length: 12 }, (_, i) => message(idAt(i), i, { parentFolderId: i < 10 ? 'archive' : i === 10 ? 'recycle-child' : 'later-inbox' }));
  const fetch = async raw => {
    const u = new URL(raw), key = decodeURIComponent(u.pathname.split('/').pop());
    calls.push(key);
    if (key === 'messages') return json({ value: rows });
    return json({ id: key, parentFolderId: key === 'recycle-child' ? 'deleteditems' : 'msgfolderroot' });
  };
  const first = await page('outlook', fetch, [], undefined, filter);
  assert.equal(first.items.length, 10);
  assert.equal(calls.includes('recycle-child'), false);
  assert.equal(calls.includes('later-inbox'), false);
  const second = await page('outlook', fetch, first.items, first.cursor, filter);
  assert.deepEqual(second.items.map(x => x.graphId), [idAt(11)]);
  assert.equal(second.more, false);
  assert.ok(calls.includes('recycle-child') && calls.includes('later-inbox'));
});

test('a numeric Graph offset is reconciled after a leading message moves out between card pages', async () => {
  const rows = Array.from({ length: 15 }, (_, i) => message(idAt(i), i)), calls = [];
  const fetch = raw => {
    const u = new URL(raw), offset = Number(u.searchParams.get('$skip') || 0);
    calls.push(offset);
    const value = rows.slice(offset, offset + 11);
    const next = new URL(u); next.searchParams.set('$skip', String(offset + value.length));
    return json({ value, ...(offset + value.length < rows.length ? { '@odata.nextLink': next.href } : {}) });
  };
  const first = await page('outlook', fetch);
  assert.equal(first.items.length, 10);
  rows.shift();
  const last = await page('outlook', fetch, first.items, first.cursor);
  assert.deepEqual(last.items.map(x => x.graphId), Array.from({ length: 5 }, (_, i) => idAt(i + 10)));
  assert.equal(last.more, false);
  assert.ok(calls.filter(x => x === 0).length >= 2);
});

test('legacy Outlook link verification after the fifty-fifth candidate resumes from its saved position', async () => {
  const rows = Array.from({ length: 81 }, (_, i) => message(idAt(i), i, { from: {emailAddress:{address:i < 55 ? 'unrelated@example.test' : address}} }));
  const fixture = graphFixture({ inbox: rows }, 11);
  const prior = rows.slice(55,65).map(m => ({ id: 'saved-'+m.id, webLink: m.webLink, subject: m.subject }));
  const all = await collect('outlook', fixture.fetch, { ...plan, from: address }, prior);
  assert.equal(all.pages[0], 0);
  assert.deepEqual(all.items.map(x => x.subject), rows.slice(55).map(m => m.subject));
});

test('a keyword union orders by the visible received or sent date, even when delayed delivery is on a later inbox page', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => message('in'+String(i).padStart(2,'0'), 2*i+1));
  const late = rows.at(-1);
  late.receivedDateTime = stamp(-5); // The server puts it last because it was sent much earlier.
  const sent = Array.from({ length: 6 }, (_,i)=>message('out'+i, 2*i+2));
  const fixture = graphFixture({inbox: rows,sentitems: sent}, 6);
  const got = await collect('outlook', fixture.fetch, {...plan,folder:'inbox_sent',terms:['견적']});
  const actual = got.items.map(x=>x.date);
  const expected = [...rows.map(x=>x.receivedDateTime), ...sent.map(x=>x.sentDateTime)].sort().reverse();
  assert.deepEqual(actual, expected);
  assert.equal(got.items[0].graphId, late.id);
});

test('one call orders 1000 keyword hits from short server pages and subsequent clicks consume that same scan', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => message(idAt(i), i, { subject: '견적 ' + i, bodyPreview: '긴 발췌 '.repeat(160) }));
  rows.at(-1).receivedDateTime = stamp(-1);
  const fixture = graphFixture({ inbox: rows, sentitems: [] }, 11);
  const filter = { ...plan, folder: 'inbox_sent', terms: ['견적'] };
  const first = await page('outlook', fixture.fetch, [], undefined, filter);
  assert.deepEqual(first.items.map(i => i.graphId), [idAt(999), ...Array.from({ length: 9 }, (_, i) => idAt(i))]);
  const calls = fixture.calls.length;
  let last = first;
  const all = [...first.items];
  for (let i = 0; i < 99; i++) {
    last = await page('outlook', fixture.fetch, all, last.cursor, filter);
    all.push(...last.items);
  }
  assert.equal(last.more, false);
  assert.equal(fixture.calls.length, calls);
  assert.deepEqual(all.map(i => i.graphId), [idAt(999), ...Array.from({ length: 999 }, (_, i) => idAt(i))]);
});

test('a classified folder that disappeared is consumed while a transient newer folder blocks older rows', async () => {
  for (const status of [404,503]) {
    const rows = Array.from({ length: 12 }, (_,i) => message(idAt(i),i, {parentFolderId:i < 10 ? 'known' : i === 10 ? 'unstable' : 'older'}));
    let recovering=false;
    const calls=[];
    const fetch=async raw=>{
      const path=new URL(raw).pathname,key=path.split('/').at(-1);calls.push(key);
      if(key==='messages')return json({value:rows});
      if(path.includes('/me/messages/')&&status===404)return json({},404);
      if(key==='unstable'&&!recovering)return json({},status);
      return json({id:key,parentFolderId:'msgfolderroot'});
    };
    const filter={...plan,folder:'received'};
    const first=await page('outlook',fetch,[],undefined,filter);
    const next=await page('outlook',fetch,first.items,first.cursor,filter);
    if(status===404){
      assert.deepEqual(next.items.map(i=>i.graphId),[idAt(11)]);
      assert.equal(next.more,false);
    }else{
      assert.equal(next.code,'MAIL_NETWORK');
      assert.equal(next.items.length,0);
      assert.equal(calls.includes('older'),false);
      recovering=true;
      const recovered=await page('outlook',fetch,first.items,next.cursor||first.cursor,filter);
      assert.deepEqual(recovered.items.map(i=>i.graphId),[idAt(10),idAt(11)]);
      assert.equal(recovered.more,false);
    }
  }
});

test('either spelling of a numeric offset is discarded if the verified page shifts during its GET', async () => {
  for(const key of ['$skip','skip','SKIP']){
    const rows=Array.from({length:15},(_,i)=>message(idAt(i),i));
    let shifted=false,changedAt=null;
    const fetch=raw=>{
      const u=new URL(raw),offset=Number(u.searchParams.get(key)||0);
      if(offset===11&&!shifted){shifted=true;changedAt=offset;rows.shift();}
      const value=rows.slice(offset,offset+11),next=new URL(u);
      next.searchParams.set(key,String(offset+value.length));
      return json({value,...(offset+value.length<rows.length?{'@odata.nextLink':next.href}:{})});
    };
    const first=await page('outlook',fetch);
    const last=await page('outlook',fetch,first.items,first.cursor);
    assert.equal(changedAt,11);
    assert.equal(last.more,false);
    assert.deepEqual(last.items.map(i=>i.graphId),Array.from({length:5},(_,i)=>idAt(i+10)),key);
  }
  for(const key of ['skip','SKIP','$Skip']){
    let calls=0;
    const result=await page('outlook',raw=>{calls++;return json({value:[message('seen',0)],'@odata.nextLink':'?'+key+'=10'});});
    assert.equal(calls,1,key);assert.equal(result.code,'MAIL_NETWORK');
  }
});

test('a received-time union retains the known newer inbound hit and the sent hit until an interrupted first scan recovers', async () => {
  const folders={inbox:[message('new-received',0,{sentDateTime:stamp(20)}),message('older',30)],sentitems:[message('sent',10)]};
  let failOnce=true;
  const data=graphFixture(folders,1);
  const fetch=(raw,init)=>{
    const u=new URL(raw);
    if(failOnce&&u.pathname.includes('/inbox/')&&u.searchParams.has('$skiptoken')){failOnce=false;return json({},503);}
    return data.fetch(raw,init);
  };
  const filter={...plan,folder:'inbox_sent',terms:['견적']};
  const first=await page('outlook',fetch,[],undefined,filter);
  assert.equal(first.items.length,0);
  assert.equal(first.code,'MAIL_NETWORK');assert.ok(first.more&&first.cursor);
  const restored=await page('outlook',fetch,[],first.cursor,filter);
  assert.deepEqual(restored.items.map(i=>i.graphId),['new-received','sent','older']);
});

test('an interrupted received-time scan retains a fully filtered first page before publishing the sent folder', async () => {
  const folders = {
    inbox: [message('draft', 0, { isDraft: true }), message('arrived-later', 1, { sentDateTime: stamp(20) })],
    sentitems: [message('sent', 10)]
  };
  const fixture = graphFixture(folders, 1);
  let failOnce = true;
  const fetch = (raw, options) => {
    const url = new URL(raw);
    if (failOnce && url.pathname.includes('/inbox/') && url.searchParams.has('$skiptoken')) {
      failOnce = false;
      return json({}, 503);
    }
    return fixture.fetch(raw, options);
  };
  const filter = { ...plan, folder: 'inbox_sent', terms: ['quotation'] };
  const partial = await page('outlook', fetch, [], undefined, filter);
  assert.deepEqual(partial.items, []);
  assert.equal(partial.code, 'MAIL_NETWORK');
  assert.ok(partial.cursor && partial.more);
  const finished = await page('outlook', fetch, [], partial.cursor, filter);
  assert.deepEqual(finished.items.map(item => item.graphId), ['arrived-later', 'sent']);
});

test('a slow received-date scan checkpoints its exact next URL and resumes without repeating any page', async t => {
  let now=Date.UTC(2026,10,22);
  t.mock.method(Date,'now',()=>now);
  const rows=Array.from({length:400},(_,i)=>message(idAt(i),i));
  rows.at(-1).receivedDateTime=stamp(-1);
  const fixture=graphFixture({inbox:rows,sentitems:[]},11),calls=[];
  const fetch=(raw,init)=>{
    if(new URL(raw).pathname.includes('/inbox/')){
      calls.push(String(raw));
      if(calls.length===30)now+=121_000;
    }
    return fixture.fetch(raw,init);
  };
  const filter={...plan,folder:'inbox_sent',terms:['견적']};
  const pending=await page('outlook',fetch,[],undefined,filter);
  assert.equal(calls.length,30);assert.equal(pending.items.length,0);assert.equal(pending.more,true);
  const next=pending.cursor.streams.inbox.next;
  const ready=await page('outlook',fetch,[],pending.cursor,filter);
  assert.equal(calls[30],next);assert.equal(new Set(calls).size,calls.length);
  assert.equal(ready.items[0].graphId,idAt(399));assert.equal(ready.items.length,10);
});

test('a vanished folder is resolved with the immutable message ID and only its present folder decides visibility', async () => {
  for (const destination of ['kept', 'deleted-child', 'missing', 'temporary', 'limited', 'offline', 'denied']) {
    const rows = Array.from({ length: 12 }, (_, i) => message(idAt(i), i, { parentFolderId: i === 10 ? 'former' : 'archive' }));
    let recovered = false;
    const messageReads = [];
    const fetch = (raw, options) => {
      const url = new URL(raw);
      const key = url.pathname.split('/').at(-1);
      if (key === 'messages') return json({ value: rows });
      if (url.pathname.includes('/me/messages/')) {
        assert.equal(key, idAt(10));
        assert.equal(url.search, '?$select=id,parentFolderId');
        assert.equal(options.method, 'GET');
        assert.equal(options.headers.Prefer, 'IdType="ImmutableId"');
        assert.equal(options.redirect, 'error');
        messageReads.push(key);
        if (destination === 'missing') return json({}, 404);
        const status = {temporary:503, limited:429, offline:401, denied:403}[destination];
        if (status && !recovered) return json({}, status);
        return json({ id: key, parentFolderId: destination });
      }
      if (key === 'former') return json({}, 404);
      return json({ id: key, parentFolderId: key === 'deleted-child' ? 'deleteditems' : 'msgfolderroot' });
    };
    const filter = { ...plan, folder: 'received' };
    const first = await page('outlook', fetch, [], undefined, filter);
    assert.equal(messageReads.length, 0);
    const loadNext = () => page('outlook', fetch, first.items, first.cursor, filter);
    let next;
    if (destination === 'offline' || destination === 'denied') {
      await assert.rejects(loadNext(), {code:destination === 'offline' ? 'MAIL_RECONNECT' : 'MAIL_SCOPE'});
      recovered = true;
      next = await loadNext();
    } else next = await loadNext();
    if (destination === 'temporary' || destination === 'limited') {
      assert.equal(next.code, destination === 'temporary' ? 'MAIL_NETWORK' : 'MAIL_LIMIT');
      assert.deepEqual(next.items, []);
      assert.ok(next.more);
      recovered = true;
      next = await page('outlook', fetch, first.items, next.cursor || first.cursor, filter);
    }
    const kept = !['missing', 'deleted-child'].includes(destination);
    assert.deepEqual(next.items.map(item => item.graphId), kept ? [idAt(10), idAt(11)] : [idAt(11)], destination);
    assert.equal(next.more, false);
    assert.deepEqual(messageReads, Array(recovered ? 2 : 1).fill(idAt(10)));
  }
});

test('replaying a changed numeric boundary discards unpublished rows that left only that stream', async () => {
  for (const dual of [false, true]) {
    const rows = Array.from({ length: 25 }, (_, i) => message(idAt(i), i));
    const sent = message('sent-kept', 16, { sentDateTime: stamp(15.5) });
    let moved = false, sentReads = 0;
    const fetch = raw => {
      const url = new URL(raw);
      if (url.pathname.includes('/sentitems/')) { sentReads++; return json({ value: [sent] }); }
      const offset = Number(url.searchParams.get('skip') || 0);
      if (offset && !moved) { rows.splice(14, 1); moved = true; }
      const value = rows.slice(offset, offset + 15);
      const next = new URL(url);
      next.searchParams.set('skip', String(offset + value.length));
      return json({ value, ...(offset + value.length < rows.length ? { '@odata.nextLink': next.href } : {}) });
    };
    const filter = { ...plan, folder: dual ? 'inbox_sent' : 'inbox', terms: dual ? ['quotation'] : [] };
    const all = await collect('outlook', fetch, filter);
    const expected = dual ? [...rows, sent].sort((a, b) => b.sentDateTime.localeCompare(a.sentDateTime)) : rows;
    assert.equal(moved, true);
    assert.equal(sentReads, dual ? 1 : 0);
    assert.deepEqual(all.items.map(item => item.graphId), expected.map(row => row.id));
  }
});

test('the changed numeric next URL of an unchanged predecessor prevents skipping an invisible slot', async () => {
  for (const key of ['$skip', 'skip']) {
    const rows = Array.from({ length: 16 }, (_, i) => message(idAt(i), i));
    let slots = 1, moved = false;
    const requests = [];
    const fetch = raw => {
      const url = new URL(raw);
      const offset = Number(url.searchParams.get(key) || 0);
      requests.push(offset);
      if (offset === 12 && !moved) { slots = 0; moved = true; }
      const start = offset ? offset - slots : 0;
      const value = rows.slice(start, start + 11);
      const next = new URL(url);
      next.searchParams.set(key, String(start + value.length + slots));
      return json({ value, ...(start + value.length < rows.length ? { '@odata.nextLink': next.href } : {}) });
    };
    const got = await collect('outlook', fetch, plan);
    assert.deepEqual(got.items.map(item => item.graphId), rows.map(row => row.id), key);
    assert.ok(requests.includes(12) && requests.includes(11));
  }
});

test('an empty numeric predecessor resumes at its saved offset and eventually finds matching messages', async () => {
  const requests = [];
  const fetch = raw => {
    const url = new URL(raw);
    const offset = Number(url.searchParams.get('skip') || 0);
    requests.push(offset);
    if (offset === 8) return json({ value: [message('after-empty', 1)] });
    const next = new URL(url);
    next.searchParams.set('skip', String(offset + 1));
    return json({ value: [], '@odata.nextLink': next.href });
  };
  const first = await page('outlook', fetch);
  assert.equal(first.items.length, 0);
  assert.ok(first.more && first.cursor);
  const priorRequests = requests.length;
  const second = await page('outlook', fetch, [], first.cursor);
  assert.deepEqual(second.items.map(item => item.graphId), ['after-empty']);
  assert.equal(second.more, false);
  assert.equal(requests.slice(priorRequests).includes(0), false);
});

test('unchanged offsets within a single timestamp preserve unique IDs, and a failed boundary check stays pending', async () => {
  const rows = Array.from({length:27}, (_, i) => message(idAt(i), 0));
  let failOnce = false;
  const fetch = raw => {
    const url = new URL(raw), offset = Number(url.searchParams.get('$skip') || 0);
    if (failOnce && offset === 0) { failOnce = false; return json({}, 503); }
    const value = rows.slice(offset, offset + 15);
    const next = new URL(url); next.searchParams.set('$skip', String(offset + value.length));
    return json({value, ...(offset + value.length < rows.length ? {'@odata.nextLink':next.href} : {})});
  };
  const first = await page('outlook', fetch);
  const published = structuredClone(first.items);
  failOnce = true;
  const blocked = await page('outlook', fetch, first.items, first.cursor);
  assert.deepEqual(blocked.items, []);
  assert.equal(blocked.code, 'MAIL_NETWORK');
  assert.equal(blocked.more, true);
  const second = await page('outlook', fetch, first.items, blocked.cursor || first.cursor);
  const third = await page('outlook', fetch, [...first.items, ...second.items], second.cursor);
  assert.deepEqual(first.items, published);
  assert.deepEqual([...first.items, ...second.items, ...third.items].map(i=>i.graphId), rows.map(r=>r.id));
  assert.equal(third.more, false);
});
