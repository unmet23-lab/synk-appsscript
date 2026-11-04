// 말 랠리 WORLD 배경음악: 곡 자산이 규칙을 지키는지(빠르기 · 조 · 목소리 층 · 고리 길이)와 덕킹 · 멈춤 창이 정한 값대로 움직이는지 본다(주문 폭주 시험과 같은 잣대).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createMusic, LEVELS } from './world-music.mjs';

const manifest = JSON.parse(readFileSync(new URL('./assets/world/music/music.json', import.meta.url), 'utf8'));
const sources = JSON.parse(readFileSync(new URL('./qa/world-music-sources.json', import.meta.url), 'utf8'));
// 효과음은 C 펜타토닉이다 — 곡은 그 음들과 부딪히지 않는 조만 쓴다
const KEYS = new Set(['C major', 'F major', 'G major', 'A minor', 'D minor', 'E minor']);
const VOICE_LUFS = -18.5;   // 태오 목소리 실측(−18 LUFS로 맞춘 파일, ebur128 −18.4)

test('곡 자산: 96~112BPM(랠리 박자 — 읽기 실험 150BPM 아래), 조는 효과음과 맞고, 목소리 층이 없고, 고리가 45초 넘고, 출처 표지는 장부에만', () => {
  const tracks = Object.entries(manifest.tracks);
  assert.ok(tracks.length >= 2, '곡 돌림: 둘 이상');
  for (const [id, t] of tracks) {
    assert.equal(t.mode, 'calm', `${id}: 한 갈래`);
    assert.ok(t.bpm >= 96 && t.bpm <= 112, `${id}: ${t.bpm}BPM`);
    assert.ok(KEYS.has(t.key?.name), `${id}: 조 ${t.key?.name}`);
    assert.ok(t.vocals && t.vocals.loudest3sDb < -40, `${id}: 목소리 층 ${JSON.stringify(t.vocals)}`);
    assert.ok(t.loopEnd - t.loopStart >= 45, `${id}: 고리 ${t.loopEnd - t.loopStart}초`);
    assert.equal(statSync(new URL(`./${t.file}`, import.meta.url)).size, t.bytes, `${id}: 파일 크기가 music.json과 같다`);
    assert.equal(t.source, undefined, `${id}: music.json에 출처 칸이 없다`);
    assert.equal(sources.tracks[id]?.file, t.file, `${id}: 출처 장부에 같은 파일`);
    assert.equal(sources.tracks[id]?.rights, 'suno-premier-official-download', `${id}: 권리 표지`);
  }
});

test('덕킹 · 멈춤 창: 평소 음악은 태오 목소리보다 8 LU 아래, 말하는 동안 16 LU 아래(다시 듣기는 4dB 더), 멈춤 창은 −12dB', () => {
  const param = (v = 1) => { const p = { value: v, events: [] }; for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) p[k] = (...a) => { p.events.push([k, ...a]); if (k === 'setTargetAtTime') p.target = a[0]; }; return p; };
  const gains = [];
  const c = { currentTime: 10, destination: {}, createGain: () => { const g = { gain: param(1), connect() {} }; gains.push(g); return g; } };
  const music = createMusic(c, { storage: null });
  const [master, duck, mode, pause] = gains;
  const DB = (db) => Math.pow(10, db / 20);
  assert.ok(Math.abs(mode.gain.value - DB(LEVELS.game + 18)) < 1e-9);
  assert.ok(Math.abs(LEVELS.game - VOICE_LUFS + 8) < 0.6, `평소 ${LEVELS.game}`);
  assert.ok(Math.abs(LEVELS.duck - VOICE_LUFS + 16) < 0.6, `덕킹 ${LEVELS.duck}`);
  music.voice(true);
  assert.ok(Math.abs(duck.gain.target - DB(LEVELS.duck - LEVELS.game)) < 1e-9);
  music.voice(true, { deep: true });
  assert.ok(Math.abs(duck.gain.target - DB(LEVELS.duck - LEVELS.game - 4)) < 1e-9);
  music.pause(true);
  assert.ok(Math.abs(pause.gain.target - DB(-12)) < 1e-9);
  music.pause(false);
  assert.equal(pause.gain.target, 1);
  assert.ok(master);
});
