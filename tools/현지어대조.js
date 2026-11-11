#!/usr/bin/env node
// 현지어 사전 검문기(10-18) — 나라별 채널판 문안을 거른다(현지어 확인은 역번역 Opus · Fable · 아르곤 세 겹이 기준 — 원어민 검수는 11-02 기각). 몽골어 검문(tools/몽골어대조.js)의 두 겹만 옮겼다.
//   ① 원문을 안 보여 주는 문법·자연스러움 채점(아르곤) — 문장이 깨졌는지 + 「이 나라에서 불편한 표현 · 그림」(나라 프로필 금기를 같이 준다)
//   ② 다듬기를 막은 직역 역번역(flash) — 뜻이 흘렀는지. 역번역↔한국어 원문의 «뜻» 대조는 사람(또는 Claude)이 한국어 둘을 견줘 한다.
// 몽골어의 맞춤법 사전(spellcheck.mn) 같은 자는 다른 언어엔 없다 — 그래서 이 도구의 「정상」은 «거름망 통과»일 뿐 확정이 아니다.
//
// 10-25부터 퀴즈 밖 화면 글 편(몽골 화면 글 릴스를 샤오훙수 간체 · 틱톡 버마어로 옮긴 판)도 넣는다 — 기획장부/LAB.md 머리말 「두 채널 판」.
//
// 11-10 줄 단위로 고침(LAB 하루 두 편 설계 13, docs/마케팅/LAB_하루두편_설계_20261110/README.md):
//   - 결과를 줄마다 낸다(예전엔 가장 나쁜 줄 하나로 판정해 하루치가 한 줄 탓에 「어색」이 되고 어느 편인지 못 갈랐다). 줄마다 id · 편 · 판본이 붙는다.
//   - 뜻 · 정답 · 예문 칸은 「직역과 같은지」, 개그 · 해설 · 딱지 칸은 「웃음 의도가 같은지」로 나눠 묻는다(역번역에 웃음 까닭을 따로 받는다).
//   - 문장마다 id와 장면 맥락을 붙이고, 원문은 숨기고, 순서를 섞어(같은 입력이면 늘 같은 순서) 12줄 묶음으로 보낸다
//     (현장 노트 AI_CLI — 큰 묶음의 「정상」은 문장 지적을 놓쳤다).
//   - --이전 <앞 판 파일>: Fable이 고친 최종 판을 넣을 때 바뀐 줄만 다시 보고, 그대로인 줄은 앞 판 결과(<앞 판>.대조.json)를 잇는다.
//   - 원문을 안 본 새 Opus 하위 에이전트에게 줄 직역 역번역 질문(<결과>.역번역_질문.md)을 같이 만든다. 받은 답은
//     --대조표 <결과.json> --역번역답 <답 파일>로 줄마다 원문 · flash 직역 · Opus 직역을 나란히 붙인다(호출 없음).
//
// 쓰는 법:  node tools/현지어대조.js --언어 "태국어" --파일 <경로>                 (예전 꼴 — 그대로 된다)
//          파일 형식 = 한국어 원문 블록 / 단독 줄 `---` / 번역 블록 (줄마다 같은 번호를 달면 그 번호가 줄 id가 된다. [화면 글] 같은 꺾쇠 줄은 구역 이름)
//          또는 --파일 <판본 글.json>(tools/lib/판본글.js 꼴 — 줄 id · 칸 · 원문 · 장면이 다 들었다). --파일은 여럿 줘도 된다(하루치 묶음 — 언어는 하나).
//          --나라 TH,MY  「불편한 표현 · 그림」 칸에 줄 나라 금기(기본: 판본 글 나라 → 그 언어의 나라). --웃음 <id,id> 예전 꼴에서 웃음 칸 줄.
//          --맥락 "<어떤 글인지>" 학습 쇼츠가 아닌 글(앱 화면 글 등)의 채점 전제를 바꾼다. --문법만 역번역을 이미 따로 했을 때 직역을 건너뛴다(11-09 PULSE 영어 앱 글).
//          --이전 <앞 판 파일> 바뀐 줄만 다시. --밖 <결과.json> 결과 자리(기본 <첫 파일>.대조.json).
//          node tools/현지어대조.js --대조표 <결과.json> --역번역답 <Opus 답 파일>   ← 호출 없이 Opus 직역을 붙여 줄마다 나란히 보인다
//          node tools/현지어대조.js --판본 <편 폴더> --키 <판본 키> [--기록 --뜻대조 "<본 것>"] [--판정 "<줄 id>=<까닭>"]… [--다시 <id,…> | --다시모두]
//            ← 11-11 판본 기록(Fable 5.2 끝 판 검수 P2-4, 아래 「판본 기록」): 그 판본의 글.json을 통째로 대조해 준비.json 「돌림」.판본[키].검수.현지어에 적는다
//          모델: 문법 = GEMINI_GRAMMAR_MODEL || gemini-4-carbon(high — 11-11 「제미나이 검수는 전부 카본」, agy에는 max가 없다), 역번역 = 모델정책 기본(flash high —
//          판정이 아니라 곧이곧대로 옮기는 층이라 그대로, 몽골어대조.js 주석). 통로는 Google AI 구독(agy 로그인 계정)뿐이다.
// 종료코드: 0 = 모든 줄 문법 「정상」 · 불편 없음 + 역번역 받음 · 2 = 검수 필요한 줄이 있음(어색·파손·불편·판정불능·역번역 실패) · 1 = 실행 오류
// ⚠ 우리가 쓴 공개 카피 전용 — 남이 보낸 글은 넣지 않는다(본문이 프롬프트에 실린다).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const 묶음크기 = 12;
const 웃음칸 = new Set(['딱지', '개그', '해설']);
const 판정들 = ['정상', '어색', '파손'];

function 인자(argv, 이름) {
  const i = argv.indexOf(이름);
  return i > -1 ? argv[i + 1] : undefined;
}
function 인자들(argv, 이름) {
  const out = [];
  argv.forEach((a, i) => { if (a === 이름 && argv[i + 1]) out.push(argv[i + 1]); });
  return out;
}

function 파일분해(text) {
  const 줄 = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const 칸 = 줄.findIndex((l) => l.trim() === '---');
  if (칸 < 1) return null;
  const ko = 줄.slice(0, 칸).join('\n').trim();
  const 번역 = 줄.slice(칸 + 1).join('\n').trim();
  return ko && 번역 ? { ko, 번역 } : null;
}

/** 블록 → [{번호|null, 글, 구역}] — 「12. 글」은 번호를 id로, 「[화면 글]」은 구역 이름으로 */
function 블록줄(block) {
  const out = [];
  let 구역 = null;
  for (const raw of String(block).split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    const 머리 = l.match(/^\[(.+)\]$/);
    if (머리) { 구역 = 머리[1]; continue; }
    const m = l.match(/^(\d+)[.)]\s*(.*)$/);
    out.push(m ? { 번호: m[1], 글: m[2], 구역 } : { 번호: null, 글: l, 구역 });
  }
  return out;
}

/** 예전 꼴(한국어 / --- / 번역) → 줄 목록. 번호가 양쪽에 있으면 번호로, 없으면 차례로 짝짓는다. */
function 예전꼴줄(text, { 이름 = '', 웃음 = [] } = {}) {
  const 짝 = 파일분해(text);
  if (!짝) return null;
  const ko = 블록줄(짝.ko), tr = 블록줄(짝.번역);
  const 번호짝 = tr.length && tr.every((x) => x.번호) && ko.every((x) => x.번호);
  const 경고 = [];
  if (!번호짝 && ko.length !== tr.length) 경고.push(`원문 ${ko.length}줄 · 번역 ${tr.length}줄 — 수가 달라 차례로 짝지었다(번호를 달면 번호로 짝짓는다)`);
  const 웃 = new Set(웃음.map(String));
  const 줄 = tr.map((t, i) => {
    const id = t.번호 || String(i + 1);
    const k = 번호짝 ? ko.find((x) => x.번호 === t.번호) : ko[i];
    if (번호짝 && !k) 경고.push(`번역 ${id}번과 짝인 원문이 없다`);
    return { id, 편: 이름, 판본: null, 칸: null, 대조: 웃.has(id) ? '웃음' : '직역', 원문: k ? k.글 : '', 글: t.글, 장면: t.구역 || '' };
  });
  return { 줄, 경고, 한국어: 짝.ko, 번역: 짝.번역 };
}

/** 판본 글(JSON) → 줄 목록. 한국어 · 읽기 줄은 옮긴 글이 아니라 뺀다. */
function 판본글줄(자료, 이름) {
  const 한국어 = new Set(['한국어', '읽기']);
  return (자료.줄 || []).filter((z) => !한국어.has(z.칸) && String(z.글 || '').trim()).map((z) => ({
    id: z.id, 편: 자료.편 || 이름, 판본: 자료.판본 || null, 칸: z.칸 || null,
    대조: z.대조 === '웃음' || z.대조 === '직역' ? z.대조 : (웃음칸.has(z.칸) ? '웃음' : '직역'),
    원문: z.원문 || '', 글: String(z.글).replace(/\n/g, ' / '), 장면: z.장면 || '',
  }));
}

/** 파일 하나 → { 줄, 언어(판본 글이면), 나라, 경고 } */
function 파일읽기(file, { 웃음 = [] } = {}) {
  const text = fs.readFileSync(file, 'utf8');
  const 이름 = path.basename(file);
  if (/\.json$/i.test(file)) {
    const 자료 = JSON.parse(text.replace(/^﻿/, ''));
    if (자료.꼴 !== '판본글/1') throw new Error(`${이름}: 판본 글(꼴 「판본글/1」)이 아니다`);
    return { 줄: 판본글줄(자료, 이름), 언어: 자료.언어 || null, 나라: [].concat(자료.나라 || []), 경고: [] };
  }
  const r = 예전꼴줄(text, { 이름, 웃음 });
  if (!r) throw new Error(`${이름}: 파일 형식이 아니다 — 한국어 원문 / 단독 줄 --- / 번역 순이어야 한다`);
  return { 줄: r.줄, 언어: null, 나라: [], 경고: r.경고, 한국어: r.한국어, 번역: r.번역 };
}

/** 같은 입력이면 늘 같은 순서로 섞는다(내용 지문으로 씨앗) */
function 섞기(list, 씨앗글) {
  let s = crypto.createHash('sha256').update(씨앗글).digest().readUInt32LE(0) || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function 묶기(list, n = 묶음크기) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}
const 열쇠 = (z) => (z.편 ? `${z.편}#${z.id}` : z.id);
const 줄표시 = (z) => `[${열쇠(z)}] (${z.대조}${z.칸 ? ` · ${z.칸}` : ''}${z.장면 ? ` · 장면: ${z.장면}` : ''}) ${z.글}`;

const 문법스키마 = {
  type: 'object',
  properties: {
    줄: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, 판정: { type: 'string', enum: 판정들 }, 문제: { type: 'string' }, 고침: { type: 'string' }, 불편: { type: 'string' } },
        required: ['id', '판정'],
      },
    },
  },
  required: ['줄'],
};
const 역번역스키마 = {
  type: 'object',
  properties: {
    줄: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, 직역: { type: 'string' }, 웃음까닭: { type: 'string' } }, required: ['id', '직역'] } },
  },
  required: ['줄'],
};

function 문법질문(언어이름, 묶음, { 맥락, 나라말, 금기 }) {
  return [
    맥락
      ? `다음은 ${언어이름}로 쓴 글의 줄들이다. ${맥락} 원문·의도는 모른다고 가정하고 줄마다 ${언어이름}의 문법·맞춤법·자연스러움만 평가해라.`
      : `다음은 ${언어이름}로 쓴 어린이·초보 학습자용 한국어 학습 쇼츠(관용구 퀴즈 · 화면 글 릴스)의 화면 글과 게시 문안 줄들이다. 여러 편이 섞여 있고 순서도 섞었다. 원문·의도는 모른다고 가정하고 줄마다 ${언어이름}의 문법·맞춤법·자연스러움만 평가해라.`,
    '퀴즈 편이면 게임 쇼 표지(예: 「틀렸어!」, 「3초 안에 맞혀 봐!」), 짧은 보기 버튼, 일부러 글자 그대로 옮긴 우스운 오답 딱지(대조 「웃음」 · 줄 끝이 ?)가 섞여 있다 — 오답 딱지가 어색한 건 일부러다.',
    '한국어 발음 표기(로마자·현지 글자로 적은 한국어)는 평가하지 마라.',
    `또 줄마다 ${나라말} 시청자에게 불편하거나 거슬릴 표현 · 그림(장면 설명 포함)이 있으면 「불편」에 까닭을 적고, 없으면 비워라. 참고할 금기:`,
    금기 || '- (금기 목록 없음)',
    '줄마다 하나씩, 앞의 [ ] 안 id를 그대로 돌려줘라. 문제가 있는 줄은 「문제」에 무엇이 문제인지, 「고침」에 고친 문장을 적어라.',
    '',
    ...묶음.map(줄표시),
  ].join('\n');
}
function 역번역질문(언어이름, 묶음) {
  return [
    `다음 ${언어이름} 줄들을 한국어로 옮겨라. 줄마다 [id]와 그 줄이 나오는 장면이 붙어 있고 순서는 섞었다. 원문은 주지 않는다.`,
    '- 대조 「직역」 줄: "직역"해라. 자연스럽게 다듬지 말고 어색하면 어색한 채로 옮겨라.',
    '- 대조 「웃음」 줄: 직역하고, 이 줄이 무엇으로 웃기려는지 「웃음까닭」에 한 줄로 적어라(모르겠으면 「모름」).',
    '줄마다 하나씩, 앞의 [ ] 안 id를 그대로 돌려줘라.',
    '',
    ...묶음.map(줄표시),
  ].join('\n');
}
function Opus질문(언어이름, 줄들) {
  return [
    `너는 ${언어이름}를 한국어로 옮기는 번역가다. 아래 ${언어이름} 줄들을 한국어로 "직역"해라 — 다듬지 말고 어색하면 어색한 채로, 모르는 낱말은 소리대로 적고 「?」를 붙여라. 원문은 주지 않는다. 다른 파일 · 인터넷은 보지 않는다.`,
    '줄마다 [id] · 대조 방식 · 장면(그때 화면)이 붙어 있고 순서는 섞었다. 대조 「웃음」 줄은 직역 다음 「웃음까닭」에 이 줄이 무엇으로 웃기려는지 한 줄로 적어라.',
    'JSON 하나로만 답해라: {"줄": [{"id": "<[ ] 안 그대로>", "직역": "…", "웃음까닭": "…(웃음 줄만)"}]}',
    '',
    ...줄들.map(줄표시),
    '',
  ].join('\n');
}

function JSON꺼내기(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch { /* 아래 */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* 판정불능 */ } }
  return null;
}

/** 줄 판정 — 거름망 통과는 문법 정상 · 불편 없음 · (역번역을 하면) 직역 받음 */
function 줄판정(r, { 문법만 = false } = {}) {
  const 까닭 = [];
  if (!판정들.includes(r.문법)) 까닭.push('문법 판정불능');
  else if (r.문법 !== '정상') 까닭.push(`문법 ${r.문법}`);
  if (r.불편) 까닭.push('불편한 표현 · 그림');
  if (!문법만 && !r.직역) 까닭.push('역번역 없음');
  return { 판정: 까닭.length ? '검수 필요' : '거름망 통과', 까닭 };
}

/**
 * 대조 본체(호출기를 받아 시험할 수 있다). 부름(model, prompt, {schema, thinking}) → 글.
 * 이전결과: Map(열쇠 → 앞 판 줄 결과) — 글이 같으면 그 결과를 잇고 다시 묻지 않는다.
 */
async function 대조하기({ 줄들, 언어이름, 부름, 문법모델, 역모델, 역사고 = 'high', 맥락 = null, 문법만 = false, 나라말 = '이 나라', 금기 = '', 이전결과 = null }) {
  const 결과 = new Map();
  const 볼줄 = [];
  for (const z of 줄들) {
    const 앞 = 이전결과?.get(열쇠(z));
    if (앞 && 앞.번역 === z.글 && 앞.판정) 결과.set(열쇠(z), { ...앞, 이음: true });
    else 볼줄.push(z);
  }
  const 섞인 = 섞기(볼줄, 볼줄.map((z) => `${열쇠(z)}|${z.글}`).join('\n'));
  const 묶음들 = 묶기(섞인);
  const 문법답 = new Map(), 역답 = new Map(), 호출오류 = [];
  for (const 묶음 of 묶음들) {
    try {
      const 질문 = 문법질문(언어이름, 묶음, { 맥락, 나라말, 금기 });
      let t;
      try {
        t = await 부름(문법모델, 질문, { schema: 문법스키마, thinking: 'high' });
      } catch (e) {
        // 스키마를 붙인 긴 사고 답이 어떤 묶음(11-12 힌디 · 키르기스 · 카자흐 · 크메르 · 버마어 노래 판본)에서 빈 채로 끝난다 — 같은 모델 · 같은 지시를
        // 스키마 없이 한 번 더 부른다(현장 노트 AI_CLI 「몽골어대조.js --구독이 같은 묶음에서 agy가 빈 답을 냈다」).
        if (!/빈 답/.test(e.message)) throw e;
        t = await 부름(문법모델, `${질문}\n\n답은 아래 꼴의 JSON 한 덩어리만 낸다(설명 · 코드 울타리 없이): {"줄":[{"id":"…","판정":"${판정들.join('|')}","문제":"…","고침":"…","불편":"…"}]}`, { thinking: 'high' });
      }
      for (const x of JSON꺼내기(t)?.줄 || []) if (x && x.id) 문법답.set(String(x.id), x);
    } catch (e) { 호출오류.push(`문법 채점 실패: ${e.message}`); }
    if (문법만) continue;
    try {
      const t = await 부름(역모델, 역번역질문(언어이름, 묶음), { schema: 역번역스키마, thinking: 역사고 });
      for (const x of JSON꺼내기(t)?.줄 || []) if (x && x.id) 역답.set(String(x.id), x);
    } catch (e) { 호출오류.push(`역번역 실패: ${e.message}`); }
  }
  for (const z of 볼줄) {
    const k = 열쇠(z);
    const g = 문법답.get(k) || 문법답.get(String(z.id)) || {};
    const b = 역답.get(k) || 역답.get(String(z.id)) || {};
    const r = {
      id: z.id, 편: z.편 || null, 판본: z.판본 || null, 칸: z.칸, 대조: z.대조, 원문: z.원문, 번역: z.글, 장면: z.장면 || '',
      문법: g.판정 || null, 문제: g.문제 || '', 고침: g.고침 || '', 불편: String(g.불편 || '').trim(),
      직역: 문법만 ? null : String(b.직역 || '').trim(), 웃음까닭: String(b.웃음까닭 || '').trim(),
    };
    Object.assign(r, 줄판정(r, { 문법만 }));
    결과.set(k, r);
  }
  const 줄결과 = 줄들.map((z) => 결과.get(열쇠(z)));
  return { 줄: 줄결과, 묶음수: 묶음들.length, 다시본줄: 볼줄.length, 이은줄: 줄들.length - 볼줄.length, 호출오류 };
}

function 보이기(결과, { 언어이름, 머리 }) {
  console.log(머리);
  console.log('\n■ 줄마다 (원문 안 보여 주고 채점 · 섞어 보냄)');
  for (const r of 결과.줄) {
    const 곳 = [r.편, r.판본].filter(Boolean).join(' · ');
    console.log(`[${r.id}]${곳 ? ` ${곳}` : ''} · ${r.대조}${r.칸 ? `(${r.칸})` : ''} — ${r.판정}${r.이음 ? ' (앞 판 결과를 이음)' : ''}${r.까닭?.length ? ` · ${r.까닭.join(' · ')}` : ''}`);
    console.log(`  원문: ${r.원문 || '(없음)'}`);
    console.log(`  번역: ${r.번역}`);
    console.log(`  문법: ${r.문법 || '판정불능'}${r.문제 ? ` — ${r.문제}` : ''}${r.고침 ? `\n  고침: ${r.고침}` : ''}`);
    if (r.불편) console.log(`  불편: ${r.불편}`);
    if (r.직역 !== null && r.직역 !== undefined) console.log(`  직역: ${r.직역 || '(빈 응답) ⚠ 검수 필요'}`);
    if (r.웃음까닭) console.log(`  웃음까닭(역번역 쪽): ${r.웃음까닭}`);
    if (r.직역Opus) console.log(`  직역(Opus): ${r.직역Opus}${r.웃음까닭Opus ? `\n  웃음까닭(Opus): ${r.웃음까닭Opus}` : ''}`);
  }
  for (const e of 결과.호출오류 || []) console.log(`⚠ ${e}`);
  const 필요 = 결과.줄.filter((r) => r.판정 !== '거름망 통과');
  console.log(`\n결과: 거름망 통과 ${결과.줄.length - 필요.length}줄 · 검수 필요 ${필요.length}줄${필요.length ? ` (${필요.map((r) => [r.편, r.id].filter(Boolean).join('#')).join(', ')})` : ''} — ${언어이름} · 역번역 뜻 대조(원문과 견줌)는 따로`);
}

function 이전결과읽기(이전파일) {
  if (!이전파일) return null;
  const f = `${이전파일}.대조.json`;
  if (!fs.existsSync(f)) return new Map();
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return new Map((j.줄 || []).map((r) => [r.편 ? `${r.편}#${r.id}` : r.id, r]));
}

function 대조표(argv) {
  const 표 = 인자(argv, '--대조표');
  const 답 = 인자(argv, '--역번역답');
  if (!표 || !답) { console.error('쓰는 법: node tools/현지어대조.js --대조표 <결과.json> --역번역답 <Opus 답 파일>'); return 1; }
  const j = JSON.parse(fs.readFileSync(표, 'utf8'));
  const a = JSON꺼내기(fs.readFileSync(답, 'utf8'));
  if (!a || !Array.isArray(a.줄)) { console.error('Opus 답에서 {"줄": [...]} JSON을 못 읽었다'); return 1; }
  const 답들 = new Map(a.줄.map((x) => [String(x.id), x]));
  let 붙음 = 0;
  for (const r of j.줄) {
    const x = 답들.get(r.편 ? `${r.편}#${r.id}` : String(r.id)) || 답들.get(String(r.id));
    if (x) { r.직역Opus = String(x.직역 || '').trim(); r.웃음까닭Opus = String(x.웃음까닭 || '').trim(); 붙음 += 1; }
  }
  fs.writeFileSync(표, JSON.stringify(j, null, 2) + '\n');
  보이기(j, { 언어이름: j.언어, 머리: `언어: ${j.언어} · Opus 직역 ${붙음}/${j.줄.length}줄을 붙였다(${path.basename(답)})` });
  return j.줄.some((r) => r.판정 !== '거름망 통과') ? 2 : 0;
}

// ── 판본 기록(11-11 Fable 5.2 끝 판 검수 P2-4) ──
// 게시글(제목 · 본문 · 고정 댓글)은 뜻 검사 시험지에 안 실린다(화면 줄만) — 현지어를 보는 것은 이 도구뿐인데 결과가 --밖 파일에만 남아 판본 지문과
// 안 묶였다. 게시글만 고친 판본은 「뜻 검사 다시」가 고친 줄을 안 본 채 통과를 다시 적었다(11-11 「화날때」 멕시코판).
// `--판본 <편 폴더> --키 <키>`는 그 판본의 글.json을 통째로 대조한다. 앞서 받은 결과(<키>.판본.대조.json · <키>.앞.대조.json)와 줄 id · 글이 같은
// 줄은 그 결과를 잇고 바뀐 줄만 다시 묻는다. `--기록`이면 「돌림」.판본[키].검수.현지어 = { 결과, 지문: <글.json SHA-256>, … }을 쓴다 — 글을 고치면
// 지문이 달라져 저절로 무효가 된다(tools/돌림표.js versionState — sns-계정.json labRotation.판본검수에 「현지어」가 있으면 돌림에 드는 조건).
//   통과 = 모든 줄이 「거름망 통과」이거나 사람 판정(--판정 "<줄 id>=<까닭>")이 있고 · 호출 오류가 없고 · 역번역 직역을 원문과 견줬다는 메모
//   (--뜻대조 "<어느 줄을 어떻게 봤는지>")가 있다. 뜻 대조는 이 도구가 하지 않는다(머리말 ②) — 메모 없이는 통과를 적지 않는다.
//   사람 판정은 결과 파일의 그 줄에 남아 다음 실행이 잇고(글이 그대로일 때만), 기록의 「판정줄」로 보인다.
const 저장소 = path.resolve(__dirname, '..');
const 메모최소 = 10;

function 판본결과자리(편폴더, 키) {
  const 뿌리 = process.env.SYNK_LOCALCHECK_DIR
    ? path.resolve(process.env.SYNK_LOCALCHECK_DIR)
    : path.join(require('./lib/공용작업본.js').공용작업본(저장소), '.tmp', '현지어대조');
  return path.join(뿌리, path.basename(path.resolve(편폴더)), `${키}.판본.대조.json`);
}

/** 앞서 받은 결과 파일들(앞의 것이 먼저) → Map(열쇠 → 줄 결과). 줄 id와 옮긴 글이 둘 다 같은 줄만 잇는다. */
function 앞결과모으기(파일들, 줄들) {
  const 앞 = new Map();
  for (const f of 파일들) {
    if (!f || !fs.existsSync(f)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    for (const r of j.줄 || []) {
      const k = `${r && r.id}\n${r && r.번역}`;
      if (r && r.id !== undefined && r.판정 && !앞.has(k)) 앞.set(k, r);
    }
  }
  const out = new Map();
  for (const z of 줄들) { const r = 앞.get(`${z.id}\n${z.글}`); if (r) out.set(열쇠(z), r); }
  return out;
}

/** 판본 기록의 판정(순수) — 통과가 아니면 무엇이 모자란지 */
function 판본판정(줄결과, { 호출오류 = [], 뜻대조 = '' } = {}) {
  const 문제 = [];
  const 필요 = 줄결과.filter((r) => r.판정 !== '거름망 통과' && !r.사람판정);
  if (필요.length) 문제.push(`검수 필요한 줄 ${필요.length} — ${필요.map((r) => `${r.id}(${(r.까닭 || []).join(' · ') || '까닭 없음'})`).join(', ')}: 글을 고치거나(판본글잇기 뽑기 → 다시 대조) --판정 "<줄 id>=<까닭>"`);
  if (호출오류.length) 문제.push(`호출 오류 ${호출오류.length} — ${호출오류[0]}`);
  if (String(뜻대조 || '').trim().length < 메모최소) 문제.push('역번역 직역을 원문과 견줬다는 메모가 없다 — --뜻대조 "<어느 줄을 어떻게 봤는지>"(뜻 대조는 이 도구가 하지 않는다)');
  const 판정줄 = 줄결과.filter((r) => r.사람판정).map((r) => ({ 줄: r.id, 칸: r.칸 || null, 까닭: r.사람판정.까닭, 문법: r.문법 || null, 문제: r.문제 || '', 불편: r.불편 || '' }));
  return { 결과: 문제.length ? '검수 필요' : '통과', 문제, 판정줄 };
}

function 호출준비() {
  const 정책 = require('./모델정책.js');
  const 기본 = 정책.제미나이설정();
  const 역모델 = process.env.GEMINI_MODEL || 기본.model;
  const 역사고 = 기본.thinking_level || 'high';
  const 문법모델 = process.env.GEMINI_GRAMMAR_MODEL || 'gemini-4-carbon';
  // 시험 이음매: SYNK_LOCALCHECK_CALLER = { 부르기 }를 내보내는 모듈(가짜 응답). 평소엔 Google AI 구독 통로.
  const { 부르기 } = require(process.env.SYNK_LOCALCHECK_CALLER ? path.resolve(process.env.SYNK_LOCALCHECK_CALLER) : './lib/제미나이구독호출.js');
  const 부름 = async (model, prompt, 옵션 = {}) => String(((await 부르기({ model, prompt, thinking: 옵션.thinking || 'high', schema: 옵션.schema || null })) || {}).text || '');
  return { 부름, 문법모델, 역모델, 역사고 };
}

async function 판본검사(argv) {
  const 편 = 인자(argv, '--판본');
  const 키 = 인자(argv, '--키');
  if (!편 || !키 || 편.startsWith('--') || 키.startsWith('--')) {
    console.error('쓰는 법: node tools/현지어대조.js --판본 <편 폴더> --키 <판본 키> [--기록 --뜻대조 "<본 것>"] [--판정 "<줄 id>=<까닭>"]… [--다시 <id,…> | --다시모두]');
    return 1;
  }
  const 판본글 = require('./lib/판본글.js');
  const 프로필 = require('./lib/현지화프로필.js');
  let 찾음, 자료, 지문;
  try {
    찾음 = 판본글.판본찾기(편, 키);
    if (!찾음.글 || !fs.existsSync(찾음.글)) throw new Error(`판본 「${키}」의 글 파일이 없다(준비.json 「돌림」.판본.${키}.글)`);
    const buf = fs.readFileSync(찾음.글);
    지문 = crypto.createHash('sha256').update(buf).digest('hex');
    자료 = JSON.parse(buf.toString('utf8').replace(/^﻿/, ''));
    if (자료.꼴 !== '판본글/1') throw new Error(`${path.basename(찾음.글)}: 판본 글(꼴 「판본글/1」)이 아니다`);
  } catch (e) { console.error(`실행 오류: ${e.message}`); return 1; }
  const 줄들 = 판본글줄(자료, path.basename(path.resolve(편)));
  if (!줄들.length) { console.error('실행 오류: 볼 줄이 없다'); return 1; }
  const L = 프로필.언어(자료.언어 || 찾음.판본.언어);
  if (!L) { console.error(`실행 오류: 판본 글의 언어(${자료.언어 || 찾음.판본.언어 || '없음'})를 모른다`); return 1; }
  const 나라들 = [].concat(자료.나라 || []).length ? [].concat(자료.나라) : (L.나라 || []);
  const 나라말 = 나라들.map((cc) => 프로필.나라(cc)?.이름 || cc).join(' · ') || '이 나라';
  const 금기 = 프로필.금기요약(나라들);

  // 사람 판정 인자 — 꼴부터 본다(호출 뒤에 틀린 것을 알면 호출이 아깝다)
  const 사람 = new Map();
  for (const raw of 인자들(argv, '--판정')) {
    const i = String(raw).indexOf('=');
    const id = i > 0 ? raw.slice(0, i).trim() : '';
    const 까닭 = i > 0 ? raw.slice(i + 1).trim() : '';
    if (!id || 까닭.length < 메모최소) { console.error(`실행 오류: --판정은 "<줄 id>=<까닭 ${메모최소}자 이상>" 꼴이다(${raw})`); return 1; }
    if (!줄들.some((z) => String(z.id) === id)) { console.error(`실행 오류: --판정의 줄 「${id}」가 이 판본 글에 없다(${줄들.map((z) => z.id).join(' · ')})`); return 1; }
    사람.set(id, 까닭);
  }

  const 밖 = path.resolve(인자(argv, '--밖') || 판본결과자리(편, 키));
  fs.mkdirSync(path.dirname(밖), { recursive: true });
  const 다시 = new Set((인자(argv, '--다시') || '').split(',').map((x) => x.trim()).filter(Boolean));
  const 앞파일 = [밖, 밖.replace(/\.판본\.대조\.json$/i, '.앞.대조.json')];
  const 이전결과 = argv.includes('--다시모두') ? new Map() : 앞결과모으기(앞파일, 줄들.filter((z) => !다시.has(String(z.id))));
  const 호출 = 호출준비();
  const 결과 = await 대조하기({ 줄들, 언어이름: L.이름, 부름: 호출.부름, 문법모델: 호출.문법모델, 역모델: 호출.역모델, 역사고: 호출.역사고, 나라말, 금기, 이전결과 });
  결과.줄.forEach((r, i) => { r.편 = 줄들[i].편; r.판본 = 키; });
  for (const [id, 까닭] of 사람) {
    const r = 결과.줄.find((x) => String(x.id) === id);
    if (r.판정 === '거름망 통과') { console.error(`실행 오류: 줄 「${id}」는 거름망을 통과했다 — 통과한 줄에는 판정을 달지 않는다`); return 1; }
    r.사람판정 = { 까닭, 때: new Date().toISOString() };
  }
  const 뜻대조 = String(인자(argv, '--뜻대조') || '').trim();
  const 판 = 판본판정(결과.줄, { 호출오류: 결과.호출오류, 뜻대조 });
  const 기록 = {
    도구: 'tools/현지어대조.js', 시각: new Date().toISOString(), 편: path.basename(path.resolve(편)), 판본: 키, 글지문: 지문, 언어: L.이름, 언어코드: L.코드, 나라: 나라들,
    문법모델: 호출.문법모델, 역모델: 호출.역모델, 묶음수: 결과.묶음수, 다시본줄: 결과.다시본줄, 이은줄: 결과.이은줄, 호출오류: 결과.호출오류, 줄: 결과.줄,
  };
  fs.writeFileSync(밖, JSON.stringify(기록, null, 2) + '\n');
  const 다시본 = 결과.줄.filter((r) => !r.이음);
  const opus = 밖.replace(/\.json$/i, '') + '.역번역_질문.md';
  if (다시본.length) fs.writeFileSync(opus, Opus질문(L.이름, 섞기(줄들.filter((z) => 다시본.some((r) => r.id === z.id)), 다시본.map((r) => `${r.id}|${r.번역}`).join('\n'))));
  보이기(결과, {
    언어이름: L.이름,
    머리: `판본 ${기록.편} / ${키} · 언어: ${L.이름}(${L.코드}) · 나라 ${나라들.join(' · ') || '모름'} · 문법 채점 ${호출.문법모델}(high) · 직역 역번역 ${호출.역모델}(${호출.역사고})\n줄 ${줄들.length} · 다시 본 줄 ${결과.다시본줄} · 앞 결과에서 이은 줄 ${결과.이은줄} · 글 지문 ${지문.slice(0, 12)}`,
  });
  for (const r of 결과.줄.filter((x) => x.사람판정)) console.log(`  사람 판정 [${r.id}] ${r.사람판정.까닭}`);
  console.log(`기록: ${밖}`);
  if (다시본.length) console.log(`Opus 직역 역번역 질문(다시 본 ${다시본.length}줄): ${opus}`);
  if (!argv.includes('--기록')) {
    if (판.문제.length) console.log(`준비.json에 적으려면(--기록):\n${판.문제.map((m) => `  - ${m}`).join('\n')}`);
    return 결과.줄.every((r) => r.판정 === '거름망 통과' || r.사람판정) && !결과.호출오류.length ? 0 : 2;
  }
  // 대조하는 사이 글이 바뀌었으면 적지 않는다 — 지문이 본 글과 다른 글에 붙는다
  if (crypto.createHash('sha256').update(fs.readFileSync(찾음.글)).digest('hex') !== 지문) {
    console.error('실행 오류: 대조하는 사이 글.json이 바뀌었다 — 적지 않았다(다시 돌린다)');
    return 1;
  }
  const 상대 = path.relative(저장소, 밖).split(path.sep).join('/');
  // 결과 파일이 이 저장소 밖(회차 사본에서 돌리면 공용 작업본의 .tmp)에 있어도 절대 경로는 적지 않는다 — 준비.json은 공개 저장소에 올라가고
  // 절대 경로에는 사용자 폴더 이름이 든다(11-11 Fable 5.2 다시 검수 8-2 P3). 폴더 · 파일 이름만 남긴다.
  const 기록자리 = 상대.startsWith('..') || path.isAbsolute(상대) ? `(저장소 밖)/${path.basename(path.dirname(밖))}/${path.basename(밖)}` : 상대;
  const 값 = {
    결과: 판.결과, 지문, 시각: 기록.시각, 도구: 'tools/현지어대조.js', 줄: 결과.줄.length, 다시본줄: 결과.다시본줄, 이은줄: 결과.이은줄,
    문법모델: 호출.문법모델, 역모델: 호출.역모델, 기록: 기록자리,
    ...(판.결과 === '통과' ? { 뜻대조 } : { 문제: 판.문제 }),
    ...(판.판정줄.length ? { 판정줄: 판.판정줄 } : {}),
  };
  const 준비 = 판본글.검수쓰기(편, 키, '현지어', 값);
  console.log(`준비.json 「돌림」.판본[${키}].검수.현지어 = ${판.결과} (${path.relative(저장소, 준비).split(path.sep).join('/')})`);
  for (const m of 판.문제) console.log(`  ✗ ${m}`);
  return 판.결과 === '통과' ? 0 : 2;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--대조표')) return 대조표(argv);
  if (argv.includes('--판본')) return 판본검사(argv);
  const 파일들 = 인자들(argv, '--파일');
  const 언어인자 = 인자(argv, '--언어');
  if (!파일들.length) {
    console.error('쓰는 법: node tools/현지어대조.js --언어 "<언어 이름>" --파일 <경로>   (한국어 / --- / 번역, 또는 판본 글 .json — 여러 개 가능)');
    return 1;
  }
  const 웃음 = (인자(argv, '--웃음') || '').split(',').map((x) => x.trim()).filter(Boolean);
  let 읽은;
  try { 읽은 = 파일들.map((f) => ({ 파일: f, ...파일읽기(f, { 웃음 }) })); } catch (e) {
    console.error(`실행 오류: ${e.message}`);
    return 1;
  }
  const 프로필 = require('./lib/현지화프로필.js');
  const 언어코드들 = [...new Set(읽은.map((x) => x.언어).filter(Boolean))];
  if (언어코드들.length > 1) { console.error(`실행 오류: 언어가 섞였다(${언어코드들.join(' · ')}) — 한 번에 한 언어만`); return 1; }
  const L = 프로필.언어(언어인자 || 언어코드들[0]);
  if (!언어인자 && !L) { console.error('실행 오류: --언어가 없다(판본 글이면 「언어」 칸)'); return 1; }
  const 언어이름 = 언어인자 || L.이름;
  const 나라인자 = (인자(argv, '--나라') || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  const 나라들 = 나라인자.length ? 나라인자 : [...new Set(읽은.flatMap((x) => x.나라))].length ? [...new Set(읽은.flatMap((x) => x.나라))] : (L?.나라 || []);
  const 나라말 = 나라들.map((cc) => 프로필.나라(cc)?.이름 || cc).join(' · ') || '이 나라';
  const 금기 = 나라들.length ? 프로필.금기요약(나라들) : 프로필.금기요약([]);
  // 예전 꼴 파일 하나면 줄 id는 번호만 쓴다(고친 판 파일 이름이 달라도 --이전으로 앞 판 결과를 잇게). 여럿이면 파일 이름#번호.
  if (읽은.length === 1 && 읽은[0].한국어 !== undefined) for (const z of 읽은[0].줄) z.편 = null;
  const 줄들 = 읽은.flatMap((x) => x.줄);
  for (const x of 읽은) for (const w of x.경고) console.error(`⚠ ${path.basename(x.파일)}: ${w}`);
  if (!줄들.length) { console.error('실행 오류: 볼 줄이 없다'); return 1; }

  const { 부름, 문법모델, 역모델, 역사고 } = 호출준비();
  const 맥락 = 인자(argv, '--맥락') || null;
  const 문법만 = argv.includes('--문법만');
  const 이전 = 인자(argv, '--이전');
  const 결과 = await 대조하기({ 줄들, 언어이름, 부름, 문법모델, 역모델, 역사고, 맥락, 문법만, 나라말, 금기, 이전결과: 이전결과읽기(이전) });
  const 밖 = path.resolve(인자(argv, '--밖') || `${파일들[0]}.대조.json`);
  const 기록 = {
    도구: 'tools/현지어대조.js', 시각: new Date().toISOString(), 언어: 언어이름, 언어코드: L?.코드 || null, 나라: 나라들, 파일: 파일들.map((f) => path.resolve(f)),
    문법모델, 역모델: 문법만 ? null : 역모델, 묶음수: 결과.묶음수, 다시본줄: 결과.다시본줄, 이은줄: 결과.이은줄, 이전: 이전 || null, 호출오류: 결과.호출오류, 줄: 결과.줄,
  };
  fs.writeFileSync(밖, JSON.stringify(기록, null, 2) + '\n');
  const opus = 밖.replace(/\.json$/i, '') + '.역번역_질문.md';
  if (!문법만) fs.writeFileSync(opus, Opus질문(언어이름, 섞기(줄들, 줄들.map((z) => `${열쇠(z)}|${z.글}`).join('\n'))));
  보이기(결과, {
    언어이름,
    머리: `언어: ${언어이름}${L ? `(${L.코드})` : ''} · 나라 ${나라들.join(' · ') || '모름'} · 문법 채점 ${문법모델}(high) · 직역 역번역 ${문법만 ? '건너뜀' : `${역모델}(${역사고})`} · 구독 문(agy 로그인 계정)\n줄 ${줄들.length} · 묶음 ${결과.묶음수}(${묶음크기}줄씩 섞음) · 다시 본 줄 ${결과.다시본줄}${결과.이은줄 ? ` · 앞 판에서 이은 줄 ${결과.이은줄}` : ''}`,
  });
  console.log(`기록: ${밖}`);
  if (!문법만) console.log(`Opus 직역 역번역 질문: ${opus} — 원문을 안 본 새 Agent(model: opus)에게 주고, 답을 파일로 받아 node tools/현지어대조.js --대조표 "${밖}" --역번역답 <답 파일>`);
  const 모두통과 = 결과.줄.every((r) => r.판정 === '거름망 통과') && !결과.호출오류.length;
  return 모두통과 ? 0 : 2;
}

if (require.main === module) {
  // 구독 통로의 자식이 남아 붙잡아도 2초 뒤엔 끝낸다(예전처럼 종료 코드를 그대로 낸다).
  const 끝 = (code) => { process.exitCode = code; setTimeout(() => process.exit(code), 2000).unref(); };
  main().then(끝).catch((e) => {
    console.error('실행 오류:', e && e.message ? e.message : e);
    끝(1);
  });
}

module.exports = { 파일분해, 블록줄, 예전꼴줄, 판본글줄, 파일읽기, 섞기, 묶기, 문법질문, 역번역질문, Opus질문, JSON꺼내기, 줄판정, 대조하기, 앞결과모으기, 판본판정, 판본결과자리, 판본검사, main };
