// 판본(나라별 글, 11-10 LAB 하루 두 편 · 설계 6 · 20) — src/film/판본/<KEY>.json 하나가 판본 하나다(11-21 처음부터 판본 틀로 만든 편).
// LAB 몽골 M68 「거절할 때 네 마디」. 몽골어는 세 겹 검수(../../../게시/검문/)를 거친 글만 판본/MN.json에.
// 키는 계정 원장(docs/마케팅/sns-계정.json) LAB 계정의 rotationVersion, 없으면 countryCode. 같은 영어라도 나라마다 판본이 따로다.
// 그림 · 한국어(말의 한글) · 소리 · 박자 · 카메라는 정본 하나(data.ts · Film.tsx)이고, 판본은 글 자리와 글꼴만 바꾼다(원본 동결).
// 글이 다 찬 판본만 낸다 — 빈 칸이 있으면 Root가 컴포지션을 등록하지 않고, 편 폴더의 판본렌더.mjs가 그 키를 건너뛰며 빈 칸을 알린다.
// `_`로 시작하는 칸(_설명 · _한도 · _원문)은 글 쓰는 사람을 위한 안내라 읽지 않는다. 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅜ=у · ㅡ=ы · 받침 ㅇ=н · ㅈ=ж).
// 읽는 법(reads · msgRead · naRead)은 정본 글꼴(Inter Tight 기울임)로 그린다 — 몽골판만 키릴, 다른 판은 로마자다.
export type LocPack = {
  lang: string; // 언어(계정 원장 language)
  font: string; // 그 나라 글 서체 줄
  lineH: number; // 그 나라 글의 줄 높이 하한 — 머리 글 · 뜻 줄은 max(1.14, lineH), 끝 줄은 max(1.2, lineH). 몽골판 1.14
  hook: string; // 0~1.5초 머리 글 「한국에서 「아니요」를 공손하게 말하는 네 가지 방법」(줄 바꿈 문자로 두 줄)
  hookSize: number; // 몽골판 80
  reads: string[]; // 한국어 열두 줄의 읽는 법 — 싫어요! · 괜찮아요 · 다음에요 · 좀 생각해 볼게요 · 마음만 받을게요 · 노래방 가자! · 다음에요~ · 한 잔 받아! · 주말에 등산 가자! · 소개팅 할래? · 택시비 해! · 또 다음에?!
  means: string[]; // 그 뜻 열둘(말풍선 맨 위 자주색 줄)
  meanSize: number; // 몽골판 54
  ngPill: string; // 3.9~5.2초 「싫어요!」 위 빨간 알약 「윗사람에게는 안 돼요」(✕는 화면이 붙인다)
  pillSize: number; // 몽골판 58
  okPill: string; // 네 마디와 「다음에요~」 말풍선 아래 초록 알약 「= 공손한 「아니요」」(✓는 화면이 붙인다 — 이해 시험 v2 둘(G · s)이 「좀 생각해 볼게요」 · 「마음만 받을게요」가 거절인지 헷갈린다고 짚음)
  okPillSize: number; // 몽골판 40
  recall: string; // 19.25~20.3초 선배 생각 구름(아까 등산 장면) 아래 작은 띠 「⏪ 아까 등산: 「다음에요」」
  end: string; // 20.7초~끝 끝 줄(크림색) — 두 번째 「다음에요」는 거절
  endSize: number; // 몽골판 64
  coverAt: number; // 표지(cover.png)로 뜰 초
  // 나라 인사 카드(11-12, 선택 — Greeting.tsx). hello가 빈 글이면 인사 없이 원본 그대로다.
  hello: string;
  helloName: string;
  helloRead: string;
  helloVo: string;
  helloSec: number;
};

// ── 아래는 여러 편이 같은 꼴로 쓴다(편마다 칸 표만 다르다) ──
type 칸 = '글' | '글?' | '수' | '참거짓' | { 글들: number; 선택?: boolean } | { 수들: number };
const 칸표: Record<keyof LocPack, 칸> = {
  lang: '글', font: '글', lineH: '수', hook: '글', hookSize: '수',
  reads: { 글들: 12 }, means: { 글들: 12 }, meanSize: '수', ngPill: '글', pillSize: '수', okPill: '글', okPillSize: '수', recall: '글',
  end: '글', endSize: '수', coverAt: '수',
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
