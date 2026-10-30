// 공급사 연결 층 · 브라우저 쪽(2026-10-30 시제품). 화면은 이 파일의 `열기()`만 쓰고, 길(공급사)마다 다른 것은 아래 표 한 줄에 모은다.
// 공통 사건: '준비' · '자막'({번호, 누가:'상대'|'나', 글}) · '상태'(글) · '끝'({초, 사용, 끝확인}) · '오류'(글) · '끊김'(까닭)
// 운반 둘 — WebRTC(OpenAI: 소리 트랙 마이크 → 공급사 · 공급사 → <audio>, 자막 · 명령은 데이터 채널 「oai-events」),
// WebSocket(Gemini: 마이크를 16k PCM으로 보내고 24k PCM을 받아 예약 재생 → <audio>, 자막 · 명령은 같은 소켓). 키는 서버만 쥔다.

export const 공급사표 = {
  'gemini-live': {
    운반: 'websocket',
    // 한 메시지에 받아쓰기 · 자막 · interrupted가 함께 올 수 있어 여러 개를 돌려준다. e.응답(지금 답 번호) · e.활동(지금 학습자 말 번호)은 연결 층이 붙인다.
    // 학습자 받아쓰기는 말이 끝날 때 한 번에 와서(답 소리와 거의 같이) 말 시작(voiceActivity ACTIVITY_START)에 자리를 먼저 놓고 채운다.
    // 학습자 쉼에서 시작했다가 이어진 말에 끊긴 답(interrupted)은 그 소리와 자막을 버린다(Realtime의 취소와 같은 셈, 10-29 실측)
    자막: (e) => {
      const 나온 = [];
      const sc = e.serverContent || {};
      if (e.voiceActivity?.type === 'ACTIVITY_START') 나온.push({ 누가: '나', 자리: `말${e.활동}` });
      if (sc.inputTranscription?.text) 나온.push({ 누가: '나', 조각: sc.inputTranscription.text, ...(e.활동 ? { 붙임: `말${e.활동}` } : {}), ...(e.응답 != null ? { 앞에: e.응답 } : {}) });
      if (sc.outputTranscription?.text) 나온.push({ 누가: '상대', 조각: sc.outputTranscription.text, 응답: e.응답 });
      if (sc.interrupted && e.응답 != null) 나온.push({ 취소: e.응답 });
      return 나온;
    },
    첫인사: (글) => ({ clientContent: { turns: [{ role: 'user', parts: [{ text: 글 }] }], turnComplete: true } }),
    // turnComplete false — 소리 대화를 멈추지 않고 다음 답에 들어간다(10-30 실측). 답하는 중이면 연결 층이 그 답 끝 뒤로 미룬다
    마무리: (글) => ({ clientContent: { turns: [{ role: 'user', parts: [{ text: 글 }] }], turnComplete: false } }),
    // usageMetadata는 차례마다 온다(맥락이 쌓여 입력이 커진다) — 차례의 마지막 값을 더한다(듣기 시험 녹음.mjs와 같은 셈)
    사용더하기: (합, u) => {
      for (const d of u.promptTokensDetails || []) 합[d.modality === 'AUDIO' ? '음성입력' : '글입력'] += d.tokenCount || 0;
      for (const d of u.responseTokensDetails || []) 합[d.modality === 'AUDIO' ? '음성출력' : '글출력'] += d.tokenCount || 0;
      합.생각 += u.thoughtsTokenCount || 0;
      합.차례 += 1;
      return 합;
    },
    // 무료 몫(429)으로 닫혔나 — 「Token has been used too many times」(토큰 재사용)는 몫이 아니다
    몫인가: (까닭) => /quota|resource.?exhausted|rate.?limit|\b429\b/i.test(String(까닭 || '')),
  },
  'gpt-live': {
    운반: 'webrtc',
    준비: (e) => e.type === 'session.started',
    // 전이중이라 두 사람 자막이 겹쳐 자라고 차례 끝 표시가 없다 — 사람이 바뀌거나 같은 사람이 1.3초 넘게 쉬면 새 줄(세션 시각 ms로)
    자막: (e) => (e.type === 'session.output_transcript.delta' ? { 누가: '상대', 조각: e.delta, 시작: e.start_ms, 끝: e.end_ms }
      : e.type === 'session.input_transcript.delta' ? { 누가: '나', 조각: e.delta, 시작: e.start_ms, 끝: e.end_ms } : null),
    첫인사: (글) => ({ type: 'session.instructions.append', event_id: 'greet', delegation_id: null, content: 글 }),
    마무리: (글) => ({ type: 'session.instructions.append', event_id: 'wrap', delegation_id: null, content: 글 }),
    끝명령: () => ({ type: 'session.close', event_id: 'close' }),
    끝남: (e) => (e.type === 'session.closed' ? { 초: e.usage?.seconds ?? null } : null),
    사용갱신초: (e) => (e.type === 'session.usage.updated' && typeof e.usage?.seconds === 'number' ? e.usage.seconds : null), // 누적 값 — 더하지 않는다
    사용: () => null,
  },
  'realtime-mini': {
    운반: 'webrtc',
    준비: (e) => e.type === 'session.created',
    // 학습자 받아쓰기는 늦게 오므로 말이 시작된 자리(speech_started)에 빈 줄을 먼저 놓고 채운다
    // 학습자가 말 사이에 쉬면 답을 시작했다 취소(cancelled · turn_detected)하므로 그 응답의 자막은 지운다(10-29 실측)
    자막: (e) => (e.type === 'response.output_audio_transcript.delta' ? { 누가: '상대', 조각: e.delta, 응답: e.response_id }
      : e.type === 'input_audio_buffer.speech_started' ? { 누가: '나', 자리: e.item_id }
        : e.type === 'conversation.item.input_audio_transcription.completed' ? { 누가: '나', 채움: e.item_id, 글: e.transcript }
          : e.type === 'response.done' && e.response?.status === 'cancelled' ? { 취소: e.response.id } : null),
    첫인사: (글) => ({ type: 'response.create', response: { instructions: 글 } }),
    마무리: (글) => ({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: 글 }] } }),
    끝명령: () => null,
    끝남: () => null,
    사용갱신초: () => null,
    사용: (e) => (e.type === 'response.done' ? e.response?.usage || null : null), // 취소된 응답도 값이 든다
  },
};

function 사건통() {
  const 듣는이 = {};
  return {
    on(이름, f) { (듣는이[이름] ||= []).push(f); },
    내기(이름, 값) { for (const f of 듣는이[이름] || []) f(값); },
  };
}

/** 자막 줄 모으기 — 같은 사람이 이어 말하면 그 줄에 붙이고, 사람이 바뀌면 새 줄. 조각에 세션 시각(시작 ms)이 있으면
 *  늦게 도착한 조각(학습자 받아쓰기가 상대 답보다 늦게 옴)도 시각 순서 자리에 넣는다. 화면은 줄들 전체를 다시 그린다. */
export function 자막모음() {
  const 줄들 = [];
  return {
    줄들,
    넣기(s) {
      if (s.취소) {
        for (let i = 줄들.length - 1; i >= 0; i--) if (줄들[i].응답 === s.취소) 줄들.splice(i, 1);
        return 줄들.length - 1;
      }
      if (s.붙임 !== undefined) {
        // 말 시작에 놓아 둔 자리에 받아쓰기 조각을 이어 붙인다(Gemini) — 자리가 없으면 아래 길로
        const i = 줄들.findLastIndex((l) => l.자리 === s.붙임);
        if (i >= 0) { 줄들[i].글 += s.조각; return i; }
      }
      if (s.앞에 != null && s.누가 === '나') {
        // 말 시작 신호 없이 받아쓰기가 지금 답과 함께 오면(Gemini voiceActivity가 없는 판) 그 답 줄 앞에 둔다
        const i = 줄들.findLastIndex((l) => l.응답 === s.앞에);
        if (i >= 0) {
          const 앞 = 줄들[i - 1];
          if (앞 && 앞.누가 === '나' && !앞.자리) { 앞.글 += s.조각; return i - 1; }
          줄들.splice(i, 0, { 누가: '나', 글: s.조각 });
          return i;
        }
      }
      if (s.누가 === '상대' && s.응답 != null) {
        // 같은 답의 조각은 그 답 줄에 붙인다 — 사이에 학습자 자리(가짜 말 시작 포함)가 끼어도 답이 둘로 갈리지 않게
        const i = 줄들.findLastIndex((l) => l.응답 === s.응답);
        if (i >= 0) { 줄들[i].글 += s.조각; return i; }
      }
      if (s.자리) { 줄들.push({ 누가: '나', 글: '', 자리: s.자리 }); return 줄들.length - 1; }
      if (s.채움) {
        const i = 줄들.findIndex((l) => l.자리 === s.채움);
        if (i >= 0) { 줄들[i].글 = (s.글 || '').trim(); return i; }
        줄들.push({ 누가: '나', 글: (s.글 || '').trim() });
        return 줄들.length - 1;
      }
      const 끝 = 줄들[줄들.length - 1];
      const 이어짐 = (l) => l && l.누가 === s.누가 && !l.자리 && (s.응답 === undefined || l.응답 === s.응답)
        && !(typeof s.시작 === 'number' && typeof l.끝 === 'number' && s.시작 - l.끝 > 1300);
      const 붙이기 = (l) => { l.글 += s.조각; if (typeof s.끝 === 'number') l.끝 = Math.max(l.끝 ?? 0, s.끝); };
      if (이어짐(끝) && !(typeof s.시작 === 'number' && typeof 끝.시작 === 'number' && s.시작 < 끝.시작)) { 붙이기(끝); return 줄들.length - 1; }
      if (typeof s.시작 === 'number') {
        // 이 조각보다 늦게 시작한 줄들을 건너 올라가, 같은 사람 줄을 만나면 거기 붙이고 아니면 그 자리에 새 줄
        let 자리 = 줄들.length;
        while (자리 > 0 && typeof 줄들[자리 - 1].시작 === 'number' && 줄들[자리 - 1].시작 > s.시작) 자리--;
        const 앞 = 줄들[자리 - 1];
        if (이어짐(앞)) { 붙이기(앞); return 자리 - 1; }
        줄들.splice(자리, 0, { 누가: s.누가, 글: s.조각, 시작: s.시작, 끝: s.끝 });
        return 자리;
      }
      줄들.push({ 누가: s.누가, 글: s.조각, ...(s.응답 !== undefined ? { 응답: s.응답 } : {}) });
      return 줄들.length - 1;
    },
    보낼것() { return 줄들.map((l) => ({ 누가: l.누가, 글: l.글.trim() })).filter((l) => l.글); },
    /** 받아쓰기가 끝내 안 온 빈 자리(바탕 소리 · 메아리로 생긴 말 시작)를 지운다 — 새 말 시작 때 연결 층이 부른다 */
    빈자리지우기() { for (let i = 줄들.length - 1; i >= 0; i--) if (줄들[i].자리 && !줄들[i].글.trim()) 줄들.splice(i, 1); },
  };
}

async function 서버(주소, 몸) {
  const r = await fetch(주소, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(몸) });
  const j = await r.json().catch(() => ({}));
  return { 상태: r.status, ...j };
}

// 고장 찾기용 사건 기록(종류 · 시각 · 닫힘 까닭만 — 자막 글 · 토큰은 담지 않는다)
function 기록판() {
  const 기록 = (globalThis.__상황극기록 = []);
  return (종류, 덧 = {}) => { 기록.push({ 종류, t: Math.round(performance.now()), ...덧 }); if (기록.length > 400) 기록.shift(); };
}
// 끝 보고에 붙이는 사건 기록 꼬리 — 판이 왜 끝났는지 장부만 보고 알게(10-30 유호님 첫 판이 Gemini 준비 직후 0초에 끝났는데 까닭이 화면에만 있다 사라졌다)
const 기록꼬리 = () => (globalThis.__상황극기록 || []).slice(-30).map((x) => `${x.종류}${x.내용 ? `(${x.내용})` : ''}@${x.t}`);

/** 음성 길 열기. 입력트랙: 마이크나 시험용 Web Audio 트랙. 출력: <audio>. 길을 안 주면 서버의 예산 계량기가 고른다(MVP 기본 Gemini).
 *  서버에 먼저 길을 묻고(SDP 없이), WebRTC 길이면 서버가 428 {필요:'sdp'}로 알려 준 길로 SDP를 만들어 다시 부른다.
 *  Gemini가 준비 전에 실패하면(무료 몫 · 네트워크 · 거절 · 시한) 까닭을 장부에 남기고 한 번만 Gemini를 빼고 다시 연다 —
 *  몫이면 서버가 몫쉼(10분) 동안 Gemini를 건너뛴다. 길을 고정했으면(?길=) 넘기지 않는다. 반이중: 처음부터 하온이 말하는 동안 마이크를 쉰다(스피커용). */
export async function 열기({ 길, 입력트랙, 출력, 반이중 = false, 제외 }, 다시 = 0, 남기기 = 기록판()) {
  if (길 && 공급사표[길]?.운반 === 'webrtc') return 웹RTC열기(길, { 입력트랙, 출력, 남기기 });
  const 답 = await 서버('/api/연결', { 길, ...(제외 ? { 제외 } : {}) });
  if (답.상태 === 409 && 답.길 === '글') return { 길: '글', 계량: 답.계량, 넘김: 답.까닭 };
  if (답.상태 === 428 && 공급사표[답.길]?.운반 === 'webrtc') {
    const 연결 = await 웹RTC열기(답.길, { 입력트랙, 출력, 남기기 });
    if (답.까닭) 연결.넘김 = 답.까닭;
    return 연결;
  }
  if (답.상태 !== 201 || 공급사표[답.길]?.운반 !== 'websocket') throw new Error(답.오류 || `연결 실패(${답.상태})`);
  try {
    return await 소켓열기(답, { 입력트랙, 출력, 남기기, 반이중 });
  } catch (e) {
    if (길 || 다시) throw e;
    남기기(e.몫 ? '몫바닥' : '연결실패', { 내용: String(e.message).slice(0, 160) });
    await 서버('/api/넘김', { 세션: 답.세션, 까닭: e.message, 몫: !!e.몫 });
    const 연결 = await 열기({ 입력트랙, 출력, 제외: 'gemini-live' }, 다시 + 1, 남기기);
    연결.넘김 ||= e.몫 ? 'Gemini 무료 몫' : 'Gemini 연결 실패';
    return 연결;
  }
}

/** WebRTC 길(OpenAI) — 브라우저가 SDP 제안을 만들어 서버에 주면 서버가 공급사 세션을 열고(키는 서버만) 답 SDP를 돌려준다. */
async function 웹RTC열기(길, { 입력트랙, 출력, 남기기 }) {
  const 통 = 사건통();
  const 자막 = 자막모음();
  const pc = new RTCPeerConnection();
  const dc = pc.createDataChannel('oai-events');
  const 사용합 = { 음성입력: 0, 음성출력: 0, 글입력: 0, 글출력: 0, 캐시: 0 };
  let 표 = null;
  let 세션 = null;
  let 시작시각 = 0;
  let 끝받음 = null;
  let 마지막사용초 = null;
  let 닫힘 = false;
  let 첫인사 = '';

  pc.addEventListener('track', (e) => {
    출력.srcObject = new MediaStream([e.track]);
    출력.play().catch(() => 통.내기('상태', '소리가 막혔어요 — 화면을 한 번 눌러 주세요'));
  });
  pc.addTrack(입력트랙, new MediaStream([입력트랙]));
  pc.addEventListener('connectionstatechange', () => 남기기(`pc:${pc.connectionState}`));
  dc.addEventListener('open', () => 남기기('dc:open'));
  dc.addEventListener('close', () => 남기기('dc:close'));
  dc.addEventListener('message', ({ data }) => {
    let e;
    try { e = JSON.parse(data); } catch { return; }
    if (!/delta$/.test(e.type || '')) 남기기(e.type, e.type === 'error' || e.type === 'session.closed' ? { 내용: JSON.stringify(e).slice(0, 400) } : {});
    if (!표) return;
    if (표.준비(e)) {
      시작시각 = performance.now();
      // 소리 길(ICE)이 붙기 전에 첫 인사를 시키면 앞이 잘린다 — 붙을 때까지 최대 3초 기다린다
      (async () => {
        const 시작 = performance.now();
        while (pc.connectionState !== 'connected' && performance.now() - 시작 < 3000) await new Promise((r) => setTimeout(r, 50));
        if (첫인사 && dc.readyState === 'open') dc.send(JSON.stringify(표.첫인사(첫인사)));
        통.내기('준비', { 길: 결과.길 });
      })();
    }
    const 갱신 = 표.사용갱신초(e);
    if (갱신 !== null) 마지막사용초 = 갱신;
    const s = 표.자막(e);
    if (s) { const 번호 = 자막.넣기(s); 통.내기('자막', { 번호, ...(자막.줄들[번호] || {}), 누가: s.누가 }); }
    const u = 표.사용(e);
    if (u) {
      const 안 = u.input_token_details || {};
      const 캐시 = 안.cached_tokens_details || {};
      사용합.음성입력 += (안.audio_tokens || 0) - (캐시.audio_tokens || 0);
      사용합.글입력 += (안.text_tokens || 0) - (캐시.text_tokens || 0);
      사용합.캐시 += 안.cached_tokens || 0;
      사용합.음성출력 += u.output_token_details?.audio_tokens || 0;
      사용합.글출력 += u.output_token_details?.text_tokens || 0;
    }
    const 끝 = 표.끝남(e);
    if (끝) 끝받음 = 끝;
    if (e.type === 'error') 통.내기('오류', e.error?.message || '알 수 없는 오류');
  });

  await pc.setLocalDescription(await pc.createOffer());
  if (pc.iceGatheringState !== 'complete') {
    await new Promise((res, rej) => {
      const 시한 = setTimeout(() => rej(new Error('네트워크 연결 준비가 10초 안에 끝나지 않았어요')), 10000);
      const 봄 = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(시한); pc.removeEventListener('icegatheringstatechange', 봄); res(); } };
      pc.addEventListener('icegatheringstatechange', 봄);
      봄();
    });
  }
  const 결과 = await 서버('/api/연결', { sdp: pc.localDescription.sdp, 길 });
  if (결과.상태 === 409 && 결과.길 === '글') { pc.close(); return { 길: '글', 계량: 결과.계량 }; }
  if (결과.상태 !== 201) { pc.close(); throw new Error(결과.오류 || `연결 실패(${결과.상태})`); }
  표 = 공급사표[결과.길];
  세션 = 결과.세션;
  첫인사 = 결과.첫인사;
  await pc.setRemoteDescription({ type: 'answer', sdp: 결과.sdp });

  return {
    길: 결과.길,
    세션,
    계량: 결과.계량,
    on: 통.on,
    자막,
    마무리() { if (dc.readyState === 'open') dc.send(JSON.stringify(표.마무리(결과.마무리))); },
    /** 탭을 닫거나 새로 고칠 때 sendBeacon으로 보낼 끝 보고(피드백 없이 장부만) */
    비상보고() {
      if (닫힘) return null;
      const 초 = 마지막사용초 ?? (시작시각 ? Math.round((performance.now() - 시작시각) / 1000) : 0);
      return { 길: 결과.길, 세션, 초, 사용: 사용합, 끝확인: false, 피드백없이: true, 전사: [], 까닭: '페이지 닫힘', 기록: 기록꼬리() };
    },
    async 통계() {
      let 받은 = 0;
      let 보낸 = 0;
      (await pc.getStats()).forEach((r) => {
        if (r.type === 'inbound-rtp' && r.kind === 'audio') 받은 += r.bytesReceived || 0;
        if (r.type === 'outbound-rtp' && r.kind === 'audio') 보낸 += r.bytesSent || 0;
      });
      return { 받은, 보낸 };
    },
    /** 끝내기: GPT-Live는 session.close → session.closed(쓴 초)까지 기다리고, 그 뒤 서버에 장부 · 피드백을 부탁한다 */
    async 끝내기() {
      if (닫힘) return null;
      닫힘 = true;
      const 명령 = 표.끝명령();
      if (명령 && dc.readyState === 'open') {
        dc.send(JSON.stringify(명령));
        const 시작 = performance.now();
        while (!끝받음 && performance.now() - 시작 < 15000) await new Promise((r) => setTimeout(r, 100));
      }
      const 지난초 = 시작시각 ? Math.round((performance.now() - 시작시각) / 1000) : 0;
      const 초 = 끝받음?.초 ?? 마지막사용초 ?? 지난초;
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
      출력.srcObject = null;
      통.내기('끝', { 초, 사용: 사용합, 끝확인: !!끝받음 });
      return 서버('/api/끝', { 길: 결과.길, 세션, 초, 사용: 사용합, 끝확인: !!끝받음, 전사: 자막.보낼것(), 기록: 기록꼬리() });
    },
  };
}

const 싸기 = (버퍼) => {
  const b = new Uint8Array(버퍼);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};
const 풀기 = (b64) => {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
};

/** WebSocket 길(Gemini Live) — 서버가 준 1회용 임시 토큰으로 제한 소켓에 붙는다(표준 키는 브라우저에 오지 않는다).
 *  마이크 · 견본 트랙 → 16k 문맥 + 받아쓰기 일꾼(소리일꾼.mjs) → 50ms PCM16 → realtimeInput.audio,
 *  답 소리(24k PCM)는 조각을 이어 예약 재생 → MediaStreamDestination → <audio>(시험 모드 음소거 · 소리 재기가 WebRTC 길과 같게 된다).
 *  구글 live-api-web-console(audio-recorder · audio-streamer)과 같은 꼴.
 *  Gemini만의 손질(설계 §10 · Fable 설계 검토 10-30): 상대 자막은 소리보다 몇 초 먼저 오므로 말 빠르기에 맞춰 늦춰 내고,
 *  학습자 말이 없으면 모델이 먼저 말하지 않으므로 8초 침묵 도움 · 마무리 뒤 4초 침묵 작별을 연결 층이 넣는다. */
async function 소켓열기(결과, { 입력트랙, 출력, 남기기, 반이중: 반이중고정 = false }) {
  const 표 = 공급사표[결과.길];
  const 통 = 사건통();
  const 자막 = 자막모음();
  const 사용 = { 글입력: 0, 음성입력: 0, 글출력: 0, 음성출력: 0, 생각: 0, 차례: 0 };
  const 지금 = () => performance.now();
  let 차례쓰임 = null;
  let 응답 = null;
  let 응답수 = 0;
  let 응답시작ms = 0; // 지금 답의 첫 소리가 들리기 시작하는 시각
  let 응답글수 = 0; // 지금 답에서 내기로 잡은 글자 수(자막 늦춰 내기)
  let 활동 = 0;
  let 시작시각 = 0;
  let 준비 = false;
  let 닫힘 = false;
  let 끊긴까닭 = ''; // 준비 뒤 소켓이 저절로 닫힌 코드 · 까닭 — 끝 보고와 함께 장부에 남긴다
  let 마무리대기 = false;
  let 마무리보낸때 = 0;
  let 작별재촉 = false;
  let 도움보냄 = false;
  let 반이중 = 반이중고정; // 하온 소리가 들리는 동안 마이크 대신 0을 보낸다(스피커 메아리로 하온이 제 말에 끊길 때)
  let 메아리의심 = 0;
  let 말소리때 = 0; // 마이크에 말소리(RMS)가 마지막으로 있던 시각 — voiceActivity가 없어도 침묵을 잰다
  let 활동중 = false;
  let 받은 = 0;
  let 보낸 = 0;

  // 재생 — 새 답(앞 소리가 끝난 뒤 온 조각)은 150ms 여유를 두고, 이어지는 조각은 앞 조각 끝에 붙여 예약한다
  const 재생 = new AudioContext({ sampleRate: 24000 });
  const 목적지 = 재생.createMediaStreamDestination();
  const 예약 = new Set();
  let 재생끝 = 0; // 재생 문맥 시각(초)
  let 재생끝ms = 0; // performance.now() 시각 — 화면의 자동 끝내기가 본다
  출력.srcObject = 목적지.stream;
  출력.play().catch(() => 통.내기('상태', '소리가 막혔어요 — 화면을 한 번 눌러 주세요'));
  const 틀기 = (b64) => {
    const 바이트 = 풀기(b64);
    const n = 바이트.length >> 1;
    if (!n) return 0;
    const 표본 = new Int16Array(바이트.buffer, 0, n); // 리틀 엔디언 PCM16
    const 버퍼 = 재생.createBuffer(1, n, 24000);
    const 칸 = 버퍼.getChannelData(0);
    for (let i = 0; i < n; i++) 칸[i] = 표본[i] / 32768;
    const s = 재생.createBufferSource();
    s.buffer = 버퍼;
    s.connect(목적지);
    const 문맥지금 = 재생.currentTime;
    const 새로 = !(재생끝 > 문맥지금);
    const 때 = 새로 ? 문맥지금 + 0.15 : 재생끝;
    s.start(때);
    if (새로) 응답시작ms = 지금() + (때 - 문맥지금) * 1000;
    재생끝 = 때 + 버퍼.duration;
    재생끝ms = 지금() + (재생끝 - 문맥지금) * 1000;
    예약.add(s);
    s.onended = () => 예약.delete(s);
    return 바이트.length;
  };
  const 비우기 = () => {
    for (const s of 예약) { try { s.stop(); } catch { /* 이미 끝남 */ } }
    예약.clear();
    재생끝 = 0;
    재생끝ms = Math.min(재생끝ms, 지금());
  };

  // 받아쓰기 — 16k 문맥을 못 열면 기본 문맥으로 열고 일꾼이 선형 보간으로 줄인다
  let 받아;
  try { 받아 = new AudioContext({ sampleRate: 16000 }); } catch { 받아 = new AudioContext(); }
  let 살핌 = null;
  const 정리 = () => {
    clearInterval(살핌);
    비우기();
    받아.close().catch(() => {});
    재생.close().catch(() => {});
    출력.srcObject = null;
  };
  // 사용자 활성화가 없는 클릭이면 크롬이 resume을 거절하지 않고 보류만 한다 — 2초 기다리고, 안 되면 다음 화면 누름에 다시 켠다
  const 켜짐 = await Promise.race([Promise.all([재생.resume(), 받아.resume()]).then(() => true), new Promise((r) => setTimeout(() => r(false), 2000))]);
  if (!켜짐) {
    통.내기('상태', '소리를 켜려면 화면을 한 번 눌러 주세요');
    addEventListener('pointerdown', () => { 재생.resume(); 받아.resume(); }, { once: true });
  }
  let 일꾼;
  try {
    await 받아.audioWorklet.addModule(new URL('./소리일꾼.mjs', import.meta.url));
    일꾼 = new AudioWorkletNode(받아, '받아쓰기', { processorOptions: { 묶음: 800 } });
    받아.createMediaStreamSource(new MediaStream([입력트랙])).connect(일꾼);
    일꾼.connect(받아.destination); // 내보내는 소리는 늘 0 — 그래프에 걸어 두어야 process가 돈다
  } catch (e) {
    정리();
    throw new Error(`소리 장치를 준비하지 못했어요: ${e.message}`);
  }
  남기기(`ctx:${재생.state}/${받아.state}@${받아.sampleRate}`);

  const ws = new WebSocket(`${결과.소켓}?access_token=${encodeURIComponent(결과.토큰)}`);
  ws.binaryType = 'arraybuffer'; // Gemini는 JSON을 이진 틀로 보낸다 — blob이면 풀기가 비동기라 조각 차례가 섞인다(현장 노트 AI CLI)
  const 보내기 = (o) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o)); };
  const 풀개 = new TextDecoder();
  const 지난초 = () => (시작시각 ? Math.round((지금() - 시작시각) / 1000) : 0);
  const 차례닫기 = () => { if (차례쓰임) { 표.사용더하기(사용, 차례쓰임); 차례쓰임 = null; } };
  const 글차례 = (글, 끝) => ({ clientContent: { turns: [{ role: 'user', parts: [{ text: 글 }] }], turnComplete: 끝 } });
  const 마무리보내기 = () => { 보내기(표.마무리(결과.마무리)); 마무리보낸때 = 지금(); 남기기('마무리'); };
  일꾼.port.onmessage = ({ data }) => {
    if (!준비 || 닫힘 || ws.readyState !== WebSocket.OPEN) return;
    const 표본 = new Int16Array(data);
    let 합 = 0;
    for (let i = 0; i < 표본.length; i += 4) 합 += 표본[i] * 표본[i];
    if (Math.sqrt(합 / (표본.length / 4)) / 32768 > 0.02) 말소리때 = 지금();
    // 반이중이면 하온 소리가 들리는 동안(+250ms) 0으로 채운 같은 길이를 보낸다 — 아예 안 보내면 공급사 시계가 설 수 있다(무음 트랙 함정)
    const 보낼것 = 반이중 && 지금() < 재생끝ms + 250 ? new ArrayBuffer(data.byteLength) : data;
    보낸 += data.byteLength;
    ws.send(JSON.stringify({ realtimeInput: { audio: { data: 싸기(보낼것), mimeType: 'audio/pcm;rate=16000' } } }));
  };

  // 상대 자막은 말 빠르기(한 글자 140ms 안팎)에 맞춰 늦춰 낸다 — 소리보다 먼저 다 뜨면 말하기가 읽기가 된다
  const 대기글 = [];
  const 넣고알리기 = (s) => { const 번호 = 자막.넣기(s); 통.내기('자막', { 번호, ...(자막.줄들[번호] || {}), 누가: s.누가 }); };
  const 글내기 = (모두 = false) => {
    while (대기글.length && (모두 || 대기글[0].때 <= 지금())) 넣고알리기(대기글.shift().s);
  };
  const 받은자막 = (s) => {
    if (s.누가 === '상대' && s.조각) {
      대기글.push({ s, 때: Math.max(지금(), 응답시작ms + 응답글수 * 140) });
      응답글수 += s.조각.length;
      return;
    }
    if (s.취소 != null) {
      // 끊긴 답 — 아직 안 낸 글은 버리고, 들린 소리가 0.5초 넘으면 들린 데까지 남기고 「…」, 아니면 그 답 줄을 지운다
      for (let i = 대기글.length - 1; i >= 0; i--) if (대기글[i].s.응답 === s.취소) 대기글.splice(i, 1);
      const 들림 = 지금() - 응답시작ms;
      const 있음 = 자막.줄들.some((l) => l.응답 === s.취소 && l.글.trim());
      if (있음 && 들림 > 500) 넣고알리기({ 누가: '상대', 조각: '…', 응답: s.취소 });
      else 넣고알리기(s);
      return;
    }
    넣고알리기(s);
  };

  // 0.25초마다: 늦춘 자막 내기 · 침묵 도움(8초) · 마무리 뒤 작별 재촉(4초)
  살핌 = setInterval(() => {
    if (!준비 || 닫힘) return;
    글내기();
    const 조용 = 응답 === null && !활동중 && 대기글.length === 0;
    const 조용한지 = 지금() - Math.max(재생끝ms, 말소리때, 시작시각);
    if (!조용) return;
    if (마무리보낸때 && !작별재촉 && 조용한지 > 4000) {
      작별재촉 = true;
      보내기(글차례(결과.작별, true));
      남기기('작별재촉');
    } else if (!마무리보낸때 && !도움보냄 && 조용한지 > 8000) {
      도움보냄 = true;
      보내기(글차례(결과.도움, true));
      남기기('침묵도움');
    }
  }, 250);

  let 준비됨;
  let 준비못함;
  const 준비약속 = new Promise((res, rej) => { 준비됨 = res; 준비못함 = rej; });
  const 시한 = setTimeout(() => 준비못함(new Error('Gemini가 15초 안에 준비되지 않았어요')), 15000);
  ws.addEventListener('open', () => { 남기기('ws:open'); 보내기({ setup: 결과.설정 }); });
  ws.addEventListener('close', (ev) => {
    const 까닭 = ev.reason || `연결이 닫혔어요(${ev.code})`;
    남기기('ws:close', { 내용: `${ev.code} ${ev.reason || ''}`.trim().slice(0, 200) });
    if (!준비) {
      clearTimeout(시한);
      준비못함(Object.assign(new Error(`Gemini 연결이 열리지 않았어요: ${까닭}`), { 몫: 표.몫인가(ev.reason) }));
      return;
    }
    if (닫힘) return;
    끊긴까닭 = `${ev.code}${ev.reason ? ` ${ev.reason}` : ''}`.slice(0, 160);
    // 대화 중에 끊김 — 화면이 끝내기로 넘어가 그때까지 전사로 돌아보기를 만든다(첫 말 전이면 화면이 한 번 다시 잇는다). 몫 때문이면 장부에도 적는다
    if (표.몫인가(ev.reason)) 서버('/api/넘김', { 세션: 결과.세션, 까닭: ev.reason, 몫: true }).catch(() => {});
    통.내기('오류', 까닭);
    통.내기('끊김', 끊긴까닭);
  });
  ws.addEventListener('message', (ev) => {
    let e;
    try { e = JSON.parse(typeof ev.data === 'string' ? ev.data : 풀개.decode(ev.data)); } catch { return; }
    if (e.setupComplete) {
      clearTimeout(시한);
      준비 = true;
      시작시각 = 지금();
      남기기('setupComplete');
      준비됨();
      return;
    }
    if (e.usageMetadata) 차례쓰임 = e.usageMetadata;
    if (e.voiceActivity?.type) {
      남기기(`voice:${e.voiceActivity.type}`);
      if (e.voiceActivity.type === 'ACTIVITY_START') { 활동 += 1; 활동중 = true; 도움보냄 = false; 자막.빈자리지우기(); }
      if (e.voiceActivity.type === 'ACTIVITY_END') 활동중 = false;
    }
    if (e.goAway) 남기기('goAway', { 내용: JSON.stringify(e.goAway).slice(0, 120) });
    const sc = e.serverContent;
    if (sc) {
      const 새답 = () => { if (응답 === null) { 응답 = ++응답수; 응답글수 = 0; 응답시작ms = 지금() + 150; } };
      for (const p of sc.modelTurn?.parts || []) {
        if (!p.inlineData?.data) continue;
        새답();
        받은 += 틀기(p.inlineData.data);
      }
      if (sc.outputTranscription?.text) 새답();
      if (sc.inputTranscription?.text) { 도움보냄 = false; 말소리때 = 지금(); }
    }
    e.응답 = 응답;
    e.활동 = 활동;
    for (const s of 표.자막(e)) 받은자막(s);
    if (sc?.interrupted) {
      // 하온 소리가 1초 넘게 들린 뒤 끊기는 일이 두 번이면 스피커 메아리로 보고 반이중으로(학습자가 말 사이에 쉬어 끊긴 것은 첫 소리 무렵이라 세지 않는다)
      if (지금() - 응답시작ms > 1000 && ++메아리의심 >= 2 && !반이중) {
        반이중 = true;
        남기기('반이중');
        통.내기('상태', '스피커 소리가 마이크로 들어가는 것 같아요 — 하온이 말하는 동안은 마이크를 잠깐 쉬어요. 헤드폰을 쓰면 더 자연스러워요');
      }
      남기기('interrupted');
      비우기();
    }
    if (sc?.interrupted || sc?.turnComplete) {
      if (sc.turnComplete) 남기기('turnComplete');
      차례닫기();
      응답 = null;
      if (마무리대기) { 마무리대기 = false; 마무리보내기(); }
    }
    if (e.error) 통.내기('오류', e.error.message || '알 수 없는 오류');
  });

  try {
    await 준비약속;
  } catch (e) {
    정리();
    try { ws.close(); } catch { /* 이미 닫힘 */ }
    throw e;
  }
  // 첫 인사와 「준비」는 화면이 듣는 손을 단 뒤에(이 함수가 돌려준 다음 차례) — 먼저 내면 화면이 놓친다
  setTimeout(() => { 보내기(표.첫인사(결과.첫인사)); 통.내기('준비', { 길: 결과.길 }); }, 0);

  return {
    길: 결과.길,
    세션: 결과.세션,
    계량: 결과.계량,
    on: 통.on,
    자막,
    /** 3:40 마무리 지시 — 답하는 중에 넣으면 그 답이 끊길 수 있어 답 끝(turnComplete) 뒤로 미룬다 */
    마무리() { if (응답 !== null) 마무리대기 = true; else 마무리보내기(); },
    /** 상대 소리가 다 들리는 시각(performance.now) — 자동 끝내기는 이 뒤 1.3초를 본다 */
    상대소리끝: () => 재생끝ms,
    비상보고() {
      if (닫힘) return null;
      차례닫기();
      return { 길: 결과.길, 세션: 결과.세션, 초: 지난초(), 사용, 끝확인: false, 피드백없이: true, 전사: [], 까닭: 끊긴까닭 || '페이지 닫힘', 기록: 기록꼬리() };
    },
    async 통계() { return { 받은, 보낸 }; },
    /** 끝내기: 받아쓰기를 멈추고 소켓을 닫은 뒤 서버에 장부 · 피드백을 부탁한다(Gemini는 끝 확인 사건이 없다 — 쓴 토큰은 차례마다 받은 값) */
    async 끝내기() {
      if (닫힘) return null;
      닫힘 = true;
      차례닫기();
      글내기(true);
      const 초 = 지난초();
      const 열려있음 = ws.readyState === WebSocket.OPEN;
      입력트랙.stop();
      if (ws.readyState <= WebSocket.OPEN) ws.close(1000, '끝');
      정리();
      통.내기('끝', { 초, 사용, 끝확인: 열려있음 });
      return 서버('/api/끝', { 길: 결과.길, 세션: 결과.세션, 초, 사용, 끝확인: 열려있음, 전사: 자막.보낼것(), ...(끊긴까닭 ? { 까닭: 끊긴까닭 } : {}), 기록: 기록꼬리() });
    },
  };
}

/** 글 상황극 길(예산 95% 넘음) — 같은 모양으로: 보내기(글) → 상대 답, 끝내기() → 피드백 */
export function 글열기() {
  const 통 = 사건통();
  const 자막 = 자막모음();
  const 줄넣기 = (누가, 글) => { const 번호 = 자막.넣기({ 누가, 조각: 글 }); 통.내기('자막', { 번호, ...자막.줄들[번호] }); };
  const 차례 = async () => {
    const r = await 서버('/api/글차례', { 대화: 자막.보낼것() });
    if (r.상태 !== 200) throw new Error(r.오류 || `글 상황극 실패(${r.상태})`);
    if (r.답) 줄넣기('상대', r.답);
    return r;
  };
  return {
    길: '글',
    on: 통.on,
    자막,
    async 시작() { const r = await 차례(); 통.내기('준비', { 길: '글' }); return r; },
    async 보내기(글) { 줄넣기('나', 글); return 차례(); },
    async 끝내기() { 통.내기('끝', { 초: 0, 사용: null, 끝확인: true }); return 서버('/api/끝', { 길: '글', 세션: null, 전사: 자막.보낼것() }); },
  };
}
