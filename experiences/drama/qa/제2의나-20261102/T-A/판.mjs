#!/usr/bin/env node
/**
 * 제2의 나 · 시험 T-A 「첫 3분」 화면 판 5장과 눈가림 시험관 폴더 (2026-11-02).
 * 설계: docs/제2의나_설계_20261102.md §3(첫 3분) · §2(이름 · 나라 질문) · §4(학생증 = 10% 첫 장) · §8 T-A.
 *
 *   ① 첫 화면 — /world 입구 11-02 시안의 움직이는 K팝 첫 화면을 멈춘 한 장(기본 A 글자 서울 콘서트, `--입구 B`면 B 펠트 안녕 콘서트)
 *   ② 착륙 → 공항 → 정문 몽타주의 마지막 장 + 코치 한 줄(듣기)
 *   ③ 정문, 창업 동아리 선배가 이름 · 나라를 묻는다(한국어 대사 + 작은 영어 자막, 말하기 · 글자로 · 나중에 말할래요)
 *   ④ 학생증 발급 — 사진에 나올 모습 고르기(사진 칸은 빈 실루엣, 이름 바트에르덴 · 몽골 · 학번 2026 · 국제학부)
 *   ⑤ 1화 장면 1(교수님 연구실)로 넘어가는 화면 + 동아리 단톡방이 처음으로 내 이름을 부른다
 *
 * 그림은 새로 굽지 않는다 — 공용 작업본 .tmp의 승인 실사(10-30 두 재질 시안의 실사 판: campus-real · s-gate-real · office-real)를
 * 학생(비니 · 등)이 보이지 않게 잘라 1인칭으로 쓴다(설계 §1 90/10). 승인 그림 속 인물은 태오 · 문 교수뿐이라 ③의 「창업 동아리 선배」
 * 자리는 정문 칸의 태오 사진을 대신 쓴다(실제 1화 정문 인물은 설계 §10 열린 것 — README).
 * 화면 결: 사진 + 검정 띠 + 알약 단추 둘의 가입 화면 꼴을 피해 사진을 화면 끝까지 깔고, 말하기는 둥근 마이크 · 사진 찍기는 셔터로 둔다.
 * 「AI 생성」 표기 · 도구 이름 · 마스코트 · 「시범판」 같은 미완성 글 없음.
 *
 *   node experiences/drama/qa/제2의나-20261102/T-A/판.mjs [--입구 A|B] [--도착 착륙|정문]
 *   → <밖>/판/판_01~05.png (390×844 @2x) + html/ · 무대/,  <밖>/시험관/<이름>/판_01~05.png · 질문.md (답.md가 든 폴더는 덮지 않고 멈춘다)
 *   <밖> = 공용 작업본 .tmp/me2-20261102/T-A (ME2_TA_OUT로 바꿈)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const { 블록: 폰트블록 } = require(path.join(뿌리, 'tools', 'lib', '브랜드폰트.js'));
const 공용 = 공용작업본(뿌리);
export const 밖 = process.env.ME2_TA_OUT || path.join(공용, '.tmp', 'me2-20261102', 'T-A');

const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i > 0 ? String(process.argv[i + 1]) : 기본; };
const 입구 = 인자('--입구', 'A').toUpperCase();
// ②의 사진: 기본은 착륙(11-01 /world 입구 실사 시안의 비행기 창 — 사람이 없다). `--도착 정문`이면 승인 실사 campus-real에서 학생을 뺀 판인데,
// 태오가 화면 한가운데라 「여기서 당신은 …」 아래에서 「내가 이 남학생」으로 읽혀 ⑤ · ⑥ 물음(애착 · 누구를 위한 앱)을 흐린다(README).
const 도착 = 인자('--도착', '착륙');
// 원천(공용 작업본 기준). 자르는 칸은 [왼, 위, 오른, 아래] — 학생의 비니 · 등 · 손이 들어오지 않는 자리(눈으로 확인한 값).
export const 원천 = {
  입구: { A: '.tmp/world-entrance-20261102/시안/화면/c5-t7.5.png', B: '.tmp/world-entrance-20261102/시안/화면/f5-t3.0.png' },
  도착: {
    착륙: { 파일: '.tmp/world-entrance-20261101/시안/판/landing_164917.png', 칸: [85, 0, 857, 1672], 단계: 0 },
    정문: { 파일: '.tmp/drama-art-20261030/받음/campus-real.png', 칸: [672, 0, 1280, 1316], 단계: 2 },
  },
  정문대화: { 파일: '.tmp/drama-art-20261030/받음/s-gate-real.png', 칸: [0, 0, 920, 1150] },
  학생증배경: { 파일: '.tmp/drama-art-20261030/받음/campus-real.png', 칸: [640, 0, 1280, 760], 흐림: 22 },
  연구실: { 파일: '.tmp/drama-art-20261030/받음/office-real.png', 칸: [300, 0, 1080, 1200] },
  // v2 — 판_03 정문 동아리 부스(그림.mjs로 구운 판, 선배 둘 · 허리 위 · 1인칭), 학생증 얼굴 조각 넷(T-C 학생증 판, 첫째 = 몽골 남 · 학생증 사진)
  부스: { 파일: '.tmp/me2-20261102/T-A/그림/판/booth_054719.png', 칸: [0, 0, 1122, 1402] },
  얼굴: ['mn-m-id_041820.png', 'mn-f-id2_042038.png', 'vn-f-id_041820.png', 'uz-m-id_041820.png'].map((f) => ({ 파일: `.tmp/me2-20261102/T-C/판/${f}`, 칸: [0, 0, 1086, 1448], 폭: 260 })),
};

// 화면 글 — 대사는 TOPIK 2~3급이 알아듣는 대학생 말(설계 §2 「이름이 뭐예요?」 · 「어디서 왔어요?」).
export const 글 = {
  이름: '바트에르덴', 로마: 'BAT-ERDENE', 나라: '몽골', 나라영: 'Mongolia', 학번: '2026 1047', 전공: '국제학부',
  코치: { ko: '여기서 당신은\n한국 대학 신입생이에요.', en: 'Here, you are a freshman at a Korean university.' },
  선배: { 누구: '창업 동아리 선배', ko: '신입생이죠? 반가워요!\n이름이 뭐예요? 어디에서 왔어요?', en: 'You’re a freshman, right? Nice to meet you! What’s your name? Where are you from?' },
  단톡: { 방: '새솔 창업 동아리', 사람: '14', 말: '바트에르덴 씨, 환영해요! 수업 끝나고 카페에서 봐요.' },
  성공: {
    누구: '문지영 교수님', ko: '<b>바트에르덴 씨</b>죠? 네, 들어오세요.', en: 'Bat-Erdene, right? Yes, come in.',
    나: '안녕하세요, 교수님.\n이번 학기에 새로 온 유학생이에요.', 나en: 'Hello, Professor. I’m a new international student this semester.',
    반응: '교수님이 웃으며 고개를 끄덕여요.',
  },
  장면: { 회: '1화', 제목: '개강 첫날', 곳: '장면 1 · 교수님 연구실', ko: '지도교수님께 처음 인사하러 왔어요.\n과제 마감도 여쭤봐야 해요.', en: 'You’re meeting your advisor for the first time — and you need to ask about the assignment deadline.' },
};

const 이스 = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const 줄 = (s) => 이스(s).replace(/\n/g, '<br>');
const 주소 = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;

// 무대 그림 — 원본을 칸대로 자르고 화면 2배 폭(780)으로 줄인 JPEG. 흐림을 주면 가우스 흐림 + 어둡게.
export function 무대만들기(이름, { 파일, 칸, 흐림 = 0, 폭 = 780 }, 폴더 = path.join(밖, '판', '무대')) {
  const 원본 = path.join(공용, 파일);
  if (!fs.existsSync(원본)) throw new Error('원천 그림이 없다: ' + 원본);
  const 낼 = path.join(폴더, `${이름}.jpg`);
  fs.mkdirSync(path.dirname(낼), { recursive: true });
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', `
import sys, json
from PIL import Image, ImageFilter, ImageEnhance
im = Image.open(sys.argv[1]).convert('RGB')
l, t, r_, b = json.loads(sys.argv[3]); im = im.crop((l, t, r_, b))
w = int(sys.argv[5]); im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
blur = float(sys.argv[4])
if blur > 0:
    im = im.filter(ImageFilter.GaussianBlur(blur)); im = ImageEnhance.Brightness(im).enhance(0.62)
im.save(sys.argv[2], quality=88, optimize=True, progressive=True)
print(im.size)
`, 원본, 낼, JSON.stringify(칸), String(흐림), String(폭)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('무대 그림 실패: ' + r.stderr);
  return 낼;
}

/* ── 그림 조각(SVG) ───────────────────────────────────────────────── */
const 아이콘 = {
  소리: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  물결: '<svg viewBox="0 0 22 14" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 6v2"/><path d="M6 3.5v7"/><path d="M10 1.5v11"/><path d="M14 4v6"/><path d="M18 5.5v3"/></g></svg>',
  핀: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="currentColor"/><circle cx="12" cy="10" r="2.4" fill="#0b0c10"/></svg>',
  마이크: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  다시: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4.5 3.8v4.4h4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  글자: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><g fill="currentColor"><rect x="6" y="9" width="2" height="2" rx=".5"/><rect x="9.3" y="9" width="2" height="2" rx=".5"/><rect x="12.7" y="9" width="2" height="2" rx=".5"/><rect x="16" y="9" width="2" height="2" rx=".5"/><rect x="8" y="13.4" width="8" height="1.8" rx=".9"/></g></svg>',
  화살: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  아래: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  확인: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// 학교 문장 — 승인 실사의 과잠 가슴 문장(방패 · 펼친 책 · 별)과 같은 꼴
const 문장 = (색 = 'currentColor') => `<svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2.5 36.5 8.2V21.5c0 10.8-7.6 18.6-16.5 21.9C11.1 40.1 3.5 32.3 3.5 21.5V8.2z" fill="none" stroke="${색}" stroke-width="2.6" stroke-linejoin="round"/><path d="M10 25.5c3.6-2.3 6.8-2.3 10 .4 3.2-2.7 6.4-2.7 10-.4v7.6c-3.6-2.3-6.8-2.3-10 .4-3.2-2.7-6.4-2.7-10-.4z" fill="${색}"/><path d="m20 9.6 1.5 3.4 3.7.4-2.8 2.5.8 3.6-3.2-1.9-3.2 1.9.8-3.6-2.8-2.5 3.7-.4z" fill="${색}"/></svg>`;

// 모습 고르기 칸 — 얼굴 조각 그림이 아직 없어 머리 모양만 다른 단정한 실루엣(0 = 학생증의 빈 자리)
const 머리들 = [
  '',
  '<path d="M31 47c-1-17 10-23 20-23 12 1 19 8 18 23-3-7-9-11-19-11-9 0-16 4-19 11z"/>',
  '<path d="M30 50c-2-21 11-27 21-27 12 1 22 8 19 29l2 32c-6-2-8-10-6-25-2-14-8-20-16-20s-14 6-16 20c2 15 0 23-6 25z"/>',
  '<path d="M31 47c-1-17 10-23 20-23 12 1 19 8 18 23-3-7-9-11-19-11-9 0-16 4-19 11z"/><circle cx="50" cy="19" r="8.5"/>',
  '<path d="M28 52c-7-12-1-28 11-30 4-8 18-8 22 0 12 2 18 18 11 30-2-10-10-16-22-16s-20 6-22 16z"/>',
  '<path d="M31 46c0-15 9-22 20-22 11 0 19 7 19 22-4-6-10-9-19-9-8 0-15 3-20 9z"/><g fill="none" stroke-width="2.4"><circle cx="42.5" cy="53" r="5.6"/><circle cx="57.5" cy="53" r="5.6"/><path d="M48 53h4"/></g>',
];
function 실루엣(n, { 바탕 = '#e7ebf1', 몸 = '#b4bac4', 머리 = '#7f8693' } = {}) {
  return `<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${바탕 ? `<rect width="100" height="120" fill="${바탕}"/>` : ''}
<path d="M8 120c2-25 20-36 42-36s40 11 42 36z" fill="${몸}"/><rect x="42.5" y="66" width="15" height="22" rx="6" fill="${몸}"/><ellipse cx="50" cy="50" rx="18.5" ry="22.5" fill="${몸}"/>
<g fill="${머리}" stroke="${머리}">${머리들[n] || ''}</g></svg>`;
}

/* ── 공통 겉 ─────────────────────────────────────────────────────── */
const CSS = `
:root{--bg:#07080b;--ink:#FAFAF9;--ink-2:rgba(250,250,249,.80);--ink-3:rgba(250,250,249,.60);--ink-4:rgba(250,250,249,.34);
--line:rgba(255,255,255,.10);--line-2:rgba(255,255,255,.18);--coral:#F96859;--coral-soft:rgba(249,104,89,.24);--gold:#FFE08A;
--glass:rgba(16,17,22,.52);--glass-edge:inset 0 1px 0 rgba(255,255,255,.16),inset 0 0 0 1px rgba(255,255,255,.08);
--sans:'SUIT Variable','SUIT',system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:390px;height:844px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;font-size:15px;line-height:1.5;letter-spacing:-.008em;word-break:keep-all}
.app{position:relative;width:390px;height:844px;overflow:hidden}
.photo{position:absolute;left:0;right:0;top:0;background:#000 center/cover no-repeat}
.shade{position:absolute;left:0;right:0;pointer-events:none}
.glass{background:var(--glass);box-shadow:var(--glass-edge);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:650;color:var(--ink);white-space:nowrap}
.chip svg{width:14px;height:14px;color:var(--coral)}
.ibtn{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--ink)}
.ibtn svg{width:18px;height:18px}
.ko{font-weight:720;letter-spacing:-.022em;text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 22px rgba(0,0,0,.35)}
.en{font-weight:520;color:var(--ink-3);letter-spacing:0;line-height:1.42}
`;
function 쪽(제목, 몸, 더 = '') {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=390"><title>${이스(제목)}</title>${폰트블록()}<style>${CSS}${더}</style></head><body><div class="app">${몸}</div></body></html>`;
}

// 동아리 단톡방 알림(⑤ · v2 B의 학생증) — 이름이 처음 글로 불리는 자리(설계 §6 · §7)
const 알림CSS = `.noti{position:absolute;left:10px;right:10px;top:10px;border-radius:20px;padding:11px 13px;display:flex;gap:11px;align-items:flex-start}
.noti .ic{width:36px;height:36px;border-radius:9px;flex:none;background:linear-gradient(140deg,#1d2f57,#13203d);display:flex;align-items:center;justify-content:center;color:#e9d9a8}
.noti .ic svg{width:19px;height:22px}
.noti .tx{flex:1;min-width:0}
.noti .hd{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--ink-2)}
.noti .hd span{color:var(--ink-3);font-weight:560}
.noti p{font-size:13.5px;font-weight:600;line-height:1.38;margin-top:1px}
.noti p b{color:var(--gold);font-weight:760}
`;
const 알림 = () => `<div class="noti glass" data-box="noti"><span class="ic">${문장()}</span><div class="tx"><div class="hd">${이스(글.단톡.방)} · ${이스(글.단톡.사람)}명<span>방금</span></div><p><b>${이스(글.이름)} 씨</b>, ${이스(글.단톡.말.replace(`${글.이름} 씨, `, ''))}</p></div></div>`;

/* ② 착륙 → 공항 → 정문, 코치 한 줄 ─────────────────────────────── */
export function 화면2(무대, 단계 = 0) {
  const 곳 = ['착륙', '공항', '새솔대학교 정문'].map((x, i) => (i === 단계 ? `<b>${x}</b>` : x)).join(` ${아이콘.화살} `);
  const 마디 = [0, 1, 2].map((i) => `<i class="${i < 단계 ? 'done' : i === 단계 ? 'now' : ''}"></i>`).join('');
  const 더 = `
.photo{bottom:0;background-position:50% 30%}
.s-top{top:0;height:150px;background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,0))}
.s-bot{bottom:0;height:430px;background:linear-gradient(180deg,rgba(7,8,11,0),rgba(7,8,11,.72) 38%,rgba(7,8,11,.94))}
.segs{position:absolute;top:14px;left:16px;right:16px;display:flex;gap:5px}
.segs i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.28);overflow:hidden;position:relative}
.segs i.done{background:rgba(255,255,255,.92)}
.segs i.now::after{content:'';position:absolute;inset:0 38% 0 0;background:#fff;border-radius:2px}
.trip{position:absolute;top:26px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between}
.steps{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:620;color:var(--ink-3);white-space:nowrap}
.steps b{color:var(--ink);font-weight:760}
.steps svg{width:11px;height:11px;opacity:.6}
.coach{position:absolute;left:20px;right:20px;bottom:78px}
.tag{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:760;color:var(--gold);letter-spacing:.01em;margin-bottom:10px}
.tag svg{width:18px;height:12px}
.tag span{color:var(--ink-3);font-weight:560;letter-spacing:0}
.coach .ko{font-size:26px;line-height:1.32}
.coach .en{font-size:13.5px;margin-top:10px}
.next{position:absolute;left:0;right:0;bottom:26px;text-align:center;font-size:12.5px;font-weight:600;color:var(--ink-4);letter-spacing:.02em}
`;
  return 쪽('정문 도착', `
<div class="photo" style="background-image:url('${무대}')"></div>
<div class="shade s-top"></div><div class="shade s-bot"></div>
<div class="segs" data-box="segs">${마디}</div>
<div class="trip" data-box="trip"><span class="steps">${곳}</span><span class="ibtn glass">${아이콘.소리}</span></div>
<div class="coach" data-box="coach">
 <div class="tag">${아이콘.물결}코치 <span>· 이야기 밖에서 한국어를 도와줘요</span></div>
 <p class="ko">${줄(글.코치.ko)}</p>
 <p class="en">${줄(글.코치.en)}</p>
</div>
<p class="next" data-box="next">화면을 누르면 계속</p>`, 더);
}

/* ③ 정문 — 창업 동아리 선배가 이름 · 나라를 묻는다 ─────────────── */
export function 화면3(무대) {
  const 더 = `
.photo{height:612px;background-position:50% 18%}
.s-top{top:0;height:120px;background:linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,0))}
.s-bot{top:300px;height:320px;background:linear-gradient(180deg,rgba(7,8,11,0),rgba(7,8,11,.78) 55%,var(--bg))}
.top{position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center}
.line{position:absolute;left:20px;right:20px;top:432px}
.who{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:760;color:var(--gold);letter-spacing:.02em;margin-bottom:8px}
.who::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--gold)}
.line .ko{font-size:21px;line-height:1.42}
.line .en{font-size:13px;margin-top:7px}
.turn{position:absolute;left:0;right:0;top:614px;display:flex;justify-content:center;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--ink-2)}
.live{width:7px;height:7px;border-radius:50%;background:var(--coral);box-shadow:0 0 0 4px var(--coral-soft)}
.ctrl{position:absolute;left:0;right:0;top:692px;display:flex;justify-content:center;align-items:flex-start;gap:34px}
.c{display:flex;flex-direction:column;align-items:center;gap:7px;font-size:11.5px;font-weight:620;color:var(--ink-3);white-space:nowrap}
.c .r{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink);background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px var(--line-2)}
.c .r svg{width:22px;height:22px}
.c.mic{margin-top:-14px;color:var(--ink);font-size:12.5px;font-weight:720}
.c.mic .r{width:78px;height:78px;background:var(--coral);color:#fff;box-shadow:0 0 0 7px var(--coral-soft),0 0 0 15px rgba(249,104,89,.09),0 10px 30px rgba(249,104,89,.35)}
.c.mic .r svg{width:32px;height:32px}
.later{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:13px;font-weight:600;color:var(--ink-3)}
.later u{text-underline-offset:4px;text-decoration-color:var(--ink-4)}
`;
  return 쪽('정문에서', `
<div class="photo" style="background-image:url('${무대}')"></div>
<div class="shade s-top"></div><div class="shade s-bot"></div>
<div class="top" data-box="top"><span class="chip glass">${아이콘.핀}새솔대학교 정문</span><span class="ibtn glass">${아이콘.소리}</span></div>
<div class="line" data-box="line">
 <span class="who">${이스(글.선배.누구)}</span>
 <p class="ko">${줄(글.선배.ko)}</p>
 <p class="en">${줄(글.선배.en)}</p>
</div>
<div class="turn" data-box="turn"><i class="live"></i>내 차례 — 이름과 나라를 말해요</div>
<div class="ctrl" data-box="ctrl">
 <div class="c"><span class="r">${아이콘.다시}</span>다시 듣기</div>
 <div class="c mic"><span class="r">${아이콘.마이크}</span>말하기</div>
 <div class="c"><span class="r">${아이콘.글자}</span>글자로</div>
</div>
<p class="later" data-box="later"><u>나중에 말할래요</u></p>`, 더);
}

/* ④ 학생증 발급 — 모습 고르기 ──────────────────────────────────── */
export function 화면4(배경, { 얼굴 = null, 알림있음 = false, 머리글 = '학생증이 나왔어요', 제목 = '학생증 사진에 나올<br>내 모습을 골라요' } = {}) {
  // 알림이 있으면(v2 B) 위에 단톡방 알림을 두고 제목을 한 줄로 줄여 그만큼만 아래로 민다
  const dy = 알림있음 ? 46 : 0;
  const 더 = `${알림있음 ? 알림CSS : ''}
.photo{bottom:0;background-position:50% 20%}
.s-all{inset:0;background:linear-gradient(180deg,rgba(7,8,11,.12),rgba(7,8,11,.42) 34%,rgba(7,8,11,.9) 62%,var(--bg) 80%)}
.head{position:absolute;left:20px;right:20px;top:${알림있음 ? 100 : 20}px}
.step{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:760;color:var(--gold);letter-spacing:.04em;margin-bottom:8px}
.head h1{font-size:23px;line-height:1.3;font-weight:780;letter-spacing:-.025em}
.head .en{font-size:13px;margin-top:5px}
.card{position:absolute;left:24px;right:24px;top:${156 + dy}px;height:214px;border-radius:16px;overflow:hidden;color:#141824;
 background:linear-gradient(135deg,#fbfaf6 0%,#f2f0ea 100%);box-shadow:0 22px 50px rgba(0,0,0,.55),0 2px 0 rgba(255,255,255,.6) inset;transform:perspective(900px) rotateX(4deg) rotateZ(-1.2deg)}
.band{height:46px;background:linear-gradient(100deg,#13203d,#1d2f57);display:flex;align-items:center;gap:9px;padding:0 14px;color:#f3efe4}
.band svg{width:22px;height:25px;flex:none;color:#e9d9a8}
.band .u{display:flex;flex-direction:column;line-height:1.12}
.band .u b{font-size:14px;font-weight:800;letter-spacing:-.01em}
.band .u small{font-size:8.5px;font-weight:700;letter-spacing:.16em;opacity:.7}
.band .id{margin-left:auto;text-align:right;line-height:1.15}
.band .id b{display:block;font-size:12px;font-weight:800;letter-spacing:.02em}
.band .id small{font-size:8px;font-weight:700;letter-spacing:.2em;opacity:.65}
.body{display:flex;gap:14px;padding:13px 14px 0}
.pic{width:84px;height:106px;border-radius:7px;overflow:hidden;flex:none;box-shadow:0 0 0 1px rgba(20,24,36,.12)}
.pic svg,.pic img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 22%}
.f{flex:1;min-width:0}
.f .nm{font-size:22px;font-weight:820;letter-spacing:-.02em;line-height:1.15}
.f .ro{font-size:10px;font-weight:700;letter-spacing:.18em;color:#5a6274;margin:3px 0 8px}
.f dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12px;line-height:1.35}
.f dt{color:#7a8294;font-weight:650}
.f dd{font-weight:720;color:#141824;display:flex;align-items:center;gap:3px;white-space:nowrap}
.f dd small{font-weight:600;color:#7a8294;font-size:10.5px}
.f dd svg{width:12px;height:12px;color:#7a8294}
.holo{position:absolute;right:12px;bottom:12px;width:40px;height:40px;border-radius:50%;background:conic-gradient(from 30deg,#f6c1d6,#bfe3f7,#d7f5c9,#f7e7b4,#f6c1d6);opacity:.55;mix-blend-mode:multiply}
.strip{position:absolute;left:14px;bottom:13px;display:flex;gap:2px;height:16px;align-items:stretch}
.strip i{display:block;background:#141824;opacity:.8}
.note{position:absolute;left:20px;right:20px;top:${396 + dy}px;font-size:12.5px;font-weight:600;color:var(--ink-2);text-align:center}
.tabs{position:absolute;left:50%;top:${432 + dy}px;transform:translateX(-50%);display:inline-flex;padding:3px;border-radius:999px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px var(--line-2)}
.tabs span{height:30px;display:inline-flex;align-items:center;gap:5px;padding:0 16px;border-radius:999px;font-size:13px;font-weight:650;color:var(--ink-3)}
.tabs span.on{background:var(--ink);color:#0b0c10;font-weight:760}
.tabs small{font-size:11px;font-weight:700;opacity:.55}
.grid{position:absolute;left:24px;right:0;top:${484 + dy}px;height:110px;display:flex;gap:10px;overflow:hidden;padding:3px 0 0 3px;margin-left:-3px}
.t{position:relative;flex:none;width:78px;height:104px;border-radius:13px;overflow:hidden;background:linear-gradient(170deg,#eef1f5,#d3d9e2)}
.t svg,.t img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.t.on{box-shadow:0 0 0 2.5px var(--coral)}
.t.on b{position:absolute;right:4px;top:4px;width:18px;height:18px;border-radius:50%;background:var(--coral);display:flex;align-items:center;justify-content:center;color:#fff}
.t.on b svg{width:12px;height:12px}
.shot{position:absolute;left:0;right:0;top:${632 + dy}px;display:flex;flex-direction:column;align-items:center;gap:9px;font-size:13.5px;font-weight:720}
.shut{width:76px;height:76px;border-radius:50%;box-shadow:inset 0 0 0 4px var(--ink);display:flex;align-items:center;justify-content:center}
.shut i{width:60px;height:60px;border-radius:50%;background:var(--ink)}
.save{position:absolute;left:0;right:0;bottom:24px;text-align:center;font-size:12px;color:var(--ink-4);font-weight:600}
`;
  const 막대 = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2].map((w) => `<i style="width:${w}px"></i>`).join('');
  const 표 = (i) => (i === 0 ? `<b>${아이콘.확인}</b>` : '');
  const 칸 = 얼굴
    ? 얼굴.칸.map((src, i) => `<div class="t${i === 0 ? ' on' : ''}"><img src="${src}" alt="">${표(i)}</div>`).join('')
    : [1, 2, 3, 4, 5].map((n, i) => `<div class="t${i === 0 ? ' on' : ''}">${실루엣(n, { 바탕: null, 몸: '#aab1bc', 머리: '#6f7682' })}${표(i)}</div>`).join('');
  return 쪽('학생증', `
<div class="photo" style="background-image:url('${배경}')"></div>
<div class="shade s-all"></div>
${알림있음 ? 알림() : ''}
<div class="head" data-box="head">
 <span class="step">${머리글}</span>
 <h1>${제목}</h1>
 <p class="en">Choose how you’ll look on your student ID.</p>
</div>
<div class="card" data-box="card">
 <div class="band">${문장()}<span class="u"><b>새솔대학교</b><small>SAESOL UNIVERSITY</small></span><span class="id"><b>학생증</b><small>STUDENT ID</small></span></div>
 <div class="body">
  <div class="pic">${얼굴 ? `<img src="${얼굴.카드}" alt="">` : 실루엣(0, { 바탕: '#dfe5ee', 몸: '#c3c9d3' })}</div>
  <div class="f">
   <div class="nm">${이스(글.이름)}</div>
   <div class="ro">${이스(글.로마)}</div>
   <dl><dt>나라</dt><dd>${이스(글.나라)} <small>${이스(글.나라영)}</small></dd>
   <dt>학번</dt><dd>${이스(글.학번)}</dd>
   <dt>전공</dt><dd>${이스(글.전공)} ${아이콘.아래}</dd></dl>
  </div>
 </div>
 <div class="strip">${막대}</div><span class="holo"></span>
</div>
<p class="note" data-box="note">이 모습은 학생증과 추억 사진에만 나와요.</p>
<div class="tabs" data-box="tabs"><span class="on">얼굴${얼굴 ? '' : '<small>16</small>'}</span><span>머리</span><span>안경</span></div>
<div class="grid" data-box="grid">${칸}</div>
<div class="shot" data-box="shot"><span class="shut"><i></i></span>이 모습으로 사진 찍기</div>
<p class="save" data-box="save">찍은 학생증은 저장하고 친구에게 보낼 수 있어요</p>`, 더);
}

/* ⑤ 1화 장면 1 — 교수님 연구실로 ───────────────────────────────── */
export function 화면5(무대) {
  const 더 = `
.photo{height:640px;background-position:50% 0}
.s-top{top:0;height:150px;background:linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,0))}
.s-bot{top:330px;height:320px;background:linear-gradient(180deg,rgba(7,8,11,0),rgba(7,8,11,.82) 58%,var(--bg))}
${알림CSS}.title{position:absolute;left:20px;right:20px;top:500px}
.ep{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;background:var(--coral);color:#fff;font-size:12px;font-weight:800;letter-spacing:.02em}
.title h1{font-size:34px;line-height:1.24;font-weight:820;letter-spacing:-.035em;margin-top:9px;text-shadow:0 2px 18px rgba(0,0,0,.5)}
.title .where{font-size:14px;font-weight:650;color:var(--ink-2);margin-top:5px}
.setup{position:absolute;left:20px;right:20px;top:628px}
.setup .ko{font-size:16.5px;line-height:1.45;font-weight:640;text-shadow:none}
.setup .en{font-size:12.5px;margin-top:5px}
.go{position:absolute;left:20px;right:20px;bottom:24px;height:58px;border-radius:18px;display:flex;align-items:center;gap:12px;padding:0 10px 0 18px;
 background:linear-gradient(90deg,rgba(249,104,89,.22),rgba(249,104,89,.08));box-shadow:inset 0 0 0 1.5px rgba(249,104,89,.55)}
.go b{font-size:16.5px;font-weight:780}
.go small{font-size:12.5px;font-weight:600;color:var(--ink-3)}
.go .ar{margin-left:auto;width:40px;height:40px;border-radius:50%;background:var(--coral);display:flex;align-items:center;justify-content:center;color:#fff}
.go .ar svg{width:18px;height:18px}
`;
  return 쪽('1화 장면 1', `
<div class="photo" style="background-image:url('${무대}')"></div>
<div class="shade s-top"></div><div class="shade s-bot"></div>
${알림()}
<div class="title" data-box="title"><span class="ep">${이스(글.장면.회)}</span><h1>${이스(글.장면.제목)}</h1><p class="where">${이스(글.장면.곳)}</p></div>
<div class="setup" data-box="setup"><p class="ko">${줄(글.장면.ko)}</p><p class="en">${줄(글.장면.en)}</p></div>
<div class="go" data-box="go"><b>똑똑, 문 두드리기</b><small>장면 시작</small><span class="ar">${아이콘.화살}</span></div>`, 더);
}

/* v2 B ④ 장면 1 첫 성공 — 교수님이 이름을 부르고, 1화 첫 대사(s1e01-1)가 통한 순간 ─────────── */
export function 화면성공(무대) {
  const 더 = `
.photo{height:600px;background-position:50% 0}
.s-top{top:0;height:130px;background:linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,0))}
.s-bot{top:300px;height:310px;background:linear-gradient(180deg,rgba(7,8,11,0),rgba(7,8,11,.8) 55%,var(--bg))}
.top{position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center}
.prof{position:absolute;left:20px;right:20px;top:424px}
.who{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:760;color:var(--gold);letter-spacing:.02em;margin-bottom:6px}
.who::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--gold)}
.prof .ko{font-size:19px;line-height:1.42}
.prof .ko b{color:var(--gold);font-weight:780}
.prof .en{font-size:12.5px;margin-top:4px}
.mine{position:absolute;left:20px;right:20px;top:548px;border-radius:18px;padding:13px 15px 13px;background:rgba(125,180,90,.10);box-shadow:inset 0 0 0 1.5px rgba(125,180,90,.55)}
.mine .lab{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:760;color:var(--ink-3);margin-bottom:5px}
.ok{display:inline-flex;align-items:center;gap:6px;color:#a6dc84;font-size:13px;font-weight:800}
.ok i{width:20px;height:20px;border-radius:50%;background:#7DB45A;display:flex;align-items:center;justify-content:center;color:#0b0c10}
.ok i svg{width:13px;height:13px}
.mine .ko{font-size:17px;line-height:1.45;font-weight:700;text-shadow:none}
.mine .en{font-size:12.5px;margin-top:3px}
.react{position:absolute;left:20px;right:20px;top:716px;font-size:13.5px;font-weight:600;color:var(--ink-2)}
.prog{position:absolute;left:20px;right:20px;bottom:56px;display:flex;align-items:center;gap:10px;font-size:12px;font-weight:650;color:var(--ink-3);white-space:nowrap}
.bars{display:flex;gap:4px;flex:1}
.bars i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.14)}
.bars i.on{background:#7DB45A}
.next{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:12.5px;font-weight:600;color:var(--ink-4);letter-spacing:.02em}
`;
  return 쪽('장면 1 첫 대사', `
<div class="photo" style="background-image:url('${무대}')"></div>
<div class="shade s-top"></div><div class="shade s-bot"></div>
<div class="top" data-box="top"><span class="chip glass">${이스(글.장면.회)} · ${이스(글.장면.곳)}</span><span class="ibtn glass">${아이콘.소리}</span></div>
<div class="prof" data-box="prof">
 <span class="who">${이스(글.성공.누구)}</span>
 <p class="ko">${글.성공.ko}</p>
 <p class="en">${줄(글.성공.en)}</p>
</div>
<div class="mine" data-box="mine">
 <div class="lab"><span>내가 한 말</span><span class="ok"><i>${아이콘.확인}</i>통했어요</span></div>
 <p class="ko">${줄(글.성공.나)}</p>
 <p class="en">${줄(글.성공.나en)}</p>
</div>
<p class="react" data-box="react">${이스(글.성공.반응)}</p>
<div class="prog" data-box="prog"><span>장면 1</span><span class="bars"><i class="on"></i><i></i><i></i><i></i><i></i></span><span>1 / 5</span></div>
<p class="next" data-box="next">화면을 누르면 계속</p>`, 더);
}

/* ── 찍기와 검사 ──────────────────────────────────────────────── */
export async function 찍기(목록) {
  const { chromium } = require(path.join(공용, 'node_modules', 'playwright'));
  let 브 = null;
  try { 브 = await chromium.launch({ channel: 'chrome', headless: true }); } catch { 브 = await chromium.launch({ headless: true }); }
  const 결과 = [];
  try {
    const 쪽_ = await (await 브.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })).newPage();
    for (const { 파일, html } of 목록) {
      await 쪽_.setContent(html, { waitUntil: 'load' });
      await 쪽_.evaluate(() => document.fonts.ready);
      const 잼 = await 쪽_.evaluate(() => {
        const 상자 = [...document.querySelectorAll('[data-box]')].map((e) => ({ 이름: e.dataset.box, r: e.getBoundingClientRect() }));
        const 화면밖 = 상자.filter(({ r }) => r.left < -0.5 || r.top < -0.5 || r.right > 390.5 || r.bottom > 844.5).map((b) => b.이름);
        const 겹침 = [];
        for (let i = 0; i < 상자.length; i++) for (let j = i + 1; j < 상자.length; j++) {
          const a = 상자[i].r, b = 상자[j].r;
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 1 && h > 1) 겹침.push(`${상자[i].이름}×${상자[j].이름}`);
        }
        // 글자 잘림: 글이 든 요소가 제 상자보다 넓거나(가로 잘림) 높으면(세로 잘림) 알린다
        const 잘림 = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim() && getComputedStyle(e).display !== 'inline')
          .filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent.trim().slice(0, 20));
        // 인라인 글 줄이 화면 밖으로 나가는지
        const 줄밖 = [...document.querySelectorAll('body *')].filter((e) => e.textContent.trim() && !e.children.length).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > 390.5 || r.left < -0.5 || r.bottom > 844.5); }).map((e) => e.textContent.trim().slice(0, 20));
        const 글꼴 = document.fonts.check("15px 'SUIT Variable'");
        return { 화면밖, 겹침, 잘림, 줄밖, 글꼴 };
      });
      fs.mkdirSync(path.dirname(파일), { recursive: true });
      await 쪽_.screenshot({ path: 파일 });
      const html파일 = path.join(path.dirname(파일), 'html', path.basename(파일).replace(/\.png$/, '.html'));
      fs.mkdirSync(path.dirname(html파일), { recursive: true });
      fs.writeFileSync(html파일, html);
      결과.push({ 파일: path.basename(파일), ...잼 });
    }
  } finally {
    await 브.close();
  }
  return 결과;
}

/* ── 시험관 폴더 ─────────────────────────────────────────────── */
export const 시험관들 = {
  '몽골남_게임': '몽골 울란바토르의 대학에 다니는 21살 남자 대학생입니다. TOPIK 3급이고, 한국 대학원 진학과 취업에 4급이 필요합니다. 모바일 게임을 거의 매일 합니다',
  '몽골여': '몽골 울란바토르의 대학에 다니는 20살 여자 대학생입니다. TOPIK 3급이고, 한국 유학과 취업에 4급이 필요합니다',
  '베트남남_취업준비': '베트남 하노이 출신 25살 남자입니다. 한국 회사에 취업하려고 한국어를 공부하고 있습니다(TOPIK 3급 정도). 게임은 거의 하지 않습니다',
  '한국인_게임기획자': '29살 한국인 모바일 게임 기획자입니다. 스토리 게임 · 캐주얼 게임의 첫 실행 화면을 수백 개 뜯어본 냉정한 평가자입니다. 이 앱의 사용자는 아니지만, 이 앱이 노리는 사람(한국어를 배우는 외국인 대학생)이 이 첫 3분에서 남을지를 업계 눈으로 판단합니다',
};

const 물음들 = (학생증) => `1. 이 3분 뒤에도 이 앱을 계속하겠어요? 1(여기서 그만) ~ 5(꼭 계속한다) 가운데 숫자 하나와 까닭.
2. 어디서 끄고 싶었나요? 판 번호와 까닭. 없으면 「없음」.
3. 설문지나 가입 양식을 채우는 느낌이었나요? 1(전혀 아니다 — 이야기 같았다) ~ 5(완전히 설문 · 가입 양식 같았다) 가운데 숫자 하나와, 그렇게 느낀 판 번호.
4. 싸 보이거나 뻔해 보이는 곳: 판 번호와 자리, 왜 그렇게 보였는지. 없으면 「없음」.
5. 학생증을 받았을 때(${학생증}) 「이게 나」 같은 애착이 생겼나요? 1(전혀) ~ 5(아주 많이) 가운데 숫자 하나와 까닭.
6. 이 앱은 누구를 위한 것 같나요? 성별(남 · 여 · 상관없음)과 나이대, 그렇게 본 까닭.
7. 가장 좋았던 순간 하나: 판 번호와 무엇.
8. 하나만 고친다면 무엇을 어떻게?`;
const 답꼴8 = '1. (숫자) — …\n2. …\n3. (숫자) — …\n4. …\n5. (숫자) — …\n6. …\n7. …\n8. …';
const 솔직 = (누구) => (누구.startsWith('한국인')
  ? '당신의 눈으로 냉정하게 답하세요. 1번 · 5번은 이 앱이 노리는 사람이 어떨지에 대한 당신의 판단입니다.'
  : '그 사람이 되어 솔직하게 답하세요. 좋게 말해 줄 필요는 없습니다.');
const 판02말 = '판_02는 실제로는 비행기 착륙 → 공항 → 학교 정문 사진 몇 장이 소리와 함께 넘어가는 장면에서 멈춘 한 장입니다.';

export function 질문글(누구, { 마지막메시지 = false } = {}) {
  const 여는법 = 마지막메시지
    ? '- 붙인 그림 다섯 장을 붙인 순서대로 판_01(처음) → 판_02 → 판_03 → 판_04 → 판_05(3분쯤)로 봅니다. 앱을 처음 켠 사람이 순서대로 보는 화면입니다.'
    : '- 이 폴더의 그림 다섯 장을 차례로 엽니다: 판_01.png(처음) → 판_02.png → 판_03.png → 판_04.png → 판_05.png(3분쯤). 앱을 처음 켠 사람이 순서대로 보는 화면입니다.';
  const 답법 = 마지막메시지 ? '## 답 꼴 — 마지막 메시지로 아래 꼴대로만 답합니다(파일을 쓰지 않습니다)' : '## 답 꼴 — 이 폴더의 답.md에 아래 꼴대로만 씁니다';
  return `# 처음 보는 사람 시험 — 한국어 앱의 첫 3분

당신은 ${시험관들[누구]}. 친구가 「한국어 앱인데 한번 해 봐」라며 이 앱을 처음 켰을 때 3분 동안 나오는 화면 다섯 장을 보내 줬습니다. 이 앱이나 만든 회사에 대해 다른 것은 아무것도 모릅니다.

${여는법}
- 판_01은 움직이는 첫 화면을 한 순간 멈춘 것입니다. ${판02말}
- 실제 앱에서는 인물의 말과 코치의 말이 목소리로 들립니다. 이 시험에는 소리가 없습니다.
- 판_04의 회색 사람 모양은 내가 고른 모습의 사진이 들어갈 자리입니다(아직 그림이 없습니다).
- 이 폴더 밖의 파일 · 폴더는 열거나 찾지 마세요(작업 폴더 목록도 보지 마세요). 인터넷도 쓰지 마세요.
- ${솔직(누구)} 짐작으로 답해도 됩니다. 모르면 「모름」이라고 쓰세요.

## 질문

${물음들('판_04')}

${답법}

\`\`\`
${답꼴8}
\`\`\`
`;
}

// v2 — 같은 첫 3분의 두 벌(A 지금 순서 · B 첫 성공 먼저)을 「첫째 · 둘째」 이름으로만 보인다(어느 쪽이 A인지는 짝표.json에만)
export function 질문글v2(누구, { 마지막메시지 = false } = {}) {
  const 여는법 = 마지막메시지
    ? '- 붙인 그림 열 장 가운데 앞 다섯 장이 첫째 판(판_01 처음 → 판_05 3분쯤), 뒤 다섯 장이 둘째 판(판_01 → 판_05)입니다. 붙인 순서대로 봅니다.'
    : '- 이 폴더의 그림을 차례로 엽니다. 먼저 첫째 판: 첫째_판_01.png(처음) → 첫째_판_02.png → … → 첫째_판_05.png(3분쯤). 다 본 뒤 둘째 판: 둘째_판_01.png → … → 둘째_판_05.png.';
  const 답법 = 마지막메시지 ? '## 답 꼴 — 마지막 메시지로 아래 꼴대로만 답합니다(파일을 쓰지 않습니다)' : '## 답 꼴 — 이 폴더의 답.md에 아래 꼴대로만 씁니다';
  return `# 처음 보는 사람 시험 — 한국어 앱의 첫 3분, 두 가지 판

당신은 ${시험관들[누구]}. 친구가 「한국어 앱인데 한번 해 봐」라며 이 앱을 처음 켰을 때 3분 동안 나오는 화면을 두 가지 판으로 보내 줬습니다. 같은 앱의 첫 3분을 순서만 다르게 만든 두 판입니다. 이 앱이나 만든 회사에 대해 다른 것은 아무것도 모릅니다.

${여는법}
- 두 판의 앞 세 장(판_01 · 판_02 · 판_03)은 같고, 판_04 · 판_05가 다릅니다. 판마다 앱을 처음 켠 사람이 순서대로 보는 화면입니다.
- 판_01은 움직이는 첫 화면을 한 순간 멈춘 것입니다. ${판02말}
- 실제 앱에서는 인물의 말과 코치의 말이 목소리로 들립니다. 이 시험에는 소리가 없습니다.
- 학생증 화면의 얼굴 사진들은 내가 고를 수 있는 보기입니다.
- 이 폴더 밖의 파일 · 폴더는 열거나 찾지 마세요(작업 폴더 목록도 보지 마세요). 인터넷도 쓰지 마세요.
- ${솔직(누구)} 짐작으로 답해도 됩니다. 모르면 「모름」이라고 쓰세요.

## 첫째 판 질문 — 첫째 판만 두고 답합니다

${물음들('학생증이 나오는 판')}

## 둘째 판 질문 — 둘째 판만 두고 답합니다

${물음들('학생증이 나오는 판')}

## 마지막 질문

9. 둘 중 어느 쪽이면 계속하겠어요? 「첫째」 또는 「둘째」와 까닭.

${답법}

\`\`\`
[첫째 판]
${답꼴8}

[둘째 판]
${답꼴8}

[마지막]
9. 첫째/둘째 — …
\`\`\`
`;
}

export function 시험관폴더(묶음, 이름, 판들, 옵션 = {}) {
  const p = path.join(밖, 묶음, 이름);
  if (fs.existsSync(p) && fs.readdirSync(p).some((f) => /^답/.test(f))) throw new Error('답이 든 폴더는 덮지 않는다: ' + p);
  fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(p, { recursive: true });
  판들.forEach((f, i) => fs.copyFileSync(f, path.join(p, `판_0${i + 1}.png`)));
  fs.writeFileSync(path.join(p, '질문.md'), 질문글(이름, 옵션));
  return p;
}

// v2 시험관 폴더 — 두 벌을 「첫째 · 둘째」로 넣는다. 순서는 페르소나마다(넷 가운데 둘은 A 먼저, 둘은 B 먼저)
export const 순서v2 = { '몽골남_게임': ['A', 'B'], '몽골여': ['B', 'A'], '베트남남_취업준비': ['A', 'B'], '한국인_게임기획자': ['B', 'A'] };
export function 시험관폴더v2(묶음, 이름, 벌, 옵션 = {}) {
  const p = path.join(밖, 묶음, 이름);
  if (fs.existsSync(p) && fs.readdirSync(p).some((f) => /^답/.test(f))) throw new Error('답이 든 폴더는 덮지 않는다: ' + p);
  fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(p, { recursive: true });
  const [첫, 둘] = 순서v2[이름];
  const 그림들 = [];
  for (const [자리, 키] of [['첫째', 첫], ['둘째', 둘]]) 벌[키].forEach((f, i) => { const 낼 = path.join(p, `${자리}_판_0${i + 1}.png`); fs.copyFileSync(f, 낼); 그림들.push(낼); });
  fs.writeFileSync(path.join(p, '질문.md'), 질문글v2(이름, 옵션));
  return { 폴더: p, 그림들, 첫째: 첫, 둘째: 둘 };
}

const 바로 = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (바로 && process.argv.includes('--v2')) {
  // v2: 판_03 부스 그림 · 학생증 얼굴 조각 · A/B 두 벌 → <밖>/판_v2/, 시험관 넷 → <밖>/시험관_v2/ (1회차 판 · 시험관 폴더는 건드리지 않는다)
  if (!원천.입구[입구]) throw new Error('--입구는 A 또는 B');
  if (!원천.도착[도착]) throw new Error('--도착은 착륙 또는 정문');
  const 판폴더 = path.join(밖, '판_v2');
  const 무대폴더 = path.join(판폴더, '무대');
  const 판 = (이름) => path.join(판폴더, `${이름}.png`);
  fs.mkdirSync(판폴더, { recursive: true });
  fs.copyFileSync(path.join(공용, 원천.입구[입구]), 판(`공통_01_첫화면${입구}`));
  const 무대 = Object.fromEntries(['부스', '학생증배경', '연구실'].map((k) => [k, 주소(무대만들기(k, 원천[k], 무대폴더))]));
  무대.도착 = 주소(무대만들기(`도착-${도착}`, 원천.도착[도착], 무대폴더));
  const 얼굴칸 = 원천.얼굴.map((o, i) => 주소(무대만들기(`얼굴${i + 1}`, o, 무대폴더)));
  const 얼굴 = { 카드: 얼굴칸[0], 칸: 얼굴칸 };
  const 결과 = await 찍기([
    { 파일: 판('공통_02_도착'), html: 화면2(무대.도착, 원천.도착[도착].단계) },
    { 파일: 판('공통_03_이름나라'), html: 화면3(무대.부스) },
    { 파일: 판('A_04_학생증'), html: 화면4(무대.학생증배경, { 얼굴 }) },
    { 파일: 판('A_05_장면1'), html: 화면5(무대.연구실) },
    { 파일: 판('B_04_첫성공'), html: 화면성공(무대.연구실) },
    { 파일: 판('B_05_학생증'), html: 화면4(무대.학생증배경, { 얼굴, 알림있음: true, 머리글: '장면 1을 마쳤어요 · 학생증이 나왔어요', 제목: '사진에 나올 내 모습을 골라요' }) },
  ]);
  for (const r of 결과) console.log(JSON.stringify(r));
  const 나쁨 = 결과.filter((r) => r.화면밖.length || r.겹침.length || r.잘림.length || r.줄밖.length || !r.글꼴);
  if (나쁨.length) { console.error('[T-A v2] 화면 밖 · 겹침 · 잘림 · 글꼴 문제:', JSON.stringify(나쁨)); process.exit(1); }
  if (process.argv.includes('--판만')) process.exit(0);
  const 공통 = [판(`공통_01_첫화면${입구}`), 판('공통_02_도착'), 판('공통_03_이름나라')];
  const 벌 = { A: [...공통, 판('A_04_학생증'), 판('A_05_장면1')], B: [...공통, 판('B_04_첫성공'), 판('B_05_학생증')] };
  const 짝 = {};
  for (const 누구 of Object.keys(시험관들)) {
    const r = 시험관폴더v2('시험관_v2', 누구, 벌);
    짝[누구] = { 첫째: r.첫째, 둘째: r.둘째 };
    console.log('[T-A v2] 시험관 폴더 →', r.폴더, `첫째 ${r.첫째} · 둘째 ${r.둘째}`);
  }
  fs.writeFileSync(path.join(밖, '시험관_v2', '짝표.json'), JSON.stringify({ A: '지금 순서 — 이름 · 나라 → 학생증 → 장면 1', B: '첫 성공 먼저 — 이름 · 나라 → 장면 1 첫 대사 → 학생증 + 단톡방', 시험관: 짝 }, null, 1) + '\n');
} else if (바로) {
  if (!원천.입구[입구]) throw new Error('--입구는 A 또는 B');
  if (!원천.도착[도착]) throw new Error('--도착은 착륙 또는 정문');
  const 판 = (n, 이름) => path.join(밖, '판', `판_0${n}_${이름}.png`);
  const 입구원본 = path.join(공용, 원천.입구[입구]);
  fs.mkdirSync(path.join(밖, '판'), { recursive: true });
  fs.copyFileSync(입구원본, 판(1, `첫화면${입구}`));
  const 무대 = Object.fromEntries(['정문대화', '학생증배경', '연구실'].map((k) => [k, 주소(무대만들기(k, 원천[k]))]));
  무대.도착 = 주소(무대만들기(`도착-${도착}`, 원천.도착[도착]));
  const 결과 = await 찍기([
    { 파일: 판(2, '도착'), html: 화면2(무대.도착, 원천.도착[도착].단계) },
    { 파일: 판(3, '이름나라'), html: 화면3(무대.정문대화) },
    { 파일: 판(4, '학생증'), html: 화면4(무대.학생증배경) },
    { 파일: 판(5, '장면1'), html: 화면5(무대.연구실) },
  ]);
  for (const r of 결과) console.log(JSON.stringify(r));
  const 나쁨 = 결과.filter((r) => r.화면밖.length || r.겹침.length || r.잘림.length || r.줄밖.length || !r.글꼴);
  if (나쁨.length) { console.error('[T-A] 화면 밖 · 겹침 · 잘림 · 글꼴 문제:', JSON.stringify(나쁨)); process.exit(1); }
  const 판들 = [판(1, `첫화면${입구}`), 판(2, '도착'), 판(3, '이름나라'), 판(4, '학생증'), 판(5, '장면1')];
  for (const 누구 of Object.keys(시험관들)) console.log('[T-A] 시험관 폴더 →', 시험관폴더('시험관', 누구, 판들));
}
