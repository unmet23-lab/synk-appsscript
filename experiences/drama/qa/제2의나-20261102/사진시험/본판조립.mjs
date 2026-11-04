#!/usr/bin/env node
/**
 * 「제2의 나」 사진 아바타 시범 전 작은 시험 (2026-11-04, 일괄 처리 설계 11절) — 지시문 조립.
 *
 * ① 장면 판(1화 식당) 일곱 장: 김치 2(여 · 남) · 파이팅 4(여 작은 · 여 큰 · 남 작은 · 남 큰) + 긴 생머리 여 파이팅 1(설계 4절).
 *    학생 자리 대역은 지어낸 사람이고, 태오 참고는 휴대폰 결(F1 + 덧니 선배 예비 판 셋)로 넣어 「태오만 매끈」을 판에서 맞춘다.
 * ② SFace가 낮게 나오는 집단 대역 여섯(어두운 피부 · 안경 · 히잡 · 수염 · 통통 · 필터) — 올림 6 + 기준 강 · 약 · 강+ 18 + 판 편집 12(설계 3절 끝).
 *    모두 지어낸 성인이다. 안경 · 머리 가림 · 수염은 동의 화면의 「알려 주고 싶은 것」 줄(`알림줄`)을 넣어 굽는다 — 서버 지시문과 같은 줄이다.
 *
 *   node experiences/drama/qa/제2의나-20261102/사진시험/본판조립.mjs
 *   나오는 곳(공용 작업본, git 밖): .tmp/me2-20261102/photo-low/글/ · 판본/글/ · 굽기 차례는 같은 폴더 차례.json
 *
 * 값: 구독 경로(`T-C/굽기.cjs` → `tools/codex계정.js`), 현금 0 · API 크레딧 아님.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 판편집 } from './판편집조립.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102');
const 읽기 = (이름) => fs.readFileSync(path.join(여기, '지시문', `${이름}.md`), 'utf8').trim();
const 셀카읽기 = (이름) => fs.readFileSync(path.join(여기, '..', '셀카', '지시문', `${이름}.md`), 'utf8').trim();

/** 「알려 주고 싶은 것」 줄 — 서버(lib/me2-photo-prompts.js)와 같은 글을 쓴다. 학생이 고른 것만 넣는다. */
export const 알림줄 = {
  안경: 'THE STUDENT WEARS GLASSES: keep their own glasses on — the same frame shape and colour, clear lenses with their eyes fully visible behind them.',
  머리가림: 'THE STUDENT WEARS A HEAD COVERING: keep their own head covering exactly as worn in Image 1 — the same style, colour and coverage; never remove it or show more hair than Image 1 does.',
  수염: 'THE STUDENT KEEPS THEIR FACIAL HAIR: keep the same beard or moustache shape as in Image 1, neatly groomed. Ignore any instruction to be clean-shaven.',
};

const 셀카머리 = 'PHOTOREAL SMARTPHONE SELFIE, vertical 3:4, the kind of everyday selfie someone would upload to an app.';
const 셀카꼬리 = 'Held at arm\'s length from slightly below or at eye level, the mild wide-angle bulge of a front camera, mixed indoor light with a slight colour cast. Ordinary, unposed, not retouched; the face fills about a third of the frame.';
export const 대역 = [
  { id: 'dark', 알림: [], 옷: 'Clothes: a plain mustard-yellow crew-neck sweatshirt.',
    셀카: `${셀카머리} A Nigerian man of about 27; an original person with an ordinary everyday face, not model-like: deep dark-brown skin, a broad nose, full lips, short natural coily black hair, a slightly round face, a few small marks on one cheek. A dim shared-kitchen at night with one warm ceiling bulb, a plain grey hoodie. ${셀카꼬리}` },
  { id: 'glasses', 알림: ['안경'], 옷: 'Clothes: a soft teal cotton kurta-style top.',
    셀카: `${셀카머리} An Indian woman of about 29; an original person with an ordinary everyday face, not model-like: medium-brown skin, a long oval face, thick black rectangular glasses with slightly smudged lenses, a small nose stud, black hair in a loose side braid. A library desk under cold tube light, a plain navy cardigan. ${셀카꼬리}` },
  { id: 'hijab', 알림: ['머리가림'], 옷: 'Clothes: a plain long-sleeved dusty-rose blouse.',
    셀카: `${셀카머리} An Indonesian woman of about 26; an original person with an ordinary everyday face, not model-like: light-brown skin, a round face with soft cheeks, dark eyes, wearing a plain dark-green hijab that fully covers her hair and neck. A small bedroom in afternoon window light. ${셀카꼬리}` },
  { id: 'beard', 알림: ['수염'], 옷: 'Clothes: a plain charcoal zip-up fleece.',
    셀카: `${셀카머리} An Uzbek man of about 33; an original person with an ordinary everyday face, not model-like: olive skin, deep-set brown eyes, a prominent nose, a full neatly trimmed dark beard and moustache, short black hair with a receding hairline. A parked car in overcast daylight. ${셀카꼬리}` },
  { id: 'plus', 알림: [], 옷: 'Clothes: a loose cream knit sweater.',
    셀카: `${셀카머리} A Vietnamese woman of about 28 with a heavier build; an original person with an ordinary everyday face, not model-like: a full round face with a soft double chin, small dark eyes, straight black shoulder-length hair with a centre parting. A cafe at dusk under warm yellow light. ${셀카꼬리}` },
  { id: 'filter', 알림: [], 옷: 'Clothes: a pale-lilac hooded sweatshirt.',
    셀카: `${셀카머리} A Thai woman of about 24; an original person with an ordinary everyday face, not model-like, photographed through a heavy beauty-filter app: over-smoothed porcelain skin, unnaturally large eyes, a narrowed chin, pink tint and soft glow over everything, slight loss of detail. Long dark-brown hair. A bedroom with fairy lights. ${셀카꼬리}` },
];

/** 기준 지시문 — 서버와 같은 순서(_기준_머리 · 옷 · 알림 · 보정 · 젊게 · (강+면 나이_더) · 순간 · 빛결 · 규칙). */
export const 기준글 = (d, lv) => [읽기('_기준_머리'), d.옷, ...d.알림.map((k) => 알림줄[k]), 읽기(`_보정_${lv.replace('+', '')}`), 읽기('_젊게'),
  ...(lv === '강+' ? [읽기('_나이_더')] : []), 읽기('_기준_순간'), 읽기('_기준_빛결'), 읽기('_규칙')].join('\n');

const 파이팅몸짓 = "the free fist raised beside the cheek, clearly above the shoulder; Tae-o's arm around the student's shoulders and his hand stay exactly as in Image 1";
/** 판 일곱 — 축은 학생 자리와 몸이 닿는 곳(설계 4절). 학생 참고는 지어낸 대역의 기준 판, 몸은 글로 정한다. */
export const 판목록 = [
  { id: 'kimchi-f', 포즈: '김치7', 몸짓: 'the V sign at chest height', 대역: 'u1', 옷: 'Clothes: a cream knit cardigan over a plain white T-shirt.', 몸: 'THE STUDENT\'S BUILD: a slim young woman of ordinary height.' },
  { id: 'kimchi-m', 포즈: '김치7', 몸짓: 'the V sign at chest height', 대역: 'u2', 옷: 'Clothes: a navy crew-neck sweatshirt.', 몸: 'THE STUDENT\'S BUILD: a slim young man of ordinary height.' },
  { id: 'fight-f-s', 포즈: '파이팅', 몸짓: 파이팅몸짓, 대역: 'u1', 옷: 'Clothes: a cream knit cardigan over a plain white T-shirt.', 몸: 'THE STUDENT\'S BUILD: a small, slight young woman — Tae-o\'s arm rests easily over her narrow shoulders and she sits a head shorter than him.' },
  { id: 'fight-f-l', 포즈: '파이팅', 몸짓: 파이팅몸짓, 대역: 'a52', 옷: 'Clothes: a soft lilac knit cardigan over a white T-shirt.', 몸: 'THE STUDENT\'S BUILD: a tall young woman with a fuller figure and broad shoulders — Tae-o\'s arm reaches around them with some effort and their heads are level.' },
  { id: 'fight-m-s', 포즈: '파이팅', 몸짓: 파이팅몸짓, 대역: 'u2', 옷: 'Clothes: a navy crew-neck sweatshirt.', 몸: 'THE STUDENT\'S BUILD: a small, slim young man — Tae-o\'s arm rests easily over his shoulders and he sits a little shorter than Tae-o.' },
  { id: 'fight-m-l', 포즈: '파이팅', 몸짓: 파이팅몸짓, 대역: 'a45', 옷: 'Clothes: a plain grey crew-neck sweatshirt.', 몸: 'THE STUDENT\'S BUILD: a big, broad-shouldered young man with a heavier build — taller than Tae-o, whose arm barely reaches across those shoulders.' },
  { id: 'fight-f-long', 포즈: '파이팅', 몸짓: 파이팅몸짓, 대역: 'a36', 옷: 'Clothes: a soft olive-green crew-neck sweatshirt.', 몸: 'THE STUDENT\'S BUILD: a slim young woman of ordinary height with long straight hair falling past the shoulders — Tae-o\'s arm rests on top of her hair, a few strands caught under his sleeve.' },
];

// Fable 판 검수(11-04): 「페이지가 비었다」는 부정문을 14장 중 7장이 어겼다(붉은 · 금색 자국) — 긍정형으로 바꾼다. 큰 체격 대역 옆에서 태오가 야위는 것도 한 줄로 막는다.
const 패치 = 'a small shield patch with two gold stars above an open book drawn as two plain cream page shapes — the pages completely EMPTY: no lines, dots, symbols or colour inside.';
const 패치긍정 = 'a small shield patch that is ONLY two gold stars above two blank cream rectangles (an open book seen flat) — the rectangles are solid, uniform cream with nothing drawn on them: no dot, diamond, ring, crest, letter or red or gold mark of any size, even one stitch.';
const 태오그대로 = "Tae-o's face stays exactly as in Images 2 to 5 regardless of the student's build — the same slightly full cheeks, soft jaw and level eyes; do NOT make him leaner, sharper-jawed or narrow-eyed to contrast with a bigger student.";

/** 판 지시문 — 사진시험 셀카와 같은 줄에 판 조건을 더한다. 참고 순서: Image 1 = 대역 학생, Image 2~5 = 태오(F1 · 휴대폰 결 예비 판 셋). */
export const 판글 = (p) => {
  const 신원 = 읽기('_셀카_신원');
  if (!신원.includes(패치)) throw new Error('_셀카_신원의 패치 문장이 바뀌었다 — 본판조립.mjs를 맞춘다');
  return [신원.replace(패치, 패치긍정), `THE STUDENT: ${p.옷} ${p.몸}`, ...(p.id === 'fight-f-l' ? [태오그대로] : []), 읽기('_젊게_셀카'), 읽기('_셀카_장소'), 셀카읽기(p.포즈),
    p.포즈 === '파이팅' ? 'The student\'s free fist is clearly beside their cheek, above the shoulder — never in front of the chest.' : '',
    셀카읽기('_결3'), 읽기('_규칙')].filter(Boolean).join('\n');
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const 낮음 = path.join(작업, 'photo-low');
  const 판본 = path.join(작업, '판본');
  for (const d of [path.join(낮음, '글'), path.join(판본, '글')]) fs.mkdirSync(d, { recursive: true });
  const 차례 = { 올림: [], 기준: [], 판: [], 편집: [] };
  for (const d of 대역) {
    const 올림글 = path.join(낮음, '글', `up-${d.id}.txt`);
    fs.writeFileSync(올림글, `${d.셀카}\n${읽기('_규칙')}\n`);
    차례.올림.push({ 이름: `up-${d.id}`, 글: 올림글, 참고: [] });
    for (const lv of ['강', '약', '강+']) {
      const 파일 = path.join(낮음, '글', `base-${d.id}-${lv}.txt`);
      fs.writeFileSync(파일, `${기준글(d, lv)}\n`);
      차례.기준.push({ 이름: `base-${d.id}-${lv.replace('+', '플')}`, 글: 파일, 참고: [`@up-${d.id}`] });
    }
    // 판 편집 둘 — 김치 하나 · 파이팅 하나(몸이 닿는 포즈). 어느 판인지는 판 검수 뒤 굽기 스크립트가 고른 판으로 붙인다.
    for (const [판이름, 몸짓] of [['kimchi', 'the V sign at chest height'], ['fight', 파이팅몸짓]]) {
      const 파일 = path.join(낮음, '글', `edit-${d.id}-${판이름}.txt`);
      fs.writeFileSync(파일, `${판편집(d.옷, 몸짓)}\n`);
      차례.편집.push({ 이름: `edit-${d.id}-${판이름}`, 글: 파일, 판: 판이름, 학생: `@base-${d.id}-강` });
    }
  }
  for (const p of 판목록) {
    const 파일 = path.join(판본, '글', `${p.id}.txt`);
    const 글 = 판글(p);
    fs.writeFileSync(파일, `${글}\n`);
    차례.판.push({ 이름: `plate-${p.id}`, 글: 파일, 대역: p.대역 });
  }
  fs.writeFileSync(path.join(낮음, '차례.json'), JSON.stringify(차례, null, 1) + '\n');
  console.log(`[본판] 올림 ${차례.올림.length} · 기준 ${차례.기준.length} · 판 ${차례.판.length} · 편집 ${차례.편집.length} → ${낮음}`);
}
