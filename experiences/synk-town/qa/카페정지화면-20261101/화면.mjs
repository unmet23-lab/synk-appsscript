#!/usr/bin/env node
/**
 * 싱크타운 카페 — 가게 정지 화면 3장 (기획 v0.6 §9 1단계 ③, 2026-11-01). 12/1 시연 · 사업계획서용 시안.
 *
 * 하루는 기획 4-3 · 4-4의 「이야기 있는 날」 3일째: 문 열기(소식 읽기 → 메뉴 · 홍보 · 창가 고르기) → (드라마 장면 — 이 묶음 밖)
 * → 카운터(장면에서 「카페로 돌아왔어요」, 핵심 손님과 말하기) → 마감(고른 것이 내일을 바꿈 · 안내문 쓰기 · 다음 이야기).
 * 비 소식(문 열기) → 따뜻한 유자차 · 비 오는 날 홍보 → 비를 피한 손님으로 꽉 참(마감 홀) · 젖은 우산의 교수님(카운터),
 * 박람회 소식 → 창가 모임석 → 내일 오후 동아리 회의 → 내일 안내문(마감 쓰기)으로 한 줄로 잇는다.
 * 겉은 드라마 시범판(experiences/drama/pilot/pilot.css)과 같은 판 — 어두운 촬영장, 실사 무대 + 아래 판, 흰 알약, SUIT.
 * 13-1 「화면 글로 옮길 것」: 유학생 칩(세 장 모두 막대 오른쪽) · 코치 한 줄 소개 · 하루 머리 하나(「3일째」만) · 「카페로 돌아왔어요」 ·
 * 3급이 아는 말(홀 → 가게 안, 붐빔 → 손님이 많아요, 첨삭 → 코치 고침, 코인 → 가게 돈, 글자 조립 → 말 대신 고르기, 학사 → 학교,
 * 공부석 → 공부) · 사다리 한 줄 · 빈칸과 코치 노트를 한 화면에 두지 않음 · 카운터 말 차례(손님 → 내 차례).
 * 카운터 손님은 이야기 있는 날의 측정 손님(4-4 B)이라 상황 카드는 학습자 언어(시안은 시범판처럼 영어 — 회색 「서류용 풀이」는 사업계획서
 * 읽는 분을 위한 것이라 학생 화면에는 넣지 않는다)이고
 * 「말 대신 고르기」는 하루 단위로 문 열기에 둔다(4-3 — 그날은 측정 손님이 오지 않음). 얼굴이 나오는 무대에는 시범판과 같은
 * 「AI로 만든 가상 인물」 표시. 마감의 태오 선배 얼굴은 1화 공개 그림(장면 14 「다음 주 박람회, 약속!」)에서 자른 것.
 *
 *   node experiences/synk-town/qa/카페정지화면-20261101/화면.mjs
 *   → <밖>/화면/01_문열기.png · 02_카운터.png · 03_마감.png (390×844 @2x) + 같은 이름 .html, <밖>/화면/무대/*.jpg(무대 그림)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const { 블록: 폰트블록 } = require(path.join(뿌리, 'tools', 'lib', '브랜드폰트.js'));
const 공용 = 공용작업본(뿌리);
const 밖 = process.env.TOWN_CAFE_OUT || path.join(공용, '.tmp', 'town-cafe-1-20261101');

// 고른 판 — <밖> 기준 경로(qa 아래 .json은 .gitignore가 빼서 여기 둔다). 카운터는 GPT 2.5 「말할 때(부탁)」 바탕
// (표정 묶음은 얼굴합성.py로 같은 바탕에 얼굴만 바꾼 판), 마감 홀은 칸합성.py로 식물 벽만 붙인 판(머리 윤곽 뺌).
export const 고른판 = {
  홀아침: '판/hall-open-gpt_141939.png',
  카운터말할때: 'nb-1106/out/counter-talk4-nb_g1.png', // 11-06 새 교수 얼굴(Gemini) — 옛 GPT 판은 판/counter-talk-gpt_141936.png
  홀마감: '묶음/hall-rain-plant-merged.png',
};

// 무대 그림을 화면 크기 2배 JPEG로 — 그림 하나 100KB 안팎(0단계 실측 65~100KB)
export function 무대만들기(원본, 낼, 폭 = 780) {
  fs.mkdirSync(path.dirname(낼), { recursive: true });
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); w = int(sys.argv[3])
im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS); im.save(sys.argv[2], quality=86, optimize=True, progressive=True)
`, 원본, 낼, String(폭)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('무대 그림 실패: ' + r.stderr);
  return 낼;
}
const 주소 = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;
const 이스 = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
:root{--bg:#060709;--panel:#0C0D10;--s1:#121317;--s2:#191A1F;--s3:#222329;--line:rgba(255,255,255,.08);--line-2:rgba(255,255,255,.15);
--ink:#FAFAF9;--ink-2:rgba(250,250,249,.78);--ink-3:rgba(250,250,249,.58);--ink-4:rgba(250,250,249,.3);
--coral:#F96859;--coral-text:#FFB4A9;--ok:#7DB45A;--check:#FFE08A;--blue:91,134,219;
--glass:rgba(17,18,22,.58);--glass-edge:inset 0 1px 0 rgba(255,255,255,.14),inset 0 0 0 1px rgba(255,255,255,.08);
--sans:'SUIT Variable','SUIT',system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:390px;height:844px;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;font-size:15px;line-height:1.5;letter-spacing:-.006em;word-break:keep-all}
.app{height:844px;display:flex;flex-direction:column}
.bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px 10px;flex:none}
.bar .t{display:flex;align-items:center;gap:8px;font-weight:680;font-size:15px;letter-spacing:-.015em;white-space:nowrap}
.bar .t .sub{color:var(--ink-3);font-weight:560}
.dot{width:8px;height:8px;border-radius:50%;background:var(--coral);box-shadow:0 0 12px var(--coral);flex:none}
.chip{height:30px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;background:var(--s2);box-shadow:var(--glass-edge);font-size:12.5px;font-weight:620;color:var(--ink-2);white-space:nowrap}
.chip.me::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--ok);margin-right:6px}
.stage{position:relative;flex:none;height:var(--h);background:#000 center/cover no-repeat;overflow:hidden}
.vig{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.28),transparent 22%,transparent 50%,rgba(6,7,9,.86) 92%)}
.cap{position:absolute;left:16px;right:16px;bottom:30px;font-size:19px;font-weight:720;line-height:1.35;letter-spacing:-.02em;text-shadow:0 1px 2px rgba(0,0,0,.8),0 0 18px rgba(0,0,0,.45)}
.cap small{display:block;font-size:12px;font-weight:650;color:var(--check);letter-spacing:.01em;margin-bottom:3px}
.cap em{display:block;font-style:normal;font-size:13.5px;font-weight:560;color:var(--ink-2);margin-top:2px}
.gl{position:absolute;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;background:var(--glass);box-shadow:var(--glass-edge);backdrop-filter:blur(14px);font-size:12px;font-weight:620;color:var(--ink);white-space:nowrap}
.gl.tl{top:12px;left:12px}.gl.tr{top:12px;right:12px}.gl.tl2{top:46px;left:12px;height:24px;font-size:11.5px;color:var(--ink-2);background:rgba(17,18,22,.45)}
.gl .back{font-size:13px;color:var(--check)}
.ai{position:absolute;top:46px;right:12px;padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.45);font-size:11px;font-weight:560;color:var(--ink-2);letter-spacing:.01em}
.ai.tl{top:12px;left:12px;right:auto}
.gl.wall{top:auto;bottom:auto}
.subs{position:absolute;left:0;right:0;bottom:30px;padding:0 20px;text-align:center}
.subs .who{display:inline-block;font-size:12px;font-weight:700;color:var(--check);letter-spacing:.02em;margin-bottom:4px}
.subs .ko{font-size:18.5px;font-weight:650;line-height:1.45;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 18px rgba(0,0,0,.6);text-wrap:balance}
.panel{position:relative;z-index:2;flex:1;min-height:0;margin-top:-18px;background:var(--panel);border-radius:22px 22px 0 0;box-shadow:0 -18px 40px rgba(0,0,0,.45);border-top:1px solid var(--line);padding:16px 16px 18px;display:flex;flex-direction:column;gap:9px}
.sec{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sec>span:first-child{font-size:12px;font-weight:700;color:var(--ink-3);letter-spacing:.04em}
.mini{display:flex;gap:6px}
.mini b{height:32px;display:inline-flex;align-items:center;padding:0 10px;border-radius:999px;background:var(--s2);box-shadow:inset 0 0 0 1px var(--line-2);font-size:12px;font-weight:600;color:var(--ink-2)}
.news{list-style:none;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line);border-radius:14px;padding:4px 12px}
.news li{display:flex;gap:10px;align-items:baseline;padding:7px 0}
.news li+li{border-top:1px solid var(--line)}
.news .tag{flex:none;width:68px;font-size:11.5px;font-weight:700;color:var(--ink-3)}
.news p{font-size:14px;font-weight:560;line-height:1.4}
.q{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:700;color:var(--ink-2)}
.picks{display:flex;flex-wrap:wrap;gap:6px}
.pick{height:34px;display:inline-flex;align-items:center;gap:5px;padding:0 12px;border-radius:999px;background:var(--s2);box-shadow:inset 0 0 0 1px var(--line-2);font-size:13.5px;font-weight:580;color:var(--ink-2)}
.pick.on{background:var(--ink);color:#08090C;font-weight:720;box-shadow:none}
.pick.on::before{content:'✓';font-weight:800}
.radios{display:flex;flex-direction:column;gap:6px}
.r{display:flex;align-items:center;gap:9px;height:36px;padding:0 12px;border-radius:12px;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line);font-size:13.5px;font-weight:560;color:var(--ink-2)}
.r::before{content:'';width:15px;height:15px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--ink-4);flex:none}
.r.on{box-shadow:inset 0 0 0 1.5px var(--ink);color:var(--ink);font-weight:650}
.r.on::before{box-shadow:inset 0 0 0 4.5px var(--ink)}
.seg{display:inline-flex;padding:3px;border-radius:999px;background:var(--s2);box-shadow:inset 0 0 0 1px var(--line-2)}
.seg span{height:32px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;font-size:13px;font-weight:600;color:var(--ink-3)}
.seg span.on{background:var(--ink);color:#08090C;font-weight:720}
.fine{font-size:12.5px;color:var(--ink-3)}
.pill{height:52px;width:100%;border:0;border-radius:999px;background:var(--ink);color:#08090C;font:inherit;font-weight:750;font-size:16.5px;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:auto;flex:none}
.help{display:flex;gap:6px}
.help b{flex:1;height:38px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;background:var(--s2);box-shadow:inset 0 0 0 1px var(--line-2);font-size:13.5px;font-weight:620;color:var(--ink)}
.play{width:0;height:0;border-left:8px solid currentColor;border-top:5px solid transparent;border-bottom:5px solid transparent}
.card{border-radius:14px;padding:11px 13px;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line)}
.card .lab{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:720;color:var(--ink-3);letter-spacing:.03em;margin-bottom:3px}
.card p{font-size:14.5px;font-weight:560;line-height:1.45}
.card.sit{background:linear-gradient(180deg,rgba(var(--blue),.13),rgba(var(--blue),.05));box-shadow:inset 0 0 0 1px rgba(var(--blue),.3)}
.card.sit .lab{color:#A9C1F2}
.card.sit .lead{font-size:12.5px;font-weight:560;color:var(--ink-2);margin-bottom:5px}
.card.sit .en{font-size:14.5px;font-weight:600;line-height:1.45}
.card.sit .gloss{font-size:12.5px;font-weight:500;color:var(--ink-3);margin-top:4px;line-height:1.45}
.turn{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:var(--ink);margin-top:2px}
.live{width:8px;height:8px;border-radius:50%;background:var(--coral);box-shadow:0 0 0 4px rgba(249,104,89,.22)}
.rec{height:56px;border-radius:999px;background:var(--ink);color:#08090C;font-weight:780;font-size:17px;display:flex;align-items:center;justify-content:center;gap:10px;flex:none}
.rec i{width:14px;height:14px;border-radius:50%;background:var(--coral);box-shadow:0 0 0 4px rgba(249,104,89,.22)}
.alt{text-align:center;font-size:12.5px;color:var(--ink-3)}
.alt u{text-underline-offset:3px;color:var(--ink-2)}
.cause{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:baseline;background:var(--s1);box-shadow:inset 0 0 0 1px var(--line);border-radius:14px;padding:10px 13px}
.cause .from{font-size:12px;font-weight:720;color:var(--ink);background:var(--s3);border-radius:999px;padding:2px 9px;white-space:nowrap}
.cause p{font-size:14px;font-weight:560;line-height:1.42}
.memo{font-size:13.5px;color:var(--ink-3);margin-bottom:6px}
.mine-lab{display:block;font-size:11.5px;font-weight:720;color:var(--ink-3);letter-spacing:.03em;margin-bottom:3px}
.mine{font-size:14.5px;font-weight:600;background:var(--s2);border-radius:10px;padding:7px 10px;box-shadow:inset 0 0 0 1px var(--line-2)}
.card.coach{background:rgba(255,224,138,.06);box-shadow:inset 0 0 0 1px rgba(255,224,138,.22)}
.card.coach .lab{color:var(--check)}
.card.coach .lab .who{color:var(--ink-3);font-weight:600;letter-spacing:0}
.fix{display:inline-block;margin-top:3px;color:var(--ink);font-weight:650}
.fix b{color:var(--check);font-weight:780}
.next{border-radius:14px;padding:10px 13px;background:linear-gradient(135deg,rgba(249,104,89,.16),rgba(249,104,89,.03));box-shadow:inset 0 0 0 1px rgba(249,104,89,.25)}
.next .lab{font-size:11.5px;font-weight:720;color:var(--coral-text);letter-spacing:.03em}
.next p{font-size:14.5px;font-weight:600;line-height:1.42}
.next .row{display:flex;align-items:center;gap:11px}
.thumb{width:44px;height:44px;border-radius:50%;flex:none;background:#222 center/cover no-repeat;box-shadow:0 0 0 2px rgba(249,104,89,.35)}
.ladder{display:flex;align-items:center;gap:6px;padding:0 4px;font-size:13px;color:var(--ink-3)}
.ladder b{color:var(--ink);font-weight:720}
.ar{display:inline-block;width:15px;height:10px;flex:none;vertical-align:1px}
.ladder .now{color:#08090C;background:var(--ink);border-radius:999px;padding:1px 8px;font-weight:760}
`;

function 쪽(제목, 몸) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=390"><title>${이스(제목)}</title>${폰트블록()}<style>${CSS}</style></head><body><div class="app">${몸}</div></body></html>`;
}
const 화살 = '<svg class="ar" viewBox="0 0 15 10" aria-hidden="true"><path d="M1 5h12M9 1.5 12.5 5 9 8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const 막대 = (오른) => `<div class="bar"><div class="t"><i class="dot"></i>동아리 카페<span class="sub">· 3일째</span></div>${오른}</div>`;

export function 문열기(무대) {
  return 쪽('문 열기', `${막대('<span class="chip me">나 · 유학생 매니저</span>')}
<div class="stage" style="--h:206px;background-image:url('${무대}');background-position:50% 24%"><div class="vig"></div>
 <div class="cap"><small>아침 8:50 · 문 열기 전</small>오늘 소식을 읽고 가게를 준비해요</div></div>
<div class="panel">
 <div class="sec"><span>오늘 소식</span><span class="mini"><b>뜻 보기</b><b>짧게 보기</b></span></div>
 <ul class="news">
  <li><span class="tag">날씨</span><p>오후 4시부터 비가 와요. 쌀쌀해요.</p></li>
  <li><span class="tag">학생 게시판</span><p>오늘 오후 2시, 학생회관 앞에서 동아리 박람회!</p></li>
  <li><span class="tag">학교 공지</span><p>중앙도서관 3층은 금요일까지 공사 중입니다.</p></li>
 </ul>
 <div class="sec" style="margin-top:3px"><span>오늘 고르기</span><span class="fine">소식에 맞게 고르면 손님이 더 와요</span></div>
 <div class="q">메뉴 두 가지</div>
 <div class="picks"><span class="pick on">따뜻한 유자차</span><span class="pick">아이스 아메리카노</span><span class="pick">딸기 라떼</span><span class="pick on">햄치즈 샌드위치</span></div>
 <div class="q">홍보 한 줄</div>
 <div class="radios"><span class="r on">비 오는 날, 따뜻한 차 한 잔</span><span class="r">도서관 대신 조용한 창가에서 공부해요</span></div>
 <div class="q">창가 자리<span class="seg"><span>공부</span><span class="on">모임</span></span></div>
 <p class="fine">어떻게 골라도 잃는 것은 없어요. 더 오거나, 다른 손님이 올 뿐이에요.</p>
 <div class="pill">문 열기</div>
 <p class="alt">소리 내기 어려운 곳이면 · <u>오늘은 말 대신 고르기</u></p>
</div>`);
}

export function 카운터(무대, 손님말 = '비가 갑자기 와서요… 잠깐 앉았다 가도 될까요? 짐이 많아서요.') {
  return 쪽('카운터', `${막대('<span class="chip me">나 · 유학생 매니저</span>')}
<div class="stage" style="--h:478px;background-image:url('${무대}');background-position:50% 12%"><div class="vig"></div>
 <div class="gl tl"><span class="back">↩</span>박람회 장면이 끝났어요 · 카페로 돌아왔어요</div>
 <div class="gl tl2">오후 4:30 · 오늘 이야기할 손님 2명 중 첫째</div>
 <span class="ai">AI로 만든 가상 인물</span>
 <div class="subs"><span class="who">문지영 교수님</span><p class="ko">${이스(손님말)}</p></div></div>
<div class="panel">
 <div class="help"><b><i class="play"></i>다시 듣기</b><b>천천히</b><b>뜻 보기</b></div>
 <div class="card sit"><span class="lab">새 상황</span><p class="lead">이번엔 대사 카드가 없어요. 상황만 보고 내 말로 말해 봐요.</p>
  <p class="en">Professor Moon came in out of the rain with a wet umbrella and a heavy bag of books. Answer her question, then tell her how you'll help.</p>
  <p class="gloss">서류용 풀이 · 교수님이 젖은 우산과 무거운 책가방을 들고 들어오셨어요. 질문에 대답하고, 어떻게 도울지 말해요.</p></div>
 <div class="turn"><i class="live"></i>내 차례 — 교수님께 대답해요</div>
 <div class="rec"><i></i>말하기</div>
</div>`);
}

export function 마감(무대, 태오) {
  return 쪽('마감', `${막대('<span class="chip me">나 · 유학생 매니저</span>')}
<div class="stage" style="--h:222px;background-image:url('${무대}');background-position:50% 30%"><div class="vig"></div>
 <span class="ai tl">AI로 만든 가상 인물</span>
 <div class="gl tr">새로 바꾼 벽 · 오늘 번 가게 돈으로</div>
 <div class="cap"><small>저녁 6:00 · 마감</small>비가 와서 손님이 꽉 찼어요<em>따뜻한 유자차는 다 팔렸어요</em></div></div>
<div class="panel">
 <div class="sec"><span>오늘 고른 것 ${화살} 내일</span></div>
 <div class="cause"><span class="from">창가 · 모임 자리</span><p>박람회에서 만난 동아리 사람들이 내일 오후에 창가에서 회의하고 싶대요.</p></div>
 <div class="card"><span class="lab">내일 안내문 · 손님께 드리는 말로</span>
  <p class="memo">동아리 메모: 내일 창가 자리 오전만 사용 가능(오후 회의)</p>
  <span class="mine-lab">내가 쓴 안내문</span>
  <p class="mine">내일 오후에는 창가에서 동아리 회의가 있어요. 창가 자리는 오전에만 이용하실 수 있어요.</p></div>
 <div class="card coach"><span class="lab"><i class="play"></i>코치 <span class="who">· 이야기 밖에서 내 한국어를 도와줘요</span></span>
  <p>좋아요. 손님께 드리는 안내문은 「-습니다」로 끝내면 더 알맞아요.<br><span class="fix">… 회의가 있<b>습니다</b>. … 이용하실 수 있<b>습니다</b>.</span></p></div>
 <div class="next"><div class="row"><i class="thumb" style="background-image:url('${태오}')"></i><div><span class="lab">다음 이야기</span><p>박람회에 데려가 준 태오 선배가 꼭 할 말이 있대요.</p></div></div></div>
 <div class="ladder">내 자리 · 알바 ${화살} <span class="now">매니저</span> ${화살} 동아리 운영진</div>
 <div class="pill">오늘 끝</div>
</div>`);
}

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
        const 판 = document.querySelector('.panel');
        const 넘침 = 판.scrollHeight - 판.clientHeight;
        const 밖 = [...document.querySelectorAll('.panel > *')].filter((e) => e.getBoundingClientRect().bottom > 844.5).map((e) => e.className || e.tagName);
        const 글꼴 = document.fonts.check("15px 'SUIT Variable'");
        return { 넘침, 밖, 글꼴, 판높이: Math.round(판.getBoundingClientRect().height) };
      });
      fs.mkdirSync(path.dirname(파일), { recursive: true });
      await 쪽_.screenshot({ path: 파일 });
      fs.writeFileSync(파일.replace(/\.png$/, '.html'), html);
      결과.push({ 파일: path.basename(파일), ...잼 });
    }
  } finally {
    await 브.close();
  }
  return 결과;
}

// 다른 스크립트가 불러 쓸 때는 돌지 않게 — 이름 끝만 보면 「…화면.mjs」 꼴 스크립트에서도 돌았다
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 무대폴더 = path.join(밖, '화면', '무대');
  const 무대 = Object.fromEntries(Object.entries(고른판).map(([k, v]) => [k, 무대만들기(path.join(밖, v), path.join(무대폴더, `${k}.jpg`))]));
  const 결과 = await 찍기([
    { 파일: path.join(밖, '화면', '01_문열기.png'), html: 문열기(주소(무대.홀아침)) },
    { 파일: path.join(밖, '화면', '02_카운터.png'), html: 카운터(주소(무대.카운터말할때)) },
    { 파일: path.join(밖, '화면', '03_마감.png'), html: 마감(주소(무대.홀마감), 주소(path.join(밖, '판', 'taeo-thumb.jpg'))) },
  ]);
  for (const r of 결과) console.log(JSON.stringify(r));
  const 나쁨 = 결과.filter((r) => r.넘침 > 0 || r.밖.length || !r.글꼴);
  if (나쁨.length) { console.error('[화면] 넘침 · 화면 밖 · 글꼴 문제:', JSON.stringify(나쁨)); process.exit(1); }
}
