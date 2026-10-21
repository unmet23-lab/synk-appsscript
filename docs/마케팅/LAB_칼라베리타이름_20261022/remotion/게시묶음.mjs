// 「칼라베리타에 내 이름을 한글로」(10-22) 게시 묶음: 정본 ../게시/문안.json에서 올릴 글을 쓴다(영상·표지는 렌더.mjs, 10MB 판은 올림판_10MB.mjs).
//   node 게시묶음.mjs → ../게시/01-youtube-es/{원고.json,제목.txt,게시문안.txt,고정댓글.txt}
// 게시(올리기·예약·공개)는 하지 않는다 — 「오늘 편 게시」 세션이 유호님 「올려」 뒤 올린다(10-20).
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

const es = 문안.es;
put('01-youtube-es', '원고.json', JSON.stringify({
  id: '01-youtube-es',
  brand: 'LAB',
  platform: 'youtube',
  account: '@synkkorean',
  format: 'shorts',
  language: 'es-419',
  audioLanguage: 'ko',
  title: es.title,
  caption: es.description,
  pinnedComment: es.pinned_comment,
  alt: [es.alt],
  madeForKids: false,
  alteredContent: false,
  category: 'Education',
  hook: 'A',
  _비고: 'video.mp4 = name-es(100 BPM, 33.5초, 렌더.mjs). 표지 cover.png = 1.3초(¿TU NOMBRE EN COREANO? + JUAN + 띠가 비뚤어진 칼라베리타 + 주안??). 어린이 전용 아님. 합성 표시 필수 아님(펠트 그림·특정인이 아닌 TTS 진행자). 동영상 언어 ko(목소리가 한국어뿐), 제목·설명 언어 스페인어(라틴아메리카, es-419) — 10-12 「내 이름 한국어로」처럼 스페인어 제목으로 올린다. 자동 더빙 꺼짐 확인. 끝 행동 링크 synk.im/nombre는 설명란·고정 댓글.',
  version: 'name-es',
}, null, 1));
put('01-youtube-es', '제목.txt', es.title);
put('01-youtube-es', '게시문안.txt', `[제목]\n${es.title}\n\n[설명]\n${es.description}\n\n[고정 댓글]\n${es.pinned_comment}`);
put('01-youtube-es', '고정댓글.txt', es.pinned_comment);
console.log('게시 묶음 글 → 01-youtube-es');
