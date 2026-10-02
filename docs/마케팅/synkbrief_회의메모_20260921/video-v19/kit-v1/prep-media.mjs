// synkbrief 1편 분할판(kit-v1) — 원본 v19에서 소리·실제 화면 사본을 두 분할판 프로젝트로 가져온다.
// 쓰는 법: node prep-media.mjs   (kit-v1 폴더에서. ffmpeg 필요)
//
// 렌더 서버는 프로젝트 밖(../)을 읽지 못해 사본을 둔다. 새로 만드는 소리·그림은 없다.
//   audio/  Typecast 은경 구간 wav(v19 audio/ 원본 그대로), 효과음(v19 .media/audio/sfx), BGM(시티팝_147 앞부분을 길이만큼 자른 wav)
//           → .gitignore 대상. 지워져도 이 스크립트로 다시 만든다.
//   assets/ui/  2026-09-23에 찍은 실제 ChatGPT 화면(v19 사본), 따라 하기 PDF v15의 쪽 그림(작은 PNG라 저장소에 둔다)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V19 = path.resolve(HERE, '..');
const FOLLOW = path.resolve(V19, '..', 'follow-along-v15');

const 분할 = {
  'split1-45s': {
    bgm: 47,
    pdfPages: [1, 3, 4],
    voice: ['result', 'prepare', 'paste', 'request', 'send', 'rules', 'ending-follow'],
    ui: ['current/05-result.png', 'current/02-request-only.png', 'current/04-filled.png'],
  },
  'split2-60s': {
    bgm: 61,
    pdfPages: [7, 8, 11],
    voice: ['project-reuse', 'project', 'create', 'settings', 'save', 'global', 'repeat-send', 'ending-follow'],
    ui: ['project/13-second-result.png', 'project/01-projects.png', 'project/02-create.png',
      'project/04-menu.png', 'project/06-instructions.png', 'project/12-second-input.png'],
  },
};
const 효과음 = ['click-soft.wav', 'swish-soft.wav', 'pop-soft.wav', 'sfx_003.mp3'];

for (const [이름, 설정] of Object.entries(분할)) {
  const P = path.join(HERE, 이름);
  const A = path.join(P, 'audio');
  const U = path.join(P, 'assets', 'ui');
  fs.mkdirSync(A, { recursive: true });
  fs.mkdirSync(U, { recursive: true });
  for (const v of 설정.voice) fs.copyFileSync(path.join(V19, 'audio', `${v}.wav`), path.join(A, `vo-${v}.wav`));
  for (const s of 효과음) fs.copyFileSync(path.join(V19, '.media', 'audio', 'sfx', s), path.join(A, s));
  // BGM: 원본 시티팝_147(48kHz 스테레오 PCM) 앞부분을 영상 길이만큼 자른다. 재인코딩 없이 PCM 그대로
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(V19, '.media', 'audio', 'bgm', 'bgm_001.wav'), '-t', String(설정.bgm), '-c:a', 'pcm_s16le', path.join(A, 'bgm.wav')]);
  for (const u of 설정.ui) fs.copyFileSync(path.join(V19, 'assets', u), path.join(U, path.basename(u)));
  // 끝 장면에 보이는 따라 하기 PDF 쪽: 공개 자료 페이지와 같은 v15 PDF를 그대로 그림으로 옮긴다(PyMuPDF)
  const 쪽 = 설정.pdfPages.join(',');
  execFileSync('python', ['-c', `import pymupdf,sys\nd=pymupdf.open(sys.argv[1])\nfor n in [${쪽}]:\n  d[n-1].get_pixmap(dpi=100).save(sys.argv[2]+f'/pdf-p{n:02d}.png')`,
    path.join(FOLLOW, 'synkbrief-meeting-guide-v15.pdf'), U]);
  console.log('준비함', 이름, fs.readdirSync(A).length, '소리 /', fs.readdirSync(U).length, '화면');
}
