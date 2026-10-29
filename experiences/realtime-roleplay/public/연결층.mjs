// 공급사 연결 층 · 브라우저 쪽(2026-10-30 시제품). 화면은 이 파일의 `열기()`만 쓰고, 길(공급사)마다 다른 것은 아래 표 한 줄에 모은다.
// 공통 사건: '준비' · '자막'({번호, 누가:'상대'|'나', 글}) · '상태'(글) · '끝'({초, 사용, 끝확인}) · '오류'(글)
// 소리는 WebRTC 트랙(마이크 → 공급사, 공급사 → <audio>), 자막 · 명령은 데이터 채널 「oai-events」. 키는 서버만 쥔다.

export const 공급사표 = {
  'gpt-live': {
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
  };
}

async function 서버(주소, 몸) {
  const r = await fetch(주소, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(몸) });
  const j = await r.json().catch(() => ({}));
  return { 상태: r.status, ...j };
}

/** 음성 길 열기. 입력트랙: 마이크나 시험용 Web Audio 트랙. 출력: <audio>. 길을 안 주면 서버의 예산 계량기가 고른다. */
export async function 열기({ 길, 입력트랙, 출력 }) {
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
  // 고장 찾기용 사건 기록(종류 · 시각 · 닫힘 까닭만 — 자막 글은 담지 않는다)
  const 기록 = (globalThis.__상황극기록 = []);
  const 남기기 = (종류, 덧 = {}) => { 기록.push({ 종류, t: Math.round(performance.now()), ...덧 }); if (기록.length > 400) 기록.shift(); };
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
      return { 길: 결과.길, 세션, 초, 사용: 사용합, 끝확인: false, 피드백없이: true, 전사: [] };
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
      return 서버('/api/끝', { 길: 결과.길, 세션, 초, 사용: 사용합, 끝확인: !!끝받음, 전사: 자막.보낼것() });
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
