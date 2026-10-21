// 「아는 단어 총동원」(10-21) 게시 묶음: 정본 ../게시/문안.json에서 판마다 올릴 글을 쓴다(영상·표지는 렌더.mjs가 같은 폴더에 넣는다).
//   node 게시묶음.mjs → ../게시/01-youtube-en/{원고.json,제목.txt,게시문안.txt,고정댓글.txt} · ../게시/02-mn/{원고.json,캡션_mn.txt,첫댓글_mn.txt}
// 게시(올리기·예약·공개)는 하지 않는다 — 「오늘 편 게시」 세션이 유호님 「올려」 뒤 한 곳씩 올린다.
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
  audioLanguage: 'ko',
  title: en.title,
  caption: en.description,
  pinnedComment: en.pinned_comment,
  alt: [en.alt],
  madeForKids: false,
  alteredContent: false,
  category: 'Education',
  _비고: 'video.mp4 = vocab-en(렌더.mjs). 표지 cover.png = 0.5초(띠 + 약속 딱지 + 「한국어 할 줄 알아요?」 + 물음표). 어린이 전용 아님(댓글이 필요). 합성 표시는 필수 아님 — 펠트 그림과 특정인이 아닌 TTS라 사실적인 사람·장면이 없다(관용구 퀴즈 #2 판단과 같음). 동영상 언어는 실제로 말하는 한국어(ko), 제목·설명 언어 en. 자동 더빙 끔.',
  version: 'vocab-en',
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
  _비고: 'video.mp4 = vocab-mn(화면 글 몽골어, 목소리 한국어). Business Suite 릴스 하나로 인스타 @synk.mn·페북 SYNK 교차 게시. Meta AI 번역(더빙·입 맞추기)은 끈다. 해시태그 4개(인스타 5개 이하). 첫 댓글(학습 허브)은 선택.',
  version: 'vocab-mn',
}, null, 1));
put('02-mn', '캡션_mn.txt', mn.caption);
put('02-mn', '첫댓글_mn.txt', mn.comment);
console.log('게시 묶음 글 → 01-youtube-en · 02-mn');
