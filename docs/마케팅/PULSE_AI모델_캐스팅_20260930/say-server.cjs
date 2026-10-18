// 「우리 광고 문장으로 듣기」 서버. 캐스팅북 화면이 고른 모델·목소리로 손님 문장을 읽어 mp3로 돌려준다.
//   node say-server.cjs [포트=8795]        → POST /api/say  {model:"M02", voice:0, text:"…"}  → audio/mpeg
//   같은 포트에서 site/를 그대로 보여 준다(로컬 확인용: http://127.0.0.1:8795/ — 빌드 때 PULSE_SAY_API=/api/say).
// 키: 환경 변수 TYPECAST_API_KEY, 없으면 ~/SYNK_보안/타입캐스트.txt(메모리에서만 쓴다). 화면에는 키도 목소리 ID도 나가지 않는다.
// 비용 막기: 타입캐스트는 1글자 1크레딧이라 글자 수·한 사람 하루 횟수·하루 전체 글자를 막고, 같은 문장은 저장해 둔 소리를 다시 준다.
'use strict';
const http = require('node:http'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const here = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8795);
const LIMIT = {
  chars: Number(process.env.SAY_MAX_CHARS || 60), // 한 번에 읽는 글자
  perIpDay: Number(process.env.SAY_PER_IP_DAY || 10), // 한 사람(주소) 하루 새로 만들기
  allDayChars: Number(process.env.SAY_ALL_DAY_CHARS || 3000), // 하루 전체 새로 만드는 글자(= 크레딧)
};
const ORIGINS = String(process.env.SAY_ORIGINS || 'https://synk.im,http://127.0.0.1:8794,http://127.0.0.1:8795').split(',');
const CACHE = path.join(here, '.say-cache');

// 모델 코드 + 목소리 순서 → 타입캐스트 설정(voices.json에서 engine이 typecast인 것만)
function voiceTable() {
  const { models } = JSON.parse(fs.readFileSync(path.join(here, 'roster-v2.json'), 'utf8'));
  const voices = JSON.parse(fs.readFileSync(path.join(here, 'voices.json'), 'utf8'));
  const t = {};
  for (const m of models) {
    const mine = voices.filter((v) => v.name.startsWith(m.key + '-'));
    mine.forEach((v, i) => { if (v.engine === 'typecast' && v.voiceId) (t[m.code] = t[m.code] || {})[i] = { voiceId: v.voiceId, model: v.model || 'ssfm-v30', emotion: v.emotion || 'normal', tempo: v.tempo || 1, seed: v.seed || 1018 }; });
  }
  return t;
}
let table = voiceTable();

function key() {
  if (process.env.TYPECAST_API_KEY) return process.env.TYPECAST_API_KEY.trim();
  try { return fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt'), 'utf8').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || ''; } catch { return ''; }
}

// 하루 세기(서버를 다시 켜면 처음부터 — 운영에서는 같은 값을 저장소에 둔다)
const day = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
let tally = { day: day(), ip: {}, chars: 0 };
const roll = () => { if (tally.day !== day()) tally = { day: day(), ip: {}, chars: 0 }; };

function clean(text) {
  return String(text || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
}
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); };

async function tts(cfg, text) {
  const k = key();
  if (!k) throw Object.assign(Error('no key'), { status: 503, message: '지금은 목소리를 만들 수 없어요. 상담에서 만들어 드릴게요.' });
  const res = await fetch('https://api.typecast.ai/v1/text-to-speech', {
    method: 'POST', headers: { 'X-API-KEY': k, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ seed: cfg.seed, model: cfg.model, voice_id: cfg.voiceId, text, language: 'kor', output: { audio_format: 'wav', audio_tempo: cfg.tempo, target_lufs: -17 }, prompt: { emotion_type: 'preset', emotion_preset: cfg.emotion, emotion_intensity: 1.0 } }),
  });
  if (!res.ok) throw Object.assign(Error('typecast ' + res.status), { status: 502, message: '목소리를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.' });
  const wav = Buffer.from(await res.arrayBuffer());
  if (wav.length < 1000) throw Object.assign(Error('empty'), { status: 502, message: '목소리를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.' });
  const tmp = path.join(CACHE, crypto.randomUUID() + '.wav');
  fs.writeFileSync(tmp, wav);
  try {
    return execFileSync('ffmpeg', ['-loglevel', 'error', '-i', tmp, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse', '-ac', '1', '-b:a', '96k', '-f', 'mp3', 'pipe:1'], { maxBuffer: 20 * 1024 * 1024 });
  } finally { fs.rmSync(tmp, { force: true }); }
}

async function say(req, res, ip) {
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 4000) return send(res, 413, { message: '문장이 너무 길어요.' }); }
  let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { message: '잘못된 요청이에요.' }); }
  const text = clean(body.text), cfg = (table[String(body.model)] || {})[Number(body.voice) || 0];
  if (!cfg) return send(res, 404, { message: '이 목소리는 아직 문장 듣기를 준비하고 있어요.' });
  if (!text) return send(res, 400, { message: '들어 볼 문장을 적어 주세요.' });
  if ([...text].length > LIMIT.chars) return send(res, 400, { message: `${LIMIT.chars}자까지 들을 수 있어요.` });
  const id = crypto.createHash('sha256').update(JSON.stringify([cfg, text])).digest('hex').slice(0, 32);
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, id + '.mp3');
  if (!fs.existsSync(file)) {
    roll();
    const used = tally.ip[ip] || 0;
    if (used >= LIMIT.perIpDay) return send(res, 429, { message: `오늘은 ${LIMIT.perIpDay}번까지 들을 수 있어요. 더 필요하면 문의 글에 문장을 적어 주세요.` });
    if (tally.chars + [...text].length > LIMIT.allDayChars) return send(res, 429, { message: '오늘 만들 수 있는 양을 다 썼어요. 문의 글에 문장을 적어 주시면 만들어 드릴게요.' });
    tally.ip[ip] = used + 1; tally.chars += [...text].length;
    try { fs.writeFileSync(file, await tts(cfg, text)); } catch (e) { tally.ip[ip] -= 1; tally.chars -= [...text].length; console.error('say', e.message); return send(res, e.status || 500, { message: e.message && /[가-힣]/.test(e.message) ? e.message : '목소리를 만들지 못했어요.' }); }
    console.log(new Date().toISOString(), 'say', body.model, body.voice, [...text].length + '자', '오늘', tally.chars + '자');
  }
  const buf = fs.readFileSync(file);
  res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': buf.length, 'cache-control': 'private, max-age=86400' });
  res.end(buf);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
function file(req, res, pathname) {
  const site = path.join(here, 'site');
  let p;
  try { p = decodeURIComponent(pathname); } catch { return send(res, 400, { message: '잘못된 요청 주소예요.' }); }
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(site, p));
  if (!f.startsWith(site + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile() || f.includes('artifact-accounts')) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) res.setHeader('access-control-allow-origin', origin), res.setHeader('vary', 'origin');
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, { message: '잘못된 요청 주소예요.' }); }
  if (url.pathname === '/api/say') {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' }); res.end(); return; }
    if (req.method !== 'POST') return send(res, 405, { message: 'POST만 받아요.' });
    const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    say(req, res, ip).catch((e) => { console.error(e); if (!res.headersSent) send(res, 500, { message: '목소리를 만들지 못했어요.' }); });
    return;
  }
  if (req.method === 'GET') return file(req, res, url.pathname);
  send(res, 405, { message: '지원하지 않는 요청이에요.' });
});
if (require.main === module) {
  // 목소리를 새로 고르면(voices.json) 다시 켜지 않아도 표를 바꾼다
  fs.watchFile(path.join(here, 'voices.json'), { interval: 5000 }, () => { try { table = voiceTable(); } catch { /* 고치는 중 */ } });
  server.listen(PORT, '127.0.0.1', () => console.log(`say 서버 http://127.0.0.1:${PORT}/  목소리 ${Object.entries(table).map(([c, v]) => c + ':' + Object.keys(v).length).join(' ') || '없음'}  한도 ${JSON.stringify(LIMIT)}`));
}
module.exports = { server, voiceTable, clean, LIMIT };
