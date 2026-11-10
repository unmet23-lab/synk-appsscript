import { createClientAddress } from './request-security.mjs';

const PREFIX = '/api/customer/ai-market';
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const emptyObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;

// Public discovery and external customer identity share an origin, not employee permissions.
export function createAiMarketRoutes({ identity, market, origin, send, body, stopping = () => false,
  now = () => Date.now(), clientAddress = createClientAddress() }) {
  const attempts = new Map();
  function rate(key, maximum) {
    const stamp = now();
    for (const [id, entry] of attempts) if (entry.until <= stamp) attempts.delete(id);
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= 10000) throw failure(429, 'RATE_LIMITED', '요청이 많습니다. 잠시 후 다시 시도해 주세요.');
      entry = { count: 0, until: stamp + 60000 }; attempts.set(key, entry);
    }
    if (++entry.count > maximum) throw failure(429, 'RATE_LIMITED', '요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  }
  function query(url, names) {
    const values = {};
    for (const key of url.searchParams.keys()) {
      if (!names.includes(key) || url.searchParams.getAll(key).length !== 1) throw failure(400, 'INVALID_QUERY', '검색 조건을 확인해 주세요.');
      const value = url.searchParams.get(key);
      if (value.length > (key === 'cursor' ? 1000 : 200)) throw failure(400, 'INVALID_QUERY', '검색 조건이 너무 깁니다.');
      values[key] = value;
    }
    if ('limit' in values) {
      if (!/^[1-9]\d?$/.test(values.limit) || Number(values.limit) > 50) throw failure(400, 'INVALID_QUERY', '목록 크기를 확인해 주세요.');
      values.limit = Number(values.limit);
    }
    return values;
  }
  async function authenticated(req) {
    const auth = await identity.authenticate(req);
    requireCurrent(auth);
    return auth;
  }
  function requireCurrent(auth) {
    if (!auth || !identity.isCurrent(auth)) throw failure(401, 'LOGIN_REQUIRED', 'SYNK ID로 로그인해 주세요.');
  }
  async function mutate(req) {
    if (req.headers.origin !== origin) throw failure(403, 'ORIGIN_REJECTED', 'AI 마켓 화면에서 다시 요청해 주세요.');
    const auth = await authenticated(req);
    identity.requireCsrf(req, auth);
    rate('write:' + auth.user.synkUserId, 120);
    const input = await body(req, { maxBytes: 200000, maxChars: 60000 });
    const latest = await authenticated(req);
    if (!identity.isCurrent(auth) || latest.user !== auth.user) throw failure(401, 'SESSION_CHANGED', '로그인 상태가 바뀌었습니다. 다시 로그인해 주세요.');
    identity.requireCsrf(req, auth);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw failure(400, 'INVALID_INPUT', '입력 내용을 확인해 주세요.');
    return { auth, userId: auth.user.synkUserId, input };
  }
  return async function aiMarketRoutes(req, res, url) {
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return false;
    res.setHeader('Cache-Control', 'no-store');
    const respond = (status, data) => { send(res, status, data); return true; };
    try {
      if (stopping()) throw failure(503, 'SERVICE_RESTARTING', '서버가 다시 시작되고 있습니다. 잠시 후 다시 시도해 주세요.');
      rate('ip:' + clientAddress(req), 600);
      const path = url.pathname.slice(PREFIX.length), method = req.method;
      if (path === '/session' && method === 'GET') {
        query(url, []);
        const auth = await identity.authenticate(req), current = auth && identity.isCurrent(auth);
        const userId = current ? auth.user.synkUserId : null;
        return respond(200, { authenticated: Boolean(current), user: current ? { id: userId } : null,
          profile: current ? market.getProfile(userId) : null, seller: current ? market.getSeller(userId) : null,
          csrfToken: current ? auth.csrfToken : null, loginAvailable: identity.status().enabled });
      }
      if (path === '/login' && method === 'POST') {
        query(url, []);
        if (req.headers.origin !== origin) throw failure(403, 'ORIGIN_REJECTED', 'AI 마켓 화면에서 다시 요청해 주세요.');
        if (!emptyObject(await body(req, { maxBytes: 1024, maxChars: 1024 }))) throw failure(400, 'INVALID_INPUT', '로그인 요청을 확인해 주세요.');
        return respond(200, identity.start(req, res, { returnTo: '/ai-market/' }));
      }
      const postMatch = path.match(/^\/posts\/([^/]+)$/);
      const commentsMatch = path.match(/^\/posts\/([^/]+)\/comments$/);
      const bookmarkMatch = path.match(/^\/posts\/([^/]+)\/bookmark$/);
      const commentMatch = path.match(/^\/comments\/([^/]+)$/);
      const profileMatch = path.match(/^\/profiles\/([^/]+)$/);
      const sellerMatch = path.match(/^\/sellers\/([^/]+)$/);
      const serviceMatch = path.match(/^\/services\/([^/]+)$/);
      if (method === 'GET') {
        if (path === '/posts') {
          const options = query(url, ['q', 'category', 'kind', 'cursor', 'saved', 'limit']);
          if ('saved' in options && !['true', 'false'].includes(options.saved)) throw failure(400, 'INVALID_QUERY', '관심 글 조건을 확인해 주세요.');
          const saved = options.saved === 'true'; delete options.saved;
          if (saved) { const auth = await authenticated(req); requireCurrent(auth); options.savedUserId = auth.user.synkUserId; }
          return respond(200, market.listPosts(options));
        }
        if (postMatch) {
          query(url, []);
          const post = market.getPost(postMatch[1]);
          const comments = market.listComments(post.id);
          // Reading a public post works even when central login is unavailable.
          // The user's bookmark state is obtained from the authenticated bookmark endpoint.
          return respond(200, { post, comments: comments.items, commentsNextCursor: comments.nextCursor,
            services: market.listServices({ sellerId: post.authorId, limit: 10 }).items });
        }
        if (commentsMatch) return respond(200, market.listComments(commentsMatch[1], query(url, ['cursor', 'limit'])));
        if (bookmarkMatch) {
          query(url, []);
          const auth = await authenticated(req);
          requireCurrent(auth);
          market.getPost(bookmarkMatch[1]);
          return respond(200, { saved: market.isBookmarked(auth.user.synkUserId, bookmarkMatch[1]) });
        }
        if (profileMatch || sellerMatch) {
          query(url, []);
          const id = (profileMatch || sellerMatch)[1], profile = market.getProfile(id);
          if (!profile) throw failure(404, 'NOT_FOUND', '프로필을 찾을 수 없습니다.');
          const seller = market.getSeller(id);
          if (sellerMatch && !seller) throw failure(404, 'NOT_FOUND', '판매자 프로필을 찾을 수 없습니다.');
          return respond(200, { profile, seller, posts: market.listPosts({ authorId: id, limit: 20 }).items,
            services: market.listServices({ sellerId: id, limit: 20 }).items });
        }
        if (path === '/services') return respond(200, market.listServices(query(url, ['q', 'category', 'mode', 'cursor', 'limit'])));
        if (serviceMatch) {
          query(url, []);
          const service = market.getService(serviceMatch[1]);
          return respond(200, { service, seller: market.getSeller(service.sellerId) });
        }
      }
      const allowed = path === '/posts' || path === '/services' ? ['POST']
        : path === '/profile' || path === '/seller' ? ['PUT']
        : postMatch || commentMatch || serviceMatch ? ['PATCH', 'DELETE']
        : commentsMatch ? ['POST'] : bookmarkMatch ? ['PUT', 'DELETE'] : [];
      if (!allowed.length) throw failure(404, 'NOT_FOUND', '요청한 주소를 찾을 수 없습니다.');
      if (!allowed.includes(method)) throw failure(405, 'METHOD_NOT_ALLOWED', '요청 방법을 확인해 주세요.');
      query(url, []);
      const { auth, userId, input } = await mutate(req);
      // An async helper's return introduces another microtask boundary. Keep the
      // final authorization check in this stack, immediately before synchronous DB access.
      requireCurrent(auth);
      identity.requireCsrf(req, auth);
      if (path === '/profile') return respond(200, { profile: market.saveProfile(userId, input) });
      if (path === '/seller') return respond(200, { seller: market.saveSeller(userId, input) });
      if (path === '/posts') return respond(201, { post: market.createPost(userId, input) });
      if (path === '/services') return respond(201, { service: market.createService(userId, input) });
      if (postMatch) return method === 'PATCH'
        ? respond(200, { post: market.updatePost(userId, postMatch[1], input) })
        : respond(200, market.deletePost(userId, postMatch[1], input));
      if (commentsMatch) return respond(201, { comment: market.createComment(userId, commentsMatch[1], input) });
      if (commentMatch) return method === 'PATCH'
        ? respond(200, { comment: market.updateComment(userId, commentMatch[1], input) })
        : respond(200, market.deleteComment(userId, commentMatch[1], input));
      if (bookmarkMatch) {
        if (!emptyObject(input)) throw failure(400, 'INVALID_INPUT', '관심 글 요청을 확인해 주세요.');
        market.setBookmark(userId, bookmarkMatch[1], method === 'PUT');
        return respond(200, { saved: method === 'PUT' });
      }
      return method === 'PATCH'
        ? respond(200, { service: market.updateService(userId, serviceMatch[1], input) })
        : respond(200, market.deleteService(userId, serviceMatch[1], input));
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        if (error.status === 429) res.setHeader('Retry-After', '60');
        return respond(error.status, { error: error.message, code: /^[A-Z][A-Z0-9_]{0,90}$/.test(error.code || '') ? error.code : 'REQUEST_REJECTED' });
      }
      if (error.status === 503) return respond(503, { error: '서버 연결을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.', code: 'SERVICE_UNAVAILABLE' });
      throw error; // The host's error boundary hides unexpected database/internal errors.
    }
  };
}
