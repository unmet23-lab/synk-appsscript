// 주문 폭주 WORLD 배경음악: 곡 자산이 설계 규칙을 지키는지(빠르기 · 조 · 목소리 층 · 고리 길이)와, 덕킹 · 멈춤 창 크기 · 이음매가
// 정한 값대로 움직이는지 본다(Fable 2판 검토 P1-8 — 러시 곡이 122BPM에 목소리 층이 들려도 시험이 막지 못했다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createMusic, LEVELS } from './world-music.mjs';

const manifest = JSON.parse(readFileSync(new URL('./assets/world/music/music.json', import.meta.url), 'utf8'));
const sources = JSON.parse(readFileSync(new URL('./qa/world-music-sources.json', import.meta.url), 'utf8'));
// 효과음은 C 펜타토닉이다 — 곡은 그 음들과 부딪히지 않는 조(C · F · G 장조, 나란한 A · D · E 단조)만 쓴다
const KEYS = new Set(['C major', 'F major', 'G major', 'A minor', 'D minor', 'E minor']);

test('곡 자산: 오픈은 100BPM 아래, 러시는 104~112BPM, 조는 효과음과 맞고, 목소리 층이 없고(가장 큰 3초 −40dB 아래), 고리는 45초 이상', () => {
  const tracks = Object.entries(manifest.tracks);
  assert.ok(tracks.some(([, t]) => t.mode === 'calm') && tracks.some(([, t]) => t.mode === 'rush'), '오픈 · 러시 곡이 하나씩은 있다');
  for (const [id, t] of tracks) {
    if (t.mode === 'rush') assert.ok(t.bpm >= 104 && t.bpm <= 112, `${id}: ${t.bpm}BPM`);
    else assert.ok(t.bpm <= 100, `${id}: ${t.bpm}BPM`);
    assert.ok(KEYS.has(t.key?.name), `${id}: 조 ${t.key?.name}`);
    assert.ok(t.vocals && t.vocals.loudest3sDb < -40, `${id}: 목소리 층 ${JSON.stringify(t.vocals)}`);
    assert.ok(t.loopEnd - t.loopStart >= 45, `${id}: 고리 ${t.loopEnd - t.loopStart}초`);
    assert.ok(t.loopStart >= 0.05 && t.loopEnd < t.loopStart + (t.end - t.start) + 0.01, `${id}: 고리 자리`);
    assert.equal(statSync(new URL(`./${t.file}`, import.meta.url)).size, t.bytes, `${id}: 파일 크기가 music.json과 같다`);
    // 곡 출처 · 권리 표지는 공개 게임 파일이 아니라 qa 장부에(공개 빌드가 제작 도구 이름을 막는다, 11-04)
    assert.equal(t.source, undefined, `${id}: music.json에 출처 칸이 없다`);
    assert.equal(sources.tracks[id]?.file, t.file, `${id}: 출처 장부에 같은 파일`);
    assert.equal(sources.tracks[id]?.rights, 'suno-premier-official-download', `${id}: 권리 표지`);
  }
});

function mockContext() {
  const sources = [];
  const param = (v = 1) => {
    const p = { value: v, events: [] };
    for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) p[k] = (...a) => { p.events.push([k, ...a]); if (k === 'setValueAtTime') p.value = a[0]; if (k === 'setTargetAtTime') p.target = a[0]; return p; };
    return p;
  };
  const c = {
    currentTime: 10, destination: {},
    createGain: () => ({ gain: param(1), connect() {} }),
    createBufferSource: () => { const s = { connect() {}, start(at, offset, dur) { Object.assign(s, { at, offset, dur }); }, stop() {} }; sources.push(s); return s; },
    decodeAudioData: async () => ({ duration: 200 }),
  };
  return { c, sources };
}
const DB = (db) => Math.pow(10, db / 20);

test('곡 시작 · 이음매: 첫 소스는 loopStart에서, 다음 소스는 80ms 겹쳐 loopStart − 40ms부터 0에서 올라온다', async () => {
  const { c, sources } = mockContext();
  const saved = globalThis.fetch, timers = [];
  globalThis.fetch = async (url) => ({ ok: true, json: async () => manifest, arrayBuffer: async () => new ArrayBuffer(8), url });
  const realSet = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  try {
    const music = createMusic(c, { storage: null });
    await music.play('rush');
    const [id] = Object.entries(manifest.tracks).find(([, t]) => t.mode === 'rush');
    const t = manifest.tracks[music.playing || id], L = t.loopEnd - t.loopStart;
    assert.equal(sources.length, 1);
    assert.ok(Math.abs(sources[0].offset - t.loopStart) < 1e-9 && Math.abs(sources[0].dur - (L + 0.04)) < 1e-9);
    timers.shift().fn();   // 다음 고리 예약
    assert.equal(sources.length, 2);
    assert.ok(Math.abs(sources[1].at - (sources[0].at + L - 0.04)) < 1e-9, '이음매는 첫 소스 시작 + L − 40ms');
    assert.ok(Math.abs(sources[1].offset - (t.loopStart - 0.04)) < 1e-9 && Math.abs(sources[1].dur - (L + 0.08)) < 1e-9);
  } finally { globalThis.fetch = saved; globalThis.setTimeout = realSet; }
});

test('덕킹 · 멈춤 창: 음성 동안 음악은 음성보다 16 LU 아래(다시 듣기는 4dB 더), 멈춤 창은 −12dB', () => {
  const { c } = mockContext();
  const gains = [];
  const make = c.createGain;
  c.createGain = () => { const g = make(); gains.push(g); return g; };
  const music = createMusic(c, { storage: null });
  const [master, duck, mode, pause] = gains;
  assert.ok(Math.abs(mode.gain.value - DB(LEVELS.game + 18)) < 1e-9, '곡 크기: 파일 −18 → 게임 −30.5 LUFS');
  music.voice(true);
  assert.ok(Math.abs(duck.gain.target - DB(LEVELS.duck - LEVELS.game)) < 1e-9);
  assert.equal(LEVELS.game + 22.5, -8, '평소 음악은 음성(−22.5)보다 8 LU 아래');
  assert.equal(LEVELS.duck + 22.5, -16, '음성 동안은 16 LU 아래');
  music.voice(true, { deep: true });
  assert.ok(Math.abs(duck.gain.target - DB(LEVELS.duck - LEVELS.game - 4)) < 1e-9);
  music.pause(true);
  assert.ok(Math.abs(pause.gain.target - DB(-12)) < 1e-9);
  music.pause(false);
  assert.equal(pause.gain.target, 1);
  assert.ok(master);
});
