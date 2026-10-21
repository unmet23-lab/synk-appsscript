// synkbrief 「카타나 써 봤습니다」 소리를 섞는다: node docs/마케팅/synkbrief_카타나실험_20261013/소리.mjs
// 음악·목소리 없음. 카타나 결과 영상의 소리(번들 CC0 효과음, assets/media/sfx_licenses.txt) + 효과음(브랜드 사운드 킷 + 여기서 만든 똑딱·톡·스침).
// 결과: kit-v1/assets/media/mix.m4a (34.6초, −14 LUFS, 실제 최대 −1.5 dBTP). 시각은 kit-v1/index.html과 같다.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const MEDIA = path.join(HERE, 'kit-v1', 'assets', 'media');
const KIT = path.join(REPO, 'docs', '브랜드_사운드킷');
const DUR = 34.6;
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

const made = {
  tick: path.join(MEDIA, 'tick.wav'),
  tick2: path.join(MEDIA, 'tick2.wav'),
  tok: path.join(MEDIA, 'tok.wav'),
  swish: path.join(MEDIA, 'swish.wav'),
  low: path.join(MEDIA, 'low.wav'),       // 틀린 곳 밑줄: 낮은 두 음(330 → 247Hz) 120ms, 실패음처럼 거칠지 않게
};
ff(['-f', 'lavfi', '-i', 'sine=f=1568:d=0.025:sample_rate=48000', '-af', 'afade=t=out:st=0.004:d=0.021,volume=0.5', made.tick]);
ff(['-f', 'lavfi', '-i', 'sine=f=2093:d=0.03:sample_rate=48000', '-af', 'afade=t=out:st=0.004:d=0.026,volume=0.55', made.tick2]);
ff(['-f', 'lavfi', '-i', "aevalsrc='0.6*sin(2*PI*(523-180*t/0.07)*t)*exp(-t*55)':s=48000:d=0.07", made.tok]);
ff(['-f', 'lavfi', '-i', 'anoisesrc=color=pink:d=0.22:sample_rate=48000:amplitude=0.5', '-af',
  'bandpass=f=1800:width_type=q:w=0.8,afade=t=in:st=0:d=0.09,afade=t=out:st=0.09:d=0.13,volume=0.55', made.swish]);
ff(['-f', 'lavfi', '-i', "aevalsrc='0.45*(if(lt(t,0.06),sin(2*PI*330*t),sin(2*PI*247*t)))*exp(-t*14)':s=48000:d=0.16", made.low]);
const K = (name) => path.join(KIT, name);

// [시각(초), 파일, 음량, 원본 시작(초), 길이(초)]
const EVENTS = [
  [0.75, made.tok, 0.45],                         // 화살표
  [3.20, made.tick2, 0.7],
  [3.45, made.tok, 0.45], [4.75, made.tok, 0.45], [6.05, made.tok, 0.45],   // 세 단계
  [6.70, made.swish, 0.4],                        // 선택 영역
  [9.00, made.tick2, 0.7],
  [9.00, path.join(MEDIA, 'katana-motion-sfx.m4a'), 1.0, 0, 10.6],   // 카타나 결과 영상의 소리 그대로
  [19.60, made.tick2, 0.7],
  [19.66, made.tick, 0.35], [19.82, made.tick, 0.35], [20.02, made.tick, 0.35],   // 42 세기
  [21.20, made.tok, 0.5],
  [21.26, made.tick, 0.35], [21.42, made.tick, 0.35], [21.62, made.tick, 0.35],   // 38 세기
  [25.00, made.tick2, 0.7], [26.40, made.tok, 0.5],
  [30.60, made.tick2, 0.7],
  [30.85, made.tok, 0.4], [31.35, made.tok, 0.4], [32.05, made.tok, 0.4],
  [33.30, K('synk-sound-earn.wav'), 0.5],         // 서명
  [33.55, made.swish, 0.45],
];
const inputs = [], parts = [];
EVENTS.forEach(([t, file, vol, from, len], i) => {
  if (from != null) inputs.push('-ss', String(from), '-t', String(len));
  inputs.push('-i', file);
  const ms = Math.round(t * 1000);
  const fade = from != null ? `,afade=t=out:st=${(len - 0.3).toFixed(2)}:d=0.3` : '';
  parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${vol}${fade},adelay=${ms}|${ms}[e${i}]`);
});
const mixIn = EVENTS.map((_, i) => `[e${i}]`).join('');
const raw = path.join(MEDIA, 'mix_raw.wav');
ff([...inputs, '-filter_complex', `${parts.join(';')};${mixIn}amix=inputs=${EVENTS.length}:normalize=0:dropout_transition=0,apad=whole_dur=${DUR},atrim=0:${DUR}[m]`,
  '-map', '[m]', '-ar', '48000', raw]);
const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const stats = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
const out = path.join(MEDIA, 'mix.m4a');   // 음량: 처음 음량을 재서 −14 LUFS만큼 올리고 리미터로 최대 −1.5 dBFS에서 막는다(loudnorm 선형이 안 되는 띄엄띄엄한 효과음)
ff(['-i', raw, '-af', `volume=${(-14 - stats.input_i).toFixed(2)}dB,alimiter=limit=0.75:attack=0.5:release=60:level=false,aresample=48000`,
  '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), out]);
console.log('만듦', path.relative(REPO, out), '사건', EVENTS.length, '처음 음량', stats.input_i, 'LUFS');
