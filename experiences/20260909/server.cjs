'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { roles, objects, clues, choiceOptions, endings } = require('./server/story.cjs');

const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new RequestError(status, message); };
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const cleanName = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '';

function createExperienceServer({ root = ROOT, maxRooms = 50, roomLifetime = 4 * 60 * 60 * 1000 } = {}) {
  const rooms = new Map();
  const rates = new Map();
  const clients = new Set();
  const getRole = id => roles.find(r => r.id === id);
  const touch = room => { room.updatedAt = Date.now(); };
  const requiredIds = roles.filter(r => r.required).flatMap(r => clues[r.id].map(c => c.id));

  function state(room, player) {
    const publicPlayers = [...room.players.values()].map(p => ({ id: p.id, name: p.name, role: p.role, host: p.id === room.hostId, ready: p.inspected.includes(getRole(p.role).objectId) }));
    const privateClues = room.phase === 'lobby' ? [] : clues[player.role].filter(c => player.inspected.includes(c.objectId)).map(c => ({ ...c, shared: room.shared.has(c.id) }));
    const votes = Object.fromEntries([...room.players.values()].filter(p => p.vote).map(p => [p.id, p.vote]));
    const agreed = room.players.size >= 2 && Object.keys(votes).length === room.players.size && new Set(Object.values(votes)).size === 1;
    return {
      code: room.code, revision: room.revision, phase: room.phase,
      title: '마지막 불빛', players: publicPlayers, me: { id: player.id, role: player.role, name: player.name, host: player.id === room.hostId },
      roles, objects, requiredRoles: ['signal', 'archive'], privateClues, sharedClues: [...room.shared.values()],
      inspected: [...player.inspected], votes, choiceOptions, requiredShared: requiredIds.length,
      sharedRequired: requiredIds.filter(id => room.shared.has(id)).length,
      voteFinalizable: room.phase === 'vote' && agreed,
      objective: room.phase === 'lobby' ? '정비사와 기록원이 모이면 이야기를 시작할 수 있습니다.' : room.phase === 'explore' ? '자기 역할의 사물을 살펴보고, 발견한 단서를 함께 나누세요.' : room.phase === 'vote' ? '단서를 읽고 서로 이야기하세요. 모두 같은 곳을 고르면 마지막 불빛을 보낼 수 있습니다.' : '함께 고른 밤을 기억하세요.',
      ending: room.ending || null,
    };
  }
  function broadcast(room) {
    touch(room);
    for (const player of room.players.values()) {
      const payload = `event: state\ndata: ${JSON.stringify(state(room, player))}\n\n`;
      for (const res of player.connections) if (!res.destroyed) res.write(payload);
    }
  }
  function addPlayer(room, body) {
    const name = cleanName(body.name);
    if (!name) fail(400, '함께 부를 이름을 입력해 주세요. 실명은 필요하지 않습니다.');
    if (!getRole(body.role)) fail(400, '역할을 골라 주세요.');
    if (room.phase !== 'lobby') fail(409, '이미 시작한 이야기입니다. 기존 참여자는 원래 탭에서 이어갈 수 있습니다.');
    if (room.players.size >= 4) fail(409, '이 방에는 네 사람이 모두 모였습니다.');
    if ([...room.players.values()].some(p => p.role === body.role)) fail(409, '먼저 고른 사람이 있는 역할입니다. 다른 역할을 골라 주세요.');
    const p = { id: crypto.randomUUID(), token: crypto.randomBytes(32).toString('hex'), name, role: body.role, inspected: [], vote: null, connections: new Set() };
    room.players.set(p.id, p);
    room.revision++;
    return p;
  }
  const playerFor = (room, token) => {
    const player = [...room.players.values()].find(p => token && p.token === token);
    if (!player) fail(401, '참여 정보가 유효하지 않습니다. 초대 코드로 다시 들어와 주세요.');
    return player;
  };
  async function readBody(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 16384) fail(413, '입력이 너무 깁니다.'); chunks.push(chunk); }
    const body = Buffer.concat(chunks).toString('utf8');
    try { const parsed = JSON.parse(body || '{}'); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') fail(400, '입력 형식이 맞지 않습니다.'); return parsed; }
    catch (e) { if (e.status) throw e; fail(400, '입력을 읽을 수 없습니다.'); }
  }
  function applyAction(room, actor, type, payload = {}) {
    const isHost = actor.id === room.hostId;
    if (type === 'start') {
      if (!isHost) fail(403, '방을 만든 사람이 시작할 수 있습니다.');
      if (room.phase !== 'lobby') fail(409, '이미 시작한 이야기입니다.');
      if (!['signal', 'archive'].every(role => [...room.players.values()].some(p => p.role === role))) fail(409, '정비사와 기록원이 함께 있어야 시작할 수 있습니다.');
      room.phase = 'explore';
    } else if (type === 'inspect') {
      if (!['explore', 'vote'].includes(room.phase)) fail(409, '탐색할 수 있는 시간이 아닙니다.');
      if (!objects.some(o => o.id === payload.objectId)) fail(400, '그 사물은 이 장면에 없습니다.');
      if (!actor.inspected.includes(payload.objectId)) actor.inspected.push(payload.objectId);
    } else if (type === 'share') {
      if (!['explore', 'vote'].includes(room.phase)) fail(409, '지금은 단서를 나눌 수 없습니다.');
      const clue = clues[actor.role].find(c => c.id === payload.clueId && actor.inspected.includes(c.objectId));
      if (!clue) fail(403, '직접 살펴본 자신의 단서만 공유할 수 있습니다.');
      room.shared.set(clue.id, { ...clue, role: actor.role });
      if (requiredIds.every(id => room.shared.has(id))) room.phase = 'vote';
    } else if (type === 'vote') {
      if (room.phase !== 'vote') fail(409, '먼저 정비사와 기록원의 단서를 모두 나눠 주세요.');
      if (!choiceOptions.some(c => c.id === payload.choiceId)) fail(400, '불빛을 보낼 곳을 골라 주세요.');
      actor.vote = payload.choiceId;
    } else if (type === 'finalize') {
      if (!isHost) fail(403, '방을 만든 사람이 불빛을 보낼 수 있습니다.');
      if (!state(room, actor).voteFinalizable) fail(409, '참여한 사람들이 같은 곳을 고르면 불빛을 보낼 수 있습니다.');
      const choiceId = actor.vote;
      room.phase = 'ended';
      room.ending = { ...endings[choiceId], choiceId };
    } else if (type === 'reset') {
      if (!isHost) fail(403, '방을 만든 사람이 다시 시작할 수 있습니다.');
      if (room.phase !== 'ended') fail(409, '이야기를 마친 뒤 다시 시작할 수 있습니다.');
      room.phase = 'lobby'; room.shared.clear(); room.ending = null;
      for (const p of room.players.values()) { p.inspected = []; p.vote = null; }
    } else if (type === 'remove') {
      if (!isHost || room.phase !== 'lobby') fail(403, '시작 전에 방을 만든 사람이 참여 자리를 정리할 수 있습니다.');
      const p = room.players.get(payload.playerId);
      if (!p || p.id === actor.id) fail(400, '정리할 참여자를 골라 주세요.');
      for (const response of p.connections) response.end();
      room.players.delete(p.id);
    } else fail(400, '알 수 없는 동작입니다.');
    room.revision++;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      const url = new URL(req.url, 'http://local.invalid');
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, mode: 'local-preview', episode: 'last-light-v1' });
      if (url.pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) fail(403, '이 화면에서 다시 시도해 주세요.');
        const match = /^\/api\/rooms(?:\/([A-Z2-9]{6})(?:\/(join|events|actions))?)?$/.exec(url.pathname);
        if (!match) fail(404, '그 방 경로는 없습니다.');
        const [, code, operation] = match;
        if (req.method === 'POST') {
          const key = req.socket.remoteAddress;
          const rate = rates.get(key) || { count: 0, since: Date.now() };
          if (Date.now() - rate.since > 60000) { rate.count = 0; rate.since = Date.now(); }
          if (++rate.count > 240) fail(429, '잠시 뒤 다시 눌러 주세요.');
          rates.set(key, rate);
        }
        if (!code && req.method === 'POST') {
          if (rooms.size >= maxRooms) fail(503, '체험 방이 가득 찼습니다. 잠시 뒤 다시 시도해 주세요.');
          const body = await readBody(req);
          let newCode;
          do { newCode = Array.from(crypto.randomBytes(6), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 31]).join(''); } while (rooms.has(newCode));
          const room = { code: newCode, hostId: null, phase: 'lobby', revision: 0, updatedAt: Date.now(), players: new Map(), shared: new Map(), ending: null };
          const p = addPlayer(room, body); room.hostId = p.id; rooms.set(newCode, room);
          return json(res, 201, { code: newCode, token: p.token, playerId: p.id, state: state(room, p) });
        }
        const room = rooms.get(code);
        if (!room) fail(404, '방이 없거나 서버가 다시 시작되었습니다. 새 방을 만들어 주세요.');
        touch(room);
        if (operation === 'join' && req.method === 'POST') {
          const body = await readBody(req);
          if (rooms.get(code) !== room) fail(404, '방이 종료되었습니다. 새 방으로 들어와 주세요.');
          const p = addPlayer(room, body); broadcast(room);
          return json(res, 201, { code, token: p.token, playerId: p.id, state: state(room, p) });
        }
        const token = operation === 'events' ? url.searchParams.get('token') : req.headers.authorization?.replace(/^Bearer /, '');
        const actor = playerFor(room, token);
        // SSE hides HTTP errors from the client; this authenticated snapshot lets it
        // distinguish a lost room or revoked role from a temporary network outage.
        if (!operation && req.method === 'GET') return json(res, 200, { state: state(room, actor) });
        if (operation === 'events' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write(`retry: 1500\nevent: state\ndata: ${JSON.stringify(state(room, actor))}\n\n`);
          actor.connections.add(res); clients.add(res);
          req.on('close', () => { actor.connections.delete(res); clients.delete(res); });
          return;
        }
        if (operation === 'actions' && req.method === 'POST') {
          const body = await readBody(req);
          if (rooms.get(code) !== room) fail(404, '방이 종료되었습니다. 새 방으로 들어와 주세요.');
          // 본문이 오는 동안 대기실 참여자가 제거될 수 있으므로 현재 소속을 다시 확인한다.
          const currentActor = playerFor(room, token);
          applyAction(room, currentActor, body.type, body.payload || {}); broadcast(room);
          return json(res, 200, { state: state(room, currentActor) });
        }
        fail(405, '지원하지 않는 요청입니다.');
      }
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, '지원하지 않는 요청입니다.');
      let filePath;
      try { filePath = decodeURIComponent(url.pathname); } catch { fail(400, '주소를 읽을 수 없습니다.'); }
      if (filePath.includes('\\') || filePath.includes('\0') || filePath.split('/').some(part => part.startsWith('.'))) fail(404, '파일을 찾을 수 없습니다.');
      const allowed = filePath === '/' || ['/index.html', '/hub.css', '/hub.js'].includes(filePath) || ['/pulse/', '/rehearsal/', '/accessibility/', '/shared/'].some(p => filePath.startsWith(p));
      if (!allowed) fail(404, '파일을 찾을 수 없습니다.');
      if (filePath.endsWith('/')) filePath += 'index.html';
      const abs = path.resolve(root, '.' + filePath);
      if (!abs.startsWith(path.resolve(root) + path.sep) || !MIME[path.extname(abs)] || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) fail(404, '파일을 찾을 수 없습니다.');
      const headers = { 'Content-Type': MIME[path.extname(abs)], 'Cache-Control': 'no-cache' };
      res.writeHead(200, headers);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(abs).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : '잠시 문제가 생겼습니다. 다시 시도해 주세요.' });
      else res.end();
    }
  });
  server.requestTimeout = 30000;
  const housekeeping = setInterval(() => {
    for (const room of rooms.values()) {
      if (Date.now() - room.updatedAt > roomLifetime) { for (const p of room.players.values()) for (const r of p.connections) r.end(); rooms.delete(room.code); }
      else for (const p of room.players.values()) for (const r of p.connections) if (!r.destroyed) r.write(': keep-alive\n\n');
    }
    for (const [key, value] of rates) if (Date.now() - value.since > 60000) rates.delete(key);
  }, 20000);
  housekeeping.unref();
  server.on('close', () => { clearInterval(housekeeping); for (const r of clients) r.end(); });
  return { server, close: () => { for (const r of clients) r.end(); server.close(); }, rooms };
}
if (require.main === module) {
  const isLan = process.argv.includes('--lan');
  const portArg = process.argv.find(a => a.startsWith('--port='));
  const port = portArg ? Number(portArg.split('=')[1]) : 4399;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('포트는 1~65535 사이의 정수여야 합니다.');
  const { server } = createExperienceServer();
  server.on('error', error => { process.stderr.write(`체험 서버를 열 수 없습니다: ${error.code}\n`); process.exitCode = 1; });
  server.listen(port, isLan ? '0.0.0.0' : '127.0.0.1', () => {
    process.stdout.write(`SYNK 첫 경험: http://127.0.0.1:${port}/\n`);
    if (isLan) for (const entries of Object.values(os.networkInterfaces())) for (const entry of entries || []) if (entry.family === 'IPv4' && !entry.internal) process.stdout.write(`같은 네트워크 초대: http://${entry.address}:${port}/pulse/\n`);
    process.stdout.write('이 서버의 방과 참여 정보는 메모리에만 남고, 서버 종료 시 사라집니다.\n');
  });
}
module.exports = { createExperienceServer };
