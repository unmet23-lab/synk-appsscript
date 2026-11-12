#!/usr/bin/env node
'use strict';
/* 올리기 전 검사(2026-10-21) — 1일 1편 편 폴더 하나의 올릴 묶음을 명령 하나로 본다. 영상·글은 바꾸지 않는다.
 *
 *   node tools/올리기전검사.js <편 폴더> [--json] [--저장안함] [--링크건너뛰기] [--글자인식건너뛰기]
 *
 * 묶은 검사(게시/준비.json의 판마다, 같은 영상 파일은 한 번):
 *   ① 영상사전검사(tools/영상사전검사.mjs) — 디코드·프레임 시각·소리 길이, 올림 화질(1080 이상이면 8Mbps·H.264·yuv420p, v2 §2-4)
 *   ② 정지 구간(tools/정지구간.js) — 거의 멈춘 시간 15% 이하, 끝 화면 말고 1.5초 넘는 정지 없음
 *   ③ 끝 화면 길이 — 마지막 컷부터 끝까지 2.5~6초(v2 §2-4 「끝 화면은 4초 안팎」)
 *   ④ 음량 — 공용 기준(tools/음량마감.mjs DEFAULTS) −14.5 LUFS ±0.5 · 최대 −1.2 dBFS
 *   ⑤ 글자·안전 영역 — 영상 0.5초마다와 표지를 윈도우 글자 인식(tools/lib/글자인식.ps1)으로 읽어, SNS 키트 cover916 안전 영역
 *      (1080×1920 기준 x 65~920 · y 269~1428, 키트를 따른 Remotion 편과 같은 값)과 작은 글자를 본다(tools/SNS키트굽기.js의 기준).
 *      준비.json에 「키트원고」(SNS 키트 원고 HTML)가 있으면 tools/SNS키트굽기.js 검사를 그대로 돌린다.
 *   ⑥ 게시글 규칙(tools/lib/게시글규칙.js) — 첫 125자 훅, 인스타 해시태그 5개, 상대 날짜·내부 번호·도구 이름, 플랫폼 한도,
 *      블로그·링크드인 원고의 숫자가 영상(화면 글·나레이션)·게시글과 맞는지
 *   ⑦ 올릴 칸 — 원본 파일(화질 낮춘 사본 아님), 유튜브 제목·언어·아동용 아님, AI 표시, 시각·슬롯·시한, 글 속 링크 응답 200
 *   ⑧ 가져갈 프롬프트(10-22, yuhobuilds만) — 준비.json 「프롬프트」가 없으면 확인할 것, 있으면 synk.im/prompts 응답 200과 그 항목이 공개본에 있는지
 *   ⑨ 틱톡 판(10-26, 제작 절차 4) — 인스타 영상 판에 짝 틱톡 판이 없거나(「틱톡없음」에 까닭이 없을 때), 틱톡 판이 키워드 DM 인스타 판 ·
 *      고정 댓글 유튜브 판과 같은 영상이면(끝 말이 틱톡에 없는 길을 가리킬 수 있다) 확인할 것
 *   ⑩ 매일 판(10-26) — 판 계정의 줄(sns-계정.json dailyLine)마다 그 줄의 (막힘 아닌) 계정 가운데 판이 없는 계정이면 확인할 것.
 *      못 가는 판(여러 장 편의 틱톡 · 그날 이미 다른 편이 찬 계정)은 준비.json 「빠진판」: {"계정": "까닭"}에 적는다(「틱톡없음」도 받는다).
 *      11-10 LAB 39계정: 돌림 판(판 「돌림」: true, tools/돌림표.js)과 「LAB 나라별」 줄은 그 줄의 모든 계정으로 보지 않고, 판마다 현지 칸 형식 ·
 *      판본 파일 · 판본 검수 지문(뜻 · 글자 — 고치면 무효) · 씨앗 아닌 계정의 프로필 · 예약 경로 확인을 고칠 것으로 본다(설계 1 · 4 · 5 · 22)
 *   ⑪ 슬롯이 오늘이면 확인할 것 — 4일 앞(D+4)에 만드는 것이 기본(제작 절차 0). 같은 날 같은 계정의 두 편은 tools/예약큐.js가 본다
 *   ⑫ 한 편의 같은 플랫폼 판 둘(몽골 @synk.mn · 버마어 @synklab.mm 틱톡 등)이 20시간 안이면 고칠 것(10-26 — 거의 같은 영상이 같은 날 두 계정에
 *      나가지 않게. 11-10부터 시간대가 25개라 한국 날짜 대신 20시간, 틱톡 말고 같은 플랫폼 모두 — 유튜브는 같은 언어 판끼리만).
 *      LAB 두 채널 판 · 돌림 판은 계정마다 날을 따로 두니 편 슬롯과 날이 달라도 「시각이 슬롯 날이 아니다」를 내지 않는다
 *   ⑬ 한 구성(10-28, tools/한구성.js) — 끝 화면 말고 같은 구성(글 강조 · 테 · 밝기만 바뀜)이 4초를 넘으면 고칠 것. ②는 프레임 차이라
 *      LAB E8의 10초 흑백 글 카드를 정지 0%로 넘겼다
 *   ⑭ 목소리(10-28) — 편 폴더의 나레이션 줄 파일(나레이션굽기 vo.json 줄 · remotion/public/vo, 또는 준비.json 「목소리」에 적은 폴더)마다
 *      최고 음높이 560Hz 넘음 · Typecast 원본 잘림 · 영상보다 새 줄 파일(다시 산 목소리가 렌더에 안 들어감)을 고칠 것으로.
 *      ⑤에 더해 판 · 테두리 · 그림자 없이 그림 위에 바로 얹은 흰 글자(흰 기본 글자)도 고칠 것이다
 *   ⑮ 원본과 나란히(10-28, tools/오마주.js — 제작 절차 「오마주」) — 편 폴더 오마주.json의 원본 박자 · 뼈대와 우리 영상을 같은 셈으로 견줘
 *      뼈대(길이 · 칸 수 · 첫 2초 · 박자 · 반전 · 끝 자리)가 어긋나면 고칠 것 — 완전 일치는 보지 않는다(유호님 10-28 「완전 똑같이 할 필요는
 *      없어」, 오마주.json 「다르게」에 무엇 · 까닭을 적은 항목은 확인할 것). 원본 컷을 눈으로
 *      「확정」하지 않았으면 확인할 것. 10-29부터 만든 편 폴더(이름 끝 날짜)에 오마주.json도 준비.json 「원본없음」 까닭도 없으면 고칠 것.
 *      나란히가 「다르게」 없이 다 맞고 원본 컷을 확정했으면, 원본도 같은 자리에서 멈췄거나 한 구성이 긴 ② · ⑬은 확인할 것으로 내린다 — 10-28 첫 예시(283만 회 원본)는
 *      67%가 멈춘 정지 장면 아홉 칸이었다
 *   ⑯ 지난 편 되풀이(10-30, tools/무대반복.js — 제작 절차 「한 장면 먼저」) — 판 계정마다 그 계정의 지난 두 편과 무대(첫 · 끝 장면 축소판이
 *      둘 다 닮음)나 끝 줄(끝 장면 화면 글 · 나레이션 마지막 줄 · 준비.json 「끝줄」)이 같으면 고칠 것, 한쪽 장면만 닮거나 끝 줄이 비슷하면
 *      확인할 것 — 10-28 · 29 B8 · B14가 같은 청금석 틀에 같은 끝 줄로 이틀 잇달아 나갔다
 *   ⑰ 소리 빈자리(10-31, tools/소리빈자리.js) — 처음 · 끝 0.4초 말고 −62 dB 아래가 0.25초 넘게 이어지는 자리의 합이 4초를 넘고 가장 긴 자리가
 *      1초를 넘으면 고칠 것, 하나만 넘으면 확인할 것 — 18초 배경음이 끝나 말 사이가 빈 M19 · E17이 ④ 음량을 넘겨 예약까지 갔다
 *   ⑱ 미학 맹검(11-08, 11-12부터 권고 — 판정 tools/lib/미학관문.js) — 막지 않는다. 편 폴더 게시/미학맹검.json(node tools/미학맹검.js <대표 프레임 · 카드…>
 *      --편 <편 폴더>)이 없으면 확인할 것 한 줄, 있으면 「기각」 · 「고쳐서 냄」 고칠 목록을 확인할 것으로 보인다 — 고친 뒤 다시 맹검하지 않는다.
 *      11-08~11-11의 막음(맹검 뒤 영상 바뀜 · 답 빠짐 · 대체 눈 · 「맹검판단」 · 「맹검못함」 글)은 SYNK_미학관문=막음일 때만 돈다
 *   ⑲ 배경음 층(11-08, tools/음악층.js · 판정 tools/lib/음악층관문.js) — Remotion 음악(bgm.*)을 쓰는 편은 음악만 렌더해 잰 게시/음악층.json으로
 *      음악이 꺼지는 자리(가운데보다 6dB 넘게 낮은 채 0.75초 넘게 · 그 안에 10dB 넘게 꺼진 칸)가 있으면 고칠 것(「음악꺼짐판단」에 까닭이 있으면 확인할 것),
 *      얇아짐 · 음악 바닥이 전체보다 12dB 넘게 작음은 확인할 것. 11-09부터 만든 편은 잰 기록이 없으면 고칠 것(못 재면 「음악층못함」) —
 *      11-08 유호님 「백그라운드 뮤직 … 중간중간 좀 빠져있는데」: 보유곡 밝은_052를 16초부터 자른 편마다 13~14초에 곡 안 빈 마디가 들어갔다
 *
 * 「고칠 것」은 올리기 전에 꼭 고칠 것(서버·API가 거절하거나 기준을 어김), 「확인할 것」은 기계가 확신하지 못해 눈으로 볼 것이다.
 * 결과는 그 편 게시/준비.json의 「검사」 칸에 남긴다(--저장안함이면 안 남김). 영상마다 크기·수정 시각·SHA-256을 같이 적어 두어,
 * 검사 뒤 파일이 바뀌면 tools/예약큐.js·tools/작업실예약.js가 「다시 검사」로 본다. 영상사전검사 검토 클립과 걸린 장면 그림은
 * .tmp/올리기전검사/<편>/에 남는다. 종료 코드: 고칠 것 1 · 확인할 것만 또는 통과 0 · 사용법 오류 2.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const 묶음 = require('./lib/게시묶음.js');
const 규칙 = require('./lib/게시글규칙.js');
const 정지 = require('./정지구간.js');
const 한구성 = require('./한구성.js');
const 소리빈자리 = require('./소리빈자리.js');
const 타입캐스트 = require('./lib/타입캐스트.cjs');
const 오마주 = require('./오마주.js');
const 반복 = require('./무대반복.js');
const { aestheticFindings, AESTHETIC_FROM } = require('./lib/미학관문.js');
const { musicLayerFindings } = require('./lib/음악층관문.js');
const T = require('./lib/계정시간.js');
const 돌림표 = require('./돌림표.js');
const 장부 = require('./게시장부.js');
const 그림검사 = require('./그림검사.js');
const { FORMATS } = require('./lib/돌림.js'); // 이야기 · 노래 · 퀴즈(21:00 칸은 11-10 밤부터 노래)
const { 미디어경로 } = require('./lib/공용작업본.js');

const { FIX, LOOK } = 규칙;
const SAFE = { left: 65, right: 920, top: 269, bottom: 1428 };
const TOLERANCE = 6;
const SMALL_TEXT = 16; // 글자 상자 높이(1080 폭 기준). 키트 최소 24px 글자는 상자가 18~22px쯤이다.
const END_CARD = [2.5, 6];
const FRAME_STEP = 0.5;
const API_PLATFORMS = new Set(['youtube', 'instagram', 'facebook']);
// 인스타 영상 판 → 같은 말을 쓰는 틱톡 계정(10-26 유호님 「틱톡 4계정도 매일」). 버마어 lab-mm-tiktok은 LAB 두 채널 판이 따로 만든다.
const TIKTOK_PAIR = { 'yuhobuilds-instagram': 'yuhobuilds-tiktok', 'synkbrief-instagram': 'synkbrief-tiktok', 'lab-instagram': 'lab-tiktok' };
const SERVER_YOUTUBE_LIMIT = 100 * 1024 * 1024;
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const DONE = new Set(['예약됨', '게시됨']);

function kst(ms = Date.now()) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, '+09:00');
}

function norm(text) {
  return String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// ── 글자 인식 ──
function ocrFolder(dir) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'lib', '글자인식.ps1'), '-Dir', dir],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout: 600000 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(String(r.stderr || '').trim().slice(0, 300) || `종료 코드 ${r.status}`);
  const text = String(r.stdout || '').replace(/^\uFEFF/, '').trim();
  return text ? [].concat(JSON.parse(text)) : [];
}

// 한국어 엔진이 무늬·그림을 글자로 잘못 읽으면 드문 한자가 섞인 줄이 나온다. 중국어·일본어판이 아니면 그런 줄은 뺀다.
function looksLikeText(text, allowHan) {
  const chars = [...String(text).replace(/\s/g, '')];
  if (chars.length < 2) return false;
  const han = chars.filter((c) => /\p{Script=Han}/u.test(c)).length;
  return allowHan || han / chars.length <= 0.2;
}

// 그림 하나의 글자 줄을 1080×1920 좌표로: [{ text, x0, y0, x1, y1, h, box(원본 픽셀) }]
function linesOf(image, { allowHan = false } = {}) {
  const sx = 1080 / image.width, sy = 1920 / image.height;
  const out = [];
  for (const line of [].concat(image.lines || [])) {
    const words = [].concat(line.words || []).filter((w) => w && w.w > 0 && w.h > 0);
    const text = String(line.text || '').trim();
    if (!words.length || norm(text).length < 2 || !looksLikeText(text, allowHan)) continue;
    const box = { x: Math.min(...words.map((w) => w.x)), y: Math.min(...words.map((w) => w.y)) };
    box.w = Math.max(...words.map((w) => w.x + w.w)) - box.x;
    box.h = Math.max(...words.map((w) => w.y + w.h)) - box.y;
    const h = Math.max(...words.map((w) => w.h)) * sy;
    if (h < 9) continue; // 9px 아래 상자는 거의 늘 무늬다
    out.push({ text, x0: box.x * sx, y0: box.y * sy, x1: (box.x + box.w) * sx, y1: (box.y + box.h) * sy, h, box });
  }
  return out;
}

const KINDS = { right: '오른쪽 단추 자리', bottom: '아래 앱 글자 자리', top: '위 머리 자리', left: '왼쪽 가장자리', small: '작은 글자',
  white: '흰 기본 글자(판 · 테두리 없이 그림 위)', whiteShort: '판 없이 그림 위에 얹은 짧은 밝은 글자',
  whiteShot: '화면 캡처 속 흰 글자(준비.json 「화면캡처」 구간 — 우리가 얹은 글이 아닌지 눈으로 본다)' };
const FIX_KINDS = new Set(['white']);

// ⑤-3 화면 캡처 속 흰 글자(11-01) — AI가 만든 화면(웹 페이지 · 앱) 캡처를 그대로 보여 주는 편은 그 화면 안의 흰 제목 · 본문이
// ⑤-2에 걸린다(yuhobuilds Y29 — 남색 · 빨간 바탕 홈페이지 캡처의 글 9군데). 그 글은 우리가 얹은 글이 아니라 보여 주려는 화면이다.
// 준비.json 「화면캡처」: {"까닭": "…", "구간": [[시작초, 끝초], …]}에 적은 구간 안에서만 보인 줄은 고칠 것에서 확인할 것으로 내리고
// 까닭을 같이 적는다. 구간 밖에서 한 번이라도 보인 줄과 다른 종류(안전 영역 · 작은 글자 · 짧은 밝은 글자)는 그대로다. 편의 영상 모두에 쓴다.
function shotRanges(prep) {
  const v = prep ? prep.화면캡처 : undefined;
  if (v === undefined) return { ranges: [], 까닭: '', error: null };
  const 까닭 = v && typeof v.까닭 === 'string' ? v.까닭.trim() : '';
  const ranges = v && Array.isArray(v.구간) ? v.구간 : [];
  const ok = 까닭 && ranges.length && ranges.every((r) => Array.isArray(r) && r.length === 2 && r.every((t) => Number.isFinite(t)) && r[0] >= 0 && r[0] < r[1]);
  if (!ok) return { ranges: [], 까닭: '', error: '준비.json 「화면캡처」는 {"까닭": "…", "구간": [[시작초, 끝초], …]} 꼴이어야 한다 — 이번 검사에는 쓰지 않았다' };
  return { ranges, 까닭, error: null };
}
const inShot = (times, ranges) => times.length > 0 && times.every((t) => ranges.some(([a, b]) => t >= a && t <= b));

// ⑤-2 흰 기본 글자(10-28) — 판(글 상자) · 테두리 · 그림자 없이 그림 위에 바로 얹은 흰 글자. LAB E8 끝 화면의 흰 글 넉 줄이 바리스타
// 머리 위에 겹쳐 휴대폰에서 잘 안 읽혔다(10-28 점검). 글자 줄 상자(540×960 회색) 안에서 흰 칸(215 이상)이 5~42%이고, 흰 칸 둘레 2칸
// 가운데 어두운 칸(80 미만 — 외곽선 · 그림자)이 절반이 안 되며, 나머지 바탕이 그림처럼 얼룩지면(표준편차 25~60) 걸린다.
// 판 위 흰 글자는 바탕이 고르고(어두운 판 6~16, 색 판 0), 흰 판 · 도장 · 말풍선은 흰 칸이 43% 넘게, 밝은 판에 어두운 글자는 바탕
// 표준편차가 70 넘게 나와 걸리지 않는다(E8 · 퀴즈 #5 실측). 노란 글자처럼 밝은 글자도 판 없이 그림 위면 같이 걸린다.
// 고칠 것은 6자 넘는 줄이 1초 넘게 머물고 둘레 어두운 칸이 45% 아래일 때만이고, 짧은 낱말 · 잠깐 지나가는 줄(퀴즈 「NOPE!」 도장,
// 화면 속 앱 단추) · 그림자가 반쯤 있는 줄(E8 첫 화면 제목 48%) · 잘못 읽은 줄은 확인할 것이다.
const WHITE = 215;
function plainWhite(gray, w, h, line) {
  const s = w / 1080;
  const x0 = Math.max(0, Math.floor(line.x0 * s)), x1 = Math.min(w, Math.ceil(line.x1 * s));
  const y0 = Math.max(0, Math.floor(line.y0 * s)), y1 = Math.min(h, Math.ceil(line.y1 * s));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 8 || bh < 6) return null;
  const at = (x, y) => gray[(y0 + y) * w + x0 + x];
  const bright = new Uint8Array(bw * bh);
  let nb = 0;
  for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) if (at(x, y) >= WHITE) { bright[y * bw + x] = 1; nb += 1; }
  const frac = nb / (bw * bh);
  if (frac < 0.05 || frac > 0.42) return { frac, plain: false };
  const near = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) {
    if (!bright[y * bw + x]) continue;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && !bright[yy * bw + xx]) near[yy * bw + xx] = 1;
    }
  }
  let ring = 0, dark = 0, n = 0, sum = 0, sq = 0;
  for (let y = 0; y < bh; y += 1) for (let x = 0; x < bw; x += 1) {
    const i = y * bw + x, v = at(x, y);
    if (bright[i]) continue;
    if (near[i]) { ring += 1; if (v < 80) dark += 1; continue; }
    n += 1; sum += v; sq += v * v;
  }
  const ringDark = ring ? dark / ring : 0;
  const bgMean = n ? sum / n : 0;
  const bgStd = n ? Math.sqrt(Math.max(0, sq / n - bgMean * bgMean)) : 0;
  return { frac, ringDark, bgMean, bgStd, plain: n >= 20 && ringDark < 0.5 && bgStd >= 25 && bgStd < 60 };
}

// 0.5초마다(글자 인식과 같은 장면) 540×960 회색 프레임 → { w, h, frame(i) }
function grayFrames(file) {
  const w = 540, h = 960;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=${1 / FRAME_STEP},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-'],
    { windowsHide: true, maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('회색 장면 뽑기 실패: ' + String(r.stderr || '').trim().slice(0, 200));
  const buf = r.stdout;
  return { w, h, frame: (i) => ((i + 1) * w * h <= buf.length ? buf.subarray(i * w * h, (i + 1) * w * h) : null) };
}

function problemsOf(line) {
  const out = [];
  if (line.x1 > SAFE.right + TOLERANCE) out.push({ kind: 'right', text: `오른쪽 끝 ${Math.round(line.x1)}px(안전선 ${SAFE.right})` });
  if (line.y1 > SAFE.bottom + TOLERANCE) out.push({ kind: 'bottom', text: `아래 끝 ${Math.round(line.y1)}px(안전선 ${SAFE.bottom})` });
  if (line.y0 < SAFE.top - TOLERANCE) out.push({ kind: 'top', text: `위 끝 ${Math.round(line.y0)}px(안전선 ${SAFE.top})` });
  if (line.x0 < SAFE.left - TOLERANCE) out.push({ kind: 'left', text: `왼쪽 끝 ${Math.round(line.x0)}px(안전선 ${SAFE.left})` });
  if (line.h < SMALL_TEXT) out.push({ kind: 'small', text: `글자 상자 ${Math.round(line.h)}px(키트 최소 24px 글자는 약 18px)` });
  return out;
}

// 걸린 장면에 빨간 상자를 그려 한 장(가로 6칸)으로 모은다. 사람이 이 한 장만 보고 넘기거나 고친다.
function sheet(frames, dir, file) {
  if (!frames.length) return null;
  const parts = [];
  frames.slice(0, 12).forEach(({ name, boxes }, i) => {
    const part = path.join(dir, `_칸${String(i).padStart(2, '0')}.jpg`);
    const draw = boxes.map((b) => `drawbox=x=${Math.max(0, b.x - 6)}:y=${Math.max(0, b.y - 6)}:w=${b.w + 12}:h=${b.h + 12}:color=red@0.9:t=8`);
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, name), '-vf', [...draw, 'scale=270:-2'].join(','), part], { windowsHide: true });
    if (r.status === 0) parts.push(part);
  });
  if (!parts.length) return null;
  const cols = Math.min(6, parts.length), rows = Math.ceil(parts.length / cols);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, '_칸%02d.jpg'), '-vf', `tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', file], { windowsHide: true });
  parts.forEach((p) => fs.rmSync(p, { force: true }));
  return r.status === 0 ? file : null;
}

// 영상 장면: 0.5초마다 뽑아 읽는다. 같은 글이 같은 자리에 두 장면 넘게(0.5초 넘게) 머문 것만 센다 — 들어오고 나가는 움직임은 뺀다.
// 결과는 걸린 종류마다 한 줄(몇 군데, 예 둘)과 빨간 상자를 그린 장면표 한 장이다. 화면 속 캡처 그림의 작은 글자도 걸리니 눈으로 가린다.
function ocrVideo(file, dir, label, { allowHan, repo, sheetFile: sheetPath, shots = { ranges: [], 까닭: '' } }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-vf', `fps=${1 / FRAME_STEP}`, '-q:v', '3', path.join(dir, 'f%04d.jpg')],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('장면 뽑기 실패: ' + String(r.stderr || '').trim().slice(0, 200));
  const images = ocrFolder(dir);
  const seen = new Map();
  const all = new Map(); // 걸리지 않은 줄까지 — 흰 기본 글자는 장면 그림을 봐야 안다
  const texts = [];
  for (const image of images) {
    const t = (Number(String(image.name).match(/(\d+)/)[1]) - 1) * FRAME_STEP;
    for (const line of linesOf(image, { allowHan })) {
      texts.push(line.text);
      const key = `${norm(line.text).slice(0, 20)}|${Math.round(line.x0 / 24)}|${Math.round(line.y0 / 24)}`;
      const one = all.get(key) || { text: line.text, line, times: [], frames: [], box: line.box };
      one.times.push(t);
      one.frames.push(image.name);
      all.set(key, one);
      const problems = problemsOf(line);
      if (!problems.length) continue;
      const item = seen.get(key) || { text: line.text, problems, times: [], frames: [], box: line.box };
      item.times.push(t);
      item.frames.push(image.name);
      seen.set(key, item);
    }
  }
  const isSteady = (item) => item.times.some((t, i) => i > 0 && Math.abs(t - item.times[i - 1] - FRAME_STEP) < 0.01);
  let gray = null;
  try { gray = grayFrames(file); } catch { /* 흰 기본 글자만 못 본다 — 나머지는 그대로 */ }
  for (const [key, one] of gray ? all : []) {
    if (!isSteady(one)) continue;
    // 들어오는 움직임 중간이 아니라 머무는 동안의 가운데 장면으로 잰다
    const frame = gray.frame(Math.round(one.times[Math.floor(one.times.length / 2)] / FRAME_STEP));
    const r = frame && plainWhite(frame, gray.w, gray.h, one.line);
    if (!r?.plain) continue;
    let run = 1, best = 1;
    one.times.forEach((t, i) => { run = i > 0 && Math.abs(t - one.times[i - 1] - FRAME_STEP) < 0.01 ? run + 1 : 1; best = Math.max(best, run); });
    const chars = [...String(one.text).replace(/\s/g, '')];
    const clean = chars.filter((c) => /[\p{L}\p{N}'"“”‘’.,!?…:-]/u.test(c)).length / Math.max(1, chars.length) >= 0.95; // 「c:℃아않 파리만 날려요」 같은 잘못 읽은 줄은 빼고
    let kind = norm(one.text).length > 6 && best >= 2 && clean && r.ringDark < 0.45 ? 'white' : 'whiteShort';
    if (kind === 'white' && inShot(one.times, shots.ranges)) kind = 'whiteShot';
    const p = { kind, text: `바탕 얼룩 ${Math.round(r.bgStd)} · 흰 글자 둘레 어두운 칸 ${Math.round(r.ringDark * 100)}%` };
    if (seen.has(key)) seen.get(key).problems.push(p);
    else seen.set(key, { text: one.text, problems: [p], times: one.times, frames: one.frames, box: one.box });
  }
  const steady = [...seen.values()].filter(isSteady);
  const frames = new Map();
  for (const item of steady) {
    const name = item.frames[0];
    if (!frames.has(name)) frames.set(name, { name, boxes: [] });
    frames.get(name).boxes.push(item.box);
  }
  const sheetFile = sheet([...frames.values()], dir, sheetPath);
  fs.rmSync(dir, { recursive: true, force: true });
  const findings = [];
  const sheetRel = sheetFile ? path.relative(repo, sheetFile).split(path.sep).join('/') : null;
  for (const kind of Object.keys(KINDS)) {
    const hits = steady.filter((item) => item.problems.some((p) => p.kind === kind));
    if (!hits.length) continue;
    const examples = hits.slice(0, 2).map((item) => `${item.times[0].toFixed(1)}초 「${item.text.slice(0, 18)}」 ${item.problems.find((p) => p.kind === kind).text}`);
    findings.push({ level: FIX_KINDS.has(kind) ? FIX : LOOK, code: `text-${kind}`, kind, where: label, count: hits.length, examples, sheet: sheetRel,
      ...(kind === 'whiteShot' ? { note: `까닭: ${shots.까닭}` } : {}) });
  }
  return { findings, text: texts.join('\n') };
}

// 같은 틀로 만든 판(LAB 나라별 판 넷 등)은 같은 자리에서 같은 줄이 걸린다. 종류마다 한 줄로 합치되, 영상마다 군데 수와 장면표는 모두 남기고
// 예는 가장 많이 걸린 영상에서 든다.
function mergeAcrossFiles(list) {
  const byCode = new Map();
  for (const f of list) {
    if (!byCode.has(f.code)) byCode.set(f.code, []);
    byCode.get(f.code).push(f);
  }
  const short = (where) => where.split('/').slice(-2).join('/');
  return [...byCode.values()].map((group) => {
    const top = [...group].sort((a, b) => b.count - a.count)[0];
    const sheets = group.map((f) => f.sheet).filter(Boolean);
    const counts = group.length > 1 ? `(${group.map((f) => `${short(f.where)} ${f.count}`).join(' · ')})` : '';
    return { level: group.some((f) => f.level === FIX) ? FIX : LOOK, code: top.code, where: group.length > 1 ? `영상 ${group.length}개` : top.where,
      message: `${KINDS[top.kind]} ${group.reduce((n, f) => n + f.count, 0)}군데${counts} — ${top.examples.join(' · ')}${top.note ? ` · ${top.note}` : ''}${sheets.length ? ` · 장면표 ${sheets.join(' · ')}` : ''}` };
  });
}

function ocrCover(file, dir, label, { allowHan }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(file, path.join(dir, 'cover' + (path.extname(file).toLowerCase() === '.png' ? '.png' : '.jpg')));
  const [image] = ocrFolder(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  if (!image || Math.abs(image.width / image.height - 9 / 16) > 0.02) return [];
  const hits = linesOf(image, { allowHan }).map((line) => ({ line, problems: problemsOf(line) })).filter((x) => x.problems.length);
  // 영상과 같이 걸린 종류마다 한 줄(몇 군데, 예 둘)로 모은다.
  return Object.keys(KINDS).map((kind) => {
    const mine = hits.filter((x) => x.problems.some((p) => p.kind === kind));
    if (!mine.length) return null;
    const examples = mine.slice(0, 2).map((x) => `「${x.line.text.slice(0, 18)}」 ${x.problems.find((p) => p.kind === kind).text}`);
    return { level: LOOK, code: 'cover-safe-area', where: label, message: `표지 ${KINDS[kind]} ${mine.length}군데 — ${examples.join(' · ')}` };
  }).filter(Boolean);
}

// ⑰ 소리 빈자리(10-31) — 합계와 가장 긴 자리가 다 넘으면 고칠 것, 하나만 넘으면 확인할 것(문턱과 실측은 tools/소리빈자리.js)
function gapFinding(r) {
  if (r.pass) return null;
  const where = r.gaps.slice(0, 6).map((g) => `${g.start.toFixed(1)}~${g.end.toFixed(1)}`).join(' · ') + `초${r.gaps.length > 6 ? ` 외 ${r.gaps.length - 6}곳` : ''}`;
  const measured = `말 사이 소리가 완전히 빈 자리 합 ${r.total.toFixed(1)}초 · 최장 ${r.longest.toFixed(1)}초(${where})`;
  if (r.fix) {
    return { level: FIX, code: 'audio-gap', message: `${measured} — 기준 합 ${소리빈자리.TOTAL_LIMIT}초 · 최장 ${소리빈자리.LONGEST_LIMIT}초 안. 배경음이 없거나 영상보다 짧으면 이렇게 빈다 — 영상 길이만큼 이어 깔고 다시 렌더 → 음량 마감(현장노트 영상 「18초 배경음」)` };
  }
  return { level: LOOK, code: 'audio-gap', message: `${measured} — 일부러 둔 정적인지 듣고, 배경음이 끊긴 자리면 고친다` };
}

// ── 영상 하나 ──
// light(11-10): 나라 판본(돌림 판) 영상은 올림 규격 · 음량만 본다 — 그림 · 박자 · 뼈대 · 맹검은 동결한 원본의 검사를 따르고(설계 17 · 20),
// 조판은 글자 검사 기록이 본다(rotationFindings가 그 기록의 지문을 지금 파일과 맞춘다). 판본 26개에 정지 · 한 구성 · 글자표를 다시 돌리면
// 원본과 같은 확인할 것이 판본 수만큼 되풀이된다(11-10 모의: 「원본과 뼈대 자리이 다르다」 열 줄).
async function checkVideo(file, out, { skipOcr, repo, allowHan, label = path.basename(file), homage = null, shots, light = false }) {
  const 사전 = await import(pathToFileURL(path.join(__dirname, '영상사전검사.mjs')).href);
  const 음량 = await import(pathToFileURL(path.join(__dirname, '음량마감.mjs')).href);
  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, where: label, message });
  const slug = label.replace(/\.[^.]+$/, '').replace(/[\\/]+/g, '_');
  const report = await 사전.inspectMedia({ video: file, out: path.join(out, '영상사전검사_' + slug) });
  for (const issue of report.issues) {
    if (['audio-level', 'audio-peak'].includes(issue.code)) continue; // ④에서 공용 기준으로 본다
    const hard = issue.severity === 'error' || ['upload-video-bitrate', 'upload-video-codec', 'upload-pixel-format', 'upload-audio-bitrate'].includes(issue.code);
    add(hard ? FIX : LOOK, 'media-' + issue.code, `${issue.at == null ? '' : `${issue.at.toFixed(1)}초 · `}${issue.message}`);
  }
  const m = report.media;
  if (Math.min(m.width, m.height) < 1080) add(FIX, 'resolution', `${m.width}×${m.height} — 올림 화질은 1080×1920 이상(v2 §2-4)`);
  if (Math.abs(m.width / m.height - 9 / 16) > 0.01) add(FIX, 'aspect', `${m.width}×${m.height} — 쇼츠·릴스는 9:16`);
  const loud = m.loudness;
  if (!loud || loud.integratedLufs == null) add(LOOK, 'loudness-unknown', '음량을 재지 못했다(소리가 없거나 무음)');
  else if (!음량.passes({ I: loud.integratedLufs, peak: loud.truePeakDbfs }, 음량.DEFAULTS)) {
    add(FIX, 'loudness', `${loud.integratedLufs} LUFS · 최대 ${loud.truePeakDbfs} dBFS — 공용 기준 ${음량.DEFAULTS.target}±${음량.DEFAULTS.tolerance} LUFS·최대 ${음량.DEFAULTS.ceiling} dBFS(node tools/음량마감.mjs <렌더.mp4>로 다시 담는다)`);
  }
  if (light) {
    const stat = fs.statSync(file);
    return { findings, ocrFindings: [], ocrText: '', size: stat.size,
      summary: { 바이트: stat.size, 수정: new Date(stat.mtimeMs).toISOString(), sha256: report.inputs.video.sha256, 길이: Math.round(m.duration * 10) / 10,
        해상도: `${m.width}×${m.height}`, 평균Mbps: Math.round(((stat.size * 8) / m.duration) / 1e5) / 10, 오디오비트레이트: m.audioBitrates,
        음량: loud?.integratedLufs ?? null, 봉우리: loud?.truePeakDbfs ?? null, 판본: true,
        사전검사: path.relative(repo, report.reportPath).split(path.sep).join('/') } };
  }
  const still = 정지.analyze(file);
  if (!still.pass) {
    const long = still.runs.filter((x) => !x.endCard).map((x) => `${x.start.toFixed(1)}~${x.end.toFixed(1)}초`);
    const 원본도 = homage && stillLikeOriginal(still, homage.orig);
    add(원본도 ? LOOK : FIX, 'still', `거의 멈춘 시간 ${still.still.toFixed(1)}초(${Math.round(still.ratio * 100)}%)${long.length ? ` · 1.5초 넘는 정지 ${long.join(', ')}` : ''} — 기준 15% 이하·끝 화면 말고 1.5초 넘는 정지 없음(v2 §2-4)`
      + (원본도 ? ` · 원본도 ${Math.round(homage.orig.멈춤.비율 * 100)}%가 멈췄고 나란히가 맞아 확인할 것으로 둔다(원본처럼 멈춘 칸마다 새 것이 나오는지 본다)` : ''));
  }
  const 구성 = 한구성.analyze(file);
  for (const s of 구성.long) {
    const 원본도 = homage && compositionLikeOriginal(s, homage.orig, 구성.segments.length ? 구성.segments[구성.segments.length - 1].end : s.end);
    add(원본도 ? LOOK : FIX, 'one-composition', `${s.start.toFixed(1)}~${s.end.toFixed(1)}초 한 구성 ${s.length.toFixed(1)}초${s.endCard ? '(끝 화면 — 6초까지)' : ''} — 같은 장면에서 글 강조 · 테 · 밝기만 바뀌는 칸은 4초 안으로 줄이거나 장면을 바꾼다(제작 절차 3 · 10-28)`
      + (원본도 ? ' · 원본도 같은 자리가 한 구성이고 나란히가 맞아 확인할 것으로 둔다' : ''));
  }
  let gap = null;
  try {
    gap = 소리빈자리.analyze(file);
    const f = gapFinding(gap);
    if (f) add(f.level, f.code, f.message);
  } catch (error) {
    add(LOOK, 'audio-gap-unknown', `소리 빈자리를 재지 못했다(${error.message}) — 말 사이가 비지 않는지 귀로 듣는다`);
  }
  if (!still.end) add(LOOK, 'end-card-unknown', '끝 화면을 재지 못했다(마지막 12초 안에 화면 전체가 바뀌는 컷이 없음) — 4초 안팎인지 눈으로 본다');
  else if (still.end.length < END_CARD[0] || still.end.length > END_CARD[1]) add(LOOK, 'end-card', `끝 화면 ${still.end.length.toFixed(1)}초(${still.end.start.toFixed(1)}초 컷부터) — v2 §2-4 「4초 안팎」`);
  let ocr = { findings: [], text: '' };
  if (!skipOcr) {
    try { ocr = ocrVideo(file, path.join(out, '장면_' + slug), label, { allowHan, repo, sheetFile: path.join(out, `글자표_${slug}.jpg`), shots }); } catch (error) {
      add(LOOK, 'ocr-failed', `글자 인식을 못 했다(${error.message}) — 글자 크기·안전 영역은 눈으로 본다`);
    }
  }
  const stat = fs.statSync(file);
  const video = report.inputs.video;
  const stream = Math.round(((stat.size * 8) / m.duration) / 1e5) / 10;
  return {
    findings, ocrFindings: ocr.findings, ocrText: ocr.text, size: stat.size,
    summary: { 바이트: stat.size, 수정: new Date(stat.mtimeMs).toISOString(), sha256: video.sha256, 길이: Math.round(m.duration * 10) / 10,
      해상도: `${m.width}×${m.height}`, 평균Mbps: stream, 오디오비트레이트: m.audioBitrates, 음량: loud?.integratedLufs ?? null, 봉우리: loud?.truePeakDbfs ?? null,
      정지: `${Math.round(still.ratio * 100)}%${still.pass ? ' 통과' : ' 고칠 것'}`, 끝화면: still.end ? Math.round(still.end.length * 10) / 10 : null,
      한구성: Math.round(구성.longest * 100) / 100,
      ...(gap ? { 소리빈자리: { 합: Math.round(gap.total * 100) / 100, 최장: Math.round(gap.longest * 100) / 100, 자리: gap.gaps.length } } : {}),
      사전검사: path.relative(repo, report.reportPath).split(path.sep).join('/') },
  };
}

// ── ⑮ 원본과 나란히(10-28) ──
// (⑱ 미학 맹검 판정은 tools/lib/미학관문.js — 예약 큐도 같은 판정으로 걸 편을 고른다)

// 오마주(제작 절차 「오마주」)는 원본 컷 · 박자 1:1이 기본이다. 10-29부터 만든 편 폴더는 원본이 있어야 하고(없으면 준비.json 「원본없음」에 까닭),
// 원본이 정지 장면 칸으로 짜였으면 그만큼 멈춘 우리 편을 ② · ⑬이 막지 않게 한다 — 나란히가 맞을 때만.
const HOMAGE_FROM = '20261029';

// 원본에서도 우리 한 구성 자리(원본 길이에 맞춘 초)의 절반 넘게가 긴 한 구성이었나
function compositionLikeOriginal(seg, orig, ourLength) {
  const k = orig.길이 / (ourLength || orig.길이);
  const a = seg.start * k, b = seg.end * k;
  return (orig.긴구성 || []).some(([s, e]) => Math.min(b, e) - Math.max(a, s) >= 0.5 * (b - a));
}

function stillLikeOriginal(still, orig) {
  return Boolean(orig.멈춤) && still.ratio <= orig.멈춤.비율 + 0.1;
}

function homageOf(bundle) {
  const file = path.join(bundle.dir, '오마주.json');
  return fs.existsSync(file) ? 묶음.readJson(file) : null;
}

// → { findings, per: Map(영상 → { orig, 맞음 }) }
function homageFindings(bundle, videoFiles, { homage = homageOf(bundle), measure = 오마주.measure, probe = 오마주.probe } = {}) {
  const findings = [];
  const per = new Map();
  const add = (level, code, where, message) => findings.push({ level, code, where, message });
  if (!homage) {
    const day = (String(bundle.name).match(/_(\d{8})$/) || [])[1];
    const 까닭 = typeof bundle.prep.원본없음 === 'string' ? bundle.prep.원본없음.trim() : '';
    if (!까닭 && day && day >= HOMAGE_FROM && videoFiles.length) { // 그림 여러 장 편처럼 영상 판이 없으면 묻지 않는다
      add(FIX, 'homage-missing', '오마주', '원본 1:1이 기본이다(10-29부터, 제작 절차 「오마주」) — node tools/오마주.js 분해 <원본 주소> --편 <편 폴더>로 오마주.json을 만들거나, 원본 없이 만든 까닭을 준비.json 「원본없음」에 적는다');
    }
    return { findings, per };
  }
  const 원본 = homage.원본 || {};
  if (!원본.주소 || !(Number(원본.길이) > 0) || !Array.isArray(homage.컷) || !homage.컷.length) {
    add(FIX, 'homage-bad', '오마주.json', '원본 주소 · 길이 · 컷(시작 초)이 없다 — node tools/오마주.js 분해로 다시 만든다');
    return { findings, per };
  }
  if (!오마주.갈래들.includes(homage.갈래)) add(FIX, 'homage-kind', '오마주.json', `「갈래」가 ${오마주.갈래들.join(' · ')} 가운데 하나가 아니다: ${homage.갈래 ?? '없음'}`);
  if (!homage.확정) add(LOOK, 'homage-unconfirmed', '오마주.json', '원본 컷 · 박자를 눈으로 확정하지 않았다(칸.jpg · 첫3초.jpg로 보고 「확정」: true)');
  const 뼈 = homage.뼈대 || {};
  const 반전정함 = Number.isFinite(뼈.반전) || (뼈.반전 === null && homage.확정); // 반전이 없는 원본은 확정 뒤 null
  if (!Number.isFinite(뼈.끝) || !반전정함) {
    add(LOOK, 'homage-skeleton', '오마주.json', '「뼈대」(훅 · 반전 · 끝이 시작하는 원본 초 — 반전이 없는 원본이면 확정 뒤 null)를 칸을 보고 채우지 않았다');
  }
  const orig = { 길이: Number(원본.길이), 컷: homage.컷, 박자: homage.박자 || homage.컷, 뼈대: homage.뼈대 || null, 긴구성: homage.긴구성 || [], 멈춤: homage.멈춤 || null };
  for (const file of videoFiles) {
    let r;
    try { r = 오마주.compare(orig, { 길이: probe(file).길이, ...measure(file) }, { 다르게: homage.다르게 }); } catch (error) {
      add(LOOK, 'homage-failed', path.basename(file), `원본과 나란히 재지 못했다(${error.message}) — node tools/오마주.js 나란히 <편 폴더>`);
      continue;
    }
    for (const x of r.항목) {
      if (x.맞음) continue;
      add(x.다르게 ? LOOK : FIX, 'homage-' + x.이름.replace(/\s+/g, ''), path.basename(file),
        `원본과 ${x.이름}이 다르다 — ${x.글}${x.다르게 ? ` · 다르게: ${x.다르게}` : ' — 원본 1:1로 고치거나, 바꿀 까닭을 오마주.json 「다르게」에 적는다(제작 절차 「오마주」)'}`);
    }
    // ② · ⑬ 내림은 「다르게」 없이 모든 항목이 실제로 맞고 원본 컷을 눈으로 확정했을 때만(10-28 Fable P1 — 까닭 글만 적어 E8 꼴이 빠져나갔다)
    per.set(file, { orig, 맞음: r.맞음, 그대로: Boolean(homage.확정) && r.항목.every((x) => x.맞음) });
  }
  return { findings, per };
}

// ── ⑭ 목소리(10-28) ──
// 10-28 점검: Typecast 「하나」의 감탄사(「Nope!」)가 깨진 채 퀴즈 여섯 편에 나갔고(유호님 「전부 지지직, 특히 no」), E8에는 다시 산
// 바리스타 목소리가 아니라 그 전 파일이 들어갔다. 지금까지 목소리 결함은 tools/나레이션굽기.mjs 경고뿐이라 렌더 뒤에는 아무도 안 봤다.
// 기계로 가르는 것은 최고 음높이(560Hz — 깨진 줄은 594~645Hz, 깨끗한 소진 세기 1.0은 498Hz) · Typecast 원본 잘림 · 목소리 엉킴이다.
// 엉킴(tools/목소리엉킴.py)은 줄 하나로는 못 가른다(깨진 「Nope!」 11%, 깨끗한 줄도 자음이 많으면 20~60%) — 목소리마다 줄을 모아
// 프레임 가중 평균을 낸다. 여자 목소리는 하나 25~33% · 소진 0% · 진희 2% · 미선 4% · 혜리 5~8%로 갈리지만(현장노트 영상 「하나」),
// 기본음이 낮은 남자 목소리는 결함 없이도 45~65%라(범수) 중앙 기본음 165Hz 이상인 목소리만 15%를 문턱으로 본다. 파이썬 · numpy가
// 없으면 엉킴만 확인할 것으로 남긴다.
const TANGLE_LIMIT = 15;
const TANGLE_MIN_F0 = 165;

// 목소리엉킴.py 출력 「<경로>\t엉킨 프레임  12.1% · … · 프레임 66 · 최고 음높이 525Hz · 중앙 기본음 240Hz」 → { 경로: {pct, frames, f0} }
function parseTangle(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const [file, rest] = line.split('\t');
    const m = rest && rest.match(/엉킨 프레임\s+([\d.]+)%.*프레임 (\d+).*중앙 기본음 ([\d.]+)Hz/);
    if (m) out[path.resolve(file)] = { pct: Number(m[1]), frames: Number(m[2]), f0: Number(m[3]) };
  }
  return out;
}

// 목소리(Typecast 목소리 id, 모르면 폴더)마다 프레임 가중 엉킴 % · 중앙 기본음 → 엉킨 목소리 [{voice, pct, f0, lines}]
function tangledVoices(files, measured) {
  const groups = new Map();
  for (const v of files) {
    const r = measured[path.resolve(v.wav)];
    if (!r || !r.frames) continue;
    const g = groups.get(v.voice) || { voice: v.voice, frames: 0, sum: 0, f0s: [], lines: 0 };
    g.frames += r.frames; g.sum += r.pct * r.frames; g.f0s.push(r.f0); g.lines += 1;
    groups.set(v.voice, g);
  }
  return [...groups.values()].map((g) => {
    const f0s = g.f0s.sort((a, b) => a - b);
    return { voice: g.voice, pct: Math.round((g.sum / g.frames) * 10) / 10, f0: f0s[Math.floor(f0s.length / 2)], lines: g.lines };
  }).filter((g) => g.f0 >= TANGLE_MIN_F0 && g.pct > TANGLE_LIMIT);
}
// 줄 파일 찾기: 준비.json 「목소리」(편 폴더 기준 폴더 · 파일 목록)가 있으면 그것만, 없으면 편 폴더의 나레이션굽기 vo.json 줄과
// remotion/public/vo 아래 wav(관용구 퀴즈처럼 vo.json 없이 굽는 편). 시험 · 후보 폴더(억양시험 등)는 영상에 안 들어가니 뺀다.
const VOICE_SKIP = /^(node_modules|out|\.git|시안|판|게시|.*시험.*|.*후보.*|old|test)$/i;
const VOICE_TOOL = 'tools/나레이션굽기.mjs';

function voiceFiles(bundle) {
  const found = new Map();
  const add = (wav, json = null, made = null) => {
    if (!found.has(wav) && fs.existsSync(wav)) found.set(wav, { wav, json: json && fs.existsSync(json) ? json : null, id: path.basename(wav, path.extname(wav)), made });
  };
  const listed = [].concat(bundle.prep.목소리 || []).filter((x) => typeof x === 'string' && x.trim());
  const walk = (dir, depth, { all, skip }) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const manifest = entries.find((e) => e.isFile() && e.name === 'vo.json');
    if (manifest) {
      try {
        const m = 묶음.readJson(path.join(dir, 'vo.json'));
        const made = Date.parse(m.made || '') || null;
        if (m.tool === VOICE_TOOL) for (const l of m.lines || []) add(path.join(dir, path.basename(l.src || `${l.id}.wav`)), path.join(dir, `${l.id}.json`), made);
      } catch { /* 깨진 목록은 아래 wav 훑기로 */ }
    }
    for (const e of entries) {
      if (e.isDirectory() && depth < 6 && !(skip && VOICE_SKIP.test(e.name))) walk(path.join(dir, e.name), depth + 1, { all: all || (e.name === 'vo' && /[\\/]public$/.test(dir)), skip });
      else if (e.isFile() && all && /\.wav$/i.test(e.name)) add(path.join(dir, e.name), path.join(dir, e.name.replace(/\.wav$/i, '.json')));
    }
  };
  if (listed.length) {
    for (const p of listed) {
      const f = 묶음.resolve(bundle, p);
      if (f && fs.existsSync(f) && fs.statSync(f).isFile()) add(f, f.replace(/\.wav$/i, '.json'));
      else if (f) walk(f, 0, { all: true, skip: false });
    }
  } else {
    walk(bundle.dir, 0, { all: false, skip: true });
  }
  return [...found.values()];
}

// 줄 파일마다 최고 음높이 · 잘림 · 영상보다 새것인지 → 고칠 것. 「영상보다 새것」은 나레이션굽기가 vo.json에 적은 만든 때(made)와
// 영상 파일 수정 시각(git 밖이라 체크아웃 · 따라가기가 안 건드린다)으로 본다 — wav 수정 시각은 git이 다시 쓰면 바뀌어 못 믿는다
// (퀴즈 #5 줄 57개가 렌더 뒤 시각으로 나왔다). vo.json 없이 구운 줄은 이 셈을 하지 않는다.
async function voiceFindings(bundle, videoFiles, { files = voiceFiles(bundle), scriptText = '' } = {}) {
  const 굽기 = await import(pathToFileURL(path.join(__dirname, '나레이션굽기.mjs')).href);
  const out = [];
  const high = [], clipped = [], newer = [], unread = [];
  let top = null;
  const times = videoFiles.filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs);
  const videoTime = times.length ? Math.min(...times) : null;
  for (const v of files) {
    let x;
    try { x = 굽기.readWavMono16(v.wav); } catch { unread.push(v.id); continue; }
    let meta = null;
    try { meta = v.json ? 묶음.readJson(v.json) : null; } catch { /* 줄 기록 없이 wav만 본다 */ }
    const voiceKey = meta?.source?.voice?.name || meta?.source?.voice?.id || (typeof meta?.source?.voice === 'string' ? meta.source.voice : null);
    v.voice = voiceKey || path.relative(bundle.dir, path.dirname(v.wav)).split(path.sep).join('/') || '.';
    const pitch = 굽기.topPitch(x);
    if (pitch !== null) top = Math.max(top ?? 0, pitch);
    if (pitch > 굽기.PITCH_WARN) high.push(`${v.id} ${pitch}Hz`);
    let clip = typeof meta?.level?.clippedSource === 'number' ? meta.level.clippedSource : null;
    const voiceId = meta?.source?.voice?.id || meta?.source?.voice;
    if (clip === null && meta?.source?.key && typeof voiceId === 'string') {
      const cached = 타입캐스트.findCached(voiceId, meta.source.key, { copyLegacy: false });
      if (cached?.wav) try { clip = 굽기.clippedSamples(굽기.readWavMono16(cached.wav)); } catch { /* 아래에서 줄 파일로 */ }
    }
    if (clip === null) clip = 굽기.clippedSamples(x);
    if (clip >= 굽기.CLIP_WARN) clipped.push(`${v.id} ${clip}표본`);
    if (videoTime !== null && v.made && v.made > videoTime + 60 * 1000) newer.push(v.id);
  }
  const readable = files.filter((v) => !unread.includes(v.id));
  let tangled = [];
  if (readable.length) {
    const r = measureTangle(readable.map((v) => v.wav));
    if (r.error) out.push({ level: LOOK, code: 'voice-tangle-unknown', where: '목소리', message: `목소리 엉킴을 못 쟀다(${r.error}) — 귀로 듣는다` });
    else tangled = tangledVoices(readable, r.measured);
  }
  const where = (list) => list.slice(0, 6).join(' · ') + (list.length > 6 ? ` 외 ${list.length - 6}` : '');
  if (tangled.length) out.push({ level: FIX, code: 'voice-tangle', where: '목소리', message: `목소리 엉킴 — ${tangled.map((g) => `${g.voice} 줄 ${g.lines}개 평균 ${g.pct}%(기본음 ${Math.round(g.f0)}Hz)`).join(' · ')} — 깨끗한 여자 목소리는 0~8%, 지지직 깨지는 하나는 25~33%다. 목소리를 바꿔 다시 굽고(LAB 장부 「목소리」) 다시 렌더한다` });
  if (high.length) out.push({ level: FIX, code: 'voice-pitch', where: '목소리', message: `최고 음높이 ${굽기.PITCH_WARN}Hz 넘는 줄 ${high.length}개 — ${where(high)} — 목소리가 뒤집혀 지지직 깨진다(10-28 「Nope!」 645Hz). 감정 세기 1.0 · seed를 바꿔 다시 사거나 목소리를 바꾸고(LAB 장부 「목소리」) 다시 렌더한다` });
  if (clipped.length) out.push({ level: FIX, code: 'voice-clipped', where: '목소리', message: `원본이 잘린 줄 ${clipped.length}개 — ${where(clipped)} — node tools/나레이션굽기.mjs <계획> --굽기 --줄 <id>로 낮은 크기로 다시 산다` });
  if (newer.length) out.push({ level: FIX, code: 'voice-newer', where: '목소리', message: `영상보다 나중에 바뀐 줄 파일 ${newer.length}개 — ${where(newer)} — 다시 산 목소리가 영상에 안 들어갔을 수 있다(10-28 E8). 다시 렌더한다` });
  if (unread.length) out.push({ level: LOOK, code: 'voice-unread', where: '목소리', message: `16비트 wav가 아니라 못 잰 줄 ${unread.length}개 — ${where(unread)} — 귀로 듣는다` });
  if (!files.length && String(scriptText).trim()) {
    out.push({ level: LOOK, code: 'voice-none', where: '목소리', message: '목소리 줄 파일(나레이션굽기 vo.json · remotion/public/vo)을 못 찾아 음높이 · 잘림을 못 쟀다 — 준비.json 「목소리」에 렌더에 쓴 줄 파일 폴더를 적는다' });
  }
  return { findings: out, summary: { 줄: files.length, 최고음높이: top, 잘림: clipped.length, 엉킨목소리: tangled.map((g) => `${g.voice} ${g.pct}%`) } };
}

// tools/목소리엉킴.py를 한 번 불러 줄마다 엉킴 % · 프레임 · 중앙 기본음을 잰다 → { measured } | { error }
function measureTangle(wavs) {
  const py = process.env.SYNK_PYTHON || 'python';
  const r = spawnSync(py, ['-X', 'utf8', path.join(__dirname, '목소리엉킴.py'), ...wavs], { encoding: 'utf8', windowsHide: true, timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) return { error: (r.error?.message || String(r.stderr || '').trim().split('\n').slice(-1)[0] || `종료 ${r.status}`).slice(0, 160) };
  return { measured: parseTangle(r.stdout) };
}

// ── 링크 ──
// 우리 주소(끝 행동 링크)는 응답 200이어야 한다. 남의 출처 주소는 봇을 막는 곳(401·403·429)이 있어 확인만 하고, 없는 주소(404·410)는 고친다.
const OWN_HOSTS = /(^|\.)(synk\.im|yuhobuilds\.tistory\.com|synklab\.substack\.com|blog\.naver\.com)$/i;

async function checkLinks(list) {
  const out = [];
  for (const raw of list) {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let own = false;
    try { own = OWN_HOSTS.test(new URL(url).hostname); } catch { /* 주소 꼴이 아니면 남의 주소로 본다 */ }
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (SYNK upload check)' } });
      if (r.status >= 200 && r.status < 300) continue;
      if (own || [404, 410].includes(r.status) || r.status >= 500) out.push({ level: FIX, code: 'link', where: '링크', message: `${raw} 응답 ${r.status} — ${own ? '끝 행동 링크는 응답 200이어야 한다' : '없는 주소다'}` });
      else out.push({ level: LOOK, code: 'link-blocked', where: '링크', message: `${raw} 응답 ${r.status} — 봇을 막는 곳일 수 있어 브라우저로 한 번 연다` });
    } catch (error) {
      out.push({ level: LOOK, code: 'link-unknown', where: '링크', message: `${raw} 확인 못 함(${error.name === 'TimeoutError' ? '시간 초과' : error.message}) — 나중에 다시 연다` });
    }
  }
  return out;
}

// ── 가져갈 프롬프트(10-22) ──
// yuhobuilds 편은 보는 사람이 가져갈 프롬프트를 synk.im/prompts에 한 항목으로 올리고 준비.json 「프롬프트」에 {id, 주소}를 적는다
// (docs/마케팅/맞춤도구/prompts/README.md). 칸이 없으면 확인할 것(맞지 않는 편이면 까닭을 남은위험에), 있으면 프롬프트.json에
// 그 항목이 있는지와 공개 페이지가 응답 200이고 그 항목(id="…")을 싣고 있는지 본다 — 주소 뒤 #id는 서버로 가지 않아 200만으로는 모른다.
const PROMPTS_PAGE = 'https://synk.im/prompts/';
const PROMPTS_DATA = ['docs', '마케팅', '맞춤도구', 'prompts', '프롬프트.json'];
const PROMPTS_FROM = '2026-10-23'; // 이 날 슬롯부터 — 그 전 편(이미 올라갔거나 예약된 편)은 칸이 없어도 짚지 않는다

async function promptFindings(prep, { repo, fetchImpl = fetch, skipLinks = false } = {}) {
  if (prep.브랜드 !== 'yuhobuilds' || !(String(prep.슬롯 || '') >= PROMPTS_FROM)) return [];
  const out = [];
  const add = (level, code, message) => out.push({ level, code, where: '프롬프트', message });
  const p = prep.프롬프트;
  if (!p || typeof p !== 'object' || !p.id) {
    add(LOOK, 'prompt-missing', '준비.json 「프롬프트」({"id","주소"})가 없다 — 이 편의 가져갈 프롬프트를 synk.im/prompts에 올려 적는다(프롬프트가 맞지 않는 편이면 까닭을 남은위험에)');
    return out;
  }
  const want = PROMPTS_PAGE + '#' + p.id;
  if (p.주소 !== want) add(FIX, 'prompt-url', `「주소」가 ${p.주소 || '없음'} — ${want}로 적는다`);
  let items = null;
  try { items = JSON.parse(fs.readFileSync(path.join(repo, ...PROMPTS_DATA), 'utf8')).항목 || []; } catch (error) { add(LOOK, 'prompt-data', `프롬프트.json을 읽지 못했다(${error.message})`); }
  if (items && !items.some((it) => it.id === p.id)) add(FIX, 'prompt-item', `프롬프트.json에 「${p.id}」 항목이 없다 — 항목을 더하고 빌드·공개한다`);
  if (skipLinks) return out;
  try {
    const r = await fetchImpl(PROMPTS_PAGE, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (SYNK upload check)' } });
    if (r.status !== 200) add(FIX, 'prompt-page', `${PROMPTS_PAGE} 응답 ${r.status} — 공개 페이지가 열려야 한다`);
    else if (!(await r.text()).includes(`id="${p.id}"`)) add(FIX, 'prompt-unpublished', `공개된 ${PROMPTS_PAGE}에 「${p.id}」 항목이 아직 없다 — node docs/마케팅/맞춤도구/build.mjs prompts 뒤 tools/공개.js로 올린다`);
  } catch (error) {
    add(LOOK, 'prompt-unknown', `${PROMPTS_PAGE} 확인 못 함(${error.name === 'TimeoutError' ? '시간 초과' : error.message}) — 나중에 다시 연다`);
  }
  return out;
}

function kitCheck(bundle, file, out) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'SNS키트굽기.js'), file, '--out', out], { encoding: 'utf8', windowsHide: true, timeout: 300000 });
  const failed = String(r.stdout || '').split('\n').filter((l) => l.includes('✗')).map((l) => ({ level: FIX, code: 'kit', where: path.basename(file), message: l.trim() }));
  // 검사 도구가 죽거나(크롬·시간 초과) 걸린 장 없이 실패로 끝나면 통과로 치지 않는다.
  if (r.error || (r.status !== 0 && !failed.length)) {
    const why = r.error ? r.error.message : String(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' ');
    failed.push({ level: FIX, code: 'kit-run', where: path.basename(file), message: `SNS 키트 검사를 끝내지 못했다(${why.slice(0, 200) || `종료 ${r.status}`}) — 다시 돌린다` });
  }
  return failed;
}

// 편 폴더 기준 이름표(「게시/01-mn/video.mp4」). 워크트리에서 돌려 영상이 공용 작업본에 있어도 같은 이름표가 되게 저장소 기준 경로에서 편 경로를 뗀다.
function labelOf(bundle, file) {
  const 편 = path.relative(bundle.repo, bundle.dir).split(path.sep).join('/');
  const rel = 묶음.rel(bundle, file);
  return rel.startsWith(`${편}/`) ? rel.slice(편.length + 1) : rel;
}

// ⑨ 틱톡 판. 같은 말을 쓰는 틱톡 계정엔 같은 최종본을 올리되, 끝 말이 인스타 키워드 DM · 유튜브 고정 댓글을 가리키면 틱톡엔 그 길이 없다.
// 짝 틱톡 계정이 매일 판 줄에 있으면 빠진 판은 ⑩이 본다(같은 말을 두 번 하지 않는다).
function tiktokFindings(plates, prep, known = {}) {
  const out = [];
  const add = (code, where, message) => out.push({ level: LOOK, code, where, message });
  const accounts = new Set(plates.map((p) => p.account));
  for (const p of plates) {
    const pair = TIKTOK_PAIR[p.account];
    if (!pair || !p.video || accounts.has(pair) || prep.틱톡없음 || known[pair]?.dailyLine) continue;
    add('tiktok-plate', p.account, `짝 틱톡 판(${pair})이 없다 — 제작 절차 4 「틱톡 판」. 달지 않을 까닭이 있으면 준비.json 「틱톡없음」에 적는다`);
  }
  for (const t of plates.filter((p) => p.platform === 'tiktok' && p.video)) {
    for (const p of plates) {
      if (p === t || !p.video || p.video.path !== t.video.path) continue;
      if (p.platform === 'instagram' && p.keywordDm) add('tiktok-ending', t.account, `키워드 DM(「${p.keywordDm}」) 인스타 판과 같은 영상이다 — 끝 말이 DM을 약속하면 끝 말만 바꾼 틱톡판을 렌더한다`);
      if (p.platform === 'youtube' && p.texts.pinnedComment) add('tiktok-ending', t.account, '고정 댓글이 있는 유튜브 판과 같은 영상이다 — 끝 말이 고정 댓글을 가리키면 끝 말만 바꾼 틱톡판을 렌더한다');
    }
  }
  return out;
}

// ⑩ 매일 판. 한 편은 그 줄의 모든 계정에 간다(유호님 10-26 「하루에 모든 계정에 하나씩」). 막힌 계정(dailyBlocked)은 빼고 본다.
// 막힌 계정에 판이 달려 있으면 고칠 것 — 14시 게시 세션 · 검토 링크 「함께」가 판대로 걸기 때문이다(11-01 틱톡 @yuhobuilds 쉼, 유호님 「쉬게 해」).
// 그 판단(blocked-plate)은 아래 closedFindings가 게시결과를 보고 낸다(11-11 밤 P1-넷6 — 여기서 게시결과 없이 내던 것을 옮겼다).
// 11-10 LAB 39계정: 돌림 판(판 「돌림」: true — tools/돌림표.js가 계정 · 날을 정한다)과 「LAB 나라별」 줄은 「그 줄의 모든 계정」으로 보지 않고
// 아래 rotationFindings가 칸 · 판본 · 계정 준비를 본다. 시작 전(dailyFrom 「미정」) 계정과, 이 편 형식(준비.json 「돌림」.형식)의 칸이 없는 계정
// (텔레그램은 21:00 노래뿐)은 판이 없어도 된다.
function dailyFindings(plates, prep, known = {}) {
  const out = [];
  const have = new Set(plates.map((p) => p.account));
  const excused = prep.빠진판 && typeof prep.빠진판 === 'object' && !Array.isArray(prep.빠진판) ? prep.빠진판 : {};
  const format = prep.돌림?.형식 || null;
  const own = plates.filter((p) => !p.raw?.돌림);
  const lines = [...new Set(own.map((p) => known[p.account]?.dailyLine).filter(Boolean))].filter((l) => l !== 'LAB 나라별');
  for (const line of lines) {
    for (const [key, a] of Object.entries(known)) {
      if (a.dailyLine !== line || a.dailyBlocked || T.notStarted(a) || have.has(key) || String(excused[key] || '').trim()) continue;
      if (a.platform === 'tiktok' && prep.틱톡없음) continue;
      if (format && Array.isArray(a.dailyFormats) && !a.dailyFormats.includes(format)) continue;
      out.push({ level: LOOK, code: 'daily-plate', where: key, message: `매일 판 「${line}」 계정인데 판이 없다 — 판을 달거나, 못 가면 준비.json 「빠진판」에 {"${key}": "까닭"}` });
    }
  }
  return out;
}

// ⑩ 돌림 판(11-10, 설계 1 · 4 · 5 · 22) — 판마다: 돌림 계정인지, 현지 시각이 이 편 형식의 칸인지, 씨앗이 아니면 프로필 · 예약 경로가
// 확인됐는지, 판 파일이 그 계정 판본(rotationVersion 또는 countryCode)의 파일인지, 그 판본의 검수(sns-계정.json labRotation.판본검수 —
// 기본 뜻 · 글자)가 지금 파일 · 글의 지문과 맞는지(내용을 고치면 뜻 검수가, 다시 렌더하면 글자 검수가 무효 — tools/돌림표.js versionState).
// 닫힌 계정 · 닫힌 칸(11-11 P2-8): 아직 안 연 계정(dailyFrom 「미정」 · 그 날짜 전)의 판은 손으로 단 판도, 계정을 닫거나 칸을 닫은 뒤 남은 돌림 판도
// 고칠 것이다(tools/게시장부.js closedCell — 걸기도 같은 셈으로 막는다). 이미 걸린 판(예약됨 · 거는 중 …)은 확인할 것 — 플랫폼 예약을 거둘지 본다.
// 게시된 판은 보지 않는다. posted = 계정 → 게시결과 상태(없으면 안 건 판으로 본다).
// 막힌 계정(원장 dailyBlocked — 플랫폼 경고 · 쉼으로 멈춘 계정)의 판도 같은 세 갈래다(11-11 밤 Fable 5.2 다시 검수 P1-넷6): 이미 나간 판은 안 보고,
// 걸린 판은 확인할 것(blocked-plate-booked), 안 건 판만 고칠 것(blocked-plate). 게시결과를 안 보고 모두 고칠 것으로 내던 동안에는, 경고로 한 계정을
// 멈추면 그 계정이 이미 받은(나간 · 걸린) 원본마다 편 전체가 고칠 것이 되어 다른 계정 판까지 못 걸렸다 — 씨앗 계정이면 돌림 원본 전부가 묶인다.
// 걸기도 같은 셈으로 막힌 계정을 거절한다(tools/게시장부.js closedCell — P2-넷7).
function closedFindings(bundle, plates, { posted = null } = {}) {
  const out = [];
  for (const p of plates) {
    const a = bundle.accounts?.[p.account];
    const why = 장부.closedCell(a, p.time, { rotation: Boolean(p.raw?.돌림) });
    if (!why) continue;
    const state = posted ? posted.get(p.account) || null : null;
    if (state === '게시됨') continue;
    const booked = Boolean(state) && state !== '실패' && !['보류', '취소됨', '지움'].includes(state);
    const again = p.raw?.돌림 ? 'node tools/돌림표.js --다시 --쓰기로 다시 짠다' : '판에서 뺀다';
    if (장부.blockedWhy(a)) {
      if (booked) out.push({ level: LOOK, code: 'blocked-plate-booked', where: p.account, message: `${why} — 그런데 이 판은 이미 「${state}」 상태다. 공개 전이면 그 플랫폼 예약을 거둘지 본다(계정을 멈춘 까닭이 플랫폼 경고면 거둔다 — 거둔 뒤 node tools/게시장부.js 끝 … --상태 실패 --확인 …)` });
      else out.push({ level: FIX, code: 'blocked-plate', where: p.account, message: `${why} — ${p.raw?.돌림 ? again : `판에서 빼고 준비.json 「빠진판」에 {"${p.account}": "쉼"}을 적는다`}` });
    } else if (booked) {
      out.push({ level: LOOK, code: 'closed-cell-booked', where: p.account, message: `${why} — 그런데 이 판은 이미 「${state}」 상태다. 플랫폼 예약을 거둘지 본다(공개 전 예약을 다른 편으로 바꿔 거는 것은 상시 승인 안)` });
    } else {
      out.push({ level: FIX, code: 'closed-cell', where: p.account, message: `${why} — 닫힌 계정 · 칸의 판이다. ${again}(계정 · 칸을 여는 것은 조율 세션 몫)` });
    }
  }
  return out;
}

// results = 게시결과 줄(「판」 — 안 주면 그 편 게시결과.json을 읽는다): 이미 나간 판은 보지 않고, 이미 걸린 판(예약됨 · 거는 중 …)의 판본이
// 걸린 뒤 무효가 됐으면 고칠 것이 아니라 확인할 것(rotation-version-booked)이다(11-11) — 고칠 것은 그 편의 다른 계정 판까지 막는데 걸린 판은
// 다시 걸 수 없고(플랫폼 예약부터 내려야 한다), 알리는 일은 예약큐 경고 「걸린 돌림 판의 판본이 걸린 뒤 바뀜」이 맡는다.
function rotationFindings(bundle, plates, { ledger = null, results = undefined } = {}) {
  const out = [];
  const gen = plates.filter((p) => p.raw?.돌림);
  if (!gen.length) return out;
  const add = (level, code, where, message) => out.push({ level, code, where, message });
  const format = bundle.prep.돌림?.형식;
  if (!FORMATS.includes(format)) { add(FIX, 'rotation-format', '준비.json', `돌림 판이 있는데 「돌림」.형식(${FORMATS.join(' · ')})이 없다`); return out; }
  const cfg = (ledger || 묶음.readJson(path.join(bundle.repo, 'docs', '마케팅', 'sns-계정.json')) || {}).labRotation || {};
  const required = Array.isArray(cfg.판본검수) && cfg.판본검수.length ? cfg.판본검수 : ['뜻', '글자'];
  const states = new Map();
  let rows = results;
  if (rows === undefined) { try { rows = 묶음.readJson(path.join(bundle.dir, '게시', '게시결과.json')).판 || []; } catch { rows = []; } }
  for (const p of gen) {
    const row = 장부.rowOf(rows || [], p.account);
    if (row && row.상태 === '게시됨') continue; // 이미 나간 판 — 그 뒤에 판본을 고쳐도 이 판이 걸 일을 막지 않는다
    const booked = 장부.held(row);
    const a = bundle.accounts[p.account];
    if (!a || !Array.isArray(a.dailyFormats)) { add(FIX, 'rotation-account', p.account, '돌림 계정이 아니다(sns-계정.json dailyFormats 없음) — 판을 빼고 node tools/돌림표.js로 다시 셈한다'); continue; }
    const at = Date.parse(p.time || '');
    if (Number.isFinite(at)) {
      const local = T.localTime(at, T.tzOf(a));
      const slot = T.slotFor(p.time, a);
      if (slot.format !== format || slot.time !== local) add(FIX, 'rotation-slot', p.account, `현지 ${local}(${a.timeZone || 'Asia/Seoul'})은 이 계정의 ${format} 칸이 아니다(칸: ${T.allSlots(a).map((s) => `${s.time} ${s.format || ''}`.trim()).join(' · ')}) — node tools/돌림표.js --다시`);
    }
    // postRouteVerified 「첫판」(첫 판 시험)은 판 하나만 — 그 한도는 돌림 셈(tools/lib/돌림.js)과 게시 장부 「걸기」가 지킨다
    if (!a.rotationSeed && (a.publicProfileComplete !== true || (a.postRouteVerified !== true && a.postRouteVerified !== '첫판'))) {
      add(FIX, 'rotation-ready', p.account, `프로필(publicProfileComplete) · 예약 경로(postRouteVerified — true, 또는 첫 판 시험 「첫판」)가 확인되기 전 계정이다 — 채운 뒤에만 건다(설계 4 · 5)`);
    }
    const key = a.rotationVersion || a.countryCode;
    const v = bundle.prep.돌림.판본?.[key];
    if (!v) { add(FIX, 'rotation-version', p.account, `이 편에 판본 ${key || '(키 없음)'}이 없다`); continue; }
    if (String(v.파일 || '').replace(/\\/g, '/') !== String(p.raw.파일 || '').replace(/\\/g, '/')) add(FIX, 'rotation-version-file', p.account, `판 파일(${p.raw.파일})이 판본 ${key}의 파일(${v.파일})과 다르다`);
    if (!states.has(key)) states.set(key, 돌림표.versionState(bundle.dir, v, required, key, { accounts: bundle.accounts }));
    const st = states.get(key);
    if (!st.ready && booked) {
      add(LOOK, 'rotation-version-booked', p.account, `판본 ${key}: ${st.why} — 그런데 이 판은 이미 「${row.상태}」 상태다(걸린 뒤 판본 검수가 무효가 됐다). 그대로 두면 검수 안 된 영상이 예약대로 공개된다 — 공개 전이면 그 플랫폼 예약을 내리고(node tools/게시장부.js 끝 … --상태 실패 --확인 …) node tools/돌림표.js --다시 --쓰기 뒤 고친 판으로 다시 건다`);
    } else if (!st.ready) add(FIX, 'rotation-version-check', p.account, `판본 ${key}: ${st.why} — 그 판본 검수를 다시 받는다(설계 22)`);
    else if (booked && row.지문 && st.sha && row.지문 !== st.sha) {
      add(LOOK, 'rotation-version-booked', p.account, `판본 ${key}: 건 뒤에 판본 영상을 다시 구웠다(걸린 영상은 옛 판) — 공개 전이면 그 플랫폼 예약을 내리고 새 판으로 다시 건다(node tools/게시장부.js 끝 … --상태 실패 --확인 … → node tools/돌림표.js --다시 --쓰기)`);
    } else if (booked) {
      // 걸린 뒤 게시글만 고친 판(11-11 밤 P1-팔1) — 판본 검수가 다시 서고 영상도 그대로라 위 둘이 조용한데, 예약에는 걸 때의 옛 글이 걸려 있다
      const text = 돌림표.bookedTextProblem(bundle.dir, p.raw, row);
      if (text) add(LOOK, 'rotation-version-booked', p.account, `판본 ${key}: ${text} — 공개 전이면 그 플랫폼 예약을 내리고 고친 글로 다시 건다(node tools/게시장부.js 끝 … --상태 실패 --확인 … → node tools/돌림표.js --다시 --쓰기)`);
    }
    // 뜻 검사에서 둘 이상이 같이 짚은 줄을 판정(원본 박자 · 한국어를 못 읽는 시험 전제)으로 내린 판본은 그 줄을 보이게 한다 — 판본에서 못 고치는
    // 줄이라 통과시켰지만(설계 20 「동결 뒤 고침은 P0만」), 다음 원본에서 고칠 거리이고 검수자가 판정을 다시 볼 수 있어야 한다(11-10).
    const verdicts = Array.isArray(v.검수?.뜻?.판정줄) ? v.검수.뜻.판정줄 : [];
    if (st.ready && verdicts.length) add(LOOK, 'rotation-verdict', p.account, `판본 ${key}: 뜻 검사에서 둘 이상이 짚은 줄 ${verdicts.length}개를 판정으로 내렸다 — ${verdicts.map((z) => `${z.줄}(${z.갈래})`).join(' · ')}. 판본 글로 못 고치는 줄인지 까닭을 본다(준비.json 돌림.판본.${key}.검수.뜻.판정줄)`);
    // 시험관 수(11-11 P2-7 → P1-넷1) — 넷이어야 할 때 넷보다 적은 시험관으로 통과한 판본은 이제 판본 상태(돌림표 versionState)가 「돌림에 못 든다」로
    // 닫는다: 안 걸린 판은 위의 고칠 것(rotation-version-check), 걸린 판은 확인할 것(rotation-version-booked)으로 뜬다. 「확인할 것 rotation-examiners」로만
    // 보이던 동안 14시 회차가 그런 판 여섯을 걸었고 셋이 넷 시험에서 떨어졌다(11-11).
    // 현지어 대조 기록(11-11 P2-4) — 게시글 줄(제목 · 본문 · 고정 댓글)은 뜻 검사 시험지에 안 실려 현지어 대조만 본다. 판본검수에 「현지어」가 아직
    // 없는 동안(기록을 채우는 중)에는 기록이 없거나 글이 바뀐 판본을 확인할 것으로 보인다 — 판본검수에 들면 versionState가 고칠 것으로 막는다.
    // 대조에서 검수 필요로 나온 줄을 사람 판정으로 넘긴 판본은 그 줄이 보이게 한다(뜻 검사 판정줄과 같은 까닭).
    if (st.ready) {
      const local = 돌림표.localCheckState(bundle.dir, v);
      if (!local.ok && !required.includes('현지어')) add(LOOK, 'rotation-local', p.account, `판본 ${key}: ${local.why} — 게시글 줄(제목 · 본문 · 고정 댓글)은 뜻 검사가 안 본다. node tools/현지어대조.js --판본 <편 폴더> --키 ${key} --기록 --뜻대조 "<직역을 원문과 견준 것>"`);
      if (local.ok && local.판정줄.length) add(LOOK, 'rotation-verdict-local', p.account, `판본 ${key}: 현지어 대조에서 검수 필요로 나온 줄 ${local.판정줄.length}개를 사람 판정으로 넘겼다 — ${local.판정줄.map((z) => `${z.줄}(${String(z.까닭 || '').slice(0, 60)})`).join(' · ')}. 까닭이 맞는지 본다(준비.json 돌림.판본.${key}.검수.현지어.판정줄)`);
    }
    // 시험관의 요약 · 웃음을 사람이 바꾼 판본도 같다(11-11) — 「다름 · 안 웃김」을 「같음」으로 바꾸면 고칠 것이 통과가 된다. 까닭이 보이게 한다.
    const overrides = Array.isArray(v.검수?.뜻?.사람판정) ? v.검수.뜻.사람판정 : [];
    if (st.ready && overrides.length) add(LOOK, 'rotation-verdict-human', p.account, `판본 ${key}: 뜻 검사에서 시험관 판정 ${overrides.length}개를 사람이 바꿨다 — ${overrides.map((o) => `${o.시험관} ${o.칸}(${o.앞} → ${o.뒤})`).join(' · ')}. 까닭을 본다(준비.json 돌림.판본.${key}.검수.뜻.사람판정)`);
  }
  return out;
}

// ⑫ 한 편의 같은 플랫폼 판 둘이 20시간 안이면 고칠 것 — 글자만 다른 거의 같은 영상이 우리 계정 둘에 같은 날 나가지 않게(유호님 10-26,
// LAB 장부 「두 채널 판」 — 버마어 판 시각을 다른 날로). 11-10 LAB 39계정(시간대 25개)부터 「같은 날」은 한국 날짜가 아니라 20시간이다
// (tools/lib/돌림.js ① — 한국 날짜로 나누면 23:30 · 00:30 두 판이 다른 날로 빠져나갔다). 유튜브는 언어가 다른 판끼리는 같은 날 된다.
// 같은 언어 묶음(같은 플랫폼에서 같은 말로 올리는 계정 — 원장 languageGroup, 없으면 판 언어 · 원장 language)은 24시간이다(돌림 ⑥ — 유호님 11-10 지적:
// 같은 언어를 쓰는 나라 계정끼리 같은 영상이 겹치지 않게. 24시간을 띄우면 어느 시간대의 달력으로 봐도 같은 날이 아니다).
const APART_HOURS = 20;
const SAME_LANGUAGE_HOURS = 24;
const VIDEO_PLATFORMS = new Set(['tiktok', 'youtube', 'instagram', 'facebook', 'telegram', 'xiaohongshu', 'douyin', 'vk', 'rutube']);
const languageGroupOf = (p, accounts) => accounts?.[p.account]?.languageGroup || p.language || accounts?.[p.account]?.language || '';
function samePlatformFindings(plates, { apartHours = APART_HOURS, sameLanguageHours = SAME_LANGUAGE_HOURS, accounts = null } = {}) {
  const list = plates.filter((p) => VIDEO_PLATFORMS.has(p.platform) && Number.isFinite(Date.parse(p.time || '')));
  const groups = new Map(); // 플랫폼(유튜브는 + 언어 묶음) → 20시간(유튜브 같은 언어는 24시간) 안에 붙은 판 무리
  for (const p of list) {
    const key = p.platform === 'youtube' ? `youtube|${languageGroupOf(p, accounts)}` : p.platform;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const out = [];
  for (const [key, ps] of groups) {
    ps.sort((x, y) => Date.parse(x.time) - Date.parse(y.time));
    let run = [ps[0]];
    const apart = key.startsWith('youtube') ? Math.max(apartHours, sameLanguageHours) : apartHours;
    const flush = () => {
      if (run.length < 2) return;
      const hours = Math.round((Date.parse(run[run.length - 1].time) - Date.parse(run[0].time)) / 360000) / 10;
      const tiktok = key === 'tiktok';
      out.push({ level: FIX, code: tiktok ? 'tiktok-same-day' : 'same-platform-close', where: run.map((p) => p.account).join(' · '),
        message: `같은 편의 ${tiktok ? '틱톡' : key.startsWith('youtube') ? '같은 언어 유튜브' : key} 판 ${run.length}개가 ${hours}시간 안에 나간다(${apart}시간 넘게 띄운다) — 돌림 판이면 node tools/돌림표.js --다시(그래도 남으면 한 계정의 돌림 판을 지우고 다음 날 다시 셈한다), 아니면 하나(보통 버마어 판)의 「시각」을 다른 빈 날로(LAB 장부 「두 채널 판」)` });
    };
    for (const p of ps.slice(1)) {
      if (Date.parse(p.time) - Date.parse(run[run.length - 1].time) < apart * 3600000) run.push(p);
      else { flush(); run = [p]; }
    }
    flush();
  }
  // 유튜브 밖의 같은 언어 묶음 — 플랫폼 전체 20시간은 넘겼지만 같은 말 두 계정이 24시간 안인 짝
  const byGroup = new Map();
  for (const p of list) {
    const g = languageGroupOf(p, accounts);
    if (p.platform === 'youtube' || !g) continue;
    const key = `${p.platform}|${g}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(p);
  }
  for (const [key, ps] of byGroup) {
    ps.sort((x, y) => Date.parse(x.time) - Date.parse(y.time));
    for (let i = 1; i < ps.length; i++) {
      const gap = Date.parse(ps[i].time) - Date.parse(ps[i - 1].time);
      if (ps[i].account === ps[i - 1].account || gap < apartHours * 3600000 || gap >= sameLanguageHours * 3600000) continue;
      out.push({ level: FIX, code: 'same-language-close', where: `${ps[i - 1].account} · ${ps[i].account}`,
        message: `같은 편이 같은 언어 묶음(${key.replace('|', ' · ')}) 두 계정에 ${Math.round(gap / 360000) / 10}시간 차이로 나간다(${sameLanguageHours}시간 넘게 띄운다) — 돌림 판이면 node tools/돌림표.js --다시` });
    }
  }
  return out;
}

// ⑩-2 칸 시각(11-10 — 마무리 세션 대조: 버마어 틱톡 판이 양곤 20:00인데 원장 칸은 21:00이었고 아무 도구도 짚지 않았다). 손으로 단 LAB 판의
// 현지 시각이 그 계정 칸(`dailyTimes`)에서 30분 넘게 벗어나면 확인할 것 — 가장 가까운 칸으로 세어지기는 하지만 약속한 현지 시각이 아니다.
// 돌림 판은 rotationFindings의 `rotation-slot`이 고칠 것으로 본다. 이미 예약 · 게시된 판은 보지 않는다(옮기지 않는다).
function slotTimeFindings(bundle, plates, { posted = null } = {}) {
  const out = [];
  if (bundle.prep?.브랜드 !== 'LAB') return out;
  for (const p of plates) {
    const a = bundle.accounts?.[p.account];
    const at = Date.parse(p.time || '');
    if (p.raw?.돌림 || !a || !a.timeZone || !Array.isArray(a.dailyTimes) || !a.dailyTimes.length || !Number.isFinite(at)) continue;
    if (posted && posted.has(p.account)) continue;
    const slot = T.slotFor(p.time, a);
    const off = Math.abs(T.localMinute(at, T.tzOf(a)) - T.minuteOf(slot.time));
    if (off > 30 && off < 24 * 60 - 30) out.push({ level: LOOK, code: 'slot-time', where: p.account, message: `판 시각이 현지 ${T.localTime(at, T.tzOf(a))}(${a.timeZone})인데 이 계정 칸은 ${T.allSlots(a).map((s) => `${s.time}${s.format ? ` ${s.format}` : ''}`).join(' · ')}다 — 아직 안 건 판이면 칸 시각으로 맞춘다(이미 예약한 판은 옮기지 않는다)` });
  }
  return out;
}

// ⑫-2 같은 언어 묶음의 같은 파일(돌림 ⑥ — 유호님 11-10 지적 — 같은 언어를 쓰는 나라 계정끼리 같은 영상이 겹치지 않게). LAB 편에서 같은 플랫폼 ·
// 같은 말 두 계정에 똑같은 영상 파일(지문)이 걸리면 고칠 것. 돌림 판이면 두 계정의 나라별판도 본다 — 표지 · 게시글(원고) 파일이 같거나,
// 판본 글에서 첫 카드(칸 「머리」) · 그 나라 예문(「예문」 · 「상황」) · 끝 질문(「끝질문」) · 게시글(「게시글」)이 같으면 고칠 것. 판본 글에 그 칸이
// 하나도 없어 견줄 수 없으면 확인할 것(눈으로 본다). 배속 · 색만 바꿔 지문을 다르게 하는 길은 쓰지 않는다 — 그래서 글 · 표지까지 본다.
const COUNTRY_SLOTS = [['첫 카드', ['머리']], ['그 나라 예문', ['예문', '상황']], ['끝 질문', ['끝질문']], ['게시글', ['게시글']]];
// 11-11 Fable 5.2 끝 판 검수 P3-3 — 글자 그대로 같을 때만 잡으면 대소문자 · 문장부호 · 이모지만 다른 꼴이 지나가고, 「바꿔 말한 꼴」(「He always told me…」 /
// 「He only ever told me…」)은 아예 안 보인다. 같음은 표기(대소문자 · 띄어쓰기 · 문장부호 · 기호)를 뺀 글로 견주고, 짧은 칸(첫 카드 · 끝 질문)은
// 낱말 겹침이 절반을 넘으면 확인할 것으로 보인다(막지는 않는다 — 나라마다 다르게 썼는지 사람이 본다). 예문 · 게시글은 가르치는 한국어 줄이 같아
// 겹침이 늘 높으니 같음만 본다.
const SIMILAR_SLOTS = new Set(['첫 카드', '끝 질문']);
const SIMILAR_AT = 0.5;
const plainOf = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const wordsOf = (s) => new Set(String(s || '').normalize('NFC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length > 1));
function overlapOf(a, b) {
  const [x, y] = [wordsOf(a), wordsOf(b)];
  if (x.size < 2 || y.size < 2) return 0; // 띄어 쓰지 않는 글 · 한 낱말 칸은 겹침으로 가르지 않는다
  let n = 0;
  for (const w of x) if (y.has(w)) n += 1;
  return n / (x.size + y.size - n);
}
function sameLanguageFindings(bundle, plates) {
  const out = [];
  if (bundle.prep?.브랜드 !== 'LAB') return out;
  const crypto = require('node:crypto');
  const shaMemo = new Map();
  // 이 작업본에 없으면 공용 작업본의 같은 경로(워크트리에는 git 밖 영상이 없다 — tools/lib/공용작업본.js 미디어경로)
  const fileIn = (p) => { if (!p) return null; for (const g of path.isAbsolute(p) ? [p] : [path.join(bundle.dir, p), path.join(bundle.repo || bundle.dir, p)]) { const f = 미디어경로(g); try { if (fs.statSync(f).isFile()) return f; } catch { /* 다음 자리 */ } } return null; };
  const shaOf = (p) => { const f = fileIn(p); if (!f) return null; if (!shaMemo.has(f)) shaMemo.set(f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')); return shaMemo.get(f); };
  const groups = new Map();
  for (const p of plates) {
    const g = languageGroupOf(p, bundle.accounts);
    if (!VIDEO_PLATFORMS.has(p.platform) || !g) continue;
    const key = `${p.platform}|${g}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const versions = bundle.prep.돌림?.판본 || {};
  const versionOf = (p) => { const a = bundle.accounts?.[p.account]; return p.raw?.돌림 && a ? versions[a.rotationVersion || a.countryCode] || null : null; };
  const linesOf1 = (v) => { const f = fileIn(v?.글); if (!f) return null; try { const j = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); return Array.isArray(j?.줄) ? j.줄 : null; } catch { return null; } };
  const textOf = (lines, names) => lines.filter((l) => l && names.includes(l.칸)).map((l) => String(l.글 || '').trim()).join('\n');
  for (const [key, ps] of groups) {
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const [x, y] = [ps[i], ps[j]];
      if (x.account === y.account) continue;
      const where = `${x.account} · ${y.account}`;
      const [fx, fy] = [x, y].map((p) => shaOf(p.video?.path || p.raw?.파일) || p.raw?.지문 || null);
      const samePath = Boolean(x.raw?.파일) && String(x.raw.파일).replace(/\\/g, '/') === String(y.raw?.파일 || '').replace(/\\/g, '/');
      if (samePath || (fx && fx === fy)) {
        out.push({ level: FIX, code: 'same-language-same-file', where, message: `같은 언어 묶음(${key.replace('|', ' · ')}) 두 계정에 똑같은 영상 파일이 걸렸다 — 계정마다 나라별판(첫 카드 · 그 나라 예문 · 끝 질문 · 표지 · 게시글이 다른 판)을 따로 만들어 건다. 배속 · 색만 바꾸지 않는다` });
        continue;
      }
      const [vx, vy] = [versionOf(x), versionOf(y)];
      if (!vx || !vy) continue;
      const same = [];
      const [cx, cy] = [shaOf(vx.표지), shaOf(vy.표지)];
      if (cx && cx === cy) same.push('표지');
      const [mx, my] = [shaOf(vx.원고?.[x.platform]), shaOf(vy.원고?.[y.platform])];
      if (mx && mx === my) same.push('게시글(원고 파일)');
      const [lx, ly] = [linesOf1(vx), linesOf1(vy)];
      let compared = 0;
      const similar = [];
      if (lx && ly) for (const [label, names] of COUNTRY_SLOTS) {
        const [tx, ty] = [textOf(lx, names), textOf(ly, names)];
        if (!tx || !ty) continue;
        compared += 1;
        if (plainOf(tx) === plainOf(ty)) { if (!same.includes(label)) same.push(label); continue; }
        const overlap = SIMILAR_SLOTS.has(label) ? overlapOf(tx, ty) : 0;
        if (overlap >= SIMILAR_AT) similar.push(`${label}(낱말 겹침 ${Math.round(overlap * 100)}% — 「${tx.replace(/\s+/g, ' ').slice(0, 40)}」 / 「${ty.replace(/\s+/g, ' ').slice(0, 40)}」)`);
      }
      if (same.length) out.push({ level: FIX, code: 'same-language-same-lines', where, message: `같은 언어 묶음(${key.replace('|', ' · ')}) 두 계정의 나라별판에서 ${same.join(' · ')}이(가) 같다 — 나라마다 다르게 쓴다(첫 카드 · 그 나라 예문 · 끝 질문 · 표지 · 게시글)` });
      if (similar.length) out.push({ level: LOOK, code: 'same-language-similar', where, message: `같은 언어 묶음(${key.replace('|', ' · ')}) 두 계정의 나라별판에서 ${similar.join(' · ')}이(가) 바꿔 말한 꼴로 닮았다 — 그 나라 말투 · 상황으로 다르게 썼는지 본다(다음에 고칠 때 더 벌린다)` });
      if (!same.length && !compared) out.push({ level: LOOK, code: 'same-language-unchecked', where, message: `같은 언어 묶음(${key.replace('|', ' · ')}) 두 계정의 나라별판 차이를 판본 글로 견주지 못했다(「글」 파일에 머리 · 예문 · 끝질문 칸이 없다) — 첫 카드 · 그 나라 예문 · 끝 질문이 나라마다 다른지 눈으로 본다` });
    }
  }
  return out;
}
const tiktokDayFindings = (plates) => samePlatformFindings(plates); // 옛 이름(시험 · 다른 도구가 부른다)

async function run(dir, opts = {}) {
  const bundle = 묶음.load(dir);
  const prep = bundle.prep;
  const out = path.join(bundle.repo, '.tmp', '올리기전검사', bundle.name);
  fs.rmSync(out, { recursive: true, force: true }); // 지난 검사의 검토 클립·장면표는 지운다(이 도구가 만든 폴더)
  fs.mkdirSync(out, { recursive: true });
  const findings = [];
  const add = (level, code, where, message) => findings.push({ level, code, where, message });
  const posted = new Map();
  // 한 계정에 줄이 여럿이면 게시 장부 · 예약큐 · 돌림표와 같은 읽기(rowOf — 11-11 Fable 5.2 다시 검수 P3-5). 마지막 줄만 보면
  // [예약됨#a, (다른 작업의) 취소됨#b]가 안 건 판으로 읽혀 이미 건 판을 다시 재고, 닫힌 칸 · 칸 시각 검사가 건 판을 안 건 판으로 본다.
  try {
    const rows = 묶음.readJson(path.join(bundle.dir, '게시', '게시결과.json')).판 || [];
    for (const account of new Set(rows.map((p) => p && p.계정).filter(Boolean))) posted.set(account, 장부.rowOf(rows, account)?.상태);
  } catch { /* 아직 없다 */ }

  if (!prep.브랜드) add(FIX, 'brand', '준비.json', '「브랜드」가 없다');
  const slotOk = /^\d{4}-\d{2}-\d{2}$/.test(prep.슬롯 || '');
  if (!slotOk) add(FIX, 'slot', '준비.json', '「슬롯」(올릴 날 YYYY-MM-DD)이 없다');
  if (prep.시한 && slotOk && prep.슬롯 > prep.시한) add(FIX, 'deadline', '준비.json', `슬롯 ${prep.슬롯}이 시한 ${prep.시한}을 넘는다`);
  if (!prep.기획) add(LOOK, 'pitch', '준비.json', '「기획」(기획 장부 줄 — 10-23부터 고른 기획만 만든다)이 없다');
  if (!(prep.판 || []).length) add(FIX, 'plates', '준비.json', '「판」이 비었다');

  const plates = 묶음.plates(bundle);
  const videos = new Map();
  const versionVideos = new Map(); // 돌림 판(나라 판본) 영상 — 가벼운 검사만
  const links = new Set();
  const texts = [];
  for (const plate of plates) {
    const where = plate.account || `판 ${plate.index + 1}`;
    const done = DONE.has(posted.get(plate.account));
    if (!plate.account || !bundle.accounts[plate.account]) add(FIX, 'account', where, `계정 키를 docs/마케팅/sns-계정.json에서 찾지 못했다`);
    const at = plate.time ? Date.parse(plate.time) : NaN;
    if (!plate.time || Number.isNaN(at) || !/[+-]\d{2}:?\d{2}$|Z$/.test(plate.time)) add(FIX, 'time', where, `「시각」이 시간대가 붙은 시각(YYYY-MM-DDTHH:MM+09:00)이 아니다: ${plate.time || '없음'}`);
    else {
      // LAB 두 채널 판은 그 줄의 목표 칸에 두니(버마어 틱톡은 몽골 틱톡과 다른 날) 편 슬롯과 날이 달라도 된다(10-26).
      // 돌림 판(11-10)은 돌림표가 계정마다 날을 어긋나게 정하니 편 슬롯과 날이 다른 것이 정상이다 — 칸은 rotationFindings가 본다.
      const ownDay = bundle.accounts[plate.account]?.dailyLine === 'LAB 두 채널' || Boolean(plate.raw?.돌림);
      if (slotOk && !ownDay && kst(at).slice(0, 10) !== prep.슬롯) add(LOOK, 'time-slot', where, `시각 ${plate.time}이 슬롯 ${prep.슬롯} 날이 아니다`);
      if (at < Date.now() && !done) add(LOOK, 'time-past', where, `시각 ${plate.time}이 이미 지났다 — 슬롯을 옮긴다`);
    }
    if (plate.blog) {
      if (!plate.article || !fs.existsSync(plate.article)) add(FIX, 'article', where, `원고 파일이 없다: ${plate.raw.파일 || plate.raw.게시글 || '없음'}`);
      continue;
    }
    if (!plate.video) { add(FIX, 'no-video', where, '「파일」에 영상이 없다'); continue; }
    if (!plate.video.exists) add(FIX, 'video-missing', where, `영상 파일이 없다: ${묶음.rel(bundle, plate.video.path)}`);
    else {
      if (plate.video.reduced) add(API_PLATFORMS.has(plate.platform) ? FIX : LOOK, 'reduced-copy', where,
        `화질을 낮춘 사본(${path.basename(plate.video.path)})만 적혀 있다 — 「원본」에 마감 원본을 적는다(v2 §2-4, 서버·API는 원본으로 올린다)`);
      if (plate.video.from === '추정') add(LOOK, 'original-guessed', where, `원본을 이름으로 짐작했다(${path.basename(plate.video.path)}) — 판에 「원본」을 적는다`);
      const into = plate.raw?.돌림 ? versionVideos : videos;
      if (!into.has(plate.video.path)) into.set(plate.video.path, []);
      into.get(plate.video.path).push(plate);
    }
    if (!plate.texts.source.length) add(FIX, 'no-text', where, '게시글을 찾지 못했다 — 판에 「원고」(원고.json) 또는 「게시글」을 적는다');
    for (const f of 규칙.checkPlate(plate.texts, { brand: prep.브랜드, language: plate.language, platform: plate.platform })) add(f.level, f.code, `${where} ${f.where}`, f.message);
    for (const t of [plate.texts.title, plate.texts.caption, plate.texts.firstComment, plate.texts.pinnedComment]) if (t) { texts.push(t); 규칙.urls(t).forEach((u) => links.add(u)); }
    if (plate.platform === 'youtube') {
      if (!plate.language || !LANG.test(plate.language)) add(FIX, 'language', where, '제목·설명 언어가 없다(판 「언어」 또는 원고.json language — 예: ko·en)');
      if (!plate.audioLanguage || !LANG.test(plate.audioLanguage)) add(FIX, 'audio-language', where, '동영상 언어(실제로 말하는 언어)가 없다(원고.json audioLanguage)');
      if (plate.kids === null) add(FIX, 'kids', where, '「아동용」 칸이 없다(아동용 아님이면 false)');
      else if (plate.kids === true) add(LOOK, 'kids-true', where, '아동용으로 적혀 있다 — 댓글·알림이 막힌다. 맞는지 본다');
      if (plate.video?.exists && fs.statSync(plate.video.path).size > SERVER_YOUTUBE_LIMIT) add(LOOK, 'youtube-size', where, '100MiB가 넘는다 — 작업실 직접 게시는 100MiB까지다');
    }
    if (plate.ai === null) add(API_PLATFORMS.has(plate.platform) ? FIX : LOOK, 'ai-label', where, '「AI표시」 칸이 없다(AI 목소리·AI 그림이 있으면 true)');
    if (!plate.cover && ['youtube', 'instagram', 'tiktok', 'xiaohongshu'].includes(plate.platform)) add(LOOK, 'cover', where, '표지 파일이 없다 — 첫 화면이 표지가 된다');
  }

  findings.push(...tiktokFindings(plates, prep, bundle.accounts));
  findings.push(...dailyFindings(plates, prep, bundle.accounts));
  findings.push(...rotationFindings(bundle, plates));
  findings.push(...closedFindings(bundle, plates, { posted }));
  // 그림 검사 기록(11-11 Fable 5.2 끝 판 검수 P2-11) — 게시/그림검사.json이 있는 편만 본다: 「다시 굽기」로 나온 그림을 판단 없이 썼거나, 검사 뒤 그림이
  // 바뀌었거나, 답이 빠진 기록이면 확인할 것으로 보인다(막지는 않는다 — 결과가 문서에만 있고 도구 · 관문이 모르던 것을 보이게 한다).
  try {
    const 그림상태 = 그림검사.상태(bundle.dir);
    if (그림상태.있음) for (const m of 그림상태.문제) add(LOOK, 'image-check', '게시/그림검사.json', m);
  } catch (error) { add(LOOK, 'image-check', '게시/그림검사.json', `그림 검사 기록을 못 읽었다(${String(error.message).slice(0, 120)})`); }
  findings.push(...samePlatformFindings(plates, { accounts: bundle.accounts }));
  findings.push(...sameLanguageFindings(bundle, plates));
  findings.push(...slotTimeFindings(bundle, plates, { posted: new Set([...posted].filter(([, state]) => DONE.has(state)).map(([account]) => account)) }));
  if (slotOk && prep.슬롯 === kst().slice(0, 10) && ![...posted.values()].some((v) => DONE.has(v))) {
    add(LOOK, 'slot-today', '준비.json', `슬롯이 오늘(${prep.슬롯})이다 — ${prep.브랜드 === 'LAB' ? '5일 앞(D+5 — 11-10 LAB 하루 두 편)' : '4일 앞(D+4)'}에 만들어 승인을 미리 받는 것이 기본(제작 절차 0)`);
  }

  const homage = homageFindings(bundle, [...videos.keys()]);
  findings.push(...homage.findings);
  // 돌림 원본의 나라 판본 영상도 맹검한 영상으로 받는다(⑱ — 11-10 지마: 씨앗이 나간 뒤 저녁 그림을 고쳐 판본을 다시 렌더했다. tools/lib/미학관문.js 바뀐영상)
  const 판본영상 = Object.values(prep.돌림?.판본 || {}).map((v) => v && v.파일 && 미디어경로(path.resolve(bundle.dir, v.파일))).filter(Boolean);
  findings.push(...aestheticFindings(bundle, [...videos.keys()], { 판본영상 }));
  findings.push(...musicLayerFindings(bundle, [...videos.keys()]));
  let repeat = { findings: [], summary: null };
  try { repeat = 반복.repeatFindings(bundle, plates, { skipOcr: opts.skipOcr, work: out }); } catch (error) {
    add(LOOK, 'repeat-failed', '지난 편', `지난 편 되풀이를 못 봤다(${error.message}) — 첫 · 끝 장면과 끝 줄을 지난 두 편과 눈으로 견준다`);
  }
  findings.push(...repeat.findings);
  const fileSummaries = [];
  const ocrFindings = [];
  const screenTexts = [];
  const hanLanguage = (plate) => /^(zh|ja)/.test(plate.language || '') || plate.platform === 'xiaohongshu';
  const shots = shotRanges(bundle.prep);
  if (shots.error) add(LOOK, 'shot-ranges', '준비.json', shots.error);
  // 이미 나간 판만 쓰는 파일(예약 · 게시됐고 시각이 지남)은 다시 재지 않는다 — 올릴 것이 없고, 그때 기준으로 이미 본 파일이다. 돌림 원본은
  // 씨앗 판이 나간 뒤에 나라 판본이 붙으므로, 다시 재면 뒤에 생긴 규격(오디오 320kbps 등)으로 옛 씨앗 파일이 걸려 새 판본까지 막힌다(11-10 모의).
  const outAlready = (p) => DONE.has(posted.get(p.account)) && Date.parse(p.time || '') < Date.now();
  for (const [file, users] of versionVideos) {
    if (videos.has(file) || users.every(outAlready)) continue;
    try {
      const label = labelOf(bundle, file);
      const r = await checkVideo(file, out, { skipOcr: true, repo: bundle.repo, allowHan: true, label, light: true });
      findings.push(...r.findings);
      fileSummaries.push({ 경로: 묶음.rel(bundle, file), 판: users.map((p) => p.account), ...r.summary });
    } catch (error) {
      add(FIX, 'video-check', path.basename(file), `영상 검사 실패: ${error.message}`);
    }
  }
  for (const [file, users] of videos) {
    if (versionVideos.size && users.every(outAlready)) continue;
    try {
      const label = labelOf(bundle, file);
      const h = homage.per.get(file);
      const r = await checkVideo(file, out, { skipOcr: opts.skipOcr, repo: bundle.repo, allowHan: users.some(hanLanguage), label, homage: h && h.그대로 ? h : null, shots });
      findings.push(...r.findings);
      ocrFindings.push(...r.ocrFindings);
      screenTexts.push(r.ocrText);
      fileSummaries.push({ 경로: 묶음.rel(bundle, file), 판: users.map((p) => p.account), ...r.summary });
    } catch (error) {
      add(FIX, 'video-check', path.basename(file), `영상 검사 실패: ${error.message}`);
    }
  }
  if (!opts.skipOcr) {
    // 같은 표지 파일을 여러 판이 쓰면 한 번만 읽고, 한자 허용은 그 판들 가운데 하나라도 중국어·일본어면, 계정은 모두 적는다.
    const covers = new Map();
    for (const plate of plates) if (plate.cover) covers.set(plate.cover, [...(covers.get(plate.cover) || []), plate]);
    // 판마다 같은 표지 틀이면 같은 줄이 걸린다 — 글이 같은 줄은 한 줄로 합친다.
    const byMessage = new Map();
    for (const [cover, users] of covers) {
      const accounts = users.map((p) => p.account);
      try {
        for (const f of ocrCover(cover, path.join(out, '표지_' + users[0].index), `${accounts.join(' · ')} 표지`, { allowHan: users.some(hanLanguage) })) {
          byMessage.set(f.message, [...(byMessage.get(f.message) || []), ...accounts]);
        }
      } catch (error) {
        add(LOOK, 'ocr-failed', `${accounts.join(' · ')} 표지`, `표지 글자 인식을 못 했다(${error.message})`);
      }
    }
    for (const [message, accounts] of byMessage) add(LOOK, 'cover-safe-area', `표지(${accounts.join(' · ')})`, message);
  }
  findings.push(...mergeAcrossFiles(ocrFindings));
  const script = 묶음.scriptText(bundle);
  let voice = { findings: [], summary: null };
  try { voice = await voiceFindings(bundle, [...videos.keys()], { scriptText: script.text }); } catch (error) {
    voice.findings.push({ level: LOOK, code: 'voice-failed', where: '목소리', message: `목소리 검사를 못 했다(${error.message}) — 귀로 듣는다` });
  }
  findings.push(...voice.findings);
  for (const html of [].concat(prep.키트원고 || [])) {
    const file = 묶음.resolve(bundle, html);
    if (!file || !fs.existsSync(file)) { add(FIX, 'kit-missing', '키트원고', `키트 원고가 없다: ${html}`); continue; }
    findings.push(...kitCheck(bundle, file, path.join(out, '키트_' + path.basename(file, '.html'))));
  }

  const docs = 묶음.companionTexts(bundle).map((d) => ({ ...d, name: `${d.kind} ${path.basename(d.file)}` }));
  for (const doc of docs) {
    // 판에 없는 초안(링크드인 등)은 오늘 올라가지 않으니 확인만 한다.
    for (const f of 규칙.checkText(doc.text, { where: doc.name, brand: prep.브랜드, language: 'ko', platform: 'blog', article: true })) add(doc.scheduled ? f.level : LOOK, f.code, f.where, f.message);
  }
  findings.push(...규칙.compareNumbers(docs, [...texts, ...screenTexts, script.text]));
  if (!opts.skipLinks) findings.push(...await checkLinks([...links]));
  findings.push(...await promptFindings(prep, { repo: bundle.repo, skipLinks: opts.skipLinks }));

  const fixes = findings.filter((f) => f.level === FIX);
  const looks = findings.filter((f) => f.level === LOOK);
  const result = fixes.length ? FIX : looks.length ? LOOK : '통과';
  const line = (f) => `${f.where} · ${f.message}`;
  const record = {
    도구: 'tools/올리기전검사.js', 시각: kst(), 결과: result,
    고칠것: fixes.map(line), 확인할것: looks.map(line), 파일: fileSummaries, ...(voice.summary ? { 목소리: voice.summary } : {}),
    ...(repeat.summary?.지난편?.length ? { 지난편: repeat.summary.지난편 } : {}),
    ...(opts.skipOcr || opts.skipLinks ? { 건너뜀: [opts.skipOcr && '글자 인식', opts.skipLinks && '링크'].filter(Boolean) } : {}),
    기록: path.relative(bundle.repo, out).split(path.sep).join('/'),
  };
  fs.writeFileSync(path.join(out, '검사.json'), JSON.stringify({ ...record, 항목: findings, 대본: script.files }, null, 2) + '\n');
  if (!opts.noSave) {
    const fresh = 묶음.readJson(bundle.file); // 검사하는 동안 다른 칸이 바뀌었을 수 있어 다시 읽고 「검사」만 바꾼다
    fresh.검사 = record;
    fs.writeFileSync(bundle.file, JSON.stringify(fresh, null, 2) + '\n');
  }
  return { bundle, record, findings };
}

function parseArgs(argv) {
  const opts = { json: argv.includes('--json'), noSave: argv.includes('--저장안함'), skipLinks: argv.includes('--링크건너뛰기'), skipOcr: argv.includes('--글자인식건너뛰기') };
  const dirs = argv.filter((a) => !a.startsWith('--'));
  return { opts, dirs };
}

async function main() {
  const { opts, dirs } = parseArgs(process.argv.slice(2));
  if (dirs.length !== 1) {
    console.error('사용: node tools/올리기전검사.js <편 폴더> [--json] [--저장안함] [--링크건너뛰기] [--글자인식건너뛰기]');
    process.exitCode = 2;
    return;
  }
  const { bundle, record, findings } = await run(dirs[0], opts);
  if (opts.json) console.log(JSON.stringify({ ...record, 항목: findings }, null, 2));
  else {
    console.log(`올리기 전 검사 · ${bundle.name} · ${record.결과}${opts.noSave ? '' : ' (준비.json 「검사」에 남김)'}`);
    for (const f of record.파일) console.log(`  영상 ${f.경로.split('/').slice(-2).join('/')} · ${f.길이}초 · ${f.해상도} · 평균 ${f.평균Mbps}Mbps · ${f.음량} LUFS / ${f.봉우리} dBFS · 정지 ${f.정지} · 끝 화면 ${f.끝화면 ?? '모름'}초 · 가장 긴 한 구성 ${f.한구성}초 · 소리 빈자리 ${f.소리빈자리 ? `${f.소리빈자리.합}초(최장 ${f.소리빈자리.최장}초)` : '모름'}`);
    if (record.목소리) console.log(`  목소리 줄 ${record.목소리.줄}개 · 최고 음높이 ${record.목소리.최고음높이 ?? '모름'}Hz · 잘린 줄 ${record.목소리.잘림}`);
    if (record.고칠것.length) { console.log(`고칠 것 ${record.고칠것.length}`); record.고칠것.forEach((x) => console.log(`  ✗ ${x}`)); }
    if (record.확인할것.length) { console.log(`확인할 것 ${record.확인할것.length}`); record.확인할것.forEach((x) => console.log(`  ? ${x}`)); }
    console.log(`  기록: ${record.기록}`);
  }
  if (record.결과 === FIX) process.exitCode = 1;
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 2; });

module.exports = { run, linesOf, problemsOf, promptFindings, tiktokFindings, dailyFindings, tiktokDayFindings, samePlatformFindings, sameLanguageFindings, slotTimeFindings, rotationFindings, closedFindings, labelOf, plainWhite, shotRanges, inShot, voiceFiles, voiceFindings, parseTangle, tangledVoices,
  homageFindings, aestheticFindings, AESTHETIC_FROM, compositionLikeOriginal, stillLikeOriginal, gapFinding, SAFE };
