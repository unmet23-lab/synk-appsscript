#!/usr/bin/env node
// 편 정본(remotion/src/episode.json) + 틀 진행 글(src/ui.json) + 박자표(src/beats.json) → 판본 글(꼴 「판본글/1」, tools/lib/판본글.js) 한 장(v6, 2026-11-10).
//   node docs/마케팅/LAB_퀴즈은행/틀/판본글.mjs <편 폴더> <언어> [--판본 MN] [--나라 MN]
//   → <편>/게시/01-<언어>/글_<언어>.json — 준비.json 「돌림」.판본[키].글이 이 파일을 가리킨다(뜻 검사 지문 = 이 파일 SHA-256).
// 그 판본이 화면에 내는 현지어 글 전부(칸 · 원문 · 나오는 초 · 그때 장면 · 글 상자)와 퀴즈(보기 · 정답)를 적는다 —
// tools/뜻검사.js · tools/글자검사.js · tools/현지어대조.js가 읽는다. 초는 박자표에서 셈한다(틀의 Question.tsx · End.tsx · Film.tsx와 같은 값).
// 상자 글자 크기는 틀이 줄일 수 있는 가장 작은 크기(fitBox 최소)다 — 그 크기에서도 상자에 들어가야 렌더가 넘치지 않는다(글자 검사가 이 크기로 잰다).
// 한국어 줄(제목 · 해요체 · 응원 말)은 칸 「한국어」, 키릴 읽기는 「읽기」 — 뜻 대조 · 읽기 시간에서 빠진다.
// v6에서 화면에서 빠진 글: 문제 사이 「n단계!」 · 둘째 · 셋째 문제의 「글자 그대로 옮기면:」 머리 · 「진짜 뜻은 뭘까요?」 띠 · 끝 복습 제목 · 둘째 · 셋째 문제의 따라 말하기 이름표 ·
//   셋째 문제의 보기 셋(「맞을까 틀릴까」라 함정 뜻 하나만 「= …?」로 낸다 — 띠는 정답에서 「아니야!」).
// v6에서 더한 글(편 정본 loc — 있을 때만): 따라 말할 문장의 뜻(sayMean) · 뜻 장면 귀퉁이의 때 · 곳 이름표(when).
// v6f: 첫 문제 셈 동안 띠 둘째 줄(countLabel) · 끝 장면 이름표(end.tags가 있으면 복습 줄 대신 장면 위 이름표 셋 + 맨 위 복습 제목 recapTitle).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 틀 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(틀, '..', '..', '..', '..');
const args = process.argv.slice(2);
const 편 = args[0] ? path.resolve(args[0]) : null;
const lang = args[1];
const val = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
if (!편 || !lang) { console.error('사용: node 판본글.mjs <편 폴더> <언어> [--판본 MN] [--나라 MN]'); process.exit(2); }
const src = path.join(편, 'remotion', 'src');
const ep = JSON.parse(fs.readFileSync(path.join(src, 'episode.json'), 'utf8'));
const uiAll = JSON.parse(fs.readFileSync(path.join(src, 'ui.json'), 'utf8'));
const beats = JSON.parse(fs.readFileSync(path.join(src, 'beats.json'), 'utf8'));
const ui = uiAll[lang], uk = uiAll.ko;
if (!ui) { console.error(`ui.json에 ${lang} 칸이 없다`); process.exit(2); }
const 프로필파일 = path.join(뿌리, 'docs', '마케팅', '현지화', '언어프로필.json');
const 글꼴 = fs.existsSync(프로필파일) ? JSON.parse(fs.readFileSync(프로필파일, 'utf8')).언어?.[lang]?.글꼴줄 : null;
const font = 글꼴 || "'Inter Tight', 'SUIT', sans-serif";
const 국가 = val('--나라') || (lang === 'mn' ? 'MN' : null);
const 판본키 = val('--판본') || 국가 || lang.toUpperCase();

const SPB = beats.beat / beats.fps; // 0.6초
const F = 1 / beats.fps;
const 상자 = (폭, 글자크기, 최대줄, 굵기 = 800, x, y, 가운데 = true) => ({ 폭, 높이: Math.round(글자크기 * 1.15 * 최대줄), 글자크기, 굵기, 줄높이: 1.14, 최대줄, 글꼴: font, 자간: '0.004em', 가운데, 줄바꿈: 'keep-all', ...(x !== undefined ? { x, y } : {}) });
const r2 = (n) => Math.round(n * 100) / 100;
const 줄 = [];
const add = (id, 칸, 글, 원문, 초, 장면, box) => 줄.push({ id, 칸, 글, ...(원문 ? { 원문 } : {}), 초: 초.map(r2), 장면, ...(box ? { 상자: box } : {}) });
const emKo = (s) => [...s].reduce((w, c) => w + (c === ' ' ? 0.28 : 1), 0);

const 띠글 = { three: ['but', '첫 문제 — 장면 아래 가장자리에 걸친 남색 띠'], duel: ['duelHook', '둘째 문제 — 장면 아래 띠(이 문제는 큰 카드 둘 가운데 하나)'], ox: ['hooks', '셋째 문제 — 장면 아래 띠(이 문제는 함정 뜻 하나가 맞는지 틀리는지 — ✓ · ✗)'] };
let t = 0;
const 문제끝 = beats.questions.reduce((n, q) => n + q.len, 0) * SPB;
add('머리', '머리', ep.loc[lang].hook, ep.ko?.hook, [0, beats.questions[0].len * SPB], '첫 문제 내내 화면 맨 위 왼쪽 크림색 알약 — 이 편의 주제(오른쪽에 별 셋)', 상자(600, 24, 1, 800, 87, 292));
ep.questions.forEach((q, i) => {
  const s = beats.questions[i], n = i + 1, L = q.loc[lang], K = q.ko || {};
  const 끝 = t + s.len * SPB;
  const 정답초 = t + s.reveal * SPB;
  const 뒤집힘 = 정답초 + 7 * F;
  const duel = s.kind === 'duel';
  const ox = s.kind === 'ox';
  const trap = q.trap ?? [0, 1, 2].find((k) => k !== q.correct);
  const 두줄 = emKo(q.idiom) > 8.5;
  const 다리y = 352 + (두줄 ? 202 : 130) + 8 + (s.label ? 70 : 0); // v6d: 머리 글 52(최소 36)
  const optsH = duel ? 292 : ox ? 314 : 404; // v6e 보기 칸 124
  const optsTop = 1428 - optsH;
  const 글자장면 = `문제 ${n}: 한국어 제목 「${q.idiom}」 아래 글자 그대로 그린 큰 펠트 장면(몽글이 그 엉뚱한 일을 한다)`;
  if (i > 0) add(`q${n}.머리`, '진행', `${ui.series} · ${n}/3`, `${uk.series} · ${n}/3`, [t, 끝], `문제 ${n} 내내 화면 맨 위 왼쪽 알약(오른쪽에 별 셋)`, 상자(600, 24, 1, 800, 87, 292));
  add(`q${n}.한국어제목`, '한국어', q.idiom, null, [t, 끝], `문제 ${n} 제목(한국어 목소리가 읽는다) — 처음엔 크게, 보기부터는 작게 위에 남는다`);
  if (s.label) add(`q${n}.다리머리`, '다리', ui.bridgeLabel, uk.bridgeLabel, [t, t + s.board * SPB], 글자장면, 상자(800, 36, 1, 700, 92, 다리y - 66));
  add(`q${n}.다리`, '다리', `“${L.literal}”`, K.literal, [t + (i ? 0.1 : 0), 뒤집힘], `${글자장면} — 보기 동안에도 제목 아래 작게 남는다`, 상자(820, 36, 2, 800, 82, 다리y));
  const [띠칸, 띠장면] = 띠글[s.kind];
  const 띠 = 띠칸 === 'hooks' ? [ui.hooks[1], uk.hooks[1]] : [ui[띠칸], uk[띠칸]];
  add(`q${n}.띠`, '진행', 띠[0], 띠[1], [t + s.band * SPB, t + s.count[0] * SPB], `${띠장면} — 카운트다운 박에 같은 띠가 「셋 = 3」(한국어)로 바뀐다`, 상자(770, 30, 1, 800, 107, optsTop - 112));
  // v6f: 첫 문제 셈 동안 띠 둘째 줄 「3초 안에 맞혀 봐요!」(초시계 옆 「셋 = 3」 아래)
  if (s.kind === 'three') add(`q${n}.셈`, '진행', ui.countLabel, uk.countLabel, [t + s.count[0] * SPB, 정답초], `문제 ${n} 카운트다운 — 장면 아래 띠가 초시계 + 「셋 = 3」(한국어)이 되고 그 아래 둘째 줄`, 상자(640, 26, 1, 800, 220, optsTop - 81));
  const show = duel ? (q.show || [0, 1]) : ox ? [] : [0, 1, 2];
  if (ox) add(`q${n}.보기.1`, '보기', `= ${L.options[trap]}?`, K.options?.[trap] ? `= ${K.options[trap]}?` : null, [t + s.opts[0] * SPB, 정답초 + 0.4], `문제 ${n} 「맞을까 틀릴까」 — 장면 아래 함정 뜻 카드(그 아래 ✓ · ✗ 단추, 답은 ✗ — 줄이 그어진다)`, 상자(765, 34, 2, 800, 110, optsTop + 28, true));
  show.forEach((k, pos) => add(`q${n}.보기.${pos + 1}`, '보기', L.options[k], K.options?.[k], [t + s.opts[pos] * SPB, 정답초 + 0.4],
    duel ? `문제 ${n} 「둘 중 하나」 — 장면 아래 나란히 선 큰 카드 ${'AB'[pos]}` : `문제 ${n} 장면 아래 보기 ${'ABC'[pos]}${s.kind === 'stagger' ? '(한 박에 하나씩 뜬다)' : ''}`,
    duel ? 상자(368, 34, 3, 800, 89 + pos * 438, optsTop + 110, true) : 상자(705, 32, 2, 800, 171, optsTop + pos * 140 + 22, false)));
  if (ox) add(`q${n}.아니야`, '진행', ui.stamp, uk.stamp, [정답초, 정답초 + 0.4], '✗ 단추가 산호색으로 — 장면 아래 띠가 산호색 「아니야!」로(곧 장면이 뒤집혀 진짜 뜻이 나온다)', 상자(770, 30, 1, 800, 107, optsTop - 112));
  else add(`q${n}.맞아요`, '진행', ui.right, uk.right, [정답초, 정답초 + 0.4], '정답 보기가 초록으로 — 장면 아래 띠가 초록 「맞아요!」로', 상자(770, 30, 1, 800, 107, optsTop - 112));
  add(`q${n}.뜻`, '뜻', `= ${L.options[q.correct]}`, K.options?.[q.correct] ? `= ${K.options[q.correct]}` : null, [뒤집힘 + 3 * F, 끝], `문제 ${n} 뜻 화면 — 장면 카드가 뒤집혀 뜻 장면이 되고 그 위에 「${q.idiom} = 뜻」`, 상자(770, 36, 2, 800, 107, 430));
  const 말초 = t + s.say * SPB;
  add(`q${n}.따라말`, '한국어', q.say, null, [말초 - 0.17, 끝], '따라 말하기 판(한국어 목소리) — 바뀐 말끝에 색');
  add(`q${n}.읽기`, '읽기', L.reading, null, [말초 - 0.17, 끝], '따라 말하기 판 둘째 줄(소리 표시 + 키릴 읽기)');
  if (L.when) add(`q${n}.때`, '상황', L.when, K.when, [뒤집힘 + 0.3, 끝], `문제 ${n} 뜻 장면 그림 ${q.art?.whenRight ? '오른쪽' : '왼쪽'} 위 귀퉁이에 붙은 작은 이름표(그 장면의 때 · 곳)`, 상자(460, 44, 1, 800, q.art?.whenRight ? 432 : 93, 512));
  if (L.sayMean) add(`q${n}.따라말뜻`, '뜻', `= ${L.sayMean}`, K.sayMean ? `= ${K.sayMean}` : null, [말초 - 0.17, 끝], `따라 말하기 판 맨 아래 줄 — 한국어 문장 「${q.say}」의 뜻`, 상자(780, 34, 1, 800, 102, 1356));
  if (s.label) {
    const 차례 = s.turn === null ? 끝 : t + s.turn * SPB;
    add(`q${n}.따라말이름`, '진행', ui.sayHow ?? ui.sayIt, uk.sayHow ?? uk.sayIt, [말초 - 0.17, 차례], '따라 말하기 판 맨 위 이름표 — 제목(사전 꼴)과 달리 말할 때의 꼴이라는 표시', 상자(640, 34, 1, 800));
    if (s.turn !== null) add(`q${n}.네차례`, '진행', ui.yourTurn, uk.yourTurn, [차례, 끝], '따라 말하기 판 맨 위 이름표 — 따라 할 틈', 상자(420, 34, 1, 800));
  }
  t = 끝;
});
const E = beats.end;
const 응원초 = 문제끝 + E.cheer * SPB;
const 물러남 = 문제끝 + E.scene * SPB; // 복습 줄이 물러나고 끝 장면이 들어오는 때
const 끝초 = 문제끝 + E.len * SPB;
add('끝.단계', '진행', ui.finish, uk.finish, [문제끝, 끝초], '끝 화면 맨 위 왼쪽 알약(별 셋이 다 찼다)', 상자(600, 24, 1, 800, 87, 292));
const 이름표 = ep.end.tags?.length === 3;
if (이름표) {
  // v6f: 세 관용구가 한 사건으로 터지는 끝 장면 한 장 위에 이름표 셋(그 자리에 붙어 끝까지) + 맨 위 제목(응원 말이 오면 물러난다)
  const cardTop = 352 + 58 + 12, cardH = 615;
  add('끝.복습제목', '복습', ui.recapTitle, uk.recapTitle, [문제끝, 끝초], '끝 화면 맨 위(끝까지 남는다) — 아래 끝 장면(세 관용구가 한 사건으로 엮인 장면) 위에 붙은 이름표 셋의 제목', 상자(830, 32, 1, 800, 125, 352));
  ep.end.tags.forEach((tg, i) => { const q = ep.questions[i]; add(`q${i + 1}.복습`, '복습', `= ${q.loc[lang].recap}`, q.ko?.recap ? `= ${q.ko.recap}` : null, [문제끝 + E.recap[i] * SPB, 끝초], `끝 장면 위 이름표 ${i + 1} — 「${q.idiom}」(한국어) 아래 뜻, 실 한 가닥이 장면 속 그 일이 일어난 자리를 가리킨다`, 상자(400, 28, 2, 800, Math.round(65 + 855 * tg.box[0] / 100 - 200), Math.round(cardTop + cardH * tg.box[1] / 100 - 8), true)); });
} else ep.questions.forEach((q, i) => add(`q${i + 1}.복습`, '복습', `= ${q.loc[lang].recap}`, q.ko?.recap ? `= ${q.ko.recap}` : null, [문제끝 + E.recap[i] * SPB, 물러남], `끝 화면 복습 줄 ${i + 1} — 왼쪽에 글자 그대로 장면 그림, 오른쪽에 「${q.idiom}」 아래 뜻`, 상자(555, 32, 2, 800, 365, 352 + i * 224 + 92, false)));
add('끝.질문한국어', '한국어', ep.end.askKo, null, [문제끝 + E.ask * SPB, 끝초], '끝 화면 흰 판 맨 위 — 끝 질문 한국어 한 줄(한국어 목소리가 읽는다)');
add('끝.질문', '끝질문', `= ${ep.loc[lang].ask}`, ep.ko?.ask ? `= ${ep.ko.ask}` : null, [문제끝 + E.ask * SPB, 끝초], (이름표 ? '끝 화면 흰 판(끝 장면 아래) — 한국어 질문 바로 아래 그 뜻, 그 아래 댓글 부탁 줄과 큰 「?/3」 칸. 끝까지 남는다(v6f)' : '끝 화면 흰 판 — 한국어 질문 바로 아래 그 뜻, 그 아래 0/3 · 1/3 · 2/3 · 3/3 칸과 댓글 부탁 줄. 끝 장면이 들어오면 판째 아래로 내려가 끝까지 남는다(v6d)'), 상자(791, 30, 2, 800, 97, 1112, false));
if (이름표) add('끝.댓글', '끝', ui.comment, uk.comment, [문제끝 + E.ask * SPB + 0.47, 끝초], '끝 화면 흰 판 맨 아래 줄 — 오른쪽에 큰 「?/3」 칸(몇 개 맞혔는지 댓글에), 끝까지 남는다', 상자(601, 30, 1, 800, 97, 1250, false));
else add('끝.댓글', '끝', ui.comment, uk.comment, [문제끝 + E.ask * SPB + 0.47, 끝초], '끝 화면 흰 판 맨 아래 줄(점수 칸 아래) — 끝까지 남는다', 상자(791, 30, 1, 800, 97, 1236, false));
add('끝.응원한국어', '한국어', ep.end.cheerKo, null, [응원초, 끝초], '맨 끝 — 끝 장면 한 장(이 편의 이야기를 받아치는 장면) 위 큰 한국어 응원 말(한국어 목소리)');
if (이름표) add('끝.응원', '끝', ep.loc[lang].cheer, ep.ko?.cheer, [응원초, 끝초], `맨 끝 — 끝 장면 아래쪽 안의 남색 판 한 줄: 한국어 응원 말 「${ep.end.cheerKo}」 옆에 그 뜻${ep.end.cheerBy !== undefined ? ' — 끝 장면 속 그 인물의 말풍선' : ''}`, 상자(360, 28, 1, 800, 540, 960));
else add('끝.응원', '끝', ep.loc[lang].cheer, ep.ko?.cheer, [응원초, 끝초], '한국어 응원 말 바로 아래 뜻', 상자(800, 32, 1, 800, 92, 460));

const out = {
  꼴: '판본글/1', 편: path.basename(편), 판본: 판본키, 언어: lang, 나라: 국가 ? [국가] : [], 틀: '퀴즈', 화면: { 폭: 1080, 높이: 1920 },
  기준: {
    한문장: `한국어 관용구 셋은 글자 그대로가 아니다 — ${ep.questions.map((q) => `${q.idiom} = ${q.ko?.options?.[q.correct] ?? ''}`).join(', ')}`,
    핵심: ep.questions.map((q) => [q.idiom, ...(q.ko?.options?.[q.correct] ? [q.ko.options[q.correct]] : [])]),
    웃음: '글자 그대로 그린 엉뚱한 펠트 장면(몽글)이 뒤집혀 진짜 뜻 장면이 되는 차이',
  },
  줄,
  // 「맞을까 틀릴까」 문제는 함정 뜻 줄과 뒤집힌 뒤의 진짜 뜻 줄 가운데 뜻 줄이 정답이다
  퀴즈: ep.questions.map((q, i) => { const kind = beats.questions[i].kind; if (kind === 'ox') return { 문제: i + 1, 관용구: q.idiom, 보기: [`q${i + 1}.보기.1`, `q${i + 1}.뜻`], 정답: 2 }; const show = kind === 'duel' ? (q.show || [0, 1]) : [0, 1, 2]; return { 문제: i + 1, 관용구: q.idiom, 보기: show.map((_, pos) => `q${i + 1}.보기.${pos + 1}`), 정답: show.indexOf(q.correct) + 1 }; }),
};
const dir = path.join(편, '게시', `01-${lang}`);
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `글_${lang}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log(`${path.relative(뿌리, file)} · 줄 ${줄.length} · 판본 ${판본키} · ${끝초.toFixed(1)}초`);
