// 공급사 연결 층 · 서버 쪽(2026-10-30 시제품) — 길마다 「세션 만들기」 하나만 다르다. 소리는 WebRTC로 브라우저 ↔ 공급사가 바로 주고받고,
// 서버는 SDP 교환(키는 서버만)과 끝난 뒤 장부 · 피드백만 맡는다. 새 공급사는 여기 한 칸 + public/연결층.mjs 공급사표 한 줄.
import { 키로부르기 } from './오픈AI키.mjs';
import { 지시문, 첫인사지시 } from './장면.mjs';

const 바탕 = () => (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
// 학생에게 열 때는 계정마다 해시한 값을 싣는다. 시제품은 이 노트북 하나라 고정값.
const 안전아이디 = 'synk-realtime-roleplay-local-prototype';

export const 공급사들 = {
  'gpt-live': {
    이름: 'GPT-Live',
    모델: 'gpt-live-1',
    async 세션만들기({ sdp, 장면 }) {
      const 몸 = JSON.stringify({
        session: {
          model: 'gpt-live-1',
          instructions: 지시문(장면),
          input: [{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: 첫인사지시(장면) }] }],
          audio: { output: { voice: 장면.상대.목소리 } },
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
    async 세션만들기({ sdp, 장면 }) {
      const 설정 = JSON.stringify({
        type: 'realtime',
        model: 'gpt-realtime-2.1-mini',
        instructions: 지시문(장면),
        audio: {
          input: { turn_detection: { type: 'semantic_vad', eagerness: 'low' }, transcription: { model: 'gpt-4o-mini-transcribe', language: 'ko' } },
          output: { voice: 장면.상대.목소리 },
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
