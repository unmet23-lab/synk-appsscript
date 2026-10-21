// synkbrief 1편 v20(쇼츠 45초, 새 디자인) 소리를 만든다: node docs/마케팅/synkbrief_회의메모_20260921/video-v20/소리.mjs
// 목소리: v19 완성본(바탕화면 회의정리_영상.mp4)의 Typecast 은경 내레이션을 Demucs로 떼어 낸 것(scratchpad sb_audio/v19_vocals.wav)에서
//   10-01 45초판(split1)과 같은 열두 문장을 잘라 같은 자리에 놓는다. 문장 위치는 faster-whisper 낱말 시각으로 찾았다(align.json, 일치도 0.96~1.00).
//   새 음성 합성·유료 호출 없음.
// 음악: v19와 같은 Suno 시티팝_147(유호님 유료 구독 중 제작, docs/홍보물/BGM/시티팝_147.wav), 목소리 아래로 낮춤.
// 효과음: 여기서 만든 똑딱·톡·스침 + 브랜드 사운드 킷.
// 결과: index.html 옆 assets/media/mix.m4a(45.2초, −14 LUFS, 실제 최대 −1.5 dBTP)와 captions.json(낱말 시각).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const MEDIA = path.join(HERE, 'assets', 'media');
const KIT = path.join(REPO, 'docs', '브랜드_사운드킷');
const SB = process.env.SB_AUDIO || 'C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/628e6e45-b957-42c4-8937-7fb04e5d9d04/scratchpad/sb_audio';
const VOX = path.join(SB, 'v19_vocals.wav');
const ALIGN = JSON.parse(fs.readFileSync(path.join(HERE, 'align.json'), 'utf8'));
const WORDS = JSON.parse(fs.readFileSync(path.join(SB, 'v19_words.json'), 'utf8')).words;
const BGM = path.join(REPO, 'docs', '홍보물', 'BGM', '시티팝_147.wav');
const DUR = 45.2;
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
fs.mkdirSync(MEDIA, { recursive: true });

const made = { tick2: path.join(MEDIA, 'tick2.wav'), tok: path.join(MEDIA, 'tok.wav'), swish: path.join(MEDIA, 'swish.wav'), click: path.join(MEDIA, 'click.wav') };
ff(['-f', 'lavfi', '-i', 'sine=f=2093:d=0.03:sample_rate=48000', '-af', 'afade=t=out:st=0.004:d=0.026,volume=0.55', made.tick2]);
ff(['-f', 'lavfi', '-i', "aevalsrc='0.6*sin(2*PI*(523-180*t/0.07)*t)*exp(-t*55)':s=48000:d=0.07", made.tok]);
ff(['-f', 'lavfi', '-i', 'anoisesrc=color=pink:d=0.22:sample_rate=48000:amplitude=0.5', '-af',
  'bandpass=f=1800:width_type=q:w=0.8,afade=t=in:st=0:d=0.09,afade=t=out:st=0.09:d=0.13,volume=0.55', made.swish]);
ff(['-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*1400*t)*exp(-t*90)+0.3*sin(2*PI*2800*t)*exp(-t*120)':s=48000:d=0.05", made.click]);
const K = (name) => path.join(KIT, name);

// 1) 문장마다 목소리 조각: 앞 0.08초, 뒤 0.25초 여유. v19s·v19e는 실제 첫소리·말끝(10-13 검수 실측), w19s는 받아쓰기의 문장 시작
const pieces = ALIGN.map((x) => ({ ...x, from: Math.max(0, x.v19s - 0.08), to: x.v19e + 0.25 }));
// 2) 낱말 시각(자막용): 새 시각 = 문장 자리(at) + (낱말 시작 − 문장 시작)
const caps = pieces.map((p) => {
  const ws = WORDS.filter((w) => w.s >= (p.w19s ?? p.v19s) - 0.05 && w.e <= p.v19e + 0.3).map((w) => ({ w: w.w, t: +(p.at + (w.s - p.v19s)).toFixed(3) }));
  return { id: p.id, text: p.text, at: p.at, end: +(p.at + (p.to - p.from)).toFixed(3), words: ws };
});
fs.writeFileSync(path.join(HERE, 'captions.json'), JSON.stringify(caps, null, 1) + '\n');

// 3) 효과음 [시각, 파일, 음량] — index.html 장면 시각과 같다
const SFX = [
  [1.20, made.tick2, 0.5], [2.62, made.tick2, 0.6],                                   // 같은 자리 매치컷, 결과 읽기
  [3.80, made.tok, 0.2], [4.48, made.tok, 0.2], [4.96, made.tok, 0.2], [5.42, made.tok, 0.2], // 제목 넷 선택
  [8.40, made.swish, 0.35], [9.98, made.tick2, 0.6],                                  // 표 조명, 메모
  [10.95, made.click, 0.5], [11.42, made.click, 0.6], [14.40, made.tok, 0.45],        // Ctrl+A, Ctrl+C, 큰 글자
  [16.62, made.tick2, 0.6], [18.20, made.click, 0.6],                                 // 빈 입력창, Ctrl+V
  [20.13, made.tok, 0.2], [20.77, made.tok, 0.2], [21.27, made.tok, 0.2], [21.75, made.tok, 0.2], // 부탁 문장 네 낱말
  [26.90, made.click, 0.6], [28.00, made.tick2, 0.5], [30.86, made.click, 0.8],      // Ctrl+V, 입력창 전체, 보내기
  [31.30, K('synk-sound-earn.wav'), 0.45], [32.05, made.tick2, 0.5],                  // 결과, 표 확대
  [34.08, made.swish, 0.35], [37.08, made.swish, 0.35], [39.35, made.tick2, 0.6],     // 원문 쪽지, 확인 필요, 자료
  [42.70, made.tok, 0.35], [43.98, made.swish, 0.8],                                 // 주소, 서명 실땀
];
const inputs = [], parts = [], labels = [];
pieces.forEach((p, i) => {
  inputs.push('-ss', String(p.from), '-t', String(p.to - p.from), '-i', VOX);
  const ms = Math.round(p.at * 1000 - 80);
  parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.04,afade=t=out:st=${(p.to - p.from - 0.12).toFixed(3)}:d=0.12,adelay=${Math.max(0, ms)}|${Math.max(0, ms)}[v${i}]`);
  labels.push(`[v${i}]`);
});
let k = pieces.length;
SFX.forEach(([t, f, vol]) => {
  inputs.push('-i', f);
  const ms = Math.round(t * 1000);
  parts.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${vol},adelay=${ms}|${ms}[s${k}]`);
  labels.push(`[s${k}]`);
  k++;
});
// 음악: 앞 0.4초 페이드인, 끝 1.2초 페이드아웃, 목소리가 있을 때 사이드체인으로 낮춘다
inputs.push('-i', BGM);
const bgmIdx = k;
// 목소리 합을 영상 끝까지 무음으로 채운 뒤 나눈다 — 사이드체인이 먼저 끝나면 배경음도 같이 끊긴다(10-13 검수 P1)
const voiceMix = `${pieces.map((_, i) => `[v${i}]`).join('')}amix=inputs=${pieces.length}:normalize=0[vox0];[vox0]apad=whole_dur=${DUR}[vox];[vox]asplit=2[vox1][vox2]`;
const bgm = `[${bgmIdx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${DUR},afade=t=in:d=0.4,afade=t=out:st=${DUR - 1.2}:d=1.2,volume=0.42[bgm0];[bgm0][vox2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[bgm]`;
const sfxLabels = labels.slice(pieces.length).join('');
const graph = `${parts.join(';')};${voiceMix};${bgm};[vox1][bgm]${sfxLabels}amix=inputs=${2 + SFX.length}:normalize=0:dropout_transition=0,apad=whole_dur=${DUR},atrim=0:${DUR}[m]`;
const raw = path.join(MEDIA, 'mix_raw.wav');
ff([...inputs, '-filter_complex', graph, '-map', '[m]', '-ar', '48000', raw]);
const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const st = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
const out = path.join(MEDIA, 'mix.m4a');
ff(['-i', raw, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${st.input_i}:measured_TP=${st.input_tp}:measured_LRA=${st.input_lra}:measured_thresh=${st.input_thresh}:offset=${st.target_offset}:linear=true,aresample=48000`,
  '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), out]);
console.log('만듦', path.relative(REPO, out), '문장', pieces.length, '효과음', SFX.length, '처음 음량', st.input_i);
for (const c of caps) console.log(c.id, c.at, c.end, c.words.map((w) => `${w.w}@${w.t}`).join(' '));
