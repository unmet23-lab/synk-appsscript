#!/usr/bin/env node
/**
 * 효과음 트랙 만들기 → assets/audio/sfx.m4a (+ 길이가 바뀌었으면 음악도 다시 맞춘다)
 *
 *   node tools/make-sfx.cjs
 *
 * data/timing.js(말 시각)와 data/plan.js(기준점)에서 효과음 시각을 계산한다. 그래서 목소리를 바꾸면
 * make-timing.cjs 다음에 이것만 다시 돌리면 효과음이 새 장면 전환·강조에 맞춰 옮겨 간다.
 * 소리 원본: media-use 효과음 모음(MEDIA_SFX, 기본 ~/.agents/skills/media-use/audio/assets/sfx)과
 * 브랜드 사운드킷(docs/브랜드_사운드킷, 이름 앞에 'synk:'). v2와 같은 방식으로 앞 무음을 깎고 길이·음량을 맞춘다.
 * 음악: assets/audio/music.m4a 길이가 영상 길이와 0.05초 넘게 다르면 ../revision-v2/assets/music-source.wav에서
 * v2와 같은 처리(1.2배 템포·반복·-28.5 LUFS·페이드)로 다시 만든다. 그 뒤 음악 깎기(carve)를 다시 한다(README).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const load = require('./load-data.cjs');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..', '..', '..', '..');
const LIB = process.env.MEDIA_SFX || path.join(os.homedir(), '.agents', 'skills', 'media-use', 'audio', 'assets', 'sfx');
const BRAND = path.join(REPO, 'docs', '브랜드_사운드킷');
const run = (args) => { const r = spawnSync('ffmpeg', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 32e6 }); if (r.status !== 0) throw new Error(r.stderr); return r.stderr; };
const probe = (f) => parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout);

const { T, R } = load();
const cues = R.sfx().filter((c) => c.time < T.duration - 0.05);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ep01-sfx-'));
const parts = cues.map((c, i) => {
  const src = c.name.startsWith('synk:') ? path.join(BRAND, c.name.slice(5) + '.wav') : path.join(LIB, c.name + '.mp3');
  if (!fs.existsSync(src)) throw new Error('효과음 원본이 없다: ' + src);
  const trim = path.join(tmp, `${i}-t.wav`); const out = path.join(tmp, `${i}.wav`);
  run(['-v', 'error', '-y', '-i', src, '-af', `silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.003,atrim=duration=${c.dur},afade=t=in:d=0.004,afade=t=out:st=${Math.max(0.008, c.dur - 0.04)}:d=0.04,highpass=f=80,lowpass=f=7000`, '-ar', '48000', '-ac', '2', trim]);
  const m = run(['-hide_banner', '-i', trim, '-af', 'volumedetect', '-f', 'null', '-']).match(/max_volume: ([-\d.]+) dB/);
  run(['-v', 'error', '-y', '-i', trim, '-af', `volume=${c.peak - Number(m[1])}dB`, out]);
  return out;
});
// ffmpeg 입력이 많으면 명령줄이 길어지므로 16개씩 묶어 섞은 뒤 다시 섞는다
const mixGroup = (files, delays, out) => {
  const a = ['-v', 'error', '-y']; files.forEach((f) => a.push('-i', f));
  const fl = files.map((f, i) => `[${i}:a]adelay=${Math.round(delays[i] * 1000)}:all=1[a${i}]`);
  fl.push(files.map((f, i) => `[a${i}]`).join('') + `amix=inputs=${files.length}:normalize=0,apad,atrim=duration=${T.duration}[out]`);
  a.push('-filter_complex', fl.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', out); run(a);
};
const groups = [];
for (let i = 0; i < parts.length; i += 16) {
  const g = path.join(tmp, `g${i}.wav`);
  mixGroup(parts.slice(i, i + 16), cues.slice(i, i + 16).map((c) => c.time), g); groups.push(g);
}
const sfxWav = path.join(tmp, 'sfx.wav');
mixGroup(groups, groups.map(() => 0), sfxWav);
run(['-v', 'error', '-y', '-i', sfxWav, '-c:a', 'aac', '-b:a', '192k', path.join(ROOT, 'assets', 'audio', 'sfx.m4a')]);
fs.writeFileSync(path.join(ROOT, 'data', 'sfx-cues.json'), JSON.stringify(cues.map((c) => ({ time: Math.round(c.time * 1000) / 1000, name: c.name, peak: c.peak, dur: c.dur, why: c.why })), null, 1));
console.log(`sfx.m4a · 효과음 ${cues.length}개 · ${T.duration}초`);

const music = path.join(ROOT, 'assets', 'audio', 'music.m4a');
const md = fs.existsSync(music) ? probe(music) : 0;
if (Math.abs(md - T.duration) > 0.05) {
  const src = path.join(ROOT, '..', 'revision-v2', 'assets', 'music-source.wav');
  const wav = path.join(tmp, 'music.wav');
  run(['-v', 'error', '-y', '-stream_loop', '-1', '-i', src, '-t', String(T.duration), '-af', `rubberband=tempo=1.2:pitch=1,loudnorm=I=-28.5:TP=-6:LRA=8,afade=t=in:d=0.25,afade=t=out:st=${T.duration - 0.8}:d=0.8`, '-ar', '48000', '-ac', '2', wav]);
  run(['-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '256k', music]);
  console.log(`music.m4a 길이를 ${T.duration}초로 다시 맞춤 → 음악 깎기(carve)를 다시 한다`);
} else console.log('music.m4a 길이 그대로');
