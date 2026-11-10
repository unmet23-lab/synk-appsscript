import { createHash, randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = ['content', 'education', 'automation', 'other'];
const KINDS = ['question', 'case', 'discussion'];
const MODES = ['learn', 'digital', 'commission'];
const own = (value, key) => Object.hasOwn(value, key);
const fail = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const invalid = message => fail('INVALID_INPUT', message);
const missing = () => fail('NOT_FOUND', '공개된 자료를 찾을 수 없어요.', 404);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function identifier(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw invalid('자료의 식별자를 확인해 주세요.');
  return value.toLowerCase();
}
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw invalid('저장할 항목의 형식을 확인해 주세요.');
  return value;
}
function text(value, label, max, { optional = false, single = false } = {}) {
  if (value === undefined && optional) return '';
  if (typeof value !== 'string' || value.length > max * 2 + 100) throw invalid(`${label} 입력을 확인해 주세요.`);
  const result = value.replace(/\r\n?/g, '\n').normalize('NFC').trim();
  if ((!optional && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result) || single && /[\n\t]/u.test(result)) throw invalid(`${label}은 ${max}자 이내로 입력해 주세요.`);
  return result;
}
function choice(value, allowed, label) {
  if (!allowed.includes(value)) throw invalid(`${label}을 선택해 주세요.`);
  return value;
}
function link(value, optional = false) {
  const raw = text(value, '링크', 2048, { optional, single: true });
  if (!raw && optional) return '';
  let url;
  try { url = new URL(raw); } catch { throw invalid('올바른 HTTPS 링크를 입력해 주세요.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.href.length > 2048) throw invalid('계정 정보가 들어 있지 않은 HTTPS 링크만 사용할 수 있어요.');
  return url.href;
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw invalid('저장 버전을 확인해 주세요.');
  return value;
}
function nextRevision(current, expected) {
  if (revision(expected) !== current) throw fail('REVISION_CONFLICT', '다른 곳에서 수정됐어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.', 409);
  if (current >= Number.MAX_SAFE_INTEGER) throw fail('REVISION_LIMIT', '저장 버전을 확인해야 해요.', 503);
  return current + 1;
}
const postFields = {
  kind: value => choice(value, KINDS, '글 종류'), category: value => choice(value, CATEGORIES, '분야'),
  title: value => text(value, '제목', 120, { single: true }), body: value => text(value, '본문', 12000),
};
const commentFields = { body: value => text(value, '댓글', 3000) };
const serviceFields = {
  category: value => choice(value, CATEGORIES, '분야'), mode: value => choice(value, MODES, '서비스 종류'),
  title: value => text(value, '제목', 120, { single: true }), description: value => text(value, '서비스 설명', 12000),
  deliverables: value => text(value, '결과물', 12000), includes: value => text(value, '포함 내용', 12000),
  excludes: value => text(value, '제외 내용', 12000), priceText: value => text(value, '가격 안내', 300, { single: true }),
  contactUrl: value => link(value),
};
function fields(input, validators, updating = false) {
  object(input, [...Object.keys(validators), updating ? 'revision' : 'requestId']);
  if (updating) revision(input.revision); else identifier(input.requestId);
  const result = {};
  for (const [name, validate] of Object.entries(validators)) if (!updating || own(input, name)) result[name] = validate(input[name]);
  if (!Object.keys(result).length) throw invalid('수정할 내용을 입력해 주세요.');
  return result;
}
function pageLimit(value = 20) {
  if (typeof value === 'string' && /^[1-9]\d?$/.test(value)) value = Number(value);
  if (!Number.isInteger(value) || value < 1 || value > 50) throw invalid('한 번에 1~50개를 조회할 수 있어요.');
  return value;
}
function cursorValue(value, scope) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 600 || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid('목록의 다음 페이지 주소를 확인해 주세요.');
  let cursor;
  try { cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); } catch { throw invalid('목록의 다음 페이지 주소를 확인해 주세요.'); }
  if (!cursor || cursor.v !== 1 || cursor.scope !== scope || typeof cursor.time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cursor.time) || !UUID.test(cursor.id || '') || Object.keys(cursor).length !== 4) throw invalid('검색 조건이 바뀌었어요. 첫 페이지부터 다시 조회해 주세요.');
  return cursor;
}
const optionalChoice = (value, allowed, label) => value === undefined || value === '' ? null : choice(value, allowed, label);
const optionalId = value => value === undefined || value === '' ? null : identifier(value);
const escapedSearch = value => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

// All actor IDs come from the HTTP layer's centrally verified customer identity.
// This store deliberately has no password, token, company-user or PULSE API.
export function createAiMarketStore({ store, now = () => new Date().toISOString() }) {
  if (!store?.db || typeof store.transaction !== 'function') throw new TypeError('AI 마켓에는 영구 저장소가 필요합니다.');
  const db = store.db, statements = new Map();
  const statement = sql => { if (!statements.has(sql)) statements.set(sql, db.prepare(sql)); return statements.get(sql); };
  const get = (sql, ...args) => statement(sql).get(...args);
  const run = (sql, ...args) => statement(sql).run(...args);
  const stamp = () => { const value = new Date(now()); if (!Number.isFinite(value.getTime())) throw new Error('AI market clock is invalid'); return value.toISOString(); };
  store.transaction(() => db.exec(`
    CREATE TABLE IF NOT EXISTS ai_market_profiles (
      user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, bio TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision>=1), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_market_posts (
      id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES ai_market_profiles(user_id),
      kind TEXT NOT NULL CHECK(kind IN ('question','case','discussion')),
      category TEXT NOT NULL CHECK(category IN ('content','education','automation','other')),
      title TEXT NOT NULL, body TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=1),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_market_comments (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES ai_market_posts(id),
      author_id TEXT NOT NULL REFERENCES ai_market_profiles(user_id), body TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision>=1), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_market_bookmarks (
      user_id TEXT NOT NULL REFERENCES ai_market_profiles(user_id), post_id TEXT NOT NULL REFERENCES ai_market_posts(id),
      created_at TEXT NOT NULL, PRIMARY KEY(user_id,post_id)
    );
    CREATE TABLE IF NOT EXISTS ai_market_sellers (
      user_id TEXT PRIMARY KEY REFERENCES ai_market_profiles(user_id), headline TEXT NOT NULL, description TEXT NOT NULL,
      categories TEXT NOT NULL, portfolio_url TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=1),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_market_services (
      id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES ai_market_sellers(user_id),
      category TEXT NOT NULL CHECK(category IN ('content','education','automation','other')),
      mode TEXT NOT NULL CHECK(mode IN ('learn','digital','commission')), title TEXT NOT NULL, description TEXT NOT NULL,
      deliverables TEXT NOT NULL, includes TEXT NOT NULL, excludes TEXT NOT NULL, price_text TEXT NOT NULL, contact_url TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision>=1), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_market_requests (
      user_id TEXT NOT NULL REFERENCES ai_market_profiles(user_id), operation TEXT NOT NULL, request_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL, resource_id TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(user_id,operation,request_id)
    );
    CREATE INDEX IF NOT EXISTS ai_market_posts_page ON ai_market_posts(created_at DESC,id DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS ai_market_posts_author ON ai_market_posts(author_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS ai_market_comments_page ON ai_market_comments(post_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS ai_market_services_page ON ai_market_services(created_at DESC,id DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS ai_market_services_seller ON ai_market_services(seller_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
  `));

  const times = row => ({ revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at });
  const profileValue = row => row ? { userId: row.user_id, displayName: row.display_name, bio: row.bio, ...times(row) } : null;
  const postValue = row => ({ id: row.id, authorId: row.author_id, author: { id: row.author_id, displayName: row.display_name },
    kind: row.kind, category: row.category, title: row.title, body: row.body, ...times(row) });
  const commentValue = row => ({ id: row.id, postId: row.post_id, authorId: row.author_id,
    author: { id: row.author_id, displayName: row.display_name }, body: row.body, ...times(row) });
  const sellerValue = row => row ? { userId: row.user_id, displayName: row.display_name, headline: row.headline, description: row.description,
    categories: JSON.parse(row.categories), portfolioUrl: row.portfolio_url, ...times(row) } : null;
  const serviceValue = row => ({ id: row.id, sellerId: row.seller_id,
    seller: { userId: row.seller_id, displayName: row.display_name, headline: row.headline }, category: row.category, mode: row.mode,
    title: row.title, description: row.description, deliverables: row.deliverables, includes: row.includes, excludes: row.excludes,
    priceText: row.price_text, contactUrl: row.contact_url, ...times(row) });
  const postsSelect = 'SELECT p.*,u.display_name FROM ai_market_posts p JOIN ai_market_profiles u ON u.user_id=p.author_id';
  const commentsSelect = 'SELECT c.*,u.display_name FROM ai_market_comments c JOIN ai_market_profiles u ON u.user_id=c.author_id';
  const servicesSelect = 'SELECT s.*,u.display_name,v.headline FROM ai_market_services s JOIN ai_market_sellers v ON v.user_id=s.seller_id JOIN ai_market_profiles u ON u.user_id=s.seller_id';
  const profileRow = userId => get('SELECT * FROM ai_market_profiles WHERE user_id=?', userId);
  function requireProfile(userId) {
    if (!profileRow(userId)) throw fail('PROFILE_REQUIRED', '먼저 공개 닉네임과 소개를 저장해 주세요.', 409);
  }
  function requireSeller(userId) {
    if (!get('SELECT user_id FROM ai_market_sellers WHERE user_id=?', userId)) throw fail('SELLER_REQUIRED', '먼저 판매자 프로필을 저장해 주세요.', 409);
  }
  function livePost(id) {
    const row = get(`${postsSelect} WHERE p.id=? AND p.deleted_at IS NULL`, identifier(id));
    if (!row) throw missing(); return row;
  }
  function liveComment(id) {
    const row = get(`${commentsSelect} JOIN ai_market_posts p ON p.id=c.post_id WHERE c.id=? AND c.deleted_at IS NULL AND p.deleted_at IS NULL`, identifier(id));
    if (!row) throw missing(); return row;
  }
  function liveService(id) {
    const row = get(`${servicesSelect} WHERE s.id=? AND s.deleted_at IS NULL`, identifier(id));
    if (!row) throw missing(); return row;
  }
  function owner(actual, userId) {
    if (actual !== userId) throw fail('FORBIDDEN', '본인이 작성한 자료만 바꿀 수 있어요.', 403);
  }
  function getProfile(userId) { return profileValue(profileRow(identifier(userId))); }
  function saveProfile(userId, input) {
    userId = identifier(userId); object(input, ['displayName', 'bio', 'revision']);
    const displayName = text(input.displayName, '닉네임', 60, { single: true }), bio = text(input.bio, '소개', 3000, { optional: true });
    revision(input.revision);
    return store.transaction(() => {
      const old = profileRow(userId), next = nextRevision(old?.revision || 0, input.revision), time = stamp();
      run(`INSERT INTO ai_market_profiles(user_id,display_name,bio,revision,created_at,updated_at) VALUES(?,?,?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,bio=excluded.bio,revision=excluded.revision,updated_at=excluded.updated_at`,
      userId, displayName, bio, next, old?.created_at || time, time);
      return getProfile(userId);
    });
  }
  function getSeller(userId) {
    return sellerValue(get('SELECT s.*,u.display_name FROM ai_market_sellers s JOIN ai_market_profiles u ON u.user_id=s.user_id WHERE s.user_id=?', identifier(userId)));
  }
  function saveSeller(userId, input) {
    userId = identifier(userId); object(input, ['headline', 'description', 'categories', 'portfolioUrl', 'revision']);
    const headline = text(input.headline, '판매자 한 줄 소개', 120, { single: true }), description = text(input.description, '판매자 소개', 3000);
    const portfolioUrl = link(input.portfolioUrl, true); revision(input.revision);
    if (!Array.isArray(input.categories) || input.categories.length < 1 || input.categories.length > 4 || new Set(input.categories).size !== input.categories.length) throw invalid('판매 분야를 1~4개 선택해 주세요.');
    const categories = input.categories.map(value => choice(value, CATEGORIES, '판매 분야')).sort();
    return store.transaction(() => {
      requireProfile(userId);
      const old = get('SELECT * FROM ai_market_sellers WHERE user_id=?', userId), next = nextRevision(old?.revision || 0, input.revision), time = stamp();
      run(`INSERT INTO ai_market_sellers(user_id,headline,description,categories,portfolio_url,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,description=excluded.description,categories=excluded.categories,
          portfolio_url=excluded.portfolio_url,revision=excluded.revision,updated_at=excluded.updated_at`,
      userId, headline, description, JSON.stringify(categories), portfolioUrl, next, old?.created_at || time, time);
      return getSeller(userId);
    });
  }
  function page({ select, alias, where, args, scope, cursor, limit, convert }) {
    const count = pageLimit(limit), after = cursorValue(cursor, scope);
    if (after) { where.push(`(${alias}.created_at<? OR (${alias}.created_at=? AND ${alias}.id<?))`); args.push(after.time, after.time, after.id); }
    const rows = statement(`${select} WHERE ${where.join(' AND ')} ORDER BY ${alias}.created_at DESC,${alias}.id DESC LIMIT ?`).all(...args, count + 1);
    const visible = rows.slice(0, count), last = visible.at(-1);
    return { items: visible.map(convert), nextCursor: rows.length > count ? Buffer.from(JSON.stringify({ v: 1, scope, time: last.created_at, id: last.id })).toString('base64url') : null };
  }
  function listPosts({ q = '', category, kind, cursor, savedUserId, authorId, limit } = {}) {
    q = text(q, '검색어', 200, { optional: true }); category = optionalChoice(category, CATEGORIES, '분야'); kind = optionalChoice(kind, KINDS, '글 종류');
    savedUserId = optionalId(savedUserId); authorId = optionalId(authorId);
    const where = ['p.deleted_at IS NULL'], args = [];
    if (q) { where.push("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')"); args.push(escapedSearch(q), escapedSearch(q)); }
    for (const [column, value] of [['p.category', category], ['p.kind', kind], ['p.author_id', authorId]]) if (value) { where.push(`${column}=?`); args.push(value); }
    if (savedUserId) { where.push('EXISTS(SELECT 1 FROM ai_market_bookmarks b WHERE b.post_id=p.id AND b.user_id=?)'); args.push(savedUserId); }
    return page({ select: postsSelect, alias: 'p', where, args, scope: digest(['posts', q, category, kind, savedUserId, authorId]), cursor, limit, convert: postValue });
  }
  function listComments(postId, { cursor, limit } = {}) {
    postId = identifier(postId); livePost(postId);
    return page({ select: `${commentsSelect} JOIN ai_market_posts p ON p.id=c.post_id`, alias: 'c', where: ['c.post_id=?', 'c.deleted_at IS NULL', 'p.deleted_at IS NULL'], args: [postId],
      scope: digest(['comments', postId]), cursor, limit, convert: commentValue });
  }
  function listServices({ q = '', category, mode, sellerId, cursor, limit } = {}) {
    q = text(q, '검색어', 200, { optional: true }); category = optionalChoice(category, CATEGORIES, '분야'); mode = optionalChoice(mode, MODES, '서비스 종류'); sellerId = optionalId(sellerId);
    const where = ['s.deleted_at IS NULL'], args = [];
    if (q) { where.push("(s.title LIKE ? ESCAPE '\\' OR s.description LIKE ? ESCAPE '\\')"); args.push(escapedSearch(q), escapedSearch(q)); }
    for (const [column, value] of [['s.category', category], ['s.mode', mode], ['s.seller_id', sellerId]]) if (value) { where.push(`${column}=?`); args.push(value); }
    return page({ select: servicesSelect, alias: 's', where, args, scope: digest(['services', q, category, mode, sellerId]), cursor, limit, convert: serviceValue });
  }
  function createOnce(userId, operation, requestId, payload, readCurrent, create) {
    // Caller owns the synchronous transaction and has checked profile/parent.
    const key = identifier(requestId), payloadHash = digest(payload);
    const old = get('SELECT * FROM ai_market_requests WHERE user_id=? AND operation=? AND request_id=?', userId, operation, key);
    if (old) {
      if (old.payload_hash !== payloadHash) throw fail('REQUEST_CONFLICT', '같은 저장 요청의 내용이 달라졌어요. 내용을 확인하고 새 요청으로 저장해 주세요.', 409);
      // A historical receipt cannot resurrect a deleted post, comment or service.
      readCurrent(old.resource_id);
      return JSON.parse(old.result_json);
    }
    const result = create();
    run('INSERT INTO ai_market_requests(user_id,operation,request_id,payload_hash,resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)',
      userId, operation, key, payloadHash, result.id, JSON.stringify(result), stamp());
    return result;
  }
  function createPost(userId, input) {
    userId = identifier(userId); const value = fields(input, postFields);
    return store.transaction(() => {
      requireProfile(userId);
      return createOnce(userId, 'post', input.requestId, value, livePost, () => {
        const id = randomUUID(), time = stamp();
        run('INSERT INTO ai_market_posts(id,author_id,kind,category,title,body,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)',
          id, userId, value.kind, value.category, value.title, value.body, time, time);
        return postValue(livePost(id));
      });
    });
  }
  function createComment(userId, postId, input) {
    userId = identifier(userId); postId = identifier(postId); const value = fields(input, commentFields);
    return store.transaction(() => {
      requireProfile(userId); livePost(postId);
      return createOnce(userId, 'comment', input.requestId, { postId, ...value }, liveComment, () => {
        const id = randomUUID(), time = stamp();
        run('INSERT INTO ai_market_comments(id,post_id,author_id,body,revision,created_at,updated_at) VALUES(?,?,?,?,1,?,?)', id, postId, userId, value.body, time, time);
        return commentValue(liveComment(id));
      });
    });
  }
  function createService(userId, input) {
    userId = identifier(userId); const value = fields(input, serviceFields);
    return store.transaction(() => {
      requireProfile(userId); requireSeller(userId);
      return createOnce(userId, 'service', input.requestId, value, liveService, () => {
        const id = randomUUID(), time = stamp();
        run(`INSERT INTO ai_market_services(id,seller_id,category,mode,title,description,deliverables,includes,excludes,price_text,contact_url,revision,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?)`, id, userId, value.category, value.mode, value.title, value.description, value.deliverables, value.includes, value.excludes, value.priceText, value.contactUrl, time, time);
        return serviceValue(liveService(id));
      });
    });
  }
  const entities = {
    post: { table: 'ai_market_posts', actor: 'author_id', read: livePost, convert: postValue, validators: postFields },
    comment: { table: 'ai_market_comments', actor: 'author_id', read: liveComment, convert: commentValue, validators: commentFields },
    service: { table: 'ai_market_services', actor: 'seller_id', read: liveService, convert: serviceValue, validators: serviceFields },
  };
  function mutate(kind, userId, id, input, deleting = false) {
    userId = identifier(userId); id = identifier(id);
    const entity = entities[kind], patch = deleting ? (object(input, ['revision']), revision(input.revision), null) : fields(input, entity.validators, true);
    return store.transaction(() => {
      requireProfile(userId);
      const row = entity.read(id); owner(row[entity.actor], userId);
      const next = nextRevision(row.revision, input.revision), time = stamp();
      if (deleting) {
        run(`UPDATE ${entity.table} SET deleted_at=?,updated_at=?,revision=? WHERE id=?`, time, time, next, id);
        return { ok: true, id, revision: next, deleted: true };
      }
      const values = Object.entries(patch), columns = values.map(([key]) => key.replace(/[A-Z]/g, char => '_' + char.toLowerCase()));
      run(`UPDATE ${entity.table} SET ${columns.map(column => column + '=?').join(',')},updated_at=?,revision=? WHERE id=?`, ...values.map(([, value]) => value), time, next, id);
      return entity.convert(entity.read(id));
    });
  }
  function isBookmarked(userId, postId) {
    userId = identifier(userId); postId = identifier(postId);
    return Boolean(get('SELECT 1 FROM ai_market_bookmarks b JOIN ai_market_posts p ON p.id=b.post_id WHERE b.user_id=? AND b.post_id=? AND p.deleted_at IS NULL', userId, postId));
  }
  function setBookmark(userId, postId, saved) {
    userId = identifier(userId); postId = identifier(postId);
    if (typeof saved !== 'boolean') throw invalid('관심 글 저장 여부를 확인해 주세요.');
    return store.transaction(() => {
      requireProfile(userId);
      if (saved) { livePost(postId); run('INSERT INTO ai_market_bookmarks(user_id,post_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,post_id) DO NOTHING', userId, postId, stamp()); }
      else run('DELETE FROM ai_market_bookmarks WHERE user_id=? AND post_id=?', userId, postId);
      return { postId, saved };
    });
  }
  return {
    getProfile, saveProfile, getSeller, saveSeller, listPosts, getPost: id => postValue(livePost(id)), createPost,
    updatePost: (userId, id, input) => mutate('post', userId, id, input), deletePost: (userId, id, input) => mutate('post', userId, id, input, true),
    listComments, createComment, updateComment: (userId, id, input) => mutate('comment', userId, id, input), deleteComment: (userId, id, input) => mutate('comment', userId, id, input, true),
    isBookmarked, setBookmark, listServices, getService: id => serviceValue(liveService(id)), createService,
    updateService: (userId, id, input) => mutate('service', userId, id, input), deleteService: (userId, id, input) => mutate('service', userId, id, input, true),
  };
}
