// 말 랠리 — WORLD 캠퍼스 판의 배경음악(2026-11-04, 주문 폭주 world-music.mjs와 같은 글 — 저장 열쇠만 다름): 연주곡 고리 · 태오 목소리 위 덕킹 · 곡 돌림 · 크기.
// 곡 파일과 고리 자리는 assets/world/music/music.json(qa/world-campus-20261104/음악고리.py가 만든다 — BPM · 마디 실측, −18 LUFS).
// LAB 화면은 음악이 없다(이 파일은 WORLD에서만 불러온다).
//
// 크기(조사_소리: 방송 연구 · 비원어민 듣기 연구 · 게임 덕킹 예 → 2판_설계 2 · 4절)
//   태오 목소리는 −18.4 LUFS(통합, 실측)다. 게임 중 음악은 그보다 8 LU 아래(−26.5), 음성이 나오는 동안은 16 LU 아래(−34.5).
//   음악은 시합 중에만 난다 — 입구는 「한 판 하기」 전까지 조용하고, 결과는 태오의 말과 숫자가 주인공이라 음악이 물러난다.
//   멈춤 창이 열리면 멈추지 않고 12dB 내린다.
// 덕킹: 음성 시작에 맞춰 내리고(τ 40ms — 음성 파일 앞 무음이 127ms 이상이라 첫 음절 전에 95% 내려간다),
//   끝나고 0.4초 머문 뒤 약 0.6초에 걸쳐 올린다(τ 0.2). 그 0.4초 안에 다음 음성이 오면 올리지 않는다.
// 고리: 마디 경계의 loopStart~loopEnd를 되풀이하되, 이음매마다 80ms 겹쳐 잇는다(새 소스를 미리 예약 — 코덱 앞 여백과 상관없다).

const DB = (db) => Math.pow(10, db / 20);
const FILE_LUFS = -18;
export const LEVELS = Object.freeze({ game: -26.5, duck: -34.5 });   // 목표 LUFS
const XF = 0.08;

export function createMusic(ctx, { base = '', destination = ctx.destination, storage = null } = {}) {
  const master = ctx.createGain();   // 사용자 크기(0~1)
  const duckGain = ctx.createGain();  // 덕킹
  const modeGain = ctx.createGain();  // 곡 크기(파일 −18 → 게임 −26.5 LUFS)
  const pauseGain = ctx.createGain(); // 멈춤 창
  modeGain.connect(duckGain); duckGain.connect(pauseGain); pauseGain.connect(master); master.connect(destination);
  modeGain.gain.value = DB(LEVELS.game - FILE_LUFS);
  let manifest = null, current = null, wanted = null, volume = 1, on = true, releaseAt = 0;
  const buffers = new Map();
  const remember = (k, v) => { try { storage?.setItem(k, v); } catch { /* 저장 못 해도 이번 판은 된다 */ } };
  const recall = (k) => { try { return storage?.getItem(k) ?? null; } catch { return null; } };
  const vSaved = Number(recall('synk.talk-rally.music.volume'));
  if (Number.isFinite(vSaved) && recall('synk.talk-rally.music.volume') !== null) volume = Math.min(1, Math.max(0, vSaved));
  master.gain.value = volume;

  async function loadManifest() {
    if (manifest) return manifest;
    const res = await fetch(`${base}assets/world/music/music.json`);
    if (!res.ok) throw new Error('music manifest');
    manifest = await res.json();
    return manifest;
  }
  async function buffer(id) {
    if (buffers.has(id)) return buffers.get(id);
    const track = manifest.tracks[id];
    const p = fetch(`${base}${track.file}`).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab));
    buffers.set(id, p);
    return p;
  }
  /** 모드의 곡 하나를 고른다: 직전에 들은 곡을 건너뛰고 돌린다(같은 곡 반복 → 음소거, 조사_소리). */
  const lastKey = (mode) => `synk.talk-rally.music.last${mode === 'rush' ? '-rush' : ''}`;
  function pick(mode) {
    const list = Object.entries(manifest.tracks).filter(([, t]) => t.mode === (mode === 'rush' ? 'rush' : 'calm')).map(([id]) => id);
    if (!list.length) return null;
    const last = recall(lastKey(mode));
    return list.length > 1 ? list.find((id) => id !== last) || list[0] : list[0];
  }
  /** 고리 하나를 시각 when부터 돌린다. 이음매마다 다음 소스를 겹쳐 예약한다. */
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
      // 다음 고리는 이 소스가 loopEnd − 40ms를 지날 때 loopStart − 40ms부터 겹쳐 시작한다(첫 소스는 loopStart부터 시작했으므로 L − 40ms 뒤)
      const next = first ? at + L - XF / 2 : at + L;
      voice.timer = setTimeout(() => schedule(next, false), Math.max(0, (next - ctx.currentTime - 2) * 1000));
    };
    schedule(when, true);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(1, when + fadeIn);
    return voice;
  }
  function stopVoice(v, fade = 0.8) {
    if (!v) return;
    v.stopped = true; clearTimeout(v.timer);
    const now = ctx.currentTime;
    v.out.gain.cancelScheduledValues(now);
    v.out.gain.setValueAtTime(v.out.gain.value, now);
    v.out.gain.linearRampToValueAtTime(0, now + fade);
    for (const s of v.sources) { try { s.stop(now + fade + 0.05); } catch { /* 이미 멈춤 */ } }
  }

  return {
    get volume() { return volume; },
    get playing() { return current?.id || null; },
    /** 시합이 시작될 때. 곡마다 mode(music.json)가 calm · rush이고 말 랠리는 calm 한 갈래를 돌린다. 같은 곡이 돌고 있으면 그대로, 다른 곡이면 1.2초 겹쳐 바꾼다. */
    async play(mode) {
      wanted = mode;
      if (!on) return;
      try {
        await loadManifest();
        const kind = mode === 'rush' ? 'rush' : 'calm';
        const id = current && !current.stopped && manifest.tracks[current.id]?.mode === kind ? current.id : pick(kind);
        if (!id || wanted !== mode) return;
        if (current?.id === id && !current.stopped) return;
        const buf = await buffer(id);
        if (wanted !== mode || !on) return;
        stopVoice(current, 1.2);
        current = loop(id, buf, ctx.currentTime + 0.05, 1.2);
        remember(lastKey(kind), id);
      } catch { /* 음악이 없어도 게임은 된다 */ }
    },
    /** 다른 곡을 미리 풀어 둔다(러시를 고르면 입구에서). */
    async preload(mode) { try { await loadManifest(); const id = pick(mode); if (id) await buffer(id); } catch { /* 나중에 */ } },
    stop(fade = 0.8) { wanted = null; stopVoice(current, fade); current = null; },
    /** 태오 목소리 덕킹: voice(true)는 음성이 시작될 때, voice(false)는 끝났을 때. deep이면(다시 듣기) 4dB 더. */
    voice(active, { deep = false } = {}) {
      const now = ctx.currentTime, g = duckGain.gain;
      if (active) {
        releaseAt = 0;
        g.cancelScheduledValues(now);
        g.setTargetAtTime(DB(LEVELS.duck - LEVELS.game - (deep ? 4 : 0)), now, 0.04);
      } else {
        releaseAt = now + 0.4;
        const at = releaseAt;
        setTimeout(() => { if (releaseAt !== at) return; g.cancelScheduledValues(ctx.currentTime); g.setTargetAtTime(1, ctx.currentTime, 0.2); }, 400);
      }
    },
    /** 멈춤 창이 열려 있는 동안 12dB 내린다(멈추지 않는다). */
    pause(on) { pauseGain.gain.setTargetAtTime(on ? DB(-12) : 1, ctx.currentTime, 0.12); },
    setVolume(v) { volume = Math.min(1, Math.max(0, v)); master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); remember('synk.talk-rally.music.volume', String(volume)); },
    /** 게임 소리 단추: 끄면 곡을 멈추되 어느 곡을 원했는지는 기억해 두었다가 켜면 다시 튼다. */
    setOn(next) { on = !!next; if (!on) { stopVoice(current, 0.4); current = null; } else if (wanted) this.play(wanted); },
    /** 확인용: 지금 덕킹 · 크기 값. */
    state() { return { duck: duckGain.gain.value, pause: pauseGain.gain.value, mode: modeGain.gain.value, master: master.gain.value, playing: current?.id || null }; },
  };
}
