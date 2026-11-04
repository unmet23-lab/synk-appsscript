// 환승 러시 배경음악(설계 6절): 달리는 구간과 결과에만 난다 — 열차 안은 레일 소리가 박자다.
// 곡 파일과 고리 자리는 assets/music/music.json(qa/음악고리.py가 만든다 — BPM · 마디 실측, −18 LUFS). 고리 · 덕킹은 주문 폭주 world-music.mjs와 같은 규칙이다.
// 크기: 음성(통합 약 LEVELS.voice)보다 게임 중 8 LU 아래, 음성이 나오는 동안 16 LU 아래. 멈춤은 오디오 문맥째 멈추므로 따로 내리지 않는다.
// 덕킹: 음성 시작에 맞춰 내리고(τ 40ms), 끝나고 0.4초 머문 뒤 약 0.6초에 걸쳐 올린다. 그 0.4초 안에 다음 음성이 오면 올리지 않는다.
// 고리: 마디 경계의 loopStart~loopEnd를 되풀이하되, 이음매마다 80ms 겹쳐 잇는다(새 소스를 미리 예약 — 코덱 앞 여백과 상관없다).
const DB = (db) => Math.pow(10, db / 20);
const FILE_LUFS = -18;
export const LEVELS = Object.freeze({ voice: -17, game: -25.5, duck: -33.5 });
const XF = 0.08;

export function createMusic(ctx, { base = '', destination = ctx.destination } = {}) {
  const duckGain = ctx.createGain(), modeGain = ctx.createGain();
  modeGain.connect(duckGain); duckGain.connect(destination);
  modeGain.gain.value = DB(LEVELS.game - FILE_LUFS);
  let manifest = null, current = null, wanted = null, turn = 0, releaseAt = 0;
  const buffers = new Map();
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 이번 판은 된다 */ } };
  const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

  async function loadManifest() {
    if (manifest) return manifest;
    const res = await fetch(`${base}assets/music/music.json`);
    if (!res.ok) throw new Error('music manifest');
    manifest = await res.json();
    return manifest;
  }
  function buffer(id) {
    if (buffers.has(id)) return buffers.get(id);
    const p = fetch(`${base}${manifest.tracks[id].file}`).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab));
    buffers.set(id, p);
    p.catch(() => buffers.delete(id));   // 못 풀면 다음에 다시 받는다
    return p;
  }
  function loop(id, buf, when, fadeIn) {
    const t = manifest.tracks[id], L = t.loopEnd - t.loopStart, out = ctx.createGain();
    out.gain.value = 0; out.connect(modeGain);
    const voice = { id, out, sources: [], timer: 0, stopped: false };
    const schedule = (at, first) => {
      if (voice.stopped) return;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; src.connect(g); g.connect(out);
      g.gain.value = first ? 1 : 0;   // 기본 크기 1이 겹쳐 시작하는 첫 표본에 새면 이음매에 딸깍이 난다
      const offset = first ? t.loopStart : t.loopStart - XF / 2;
      const dur = first ? L + XF / 2 : L + XF;
      g.gain.setValueAtTime(first ? 1 : 0, at);
      if (!first) g.gain.linearRampToValueAtTime(1, at + XF);
      g.gain.setValueAtTime(1, at + dur - XF);
      g.gain.linearRampToValueAtTime(0, at + dur);
      src.start(at, offset, dur);
      voice.sources.push(src);
      if (voice.sources.length > 3) voice.sources.shift();
      const next = first ? at + L - XF / 2 : at + L;
      voice.timer = setTimeout(() => schedule(next, false), Math.max(0, (next - ctx.currentTime - 2) * 1000));
    };
    schedule(when, true);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(1, when + fadeIn);
    return voice;
  }
  function stopVoice(v, fade) {
    if (!v) return;
    v.stopped = true; clearTimeout(v.timer);
    const now = ctx.currentTime;
    v.out.gain.cancelScheduledValues(now);
    v.out.gain.setValueAtTime(v.out.gain.value, now);
    v.out.gain.linearRampToValueAtTime(0, now + fade);
    for (const s of v.sources) { try { s.stop(now + fade + 0.05); } catch { /* 이미 멈춤 */ } }
  }

  return {
    get playing() { return current?.id || null; },
    /** 확인용: 지금 덕킹 · 크기 값. */
    state() { return { duck: duckGain.gain.value, mode: modeGain.gain.value, out: current?.out.gain.value ?? null, playing: current?.id || null }; },
    /** 'run'(달리는 구간) · 'arrive'(결과). 같은 곡이 돌고 있으면 그대로, 다른 곡이면 겹쳐 바꾼다. 음악이 없어도 게임은 된다. */
    async play(mode) {
      if (wanted === mode) return;   // 이미 트는 중이거나 도는 중
      wanted = mode;
      const mine = ++turn;
      try {
        await loadManifest();
        if (mine !== turn) return;
        const list = Object.keys(manifest.tracks).filter((k) => manifest.tracks[k].mode === mode);
        const id = list[(list.indexOf(recall(`synk.subway.music.${mode}`)) + 1) % list.length];   // 판마다 다음 곡
        if (!id) return;
        remember(`synk.subway.music.${mode}`, id);
        const buf = await buffer(id);
        if (mine !== turn) return;
        stopVoice(current, 0.8);
        current = loop(id, buf, ctx.currentTime + 0.05, 0.5);
      } catch { if (mine === turn) wanted = null; /* 음악 없이 간다, 다음 구간에 다시 시도 */ }
    },
    /** 곡을 미리 풀어 둔다(달리기 시작에 맞춰 바로 나오게). 못 풀어도 게임은 된다. */
    async preload() { try { await loadManifest(); await Promise.all(Object.keys(manifest.tracks).map((id) => buffer(id))); } catch { /* 나중에 다시 */ } },
    stop(fade = 0.8) { wanted = null; turn += 1; stopVoice(current, fade); current = null; },
    voice(active) {
      const now = ctx.currentTime, g = duckGain.gain;
      if (active) {
        releaseAt = 0;
        g.cancelScheduledValues(now);
        g.setTargetAtTime(DB(LEVELS.duck - LEVELS.game), now, 0.04);
      } else {
        releaseAt = now + 0.4;
        const at = releaseAt;
        setTimeout(() => { if (releaseAt !== at) return; g.cancelScheduledValues(ctx.currentTime); g.setTargetAtTime(1, ctx.currentTime, 0.2); }, 400);
      }
    },
  };
}
