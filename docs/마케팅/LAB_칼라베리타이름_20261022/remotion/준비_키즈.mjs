// 키즈판 자산: node 준비_키즈.mjs  (remotion 폴더에서)
// 마스코트는 정본 4K(docs/캐릭터/정본_4K, tools/lib/마스코트자산.js가 가리키는 곳)를 900px RGBA PNG로 줄인다
// (yuva420p 같은 손실 변환을 쓰면 가장자리에 흰 네모가 생긴다 — SNS 키트 §6).
// 효과음: 브랜드 사운드 킷의 몽글 소리 + 이 편에서 만드는 「보잉」「뽁」(사인파, 짧게).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);

const MASCOTS = ['몽글_궁금함', '몽글_놀람', '몽글_뾰로통', '몽글_민망', '몽글_집중', '몽글_별눈', '몽글_눈웃음', '몽글_응원', '까몽_응원', '마린_응원'];
fs.mkdirSync(path.join(OUT, 'img', 'mascot'), { recursive: true });
for (const m of MASCOTS) {
  const src = path.join(REPO, 'docs', '캐릭터', '정본_4K', `${m}.png`);
  if (!fs.existsSync(src)) throw new Error('정본 없음: ' + m);
  ff(['-i', src, '-vf', 'scale=900:-1:flags=lanczos,format=rgba', '-frames:v', '1', path.join(OUT, 'img', 'mascot', `${m}.png`)]);
}

// 몽글 소리(브랜드 사운드 킷): 미이 · 뿌우 · 먀앙 · 무우움
fs.mkdirSync(path.join(OUT, 'sfx'), { recursive: true });
for (const [from, to] of [['synk-voice-mii', 'mongle_mii'], ['synk-voice-ppuu', 'mongle_ppuu'], ['synk-voice-myang', 'mongle_myang'], ['synk-voice-muum', 'mongle_muum']]) {
  fs.copyFileSync(path.join(REPO, '영상', 'public', '소리', `${from}.wav`), path.join(OUT, 'sfx', `${to}.wav`));
}
// 보잉: 220Hz에 잦아드는 떨림 · 0.5초 / 뽁: 높은 데서 떨어지는 짧은 사인 · 0.08초 / 반짝: 두 음(C6·G6) 짧게
ff(['-f', 'lavfi', '-i', "aevalsrc='0.55*sin(2*PI*(200+90*sin(2*PI*13*t)*exp(-5*t))*t)*exp(-4*t)':s=48000:d=0.5", path.join(OUT, 'sfx', 'boing.wav')]);
ff(['-f', 'lavfi', '-i', "aevalsrc='0.7*sin(2*PI*(1100-700*t/0.08)*t)*exp(-t*40)':s=48000:d=0.08", path.join(OUT, 'sfx', 'pop.wav')]);
ff(['-f', 'lavfi', '-i', "aevalsrc='0.35*(sin(2*PI*1047*t)*exp(-t*9)+sin(2*PI*1568*max(t-0.07,0))*exp(-max(t-0.07,0)*8)*gte(t,0.07))':s=48000:d=0.45", path.join(OUT, 'sfx', 'sparkle.wav')]);
// 정답 「딩」: 문제마다 한 음씩 올린다(온음씩 1 → 1.12 → 1.26배 — 보상이 점점 커지게). asetrate로 음높이째 올림
const earn = path.join(OUT, 'sfx', 'earn.wav');
const sr = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', earn]).toString().trim());
for (const [i, rate] of [[1, 1], [2, 1.122], [3, 1.26]]) {
  ff(['-i', earn, '-af', `asetrate=${sr}*${rate},aresample=48000`, path.join(OUT, 'sfx', `ding${i}.wav`)]);
}
console.log(`마스코트 ${MASCOTS.length} · 효과음 7 → public/`);
