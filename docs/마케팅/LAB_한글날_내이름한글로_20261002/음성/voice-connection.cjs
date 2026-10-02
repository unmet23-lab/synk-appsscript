'use strict';
// LAB 한글날 편 · Typecast 서현 목소리 연결(LAB 카페 revision-v2/voice-connection.cjs와 같은 방식).
// 실행: node 음성/voice-connection.cjs → http://127.0.0.1:5212 에서 유호님이 기존 Typecast API 키를 붙여 넣는다.
// 키는 이 프로세스 메모리에만 2시간 머물고 파일·채팅에 남지 않는다. 월 제공 크레딧이 부족하면 멈춘다. 결제·충전·키 생성 기능은 없다.
// 생성: 연결 뒤 로컬에서 POST /generate {"id":"q1"} (브라우저가 아닌 로컬 명령만 허용). 결과 음성/audio/<id>.wav·<id>.json(단어별 시각)
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = __dirname, port = 5212, origin = 'http://127.0.0.1:' + port, nonce = crypto.randomBytes(24).toString('hex');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'voice-plan.json'), 'utf8'));
const audio = path.join(root, 'audio'); fs.mkdirSync(audio, { recursive: true });
let key = '', account = null, busy = false, expiresAt = null, expiryTimer;
const pending = () => plan.segments.filter((s) => !fs.existsSync(path.join(audio, s.id + '.json')));
const forget = () => { key = ''; account = null; expiresAt = null; clearTimeout(expiryTimer); };
const api = async (route, method = 'GET', body, candidate = key) => {
  const response = await fetch('https://api.typecast.ai' + route, { method, headers: { 'X-API-KEY': candidate, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw Error('Typecast HTTP ' + response.status);
  return response.json();
};
const balance = (sub) => { const c = sub?.credits; if (!Number.isFinite(c?.plan_credits) || !Number.isFinite(c?.used_credits)) throw Error('월 제공 크레딧 잔량을 확인할 수 없습니다.'); return c.plan_credits - c.used_credits; };
const reply = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const html = () => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LAB 한글날 · 서현 목소리 연결</title><style>body{font:17px/1.65 system-ui;color:#171717;background:#fff;max-width:600px;margin:40px auto;padding:24px}h1{font-size:28px;line-height:1.3}p{color:#444}label{display:block;font-weight:650}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border-radius:10px;margin:8px 0;border:1px solid #bbb}button{background:#111;color:#fff;border:0;cursor:pointer}a{color:#a43d36}.box{background:#fef0e9;border-radius:12px;padding:16px}small{color:#666}#state{font-weight:650}</style></head><body><h1>LAB 한글날 영상<br>서현 목소리 연결</h1><p>「이 이름, 누구일까요?」 영상에 LAB 카페 때 쓴 여자 성우 서현을 감정을 넣어 입힙니다.</p><div class="box">성우: 서현 · 대사 ${plan.segments.length}개 · 모두 ${plan.segments.reduce((n, s) => n + s.text.length, 0)}자</div><p><a href="https://studio.typecast.ai/developers/api" target="_blank" rel="noreferrer">Typecast 로그인 · 기존 API 키 확인 ↗</a></p><p>기존 Typecast 제작 계정으로 로그인해 API 키를 복사한 뒤 아래에 붙여 넣어 주세요.</p><form id="form"><label for="key">기존 Typecast API 키</label><input id="key" type="password" autocomplete="off" required><button id="connect">연결 확인</button></form><p id="state" role="status">연결 대기 중</p><small>키는 이 컴퓨터의 임시 연결에만 보관하고 파일·채팅에 저장하지 않습니다. 2시간 뒤 잊습니다. 기존 월 제공 크레딧이 충분한지 확인하며 새 결제나 충전을 하지 않습니다.</small><script nonce="${nonce}">document.querySelector('#form').onsubmit=async event=>{event.preventDefault();const input=document.querySelector('#key'),value=input.value;input.value='';const state=document.querySelector('#state'),button=document.querySelector('#connect');button.disabled=true;state.textContent='연결과 잔량을 확인하고 있어요…';try{const response=await fetch('/connect',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':'${nonce}'},body:JSON.stringify({key:value})});const data=await response.json();state.textContent=response.ok?'연결됐습니다. Claude에게 “연결했어”라고 알려 주세요.':data.error;}catch{state.textContent='연결을 확인하지 못했습니다. 다시 시도해 주세요.'}finally{button.disabled=false;}};</script></body></html>`;
http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== '127.0.0.1:' + port) return reply(res, 403, { error: 'Host rejected' });
    if (req.method === 'GET' && req.url === '/status') return reply(res, 200, { project: 'synk-lab-hangul-day-voice', connected: !!key, busy, completed: plan.segments.length - pending().length, total: plan.segments.length, plan: account?.plan || null, expiresAt });
    if (req.method === 'GET' && (req.url === '/' || req.url === '/connect')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'` });
      return res.end(html());
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
      const required = pending().reduce((n, s) => n + s.text.length + (s.previous || '').length + (s.next || '').length, 0);
      if (balance(sub) < Math.max(1000, required * 2)) throw Error('기존 월 제공 크레딧이 부족합니다. 추가 결제 없이 중단했습니다.');
      const info = {};
      for (const id of new Set(Object.values(plan.voices).map((v) => v.id))) info[id] = await api('/v3/voices/' + id, 'GET', null, candidate);
      fs.writeFileSync(path.join(root, 'voice-info.json'), JSON.stringify(info, null, 2));   // 목소리 정보(감정 목록 등). 키는 담지 않는다
      forget(); key = candidate; account = { plan: sub.plan }; expiresAt = new Date(Date.now() + 7200000).toISOString();
      expiryTimer = setTimeout(forget, 7200000); expiryTimer.unref();
      return reply(res, 200, { connected: true });
    }
    if (req.url === '/disconnect') { forget(); return reply(res, 200, { connected: false }); }
    if (req.url === '/generate') {
      if (!key) throw Error('먼저 연결해 주세요.');
      if (busy) throw Error('합성 진행 중');
      const segment = plan.segments.find((s) => s.id === body.id); if (!segment) throw Error('Unknown script segment');
      const file = path.join(audio, segment.id + '.json');
      if (fs.existsSync(file) && !body.force) return reply(res, 200, { cached: true, id: segment.id });
      busy = true;
      try {
        const sub = await api('/v1/users/me/subscription');
        if (balance(sub) < Math.max(250, segment.text.length * 4)) throw Error('기존 크레딧 부족');
        const voice = plan.voices[segment.role];
        const prompt = segment.smart ? { emotion_type: 'smart', previous_text: segment.previous, next_text: segment.next } : { emotion_type: 'preset', emotion_preset: segment.emotion, emotion_intensity: segment.intensity };
        const request = { seed: body.seed || 1003, model: plan.model, voice_id: voice.id, text: segment.text, language: 'kor', output: { audio_format: 'wav', audio_tempo: segment.tempo, target_lufs: -17 }, prompt };
        const data = await api('/v1/text-to-speech/with-timestamps', 'POST', request);
        const bytes = Buffer.from(data.audio, 'base64');
        if (bytes.length < 1000 || !data.words?.length) throw Error('Invalid voice response');
        fs.writeFileSync(path.join(audio, segment.id + '.wav'), bytes);
        delete data.audio;
        fs.writeFileSync(file, JSON.stringify({ ...data, request, direction: segment.direction, voiceName: voice.name }, null, 2));
        return reply(res, 200, { id: segment.id, duration: data.audio_duration, words: data.words.length });
      } finally { busy = false; }
    }
    return reply(res, 404, { error: 'Not found' });
  } catch (error) { reply(res, 400, { error: error.message }); }
}).listen(port, '127.0.0.1', () => console.log('LAB hangul-day voice connection ready at ' + origin));
