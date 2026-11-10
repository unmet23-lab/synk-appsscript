import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Store } from './store.mjs';
import { createAiMarketStore } from './ai-market-store.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'synk-ai-market-'));
  let stamp = '2026-11-10T01:00:00.000Z', store = new Store(directory);
  const now = () => stamp;
  let api = createAiMarketStore({ store, now });
  t.after(() => {
    store.close();
    // Only remove the exact temporary fixture created above.
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('synk-ai-market-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory, a: randomUUID(), b: randomUUID(), c: randomUUID(),
    get store() { return store; }, get api() { return api; },
    tick(value) { stamp = value; },
    reopen() { store.close(); store = new Store(directory); api = createAiMarketStore({ store, now }); },
  };
}
const profile = (api, id, displayName = '공개 닉네임') => api.saveProfile(id, { displayName, bio: '공개 소개', revision: 0 });
const seller = (api, id, extra = {}) => api.saveSeller(id, { headline: 'AI 영상 제작', description: '공개 판매자 소개', categories: ['content'], portfolioUrl: 'https://example.com/work', revision: 0, ...extra });
const postInput = (extra = {}) => ({ requestId: randomUUID(), kind: 'case', category: 'content', title: '제작 사례', body: '직접 만든 결과와 과정을 설명합니다.', ...extra });
const serviceInput = (extra = {}) => ({ requestId: randomUUID(), category: 'content', mode: 'commission', title: '광고 영상 제작', description: '상품 소개 영상 제작',
  deliverables: '15초 MP4 한 편', includes: '수정 한 번', excludes: '실사 촬영', priceText: '10만 원부터', contactUrl: 'https://example.com/contact', ...extra });
const commentInput = (extra = {}) => ({ requestId: randomUUID(), body: '제작 과정이 궁금합니다.', ...extra });
const rejects = (operation, code, status) => assert.throws(operation, error => error.code === code && (status === undefined || error.status === status));
function drain(read, limit = 2) {
  let cursor, result = [];
  do { const page = read({ cursor, limit }); result.push(...page.items); cursor = page.nextCursor; } while (cursor);
  return result;
}

test('new external members need a public profile and separate seller profile', t => {
  const { api, a, b } = fixture(t);
  assert.equal(api.getProfile(a), null);
  assert.equal(api.getSeller(a), null);
  rejects(() => api.createPost(a, postInput()), 'PROFILE_REQUIRED', 409);
  rejects(() => seller(api, a), 'PROFILE_REQUIRED', 409);
  rejects(() => api.createService(a, serviceInput()), 'PROFILE_REQUIRED', 409);
  const saved = profile(api, a, '하나');
  assert.deepEqual(Object.keys(saved).sort(), ['userId', 'displayName', 'bio', 'revision', 'createdAt', 'updatedAt'].sort());
  assert.equal(saved.revision, 1);
  const post = api.createPost(a, postInput());
  rejects(() => api.createComment(b, post.id, commentInput()), 'PROFILE_REQUIRED', 409);
  rejects(() => api.setBookmark(b, post.id, true), 'PROFILE_REQUIRED', 409);
  rejects(() => api.createService(a, serviceInput()), 'SELLER_REQUIRED', 409);
  seller(api, a);
  assert.equal(api.createService(a, serviceInput()).sellerId, a);
});

test('profile and seller first PUT use revision 0 and never accept another owner in the body', t => {
  const { api, a, b } = fixture(t);
  rejects(() => api.saveProfile(a, { displayName: '하나', revision: 1 }), 'REVISION_CONFLICT', 409);
  profile(api, a, '하나'); profile(api, b, '둘');
  rejects(() => profile(api, a, '다시'), 'REVISION_CONFLICT', 409);
  rejects(() => api.saveProfile(b, { userId: a, displayName: '가로채기', revision: 1 }), 'INVALID_INPUT', 400);
  api.saveProfile(b, { displayName: '둘 새 이름', bio: '', revision: 1 });
  assert.equal(api.getProfile(a).displayName, '하나');
  rejects(() => seller(api, a, { revision: 1 }), 'REVISION_CONFLICT', 409);
  seller(api, a);
  rejects(() => seller(api, a), 'REVISION_CONFLICT', 409);
  rejects(() => seller(api, b, { userId: a }), 'INVALID_INPUT', 400);
  assert.equal(api.getSeller(b), null);
});

test('post ownership, optimistic revision and soft deletion survive stale writes', t => {
  const f = fixture(t), { api, a, b } = f;
  profile(api, a); profile(api, b);
  const post = api.createPost(a, postInput());
  rejects(() => api.updatePost(b, post.id, { title: '타인 수정', revision: 1 }), 'FORBIDDEN', 403);
  rejects(() => api.deletePost(b, post.id, { revision: 1 }), 'FORBIDDEN', 403);
  f.tick('2026-11-10T02:00:00.000Z');
  const updated = api.updatePost(a, post.id, { title: '새 제목', revision: 1 });
  assert.equal(updated.revision, 2); assert.equal(updated.body, post.body); assert.equal(updated.createdAt, post.createdAt);
  assert.notEqual(updated.updatedAt, post.updatedAt);
  rejects(() => api.updatePost(a, post.id, { body: '낡은 탭', revision: 1 }), 'REVISION_CONFLICT', 409);
  rejects(() => api.deletePost(a, post.id, { revision: 1 }), 'REVISION_CONFLICT', 409);
  assert.equal(api.getPost(post.id).title, '새 제목');
  const deleted = api.deletePost(a, post.id, { revision: 2 });
  assert.equal(deleted.revision, 3); assert.equal(deleted.deleted, true);
  rejects(() => api.getPost(post.id), 'NOT_FOUND', 404);
  rejects(() => api.updatePost(a, post.id, { body: '되살리기', revision: 3 }), 'NOT_FOUND', 404);
  rejects(() => api.deletePost(a, post.id, { revision: 3 }), 'NOT_FOUND', 404);
  assert.deepEqual(api.listPosts().items, []);
});

test('comment authors own edits; deleting the parent closes every comment path', t => {
  const { api, a, b } = fixture(t); profile(api, a); profile(api, b);
  const post = api.createPost(a, postInput()), input = commentInput(), comment = api.createComment(b, post.id, input);
  assert.equal(comment.authorId, b); assert.equal(comment.postId, post.id);
  rejects(() => api.updateComment(a, comment.id, { body: '글 주인의 수정', revision: 1 }), 'FORBIDDEN', 403);
  rejects(() => api.deleteComment(a, comment.id, { revision: 1 }), 'FORBIDDEN', 403);
  const updated = api.updateComment(b, comment.id, { body: '새 댓글', revision: 1 });
  assert.equal(updated.revision, 2);
  rejects(() => api.deleteComment(b, comment.id, { revision: 1 }), 'REVISION_CONFLICT', 409);
  const own = api.createComment(a, post.id, commentInput());
  api.deleteComment(a, own.id, { revision: 1 });
  assert.deepEqual(api.listComments(post.id).items.map(row => row.id), [comment.id]);
  api.deletePost(a, post.id, { revision: 1 });
  rejects(() => api.listComments(post.id), 'NOT_FOUND', 404);
  rejects(() => api.createComment(b, post.id, commentInput()), 'NOT_FOUND', 404);
  rejects(() => api.createComment(b, post.id, input), 'NOT_FOUND', 404);
  rejects(() => api.updateComment(b, comment.id, { body: '숨긴 부모', revision: 2 }), 'NOT_FOUND', 404);
  rejects(() => api.deleteComment(b, comment.id, { revision: 2 }), 'NOT_FOUND', 404);
});

test('create retries use normalized payload and one durable receipt per owner and operation', t => {
  const f = fixture(t), { api, a, b } = f; profile(api, a); profile(api, b); seller(api, a);
  const requestId = randomUUID(), input = postInput({ requestId, title: '  Cafe\u0301  ', body: '첫 줄\r\n다음 줄 ' });
  const first = api.createPost(a, input);
  assert.equal(first.title, 'Café'); assert.equal(first.body, '첫 줄\n다음 줄');
  assert.deepEqual(api.createPost(a, { ...input, requestId: requestId.toUpperCase(), title: 'Café', body: '첫 줄\n다음 줄' }), first);
  rejects(() => api.createPost(a, { ...input, title: '바뀐 요청' }), 'REQUEST_CONFLICT', 409);
  const otherOwner = api.createPost(b, input); assert.notEqual(otherOwner.id, first.id);
  const comment = api.createComment(a, first.id, commentInput({ requestId }));
  assert.notEqual(comment.id, first.id);
  rejects(() => api.createComment(a, otherOwner.id, commentInput({ requestId })), 'REQUEST_CONFLICT', 409);
  const service = api.createService(a, serviceInput({ requestId }));
  assert.deepEqual(api.createService(a, serviceInput({ requestId })), service);
  rejects(() => api.createService(a, serviceInput({ requestId, priceText: '20만 원' })), 'REQUEST_CONFLICT', 409);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM ai_market_requests').get().n, 4);
  assert.equal(api.listPosts().items.length, 2);
  api.deletePost(a, first.id, { revision: 1 });
  rejects(() => api.createPost(a, input), 'NOT_FOUND', 404);
  assert.equal(api.listPosts().items.length, 1);
});

test('real SQLite reopen restores member content, private bookmarks and retry receipts', t => {
  const f = fixture(t), { a, b } = f;
  f.store.put('unrelatedCustomerData', 'preserve', { value: '기존 회사 자료' });
  profile(f.api, a, '하나'); profile(f.api, b, '둘'); seller(f.api, a);
  const input = postInput(), post = f.api.createPost(a, input), commentData = commentInput(), comment = f.api.createComment(b, post.id, commentData);
  const serviceData = serviceInput(), service = f.api.createService(a, serviceData);
  f.api.setBookmark(b, post.id, true); f.reopen();
  assert.equal(f.api.getProfile(a).displayName, '하나');
  assert.deepEqual(f.api.getPost(post.id), post);
  assert.deepEqual(f.api.listComments(post.id).items, [comment]);
  assert.deepEqual(f.api.getService(service.id), service);
  assert.equal(f.api.isBookmarked(b, post.id), true); assert.equal(f.api.isBookmarked(a, post.id), false);
  assert.deepEqual(f.api.listPosts({ savedUserId: b }).items, [post]);
  assert.deepEqual(f.api.listPosts({ savedUserId: a }).items, []);
  assert.deepEqual(f.api.createPost(a, input), post);
  assert.deepEqual(f.api.createComment(b, post.id, commentData), comment);
  assert.deepEqual(f.api.createService(a, serviceData), service);
  assert.deepEqual(f.store.get('unrelatedCustomerData', 'preserve'), { value: '기존 회사 자료' });
  assert.deepEqual(f.store.db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('bookmarks are private, idempotent and hide deleted posts', t => {
  const f = fixture(t), { api, a, b } = f; profile(api, a); profile(api, b);
  const post = api.createPost(a, postInput());
  api.setBookmark(a, post.id, true); api.setBookmark(a, post.id, true);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM ai_market_bookmarks').get().n, 1);
  api.setBookmark(b, post.id, false); assert.equal(api.isBookmarked(a, post.id), true);
  assert.deepEqual(api.listPosts({ savedUserId: b }).items, []);
  api.setBookmark(b, post.id, true); api.setBookmark(a, post.id, false);
  assert.equal(api.isBookmarked(b, post.id), true); assert.equal(api.isBookmarked(a, post.id), false);
  api.deletePost(a, post.id, { revision: 1 });
  assert.equal(api.isBookmarked(b, post.id), false); assert.deepEqual(api.listPosts({ savedUserId: b }).items, []);
  rejects(() => api.setBookmark(b, post.id, true), 'NOT_FOUND', 404);
  assert.deepEqual(api.setBookmark(b, post.id, false), { postId: post.id, saved: false });
  assert.deepEqual(api.setBookmark(b, post.id, false), { postId: post.id, saved: false });
});

test('stable cursor pagination works at equal timestamps and is bound to filters', t => {
  const { api, a, b } = fixture(t); profile(api, a); profile(api, b);
  const rows = Array.from({ length: 7 }, (_, index) => api.createPost(index < 5 ? a : b, postInput({ title: `글 ${index}`, category: index < 5 ? 'content' : 'education' })));
  const expected = [...rows].sort((left, right) => left.id < right.id ? 1 : -1);
  assert.deepEqual(drain(options => api.listPosts(options)).map(row => row.id), expected.map(row => row.id));
  assert.equal(api.listPosts({ category: 'content', authorId: a }).items.length, 5);
  assert.equal(api.listPosts({ category: 'education', authorId: a }).items.length, 0);
  const first = api.listPosts({ authorId: a, limit: 2 });
  rejects(() => api.listPosts({ authorId: b, limit: 2, cursor: first.nextCursor }), 'INVALID_INPUT', 400);
  rejects(() => api.listPosts({ limit: 51 }), 'INVALID_INPUT', 400);
  rejects(() => api.listPosts({ limit: '2 OR 1=1' }), 'INVALID_INPUT', 400);
  rejects(() => api.listPosts({ cursor: Buffer.from('{}').toString('base64url') }), 'INVALID_INPUT', 400);
  assert.equal(api.listPosts({ limit: '2' }).items.length, 2);
  assert.equal(api.listPosts({ kind: 'question' }).items.length, 0);
});

test('search treats SQL syntax and LIKE wildcards as literal text', t => {
  const { api, a } = fixture(t); profile(api, a);
  const symbols = ['100% 완성', 'under_score', 'C:\\work', "' OR 1=1 --", '일반 글'];
  const rows = symbols.map(title => api.createPost(a, postInput({ title })));
  for (const [index, q] of ['%', '_', '\\', "' OR 1=1 --"].entries()) assert.deepEqual(api.listPosts({ q }).items.map(row => row.id), [rows[index].id]);
  assert.deepEqual(api.listPosts({ q: "'; DROP TABLE ai_market_posts; --" }).items, []);
  assert.equal(api.listPosts().items.length, 5);
});

test('comments and services paginate independently with author-specific service ownership', t => {
  const { api, a, b } = fixture(t); profile(api, a, '하나'); profile(api, b, '둘'); seller(api, a); seller(api, b);
  const post = api.createPost(a, postInput()), other = api.createPost(a, postInput());
  for (let index = 0; index < 5; index++) api.createComment(b, post.id, commentInput({ body: `댓글 ${index}` }));
  assert.equal(drain(options => api.listComments(post.id, options)).length, 5);
  const commentPage = api.listComments(post.id, { limit: 2 });
  rejects(() => api.listComments(other.id, { cursor: commentPage.nextCursor }), 'INVALID_INPUT', 400);
  for (let index = 0; index < 5; index++) api.createService(a, serviceInput({ title: `영상 ${index}` }));
  api.createService(b, serviceInput({ title: '다른 판매자 강의', category: 'education', mode: 'learn' }));
  assert.equal(drain(options => api.listServices({ ...options, sellerId: a })).length, 5);
  assert.ok(api.listServices({ sellerId: a }).items.every(row => row.sellerId === a && row.seller.displayName === '하나'));
  assert.equal(api.listServices({ category: 'education', mode: 'learn', q: '강의' }).items[0].sellerId, b);
  const first = api.listServices({ sellerId: a, limit: 2 });
  rejects(() => api.listServices({ sellerId: b, cursor: first.nextCursor }), 'INVALID_INPUT', 400);
});

test('service edits and removal enforce owner/revision and reflect current public seller names', t => {
  const { api, a, b } = fixture(t); profile(api, a, '이전 닉네임'); profile(api, b); seller(api, a);
  const input = serviceInput(), service = api.createService(a, input);
  rejects(() => api.updateService(b, service.id, { priceText: '무료', revision: 1 }), 'FORBIDDEN', 403);
  rejects(() => api.deleteService(b, service.id, { revision: 1 }), 'FORBIDDEN', 403);
  const updated = api.updateService(a, service.id, { priceText: '12만 원부터', revision: 1 });
  assert.equal(updated.revision, 2); assert.equal(updated.description, service.description);
  rejects(() => api.updateService(a, service.id, { title: '낡은 내용', revision: 1 }), 'REVISION_CONFLICT', 409);
  api.saveProfile(a, { displayName: '새 닉네임', revision: 1 });
  seller(api, a, { headline: '새 공개 소개', revision: 1 });
  assert.deepEqual(api.getService(service.id).seller, { userId: a, displayName: '새 닉네임', headline: '새 공개 소개' });
  rejects(() => api.deleteService(a, service.id, { revision: 1 }), 'REVISION_CONFLICT', 409);
  api.deleteService(a, service.id, { revision: 2 });
  rejects(() => api.getService(service.id), 'NOT_FOUND', 404);
  rejects(() => api.updateService(a, service.id, { title: '부활', revision: 3 }), 'NOT_FOUND', 404);
  rejects(() => api.createService(a, input), 'NOT_FOUND', 404);
  assert.deepEqual(api.listServices().items, []);
});

test('field limits, fixed enums and HTTPS links are enforced before persistence', t => {
  const { api, a } = fixture(t); profile(api, a); seller(api, a);
  for (const contactUrl of ['http://example.com', 'javascript:alert(1)', 'https://name:secret@example.com/path', 'https://example.com/\npath', '']) {
    rejects(() => api.createService(a, serviceInput({ contactUrl })), 'INVALID_INPUT', 400);
  }
  rejects(() => seller(api, a, { portfolioUrl: 'https://user@example.com/', revision: 1 }), 'INVALID_INPUT', 400);
  rejects(() => api.createPost(a, postInput({ authorId: a })), 'INVALID_INPUT', 400);
  rejects(() => api.createPost(a, postInput({ requestId: 'missing-uuid' })), 'INVALID_INPUT', 400);
  rejects(() => api.createPost(a, postInput({ title: 'x'.repeat(121) })), 'INVALID_INPUT', 400);
  rejects(() => api.createPost(a, postInput({ body: 'x'.repeat(12001) })), 'INVALID_INPUT', 400);
  rejects(() => api.createPost(a, postInput({ category: 'anything' })), 'INVALID_INPUT', 400);
  rejects(() => api.createPost(a, postInput({ kind: 'html' })), 'INVALID_INPUT', 400);
  rejects(() => api.createService(a, serviceInput({ mode: 'payment' })), 'INVALID_INPUT', 400);
  const post = api.createPost(a, postInput({ body: '<script>alert(1)</script> 일반 텍스트' }));
  assert.equal(post.body, '<script>alert(1)</script> 일반 텍스트');
  rejects(() => api.createComment(a, post.id, commentInput({ body: 'x'.repeat(3001) })), 'INVALID_INPUT', 400);
  rejects(() => api.updatePost(a, post.id, { revision: -1, title: '제목' }), 'INVALID_INPUT', 400);
  rejects(() => api.updatePost(a, post.id, { revision: 1 }), 'INVALID_INPUT', 400);
  rejects(() => api.updatePost(a, post.id, { revision: 1, authorId: randomUUID() }), 'INVALID_INPUT', 400);
  assert.equal(api.listServices().items.length, 0);
});

test('content and idempotency receipt commit atomically when receipt persistence fails', t => {
  const f = fixture(t), { api, a } = f; profile(api, a);
  const input = postInput();
  f.store.db.exec("CREATE TEMP TRIGGER market_receipt_failure BEFORE INSERT ON ai_market_requests BEGIN SELECT RAISE(ABORT,'fixture receipt failure'); END");
  assert.throws(() => api.createPost(a, input), /fixture receipt failure/);
  assert.equal(api.listPosts().items.length, 0);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM ai_market_requests').get().n, 0);
  f.store.db.exec('DROP TRIGGER market_receipt_failure');
  const post = api.createPost(a, input);
  assert.deepEqual(api.createPost(a, input), post);
  assert.equal(api.listPosts().items.length, 1);
});

test('a second database connection sees revisions and retry receipts without process-local state', t => {
  const f = fixture(t), { api, a } = f; profile(api, a);
  const input = postInput(), post = api.createPost(a, input), peerStore = new Store(f.directory);
  try {
    const peer = createAiMarketStore({ store: peerStore });
    assert.deepEqual(peer.createPost(a, input), post);
    peer.updatePost(a, post.id, { title: '다른 연결의 수정', revision: 1 });
    rejects(() => api.updatePost(a, post.id, { body: '충돌', revision: 1 }), 'REVISION_CONFLICT', 409);
    assert.equal(api.getPost(post.id).title, '다른 연결의 수정');
  } finally { peerStore.close(); }
});
