// 답 은행 시험(2026-11-01) — 결과 · 들어 보기 페이지. 기준선 뒤 판: 같은 200줄에서 3판 · Gemini Live · 글 생성을 블라인드로 나란히 재고(판정4), 처음 보는 다판에서 2판 · 3판을 같은 잣대(블라인드, 생성 답까지)로 견주고,
// 2판 · 3판 · 실시간을 나란히 듣고, 학습자 말 끝에서 하온 첫 소리까지의 시간을 나눠 보인다. 2판 판 페이지는 git 기록과 README 「2판 시험」에 있다.
// 숫자와 대사는 결과 파일에서 읽고 손으로 옮기지 않는다.
// 읽는 것: .tmp/답은행시험-20261101/{판정4요약.json, 판정3요약.json, 판정2요약.json, 받아적기속도.json, 은행2길.json, 은행3길.json, 실시간판.json, 엮음/*.mp3}
//          · 이 폴더의 고르기2_C_AI.jsonl · 고르기3_C.jsonl(차례당 값 · 시간) · 기준선_*_C.jsonl · 판정3 · 판정4_C_*.jsonl(두 번 매긴 흔들림)
// 내는 것: .tmp/답은행시험-20261101/페이지/{index.html(SUIT 심음), *.mp3} → 아티팩트로 올린다(같은 주소).
// 쓰는 법: node 듣기페이지.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 녹음줄수 as 녹음줄수3, 반응들 as 반응들3 } from './은행3.mjs';
import { X는3판 } from './판정3.mjs';
import { 차림 } from './판정4.mjs';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 작업 = path.join(저장소, '.tmp', '답은행시험-20261101');
const 읽기 = (f) => JSON.parse(fs.readFileSync(path.join(작업, f), 'utf8'));
const jsonl = (f) => fs.readFileSync(path.join(여기, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const 판정 = 읽기('판정3요약.json');
const 판정4 = 읽기('판정4요약.json');
const 판정2 = 읽기('판정2요약.json');
const 속도 = 읽기('받아적기속도.json');
const 은행2길 = 읽기('은행2길.json');
const 은행3길 = 읽기('은행3길.json');
const 실시간 = 읽기('실시간판.json');
const 고2C = jsonl('고르기2_C_AI.jsonl');
const 고3C = jsonl('고르기3_C.jsonl');
const 기글 = jsonl('기준선_글_C.jsonl');
const 기제 = jsonl('기준선_제미나이_C.jsonl');

const 퍼 = (n, d) => (d ? (100 * n) / d : 0);
const 퍼글 = (n, d, 자리 = 1) => `${퍼(n, d).toFixed(자리)}%`;
const 글 = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const 원 = (usd) => Math.round(usd * 1400);
const 초 = (ms, 자리 = 1) => (ms / 1000).toFixed(자리);
const 중앙 = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const 위10 = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b[Math.floor(b.length * 0.9)]; };
const 검판들 = ['페이블', 'GPT', '엄격', '너그러움'];
const 검이름 = { 페이블: 'Fable', GPT: 'GPT', 엄격: '둘 다 자연일 때만', 너그러움: '하나라도 자연이면' };
const t = (판본, 검판 = '페이블') => 판정.판본[판본].전체[검판];
const 받률 = (c) => 퍼(c.자연, c.n);
const 엉률 = (c) => 퍼(c.어색, c.n);
const 범위 = (판본, f) => { const v = 검판들.map((k) => f(t(판본, k))); return [Math.min(...v), Math.max(...v)]; };
const 범위글 = (판본, f) => 범위(판본, f).map((v) => v.toFixed(1)).join('~');
const 통과 = (판본) => 검판들.filter((k) => 받률(t(판본, k)) >= 80 && 엉률(t(판본, k)) <= 5);
const 나판 = (판본, 검판 = '페이블') => 판정2.판.B.판본[판본].전체[검판];
const 판단수 = (줄, 판단) => 줄.filter((r) => r.판단 === 판단).length;

// ── 값 ──
const 평균 = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const 값 = {
  실시간: 4 * 0.05 + 0.003, // GPT-Live 분당 $0.05(시제품 README 실측) + 돌아보기
  흘려받아적기: 4 * 0.003, // gpt-4o-mini-transcribe 실시간 받아쓰기 분당 $0.003(server.mjs의 어림) — 4분 내내 흘려 보낸다고 친 위 끝
  통째받아적기: 8 * 0.0003, // 드라마 리허설 실측 한 테이크 × 8
  차례3: 평균(고3C.filter((r) => !r.오류).map((r) => r.USD || 0)), // 3판 고르기 + 생성 차례의 생성 값(다판 200줄 실측)
  차례2: 평균(고2C.filter((r) => !r.오류).map((r) => (r.USD || 0) + (r.생성USD || 0))),
  목소리: 4 / 60 * 0.015, // 생성 답 하나(약 4초)를 gpt-4o-mini-tts로 읽는 값 — 분당 약 $0.015(가격표 어림)
  돌아보기: 0.003,
};
const 생성률3 = 퍼(판단수(고3C, '생성'), 고3C.length);
const 생성률2 = 퍼(판단수(고2C, '생성'), 고2C.length);
const 한판3 = 8 * 값.차례3 + 8 * (생성률3 / 100) * 값.목소리 + 값.통째받아적기 + 값.돌아보기;
const 한판2 = 8 * 값.차례2 + 8 * (생성률2 / 100) * 값.목소리 + 값.통째받아적기 + 값.돌아보기;
const 글차례 = 평균(기글.filter((r) => !r.오류).map((r) => r.USD || 0));
const 한판글 = 8 * (글차례 + 값.목소리) + 값.통째받아적기 + 값.돌아보기;
const 라이브원 = Math.round((0.126 * 1400) / 10) * 10; // 조사.md의 Gemini 3.8 Live 유료 어림(3분 $0.08 · 10분 $0.6)을 4분으로 — 턴마다 앞 대화를 다시 세어 길수록 비싸다

// ── 속도: 학습자 소리 마지막 표본을 보낸 때부터 하온 첫 소리까지(중앙값을 더한 어림) ──
const 실시간지연 = 중앙([...실시간.A.줄, ...실시간.B.줄].map((l) => l.지연ms));
const 흘려 = Object.fromEntries((속도.흘려 || []).filter((r) => !r.오류).map((r) => [`${r.모델}|${r.설정}`, r]));
// 어림에 쓰는 설정은 의미 VAD — 침묵만 보는 설정은 더 빠르지만 초보의 머뭇거림에서 말을 자주 끊었다(아래 표). 실시간 미니 길도 의미 VAD를 쓴다
const 고른흘려 = 흘려['gpt-4o-mini-transcribe|의미 VAD 보통'];
const 침묵500 = 흘려['gpt-4o-mini-transcribe|서버 VAD 500ms']; const 침묵300 = 흘려['gpt-4o-mini-transcribe|서버 VAD 300ms'];
const 고르기ms3 = 중앙(고3C.map((r) => r.ms));
const 고르기ms3위 = 위10(고3C.map((r) => r.ms));
const 단계들 = [
  { 이름: '말 끝 알아채기', 키: '알아챔', 무늬: '회색' },
  { 이름: '받아 적기 마무리', 키: '받아적기', 무늬: '회색옅음' },
  { 이름: '답 고르기', 키: '고르기', 무늬: '코랄' },
  { 이름: '첫 반응까지 고르기(흘려 받기)', 키: '첫반응', 무늬: '코랄' },
  { 이름: '생성 첫 문장', 키: '생성', 무늬: '진함' },
  { 이름: '목소리 첫 소리', 키: '목소리', 무늬: '진함옅음' },
];
const 조각 = {
  알아챔: 고른흘려.알아챔중앙ms,
  받아적기: 고른흘려.완료중앙ms - 고른흘려.알아챔중앙ms,
  고르기: 고르기ms3,
  첫반응: 속도.고르기흘려.첫반응중앙ms,
  생성: 속도.생성.첫문장중앙ms,
  목소리: 속도.목소리.첫소리중앙ms,
};
const 길들 = [
  { 이름: '실시간(Gemini Live)', 통: 실시간지연 },
  { 이름: '3판 · 은행 답', 키들: ['알아챔', '받아적기', '고르기'] },
  { 이름: '고르기 흘려 받기(설계)', 키들: ['알아챔', '받아적기', '첫반응'], 설계: true },
  { 이름: '3판 · 생성 답', 키들: ['알아챔', '받아적기', '고르기', '생성', '목소리'] },
  { 이름: '글 생성(매 차례)', 키들: ['알아챔', '받아적기', '생성', '목소리'] },
  { 이름: '맞장구 먼저 틀기(설계)', 키들: ['알아챔'], 설계: true },
];
const 합 = (g) => g.통 ?? g.키들.reduce((s, k) => s + 조각[k], 0);
const 은행답지연 = 합(길들[1]); const 첫반응지연 = 합(길들[2]); const 생성답지연 = 합(길들[3]); const 글길지연 = 합(길들[4]);
function 속도막대({ 폭 = 680, 왼 = 170, 좁음 = false } = {}) {
  const 오 = 좁음 ? 44 : 60; const 줄높이 = 좁음 ? 46 : 40; const 위 = 30; const 끝초 = Math.ceil(Math.max(...길들.map(합)) / 1000);
  const x = (ms) => 왼 + (ms / (끝초 * 1000)) * (폭 - 왼 - 오);
  const 높이 = 위 + 길들.length * 줄높이 + 10;
  let s = `<svg viewBox="0 0 ${폭} ${높이}" role="img" aria-label="학습자 말 끝에서 하온 첫 소리까지 걸리는 시간을 단계별로 나눈 막대" class="속도 ${좁음 ? '좁은판' : '넓은판'}">
  <defs>${[['회색', 'var(--grey-mark)', 5], ['회색옅음', 'var(--grey-mark)', 9], ['코랄', 'var(--accent)', 5], ['진함', 'var(--fg)', 5], ['진함옅음', 'var(--fg)', 9]].map(([이름, 색, 간격]) => `<pattern id="빗금${이름}${좁음 ? '좁' : ''}" width="${간격}" height="${간격}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${간격}" style="stroke:${색}" stroke-width="1.6"/></pattern>`).join('')}</defs>`;
  for (let v = 0; v <= 끝초; v++) {
    s += `<line x1="${x(v * 1000)}" x2="${x(v * 1000)}" y1="${위 - 6}" y2="${높이 - 4}" class="눈금선"/>`;
    s += `<text x="${x(v * 1000)}" y="${위 - 12}" class="눈금글" text-anchor="middle">${v}초</text>`;
  }
  s += `<line x1="${x(실시간지연)}" x2="${x(실시간지연)}" y1="${위 - 6}" y2="${높이 - 4}" class="기준선"/>`;
  let y = 위;
  for (const g of 길들) {
    // 좁은 화면은 이름을 막대 위에 얹는다(왼쪽 칸이 없다)
    const cy = 좁음 ? y + 20 : y + 6; const h = 좁음 ? 16 : 18;
    s += `<text x="${좁음 ? 0 : 6}" y="${좁음 ? y + 14 : cy + 14}" class="판이름${g.설계 ? '' : ' 굵게'}">${글(g.이름)}</text>`;
    if (g.통 != null) s += `<rect x="${x(0)}" y="${cy}" width="${x(g.통) - x(0)}" height="${h}" fill="url(#빗금회색${좁음 ? '좁' : ''})" class="조각틀"/>`;
    else { let 앞 = 0; for (const k of g.키들) { const d = 단계들.find((u) => u.키 === k); s += `<rect x="${x(앞)}" y="${cy}" width="${x(앞 + 조각[k]) - x(앞)}" height="${h}" fill="url(#빗금${d.무늬}${좁음 ? '좁' : ''})" class="조각틀"><title>${d.이름} ${초(조각[k])}초</title></rect>`; 앞 += 조각[k]; } }
    s += `<text x="${x(합(g)) + 6}" y="${cy + 14}" class="점글">${초(합(g))}초</text>`;
    y += 줄높이;
  }
  return `${s}</svg>`;
}
// 범례 견본은 CSS 빗금 — 넓은 막대 SVG가 좁은 화면에서 숨으면 그 안의 무늬를 다른 곳에서 못 끌어 쓴다
const 범례 = 단계들.filter((d) => d.키 !== '첫반응').map((d) => `<span class="범례칸"><span class="견본 ${d.무늬}" aria-hidden="true"></span>${d.이름} ${초(조각[d.키])}초</span>`).join('');

// ── 편차 점: 기준 대비 여유(고른 눈금 ±), 점 = Fable · 옅은 줄 = 네 정답 판의 범위 ──
const 행들 = [[3, '3판'], [2, '2판']];
const 지표 = [
  { 이름: '맞게 받음', 기준: '80% 이상', 여유: (c) => 받률(c) - 80, 보임: (c) => `${받률(c).toFixed(1)}%` },
  { 이름: '엉뚱한 답', 기준: '5% 이하', 여유: (c) => 5 - 엉률(c), 보임: (c) => `${엉률(c).toFixed(1)}%` },
];
function 편차점({ 폭 = 640, 왼 = 120, 좁음 = false } = {}) {
  const 오 = 좁음 ? 46 : 70; const 줄높이 = 32; const 위 = 34; const 범 = 15;
  const x = (v) => 왼 + ((Math.max(-범, Math.min(범, v)) + 범) / (2 * 범)) * (폭 - 왼 - 오);
  const 높이 = 위 + 지표.length * (행들.length + 1) * 줄높이 + 8;
  let s = `<svg viewBox="0 0 ${폭} ${높이}" role="img" aria-label="기준 대비 여유 — 오른쪽이 기준을 넘긴 쪽. 점은 Fable 판정, 옅은 줄은 네 정답 판의 범위" class="편차 ${좁음 ? '좁은판' : '넓은판'}">`;
  for (const v of 좁음 ? [-10, 0, 10] : [-15, -10, -5, 0, 5, 10, 15]) {
    s += `<line x1="${x(v)}" x2="${x(v)}" y1="${위 - 8}" y2="${높이 - 4}" class="${v === 0 ? '기준선' : '눈금선'}"/>`;
    s += `<text x="${x(v)}" y="${위 - 14}" class="눈금글" text-anchor="middle">${v === 0 ? '기준' : `${v > 0 ? '+' : ''}${v}%p`}</text>`;
  }
  let y = 위;
  for (const g of 지표) {
    s += `<text x="0" y="${y + 18}" class="행머리">${g.이름} <tspan class="행기준">기준 ${g.기준}</tspan></text>`;
    y += 줄높이;
    for (const [판본, 이름] of 행들) {
      const c = t(판본); const v = g.여유(c); const 넘 = v >= 0; const cy = y + 12;
      const vs = 검판들.map((k) => g.여유(t(판본, k)));
      s += `<text x="${좁음 ? 2 : 10}" y="${cy + 5}" class="판이름${판본 === 3 ? ' 굵게' : ''}">${이름} · 다판</text>`;
      s += `<line x1="${x(Math.min(...vs))}" x2="${x(Math.max(...vs))}" y1="${cy}" y2="${cy}" class="범위선"/>`;
      s += `<line x1="${x(0)}" x2="${x(v)}" y1="${cy}" y2="${cy}" class="편차선 ${넘 ? '넘김' : '모자람'}"/>`;
      s += `<circle cx="${x(v)}" cy="${cy}" r="5" class="점 ${넘 ? '넘김' : '모자람'}"/>`;
      s += `<text x="${x(Math.max(...vs)) + 8}" y="${cy + 4}" class="점글">${g.보임(c)}</text>`;
      y += 줄높이;
    }
  }
  return `${s}</svg>`;
}

// ── 기준선: 매 차례 생성과 같은 잣대로(판정4 — 3판 · Gemini Live · 글 생성을 A · B · C로 섞어 매김) ──
const 팔들 = [['3판', '3판(답 은행)'], ['제미나이', 'Gemini Live'], ['글', '글 생성']];
const 팔 = (p, 검판 = '페이블') => 판정4.팔[p].전체[검판];
const 둘글 = (c) => `${엉률(c.페이블).toFixed(1)} · ${엉률(c.GPT).toFixed(1)}%`;
const 팔범위글 = (p, f) => { const v = 검판들.map((k) => f(팔(p, k))); return `${Math.min(...v).toFixed(1)}~${Math.max(...v).toFixed(1)}`; };
function 세길점({ 폭 = 640, 왼 = 120, 좁음 = false } = {}) {
  const 오 = 좁음 ? 46 : 70; const 줄높이 = 32; const 위 = 34; const 범 = 25;
  const x = (v) => 왼 + ((Math.max(-범, Math.min(범, v)) + 범) / (2 * 범)) * (폭 - 왼 - 오);
  const 높이 = 위 + 지표.length * (팔들.length + 1) * 줄높이 + 8;
  let s = `<svg viewBox="0 0 ${폭} ${높이}" role="img" aria-label="세 프로그램의 기준 대비 여유 — 오른쪽이 기준을 넘긴 쪽. 점은 Fable 판정, 옅은 줄은 네 정답 판의 범위" class="편차 ${좁음 ? '좁은판' : '넓은판'}">`;
  for (const v of 좁음 ? [-20, 0, 20] : [-20, -10, 0, 10, 20]) {
    s += `<line x1="${x(v)}" x2="${x(v)}" y1="${위 - 8}" y2="${높이 - 4}" class="${v === 0 ? '기준선' : '눈금선'}"/>`;
    s += `<text x="${x(v)}" y="${위 - 14}" class="눈금글" text-anchor="middle">${v === 0 ? '기준' : `${v > 0 ? '+' : ''}${v}%p`}</text>`;
  }
  let y = 위;
  for (const g of 지표) {
    s += `<text x="0" y="${y + 18}" class="행머리">${g.이름} <tspan class="행기준">기준 ${g.기준}</tspan></text>`;
    y += 줄높이;
    for (const [p, 이름] of 팔들) {
      const c = 팔(p); const v = g.여유(c); const 넘 = v >= 0; const cy = y + 12;
      const vs = 검판들.map((k) => g.여유(팔(p, k)));
      s += `<text x="${좁음 ? 2 : 10}" y="${cy + 5}" class="판이름${p === '3판' ? ' 굵게' : ''}">${좁음 ? 이름.replace('(답 은행)', '') : 이름}</text>`;
      s += `<line x1="${x(Math.min(...vs))}" x2="${x(Math.max(...vs))}" y1="${cy}" y2="${cy}" class="범위선"/>`;
      s += `<line x1="${x(0)}" x2="${x(v)}" y1="${cy}" y2="${cy}" class="편차선 ${넘 ? '넘김' : '모자람'}"/>`;
      s += `<circle cx="${x(v)}" cy="${cy}" r="5" class="점 ${넘 ? '넘김' : '모자람'}"/>`;
      s += `<text x="${x(Math.max(...vs)) + 8}" y="${cy + 4}" class="점글">${g.보임(c)}</text>`;
      y += 줄높이;
    }
  }
  return `${s}</svg>`;
}
const 조건95 = 판정4.조건['오류 없음 + 작별뒤 뺌'];
const 조건줄 = (이름, f) => `<tr><td>${글(이름)}</td>${팔들.map(([p]) => `<td>${둘글(f(p))}</td>`).join('')}</tr>`;
// 같은 3판 답을 판정 판마다 다시 매겼을 때 뒤집힌 줄 — 판정의 흔들림
const 흔들림 = Object.fromEntries([['페이블', '판정3_C_페이블.jsonl', '판정4_C_페이블.jsonl'], ['GPT', '판정3_C_GPT.jsonl', '판정4_C_GPT.jsonl']].map(([k, a, b]) => {
  const 앞판 = new Map(jsonl(a).map((r) => [r.id, r])); let 바뀜 = 0;
  for (const r of jsonl(b)) { const c = 차림(r.id); const 글자 = ['A', 'B', 'C'].find((g) => c[g] === '3판'); const 전 = 앞판.get(r.id); if ((X는3판(r.id) ? 전.X : 전.Y) !== r[글자]) 바뀜++; }
  return [k, 바뀜];
}));
const 마무리말 = '오늘 와 줘서 진짜 고마워요. 다음에 또 만나요, 약속!';
const 되풀이 = (줄) => 줄.filter((r) => r.id.startsWith('C.작별뒤') && (r.글 || '').includes(마무리말)).length;
const 작별뒤수 = 판정4.팔['3판'].순간별.작별뒤.페이블.n;
const 심함 = (p) => 판정4.팔[p].오류별.심함;

// ── 빗금 막대: 3판 다판의 약한 곳 ──
function 막대줄(이름, c, 강조 = false) {
  return `<div class="막대줄"><div class="막대이름">${글(이름)} <span class="작게">${c.n}줄</span></div>
    <div class="막대칸"><div class="막대 ${강조 ? '강조' : ''}" style="width:${받률(c).toFixed(1)}%"></div></div>
    <div class="막대값">${받률(c).toFixed(1)}%</div><div class="막대값 엉뚱값">${엉률(c).toFixed(1)}%</div></div>`;
}
const 삼 = 판정.판본[3]; const 이 = 판정.판본[2];
const 순간이름 = { 처음: '이름 묻기', 나라: '나라 묻기', 좋아함: '좋아하는 노래', 사인: '뭐 해 줄까요', 끝: '사인 끝', 작별뒤: '작별 뒤' };
const 길이름 = { 은행: '은행 답', 되묻기: '되묻기', 생성: '생성 답' };
const 길줄수 = (판본, 길) => 판정.판본[판본].길별[길].페이블.n;
const 길줄 = (판본, 길) => { const g = 판정.판본[판본].길별[길]; return `<td>${g.페이블.n}줄</td><td>${퍼글(g.페이블.어색, g.페이블.n)}</td><td>${퍼글(g.GPT.어색, g.GPT.n)}</td>`; };

// ── 세 판 대사 ──
const 표 = (b) => (b?.판단 === '고름' ? (b.반응 || []).map((r) => `<span class="묶음표">${글(r)}</span>`).join(' ') : `<span class="묶음표 넘김표">${글(b?.판단)}</span>`);
function 대화표(대) {
  const 둘 = 은행2길[대].차례; const 셋 = 은행3길[대].차례; const 실 = 실시간[대].줄;
  const 줄 = [`<tr><td class="학습자">—</td><td colspan="2">${글(은행3길[대].첫인사)}</td><td>${글(실[0]?.하온)}</td></tr>`];
  셋.forEach((c, i) => {
    const b = 둘[i];
    줄.push(`<tr><td class="학습자">${글(c.말)}<div class="작게">받아 적기: ${글(c.받아적기)}</div></td><td>${글(c.하온 ?? (c.건너뜀 ? '(대화가 이미 끝남)' : ''))}<div>${c.건너뜀 ? '' : 표(c)}</div></td><td>${글(b?.하온 ?? (b?.건너뜀 ? '(대화가 이미 끝남)' : ''))}<div>${b && !b.건너뜀 ? 표(b) : ''}</div></td><td>${글(실[i + 1]?.하온)}</td></tr>`);
  });
  return `<div class="표틀"><table class="대사"><thead><tr><th>학습자</th><th>3판 하온</th><th>2판 하온</th><th>실시간 하온</th></tr></thead><tbody>${줄.join('')}</tbody></table></div>`;
}

const 엉뚱3 = 판정.엉뚱3;
const 둘다 = 엉뚱3.filter((e) => e.F === '어색' && e.G === '어색');
// 검수자 메모의 X · Y를 읽는 사람이 알 수 있게 2판 · 3판으로 바꿔 보인다(블라인드는 판정 때만)
const 판이름바꿈 = (id, s) => { const 셋X = X는3판(id); return String(s || '').replace(/\bX\b/g, 셋X ? '3판' : '2판').replace(/\bY\b/g, 셋X ? '2판' : '3판'); };
const 엉목록 = [...둘다, ...엉뚱3.filter((e) => !(e.F === '어색' && e.G === '어색'))].slice(0, 14).map((e) => `<li><div class="엉뚱말">「${글(e.학습자말)}」</div>
  <div class="작게">받아 적기(${글(e.오류정도)}): ${글(e.받아적기)}</div>
  <div>3판 ${글(길이름[e.길] || e.길)} → 「${글(e.답)}」</div>
  <div class="작게">Fable ${글(e.F)} · GPT ${글(e.G)}${e.메모F ? ` — Fable 메모: ${글(판이름바꿈(e.id, e.메모F))}` : e.메모G ? ` — GPT 메모: ${글(판이름바꿈(e.id, e.메모G))}` : ''}</div></li>`).join('');

const 판정글 = (() => {
  const 통 = 통과(3);
  const 앞 = 통.length === 4 ? '3판은 처음 보는 200줄(다판)에서 네 정답 판 모두 두 기준을 넘었어요.'
    : 통.length ? `3판은 처음 보는 200줄(다판)에서 네 정답 판 가운데 ${통.length}판이 두 기준을 넘었어요(${통.map((k) => 검이름[k]).join(' · ')}).`
      : '3판도 처음 보는 200줄(다판)에서는 두 기준을 함께 넘지 못했어요.';
  return `${앞} 이번에는 생성으로 넘긴 차례도 실제로 답을 만들어 함께 매겼어요 — 맞게 받음 ${범위글(3, 받률)}% · 엉뚱 ${범위글(3, 엉률)}%(같은 다판에서 2판은 ${범위글(2, 받률)}% · ${범위글(2, 엉률)}%)예요.`;
})();
const 흘려표 = (속도.흘려 || []).map((r) => (r.오류 ? `<tr><td>${글(r.모델)}</td><td>${글(r.설정)}</td><td colspan="4" class="작게">안 됨: ${글(r.오류)}</td></tr>`
  : `<tr><td>${글(r.모델)}</td><td>${글(r.설정)}</td><td>${초(r.알아챔중앙ms)}초</td><td>${초(r.완료중앙ms)}초</td><td>${초(r.완료위10ms)}초</td><td>${r.갈린말}/${r.줄.length}</td></tr>`)).join('');

const html = `<title>하온 답 은행 시험</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 실험 노트: 판정 → 2판과 3판을 같은 잣대로 → 답이 나온 길 → 귀로 듣기 → 남은 흠 → 속도 → 값 → 잰 방법. 바탕은 종이 흰색 · 검정, 사업 색은 코랄 하나. */
:root{
  --bg:#FFFFFF;--fg:#171412;--muted:#6E6661;--line:#E7E1DC;--soft:#F6F2EF;
  --accent:#F96859;--accent-text:#AE322A;--grey-mark:#A39B95;--range:#D9D2CC;
  --font:'SUIT Variable','Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;
  --mono:ui-monospace,'Cascadia Mono',Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0B0A0A;--fg:#F3EFEC;--muted:#A79F99;--line:#2B2624;--soft:#171413;--accent:#F96859;--accent-text:#FF9C90;--grey-mark:#7C746F;--range:#3A3431;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0B0A0A;--fg:#F3EFEC;--muted:#A79F99;--line:#2B2624;--soft:#171413;--accent:#F96859;--accent-text:#FF9C90;--grey-mark:#7C746F;--range:#3A3431;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--font);font-size:16px;line-height:1.65;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:40px 64px}
main{max-width:60rem;margin:0 auto;display:grid;gap:56px}
h1,h2,h3{text-wrap:balance;line-height:1.3;margin:0}
h1{font-size:clamp(28px,4.4vw,40px);font-weight:800;letter-spacing:-.02em}
h2{font-size:22px;font-weight:750;letter-spacing:-.01em}
h3{font-size:17px;font-weight:700}
p{margin:0;max-width:65ch}
.머리{display:grid;gap:14px}
.작은머리{font-size:13px;letter-spacing:.06em;color:var(--muted);font-weight:600}
.판정{font-size:18px;max-width:64ch}
.판정 b{color:var(--accent-text)}
.숫자들{display:grid;grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.숫자{padding:16px 16px 16px 0;display:grid;gap:4px;min-width:0}
.숫자+.숫자{padding-left:16px;border-left:1px solid var(--line)}
.숫자 .큰{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.숫자 .큰 small{font-size:15px;font-weight:600;color:var(--muted)}
.숫자 .설명{font-size:13px;color:var(--muted)}
section{display:grid;gap:16px}
main>*,section>*{min-width:0}
.작게{font-size:13px;color:var(--muted)}
svg.편차,svg.속도{width:100%;height:auto;max-width:46rem}
svg.편차 text,svg.속도 text{font-family:var(--font);fill:var(--fg)}
.눈금글{font-size:11px;fill:var(--muted)!important}
.눈금선{stroke:var(--line);stroke-width:1}
.기준선{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:4 4}
.행머리{font-size:14px;font-weight:700}
.행기준{font-weight:500;fill:var(--muted)!important}
.판이름{font-size:12.5px;fill:var(--muted)!important}
.판이름.굵게{font-weight:700;fill:var(--fg)!important}
.범위선{stroke:var(--range);stroke-width:7;stroke-linecap:round}
.편차선{stroke-width:2}
.편차선.넘김{stroke:var(--accent)}
.편차선.모자람{stroke:var(--grey-mark)}
.점.넘김{fill:var(--accent)}
.점.모자람{fill:var(--bg);stroke:var(--grey-mark);stroke-width:2}
.점글{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}
.조각틀{stroke:var(--fg);stroke-width:.8}
.범례{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--muted)}
.범례칸{display:inline-flex;align-items:center;gap:6px}
.견본{display:inline-block;width:22px;height:12px;border:.8px solid var(--fg);--c:var(--grey-mark);--g:5px;background:repeating-linear-gradient(135deg,var(--c) 0 1.6px,transparent 1.6px var(--g))}
.견본.회색옅음{--g:9px}.견본.코랄{--c:var(--accent)}.견본.진함{--c:var(--fg)}.견본.진함옅음{--c:var(--fg);--g:9px}
svg.좁은판,.좁은판만{display:none}
@media (max-width:34rem){svg.넓은판{display:none}svg.좁은판{display:block;max-width:360px}.좁은판만{display:block}}
.들기{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:18px}
.들기 figure{margin:0;display:grid;gap:8px;min-width:0}
.들기 figcaption{font-weight:700}
.들기 figcaption span{font-weight:500;color:var(--muted);font-size:13px}
audio{width:100%}
.표틀{overflow-x:auto;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
th{font-size:12.5px;color:var(--muted);font-weight:650;background:var(--soft)}
tr:last-child td{border-bottom:0}
table.대사{min-width:54rem}
td.학습자{width:24%}
.묶음표{display:inline-block;font-family:var(--mono);font-size:11.5px;color:var(--accent-text);border:1px solid var(--line);border-radius:4px;padding:0 5px;margin-top:4px}
.넘김표{color:var(--muted)}
.관찰{display:grid;gap:6px;padding-left:18px;margin:0}
.관찰 li::marker{color:var(--accent)}
.막대표{display:grid;gap:10px}
.막대줄{display:grid;grid-template-columns:minmax(7rem,12rem) 1fr 4rem 4rem;gap:10px;align-items:center}
.막대머리{font-size:12.5px;color:var(--muted)}
.막대칸{height:14px}
.막대{height:100%;background:repeating-linear-gradient(135deg,var(--grey-mark) 0 1.2px,transparent 1.2px 5px);border-right:2px solid var(--fg)}
.막대.강조{background:repeating-linear-gradient(135deg,var(--accent) 0 1.2px,transparent 1.2px 5px);border-right-color:var(--accent-text)}
.막대값{font-variant-numeric:tabular-nums;font-size:14px;text-align:right}
.엉뚱값{color:var(--muted)}
.엉뚱들{display:grid;gap:14px;padding-left:18px;margin:0}
.엉뚱말{font-weight:650}
.수표 td:first-child,.수표 th:first-child{min-width:10rem}
.수표 td:not(:first-child),.수표 th:not(:first-child),.값표 td:nth-child(2),.값표 th:nth-child(2){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:30rem){.막대줄{grid-template-columns:1fr 3.4rem 3.4rem}.막대칸{grid-column:1/-1;order:2}.숫자+.숫자{padding-left:0;border-left:0;border-top:1px solid var(--line)}}
</style>
<main>
<header class="머리">
  <div class="작은머리">실시간 음성 상황극 · 하온 팬사인회 · 2026년 11월 1일 · 3판 · 기준선</div>
  <h1>미리 써 둔 답으로 하온이 받아칠 수 있을까</h1>
  <p class="판정">같은 200줄 · 같은 블라인드로 매 차례 생성한 답까지 매겼더니 <b>3판의 엉뚱 ${둘글(판정4.팔['3판'].전체)}(Fable · GPT)가 Gemini Live ${둘글(판정4.팔.제미나이.전체)}, 글 생성 ${둘글(판정4.팔.글.전체)}보다 낮았어요.</b> 5%는 실시간도 못 넘는 잣대였어요. 다만 차이의 대부분은 작별 되풀이와 받아 적기 오류에서 왔고, 둘을 뺀 ${조건95['3판'].페이블.n}줄에서는 3판 ${둘글(조건95['3판'])}, Gemini Live ${둘글(조건95.제미나이)}로 사실상 비겨요. 이 시험으로 보면 품질은 실시간에 뒤지지 않아요. 남은 쟁점은 말 끝에서 첫 소리까지 ${초(은행답지연)}초(실시간 ${초(실시간지연)}초)와 이어 붙인 소리예요.</p>
  <div class="숫자들">
    <div class="숫자"><div class="작게">3판 · 엉뚱한 답 · 다판 200줄</div><div class="큰">${엉률(팔('3판')).toFixed(1)}%</div><div class="설명">Fable · GPT ${둘글(판정4.팔['3판'].전체)} · 판마다 ${팔범위글('3판', 엉률)}%</div></div>
    <div class="숫자"><div class="작게">Gemini Live · 엉뚱한 답 · 같은 200줄</div><div class="큰">${엉률(팔('제미나이')).toFixed(1)}%</div><div class="설명">Fable · GPT ${둘글(판정4.팔.제미나이.전체)} · 판마다 ${팔범위글('제미나이', 엉률)}%</div></div>
    <div class="숫자"><div class="작게">4분 한 판 값</div><div class="큰">${원(한판3)}<small>원</small></div><div class="설명">Gemini Live 유료 어림 약 ${라이브원}원 · 글 생성 ${원(한판글)}원</div></div>
    <div class="숫자"><div class="작게">말 끝 → 첫 소리(은행 답 · 중앙)</div><div class="큰">${초(은행답지연)}<small>초</small></div><div class="설명">실시간 ${초(실시간지연)}초 · 글 생성 ${초(글길지연)}초</div></div>
  </div>
</header>

<section>
  <h2>매 차례 생성과 같은 잣대로</h2>
  <p>은행 쪽만 매겨서는 5%가 어떤 잣대인지 몰랐어요. 같은 200줄에 시제품의 실시간 길(Gemini 3.8 Live, 같은 지시문)과 글 생성 길(받아 적기 → GPT-6.1 Terra → 목소리)의 답을 만들어 3판 답과 A · B · C로 섞어 매겼어요. 검수자는 어느 답이 미리 써 둔 말인지 몰랐어요.</p>
  ${세길점()}
  ${세길점({ 폭: 360, 왼: 78, 좁음: true })}
  <p class="작게">점은 Fable 판정, 옅은 막대는 네 정답 판의 범위예요. 오른쪽이 기준을 넘긴 쪽이에요. 두 검수자의 판정이 같았던 비율은 ${퍼글(판정4.일치.같음, 판정4.일치.둘, 0)}예요.</p>
  <div class="표틀"><table class="수표"><thead><tr><th>엉뚱(Fable · GPT)</th><th>3판</th><th>Gemini Live</th><th>글 생성</th></tr></thead><tbody>
    ${조건줄('전체 200줄', (p) => 판정4.팔[p].전체)}
    ${조건줄(`평범한 답 ${판정4.팔['3판'].평범.페이블.n}줄`, (p) => 판정4.팔[p].평범)}
    ${조건줄(`예외인 말 ${판정4.팔['3판'].예외.페이블.n}줄`, (p) => 판정4.팔[p].예외)}
    ${조건줄(`작별 뒤 ${작별뒤수}줄`, (p) => 판정4.팔[p].순간별.작별뒤)}
    ${조건줄(`받아 적기 심한 오류 ${심함('3판').페이블.n}줄`, 심함)}
    ${조건줄(`작별 뒤를 뺀 ${판정4.조건['작별뒤 뺌']['3판'].페이블.n}줄`, (p) => 판정4.조건['작별뒤 뺌'][p])}
    ${조건줄(`오류 없는 ${판정4.조건['오류 없음']['3판'].페이블.n}줄`, (p) => 판정4.조건['오류 없음'][p])}
    ${조건줄(`오류 없고 작별 뒤도 뺀 ${조건95['3판'].페이블.n}줄`, (p) => 조건95[p])}
  </tbody></table></div>
  <ul class="관찰">
    <li><b>5%는 실시간도 못 넘는 잣대였어요.</b> 지금 시제품 지시문 그대로라면 200줄 전체에서 3판이 가장 낮아요. 평범한 답에서 차이가 가장 커요(3판 ${둘글(판정4.팔['3판'].평범)}, Gemini Live ${둘글(판정4.팔.제미나이.평범)}).</li>
    <li><b>차이의 큰 몫은 작별 되풀이예요.</b> 생성 쪽은 방금 한 작별 문장을 글자 그대로 또 말했어요(작별 뒤 ${작별뒤수}줄 중 Gemini Live ${되풀이(기제)}줄 · 글 생성 ${되풀이(기글)}줄). 지시문이 정해진 문장으로 끝내라고 하기 때문이라, 은행과 상관없이 지시문을 고쳐야 해요.</li>
    <li><b>나머지 큰 몫은 받아 적기 오류예요.</b> 뜻이 사라진 글을 받으면 생성 쪽은 없는 말을 지어내고(「타이완에서 오셨군요」), 은행은 다시 묻거나 안전한 반응으로 받아요. 다만 실제 Live는 글이 아니라 소리를 직접 들으니 이 줄은 Live에 불리한 시험이에요.</li>
    <li><b>둘을 빼면 사실상 비겨요.</b> 오류 없고 작별 뒤도 뺀 ${조건95['3판'].페이블.n}줄에서 Fable은 Live를, GPT는 3판을 더 낫게 봤어요. 줄 수로 몇 줄 차이고, 같은 3판 답을 두 번 매겨도 Fable ${흔들림.페이블}줄 · GPT ${흔들림.GPT}줄이 뒤집혔으니 이 차이는 판정의 흔들림 안에 있어요.</li>
    <li><b>이 시험이 못 본 것.</b> 생성 답은 「‘봄날의 별’을 매일 들어요?」처럼 학습자 말을 구체적으로 되받고, 은행 답은 「와, 그 노래요?」로 두루뭉술해요. 「자연 · 어색」은 어색하지 않은지만 보니 이런 생동감은 잡히지 않아요. 여러 차례 이어질 때의 되풀이와, 매번 같은 말을 듣는 지루함도 못 봤어요.</li>
  </ul>
  <div class="표틀"><table class="수표"><thead><tr><th>세 길</th><th>엉뚱 전체</th><th>맞춘 ${조건95['3판'].페이블.n}줄</th><th>말 끝 → 첫 소리</th><th>4분 한 판</th></tr></thead><tbody>
    <tr><td>Gemini Live</td><td>${둘글(판정4.팔.제미나이.전체)}</td><td>${둘글(조건95.제미나이)}</td><td>${초(실시간지연)}초</td><td>약 ${라이브원}원(유료 어림)</td></tr>
    <tr><td>글 생성 + 목소리</td><td>${둘글(판정4.팔.글.전체)}</td><td>${둘글(조건95.글)}</td><td>${초(글길지연)}초</td><td>${원(한판글)}원</td></tr>
    <tr><td>3판 답 은행</td><td>${둘글(판정4.팔['3판'].전체)}</td><td>${둘글(조건95['3판'])}</td><td>${초(은행답지연)}초</td><td>${원(한판3)}원</td></tr>
  </tbody></table></div>
  <p class="작게">글 생성이 3판보다 싼 까닭은 고르기예요. 반응 목록을 다 보여 주는 고르기 한 번($${(값.차례3).toFixed(4)})이 짧은 답을 새로 만드는 값($${글차례.toFixed(4)})의 다섯 배쯤 돼요. 고르기를 더 작게 나누거나 캐시가 붙으면 줄어들 값이에요.</p>
</section>

<section>
  <h2>2판과 3판, 같은 잣대로</h2>
  <p>${판정글} <b>평범한 답은 두 검수자 모두 엉뚱 ${엉률(삼.평범.페이블).toFixed(1)}% · ${엉률(삼.평범.GPT).toFixed(1)}%로 기준을 넘었어요.</b> 남은 엉뚱은 예외인 말(${엉률(삼.예외.페이블).toFixed(1)} · ${엉률(삼.예외.GPT).toFixed(1)}%)에서 나오고, 그 말을 맡긴 생성 답(${삼.길별.생성.페이블.n}줄, 엉뚱 ${엉률(삼.길별.생성.페이블).toFixed(1)} · ${엉률(삼.길별.생성.GPT).toFixed(1)}%)이 오히려 가장 약했어요.</p>
  <p>두 검수자(Fable · GPT)가 학습자 말마다 2판 답과 3판 답을 X · Y로 섞어 받아, 어느 쪽인지 모른 채 「자연 · 어색」을 따로 매겼어요. <b>다판</b>은 3판 은행을 굳힌 뒤에 만든 새 200줄이에요. 이번에는 두 판 모두 생성으로 넘긴 차례에도 실제 답을 만들어 넣었고, 검수자는 어느 답이 미리 써 둔 답인지도 몰랐어요.</p>
  ${편차점()}
  ${편차점({ 폭: 360, 왼: 72, 좁음: true })}
  <p class="작게">점은 Fable 판정, 옅은 막대는 네 정답 판(Fable · GPT · 둘 다 자연일 때만 · 하나라도 자연이면)의 범위예요. 오른쪽이 기준을 넘긴 쪽이에요. 두 검수자의 판정이 같았던 비율은 ${퍼글(판정.일치.같음, 판정.일치.둘, 0)}예요. 같은 3판 답을 세 프로그램 판에서는 ${둘글(판정4.팔['3판'].전체)}로 매겼고, 두 판의 차이가 판정의 흔들림이에요. 2판 시험의 나판(생성 차례는 「넘길 만했나」로만 셈)에서 2판은 맞게 받음 ${받률({ 자연: 나판(2).맞게받음, n: 나판(2).n }).toFixed(1)}% · 엉뚱 ${엉률({ 어색: 나판(2).엉뚱, n: 나판(2).n }).toFixed(1)}%(Fable)였어요.</p>
</section>

<section>
  <h2>답이 나온 길</h2>
  <p>3판은 고르기가 셋 중 하나로 보내요 — 미리 녹음한 반응을 이어 붙인 <b>은행 답</b>, 다시 말해 달라는 <b>되묻기</b>, 실시간으로 만든 <b>생성 답</b>.</p>
  <div class="표틀"><table class="수표"><thead><tr><th>다판 200줄</th><th>줄</th><th>엉뚱 · Fable</th><th>엉뚱 · GPT</th></tr></thead><tbody>
    ${['은행', '되묻기', '생성'].map((g) => `<tr><td>3판 · ${길이름[g]}</td>${길줄(3, g)}</tr>`).join('\n    ')}
    ${['은행', '되묻기', '생성'].map((g) => `<tr><td class="작게">2판 · ${길이름[g]}</td>${길줄(2, g)}</tr>`).join('\n    ')}
  </tbody></table></div>
  <ul class="관찰">
    <li><b>은행 답이 가장 나아졌어요.</b> 2판 ${길줄수(2, '은행')}줄 엉뚱 ${엉률(이.길별.은행.페이블).toFixed(1)} · ${엉률(이.길별.은행.GPT).toFixed(1)}% → 3판 ${길줄수(3, '은행')}줄 ${엉률(삼.길별.은행.페이블).toFixed(1)} · ${엉률(삼.길별.은행.GPT).toFixed(1)}%. 사인 한 줄을 고치고 말 겹침을 막고, 은행이 못 받는 말을 생성으로 보낸 효과예요.</li>
    <li><b>생성으로 넘긴다고 풀리지 않았어요.</b> 「저 기억나요?」 · 「노래 이름 뭐예요?」처럼 콕 집어 묻는 말을 넘겨도, 생성 답이 고맙다고만 하고 다음 질문으로 가 버린 경우가 많았어요. 넘기는 판단은 맞았고 생성 지시문이 약한 거예요.</li>
    <li><b>되묻기는 두 검수자가 갈렸어요.</b> 받아 적기가 크게 틀린 말에 다시 말해 달라고 한 답을 Fable은 모두 자연으로, GPT는 뜻을 짐작할 수 있었다며 어색으로 본 줄이 있어요.</li>
  </ul>
</section>

<section>
  <h2>세 판을 들어 보세요</h2>
  <p>같은 학습자 소리에 3판 · 2판 · 실시간 답을 붙였고, 셋 다 같은 목소리(Kore)로 녹음해 내용만 비교되게 했어요. 차례 사이는 똑같이 0.45초로 맞췄어요.</p>
  <h3>평범한 판</h3>
  <div class="들기">
    <figure><figcaption>3판 <span>반응 + 안 들은 질문 · 넘길 말은 생성</span></figcaption><audio controls preload="none" src="은행3_A.mp3"></audio></figure>
    <figure><figcaption>2판 <span>반응 + 안 들은 질문</span></figcaption><audio controls preload="none" src="은행2_A.mp3"></audio></figure>
    <figure><figcaption>실시간 <span>Gemini 3.8 Live가 새로 말함</span></figcaption><audio controls preload="none" src="실시간_A.mp3"></audio></figure>
  </div>
  ${대화표('A')}
  <h3>까다로운 판</h3>
  <div class="들기">
    <figure><figcaption>3판</figcaption><audio controls preload="none" src="은행3_B.mp3"></audio></figure>
    <figure><figcaption>2판</figcaption><audio controls preload="none" src="은행2_B.mp3"></audio></figure>
    <figure><figcaption>실시간</figcaption><audio controls preload="none" src="실시간_B.mp3"></audio></figure>
  </div>
  ${대화표('B')}
</section>

<section>
  <h2>3판이 아직 약한 곳</h2>
  <p class="작게">다판 · Fable 정답 기준. 막대는 맞게 받은 비율, 오른쪽 회색 숫자는 엉뚱한 답 비율이에요.</p>
  <div class="막대표">
    <div class="막대줄 막대머리"><div></div><div></div><div class="막대값">맞게</div><div class="막대값">엉뚱</div></div>
    ${막대줄('평범한 답', 삼.평범.페이블, true)}
    ${막대줄('예외인 말', 삼.예외.페이블)}
    ${막대줄('받아 적기 오류 없음', 삼.오류별.없음.페이블)}
    ${막대줄('받아 적기 가벼운 오류', 삼.오류별.가벼움.페이블)}
    ${막대줄('받아 적기 심한 오류', 삼.오류별.심함.페이블)}
    ${Object.entries(삼.순간별).filter(([, c]) => c.페이블.n).map(([s, c]) => 막대줄(`순간: ${순간이름[s]}`, c.페이블)).join('\n    ')}
  </div>
  <p class="작게">같은 다판에서 2판은 평범한 답 ${받률(이.평범.페이블).toFixed(1)}% · 예외 ${받률(이.예외.페이블).toFixed(1)}%였어요.</p>
  <h3>엉뚱은 어디서 났나</h3>
  <ul class="관찰">
    <li><b>생성 답이 질문 · 장난을 안 받음.</b> 받아 적기까지 멀쩡한데도 「노래 이름 뭐예요?」에 노래 얘기로 넘어가고, 「통장 0원 됐어요, 책임지세요!」 같은 장난을 받지 않았어요.</li>
    <li><b>지나가며 말한 것을 놓침.</b> 「제 친구도 팬이에요! 몽골에 팬 많아요」 뒤에 어느 나라에서 왔냐고 묻고, 「시간이 없어요, 안녕히 계세요」에 노래를 물었어요. 고르기가 「들은 것」에 넣지 못했거나 작별로 건너뛰지 못한 경우예요.</li>
    <li><b>은행 줄의 흠.</b> 「그 약속 말고요」(학습자가 말하지 않은 것을 부정), 혼자 도는 「아, 그렇구나!」, 「「사인해 주세요」 하고 말해 봐요!」(상황극에서 따라 말하라고 시킴), 겹침 목록에 없던 「괜찮아요 … 괜찮아요」. 맞장구를 둘째 자리에서 뺀 탓에 사연이 안 받아진 줄도 있어요.</li>
    <li><b>받아 적기가 크게 틀린 말.</b> 「에어컨 타이완입니다 사이 여기에 저요」처럼 뜻이 사라진 말이에요. 몽골 학습자의 실제 받아 적기가 어떤지는 실제 기록으로만 알 수 있어요.</li>
  </ul>
  <h3>3판 답을 어색하다고 본 줄 ${엉뚱3.length}개(둘 다 어색 ${둘다.length})</h3>
  <ol class="엉뚱들">${엉목록}</ol>
</section>

<section>
  <h2>속도 — 말 끝에서 첫 소리까지</h2>
  <p>학습자 소리 14개를 실제 속도로 흘려 보내며, 마지막 소리를 보낸 때부터 하나씩 쟀어요. 2판까지 적은 「받아 적기 1.5초」는 두 가지가 틀렸어요 — 크레딧이 바닥난 앞 키를 두드리는 헛걸음이 들어 있었고(성공한 요청만 재면 ${초(속도.통째.중앙ms)}초), 말이 끝났는지 알아채는 시간은 빠져 있었어요. 실시간판의 ${초(실시간지연)}초에는 그 시간이 들어 있어서, 이번에 같은 출발점으로 맞췄어요.</p>
  ${속도막대()}
  ${속도막대({ 폭: 360, 왼: 14, 좁음: true })}
  <div class="범례">${범례}</div>
  <p class="작게">점선은 실시간판의 첫 소리(${초(실시간지연)}초). 단계마다 중앙값을 더한 어림이에요. 고르기 위 10%는 ${초(고르기ms3위)}초예요.</p>
  <ul class="관찰">
    <li><b>흘려 받아도 빨라지지 않았어요.</b> 말 끝을 알아채는 데 ${초(조각.알아챔)}초, 글이 마무리되는 데 ${초(조각.받아적기)}초가 들어요. 앱에서 침묵 0.5초로 말 끝을 잡고 파일을 올려도(${초(속도.통째.중앙ms)}초) 어림으로 1.2초대라 거의 같아요. 2판 때 「끝난 뒤 0.3초 안팎」이라 적은 기대는 말 끝 알아채기를 빠뜨린 값이었어요.</li>
    <li><b>남은 큰 덩어리는 답 고르기(${초(조각.고르기)}초)예요.</b> 고르기를 흘려 받으면 첫 반응을 ${초(조각.첫반응)}초에 알 수 있어요(다판 40줄, 위 10% ${초(속도.고르기흘려.첫반응위10ms)}초). 그때부터 녹음을 틀면 은행 답이 ${초(첫반응지연)}초로 줄어요. 첫 반응 뒤 둘째 반응 · 질문을 고르는 순서만 맞추면 되는 일이라 값이 늘지 않아요.</li>
    <li><b>생성 답은 ${초(조각.생성 + 조각.목소리)}초가 더 들어요</b>(첫 문장 ${초(조각.생성)}초 + 목소리 첫 소리 ${초(조각.목소리)}초, 흘려 받기로 첫 문장부터 읽기 시작한다고 쳤어요).</li>
    <li><b>침묵만 보면 더 빠르지만 말을 끊어요.</b> 침묵 0.3초 기준은 글 마무리가 ${초(침묵300.완료중앙ms)}초로 가장 빨랐지만 14개 중 ${침묵300.갈린말}개를 머뭇거림(「저는… 볼로르예요」)에서 둘 이상으로 갈랐고, 0.5초 기준은 ${침묵500.갈린말}개, 의미 VAD는 ${고른흘려.갈린말}개였어요. 앱이 첫 조각에 바로 답하면 학습자 말을 끊게 돼요 — 초보일수록 말 끝 판단을 넉넉히 둬야 해서 이 시간은 더 줄이기 어려워요.</li>
    <li><b>맞장구 먼저 틀기(설계).</b> 말 끝을 알아챈 순간 미리 녹음한 짧은 소리(「아~」 · 「오~」)를 바로 틀고 고른 답을 이어 틀면, 첫 소리는 ${초(조각.알아챔)}초로 실시간과 비슷해져요. 매번 같은 소리가 반복되면 티가 나니 몇 가지를 돌려 써야 하고, 아직 들어 보며 시험하지 않았어요.</li>
  </ul>
  <div class="표틀"><table class="수표"><thead><tr><th>받아쓰기 모델</th><th>말 끝 알아채기</th><th>알아챔(중앙)</th><th>글 마무리(중앙)</th><th>위 10%</th><th>갈린 말</th></tr></thead><tbody>${흘려표}
    <tr><td>gpt-transcribe(파일 통째)</td><td>—</td><td>—</td><td>${초(속도.통째.중앙ms)}초</td><td>${초(속도.통째.위10ms)}초</td><td>—</td></tr>
  </tbody></table></div>
  <p class="작게">「바로 커밋」은 앱이 말 끝을 정확히 안다고 친 아래 한계예요. 파일 통째 줄은 올리고 받는 시간만이라, 실제로는 말 끝 알아채기 시간을 더해야 해요.</p>
</section>

<section>
  <h2>값</h2>
  <div class="표틀"><table class="값표"><thead><tr><th>4분 한 판(학습자 8차례)</th><th>값</th><th>셈</th></tr></thead><tbody>
    <tr><td>실시간 GPT-Live</td><td>${원(값.실시간)}원</td><td class="작게">분당 $0.05(시제품 실측) + 돌아보기 $0.003</td></tr>
    <tr><td>Gemini Live(유료 어림)</td><td>약 ${라이브원}원</td><td class="작게">조사 기준 3분 약 $0.08 · 10분 약 $0.6. 턴마다 앞 대화를 다시 세어 길수록 비싸요. 지금 시험은 무료 몫이에요</td></tr>
    <tr><td>글 생성 + 목소리</td><td>${원(한판글)}원</td><td class="작게">차례마다 글 생성 $${글차례.toFixed(4)}(다판 실측) + 목소리 + 파일 받아 적기 8번 + 돌아보기</td></tr>
    <tr><td>답 은행 3판</td><td>${원(한판3)}원</td><td class="작게">차례마다 고르기 · 생성 평균 $${값.차례3.toFixed(4)}(다판 200줄 실측, 생성 ${생성률3.toFixed(1)}% 포함) + 생성 답 목소리 + 파일 받아 적기 8번 + 돌아보기</td></tr>
    <tr><td>답 은행 2판</td><td>${원(한판2)}원</td><td class="작게">차례마다 $${값.차례2.toFixed(4)}(다판 실측, 생성 ${생성률2.toFixed(1)}%) + 파일 받아 적기 8번 + 돌아보기</td></tr>
  </tbody></table></div>
  <p class="작게">1달러 1,400원(BM 문서의 계산용 환율). 목소리 읽기는 분당 약 $0.015로 어림했어요. 흘려 받아 적기를 4분 내내 쓰면 $${값.흘려받아적기.toFixed(3)}(약 ${원(값.흘려받아적기 - 값.통째받아적기)}원)가 더 들어요 — 더 빠르지 않아 셈에서 뺐어요.</p>
</section>

<section>
  <h2>다음에 볼 곳</h2>
  <ul class="관찰">
    <li><b>이어 붙인 소리.</b> 위의 3판 소리는 Kore가 대본을 한 번에 읽은 판이에요. 미리 구운 조각을 실제로 이어 붙이면 어떻게 들리는지가 남은 가장 큰 미지수예요.</li>
    <li><b>속도.</b> 고르기 흘려 받기와 맞장구 먼저 틀기를 붙여, 실제 기다림까지 넣어 귀로 들어 봐요.</li>
    <li><b>실제 학습자 소리.</b> 이번 입력은 받아 적은 글이에요. Live가 몽골 학습자 소리를 어떻게 듣는지, 받아 적기가 얼마나 틀리는지는 동의 받은 녹음으로만 알 수 있어요.</li>
    <li><b>시제품 지시문.</b> 은행을 쓰든 안 쓰든 작별 되풀이는 고쳐야 해요. 고친 뒤 같은 25줄로 다시 재요.</li>
    <li><b>은행 줄 · 생성 지시문(4판).</b> 묻는 말부터 답하기, 지나가며 말한 것 듣기, 흠 있는 줄 고치기.</li>
  </ul>
</section>

<section>
  <h2>어떻게 쟀나</h2>
  <ul class="관찰">
    <li>은행 3판(반응 ${반응들3.length} · 녹음 줄 ${녹음줄수3()})은 다판을 만들기 전에 확정했어요(파일 지문을 README에 남김). 2판 시험에서 본 흠 — 사인 순간 「부탁한 것도 같이 써 줄게요」, 말 겹침, 맞장구 둘째 자리 — 을 고쳤어요.</li>
    <li>다판 200줄은 은행을 보지 않은 Gemini 3.8 Flash가 가판 · 나판과 같은 지시로 만들었어요(받아 적기 오류 없음 · 가벼움 · 심함 = 109 · 60 · 31줄). 앞 두 판과 글자까지 같은 줄은 「네!」 같은 짧은 말 6줄이에요.</li>
    <li>고르기는 받아 적은 글만 봤어요(2판 · 3판 모두 GPT-6.1 Terra, 생각 끔). 생성 답도 같은 모델이 시제품 지시문으로 만들고, 끝에는 은행과 같은 규칙의 다음 질문을 붙였어요. 판정은 Fable(세 조)과 GPT가 같은 기준으로 블라인드로 매겼어요.</li>
    <li>기준선은 줄마다 세션을 새로 열고, 그 순간까지의 모범 대화(장면 예문 + 앞말)를 넣은 뒤 받아 적은 말을 글로 넣었어요. 지시문 · 설정은 시제품과 같지만 소리는 쓰지 않아 실제 Live가 듣는 길과는 달라요. A · B · C 순서는 글자마다 세 프로그램이 같은 수로 오게 줄마다 바꿨어요. GPT 판정 200줄 가운데 끝 · 작별 뒤 32줄은 API 크레딧이 바닥나 같은 모델의 구독 통로로 묶어 매겼어요.</li>
    <li>한계: 학습자 말과 받아 적기 오류는 지어낸 것이라 실제 몽골 학습자에게서는 더 나쁘게 나올 수 있어요. 한 차례씩 매겼고, 대화 흐름은 들어 보기 두 판으로만 봤어요. 속도는 학습자 소리 14개로 잰 작은 표본이에요.</li>
  </ul>
  <p class="작게">자료와 스크립트: 저장소 experiences/realtime-roleplay/qa/답은행시험-20261101/</p>
</section>
</main>
`;

const 폴더 = path.join(작업, '페이지');
fs.mkdirSync(폴더, { recursive: true });
const { 심기 } = require(path.join(저장소, 'tools/lib/브랜드폰트.js'));
const 심음 = 심기(html);
fs.writeFileSync(path.join(폴더, 'index.html'), 심음.html);
for (const f of ['은행3_A.mp3', '은행3_B.mp3', '은행2_A.mp3', '은행2_B.mp3', '실시간_A.mp3', '실시간_B.mp3']) fs.copyFileSync(path.join(작업, '엮음', f), path.join(폴더, f));
for (const f of ['은행_A.mp3', '은행_B.mp3']) fs.rmSync(path.join(폴더, f), { force: true }); // 1판 소리는 이번 페이지에 안 싣는다
console.log(`페이지 → ${path.join(폴더, 'index.html')} (${Math.round(심음.html.length / 1024)}KB)`);
