#!/usr/bin/env node
/**
 * 발행검사 — 렌더 «앞»에서 기계가 잡을 수 있는 브랜드 위반을 종료코드로 바꾼다.
 *
 * 🔴 왜 있나 — DESIGN.md §5 「영상」 줄 원문: 「이 지면은 브랜드 집행이 «사람 눈» 하나뿐이다 —
 *   `tools/브랜드렌더린트.js` 는 크롬 computed style 을 읽어 mp4 도 프레임 PNG 도 원리상 못 잰다.」
 *   그림이 나온 «뒤»에는 기계가 못 본다. 그래서 그림이 나오기 «전», 소스와 데이터에서 잰다.
 *   (트랙 §2-영상 ⛔ 「검사 셋(단독 응원·폰트 cmap·색 표기) · 영상/발행검사.js · tsc --noEmit 렌더 앞」)
 *
 * 종료코드 — 셋을 가른다. «확인 불가»는 통과와 같은 얼굴을 하면 안 된다(이 저장소의 「0건이 성공 얼굴」 병):
 *   0 = 통과 · 1 = 위반(파일:줄 · 무엇 · 어느 규칙) · 2 = 확인 불가(재료를 못 읽었다)
 *
 * 검사 넷 — 규칙 원문(출처를 그대로 인용한다 · 없는 규칙은 지어내지 않았다):
 *   ① 단독 응원 — `.claude/skills/synk-brand/SKILL.md` 「금칙 형태」 표:
 *        「**내용 없는 응원** | 「화이팅」·「짱」·「대박」 단독 | 몽골어로 옮기면 정보량 0.
 *          응원은 **무엇을 했는지**를 말할 때만 응원이다」
 *      + 같은 파일 정체성 절: 「캐릭터가 하는 말은 **평가 금지·자기 감정과 응원만**(「잘했어요」 ✕)」
 *      + `03_감정표현.md` 제작 메모: 「「대박」·「짱」은 … 여기서는 **가르치는 대상**이지 학생에게 던지는
 *        응원이 아니라서 선다 — 이 편의 어느 대사·자막에서도 그 낱말로 학생을 칭찬하지 않는다」
 *      ⇒ 가르치는 칸(표현·따라하기·짧게 · 카운트다운 표현·뜻)은 밖이고, 나머지 컷·훅·마무리에서
 *        응원·칭찬 낱말**만** 남는 줄이 위반이다. 낱말 목록은 아래 `응원어휘` — 규칙의 예 셋 + 평가 예 하나에서 폈다.
 *   ② 폰트 cmap — `영상/README.md` 🔴 절: 「한국어와 **몽골 전용 키릴(Өө Үү)**이 네모칸이 아니라 글자로
 *        보이는지 반드시 눈으로 본다 — 이 저장소가 이미 한 번 겪은 사고다」 · `킷/폰트.ts` 머리말 ①②.
 *      눈이 보던 것을 기계가 먼저 본다: 렌더될 모든 글자(생성 데이터 + 소스의 문자열·JSX 글)가
 *      `킷/폰트벌.json` 이 선언한 파일들의 cmap 에 있는가. 선언밖 갈래(이모지)는 ⚠로 세되 막지 않는다.
 *   ③ 색 표기 — `킷/색.ts` 머리말: 「🚫 합성물 코드 어디에도 hex 리터럴을 쓰지 않는다」 ·
 *      DESIGN.md §5 영상 줄: 「킷 다리는 `영상/src/킷/색.ts`·`폰트.ts` 둘뿐 — 색·서체를 그 밖에서 손으로
 *      적지 않는다(🚫통로 밖 손 CSS 와 같은 규율)」 · 토큰 `감각.규칙`: 「그림자는 Graphite 틴트만
 *      (rgba(8,9,12,…)) — 순검정 그림자 금지(철칙①의 그림자판)」
 *      ⇒ 킷 파일 밖의 hex·rgb(a)·hsl(a)·이름색 리터럴 = 위반(주석은 뺀다 — README 의 grep 이 주석에 걸리던
 *        자리다). 킷 파일 «안»의 리터럴도 위반 — 그 파일은 토큰을 지나야 토큰과 같다.
 *        `색("…")`·`시맨틱("…")` 이 부르는 이름이 토큰에 있고 쓸 수 있는 색(⏳퇴역·K-Culture 아님)인지도 본다.
 *   ④ 소리 이름 — `docs/브랜드_사운드킷/_사운드킷.md`: 「값의 정본은 `docs/디자인_토큰.json` 「사운드」다」 ·
 *      「새 이벤트 소리가 필요해지면: 토큰 「사운드」에 값 추가 → 재생성 → 유호님 시청 확정. **이 순서 밖으로
 *        만들지 않는다**」 ⇒ 클립 데이터가 부르는 소리 이름은 `소리어휘.js` 가 정본에서 파생한 표 안에만.
 *
 * 쓰기: node 영상/발행검사.js        (굽기·마스터가 렌더 앞에 `게이트.js` 를 지나며 부른다 · CI 도 같은 줄)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 방 = __dirname;
const 저장소 = path.resolve(방, '..');
const 소스방 = path.join(방, 'src');
const 생성방 = path.join(소스방, '클립', '생성');
const 킷색파일 = path.join(소스방, '킷', '색.ts');
const 폰트벌경로 = path.join(소스방, '킷', '폰트벌.json');
const 폰트정본방 = path.join(저장소, 'docs', '브랜드_폰트');
const 토큰경로 = path.join(저장소, 'docs', '디자인_토큰.json');

/* ══ 공통 — TS/TSX 에서 주석을 걷고 «문자열·JSX 글»을 꺼내는 최소 토크나이저 ═══════════
 * 왜 정규식 한 줄이 아닌가: 주석에 색 이름·hex 가 산다(`리드크루클립.tsx` 「Coral Wash #FEF0E9」).
 * README 의 `grep "#……"` 은 그 주석에 걸려 «0건이어야 한다»가 이미 거짓이었다(09-02 실측 2건).
 * ⚠ 정규식 리터럴 안의 따옴표·`//` 는 못 가른다 — 지금 `src/` 에는 없다. 생기면 여기서 갈린다. */
function 소스가르기(원문) {
  const 코드 = [];
  const 문자열들 = [];
  let 모드 = '코드';
  let 닫음 = '';
  let 버퍼 = '';
  let 버퍼줄 = 1;
  let 버퍼앞 = 0; /* 문자열이 시작한 코드 위치 — 「무슨 호출의 인자인가」를 뒤에서 본다 */
  let 줄 = 1;
  const 스택 = []; /* 템플릿 `${ }` 안의 중괄호 깊이 */
  /* 🔴 템플릿은 `${}` 마다 «조각»으로 쪼개지고, 둘째 조각부터는 앞이 「…${이름}」 이라
   *   「어느 호출의 인자인가」를 잃는다 (2026-09-03 · codex P2 `4fc87927da4e` 의 뿌리).
   *   실측: `throw new Error(\`… 조항 ⓙ…\`)` 의 첫 조각만 화면밖으로 걸러지고, ⓙ 가 든
   *   둘째 조각은 «화면에 뜨는 글»로 수집돼 cmap 위반 한 줄을 만들었다.
   *   ⇒ 리터럴이 열릴 때 그 «시작 자리»를 쌓아 두고, 조각 전부가 같은 문맥을 본다. */
  const 템플릿시작 = [];
  const 앞문맥 = () => {
    const 기준 = (닫음 === '`' && 템플릿시작.length) ? 템플릿시작[템플릿시작.length - 1] : 버퍼앞;
    return 코드.slice(Math.max(0, 기준 - 48), 기준).join('');
  };
  let i = 0;
  const n = 원문.length;
  while (i < n) {
    const ch = 원문[i];
    const 다음 = 원문[i + 1];
    if (모드 === '코드') {
      if (ch === '/' && 다음 === '/') { 모드 = '줄주석'; 코드.push(' '); i += 2; continue; }
      if (ch === '/' && 다음 === '*') { 모드 = '블록주석'; 코드.push(' '); i += 2; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { 모드 = '문자열'; 닫음 = ch; 버퍼 = ''; 버퍼줄 = 줄; 버퍼앞 = 코드.length; if (ch === '`') 템플릿시작.push(코드.length); 코드.push(ch); i += 1; continue; }
      if (ch === '{' && 스택.length) { 스택.push('brace'); 코드.push(ch); i += 1; continue; }
      if (ch === '}' && 스택.length) {
        const 위 = 스택.pop();
        코드.push(ch);
        i += 1;
        if (위 === 'tpl') { 모드 = '문자열'; 닫음 = '`'; 버퍼 = ''; 버퍼줄 = 줄; 버퍼앞 = 코드.length; }
        continue;
      }
      if (ch === '\n') 줄 += 1;
      코드.push(ch);
      i += 1;
      continue;
    }
    if (모드 === '줄주석') {
      if (ch === '\n') { 모드 = '코드'; 줄 += 1; 코드.push('\n'); } else 코드.push(' ');
      i += 1;
      continue;
    }
    if (모드 === '블록주석') {
      if (ch === '*' && 다음 === '/') { 모드 = '코드'; 코드.push('  '); i += 2; continue; }
      if (ch === '\n') { 줄 += 1; 코드.push('\n'); } else 코드.push(' ');
      i += 1;
      continue;
    }
    /* 문자열 */
    if (ch === '\\') { 버퍼 += ch + (다음 ?? ''); 코드.push(ch, 다음 ?? ''); i += 2; continue; }
    if (닫음 === '`' && ch === '$' && 다음 === '{') {
      /* 🔴 `코드` 는 배열이다 — slice 를 그대로 넘기면 문맥 판정이 죽는다
       *   (2026-09-03 · codex P2 `4fc87927da4e` 채택 수리).
       *   배열이 정규식에 닿을 때 「n,e,w, ,E,r,r,o,r,(」 처럼 쉼표로 이어져,
       *   `화면밖문자열()` 이 「new Error(」 를 못 알아본다. 그래서 던지는 메시지 안의
       *   글자(색.ts:43 의 「ⓙ」)가 «화면에 뜨는 글»로 수집돼 cmap 위반이 됐다.
       *   합쳐서 넘긴다 — 아래 닫는 자리도 같다. */
      문자열들.push({ 글: 버퍼, 줄: 버퍼줄, 앞: 앞문맥() });
      버퍼 = '';
      스택.push('tpl');
      모드 = '코드';
      코드.push('${');
      i += 2;
      continue;
    }
    if (ch === 닫음) { 문자열들.push({ 글: 버퍼, 줄: 버퍼줄, 앞: 앞문맥() }); if (닫음 === '`') 템플릿시작.pop(); 모드 = '코드'; 코드.push(ch); i += 1; continue; }
    if (ch === '\n') {
      줄 += 1;
      if (닫음 !== '`') { 모드 = '코드'; } /* 안 닫힌 따옴표 — 코드로 돌아간다(JSX 글의 아포스트로피 따위) */
    }
    버퍼 += ch;
    코드.push(ch);
    i += 1;
  }
  return { 코드: 코드.join(''), 문자열들 };
}

/** 주석을 걷은 코드에서 JSX 글(`>글<` · `}글<` · `>글{`)을 꺼낸다 — 비교식도 걸리지만 ASCII 뿐이라 무해하다. */
function jsx글(코드) {
  const 결과 = [];
  const re = /[>}]([^<>{}]*[^\s<>{}][^<>{}]*)[<{]/g;
  let m;
  while ((m = re.exec(코드))) {
    const 줄 = 코드.slice(0, m.index).split('\n').length;
    결과.push({ 글: m[1], 줄 });
    re.lastIndex = m.index + 1;
  }
  return 결과;
}

/** `src/**` 의 ts·tsx(생성/ 제외) + remotion.config.ts */
function 소스파일들() {
  const 목록 = [];
  (function 훑기(뿌리) {
    for (const e of fs.readdirSync(뿌리, { withFileTypes: true })) {
      const p = path.join(뿌리, e.name);
      if (e.isDirectory()) {
        if (p !== 생성방) 훑기(p);
      } else if (/\.tsx?$/.test(e.name)) 목록.push(p);
    }
  })(소스방);
  const 설정 = path.join(방, 'remotion.config.ts');
  if (fs.existsSync(설정)) 목록.push(설정);
  return 목록.sort();
}

const 상대 = (p) => path.relative(저장소, p).replace(/\\/g, '/');

/* ══ ① 단독 응원 ═══════════════════════════════════════════════════════════════ */

/** 응원·칭찬 낱말 — 규칙의 예(화이팅·짱·대박 · 「잘했어요」)에서 폈다. 조사·어미 변형은 정규식이 흡수한다. */
const 응원어휘 = [
  /^(화이팅|파이팅|화이팅요|파이팅요)$/,
  /^짱(이다|이에요|입니다|이야)?$/,
  /^대박(이다|이에요|입니다|이야)?$/,
  /^최고(다|예요|에요|입니다|야)?$/,
  /^(굿|굳|브라보|만세|올레)$/,
  /^(좋아|좋아요|좋다|좋았어요|좋네요)$/,
  /^(멋져|멋져요|멋지다|멋있어요|멋있다)$/,
  /^(힘내|힘내요|힘내세요|힘내자)$/,
  /^(잘했어|잘했어요|잘했다|잘한다|잘해요|잘하고있어요|잘하고있어)$/,
  /^(대단해|대단해요|대단하다|훌륭해요|훌륭하다|완벽해요|완벽하다)$/,
  /^(축하해|축하해요|축하합니다|축하)$/,
  /^(응원해|응원해요|응원할게요|응원합니다)$/,
  /^(할수있어|할수있어요|할수있다|할수있습니다)$/,
];

/** 글 한 줄이 응원·칭찬 낱말**만**으로 서 있나. 문장부호·이모지·괄호는 뺀다. */
function 단독응원인가(글) {
  const 어절들 = String(글 || '')
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|[‍️]/gu, ' ')
    .replace(/[!！?？.。,、~～…·「」『』"'“”‘’()（）\-–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!어절들.length) return false;
  return 어절들.every((어절) => 응원어휘.some((re) => re.test(어절.replace(/\s/g, ''))));
}

/**
 * 인용 칸 — 응원 낱말이 «내용»인 자리. 표현·짧게·따라하기는 가르치는 말(03_감정표현.md 제작 메모)이고,
 * 실수는 「이렇게 말하면」 알약 밑에 «학습자가 뱉은 틀린 말»을 따온 칸이다(04편 2화 실수 「좋아요」 —
 * 학생에게 던진 응원이 아니라 장면 속 대사 · 09-02 실측). 학생을 «향해» 서는 칸(훅·상황·반응·쓰임·참여·
 * 옛 표형의 뜻·예문·클로징 · 카운트다운 훅·마무리)만 본다.
 */
const 인용칸 = new Set(['표현', '따라하기', '짧게', '실수']);

function 응원검사(클립들, 카운트들) {
  const 위반 = [];
  for (const c of 클립들) {
    if (단독응원인가(c.훅)) 위반.push(`${c.id}/훅 「${c.훅}」 — 단독 응원(synk-brand 금칙 형태 「내용 없는 응원」)`);
    for (const s of c.장면들) {
      const 칸 = s.꼴 || s.라벨;
      if (인용칸.has(칸)) continue;
      if (단독응원인가(s.한국어)) 위반.push(`${c.id}/${칸} 「${s.한국어}」 — 단독 응원(synk-brand 금칙 형태 「내용 없는 응원」)`);
    }
  }
  for (const c of 카운트들) {
    if (단독응원인가(c.훅)) 위반.push(`${c.id}/훅 「${c.훅}」 — 단독 응원(synk-brand 금칙 형태 「내용 없는 응원」)`);
    if (단독응원인가(c.마무리)) 위반.push(`${c.id}/마무리 「${c.마무리}」 — 단독 응원(synk-brand 금칙 형태 「내용 없는 응원」)`);
  }
  return 위반;
}

/* ══ ② 폰트 cmap ═══════════════════════════════════════════════════════════════ */

/**
 * OpenType(otf·ttf) 의 cmap 을 읽어 «글리프가 있는 코드포인트» 집합을 낸다. 의존성 0.
 * 포맷 4(BMP) 와 12(전역) 만 — 이 저장소의 아홉 벌이 그 둘뿐이다(다른 포맷은 건너뛰고 «알린다»).
 */
function cmap읽기(buf) {
  const 표수 = buf.readUInt16BE(4);
  let off = null;
  for (let i = 0; i < 표수; i++) {
    const p = 12 + i * 16;
    if (buf.toString('ascii', p, p + 4) === 'cmap') off = buf.readUInt32BE(p + 8);
  }
  if (off == null) throw new Error('cmap 표가 없다');
  const n = buf.readUInt16BE(off + 2);
  const 집합 = new Set();
  const 건너뛴포맷 = [];
  for (let i = 0; i < n; i++) {
    const r = off + 4 + i * 8;
    const s = off + buf.readUInt32BE(r + 4);
    const 포맷 = buf.readUInt16BE(s);
    if (포맷 === 4) {
      const segX2 = buf.readUInt16BE(s + 6);
      const seg = segX2 / 2;
      const endA = s + 14;
      const startA = endA + segX2 + 2;
      const deltaA = startA + segX2;
      const rangeA = deltaA + segX2;
      for (let k = 0; k < seg; k++) {
        const end = buf.readUInt16BE(endA + k * 2);
        const start = buf.readUInt16BE(startA + k * 2);
        const delta = buf.readInt16BE(deltaA + k * 2);
        const ro = buf.readUInt16BE(rangeA + k * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end; c++) {
          let g;
          if (ro === 0) g = (c + delta) & 0xffff;
          else {
            const gi = rangeA + k * 2 + ro + (c - start) * 2;
            g = gi + 1 < buf.length ? buf.readUInt16BE(gi) : 0;
            if (g) g = (g + delta) & 0xffff;
          }
          if (g) 집합.add(c);
        }
      }
    } else if (포맷 === 12) {
      const 군수 = buf.readUInt32BE(s + 12);
      for (let k = 0; k < 군수; k++) {
        const g = s + 16 + k * 12;
        const a = buf.readUInt32BE(g);
        const b = buf.readUInt32BE(g + 4);
        for (let c = a; c <= b; c++) 집합.add(c);
      }
    } else 건너뛴포맷.push(포맷);
  }
  return { 집합, 건너뛴포맷 };
}

const 이모지인가 = (ch) =>
  /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}/u.test(ch) || ch.codePointAt(0) === 0x20e3;
const 건너뛸글자 = (ch) => /\p{White_Space}|\p{Control}|\p{Format}|\p{Variation_Selector}/u.test(ch);

/**
 * @param 글자출처 [{글, 자리}] — 렌더될 글과 그것이 어디서 왔나
 * @param 가족별cmap {가족이름: Set<cp>} — 폰트벌.json 의 family 마다 웨이트 합집합
 * @param 선언밖 폰트벌.json 「선언밖」 — 이모지 줄이 있으면 이모지는 경고 갈래
 */
function cmap검사(글자출처, 가족별cmap, 선언밖 = {}) {
  const 전체 = new Set();
  for (const s of Object.values(가족별cmap)) for (const c of s) 전체.add(c);
  const 빠짐 = new Map(); /* 글자 → 자리들 */
  for (const { 글, 자리 } of 글자출처) {
    for (const ch of String(글 || '')) {
      if (건너뛸글자(ch)) continue;
      if (전체.has(ch.codePointAt(0))) continue;
      if (!빠짐.has(ch)) 빠짐.set(ch, new Set());
      빠짐.get(ch).add(자리);
    }
  }
  const 위반 = [];
  const 경고 = [];
  for (const [ch, 자리들] of 빠짐) {
    const 자리글 = [...자리들].slice(0, 6).join(' · ') + (자리들.size > 6 ? ` … 외 ${자리들.size - 6}` : '');
    const 줄 = `「${ch}」 U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} — ${자리글}`;
    if (이모지인가(ch) && 선언밖['이모지']) 경고.push(`${줄} — 이모지: 선언밖(시스템 폴백 · 유호 판정 대기)`);
    else 위반.push(`${줄} — 선언한 폰트 아홉 벌 어디에도 글리프가 없다(폰트벌.json) → 두부(□)가 난다`);
  }
  return { 위반, 경고 };
}

/** 렌더될 글 전량 — 생성 데이터 + 소스의 문자열·JSX 글. */
function 렌더글자모으기(클립들, 카운트들, 소스들) {
  const 출처 = [];
  for (const c of 클립들) {
    출처.push({ 글: c.훅, 자리: `${c.id}/훅` }, { 글: c.훅몽골어, 자리: `${c.id}/훅` });
    for (const s of c.장면들) {
      const 칸 = s.꼴 || s.라벨;
      출처.push({ 글: s.한국어, 자리: `${c.id}/${칸}` }, { 글: s.몽골어, 자리: `${c.id}/${칸}` }, { 글: s.라벨, 자리: `${c.id}/${칸}` });
    }
  }
  for (const c of 카운트들) {
    출처.push({ 글: c.훅, 자리: `${c.id}/훅` }, { 글: c.훅몽골어, 자리: `${c.id}/훅` });
    출처.push({ 글: c.마무리, 자리: `${c.id}/마무리` }, { 글: c.마무리몽골어, 자리: `${c.id}/마무리` });
    for (const r of c.순위들) {
      출처.push({ 글: r.표현, 자리: `${c.id}/${r.순}위` }, { 글: r.뜻, 자리: `${c.id}/${r.순}위` }, { 글: r.몽골어, 자리: `${c.id}/${r.순}위` });
    }
  }
  for (const { 경로, 원문 } of 소스들) {
    const { 코드, 문자열들 } = 소스가르기(원문);
    for (const { 글, 줄, 앞 } of 문자열들) {
      if (화면밖문자열(앞)) continue;
      출처.push({ 글, 자리: `${경로}:${줄}` });
    }
    for (const { 글, 줄 } of jsx글(코드)) 출처.push({ 글, 자리: `${경로}:${줄}` });
  }
  return 출처;
}

/**
 * 화면에 안 나가는 문자열 — 오류 메시지·콘솔·문자열 연산의 인자·모듈 경로.
 * 실측(09-02): `색.ts` 의 `throw new Error("… 조항 ⓙ")` 가 cmap 검사에 걸렸다. 그 글은 렌더되지 않는다.
 * 판정은 «문자열 바로 앞 코드»로 한다 — 호출 괄호가 열린 채 끝나면 그 호출의 인자다.
 */
function 화면밖문자열(앞) {
  return /(?:\bError|console\.\w+|\.(?:includes|startsWith|endsWith|indexOf|replace|split|test|match|padStart|padEnd)|\bstaticFile|\brequire|\bfrom)\s*\(?\s*$/.test(앞 || '');
}

/* ══ ③ 색 표기 ═══════════════════════════════════════════════════════════════ */

const 이름색 = /^(white|black|red|green|blue|yellow|orange|pink|purple|gray|grey|cyan|magenta|silver|gold|navy|brown|beige|ivory)$/i;

/**
 * @param 소스들 [{경로, 원문, 킷파일}] — 킷파일=true 면 「킷 다리 안 리터럴」로 따로 부른다
 * @param 토큰 docs/디자인_토큰.json 객체
 */
function 색검사(소스들, 토큰) {
  const 위반 = [];
  const 킷 = 토큰['색']['킷'];
  const 지도 = new Map(킷.map((c) => [c.이름, c]));
  const 시맨틱표 = 토큰['색']['시맨틱']['라이트'];
  for (const { 경로, 원문, 킷파일 } of 소스들) {
    const { 코드, 문자열들 } = 소스가르기(원문);
    const 줄들 = 코드.split('\n');
    줄들.forEach((줄, i) => {
      const 자리 = `${경로}:${i + 1}`;
      const 어디 = 킷파일 ? '킷 다리 안의 생 리터럴 — 토큰을 지나지 않는 값' : '킷 파일 밖의 생 리터럴';
      for (const m of 줄.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        위반.push(`${자리} 「${m[0]}」 — ${어디}(hex) · 규칙 = 킷/색.ts 머리말 「합성물 코드 어디에도 hex 리터럴을 쓰지 않는다」`);
      }
      for (const m of 줄.matchAll(/\b(rgba?|hsla?)\s*\(/g)) {
        /* 🔴 «조립»과 «손으로 적은 값»을 가른다 (2026-09-03 · codex P1 `f4eddcff4540` 채택 수리).
         *   앞판은 `rgba(` 를 무조건 잡아, 킷 다리가 토큰에서 뽑아 만든 헬퍼 둘
         *   (색.ts 의 `그늘`·`빛` — 값은 Graphite·지면.바탕에서 온다)까지 위반으로 세웠다.
         *   그러면 규칙을 «지키는 방법 자체»가 규칙 위반이 되어, 고칠 길이 없는 빨강이 남는다.
         * 🔑 첫 인자만 본다 — 거기가 숫자면 사람이 적은 값이고, 이름·`${}` 면 조립이다.
         *   `rgba(0,0,0,${a})` 처럼 반쪽이면 여전히 잡힌다(첫 인자가 0 이다). */
        const 첫값 = (줄.slice(m.index + m[0].length).match(/^\s*([^,)]*)/) || ['', ''])[1];
        if (/\$\{|[A-Za-z_가-힣]/.test(첫값)) continue;
        위반.push(`${자리} 「${m[0]}…」 — ${어디}(${m[1]}) · 규칙 = DESIGN.md §5 「색·서체를 킷 다리 밖에서 손으로 적지 않는다」`);
      }
    });
    for (const { 글, 줄 } of 문자열들) {
      if (이름색.test(글.trim())) {
        위반.push(`${경로}:${줄} 「${글}」 — ${킷파일 ? '킷 다리 안' : '킷 파일 밖'}의 이름색 리터럴 · 규칙 = DESIGN.md §2 철칙① 순백·순검정 금지 + 킷 밖 색 금지`);
      }
    }
    /* 부르는 이름이 토큰에 있나 · 쓸 수 있는 색인가(색.ts 의 런타임 던짐을 렌더 «전»에 잰다) */
    for (const m of 코드.matchAll(/(?<![\w가-힣.])색\(\s*"([^"]+)"\s*\)/g)) {
      const c = 지도.get(m[1]);
      const 줄 = 코드.slice(0, m.index).split('\n').length;
      if (!c) 위반.push(`${경로}:${줄} 색("${m[1]}") — 토큰 킷에 없는 이름`);
      else if (c.직책.includes('⏳')) 위반.push(`${경로}:${줄} 색("${m[1]}") — ⏳퇴역 대기 색(DESIGN.md §2 「새 산출물에 쓰지 않는다」)`);
      else if (c.팔레트.includes('K-Culture')) 위반.push(`${경로}:${줄} 색("${m[1]}") — K-Culture 4색은 Part 6 밖 반입 금지(조항 ⓙ)`);
    }
    for (const m of 코드.matchAll(/(?<![\w가-힣.])시맨틱\(\s*"([^"]+)"\s*\)/g)) {
      const 줄 = 코드.slice(0, m.index).split('\n').length;
      if (!시맨틱표[m[1]]) 위반.push(`${경로}:${줄} 시맨틱("${m[1]}") — 토큰 색.시맨틱.라이트 에 없는 역할`);
      else if (!지도.has(시맨틱표[m[1]])) 위반.push(`${경로}:${줄} 시맨틱("${m[1]}") → 「${시맨틱표[m[1]]}」 — 토큰 킷에 없는 이름(토큰이 스스로 갈렸다)`);
    }
  }
  return 위반;
}

/* ══ ④ 소리 이름 ═══════════════════════════════════════════════════════════════ */

/* 🔴 표에는 «이름»과 «경로»가 둘 다 산다 — 한쪽만 보면 자가 전부를 위반으로 찍는다
 *    (2026-09-03 · codex P1 `8cc86a6ac4c5` 채택 수리).
 *  무슨 일이 났나 — 표의 «키»는 논리 이름(`옹알이_까몽_궁금`)인데 장면이 적는 값은
 *  렌더가 실제로 여는 «경로»(`옹알이_까몽/궁금.wav`)다. 키만 보던 앞판은 클립 90벌의
 *  소리 전부를 「표에 없는 이름」으로 세웠다 — 실측 위반 563건 중 **560건이 이 오독**이었다.
 *  🔑 자가 전부를 빨갛게 칠하면 그 자는 아무것도 못 거른다. 진짜 하나(② cmap)가 560에 묻힌다.
 *  ⚠ 장면 쪽을 논리 이름으로 바꾸지 않는다 — 그 값은 렌더가 여는 실물 경로라, 고치면
 *    검사는 조용해지고 영상이 깨진다. 자를 물건에 맞춘다. */
function 소리검사(클립들, 카운트들, 소리표) {
  const 위반 = [];
  const 경로로이름 = new Map();
  for (const [이름, v] of Object.entries(소리표)) if (v && v.파일) 경로로이름.set(v.파일, 이름);
  const 있나 = (값) => Object.prototype.hasOwnProperty.call(소리표, 값) || 경로로이름.has(값);
  for (const c of 클립들) {
    for (const s of c.장면들) {
      if (s.소리 && !있나(s.소리)) 위반.push(`${c.id}/${s.꼴 || s.라벨} 소리 「${s.소리}」 — 소리 표에 이름으로도 경로로도 없다(정본 = 토큰 사운드.이벤트 + 옹알이 7 · _사운드킷.md 「이 순서 밖으로 만들지 않는다」)`);
    }
  }
  for (const c of 카운트들) {
    const 전부 = [
      ...(c.훅옹알이 || []).map((n) => ['훅', n]),
      ...(c.순위들 || []).flatMap((r) => (r.옹알이 || []).map((n) => [`${r.순}위`, n])),
      ...(c.마무리옹알이 || []).map((n) => ['마무리', n]),
    ];
    for (const [칸, n] of 전부) {
      const 이름 = `옹알이_${c.가이드}_${n}`;
      if (!있나(이름)) 위반.push(`${c.id}/${칸} 옹알이 「${n}」 → 「${이름}」 — 소리 표에 없는 이름(옹알이 7 = tools/감각층소리합성.js MURMURS · 가이드 = 소리어휘.js)`);
    }
  }
  return 위반;
}

/* ══ 실행 ═══════════════════════════════════════════════════════════════════ */

function 목록읽기(파일) {
  const p = path.join(생성방, 파일);
  if (!fs.existsSync(p)) return null;
  const m = fs.readFileSync(p, 'utf8').match(/= (\[[\s\S]*\]);/);
  return m ? JSON.parse(m[1]) : null;
}

function main() {
  const 못읽음 = [];
  const 클립들 = 목록읽기('대본클립들.ts');
  const 카운트들 = 목록읽기('카운트다운들.ts');
  if (!클립들 || !카운트들) 못읽음.push('src/클립/생성/ 이 없다 — 먼저 node 영상/대본읽기.js');
  let 토큰 = null;
  try { 토큰 = JSON.parse(fs.readFileSync(토큰경로, 'utf8')); } catch (e) { 못읽음.push(`docs/디자인_토큰.json 을 못 읽었다: ${e.message}`); }
  let 폰트벌 = null;
  try { 폰트벌 = JSON.parse(fs.readFileSync(폰트벌경로, 'utf8')); } catch (e) { 못읽음.push(`src/킷/폰트벌.json 을 못 읽었다: ${e.message}`); }
  let 소리표 = null;
  let 사운드킷정본 = null;
  try {
    const 소리어휘 = require('./소리어휘.js');
    소리표 = 소리어휘.소리표();
    사운드킷정본 = 소리어휘.사운드킷정본;
  } catch (e) { 못읽음.push(`소리 표를 못 만들었다: ${e.message}`); }

  const 가족별cmap = {};
  const 폰트경고 = [];
  if (폰트벌) {
    for (const v of 폰트벌.벌) {
      const p = path.join(폰트정본방, v.정본);
      if (!fs.existsSync(p)) { 못읽음.push(`폰트 정본이 없다: docs/브랜드_폰트/${v.정본}`); continue; }
      try {
        const { 집합, 건너뛴포맷 } = cmap읽기(fs.readFileSync(p));
        가족별cmap[v.family] ??= new Set();
        for (const c of 집합) 가족별cmap[v.family].add(c);
        if (건너뛴포맷.length) 폰트경고.push(`${v.정본} — cmap 포맷 ${건너뛴포맷.join('·')} 은 안 읽었다(4·12 만 읽는다)`);
      } catch (e) { 못읽음.push(`${v.정본} cmap 을 못 읽었다: ${e.message}`); }
    }
  }

  if (못읽음.length) {
    console.error('⛔ 발행검사 — 확인 불가(재료를 못 읽었다 · 통과가 아니다):');
    for (const m of 못읽음) console.error('   · ' + m);
    return 2;
  }

  const 소스들 = 소스파일들().map((p) => ({
    경로: 상대(p),
    원문: fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n'),
    킷파일: path.resolve(p) === path.resolve(킷색파일),
  }));

  const 응원위반 = 응원검사(클립들, 카운트들);
  const cmap결과 = cmap검사(렌더글자모으기(클립들, 카운트들, 소스들), 가족별cmap, 폰트벌.선언밖 || {});
  const 색위반 = 색검사(소스들, 토큰);
  const 소리위반 = 소리검사(클립들, 카운트들, 소리표);

  /* 정본 둘의 수가 같은지 — _사운드킷.md 가 적은 「이벤트 N칸」 ↔ 토큰 실제. 갈리면 알린다(막지는 않는다 — 문서 낱말은 바뀔 수 있다). */
  const 사운드킷경고 = [];
  try {
    const md = fs.readFileSync(사운드킷정본, 'utf8');
    const m = md.match(/사운드\.이벤트`\*?\*?\s*\*?\*?(\d+)칸/);
    const 토큰수 = Object.keys(토큰['사운드']['이벤트']).length;
    if (m && Number(m[1]) !== 토큰수) 사운드킷경고.push(`_사운드킷.md 는 이벤트 ${m[1]}칸이라 적었는데 토큰은 ${토큰수}칸 — 문서가 낡았다`);
    if (!m) 사운드킷경고.push('_사운드킷.md 에서 「사운드.이벤트 N칸」 줄을 못 찾았다 — 수 대조를 안 했다');
  } catch (e) { 사운드킷경고.push(`_사운드킷.md 를 못 읽었다: ${e.message}`); }

  const 위반전량 = [
    ...응원위반.map((v) => `① ${v}`),
    ...cmap결과.위반.map((v) => `② ${v}`),
    ...색위반.map((v) => `③ ${v}`),
    ...소리위반.map((v) => `④ ${v}`),
  ];
  const 글자수 = new Set(렌더글자모으기(클립들, 카운트들, 소스들).flatMap(({ 글 }) => [...String(글 || '')])).size;
  console.log(
    `발행검사 — 클립 ${클립들.length} + 카운트다운 ${카운트들.length} · 소스 ${소스들.length}파일 · 글자 ${글자수}종 · 소리 이름 ${Object.keys(소리표).length}\n` +
      `   ① 단독 응원 ${응원위반.length} · ② cmap 빠짐 ${cmap결과.위반.length}(이모지 경고 ${cmap결과.경고.length}) · ③ 색 표기 ${색위반.length} · ④ 소리 이름 ${소리위반.length}`,
  );
  for (const w of [...cmap결과.경고, ...폰트경고, ...사운드킷경고]) console.log(`   ⚠ ${w}`);
  if (위반전량.length) {
    console.error(`\n🔴 발행검사 위반 ${위반전량.length}건 — 고칠 자리:`);
    for (const v of 위반전량) console.error('   · ' + v);
    return 1;
  }
  console.log('✅ 발행검사 통과 — 기계가 볼 수 있는 것만 통과했다. 두부·서체·구도는 여전히 프레임뽑기로 눈이 본다.');
  return 0;
}

module.exports = {
  소스가르기, jsx글, 단독응원인가, 응원검사, cmap읽기, cmap검사, 렌더글자모으기, 색검사, 소리검사, 소스파일들, main,
};

if (require.main === module) {
  let 코드;
  try { 코드 = main(); } catch (e) { console.error(`⛔ 발행검사 — 확인 불가(검사기 자체가 죽었다): ${e.stack || e}`); 코드 = 2; }
  process.exit(코드);
}
