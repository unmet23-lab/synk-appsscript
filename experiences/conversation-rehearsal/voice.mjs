// 누르고 말하기: 받아쓰기(브라우저 음성 인식) + 녹음(다시 듣기용).
// 조사(member-signal/조사_20261014.md): 1초만 쉬어도 끝나는 음성 모드가 가장 큰 불만이라
// 침묵으로 끝내지 않고, 사람이 「말 끝내기」를 누를 때만 멈춘다. 녹음은 이 창의 메모리에만 두고 저장하지 않는다.

export const MAX_SPEAKING_MS = 5 * 60 * 1000;
const RECORDER_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function voiceSupport(win = globalThis) {
  const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
  return {
    recognition: typeof Recognition === 'function',
    recorder: typeof win.MediaRecorder === 'function' && typeof win.navigator?.mediaDevices?.getUserMedia === 'function',
  };
}

const ERRORS = {
  'not-allowed': '마이크 사용이 막혀 있어요. 주소창 옆 권한에서 마이크를 허용하거나 글로 적어 주세요.',
  'service-not-allowed': '이 브라우저에서는 받아쓰기를 쓸 수 없어요. 녹음은 다시 들을 수 있고, 말한 내용은 글로 적어 주세요.',
  network: '받아쓰기 서버에 연결하지 못했어요. 녹음은 다시 들을 수 있고, 말한 내용은 글로 적어 주세요.',
  'audio-capture': '마이크를 찾지 못했어요. 마이크 연결을 확인하거나 글로 적어 주세요.',
  'language-not-supported': '이 브라우저는 한국어 받아쓰기를 지원하지 않아요. 글로 적어 주세요.',
};

/**
 * onText(text) — 지금까지 받아쓴 글(앞에 있던 글 + 이번에 말한 것)
 * onState(state) — 'idle' | 'starting' | 'listening' | 'stopping'
 * onTick(ms) — 말한 시간
 * onIssue(message) — 받아쓰기·녹음 문제(멈추지 않고 할 수 있는 만큼 계속한다)
 */
export function createVoice({ win = globalThis, lang = 'ko-KR', onText = () => {}, onState = () => {}, onTick = () => {}, onIssue = () => {} } = {}) {
  const support = voiceSupport(win);
  const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
  let state = 'idle', recognition = null, recognitionAlive = false, recorder = null, recorderActive = false, stream = null, chunks = [];
  let base = '', finals = '', interim = '', startedAt = 0, timer = null, audioUrl = '', audioType = '', generation = 0, recognitionBroken = false, stopResolve = null;

  const set = next => { state = next; onState(next); };
  const text = () => [base, finals, interim].map(part => part.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
  const elapsed = () => (startedAt ? Date.now() - startedAt : 0);

  function startRecognition(current) {
    if (!support.recognition || recognitionBroken) return;
    recognition = new Recognition();
    recognition.lang = lang; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      if (current !== generation) return;
      let nextInterim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i], piece = result[0]?.transcript || '';
        if (result.isFinal) finals = `${finals} ${piece}`; else nextInterim += piece;
      }
      interim = nextInterim; onText(text());
    };
    recognition.onerror = event => {
      if (current !== generation) return;
      if (['no-speech', 'aborted'].includes(event.error)) return;
      recognitionBroken = true; onIssue(ERRORS[event.error] || '받아쓰기가 멈췄어요. 녹음은 계속돼요. 말한 내용은 글로 고쳐 적을 수 있어요.');
    };
    // 계속 듣기 중에도 브라우저가 쉬는 틈에 인식을 끝낸다. 사람이 멈추기 전에는 다시 켠다.
    recognition.onend = () => {
      recognitionAlive = false;
      if (current !== generation) return;
      if (interim) { finals = `${finals} ${interim}`; interim = ''; onText(text()); }
      if (state === 'listening' && !recognitionBroken) { try { recognition.start(); recognitionAlive = true; } catch { /* 다음 끝에서 다시 */ } }
      else if (state === 'stopping') finish(current);
    };
    try { recognition.start(); recognitionAlive = true; } catch { recognitionBroken = true; }
  }

  async function startRecorder(current) {
    if (!support.recorder) return;
    try {
      stream = await win.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (current !== generation) { stream.getTracks().forEach(track => track.stop()); return; }
      const type = RECORDER_TYPES.find(item => win.MediaRecorder.isTypeSupported?.(item)) || '';
      recorder = new win.MediaRecorder(stream, type ? { mimeType: type } : undefined);
      audioType = recorder.mimeType || type || 'audio/webm';
      chunks = [];
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = () => { recorderActive = false; if (current === generation) finish(current); };
      recorder.start(1000); recorderActive = true;
    } catch (error) {
      recorder = null; recorderActive = false;
      onIssue(error?.name === 'NotAllowedError' ? ERRORS['not-allowed'] : '녹음을 시작하지 못했어요. 받아쓰기나 글로 계속할 수 있어요.');
    }
  }

  function finish(current) {
    if (current !== generation || state !== 'stopping') return;
    if (recognitionAlive || recorderActive) return;
    clearInterval(timer); timer = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: audioType })) : '';
    const result = { text: text(), durationMs: elapsed(), audioUrl, spoke: !!(finals.trim() || interim.trim()) };
    chunks = []; recorder = null; recognition = null; startedAt = 0;
    set('idle'); stopResolve?.(result); stopResolve = null;
  }

  const api = {
    support,
    get state() { return state; },
    get audioUrl() { return audioUrl; },
    async start(previous = '') {
      if (state !== 'idle') return;
      if (!support.recognition && !support.recorder) { onIssue('이 브라우저는 마이크 연습을 지원하지 않아요. 글로 적어 주세요.'); return; }
      const current = ++generation;
      base = previous; finals = ''; interim = ''; recognitionBroken = false; set('starting');
      startedAt = Date.now(); onTick(0);
      timer = setInterval(() => { const ms = elapsed(); onTick(ms); if (ms >= MAX_SPEAKING_MS) { onIssue('한 번에 5분까지 말할 수 있어요. 여기까지 담았어요.'); void api.stop(); } }, 250);
      await startRecorder(current);
      if (current !== generation) return;
      startRecognition(current);
      if (!recognitionAlive && !recorderActive) { clearInterval(timer); timer = null; startedAt = 0; set('idle'); return; }
      set('listening');
    },
    stop() {
      if (state === 'idle') return Promise.resolve({ text: text(), durationMs: 0, audioUrl, spoke: false });
      if (state === 'stopping') return new Promise(resolve => { const prior = stopResolve; stopResolve = value => { prior?.(value); resolve(value); }; });
      const current = generation;
      set('stopping');
      const done = new Promise(resolve => { stopResolve = resolve; });
      try { if (recognitionAlive) recognition.stop(); } catch { recognitionAlive = false; }
      try { if (recorder?.state === 'recording') recorder.stop(); } catch { recorder = null; }
      // 인식기가 끝을 알리지 않는 브라우저를 위해 잠시 뒤 정리한다.
      setTimeout(() => { if (current === generation && state === 'stopping') { recognitionAlive = false; finish(current); } }, 1500);
      setTimeout(() => { if (current === generation && state === 'stopping') { recognitionAlive = false; recorderActive = false; finish(current); } }, 3000);
      finish(current);
      return done;
    },
    /** 다른 화면으로 가거나 계정이 바뀌면 녹음·받아쓰기를 버린다. */
    dispose() {
      generation++;
      clearInterval(timer); timer = null; startedAt = 0;
      try { recognition?.abort(); } catch { /* 이미 끝남 */ }
      try { if (recorder?.state === 'recording') recorder.stop(); } catch { /* 이미 끝남 */ }
      stream?.getTracks().forEach(track => track.stop()); stream = null;
      recognition = null; recognitionAlive = false; recorder = null; recorderActive = false; chunks = [];
      if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = '';
      stopResolve?.({ text: text(), durationMs: 0, audioUrl: '', spoke: false }); stopResolve = null;
      if (state !== 'idle') set('idle');
    },
    releaseAudio() { if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = ''; },
  };
  return api;
}

/** 「1:05」 */
export function clock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
