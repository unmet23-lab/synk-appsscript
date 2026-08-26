#!/usr/bin/env node
/**
 * 대본 md → 클립 데이터. **45편이 손을 안 거치고 서게 하는 통로.**
 *
 * 🔴 왜 필요했나 — 착수일 실측(08-26): 대본 45편 중 **자동으로 되는 편이 0편**이었다.
 *   01편 1화 하나가 손으로 옮겨 적혀 있었고, 그 손옮김이 대본에 «없는» 몽골어 한 줄을 지어냈다.
 *   손이 45번 반복되면 그런 것이 45번 난다.
 *
 * 🔴 이 파일이 «정본»이 아니다 — 정본은 대본 md 다.
 *   여기서 나온 `src/클립/생성/대본클립들.ts` 는 산출물이고, 손으로 고치면 다음 굽기가 덮는다.
 *   (저장소 상습 함정: 「정본은 고쳤는데 산출물을 안 구웠다」 — 굽기.js 가 매번 이걸 먼저 부른다.)
 *
 * 쓰기:  node 영상/대본읽기.js          — 읽고, 검사하고, 생성물을 쓴다
 *        node 영상/대본읽기.js --검사   — 쓰지 않고 무엇이 되고 안 되는지만 센다
 */
const fs = require('fs');
const path = require('path');

const 방 = __dirname;
const 저장소 = path.resolve(방, '..');
const 대본방 = path.join(저장소, '.claude', 'skills', 'synk-content', 'references', '리드크루클립');
const 생성경로 = path.join(방, 'src', '클립', '생성', '대본클립들.ts');
const 소리방 = path.join(방, 'public', '소리');

const FPS = 30;
/** 훅 3초 + 본문 27초 = 30초. 두 정본(synk-content 15~30 · 제작가이드 30~40)이 «둘 다» 만족하는 유일한 값. */
const 훅프레임 = FPS * 3;
const 본문프레임 = FPS * 27;

/**
 * 라벨별 기본 길이(합 810 = 27초).
 * ⚠ 일부러 다르게 뒀다 — 전부 같으면 리듬이 없어 30초가 슬라이드쇼로 읽힌다.
 *   핵심(표현)은 짧고 단단하게, 예문은 읽을 시간을 준다. 01편 1화 손판이 쓰던 값 그대로다.
 */
const 기본길이 = { 표현: 135, 뜻: 120, '예문 1': 150, '예문 2': 150, 따라하기: 135, 클로징: 120 };

/** 대본의 「타이밍」 칸 → 화면 알약에 찍힐 글자. 「클로징」은 제작 용어라 학생에게 안 보인다. */
const 화면라벨 = {
  표현: '표현',
  뜻: '뜻',
  '예문 1': '예문 1',
  '예문 2': '예문 2',
  따라하기: '따라하기',
  클로징: '오늘의 한 문장',
};

/**
 * 라벨별 효과음.
 * 🔴 「모오옹」(moong)은 **완료축하 전용**이다(형제 저장소 `SYNK-talk/lib/몽글목소리.js` 의 `배치` 정본).
 *   첫 판은 그것을 「따라하기」에 쓰고 완료 자리엔 앱 UI 알림음을 써서 **정확히 서로 바뀌어** 있었다.
 *   그래서 아래 표가 정본이고, 검사 ⑥ 이 「moong 이 클로징 아닌 곳에 있으면 실패」로 못 박는다.
 */
const 라벨소리 = {
  표현: 'synk-voice-ppoo.wav',
  뜻: 'synk-voice-mu.wav',
  '예문 1': 'synk-voice-ppuu.wav',
  '예문 2': 'synk-voice-miyu.wav',
  따라하기: 'synk-voice-mu.wav',
  클로징: 'synk-voice-moong.wav',
};

const 라벨순서 = ['표현', '뜻', '예문 1', '예문 2', '따라하기', '클로징'];

const 키릴 = /[Ѐ-ӿ]/;
const 한글 = /[가-힣]/;
/* ⚠ `g` 플래그를 안 붙인다 — `.test()` 를 되풀이 부를 때 `lastIndex` 가 남아 한 번 걸러 한 번씩 놓친다. */
const 그림글자 = /\p{Extended_Pictographic}/u;

/**
 * 셀 한 칸을 한국어 / 몽골어로 가른다.
 *
 * 🔴 구분자(「 — 」)로 가르지 않는다 — **키릴 글자가 실제로 있는지**로 가른다.
 *   까닭: 클로징 행 「오늘의 한 문장 완료 — 어제의 나 +1 ✨」에는 몽골어 칸이 아예 없는데
 *   구분자로 자르면 「어제의 나 +1 ✨」가 «몽골어»로 둔갑한다. 첫 판이 여기서 문장을 지어냈다.
 */
function 갈라읽기(셀) {
  const 글 = 셀.replace(/\*\*/g, '').trim();
  const 첫키릴 = 글.search(키릴);
  if (첫키릴 === -1) return { 한국어: 글, 몽골어: '' };
  /* 🔴 「첫 구분자」가 아니라 «첫 키릴 글자 앞의 마지막 구분자»가 경계다.
     한국어 쪽에도 구분자가 들어 있는 행이 있다 — 대화가 오가는 예문(「이름이 뭐예요? — 저는 지훈이에요.
     — Таны нэр хэн бэ? …」)과 따라하기 단서(「눈 맞추고 2번 — 짧은 버전 "잠시만요!"도! — Нүд …」).
     첫 구분자로 자르면 그 «한국어 뒷도막»이 몽골어 칸으로 넘어간다(실측 4행). */
  const p = 글.lastIndexOf(' — ', 첫키릴);
  if (p === -1) return { 한국어: 글, 몽골어: '' }; /* 가를 자리가 없다 — 지어내지 않고 검사에서 잡는다 */
  return { 한국어: 글.slice(0, p).trim(), 몽골어: 글.slice(p + 3).trim() };
}

/** 장면 길이 배분 — 라벨 기본값을 바탕에 두고, 읽는 데 그보다 더 걸리면 그만큼 늘린 뒤 27초로 정규화한다. */
function 길이배분(장면들) {
  const 날것 = 장면들.map((s) => {
    const 필요 = Math.ceil(FPS * (0.9 + s.한국어.length / 11 + (s.몽골어 ? s.몽골어.length / 22 : 0)));
    return Math.max(기본길이[s.md라벨], 필요);
  });
  const 합 = 날것.reduce((a, b) => a + b, 0);
  const 나눔 = 날것.map((v) => Math.round((v * 본문프레임) / 합));
  /* 반올림 잔돈은 제일 긴 장면이 흡수한다 — 합이 «정확히» 810 이어야 30.00초가 나온다 */
  const 잔 = 본문프레임 - 나눔.reduce((a, b) => a + b, 0);
  if (잔 !== 0) 나눔[나눔.indexOf(Math.max(...나눔))] += 잔;
  return 나눔;
}

/**
 * `## …` 머리에서 «화 번호»와 «표현 이름»을 뽑는다.
 *
 * 🔴 첫 판은 `## N편 — "표현"` 한 꼴만 봤고, 그래서 **45화 중 15화만 «보인다»고 셌다.**
 *   나머지 30화는 미달로도 안 잡히고 통째로 사라졌다 — 「0건」이 아니라 「안 재봤다」였던 자리다.
 *   실측하니 아홉 파일이 다섯 꼴을 쓴다:
 *     ① `## 1편 — "안녕하세요" (부제)`      01·06·09
 *     ② `## 1편 — 카페 주문 "○○ 주세요"`     02
 *     ③ `## 클립 1 — 대박 (부제)`            03·04·05
 *     ④ `## 1편. 지하철 환승 — "어디서…"`     07
 *     ⑤ `## 1. ㅋㅋ — 한국 채팅의 웃음소리`   08
 *   머리 꼴을 통일하는 일은 대본 쪽 몫이고(트랙 §2-영상), 이 함수는 그때까지 다섯 꼴을 다 읽는다.
 */
function 머리제목(머리) {
  const n = 머리.match(/^(?:클립\s*)?(\d+)\s*(?:편)?\s*[.．]?\s*(.*)$/);
  if (!n) return null;
  const 뒤 = n[2].replace(/^[—\-–]\s*/, '').trim();
  const 따옴 = 뒤.match(/"([^"]+)"/);
  const 이름 = 따옴 ? 따옴[1] : 뒤.split(/\s+[—\-–]\s+/)[0].split(' (')[0].trim();
  if (!이름) return null;
  return { 화: Number(n[1]), 이름 };
}

function 편읽기(파일) {
  const 원문 = fs.readFileSync(path.join(대본방, 파일), 'utf8');
  const 편 = 파일.slice(0, 2);
  const 출처 = `.claude/skills/synk-content/references/리드크루클립/${파일}`;
  const 덩이 = 원문.split(/^## /m).slice(1);
  const 클립들 = [];
  const 미달 = [];

  for (const d of 덩이) {
    const 머리 = d.split('\n')[0];
    const m = 머리제목(머리);
    if (!m) continue; /* 「시리즈 운영 메모」 같은 절 */
    const { 화, 이름 } = m;

    const 훅m = d.match(/\*\*\[훅 자막\]\*\*[^\n]*\n>\s*(.+)/);
    const 행들 = [...d.matchAll(/^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/gm)]
      .map((r) => [r[1].trim(), r[2].trim()])
      .filter(([a]) => a !== '타이밍' && !/^-+$/.test(a));

    const 라벨들 = 행들.map(([a]) => a);
    if (!훅m || 라벨들.length !== 6 || 라벨순서.some((L, i) => 라벨들[i] !== L)) {
      미달.push({
        편,
        화,
        이름,
        까닭: !훅m
          ? '훅 자막이 없다'
          : `«타임코드 표»가 아니다(라벨 ${라벨들.length}개: ${라벨들.join('·') || '없음'})`,
      });
      continue;
    }

    const 장면들 = 행들.map(([md라벨, 셀]) => {
      const { 한국어, 몽골어 } = 갈라읽기(셀);
      const 라벨 = 화면라벨[md라벨];
      /* 셀이 화면 라벨로 시작하면 알약과 «같은 말»을 두 번 쓰지 않는다
         (01편 1화: 알약 「오늘의 한 문장」 + 자막 「오늘의 한 문장 완료 …」로 겹쳤다) */
      const 겹침없는한국어 = 한국어.startsWith(라벨 + ' ') ? 한국어.slice(라벨.length + 1).trim() : 한국어;
      return {
        md라벨,
        라벨,
        한국어: 겹침없는한국어,
        몽골어,
        표정: md라벨 === '클로징' ? '눈웃음' : '본체',
        소리: 라벨소리[md라벨],
      };
    });

    길이배분(장면들).forEach((f, i) => {
      장면들[i].프레임 = f;
    });

    클립들.push({
      id: `clip-${편}-${화}`,
      제목: `${편}편 ${화}화 ${이름}`,
      편,
      화,
      훅: 훅m[1].trim(),
      장면들,
      전체프레임: 훅프레임 + 본문프레임,
      출처,
    });
  }
  return { 클립들, 미달 };
}

/* ── 검사 — 「자막 글 층이 통째로 무검사」였다(08-26 갭 조사). 여기서 첫 겹을 친다 ────── */
function 검사(클립들) {
  const 문제 = [];
  const 소리목록 = fs.existsSync(소리방) ? new Set(fs.readdirSync(소리방)) : new Set();
  for (const c of 클립들) {
    /* 🔑 «그래핌» 으로 센다 — 이모지 하나가 코드포인트 여럿인 것이 있어(ZWJ·피부색) 정규식 히트 수로 세면
       한 개를 서넛으로 부풀린다. 반대로 부풀린 수로 막으면 정상 자막이 막힌다. */
    const 조각들 = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(
      [c.훅, ...c.장면들.flatMap((s) => [s.한국어, s.몽골어])].join(' '),
    )];
    const 그림수 = 조각들.filter((g) => 그림글자.test(g.segment)).length;
    if (그림수 > 2) 문제.push(`${c.id} 이모지 ${그림수}개 — 숏폼 1편 최대 2개(synk-brand)`);
    for (const s of c.장면들) {
      if (!s.한국어) 문제.push(`${c.id} 「${s.라벨}」 한국어가 비었다`);
      if (키릴.test(s.한국어)) 문제.push(`${c.id} 「${s.라벨}」 한국어 칸에 키릴이 섞였다 — 가르는 데 실패했다`);
      if (s.몽골어 && 한글.test(s.몽골어)) 문제.push(`${c.id} 「${s.라벨}」 몽골어 칸에 한글이 섞였다`);
      if (s.소리 && !소리목록.has(s.소리)) 문제.push(`${c.id} 「${s.라벨}」 소리 «${s.소리}» 가 public/소리 에 없다`);
      if (s.소리 === 'synk-voice-moong.wav' && s.md라벨 !== '클로징')
        문제.push(`${c.id} 「${s.라벨}」 에 모오옹 — 완료축하 전용이다`);
      if (s.프레임 < FPS) 문제.push(`${c.id} 「${s.라벨}」 ${s.프레임}f — 1초 미만은 못 읽는다`);
    }
    const 합 = c.장면들.reduce((a, s) => a + s.프레임, 0) + 훅프레임;
    if (합 !== c.전체프레임) 문제.push(`${c.id} 프레임 합 ${합} ≠ ${c.전체프레임}`);
  }
  return 문제;
}

/* ── 실행 ──────────────────────────────────────────────────────────────── */
const 파일들 = fs.readdirSync(대본방).filter((f) => /^\d\d_.*\.md$/.test(f)).sort();
const 클립들 = [];
const 미달 = [];
for (const f of 파일들) {
  const r = 편읽기(f);
  클립들.push(...r.클립들);
  미달.push(...r.미달);
}

const 문제 = 검사(클립들);
const 몽골어없음 = 클립들.flatMap((c) => c.장면들.filter((s) => !s.몽골어).map((s) => `${c.id}/${s.라벨}`));

console.log(
  `대본 ${파일들.length}편 · 화 ${클립들.length + 미달.length}개 = 선 것 ${클립들.length} + 스키마 미달 ${미달.length}`,
);
if (미달.length) {
  const 편별 = {};
  for (const m of 미달) (편별[m.편] ??= []).push(m.화);
  console.log(
    `   ⛔ 미달 ${미달.length}화: ${Object.entries(편별)
      .map(([p, hs]) => `${p}편(${hs.length})`)
      .join(' · ')} — 「타이밍|자막」 6행 표가 아니다`,
  );
  console.log(`      까닭 갈래: ${[...new Set(미달.map((m) => m.까닭.replace(/\(라벨.*/, '(라벨 불일치)')))].join(' / ')}`);
}
console.log(
  `   몽골어 빈 칸 ${몽골어없음.length}개${
    몽골어없음.length
      ? ` — ${[...new Set(몽골어없음.map((v) => v.split('/')[1]))].join('·')} (대본에 몽골어가 없다 · 지어내지 않았다)`
      : ''
  }`,
);

if (문제.length) {
  console.error('\n🔴 검사 실패 — 생성물을 쓰지 않는다:');
  for (const p of 문제) console.error('   · ' + p);
  process.exit(1);
}

if (process.argv.includes('--검사')) {
  console.log('\n✅ 검사만 하고 끝낸다(생성물 안 씀).');
  process.exit(0);
}

const 담을것 = 클립들.map(({ 장면들, ...c }) => ({
  ...c,
  장면들: 장면들.map(({ md라벨, ...s }) => s),
}));

const 본문 = `/* ⚠ 기계가 쓴 파일이다 — 손으로 고치지 마라.
 * 정본은 대본 md(\`.claude/skills/synk-content/references/리드크루클립/\`)이고,
 * 이 파일은 \`node 영상/대본읽기.js\` 의 산출물이다. 굽기.js 가 매 굽기 전에 다시 쓴다.
 */
import type { 클립 } from "../타입";

export const 대본클립들: 클립[] = ${JSON.stringify(담을것, null, 2)};
`;

const 옛 = fs.existsSync(생성경로) ? fs.readFileSync(생성경로, 'utf8') : '';
if (옛 !== 본문) {
  fs.writeFileSync(생성경로, 본문, 'utf8');
  console.log(`\n✅ ${path.relative(저장소, 생성경로)} — 클립 ${클립들.length}개`);
} else {
  console.log(`\n✅ 생성물이 이미 최신이다 — 클립 ${클립들.length}개`);
}
