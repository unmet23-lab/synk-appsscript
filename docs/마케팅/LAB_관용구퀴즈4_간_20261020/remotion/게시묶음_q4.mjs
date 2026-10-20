// 관용구 퀴즈 #4(10-20) 게시 묶음: 정본 ../게시/문안.json에서 판마다 올릴 글을 쓴다(영상·표지는 렌더_q4.mjs가 같은 폴더에 넣는다).
//   node 게시묶음_q4.mjs → ../게시/01-youtube-en/{원고.json,제목.txt,게시문안.txt,고정댓글.txt} · ../게시/02-mn/{원고.json,캡션_mn.txt,첫댓글_mn.txt} · 03-xiaohongshu-cn · 04-tiktok-mm/게시문안.txt
// 게시(올리기·예약·공개)는 하지 않는다 — 조율 세션이 유호님 「올려」 뒤 한 곳씩 올린다(10-20).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POST = path.join(ROOT, '..', '게시');
const 문안 = JSON.parse(fs.readFileSync(path.join(POST, '문안.json'), 'utf8'));
const put = (dir, name, text) => {
  fs.mkdirSync(path.join(POST, dir), { recursive: true });
  fs.writeFileSync(path.join(POST, dir, name), text.endsWith('\n') ? text : text + '\n', 'utf8');
};

const en = 문안.en;
put('01-youtube-en', '원고.json', JSON.stringify({
  id: '01-youtube-en',
  brand: 'LAB',
  platform: 'youtube',
  account: '@synkkorean',
  format: 'shorts',
  language: 'en',
  audioLanguage: 'en',
  title: en.title,
  caption: en.description,
  pinnedComment: en.pinned_comment,
  alt: [en.alt],
  madeForKids: false,
  alteredContent: false,
  category: 'Education',
  _비고: 'video.mp4 = q4-en(100 BPM, 36.0초, 렌더_q4.mjs). 표지 cover.png = 1.3초(CREEPY KOREAN FACT 알약 + 콩알만 한 간 + liver shrinks to a bean??). 어린이 전용 아님(점수 댓글이 필요 — 퀴즈 #1·#2와 같음). 합성 표시는 필수 아님(펠트 그림·특정인이 아닌 TTS 진행자, 퀴즈 #2와 같음). 동영상 언어 en(영어 진행), 제목·설명 언어 en. 자동 더빙 꺼짐 확인.',
  version: 'q4-en',
}, null, 1));
put('01-youtube-en', '제목.txt', en.title);
put('01-youtube-en', '게시문안.txt', `[제목]\n${en.title}\n\n[설명]\n${en.description}\n\n[고정 댓글]\n${en.pinned_comment}`);
put('01-youtube-en', '고정댓글.txt', en.pinned_comment);

const mn = 문안.mn;
put('02-mn', '원고.json', JSON.stringify({
  id: '02-mn',
  brand: 'LAB',
  platform: 'instagram+facebook',
  account: '@synk.mn · SYNK(synkworld)',
  format: 'reels',
  language: 'mn',
  audioLanguage: 'ko',
  caption: mn.caption,
  firstComment: mn.comment,
  _비고: 'video.mp4 = q4-mn(36.0초, 화면 글 몽골어, 목소리 한국어로만). Business Suite 릴스 하나로 인스타 @synk.mn·페북 SYNK 교차 게시(퀴즈 #2·#3과 같은 길). Meta AI 번역(더빙·입 맞추기)은 끈다. 해시태그 4개(인스타 5개 이하). 첫 댓글(학습 허브)은 선택.',
  version: 'q4-mn',
}, null, 1));
put('02-mn', '캡션_mn.txt', mn.caption);
put('02-mn', '첫댓글_mn.txt', mn.comment);
// 현지어판(조회 붙은 계정): 샤오훙수 간체 · 틱톡 미얀마. 게시는 그 나라 저녁 20시 안팎(제작 방식 v2 §4-3).
const zhs = 문안.zhs;
put('03-xiaohongshu-cn', '게시문안.txt', `[제목]
${zhs.title}

[캡션]
${zhs.caption}`);
const my = 문안.my;
put('04-tiktok-mm', '게시문안.txt', `[캡션]
${my.caption}`);
console.log('게시 묶음 글 → 01-youtube-en · 02-mn · 03-xiaohongshu-cn · 04-tiktok-mm');
