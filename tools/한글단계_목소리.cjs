'use strict';
// 한글 단계 · Typecast 목소리로 글자 소리 만들기(2026-10-03 유호님 「다이브 말고 타입캐스트로 바꿨어」 「타입케스트는 결재했거든」).
// LAB 한글날 편 음성/voice-connection.cjs와 같은 연결 방식이다.
//   node tools/한글단계_목소리.cjs [--voice tc_… --name 이름]   → http://127.0.0.1:5241 에서 유호님이 기존 Typecast API 키를 붙여 넣는다.
//   키는 이 프로세스 메모리에만 2시간 머물고 파일·채팅에 남지 않는다. 결제·충전·키 생성 기능은 없고, 월 제공 크레딧이 모자라면 멈춘다.
//   목소리 고르기: http://127.0.0.1:5241/compare — 후보(experiences/hangul-stage/qa/voice-candidates.json)의 공식 미리듣기와,
//     연결 뒤 POST /generate {"compare":true}로 만든 같은 글자 8개(아·어·오·으·애·에·가·나무)를 목소리마다 나란히 듣는다.
//   만들기(이 컴퓨터의 명령만): POST /voice {"id":"tc_…"}로 고른 목소리 → POST /generate {"sample":true}로 8개를 만들어
//     한 개당 크레딧 쓰임을 재고 → {"all":true}로 나머지.
//   node tools/한글단계_목소리.cjs --approve "유호님 10-0X 귀 확인" → 후보 목록을 앱이 쓰는 voices.json으로 옮긴다.
// 원본 wav와 비교용 소리는 저장소 밖(Documents/synk-vendor/hangul-voice/), 화면용 mp3는 experiences/hangul-stage/assets/voice/.
// 만든 목록은 voices.candidate.json에 적고, 앱은 voices.json의 approved:true만 쓴다(09-19 결정 「귀로 확인한 파일만」).
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const repo = path.resolve(__dirname, '..');
const stage = path.join(repo, 'experiences', 'hangul-stage');
const voiceDir = path.join(stage, 'assets', 'voice');
const vendor = path.join(os.homedir(), 'Documents', 'synk-vendor', 'hangul-voice');
const rawDir = path.join(vendor, 'raw'), compareDir = path.join(vendor, 'compare');
const CANDIDATE = path.join(voiceDir, 'voices.candidate.json'), APPROVED = path.join(voiceDir, 'voices.json');
const port = 5241, origin = 'http://127.0.0.1:' + port, nonce = crypto.randomBytes(24).toString('hex');
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const CANDIDATES = readJson(path.join(stage, 'qa', 'voice-candidates.json'), { voices: [] }).voices;
const VOICE_ID = /^tc_[0-9a-f]{24}$/;
// 기본 목소리: 서현(LAB 카페 상황극 09-26 「전보다 훨씬 낫다」, 한글날 편 10-03에 유호님이 고른 여자 목소리). --voice나 POST /voice로 바꾼다.
let VOICE = { id: arg('--voice') || 'tc_69f2e455ea79fd197aa0476f', name: arg('--name') || '서현' };
// 글자 소리는 감정을 싣지 않고 또박또박, 조금 천천히.
const SETTINGS = { model: 'ssfm-v30', emotion: 'normal', intensity: 1.0, tempo: 0.9, seed: 1003 };
const SAMPLE = ['아', '어', '오', '으', '애', '에', '가', '나무'];
const safe = text => [...text].map(ch => ch.codePointAt(0).toString(36)).join('');
const ffmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { return path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe'); } })();

async function loadClips() {
  const { createPack } = await import(pathToFileURL(path.join(stage, 'pack.mjs')).href);
  const layer = JSON.parse(fs.readFileSync(path.join(repo, 'strata', 'hangul.json'), 'utf8'));
  return createPack(layer).audioManifest().clips;
}

// 승인: 후보 목록을 그대로 voices.json으로(파일은 같은 것). 유호님이 귀로 확인했다고 말한 뒤에만 부른다.
if (process.argv.includes('--approve')) {
  const note = arg('--approve');
  const candidate = readJson(CANDIDATE, null);
  if (!candidate || !Object.keys(candidate.clips || {}).length) throw Error('후보 목록이 없다: 먼저 만들기');
  if (!note) throw Error('누가 언제 귀로 확인했는지 적는다: --approve "유호님 10-03 귀 확인"');
  for (const file of Object.values(candidate.clips)) if (!fs.existsSync(path.join(voiceDir, file))) throw Error('파일 없음: ' + file);
  fs.writeFileSync(APPROVED, JSON.stringify({ ...candidate, approved: true, approvedNote: note, approvedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`voices.json 승인: ${Object.keys(candidate.clips).length}개 (${note})`);
  process.exit(0);
}

let key = '', account = null, busy = false, expiresAt = null, expiryTimer, clips = [];
// 한 개당 크레딧 쓰임은 다시 켜도 이어 쓴다(후보 목록에 적어 둔 값).
let meter = readJson(CANDIDATE, {}).credits || null;
const forget = () => { key = ''; account = null; expiresAt = null; clearTimeout(expiryTimer); };
const api = async (route, method = 'GET', body, candidate = key) => {
  const response = await fetch('https://api.typecast.ai' + route, { method, headers: { 'X-API-KEY': candidate, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw Error('Typecast HTTP ' + response.status);
  return response.json();
};
const credits = sub => { const c = sub?.credits; if (!Number.isFinite(c?.plan_credits) || !Number.isFinite(c?.used_credits)) throw Error('월 제공 크레딧 잔량을 확인할 수 없습니다.'); return { plan: c.plan_credits, used: c.used_credits, left: c.plan_credits - c.used_credits }; };
const done = text => fs.existsSync(path.join(voiceDir, safe(text) + '.mp3'));
const pending = () => clips.filter(t => !done(t));
const compared = (id, text) => fs.existsSync(path.join(compareDir, id, safe(text) + '.mp3'));
const reply = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const measure = async (run) => {
  const before = credits(await api('/v1/users/me/subscription'));
  const count = await run(before);
  const after = credits(await api('/v1/users/me/subscription')), spent = after.used - before.used;
  if (count) meter = { plan: after.plan, left: after.left, spent: (meter?.spent || 0) + spent, clips: (meter?.clips || 0) + count,
    perClip: +(((meter?.spent || 0) + spent) / ((meter?.clips || 0) + count)).toFixed(2), at: new Date().toISOString() };
  return { spent, left: after.left };
};

// 한 개 만들기: Typecast wav → 앞뒤 무음을 걷고 끝에 짧은 여백을 둔 64k mp3.
async function makeOne(text, voice, outDir, wavDir) {
  const request = { seed: SETTINGS.seed, model: SETTINGS.model, voice_id: voice.id, text, language: 'kor',
    output: { audio_format: 'wav', audio_tempo: SETTINGS.tempo, target_lufs: -17 },
    prompt: { emotion_type: 'preset', emotion_preset: SETTINGS.emotion, emotion_intensity: SETTINGS.intensity } };
  const data = await api('/v1/text-to-speech/with-timestamps', 'POST', request);
  const bytes = Buffer.from(data.audio || '', 'base64');
  if (bytes.length < 1000) throw Error('빈 음성: ' + text);
  fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(wavDir, { recursive: true });
  const raw = path.join(wavDir, safe(text) + '.wav');
  fs.writeFileSync(raw, bytes);
  const out = path.join(outDir, safe(text) + '.mp3');
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', raw, '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse,apad=pad_dur=0.08',
    '-ac', '1', '-ar', '44100', '-b:a', '64k', out]);
  return { text, file: path.basename(out), duration: data.audio_duration ?? null };
}
function writeCandidate(made) {
  const prev = readJson(CANDIDATE, { clips: {}, made: {} });
  const next = { voice: { provider: 'Typecast', name: VOICE.name, id: VOICE.id }, settings: SETTINGS, approved: false,
    note: '후보다. 유호님이 voice-check.html에서 귀로 확인한 뒤 tools/한글단계_목소리.cjs --approve로 voices.json에 옮긴다.',
    clips: { ...prev.clips }, made: { ...(prev.made || {}) }, credits: meter };
  for (const m of made) { next.clips[m.text] = m.file; next.made[m.text] = { at: new Date().toISOString(), duration: m.duration }; }
  next.clips = Object.fromEntries(Object.entries(next.clips).sort(([a], [b]) => a.localeCompare(b, 'ko')));
  fs.writeFileSync(CANDIDATE, JSON.stringify(next, null, 2) + '\n');
}
// 한 목소리로만: 다른 목소리로 만든 후보가 남아 있으면 섞지 않는다. restart면 그 후보를 지우고 새로 시작한다.
function guardOneVoice(restart) {
  const prev = readJson(CANDIDATE, null);
  if (!prev || prev.voice?.id === VOICE.id) return;
  if (!restart) throw Error(`이미 ${prev.voice?.name} 목소리로 만든 후보가 있다. 새 목소리로 바꾸려면 {"restart":true}`);
  for (const file of Object.values(prev.clips || {})) fs.rmSync(path.join(voiceDir, file), { force: true });
  fs.rmSync(CANDIDATE, { force: true });
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const connectPage = () => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>한글 단계 · Typecast 목소리 연결</title><style>body{font:17px/1.65 system-ui;color:#171717;background:#fff;max-width:600px;margin:40px auto;padding:24px}h1{font-size:28px;line-height:1.3}p{color:#444}label{display:block;font-weight:650}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border-radius:10px;margin:8px 0;border:1px solid #bbb}button{background:#111;color:#fff;border:0;cursor:pointer}a{color:#a43d36}.box{background:#fef0e9;border-radius:12px;padding:16px}small{color:#666}#state{font-weight:650}</style></head><body><h1>한글 단계<br>Typecast 목소리 연결</h1><p>한글 단계의 글자·음절·낱말 소리를 Typecast 목소리 하나로 만듭니다. 목소리 후보는 <a href="/compare">비교 화면</a>에서 들어 볼 수 있어요.</p><div class="box">지금 고른 목소리: ${esc(VOICE.name)} · 소리 ${clips.length}개 · 모두 ${clips.reduce((n, t) => n + t.length, 0)}자</div><p><a href="https://studio.typecast.ai/developers/api" target="_blank" rel="noreferrer">Typecast 로그인 · 기존 API 키 확인 ↗</a></p><p>기존 Typecast 계정으로 로그인해 API 키를 복사한 뒤 아래에 붙여 넣어 주세요. 구글 로그인은 평소 크롬에서 여는 편이 좋습니다.</p><form id="form"><label for="key">기존 Typecast API 키</label><input id="key" type="password" autocomplete="off" required><button id="connect">연결 확인</button></form><p id="state" role="status">연결 대기 중</p><small>키는 이 컴퓨터의 임시 연결에만 보관하고 파일·채팅에 저장하지 않습니다. 2시간 뒤 잊습니다. 기존 월 제공 크레딧이 충분한지 확인하며 새 결제나 충전을 하지 않습니다.</small><script nonce="${nonce}">document.querySelector('#form').onsubmit=async event=>{event.preventDefault();const input=document.querySelector('#key'),value=input.value;input.value='';const state=document.querySelector('#state'),button=document.querySelector('#connect');button.disabled=true;state.textContent='연결과 잔량을 확인하고 있어요…';try{const response=await fetch('/connect',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':'${nonce}'},body:JSON.stringify({key:value})});const data=await response.json();state.textContent=response.ok?'연결됐습니다. Claude에게 “연결했어”라고 알려 주세요.':data.error;}catch{state.textContent='연결을 확인하지 못했습니다. 다시 시도해 주세요.'}finally{button.disabled=false;}};</script></body></html>`;

// 목소리 비교: 공식 미리듣기(각 목소리의 소개 음원) + 같은 글자 8개를 목소리마다.
const comparePage = () => {
  const card = v => {
    const have = SAMPLE.filter(t => compared(v.id, t));
    const buttons = SAMPLE.map(t => `<button class="clip" ${compared(v.id, t) ? `data-src="/sample/${v.id}/${safe(t)}.mp3"` : 'disabled'}>${esc(t)}</button>`).join('');
    return `<section><div class="head"><h2>${esc(v.name)}${v.id === VOICE.id ? ' <span class="now">지금 고른 목소리</span>' : ''}</h2><button class="all" ${have.length ? '' : 'disabled'}>8개 이어 듣기</button></div>
      <p>${esc(v.why || '')}</p><p class="meta">음높이 ${v.f0}Hz · 밝기 ${v.centroid}Hz · ${esc((v.uses || []).map(u => u.split('/')[0]).join('·'))}</p>
      <p class="label">공식 미리듣기</p><audio controls preload="none" src="${esc(v.preview)}"></audio>
      <p class="label">한글 단계 글자 ${have.length ? '' : '(연결 뒤 만들면 들을 수 있어요)'}</p><div class="row">${buttons}</div></section>`;
  };
  const anySample = CANDIDATES.some(v => SAMPLE.some(t => compared(v.id, t)));
  const byText = anySample ? `<section><h2>같은 글자를 목소리마다</h2><table><tr><th></th>${CANDIDATES.map(v => `<th>${esc(v.name)}</th>`).join('')}</tr>${SAMPLE.map(t => `<tr><th>${esc(t)}</th>${CANDIDATES.map(v => `<td><button class="clip" ${compared(v.id, t) ? `data-src="/sample/${v.id}/${safe(t)}.mp3"` : 'disabled'}>▶</button></td>`).join('')}</tr>`).join('')}</table></section>` : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>한글 단계 · 목소리 비교</title><style>
  body{font:16px/1.6 system-ui;color:#2b2320;background:#fbf7f0;margin:0}main{max-width:820px;margin:0 auto;padding:24px 16px 48px}h1{font-size:26px;margin:0 0 6px}h2{font-size:19px;margin:0}
  p{margin:4px 0;color:#575046}.meta{font-size:13px;color:#6b645b}.label{font-weight:700;margin-top:10px}section{background:#fffdf8;border-radius:16px;padding:16px;margin-top:14px;box-shadow:0 8px 20px -14px rgba(73,45,30,.4)}
  .head{display:flex;justify-content:space-between;align-items:center;gap:8px}.now{font-size:12px;background:#fef0e9;color:#ae322a;border-radius:999px;padding:2px 8px;margin-left:6px}
  audio{width:100%;margin-top:4px}.row{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.clip{min-width:52px;min-height:44px;border:1px solid #e2d9cb;border-radius:12px;background:#fff;font:800 20px/1 system-ui;cursor:pointer}
  .clip:disabled{opacity:.35;cursor:default}.clip.playing{border-color:#f96859;color:#ae322a}.all{border:0;border-radius:999px;padding:8px 14px;background:#2b2320;color:#fff;font:700 13px/1 system-ui;cursor:pointer}.all:disabled{opacity:.35}
  table{border-collapse:separate;border-spacing:6px;margin-top:8px}th{font-size:14px;color:#6b645b}</style></head><body><main>
  <h1>한글 단계 · 목소리 비교</h1><p>밝은 쪽 한국어 여자 목소리 후보 ${CANDIDATES.length}명입니다(서현은 기준). 공식 미리듣기는 바로 들을 수 있고, 한글 단계 글자 8개(아·어·오·으·애·에·가·나무)는 Typecast를 연결한 뒤 만들면 여기서 나란히 들립니다. 마음에 드는 목소리 이름을 Claude에게 알려 주세요.</p>
  <p class="meta">후보 고른 방법: Typecast 한국어 여자 목소리 66개의 공식 미리듣기에서 음높이·밝기·억양 폭·빠르기를 재서 밝은 쪽을 골랐고, 아이·캐릭터처럼 높은 쪽은 뺐습니다. 귀로 듣는 판단을 대신하지 않습니다.</p>
  ${CANDIDATES.map(card).join('')}${byText}</main>
  <script nonce="${nonce}">let cur=null;const play=b=>new Promise(r=>{if(cur){cur.a.pause();cur.b.classList.remove('playing')}const a=new Audio(b.dataset.src);cur={a,b};b.classList.add('playing');const end=()=>{b.classList.remove('playing');r()};a.onended=end;a.onerror=end;a.play().catch(end)});
  document.querySelectorAll('.clip[data-src]').forEach(b=>b.onclick=()=>play(b));
  document.querySelectorAll('section').forEach(s=>{const all=s.querySelector('.all');if(all)all.onclick=async()=>{for(const b of s.querySelectorAll('.row .clip[data-src]')){await play(b);await new Promise(r=>setTimeout(r,350))}}});</script></body></html>`;
};

(async () => {
  clips = await loadClips();
  for (const d of [rawDir, compareDir, voiceDir]) fs.mkdirSync(d, { recursive: true });
  http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== '127.0.0.1:' + port) return reply(res, 403, { error: 'Host rejected' });
      if (req.method === 'GET' && req.url === '/status') return reply(res, 200, { project: 'synk-hangul-stage-voice', voice: VOICE, connected: !!key, busy, completed: clips.length - pending().length, total: clips.length,
        compared: Object.fromEntries(CANDIDATES.map(v => [v.name, SAMPLE.filter(t => compared(v.id, t)).length])), plan: account?.plan || null, credits: meter, expiresAt });
      if (req.method === 'GET' && (req.url === '/' || req.url === '/connect' || req.url === '/compare')) {
        const isCompare = req.url === '/compare';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; media-src 'self' https://static2.typecast.ai; form-action 'self'; frame-ancestors 'none'` });
        return res.end(isCompare ? comparePage() : connectPage());
      }
      const sample = req.method === 'GET' && /^\/sample\/(tc_[0-9a-f]{24})\/([0-9a-z]+\.mp3)$/.exec(req.url);
      if (sample) {
        if (!CANDIDATES.some(v => v.id === sample[1])) return reply(res, 404, { error: 'Not found' });
        const file = path.join(compareDir, sample[1], sample[2]);
        if (!fs.existsSync(file)) return reply(res, 404, { error: 'Not found' });
        const data = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
        return res.end(data);
      }
      if (req.method !== 'POST') return reply(res, 404, { error: 'Not found' });
      if (req.headers.origin && req.headers.origin !== origin) return reply(res, 403, { error: 'Origin rejected' });
      if (req.url === '/connect' && req.headers['x-local-token'] !== nonce) return reply(res, 403, { error: 'Form token required' });
      if (req.url !== '/connect' && req.headers.origin) return reply(res, 403, { error: 'Local CLI only' });
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 16000) throw Error('Request too large'); }
      const body = JSON.parse(raw || '{}');
      if (req.url === '/connect') {
        if (typeof body.key !== 'string' || body.key.trim().length < 10) throw Error('기존 API 키를 확인해 주세요.');
        const candidate = body.key.trim(), sub = await api('/v1/users/me/subscription', 'GET', null, candidate);
        if (credits(sub).left < 1000) throw Error('기존 월 제공 크레딧이 부족합니다. 추가 결제 없이 중단했습니다.');
        forget(); key = candidate; account = { plan: sub.plan }; expiresAt = new Date(Date.now() + 7200000).toISOString();
        expiryTimer = setTimeout(forget, 7200000); expiryTimer.unref();
        return reply(res, 200, { connected: true });
      }
      if (req.url === '/disconnect') { forget(); return reply(res, 200, { connected: false }); }
      if (req.url === '/voice') {
        if (!VOICE_ID.test(body.id || '')) throw Error('목소리 id를 확인해 주세요.');
        const known = CANDIDATES.find(v => v.id === body.id);
        const info = key ? await api('/v3/voices/' + body.id) : null;
        const emotions = info?.models?.find(m => m.version === SETTINGS.model)?.emotions || known?.emotions || null;
        if (info && !emotions?.includes(SETTINGS.emotion)) throw Error(`이 목소리는 ${SETTINGS.model}의 ${SETTINGS.emotion} 감정을 지원하지 않습니다.`);
        VOICE = { id: body.id, name: known?.name || info?.voice_name?.kor || body.name || body.id };
        return reply(res, 200, { voice: VOICE });
      }
      if (req.url === '/generate') {
        if (!key) throw Error('먼저 연결해 주세요.');
        if (busy) throw Error('만드는 중');
        busy = true;
        try {
          if (body.compare) {
            const todo = CANDIDATES.flatMap(v => SAMPLE.filter(t => body.force || !compared(v.id, t)).map(t => ({ v, t })));
            const result = await measure(async () => { for (const { v, t } of todo) await makeOne(t, v, path.join(compareDir, v.id), path.join(compareDir, v.id, 'wav')); return todo.length; });
            return reply(res, 200, { made: todo.length, ...result, perClip: meter?.perClip ?? null });
          }
          guardOneVoice(!!body.restart);
          const list = body.sample ? SAMPLE.filter(t => clips.includes(t) && (body.force || !done(t))) : body.all ? pending() : [];
          if (!list.length) return reply(res, 200, { made: 0, completed: clips.length - pending().length, total: clips.length });
          // 전부 만들기는 먼저 잰 한 개당 쓰임으로 어림해, 남은 월 크레딧의 10%를 넘으면 멈추고 묻는다.
          if (body.all) {
            if (!meter?.perClip) throw Error('먼저 {"sample":true}나 {"compare":true}로 한 개당 쓰임을 잰다.');
            const left = credits(await api('/v1/users/me/subscription')).left, estimate = Math.ceil(meter.perClip * list.length * 1.2);
            if (estimate > left * 0.1 && !body.confirmed) throw Error(`어림 ${estimate} 크레딧(남은 ${left}의 10% 넘음) — 유호님 확인 뒤 {"all":true,"confirmed":true}`);
          }
          const made = [];
          const result = await measure(async () => { for (const text of list) made.push(await makeOne(text, VOICE, voiceDir, rawDir)); return made.length; });
          writeCandidate(made);
          return reply(res, 200, { made: made.length, ...result, perClip: meter?.perClip ?? null, voice: VOICE.name, completed: clips.length - pending().length, total: clips.length });
        } finally { busy = false; }
      }
      return reply(res, 404, { error: 'Not found' });
    } catch (error) { reply(res, 400, { error: error.message }); }
  }).listen(port, '127.0.0.1', () => console.log(`한글 단계 목소리 연결: ${origin} (목소리 ${VOICE.name}, 소리 ${clips.length}개, 비교 후보 ${CANDIDATES.length}명)`));
})();
