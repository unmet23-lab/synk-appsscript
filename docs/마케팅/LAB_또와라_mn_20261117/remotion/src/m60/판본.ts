// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/m60/판본/<KEY>.json 하나가 판본 하나다.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말풍선 여덟의 한글 · 「-어라」 이름표의 한국어 두 줄 · 목소리) · 소리 · 박자 · 카메라는 정본 하나(Film.tsx · data.ts)이고,
// 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄 — 말풍선의 읽는 법 · 뜻, 이름표 뜻 줄, 공항 한 줄이 함께 쓴다(키릴 · 로마자는 Inter Tight · SUIT, 그 밖의 문자는 시스템 글꼴을 뒤에)
  lineH: number; // 그 나라 글 줄 높이 하한(배수) — 칸마다 원래 값(말풍선 읽는 법 · 뜻 1.15 · 이름표 뜻 줄 1.1 · 공항 한 줄 1.15)보다 클 때만 쓴다. 몽골판 1.05(원래 값 그대로)
  reads: string[]; // 말풍선 여덟의 둘째 줄 — 한글의 읽는 법(몽골판 키릴 «мөгөра!» …). 차례는 data.ts KO_LINES(먹어라! · 입어라! · 챙겨라! · 가라! · 가라! 가라! · 또 와라 · 네…! · 챙겨라!)
  readSizes: number[]; // 읽는 법 여덟의 글자 크기(px) — 몽골판 모두 52
  means: string[]; // 말풍선 여덟의 셋째 줄(붉은 굵은 글) — 그 말의 뜻(몽골판 «Идээрэй!» …). 한 줄(줄 바꿈 없음)
  meanSizes: number[]; // 뜻 여덟의 글자 크기(px) — 몽골판 모두 52
  cardEq: string; // 7.6~9.3초 「-어라」 이름표 둘째 줄(주황 굵은 글) — 「= 그 나라 말로 무엇」(몽골판 «= -аарай»). 한 줄(줄 바꿈 없음)
  cardEqSize: number; // 몽골판 70
  cap: string; // 9.3~10.6초 공항 위 흰 카드 한 줄 「✈️ 몽골로 돌아가는 날…」(줄 바꿈 문자로 두 줄 — 760px을 넘으면 저절로도 갈린다)
  capSize: number; // 몽골판 66
  coverAt: number; // 표지(cover.png)로 뜰 초 — 몽골판 13.6(울면서 무빙워크에 끌려가는 할머니 · 핵심 장면). 인사가 있는 판본은 인사 길이만큼 뒤
  // 나라 인사 카드(11-12, 선택 — Greeting.tsx). hello가 빈 글이면 인사 없이 원본 그대로다.
  hello: string; // 인사말(그 나라 말) — 인사 그림에 펠트 글자로 구워져 있다(화면 글꼴로 얹지 않는다)
  helloName: string; // 한글 나라 이름(느낌표까지) — 구운 글자
  helloRead: string; // 나라 이름 읽는 법(로마자) — 구운 글자
  helloVo: string; // 몽글 목소리(소진)가 읽는 글 — public/greet/<KEY>.wav
  helloSec: number; // 인사 길이(초) — 그만큼 원본이 뒤로 밀린다
};

// ── 아래는 여러 편이 같은 꼴로 쓴다(편마다 칸 표만 다르다) ──
// 칸 꼴: 글(빈 글 안 됨) · 글?(선택 — 비우면 그 자리를 그리지 않음) · 수 · 참거짓 · 글들(개수 고정, 선택이면 빈 글 됨) · 수들
type 칸 = '글' | '글?' | '수' | '참거짓' | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', font: '글', lineH: '수',
  reads: { 글들: 8 }, readSizes: { 수들: 8 }, means: { 글들: 8 }, meanSizes: { 수들: 8 },
  cardEq: '글', cardEqSize: '수', cap: '글', capSize: '수', coverAt: '수',
  hello: '글?', helloName: '글?', helloRead: '글?', helloVo: '글?', helloSec: '수',
};

// 판본 글에서 빈 칸 · 틀린 꼴을 찾는다(없으면 빈 배열)
export const 빈칸 = (p: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const [k, kind] of Object.entries(칸표) as [string, 칸][]) {
    const v = p[k];
    if (kind === '글' || kind === '글?') {
      if (typeof v !== 'string') out.push(`${k}: 글이 아님`);
      else if (kind === '글' && !v.trim()) out.push(`${k}: 빈 글`);
    } else if (kind === '수') {
      if (typeof v !== 'number' || !Number.isFinite(v)) out.push(`${k}: 수가 아님`);
    } else if (kind === '참거짓') {
      if (typeof v !== 'boolean') out.push(`${k}: true/false가 아님`);
    } else if ('수들' in kind) {
      if (!Array.isArray(v) || v.length !== kind.수들 || v.some((x) => typeof x !== 'number' || !Number.isFinite(x))) out.push(`${k}: 수 ${kind.수들}개가 아님`);
    } else if (!Array.isArray(v) || v.length !== kind.글들) out.push(`${k}: 글 ${kind.글들}개가 아님`);
    else
      v.forEach((x, i) => {
        if (typeof x !== 'string') out.push(`${k}[${i}]: 글이 아님`);
        else if (!kind.선택 && !x.trim()) out.push(`${k}[${i}]: 빈 글`);
      });
  }
  // 나라 인사 — 인사말이 있으면 나라 이름 · 읽는 법 · 목소리 글도 있어야 하고 길이는 0~3초
  if (typeof p.hello === 'string' && p.hello.trim()) {
    for (const k of ['helloName', 'helloRead', 'helloVo']) if (typeof p[k] !== 'string' || !(p[k] as string).trim()) out.push(`${k}: 빈 글(인사가 켜진 판본)`);
    if (!(typeof p.helloSec === 'number' && p.helloSec > 0 && p.helloSec <= 3)) out.push('helloSec: 0~3초의 수가 아님');
  }
  return out;
};

// 판본 폴더의 JSON을 번들 때 모두 묶는다(rspack · webpack의 require.context — 파일을 더하면 다음 번들에 저절로 든다)
type 묶음 = { keys(): string[]; (id: string): unknown };
declare global {
  namespace NodeJS {
    interface Require {
      context(dir: string, deep: boolean, re: RegExp): 묶음;
    }
  }
}
const ctx: 묶음 = require.context('./판본', false, /^\.\/[A-Z]{2}\.json$/);
const 키들: string[] = [...new Set(ctx.keys().map((k: string) => k.replace(/^.*\/([A-Z]{2})\.json$/, '$1')))].sort();
export const 판본들: { key: string; pack: LocPack }[] = 키들
  .map((key) => ({ key, raw: ctx(`./${key}.json`) as Record<string, unknown> }))
  .filter(({ raw }) => 빈칸(raw).length === 0)
  .map(({ key, raw }) => ({ key, pack: Object.fromEntries(Object.keys(칸표).map((k) => [k, raw[k]])) as LocPack }));
