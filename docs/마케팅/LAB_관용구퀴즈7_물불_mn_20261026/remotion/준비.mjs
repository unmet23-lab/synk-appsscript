// 이 편이 쓰는 보유 자산을 public/ 에 복사한다: node 준비.mjs  (remotion 폴더에서)
// public/ 은 이 편에 필요한 작은 파일만 둔다(약 4MB). 원본은 고치지 않는다.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'public');

const 목록 = [
  // BGM은 이 편을 위해 Suno로 새로 만든 곡(받은 뒤 public/bgm.mp3에 둔다 — 아래 목록 밖).
  // 효과음: 한강2126 편에서 합성한 것(v11) + LAB ㄹ 편에서 합성한 것 + 브랜드 사운드 킷
  ...['boom', 'riser', 'snap', 'thud', 'ring', 'whoosh_up', 'whoosh_down', 'whoosh_side'].map((n) => [
    `docs/마케팅/한강2126_포트폴리오_20260930/video/효과음/합성효과음_v11/${n}.wav`, `sfx/${n}.wav`]),
  ...['tick', 'tick2', 'tok', 'swish'].map((n) => [`docs/마케팅/LAB_ㄹ_R또는L_20261012/kit-v1/assets/media/${n}.wav`, `sfx/${n}.wav`]),
  ['영상/public/소리/synk-sound-earn.wav', 'sfx/earn.wav'],
  ['영상/public/소리/synk-sound-achieve.wav', 'sfx/achieve.wav'],
  // 그림: LAB 펠트 로고, 몽글(응원) — SNS 키트 승인 자산
  ['docs/디자인/SNS키트/assets/logo-lab.webp', 'img/logo-lab.webp'],
  ['docs/디자인/SNS키트/assets/mascot-몽글_응원.webp', 'img/mongle-cheer.webp'],
  // 서체(OFL): 한글 SUIT 가변, 라틴 Inter Tight, 모노 DM Mono
  ['docs/브랜드_폰트/SUIT/SUIT-Variable.woff2', 'fonts/SUIT-Variable.woff2'],
  ['docs/브랜드_폰트/InterTight/InterTight-Bold.ttf', 'fonts/InterTight-Bold.ttf'],
  ['docs/브랜드_폰트/InterTight/InterTight-SemiBold.ttf', 'fonts/InterTight-SemiBold.ttf'],
  ['docs/브랜드_폰트/InterTight/InterTight-Medium.ttf', 'fonts/InterTight-Medium.ttf'],
  ['docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf', 'fonts/DMMono-Medium.ttf'],
];

for (const [원본, 자리] of 목록) {
  const 원 = path.join(REPO, 원본);
  if (!fs.existsSync(원)) throw new Error(`원본 없음: ${원본}`);
  const 끝 = path.join(OUT, 자리);
  fs.mkdirSync(path.dirname(끝), { recursive: true });
  fs.copyFileSync(원, 끝);
}
// ㄹ 편의 똑딱·스침은 그 편 믹스 안 크기(최대 −24dB)라 단독으로 쓰면 안 들린다. 최대 −3dB로 맞춘다.
for (const n of ['tick', 'tick2', 'swish']) {
  const f = path.join(OUT, 'sfx', `${n}.wav`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(r.stderr)[1]);
  const tmp = f.replace('.wav', '.tmp.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-af', `volume=${(-3 - peak).toFixed(1)}dB`, tmp]);
  fs.renameSync(tmp, f);
}
console.log(`${목록.length}개 → public/`);
