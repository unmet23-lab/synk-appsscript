'use strict';
/* 판본 잇기(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 6 · 11 · 12 · 13 · 22). 판본 틀(S0)의 판본 글과 검수 도구(C)의 판본글/1을 잇는다.
 *
 * 틀(S0)은 편마다 remotion/src/<접두>/판본/<KEY>.json(Remotion이 읽는 글 묶음 — hook · reads · means … 칸 이름이 편마다 다르다)을 쓰고,
 * 검수 도구(tools/글자검사.js · tools/뜻검사.js · tools/현지어대조.js · tools/올리기전검사.js ⑫-2)는 판본글/1(tools/lib/판본글.js — 줄 · 칸 · 상자)을
 * 읽는다. 이 모듈은 편 폴더의 「판본지도.json」으로 둘을 잇는다:
 *
 *   판본 글(<판본폴더>/<KEY>.json) + 판본지도.json + 판본 원고(게시/판본/<KEY>/원고_<플랫폼>.json) → 게시/판본/<KEY>/글.json(판본글/1)
 *
 * 준비.json 「돌림」.판본[KEY].글은 이 글.json을 가리킨다 — 뜻 검수 지문은 글.json의 SHA-256이다(tools/돌림표.js). 글.json은 원천에서 그대로
 * 다시 뽑는 파일이라(같은 원천이면 같은 바이트 — 시각 · 지문을 넣지 않는다) 판본 글 · 지도 · 원고를 고치고 다시 뽑으면 지문이 바뀌어 뜻 검수가
 * 저절로 무효가 된다. 다시 뽑기를 잊지 않게 글자검사 · 뜻검사의 「판본」 명령이 검사 전에 맞추기()를 부르고, 뜻검사 채점 기록은 낡은 글이면 거절한다.
 * 손으로 글.json을 고치지 않는다(다음 맞추기가 덮는다).
 *
 * 판본지도.json(편 폴더 바로 아래 — 한 편에 하나, 판본 키와 상관없이 같다):
 * { "꼴": "판본지도/1", "틀": "이야기" | "퀴즈", "판본폴더": "remotion/src/m22/판본", "낼곳": "게시/판본"(기본),
 *   "기준": { "한문장", "핵심": [[낱말…]…], "웃음", "핵심덧": [{ "묶음": 0, "값": "rule" }] }   ← 뜻 검사 채점 기준(한국어 — 판본마다 같다).
 *             핵심덧은 그 판본 글의 낱말(현지어 「하지 마」)을 그 핵심 묶음에 더한다
 *   "문화소재": "<까닭 한 줄>" | true   ← (선택) 한국 문화 · 금기 · 풍습이 소재인 편(설계 12 「문화 소재 판은 시험관 넷」). 뽑은 글.json 맨 위
 *             「문화소재」에 같은 값이 실려 뜻 검사(tools/뜻검사.js 넷판단)가 판본마다 시험관 넷으로 본다. 적지 않은 편의 글.json에는 칸이 생기지 않는다
 *             (11-13 「사층F」 — 지도에서 켤 길이 없어 문화 소재 편이 시험관 둘로 통과했다). 켜거나 끄면 그 편 글.json 지문이 바뀌어 뜻 검수를 다시 받는다
 *   "기본값": { "reads": ["meok-ji ma", …] }                    ← 「채우기」가 입력에 없는 칸에 넣는 값(판본마다 같은 로마자 읽는 법 등)
 *   "원고기본": { "*": { "alteredContent": false }, "youtube": { "madeForKids": false } }   ← 「채우기」가 원고마다 깔아 두는 칸.
 *       동영상 언어(audioLanguage)는 적지 않으면 그 판 말이다(설계 게시경로 2-1 — ko로 두면 쇼츠 피드에 거의 안 실린다, 11-05 실측)
 *   "원고": { "MN": { "instagram": "게시/01-ig-fb-mn/원고.json" } }   ← (선택) 이미 있는 원고를 쓰는 판본. 없으면 <낼곳>/<KEY>/원고_<플랫폼>.json
 *   "퀴즈": [ … 판본글/1 「퀴즈」 그대로 … ],
 *   "줄": [ { "id": "hook", "칸": "머리", "값": "hook"(판본 글의 칸 — 배열은 "reads.0"), "선택": true(빈 글이면 줄을 뺀다),
 *             "글": "먹지 마!"(값 대신 — 판본마다 같은 한국어 줄), "원문": "<한국어 원문>"(판본 글 「_원문」[값]이 있으면 그것 — 나라마다 다른 칸),
 *             "초": [0, 1.6], "장면": "<그때 화면 — 한국어>", "크기": "hookSize"(상자 글자크기를 판본 글의 그 칸에서),
 *             "상자": { "폭", "굵기", "줄높이", "판본줄높이": true(줄높이 = max(줄높이, 판본 글 lineH)), "최대줄", "줄바꿈", "가운데", "x", "y",
 *                       "글꼴"(없으면 판본 글 font) } } … ] }
 * 판본 글의 `_`로 시작하는 칸은 Remotion이 읽지 않는다: 「_원문」 { "<값>": "<이 판본만의 한국어 뜻>" } — 첫 카드 · 끝 카드 · 끝 질문처럼 나라마다 다른 칸.
 * 원고_<플랫폼>.json은 tools/sns-발행.js 원고 꼴(title · caption · firstComment · pinnedComment · language …) 그대로이고, 「_원문」 { title, caption, … }에
 * 같은 줄 수의 한국어 원문을 둔다. 제목 · 본문 줄마다 칸 「게시글」 줄이 된다(해시태그만 있는 줄 · 서명 줄 · 주소만 있는 줄은 뺀다, 플랫폼끼리 같은 줄은 한 번만).
 * 원고 「_칸」 { "caption": { "2": "예문" } }은 본문 둘째 줄을 칸 「예문」으로 낸다 — 그 나라 상황 예문처럼 같은 언어 묶음 검사가 따로 견줄 줄.
 *
 * 나라 인사(11-12 유호님 「(가) 인사 카드」 — 훅 앞에 그 나라 인사 장면을 두고 원본을 그대로 잇는다)가 있는 편은 지도에 「인사」를 둔다:
 *   "인사": { "켬": "hello"(판본 글의 이 칸이 찬 판본만 인사가 있다), "초": "helloSec"(인사 길이 — 판본 글의 그 칸, 수를 적으면 모든 판본이 그 값),
 *             "자산": "remotion/public/greet"(판본마다 다른 인사 그림 · 목소리 <KEY>.jpg · <KEY>.wav가 든 폴더),
 *             "줄": [ { "id": "hello", "칸": "진행", "값": "hello", "원문": "안녕", "장면": "…" } … ] }
 *   - 인사가 있는 판본은 인사 줄이 [0, 인사 초]에 실리고, 지도 「줄」의 초는 모두 인사 초만큼 뒤로 민다(원본 박자는 지도에 한 번만 적는다).
 *   - 인사 자산 폴더의 <KEY>.<확장자> 파일은 원본 자산 지문에서 뺀다 — 나라 하나의 인사를 더하거나 고쳐도 다른 판본의 렌더는 낡지 않는다.
 *     그 판본의 인사 파일 지문은 렌더.json 「인사sha256」이 따로 지킨다(렌더문제).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const 판본글 = require('./판본글.js');
const 게시글규칙 = require('./게시글규칙.js');
const 틀들 = require('./돌림.js').FORMATS; // 이야기 · 노래 · 퀴즈 — 판본 지도의 틀 = 돌림 형식(21:00 칸은 11-10 밤부터 노래)

// 렌더.json 「글sha256」은 렌더할 때 판본 글 원천 파일(remotion/src/<틀>/판본/<키>.json)의 바이트 지문이다. 작업본은 올리기 · 따라가기 때
// 줄끝을 CRLF로 다시 쓸 수 있어(11-10 화날때 — LF로 쓰고 렌더한 원천이 올리기 뒤 CRLF로 내려와 26판본이 「렌더 뒤 글이 바뀜」으로 보였다)
// 줄끝만 다른 판은 같은 글로 본다. 글 한 자라도 다르면 다른 글이다.
function 같은글(지문, file) {
  const raw = fs.readFileSync(file);
  const h = (b) => crypto.createHash('sha256').update(b).digest('hex');
  if (h(raw) === 지문) return true;
  const lf = raw.toString('utf8').replace(/\r\n/g, '\n');
  return h(Buffer.from(lf, 'utf8')) === 지문 || h(Buffer.from(lf.replace(/\n/g, '\r\n'), 'utf8')) === 지문;
}

// ── 렌더 자산 지문(11-11 Fable 5.2 끝 판 검수 P1-3) ────────────────────────────────────────────────
// 판본 영상은 판본 글(글sha256)만이 아니라 원본의 그림 · 소리 · 틀(remotion public · src)로 굽는다. 원본 그림을 고친 뒤 다시 렌더하지 않은
// 판본은 영상 지문이 그대로라 글자 검수 「통과」가 옛 그림 영상에 붙은 채 돌림에 들 수 있었다(11-10 「지마」 저녁 그림을 18:09에 고쳤는데
// 그 전에 구운 일곱 판본 — 태국 · 캄보디아판 11.5초에 몽글이 의자 없이 떠 있다). 렌더할 때 그 자산들의 지문을 렌더.json 「자산sha256」에 적고,
// 돌림 관문(tools/돌림표.js versionState)이 지금 자산과 견준다. 판본 글(<판본폴더>/<KEY>.json)은 글sha256이 따로 지키니 뺀다.
// 글 파일은 줄끝(CRLF · LF)을 맞춘 뒤 센다 — 작업본은 올리기 · 따라가기 때 줄끝을 다시 쓴다(위 같은글과 같은 까닭). 그림 · 소리는 바이트 그대로.
// 글인지는 git과 같은 셈(앞 8000바이트에 NUL이 없으면 글)으로 가른다 — 확장자로 가르면 git이 글로 보고 줄끝을 바꾸는 파일을 놓친다.
const 자산건너뜀 = new Set(['node_modules', 'out', 'dist', '.remotion', '.git']);
const 해시 = (b) => crypto.createHash('sha256').update(b).digest('hex');
function 자산파일지문(raw) {
  if (raw.subarray(0, 8000).includes(0) || !raw.includes(13)) return 해시(raw);
  const out = Buffer.allocUnsafe(raw.length);
  let n = 0;
  for (let i = 0; i < raw.length; i += 1) { if (raw[i] === 13 && raw[i + 1] === 10) continue; out[n] = raw[i]; n += 1; }
  return 해시(out.subarray(0, n));
}

/** 판본 영상이 읽는 원본 자산 자리(편 폴더 기준) — 지도 「자산」(폴더 · 파일 목록)이 있으면 그것, 없으면 판본폴더가 든 remotion 뿌리의 public · src */
function 자산자리(지도) {
  if (Array.isArray(지도.자산) && 지도.자산.length) return 지도.자산.map((p) => String(p).split('\\').join('/'));
  const 조각 = String(지도.판본폴더 || '').split('\\').join('/').split('/').filter(Boolean);
  const i = 조각.indexOf('src');
  if (i < 0) return [조각.slice(0, -1).join('/') || '.'];
  const 뿌리 = 조각.slice(0, i).join('/');
  return [뿌리 ? `${뿌리}/public` : 'public', 뿌리 ? `${뿌리}/src` : 'src'];
}

// ── 나라 인사(11-12) — 판본마다 다른 인사 그림 · 목소리는 지도 「인사」.자산 폴더 바로 아래 <KEY>.<확장자>다 ──
const 인사파일식 = /^[A-Z]{2}\.[A-Za-z0-9]+$/;
const 인사폴더 = (지도) => (지도 && 지도.인사 && typeof 지도.인사.자산 === 'string' ? 지도.인사.자산.split('\\').join('/').replace(/\/+$/, '') : '');

/** 이 판본의 인사 자산 지문 → { 지문, 수, 파일: [이름…] }. 지도에 「인사」가 없거나 그 키의 파일이 없으면 null. */
function 인사지문(편, 지도, 키) {
  const 자리 = 인사폴더(지도);
  if (!자리) return null;
  const 폴더 = path.join(path.resolve(편), 자리);
  if (!fs.existsSync(폴더)) return null;
  const 파일 = fs.readdirSync(폴더).filter((f) => 인사파일식.test(f) && f.startsWith(`${키}.`)).sort();
  if (!파일.length) return null;
  const h = crypto.createHash('sha256');
  for (const f of 파일) h.update(`${f}\0${자산파일지문(fs.readFileSync(path.join(폴더, f)))}\n`);
  return { 지문: h.digest('hex'), 수: 파일.length, 파일 };
}

/** 이 판본 글에 인사가 있나 → 인사 길이(초). 없으면 0. 켜졌는데 길이가 수가 아니면 던진다. */
function 인사초(지도, 팩, 키 = '') {
  const 인사 = 지도 && 지도.인사;
  if (!인사) return 0;
  const 켬 = 값꺼내기(팩, 인사.켬 || 'hello');
  if (typeof 켬 !== 'string' || !켬.trim()) return 0;
  const 초 = typeof 인사.초 === 'number' ? 인사.초 : 값꺼내기(팩, 인사.초 || 'helloSec');
  if (!(typeof 초 === 'number' && Number.isFinite(초) && 초 > 0 && 초 <= 3)) throw new Error(`판본 ${키}: 인사가 켜졌는데(${인사.켬 || 'hello'}) 인사 길이(${typeof 인사.초 === 'number' ? '지도 「인사」.초' : 인사.초 || 'helloSec'})가 0~3초의 수가 아니다(${JSON.stringify(초)})`);
  return 초;
}

/** 자산 파일 목록 — [{ 이름(편 폴더 기준 · 빗금), 파일 }] 이름 순. 판본 글 · 판본별 인사 자산 · 숨김 파일 · node_modules · out은 뺀다. */
function 자산파일들(편, 지도) {
  const 뿌리 = path.resolve(편);
  const 판본자리 = String(지도.판본폴더 || '').split('\\').join('/').replace(/\/+$/, '');
  const 인사자리 = 인사폴더(지도);
  const out = [];
  const 걷기 = (abs) => {
    let st;
    try { st = fs.statSync(abs); } catch { return; }
    const 이름 = path.relative(뿌리, abs).split(path.sep).join('/');
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(abs).sort()) {
        if (f.startsWith('.') || 자산건너뜀.has(f)) continue;
        걷기(path.join(abs, f));
      }
      return;
    }
    if (판본자리 && 이름.startsWith(`${판본자리}/`) && /^[A-Z]{2}\.json$/.test(path.basename(abs))) return; // 판본 글 — 글sha256이 지킨다
    if (인사자리 && 이름.startsWith(`${인사자리}/`) && 인사파일식.test(이름.slice(인사자리.length + 1))) return; // 판본별 인사 그림 · 목소리 — 인사sha256이 지킨다
    out.push({ 이름, 파일: abs, 크기: st.size, 때: st.mtimeMs });
  };
  for (const 자리 of 자산자리(지도)) 걷기(path.join(뿌리, 자리));
  return out.sort((a, b) => (a.이름 < b.이름 ? -1 : a.이름 > b.이름 ? 1 : 0));
}

const 자산기억 = new Map(); // 편 폴더 → { 서명(이름 · 크기 · 수정 시각), 결과 } — 돌림표가 판본마다 불러도 파일은 한 번만 읽는다
/** 지금 자산의 지문 → { 지문, 수 }. 지도는 판본 지도(없으면 { 판본폴더 }만 줘도 된다 — 판본렌더.mjs). */
function 자산지문(편, 지도 = null) {
  const 쓸지도 = 지도 || 지도읽기(편).지도;
  const 목록 = 자산파일들(편, 쓸지도);
  const 서명 = 목록.map((f) => `${f.이름}|${f.크기}|${f.때}`).join('\n');
  const 열쇠 = `${path.resolve(편)}|${자산자리(쓸지도).join(',')}`;
  const 있던 = 자산기억.get(열쇠);
  if (있던 && 있던.서명 === 서명) return 있던.결과;
  const h = crypto.createHash('sha256');
  for (const f of 목록) {
    h.update(`${f.이름}\0${자산파일지문(fs.readFileSync(f.파일))}\n`);
  }
  const 결과 = { 지문: h.digest('hex'), 수: 목록.length };
  자산기억.set(열쇠, { 서명, 결과 });
  return 결과;
}

/**
 * 판본 영상이 지금 원천(판본 글 · 자산)으로 구운 것인가 — 렌더.json과 견준다. 문제가 없으면 null, 있으면 그 까닭 한 줄.
 * 영상지문을 주면 렌더 기록의 영상 지문과도 견준다(다른 영상에 붙은 렌더 기록을 믿지 않게).
 */
function 렌더문제(편, 키, { 지도: 준지도 = null, 영상지문 = null } = {}) {
  const 지도 = 준지도 || 지도읽기(편).지도;
  const 다시 = `node 판본렌더.mjs ${키} → 글자 검사 다시`;
  const 렌더 = path.join(편폴더(편), 낼곳(지도), 키, '렌더.json');
  if (!fs.existsSync(렌더)) return `렌더 기록(렌더.json)이 없다 — 영상이 지금 판본 글 · 그림으로 구운 것인지 알 수 없다(${다시})`;
  let j;
  try { j = 판본글.readJson(렌더); } catch { return `렌더 기록(렌더.json)을 못 읽는다 — ${다시}`; }
  if (!j || !j.글sha256 || !j.영상sha256) return `렌더 기록에 글 · 영상 지문이 없다(표지만 뜬 기록) — ${다시}`;
  const 팩 = 팩경로(편, 지도, 키);
  if (!fs.existsSync(팩) || !같은글(j.글sha256, 팩)) return `영상이 지금 판본 글로 구운 것이 아니다(렌더 뒤 글이 바뀜) — ${다시}`;
  if (영상지문 && j.영상sha256 !== 영상지문) return `영상이 렌더 기록(렌더.json)과 다르다 — ${다시}`;
  if (!j.자산sha256) return `렌더 기록에 자산 지문이 없다 — 원본 그림 · 소리 · 틀이 렌더 뒤 바뀌었는지 알 수 없다(${다시})`;
  if (j.자산sha256 !== 자산지문(편, 지도).지문) return `렌더 뒤 원본 그림 · 소리 · 틀(${자산자리(지도).join(' · ')})이 바뀌었다 — ${다시}`;
  // 나라 인사 — 그 판본의 인사 그림 · 목소리는 공통 자산 지문 밖이라 따로 견준다. 인사가 켜진 판본인데 파일이 없으면 구울 수 없는 판본이다.
  if (지도.인사) {
    const 지금 = 인사지문(편, 지도, 키);
    let 켜짐 = 0;
    try { 켜짐 = 인사초(지도, 판본글.readJson(팩), 키); } catch (e) { return `${e.message} — ${다시}`; }
    if (켜짐 && !지금) return `인사가 켜진 판본인데 인사 그림 · 목소리(${인사폴더(지도)}/${키}.*)가 없다 — ${다시}`;
    if ((j.인사sha256 || null) !== ((켜짐 && 지금 && 지금.지문) || null)) return `렌더 뒤 이 판본의 인사 그림 · 목소리(${인사폴더(지도)}/${키}.*)가 바뀌었다 — ${다시}`;
  }
  return null;
}

/**
 * 돌림표 · 올리기 전 검사가 부른다(tools/돌림표.js versionState) — 판본 지도가 있는 편에서 렌더문제를 본다. 지도가 없는 편이면 null(볼 것이 없다),
 * 문제가 없으면 false, 있으면 까닭. 지도가 있는데 준비.json 판본의 「글」이 지도의 글.json이 아니면 그 까닭을 돌려준다(이음문제 — 닫는다, 11-11 밤 P1-렌1).
 */
function 렌더낡음(편, 키, 준비판본, 옵션 = {}) {
  if (!있나(편)) return null;
  const { 지도 } = 지도읽기(편);
  const 끊김 = 이음문제(편, 키, 준비판본, 지도);
  if (끊김) return 끊김;
  return 렌더문제(편, 키, { ...옵션, 지도 }) || false;
}

const REPO = path.resolve(__dirname, '..', '..');
const 지도이름 = '판본지도.json';
const 플랫폼들 = ['youtube', 'tiktok', 'instagram', 'facebook', 'telegram', 'xiaohongshu', 'douyin', 'vk', 'rutube'];
const 게시글칸 = [['title', '제목'], ['caption', '본문'], ['firstComment', '첫댓글'], ['pinnedComment', '고정댓글']];
const 키식 = /^[A-Z]{2}$/;

const 편폴더 = (편) => path.resolve(편);
const 지도경로 = (편) => path.join(편폴더(편), 지도이름);
const 있나 = (편) => fs.existsSync(지도경로(편));
const 슬래시 = (p) => String(p).split(path.sep).join('/');
const 줄나눔 = (s) => String(s || '').replace(/\r\n/g, '\n').split('\n');

function 지도검증(지도) {
  const 문제 = [];
  if (!지도 || typeof 지도 !== 'object') return ['JSON 객체가 아니다'];
  if (지도.꼴 !== '판본지도/1') 문제.push(`꼴이 「판본지도/1」이 아니다(${지도.꼴})`);
  if (!틀들.includes(지도.틀)) 문제.push(`틀은 ${틀들.join(' · ')} 가운데 하나다(${지도.틀})`);
  if (!지도.판본폴더 || typeof 지도.판본폴더 !== 'string') 문제.push('「판본폴더」(판본 글 폴더 — 편 폴더 기준)가 없다');
  if (!Array.isArray(지도.줄) || !지도.줄.length) 문제.push('「줄」이 비었다');
  if (지도.문화소재 !== undefined && !(지도.문화소재 === true || (typeof 지도.문화소재 === 'string' && 지도.문화소재.trim()))) {
    문제.push('「문화소재」는 true이거나 까닭 한 줄(빈 글이 아닌 글)이다 — 문화 소재가 아니면 칸을 적지 않는다');
  }
  const ids = new Set();
  for (const [i, z] of (지도.줄 || []).entries()) {
    const 곳 = `줄 ${i + 1}${z.id ? `(${z.id})` : ''}`;
    if (!z.id) 문제.push(`${곳}: id가 없다`);
    else if (ids.has(z.id)) 문제.push(`${곳}: id가 겹친다`);
    ids.add(z.id);
    if (!Object.prototype.hasOwnProperty.call(판본글.칸표, z.칸)) 문제.push(`${곳}: 모르는 칸 「${z.칸}」(${Object.keys(판본글.칸표).join(' · ')})`);
    if ((z.값 === undefined) === (z.글 === undefined)) 문제.push(`${곳}: 「값」(판본 글의 칸)과 「글」(판본마다 같은 글) 가운데 하나만 적는다`);
    if (z.초 !== undefined && !(Array.isArray(z.초) && z.초.length === 2 && z.초[0] <= z.초[1])) 문제.push(`${곳}: 초는 [시작, 끝]`);
    if (z.상자 && !(z.상자.폭 > 0 && (z.상자.글자크기 > 0 || z.크기))) 문제.push(`${곳}: 상자에는 폭과 글자크기(또는 줄의 「크기」 — 판본 글의 글자 크기 칸)가 있어야 한다`);
  }
  if (지도.인사 !== undefined) {
    const 인사 = 지도.인사;
    if (!인사 || typeof 인사 !== 'object' || Array.isArray(인사)) 문제.push('「인사」는 { 켬, 초, 자산, 줄 } 객체다');
    else {
      if (인사.초 !== undefined && !(typeof 인사.초 === 'string' || (typeof 인사.초 === 'number' && 인사.초 > 0 && 인사.초 <= 3))) 문제.push('인사.초는 판본 글의 칸 이름이거나 0~3의 수다');
      if (typeof 인사.자산 !== 'string' || !인사.자산.trim()) 문제.push('인사.자산(판본별 인사 그림 · 목소리 폴더 — 편 폴더 기준)이 없다');
      if (!Array.isArray(인사.줄) || !인사.줄.length) 문제.push('인사.줄이 비었다');
      for (const [i, z] of (Array.isArray(인사.줄) ? 인사.줄 : []).entries()) {
        const 곳 = `인사 줄 ${i + 1}${z.id ? `(${z.id})` : ''}`;
        if (!z.id) 문제.push(`${곳}: id가 없다`);
        else if (ids.has(z.id)) 문제.push(`${곳}: id가 겹친다`);
        ids.add(z.id);
        if (!Object.prototype.hasOwnProperty.call(판본글.칸표, z.칸)) 문제.push(`${곳}: 모르는 칸 「${z.칸}」`);
        if (typeof z.값 !== 'string' || !z.값) 문제.push(`${곳}: 「값」(판본 글의 칸)이 없다`);
        if (z.초 !== undefined) 문제.push(`${곳}: 초는 적지 않는다(도구가 [0, 인사 초]로 넣는다)`);
        // 인사 줄이 쓸 수 있는 칸은 셋뿐이다 — 「머리」 · 「예문」 · 「상황」 · 「끝질문」 · 「게시글」은 같은 언어 묶음 검사(⑫-2)가 이어 붙여 견주는 칸이라,
        // 나라마다 다른 인사 줄이 그 칸에 들면 똑같은 원본 줄이 「다르다」로 읽힌다(11-12 Fable 5.2 인사 카드 검수 P2-5 — 캐나다판을 미국판과 같게 만든 사본에서 재현)
        else if (!['진행', '한국어', '읽기'].includes(z.칸)) 문제.push(`${곳}: 인사 줄의 칸은 진행 · 한국어 · 읽기만 쓴다(「${z.칸}」 — 첫 카드 · 예문 · 끝 질문 · 게시글 칸은 같은 언어 묶음 검사가 원본 줄로 견준다)`);
      }
    }
  }
  for (const [키, m] of Object.entries(지도.원고 || {})) {
    if (!키식.test(키)) 문제.push(`원고: 판본 키가 아니다(${키})`);
    for (const p of Object.keys(m || {})) if (!플랫폼들.includes(p)) 문제.push(`원고.${키}: 모르는 플랫폼 「${p}」(${플랫폼들.join(' · ')})`);
  }
  return 문제;
}

/** 편 폴더 → { 파일, 지도 } (없거나 꼴이 틀리면 던진다) */
function 지도읽기(편) {
  const 파일 = 지도경로(편);
  if (!fs.existsSync(파일)) throw new Error(`판본 지도가 없다: ${파일} — 판본 글을 판본글/1로 이으려면 편 폴더에 ${지도이름}을 둔다(tools/lib/판본잇기.js 머리말)`);
  const 지도 = 판본글.readJson(파일);
  const 문제 = 지도검증(지도);
  if (문제.length) throw new Error(`판본 지도 꼴이 틀렸다(${파일}):\n  - ${문제.join('\n  - ')}`);
  return { 파일, 지도 };
}

const 낼곳 = (지도) => 지도.낼곳 || '게시/판본';
const 팩경로 = (편, 지도, 키) => path.join(편폴더(편), 지도.판본폴더, `${키}.json`);
const 글상대 = (지도, 키) => `${낼곳(지도)}/${키}/글.json`;
const 글경로 = (편, 지도, 키) => path.join(편폴더(편), 글상대(지도, 키));

// 준비.json 판본의 「글」이 지도가 뽑는 글.json 그 파일을 가리키는가 — 글자 그대로가 아니라 풀어 낸 자리로 견준다(11-11 밤 Fable 5.2 다시 검수 P1-렌1).
// 글자 그대로 견주면 같은 파일을 「./게시/…」 · 빗금 둘 · 「..」 · 절대 경로 · (윈도우) 폴더 대소문자로 적은 판본이 「지도와 안 이어진 판본」이 되어
// 글 낡음 · 렌더 낡음 두 관문이 다 꺼졌다. 윈도우는 대소문자를 가리지 않는 파일 체계라 소문자로 맞추고, 그 밖에서는 글자가 다르면 다른 파일이다.
function 같은글자리(편, 지도, 키, 글) {
  if (typeof 글 !== 'string' || !글.trim()) return false;
  const 풀기 = (p) => { const r = path.resolve(편폴더(편), String(p).split('\\').join('/')); return process.platform === 'win32' ? r.toLowerCase() : r; };
  return 풀기(글) === 풀기(글상대(지도, 키));
}

/**
 * 판본 지도가 있는 편에서 준비.json 판본의 「글」이 지도가 뽑는 글.json이 아니면 그 까닭(이 판본은 돌림에 못 든다 — 글 낡음 · 렌더 낡음이 볼 수 없다),
 * 이어져 있으면 false, 지도가 없는 편이면 null(볼 것이 없다). 판본렌더.mjs가 렌더.json 「돌림판본.글」에 판본 글 원천(<판본폴더>/<키>.json)을
 * 적어 주던 꼴을 준비.json에 옮겨 적은 판본이 여기서 닫힌다.
 */
function 이음문제(편, 키, 준비판본, 준지도 = null) {
  if (!있나(편)) return null;
  const 지도 = 준지도 || 지도읽기(편).지도;
  const 글 = 준비판본 && 준비판본.글;
  if (같은글자리(편, 지도, 키, 글)) return false;
  return `준비.json 판본 ${키}의 「글」(${글 || '칸 없음'})이 판본 지도가 뽑는 글(${글상대(지도, 키)})이 아니다 — 글 · 렌더 관문이 이 판본을 볼 수 없다(node tools/판본글잇기.js 돌림 <편 폴더> ${키})`;
}

/** 판본 글 폴더에 있는 키 전부 */
function 키들(편, 지도 = 지도읽기(편).지도) {
  const 폴더 = path.join(편폴더(편), 지도.판본폴더);
  return fs.existsSync(폴더) ? fs.readdirSync(폴더).filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => f.slice(0, 2)).sort() : [];
}

/** "reads.0" → 판본 글에서 그 값 */
function 값꺼내기(팩, 길) {
  let v = 팩;
  for (const k of String(길).split('.')) v = v == null ? undefined : v[/^\d+$/.test(k) ? Number(k) : k];
  return v;
}

/** 계정 원장에서 이 판본 키를 쓰는 LAB 계정 — [{ 계정, 플랫폼, 나라, 형식[] }] */
function 계정들(키, 원장 = null) {
  let led = 원장;
  if (!led) { try { led = 판본글.readJson(path.join(REPO, 'docs', '마케팅', 'sns-계정.json')); } catch { return []; } }
  const out = [];
  for (const [k, a] of Object.entries(led.accounts || {})) {
    if (a.brand !== 'LAB' || (a.rotationVersion || a.countryCode) !== 키) continue;
    out.push({ 계정: k, 플랫폼: a.platform, 나라: a.countryCode || null, 형식: Array.isArray(a.dailyFormats) ? a.dailyFormats : [] });
  }
  return out;
}

/** 이 판본의 원고 — { 플랫폼: 편 폴더 기준 경로 }. 지도 「원고」[키]가 먼저, 그다음 <낼곳>/<KEY>/원고_<플랫폼>.json */
function 원고들(편, 지도, 키) {
  const out = {};
  for (const [p, rel] of Object.entries(지도.원고?.[키] || {})) out[p] = 슬래시(rel);
  const 폴더 = path.join(편폴더(편), 낼곳(지도), 키);
  if (fs.existsSync(폴더)) {
    for (const f of fs.readdirSync(폴더).sort()) {
      const m = f.match(/^원고_([a-z]+)\.json$/);
      if (m && 플랫폼들.includes(m[1]) && !out[m[1]]) out[m[1]] = `${낼곳(지도)}/${키}/${f}`;
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

// 뜻 · 문법을 볼 글이 아닌 게시글 줄 — 해시태그만 · 서명 · 주소만
const 안볼줄 = (t) => /^(?:#[\p{L}\p{M}\p{N}_]+\s*)+$/u.test(t) || /^SYNK LAB$/i.test(t) || /^(?:https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(t);

/**
 * 판본 하나를 판본글/1로 뽑는다 → { 자료, 글자열, 경고, 팩파일, 글파일, 원고 }.
 * 글이 비어 뽑을 수 없는 칸(선택이 아닌 칸)이 있으면 던진다.
 */
function 뽑기(편, 키, { 원장 = null, 지도: 준지도 = null } = {}) {
  if (!키식.test(키)) throw new Error(`판본 키가 아니다: ${키}(두 글자 대문자)`);
  const 지도 = 준지도 || 지도읽기(편).지도;
  const 팩파일 = 팩경로(편, 지도, 키);
  if (!fs.existsSync(팩파일)) throw new Error(`판본 글이 없다: ${팩파일}`);
  const 팩 = 판본글.readJson(팩파일);
  const 경고 = [];
  const 빈 = [];
  const 줄 = [];
  // 나라 인사 — 켜진 판본은 인사 줄이 [0, 인사 초]에 먼저 실리고 원본 줄의 초가 그만큼 밀린다
  const 밀림 = 인사초(지도, 팩, 키);
  const 민 = (t) => Math.round((t + 밀림) * 1000) / 1000;
  if (밀림) {
    for (const z of 지도.인사.줄) {
      const 글 = 값꺼내기(팩, z.값);
      if (typeof 글 !== 'string' || !글.trim()) { if (!z.선택) 빈.push(z.값); continue; }
      const 한줄 = { id: z.id, 칸: z.칸, 글, 초: [0, 밀림] };
      const 원문 = (팩._원문 && typeof 팩._원문[z.값] === 'string' && 팩._원문[z.값].trim()) ? 팩._원문[z.값] : z.원문;
      if (원문) 한줄.원문 = 원문;
      if (z.장면) 한줄.장면 = z.장면;
      if (z.대조) 한줄.대조 = z.대조;
      줄.push(한줄);
    }
  }
  for (const z of 지도.줄) {
    const 글 = z.글 !== undefined ? z.글 : 값꺼내기(팩, z.값);
    if (typeof 글 !== 'string' || !글.trim()) {
      if (!z.선택) 빈.push(z.값 || z.id);
      continue;
    }
    const 한줄 = { id: z.id, 칸: z.칸, 글 };
    const 원문 = (z.값 !== undefined && 팩._원문 && typeof 팩._원문[z.값] === 'string' && 팩._원문[z.값].trim()) ? 팩._원문[z.값] : z.원문;
    if (원문) 한줄.원문 = 원문;
    if (z.초) 한줄.초 = 밀림 ? z.초.map(민) : z.초;
    if (z.장면) 한줄.장면 = z.장면;
    if (z.대조) 한줄.대조 = z.대조;
    if (z.상자) {
      const { 판본줄높이, ...상자 } = z.상자;
      if (z.크기) {
        const 크기 = 값꺼내기(팩, z.크기);
        if (!(크기 > 0)) 경고.push(`${z.id}: 글자 크기 칸 「${z.크기}」가 수가 아니다`);
        else 상자.글자크기 = 크기;
      }
      if (판본줄높이 && 팩.lineH > 0) 상자.줄높이 = Math.max(상자.줄높이 || 1.2, 팩.lineH);
      if (!상자.글꼴 && 팩.font) 상자.글꼴 = 팩.font;
      한줄.상자 = 상자;
    }
    줄.push(한줄);
  }
  if (빈.length) throw new Error(`판본 ${키}의 글이 아직 비었다(${빈.join(' · ')}) — ${슬래시(path.relative(편폴더(편), 팩파일))}`);
  for (const [k, v] of Object.entries(팩._원문 || {})) {
    if (typeof v === 'string' && v.trim() && ![...지도.줄, ...((지도.인사 && 지도.인사.줄) || [])].some((z) => z.값 === k)) 경고.push(`판본 글 「_원문」.${k}: 지도에 그 값을 쓰는 줄이 없다`);
  }

  // 게시글 — 원고마다 제목 · 본문 · 첫 댓글 · 고정 댓글의 줄. 플랫폼끼리 같은 줄은 한 번만.
  const 원고 = 원고들(편, 지도, 키);
  const 본글 = new Set();
  for (const [플랫폼, rel] of Object.entries(원고)) {
    const 파일 = path.join(편폴더(편), rel);
    if (!fs.existsSync(파일)) { 경고.push(`원고 파일이 없다: ${rel}`); continue; }
    const m = 판본글.readJson(파일);
    for (const [k, 이름] of 게시글칸) {
      if (typeof m[k] !== 'string' || !m[k].trim()) continue;
      const 글줄 = 줄나눔(m[k]);
      const 원문줄 = typeof m._원문?.[k] === 'string' ? 줄나눔(m._원문[k]) : null;
      if (원문줄 && 원문줄.length !== 글줄.length) 경고.push(`${rel} ${k}: 글 ${글줄.length}줄 · 「_원문」 ${원문줄.length}줄 — 줄 수가 달라 원문을 차례로 못 붙인다`);
      글줄.forEach((raw, i) => {
        const t = raw.trim();
        if (!t || 안볼줄(t) || 본글.has(t)) return;
        본글.add(t);
        // 원고 「_칸」 { caption: { "2": "예문" } } — 게시글 줄 가운데 그 나라 상황 예문처럼 따로 견줄 줄(같은 언어 묶음 검사 ⑫-2가 예문 · 상황 칸을 견준다)
        const 칸 = m._칸?.[k]?.[String(i + 1)] || '게시글';
        if (!Object.prototype.hasOwnProperty.call(판본글.칸표, 칸)) { 경고.push(`${rel} _칸.${k}.${i + 1}: 모르는 칸 「${칸}」`); return; }
        const 한줄 = { id: `게시글.${플랫폼}.${이름}.${i + 1}`, 칸, 글: t };
        const 원 = 원문줄 && 원문줄.length === 글줄.length ? 원문줄[i].trim() : '';
        if (원) 한줄.원문 = 원;
        줄.push(한줄);
      });
    }
  }

  const 나라 = [...new Set(계정들(키, 원장).map((a) => a.나라).filter(Boolean))].sort();
  // 뜻 검사 채점 기준 — 「핵심덧」 [{ 묶음: 0, 값: "rule" }]은 그 판본 글의 낱말(현지어 「하지 마」)을 그 핵심 묶음에 더한다(시험관이 현지어 낱말로 요약해도 짚은 것으로)
  let 기준 = 지도.기준 || null;
  if (기준 && Array.isArray(기준.핵심덧) && Array.isArray(기준.핵심)) {
    const { 핵심덧, ...나머지 } = 기준;
    const 핵심 = 기준.핵심.map((g) => [...g]);
    for (const d of 핵심덧) {
      const v = 값꺼내기(팩, d.값);
      if (typeof v === 'string' && v.trim() && 핵심[d.묶음] && !핵심[d.묶음].includes(v.trim())) 핵심[d.묶음].push(v.trim());
    }
    기준 = { ...나머지, 핵심 };
  }
  const 자료 = {
    꼴: '판본글/1', 편: path.basename(편폴더(편)), 판본: 키, 언어: 팩.lang, 나라, 틀: 지도.틀, 화면: 지도.화면 || { 폭: 1080, 높이: 1920 },
    // 문화 소재 편(지도 「문화소재」)만 칸이 생긴다 — 적지 않은 편의 글.json 바이트 · 뜻 검수 지문은 그대로다(걸린 판이 「걸린 뒤 바뀜」으로 내려가지 않게)
    ...(지도.문화소재 ? { 문화소재: 지도.문화소재 } : {}),
    ...(기준 ? { 기준 } : {}),
    ...(밀림 ? { 인사: { 초: 밀림 } } : {}),
    줄,
    ...(Array.isArray(지도.퀴즈) && 지도.퀴즈.length ? { 퀴즈: 지도.퀴즈 } : {}),
    원천: { 글: 슬래시(path.join(지도.판본폴더, `${키}.json`)), 지도: 지도이름, 원고, 도구: 'tools/lib/판본잇기.js — 손으로 고치지 않는다(원천을 고치고 node tools/판본글잇기.js 뽑기)' },
  };
  const 꼴문제 = 판본글.검증(자료);
  if (꼴문제.length) throw new Error(`뽑은 판본 글의 꼴이 틀렸다(${키}):\n  - ${꼴문제.join('\n  - ')}`);
  return { 자료, 글자열: JSON.stringify(자료, null, 2) + '\n', 경고, 팩파일, 글파일: 글경로(편, 지도, 키), 원고 };
}

/** 글.json이 원천과 다른가(없음 포함) */
function 낡았나(편, 키, 옵션 = {}) {
  const r = 뽑기(편, 키, 옵션);
  if (!fs.existsSync(r.글파일)) return true;
  return fs.readFileSync(r.글파일, 'utf8') !== r.글자열;
}

/**
 * 돌림표 · 올리기 전 검사가 부른다(tools/돌림표.js versionState) — 판본 지도가 있는 편에서 준비.json 판본의 「글」이 가리키는 글.json이
 * 원천(판본 글 · 지도 · 원고)과 다른가. 지도가 없는 편이면 null(볼 것이 없다). 글.json은 건드리지 않는다.
 * 원고(게시글)를 고치고 「뽑기」를 안 돌리면 글.json 지문이 그대로라 고친 글이 뜻 검수 「통과」를 그대로 달고 나간다(11-11 Fable 검수).
 * 지도가 있는데 「글」이 지도의 글.json이 아니면 견줄 원천이 없다 — 낡은 것으로 본다(true, 닫는 쪽 — 11-11 밤 P1-렌1. 까닭 글은 이음문제가 준다).
 */
function 글낡음(편, 키, 준비판본, 옵션 = {}) {
  if (!있나(편)) return null;
  const { 지도 } = 지도읽기(편);
  if (이음문제(편, 키, 준비판본, 지도)) return true;
  return 낡았나(편, 키, { ...옵션, 지도 });
}

/**
 * 판본 원고(게시글)의 「고칠 것」 — 올리기 전 검사 ⑥(tools/lib/게시글규칙.js checkPlate)이 판에서 잡을 것을 판본 단계에서 먼저 본다.
 * 원고 하나의 고칠 것이 올리기 전 검사에서 그 원본 편 전체(다른 계정 판까지)를 막기 때문이다(11-10 「화날때」 미국판 고정 댓글 this week ·
 * 11-11 열다섯 판본의 「이번 주」). 준비판본 = 준비.json 「돌림」.판본[KEY]. → ['youtube 고정 댓글: 상대 날짜 「esta semana」 …']
 */
function 원고고칠것(편, 준비판본) {
  const out = [];
  for (const [플랫폼, rel] of Object.entries((준비판본 && 준비판본.원고) || {})) {
    const 파일 = path.join(편폴더(편), String(rel));
    if (!fs.existsSync(파일)) { out.push(`${플랫폼}: 원고 파일이 없다(${rel})`); continue; }
    if (!/\.json$/i.test(파일)) continue; // 글 파일(.txt · .md) 원고는 판이 된 뒤 올리기 전 검사가 읽는다(tools/lib/게시묶음.js)
    let m;
    try { m = 판본글.readJson(파일); } catch (e) { out.push(`${플랫폼}: 원고를 못 읽는다(${rel})`); continue; }
    const 글 = {};
    for (const [k] of 게시글칸) 글[k] = typeof m[k] === 'string' && m[k].trim() ? m[k].trim() : null;
    const 말 = m.language || 준비판본.언어 || null;
    for (const f of 게시글규칙.checkPlate(글, { brand: m.brand || 'LAB', language: 말, platform: 플랫폼 })) {
      if (f.level === 게시글규칙.FIX) out.push(`${플랫폼} ${f.where}: ${f.message}`);
    }
    // 유튜브 동영상 언어 칸 — 나라별 판은 그 판 말로 넣는다(설계 게시경로 2-1: 동영상 언어가 ko인 편은 쇼츠 피드에 거의 안 실렸다, 11-05 실측).
    // 원고에 그 칸이 없으면 판 언어를 따른다(tools/lib/게시묶음.js). 앞 토막이 같으면 같은 말로 본다(zh · zh-Hant).
    const 앞 = (s) => String(s || '').toLowerCase().split('-')[0];
    if (플랫폼 === 'youtube' && m.audioLanguage && 말 && 앞(m.audioLanguage) !== 앞(말)) {
      out.push(`youtube 동영상 언어: 원고 audioLanguage(${m.audioLanguage})가 그 판 말(${말})이 아니다 — 나라별 판은 그 판 말로 넣는다(ko면 쇼츠 피드에 거의 안 실린다)`);
    }
  }
  return out;
}

/** 글.json을 원천에 맞춘다 — 같으면 건드리지 않는다(지문 · 수정 시각 그대로). → { 글파일, 바뀜, 새로, 경고, 지문 } */
function 맞추기(편, 키, 옵션 = {}) {
  const r = 뽑기(편, 키, 옵션);
  const 있던 = fs.existsSync(r.글파일) ? fs.readFileSync(r.글파일, 'utf8') : null;
  const 바뀜 = 있던 !== r.글자열;
  if (바뀜) {
    fs.mkdirSync(path.dirname(r.글파일), { recursive: true });
    const tmp = `${r.글파일}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, r.글자열);
    fs.renameSync(tmp, r.글파일);
  }
  return { 글파일: r.글파일, 바뀜, 새로: 있던 === null, 경고: r.경고, 지문: 판본글.sha256(r.글파일), 원고: r.원고 };
}

/**
 * 검사 도구(글자검사 · 뜻검사 「판본」 명령)가 검사 전에 부른다 — 준비.json 판본의 「글」이 지도가 뽑는 글.json이면 원천에 맞추고,
 * 영상이 지금 판본 글로 구운 것인지(렌더.json 글 지문)를 본다. → { 이음(글이 지도의 글.json인가), 바뀜, 경고, 영상낡음(true · false · null = 못 봄),
 * 렌더문제(null = 문제 없음, 글 — 렌더 기록 없음 · 글 · 자산이 렌더 뒤 바뀜: 이 판본은 다시 렌더해야 돌림에 든다) }
 * 판본 지도가 없는 편이면 null.
 */
function 검사전(편, 키, 준비판본 = null) {
  if (!있나(편)) return null;
  const { 지도 } = 지도읽기(편);
  const v = 준비판본 || 판본글.판본찾기(편, 키).판본;
  if (!같은글자리(편, 지도, 키, v.글)) return { 이음: false, 바뀜: false, 경고: [], 영상낡음: null, 렌더문제: null, 바른글: 글상대(지도, 키) };
  const r = 맞추기(편, 키, { 지도 });
  const 렌더 = path.join(편폴더(편), 낼곳(지도), 키, '렌더.json');
  let 영상낡음 = null;
  if (fs.existsSync(렌더)) {
    const j = 판본글.readJson(렌더);
    if (j.글sha256) 영상낡음 = !같은글(j.글sha256, 팩경로(편, 지도, 키));
  }
  return { 이음: true, 바뀜: r.바뀜, 경고: r.경고, 영상낡음, 렌더문제: 렌더문제(편, 키, { 지도 }), 바른글: 글상대(지도, 키) };
}

/** 준비.json 「돌림」.판본[KEY]에 넣을 꼴(편 폴더 기준 경로 — tools/돌림표.js 머리말). 검수는 넣지 않는다. */
function 돌림판본(편, 키, { 지도: 준지도 = null } = {}) {
  const 지도 = 준지도 || 지도읽기(편).지도;
  const 팩 = 판본글.readJson(팩경로(편, 지도, 키));
  const 원고 = 원고들(편, 지도, 키);
  return { 언어: 팩.lang, 파일: `${낼곳(지도)}/${키}/video.mp4`, 표지: `${낼곳(지도)}/${키}/cover.png`, 글: 글상대(지도, 키), ...(Object.keys(원고).length ? { 원고 } : {}) };
}

/**
 * 준비.json 「돌림」에 판본들을 넣는다(없으면 「돌림」을 만든다). 이미 있는 판본의 「검수」와 다른 칸(멈춤 · 예비 · 무대 …)은 그대로 둔다.
 * 쓰기 직전에 다시 읽어 바꾼다(그사이 다른 세션이 쓴 칸을 지우지 않게). → { 준비, 넣은: [키], 바뀜 }
 */
function 준비에넣기(편, 넣을키들, { 형식 = null, 쓸날 = null } = {}) {
  const { 지도 } = 지도읽기(편);
  const 준비 = 판본글.준비경로(편);
  if (!fs.existsSync(준비)) throw new Error(`준비.json이 없다: ${준비}`);
  const prep = 판본글.readJson(준비);
  const 앞 = JSON.stringify(prep);
  if (!prep.돌림) prep.돌림 = { 형식: 형식 || 지도.틀, 쓸날: 쓸날 || null, 멈춤: null, 예비: false, 판본: {} };
  if (형식) prep.돌림.형식 = 형식;
  if (쓸날) prep.돌림.쓸날 = 쓸날;
  if (!prep.돌림.판본) prep.돌림.판본 = {};
  for (const 키 of 넣을키들) {
    const 있던 = prep.돌림.판본[키] || {};
    const { 언어, 파일, 표지, 글, 원고, ...나머지 } = 있던; // 검수 등 다른 칸은 그대로
    prep.돌림.판본[키] = { ...돌림판본(편, 키, { 지도 }), ...나머지 };
  }
  const 바뀜 = JSON.stringify(prep) !== 앞;
  if (바뀜) 판본글.writeJson(준비, prep);
  return { 준비, 넣은: 넣을키들, 바뀜 };
}

/**
 * 한 판본의 사슬 확인 — 글 → 글.json → 영상(렌더 기록) → 준비.json 「돌림」 → 검수 지문. → { 키, 문제: [글…], 알림: [글…] }
 * 문제가 없으면 이 판본은 돌림에 든다(tools/돌림표.js가 보는 것 — 11-11부터 「영상이 지금 글 · 자산으로 구운 것인가」도 돌림표가 본다 —
 * 에 더해 「글자 검사 뒤 글이 바뀌었나」 알림).
 */
function 확인(편, 키, { 원장 = null, 검수 = ['뜻', '글자'] } = {}) {
  const 문제 = [];
  const 알림 = [];
  const { 지도 } = 지도읽기(편);
  let r;
  try { r = 뽑기(편, 키, { 원장, 지도 }); } catch (e) { return { 키, 문제: [e.message.split('\n')[0]], 알림 }; }
  알림.push(...r.경고);
  if (!fs.existsSync(r.글파일)) 문제.push(`글.json이 없다 — node tools/판본글잇기.js 뽑기`);
  else if (fs.readFileSync(r.글파일, 'utf8') !== r.글자열) 문제.push('글.json이 판본 글 · 지도 · 원고보다 낡았다 — node tools/판본글잇기.js 뽑기(지문이 바뀌니 뜻 검사를 다시 받는다)');
  // 원고 — 이 키를 쓰는 계정의 플랫폼마다(이 형식 칸이 있는 계정만)
  const 필요 = [...new Set(계정들(키, 원장).filter((a) => !a.형식.length || a.형식.includes(지도.틀)).map((a) => a.플랫폼))].sort();
  const 없는 = 필요.filter((p) => !r.원고[p]);
  if (없는.length) 문제.push(`원고가 없는 플랫폼: ${없는.join(' · ')}(${낼곳(지도)}/${키}/원고_<플랫폼>.json)`);
  // 영상 · 렌더 기록
  const 폴더 = path.join(편폴더(편), 낼곳(지도), 키);
  const 영상 = path.join(폴더, 'video.mp4');
  let 영상지문 = null;
  if (!fs.existsSync(영상)) 문제.push(`영상이 없다(${낼곳(지도)}/${키}/video.mp4) — node 판본렌더.mjs ${키}`);
  else {
    영상지문 = 판본글.sha256(영상);
    if (!fs.existsSync(path.join(폴더, 'cover.png'))) 문제.push('표지(cover.png)가 없다');
    // 렌더 기록 — 없거나, 글 · 자산이 렌더 뒤 바뀌었거나, 다른 영상의 기록이면 돌림표(versionState)도 이 판본을 뺀다
    const 렌더까닭 = 렌더문제(편, 키, { 지도, 영상지문 });
    if (렌더까닭) 문제.push(렌더까닭);
  }
  // 준비.json 「돌림」
  let v = null;
  try { v = 판본글.판본찾기(편, 키).판본; } catch (e) { 문제.push(`준비.json 「돌림」.판본에 ${키}가 없다 — node tools/판본글잇기.js 돌림`); }
  if (v) {
    const 바른 = 돌림판본(편, 키, { 지도 });
    for (const k of ['언어', '파일', '표지', '글']) if (슬래시(v[k] || '') !== 바른[k]) 문제.push(`준비.json 판본 ${키}의 「${k}」(${v[k] || '없음'})가 ${바른[k]}가 아니다 — node tools/판본글잇기.js 돌림`);
    if (JSON.stringify(v.원고 || {}) !== JSON.stringify(바른.원고 || {})) 문제.push(`준비.json 판본 ${키}의 「원고」가 지금 원고 파일과 다르다 — node tools/판본글잇기.js 돌림`);
    const 글지문 = fs.existsSync(r.글파일) ? 판본글.sha256(r.글파일) : null;
    for (const 이름 of 검수) {
      const c = v.검수?.[이름];
      if (!c) { 문제.push(`${이름} 검수 전`); continue; }
      if (c.결과 !== '통과') 문제.push(`${이름} 검수 ${c.결과}`);
      if (이름 === '뜻' && c.지문 !== 글지문) 문제.push('뜻 검수 뒤 글이 바뀜 — 뜻 검사를 다시 받는다');
      if (이름 !== '뜻' && 영상지문 && c.지문 !== 영상지문) 문제.push(`${이름} 검수 뒤 영상이 바뀜 — 글자 검사를 다시 기록한다`);
      // 글자 검사 뒤 글.json만 바뀐 것(장면 설명 · 게시글 · 지도)은 영상과 상관없다 — 화면 글이 바뀌었으면 위 「영상이 지금 판본 글로 구운 것이 아니다」가 잡는다
      if (이름 === '글자' && c.글지문 && 글지문 && c.글지문 !== 글지문) 알림.push('글자 검사 뒤 글.json이 바뀌었다(영상은 그대로) — 게시글 · 장면 설명만 고친 것이면 그대로 둔다');
    }
    // 원고의 게시글 「고칠 것」 — 돌림표(versionState)도 이 판본을 돌림에서 뺀다
    for (const f of 원고고칠것(편, v)) 문제.push(`원고 고칠 것 — ${f}(원고를 고친 뒤 node tools/판본글잇기.js 뽑기 → 뜻 검사 다시)`);
  }
  return { 키, 문제, 알림 };
}

/**
 * 판본 글 채우기 — 입력 { "<KEY>": { "<칸>": 값 …, "_원문": {…}, "원고": { "<플랫폼>": { title, caption, …, "_원문": {…} } } } }를
 * 판본 글 틀(<판본폴더>/<KEY>.json — `_설명` · `_한도`는 그대로)과 원고 파일에 넣는다. 입력에 없는 칸은 지도 「기본값」, 그것도 없으면 틀 그대로.
 * 틀에 없는 칸 · 꼴이 다른 값(글 자리에 수 등)은 넣지 않고 던진다. → [{ 키, 팩파일, 원고: [파일…] }]
 */
function 채우기(편, 입력) {
  const { 지도 } = 지도읽기(편);
  const 원고기본 = 지도.원고기본 || {};
  const out = [];
  for (const [키, 값들] of Object.entries(입력)) {
    if (!키식.test(키)) throw new Error(`판본 키가 아니다: ${키}`);
    const 팩파일 = 팩경로(편, 지도, 키);
    if (!fs.existsSync(팩파일)) throw new Error(`판본 글 틀이 없다: ${팩파일}`);
    const 팩 = 판본글.readJson(팩파일);
    // 기본값은 틀의 그 칸이 아직 비었을 때만(이미 찬 판본 — 몽골판의 키릴 읽는 법 — 을 덮지 않는다)
    const 빈칸 = (v) => (Array.isArray(v) ? v.every((x) => typeof x === 'string' && !x.trim()) : typeof v === 'string' && !v.trim());
    const 기본 = Object.fromEntries(Object.entries(지도.기본값 || {}).filter(([k]) => 빈칸(팩[k])));
    const 넣을 = { ...기본, ...값들 };
    for (const [k, v] of Object.entries(넣을)) {
      if (k === '원고') continue;
      if (k === '_원문') { 팩._원문 = { ...(팩._원문 || {}), ...v }; continue; }
      if (k.startsWith('_') || !Object.prototype.hasOwnProperty.call(팩, k)) throw new Error(`${키}: 판본 글 틀에 없는 칸 「${k}」`);
      const 옛 = 팩[k];
      const 같은꼴 = Array.isArray(옛) ? Array.isArray(v) && v.length === 옛.length && v.every((x) => typeof x === typeof 옛[0]) : typeof v === typeof 옛;
      if (!같은꼴) throw new Error(`${키}.${k}: 틀과 꼴이 다르다(${JSON.stringify(옛).slice(0, 40)} ← ${JSON.stringify(v).slice(0, 40)})`);
      팩[k] = v;
    }
    판본글.writeJson(팩파일, 팩);
    const 쓴 = [];
    for (const [플랫폼, m] of Object.entries(값들.원고 || {})) {
      if (!플랫폼들.includes(플랫폼)) throw new Error(`${키}.원고: 모르는 플랫폼 「${플랫폼}」`);
      const 파일 = path.join(편폴더(편), 낼곳(지도), 키, `원고_${플랫폼}.json`);
      fs.mkdirSync(path.dirname(파일), { recursive: true });
      // 동영상 언어(audioLanguage)의 기본은 그 판 말 — 지도 「원고기본」이나 입력이 적으면 그 값이 덮는다
      판본글.writeJson(파일, { id: `판본-${키}-${플랫폼}`, brand: 'LAB', platform: 플랫폼, language: 팩.lang, audioLanguage: 팩.lang, ...(원고기본['*'] || {}), ...(원고기본[플랫폼] || {}), ...m });
      쓴.push(파일);
    }
    out.push({ 키, 팩파일, 원고: 쓴 });
  }
  return out;
}

module.exports = { 인사지문, 인사초, 인사폴더, 지도이름, 플랫폼들, 있나, 지도읽기, 지도검증, 키들, 값꺼내기, 계정들, 원고들, 뽑기, 낡았나, 글낡음, 이음문제, 같은글자리, 자산자리, 자산파일들, 자산지문, 렌더문제, 렌더낡음, 원고고칠것, 맞추기, 검사전, 돌림판본, 준비에넣기, 확인, 채우기, 글상대, 글경로, 팩경로, 같은글 };
