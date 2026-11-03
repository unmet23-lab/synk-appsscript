#!/usr/bin/env node
// 점수 길 카드 맹검(README 「시험 ②」)의 시안 — 가상 학습자 셋 × 두 판(R 영역 판 · S 점수 길 판).
// 두 판은 머리(예상 범위 · 근거 수 · 날짜)와 겉이 같고, 아래 묶음만 다르다. WORLD 시그널(world-ui.css)의 밤 판 · 코랄 하나 · 흰 알약 하나,
// 그래프는 그래프 문법(빗금 막대 · 범위는 점 둘과 선). 숫자는 모두 지어낸 가상 학습자다.
//   node 카드.mjs [--out <폴더>]   → <폴더>/<P>-<R|S>.html(서체 심음) · 같은 이름 .png(Edge 머리 없는 창, 390px · 2배)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const 폰트 = require(path.resolve(here, '../../../../tools/lib/브랜드폰트.js'));
const args = process.argv.slice(2);
const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(here, '결과', '카드'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// 가상 학습자 — 영역 점수의 합은 범위의 가운데와 맞춘다(P1 52+56+27 = 135 · P2 38+66+20 = 124).
export const LEARNERS = {
  P1: {
    range: [128, 142], evidence: '처음 본 문제 40개 · 쓰기 3편', date: '11월 3일',
    headline: '4급까지 8~22점', sub: '지금은 3급 쪽이에요',
    areas: [['듣기', 52], ['읽기', 56], ['쓰기', 27]], weakest: '쓰기', strength: '읽기', rCta: '쓰기 연습하기',
    gains: [
      ['쓰기 53번 · 자료 설명', '숫자는 맞는데 「-ㄴ다」 끝맺음과 견주는 말이 흔들려요', 6, 8],
      ['읽기 13~15번 · 순서 배열', '처음 본 3문제 가운데 1개', 2, 4],
      ['듣기 25~30번 · 인터뷰 세부', '처음 본 6문제 가운데 3개', 2, 4],
    ],
    solid: [['듣기 1~12번 · 짧은 대화', '혼자 11/12'], ['읽기 5~12번 · 광고 · 안내 · 도표', '혼자 7/8']], sCta: '53번 연습하기',
  },
  P2: {
    range: [116, 132], evidence: '처음 본 문제 34개 · 쓰기 3편', date: '11월 3일',
    headline: '4급까지 18~34점', sub: '3급 경계예요 — 120점이 3급이에요',
    areas: [['듣기', 38], ['읽기', 66], ['쓰기', 20]], weakest: '쓰기', strength: '읽기', rCta: '쓰기 연습하기',
    gains: [
      ['쓰기 54번 · 주장하는 글', '아직 한 번도 안 썼어요 — 비우면 50점이 통째로 비어요', 5, 10],
      ['듣기 25~34번 · 인터뷰 · 토론', '처음 본 8문제 가운데 2개', 4, 6],
      ['쓰기 53번 · 자료 설명', '숫자는 맞는데 끝맺음이 「-아요」예요', 3, 5],
    ],
    solid: [['읽기 1~12번 · 문법 · 광고 · 도표', '혼자 11/12'], ['쓰기 51 · 52번 · 빈칸', '4칸 모두 문맥에 맞아요']], sCta: '54번 처음 써 보기',
  },
  P3: {
    range: null, evidence: '처음 본 문제 12개 · 쓰기 0편', date: '11월 3일', need: 30, have: 12,
    headline: '아직 판단하기 일러요', sub: '처음 본 문제 30개가 모이면 범위를 보여 드려요',
    areas: [['듣기', null, '5문제 가운데 4개'], ['읽기', null, '7문제 가운데 3개'], ['쓰기', null, '아직 없음']], weakest: null, strength: null, rCta: '모의 시험 보기 · 20분',
    gains: [
      ['듣기 4~8번 · 알맞은 대답', '처음 본 3문제 모두 혼자 — 강점일 수 있어요', null, null, '강점 후보'],
      ['읽기 13~15번 · 순서 배열', '처음 본 2문제 가운데 0개 — 다시 확인해 볼 곳', null, null, '다시 확인'],
    ],
    next: '시험 주간 모의 한 번(20분, 18문제)이면 범위가 열려요', solid: [], sCta: '모의 시험 보기 · 20분',
  },
};

// 2차(1차 시험관이 짚은 믿음 문제를 고친 판). 머리(범위 · 근거 줄 · 아래 말)는 R2 · S2가 같고, R2는 1차 R에서 머리 아래 말과 줄바꿈만 바뀐다.
// S2에서 고친 것: 딸 점수의 합과 남은 점수 · 맞힌 수를 「맞힘」으로 · 적은 근거로 강점 · 약점을 정하지 않음 · 쓰기가 없으면 범위를 열지 않음 ·
// 어려운 말(견주는 말 · 끝맺음 · 통째로 · 시험 주간) · 겁주는 말(통째로 비어요 · 경계예요) · 단추처럼 보이던 꼬리표 · 막대의 뜻 · 단추에 걸리는 시간.
export const LEARNERS2 = {
  P1: { ...LEARNERS.P1,
    gainNote: '셋을 다 하면 +10~16점 · 막대는 더 딸 수 있는 점수',
    remainder: '4급까지 8~22점 가운데 10~16점이에요. 모자라면 이 셋을 마친 뒤 다시 골라 드려요.',
    gains: [
      ['쓰기 53번 · 자료 설명', '숫자는 맞아요. 문장 끝(「-ㄴ다」)과 비교하는 말(「-에 비해」)만 고치면 돼요 · 쓴 글 2편', 6, 8],
      ['읽기 13~15번 · 순서 배열', '처음 본 3문제 중 1개 맞힘', 2, 4],
      ['듣기 25~30번 · 인터뷰 세부', '처음 본 6문제 중 3개 맞힘', 2, 4],
    ],
    solid: [['듣기 1~12번 · 짧은 대화', '처음 본 12문제 중 11개'], ['읽기 5~12번 · 광고 · 안내 · 도표', '처음 본 8문제 중 7개']], sCta: '53번 한 편 쓰기 · 약 15분' },
  P2: { ...LEARNERS.P2, sub: '3급(120점) 가까이 왔어요',
    gainNote: '셋을 다 하면 +12~21점 · 막대는 더 딸 수 있는 점수',
    remainder: '4급까지 18~34점 가운데 12~21점이에요. 남은 점수는 이 셋을 마친 뒤 다시 골라 드려요.',
    gains: [
      ['쓰기 54번 · 주장하는 글', '50점짜리 문제예요. 서론과 결론만 써도 점수가 생겨요 · 쓴 글 없음', 5, 10],
      ['듣기 25~34번 · 인터뷰 · 토론', '처음 본 8문제 중 2개 맞힘', 4, 6],
      ['쓰기 53번 · 자료 설명', '숫자는 맞아요. 문장 끝을 「-아요」에서 「-ㄴ다」로 · 쓴 글 1편', 3, 5],
    ],
    solid: [['읽기 1~12번 · 문법 · 광고 · 도표', '처음 본 12문제 중 11개'], ['쓰기 51 · 52번 · 빈칸', '4칸 모두 문맥에 맞음']], sCta: '54번 서론부터 쓰기 · 약 15분' },
  P3: { ...LEARNERS.P3, sub: '처음 본 문제 30개와 쓰기 한 편이 모이면 범위를 보여 드려요',
    gainNote: '아직 적어서 강점 · 약점으로 정하지 않았어요',
    gains: [
      ['듣기 4~8번 · 알맞은 대답', '처음 본 3문제 모두 맞힘', null, null, null],
      ['읽기 13~15번 · 순서 배열', '처음 본 2문제 중 0개 맞힘', null, null, null],
    ],
    next: '20분 모의 시험(18문제)과 쓰기 한 편이면 범위가 열려요', sCta: '20분 모의 시험 보기' },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hatch = (id, color) => `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="${color}" stroke-width="1.2"/></pattern>`;
const GRAY = 'rgba(250,250,249,.42)', CORAL = '#F96859', LINE = 'rgba(255,255,255,.14)';

function bar(value, max, strong, w = 176, h = 14) {
  const len = Math.max(2, Math.round((value / max) * w));
  const id = `h${Math.random().toString(36).slice(2, 8)}`;
  const color = strong ? CORAL : GRAY;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs>${hatch(id, color)}</defs>`
    + `<rect x="0" y="0" width="${len}" height="${h}" fill="url(#${id})"/><line x1="${len}" y1="0" x2="${len}" y2="${h}" stroke="${color}" stroke-width="2"/>`
    + `<line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="${LINE}" stroke-width="1"/></svg>`;
}
function gainBar(lo, hi, strong) {
  const w = 120, h = 12, max = 12, x0 = Math.round((lo / max) * w), x1 = Math.round((hi / max) * w);
  const id = `g${Math.random().toString(36).slice(2, 8)}`, color = strong ? CORAL : GRAY;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs>${hatch(id, color)}</defs>`
    + `<rect x="0" y="0" width="${x1}" height="${h}" fill="url(#${id})" opacity=".55"/><rect x="0" y="0" width="${x0}" height="${h}" fill="url(#${id})"/>`
    + `<line x1="${x1}" y1="0" x2="${x1}" y2="${h}" stroke="${color}" stroke-width="2"/><line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="${LINE}"/></svg>`;
}
function rangeStrip(p) {
  const W = 310, H = 70, lo = 100, hi = 200, x = (v) => Math.round(((v - lo) / (hi - lo)) * (W - 20)) + 10;
  const cuts = [[120, '3급 120'], [150, '4급 150'], [190, '5급 190']];
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="예상 범위">`;
  svg += `<line x1="10" y1="34" x2="${W - 10}" y2="34" stroke="${LINE}" stroke-width="1"/>`;
  for (const [v, label] of cuts) svg += `<line x1="${x(v)}" y1="18" x2="${x(v)}" y2="50" stroke="rgba(250,250,249,.32)" stroke-dasharray="3 3"/><text x="${x(v)}" y="66" fill="rgba(250,250,249,.58)" font-size="12" text-anchor="middle">${label}</text>`;
  if (p.range) {
    const [a, b] = p.range;
    svg += `<line x1="${x(a)}" y1="34" x2="${x(b)}" y2="34" stroke="${CORAL}" stroke-width="4"/><circle cx="${x(a)}" cy="34" r="5" fill="${CORAL}"/><circle cx="${x(b)}" cy="34" r="5" fill="${CORAL}"/>`;
    svg += `<text x="${(x(a) + x(b)) / 2}" y="12" fill="#FFB4A9" font-size="13" font-weight="600" text-anchor="middle">${a}~${b}점</text>`;
  } else {
    svg += `<text x="${W / 2}" y="12" fill="rgba(250,250,249,.58)" font-size="13" text-anchor="middle">범위 없음 · 근거 ${p.have}/${p.need}</text>`;
  }
  return svg + '</svg>';
}

function head(p) {
  return `<p class="label">내 위치 · TOPIK II</p>
  <h1>${esc(p.headline)}</h1><p class="sub">${esc(p.sub)}</p>
  <div class="strip">${rangeStrip(p)}</div>
  <p class="ev">근거 · ${esc(p.evidence)} · ${esc(p.date)}</p>`;
}
const foot = '<p class="note">공식 시험 결과가 아니라 연습에서 본 추정이에요. 근거가 늘면 범위가 좁아져요.</p>';

function cardR(p) {
  const rows = p.areas.map(([name, score, text]) => `<div class="row"><span class="nm">${name}</span>`
    + (score == null ? `<span class="tx">${esc(text)}</span>` : `${bar(score, 100, name === p.weakest)}<span class="v">${score}<small>/100</small></span>`) + '</div>').join('');
  const verdict = p.weakest
    ? `<div class="kv"><span>가장 부족한 영역</span><b class="hot">${p.weakest}</b></div><div class="kv"><span>장점</span><b>${p.strength}</b></div>`
    : '<div class="kv"><span>가장 부족한 영역</span><b class="dim">아직 몰라요</b></div><div class="kv"><span>장점</span><b class="dim">아직 몰라요</b></div>';
  return `${head(p)}<section><p class="label">영역별</p>${rows}</section><section class="verdict">${verdict}</section>${foot}<button>${esc(p.rCta)}</button>`;
}
function cardS(p) {
  const title = p.range ? '4급까지 점수를 딸 곳' : '지금까지 본 것';
  const rows = p.gains.map(([name, why, lo, hi, tag], i) => `<div class="gain"><span class="no">${String(i + 1).padStart(2, '0')}</span><div class="gb">`
    + `<p class="gt">${esc(name)}</p><p class="gw">${esc(why)}</p></div>`
    + (lo == null ? (tag ? `<span class="tag">${esc(tag)}</span>` : '') : `<div class="gv">${gainBar(lo, hi, i === 0)}<span>+${lo}~${hi}점</span></div>`) + '</div>').join('');
  const solid = p.solid.length ? `<section><p class="label">이미 혼자 하는 것</p>${p.solid.map(([n, t]) => `<div class="kv"><span>${esc(n)}</span><b>${esc(t)}</b></div>`).join('')}</section>` : '';
  const next = p.next ? `<p class="next">${esc(p.next)}</p>` : '';
  const note = p.gainNote ? `<p class="cap">${esc(p.gainNote)}</p>` : '';
  const remainder = p.remainder ? `<p class="next">${esc(p.remainder)}</p>` : '';
  return `${head(p)}<section><p class="label">${title}</p>${note}${rows}${remainder}${next}</section>${solid}${foot}<button>${esc(p.sCta)}</button>`;
}

const CSS = `*{box-sizing:border-box}html,body{margin:0;background:#060709}
body{font-family:'SUIT Variable',system-ui,sans-serif;color:#FAFAF9;-webkit-font-smoothing:antialiased;padding:20px}
.card{width:350px;background:#0C0D10;border-radius:22px;box-shadow:inset 0 1px 0 rgba(255,255,255,.055),inset 0 0 0 1px rgba(255,255,255,.075);padding:24px 20px 22px}
.label{font-size:13px;font-weight:550;letter-spacing:.04em;color:rgba(250,250,249,.58);margin:0 0 10px}
h1{font-size:30px;font-weight:680;letter-spacing:-.042em;line-height:1.15;margin:0}
.sub{font-size:15.5px;color:rgba(250,250,249,.76);margin:6px 0 18px;line-height:1.45}
.strip{margin:0}.ev{font-size:13px;color:rgba(250,250,249,.58);margin:6px 0 0}
section{border-top:1px solid rgba(255,255,255,.075);margin-top:18px;padding-top:16px}
.row{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;margin:10px 0}
.nm{font-size:15.5px;font-weight:600}.v{font-size:15.5px;font-weight:600;text-align:right;min-width:58px}.v small{font-size:13px;color:rgba(250,250,249,.58);font-weight:450}
.tx{grid-column:2 / 4;font-size:14px;color:rgba(250,250,249,.58)}
.kv{display:flex;justify-content:space-between;gap:12px;font-size:15.5px;margin:8px 0;line-height:1.4}.kv span{color:rgba(250,250,249,.76)}.kv b{font-weight:600;text-align:right}
.hot{color:#FFB4A9}.dim{color:rgba(250,250,249,.58)}
.gain{display:grid;grid-template-columns:22px 1fr;gap:4px 10px;margin:12px 0 14px}.no{font-size:13px;color:rgba(250,250,249,.42);padding-top:3px}
.gt{font-size:17px;font-weight:650;letter-spacing:-.024em;margin:0}.gw{font-size:14px;color:rgba(250,250,249,.68);margin:3px 0 0;line-height:1.45}
.gv{grid-column:2;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600}.gain:first-of-type .gv span{color:#FFB4A9}
.tag{grid-column:2;font-size:13px;color:rgba(250,250,249,.58);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 10px;justify-self:start}
.next{font-size:14px;color:rgba(250,250,249,.76);margin:4px 0 0}
.note{font-size:13px;color:rgba(250,250,249,.5);line-height:1.5;margin:18px 0 14px}
button{width:100%;height:48px;border:0;border-radius:999px;background:#FAFAF9;color:#08090C;font:inherit;font-size:16px;font-weight:650}`;

// 2차는 한국어 줄바꿈을 낱말 단위로(1차 시험관 둘이 「흔들/려요」 · 「늘/면」을 짚었다) · 판정 꼬리말 한 줄.
const CSS2 = `${CSS}\nbody{word-break:keep-all;overflow-wrap:anywhere}.cap{font-size:13px;color:rgba(250,250,249,.58);margin:-4px 0 6px;line-height:1.45}`;
const page = (inner, css = CSS) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=390">${폰트.블록()}<style>${css}</style></head><body><div class="card">${inner}</div></body></html>`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.mkdirSync(outDir, { recursive: true });
  // Edge 머리 없는 창의 임시 프로필은 저장소 밖에 둔다(결과 폴더에 두면 무시 규칙에 안 걸려 커밋 후보로 올라온다).
  const profile = path.join(os.tmpdir(), 'score-path-edge');
  // --판 2 → P?-R2 · P?-S2(2차). 없으면 1차 그대로.
  const round2 = args.includes('--판') && args[args.indexOf('--판') + 1] === '2';
  const people = round2 ? LEARNERS2 : LEARNERS, suffix = round2 ? '2' : '', css = round2 ? CSS2 : CSS;
  for (const [key, p] of Object.entries(people)) for (const [kind, make] of [['R', cardR], ['S', cardS]]) {
    const file = path.join(outDir, `${key}-${kind}${suffix}.html`);
    fs.writeFileSync(file, page(make(p), css));
    const png = file.replace(/\.html$/, '.png');
    execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, '--force-device-scale-factor=2',
      '--window-size=390,1100', `--screenshot=${png}`, pathToFileURL(file).href], { stdio: 'ignore', timeout: 60000 });
    // 아래 빈 바탕을 잘라 낸다(카드 둘레 20px만 남김, 2배 그림이라 40px).
    execFileSync('python', ['-c', 'import sys;from PIL import Image,ImageChops\nim=Image.open(sys.argv[1]).convert("RGB")\n'
      + 'box=ImageChops.difference(im,Image.new("RGB",im.size,(6,7,9))).getbbox()\n'
      + 'im.crop((0,0,im.width,min(im.height,box[3]+40))).save(sys.argv[1])', png], { stdio: 'ignore' });
    console.log(png);
  }
}
