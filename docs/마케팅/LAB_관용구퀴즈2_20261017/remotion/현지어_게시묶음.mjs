// 나라별 채널판(10-18) 게시 묶음: 채널 폴더마다 게시문안.txt(제목·설명)를 쓰고, 전체 목록 README.md를 만든다.
//   node 현지어_게시묶음.mjs   → ../게시/03-나라별/<채널 id>/게시문안.txt · ../게시/03-나라별/README.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANNELS, LOCALES } from './src/kids/locales.ts';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POST = path.join(ROOT, '..', '게시', '03-나라별');
const 문안 = JSON.parse(fs.readFileSync(path.join(POST, '문안.json'), 'utf8'));
const PLATFORM = { youtube: '유튜브 쇼츠', rutube: '루튜브', facebook: '페이스북 릴스', tiktok: '틱톡', telegram: '텔레그램', xiaohongshu: '샤오훙수' };

const rows = [];
for (const c of CHANNELS) {
  const dir = path.join(POST, c.id);
  const t = 문안[c.lang];
  if (!t) throw new Error(`문안 없음: ${c.lang}`);
  const plat = c.id.split('-').pop();
  const titled = plat === 'youtube' || plat === 'rutube';
  fs.writeFileSync(path.join(dir, '게시문안.txt'), `${titled ? `[제목]\n${t.title}\n\n[설명]\n` : '[캡션]\n'}${t.description}\n`, 'utf8');
  const mb = (fs.statSync(path.join(dir, 'video.mp4')).size / 1048576).toFixed(1);
  rows.push(`| ${c.id} | ${PLATFORM[plat] ?? plat} | ${c.handle} | ${c.lang === 'en' ? 'English' : LOCALES[c.lang].name} | ${mb}MB |`);
}
fs.writeFileSync(path.join(POST, 'README.md'), [
  '# 관용구 퀴즈 #2 · 나라별 채널판(10-18)',
  '',
  '유호님 「똑같은 내용으로 언어만 해당 나라 언어로」. 26개 채널, 영상 36초 1080×1920, 소리 −14.2 LUFS. 영어 채널은 @synkkorean 영어판에 끝 계정만 바꿨고, 나머지는 화면 글을 그 나라 말로 바꾸고 나레이션은 한국어로만 말하는 몽골어판 소리를 그대로 쓴다.',
  '폴더마다 `video.mp4`(git 밖) · `upload.mp4`(크롬 확장 올리기 10MB 제한용 2Mbps 사본, 7.3MB 안팎, 원본과 SSIM 0.996) · `cover.png`(1.3초, 오답 딱지 장면) · `게시문안.txt`. 문안 정본은 `문안.json`, 화면 글 정본은 `remotion/src/kids/locales.ts`.',
  '검토: 초안(Claude) → Fable 교정 → 제미나이 검문(문법 아르곤 · 직역 역번역 flash, `tools/현지어대조.js`, 결과 `검문/`) → 역번역 뜻 대조(`검문/뜻대조.txt`). 원어민 검수는 없다. 싱할라어 ZWJ 지적은 바이트로 확인한 오판.',
  '다시 만들기: `cd remotion && node 현지어_렌더.mjs [cc …]` → `node 현지어_게시묶음.mjs`.',
  '',
  '| 채널 | 플랫폼 | 끝 화면 계정 | 화면 글 | 영상 |',
  '|---|---|---|---|---|',
  ...rows,
  '',
].join('\n'), 'utf8');
console.log(rows.length, '채널 → README.md');
