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
  ...['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C12b', 'C13', 'C14'].map((c) => [path.join(V, '정지컷', '색감', `${c}.jpg`), `stills/${c}.jpg`]),
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
  // ── 콘티 v3(10-22 반응 조사, 03_콘티_v3.md) ──
  // 공포 대사 자막 서체 — 가는 명조 Noto Serif KR(SIL OFL, 윈도우 글꼴 폴더의 가변 글꼴)
  ['C:/Windows/Fonts/NotoSerifKR-VF.ttf', 'fonts/NotoSerifKR-VF.ttf'],
  // 정지컷 v3(정지컷_준비_v3.py — 공포 컷은 붉은밤, 쇼호스트 컷은 방송 색 그대로, C09b는 블렌더 렌더)
  ...['C01a', 'C01a_bg', 'C02v3', 'C03v3', 'C05v3', 'C05v3cu', 'C07v3', 'C09v3', 'C09b', 'C11b', 'E3', 'H1a', 'H2c', 'H3d', 'E2'].map((c) => [path.join(V, '정지컷', '색감', `${c}.jpg`), `stills/${c}.jpg`]),
  // 꽉 뚜껑 잠금 접사(블렌더/밀폐용기.py --latch) — 24장
  ...Array.from({ length: 24 }, (_, i) => {
    const n = `latch_${String(i + 1).padStart(4, '0')}.png`;
    return [path.join(V, '블렌더', '2안', 'latch', n), `kkwak/${n}`];
  }),
  // 새로 구운 목소리(목소리/계획_v3.json → vo_v3 — 굽기 도구는 출력 폴더에서 「계획에 없는 지난 줄」을 지우니 v2 줄과 폴더를 나눈다)와 합성 효과음(소리_v3.py)
  ...['HS1v3', 'HS3cv3', 'E2', 'ARS', 'R6'].map((n) => [path.join(V, '목소리', 'vo_v3', `${n}.wav`), `vo/${n}.wav`]),
  ...['heartbeat', 'ringback', 'ringback_short', 'doorbell'].map((n) => [path.join(V, '소리_v3', `${n}.wav`), `sfx/${n}.wav`]),
  // 칼날 스치는 소리(C01b) · 스튜디오 관객 환호(홈쇼핑 칸) — Sonniss GDC 2026
  [path.join(LIB, 'sonniss_gdc2026', '풀림', 'David Dumais Audio - Melee Weapons Sound Effects Pack 2', 'METLFric_SWING SCRAPE Swift Melee Weapon Swing With A Long Blade 14_DDUMAIS_MWP2.wav'), 'amb/blade.wav'],
  [path.join(LIB, 'sonniss_gdc2026', '풀림', 'Sonik Sound Library - Spanish Crowds', 'CRWDCheer_Small Club, 50 People, Crowd, Spanish, Cheering and Applause-Surround_KSL_KS015.wav'), 'amb/cheer.wav'],
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
const { execFileSync } = await import('node:child_process');
if (fs.existsSync(phone)) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', phone, '-af', 'volume=26.8dB,alimiter=limit=0.5:level=false', path.join(OUT, 'amb', 'phone_n.wav')]);
}
// 콘티 v3: 관객 환호는 5.1채널 · 칼날은 96kHz 원본이라 가편집용 스테레오 48kHz 사본을 만든다(환호는 앞 10초만)
for (const [src, dst, extra] of [['cheer.wav', 'cheer2.wav', ['-t', '10']], ['blade.wav', 'blade48.wav', []]]) {
  const s = path.join(OUT, 'amb', src);
  if (fs.existsSync(s)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', s, ...extra, '-ac', '2', '-ar', '48000', path.join(OUT, 'amb', dst)]);
}
// ARS 안내는 휴대폰에서 새는 소리로 — 전화 대역(300~3400Hz)만 남기고 살짝 찌그러뜨린 사본(vo/ARS_tel.wav)
const ars = path.join(OUT, 'vo', 'ARS.wav');
if (fs.existsSync(ars)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', ars, '-af', 'highpass=f=300,lowpass=f=3400,acompressor=threshold=0.1:ratio=6,volume=-4dB', path.join(OUT, 'vo', 'ARS_tel.wav')]);
console.log(`public/: 새로 ${copied} · 그대로 ${same} · 없음 ${missing.length}`, Object.keys(groups).length ? groups : '');
