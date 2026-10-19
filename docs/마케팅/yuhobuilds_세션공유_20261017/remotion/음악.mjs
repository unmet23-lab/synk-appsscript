// 본편 배경음을 이야기 구조에 맞춰 잘라 붙인다: node 음악.mjs  (remotion 폴더에서) → public/bgm_a.wav · public/bgm_e.wav
// 원곡: 「Building Momentum」(Gemini Ultra · Lyria 3.5, 10-17, SHIFT 편과 같은 곡 — 시험판을 보고 「이 방향 좋아」).
// 실측(SHIFT 콘티): 122.863 BPM, 첫 박 0.054초, 드럼 빠짐 12박(5.91초)·76박(37.17초), 조용한 구간 48~64박(23.49~31.31초),
// 다시 터지는 박 16·64·80박, 끝맺음 108박(52.80초)부터.
// 자르는 곳(마디 경계 4박씩 두 번): 40~44박(그루브 한 마디)과 56~60박(조용한 구간 한 마디).
//   → 조용한 구간이 06(거절 1,086번)이 시작하는 44박에 오고, 다시 터지는 박이 「저장 안 됨」 도장인 56박에,
//     둘째 드럼 빠짐이 08 「계정마다」 68박에, 끝맺음이 11 「링크는」 100박에 온다. 박 격자는 그대로 이어진다.
// 유튜브 E판은 훅이 2박 길어 맨 앞에 첫 2박을 한 번 더 붙인다(뒤는 A판과 같다).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const SRC = path.join(REPO, 'docs/홍보물/BGM/SHIFT구독판_BuildingMomentum_gemini_20261017.mp3');
const BEAT = 60 / 122.863;
const t = (k) => +(0.054 + k * BEAT).toFixed(4);
const X = 0.02; // 이음매 교차 길이(초)

const build = (segments, out) => {
  const parts = segments.map(([s, e], i) => {
    const end = i < segments.length - 1 ? e + X : e;
    return `[0:a]atrim=start=${s}:end=${end.toFixed(4)},asetpts=PTS-STARTPTS[s${i}]`;
  });
  let chain = '[s0]';
  const fades = [];
  for (let i = 1; i < segments.length; i++) {
    const o = i === segments.length - 1 ? '[mix]' : `[x${i}]`;
    fades.push(`${chain}[s${i}]acrossfade=d=${X}:c1=qsin:c2=qsin${o}`);
    chain = o;
  }
  const filter = [...parts, ...fades].join(';');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SRC, '-filter_complex', filter, '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(HERE, 'public', out)]);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(HERE, 'public', out)]).toString().trim();
  console.log(`public/${out} ${(+dur).toFixed(2)}초`);
};

// 10-18 끝을 댓글 「세션」 + 팔로우로 바꿔 말이 4초 늘었다 → 끝맺음 바로 앞 마디(104~108박)를 한 번 더 넣어,
// 끝맺음이 본편 104박(50.8초) 「(링크) 보내 (드려요)」에 오고 「팔로우하면 …」은 그 여운 위에 간다.
const A = [
  [0, t(40)],
  [t(44), t(56)],
  [t(60), t(108)],
  [t(104), t(108)],
  [t(108), 57.9],
];
build(A, 'bgm_a.wav');
// E판(지금은 쓰지 않음)은 옛 끝(100박 끝맺음) 그대로 둔다
build([[0, t(2)], [0, t(40)], [t(44), t(56)], [t(60), 57.9]], 'bgm_e.wav');
