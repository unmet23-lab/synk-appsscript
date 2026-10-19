'use strict';
// Typecast 공용 조각 — 키 파일, API 부르기(다시 묻기), 잔량, 요청 모양, 문장 해시 캐시, 구매 기록.
// 유료 호출은 call()로만 나간다. 키는 메모리로만 읽고 화면·파일·기록에 남기지 않는다.
// 캐시 열쇠는 tools/lib/미니게임목소리.cjs·LAB 관용구 나레이션.cjs와 같은 셈(요청 본문 JSON의 sha256 앞 32자)이라,
// 그 도구들이 저장소 밖에 받아 둔 원본도 열쇠가 맞으면 다시 사지 않고 쓴다(옛 폴더는 읽기만 하고 공용 캐시로 복사한다).
// 흐름 시험은 SYNK_TYPECAST_API(127.0.0.1만)·SYNK_TYPECAST_CACHE로 가짜 서버·임시 캐시를 쓰고, 그때는 실제 키 파일을 읽지 않는다.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');

const REAL_API = 'https://api.typecast.ai';
const DEFAULT_KEY_FILE = path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
const VENDOR = path.join(os.homedir(), 'Documents', 'synk-vendor');
const VOICE_ID = /^(tc|uc)_[0-9a-f]{24}$/;
const PRESETS = ['normal', 'happy', 'sad', 'angry', 'whisper', 'toneup', 'tonedown'];
const LANG = { ko: 'kor', en: 'eng', ja: 'jpn', zh: 'zho', es: 'spa', pt: 'por', fr: 'fra', de: 'deu', vi: 'vie', th: 'tha', id: 'ind', ru: 'rus', mn: 'mon' };
const FATAL = new Set([401, 402, 403]);

// 가짜 Typecast는 이 컴퓨터 주소만 받는다(키가 밖으로 나가지 않게).
function apiBase(env = process.env) {
  return /^http:\/\/127\.0\.0\.1:\d+$/.test(env.SYNK_TYPECAST_API || '') ? env.SYNK_TYPECAST_API : REAL_API;
}
const isFakeApi = (env = process.env) => apiBase(env) !== REAL_API;

function cacheRoot(env = process.env) {
  return env.SYNK_TYPECAST_CACHE ? path.resolve(env.SYNK_TYPECAST_CACHE) : path.join(VENDOR, 'typecast-cache');
}
// 옛 도구의 원본 자리. 시험(임시 캐시)에서는 진짜 폴더를 보지 않는다.
function legacyPaths(voiceId, key, env = process.env) {
  if (env.SYNK_TYPECAST_CACHE) return [];
  return [path.join(VENDOR, 'lab-topik-narration', 'raw', key + '.wav'), path.join(VENDOR, 'minigame-voice', 'raw', voiceId, key + '.wav')];
}

// 가짜 API로 도는 시험에서는 기본 키 파일(실제 키)을 읽지 않는다 — 키 파일을 직접 줘야 한다.
function keyFilePath({ explicit = null, env = process.env } = {}) {
  if (explicit) return path.resolve(explicit);
  if (env.SYNK_TYPECAST_KEY_FILE) return path.resolve(env.SYNK_TYPECAST_KEY_FILE);
  if (isFakeApi(env)) throw Error('가짜 Typecast로 도는 중에는 실제 키 파일을 읽지 않습니다. --키파일로 시험용 파일을 주세요.');
  return DEFAULT_KEY_FILE;
}
function readKey(file) {
  if (!fs.existsSync(file)) {
    const e = Error(`Typecast 키 파일이 없습니다: ${file}\n  유호님이 기존 API 키를 이 파일 첫 줄에 넣으면 됩니다(키는 채팅으로 받지 않습니다). 빈 파일·메모장 열기: node tools/나레이션굽기.mjs --키파일-열기`);
    e.code = 'NO_KEY_FILE'; throw e;
  }
  const key = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
  if (key.length < 10) { const e = Error(`Typecast 키 파일이 비어 있습니다: ${file}`); e.code = 'NO_KEY_FILE'; throw e; }
  return key;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 429·5xx는 잠시 뒤 다시 묻는다(Retry-After를 따른다). 4xx는 곧바로 멈춘다.
// 네트워크 오류는 읽기(GET)만 다시 묻는다 — 굽기(POST)는 응답만 못 받고 값이 나갔을 수 있다.
async function call(route, { method = 'GET', body = null, key, base = apiBase(), fetchImpl = fetch, waits = [2000, 5000, 10000, 20000], timeoutMs = 180000 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let res;
    try {
      res = await fetchImpl(base + route, { method, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (method !== 'GET' || attempt >= waits.length) throw Error('Typecast 연결 실패: ' + (error.cause?.code || error.name || error.message));
      await sleep(waits[attempt]); continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < waits.length) {
      const after = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(after) && after > 0 ? Math.min(60000, after * 1000) : waits[attempt]); continue;
    }
    if (!res.ok) {
      let detail = ''; try { detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 200); } catch {}
      const e = Error(`Typecast HTTP ${res.status}${detail ? ' · ' + detail : ''}`); e.status = res.status; throw e;
    }
    return res.json();
  }
}
function credits(sub) {
  const c = sub?.credits;
  if (!Number.isFinite(c?.plan_credits) || !Number.isFinite(c?.used_credits)) throw Error('월 제공 크레딧 잔량을 확인할 수 없습니다.');
  return { plan: c.plan_credits, used: c.used_credits, left: c.plan_credits - c.used_credits };
}

const language = (lang) => LANG[lang] || (/^[a-z]{3}$/.test(lang || '') ? lang : null);
// 요청 본문. 키 순서까지 미니게임 목소리·LAB 관용구 도구와 같아야 옛 원본의 열쇠가 맞는다 — 바꾸지 않는다.
function request(s, text) {
  return {
    seed: s.seed, model: s.model, voice_id: s.voiceId, text, language: language(s.lang),
    output: { audio_format: 'wav', audio_tempo: s.tempo, target_lufs: s.lufs },
    prompt: s.emotion === 'smart' ? { emotion_type: 'smart', previous_text: s.prev || '', next_text: s.next || '' }
      : { emotion_type: 'preset', emotion_preset: s.emotion, emotion_intensity: s.intensity },
  };
}
const cacheKey = (req) => crypto.createHash('sha256').update(JSON.stringify(req)).digest('hex').slice(0, 32);
const chars = (text) => [...String(text)].length;

function cachePaths(voiceId, key, env = process.env) {
  const dir = path.join(cacheRoot(env), voiceId);
  return { dir, wav: path.join(dir, key + '.wav'), json: path.join(dir, key + '.json') };
}
// 캐시에 있으면 그 wav 경로(옛 폴더에서 찾으면 공용 캐시로 복사한 뒤), 없으면 null.
function findCached(voiceId, key, { env = process.env, copyLegacy = true } = {}) {
  const p = cachePaths(voiceId, key, env);
  if (fs.existsSync(p.wav)) return { wav: p.wav, json: fs.existsSync(p.json) ? p.json : null, from: 'cache' };
  for (const old of legacyPaths(voiceId, key, env)) {
    if (!fs.existsSync(old)) continue;
    if (!copyLegacy) return { wav: old, json: null, from: 'legacy' };
    fs.mkdirSync(p.dir, { recursive: true });
    fs.copyFileSync(old, p.wav + '.part'); fs.renameSync(p.wav + '.part', p.wav);
    const sidecar = old.replace(/\.wav$/, '.json');
    if (fs.existsSync(sidecar) && !fs.existsSync(p.json)) fs.copyFileSync(sidecar, p.json);
    return { wav: p.wav, json: fs.existsSync(p.json) ? p.json : null, from: 'legacy', legacy: old };
  }
  return null;
}
// 받은 응답을 캐시에 넣는다(wav는 .part로 쓰고 이름을 바꿔 덜 쓴 파일이 캐시에 남지 않게).
function saveCached(req, data, label = {}, env = process.env) {
  const bytes = Buffer.from(data?.audio || '', 'base64');
  if (bytes.length < 1000 || bytes.toString('ascii', 0, 4) !== 'RIFF') throw Error('빈 음성이거나 wav가 아닙니다.');
  const key = cacheKey(req), p = cachePaths(req.voice_id, key, env);
  fs.mkdirSync(p.dir, { recursive: true });
  const { audio, ...meta } = data;
  fs.writeFileSync(p.json, JSON.stringify({ key, request: req, label, made: new Date().toISOString(), ...meta }, null, 1) + '\n');
  fs.writeFileSync(p.wav + '.part', bytes); fs.renameSync(p.wav + '.part', p.wav);
  return { key, ...p };
}
// 산 줄마다 한 줄씩 남긴다(쓴 크레딧 보고용). 키·잔량 외 개인 정보는 없다.
function logPurchase(entry, env = process.env) {
  const file = path.join(cacheRoot(env), '구매기록.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

module.exports = {
  REAL_API, DEFAULT_KEY_FILE, VENDOR, VOICE_ID, PRESETS, FATAL,
  apiBase, isFakeApi, cacheRoot, legacyPaths, keyFilePath, readKey, call, credits,
  language, request, cacheKey, chars, cachePaths, findCached, saveCached, logPurchase,
};
