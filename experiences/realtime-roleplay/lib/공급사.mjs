// 공급사 연결 층 · 서버 쪽(2026-10-30 시제품) — 길마다 「세션 만들기」 하나만 다르다. 소리는 브라우저 ↔ 공급사가 바로 주고받고
// (OpenAI는 WebRTC, Gemini는 WebSocket), 서버는 세션 열기(키는 서버만 — OpenAI는 SDP 교환, Gemini는 1회용 임시 토큰)와
// 끝난 뒤 장부 · 피드백만 맡는다. 새 공급사는 여기 한 칸 + public/연결층.mjs 공급사표 한 줄.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 키로부르기 } from './오픈AI키.mjs';
import { 지시문, 첫인사지시 } from './장면.mjs';

const 바탕 = () => (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
// 학생에게 열 때는 계정마다 해시한 값을 싣는다. 시제품은 이 노트북 하나라 고정값.
const 안전아이디 = 'synk-realtime-roleplay-local-prototype';

// Gemini 무료 키(~/SYNK_보안/제미나이_무료.txt, env GEMINI_KEY_PATH_FREE)는 tools/모델정책.js가 읽는다 — 값은 찍지 않는다.
const 모델정책 = createRequire(import.meta.url)(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tools', '모델정책.js'));
const 제미나이바탕 = () => (process.env.SYNK_GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
// 임시 토큰은 v1beta 제한 소켓에서만 된다(문서 · 10-30 실측). 브라우저가 ?access_token=으로 붙는다.
export const 제미나이소켓 = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const 제미나이모델 = 'gemini-3.8-live';

/** Gemini Live setup — 토큰에 넣어 잠그고(브라우저가 무엇을 보내도 이 값이 이긴다, 10-30 실측) 브라우저에도 같은 값을 준다.
 *  END_SENSITIVITY_LOW · 침묵 1000ms는 듣기 시험에서 끼어듦 0이던 값. */
export function 제미나이설정(장면) {
  return {
    model: `models/${제미나이모델}`,
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 장면.상대.목소리['gemini-live'] } } } },
    systemInstruction: { parts: [{ text: 지시문(장면) }] },
    realtimeInputConfig: { automaticActivityDetection: { endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', silenceDurationMs: 1000 } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
}

export const 공급사들 = {
  'gemini-live': {
    이름: 'Gemini 3.8 Live',
    모델: 제미나이모델,
    운반: 'websocket',
    쓸수있나: () => !!모델정책.제미나이키('글'),
    async 세션만들기({ 장면 }) {
      const 키값 = 모델정책.제미나이키('글');
      if (!키값) throw Object.assign(new Error('Gemini 무료 키 파일이 없다'), { 상태: 503 });
      const 설정 = 제미나이설정(장면);
      const 지금 = Date.now();
      // 1회용 · 60초 안에 열기 · 장면 상한(4분)+여유 뒤에는 메시지도 못 보낸다. 표준 키는 머리로만 싣는다(주소에 남지 않게).
      const res = await fetch(`${제미나이바탕()}/auth_tokens`, {
        method: 'POST',
        headers: { 'x-goog-api-key': 키값, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uses: 1,
          newSessionExpireTime: new Date(지금 + 60e3).toISOString(),
          expireTime: new Date(지금 + (장면.상한초 + 180) * 1000).toISOString(),
          bidiGenerateContentSetup: 설정,
        }),
      });
      if (!res.ok) {
        const 글 = (await res.text()).split(키값).join('«키»');
        throw Object.assign(new Error(`Gemini 토큰 ${res.status}`), { 상태: res.status === 429 ? 429 : 502, 코드: res.status === 429 ? '몫' : '', 본문: 글.slice(0, 300) });
      }
      const 답 = await res.json();
      if (!/^auth_tokens\/\S+$/.test(답.name || '')) throw Object.assign(new Error('Gemini 토큰 꼴이 아니다'), { 상태: 502 });
      return { 세션: `gem_${randomBytes(9).toString('hex')}`, 토큰: 답.name, 소켓: 제미나이소켓, 설정, 키: 'Gemini 무료 키' };
    },
  },
  'gpt-live': {
    이름: 'GPT-Live',
    모델: 'gpt-live-1',
    운반: 'webrtc',
    async 세션만들기({ sdp, 장면 }) {
      const 몸 = JSON.stringify({
        session: {
          model: 'gpt-live-1',
          instructions: 지시문(장면),
          input: [{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: 첫인사지시(장면) }] }],
          audio: { output: { voice: 장면.상대.목소리['gpt-live'] } },
          delegation: { type: 'client' }, // null은 400(invalid_type) — 현장 노트 AI CLI
        },
        transport: { type: 'webrtc', sdp },
      });
      const { res, 키 } = await 키로부르기((v) => fetch(`${바탕()}/live/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json', 'OpenAI-Safety-Identifier': 안전아이디 },
        body: 몸,
      }));
      const 답 = await res.json();
      if (!답.transport?.sdp) throw Object.assign(new Error('GPT-Live 답에 SDP가 없다'), { 상태: 502 });
      return { 세션: 답.session?.id || null, sdp: 답.transport.sdp, 키 };
    },
  },
  'realtime-mini': {
    이름: 'Realtime 2.1 mini',
    모델: 'gpt-realtime-2.1-mini',
    운반: 'webrtc',
    async 세션만들기({ sdp, 장면 }) {
      const 설정 = JSON.stringify({
        type: 'realtime',
        model: 'gpt-realtime-2.1-mini',
        instructions: 지시문(장면),
        audio: {
          input: { turn_detection: { type: 'semantic_vad', eagerness: 'low' }, transcription: { model: 'gpt-4o-mini-transcribe', language: 'ko' } },
          output: { voice: 장면.상대.목소리['realtime-mini'] },
        },
      });
      const { res, 키 } = await 키로부르기((v) => {
        const fd = new FormData();
        fd.set('sdp', sdp);
        fd.set('session', 설정);
        return fetch(`${바탕()}/realtime/calls`, { method: 'POST', headers: { Authorization: `Bearer ${v}`, 'OpenAI-Safety-Identifier': 안전아이디 }, body: fd });
      });
      const 답 = await res.text();
      if (!/^v=0/m.test(답)) throw Object.assign(new Error('Realtime 답이 SDP가 아니다'), { 상태: 502 });
      return { 세션: res.headers.get('location')?.split('/').pop() || null, sdp: 답, 키 };
    },
  },
};

/** 글 상황극 · 피드백이 같이 쓰는 Responses 부르기 — 답 JSON과 쓴 키 */
export async function 응답부르기(본문) {
  const { res, 키 } = await 키로부르기((v) => fetch(`${바탕()}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...본문, safety_identifier: 안전아이디 }), // Responses는 머리가 아니라 몸통 칸
  }));
  return { 답: await res.json(), 키 };
}
