// 관용구 퀴즈 #3(10-19) 검문 파일: 화면 글(문제 칸 + 바뀐 연재 이름)과 게시글을 한국어 원문과 번호를 맞춰 「한국어 / --- / 번역」으로 쓴다.
//   node 검문파일_q3.mjs → ../게시/검문/{my,zhs,mn}.txt
//   → node tools/현지어대조.js --언어 버마어 --파일 …/my.txt · --언어 "중국어(간체)" --파일 …/zhs.txt · node tools/몽골어대조.js --파일 …/mn.txt --구독
// 화면 틀 글(ui)은 퀴즈 #2에서 검문을 마쳐 연재 이름 한 줄만 넣는다. 해요체 읽는 법(say)은 한국어 발음 표기라 뺀다.
// 몽골어 칸은 i18n.ts의 MN과 같은 값을 여기 적는다(i18n.ts는 확장자 없는 import라 Node로 바로 못 읽음) — 둘 중 하나를 고치면 다른 쪽도 고친다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from './src/kids/locales.ts';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '..', '게시', '검문');
fs.mkdirSync(OUT, { recursive: true });

const Q_KO = [
  ['미역국', '먹다', '미역국을 먹다? (일부러 글자 그대로 옮긴 오답)', '생일이다', '시험에 떨어진다', '건강하게 먹는다', '나 시험에 또 떨어졌어.', '시험에 떨어진다'],
  ['식은 죽', '먹기', '식은 죽 먹기? (일부러 글자 그대로 옮긴 오답)', '아주 쉽다', '아주 지루하다', '맛이 없다', '이 문제는 정말 쉬워.', '아주 쉽다'],
  ['김칫국부터', '마시다', '김칫국부터 마신다? (일부러 글자 그대로 옮긴 오답)', '김치를 좋아한다', '목이 마르다', '너무 일찍 좋아한다', '아직 몰라. 너무 일찍 좋아하지 마!', '너무 일찍 좋아한다'],
];
const QUIZ_KO = '관용구 퀴즈 #3';

const MN = {
  quiz: 'ХЭЛЦ ҮГ #3',
  q: [
    { parts: ['замгийн шөл', 'идэх'], guess: 'замгийн шөл идэх?', options: ['Төрсөн өдрөө тэмдэглэх', 'Шалгалтад унах', 'Эрүүл хооллох'], gloss: 'Би шалгалтад дахиад л уначихлаа.', recap: 'шалгалтад унах' },
    { parts: ['хүйтэн зутан', 'идэх'], guess: 'хүйтэн зутан идэх?', options: ['Маш амархан', 'Их уйтгартай', 'Амтгүй хоол'], gloss: 'Энэ асуулт ус уух мэт амархан.', recap: 'маш амархан' },
    { parts: ['кимчитэй шөл', 'уух'], guess: 'кимчитэй шөл түрүүлж уух?', options: ['Кимчинд дуртай', 'Цангасан', 'Хэт эрт баярлах'], gloss: 'Одоохондоо мэдэхгүй. Алаагүй баавгайн арьсыг битгий хуваа!', recap: 'хэт эрт баярлах' },
  ],
};
const GLOSS_NOTE = ['', ' (몽골어는 「물 마시듯 쉽다」 비유로)', ' (몽골어는 「잡지도 않은 곰 가죽부터 나누지 마」 속담으로)'];

const CAPTION_KO = {
  zhs: '[게시 제목] 3초 만에 맞히는 한국어 관용구: 미역국을 먹다 / [게시글] 이 한국어 관용구 3개를 3초 안에 맞힐 수 있어? 😂 / 미역국을 먹다 — 「미역국을 마시다」가 아니라 시험을 망쳤다 / 식은 죽 먹기 — 「식은 죽을 먹다」가 아니라 아주 쉽다 / 김칫국부터 마시다 — 「김칫국을 먼저 마시다」가 아니라 너무 일찍 좋아한다 / 💡 한국 사람은 시험 전에 미역국을 안 먹는다: 미역이 미끄러워서 시험에서 미끄러져 떨어질까 봐! / 따라 말해 봐 / 몇 개 맞혔어? 점수를 댓글로 알려 줘 / SYNK LAB · 몽글과 함께하는 한국어 관용구 퀴즈 #3',
  my: '[게시글] 이 한국어 관용구 3개를 3초 안에 맞힐 수 있어? 😂 / 미역국을 먹다 — 「미역국을 마신다」가 아니라 시험에 떨어진다 / 식은 죽 먹기 — 「식은 죽을 먹는 것」이 아니라 아주 쉽다 / 김칫국부터 마시다 — 「김칫국을 먼저 마시는 것」이 아니라 너무 일찍 좋아하는 것 / 💡 한국 사람들은 시험 보기 전에 미역국을 안 먹는다 — 미역이 미끄러워서 시험에서 미끄러져 떨어질까 봐! / 따라 말해 봐 / 몇 개 맞혔어? 점수를 댓글로 써 줘 / SYNK LAB · 몽글과 함께하는 한국어 관용구 퀴즈 #3',
  mn: '[게시글] 미역국을 먹다 ≠ 「미역국을 먹다」 😳 한국어 관용구 3개를 3초 안에 맞혀 봐! 😂 / 미역국을 먹다 — 시험에 떨어지다 / 식은 죽 먹기 — 아주 쉽다(물 마시듯) / 김칫국부터 마시다 — 너무 일찍 좋아하다 / 💡 한국 사람들은 시험 전에 미역국을 먹지 않는다 — 미역이 미끄러워서 시험에서 「미끄러져 떨어진다」며 꺼린다! / 🔊 따라 말해 봐 / 몇 개 맞혔어? 0/3 – 3/3으로 댓글에 써 줘',
};
const captionText = (p) => fs.readFileSync(p, 'utf8').replace(/^\[[^\]]+\]\n/gm, '').replace(/^.*[가-힣].*·.*$/gm, '').replace(/#\S+/g, '').replace(/\n+/g, ' / ').trim();

function write(code, rows, capFile) {
  const ko = [], tr = [];
  rows.forEach(([k, t], i) => { ko.push(`${i + 1}. ${k}`); tr.push(`${i + 1}. ${t}`); });
  if (capFile) { const n = rows.length + 1; ko.push(`${n}. ${CAPTION_KO[code]}`); tr.push(`${n}. ${captionText(capFile)}`); }
  fs.writeFileSync(path.join(OUT, `${code}.txt`), `${ko.join('\n')}\n---\n${tr.join('\n')}\n`, 'utf8');
}

const rowsFor = (quiz, qs, notes = []) => [
  [QUIZ_KO, quiz],
  ...qs.flatMap((q, i) => {
    const [p0, p1, g, o0, o1, o2, gl, rc] = Q_KO[i];
    return [[p0, q.parts[0]], [p1, q.parts[1]], [g, q.guess], [o0, q.options[0]], [o1, q.options[1]], [o2, q.options[2]], [gl + (notes[i] || ''), q.gloss], [`(끝 화면 복습) ${rc}`, q.recap]];
  }),
];

const POST = path.join(ROOT, '..', '게시');
write('my', rowsFor(LOCALES.my.ui.quiz, LOCALES.my.q), path.join(POST, 'lab-mm-tiktok', '게시문안.txt'));
write('zhs', rowsFor(LOCALES.zhs.ui.quiz, LOCALES.zhs.q), path.join(POST, 'lab-cn-xiaohongshu', '게시문안.txt'));
write('mn', rowsFor(MN.quiz, MN.q, GLOSS_NOTE), path.join(POST, 'mn', '캡션_mn.txt'));
console.log('검문 파일 3개 →', OUT);
