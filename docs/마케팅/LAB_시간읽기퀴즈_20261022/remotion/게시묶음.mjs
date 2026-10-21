// 「한국어로 시간 읽기」(10-22) 게시 묶음: 정본 ../게시/문안.json에서 판마다 올릴 글을 쓴다(영상·표지는 렌더.mjs, 10MB 판은 올림판_10MB.mjs가 같은 폴더에 넣는다).
//   node 게시묶음.mjs → ../게시/01-youtube-en/{원고.json,제목.txt,게시문안.txt,고정댓글.txt} · ../게시/02-mn/{원고.json,캡션_mn.txt,첫댓글_mn.txt}
// 게시(올리기·예약·공개)는 하지 않는다 — 「오늘 편 게시」 세션이 유호님 「올려」 뒤 한 곳씩 올린다(10-20).
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
  hook: 'B',
  _비고: 'video.mp4 = time-en(100 BPM, 33.5초, 렌더.mjs). 표지 cover.png = 1.3초(2 NUMBER SYSTEMS? 1 RULE. + 3시 30분 + 주판 든 곰 + 삼 시 삼십 분??). 어린이 전용 아님(댓글이 끝 행동). 합성 표시 필수 아님(펠트 그림·특정인이 아닌 TTS 진행자, 관용구 퀴즈와 같음). 동영상 언어 en(영어 진행 + 한국어 읽기), 제목·설명 언어 en. 자동 더빙 꺼짐 확인.',
  version: 'time-en',
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
  hook: 'A',
  _비고: 'video.mp4 = time-mn(33.5초, 화면 글 몽골어, 목소리 한국어로만). Business Suite 릴스 하나로 인스타 @synk.mn·페북 SYNK 교차 게시(관용구 퀴즈와 같은 길). Meta AI 번역(더빙·입 맞추기)은 끈다. 해시태그 4개(인스타 5개 이하). 첫 댓글(학습 허브)은 선택.',
  version: 'time-mn',
}, null, 1));
put('02-mn', '캡션_mn.txt', mn.caption);
put('02-mn', '첫댓글_mn.txt', mn.comment);
console.log('게시 묶음 글 → 01-youtube-en · 02-mn');
