import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { voiceLimits } from './voice-usage.mjs';

const PARTICIPANT_ABSENT = Symbol('livekit-participant-absent');

function unavailable() {
  return Object.assign(new Error('통화 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'), { status: 503, code: 'VOICE_PROVIDER_UNAVAILABLE', publicMessage: '통화 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
}

function mediaGrants({ canSpeak = true, canShare = false, shareAudio = false, paused = false } = {}) {
  const sources = paused ? [] : [...(canSpeak ? ['MICROPHONE'] : []), ...(canShare ? ['SCREEN_SHARE'] : []), ...(canShare && shareAudio ? ['SCREEN_SHARE_AUDIO'] : [])];
  return { sources, canPublish: sources.length > 0, canSubscribe: !paused };
}

export function voiceOptionsFromEnv(env = process.env) {
  if (env.SYNK_WORKSPACE_VOICE_ENABLED === undefined || env.SYNK_WORKSPACE_VOICE_ENABLED === '0') {
    // Only resolve credentials if a previous process left media revocations to
    // finish. A fresh disabled workspace never instantiates/calls the provider.
    return env.SYNK_VOICE_LIVEKIT_URL && env.SYNK_VOICE_LIVEKIT_API_KEY && env.SYNK_VOICE_LIVEKIT_API_SECRET
      ? { enabled: false, cleanupProvider: () => createLiveKitVoiceProvider({ url: env.SYNK_VOICE_LIVEKIT_URL, apiKey: env.SYNK_VOICE_LIVEKIT_API_KEY, apiSecret: env.SYNK_VOICE_LIVEKIT_API_SECRET }) }
      : { enabled: false };
  }
  if (env.SYNK_WORKSPACE_VOICE_ENABLED !== '1') throw new Error('SYNK_WORKSPACE_VOICE_ENABLED는 0 또는 1이어야 합니다.');
  const names = { maxConcurrentParticipants: 'SYNK_VOICE_MAX_PARTICIPANTS', maxSessionSeconds: 'SYNK_VOICE_MAX_SESSION_SECONDS', monthlyParticipantMinutes: 'SYNK_VOICE_MONTHLY_PARTICIPANT_MINUTES', monthlyDownstreamBytes: 'SYNK_VOICE_MONTHLY_DOWNSTREAM_BYTES' };
  const limits = voiceLimits(Object.fromEntries(Object.entries(names).filter(([, name]) => env[name] !== undefined).map(([key, name]) => [key, /^\d+$/.test(env[name]) ? Number(env[name]) : NaN])));
  return { enabled: true, e2eeRequired: true, limits, provider: createLiveKitVoiceProvider({ url: env.SYNK_VOICE_LIVEKIT_URL, apiKey: env.SYNK_VOICE_LIVEKIT_API_KEY, apiSecret: env.SYNK_VOICE_LIVEKIT_API_SECRET }) };
}

// LiveKit WebhookReceiver uses a JWT in Authorization and a standard base64
// SHA-256 of the original request body. Verify before parsing application data.
export function verifyLiveKitWebhook(raw, authorization, { apiKey, apiSecret, now = Date.now }) {
  const reject = () => { throw Object.assign(new Error('통화 이벤트 인증을 확인해 주세요.'), { status: 401, code: 'VOICE_WEBHOOK_INVALID', publicMessage: '통화 이벤트 인증을 확인해 주세요.' }); };
  try {
    if (!Buffer.isBuffer(raw) || raw.length > 65536 || typeof authorization !== 'string' || authorization.length > 8192) return reject();
    const token = authorization.replace(/^Bearer /, ''), pieces = token.split('.');
    if (pieces.length !== 3 || pieces.some(value => !/^[A-Za-z0-9_-]+$/.test(value))) return reject();
    const [head, payload, signature] = pieces, header = JSON.parse(Buffer.from(head, 'base64url')), claims = JSON.parse(Buffer.from(payload, 'base64url'));
    const expected = createHmac('sha256', apiSecret).update(head + '.' + payload).digest();
    const actual = Buffer.from(signature, 'base64url'), at = now() / 1000;
    if (header.alg !== 'HS256' || header.crit || actual.length !== expected.length || !timingSafeEqual(actual, expected) || claims.iss !== apiKey || !Number.isFinite(claims.exp) || claims.exp <= at - 5 || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > at + 5))) return reject();
    const digest = createHash('sha256').update(raw).digest('base64');
    if (typeof claims.sha256 !== 'string' || claims.sha256.length !== digest.length || !timingSafeEqual(Buffer.from(claims.sha256), Buffer.from(digest))) return reject();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch { return reject(); }
}

// This pilot uses Cloud's explicit token revocation. Self-hosted RemoveParticipant
// does not invalidate refreshed tokens and needs a different admission contract.
export function createLiveKitVoiceProvider({ url, apiKey, apiSecret, fetch: fetcher = globalThis.fetch, now = Date.now }) {
  let endpoint;
  try { endpoint = new URL(url); } catch { throw new Error('통화 서버 주소를 확인해 주세요.'); }
  if (endpoint.protocol !== 'wss:' || !/^[a-z0-9-]+\.livekit\.cloud$/.test(endpoint.hostname) || endpoint.port || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw new Error('통화 시험은 LiveKit Cloud의 기본 wss 주소를 사용합니다.');
  if (typeof apiKey !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(apiKey) || typeof apiSecret !== 'string' || apiSecret.length < 32 || apiSecret.length > 512) throw new Error('통화 서버의 API 키와 비밀 키를 서버 환경변수에 설정해 주세요.');
  const serverUrl = endpoint.origin;
  const controlOrigin = serverUrl.replace('wss:', 'https:');
  function jwt(payload, ttl = 60) {
    const at = Math.floor(now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ iss: apiKey, nbf: at, iat: at, exp: at + ttl, ...payload })).toString('base64url');
    const input = `${header}.${body}`;
    return `${input}.${createHmac('sha256', apiSecret).update(input).digest('base64url')}`;
  }
  async function control(method, body, video, read = false, allowAbsentParticipant = false) {
    try {
      const response = await fetcher(`${controlOrigin}/twirp/livekit.RoomService/${method}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(4000),
        headers: { Authorization: `Bearer ${jwt({ video })}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!read && !(allowAbsentParticipant && response.status === 404)) { await response.body?.cancel(); if (!response.ok) throw unavailable(); return; }
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body || []) {
        bytes += chunk.length; if (bytes > 262144) throw unavailable(); chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (allowAbsentParticipant && method === 'UpdateParticipant' && response.status === 404 && data.code === 'not_found') return PARTICIPANT_ABSENT;
      if (method === 'ListParticipants' && response.status === 404 && data.code === 'not_found') return { participants: [] };
      if (!response.ok || !data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
      return data;
    } catch { throw unavailable(); }
  }
  return {
    serverUrl,
    async createRoom(room, capacity) {
      return control('CreateRoom', { name: room, max_participants: capacity, empty_timeout: 60, departure_timeout: 20 }, { roomCreate: true }, true);
    },
    issueToken(room, identity, capacity, permissions) {
      const grants = mediaGrants(permissions);
      return { token: jwt({ sub: identity, video: { room, roomJoin: true, canPublish: grants.canPublish, canSubscribe: grants.canSubscribe, canPublishData: false, canUpdateOwnMetadata: false, canPublishSources: grants.sources.map(source => source.toLowerCase()) }, roomConfig: { maxParticipants: capacity, emptyTimeout: 60, departureTimeout: 20 } }), expiresAt: new Date(now() + 60000).toISOString() };
    },
    async updatePermissions(room, identity, permissions) {
      const grants = mediaGrants(permissions);
      const result = await control('UpdateParticipant', { room, identity, permission: { can_subscribe: grants.canSubscribe, can_publish: grants.canPublish, can_publish_data: false, can_publish_sources: grants.sources, can_update_metadata: false } }, { roomAdmin: true, room }, false, permissions.paused === true);
      if (result === PARTICIPANT_ABSENT) {
        // A missing transport may still hold a usable JWT. Revoke it explicitly
        // and keep replacement JWTs past the whole-second revocation boundary.
        const cutoff = Math.floor(now() / 1000) + 1;
        await control('RemoveParticipant', { room, identity, revoke_token_ts: cutoff }, { roomAdmin: true, room });
        return { tokenNotBeforeMs: (cutoff + 1) * 1000 };
      }
    },
    verifyWebhook(raw, authorization) { return verifyLiveKitWebhook(raw, authorization, { apiKey, apiSecret, now }); },
    async listParticipants(room) {
      const data = await control('ListParticipants', { room }, { roomAdmin: true, room }, true);
      // Proto JSON may omit the repeated field when the room is empty.
      const participants = data.participants || [];
      if (!Array.isArray(participants) || participants.length > 128) throw unavailable();
      const seen = new Set();
      return participants.map(p => {
        if (!p || typeof p.identity !== 'string' || !p.identity || p.identity.length > 128 || typeof p.sid !== 'string' || !p.sid || p.sid.length > 128 || seen.has(p.identity)) throw unavailable();
        seen.add(p.identity);
        const states = ['JOINING', 'JOINED', 'ACTIVE', 'DISCONNECTED'], state = typeof p.state === 'number' ? states[p.state] : p.state || 'JOINING';
        if (!states.includes(state) || (p.tracks !== undefined && (!Array.isArray(p.tracks) || p.tracks.length > 32))) throw unavailable();
        return { identity: p.identity, sid: p.sid, state, tracks: (p.tracks || []).map(track => ({ source: typeof track.source === 'number' ? ['UNKNOWN', 'CAMERA', 'MICROPHONE', 'SCREEN_SHARE', 'SCREEN_SHARE_AUDIO'][track.source] : track.source || 'UNKNOWN', type: typeof track.type === 'number' ? ['AUDIO', 'VIDEO'][track.type] : track.type || 'AUDIO', muted: track.muted === true,
          ...(track.encryption === undefined ? {} : { encryption: typeof track.encryption === 'number' ? ['NONE', 'GCM', 'CUSTOM'][track.encryption] || 'UNKNOWN' : track.encryption }),
          ...(Number.isSafeInteger(track.width) && Number.isSafeInteger(track.height) ? { width: track.width, height: track.height } : {}) })) };
      });
    },
    async removeParticipant(room, identity) {
      // +1 rejects tokens minted during this same second as well. Each admission
      // has a fresh opaque identity, so revoking one never kicks a later join.
      await control('RemoveParticipant', { room, identity, revoke_token_ts: Math.floor(now() / 1000) + 1 }, { roomAdmin: true, room });
    },
  };
}
