// 이 편이 쓰는 자산을 public/ 에 모은다: node 준비.mjs  (remotion 폴더에서). 원본은 고치지 않고, 이미 같은 크기로 있으면 건너뛴다.
// 미디어 원본은 git 밖 Documents/synk-vendor/homeshopping-horror-20261021/ 에 있다(블렌더 렌더 · 정지컷 · 목소리 · 글꼴).
// 아직 없는 자산은 「없음」으로 알리고 넘어간다 — 자산이 생길 때마다 다시 돌린다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..', '..', '..');
const MAIN = path.join(os.homedir(), 'Documents', 'SYNK-appsscript');   // 공용 작업본(워크트리에서 뺀 큰 미디어 폴더가 있는 곳)
const V = path.join(os.homedir(), 'Documents', 'synk-vendor', 'homeshopping-horror-20261021');
const LIB = path.join(os.homedir(), 'Documents', 'synk-vendor', 'sound-library');
const OUT = path.join(HERE, 'public');
const S16 = 'docs/마케팅/LAB_TOPIK관용구_20261013/remotion/public';
const repoOrMain = (rel) => [path.join(REPO, rel), path.join(MAIN, rel)].find((p) => fs.existsSync(p)) || path.join(REPO, rel);

const 목록 = [
  // 서체: 홈쇼핑 소품 글자 Black Han Sans · Anton(둘 다 SIL OFL, google/fonts에서 받음), 끝 문구 SUIT · Inter Tight(S16과 같은 판)
  [path.join(V, 'fonts', 'BlackHanSans-Regular.ttf'), 'fonts/BlackHanSans-Regular.ttf'],
  [path.join(V, 'fonts', 'Anton-Regular.ttf'), 'fonts/Anton-Regular.ttf'],
  ...['SUIT-Variable.woff2', 'InterTight-Bold.ttf', 'InterTight-SemiBold.ttf'].map((n) => [path.join(REPO, S16, 'fonts', n), `fonts/${n}`]),
  // 효과음: S16 키트(딱지 「뿅」 · 딩 · 쿵 · 반짝)
  ...['pop', 'ding1', 'ding2', 'ding3', 'boing', 'boom', 'snap', 'sparkle', 'swish', 'thud', 'tick', 'riser', 'earn', 'whoosh_down'].map((n) => [path.join(REPO, S16, 'sfx', `${n}.wav`), `sfx/${n}.wav`]),
  // 회전 받침 위 병(블렌더/돌림판.py) — 120장 + 받침만 1장
  ...Array.from({ length: 120 }, (_, i) => {
    const n = `full_${String(i + 1).padStart(4, '0')}.png`;
    return [path.join(V, '블렌더', 'full', n), `bottle/${n}`];
  }),
  [path.join(V, '블렌더', 'pedestal', 'pedestal_0001.png'), 'bottle/pedestal.png'],
  // 2안 꽉 진공 밀폐용기(블렌더/밀폐용기.py) — 쌓은 탑 · 뚜껑 하나, 96장씩
  ...['stack', 'lid'].flatMap((what) => Array.from({ length: 96 }, (_, i) => {
    const n = `${what}_${String(i + 1).padStart(4, '0')}.png`;
    return [path.join(V, '블렌더', '2안', what, n), `kkwak/${n}`];
  })),
  // 정지컷(고른 판에 붉은밤 색감을 입힌 것 — 정지컷/색감/<컷>.jpg)
  ...['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14'].map((c) => [path.join(V, '정지컷', '색감', `${c}.jpg`), `stills/${c}.jpg`]),
  // 목소리(나레이션굽기.mjs 출력)
  ...['R1', 'R2', 'R3', 'R4', 'R5', 'V1', 'V2', 'HS1', 'HS2', 'HS3a', 'HS3b', 'HS3c', 'HS4', 'SCREAM'].map((n) => [path.join(V, '목소리', 'vo', `${n}.wav`), `vo/${n}.wav`]),
  // 임시 음악(가편집용, 최종은 Suno) — BGM 모음의 밝은 곡
  [repoOrMain('docs/홍보물/BGM/01_Joyful-Happy-Upbeat_alex-morgan.mp3'), 'music/hs.mp3'],
  // 공포 쪽 소리(Sonniss GDC 2026 · Fairlight 모음)
  [path.join(LIB, 'sonniss_gdc2026', '풀림', 'Alexander Kopeikin - Emotion and Magic', 'magic, drone, tension, spellbound, evanescence-002.wav'), 'amb/drone.wav'],
  [path.join(LIB, 'sonniss_gdc2026', '풀림', 'Cinematic Sound Design - Sci-Fi Drones', 'Dark Industrial Ambience.wav'), 'amb/dark.wav'],
  [path.join(LIB, 'fairlight', 'Media Files', 'FS Creaky Attic Floor.wav'), 'amb/creak.wav'],
  [path.join(LIB, 'fairlight', 'Media Files', 'Wood Floor Creaks and Ground.M.wav'), 'amb/creak2.wav'],
  [path.join(LIB, 'sonniss_gdc2026', '풀림', 'Epic Stock Media - AAA Game Character British Female Detective', 'VOXCry_British Detective Crying Vocal Female Low Energy Weep_ESM_AAAGCBFD.wav'), 'amb/weep.wav'],
  [path.join(LIB, 'sonniss_gdc2026', '풀림', '344 Audio - Haunting Ambiences Vol. 5', "FIRECrkl_Fire Crackling, Popping, Witch's Cauldron_344 Audio_Haunting Ambiences Vol 5.wav"), 'amb/candle.wav'],
  [path.join(LIB, 'fairlight', 'Media Files', 'Cell phone taps.M.wav'), 'amb/phone.wav'],
  [path.join(LIB, 'fairlight', 'Media Files', 'Metal Hit.M.wav'), 'amb/knife.wav'],
];

let copied = 0, same = 0;
const missing = [];
for (const [src, to] of 목록) {
  const dst = path.join(OUT, to);
  if (!fs.existsSync(src)) { missing.push(to); continue; }
  if (fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) { same++; continue; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  copied++;
}
const groups = {};
for (const m of missing) { const g = m.split('/')[0]; groups[g] = (groups[g] || 0) + 1; }
// 폰 진동 소리는 원본 피크가 −32.8dBFS라 들리지 않았다(Fable P2) — −6dBFS로 맞춘 사본을 만든다
const phone = path.join(OUT, 'amb', 'phone.wav');
if (fs.existsSync(phone)) {
  const { execFileSync } = await import('node:child_process');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', phone, '-af', 'volume=26.8dB,alimiter=limit=0.5:level=false', path.join(OUT, 'amb', 'phone_n.wav')]);
}
console.log(`public/: 새로 ${copied} · 그대로 ${same} · 없음 ${missing.length}`, Object.keys(groups).length ? groups : '');
