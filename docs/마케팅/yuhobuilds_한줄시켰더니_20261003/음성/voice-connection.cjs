'use strict';
// yuhobuilds 「AI한테 한 줄 시켰더니」 · Typecast 유호님 학습 목소리(커스텀 보이스, uc_…) 연결.
// LAB 한글날 편 음성/voice-connection.cjs와 같은 방식이다.
// 실행: node 음성/voice-connection.cjs → http://127.0.0.1:5213 에서 유호님이 기존 Typecast API 키를 붙여 넣는다.
// 키는 이 프로세스 메모리에만 4시간 머물고 파일·채팅에 남지 않는다. 월 제공 크레딧이 부족하면 멈춘다. 결제·충전·키 생성 기능은 없다.
// 2026-10-03 유호님 「타입캐스트로 재학습시켜서 알려줄래?」 → POST /clone {"file":"<음성 폴더 안 wav>","name":"유호"}로 퀵 클로닝(5~150초)을 한 번 만든다.
// 연결하면 계정의 커스텀 보이스 목록(이름·상태·모델, 키 없음)을 음성/custom-voices.json에 적는다.
// 생성: 로컬 명령만 POST /generate {"id":"h1"} (브라우저 요청은 막는다). 결과 음성/audio/<id>.wav·<id>.json(낱말별 시각)
// voice-plan.json은 요청마다 다시 읽는다. 목소리 id가 "auto"면 완료된 커스텀 보이스가 하나일 때 그걸 쓴다.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = __dirname, port = 5213, origin = 'http://127.0.0.1:' + port, nonce = crypto.randomBytes(24).toString('hex');
const KEEP_MS = 4 * 3600000;
const planFile = path.join(root, 'voice-plan.json');
const readPlan = () => JSON.parse(fs.readFileSync(planFile, 'utf8'));
const audio = path.join(root, 'audio'); fs.mkdirSync(audio, { recursive: true });
let key = '', account = null, busy = false, expiresAt = null, expiryTimer, customVoices = [], lastTried = {};
const pending = (plan) => plan.segments.filter((s) => !fs.existsSync(path.join(audio, s.id + '.json')));
const forget = () => { key = ''; account = null; expiresAt = null; clearTimeout(expiryTimer); };
const api = async (route, method = 'GET', body, candidate = key) => {
  const response = await fetch('https://api.typecast.ai' + route, { method, headers: { 'X-API-KEY': candidate, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
  if (!response.ok) {
    let detail = ''; try { detail = (await response.text()).slice(0, 300); } catch {}
    const error = Error('Typecast HTTP ' + response.status + (detail ? ' · ' + detail : '')); error.status = response.status; throw error;
  }
  return response.json();
};
const cloneVoice = async (file, name) => {
  const bytes = fs.readFileSync(file);
  if (bytes.length > 25 * 1024 * 1024) throw Error('학습 파일이 25MB를 넘는다');
  const tryRoute = async (route) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: file.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav' }), path.basename(file));
    form.append('name', name);
    form.append('model', 'ssfm-v30');
    const response = await fetch('https://api.typecast.ai' + route, { method: 'POST', headers: { 'X-API-KEY': key }, body: form, signal: AbortSignal.timeout(300000) });
    const text = await response.text();
    return { status: response.status, ok: response.ok, text };
  };
  let r = await tryRoute('/v1/custom-voices/instant-clone');
  if (r.status === 404 || r.status === 405) r = await tryRoute('/v1/voices/clone');
  if (!r.ok) throw Error('Typecast 학습 HTTP ' + r.status + ' · ' + r.text.slice(0, 300));
  return JSON.parse(r.text);
};
const balance = (sub) => { const c = sub?.credits; if (!Number.isFinite(c?.plan_credits) || !Number.isFinite(c?.used_credits)) throw Error('월 제공 크레딧 잔량을 확인할 수 없습니다.'); return c.plan_credits - c.used_credits; };
const pickList = (raw) => Array.isArray(raw) ? raw : (raw?.items || raw?.voices || raw?.data || raw?.result || []);
const listVoices = async (candidate = key) => {
  const found = new Map(), tried = {};
  for (const route of ['/v1/custom-voices', '/v3/voices?voice_type=custom', '/v3/voices?voice_type=custom&model=ssfm-v30']) {
    try {
      const items = pickList(await api(route, 'GET', null, candidate));
      tried[route] = items.length;
      for (const v of items) {
        const id = v.voice_id || v.id; if (!id || found.has(id)) continue;
        const name = typeof v.name === 'string' ? v.name : (v.voice_name?.kor || v.voice_name?.eng || JSON.stringify(v.voice_name || ''));
        const model = v.model || (Array.isArray(v.models) ? v.models.map((m) => m.version).find((x) => x === 'ssfm-v30') || v.models[0]?.version : null);
        found.set(id, { voice_id: id, name, model, source: v.source || route, status: v.status || 'completed', voice_type: v.voice_type || null, emotions: Array.isArray(v.models) ? v.models.find((m) => m.version === model)?.emotions || null : null, created_at: v.created_at || null, error: v.error || null });
      }
    } catch (error) { tried[route] = 'error ' + (error.status || error.message); }
  }
  customVoices = [...found.values()];
  lastTried = tried;
  fs.writeFileSync(path.join(root, 'custom-voices.json'), JSON.stringify({ tried: lastTried, voices: customVoices }, null, 2));   // 키는 담지 않는다
  return customVoices;
};
const pickVoice = (plan, role) => {
  const want = plan.voices[role];
  if (!want) throw Error('목소리 역할 없음: ' + role);
  if (want.id && want.id !== 'auto') return { id: want.id, name: want.name, model: want.model };
  const done = customVoices.filter((v) => v.status === 'completed');
  if (done.length !== 1) throw Error('완료된 커스텀 보이스가 ' + done.length + '개라 고를 수 없습니다. voice-plan.json에 id를 적어 주세요: ' + done.map((v) => v.name + '=' + v.voice_id).join(', '));
  return { id: done[0].voice_id, name: done[0].name, model: done[0].model };
};
const reply = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const html = (plan) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>yuhobuilds · 유호님 목소리 연결</title><style>body{font:17px/1.65 system-ui;color:#171717;background:#fff;max-width:600px;margin:40px auto;padding:24px}h1{font-size:28px;line-height:1.3}p{color:#444}label{display:block;font-weight:650}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border-radius:10px;margin:8px 0;border:1px solid #bbb}button{background:#111;color:#fff;border:0;cursor:pointer}a{color:#8a6a00}.box{background:#fdf3d2;border-radius:12px;padding:16px}small{color:#666}#state{font-weight:650}</style></head><body><h1>yuhobuilds 영상<br>유호님 목소리 연결</h1><p>「AI한테 한 줄 시켰더니」 영상의 내레이션을 유호님 목소리로 만듭니다. 바탕화면 녹음 두 개(9/22·9/23)에서 유호님 말소리만 골라 타입캐스트에 새로 학습시킨 뒤(퀵 클로닝) 그 목소리로 대사를 만듭니다.</p><div class="box">대사 ${plan.segments.length}개 · 모두 ${plan.segments.reduce((n, s) => n + s.text.length, 0)}자</div><p><a href="https://typecast.ai/developers/api" target="_blank" rel="noreferrer">Typecast 로그인 · 기존 API 키 확인 ↗</a></p><p>Typecast에 로그인해 API 키를 복사한 뒤 아래에 붙여 넣어 주세요. 학습과 대사 생성은 연결 뒤 Claude가 이어서 합니다.</p><form id="form"><label for="key">기존 Typecast API 키</label><input id="key" type="password" autocomplete="off" required><button id="connect">연결 확인</button></form><p id="state" role="status">연결 대기 중</p><small>키는 이 컴퓨터의 임시 연결에만 보관하고 파일·채팅에 저장하지 않습니다. 4시간 뒤 잊습니다. 기존 월 제공 크레딧이 충분한지 확인하며 새 결제나 충전을 하지 않습니다.</small><script nonce="${nonce}">document.querySelector('#form').onsubmit=async event=>{event.preventDefault();const input=document.querySelector('#key'),value=input.value;input.value='';const state=document.querySelector('#state'),button=document.querySelector('#connect');button.disabled=true;state.textContent='연결과 잔량, 학습 목소리를 확인하고 있어요…';try{const response=await fetch('/connect',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':'${nonce}'},body:JSON.stringify({key:value})});const data=await response.json();state.textContent=response.ok?(data.voices?('연결됐습니다. 학습 목소리 '+data.voices+'개('+data.names.join(', ')+')를 찾았어요. Claude에게 “연결했어”라고 알려 주세요.'):'연결됐습니다. 이제 Claude가 녹음으로 목소리를 학습시킵니다. Claude에게 “연결했어”라고 알려 주세요.'):data.error;}catch{state.textContent='연결을 확인하지 못했습니다. 다시 시도해 주세요.'}finally{button.disabled=false;}};</script></body></html>`;
http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== '127.0.0.1:' + port) return reply(res, 403, { error: 'Host rejected' });
    if (req.method === 'GET' && req.url === '/status') { const plan = readPlan(); return reply(res, 200, { project: 'yuhobuilds-one-line-voice', connected: !!key, busy, completed: plan.segments.length - pending(plan).length, total: plan.segments.length, voices: customVoices.length, tried: lastTried, plan: account?.plan || null, expiresAt }); }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/connect')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'` });
      return res.end(html(readPlan()));
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
      const plan = readPlan();
      const required = pending(plan).reduce((n, s) => n + s.text.length + (s.previous || '').length + (s.next || '').length, 0);
      if (balance(sub) < Math.max(1000, required * 3)) throw Error('기존 월 제공 크레딧이 부족합니다. 추가 결제 없이 중단했습니다.');
      const voices = await listVoices(candidate);
      forget(); key = candidate; account = { plan: sub.plan }; expiresAt = new Date(Date.now() + KEEP_MS).toISOString();
      expiryTimer = setTimeout(forget, KEEP_MS); expiryTimer.unref();
      return reply(res, 200, { connected: true, voices: voices.length, names: voices.map((v) => v.name).slice(0, 8) });
    }
    if (req.url === '/disconnect') { forget(); return reply(res, 200, { connected: false }); }
    if (req.url === '/voices') {
      if (!key) throw Error('먼저 연결해 주세요.');
      const voices = await listVoices();
      const sub = await api('/v1/users/me/subscription');
      return reply(res, 200, { voices, remaining: balance(sub) });
    }
    if (req.url === '/clone') {
      if (!key) throw Error('먼저 연결해 주세요.');
      if (busy) throw Error('작업 진행 중');
      const file = path.resolve(root, String(body.file || ''));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) throw Error('학습 파일은 음성 폴더 안에 있어야 한다');
      const name = String(body.name || '유호').slice(0, 30);
      busy = true;
      try {
        const made = await cloneVoice(file, name);
        fs.writeFileSync(path.join(root, 'clone-result.json'), JSON.stringify({ ...made, file: path.basename(file), at: new Date().toISOString() }, null, 2));
        const voices = await listVoices();
        return reply(res, 200, { made, voices });
      } finally { busy = false; }
    }
    if (req.url === '/generate') {
      if (!key) throw Error('먼저 연결해 주세요.');
      if (busy) throw Error('합성 진행 중');
      const plan = readPlan();
      const segment = plan.segments.find((s) => s.id === body.id); if (!segment) throw Error('Unknown script segment');
      const file = path.join(audio, segment.id + '.json');
      if (fs.existsSync(file) && !body.force) return reply(res, 200, { cached: true, id: segment.id });
      busy = true;
      try {
        const sub = await api('/v1/users/me/subscription');
        if (balance(sub) < Math.max(250, segment.text.length * 4)) throw Error('기존 크레딧 부족');
        const voice = pickVoice(plan, segment.role);
        const preset = { emotion_type: 'preset', emotion_preset: segment.emotion || 'normal', emotion_intensity: segment.intensity ?? 1 };
        const prompt = segment.smart ? { emotion_type: 'smart', previous_text: segment.previous, next_text: segment.next } : preset;
        const request = { seed: body.seed || segment.seed || 1003, model: voice.model || plan.model, voice_id: voice.id, text: segment.text, language: 'kor', output: { audio_format: 'wav', audio_tempo: segment.tempo, target_lufs: -17 }, prompt };
        let data, fallback = false;
        try { data = await api('/v1/text-to-speech/with-timestamps', 'POST', request); }
        catch (error) {
          if (!segment.smart || !(error.status >= 400 && error.status < 500)) throw error;
          request.prompt = preset; fallback = true;           // 커스텀 보이스가 smart 감정을 받지 않으면 같은 문장을 preset으로
          data = await api('/v1/text-to-speech/with-timestamps', 'POST', request);
        }
        const bytes = Buffer.from(data.audio, 'base64');
        if (bytes.length < 1000 || !data.words?.length) throw Error('Invalid voice response');
        fs.writeFileSync(path.join(audio, segment.id + '.wav'), bytes);
        delete data.audio;
        fs.writeFileSync(file, JSON.stringify({ ...data, request, fallback, direction: segment.direction, voiceName: voice.name }, null, 2));
        return reply(res, 200, { id: segment.id, duration: data.audio_duration, words: data.words.length, fallback });
      } finally { busy = false; }
    }
    return reply(res, 404, { error: 'Not found' });
  } catch (error) { reply(res, 400, { error: error.message }); }
}).listen(port, '127.0.0.1', () => console.log('yuhobuilds voice connection ready at ' + origin));
