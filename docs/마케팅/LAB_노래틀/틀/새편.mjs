#!/usr/bin/env node
// LAB 노래 한 편 세우기(2026-11-11, 리듬 한국어 준비안 「라」 줄) — 퀴즈 은행 틀의 새편.mjs와 같은 몫.
//
//   node docs/마케팅/LAB_노래틀/틀/새편.mjs <편 폴더> --곡 <하루 판 .wav> --정본 <song.json> [--그림 <그림 파일>] [--기준 <기준.json>] [--갱신]
//
// 만드는 것(편 폴더 아래):
//   remotion/ — 틀의 src · 설정 사본, node_modules는 퀴즈 은행 틀의 것을 junction(틀 폴더의 node_modules가 이미 그쪽을 가리킨다),
//              public/fonts(퀴즈 은행 틀 public/fonts 사본) · public/song.wav · public/song.json · (그림)  — 편의 public은 git에 넣는다(판본 자산 지문 · 아래 ①). 틀 자리의 public만 git 밖
//   판본지도.json — song.json의 짜임(parts)에서 줄 · 시각 · 상자를 뽑은 판본지도/1(틀 「노래」). 뜻 검사 기준은 --기준(한문장 · 핵심 · 웃음)
//   판본렌더.mjs — 이야기 편 판본렌더.mjs를 접두 song · 판본폴더 remotion/src/판본으로(소리 마감 −14.5 LUFS · 표지 · 렌더.json 그대로)
// --갱신: remotion/src만 틀에서 다시 복사(판본 글 src/판본은 그대로) — 동결한 편에는 쓰지 않는다(설계 20).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 틀 = path.dirname(fileURLToPath(import.meta.url));
const REAL_LEAD = 0.5; // src/Song.tsx REAL_LEAD와 같은 값
const 뿌리 = path.resolve(틀, '..', '..', '..', '..');
const 인자 = process.argv.slice(2);
const 값 = (n) => { const i = 인자.indexOf(n); return i > -1 ? 인자[i + 1] : null; };
const 값플래그 = new Set(['--곡', '--정본', '--그림', '--기준']);
let 편 = null;
for (let i = 0; i < 인자.length; i++) { if (값플래그.has(인자[i])) { i++; continue; } if (!인자[i].startsWith('--')) { 편 = 인자[i]; break; } }
if (!편) { console.error('사용: node 새편.mjs <편 폴더> --곡 <wav> --정본 <song.json> [--그림 <파일>] [--기준 <json>] [--갱신]'); process.exit(2); }
const 편폴더 = path.resolve(편);
const 사본 = path.join(편폴더, 'remotion');
const 갱신 = 인자.includes('--갱신');

// ① remotion 사본
fs.mkdirSync(path.join(사본, 'src', '판본'), { recursive: true });
for (const f of fs.readdirSync(path.join(틀, 'src'))) {
  const s = path.join(틀, 'src', f);
  if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(사본, 'src', f));
}
if (!갱신) {
  for (const f of ['package.json', 'remotion.config.ts', 'tsconfig.json']) fs.copyFileSync(path.join(틀, f), path.join(사본, f));
  // 편의 public(곡 · 그림 · 글꼴 · song.json)은 git에 넣는다 — 판본 렌더 기록의 자산 지문(tools/lib/판본잇기.js 자산지문)이 public · src를 세어,
  // 게시 회차 사본(HEAD)에 public이 없으면 모든 판본이 「렌더 뒤 자산이 바뀌었다」로 돌림에서 빠진다. 틀의 .gitignore(public/)는 틀 자리에만 맞다.
  fs.writeFileSync(path.join(사본, '.gitignore'), 'out/\npublic/move.mp4\n'); // move.mp4 = 몽글이 움직이는 영상(움직임잇기.py — mp4는 저장소에 넣지 않는다)
  const 모듈 = path.join(사본, 'node_modules');
  if (!fs.existsSync(모듈)) {
    const 틀모듈 = fs.realpathSync(path.join(틀, 'node_modules'));
    fs.symlinkSync(틀모듈, 모듈, 'junction');
  }
  const 글꼴 = path.join(사본, 'public', 'fonts');
  fs.mkdirSync(글꼴, { recursive: true });
  // 틀의 public은 git 밖이라 워크트리에는 없다 — 이미 글꼴이 든 편(다시 세우기)은 그대로 둔다(11-14)
  const 틀글꼴 = path.join(틀, 'public', 'fonts');
  if (fs.existsSync(틀글꼴)) for (const f of fs.readdirSync(틀글꼴)) fs.copyFileSync(path.join(틀글꼴, f), path.join(글꼴, f));
  else if (!fs.readdirSync(글꼴).length) { console.error(`글꼴 없음: ${틀글꼴} — 공용 작업본 틀의 public/fonts를 쓴다`); process.exit(2); }
}
const 곡 = 값('--곡'), 정본 = 값('--정본'), 그림 = 값('--그림');
if (곡) fs.copyFileSync(path.resolve(곡), path.join(사본, 'public', 'song.wav'));
if (그림) fs.copyFileSync(path.resolve(그림), path.join(사본, 'public', path.basename(그림)));
let doc = null;
if (정본) {
  doc = JSON.parse(fs.readFileSync(path.resolve(정본), 'utf8'));
  doc.audio = 'song.wav';
  if (그림) doc.stage = { ...doc.stage, [doc.stage.mode === 'mongle' ? 'img' : 'pic']: path.basename(그림) };
  fs.writeFileSync(path.join(사본, 'public', 'song.json'), JSON.stringify(doc, null, 1) + '\n');
} else if (fs.existsSync(path.join(사본, 'public', 'song.json'))) doc = JSON.parse(fs.readFileSync(path.join(사본, 'public', 'song.json'), 'utf8'));
if (갱신) { console.log('src 갱신 끝 —', path.relative(뿌리, 사본)); process.exit(0); }

// ② 판본지도.json — song.json 짜임에서
if (doc) {
  const P = (k) => doc.parts.filter((p) => p.kind === k);
  const [count] = P('count');
  const wholes = P('whole');
  const [restClap] = doc.parts.filter((p) => p.kind === 'rest' && p.mode === 'clap');
  const [restSay] = doc.parts.filter((p) => p.kind === 'rest' && p.mode === 'say');
  const [real] = P('real');
  const [end] = P('end');
  const 초 = (a, b) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100];
  const n = doc.syl.length;
  // 상자는 Song.tsx의 글 자리 그대로(글은 왼쪽 정렬 · 폭 824 = x 96~920 — 글자 검사 안전선, 딱지 셋은 앞 점 몫을 뺀 760). 음절 글자 크기 G와 읽기 칸 폭은 Song.tsx와 같은 식
  const 사이 = n <= 3 ? 44 : 32;
  const G = Math.min(230, Math.floor((824 - (n - 1) * 사이) / n / 0.98)); // Song.tsx TEXT_W(920 − 96)
  // 상자: 글자크기는 그 칸이 줄여 내려가는 가장 작은 크기(그 크기로도 최대줄을 넘으면 화면에서 넘친다)
  const 줄 = [
    { id: 'bridge', 칸: '머리', 값: 'bridge', 원문: doc._원문?.bridge, 초: 초(count.t, count.end),
      // 앞마디(11-15 편만들기.py --읽기 — 다리 글을 읽을 시간이 모자라면 노래 앞에 반주 마디를 붙인다)가 있으면 장면에 적는다
      장면: `(${count.intro ? `반주만 ${Math.round(count.intro / (240 / doc.bpm))}마디 흐른 뒤 ` : ''}카운트인 한 마디) 한국어 노래 목소리가 박을 센다. 위는 그림 카드, 아래 글 자리에 이 글이 크게(검정 굵은 글, 왼쪽 정렬) — 이 낱말을 쓰는 상황 한 줄`,
      상자: { 폭: 824, 글자크기: 56, 굵기: 800, 줄높이: 1.12, 최대줄: 4 } },
    ...doc.syl.map((s, i) => ({ id: `ko.${i + 1}`, 칸: '한국어', 글: s, 초: 초(doc.parts.find((p) => p.kind === 'chop').t, end.t),
      장면: `(노래 내내) 그림 카드 아래 큰 한글 「${doc.word}」을 상자 없이 한 음절씩 — 노래가 그 음절을 부를 때 그 글자가 코랄로 쾅 켜진다` })),
    // 노래만 판(11-14 유호님 「노래만으로」 — 네 차례 두 마디 없음)은 손뼉 · 말하기 줄이 없어, 따라 하고 싶은 자리가 노래가 되풀이하는 음절 읽기다
    ...doc.syl.map((s, i) => ({ id: `read.${i + 1}`, 칸: '읽기', 값: `read.${i}`, 초: 초(doc.parts.find((p) => p.kind === 'chop').t, end.t),
      ...(restClap || restSay ? {} : { 대조: '웃음' }),
      상자: { 폭: G + 사이 - 8, 글자크기: 26, 굵기: 600, 줄높이: 1.15, 최대줄: 1, 줄바꿈: 'nowrap', 가운데: true } })),
    { id: 'mean', 칸: '뜻', 값: 'mean', 원문: doc._원문?.mean, 초: 초(wholes[0].at[0] + 0.25, end.t),
      장면: '노래가 낱말을 이어 부르면 음절 글자 아래 한 줄로 이 뜻 글이 흐림에서 또렷하게 들어온다(글 앞뒤에 다른 표시 없음)',
      상자: { 폭: 790, 글자크기: 44, 굵기: 800, 줄높이: 1.1, 최대줄: 1, 줄바꿈: 'nowrap' } }, // 화면은 뜻 글만 그린다(「=」 표시는 v10에서 뺐다 — 11-14 지도 장면에 「= 뜻」이 남아 시험관이 「뜻」 글자를 화면 글로 읽었다). 폭은 「—— 」를 붙여 잰다(Song.tsx fitBox)
    ...(restClap ? [{ id: 'clap', 칸: '진행', 값: 'clap', 대조: '웃음', 원문: doc._원문?.clap, 초: 초(restClap.t, restClap.end),
      장면: '(반주만 흐르는 한 마디 — 시청자 차례) 음절 글자가 흐려지고, 위에 코랄 글로 이 글(손뼉 치기), 맨 아래 박 막대가 굵어져 박마다 켜진다',
      상자: { 폭: 760, 글자크기: 36, 굵기: 800, 줄높이: 1.1, 최대줄: 1, 줄바꿈: 'nowrap' } }] : []),
    { id: 'real', 칸: '진행', 값: 'real', 원문: doc._원문?.real, 초: 초(real.t - REAL_LEAD, real.end), // Song.tsx REAL_LEAD — 딱지가 구간보다 먼저 뜬다
      장면: '노래가 같은 낱말을 실제 말 빠르기로 한 번 부르고(그 0.5초 앞부터), 음절 글자 위에 검정 글(앞에 코랄 점)로 이 글',
      상자: { 폭: 760, 글자크기: 36, 굵기: 800, 줄높이: 1.1, 최대줄: 1, 줄바꿈: 'nowrap' } },
    ...(restSay ? [{ id: 'say', 칸: '진행', 값: 'say', 대조: '웃음', 원문: doc._원문?.say, 초: 초(restSay.t, restSay.end),
      장면: '(반주만 흐르는 한 마디 — 시청자 차례) 다시 음절 글자가 흐려지고 위에 코랄 글로 이 글(소리 내어 말하기), 박 막대가 박마다 켜진다',
      상자: { 폭: 760, 글자크기: 36, 굵기: 800, 줄높이: 1.1, 최대줄: 1, 줄바꿈: 'nowrap' } }] : []),
    { id: 'end', 칸: '끝질문', 값: 'end', 원문: doc._원문?.end, 초: 초(end.t, end.end),
      장면: '노래가 끝나고 반주만 남는 마지막 자리 — 낱말과 뜻이 작은 한 줄로 접히고 그 아래 이 물음이 크게(댓글을 부르는 말)',
      상자: { 폭: 824, 글자크기: 34, 굵기: 800, 줄높이: 1.12, 최대줄: 4 } }, // Song.tsx 끝 물음 — 아래 안전선 안에 드는 가장 큰 크기(가장 작으면 34)
  ];

  const 기준 = 값('--기준') ? JSON.parse(fs.readFileSync(path.resolve(값('--기준')), 'utf8')) : { 한문장: '', 핵심: [], 웃음: '' };
  const 지도 = {
    꼴: '판본지도/1',
    _설명: `LAB 21:00 노래 「${doc.word}」 판본 지도 — docs/마케팅/LAB_노래틀/틀/새편.mjs가 public/song.json 짜임에서 뽑았다. 상자 글자크기는 그 칸이 줄여 내려가는 가장 작은 크기(Song.tsx fitBox) — 그 크기로 최대줄을 넘으면 화면에서 넘친다.`,
    틀: '노래', 판본폴더: 'remotion/src/판본', 낼곳: '게시/판본', 화면: { 폭: 1080, 높이: 1920 },
    기준, 원고기본: { '*': { alteredContent: false }, youtube: { format: 'shorts', madeForKids: false, category: 'Education' } }, 줄,
  };
  const 지도경로 = path.join(편폴더, '판본지도.json');
  if (!fs.existsSync(지도경로) || 인자.includes('--지도다시')) fs.writeFileSync(지도경로, JSON.stringify(지도, null, 2) + '\n');
}

// ③ 판본렌더.mjs — 이야기 편(화날때)의 몸통 그대로, 편 한 줄만
const 원본렌더 = path.join(뿌리, 'docs', '마케팅', 'LAB_화날때_mn_20261031', '판본렌더.mjs');
let 렌더 = fs.readFileSync(원본렌더, 'utf8');
렌더 = 렌더.replace(/const 편 = \{[^}]*\};/, "const 편 = { 접두: 'song', 판본폴더: 'remotion/src/판본' };")
  .replace(/^\/\/ 이 파일은 \S+ 편\(.*$/m,'// 이 파일은 docs/마케팅/LAB_노래틀/틀/새편.mjs가 이야기 편 판본렌더.mjs에서 편 한 줄 · 뿌리 찾기만 바꿔 만든 사본이다(LAB 21:00 노래).')
  // 뿌리: 편 폴더가 docs/마케팅/<편>이 아닐 수도 있어(시험 편 · 공용 작업본) 위로 올라가며 tools/음량마감.mjs가 있는 곳을 찾는다
  .replace("const 뿌리 = path.resolve(여기, '..', '..', '..');",
    "const 뿌리 = (() => { for (let d = 여기; ; d = path.dirname(d)) { if (fs.existsSync(path.join(d, 'tools', '음량마감.mjs'))) return d; if (path.dirname(d) === d) return path.resolve(여기, '..', '..', '..'); } })();");
fs.writeFileSync(path.join(편폴더, '판본렌더.mjs'), 렌더);
console.log('세움 —', path.relative(뿌리, 편폴더), '· remotion · 판본지도.json · 판본렌더.mjs');
